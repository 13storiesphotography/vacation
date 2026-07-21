import { fetchAirbnbMetadata, isAirbnbUrl } from "@/lib/airbnb";
import { enrichFromMapsUrl, parseLatLngFromMapsUrl } from "@/lib/geo";
import { fetchPageMetadata } from "@/lib/link-metadata";
import {
  detectLinkProvider,
  providerLabels,
  suggestedCategoryForProvider,
  type LinkProvider,
} from "@/lib/link-provider";
import type { OvernightCost, SpotCategory } from "@/lib/spots";

export type SmartLinkResult = {
  ok: boolean;
  message: string;
  provider: LinkProvider;
  providerLabel: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  locationHint: string | null;
  mapsUrl: string | null;
  infoUrl: string | null;
  lat: number | null;
  lng: number | null;
  suggestedCategory: SpotCategory;
  overnightCost: OvernightCost | null;
};

function emptyResult(message: string, provider: LinkProvider = "unknown"): SmartLinkResult {
  return {
    ok: false,
    message,
    provider,
    providerLabel: providerLabels[provider],
    title: null,
    description: null,
    imageUrl: null,
    locationHint: null,
    mapsUrl: null,
    infoUrl: null,
    lat: null,
    lng: null,
    suggestedCategory: "ort",
    overnightCost: null,
  };
}

function summarize(parts: Array<string | null | undefined>): string {
  const clean = parts.filter(Boolean) as string[];
  return clean.length ? clean.join(" · ") : "Link erkannt — Felder ggf. manuell ergänzen.";
}

/** Detect link type and enrich as much spot data as possible. */
export async function enrichSmartLink(rawUrl: string): Promise<SmartLinkResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return emptyResult("Link einfügen — Google Maps, Airbnb, Park4Night, …");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return emptyResult("Bitte einen gültigen https://-Link einfügen.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return emptyResult("Bitte einen https://-Link einfügen.");
  }

  const provider = detectLinkProvider(trimmed);
  const providerLabel = providerLabels[provider];

  if (provider === "google_maps") {
    const local = parseLatLngFromMapsUrl(trimmed);
    const enriched = await enrichFromMapsUrl(trimmed);
    const coords = enriched.coords ?? local;
    if (!coords) {
      return {
        ...emptyResult(
          "Google Maps erkannt, aber keine Position im Link. Ort öffnen und „Link teilen“ nutzen.",
          provider,
        ),
        mapsUrl: trimmed,
      };
    }
    const title = enriched.title;
    const suggestedCategory = suggestedCategoryForProvider(provider, title, null);
    return {
      ok: true,
      message: summarize([
        providerLabel,
        title,
        `Position ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
        enriched.imageUrl ? "Bild" : null,
      ]),
      provider,
      providerLabel,
      title,
      description: null,
      imageUrl: enriched.imageUrl,
      locationHint: null,
      mapsUrl: enriched.resolvedUrl || trimmed,
      infoUrl: null,
      lat: coords.lat,
      lng: coords.lng,
      suggestedCategory,
      overnightCost: suggestedCategory === "stellplatz" ? null : null,
    };
  }

  if (provider === "airbnb" || isAirbnbUrl(trimmed)) {
    const meta = await fetchAirbnbMetadata(trimmed);
    if (!meta.ok) {
      return {
        ...emptyResult(meta.message, "airbnb"),
        infoUrl: trimmed,
        suggestedCategory: "unterkunft",
        overnightCost: "kostenpflichtig",
      };
    }
    const mapsUrl =
      meta.lat != null && meta.lng != null
        ? `https://www.google.com/maps?q=${meta.lat},${meta.lng}`
        : null;
    return {
      ok: true,
      message: summarize([
        providerLabel,
        meta.title,
        meta.locationHint,
        mapsUrl ? "Position" : null,
        meta.imageUrl ? "Bild" : null,
      ]),
      provider: "airbnb",
      providerLabel,
      title: meta.title,
      description: meta.description,
      imageUrl: meta.imageUrl,
      locationHint: meta.locationHint,
      mapsUrl,
      infoUrl: meta.canonicalUrl || trimmed,
      lat: meta.lat,
      lng: meta.lng,
      suggestedCategory: "unterkunft",
      overnightCost: "kostenpflichtig",
    };
  }

  const page = await fetchPageMetadata(trimmed);
  const suggestedCategory = suggestedCategoryForProvider(
    provider,
    page.title,
    page.description,
  );
  const hasUseful = Boolean(page.title || page.imageUrl || page.description);
  return {
    ok: hasUseful || provider !== "generic",
    message: hasUseful
      ? summarize([providerLabel, page.title, page.imageUrl ? "Bild" : null])
      : `${providerLabel} erkannt — Name ggf. manuell ergänzen.`,
    provider,
    providerLabel,
    title: page.title,
    description: page.description,
    imageUrl: page.imageUrl,
    locationHint: page.siteName,
    mapsUrl: null,
    infoUrl: page.canonicalUrl || trimmed,
    lat: null,
    lng: null,
    suggestedCategory,
    overnightCost:
      suggestedCategory === "unterkunft" || suggestedCategory === "stellplatz"
        ? suggestedCategory === "unterkunft"
          ? "kostenpflichtig"
          : null
        : null,
  };
}
