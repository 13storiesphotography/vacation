import { eachDateInclusive } from "@/lib/day-plans";

export type StayStatus = "interessiert" | "gebucht";

export const stayStatusLabels: Record<StayStatus, string> = {
  interessiert: "Interessiert",
  gebucht: "Gebucht",
};

export type SpotStay = {
  stay_check_in: string | null;
  stay_check_out: string | null;
  stay_nights: number | null;
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

export function stayNightCountFromDates(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number {
  return stayNightDates(checkIn, checkOut).length;
}

/** Prefer explicit stay_nights; otherwise derive from dates. */
export function resolveStayNights(stay: {
  stay_nights?: number | null;
  stay_check_in?: string | null;
  stay_check_out?: string | null;
}): number | null {
  if (stay.stay_nights != null && stay.stay_nights >= 1) return stay.stay_nights;
  const derived = stayNightCountFromDates(stay.stay_check_in, stay.stay_check_out);
  return derived > 0 ? derived : null;
}

export function addDaysIso(date: string, days: number): string {
  const cursor = new Date(`${date}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

export function checkoutFromNights(checkIn: string, nights: number): string {
  return addDaysIso(checkIn, Math.max(1, nights));
}

export function formatStaySummary(stay: {
  stay_nights?: number | null;
  stay_check_in?: string | null;
  stay_check_out?: string | null;
}): string | null {
  const nights = resolveStayNights(stay);
  if (!nights) return null;
  const nightsLabel = nights === 1 ? "1 Nacht" : `${nights} Nächte`;
  if (stay.stay_check_in && stay.stay_check_out) {
    const fmt = new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "short",
    });
    const from = fmt.format(new Date(`${stay.stay_check_in}T12:00:00Z`));
    const to = fmt.format(new Date(`${stay.stay_check_out}T12:00:00Z`));
    return `${nightsLabel} · ${from} → ${to}`;
  }
  return `${nightsLabel} · Datum offen`;
}

/** @deprecated use formatStaySummary */
export function formatStayRange(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  nights?: number | null,
): string | null {
  return formatStaySummary({
    stay_check_in: checkIn,
    stay_check_out: checkOut,
    stay_nights: nights,
  });
}

export function parseStayStatus(value: string): StayStatus | null {
  if (value === "interessiert" || value === "gebucht") return value;
  return null;
}

export function parseStayNights(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const nights = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(nights) || nights < 1) return null;
  return Math.min(60, nights);
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

/** Keep nights / checkout in sync when one side changes. */
export function syncCheckoutWithNights(
  checkIn: string,
  nights: number,
): string {
  return checkoutFromNights(checkIn, nights);
}
