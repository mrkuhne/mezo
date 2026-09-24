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
//   „A heted"     — one `MesoDayCard` per TRAINING day → the day's own page;
//                   rest/sport days stay slim rows. U5 (mezo-me75u.5) replaced the
//                   old identical-looking `.pl-day` tiles: the card now carries the
//                   day's body map and muscle chips (so Push / Legs / Pull read as
//                   three different cards), and the week's three ranks are drawn
//                   apart — „megvolt · ma · jön". A done day's numbers come off the
//                   week's completed instances (`doneByDay`, mesoWeekDone.ts), never
//                   the plan, so a „Megvolt" stamp never sits over a planned figure.
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
import { useWeekMuscleLog } from '@/data/train/weekMuscleLogHooks'
import type { Mesocycle, MesoDay, MesoPhase } from '@/data/types'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { ClayIcon, Icon3D } from '@/shared/ui/clay'
import { MesoDayCard } from '@/features/train/components/MesoDayCard'
import { doneByDay } from '@/features/train/logic/mesoWeekDone'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { nextRolloverChips, phaseChip, runBands, weekDots, type Phase } from '@/features/train/logic/mesoBands'
import { todayDayToken } from '@/features/train/logic/mesoDates'
import { isOffDay } from '@/features/train/logic/offDay'
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
  // U5 (mezo-me75u.5): the week list separates „megvolt · ma · jön", so a day the athlete
  // already trained shows what HAPPENED. Same cached reads the Terhelés tab makes
  // (weekMuscleLogHooks) — no second source of truth, and no new endpoint. Mock mode has no
  // persisted instances, so every day there honestly renders as planned.
  const { details } = useWeekMuscleLog()
  const doneDays = doneByDay(details)
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
        {/* The heading rides the SAME 20px gutter as the `.pl-days` list under it (the
            prototype's `.pl-h3` and `.pl-days` share one inset, plan.css:175-176) — the
            surfaces slice moved the list back to the prototype's own gutter, so the
            heading follows it or the page reads misaligned (mezo-fsz2r Task 2). */}
        <div
          className="tr-eyebrow rise"
          style={{ padding: '2px 20px 8px', marginInline: 'calc(-1 * var(--screen-gutter))', ...delay(90) }}
        >
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
              // The off-day row speaks the SAME vocabulary as the cards above it (U5): one
              // eyebrow, one stamp word, the 3D icon set — only the rank is quieter. A week
              // is also its off days; they are a slim row, never a card.
              return (
                <div key={token} className="tv-dayrest rise" style={delay(110 + i * 20)}>
                  <span className="tv-day-tag">{name}</span>
                  <em>{sport ? (day?.type ?? 'sportnap') : 'pihenőnap'}</em>
                  {isToday && (
                    <span className="tv-day-stamp is-today">
                      <Icon3D name="t-play" size={17} />
                      Ma
                    </span>
                  )}
                  <Icon3D name={sport ? 't-volley' : 't-moon'} size={24} />
                </div>
              )
            }
            return (
              <MesoDayCard
                key={token}
                day={training}
                name={name}
                isToday={isToday}
                done={isToday ? null : (doneDays.get(token) ?? null)}
                delayMs={110 + i * 20}
                onOpen={() => navigate(`/train/mesocycles/${meso.id}/days/${encodeURIComponent(token)}`)}
              />
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
