"use client";

import { useMemo, useState } from "react";
import {
  CategoryIcon,
  categoryIconKeys,
  categoryIconLabels,
  type CategoryIconKey,
} from "@/components/category-icon";
import { GlassSheet } from "@/components/ui/glass-sheet";
import { createClient } from "@/lib/supabase/client";
import {
  slugifyCategoryKey,
  type VacationSpotCategory,
} from "@/lib/spots";

export function SpotCategoryManager({
  open,
  onClose,
  vacationId,
  categories,
  spotCounts,
  canEdit,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  vacationId: string;
  categories: VacationSpotCategory[];
  /** spot count per category key */
  spotCounts: Record<string, number>;
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftIcon, setDraftIcon] = useState<CategoryIconKey>("pin");
  const [draftOvernight, setDraftOvernight] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...categories].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "de"),
      ),
    [categories],
  );

  const editing = sorted.find((entry) => entry.id === editingId) ?? null;

  function resetDraft() {
    setEditingId(null);
    setDraftLabel("");
    setDraftIcon("pin");
    setDraftOvernight(false);
    setError(null);
  }

  function startEdit(entry: VacationSpotCategory) {
    setEditingId(entry.id);
    setDraftLabel(entry.label);
    setDraftIcon(
      (categoryIconKeys as readonly string[]).includes(entry.icon)
        ? (entry.icon as CategoryIconKey)
        : "pin",
    );
    setDraftOvernight(entry.supports_overnight);
    setError(null);
  }

  async function saveCategory() {
    if (!canEdit) return;
    const label = draftLabel.trim();
    if (!label) {
      setError("Name fehlt.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from("vacation_spot_categories")
          .update({
            label,
            icon: draftIcon,
            supports_overnight: draftOvernight,
          })
          .eq("id", editing.id)
          .eq("vacation_id", vacationId);
        if (updateError) throw updateError;
      } else {
        const existingKeys = new Set(categories.map((entry) => entry.key));
        let key = slugifyCategoryKey(label);
        if (existingKeys.has(key)) {
          key = `${key}_${Math.random().toString(36).slice(2, 5)}`;
        }
        const sortOrder =
          categories.reduce((max, entry) => Math.max(max, entry.sort_order), -1) + 1;
        const { error: insertError } = await supabase
          .from("vacation_spot_categories")
          .insert({
            vacation_id: vacationId,
            key,
            label,
            icon: draftIcon,
            sort_order: sortOrder,
            supports_overnight: draftOvernight,
          });
        if (insertError) throw insertError;
      }
      resetDraft();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(entry: VacationSpotCategory) {
    if (!canEdit) return;
    const count = spotCounts[entry.key] ?? 0;
    const fallback =
      sorted.find((item) => item.key !== entry.key)?.key ?? null;
    if (count > 0 && !fallback) {
      setError("Letzte Kategorie mit Spots kann nicht gelöscht werden.");
      return;
    }
    const message =
      count > 0
        ? `„${entry.label}“ löschen? ${count} Spot${count === 1 ? "" : "s"} werden nach „${
            sorted.find((item) => item.key === fallback)?.label ?? fallback
          }“ verschoben.`
        : `„${entry.label}“ wirklich löschen?`;
    if (!window.confirm(message)) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (count > 0 && fallback) {
        const { error: moveError } = await supabase
          .from("spots")
          .update({ category: fallback })
          .eq("vacation_id", vacationId)
          .eq("category", entry.key);
        if (moveError) throw moveError;
      }
      const { error: deleteError } = await supabase
        .from("vacation_spot_categories")
        .delete()
        .eq("id", entry.id)
        .eq("vacation_id", vacationId);
      if (deleteError) throw deleteError;
      if (editingId === entry.id) resetDraft();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassSheet
      open={open}
      title="Kategorien"
      subtitle="Namen und Symbole für diesen Urlaub"
      onClose={() => {
        resetDraft();
        onClose();
      }}
      panelClassName="glass-sheet-panel-tall"
      footer={
        canEdit ? (
          <div className="flex gap-2">
            {editing ? (
              <button
                type="button"
                className="cta cta-secondary flex-1"
                disabled={busy}
                onClick={resetDraft}
              >
                Abbrechen
              </button>
            ) : null}
            <button
              type="button"
              className="cta flex-1"
              disabled={busy}
              onClick={() => void saveCategory()}
            >
              {busy ? "…" : editing ? "Aktualisieren" : "Hinzufügen"}
            </button>
          </div>
        ) : (
          <button type="button" className="cta w-full" onClick={onClose}>
            Schließen
          </button>
        )
      }
    >
      {error ? <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p> : null}

      <ul className="ios-group mb-4">
        {sorted.map((entry) => {
          const count = spotCounts[entry.key] ?? 0;
          return (
            <li key={entry.id} className="ios-row">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04]">
                <CategoryIcon icon={entry.icon} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{entry.label}</p>
                <p className="text-[12px] text-[var(--ink-soft)]">
                  {count} Spot{count === 1 ? "" : "s"}
                  {entry.supports_overnight ? " · Übernachtung" : ""}
                </p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className="glass-chip !py-1.5 !text-[12px]"
                    data-active={editingId === entry.id ? "true" : undefined}
                    disabled={busy}
                    onClick={() => startEdit(entry)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    className="glass-chip glass-chip-danger !py-1.5 !text-[12px]"
                    disabled={busy || sorted.length <= 1}
                    onClick={() => void deleteCategory(entry)}
                  >
                    Löschen
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        <div>
          <p className="form-label">{editing ? "Kategorie bearbeiten" : "Neue Kategorie"}</p>
          <input
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            className="glass-field mt-1.5 px-3 py-3"
            placeholder="z. B. Badestelle"
            maxLength={40}
          />

          <p className="form-label mt-3">Symbol</p>
          <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:grid-cols-9">
            {categoryIconKeys.map((key) => (
              <button
                key={key}
                type="button"
                className="glass-chip !flex !h-10 !w-full !items-center !justify-center !px-0"
                data-active={draftIcon === key}
                title={categoryIconLabels[key]}
                aria-label={categoryIconLabels[key]}
                onClick={() => setDraftIcon(key)}
              >
                <CategoryIcon
                  icon={key}
                  size={16}
                  tone={draftIcon === key ? "#ffffff" : undefined}
                />
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={draftOvernight}
              onChange={(e) => setDraftOvernight(e.target.checked)}
            />
            Kann als Übernachtung geplant werden
          </label>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--ink-soft)]">
          Nur Spot-Editoren können Kategorien ändern.
        </p>
      )}
    </GlassSheet>
  );
}
