"use client";

import { useActionState, useEffect } from "react";
import type { Database } from "@/lib/database.types";
import { GlassDateField } from "@/components/ui/glass-date-field";
import { updateVacation, type VacationActionState } from "./vacation-actions";

type Vacation = Database["public"]["Tables"]["vacations"]["Row"];

const initialState: VacationActionState = {};

export function EditVacationForm({
  vacation,
  onDone,
}: {
  vacation: Vacation;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateVacation, initialState);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="ios-group mt-3 p-5">
      <input type="hidden" name="vacation_id" value={vacation.id} />
      <h2 className="display text-2xl">Urlaub bearbeiten</h2>

      <label className="form-label mt-4">
        Titel
        <input
          name="title"
          required
          defaultValue={vacation.title}
          className="glass-field mt-1.5 px-3 py-3"
        />
      </label>

      <label className="form-label mt-4">
        Art
        <select
          name="type"
          defaultValue={vacation.type}
          className="glass-field mt-1.5 px-3 py-3"
        >
          <option value="van">Wohnmobil / Van</option>
          <option value="camping">Camping</option>
          <option value="hotel">Hotel</option>
          <option value="other">Sonstiges</option>
        </select>
      </label>

      <label className="form-label mt-4">
        Region
        <input
          name="region"
          defaultValue={vacation.region ?? ""}
          className="glass-field mt-1.5 px-3 py-3"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="form-label">
          Start
          <GlassDateField
            name="start_date"
            required
            defaultValue={vacation.start_date}
          />
        </label>
        <label className="form-label">
          Ende
          <GlassDateField
            name="end_date"
            required
            defaultValue={vacation.end_date}
          />
        </label>
      </div>

      <label className="form-label mt-4">
        Beschreibung
        <textarea
          name="description"
          defaultValue={vacation.description ?? ""}
          className="glass-field mt-1.5 min-h-24 px-3 py-3"
        />
      </label>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
        Start / Zuhause
      </p>
      <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
        Für Anreise und Rückfahrt in Sprit- und Routenschätzung.
      </p>
      <label className="form-label mt-3">
        Bezeichnung
        <input
          name="home_label"
          defaultValue={vacation.home_label ?? "Zuhause"}
          className="glass-field mt-1.5 px-3 py-3"
          placeholder="Zuhause"
        />
      </label>
      <label className="form-label mt-3">
        Google-Maps-Link
        <input
          name="home_maps_url"
          type="url"
          inputMode="url"
          autoComplete="off"
          defaultValue={vacation.home_maps_url ?? ""}
          className="glass-field mt-1.5 px-3 py-3"
          placeholder="https://maps.google.com/… oder maps.app.goo.gl/…"
        />
      </label>
      <label className="mt-3 flex items-center gap-3 text-[14px] font-semibold">
        <input
          type="checkbox"
          name="include_home_in_route"
          defaultChecked={vacation.include_home_in_route !== false}
          className="h-4 w-4 accent-[var(--fjord)]"
        />
        Anreise & Rückfahrt einrechnen
      </label>

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
