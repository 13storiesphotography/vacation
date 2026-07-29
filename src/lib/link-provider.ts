import type { SpotCategory } from "@/lib/spots";

export type LinkProvider =
  | "google_maps"
  | "airbnb"
  | "park4night"
  | "booking"
  | "tripadvisor"
  | "komoot"
  | "outdooractive"
  | "generic"
  | "unknown";

export const providerLabels: Record<LinkProvider, string> = {
  google_maps: "Google Maps",
  airbnb: "Airbnb",
  park4night: "Park4Night",
  booking: "Booking.com",
  tripadvisor: "Tripadvisor",
  komoot: "Komoot",
  outdooractive: "Outdooractive",
  generic: "Webseite",
  unknown: "Link",
};

export function detectLinkProvider(raw: string): LinkProvider {
  const trimmed = raw.trim();
  if (!trimmed) return "unknown";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "unknown";
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    if (
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "g.co" ||
      host.endsWith(".app.goo.gl") ||
      host === "maps.google.com" ||
      host.endsWith(".maps.google.com") ||
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "google.de" ||
      host.endsWith(".google.de")
    ) {
      if (
        host.includes("maps") ||
        path.includes("/maps") ||
        host === "maps.app.goo.gl" ||
        host === "goo.gl" ||
        host === "g.co" ||
        host.endsWith(".app.goo.gl")
      ) {
        return "google_maps";
      }
    }

    if (/(?:^|\.)airbnb\./i.test(host)) return "airbnb";
    if (host.includes("park4night")) return "park4night";
    if (host.includes("booking.com")) return "booking";
    if (host.includes("tripadvisor.")) return "tripadvisor";
    if (host.includes("komoot.")) return "komoot";
    if (host.includes("outdooractive.")) return "outdooractive";
    return "generic";
  } catch {
    return "unknown";
  }
}

export function suggestedCategoryForProvider(
  provider: LinkProvider,
  title?: string | null,
  description?: string | null,
): SpotCategory {
  const haystack = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (provider === "airbnb" || provider === "booking") return "unterkunft";
  if (provider === "park4night") return "stellplatz";
  if (
    /stellplatz|camping|wohnmobil|van stop|motorhome|aires?|campingplatz/.test(
      haystack,
    )
  ) {
    return "stellplatz";
  }
  if (/hotel|apartment|ferienwohnung|airbnb|unterkunft|hostel/.test(haystack)) {
    return "unterkunft";
  }
  if (/museum|kirche|aussicht|waterfall|sehensw|castle|burg|natur/.test(haystack)) {
    return "sehenswuerdigkeit";
  }
  if (/supermarkt|tankstelle|lidl|ica|coop|shop|bäcker|baker/.test(haystack)) {
    return "versorgung";
  }
  if (/wanderung|hike|bike|schwimmen|kayak|freizeit|trail/.test(haystack)) {
    return "freizeit";
  }
  if (provider === "google_maps") return "ort";
  return "ort";
}
