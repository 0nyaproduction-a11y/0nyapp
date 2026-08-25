create or replace function public.enforce_google_play_mapping_immutability()
returns trigger
language plpgsql
as $$
begin
	if (old.provider = 'google_play' or new.provider = 'google_play')
		and (
			old.provider is distinct from new.provider
			or old.provider_product_id is distinct from new.provider_product_id
			or old.product_code is distinct from new.product_code
		) then
		raise exception 'google_play_mapping_identity_immutable';
	end if;

	return new;
end;
$$;

create trigger trg_gp_mapping_identity_immutable
before update on public.payment_provider_products
for each row
execute function public.enforce_google_play_mapping_immutability();

create or replace function public.forbid_gp_mapping_delete()
returns trigger
language plpgsql
as $$
begin
	if old.provider = 'google_play' then
		raise exception 'google_play_mapping_delete_forbidden';
	end if;

	return old;
end;
$$;

create trigger trg_gp_mapping_no_delete
before delete on public.payment_provider_products
for each row
execute function public.forbid_gp_mapping_delete();
