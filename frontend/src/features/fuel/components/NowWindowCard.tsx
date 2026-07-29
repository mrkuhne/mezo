import type { HeroWindow } from '@/features/fuel/logic/heroWindow'
import type { FuelSlot } from '@/data/types'

// The Mai hero (mezo-rrtj) — the single decision the page asks for. Its content is a projection of
// buildDayPlan's own state (pickHeroWindow), so it can never disagree with the timeline below it.
export function NowWindowCard({
  hero,
  onLogMeal,
  onAiLog,
  onLogOther,
  onLogEmpty,
}: {
  hero: HeroWindow
  onLogMeal: (slot: FuelSlot) => void
  onAiLog: (slot: FuelSlot) => void
  onLogOther: (slot: FuelSlot) => void
  onLogEmpty: () => void
}) {
  if (hero.kind === 'closed') {
    return (
      <div className="nowcard closed">
        <div className="top">
          <span className="lbl"><span className="dot" /> nap lezárva</span>
        </div>
        <h2>{hero.consumedKcal} / {hero.targetKcal} kcal</h2>
        <div className="why">
          {hero.doneCount}/{hero.totalCount} ablak · fehérje {hero.proteinG}/{hero.proteinTargetG} g
        </div>
        <div className="ctas">
          <button type="button" className="primary" aria-label="Késői snack logolása" onClick={onLogEmpty}>
            Késői snack logolása
          </button>
        </div>
      </div>
    )
  }

  const { slot, suggestion, why, started } = hero
  const title = suggestion && slot.mealName ? slot.mealName : `${slot.label}-ablak`
  return (
    <div className="nowcard">
      <div className="top">
        <span className="lbl"><span className="dot" /> {started ? 'most nyitva' : 'következő'} · {slot.label}</span>
        <span className="clock">{started ? `${slot.time} óta` : `${slot.time}-kor`}</span>
      </div>
      <h2>{title}</h2>
      {why && <div className="why">{why}</div>}
      <div className="budget">
        {slot.kcal != null && <span className="bignum">{slot.kcal} <small>kcal</small></span>}
        {slot.p != null && <span className="mpill" style={{ color: 'var(--sage-deep)' }}>F {slot.p}</span>}
        {slot.c != null && <span className="mpill" style={{ color: 'var(--amber-deep)' }}>Sz {slot.c}</span>}
        {slot.f != null && <span className="mpill" style={{ color: 'var(--lav-deep)' }}>Zs {slot.f}</span>}
      </div>
      <div className="ctas">
        <button
          type="button" className="primary"
          aria-label={`${slot.label} logolása`}
          onClick={() => onLogMeal(slot)}
        >
          {suggestion ? 'Logolás' : 'Mit ettél?'}
        </button>
        <button
          type="button" className="alt"
          aria-label={`${slot.label} AI-logolása`}
          onClick={() => onAiLog(slot)}
        >
          ✨
        </button>
      </div>
      <div className="foot">
        <button
          type="button"
          aria-label={`Más ételt logolok az ${slot.label} ablakba`}
          onClick={() => onLogOther(slot)}
        >
          Más ételt logolok
        </button>
      </div>
    </div>
  )
}
