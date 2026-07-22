import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/app/sign-out-button";
import {
  todayIso,
  tripPhase,
  vacationTypeLabel,
  type VacationSummary,
} from "@/lib/dashboard";
import { loadVacationList } from "@/lib/dashboard-data";
import {
  formatMfaGraceRemaining,
  isWithinMfaEnrollGrace,
  MFA_ENROLL_GRACE_DAYS,
} from "@/lib/mfa";

function phaseLabel(phase: ReturnType<typeof tripPhase>) {
  if (phase === "active") return "Unterwegs";
  if (phase === "upcoming") return "Demnächst";
  return "Vergangen";
}

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

  const vacations = await loadVacationList();
  const today = todayIso();

  return (
    <main className="shell mx-auto min-h-screen w-full max-w-6xl px-5 py-8 md:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="section-label">Vacation Planer</p>
          <h1 className="display mt-1 text-3xl">Urlaube</h1>
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
      </div>

      {vacations.length === 0 ? (
        <div className="ios-group mt-6 p-5">
          <p className="text-[15px] font-semibold">Noch keine Urlaube</p>
          <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
            Lege den nächsten Trip an — Countdown, Route und Wetter findest du
            danach im Tab <span className="font-semibold">Urlaub</span>.
          </p>
        </div>
      ) : (
        <div className="ios-group mt-6">
          {vacations.map((vacation: VacationSummary) => {
            const phase = tripPhase(vacation, today);
            return (
              <Link
                key={vacation.id}
                href={`/app/vacations/${vacation.id}?tab=urlaub`}
                className="ios-row ios-chevron"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    {vacation.title}
                  </p>
                  <p className="text-[13px] text-[var(--ink-soft)]">
                    {phaseLabel(phase)}
                    {" · "}
                    {vacation.start_date} – {vacation.end_date}
                    {vacation.region
                      ? ` · ${vacation.region}`
                      : ` · ${vacationTypeLabel(vacation.type)}`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
