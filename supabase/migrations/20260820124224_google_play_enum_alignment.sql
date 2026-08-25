alter table public.google_play_purchases
	drop constraint google_play_purchases_google_consumption_state_check;

alter table public.google_play_purchases
	add constraint google_play_purchases_google_consumption_state_canonical_check
	check (
		google_consumption_state is null
		or google_consumption_state in (
			'CONSUMPTION_STATE_UNSPECIFIED',
			'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
			'CONSUMPTION_STATE_CONSUMED'
		)
	);

alter table public.google_play_purchases
	drop constraint google_play_purchases_google_acknowledgement_state_check;

alter table public.google_play_purchases
	add constraint google_play_purchases_google_acknowledgement_state_canonical_check
	check (
		google_acknowledgement_state is null
		or google_acknowledgement_state in (
			'ACKNOWLEDGEMENT_STATE_UNSPECIFIED',
			'ACKNOWLEDGEMENT_STATE_PENDING',
			'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
		)
	);
