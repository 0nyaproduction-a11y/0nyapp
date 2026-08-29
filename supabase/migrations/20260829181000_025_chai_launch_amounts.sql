-- Launch commercial configuration: 0nya Chai allowed coin amounts.
-- Chai is an 0nya coin tip (same wallet), Short-Film only, not a separate
-- currency. Approved working amounts: 5 / 10 / 20 / 50 coins.
-- The viewer flow renders the enabled rows from chai_allowed_coin_amounts;
-- these are server/CMS-controlled, not hardcoded in the client.
-- Idempotent on the unique (coin_amount) column.

insert into public.chai_allowed_coin_amounts (coin_amount, enabled, sort_order)
values
  (5, true, 10),
  (10, true, 20),
  (20, true, 30),
  (50, true, 40)
on conflict (coin_amount) do update
  set enabled = true,
      sort_order = excluded.sort_order;
