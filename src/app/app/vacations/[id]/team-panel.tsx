"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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

type Member = Database["public"]["Tables"]["vacation_members"]["Row"];

function statusLabel(status: Member["status"]) {
  return status === "invited" ? "Eingeladen" : "Aktiv";
}

function memberInviteLink(member: Member, origin: string | null): string | null {
  const token = member.invite_token?.trim();
  if (!token || member.status !== "invited" || !origin) return null;
  return `${origin}/invite/${token}`;
}

export function TeamPanel({
  vacationId,
  members,
  currentUserId,
  canManageTeam,
  onChanged,
}: {
  vacationId: string;
  members: Member[];
  currentUserId: string | null;
  canManageTeam: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : null;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [rightsId, setRightsId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, "custom">>("editor");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const inviteLinkInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuId) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuId(null);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuId]);

  useEffect(() => {
    if (!inviteLink || !inviteLinkInputRef.current) return;
    inviteLinkInputRef.current.focus();
    inviteLinkInputRef.current.select();
  }, [inviteLink]);

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
    setMenuId(null);

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

  async function onTogglePermission(
    member: Member,
    key: PermissionKey,
    value: boolean,
  ) {
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
    setMenuId(null);
    const isInvite = member.status === "invited";
    const confirmed = window.confirm(
      isInvite
        ? `Einladung an ${member.email} zurückziehen?`
        : `${member.email} aus dem Team entfernen?`,
    );
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    setBusyId(member.id);
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
    if (rightsId === member.id) setRightsId(null);
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
      };
      if (!response.ok) {
        setError(payload.error ?? "Einladung fehlgeschlagen");
        return;
      }
      setMessage(payload.note ?? "Einladung gesendet.");
      if (payload.inviteLink) await finishInviteLinkCopy(payload.inviteLink);
      setInviteEmail("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einladung fehlgeschlagen");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div>
      <h1 className="display text-2xl">Team</h1>
      <p className="tab-subtitle">
        {members.length} Mitglied{members.length === 1 ? "" : "er"}
      </p>

      <div className="ios-group mt-4">
        {members.map((member) => {
          const isSelf = Boolean(
            currentUserId && member.user_id && member.user_id === currentUserId,
          );
          const busy = busyId === member.id;
          const canManage = canManageTeam && !isSelf;
          const rightsOpen = rightsId === member.id;
          const menuOpen = menuId === member.id;
          const roleValue = inviteRoleOptions.some((option) => option.value === member.role)
            ? member.role
            : "custom";

          return (
            <div key={member.id} className="border-b border-black/5 last:border-b-0">
              <div className="ios-row !items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{member.email}</p>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                    {roleLabel(member.role)} · {statusLabel(member.status)}
                    {isSelf ? " · Du" : ""}
                  </p>
                  {member.invite_expires_at && member.status === "invited" ? (
                    <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
                      Link gültig bis{" "}
                      {new Date(member.invite_expires_at).toLocaleDateString("de-DE")}
                    </p>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="cost-status-select !max-w-[8.5rem]"
                      value={roleValue}
                      disabled={busy}
                      aria-label={`Rolle für ${member.email}`}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "custom") return;
                        void onUpdateRole(member.id, next as Exclude<MemberRole, "custom">);
                      }}
                    >
                      {inviteRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      <option value="custom" disabled>
                        Angepasst
                      </option>
                    </select>

                    <div className="relative" ref={menuOpen ? menuRef : undefined}>
                      <button
                        type="button"
                        className="glass-chip !px-2.5 !py-1.5"
                        aria-label="Weitere Aktionen"
                        aria-expanded={menuOpen}
                        disabled={busy}
                        onClick={() => setMenuId(menuOpen ? null : member.id)}
                      >
                        ···
                      </button>
                      {menuOpen ? (
                        <div className="absolute right-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-[14px] border border-white/50 bg-[rgba(248,250,251,0.96)] p-1 shadow-lg backdrop-blur-xl">
                          <button
                            type="button"
                            className="block w-full rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold hover:bg-black/5"
                            onClick={() => {
                              setMenuId(null);
                              setRightsId(rightsOpen ? null : member.id);
                            }}
                          >
                            {rightsOpen ? "Rechte schließen" : "Rechte anpassen"}
                          </button>
                          {member.status === "invited" ? (
                            <button
                              type="button"
                              className="block w-full rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold hover:bg-black/5"
                              onClick={() => void onCopyInviteLink(member)}
                            >
                              Link teilen
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold text-[var(--danger)] hover:bg-black/5"
                            onClick={() => void onRemoveMember(member)}
                          >
                            {member.status === "invited" ? "Zurückziehen" : "Entfernen"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {rightsOpen && canManage ? (
                <div className="glass-subpanel mx-3 mb-3 space-y-2 p-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                    Rechte
                  </p>
                  <p className="text-[12px] text-[var(--ink-soft)]">
                    Preset oben wählen oder einzeln anpassen — wird dann „Angepasst“.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(permissionLabels) as PermissionKey[]).map((key) => (
                      <label
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-[12px] bg-white/45 px-3 py-2.5 text-[13px] font-semibold"
                      >
                        <span>{permissionShortLabels[key]}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--fjord)]"
                          checked={Boolean(member[key])}
                          disabled={busy}
                          onChange={(event) =>
                            void onTogglePermission(member, key, event.target.checked)
                          }
                          aria-label={permissionLabels[key]}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {(message || error || inviteLink) && !showInvite ? (
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
      ) : null}

      {canManageTeam ? (
        <div className="mt-4">
          {!showInvite ? (
            <button
              type="button"
              className="cta w-full"
              onClick={() => {
                setShowInvite(true);
                setError(null);
                setMessage(null);
              }}
            >
              Person einladen
            </button>
          ) : (
            <form
              onSubmit={onInvite}
              className="ios-group p-4"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
                  Person einladen
                </p>
                <button
                  type="button"
                  className="glass-chip"
                  onClick={() => {
                    setShowInvite(false);
                    setInviteEmail("");
                    setInviteLink(null);
                  }}
                >
                  Schließen
                </button>
              </div>
              <label className="form-label mt-3">
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
              <label className="form-label mt-3">
                Rolle
                <select
                  className="glass-field mt-1.5 px-3 py-3"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as Exclude<MemberRole, "custom">)
                  }
                >
                  {inviteRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.description}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="cta mt-4 w-full"
                disabled={inviting || !isCompleteEmail(inviteEmail)}
              >
                {inviting ? "…" : "Einladung senden"}
              </button>
              {inviteLink ? (
                <div className="mt-3">
                  <input
                    readOnly
                    className="glass-field px-3 py-3 text-[13px]"
                    value={inviteLink}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </div>
              ) : null}
              {message ? <p className="mt-3 text-[13px] text-[var(--pine)]">{message}</p> : null}
              {error ? <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p> : null}
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
