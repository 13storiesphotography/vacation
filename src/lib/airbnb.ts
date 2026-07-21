export type AirbnbMetadata = {
  ok: true;
  provider: "airbnb";
  listingId: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  locationHint: string | null;
  canonicalUrl: string;
  lat: number | null;
  lng: number | null;
};

export type AirbnbMetadataError = {
  ok: false;
  message: string;
};

const AIRBNB_HOST =
  /(?:^|\.)airbnb\.(?:com|co\.uk|de|fr|it|es|nl|at|ch|se|no|dk|fi|pt|ie|ca|com\.au|co\.nz|co\.za|jp|com\.br|com\.mx|cl|com\.ar)$/i;

export function isAirbnbUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return AIRBNB_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export function parseAirbnbListingId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.pathname.match(/\/rooms\/(\d+)/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1].trim());
    }
  }
  return null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/\\u0026/g, "&");
}

export function cleanAirbnbTitle(title: string | null): string | null {
  if (!title) return null;
  let cleaned = title.trim();
  cleaned = cleaned.replace(/\s*[-–|]\s*Airbnb\s*$/i, "");
  cleaned = cleaned.replace(
    /\s*[-–|]\s*(?:Apartments?|Homes?|Places?|Rooms?|Houses?|Cabins?|Condos?|Villas?|Blockhütten).{0,80}$/i,
    "",
  );
  cleaned = cleaned.replace(/\s*[-–|]\s*.{0,40}\s+for Rent in .{0,80}$/i, "");
  cleaned = cleaned.replace(/\s*[-–|]\s*.{0,40}\s+zur Miete in .{0,80}$/i, "");
  // OG titles often look like: "Blockhütte · Alnö · ★5,0 · 2 Schlafzimmer · …"
  if (/·/.test(cleaned) && /★|Schlafzimmer|Betten|Badezimmer|bedroom|beds|bath/i.test(cleaned)) {
    const parts = cleaned
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter(
        (part) =>
          !/★/.test(part) &&
          !/\d+\s*(Schlafzimmer|Betten|Badezimmer|bedroom|beds|bath)/i.test(part) &&
          !/privates?\s+Badezimmer/i.test(part),
      );
    if (parts.length >= 2) {
      cleaned = `${parts[0]} in ${parts[1]}`;
    } else if (parts.length === 1) {
      cleaned = parts[0];
    }
  }
  cleaned = cleaned.trim();
  return cleaned || null;
}

function extractLocationHint(
  title: string | null,
  description: string | null,
): string | null {
  const fromTitle = title?.match(
    /(?:in|in der|bei)\s+([A-ZÀ-ÖØ-Þ][\wÀ-öø-ÿ' -]{1,40})/i,
  );
  if (fromTitle?.[1]) return fromTitle[1].trim();
  const fromDesc = description?.match(
    /(?:located in|in)\s+([A-ZÀ-ÖØ-Þ][\wÀ-öø-ÿ' -]{1,40})/i,
  );
  return fromDesc?.[1]?.trim() ?? null;
}

function unescapeJsonString(value?: string): string | undefined {
  if (!value) return undefined;
  return decodeHtml(
    value
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, " "),
  );
}

function firstJsonString(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const match = html.match(
      new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"),
    );
    if (match?.[1]) {
      const value = unescapeJsonString(match[1]);
      if (value?.trim()) return value.trim();
    }
  }
  return undefined;
}

function firstJsonNumber(html: string, keys: string[]): number | null {
  for (const key of keys) {
    const match = html.match(new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

/**
 * Airbnb no longer always ships `__NEXT_DATA__`; listing fields often live in
 * embedded Niobe/GraphQL JSON. Search the full HTML for known keys.
 */
function extractFromPageData(html: string): {
  title?: string;
  description?: string;
  imageUrl?: string;
  locationHint?: string;
  lat?: number | null;
  lng?: number | null;
} {
  const nextMatch = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  const blob = nextMatch?.[1] ?? html;

  const title = firstJsonString(blob, [
    "listingTitle",
    "seoTitle",
    "shareName",
    "pdpListingTitle",
  ]);
  const description = firstJsonString(blob, ["seoDescription", "sectionedDescription"]);
  const imageUrl =
    firstJsonString(blob, ["pictureUrl"]) ||
    blob.match(/"baseUrl"\s*:\s*"(https:[^"]+muscache[^"]+)"/i)?.[1] ||
    blob.match(
      /"(https:\\\/\\\/a0\.muscache\.com[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    )?.[1];
  const locationHint = firstJsonString(blob, [
    "localizedLocation",
    "localizedCityName",
    "city",
  ]);
  const lat = firstJsonNumber(blob, ["listingLat"]);
  const lng = firstJsonNumber(blob, ["listingLng"]);

  return {
    title,
    description,
    imageUrl: unescapeJsonString(imageUrl)?.replace(/\\\//g, "/"),
    locationHint,
    lat,
    lng,
  };
}

function titleFromDocumentTitle(html: string): string | null {
  const raw = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (!raw) return null;
  return cleanAirbnbTitle(decodeHtml(raw.trim()));
}

/**
 * Fetch public Airbnb listing metadata via Open Graph / embedded page data.
 * Exact address is intentionally not relied on; approximate coords when present.
 */
export async function fetchAirbnbMetadata(
  rawUrl: string,
): Promise<AirbnbMetadata | AirbnbMetadataError> {
  const trimmed = rawUrl.trim();
  if (!isAirbnbUrl(trimmed)) {
    return { ok: false, message: "Das sieht nicht nach einem Airbnb-Link aus." };
  }

  const listingId = parseAirbnbListingId(trimmed);
  let fetchUrl = trimmed;
  if (listingId) {
    try {
      const host = new URL(trimmed).hostname;
      fetchUrl = `https://${host}/rooms/${listingId}`;
    } catch {
      // keep original
    }
  }

  let html = "";
  try {
    const response = await fetch(fetchUrl, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        message: `Airbnb antwortete mit ${response.status}. Titel/Bild ggf. manuell eintragen.`,
      };
    }
    html = await response.text();
  } catch {
    return {
      ok: false,
      message:
        "Airbnb konnte nicht geladen werden. Link speichern und Name/Bild manuell setzen.",
    };
  }

  const fromPage = extractFromPageData(html);
  const ogTitle = metaContent(html, ["og:title", "twitter:title"]);
  const ogDescription = metaContent(html, ["og:description", "twitter:description"]);
  const metaDescription = metaContent(html, ["description"]);
  const ogImage = metaContent(html, ["og:image", "twitter:image", "og:image:url"]);
  const canonical =
    html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    )?.[1] ||
    metaContent(html, ["og:url"]) ||
    fetchUrl;

  const title =
    cleanAirbnbTitle(fromPage.title ?? null) ||
    titleFromDocumentTitle(html) ||
    cleanAirbnbTitle(ogTitle);

  const descriptionCandidates = [fromPage.description, metaDescription, ogDescription]
    .map((value) => value?.trim() || null)
    .filter((value): value is string => Boolean(value));
  let description =
    descriptionCandidates.find(
      (value) =>
        value.length > 40 &&
        value.toLowerCase() !== (title ?? "").toLowerCase(),
    ) ||
    descriptionCandidates.find(
      (value) => value.toLowerCase() !== (title ?? "").toLowerCase(),
    ) ||
    null;
  if (description) {
    description = description
      .replace(
        /^(?:\d{1,2}\.\s+[A-Za-zäöüÄÖÜ]+\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\s*·\s*/u,
        "",
      )
      .trim();
  }

  const imageUrl = (fromPage.imageUrl || ogImage || "").trim() || null;
  const locationHint =
    fromPage.locationHint || extractLocationHint(title, description);
  const lat = fromPage.lat ?? null;
  const lng = fromPage.lng ?? null;

  if (!title && !imageUrl && !listingId) {
    return {
      ok: false,
      message:
        "Airbnb hat kaum Metadaten geliefert. Link speichern und Name/Bild manuell setzen.",
    };
  }

  return {
    ok: true,
    provider: "airbnb",
    listingId,
    title: title || (listingId ? `Airbnb #${listingId}` : null),
    description:
      description && description.length > 600
        ? `${description.slice(0, 597)}…`
        : description,
    imageUrl,
    locationHint,
    canonicalUrl: canonical,
    lat,
    lng,
  };
}
