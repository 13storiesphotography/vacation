"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Database } from "@/lib/database.types";
import { isCompleteEmail } from "@/lib/email";
import { copyTextToClipboard, friendlyClipboardError } from "@/lib/clipboard";
import {
  inviteRoleOptions,
  permissionLabels,
  permissionShortLabels,
  roleLabel,
  type MemberRole,
  type PermissionKey,
} from "@/lib/permissions";
import { GlassSheet } from "@/components/ui/glass-sheet";

type Member = Database["public"]["Tables"]["vacation_members"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type SheetState =
  | { kind: "actions"; memberId: string }
  | { kind: "rights"; memberId: string }
  | { kind: "invite" }
  | { kind: "confirm"; memberId: string }
  | null;

function statusLabel(status: Member["status"]) {
  return status === "invited" ? "Eingeladen" : "Aktiv";
}

function memberInviteLink(member: Member, origin: string | null): string | null {
  const token = member.invite_token?.trim();
  if (!token || member.status !== "invited" || !origin) return null;
  return `${origin}/invite/${token}`;
}

function memberDisplayName(member: Member, profiles: Profile[]): string {
  if (member.user_id) {
    const profile = profiles.find((entry) => entry.id === member.user_id);
    const name = profile?.display_name?.trim();
    if (name) return name;
  }
  const local = member.email.split("@")[0]?.trim();
  return local || member.email;
}

function memberInitial(name: string, email: string): string {
  const source = name.trim() || email.trim();
  return (source.slice(0, 1) || "?").toUpperCase();
}

export function TeamPanel({
  vacationId,
  members,
  profiles,
  currentUserId,
  canManageTeam,
  onChanged,
}: {
  vacationId: string;
  members: Member[];
  profiles: Profile[];
  currentUserId: string | null;
  canManageTeam: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : null;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, "custom">>("editor");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const inviteLinkInputRef = useRef<HTMLInputElement | null>(null);

  const sheetMember = useMemo(() => {
    if (!sheet || sheet.kind === "invite") return null;
    return members.find((member) => member.id === sheet.memberId) ?? null;
  }, [members, sheet]);

  useEffect(() => {
    if (!inviteLink || !inviteLinkInputRef.current) return;
    inviteLinkInputRef.current.focus();
    inviteLinkInputRef.current.select();
  }, [inviteLink]);

  function closeSheet() {
    setSheet(null);
  }

  async function finishInviteLinkCopy(link: string, note?: string) {
    setInviteLink(link);
    setError(null);
    try {
      const result = await copyTextToClipboard(link);
      if (result === "copied") {
        setMessage(note ? `${note} Link wurde kopiert.` : "Einladungslink kopiert.");
        return;
      }
      if (result === "shared") {
        setMessage(note ? `${note} Link wurde geteilt.` : "Einladungslink geteilt.");
        return;
      }
      if (result === "prompted") {
        setMessage("Link zum Kopieren angezeigt.");
        return;
      }
    } catch (err) {
      setMessage(friendlyClipboardError(err));
      return;
    }
    setMessage("Link bereit — Feld antippen, markieren und kopieren.");
  }

  async function onCopyInviteLink(member: Member) {
    setError(null);
    setMessage(null);
    closeSheet();

    const existing = memberInviteLink(member, origin);
    const expiresAt = member.invite_expires_at
      ? new Date(member.invite_expires_at).getTime()
      : null;
    const stillValid =
      Boolean(existing) &&
      (expiresAt == null || !Number.isFinite(expiresAt) || expiresAt > Date.now());

    if (existing && stillValid) {
      await finishInviteLinkCopy(existing);
      return;
    }

    setBusyId(member.id);
    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId,
          memberId: member.id,
          linkOnly: true,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        note?: string;
        inviteLink?: string;
      };
      if (!response.ok || !payload.inviteLink) {
        setError(payload.error ?? "Link konnte nicht erzeugt werden.");
        return;
      }
      await finishInviteLinkCopy(payload.inviteLink, payload.note);
      await onChanged();
    } catch (err) {
      setError(friendlyClipboardError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onResendInvite(member: Member) {
    setError(null);
    setMessage(null);
    closeSheet();
    setBusyId(member.id);
    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId,
          memberId: member.id,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        note?: string;
        inviteLink?: string;
        emailSent?: boolean;
      };
      if (!response.ok) {
        setError(payload.error ?? "E-Mail konnte nicht erneut gesendet werden.");
        return;
      }
      if (payload.inviteLink) {
        setInviteLink(payload.inviteLink);
        if (payload.emailSent === false) {
          setMessage(
            payload.note ??
              "Link erneuert, aber die E-Mail ging nicht raus — bitte Link teilen.",
          );
        } else {
          setMessage(payload.note ?? "Einladung erneut gesendet.");
          await finishInviteLinkCopy(payload.inviteLink, payload.note);
        }
      } else {
        setMessage(payload.note ?? "Einladung erneut gesendet.");
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erneutes Senden fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  async function onUpdateRole(memberId: string, role: Exclude<MemberRole, "custom">) {
    setError(null);
    setMessage(null);
    setBusyId(memberId);
    try {
      const response = await fetch("/api/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacationId, memberId, role }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Rolle konnte nicht geändert werden.");
        return;
      }
      setMessage("Rolle aktualisiert.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rolle konnte nicht geändert werden.");
    } finally {
      setBusyId(null);
    }
  }

  async function onTogglePermission(member: Member, key: PermissionKey, value: boolean) {
    setError(null);
    setMessage(null);
    setBusyId(member.id);
    try {
      const response = await fetch("/api/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacationId, memberId: member.id, [key]: value }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Recht konnte nicht geändert werden.");
        return;
      }
      setMessage("Rechte aktualisiert.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recht konnte nicht geändert werden.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveMember(member: Member) {
    const isInvite = member.status === "invited";
    setError(null);
    setMessage(null);
    setBusyId(member.id);
    closeSheet();
    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacationId, memberId: member.id }),
    });
    const payload = (await response.json()) as { error?: string; note?: string };
    setBusyId(null);
    if (!response.ok) {
      setError(payload.error ?? "Entfernen fehlgeschlagen");
      return;
    }
    setMessage(payload.note ?? (isInvite ? "Einladung zurückgezogen." : "Mitglied entfernt."));
    await onChanged();
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setInviteLink(null);

    if (!isCompleteEmail(inviteEmail)) {
      setError("Bitte gib eine vollständige E-Mail-Adresse ein (z. B. name@domain.de).");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        note?: string;
        inviteLink?: string;
        emailSent?: boolean;
      };
      if (!response.ok) {
        setError(payload.error ?? "Einladung fehlgeschlagen");
        return;
      }
      if (payload.inviteLink) {
        setInviteLink(payload.inviteLink);
        if (payload.emailSent === false) {
          setMessage(
            payload.note ??
              "Person ist eingeladen, aber die E-Mail ging nicht raus — bitte Link teilen.",
          );
        } else {
          setMessage(payload.note ?? "Einladung gesendet.");
          await finishInviteLinkCopy(payload.inviteLink, payload.note);
        }
      } else {
        setMessage(payload.note ?? "Einladung gesendet.");
      }
      setInviteEmail("");
      closeSheet();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einladung fehlgeschlagen");
    } finally {
      setInviting(false);
    }
  }

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return a.email.localeCompare(b.email, "de");
    });
  }, [members]);

  return (
    <div>
      <h1 className="display text-2xl">Team</h1>
      <p className="tab-subtitle">
        {members.length} Mitglied{members.length === 1 ? "" : "er"}
      </p>

      <div className="ios-group mt-4 overflow-hidden">
        {sortedMembers.length === 0 ? (
          <p className="px-4 py-5 text-[14px] text-[var(--ink-soft)]">
            Noch niemand im Team.
          </p>
        ) : (
          sortedMembers.map((member) => {
            const isSelf = Boolean(
              currentUserId && member.user_id && member.user_id === currentUserId,
            );
            const busy = busyId === member.id;
            const canManage = canManageTeam && !isSelf;
            const name = memberDisplayName(member, profiles);
            const pending = member.status === "invited";

            return (
              <button
                key={member.id}
                type="button"
                className="team-member-row ios-row !items-center"
                disabled={!canManage || busy}
                onClick={() => {
                  if (!canManage || busy) return;
                  setError(null);
                  setSheet({ kind: "actions", memberId: member.id });
                }}
              >
                <div
                  className="team-avatar"
                  data-pending={pending ? "true" : undefined}
                  aria-hidden
                >
                  {memberInitial(name, member.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {name}
                    {isSelf ? (
                      <span className="ml-1.5 text-[12px] font-semibold text-[var(--ink-faint)]">
                        Du
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[13px] text-[var(--ink-soft)]">{member.email}</p>
                  <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                    {roleLabel(member.role)} · {statusLabel(member.status)}
                  </p>
                </div>
                {canManage ? (
                  <span className="shrink-0 text-[18px] font-light text-[var(--ink-faint)]" aria-hidden>
                    ›
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {(message || error || inviteLink) && (
        <div className="mt-3 space-y-2">
          {inviteLink ? (
            <div className="glass-subpanel p-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                Einladungslink
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  ref={inviteLinkInputRef}
                  readOnly
                  className="glass-field px-3 py-3 text-[13px]"
                  value={inviteLink}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  className="glass-chip shrink-0"
                  onClick={() => void finishInviteLinkCopy(inviteLink)}
                >
                  Link teilen
                </button>
              </div>
            </div>
          ) : null}
          {message ? <p className="text-[13px] text-[var(--pine)]">{message}</p> : null}
          {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}
        </div>
      )}

      {canManageTeam ? (
        <button
          type="button"
          className="cta mt-4 w-full"
          onClick={() => {
            setError(null);
            setMessage(null);
            setInviteLink(null);
            setSheet({ kind: "invite" });
          }}
        >
          Person einladen
        </button>
      ) : null}

      <GlassSheet
        open={sheet?.kind === "actions" && Boolean(sheetMember)}
        title={sheetMember ? memberDisplayName(sheetMember, profiles) : "Mitglied"}
        subtitle={sheetMember?.email}
        onClose={closeSheet}
      >
        {sheetMember ? (
          <div>
            <button
              type="button"
              className="glass-sheet-action"
              disabled={busyId === sheetMember.id}
              onClick={() => setSheet({ kind: "rights", memberId: sheetMember.id })}
            >
              Rechte anpassen
            </button>
            {sheetMember.status === "invited" ? (
              <>
                <button
                  type="button"
                  className="glass-sheet-action"
                  disabled={busyId === sheetMember.id}
                  onClick={() => void onCopyInviteLink(sheetMember)}
                >
                  Link teilen
                </button>
                <button
                  type="button"
                  className="glass-sheet-action"
                  disabled={busyId === sheetMember.id}
                  onClick={() => void onResendInvite(sheetMember)}
                >
                  E-Mail erneut senden
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="glass-sheet-action glass-sheet-action-danger"
              disabled={busyId === sheetMember.id}
              onClick={() => setSheet({ kind: "confirm", memberId: sheetMember.id })}
            >
              {sheetMember.status === "invited" ? "Einladung zurückziehen" : "Aus Team entfernen"}
            </button>
            <button
              type="button"
              className="glass-sheet-action glass-sheet-action-muted"
              onClick={closeSheet}
            >
              Abbrechen
            </button>
          </div>
        ) : null}
      </GlassSheet>

      <GlassSheet
        open={sheet?.kind === "rights" && Boolean(sheetMember)}
        title="Rechte"
        subtitle={sheetMember?.email}
        onClose={closeSheet}
        footer={
          <button type="button" className="cta w-full" onClick={closeSheet}>
            Fertig
          </button>
        }
      >
        {sheetMember ? (
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              Rolle
            </p>
            <div className="segmented" role="group" aria-label="Rolle">
              {inviteRoleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-active={sheetMember.role === option.value ? "true" : undefined}
                  disabled={busyId === sheetMember.id}
                  onClick={() => void onUpdateRole(sheetMember.id, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {sheetMember.role === "custom" ? (
              <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
                Aktuell angepasst — Preset wählen oder Rechte einzeln setzen.
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
                {inviteRoleOptions.find((option) => option.value === sheetMember.role)?.description}
              </p>
            )}

            <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              Einzelrechte
            </p>
            {(Object.keys(permissionLabels) as PermissionKey[]).map((key) => (
              <label key={key} className="team-perm-row">
                <span>
                  <span className="block text-[14px] font-semibold">{permissionShortLabels[key]}</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--ink-soft)]">
                    {permissionLabels[key]}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(sheetMember[key])}
                  disabled={busyId === sheetMember.id}
                  onChange={(event) =>
                    void onTogglePermission(sheetMember, key, event.target.checked)
                  }
                  aria-label={permissionLabels[key]}
                />
              </label>
            ))}
          </div>
        ) : null}
      </GlassSheet>

      <GlassSheet
        open={sheet?.kind === "invite"}
        title="Person einladen"
        subtitle="E-Mail und Rolle wählen — danach Link teilen oder Mail senden."
        onClose={closeSheet}
      >
        <form
          onSubmit={onInvite}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
        >
          <label className="form-label">
            E-Mail
            <input
              name="vacation-invite-email"
              id="vacation-invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="glass-field mt-1.5 px-3 py-3"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="name@domain.de"
              required
            />
          </label>

          <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
            Rolle
          </p>
          <div className="segmented" role="group" aria-label="Einladungsrolle">
            {inviteRoleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                data-active={inviteRole === option.value ? "true" : undefined}
                onClick={() => setInviteRole(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
            {inviteRoleOptions.find((option) => option.value === inviteRole)?.description}
          </p>

          {error && sheet?.kind === "invite" ? (
            <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p>
          ) : null}

          <button
            type="submit"
            className="cta mt-5 w-full"
            disabled={inviting || !isCompleteEmail(inviteEmail)}
          >
            {inviting ? "…" : "Einladung senden"}
          </button>
          <button
            type="button"
            className="glass-sheet-action glass-sheet-action-muted mt-2"
            onClick={closeSheet}
          >
            Abbrechen
          </button>
        </form>
      </GlassSheet>

      <GlassSheet
        open={sheet?.kind === "confirm" && Boolean(sheetMember)}
        title={
          sheetMember?.status === "invited" ? "Einladung zurückziehen?" : "Mitglied entfernen?"
        }
        subtitle={
          sheetMember
            ? sheetMember.status === "invited"
              ? `${sheetMember.email} kann dem Team dann nicht mehr beitreten.`
              : `${sheetMember.email} verliert den Zugriff auf diesen Urlaub.`
            : undefined
        }
        onClose={closeSheet}
      >
        {sheetMember ? (
          <div>
            <button
              type="button"
              className="glass-sheet-action glass-sheet-action-danger"
              disabled={busyId === sheetMember.id}
              onClick={() => void onRemoveMember(sheetMember)}
            >
              {busyId === sheetMember.id
                ? "…"
                : sheetMember.status === "invited"
                  ? "Zurückziehen"
                  : "Entfernen"}
            </button>
            <button
              type="button"
              className="glass-sheet-action glass-sheet-action-muted"
              onClick={closeSheet}
            >
              Abbrechen
            </button>
          </div>
        ) : null}
      </GlassSheet>
    </div>
  );
}
