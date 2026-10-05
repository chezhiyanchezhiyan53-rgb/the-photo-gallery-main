create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  gateway_refund_id text not null unique,
  amount bigint not null check (amount > 0),
  webhook_event_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists payment_refunds_payment_idx on public.payment_refunds(payment_id, created_at);
alter table public.payment_refunds enable row level security;
create policy payment_refunds_org_read on public.payment_refunds for select
  using (exists(select 1 from public.payments p where p.id=payment_id and public.is_org_member(p.organization_id)));

create or replace function public.apply_processed_refund(
  p_refund_id text, p_payment_id text, p_amount bigint, p_event_id text
) returns boolean language plpgsql security definer set search_path=public as $$
declare payment_row public.payments%rowtype; refunded_before bigint; changed integer;
begin
  if p_refund_id is null or p_payment_id is null or p_amount <= 0 then return false; end if;
  if exists(select 1 from public.payment_refunds where gateway_refund_id=p_refund_id) then return true; end if;
  select * into payment_row from public.payments where gateway_payment_id=p_payment_id for update;
  if not found or payment_row.status not in ('CAPTURED','REFUNDED') then return false; end if;
  select coalesce(sum(amount),0) into refunded_before from public.payment_refunds where payment_id=payment_row.id;
  if refunded_before+p_amount>payment_row.amount then return false; end if;
  insert into public.payment_refunds(payment_id,gateway_refund_id,amount,webhook_event_id)
    values(payment_row.id,p_refund_id,p_amount,nullif(p_event_id,'')) on conflict do nothing;
  get diagnostics changed=row_count;
  if changed=0 then return true; end if;
  update public.projects set amount_paid=greatest(0,amount_paid-p_amount),
    status=case when status='COMPLETED' then 'PAYMENT_PENDING' else status end, updated_at=now()
    where id=payment_row.project_id;
  if payment_row.invoice_id is not null then
    update public.invoices set amount_paid=greatest(0,amount_paid-p_amount),
      status=case when greatest(0,amount_paid-p_amount)=0 then 'SENT' else 'PARTIALLY_PAID' end,
      updated_at=now() where id=payment_row.invoice_id;
  end if;
  if refunded_before+p_amount=payment_row.amount then
    update public.payments set status='REFUNDED' where id=payment_row.id;
  end if;
  return true;
end;
$$;

revoke all on function public.apply_processed_refund(text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.apply_processed_refund(text,text,bigint,text) to service_role;
