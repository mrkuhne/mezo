// ============================================================
// Mezo · Fuel · Stack view (occurrence-based autosaved zone timeline — mezo-vx9v Task 8)
// Port of the Phase-1 "AI builder" page onto the living protocol (Task 5's occurrences) projected
// into today's zoned timeline (Task 6's projectStackDay, via the shared useStackDay() hook). Every
// edit here — tick-to-log, move, dose, add, remove — writes straight through useProtocolActions()/
// useStackActions(); there is no local "selection" draft and no Bekapcsolás/apply step anymore —
// the stack IS the live protocol, always.
//
// MOZAIK FACE (fidelity audit, mezo-d20.11) — source of truth
// docs/design_2.0/prototypes/src/fuel-body.html #page-stack (p-sage, ×1.18): the page wore the
// pre-Mozaik `.pghead-np` header and had NO entrance choreography at all. It is now
// MozaikPage(sage) → PageHead(‹ Fuel + the prototype's `＋ Kamrából` head action, which used to
// be a chip buried below the zone mosaic) → PageHero(i-stack, `bevéve/összes`) → PageBody, all
// inside an EntranceGroup so the `.rise` stagger AND the day-arc's long-dormant
// `.mz-play .stk-arc-dot.next` gold pulse + the arc fill finally play.
// Sections top→bottom: stat strip · day-arc (its corner note now carries the day-type/time the
// retired day-summary card held) · KÖVETKEZŐ card · zone mini-mosaic · meal-match ·
// "Miért így" · the autosave reassurance line.
//
// Retired vs the Phase-1 page: the "Mit nézek most" demo context card, the narrative intro, the
// selection-chip row + buildProtocol() slot list, the reasoning-row block, recommendations, the
// meal-match CTAs and the apply/toast flow — all of it depended on the pre-vx9v selection model or
// on demo-only context (mezo-t16y.4). Nothing here reads /api/goals (mezo-4nu decouple, still
// guarded below).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStackDay, useStackActions, useProtocolActions, useFuelDay, useRecipes, useFuelWeek } from '@/data/hooks'
import { addDays, huWeekdayFull, localDateString } from '@/shared/lib/dates'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import { isSlotDone, StackDayArc } from '@/features/fuel/components/StackDayArc'
import { StackNextCard } from '@/features/fuel/components/StackNextCard'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import type { StackZoneKey, SupplementType } from '@/data/types'
import { StackZoneCard } from '@/features/fuel/components/StackZoneCard'
import { StackMealMatch } from '@/features/fuel/components/StackMealMatch'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'
import { StackPickerSheet } from '@/features/fuel/sheets/StackPickerSheet'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageHero, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

// The zones whose reasoning is physiologically substantive (pump-stack timing, Mg-glycinate sleep
// modulation) vs the simpler meal-bound anchors — mirrors buildProtocol.ts's retired `primary:
// true` slots (pre-workout stack + evening). The compact "Miért így" card draws from these only.
const PRIMARY_REASON_ZONES: StackZoneKey[] = ['pre_workout', 'post_workout', 'evening']

export function FuelStackPage() {
  const navigate = useNavigate()
  const { slots, occurrences, stash, dayType, wake, bed } = useStackDay()
  const { logIntake, undoIntake } = useStackActions()
  const { addItem } = useProtocolActions()
  const { recipes } = useRecipes()
  const { weeklyStats } = useFuelWeek()

  const today = localDateString()
  const yesterday = addDays(today, -1)
  const { fuel: todayFuel } = useFuelDay(today)
  const { fuel: yesterdayFuel } = useFuelDay(yesterday)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)

  const pinnedCount = occurrences.filter(o => o.pinned).length
  const matchResult = matchMealsToStack(slots, recipes, todayFuel.meals, yesterdayFuel.meals)
  const reasons = [...new Set(
    slots
      .filter(s => PRIMARY_REASON_ZONES.includes(s.zone))
      .flatMap(s => s.entries.map(e => e.reason))
      .filter((r): r is string => r != null),
  )].slice(0, 3)

  const onToggleTaken = (entry: StackDayEntry) =>
    entry.taken
      ? undoIntake(entry.pantryItemId, entry.persistedZone)
      : logIntake(entry.pantryItemId, entry.persistedZone, entry.dose)

  const kindOf = (entry: StackDayEntry): SupplementType | undefined =>
    stash.find(s => s.id === entry.pantryItemId)?.type

  // Stat strip + timeline derivation — recomputed every render so a single tick (log/undo) or a
  // freshly-added occurrence live-updates the hero number, the strip, the arc AND the mosaic in
  // one pass (there is no separate "done" cache to fall out of sync).
  const allEntries = slots.flatMap(s => s.entries)
  const applicable = allEntries.filter(e => !e.skippedToday)
  const takenCount = applicable.filter(e => e.taken).length
  const totalCount = applicable.length
  const nextIndex = slots.findIndex(s => !isSlotDone(s))
  const nextSlot = nextIndex >= 0 ? slots[nextIndex] : null
  const adherence = weeklyStats.supplementsAdherence
  const now = new Date()

  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/fuel')} label="‹ Fuel">
        {/* The prototype puts the pantry-add on the page head (`＋ Kamrából`) — it used to be a
            chip buried under the zone mosaic, where the add path was easy to miss. */}
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => setPickerOpen(true)}>
          <Icon name="plus" size={12} /> Kamrából
        </button>
      </PageHead>

      <EntranceGroup>
        <PageHero icon="i-stack" big={`${takenCount}/${totalCount}`} name="Stack" />

        <PageBody principle="Pihenőnapon az edzés-zónák maguktól átköltöznek (reggeli / ebéd) — vagy kimaradnak, ha úgy állítottad. A „miért ide” indoklás mindig a zónán ül.">
          {occurrences.length === 0 ? (
            <div className="mz-qcard rise" style={{ '--d': '20ms', textAlign: 'center', borderStyle: 'dashed' } as React.CSSProperties}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Üres stack · adj hozzá a Kamrából</span>
            </div>
          ) : (
            <>
              {/* Stat strip — bevéve · következő · e heti adherencia · 📌 kézi */}
              <div className="rise" style={{ '--d': '20ms' } as React.CSSProperties}>
                <StatStrip>
                  <StatCell value={`${takenCount}/${totalCount}`} label="bevéve ma" />
                  <StatCell value={nextSlot ? nextSlot.time : '✓'} label="következő" />
                  <StatCell value={adherence == null ? '—' : `${adherence}%`} label="e heti adherencia" />
                  <StatCell value={`${pinnedCount} 📌`} label="kézi rögzítés" />
                </StatStrip>
              </div>

              {/* Day-arc timeline — the day-type/wake/bed summary rides its corner note now
                  (the prototype's `edzésnap 17:30`), instead of a card of its own. */}
              <div className="rise" style={{ '--d': '60ms', marginTop: 12 } as React.CSSProperties}>
                <StackDayArc
                  slots={slots} wake={wake} bed={bed} nextIndex={nextIndex} now={now}
                  note={`${huWeekdayFull()} · ${dayType.training ? `edzésnap ${dayType.firstBlockTime ?? ''}`.trim() : 'pihenőnap'}`}
                />
              </div>

              {/* Featured KÖVETKEZŐ card, or a quiet all-done state */}
              <div className="rise" style={{ '--d': '100ms' } as React.CSSProperties}>
                {nextSlot ? (
                  <StackNextCard slot={nextSlot} kindOf={kindOf} onToggleTaken={onToggleTaken} onOpenEntry={setOpenEntry} />
                ) : (
                  <div className="card stk-done">
                    <span className="stk-done-check" aria-hidden="true">✓</span>
                    <div>
                      <div className="stk-done-title">A mai stack kész</div>
                      <div className="stk-done-sub">Mind a {totalCount} bevétel megvan — szép ritmus.</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Remaining zones — 2-column mini-mosaic, done zones washed sage */}
              {slots.length - (nextSlot ? 1 : 0) > 0 && (
                <div className="stk-mosaic rise" style={{ '--d': '140ms' } as React.CSSProperties}>
                  {slots.map((slot, i) => {
                    if (i === nextIndex) return null
                    return (
                      <div key={`${slot.zone}-${slot.time}`} className={`stk-mini${isSlotDone(slot) ? ' done' : ''}`}>
                        <StackZoneCard slot={slot} onToggleTaken={onToggleTaken} onOpenEntry={setOpenEntry} />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Meal-match */}
          <StackMealMatch result={matchResult} className="rise" style={{ '--d': '180ms' } as React.CSSProperties} />

          {/* Miért így — compact reasoning card */}
          {reasons.length > 0 && (
            <div className="rise" style={{ '--d': '220ms', paddingBottom: 8 } as React.CSSProperties}>
              <Eyebrow>Miért így</Eyebrow>
              <div className="card" style={{ padding: 12, marginTop: 8 }}>
                <div className="col gap-sm">
                  {reasons.map(r => (
                    <p key={r} style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{r}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* The autosave reassurance the retired day-summary card carried — the stack IS the
              live protocol, every tick writes through. */}
          <p className="stk-autosave">
            ébredés {wake} · lefekvés {bed} · {occurrences.length} item{pinnedCount > 0 ? `, ${pinnedCount} 📌` : ''}
            {' · minden változás automatikusan mentve'}
          </p>
        </PageBody>
      </EntranceGroup>

      {pickerOpen && (
        <StackPickerSheet
          occupiedIds={new Set(occurrences.map(o => o.pantryItemId))}
          onAdd={id => addItem(id)}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </MozaikPage>
  )
}
