-- 0050 · Hito 9, tarjetas de regalo: valores nuevos de enum (T-090, ADR-034, design.md §15.1)
-- Van solos en esta migración porque un valor nuevo de enum no se usa en la misma transacción que
-- lo agrega (como 0043/0044). 0051 en adelante los usan.
alter type payment_method add value if not exists 'gift_card';       -- REQ-057.1 pagar con la tarjeta
alter type sale_item_kind add value if not exists 'gift_card';       -- REQ-055.2 la venta de la tarjeta
alter type message_template_key add value if not exists 'gift_card'; -- REQ-056.1 texto para enviarla
