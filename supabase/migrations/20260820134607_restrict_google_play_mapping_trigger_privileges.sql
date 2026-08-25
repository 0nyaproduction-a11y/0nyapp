revoke all on function public.enforce_google_play_mapping_immutability()
from public;

revoke all on function public.enforce_google_play_mapping_immutability()
from anon, authenticated, service_role;

revoke all on function public.forbid_gp_mapping_delete()
from public;

revoke all on function public.forbid_gp_mapping_delete()
from anon, authenticated, service_role;
