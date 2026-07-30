"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function inviteTokenFromNext(next: string): string | null {
  const match = /^\/invite\/([0-9a-f-]{36})$/i.exec(next.trim());
  return match?.[1] ?? null;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const inviteToken = useMemo(() => inviteTokenFromNext(next), [next]);
  const invitedFlow = Boolean(inviteToken);
  const invitedEmail = searchParams.get("email") || "";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!inviteToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/invite/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: inviteToken,
          email,
          password,
          displayName,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        vacationId?: string;
        email?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Registrierung fehlgeschlagen.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: payload.email ?? email,
        password,
      });
      if (signInError) {
        setError(
          signInError.message ||
            "Konto ist angelegt — bitte jetzt mit E-Mail und Passwort anmelden.",
        );
        setLoading(false);
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const destination = payload.vacationId
        ? `/app/vacations/${payload.vacationId}`
        : next;
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen.");
      setLoading(false);
    }
  }

  if (!invitedFlow) {
    return (
      <div className="ios-group mx-auto w-full max-w-md p-6">
        <h1 className="display text-2xl">Nur per Einladung</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Neue Konten können sich nicht selbst registrieren. Ein Admin lädt dich ein — danach
          meldest du dich mit E-Mail und Passwort an und richtest MFA ein.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Bist du der erste Admin? Lege den Account einmalig im Supabase Dashboard an
          (Authentication → Users → Add user), melde dich hier an und richte MFA ein.
        </p>
        <Link href="/login" className="cta mt-6 inline-flex w-full">
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="ios-group mx-auto w-full max-w-md p-6">
      <h1 className="display text-2xl">Konto für Einladung erstellen</h1>
      <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
        Dein Konto wird über die Einladung freigeschaltet — öffentliche Registrierung ist
        deaktiviert.
      </p>
      <label className="mt-6 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Name
        <input
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>
      <label className="mt-4 block text-[13px] font-semibold text-[var(--ink-soft)]">
        E-Mail
        <input
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          type="email"
          autoComplete="email"
          required
          readOnly={Boolean(invitedEmail)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="mt-4 block text-[13px] font-semibold text-[var(--ink-soft)]">
        Passwort
        <input
          className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="mt-4 text-[14px] text-[var(--danger)]">{error}</p>}
      <button type="submit" className="cta mt-6 w-full" disabled={loading}>
        {loading ? "…" : "Registrieren"}
      </button>
      <p className="mt-4 text-center text-[13px] text-[var(--ink-soft)]">
        Schon ein Konto?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-[var(--fjord)]">
          Anmelden
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <main className="shell flex min-h-screen items-center px-5 py-12">
      <Suspense>
        <SignupForm />
      </Suspense>
    </main>
  );
}
