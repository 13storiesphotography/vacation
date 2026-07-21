import type { ReactNode } from "react";
import type { SpotCategory } from "@/lib/spots";
import { categoryTone } from "@/lib/spots";

/** Raw SVG path markup shared by React icons and map markers. */
export const categoryIconMarkup: Record<SpotCategory, string> = {
  stellplatz: `
    <path d="M4 14.5h12" />
    <path d="M5.5 14.5V9.2c0-.4.3-.7.7-.7h5.1c.2 0 .4.1.5.2l2.2 2.3c.1.1.2.3.2.5v3.2" />
    <circle cx="7.2" cy="14.5" r="1.2" />
    <circle cx="13.3" cy="14.5" r="1.2" />
    <path d="M6.5 11h4.2" />
  `,
  sehenswuerdigkeit: `
    <path d="M10 3.5 11.4 7h3.6l-2.9 2.2 1.1 3.5L10 10.8 6.8 12.7l1.1-3.5L5 7h3.6L10 3.5Z" />
  `,
  ort: `
    <path d="M5 15.5V7.2L10 4l5 3.2v8.3" />
    <path d="M8 15.5v-3.2h4v3.2" />
    <path d="M8.2 8.5h.1M11.8 8.5h.1M8.2 11h.1M11.8 11h.1" />
  `,
  freizeit: `
    <circle cx="10" cy="5.2" r="1.4" />
    <path d="M10 6.8v3.4l-2.6 4.3M10 10.2l2.6 4.3M7.6 9.2h4.8" />
  `,
  versorgung: `
    <path d="M6.2 7.2h7.6l-.7 7.1a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9L6.2 7.2Z" />
    <path d="M8 7.2V5.8a2 2 0 0 1 4 0v1.4" />
  `,
};

const paths: Record<SpotCategory, ReactNode> = {
  stellplatz: (
    <>
      <path d="M4 14.5h12" />
      <path d="M5.5 14.5V9.2c0-.4.3-.7.7-.7h5.1c.2 0 .4.1.5.2l2.2 2.3c.1.1.2.3.2.5v3.2" />
      <circle cx="7.2" cy="14.5" r="1.2" />
      <circle cx="13.3" cy="14.5" r="1.2" />
      <path d="M6.5 11h4.2" />
    </>
  ),
  sehenswuerdigkeit: (
    <>
      <path d="M10 3.5 11.4 7h3.6l-2.9 2.2 1.1 3.5L10 10.8 6.8 12.7l1.1-3.5L5 7h3.6L10 3.5Z" />
    </>
  ),
  ort: (
    <>
      <path d="M5 15.5V7.2L10 4l5 3.2v8.3" />
      <path d="M8 15.5v-3.2h4v3.2" />
      <path d="M8.2 8.5h.1M11.8 8.5h.1M8.2 11h.1M11.8 11h.1" />
    </>
  ),
  freizeit: (
    <>
      <circle cx="10" cy="5.2" r="1.4" />
      <path d="M10 6.8v3.4l-2.6 4.3M10 10.2l2.6 4.3M7.6 9.2h4.8" />
    </>
  ),
  versorgung: (
    <>
      <path d="M6.2 7.2h7.6l-.7 7.1a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9L6.2 7.2Z" />
      <path d="M8 7.2V5.8a2 2 0 0 1 4 0v1.4" />
    </>
  ),
};

export function categoryIconSvg(
  category: SpotCategory,
  options: { size?: number; stroke?: string; strokeWidth?: number } = {},
): string {
  const size = options.size ?? 16;
  const stroke = options.stroke ?? "#ffffff";
  const strokeWidth = options.strokeWidth ?? 1.7;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${categoryIconMarkup[category]}</svg>`;
}

export function CategoryIcon({
  category,
  size = 16,
  className = "",
  tone,
}: {
  category: SpotCategory;
  size?: number;
  className?: string;
  tone?: string;
}) {
  const color = tone ?? categoryTone[category];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {paths[category]}
    </svg>
  );
}
