# Goal System — G4a Goal-Creation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user actually create a goal in-app — a full-screen guided wizard (`/me/goals/new`) that captures the trajectory + quality guards + window + target weight + rate + identity + the BiometricProfile TDEE inputs, then `PUT`s the profile and `POST`s the goal (optionally activating it).

**Architecture:** A new full-screen sibling route `GoalPlanner` modeled on `MesocyclePlanner` (`frontend/src/features/train/MesocyclePlanner.tsx`) — own back-breadcrumb, a 3-segment progress bar, per-step page title, footer nav with `canNext` gating. A `useGoalCreation()` data-layer hook runs the save chain (mock no-op + navigate; real = `biometricProfileApi.upsert` → `goalApi.create` → optional `goalApi.activate` → invalidate). Entry point: a `+ Új cél` affordance in `GoalsView`.

**Tech Stack:** React 19 · react-router-dom · TanStack Query · Vitest + MSW. Reuses `goalApi` (G1) + `biometricProfileApi` (G1) + `useWeight` (G1, for the start-weight prefill).

**Driving issue:** `mezo-pqt` (G4a), child of epic `mezo-2hp`. **Spec:** `docs/superpowers/specs/2026-06-18-goal-system-design.md` (D1 trajectory+guards, D6 hub/funnel, D8 TDEE inputs). **Mockup:** `.superpowers/brainstorm/8732-1781770664/content/goal-funnel.html`.

## Global Constraints

- **Frontend-only.** Backend is fully live (G1): `POST /api/goals` (`goalApi.create(body: GoalUpsertRequest)`), `POST /api/goals/{id}/activate` (`goalApi.activate(id)`), `PUT /api/biometrics/profile` (`biometricProfileApi.upsert(body: BiometricProfileUpsertRequest)`).
- **Contract types (from `api.gen`):** `GoalUpsertRequest = { title, trajectory: 'cut'|'bulk'|'maintain'(pattern), guards?: string[], startDate, targetDate (ISO `date`), startWeightKg, targetWeightKg?, rateTargetPctPerWeek, identityFrame? }`. `BiometricProfileUpsertRequest = { sex: 'M'|'F'(pattern), heightCm, birthDate (ISO), bodyFatPct? }`. Use `satisfies` on bodies (already done inside the api modules).
- **Wizard pattern (mirror `MesocyclePlanner.tsx`):** a sibling route OUTSIDE the `me` children (like `train/mesocycles/new`); `useNavigate`; `step` state + per-step `canNext`; the route sits inside `AppLayout`'s scroller so do NOT nest a second `.screen-content` (see the `mezo-wdk` note in MesocyclePlanner). Hungarian UI; existing global classes (`page-title`, `eyebrow brand`, `cta-primary`, `notch-*`, `chip`, `card`, `label-mono`); design tokens via CSS vars.
- **Dates:** state holds ISO (`YYYY-MM-DD`); `<input type="date">` for start/target/birthDate (like MesocyclePlanner's start date at line 428-435, `colorScheme: 'dark'`). The contract speaks ISO; HU display only where shown.
- **Dual-mode:** mock mode `submit` resolves immediately and navigates (Phase-1 no-op, exactly like `MesocyclePlanner.saveMesocycle` in mock). Real mode runs the API chain. `isMockMode()` inside the hook body.
- **Scope boundary:** G4a is goal CREATION only. The command-center timeline lane UI, the attach/detach hub, and retiring the `toGoal` back-compat mapper are **G4b**. Do NOT touch `GoalsView`'s rendering except to add the `+ Új cél` entry button. Do NOT add plan-linking here (a freshly created goal has no links; G4b attaches them).
- **Gates:** `cd frontend && pnpm test` (real) + `VITE_USE_MOCK=true pnpm test` (mock) + `pnpm build` — all green.

---

### Task 1: `useGoalCreation()` data-layer hook

**Files:**
- Modify: `frontend/src/data/goalHooks.ts` (add the hook + export)
- Modify: `frontend/src/data/hooks.ts` (re-export `useGoalCreation` if hooks are re-exported there — confirm the existing `useGoal` re-export path and match it)
- Test: `frontend/src/data/goalCreation.test.tsx` (new)

**Interfaces:**
- Produces: `useGoalCreation(): { submit: (input: GoalCreationInput, opts?: { onSuccess?: (goal: GoalResponse | null) => void }) => void, pending: boolean }` where `GoalCreationInput = { profile: BiometricProfileUpsertRequest; goal: GoalUpsertRequest; activate: boolean }`.

- [ ] **Step 1: Write the failing test** (`goalCreation.test.tsx`) — real mode: `submit` PUTs the profile, POSTs the goal, activates, and calls `onSuccess` with the created goal

```tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoalCreation } from './goalHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

test('useGoalCreation (real) upserts profile, creates+activates the goal, then onSuccess', async () => {
  const calls: string[] = []
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, () => { calls.push('profile'); return HttpResponse.json({ sex: 'M', heightCm: 180, birthDate: '1991-03-01' }) }),
    http.post(`${API_BASE}/api/goals`, () => { calls.push('goal'); return HttpResponse.json({ id: 'g1', title: 'Nyári cut', trajectory: 'cut', guards: ['strength'], status: 'planned', startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2, rateTargetPctPerWeek: 0.7 }) }),
    http.post(`${API_BASE}/api/goals/g1/activate`, () => { calls.push('activate'); return HttpResponse.json({ id: 'g1', status: 'active' }) }),
  )
  const onSuccess = vi.fn()
  const { result } = renderHook(() => useGoalCreation(), { wrapper: makeHookWrapper() })
  act(() => result.current.submit(
    { profile: { sex: 'M', heightCm: 180, birthDate: '1991-03-01' },
      goal: { title: 'Nyári cut', trajectory: 'cut', guards: ['strength'], startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2, rateTargetPctPerWeek: 0.7 },
      activate: true },
    { onSuccess }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(calls).toEqual(['profile', 'goal', 'activate'])
})
```

> Confirm the harness imports against `goalHooks.test.tsx` (same `@/test/msw/...` + `@/test/queryWrapper`).

- [ ] **Step 2: Run** — `cd frontend && pnpm test -- goalCreation` → FAIL (`useGoalCreation` not exported).

- [ ] **Step 3: Implement `useGoalCreation`** in `goalHooks.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { goalApi, type GoalUpsertRequest } from '@/lib/goalApi'
import { biometricProfileApi, type BiometricProfileUpsertRequest } from '@/lib/biometricProfileApi'
// ... (existing imports stay)

export type GoalCreationInput = {
  profile: BiometricProfileUpsertRequest
  goal: GoalUpsertRequest
  activate: boolean
}

export function useGoalCreation() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (input: GoalCreationInput): Promise<GoalResponse | null> => {
      if (mock) return null // Phase-1 no-op; the wizard just navigates back (parity with MesocyclePlanner)
      await biometricProfileApi.upsert(input.profile)
      const created = await goalApi.create(input.goal)
      if (input.activate) await goalApi.activate(created.id)
      return created
    },
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['goals'] }) },
  })
  const submit = useCallback(
    (input: GoalCreationInput, opts?: { onSuccess?: (goal: GoalResponse | null) => void }) =>
      mutation.mutate(input, { onSuccess: opts?.onSuccess }),
    [mutation],
  )
  return { submit, pending: mutation.isPending }
}
```

> Add the `useCallback`/`useMutation`/`useQueryClient` imports. `goalApi.activate(id)` + `biometricProfileApi.upsert(body)` exist from G1. Mock mode returns `null` so `submit`'s `onSuccess(null)` still fires → the wizard navigates.

- [ ] **Step 4: Re-export** from `hooks.ts` if the project re-exports data hooks there (match the `export { useGoal } from './goalHooks'` line). Run `cd frontend && pnpm test -- goalCreation` → PASS.

- [ ] **Step 5: Commit** — `git add frontend/src/data && git commit -m "feat(fe): useGoalCreation hook (profile+goal+activate chain) (mezo-pqt)"`

---

### Task 2: `GoalPlanner` wizard shell + Step 0 (Cél: trajectory + guards)

**Files:**
- Create: `frontend/src/features/me/GoalPlanner.tsx`
- Test: `frontend/src/features/me/GoalPlanner.test.tsx`

**Interfaces:**
- Consumes: `useNavigate`, `useGoalCreation` (Task 1), `useWeight` (start-weight prefill). 3-step wizard state.
- Produces: `export function GoalPlanner()`.

- [ ] **Step 1: Write the failing test** (renders step 0, trajectory + guards selectable, step counter)

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper' // match the named export used by other feature tests
import { GoalPlanner } from './GoalPlanner'

test('GoalPlanner step 0 picks a trajectory and a guard', () => {
  render(<QueryWrapper><MemoryRouter><GoalPlanner /></MemoryRouter></QueryWrapper>)
  expect(screen.getByText('Mit építünk?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /erő megtartása/i }))
  // Tovább becomes enabled once a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeEnabled()
})
```

> Inspect `MesocyclePlanner.test.tsx` for the exact wrapper import (`QueryWrapper` vs `makeHookWrapper`) + whether a router is needed, and match it.

- [ ] **Step 2: Run** → FAIL (no `GoalPlanner`).

- [ ] **Step 3: Write `GoalPlanner.tsx`** — the shell + Step 0. Model the shell (breadcrumb, 3-seg progress, eyebrow step counter, page title, footer) on `MesocyclePlanner.tsx` lines 134-272. State:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoalCreation } from '@/data/hooks'
import { useWeight } from '@/data/hooks'
import { Icon } from '@/components/ui/Icon'

type Trajectory = 'cut' | 'bulk' | 'maintain'
type Guard = 'strength' | 'muscle'
const STEP_TITLES = ['Mit építünk?', 'Mennyi időnk van?', 'Profil a TDEE-hez'] as const
const STEP_COUNT = 3
const TRAJECTORIES: { id: Trajectory; label: string; sub: string; icon: string }[] = [
  { id: 'cut', label: 'Fogyás', sub: '↓ deficit', icon: 'minus' },
  { id: 'bulk', label: 'Hízás', sub: '↑ surplus', icon: 'plus' },
  { id: 'maintain', label: 'Szinten tartás', sub: '≈ tartás', icon: 'check' },
]
const GUARDS: { id: Guard; label: string }[] = [
  { id: 'strength', label: 'Erő megtartása' },
  { id: 'muscle', label: 'Izom megtartása' },
]

export function GoalPlanner() {
  const navigate = useNavigate()
  const { submit, pending } = useGoalCreation()
  const { weightLog } = useWeight()
  const latestWeight = weightLog.length ? weightLog[weightLog.length - 1].value : 80
  const [step, setStep] = useState(0)
  // Step 0
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null)
  const [guards, setGuards] = useState<Guard[]>([])
  // Step 1
  const [title, setTitle] = useState('')
  const [startDateIso, setStartDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [targetDateIso, setTargetDateIso] = useState(() => new Date(Date.now() + 56 * 864e5).toISOString().slice(0, 10))
  const [startWeight, setStartWeight] = useState(latestWeight)
  const [targetWeight, setTargetWeight] = useState(latestWeight)
  const [rate, setRate] = useState(0.7)
  const [identity, setIdentity] = useState('')
  // Step 2
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const [heightCm, setHeightCm] = useState(180)
  const [birthDateIso, setBirthDateIso] = useState('1991-03-01')
  const [bodyFat, setBodyFat] = useState<number | ''>('')

  const backToGoals = () => navigate('/me/goals')
  const toggleGuard = (g: Guard) => setGuards(cur => cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g])

  const canNext =
    (step === 0 && !!trajectory) ||
    (step === 1 && title.trim().length > 0 && targetDateIso > startDateIso) ||
    step === 2

  const save = (activate: boolean) => {
    if (!trajectory) return
    submit(
      {
        profile: { sex, heightCm, birthDate: birthDateIso, ...(bodyFat !== '' ? { bodyFatPct: Number(bodyFat) } : {}) },
        goal: {
          title: title || `${TRAJECTORIES.find(t => t.id === trajectory)!.label} cél`,
          trajectory, guards,
          startDate: startDateIso, targetDate: targetDateIso,
          startWeightKg: startWeight,
          ...(trajectory !== 'maintain' ? { targetWeightKg: targetWeight } : {}),
          rateTargetPctPerWeek: rate,
          ...(identity ? { identityFrame: identity } : {}),
        },
        activate,
      },
      { onSuccess: backToGoals },
    )
  }

  return (
    <div>
      {/* Breadcrumb — mirror MesocyclePlanner:138-144 */}
      <div className="sticky-top" style={{ padding: '8px 24px' }}>
        <button type="button" className="row gap-sm" onClick={() => (step > 0 ? setStep(step - 1) : backToGoals())}>
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>←</span>
          <span className="eyebrow">{step === 0 ? 'Cél' : STEP_TITLES[step - 1]}</span>
        </button>
      </div>

      <div style={{ padding: '6px 24px 0' }}>
        {/* 3-seg progress — mirror MesocyclePlanner:149-169 */}
        <div className="row gap-xs" style={{ marginBottom: 14 }}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <button key={i} type="button" aria-label={`${i + 1}. lépés`} onClick={() => { if (i < step) setStep(i) }}
              style={{ flex: 1, height: 3, background: i <= step ? 'var(--brand-glow)' : 'var(--surface-2)',
                boxShadow: i === step ? '0 0 6px var(--brand-glow)' : 'none', padding: 0, cursor: i < step ? 'pointer' : 'default' }} />
          ))}
        </div>
        <span className="eyebrow brand">{String(step + 1).padStart(2, '0')} / {String(STEP_COUNT).padStart(2, '0')}</span>
        <div className="page-title mt-sm">{STEP_TITLES[step]}</div>
      </div>

      {step === 0 && (
        <div style={{ padding: '8px 24px' }}>
          <div style={{ marginTop: 8 }}><span className="eyebrow">Súly-trajektória</span></div>
          <div className="col gap-sm" style={{ marginTop: 8 }}>
            {TRAJECTORIES.map(t => {
              const sel = trajectory === t.id
              return (
                <button key={t.id} type="button" onClick={() => setTrajectory(t.id)} className="card notch-8"
                  style={{ padding: 14, textAlign: 'left', width: '100%', background: sel ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)' : 'var(--surface-1)', borderColor: sel ? 'var(--border-brand)' : 'var(--border-subtle)' }}>
                  <div className="row gap-md" style={{ alignItems: 'center' }}>
                    <Icon name={t.icon as never} size={18} color={sel ? 'var(--brand-glow)' : 'var(--text-secondary)'} />
                    <div className="col">
                      <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, color: sel ? 'var(--brand-glow)' : 'var(--text-primary)' }}>{t.label}</span>
                      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.sub}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 18 }}><span className="eyebrow">Mit védesz közben? · gard</span></div>
          <div className="row gap-sm" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {GUARDS.map(g => {
              const on = guards.includes(g.id)
              return (
                <button key={g.id} type="button" onClick={() => toggleGuard(g.id)} className="chip"
                  style={{ padding: '8px 11px', background: on ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)' : 'var(--surface-1)', borderColor: on ? 'var(--border-brand)' : 'var(--border-subtle)', color: on ? 'var(--brand-glow)' : 'var(--text-secondary)' }}>
                  {on ? '✓ ' : ''}{g.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 1 && <Step1 {...{ title, setTitle, startDateIso, setStartDateIso, targetDateIso, setTargetDateIso, startWeight, setStartWeight, targetWeight, setTargetWeight, rate, setRate, identity, setIdentity, trajectory }} />}
      {step === 2 && <Step2 {...{ sex, setSex, heightCm, setHeightCm, birthDateIso, setBirthDateIso, bodyFat, setBodyFat }} />}

      {/* Footer nav — mirror MesocyclePlanner:217-268 */}
      <div style={{ padding: '16px 24px 32px' }}>
        {step < 2 ? (
          <div className="row gap-sm">
            {step > 0 && <button type="button" className="cta-ghost notch-4 flex-1" style={{ padding: 14 }} onClick={() => setStep(step - 1)}>Vissza</button>}
            <button type="button" className="cta-primary notch-8" disabled={!canNext}
              style={{ flex: step > 0 ? 2 : 1, opacity: canNext ? 1 : 0.4, pointerEvents: canNext ? 'auto' : 'none', padding: 14 }}
              onClick={() => setStep(step + 1)}>Tovább →</button>
          </div>
        ) : (
          <div className="col gap-sm">
            <button type="button" className="cta-primary notch-8" disabled={pending} style={{ padding: 14, opacity: pending ? 0.5 : 1 }} onClick={() => save(true)}>
              <Icon name="check" size={16} /> <span>Cél létrehozása + aktiválás</span>
            </button>
            <button type="button" className="cta-ghost notch-4" disabled={pending} style={{ padding: 12, opacity: pending ? 0.5 : 1 }} onClick={() => save(false)}>Mentés tervezettként</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

> `Step1`/`Step2` are defined in Task 3 — for THIS task, stub them as `function Step1() { return null }` / `function Step2() { return null }` at the bottom of the file so it compiles and the step-0 test passes; Task 3 fills them in. The `Icon name={t.icon as never}` cast avoids an icon-name-union mismatch if `minus`/`plus`/`check` aren't all in the `IconName` union — confirm the real `IconName` values and use valid ones (drop the cast if they're valid).

- [ ] **Step 4: Run** — `cd frontend && pnpm test -- GoalPlanner` → PASS (step-0 test). `pnpm build` → succeeds (stubbed Step1/Step2 compile).

- [ ] **Step 5: Commit** — `git add frontend/src/features/me/GoalPlanner.tsx frontend/src/features/me/GoalPlanner.test.tsx && git commit -m "feat(fe): GoalPlanner wizard shell + Step 0 (trajectory+guards) (mezo-pqt)"`

---

### Task 3: Step 1 (Ablak + súly) + Step 2 (Profil / TDEE)

**Files:**
- Modify: `frontend/src/features/me/GoalPlanner.tsx` (replace the `Step1`/`Step2` stubs with the real field steps)

**Interfaces:**
- Consumes: the props passed from `GoalPlanner` (Task 2). Produces the two step components.

- [ ] **Step 1: Replace the `Step1` stub** — a labeled-field step: title input, start/target `<input type="date">`, start/target weight number inputs, rate number input, identity textarea. (For `maintain` trajectory, hide the target-weight field.) Use the `MesocyclePlanner` Step1 field idiom (`label-mono` + `.card.notch-4` wrapping the input, lines 410-444). Keep it lean — one `.col gap-md` of fields.

```tsx
function Step1({ title, setTitle, startDateIso, setStartDateIso, targetDateIso, setTargetDateIso, startWeight, setStartWeight, targetWeight, setTargetWeight, rate, setRate, identity, setIdentity, trajectory }: {
  title: string; setTitle: (v: string) => void; startDateIso: string; setStartDateIso: (v: string) => void
  targetDateIso: string; setTargetDateIso: (v: string) => void; startWeight: number; setStartWeight: (v: number) => void
  targetWeight: number; setTargetWeight: (v: number) => void; rate: number; setRate: (v: number) => void
  identity: string; setIdentity: (v: string) => void; trajectory: 'cut' | 'bulk' | 'maintain' | null
}) {
  const field = (label: string, input: React.ReactNode) => (
    <div className="col gap-sm"><span className="label-mono">{label}</span><div className="card notch-4" style={{ padding: 10 }}>{input}</div></div>
  )
  const numStyle = { width: '100%', fontSize: 14, color: 'var(--text-primary)' } as const
  const dateStyle = { width: '100%', fontSize: 13, color: 'var(--text-primary)', colorScheme: 'dark' } as const
  return (
    <div style={{ padding: '8px 24px' }}>
      <div className="col gap-md">
        {field('Cél neve', <input value={title} onChange={e => setTitle(e.target.value)} aria-label="Cél neve" placeholder="pl. Nyári cut" style={numStyle} />)}
        <div className="row gap-sm">
          <div className="flex-1">{field('Kezdés', <input type="date" value={startDateIso} onChange={e => setStartDateIso(e.target.value)} aria-label="Kezdés" style={dateStyle} />)}</div>
          <div className="flex-1">{field('Cél dátum', <input type="date" value={targetDateIso} onChange={e => setTargetDateIso(e.target.value)} aria-label="Cél dátum" style={dateStyle} />)}</div>
        </div>
        <div className="row gap-sm">
          <div className="flex-1">{field('Start súly (kg)', <input type="number" step="0.1" value={startWeight} onChange={e => setStartWeight(Number(e.target.value))} aria-label="Start súly" style={numStyle} />)}</div>
          {trajectory !== 'maintain' && <div className="flex-1">{field('Cél súly (kg)', <input type="number" step="0.1" value={targetWeight} onChange={e => setTargetWeight(Number(e.target.value))} aria-label="Cél súly" style={numStyle} />)}</div>}
        </div>
        {field('Heti tempó (%/hét)', <input type="number" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))} aria-label="Heti tempó" style={numStyle} />)}
        {field('Identity frame · opcionális', <textarea value={identity} onChange={e => setIdentity(e.target.value.slice(0, 200))} aria-label="Identity frame" placeholder='pl. "Erő megtartva — nem csak a szám."' style={{ ...numStyle, minHeight: 48, resize: 'none', lineHeight: 1.45 }} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace the `Step2` stub** — the BiometricProfile TDEE inputs: sex (M/F toggle), height, birthDate, body-fat (optional). Add a Mezo hint card explaining these feed the TDEE estimate.

```tsx
function Step2({ sex, setSex, heightCm, setHeightCm, birthDateIso, setBirthDateIso, bodyFat, setBodyFat }: {
  sex: 'M' | 'F'; setSex: (v: 'M' | 'F') => void; heightCm: number; setHeightCm: (v: number) => void
  birthDateIso: string; setBirthDateIso: (v: string) => void; bodyFat: number | ''; setBodyFat: (v: number | '') => void
}) {
  const field = (label: string, input: React.ReactNode) => (
    <div className="col gap-sm"><span className="label-mono">{label}</span><div className="card notch-4" style={{ padding: 10 }}>{input}</div></div>
  )
  const numStyle = { width: '100%', fontSize: 14, color: 'var(--text-primary)' } as const
  return (
    <div style={{ padding: '8px 24px' }}>
      <div className="col gap-md">
        <div className="col gap-sm">
          <span className="label-mono">Nem</span>
          <div className="row gap-xs">
            {(['M', 'F'] as const).map(s => (
              <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)} className="flex-1 notch-4"
                style={{ padding: '12px 0', background: sex === s ? 'color-mix(in srgb, var(--brand-glow) 12%, transparent)' : 'var(--surface-1)', border: `1px solid ${sex === s ? 'var(--brand-glow)' : 'var(--border-subtle)'}`, color: sex === s ? 'var(--brand-glow)' : 'var(--text-secondary)', fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 600 }}>
                {s === 'M' ? 'Férfi' : 'Nő'}
              </button>
            ))}
          </div>
        </div>
        {field('Testmagasság (cm)', <input type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} aria-label="Testmagasság" style={numStyle} />)}
        {field('Születési dátum', <input type="date" value={birthDateIso} onChange={e => setBirthDateIso(e.target.value)} aria-label="Születési dátum" style={{ ...numStyle, fontSize: 13, colorScheme: 'dark' }} />)}
        {field('Testzsír % · opcionális', <input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Testzsír" placeholder="pl. 15" style={numStyle} />)}
      </div>
      <div className="card notch-4 mt-lg" style={{ padding: 12, background: 'color-mix(in srgb, var(--brand-glow) 6%, transparent)' }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--brand-glow)" />
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)' }}>Ezekből számolja a Mezo a napi energiaigényedet (TDEE). Ha megadod a testzsírt, pontosabb a becslés.</p>
        </div>
      </div>
    </div>
  )
}
```

> Confirm `Icon name="sparkle"` is a valid `IconName` (used elsewhere, e.g. WeightLogSheet); if not, use a valid one.

- [ ] **Step 3: Run** — `cd frontend && pnpm test -- GoalPlanner && pnpm build` → PASS.

- [ ] **Step 4: Commit** — `git add frontend/src/features/me/GoalPlanner.tsx && git commit -m "feat(fe): GoalPlanner Step 1 (window+weights) + Step 2 (TDEE profile) (mezo-pqt)"`

---

### Task 4: Route `/me/goals/new` + `GoalsView` `+ Új cél` entry + integration test

**Files:**
- Modify: `frontend/src/app/router.tsx` (add the sibling route)
- Modify: `frontend/src/features/me/views/GoalsView.tsx` (a `+ Új cél` button → navigate)
- Test: extend `GoalPlanner.test.tsx` with a save-flow test

**Interfaces:**
- Consumes: `GoalPlanner` (Tasks 2-3).

- [ ] **Step 1: Add the route** — in `router.tsx`, import `GoalPlanner` and add a SIBLING route (outside the `me` children, like `train/mesocycles/new`): `{ path: 'me/goals/new', element: <GoalPlanner /> },` (place it next to the other full-screen sibling routes).

- [ ] **Step 2: Add the `+ Új cél` entry to `GoalsView`** — in the `.page-header` (`GoalsView.tsx`), add a chip button next to the title: `<button className="chip" onClick={() => navigate('/me/goals/new')}><Icon name="plus" size={12} /> Új cél</button>` (import `useNavigate`, add `const navigate = useNavigate()`). This is the ONLY GoalsView change in G4a.

- [ ] **Step 3: Add the save-flow test** to `GoalPlanner.test.tsx` (real mode): walk step 0→1→2, fill the minimum, click `Cél létrehozása + aktiválás`, assert the MSW PUT-profile + POST-goal + activate fire and the wizard navigates. (Reuse the MSW handlers from Task 1's test; assert navigation via a `MemoryRouter` + a route spy, or assert the mutation calls.)

```tsx
test('GoalPlanner real-mode save posts profile+goal and navigates', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, () => { calls.push('profile'); return HttpResponse.json({}) }),
    http.post(`${API_BASE}/api/goals`, () => { calls.push('goal'); return HttpResponse.json({ id: 'g1', status: 'planned' }) }),
    http.post(`${API_BASE}/api/goals/g1/activate`, () => { calls.push('activate'); return HttpResponse.json({ id: 'g1', status: 'active' }) }),
  )
  render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals/new']}><GoalPlanner /></MemoryRouter></QueryWrapper>)
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  fireEvent.change(screen.getByLabelText('Cél neve'), { target: { value: 'Nyári cut' } })
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  fireEvent.click(screen.getByRole('button', { name: /létrehozása \+ aktiválás/i }))
  await waitFor(() => expect(calls).toEqual(['profile', 'goal', 'activate']))
  vi.unstubAllEnvs()
})
```

> Add the `server`/`API_BASE`/`http`/`HttpResponse`/`waitFor` imports to the test. The default target date (start + 56 days) already satisfies `targetDateIso > startDateIso`, so step 1's `canNext` passes with just the title.

- [ ] **Step 4: Run** — `cd frontend && pnpm test -- GoalPlanner` → PASS. `pnpm build` → PASS.

- [ ] **Step 5: Commit** — `git add frontend/src/app/router.tsx frontend/src/features/me/views/GoalsView.tsx frontend/src/features/me/GoalPlanner.test.tsx && git commit -m "feat(fe): /me/goals/new route + GoalsView entry + save-flow test (mezo-pqt)"`

---

### Task 5: Full gates + docs

- [ ] **Step 1: Full FE gates** — `cd frontend && pnpm test` (real) + `VITE_USE_MOCK=true pnpm test` (mock) + `pnpm build` → all PASS. (Mock mode: the wizard's `submit` no-ops + navigates — confirm a mock-mode walk-through doesn't error.)
- [ ] **Step 2: Docs** — update `docs/features/me.md` (the Cél section: goal creation now exists via `GoalPlanner` at `/me/goals/new`; the `+ Új cél` entry; the TDEE inputs captured into `BiometricProfile`). `file:line` pointers, no pasted code. Run `node scripts/lint-docs.mjs` → PASS (bump any incidentally-drifted doc's `updated:` only if its content is verified-current).
- [ ] **Step 3: Commit** — `git add frontend docs/features/me.md && git commit -m "docs(features): goal-creation wizard + green gates (mezo-pqt)"`

---

## Self-review notes (controller)

- **Spec coverage:** trajectory + guards (D1) ✓ Task 2; window + target + rate + identity ✓ Task 3; TDEE/BiometricProfile inputs (D8) ✓ Task 3; POST goal + activate + PUT profile ✓ Task 1; entry point ✓ Task 4.
- **Scope boundary held:** no command-center timeline UI, no attach/detach hub, no `toGoal` retirement (all G4b); `GoalsView` only gains the entry button.
- **Type consistency:** `GoalCreationInput` (Task 1) is consumed verbatim by `GoalPlanner.save` (Task 2); the `submit(input, { onSuccess })` signature matches between hook + wizard.
- **Known follow-ups:** `mezo-b0k` (the goal-upsert `targetDate >= startDate` validation) — the wizard's `canNext` for step 1 already requires `targetDateIso > startDateIso`, which mitigates the inverted-date 500 from the UI; the backend guard still belongs in `mezo-b0k`.

## Post-G4a

- **G4b** — the command-center: timeline lane view (`goal-timeline.html`), attach/detach hub (plan slots launching `MesocyclePlanner`/`RunningBlockBuilder` or attaching existing via `goalLinkApi`), retire the `toGoal` back-compat mapper, the `rateTarget` display (`mezo-5om`).
- **G5** — the TDEE/prescription engine.
