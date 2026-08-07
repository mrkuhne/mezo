# Today „Három sziget” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Today page's render layer (greeting + pill strip + three stacked faces) with the "three islands" composition — one big island (DS Hero + 1–2 contextual facts + one CTA) and two floating capsules, with an L1 unfold list, phase-swapping evening island, and an anchor-mode melt — per `docs/superpowers/specs/2026-08-07-today-three-islands-design.md`.

**Architecture:** `TodayPage` stays the composition root (all hooks, `act()`, `items` memo, render guards, sheets — unchanged). Everything below `AppHero` is replaced: `IslandSky` lays out three `Island` shells (continuous bubble-morph select), each face's big content is an `Island*` component, the L1 list is `IslandList` (reusing `ItemRow`, `BriefingCard`, `CompanionNoteCard`, `IntentionBanner`), facts come from the new pure `logic/islandFacts.ts`. The logic layer (`dayFace.ts`, `todayItems.ts`, `windDown.ts`, `questAction`/`habitAction`) and the data layer are untouched except one additive change (`useFuelPreview` also returns the full plan).

**Tech Stack:** React 19 + Vite + vitest/@testing-library, plain CSS in `frontend/src/styles/prototype.css` (DS tokens only), react-router `useSearchParams`.

## Global Constraints

- Follow `docs/references/frontend_conventions.md` exactly: deep absolute `@/` imports, no new barrels, no `*Screen`/`*View` names, tests colocated, hooks only from `@/data/hooks`.
- All CSS values from DS tokens (`var(--…)`) — no raw hex except inside existing token definitions. New classes live in `frontend/src/styles/prototype.css`.
- Hungarian UI copy verbatim as given in each task. Decimal comma in displayed numbers (`7,2`).
- Every animation/keyframe added must be disabled under `@media (prefers-reduced-motion: reduce)`, with modifier selectors wrapped in `:where()` (the `todayReducedMotion.test.ts` contract).
- `?dp=` semantics unchanged: `null`/`''`/unknown → current face; selecting the current face deletes the param; writes use `{ replace: true }`.
- Render-guard order unchanged: `anchorMode` first (now renders the melted sky, still before the pending gate), then `sleepGoalPending` → skeleton; `appHero` element rendered by both branches (same node identity).
- Working branch: current worktree branch (`claude/toda-page-redesign-ace010`). Commit after every task with the driving bd id `mezo-euze` in the subject.
- Gate before finishing: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

---

### Task 1: Pure fact derivations — `logic/islandFacts.ts`

**Files:**
- Create: `frontend/src/features/today/logic/islandFacts.ts`
- Test: `frontend/src/features/today/logic/islandFacts.test.ts`

**Interfaces:**
- Consumes: types from `@/data/types` (`SleepEntry`, `SleepGoal`, `WeightEntry`, `FuelSlot`, `QuickStatItem`), `GrowthTodaySummary` from `@/features/today/logic/growthToday`, `minsToBed` from `@/features/today/logic/windDown`.
- Produces (later tasks import these exact names):

```ts
export type FactTone = 'good' | 'warn' | 'muted'
export interface IslandFact {
  label: string                                  // 'Súly' — CSS uppercases
  value: string                                  // '78,6'
  unit?: string                                  // 'kg'
  delta?: { text: string; tone: FactTone }       // { text: '↘ −0,4 a héten · cél 76,0', tone: 'good' }
}
export interface IslandHero { value: string; unit: string; sub: string | null }

export function fallbackHero(openCount: number): IslandHero
export function morningHero(lastNight: SleepEntry | undefined, log: SleepEntry[], goal: SleepGoal): IslandHero | null
export function weightFact(log: WeightEntry[], targetWeight: number | null): IslandFact | null
export function hrvFact(cells: QuickStatItem[]): IslandFact | null
export function proteinFact(slots: FuelSlot[]): IslandFact | null
export function kcalFact(energy: { balance: number; target: number } | null | undefined): IslandFact | null
export function dayBalance(growth: GrowthTodaySummary, dayXp: number): IslandFact
export function sleepOutlook(goal: SleepGoal): IslandFact
export function bedCountdown(now: Date, goal: SleepGoal): IslandHero
```

Behavior contract (implement exactly; all number formatting uses a local `const hu = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',')`):

- `fallbackHero(n)` → `{ value: String(n), unit: 'tétel ma', sub: null }`.
- `morningHero`: `null` when `lastNight` is `undefined`. Otherwise value `hu(lastNight.duration)`, unit `'óra alvás'`. Sub: goal diff `d = lastNight.duration * 60 - goal.targetMinutes` → `d >= 0 ? 'a célod felett' : 'a célod alatt'` with `hu(Math.abs(d) / 60)` hours; plus 7-night debt `debt = Σ over log.slice(-7) of (e.duration*60 − goal.targetMinutes)` (only when `log.length >= 3`, else omit): `` `${hu(Math.abs(d)/60)} órával ${d>=0?'a célod felett':'a célod alatt'}` `` and when included `` ` · heti adósság ${debt<0?'−':'+'}${hu(Math.abs(debt)/60)} óra` ``.
- `weightFact`: `null` on empty log. `value = hu(last.value)`, unit `'kg'`, label `'Súly'`. Delta: find the newest entry whose `date` is ≥ 7 days older than `last.date` (fallback: the oldest entry if the log spans < 7 days but has ≥ 2 entries); `diff = last.value − ref.value`; arrow `diff <= 0 ? '↘' : '↗'`; tone: `'good'` when moving toward `targetWeight` (or `'muted'` when `targetWeight == null`), else `'warn'`; text `` `${arrow} ${diff<0?'−':'+'}${hu(Math.abs(diff))} a héten` `` + (target != null) `` ` · cél ${hu(targetWeight)}` ``. With only 1 entry: no delta.
- `hrvFact`: find `cells.find(c => c.label.toUpperCase().includes('HRV'))` → `null` if absent (real mode); else `{ label: 'HRV', value: cell.value, unit: cell.unit, delta: undefined }`.
- `proteinFact`: slots with numeric `p`; `null` when none. `doneP = Σ p of slots with state === 'done'`, `targetP = Σ p of all`. Value `String(Math.round(doneP))`, unit `'g'`, label `'Fehérje ma'`; delta text `` `cél ${Math.round(targetP)} g` ``, tone `doneP >= targetP * 0.5 ? 'good' : 'warn'`.
- `kcalFact`: `null` when `energy` nullish. Label `'Energia-cél'`, value `String(Math.round(energy.target))`, unit `'kcal'`, delta `` `egyenleg ${energy.balance>=0?'+':'−'}${Math.round(Math.abs(energy.balance))}` `` tone `'muted'`.
- `dayBalance`: label `'Nap mérlege'`, value `` `+${dayXp}` ``, unit `'XP'`, delta `` `${growth.done}/${growth.total} tétel ma` `` tone `'good'`.
- `sleepOutlook`: label `'Alvás-kilátás'`, value `hu(goal.targetMinutes / 60)`, unit `'óra'`, delta `` `ha ${goal.bedTime}-kor lefekszel` `` tone `'muted'`.
- `bedCountdown`: `m = minsToBed(now, goal.bedTime)`. When `m > 0`: value `` `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}` ``, unit `'a villanyoltásig'`, sub `null`. When `m <= 0`: value `goal.bedTime`, unit `'elmúlt'`, sub `null`.

- [ ] **Step 1: Write the failing tests** — `islandFacts.test.ts` with table tests per function. Cover at minimum:

```ts
import { describe, expect, it } from 'vitest'
import { bedCountdown, dayBalance, fallbackHero, hrvFact, kcalFact, morningHero, proteinFact, sleepOutlook, weightFact } from '@/features/today/logic/islandFacts'

const goal = { targetMinutes: 450, anchor: 'WAKE', anchorTime: '06:45', wakeTime: '06:45', bedTime: '23:15', regularityBandMin: 30 } as const
const night = (date: string, duration: number) => ({ date, bedtime: '23:15', wakeup: '06:45', duration, quality: 3, awakenings: 1, mealToSleep: 120, notes: null })

describe('morningHero', () => {
  it('returns null without a last night', () => { expect(morningHero(undefined, [], goal)).toBeNull() })
  it('formats hours with comma and reports below-goal diff', () => {
    const h = morningHero(night('2026-08-07', 7.2), [night('2026-08-07', 7.2)], goal)!
    expect(h.value).toBe('7,2'); expect(h.unit).toBe('óra alvás'); expect(h.sub).toContain('a célod alatt')
  })
  it('adds the weekly debt once the log has 3+ nights', () => {
    const log = [night('2026-08-05', 7.0), night('2026-08-06', 7.0), night('2026-08-07', 7.2)]
    expect(morningHero(log[2], log, goal)!.sub).toContain('heti adósság')
  })
})
describe('weightFact', () => {
  it('null on empty log', () => { expect(weightFact([], 76)).toBeNull() })
  it('7-day delta, good tone toward target, target in text', () => {
    const f = weightFact([{ date: '2026-07-31', value: 79.0 }, { date: '2026-08-07', value: 78.6 }], 76)!
    expect(f.value).toBe('78,6'); expect(f.delta!.text).toContain('−0,4'); expect(f.delta!.tone).toBe('good'); expect(f.delta!.text).toContain('cél 76,0')
  })
  it('warn tone when moving away from target', () => {
    expect(weightFact([{ date: '2026-07-31', value: 78.0 }, { date: '2026-08-07', value: 78.6 }], 76)!.delta!.tone).toBe('warn')
  })
  it('single entry → no delta', () => { expect(weightFact([{ date: '2026-08-07', value: 78.6 }], 76)!.delta).toBeUndefined() })
})
describe('hrvFact', () => {
  it('picks the HRV cell', () => { expect(hrvFact([{ label: 'HRV', value: '64', unit: 'ms' }])!.value).toBe('64') })
  it('null when real mode has no HRV cell', () => { expect(hrvFact([{ label: 'Alvás', value: '7,2', unit: 'h' }])).toBeNull() })
})
describe('proteinFact', () => {
  const slot = (state: 'done' | 'pending', p?: number) => ({ time: '08:00', kind: 'meal', label: 'x', state, p }) as never
  it('sums done vs total protein', () => {
    const f = proteinFact([slot('done', 40), slot('done', 22), slot('pending', 60), slot('pending', 38)])!
    expect(f.value).toBe('62'); expect(f.delta!.text).toBe('cél 160 g')
  })
  it('null when no slot carries protein', () => { expect(proteinFact([slot('done')])).toBeNull() })
})
describe('bedCountdown', () => {
  it('formats H:MM before bed', () => {
    expect(bedCountdown(new Date('2026-08-07T21:30:00'), goal).value).toBe('1:45')
  })
  it('flips to elmúlt after bed', () => {
    const h = bedCountdown(new Date('2026-08-07T23:40:00'), goal)
    expect(h.value).toBe('23:15'); expect(h.unit).toBe('elmúlt')
  })
})
describe('the rest', () => {
  it('fallbackHero / dayBalance / sleepOutlook / kcalFact shapes', () => {
    expect(fallbackHero(3)).toEqual({ value: '3', unit: 'tétel ma', sub: null })
    expect(dayBalance({ done: 9, total: 11, xp: 60 }, 85)).toMatchObject({ value: '+85', unit: 'XP' })
    expect(sleepOutlook(goal)).toMatchObject({ value: '7,5', delta: { text: 'ha 23:15-kor lefekszel' } })
    expect(kcalFact({ balance: 120, target: 2450 })!.delta!.text).toBe('egyenleg +120')
    expect(kcalFact(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `cd frontend && pnpm vitest run src/features/today/logic/islandFacts.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `islandFacts.ts`** per the behavior contract above (pure module; import `minsToBed` from `@/features/today/logic/windDown`).
- [ ] **Step 4: Re-run the test file** → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/features/today/logic/islandFacts.* && git commit -m "feat(today): islandFacts pure fact derivations (mezo-euze)"`.

---

### Task 2: `useFuelPreview` returns the full plan (additive)

**Files:**
- Modify: `frontend/src/data/today/todayHooks.ts:161-…` (the `useFuelPreview` implementation)
- Test: extend `frontend/src/data/today/todayHooks.test.ts` if it exists (it does not — add assertions to the new TodayPage tests instead; no standalone hook test needed).

**Interfaces:**
- Produces: `useFuelPreview(): { visible: FuelSlot[]; nextStack: FuelSlot | undefined; plan: FuelPlanToday | null }` — the existing two fields unchanged, plus the full `FuelPlanToday` the hook already computes internally via `useFuelTimeline()` (expose it; `null` while real mode loads if that is the current internal shape).

- [ ] **Step 1:** Open `todayHooks.ts`, find `useFuelPreview` (L161). Add the composed timeline's plan object to the return: `return { visible, nextStack, plan }` where `plan` is the `FuelPlanToday` value already in scope (adjust to the actual local name — it holds `slots` and `energy`).
- [ ] **Step 2:** `pnpm build` (tsc) → no errors; `pnpm vitest run src/data` → existing data tests stay green.
- [ ] **Step 3: Commit** — `git commit -am "feat(data): useFuelPreview exposes the full fuel plan (mezo-euze)"`.

---

### Task 3: Island shell + sky CSS (`Island.tsx`, `IslandSky.tsx`)

**Files:**
- Create: `frontend/src/features/today/components/Island.tsx`
- Create: `frontend/src/features/today/components/IslandSky.tsx`
- Modify: `frontend/src/styles/prototype.css` (append a new section after the `.wdb-night` block ~L2410)
- Test: `frontend/src/features/today/components/Island.test.tsx`

**Interfaces:**
- Consumes: `DayFace`, `FACE_LABEL`, `FACE_EMOJI` from `@/features/today/logic/dayFace`; `cn` from `@/shared/lib/cn`.
- Produces:

```ts
// Island.tsx
export interface IslandProps {
  face: DayFace
  big: boolean
  nowClock: boolean                      // chronological now — gold ring + MOST tag on the capsule
  capsule: { essence: string; count: string }   // count: '3 ›' | '✓ kész' | '—'
  night?: boolean                        // evening night phase — dark shell
  onSelect: (face: DayFace) => void
  children: React.ReactNode              // the bigview content
}
export function Island(props: IslandProps)

// IslandSky.tsx
export interface IslandSkyProps { anchor: boolean; anchorContent: React.ReactNode; children: React.ReactNode }
export function IslandSky(props: IslandSkyProps)
```

DOM contract (CSS classes below): `Island` renders
`<section class="isl [isl-big] [now-clock] [isl-night]" data-face={face}>` containing `<div class="isl-blob"/>`, a capsule layer `<button class="isl-cap" aria-label={…} onClick={() => onSelect(face)}>` (emoji span aria-hidden, `.isl-cap-t` face label, `.isl-cap-m` essence, optional `.isl-nowtag`MOST, `.isl-cap-n` count) and `<div class="isl-bigview" aria-current={big || undefined}>{children}</div>`. When `big`, the capsule button gets `tabIndex={-1}` and `aria-hidden` (it is opacity-0). Accessible label: `` `${FACE_LABEL[face]}${nowClock ? ' · most' : ''} · ${capsule.essence} · megnyitás` ``.

`IslandSky` renders `<div class={cn('sky-islands', anchor && 'is-anchor')}>` with `{children}` (the three Islands) followed by `<section class="isl isl-anchor"><div class="isl-blob"/><div class="isl-bigview">{anchorContent}</div></section>`.

CSS to append (new section comment `/* ── Today három sziget (mezo-euze) ── */`), token-only, with the reduced-motion counterpart in the SAME section:

```css
.sky-islands{flex:1; display:flex; flex-direction:column; gap:10px; padding:12px 14px; min-height:0; transition:gap .5s ease;}
.isl{position:relative; overflow:hidden; border:1px solid var(--card-border); background:var(--surface-1); box-shadow:var(--shadow-sm); border-radius:29px; flex:0 1 58px; min-height:58px; transition:flex .55s cubic-bezier(.3,.9,.35,1), border-radius .55s cubic-bezier(.3,.9,.35,1), background .6s ease, opacity .45s ease;}
.isl.isl-big{flex:1 1 100%; border-radius:34px; box-shadow:var(--shadow-md);}
.isl-blob{position:absolute; width:300px; height:300px; top:-100px; left:50%; margin-left:-150px; filter:blur(2px); opacity:0; transition:opacity .6s ease; pointer-events:none; z-index:0;}
.isl.isl-big .isl-blob{opacity:.9;}
:where(.isl.isl-big) .isl-blob{animation:isl-morph 9s ease-in-out infinite alternate;}
.isl[data-face="reggel"] .isl-blob{background:radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--accent-base) 34%, transparent), color-mix(in srgb, var(--primary-soft) 25%, transparent) 55%, transparent 75%);}
.isl[data-face="nap"] .isl-blob{background:radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--primary-base) 20%, transparent), color-mix(in srgb, var(--accent-base) 16%, transparent) 55%, transparent 75%);}
.isl[data-face="este"] .isl-blob{background:radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--dv-lav) 30%, transparent), transparent 75%);}
.isl-cap{position:absolute; inset:0; z-index:2; display:flex; align-items:center; gap:10px; padding:0 16px; background:none; border:none; font-family:inherit; text-align:left; cursor:pointer; opacity:1; transition:opacity .22s ease .18s;}
.isl.isl-big .isl-cap{opacity:0; pointer-events:none; transition:opacity .15s ease;}
.isl-cap-t{font-size:13px; font-weight:700; color:var(--ink);}
.isl-cap-m{font-size:11px; color:var(--faint);}
.isl-cap-n{margin-left:auto; font-size:11px; font-weight:700; color:var(--sub); background:var(--surface-recess); padding:4px 10px; border-radius:var(--r-full); white-space:nowrap;}
.isl-nowtag{font-size:8.5px; font-weight:800; letter-spacing:.16em; color:var(--accent-deep); background:var(--accent-bg); border:1px solid var(--accent-soft); padding:2px 7px; border-radius:var(--r-full);}
.isl.now-clock:not(.isl-big){border-color:var(--accent-base); box-shadow:0 0 0 4px color-mix(in srgb, var(--accent-base) 15%, transparent);}
:where(.isl:not(.isl-big)){animation:isl-floaty 5.4s ease-in-out infinite;}
.isl[data-face="reggel"]:not(.isl-big){animation-delay:.8s;}
.isl[data-face="este"]:not(.isl-big){animation-delay:1.6s;}
.isl-bigview{position:relative; z-index:1; display:flex; flex-direction:column; height:100%; padding:22px 18px 16px; text-align:center; min-height:0; opacity:0; pointer-events:none; transition:opacity .32s ease .14s;}
.isl.isl-big .isl-bigview{opacity:1; pointer-events:auto;}
.isl.isl-night{background:linear-gradient(165deg,#28223c,#1d1930); border-color:rgba(255,255,255,.09);}
.isl.isl-anchor{flex:0 1 0px; min-height:0; opacity:0; pointer-events:none; border-width:0;}
.sky-islands.is-anchor{gap:0;}
.sky-islands.is-anchor .isl:not(.isl-anchor){flex:0 1 0px; min-height:0; opacity:0; pointer-events:none; border-width:0; margin:0;}
.sky-islands.is-anchor .isl-anchor{flex:1 1 100%; opacity:1; pointer-events:auto; border-width:1px; border-radius:34px; background:linear-gradient(170deg, var(--primary-bg), var(--surface-page));}
.isl-anchor .isl-blob{opacity:.9; background:radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--rose) 26%, transparent), color-mix(in srgb, var(--accent-base) 16%, transparent) 55%, transparent 78%);}
@keyframes isl-morph{0%{border-radius:58% 42% 55% 45%/50% 58% 42% 50%; transform:translate(-8px,-6px);}50%{border-radius:45% 55% 48% 52%/58% 44% 56% 42%;}100%{border-radius:52% 48% 60% 40%/44% 54% 46% 56%; transform:translate(6px,4px) scale(1.05);}}
@keyframes isl-floaty{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
@media (prefers-reduced-motion: reduce){
  :where(.isl.isl-big) .isl-blob{animation:none;}
  :where(.isl:not(.isl-big)){animation:none;}
  .isl, .isl-cap, .isl-bigview, .sky-islands{transition:none;}
}
```

(If a token named `--rose` is absent in the DS block, use `var(--dv-rose)`.)

- [ ] **Step 1: Write failing tests** — `Island.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Island } from '@/features/today/components/Island'

const base = { face: 'reggel' as const, nowClock: false, capsule: { essence: 'Mobilitás videó a következő', count: '3 ›' }, onSelect: vi.fn() }

describe('Island', () => {
  it('capsule button carries the spoken label and fires onSelect', async () => {
    const onSelect = vi.fn()
    render(<Island {...base} big={false} onSelect={onSelect}>content</Island>)
    await userEvent.click(screen.getByRole('button', { name: 'Reggel · Mobilitás videó a következő · megnyitás' }))
    expect(onSelect).toHaveBeenCalledWith('reggel')
  })
  it('big island hides the capsule from the a11y tree and shows children', () => {
    render(<Island {...base} big>BIG CONTENT</Island>)
    expect(screen.queryByRole('button', { name: /megnyitás/ })).toBeNull()
    expect(screen.getByText('BIG CONTENT')).toBeInTheDocument()
  })
  it('nowClock adds the MOST tag and the label says most', () => {
    render(<Island {...base} big={false} nowClock>x</Island>)
    expect(screen.getByText('MOST')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reggel · most ·/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/features/today/components/Island.test.tsx` → FAIL.
- [ ] **Step 3:** Implement `Island.tsx` + `IslandSky.tsx` per the DOM contract; append the CSS section.
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5: Commit** — `"feat(today): Island shell + IslandSky layout with bubble-morph CSS (mezo-euze)"`.

---

### Task 4: The L1 list — `IslandList.tsx`

**Files:**
- Create: `frontend/src/features/today/components/IslandList.tsx`
- Test: `frontend/src/features/today/components/IslandList.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (same new section: `.isl-l1` family)

**Interfaces:**
- Consumes: `TodayItem` + `ItemRow` idiom exactly as `TodoCard.tsx:43-88` does today (group Map in insertion order, `disabled={habitPending && it.action?.kind === 'habit'}`, action pill from `it.action?.label`); `GrowthTodaySummary`.
- Produces:

```ts
export interface IslandListProps {
  open: TodayItem[]
  done: TodayItem[]
  doneHeading: string                       // 'Kész ma' | 'Ahogy a nap telt'
  dayXp?: number | null                     // evening: closes the done group with `Ma összesen +N XP`
  head?: React.ReactNode                    // BriefingCard / CompanionNoteCard slot (rendered above the groups)
  focus?: React.ReactNode                   // IntentionBanner slot — rendered under a 'Fókusz' group heading
  growth?: GrowthTodaySummary | null        // quest header link (Napi küldetések · d/t · +xp › → /me/growth)
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onClose: () => void
}
export function IslandList(props: IslandListProps)
```

DOM: `<div class="isl-l1">` → `{head}` → per open group: `<div class="isl-grouph">{group}{group === 'Napi küldetések' && growth && <Link to="/me/growth" class="isl-grouph-go">{growth.done}/{growth.total} · +{growth.xp} XP ›</Link>}</div>` + `ItemRow`s (exact prop mapping copied from `TodoCard.tsx`: `tone emoji title subtitle time actionLabel={it.action?.label} onAction={it.action && (() => onAct(it))} linkUrl disabled`) → `{focus}` under `<div class="isl-grouph">Fókusz</div>` when provided → done block under `<div class="isl-grouph">{doneHeading}</div>` with `ItemRow … done` rows and, when `dayXp != null`, `<div class="isl-dayxp">Ma összesen +{dayXp} XP</div>` → `<button class="isl-l1-close" onClick={onClose}>összecsuk ↑</button>`.

CSS: `.isl-l1{overflow-y:auto; flex:1 1 auto; text-align:left; scrollbar-width:none; margin-top:6px;} .isl-l1::-webkit-scrollbar{display:none;} .isl-grouph{display:flex; align-items:baseline; justify-content:space-between; font-size:9px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--faint); margin:14px 2px 6px;} .isl-grouph-go{font-size:10px; letter-spacing:0; text-transform:none; font-weight:700; color:var(--sub);} .isl-l1 .itemrow{margin-bottom:6px;} .isl-dayxp{text-align:center; font-size:12px; font-weight:700; color:var(--success-hover); padding:8px 0;} .isl-l1-close{display:block; width:100%; text-align:center; font-size:12px; font-weight:700; color:var(--sub); background:none; border:none; font-family:inherit; cursor:pointer; padding:10px 0 2px;}` plus the stagger: `:where(.isl-l1) .itemrow{animation:isl-rowin .35s ease both;}` with an nth-child delay ladder capped at `:nth-child(n+8)` (70ms steps like `.faceswap` had) and `@keyframes isl-rowin{from{opacity:0; transform:translateY(6px);}to{opacity:1; transform:none;}}`, disabled in the same reduced-motion block.

- [ ] **Step 1: Write failing tests** (adapt the assertions of `TodoCard.test.tsx` — group order, act payload, action-less row — plus the new done group and close):

```tsx
// key cases:
// 1. groups render in first-appearance order with heading text
// 2. quest group heading carries the growth link to /me/growth
// 3. pill fires onAct with the item; a stripped action renders no button
// 4. done rows render under doneHeading; dayXp renders `Ma összesen +85 XP`
// 5. `összecsuk ↑` fires onClose; habitPending withdraws only habit pills
```

Write them concretely following `TodoCard.test.tsx`'s item factory (copy its `mk` helper).

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `"feat(today): IslandList L1 grouped list (mezo-euze)"`.

---

### Task 5: `IslandMorning.tsx` + shared big-view pieces

**Files:**
- Create: `frontend/src/features/today/components/IslandMorning.tsx`
- Test: `frontend/src/features/today/components/IslandMorning.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (`.isl-hero*`, `.isl-facts*`, `.isl-act*` families)

**Interfaces:**
- Consumes: `IslandHero`/`IslandFact` (Task 1), `TodayItem`, `IslandList` (Task 4), `BriefingCard`, `IntentionBanner`, `ChainCelebrations`.
- Produces:

```ts
export interface IslandMorningProps {
  hero: IslandHero                          // morningHero ?? fallbackHero
  facts: IslandFact[]                       // [weightFact, hrvFact].filter(Boolean) — may be empty
  next: TodayItem | null                    // promoted first open chain step
  open: TodayItem[]; done: TodayItem[]; doneXp: number
  listOpen: boolean; onToggleList: (open: boolean) => void
  briefing: Briefing; briefingDemo?: boolean
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}
export function IslandMorning(props: IslandMorningProps)
```

DOM (closed): `<ChainCelebrations chains={celebrations}/>` → `.isl-hero` (`<div class="isl-hero-v">{hero.value}<span class="isl-hero-u">{hero.unit}</span></div>` + `{hero.sub && <div class="isl-hero-sub">}`) → facts strip `.isl-facts` (each `.isl-fact`: `.isl-fact-v` value+`.isl-fact-u`unit, `.isl-fact-l` label, `.isl-fact-d .is-{tone}` delta text; strip not rendered when `facts.length === 0`) → act row `.isl-act`: primary CTA `<button class="isl-cta np-press">{next.action?.label ?? next.title}</button>` firing `onAct(next)` (when `next` exists; the CTA text: `` `${next.title}${next.subtitle?.match(/^\d+ perc/) ? ` · ${next.subtitle.split(' ')[0]}′` : ''}` `` — simplify: label = `next.title`), plus ghost `<button class="isl-more">még {open.length - (next ? 1 : 0)} ›</button>` → `onToggleList(true)`; below `.isl-doneline` button `✓ {done.length} kész ma · +{doneXp} XP` → `onToggleList(true)` (hidden when `done.length === 0`).
DOM (listOpen): instead of hero/facts/act, render `<div class="isl-openhead">🌅 Reggel</div>` + `<IslandList open={open} done={done} doneHeading="Kész ma" head={<BriefingCard briefing={briefing} demo={briefingDemo}/>} focus={<IntentionBanner variant="chip"/>} growth growth habitPending onAct onClose={() => onToggleList(false)}/>`.

CSS: `.isl-hero-v{font-size:52px; font-weight:200; letter-spacing:-.04em; line-height:1; color:var(--ink); font-variant-numeric:tabular-nums; margin-top:26px;} .isl-hero-u{font-size:19px; font-weight:300; color:var(--faint); margin-left:5px; letter-spacing:0;} .isl-hero-sub{font-size:12px; color:var(--sub); font-weight:500; margin-top:8px;} .isl-facts{display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--line); border-radius:var(--r-lg); overflow:hidden; margin-top:18px;} .isl-fact{background:var(--surface-1); padding:11px 8px 10px; text-align:center;} .isl-fact-v{font-size:19px; font-weight:700; letter-spacing:-.02em;} .isl-fact-u{font-size:10px; font-weight:500; color:var(--faint); margin-left:2px;} .isl-fact-l{font-size:8.5px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--faint); margin-top:2px;} .isl-fact-d{font-size:10px; font-weight:600; margin-top:4px;} .isl-fact-d.is-good{color:var(--success-hover);} .isl-fact-d.is-warn{color:var(--warning-hover, #8a6918);} .isl-fact-d.is-muted{color:var(--faint);} .isl-act{margin-top:auto; padding-top:14px; display:flex; align-items:center; justify-content:center; gap:10px;} .isl-cta{display:inline-flex; align-items:center; gap:6px; padding:11px 20px; border-radius:var(--r-full); background:var(--gradient-cta); color:#fff; font-size:13px; font-weight:700; box-shadow:var(--shadow-cta); border:none; font-family:inherit; cursor:pointer;} .isl-cta.is-lav{background:linear-gradient(135deg,#8d7fc0,#6d5f9c); box-shadow:0 8px 20px rgba(109,95,156,.35);} .isl-more{display:inline-flex; padding:9px 14px; border-radius:var(--r-full); background:transparent; color:var(--sub); font-size:12px; font-weight:600; border:1px solid var(--line); cursor:pointer; font-family:inherit;} .isl-doneline{margin-top:10px; font-size:11.5px; font-weight:600; color:var(--success-hover); background:none; border:none; font-family:inherit; cursor:pointer;} .isl-openhead{font-size:10.5px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:var(--sub); text-align:left;}`

- [ ] **Step 1: failing tests** — hero value/unit render; facts strip absent when `facts=[]`; CTA fires `onAct(next)`; `még N ›` count excludes the promoted item and opens the list (`onToggleList(true)`); open state renders BriefingCard + the Fókusz group + `összecsuk`; doneline hidden at 0 done.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5: Commit** — `"feat(today): IslandMorning big view (mezo-euze)"`.

---

### Task 6: `IslandDay.tsx`

**Files:**
- Create: `frontend/src/features/today/components/IslandDay.tsx`
- Test: `frontend/src/features/today/components/IslandDay.test.tsx`

**Interfaces:**
- Consumes: `DayHero` type — move it out of `FaceDay.tsx`: re-declare verbatim in `IslandDay.tsx` and export it (`export interface DayHero { … }` exactly as in `FaceDay.tsx:20-24`); Task 9 rewires `TodayPage`'s import to `@/features/today/components/IslandDay`.
- Produces:

```ts
export interface IslandDayProps {
  hero: DayHero | null                      // null = rest day
  heroWarn?: string | null                  // niggle detail → warning chip
  facts: IslandFact[]                       // [proteinFact, kcalFact].filter(Boolean)
  mesoLine: string | null                   // '5. mezóhét' — from useToday().user.weekInMeso when present
  open: TodayItem[]; done: TodayItem[]; doneXp: number
  listOpen: boolean; onToggleList: (open: boolean) => void
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onCustom: () => void
}
export function IslandDay(props: IslandDayProps)
```

Closed DOM: celebrations → hero: when `hero` present `.isl-hero-v` = `hero.time ?? '—'` with `.isl-hero-u` = `` `${hero.title}${hero.facts[1] ? ` · ${hero.facts[1]}` : ''}` `` (duration fact); `.isl-hero-sub` = `mesoLine`; when rest day: `.isl-hero-v` `Pihenő` (font-size 36px via `.isl-hero-v.is-word`), sub `Ma nincs tervezett edzés`, and the primary CTA becomes `Saját edzés` → `onCustom()`. → facts strip (same `.isl-facts` markup as Task 5 — extract a tiny local `FactsStrip({ facts })` helper INSIDE `IslandDay.tsx`? No — to keep DRY, create the shared piece in Task 5 as `frontend/src/features/today/components/IslandFactsStrip.tsx` (`export function IslandFactsStrip({ facts }: { facts: IslandFact[] })`) and import it in both. Fold this into Task 5's implementation and reuse here.) → `heroWarn && <div class="isl-warnchip">⚠️ {heroWarn}</div>` (CSS: warning Alert idiom: `background:var(--warning-bg); color:var(--warning-deep); border:1px solid var(--warning-soft); border-radius:var(--r-full); font-size:11px; font-weight:600; padding:5px 12px; margin:14px auto 0; display:inline-flex;`) → act row: hero present → CTA `{hero.ctaLabel ?? 'Indítsuk'}` firing `hero.onLog?.()`; ghost `még N ›`; doneline.
Open DOM: `.isl-openhead` `☀️ Nap` + `IslandList` with `head={note && <CompanionNoteCard note={note}/>}`, `focus={<IntentionBanner variant="chip"/>}`, `doneHeading="Kész ma"`.

- [ ] **Step 1: failing tests** — gym hero renders time+title CTA fires `onLog`; rest day renders `Pihenő` + `Saját edzés` → `onCustom`; warn chip only with `heroWarn`; facts strip; list open shows companion note head.
- [ ] **Step 2-4:** FAIL → implement → PASS. Include creating `IslandFactsStrip.tsx` if Task 5 did not already.
- [ ] **Step 5: Commit** — `"feat(today): IslandDay big view (mezo-euze)"`.

---

### Task 7: `IslandEvening.tsx` — four phases

**Files:**
- Create: `frontend/src/features/today/components/IslandEvening.tsx`
- Test: `frontend/src/features/today/components/IslandEvening.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (`.isl-night*`, `.isl-phase` swap animation)

**Interfaces:**
- Consumes: `useWindDownPhase` (`{ phase, now, goal }`), `bedCountdown`/`dayBalance`/`sleepOutlook` facts (passed in — the component stays presentational where possible but the phase + tick comes from the hook, mirroring `WindDownBanner`'s pattern), `useHabitDay`/`useHabitActions`/`useLevelUp` for the winddown pipa (copy the wiring from `WindDownBanner.tsx:…` — day key `localDateString()`, `check('wind_down')`, consume level-ups via the shared overlay), `useRitualDay` + `ritualWindowState` + `useTodayScenario().ritual` override for the CTA state (copy from `RitualCard.tsx`), `useNavigate`.
- Produces:

```ts
export interface IslandEveningProps {
  open: TodayItem[]; done: TodayItem[]; dayXp: number
  facts: IslandFact[]                       // [dayBalance, sleepOutlook]
  listOpen: boolean; onToggleList: (open: boolean) => void
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}
export function IslandEvening(props: IslandEveningProps)
export function eveningIsNight(phase: WindDownPhase | null): boolean   // = phase === 'night' — TodayPage uses it for the shell's `night` prop… 
```

**Correction (keep it simple):** the shell's dark state must be known by `TodayPage` (it passes `night` to `Island`). Since `useWindDownPhase` is cheap and already page-independent, call it **in `TodayPage`** (Task 9) and pass `phase` down: add `phase: WindDownPhase | null` to `IslandEveningProps`, drop `eveningIsNight`, and let `TodayPage` compute `night = phase === 'night'`. The pipa/ritual wiring stays inside `IslandEvening` (self-fetching like `WindDownBanner`/`RitualCard` were).

Phase rendering (all phases: countdown hero from `bedCountdown(now, goal)` — recompute with the hook's ticking `now`):
- `phase 'none' | null` (normál): hero + sub `` `napzárás ${opensAt}-től · villanyoltás ${goal.bedTime}` `` (opensAt from `useRitualDay().data.window.opensAt`) + facts strip + CTA.
- `'dim'`: sub `ráhangolódás: fény 30 lux alá · szoba ~18 °C`; facts: `[{label:'REM hűvösben', value:'+18', unit:'%', delta:{text:'18 °C-os szobában', tone:'muted'}}, sleepOutlook]` (build the REM fact inline as a const `REM_FACT`).
- `'winddown'`: sub `villanyoltás {goal.bedTime} · képernyők le`; act row gains ghost `Leállás megvolt ✓` → `check('wind_down')` (withdrawn to inert copy while `pending`; flips to a done line `Leállás megvolt` once the habit is `done` — copy the state logic from `WindDownBanner.tsx`). While this phase shows the pipa, the L1 filters out `habit:wind_down` (the same `OWNED_BY_WIND_DOWN_BANNER` rule — implement by filtering `open` before render: `phase === 'winddown' ? open.filter(i => i.id !== 'habit:wind_down') : open`). The ritual-owned filtering (`ritual` source row + `habit:evening_ritual`) moves here too — copy `OWNED_BY_RITUAL_HERO` + the `source !== 'ritual'` filter from `FaceEvening.tsx:26-66` verbatim (the Napzárás row is NOT filtered from L1 — in this design the L1 keeps its `Napzárás` group row as the CTA's list twin? **NO — keep the old rule**: the hero CTA owns the ritual act, so filter `source === 'ritual'` and `habit:evening_ritual` out of the open list exactly as `FaceEvening` did).
- `'night'`: no facts, no CTA; hero `bedCountdown` (elmúlt branch) + `.isl-nightrow` link `🌙 Éjszakai mód megnyitása ›` → `/me/sleep/night`. Light-on-dark text (`.isl-night*` CSS below). `TodayPage` passes `night` so the shell darkens.
- CTA (normál/dim/winddown): from ritual state (`?ritual=` override wins, then `closed → done`, else `ritualWindowState`): `waiting` → CTA disabled-styled label `Napzárás {opensAt}-kor nyílik` (render as `.isl-more` ghost, still navigating to `/ritual` — the window only nudges); `open` → `.isl-cta.is-lav` `Zárjuk le a napot` → `navigate('/ritual')`; `done` → doneline text `Napzárás kész ✓` (no CTA).
- Phase swap animation: wrap the phase content in `<div class="isl-phase" key={phase}>` — CSS `:where(.isl-phase){animation:isl-phasein .45s ease both;} @keyframes isl-phasein{from{opacity:0; transform:translateY(12px);}to{opacity:1; transform:none;}}` + reduced-motion off.
- Open DOM: `.isl-openhead` `🌙 Este` + `IslandList` `doneHeading="Ahogy a nap telt"` `dayXp={dayXp}` `head={note && <CompanionNoteCard note={note}/>}` `focus={<IntentionBanner variant="reflect"/>}`.
- Night CSS: `.isl-night .isl-hero-v{color:#F5EFE6;} .isl-night .isl-hero-u,.isl-night .isl-hero-sub{color:#9c92b8;} .isl-night .isl-openhead{color:#B9ACD9;} .isl-nightrow{display:flex; align-items:center; gap:10px; margin-top:auto; padding:12px 14px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10); border-radius:var(--r-xl); color:#E8E2F5; font-size:13px; font-weight:600; text-decoration:none;}` (the night shell is deliberately theme-invariant dark, like the retired `.wdb-night` — carry over that comment).

- [ ] **Step 1: failing tests** — port the scenarios from `WindDownBanner.test.tsx` and `RitualCard.test.tsx` onto the island: normál renders countdown + lav CTA navigating `/ritual`; dim renders the REM fact and no pipa; winddown offers the pipa exactly once (L1 open shows no `habit:wind_down` row while the pipa shows), pipa fires `check`, in-flight withdraws, done flips the line; night renders the dark entry link and no CTA; `?ritual=done` shows the done line; ritual + `evening_ritual` rows never in L1. Use the same render helpers those tests use (QueryClientProvider + MemoryRouter wrappers — copy the setup blocks).
- [ ] **Step 2-4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `"feat(today): IslandEvening with windDown phases + ritual CTA (mezo-euze)"`.

---

### Task 8: `AnchorIsland.tsx`

**Files:**
- Create: `frontend/src/features/today/components/AnchorIsland.tsx`
- Test: `frontend/src/features/today/components/AnchorIsland.test.tsx`

**Interfaces:**
- Produces: `export function AnchorIsland()` — props none; internally `useNavigate()`.
- Content (port copy/anchors from `AnchorModeView.tsx:17-21` module const `anchors` — reuse the same three `{label, sub, icon}` entries verbatim): eyebrow `.isl-openhead` `🫧 Horgony mód`; coach line (`CoachBubble` with `className="isl-anchor-coach"`, text: `Nehéz nap — ma elég a minimum. Itt vagyok.`); hero `.isl-hero-v` `3` + `.isl-hero-u` `apró horgony`; sub `Semmi lista, semmi elvárás — csak ami jólesik.`; three `ItemRow tone="mind"` rows from the `anchors` const (`actionLabel="Megvolt ✓"`, `onAction` a local no-op `useState` tick that flips the row to `done`); exit `.isl-more` button `Kilépés a horgony módból` → `navigate('/today')` (drops `?day=rough`, same as `AnchorModeView`'s Kilépés chip).

- [ ] **Step 1: failing test** — renders the three anchors + exit navigates to `/today`; ticking a row flips it done locally.
- [ ] **Step 2-4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `"feat(today): AnchorIsland warm melt content (mezo-euze)"`.

---

### Task 9: `TodayPage` re-composition

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`
- Modify: `frontend/src/features/today/pages/TodaySkeleton.tsx`
- Test: rewrite `TodayPage.test.tsx`, `TodayPage.dispatch.test.tsx`, `TodayPage.skeleton.test.tsx`, `TodaySkeleton.test.tsx` (details below)

**Interfaces:**
- Consumes: everything from Tasks 1–8. New hooks added to the page: `useWeight()` (weightLog), `useGoal()` (targetWeight — `goal?.targetWeight ?? null`; import from `@/data/hooks`; if `useGoal` is not on the barrel, add a re-export line `export { useGoal } from '@/data/me/goalHooks'` — check first, it likely already is), extend the `useSleep()` destructure to `{ sleepLog, lastNight, logSleep }`, extend `useFuelPreview()` destructure with `plan`, add `useWindDownPhase()`.
- Produces: the same route component; `TodaySkeleton` default export unchanged.

Precise changes:

1. **Delete** imports/renders of `GreetingHeader`, `DayFaceStrip`, `FaceMorning`, `FaceDay`, `FaceEvening`, the `.faceswap` wrapper and the `dir` state (L149, L226-234's dir writes, L390). Keep `selectFace`'s param semantics (write/delete `?dp=`, `{replace:true}`) minus `setDir`.
2. **Import** `IslandSky`, `Island`, `IslandMorning`, `IslandDay`, `IslandEvening`, `AnchorIsland`, `islandFacts` fns; `DayHero` now from `@/features/today/components/IslandDay`.
3. **New local state:** `const [listOpen, setListOpen] = useState(false)`; reset it inside `selectFace` (`setListOpen(false)`).
4. **Facts memo** (after `growth` L364):

```ts
const morningFactsArr = useMemo(() => [weightFact(weightLog, goal?.targetWeight ?? null), hrvFact(stats)].filter((f): f is IslandFact => f != null), [weightLog, goal, stats])
const dayFactsArr = useMemo(() => [proteinFact(plan?.slots ?? []), kcalFact(plan?.energy)].filter((f): f is IslandFact => f != null), [plan])
const eveningFactsArr = useMemo(() => [dayBalance(growth, dayXp), sleepOutlook(sleepGoal)], [growth, dayXp, sleepGoal])
const mHero = morningHero(lastNight, sleepLog, sleepGoal) ?? fallbackHero(itemsForFace(items, 'reggel').open.length)
```

5. **Capsule essences** (pure inline helpers in the page):

```ts
const essence = (face: Face): { essence: string; count: string } => {
  const f = itemsForFace(items, face)
  const count = f.open.length > 0 ? `${f.open.length} ›` : f.done.length > 0 ? '✓ kész' : '—'
  if (face === 'nap') { const s = sessions[0]; return { essence: s ? `${s.time ?? ''} · ${s.title}`.replace(/^ · /, '') : 'Pihenőnap', count } }
  if (face === 'este') return { essence: `Napzárás ${ritualDay.window.opensAt}-től`, count }
  const next = f.open.find((i) => i.action != null)
  return { essence: next ? `${next.title} a következő` : 'Szabad reggel', count }
}
```

6. **Anchor guard change (L258):** instead of `return <AnchorModeView />`, anchor mode renders the SAME tree with the sky in anchor state (so the melt is animatable and the guard stays synchronous): keep an early-return but of the full page shell: `if (scenario.anchorMode) return <>{appHero}<IslandSky anchor anchorContent={<AnchorIsland/>}>{null}</IslandSky></>` — capsules absent; the melt animation is a progressive-enhancement (URL entry renders the end state directly). **Keep this branch ABOVE the `sleepGoalPending` check** exactly as today.
7. **Render tree** (replacing L375-433's middle):

```tsx
{appHero}
{scenario.vulnerable && <VulnerabilityCard />}
<IslandSky anchor={false} anchorContent={null}>
  <Island face="reggel" big={selected === 'reggel'} nowClock={current === 'reggel'} capsule={essence('reggel')} onSelect={selectFace}>
    {selected === 'reggel' && <IslandMorning hero={mHero} facts={morningFactsArr} next={chainNext} open={open} done={done} doneXp={doneXp} listOpen={listOpen} onToggleList={setListOpen} briefing={briefing ?? resolveBriefing(scenario.dayState)} briefingDemo={briefingDemo} celebrations={celebrationsFor('MORNING')} growth={growth} habitPending={habitPending} onAct={act} />}
  </Island>
  <Island face="nap" big={selected === 'nap'} nowClock={current === 'nap'} capsule={essence('nap')} onSelect={selectFace}>
    {selected === 'nap' && <IslandDay hero={dayHero} heroWarn={scenario.niggle ? workout?.niggleWarning?.detail ?? null : null} facts={dayFactsArr} mesoLine={user.weekInMeso ? `${user.weekInMeso}. mezóhét` : null} open={open} done={done} doneXp={doneXp} listOpen={listOpen} onToggleList={setListOpen} note={companionNote} celebrations={celebrationsFor('DAY')} growth={growth} habitPending={habitPending} onAct={act} onCustom={() => setCustomOpen(true)} />}
  </Island>
  <Island face="este" big={selected === 'este'} nowClock={current === 'este'} night={windPhase === 'night'} capsule={essence('este')} onSelect={selectFace}>
    {selected === 'este' && <IslandEvening phase={windPhase} open={open} done={done} dayXp={dayXp} facts={eveningFactsArr} listOpen={listOpen} onToggleList={setListOpen} note={companionNote} celebrations={celebrationsFor('EVENING')} growth={growth} habitPending={habitPending} onAct={act} />}
  </Island>
</IslandSky>
{/* sheets unchanged */}
```

where `chainNext = open.find((i) => i.action?.kind === 'habit' && i.face === 'reggel') ?? open.find((i) => i.face === 'reggel' && i.action != null) ?? null` (the L352-355 derivation, kept), `open`/`done` = `itemsForFace(items, selected)` filtered by `heroItemId` exactly as before (L269-274), `windPhase = useWindDownPhase().phase`.
8. **`TodaySkeleton`:** replace `.greet` + `.dfs` + `.todaycard` mirror with the island mirror: `role="status" aria-busy`, one `.isl.isl-big` shaped `SkeletonCard` + two `.isl` capsule bars (`Skeleton` rows), no buttons. Keep the default export.
9. **Evening face L1 filtering** stays inside `IslandEvening` (Task 7) — the page passes unfiltered `open`.

Test rewrite map (keep every behavioral guarantee, re-anchor the selectors):
- `TodayPage.test.tsx`: face-selection describe — replace tablist/tab queries with the capsule `getByRole('button', { name: /Nap ·/ })` etc.; `?dp=` write/delete assertions unchanged. Composition describe — drop `.faceswap`/`data-dir` tests (deleted); "retired sections absent" now also asserts `.dfs`, `.greet`, `.tdc` classes absent; morning hero test asserts `.isl-hero-v` sleep value; previews ("Ma még vár rád") are GONE by design — replace with capsule-count assertions; chain-step + mid-chain tick tests: open the L1 first (`click 'még N ›'`) then assert every chain step actionable (same expectations); Napzárás-named-once → assert the evening CTA and the L1 has no ritual row; niggle chip; growth link inside opened L1; evening retrospective + `Ma összesen +N XP` inside opened evening L1; wind-down offered-once trio (winddown phase: pipa on island + no L1 row; dim: only L1 row; outside evening windows: only L1 row).
- `TodayPage.dispatch.test.tsx`: keep ALL scenarios; the only mechanical change is opening the list (`még N ›`) before row-level assertions, and hero CTA assertions move from `FaceHeroCard`/`ItemCard` selectors to `.isl-cta`.
- `TodayPage.skeleton.test.tsx`: unchanged semantics; the resolve-assertion target changes from the navigator to the sky (`.sky-islands`); the `.apphero` same-node assertion stays as-is.
- `TodaySkeleton.test.tsx`: assert the island mirror (1 big + 2 capsule placeholders), inert, `role="status"`.

- [ ] **Step 1:** Rewrite `TodayPage.tsx` + `TodaySkeleton.tsx` per the above. Run `pnpm build` → type errors guide leftover imports.
- [ ] **Step 2:** Rewrite the four test files per the map. Run `pnpm vitest run src/features/today` → iterate to green.
- [ ] **Step 3:** Full both-mode gate: `pnpm test && VITE_USE_MOCK=true pnpm test` → green.
- [ ] **Step 4: Commit** — `"feat(today): three-islands composition root (mezo-euze)"`.

---

### Task 10: Retire the replaced components, CSS and tests

**Files:**
- Delete: `components/DayFaceStrip.tsx(+test)`, `components/GreetingHeader.tsx(+test)`, `components/FaceMorning.tsx`, `components/FaceDay.tsx`, `components/FaceEvening.tsx`, `components/FaceHeroCard.tsx(+test)`, `components/TodoCard.tsx(+test)`, `components/DoneFold.tsx(+test)`, `components/WindDownBanner.tsx(+test)`, `components/RitualCard.tsx(+test)`, `pages/AnchorModeView.tsx(+test)`, and the long-orphaned `components/ActivityLogCard.tsx(+test)`, `components/DailyQuestsCard.tsx(+test)`.
- Keep: `BriefingCard`, `CompanionNoteCard`, `IntentionBanner`, `VulnerabilityCard`, `ChainCelebrations`, all `logic/`, all `sheets/`.
- Modify: `frontend/src/styles/prototype.css` — delete rule families now consumer-less: `.dfs*` (1722-1738), `.greet*` (1427-1434 + the `[data-day] .greet*` tints at 1429-1434), `.tdc*` (1740-1759), `.fhc*` (1761-1776), `.donefold*` (1778-1785), `.zoneline`/`.dayxp` (1787-1794), `.faceswap` block + its keyframes + its reduced-motion entries (1796-1862), `.wdb-night*` (2401-2410), `.anch*` (2362-2396). **Grep before each delete** (`grep -rn "classname" frontend/src`) — delete only zero-consumer families; `.todaycard*`, `.itemrow*`, `.warmstrip`, `.metapill`, `.brief*`, `.creedchip*`, `.reflect*`, `.statstrip*`, `.vuln*` all stay (still consumed).
- Modify: `frontend/src/features/today/todayReducedMotion.test.ts` — retarget from `.faceswap` to the new families: assert `isl-morph`, `isl-floaty`, `isl-rowin`, `isl-phasein` keyframes each have a reduced-motion disable, the disable uses `:where()` + declaration-order supremacy, and the `.isl-l1` nth-child stagger ladder is capped with an open-ended tail. Follow the existing test's raw-CSS parsing style.

- [ ] **Step 1:** Delete files; `pnpm build` → fix any dangling import (expected: none after Task 9).
- [ ] **Step 2:** Delete the CSS families (grep-guarded); update `todayReducedMotion.test.ts`.
- [ ] **Step 3:** `pnpm test && VITE_USE_MOCK=true pnpm test` → green.
- [ ] **Step 4: Commit** — `"refactor(today): retire faces/strip/greeting + dead CSS families (mezo-euze)"`.

---

### Task 11: Visual goldens

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts` (L38-40 today entries — keep the three `?dp=` screens; ADD one `today-este-night` entry `{ name: 'today-este-night', path: '/today?dp=este', clock: '2026-05-21T23:40:00' }` if trivially supported by the harness, else skip) 
- Regenerate: `frontend/tests/visual/visual.spec.ts-snapshots/today-*-darwin.png`

- [ ] **Step 1:** `cd frontend && pnpm test:visual:update` (darwin baselines).
- [ ] **Step 2:** `pnpm test:visual` → green locally; eyeball the three today shots (light+dark) for layout sanity.
- [ ] **Step 3: Commit** — `"chore(visual): regenerate today baselines for three-islands (mezo-euze)"`. (Linux baselines: after push, run `gh workflow run update-visual-baselines.yml -r <branch>` and commit its artifact — done in Task 13.)

---

### Task 12: Docs + ADR

**Files:**
- Create: `docs/decisions/0019-today-three-islands.md` (next free ADR number — `ls docs/decisions/` to confirm; supersedes the *render* layer of ADR 0014, keeps its day-model)
- Modify: `docs/features/today.md` (§summary, §2 behavior, §3 render tree, §9/§10 as affected — overwrite in place, no changelog)
- Modify: `docs/features/_platform-design-system.md` (retired CSS families table + the new `.isl*`/`.sky-islands` family, in the Today subsection)
- Modify: `docs/features/habit.md` / `ritual.md` / `intention.md` — only the cross-references that name `WindDownBanner`/`RitualCard`/`TodoCard` surfaces (grep for the names).

- [ ] **Step 1:** Write ADR 0019 (context: card-pile → guided layers; decision: three islands, hero+facts L0, L1 unfold, phase-swapped evening, anchor melt; consequences incl. retired components).
- [ ] **Step 2:** Update the feature docs; `node scripts/lint-docs.mjs` → today.md clean (the pre-existing stale flags on unrelated docs stay).
- [ ] **Step 3: Commit** — `"docs(today): three-islands feature docs + ADR 0019 (mezo-euze)"`.

---

### Task 13: Gate, PR, merge, deploy

- [ ] **Step 1:** Full gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm test:visual`.
- [ ] **Step 2:** `bd update mezo-euze --claim` (if not yet), then `git pull --rebase`, `bd dolt push`, `git push -u origin HEAD`.
- [ ] **Step 3:** Open self-PR (`gh pr create`), body links the spec + plan; wait for CI green (`gh pr checks --watch`). Run `gh workflow run update-visual-baselines.yml -r <branch>` for linux baselines; commit the regenerated linux PNGs to the branch; CI green again.
- [ ] **Step 4:** `git checkout main && git pull --rebase && git merge --no-ff <branch> && git push` (PR auto-closes). Delete the branch.
- [ ] **Step 5:** Deploy: read `docs/infrastructure/deployment-k3s-argocd.md` FIRST, then follow it (expected: CI release + ArgoCD auto-sync from main — verify the app becomes Healthy/Synced; no manual step unless the doc says so).
- [ ] **Step 6:** `bd close mezo-euze` with a hand-off note; `bd dolt push && git push`; `git status` must show "up to date with origin".

## Self-review notes

- Spec §3 hero/subtitle/facts per island → Tasks 5-7; §4 layers → Task 4 + listOpen wiring in Task 9; §5 phases → Task 7; §6 anchor melt → Tasks 3+8+9(6); §7 motion → Tasks 3,4,7 CSS + Task 10 reduced-motion test; §8 colors → Task 3 CSS (+ evening screen-cooling is deliberately DROPPED from v1 implementation: the phone-frame `[data-day]` canvas already tints the app-level background — noted for the docs task); §9 component fates → Tasks 3-10; §10 facts+honest states → Tasks 1-2 (+HRV real-mode absence via `hrvFact` null); §11 a11y → Tasks 3,9 (labels, aria-current, focus: the focus-management fine-tuning beyond default button focus is follow-up, noted in ADR); §12 tests → every task + Task 11.
- Type consistency checked: `IslandFact`/`IslandHero` (T1) consumed by T5-T7/T9; `IslandListProps.onClose` matches `onToggleList(false)` call sites; `DayHero` moves to `IslandDay`.
- Deliberate spec deviations (record in ADR): day-island facts are protein+kcal (spec's weekly-tonnage cell needs heavy `weekAgenda` wiring — deferred, catalog allows the swap); evening "heti rang" delta simplified to `n/N tétel ma` (no 7-day XP history source); screen-level evening cooling deferred to the existing circadian canvas.
