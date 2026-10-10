import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCheckins, useDayEvaluation, useFuelDay, useRitualDay, normalizeDayEvaluation } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { doneCount, isNapzarasCardWindow } from '@/features/today/logic/napom'
import { Chips, Tank } from '@/shared/ui/folyadek'
import { huInt } from '@/shared/lib/huNum'
import { KIMELO_NAP } from '@/features/train/logic/skipCopy'

/** The evening state of Mai: `none` outside the 20:00 → midnight window AND while today's ritual is still
 *  loading (a pending ritual reads as "not closed" — nothing evening-specific may flash, mezo-yjzhw.7);
 *  `open` = napzárás still ahead; `closed` = the day is put down. */
export type NapzarasState = 'none' | 'open' | 'closed'
export function useNapzarasState(now: Date): NapzarasState {
  const ritual = useRitualDay(localDateString(now))
  if (!isNapzarasCardWindow(now, false) || ritual.isPending) return 'none'
  return ritual.data.closed ? 'closed' : 'open'
}

/** Evening napzárás hero on Mai (owner 2026-09-24, mezo-yjzhw.4; Folyadék prototype `vilagos/nap.js`
 *  `mai(…, evening)`): from 20:00 local time until midnight the page's tank turns to the evening liquid —
 *  „Tegyük le a napot." with the day's fact chips under it and „Napzárás indítása"; after closing it reads
 *  „Letetted a napot." and leads to A napom. Renders nothing outside the window or while the ritual loads.
 *  The level (the six életjel's average) is the page's; without it the vessel shows „…". */
export function NapzarasCard({ now, kimelo = false, level, onAir, airLabel }: {
  now: Date
  /** Kímélő mód is on (mezo-q4xt2.2): the gym chip reads „edzés · kímélő mód". */
  kimelo?: boolean
  level?: { pct: number; num: ReactNode }
  onAir?: () => void
  airLabel?: string
}) {
  const date = localDateString(now)
  const navigate = useNavigate()
  const state = useNapzarasState(now)
  const fuel = useFuelDay(date)
  const { checkins } = useCheckins()
  const evaluation = useDayEvaluation(date)
  if (state === 'none') return null
  const pct = level?.pct ?? 0
  const num = level?.num ?? '…'

  if (state === 'closed') {
    return (
      <Tank tone="dusk" height={420} pct={pct} num={num} cap="a 100-ból · a nap le van téve" label="Este · a nap lezárva"
        verdict="Letetted a napot." air="Hajnalban megírom, milyen napod volt." marks={[75, 50, 25]}
        cta="A napom" onCta={() => navigate('/nap/napom')} onAir={onAir} airLabel={airLabel} />
    )
  }

  const ev = evaluation.data ? normalizeDayEvaluation(evaluation.data) : null
  const trainingFact = ev?.dimensions.find((d) => d.id === 'training')?.facts.find((f) => f.label === 'edzés')?.value
  const doneCheckins = checkins.filter((c) => c.state === 'done').length
  const kcal = fuel.fuel.consumed?.kcal
  const chips: string[] = []
  if (kcal != null) chips.push(`${huInt(kcal)} kcal`)
  if (kimelo) chips.push(KIMELO_NAP.closeChip)
  else if (trainingFact) chips.push(`edzés ${trainingFact}`)
  chips.push(`check-in ${doneCheckins}/4`)
  if (ev) chips.push(`${doneCount(ev)}/6 terület kész`)

  return (
    <>
      <Tank tone="dusk" height={420} pct={pct} num={num} cap="a 100-ból · hat életjel átlaga" label="Este · napzárás"
        verdict="Tegyük le a napot." air="Amit megőriznél, és amit elengednél. Kb. 3 perc." marks={[75, 50, 25]}
        cta="Napzárás indítása" onCta={() => navigate('/ritual')} onAir={onAir} airLabel={airLabel} />
      <Chips className="nm-pad nm-zchips" items={chips} />
    </>
  )
}
