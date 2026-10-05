create or replace function public.apply_captured_payment(p_order_id text,p_payment_id text,p_event_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare payment_row public.payments%rowtype; changed integer;
begin
  select * into payment_row from public.payments where gateway_order_id=p_order_id for update;
  if not found then return false; end if;
  if payment_row.status='CAPTURED' then return true; end if;
  update public.payments set status='CAPTURED',gateway_payment_id=p_payment_id,webhook_event_id=p_event_id,paid_at=now()
    where id=payment_row.id and status<>'CAPTURED';
  get diagnostics changed=row_count;
  if changed=0 then return true; end if;
  update public.projects set amount_paid=amount_paid+payment_row.amount,
    status=case when amount_paid+payment_row.amount>=total_amount then 'COMPLETED' else 'PAYMENT_PENDING' end,
    updated_at=now() where id=payment_row.project_id;
  if payment_row.invoice_id is not null then
    update public.invoices set amount_paid=amount_paid+payment_row.amount,
      status=case when amount_paid+payment_row.amount>=total then 'PAID' else 'PARTIALLY_PAID' end,
      updated_at=now() where id=payment_row.invoice_id;
  end if;
  return true;
end;
$$;
revoke all on function public.apply_captured_payment(text,text,text) from public,anon,authenticated;
grant execute on function public.apply_captured_payment(text,text,text) to service_role;
