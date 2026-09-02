// ============================================================
// Mezo · MesoMusclePage — „izom-részlet", reached from a MesoWeekPage tile
// tap (mesocycle pages v2, mezo-d20.15 Task 4). Absorbs the retired
// MesoOverviewPage's provenance view: the hero + band + block-arc + „hol
// dolgozik" + DerivationSteps + „Előző blokk" anatomy of the prototype's
// #page-muscle (meso-body.html, px ×1.18). Tone follows the muscle's own
// region (arc.muscles[].region), not a fixed page tone.
// ============================================================
import { useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { muscleTiles, previousBlock, whereItWorks } from '@/features/train/logic/mesoWeek'
import { regionColor, type RegionKey } from '@/features/train/logic/muscleColors'
import { VolumeBand } from '@/features/train/components/VolumeBand'
import { DerivationSteps } from '@/features/train/components/DerivationSteps'

// Arc regions (coral/sky/lav/rose/sage/amber) → Mozaik page tone — amber (Core)
// has no tone of its own, so it reads as gold (the closest neutral-warm family).
const REGION_TONE: Record<string, PageTone> = {
  coral: 'coral', sky: 'sky', lav: 'lav', rose: 'rose', sage: 'sage', amber: 'gold',
}

function MuscleSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…" style={{ padding: '12px 24px' }}>
      <Skeleton width={100} height={12} />
      <Skeleton width={140} height={40} style={{ marginTop: 10 }} />
      <div className="col gap-sm mt-lg">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="card" height={80} />)}
      </div>
    </div>
  )
}

export function MesoMusclePage() {
  const { id, muscle } = useParams<{ id: string; muscle: string }>()
  const goBack = useBackNav(`/train/mesocycles/${id}/week`)
  const { mesocycles, workoutPending } = useTrain()
  const { arc, pending: arcPending } = useMesocycleVolumeArc(id ?? null)

  const meso = mesocycles.find((m) => m.id === id)

  if (workoutPending || arcPending) return <MuscleSkeleton />

  if (!meso || !arc) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ Heti vizsgálat" />
        <PageBody>
          <GhostState message={meso ? 'A heti vizsgálat a blokk első edzése után jelenik meg.' : 'Ez a mesociklus nem található.'} />
        </PageBody>
      </MozaikPage>
    )
  }

  const tile = muscleTiles(arc, meso).find((t) => t.group === muscle)
  const profile = meso.volumePerMuscle?.[muscle ?? '']

  if (!tile || !profile) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ Heti vizsgálat" />
        <PageBody>
          <GhostState message="Ez az izom nincs a heti vizsgálatban." />
        </PageBody>
      </MozaikPage>
    )
  }

  const tone = REGION_TONE[tile.region] ?? 'coral'
  const fam = regionColor(tile.region as RegionKey)
  const rows = whereItWorks(meso, tile.group)
  const freq = rows.length
  const archived = mesocycles.filter((m) => m.status === 'archived')
  const prev = previousBlock(archived, tile.group)
  const hold = tile.statusTone !== 'sage'
  const weekOneValue = tile.series[0]?.planned ?? tile.mev
  const seriesToNow = tile.series.filter((s) => s.week <= arc.currentWeek)

  return (
    <MozaikPage tone={tone}>
      <PageHead onBack={goBack} label="‹ Heti vizsgálat" />
      <EntranceGroup>
        <PageHero
          icon="i-meso"
          big={tile.tier === 'maintain' ? tile.current : `${tile.current} → ${tile.ceiling}`}
          name={`${tile.label} · ${{ emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' }[tile.tier]} · ${tile.tier === 'maintain' ? 'MV-n tart' : `MEV${tile.tier === 'emphasize' ? '+2' : ''} → ${tile.tier === 'emphasize' ? 'MRV' : 'MAV'}`}`}
          sub={`${arc.currentWeek}. hét · ${freq}×/hét · ${hold ? 'most tartás' : '+2 e héten'}`}
        />
        <PageBody principle="A baseline sosem íródik felül — a Felülír csak egy újabb réteg rá. Piros itt sincs: a tartás döntés, nem hiba.">
          <div className="rise" style={{ marginBottom: 10 }}>
            <StatStrip>
              <StatCell value={tile.current} label="szett · most" />
              <StatCell value={tile.tier === 'maintain' ? '—' : tile.ceiling} label="plafon" />
              <StatCell value={tile.tier === 'maintain' ? '=' : hold ? '=' : '+2'} label="e héten" />
              <StatCell value={`${freq}×`} label="/ hét" />
            </StatStrip>
          </div>

          {tile.tier !== 'maintain' && (
            <div className="card rise" style={{ padding: '10px 12px', marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mz-eyebrow">A sáv · hol tartasz</span>
                <span className="mz-mut" style={{ fontSize: 8.5 }}>halvány = múlt hét · izzó = most</span>
              </div>
              <VolumeBand mev={tile.mev} mav={tile.mav} mrv={tile.mrv} prev={tile.prev} current={tile.current} color={fam.deep} height={14} />
            </div>
          )}

          <div className="card rise" style={{ padding: '10px 12px', marginBottom: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mz-eyebrow">A blokk íve · W1 → deload</span>
              <span className="mz-mut" style={{ fontSize: 8.5 }}>{tile.series.map((s) => s.planned).join(' · ')}</span>
            </div>
            <div className="mz-wspark" style={{ height: 40 }}>
              {tile.series.map((s) => (
                <b
                  key={s.week}
                  className={s.deload ? 'mz-wspark-dl' : !s.isCurrent && s.week > arc.currentWeek ? 'mz-wspark-fut' : undefined}
                  style={{
                    height: `${Math.max(12, Math.round((s.planned / tile.mrv) * 100))}%`,
                    background: s.isCurrent ? 'var(--mz-gold-bar)' : fam.deep,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mz-coach rise" style={{ margin: '0 0 10px' }}>
            <span className="dot" aria-hidden="true" />
            <span>
              {tile.tier === 'maintain'
                ? `Maintain: ${tile.mev} szett tartja, amit felépítettél — nem rámpázik, a deloadon sem csökken.`
                : tile.status.startsWith('=')
                  ? `A múlt héten grindeltél (RIR-rés a tervhez képest), ezért most tartjuk a ${tile.current}-et. Ha e héten visszaáll a tempó, hétfőn +2.`
                  : hold
                    ? 'Plafonon vagy — innen már a csúcshét és a deload jön.'
                    : `Produktív hét volt, hétfőn +2 szett. A plafon ${tile.ceiling}.`}
            </span>
          </div>

          <div className="card rise" style={{ padding: '4px 12px', marginBottom: 10 }}>
            <div className="mz-eyebrow" style={{ padding: '8px 0 2px' }}>Ezen a héten · hol dolgozik</div>
            {rows.length > 0 ? (
              <div className="col gap-sm" style={{ paddingBottom: 8 }}>
                {rows.map((r) => (
                  <div className="row" key={r.day} style={{ alignItems: 'flex-start', gap: 8 }}>
                    <span className="mz-pill" style={{ background: 'var(--mz-cellbg)', color: fam.deep, width: 44, textAlign: 'center' }}>{r.day}</span>
                    <div className="col flex-1">
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{r.type} nap · {r.sets} szett</span>
                      <div className="row gap-xs mt-xs flex-wrap">
                        {r.exercises.map((e, i) => (
                          <span key={i} className="chip" style={{ fontSize: 9, padding: '2px 7px' }}>{e.name} {e.sets}×</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mz-mut" style={{ fontSize: 10, paddingBottom: 8 }}>Ezen a héten nincs terve nap ehhez az izomhoz.</div>
            )}
          </div>

          <div className="card rise" style={{ padding: '10px 12px', marginBottom: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span className="mz-eyebrow">Honnan a sáv · levezetés</span>
              <span className="mz-mut" style={{ fontSize: 8.5 }}>4 réteg, egymásra</span>
            </div>
            <DerivationSteps
              profile={profile}
              tier={tile.tier}
              ceiling={tile.ceiling}
              weekOneValue={weekOneValue}
              series={seriesToNow}
              hold={hold}
            />
          </div>

          <div className="card rise" style={{ padding: '10px 12px' }}>
            <div className="mz-eyebrow" style={{ marginBottom: 4 }}>
              {prev ? `Előző blokk · ${prev.title}` : 'Előző blokk'}
            </div>
            {prev ? (
              <>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {prev.start} → {prev.peak} / {prev.ceiling}
                  </span>
                  <span className="mz-mut" style={{ fontSize: 8.5 }}>
                    {prev.peak >= prev.ceiling ? 'elérte a plafont' : `${prev.ceiling - prev.peak} maradt a plafonig`}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--mz-cellbg)', overflow: 'hidden', marginTop: 6 }}>
                  <div style={{ width: `${Math.min(100, Math.round((prev.peak / prev.ceiling) * 100))}%`, height: '100%', background: fam.deep }} />
                </div>
                <span className="mz-mut" style={{ fontSize: 8.5 }}>indulás → csúcs / plafon · utolsó ismert</span>
              </>
            ) : (
              <span className="mz-mut" style={{ fontSize: 11 }}>nincs előző blokk</span>
            )}
          </div>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
