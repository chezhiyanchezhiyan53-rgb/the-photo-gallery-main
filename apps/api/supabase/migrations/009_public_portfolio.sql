create table if not exists public.studio_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  media_id uuid not null unique references public.media(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 200),
  publication_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, media_id)
);

create index if not exists studio_portfolio_org_created
  on public.studio_portfolio_items(organization_id, created_at desc);

alter table public.studio_portfolio_items enable row level security;

create policy studio_portfolio_member_read
  on public.studio_portfolio_items for select
  using (public.is_org_member(organization_id));

create policy studio_portfolio_member_manage
  on public.studio_portfolio_items for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

