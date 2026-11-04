-- pgTAP · fusionar fichas cuando una compró una tarjeta de regalo (REQ-018.5, REQ-055.3, design §15.1)
-- Antes de 0056 el delete de la ficha fusionada chocaba con gift_cards.buyer_customer_id (llave
-- foránea sin on delete): no se podía fusionar a nadie que hubiera comprado una tarjeta.
begin;
select plan(5);

create temp table ctx as
select b.id as biz from businesses b where b.slug = 'la-33';
grant select on ctx to public;

insert into customers (business_id, phone_e164, name)
select biz, '+573009970001', 'Queda' from ctx;

-- La venta de la tarjeta crea la ficha de quien compra (REQ-055.3)
create temp table g as
select sell_gift_card((select biz from ctx), 30000, '+573009970002', 'Compra', 'Lucía',
                      '[{"method":"cash","amount":30000}]'::jsonb) as card;
grant select on g to public;

select is((select count(*)::int from gift_cards gc join customers c on c.id = gc.buyer_customer_id
           where c.phone_e164 = '+573009970002'), 1,
  'REQ-055.3 la tarjeta queda a nombre de la ficha de quien compra');

select lives_ok(
  $$ select merge_customers((select id from customers where phone_e164 = '+573009970001'),
                            (select id from customers where phone_e164 = '+573009970002')) $$,
  'REQ-018.5 se fusiona la ficha de alguien que compró una tarjeta de regalo');

select is((select c.phone_e164 from gift_cards gc join customers c on c.id = gc.buyer_customer_id
           where gc.id = ((select card from g) ->> 'giftCardId')::uuid), '+573009970001',
  'REQ-018.5 la tarjeta pasa a la ficha que queda');

select is(gift_card_balance(((select card from g) ->> 'giftCardId')::uuid), 30000,
  'REQ-018.5 el saldo de la tarjeta no cambia');

select is((select count(*)::int from gift_cards_list((select biz from ctx))
           where id = ((select card from g) ->> 'giftCardId')::uuid and buyer_name = 'Queda'), 1,
  'REQ-059.3 la lista del dueño muestra la ficha que queda como quien compró');

select * from finish();
rollback;
