"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const queryError = useMemo(() => {
    const code = searchParams.get("error");
    const message = searchParams.get("message");
    if (message) return message;
    if (code === "invite") {
      return "Zugang nur per Einladung. Bitte lass dich zuerst einladen.";
    }
    if (code === "auth") {
      return "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
    }
    return null;
  }, [searchParams]);

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

  const shownError = error ?? queryError;

  return (
    <div className="ios-group mx-auto w-full max-w-md p-6">
      <h1 className="display text-2xl">Anmelden</h1>
      <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
        Mit E-Mail und Passwort. Danach MFA, falls eingerichtet.
      </p>

      <form onSubmit={onSubmit} className="mt-6">
        <label className="form-label">
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
        <label className="form-label mt-4">
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
        {shownError && (
          <p className="mt-4 text-[14px] text-[var(--danger)]">{shownError}</p>
        )}
        <button type="submit" className="cta mt-6 w-full" disabled={loading}>
          {loading ? "…" : "Anmelden"}
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] text-[var(--ink-soft)]">
        Zugang nur per Einladung.{" "}
        <Link href="/signup" className="font-semibold text-[var(--fjord)]">
          Mehr Infos
        </Link>
      </p>
    </div>
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
