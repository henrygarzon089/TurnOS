-- 0003 · RLS del núcleo (T-005)
-- Cubre: REQ-031.1, REQ-031.4, NFR-004. Diseño: design.md §2.3–2.4

-- ------------------------------------------------ funciones de seguridad ----
create or replace function auth_business_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select business_id from memberships where user_id = auth.uid()
$$;

create or replace function is_owner_of(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships where user_id = auth.uid() and business_id = b and role = 'owner'
  )
$$;

create or replace function is_member_of(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where user_id = auth.uid() and business_id = b)
$$;

-- Barbero asociado al usuario en ese negocio (null si no es barbero ni dueño con silla).
create or replace function my_barber_id(b uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select barber_id from memberships where user_id = auth.uid() and business_id = b
$$;

grant execute on function auth_business_ids(), is_owner_of(uuid), is_member_of(uuid), my_barber_id(uuid)
  to authenticated, service_role;

-- --------------------------------------------------------------- grants ----
-- anon no toca ninguna tabla: las páginas públicas pasan por server actions (ADR-009).
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

-- ----------------------------------------------------------- RLS on ----
alter table businesses enable row level security;              alter table businesses force row level security;
alter table business_hours enable row level security;          alter table business_hours force row level security;
alter table memberships enable row level security;             alter table memberships force row level security;
alter table barbers enable row level security;                 alter table barbers force row level security;
alter table invitations enable row level security;             alter table invitations force row level security;
alter table services enable row level security;                alter table services force row level security;
alter table products enable row level security;                alter table products force row level security;
alter table message_templates enable row level security;       alter table message_templates force row level security;
alter table privacy_policy_versions enable row level security; alter table privacy_policy_versions force row level security;

-- businesses: miembros leen; solo el dueño edita; nadie inserta directo (create_business).
create policy businesses_select on businesses for select to authenticated
  using (is_member_of(id));
create policy businesses_update on businesses for update to authenticated
  using (is_owner_of(id)) with check (is_owner_of(id));

-- business_hours
create policy business_hours_select on business_hours for select to authenticated
  using (is_member_of(business_id));
create policy business_hours_owner_write on business_hours for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));

-- memberships: se ven las del propio negocio; cambios solo por funciones (security definer).
create policy memberships_select on memberships for select to authenticated
  using (is_member_of(business_id));

-- barbers: miembros leen; dueño todo; barbero edita su propia fila (solo status/present_day,
-- lo valida el trigger de abajo).
create policy barbers_select on barbers for select to authenticated
  using (is_member_of(business_id));
create policy barbers_owner_write on barbers for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
create policy barbers_self_update on barbers for update to authenticated
  using (id = my_barber_id(business_id)) with check (id = my_barber_id(business_id));

create or replace function barbers_restrict_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- El dueño (o una función con service_role, donde auth.uid() es null) puede cambiar todo.
  if auth.uid() is null or is_owner_of(new.business_id) then
    return new;
  end if;
  if new.business_id <> old.business_id or new.user_id is distinct from old.user_id
     or new.display_name <> old.display_name or new.phone_e164 is distinct from old.phone_e164
     or new.commission_pct <> old.commission_pct or new.is_active <> old.is_active
     or new.sort_order <> old.sort_order or new.duration_factor is distinct from old.duration_factor then
    raise exception 'FORBIDDEN_COLUMN' using errcode = '42501',
      hint = 'El barbero solo puede cambiar su estado.';
  end if;
  return new;
end $$;

create trigger barbers_restrict_self_update
  before update on barbers for each row execute function barbers_restrict_self_update();

-- invitations: solo el dueño.
create policy invitations_owner on invitations for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));

-- services / products: miembros leen; dueño escribe.
create policy services_select on services for select to authenticated using (is_member_of(business_id));
create policy services_owner_write on services for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
create policy products_select on products for select to authenticated using (is_member_of(business_id));
create policy products_owner_write on products for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));

-- message_templates / privacy_policy_versions
create policy message_templates_select on message_templates for select to authenticated
  using (is_member_of(business_id));
create policy message_templates_owner_write on message_templates for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
create policy privacy_select on privacy_policy_versions for select to authenticated
  using (is_member_of(business_id));
create policy privacy_owner_write on privacy_policy_versions for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
