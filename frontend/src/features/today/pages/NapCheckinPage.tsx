// ============================================================
// Mezo · NapCheckinPage — Check-in day overview (mezo-d20.2.5)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html
// #page-check (p-rose tone, px ×1.18). The day's four slots as rows
// in ONE card: done slots carry their measured values as tinted
// mini-cells, the NEXT fillable slot is the hot row and opens the
// real CheckInSheet measurement flow from here — the sheet stays
// the flow, this page is the day overview. Data layer reused
// verbatim: useCheckins + isFillableSlot.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCheckins } from '@/data/hooks'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { MozaikPage, PageHead, PageHero, PageBody, MCells } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { CheckinSlot, CheckinValues } from '@/data/types'

/** The four canonical slots' daypart names (prototype #page-check rows). */
const SLOT_NAMES = ['Reggel', 'Délelőtt', 'Délután', 'Este'] as const

function valueCells(v: CheckinValues) {
  return [
    { label: 'Energia', value: v.energy, tone: 'coral' as const },
    { label: 'Stressz', value: v.stress, tone: 'amber' as const },
    { label: 'Testi', value: v.body, tone: 'rose' as const },
    { label: 'Mentális', value: v.mental, tone: 'sky' as const },
  ]
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
        <div key={i} className="nck-row">
          <span className="nck-tick f">✓</span>
          <div className="nck-grow">
            <div className="nck-t">{name} · {slot.time}</div>
            {slot.note && <div className="nck-sub">{slot.note}</div>}
            {slot.values && <MCells className="nck-cells" cells={valueCells(slot.values)} />}
          </div>
        </div>
      )
    }
    if (i === nextIdx) {
      return (
        <div key={i} className="nck-row nck-hot">
          <div className="nck-grow">
            <div className="nck-t nck-rose">
              {slot.state === 'now' ? `${name} · most esedékes` : `${name} · ${slot.time}`}
            </div>
            <div className="nck-sub">hogy vagy energiával?</div>
          </div>
          <button type="button" className="nck-fill" onClick={() => setFillIdx(i)}>
            Kitöltöm
          </button>
        </div>
      )
    }
    // future (or non-next missed) slot — muted, honest: no values, no affordance
    return (
      <div key={i} className="nck-row nck-dim">
        <span className="nck-tick" aria-hidden="true" />
        <div className="nck-grow">
          <div className="nck-t">{name} · {slot.time} körül</div>
          <div className="nck-sub">később esedékes</div>
        </div>
      </div>
    )
  }

  return (
    <MozaikPage tone="rose">
      <PageHead onBack={() => navigate(-1)} label="‹ Ma" />
      <PageHero icon="i-checkin" big={`${done}/${checkins.length}`} name="Check-in"
        sub="négy pillanatkép a napodról" />
      <PageBody principle="A kimaradt slot nem vész el — Pótold bármikor, a társ nem büntet.">
        <EntranceGroup>
          <div className="nck-card rise" style={{ '--d': '40ms' } as React.CSSProperties}>
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
