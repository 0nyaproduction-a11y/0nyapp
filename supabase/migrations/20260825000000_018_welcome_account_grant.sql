create unique index if not exists coin_transactions_user_reference_unique_idx
  on public.coin_transactions (user_id, reference)
  where reference is not null;

create or replace function public.apply_welcome_coin_grant(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  insert into public.wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.coin_transactions (
    user_id,
    amount,
    transaction_type,
    reference
  )
  values (
    p_user_id,
    100,
    'promo',
    'welcome_100_coins'
  )
  on conflict (user_id, reference) do nothing;

  v_inserted := found;

  if not v_inserted then
    return false;
  end if;

  update public.wallets
  set coin_balance = public.wallets.coin_balance + 100
  where public.wallets.user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    avatar_url
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform public.apply_welcome_coin_grant(new.id);

  return new;
end;
$$;

revoke all on function public.apply_welcome_coin_grant(uuid) from public;
revoke all on function public.handle_new_user() from public;
