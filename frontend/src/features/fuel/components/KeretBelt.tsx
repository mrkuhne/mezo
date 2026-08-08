// ============================================================
// Mezo · KeretBelt — the always-visible daily-budget belt + its
// kibontott ("keret felépülése") bigview (mezo-jgh9, Fuel window-river
// Task 3). Embeds into the shared `Island` shell (`belt`, `tone="keret"`,
// `nowRing=false`): the belt's collapsed row is richer than the generic
// capsule (remaining kcal + 3 macro mini-bars), so it rides in via
// `Island`'s `beltContent` override rather than the standard
// emoji/title/essence/count capsule. The big view mirrors Today's
// IslandMorning idiom (hero-number in the shared `.isl-hero-*` role,
// eaten/remaining bar, energy-breakdown rows, full macro bars, then the
// water + ad-hoc-log rows on the ItemRow idiom).
// Design: docs/superpowers/specs/2026-08-08-fuel-window-river-design.md §4.
// ============================================================
import { Island } from '@/shared/ui/Island'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { DayBudget, Macro4 } from '@/features/fuel/logic/buildDayPlan'

export interface KeretBeltProps {
  big: boolean
  budget: DayBudget
  consumed: { kcal: number; p: number; c: number; f: number }
  water: { currentMl: number; targetMl: number; onAdd250: () => void } | null
  /** "Pull A + lépések" | "lépések" — the movement row's own label. */
  activityLabel: string
  /** Quiet informational footer line (Fraunces meta-voice, `.text-meta-sm`) — e.g. the kitchen
   *  close / caffeine cutoff reference the Mai sky has no other row for. Omitted when absent. */
  note?: string
  /** Opens FuelSettingsSheet — renders a quiet trailing "szerkeszt ›" ghost button on the note
   *  row (Today's `.isl-grouph-go` idiom). Settings stay reachable even when `note` is absent
   *  (the button then renders alone on the row). Omitted entirely when this prop is absent. */
  onEditSettings?: () => void
  onSelect: () => void
  /** Opens an empty LogMealSheet — a plan-independent ad-hoc log. */
  onAdHocLog: () => void
}

// HU thousands, regular space. NOT `toLocaleString('hu-HU')` (the repo's usual pattern elsewhere,
// e.g. GrowthSummaryCard/medalLabels) — that groups from 5 digits up only (real HU typographic
// convention: `1890`/`2400` render ungrouped), but the design mockup + brief spell out "1 160"/
// "2 400" for exactly these 4-digit kcal values, so a manual grouper matches the spec verbatim.
// Unicode minus (U+2212), not the ASCII hyphen — the ONE negative glyph used everywhere in this
// file (fmt for a raw negative value, signed() for the explicitly-signed energy rows).
const MINUS = '−'
const fmt = (n: number) => {
  const neg = n < 0
  const grouped = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return neg ? `${MINUS}${grouped}` : grouped
}
const signed = (n: number) => `${n < 0 ? MINUS : '+'} ${fmt(Math.abs(n))}`
const fmtL = (ml: number) => (ml / 1000).toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pct = (have: number, target: number) => (target > 0 ? Math.min(100, Math.max(0, Math.round((have / target) * 100))) : 0)

// ── HU dative suffix (-hoz/-hez/-höz) — vowel harmony of the target number's LAST SPOKEN word,
// not a digit shortcut: Hungarian numbers are read as a chain of words (e.g. 160 = "száz-hatvan",
// 250 = "kétszáz-ötven", 75 = "hetven-öt") and harmony follows the LAST word's own vowels, which
// can differ from a same-root word at another magnitude (öt → höz, but ötven → hez). So: the
// lowest-magnitude nonzero digit group (units, else tens, else hundreds, else thousands) picks
// the suffix off its own spoken word's harmony class.
export type HuDative = 'hoz' | 'hez' | 'höz'
const UNIT_DATIVE: Record<number, HuDative> = {
  1: 'hez', 2: 'höz', 3: 'hoz', 4: 'hez', 5: 'höz', 6: 'hoz', 7: 'hez', 8: 'hoz', 9: 'hez',
} // egy·kettő·három·négy·öt·hat·hét·nyolc·kilenc
const TEN_DATIVE: Record<number, HuDative> = {
  1: 'hez', 2: 'hoz', 3: 'hoz', 4: 'hez', 5: 'hez', 6: 'hoz', 7: 'hez', 8: 'hoz', 9: 'hez',
} // tíz·húsz·harminc·negyven·ötven·hatvan·hetven·nyolcvan·kilencven
export function huDative(n: number): HuDative {
  const v = Math.round(Math.abs(n))
  if (v === 0) return 'hoz' // nullához
  const units = v % 10
  if (units !== 0) return UNIT_DATIVE[units]
  const tens = Math.floor(v / 10) % 10
  if (tens !== 0) return TEN_DATIVE[tens]
  const hundreds = Math.floor(v / 100) % 10
  if (hundreds !== 0) return 'hoz' // száz
  return 'hez' // ezer (an exact multiple of 1000)
}

type MacroKey = keyof Macro4 & ('p' | 'c' | 'f')
const MACROS: { key: MacroKey; label: string; short: string; cssVar: string }[] = [
  { key: 'p', label: 'Fehérje', short: 'P', cssVar: '--macro-protein' },
  { key: 'c', label: 'Szénhidrát', short: 'C', cssVar: '--macro-carbs' },
  { key: 'f', label: 'Zsír', short: 'F', cssVar: '--macro-fat' },
]

export function KeretBelt({
  big, budget, consumed, water, activityLabel, note, onEditSettings, onSelect, onAdHocLog,
}: KeretBeltProps) {
  const remaining = budget.kcal - consumed.kcal

  const beltContent = (
    <>
      <div className="kbelt-kv">
        <div className="kbelt-v">
          {fmt(remaining)}
          <span className="kbelt-vu"> kcal</span>
        </div>
        <div className="kbelt-l">Maradt</div>
      </div>
      <div className="kbelt-bars">
        {MACROS.map(m => {
          const have = consumed[m.key]
          const target = budget[m.key]
          return (
            <div key={m.key} className="kbelt-bar">
              <div
                className="kbelt-bar-track"
                role="progressbar"
                aria-label={`${m.label} ${fmt(have)}/${fmt(target)} g`}
                aria-valuenow={have}
                aria-valuemin={0}
                aria-valuemax={target}
              >
                <i style={{ width: `${pct(have, target)}%`, background: `var(${m.cssVar})` }} />
              </div>
              <div className="kbelt-bar-t">
                {m.short} {fmt(have)}/{fmt(target)}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )

  const eatenPct = pct(consumed.kcal, budget.kcal)

  return (
    <Island
      tone="keret"
      big={big}
      nowRing={false}
      belt
      beltContent={beltContent}
      capsule={{ emoji: '📊', title: 'Keret', essence: '', count: '' }}
      ariaLabel={`Napi keret megnyitása · ${fmt(remaining)} kcal maradt`}
      onSelect={onSelect}
    >
      <div className="isl-hero-v">
        {fmt(remaining)}
        <span className="isl-hero-u">kcal maradt</span>
      </div>
      <div className="isl-hero-sub">a {fmt(budget.kcal)}-as keretedből</div>

      <div className="kbelt-stackbar">
        <i className="kbelt-eaten" style={{ width: `${eatenPct}%` }} />
        <i className="kbelt-left" style={{ width: `${100 - eatenPct}%` }} />
      </div>
      <div className="kbelt-stackcap">
        <span>EDDIG {fmt(consumed.kcal)}</span>
        <span>MARADT {fmt(remaining)}</span>
      </div>

      <div className="kbelt-bd">
        <div className="kbelt-bdrow">
          <span className="kbelt-ic" aria-hidden="true">🔥</span>
          <span className="kbelt-bdlabel">Alapanyagcsere</span>
          <span className="kbelt-val">{fmt(budget.energy.base)}</span>
        </div>
        <div className="kbelt-bdrow">
          <span className="kbelt-ic" aria-hidden="true">🏋️</span>
          <span className="kbelt-bdlabel">Mozgás ma · {activityLabel}</span>
          <span className="kbelt-val">{signed(budget.energy.activity)}</span>
        </div>
        <div className="kbelt-bdrow">
          <span className="kbelt-ic" aria-hidden="true">🎯</span>
          <span className="kbelt-bdlabel">Cél-deficit</span>
          <span className="kbelt-val">{signed(budget.energy.balance)}</span>
        </div>
        <div className="kbelt-bdsep" />
        <div className="kbelt-bdrow kbelt-bdrow-total">
          <span className="kbelt-ic" aria-hidden="true">⚖️</span>
          <span className="kbelt-bdlabel">Mai keret</span>
          <span className="kbelt-val">{fmt(budget.energy.target)} kcal</span>
        </div>
      </div>

      <div className="kbelt-macrofull">
        {MACROS.map(m => {
          const have = consumed[m.key]
          const target = budget[m.key]
          const remain = Math.max(0, target - have)
          return (
            <div key={m.key} className="kbelt-mf">
              <div className="kbelt-mf-head">
                <span>{m.label} · {fmt(have)} g</span>
                <span className="kbelt-mf-rem">még {fmt(remain)} g a {fmt(target)}-{huDative(target)}</span>
              </div>
              <div className="kbelt-mf-bar">
                <i style={{ width: `${pct(have, target)}%`, background: `var(${m.cssVar})` }} />
              </div>
            </div>
          )
        })}
      </div>

      {water && (
        <ItemRow
          tone="fuel"
          emoji="💧"
          title="Víz"
          subtitle={`${fmtL(water.currentMl)} / ${fmtL(water.targetMl)} l`}
          actionLabel="+250 ml"
          onAction={water.onAdd250}
        />
      )}
      <ItemRow
        tone="fuel"
        emoji="➕"
        title="Log bármikor"
        ariaLabel="Log bármikor"
        onAction={onAdHocLog}
      />
      {(note || onEditSettings) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '10px 2px 0' }}>
          {note && <p className="text-meta-sm text-tertiary" style={{ margin: 0 }}>{note}</p>}
          {onEditSettings && (
            <button
              type="button"
              className="isl-grouph-go"
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              onClick={onEditSettings}
            >
              szerkeszt ›
            </button>
          )}
        </div>
      )}
    </Island>
  )
}
