-- 0004 · Invitaciones y retiro de barberos (T-007)
-- Cubre: REQ-030.2, REQ-030.4, REQ-016.3. Diseño: design.md §6.2–6.3, ADR-010

-- Lectura pública mínima de una invitación por token (la llama el servidor con service_role).
create or replace function get_invitation(p_token text)
returns table (barber_id uuid, barber_name text, barber_phone text, business_name text,
               business_slug text, is_valid boolean)
language sql stable security definer set search_path = public as $$
  select b.id, b.display_name, b.phone_e164, z.name, z.slug,
         (i.accepted_at is null and i.expires_at > now() and b.is_active) as is_valid
  from invitations i
  join barbers b on b.id = i.barber_id
  join businesses z on z.id = i.business_id
  where i.token = p_token
$$;

-- Vincula el usuario de Auth recién creado al barbero y le da membresía (REQ-030.2).
-- Idempotente para el mismo usuario (reintentos); falla si la invitación no es válida.
create or replace function accept_invitation(p_token text, p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv invitations%rowtype;
  v_active boolean;
begin
  select * into v_inv from invitations where token = p_token for update;
  if not found then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    -- Reintento del mismo usuario: ok; otro usuario: rechazado.
    if exists (select 1 from barbers where id = v_inv.barber_id and user_id = p_user_id) then
      return v_inv.barber_id;
    end if;
    raise exception 'INVITATION_USED' using errcode = 'P0003';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED' using errcode = 'P0003';
  end if;
  select is_active into v_active from barbers where id = v_inv.barber_id;
  if not coalesce(v_active, false) then
    raise exception 'BARBER_INACTIVE' using errcode = 'P0003';
  end if;

  update barbers set user_id = p_user_id where id = v_inv.barber_id;
  insert into memberships (user_id, business_id, role, barber_id)
  values (p_user_id, v_inv.business_id, 'barber', v_inv.barber_id)
  on conflict (user_id, business_id) do update set barber_id = excluded.barber_id, role = 'barber';
  update invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.barber_id;
end $$;

-- El dueño retira a un barbero: pierde acceso, sale de la fila, conserva historial (REQ-016.3).
-- Los turnos que lo tenían como preferido pasan a "el que esté libre" (lo implementa T-013 al
-- existir la tabla tickets; aquí queda el punto de extensión).
create or replace function remove_barber(p_barber_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid;
  v_user uuid;
begin
  select business_id, user_id into v_biz, v_user from barbers where id = p_barber_id;
  if v_biz is null then
    raise exception 'BARBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not is_owner_of(v_biz) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update barbers set is_active = false, status = 'off', present_day = null where id = p_barber_id;
  if v_user is not null then
    delete from memberships where user_id = v_user and business_id = v_biz and role = 'barber';
  end if;
  update invitations set expires_at = now() where barber_id = p_barber_id and accepted_at is null;
end $$;

-- Restablecer el PIN lo hace el servidor con la Admin API de Auth; aquí solo se expone
-- a quién pertenece el barbero (para validar que el dueño puede hacerlo).
revoke all on function get_invitation(text) from public;
revoke all on function accept_invitation(text, uuid) from public;
revoke all on function remove_barber(uuid) from public;
grant execute on function get_invitation(text) to service_role;
grant execute on function accept_invitation(text, uuid) to service_role;
grant execute on function remove_barber(uuid) to authenticated, service_role;
