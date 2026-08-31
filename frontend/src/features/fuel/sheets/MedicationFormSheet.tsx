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
// ============================================================
import { useState } from 'react'
import { useMedicationActions } from '@/data/hooks'
import type { Medication, MedicationCycleConfig, MedicationInput } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'

const fieldLabelStyle = { fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' } as const
const fieldInputStyle = { fontSize: 14, color: 'var(--text-primary)', marginTop: 3, width: '100%' } as const

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '8px 10px' }}>
      <label className="label-mono col" style={{ ...fieldLabelStyle, gap: 0 }}>
        {label}
        {children}
      </label>
    </div>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '14px 2px 8px' }}>
      <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

/** Chip-row single select (route / weekday / cadence mode). */
function ChipRow<T extends string>({ options, value, onChange, ariaLabel }: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="row" style={{ gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          style={o.value === value
            ? { background: 'var(--mz-cell-lav-bg)', borderColor: 'var(--mz-cell-lav-ink)', color: 'var(--mz-cell-lav-ink)' }
            : undefined}
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
    <Sheet onClose={onClose} labelledBy="medication-form-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div className="col">
              <Eyebrow brand>Gyógyszer</Eyebrow>
              <div id="medication-form-title" style={{ marginTop: 4 }}>
                <Display size="md">{editing ? 'Gyógyszer szerkesztése' : 'Gyógyszer felvétele'}</Display>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Név">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="pl. Retatrutid" style={fieldInputStyle} />
            </Field>
            <Field label="Hatóanyag">
              <input value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder="retatrutid" style={fieldInputStyle} />
            </Field>
          </div>

          <SectionHead>Beviteli út</SectionHead>
          <ChipRow options={ROUTES} value={route} onChange={setRoute} ariaLabel="Beviteli út" />

          <SectionHead>Dózis</SectionHead>
          <div className="row gap-xs" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: 2 }}>
              <Field label="Dózis">
                <input inputMode="decimal" value={dose} onChange={e => setDose(e.target.value)} placeholder="4" style={fieldInputStyle} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Egység">
                <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="mg" style={fieldInputStyle} />
              </Field>
            </div>
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
          <div className="card" style={{ padding: '8px 10px' }}>
            <div className="row" style={{ gap: 3 }} aria-hidden>
              {Array.from({ length: cycle.cycleLengthDays }, (_, i) => {
                const day = i + 1
                const phase = cycle.phases.find(p => day >= p.fromDay && day <= p.toDay)
                const bg = phase?.key === 'peak' ? 'var(--mz-no-ink)'
                  : phase?.key === 'trough' ? 'var(--mz-cell-lav-ink)' : 'var(--mz-yes-ink)'
                return (
                  <span key={day} style={{
                    flex: 1, height: 18, borderRadius: 6, background: bg, opacity: 0.75,
                    color: '#fff', fontSize: 8, fontWeight: 800, display: 'grid', placeItems: 'center',
                  }}>
                    {phase?.label?.[0] ?? ''}
                  </span>
                )
              })}
            </div>
            <span className="text-tertiary" style={{ fontSize: 10, display: 'block', marginTop: 6 }}>
              {editing
                ? `${cycle.cycleLengthDays} napos ciklus — a fázis-beosztás változatlan marad.`
                : 'Alap-sablon: 2 nap csúcs · 3 nap stabil · 2 nap völgy — a beadás napjától számolva.'}
            </span>
          </div>

          <div className="row gap-sm" style={{ marginTop: 14 }}>
            <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary flex-1" disabled={!canSave} onClick={() => submit(close)}>
              <Icon name="check" size={14} /> {editing ? 'Mentés' : 'Felveszem'}
            </button>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
