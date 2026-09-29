-- SQL CHECK accepts NULL; require complete coordinate pairs explicitly.
alter table public.tools drop constraint tools_coordinates_valid;
alter table public.tools add constraint tools_coordinates_valid check (
 (approximate_lat is null and approximate_lng is null) or
 (approximate_lat is not null and approximate_lng is not null and approximate_lat between -90 and 90 and approximate_lng between -180 and 180));
-- Canonical bounds also apply to direct API updates, not only HTML controls.
alter table public.profiles add constraint profiles_location_lengths check(char_length(neighborhood)<=80 and char_length(city)<=80 and char_length(state)<=40);
alter table public.messages add constraint messages_not_blank check(char_length(btrim(body))>0);
