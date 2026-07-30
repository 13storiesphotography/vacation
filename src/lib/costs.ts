import { resolveStayNights } from "@/lib/stay";
import { isOvernightCategory } from "@/lib/overnight";
import type { Database } from "@/lib/database.types";

export type CostCategory =
  | "uebernachtung"
  | "anschaffung"
  | "sprit"
  | "maut"
  | "verpflegung"
  | "aktivitaet"
  | "sonstiges";

export type CostStatus = "geplant" | "gebucht" | "bezahlt";

export type CostItem = Database["public"]["Tables"]["cost_items"]["Row"];
export type SpotRow = Database["public"]["Tables"]["spots"]["Row"];
export type VacationRow = Database["public"]["Tables"]["vacations"]["Row"];

export const costCategoryLabels: Record<CostCategory, string> = {
  uebernachtung: "Übernachtung",
  anschaffung: "Anschaffung",
  sprit: "Sprit",
  maut: "Maut / Fähre",
  verpflegung: "Verpflegung",
  aktivitaet: "Aktivität",
  sonstiges: "Sonstiges",
};

export const costCategoryOptions = Object.entries(costCategoryLabels).map(
  ([value, label]) => ({ value: value as CostCategory, label }),
);

export const costStatusLabels: Record<CostStatus, string> = {
  geplant: "Geplant",
  gebucht: "Gebucht",
  bezahlt: "Bezahlt",
};

export const costStatusOptions = Object.entries(costStatusLabels).map(
  ([value, label]) => ({ value: value as CostStatus, label }),
);

export function costItemTotal(item: {
  amount: number | string;
  quantity: number | string;
}): number {
  const amount = Number(item.amount);
  const quantity = Number(item.quantity);
  if (!Number.isFinite(amount) || !Number.isFinite(quantity)) return 0;
  return amount * quantity;
}

export function formatMoney(
  value: number,
  currency = "EUR",
  locale = "de-DE",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

export function formatMoneyExact(
  value: number,
  currency = "EUR",
  locale = "de-DE",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export type CategoryBreakdown = {
  category: CostCategory;
  label: string;
  total: number;
  count: number;
};

export type CostSummary = {
  currency: string;
  budgetTotal: number | null;
  itemsTotal: number;
  paidTotal: number;
  plannedTotal: number;
  remainingBudget: number | null;
  byCategory: CategoryBreakdown[];
  fuelEstimate: {
    km: number;
    liters: number;
    cost: number;
    lPer100: number;
    pricePerLiter: number;
  } | null;
  overnightEstimate: {
    nights: number;
    cost: number;
    openNights: number;
  };
  purchaseOpenCount: number;
};

export function summarizeCosts(options: {
  items: CostItem[];
  spots: SpotRow[];
  currency?: string | null;
  budgetTotal?: number | string | null;
  fuelLPer100?: number | string | null;
  fuelPricePerLiter?: number | string | null;
  tripKm?: number | null;
}): CostSummary {
  const currency = options.currency?.trim() || "EUR";
  const budgetRaw = options.budgetTotal == null ? null : Number(options.budgetTotal);
  const budgetTotal =
    budgetRaw != null && Number.isFinite(budgetRaw) ? budgetRaw : null;

  const byCategoryMap = new Map<CostCategory, CategoryBreakdown>();
  for (const category of Object.keys(costCategoryLabels) as CostCategory[]) {
    byCategoryMap.set(category, {
      category,
      label: costCategoryLabels[category],
      total: 0,
      count: 0,
    });
  }

  let itemsTotal = 0;
  let paidTotal = 0;
  let plannedTotal = 0;
  let purchaseOpenCount = 0;

  for (const item of options.items) {
    const total = costItemTotal(item);
    itemsTotal += total;
    if (item.status === "bezahlt") paidTotal += total;
    else plannedTotal += total;

    const bucket = byCategoryMap.get(item.category as CostCategory);
    if (bucket) {
      bucket.total += total;
      bucket.count += 1;
    }

    if (item.category === "anschaffung" && item.status !== "bezahlt") {
      purchaseOpenCount += 1;
    }
  }

  const lPer100 = Number(options.fuelLPer100 ?? 9.5);
  const pricePerLiter = Number(options.fuelPricePerLiter ?? 1.75);
  const tripKm =
    options.tripKm != null && Number.isFinite(options.tripKm)
      ? Math.max(0, options.tripKm)
      : null;

  let fuelEstimate: CostSummary["fuelEstimate"] = null;
  if (tripKm != null && tripKm > 0 && Number.isFinite(lPer100) && Number.isFinite(pricePerLiter)) {
    const liters = (tripKm / 100) * lPer100;
    fuelEstimate = {
      km: tripKm,
      liters,
      cost: liters * pricePerLiter,
      lPer100,
      pricePerLiter,
    };
  }

  let overnightNights = 0;
  let overnightCost = 0;
  let openNights = 0;
  for (const spot of options.spots) {
    if (!isOvernightCategory(spot.category)) continue;
    const nights = resolveStayNights(spot);
    if (!nights) continue;
    overnightNights += nights;
    const price = spot.price_per_night != null ? Number(spot.price_per_night) : NaN;
    if (Number.isFinite(price) && price >= 0) {
      overnightCost += nights * price;
    } else if (spot.overnight_cost === "kostenpflichtig" || spot.overnight_cost == null) {
      openNights += nights;
    }
  }

  const byCategory = [...byCategoryMap.values()]
    .filter((row) => row.count > 0 || row.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    currency,
    budgetTotal,
    itemsTotal,
    paidTotal,
    plannedTotal,
    remainingBudget: budgetTotal == null ? null : budgetTotal - itemsTotal,
    byCategory,
    fuelEstimate,
    overnightEstimate: {
      nights: overnightNights,
      cost: overnightCost,
      openNights,
    },
    purchaseOpenCount,
  };
}

/** Grand total including fuel estimate if no explicit sprit line covers it. */
export function plannerGrandTotal(summary: CostSummary): number {
  let total = summary.itemsTotal;
  const hasSpritLines = summary.byCategory.some(
    (row) => row.category === "sprit" && row.count > 0,
  );
  if (!hasSpritLines && summary.fuelEstimate) {
    total += summary.fuelEstimate.cost;
  }
  const hasOvernightLines = summary.byCategory.some(
    (row) => row.category === "uebernachtung" && row.count > 0,
  );
  if (!hasOvernightLines && summary.overnightEstimate.cost > 0) {
    total += summary.overnightEstimate.cost;
  }
  return total;
}
