"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InvitePreview = {
  vacation_id: string;
  vacation_title: string;
  email: string;
  role: "viewer" | "editor" | "admin" | "custom";
  status: "invited" | "active";
  invite_expires_at: string | null;
};

const ROLE_COPY: Record<InvitePreview["role"], string> = {
  viewer: "Kann alles ansehen, aber nichts ändern.",
  editor: "Kann Spots und Planung bearbeiten.",
  admin: "Kann Team und Urlaub verwalten.",
  custom: "Hat individuell freigeschaltete Rechte.",
};

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    Promise.all([
      fetch(`/api/invite/preview?token=${encodeURIComponent(token)}`).then((response) => response.json()),
      supabase.auth.getUser(),
    ]).then(([previewPayload, { data: authPayload }]) => {
      if (cancelled) return;

      if (previewPayload?.error) {
        setError(previewPayload.error);
      } else {
        setInvite(previewPayload.invite ?? null);
      }

      setViewerEmail(authPayload.user?.email?.toLowerCase() ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const nextPath = `/invite/${token}`;
  const loginParams = new URLSearchParams({ next: nextPath });
  if (invite?.email) loginParams.set("email", invite.email);
  const loginHref = `/login?${loginParams.toString()}`;

  const signupParams = new URLSearchParams({ next: nextPath });
  if (invite?.email) signupParams.set("email", invite.email);
  const signupHref = `/signup?${signupParams.toString()}`;

  async function acceptInvite() {
    setAccepting(true);
    setError(null);
    const response = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = (await response.json()) as { error?: string; vacationId?: string };
    setAccepting(false);
    if (!response.ok || !payload.vacationId) {
      setError(payload.error ?? "Einladung konnte nicht angenommen werden.");
      return;
    }
    router.replace(`/app/vacations/${payload.vacationId}`);
    router.refresh();
  }

  if (loading) {
    return <main className="shell mx-auto max-w-lg px-5 py-10 text-[var(--ink-soft)]">Laden…</main>;
  }

  return (
    <main className="shell mx-auto min-h-screen w-full max-w-lg px-5 py-12">
      <div className="ios-group p-6">
        <p className="section-label">Einladung</p>
        <h1 className="display mt-2 text-3xl">Zum Planer-Team beitreten</h1>

        {invite ? (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
              Du wurdest für <span className="font-semibold text-[var(--ink)]">{invite.vacation_title}</span>{" "}
              eingeladen.
            </p>
            <div className="glass-subpanel mt-4 p-4">
              <p className="text-[14px] font-semibold">{invite.email}</p>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                Rolle: <span className="font-semibold capitalize text-[var(--ink)]">{invite.role}</span>
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{ROLE_COPY[invite.role]}</p>
            </div>

            {!viewerEmail ? (
              <div className="mt-5 space-y-3">
                <p className="text-[14px] text-[var(--ink-soft)]">
                  Melde dich mit der eingeladenen E-Mail-Adresse an oder registriere dich neu.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href={loginHref} className="cta flex-1 text-center">
                    Anmelden
                  </Link>
                  <Link href={signupHref} className="cta cta-secondary flex-1 text-center">
                    Registrieren
                  </Link>
                </div>
              </div>
            ) : viewerEmail !== invite.email ? (
              <div className="mt-5 rounded-[16px] bg-[var(--danger)]/8 p-4 text-[14px] text-[var(--danger)]">
                Angemeldet bist du gerade als <span className="font-semibold">{viewerEmail}</span>, die
                Einladung gehört aber zu <span className="font-semibold">{invite.email}</span>.
              </div>
            ) : (
              <div className="mt-5">
                <button type="button" className="cta w-full" disabled={accepting} onClick={acceptInvite}>
                  {accepting ? "…" : "Einladung annehmen"}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-[15px] text-[var(--danger)]">
            Diese Einladung wurde nicht gefunden oder ist abgelaufen.
          </p>
        )}

        {error ? <p className="mt-4 text-[14px] text-[var(--danger)]">{error}</p> : null}
      </div>
    </main>
  );
}
