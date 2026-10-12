// ============================================================
// Mezo · FuelStackProtocolPage — the Protokoll's OWN page (S2 manifest D2 view · D3 edit · D4 meal bindings;
// Folyadék F5, mezo-n4wf5.5). Prototype: docs/design_2.0/prototypes/vilagos/fuel.js `protokoll()`
// (states: protokoll · .kotesnelkul · .figyelj · .tolt · .hiba · .ures).
//
// Top to bottom: the hero (one vial per time slot — its level is how many items sit there — three facts, a verdict on
// who placed what, „Új elem beállítása" on the liquid) → „Idősávok": one card per slot with its items (dose · manual /
// automatic · the engine's stored reason) → „Étkezéshez": the meal match rows (D4) → the boundary line.
//
// D3: tapping a row opens the existing `StackItemSheet` — dose, moving, „+ még egy bevétel", unpin and removal are
// unchanged; every change saves at once (no common Save).
// D7: `ProtocolViewResponse.history[]` stays in state but has NO surface.
// Honest null: no reason from the engine → none is written. A load error is an honest error face (without a retry), not
// an empty list.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFuelDay, useProtocol, useRecipes, useStackDay } from '@/data/hooks'
import { addDays, localDateString } from '@/shared/lib/dates'
import { useM } from '@/shared/i18n'
import type { Icon3DName } from '@/shared/ui/clay'
import { Btn, Card, Facts, Head, Hero, Note, Row, Section, Txt, Vials } from '@/shared/ui/folyadek'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { StackMealMatch } from '@/features/fuel/components/StackMealMatch'
import { StackCaps } from '@/features/fuel/pages/FuelStackPage'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'
import type { StackZoneKey } from '@/data/types'

/** The glyph of each zone. */
const ZONE_ICON: Partial<Record<StackZoneKey, Icon3DName>> = {
  wake: 't-dawn', breakfast: 't-sun', pre_workout: 't-dumbbell', post_workout: 't-dumbbell',
  lunch: 't-bowl', dinner: 't-moon', evening: 't-moon', bedtime: 't-sleep',
}
const FALLBACK_ICON: Icon3DName = 't-supps'

export function FuelStackProtocolPage() {
  const navigate = useNavigate()
  const M = useM().fuelKieg
  const { protocol, pending, error } = useProtocol()
  const { slots } = useStackDay()
  const { recipes } = useRecipes()
  const today = localDateString()
  const { fuel: todayFuel } = useFuelDay(today)
  const { fuel: yesterdayFuel } = useFuelDay(addDays(today, -1))
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)

  const ready = !pending && !error && protocol.status !== 'none'
  const rows = slots.flatMap(slot => slot.entries)
  const pinnedCount = rows.filter(entry => entry.pinned).length
  const mealMatch = matchMealsToStack(slots, recipes, todayFuel.meals, yesterdayFuel.meals)
  const mealMatchCount = mealMatch.suggestions.length + mealMatch.verdicts.length
  const addNew = () => navigate('/fuel/stack/manage/add')
  const off = pending || error || rows.length === 0
  const empty = !pending && !error && rows.length === 0
  const most = Math.max(1, ...slots.map(slot => slot.entries.length))

  return (
    <StackPageScaffold backTo="/fuel/stack" name={M.protocol.title} eyebrow={M.common.supplements}>
      {off ? (
        <>
          <Hero className="fk-ghero" label={M.protocol.label}
            verdict={pending ? M.protocol.loading : error ? M.protocol.error : M.protocol.empty}
            actions={empty ? <Btn onClick={addNew}>{M.common.setUpNew}</Btn> : undefined}>
            <div className="fk-g"><StackCaps bands={[]} /></div>
          </Hero>
          <Card>
            {!empty && <Row icon="t-gear" title={M.common.setUpNew} sub={M.common.setUpNewSub} onClick={addNew} />}
            <Note>{M.common.noteDoctor}</Note>
          </Card>
        </>
      ) : (
        <>
          <Hero className="fk-ghero" label={M.protocol.labelSlots(slots.length)}
            verdict={pinnedCount === 0 ? M.protocol.verdictNone
              : pinnedCount === rows.length ? M.protocol.verdictAll
                : pinnedCount === 1 ? M.protocol.verdictOne : M.protocol.verdictSome(pinnedCount)}
            sub={ready ? M.protocol.sub(protocol.version, Math.round(protocol.confidence * 100)) : M.protocol.subPlain}
            actions={<Btn onClick={addNew}>{M.common.setUpNew}</Btn>}>
            <div className="fk-g">
            <div className="fk-zv" role="img" aria-label={M.protocol.vialsAria}>
              <Vials size="sm" height={96} items={slots.map(slot => ({
                label: slot.label, icon: ZONE_ICON[slot.zone] ?? FALLBACK_ICON,
                pct: (slot.entries.length / most) * 56, value: String(slot.entries.length), mark: slot.time,
              }))} />
            </div>
            <Facts items={[
              [rows.length, M.protocol.factItems], [slots.length, M.protocol.factSlots], [pinnedCount, M.protocol.factPinned],
            ]} />
            </div>
          </Hero>

          <Section n={1} title={M.protocol.slots} />
          {slots.map(slot => (
            <Card key={`${slot.zone}-${slot.time}`}>
              <Head icon={ZONE_ICON[slot.zone] ?? FALLBACK_ICON}
                title={M.protocol.slotHead(slot.label, slot.time, slot.entries.length)} />
              <div role="list" className="fk-list">
                {slot.entries.map(entry => (
                  <div role="listitem" aria-label={entry.name} key={entry.occurrenceId}>
                    <Row icon="t-supps" title={entry.name}
                      // The placement's REASON is the engine's stored sentence — none is invented when it is missing.
                      sub={<>
                        {M.protocol.rowSub(entry.dose ?? '—', entry.pinned ? M.protocol.manual : M.protocol.automatic)}
                        {entry.reason && <><br />{entry.reason}</>}
                      </>}
                      aria-label={M.protocol.rowAria(entry.name)}
                      onClick={() => setOpenEntry(entry)} />
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {/* D4: the meal bindings are a SECTION of this page, not a page of their own. */}
          <Section n={2} title={M.protocol.meals(mealMatchCount)} />
          <Card role="region" aria-label={M.protocol.mealsAria}>
            {mealMatchCount > 0 ? <StackMealMatch result={mealMatch} /> : <Txt>{M.protocol.mealsEmpty}</Txt>}
            <Note>{M.common.noteDoctor}</Note>
          </Card>
        </>
      )}

      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </StackPageScaffold>
  )
}
