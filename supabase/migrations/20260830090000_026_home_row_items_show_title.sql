-- 026: Multi-Spotlight editorial foundation
-- Adds editorial authority over whether Android should display the canonical
-- title separately from the 9:16 artwork for each Spotlight home_row_item.
--
-- This migration ONLY establishes the new schema field and metadata.
-- It does not seed content, alter Spotlight membership, or change ordering.

alter table public.home_row_items
  add column if not exists show_title boolean not null default true;

comment on column public.home_row_items.show_title is
  'CMS/editorial authority over whether Android should display the canonical title separately from the artwork.';
