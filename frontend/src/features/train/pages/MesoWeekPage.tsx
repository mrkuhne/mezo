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
import { nextRolloverChips } from '@/features/train/logic/mesoBands'
import { muscleTiles, peakWeek, weekSummary } from '@/features/train/logic/mesoWeek'
import { REGION_TONE, regionColor, type RegionKey } from '@/features/train/logic/muscleColors'
import { VolumeBand } from '@/features/train/components/VolumeBand'
import { cn } from '@/shared/lib/cn'

const TIER_LABEL = { emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' } as const
/** The rollover forecast reads as a sentence, so it stops at FIVE muscles and says how many
 *  it left out — a 10-muscle block turned the banner into an unreadable wall of chips. */
function rolloverLine(chips: { text: string }[]): string {
  const head = chips.slice(0, 5).map((c) => c.text)
  return chips.length > 5 ? [...head, `+${chips.length - 5}`].join(' · ') : head.join(' · ')
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
  const { arc, pending: arcPending, error: arcError, refetch: refetchArc } = useMesocycleVolumeArc(id ?? null)

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
    // A FAILED arc fetch is not „nincs még ív": the first is recoverable and says so, the
    // second is a promise about the first session. Rendering them identically would tell a
    // user with a dead network to go and train.
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ A blokkod" />
        <PageBody>
          <GhostState
            message={
              arcError
                ? 'Nem sikerült betölteni a heti vizsgálatot — próbáld újra.'
                : 'A heti vizsgálat a blokk első edzése után jelenik meg.'
            }
            ctaLabel={arcError ? 'Újra' : undefined}
            onCta={arcError ? () => void refetchArc() : undefined}
          />
        </PageBody>
      </MozaikPage>
    )
  }

  const tiles = muscleTiles(arc, meso)
  const summary = weekSummary(arc, tiles)
  const chips = nextRolloverChips(meso)
  const emphasized = tiles[0]
  // The block's own peak week — NOT a fixed series[4], which is only ever the peak of a
  // 6-week block (5 weeks would name the deload, 7–8 would understate it).
  const peak = emphasized ? peakWeek(emphasized.series) : null

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
                <div className="mz-mut" style={{ fontSize: 9 }}>{rolloverLine(chips)}</div>
              </div>
            </div>
          )}

          <Mosaic>
            {tiles.map((t, i) => {
              const fam = regionColor(t.region as RegionKey)
              const tone = REGION_TONE[t.region as RegionKey] ?? 'coral'
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
