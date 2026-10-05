alter table public.projects add column if not exists package_name text not null default '';

create or replace function public.get_organization_dashboard(p_org_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'activeProjects',(select count(*) from public.projects where organization_id=p_org_id and status<>'ARCHIVED'),
    'totalClients',(select count(*) from public.clients where organization_id=p_org_id and archived_at is null),
    'pendingPayments',(select coalesce(sum(greatest(0,total-amount_paid)),0) from public.invoices where organization_id=p_org_id and status in ('SENT','PARTIALLY_PAID','OVERDUE')),
    'completedPayments',(select coalesce(sum(amount),0) from public.payments where organization_id=p_org_id and status='CAPTURED'),
    'receivedLast30Days',(select coalesce(sum(amount),0) from public.payments where organization_id=p_org_id and status='CAPTURED' and paid_at>=now()-interval '30 days'),
    'storageLimitBytes',o.storage_limit_bytes,
    'storageUsedBytes',o.storage_used_bytes,
    'storageReservedBytes',o.storage_reserved_bytes,
    'activeGalleries',(select count(*) from public.galleries where organization_id=p_org_id and enabled=true and (expires_at is null or expires_at>now()))
  ) from public.organizations o where o.id=p_org_id;
$$;
revoke all on function public.get_organization_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.get_organization_dashboard(uuid) to service_role;
alter table public.upload_sessions add column if not exists target_variant text check (target_variant in ('preview','thumbnail'));
alter table public.upload_sessions add column if not exists width integer;
alter table public.upload_sessions add column if not exists height integer;
