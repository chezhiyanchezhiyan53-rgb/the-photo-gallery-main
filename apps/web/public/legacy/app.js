const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const state = {
  role: 'studio',
  page: 'overview',
  customerPage: 'discover',
  galleryOpen: false,
  galleryPaid: false,
  search: '',
  appointmentFilter: 'All',
  modal: false,
  selectedStudio: 'Mira Sen Photography',
  selectedMedia: [],
  formDialog: null,
  user: null,
  authMode: 'signup',
  authError: '',
  publicGallery: null,
  createdGalleryLink: ''
};

const appointments = [
  { id: 1, name: 'Ananya Rao', event: 'Wedding · 18 Nov', place: 'Jaipur', initials: 'AR', status: 'New request' },
  { id: 2, name: 'Kabir Mehta', event: 'Pre-wedding · 04 Dec', place: 'Udaipur', initials: 'KM', status: 'New request' },
  { id: 3, name: 'Rhea Kapoor', event: 'Portraits · 11 Dec', place: 'Mumbai', initials: 'RK', status: 'New request' },
  { id: 4, name: 'Dev Shah', event: 'Wedding · 22 Dec', place: 'Ahmedabad', initials: 'DS', status: 'New request' }
];
const studios = [
  { name: 'Mira Sen Photography', type: 'Weddings & portraits', place: 'Jaipur, Rajasthan', price: '₹48,000', art: 'one' },
  { name: 'House of Frame', type: 'Editorial & weddings', place: 'Udaipur, Rajasthan', price: '₹62,000', art: 'two' },
  { name: 'Aarav Mehta Studio', type: 'Candid & destination', place: 'Mumbai, Maharashtra', price: '₹55,000', art: 'three' }
];
const applications = [
  { name: 'The Ivory Collective', detail: 'Wedding photography · Kochi', initials: 'IC', date: 'Applied today' },
  { name: 'Nikhil Arora Studio', detail: 'Portraits & events · Delhi', initials: 'NA', date: 'Applied yesterday' },
  { name: 'Monsoon Frames', detail: 'Wedding photography · Pune', initials: 'MF', date: 'Applied 2 days ago' }
];
const projects = [
  { client: 'Ananya Rao', event: 'Wedding', date: '18 Nov 2026', place: 'Jaipur', status: 'Quotation sent', amount: '₹1,24,000' },
  { client: 'Rhea Kapoor', event: 'Portrait session', date: '11 Dec 2026', place: 'Mumbai', status: 'Editing', amount: '₹38,500' },
  { client: 'Kabir Mehta', event: 'Pre-wedding', date: '04 Dec 2026', place: 'Udaipur', status: 'Booked', amount: '₹86,000' },
  { client: 'Dev Shah', event: 'Wedding', date: '22 Dec 2026', place: 'Ahmedabad', status: 'Gallery ready', amount: '₹1,48,000' }
];
const clients = [
  { name: 'Ananya Rao', email: 'ananya.rao@email.com', projects: '2 projects', last: 'Updated 12 min ago' },
  { name: 'Kabir Mehta', email: 'kabir.mehta@email.com', projects: '1 project', last: 'Updated yesterday' },
  { name: 'Rhea Kapoor', email: 'rhea.kapoor@email.com', projects: '3 projects', last: 'Updated 2 days ago' },
  { name: 'Dev Shah', email: 'dev.shah@email.com', projects: '1 project', last: 'Updated 4 days ago' }
];
const invoices = [
  { number: 'INV-2026-084', client: 'Ananya Rao', due: 'Due 18 Nov', amount: '₹62,000', state: 'Advance due' },
  { number: 'INV-2026-083', client: 'Dev Shah', due: 'Paid 02 Oct', amount: '₹1,48,000', state: 'Paid' },
  { number: 'INV-2026-081', client: 'Kabir Mehta', due: 'Due 04 Dec', amount: '₹28,000', state: 'Upcoming' }
];

const galleryRecords = [
  { title: 'Dev Shah · Wedding', items: '6 albums · 482 items', access: 'Password protected', downloads: 'Unlocked' },
  { title: 'Rhea Kapoor · Portraits', items: '3 albums · 96 items', access: 'Password protected', downloads: 'Locked · balance due' },
  { title: 'Kabir Mehta · Pre-wedding', items: '4 albums · 230 items', access: 'Invitation pending', downloads: 'Locked' }
];
function loadWorkspaceList(key, target) {
  try {
    const value = JSON.parse(localStorage.getItem('photoGallery:' + key) || 'null');
    if (Array.isArray(value)) target.splice(0, target.length, ...value);
  } catch (_) { /* Keep the sample records when browser storage is unavailable. */ }
}
function saveWorkspace() {
  try {
    localStorage.setItem('photoGallery:clients', JSON.stringify(clients));
    localStorage.setItem('photoGallery:projects', JSON.stringify(projects));
    localStorage.setItem('photoGallery:appointments', JSON.stringify(appointments));
    localStorage.setItem('photoGallery:invoices', JSON.stringify(invoices));
    localStorage.setItem('photoGallery:galleries', JSON.stringify(galleryRecords));
  } catch (_) { showToast('This browser could not save the workspace changes.'); }
}
[ ['clients', clients], ['projects', projects], ['appointments', appointments], ['invoices', invoices], ['galleries', galleryRecords] ]
  .forEach(([key, target]) => loadWorkspaceList(key, target));

const icon = (name) => {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    camera: '<path d="M14 5l1.5 2H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4.5L10 5z"/><circle cx="12" cy="13" r="3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.02a1.7 1.7 0 0 0-1.75.35l-.07.06h-3.4l-.03-.08a1.7 1.7 0 0 0-1.34-1.2 1.7 1.7 0 0 0-1.6.63l-.05.07-3.38-.98.02-.09a1.7 1.7 0 0 0-.55-1.7l-.07-.06.98-3.37.09.02a1.7 1.7 0 0 0 1.7-.55l.06-.07V9.5l-.06-.06a1.7 1.7 0 0 0-.35-1.88l-.06-.06 1.7-2.94.08.02a1.7 1.7 0 0 0 1.75-.35l.07-.06h3.4l.03.08a1.7 1.7 0 0 0 1.34 1.2 1.7 1.7 0 0 0 1.6-.63l.05-.07 3.38.98-.02.09a1.7 1.7 0 0 0 .55 1.7l.07.06-.98 3.37-.09-.02a1.7 1.7 0 0 0-1.7.55l-.06.07z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    chart: '<path d="M3 3v18h18M8 15l4-4 3 3 6-7"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.grid) + '</svg>';
};

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || 'The request could not be completed.');
  return result;
}
async function loadServerData() {
  if (!state.user) return;
  const [clientData, projectData, galleryData, invoiceData] = await Promise.all([
    apiRequest('/api/clients'), apiRequest('/api/projects'), apiRequest('/api/galleries'), apiRequest('/api/invoices')
  ]);
  clients.splice(0, clients.length, ...clientData.items.map((c) => ({ ...c, projects: '0 projects', last: 'Saved in studio' })));
  projects.splice(0, projects.length, ...projectData.items.map((p) => ({ id: p.id, clientId: p.client_id, client: p.client_name, event: p.event_type || p.title, date: p.event_date || 'Date not set', place: p.location || 'Not set', status: p.status.replaceAll('_', ' '), amount: '₹' + Math.round(p.total_amount / 100).toLocaleString('en-IN') })));
  for (const client of clients) {
    const count = projects.filter((project) => project.clientId === client.id).length;
    client.projects = count + (count === 1 ? ' project' : ' projects');
  }
  galleryRecords.splice(0, galleryRecords.length, ...galleryData.items.map((g) => ({ id: g.id, title: g.project_title + ' · ' + g.title, items: '0 albums · 0 items', access: 'Private', downloads: 'Locked' })));
  invoices.splice(0, invoices.length, ...invoiceData.items.map((i) => ({ id: i.id, number: i.number, client: projects.find((project) => project.id === i.project_id)?.client || 'Client', due: i.due_date ? 'Due ' + i.due_date : 'No due date', amount: '₹' + Math.round(i.amount / 100).toLocaleString('en-IN'), state: i.status })));
  appointments.splice(0, appointments.length);
}
function authView() {
  const signup = state.authMode === 'signup';
  return '<main class="auth-page"><section class="auth-card"><a class="wordmark auth-wordmark" href="#">The Photo Gallery<small>moments, kept well</small></a><div class="auth-tabs"><button class="' + (signup ? 'active' : '') + '" data-auth-mode="signup">Create studio account</button><button class="' + (!signup ? 'active' : '') + '" data-auth-mode="login">Sign in</button></div><h1>' + (signup ? 'Start your studio workspace' : 'Welcome back') + '</h1><p class="subhead">' + (signup ? 'Keep clients, projects, galleries and invoices together.' : 'Sign in to continue to your studio workspace.') + '</p>' + (state.authError ? '<div class="auth-error" role="alert">' + escapeText(state.authError) + '</div>' : '') + '<form id="auth-form" data-auth-mode="' + (signup ? 'signup' : 'login') + '">' + (signup ? '<div class="field"><label>Your name</label><input name="name" required maxlength="100" autocomplete="name"></div><div class="field"><label>Studio name</label><input name="studioName" required maxlength="140" autocomplete="organization"></div>' : '') + '<div class="field"><label>Email address</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Password</label><input name="password" type="password" required minlength="' + (signup ? '12' : '1') + '" autocomplete="' + (signup ? 'new-password' : 'current-password') + '">' + (signup ? '<small>Use at least 12 characters.</small>' : '') + '</div><button class="button auth-submit">' + (signup ? 'Create account' : 'Sign in') + '</button></form><div class="auth-divider"><span>or</span></div><button class="button secondary auth-submit" data-public-browse>Browse photographers</button><p class="auth-note">This local build stores studio records in its SQLite database. Email verification and password reset are not set up yet.</p></section></main>';
}
async function initializeApp() {
  try {
    const galleryRoute = location.pathname.match(/^\/gallery\/([A-Za-z0-9_-]{32,})$/);
    if (galleryRoute) { const result = await apiRequest('/api/public/galleries/' + galleryRoute[1]); state.publicGallery = result.gallery; state.role = 'customer'; state.customerPage = 'gallery'; state.galleryOpen = true; render(); return; }
    const response = await apiRequest('/api/auth/session');
    state.user = response.user;
    if (state.user) {
      state.role = state.user.role === 'SUPER_ADMIN' ? 'super' : 'studio';
      await loadServerData();
    }
  } catch (error) {
    state.authError = 'Could not reach the local application server. Run npm start and refresh this page.';
  }
  render();
}

function topbar(customer = false) {
  const nav = customer
    ? '<nav class="customer-nav"><a class="' + (state.customerPage === 'discover' ? 'active' : '') + '" data-customer-page="discover">Discover</a><a data-customer-page="discover">Photographers</a><a class="' + (state.customerPage === 'gallery' ? 'active' : '') + '" data-customer-page="gallery">My gallery</a></nav>'
    : '';
  const who = state.role === 'customer' ? (state.user?.name || 'Guest') : (state.user?.name || 'Studio owner');
  const roleName = state.role === 'customer' ? 'Customer preview' : state.role === 'super' ? 'Platform team' : (state.user?.role || 'Studio owner');
  const initials = String(who).split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  return '<header class="topbar"><div class="top-left"><a class="wordmark" href="#" data-home>The Photo Gallery<small>moments, kept well</small></a>' + nav + '</div><div class="top-actions">' + (state.user ? '<div class="role-switch" aria-label="Preview role"><button data-role="studio" class="' + (state.role === 'studio' ? 'active' : '') + '">Studio</button><button data-role="customer" class="' + (state.role === 'customer' ? 'active' : '') + '">Customer preview</button>' + (state.user.role === 'SUPER_ADMIN' ? '<button data-role="super" class="' + (state.role === 'super' ? 'active' : '') + '">Super admin</button>' : '') + '</div>' : '<button class="button secondary small" data-auth-mode="login">Studio sign in</button>') + (state.user ? '<div class="profile"><div class="avatar">' + initials + '</div><div class="profile-copy">' + escapeText(who) + '<span>' + escapeText(roleName) + '</span></div><button class="button secondary small" data-logout>Sign out</button></div>' : '') + '</div></header>';
}
function sidebar(items, active, kind) {
  const platform = kind === 'super';
  return '<aside class="sidebar"><div class="side-kicker">' + (platform ? 'Platform' : 'Workspace') + '</div><div class="studio-name"><div class="studio-mark">' + (platform ? 'P' : 'M') + '</div><div><strong>' + (platform ? 'Platform admin' : escapeText(state.user?.organizationName || 'Studio workspace')) + '</strong><span>' + (platform ? 'Super administrator' : 'Studio account') + '</span></div></div><div class="nav-label">Menu</div><nav class="nav-list">' + items.map((item) => '<button class="nav-item ' + (active === item.id ? 'active' : '') + '" data-page="' + item.id + '">' + icon(item.icon) + '<span>' + item.label + '</span>' + (item.count ? '<span class="nav-count">' + item.count + '</span>' : '') + '</button>').join('') + '</nav><div class="sidebar-spacer"></div>' + (!platform ? '<div class="storage-card"><div class="storage-head"><strong>Storage</strong><span>68%</span></div><div class="progress"><i></i></div><div class="storage-meta"><span>1.36 TB used</span><span>2 TB</span></div></div>' : '') + '<div class="side-help">Help & support <span style="float:right">↗</span></div></aside>';
}

const studioItems = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'appointments', label: 'Appointments', icon: 'calendar', count: '4' },
  { id: 'clients', label: 'Clients', icon: 'users' },
  { id: 'projects', label: 'Projects', icon: 'camera' },
  { id: 'galleries', label: 'Galleries', icon: 'image' },
  { id: 'billing', label: 'Invoices & payments', icon: 'file' },
  { id: 'settings', label: 'Team & settings', icon: 'settings' }
];
const superItems = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'applications', label: 'Studio applications', icon: 'shield', count: '8' },
  { id: 'studios', label: 'Photographers', icon: 'camera' },
  { id: 'customers', label: 'Customers', icon: 'users' },
  { id: 'payments', label: 'Payments', icon: 'file' },
  { id: 'plans', label: 'Plans & usage', icon: 'chart' },
  { id: 'audit', label: 'Audit & health', icon: 'settings' }
];

function heading(eyebrow, title, description, action = '') {
  return '<div class="breadcrumb">The Photo Gallery <span>/</span> <b>' + title + '</b></div><div class="page-heading"><div><p class="eyebrow">' + eyebrow + '</p><h1>' + title + '</h1><p class="subhead">' + description + '</p></div>' + action + '</div>';
}
function stat(label, value, foot, iconName) {
  return '<div class="stat-card"><div class="stat-top">' + label + '<span class="stat-icon">' + icon(iconName) + '</span></div><div class="stat-value">' + value + '</div><div class="stat-foot">' + foot + '</div></div>';
}
function table(headers, rows) {
  return '<div class="table-wrap"><table><thead><tr>' + headers.map((x) => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}
function projectRows(data) {
  return data.map((p) => '<tr><td><strong>' + escapeText(p.client) + '</strong><span class="table-sub">' + escapeText(p.event) + '</span></td><td>' + escapeText(p.date) + '<span class="table-sub">' + escapeText(p.place) + '</span></td><td><span class="status">' + escapeText(p.status) + '</span></td><td>' + escapeText(p.amount) + '</td><td><button class="text-link" data-toast="Project details are ready to connect">Open</button></td></tr>').join('');
}
function studioOverview() {
  const newRequests = appointments.filter((a) => a.status === 'New request');
  return heading('Tuesday, 13 October 2026', 'Good morning, Mira', 'Here is what is happening across your studio today.', '<button class="button" data-open-form="project">' + icon('plus') + ' Create project</button>') +
    '<section class="stats">' + stat('Active projects', '12', '<strong>3</strong> in editing', 'camera') + stat('New requests', String(newRequests.length), '<strong>2</strong> need a reply today', 'calendar') + stat('Outstanding', '₹84,500', 'Across <strong>6 invoices</strong>', 'file') + stat('Gallery views', '1,284', '<strong>↑ 12%</strong> this month', 'image') + '</section>' +
    '<section class="grid-two"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Appointment requests</h2><p class="panel-note">Review new enquiries and respond</p></div><button class="text-link" data-page="appointments">View all</button></div><div class="requests">' +
    (newRequests.length ? newRequests.slice(0, 3).map((a) => '<div class="request"><div class="person-photo">' + a.initials + '</div><div class="request-info"><strong>' + a.name + '</strong><span>' + a.event + ' · ' + a.place + '</span></div><div class="request-actions"><button data-appointment-action="confirmed" data-id="' + a.id + '">Confirm</button><button data-appointment-action="declined" data-id="' + a.id + '">Decline</button></div></div>').join('') : '<div class="empty">You are all caught up on appointment requests.</div>') +
    '</div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Project pipeline</h2><p class="panel-note">12 active projects</p></div><button class="text-link" data-page="projects">Projects</button></div><div class="pipeline"><div class="pipe-row"><label>Quote sent</label><div class="pipe-track"><i style="width:62%"></i></div><b>4</b></div><div class="pipe-row"><label>Booked</label><div class="pipe-track"><i style="width:78%"></i></div><b>5</b></div><div class="pipe-row"><label>In editing</label><div class="pipe-track"><i style="width:45%"></i></div><b>2</b></div><div class="pipe-row"><label>Gallery ready</label><div class="pipe-track"><i style="width:28%"></i></div><b>1</b></div></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0 12px"><div class="panel-head" style="margin:0"><div><h2 class="panel-title">Storage</h2><p class="panel-note">1.36 TB of 2 TB used</p></div><span class="status">Within plan</span></div><div class="progress" style="background:#efeee9;margin-top:10px"><i style="background:#292927"></i></div></div></section>' +
    '<section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Upcoming sessions</h2><p class="panel-note">Your next confirmed projects</p></div><button class="text-link" data-page="projects">All projects</button></div>' + table(['Customer / event', 'Date / location', 'Status', 'Project total', ''], projectRows(projects.slice(0, 3))) + '</section>';
}
function studioAppointments() {
  const shown = appointments.filter((a) => state.appointmentFilter === 'All' || a.status === state.appointmentFilter);
  const rows = shown.map((a) => '<tr><td><strong>' + escapeText(a.name) + '</strong><span class="table-sub">' + escapeText(a.initials) + ' · customer</span></td><td>' + escapeText(a.event) + '<span class="table-sub">' + escapeText(a.place) + '</span></td><td><span class="status ' + (a.status === 'New request' ? 'pending' : '') + '">' + a.status + '</span></td><td>' + (a.status === 'New request' ? '<button class="button small" data-appointment-action="confirmed" data-id="' + a.id + '">Confirm</button> <button class="button secondary small" data-appointment-action="declined" data-id="' + a.id + '">Decline</button>' : '<button class="text-link" data-toast="Appointment details are ready">View</button>') + '</td></tr>').join('');
  return heading('Studio workspace', 'Appointments', 'Review requests and keep customers informed.') + '<div class="filter-row">' + ['All', 'New request', 'Confirmed', 'Declined'].map((x) => '<button class="filter-chip ' + (state.appointmentFilter === x ? 'active' : '') + '" data-filter="' + x + '">' + x + '</button>').join('') + '</div><section class="panel table-panel">' + table(['Customer', 'Request', 'Status', 'Actions'], rows || '<tr><td colspan="4" class="empty">No requests in this view.</td></tr>') + '</section>';
}
function studioClients() {
  const filtered = clients.filter((c) => (c.name + c.email).toLowerCase().includes(state.search.toLowerCase()));
  const rows = filtered.map((c) => '<tr><td><strong>' + escapeText(c.name) + '</strong></td><td>' + escapeText(c.projects) + '</td><td>' + escapeText(c.last) + '</td><td>' + escapeText(c.email) + '</td><td><button class="text-link" data-toast="Client profile is ready to connect">Open</button></td></tr>').join('');
  return heading('Studio workspace', 'Clients', 'Keep contact details and every project in one place.', '<button class="button" data-open-form="client">' + icon('plus') + ' Add client</button>') + '<div class="filter-row"><label class="searchbox">' + icon('search') + '<input data-search="clients" value="' + escapeText(state.search) + '" placeholder="Search clients"></label><button class="filter-chip active">All clients · 84</button><button class="filter-chip">Archived</button></div><section class="panel table-panel">' + table(['Client', 'Projects', 'Recent activity', 'Contact', ''], rows || '<tr><td colspan="5" class="empty">No matching clients.</td></tr>') + '</section>';
}
function studioProjects() {
  return heading('Studio workspace', 'Projects', 'Follow each event from quotation to final delivery.', '<button class="button" data-open-form="project">' + icon('plus') + ' Create project</button>') +
    '<div class="filter-row">' + ['All projects', 'Lead', 'Booked', 'Editing', 'Gallery ready'].map((x, i) => '<button class="filter-chip ' + (!i ? 'active' : '') + '" data-toast="' + x + ' filter selected">' + x + '</button>').join('') + '<label class="searchbox" style="margin-left:auto">' + icon('search') + '<input placeholder="Search projects"></label></div><section class="panel table-panel">' + table(['Customer / event', 'Date / location', 'Status', 'Project total', ''], projectRows(projects)) + '</section>';
}
function formatFileSize(bytes) {
  if (bytes < 1024 ** 2) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function mediaUploadPanel() {
  const files = state.selectedMedia || [];
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const rows = files.map((file) => '<div class="media-file"><span class="media-file-icon">' + (file.type.startsWith('video/') ? '▶' : '▧') + '</span><span class="media-file-name"><strong>' + escapeText(file.name) + '</strong><small>' + (file.size >= 5 * 1024 ** 3 ? 'Large video · resumable cloud transfer required' : 'Ready for upload') + '</small></span><span class="media-file-size">' + formatFileSize(file.size) + '</span></div>').join('');
  return '<section class="panel media-panel"><div class="panel-head"><div><h2 class="panel-title">Add photos and videos</h2><p class="panel-note">Choose media for a private gallery. Original files stay at full quality.</p></div><span class="status">Cloud storage</span></div><label class="media-drop" for="media-input"><input id="media-input" type="file" accept="image/*,video/*" multiple><span class="media-drop-icon">↑</span><strong>Choose files or drop them here</strong><small>Photos and videos · no file-size limit in this preview</small></label><div class="media-guidance"><strong>For large video files</strong><span>Production uploads should go directly to cloud storage in resumable parts. This keeps multi-gigabyte files from passing through the website server.</span></div>' + (files.length ? '<div class="media-selection"><div class="media-selection-head"><strong>' + files.length + ' file' + (files.length === 1 ? '' : 's') + ' selected</strong><span>' + formatFileSize(total) + ' total</span></div>' + rows + '</div>' : '<div class="media-empty">Selected files will appear here with their sizes before upload.</div>') + '<div class="media-actions"><span>Upload transfer starts after cloud storage is connected.</span><button class="button" data-upload-selected ' + (files.length ? '' : 'disabled') + '>Continue to upload</button></div></section>';
}
function studioGalleries() {
  const rows = galleryRecords.map((r) => '<tr><td><strong>' + escapeText(r.title) + '</strong></td><td>' + escapeText(r.items) + '</td><td>' + escapeText(r.access) + '</td><td>' + escapeText(r.downloads) + '</td><td><button class="text-link" data-toast="Gallery editor is ready to connect">Open</button></td></tr>').join('');
  return heading('Studio workspace', 'Galleries', 'Prepare private collections for your customers.', '<button class="button" data-open-form="gallery">' + icon('plus') + ' Create gallery</button>') + '<section class="stats">' + stat('Active galleries', '18', 'Across <strong>12 projects</strong>', 'image') + stat('Gallery views', '1,284', 'This month', 'chart') + stat('Downloads unlocked', '9', 'Payment complete', 'lock') + stat('Processing', '3', 'Media jobs in queue', 'camera') + '</section>' + mediaUploadPanel() + '<section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Recent galleries</h2><p class="panel-note">Private customer collections</p></div></div>' + (state.createdGalleryLink ? '<div class="gallery-link-banner"><div><strong>New private gallery link</strong><span>Copy this link to share access with the customer.</span></div><input readonly value="' + escapeText(state.createdGalleryLink) + '"><button class="button secondary small" data-copy-gallery-link>Copy link</button></div>' : '') + table(['Gallery', 'Albums / media', 'Access', 'Downloads', ''], rows) + '</section>';
}
function studioBilling() {
  const rows = invoices.map((i) => '<tr><td><strong>' + escapeText(i.number) + '</strong></td><td>' + escapeText(i.client) + '</td><td>' + escapeText(i.due) + '</td><td>' + escapeText(i.amount) + '</td><td><span class="status">' + escapeText(i.state) + '</span></td></tr>').join('');
  return heading('Studio workspace', 'Invoices & payments', 'Track advances, balances and final delivery payments.', '<button class="button" data-open-form="invoice">' + icon('plus') + ' New invoice</button>') + '<section class="stats">' + stat('Collected this month', '₹3.42L', 'Across <strong>14 payments</strong>', 'chart') + stat('Outstanding', '₹84,500', 'Across <strong>6 invoices</strong>', 'file') + stat('Overdue', '₹18,000', 'Needs a reminder', 'calendar') + stat('Payment success', '96%', 'Last 30 days', 'shield') + '</section><section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Recent invoices</h2><p class="panel-note">Invoice status and balance</p></div></div>' + table(['Invoice', 'Customer', 'Due / paid', 'Amount', 'Status'], rows) + '</section>';
}
function studioSettings() {
  return heading('Studio workspace', 'Team & settings', 'Manage access, studio details and account usage.') + '<div class="grid-equal"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Team members</h2><p class="panel-note">3 of 5 seats used</p></div><button class="button small" data-toast="Invite form is ready to connect">Invite member</button></div>' + table(['Name', 'Role', 'Projects'], '<tr><td><strong>Mira Sen</strong></td><td>Owner</td><td>All</td></tr><tr><td><strong>Arjun Das</strong></td><td>Photographer</td><td>6 assigned</td></tr><tr><td><strong>Neha Roy</strong></td><td>Editor</td><td>4 assigned</td></tr>') + '</section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Studio settings</h2><p class="panel-note">Account, gallery and payment preferences</p></div></div><div class="field"><label>Studio name</label><input value="Mira Sen Studio"></div><div class="field"><label>Public profile</label><input value="Approved · listed in directory"></div><div class="field"><label>Default gallery expiry</label><select><option>12 months after delivery</option></select></div><div class="field"><label>Storage plan</label><input value="2 TB · 1.36 TB used"></div><button class="button secondary" data-toast="Settings saved in this preview">Save changes</button></section></div>';
}
function studioView() {
  const views = { overview: studioOverview, appointments: studioAppointments, clients: studioClients, projects: studioProjects, galleries: studioGalleries, billing: studioBilling, settings: studioSettings };
  return topbar() + '<div class="workspace">' + sidebar(studioItems, state.page, 'studio') + '<main class="main">' + (views[state.page] || studioOverview)() + '</main></div>';
}

function photographerCards() {
  const term = state.search.toLowerCase();
  return studios.filter((s) => (s.name + s.type + s.place).toLowerCase().includes(term))
    .map((s) => '<article class="photographer-card"><div class="portfolio-thumb ' + s.art + '"><span>' + s.type + '</span></div><div class="photographer-info"><h3>' + s.name + '</h3><p>' + s.place + ' · ' + s.type + '</p><div class="card-foot"><div class="price">Packages from <strong>' + s.price + '</strong></div><button class="text-link" data-request="' + s.name + '">Request a session</button></div></div></article>').join('');
}
function workspaceModal() {
  const type = state.formDialog;
  const configs = {
    client: { title: 'Add a client', intro: 'Save contact details for a new customer.', fields: '<div class="field"><label>Client name</label><input name="name" required maxlength="100" placeholder="Full name"></div><div class="field"><label>Email address</label><input name="email" type="email" maxlength="160" placeholder="name@example.com"></div><div class="field"><label>Phone number</label><input name="phone" type="tel" maxlength="30" placeholder="Optional"></div>' },
    project: { title: 'Create a project', intro: 'Add the event details and agree on a project total.', fields: '<div class="field"><label>Client</label><select name="client" required>' + clients.map((c) => '<option>' + escapeText(c.name) + '</option>').join('') + '</select></div><div class="field"><label>Event type</label><input name="event" required maxlength="80" placeholder="Wedding, portrait session…"></div><div class="grid-equal"><div class="field"><label>Event date</label><input name="date" type="date" required></div><div class="field"><label>Project total (₹)</label><input name="amount" type="number" min="0" step="1" required placeholder="0"></div></div><div class="field"><label>Location</label><input name="place" maxlength="120" placeholder="City or venue"></div>' },
    gallery: { title: 'Create a gallery', intro: 'Create the gallery record for an existing project. Secure client access is connected on the server.', fields: '<div class="field"><label>Project</label><select name="project" required>' + projects.map((p) => '<option>' + escapeText(p.client + ' · ' + p.event) + '</option>').join('') + '</select></div><div class="field"><label>Gallery title</label><input name="title" required maxlength="120" placeholder="e.g. Wedding collection"></div><div class="field"><label>Client access</label><input value="Private · server access setup required" readonly></div><div class="field"><label>Gallery expiry</label><select name="expiry"><option>12 months</option><option>6 months</option><option>3 months</option><option>No expiry</option></select></div>' },
    invoice: { title: 'Create an invoice', intro: 'Record an invoice for a project. Payment processing is not connected in this preview.', fields: '<div class="field"><label>Project</label><select name="project" required>' + projects.map((p) => '<option>' + escapeText(p.client + ' · ' + p.event) + '</option>').join('') + '</select></div><div class="grid-equal"><div class="field"><label>Amount (₹)</label><input name="amount" type="number" min="1" step="1" required></div><div class="field"><label>Due date</label><input name="due" type="date" required></div></div>' }
  };
  const config = configs[type];
  if (!config) return '';
  return '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">' + config.title + '</h2><p>' + config.intro + '</p></div><button class="close" data-close-modal aria-label="Close">×</button></div><form id="workspace-form" data-form-type="' + type + '">' + config.fields + '<div class="modal-actions"><button class="button secondary" type="button" data-close-modal>Cancel</button><button class="button">Save</button></div></form></section></div>';
}
function appointmentModal() {
  return '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Request a session</h2><p>Send a request to ' + state.selectedStudio + '. The studio will confirm availability.</p></div><button class="close" data-close-modal aria-label="Close">×</button></div><form id="appointment-form"><div class="field"><label>Your name</label><input name="name" required placeholder="Full name"></div><div class="field"><label>Email address</label><input name="email" type="email" required placeholder="you@example.com"></div><div class="field"><label>Photography style</label><select name="style"><option>Wedding photography</option><option>Portrait session</option><option>Family photography</option></select></div><div class="grid-equal"><div class="field"><label>Preferred date</label><input name="date" type="date" required></div><div class="field"><label>Location</label><input name="location" placeholder="City or venue"></div></div><div class="field"><label>Anything the photographer should know?</label><textarea rows="3" placeholder="A short note about your plans"></textarea></div><button class="button" style="width:100%">Send appointment request</button></form></section></div>';
}
function galleryPassword() {
  return '<div class="password-card"><div class="lock-mark">' + icon('lock') + '</div><h2>This gallery is private</h2><p>Enter the password from your photographer to view your collection.</p><form id="password-form"><div class="field"><label for="gallery-password">Gallery password</label><input id="gallery-password" name="password" type="password" required placeholder="Enter password"></div><button class="button" style="width:100%">Open gallery</button></form><p style="margin:13px 0 0">Need access? Contact your photographer.</p></div>';
}
function galleryContents() {
  const publicGallery = state.publicGallery;
  const galleryTitle = publicGallery ? escapeText(publicGallery.title) : 'Ananya &amp; Rohan';
  const galleryStudio = publicGallery ? escapeText(publicGallery.organization_name) : 'Mira Sen Studio · Jaipur';
  const galleryDate = publicGallery ? escapeText([publicGallery.event_type, publicGallery.event_date, publicGallery.location].filter(Boolean).join(' · ')) : 'Wedding collection · 18 November 2026';
  return '<div class="gallery-cover"><div class="gallery-cover-content"><p class="eyebrow" style="color:white">' + galleryStudio + '</p><h2>' + galleryTitle + '</h2><p>' + galleryDate + '</p></div></div>' +
    (!state.galleryPaid ? '<div class="balance-banner"><div><strong>Final balance due · ₹42,000</strong><span>Your photos are ready. Complete payment to unlock downloads.</span></div><button class="button" data-pay>Pay balance</button></div>' : '<div class="balance-banner"><div><strong>Payment complete</strong><span>Your downloads are ready.</span></div><span class="status dark">Downloads unlocked</span></div>') +
    '<div class="section-head"><div><h2>Your albums</h2><p class="panel-note">Browse the collection from your celebration</p></div><button class="text-link" data-download>Download all</button></div><div class="album-grid"><div class="album"><div class="album-art"></div><div class="album-info"><strong>Wedding ceremony</strong><span>184 photos · 2 videos</span></div></div><div class="album"><div class="album-art"></div><div class="album-info"><strong>Celebrations</strong><span>126 photos · 1 video</span></div></div><div class="album"><div class="album-art"></div><div class="album-info"><strong>Portraits</strong><span>92 photos</span></div></div></div>';
}
function customerView() {
  let content;
  if (state.customerPage === 'gallery') {
    content = '<div class="breadcrumb">Customer portal <span>/</span> <b>My gallery</b></div><div class="page-heading"><div><p class="eyebrow">Customer portal</p><h1>My gallery</h1><p class="subhead">' + (state.publicGallery ? 'A private collection shared by ' + escapeText(state.publicGallery.organization_name) + '.' : 'Your private collection from Mira Sen Studio.') + '</p></div></div><div class="page-tabs"><button class="active">Gallery</button><button data-toast="Your invoice is ready to connect">Invoice</button><button data-toast="Your appointment details are ready">Appointment</button></div>' + (state.publicGallery || state.galleryOpen ? galleryContents() : galleryPassword());
  } else {
    content = '<section class="hero"><div class="hero-copy"><p class="eyebrow">A thoughtful way to find your photographer</p><h1>Keep the moments<br><em>that feel like you.</em></h1><p class="subhead">Discover photographers, find the right fit, and keep your photographs together in one private place.</p><div class="search-bar"><div class="search-field"><label>Looking for</label><select aria-label="Photography style"><option>Wedding photography</option><option>Portrait session</option><option>Family photography</option></select></div><div class="search-field"><label>Location</label><input data-search="studios" value="' + escapeText(state.search) + '" placeholder="City or region"></div><button class="button" data-search-action>' + icon('search') + ' Search</button></div></div><div class="hero-art"><span class="hero-caption">Photographs, made personal</span></div></section><div class="section-head"><div><p class="eyebrow">Find your person</p><h2>Photographers to explore</h2></div><button class="text-link" data-toast="All photographer profiles are shown">Browse all</button></div><section class="photographer-grid">' + photographerCards() + '</section><div class="section-head"><div><p class="eyebrow">Already booked?</p><h2>Your photographs are waiting</h2></div><button class="button secondary" data-customer-page="gallery">Open my gallery</button></div>';
  }
  return topbar(true) + '<main class="customer-main">' + content + '</main>' + (state.modal ? appointmentModal() : '');
}

function applicationList(limit = applications.length) {
  return applications.slice(0, limit).map((a) => '<div class="application-card"><div class="application-monogram">' + a.initials + '</div><div><strong>' + a.name + '</strong><span>' + a.detail + ' · ' + a.date + '</span></div><div class="application-actions"><button class="approve" data-application-action="approved" data-name="' + a.name + '">Approve</button><button data-application-action="rejected" data-name="' + a.name + '">Reject</button></div></div>').join('') || '<div class="empty">No pending applications.</div>';
}
function superOverview() {
  return heading('Platform overview', 'Good morning, team', 'A clear view of photographer activity and platform health.') +
    '<section class="metric-row"><div class="metric-card"><span>Active photographers</span><strong>248</strong><small class="table-sub">12 applications to review</small></div><div class="metric-card"><span>Customers</span><strong>3,842</strong><small class="table-sub">Across active studios</small></div><div class="metric-card"><span>Storage in use</span><strong>18.6 TB</strong><small class="table-sub">Across 248 studios</small></div><div class="metric-card"><span>Payments this month</span><strong>₹42.8L</strong><small class="table-sub">96.4% successful</small></div></section>' +
    '<section class="grid-two"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Studio applications</h2><p class="panel-note">Review profiles before directory listing</p></div><button class="text-link" data-page="applications">View queue</button></div>' + applicationList(2) + '</div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Platform health</h2><p class="panel-note">Services reporting normally</p></div><span class="status">All systems normal</span></div><div class="pipeline"><div class="pipe-row"><label>API availability</label><div class="pipe-track"><i style="width:99%"></i></div><b>99.9%</b></div><div class="pipe-row"><label>Upload queue</label><div class="pipe-track"><i style="width:32%"></i></div><b>18</b></div><div class="pipe-row"><label>Video jobs</label><div class="pipe-track"><i style="width:18%"></i></div><b>6</b></div><div class="pipe-row"><label>Failed payments</label><div class="pipe-track"><i style="width:14%"></i></div><b>3</b></div></div></div></section>' +
    '<section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Recent platform activity</h2><p class="panel-note">Changes and events across the platform</p></div><button class="text-link" data-page="audit">Audit log</button></div>' + table(['Event', 'Account', 'When', 'Status'], '<tr><td><strong>Studio application submitted</strong></td><td>The Ivory Collective</td><td>8 min ago</td><td><span class="status pending">Needs review</span></td></tr><tr><td><strong>Subscription renewed</strong></td><td>Mira Sen Studio</td><td>34 min ago</td><td><span class="status">Complete</span></td></tr><tr><td><strong>Payment webhook retried</strong></td><td>Project PG-1084</td><td>1 hour ago</td><td><span class="status">Resolved</span></td></tr>') + '</section>';
}
function superView() {
  let content;
  if (state.page === 'applications') {
    content = heading('Platform administration', 'Studio applications', 'Review each studio before it appears in the public directory.') + '<div class="filter-row">' + ['Pending', 'Approved', 'Rejected'].map((x, i) => '<button class="filter-chip ' + (!i ? 'active' : '') + '" data-toast="' + x + ' applications selected">' + x + '</button>').join('') + '</div><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Pending review</h2><p class="panel-note">Applications awaiting a decision</p></div><span class="tag">' + applications.length + ' pending</span></div>' + applicationList() + '</section>';
  } else if (state.page === 'studios') {
    content = heading('Platform administration', 'Photographers', 'Manage studio accounts, approval status and plan usage.') + '<section class="panel table-panel">' + table(['Studio', 'Location', 'Plan', 'Storage', 'Status', ''], '<tr><td><strong>Mira Sen Studio</strong></td><td>Jaipur</td><td>Studio Plus</td><td>1.36 / 2 TB</td><td><span class="status">Active</span></td><td><button class="text-link" data-toast="Studio profile opened">Open</button></td></tr><tr><td><strong>House of Frame</strong></td><td>Udaipur</td><td>Studio</td><td>420 / 500 GB</td><td><span class="status">Active</span></td><td><button class="text-link" data-toast="Studio profile opened">Open</button></td></tr><tr><td><strong>Silver Grain Studio</strong></td><td>Delhi</td><td>Starter</td><td>98 / 100 GB</td><td><span class="status pending">Near limit</span></td><td><button class="text-link" data-toast="Studio profile opened">Open</button></td></tr>') + '</section>';
  } else if (state.page === 'customers') {
    content = heading('Platform administration', 'Customers', 'Look up customer accounts and linked projects for support.') + '<section class="panel table-panel">' + table(['Customer', 'Email', 'Studio', 'Projects', 'Joined'], '<tr><td><strong>Ananya Rao</strong></td><td>ananya.rao@email.com</td><td>Mira Sen Studio</td><td>2</td><td>Sep 2026</td></tr><tr><td><strong>Kabir Mehta</strong></td><td>kabir.mehta@email.com</td><td>House of Frame</td><td>1</td><td>Sep 2026</td></tr><tr><td><strong>Rhea Kapoor</strong></td><td>rhea.kapoor@email.com</td><td>Mira Sen Studio</td><td>3</td><td>Aug 2026</td></tr>') + '</section>';
  } else if (state.page === 'payments') {
    content = heading('Platform administration', 'Payments', 'Monitor collection, failed transactions and reconciliation.') + '<section class="stats">' + stat('Processed', '₹42.8L', 'This month', 'chart') + stat('Pending', '₹1.24L', 'Awaiting provider status', 'calendar') + stat('Failed', '3', 'Needs reconciliation', 'file') + stat('Refunded', '₹18,400', 'This month', 'shield') + '</section><section class="panel table-panel">' + table(['Provider reference', 'Studio / project', 'Amount', 'Status', 'Received'], '<tr><td><strong>pay_7B91K4</strong></td><td>Mira Sen · PG-1084</td><td>₹62,000</td><td><span class="status">Verified</span></td><td>12 Oct · 11:42</td></tr><tr><td><strong>pay_7B91J9</strong></td><td>House of Frame · PG-1078</td><td>₹24,000</td><td><span class="status pending">Review</span></td><td>12 Oct · 10:17</td></tr>') + '</section>';
  } else if (state.page === 'plans') {
    content = heading('Platform administration', 'Plans & usage', 'Manage subscription plans and configurable limits.') + '<section class="panel table-panel">' + table(['Plan', 'Studios', 'Storage', 'Active projects', 'Team seats', ''], '<tr><td><strong>Starter</strong></td><td>104</td><td>100 GB</td><td>10</td><td>1</td><td><button class="text-link" data-toast="Plan editor is ready">Edit</button></td></tr><tr><td><strong>Studio</strong></td><td>112</td><td>500 GB</td><td>50</td><td>3</td><td><button class="text-link" data-toast="Plan editor is ready">Edit</button></td></tr><tr><td><strong>Studio Plus</strong></td><td>32</td><td>2 TB</td><td>Unlimited</td><td>10</td><td><button class="text-link" data-toast="Plan editor is ready">Edit</button></td></tr>') + '</section>';
  } else if (state.page === 'audit') {
    content = heading('Platform administration', 'Audit & health', 'Review important account actions and system events.') + '<section class="panel table-panel">' + table(['Event', 'Actor', 'Target', 'Time', 'Result'], '<tr><td><strong>Studio approved</strong></td><td>Admin · P. Shah</td><td>The Ivory Collective</td><td>Today · 10:24</td><td>Completed</td></tr><tr><td><strong>Payment webhook retry</strong></td><td>System</td><td>PG-1084</td><td>Today · 09:12</td><td>Resolved</td></tr><tr><td><strong>Storage limit updated</strong></td><td>Admin · R. Das</td><td>Silver Grain Studio</td><td>Yesterday</td><td>Completed</td></tr>') + '</section>';
  } else content = superOverview();
  return topbar() + '<div class="workspace">' + sidebar(superItems, state.page, 'super') + '<main class="main">' + content + '</main></div>';
}

function render() {
  if (!state.user && state.role !== 'customer') { app.innerHTML = authView(); return; }
  app.innerHTML = '<div class="app">' + (state.role === 'studio' ? studioView() : state.role === 'customer' ? customerView() : superView()) + '</div>' + (state.formDialog ? workspaceModal() : '');
}

app.addEventListener('change', (event) => {
  if (event.target.id === 'media-input') {
    state.selectedMedia = Array.from(event.target.files || []);
    render();
  }
});
app.addEventListener('dragover', (event) => {
  if (event.target.closest('.media-drop')) event.preventDefault();
});
app.addEventListener('drop', (event) => {
  if (!event.target.closest('.media-drop')) return;
  event.preventDefault();
  state.selectedMedia = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
  render();
});
app.addEventListener('click', (event) => {
  const authMode = event.target.closest('[data-auth-mode]');
  if (authMode && !event.target.closest('#auth-form')) { state.authMode = authMode.dataset.authMode; state.authError = ''; if (state.user) { state.role = 'studio'; } render(); return; }
  if (event.target.closest('[data-public-browse]')) { state.role = 'customer'; render(); return; }
  if (event.target.closest('[data-logout]')) { apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {}); state.user = null; state.createdGalleryLink = ''; state.publicGallery = null; state.role = 'studio'; state.authMode = 'login'; render(); return; }
  if (event.target.closest('[data-upload-selected]')) { showToast('Files are selected. Connect cloud storage to begin a resumable upload.'); return; }
  if (event.target.closest('[data-copy-gallery-link]')) { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(state.createdGalleryLink).then(() => showToast('Private gallery link copied.')).catch(() => window.prompt('Copy this private gallery link', state.createdGalleryLink)); else window.prompt('Copy this private gallery link', state.createdGalleryLink); return; }
  const openForm = event.target.closest('[data-open-form]');
  if (openForm) { state.formDialog = openForm.dataset.openForm; render(); return; }
  const role = event.target.closest('[data-role]');
  if (role) { state.role = role.dataset.role; state.page = 'overview'; state.customerPage = 'discover'; render(); return; }
  const nav = event.target.closest('[data-page]');
  if (nav) { state.page = nav.dataset.page; render(); return; }
  const customerPage = event.target.closest('[data-customer-page]');
  if (customerPage) { state.customerPage = customerPage.dataset.customerPage; render(); return; }
  const request = event.target.closest('[data-request]');
  if (request) { state.selectedStudio = request.dataset.request; state.modal = true; render(); return; }
  if (event.target.matches('.modal-backdrop') || event.target.closest('[data-close-modal]')) { state.modal = false; state.formDialog = null; render(); return; }
  const appointmentAction = event.target.closest('[data-appointment-action]');
  if (appointmentAction) {
    const item = appointments.find((a) => a.id === Number(appointmentAction.dataset.id));
    if (item) item.status = appointmentAction.dataset.appointmentAction === 'confirmed' ? 'Confirmed' : 'Declined';
    saveWorkspace();
    showToast(item ? 'Appointment ' + item.status.toLowerCase() + ' in this preview.' : 'Appointment updated.');
    render(); return;
  }
  const applicationAction = event.target.closest('[data-application-action]');
  if (applicationAction) {
    const index = applications.findIndex((a) => a.name === applicationAction.dataset.name);
    if (index >= 0) applications.splice(index, 1);
    saveWorkspace();
    showToast(applicationAction.dataset.applicationAction === 'approved' ? 'Studio approved for directory listing in this preview.' : 'Application rejected in this preview.');
    render(); return;
  }
  if (event.target.closest('[data-pay]')) { state.galleryPaid = true; showToast('Payment is a preview only; connect a payment provider before unlocking downloads.'); render(); return; }
  if (event.target.closest('[data-download]')) { showToast(state.galleryPaid ? 'Download is ready in this preview.' : 'Complete the remaining payment to unlock downloads.'); return; }
  if (event.target.closest('[data-search-action]')) { const field = app.querySelector('[data-search="studios"]'); state.search = field ? field.value : ''; render(); return; }
  if (event.target.closest('[data-home]')) { event.preventDefault(); state.page = 'overview'; state.customerPage = 'discover'; render(); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.appointmentFilter = filter.dataset.filter; render(); return; }
  const toastButton = event.target.closest('[data-toast]');
  if (toastButton) showToast(toastButton.dataset.toast + '.');
});

app.addEventListener('input', (event) => {
  if (event.target.matches('[data-search="clients"]')) {
    state.search = event.target.value;
    const cursor = event.target.selectionStart;
    render();
    const replacement = app.querySelector('[data-search="clients"]');
    if (replacement) { replacement.focus(); replacement.setSelectionRange(cursor, cursor); }
  }
  if (event.target.matches('[data-search="studios"]')) state.search = event.target.value;
});
app.addEventListener('submit', async (event) => {
  if (event.target.id === 'auth-form') {
    event.preventDefault(); state.authError = '';
    const form = new FormData(event.target); const mode = event.target.dataset.authMode;
    try {
      const result = await apiRequest('/api/auth/' + mode, { method: 'POST', body: { name: form.get('name'), studioName: form.get('studioName'), email: form.get('email'), password: form.get('password') } });
      state.user = result.user; state.role = state.user.role === 'SUPER_ADMIN' ? 'super' : 'studio'; state.page = 'overview'; await loadServerData(); render();
    } catch (error) { state.authError = error.message; render(); }
    return;
  }
  if (event.target.id === 'workspace-form') {
    event.preventDefault();
    const form = new FormData(event.target);
    const type = event.target.dataset.formType;
    const value = (key) => String(form.get(key) || '').trim();
    try {
      if (type === 'client') {
        await apiRequest('/api/clients', { method: 'POST', body: { name: value('name'), email: value('email'), phone: value('phone') } });
        state.page = 'clients';
      } else if (type === 'project') {
        const client = clients.find((item) => item.name === value('client'));
        if (!client?.id) throw new Error('Create or select a saved client first.');
        await apiRequest('/api/projects', { method: 'POST', body: { clientId: client.id, title: value('event'), eventType: value('event'), eventDate: value('date'), location: value('place'), totalAmount: Math.round(Number(value('amount')) * 100) } });
        state.page = 'projects';
      } else if (type === 'gallery') {
        const selectedProject = projects.find((project) => project.client + ' · ' + project.event === value('project'));
        if (!selectedProject?.id) throw new Error('Create or select a saved project first.');
        const created = await apiRequest('/api/galleries', { method: 'POST', body: { projectId: selectedProject.id, title: value('title') } });
        state.createdGalleryLink = new URL(created.item.url, location.origin).toString();
        state.page = 'galleries';
      } else if (type === 'invoice') {
        const selectedProject = projects.find((project) => project.client + ' · ' + project.event === value('project'));
        if (!selectedProject?.id) throw new Error('Create or select a saved project first.');
        await apiRequest('/api/invoices', { method: 'POST', body: { projectId: selectedProject.id, amount: Math.round(Number(value('amount')) * 100), dueDate: value('due') } });
        state.page = 'billing';
      }
      await loadServerData();
      state.formDialog = null;
      showToast('Saved to the studio account.');
      render();
    } catch (error) { showToast(error.message); }
    return;
  }
  if (event.target.id === 'appointment-form') { event.preventDefault(); const form = new FormData(event.target); appointments.unshift({ id: Date.now(), name: String(form.get('name') || '').trim(), event: String(form.get('style') || 'Session') + ' · ' + String(form.get('date') || ''), place: String(form.get('location') || 'Not set'), initials: String(form.get('name') || 'C').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase(), status: 'New request' }); saveWorkspace(); state.modal = false; showToast('Request saved in this browser preview.'); render(); }
  if (event.target.id === 'password-form') { event.preventDefault(); if (!new FormData(event.target).get('password')) return; state.galleryOpen = true; showToast('Gallery opened in this preview.'); render(); }
});
initializeApp();
