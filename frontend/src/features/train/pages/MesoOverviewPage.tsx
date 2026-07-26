// ============================================================
// Mezo · MesoOverviewPage — read-only full-screen mesocycle overview
// (Phase B, Task B5). Sibling route to MesocycleBuilderPage, reached from
// Gym/Mai entry chips (B6, not built here). Sticky breadcrumb (smart back
// via useBackNav, falls back to Gym), a status-aware progress header
// (statusEyebrow + title + goal + PhaseCurveBars lg + start/remaining/end
// meta), then the per-muscle VolumeArcChart behind a muscle switch. No
// actions/mutations — the builder (MesocycleBuilderPage) owns those.
// Mirrors MesocycleBuilderPage's shell + MesoVolume's planned/archived guard.
// ============================================================
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTrain, useMesocycleVolumeArc } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { MUSCLE_LABELS } from '@/data/train/train'
import { PhaseCurveBars } from '@/features/train/components/PhaseCurveBars'
import { VolumeArcChart } from '@/features/train/components/VolumeArcChart'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { CtaGhost } from '@/shared/ui/Cta'

export function MesoOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const goBack = useBackNav('/train/gym')
  const { mesocycles } = useTrain()
  const { arc, pending } = useMesocycleVolumeArc(id ?? null)
  const meso = mesocycles.find((m) => m.id === id)
  const [selected, setSelected] = useState<string | null>(null)

  if (!meso) {
    return (
      <div style={{ padding: '24px' }}>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Ez a mesociklus nem található.
        </p>
        <div className="mt-lg">
          <CtaGhost onClick={goBack}>← Gym</CtaGhost>
        </div>
      </div>
    )
  }

  const statusEyebrow =
    meso.status === 'active'
      ? `Aktív · Week ${meso.currentWeek}/${meso.weeks}`
      : meso.status === 'planned'
        ? 'Tervezett'
        : 'Archív'

  const weeksRemaining = Math.max(0, meso.weeks - meso.currentWeek)
  const muscles = arc?.muscles ?? []
  const activeMuscle = muscles.find((m) => m.muscle === selected) ?? muscles[0]

  return (
    // Inside AppLayout's .screen-content scroller — no nested wrapper (mirrors MesocycleBuilderPage).
    <div>
      {/* Breadcrumb — pinned below the status bar like native nav chrome */}
      <div className="sticky-top" style={{ padding: '8px 24px' }}>
        <button type="button" onClick={goBack} className="row gap-sm">
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>←</span>
          <span className="eyebrow">Vissza</span>
        </button>
      </div>
      {/* Header */}
      <div style={{ padding: '6px 24px 0' }}>
        <span className={meso.status === 'active' ? 'eyebrow brand' : 'eyebrow'}>{statusEyebrow}</span>
      </div>
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Mezociklus</div>
          <h1>{meso.title}</h1>
        </div>
      </div>
      <div style={{ padding: '6px 24px 4px' }}>
        <span className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
          {meso.goal}
        </span>
      </div>

      {/* Progress meta: phase-curve hero bars + start/remaining/end */}
      <div style={{ padding: '16px 24px 8px' }}>
        <PhaseCurveBars phases={meso.phaseCurve} currentWeek={meso.currentWeek} size="lg" status={meso.status} />
      </div>
      <div className="row gap-md" style={{ padding: '4px 24px 8px' }}>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          Kezdés {meso.startDate}
        </span>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          {weeksRemaining} hét hátra
        </span>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          Vége {meso.endDate}
        </span>
      </div>

      {/* Volume arc section */}
      {muscles.length === 0
        ? (!pending && (
            <div style={{ padding: '12px 24px' }}>
              <Eyebrow>Volumen-ív csak aktív mesocikluson érhető el.</Eyebrow>
            </div>
          ))
        : (
          <div className="col gap-md" style={{ padding: '12px 24px' }}>
            <div className="row gap-xs" style={{ overflowX: 'auto' }}>
              {muscles.map((m) => {
                const active = m.muscle === activeMuscle?.muscle
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
            {activeMuscle && <VolumeArcChart arc={activeMuscle} />}
          </div>
        )}
    </div>
  )
}
