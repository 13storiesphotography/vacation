"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function AppleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"password" | "apple" | null>(null);

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
    setLoading("password");
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
      setLoading(null);
    }
  }

  async function onAppleSignIn() {
    setLoading("apple");
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo,
          scopes: "name email",
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(null);
      }
      // On success the browser navigates to Apple / Supabase.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apple-Anmeldung fehlgeschlagen.");
      setLoading(null);
    }
  }

  const shownError = error ?? queryError;

  return (
    <div className="ios-group mx-auto w-full max-w-md p-6">
      <h1 className="display text-2xl">Anmelden</h1>
      <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
        Mit Apple oder E-Mail und Passwort. Danach MFA, falls eingerichtet.
      </p>

      <button
        type="button"
        className="apple-sign-in mt-6 w-full"
        onClick={onAppleSignIn}
        disabled={loading !== null}
      >
        <AppleMark className="h-5 w-5" />
        {loading === "apple" ? "Weiterleiten…" : "Mit Apple anmelden"}
      </button>

      <div className="auth-divider mt-5" role="separator" aria-label="oder">
        <span>oder</span>
      </div>

      <form onSubmit={onSubmit} className="mt-5">
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
        <button
          type="submit"
          className="cta mt-6 w-full"
          disabled={loading !== null}
        >
          {loading === "password" ? "…" : "Mit Passwort weiter"}
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
