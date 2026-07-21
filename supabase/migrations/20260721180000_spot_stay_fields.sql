-- Stay window on overnight spots (Airbnb / Stellplatz)
do $$ begin
  create type public.stay_status as enum ('interessiert', 'gebucht');
exception when duplicate_object then null;
end $$;

alter table public.spots
  add column if not exists stay_check_in date,
  add column if not exists stay_check_out date,
  add column if not exists stay_status public.stay_status;

comment on column public.spots.stay_check_in is 'First night (check-in date)';
comment on column public.spots.stay_check_out is 'Morning of departure; nights are [check_in, check_out)';
comment on column public.spots.stay_status is 'interessiert | gebucht';

alter table public.spots drop constraint if exists spots_stay_range_check;
alter table public.spots
  add constraint spots_stay_range_check
  check (
    (stay_check_in is null and stay_check_out is null)
    or (stay_check_in is not null and stay_check_out is not null and stay_check_out > stay_check_in)
  );
