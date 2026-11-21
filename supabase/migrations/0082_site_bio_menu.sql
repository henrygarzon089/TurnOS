-- T-320 · Descripción del barbero y menú por categoría en la web (REQ-103, ADR-082, design §35).
-- `bio` la escribe el dueño en Barberos (RLS de `barbers` sin cambios: el dueño ya edita la fila).
alter table barbers add column bio text null
  constraint barbers_bio_len check (bio is null or char_length(btrim(bio)) between 1 and 200 and char_length(bio) <= 200);

-- Redefinición de 0080: suma `bio` al equipo y el `menu` (a la venta, con categoría). Nada más cambia.
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
    'team', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.display_name,
                                                          'photoPath', b.photo_path, 'bio', b.bio)
                                       order by b.sort_order, b.display_name)
                      from barbers b where b.business_id = v_biz and b.is_active), '[]'::jsonb),
    'menu', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price,
                                                          'photoPath', p.photo_path,
                                                          'description', p.description,
                                                          'category', p.category)
                                       order by p.sort_order, p.name)
                      from products p where p.business_id = v_biz and p.is_active and p.for_sale), '[]'::jsonb)
  );
end $$;

revoke all on function get_public_site(text) from public, anon, authenticated;
grant execute on function get_public_site(text) to service_role;
