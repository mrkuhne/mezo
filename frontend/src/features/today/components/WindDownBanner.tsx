import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabitActions, useHabitDay, useSleepGoal } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import {
  fmtMinsToBed, minsToBed, windDownPhase,
} from '@/features/today/logic/windDown'
import { localDateString } from '@/shared/lib/dates'

const TICK_MS = 30_000

/**
 * The Today evening/night band (slice C-éj, spec D2/D3): dim -> winddown -> night entry,
 * all derived from the sleep anchor. Carries the wind_down MANUAL habit's check in the
 * winddown phase — same ['habitDay', date] cache as RoutineCard, so the two stay in sync.
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

  if (phase === 'dim') {
    return (
      <section className="wdb" aria-label="Esti ráhangolódás">
        <div className="wdb-hd">
          <span aria-hidden="true">🕯️</span>
          <span className="wdb-eye">Esti ráhangolódás</span>
          <span className="wdb-pill">{pill}</span>
        </div>
        <div className="wdb-title">Tompítsd a fényeket</div>
        <div className="wdb-list">
          <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">💡</span><span><b>30 lux alá</b> — félhomály, nem sötét</span></div>
          <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">🔶</span><span><b>Meleg, sárga fény</b> — hideg-fehér le</span></div>
          <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">❄️</span><span><b>Hűtsd a szobát</b> — 18 °C felé</span></div>
        </div>
        <div className="wdb-foot">
          <div className="wdb-stat">A tompított, meleg este <b>+18% REM</b>-et ad — Walker mérése.</div>
        </div>
      </section>
    )
  }

  // winddown phase
  const doCheck = () => {
    check('wind_down').then((lu) => lu?.[0] && showLevelUp(lu[0]))
  }
  return (
    <section className="wdb" aria-label="Esti leállás">
      <div className="wdb-hd">
        <span aria-hidden="true">🌙</span>
        <span className="wdb-eye">Esti leállás</span>
        <span className="wdb-pill">{pill}</span>
      </div>
      <div className="wdb-title">Kapcsolj le</div>
      <div className="wdb-list">
        <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">📵</span><span><b>Képernyők le</b> — az agy hadd unatkozzon</span></div>
        <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">🕯️</span><span><b>Fények tompítva</b> maradnak</span></div>
      </div>
      {windDownHabit && (
        <div className="wdb-foot">
          {windDownHabit.status === 'done' ? (
            <div className="wdb-done">✓ Leállás megvolt — már csak az ágy van hátra.</div>
          ) : (
            <div className="wdb-hab">
              <div className="wdb-hab-tx">
                <div className="wdb-hab-t1">{windDownHabit.title}</div>
                <div className="wdb-hab-t2">{windDownHabit.anchorCopy}</div>
              </div>
              <span className="wdb-hab-xp">+{windDownHabit.xp} XP</span>
              <button className="wdb-pipa" disabled={pending}
                aria-label={`${windDownHabit.title} pipálása`} onClick={doCheck}>
                Pipa
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
