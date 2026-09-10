-- 031: Disable superseded editorial category shelves
--
-- The legacy editorial "Micro Dramas" and "Short Films" shelves were created
-- before the automatic category rows introduced in 030. While both are
-- enabled they render alongside the category rows, producing duplicate Home
-- rows, forcing a non-category order, and letting manual editorial items leak
-- into shelves they do not belong to (e.g. a series inside a Short Films row).
--
-- Where an enabled category row of the same title already exists, the legacy
-- editorial shelf is retired (disabled) so the automatic category row remains
-- the single source for that Home row. The rows are not deleted: disabling is
-- reversible and keeps the CMS editorial history intact.
--
-- Idempotent: rows already disabled are not re-touched and a second run is a
-- no-op. Title-scoped (no ID hardcoding) and only fires when a live category
-- replacement exists.

update public.home_rows as legacy
set enabled = false
where legacy.row_role = 'editorial'
  and legacy.enabled = true
  and legacy.title in ('Micro Dramas', 'Short Films')
  and exists (
    select 1
    from public.home_rows as active_category
    where active_category.row_role = 'category'
      and active_category.enabled = true
      and active_category.title = legacy.title
  );