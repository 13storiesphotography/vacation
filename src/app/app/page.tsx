import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/app/sign-out-button";
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

  const { data: vacations, error } = await supabase
    .from("vacations")
    .select("id, title, type, region, start_date, end_date")
    .order("start_date", { ascending: true });

  return (
    <main className="shell mx-auto min-h-screen w-full max-w-6xl px-5 py-8 md:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="section-label">Vacation Planer</p>
          <h1 className="display mt-1 text-3xl">Deine Urlaube</h1>
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

      {error && (
        <p className="mt-6 text-[14px] text-[var(--danger)]">{error.message}</p>
      )}

      <div className="ios-group mt-6">
        {(vacations ?? []).length === 0 ? (
          <div className="p-5 text-[15px] text-[var(--ink-soft)]">
            Noch keine Urlaube. Lege den Schweden-Van-Trip an und lade danach dein Team ein.
          </div>
        ) : (
          vacations?.map((vacation) => (
            <Link
              key={vacation.id}
              href={`/app/vacations/${vacation.id}`}
              className="ios-row ios-chevron"
            >
              <div>
                <p className="text-[15px] font-semibold">{vacation.title}</p>
                <p className="text-[13px] text-[var(--ink-soft)]">
                  {vacation.start_date} – {vacation.end_date}
                  {vacation.region ? ` · ${vacation.region}` : ""}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
