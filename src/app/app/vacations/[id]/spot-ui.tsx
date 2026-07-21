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
import { previewMapsCoords } from "./maps-coords-actions";
import { previewAirbnbListing } from "./airbnb-actions";
import {
  emptySummary,
  type RaterOption,
  type SpotRating,
  type SpotRatingSummary,
} from "@/lib/ratings";
import { parseLatLngFromMapsUrl } from "@/lib/geo";
import { isOvernightCategory } from "@/lib/overnight";
import { isAirbnbUrl } from "@/lib/airbnb";
import { CategoryIcon } from "@/components/category-icon";

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

function MapsUrlField({
  defaultValue = "",
  required = true,
}: {
  defaultValue?: string;
  required?: boolean;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [remote, setRemote] = useState<{
    ok: boolean | null;
    message: string | null;
  }>({ ok: null, message: null });
  const [pending, startTransition] = useTransition();

  const trimmed = url.trim();
  const local = trimmed ? parseLatLngFromMapsUrl(trimmed) : null;
  const idleMessage = required
    ? "Position kommt automatisch aus dem Maps-Link."
    : "Optional — für die Karte empfohlen, bei Airbnb nicht zwingend.";
  const ok = !trimmed ? null : local ? true : remote.ok;
  const message = !trimmed
    ? idleMessage
    : local
      ? `Position erkannt: ${local.lat.toFixed(5)}, ${local.lng.toFixed(5)}`
      : remote.message;

  useEffect(() => {
    if (!trimmed || local) {
      return;
    }

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const result = await previewMapsCoords(trimmed);
        setRemote({ ok: result.ok, message: result.message });
      });
    }, 400);

    return () => window.clearTimeout(handle);
  }, [trimmed, local]);

  return (
    <label className="form-label mt-3">
      Google Maps Link{required ? "" : " (optional)"}
      <input
        name="maps_url"
        type="url"
        required={required}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setRemote({ ok: null, message: null });
        }}
        className="glass-field mt-1.5 px-3 py-3"
        placeholder="https://maps.app.goo.gl/… oder maps.google.com/…"
      />
      <span
        className={`mt-1 block text-[11px] font-medium ${
          ok === true
            ? "text-[var(--pine)]"
            : ok === false
              ? "text-[var(--danger)]"
              : "text-[var(--ink-faint)]"
        }`}
      >
        {pending ? "Position wird gelesen…" : (message ?? "")}
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

function ListingUrlField({
  value,
  onChange,
  onAirbnbApplied,
}: {
  value: string;
  onChange: (value: string) => void;
  onAirbnbApplied: (meta: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    locationHint?: string | null;
    canonicalUrl?: string;
  }) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = value.trim();
  const idleMessage =
    "Airbnb-Link für Unterkunft — oder park4night / Buchungsseite als Info.";
  const nonAirbnbMessage = "Als Info-/Buchungslink gespeichert.";
  const displayOk = !trimmed || !isAirbnbUrl(trimmed) ? null : ok;
  const displayMessage = !trimmed
    ? idleMessage
    : !isAirbnbUrl(trimmed)
      ? nonAirbnbMessage
      : message;

  useEffect(() => {
    if (!trimmed || !isAirbnbUrl(trimmed)) {
      return;
    }

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const result = await previewAirbnbListing(trimmed);
        setOk(result.ok);
        setMessage(result.message);
        if (result.ok) {
          onAirbnbApplied({
            title: result.title,
            description: result.description,
            imageUrl: result.imageUrl,
            locationHint: result.locationHint,
            canonicalUrl: result.canonicalUrl ?? trimmed,
          });
        }
      });
    }, 450);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  return (
    <label className="form-label mt-3">
      Airbnb / Buchungslink
      <input
        name="info_url"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-field mt-1.5 px-3 py-3"
        placeholder="https://www.airbnb.de/rooms/… oder park4night.com/…"
      />
      <span
        className={`mt-1 block text-[11px] font-medium ${
          displayOk === true
            ? "text-[var(--pine)]"
            : displayOk === false
              ? "text-[var(--danger)]"
              : "text-[var(--ink-faint)]"
        }`}
      >
        {pending ? "Airbnb wird gelesen…" : (displayMessage ?? "")}
      </span>
    </label>
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
  infoUrl,
  onInfoUrlChange,
  onAirbnbApplied,
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
  infoUrl: string;
  onInfoUrlChange: (value: string) => void;
  onAirbnbApplied: (meta: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    locationHint?: string | null;
    canonicalUrl?: string;
  }) => void;
}) {
  const airbnbMode = isAirbnbUrl(infoUrl);
  const mapsRequired = !airbnbMode;

  return (
    <>
      <ListingUrlField
        value={infoUrl}
        onChange={onInfoUrlChange}
        onAirbnbApplied={onAirbnbApplied}
      />

      <label className="form-label mt-3">
        Name
        <input
          name="name"
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="glass-field mt-1.5 px-3 py-3"
          placeholder="z. B. Airbnb am See oder Stellplatz Söderåsen"
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

      <label className="form-label mt-3">
        Beschreibung
        <textarea
          name="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="glass-field mt-1.5 min-h-20 px-3 py-3"
        />
      </label>

      <MapsUrlField defaultValue={spot?.maps_url ?? ""} required={mapsRequired} />

      <label className="form-label mt-3">
        Vorschaubild (optional)
        {spot?.image_url && !spot.image_manual && !imageUrl ? (
          <input type="hidden" name="previous_image_url" value={spot.image_url} />
        ) : null}
        <input
          name="image_url"
          type="url"
          value={imageUrl}
          onChange={(e) => onImageUrlChange(e.target.value)}
          className="glass-field mt-1.5 px-3 py-3"
          placeholder="https://… (leer = automatisch aus Maps/Airbnb)"
        />
        <span className="mt-1 block text-[11px] font-medium text-[var(--ink-faint)]">
          Bei Airbnb oft automatisch. Sonst Kartenausschnitt zur Position.
        </span>
        {(imageUrl || (spot?.image_url && !spot.image_manual)) && (
          <span className="mt-2 block overflow-hidden rounded-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl || spot?.image_url || ""}
              alt=""
              className="h-28 w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </span>
        )}
      </label>

      {showOvernight && (
        <>
          <label className="form-label mt-3">
            Übernachtung
            <select
              name="overnight_cost"
              defaultValue={
                spot?.overnight_cost ?? (airbnbMode ? "kostenpflichtig" : "")
              }
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
    </>
  );
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
  const [infoUrl, setInfoUrl] = useState("");

  useEffect(() => {
    if (state.ok) onCreated();
  }, [state.ok, onCreated]);

  function applyAirbnb(meta: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    locationHint?: string | null;
    canonicalUrl?: string;
  }) {
    setCategory("unterkunft");
    if (meta.canonicalUrl) setInfoUrl(meta.canonicalUrl);
    if (meta.title) setName(meta.title);
    else if (meta.locationHint) setName(`Airbnb · ${meta.locationHint}`);
    if (meta.description) setDescription(meta.description);
    if (meta.imageUrl) setImageUrl(meta.imageUrl);
  }

  return (
    <form action={action} className="ios-group mt-3 p-4">
      <input type="hidden" name="vacation_id" value={vacationId} />
      <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Neuen Spot hinzufügen</p>
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
        infoUrl={infoUrl}
        onInfoUrlChange={setInfoUrl}
        onAirbnbApplied={applyAirbnb}
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
  const [infoUrl, setInfoUrl] = useState(spot.info_url ?? "");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  function applyAirbnb(meta: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    locationHint?: string | null;
    canonicalUrl?: string;
  }) {
    setCategory("unterkunft");
    if (meta.canonicalUrl) setInfoUrl(meta.canonicalUrl);
    if (meta.title && (!name.trim() || name === spot.name)) setName(meta.title);
    if (meta.description && !description.trim()) setDescription(meta.description);
    if (meta.imageUrl) setImageUrl(meta.imageUrl);
  }

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
          infoUrl={infoUrl}
          onInfoUrlChange={setInfoUrl}
          onAirbnbApplied={applyAirbnb}
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
