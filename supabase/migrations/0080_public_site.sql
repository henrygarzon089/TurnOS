-- T-300 · Lectura pública de la web del negocio (REQ-101, ADR-077, design §33.1).
-- La portada `/` necesita el horario de la semana, la regla de fidelidad y el equipo, que
-- `get_public_business` no trae, y el enlace de reseñas en Google (REQ-036). Solo lectura, sin celulares ni datos de clientes; como las demás
-- lecturas públicas, solo la ejecuta service_role desde las server actions (ADR-009).
create or replace function get_public_site(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_biz uuid;
begin
  select id into v_biz from businesses where slug = p_slug;
  if v_biz is null then return null; end if;
  return jsonb_build_object(
    'reviewUrl', (select google_review_url from businesses where id = v_biz),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
                         'weekday', h.weekday,
                         'opensAt', to_char(h.opens_at, 'HH24:MI'),
                         'closesAt', to_char(h.closes_at, 'HH24:MI'),
                         'isClosed', h.is_closed) order by h.weekday)
                       from business_hours h where h.business_id = v_biz), '[]'::jsonb),
    'loyalty', (select jsonb_build_object(
                  'visitsRequired', l.visits_required,
                  'rewardType', l.reward_type,
                  'rewardServiceName', (select s.name from services s where s.id = l.reward_service_id),
                  'rewardAmount', l.reward_amount)
                from loyalty_programs l where l.business_id = v_biz and l.enabled),
    'team', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.display_name, 'photoPath', b.photo_path)
                                       order by b.sort_order, b.display_name)
                      from barbers b where b.business_id = v_biz and b.is_active), '[]'::jsonb)
  );
end $$;

revoke all on function get_public_site(text) from public, anon, authenticated;
grant execute on function get_public_site(text) to service_role;
