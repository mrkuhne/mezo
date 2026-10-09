// ============================================================
// Mezo · NapCheckinPage — Check-in day overview (mezo-d20.2.5; Check-in 2.0 mezo-ck2:
// answered cells, quick-exit tag, "N koppintás" hint — prototypes/elo/nap.html `checkin()`)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html
// #page-check (p-rose tone, px ×1.18). The day's four slots as rows
// in ONE card: done slots carry their measured values as tinted
// mini-cells, the NEXT fillable slot is the hot row and opens the
// real CheckInSheet measurement flow from here — the sheet stays
// the flow, this page is the day overview. Data layer reused
// verbatim: useCheckins + isFillableSlot.
// ÜVEG (mezo-me75u.3, prototypes/uveg-nap.html `checkin()`): a vissza-gomb kis üveg-pirula,
// a hős KERET NÉLKÜLI halo (3D check-in ikon + nagy szám), a négy slot EGY rózsa üvegkártya
// lapos sorai. A kész sor megvilágított pipája a 3D t-tick, a soron következő sor a kártyán
// BELÜL világít (nem üveg az üvegben), a jövőbeli sor szaggatott körrel halványul.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCheckInPlan, useCheckins } from '@/data/hooks'
import { planSteps } from '@/data/today/checkinPlan'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CHECKIN_LOOK, answerText, answeredItems } from '@/features/today/logic/checkinItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { localDateString } from '@/shared/lib/dates'
import type { CheckinSlot } from '@/data/types'
import { FrameBack } from '@/shared/ui/folyadek'

/** The four canonical slots' daypart names (prototype #page-check rows). */
const SLOT_NAMES = ['Reggel', 'Délelőtt', 'Délután', 'Este'] as const

/** Check-in 2.0 (mezo-ck2): every ANSWERED item of a done slot as a tinted mini-cell, in ask
 *  order, the row auto-filling (prototype `cells()` / `.mcells.n`). Skipped items show nothing. */
function AnswerCells({ slot }: { slot: CheckinSlot }) {
  const values = slot.values
  if (!values) return null
  const ids = answeredItems(values, slot.askedItems)
  if (ids.length === 0) return null
  return (
    <div className="mz-mcells nck-cells is-n">
      {ids.map((id) => {
        const d = answerText(id, values, true) ?? ''
        return (
          <span key={id} style={{ '--c': CHECKIN_LOOK[id].color } as CSSProperties}>
            <b className={d.length > 3 ? 'is-t' : undefined}>{d}</b>
            <small>{CHECKIN_LOOK[id].short}</small>
          </span>
        )
      })}
    </div>
  )
}

/** How many taps the slot's plan asks (its items + the question of the day); null until known. */
function usePlanCount(slotTime: string): number | null {
  const { plan } = useCheckInPlan(localDateString(), slotTime)
  return plan ? planSteps(plan).length : null
}

function HotHint({ slotTime }: { slotTime: string }) {
  const n = usePlanCount(slotTime)
  return <span className="nck-hint">{n != null ? `${n} koppintás · kb. fél perc` : 'kb. fél perc'}</span>
}

function LaterSub({ slotTime }: { slotTime: string }) {
  const n = usePlanCount(slotTime)
  return <div className="nck-sub">később esedékes{n != null ? ` · ${n} kérdés` : ''}</div>
}

export function NapCheckinPage() {
  const navigate = useNavigate()
  const { checkins, saveCheckIn } = useCheckins()
  const [fillIdx, setFillIdx] = useState<number | null>(null)

  const done = checkins.filter((c) => c.state === 'done').length
  const nextIdx = checkins.findIndex(isFillableSlot)

  const slotRow = (slot: CheckinSlot, i: number) => {
    const name = SLOT_NAMES[i] ?? slot.time
    if (slot.state === 'done') {
      return (
        <div key={i} className="nck-row" data-kalauz-anchor={i === 0 ? 'checkin-sor' : undefined}>
          <span className="nck-tick f" role="img" aria-label="kész"><Icon3D name="t-tick" size={30} /></span>
          <div className="nck-grow">
            <div className="nck-t">{name} · {slot.time}</div>
            {slot.note && <div className="nck-sub">{slot.note}</div>}
            {slot.quickExit && <span className="nck-tag">Most csak ennyi · az alap megvan</span>}
            <AnswerCells slot={slot} />
          </div>
        </div>
      )
    }
    if (i === nextIdx) {
      return (
        <div key={i} className="nck-row nck-hot" data-kalauz-anchor={i === 0 ? 'checkin-sor' : undefined}>
          <span className="nck-tick" aria-hidden="true" />
          <div className="nck-grow">
            <div className="nck-t nck-rose">
              {slot.state === 'now' ? `${name} · most esedékes` : `${name} · ${slot.time}`}
            </div>
            <div className="nck-sub">hogy vagy most?</div>
            <HotHint slotTime={slot.time} />
          </div>
          <button type="button" className="nck-fill" onClick={() => setFillIdx(i)}>
            Kitöltöm
          </button>
        </div>
      )
    }
    // future (or non-next missed) slot — muted, honest: no values, no affordance
    return (
      <div key={i} className="nck-row nck-dim" data-kalauz-anchor={i === 0 ? 'checkin-sor' : undefined}>
        <span className="nck-tick is-dash" aria-hidden="true" />
        <div className="nck-grow">
          <div className="nck-t">{name} · {slot.time} körül</div>
          <LaterSub slotTime={slot.time} />
        </div>
      </div>
    )
  }

  return (
    <MozaikPage tone="rose" className="nap-oldal nck-page">
      <div className="mz-page-head nap-backrow">
        <FrameBack className="mz-backbtn glass nap-back" onBack={() => navigate(-1)}>
          <b aria-hidden="true">‹</b> Ma
        </FrameBack>
      </div>
      <section className="nap-hero uv-halo" style={{ '--c': 'var(--dv-rose)', '--c2': 'var(--dv-lav)' } as React.CSSProperties}>
        <Icon3D name="t-checkin" size={86} className="nap-hero-art uv-float" />
        <div className="nap-hero-num">{done}<small>/{checkins.length}</small></div>
        <div className="nap-hero-nm">Check-in</div>
        <div className="nap-hero-sb">négy pillanatkép a napodról</div>
      </section>
      <PageBody principle="A kimaradt slot nem vész el — Pótold bármikor, a társ nem büntet.">
        <EntranceGroup>
          <div className="nck-card glass rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            {checkins.map(slotRow)}
          </div>
        </EntranceGroup>
      </PageBody>
      {fillIdx !== null && (
        <CheckInSheet slot={checkins[fillIdx]} slotIdx={fillIdx}
          onClose={() => setFillIdx(null)} onSave={(d) => saveCheckIn(fillIdx, d)} />
      )}
    </MozaikPage>
  )
}
