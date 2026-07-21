"use client";

import { useActionState, useEffect, useState } from "react";
import {
  categoryLabels,
  categoryOptions,
  categoryTone,
  type SpotCategory,
} from "@/lib/spots";
import type { Database } from "@/lib/database.types";
import { createSpot, updateSpot, type SpotActionState } from "./spot-actions";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

const initialState: SpotActionState = {};

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

export function SpotList({
  vacationId,
  spots,
  onChanged,
}: {
  vacationId: string;
  spots: Spot[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<"alle" | SpotCategory>("alle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered =
    filter === "alle" ? spots : spots.filter((spot) => spot.category === filter);

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

      {error && <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>}

      <div className="ios-group">
        {filtered.length === 0 ? (
          <div className="p-5 text-[14px] text-[var(--ink-soft)]">
            Noch keine Spots in dieser Kategorie.
          </div>
        ) : (
          filtered.map((spot) => (
            <div key={spot.id}>
              <div className="ios-row !items-start">
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: categoryTone[spot.category] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{spot.name}</p>
                  <p className="text-[12px] text-[var(--ink-soft)]">
                    {categoryLabels[spot.category]}
                    {spot.overnight_cost ? ` · ${spot.overnight_cost}` : ""}
                    {spot.price_hint ? ` · ${spot.price_hint}` : ""}
                  </p>
                  {spot.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
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
          ))
        )}
      </div>
    </div>
  );
}
