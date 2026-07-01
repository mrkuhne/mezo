// ============================================================
// Mezo · MesocycleLibraryView (Mesociklusok) — the mesocycle library:
// active hero card + planned cards (with a "plan new" CTA) + archived cards.
// Thin TrainScreen shell ⇒ this view owns its own .page-header, whose `+ Új`
// chip and the planned CTA navigate to the planner; every card navigates to
// its builder. Ported from prototype mesocycles.jsx MesocycleLibrary.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { ActiveMesoCard } from '@/features/train/components/ActiveMesoCard'
import { PlannedMesoCard } from '@/features/train/components/PlannedMesoCard'
import { ArchivedMesoCard } from '@/features/train/components/ArchivedMesoCard'
import MesocycleSkeleton from '@/features/train/views/MesocycleSkeleton'

export function MesocycleLibraryView() {
  const { mesocycles, workoutPending } = useTrain()
  const navigate = useNavigate()

  // Real-mode loading: show the layout-aware skeleton until the meso list resolves.
  // `mesocycles` comes from the meso query that drives workoutPending, so branch on it
  // before the T0 empty-state. After all hooks. Mock seeds synchronously → no skeleton.
  if (workoutPending) return <MesocycleSkeleton />

  const active = mesocycles.filter((m) => m.status === 'active')
  const planned = mesocycles.filter((m) => m.status === 'planned')
  const archived = mesocycles.filter((m) => m.status === 'archived')

  const openBuilder = (id: string) => navigate(`/train/mesocycles/${id}`)
  const openPlanner = () => navigate('/train/mesocycles/new')

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Train · Mesocycles</Eyebrow>
          <PageTitle>Mesociklusok</PageTitle>
        </div>
        <button type="button" className="chip notch-4" style={{ padding: '8px 10px' }} onClick={openPlanner}>
          <Icon name="plus" size={12} /> Új
        </button>
      </div>

      {/* T0 clean slate: brand-new library gets a short orientation hint; the
          planned section's dashed CTA below stays the single creation action. */}
      {mesocycles.length === 0 && (
        <div style={{ padding: '8px 24px 0' }}>
          <GhostState lines={2} message="Még nincs mesociklusod — itt fognak élni a blokkjaid." />
        </div>
      )}

      {/* Active */}
      <div style={{ padding: '8px 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Aktív · {active.length}</Eyebrow>
          {active[0] ? (
            <Eyebrow brand>
              Hét {active[0].currentWeek}/{active[0].weeks}
            </Eyebrow>
          ) : null}
        </div>
        {active.map((m) => (
          <ActiveMesoCard key={m.id} meso={m} onOpen={() => openBuilder(m.id)} />
        ))}
      </div>

      {/* Planned */}
      <div style={{ padding: '8px 24px 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Tervezett · {planned.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {planned.map((m) => (
            <PlannedMesoCard key={m.id} meso={m} onOpen={() => openBuilder(m.id)} />
          ))}
          <button
            type="button"
            onClick={openPlanner}
            className="card notch-4"
            style={{
              padding: 16,
              textAlign: 'center',
              background: 'transparent',
              borderStyle: 'dashed',
              color: 'var(--brand-glow)',
              fontFamily: 'var(--ff-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            + Új mesociklus tervezése
          </button>
        </div>
      </div>

      {/* Archived */}
      <div style={{ padding: '8px 24px 24px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Archív · {archived.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {archived.map((m) => (
            <ArchivedMesoCard key={m.id} meso={m} onOpen={() => openBuilder(m.id)} />
          ))}
        </div>
      </div>
    </>
  )
}
