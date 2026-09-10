-- 030: Home Category Rows
-- Expands home_rows.row_role check constraint to include 'category'
-- Category rows auto-populate their items from the authoritative catalog
-- (all eligible published series for "Micro Dramas", all eligible published
-- short films for "Short Films"). Manual home_row_items membership must NOT
-- control category row contents.

alter table public.home_rows drop constraint if exists home_rows_row_role_check;
alter table public.home_rows add constraint home_rows_row_role_check
  check (row_role in ('start_here', 'editorial', 'spotlight', 'category'));

-- Seed category rows. Micro Dramas must appear above Short Films.
-- ON CONFLICT keeps the migration idempotent; existing rows are untouched.
insert into public.home_rows (title, row_role, enabled, sort_order)
select 'Micro Dramas', 'category', true, 100
where not exists (
  select 1 from public.home_rows where row_role = 'category' and title = 'Micro Dramas'
);

insert into public.home_rows (title, row_role, enabled, sort_order)
select 'Short Films', 'category', true, 110
where not exists (
  select 1 from public.home_rows where row_role = 'category' and title = 'Short Films'
);
