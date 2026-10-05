create extension if not exists pgcrypto;

alter table public.organizations add column if not exists approved_at timestamptz;
alter table public.organizations add column if not exists approved_by uuid references auth.users(id);
alter table public.organizations add column if not exists review_note text not null default '';

create table if not exists public.studio_public_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  public_name text not null,
  city text not null default '',
  description text not null default '',
  specialties text[] not null default '{}',
  contact_email text not null default '',
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  event_type text not null default '',
  preferred_date date,
  message text not null default '',
  status text not null default 'NEW' check (status in ('NEW','CONTACTED','ACCEPTED','DECLINED','CONVERTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists booking_requests_org_created on public.booking_requests(organization_id,created_at desc);
create index if not exists organizations_public_status on public.organizations(status,created_at desc);

alter table public.studio_public_profiles enable row level security;
alter table public.booking_requests enable row level security;
alter table public.platform_admins enable row level security;

create policy public_profile_member_read on public.studio_public_profiles for select using (public.is_org_member(organization_id));
create policy public_profile_member_manage on public.studio_public_profiles for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy booking_member_access on public.booking_requests for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy platform_admin_self_read on public.platform_admins for select using (user_id=auth.uid());

create or replace function public.is_platform_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins where user_id=p_user_id)
$$;
revoke all on function public.is_platform_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_platform_admin(uuid) to service_role;
