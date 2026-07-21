"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    router.replace("/app/mfa/enroll");
    router.refresh();
  }

  return (
    <main className="shell flex min-h-screen items-center px-5 py-12">
      <form onSubmit={onSubmit} className="ios-group mx-auto w-full max-w-md p-6">
        <h1 className="display text-2xl">Konto erstellen</h1>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Für den ersten Admin-Account. Danach MFA einrichten. Weitere Personen kommen per
          Einladung.
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
        <p className="mt-4 text-center text-[13px] text-[var(--ink-soft)]">
          Schon registriert?{" "}
          <Link href="/login" className="font-semibold text-[var(--fjord)]">
            Anmelden
          </Link>
        </p>
      </form>
    </main>
  );
}
