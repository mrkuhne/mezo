// ============================================================
// Mezo · ActiveMesoCard — status-first hub hero for the running mesocycle
// (mesocycle pages v2 Task 2, mezo-d20.15). Ported from the mezociklus
// prototype's compact clickable hero (meso-body.html "AKTÍV FUTAM HERO"):
// ClayIcon + eyebrow/title, a phase chip, a week-dots strip (done/now/future/
// deload), a "csúcs a WN" + "Ma · <nap> · <típus>" line, and a row of
// current→ceiling band chips. All the run-time math (phaseChip/weekDots/
// runBands) is Task 1's pure logic (logic/mesoBands.ts) — this component only
// renders it. The whole card stays the `onOpen` target (opens the builder).
// The phase-curve bars / meta-stat row this card used to carry are GONE: their
// last consumer (MesoOverviewPage) was retired with v2, so PhaseCurveBars/MetaStat
// were deleted rather than left as orphans.
// ============================================================
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import type { Mesocycle } from '@/data/types'
import { runBands, phaseChip, weekDotClass, weekDots } from '@/features/train/logic/mesoBands'
import { todayDayToken } from '@/features/train/logic/mesoDates'

interface ActiveMesoCardProps {
  meso: Mesocycle
  onOpen: () => void
}

/** Chip text per RunBand.step — 'up' shows the ceiling it is climbing toward,
 *  'hold' (maintain tier) reads as a flat tart(ás), 'cap' (already at ceiling
 *  this week) is just the plain current count, same as the prototype's
 *  un-arrowed chips (e.g. "Farizom 6"). */
function bandChipText(band: ReturnType<typeof runBands>[number]): string {
  const star = band.tier === 'emphasize' ? '★ ' : ''
  if (band.step === 'up') return `${star}${band.label} ${band.current}→${band.ceiling} ▲`
  if (band.step === 'hold') return `${star}${band.label} ${band.current} · tart`
  return `${star}${band.label} ${band.current}`
}

export function ActiveMesoCard({ meso, onOpen }: ActiveMesoCardProps) {
  const dots = weekDots(meso)
  const phase = phaseChip(meso)
  // Top 5 bands — runBands is already sorted by ceiling descending, same cutoff
  // the prototype's chip row uses; the rest are counted, not dropped in silence.
  const allBands = runBands(meso)
  const bands = allBands.slice(0, 5)
  const hidden = allBands.length - bands.length
  const peakWeekIdx = meso.phaseCurve.indexOf('MRV')
  const todayToken = todayDayToken()
  const todayDay = meso.days?.find((d) => d.day === todayToken)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card"
      aria-label="Aktív mezociklus megnyitása"
      style={{
        padding: 0,
        width: '100%',
        textAlign: 'left',
        overflow: 'hidden',
        background: 'linear-gradient(165deg, var(--primary-bg), var(--surface-card) 72%)',
        borderColor: 'var(--line)',
        position: 'relative',
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'var(--primary-base)' }} />
      <span
        style={{
          position: 'absolute',
          right: -50,
          top: -50,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--primary-base) 12%, transparent), transparent 70%)',
        }}
      />

      <div style={{ padding: 'var(--sp-5)', position: 'relative' }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <ClayIcon name="i-meso" size={44} />
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow brand>{`Aktív · ${meso.currentWeek}/${meso.weeks} hét`}</Eyebrow>
            <Display size="lg">{meso.title}</Display>
          </div>
          <span className="mz-phchip">{phase}</span>
          <Icon name="chevron-right" size={16} color="var(--primary-deep)" />
        </div>

        <div className="mz-wdots">
          {dots.map((d) => (
            <i key={d.week} className={weekDotClass(d)} />
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
          <span className="text-secondary" style={{ fontSize: 11 }}>
            {peakWeekIdx >= 0
              ? `W${meso.currentWeek} · a csúcs a W${peakWeekIdx + 1} · utána deload`
              : `W${meso.currentWeek}/${meso.weeks}`}
          </span>
          {todayDay && (
            <span className="text-secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {`Ma · ${todayToken} · ${todayDay.type}`}
            </span>
          )}
        </div>

        <div className="row gap-xs" style={{ marginTop: 7, flexWrap: 'wrap' }}>
          {bands.map((b) => (
            <span key={b.group} className={`mz-mband${b.step === 'up' ? ' up' : ''}`}>
              {bandChipText(b)}
            </span>
          ))}
          {hidden > 0 && <span className="mz-mband">{`+${hidden}`}</span>}
        </div>
      </div>
    </button>
  )
}
