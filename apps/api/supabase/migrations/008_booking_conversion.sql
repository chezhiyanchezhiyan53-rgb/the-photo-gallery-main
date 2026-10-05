alter table public.booking_requests
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create or replace function public.convert_booking_request(
  p_organization_id uuid,
  p_request_id uuid
)
returns table(project_id uuid, project_name text, already_converted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.booking_requests%rowtype;
  new_client_id uuid;
  new_project_id uuid;
  new_project_name text;
begin
  select * into request_row
  from public.booking_requests
  where id = p_request_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  if request_row.status = 'CONVERTED' then
    if request_row.project_id is null then
      raise exception 'APPOINTMENT_ALREADY_CONVERTED';
    end if;

    return query
      select p.id, p.name, true
      from public.projects p
      where p.id = request_row.project_id
        and p.organization_id = p_organization_id;
    return;
  end if;

  if request_row.status <> 'ACCEPTED' then
    raise exception 'APPOINTMENT_MUST_BE_ACCEPTED';
  end if;

  insert into public.clients (organization_id, name, email, phone)
  values (
    p_organization_id,
    request_row.customer_name,
    request_row.customer_email,
    request_row.customer_phone
  )
  returning id into new_client_id;

  new_project_name := request_row.customer_name || ' — ' ||
    coalesce(nullif(request_row.event_type, ''), 'Photography');

  insert into public.projects (
    organization_id,
    client_id,
    name,
    event_type,
    event_date,
    description,
    status
  )
  values (
    p_organization_id,
    new_client_id,
    new_project_name,
    request_row.event_type,
    request_row.preferred_date,
    request_row.message,
    'LEAD'
  )
  returning id into new_project_id;

  update public.booking_requests
  set status = 'CONVERTED',
      project_id = new_project_id,
      updated_at = now()
  where id = p_request_id
    and organization_id = p_organization_id;

  return query select new_project_id, new_project_name, false;
end;
$$;

revoke all on function public.convert_booking_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.convert_booking_request(uuid, uuid) to service_role;

