-- 0030 · Servicios por barbero (REQ-035, ADR-023)
-- Qué servicios hace cada barbero. Por defecto, todos: la migración llena las combinaciones
-- existentes (REQ-035.4) y los triggers marcan todo al crear un barbero o un servicio
-- (REQ-035.1–35.2); el dueño desmarca después con set_barber_services / set_service_barbers.

-- FK compuestas: barbero y servicio del mismo negocio que la fila
alter table barbers add constraint barbers_business_id_uniq unique (business_id, id);
alter table services add constraint services_business_id_uniq unique (business_id, id);

create table barber_services (
  business_id uuid not null references businesses (id) on delete cascade,
  barber_id uuid not null,
  service_id uuid not null,
  primary key (barber_id, service_id),
  foreign key (business_id, barber_id) references barbers (business_id, id) on delete cascade,
  foreign key (business_id, service_id) references services (business_id, id) on delete cascade
);
create index barber_services_service_idx on barber_services (service_id);

alter table barber_services enable row level security;
alter table barber_services force row level security;
create policy barber_services_select on barber_services for select to authenticated
  using (is_member_of(business_id));
-- Escritura solo por las funciones de abajo (validan dueño y REQ-035.3)

-- REQ-035.4
insert into barber_services (business_id, barber_id, service_id)
select b.business_id, b.id, s.id from barbers b join services s on s.business_id = b.business_id;

create or replace function barber_does_service(p_barber_id uuid, p_service_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from barber_services where barber_id = p_barber_id and service_id = p_service_id);
$$;

-- REQ-035.1 barbero nuevo: todos los servicios activos
create or replace function barbers_default_services() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into barber_services (business_id, barber_id, service_id)
  select new.business_id, new.id, s.id from services s where s.business_id = new.business_id and s.is_active;
  return null;
end $$;
create trigger barbers_default_services after insert on barbers
  for each row execute function barbers_default_services();

-- REQ-035.2 servicio nuevo: todos los barberos activos
create or replace function services_default_barbers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into barber_services (business_id, barber_id, service_id)
  select new.business_id, b.id, new.id from barbers b where b.business_id = new.business_id and b.is_active;
  return null;
end $$;
create trigger services_default_barbers after insert on services
  for each row execute function services_default_barbers();

-- REQ-035.3 ningún barbero activo del negocio sin servicios
create or replace function assert_barbers_have_services(p_business_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from barbers b where b.business_id = p_business_id and b.is_active
             and not exists (select 1 from barber_services bs where bs.barber_id = b.id)) then
    raise exception 'NO_SERVICES' using hint = 'Marca al menos un servicio.';
  end if;
end $$;

-- REQ-035.1 el dueño guarda los servicios que hace un barbero (reemplaza el conjunto)
create or replace function set_barber_services(p_barber_id uuid, p_service_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_biz uuid;
begin
  select business_id into v_biz from barbers where id = p_barber_id;
  if v_biz is null or not is_owner_of(v_biz) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_service_ids, '{}')) x(id)
             where not exists (select 1 from services s where s.id = x.id and s.business_id = v_biz)) then
    raise exception 'SERVICE_NOT_FOUND';
  end if;
  delete from barber_services where barber_id = p_barber_id;
  insert into barber_services (business_id, barber_id, service_id)
  select distinct v_biz, p_barber_id, x.id from unnest(coalesce(p_service_ids, '{}')) x(id);
  perform assert_barbers_have_services(v_biz);
  perform notify_queue_changed(v_biz, 'barber');
end $$;

-- REQ-035.2 el dueño guarda quién hace un servicio (reemplaza el conjunto)
create or replace function set_service_barbers(p_service_id uuid, p_barber_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_biz uuid;
begin
  select business_id into v_biz from services where id = p_service_id;
  if v_biz is null or not is_owner_of(v_biz) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_barber_ids, '{}')) x(id)
             where not exists (select 1 from barbers b where b.id = x.id and b.business_id = v_biz)) then
    raise exception 'BARBER_NOT_FOUND';
  end if;
  delete from barber_services where service_id = p_service_id;
  insert into barber_services (business_id, barber_id, service_id)
  select distinct v_biz, x.id, p_service_id from unnest(coalesce(p_barber_ids, '{}')) x(id);
  perform assert_barbers_have_services(v_biz);
  perform notify_queue_changed(v_biz, 'barber');
end $$;

-- Permisos (ADR-019): explícitos (los default privileges no alcanzan en todas las bases); el dueño
-- llama a las dos funciones de escritura, el resto es interno
revoke execute on function
  barber_does_service(uuid, uuid), barbers_default_services(), services_default_barbers(),
  assert_barbers_have_services(uuid), set_barber_services(uuid, uuid[]), set_service_barbers(uuid, uuid[])
from public, anon, authenticated;
grant execute on function
  barber_does_service(uuid, uuid), barbers_default_services(), services_default_barbers(),
  assert_barbers_have_services(uuid), set_barber_services(uuid, uuid[]), set_service_barbers(uuid, uuid[])
to service_role;
grant execute on function set_barber_services(uuid, uuid[]), set_service_barbers(uuid, uuid[]) to authenticated;
