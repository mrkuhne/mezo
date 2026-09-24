import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCheckins, useDayEvaluation, useFuelDay, useRitualDay, normalizeDayEvaluation } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { doneCount, isNapzarasCardWindow } from '@/features/today/logic/napom'
import { Icon3D } from '@/shared/ui/clay'

/** Evening napzárás card on Mai (owner 2026-09-24, mezo-yjzhw.4): from 20:00 local time until
 *  the ritual is closed (or the 05:00 morning boundary), a lavender glass card sits under the
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
  const chips: string[] = []
  if (kcal != null) chips.push(`${Math.round(kcal)} kcal`)
  if (trainingFact) chips.push(`edzés ${trainingFact}`)
  chips.push(`check-in ${doneCheckins}/4`)
  if (ev) chips.push(`${doneCount(ev)}/6 terület kész`)

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
        {chips.map((c) => <span key={c}>{c}</span>)}
      </div>
      <button type="button" className="nap-zgo" onClick={() => navigate('/ritual')}>
        <Icon3D name="t-moon" size={24} />
        Napzárás indítása
        <b aria-hidden="true">›</b>
      </button>
    </section>
  )
}
