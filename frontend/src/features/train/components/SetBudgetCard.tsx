// ============================================================
// Mezo · SetBudgetCard — collapsible weekly per-muscle set-budget card for
// the unified meso day editor (mezo-7rdg, spec 2026-08-01-set-budget-
// unified-editor, composite-v2 mockup; pill/rows reframed against each
// group's own tier target mezo-3m5m, spec GD5). Collapsed: a pill wrap, one
// per muscle group, colored by budget level — non-Grow tiers name
// themselves (`Hát · Emphasize · 84%`), target-less groups (traps/core)
// show a plain set count (`Trapéz · 3 szett`). Expanded: one row per group
// with a rail + progress bar scaled to the tier target, plus warning lines
// for over-target groups and single-session cap breaches
// (sessionCapWarnings), and a discreet direct-only counting footnote
// (ADR 0021).
// ============================================================
import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { ZoneTrack } from '@/features/train/components/ZoneTrack'
import type { MuscleBudgetRow, SessionCapWarning } from '@/features/train/logic/setBudget'
import { TIER_LABELS } from '@/features/train/logic/musclePriorities'
import type { MuscleTier } from '@/data/types'

interface SetBudgetCardProps {
  budgets: MuscleBudgetRow[]
  capWarnings: SessionCapWarning[]
  defaultOpen?: boolean
}

function pct(budget: number): number {
  return Math.round(budget * 100)
}

// The landmark a tier's target IS — names the ceiling in the over-warning ("Emphasize plafon 22 (MRV)").
const TIER_LANDMARK_ABBR: Record<MuscleTier, string> = { maintain: 'MEV', grow: 'MAV', emphasize: 'MRV' }

// Collapsed pill body (AD1): `Hát · Emphasize · 84%` for non-Grow, compact `Mell 84%` for Grow,
// `Trapéz · 3 szett` when the group carries no landmark (traps/core), `↓` prefix kept for under.
function pillText(row: MuscleBudgetRow): string {
  const tierSuffix = row.tier !== 'grow' ? ` · ${TIER_LABELS[row.tier]}` : ''
  if (row.budget === null) return `${row.label}${tierSuffix} · ${row.workingSets} szett`
  const dot = row.tier !== 'grow' ? '· ' : ''
  const arrow = row.level === 'under' ? '↓' : ''
  return `${row.label}${tierSuffix} ${dot}${arrow}${pct(row.budget)}%`
}

// "8🔥+8🌿" — omit whichever side is zero.
function setStyleSummary(failureSets: number, volumeSets: number): string {
  if (failureSets > 0 && volumeSets > 0) return `${failureSets}🔥+${volumeSets}🌿`
  if (failureSets > 0) return `${failureSets}🔥`
  return `${volumeSets}🌿`
}

function pillColors(row: MuscleBudgetRow): { bg: string; fg: string; border?: string } {
  if (row.level === 'over') return { bg: 'color-mix(in srgb, var(--error) 12%, transparent)', fg: 'var(--error)' }
  if (row.level === 'near') return { bg: 'var(--wash-amber)', fg: 'var(--amber-deep)' }
  if (row.level === 'under') return { bg: 'var(--surface-2)', fg: 'var(--text-tertiary)', border: '1.5px dashed var(--text-tertiary)' }
  const fam = muscleColor(row.colorMuscle)
  return { bg: fam.wash, fg: fam.deep }
}

export function SetBudgetCard({ budgets, capWarnings, defaultOpen }: SetBudgetCardProps) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const overBudgets = budgets.filter((b) => b.level === 'over')
  const underRows = budgets.filter((b) => b.level === 'under')

  return (
    <div className="card" style={{ padding: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="row"
        style={{
          width: '100%', justifyContent: 'space-between', alignItems: 'center',
          background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0,
        }}
      >
        <Eyebrow brand>Heti szet-büdzsé</Eyebrow>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
      </button>

      {!open && (
        <div className="row gap-xs flex-wrap" style={{ marginTop: 12 }}>
          {budgets.map((row) => {
            const colors = pillColors(row)
            return (
              <span
                key={row.group}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  background: colors.bg, color: colors.fg,
                  ...(colors.border ? { border: colors.border } : {}),
                }}
              >
                {pillText(row)}
              </span>
            )
          })}
        </div>
      )}

      {open && (
        <div className="col" style={{ gap: 12, marginTop: 14 }}>
          {budgets.map((row) => {
            const fam = muscleColor(row.colorMuscle)
            const setsLabel = row.target !== null
              ? `${row.workingSets}/${row.target} szett (${pct(row.budget ?? 0)}%)`
              : `${row.workingSets} szett`
            return (
              <div key={row.group} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 5, height: 34, borderRadius: 2, background: fam.rail, flexShrink: 0 }} />
                <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{row.label}</span>
                    <span className="label-mono" style={{ fontSize: 10.5 }}>
                      {setsLabel} · {setStyleSummary(row.failureSets, row.volumeSets)}
                      {row.exemptSets > 0 && <span style={{ color: 'var(--text-tertiary)' }}> +{row.exemptSets} kiegészítő</span>}
                    </span>
                  </div>
                  <ZoneTrack
                    zoneStart={row.zoneStart}
                    segments={[{ pct: Math.min(1, row.budget ?? 0), kind: row.level === 'over' ? 'overflow' : 'solid' }]}
                    color={row.level === 'under'
                      ? { rail: 'var(--text-tertiary)', deep: 'var(--text-tertiary)' }
                      : { rail: fam.rail, deep: fam.deep }}
                    zoneTestId={`zone-${row.group}`}
                  />
                  {row.level === 'under' ? (
                    <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>↓ MEV alatt — még +{row.setsToZone} szett a zónáig</span>
                  ) : row.zoneStart !== null && row.level !== 'over' ? (
                    <span style={{ fontSize: 10.5, color: 'var(--sage-deep)' }}>✓ optimális zónában</span>
                  ) : null}
                </div>
              </div>
            )
          })}

          {overBudgets.length > 0 || capWarnings.length > 0 || underRows.length > 0 ? (
            <div className="col" style={{ gap: 8 }}>
              {overBudgets.map((row) => (
                <div
                  key={row.group}
                  style={{
                    borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.4,
                    background: 'color-mix(in srgb, var(--error) 8%, transparent)', color: 'var(--error)',
                  }}
                >
                  ⚠ <strong>
                    {row.label}: {row.workingSets} szett — {TIER_LABELS[row.tier]} plafon {row.target} ({TIER_LANDMARK_ABBR[row.tier]}).
                  </strong> A plafon fölött a plusz szettek már alig hoznak növekedést.
                </div>
              ))}
              {capWarnings.map((warning, i) => (
                <div
                  key={`${warning.day}-${warning.group}-${i}`}
                  style={{
                    borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.4,
                    background: 'var(--wash-amber)', color: 'var(--amber-deep)',
                  }}
                >
                  ⚠ <strong>{warning.label}: {warning.sets} szett egy edzésen ({warning.day}).</strong> 11 fölött nincs kimutatható plusz — oszd el két napra!
                </div>
              ))}
              {underRows.map((row) => (
                <div
                  key={`under-${row.group}`}
                  style={{
                    borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.45,
                    background: 'var(--surface-2)', color: 'var(--text-secondary)',
                  }}
                >
                  ↓ <strong>{row.label}: {row.workingSets} szett — a minimum-hatásos mennyiség (MEV ≈ {row.mev}) alatt.</strong>{' '}
                  Ennyi inkább csak szinten tart; +{row.setsToZone} szett már növekedést hozna{row.suggestedDay ? ` (pl. ${row.suggestedDay})` : ''}.
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            Csak a fő izom szettjei számítanak — a szinergista munka (pl. fekvenyomás → tricepsz) nem.
            A % az izom saját heti céljéhoz viszonyít (Maintain → MEV, Grow → MAV, Emphasize → MRV).
          </div>
        </div>
      )}
    </div>
  )
}
