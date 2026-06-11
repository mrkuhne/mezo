// ============================================================
// Mezo · MesocycleBuilder — full-screen takeover for a single mesocycle
// (sibling route /train/mesocycles/:id, NO sub-nav). Own back-button header
// (← Mesociklusok), status-aware eyebrow, title + goal, a 3-button view
// switcher (Áttekintés | Volumen | Gyakorlatok) and status-dependent bottom
// actions. This task ships the shell + the Áttekintés view + DayDetailSheet;
// Volumen and Gyakorlatok are placeholders filled by Task 9 / Task 10.
// Ported from prototype mesocycles.jsx MesocycleBuilder.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import { MesoOverview } from './components/MesoOverview'
import { MesoVolume } from './components/MesoVolume'
import { MesoExercises } from './components/MesoExercises'

type BuilderView = 'overview' | 'volume' | 'exercises'

const VIEWS: { id: BuilderView; label: string }[] = [
  { id: 'overview', label: 'Áttekintés' },
  { id: 'volume', label: 'Volumen' },
  { id: 'exercises', label: 'Gyakorlatok' },
]

export function MesocycleBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mesocycles, activateMesocycle, closeMesocycle, mesoMutationPending } = useTrain()
  const [view, setView] = useState<BuilderView>('overview')

  const meso = mesocycles.find((m) => m.id === id)
  const backToLibrary = () => navigate('/train/mesocycles')

  if (!meso) {
    return (
      <div className="screen-content" style={{ padding: '24px' }}>
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
    <div className="screen-content">
      {/* Header */}
      <div style={{ padding: '12px 24px 4px' }}>
        <button type="button" onClick={backToLibrary} className="row gap-sm" style={{ marginBottom: 14 }}>
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>←</span>
          <span className="eyebrow">Mesociklusok</span>
        </button>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col flex-1">
            <span className={meso.status === 'active' ? 'eyebrow brand' : 'eyebrow'}>{statusEyebrow}</span>
            <PageTitle className="mt-sm">{meso.title}</PageTitle>
            <span className="text-secondary mt-sm" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {meso.goal}
            </span>
          </div>
        </div>
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
