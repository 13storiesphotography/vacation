"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NewVacationPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Schweden Van Trip");
  const [type, setType] = useState<"van" | "hotel" | "camping" | "other">("van");
  const [region, setRegion] = useState("Schweden · Süd nach Nord");
  const [description, setDescription] = useState(
    "Zwei Wochen mit dem Van von Skåne bis zur Höga Kusten.",
  );
  const [startDate, setStartDate] = useState("2026-07-10");
  const [endDate, setEndDate] = useState("2026-07-24");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Nicht angemeldet.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("vacations")
      .insert({
        title,
        type,
        region,
        description,
        start_date: startDate,
        end_date: endDate,
        created_by: user.id,
      })
      .select("id")
      .single();

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.replace(`/app/vacations/${data.id}`);
    router.refresh();
  }

  return (
    <main className="shell mx-auto min-h-screen w-full max-w-lg px-5 py-8">
      <Link href="/app" className="text-[13px] font-semibold text-[var(--fjord)]">
        ← Zurück
      </Link>
      <form onSubmit={onSubmit} className="ios-group mt-4 p-6">
        <h1 className="display text-2xl">Neuer Urlaub</h1>
        <label className="mt-5 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Titel
          <input
            className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Art
          <select
            className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
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
            className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-[13px] font-semibold text-[var(--ink-soft)]">
            Start
            <input
              className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-semibold text-[var(--ink-soft)]">
            Ende
            <input
              className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <label className="mt-4 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Beschreibung
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <p className="mt-4 text-[14px] text-[var(--danger)]">{error}</p>}
        <button type="submit" className="cta mt-6 w-full" disabled={loading}>
          {loading ? "…" : "Anlegen"}
        </button>
      </form>
    </main>
  );
}
