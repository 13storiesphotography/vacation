import type { ReactNode } from "react";

/** Fixed icon palette for spot categories — users pick from these. */
export const categoryIconKeys = [
  "van",
  "home",
  "star",
  "city",
  "hike",
  "bag",
  "pin",
  "camera",
  "beach",
  "mountain",
  "cafe",
  "restaurant",
  "fuel",
  "parking",
  "nature",
  "museum",
  "ferry",
  "bike",
] as const;

export type CategoryIconKey = (typeof categoryIconKeys)[number];

export const categoryIconLabels: Record<CategoryIconKey, string> = {
  van: "Van / Stellplatz",
  home: "Unterkunft",
  star: "Highlight",
  city: "Ort",
  hike: "Freizeit",
  bag: "Einkauf",
  pin: "Pin",
  camera: "Foto",
  beach: "Strand",
  mountain: "Berge",
  cafe: "Café",
  restaurant: "Essen",
  fuel: "Tanken",
  parking: "Parken",
  nature: "Natur",
  museum: "Museum",
  ferry: "Fähre",
  bike: "Rad",
};

/** Default tone per icon (used when no custom color). */
export const categoryIconTone: Record<CategoryIconKey, string> = {
  van: "#2f6f5e",
  home: "#8b4d6b",
  star: "#b56a3c",
  city: "#1f5f78",
  hike: "#6a7a2f",
  bag: "#6b5a3c",
  pin: "#3d5a80",
  camera: "#5c4b7a",
  beach: "#2a7a8c",
  mountain: "#4a5d4e",
  cafe: "#8a5a3a",
  restaurant: "#a04545",
  fuel: "#5a5a5a",
  parking: "#3a5f8a",
  nature: "#3d6b4f",
  museum: "#6b4f6b",
  ferry: "#2f5f8a",
  bike: "#4f6b3d",
};

/** Built-in category keys → default icons (for legacy / seed). */
export const defaultCategoryIconByKey: Record<string, CategoryIconKey> = {
  stellplatz: "van",
  unterkunft: "home",
  sehenswuerdigkeit: "star",
  ort: "city",
  freizeit: "hike",
  versorgung: "bag",
};

export const categoryIconMarkup: Record<CategoryIconKey, string> = {
  van: `
    <path d="M4 14.5h12" />
    <path d="M5.5 14.5V9.2c0-.4.3-.7.7-.7h5.1c.2 0 .4.1.5.2l2.2 2.3c.1.1.2.3.2.5v3.2" />
    <circle cx="7.2" cy="14.5" r="1.2" />
    <circle cx="13.3" cy="14.5" r="1.2" />
    <path d="M6.5 11h4.2" />
  `,
  home: `
    <path d="M4 15.5V8.4L10 4.2l6 4.2v7.3" />
    <path d="M8 15.5v-3.4h4v3.4" />
    <path d="M7.5 9.2h.1M12.5 9.2h.1" />
  `,
  star: `
    <path d="M10 3.5 11.4 7h3.6l-2.9 2.2 1.1 3.5L10 10.8 6.8 12.7l1.1-3.5L5 7h3.6L10 3.5Z" />
  `,
  city: `
    <path d="M5 15.5V7.2L10 4l5 3.2v8.3" />
    <path d="M8 15.5v-3.2h4v3.2" />
    <path d="M8.2 8.5h.1M11.8 8.5h.1M8.2 11h.1M11.8 11h.1" />
  `,
  hike: `
    <circle cx="10" cy="5.2" r="1.4" />
    <path d="M10 6.8v3.4l-2.6 4.3M10 10.2l2.6 4.3M7.6 9.2h4.8" />
  `,
  bag: `
    <path d="M6.2 7.2h7.6l-.7 7.1a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9L6.2 7.2Z" />
    <path d="M8 7.2V5.8a2 2 0 0 1 4 0v1.4" />
  `,
  pin: `
    <path d="M10 17.2s-5-4.2-5-8a5 5 0 0 1 10 0c0 3.8-5 8-5 8Z" />
    <circle cx="10" cy="9.1" r="1.6" />
  `,
  camera: `
    <rect x="3.5" y="6.5" width="13" height="9" rx="1.5" />
    <circle cx="10" cy="11" r="2.4" />
    <path d="M7.2 6.5 8.2 4.8h3.6l1 1.7" />
  `,
  beach: `
    <path d="M4 15.5h12" />
    <path d="M10 15.5V7.2" />
    <path d="M10 7.2c2.4 0 4.2 1.4 4.8 3.2" />
    <circle cx="14.2" cy="5.2" r="1.3" />
  `,
  mountain: `
    <path d="M3.5 15.5 8 7.5l2.2 3.4 2-2.8 4.3 7.4Z" />
    <path d="M8 7.5 9.4 5.2 11.2 7.9" />
  `,
  cafe: `
    <path d="M5.5 8.2h7.2v5.2a2.4 2.4 0 0 1-2.4 2.4H7.9a2.4 2.4 0 0 1-2.4-2.4Z" />
    <path d="M12.7 9.2h1.4a1.6 1.6 0 0 1 0 3.2h-1.4" />
    <path d="M7 5.2c.6.5.6 1.2 0 1.7M9.2 5.2c.6.5.6 1.2 0 1.7" />
  `,
  restaurant: `
    <path d="M7 4.5v11" />
    <path d="M5.4 4.5c0 2 .8 3 1.6 3.5M8.6 4.5c0 2-.8 3-1.6 3.5" />
    <path d="M13.2 4.5v11" />
    <path d="M13.2 4.5c1.6 0 2.4 1.4 2.4 3.2v1.4H13.2" />
  `,
  fuel: `
    <rect x="4.5" y="4.5" width="7.2" height="11" rx="1" />
    <path d="M11.7 7.2h1.4a1.6 1.6 0 0 1 1.6 1.6V14" />
    <circle cx="14.7" cy="14.5" r="1" />
    <path d="M6.2 7h3.8v2.4H6.2Z" />
  `,
  parking: `
    <rect x="4" y="4" width="12" height="12" rx="2" />
    <path d="M8 14.2V5.8h2.4a2.4 2.4 0 0 1 0 4.8H8" />
  `,
  nature: `
    <path d="M10 16V9" />
    <path d="M10 9c-2.6-.2-4.4-1.8-5-3.8 2.8.2 4.4 1.6 5 3.8Z" />
    <path d="M10 9c2.6-.2 4.4-1.8 5-3.8-2.8.2-4.4 1.6-5 3.8Z" />
    <path d="M10 12c-2-.2-3.4-1.2-4-2.6 2.2.2 3.4 1.1 4 2.6Z" />
  `,
  museum: `
    <path d="M3.8 8.2 10 4.2l6.2 4" />
    <path d="M5 8.2v7.3h10V8.2" />
    <path d="M7.2 15.5v-4h1.8v4M11 15.5v-4h1.8v4" />
  `,
  ferry: `
    <path d="M3.5 11.2 10 8.4l6.5 2.8-1.4 3.4H4.9Z" />
    <path d="M6.2 8.4V6.6h7.6v1.8" />
    <path d="M4 16.2c1.2-.8 2.4-.8 3.6 0s2.4.8 3.6 0 2.4-.8 3.6 0" />
  `,
  bike: `
    <circle cx="6.2" cy="13.2" r="2.4" />
    <circle cx="14.2" cy="13.2" r="2.4" />
    <path d="M6.2 13.2 9.4 7.6h2.4l2.4 5.6M9.4 7.6 8 5.4h2.2M9.4 7.6l2.2 5.6" />
  `,
};

const paths: Record<CategoryIconKey, ReactNode> = {
  van: (
    <>
      <path d="M4 14.5h12" />
      <path d="M5.5 14.5V9.2c0-.4.3-.7.7-.7h5.1c.2 0 .4.1.5.2l2.2 2.3c.1.1.2.3.2.5v3.2" />
      <circle cx="7.2" cy="14.5" r="1.2" />
      <circle cx="13.3" cy="14.5" r="1.2" />
      <path d="M6.5 11h4.2" />
    </>
  ),
  home: (
    <>
      <path d="M4 15.5V8.4L10 4.2l6 4.2v7.3" />
      <path d="M8 15.5v-3.4h4v3.4" />
      <path d="M7.5 9.2h.1M12.5 9.2h.1" />
    </>
  ),
  star: (
    <>
      <path d="M10 3.5 11.4 7h3.6l-2.9 2.2 1.1 3.5L10 10.8 6.8 12.7l1.1-3.5L5 7h3.6L10 3.5Z" />
    </>
  ),
  city: (
    <>
      <path d="M5 15.5V7.2L10 4l5 3.2v8.3" />
      <path d="M8 15.5v-3.2h4v3.2" />
      <path d="M8.2 8.5h.1M11.8 8.5h.1M8.2 11h.1M11.8 11h.1" />
    </>
  ),
  hike: (
    <>
      <circle cx="10" cy="5.2" r="1.4" />
      <path d="M10 6.8v3.4l-2.6 4.3M10 10.2l2.6 4.3M7.6 9.2h4.8" />
    </>
  ),
  bag: (
    <>
      <path d="M6.2 7.2h7.6l-.7 7.1a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9L6.2 7.2Z" />
      <path d="M8 7.2V5.8a2 2 0 0 1 4 0v1.4" />
    </>
  ),
  pin: (
    <>
      <path d="M10 17.2s-5-4.2-5-8a5 5 0 0 1 10 0c0 3.8-5 8-5 8Z" />
      <circle cx="10" cy="9.1" r="1.6" />
    </>
  ),
  camera: (
    <>
      <rect x="3.5" y="6.5" width="13" height="9" rx="1.5" />
      <circle cx="10" cy="11" r="2.4" />
      <path d="M7.2 6.5 8.2 4.8h3.6l1 1.7" />
    </>
  ),
  beach: (
    <>
      <path d="M4 15.5h12" />
      <path d="M10 15.5V7.2" />
      <path d="M10 7.2c2.4 0 4.2 1.4 4.8 3.2" />
      <circle cx="14.2" cy="5.2" r="1.3" />
    </>
  ),
  mountain: (
    <>
      <path d="M3.5 15.5 8 7.5l2.2 3.4 2-2.8 4.3 7.4Z" />
      <path d="M8 7.5 9.4 5.2 11.2 7.9" />
    </>
  ),
  cafe: (
    <>
      <path d="M5.5 8.2h7.2v5.2a2.4 2.4 0 0 1-2.4 2.4H7.9a2.4 2.4 0 0 1-2.4-2.4Z" />
      <path d="M12.7 9.2h1.4a1.6 1.6 0 0 1 0 3.2h-1.4" />
      <path d="M7 5.2c.6.5.6 1.2 0 1.7M9.2 5.2c.6.5.6 1.2 0 1.7" />
    </>
  ),
  restaurant: (
    <>
      <path d="M7 4.5v11" />
      <path d="M5.4 4.5c0 2 .8 3 1.6 3.5M8.6 4.5c0 2-.8 3-1.6 3.5" />
      <path d="M13.2 4.5v11" />
      <path d="M13.2 4.5c1.6 0 2.4 1.4 2.4 3.2v1.4H13.2" />
    </>
  ),
  fuel: (
    <>
      <rect x="4.5" y="4.5" width="7.2" height="11" rx="1" />
      <path d="M11.7 7.2h1.4a1.6 1.6 0 0 1 1.6 1.6V14" />
      <circle cx="14.7" cy="14.5" r="1" />
      <path d="M6.2 7h3.8v2.4H6.2Z" />
    </>
  ),
  parking: (
    <>
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <path d="M8 14.2V5.8h2.4a2.4 2.4 0 0 1 0 4.8H8" />
    </>
  ),
  nature: (
    <>
      <path d="M10 16V9" />
      <path d="M10 9c-2.6-.2-4.4-1.8-5-3.8 2.8.2 4.4 1.6 5 3.8Z" />
      <path d="M10 9c2.6-.2 4.4-1.8 5-3.8-2.8.2-4.4 1.6-5 3.8Z" />
      <path d="M10 12c-2-.2-3.4-1.2-4-2.6 2.2.2 3.4 1.1 4 2.6Z" />
    </>
  ),
  museum: (
    <>
      <path d="M3.8 8.2 10 4.2l6.2 4" />
      <path d="M5 8.2v7.3h10V8.2" />
      <path d="M7.2 15.5v-4h1.8v4M11 15.5v-4h1.8v4" />
    </>
  ),
  ferry: (
    <>
      <path d="M3.5 11.2 10 8.4l6.5 2.8-1.4 3.4H4.9Z" />
      <path d="M6.2 8.4V6.6h7.6v1.8" />
      <path d="M4 16.2c1.2-.8 2.4-.8 3.6 0s2.4.8 3.6 0 2.4-.8 3.6 0" />
    </>
  ),
  bike: (
    <>
      <circle cx="6.2" cy="13.2" r="2.4" />
      <circle cx="14.2" cy="13.2" r="2.4" />
      <path d="M6.2 13.2 9.4 7.6h2.4l2.4 5.6M9.4 7.6 8 5.4h2.2M9.4 7.6l2.2 5.6" />
    </>
  ),
};

export function resolveCategoryIconKey(
  iconOrCategory: string | null | undefined,
): CategoryIconKey {
  if (iconOrCategory && (categoryIconKeys as readonly string[]).includes(iconOrCategory)) {
    return iconOrCategory as CategoryIconKey;
  }
  if (iconOrCategory && defaultCategoryIconByKey[iconOrCategory]) {
    return defaultCategoryIconByKey[iconOrCategory];
  }
  return "pin";
}

export function categoryIconSvg(
  iconOrCategory: string,
  options: { size?: number; stroke?: string; strokeWidth?: number } = {},
): string {
  const icon = resolveCategoryIconKey(iconOrCategory);
  const size = options.size ?? 16;
  const stroke = options.stroke ?? "#ffffff";
  const strokeWidth = options.strokeWidth ?? 1.7;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${categoryIconMarkup[icon]}</svg>`;
}

export function CategoryIcon({
  icon,
  category,
  size = 16,
  className = "",
  tone,
}: {
  /** Palette key, or legacy category key. */
  icon?: string;
  /** @deprecated Prefer `icon`. Legacy category key still resolves. */
  category?: string;
  size?: number;
  className?: string;
  tone?: string;
}) {
  const key = resolveCategoryIconKey(icon ?? category);
  const color = tone ?? categoryIconTone[key];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[key]}
    </svg>
  );
}
