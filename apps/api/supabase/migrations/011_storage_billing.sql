-- Basic monthly storage plan and independently purchased storage add-ons.
alter table public.organizations
  alter column storage_limit_bytes set default 5368709120;

update public.organizations
set storage_limit_bytes = 5368709120,
    updated_at = now();

alter table public.subscriptions
  add column if not exists razorpay_plan_id text,
  add column if not exists gateway_subscription_id text unique;

alter table public.subscriptions alter column plan_name set default 'Basic';
alter table public.subscriptions alter column status set default 'PENDING_PAYMENT';
update public.subscriptions
set plan_name = 'Basic',
    status = case when status in ('TRIAL', 'STARTER', 'INACTIVE') then 'PENDING_PAYMENT' else status end;

create table if not exists public.storage_addon_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gateway_order_id text not null unique,
  gateway_payment_id text unique,
  storage_bytes bigint not null check (storage_bytes > 0),
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'INR',
  status text not null default 'CREATED' check (status in ('CREATED','CAPTURED','FAILED','REFUNDED')),
  webhook_event_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists storage_addon_org_created_idx
  on public.storage_addon_purchases(organization_id, created_at desc);

alter table public.storage_addon_purchases enable row level security;
-- The API uses the Supabase service role for checkout and webhook processing.
-- RLS bypass does not replace table privileges, so grant the required operations.
grant select, insert, update, delete on public.storage_addon_purchases to service_role;
create policy storage_addon_org_read on public.storage_addon_purchases
  for select using (public.is_org_member(organization_id));

create or replace function public.apply_captured_storage_addon(
  p_order_id text, p_payment_id text, p_event_id text
) returns boolean language plpgsql security definer set search_path=public as $$
declare purchase_row public.storage_addon_purchases%rowtype; changed integer;
begin
  select * into purchase_row from public.storage_addon_purchases
    where gateway_order_id = p_order_id for update;
  if not found then return false; end if;
  if purchase_row.status = 'CAPTURED' then return true; end if;
  update public.storage_addon_purchases
    set status='CAPTURED', gateway_payment_id=p_payment_id,
        webhook_event_id=p_event_id, paid_at=now()
    where id=purchase_row.id and status='CREATED';
  get diagnostics changed = row_count;
  if changed = 0 then return true; end if;
  update public.organizations
    set storage_limit_bytes=storage_limit_bytes+purchase_row.storage_bytes, updated_at=now()
    where id=purchase_row.organization_id;
  return true;
end;
$$;

create or replace function public.sync_storage_subscription(
  p_subscription_id text, p_event text, p_period_end bigint default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer; mapped_status text;
begin
  mapped_status = case p_event
    when 'subscription.authenticated' then 'AUTHENTICATED'
    when 'subscription.activated' then 'ACTIVE'
    when 'subscription.charged' then 'ACTIVE'
    when 'subscription.paused' then 'PAUSED'
    when 'subscription.resumed' then 'ACTIVE'
    when 'subscription.halted' then 'HALTED'
    when 'subscription.cancelled' then 'CANCELLED'
    when 'subscription.completed' then 'COMPLETED'
    else null
  end;
  if mapped_status is null then return false; end if;
  update public.subscriptions
    set status=mapped_status,
        current_period_end=coalesce(to_timestamp(p_period_end), current_period_end)
    where gateway_subscription_id=p_subscription_id;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.apply_captured_storage_addon(text,text,text) from public, anon, authenticated;
grant execute on function public.apply_captured_storage_addon(text,text,text) to service_role;
revoke all on function public.sync_storage_subscription(text,text,bigint) from public, anon, authenticated;
grant execute on function public.sync_storage_subscription(text,text,bigint) to service_role;
