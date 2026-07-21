import { eachDateInclusive } from "@/lib/day-plans";

export type StayStatus = "interessiert" | "gebucht";

export const stayStatusLabels: Record<StayStatus, string> = {
  interessiert: "Interessiert",
  gebucht: "Gebucht",
};

export type SpotStay = {
  stay_check_in: string | null;
  stay_check_out: string | null;
  stay_status: StayStatus | null;
};

/** Nights slept: [checkIn, checkOut) as ISO dates. */
export function stayNightDates(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string[] {
  if (!checkIn || !checkOut) return [];
  const all = eachDateInclusive(checkIn, checkOut);
  // Drop checkout morning — last night is the day before checkout.
  return all.slice(0, -1);
}

export function stayNightCount(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number {
  return stayNightDates(checkIn, checkOut).length;
}

export function addDaysIso(date: string, days: number): string {
  const cursor = new Date(`${date}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

export function checkoutFromNights(checkIn: string, nights: number): string {
  return addDaysIso(checkIn, Math.max(1, nights));
}

export function formatStayRange(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string | null {
  const nights = stayNightCount(checkIn, checkOut);
  if (!checkIn || !checkOut || nights < 1) return null;
  const fmt = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "short",
  });
  const from = fmt.format(new Date(`${checkIn}T12:00:00Z`));
  const to = fmt.format(new Date(`${checkOut}T12:00:00Z`));
  return `${nights} Nacht${nights === 1 ? "" : "e"} · ${from} → ${to}`;
}

export function parseStayStatus(value: string): StayStatus | null {
  if (value === "interessiert" || value === "gebucht") return value;
  return null;
}

export function validateStayRange(
  checkIn: string | null,
  checkOut: string | null,
): string | null {
  if (!checkIn && !checkOut) return null;
  if (!checkIn || !checkOut) {
    return "Bitte Anreise und Abreise setzen — oder beides leer lassen.";
  }
  if (checkOut <= checkIn) {
    return "Abreise muss nach der Anreise liegen.";
  }
  return null;
}
