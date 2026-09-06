alter table public.episodes
  drop constraint if exists episodes_locked_preview_seconds_check,
  drop constraint if exists episodes_preview_seconds_check;

alter table public.episodes
  add constraint episodes_locked_preview_seconds_check
    check (locked_preview_seconds between 0 and 5);
