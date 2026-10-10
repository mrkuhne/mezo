import { useCheckins, useIntentionActions, useIntentionDay } from '@/data/hooks'
import type { Reflection } from '@/data/types'
import { openLoops } from '@/features/ritual/logic/openLoops'
import { localDateString } from '@/shared/lib/dates'
import { Btn, Card, Hero, Mark, Pill, Pills, Row, Section, Vials, type VialItem } from '@/shared/ui/folyadek'
import { RitualFoot } from '@/features/ritual/components/RitualFoot'

const REFLECT_LABEL: Record<Reflection, string> = { yes: 'Igen', partial: 'Részben', no: 'Nem' }
const COUNT_HU = ['', 'Egy', 'Két', 'Három']

/**
 * Napzárás act 4 — Nyitott hurkok (mezo-ilsj, spec §4; Folyadék mezo-n4wf5.2, prototype
 * `napzaras.4`). Soft close-out of the day's two GATED loops (missed check-in, intention
 * reflection) plus a standing "log anything else" journal invite. Nothing here is mandatory —
 * Tovább always advances regardless of state.
 *
 * The hero shows one vial per loop that exists (the check-ins' share, the intention answered or
 * not, the journal's standing „+"); the card under it carries the same loops as rows with their
 * actions. With nothing open the verdict itself is the „Minden hurok zárva" beat and only the
 * evergreen journal row remains.
 *
 * The reused sheets (CheckInSheet, ActivityLogSheet) live one level up on RitualPage, not here —
 * this step only SIGNALS via onOpenCheckIn/onOpenJournal; RitualPage owns the sheet open/close
 * state and the next-open-slot index math (its own parallel `useCheckins` + the same findIndex
 * predicate).
 *
 * The reflect row is INLINE rather than a sheet: the three Igen/Részben/Nem pills call
 * `useIntentionActions(date).reflect` directly, collapsing to a ticked line once `reflection` is
 * set. It only renders at all when the day HAS a focus — with none, there is nothing to reflect on
 * (openLoops.ts).
 *
 * The journal row is deliberately EVERGREEN — no closed state, never highlighted, and excluded from
 * `openLoops` — "did anything else happen today" is always askable, unlike the two scheduled
 * loops above (and mock-mode's `useActivities` seed is date-invariant, so gating the invite on
 * "already logged today" would make it permanently vanish in mock mode).
 */
export function LoopsStep({ onNext, onOpenCheckIn, onOpenJournal }: {
  onNext: () => void
  onOpenCheckIn: () => void
  onOpenJournal: () => void
}) {
  const date = localDateString()
  const { checkins } = useCheckins()
  const { data: intention } = useIntentionDay(date)
  const { reflect } = useIntentionActions(date)

  const { checkinOpen, reflectOpen } = openLoops({ checkins, intention })
  const hasFoci = intention.foci.length > 0
  const nothingOpen = !checkinOpen && !reflectOpen
  const checkinsDone = checkins.filter((c) => c.state === 'done').length
  const nextSlot = checkins.find((c) => c.state === 'now' || c.state === 'pending')
  // The highlight only ever lands on one of the two GATED loops (never journal — see doc comment).
  const firstOpen = checkinOpen ? 'checkin' : reflectOpen ? 'reflect' : null
  const focusText = intention.foci.map((f) => f.text).join(' · ')

  const vials: VialItem[] = [
    {
      label: 'Check-in', icon: 't-checkin', value: `${checkinsDone}/${checkins.length}`,
      pct: checkins.length > 0 ? (checkinsDone / checkins.length) * 100 : 0,
      note: `${checkinsDone} / ${checkins.length} kész`,
      mark: checkinOpen ? 'nyitva' : undefined,
      onClick: checkinOpen ? onOpenCheckIn : undefined,
    },
    ...(hasFoci ? [{
      label: 'Szándék', icon: 't-ring' as const, value: intention.reflection ? REFLECT_LABEL[intention.reflection] : '?',
      pct: reflectOpen ? 0 : 100, note: focusText, mark: reflectOpen ? 'nyitva' : undefined,
    }] : []),
    { label: 'Napló', icon: 't-journal', value: '+', pct: 0, note: 'egy apró lépés', onClick: onOpenJournal },
  ]
  const rowCount = nothingOpen ? 1 : hasFoci ? 3 : 2

  return (
    <>
      <Hero
        label="Nyitott hurkok"
        verdict={nothingOpen ? 'Minden hurok zárva' : 'Zárd le, ami még nyitva.'}
        sub={nothingOpen ? 'Elengedheted a napot.' : 'Aztán elengedheted.'}
      >
        <Vials size="sm" height={92} items={vials} />
      </Hero>

      <Section n={1} title={`${COUNT_HU[rowCount]} apróság`} />
      <Card>
        {!nothingOpen && (
          checkinOpen ? (
            <Row as="div" icon="t-checkin" state={firstOpen === 'checkin' ? 'now' : undefined}
              title={`${nextSlot?.time} check-in kimaradt`}
              sub={`${checkinsDone} / ${checkins.length} check-in kész`}
              right={<Btn sm onClick={onOpenCheckIn}>Kitöltöm</Btn>} />
          ) : (
            <Row as="div" state="done" left={<Mark state="done" />}
              title={`${checkinsDone}/${checkins.length} check-in kész`} />
          )
        )}

        {!nothingOpen && hasFoci && (
          reflectOpen ? (
            <Row as="div" icon="t-ring" state={firstOpen === 'reflect' ? 'now' : undefined}
              title="Szándékkal élted a napot?"
              sub={<>a mai szándékod: „{focusText}”</>}
              more={(
                <Pills className="nrz-inacts">
                  {(['yes', 'partial', 'no'] as Reflection[]).map((v) => (
                    <Pill key={v} onClick={() => reflect(v)}>{REFLECT_LABEL[v]}</Pill>
                  ))}
                </Pills>
              )} />
          ) : (
            <Row as="div" state="done" left={<Mark state="done" />} title="A mai szándékodra reflektáltál." />
          )
        )}

        <Row as="div" icon="t-journal" title="Történt még valami ma?" sub="egy apró lépés is számít"
          right={<Btn sm ghost onClick={onOpenJournal}>Napló</Btn>} />
      </Card>

      <RitualFoot><Btn grow onClick={onNext}>Tovább</Btn></RitualFoot>
    </>
  )
}
