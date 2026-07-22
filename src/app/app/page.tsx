import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ReiseDashboard } from "@/components/dashboard/reise-dashboard";
import { loadDashboardPayload } from "@/lib/dashboard-data";
import {
  formatMfaGraceRemaining,
  isWithinMfaEnrollGrace,
  MFA_ENROLL_GRACE_DAYS,
} from "@/lib/mfa";

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsEnroll = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal1";
  const showMfaGrace =
    needsEnroll && isWithinMfaEnrollGrace(user.created_at);
  const graceLabel = formatMfaGraceRemaining(user.created_at);

  const payload = await loadDashboardPayload();

  return (
    <main className="shell mx-auto min-h-screen w-full max-w-6xl px-5 py-8 md:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="section-label">Vacation Planer</p>
          <h1 className="display mt-1 text-3xl">
            {payload.featured?.phase === "active"
              ? "Unterwegs"
              : payload.featured?.phase === "upcoming"
                ? "Bald geht’s los"
                : "Dein Reise-Dashboard"}
          </h1>
        </div>
        <SignOutButton />
      </header>

      {showMfaGrace && (
        <div className="glass-callout mt-5 px-4 py-3 text-[14px]">
          <p className="font-semibold">MFA noch offen</p>
          <p className="mt-1 text-[13px] leading-relaxed">
            Du hast {MFA_ENROLL_GRACE_DAYS} Tage nach Account-Erstellung Zeit
            {graceLabel ? ` (${graceLabel})` : ""}. Danach ist der Authenticator
            Pflicht.
          </p>
          <Link
            href="/app/mfa/enroll"
            className="mt-2 inline-block text-[13px] font-semibold underline"
          >
            Jetzt einrichten
          </Link>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link href="/app/vacations/new" className="cta">
          Neuer Urlaub
        </Link>
        {payload.featured ? (
          <Link
            href={`/app/vacations/${payload.featured.vacation.id}`}
            className="cta cta-secondary"
          >
            Alle Details
          </Link>
        ) : null}
      </div>

      <ReiseDashboard payload={payload} />
    </main>
  );
}
