// ============================================================
// Mezo · FuelSlotsPage (mezo-7102 — Task 8) — "/fuel/slots" full-page editor
// for per-day-type meal-slot templates. Sibling of the `fuel` group (mirrors
// RecipeEditorPage: back row + pghead-np sage header, 110px bottom padding,
// portaled `.recipe-save-bar`). A sage-accented day-type switcher
// (Pihenőnap / Reggeli edzés / Esti edzés, `useStickyTab`) selects which of
// the three canonical day types is being viewed:
//
//  - no saved template → a read-only RECOMMENDED preview (today's engine
//    output for a reference day of that type: today's real blocks when today
//    IS that type, else a synthetic canonical block) + a "Testreszabás" CTA
//    that forks the recommendation into an editable draft (seeded budgetPct
//    from the recommended kcal share, Σ normalized to 100, drift absorbed by
//    the largest slot — the codebase's dinner-absorbs idiom, generalized).
//  - a saved template exists (or a fork is in progress) → editable rows in
//    local state, a live `compileTemplate` + `splitBudgetPct` preview, the
//    Tier-1 deterministic `validateSlotPlan` guardrails (errors block Mentés,
//    warnings are advisory), and "Ajánlott visszaállítása" to delete the
//    saved template and drop back to the recommendation.
//
// Design: docs/superpowers/specs/2026-08-05-fuel-meal-slot-templates-design.md §1.
// ============================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useFuelSettings, useFuelTimeline, useSlotTemplateActions, useSlotTemplates } from '@/data/hooks'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { Icon } from '@/shared/ui/Icon'
import { compileTemplate } from '@/features/fuel/logic/compileTemplate'
import { validateSlotPlan } from '@/features/fuel/logic/validateSlotPlan'
import { placeWindows, splitBudget, splitBudgetPct } from '@/features/fuel/logic/buildDayPlan'
import type { Macro4, PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { ROLE_OPTIONS } from '@/features/fuel/logic/recipeRole'
import { toHHmm } from '@/data/fuel/fuelConfig'
import type { MealSlot, SlotAnchor, SlotTemplateDayType, SlotTemplateRow } from '@/data/types'

const DAY_TYPES: { id: SlotTemplateDayType; label: string }[] = [
  { id: 'rest', label: 'Pihenőnap' },
  { id: 'training_am', label: 'Reggeli edzés' },
  { id: 'training_pm', label: 'Esti edzés' },
]

// Reference-day synthesis (spec §1): today's real blocks when today matches the selected day
// type, otherwise a canonical single block so the preview/editor still has something to anchor
// training-relative rows against.
const SYNTHETIC_BLOCKS: Record<SlotTemplateDayType, PlannerBlock[]> = {
  rest: [],
  training_am: [{ kind: 'gym', time: '07:00', durationMin: 60, label: 'Gym' }],
  training_pm: [{ kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' }],
}

const SLOT_KIND_OPTIONS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

const ANCHOR_OPTIONS: { id: SlotAnchor['type']; label: string }[] = [
  { id: 'fixed', label: 'Fix időpont' },
  { id: 'wake', label: 'Ébredés után' },
  { id: 'training_start', label: 'Edzés előtt‑után (kezdet)' },
  { id: 'training_end', label: 'Edzés vége után' },
  { id: 'bed', label: 'Lefekvés előtt' },
]

const NEW_ROW: SlotTemplateRow = {
  label: 'Snack',
  slotKind: 'snack',
  role: 'standard',
  anchor: { type: 'fixed', time: '16:00' },
  budgetPct: 10,
}

function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className="rad-12"
      style={{
        flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
        padding: '7px 0', borderRadius: 3,
        color: on ? 'var(--sage-deep)' : 'var(--text-tertiary)',
        background: on ? 'var(--wash-sage)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}

// Typeable numeric field (AmountField idiom, RecipeEditorPage.tsx:68-93): keeps a local string so
// mid-typing states ("-", ".", "12.5") hold, coercing to a number on every change, and re-syncs
// only on an EXTERNAL value change (the ± buttons) via the render-time prev-prop pattern — no
// useEffect, so no keystroke-reset race. `allowNegative` widens the pattern for signed offsets.
function NumberField({
  value, onChange, label, width = 42, allowNegative = false,
}: { value: number; onChange: (n: number) => void; label: string; width?: number; allowNegative?: boolean }) {
  const [text, setText] = useState(() => String(value))
  const [prev, setPrev] = useState(value)
  const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/
  const isBareSign = text === '' || text === '.' || (allowNegative && (text === '-' || text === '-.'))
  const parsed = isBareSign ? 0 : parseFloat(text)
  if (value !== prev) {
    setPrev(value)
    if (parsed !== value) setText(String(value)) // external change (± buttons) → resync
  }
  const commit = (raw: string) => {
    const cleaned = raw.replace(',', '.')
    if (cleaned !== '' && cleaned !== '-' && !pattern.test(cleaned)) return // ignore non-numeric input
    setText(cleaned)
    const n = cleaned === '' || cleaned === '-' || cleaned === '.' ? 0 : parseFloat(cleaned)
    onChange(Number.isFinite(n) ? n : 0)
  }
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={e => commit(e.target.value)}
      aria-label={label}
      style={{ width, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'transparent' }}
    />
  )
}

// Recommended-plan rows normalized to a Σ=100 budgetPct seed for the "Testreszabás" fork — the
// slot's kcal share of the recommended plan, rounded, drift absorbed by the largest slot (the
// same dinner-absorbs principle `splitBudget`/`splitBudgetPct` use elsewhere).
function seedRowsFromRecommendation(windows: ReturnType<typeof placeWindows>, budgets: Macro4[]): SlotTemplateRow[] {
  if (!windows.length) return []
  const totalKcal = budgets.reduce((s, b) => s + b.kcal, 0) || 1
  const rounded = budgets.map(b => Math.round((b.kcal / totalKcal) * 100))
  const drift = 100 - rounded.reduce((s, p) => s + p, 0)
  const bigIdx = budgets.reduce((bi, b, i) => (b.kcal > budgets[bi].kcal ? i : bi), 0)
  rounded[bigIdx] += drift
  return windows.map((w, i) => ({
    label: w.label,
    slotKind: w.slotKey,
    role: 'standard',
    anchor: { type: 'fixed', time: toHHmm(w.time) },
    budgetPct: rounded[i],
  }))
}

export function FuelSlotsPage() {
  const navigate = useNavigate()
  const [dayType, setDayType] = useStickyTab<SlotTemplateDayType>('fuel.slots.dayType', 'rest')
  const { blocks, budget, wake, bed, dayType: todayType, weightKg } = useFuelTimeline()
  const { settings } = useFuelSettings()
  const { templates } = useSlotTemplates()
  const { putTemplate, deleteTemplate, pending } = useSlotTemplateActions()

  const existing = templates.find(t => t.dayType === dayType) ?? null
  const refBlocks = dayType === todayType ? blocks : SYNTHETIC_BLOCKS[dayType]

  const [rows, setRows] = useState<SlotTemplateRow[]>(() => existing?.slots ?? [])
  const [forked, setForked] = useState<boolean>(() => Boolean(existing))
  // Render-time reset on a day-type switch (the AmountField "resync on external change" idiom,
  // generalized to a discrete key instead of a single prop) — the SAME useStickyTab-backed value
  // change must drop any in-progress edit from the PREVIOUS day type and re-seed from whatever the
  // newly selected one holds.
  const [trackedDayType, setTrackedDayType] = useState(dayType)
  if (dayType !== trackedDayType) {
    setTrackedDayType(dayType)
    setRows(existing?.slots ?? [])
    setForked(Boolean(existing))
  }

  const recommendedWindows = placeWindows(wake, bed, settings.mealsPerDay, refBlocks, weightKg)
  const recommendedBudgets = splitBudget(budget, recommendedWindows)

  const editing = forked || existing != null

  const compiled = editing ? compileTemplate({ dayType, slots: rows }, { wake, bed, blocks: refBlocks }) : []
  const compiledBudgets = editing ? splitBudgetPct(budget, compiled) : []
  const { errors, warnings } = editing
    ? validateSlotPlan(rows, compiled, { wake, bed, dayType, budgetKcal: budget.kcal })
    : { errors: [], warnings: [] }
  const sumPct = Math.round(rows.reduce((s, r) => s + r.budgetPct, 0) * 100) / 100

  const updateRow = (i: number, patch: Partial<SlotTemplateRow>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))
  const addRow = () => setRows(prev => [...prev, { ...NEW_ROW }])
  const setAnchorType = (i: number, type: SlotAnchor['type']) =>
    updateRow(i, { anchor: type === 'fixed' ? { type: 'fixed', time: '12:00' } : { type, offsetMin: 0 } })

  const fork = () => {
    setRows(seedRowsFromRecommendation(recommendedWindows, recommendedBudgets))
    setForked(true)
  }
  const save = () => {
    putTemplate({ dayType, slots: rows }).then(() => navigate(-1))
  }
  const resetToRecommended = () => {
    deleteTemplate(dayType).then(() => {
      setForked(false)
      setRows([])
    })
  }

  return (
    <>
      <div style={{ padding: '0 16px 110px' }}>
        {/* Top bar — back button, own row (header-only re-skin idiom, mezo-8141) */}
        <div className="row" style={{ padding: '6px 0 0' }}>
          <button
            onClick={() => navigate(-1)}
            className="rad-16"
            style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
            aria-label="Vissza"
          >‹</button>
        </div>
        <div className="pghead-np sage" style={{ padding: '8px 0 14px' }}>
          <div>
            <div className="over">Fuel · Beállítások</div>
            <h1>Étkezési ablakok</h1>
          </div>
        </div>

        {/* Day-type switcher */}
        <div role="tablist" aria-label="Naptípusok" className="row gap-xs" style={{ marginBottom: 14 }}>
          {DAY_TYPES.map(dt => (
            <SegButton key={dt.id} on={dayType === dt.id} onClick={() => setDayType(dt.id)}>{dt.label}</SegButton>
          ))}
        </div>

        {!editing ? (
          <>
            <div className="col gap-sm" style={{ marginBottom: 12 }}>
              {recommendedWindows.map((w, i) => (
                <div key={i} className="zcard" style={{ padding: '11px 12px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {toHHmm(w.time)} · {w.label} · {recommendedBudgets[i]?.kcal ?? 0} kcal
                  </span>
                </div>
              ))}
            </div>
            <button className="cta-primary" onClick={fork} style={{ width: '100%' }}>
              <Icon name="pencil" size={14} /> Testreszabás
            </button>
          </>
        ) : (
          <>
            <div className="col gap-sm" style={{ marginBottom: 12 }}>
              {rows.map((row, i) => (
                <div key={i} className="zcard" style={{ padding: '11px 12px' }}>
                  <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                    <input
                      value={row.label}
                      onChange={e => updateRow(i, { label: e.target.value })}
                      aria-label="Slot neve"
                      placeholder="Slot neve"
                      style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
                    />
                    <button onClick={() => removeRow(i)} aria-label={`${row.label} törlése`} style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>

                  <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
                    {SLOT_KIND_OPTIONS.map(o => (
                      <button key={o.id} onClick={() => updateRow(i, { slotKind: o.id })} className={'chip' + (row.slotKind === o.id ? ' brand' : '')} style={{ fontSize: 9, padding: '6px 10px' }}>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
                    {ROLE_OPTIONS.map(o => (
                      <button key={o.id} onClick={() => updateRow(i, { role: o.id })} className={'chip' + (row.role === o.id ? ' brand' : '')} style={{ fontSize: 9, padding: '6px 10px' }}>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <div className="row gap-sm" style={{ marginTop: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      aria-label="Horgony"
                      value={row.anchor.type}
                      onChange={e => setAnchorType(i, e.target.value as SlotAnchor['type'])}
                      style={{ fontSize: 11, color: 'var(--text-primary)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '5px 6px' }}
                    >
                      {ANCHOR_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>

                    {(() => {
                      const anchor = row.anchor // hoisted into a local const so the discriminant
                        // narrowing below survives into the nested onClick/onChange closures —
                        // TS drops property-chain (`row.anchor.type`) narrowing across a function
                        // boundary, but keeps it for a plain never-reassigned local binding.
                      return anchor.type === 'fixed' ? (
                        <input
                          type="time"
                          aria-label="Fix időpont"
                          value={anchor.time}
                          onChange={e => { if (e.target.value) updateRow(i, { anchor: { type: 'fixed', time: e.target.value } }) }}
                          style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 12, fontVariantNumeric: 'tabular-nums', padding: '5px 6px' }}
                        />
                      ) : (
                        <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', display: 'inline-flex' }}>
                          <button
                            onClick={() => updateRow(i, { anchor: { type: anchor.type, offsetMin: anchor.offsetMin - 15 } })}
                            aria-label="Csökkentés"
                            style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', color: 'var(--coral)', fontSize: 14 }}
                          >−</button>
                          <NumberField
                            value={anchor.offsetMin}
                            onChange={n => updateRow(i, { anchor: { type: anchor.type, offsetMin: n } })}
                            label="Eltolás perc"
                            allowNegative
                            width={46}
                          />
                          <button
                            onClick={() => updateRow(i, { anchor: { type: anchor.type, offsetMin: anchor.offsetMin + 15 } })}
                            aria-label="Növelés"
                            style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', color: 'var(--coral)', fontSize: 14 }}
                          >+</button>
                        </div>
                      )
                    })()}

                    <div className="row" style={{ alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                      <NumberField value={row.budgetPct} onChange={n => updateRow(i, { budgetPct: n })} label="Budget %" width={40} />
                      <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)' }}>%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addRow}
              className="rad-12"
              style={{ width: '100%', padding: 11, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--coral)', background: 'color-mix(in srgb, var(--sage) 8%, transparent)', border: '1px dashed var(--line)' }}
            >
              <Icon name="plus" size={14} /> Új slot
            </button>

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '4px 2px 10px' }}>
              <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>Σ BUDGET</span>
              <span
                style={{
                  fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 10px',
                  color: Math.abs(sumPct - 100) > 1 ? 'var(--coral-deep)' : 'var(--sage-deep)',
                  background: Math.abs(sumPct - 100) > 1 ? 'var(--warm)' : 'var(--wash-sage)',
                }}
              >{sumPct}%</span>
            </div>

            <div className="col gap-sm" style={{ marginBottom: 9 }}>
              {compiled.map((w, i) => (
                <div key={i} className="zcard" style={{ padding: '9px 12px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {toHHmm(w.time)} · {w.label} · {compiledBudgets[i]?.kcal ?? 0} kcal · P{compiledBudgets[i]?.p ?? 0}
                  </span>
                </div>
              ))}
            </div>

            {errors.map(e => (
              <p key={e.code} role="alert" style={{ fontSize: 11, color: 'var(--coral-deep)', marginTop: 6 }}>{e.text}</p>
            ))}
            {warnings.map(w => (
              <p key={w.code} style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6 }}>{w.text}</p>
            ))}
          </>
        )}
      </div>

      {/* Save bar — portaled into the phone screen (RecipeEditorPage.tsx:354-365 idiom) so it pins
          to the device viewport just above the tab bar. Only shown once there is something
          editable (a fork in progress, or an existing saved template) — the pure recommended
          preview has its own primary action (Testreszabás). */}
      {editing && createPortal(
        <div className="recipe-save-bar" style={{ flexDirection: 'column', gap: 8 }}>
          {existing && (
            <button className="cta-ghost" aria-label="Ajánlott visszaállítása" onClick={resetToRecommended} style={{ width: '100%' }}>
              Ajánlott visszaállítása
            </button>
          )}
          <div className="row gap-sm" style={{ width: '100%' }}>
            <button className="cta-ghost" onClick={() => navigate(-1)} style={{ flex: 1 }}>Mégse</button>
            <button className="cta-primary" disabled={errors.length > 0 || pending} onClick={save} style={{ flex: 1.8 }}>
              <Icon name="check" size={15} /> Mentés
            </button>
          </div>
        </div>,
        document.querySelector('.phone-screen') ?? document.body,
      )}
    </>
  )
}
