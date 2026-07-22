/** Spot preview framing: focal point (%) + zoom scale. */
export type ImageFocus = {
  x: number;
  y: number;
  z: number;
};

export const defaultImageFocus: ImageFocus = { x: 50, y: 50, z: 1 };

const FOCUS_RE = /(?:^|[&#])vp=([\d.]+),([\d.]+),([\d.]+)/i;

export function parseImageFocus(raw: string | null | undefined): ImageFocus {
  if (!raw?.trim()) return { ...defaultImageFocus };
  // Prefer URL fragment / query encoding: #vp=50,40,1.2
  const fromUrl = raw.match(FOCUS_RE);
  if (fromUrl) {
    return {
      x: clamp(Number.parseFloat(fromUrl[1]), 0, 100),
      y: clamp(Number.parseFloat(fromUrl[2]), 0, 100),
      z: clamp(Number.parseFloat(fromUrl[3]), 1, 3),
    };
  }
  // Plain "x,y,z" (form hidden field)
  const parts = raw.split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
    return {
      x: clamp(parts[0], 0, 100),
      y: clamp(parts[1], 0, 100),
      z: Number.isFinite(parts[2]) ? clamp(parts[2], 1, 3) : 1,
    };
  }
  return { ...defaultImageFocus };
}

export function serializeImageFocus(focus: ImageFocus): string | null {
  const x = Math.round(clamp(focus.x, 0, 100));
  const y = Math.round(clamp(focus.y, 0, 100));
  const z = Math.round(clamp(focus.z, 1, 3) * 100) / 100;
  if (x === 50 && y === 50 && z === 1) return null;
  return `${x},${y},${z}`;
}

/** Persist focus in the image URL fragment so no DB migration is required. */
export function withImageFocus(
  url: string | null | undefined,
  focus: ImageFocus,
): string | null {
  if (!url?.trim()) return null;
  const base = url.replace(/#.*$/, "").trim();
  if (!base) return null;
  const serialized = serializeImageFocus(focus);
  if (!serialized) return base;
  return `${base}#vp=${serialized}`;
}

/** Strip focus metadata for network fetches / equality checks. */
export function stripImageFocus(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return url.replace(/#.*$/, "").trim() || null;
}

export function imageFocusStyle(focus: ImageFocus | null | undefined): {
  objectPosition: string;
  transform: string;
} {
  const value = focus ?? defaultImageFocus;
  return {
    objectPosition: `${value.x}% ${value.y}%`,
    transform: value.z > 1 ? `scale(${value.z})` : "none",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
