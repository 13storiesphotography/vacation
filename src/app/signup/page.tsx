"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const invitedFlow = next.startsWith("/invite/");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    router.replace(next);
    router.refresh();
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
        Erstelle dein Konto mit der eingeladenen E-Mail-Adresse und nimm danach die Einladung an.
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
