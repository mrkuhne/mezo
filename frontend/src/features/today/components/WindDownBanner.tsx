import { Link } from 'react-router-dom'
import { useHabitActions, useHabitDay } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { fmtMinsToBed, minsToBed } from '@/features/today/logic/windDown'
import { useWindDownPhase } from '@/features/today/logic/useWindDownPhase'
import { ItemCard } from '@/shared/ui/ItemCard'
import { ItemRow } from '@/shared/ui/ItemRow'
import { localDateString } from '@/shared/lib/dates'

/**
 * The Today evening/night band (slice C-éj, spec D2/D3): dim -> winddown -> night entry,
 * all derived from the sleep anchor. Carries the wind_down MANUAL habit's check in the
 * winddown phase — same ['habitDay', date] cache as RoutineCard, so the two stay in sync.
 *
 * dim/winddown wear the shared `ItemCard` (mezo-j7u4) and keep their full prose in its
 * `children` slot: the advice lines with their explanatory halves, the Walker provenance
 * line, and the habit's own row (title + anchor cue + XP) as a shared `ItemRow`. The
 * **night** row keeps its own `.wdb-night` markup on purpose — it is a literal-dark
 * night-layer surface (NightPage's palette, also worn by SleepPage), not part of the light
 * card language.
 *
 * The phase (and its 30 s tick) comes from `useWindDownPhase` — the SAME hook `FaceEvening`
 * uses to know when this card owns the `wind_down` habit's row, so the habit can never be
 * offered here AND as a TodoCard row at once (mezo-mvb4.1).
 */
export function WindDownBanner() {
  const date = localDateString()
  const { phase, now, goal } = useWindDownPhase()
  const { habits } = useHabitDay(date)
  const { check, pending } = useHabitActions(date)
  const { showLevelUp } = useLevelUp()

  if (phase === null) return null // real mode before the goal resolves — no flash
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
  // `!pending` replaces the old `disabled={pending}` guard: `ItemRow`'s action pill has no
  // disabled state, so an in-flight check withdraws the pill instead of dimming it.
  const checkable = !dim && !!windDownHabit && windDownHabit.status !== 'done' && !pending

  return (
    <ItemCard
      tone="mind"
      emoji={dim ? '🕯️' : '🌙'}
      tag="ESTI LEÁLLÁS"
      title={dim ? 'Tompítsd a fényeket' : 'Kapcsolj le'}
      stateLabel={pill}
      facts={[]}
      logged={done}
      loggedSummary="Leállás megvolt"
      loggedDetail="már csak az ágy van hátra"
    >
      <div className="todaycard-tips">
        {dim ? (
          <>
            <div className="todaycard-tip"><span className="todaycard-tip-ic" aria-hidden="true">💡</span><span><b>30 lux alá</b> — félhomály, nem sötét</span></div>
            <div className="todaycard-tip"><span className="todaycard-tip-ic" aria-hidden="true">🔶</span><span><b>Meleg, sárga fény</b> — hideg-fehér le</span></div>
            <div className="todaycard-tip"><span className="todaycard-tip-ic" aria-hidden="true">❄️</span><span><b>Hűtsd a szobát</b> — 18 °C felé</span></div>
          </>
        ) : (
          <>
            <div className="todaycard-tip"><span className="todaycard-tip-ic" aria-hidden="true">📵</span><span><b>Képernyők le</b> — az agy hadd unatkozzon</span></div>
            <div className="todaycard-tip"><span className="todaycard-tip-ic" aria-hidden="true">🕯️</span><span><b>Fények tompítva</b> maradnak</span></div>
          </>
        )}
      </div>

      {dim && (
        <div className="todaycard-note">A tompított, meleg este <b>+18% REM</b>-et ad — Walker mérése.</div>
      )}

      {/* The habit keeps its own identity — title, anchor cue and reward — as a shared row
          (the FaceHeroCard precedent for a habit's `+N XP` inside a row subtitle). Once done
          the DoneBar carries the closing line instead. */}
      {!dim && windDownHabit && !done && (
        <div className="todaycard-rows">
          <ItemRow
            tone="mind"
            emoji="🌙"
            title={windDownHabit.title}
            subtitle={[windDownHabit.anchorCopy, windDownHabit.xp ? `+${windDownHabit.xp} XP` : null]
              .filter(Boolean).join(' · ')}
            actionLabel={checkable ? 'Pipa' : undefined}
            onAction={checkable ? doCheck : undefined}
          />
        </div>
      )}
    </ItemCard>
  )
}
