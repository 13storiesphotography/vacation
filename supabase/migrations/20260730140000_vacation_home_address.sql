-- Start-/Heimatadresse am Urlaub für Sprit- und Routenplanung (Anreise + Rückfahrt).
alter table public.vacations
  add column if not exists home_label text,
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision,
  add column if not exists home_maps_url text,
  add column if not exists include_home_in_route boolean not null default true;

comment on column public.vacations.home_label is 'Anzeigename für Start/Zuhause, z. B. Heimatadresse';
comment on column public.vacations.home_maps_url is 'Google-Maps-Link zur Heimat-/Startadresse';
comment on column public.vacations.include_home_in_route is 'Anreise und Rückfahrt in Sprit-/Routenschätzung einrechnen';
