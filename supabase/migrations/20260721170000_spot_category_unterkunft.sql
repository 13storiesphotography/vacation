-- Add Unterkunft category for Airbnb / hotels (overnight-capable).
alter type public.spot_category add value if not exists 'unterkunft';
