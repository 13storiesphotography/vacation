"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shell flex min-h-[60vh] items-center justify-center px-5 py-12">
      <div className="max-w-md text-center">
        <p className="text-[15px] font-semibold">Etwas ist schiefgelaufen</p>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          {error.message || "Bitte Seite neu laden oder später nochmal versuchen."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex rounded-[12px] bg-[var(--ink)] px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          Erneut versuchen
        </button>
      </div>
    </main>
  );
}
