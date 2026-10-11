// ============================================================
// Mezo · EletjelPage — the six needs as six vessels (mezo-d20.2.6; Folyadék mezo-n4wf5.2,
// prototype vilagos/nap.js `eletjel()`).
// Hero = six vials (the level IS the need; only a need that asks for attention takes the warn
// colour and the „figyelj" mark) under a verdict sentence read from the BANDS; then the six
// needs one by one as rows with a level. Each vial and each row dispatches EXACTLY what
// TodayPage's onNeedCta does: Víz logs +2,5 dl in place, Étel/Alvás/Kapcsolat open the existing
// log sheets, Mozgás navigates to /train; Rend has no Today log surface (NeedRingSheet
// doctrine) so it is not interactive. Honest states: while the needs sim is pending NOTHING
// numeric renders — empty vials, dim rows, no fabricated percentages.
// `VITAL_TILE` stays the label / icon / aria source (EletjelStrip and NapMezoPage read it too).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'
import { localDateString } from '@/shared/lib/dates'
import { useCheckins, useSleep, useWaterActions } from '@/data/hooks'
import { NEED_ICON, type NeedKey } from '@/features/today/logic/needs'
import { needNameInSentence, needsAttention, needsAverage } from '@/features/today/logic/needsAverage'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { Btn, Card, FrameBack, Hero, Level, Note, Page, Row, Section, Vials, type VialItem } from '@/shared/ui/folyadek'

/** One need as the page speaks it: the label (Étel, Kapcsolat — the page's own words, not
 *  NEED_META's sheet names), the clay icon key from `NEED_ICON` (needs.ts, mezo-z4h4 — the SAME
 *  map the küszöb-nudge cards use, so the two surfaces can never drift apart), its Folyadék
 *  glyph, the aria label of its action, the row's quiet hint and the hero button of that action. */
export const VITAL_TILE: Record<NeedKey, {
  eyebrow: string; icon: ClayIconName; glyph: Icon3DName; aria: string; hint: string; cta: string | null
}> = {
  energia: { eyebrow: 'Étel', icon: NEED_ICON.energia, glyph: 't-bowl', aria: 'Étel logolása', hint: 'koppintás: étkezés logolása', cta: 'Étkezés rögzítése' },
  hidratacio: { eyebrow: 'Víz', icon: NEED_ICON.hidratacio, glyph: 't-water', aria: 'Víz +2,5 dl', hint: 'koppintás: +250 ml', cta: '+250 ml víz' },
  pihenes: { eyebrow: 'Alvás', icon: NEED_ICON.pihenes, glyph: 't-sleep', aria: 'Alvás logolása', hint: 'koppintás: alvás rögzítése', cta: 'Alvás rögzítése' },
  mozgas: { eyebrow: 'Mozgás', icon: NEED_ICON.mozgas, glyph: 't-dumbbell', aria: 'Mozgás — edzéshez', hint: 'koppintás: Edzés', cta: 'Edzés megnyitása' },
  lelek: { eyebrow: 'Kapcsolat', icon: NEED_ICON.lelek, glyph: 't-people', aria: 'Kapcsolat logolása', hint: 'koppintás: a következő check-in', cta: 'Check-in megnyitása' },
  rend: { eyebrow: 'Rend', icon: NEED_ICON.rend, glyph: 't-chain', aria: 'Rend', hint: 'magától töltődik a rutinból', cta: null },
}

/** The six needs in the page's fixed order — also the vessels drawn while the sim is pending. */
export const NEED_KEYS = Object.keys(VITAL_TILE) as NeedKey[]

export function EletjelPage() {
  const navigate = useNavigate()
  const date = localDateString()
  const tick = useMinuteTick()
  const needs = useNeeds(tick)
  const { logWater } = useWaterActions(date)
  const { logSleep } = useSleep()
  const { checkins, saveCheckIn } = useCheckins()

  const [mealOpen, setMealOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)

  const avg = needs.isPending ? null : needsAverage(needs.states)

  // The SAME dispatch TodayPage's onNeedCta performs — water in place, the rest
  // open/navigate; `rend` intentionally has no branch (no log surface today).
  const onTile = (key: NeedKey) => {
    if (key === 'energia') setMealOpen(true)
    else if (key === 'hidratacio') logWater(250)
    else if (key === 'pihenes') setSleepOpen(true)
    else if (key === 'mozgas') navigate('/train')
    else if (key === 'lelek') {
      const idx = checkins.findIndex(isFillableSlot)
      if (idx >= 0) setCheckInIdx(idx)
    }
  }

  const attention = needs.isPending ? [] : needs.states.filter(needsAttention)
  // The hero's one button: the action of the LOWEST need that asks for attention and HAS an
  // action — Rend has none (no log surface), Kapcsolat has none once every check-in slot is filled.
  const actionable = attention.filter((s) => VITAL_TILE[s.key].cta != null && (s.key !== 'lelek' || checkins.some(isFillableSlot)))
  const lowest = actionable.length > 0 ? actionable.reduce((a, b) => (b.pct < a.pct ? b : a)) : null
  const lowestCta = lowest ? VITAL_TILE[lowest.key].cta : null

  const verdict = needs.isPending
    ? 'A jelek betöltése folyamatban.'
    : attention.length === 1
      ? `Egy jel kér figyelmet: ${needNameInSentence(attention[0].key)}.`
      : attention.length > 1
        ? `${attention.length} jel kér figyelmet.`
        : 'Mind a hat jel rendben van.'

  const vials: VialItem[] = needs.isPending
    ? NEED_KEYS.map((key) => ({ label: VITAL_TILE[key].eyebrow, icon: VITAL_TILE[key].glyph, value: '–', pct: 0 }))
    : needs.states.map((s) => {
      const warn = needsAttention(s)
      return {
        label: VITAL_TILE[s.key].eyebrow, icon: VITAL_TILE[s.key].glyph, value: s.pct, pct: s.pct,
        color: warn ? 'var(--fo-warn)' : undefined, mark: warn ? 'figyelj' : undefined,
        onClick: s.key === 'rend' ? undefined : () => onTile(s.key),
      }
    })

  return (
    <Page className="nb-page">
      <FrameBack history className="fo-backpill" onBack={() => navigate(-1)}>‹ Ma</FrameBack>
      <Hero
          data-kalauz-anchor="eletjel-gyuru"
          label={avg == null ? 'A hat jel' : `A hat jel · átlag ${avg}`}
          verdict={verdict}
          sub={attention.length > 0 ? 'Egy rövid lépés már megmozdítja.' : undefined}
          actions={lowest && lowestCta ? <Btn onClick={() => onTile(lowest.key)}>{lowestCta}</Btn> : undefined}
        >
          <Vials size="xs" height={132} items={vials} />
      </Hero>
      <Section n={1} title="A hat jel egyenként" />
      <Card>
        {needs.isPending
          ? NEED_KEYS.map((key) => (
            <Row key={key} state="dim" icon={VITAL_TILE[key].glyph} title={VITAL_TILE[key].eyebrow} sub={VITAL_TILE[key].hint} />
          ))
          : needs.states.map((s) => {
            const meta = VITAL_TILE[s.key]
            return (
              <Row key={s.key} icon={meta.glyph} title={meta.eyebrow} sub={meta.hint} value={<>{s.pct}<small>%</small></>}
                more={<Level pct={s.pct} height={10} color={needsAttention(s) ? 'var(--fo-warn)' : undefined} />}
                onClick={s.key === 'rend' ? undefined : () => onTile(s.key)} aria-label={meta.aria} />
            )
          })}
        <Note>
          Színt csak az kap, ami figyelmet kér. A szintek nem büntetnek, csak jelzik, mi kér figyelmet. Koppints egy jelre a logolásához.
        </Note>
      </Card>

      {mealOpen && <LogFlowPage onClose={() => setMealOpen(false)} />}
      {sleepOpen && <SleepLogSheet onClose={() => setSleepOpen(false)} onSave={logSleep} />}
      {checkInIdx !== null && (
        <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)} onSave={(d) => saveCheckIn(checkInIdx, d)} />
      )}
    </Page>
  )
}
