// ============================================================
// Mezo · MesoTervPage — the Terv tab's landing (route /train/mesocycles).
// Train Titanium T9 Task 3 (mezo-88iwa.10): THE INVERSION. The running block is
// no longer a card inside a library — it IS the page. Was
// `MesocycleLibraryPage`; the library itself moved to `MesoKonyvtarPage`
// (Task 2) behind the `Edzéstervek` dest tile below.
//
// Anatomy, ported from the prototype's planHome
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:60-129):
//   `.pl-poster`  — the week numeral + „. hét / {weeks}", the progress ring, the
//                   phase pill, the block's name, ONE plain sentence, the week arc.
//                   The WHOLE poster is the builder's door (/train/mesocycles/:id),
//                   the same whole-card idiom the old hub hero carried.
//   „A heted"     — one `.pl-day` card per TRAINING day (full weekday name, `MA`
//                   chip on today, boxed szett/perc/gyakorlat facts, per-muscle
//                   mini bars) → the day's own page; rest/sport days are slim rows.
//   `.pl-dests`   — the two quiet doorways: „Melyik izmod hol tart" → …/week
//                   (this is the old `Heti vizsgálat` tile's reachability, kept)
//                   and „Edzéstervek" → …/konyvtar (which owns `Új blokk`, so the
//                   landing has no `+ Új` header chip any more — one entry, not two).
//   the close row — opens the EXISTING `MesoCloseSheet` (the builder's own sheet,
//                   reused, not forked).
//
// Derivations are the app's own, never the prototype's fixture math: `phaseChip`/
// `weekDots`/`runBands`/`nextRolloverChips` (logic/mesoBands.ts) and `dayTileData`
// (wizard/dayTiles.ts) — the same modules the builder and the week page read, so the
// two surfaces can never disagree about the same block.
//
// Language: one plain Hungarian sentence, no jargon — „pihenőhét", never „deload"
// (the phase pill says `Pihenőhét` for a `Deload` week). Clay icons only.
//
// No active block → the page says so honestly and still shows the `Edzéstervek`
// doorway (the `Tervezett` list lives there); the T0 ghost hint stays.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import type { Mesocycle, MesoDay, MesoPhase } from '@/data/types'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { nextRolloverChips, phaseChip, runBands, weekDots, type Phase } from '@/features/train/logic/mesoBands'
import { todayDayToken } from '@/features/train/logic/mesoDates'
import { isOffDay } from '@/features/train/logic/offDay'
import { SESSION_MUSCLE_CAP } from '@/features/train/logic/setBudget'
import { dayTileData } from '@/features/train/wizard/dayTiles'
import { MesoCloseSheet } from '@/features/train/sheets/MesoCloseSheet'
import MesoTervSkeleton from '@/features/train/pages/MesoTervSkeleton'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** The week arc's bar heights come from the plan's OWN landmark curve (`phaseCurve`) —
 *  the one per-week quantity the app actually stores. The prototype scales its bars by a
 *  per-week set projection; we have no such projection for a real run (`volumePerMuscle`
 *  knows only THIS week), and inventing one would draw a ramp nobody planned. */
const PHASE_HEIGHT: Record<MesoPhase, number> = { MEV: 34, MAV: 66, MRV: 100, Deload: 26 }

/** The phase pill in the owner's words. Keyed on `Phase` (mesoBands.ts) so the map is
 *  exhaustive and the pill can never fall back to a raw wire value — the owner's word
 *  list bans „rámpa"/„blokk" in user-facing copy (T9 fix round 1), so `phaseChip`'s own
 *  „Rámpa" label needs its own honest translation here too, not just „Deload". */
const PHASE_LABEL: Record<Phase, string> = { Rámpa: 'Emelkedés', Csúcs: 'Csúcshét', Deload: 'Pihenőhét' }

/** The day IF the block actually trains on it, else null — rest (`muscle: ''`) and sport
 *  (`muscle: 'sport'`) days are off-days by the shared rule, and an empty exercise list is
 *  an off-day too. Returns the day rather than a boolean so the off-day branch can still
 *  read the ORIGINAL row (a type predicate would narrow it away to `undefined` there, and
 *  the sport row needs its `type` to name itself). */
function trainingDay(day: MesoDay | undefined): MesoDay | null {
  return day && !isOffDay(day) && day.exercises.length > 0 ? day : null
}

/** The block's ONE sentence: where you are, what this week weighs, and when the
 *  pihenőhét lands — folded into a single plain clause chain, never a paragraph. */
function blockSentence(meso: Mesocycle): string {
  const sets = runBands(meso).reduce((sum, b) => sum + b.current, 0)
  const trainingDays = (meso.days ?? []).filter((d) => trainingDay(d) !== null).length
  const deloadIdx = meso.phaseCurve.indexOf('Deload')
  const toDeload = deloadIdx >= 0 ? deloadIdx + 1 - meso.currentWeek : -1
  const rest =
    toDeload === 0 ? ' — és ez a hét maga a pihenőhét'
      : toDeload === 1 ? ' — a jövő hét már pihenőhét'
        : toDeload > 1 ? ` — ${toDeload} hét múlva jön a pihenőhét`
          : ''
  return `A ${meso.weeks} hétből a ${meso.currentWeek}. héten jársz: ${sets} szett, ${trainingDays} edzésnapra osztva${rest}.`
}

export function MesoTervPage() {
  const { mesocycles, workoutPending } = useTrain()
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)

  // Real-mode loading: show the layout-aware skeleton until the meso list resolves.
  // Mock seeds synchronously → no skeleton.
  if (workoutPending) return <MesoTervSkeleton />

  const meso = mesocycles.find((m) => m.status === 'active') ?? null
  const openKonyvtar = () => navigate('/train/mesocycles/konyvtar')

  const dests = (
    // The kalauz's stable home (mezo-88iwa.10 Task 3): the dest row renders on EVERY
    // state of this page — with or without a running block — so „Mutasd meg" always
    // finds its spot. Task 2 had it on an active-meso-gated tile, which silently
    // degraded the guide for a user between blocks.
    <div
      className="pl-dests"
      data-kalauz-anchor="mesociklus-mosaic"
      style={meso ? undefined : { gridTemplateColumns: '1fr' }}
    >
      {meso && (
        <button
          type="button"
          className="pl-dest is-muscle rise"
          style={delay(200)}
          aria-label="Melyik izmod hol tart"
          onClick={() => navigate(`/train/mesocycles/${meso.id}/week`)}
        >
          <span className="pl-dest-art"><ClayIcon name="i-heti" size={40} className="icon" /></span>
          <strong>Melyik izmod hol tart</strong>
          <small>
            {(() => {
              const climbing = nextRolloverChips(meso).filter((c) => c.tone === 'sage').length
              return climbing > 0 ? `${climbing} izom kap többet hétfőtől` : 'Hétfőtől minden izom tart'
            })()}
          </small>
          <b aria-hidden="true">↗</b>
        </button>
      )}
      <button
        type="button"
        className="pl-dest is-plans rise"
        style={delay(230)}
        aria-label="Edzéstervek"
        onClick={openKonyvtar}
      >
        <span className="pl-dest-art"><ClayIcon name="i-polc" size={40} className="icon" /></span>
        <strong>Edzéstervek</strong>
        <small>Amiből indíthatsz</small>
        <b aria-hidden="true">↗</b>
      </button>
    </div>
  )

  if (!meso) {
    return (
      <EntranceGroup>
        <div style={{ padding: '16px 24px 0' }}>
          <GhostState
            lines={2}
            message={
              mesocycles.length === 0
                ? 'Még nincs mesociklusod — itt fognak élni a terveid.'
                : 'Most nem fut terv — a terveid az Edzéstervek mögött várnak.'
            }
          />
        </div>
        {dests}
      </EntranceGroup>
    )
  }

  const phase = phaseChip(meso)
  const dots = weekDots(meso)
  const today = todayDayToken()
  const done = ((meso.currentWeek - 1) / meso.weeks) * 100

  return (
    <>
      <EntranceGroup>
        {/* The poster. One button, one accessible name — the same whole-card idiom
            the old hub hero carried, so the builder deep-link keeps its door. */}
        <div className="rise" style={delay(40)}>
          <button
            type="button"
            className="pl-poster"
            aria-label="Aktív mezociklus megnyitása"
            onClick={() => navigate(`/train/mesocycles/${meso.id}`)}
            style={{
              display: 'block',
              // NOT width: 'auto' — a display:block <button> is still a form control and
              // shrink-to-fits its content rather than auto-filling like `.tr-day`'s bare
              // <section> (TrainTodayPage.tsx:444-446). The wrapper carries no horizontal
              // padding any more (T9 fix round 1, measured regression: `padding: '0 6px'`
              // + `width: 100%` rendered 6px left / 30px right instead of edge-to-edge), so
              // the poster's own `.pl-poster` negative `margin-inline` (prototype.css:13891)
              // needs an explicit width that accounts for it on both sides.
              width: 'calc(100% + 2 * var(--screen-gutter))',
              textAlign: 'left',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span className="pl-poster-glow" aria-hidden="true" />
            <span className="pl-poster-sheen" aria-hidden="true" />
            <span className="pl-poster-top">
              <span className="pl-week">
                <strong>{meso.currentWeek}</strong>
                <small>. hét</small>
                <i>/ {meso.weeks}</i>
              </span>
              <span className={cn('pl-phase', phase === 'Csúcs' && 'is-peak', phase === 'Deload' && 'is-deload')}>
                {PHASE_LABEL[phase]}
              </span>
              <span className="pl-ring" style={{ '--p': done } as CSSProperties} aria-hidden="true">
                <svg viewBox="0 0 72 72">
                  <circle className="t" cx="36" cy="36" r="31" pathLength={100} />
                  <circle className="f" cx="36" cy="36" r="31" pathLength={100} />
                </svg>
                <b><ClayIcon name="i-meso" size={30} className="icon" /></b>
              </span>
            </span>
            <h2>{meso.title}</h2>
            <p>{blockSentence(meso)}</p>
            {/* The week arc — one bar per week, this week lit, the pihenőhét hatched. */}
            <span className="pl-arc" aria-hidden="true">
              {dots.map((d) => (
                <i
                  key={d.week}
                  className={cn(d.deload && 'is-deload', d.state === 'now' && 'is-now', d.state === 'done' && 'is-past')}
                  style={{ '--h': `${PHASE_HEIGHT[meso.phaseCurve[d.week - 1]] ?? 34}%` } as CSSProperties}
                >
                  <b>{d.week}</b>
                </i>
              ))}
            </span>
          </button>
        </div>

        {/* „A heted" — every weekday, in order: a card for the training days, a slim
            row for the rest/sport ones. The MA chip marks today wherever it lands. */}
        <div className="tr-eyebrow rise" style={{ padding: '2px var(--screen-gutter) 8px', ...delay(90) }}>
          A HETED
        </div>
        <div className="pl-days">
          {DAY_ORDER.map((token, i) => {
            const day = meso.days?.find((d) => d.day === token)
            const training = trainingDay(day)
            const isToday = token === today
            const name = DAY_LABELS[token] ?? token
            if (!training) {
              const sport = day?.muscle === 'sport'
              return (
                <div key={token} className="pl-day is-rest rise" style={delay(110 + i * 20)}>
                  <span className="pl-day-tag">{name}</span>
                  {isToday && <span className="pl-today">MA</span>}
                  <span className="pl-day-rest">
                    <ClayIcon name={sport ? 'i-sport' : 'i-hold'} size={22} className="icon" />
                    {sport ? (day?.type ?? 'sportnap') : 'pihenőnap'}
                  </span>
                </div>
              )
            }
            const tile = dayTileData(training)
            return (
              <button
                type="button"
                key={token}
                className={cn('pl-day rise', isToday && 'is-now')}
                style={delay(110 + i * 20)}
                aria-label={`${name}${isToday ? ' · ma' : ''} · ${training.type}`}
                onClick={() => navigate(`/train/mesocycles/${meso.id}/days/${encodeURIComponent(token)}`)}
              >
                <span className="pl-day-head">
                  <span className="pl-day-tag">{name}</span>
                  {isToday && <span className="pl-today">MA</span>}
                  <strong>{training.type}</strong>
                  <b aria-hidden="true">›</b>
                </span>
                <span className="pl-day-facts">
                  <i><ClayIcon name="i-edzes" size={22} className="icon" /><b>{tile.sets}</b><small>szett</small></i>
                  <i><ClayIcon name="i-idozito" size={22} className="icon" /><b>{tile.minutes}</b><small>perc</small></i>
                  <i><ClayIcon name="i-stack" size={22} className="icon" /><b>{training.exercises.length}</b><small>gyakorlat</small></i>
                </span>
                <span className="pl-day-bars">
                  {tile.muscles.map((m) => (
                    <i
                      key={m.label}
                      style={{
                        '--mus-color': m.color,
                        '--w': `${Math.min(100, (m.sets / SESSION_MUSCLE_CAP) * 100)}%`,
                      } as CSSProperties}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        {dests}

        {/* The quiet close row — the SAME sheet the builder opens (mezo-meyc.2), not a
            second confirm surface. */}
        <div style={{ padding: '10px var(--screen-gutter) 24px' }}>
          <button
            type="button"
            className="pl-item rise"
            style={delay(260)}
            aria-label="Edzésterv lezárása"
            onClick={() => setClosing(true)}
          >
            <span className="pl-item-art"><ClayIcon name="i-erme" size={32} className="icon" /></span>
            <span className="pl-item-name">Edzésterv lezárása</span>
            <b aria-hidden="true">›</b>
            <span className="pl-item-say">Ha ezt a {meso.weeks} hetet végigcsináltad</span>
          </button>
        </div>
      </EntranceGroup>

      {closing && <MesoCloseSheet mesoId={meso.id} title={meso.title} onClose={() => setClosing(false)} />}
    </>
  )
}
