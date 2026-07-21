"use server";

import { fetchAirbnbMetadata, isAirbnbUrl } from "@/lib/airbnb";

export type AirbnbPreviewState = {
  ok: boolean;
  message: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  locationHint?: string | null;
  canonicalUrl?: string;
  listingId?: string | null;
};

export async function previewAirbnbListing(url: string): Promise<AirbnbPreviewState> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, message: "Airbnb-Link einfügen." };
  }
  if (!isAirbnbUrl(trimmed)) {
    return { ok: false, message: "Bitte einen Airbnb-Link (/rooms/…) verwenden." };
  }

  const result = await fetchAirbnbMetadata(trimmed);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const bits = [
    result.title ? "Titel" : null,
    result.imageUrl ? "Bild" : null,
    result.locationHint ? result.locationHint : null,
  ].filter(Boolean);

  return {
    ok: true,
    message: bits.length
      ? `Erkannt: ${bits.join(" · ")}`
      : "Airbnb-Link erkannt — Felder ggf. manuell ergänzen.",
    title: result.title,
    description: result.description,
    imageUrl: result.imageUrl,
    locationHint: result.locationHint,
    canonicalUrl: result.canonicalUrl,
    listingId: result.listingId,
  };
}
