create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 140),
  slug text unique,
  status text not null default 'PENDING_APPROVAL' check (status in ('PENDING_APPROVAL','ACTIVE','SUSPENDED')),
  storage_limit_bytes bigint not null default 107374182400 check (storage_limit_bytes >= 0),
  storage_used_bytes bigint not null default 0 check (storage_used_bytes >= 0),
  storage_reserved_bytes bigint not null default 0 check (storage_reserved_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','PHOTOGRAPHER','EDITOR','ACCOUNTANT','SUPER_ADMIN')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  name text not null,
  event_type text not null default '',
  event_date date,
  location text not null default '',
  description text not null default '',
  total_amount bigint not null default 0 check (total_amount >= 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  currency char(3) not null default 'INR',
  status text not null default 'LEAD' check (status in ('LEAD','QUOTATION_SENT','BOOKED','IN_PROGRESS','EDITING','GALLERY_READY','PAYMENT_PENDING','COMPLETED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  number text not null,
  line_items jsonb not null default '[]'::jsonb,
  subtotal bigint not null default 0 check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  tax bigint not null default 0 check (tax >= 0),
  total bigint not null check (total >= 0),
  terms text not null default '',
  expires_at timestamptz,
  public_token_hash text unique,
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,number)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  number text not null,
  kind text not null default 'STANDARD' check (kind in ('STANDARD','ADVANCE','MILESTONE','FINAL','RECEIPT')),
  line_items jsonb not null default '[]'::jsonb,
  subtotal bigint not null default 0,
  discount bigint not null default 0,
  tax bigint not null default 0,
  total bigint not null check (total >= 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  currency char(3) not null default 'INR',
  due_date date,
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','VOID')),
  pdf_object_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,number)
);

create table if not exists public.payment_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  invoice_id uuid references public.invoices(id),
  name text not null,
  amount bigint not null check (amount > 0),
  due_date date,
  status text not null default 'DUE' check (status in ('DUE','PAID','OVERDUE','VOID')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  invoice_id uuid references public.invoices(id),
  gateway text not null default 'RAZORPAY',
  gateway_order_id text unique,
  gateway_payment_id text unique,
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'INR',
  status text not null default 'CREATED' check (status in ('CREATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED')),
  webhook_event_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.galleries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_media_id uuid,
  access_token_hash text not null unique,
  password_hash text,
  expires_at timestamptz,
  enabled boolean not null default true,
  downloads_require_payment boolean not null default true,
  allow_streaming boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  gallery_id uuid references public.galleries(id) on delete set null,
  album_id uuid references public.gallery_albums(id) on delete set null,
  provider text not null check (provider in ('R2','STREAM')),
  original_object_key text,
  preview_object_key text,
  thumbnail_object_key text,
  stream_video_id text,
  filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  width integer,
  height integer,
  duration_seconds numeric,
  checksum_sha256 text,
  status text not null default 'UPLOADING' check (status in ('UPLOADING','PROCESSING','READY','FAILED','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  gallery_id uuid references public.galleries(id) on delete set null,
  media_id uuid references public.media(id) on delete set null,
  provider text not null check (provider in ('R2','STREAM')),
  object_key text,
  provider_upload_id text,
  provider_upload_url text,
  filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  part_size_bytes bigint,
  part_count integer,
  status text not null default 'INITIATED' check (status in ('INITIATED','UPLOADING','COMPLETED','ABORTED','EXPIRED','FAILED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_name text not null default 'Starter',
  active_project_limit integer not null default 10,
  team_seat_limit integer not null default 1,
  video_limit_bytes bigint not null default 0,
  features jsonb not null default '{}'::jsonb,
  status text not null default 'TRIAL',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clients_org_name_idx on public.clients(organization_id, lower(name));
create index if not exists projects_org_created_idx on public.projects(organization_id, created_at desc);
create index if not exists media_org_project_idx on public.media(organization_id, project_id, created_at desc);
create index if not exists upload_sessions_active_idx on public.upload_sessions(organization_id, status, expires_at);
create index if not exists invoices_org_due_idx on public.invoices(organization_id, due_date, status);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=target_org and m.user_id=auth.uid())
$$;

create or replace function public.create_studio_for_user(p_user_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare created_org uuid;
begin
  insert into public.organizations(name) values (left(trim(p_name),140)) returning id into created_org;
  insert into public.organization_members(organization_id,user_id,role) values(created_org,p_user_id,'OWNER');
  insert into public.subscriptions(organization_id) values(created_org);
  return created_org;
end;
$$;

create or replace function public.reserve_org_storage(p_org_id uuid, p_bytes bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  if p_bytes <= 0 then return false; end if;
  update public.organizations set storage_reserved_bytes=storage_reserved_bytes+p_bytes, updated_at=now()
   where id=p_org_id and storage_used_bytes+storage_reserved_bytes+p_bytes<=storage_limit_bytes;
  get diagnostics changed = row_count;
  return changed=1;
end;
$$;

create or replace function public.release_org_storage(p_org_id uuid, p_bytes bigint)
returns void language sql security definer set search_path=public as $$
  update public.organizations set storage_reserved_bytes=greatest(0,storage_reserved_bytes-p_bytes),updated_at=now() where id=p_org_id;
$$;

create or replace function public.commit_org_storage(p_org_id uuid, p_bytes bigint)
returns void language sql security definer set search_path=public as $$
  update public.organizations set storage_reserved_bytes=greatest(0,storage_reserved_bytes-p_bytes),storage_used_bytes=storage_used_bytes+p_bytes,updated_at=now() where id=p_org_id;
$$;

revoke all on function public.create_studio_for_user(uuid,text) from public, anon, authenticated;
revoke all on function public.reserve_org_storage(uuid,bigint) from public, anon, authenticated;
revoke all on function public.release_org_storage(uuid,bigint) from public, anon, authenticated;
revoke all on function public.commit_org_storage(uuid,bigint) from public, anon, authenticated;
grant execute on function public.create_studio_for_user(uuid,text) to service_role;
grant execute on function public.reserve_org_storage(uuid,bigint) to service_role;
grant execute on function public.release_org_storage(uuid,bigint) to service_role;
grant execute on function public.commit_org_storage(uuid,bigint) to service_role;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.quotations enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_milestones enable row level security;
alter table public.payments enable row level security;
alter table public.galleries enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.media enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_member_read on public.organizations for select using (public.is_org_member(id));
create policy memberships_member_read on public.organization_members for select using (public.is_org_member(organization_id));
create policy clients_org_isolation on public.clients for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy projects_org_isolation on public.projects for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy quotations_org_isolation on public.quotations for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy invoices_org_isolation on public.invoices for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy payment_milestones_org_isolation on public.payment_milestones for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy payments_org_isolation on public.payments for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy galleries_org_isolation on public.galleries for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy gallery_albums_org_isolation on public.gallery_albums for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy media_org_isolation on public.media for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy upload_sessions_org_isolation on public.upload_sessions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy subscriptions_org_isolation on public.subscriptions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy audit_logs_org_isolation on public.audit_logs for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy org_update_owner on public.organizations for update using (exists(select 1 from public.organization_members m where m.organization_id=id and m.user_id=auth.uid() and m.role in ('OWNER','ADMIN'))) with check (exists(select 1 from public.organization_members m where m.organization_id=id and m.user_id=auth.uid() and m.role in ('OWNER','ADMIN')));
