// ============================================================
// Mezo · MesocycleBuilderPage — full-screen takeover for a single mesocycle
// (sibling route /train/mesocycles/:id, NO sub-nav). Own back-button header
// (← Mesociklusok), status-aware eyebrow, title + goal, a 3-button view
// switcher (Áttekintés | Volumen | Gyakorlatok) and status-dependent bottom
// actions. This task ships the shell + the Áttekintés view + DayDetailSheet;
// Volumen and Gyakorlatok are placeholders filled by Task 9 / Task 10.
// Ported from prototype mesocycles.jsx MesocycleBuilderPage.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { MesoOverview } from '@/features/train/components/MesoOverview'
import { MesoVolume } from '@/features/train/components/MesoVolume'
import { MesoExercises } from '@/features/train/components/MesoExercises'

type BuilderView = 'overview' | 'volume' | 'exercises'

const VIEWS: { id: BuilderView; label: string }[] = [
  { id: 'overview', label: 'Áttekintés' },
  { id: 'volume', label: 'Volumen' },
  { id: 'exercises', label: 'Gyakorlatok' },
]

export function MesocycleBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mesocycles, activateMesocycle, closeMesocycle, mesoMutationPending } = useTrain()
  const [view, setView] = useState<BuilderView>('overview')

  const meso = mesocycles.find((m) => m.id === id)
  const backToLibrary = () => navigate('/train/mesocycles')

  if (!meso) {
    return (
      <div style={{ padding: '24px' }}>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Ez a mesociklus nem található.
        </p>
        <div className="mt-lg">
          <CtaGhost className="notch-4" onClick={backToLibrary}>
            ← Mesociklusok
          </CtaGhost>
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

  return (
    // Inside AppLayout's .screen-content scroller — no nested wrapper (mezo-wdk).
    <div>
      {/* Breadcrumb — pinned below the status bar like native nav chrome */}
      <div className="sticky-top" style={{ padding: '8px 24px' }}>
        <button type="button" onClick={backToLibrary} className="row gap-sm">
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>←</span>
          <span className="eyebrow">Mesociklusok</span>
        </button>
      </div>
      {/* Header */}
      <div style={{ padding: '6px 24px 0' }}>
        <span className={meso.status === 'active' ? 'eyebrow brand' : 'eyebrow'}>{statusEyebrow}</span>
      </div>
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Mesociklusok</div>
          <h1>{meso.title}</h1>
        </div>
      </div>
      <div style={{ padding: '4px 24px 4px' }}>
        <span className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
          {meso.goal}
        </span>
      </div>

      {/* View switcher */}
      <div className="row gap-xs" style={{ padding: '16px 24px 8px' }}>
        {VIEWS.map((v) => {
          const active = view === v.id
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={active}
              onClick={() => setView(v.id)}
              className="flex-1 notch-4"
              style={{
                padding: '10px',
                background: active ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
                color: active ? 'var(--brand-glow)' : 'var(--text-secondary)',
                fontFamily: 'var(--ff-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>

      {view === 'overview' && <MesoOverview meso={meso} onEditDay={() => setView('exercises')} />}
      {view === 'volume' && <MesoVolume meso={meso} />}
      {view === 'exercises' && <MesoExercises meso={meso} />}

      {/* Actions */}
      <div style={{ padding: '16px 24px 32px' }}>
        {meso.status === 'active' && (
          <div className="col gap-sm">
            {/* "Heti terv másolása" stays inert — out of T1 scope (copy-week lands later). */}
            <CtaGhost className="notch-4" style={{ padding: 12 }}>
              Heti terv másolása
            </CtaGhost>
            <CtaGhost
              className="notch-4"
              style={{ padding: 12, borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)' }}
              onClick={() => closeMesocycle(meso.id)}
              disabled={mesoMutationPending}
            >
              Meso lezárása
            </CtaGhost>
          </div>
        )}
        {meso.status === 'planned' && (
          <CtaPrimary
            className="notch-8"
            onClick={() => activateMesocycle(meso.id)}
            disabled={mesoMutationPending}
          >
            <Icon name="check" size={16} /> Aktiválás · {meso.startDate}
          </CtaPrimary>
        )}
      </div>
    </div>
  )
}
