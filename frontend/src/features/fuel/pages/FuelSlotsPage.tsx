import { useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { flushSync } from 'react-dom'
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'
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
import { useFuelSettings, useFuelTimeline, useSlotTemplateActions, useSlotTemplateEvaluation, useSlotTemplates } from '@/data/hooks'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { compileTemplate, resolveAnchorTimes } from '@/features/fuel/logic/compileTemplate'
import { validateSlotPlan } from '@/features/fuel/logic/validateSlotPlan'
import { placeWindows, splitBudget, splitBudgetPct } from '@/features/fuel/logic/buildDayPlan'
import type { Macro4, PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { ROLE_OPTIONS } from '@/features/fuel/logic/recipeRole'
import { toHHmm } from '@/data/fuel/fuelConfig'
import type { SlotPlanVerdict } from '@/data/fuel/slotTemplateApi'
import type { MealSlot, SlotAnchor, SlotTemplateDayType, SlotTemplateRow } from '@/data/types'
import { restKcalPerHour } from '@/data/train/activityEnergy'

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

// Üveg (mezo-me75u.2, prototypes/uveg-fuel-tobbi.html `ablakok()`): every slot wears its own hue and
// 3D slot icon — the same slot → hue pairing as the approved prototype.
const SLOT_FACE: Record<MealSlot, { icon: Icon3DName; color: string }> = {
  breakfast: { icon: 't-sun', color: 'var(--dv-amber)' },
  lunch: { icon: 't-bowl', color: 'var(--dv-sage)' },
  snack: { icon: 't-snack', color: 'var(--dv-lav)' },
  dinner: { icon: 't-moon', color: 'var(--dv-sky)' },
}

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

// mezo-4ghd fixes 2/3: dedicated commit-normalizers passed into `NumberField`'s optional
// `normalize` hook — the shared typing/decimal-acceptance logic in `NumberField` stays untouched
// (per-field only, never on the bare/empty transient text so a clear-then-type sequence still
// behaves like every other NumberField); only the VALUE handed up to the parent's `onChange` is
// coerced. `budgetPct` is integer 1..100 on the wire (parseInt semantics — truncate, don't round,
// so "12.5" commits 12); `offsetMin` is only clamped to the wire's ±720, no int-cast (unlike pct,
// nothing here asked for integer-only on the offset).
const normalizeBudgetPct = (n: number) => Math.max(1, Math.min(100, Math.trunc(n)))
const clampOffsetMin = (n: number) => Math.max(-720, Math.min(720, n))

function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={on ? 'fsl-seg-btn is-on' : 'fsl-seg-btn'}
    >
      {children}
    </button>
  )
}

// Typeable numeric field (AmountField idiom, RecipeEditorPage.tsx:68-93): keeps a local string so
// mid-typing states ("-", ".", "12.5") hold, coercing to a number on every change, and re-syncs
// only on an EXTERNAL value change (the ± buttons) via the render-time prev-prop pattern — no
// useEffect, so no keystroke-reset race. `allowNegative` widens the pattern for signed offsets.
// mezo-4ghd fix round 1 (reviewer finding 2): the render-time resync above only fires when the
// COMMITTED value changes between renders — typing "12.5" with a `normalize` in play commits 12
// already at the "2" keystroke, so the trailing ".5" never changes `value` again and the display
// is stuck showing "12.5" forever even though the committed/wire value is 12. `onBlur` adds a
// second, unconditional settle point: on blur, the text always snaps to `String(value)`, so the
// keystroke-reset-free typing experience is unchanged but the field never lingers out of sync
// with what was actually committed once the user moves on.
function NumberField({
  value, onChange, label, width = 42, allowNegative = false, normalize,
}: {
  value: number; onChange: (n: number) => void; label: string; width?: number; allowNegative?: boolean
  /** mezo-4ghd fixes 2/3: optional per-field commit coercion (e.g. integer + range clamp) applied
   *  to the VALUE handed to `onChange` — never to the raw typed text, so decimal entry still reads
   *  naturally while it's being typed (see the module comment by the callers). Skipped on a bare/
   *  empty transient (`''`, `'.'`, `'-'`, `'-.'`) so clearing-then-typing keeps behaving like every
   *  other NumberField — only a text the user has actually committed to gets coerced. */
  normalize?: (n: number) => number
}) {
  const [text, setText] = useState(() => String(value))
  const [prev, setPrev] = useState(value)
  const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/
  const isBareSign = text === '' || text === '.' || (allowNegative && (text === '-' || text === '-.'))
  const parsed = isBareSign ? 0 : parseFloat(text)
  if (value !== prev) {
    setPrev(value)
    if (parsed !== value) setText(String(value)) // external change (± buttons, or a `normalize` clamp) → resync
  }
  const commit = (raw: string) => {
    const cleaned = raw.replace(',', '.')
    if (cleaned !== '' && cleaned !== '-' && !pattern.test(cleaned)) return // ignore non-numeric input
    setText(cleaned)
    const isBare = cleaned === '' || cleaned === '-' || cleaned === '.'
    const n = isBare ? 0 : parseFloat(cleaned)
    const committed = Number.isFinite(n) ? n : 0
    onChange(normalize && !isBare ? normalize(committed) : committed)
  }
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={e => commit(e.target.value)}
      onBlur={() => { if (text !== String(value)) setText(String(value)) }}
      aria-label={label}
      className="fsl-num"
      style={{ width }}
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
  const { state: originState } = useSettingsOrigin()
  const [saved, setSaved] = useState(false)
  const [writeError, setWriteError] = useState(false)
  const [dayType, setDayType] = useStickyTab<SlotTemplateDayType>('fuel.slots.dayType', 'rest')
  const { blocks, budget, wake, bed, dayType: todayType, weightKg } = useFuelTimeline()
  const { settings, isPending: settingsPending, isError: settingsError, refetch: retrySettings } = useFuelSettings()
  const { templates, isPending: templatesPending, isError: templatesError, refetch: retryTemplates } = useSlotTemplates()
  const { putTemplate, deleteTemplate, pending } = useSlotTemplateActions()
  const { evaluate, pending: evalPending } = useSlotTemplateEvaluation()

  const existing = templates.find(t => t.dayType === dayType) ?? null
  const refBlocks = dayType === todayType ? blocks : SYNTHETIC_BLOCKS[dayType]

  const [rows, setRows] = useState<SlotTemplateRow[]>(() => existing?.slots ?? [])
  const [forked, setForked] = useState<boolean>(() => Boolean(existing))
  // Per-day-type draft retention (mezo-4ghd fix 5): switching the day-type tab used to
  // unconditionally reset `rows`/`forked` off `existing`, silently discarding an in-progress
  // fork/edit on the day type being left. `drafts` snapshots `{rows, forked}` per day type on the
  // way out — but ONLY while `forked` is true: a day type that was only ever viewed read-only
  // (never forked) has no edit worth keeping, and stashing it anyway would wrongly shadow that day
  // type's existing-template late-arrival sync (the `else if` branch below) on a later visit.
  const [drafts, setDrafts] = useState<Partial<Record<SlotTemplateDayType, { rows: SlotTemplateRow[]; forked: boolean }>>>({})
  // Render-time reset on a day-type switch (the AmountField "resync on external change" idiom,
  // generalized to a discrete key instead of a single prop) — the SAME useStickyTab-backed value
  // change must drop any in-progress edit from the PREVIOUS day type and restore whatever the
  // newly selected one holds: its draft if one was stashed, else the fresh existing/recommended
  // default (unchanged from before drafts existed).
  const [trackedDayType, setTrackedDayType] = useState(dayType)
  if (dayType !== trackedDayType) {
    if (forked) setDrafts(prev => ({ ...prev, [trackedDayType]: { rows, forked } }))
    setTrackedDayType(dayType)
    const draft = drafts[dayType]
    setRows(draft ? draft.rows : existing?.slots ?? [])
    setForked(draft ? draft.forked : Boolean(existing))
  } else if (!forked && existing != null) {
    // Cold-mount race (fix round 1): in real mode `useSlotTemplates()` starts pending —
    // `templates = []` (useDualQuery's `realEmpty`) — so `existing` is null at the FIRST render
    // and the lazy initializers above commit `rows = []`, `forked = false`. Once the GET
    // resolves, `existing` flips non-null on a LATER render, but `rows` never re-synced,
    // stranding an empty editor (`editing` already reads true off `existing != null`) with a
    // spurious `too_few` error instead of the saved template. Self-terminating and never clobbers
    // a real edit: while `!forked && existing == null` the read-only recommended view is the ONLY
    // thing rendered (no editable inputs exist), so `rows` cannot have been touched yet — and
    // setting `forked` true here means this branch can never fire again for this day type.
    setForked(true)
    setRows(existing.slots)
  }

  // mezo-7102 Task 12: Mezo's qualitative "olvasat" on the current draft — evaluate-on-demand,
  // never blocks Mentés. A verdict/degrade note describes the split it was computed for, so any
  // edit to `rows` must invalidate it: `rowsAtEval` tracks the array reference the last result was
  // computed for, and — the SAME render-time reset idiom `trackedDayType` above uses — clears the
  // stale result the moment `rows` moves on (a row edit, or a day-type switch, which resyncs `rows`
  // itself above). Self-terminating: once cleared, `rowsAtEval` is null so this can't re-fire.
  const [verdict, setVerdict] = useState<SlotPlanVerdict | null>(null)
  const [evalDegraded, setEvalDegraded] = useState(false)
  const [rowsAtEval, setRowsAtEval] = useState<SlotTemplateRow[] | null>(null)
  if (rowsAtEval !== null && rowsAtEval !== rows) {
    setRowsAtEval(null)
    setVerdict(null)
    setEvalDegraded(false)
  }

  const recommendedWindows = placeWindows(wake, bed, settings.mealsPerDay, refBlocks, restKcalPerHour(null, weightKg))
  const recommendedBudgets = splitBudget(budget, recommendedWindows)

  const editing = forked || existing != null

  const compiled = editing ? compileTemplate({ dayType, slots: rows }, { wake, bed, blocks: refBlocks }) : []
  const compiledBudgets = editing ? splitBudgetPct(budget, compiled) : []
  // Raw (unclamped) anchor resolution (mezo-7102 fix wave, finding F2) — fed into validateSlotPlan
  // so an anchor placed far outside the eating span is a save-blocking out_of_span error, not
  // silently repaired by compileTemplate's clamp before validation ever sees it.
  const rawTimes = editing ? resolveAnchorTimes(rows, { wake, bed, blocks: refBlocks }) : []
  const { errors, warnings } = editing
    ? validateSlotPlan(rows, compiled, { wake, bed, dayType, budgetKcal: budget.kcal, rawTimes })
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
  // mezo-4ghd fix round 1 (reviewer finding 1, CRITICAL): a stashed draft outlives the template it
  // was seeded from. Repro: a saved template loads into the editor (`forked=true` from mount) →
  // switching away+back stashes/restores that draft → "Ajánlott visszaállítása" deletes the
  // server-side template but left the STALE draft sitting in `drafts[dayType]` → the next
  // switch-away+back resurrected the deleted template's rows as an editable fork, and Mentés
  // would silently re-create it. Both `save` and `resetToRecommended` now drop that day type's
  // draft once its action lands — `save` because the just-saved `rows` supersede any stashed
  // pre-save draft, `resetToRecommended` because there is no longer any template to draft from.
  const clearDraft = (dt: SlotTemplateDayType) =>
    setDrafts(prev => {
      if (!(dt in prev)) return prev
      const next = { ...prev }
      delete next[dt]
      return next
    })
  const save = () => {
    if (settingsPending || templatesPending || settingsError || templatesError) return
    putTemplate({ dayType, slots: rows }).then(() => {
      clearDraft(dayType)
      flushSync(() => setSaved(true))
      navigate('/settings/fuel', { state: originState })
    }).catch(() => setWriteError(true))
  }
  const resetToRecommended = () => {
    if (settingsPending || templatesPending || settingsError || templatesError) return
    deleteTemplate(dayType).then(() => {
      clearDraft(dayType)
      setForked(false)
      setRows([])
    })
  }

  // Builds the wire request off the SAME `rawTimes`/`refBlocks` validateSlotPlan already computed
  // above (mezo-7102 fix wave finding F2's unclamped resolution) — resolvedTimes drops a row whose
  // anchor has nothing to resolve against (a training-relative row on a blockless day), keeping the
  // label paired 1:1 with its own row. An in-card HANDLED error (the honest degrade note) is fine
  // per the error/feedback standard (§7a) — the global mutation-cache toast still fires too; this
  // never hacks that shared cache, it only adds richer local handling on top.
  const runEvaluate = () => {
    const resolvedTimes = rawTimes
      .map((t, i) => (t == null ? null : { label: rows[i].label, time: toHHmm(((t % 1440) + 1440) % 1440) }))
      .filter((x): x is { label: string; time: string } => x !== null)
    const snapshot = rows
    evaluate({
      dayType,
      rows,
      resolvedTimes,
      budget: { kcal: budget.kcal, p: budget.p, c: budget.c, f: budget.f },
      balanceKcal: budget.energy.balance,
      blocks: refBlocks,
    })
      .then(v => { setVerdict(v); setEvalDegraded(false); setRowsAtEval(snapshot) })
      .catch(() => { setVerdict(null); setEvalDegraded(true); setRowsAtEval(snapshot) })
  }

  if (settingsError || templatesError) return <MozaikPage tone="sage"><UnsavedChangesGuard dirty={!saved && ((forked && JSON.stringify(rows) !== JSON.stringify(existing?.slots ?? [])) || Object.entries(drafts).some(([key, draft]) => draft?.forked && JSON.stringify(draft.rows) !== JSON.stringify(templates.find(t => t.dayType === key)?.slots ?? [])))} /><PageHead onBack={() => navigate('/settings/fuel', { state: originState })} label="‹ Fuel" /><PageBody><p role="alert">Nem sikerült betölteni az étkezési ablakok beállításait. A mentett rendet addig nem lehet felülírni.</p><button className="cta-primary" onClick={() => { retrySettings(); retryTemplates() }}>Újrapróbálás</button></PageBody></MozaikPage>

  return (
    <MozaikPage tone="sage" className="fsl-page">
        <UnsavedChangesGuard dirty={!saved && ((forked && JSON.stringify(rows) !== JSON.stringify(existing?.slots ?? [])) || Object.entries(drafts).some(([key, draft]) => draft?.forked && JSON.stringify(draft.rows) !== JSON.stringify(templates.find(t => t.dayType === key)?.slots ?? [])))} />
        {writeError && <p role="alert">Nem sikerült menteni. A módosításaid megmaradtak.</p>}
        <PageHead onBack={() => navigate('/settings/fuel', { state: originState })} label="‹ Fuel" />
        {/* F7.3 (mezo-d20.8.3.1): the editor joins the Mozaik generation — sage shell +
            eyebrow/title block; the validation display below follows fuel-mely.html. */}
        {(settingsPending || templatesPending) && <p role="status">Beállítások betöltése…</p>}
        <fieldset disabled={settingsPending || templatesPending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <EntranceGroup>
        <PageBody>
        <div className="rise" style={{ '--d': '0ms', padding: '2px 2px 12px' } as React.CSSProperties}>
          <span className="mz-eyebrow">Fuel · Beállítások</span>
          <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, lineHeight: 1.15, margin: '4px 0 0', color: 'var(--text-primary)' }}>Étkezési ablakok</h1>
        </div>

        {/* Day-type switcher */}
        <div role="tablist" aria-label="Naptípusok" className="fsl-seg rise" style={{ '--d': '40ms' } as React.CSSProperties}>
          {DAY_TYPES.map(dt => (
            <SegButton key={dt.id} on={dayType === dt.id} onClick={() => setDayType(dt.id)}>{dt.label}</SegButton>
          ))}
        </div>

        {!editing ? (
          <>
            <div className="fsl-list rise" style={{ '--d': '80ms' } as React.CSSProperties}>
              {recommendedWindows.map((w, i) => (
                <div key={i} className="fsl-slotrow glass"
                  style={{ '--c': SLOT_FACE[w.slotKey].color, '--i': i } as React.CSSProperties}>
                  <span className="fsl-slot-time">{toHHmm(w.time)}</span>
                  <Icon3D name={SLOT_FACE[w.slotKey].icon} size={34} />
                  <span className="fsl-slot-label">{w.label}</span>
                  <b className="fsl-slot-kcal uv-tint">{recommendedBudgets[i]?.kcal ?? 0} <small>kcal</small></b>
                </div>
              ))}
            </div>
            {/* mezo-4ghd fix 4: disabled while the slot-templates GET is still pending in real mode
                (`useDualQuery`'s cold-load window — `templates=[]`/`existing=null` regardless of
                whether a template is actually saved). Forking here would seed `rows` from the
                recommendation and set `forked=true`; if the GET then resolves to a saved template,
                the late-arrival sync below (`!forked && existing != null`) can never fire again for
                this day type — Mentés would silently overwrite the real template with the fork.
                Mock mode resolves `isPending` synchronously (`useDualQuery`'s `initialData`), so the
                button is never disabled there. */}
            <button className="cta-primary fsl-cta glass rise" onClick={fork} disabled={templatesPending}
              style={{ '--d': '120ms', '--c': 'var(--dv-amber)' } as React.CSSProperties}>
              <Icon3D name="t-gear" size={26} /> Testreszabás
            </button>
          </>
        ) : (
          <>
            <div className="fsl-list rise" style={{ '--d': '80ms' } as React.CSSProperties}>
              {rows.map((row, i) => (
                <div key={i} className="fsl-edit glass"
                  style={{ '--c': SLOT_FACE[row.slotKind].color, '--i': i } as React.CSSProperties}>
                  <div className="fsl-edit-head">
                    <Icon3D name={SLOT_FACE[row.slotKind].icon} size={30} />
                    <input
                      className="fsl-inp"
                      value={row.label}
                      onChange={e => updateRow(i, { label: e.target.value })}
                      aria-label="Slot neve"
                      placeholder="Slot neve"
                      maxLength={40}
                    />
                    <button className="fsl-remove uv-flat" onClick={() => removeRow(i)} aria-label={`${row.label} törlése`}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>

                  <div className="fsl-chips">
                    {SLOT_KIND_OPTIONS.map(o => (
                      <button key={o.id} onClick={() => updateRow(i, { slotKind: o.id })} className={'fsl-chip' + (row.slotKind === o.id ? ' is-on' : '')}>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <div className="fsl-chips">
                    {ROLE_OPTIONS.map(o => (
                      <button key={o.id} onClick={() => updateRow(i, { role: o.id })} className={'fsl-chip' + (row.role === o.id ? ' is-on' : '')}>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <div className="fsl-anchor">
                    <select
                      className="fsl-inp"
                      aria-label="Horgony"
                      value={row.anchor.type}
                      onChange={e => setAnchorType(i, e.target.value as SlotAnchor['type'])}
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
                          className="fsl-inp fsl-time"
                          onChange={e => { if (e.target.value) updateRow(i, { anchor: { type: 'fixed', time: e.target.value } }) }}
                        />
                      ) : (
                        <div className="fsl-stepper">
                          <button
                            onClick={() => updateRow(i, { anchor: { type: anchor.type, offsetMin: clampOffsetMin(anchor.offsetMin - 15) } })}
                            aria-label="Csökkentés"
                          >−</button>
                          <NumberField
                            value={anchor.offsetMin}
                            onChange={n => updateRow(i, { anchor: { type: anchor.type, offsetMin: n } })}
                            label="Eltolás perc"
                            allowNegative
                            width={46}
                            normalize={clampOffsetMin}
                          />
                          <button
                            onClick={() => updateRow(i, { anchor: { type: anchor.type, offsetMin: clampOffsetMin(anchor.offsetMin + 15) } })}
                            aria-label="Növelés"
                          >+</button>
                        </div>
                      )
                    })()}

                    <div className="fsl-pct">
                      <NumberField value={row.budgetPct} onChange={n => updateRow(i, { budgetPct: n })} label="Budget %" width={40} normalize={normalizeBudgetPct} />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addRow}
              className="fsl-add uv-empty"
              style={{ '--c': 'var(--dv-amber)' } as React.CSSProperties}
            >
              <Icon name="plus" size={14} /> Új slot
            </button>

            <div className="fsl-sum">
              <span className="uv-eyebrow">Σ BUDGET</span>
              <span className={Math.abs(sumPct - 100) > 1 ? 'fsl-pillsum is-off' : 'fsl-pillsum'}>{sumPct}%</span>
            </div>

            <div className="fsl-compiled">
              {compiled.map((w, i) => (
                <div key={i} className="fsl-compiled-row uv-flat">
                  <span>
                    {toHHmm(w.time)} · {w.label} · {compiledBudgets[i]?.kcal ?? 0} kcal · P{compiledBudgets[i]?.p ?? 0}
                  </span>
                </div>
              ))}
            </div>

            {/* mezo-4ghd fix 6a: `${code}-${i}` keys — `code` alone collides when e.g. `label_length`,
                `gap`, or `pre_workout_big` fire more than once for the same plan. */}
            {/* Tier-1 errors in a coral wash card — a FORBIDDEN state, the one place the
                colour is legitimate; warnings in amber and they never block (fuel-mely.html). */}
            {errors.map((e, i) => (
              <p key={`${e.code}-${i}`} role="alert" className="fsl-note is-error">{e.text}</p>
            ))}
            {warnings.map((w, i) => (
              <p key={`${w.code}-${i}`} className="fsl-note is-warn">{w.text}</p>
            ))}

            {/* "Mezo értékelése" (mezo-7102 Task 12) — an AI olvasat on the current draft,
                normal page flow near the save area (NOT the portaled bar, same reasoning as the
                reset button just below). Disabled while a Tier-1 error blocks Mentés anyway, or
                while a call is already in flight. Never blocks saving — Mentés stays governed by
                `errors` alone. */}
            <button
              className="fsl-eval uv-flat"
              aria-label="Mezo értékelése"
              onClick={runEvaluate}
              disabled={errors.length > 0 || evalPending}
              style={{ '--c': 'var(--dv-lav)' } as React.CSSProperties}
            >
              <Icon3D name="t-score" size={24} /> Mezo értékelése
            </button>

            {evalPending && (
              <p className="fsl-eval-pending np-twinkle">
                <Icon3D name="t-score" size={18} /> Mezo értékeli a felosztást…
              </p>
            )}

            {!evalPending && verdict && (
              <div className="fsl-verdict glass" style={{ '--c': 'var(--dv-lav)' } as React.CSSProperties}>
                <div className="fsl-verdict-head">
                  <Icon3D name="t-score" size={26} />
                  <Eyebrow brand>Mezo · olvasat</Eyebrow>
                  <span className={verdict.verdict === 'adjust' ? 'fsl-verdict-chip is-adjust' : 'fsl-verdict-chip'}>
                    {verdict.verdict === 'ok' ? 'rendben' : 'érdemes igazítani'}
                  </span>
                </div>
                <p className="fsl-verdict-summary uv-voice">{verdict.summary}</p>
                {verdict.suggestions.length > 0 && (
                  <div className="fsl-verdict-tips">
                    {verdict.suggestions.map((s, i) => (
                      <p key={i}>
                        {s.slotLabel && <b>{s.slotLabel}: </b>}{s.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!evalPending && evalDegraded && (
              <p className="fsl-eval-degraded">
                Az AI-értékelés most nem elérhető — a determinisztikus ellenőrzés él.
              </p>
            )}

            {/* Normal page flow, NOT the portaled save bar (fix round 1): a saved template's
                bar would otherwise stack THREE rows (reset + Mégse/Mentés) against the page's
                fixed 110px bottom padding and overflow into the content. The spec doesn't
                mandate this button live in the bar — it reads fine as the last editor action. */}
            {existing && (
              <button
                className="cta-ghost fsl-reset"
                aria-label="Ajánlott visszaállítása"
                onClick={resetToRecommended}
              >
                Ajánlott visszaállítása
              </button>
            )}
          </>
        )}
        <div style={{ height: 96 }} />
        </PageBody>
        </EntranceGroup>
        </fieldset>

      {/* Save bar — portaled into the phone screen (RecipeEditorPage.tsx:354-365 idiom) so it pins
          to the device viewport just above the tab bar. Only shown once there is something
          editable (a fork in progress, or an existing saved template) — the pure recommended
          preview has its own primary action (Testreszabás). */}
      {editing && createPortal(
        <div className="recipe-save-bar fsl-savebar">
          <button className="cta-ghost fsl-cancel" onClick={() => navigate('/settings/fuel', { state: originState })}>Mégse</button>
          <button className="cta-primary fsl-save glass" disabled={errors.length > 0 || pending || settingsPending || templatesPending} onClick={save}
            style={{ '--c': 'var(--dv-sage)' } as React.CSSProperties}>
            <Icon name="check" size={15} /> Mentés
          </button>
        </div>,
        document.querySelector('.phone-screen') ?? document.body,
      )}
    </MozaikPage>
  )
}
