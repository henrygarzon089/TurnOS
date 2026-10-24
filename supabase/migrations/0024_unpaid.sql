-- 0024 · "No se cobró" con motivo (T-043)
-- Cubre: REQ-023.6. Un turno terminado queda en "Cobro pendiente" (payment_status = 'pending')
-- hasta que se registre la venta (register_sale → 'paid') o se marque aquí (→ 'unpaid'). El
-- motivo queda en ticket_events. Lo puede hacer el barbero del turno o el dueño (REQ-023.7).
create or replace function mark_ticket_unpaid(p_ticket_id uuid, p_reason text)
returns tickets
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
  v_owner boolean;
begin
  select * into t from tickets where id = p_ticket_id for update;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  v_owner := auth.uid() is null or is_owner_of(t.business_id);
  if not v_owner and t.assigned_barber_id is distinct from my_barber_id(t.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'REASON_REQUIRED' using errcode = 'P0004'; end if;
  if t.status <> 'done' or t.payment_status <> 'pending' then
    raise exception 'NOT_PENDING' using errcode = 'P0004';
  end if;
  update tickets set payment_status = 'unpaid' where id = t.id returning * into t;
  insert into ticket_events (business_id, ticket_id, from_status, to_status, actor_type, actor_user_id, reason, meta)
  values (t.business_id, t.id, 'done', 'done', case when v_owner then 'owner' else 'barber' end::actor_type,
          auth.uid(), 'No se cobró: ' || trim(p_reason), jsonb_build_object('payment_status', 'unpaid'));
  return t;
end $$;

revoke all on function mark_ticket_unpaid(uuid, text) from public;
grant execute on function mark_ticket_unpaid(uuid, text) to authenticated, service_role;
