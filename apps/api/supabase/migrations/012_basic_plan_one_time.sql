-- Temporary manual-renewal Basic plan checkout while recurring subscriptions are unavailable.
alter table public.subscriptions
  add column if not exists gateway_order_id text unique,
  add column if not exists gateway_payment_id text unique;

create or replace function public.activate_basic_storage_order(
  p_org_id uuid, p_order_id text, p_payment_id text
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer; existing_payment text;
begin
  select gateway_payment_id into existing_payment
    from public.subscriptions
    where organization_id=p_org_id and gateway_order_id=p_order_id
    for update;
  if not found then return false; end if;
  if existing_payment is not null then return existing_payment=p_payment_id; end if;

  update public.subscriptions
    set plan_name='Basic', status='ACTIVE', gateway_payment_id=p_payment_id,
        current_period_end=now()+interval '1 month'
    where organization_id=p_org_id and gateway_order_id=p_order_id
      and gateway_payment_id is null;
  get diagnostics changed = row_count;
  if changed=0 then return false; end if;

  update public.organizations
    set storage_limit_bytes=greatest(storage_limit_bytes,5368709120), updated_at=now()
    where id=p_org_id;
  return true;
end;
$$;

revoke all on function public.activate_basic_storage_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.activate_basic_storage_order(uuid,text,text) to service_role;
