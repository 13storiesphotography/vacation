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
import {
  emptySummary,
  type RaterOption,
  type SpotRating,
  type SpotRatingSummary,
} from "@/lib/ratings";
import { parseLatLngFromMapsUrl } from "@/lib/geo";
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

function MapsUrlField({ defaultValue = "" }: { defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setMessage("Position kommt automatisch aus dem Maps-Link.");
      setOk(null);
      return;
    }

    const local = parseLatLngFromMapsUrl(trimmed);
    if (local) {
      setOk(true);
      setMessage(`Position erkannt: ${local.lat.toFixed(5)}, ${local.lng.toFixed(5)}`);
      return;
    }

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const result = await previewMapsCoords(trimmed);
        setOk(result.ok);
        setMessage(result.message);
      });
    }, 400);

    return () => window.clearTimeout(handle);
  }, [url]);

  return (
    <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
      Google Maps Link
      <input
        name="maps_url"
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
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
      onClick={onOpen}
      aria-label={`${spot.name} bearbeiten`}
      className={`relative shrink-0 overflow-hidden rounded-[12px] bg-[linear-gradient(160deg,#c5d5d0,#8aa4ad)] ${
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
      <span className="absolute bottom-0.5 left-0.5 inline-flex rounded-full bg-white/95 p-0.5 shadow-sm">
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
}: {
  spot?: Spot | null;
  showOvernight: boolean;
  category: SpotCategory;
  onCategoryChange: (value: SpotCategory) => void;
}) {
  return (
    <>
      <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Name
        <input
          name="name"
          required
          defaultValue={spot?.name ?? ""}
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          placeholder="z. B. Stellplatz Söderåsen"
        />
      </label>

      <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Kategorie
        <select
          name="category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as SpotCategory)}
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
        >
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {categoryLabels[option]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Beschreibung
        <textarea
          name="description"
          defaultValue={spot?.description ?? ""}
          className="mt-1.5 min-h-20 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
        />
      </label>

      <MapsUrlField defaultValue={spot?.maps_url ?? ""} />

      <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Vorschaubild (optional)
        {spot?.image_url && !spot.image_manual ? (
          <input type="hidden" name="previous_image_url" value={spot.image_url} />
        ) : null}
        <input
          name="image_url"
          type="url"
          defaultValue={spot?.image_manual ? (spot.image_url ?? "") : ""}
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          placeholder="https://… (leer = automatisch aus Maps)"
        />
        <span className="mt-1 block text-[11px] font-medium text-[var(--ink-faint)]">
          Leer lassen = Kartenausschnitt zur Position. Eigene Bild-URL überschreibt das.
          {spot?.image_url && !spot.image_manual
            ? " Aktuell: automatisch gesetzt."
            : ""}
        </span>
        {spot?.image_url && !spot.image_manual ? (
          <span className="mt-2 block overflow-hidden rounded-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spot.image_url}
              alt=""
              className="h-28 w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </span>
        ) : null}
      </label>

      <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Buchung / Info Link
        <input
          name="info_url"
          type="url"
          defaultValue={spot?.info_url ?? ""}
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          placeholder="https://park4night.com/..."
        />
      </label>

      {showOvernight && (
        <>
          <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
            Übernachtung
            <select
              name="overnight_cost"
              defaultValue={spot?.overnight_cost ?? ""}
              className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
            >
              <option value="">Keine Angabe</option>
              <option value="frei">Frei</option>
              <option value="kostenpflichtig">Kostenpflichtig</option>
            </select>
          </label>
          <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
            Preis-Hinweis
            <input
              name="price_hint"
              defaultValue={spot?.price_hint ?? ""}
              className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
              placeholder="ab 280 SEK"
            />
          </label>
        </>
      )}

      <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Tags (kommagetrennt)
        <input
          name="tags"
          defaultValue={(spot?.tags ?? []).join(", ")}
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
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

  useEffect(() => {
    if (state.ok) onCreated();
  }, [state.ok, onCreated]);

  return (
    <form action={action} className="ios-group mt-3 p-4">
      <input type="hidden" name="vacation_id" value={vacationId} />
      <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Neuen Spot hinzufügen</p>
      <SpotFormFields
        category={category}
        onCategoryChange={setCategory}
        showOvernight={category === "stellplatz"}
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

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <div className="border-t border-[var(--separator)] bg-black/[0.015] p-4">
      <form action={action}>
        <input type="hidden" name="vacation_id" value={vacationId} />
        <input type="hidden" name="spot_id" value={spot.id} />
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
            Spot bearbeiten
          </p>
          <button
            type="button"
            className="shrink-0 rounded-[10px] px-2.5 py-1 text-[13px] font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/8 disabled:opacity-50"
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
          showOvernight={category === "stellplatz"}
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
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            filter === "alle" ? "bg-[var(--fjord)] text-white" : "bg-black/5 text-[var(--ink-soft)]"
          }`}
        >
          Alle
        </button>
        {categoryOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              filter === option
                ? "bg-[var(--fjord)] text-white"
                : "bg-black/5 text-[var(--ink-soft)]"
            }`}
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
          className="rounded-full border-0 bg-black/5 px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] outline-none"
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
                <div className="ios-row !items-center !py-2.5">
                  <SpotThumb
                    spot={spot}
                    size={52}
                    selected={isOpen}
                    onOpen={openEdit}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {spot.maps_url ? (
                          <a
                            href={spot.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-[15px] font-semibold leading-tight text-[var(--fjord)] hover:underline"
                          >
                            {spot.name}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={openEdit}
                            className="block w-full truncate text-left text-[15px] font-semibold leading-tight"
                          >
                            {spot.name}
                          </button>
                        )}
                        <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-[12px] leading-snug text-[var(--ink-soft)]">
                          <button
                            type="button"
                            onClick={openEdit}
                            className="min-w-0 truncate text-left"
                          >
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
                          </button>
                          {spot.info_url ? (
                            <a
                              href={spot.info_url}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 font-semibold text-[var(--fjord)]"
                            >
                              Info
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
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
                      <button
                        type="button"
                        onClick={openEdit}
                        className="mt-1 line-clamp-1 w-full text-left text-[12px] leading-snug text-[var(--ink-soft)]"
                      >
                        {spot.description}
                      </button>
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
