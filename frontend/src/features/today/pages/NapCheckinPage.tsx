// ============================================================
// Mezo · NapCheckinPage — Check-in day overview (mezo-d20.2.5; Check-in 2.0 mezo-ck2:
// answered cells, quick-exit line, "N koppintás" hint).
// The day's four slots: done slots carry their answers, the NEXT fillable slot is the current
// one and opens the real CheckInSheet measurement flow from here — the sheet stays the flow, this
// page is the day overview. Data layer reused verbatim: useCheckins + isFillableSlot.
// FOLYADÉK (mezo-n4wf5.2, prototypes/vilagos/nap.js `checkin()`): the hero is the day's four
// vials (a done one filled to answered / asked, in the ok colour); below, ONE card with the four
// slot rows — a done row shows every answer as a small capsule filled to its value on the
// 10 scale (pain in the warn colour).
// ============================================================
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCheckInPlan, useCheckins } from '@/data/hooks'
import { planSteps } from '@/data/today/checkinPlan'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CHECKIN_LOOK, answerText, answeredItems } from '@/features/today/logic/checkinItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { answerLevel, answerTone } from '@/features/today/sheets/checkin/answerLevel'
import { localDateString } from '@/shared/lib/dates'
import type { CheckinSlot } from '@/data/types'
import { Btn, Card, FrameBack, Hero, Mini, Note, Page, Section, St, Vials, type VialItem } from '@/shared/ui/folyadek'

/** The four canonical slots' daypart names, and the adjective the verdict uses („A délutáni…"). */
const SLOT_NAMES = ['Reggel', 'Délelőtt', 'Délután', 'Este'] as const
const SLOT_ADJ = ['reggeli', 'délelőtti', 'délutáni', 'esti'] as const

/** Check-in 2.0 (mezo-ck2): every ANSWERED item of a done slot as a capsule, in ask order
 *  (prototype `cells()`). Skipped items show nothing. */
function AnswerCells({ slot }: { slot: CheckinSlot }) {
  const values = slot.values
  if (!values) return null
  const ids = answeredItems(values, slot.askedItems)
  if (ids.length === 0) return null
  return (
    <div className="nck2-cells">
      {ids.map((id) => (
        <Mini key={id} pct={answerLevel(id, values)} color={answerTone(id, values)}
          value={answerText(id, values, true) ?? ''} label={CHECKIN_LOOK[id].short} />
      ))}
    </div>
  )
}

/** How many taps the slot's plan asks (its items + the question of the day); null until known. */
function usePlanCount(slotTime: string): number | null {
  const { plan } = useCheckInPlan(localDateString(), slotTime)
  return plan ? planSteps(plan).length : null
}

/** The plan size of EVERY slot of the day, handed to `children` in slot order. One component per
 *  slot calls the hook, so a day with any number of slots keeps the hook order stable. */
function PlanCounts({ times, acc = [], children }: {
  times: string[]; acc?: (number | null)[]; children: (counts: (number | null)[]) => ReactNode
}) {
  if (times.length === 0) return <>{children(acc)}</>
  return <PlanCountStep times={times} acc={acc}>{children}</PlanCountStep>
}
function PlanCountStep({ times, acc, children }: {
  times: string[]; acc: (number | null)[]; children: (counts: (number | null)[]) => ReactNode
}) {
  const n = usePlanCount(times[0])
  return <PlanCounts times={times.slice(1)} acc={[...acc, n]}>{children}</PlanCounts>
}

export function NapCheckinPage() {
  const navigate = useNavigate()
  const { checkins, saveCheckIn } = useCheckins()
  const [fillIdx, setFillIdx] = useState<number | null>(null)

  const nextIdx = checkins.findIndex(isFillableSlot)
  const cur = nextIdx >= 0 ? checkins[nextIdx] : null
  const nameOf = (slot: CheckinSlot, i: number) => SLOT_NAMES[i] ?? slot.time

  const body = (counts: (number | null)[]) => {
    const curN = nextIdx >= 0 ? counts[nextIdx] : null

    const vials: VialItem[] = checkins.map((slot, i) => {
      const base = { label: nameOf(slot, i), note: slot.time }
      if (slot.state === 'done') {
        const k = slot.values ? answeredItems(slot.values, slot.askedItems).length : 0
        const n = counts[i] ?? slot.askedItems?.length ?? k
        return { ...base, pct: n > 0 ? Math.round((k / n) * 100) : 0, value: `${k}/${n}`, mark: 'kész', color: 'var(--fo-ok)', icon: 't-tick' }
      }
      if (i === nextIdx) {
        return { ...base, pct: 5, value: 'most', mark: slot.state === 'now' ? 'esedékes' : 'jön', icon: 't-checkin', onClick: () => setFillIdx(i) }
      }
      return { ...base, pct: 0, value: '–', mark: 'később', icon: 't-clock' }
    })

    const verdict = cur
      ? cur.state === 'now'
        ? `A ${SLOT_ADJ[nextIdx] ?? `${cur.time}-s`} most esedékes. Fél perc.`
        : `A következő: ${nameOf(cur, nextIdx).toLowerCase()}, ${cur.time}. Fél perc.`
      : 'Mind a négy megvan mára.'
    const sub = cur
      ? `${curN != null ? `${curN} koppintás. ` : ''}Öt alapkérdés után bármikor kiléphetsz.`
      : 'A válaszaid beépülnek a holnapi napodba.'

    const slotRow = (slot: CheckinSlot, i: number) => {
      const name = nameOf(slot, i)
      const n = counts[i]
      const isDone = slot.state === 'done'
      const isCur = i === nextIdx
      const title = isCur ? `${name} · ${slot.state === 'now' ? 'most esedékes' : 'következik'}` : name
      const subLine = isDone
        ? [slot.note, slot.quickExit ? 'Most csak ennyi · az alap megvan' : null].filter(Boolean).join(' · ') || 'Kitöltve'
        : isCur
          ? `hogy vagy most? · ${n != null ? `${n} koppintás, ` : ''}kb. fél perc`
          : `később esedékes${n != null ? ` · ${n} kérdés` : ''}`
      return (
        <div key={i} className={`nck2-slot${isCur ? ' now' : ''}${!isDone && !isCur ? ' later' : ''}`}
          data-kalauz-anchor={i === 0 ? 'checkin-sor' : undefined}>
          <div className="nck2-slh">
            <time>{slot.time}</time>
            <span className="g"><strong>{title}</strong><small>{subLine}</small></span>
            {isDone
              ? <St tone="ok">Kész</St>
              : isCur
                ? <Btn sm onClick={() => setFillIdx(i)}>Kitöltöm</Btn>
                // future (or non-next missed) slot — muted, honest: no values, no affordance
                : <St>Később</St>}
          </div>
          {isDone && <AnswerCells slot={slot} />}
        </div>
      )
    }

    return (
      <>
        <Hero label="A nap négy pillanata" verdict={verdict} sub={sub}
          actions={cur
            ? <Btn onClick={() => setFillIdx(nextIdx)}>Kitöltöm</Btn>
            : <Btn onClick={() => navigate('/nap')}>Vissza a mai napra</Btn>}>
          <Vials size="sm" height={118} items={vials} />
        </Hero>
        <Section n={1} title="Mai pillanatképek" />
        <Card>
          {checkins.map(slotRow)}
          <Note>
            Egy kapszula egy válasz: a szint a 10-es skálán adott érték. A kimaradt check-in nem vész el: pótold bármikor, a társ nem büntet.
          </Note>
        </Card>
      </>
    )
  }

  return (
    <Page className="nck2-page">
      <FrameBack history className="fo-ib fo-back nck2-back" onBack={() => navigate(-1)}>‹</FrameBack>
      <PlanCounts times={checkins.map((c) => c.time)}>{body}</PlanCounts>
      {fillIdx !== null && (
        <CheckInSheet slot={checkins[fillIdx]} slotIdx={fillIdx}
          onClose={() => setFillIdx(null)} onSave={(d) => saveCheckIn(fillIdx, d)} />
      )}
    </Page>
  )
}
