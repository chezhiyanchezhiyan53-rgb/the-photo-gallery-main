const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const root = __dirname;
const dataDir = path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'photo-gallery.sqlite'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, PRIMARY KEY(organization_id,user_id));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, client_id TEXT NOT NULL REFERENCES clients(id), title TEXT NOT NULL, event_type TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', total_amount INTEGER NOT NULL DEFAULT 0, amount_paid INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'LEAD', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS galleries (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, password_hash TEXT, expires_at TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quotations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES projects(id), amount INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'DRAFT', expires_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES projects(id), number TEXT NOT NULL, amount INTEGER NOT NULL, amount_paid INTEGER NOT NULL DEFAULT 0, due_date TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT NOT NULL, UNIQUE(organization_id,number));
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES projects(id), invoice_id TEXT REFERENCES invoices(id), provider TEXT NOT NULL, provider_reference TEXT NOT NULL UNIQUE, amount INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, paid_at TEXT);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id TEXT, user_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
`);

const port = Number(process.env.PORT || 4173);
const sessionTtlSeconds = 60 * 60 * 24 * 7;
const loginAttempts = new Map();
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const passwordHash = (password) => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(password, salt, 64).toString('hex'); };
const passwordMatches = (password, saved) => { try { const [saltHex, digestHex] = saved.split(':'); const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64); const expected = Buffer.from(digestHex, 'hex'); return actual.length === expected.length && crypto.timingSafeEqual(actual, expected); } catch { return false; } };
const json = (res, status, value, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); };
const bad = (status, message, code = 'request_error') => Object.assign(new Error(message), { status, code });
const cookieMap = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((piece) => piece.trim().split(/=(.*)/s).slice(0, 2)).filter((part) => part.length === 2));
function setSessionCookies(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', 'pg_session=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + sessionTtlSeconds + secure);
}
function clearSessionCookie(res) { res.setHeader('Set-Cookie', 'pg_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); }
async function readJson(req, limit = 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw bad(413, 'Request body is too large', 'body_too_large'); chunks.push(chunk); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw bad(400, 'Invalid JSON body', 'invalid_json'); }
}
function getSession(req) {
  const token = cookieMap(req).pg_session;
  if (!token) return null;
  const row = db.prepare(`SELECT u.id user_id,u.email,u.name,m.organization_id,m.role,o.name organization_name,s.expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id
    WHERE s.token_hash=?`).get(hash(token));
  if (!row || row.expires_at < Date.now()) { if (row) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); return null; }
  return row;
}
function record(session, action, type, target, detail = '') {
  db.prepare('INSERT INTO audit_log (organization_id,user_id,action,target_type,target_id,detail,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(session.organization_id, session.user_id, action, type, target, detail, now());
}
function assertOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const expected = (req.socket.encrypted ? 'https://' : 'http://') + req.headers.host;
  if (origin !== expected) throw bad(403, 'Request origin is not allowed', 'origin_rejected');
}
function requireSession(req) { const session = getSession(req); if (!session) throw bad(401, 'Sign in to continue', 'not_authenticated'); return session; }
function requireRole(session, roles) { if (!roles.includes(session.role)) throw bad(403, 'You do not have permission to perform this action', 'not_authorized'); }
function safeUser(session) { return { id: session.user_id, email: session.email, name: session.name, organizationId: session.organization_id, organizationName: session.organization_name, role: session.role }; }
function validateText(value, label, max = 160, required = true) { const text = String(value ?? '').trim(); if ((required && !text) || text.length > max) throw bad(400, label + (required ? ' is required and must be under ' : ' must be under ') + max + ' characters', 'invalid_field'); return text; }
function ensureOwned(table, recordId, session) {
  const row = db.prepare(`SELECT id FROM ${table} WHERE id=? AND organization_id=?`).get(recordId, session.organization_id);
  if (!row) throw bad(404, 'Record not found', 'not_found');
  return row;
}
function routeMatch(pathname, pattern) { const m = pathname.match(pattern); return m; }

async function api(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;
  if (method !== 'GET' && method !== 'HEAD') assertOrigin(req);
  if (method === 'GET' && pathname === '/api/health') return json(res, 200, { status: 'ok', mode: 'local-development', storage: 'metadata-only' });

  if (method === 'POST' && pathname === '/api/auth/signup') {
    const body = await readJson(req);
    const name = validateText(body.name, 'Name', 100);
    const email = validateText(body.email, 'Email', 180).toLowerCase();
    const studio = validateText(body.studioName, 'Studio name', 140);
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad(400, 'Enter a valid email address', 'invalid_email');
    if (password.length < 12 || password.length > 200) throw bad(400, 'Use a password between 12 and 200 characters', 'weak_password');
    const userId = id(); const organizationId = id(); const created = now();
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
    const role = superAdminEmails.includes(email) ? 'SUPER_ADMIN' : 'OWNER';
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)').run(organizationId, studio, created);
      db.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(userId, email, name, passwordHash(password), created);
      db.prepare('INSERT INTO memberships(organization_id,user_id,role) VALUES(?,?,?)').run(organizationId, userId, role);
      db.exec('COMMIT');
    } catch (error) { try { db.exec('ROLLBACK'); } catch {} if (String(error.message).includes('UNIQUE')) throw bad(409, 'An account already exists for this email', 'email_exists'); throw error; }
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), userId, Date.now() + sessionTtlSeconds * 1000);
    setSessionCookies(res, token);
    record({ organization_id: organizationId, user_id: userId }, 'ACCOUNT_CREATED', 'user', userId);
    return json(res, 201, { user: { id: userId, email, name, organizationId, organizationName: studio, role } });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const key = req.socket.remoteAddress + ':' + email;
    const attempts = loginAttempts.get(key) || { count: 0, since: Date.now() };
    if (Date.now() - attempts.since > 15 * 60 * 1000) { attempts.count = 0; attempts.since = Date.now(); }
    if (attempts.count >= 10) throw bad(429, 'Too many sign-in attempts. Try again later.', 'login_rate_limited');
    const user = db.prepare('SELECT id,email,name,password_hash FROM users WHERE email=?').get(email);
    if (!user || !passwordMatches(String(body.password || ''), user.password_hash)) {
      attempts.count += 1; loginAttempts.set(key, attempts); throw bad(401, 'Email or password is incorrect', 'invalid_credentials');
    }
    loginAttempts.delete(key);
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), user.id, Date.now() + sessionTtlSeconds * 1000);
    setSessionCookies(res, token);
    return json(res, 200, { user: safeUser(getSession({ ...req, headers: { ...req.headers, cookie: 'pg_session=' + token } })) });
  }

  if (method === 'GET' && pathname === '/api/auth/session') { const session = getSession(req); return json(res, 200, { user: session ? safeUser(session) : null }); }
  if (method === 'POST' && pathname === '/api/auth/logout') { const token = cookieMap(req).pg_session; if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); clearSessionCookie(res); return json(res, 200, { ok: true }); }

  const publicGalleryMatch = method === 'GET' && pathname.match(/^\/api\/public\/galleries\/([A-Za-z0-9_-]{32,})$/);
  if (publicGalleryMatch) {
    const gallery = db.prepare(`SELECT g.id,g.title,g.expires_at,g.enabled,p.title project_title,p.event_type,p.event_date,p.location,o.name organization_name
      FROM galleries g JOIN projects p ON p.id=g.project_id JOIN organizations o ON o.id=g.organization_id WHERE g.token_hash=?`).get(hash(publicGalleryMatch[1]));
    if (!gallery || !gallery.enabled || (gallery.expires_at && Date.parse(gallery.expires_at) < Date.now())) throw bad(404, 'This gallery is unavailable', 'gallery_unavailable');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return json(res, 200, { gallery });
  }

  const session = requireSession(req);
  if (method === 'GET' && pathname === '/api/clients') {
    const rows = db.prepare('SELECT id,name,email,phone,notes,archived,created_at FROM clients WHERE organization_id=? AND archived=0 ORDER BY created_at DESC').all(session.organization_id);
    return json(res, 200, { items: rows });
  }
  if (method === 'POST' && pathname === '/api/clients') {
    const body = await readJson(req); const clientId = id();
    const name = validateText(body.name, 'Client name', 100); const email = validateText(body.email, 'Email', 180, false); const phone = validateText(body.phone, 'Phone', 40, false); const notes = validateText(body.notes, 'Notes', 3000, false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad(400, 'Enter a valid client email address', 'invalid_email');
    db.prepare('INSERT INTO clients(id,organization_id,name,email,phone,notes,created_at) VALUES(?,?,?,?,?,?,?)').run(clientId, session.organization_id, name, email, phone, notes, now());
    record(session, 'CLIENT_CREATED', 'client', clientId);
    return json(res, 201, { item: db.prepare('SELECT id,name,email,phone,notes,archived,created_at FROM clients WHERE id=?').get(clientId) });
  }
  const clientMatch = routeMatch(pathname, /^\/api\/clients\/([0-9a-f-]+)$/i);
  if (clientMatch && method === 'PATCH') {
    const body = await readJson(req); const clientId = clientMatch[1]; ensureOwned('clients', clientId, session);
    const fields = ['name','email','phone','notes']; const allowed = Object.keys(body).filter((k) => fields.includes(k));
    if (!allowed.length) throw bad(400, 'No editable fields supplied', 'empty_update');
    const values = allowed.map((key) => validateText(body[key], key, key === 'notes' ? 3000 : 180, key === 'name'));
    db.prepare('UPDATE clients SET ' + allowed.map((key) => key + '=?').join(',') + ' WHERE id=? AND organization_id=?').run(...values, clientId, session.organization_id);
    record(session, 'CLIENT_UPDATED', 'client', clientId);
    return json(res, 200, { item: db.prepare('SELECT id,name,email,phone,notes,archived,created_at FROM clients WHERE id=?').get(clientId) });
  }
  if (clientMatch && method === 'DELETE') {
    const clientId = clientMatch[1]; ensureOwned('clients', clientId, session);
    db.prepare('UPDATE clients SET archived=1 WHERE id=? AND organization_id=?').run(clientId, session.organization_id);
    record(session, 'CLIENT_ARCHIVED', 'client', clientId);
    return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/projects') {
    const rows = db.prepare(`SELECT p.id,p.client_id,c.name client_name,p.title,p.event_type,p.event_date,p.location,p.total_amount,p.amount_paid,p.status,p.created_at
      FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.organization_id=? ORDER BY p.created_at DESC`).all(session.organization_id);
    return json(res, 200, { items: rows });
  }
  if (method === 'POST' && pathname === '/api/projects') {
    const body = await readJson(req); const projectId = id();
    const clientId = validateText(body.clientId, 'Client', 80);
    if (!db.prepare('SELECT id FROM clients WHERE id=? AND organization_id=? AND archived=0').get(clientId, session.organization_id)) throw bad(404, 'Client not found', 'client_not_found');
    const title = validateText(body.title, 'Project name', 140);
    const eventType = validateText(body.eventType, 'Event type', 80, false);
    const eventDate = validateText(body.eventDate, 'Event date', 10, false);
    const location = validateText(body.location, 'Location', 180, false);
    const total = Number(body.totalAmount || 0);
    if (!Number.isSafeInteger(total) || total < 0) throw bad(400, 'Project total must be a non-negative integer amount in minor units', 'invalid_amount');
    db.prepare('INSERT INTO projects(id,organization_id,client_id,title,event_type,event_date,location,total_amount,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(projectId, session.organization_id, clientId, title, eventType, eventDate, location, total, now());
    record(session, 'PROJECT_CREATED', 'project', projectId);
    return json(res, 201, { item: db.prepare('SELECT id,client_id,title,event_type,event_date,location,total_amount,amount_paid,status,created_at FROM projects WHERE id=?').get(projectId) });
  }
  const projectMatch = routeMatch(pathname, /^\/api\/projects\/([0-9a-f-]+)$/i);
  if (projectMatch && method === 'GET') {
    const project = db.prepare(`SELECT p.*,c.name client_name,c.email client_email FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=? AND p.organization_id=?`).get(projectMatch[1], session.organization_id);
    if (!project) throw bad(404, 'Project not found', 'not_found');
    return json(res, 200, { item: project });
  }
  if (projectMatch && method === 'PATCH') {
    const body = await readJson(req); const projectId = projectMatch[1]; ensureOwned('projects', projectId, session);
    const allowed = ['title','event_type','event_date','location','status'];
    const fields = Object.keys(body).filter((key) => allowed.includes(key));
    if (!fields.length) throw bad(400, 'No editable fields supplied', 'empty_update');
    const validStatuses = ['LEAD','QUOTATION_SENT','BOOKED','IN_PROGRESS','EDITING','GALLERY_READY','PAYMENT_PENDING','COMPLETED','ARCHIVED'];
    for (const field of fields) {
      body[field] = validateText(body[field], field, field === 'title' ? 140 : 180);
      if (field === 'status' && !validStatuses.includes(body[field])) throw bad(400, 'Invalid project status', 'invalid_status');
    }
    db.prepare('UPDATE projects SET ' + fields.map((field) => field + '=?').join(',') + ' WHERE id=? AND organization_id=?').run(...fields.map((field) => body[field]), projectId, session.organization_id);
    record(session, 'PROJECT_UPDATED', 'project', projectId);
    return json(res, 200, { item: db.prepare('SELECT * FROM projects WHERE id=?').get(projectId) });
  }

  if (method === 'GET' && pathname === '/api/galleries') {
    const items = db.prepare(`SELECT g.id,g.project_id,g.title,g.expires_at,g.enabled,g.created_at,p.title project_title
      FROM galleries g JOIN projects p ON p.id=g.project_id WHERE g.organization_id=? ORDER BY g.created_at DESC`).all(session.organization_id);
    return json(res, 200, { items });
  }
  if (method === 'POST' && pathname === '/api/galleries') {
    const body = await readJson(req); const projectId = validateText(body.projectId, 'Project', 80);
    if (!db.prepare('SELECT id FROM projects WHERE id=? AND organization_id=?').get(projectId, session.organization_id)) throw bad(404, 'Project not found', 'project_not_found');
    const galleryId = id(); const token = crypto.randomBytes(32).toString('base64url');
    const title = validateText(body.title, 'Gallery title', 140);
    const password = body.password ? String(body.password) : null;
    if (password && (password.length < 12 || password.length > 200)) throw bad(400, 'Gallery password must be between 12 and 200 characters', 'weak_password');
    const expiry = body.expiresAt ? validateText(body.expiresAt, 'Expiry date', 30) : null;
    db.prepare('INSERT INTO galleries(id,organization_id,project_id,title,token_hash,password_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(galleryId, session.organization_id, projectId, title, hash(token), password ? passwordHash(password) : null, expiry, now());
    record(session, 'GALLERY_CREATED', 'gallery', galleryId);
    return json(res, 201, { item: { id: galleryId, projectId, title, url: '/gallery/' + token, expiresAt: expiry, enabled: true } });
  }

  if (method === 'GET' && pathname === '/api/invoices') {
    return json(res, 200, { items: db.prepare('SELECT id,project_id,number,amount,amount_paid,due_date,status,created_at FROM invoices WHERE organization_id=? ORDER BY created_at DESC').all(session.organization_id) });
  }
  if (method === 'POST' && pathname === '/api/invoices') {
    requireRole(session, ['OWNER','ADMIN','ACCOUNTANT']);
    const body = await readJson(req); const projectId = validateText(body.projectId, 'Project', 80);
    const project = db.prepare('SELECT id,client_id FROM projects WHERE id=? AND organization_id=?').get(projectId, session.organization_id);
    if (!project) throw bad(404, 'Project not found', 'project_not_found');
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw bad(400, 'Invoice amount must be a positive integer in minor units', 'invalid_amount');
    const number = 'INV-' + new Date().getUTCFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const invoiceId = id(); const dueDate = body.dueDate ? validateText(body.dueDate, 'Due date', 10) : null;
    db.prepare('INSERT INTO invoices(id,organization_id,project_id,number,amount,due_date,created_at) VALUES(?,?,?,?,?,?,?)').run(invoiceId, session.organization_id, projectId, number, amount, dueDate, now());
    record(session, 'INVOICE_CREATED', 'invoice', invoiceId);
    return json(res, 201, { item: db.prepare('SELECT id,project_id,number,amount,amount_paid,due_date,status,created_at FROM invoices WHERE id=?').get(invoiceId) });
  }

  if (pathname.startsWith('/api/admin/')) {
    requireRole(session, ['SUPER_ADMIN']);
    if (method === 'GET' && pathname === '/api/admin/audit-logs') return json(res, 200, { items: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 500').all() });
    if (method === 'GET' && pathname === '/api/admin/organizations') return json(res, 200, { items: db.prepare('SELECT id,name,created_at FROM organizations ORDER BY created_at DESC').all() });
  }
  throw bad(404, 'API route not found', 'route_not_found');
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('Bad request'); return; }
  if (pathname === '/' || /^\/gallery\/[A-Za-z0-9_-]{32,}$/.test(pathname)) pathname = '/index.html';
  const filePath = path.resolve(root, '.' + pathname);
  if (!filePath.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(filePath, (error, info) => {
    if (error || !info.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  let url;
  try { url = new URL(req.url, 'http://' + req.headers.host); } catch { return json(res, 400, { error: { code: 'bad_url', message: 'Invalid URL' } }); }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  try { await api(req, res, url); }
  catch (error) { const status = Number(error.status || 500); if (status >= 500) console.error(error); json(res, status, { error: { code: error.code || 'server_error', message: status >= 500 ? 'The server could not complete the request' : error.message } }); }
});
server.listen(port, '127.0.0.1', () => console.log('Photo Gallery local app: http://127.0.0.1:' + port));
process.on('SIGINT', () => { db.close(); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { db.close(); server.close(() => process.exit(0)); });
