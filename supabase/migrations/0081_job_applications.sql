-- T-310 · Postulaciones de "Trabaja con nosotros" (REQ-102, ADR-079, design §34.1).
-- Quien quiere trabajar en el negocio deja sus datos desde la web pública. Se escribe solo con
-- submit_job_application desde el servidor (service_role, ADR-009); el dueño lee, cambia el estado
-- y borra. Los barberos y anon no ven nada. Se borran solas a los 12 meses (REQ-102.7).

create type job_role as enum ('barbero', 'estilista', 'ambos');
create type job_availability as enum ('tiempo_completo', 'medio_tiempo', 'fines_de_semana');
create type job_application_status as enum ('nueva', 'contactada', 'descartada');

create table job_applications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  role job_role not null,
  years_experience smallint not null check (years_experience between 0 and 60),
  portfolio_url text check (portfolio_url is null or (portfolio_url ~ '^https://' and char_length(portfolio_url) <= 200)),
  availability job_availability not null,
  message text check (message is null or char_length(message) <= 500),
  status job_application_status not null default 'nueva',
  privacy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_applications_business_idx on job_applications (business_id, created_at desc);
create index job_applications_phone_idx on job_applications (business_id, phone_e164, created_at desc);

-- ------------------------------------------------------------------ RLS ----
alter table job_applications enable row level security;
alter table job_applications force row level security;
create policy job_applications_owner_select on job_applications for select to authenticated
  using (is_owner_of(business_id));
revoke all on job_applications from public, anon, authenticated;
grant select on job_applications to authenticated;
grant all on job_applications to service_role;

-- ------------------------------------------------------------ funciones ----
-- REQ-102.4 / REQ-102.5 envío desde la web. Devuelve 'created', 'updated' o 'rate_limited'.
create or replace function submit_job_application(
  p_slug text, p_name text, p_phone text, p_role text, p_years int, p_portfolio text,
  p_availability text, p_message text, p_privacy_version text, p_ip text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid;
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_portfolio text := nullif(trim(coalesce(p_portfolio, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  select id into v_biz from businesses where slug = p_slug;
  if v_biz is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80
     or p_phone !~ '^\+[1-9][0-9]{7,14}$'
     or p_years is null or p_years < 0 or p_years > 60
     or (v_portfolio is not null and (v_portfolio !~ '^https://' or char_length(v_portfolio) > 200))
     or (v_message is not null and char_length(v_message) > 500)
     or coalesce(trim(p_privacy_version), '') = '' then
    raise exception 'INVALID' using errcode = '22023';
  end if;
  if not check_rate_limit('job:phone:' || p_phone, 3, interval '1 day')
     or (p_ip is not null and not check_rate_limit('job:ip:' || p_ip, 10, interval '1 hour')) then
    return 'rate_limited';
  end if;

  select id into v_id from job_applications
  where business_id = v_biz and phone_e164 = p_phone and created_at > now() - interval '30 days'
  order by created_at desc limit 1;

  if v_id is not null then
    update job_applications set full_name = v_name, role = p_role::job_role, years_experience = p_years,
      portfolio_url = v_portfolio, availability = p_availability::job_availability, message = v_message,
      privacy_version = p_privacy_version, status = 'nueva', updated_at = now()
    where id = v_id;
    return 'updated';
  end if;

  insert into job_applications (business_id, full_name, phone_e164, role, years_experience, portfolio_url,
    availability, message, privacy_version)
  values (v_biz, v_name, p_phone, p_role::job_role, p_years, v_portfolio,
    p_availability::job_availability, v_message, p_privacy_version);
  return 'created';
end $$;
revoke all on function submit_job_application(text, text, text, text, int, text, text, text, text, text) from public, anon, authenticated;
grant execute on function submit_job_application(text, text, text, text, int, text, text, text, text, text) to service_role;

-- REQ-102.6 el dueño marca contactada o descartada (o la vuelve a nueva).
create or replace function set_job_application_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_biz uuid;
begin
  select business_id into v_biz from job_applications where id = p_id;
  if v_biz is null or not is_owner_of(v_biz) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update job_applications set status = p_status::job_application_status, updated_at = now() where id = p_id;
end $$;
revoke all on function set_job_application_status(uuid, text) from public, anon;
grant execute on function set_job_application_status(uuid, text) to authenticated, service_role;

-- REQ-102.6 / REQ-102.7 el dueño borra una postulación (supresión, Ley 1581) y su rastro en los límites.
create or replace function delete_job_application(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_biz uuid; v_phone text;
begin
  select business_id, phone_e164 into v_biz, v_phone from job_applications where id = p_id;
  if v_biz is null or not is_owner_of(v_biz) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from job_applications where id = p_id;
  delete from rate_limits where key = 'job:phone:' || v_phone;
end $$;
revoke all on function delete_job_application(uuid) from public, anon;
grant execute on function delete_job_application(uuid) to authenticated, service_role;

-- REQ-102.7 borrado automático a los 12 meses; devuelve cuántas borró.
create or replace function purge_job_applications() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from job_applications where created_at < now() - interval '12 months';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function purge_job_applications() from public, anon, authenticated;
grant execute on function purge_job_applications() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'turnos_purge_job_applications';
    perform cron.schedule('turnos_purge_job_applications', '30 8 * * *', 'select public.purge_job_applications()');
  end if;
end $$;

-- REQ-102.5 la limpieza oportunista de check_rate_limit borra con la ventana de quien llama: una
-- llamada por hora (la IP) borraba el conteo diario del celular y el límite de 3 al día se
-- reiniciaba. Redefinición de 0038: los conteos diarios `job:phone:` solo los limpia su propia
-- llamada (ventana de 1 día → borra los de más de 2 días).
create or replace function check_rate_limit(p_key text, p_limit int, p_window interval default interval '1 hour')
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  v_count int;
begin
  insert into rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  -- Limpieza oportunista de ventanas viejas
  delete from rate_limits
  where window_start < now() - p_window * 2
    and key not like 'wa-reply:%'
    and (key not like 'job:phone:%' or p_window >= interval '1 day')
    and random() < 0.05;
  return v_count <= p_limit;
end $$;
