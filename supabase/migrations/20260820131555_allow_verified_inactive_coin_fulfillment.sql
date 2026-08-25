-- coin_products.is_active controls new-sale availability only. Trusted service-role
-- fulfillment may complete a verified historical purchase after deactivation.
create or replace function public.credit_verified_coin_purchase(
	p_user_id uuid,
	p_provider text,
	p_provider_transaction_id text,
	p_product_code text,
	p_reference text default null
)
returns table (
	success boolean,
	status text,
	credited_coins integer,
	new_balance integer,
	payment_order_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product public.coin_products%rowtype;
	v_wallet public.wallets%rowtype;
	v_existing_order public.payment_orders%rowtype;
	v_order_id uuid;
	v_reference text;
begin
	if p_user_id is null then
		return query select false, 'invalid_user'::text, 0, null::integer, null::uuid;
		return;
	end if;

	if not exists (
		select 1
		from auth.users
		where auth.users.id = p_user_id
	) then
		return query select false, 'invalid_user'::text, 0, null::integer, null::uuid;
		return;
	end if;

	if p_provider not in ('google_play', 'apple_store', 'web', 'admin_test') then
		return query select false, 'invalid_provider'::text, 0, null::integer, null::uuid;
		return;
	end if;

	if p_provider_transaction_id is null or btrim(p_provider_transaction_id) = '' then
		return query select false, 'invalid_transaction'::text, 0, null::integer, null::uuid;
		return;
	end if;

	select *
	into v_product
	from public.coin_products
	where public.coin_products.code = p_product_code;

	if not found then
		return query select false, 'invalid_product'::text, 0, null::integer, null::uuid;
		return;
	end if;

	select *
	into v_existing_order
	from public.payment_orders
	where public.payment_orders.provider = p_provider
		and public.payment_orders.provider_transaction_id = p_provider_transaction_id
	for update;

	if found then
		if v_existing_order.user_id is distinct from p_user_id
			or v_existing_order.product_code is distinct from p_product_code then
			return query select false, 'transaction_conflict'::text, 0, null::integer, v_existing_order.id;
			return;
		end if;

		if v_existing_order.status = 'completed'
			and v_existing_order.verification_status = 'verified' then
			select public.wallets.coin_balance
			into new_balance
			from public.wallets
			where public.wallets.user_id = p_user_id;

			return query select true, 'already_processed'::text, 0, new_balance, v_existing_order.id;
			return;
		end if;

		if v_existing_order.status <> 'pending'
			or v_existing_order.verification_status <> 'unverified' then
			return query select false, 'transaction_conflict'::text, 0, null::integer, v_existing_order.id;
			return;
		end if;

		v_order_id := v_existing_order.id;
	end if;

	select *
	into v_wallet
	from public.wallets
	where public.wallets.user_id = p_user_id
	for update;

	if not found then
		insert into public.wallets (user_id)
		values (p_user_id)
		on conflict (user_id) do nothing;

		select *
		into v_wallet
		from public.wallets
		where public.wallets.user_id = p_user_id
		for update;
	end if;

	select *
	into v_existing_order
	from public.payment_orders
	where public.payment_orders.provider = p_provider
		and public.payment_orders.provider_transaction_id = p_provider_transaction_id
	for update;

	if found then
		if v_existing_order.user_id is distinct from p_user_id
			or v_existing_order.product_code is distinct from p_product_code then
			return query select false, 'transaction_conflict'::text, 0, v_wallet.coin_balance, v_existing_order.id;
			return;
		end if;

		if v_existing_order.status = 'completed'
			and v_existing_order.verification_status = 'verified' then
			return query select true, 'already_processed'::text, 0, v_wallet.coin_balance, v_existing_order.id;
			return;
		end if;

		if v_existing_order.status <> 'pending'
			or v_existing_order.verification_status <> 'unverified' then
			return query select false, 'transaction_conflict'::text, 0, v_wallet.coin_balance, v_existing_order.id;
			return;
		end if;

		v_order_id := v_existing_order.id;
	end if;

	if v_order_id is not null then
		update public.payment_orders
		set
			coin_amount = v_product.coin_amount,
			status = 'completed',
			verification_status = 'verified',
			verified_at = now(),
			completed_at = now()
		where public.payment_orders.id = v_order_id
		returning public.payment_orders.id into v_order_id;
	else
		insert into public.payment_orders (
			user_id,
			provider,
			provider_transaction_id,
			product_code,
			coin_amount,
			status,
			verification_status,
			verified_at,
			completed_at
		)
		values (
			p_user_id,
			p_provider,
			p_provider_transaction_id,
			v_product.code,
			v_product.coin_amount,
			'completed',
			'verified',
			now(),
			now()
		)
		on conflict (provider, provider_transaction_id) where provider_transaction_id is not null
		do nothing
		returning public.payment_orders.id into v_order_id;

		if v_order_id is null then
			select *
			into v_existing_order
			from public.payment_orders
			where public.payment_orders.provider = p_provider
				and public.payment_orders.provider_transaction_id = p_provider_transaction_id;

			if v_existing_order.user_id is distinct from p_user_id
				or v_existing_order.product_code is distinct from p_product_code then
				return query select false, 'transaction_conflict'::text, 0, v_wallet.coin_balance, v_existing_order.id;
				return;
			end if;

			return query select true, 'already_processed'::text, 0, v_wallet.coin_balance, v_existing_order.id;
			return;
		end if;
	end if;

	if exists (
		select 1
		from public.coin_transactions
		where public.coin_transactions.payment_order_id = v_order_id
			and public.coin_transactions.transaction_type = 'credit'
	) then
		select public.wallets.coin_balance
		into new_balance
		from public.wallets
		where public.wallets.user_id = p_user_id;

		return query select true, 'already_processed'::text, 0, new_balance, v_order_id;
		return;
	end if;

	update public.wallets
	set coin_balance = public.wallets.coin_balance + v_product.coin_amount
	where public.wallets.user_id = p_user_id
	returning public.wallets.coin_balance into new_balance;

	v_reference := coalesce(
		nullif(p_reference, ''),
		p_provider || ':' || p_provider_transaction_id
	);

	insert into public.coin_transactions (
		user_id,
		amount,
		transaction_type,
		payment_order_id,
		reference
	)
	values (
		p_user_id,
		v_product.coin_amount,
		'credit',
		v_order_id,
		v_reference
	);

	return query select true, 'credited'::text, v_product.coin_amount, new_balance, v_order_id;
end;
$$;

revoke all on function public.credit_verified_coin_purchase(uuid, text, text, text, text) from public;
revoke all on function public.credit_verified_coin_purchase(uuid, text, text, text, text) from anon;
revoke all on function public.credit_verified_coin_purchase(uuid, text, text, text, text) from authenticated;
grant execute on function public.credit_verified_coin_purchase(uuid, text, text, text, text) to service_role;

comment on function public.credit_verified_coin_purchase(uuid, text, text, text, text) is
	'coin_products.is_active controls new-sale availability. Trusted service-role fulfillment may credit a valid historical verified transaction after product deactivation. Android and authenticated clients cannot execute this function.';
