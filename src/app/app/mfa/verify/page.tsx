"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function normalizeOtp(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function VerifyMfaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) {
      setLoading(false);
      setError(factors.error.message);
      return;
    }
    const totpFactor = factors.data.totp[0];
    if (!totpFactor) {
      setLoading(false);
      setError("Kein TOTP-Faktor gefunden.");
      return;
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
    if (challenge.error) {
      setLoading(false);
      setError(challenge.error.message);
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.data.id,
      code: normalizeOtp(code),
    });
    setLoading(false);
    if (verify.error) {
      setError(verify.error.message);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <main className="shell flex min-h-screen items-center px-5 py-12">
      <form
        onSubmit={onSubmit}
        method="post"
        autoComplete="on"
        className="ios-group mx-auto w-full max-w-md p-6"
      >
        <h1 className="display text-2xl">Bestätigungscode</h1>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Gib den aktuellen 6-stelligen Code aus deinem Passwort-Safe oder
          Authenticator ein.
        </p>
        <label className="form-label mt-6" htmlFor="totp">
          Einmalcode
          <input
            id="totp"
            name="totp"
            type="text"
            className="glass-field mt-1.5 px-3 py-3 text-center text-[20px] tracking-[0.3em]"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            minLength={6}
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(normalizeOtp(e.target.value))}
            placeholder="000000"
          />
        </label>
        {error && <p className="mt-4 text-[14px] text-[var(--danger)]">{error}</p>}
        <button type="submit" className="cta mt-6 w-full" disabled={loading}>
          {loading ? "…" : "Bestätigen"}
        </button>
      </form>
    </main>
  );
}
