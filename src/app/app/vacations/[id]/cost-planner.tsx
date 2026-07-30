"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { DayPlanWithStops } from "@/lib/day-plans";
import { buildTripRoute } from "@/lib/day-route";
import { resolveStayNights, formatStaySummary } from "@/lib/stay";
import { isOvernightCategory } from "@/lib/overnight";
import {
  costCategoryLabels,
  costCategoryOptions,
  costItemTotal,
  costStatusLabels,
  costStatusOptions,
  formatMoney,
  formatMoneyExact,
  plannerGrandTotal,
  summarizeCosts,
  type CostCategory,
  type CostItem,
  type CostStatus,
} from "@/lib/costs";

type Spot = Database["public"]["Tables"]["spots"]["Row"];
type Vacation = Database["public"]["Tables"]["vacations"]["Row"];

type DraftItem = {
  title: string;
  category: CostCategory;
  amount: string;
  quantity: string;
  unit: string;
  status: CostStatus;
  notes: string;
};

const emptyDraft = (): DraftItem => ({
  title: "",
  category: "anschaffung",
  amount: "",
  quantity: "1",
  unit: "Stück",
  status: "geplant",
  notes: "",
});

function draftFromItem(item: CostItem): DraftItem {
  return {
    title: item.title,
    category: item.category as CostCategory,
    amount: String(item.amount),
    quantity: String(item.quantity),
    unit: item.unit ?? "",
    status: item.status as CostStatus,
    notes: item.notes ?? "",
  };
}

function parseDraftAmounts(draft: DraftItem): {
  title: string;
  amount: number;
  quantity: number;
  error?: string;
} {
  const title = draft.title.trim();
  if (!title) return { title: "", amount: 0, quantity: 0, error: "Bitte einen Titel eingeben." };
  const amount = Number(draft.amount.replace(",", "."));
  const quantity = Number(draft.quantity.replace(",", ".") || "1");
  if (!Number.isFinite(amount) || amount < 0) {
    return { title, amount: 0, quantity: 0, error: "Betrag ungültig." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { title, amount: 0, quantity: 0, error: "Menge ungültig." };
  }
  return { title, amount, quantity };
}

function CostDraftFields({
  draft,
  setDraft,
}: {
  draft: DraftItem;
  setDraft: Dispatch<SetStateAction<DraftItem>>;
}) {
  return (
    <>
      <label className="form-label">
        Titel
        <input
          className="glass-field mt-1.5 px-3 py-3"
          required
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Campingstuhl, Öresundbrücke, Airbnb Stockholm…"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="form-label">
          Kategorie
          <select
            className="glass-field mt-1.5 px-3 py-3"
            value={draft.category}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                category: e.target.value as CostCategory,
                unit:
                  e.target.value === "uebernachtung"
                    ? "Nacht"
                    : e.target.value === "anschaffung"
                      ? "Stück"
                      : prev.unit,
              }))
            }
          >
            {costCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Status
          <select
            className="glass-field mt-1.5 px-3 py-3"
            value={draft.status}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                status: e.target.value as CostStatus,
              }))
            }
          >
            {costStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="form-label">
          Betrag
          <input
            className="glass-field mt-1.5 px-3 py-3"
            inputMode="decimal"
            required
            value={draft.amount}
            onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="0"
          />
        </label>
        <label className="form-label">
          Menge
          <input
            className="glass-field mt-1.5 px-3 py-3"
            inputMode="decimal"
            value={draft.quantity}
            onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
          />
        </label>
        <label className="form-label">
          Einheit
          <input
            className="glass-field mt-1.5 px-3 py-3"
            value={draft.unit}
            onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="Stück"
          />
        </label>
      </div>
      <label className="form-label">
        Notiz
        <input
          className="glass-field mt-1.5 px-3 py-3"
          value={draft.notes}
          onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="optional"
        />
      </label>
    </>
  );
}

export function CostPlannerPanel({
  vacation,
  spots,
  canEdit,
  onVacationPatch,
}: {
  vacation: Vacation;
  spots: Spot[];
  canEdit: boolean;
  onVacationPatch: (patch: Partial<Vacation>) => void;
}) {
  const [items, setItems] = useState<CostItem[]>([]);
  const [days, setDays] = useState<DayPlanWithStops[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [filter, setFilter] = useState<"all" | CostCategory | "anschaffung">("all");
  const [budgetDraft, setBudgetDraft] = useState(() =>
    vacation.budget_total != null ? String(vacation.budget_total) : "",
  );
  const [fuelLDraft, setFuelLDraft] = useState(() =>
    vacation.fuel_l_per_100km != null ? String(vacation.fuel_l_per_100km) : "9.5",
  );
  const [fuelPriceDraft, setFuelPriceDraft] = useState(() =>
    vacation.fuel_price_per_liter != null ? String(vacation.fuel_price_per_liter) : "1.75",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [{ data: costData, error: costError }, dashRes] = await Promise.all([
        supabase
          .from("cost_items")
          .select("*")
          .eq("vacation_id", vacation.id)
          .order("created_at", { ascending: false }),
        fetch(`/api/vacations/${vacation.id}/dashboard`, { cache: "no-store" }),
      ]);
      if (costError) {
        setError(costError.message);
        setItems([]);
      } else {
        setItems((costData ?? []) as CostItem[]);
      }

      if (dashRes.ok) {
        const json = (await dashRes.json()) as { days?: DayPlanWithStops[] };
        setDays(json.days ?? []);
      } else {
        setDays([]);
      }
    } catch {
      setError("Kosten konnten nicht geladen werden.");
      setItems([]);
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [vacation.id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const spotsById = useMemo(
    () => new Map(spots.map((spot) => [spot.id, spot])),
    [spots],
  );

  const tripKm = useMemo(() => {
    if (!days.length) return null;
    const route = buildTripRoute(days, spotsById);
    return route.totalKm > 0 ? route.totalKm : null;
  }, [days, spotsById]);

  const summary = useMemo(
    () =>
      summarizeCosts({
        items,
        spots,
        currency: vacation.currency,
        budgetTotal: vacation.budget_total,
        fuelLPer100: vacation.fuel_l_per_100km,
        fuelPricePerLiter: vacation.fuel_price_per_liter,
        tripKm,
      }),
    [items, spots, vacation, tripKm],
  );

  const grandTotal = plannerGrandTotal(summary);
  const currency = summary.currency;

  const overnightSpots = useMemo(
    () =>
      spots.filter(
        (spot) => isOvernightCategory(spot.category) && resolveStayNights(spot),
      ),
    [spots],
  );

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.category === filter);
  }, [items, filter]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const budget = budgetDraft.trim() === "" ? null : Number(budgetDraft.replace(",", "."));
    const fuelL = Number(fuelLDraft.replace(",", "."));
    const fuelPrice = Number(fuelPriceDraft.replace(",", "."));
    const patch = {
      budget_total:
        budget != null && Number.isFinite(budget) && budget >= 0 ? budget : null,
      fuel_l_per_100km: Number.isFinite(fuelL) && fuelL > 0 ? fuelL : 9.5,
      fuel_price_per_liter:
        Number.isFinite(fuelPrice) && fuelPrice > 0 ? fuelPrice : 1.75,
    };
    const { error: updateError } = await supabase
      .from("vacations")
      .update(patch)
      .eq("id", vacation.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onVacationPatch(patch);
    setMessage("Budget & Sprit gespeichert.");
  }

  async function createItem(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    const parsed = parseDraftAmounts(draft);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("cost_items").insert({
      vacation_id: vacation.id,
      title: parsed.title,
      category: draft.category,
      amount: parsed.amount,
      quantity: parsed.quantity,
      unit: draft.unit.trim() || null,
      status: draft.status,
      notes: draft.notes.trim() || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft(emptyDraft());
    setShowForm(false);
    setMessage("Position hinzugefügt.");
    await load();
  }

  async function saveEditedItem(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !editingId) return;
    const parsed = parseDraftAmounts(draft);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const patch = {
      title: parsed.title,
      category: draft.category,
      amount: parsed.amount,
      quantity: parsed.quantity,
      unit: draft.unit.trim() || null,
      status: draft.status,
      notes: draft.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from("cost_items")
      .update(patch)
      .eq("id", editingId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((prev) =>
      prev.map((row) =>
        row.id === editingId
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
    setEditingId(null);
    setDraft(emptyDraft());
    setMessage("Position aktualisiert.");
  }

  function startEdit(item: CostItem) {
    setShowForm(false);
    setEditingId(item.id);
    setDraft(draftFromItem(item));
    setError(null);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function updateItemStatus(item: CostItem, status: CostStatus) {
    if (!canEdit) return;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("cost_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, status } : row)),
    );
  }

  async function deleteItem(item: CostItem) {
    if (!canEdit) return;
    if (!window.confirm(`„${item.title}“ löschen?`)) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("cost_items")
      .delete()
      .eq("id", item.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== item.id));
  }

  async function addOvernightFromSpot(spot: Spot) {
    if (!canEdit) return;
    const nights = resolveStayNights(spot);
    const price = spot.price_per_night != null ? Number(spot.price_per_night) : NaN;
    if (!nights || !Number.isFinite(price) || price < 0) {
      setError("Spot braucht Nächte und Preis/Nacht.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("cost_items").insert({
      vacation_id: vacation.id,
      title: spot.name,
      category: "uebernachtung",
      amount: price,
      quantity: nights,
      unit: nights === 1 ? "Nacht" : "Nächte",
      status: spot.stay_status === "gebucht" ? "gebucht" : "geplant",
      spot_id: spot.id,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setMessage(`Übernachtung „${spot.name}“ übernommen.`);
    await load();
  }

  async function addFuelEstimate() {
    if (!canEdit || !summary.fuelEstimate) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("cost_items").insert({
      vacation_id: vacation.id,
      title: `Sprit · ca. ${Math.round(summary.fuelEstimate.km)} km`,
      category: "sprit",
      amount: Math.round(summary.fuelEstimate.cost * 100) / 100,
      quantity: 1,
      unit: null,
      status: "geplant",
      notes: `${summary.fuelEstimate.liters.toFixed(1)} L · ${summary.fuelEstimate.lPer100} L/100km · ${formatMoneyExact(summary.fuelEstimate.pricePerLiter, currency)}/L`,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setMessage("Sprit-Schätzung als Position übernommen.");
    await load();
  }

  const maxCategory = Math.max(1, ...summary.byCategory.map((row) => row.total));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="display text-2xl">Kosten</h1>
        <p className="tab-subtitle">
          Übernachtungen, Anschaffungen, Sprit & Co. im Blick.
        </p>
      </div>

      {loading ? (
        <div className="ios-group p-4 text-[14px] text-[var(--ink-soft)]">Lädt…</div>
      ) : (
        <>
          <div className="ios-group p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              Überblick
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="glass-subpanel p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  Gesamt
                </p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums">
                  {formatMoney(grandTotal, currency)}
                </p>
              </div>
              <div className="glass-subpanel p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  Bezahlt
                </p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--pine)]">
                  {formatMoney(summary.paidTotal, currency)}
                </p>
              </div>
              <div className="glass-subpanel p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  Offen
                </p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--sun)]">
                  {formatMoney(summary.plannedTotal, currency)}
                </p>
              </div>
              <div className="glass-subpanel p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  Budget
                </p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums">
                  {summary.budgetTotal != null
                    ? formatMoney(summary.budgetTotal, currency)
                    : "—"}
                </p>
                {summary.remainingBudget != null ? (
                  <p
                    className={`mt-1 text-[12px] font-medium ${
                      summary.remainingBudget >= 0
                        ? "text-[var(--pine)]"
                        : "text-[var(--danger)]"
                    }`}
                  >
                    {summary.remainingBudget >= 0 ? "Rest " : "Über "}
                    {formatMoney(Math.abs(summary.remainingBudget), currency)}
                  </p>
                ) : null}
              </div>
            </div>

            {summary.byCategory.length > 0 ? (
              <div className="mt-4 space-y-2">
                {summary.byCategory.map((row) => (
                  <div key={row.category}>
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-medium">{row.label}</span>
                      <span className="tabular-nums text-[var(--ink-soft)]">
                        {formatMoney(row.total, currency)} · {row.count}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full rounded-full bg-[var(--fjord)]"
                        style={{ width: `${Math.max(6, (row.total / maxCategory) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-[var(--ink-soft)]">
                Noch keine Positionen — Anschaffungen, Maut oder Übernachtungen hinzufügen.
              </p>
            )}
          </div>

          <div className="ios-group p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              Reise & Übernachtung
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="glass-subpanel p-3">
                <p className="text-[14px] font-semibold">Sprit-Schätzung</p>
                {summary.fuelEstimate ? (
                  <>
                    <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                      ca. {Math.round(summary.fuelEstimate.km)} km ·{" "}
                      {summary.fuelEstimate.liters.toFixed(1)} L ·{" "}
                      <span className="font-semibold text-[var(--ink)]">
                        {formatMoney(summary.fuelEstimate.cost, currency)}
                      </span>
                    </p>
                    {canEdit ? (
                      <button
                        type="button"
                        className="glass-chip mt-3"
                        disabled={saving}
                        onClick={() => void addFuelEstimate()}
                      >
                        Als Position übernehmen
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                    Noch keine Route mit Koordinaten im Plan.
                  </p>
                )}
              </div>
              <div className="glass-subpanel p-3">
                <p className="text-[14px] font-semibold">Übernachtungen</p>
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  {summary.overnightEstimate.nights} Nächte
                  {summary.overnightEstimate.cost > 0
                    ? ` · ${formatMoney(summary.overnightEstimate.cost, currency)}`
                    : ""}
                  {summary.overnightEstimate.openNights > 0
                    ? ` · ${summary.overnightEstimate.openNights} ohne Preis/Nacht`
                    : ""}
                </p>
              </div>
            </div>

            {overnightSpots.length > 0 ? (
              <div className="mt-3 space-y-2">
                {overnightSpots.map((spot) => {
                  const nights = resolveStayNights(spot) ?? 0;
                  const price =
                    spot.price_per_night != null ? Number(spot.price_per_night) : null;
                  const already = items.some(
                    (item) =>
                      item.spot_id === spot.id && item.category === "uebernachtung",
                  );
                  return (
                    <div
                      key={spot.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-2 text-[13px]"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{spot.name}</p>
                        <p className="text-[12px] text-[var(--ink-soft)]">
                          {formatStaySummary(spot) || `${nights} Nächte`}
                          {price != null
                            ? ` · ${formatMoneyExact(price, currency)}/Nacht`
                            : spot.price_hint
                              ? ` · ${spot.price_hint}`
                              : " · Preis/Nacht im Spot setzen"}
                        </p>
                      </div>
                      {canEdit && price != null && !already ? (
                        <button
                          type="button"
                          className="glass-chip"
                          disabled={saving}
                          onClick={() => void addOvernightFromSpot(spot)}
                        >
                          Übernehmen
                        </button>
                      ) : already ? (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pine)]">
                          Im Plan
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {canEdit ? (
            <form onSubmit={saveSettings} className="ios-group p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                Einstellungen
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="form-label">
                  Budget gesamt ({currency})
                  <input
                    className="glass-field mt-1.5 px-3 py-3"
                    inputMode="decimal"
                    value={budgetDraft}
                    onChange={(e) => setBudgetDraft(e.target.value)}
                    placeholder="z. B. 2500"
                  />
                </label>
                <label className="form-label">
                  Verbrauch L/100km
                  <input
                    className="glass-field mt-1.5 px-3 py-3"
                    inputMode="decimal"
                    value={fuelLDraft}
                    onChange={(e) => setFuelLDraft(e.target.value)}
                  />
                </label>
                <label className="form-label">
                  Spritpreis / L
                  <input
                    className="glass-field mt-1.5 px-3 py-3"
                    inputMode="decimal"
                    value={fuelPriceDraft}
                    onChange={(e) => setFuelPriceDraft(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" className="cta mt-4 w-full sm:w-auto" disabled={saving}>
                {saving ? "…" : "Speichern"}
              </button>
            </form>
          ) : null}

          <div className="ios-group p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                Positionen
              </p>
              {canEdit ? (
                <button
                  type="button"
                  className="glass-chip"
                  onClick={() => {
                    setEditingId(null);
                    setShowForm((open) => !open);
                    setDraft(emptyDraft());
                  }}
                >
                  {showForm ? "Abbrechen" : "Hinzufügen"}
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="glass-chip"
                data-active={filter === "all" ? "true" : undefined}
                onClick={() => setFilter("all")}
              >
                Alle
              </button>
              <button
                type="button"
                className="glass-chip"
                data-active={filter === "anschaffung" ? "true" : undefined}
                onClick={() => setFilter("anschaffung")}
              >
                Anschaffungen
                {summary.purchaseOpenCount > 0 ? ` (${summary.purchaseOpenCount})` : ""}
              </button>
              {costCategoryOptions
                .filter((option) => option.value !== "anschaffung")
                .map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="glass-chip"
                    data-active={filter === option.value ? "true" : undefined}
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
            </div>

            {showForm && canEdit ? (
              <form onSubmit={createItem} className="glass-subpanel mt-4 space-y-3 p-3">
                <CostDraftFields draft={draft} setDraft={setDraft} />
                <button type="submit" className="cta w-full" disabled={saving}>
                  {saving ? "…" : "Position speichern"}
                </button>
              </form>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                    <th className="py-2 pr-2 font-semibold">Position</th>
                    <th className="py-2 pr-2 font-semibold">Kat.</th>
                    <th className="py-2 pr-2 font-semibold">Status</th>
                    <th className="py-2 pr-2 text-right font-semibold">Summe</th>
                    {canEdit ? <th className="py-2 font-semibold" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEdit ? 5 : 4}
                        className="py-4 text-[var(--ink-soft)]"
                      >
                        Keine Positionen in diesem Filter.
                      </td>
                    </tr>
                  ) : (
                    visibleItems.map((item) => {
                      const isEditing = editingId === item.id;
                      return (
                        <Fragment key={item.id}>
                          <tr className="border-b border-black/5 align-middle">
                            <td className="py-2.5 pr-2">
                              <p className="font-semibold">{item.title}</p>
                              <p className="text-[12px] text-[var(--ink-soft)]">
                                {formatMoneyExact(Number(item.amount), currency)}
                                {Number(item.quantity) !== 1
                                  ? ` × ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                                  : item.unit
                                    ? ` / ${item.unit}`
                                    : ""}
                                {item.notes ? ` · ${item.notes}` : ""}
                              </p>
                            </td>
                            <td className="py-2.5 pr-2 text-[var(--ink-soft)]">
                              {costCategoryLabels[item.category as CostCategory] ?? item.category}
                            </td>
                            <td className="py-2.5 pr-2">
                              {canEdit && !isEditing ? (
                                <select
                                  className="cost-status-select"
                                  value={item.status}
                                  aria-label={`Status für ${item.title}`}
                                  onChange={(e) =>
                                    void updateItemStatus(item, e.target.value as CostStatus)
                                  }
                                >
                                  {costStatusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                costStatusLabels[item.status as CostStatus] ?? item.status
                              )}
                            </td>
                            <td className="py-2.5 pr-2 text-right font-semibold tabular-nums">
                              {formatMoney(costItemTotal(item), currency)}
                            </td>
                            {canEdit ? (
                              <td className="py-2.5 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    className="glass-chip !px-2.5 !py-1 !text-[12px]"
                                    data-active={isEditing ? "true" : undefined}
                                    onClick={() =>
                                      isEditing ? cancelEdit() : startEdit(item)
                                    }
                                  >
                                    {isEditing ? "Schließen" : "Bearbeiten"}
                                  </button>
                                  <button
                                    type="button"
                                    className="glass-chip glass-chip-danger !px-2.5 !py-1 !text-[12px]"
                                    onClick={() => void deleteItem(item)}
                                  >
                                    Löschen
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                          {isEditing ? (
                            <tr className="border-b border-black/5">
                              <td colSpan={canEdit ? 5 : 4} className="pb-3 pt-1">
                                <form
                                  onSubmit={saveEditedItem}
                                  className="glass-subpanel space-y-3 p-3"
                                >
                                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                                    Position bearbeiten
                                  </p>
                                  <CostDraftFields draft={draft} setDraft={setDraft} />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      className="cta cta-secondary flex-1"
                                      onClick={cancelEdit}
                                    >
                                      Abbrechen
                                    </button>
                                    <button
                                      type="submit"
                                      className="cta flex-1"
                                      disabled={saving}
                                    >
                                      {saving ? "…" : "Speichern"}
                                    </button>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {message ? <p className="text-[13px] text-[var(--pine)]">{message}</p> : null}
      {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
