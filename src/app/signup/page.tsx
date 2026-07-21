import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="shell flex min-h-screen items-center px-5 py-12">
      <div className="ios-group mx-auto w-full max-w-md p-6">
        <h1 className="display text-2xl">Nur per Einladung</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
          Neue Konten können sich nicht selbst registrieren. Ein Admin lädt dich ein — danach
          setzt du Passwort und MFA.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Bist du der erste Admin? Lege den Account einmalig im Supabase Dashboard an
          (Authentication → Users → Add user), melde dich hier an und richte MFA ein.
        </p>
        <Link href="/login" className="cta mt-6 inline-flex w-full">
          Zur Anmeldung
        </Link>
      </div>
    </main>
  );
}
