import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCheckins, useDayEvaluation, useFuelDay, useRitualDay, normalizeDayEvaluation } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { doneCount, isNapzarasCardWindow } from '@/features/today/logic/napom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { huInt } from '@/shared/lib/huNum'

/** Evening napzárás card on Mai (owner 2026-09-24, mezo-yjzhw.4): from 20:00 local time until
 *  midnight, unless the ritual is closed, a lavender glass card sits under the
 *  "A napod." heading. After closing it shrinks to a flat done row linking to A napom.
 *  Reference: docs/design_2.0/prototypes/src/uveg-napod-body.html `closeCard()`. */
export function NapzarasCard({ now }: { now: Date }) {
  const date = localDateString(now)
  const navigate = useNavigate()
  const ritual = useRitualDay(date)
  const fuel = useFuelDay(date)
  const { checkins } = useCheckins()
  const evaluation = useDayEvaluation(date)
  const inWindow = isNapzarasCardWindow(now, false)
  if (!inWindow) return null

  if (ritual.data.closed) {
    return (
      <div className="nap-zdone uv-flat rise">
        <Icon3D name="t-moon" size={36} />
        <span>
          <strong>Letetted a napot</strong>
          <small>Hajnalban megírom, milyen napod volt.</small>
        </span>
        <Link to="/nap/napom">A napom ›</Link>
      </div>
    )
  }

  const ev = evaluation.data ? normalizeDayEvaluation(evaluation.data) : null
  const trainingFact = ev?.dimensions.find((d) => d.id === 'training')?.facts.find((f) => f.label === 'edzés')?.value
  const doneCheckins = checkins.filter((c) => c.state === 'done').length
  const kcal = fuel.fuel.consumed?.kcal
  // Leading flat icons as the prototype's `closeCard()` chips: bowl · dumbbell · check-in.
  const chips: { text: string; icon?: Icon3DName }[] = []
  if (kcal != null) chips.push({ text: `${huInt(kcal)} kcal`, icon: 't-bowl' })
  if (trainingFact) chips.push({ text: `edzés ${trainingFact}`, icon: 't-dumbbell' })
  chips.push({ text: `check-in ${doneCheckins}/4`, icon: 't-checkin' })
  if (ev) chips.push({ text: `${doneCount(ev)}/6 terület kész` })

  return (
    <section className="nap-zcard glass rise" style={{ '--c': 'var(--dv-lav)' } as CSSProperties}>
      <div className="nap-zhalo" aria-hidden="true" />
      <div className="nap-ztop">
        <Icon3D name="t-moon" size={64} className="nap-zart" />
        <span>
          <span className="nap-zeb">ESTE · NAPZÁRÁS</span>
          <strong>Tegyük le a napot.</strong>
          <small>Amit megőriznél, és amit elengednél. Kb. 3 perc.</small>
        </span>
      </div>
      <div className="nap-zchips">
        {chips.map((c) => (
          <span key={c.text}>
            {c.icon && <Icon3D name={c.icon} size={16} />}
            {c.text}
          </span>
        ))}
      </div>
      <button type="button" className="nap-zgo" onClick={() => navigate('/ritual')}>
        <Icon3D name="t-moon" size={24} />
        Napzárás indítása
        <b aria-hidden="true">›</b>
      </button>
    </section>
  )
}
