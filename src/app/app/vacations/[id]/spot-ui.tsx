"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import {
  categoryLabels,
  categoryOptions,
  isSpotRelevant,
  suggestedSpotTags,
  type SpotCategory,
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
import { isAppMapPreviewUrl } from "@/lib/geo";
import {
  defaultImageFocus,
  imageFocusStyle,
  parseImageFocus,
  serializeImageFocus,
  type ImageFocus,
} from "@/lib/image-focus";
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
    "Einfach Link einfügen — Google Maps, Airbnb, Park4Night, Booking, …";
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
      Link einfügen
      <input
        type="url"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setRemote({ ok: null, message: null, providerLabel: null });
        }}
        className="glass-field mt-1.5 px-3 py-3"
        placeholder="https://maps.app.goo.gl/… · airbnb.de/rooms/… · park4night.com/…"
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

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      aria-label={`${spot.name} bearbeiten`}
      className={`relative shrink-0 overflow-hidden rounded-[12px] media-fallback ${
        selected ? "ring-2 ring-[var(--fjord)]" : ""
      }`}
      style={{ width: size, height: size }}
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
          <CategoryIcon category={spot.category} size={Math.round(size * 0.36)} tone="#ffffff" />
        </div>
      )}
      <span className="absolute bottom-0.5 left-0.5 inline-flex rounded-full bg-[var(--surface-strong)] p-0.5 shadow-sm">
        <CategoryIcon category={spot.category} size={11} />
      </span>
    </button>
  );
}

function ImageFocusEditor({
  src,
  focus,
  onChange,
}: {
  src: string;
  focus: ImageFocus;
  onChange: (value: ImageFocus) => void;
}) {
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const style = imageFocusStyle(focus);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true;
    last.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || !last.current) return;
    const dx = event.clientX - last.current.x;
    const dy = event.clientY - last.current.y;
    last.current = { x: event.clientX, y: event.clientY };
    // Dragging the image right reveals the left side → decrease focus x.
    onChange({
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
    onChange({ ...focus, z: next });
  }

  return (
    <div className="mt-3">
      <div
        className="relative h-44 w-full cursor-grab overflow-hidden rounded-[14px] active:cursor-grabbing touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
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
        <div
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-[rgba(20,36,48,0.72)] p-1 shadow-md backdrop-blur-sm"
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
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--ink-faint)]">
          Ziehen zum Verschieben · +/− zum Zoomen
        </p>
        <button
          type="button"
          className="text-[11px] font-semibold text-[var(--fjord)]"
          onClick={() => onChange({ ...defaultImageFocus })}
        >
          Zurücksetzen
        </button>
      </div>
      <input type="hidden" name="image_focus" value={serializeImageFocus(focus) ?? ""} />
    </div>
  );
}

function SpotFormFields({
  spot,
  showOvernight,
  category,
  onCategoryChange,
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
  detailsOpen,
  onDetailsOpenChange,
  tags,
  onTagsChange,
  smartLinkResolveMode = "always",
}: {
  spot?: Spot | null;
  showOvernight: boolean;
  category: SpotCategory;
  onCategoryChange: (value: SpotCategory) => void;
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
  detailsOpen: boolean;
  onDetailsOpenChange: (value: boolean) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  smartLinkResolveMode?: "always" | "onChange";
}) {
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
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {categoryLabels[option]}
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

      {previewSrc ? (
        <ImageFocusEditor
          src={previewSrc}
          focus={imageFocus}
          onChange={onImageFocusChange}
        />
      ) : (
        <input type="hidden" name="image_focus" value="" />
      )}
      {autoImage && isAppMapPreviewUrl(autoImage) && !imageUrl ? (
        <p className="mt-2 text-[12px] text-[var(--ink-faint)]">
          Automatische Karten-Vorschau — unter Details kannst du ein echtes Foto per URL setzen.
        </p>
      ) : null}

      <button
        type="button"
        className="glass-chip mt-3"
        aria-expanded={detailsOpen}
        onClick={() => onDetailsOpenChange(!detailsOpen)}
      >
        {detailsOpen ? "Weniger Details" : "Mehr Details"}
      </button>

      {detailsOpen ? (
        <div className="mt-3">
          <label className="form-label">
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

          <label className="form-label mt-3">
            Vorschaubild-URL
            {spot?.image_url && !spot.image_manual && !imageUrl ? (
              <input type="hidden" name="previous_image_url" value={spot.image_url} />
            ) : null}
            <input
              name="image_url"
              type="text"
              inputMode="url"
              autoComplete="off"
              value={imageUrl}
              onChange={(e) => onImageUrlChange(e.target.value)}
              className="glass-field mt-1.5 px-3 py-3"
              placeholder="https://… · leer = automatisch"
            />
          </label>
          <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
            Direkter Link zu einem Foto (https://…). Leer lassen für Ortsfoto/Karten-Vorschau.
          </p>

          {showOvernight && (
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
            </>
          )}
        </div>
      ) : (
        <>
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="image_url" value={imageUrl} />
          {spot?.image_url && !spot.image_manual && !imageUrl ? (
            <input type="hidden" name="previous_image_url" value={spot.image_url} />
          ) : null}
          {showOvernight ? (
            <input type="hidden" name="overnight_cost" value={overnightCost} />
          ) : null}
          {showOvernight ? (
            <input type="hidden" name="price_hint" value={spot?.price_hint ?? ""} />
          ) : null}
          {!showOvernight ? (
            <>
              <input type="hidden" name="stay_check_in" value="" />
              <input type="hidden" name="stay_check_out" value="" />
              <input type="hidden" name="stay_nights" value="" />
              <input type="hidden" name="stay_status" value="" />
            </>
          ) : null}
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
    if (!fillEmptyOnly) {
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
}: {
  vacationId: string;
  onCreated: () => void;
}) {
  const [state, action, pending] = useActionState(createSpot, initialState);
  const [category, setCategory] = useState<SpotCategory>("stellplatz");
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
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (state.ok) onCreated();
  }, [state.ok, onCreated]);

  return (
    <form action={action} className="ios-group mt-3 p-4">
      <input type="hidden" name="vacation_id" value={vacationId} />
      <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Neuen Spot hinzufügen</p>
      <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
        Link rein — die App erkennt Quelle und füllt aus, was geht.
      </p>
      <SpotFormFields
        category={category}
        onCategoryChange={setCategory}
        showOvernight={isOvernightCategory(category)}
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
        detailsOpen={detailsOpen}
        onDetailsOpenChange={setDetailsOpen}
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
      <button type="submit" className="cta mt-4 w-full" disabled={pending}>
        {pending ? "…" : "Spot speichern"}
      </button>
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
}: {
  vacationId: string;
  spot: Spot;
  onDone: () => void;
  onDelete: () => void;
  onToggleRelevant?: () => void;
  deleting?: boolean;
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const relevant = isSpotRelevant(spot);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <div className="glass-subpanel-flush">
      <form action={action}>
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
        <SpotFormFields
          spot={spot}
          category={category}
          onCategoryChange={setCategory}
          showOvernight={isOvernightCategory(category)}
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
          detailsOpen={detailsOpen}
          onDetailsOpenChange={setDetailsOpen}
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
        <div className="mt-4 flex gap-2">
          <button type="button" className="cta cta-secondary flex-1" onClick={onDone}>
            Abbrechen
          </button>
          <button type="submit" className="cta flex-1" disabled={pending || deleting}>
            {pending ? "…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

type SortMode = "newest" | "favorites" | "avg" | "mine";

function formatAvg(value: number | null): string {
  if (value == null) return "–";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

export function SpotList({
  vacationId,
  spots,
  summaries,
  currentUserId,
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
  onChanged: () => void;
  onMyRatingPatch: (
    spotId: string,
    patch: { rating?: number | null; isFavorite?: boolean },
  ) => void;
  onSpotPatch: (spotId: string, patch: Partial<Spot>) => void;
}) {
  const [filter, setFilter] = useState<"alle" | SpotCategory>("alle");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shelvedCount = useMemo(
    () => spots.filter((spot) => !isSpotRelevant(spot)).length,
    [spots],
  );

  const visibleSpots = useMemo(() => {
    let list =
      filter === "alle" ? [...spots] : spots.filter((spot) => spot.category === filter);

    list.sort((a, b) => {
      const summaryA = summaries[a.id] ?? emptySummary();
      const summaryB = summaries[b.id] ?? emptySummary();

      if (sortMode === "favorites") {
        if (summaryA.myFavorite !== summaryB.myFavorite) {
          return summaryA.myFavorite ? -1 : 1;
        }
        return (summaryB.average ?? -1) - (summaryA.average ?? -1);
      }
      if (sortMode === "avg") {
        return (summaryB.average ?? -1) - (summaryA.average ?? -1);
      }
      if (sortMode === "mine") {
        return (summaryB.myRating ?? -1) - (summaryA.myRating ?? -1);
      }
      // Newest: keep DB order, but sink shelved spots.
      const aRel = isSpotRelevant(a) ? 0 : 1;
      const bRel = isSpotRelevant(b) ? 0 : 1;
      if (aRel !== bRel) return aRel - bRel;
      return 0;
    });

    return list;
  }, [filter, sortMode, spots, summaries]);

  async function onDelete(spotId: string) {
    setDeletingId(spotId);
    setError(null);
    const { deleteSpot } = await import("./spot-actions");
    const result = await deleteSpot(vacationId, spotId);
    setDeletingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  function saveRating(spotId: string, patch: { rating?: number | null; isFavorite?: boolean }) {
    if (!currentUserId) {
      setError("Nicht angemeldet.");
      return;
    }

    const previous = summaries[spotId] ?? emptySummary();
    const revert = {
      rating: previous.myRating,
      isFavorite: previous.myFavorite,
    };

    setError(null);
    onMyRatingPatch(spotId, patch);

    void (async () => {
      const supabase = createClient();
      const payload: {
        spot_id: string;
        user_id: string;
        rating?: number | null;
        is_favorite?: boolean;
      } = {
        spot_id: spotId,
        user_id: currentUserId,
      };
      if (patch.rating !== undefined) payload.rating = patch.rating;
      if (patch.isFavorite !== undefined) payload.is_favorite = patch.isFavorite;

      const { error: upsertError } = await supabase.from("spot_ratings").upsert(payload, {
        onConflict: "spot_id,user_id",
      });

      if (upsertError) {
        onMyRatingPatch(spotId, revert);
        setError(upsertError.message);
      }
    })();
  }

  function toggleRelevant(spot: Spot) {
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

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("alle")}
          className="glass-chip"
          data-active={filter === "alle"}
        >
          Alle
        </button>
        {categoryOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className="glass-chip"
            data-active={filter === option}
          >
            <CategoryIcon
              category={option}
              size={14}
              tone={filter === option ? "#ffffff" : undefined}
            />
            {categoryLabels[option]}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <label className="form-label">
          Sortierung
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="glass-field mt-1.5 px-3 py-2.5 text-[14px]"
          >
            <option value="newest">Neueste</option>
            <option value="favorites">Favoriten</option>
            <option value="avg">Beste Ø</option>
            <option value="mine">Meine Tops</option>
          </select>
        </label>
      </div>

      {shelvedCount > 0 ? (
        <p className="mb-3 text-[12px] text-[var(--ink-faint)]">
          {shelvedCount} Spot{shelvedCount === 1 ? "" : "s"} archiviert — unten in der
          Liste, nicht in Plan/Karte.
        </p>
      ) : null}

      {error && <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>}

      <div className="ios-group">
        {visibleSpots.length === 0 ? (
          <div className="p-5 text-[14px] text-[var(--ink-soft)]">
            {spots.length === 0
              ? "Noch keine Spots in dieser Kategorie."
              : "Keine Spots für diesen Filter."}
          </div>
        ) : (
          visibleSpots.map((spot) => {
            const summary = summaries[spot.id] ?? emptySummary();
            const isOpen = editingId === spot.id;
            const relevant = isSpotRelevant(spot);
            function openEdit() {
              setEditingId((current) => (current === spot.id ? null : spot.id));
            }
            return (
              <div key={spot.id}>
                <div
                  className={`ios-row !items-center !py-2.5 cursor-pointer ${
                    isOpen ? "bg-[rgba(15,110,140,0.06)]" : ""
                  } ${relevant ? "" : "opacity-55"}`}
                  onClick={openEdit}
                >
                  <SpotThumb
                    spot={spot}
                    size={52}
                    selected={isOpen}
                    onOpen={openEdit}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold leading-tight">
                          {spot.name}
                        </p>
                        <div className="mt-0.5 text-[12px] leading-snug text-[var(--ink-soft)]">
                          <span className="min-w-0">
                            {categoryLabels[spot.category]}
                            {spot.overnight_cost ? ` · ${spot.overnight_cost}` : ""}
                            {spot.price_hint ? ` · ${spot.price_hint}` : ""}
                            {formatStaySummary(spot)
                              ? ` · ${formatStaySummary(spot)}`
                              : ""}
                            {spot.stay_status
                              ? ` · ${stayStatusLabels[spot.stay_status]}`
                              : ""}
                            {spot.tags?.length
                              ? ` · ${spot.tags.slice(0, 3).join(", ")}${
                                  spot.tags.length > 3 ? "…" : ""
                                }`
                              : ""}
                            {summary.average != null && (
                              <>
                                {" · "}
                                <span className="tabular-nums text-[var(--ink-faint)]">
                                  Ø {formatAvg(summary.average)}
                                  {summary.count > 1 ? ` · ${summary.count}` : ""}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <div
                        className="flex shrink-0 items-center gap-0.5 pt-0.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Stars
                          value={summary.myRating}
                          onChange={(value) => saveRating(spot.id, { rating: value })}
                          size="sm"
                        />
                        <button
                          type="button"
                          className={`inline-flex h-6 w-6 items-center justify-center text-[14px] leading-none ${
                            summary.myFavorite ? "text-[var(--sun)]" : "text-black/18"
                          }`}
                          aria-label={summary.myFavorite ? "Favorit entfernen" : "Als Favorit"}
                          onClick={() =>
                            saveRating(spot.id, { isFavorite: !summary.myFavorite })
                          }
                        >
                          {summary.myFavorite ? "♥" : "♡"}
                        </button>
                      </div>
                    </div>

                    {spot.description ? (
                      <p className="mt-1 line-clamp-1 text-[12px] leading-snug text-[var(--ink-soft)]">
                        {spot.description}
                      </p>
                    ) : null}

                    {!relevant || spot.maps_url || spot.info_url ? (
                      <div
                        className="mt-1.5 flex flex-wrap gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {!relevant ? (
                          <button
                            type="button"
                            className="glass-chip !py-1 !text-[11px]"
                            data-active="true"
                            title="Wiederherstellen"
                            onClick={() => toggleRelevant(spot)}
                          >
                            Archiviert
                          </button>
                        ) : null}
                        {spot.maps_url ? (
                          <a
                            href={spot.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="glass-chip !py-1 !text-[11px]"
                          >
                            Karte öffnen
                          </a>
                        ) : null}
                        {spot.info_url ? (
                          <a
                            href={spot.info_url}
                            target="_blank"
                            rel="noreferrer"
                            className="glass-chip !py-1 !text-[11px]"
                          >
                            {isAirbnbUrl(spot.info_url) ? "Bei Airbnb öffnen" : "Seite öffnen"}
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {isOpen && (
                  <EditSpotForm
                    vacationId={vacationId}
                    spot={spot}
                    deleting={deletingId === spot.id}
                    onDelete={() => onDelete(spot.id)}
                    onDone={() => {
                      setEditingId(null);
                      onChanged();
                    }}
                    onToggleRelevant={() => toggleRelevant(spot)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
