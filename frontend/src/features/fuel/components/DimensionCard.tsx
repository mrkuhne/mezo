// ============================================================
// Mezo · DimensionCard (one weighted score dimension) — collapsible since Logolás 2.1
// (mezo-zeeq). Header (a button): 52px score ring + label + „súly W% → X pont" + the
// detail prose clamped to two lines; expanded: the full detail + the per-dimension
// visual panel (macro / micro / NOVA / rows). Collapsed by default so the sheet reads
// as a ledger first and a report second. Used by ScoreBreakdownBody (meal + recipe).
// ============================================================
import { useId, useState } from 'react'
import type { MealDimension } from '@/data/types'
import { hu1 } from '@/shared/lib/huNum'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { Icon } from '@/shared/ui/Icon'
import { MacroPanel } from '@/features/fuel/components/MacroPanel'
import { MicroPanel } from '@/features/fuel/components/MicroPanel'
import { NovaPanel } from '@/features/fuel/components/NovaPanel'
import { ContextPanel } from '@/features/fuel/components/ContextPanel'

const SIZE = 52
const STROKE = 5
const R = SIZE / 2 - STROKE
const C = 2 * Math.PI * R

export function DimensionCard({ dim, defaultOpen = false }: { dim: MealDimension; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const sub = Math.round(dim.score * 100)
  const contribution = hu1(dim.score * dim.weight * 100)

  return (
    <div className="sb-dim" style={{ '--c': dim.color } as React.CSSProperties}>
      <button type="button" className="sb-dim-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span className="sb-dim-ring">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <circle className="sb-dim-t" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
            <circle className="sb-dim-f" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE}
              strokeDasharray={C} strokeDashoffset={C - (sub / 100) * C} />
          </svg>
          <b>{sub}</b>
        </span>
        <span className="sb-dim-txt">
          <span className="sb-dim-lb"><i aria-hidden="true" />{dim.label}</span>
          <span className="sb-dim-w">súly <b>{Math.round(dim.weight * 100)}%</b> → <b>{contribution}</b> pont</span>
          {!open && <span className="sb-dim-one"><SafeMarkdown text={dim.detail} /></span>}
        </span>
        <span className="sb-dim-arr" aria-hidden="true">›</span>
      </button>
      {open && (
        <div id={id} className="sb-dim-body">
          <p><SafeMarkdown text={dim.detail} /></p>
          {dim.note && (
            <p className="dim-note" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 6 }}>
              <Icon name="sparkle" size={10} color="var(--lav-deep)" /> <SafeMarkdown text={dim.note} />
            </p>
          )}
          {/* A degraded dim (weight 0, mezo-jcpt.1) shares its `id` with its live sibling but
              carries none of the per-kind payload, so the panel choice below is guarded by the
              payload field itself (`in`), not just `id` — a degraded dim renders no panel at
              all (just the two paragraphs above), which is deliberately unstyled: Task 6 owns
              the "ghost tile" treatment for it. */}
          {dim.id === 'macro' && 'macroRatio' in dim && <MacroPanel dim={dim} />}
          {dim.id === 'micro' && 'micros' in dim && <MicroPanel dim={dim} />}
          {dim.id === 'nova' && 'nova' in dim && <NovaPanel dim={dim} />}
          {(dim.id === 'context' || dim.id === 'who' || dim.id === 'fat_quality'
            || dim.id === 'plant_diversity' || dim.id === 'energy_density' || dim.id === 'portion')
            && 'context' in dim && <ContextPanel dim={dim} />}
        </div>
      )}
    </div>
  )
}
