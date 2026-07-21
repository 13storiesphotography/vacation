export type AirbnbMetadata = {
  ok: true;
  provider: "airbnb";
  listingId: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  locationHint: string | null;
  canonicalUrl: string;
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
    /\s*[-–|]\s*(?:Apartments?|Homes?|Places?|Rooms?|Houses?|Cabins?|Condos?|Villas?).{0,80}$/i,
    "",
  );
  cleaned = cleaned.replace(/\s*[-–|]\s*.{0,40}\s+for Rent in .{0,80}$/i, "");
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

function extractFromNextData(html: string): {
  title?: string;
  description?: string;
  imageUrl?: string;
  locationHint?: string;
} {
  const match = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) return {};
  try {
    const blob = match[1];
    const title =
      blob.match(/"seoTitle"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ||
      blob.match(/"listingTitle"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ||
      blob.match(/"shareName"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ||
      undefined;
    const description =
      blob.match(/"seoDescription"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ||
      undefined;
    const imageUrl =
      blob.match(/"pictureUrl"\s*:\s*"(https:[^"]+muscache[^"]+)"/)?.[1] ||
      blob.match(/"(https:\\\/\\\/a0\.muscache\.com[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)?.[1] ||
      undefined;
    const locationHint =
      blob.match(/"localizedCityName"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ||
      blob.match(/"city"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ||
      undefined;

    return {
      title: unescapeJsonString(title),
      description: unescapeJsonString(description),
      imageUrl: unescapeJsonString(imageUrl)?.replace(/\\\//g, "/"),
      locationHint: unescapeJsonString(locationHint),
    };
  } catch {
    return {};
  }
}

/**
 * Fetch public Airbnb listing metadata via Open Graph / embedded page data.
 * Exact address/coords are intentionally not relied on.
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
          "Mozilla/5.0 (compatible; VacationPlaner/1.0; +https://vacation-bice.vercel.app)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "de-DE,de;q=0.9,en;q=0.8",
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

  const fromNext = extractFromNextData(html);
  const ogTitle = metaContent(html, ["og:title", "twitter:title"]);
  const ogDescription = metaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const ogImage = metaContent(html, ["og:image", "twitter:image", "og:image:url"]);
  const canonical =
    html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    )?.[1] ||
    metaContent(html, ["og:url"]) ||
    fetchUrl;

  const title = cleanAirbnbTitle(fromNext.title || ogTitle);
  const description = (fromNext.description || ogDescription || "").trim() || null;
  const imageUrl = (fromNext.imageUrl || ogImage || "").trim() || null;
  const locationHint =
    fromNext.locationHint || extractLocationHint(title, description);

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
  };
}
