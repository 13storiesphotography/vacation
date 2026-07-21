"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="ios-group mx-auto w-full max-w-md p-6">
      <h1 className="display text-2xl">Anmelden</h1>
      <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
        Mit E-Mail und Passwort. Danach MFA, falls eingerichtet.
      </p>
      <label className="mt-6 block text-[13px] font-semibold text-[var(--ink-soft)]">
        E-Mail
        <input
          className="glass-field mt-1.5 px-3 py-3"
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
          className="glass-field mt-1.5 px-3 py-3"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="mt-4 text-[14px] text-[var(--danger)]">{error}</p>}
      <button type="submit" className="cta mt-6 w-full" disabled={loading}>
        {loading ? "…" : "Weiter"}
      </button>
      <p className="mt-4 text-center text-[13px] text-[var(--ink-soft)]">
        Zugang nur per Einladung.{" "}
        <Link href="/signup" className="font-semibold text-[var(--fjord)]">
          Mehr Infos
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="shell flex min-h-screen items-center px-5 py-12">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
