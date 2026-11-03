-- 0044 · Plantilla "Membresía por vencer" para los negocios que ya existen (T-074, REQ-048.4)
-- Va aparte de 0043 porque el valor 'membership_renewal' del enum message_template_key no se puede
-- usar en la misma transacción que lo agrega. Los negocios nuevos la reciben de create_business.
insert into message_templates (business_id, key, body)
select z.id, 'membership_renewal',
       'Hola {nombre}, la membresía familiar en {negocio} vence el {fecha}. Renuévala en tu próxima visita.'
from businesses z
on conflict (business_id, key) do nothing;
