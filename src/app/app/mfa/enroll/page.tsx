"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatMfaGraceRemaining,
  isWithinMfaEnrollGrace,
  MFA_ENROLL_GRACE_DAYS,
} from "@/lib/mfa";

export default function EnrollMfaPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [graceLabel, setGraceLabel] = useState<string | null>(null);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && isWithinMfaEnrollGrace(user.created_at)) {
        setCanSkip(true);
        setGraceLabel(formatMfaGraceRemaining(user.created_at));
      }

      // Prefer an existing unverified TOTP factor instead of creating another on every visit.
      const listed = await supabase.auth.mfa.listFactors();
      const pending = listed.data?.all?.find(
        (factor) => factor.factor_type === "totp" && factor.status !== "verified",
      );
      if (pending) {
        setFactorId(pending.id);
        // Re-enroll is required to get a fresh QR for an unverified factor in some setups;
        // if we already have an id, try challenge path after user enters code.
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Vacation Planer",
      });
      if (enrollError) {
        // If a factor already exists, point the user at verify instead.
        if (/already exists|factor/i.test(enrollError.message)) {
          setError(
            "Authenticator ist schon angelegt. Bitte mit dem Code freischalten oder unter Verify fortfahren.",
          );
          return;
        }
        setError(enrollError.message);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setLoading(false);
      setError(challenge.error.message);
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
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
      <form onSubmit={onSubmit} className="ios-group mx-auto w-full max-w-md p-6">
        <h1 className="display text-2xl">MFA einrichten</h1>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Scanne den QR-Code mit einer Authenticator-App (1Password, Authy, Google
          Authenticator). Danach bist du mit Passwort + Code geschützt.
        </p>
        {canSkip && (
          <p className="glass-callout mt-3 px-3 py-2 text-[13px]">
            Du hast {MFA_ENROLL_GRACE_DAYS} Tage Zeit nach der Einladung
            {graceLabel ? ` (${graceLabel})` : ""}. Später einrichten geht — danach wird MFA
            Pflicht.
          </p>
        )}
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="MFA QR Code"
            className="mx-auto mt-6 h-48 w-48 rounded-[16px] bg-white p-3"
          />
        ) : (
          <div className="mx-auto mt-6 h-48 w-48 animate-pulse rounded-[16px] bg-black/5" />
        )}
        {secret && (
          <p className="mt-3 break-all text-center text-[12px] text-[var(--ink-faint)]">
            Secret: {secret}
          </p>
        )}
        <label className="mt-6 block text-[13px] font-semibold text-[var(--ink-soft)]">
          6-stelliger Code
          <input
            className="glass-field mt-1.5 px-3 py-3 text-center text-[20px] tracking-[0.3em]"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
          />
        </label>
        {error && <p className="mt-4 text-[14px] text-[var(--danger)]">{error}</p>}
        <button type="submit" className="cta mt-6 w-full" disabled={loading || !factorId}>
          {loading ? "…" : "Aktivieren"}
        </button>
        {canSkip && (
          <Link
            href="/app"
            className="mt-3 block text-center text-[14px] font-semibold text-[var(--fjord)]"
          >
            Später einrichten
          </Link>
        )}
      </form>
    </main>
  );
}
