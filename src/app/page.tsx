import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-16">
      <p className="section-label">Vacation Planer</p>
      <h1 className="display mt-3 text-5xl leading-tight md:text-6xl">
        Gemeinsam Urlaub planen.
        <br />
        Privat und abgesichert.
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--ink-soft)]">
        Spots sammeln, Karte und Tagesplan — mit Login und MFA. Der Entwurf ist nur für
        eingeladene Nutzer sichtbar.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="cta">
          Anmelden
        </Link>
        <Link href="/signup" className="cta cta-secondary">
          Konto erstellen
        </Link>
        <Link href="/konzept" className="cta cta-secondary">
          Konzept ansehen
        </Link>
      </div>
    </main>
  );
}
