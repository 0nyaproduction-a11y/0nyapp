-- Separates parental PIN existence from explicit opt-in content restrictions.
-- Existing PIN rows remain restrictions-off until the user enables restrictions.

alter table public.user_parental_controls
  add column if not exists restrictions_enabled boolean not null default false,
  add column if not exists restriction_threshold text;

alter table public.guest_parental_controls
  add column if not exists restrictions_enabled boolean not null default false,
  add column if not exists restriction_threshold text;

alter table public.user_parental_controls
  drop constraint if exists user_parental_controls_restriction_threshold_check,
  add constraint user_parental_controls_restriction_threshold_check
  check (
    restriction_threshold is null
    or restriction_threshold in ('U/A 13+', 'U/A 16+')
  );

alter table public.user_parental_controls
  drop constraint if exists user_parental_controls_restrictions_enabled_threshold_check,
  add constraint user_parental_controls_restrictions_enabled_threshold_check
  check (
    restrictions_enabled = false
    or restriction_threshold is not null
  );

alter table public.guest_parental_controls
  drop constraint if exists guest_parental_controls_restriction_threshold_check,
  add constraint guest_parental_controls_restriction_threshold_check
  check (
    restriction_threshold is null
    or restriction_threshold in ('U/A 13+', 'U/A 16+')
  );

alter table public.guest_parental_controls
  drop constraint if exists guest_parental_controls_restrictions_enabled_threshold_check,
  add constraint guest_parental_controls_restrictions_enabled_threshold_check
  check (
    restrictions_enabled = false
    or restriction_threshold is not null
  );
