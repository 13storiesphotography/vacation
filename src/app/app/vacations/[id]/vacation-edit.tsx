"use client";

import { useActionState, useEffect } from "react";
import type { Database } from "@/lib/database.types";
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
          <input
            name="start_date"
            type="date"
            required
            defaultValue={vacation.start_date}
            className="glass-field mt-1.5 px-3 py-3"
          />
        </label>
        <label className="form-label">
          Ende
          <input
            name="end_date"
            type="date"
            required
            defaultValue={vacation.end_date}
            className="glass-field mt-1.5 px-3 py-3"
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
