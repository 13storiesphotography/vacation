"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { CreateSpotForm, SpotList } from "./spot-ui";

type Vacation = Database["public"]["Tables"]["vacations"]["Row"];
type Member = Database["public"]["Tables"]["vacation_members"]["Row"];
type Spot = Database["public"]["Tables"]["spots"]["Row"];

export default function VacationDetailPage() {
  const params = useParams<{ id: string }>();
  const vacationId = params.id;
  const [vacation, setVacation] = useState<Vacation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [spotFormKey, setSpotFormKey] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: vacationData }, { data: memberData }, { data: spotData }] =
      await Promise.all([
        supabase.from("vacations").select("*").eq("id", vacationId).single(),
        supabase
          .from("vacation_members")
          .select("*")
          .eq("vacation_id", vacationId)
          .order("created_at"),
        supabase
          .from("spots")
          .select("*")
          .eq("vacation_id", vacationId)
          .order("created_at", { ascending: false }),
      ]);
    setVacation(vacationData);
    setMembers(memberData ?? []);
    setSpots(spotData ?? []);
    setLoading(false);
  }, [vacationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacationId, email: inviteEmail }),
    });
    const payload = (await response.json()) as { error?: string; ok?: boolean; note?: string };
    setInviting(false);
    if (!response.ok) {
      setError(payload.error ?? "Einladung fehlgeschlagen");
      return;
    }
    setMessage(payload.note ?? "Einladung gesendet.");
    setInviteEmail("");
    await load();
  }

  if (loading) {
    return (
      <main className="shell mx-auto max-w-3xl px-5 py-10 text-[var(--ink-soft)]">Laden…</main>
    );
  }

  if (!vacation) {
    return (
      <main className="shell mx-auto max-w-3xl px-5 py-10">
        <p className="text-[var(--danger)]">Urlaub nicht gefunden.</p>
        <Link href="/app" className="mt-4 inline-block text-[var(--fjord)]">
          Zurück
        </Link>
      </main>
    );
  }

  return (
    <main className="shell mx-auto min-h-screen w-full max-w-3xl px-5 py-8">
      <Link href="/app" className="text-[13px] font-semibold text-[var(--fjord)]">
        ← Urlaube
      </Link>
      <h1 className="display mt-3 text-3xl">{vacation.title}</h1>
      <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
        {vacation.start_date} – {vacation.end_date}
        {vacation.region ? ` · ${vacation.region}` : ""} · {vacation.type}
      </p>
      {vacation.description && (
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
          {vacation.description}
        </p>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-xl">Spots</h2>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-soft)]">{spots.length}</span>
            <button
              type="button"
              className="cta !px-3 !py-2 text-[13px]"
              onClick={() => setShowSpotForm((value) => !value)}
            >
              {showSpotForm ? "Schließen" : "Hinzufügen"}
            </button>
          </div>
        </div>

        {showSpotForm && (
          <CreateSpotForm
            key={spotFormKey}
            vacationId={vacationId}
            onCreated={async () => {
              setSpotFormKey((value) => value + 1);
              setShowSpotForm(false);
              await load();
            }}
          />
        )}

        <SpotList vacationId={vacationId} spots={spots} onChanged={load} />
      </section>

      <section className="mt-8">
        <h2 className="display text-xl">Team</h2>
        <div className="ios-group mt-3">
          {members.map((member) => (
            <div key={member.id} className="ios-row !items-start">
              <div>
                <p className="text-[15px] font-semibold">{member.email}</p>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  {member.role} · {member.status}
                </p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={onInvite} className="ios-group mt-3 p-4">
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Person einladen</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              className="w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
              type="email"
              required
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button type="submit" className="cta shrink-0" disabled={inviting}>
              {inviting ? "…" : "Einladen"}
            </button>
          </div>
          {message && <p className="mt-3 text-[13px] text-[var(--pine)]">{message}</p>}
          {error && <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p>}
        </form>
      </section>
    </main>
  );
}
