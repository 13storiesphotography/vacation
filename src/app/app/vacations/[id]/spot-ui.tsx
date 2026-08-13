"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import {
  isSpotRelevant,
  suggestedSpotTags,
  activeCategoryOptions,
  resolveCategoryIcon,
  resolveCategoryLabel,
  type SpotCategory,
  type VacationSpotCategory,
} from "@/lib/spots";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { createSpot, updateSpot, type SpotActionState } from "./spot-actions";
import type { SmartLinkResult } from "@/lib/smart-link";
import { isSmartLinkResult, localSmartLinkFallback } from "@/lib/smart-link";
import {
  emptySummary,
  type RaterOption,
  type SpotRating,
  type SpotRatingSummary,
} from "@/lib/ratings";
import { isOvernightCategory } from "@/lib/overnight";
import { isAirbnbUrl } from "@/lib/airbnb";
import { isAppMapPreviewUrl, spotPreviewKind } from "@/lib/geo";
import { uploadSpotImage } from "@/lib/spot-image-upload";
import {
  defaultImageFocus,
  imageFocusStyle,
  parseImageFocus,
  serializeImageFocus,
  type ImageFocus,
} from "@/lib/image-focus";
import { SpotPlaceCard } from "@/components/ui/spot-detail-overlay";
import { CategoryIcon } from "@/components/category-icon";
import { GlassDateField } from "@/components/ui/glass-date-field";
import { isStaleServerActionError, reloadForStaleDeployment } from "@/lib/stale-action";
import {
  checkoutFromNights,
  formatStaySummary,
  stayNightCountFromDates,
  stayStatusLabels,
  type StayStatus,
} from "@/lib/stay";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

const initialState: SpotActionState = {};

function Stars({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const starSize = size === "sm" ? "text-[14px]" : "text-[18px]";
  return (
    <div className="flex items-center gap-px" role={readOnly ? undefined : "group"} aria-label="Bewertung">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (value ?? 0) >= star;
        if (readOnly) {
          return (
            <span
              key={star}
              className={`${starSize} leading-none ${active ? "text-[var(--sun)]" : "text-black/15"}`}
            >
              ★
            </span>
          );
        }
        return (
          <button
            key={star}
            type="button"
            className={`${starSize} leading-none ${active ? "text-[var(--sun)]" : "text-black/15"}`}
            onClick={() => onChange?.(value === star ? null : star)}
            aria-label={value === star ? "Bewertung entfernen" : `${star} Sterne`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

function SmartLinkField({
  value,
  onChange,
  onResolved,
  resolveMode = "always",
}: {
  value: string;
  onChange: (value: string) => void;
  onResolved: (result: SmartLinkResult) => void;
  /** `onChange` skips auto-resolve for the initial value (edit forms). */
  resolveMode?: "always" | "onChange";
}) {
  const [remote, setRemote] = useState<{
    ok: boolean | null;
    message: string | null;
    providerLabel: string | null;
  }>({ ok: null, message: null, providerLabel: null });
  const [pending, startTransition] = useTransition();
  const initialValue = useRef(value);

  const trimmed = value.trim();
  const idleMessage =
    "Ort oder Link eingeben — Google Maps, Airbnb, Park4Night, Booking, …";
  const ok = !trimmed ? null : remote.ok;
  const message = !trimmed ? idleMessage : remote.message;
  const providerLabel = !trimmed ? null : remote.providerLabel;

  useEffect(() => {
    if (!trimmed) return;
    if (resolveMode === "onChange" && trimmed === initialValue.current.trim()) {
      return;
    }
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const response = await fetch("/api/smart-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: trimmed }),
          });

          let result: SmartLinkResult | null = null;
          if (response.ok) {
            const payload: unknown = await response.json();
            if (isSmartLinkResult(payload)) result = payload;
          }

          if (!result) {
            result = localSmartLinkFallback(trimmed);
          }

          if (!result) {
            setRemote({
              ok: false,
              message:
                "Link konnte nicht gelesen werden. Name/Bild ggf. manuell eintragen.",
              providerLabel: null,
            });
            return;
          }

          setRemote({
            ok: result.ok,
            message: result.message,
            providerLabel: result.providerLabel,
          });
          if (result.ok || result.provider !== "unknown") {
            onResolved(result);
          }
        } catch (error) {
          if (isStaleServerActionError(error)) {
            reloadForStaleDeployment();
            return;
          }
          const fallback = localSmartLinkFallback(trimmed);
          if (fallback) {
            setRemote({
              ok: fallback.ok,
              message: fallback.message,
              providerLabel: fallback.providerLabel,
            });
            onResolved(fallback);
            return;
          }
          setRemote({
            ok: false,
            message: "Link konnte nicht gelesen werden. Bitte später erneut versuchen.",
            providerLabel: null,
          });
        }
      });
    }, 420);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, resolveMode]);

  return (
    <label className="form-label mt-3">
      Ort oder Link
      <input
        type="text"
        inputMode="url"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setRemote({ ok: null, message: null, providerLabel: null });
        }}
        className="glass-field mt-1.5 px-3 py-3"
        placeholder="Lofoten Beach · https://maps.app.goo.gl/… · airbnb.de/rooms/…"
        autoComplete="off"
      />
      <span className="mt-1.5 flex flex-wrap items-center gap-2">
        {providerLabel ? (
          <span className="glass-chip !py-1 !text-[11px]" data-active="true">
            {providerLabel}
          </span>
        ) : null}
        <span
          className={`text-[11px] font-medium ${
            ok === true
              ? "text-[var(--pine)]"
              : ok === false
                ? "text-[var(--danger)]"
                : "text-[var(--ink-faint)]"
          }`}
        >
          {pending ? "Link wird erkannt…" : (message ?? "")}
        </span>
      </span>
    </label>
  );
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const selected = new Set(tags.map((tag) => tag.toLowerCase()));

  function toggle(tag: string) {
    const key = tag.toLowerCase();
    if (selected.has(key)) {
      onChange(tags.filter((item) => item.toLowerCase() !== key));
      return;
    }
    onChange([...tags, tag]);
  }

  function addDraft() {
    const next = draft.trim();
    if (!next) return;
    if (!selected.has(next.toLowerCase())) {
      onChange([...tags, next]);
    }
    setDraft("");
  }

  return (
    <div className="mt-3">
      <p className="form-label">Tags</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {suggestedSpotTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="glass-chip !py-1 !text-[11px]"
            data-active={selected.has(tag.toLowerCase())}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
        {tags
          .filter(
            (tag) =>
              !suggestedSpotTags.some(
                (suggested) => suggested.toLowerCase() === tag.toLowerCase(),
              ),
          )
          .map((tag) => (
            <button
              key={tag}
              type="button"
              className="glass-chip !py-1 !text-[11px]"
              data-active="true"
              onClick={() => toggle(tag)}
            >
              {tag} ×
            </button>
          ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          className="glass-field flex-1 px-3 py-2 text-[14px]"
          placeholder="Eigenes Tag…"
        />
        <button type="button" className="glass-chip shrink-0" onClick={addDraft}>
          Hinzufügen
        </button>
      </div>
      <input type="hidden" name="tags" value={tags.join(", ")} />
    </div>
  );
}

function ExternalLinkActions({
  mapsUrl,
  infoUrl,
}: {
  mapsUrl: string;
  infoUrl: string;
}) {
  if (!mapsUrl && !infoUrl) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="glass-chip !py-1.5 !text-[12px]"
        >
          Karte öffnen
        </a>
      ) : null}
      {infoUrl ? (
        <a
          href={infoUrl}
          target="_blank"
          rel="noreferrer"
          className="glass-chip !py-1.5 !text-[12px]"
        >
          {isAirbnbUrl(infoUrl) ? "Airbnb öffnen" : "Buchung / Info öffnen"}
        </a>
      ) : null}
    </div>
  );
}

function primarySpotLink(mapsUrl?: string | null, infoUrl?: string | null): {
  href: string;
  label: string;
} | null {
  if (mapsUrl) return { href: mapsUrl, label: "Karte öffnen" };
  if (infoUrl) {
    return {
      href: infoUrl,
      label: isAirbnbUrl(infoUrl) ? "Airbnb öffnen" : "Seite öffnen",
    };
  }
  return null;
}

function ImageLinkOverlay({
  href,
  label,
  className = "absolute top-1.5 right-1.5",
  size = "md",
}: {
  href: string;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-6 w-6 text-[12px]" : "h-8 w-8 text-[14px]";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={`${className} inline-flex ${dim} items-center justify-center rounded-full bg-[rgba(20,36,48,0.72)] font-semibold text-white shadow-md backdrop-blur-sm`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      ↗
    </a>
  );
}

function SpotThumb({
  spot,
  size = 56,
  selected = false,
  onOpen,
}: {
  spot: Spot;
  size?: number;
  selected?: boolean;
  onOpen?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const focus = parseImageFocus(spot.image_url);
  const focusStyle = imageFocusStyle(focus);
  const imageSrc = spot.image_url?.replace(/#.*$/, "") || null;
  const showImage = Boolean(imageSrc) && !broken;
  const link = primarySpotLink(spot.maps_url, spot.info_url);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[12px] media-fallback ${
        selected ? "ring-2 ring-[var(--fjord)]" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen?.();
        }}
        aria-label={`${spot.name} öffnen`}
        className="absolute inset-0 z-0"
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc!}
            alt=""
            className="h-full w-full object-cover"
            style={{
              objectPosition: focusStyle.objectPosition,
              transform: focusStyle.transform,
              transformOrigin: focusStyle.objectPosition,
            }}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/5">
            <CategoryIcon icon={resolveCategoryIcon(undefined, spot.category)} size={Math.round(size * 0.36)} tone="#ffffff" />
          </div>
        )}
      </button>
      <span className="pointer-events-none absolute bottom-0.5 left-0.5 z-[1] inline-flex rounded-full bg-[var(--surface-strong)] p-0.5 shadow-sm">
        <CategoryIcon icon={resolveCategoryIcon(undefined, spot.category)} size={11} />
      </span>
      {link && showImage ? (
        <ImageLinkOverlay
          href={link.href}
          label={link.label}
          size="sm"
          className="absolute top-0.5 right-0.5 z-[1]"
        />
      ) : null}
    </div>
  );
}

function SpotPhotoPanel({
  vacationId,
  previewSrc,
  isMapPreview,
  hasManualImage,
  previousAutoImage,
  imageUrl,
  onImageUrlChange,
  focus,
  onFocusChange,
  openHref,
  openLabel,
}: {
  vacationId: string;
  previewSrc: string | null;
  isMapPreview: boolean;
  hasManualImage: boolean;
  previousAutoImage: string | null;
  imageUrl: string;
  onImageUrlChange: (value: string) => void;
  focus: ImageFocus;
  onFocusChange: (value: ImageFocus) => void;
  openHref?: string | null;
  openLabel?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const style = imageFocusStyle(focus);

  async function onPickImage(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadSpotImage({ vacationId, file });
      if ("error" in result) {
        setUploadError(result.error);
        return;
      }
      onImageUrlChange(result.url);
      onFocusChange({ ...defaultImageFocus });
    } catch {
      setUploadError("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!previewSrc) return;
    dragging.current = true;
    last.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || !last.current) return;
    const dx = event.clientX - last.current.x;
    const dy = event.clientY - last.current.y;
    last.current = { x: event.clientX, y: event.clientY };
    onFocusChange({
      ...focus,
      x: Math.min(100, Math.max(0, focus.x - dx * 0.35)),
      y: Math.min(100, Math.max(0, focus.y - dy * 0.35)),
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = false;
    last.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function nudgeZoom(delta: number) {
    const next = Math.round(Math.min(2.5, Math.max(1, focus.z + delta)) * 100) / 100;
    onFocusChange({ ...focus, z: next });
  }

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="form-label !mb-0">Foto</p>
        {isMapPreview && !hasManualImage ? (
          <span className="glass-chip !py-1 !text-[11px]">Karten-Vorschau</span>
        ) : hasManualImage ? (
          <span className="glass-chip !py-1 !text-[11px]" data-active="true">
            Eigenes Foto
          </span>
        ) : previewSrc ? (
          <span className="glass-chip !py-1 !text-[11px]">Ortsfoto</span>
        ) : null}
      </div>

      {previousAutoImage ? (
        <input type="hidden" name="previous_image_url" value={previousAutoImage} />
      ) : null}
      <input type="hidden" name="image_url" value={imageUrl} />
      <input type="hidden" name="image_focus" value={serializeImageFocus(focus) ?? ""} />

      {previewSrc ? (
        <div
          className="glass-media relative h-44 w-full cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-cover"
            style={{
              objectPosition: style.objectPosition,
              transform: style.transform,
              transformOrigin: style.objectPosition,
            }}
            referrerPolicy="no-referrer"
          />
          {openHref ? (
            <ImageLinkOverlay
              href={openHref}
              label={openLabel ?? "Link öffnen"}
              className="absolute top-2 right-2 z-[1]"
            />
          ) : null}
          <div
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-[rgba(20,36,48,0.55)] p-1 shadow-md backdrop-blur-md"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-semibold leading-none text-white disabled:opacity-35"
              aria-label="Verkleinern"
              disabled={focus.z <= 1}
              onClick={() => nudgeZoom(-0.2)}
            >
              −
            </button>
            <span className="min-w-[2.4rem] text-center text-[11px] font-semibold tabular-nums text-white/90">
              {Math.round(focus.z * 100)}%
            </span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-semibold leading-none text-white disabled:opacity-35"
              aria-label="Vergrößern"
              disabled={focus.z >= 2.5}
              onClick={() => nudgeZoom(0.2)}
            >
              +
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="glass-media glass-media-empty w-full"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-[15px] font-semibold text-[var(--ink)]">
            {uploading ? "Foto wird geladen…" : "Foto hinzufügen"}
          </span>
          <span className="text-[12px] text-[var(--ink-soft)]">
            Kamera oder Galerie — oder später automatisch aus dem Link
          </span>
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="glass-chip"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Lädt…" : previewSrc ? "Ersetzen" : "Hochladen"}
        </button>
        {hasManualImage ? (
          <button
            type="button"
            className="glass-chip"
            disabled={uploading}
            onClick={() => {
              onImageUrlChange("");
              setUploadError(null);
            }}
          >
            Entfernen
          </button>
        ) : null}
        {previewSrc ? (
          <button
            type="button"
            className="glass-chip"
            onClick={() => onFocusChange({ ...defaultImageFocus })}
          >
            Ausschnitt zurück
          </button>
        ) : null}
        <button
          type="button"
          className="glass-chip"
          data-active={showUrl}
          onClick={() => setShowUrl((value) => !value)}
        >
          URL
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void onPickImage(file);
        }}
      />

      {uploadError ? (
        <p className="mt-2 text-[12px] text-[var(--danger)]">{uploadError}</p>
      ) : previewSrc ? (
        <p className="mt-1.5 text-[11px] text-[var(--ink-faint)]">
          Ziehen zum Verschieben · +/− zum Zoomen
        </p>
      ) : null}

      {showUrl ? (
        <div className="glass-disclosure mt-2 !block">
          <label className="form-label py-2">
            Bild-URL
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              value={imageUrl}
              onChange={(e) => onImageUrlChange(e.target.value)}
              className="glass-field mt-1.5 mb-2 px-3 py-2.5"
              placeholder="https://…"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}


function SpotFormFields({
  vacationId,
  spot,
  showOvernight,
  category,
  onCategoryChange,
  categories,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  imageUrl,
  onImageUrlChange,
  imageFocus,
  onImageFocusChange,
  pasteUrl,
  onPasteUrlChange,
  mapsUrl,
  onMapsUrlChange,
  infoUrl,
  onInfoUrlChange,
  overnightCost,
  onOvernightCostChange,
  stayCheckIn,
  onStayCheckInChange,
  stayCheckOut,
  onStayCheckOutChange,
  stayNights,
  onStayNightsChange,
  stayStatus,
  onStayStatusChange,
  onSmartResolved,
  tags,
  onTagsChange,
  smartLinkResolveMode = "always",
}: {
  vacationId: string;
  spot?: Spot | null;
  showOvernight: boolean;
  category: SpotCategory;
  onCategoryChange: (value: SpotCategory) => void;
  categories?: VacationSpotCategory[];
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  imageUrl: string;
  onImageUrlChange: (value: string) => void;
  imageFocus: ImageFocus;
  onImageFocusChange: (value: ImageFocus) => void;
  pasteUrl: string;
  onPasteUrlChange: (value: string) => void;
  mapsUrl: string;
  onMapsUrlChange: (value: string) => void;
  infoUrl: string;
  onInfoUrlChange: (value: string) => void;
  overnightCost: string;
  onOvernightCostChange: (value: string) => void;
  stayCheckIn: string;
  onStayCheckInChange: (value: string) => void;
  stayCheckOut: string;
  onStayCheckOutChange: (value: string) => void;
  stayNights: string;
  onStayNightsChange: (value: string) => void;
  stayStatus: string;
  onStayStatusChange: (value: string) => void;
  onSmartResolved: (result: SmartLinkResult) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  smartLinkResolveMode?: "always" | "onChange";
}) {
  const categoryChoices = activeCategoryOptions(categories);
  const derivedNights = stayNightCountFromDates(stayCheckIn || null, stayCheckOut || null);
  // Controlled only by stayNights — never ghost-fill from dates (that blocked clearing).
  const nightsValue = stayNights;
  const explicitNights = stayNights
    ? Number.parseInt(stayNights, 10) || null
    : null;
  // While editing: do not imply nights from dates when the nights field is empty.
  const staySummary = explicitNights
    ? formatStaySummary({
        stay_nights: explicitNights,
        stay_check_in: stayCheckIn || null,
        stay_check_out: stayCheckOut || null,
      })
    : stayCheckIn && stayCheckOut
      ? (() => {
          const fmt = new Intl.DateTimeFormat("de-DE", {
            day: "numeric",
            month: "short",
          });
          const from = fmt.format(new Date(`${stayCheckIn}T12:00:00Z`));
          const to = fmt.format(new Date(`${stayCheckOut}T12:00:00Z`));
          return `${from} → ${to} · Nächte offen`;
        })()
      : stayCheckIn || stayCheckOut
        ? "Datum unvollständig"
        : null;
  const hasStay =
    Boolean(stayNights.trim()) || Boolean(stayCheckIn) || Boolean(stayCheckOut);
  const autoImage =
    !imageUrl && spot?.image_url && !spot.image_manual ? spot.image_url : null;
  const previewSrc =
    (imageUrl && !isAppMapPreviewUrl(imageUrl) ? imageUrl : null) ||
    autoImage ||
    (imageUrl || null);
  const previewLink = primarySpotLink(mapsUrl, infoUrl);

  function clearStay() {
    onStayNightsChange("");
    onStayCheckInChange("");
    onStayCheckOutChange("");
  }

  function clearDates() {
    onStayCheckInChange("");
    onStayCheckOutChange("");
  }

  function clearNights() {
    onStayNightsChange("");
  }

  return (
    <>
      <SmartLinkField
        value={pasteUrl}
        onChange={onPasteUrlChange}
        onResolved={onSmartResolved}
        resolveMode={smartLinkResolveMode}
      />
      <input type="hidden" name="maps_url" value={mapsUrl} />
      <input type="hidden" name="info_url" value={infoUrl} />

      <label className="form-label mt-3">
        Name
        <input
          name="name"
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="glass-field mt-1.5 px-3 py-3"
          placeholder="Wird oft aus dem Link erkannt"
        />
      </label>
      <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
        Name kannst du frei ändern — Speichern überschreibt ihn nicht erneut aus dem Link.
      </p>

      <ExternalLinkActions mapsUrl={mapsUrl} infoUrl={infoUrl} />

      <label className="form-label mt-3">
        Kategorie
        <select
          name="category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as SpotCategory)}
          className="glass-field mt-1.5 px-3 py-3"
        >
          {categoryChoices.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <TagEditor tags={tags} onChange={onTagsChange} />

      {showOvernight && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              Aufenthalt
            </p>
            {hasStay ? (
              <button
                type="button"
                className="glass-chip glass-chip-danger !py-1 !text-[11px]"
                onClick={clearStay}
              >
                Leeren
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">
              <span className="flex items-center justify-between gap-2">
                Nächte
                {nightsValue ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[var(--danger)]"
                    onClick={clearNights}
                  >
                    Entfernen
                  </button>
                ) : null}
              </span>
              <input
                type="text"
                name="stay_nights"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={nightsValue}
                placeholder="z. B. 2"
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, "");
                  if (next === "") {
                    onStayNightsChange("");
                    return;
                  }
                  const raw = Number.parseInt(next, 10);
                  if (!Number.isFinite(raw)) {
                    onStayNightsChange("");
                    return;
                  }
                  const capped = Math.min(60, Math.max(1, raw));
                  onStayNightsChange(String(capped));
                  if (stayCheckIn) {
                    onStayCheckOutChange(checkoutFromNights(stayCheckIn, capped));
                  }
                }}
                className="glass-field mt-1.5 px-3 py-3"
              />
            </label>
            <label className="form-label">
              Status
              <select
                name="stay_status"
                value={stayStatus}
                onChange={(e) => onStayStatusChange(e.target.value)}
                className="glass-field mt-1.5 px-3 py-3"
              >
                <option value="">Offen</option>
                <option value="interessiert">Interessiert</option>
                <option value="gebucht">Gebucht</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">
              <span className="flex items-center justify-between gap-2">
                Anreise
                {stayCheckIn ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[var(--danger)]"
                    onClick={clearDates}
                  >
                    Entfernen
                  </button>
                ) : null}
              </span>
              <GlassDateField
                name="stay_check_in"
                value={stayCheckIn}
                onChange={(nextIn) => {
                  onStayCheckInChange(nextIn);
                  if (!nextIn) {
                    onStayCheckOutChange("");
                    return;
                  }
                  // Keep existing nights if set; otherwise leave nights empty
                  // so dates can exist without a forced nights count.
                  if (stayNights) {
                    const nights = Number.parseInt(stayNights, 10) || 1;
                    onStayCheckOutChange(checkoutFromNights(nextIn, nights));
                  } else if (stayCheckOut && stayCheckOut > nextIn) {
                    // keep checkout; nights stay empty
                  } else if (derivedNights > 0) {
                    onStayCheckOutChange(checkoutFromNights(nextIn, derivedNights));
                  } else {
                    onStayCheckOutChange(checkoutFromNights(nextIn, 1));
                  }
                }}
              />
            </label>
            <label className="form-label">
              <span className="flex items-center justify-between gap-2">
                Abreise
                {stayCheckOut ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[var(--danger)]"
                    onClick={clearDates}
                  >
                    Entfernen
                  </button>
                ) : null}
              </span>
              <GlassDateField
                name="stay_check_out"
                value={stayCheckOut}
                min={stayCheckIn || undefined}
                onChange={(nextOut) => {
                  onStayCheckOutChange(nextOut);
                  if (!nextOut) return;
                  // Only sync nights from dates when the nights field already has a value.
                  if (
                    stayNights &&
                    stayCheckIn &&
                    nextOut > stayCheckIn
                  ) {
                    const n = stayNightCountFromDates(stayCheckIn, nextOut);
                    if (n > 0) onStayNightsChange(String(n));
                  }
                }}
              />
            </label>
          </div>
          {staySummary ? (
            <p className="text-[12px] text-[var(--ink-soft)]">
              {staySummary}
              {stayStatus
                ? ` · ${stayStatusLabels[stayStatus as StayStatus] ?? stayStatus}`
                : ""}
              {stayCheckIn && stayCheckOut
                ? " · wird im Plan automatisch als Übernachtung gesetzt"
                : " · Datum später ergänzen für den Plan"}
            </p>
          ) : (
            <p className="text-[12px] text-[var(--ink-faint)]">
              Nächte allein reichen — Datum ist optional. Beides lässt sich wieder leeren.
            </p>
          )}
        </div>
      )}

      <SpotPhotoPanel
        vacationId={vacationId}
        previewSrc={previewSrc}
        isMapPreview={Boolean(
          (imageUrl && isAppMapPreviewUrl(imageUrl)) ||
            (autoImage && isAppMapPreviewUrl(autoImage) && !imageUrl),
        )}
        hasManualImage={Boolean(imageUrl)}
        previousAutoImage={
          spot?.image_url && !spot.image_manual && !imageUrl ? spot.image_url : null
        }
        imageUrl={imageUrl}
        onImageUrlChange={onImageUrlChange}
        focus={imageFocus}
        onFocusChange={onImageFocusChange}
        openHref={previewLink?.href}
        openLabel={previewLink?.label}
      />

      <label className="form-label mt-3">
        Beschreibung
        <textarea
          name="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="glass-field mt-1.5 min-h-20 px-3 py-3"
        />
      </label>

      <label className="form-label mt-3">
        Google Maps Link
        <div className="mt-1.5 flex gap-2">
          <input
            type="url"
            value={mapsUrl}
            onChange={(e) => onMapsUrlChange(e.target.value)}
            className="glass-field min-w-0 flex-1 px-3 py-3"
            placeholder="Optional, wenn schon oben erkannt"
          />
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="glass-chip shrink-0 self-center"
            >
              Öffnen
            </a>
          ) : null}
        </div>
      </label>

      <label className="form-label mt-3">
        Buchungs-/Info-Link
        <div className="mt-1.5 flex gap-2">
          <input
            type="url"
            value={infoUrl}
            onChange={(e) => onInfoUrlChange(e.target.value)}
            className="glass-field min-w-0 flex-1 px-3 py-3"
            placeholder="Airbnb, Park4Night, Booking, …"
          />
          {infoUrl ? (
            <a
              href={infoUrl}
              target="_blank"
              rel="noreferrer"
              className="glass-chip shrink-0 self-center"
            >
              Öffnen
            </a>
          ) : null}
        </div>
      </label>

      {showOvernight ? (
        <>
          <label className="form-label mt-3">
            Übernachtung
            <select
              name="overnight_cost"
              value={overnightCost}
              onChange={(e) => onOvernightCostChange(e.target.value)}
              className="glass-field mt-1.5 px-3 py-3"
            >
              <option value="">Keine Angabe</option>
              <option value="frei">Frei</option>
              <option value="kostenpflichtig">Kostenpflichtig</option>
            </select>
          </label>
          <label className="form-label mt-3">
            Preis-Hinweis
            <input
              name="price_hint"
              defaultValue={spot?.price_hint ?? ""}
              className="glass-field mt-1.5 px-3 py-3"
              placeholder="ab 280 SEK / Nacht"
            />
          </label>
          <label className="form-label mt-3">
            Preis / Nacht (Zahl)
            <input
              name="price_per_night"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={
                spot?.price_per_night != null ? String(spot.price_per_night) : ""
              }
              className="glass-field mt-1.5 px-3 py-3"
              placeholder="z. B. 35"
            />
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="stay_check_in" value="" />
          <input type="hidden" name="stay_check_out" value="" />
          <input type="hidden" name="stay_nights" value="" />
          <input type="hidden" name="stay_status" value="" />
        </>
      )}
    </>
  );
}

function applySmartLinkResult(
  result: SmartLinkResult,
  options: {
    fillEmptyOnly?: boolean;
    currentName?: string;
    currentDescription?: string;
    currentMapsUrl?: string;
    currentInfoUrl?: string;
    currentOvernightCost?: string;
    setCategory: (value: SpotCategory) => void;
    setName: (value: string) => void;
    setDescription: (value: string) => void;
    setImageUrl: (value: string) => void;
    setMapsUrl: (value: string) => void;
    setInfoUrl: (value: string) => void;
    setOvernightCost: (value: string) => void;
    setPasteUrl: (value: string) => void;
  },
) {
  const fillEmptyOnly = options.fillEmptyOnly ?? false;
  if (!fillEmptyOnly) {
    options.setCategory(result.suggestedCategory);
  }
  // Keep the pasted source link visible when we also derived a Maps URL (e.g. Airbnb coords).
  options.setPasteUrl(result.infoUrl || result.mapsUrl || "");

  if (result.mapsUrl) {
    if (!fillEmptyOnly || !options.currentMapsUrl?.trim()) {
      options.setMapsUrl(result.mapsUrl);
    }
  }
  if (result.infoUrl) {
    if (!fillEmptyOnly || !options.currentInfoUrl?.trim()) {
      options.setInfoUrl(result.infoUrl);
    }
  }

  if (result.title) {
    if (!fillEmptyOnly || !options.currentName?.trim()) {
      options.setName(result.title);
    }
  } else if (result.locationHint && (!fillEmptyOnly || !options.currentName?.trim())) {
    options.setName(`${result.providerLabel} · ${result.locationHint}`);
  }

  if (result.description) {
    if (!fillEmptyOnly || !options.currentDescription?.trim()) {
      options.setDescription(result.description);
    }
  }
  if (result.imageUrl && !isAppMapPreviewUrl(result.imageUrl)) {
    // Maps/Places photos must stay auto (healable). Only listing providers
    // fill the editable "eigenes Bild" field.
    const listingProviders = new Set([
      "airbnb",
      "booking",
      "park4night",
      "tripadvisor",
      "generic",
    ]);
    if (listingProviders.has(result.provider) && !fillEmptyOnly) {
      options.setImageUrl(result.imageUrl);
    }
  }
  if (result.overnightCost) {
    if (!fillEmptyOnly || !options.currentOvernightCost?.trim()) {
      options.setOvernightCost(result.overnightCost);
    }
  }
}

export function CreateSpotForm({
  vacationId,
  onCreated,
  categories,
  variant = "inline",
  formId = "create-spot-form",
  hideSubmit = false,
  onPendingChange,
}: {
  vacationId: string;
  onCreated: () => void;
  categories?: VacationSpotCategory[];
  /** `sheet` = content inside GlassSheet (no card chrome). */
  variant?: "inline" | "sheet";
  formId?: string;
  hideSubmit?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const categoryChoices = activeCategoryOptions(categories);
  const [state, action, pending] = useActionState(createSpot, initialState);
  const [category, setCategory] = useState<SpotCategory>(
    categoryChoices[0]?.key ?? "stellplatz",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFocus, setImageFocus] = useState<ImageFocus>({ ...defaultImageFocus });
  const [pasteUrl, setPasteUrl] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [infoUrl, setInfoUrl] = useState("");
  const [overnightCost, setOvernightCost] = useState("");
  const [stayCheckIn, setStayCheckIn] = useState("");
  const [stayCheckOut, setStayCheckOut] = useState("");
  const [stayNights, setStayNights] = useState("");
  const [stayStatus, setStayStatus] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (state.ok) onCreated();
  }, [state.ok, onCreated]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  return (
    <form
      id={formId}
      action={action}
      className={variant === "inline" ? "ios-group mt-3 p-4" : undefined}
    >
      <input type="hidden" name="vacation_id" value={vacationId} />
      {variant === "inline" ? (
        <>
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Neuen Spot hinzufügen</p>
          <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
            Link rein — die App erkennt Quelle und füllt aus, was geht.
          </p>
        </>
      ) : (
        <p className="mb-2 text-[12px] text-[var(--ink-faint)]">
          Link rein — die App erkennt Quelle und füllt aus, was geht.
        </p>
      )}
      <SpotFormFields
        vacationId={vacationId}
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
        showOvernight={isOvernightCategory(category, categories)}
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        imageUrl={imageUrl}
        onImageUrlChange={setImageUrl}
        imageFocus={imageFocus}
        onImageFocusChange={setImageFocus}
        pasteUrl={pasteUrl}
        onPasteUrlChange={setPasteUrl}
        mapsUrl={mapsUrl}
        onMapsUrlChange={setMapsUrl}
        infoUrl={infoUrl}
        onInfoUrlChange={setInfoUrl}
        overnightCost={overnightCost}
        onOvernightCostChange={setOvernightCost}
        stayCheckIn={stayCheckIn}
        onStayCheckInChange={setStayCheckIn}
        stayCheckOut={stayCheckOut}
        onStayCheckOutChange={setStayCheckOut}
        stayNights={stayNights}
        onStayNightsChange={setStayNights}
        stayStatus={stayStatus}
        onStayStatusChange={setStayStatus}
        tags={tags}
        onTagsChange={setTags}
        onSmartResolved={(result) =>
          applySmartLinkResult(result, {
            setCategory,
            setName,
            setDescription,
            setImageUrl,
            setMapsUrl,
            setInfoUrl,
            setOvernightCost,
            setPasteUrl,
          })
        }
      />
      {state.error && <p className="mt-3 text-[13px] text-[var(--danger)]">{state.error}</p>}
      {!hideSubmit ? (
        <button type="submit" className="cta mt-4 w-full" disabled={pending}>
          {pending ? "…" : "Spot speichern"}
        </button>
      ) : null}
    </form>
  );
}

export function EditSpotForm({
  vacationId,
  spot,
  onDone,
  onDelete,
  onToggleRelevant,
  deleting = false,
  variant = "panel",
  formId = "edit-spot-form",
  hideActions = false,
  onPendingChange,
  categories,
}: {
  vacationId: string;
  spot: Spot;
  onDone: () => void;
  onDelete: () => void;
  onToggleRelevant?: () => void;
  deleting?: boolean;
  /** `page` = full detail overlay without nested panel chrome. */
  variant?: "panel" | "page";
  formId?: string;
  /** Hide Abbrechen/Speichern — use place-card footer with form=formId instead. */
  hideActions?: boolean;
  onPendingChange?: (pending: boolean) => void;
  categories?: VacationSpotCategory[];
}) {
  const [state, action, pending] = useActionState(updateSpot, initialState);
  const [category, setCategory] = useState<SpotCategory>(spot.category);
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description ?? "");
  const [imageUrl, setImageUrl] = useState(
    spot.image_manual ? (spot.image_url?.replace(/#.*$/, "") ?? "") : "",
  );
  const [imageFocus, setImageFocus] = useState(() => parseImageFocus(spot.image_url));
  const [mapsUrl, setMapsUrl] = useState(spot.maps_url ?? "");
  const [infoUrl, setInfoUrl] = useState(spot.info_url ?? "");
  const [pasteUrl, setPasteUrl] = useState(spot.maps_url || spot.info_url || "");
  const [overnightCost, setOvernightCost] = useState(spot.overnight_cost ?? "");
  // Only load explicit stay_nights — never ghost-fill from dates (blocked clearing).
  const [stayCheckIn, setStayCheckIn] = useState(spot.stay_check_in ?? "");
  const [stayCheckOut, setStayCheckOut] = useState(spot.stay_check_out ?? "");
  const [stayNights, setStayNights] = useState(
    spot.stay_nights != null ? String(spot.stay_nights) : "",
  );
  const [stayStatus, setStayStatus] = useState(spot.stay_status ?? "");
  const [tags, setTags] = useState<string[]>(() => [...(spot.tags ?? [])]);
  const relevant = isSpotRelevant(spot);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  return (
    <div className={variant === "panel" ? "glass-subpanel-flush" : undefined}>
      <form id={formId} action={action}>
        <input type="hidden" name="vacation_id" value={vacationId} />
        <input type="hidden" name="spot_id" value={spot.id} />
        <input type="hidden" name="previous_maps_url" value={spot.maps_url ?? ""} />
        <input
          type="hidden"
          name="previous_lat"
          value={spot.lat != null ? String(spot.lat) : ""}
        />
        <input
          type="hidden"
          name="previous_lng"
          value={spot.lng != null ? String(spot.lng) : ""}
        />
        {spot.image_url ? (
          <input type="hidden" name="previous_image_url" value={spot.image_url} />
        ) : null}
        {variant === "panel" ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
            Spot bearbeiten
          </p>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {onToggleRelevant ? (
              <button
                type="button"
                className="glass-chip"
                data-active={!relevant}
                disabled={pending}
                title={
                  relevant
                    ? "Aus Plan und Karte nehmen, in der Sammlung behalten"
                    : "Wieder in Plan und Karte aufnehmen"
                }
                onClick={onToggleRelevant}
              >
                {relevant ? "Archivieren" : "Wiederherstellen"}
              </button>
            ) : null}
            <button
              type="button"
              className="glass-chip glass-chip-danger"
              disabled={deleting || pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `„${spot.name}“ wirklich löschen? Das lässt sich nicht rückgängig machen.`,
                  )
                ) {
                  return;
                }
                onDelete();
              }}
            >
              {deleting ? "Löschen…" : "Löschen"}
            </button>
          </div>
        </div>
        ) : (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {onToggleRelevant ? (
              <button
                type="button"
                className="glass-chip"
                data-active={!relevant}
                disabled={pending}
                onClick={onToggleRelevant}
              >
                {relevant ? "Archivieren" : "Wiederherstellen"}
              </button>
            ) : null}
            <button
              type="button"
              className="glass-chip glass-chip-danger"
              disabled={deleting || pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `„${spot.name}“ wirklich löschen? Das lässt sich nicht rückgängig machen.`,
                  )
                ) {
                  return;
                }
                onDelete();
              }}
            >
              {deleting ? "Löschen…" : "Löschen"}
            </button>
          </div>
        )}
        <SpotFormFields
          vacationId={vacationId}
          spot={spot}
          category={category}
          onCategoryChange={setCategory}
          categories={categories}
          showOvernight={isOvernightCategory(category, categories)}
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          imageUrl={imageUrl}
          onImageUrlChange={setImageUrl}
          imageFocus={imageFocus}
          onImageFocusChange={setImageFocus}
          pasteUrl={pasteUrl}
          onPasteUrlChange={setPasteUrl}
          mapsUrl={mapsUrl}
          onMapsUrlChange={setMapsUrl}
          infoUrl={infoUrl}
          onInfoUrlChange={setInfoUrl}
          overnightCost={overnightCost}
          onOvernightCostChange={setOvernightCost}
          stayCheckIn={stayCheckIn}
          onStayCheckInChange={setStayCheckIn}
          stayCheckOut={stayCheckOut}
          onStayCheckOutChange={setStayCheckOut}
          stayNights={stayNights}
          onStayNightsChange={setStayNights}
          stayStatus={stayStatus}
          onStayStatusChange={setStayStatus}
          tags={tags}
          onTagsChange={setTags}
          smartLinkResolveMode="onChange"
          onSmartResolved={(result) =>
            applySmartLinkResult(result, {
              fillEmptyOnly: true,
              currentName: name,
              currentDescription: description,
              currentMapsUrl: mapsUrl,
              currentInfoUrl: infoUrl,
              currentOvernightCost: overnightCost,
              setCategory,
              setName,
              setDescription,
              setImageUrl,
              setMapsUrl,
              setInfoUrl,
              setOvernightCost,
              setPasteUrl,
            })
          }
        />
        {state.error && <p className="mt-3 text-[13px] text-[var(--danger)]">{state.error}</p>}
        {!hideActions ? (
          <div className="mt-4 flex gap-2">
            <button type="button" className="cta cta-secondary flex-1" onClick={onDone}>
              Abbrechen
            </button>
            <button type="submit" className="cta flex-1" disabled={pending || deleting}>
              {pending ? "…" : "Speichern"}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}


export function SpotDetailView({
  spot,
  summary,
  ratings = [],
  raters = [],
  currentUserId = null,
  categories,
  onRate,
  onFavorite,
}: {
  spot: Spot;
  summary: SpotRatingSummary;
  ratings?: SpotRating[];
  raters?: RaterOption[];
  currentUserId?: string | null;
  categories?: VacationSpotCategory[];
  onRate: (value: number | null) => void;
  onFavorite: () => void;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const relevant = isSpotRelevant(spot);
  const imageSrc = spot.image_url?.replace(/#.*$/, "") || null;
  const focus = parseImageFocus(spot.image_url);
  const focusStyle = imageFocusStyle(focus);
  const kind = spotPreviewKind(spot);
  const mapsLink = spot.maps_url;
  const infoLink = spot.info_url;
  const tags = spot.tags ?? [];
  const description = spot.description?.trim() ?? "";
  const longDescription = description.length > 140;
  const categoryIcon = resolveCategoryIcon(categories, spot.category);
  const categoryLabel = resolveCategoryLabel(categories, spot.category);

  const teamRows = useMemo(() => {
    const labelFor = (userId: string) =>
      raters.find((rater) => rater.userId === userId)?.label ?? "Team";
    return ratings
      .filter(
        (entry) =>
          entry.spot_id === spot.id &&
          entry.user_id !== currentUserId &&
          (entry.rating != null || entry.is_favorite),
      )
      .map((entry) => ({
        userId: entry.user_id,
        label: labelFor(entry.user_id),
        rating: entry.rating,
        favorite: entry.is_favorite,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [currentUserId, ratings, raters, spot.id]);

  return (
    <>
      <div className="spot-place-hero">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            style={{
              objectPosition: focusStyle.objectPosition,
              transform: focusStyle.transform,
              transformOrigin: focusStyle.objectPosition,
            }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIcon icon={categoryIcon} size={36} tone="#ffffff" />
          </div>
        )}
        <span className="pointer-events-none absolute bottom-2 left-2 inline-flex rounded-full bg-[var(--surface-strong)] p-1 shadow-sm">
          <CategoryIcon icon={categoryIcon} size={12} />
        </span>
        {kind === "map" ? (
          <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-[rgba(12,24,32,0.55)] px-2 py-0.5 text-[11px] font-semibold text-white">
            Karte
          </span>
        ) : null}
      </div>

      <div className="spot-place-content">
        <h2 className="spot-place-title">{spot.name}</h2>
        <p className="spot-place-meta">
          {categoryLabel}
          {spot.overnight_cost ? ` · ${spot.overnight_cost}` : ""}
          {formatStaySummary(spot) ? ` · ${formatStaySummary(spot)}` : ""}
          {!relevant ? " · Archiv" : ""}
        </p>

        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="glass-chip !cursor-default !py-1 !text-[11px]">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {description ? (
          <div className="mt-2">
            <p
              className={`text-[13px] leading-relaxed text-[var(--ink-soft)] ${
                descOpen || !longDescription ? "" : "line-clamp-3"
              }`}
            >
              {description}
            </p>
            {longDescription ? (
              <button
                type="button"
                className="mt-1 text-[12px] font-semibold text-[var(--fjord)]"
                onClick={() => setDescOpen((value) => !value)}
              >
                {descOpen ? "Weniger" : "Mehr"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Stars value={summary.myRating} onChange={onRate} size="sm" />
          <button
            type="button"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[15px] ${
              summary.myFavorite ? "text-[var(--sun)]" : "text-black/20"
            }`}
            aria-label={summary.myFavorite ? "Favorit entfernen" : "Als Favorit"}
            onClick={onFavorite}
          >
            {summary.myFavorite ? "♥" : "♡"}
          </button>
          {summary.average != null ? (
            <span className="text-[11px] tabular-nums text-[var(--ink-faint)]">
              Ø {formatAvg(summary.average)}
              {summary.count > 0 ? ` · ${summary.count}` : ""}
            </span>
          ) : null}
        </div>

        {teamRows.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {teamRows.map((row) => (
              <li
                key={row.userId}
                className="flex items-center justify-between gap-2 text-[12px] text-[var(--ink-soft)]"
              >
                <span className="truncate font-medium">{row.label}</span>
                <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                  {row.favorite ? <span className="text-[var(--sun)]">♥</span> : null}
                  {row.rating != null ? (
                    <Stars value={row.rating} readOnly size="sm" />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {(mapsLink || infoLink) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mapsLink ? (
              <a href={mapsLink} target="_blank" rel="noreferrer" className="glass-chip !py-1.5">
                Maps
              </a>
            ) : null}
            {infoLink ? (
              <a href={infoLink} target="_blank" rel="noreferrer" className="glass-chip !py-1.5">
                {isAirbnbUrl(infoLink) ? "Airbnb" : "Info"}
              </a>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

export type SpotSortMode = "newest" | "favorites" | "avg" | "mine";

export type SpotCollectionFilterState = {
  category: "alle" | SpotCategory;
  sortMode: SpotSortMode;
  showArchived: boolean;
  minAvg: number;
};

export const defaultSpotCollectionFilters: SpotCollectionFilterState = {
  category: "alle",
  sortMode: "newest",
  showArchived: false,
  minAvg: 0,
};

export function filterSpotCollection(
  spots: Spot[],
  summaries: Record<string, SpotRatingSummary>,
  filters: SpotCollectionFilterState,
): Spot[] {
  let list =
    filters.category === "alle"
      ? [...spots]
      : spots.filter((spot) => spot.category === filters.category);

  if (!filters.showArchived) {
    list = list.filter((spot) => isSpotRelevant(spot));
  }

  if (filters.minAvg > 0) {
    list = list.filter((spot) => {
      const average = (summaries[spot.id] ?? emptySummary()).average;
      return average != null && average >= filters.minAvg;
    });
  }

  if (filters.sortMode === "favorites") {
    list = list.filter((spot) => (summaries[spot.id] ?? emptySummary()).myFavorite);
  } else if (filters.sortMode === "mine") {
    list = list.filter((spot) => (summaries[spot.id] ?? emptySummary()).myRating != null);
  }

  list.sort((a, b) => {
    const summaryA = summaries[a.id] ?? emptySummary();
    const summaryB = summaries[b.id] ?? emptySummary();

    if (filters.sortMode === "favorites") {
      if (summaryA.myFavorite !== summaryB.myFavorite) {
        return summaryA.myFavorite ? -1 : 1;
      }
      return (summaryB.average ?? -1) - (summaryA.average ?? -1);
    }
    if (filters.sortMode === "avg") {
      return (summaryB.average ?? -1) - (summaryA.average ?? -1);
    }
    if (filters.sortMode === "mine") {
      return (summaryB.myRating ?? -1) - (summaryA.myRating ?? -1);
    }
    const aRel = isSpotRelevant(a) ? 0 : 1;
    const bRel = isSpotRelevant(b) ? 0 : 1;
    if (aRel !== bRel) return aRel - bRel;
    return 0;
  });

  return list;
}

export function SpotSammelnFilters({
  filters,
  onChange,
  shelvedCount,
  categories,
  canManage = false,
  onManage,
}: {
  filters: SpotCollectionFilterState;
  onChange: (next: SpotCollectionFilterState) => void;
  shelvedCount: number;
  categories?: VacationSpotCategory[];
  canManage?: boolean;
  onManage?: () => void;
}) {
  const categoryChoices = activeCategoryOptions(categories);
  return (
    <div className="mt-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => onChange({ ...filters, category: "alle" })}
            className="glass-chip shrink-0"
            data-active={filters.category === "alle"}
          >
            Alle
          </button>
          {categoryChoices.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange({ ...filters, category: option.key })}
              className="glass-chip shrink-0"
              data-active={filters.category === option.key}
              title={option.label}
            >
              <CategoryIcon
                icon={option.icon}
                size={14}
                tone={filters.category === option.key ? "#ffffff" : undefined}
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        {canManage && onManage ? (
          <button
            type="button"
            className="shrink-0 text-[12px] font-semibold text-[var(--fjord)]"
            onClick={onManage}
          >
            Kategorien
          </button>
        ) : null}
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        {(
          [
            ["newest", "Neueste"],
            ["favorites", "Favoriten"],
            ["avg", "Beste Ø"],
            ["mine", "Meine"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="glass-chip !py-1.5 !text-[12px]"
            data-active={filters.sortMode === value}
            onClick={() => onChange({ ...filters, sortMode: value })}
          >
            {label}
          </button>
        ))}
        {shelvedCount > 0 ? (
          <button
            type="button"
            className="glass-chip !py-1.5 !text-[12px]"
            data-active={filters.showArchived}
            onClick={() =>
              onChange({ ...filters, showArchived: !filters.showArchived })
            }
          >
            {filters.showArchived ? "Archiv aus" : `Archiv (${shelvedCount})`}
          </button>
        ) : null}
        {(
          [
            [0, "Alle Noten"],
            [3, "ab 3★"],
            [4, "ab 4★"],
            [4.5, "ab 4,5★"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="glass-chip !py-1.5 !text-[12px]"
            data-active={filters.minAvg === value}
            onClick={() => onChange({ ...filters, minAvg: value })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatAvg(value: number | null): string {
  if (value == null) return "–";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

/** Shared Maps-style place card for Galerie + Karte. */
export function SpotPlaceSession({
  spot,
  vacationId,
  canEdit,
  editing,
  onEditingChange,
  onClose,
  summary,
  ratings,
  raters,
  currentUserId,
  categories,
  onMyRatingPatch,
  onChanged,
  onSpotPatch,
}: {
  spot: Spot;
  vacationId: string;
  canEdit: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onClose: () => void;
  summary: SpotRatingSummary;
  ratings: SpotRating[];
  raters: RaterOption[];
  currentUserId: string | null;
  categories?: VacationSpotCategory[];
  onMyRatingPatch: (
    spotId: string,
    patch: { rating?: number | null; isFavorite?: boolean },
  ) => void;
  onChanged: () => void;
  onSpotPatch?: (spotId: string, patch: Partial<Spot>) => void;
}) {
  const formId = `edit-spot-${spot.id}`;
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setDeleting(true);
    setError(null);
    const { deleteSpot } = await import("./spot-actions");
    const result = await deleteSpot(vacationId, spot.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
    onChanged();
  }

  function toggleRelevant() {
    if (!onSpotPatch) return;
    const next = !isSpotRelevant(spot);
    const previous = spot.is_relevant;
    setError(null);
    onSpotPatch(spot.id, { is_relevant: next });
    void (async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("spots")
        .update({ is_relevant: next })
        .eq("id", spot.id)
        .eq("vacation_id", vacationId);
      if (updateError) {
        onSpotPatch(spot.id, { is_relevant: previous });
        setError(updateError.message);
      }
    })();
  }

  function saveRating(patch: { rating?: number | null; isFavorite?: boolean }) {
    if (!currentUserId) {
      setError("Nicht angemeldet.");
      return;
    }
    const previous = {
      rating: summary.myRating,
      isFavorite: summary.myFavorite,
    };
    setError(null);
    onMyRatingPatch(spot.id, patch);
    void (async () => {
      const supabase = createClient();
      const payload: {
        spot_id: string;
        user_id: string;
        rating?: number | null;
        is_favorite?: boolean;
      } = {
        spot_id: spot.id,
        user_id: currentUserId,
      };
      if (patch.rating !== undefined) payload.rating = patch.rating;
      if (patch.isFavorite !== undefined) payload.is_favorite = patch.isFavorite;
      const { error: upsertError } = await supabase.from("spot_ratings").upsert(payload, {
        onConflict: "spot_id,user_id",
      });
      if (upsertError) {
        onMyRatingPatch(spot.id, previous);
        setError(upsertError.message);
      }
    })();
  }

  return (
    <SpotPlaceCard
      open
      editing={editing}
      onClose={onClose}
      footer={
        editing && canEdit ? (
          <>
            <button
              type="button"
              className="cta cta-secondary"
              disabled={pending || deleting}
              onClick={() => onEditingChange(false)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              form={formId}
              className="cta"
              disabled={pending || deleting}
            >
              {pending ? "…" : "Speichern"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="cta cta-secondary" onClick={onClose}>
              Schließen
            </button>
            {canEdit ? (
              <button
                type="button"
                className="cta"
                onClick={() => onEditingChange(true)}
              >
                Bearbeiten
              </button>
            ) : null}
          </>
        )
      }
    >
      {error ? (
        <p className="px-3 pt-2 text-[13px] text-[var(--danger)]">{error}</p>
      ) : null}
      {editing && canEdit ? (
        <div className="px-3 pb-2 pt-1">
          <EditSpotForm
            key={spot.id}
            formId={formId}
            vacationId={vacationId}
            spot={spot}
            variant="page"
            hideActions
            categories={categories}
            deleting={deleting}
            onDelete={() => void onDelete()}
            onDone={() => {
              onEditingChange(false);
              onChanged();
            }}
            onToggleRelevant={onSpotPatch ? toggleRelevant : undefined}
            onPendingChange={setPending}
          />
        </div>
      ) : (
        <SpotDetailView
          spot={spot}
          summary={summary}
          ratings={ratings}
          raters={raters}
          currentUserId={currentUserId}
          categories={categories}
          onRate={(value) => saveRating({ rating: value })}
          onFavorite={() => saveRating({ isFavorite: !summary.myFavorite })}
        />
      )}
    </SpotPlaceCard>
  );
}

function SpotCardMedia({
  spot,
  categories,
}: {
  spot: Spot;
  categories?: VacationSpotCategory[];
}) {
  const [broken, setBroken] = useState(false);
  const focus = parseImageFocus(spot.image_url);
  const imageSrc = spot.image_url?.replace(/#.*$/, "") || null;
  const showImage = Boolean(imageSrc) && !broken;
  const categoryIcon = resolveCategoryIcon(categories, spot.category);

  if (!showImage) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[rgba(12,24,32,0.06)]">
        <CategoryIcon icon={categoryIcon} size={36} tone="#ffffff" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc!}
      alt=""
      /* Grid thumbs: object-position only — scale() leaves empty bands in the frame. */
      style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

export function SpotList({
  vacationId,
  spots,
  ratings,
  summaries,
  raters,
  currentUserId,
  canEdit = false,
  filters,
  categories,
  onAdd,
  onChanged,
  onMyRatingPatch,
  onSpotPatch,
}: {
  vacationId: string;
  spots: Spot[];
  ratings: SpotRating[];
  summaries: Record<string, SpotRatingSummary>;
  raters: RaterOption[];
  currentUserId: string | null;
  canEdit?: boolean;
  filters: SpotCollectionFilterState;
  categories?: VacationSpotCategory[];
  onAdd?: () => void;
  onChanged: () => void;
  onMyRatingPatch: (
    spotId: string,
    patch: { rating?: number | null; isFavorite?: boolean },
  ) => void;
  onSpotPatch: (spotId: string, patch: Partial<Spot>) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const shelvedCount = useMemo(
    () => spots.filter((spot) => !isSpotRelevant(spot)).length,
    [spots],
  );

  const visibleSpots = useMemo(
    () => filterSpotCollection(spots, summaries, filters),
    [filters, spots, summaries],
  );

  const selectedSpot = useMemo(
    () => spots.find((spot) => spot.id === selectedId) ?? null,
    [selectedId, spots],
  );

  return (
    <div className="mt-3">
      {visibleSpots.length === 0 ? (
        <div className="ios-group p-5 text-[14px] text-[var(--ink-soft)]">
          <p>
            {spots.length === 0
              ? "Noch keine Spots — füge den ersten Ort zur Sammlung hinzu."
              : filters.showArchived
                ? "Keine Spots für diesen Filter."
                : shelvedCount > 0 &&
                    filters.category === "alle" &&
                    filters.sortMode === "newest" &&
                    filters.minAvg === 0
                  ? "Keine aktiven Spots — Archiv anzeigen, um abgelegte Orte zu sehen."
                  : "Keine Spots für diesen Filter."}
          </p>
          {spots.length === 0 && canEdit && onAdd ? (
            <button type="button" className="cta mt-4 w-full" onClick={onAdd}>
              Hinzufügen
            </button>
          ) : null}
        </div>
      ) : (
        <div className="spot-collection">
          {visibleSpots.map((spot) => {
            const summary = summaries[spot.id] ?? emptySummary();
            const relevant = isSpotRelevant(spot);
            const selected = selectedId === spot.id;
            const tags = spot.tags ?? [];
            return (
              <button
                key={spot.id}
                type="button"
                className={`spot-card ${relevant ? "" : "opacity-60"}`}
                data-selected={selected}
                onClick={() => {
                  setSelectedId(spot.id);
                  setEditingId(null);
                }}
              >
                <div className="spot-card-media">
                  <SpotCardMedia spot={spot} categories={categories} />
                  <span className="pointer-events-none absolute bottom-2 left-2 inline-flex rounded-full bg-[var(--surface-strong)] p-1 shadow-sm">
                    <CategoryIcon
                      icon={resolveCategoryIcon(categories, spot.category)}
                      size={12}
                    />
                  </span>
                  {summary.myFavorite ? (
                    <span className="pointer-events-none absolute top-2 right-2 text-[14px] text-[var(--sun)] drop-shadow">
                      ♥
                    </span>
                  ) : null}
                  {(() => {
                    const kind = spotPreviewKind(spot);
                    return kind === "map" ? (
                      <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-[rgba(12,24,32,0.55)] px-2 py-0.5 text-[11px] font-semibold text-white">
                        Karte
                      </span>
                    ) : summary.average != null ? (
                      <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-[rgba(12,24,32,0.55)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                        Ø {formatAvg(summary.average)}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="spot-card-body">
                  <p className="truncate text-[14px] font-semibold leading-tight text-[var(--ink)]">
                    {spot.name}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--ink-soft)]">
                    {resolveCategoryLabel(categories, spot.category)}
                    {!relevant ? " · Archiv" : ""}
                    {formatStaySummary(spot) ? ` · ${formatStaySummary(spot)}` : ""}
                  </p>
                  {tags.length > 0 ? (
                    <p className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">
                      {tags.slice(0, 2).join(" · ")}
                      {tags.length > 2 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedSpot ? (
        <SpotPlaceSession
          spot={selectedSpot}
          vacationId={vacationId}
          canEdit={canEdit}
          editing={editingId === selectedSpot.id}
          onEditingChange={(next) => setEditingId(next ? selectedSpot.id : null)}
          onClose={() => {
            setSelectedId(null);
            setEditingId(null);
          }}
          summary={summaries[selectedSpot.id] ?? emptySummary()}
          ratings={ratings}
          raters={raters}
          currentUserId={currentUserId}
          categories={categories}
          onMyRatingPatch={onMyRatingPatch}
          onChanged={onChanged}
          onSpotPatch={onSpotPatch}
        />
      ) : null}
    </div>
  );
}
