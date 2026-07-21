"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace("/app/mfa/enroll");
    router.refresh();
  }

  return (
    <main className="shell flex min-h-screen items-center px-5 py-12">
      <form onSubmit={onSubmit} className="ios-group mx-auto w-full max-w-md p-6">
        <h1 className="display text-2xl">Passwort festlegen</h1>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Du wurdest eingeladen. Vergib jetzt dein Passwort, danach richte MFA ein.
        </p>
        <label className="mt-6 block text-[13px] font-semibold text-[var(--ink-soft)]">
          Neues Passwort
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
          {loading ? "…" : "Speichern & weiter"}
        </button>
      </form>
    </main>
  );
}
