// ============================================================
// Mezo · MedicationFormSheet (create/edit — mezo-d20.8.3.1)
// The F7.3 gyógyszer-flow's shared form sheet, per fuel-mely.html. Create mode
// opens from the honest empty state's "＋ Gyógyszer felvétele" CTA (the path that
// did not exist before this round); edit mode opens from the filled page's
// "Szerkesztés" ghost, prefilled from the active medication. Fields: név +
// hatóanyag · beviteli út chips (subQ/IM/orális) · dózis + egység · kadencia
// (heti + nap-chips / napi) · cycle preview. The cycle CONFIG is not editable in
// this round (approved default): create sends the 2P·3S·2T 7-day template, edit
// carries the existing config verbatim. Save → createMedication / updateMedication.
//
// ÜVEG (mezo-me75u.2; prototypes/uveg-fuel-tobbi.html `SH.medform`): ONE sky glass sheet
// (`fsx-sheet`); fields are eyebrow-labelled flat wells, the pickers flat chips (the chosen one
// filled sky), the cycle preview the same flat phase cells as the page's cycle strip, Mégse flat
// and the save a lit sky button. Behavior unchanged.
// ============================================================
import { useState } from 'react'
import { useMedicationActions } from '@/data/hooks'
import type { Medication, MedicationCycleConfig, MedicationInput } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'

/** The default 7-day 2P·3S·2T cycle template (the backend populator's shape, HU labels). */
export const DEFAULT_CYCLE: MedicationCycleConfig = {
  cycleLengthDays: 7,
  phases: [
    { key: 'peak', fromDay: 1, toDay: 2, label: 'Csúcs' },
    { key: 'stable', fromDay: 3, toDay: 5, label: 'Stabil' },
    { key: 'trough', fromDay: 6, toDay: 7, label: 'Mélypont' },
  ],
}

const ROUTES = [
  { value: 'subQ', label: 'subQ injekció' },
  { value: 'IM', label: 'IM injekció' },
  { value: 'oral', label: 'orális' },
] as const

const WEEKDAYS = [
  { value: 'monday', label: 'H' },
  { value: 'tuesday', label: 'K' },
  { value: 'wednesday', label: 'Sze' },
  { value: 'thursday', label: 'Cs' },
  { value: 'friday', label: 'P' },
  { value: 'saturday', label: 'Szo' },
  { value: 'sunday', label: 'V' },
] as const

/** cadence string ('weekly-monday' | 'daily' | legacy) → form state. */
function parseCadence(cadence: string): { mode: 'weekly' | 'daily'; day: string } {
  if (cadence === 'daily') return { mode: 'daily', day: 'monday' }
  const m = /^weekly-(\w+)$/.exec(cadence)
  return { mode: 'weekly', day: m?.[1] ?? 'monday' }
}

/** An eyebrow-captioned flat well; the <label> wraps the control so getByLabelText resolves it. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="fsx-sh-field">
      <span className="uv-eyebrow">{label}</span>
      {children}
    </label>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <span className="fsx-sh-sec uv-eyebrow">{children}</span>
}

/** Chip-row single select (route / weekday / cadence mode). */
function ChipRow<T extends string>({ options, value, onChange, ariaLabel }: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="fsx-chips">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'fsx-chip is-on' : 'fsx-chip'}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MedicationFormSheet({ medication, onClose }: {
  /** The medication to edit; omit for create mode. */
  medication?: Medication
  onClose: () => void
}) {
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

  return (
    <Sheet onClose={onClose} labelledBy="medication-form-title" className="glass is-still fsx-sheet is-sky">
      {(close) => (
        <>
          <div className="fsx-shh">
            <span className="fsx-shh-art" aria-hidden="true"><Icon3D name="t-syringe" size={48} /></span>
            <div className="fsx-shh-copy">
              <span className="uv-eyebrow">Gyógyszer</span>
              <div id="medication-form-title" className="fsx-shh-title">
                <strong>{editing ? 'Gyógyszer szerkesztése' : 'Gyógyszer felvétele'}</strong>
              </div>
            </div>
            <button type="button" className="fsx-shh-x" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="fsx-sh-two">
            <Field label="Név">
              <input className="fsx-sh-input" value={name} onChange={e => setName(e.target.value)} placeholder="pl. Retatrutid" />
            </Field>
            <Field label="Hatóanyag">
              <input className="fsx-sh-input" value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder="retatrutid" />
            </Field>
          </div>

          <SectionHead>Beviteli út</SectionHead>
          <ChipRow options={ROUTES} value={route} onChange={setRoute} ariaLabel="Beviteli út" />

          <div className="fsx-sh-two is-dose">
            <Field label="Dózis">
              <input className="fsx-sh-input" inputMode="decimal" value={dose} onChange={e => setDose(e.target.value)} placeholder="4" />
            </Field>
            <Field label="Egység">
              <input className="fsx-sh-input" value={unit} onChange={e => setUnit(e.target.value)} placeholder="mg" />
            </Field>
          </div>

          <SectionHead>Kadencia</SectionHead>
          <ChipRow
            options={[{ value: 'weekly', label: 'heti' }, { value: 'daily', label: 'napi' }] as const}
            value={cadenceMode}
            onChange={setCadenceMode}
            ariaLabel="Kadencia"
          />
          {cadenceMode === 'weekly' && (
            <ChipRow options={WEEKDAYS} value={cadenceDay} onChange={setCadenceDay} ariaLabel="Beadás napja" />
          )}

          <SectionHead>Ciklus · fázisok</SectionHead>
          <div className="fmd-cyc is-preview" aria-hidden>
            {Array.from({ length: cycle.cycleLengthDays }, (_, i) => {
              const day = i + 1
              const phase = cycle.phases.find(p => day >= p.fromDay && day <= p.toDay)
              return (
                <span key={day} className={phase?.key}>
                  <span className="fmd-cyc-glyph">{phase?.label?.[0] ?? ''}</span>
                  <span className="fmd-cyc-day">{day}</span>
                </span>
              )
            })}
          </div>
          <span className="fsx-sh-hint">
            {editing
              ? `${cycle.cycleLengthDays} napos ciklus — a fázis-beosztás változatlan marad.`
              : 'Alap-sablon: 2 nap csúcs · 3 nap stabil · 2 nap völgy — a beadás napjától számolva.'}
          </span>

          <div className="fsx-sh-pair">
            <button type="button" className="fsx-sh-btn uv-flat" onClick={close}>Mégse</button>
            <button type="button" className="fsx-sh-btn is-lit" disabled={!canSave} onClick={() => submit(close)}>
              <Icon name="check" size={14} /> {editing ? 'Mentés' : 'Felveszem'}
            </button>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
