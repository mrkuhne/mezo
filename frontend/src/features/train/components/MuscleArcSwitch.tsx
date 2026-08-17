// ============================================================
// Mezo · MuscleArcSwitch — the per-muscle pill row + the selected muscle's
// VolumeArcChart. Lifted verbatim out of MesoOverviewPage (Phase B, Task B5)
// when the run report (mezo-meyc.2) needed the same consumption for its FROZEN
// arc: two surfaces reading one arc shape must not drift apart.
// Presentational + local selection state only — the arc comes in as a prop, so
// it works the same for a live arc and a close-time snapshot. Callers own the
// "no arc at all" copy (it differs: "active runs only" vs "no report yet").
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import { VolumeArcChart } from '@/features/train/components/VolumeArcChart'
import type { MuscleVolumeArc } from '@/data/types'

export function MuscleArcSwitch({ muscles }: { muscles: MuscleVolumeArc[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const activeMuscle = muscles.find((m) => m.muscle === selected) ?? muscles[0]
  if (!activeMuscle) return null

  return (
    <div className="col gap-md" style={{ padding: '12px 24px' }}>
      <div className="row gap-xs" style={{ overflowX: 'auto' }}>
        {muscles.map((m) => {
          const active = m.muscle === activeMuscle.muscle
          return (
            <button
              key={m.muscle}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(m.muscle)}
              className="rad-12"
              style={{
                padding: '10px 14px',
                flexShrink: 0,
                background: active ? 'color-mix(in srgb, var(--coral) 8%, transparent)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'var(--line)' : 'var(--border-subtle)'}`,
                color: active ? 'var(--coral)' : 'var(--text-secondary)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {MUSCLE_LABELS[m.muscle] ?? m.muscle}
            </button>
          )
        })}
      </div>
      <VolumeArcChart arc={activeMuscle} />
    </div>
  )
}
