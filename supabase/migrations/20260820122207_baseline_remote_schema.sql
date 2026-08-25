


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."credit_verified_coin_purchase"("p_user_id" "uuid", "p_provider" "text", "p_provider_transaction_id" "text", "p_product_code" "text", "p_reference" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "status" "text", "credited_coins" integer, "new_balance" integer, "payment_order_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
  where public.coin_products.code = p_product_code
    and public.coin_products.active = true;

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


ALTER FUNCTION "public"."credit_verified_coin_purchase"("p_user_id" "uuid", "p_provider" "text", "p_provider_transaction_id" "text", "p_product_code" "text", "p_reference" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."credit_verified_coin_purchase"("p_user_id" "uuid", "p_provider" "text", "p_provider_transaction_id" "text", "p_product_code" "text", "p_reference" "text") IS 'The service_role credential must only be used by trusted server/provider verification infrastructure, never browser/mobile client code. Android: Google Play Billing purchase -> backend token verification -> wallet credited. iOS: StoreKit purchase -> backend App Store verification -> wallet credited. Web: payment provider webhook/server verification -> wallet credited.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_episode_with_coins"("p_episode_id" "uuid") RETURNS TABLE("success" boolean, "status" "text", "remaining_balance" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_episode public.episodes%rowtype;
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated'::text, null::integer;
    return;
  end if;

  select *
  into v_episode
  from public.episodes
  where public.episodes.id = p_episode_id
    and public.episodes.status = 'published'
    and exists (
      select 1
      from public.series
      where public.series.id = public.episodes.series_id
        and public.series.status = 'published'
    );

  if not found then
    return query select false, 'invalid_episode'::text, null::integer;
    return;
  end if;

  if v_episode.is_free then
    select public.wallets.coin_balance
    into remaining_balance
    from public.wallets
    where public.wallets.user_id = v_user_id;

    return query select true, 'already_accessible'::text, remaining_balance;
    return;
  end if;

  if exists (
    select 1
    from public.episode_entitlements
    where public.episode_entitlements.user_id = v_user_id
      and public.episode_entitlements.episode_id = p_episode_id
      and (
        public.episode_entitlements.expires_at is null
        or public.episode_entitlements.expires_at > now()
      )
  ) then
    select public.wallets.coin_balance
    into remaining_balance
    from public.wallets
    where public.wallets.user_id = v_user_id;

    return query select true, 'already_owned'::text, remaining_balance;
    return;
  end if;

  if exists (
    select 1
    from public.subscriptions
    where public.subscriptions.user_id = v_user_id
      and public.subscriptions.status = 'active'
      and (
        public.subscriptions.starts_at is null
        or public.subscriptions.starts_at <= now()
      )
      and (
        public.subscriptions.ends_at is null
        or public.subscriptions.ends_at > now()
      )
  ) then
    select public.wallets.coin_balance
    into remaining_balance
    from public.wallets
    where public.wallets.user_id = v_user_id;

    return query select true, 'active_subscription'::text, remaining_balance;
    return;
  end if;

  if v_episode.coin_price <= 0 then
    return query select false, 'invalid_episode'::text, null::integer;
    return;
  end if;

  select *
  into v_wallet
  from public.wallets
  where public.wallets.user_id = v_user_id
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    select *
    into v_wallet
    from public.wallets
    where public.wallets.user_id = v_user_id
    for update;
  end if;

  if exists (
    select 1
    from public.episode_entitlements
    where public.episode_entitlements.user_id = v_user_id
      and public.episode_entitlements.episode_id = p_episode_id
      and (
        public.episode_entitlements.expires_at is null
        or public.episode_entitlements.expires_at > now()
      )
  ) then
    return query select true, 'already_owned'::text, v_wallet.coin_balance;
    return;
  end if;

  if v_wallet.coin_balance < v_episode.coin_price then
    return query select false, 'insufficient_balance'::text, v_wallet.coin_balance;
    return;
  end if;

  update public.wallets
  set coin_balance = public.wallets.coin_balance - v_episode.coin_price
  where public.wallets.user_id = v_user_id
  returning public.wallets.coin_balance into remaining_balance;

  insert into public.coin_transactions (
    user_id,
    amount,
    transaction_type,
    episode_id,
    reference
  )
  values (
    v_user_id,
    -v_episode.coin_price,
    'episode_purchase',
    p_episode_id,
    'episode_purchase'
  );

  insert into public.episode_entitlements (
    user_id,
    episode_id,
    source,
    expires_at
  )
  values (
    v_user_id,
    p_episode_id,
    'purchase',
    null
  )
  on conflict (user_id, episode_id) do update
  set
    source = 'purchase',
    expires_at = null;

  return query select true, 'purchase_success'::text, remaining_balance;
end;
$$;


ALTER FUNCTION "public"."purchase_episode_with_coins"("p_episode_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."coin_products" (
    "code" "text" NOT NULL,
    "coin_amount" integer NOT NULL,
    "display_name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coin_products_coin_amount_check" CHECK (("coin_amount" > 0))
);


ALTER TABLE "public"."coin_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."coin_products" IS 'Development placeholder coin packs only. Final Android, iOS, and web pricing will come from store or payment-provider product configuration.';



CREATE TABLE IF NOT EXISTS "public"."coin_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "amount" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "episode_id" "uuid",
    "reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_order_id" "uuid",
    CONSTRAINT "coin_transactions_check" CHECK (((("transaction_type" = 'episode_purchase'::"text") AND ("amount" < 0)) OR (("transaction_type" = ANY (ARRAY['credit'::"text", 'refund'::"text", 'promo'::"text"])) AND ("amount" > 0)))),
    CONSTRAINT "coin_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['credit'::"text", 'episode_purchase'::"text", 'refund'::"text", 'promo'::"text"])))
);


ALTER TABLE "public"."coin_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."episode_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "episode_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "episode_entitlements_source_check" CHECK (("source" = ANY (ARRAY['purchase'::"text", 'rewarded_ad'::"text", 'promo'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."episode_entitlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."episode_entitlements" IS 'Future trusted grant flows must upsert the single entitlement row for a user and episode. rewarded_ad or promo may later be replaced by purchase, and purchase may clear expires_at for permanent ownership.';



CREATE TABLE IF NOT EXISTS "public"."episodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "series_id" "uuid" NOT NULL,
    "episode_number" integer NOT NULL,
    "title" "text",
    "synopsis" "text",
    "duration_seconds" integer DEFAULT 0 NOT NULL,
    "thumbnail_url" "text",
    "video_asset_id" "text",
    "is_free" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "coin_price" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "episodes_coin_price_check" CHECK (("coin_price" >= 0)),
    CONSTRAINT "episodes_duration_seconds_check" CHECK (("duration_seconds" >= 0)),
    CONSTRAINT "episodes_episode_number_check" CHECK (("episode_number" > 0)),
    CONSTRAINT "episodes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."episodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "provider" "text" NOT NULL,
    "provider_order_id" "text",
    "provider_transaction_id" "text",
    "product_code" "text" NOT NULL,
    "coin_amount" integer NOT NULL,
    "amount_minor" integer,
    "currency" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_orders_coin_amount_check" CHECK (("coin_amount" > 0)),
    CONSTRAINT "payment_orders_provider_check" CHECK (("provider" = ANY (ARRAY['google_play'::"text", 'apple_store'::"text", 'web'::"text", 'admin_test'::"text"]))),
    CONSTRAINT "payment_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "payment_orders_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."payment_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "synopsis" "text",
    "genre" "text",
    "language" "text" DEFAULT 'Hindi'::"text",
    "format" "text",
    "episode_count" integer DEFAULT 0 NOT NULL,
    "episode_duration_label" "text",
    "poster_url" "text",
    "hero_image_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "series_episode_count_check" CHECK (("episode_count" >= 0)),
    CONSTRAINT "series_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."series" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "plan_code" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscriptions_check" CHECK ((("starts_at" IS NULL) OR ("ends_at" IS NULL) OR ("ends_at" > "starts_at"))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['inactive'::"text", 'active'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "user_id" "uuid" NOT NULL,
    "coin_balance" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallets_coin_balance_check" CHECK (("coin_balance" >= 0))
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watch_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "series_slug" "text" NOT NULL,
    "episode_number" integer NOT NULL,
    "position_seconds" integer DEFAULT 0 NOT NULL,
    "duration_seconds" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "last_watched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watch_progress_duration_seconds_check" CHECK (("duration_seconds" >= 0)),
    CONSTRAINT "watch_progress_episode_number_check" CHECK (("episode_number" > 0)),
    CONSTRAINT "watch_progress_position_seconds_check" CHECK (("position_seconds" >= 0))
);


ALTER TABLE "public"."watch_progress" OWNER TO "postgres";


ALTER TABLE ONLY "public"."coin_products"
    ADD CONSTRAINT "coin_products_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episode_entitlements"
    ADD CONSTRAINT "episode_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episode_entitlements"
    ADD CONSTRAINT "episode_entitlements_user_id_episode_id_key" UNIQUE ("user_id", "episode_id");



ALTER TABLE ONLY "public"."episodes"
    ADD CONSTRAINT "episodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episodes"
    ADD CONSTRAINT "episodes_series_id_episode_number_key" UNIQUE ("series_id", "episode_number");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."series"
    ADD CONSTRAINT "series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."series"
    ADD CONSTRAINT "series_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."watch_progress"
    ADD CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."watch_progress"
    ADD CONSTRAINT "watch_progress_user_id_series_slug_episode_number_key" UNIQUE ("user_id", "series_slug", "episode_number");



CREATE INDEX "coin_products_active_sort_order_idx" ON "public"."coin_products" USING "btree" ("active", "sort_order");



CREATE UNIQUE INDEX "coin_transactions_one_credit_per_payment_order_idx" ON "public"."coin_transactions" USING "btree" ("payment_order_id") WHERE (("transaction_type" = 'credit'::"text") AND ("payment_order_id" IS NOT NULL));



CREATE INDEX "coin_transactions_user_created_at_idx" ON "public"."coin_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "coin_transactions_user_episode_purchase_idx" ON "public"."coin_transactions" USING "btree" ("user_id", "episode_id", "created_at" DESC) WHERE ("transaction_type" = 'episode_purchase'::"text");



CREATE INDEX "episodes_status_idx" ON "public"."episodes" USING "btree" ("status");



CREATE INDEX "payment_orders_pending_verification_idx" ON "public"."payment_orders" USING "btree" ("provider", "created_at") WHERE (("status" = 'pending'::"text") AND ("verification_status" = 'unverified'::"text"));



CREATE UNIQUE INDEX "payment_orders_provider_transaction_unique_idx" ON "public"."payment_orders" USING "btree" ("provider", "provider_transaction_id") WHERE ("provider_transaction_id" IS NOT NULL);



CREATE INDEX "payment_orders_user_created_at_idx" ON "public"."payment_orders" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "series_status_sort_order_idx" ON "public"."series" USING "btree" ("status", "sort_order");



CREATE UNIQUE INDEX "subscriptions_one_active_per_user_idx" ON "public"."subscriptions" USING "btree" ("user_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "watch_progress_user_active_recent_idx" ON "public"."watch_progress" USING "btree" ("user_id", "last_watched_at" DESC) WHERE ("completed" = false);



CREATE INDEX "watch_progress_user_recent_idx" ON "public"."watch_progress" USING "btree" ("user_id", "last_watched_at" DESC);



CREATE OR REPLACE TRIGGER "set_coin_products_updated_at" BEFORE UPDATE ON "public"."coin_products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_episodes_updated_at" BEFORE UPDATE ON "public"."episodes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_payment_orders_updated_at" BEFORE UPDATE ON "public"."payment_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_series_updated_at" BEFORE UPDATE ON "public"."series" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_wallets_updated_at" BEFORE UPDATE ON "public"."wallets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_watch_progress_updated_at" BEFORE UPDATE ON "public"."watch_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."episode_entitlements"
    ADD CONSTRAINT "episode_entitlements_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."episode_entitlements"
    ADD CONSTRAINT "episode_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."episodes"
    ADD CONSTRAINT "episodes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_product_code_fkey" FOREIGN KEY ("product_code") REFERENCES "public"."coin_products"("code");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."watch_progress"
    ADD CONSTRAINT "watch_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can create their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can create their own watch progress" ON "public"."watch_progress" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own watch progress" ON "public"."watch_progress" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own coin transactions" ON "public"."coin_transactions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own episode entitlements" ON "public"."episode_entitlements" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own payment orders" ON "public"."payment_orders" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read their own subscriptions" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own wallet" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own watch progress" ON "public"."watch_progress" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own watch progress" ON "public"."watch_progress" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Viewers can read active coin products" ON "public"."coin_products" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



CREATE POLICY "Viewers can read published episodes" ON "public"."episodes" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."series"
  WHERE (("series"."id" = "episodes"."series_id") AND ("series"."status" = 'published'::"text"))))));



CREATE POLICY "Viewers can read published series" ON "public"."series" FOR SELECT TO "authenticated", "anon" USING (("status" = 'published'::"text"));



ALTER TABLE "public"."coin_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coin_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."episode_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."episodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."watch_progress" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."credit_verified_coin_purchase"("p_user_id" "uuid", "p_provider" "text", "p_provider_transaction_id" "text", "p_product_code" "text", "p_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."credit_verified_coin_purchase"("p_user_id" "uuid", "p_provider" "text", "p_provider_transaction_id" "text", "p_product_code" "text", "p_reference" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."purchase_episode_with_coins"("p_episode_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purchase_episode_with_coins"("p_episode_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."purchase_episode_with_coins"("p_episode_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."purchase_episode_with_coins"("p_episode_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."coin_products" TO "service_role";
GRANT SELECT ON TABLE "public"."coin_products" TO "anon";
GRANT SELECT ON TABLE "public"."coin_products" TO "authenticated";



GRANT ALL ON TABLE "public"."coin_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."coin_transactions" TO "authenticated";



GRANT ALL ON TABLE "public"."episode_entitlements" TO "service_role";
GRANT SELECT ON TABLE "public"."episode_entitlements" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."episodes" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."episodes" TO "authenticated";
GRANT ALL ON TABLE "public"."episodes" TO "service_role";



GRANT ALL ON TABLE "public"."payment_orders" TO "service_role";
GRANT SELECT ON TABLE "public"."payment_orders" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."series" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."series" TO "authenticated";
GRANT ALL ON TABLE "public"."series" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";
GRANT SELECT ON TABLE "public"."subscriptions" TO "authenticated";



GRANT ALL ON TABLE "public"."wallets" TO "service_role";
GRANT SELECT ON TABLE "public"."wallets" TO "authenticated";



GRANT ALL ON TABLE "public"."watch_progress" TO "anon";
GRANT ALL ON TABLE "public"."watch_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."watch_progress" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "Viewers can read active coin products" on "public"."coin_products";

drop policy "Viewers can read published episodes" on "public"."episodes";

drop policy "Viewers can read published series" on "public"."series";

revoke delete on table "public"."coin_products" from "anon";

revoke insert on table "public"."coin_products" from "anon";

revoke references on table "public"."coin_products" from "anon";

revoke trigger on table "public"."coin_products" from "anon";

revoke truncate on table "public"."coin_products" from "anon";

revoke update on table "public"."coin_products" from "anon";

revoke delete on table "public"."coin_products" from "authenticated";

revoke insert on table "public"."coin_products" from "authenticated";

revoke references on table "public"."coin_products" from "authenticated";

revoke trigger on table "public"."coin_products" from "authenticated";

revoke truncate on table "public"."coin_products" from "authenticated";

revoke update on table "public"."coin_products" from "authenticated";

revoke delete on table "public"."coin_transactions" from "anon";

revoke insert on table "public"."coin_transactions" from "anon";

revoke references on table "public"."coin_transactions" from "anon";

revoke select on table "public"."coin_transactions" from "anon";

revoke trigger on table "public"."coin_transactions" from "anon";

revoke truncate on table "public"."coin_transactions" from "anon";

revoke update on table "public"."coin_transactions" from "anon";

revoke delete on table "public"."coin_transactions" from "authenticated";

revoke insert on table "public"."coin_transactions" from "authenticated";

revoke references on table "public"."coin_transactions" from "authenticated";

revoke trigger on table "public"."coin_transactions" from "authenticated";

revoke truncate on table "public"."coin_transactions" from "authenticated";

revoke update on table "public"."coin_transactions" from "authenticated";

revoke delete on table "public"."episode_entitlements" from "anon";

revoke insert on table "public"."episode_entitlements" from "anon";

revoke references on table "public"."episode_entitlements" from "anon";

revoke select on table "public"."episode_entitlements" from "anon";

revoke trigger on table "public"."episode_entitlements" from "anon";

revoke truncate on table "public"."episode_entitlements" from "anon";

revoke update on table "public"."episode_entitlements" from "anon";

revoke delete on table "public"."episode_entitlements" from "authenticated";

revoke insert on table "public"."episode_entitlements" from "authenticated";

revoke references on table "public"."episode_entitlements" from "authenticated";

revoke trigger on table "public"."episode_entitlements" from "authenticated";

revoke truncate on table "public"."episode_entitlements" from "authenticated";

revoke update on table "public"."episode_entitlements" from "authenticated";

revoke delete on table "public"."episodes" from "anon";

revoke insert on table "public"."episodes" from "anon";

revoke update on table "public"."episodes" from "anon";

revoke delete on table "public"."episodes" from "authenticated";

revoke insert on table "public"."episodes" from "authenticated";

revoke update on table "public"."episodes" from "authenticated";

revoke delete on table "public"."payment_orders" from "anon";

revoke insert on table "public"."payment_orders" from "anon";

revoke references on table "public"."payment_orders" from "anon";

revoke select on table "public"."payment_orders" from "anon";

revoke trigger on table "public"."payment_orders" from "anon";

revoke truncate on table "public"."payment_orders" from "anon";

revoke update on table "public"."payment_orders" from "anon";

revoke delete on table "public"."payment_orders" from "authenticated";

revoke insert on table "public"."payment_orders" from "authenticated";

revoke references on table "public"."payment_orders" from "authenticated";

revoke trigger on table "public"."payment_orders" from "authenticated";

revoke truncate on table "public"."payment_orders" from "authenticated";

revoke update on table "public"."payment_orders" from "authenticated";

revoke delete on table "public"."series" from "anon";

revoke insert on table "public"."series" from "anon";

revoke update on table "public"."series" from "anon";

revoke delete on table "public"."series" from "authenticated";

revoke insert on table "public"."series" from "authenticated";

revoke update on table "public"."series" from "authenticated";

revoke delete on table "public"."subscriptions" from "anon";

revoke insert on table "public"."subscriptions" from "anon";

revoke references on table "public"."subscriptions" from "anon";

revoke select on table "public"."subscriptions" from "anon";

revoke trigger on table "public"."subscriptions" from "anon";

revoke truncate on table "public"."subscriptions" from "anon";

revoke update on table "public"."subscriptions" from "anon";

revoke delete on table "public"."subscriptions" from "authenticated";

revoke insert on table "public"."subscriptions" from "authenticated";

revoke references on table "public"."subscriptions" from "authenticated";

revoke trigger on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."subscriptions" from "authenticated";

revoke update on table "public"."subscriptions" from "authenticated";

revoke delete on table "public"."wallets" from "anon";

revoke insert on table "public"."wallets" from "anon";

revoke references on table "public"."wallets" from "anon";

revoke select on table "public"."wallets" from "anon";

revoke trigger on table "public"."wallets" from "anon";

revoke truncate on table "public"."wallets" from "anon";

revoke update on table "public"."wallets" from "anon";

revoke delete on table "public"."wallets" from "authenticated";

revoke insert on table "public"."wallets" from "authenticated";

revoke references on table "public"."wallets" from "authenticated";

revoke trigger on table "public"."wallets" from "authenticated";

revoke truncate on table "public"."wallets" from "authenticated";

revoke update on table "public"."wallets" from "authenticated";


  create policy "Viewers can read active coin products"
  on "public"."coin_products"
  as permissive
  for select
  to anon, authenticated
using ((active = true));



  create policy "Viewers can read published episodes"
  on "public"."episodes"
  as permissive
  for select
  to anon, authenticated
using (((status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM public.series
  WHERE ((series.id = episodes.series_id) AND (series.status = 'published'::text))))));



  create policy "Viewers can read published series"
  on "public"."series"
  as permissive
  for select
  to anon, authenticated
using ((status = 'published'::text));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


