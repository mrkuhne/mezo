// ============================================================
// Mezo · NapHubPage — the Nap spine's Mozaik face (mezo-d20.2.1)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html. The header
// (section spot + name · [tutorial "?"] · daypart switch · Mezo messages ·
// notifications · profile orb) now lives in the shell
// (`app/AppHeader.tsx`, mezo-atry) — this page only picks the panel from
// `?dp=`, then renders ONE hero per daypart panel + the 2-column tile mosaic;
// every tile navigates to its own page (Huawei pattern).
//
// 1:1 fidelity audit (mezo-d20.11) — what this page owes the prototype and now
// pays: the Rutin tile carries the NEXT habit's own clay icon + its name +
// `n/m` + an in-place tick,
// the Küldetés tile shows one big dot per quest (not a text count), the Kreed
// tile has NO icon and carries the `n fókusz ›` more-line, the reggel hero keeps
// `Súly … ↘` and `Fókusz …` on ONE row, the day-bar segments and the water bar
// FILL on entrance, the este panel closes with the day's stat strip, and
// `?day=rough` renders the horgony melt again (provisional, F7).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { Mosaic, StatCell, StatStrip, Tile } from '@/shared/ui/mozaik'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'
import {
  useToday, useTodayScenario, useCheckins, useSleepGoal, useDailyQuests,
  useHabitDay, useHabitCatalog, useHabitActions, useFuelPreview, useFuelDay,
  useWaterActions, useSleep, useWeight, useIntentionDay, useIntentionActions,
  useStackDay, useGamificationDay,
} from '@/data/hooks'
import { buildHabitRewardToast } from '@/features/progression/logic/rewardToast'
import { type DayFace } from '@/features/today/logic/dayFace'
import { useDayFace } from '@/features/today/logic/useDayFace'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { needRingGradient } from '@/features/today/logic/needs'
import { minsToBed } from '@/features/today/logic/windDown'
import { habitAction } from '@/features/today/logic/habitAction'
import { habitClayIcon, DAYPART_CLAY } from '@/features/today/logic/habitClayIcon'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import type { HabitItem } from '@/data/types'

function fmtHm(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** The prototype's three horgony rows (`?day=rough`), verbatim copy. */
const ANCHORS: { title: string; sub: string; icon: 'i-viz' | 'i-reggeli' | 'i-futas' }[] = [
  { title: 'Egy pohár víz', sub: 'Most. Egyszerű kezdet.', icon: 'i-viz' },
  { title: 'Egy fehérje-étkezés', sub: 'Bármi. 30 g fehérje elég.', icon: 'i-reggeli' },
  { title: '10 perc séta', sub: 'Friss levegő. Nem futás.', icon: 'i-futas' },
]

export function NapHubPage() {
  const date = localDateString()
  const navigate = useNavigate()

  const { today, workoutDone, workoutDoneSets } = useToday()
  const scenario = useTodayScenario()
  const { goal: sleepGoal } = useSleepGoal()
  const tick = useMinuteTick()
  // A `?dp=`-vagy-óra feloldás a shell fejlécével KÖZÖS (mezo-atry): egy hook, egy óra —
  // két másolat egy napszak-határon két különböző napszakot vezetett volna le.
  const { face } = useDayFace()

  // ── data for heroes + tiles ─────────────────────────────────────────
  const { fuel } = useFuelDay(date)
  const { plan } = useFuelPreview()
  const { logWater } = useWaterActions(date)
  const { lastNight } = useSleep()
  const { weightLog } = useWeight()
  const latestWeight = weightLog.length > 0 ? weightLog[weightLog.length - 1] : null
  const previousWeight = weightLog.length > 1 ? weightLog[weightLog.length - 2] : null
  const { checkins } = useCheckins()
  const { quests } = useDailyQuests(date)
  const { habits } = useHabitDay(date)
  const { catalog: habitCatalog } = useHabitCatalog()
  const { check, pending: habitPending } = useHabitActions(date)
  const { data: intentionData } = useIntentionDay(date)
  const { addFocus } = useIntentionActions(date)
  const needs = useNeeds(tick)
  const { slots: stackSlots } = useStackDay(date)
  const { data: gamDay } = useGamificationDay(date)

  const intention = intentionData ?? { date, creed: null, foci: [], reflection: null }

  // ── the one sheet the hub still owns (Kreed) ─────────────────────────
  const [focusOpen, setFocusOpen] = useState(false)
  const [anchorsDone, setAnchorsDone] = useState<Set<number>>(() => new Set())

  // ── derived tile facts ──────────────────────────────────────────────
  const questXp = quests.reduce((s, q) => s + q.xp, 0)
  const habitsFor = (f: DayFace) => {
    const keys = new Set(
      habitCatalog.chains
        .filter((c) => (f === 'reggel' ? c.daypart === 'MORNING' : c.daypart === 'EVENING'))
        .map((c) => c.chainKey),
    )
    return habits.filter((h) => keys.has(h.chain))
  }
  const kcalLeft = Math.round(fuel.targets.kcal - fuel.consumed.kcal)
  const kcalCount = useCountUp(kcalLeft)
  // The prototype count-ups both time heroes (`data-kind="time"`): count the MINUTES,
  // format after — a formatted string cannot be interpolated.
  const sleptMin = lastNight ? Math.round(lastNight.duration * 60) : 0
  const sleptCount = useCountUp(sleptMin)
  const bedIn = minsToBed(tick, sleepGoal.bedTime)
  const bedInCount = useCountUp(bedIn)
  const kcalEaten = Math.round(fuel.consumed.kcal)
  const kcalEatenCount = useCountUp(kcalEaten)
  const xpCount = useCountUp(gamDay.xpTotal)

  const mealSlots = plan.slots.filter((s) => s.slotKey !== undefined)
  const nowWindow = mealSlots.find((s) => s.state === 'now')
  const stackTaken = stackSlots.filter((sl) => sl.entries.filter((e) => !e.skippedToday).every((e) => e.taken)).length
  const waterPct = fuel.targets.water > 0
    ? Math.min(1, fuel.consumed.water / fuel.targets.water)
    : 0

  // ── shared tiles (Küldetések / Check-in appear on every panel) ──
  // These carry prototype-specific internals (a count badge, quest dots), so they are
  // composed from the Mozaik `mz-*` classes rather than the generic `Tile` recipe.
  const questTile = (delay: number) => (
    <button key="quest" type="button" className="mz-tile mz-w-gold rise"
      style={{ '--d': `${delay}ms` } as React.CSSProperties}
      onClick={() => navigate('/nap/kuldetesek')} aria-label="Napi küldetések">
      <span className="mz-eyebrow nap-gold">Küldetések</span>
      <div className="mz-spotwrap"><ClaySpot name="s-hajtas" size={47} /></div>
      {/* prototype: ONE big dot per quest (filled = done) + the day's XP pot — the
          count is shown visually, so it is NOT repeated as text. */}
      <div className="nap-bigdots">
        {quests.map((q) => (
          <span key={q.id} className={cn('hd', q.status === 'completed' && 'f')} aria-hidden="true" />
        ))}
        {questXp > 0 && <span className="nap-qxp">+{questXp} XP</span>}
      </div>
    </button>
  )

  const checkTile = (delay: number) => (
    <Tile key="check" wash="rose" icon="i-checkin" eyebrow="Check-in" delayMs={delay}
      line={
        <span className="nap-ckdots" aria-hidden="true">
          {checkins.map((c, i) => <span key={i} className={cn('hd', c.state === 'done' && 'f')} />)}
        </span>
      }
      onClick={() => navigate('/nap/checkin')} aria-label="Check-in" />
  )

  /** The prototype's in-place tick: only a habit whose own action IS a check can honestly
   *  complete from here (ADR 0010 — a DERIVED row never self-completes). Anything else has
   *  no tick, and the tile itself opens the Rutin page where that row's real surface lives. */
  const tileTick = (h: HabitItem): (() => void) | null => {
    if (h.status !== 'pending' || habitAction(h).kind !== 'check') return null
    const chainSteps = habits.filter((x) => x.chain === h.chain)
    return () => {
      check(h.key)
        .then((lu) => emitToast(buildHabitRewardToast({
          title: h.title,
          chainDone: chainSteps.filter((x) => x.status === 'done').length,
          chainTotal: chainSteps.length,
          xp: h.xp,
          levelUp: lu?.[0],
        })))
        .catch(() => {})
    }
  }

  const habitTile = (f: DayFace, delay: number) => {
    const items = habitsFor(f)
    if (items.length === 0) return null
    const done = items.filter((h) => h.status === 'done').length
    const next = items.find((h) => h.status === 'pending') ?? null
    const chainOf = (h: HabitItem) => habitCatalog.chains.find((c) => c.chainKey === h.chain)
    const chain = next ? chainOf(next) : undefined
    const icon = next
      ? (chain ? habitClayIcon(next.key, chain) : DAYPART_CLAY[f === 'este' ? 'EVENING' : 'MORNING'])
      : 'i-lang'
    const name = next ? next.title : (f === 'este' ? 'Tökéletes este' : 'Tökéletes reggel')
    const tick = next ? tileTick(next) : null
    const label = f === 'este' ? 'Esti rutin' : 'Reggeli rutin'
    // A tile that contains its own tick button cannot itself be a <button> (nested
    // interactive content) — the prototype's own `role="button"` tile, verbatim.
    const open = () => navigate(`/nap/rutin?dp=${f}`)
    return (
      <div key="habit" role="button" tabIndex={0} aria-label={label}
        className={cn('mz-tile rise', next ? (f === 'este' ? 'mz-w-lav' : 'mz-w-gold') : 'mz-w-sage')}
        style={{ '--d': `${delay}ms` } as React.CSSProperties}
        onClick={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}>
        <span className={cn('mz-eyebrow', f === 'este' ? 'nap-lav' : 'nap-gold')}>Rutin</span>
        <div className="mz-spotwrap"><ClayIcon name={icon} size={47} /></div>
        <div className="nap-habname">{name}</div>
        <div className="nap-habfoot">
          <span className="nap-habcount">{done}/{items.length}</span>
          {tick ? (
            <button type="button" className="nap-htickbtn" aria-label={`Kipipálás — ${name}`}
              disabled={habitPending}
              onClick={(e) => { e.stopPropagation(); tick() }}>
              <span className="nap-htick" />
            </button>
          ) : (
            <span className="nap-htickbtn" aria-hidden="true">
              <span className={cn('nap-htick', !next && 'f')}>{!next ? '✓' : ''}</span>
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── „nehéz nap" horgony-olvadás (`?day=rough`) ──────────────────────
  // PROVIZÓRIKUS (mezo-d20.11): a törölt AnchorIsland tartalma a Mozaik nyelvén, hogy a
  // mód ne rendereljen semmit. Végleges formája az F7 design-körre tartozik.
  if (scenario.anchorMode) {
    return (
      <div className="nap-hub">
        <EntranceGroup className="mz-panel-stack">
          <div className="mz-tile nap-hero nap-anch-hero rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
            <div className="nap-hero-row">
              <ClaySpot name="s-piheno" size={52} />
              <div>
                <span className="mz-eyebrow nap-coral">Horgony mód · csendben</span>
                <div className="nap-hero-line">
                  <span className="nap-big">{ANCHORS.length}</span>
                  <span className="nap-mut">apró horgony</span>
                </div>
              </div>
            </div>
            <p className="nap-anch-say">Nehéz nap — ma elég a minimum. Itt vagyok.</p>
          </div>
          <Mosaic>
            {ANCHORS.map((a, i) => {
              const done = anchorsDone.has(i)
              return (
                <div key={a.title} className="mz-tile mz-w-white rise"
                  style={{ '--d': `${70 + i * 40}ms` } as React.CSSProperties}>
                  <span className="mz-eyebrow">{a.sub}</span>
                  <div className="mz-spotwrap"><ClayIcon name={a.icon} size={47} /></div>
                  <div className="nap-habname">{a.title}</div>
                  <div className="nap-habfoot">
                    <span className="nap-habcount" />
                    <button type="button" className="nap-htickbtn" aria-label={`Megvolt — ${a.title}`}
                      onClick={() => setAnchorsDone((s) => {
                        const n = new Set(s)
                        if (n.has(i)) n.delete(i); else n.add(i)
                        return n
                      })}>
                      <span className={cn('nap-htick', done && 'f')}>{done ? '✓' : ''}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </Mosaic>
          <button type="button" className="nap-anch-exit rise"
            style={{ '--d': '230ms' } as React.CSSProperties}
            onClick={() => navigate('/nap', { replace: true })}>
            Kilépés a horgony módból
          </button>
        </EntranceGroup>
      </div>
    )
  }

  return (
    <div className="nap-hub">
      <EntranceGroup replayKey={face} className="mz-panel-stack">
        {face === 'reggel' && (
          <>
            <div className="mz-tile mz-w-lav nap-hero rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div className="nap-hero-row">
                <ClaySpot name="s-este" size={52} />
                <div>
                  <span className="mz-eyebrow nap-lav">Éjszakád</span>
                  <div className="nap-hero-line">
                    <span className="nap-big">{lastNight ? fmtHm(sleptCount) : '—'}</span>
                    {lastNight && <span className="nap-mut">minőség {lastNight.quality}/10</span>}
                  </div>
                </div>
              </div>
              {/* prototype: `Súly 84,2 kg ↘` and `Fókusz …` on ONE row (the CSS keeps it
                  unwrapped; the focus text ellipsises). The trend arrow needs a previous
                  weigh-in — with a single entry it renders nothing rather than a fake ↘. */}
              <div className="nap-hero-sub">
                {latestWeight && (
                  <span className="nap-mut">
                    Súly <b>
                      {latestWeight.value.toLocaleString('hu-HU')} kg
                      {previousWeight && previousWeight.value !== latestWeight.value
                        ? (latestWeight.value < previousWeight.value ? ' ↘' : ' ↗')
                        : ''}
                    </b>
                  </span>
                )}
                {intention.foci.length > 0 && <span className="nap-mut">Fókusz <b className="nap-coral">{intention.foci[0].text}</b></span>}
              </div>
            </div>
            <Mosaic>
              {habitTile('reggel', 70)}
              {questTile(110)}
              {checkTile(150)}
              {/* prototype .t-kreed: NO icon — the creed with a 3-line clamp, then the more-line */}
              <button type="button" className="mz-tile mz-w-white rise"
                style={{ '--d': '190ms' } as React.CSSProperties}
                onClick={() => setFocusOpen(true)} aria-label="Kreed">
                <span className="mz-eyebrow nap-coral">Kreed</span>
                <div className="nap-kreedq">{intention.creed ?? 'Mi a mai szándék?'}</div>
                <div className="nap-tilegap" />
                {intention.foci.length > 0 && (
                  <div className="nap-tilemore nap-coral">{intention.foci.length} fókusz ›</div>
                )}
              </button>
            </Mosaic>
          </>
        )}

        {face === 'nap' && (
          <>
            <div className="mz-tile mz-w-sage nap-hero rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
              <span className="mz-eyebrow nap-sage">Keret · ma</span>
              <div className="nap-hero-line">
                <span className="nap-big">{kcalCount}</span>
                <span className="nap-mut">kcal maradt · fehérje {Math.round(fuel.consumed.p)}/{Math.round(fuel.targets.p)} g</span>
              </div>
              <div className="daybar">
                {mealSlots.map((s, i) => (
                  <i key={i} className={cn(s.state === 'done' && 'f', s.state === 'now' && 'now')}
                    style={{ '--d': `${250 + i * 80}ms` } as React.CSSProperties} />
                ))}
              </div>
            </div>
            <Mosaic>
              {nowWindow && (
                <Tile wash="most" icon="i-fuel" eyebrow={`${nowWindow.label} · most`} delayMs={70}
                  line={<span className="nap-tilemore nap-coral">Logold ›</span>}
                  onClick={() => navigate('/fuel')} aria-label={`Logold — ${nowWindow.label}`} />
              )}
              {today.workoutType && (
                <Tile wash="coral" icon="i-edzes" eyebrow="Edzés" delayMs={110}
                  line={today.workoutType} onClick={() => navigate('/train')} aria-label="Edzés" />
              )}
              <button type="button" className="mz-tile mz-w-white rise" style={{ '--d': '150ms' } as React.CSSProperties}
                onClick={() => navigate('/nap/eletjel')} aria-label="Életjel">
                <span className="mz-eyebrow">Életjel</span>
                <div className="mz-spotwrap">
                  <div className="nap-bigring" style={{ background: needRingGradient(needs.states) }}>
                    <span className="nap-ringhole"><ClayIcon name="i-eletjel" size={18} /></span>
                  </div>
                </div>
              </button>
              {/* prototype .t-water: icon + value / goal on top, the FILLING bar at the
                  bottom, and the „koppints: +2,5 dl" hint under it. */}
              <button type="button" className="mz-tile mz-w-sky rise" style={{ '--d': '190ms' } as React.CSSProperties}
                onClick={() => logWater(250)} aria-label="Víz +2,5 dl">
                <div className="nap-watertop">
                  <ClayIcon name="i-viz" size={26} />
                  <span className="nap-waterval">
                    <span className="nap-waterbig">
                      {(fuel.consumed.water / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="nap-watermut">
                      / {(fuel.targets.water / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} L
                    </span>
                  </span>
                </div>
                <div className="nap-tilegap" />
                <div className="nap-waterfill">
                  <div style={{ '--w': waterPct } as React.CSSProperties} />
                </div>
                <div className="nap-waterhint">koppints: +2,5 dl</div>
              </button>
              <Tile wash="sage" icon="i-stack" eyebrow="Stack" delayMs={230}
                line={<span className="nap-stackbig">{stackTaken}/{stackSlots.length}</span>}
                onClick={() => navigate('/fuel/stack')} aria-label="Stack" />
              {questTile(270)}
              {checkTile(310)}
            </Mosaic>
          </>
        )}

        {face === 'este' && (
          <>
            <div className="mz-tile nap-hero nap-dusk rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div className="nap-hero-row">
                <ClaySpot name="s-napzaras" size={58} />
                <div>
                  <span className="mz-eyebrow nap-lav">Villanyoltásig</span>
                  <div className="nap-hero-line">
                    <span className="nap-big">{fmtHm(bedInCount)}</span>
                    <span className="nap-mut">{sleepGoal.bedTime} lefekvés</span>
                  </div>
                </div>
              </div>
              <button type="button" className="cta nap-cta-lav" onClick={() => navigate('/ritual')}>
                Zárjuk le a napot
              </button>
            </div>
            <Mosaic>
              {habitTile('este', 70)}
              {questTile(110)}
              {checkTile(150)}
              {/* Éjszakai mód's Nap-side door. It died with `IslandEvening` when the Today view
                  layer went (mezo-d20.11): the Alvás page's row survived, but that row was
                  designed as the TWIN of a timed evening entry, not its replacement. Timed, as
                  it always was — inside the wind-down window (lights-out − 90 min), so it does
                  not sit on the mosaic all evening. */}
              {bedIn <= 90 && bedIn > 0 && (
                <Tile key="night" wash="lav" icon="i-alvas" eyebrow="Éjszakai mód" delayMs={190}
                  line={`indul ${sleepGoal.bedTime} előtt`}
                  onClick={() => navigate('/me/sleep/night')} aria-label="Éjszakai mód" />
              )}
            </Mosaic>
            {/* prototype: the este panel closes on the day's stat strip (kcal · edzés · XP).
                A statistic with no source renders `—`, never a fabricated zero. */}
            <div className="rise" style={{ '--d': '200ms' } as React.CSSProperties}>
              <StatStrip>
                <StatCell value={kcalEatenCount}
                  label={kcalEaten <= Math.round(fuel.targets.kcal) ? 'kcal · kereten belül ✓' : 'kcal · kereten túl'} />
                <StatCell value={today.workoutType ? `${today.workoutType}${workoutDone ? ' ✓' : ''}` : '—'}
                  label={workoutDoneSets != null ? `${workoutDoneSets} szett` : 'a mai edzés'} />
                <StatCell value={`+${xpCount}`} label="a mai termés" />
              </StatStrip>
            </div>
          </>
        )}
      </EntranceGroup>

      {focusOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
    </div>
  )
}
