"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createVacation, type CreateVacationState } from "./actions";

const initialState: CreateVacationState = {};

export default function NewVacationPage() {
  const [state, action, pending] = useActionState(createVacation, initialState);

  return (
    <main className="shell mx-auto min-h-screen w-full max-w-lg px-5 py-8">
      <Link href="/app" className="text-[13px] font-semibold text-[var(--fjord)]">
        ← Zurück
      </Link>
      <form action={action} className="ios-group mt-4 p-6">
        <h1 className="display text-2xl">Neuer Urlaub</h1>
        <label className="mt-5 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Titel
          <input
            name="title"
            className="glass-field mt-1.5 px-3 py-3"
            required
            defaultValue="Schweden Van Trip"
          />
        </label>
        <label className="mt-4 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Art
          <select
            name="type"
            className="glass-field mt-1.5 px-3 py-3"
            defaultValue="van"
          >
            <option value="van">Wohnmobil / Van</option>
            <option value="camping">Camping</option>
            <option value="hotel">Hotel</option>
            <option value="other">Sonstiges</option>
          </select>
        </label>
        <label className="mt-4 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Region
          <input
            name="region"
            className="glass-field mt-1.5 px-3 py-3"
            defaultValue="Schweden · Süd nach Nord"
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-[13px] font-semibold text-[var(--ink-soft)]">
            Start
            <input
              name="start_date"
              className="glass-field mt-1.5 px-3 py-3"
              type="date"
              required
              defaultValue="2026-07-10"
            />
          </label>
          <label className="block text-[13px] font-semibold text-[var(--ink-soft)]">
            Ende
            <input
              name="end_date"
              className="glass-field mt-1.5 px-3 py-3"
              type="date"
              required
              defaultValue="2026-07-24"
            />
          </label>
        </div>
        <label className="mt-4 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Beschreibung
          <textarea
            name="description"
            className="glass-field mt-1.5 min-h-24 px-3 py-3"
            defaultValue="Zwei Wochen mit dem Van von Skåne bis zur Höga Kusten."
          />
        </label>
        {state.error && <p className="mt-4 text-[14px] text-[var(--danger)]">{state.error}</p>}
        <button type="submit" className="cta mt-6 w-full" disabled={pending}>
          {pending ? "…" : "Anlegen"}
        </button>
      </form>
    </main>
  );
}
