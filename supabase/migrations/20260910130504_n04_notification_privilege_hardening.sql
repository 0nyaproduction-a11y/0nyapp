-- N04 forward privilege hardening.
--
-- Client writes to push_devices and notification_preferences are mediated by
-- authenticated backend routes before this migration is deployed. Notification
-- creation, delivery processing, receipt updates, and invalid-device
-- deactivation continue to use the server-only service role.

-- Remove all table-level client privileges, including Supabase defaults such as
-- TRUNCATE, REFERENCES, and TRIGGER. Existing RLS policies remain unchanged as
-- defense in depth and continue to restrict authenticated reads/updates by user_id.
revoke all privileges on table public.notifications from anon, authenticated;
revoke all privileges on table public.push_devices from anon, authenticated;
revoke all privileges on table public.notification_preferences from anon, authenticated;
revoke all privileges on table public.notification_deliveries from anon, authenticated;

-- Authenticated clients may read only rows allowed by the existing ownership
-- SELECT policies. Anonymous clients receive no direct access.
grant select on table public.notifications to authenticated;
grant select on table public.notification_preferences to authenticated;

-- The only direct authenticated write is marking an owned notification read.
-- PostgreSQL still evaluates the existing notification UPDATE policy, including
-- both USING and WITH CHECK ownership predicates.
grant update (read_at) on table public.notifications to authenticated;

-- Preserve the server-only backend path explicitly. service_role bypasses RLS
-- in Supabase and must never be exposed to a client.
grant all privileges on table public.notifications to service_role;
grant all privileges on table public.push_devices to service_role;
grant all privileges on table public.notification_preferences to service_role;
grant all privileges on table public.notification_deliveries to service_role;

-- Fail the migration transaction if the resulting ACL or required RLS baseline
-- differs from the reviewed contract. Runtime route/provider checks still run
-- after deployment; this block intentionally creates no test users or rows.
do $$
declare
  protected_notification_column text;
  protected_notification_columns constant text[] := array[
    'id',
    'user_id',
    'type',
    'title',
    'body',
    'image_url',
    'deep_link',
    'payload',
    'created_at',
    'expires_at'
  ];
  protected_table regclass;
begin
  foreach protected_table in array array[
    'public.notifications'::regclass,
    'public.push_devices'::regclass,
    'public.notification_preferences'::regclass,
    'public.notification_deliveries'::regclass
  ] loop
    if has_table_privilege('anon', protected_table, 'SELECT')
      or has_table_privilege('anon', protected_table, 'INSERT')
      or has_table_privilege('anon', protected_table, 'UPDATE')
      or has_table_privilege('anon', protected_table, 'DELETE')
      or has_table_privilege('anon', protected_table, 'TRUNCATE')
      or has_table_privilege('anon', protected_table, 'REFERENCES')
      or has_table_privilege('anon', protected_table, 'TRIGGER') then
      raise exception 'anon retains a privilege on %', protected_table;
    end if;

    if protected_table = any (array[
      'public.notifications'::regclass,
      'public.notification_preferences'::regclass
    ]) and not has_table_privilege('authenticated', protected_table, 'SELECT') then
      raise exception 'required authenticated SELECT missing on %', protected_table;
    end if;

    if protected_table = any (array[
      'public.push_devices'::regclass,
      'public.notification_deliveries'::regclass
    ]) and has_table_privilege('authenticated', protected_table, 'SELECT') then
      raise exception 'unnecessary authenticated SELECT retained on %', protected_table;
    end if;

    if has_table_privilege('authenticated', protected_table, 'INSERT')
      or has_table_privilege('authenticated', protected_table, 'UPDATE')
      or has_table_privilege('authenticated', protected_table, 'DELETE')
      or has_table_privilege('authenticated', protected_table, 'TRUNCATE')
      or has_table_privilege('authenticated', protected_table, 'REFERENCES')
      or has_table_privilege('authenticated', protected_table, 'TRIGGER') then
      raise exception 'authenticated retains a table-level write/admin privilege on %', protected_table;
    end if;

    if not has_table_privilege('service_role', protected_table, 'SELECT')
      or not has_table_privilege('service_role', protected_table, 'INSERT')
      or not has_table_privilege('service_role', protected_table, 'UPDATE')
      or not has_table_privilege('service_role', protected_table, 'DELETE') then
      raise exception 'service_role DML privilege missing on %', protected_table;
    end if;
  end loop;

  if not has_column_privilege(
    'authenticated',
    'public.notifications',
    'read_at',
    'UPDATE'
  ) then
    raise exception 'authenticated UPDATE(read_at) is missing';
  end if;

  foreach protected_notification_column in array protected_notification_columns loop
    if has_column_privilege(
      'authenticated',
      'public.notifications',
      protected_notification_column,
      'UPDATE'
    ) then
      raise exception
        'authenticated can update protected notifications column %',
        protected_notification_column;
    end if;
  end loop;

  if exists (
    select 1
    from pg_class
    where oid = any (array[
      'public.notifications'::regclass,
      'public.push_devices'::regclass,
      'public.notification_preferences'::regclass,
      'public.notification_deliveries'::regclass
    ])
      and not relrowsecurity
  ) then
    raise exception 'RLS is not enabled on every notification table';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users can read own notifications'
      and cmd = 'SELECT'
      and roles @> array['authenticated'::name]
      and qual like '%user_id%auth.uid()%'
  ) then
    raise exception 'owned notifications SELECT policy is missing or divergent';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users can update own notification read status'
      and cmd = 'UPDATE'
      and roles @> array['authenticated'::name]
      and qual like '%user_id%auth.uid()%'
      and with_check like '%user_id%auth.uid()%'
  ) then
    raise exception 'owned notifications UPDATE policy is missing or divergent';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'push_devices',
        'notification_preferences',
        'notification_deliveries'
      )
      and cmd = 'SELECT'
      and roles @> array['authenticated'::name]
      and qual like '%user_id%auth.uid()%'
  ) <> 3 then
    raise exception 'one or more owned notification SELECT policies are missing or divergent';
  end if;
end
$$;
