-- Launch commercial configuration: 0nya coin packs.
-- Source of truth for coin-pack quantity is public.coin_products.
-- Localized prices (₹29 / ₹49 / ₹99 / ₹199) live in Google Play / store
-- product metadata and are NOT stored here; they remain externally configured
-- and server/store-driven. See 0nya_PRODUCT_UIUX_BIBLE_v3.0.md.
-- Idempotent so it is safe to re-run on existing databases.

insert into public.coin_products (code, coin_amount, display_name, active, sort_order)
values
  ('coins_30', 30, '30 coins', true, 5),
  ('coins_50', 50, '50 coins', true, 10),
  ('coins_100', 100, '100 coins', true, 20),
  ('coins_250', 250, '250 coins', true, 30)
on conflict (code) do nothing;

-- Guarantee correct launch sort order even if rows predate this migration.
update public.coin_products
  set sort_order = 5
  where code = 'coins_30';

update public.coin_products
  set sort_order = 10
  where code = 'coins_50';

update public.coin_products
  set sort_order = 20
  where code = 'coins_100';

update public.coin_products
  set sort_order = 30
  where code = 'coins_250';
