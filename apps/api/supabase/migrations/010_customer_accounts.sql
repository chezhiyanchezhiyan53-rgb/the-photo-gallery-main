alter table public.booking_requests add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
alter table public.clients add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create index if not exists booking_requests_customer_user_idx on public.booking_requests(customer_user_id,created_at desc);
create index if not exists clients_customer_user_idx on public.clients(customer_user_id);
create or replace function public.convert_booking_request(p_organization_id uuid,p_request_id uuid)
returns table(project_id uuid,project_name text,already_converted boolean)
language plpgsql security definer set search_path=public as $$
declare r public.booking_requests%rowtype; c uuid; p uuid; n text;
begin
 select * into r from public.booking_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
 if r.status='CONVERTED' then
   if r.project_id is null then raise exception 'APPOINTMENT_ALREADY_CONVERTED'; end if;
   return query select x.id,x.name,true from public.projects x where x.id=r.project_id and x.organization_id=p_organization_id; return;
 end if;
 if r.status<>'ACCEPTED' then raise exception 'APPOINTMENT_MUST_BE_ACCEPTED'; end if;
 insert into public.clients(organization_id,name,email,phone,customer_user_id) values(p_organization_id,r.customer_name,r.customer_email,r.customer_phone,r.customer_user_id) returning id into c;
 n:=r.customer_name||' — '||coalesce(nullif(r.event_type,''),'Photography');
 insert into public.projects(organization_id,client_id,name,event_type,event_date,description,status) values(p_organization_id,c,n,r.event_type,r.preferred_date,r.message,'LEAD') returning id into p;
 update public.booking_requests set status='CONVERTED',project_id=p,updated_at=now() where id=p_request_id and organization_id=p_organization_id;
 return query select p,n,false;
end; $$;
revoke all on function public.convert_booking_request(uuid,uuid) from public,anon,authenticated;
grant execute on function public.convert_booking_request(uuid,uuid) to service_role;
