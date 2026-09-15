// ============================================================
// Mezo · MesocycleLibraryPage (Mezociklus hub, mezo-d20.3.6) — Mozaik re-face.
// Train Titanium T9 Task 2 (mezo-88iwa.10): the library's real navigation —
// Sablonok/Új blokk/Futóblokkok tiles, the Tervezett list, the Történet
// section with the Összevetés selection mode — moved intact to
// `MesoKonyvtarPage` behind the `Edzéstervek` doorway below, so nothing loses
// its entry (the T4 reachability lesson). This page keeps only the active-run
// hero (unchanged `ActiveMesoCard`) and the `Heti vizsgálat` tile, which stays
// active-meso-gated and reachable from here until Task 3 turns it into a
// poster with its own dest tiles.
// Ported from prototype mesocycles.jsx MesocycleLibrary.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { ActiveMesoCard } from '@/features/train/components/ActiveMesoCard'
import { runBands } from '@/features/train/logic/mesoBands'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import MesocycleSkeleton from '@/features/train/pages/MesocycleSkeleton'

export function MesocycleLibraryPage() {
  const { mesocycles, workoutPending } = useTrain()
  const navigate = useNavigate()

  // Real-mode loading: show the layout-aware skeleton until the meso list resolves.
  // Mock seeds synchronously → no skeleton.
  if (workoutPending) return <MesocycleSkeleton />

  const active = mesocycles.filter((m) => m.status === 'active')

  const openBuilder = (id: string) => navigate(`/train/mesocycles/${id}`)
  const openPlanner = () => navigate('/train/mesocycles/new')
  // The hub's first tile (mesocycle pages v2 Task 2, mezo-d20.15).
  const openWeek = (id: string) => navigate(`/train/mesocycles/${id}/week`)
  const openKonyvtar = () => navigate('/train/mesocycles/konyvtar')

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Edzés · Mesociklusok</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>Mesociklusok</PageTitle>
        </div>
        <button type="button" onClick={openPlanner} className="pgact">
          <Icon name="plus" size={14} /> Új
        </button>
      </div>

      {/* T0 clean slate: brand-new library gets a short orientation hint; the header's
          `+ Új` chip stays the creation action (the planner saves a template). */}
      {mesocycles.length === 0 && (
        <div style={{ padding: '8px 24px 0' }}>
          <GhostState lines={2} message="Még nincs mesociklusod — itt fognak élni a blokkjaid." />
        </div>
      )}

      <EntranceGroup>
        {/* `Heti vizsgálat` — active-meso-gated, stays reachable from the landing
            (Task 3 turns it into a poster dest tile). */}
        {active[0] && (
          <div style={{ padding: '8px 24px 16px' }} data-kalauz-anchor="mesociklus-mosaic">
            <Mosaic>
              <Tile
                wash="coral"
                icon="i-heti"
                eyebrow="Heti vizsgálat"
                line={`W${active[0].currentWeek} · ${runBands(active[0]).reduce((s, r) => s + r.current, 0)} szett`}
                delayMs={40}
                onClick={() => openWeek(active[0].id)}
              />
            </Mosaic>
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

        {/* Edzéstervek doorway — Task 2's temporary quiet entry to the library,
            which moved to MesoKonyvtarPage. Task 3 replaces this page's whole face. */}
        <div style={{ padding: '8px 24px 24px' }}>
          <button type="button" className="pgact" onClick={openKonyvtar}>
            Edzéstervek
          </button>
        </div>
      </EntranceGroup>
    </>
  )
}
