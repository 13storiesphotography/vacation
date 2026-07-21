-- Applied remotely as add_spot_preview_image
alter table public.spots
  add column if not exists image_url text,
  add column if not exists image_manual boolean not null default false;
