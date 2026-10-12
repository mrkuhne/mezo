// ============================================================
// Mezo · MedicationFormSheet (create / edit — mezo-d20.8.3.1; Folyadék F5, mezo-n4wf5.5) — prototype sheet `medform`.
// Create mode opens from the empty state's „Gyógyszer felvétele"; edit mode from the filled page's „Szerkesztés",
// prefilled from the active medication. Fields: név + hatóanyag · beviteli út · dózis + egység · gyakoriság (heti + the
// day of the week / napi) · the cycle's phases as a preview. The cycle CONFIG is not editable: create sends the
// 2 · 3 · 2 seven-day template, edit carries the existing config verbatim. Save → createMedication / updateMedication.
// Saving stays disabled until name, active ingredient, dose and unit are there.
// ============================================================
import { useId, useState } from 'react'
import { useMedicationActions } from '@/data/hooks'
import type { Medication, MedicationCycleConfig, MedicationInput } from '@/data/types'
import { m, useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead, Input, Lab, Note, Pill, Pills, SheetActs } from '@/shared/ui/folyadek'
import { MedicationCycleBar, cycleCells, usePhaseWord } from '@/features/fuel/components/MedicationCycleBar'

/** The default 7-day 2 peak · 3 stable · 2 trough template (the backend populator's shape). The phase labels are stored
 *  with the new medication, so they are read from the catalog when the template is READ (the language of the moment). */
export const DEFAULT_CYCLE: MedicationCycleConfig = {
  cycleLengthDays: 7,
  phases: [
    { key: 'peak', fromDay: 1, toDay: 2, get label() { return m().fuelKieg.form.template.peak } },
    { key: 'stable', fromDay: 3, toDay: 5, get label() { return m().fuelKieg.form.template.stable } },
    { key: 'trough', fromDay: 6, toDay: 7, get label() { return m().fuelKieg.form.template.trough } },
  ],
}

const ROUTES = ['subQ', 'IM', 'oral'] as const
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

/** cadence string ('weekly-monday' | 'daily' | legacy) → form state. */
function parseCadence(cadence: string): { mode: 'weekly' | 'daily'; day: string } {
  if (cadence === 'daily') return { mode: 'daily', day: 'monday' }
  const hit = /^weekly-(\w+)$/.exec(cadence)
  return { mode: 'weekly', day: hit?.[1] ?? 'monday' }
}

/** Single-select pills (route / weekday / how often). */
function PickRow<T extends string>({ options, value, onChange, ariaLabel }: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <Pills role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <Pill key={o.value} on={o.value === value} onClick={() => onChange(o.value)}>{o.label}</Pill>
      ))}
    </Pills>
  )
}

export function MedicationFormSheet({ medication, onClose }: {
  /** The medication to edit; omit for create mode. */
  medication?: Medication
  onClose: () => void
}) {
  const M = useM().fuelKieg
  const id = useId()
  const phaseWord = usePhaseWord()
  const { createMedication, updateMedication } = useMedicationActions()
  const editing = Boolean(medication)

  const [name, setName] = useState(medication?.name ?? '')
  const [ingredient, setIngredient] = useState(medication?.activeIngredient ?? '')
  const [route, setRoute] = useState(medication?.route ?? 'subQ')
  const [dose, setDose] = useState(medication ? String(medication.defaultDose) : '')
  const [unit, setUnit] = useState(medication?.doseUnit ?? 'mg')
  const initialCadence = parseCadence(medication?.cadence ?? 'weekly-monday')
  const [cadenceMode, setCadenceMode] = useState<'weekly' | 'daily'>(initialCadence.mode)
  const [cadenceDay, setCadenceDay] = useState(initialCadence.day)

  const doseNum = Number(dose)
  const canSave = name.trim() !== '' && ingredient.trim() !== '' && unit.trim() !== ''
    && dose.trim() !== '' && Number.isFinite(doseNum) && doseNum > 0

  // Edit carries the existing cycle config verbatim; create sends the template.
  const cycle = medication?.cycle ?? DEFAULT_CYCLE

  function submit(close: () => void) {
    if (!canSave) return
    const input: MedicationInput = {
      name: name.trim(),
      activeIngredient: ingredient.trim(),
      route,
      cadence: cadenceMode === 'daily' ? 'daily' : `weekly-${cadenceDay}`,
      defaultDose: doseNum,
      doseUnit: unit.trim(),
      cycle,
      active: true,
    }
    if (editing) updateMedication(input)
    else createMedication(input)
    close()
    onClose()
  }

  const phaseDays = cycle.phases
    .map(p => M.med.phaseDays(p.toDay - p.fromDay + 1, phaseWord(p.key, p.label))).join(' · ')

  return (
    <Sheet onClose={onClose} labelledBy="medication-form-title" className="fo-sheet fk-sheet">
      {(close) => (
        <>
          <FoSheetHead icon="t-syringe" title={editing ? M.form.titleEdit : M.form.titleAdd} titleId="medication-form-title"
            sub={M.form.eyebrow} />

          <div className="fk-two">
            <div>
              <Lab htmlFor={`${id}-name`}>{M.form.name}</Lab>
              <Input id={`${id}-name`} value={name} onChange={e => setName(e.target.value)} placeholder={M.form.namePlaceholder} />
            </div>
            <div>
              <Lab htmlFor={`${id}-ing`}>{M.form.ingredient}</Lab>
              <Input id={`${id}-ing`} value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder={M.form.ingredientPlaceholder} />
            </div>
          </div>

          <Lab>{M.form.route}</Lab>
          <PickRow options={ROUTES.map(value => ({ value: value as string, label: M.med.route[value] }))}
            value={route} onChange={setRoute} ariaLabel={M.form.route} />

          <div className="fk-two">
            <div>
              <Lab htmlFor={`${id}-dose`}>{M.form.dose}</Lab>
              <Input id={`${id}-dose`} inputMode="decimal" value={dose} onChange={e => setDose(e.target.value)} placeholder="4" />
            </div>
            <div>
              <Lab htmlFor={`${id}-unit`}>{M.form.unit}</Lab>
              <Input id={`${id}-unit`} value={unit} onChange={e => setUnit(e.target.value)} placeholder="mg" />
            </div>
          </div>

          <Lab>{M.form.howOften}</Lab>
          <PickRow
            options={[{ value: 'weekly', label: M.form.weekly }, { value: 'daily', label: M.form.daily }] as const}
            value={cadenceMode} onChange={setCadenceMode} ariaLabel={M.form.howOften}
          />
          {cadenceMode === 'weekly' && (
            <>
              <Lab>{M.form.doseDay}</Lab>
              <PickRow options={WEEKDAYS.map(value => ({ value: value as string, label: M.form.weekday[value] }))}
                value={cadenceDay} onChange={setCadenceDay} ariaLabel={M.form.doseDay} />
            </>
          )}

          <Lab>{M.form.phases}</Lab>
          <div aria-hidden="true"><MedicationCycleBar week={cycleCells(cycle)} dim /></div>
          <Note>{editing ? M.form.noteEdit(cycle.cycleLengthDays) : M.form.noteNew(phaseDays)}</Note>

          <SheetActs label={editing ? M.form.save : M.form.add} onSave={() => submit(close)} onCancel={close}
            cancelLabel={M.common.cancel} disabled={!canSave} />
        </>
      )}
    </Sheet>
  )
}
