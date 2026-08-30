-- 023: Home Spotlight Foundation
-- Expands home_rows.row_role check constraint to include 'spotlight'
-- Adds unique index on spotlight role to ensure single canonical spotlight row

alter table public.home_rows drop constraint if exists home_rows_row_role_check;
alter table public.home_rows add constraint home_rows_row_role_check check (row_role in ('start_here', 'editorial', 'spotlight'));

create unique index if not exists home_rows_spotlight_unique_idx
  on public.home_rows (row_role)
  where row_role = 'spotlight';

insert into public.home_rows (title, row_role, enabled, sort_order)
select 'Spotlight', 'spotlight', true, 0
where not exists (
  select 1 from public.home_rows where row_role = 'spotlight'
);
