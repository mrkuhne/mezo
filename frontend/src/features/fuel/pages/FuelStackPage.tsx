// ============================================================
// Mezo · Fuel · Stack view (occurrence-based autosaved zone timeline — mezo-vx9v Task 8)
// Port of the Phase-1 "AI builder" page onto the living protocol (Task 5's occurrences) projected
// into today's zoned timeline (Task 6's projectStackDay, via the shared useStackDay() hook). Every
// edit here — tick-to-log, move, dose, add, remove — writes straight through useProtocolActions()/
// useStackActions(); there is no local "selection" draft and no Bekapcsolás/apply step anymore —
// the stack IS the live protocol, always. Sections top→bottom: page header, day-summary strip,
// zone cards (tick-to-log + tap-to-open StackItemSheet), + Hozzáadás picker, meal-match, a compact
// "Miért így" reasoning card.
//
// Retired vs the Phase-1 page: the "Mit nézek most" demo context card, the narrative intro, the
// selection-chip row + buildProtocol() slot list, the reasoning-row block, recommendations, the
// meal-match CTAs and the apply/toast flow — all of it depended on the pre-vx9v selection model or
// on demo-only context (mezo-t16y.4). Nothing here reads /api/goals (mezo-4nu decouple, still
// guarded below).
// ============================================================
import { useState } from 'react'
import { useStackDay, useStackActions, useProtocolActions, useFuelDay, useRecipes } from '@/data/hooks'
import { addDays, huWeekdayFull, localDateString } from '@/shared/lib/dates'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import type { StackZoneKey } from '@/data/types'
import { StackZoneCard } from '@/features/fuel/components/StackZoneCard'
import { StackMealMatch } from '@/features/fuel/components/StackMealMatch'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'
import { StackPickerSheet } from '@/features/fuel/sheets/StackPickerSheet'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'

// The zones whose reasoning is physiologically substantive (pump-stack timing, Mg-glycinate sleep
// modulation) vs the simpler meal-bound anchors — mirrors buildProtocol.ts's retired `primary:
// true` slots (pre-workout stack + evening). The compact "Miért így" card draws from these only.
const PRIMARY_REASON_ZONES: StackZoneKey[] = ['pre_workout', 'post_workout', 'evening']

export function FuelStackPage() {
  const { slots, occurrences, dayType, wake, bed } = useStackDay()
  const { logIntake, undoIntake } = useStackActions()
  const { addItem } = useProtocolActions()
  const { recipes } = useRecipes()

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

  return (
    <>
      {/* Page header */}
      <div className="pghead-np sage">
        <div>
          <div className="over">Fuel · Stack</div>
          <h1>Napi protokoll</h1>
        </div>
      </div>

      {/* Day-summary strip */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card" style={{ padding: 14 }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            <b>
              {huWeekdayFull()} · {dayType.training ? `edzésnap ${dayType.firstBlockTime ?? ''}` : 'pihenőnap'}
            </b>
            {' · ébredés '}{wake}{' · lefekvés '}{bed}{' · '}{occurrences.length} item
            {pinnedCount > 0 ? `, ${pinnedCount} 📌` : ''}
          </p>
          <span className="label-mono text-tertiary" style={{ fontSize: 9, marginTop: 8, display: 'inline-block' }}>
            minden változás automatikusan mentve
          </span>
        </div>
      </div>

      {/* Zone cards */}
      {occurrences.length === 0 ? (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
            <span className="text-tertiary" style={{ fontSize: 12 }}>Üres stack · adj hozzá a Kamrából</span>
          </div>
        </div>
      ) : (
        slots.map(slot => (
          // key carries the time too — the stim-aware split (mezo-j6c9) can emit two pre_workout slots
          <StackZoneCard key={`${slot.zone}-${slot.time}`} slot={slot} onToggleTaken={onToggleTaken} onOpenEntry={setOpenEntry} />
        ))
      )}

      {/* + Hozzáadás a Kamrából */}
      <div style={{ padding: '4px 24px 16px' }}>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="chip brand"
          style={{ fontSize: 9, padding: '5px 10px' }}
        >
          <Icon name="plus" size={10} /> Hozzáadás a Kamrából
        </button>
      </div>

      {/* Meal-match */}
      <StackMealMatch result={matchResult} />

      {/* Miért így — compact reasoning card */}
      {reasons.length > 0 && (
        <div style={{ padding: '0 24px 24px' }}>
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

      {pickerOpen && (
        <StackPickerSheet
          occupiedIds={new Set(occurrences.map(o => o.pantryItemId))}
          onAdd={id => addItem(id)}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </>
  )
}
