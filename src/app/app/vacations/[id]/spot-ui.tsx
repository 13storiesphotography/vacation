"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  categoryLabels,
  categoryOptions,
  categoryTone,
  type SpotCategory,
} from "@/lib/spots";
import type { Database } from "@/lib/database.types";
import { createSpot, updateSpot, type SpotActionState } from "./spot-actions";
import { upsertSpotRating } from "./rating-actions";
import {
  emptySummary,
  type RaterOption,
  type SpotRating,
  type SpotRatingSummary,
} from "@/lib/ratings";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

const initialState: SpotActionState = {};

function Stars({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number | null;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const starSize = size === "sm" ? "text-[14px]" : "text-[18px]";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (value ?? 0) >= star;
        if (readOnly) {
          return (
            <span
              key={star}
              className={`${starSize} ${active ? "text-[var(--sun)]" : "text-black/15"}`}
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
            onClick={() => onChange?.(star)}
            aria-label={`${star} Sterne`}
          >
            ★
          </button>
        );
      })}
    </div>
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

      <label className="mt-3 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Google Maps Link
        <input
          name="maps_url"
          type="url"
          defaultValue={spot?.maps_url ?? ""}
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          placeholder="https://maps.google.com/..."
        />
        <span className="mt-1 block text-[11px] font-medium text-[var(--ink-faint)]">
          Enthält der Link Koordinaten, werden Lat/Lng automatisch gesetzt.
        </span>
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

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-[13px] font-semibold text-[var(--ink-soft)]">
          Lat
          <input
            name="lat"
            inputMode="decimal"
            defaultValue={spot?.lat ?? ""}
            className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          />
        </label>
        <label className="block text-[13px] font-semibold text-[var(--ink-soft)]">
          Lng
          <input
            name="lng"
            inputMode="decimal"
            defaultValue={spot?.lng ?? ""}
            className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          />
        </label>
      </div>

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
}: {
  vacationId: string;
  spot: Spot;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateSpot, initialState);
  const [category, setCategory] = useState<SpotCategory>(spot.category);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="border-t border-[var(--separator)] p-4">
      <input type="hidden" name="vacation_id" value={vacationId} />
      <input type="hidden" name="spot_id" value={spot.id} />
      <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Spot bearbeiten</p>
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
        <button type="submit" className="cta flex-1" disabled={pending}>
          {pending ? "…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

type SortMode = "newest" | "favorites" | "avg" | "mine";
type ViewMode = "avg" | "mine" | string; // string = other user id

export function SpotList({
  vacationId,
  spots,
  ratings,
  summaries,
  raters,
  currentUserId,
  onChanged,
}: {
  vacationId: string;
  spots: Spot[];
  ratings: SpotRating[];
  summaries: Record<string, SpotRatingSummary>;
  raters: RaterOption[];
  currentUserId: string | null;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<"alle" | SpotCategory>("alle");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("avg");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ratingsBySpotUser = useMemo(() => {
    const map = new Map<string, SpotRating>();
    for (const rating of ratings) {
      map.set(`${rating.spot_id}:${rating.user_id}`, rating);
    }
    return map;
  }, [ratings]);

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
      return 0; // newest already from query order
    });

    if (sortMode === "favorites") {
      // keep non-favorites after favorites, already sorted
    }

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
    startTransition(async () => {
      setError(null);
      const result = await upsertSpotRating({
        vacationId,
        spotId,
        ...patch,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onChanged();
    });
  }

  function displayedRating(spotId: string): { label: string; value: number | null; meta: string } {
    const summary = summaries[spotId] ?? emptySummary();
    if (viewMode === "avg") {
      return {
        label: "Gesamt",
        value: summary.average,
        meta: summary.count ? `${summary.count} Bewertung${summary.count === 1 ? "" : "en"}` : "noch keine",
      };
    }
    if (viewMode === "mine") {
      return {
        label: "Meine",
        value: summary.myRating,
        meta: summary.myFavorite ? "Favorit" : "—",
      };
    }
    const other = ratingsBySpotUser.get(`${spotId}:${viewMode}`);
    const rater = raters.find((entry) => entry.userId === viewMode);
    return {
      label: rater?.label ?? "Mitglied",
      value: other?.rating ?? null,
      meta: other?.is_favorite ? "Favorit" : "—",
    };
  }

  return (
    <div className="mt-3">
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter("alle")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
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
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              filter === option
                ? "bg-[var(--fjord)] text-white"
                : "bg-black/5 text-[var(--ink-soft)]"
            }`}
          >
            {categoryLabels[option]}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-[var(--ink-soft)]">
          Sortierung
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="mt-1 w-full rounded-[12px] border-0 bg-black/5 px-3 py-2.5 text-[14px] outline-none"
          >
            <option value="newest">Neueste zuerst</option>
            <option value="favorites">Meine Favoriten zuerst</option>
            <option value="avg">Beste Gesamtbewertung</option>
            <option value="mine">Meine Top-Spots</option>
          </select>
        </label>
        <label className="block text-[12px] font-semibold text-[var(--ink-soft)]">
          Bewertung anzeigen
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="mt-1 w-full rounded-[12px] border-0 bg-black/5 px-3 py-2.5 text-[14px] outline-none"
          >
            <option value="avg">Gesamt (Durchschnitt)</option>
            <option value="mine">Meine Bewertung</option>
            {raters
              .filter((rater) => rater.userId !== currentUserId)
              .map((rater) => (
                <option key={rater.userId} value={rater.userId}>
                  {rater.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      {error && <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>}
      {pending && <p className="mb-2 text-[12px] text-[var(--ink-faint)]">Speichere…</p>}

      <div className="ios-group">
        {visibleSpots.length === 0 ? (
          <div className="p-5 text-[14px] text-[var(--ink-soft)]">
            Noch keine Spots in dieser Kategorie.
          </div>
        ) : (
          visibleSpots.map((spot) => {
            const summary = summaries[spot.id] ?? emptySummary();
            const shown = displayedRating(spot.id);
            return (
              <div key={spot.id}>
                <div className="ios-row !items-start">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: categoryTone[spot.category] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold">{spot.name}</p>
                        <p className="text-[12px] text-[var(--ink-soft)]">
                          {categoryLabels[spot.category]}
                          {spot.overnight_cost ? ` · ${spot.overnight_cost}` : ""}
                          {spot.price_hint ? ` · ${spot.price_hint}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`text-[20px] leading-none ${
                          summary.myFavorite ? "text-[var(--sun)]" : "text-black/20"
                        }`}
                        aria-label="Favorit"
                        onClick={() =>
                          saveRating(spot.id, { isFavorite: !summary.myFavorite })
                        }
                      >
                        {summary.myFavorite ? "★" : "☆"}
                      </button>
                    </div>

                    <div className="mt-2 rounded-[12px] bg-black/[0.03] px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                            {shown.label}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Stars value={shown.value} readOnly size="sm" />
                            <span className="text-[12px] text-[var(--ink-soft)]">
                              {shown.value ?? "–"} · {shown.meta}
                            </span>
                          </div>
                        </div>
                        {summary.favoriteCount > 0 && (
                          <span className="text-[11px] font-semibold text-[var(--sun)]">
                            {summary.favoriteCount}× Favorit
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                        Meine Bewertung
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <Stars
                          value={summary.myRating}
                          onChange={(value) => saveRating(spot.id, { rating: value })}
                        />
                        {summary.myRating && (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-[var(--ink-soft)]"
                            onClick={() => saveRating(spot.id, { rating: null })}
                          >
                            Zurücksetzen
                          </button>
                        )}
                      </div>
                    </div>

                    {spot.description && (
                      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                        {spot.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {spot.maps_url && (
                        <a
                          href={spot.maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-[var(--fjord-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--fjord)]"
                        >
                          Maps
                        </a>
                      )}
                      {spot.info_url && (
                        <a
                          href={spot.info_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-soft)]"
                        >
                          Info / Buchung
                        </a>
                      )}
                      {(spot.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-[var(--fjord)]"
                        onClick={() =>
                          setEditingId((current) => (current === spot.id ? null : spot.id))
                        }
                      >
                        {editingId === spot.id ? "Schließen" : "Bearbeiten"}
                      </button>
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-[var(--danger)]"
                        disabled={deletingId === spot.id}
                        onClick={() => onDelete(spot.id)}
                      >
                        {deletingId === spot.id ? "…" : "Löschen"}
                      </button>
                    </div>
                  </div>
                </div>
                {editingId === spot.id && (
                  <EditSpotForm
                    vacationId={vacationId}
                    spot={spot}
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
