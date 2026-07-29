-- Optional night count without requiring fixed dates
alter table public.spots
  add column if not exists stay_nights integer;

comment on column public.spots.stay_nights is 'Desired night count; can be set without fixed dates';

alter table public.spots drop constraint if exists spots_stay_nights_check;
alter table public.spots
  add constraint spots_stay_nights_check
  check (stay_nights is null or stay_nights >= 1);
