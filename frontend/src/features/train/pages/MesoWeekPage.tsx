// ============================================================
// Mezo · MesoWeekPage — „Heti vizsgálat" (mesocycle pages v2, mezo-d20.15).
// The run page's `Heti vizsgálat` tile lands here: this week's total + delta
// hero, a live-rollover banner, then one `.mz-wtile` per muscle group — pill +
// tier chip, current → ceiling, a MEV/MAV/MRV band (dim marker at last week,
// live marker at this week) and a 6-bar week spark (current gold, deload
// striped, future faded). Tapping a tile drills into MesoMusclePage. Source of
// truth: the prototype's #page-week (meso-body.html, px ×1.18).
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, Mosaic, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { nextRolloverChips, runBands } from '@/features/train/logic/mesoBands'
import { muscleTiles, weekSummary } from '@/features/train/logic/mesoWeek'
import { regionColor, type RegionKey } from '@/features/train/logic/muscleColors'
import { VolumeBand } from '@/features/train/components/VolumeBand'
import { cn } from '@/shared/lib/cn'

const TIER_LABEL = { emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' } as const
// Arc regions (coral/sky/lav/rose/sage/amber) → Mozaik tone/wash — amber has no
// tile wash of its own, so Core reads as gold (the closest neutral-warm family).
const REGION_TONE: Record<string, 'coral' | 'sage' | 'sky' | 'gold' | 'lav' | 'rose'> = {
  coral: 'coral', sky: 'sky', lav: 'lav', rose: 'rose', sage: 'sage', amber: 'gold',
}
const STATUS_TONE_COLOR = { sage: 'var(--mz-cell-sage-ink)', gold: 'var(--mz-cell-gold-ink)', mut: 'var(--mz-ink-mut)' } as const

function WeekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…" style={{ padding: '12px 24px' }}>
      <Skeleton width={120} height={14} />
      <Skeleton width={80} height={44} style={{ marginTop: 10 }} />
      <div className="col gap-sm mt-lg">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" height={120} />)}
      </div>
    </div>
  )
}

export function MesoWeekPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const goBack = useBackNav(`/train/mesocycles/${id}`)
  const { mesocycles, workoutPending } = useTrain()
  const { arc, pending: arcPending } = useMesocycleVolumeArc(id ?? null)

  const meso = mesocycles.find((m) => m.id === id)

  if (workoutPending || arcPending) return <WeekSkeleton />

  if (!meso) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ A blokkod" />
        <PageBody>
          <GhostState message="Ez a mesociklus nem található." />
        </PageBody>
      </MozaikPage>
    )
  }

  if (!arc) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ A blokkod" />
        <PageBody>
          <GhostState message="A heti vizsgálat a blokk első edzése után jelenik meg." />
        </PageBody>
      </MozaikPage>
    )
  }

  const bands = runBands(meso)
  const summary = weekSummary(arc, bands)
  const tiles = muscleTiles(arc, meso)
  const chips = nextRolloverChips(meso)
  const emphasized = tiles[0]
  const peak = emphasized?.series[4]

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={goBack} label="‹ A blokkod" />
      <EntranceGroup>
        <PageHero
          icon="i-meso"
          big={summary.total}
          name={`Heti vizsgálat · ${arc.currentWeek}. hét`}
          sub={
            summary.delta === null
              ? 'szett ezen a héten'
              : `szett ezen a héten · ${summary.delta >= 0 ? '+' : ''}${summary.delta} a múlt héthez képest`
          }
        />
        <PageBody principle="Koppints egy izomra a részletekért: sáv, blokk-ív, melyik napon és gyakorlatban dolgozik, levezetés (baseline → fókusz-sáv → rád szabva → eredő), előző blokk. Piros itt sincs: a tartás is döntés, nem hiba.">
          <div className="rise" style={{ marginBottom: 10 }}>
            <StatStrip>
              <StatCell value={summary.total} label={`szett · W${arc.currentWeek}`} />
              <StatCell
                value={summary.delta === null ? '—' : `${summary.delta >= 0 ? '+' : ''}${summary.delta}`}
                label={summary.delta === null ? 'első hét' : `vs. W${arc.currentWeek - 1}`}
              />
              <StatCell value={summary.up} label="rámpázik" />
              <StatCell value={summary.hold} label="tart" />
            </StatStrip>
          </div>

          {chips.length > 0 && (
            <div className="mz-livebanner rise" style={{ marginBottom: 10 }}>
              <span className="mz-livedot" aria-hidden="true" />
              <div className="mz-grow">
                <div className="mz-livebanner-title">Élő rendszer · a következő görgetés hétfő hajnal</div>
                <div className="mz-mut" style={{ fontSize: 9 }}>{chips.map((c) => c.text).join(' · ')}</div>
              </div>
            </div>
          )}

          <Mosaic>
            {tiles.map((t, i) => {
              const fam = regionColor(t.region as RegionKey)
              const tone = REGION_TONE[t.region] ?? 'coral'
              return (
                <button
                  key={t.group}
                  type="button"
                  className={cn('mz-wtile', `mz-w-${tone}`, 'rise')}
                  style={{ '--d': `${90 + i * 60}ms` } as React.CSSProperties}
                  onClick={() => navigate(`/train/mesocycles/${id}/week/${t.group}`)}
                  aria-label={`${t.label} részletek`}
                >
                  <div className="mz-band-row">
                    <span className="mz-pill" style={{ background: fam.wash, color: fam.deep }}>{t.label}</span>
                    <span className="mz-grow" />
                    <span className={`mz-tchip mz-tchip-${t.tier}`}>{TIER_LABEL[t.tier]}</span>
                  </div>
                  <div className="mz-wnums" style={{ color: fam.deep }}>
                    {t.current}
                    {t.tier === 'maintain'
                      ? <small>szett</small>
                      : <><span className="mz-arr">→</span>{t.ceiling}<small>plafon</small></>}
                  </div>
                  {t.tier === 'maintain'
                    ? <div className="mz-tile-note">MV {t.mev} · nincs sáv, szinten tartás</div>
                    : <VolumeBand mev={t.mev} mav={t.mav} mrv={t.mrv} prev={t.prev} current={t.current} color={fam.deep} />}
                  <div className="mz-wspark">
                    {t.series.map((s) => (
                      <b
                        key={s.week}
                        className={cn(s.deload && 'mz-wspark-dl', !s.isCurrent && s.week > arc.currentWeek && 'mz-wspark-fut')}
                        style={{
                          height: `${Math.max(12, Math.round((s.planned / t.mrv) * 100))}%`,
                          background: s.isCurrent ? 'var(--mz-gold-bar)' : fam.deep,
                        }}
                      />
                    ))}
                  </div>
                  <div className="mz-wstat" style={{ color: STATUS_TONE_COLOR[t.statusTone] }}>
                    {t.status}
                  </div>
                </button>
              )
            })}
          </Mosaic>

          {emphasized && peak && (
            <div className="mz-coach rise" style={{ marginTop: 9 }}>
              <span className="dot" aria-hidden="true" />
              <span>
                A {emphasized.label.toLowerCase()} a csúcshéten (W{peak.week}) {peak.planned} szettig jut — a plafon {emphasized.ceiling}.
              </span>
            </div>
          )}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
