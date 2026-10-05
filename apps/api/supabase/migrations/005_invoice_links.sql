alter table public.invoices add column if not exists public_token_hash text unique;
create index if not exists invoices_org_created on public.invoices(organization_id,created_at desc);
