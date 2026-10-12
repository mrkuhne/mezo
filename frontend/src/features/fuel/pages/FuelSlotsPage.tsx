// ============================================================
// Mezo · FuelSlotsPage (mezo-7102 — Task 8) — "/settings/fuel/slots": full-page editor for the per-day-type
// meal-window templates. A day-type switcher (Pihenőnap / Reggeli edzés / Esti edzés, `useStickyTab`) selects which
// of the three canonical day types is being viewed:
//
//  - no saved template → a read-only RECOMMENDED preview (today's engine output for a reference day of that type:
//    today's real blocks when today IS that type, else a synthetic canonical block) + a "Testreszabás" button that
//    forks the recommendation into an editable draft (seeded budgetPct from the recommended kcal share, Σ normalized
//    to 100, drift absorbed by the largest window).
//  - a saved template exists (or a fork is in progress) → editable rows in local state, a live `compileTemplate` +
//    `splitBudgetPct` preview, the Tier-1 deterministic `validateSlotPlan` guardrails (errors block Mentés, warnings
//    are advisory), Mezo's on-demand view, and "Ajánlott visszaállítása" to delete the saved template.
//
// Folyadék (mezo-n4wf5.5, prototype vilagos/fuel.js `ablakok()`): the title lives in the frame; the hero is the day as
// a tide (`FuelWindowTide`: one vessel per window, its level the kcal share) with the day-type tabs under the verdict.
// Recommended: 1 · Ablakok (steps with kcal and share). Editor: 1 · Ablakok · N (name, type, role, anchor, time /
// offset, share), 2 · Így áll össze (the sum and each window's kcal + protein, then the checks), 3 · Mezo véleménye.
// Wording per the plan: „Slot" → „Ablak", „Budget %" → „Rész %", „Mezo értékelése" → „Kérd Mezo véleményét".
// Behaviour is unchanged (hooks, drafts per day type, save / reset / evaluate, back target, the unsaved-changes guard).
// Design: docs/superpowers/specs/2026-08-05-fuel-meal-slot-templates-design.md §1.
// ============================================================
import { useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { flushSync } from 'react-dom'
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'
import { useId, useState, type InputHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFuelSettings, useFuelTimeline, useSlotTemplateActions, useSlotTemplateEvaluation, useSlotTemplates } from '@/data/hooks'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Acts, Btn, Bub, Card, Empty, FrameBack, Hero, Input, Lab, Level, Lk, Note, Page, Pill, Pills, Section, Seg, Select, St, Step, Stepper,
  useFrameTitle,
} from '@/shared/ui/folyadek'
import { useM } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { FuelWindowTide, evenWindows } from '@/features/fuel/components/FuelWindowTide'
import { compileTemplate, resolveAnchorTimes } from '@/features/fuel/logic/compileTemplate'
import { validateSlotPlan } from '@/features/fuel/logic/validateSlotPlan'
import { placeWindows, splitBudget, splitBudgetPct } from '@/features/fuel/logic/buildDayPlan'
import type { Macro4, PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { ROLE_OPTIONS } from '@/features/fuel/logic/recipeRole'
import { toHHmm } from '@/data/fuel/fuelConfig'
import type { SlotPlanVerdict } from '@/data/fuel/slotTemplateApi'
import type { MealSlot, SlotAnchor, SlotTemplateDayType, SlotTemplateRow } from '@/data/types'

const DAY_TYPES: SlotTemplateDayType[] = ['rest', 'training_am', 'training_pm']

// Reference-day synthesis (spec §1): today's real blocks when today matches the selected day
// type, otherwise a canonical single block so the preview/editor still has something to anchor
// training-relative rows against.
const SYNTHETIC_BLOCKS: Record<SlotTemplateDayType, PlannerBlock[]> = {
  rest: [],
  training_am: [{ kind: 'gym', time: '07:00', durationMin: 60, label: 'Gym' }],
  training_pm: [{ kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' }],
}

const SLOT_KINDS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

// Every window kind has its own glyph (prototype `WKIND`).
const SLOT_ICON: Record<MealSlot, Icon3DName> = { breakfast: 't-sun', lunch: 't-bowl', snack: 't-snack', dinner: 't-moon' }

const ANCHOR_TYPES: SlotAnchor['type'][] = ['fixed', 'wake', 'training_start', 'training_end', 'bed']

// A new window's shape; its NAME is read from the catalog when it is added (never a translated module constant).
const NEW_ROW: Omit<SlotTemplateRow, 'label'> = {
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
function useNumberText({ value, onChange, allowNegative = false, normalize }: {
  value: number; onChange: (n: number) => void; allowNegative?: boolean
  /** mezo-4ghd fixes 2/3: optional per-field commit coercion (e.g. integer + range clamp) applied
   *  to the VALUE handed to `onChange` — never to the raw typed text, so decimal entry still reads
   *  naturally while it's being typed (see the module comment by the callers). Skipped on a bare/
   *  empty transient (`''`, `'.'`, `'-'`, `'-.'`) so clearing-then-typing keeps behaving like every
   *  other number field — only a text the user has actually committed to gets coerced. */
  normalize?: (n: number) => number
}): InputHTMLAttributes<HTMLInputElement> {
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
  return {
    inputMode: 'decimal',
    value: text,
    onChange: (e) => commit(e.target.value),
    onBlur: () => { if (text !== String(value)) setText(String(value)) },
  }
}

/** The share field of a window: a typeable whole percent (1–100). */
function ShareField({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  return <Input id={id} {...useNumberText({ value, onChange, normalize: normalizeBudgetPct })} />
}

/** The offset of a window from its anchor: − / + in quarter hours, and typeable (signed, clamped to ±720). */
function OffsetStepper({ name, value, onChange }: { name: string; value: number; onChange: (n: number) => void }) {
  const input = useNumberText({ value, onChange, allowNegative: true, normalize: clampOffsetMin })
  return (
    <Stepper name={name} input={input}
      onDec={() => onChange(clampOffsetMin(value - 15))}
      onInc={() => onChange(clampOffsetMin(value + 15))} />
  )
}

/** The recommended plan's kcal shares as whole percents that sum to 100 — the slot's kcal share, rounded, drift absorbed
 *  by the largest slot (the same dinner-absorbs principle `splitBudget`/`splitBudgetPct` use elsewhere). */
function recommendedShares(budgets: Macro4[]): number[] {
  if (!budgets.length) return []
  const totalKcal = budgets.reduce((s, b) => s + b.kcal, 0) || 1
  const rounded = budgets.map(b => Math.round((b.kcal / totalKcal) * 100))
  const drift = 100 - rounded.reduce((s, p) => s + p, 0)
  const bigIdx = budgets.reduce((bi, b, i) => (b.kcal > budgets[bi].kcal ? i : bi), 0)
  rounded[bigIdx] += drift
  return rounded
}

// Recommended-plan rows normalized to a Σ=100 budgetPct seed for the "Testreszabás" fork.
function seedRowsFromRecommendation(windows: ReturnType<typeof placeWindows>, budgets: Macro4[]): SlotTemplateRow[] {
  if (!windows.length) return []
  const shares = recommendedShares(budgets)
  return windows.map((w, i) => ({
    label: w.label,
    slotKind: w.slotKey,
    role: 'standard',
    anchor: { type: 'fixed', time: toHHmm(w.time) },
    budgetPct: shares[i],
  }))
}

export function FuelSlotsPage() {
  const navigate = useNavigate()
  const M = useM()
  const T = M.fuelBeallitas
  const W = T.windows
  const ids = useId()
  useFrameTitle({ title: T.frame.windowsTitle, eyebrow: T.frame.eyebrow })
  const { state: originState } = useSettingsOrigin()
  const [saved, setSaved] = useState(false)
  const [writeError, setWriteError] = useState(false)
  const [dayType, setDayType] = useStickyTab<SlotTemplateDayType>('fuel.slots.dayType', 'rest')
  const { blocks, budget, wake, bed, dayType: todayType, restPerHour } = useFuelTimeline()
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

  const recommendedWindows = placeWindows(wake, bed, settings.mealsPerDay, refBlocks, restPerHour)
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
  // the new window starts with the app language's word for a snack; from then on the name is the user's own
  const addRow = () => setRows(prev => [...prev, { ...NEW_ROW, label: W.editor.newName }])
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

  const dirty = !saved && ((forked && JSON.stringify(rows) !== JSON.stringify(existing?.slots ?? [])) || Object.entries(drafts).some(([key, draft]) => draft?.forked && JSON.stringify(draft.rows) !== JSON.stringify(templates.find(t => t.dayType === key)?.slots ?? [])))
  const goFuel = () => navigate('/settings/fuel', { state: originState })
  const back = <FrameBack className="fo-backpill" onBack={goFuel}>{T.frame.backToFuel}</FrameBack>

  if (settingsError || templatesError) {
    return (
      <Page nonav className="fb-page">
        <UnsavedChangesGuard dirty={dirty} />
        {back}
        <Card>
          <Empty icon="t-info" actions={<Btn sm onClick={() => { retrySettings(); retryTemplates() }}>{T.retry}</Btn>}>
            <span role="alert">{W.loadError}</span>
          </Empty>
        </Card>
      </Page>
    )
  }

  // Betöltés közben csak a hős áll: a Testreszabás nem indítható, amíg a mentett rend meg nem jött (mezo-4ghd fix 4 —
  // egy korai fork felülírná a később megérkező mentett felosztást).
  if (settingsPending || templatesPending) {
    return (
      <Page nonav className="fb-page">
        <UnsavedChangesGuard dirty={dirty} />
        {back}
        <Hero className="fb-hero" label={W.loadingLabel} verdict={<span role="status">{T.loading}</span>} sub={W.loadingSub}>
          <div className="fb-hg"><FuelWindowTide windows={evenWindows(4)} bare /></div>
        </Hero>
      </Page>
    )
  }

  const days = (
    <Seg tabs className="fb-days" aria-label={W.dayTypes} value={dayType} onChange={setDayType}
      items={DAY_TYPES.map((key) => ({ key, label: W.dayTab[key] }))} />
  )
  const sumText = fmtNum(sumPct, 2)
  const sumOff = Math.abs(sumPct - 100) > 1

  if (!editing) {
    const shares = recommendedShares(recommendedBudgets)
    const block = refBlocks[0]
    const why = !block
      ? W.recommended.whyRest
      : dayType === todayType
        // a blokk neve a felhasználó saját (tárolt) edzésneve: nem fordítjuk
        ? W.recommended.whyToday(block.label, block.time)
        : W.recommended.whySample(block.time)
    return (
      <Page nonav className="fb-page">
        <UnsavedChangesGuard dirty={dirty} />
        {back}
        <Hero
          className="fb-hero"
          label={W.recommended.label}
          verdict={W.recommended.verdict(W.dayType[dayType], recommendedWindows.length)}
          sub={why}
          actions={<Btn onClick={fork} disabled={templatesPending}>{W.recommended.customise}</Btn>}
        >
          <div className="fb-hg">
            <FuelWindowTide windows={recommendedWindows.map((w, i) => ({ time: w.time, label: w.label, kcal: recommendedBudgets[i]?.kcal ?? 0 }))} />
          </div>
          <div className="fb-hd">{days}</div>
        </Hero>

        <Section n={1} title={W.recommended.section} />
        <Card className="fb-rec">
          {recommendedWindows.map((w, i) => (
            <Step key={i} time={toHHmm(w.time)} icon={SLOT_ICON[w.slotKey]} title={w.label}
              right={<span className="fb-kv"><b>{fmtGrouped(recommendedBudgets[i]?.kcal ?? 0)}</b> kcal<small>{shares[i] ?? 0}%</small></span>} />
          ))}
          <Note>{W.recommended.note}</Note>
        </Card>
      </Page>
    )
  }

  const E = W.editor
  const blocked = errors.length > 0
  const verdictText = sumOff
    ? E.verdictSumOff(sumText)
    : blocked
      ? E.verdictBlocked
      : existing ? E.verdictOwn[dayType] : E.verdictReady(sumText)

  return (
    <Page
      nonav
      className="fb-page"
      foot={(
        <>
          <Btn ghost className="fb-cancel" onClick={goFuel}>{T.cancel}</Btn>
          <Btn grow className="fb-save" disabled={blocked || pending || settingsPending || templatesPending} onClick={save}>{T.save}</Btn>
        </>
      )}
    >
      <UnsavedChangesGuard dirty={dirty} />
      {back}
      {writeError && <p className="fb-alert" role="alert">{W.saveError}</p>}

      <Hero
        className="fb-hero"
        warn={sumOff}
        label={(existing ? E.labelOwn : E.labelCustomising)(sumText)}
        verdict={verdictText}
        sub={existing || blocked ? E.sub : `${E.subChange} ${E.sub}`}
      >
        <div className="fb-hg">
          <FuelWindowTide windows={compiled.map((w, i) => ({ time: w.time, label: w.label, kcal: compiledBudgets[i]?.kcal ?? 0 }))} />
        </div>
        <div className="fb-hd">{days}</div>
      </Hero>

      <Section n={1} title={E.section(rows.length)} />
      <Card className="fb-wins">
        {rows.map((row, i) => {
          const anchor = row.anchor // a local const keeps the discriminant narrowing inside the closures below
          return (
            <div key={i} className="fb-win">
              <div className="fb-wh">
                <Bub icon={SLOT_ICON[row.slotKind]} size={40} />
                <Input
                  value={row.label}
                  onChange={e => updateRow(i, { label: e.target.value })}
                  aria-label={E.name}
                  placeholder={E.name}
                  maxLength={40}
                />
                <button type="button" className="fb-rm" onClick={() => removeRow(i)}
                  aria-label={row.label.trim() ? E.remove(row.label) : E.removeUnnamed}>×</button>
              </div>

              <Pills role="group" aria-label={E.type}>
                {SLOT_KINDS.map(kind => (
                  <Pill key={kind} on={row.slotKind === kind} onClick={() => updateRow(i, { slotKind: kind })}>{W.kind[kind]}</Pill>
                ))}
              </Pills>
              <Pills className="fb-roles" role="group" aria-label={E.role}>
                {ROLE_OPTIONS.map(o => (
                  <Pill key={o.id} on={row.role === o.id} onClick={() => updateRow(i, { role: o.id })}>{o.label}</Pill>
                ))}
              </Pills>

              <div className="fb-anch">
                <div>
                  <Lab htmlFor={`${ids}a${i}`}>{E.anchor}</Lab>
                  <Select id={`${ids}a${i}`} value={anchor.type} onChange={e => setAnchorType(i, e.target.value as SlotAnchor['type'])}>
                    {ANCHOR_TYPES.map(type => <option key={type} value={type}>{E.anchorType[type]}</option>)}
                  </Select>
                </div>
                <div>
                  {anchor.type === 'fixed' ? (
                    <>
                      <Lab htmlFor={`${ids}t${i}`}>{E.time}</Lab>
                      <Input id={`${ids}t${i}`} type="time" value={anchor.time}
                        onChange={e => { if (e.target.value) updateRow(i, { anchor: { type: 'fixed', time: e.target.value } }) }} />
                    </>
                  ) : (
                    <>
                      <Lab>{E.offset}</Lab>
                      <OffsetStepper name={E.offset} value={anchor.offsetMin}
                        onChange={n => updateRow(i, { anchor: { type: anchor.type, offsetMin: n } })} />
                    </>
                  )}
                </div>
                <div>
                  <Lab htmlFor={`${ids}p${i}`}>{E.share}</Lab>
                  <ShareField id={`${ids}p${i}`} value={row.budgetPct} onChange={n => updateRow(i, { budgetPct: n })} />
                </div>
              </div>
            </div>
          )
        })}
        <Acts><Btn sm ghost onClick={addRow}>{E.add}</Btn></Acts>
      </Card>

      <Section n={2} title={W.sum.section} />
      <Card className="fb-adds">
        <p className="fb-sum"><span>{W.sum.label}</span><b className={sumOff ? 'off' : undefined}>{W.sum.pct(sumText)}</b></p>
        {compiled.map((w, i) => (
          <div key={i} className="fb-wv">
            <span className="fb-wt">{W.sum.row(toHHmm(w.time), w.label.trim() || '—')}</span>
            <Level pct={(w.budgetPct ?? 0) * 2.4} height={10} />
            <span><b>{fmtGrouped(compiledBudgets[i]?.kcal ?? 0)}</b> kcal · {W.sum.protein(fmtGrouped(compiledBudgets[i]?.p ?? 0))}</span>
          </div>
        ))}
        {/* mezo-4ghd fix 6a: `${code}-${i}` keys — `code` alone collides when e.g. `label_length`,
            `gap`, or `pre_workout_big` fire more than once for the same plan. */}
        {/* Tier-1 errors block saving; warnings are advisory and never block. */}
        {errors.map((e, i) => (
          <Note key={`${e.code}-${i}`} role="alert" className="fb-bad">{e.text}</Note>
        ))}
        {warnings.map((w, i) => (
          <Note key={`${w.code}-${i}`} className="fb-warn">{w.text}</Note>
        ))}
      </Card>

      {/* Mezo's view (mezo-7102 Task 12) — an on-demand reading of the current draft. Disabled while a Tier-1 error
          blocks Mentés anyway, or while a call is already in flight. Never blocks saving. The summary and the
          suggestions are SERVER text: rendered as they arrive. */}
      <Section n={3} title={W.mezo.section} />
      <Card className="fb-mezo">
        {evalPending && <p className="fb-busy" role="status"><Bub icon="t-score" size={28} />{W.mezo.pending}</p>}
        {!evalPending && verdict && (
          <div className="fb-vd">
            <div>
              <Bub icon="t-score" size={34} />
              <span>{W.mezo.reading}</span>
              <St tone={verdict.verdict === 'adjust' ? 'warn' : 'ok'}>{verdict.verdict === 'ok' ? W.mezo.ok : W.mezo.adjust}</St>
            </div>
            <p className="fb-vd-summary">{verdict.summary}</p>
            {verdict.suggestions.map((s, i) => (
              <p key={i}>{s.slotLabel && <b>{s.slotLabel}: </b>}{s.text}</p>
            ))}
          </div>
        )}
        {!evalPending && evalDegraded && <Note className="fb-warn">{W.mezo.degraded}</Note>}
        <Acts><Btn sm ghost onClick={runEvaluate} disabled={blocked || evalPending}>{W.mezo.ask}</Btn></Acts>
        <Note>{W.mezo.note}</Note>
        {existing && <Acts><Lk onClick={resetToRecommended}>{W.mezo.reset}</Lk></Acts>}
      </Card>
    </Page>
  )
}
