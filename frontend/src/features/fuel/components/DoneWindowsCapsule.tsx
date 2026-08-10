// ============================================================
// Mezo · DoneWindowsCapsule — the day's done meal windows, merged into ONE expandable capsule
// (mezo-c9t5, keret-hero Task 3 — AI-score visszakötés, replaces the retired KeretBelt's
// per-window done capsules). Sits first in the sky (chronologically earliest), independent of the
// `?w=` window-selection mechanism — its own local open/closed toggle, never "big". Design:
// docs/superpowers/specs/2026-08-09-fuel-keret-hero-design.md §1.4, mockup asset
// docs/superpowers/specs/assets/2026-08-09-fuel-keret-hero-mockup.html (`#donefold`).
// ============================================================
import { huInt } from '@/shared/lib/huNum'
import { MEAL_ROLE_LABEL, type MealRole } from '@/features/fuel/logic/keretHero'

export interface DoneCapsuleRow {
  mealId: string
  name: string
  time: string
  kcal: number | null
  proteinG: number | null
  role: MealRole
  scorePct: number | null
  /** MealScoreSheet needs the real `FuelMeal.breakdown` (it renders null without one) — a done
   *  row whose meal carries no breakdown is inert copy, no click affordance (never a dead tap). */
  clickable: boolean
}

function metaLine(row: DoneCapsuleRow): string {
  const parts = [row.time]
  if (row.kcal != null) parts.push(`${row.kcal} kcal`)
  if (row.proteinG != null) parts.push(`${row.proteinG} g P`)
  return parts.join(' · ')
}

function RowBody({ row }: { row: DoneCapsuleRow }) {
  return (
    <>
      <span className="kdone-row-tx">
        <span className="kdone-row-t">
          {row.name}
          <span className={`kdone-roletag kdone-roletag-${row.role}`}>{MEAL_ROLE_LABEL[row.role]}</span>
        </span>
        <span className="kdone-row-m">{metaLine(row)}</span>
      </span>
      {row.scorePct != null && (
        <span className={row.scorePct >= 90 ? 'kdone-chip' : 'kdone-chip kdone-chip-mid'}>
          ✨ {row.scorePct}
        </span>
      )}
    </>
  )
}

export function DoneWindowsCapsule({ group, rows, open, onToggle, onRowSelect }: {
  group: { count: number; kcal: number; avgScore: number | null }
  rows: DoneCapsuleRow[]
  open: boolean
  onToggle: () => void
  onRowSelect: (mealId: string) => void
}) {
  const summary = [
    `${group.count} kész ablak`,
    `${huInt(group.kcal)} kcal`,
    group.avgScore != null ? `AI-átlag ${group.avgScore} p` : null,
  ].filter(Boolean).join(' · ')

  return (
    // No `data-tone` — it isn't a window/belt island (WindowIsland/KeretBelt's `.isl[data-tone]`
    // contract), just borrowing the shared `.isl` shell for visual chrome; a page-level query for
    // "the window islands" (`.isl[data-tone="fuel"]`) must not accidentally match this capsule.
    <section className="isl kdone">
      <button type="button" className="kdone-cap" aria-expanded={open} onClick={onToggle}>
        <span aria-hidden="true">✓</span>
        <span className="kdone-cap-tx">{summary}</span>
        <span className="kdone-arrow" aria-hidden="true">{open ? '˅' : '›'}</span>
      </button>
      {open && (
        <div className="kdone-list">
          {rows.map((row) => (
            row.clickable ? (
              <button
                key={row.mealId}
                type="button"
                className="kdone-row"
                aria-label={`${row.name} · ${MEAL_ROLE_LABEL[row.role]} · ${metaLine(row)}${row.scorePct != null ? ` · AI score ${row.scorePct}` : ''}`}
                onClick={() => onRowSelect(row.mealId)}
              >
                <RowBody row={row} />
              </button>
            ) : (
              <div key={row.mealId} className="kdone-row kdone-row-inert">
                <RowBody row={row} />
              </div>
            )
          ))}
        </div>
      )}
    </section>
  )
}
