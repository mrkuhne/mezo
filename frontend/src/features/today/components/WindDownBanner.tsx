import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabitActions, useHabitDay, useSleepGoal } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import {
  fmtMinsToBed, minsToBed, windDownPhase,
} from '@/features/today/logic/windDown'
import { ItemCard } from '@/shared/ui/ItemCard'
import { localDateString } from '@/shared/lib/dates'

const TICK_MS = 30_000

/** The phase tips, flattened to plain `.metapill` strings (mezo-j7u4). */
const DIM_TIPS = ['💡 30 lux alá', '🔶 Meleg, sárga fény', '❄️ Hűtsd a szobát ~18 °C']
const WINDDOWN_TIPS = ['📵 Képernyők le', '🕯️ Fények tompítva']

/**
 * The Today evening/night band (slice C-éj, spec D2/D3): dim -> winddown -> night entry,
 * all derived from the sleep anchor. Carries the wind_down MANUAL habit's check in the
 * winddown phase — same ['habitDay', date] cache as RoutineCard, so the two stay in sync.
 *
 * dim/winddown wear the shared `ItemCard` (mezo-j7u4); the **night** row keeps its own
 * `.wdb-night` markup on purpose — it is a literal-dark night-layer surface (NightPage's
 * palette), not part of the light card language.
 */
export function WindDownBanner() {
  const date = localDateString()
  const { goal, isPending } = useSleepGoal()
  const { habits } = useHabitDay(date)
  const { check, pending } = useHabitActions(date)
  const { showLevelUp } = useLevelUp()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  if (isPending) return null // real mode before the goal resolves — no flash
  const phase = windDownPhase(now, goal)
  if (phase === 'none') return null

  if (phase === 'night') {
    return (
      <Link to="/me/sleep/night" className="wdb-night">
        <span className="wdb-night-moon" aria-hidden="true">🌙</span>
        <span className="wdb-night-tx">
          <span className="wdb-night-t1">Éjszakai mód</span>
          <span className="wdb-night-t2">Felébredtél? Ne nézd az órát — gyere ide.</span>
        </span>
        <span className="wdb-night-chev" aria-hidden="true">›</span>
      </Link>
    )
  }

  const pill = `🛏️ még ${fmtMinsToBed(minsToBed(now, goal.bedTime))}`
  const windDownHabit = habits.find((h) => h.key === 'wind_down')
  const doCheck = () => {
    check('wind_down').then((lu) => lu?.[0] && showLevelUp(lu[0]))
  }

  // The wind_down habit affordance belongs to the WINDDOWN phase only — in `dim` the habit's
  // own anchor ("screens off") has not come due yet, exactly as before the re-dress.
  const dim = phase === 'dim'
  const done = !dim && windDownHabit?.status === 'done'
  // `!pending` replaces the old `disabled={pending}` guard: ItemCard's CTA has no disabled
  // state, so an in-flight check withdraws the CTA instead of dimming it (no double submit).
  const checkable = !dim && !!windDownHabit && windDownHabit.status !== 'done' && !pending

  return (
    <ItemCard
      tone="mind"
      emoji={dim ? '🕯️' : '🌙'}
      tag="ESTI LEÁLLÁS"
      title={dim ? 'Tompítsd a fényeket' : 'Kapcsolj le'}
      stateLabel={pill}
      facts={dim ? DIM_TIPS : WINDDOWN_TIPS}
      logged={done}
      loggedSummary="Leállás megvolt"
      ctaLabel={checkable ? 'Pipa' : undefined}
      onLog={checkable ? doCheck : undefined}
    />
  )
}
