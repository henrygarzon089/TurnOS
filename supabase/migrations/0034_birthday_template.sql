-- 0034 · Plantilla "cumpleaños" para los negocios que ya existen (T-058, REQ-037.4)
-- Va aparte de 0033 porque el valor 'birthday' del enum message_template_key no se puede usar en
-- la misma transacción que lo agrega. Los negocios nuevos la reciben de create_business.
insert into message_templates (business_id, key, body)
select z.id, 'birthday', '¡Feliz cumpleaños, {nombre}! En {negocio} te deseamos un gran día.'
from businesses z
on conflict (business_id, key) do nothing;
