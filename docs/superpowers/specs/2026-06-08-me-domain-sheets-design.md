# Me domain sheets — design spec

- **Issue:** `mezo-k0i`
- **Date:** 2026-06-08
- **Status:** approved (brainstorming) → ready for implementation plan
- **Slice origin:** deferred from Slice 2 (Me, `mezo-3fn`). The five domain entry/detail
  sheets behind the `+Súly` / `+Log` / person-tap triggers were filed as follow-up;
  their trigger chips currently render but are inert for parity.

## Why this is sequenced before Phase 2 (backend)

These sheets are the app's **write paths**. Building them now surfaces the write-side
half of the Phase 2 API contract while the frontend is still the single source of truth.
The durable artifact is **not** the stored rows (Phase 1 is a mock; data is ephemeral)
but the **mutation interface**: the payload types and hook signatures. In Phase 2 those
payload types become the REST DTOs and the hook internals swap from `setState` to
`fetch` — the calling views stay unchanged.

## Persistence model: bubble-up local state

Chosen over visual-only (`Save` just closes) because the project is data-driven
long-term and we want the write→read cycle exercised and demoable now.

The model follows the **existing `useCheckins` precedent** in `src/data/hooks.ts`
exactly — `useState(initial)` + a `useCallback` mutator, returned from the hook. No new
state library, no global store. Each Me view already renders its own sheet as a child,
so a bubble-up re-render updates that view's chart/list. State lives for the browser
session and is lost on refresh (intentional — the durable store is the Phase 2 backend).

```ts
export function useGoals() {
  const [log, setLog] = useState(weightLog)
  const logWeight = useCallback((input: WeightLogInput) => {
    setLog(prev => [...prev, { ...input, id: crypto.randomUUID() }])
  }, [])
  return { goal, weightLog: log, weightTrends, linkedMesocycles, logWeight }
}
// useSleep → logSleep ; usePeople → logMention (same shape)
```

## Durable contract — payload types

Added to `src/data/types.ts`. These survive into Phase 2 as REST DTOs.

```ts
interface WeightLogInput  { date: string; weightKg: number; note?: string }
interface SleepLogInput   { date: string; bedtime: string; wakeup: string;
                            durationH: number; quality: number; awakenings: number; note?: string }
interface MentionLogInput { personId: string; tone: 'positive' | 'neutral' | 'mixed' | 'negative'; text?: string }
```

Hook mutator signatures (also durable): `logWeight(WeightLogInput)`,
`logSleep(SleepLogInput)`, `logMention(MentionLogInput)`.

Note: the sheets have **no date picker** (the prototype logs "today"). `date` is stamped
to the current day by the mutator at submit time; it is part of the contract because
Phase 2 persists it, not because the UI collects it.

## The five sheets

All built on the `src/components/ui/Sheet.tsx` primitive (portal + slide-up +
drag-to-dismiss), **not** the prototype's raw `sheet-backdrop` div — matching every
existing sheet (`SettingsSheet`, `SportLogSheet`, `CheckInSheet`, the Fuel sheets).
Ported faithfully from the prototype source.

| Sheet | File | Kind | Prototype | Notes |
|-------|------|------|-----------|-------|
| WeightLogSheet | `src/features/me/WeightLogSheet.tsx` | write → `logWeight` | `goals.jsx` 369–435 | ±0.1/±0.5 stepper, big kg readout (prefill `currentWeight`), note ≤200, mezo observation line |
| EditGoalSheet | `src/features/me/EditGoalSheet.tsx` | **display-only** | `goals.jsx` 437–475 | `FieldRow`s (type/start/target/rate/deadline) + identity frame. **No mutation** (parity-faithful — the prototype has no editable inputs) |
| SleepLogSheet | `src/features/me/SleepLogSheet.tsx` | write → `logSleep` | `sleep.jsx` 358–492 | 2× `TimePicker`, computed duration, 1–10 quality grid, awakenings 0–4+, note ≤200, mezo observation |
| PersonLogSheet | `src/features/me/PersonLogSheet.tsx` | write → `logMention` | `people.jsx` 601–708 | decorative voice CTA, person chips, tone (Jó/OK/Vegyes/Nehéz), text ≤240 |
| PersonDetailSheet | `src/features/me/PersonDetailSheet.tsx` | **read-only** | `people.jsx` 486–584 | avatar/affect/cadence/mentions, knownFacts, ties, recent mentions; "Log most" button → opens PersonLogSheet with that person prechosen |

New small sub-components in `src/features/me/components/`: `TimePicker`, `FieldRow`,
`DetailStat`. (`affectColor`/`affectLabel` helpers already exist in `src/data/people.ts`.)

## Trigger wiring (currently inert)

Each view holds a local `useState<…|null>` for "which sheet is open" — same pattern as
`TodayScreen`'s `checkInIdx`.

- **GoalsView** — `+Súly` chip → WeightLogSheet · goal hero tap → EditGoalSheet
- **SleepView** — `+Log` chip → SleepLogSheet
- **PeopleView** — `+Log` chip → PersonLogSheet · `PersonCard` tap → PersonDetailSheet

## Edge cases / decisions

- **Voice CTA is decorative** — no real audio capture in the mock (hold-to-talk visual only).
- **PersonDetail → PersonLog nesting** — the "Log most" button transitions from the detail
  sheet to the log sheet with the current person preselected.
- **EditGoal stays display-only** — approved. Making the goal fields editable (to capture a
  goal-edit write contract for Phase 2) would deviate from parity and is **out of scope
  here**; file a separate bd issue if wanted later.

## Testing & parity

- One `*.test.tsx` per sheet (renders; inputs work; for write sheets, Save bubbles up and
  the hook's backing array grows). Patterned on existing `SportLogSheet` / `useCheckins`
  tests.
- Bubble-up hooks: assert the mutator appends and the list/chart length increases.
- Parity harness: triggers are no longer inert; sheets match the prototype visually.

## Out of scope

- Real persistence / backend (Phase 2).
- Editable goal fields (separate issue if desired).
- Real voice capture.
- Knowledge-graph visualization (separate issue `mezo-2m4`, → Slice 4).
