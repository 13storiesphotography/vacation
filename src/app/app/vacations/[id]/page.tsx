"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type Vacation = Database["public"]["Tables"]["vacations"]["Row"];
type Member = Database["public"]["Tables"]["vacation_members"]["Row"];
type Spot = Database["public"]["Tables"]["spots"]["Row"];
type MemberRole = Member["role"];

const ROLE_OPTIONS: Array<{
  value: MemberRole;
  label: string;
  description: string;
}> = [
  { value: "viewer", label: "Viewer", description: "Nur ansehen" },
  { value: "editor", label: "Editor", description: "Plan & Spots bearbeiten" },
  { value: "admin", label: "Admin", description: "Team & Urlaub verwalten" },
];

function roleLabel(role: MemberRole) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

export default function VacationDetailPage() {
  const params = useParams<{ id: string }>();
  const vacationId = params.id;
  const [vacation, setVacation] = useState<Vacation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("editor");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const [{ data: vacationData }, { data: memberData }, { data: spotData }, { data: authData }] =
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
        supabase.auth.getUser(),
      ]);
    setVacation(vacationData);
    setMembers(memberData ?? []);
    setSpots(spotData ?? []);
    setCurrentUserId(authData.user?.id ?? null);
    setCurrentUserEmail(authData.user?.email?.toLowerCase() ?? null);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    Promise.all([
      supabase.from("vacations").select("*").eq("id", vacationId).single(),
      supabase.from("vacation_members").select("*").eq("vacation_id", vacationId).order("created_at"),
      supabase.from("spots").select("*").eq("vacation_id", vacationId).order("created_at", {
        ascending: false,
      }),
      supabase.auth.getUser(),
    ]).then(([{ data: vacationData }, { data: memberData }, { data: spotData }, { data: authData }]) => {
      if (cancelled) return;
      setVacation(vacationData);
      setMembers(memberData ?? []);
      setSpots(spotData ?? []);
      setCurrentUserId(authData.user?.id ?? null);
      setCurrentUserEmail(authData.user?.email?.toLowerCase() ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [vacationId]);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setError(null);
    setMessage(null);
    setInviteLink(null);
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacationId, email: inviteEmail, role: inviteRole }),
    });
    const payload = (await response.json()) as {
      error?: string;
      ok?: boolean;
      note?: string;
      inviteLink?: string;
    };
    setInviting(false);
    if (!response.ok) {
      setError(payload.error ?? "Einladung fehlgeschlagen");
      return;
    }
    setMessage(payload.note ?? "Einladung gesendet.");
    setInviteLink(payload.inviteLink ?? null);
    setInviteEmail("");
    await load();
  }

  async function copyInviteLink(member: Member) {
    setBusyMemberId(member.id);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vacationId,
        memberId: member.id,
        role: member.role,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      inviteLink?: string;
      note?: string;
    };
    setBusyMemberId(null);
    if (!response.ok || !payload.inviteLink) {
      setError(payload.error ?? "Link konnte nicht erzeugt werden.");
      return;
    }
    await navigator.clipboard.writeText(payload.inviteLink);
    setInviteLink(payload.inviteLink);
    setMessage(payload.note ? `${payload.note} Link wurde kopiert.` : "Einladungslink kopiert.");
    await load();
  }

  async function updateRole(memberId: string, role: MemberRole) {
    setBusyMemberId(memberId);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/team-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacationId, memberId, role }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusyMemberId(null);
    if (!response.ok) {
      setError(payload.error ?? "Rolle konnte nicht geändert werden.");
      return;
    }
    setMessage("Rolle aktualisiert.");
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

  const currentMember =
    members.find((member) => member.user_id && member.user_id === currentUserId) ??
    members.find((member) => currentUserEmail && member.email === currentUserEmail) ??
    null;
  const canManageTeam = currentMember?.status === "active" && currentMember.role === "admin";
  const canEditTrip =
    currentMember?.status === "active" &&
    (currentMember.role === "admin" || currentMember.role === "editor");

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
          <h2 className="display text-xl">Team</h2>
          {currentMember ? (
            <span className="glass-chip">
              Deine Rolle: {roleLabel(currentMember.role)} · {currentMember.status}
            </span>
          ) : null}
        </div>
        <div className="ios-group mt-3 p-4">
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Rollen</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className="glass-subpanel p-3">
                <p className="text-[14px] font-semibold">{role.label}</p>
                <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{role.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="ios-group mt-3">
          {members.map((member) => (
            <div key={member.id} className="ios-row !items-start !justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{member.email}</p>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  {roleLabel(member.role)} · {member.status}
                </p>
                {member.invite_expires_at && member.status === "invited" ? (
                  <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
                    Link gültig bis {new Date(member.invite_expires_at).toLocaleDateString("de-DE")}
                  </p>
                ) : null}
              </div>
              {canManageTeam ? (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <select
                    className="glass-field min-w-[9rem] px-3 py-2 text-[14px]"
                    value={member.role}
                    disabled={busyMemberId === member.id}
                    onChange={(event) => void updateRole(member.id, event.target.value as MemberRole)}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  {member.status === "invited" ? (
                    <button
                      type="button"
                      className="glass-chip"
                      disabled={busyMemberId === member.id}
                      onClick={() => void copyInviteLink(member)}
                    >
                      {busyMemberId === member.id ? "…" : "Link kopieren"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {canManageTeam ? (
          <form onSubmit={onInvite} className="ios-group mt-3 p-4">
            <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Person einladen</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_11rem_auto]">
              <input
                className="glass-field px-3 py-3 text-[15px]"
                type="email"
                required
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className="glass-field px-3 py-3 text-[15px]"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as MemberRole)}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="cta shrink-0" disabled={inviting}>
                {inviting ? "…" : "Einladen"}
              </button>
            </div>
            {inviteLink ? (
              <div className="glass-subpanel mt-3 p-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  Teilbarer Link
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input readOnly className="glass-field px-3 py-3 text-[13px]" value={inviteLink} />
                  <button
                    type="button"
                    className="glass-chip shrink-0"
                    onClick={() => void navigator.clipboard.writeText(inviteLink)}
                  >
                    Link kopieren
                  </button>
                </div>
              </div>
            ) : null}
            {message && <p className="mt-3 text-[13px] text-[var(--pine)]">{message}</p>}
            {error && <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p>}
          </form>
        ) : (
          <div className="ios-group mt-3 p-4 text-[14px] text-[var(--ink-soft)]">
            {canEditTrip
              ? "Nur Admins können Einladungen versenden und Rollen verwalten."
              : "Als Viewer kannst du den Urlaub ansehen, aber nichts am Team oder Plan ändern."}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-xl">Spots</h2>
          <span className="text-[13px] text-[var(--ink-soft)]">{spots.length}</span>
        </div>
        <div className="ios-group mt-3">
          {spots.length === 0 ? (
            <div className="p-5 text-[14px] text-[var(--ink-soft)]">
              Noch keine Spots. Als Nächstes bauen wir das Spot-Formulat und die Karte aus.
            </div>
          ) : (
            spots.map((spot) => (
              <div key={spot.id} className="ios-row">
                <div>
                  <p className="text-[15px] font-semibold">{spot.name}</p>
                  <p className="text-[12px] text-[var(--ink-soft)]">{spot.category}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
