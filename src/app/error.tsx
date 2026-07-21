"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shell flex min-h-screen items-center justify-center px-5 py-12">
      <div className="max-w-md text-center">
        <p className="text-[15px] font-semibold">Seite konnte nicht geladen werden</p>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          {error.message || "Ein Serverfehler ist aufgetreten. Bitte erneut versuchen."}
        </p>
        <button type="button" onClick={reset} className="cta mt-6">
          Neu laden
        </button>
      </div>
    </main>
  );
}
