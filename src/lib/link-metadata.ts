import { decodeHtmlEntities, isUsablePreviewImage } from "@/lib/geo";

export type PageMetadata = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  canonicalUrl: string | null;
  siteName: string | null;
};

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
      if (match?.[1]) return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
}

function cleanTitle(title: string | null, siteName?: string | null): string | null {
  if (!title) return null;
  let cleaned = title.trim();
  if (siteName) {
    cleaned = cleaned.replace(
      new RegExp(`\\s*[-–|]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"),
      "",
    );
  }
  cleaned = cleaned
    .replace(/\s*[-–|]\s*Park4Night\s*$/i, "")
    .replace(/\s*[-–|]\s*Booking\.com\s*$/i, "")
    .replace(/\s*[-–|]\s*Tripadvisor\s*$/i, "")
    .replace(/\s*[-–|]\s*Komoot\s*$/i, "")
    .trim();
  return cleaned || null;
}

/** Fetch Open Graph / page metadata for arbitrary listing or place URLs. */
export async function fetchPageMetadata(rawUrl: string): Promise<PageMetadata> {
  const trimmed = rawUrl.trim();
  let html = "";
  let finalUrl = trimmed;
  try {
    const response = await fetch(trimmed, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    finalUrl = response.url || trimmed;
    if (!response.ok) {
      return {
        title: null,
        description: null,
        imageUrl: null,
        canonicalUrl: finalUrl,
        siteName: null,
      };
    }
    html = await response.text();
  } catch {
    return {
      title: null,
      description: null,
      imageUrl: null,
      canonicalUrl: trimmed,
      siteName: null,
    };
  }

  const siteName = metaContent(html, ["og:site_name"]);
  const title = cleanTitle(
    metaContent(html, ["og:title", "twitter:title"]) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      null,
    siteName,
  );
  const description = metaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const imageRaw = metaContent(html, ["og:image", "twitter:image", "og:image:url"]);
  const imageUrl =
    imageRaw && isUsablePreviewImage(imageRaw) ? imageRaw : imageRaw;
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    metaContent(html, ["og:url"]) ||
    finalUrl;

  return {
    title,
    description:
      description && description.length > 600
        ? `${description.slice(0, 597)}…`
        : description,
    imageUrl,
    canonicalUrl: canonical,
    siteName,
  };
}
