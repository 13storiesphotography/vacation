"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  categoryLabels,
  categoryOptions,
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
import { CategoryIcon } from "@/components/category-icon";
import { isStaleServerActionError, reloadForStaleDeployment } from "@/lib/stale-action";
import {
  checkoutFromNights,
  formatStayRange,
  stayNightCount,
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
}: {
  value: string;
  onChange: (value: string) => void;
  onResolved: (result: SmartLinkResult) => void;
}) {
  const [remote, setRemote] = useState<{
    ok: boolean | null;
    message: string | null;
    providerLabel: string | null;
  }>({ ok: null, message: null, providerLabel: null });
  const [pending, startTransition] = useTransition();

  const trimmed = value.trim();
  const idleMessage =
    "Einfach Link einfügen — Google Maps, Airbnb, Park4Night, Booking, …";
  const ok = !trimmed ? null : remote.ok;
  const message = !trimmed ? idleMessage : remote.message;
  const providerLabel = !trimmed ? null : remote.providerLabel;

  useEffect(() => {
    if (!trimmed) return;
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
  }, [trimmed]);

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
  const showImage = Boolean(spot.image_url) && !broken;

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
          src={spot.image_url!}
          alt=""
          className="h-full w-full object-cover"
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
  stayStatus,
  onStayStatusChange,
  onSmartResolved,
  detailsOpen,
  onDetailsOpenChange,
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
  stayStatus: string;
  onStayStatusChange: (value: string) => void;
  onSmartResolved: (result: SmartLinkResult) => void;
  detailsOpen: boolean;
  onDetailsOpenChange: (value: boolean) => void;
}) {
  const nights = stayNightCount(stayCheckIn || null, stayCheckOut || null);
  const staySummary = formatStayRange(stayCheckIn || null, stayCheckOut || null);

  return (
    <>
      <SmartLinkField
        value={pasteUrl}
        onChange={onPasteUrlChange}
        onResolved={onSmartResolved}
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

      {showOvernight && (
        <div className="mt-3 space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
            Aufenthalt
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">
              Anreise
              <input
                type="date"
                name="stay_check_in"
                value={stayCheckIn}
                onChange={(e) => {
                  const nextIn = e.target.value;
                  onStayCheckInChange(nextIn);
                  if (nextIn && !stayCheckOut) {
                    onStayCheckOutChange(checkoutFromNights(nextIn, 1));
                  } else if (nextIn && stayCheckOut && stayCheckOut <= nextIn) {
                    onStayCheckOutChange(checkoutFromNights(nextIn, 1));
                  }
                }}
                className="glass-field mt-1.5 px-3 py-3"
              />
            </label>
            <label className="form-label">
              Abreise
              <input
                type="date"
                name="stay_check_out"
                value={stayCheckOut}
                onChange={(e) => onStayCheckOutChange(e.target.value)}
                className="glass-field mt-1.5 px-3 py-3"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">
              Nächte
              <input
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                value={nights > 0 ? nights : ""}
                placeholder="z. B. 2"
                onChange={(e) => {
                  const raw = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(raw) || raw < 1) return;
                  const base = stayCheckIn || new Date().toISOString().slice(0, 10);
                  if (!stayCheckIn) onStayCheckInChange(base);
                  onStayCheckOutChange(checkoutFromNights(base, raw));
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
          {staySummary ? (
            <p className="text-[12px] text-[var(--ink-soft)]">
              {staySummary}
              {stayStatus
                ? ` · ${stayStatusLabels[stayStatus as StayStatus] ?? stayStatus}`
                : ""}
              {" · "}wird im Plan automatisch als Übernachtung gesetzt
            </p>
          ) : (
            <p className="text-[12px] text-[var(--ink-faint)]">
              Optional: Zeitraum setzen — dann landet der Spot an den richtigen Nächten im Plan.
            </p>
          )}
        </div>
      )}

      {(imageUrl || (spot?.image_url && !spot.image_manual)) && (
        <span className="mt-3 block overflow-hidden rounded-[14px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl || spot?.image_url || ""}
            alt=""
            className="h-36 w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </span>
      )}

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
            <input
              type="url"
              value={mapsUrl}
              onChange={(e) => onMapsUrlChange(e.target.value)}
              className="glass-field mt-1.5 px-3 py-3"
              placeholder="Optional, wenn schon oben erkannt"
            />
          </label>

          <label className="form-label mt-3">
            Buchungs-/Info-Link
            <input
              type="url"
              value={infoUrl}
              onChange={(e) => onInfoUrlChange(e.target.value)}
              className="glass-field mt-1.5 px-3 py-3"
              placeholder="Airbnb, Park4Night, Booking, …"
            />
          </label>

          <label className="form-label mt-3">
            Vorschaubild-URL
            {spot?.image_url && !spot.image_manual && !imageUrl ? (
              <input type="hidden" name="previous_image_url" value={spot.image_url} />
            ) : null}
            <input
              name="image_url"
              type="url"
              value={imageUrl}
              onChange={(e) => onImageUrlChange(e.target.value)}
              className="glass-field mt-1.5 px-3 py-3"
              placeholder="Leer = automatisch"
            />
          </label>

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

          <label className="form-label mt-3">
            Tags (kommagetrennt)
            <input
              name="tags"
              defaultValue={(spot?.tags ?? []).join(", ")}
              className="glass-field mt-1.5 px-3 py-3"
              placeholder="Wald, ruhig, Strom"
            />
          </label>
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
              <input type="hidden" name="stay_status" value="" />
            </>
          ) : null}
          <input type="hidden" name="tags" value={(spot?.tags ?? []).join(", ")} />
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
  options.setCategory(result.suggestedCategory);
  // Keep the pasted source link visible when we also derived a Maps URL (e.g. Airbnb coords).
  options.setPasteUrl(result.infoUrl || result.mapsUrl || "");

  if (result.mapsUrl) options.setMapsUrl(result.mapsUrl);
  if (result.infoUrl) options.setInfoUrl(result.infoUrl);

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
  if (result.imageUrl) options.setImageUrl(result.imageUrl);
  if (result.overnightCost) options.setOvernightCost(result.overnightCost);
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
  const [pasteUrl, setPasteUrl] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [infoUrl, setInfoUrl] = useState("");
  const [overnightCost, setOvernightCost] = useState("");
  const [stayCheckIn, setStayCheckIn] = useState("");
  const [stayCheckOut, setStayCheckOut] = useState("");
  const [stayStatus, setStayStatus] = useState("");
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
        stayStatus={stayStatus}
        onStayStatusChange={setStayStatus}
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
  deleting = false,
}: {
  vacationId: string;
  spot: Spot;
  onDone: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const [state, action, pending] = useActionState(updateSpot, initialState);
  const [category, setCategory] = useState<SpotCategory>(spot.category);
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description ?? "");
  const [imageUrl, setImageUrl] = useState(
    spot.image_manual ? (spot.image_url ?? "") : "",
  );
  const [mapsUrl, setMapsUrl] = useState(spot.maps_url ?? "");
  const [infoUrl, setInfoUrl] = useState(spot.info_url ?? "");
  const [pasteUrl, setPasteUrl] = useState(spot.maps_url || spot.info_url || "");
  const [overnightCost, setOvernightCost] = useState(spot.overnight_cost ?? "");
  const [stayCheckIn, setStayCheckIn] = useState(spot.stay_check_in ?? "");
  const [stayCheckOut, setStayCheckOut] = useState(spot.stay_check_out ?? "");
  const [stayStatus, setStayStatus] = useState(spot.stay_status ?? "");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <div className="glass-subpanel-flush">
      <form action={action}>
        <input type="hidden" name="vacation_id" value={vacationId} />
        <input type="hidden" name="spot_id" value={spot.id} />
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
            Spot bearbeiten
          </p>
          <button
            type="button"
            className="glass-chip glass-chip-danger shrink-0"
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
          stayStatus={stayStatus}
          onStayStatusChange={setStayStatus}
          detailsOpen={detailsOpen}
          onDetailsOpenChange={setDetailsOpen}
          onSmartResolved={(result) =>
            applySmartLinkResult(result, {
              fillEmptyOnly: true,
              currentName: name,
              currentDescription: description,
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
}) {
  const [filter, setFilter] = useState<"alle" | SpotCategory>("alle");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleSpots = useMemo(() => {
    const list =
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
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          aria-label="Sortierung"
          className="glass-field max-w-[11rem] px-3 py-2 text-[13px] font-semibold"
        >
          <option value="newest">Neueste</option>
          <option value="favorites">Favoriten</option>
          <option value="avg">Beste Ø</option>
          <option value="mine">Meine Tops</option>
        </select>
      </div>

      {error && <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>}

      <div className="ios-group">
        {visibleSpots.length === 0 ? (
          <div className="p-5 text-[14px] text-[var(--ink-soft)]">
            Noch keine Spots in dieser Kategorie.
          </div>
        ) : (
          visibleSpots.map((spot) => {
            const summary = summaries[spot.id] ?? emptySummary();
            const isOpen = editingId === spot.id;
            function openEdit() {
              setEditingId((current) => (current === spot.id ? null : spot.id));
            }
            return (
              <div key={spot.id}>
                <div
                  className={`ios-row !items-center !py-2.5 cursor-pointer ${
                    isOpen ? "bg-[rgba(15,110,140,0.06)]" : ""
                  }`}
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
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12px] leading-snug text-[var(--ink-soft)]">
                          <span className="min-w-0 truncate">
                            {categoryLabels[spot.category]}
                            {spot.overnight_cost ? ` · ${spot.overnight_cost}` : ""}
                            {spot.price_hint ? ` · ${spot.price_hint}` : ""}
                            {formatStayRange(spot.stay_check_in, spot.stay_check_out)
                              ? ` · ${formatStayRange(spot.stay_check_in, spot.stay_check_out)}`
                              : ""}
                            {spot.stay_status
                              ? ` · ${stayStatusLabels[spot.stay_status]}`
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
                          {spot.maps_url ? (
                            <a
                              href={spot.maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 font-semibold text-[var(--fjord)]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Maps
                            </a>
                          ) : null}
                          {spot.info_url ? (
                            <a
                              href={spot.info_url}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 font-semibold text-[var(--fjord)]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Info
                            </a>
                          ) : null}
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
