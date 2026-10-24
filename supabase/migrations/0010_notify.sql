-- 0010 · Registro del aviso por WhatsApp (T-024, REQ-009.3)
-- El barbero no tiene política de update sobre tickets; esta función registra el aviso.
create or replace function mark_ticket_notified(p_ticket_id uuid)
returns tickets
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
begin
  select * into t from tickets where id = p_ticket_id for update;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not is_member_of(t.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update tickets set notified_at = now(), notified_by = auth.uid() where id = t.id;
  insert into ticket_events (business_id, ticket_id, from_status, to_status, actor_type, actor_user_id, reason)
  values (t.business_id, t.id, t.status, t.status,
          (case when auth.uid() is null then 'system' when is_owner_of(t.business_id) then 'owner' else 'barber' end)::actor_type,
          auth.uid(), 'notified');
  select * into t from tickets where id = t.id;
  return t;
end $$;
revoke all on function mark_ticket_notified(uuid) from public;
grant execute on function mark_ticket_notified(uuid) to authenticated, service_role;
