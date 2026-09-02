# Growth Hub + 4 Sub-pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the segment-switch `GrowthPage` with a one-screen Growth hub (live hero + Ma strip + 2×2 mosaic) and four full-page siblings (`/me/growth/skillek|rutin|naplo|kituntetesek`), 1:1 with `docs/design_2.0/prototypes/growth-tab.html`, per `docs/superpowers/specs/2026-09-02-growth-hub-design.md`.

**Architecture:** Recompose, not reinvent — every TanStack hook, mutation and honest-state rule stays; only the render layer changes. Pages follow the Fuel/Edzés hub idiom (`MozaikPage` → `PageHead` → `EntranceGroup` → hero → tiles) and the Karakter flat-sibling-route idiom. One new data hook (`useGrowthWeek`) reads an already-live endpoint. CSS lives in `frontend/src/styles/prototype.css` (Growth block rewritten, prototype px ×1.18, tokens in both `:root` blocks).

**Tech Stack:** React 19 + Vite, TanStack Query (dual mode via `useDualQuery`), react-router, vitest + Testing Library + MSW, Playwright visual goldens, pnpm 9.

## Global Constraints

- bd: dev issue **mezo-rmi0.1** (parent design issue mezo-rmi0). Commit subjects: `feat(me): … (mezo-rmi0.1)` / `test(me): …` / `docs(…): …`.
- Repo root: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/tudastar-knowledge-sync-5c11f5`. Frontend: `frontend/`. Run all `pnpm` commands from `frontend/`. Never `cd` to the primary repo.
- **Both test modes**: `VITE_USE_MOCK=false pnpm test <file>` AND `VITE_USE_MOCK=true pnpm test <file>` (unset = mock). CI runs the full suite in both.
- **Zero contract change.** No edits under `api/` or `frontend/src/data/_client/`.
- **Guardrails** (ADR 0010, handoff §2): never red / terracotta for a miss; no countdowns; nothing self-completes a quest; XP never gates; missing data source renders NOTHING (not `—`) except `StatCell` where a null stat renders `—`. HU copy verbatim from the spec.
- **Clay, not emoji** in new render output for LIFE skills (`levelUpMeta.test.ts` guards the 8 LIFE emoji). Badge `b.icon` (backend emoji) stays.
- **No hex/rgba literals in TSX** for new code — `var(--mz-*)` tokens only. Every new `--mz-*` token is declared in BOTH `:root` (light, ~line 159–271) and `:root[data-theme="dark"]` (~line 449–560) of `prototype.css`; `mozaikCssTokens.test.ts` enforces it.
- `.rise` elements only inside an `EntranceGroup`; `rise` children carry `style={{ '--d': 'Nms' }}`.
- Number formatting: `huInt` / `hu1` from `@/shared/lib/huNum` (not `toLocaleString`).
- After adding/renaming files under `frontend/src/features/**` or `frontend/src/data/**`: run `node scripts/gen-codemap.mjs` from the repo root and commit `docs/CODEMAP.md` in the same commit (CI `--check` gate).
- Prototype px → implementation px is ×1.18 (330 → 390 frame). Values below are already scaled.

---

### Task 1: `mondayOf` date helper + `useGrowthWeek` hook (data layer)

**Files:**
- Modify: `frontend/src/shared/lib/dates.ts` (append)
- Test: `frontend/src/shared/lib/dates.test.ts` (append; create if missing)
- Modify: `frontend/src/data/progression/progressionApi.ts` (add `getGrowthWeek`)
- Create: `frontend/src/data/progression/growthWeekMock.ts`
- Modify: `frontend/src/data/progression/progressionHooks.ts` (add `useGrowthWeek`)
- Modify: `frontend/src/data/hooks.ts:52` (export `useGrowthWeek`)
- Modify: `frontend/src/test/msw/handlers.ts` (add `GET /api/progression/growth-week/:date` after the achievements handler ~line 500)
- Test: `frontend/src/data/progression/progressionHooks.test.tsx` (append)

**Interfaces:**
- Produces: `mondayOf(iso: string): string` — ISO Monday of the week containing `iso`.
- Produces: `type GrowthWeek = components['schemas']['GrowthWeekResponse']` (`{ weekStart, questCompleted, questClosed, lifeXp, activities, savingsHuf }`).
- Produces: `useGrowthWeek(weekStartIso: string): { data: GrowthWeek | null; isPending: boolean; isError: boolean }` — `null` while unresolved / on 404 / on error in real mode; the fixture in mock mode.

- [ ] **Step 1: Write the failing `mondayOf` test**

Append to `frontend/src/shared/lib/dates.test.ts` (create the file with the imports if it does not exist):

```ts
import { describe, expect, test } from 'vitest'
import { mondayOf } from '@/shared/lib/dates'

describe('mondayOf', () => {
  test('a Wednesday maps to its Monday', () => { expect(mondayOf('2026-09-02')).toBe('2026-08-31') })
  test('a Monday maps to itself', () => { expect(mondayOf('2026-08-31')).toBe('2026-08-31') })
  test('a Sunday maps to the PREVIOUS Monday (ISO week)', () => { expect(mondayOf('2026-09-06')).toBe('2026-08-31') })
})
```

- [ ] **Step 2: Run it — expect FAIL (`mondayOf` is not exported)**

Run from `frontend/`: `pnpm test src/shared/lib/dates.test.ts`

- [ ] **Step 3: Implement `mondayOf`**

Append to `frontend/src/shared/lib/dates.ts`:

```ts
/** ISO Monday (YYYY-MM-DD) of the week containing `iso` — Sunday belongs to the PREVIOUS week. */
export function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const dow = d.getDay() // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1
  return addDays(iso, -back)
}
```

- [ ] **Step 4: Run — expect PASS.** `pnpm test src/shared/lib/dates.test.ts`

- [ ] **Step 5: Write the failing hook tests**

Append to `frontend/src/data/progression/progressionHooks.test.tsx` (the file already imports `renderHook, waitFor, http, HttpResponse, makeHookWrapper, server, API_BASE`; add `useGrowthWeek` to the `@/data/hooks` import):

```tsx
test('useGrowthWeek: mock mode seeds the fixture synchronously', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useGrowthWeek('2026-08-31'), { wrapper: makeHookWrapper() })
  expect(result.current.data?.questCompleted).toBe(6)
  expect(result.current.data?.savingsHuf).toBe(12000)
})

test('useGrowthWeek: real mode fetches /api/progression/growth-week/{date}', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/growth-week/:date`, ({ params }) =>
    HttpResponse.json({ weekStart: params.date, questCompleted: 2, questClosed: 3, lifeXp: 40, activities: 1, savingsHuf: 0 })))
  const { result } = renderHook(() => useGrowthWeek('2026-08-31'), { wrapper: makeHookWrapper() })
  expect(result.current.data).toBeNull() // honest null while unresolved, never the seed
  await waitFor(() => expect(result.current.data?.questCompleted).toBe(2))
  expect(result.current.data?.weekStart).toBe('2026-08-31')
})

test('useGrowthWeek: real mode 404 resolves to null (no retry storm)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/growth-week/:date`, () => new HttpResponse(null, { status: 404 })))
  const { result } = renderHook(() => useGrowthWeek('2026-08-31'), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.data).toBeNull()
})
```

- [ ] **Step 6: Run — expect FAIL** (`useGrowthWeek` not exported). `pnpm test src/data/progression/progressionHooks.test.tsx`

- [ ] **Step 7: Implement api + mock + hook + barrel + MSW default**

`frontend/src/data/progression/progressionApi.ts` — add after the `PerkUnlockResponse` type line and inside `progressionApi`:

```ts
export type GrowthWeek = components['schemas']['GrowthWeekResponse']
```
```ts
  getGrowthWeek: (weekStartIso: string): Promise<GrowthWeek> =>
    apiFetch<GrowthWeek>(`/api/progression/growth-week/${weekStartIso}`),
```

Create `frontend/src/data/progression/growthWeekMock.ts`:

```ts
import type { GrowthWeek } from '@/data/progression/progressionApi'

/** Growth "Ez a hét" tile seed (mezo-rmi0.1) — the prototype's numbers (growth-body.html). */
export const growthWeekMock: GrowthWeek = {
  weekStart: '2026-08-31',
  questCompleted: 6,
  questClosed: 7,
  lifeXp: 185,
  activities: 2,
  savingsHuf: 12000,
}
```

`frontend/src/data/progression/progressionHooks.ts` — add imports `import { growthWeekMock } from '@/data/progression/growthWeekMock'` and `import type { GrowthWeek } from '@/data/progression/progressionApi'`, then append:

```ts
/**
 * The Growth Napló page's "Ez a hét" tile (mezo-rmi0.1) — the first consumer of the live
 * `GET /api/progression/growth-week/{date}` endpoint (unconsumed since mezo-p2tr).
 * `null` = nothing to draw (unresolved, 404, or error) — the tile renders NOTHING then
 * (handoff §2 honest states), never zeros standing in for a missing source.
 */
export function useGrowthWeek(weekStartIso: string): { data: GrowthWeek | null; isPending: boolean; isError: boolean } {
  const { data, isPending, isError } = useDualQuery<GrowthWeek | null>({
    queryKey: ['growthWeek', weekStartIso],
    mockData: growthWeekMock,
    realFetch: async () => {
      try {
        return await progressionApi.getGrowthWeek(weekStartIso)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    realEmpty: null,
    realStaleTime: 60_000,
  })
  return { data: isError ? null : data, isPending, isError }
}
```

`frontend/src/data/hooks.ts:52` → `export { useProgressionProfile, useAchievements, useGrowthWeek } from '@/data/progression/progressionHooks'`

`frontend/src/test/msw/handlers.ts` — after the `/api/progression/achievements` handler add:

```ts
  // Growth week rollup (mezo-rmi0.1) — honest zeros are a valid contract answer.
  http.get(`${API_BASE}/api/progression/growth-week/:date`, ({ params }) =>
    HttpResponse.json({ weekStart: params.date, questCompleted: 0, questClosed: 0, lifeXp: 0, activities: 0, savingsHuf: 0 }),
  ),
```

- [ ] **Step 8: Run both modes — expect PASS**

`VITE_USE_MOCK=false pnpm test src/data/progression src/shared/lib/dates.test.ts` and `VITE_USE_MOCK=true pnpm test src/data/progression src/shared/lib/dates.test.ts`. Also `pnpm test src/data/dualMode.guard.test.ts`.

- [ ] **Step 9: Commit**

```bash
node scripts/gen-codemap.mjs
git add frontend/src/shared/lib/dates.ts frontend/src/shared/lib/dates.test.ts frontend/src/data/progression frontend/src/data/hooks.ts frontend/src/test/msw/handlers.ts docs/CODEMAP.md
git commit -m "feat(data): useGrowthWeek + mondayOf — first reader of /api/progression/growth-week (mezo-rmi0.1)"
```

---

### Task 2: Mozaik primitives — `PageHero spot` + `useContinuingCountUp`

**Files:**
- Modify: `frontend/src/shared/ui/mozaik/index.tsx:127-152` (PageHero)
- Modify: `frontend/src/shared/ui/mozaik/motion.tsx` (append hook)
- Test: `frontend/src/shared/ui/mozaik/Mozaik.test.tsx` (append), `frontend/src/shared/ui/mozaik/motion.test.tsx` (append)

**Interfaces:**
- Produces: `PageHero` gains `spot?: ClaySpotName` (rendered via `ClaySpot` in the hero row when given; `icon` unchanged).
- Produces: `useContinuingCountUp(target: number, durationMs = 900): number` — first mount animates 0→target; a later target change animates from the last DISPLAYED value; instant under reduced motion or jsdom.

- [ ] **Step 1: Failing tests**

Append to `Mozaik.test.tsx` (uses `render` from Testing Library and `PageHero` import already present; add `ClaySpot`-free assertion on the `<use>` href):

```tsx
test('PageHero renders a clay SPOT in the hero row when `spot` is given (mezo-rmi0.1)', () => {
  const { container } = render(<PageHero spot="s-hajtas" big={33} name="skill" />)
  expect(container.querySelector('.mz-hero-row use')?.getAttribute('href')).toBe('#s-hajtas')
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('33')
})
```

Append to `motion.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { useContinuingCountUp } from '@/shared/ui/mozaik/motion'

test('useContinuingCountUp shows the target instantly under jsdom and follows target changes', () => {
  const { result, rerender } = renderHook(({ t }) => useContinuingCountUp(t), { initialProps: { t: 18420 } })
  expect(result.current).toBe(18420)
  rerender({ t: 18435 })
  expect(result.current).toBe(18435)
})
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm test src/shared/ui/mozaik`

- [ ] **Step 3: Implement**

`index.tsx`: change the clay import to `import { ClayIcon, ClaySpot, type ClayIconName, type ClaySpotName } from '@/shared/ui/clay'`; in `PageHeroProps` add `/** A clay SPOT (s-*) instead of an icon — Skillek (s-hajtas) / Kitüntetések (s-medal) heroes. */ spot?: ClaySpotName`; in `PageHero` destructure `spot` and render inside `.mz-hero-row` before `{icon && …}`: `{spot && <ClaySpot name={spot} size={iconSize} />}`.

`motion.tsx` append:

```ts
function isJsdom(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' && navigator.userAgent.includes('jsdom')
}

/** Count-up that CONTINUES from the last displayed value when `target` changes (the KeretHero
 *  recipe, mezo-rmi0.1): a chip tap / saved activity bumps the Growth hero's XP from where it
 *  sits, never restarting at 0. Instant under prefers-reduced-motion and jsdom. */
export function useContinuingCountUp(target: number, durationMs = 900): number {
  const skip = prefersReducedMotion() || isJsdom()
  const [val, setVal] = useState(skip ? target : 0)
  const shownRef = useRef(skip ? target : 0)
  useEffect(() => {
    if (skip) { setVal(target); shownRef.current = target; return }
    const from = shownRef.current
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = Math.round(from + (target - from) * eased)
      setVal(next)
      shownRef.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, skip])
  return val
}
```

- [ ] **Step 4: Run — expect PASS.** `pnpm test src/shared/ui/mozaik`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/ui/mozaik
git commit -m "feat(mozaik): PageHero spot prop + useContinuingCountUp (mezo-rmi0.1)"
```

---

### Task 3: Growth CSS block rewrite (prototype.css)

**Files:**
- Modify: `frontend/src/styles/prototype.css` — replace the block starting at the comment `/* ── Growth (mezo-d20.6.5) — prototype en-body #page-growth` (~line 5643) through the closing `}` of its `@media (prefers-reduced-motion: reduce)` block (~line 5708, the line before `/* ── Napló re-face (mezo-d20.6.6)`), plus two new tokens in both `:root` blocks.
- Test: existing `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts`, `mozaikCssTokens.test.ts`; `pnpm build`.

**Interfaces:**
- Produces the class names every later task uses (listed in the CSS). Keeps `.gr-band`, `.gr-band-top`, `.gr-band-chip`, `.gr-band-foot`, `.gr-day`, `.gr-covgrid`, `.gr-covtile`, `.gr-chain`, `.gr-bdggrid`, `.gr-bdg` names (rewritten); REMOVES `.gr-seg` segment switch semantics (re-used for the Létra/Bolt pill), `.gr-xpwrap`, `.gr-unit`, `.gr-day-head`, `.gr-row`, `.gr-covtrack`, `.gr-bdg-em`, `.gr-bdg-bar`.

- [ ] **Step 1: Add tokens** — in the light `:root` after `--mz-gbar-lav: …;` (~line 255):

```css
  --mz-gbar-sage: linear-gradient(90deg, #A9C69A, #8FAF7E);   /* Growth ritmus dots / atlétikus meters */
  --mz-gbar-sky:  linear-gradient(90deg, #9CC4DE, #4E8FB8);   /* Growth napló accents */
```
and in `:root[data-theme="dark"]` after its `--mz-gbar-lav: …;` (~line 550):
```css
  --mz-gbar-sage: linear-gradient(90deg, color-mix(in srgb, var(--dv-sage) 55%, var(--surface-card)), var(--dv-sage));
  --mz-gbar-sky:  linear-gradient(90deg, color-mix(in srgb, var(--dv-sky) 55%, var(--surface-card)), var(--dv-sky));
```

- [ ] **Step 2: Replace the Growth block** with (values = `growth-head.html` ×1.18):

```css
/* ── Growth hub + 4 aloldal (mezo-rmi0.1) — prototype growth-tab.html (src/growth-head.html)
      ×1.18. Hero bars + ritmus dots, Ma strip chips, band cards with .gr-skl rows, Rutin
      30-cell counters + chain rows, Napló day cards, Kitüntetések streak/titles/badge rings/
      perks. Every color is a --mz-* token (both :root blocks); infinite animations are
      reduced-motion guarded at the bottom. ── */
/* hero */
.gr-hero { display: grid; gap: 5px; padding: 2px 5px 2px; }
.gr-hero-ttl { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; text-align: center; }
.gr-hero-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.gr-hero-num { font-size: 45px; font-weight: 200; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1; }
.gr-hero-unit { font-size: 13px; font-weight: 700; color: var(--mz-cell-amber-ink); margin-left: 5px; letter-spacing: 0.04em; }
.gr-hero-icon { transform-origin: 50% 80%; }
.gr-traits { display: grid; gap: 6px; padding: 5px 7px 0; }
.gr-trait { display: grid; grid-template-columns: 68px 1fr 64px; align-items: center; gap: 9px; }
.gr-trait-lb { font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mz-ink-mut); }
.gr-trait-val { font-size: 11px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.gr-trait-val small { font-weight: 500; color: var(--mz-ink-soft); font-size: 9.5px; }
.gr-tbar { height: 7px; border-radius: 4px; background: var(--mz-gbar-bg); overflow: hidden; }
.gr-tbar i { display: block; height: 100%; border-radius: 4px; transform: scaleX(0); transform-origin: left; width: var(--w, 0%); }
.mz-play .gr-tbar i { animation: mzp-fill 0.9s cubic-bezier(0.22, 0.9, 0.32, 1) forwards; animation-delay: var(--d, 0ms); }
.gr-tbar i.gold { background: var(--mz-strength); }
.gr-tbar i.lav  { background: var(--mz-gbar-lav); }
.gr-tbar i.sage { background: var(--mz-gbar-sage); }
.gr-wdots { display: flex; gap: 5px; align-items: center; }
.gr-wdots i { flex: 1; height: 8px; border-radius: 5px; background: var(--mz-gbar-bg); transform: scale(0.3); opacity: 0; }
.gr-wdots i.on { background: var(--mz-gbar-sage); }
.gr-wdots i.now { box-shadow: 0 0 0 1.5px var(--mz-cell-sage-ink); }
.mz-play .gr-wdots i { animation: gr-dotpop 0.4s cubic-bezier(0.3, 1.4, 0.4, 1) forwards; animation-delay: var(--d); }
@keyframes gr-dotpop { to { transform: none; opacity: 1; } }
@keyframes gr-breathe { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.05) rotate(-2deg); } }
@keyframes gr-flame { 0%, 100% { transform: rotate(-3deg) scale(1); } 50% { transform: rotate(3deg) scale(1.06); } }
@keyframes gr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
/* Ma strip */
.gr-ma { border-radius: 19px; padding: 9px 12px 11px; background: var(--mz-stripbg); border: 0.5px solid var(--mz-line-soft); box-shadow: var(--mz-shadow); }
.gr-ma-head { display: flex; align-items: center; gap: 7px; cursor: pointer; border: none; background: none; font-family: inherit; padding: 0 2px 7px; width: 100%; text-align: left; min-height: 44px; }
.gr-ma-head .mz-eyebrow { color: var(--mz-cell-amber-ink); }
.gr-ma-xp { margin-left: auto; font-size: 9.5px; font-weight: 800; color: var(--mz-cell-sage-ink); background: var(--mz-cell-sage-bg); border-radius: 7px; padding: 2px 8px; font-variant-numeric: tabular-nums; }
.gr-ma-chev { color: var(--mz-ink-mut); font-size: 14px; }
.gr-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 1px 2px 2px; margin: 0 -2px; }
.gr-chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 8px 12px 8px 9px; font-size: 10.5px; font-weight: 600; font-family: inherit; min-height: 34px;
  border: 1px solid var(--mz-line); background: var(--mz-chipbg); color: var(--text-primary); cursor: pointer; max-width: 224px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: transform 0.15s cubic-bezier(0.3, 0.8, 0.4, 1.4), background 0.3s ease; }
.gr-chip:active { transform: scale(0.95); }
.gr-chip-mk { width: 15px; height: 15px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 9.5px; border: 1.2px solid var(--mz-line); }
.gr-chip.done { background: var(--mz-cell-sage-bg); border-color: var(--mz-cell-sage-ink); color: var(--mz-cell-sage-ink); cursor: default; }
.gr-chip.done .gr-chip-mk { background: var(--mz-cell-sage-ink); border-color: var(--mz-cell-sage-ink); color: #fff; }
.gr-chip.gone { opacity: 0.5; border-style: dashed; cursor: default; }
.gr-chip.gone .gr-chip-mk { border-style: dashed; }
.gr-chip.add { background: var(--mz-wash-gold); border-color: var(--mz-cell-amber-ink); color: var(--mz-cell-amber-ink); font-weight: 700; }
.gr-chip.act { background: var(--mz-cell-lav-bg); border-color: var(--mz-cell-lav-ink); color: var(--mz-cell-lav-ink); cursor: default; }
.gr-chip.act .gr-chip-mk { border-color: var(--mz-cell-lav-ink); color: var(--mz-cell-lav-ink); }
.gr-ma-empty { font-size: 11px; font-weight: 300; color: var(--mz-ink-soft); padding: 2px 2px 6px; line-height: 1.5; }
.gr-ma-empty b { color: var(--text-primary); font-weight: 600; }
/* hub tiles */
.gr-tile-line b { color: var(--text-primary); }
.gr-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--mz-cell-amber-ink); box-shadow: 0 0 0 2px var(--mz-cell-amber-bg); margin-left: auto; flex: none; }
/* skill bands */
.gr-band { border-radius: 20px; padding: 13px 14px; margin-bottom: 11px; border: 0.5px solid var(--mz-line-soft); background: var(--mz-stripbg); box-shadow: var(--mz-shadow); }
.gr-band.lav   { background: var(--mz-wash-lav);  box-shadow: var(--mz-shadow-lav); }
.gr-band.sage  { background: var(--mz-wash-sage); box-shadow: var(--mz-shadow-sage); }
.gr-band.amber { background: var(--mz-wash-gold); box-shadow: var(--mz-shadow-gold); }
.gr-band.sky   { background: var(--mz-wash-sky);  box-shadow: var(--mz-shadow-sky); }
.gr-band-top { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.gr-band-chip { margin-left: auto; font-size: 8.5px; font-weight: 800; letter-spacing: 0.08em; border-radius: 7px; padding: 2px 8px; flex: none; font-variant-numeric: tabular-nums; background: var(--mz-chipbg); color: var(--mz-ink-soft); }
.gr-band-chip.ok   { background: var(--mz-cell-sage-bg);  color: var(--mz-cell-sage-ink); }
.gr-band-chip.warn { background: var(--mz-cell-amber-bg); color: var(--mz-cell-amber-ink); }
.gr-band-chip.lav  { background: var(--mz-cell-lav-bg);   color: var(--mz-cell-lav-ink); }
.gr-band-chip.sky  { background: var(--mz-cell-sky-bg);   color: var(--mz-cell-sky-ink); }
.gr-band-foot { font-size: 10px; color: var(--mz-ink-mut); font-weight: 300; padding: 7px 2px 0; line-height: 1.5; }
.gr-band-foot b { color: var(--mz-cell-sage-ink); font-weight: 700; }
.gr-skl { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
.gr-skl-ic { width: 24px; height: 24px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--mz-chipbg); font-size: 9.5px; font-weight: 800; color: var(--tc, var(--mz-ink-soft)); }
.gr-skl-nm { font-size: 11px; font-weight: 600; width: 97px; flex: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gr-skl .gr-tbar { flex: 1; height: 6px; }
.gr-skl-lv { font-size: 9.5px; font-weight: 800; color: var(--text-primary); background: var(--mz-chipbg); border-radius: 7px; padding: 2px 6px; flex: none; font-variant-numeric: tabular-nums; min-width: 35px; text-align: center; }
.gr-skl-perk { font-size: 8.5px; font-weight: 700; color: var(--mz-cell-amber-ink); flex: none; }
.gr-skl.more { display: none; }
.gr-band.expanded .gr-skl.more { display: flex; }
.gr-expand { width: 100%; border: none; background: none; font-family: inherit; font-size: 10.5px; font-weight: 700; color: var(--tc, var(--mz-ink-soft)); cursor: pointer; padding: 7px 0 0; text-align: center; min-height: 44px; }
/* rutin */
.gr-covgrid { display: flex; gap: 9px; margin-bottom: 11px; }
.gr-covtile { flex: 1; border-radius: 18px; padding: 11px 12px; background: var(--mz-stripbg); border: 0.5px solid var(--mz-line-soft); box-shadow: var(--mz-shadow); }
.gr-cov-hd { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
.gr-cov-hd b { font-size: 11px; font-weight: 700; }
.gr-cov-n { margin-left: auto; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.gr-cov-n small { font-size: 9px; color: var(--mz-ink-mut); font-weight: 600; }
.gr-cells { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
.gr-cells i { aspect-ratio: 1; border-radius: 4px; background: var(--mz-gbar-bg); transform: scale(0.4); opacity: 0; }
.gr-cells i.on { background: var(--mz-strength); }
.gr-cells i.ev.on { background: var(--mz-gbar-lav); }
.mz-play .gr-cells i { animation: gr-dotpop 0.35s cubic-bezier(0.3, 1.4, 0.4, 1) forwards; animation-delay: calc(var(--d) + var(--i) * 14ms); }
.gr-daynav { display: flex; align-items: center; gap: 9px; padding: 2px 2px 9px; }
.gr-chain { border-radius: 20px; padding: 13px 14px; margin-bottom: 11px; border: 0.5px solid var(--mz-line-soft); background: var(--mz-stripbg); box-shadow: var(--mz-shadow); }
.gr-chain.amber { background: var(--mz-wash-gold); box-shadow: var(--mz-shadow-gold); }
.gr-chain.lav   { background: var(--mz-wash-lav);  box-shadow: var(--mz-shadow-lav); }
.gr-chainrow { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 11px; }
.gr-chainrow + .gr-chainrow { border-top: 0.5px solid var(--mz-line-soft); }
.gr-ck { width: 18px; height: 18px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 9.5px; border: 1.2px solid var(--mz-line); color: transparent; }
.gr-chainrow.done .gr-ck { background: var(--mz-cell-sage-ink); border-color: var(--mz-cell-sage-ink); color: #fff; }
.gr-chainrow.skip .gr-ck { border-style: dashed; }
.gr-chainrow .tx { flex: 1; font-weight: 500; }
.gr-chainrow.skip .tx { color: var(--mz-ink-mut); }
.gr-chain-pct { font-size: 9.5px; color: var(--mz-ink-soft); font-variant-numeric: tabular-nums; font-style: italic; }
.gr-daysum { font-size: 11px; font-weight: 300; line-height: 1.55; }
.gr-daysum b { font-weight: 700; }
.gr-softnote { font-size: 10.5px; color: var(--mz-ink-soft); font-weight: 300; background: var(--mz-gbar-bg); border-radius: 11px; padding: 7px 11px; margin-top: 7px; line-height: 1.5; }
/* napló */
.gr-dayhd { display: flex; align-items: baseline; gap: 7px; padding: 9px 2px 5px; }
.gr-dayhd .dow { font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mz-cell-sky-ink); }
.gr-dayhd .dt { font-size: 9.5px; color: var(--mz-ink-mut); }
.gr-dayhd .xp { margin-left: auto; font-size: 9.5px; font-weight: 800; color: var(--mz-cell-sage-ink); font-variant-numeric: tabular-nums; }
.gr-day { border-radius: 20px; padding: 5px 14px; margin-bottom: 11px; border: 0.5px solid var(--mz-line-soft); background: var(--mz-stripbg); box-shadow: var(--mz-shadow); }
.gr-jrow { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; font-size: 11px; }
.gr-jrow + .gr-jrow { border-top: 0.5px solid var(--mz-line-soft); }
.gr-jk { width: 15px; flex: none; text-align: center; font-weight: 800; color: var(--mz-cell-sage-ink); }
.gr-jrow.act .gr-jk { color: var(--mz-cell-lav-ink); }
.gr-jrow.gone .gr-jk, .gr-jrow.gone .tx { color: var(--mz-ink-mut); }
.gr-jrow .tx { flex: 1; font-weight: 500; }
.gr-jmeta { font-size: 9.5px; color: var(--mz-ink-soft); font-style: italic; flex: none; }
/* kitüntetések */
.gr-streak { display: flex; gap: 13px; align-items: center; }
.gr-streak-n { font-size: 31px; font-weight: 200; font-variant-numeric: tabular-nums; line-height: 1; }
.gr-flame { transform-origin: 50% 90%; }
.gr-msbar { height: 6px; border-radius: 4px; background: var(--mz-gbar-bg); overflow: hidden; margin-top: 7px; position: relative; }
.gr-msbar i { display: block; height: 100%; border-radius: 4px; background: var(--gradient-cta); transform: scaleX(0); transform-origin: left; width: var(--w); }
.mz-play .gr-msbar i { animation: mzp-fill 0.9s cubic-bezier(0.22, 0.9, 0.32, 1) forwards; animation-delay: var(--d, 200ms); }
.gr-seg { display: flex; gap: 5px; background: var(--mz-gbar-bg); border-radius: 999px; padding: 4px; margin: 5px 0 7px; }
.gr-seg button { flex: 1; border: none; background: none; border-radius: 999px; min-height: 44px; padding: 7px 0; font-size: 10px; font-weight: 700; color: var(--mz-ink-soft); font-family: inherit; cursor: pointer; }
.gr-seg button.on { background: var(--mz-cell-amber-ink); color: #fff; box-shadow: var(--mz-shadow-gold); }
.gr-titrow { display: flex; align-items: center; gap: 9px; padding: 8px 2px; font-size: 12.5px; min-height: 44px; }
.gr-titrow + .gr-titrow { border-top: 0.5px solid var(--mz-line-soft); }
.gr-titrow .nm { font-weight: 600; flex: 1; min-width: 0; }
.gr-titrow.lock .nm { color: var(--mz-ink-mut); font-weight: 500; }
.gr-titrow .sub { font-size: 9.5px; color: var(--mz-ink-mut); font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 3px; }
.gr-titact { flex: none; font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 6px 13px; min-height: 32px; border: 1px solid var(--mz-line); background: var(--mz-stripbg); color: var(--mz-cell-coral-ink); cursor: pointer; font-family: inherit; }
.gr-titact.worn { background: var(--mz-cell-sage-bg); border-color: transparent; color: var(--mz-cell-sage-ink); cursor: default; }
.gr-titact:disabled { opacity: 0.45; cursor: default; }
.gr-lockmk { font-size: 9.5px; font-weight: 800; color: var(--mz-ink-mut); letter-spacing: 0.06em; }
.gr-bdggrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.gr-bdg { border-radius: 17px; padding: 11px 6px 9px; text-align: center; display: grid; gap: 5px; justify-items: center; background: var(--mz-stripbg); border: 0.5px solid var(--mz-line-soft); box-shadow: var(--mz-shadow); }
.gr-bdg.done { background: var(--mz-wash-sage); }
.gr-ring { width: 45px; height: 45px; border-radius: 50%; position: relative; display: grid; place-items: center; background: conic-gradient(var(--mz-cell-amber-ink) calc(var(--v, 0) * 1%), var(--mz-gbar-bg) 0); }
.gr-bdg.done .gr-ring { background: var(--mz-cell-sage-ink); }
.gr-ring::after { content: ''; position: absolute; width: 37px; height: 37px; border-radius: 50%; background: var(--mz-stripbg); }
.gr-bdg.done .gr-ring::after { background: var(--mz-cell-sage-bg); }
.gr-ring span { position: relative; z-index: 1; font-size: 18px; }
.gr-bdg:not(.done) .gr-ring span { filter: grayscale(1) opacity(0.55); }
.gr-bdg b { font-size: 9px; font-weight: 700; line-height: 1.25; }
.gr-bdg small { font-size: 8px; color: var(--mz-ink-mut); font-variant-numeric: tabular-nums; }
.gr-bdg.done small { color: var(--mz-cell-sage-ink); font-weight: 800; }
.gr-perkrow { display: flex; align-items: center; gap: 11px; padding: 8px 0; font-size: 11px; }
.gr-perkrow + .gr-perkrow { border-top: 0.5px solid var(--mz-line-soft); }
.gr-perk-pi { width: 31px; height: 31px; border-radius: 11px; flex: none; display: grid; place-items: center; background: var(--mz-cell-amber-bg); color: var(--mz-cell-amber-ink); font-size: 9.5px; font-weight: 800; }
.gr-perkrow .pn { font-weight: 700; }
.gr-perkrow .pe { font-size: 10px; color: var(--mz-ink-soft); font-weight: 300; }
.gr-perkrow .pl { margin-left: auto; font-size: 9px; font-weight: 800; color: var(--mz-ink-mut); flex: none; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: no-preference) {
  .gr-hero-icon { animation: gr-breathe 5s ease-in-out infinite; }
  .gr-flame { animation: gr-flame 2.6s ease-in-out infinite; }
  .gr-pulse { animation: gr-pulse 2.2s ease-in-out infinite; }
}
@media (prefers-reduced-motion: reduce) {
  .gr-tbar i, .mz-play .gr-tbar i, .gr-msbar i, .mz-play .gr-msbar i,
  .gr-wdots i, .mz-play .gr-wdots i, .gr-cells i, .mz-play .gr-cells i { transform: none; opacity: 1; animation: none; }
}
```

Check the two line tokens exist: `grep -n "\-\-mz-line-soft:\|\-\-mz-line:" frontend/src/styles/prototype.css`. If either is missing in a `:root` block, add to light `:root`: `--mz-line: rgba(43, 33, 24, 0.12); --mz-line-soft: rgba(43, 33, 24, 0.07);` and to dark: `--mz-line: rgba(245, 239, 230, 0.14); --mz-line-soft: rgba(245, 239, 230, 0.08);`.

- [ ] **Step 3: Verify** — from `frontend/`: `pnpm test src/shared/ui/mozaik` (structure + tokens guards) and `pnpm build`. Expected: both green. `GrowthPage` still compiles because its old classes are only CSS; if a test asserts `.gr-covtrack` etc., that test is replaced in later tasks — note it, do not fix here.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/prototype.css
git commit -m "feat(styles): Growth hub CSS block — hero bars, Ma chips, bands, rutin cells, badge rings (mezo-rmi0.1)"
```

---

### Task 4: `growthStats` + `perkMilestones` pure logic

**Files:**
- Create: `frontend/src/features/me/logic/growthStats.ts`, `frontend/src/features/me/logic/growthStats.test.ts`
- Create: `frontend/src/features/me/logic/perkMilestones.ts`, `frontend/src/features/me/logic/perkMilestones.test.ts`

**Interfaces:**
- Produces: `growthStats(p: ProgressionProfileResponse): { totalXp: number; skillCount: number; bestLevel: number; lifeAvg: number | null; muscleBest: number | null; lifeXp: number; athleticAvg: number | null }`.
- Produces: `PERK_MILESTONES = [5, 10, 15, 20]`, `perkHint(level: number): number | null` (next milestone when exactly one level away, else null), `nearestMilestone(rows: { name: string; level: number }[]): { name: string; level: number } | null` (the row with the smallest positive distance to its next milestone; ties → first).

- [ ] **Step 1: Failing tests**

`growthStats.test.ts`:
```ts
import { expect, test } from 'vitest'
import { growthStats } from '@/features/me/logic/growthStats'
import { GHOST_PROGRESSION_PROFILE, progressionProfileMock } from '@/data/progression/progressionMock'

test('sums XP, counts skills and finds the best level across bands', () => {
  const s = growthStats(progressionProfileMock)
  expect(s.totalXp).toBe(18985)   // 1085 + 9350 + 8550 (GrowthPage.test precedent)
  expect(s.skillCount).toBe(33)
  expect(s.bestLevel).toBe(7)     // max_strength Lv 7
  expect(s.lifeXp).toBe(1085)
  expect(s.lifeAvg).toBeCloseTo(1.75, 2)
  expect(s.muscleBest).toBe(6)
  expect(s.athleticAvg).toBeCloseTo(4.58, 2)
})
test('ghost profile yields zeros and nulls, never NaN', () => {
  const s = growthStats(GHOST_PROGRESSION_PROFILE)
  expect(s).toEqual({ totalXp: 0, skillCount: 0, bestLevel: 0, lifeAvg: null, muscleBest: null, lifeXp: 0, athleticAvg: null })
})
```

`perkMilestones.test.ts`:
```ts
import { expect, test } from 'vitest'
import { PERK_MILESTONES, nearestMilestone, perkHint } from '@/features/me/logic/perkMilestones'

test('milestones are 5/10/15/20', () => { expect(PERK_MILESTONES).toEqual([5, 10, 15, 20]) })
test('perkHint fires only one level before a milestone', () => {
  expect(perkHint(4)).toBe(5); expect(perkHint(9)).toBe(10); expect(perkHint(3)).toBeNull(); expect(perkHint(5)).toBeNull(); expect(perkHint(20)).toBeNull()
})
test('nearestMilestone picks the smallest positive distance, first on ties', () => {
  expect(nearestMilestone([{ name: 'Lát', level: 4 }, { name: 'Comb', level: 9 }])).toEqual({ name: 'Lát', level: 5 })
  expect(nearestMilestone([{ name: 'Mell', level: 7 }, { name: 'Far', level: 8 }])).toEqual({ name: 'Far', level: 10 })
  expect(nearestMilestone([])).toBeNull()
  expect(nearestMilestone([{ name: 'X', level: 20 }])).toBeNull()
})
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm test src/features/me/logic`

- [ ] **Step 3: Implement**

`growthStats.ts`:
```ts
import type { ProgressionProfileResponse, SkillLevel } from '@/data/progression/progressionApi'

const sumXp = (l: SkillLevel[]) => l.reduce((s, x) => s + x.cumulativeXp, 0)
const avg = (l: SkillLevel[]) => (l.length ? l.reduce((s, x) => s + x.level, 0) / l.length : null)
const best = (l: SkillLevel[]) => (l.length ? Math.max(...l.map((x) => x.level)) : null)

/** FE-derived Growth numbers (mezo-rmi0.1) — band lengths, never hardcoded 8/12/13. */
export function growthStats(p: ProgressionProfileResponse) {
  const life = p.life ?? [], athletic = p.athletic ?? [], muscle = p.muscle ?? []
  const all = [...life, ...athletic, ...muscle]
  return {
    totalXp: sumXp(all),
    skillCount: all.length,
    bestLevel: best(all) ?? 0,
    lifeAvg: avg(life),
    muscleBest: best(muscle),
    lifeXp: sumXp(life),
    athleticAvg: avg(athletic),
  }
}
```

`perkMilestones.ts`:
```ts
/** Perk milestones (growth.md §2: "Lv 5, 10, 15…"). */
export const PERK_MILESTONES = [5, 10, 15, 20] as const

const nextOf = (level: number) => PERK_MILESTONES.find((m) => m > level) ?? null

/** The `→ perk Lv n` row hint: only when the skill is exactly ONE level short of a milestone. */
export function perkHint(level: number): number | null {
  const n = nextOf(level)
  return n != null && n - level === 1 ? n : null
}

/** The skill closest to its next milestone (Perkek footer "a következő: {name} Lv {n}"). */
export function nearestMilestone(rows: { name: string; level: number }[]): { name: string; level: number } | null {
  let bestRow: { name: string; level: number } | null = null
  let bestDist = Infinity
  for (const r of rows) {
    const n = nextOf(r.level)
    if (n == null) continue
    const dist = n - r.level
    if (dist < bestDist) { bestDist = dist; bestRow = { name: r.name, level: n } }
  }
  return bestRow
}
```

- [ ] **Step 4: Run — expect PASS.** `pnpm test src/features/me/logic`

- [ ] **Step 5: Commit**
```bash
node scripts/gen-codemap.mjs
git add frontend/src/features/me/logic docs/CODEMAP.md
git commit -m "feat(me): growthStats + perkMilestones pure logic (mezo-rmi0.1)"
```

---

### Task 5: `GrowthHero` component

**Files:**
- Create: `frontend/src/features/me/components/GrowthHero.tsx`, `GrowthHero.test.tsx`

**Interfaces:**
- Produces: `GrowthHero({ totalXp, level, disciplinePct, consistencyWeeks }: { totalXp: number; level: { level: number; xpInLevel: number; xpForNext: number } | null; disciplinePct: number | null; consistencyWeeks: number })`.
- Consumes: `useContinuingCountUp` (Task 2), `huInt`, `ClayIcon`.

- [ ] **Step 1: Failing tests**

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GrowthHero } from '@/features/me/components/GrowthHero'

const base = { totalXp: 18420, level: { level: 7, xpInLevel: 340, xpForNext: 500 }, disciplinePct: 84, consistencyWeeks: 6 }

test('renders the XP number (HU grouped), Szint, Fegyelem and Ritmus rows', () => {
  const { container } = render(<GrowthHero {...base} />)
  expect(screen.getByText('18 420')).toBeInTheDocument()
  expect(screen.getByText('Szint 7')).toBeInTheDocument()
  expect(screen.getByText('340')).toBeInTheDocument()
  expect(screen.getByText('/ 500')).toBeInTheDocument()
  expect(screen.getByText('84%')).toBeInTheDocument()
  expect(screen.getByText('6')).toBeInTheDocument()
  expect(container.querySelector('.gr-tbar i.gold')?.getAttribute('style')).toContain('--w: 68%')
  const dots = container.querySelectorAll('.gr-wdots i')
  expect(dots).toHaveLength(8)
  expect(container.querySelectorAll('.gr-wdots i.on')).toHaveLength(6)
  expect(dots[7].classList.contains('now')).toBe(true)
})

test('honest states: null discipline hides the Fegyelem row, null level hides the Szint row', () => {
  render(<GrowthHero {...base} level={null} disciplinePct={null} />)
  expect(screen.queryByText('Fegyelem')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Szint/)).not.toBeInTheDocument()
  expect(screen.getByText('Ritmus')).toBeInTheDocument()
})

test('0 weeks: eight empty dots and "0 hét"', () => {
  const { container } = render(<GrowthHero {...base} consistencyWeeks={0} />)
  expect(container.querySelectorAll('.gr-wdots i.on')).toHaveLength(0)
  expect(screen.getByText('0')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm test src/features/me/components/GrowthHero.test.tsx`

- [ ] **Step 3: Implement**

```tsx
// ============================================================
// Mezo · GrowthHero (mezo-rmi0.1) — prototype growth-tab.html `.grhero` ×1.18.
// Title → clay i-growth + XP count-up (continues from the last shown value) → three
// labelled rows: Szint (gold bar, xpInLevel/xpForNext), Fegyelem (lav bar, %) and
// Ritmus (last-8-weeks dots). Honest states: a null discipline or a missing
// gamification level REMOVES its row (handoff §2) — never a "–" placeholder. ADR 0010:
// nothing here gates, counts down or rewards.
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import { useContinuingCountUp } from '@/shared/ui/mozaik/motion'
import { huInt } from '@/shared/lib/huNum'

const WEEK_DOTS = 8

export function GrowthHero({ totalXp, level, disciplinePct, consistencyWeeks }: {
  totalXp: number
  level: { level: number; xpInLevel: number; xpForNext: number } | null
  disciplinePct: number | null
  consistencyWeeks: number
}) {
  const shown = useContinuingCountUp(totalXp)
  const levelPct = level && level.xpForNext > 0 ? Math.min(100, Math.round((level.xpInLevel / level.xpForNext) * 100)) : 0
  const filled = Math.min(WEEK_DOTS, Math.max(0, consistencyWeeks))
  return (
    <div className="gr-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
      <div className="gr-hero-ttl">Growth</div>
      <div className="gr-hero-row">
        <ClayIcon name="i-growth" size={54} className="gr-hero-icon" />
        <div aria-label={`${huInt(totalXp)} XP`}>
          <span className="gr-hero-num">{huInt(shown)}</span>
          <span className="gr-hero-unit">XP</span>
        </div>
      </div>
      <div className="gr-traits">
        {level && (
          <div className="gr-trait">
            <span className="gr-trait-lb">Szint {level.level}</span>
            <div className="gr-tbar"><i className="gold" style={{ '--w': `${levelPct}%`, '--d': '250ms' } as React.CSSProperties} /></div>
            <span className="gr-trait-val">{huInt(level.xpInLevel)} <small>/ {huInt(level.xpForNext)}</small></span>
          </div>
        )}
        {disciplinePct != null && (
          <div className="gr-trait">
            <span className="gr-trait-lb">Fegyelem</span>
            <div className="gr-tbar"><i className="lav" style={{ '--w': `${Math.min(100, disciplinePct)}%`, '--d': '330ms' } as React.CSSProperties} /></div>
            <span className="gr-trait-val">{disciplinePct}%</span>
          </div>
        )}
        <div className="gr-trait">
          <span className="gr-trait-lb">Ritmus</span>
          <div className="gr-wdots" aria-hidden="true">
            {Array.from({ length: WEEK_DOTS }, (_, i) => {
              const on = i >= WEEK_DOTS - filled
              return <i key={i} className={[on ? 'on' : '', i === WEEK_DOTS - 1 ? 'now' : ''].join(' ').trim() || undefined}
                style={{ '--d': `${400 + i * 45}ms` } as React.CSSProperties} />
            })}
          </div>
          <span className="gr-trait-val">{consistencyWeeks} <small>hét</small></span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**, then commit:
```bash
node scripts/gen-codemap.mjs
git add frontend/src/features/me/components/GrowthHero.tsx frontend/src/features/me/components/GrowthHero.test.tsx docs/CODEMAP.md
git commit -m "feat(me): GrowthHero — XP count-up + Szint/Fegyelem/Ritmus rows (mezo-rmi0.1)"
```

---

### Task 6: `MaStrip` component

**Files:**
- Create: `frontend/src/features/me/components/MaStrip.tsx`, `MaStrip.test.tsx`

**Interfaces:**
- Produces: `MaStrip()` (self-contained: reads `useDailyQuests`, `useQuestActions`, `useActivities`; mounts `ActivityLogSheet`; navigates with `useNavigate`).
- Consumes: `ActivityLogSheet({ onClose, quest? })` from `@/features/today/sheets/ActivityLogSheet`; `buildQuestRewardToast`, `emitToast` (as `DailyQuestsCard` does).

- [ ] **Step 1: Failing tests** (barrel-mock like `GrowthPage.test.tsx`; mock fixtures: `mockQuestDay` = 3 quests: q1 offered DERIVED, q2 completed, q3 offered ACTIVITY? — check `frontend/src/data/quest/questMock.ts:8-45`: read the real `completionMode` values and adjust the expectations below to the fixture; `mockActivities` has 3 entries, XP 18/15/0).

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MaStrip } from '@/features/me/components/MaStrip'
import { QueryWrapper } from '@/test/queryWrapper'
import { mockQuestDay } from '@/data/quest/questMock'
import { mockActivities } from '@/data/activity/activityMock'

const hooks = vi.hoisted(() => ({ useDailyQuests: vi.fn(), useQuestActions: vi.fn(), useActivities: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useDailyQuests: hooks.useDailyQuests, useQuestActions: hooks.useQuestActions, useActivities: hooks.useActivities,
}))
vi.mock('@/features/today/sheets/ActivityLogSheet', () => ({
  ActivityLogSheet: ({ quest }: { quest?: { title: string } }) => <div data-testid="act-sheet">{quest?.title ?? 'free'}</div>,
}))
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()), localDateString: () => '2026-07-12',
}))

function Loc() { const l = useLocation(); return <span data-testid="loc">{l.pathname}</span> }
function renderStrip() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/growth']}>
        <Routes><Route path="*" element={<><MaStrip /><Loc /></>} /></Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}
beforeEach(() => {
  hooks.useDailyQuests.mockReturnValue({ quests: mockQuestDay, levelUps: [], rerollsLeft: 1, mode: 'mock' })
  hooks.useQuestActions.mockReturnValue({ reroll: vi.fn(), pending: false, consumeLevelUps: vi.fn() })
  hooks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
})
afterEach(() => vi.clearAllMocks())

test('head counts done/total quests and sums today XP (done quests + activities)', () => {
  renderStrip()
  const done = mockQuestDay.filter((q) => q.status === 'completed')
  const xp = done.reduce((s, q) => s + q.xp, 0) + mockActivities.reduce((s, a) => s + a.xpAwarded, 0)
  expect(screen.getByText(`${done.length}/${mockQuestDay.length}`)).toBeInTheDocument()
  expect(screen.getByText(`+${xp} XP`)).toBeInTheDocument()
})

test('one chip per quest with the honest state class; activities render as ✎ chips; ＋ Tevékenység last', () => {
  const { container } = renderStrip()
  expect(container.querySelectorAll('.gr-chip:not(.act):not(.add)')).toHaveLength(mockQuestDay.length)
  expect(container.querySelectorAll('.gr-chip.act')).toHaveLength(mockActivities.length)
  const chips = container.querySelectorAll('.gr-chip')
  expect(chips[chips.length - 1].textContent).toBe('＋ Tevékenység')
  expect(container.querySelectorAll('.gr-chip.done')).toHaveLength(mockQuestDay.filter((q) => q.status === 'completed').length)
})

test('the head navigates to /nap/kuldetesek; a DERIVED open chip does too', async () => {
  renderStrip()
  await userEvent.click(screen.getByRole('button', { name: /Küldetések/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/nap/kuldetesek')
})

test('an ACTIVITY-mode open chip opens the activity sheet with that quest; ＋ Tevékenység opens it free', async () => {
  hooks.useDailyQuests.mockReturnValue({
    quests: [{ ...mockQuestDay[0], id: 'qa', status: 'offered', completionMode: 'ACTIVITY', title: 'Olvass 10 percet' }],
    levelUps: [], rerollsLeft: 1, mode: 'mock',
  })
  renderStrip()
  await userEvent.click(screen.getByRole('button', { name: 'Olvass 10 percet' }))
  expect(screen.getByTestId('act-sheet').textContent).toBe('Olvass 10 percet')
})

test('no quests today: the empty line + the ＋ Tevékenység chip', () => {
  hooks.useDailyQuests.mockReturnValue({ quests: [], levelUps: [], rerollsLeft: 0, mode: 'mock' })
  hooks.useActivities.mockReturnValue({ data: [], isPending: false })
  renderStrip()
  expect(screen.getByText(/Ma még nincs küldetés/)).toBeInTheDocument()
  expect(screen.getByText('0/0')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '＋ Tevékenység' })).toBeInTheDocument()
})

test('expired quest chip is not a button and says csendben lejárt', () => {
  hooks.useDailyQuests.mockReturnValue({
    quests: [{ ...mockQuestDay[0], id: 'qx', status: 'expired', title: 'Nyújtás' }], levelUps: [], rerollsLeft: 0, mode: 'mock',
  })
  const { container } = renderStrip()
  const gone = container.querySelector('.gr-chip.gone')!
  expect(gone.tagName).toBe('SPAN')
  expect(gone.textContent).toContain('Nyújtás · csendben lejárt')
})
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm test src/features/me/components/MaStrip.test.tsx`

- [ ] **Step 3: Implement**

```tsx
// ============================================================
// Mezo · MaStrip (mezo-rmi0.1) — the Growth hub's "Ma" strip, prototype growth-tab.html
// `.mastrip`. Replaces the two legacy cards (DailyQuestsCard + ActivityLogCard) on Growth
// with one strip: head (`Ma · d/n küldetés` + today XP chip → /nap/kuldetesek) and a
// wrapping chip row — one chip per quest (done sage ✓ · open neutral · expired dashed
// "csendben lejárt", never terracotta), one ✎ chip per activity, and `＋ Tevékenység`
// that opens the real ActivityLogSheet in place. No explicit "done" exists in the domain:
// DERIVED quests close from the logs (an open chip just goes to the quest page), an
// ACTIVITY-mode chip opens the sheet with the quest — the DailyQuestList "Naplózz" path.
// The consume-once level-up toast moves here verbatim (DailyQuestsCard's effect).
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivities, useDailyQuests, useQuestActions } from '@/data/hooks'
import type { DailyQuest } from '@/data/types'
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'

const trim = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function MaStrip() {
  const navigate = useNavigate()
  const date = localDateString()
  const { quests, levelUps } = useDailyQuests(date)
  const { consumeLevelUps } = useQuestActions(date)
  const { data: activities } = useActivities(date)
  const [sheet, setSheet] = useState<{ quest: DailyQuest | null } | null>(null)

  useEffect(() => {
    if (levelUps.length > 0) {
      const lu = levelUps[0]
      emitToast(buildQuestRewardToast({ title: lu.workoutLabel ?? 'Küldetés teljesítve', levelUp: lu }))
      consumeLevelUps()
    }
  }, [levelUps, consumeLevelUps])

  const done = quests.filter((q) => q.status === 'completed')
  const xp = done.reduce((s, q) => s + q.xp, 0) + activities.reduce((s, a) => s + a.xpAwarded, 0)
  const goQuests = () => navigate('/nap/kuldetesek')

  const questChip = (q: DailyQuest) => {
    if (q.status === 'completed') {
      return <span key={q.id} className="gr-chip done"><span className="gr-chip-mk" aria-hidden="true">✓</span>{trim(q.title)}</span>
    }
    if (q.status === 'expired' || q.status === 'rerolled') {
      return <span key={q.id} className="gr-chip gone" aria-disabled="true"><span className="gr-chip-mk" aria-hidden="true" />{trim(q.title, 20)} · csendben lejárt</span>
    }
    const onClick = q.completionMode === 'ACTIVITY' ? () => setSheet({ quest: q }) : goQuests
    return (
      <button key={q.id} type="button" className="gr-chip open" aria-label={q.title} onClick={onClick}>
        <span className="gr-chip-mk" aria-hidden="true" />{trim(q.title)}
      </button>
    )
  }

  return (
    <div className="gr-ma rise" style={{ '--d': '90ms' } as React.CSSProperties}>
      <button type="button" className="gr-ma-head" aria-label="Küldetések · a Nap fülön" onClick={goQuests}>
        <span className="mz-eyebrow">Ma · <span>{done.length}/{quests.length}</span> küldetés</span>
        <span className="gr-ma-xp">+{xp} XP</span>
        <span className="gr-ma-chev" aria-hidden="true">›</span>
      </button>
      {quests.length === 0 && (
        <div className="gr-ma-empty">Ma még nincs küldetés — <b>a reggeli briefinggel jön.</b> Tevékenységet közben is logolhatsz.</div>
      )}
      <div className="gr-chips">
        {quests.map(questChip)}
        {activities.map((a) => (
          <span key={a.id} className="gr-chip act"><span className="gr-chip-mk" aria-hidden="true">✎</span>{trim(a.text, 22)}{a.xpAwarded > 0 ? ` · +${a.xpAwarded}` : ''}</span>
        ))}
        <button type="button" className="gr-chip add" onClick={() => setSheet({ quest: null })}>＋ Tevékenység</button>
      </div>
      {sheet && <ActivityLogSheet quest={sheet.quest ?? undefined} onClose={() => setSheet(null)} />}
    </div>
  )
}
```

- [ ] **Step 4: Run both modes — expect PASS**, commit:
```bash
node scripts/gen-codemap.mjs
git add frontend/src/features/me/components/MaStrip.tsx frontend/src/features/me/components/MaStrip.test.tsx docs/CODEMAP.md
git commit -m "feat(me): MaStrip — quest chips + ＋ Tevékenység on the Growth hub (mezo-rmi0.1)"
```

---

### Task 7: `GrowthHubPage` + routes + redirects + hub/editor re-targets

**Files:**
- Create: `frontend/src/features/me/pages/GrowthHubPage.tsx`, `GrowthHubPage.test.tsx`
- Delete: `frontend/src/features/me/pages/GrowthPage.tsx`, `GrowthPage.test.tsx`
- Modify: `frontend/src/app/router.tsx:59` (import) and `:267` (routes — add the 4 siblings pointing at placeholder-free pages created in Tasks 8–11; to keep this task green, register only `me/growth` here and add each sibling route in its own task)
- Modify: `frontend/src/features/me/pages/EnHubPage.tsx:190-201` (three `navigate('/me/growth?tab=awards')` → `navigate('/me/growth/kituntetesek')`), `EnHubPage.test.tsx:239-251` (expect `/me/growth/kituntetesek`)
- Modify: `frontend/src/features/me/pages/RoutineEditorPage.tsx:45` → `<PageHead onBack={() => navigate('/me/growth/rutin')} label="‹ Rutin" />`; `RoutineEditorPage.test.tsx:81` area — assert the back target `/me/growth/rutin`
- Modify: `frontend/tests/visual/visual.spec.ts:64` → `['me-growth', '/me/growth']` and `['me-growth-awards', '/me/growth/kituntetesek']`

**Interfaces:**
- Produces: `GrowthHubPage()`; `TAB_REDIRECT: Record<string, string>` = `{ skills: '/me/growth/skillek', routines: '/me/growth/rutin', journal: '/me/growth/naplo', awards: '/me/growth/kituntetesek' }`.
- Consumes: `GrowthHero` (Task 5), `MaStrip` (Task 6), `growthStats` (Task 4), `useGamification`, `useProgressionProfile`, `useHabitSummary`, `useQuestHistory`, `useActivityHistory`, `useAchievements`, `Mosaic`, `Tile`, `ClaySpot`, `STREAK_MILESTONE_COINS`.

- [ ] **Step 1: Failing tests** — `GrowthHubPage.test.tsx` (barrel-mock as `GrowthPage.test.tsx`, plus `useGamification`, `useAchievities`… exact list below; pin `localDateString` to `2026-07-12`; render through `createMemoryRouter` with a `routes` array so `<Navigate>` redirects can be asserted):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { GrowthHubPage } from '@/features/me/pages/GrowthHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { progressionProfileMock } from '@/data/progression/progressionMock'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import { mockQuestDay, mockQuestHistory } from '@/data/quest/questMock'
import { mockActivities, mockActivityHistory } from '@/data/activity/activityMock'
import { achievementsMock } from '@/data/progression/achievementsMock'
import { mockHabitSummary } from '@/data/habit/habitMock'

const hooks = vi.hoisted(() => ({
  useProgressionProfile: vi.fn(), useGamification: vi.fn(), useHabitSummary: vi.fn(), useQuestHistory: vi.fn(),
  useActivityHistory: vi.fn(), useAchievements: vi.fn(), useDailyQuests: vi.fn(), useQuestActions: vi.fn(), useActivities: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/hooks')>()), ...hooks }))
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()), localDateString: () => '2026-07-12',
}))
function Loc() { const l = useLocation(); return <span data-testid="loc">{l.pathname}</span> }
function renderAt(path: string) {
  const router = createMemoryRouter([
    { path: '/me/growth', element: <><GrowthHubPage /><Loc /></> },
    { path: '*', element: <Loc /> },
  ], { initialEntries: [path] })
  return render(<QueryWrapper><LevelUpProvider><RouterProvider router={router} /></LevelUpProvider></QueryWrapper>)
}
beforeEach(() => {
  hooks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock })
  hooks.useGamification.mockReturnValue({ profile: gamificationProfileMock, isPending: false })
  hooks.useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  hooks.useQuestHistory.mockReturnValue({ data: mockQuestHistory })
  hooks.useActivityHistory.mockReturnValue({ data: mockActivityHistory })
  hooks.useAchievements.mockReturnValue({ data: achievementsMock })
  hooks.useDailyQuests.mockReturnValue({ quests: mockQuestDay, levelUps: [], rerollsLeft: 1, mode: 'mock' })
  hooks.useQuestActions.mockReturnValue({ reroll: vi.fn(), pending: false, consumeLevelUps: vi.fn() })
  hooks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
})
afterEach(() => vi.clearAllMocks())

test('hub anatomy: ‹ Én head, hero XP (FE sum 18 985), Ma strip, four tiles inside one EntranceGroup', () => {
  const { container } = renderAt('/me/growth')
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Én')
  expect(screen.getByText('18 985')).toBeInTheDocument()
  expect(screen.getByText('Szint 12')).toBeInTheDocument()          // gamificationProfileMock.level
  expect(screen.getByText('78%')).toBeInTheDocument()               // traits.disciplinePct
  expect(screen.getByRole('button', { name: 'Küldetések · a Nap fülön' })).toBeInTheDocument()
  for (const t of ['Skillek', 'Rutin', 'Napló', 'Kitüntetések']) expect(screen.getByRole('button', { name: t })).toBeInTheDocument()
  for (const r of container.querySelectorAll('.rise')) expect(r.closest('.mz-play')).not.toBeNull()
})

test('tile lines come from the page hooks — band lengths, habit counters, journal counts, badges + streak', () => {
  renderAt('/me/growth')
  expect(screen.getByRole('button', { name: 'Skillek' })).toHaveTextContent('33 skill · legjobb Lv 7')
  expect(screen.getByRole('button', { name: 'Rutin' })).toHaveTextContent('6 reggel · 4 este / 30')
  const completed = mockQuestHistory.filter((q) => q.status === 'completed').length
  expect(screen.getByRole('button', { name: 'Napló' })).toHaveTextContent(`${completed} ✓ · ${mockActivityHistory.length} ✎ · 30 nap`)
  expect(screen.getByRole('button', { name: 'Kitüntetések' })).toHaveTextContent('4 / 9 jelvény · 6 napos sorozat')
})

test('tiles navigate to their sibling routes', async () => {
  renderAt('/me/growth')
  await userEvent.click(screen.getByRole('button', { name: 'Skillek' }))
  expect(screen.getByTestId('loc').textContent).toBe('/me/growth/skillek')
})

test('legacy ?tab=awards deep link redirects to /me/growth/kituntetesek', () => {
  renderAt('/me/growth?tab=awards')
  expect(screen.getByTestId('loc').textContent).toBe('/me/growth/kituntetesek')
})

test('streak milestone within 10 days shows the pulse dot on Kitüntetések; far away hides it', () => {
  hooks.useGamification.mockReturnValue({ profile: { ...gamificationProfileMock, streakDays: 25 }, isPending: false })
  const { container, unmount } = renderAt('/me/growth')
  expect(container.querySelector('.gr-pulse')).not.toBeNull()
  unmount()
  hooks.useGamification.mockReturnValue({ profile: { ...gamificationProfileMock, streakDays: 8 }, isPending: false })
  const r2 = renderAt('/me/growth')
  expect(r2.container.querySelector('.gr-pulse')).toBeNull()
})
```

Note on the Kitüntetések line: `STREAK_MILESTONE_COINS` keys are the milestones (7/30/100…, see `frontend/src/data/gamification/gamificationStore.ts`); `next − streakDays ≤ 10` ⇒ pulse. With `streakDays: 6` (fixture) the next milestone is 7 ⇒ pulse shows in the first test too — that is fine.

- [ ] **Step 2: Run — expect FAIL** (module missing).

- [ ] **Step 3: Implement `GrowthHubPage.tsx`**

```tsx
// ============================================================
// Mezo · GrowthHubPage (mezo-rmi0.1) — the Growth hub, prototype growth-tab.html hub panel
// ×1.18 (spec docs/superpowers/specs/2026-09-02-growth-hub-design.md §2). Replaces the
// segment-switch GrowthPage: hero (GrowthHero) → Ma strip (MaStrip) → 2×2 mosaic whose
// lines come from each sub-page's OWN hook (undefined while unresolved, never 0/—). The
// four tiles open flat sibling routes (Karakter idiom); the legacy `?tab=` deep links
// redirect to them. Every hook, mutation and honest-state rule is verbatim — only the
// face changed (ADR 0033). ADR 0010: XP is feedback, nothing here gates or counts down.
// ============================================================
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useAchievements, useActivityHistory, useGamification, useHabitSummary, useProgressionProfile, useQuestHistory,
} from '@/data/hooks'
import { STREAK_MILESTONE_COINS } from '@/data/gamification/gamificationStore'
import { GHOST_GAMIFICATION } from '@/data/gamification/gamificationMock'
import { GrowthHero } from '@/features/me/components/GrowthHero'
import { MaStrip } from '@/features/me/components/MaStrip'
import { growthStats } from '@/features/me/logic/growthStats'
import { ClaySpot } from '@/shared/ui/clay'
import { Mosaic, MozaikPage, PageBody, PageHead, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { addDays, localDateString } from '@/shared/lib/dates'

export const TAB_REDIRECT: Record<string, string> = {
  skills: '/me/growth/skillek', routines: '/me/growth/rutin', journal: '/me/growth/naplo', awards: '/me/growth/kituntetesek',
}
const MILESTONES = Object.keys(STREAK_MILESTONE_COINS).map(Number).sort((a, b) => a - b)
const PULSE_WINDOW_DAYS = 10

export function GrowthHubPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const legacy = params.get('tab')
  const { data: profile } = useProgressionProfile()
  const { profile: gam } = useGamification()
  const { data: habitSummary } = useHabitSummary()
  const { data: achievements } = useAchievements()
  const today = localDateString()
  const from = addDays(today, -29)
  const { data: quests } = useQuestHistory(from, today)
  const { data: activities } = useActivityHistory(from, today)

  if (legacy && TAB_REDIRECT[legacy]) return <Navigate to={TAB_REDIRECT[legacy]} replace />

  const stats = growthStats(profile)
  // The gamification level row only when the profile is a real one (ghost = switch off / unresolved).
  const level = gam === GHOST_GAMIFICATION ? null : { level: gam.level, xpInLevel: gam.xpInLevel, xpForNext: gam.xpForNext }

  const skillLine = stats.skillCount > 0 ? <><b>{stats.skillCount} skill</b> · legjobb Lv {stats.bestLevel}</> : undefined
  const rutinLine = <><b>{habitSummary.perfectMorningDays30}</b> reggel · <b>{habitSummary.perfectEveningDays30}</b> este <span className="mz-mut">/ 30</span></>
  const completed = quests.filter((q) => q.status === 'completed').length
  const naploLine = <><b>{completed} ✓</b> · {activities.length} ✎ <span className="mz-mut">· 30 nap</span></>
  const done = achievements.badges.filter((b) => b.achieved).length
  const kitLine = achievements.badges.length > 0
    ? <><b>{done} / {achievements.badges.length}</b> jelvény · <b>{gam.streakDays}</b> napos sorozat</>
    : undefined
  const nextMilestone = MILESTONES.find((m) => m > gam.streakDays)
  const pulse = nextMilestone != null && nextMilestone - gam.streakDays <= PULSE_WINDOW_DAYS

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me')} label="‹ Én" />
      <PageBody>
        <EntranceGroup>
          <GrowthHero totalXp={stats.totalXp} level={level} disciplinePct={profile.traits?.disciplinePct ?? null}
            consistencyWeeks={profile.traits?.consistencyWeeks ?? 0} />
          <MaStrip />
          <Mosaic className="mt-md">
            {/* Skillek + Kitüntetések wear clay SPOTS (s-hajtas / s-medal), so they are composed by
                hand like EdzesHubPage's Medálok tile — Tile's icon slot only takes i-* icons. */}
            <button type="button" className="mz-tile mz-w-lav rise" style={{ '--d': '170ms' } as React.CSSProperties}
              aria-label="Skillek" onClick={() => navigate('/me/growth/skillek')}>
              <div className="mz-tile-top"><span className="mz-eyebrow">Skillek</span></div>
              <div className="mz-spotwrap"><ClaySpot name="s-hajtas" size={50} /></div>
              {skillLine !== undefined && <div className="mz-tile-line gr-tile-line">{skillLine}</div>}
            </button>
            <Tile wash="gold" icon="i-hajnal" iconSize={47} eyebrow="Rutin" delayMs={220} className="gr-tile-line"
              line={rutinLine} onClick={() => navigate('/me/growth/rutin')} aria-label="Rutin" />
            <Tile wash="sky" icon="i-naplo" iconSize={47} eyebrow="Napló" delayMs={270} className="gr-tile-line"
              line={naploLine} onClick={() => navigate('/me/growth/naplo')} aria-label="Napló" />
            <button type="button" className="mz-tile mz-w-sage rise" style={{ '--d': '320ms' } as React.CSSProperties}
              aria-label="Kitüntetések" onClick={() => navigate('/me/growth/kituntetesek')}>
              <div className="mz-tile-top"><span className="mz-eyebrow">Kitüntetések</span>{pulse && <span className="gr-pulse" aria-hidden="true" />}</div>
              <div className="mz-spotwrap"><ClaySpot name="s-medal" size={52} /></div>
              {kitLine !== undefined && <div className="mz-tile-line gr-tile-line">{kitLine}</div>}
            </button>
          </Mosaic>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

If `GHOST_GAMIFICATION` is not exported from `gamificationMock.ts` under that name, use whatever the file exports for the ghost (it is imported in `gamificationHooks.ts:6` as `GHOST_GAMIFICATION`). If `.mz-mut` does not exist in prototype.css, add `.mz-mut { color: var(--mz-ink-soft); }` next to `.mz-eyebrow` (~line 4388). If `.mt-md` is not a utility in the app CSS, drop the className.

- [ ] **Step 4: Router + hub/editor re-targets + visual list**

`router.tsx:59` → `import { GrowthHubPage } from '@/features/me/pages/GrowthHubPage'`; `:267` → `{ path: 'me/growth', element: <GrowthHubPage /> },` with the comment `// Growth hub (mezo-rmi0.1) — hero + Ma strip + 2×2 mosaic; the four sub-pages are flat siblings below (added per task).`
`EnHubPage.tsx`: the three `'/me/growth?tab=awards'` → `'/me/growth/kituntetesek'`; `EnHubPage.test.tsx:245,251` → `'/me/growth/kituntetesek'`.
`RoutineEditorPage.tsx:45` → `onBack={() => navigate('/me/growth/rutin')} label="‹ Rutin"`; extend `RoutineEditorPage.test.tsx` at line ~81 to assert the navigation target is `/me/growth/rutin` (follow that test's existing navigation-assert pattern).
`visual.spec.ts:64` → `['me-growth', '/me/growth'],` and `['me-growth-awards', '/me/growth/kituntetesek'],` (keep the golden NAME `me-growth-awards`; baselines are regenerated by the `update-visual-baselines.yml` workflow after merge — note it in the PR).
Delete `GrowthPage.tsx` + `GrowthPage.test.tsx` (`git rm`).

- [ ] **Step 5: Run** `VITE_USE_MOCK=false pnpm test src/features/me src/app` and `VITE_USE_MOCK=true pnpm test src/features/me src/app`; `pnpm build`. Expected: green (the 4 sibling routes are not yet registered — the tile-navigation test only asserts the pathname).

- [ ] **Step 6: Commit**
```bash
node scripts/gen-codemap.mjs
git add -A frontend/src/features/me/pages frontend/src/app/router.tsx frontend/tests/visual/visual.spec.ts docs/CODEMAP.md
git commit -m "feat(me): GrowthHubPage — hero + Ma strip + 2×2 mosaic replaces the segment GrowthPage (mezo-rmi0.1)"
```

---

### Task 8: `SkillBandCard` v2 + `GrowthSkillsPage` + route

**Files:**
- Modify: `frontend/src/features/me/components/SkillBandCard.tsx` (rewrite), `SkillBandCard.test.tsx` (rewrite)
- Create: `frontend/src/features/me/pages/GrowthSkillsPage.tsx`, `GrowthSkillsPage.test.tsx`
- Modify: `frontend/src/app/router.tsx` (add `{ path: 'me/growth/skillek', element: <GrowthSkillsPage /> }` right after `me/growth`)
- Check: `grep -rn "SkillBandCard" frontend/src` — the only consumer was GrowthPage (deleted); `GrowthSummaryCard` uses `.skl` directly and is untouched.

**Interfaces:**
- Produces: `SkillRowVM = { key; icon: ReactNode; name; level; progressPct; xp }` (unchanged) and
  `SkillBandCard({ eyebrow, chip, chipTone, rows, footer?, wash, delayMs?, previewRows = 4 }: { eyebrow: string; chip: string; chipTone: 'ok' | 'warn' | 'lav'; rows: SkillRowVM[]; footer?: ReactNode; wash: 'lav' | 'sage' | 'amber'; delayMs?: number; previewRows?: number })`.
- Consumes: `perkHint` (Task 4), `PageHero spot` (Task 2), `growthStats` (Task 4), `hu1`, `huInt`.

- [ ] **Step 1: Failing `SkillBandCard` tests** (replace the file):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'

const row = (key: string, level: number, pct = 50): SkillRowVM => ({ key, icon: key.slice(0, 2), name: key, level, progressPct: pct, xp: level * 100 })
const rows = [row('a', 9, 35), row('b', 7), row('c', 5), row('d', 4), row('e', 3), row('f', 2)]

test('renders the preview rows (4) with Lv plaques and animated meters; the rest hidden behind Mind a 6 ▸', async () => {
  const { container } = render(<div className="mz-play"><SkillBandCard eyebrow="Izom" chip="6 izom · legjobb Lv 9" chipTone="warn" wash="amber" rows={rows} /></div>)
  expect(container.querySelectorAll('.gr-skl')).toHaveLength(6)
  expect(container.querySelectorAll('.gr-skl.more')).toHaveLength(2)
  expect(screen.getByText('Lv 9')).toBeInTheDocument()
  expect(container.querySelector('.gr-skl .gr-tbar i')?.getAttribute('style')).toContain('--w: 35%')
  await userEvent.click(screen.getByRole('button', { name: 'Mind a 6 ▸' }))
  expect(container.querySelector('.gr-band')?.classList.contains('expanded')).toBe(true)
  expect(screen.getByRole('button', { name: 'Kevesebb ▴' })).toBeInTheDocument()
})

test('the perk hint appears only one level before a milestone', () => {
  const { container } = render(<SkillBandCard eyebrow="LIFE" chip="x" chipTone="lav" wash="lav" rows={rows} />)
  const hints = [...container.querySelectorAll('.gr-skl-perk')].map((e) => e.textContent)
  expect(hints).toEqual(['→ perk Lv 10', '→ perk Lv 5'])   // a (9) and d (4)
})

test('no expand button at or under previewRows; footer renders when given', () => {
  render(<SkillBandCard eyebrow="LIFE" chip="x" chipTone="lav" wash="lav" rows={rows.slice(0, 3)} footer={<span>Megtakarítás (30 nap) · <b>50 000 Ft</b></span>} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm test src/features/me/components/SkillBandCard.test.tsx`

- [ ] **Step 3: Rewrite `SkillBandCard.tsx`**

```tsx
import { useState, type ReactNode } from 'react'
import { perkHint } from '@/features/me/logic/perkMilestones'
import { clampPct } from '@/shared/lib/pct'
import { cn } from '@/shared/lib/cn'

export interface SkillRowVM { key: string; icon: ReactNode; name: string; level: number; progressPct: number; xp: number }
export type SkillBandWash = 'lav' | 'sage' | 'amber'
const BAR: Record<SkillBandWash, string> = { lav: 'lav', sage: 'sage', amber: 'gold' }

/**
 * One skill band (LIFE / Atlétikus / Izom) — Growth Skillek page (mezo-rmi0.1, prototype
 * growth-tab.html `band()`): washed card, eyebrow + tinted chip, rows sorted by the caller
 * (level desc, XP desc) as icon cell · name · animated meter · optional `→ perk Lv n` hint one
 * level before a milestone · `Lv n` plaque. The first `previewRows` show; the rest sit behind
 * `Mind a {n} ▸` (card-local `expanded`). No XP readout per row — the chip carries the band XP.
 */
export function SkillBandCard({ eyebrow, chip, chipTone, rows, footer, wash, delayMs, previewRows = 4 }: {
  eyebrow: string; chip: string; chipTone: 'ok' | 'warn' | 'lav'; rows: SkillRowVM[]
  footer?: ReactNode; wash: SkillBandWash; delayMs?: number; previewRows?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const d = delayMs ?? 0
  return (
    <div className={cn('gr-band', wash, 'rise', expanded && 'expanded')} style={{ '--d': `${d}ms` } as React.CSSProperties}>
      <div className="gr-band-top">
        <span className="mz-eyebrow">{eyebrow}</span>
        <span className={cn('gr-band-chip', chipTone)}>{chip}</span>
      </div>
      {rows.map((r, i) => {
        const hint = perkHint(r.level)
        return (
          <div key={r.key} className={cn('gr-skl', i >= previewRows && 'more')}>
            <span className="gr-skl-ic" aria-hidden="true">{r.icon}</span>
            <span className="gr-skl-nm">{r.name}</span>
            <div className="gr-tbar"><i className={BAR[wash]} style={{ '--w': `${clampPct(r.progressPct)}%`, '--d': `${d + 260 + i * 55}ms` } as React.CSSProperties} /></div>
            {hint != null && <span className="gr-skl-perk">→ perk Lv {hint}</span>}
            <span className="gr-skl-lv">Lv {r.level}</span>
          </div>
        )
      })}
      {rows.length > previewRows && (
        <button type="button" className="gr-expand" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Kevesebb ▴' : `Mind a ${rows.length} ▸`}
        </button>
      )}
      {footer && <div className="gr-band-foot">{footer}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.** Then the page.

- [ ] **Step 5: Failing `GrowthSkillsPage` tests**

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GrowthSkillsPage } from '@/features/me/pages/GrowthSkillsPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { GHOST_PROGRESSION_PROFILE, progressionProfileMock } from '@/data/progression/progressionMock'

const hooks = vi.hoisted(() => ({ useProgressionProfile: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/hooks')>()), ...hooks }))
const renderPage = () => render(<QueryWrapper><MemoryRouter initialEntries={['/me/growth/skillek']}><GrowthSkillsPage /></MemoryRouter></QueryWrapper>)
beforeEach(() => hooks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock }))
afterEach(() => vi.clearAllMocks())

test('hero: 33 skill + ‹ Growth; stat strip LIFE avg / athlete level / muscle best', () => {
  renderPage()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Growth')
  expect(screen.getByText('33')).toBeInTheDocument()
  expect(screen.getByText('1,8')).toBeInTheDocument()      // hu1(1.75) → "1,8"
  expect(screen.getByText('4,3')).toBeInTheDocument()      // athleteLevel
  expect(screen.getByText('Lv 6')).toBeInTheDocument()     // best muscle (also a plaque — use getAllByText if ambiguous)
})

test('three bands with derived chips; one .gr-skl per skill; LIFE rows wear clay icons, no emoji', () => {
  const { container } = renderPage()
  expect(screen.getByText('8 skill · 1 085 XP')).toBeInTheDocument()
  expect(screen.getByText('12 skill · átlag 4,6')).toBeInTheDocument()
  expect(screen.getByText('13 izom · legjobb Lv 6')).toBeInTheDocument()
  expect(container.querySelectorAll('.gr-skl')).toHaveLength(33)
  expect(container.querySelectorAll('.gr-band.lav .gr-skl-ic use')).toHaveLength(8)
  expect(container.textContent).not.toMatch(/[🧘🌱🍳💰🎯📚🤝🛌]/u)
  expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
})

test('ghost profile: stat cells show — and no bands', () => {
  hooks.useProgressionProfile.mockReturnValue({ data: GHOST_PROGRESSION_PROFILE })
  const { container } = renderPage()
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  expect(container.querySelectorAll('.gr-band')).toHaveLength(0)
})
```

- [ ] **Step 6: Run — expect FAIL**, then implement `GrowthSkillsPage.tsx`:

```tsx
// ============================================================
// Mezo · GrowthSkillsPage (mezo-rmi0.1) — /me/growth/skillek, prototype growth-tab.html
// #page-skillek ×1.18 (spec §3). Hero (s-hajtas spot + skill count) → StatStrip (LIFE
// Lv-átlag · Atléta-szint · Izom legjobb; null → —, the StatCell rule) → three parallel
// SkillBandCards, chips derived from band lengths (never the old 8/12/13 hardcode).
// No skill-detail page, no XP time series (the contract carries no series).
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useProgressionProfile } from '@/data/hooks'
import type { SkillLevel } from '@/data/progression/progressionApi'
import { MUSCLE_LABELS } from '@/data/train/train'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'
import { growthStats } from '@/features/me/logic/growthStats'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { hu1, huInt } from '@/shared/lib/huNum'

const byLevelXpDesc = (a: SkillLevel, b: SkillLevel) => b.level - a.level || b.cumulativeXp - a.cumulativeXp
const initials = (name: string) => name.slice(0, 2)

function toRows(skills: SkillLevel[], iconOf: (key: string, name: string) => React.ReactNode, nameOf: (key: string) => string): SkillRowVM[] {
  return [...skills].sort(byLevelXpDesc).map((s) => {
    const name = nameOf(s.skillKey)
    return { key: s.skillKey, icon: iconOf(s.skillKey, name), name, level: s.level, progressPct: s.progressPct, xp: s.cumulativeXp }
  })
}

export function GrowthSkillsPage() {
  const navigate = useNavigate()
  const { data: profile } = useProgressionProfile()
  const life = profile.life ?? [], athletic = profile.athletic ?? [], muscle = profile.muscle ?? []
  const s = growthStats(profile)
  const lifeMeta = (k: string) => LIFE_SKILLS.find((x) => x.key === k)
  const savings = profile.savingsHuf30d

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth" />
      <PageHero spot="s-hajtas" iconSize={54} big={s.skillCount} name="skill" />
      <PageBody principle="A szint visszajelzés, nem jutalom — semmi nem nyílik vagy zárul tőle. Az XP-idősort nem rajzoljuk: a contract nem hordoz sorozatot.">
        <EntranceGroup>
          <StatStrip className="rise">
            <StatCell value={s.lifeAvg != null ? hu1(s.lifeAvg) : '—'} label="LIFE Lv-átlag" />
            <StatCell value={profile.athleteLevel != null ? hu1(profile.athleteLevel) : '—'} label="Atléta-szint" />
            <StatCell value={s.muscleBest != null ? `Lv ${s.muscleBest}` : '—'} label="Izom legjobb" />
          </StatStrip>
          {life.length > 0 && (
            <SkillBandCard delayMs={60} wash="lav" chipTone="lav" eyebrow="LIFE" chip={`${life.length} skill · ${huInt(s.lifeXp)} XP`}
              rows={toRows(life, (k) => { const m = lifeMeta(k); return m ? <ClayIcon name={m.clayIcon} size={16} /> : '✨' }, (k) => lifeMeta(k)?.name ?? k)}
              footer={typeof savings === 'number' && savings > 0 ? <>Megtakarítás (30 nap) · <b>{huInt(savings)} Ft</b></> : undefined} />
          )}
          {athletic.length > 0 && (
            <SkillBandCard delayMs={120} wash="sage" chipTone="ok" eyebrow="Atlétikus"
              chip={`${athletic.length} skill · átlag ${s.athleticAvg != null ? hu1(s.athleticAvg) : '—'}`}
              rows={toRows(athletic, (_, n) => initials(n), (k) => ATHLETIC_META[k]?.name ?? k)} />
          )}
          {muscle.length > 0 && (
            <SkillBandCard delayMs={180} wash="amber" chipTone="warn" eyebrow="Izom"
              chip={`${muscle.length} izom · legjobb Lv ${s.muscleBest ?? '—'}`}
              rows={toRows(muscle, (_, n) => initials(n), (k) => MUSCLE_LABELS[k] ?? k)} />
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

`StatStrip` has no `style` prop — the `rise` element needs `--d`; wrap it: `<div className="rise" style={{ '--d': '0ms' } as React.CSSProperties}><StatStrip>…</StatStrip></div>` instead of `className="rise"` on the strip. Route: add `{ path: 'me/growth/skillek', element: <GrowthSkillsPage /> },` + import in `router.tsx`.

- [ ] **Step 7: Run both modes** `pnpm test src/features/me` (+ `VITE_USE_MOCK=false`), `pnpm build`; commit:
```bash
node scripts/gen-codemap.mjs
git add frontend/src/features/me frontend/src/app/router.tsx docs/CODEMAP.md
git commit -m "feat(me): GrowthSkillsPage + SkillBandCard v2 (Lv plaques, expand, perk hints) (mezo-rmi0.1)"
```

---

### Task 9: `GrowthRutinPage` (RoutinesTab folded in) + route

**Files:**
- Create: `frontend/src/features/me/pages/GrowthRutinPage.tsx`, `GrowthRutinPage.test.tsx`
- Delete: `frontend/src/features/me/components/RoutinesTab.tsx`, `RoutinesTab.test.tsx` (port its 8 cases: today counters + strength; past day summary; empty past day ghost; catalog-driven cards ×3; editor entry ×2)
- Modify: `router.tsx` (add `me/growth/rutin`)

**Interfaces:** Produces `GrowthRutinPage()`. Consumes `useHabitDay`, `useHabitSummary`, `useHabitCatalog`, `DayNavigator`, `GhostState`, `ClaySpot` (`s-reggel`/`s-este`), `ClayIcon i-hajnal`.

- [ ] **Step 1: Failing tests** — copy `RoutinesTab.test.tsx`'s mock setup (it barrel-mocks `useHabitDay/useHabitSummary/useHabitCatalog` and wraps in `MemoryRouter`; keep its fixtures) and rewrite the cases:

```tsx
test('today: hero 6 tökéletes reggel, two counter tiles with 30 cells each (6 / 4 filled), chains with strength %', () => {
  const { container } = renderPage()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Growth')
  expect(screen.getByText('tökéletes reggel')).toBeInTheDocument()
  expect(container.querySelectorAll('#gr-cells-m i')).toHaveLength(30)
  expect(container.querySelectorAll('#gr-cells-m i.on')).toHaveLength(mockHabitSummary.perfectMorningDays30)
  expect(container.querySelectorAll('#gr-cells-e i.ev.on')).toHaveLength(mockHabitSummary.perfectEveningDays30)
  expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
  expect(screen.getByText('Esti rutin')).toBeInTheDocument()
  expect(container.querySelectorAll('.gr-chain-pct').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: /Szerkesztés/ })).toBeInTheDocument()
})
test('past day: summary card `Reggel d/n · Este d/n · +xp XP`, no counters, no strength, no Szerkesztés', async () => { /* port RoutinesTab case 2: click "Előző nap", assert summary text from mockHabitDay counts, expect no .gr-covgrid, no .gr-chain-pct, no Szerkesztés */ })
test('past day with a zero chain shows the soft note (never "megszakadt")', async () => { /* mock useHabitDay with all MORNING pending after navigating back; expect text /kimaradt — a lánc másnap folytatódott/ and no /megszakadt/ */ })
test('empty past day: quiet ghost', async () => { /* port case 3 */ })
test('catalog-driven chains: seed → two cards from catalog titles; a third DAY chain renders; inactive chain does not', () => { /* port cases 4–6 verbatim */ })
test('Szerkesztés navigates to /me/routines/edit', async () => { /* port case 7 */ })
```

Write every ported case in full (copy the bodies from `RoutinesTab.test.tsx`, replacing `render(<RoutinesTab />)` with the page render and the old selectors: `.gr-covtile` → `#gr-cells-m/#gr-cells-e`, `.hab-spct` → `.gr-chain-pct`).

- [ ] **Step 2: Run — expect FAIL.** Implement:

```tsx
// ============================================================
// Mezo · GrowthRutinPage (mezo-rmi0.1) — /me/growth/rutin, prototype growth-tab.html
// #page-rutin ×1.18 (spec §4). Habit-domain (habit.md): RoutinesTab's hooks + rules moved
// here verbatim. Two counter tiles — 30 cells visualise the COUNTER (the summary has no daily
// bits, so no calendar mapping, no milestone pill — follow-up mezo-11nm) —, then the day
// navigator (max today) and the catalog-driven chain cards: today = ◦/✓ rows + 30-day strength
// %, past day = summary card + status-only rows; a zero chain reads "kimaradt — a lánc másnap
// folytatódott", never "megszakadt", never terracotta (ADR 0010).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitCatalog, useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart, HabitItem } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'
import { ClayIcon, ClaySpot, type ClaySpotName, type ClayIconName } from '@/shared/ui/clay'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { cn } from '@/shared/lib/cn'

const DAYS = 30
const DAYPART_ICON: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }
const DAYPART_WASH: Record<HabitDaypart, 'amber' | '' | 'lav'> = { MORNING: 'amber', DAY: '', EVENING: 'lav' }

function Cells({ id, count, evening, delayMs }: { id: string; count: number; evening?: boolean; delayMs: number }) {
  return (
    <div className="gr-cells" id={id} aria-hidden="true">
      {Array.from({ length: DAYS }, (_, i) => (
        <i key={i} className={cn(evening && 'ev', i < count && 'on')} style={{ '--d': `${delayMs}ms`, '--i': i } as React.CSSProperties} />
      ))}
    </div>
  )
}

function CounterTile({ id, spot, label, count, evening, delayMs }: { id: string; spot: ClaySpotName; label: string; count: number; evening?: boolean; delayMs: number }) {
  return (
    <div className="gr-covtile">
      <div className="gr-cov-hd"><ClaySpot name={spot} size={19} /><b>{label}</b><span className="gr-cov-n">{count}<small> / {DAYS}</small></span></div>
      <Cells id={id} count={count} evening={evening} delayMs={delayMs} />
    </div>
  )
}

export function GrowthRutinPage() {
  const navigate = useNavigate()
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const { catalog } = useHabitCatalog()
  const strength = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null
  const chains = [...catalog.chains].filter((c) => c.isActive).sort((a, b) => a.position - b.position)
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const morning = habits.filter((h) => h.chain === 'MORNING'), evening = habits.filter((h) => h.chain === 'EVENING')
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)
  const missed = chains.filter((c) => { const items = habits.filter((h) => h.chain === c.chainKey); return items.length > 0 && doneOf(items) === 0 })

  const chainCard = (chain: HabitChainInfo, showStrength: boolean, delayMs: number) => {
    const items = habits.filter((h) => h.chain === chain.chainKey)
    if (items.length === 0) return null
    const pcts = items.map((h) => strength(h.key)).filter((p): p is number => p != null)
    const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null
    return (
      <div key={chain.id} className={cn('gr-chain', DAYPART_WASH[chain.daypart], 'rise')} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
        <div className="gr-band-top">
          <ClayIcon name={DAYPART_ICON[chain.daypart]} size={17} />
          <span className="mz-eyebrow">{chain.title}</span>
          <span className={cn('gr-band-chip', chain.daypart === 'EVENING' ? 'lav' : 'warn')}>
            {doneOf(items)} / {items.length}{showStrength && avg != null ? ` · erő ${avg}%` : ''}
          </span>
        </div>
        {items.map((h) => {
          const pct = showStrength ? strength(h.key) : null
          return (
            <div key={h.key} className={cn('gr-chainrow', h.status === 'done' && 'done', h.status !== 'done' && !isToday && 'skip')}>
              <span className="gr-ck" aria-hidden="true">✓</span>
              <span className="sr-only">{h.status === 'done' ? 'kész' : 'nyitott'}</span>
              <span className="tx">{h.title}</span>
              {showStrength && pct != null && <span className="gr-chain-pct">{pct}%</span>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth">
        {isToday && <button type="button" className="mz-pgact" onClick={() => navigate('/me/routines/edit')}><span aria-hidden="true">✏️</span> Szerkesztés</button>}
      </PageHead>
      <PageHero icon="i-hajnal" iconSize={52} big={summary.perfectMorningDays30} name="tökéletes reggel" />
      <PageBody principle="Kimaradt nap nem törli a láncot — holnap folytatódik. A százalék a lánc 30 napos ereje, nem ítélet.">
        <EntranceGroup replayKey={date}>
          {isToday && (
            <div className="gr-covgrid rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <CounterTile id="gr-cells-m" spot="s-reggel" label="Reggel" count={summary.perfectMorningDays30} delayMs={120} />
              <CounterTile id="gr-cells-e" spot="s-este" label="Este" count={summary.perfectEveningDays30} evening delayMs={200} />
            </div>
          )}
          <div className="gr-daynav rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <DayNavigator date={date} maxDate={today} onChange={setDate} />
          </div>
          {isToday ? chains.map((c, i) => chainCard(c, true, 100 + i * 70))
            : habits.length === 0 ? <GhostState lines={2} message="Nincs rutinadat erre a napra" />
            : (
              <>
                <div className="gr-chain rise" style={{ '--d': '0ms' } as React.CSSProperties}>
                  <div className="gr-daysum">Reggel <b>{doneOf(morning)}/{morning.length}</b> · Este <b>{doneOf(evening)}/{evening.length}</b> · <b style={{ color: 'var(--mz-cell-sage-ink)' }}>+{earnedXp} XP</b></div>
                  {missed.map((c) => <div key={c.id} className="gr-softnote">{c.title} kimaradt — a lánc másnap folytatódott. A 30 napos erő ettől nem nullázódik.</div>)}
                </div>
                {chains.map((c, i) => chainCard(c, false, 60 + i * 70))}
              </>
            )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

If `.mz-pgact` does not exist in `prototype.css`, add next to `.mz-backbtn`: `.mz-pgact { margin-left: auto; border: none; background: var(--mz-chipbg); font-family: inherit; cursor: pointer; border-radius: 999px; padding: 7px 14px; min-height: 36px; font-size: 12px; font-weight: 700; color: var(--mz-cell-amber-ink); box-shadow: var(--mz-shadow); flex: none; }`. Route: `{ path: 'me/growth/rutin', element: <GrowthRutinPage /> }`. `git rm` RoutinesTab + test.

- [ ] **Step 3: Run both modes; build; commit**
```bash
node scripts/gen-codemap.mjs
git add -A frontend/src/features/me frontend/src/app/router.tsx frontend/src/styles/prototype.css docs/CODEMAP.md
git commit -m "feat(me): GrowthRutinPage — 30-cell counters, day navigator, chain rows (RoutinesTab folded) (mezo-rmi0.1)"
```

---

### Task 10: `GrowthNaploPage` + `GrowthJournalCard` v2 + route

**Files:**
- Modify: `frontend/src/features/me/components/GrowthJournalCard.tsx` (rewrite), `GrowthJournalCard.test.tsx` (update selectors/copy)
- Create: `frontend/src/features/me/pages/GrowthNaploPage.tsx`, `GrowthNaploPage.test.tsx`
- Modify: `router.tsx` (add `me/growth/naplo`)

**Interfaces:** Produces `GrowthJournalCard({ days }: { days: JournalDay[] })` (the `summary` prop is REMOVED — the hero carries the counts) and `GrowthNaploPage()`. Consumes `useGrowthWeek` + `mondayOf` (Task 1), `MCells`, `buildGrowthJournal`, `huInt`, `huMonthDay`.

- [ ] **Step 1: Failing tests**

`GrowthJournalCard.test.tsx` — rewrite to the new markup:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { buildGrowthJournal } from '@/features/me/logic/growthJournal'
import { mockQuestHistory } from '@/data/quest/questMock'
import { mockActivityHistory } from '@/data/activity/activityMock'

test('day headers carry label + XP; quest ✓ / activity ✎ / expired — rows with honest meta', () => {
  const days = buildGrowthJournal(mockQuestHistory, mockActivityHistory, '2026-07-12')
  const { container } = render(<div className="mz-play"><GrowthJournalCard days={days} /></div>)
  expect(container.querySelectorAll('.gr-day')).toHaveLength(days.length)
  expect(screen.getByText('Tegnap')).toBeInTheDocument()
  expect(screen.getByText(/csendben lejárt/)).toBeInTheDocument()
  expect(container.querySelector('.gr-jrow.gone')).not.toBeNull()
  expect(container.querySelectorAll('.gr-jrow.act')).toHaveLength(mockActivityHistory.length)
  expect(screen.getAllByText(/^\+\d+ XP$/).length).toBe(days.length)
})
test('empty: the quiet line', () => {
  render(<GrowthJournalCard days={[]} />)
  expect(screen.getByText('Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.')).toBeInTheDocument()
})
```

`GrowthNaploPage.test.tsx` (barrel-mock `useQuestHistory`, `useActivityHistory`, `useGrowthWeek`; pin date `2026-07-12`, so `mondayOf` → `2026-07-06`):
```tsx
test('hero counts completed quests; "Ez a hét" tile shows the 4 cells + savings; journal below', () => {
  hooks.useGrowthWeek.mockReturnValue({ data: { weekStart: '2026-07-06', questCompleted: 6, questClosed: 7, lifeXp: 185, activities: 2, savingsHuf: 12000 }, isPending: false, isError: false })
  renderPage()
  const completed = mockQuestHistory.filter((q) => q.status === 'completed').length
  expect(screen.getByText(String(completed))).toBeInTheDocument()
  expect(screen.getByText('teljesített küldetés')).toBeInTheDocument()
  expect(screen.getByText('Ez a hét')).toBeInTheDocument()
  expect(screen.getByText('júl 6 – júl 12')).toBeInTheDocument()
  expect(screen.getByText('6')).toBeInTheDocument(); expect(screen.getByText('1')).toBeInTheDocument() // 7 closed − 6 completed = 1 lejárt
  expect(screen.getByText('+185')).toBeInTheDocument()
  expect(screen.getByText('12 000 Ft')).toBeInTheDocument()
  expect(hooks.useGrowthWeek).toHaveBeenCalledWith('2026-07-06')
})
test('week tile renders NOTHING when the endpoint is unavailable (null), savings line hidden at 0', () => {
  hooks.useGrowthWeek.mockReturnValue({ data: null, isPending: false, isError: false })
  renderPage()
  expect(screen.queryByText('Ez a hét')).toBeNull()
})
```

Verify `huMonthDay('2026-07-06')` formatting in `frontend/src/shared/lib/dates.ts:59` and adjust the expected `júl 6 – júl 12` string to its exact output.

- [ ] **Step 2: Run — expect FAIL.** Implement.

`GrowthJournalCard.tsx`:
```tsx
import type { JournalDay } from '@/features/me/logic/growthJournal'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'
import { huInt } from '@/shared/lib/huNum'
import { cn } from '@/shared/lib/cn'

/**
 * 30-day quest + activity journal, one card per day (Growth Napló page, mezo-rmi0.1, prototype
 * growth-tab.html JOURNAL). Day header = label · date-ish · +xp; rows: ✓ quest · ✎ activity ·
 * — silently expired ("csendben lejárt", muted, never recolored, never hidden).
 */
export function GrowthJournalCard({ days }: { days: JournalDay[] }) {
  if (days.length === 0) {
    return <p className="gr-band-foot rise" style={{ '--d': '60ms' } as React.CSSProperties}>Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.</p>
  }
  return (
    <>
      {days.map((d, i) => (
        <div key={d.date} className="rise" style={{ '--d': `${60 + i * 60}ms` } as React.CSSProperties}>
          <div className="gr-dayhd"><span className="dow">{d.label}</span><span className="dt">{d.date.slice(5).replace('-', '.')}</span><span className="xp">+{d.xpTotal} XP</span></div>
          <div className="gr-day">
            {d.entries.map((e) => e.kind === 'quest' ? (
              <div key={`q-${e.quest.id}`} className={cn('gr-jrow', e.quest.status !== 'completed' && 'gone')}>
                <span className="gr-jk" aria-hidden="true">{e.quest.status === 'completed' ? '✓' : '—'}</span>
                <span className="tx">{e.quest.title}</span>
                <span className="gr-jmeta">
                  küldetés · {e.quest.slot.toLowerCase()}
                  {e.quest.status === 'completed' && e.quest.completionMode === 'ACTIVITY' ? ' — tevékenységgel teljesült' : ''}
                  {e.quest.status === 'completed' ? ` · +${e.quest.xp}` : ' · csendben lejárt'}
                </span>
              </div>
            ) : (
              <div key={`a-${e.activity.id}`} className="gr-jrow act">
                <span className="gr-jk" aria-hidden="true">✎</span>
                <span className="tx">{e.activity.text}</span>
                <span className="gr-jmeta">
                  tevékenység{e.activity.skillKey ? (() => { const m = LIFE_SKILLS.find((s) => s.key === e.activity.skillKey); return <> · {m && <ClayIcon name={m.clayIcon} size={11} className="inline-clay" />} {m?.name ?? e.activity.skillKey}</> })() : ' · besorolatlan'}
                  {e.activity.xpAwarded > 0 ? ` · +${e.activity.xpAwarded}` : ''}
                  {typeof e.activity.amountHuf === 'number' && e.activity.amountHuf > 0 ? ` · ${huInt(e.activity.amountHuf)} Ft` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
```

`GrowthNaploPage.tsx`:
```tsx
// ============================================================
// Mezo · GrowthNaploPage (mezo-rmi0.1) — /me/growth/naplo, prototype growth-tab.html
// #page-naplo ×1.18 (spec §5). Hero = completed quests (30 days). "Ez a hét" tile = the first
// consumer of GET /api/progression/growth-week (useGrowthWeek); renders NOTHING when the
// source is unavailable. Then the 30-day journal (buildGrowthJournal verbatim).
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useActivityHistory, useGrowthWeek, useQuestHistory } from '@/data/hooks'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { buildGrowthJournal } from '@/features/me/logic/growthJournal'
import { MCells, MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { addDays, huMonthDay, localDateString, mondayOf } from '@/shared/lib/dates'
import { huInt } from '@/shared/lib/huNum'

export function GrowthNaploPage() {
  const navigate = useNavigate()
  const today = localDateString()
  const from = addDays(today, -29)
  const { data: quests } = useQuestHistory(from, today)
  const { data: activities } = useActivityHistory(from, today)
  const weekStart = mondayOf(today)
  const { data: week } = useGrowthWeek(weekStart)
  const days = buildGrowthJournal(quests, activities, today)
  const completed = quests.filter((q) => q.status === 'completed').length

  return (
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth" />
      <PageHero icon="i-naplo" iconSize={52} big={completed} name="teljesített küldetés" />
      <PageBody principle="Utolsó 30 nap · a teljesített küldetések és tevékenységek itt gyűlnek. A csendben lejárt küldetés nem hiba — ajánlat volt.">
        <EntranceGroup>
          {week && (
            <div className="gr-band sky rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div className="gr-band-top">
                <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sky-ink)' }}>Ez a hét</span>
                <span className="gr-band-chip sky">{huMonthDay(weekStart)} – {huMonthDay(addDays(weekStart, 6))}</span>
              </div>
              <MCells cells={[
                { label: 'küldetés ✓', value: week.questCompleted, tone: 'sage' },
                { label: 'lejárt', value: Math.max(0, week.questClosed - week.questCompleted), tone: 'amber' },
                { label: 'tevékenység', value: week.activities, tone: 'lav' },
                { label: 'LIFE XP', value: `+${huInt(week.lifeXp)}`, tone: 'sky' },
              ]} />
              {week.savingsHuf > 0 && <div className="gr-band-foot">Megtakarítás e héten · <b>{huInt(week.savingsHuf)} Ft</b></div>}
            </div>
          )}
          <GrowthJournalCard days={days} />
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

Route: `{ path: 'me/growth/naplo', element: <GrowthNaploPage /> }`.

- [ ] **Step 3: Run both modes; build; commit**
```bash
node scripts/gen-codemap.mjs
git add frontend/src/features/me frontend/src/app/router.tsx docs/CODEMAP.md
git commit -m "feat(me): GrowthNaploPage — Ez a hét tile (growth-week) + day-card journal (mezo-rmi0.1)"
```

---

### Task 11: `GrowthAwardsPage` + StreakCard/TitlesSection/BadgesCard/PerksCard face + route

**Files:**
- Modify: `frontend/src/features/progression/components/ProgressionHome.tsx` (StreakCard + TitleRow + TitlesSection markup → `.gr-*` classes; logic verbatim), its test (`ProgressionHome.test.tsx` if present — grep; update selectors/copy: `🔒` → `LV {n}-TŐL`)
- Modify: `frontend/src/features/me/components/BadgesCard.tsx` + test (progress ring), `PerksCard.tsx` + test (rows + next milestone footer; new prop `next?: { name: string; level: number } | null`)
- Create: `frontend/src/features/me/pages/GrowthAwardsPage.tsx`, `GrowthAwardsPage.test.tsx`
- Modify: `router.tsx` (add `me/growth/kituntetesek`)

**Interfaces:** Produces `GrowthAwardsPage()`; `PerksCard({ perks, next })`; `BadgesCard({ badges })` (unchanged signature). Consumes `nearestMilestone` (Task 4), `StreakCard`, `TitlesSection`, `useAchievements`, `useProgressionProfile`, `MUSCLE_LABELS`, `ATHLETIC_META`, `LIFE_SKILLS`.

- [ ] **Step 1: Failing tests**

`BadgesCard.test.tsx` — replace the bar assertions with:
```tsx
test('unearned badges carry a conic progress ring (--v = current/target %), earned ones ✓ megvan', () => {
  const { container } = render(<div className="mz-play"><BadgesCard badges={achievementsMock.badges} /></div>)
  expect(container.querySelectorAll('.gr-bdg')).toHaveLength(9)
  expect(container.querySelectorAll('.gr-bdg.done')).toHaveLength(4)
  expect(screen.getAllByText('✓ megvan')).toHaveLength(4)
  const q50 = [...container.querySelectorAll('.gr-bdg:not(.done)')].find((b) => b.textContent?.includes('50 küldetés'))!
  expect(q50.querySelector('.gr-ring')?.getAttribute('style')).toContain('--v: 46')
  expect(q50.textContent).toContain('23 / 50')
  expect(screen.getByText('4 / 9 megszerezve')).toBeInTheDocument()
})
```
`PerksCard.test.tsx`:
```tsx
test('rows show Lv plaque, name, effect and skill; footer names the next milestone', () => {
  render(<PerksCard perks={achievementsMock.perks} next={{ name: 'Lát', level: 10 }} />)
  expect(screen.getByText('3 feloldva')).toBeInTheDocument()
  expect(screen.getByText('Lv10')).toBeInTheDocument()   // first perk plaque (use getAllByText if two share it)
  expect(screen.getByText('Páncélzat')).toBeInTheDocument()
  expect(screen.getByText(/a következő: Lát Lv 10/)).toBeInTheDocument()
})
test('empty perks: the honest line; no next → footer without the second clause', () => {
  render(<PerksCard perks={[]} next={null} />)
  expect(screen.getByText('Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.')).toBeInTheDocument()
})
```
`GrowthAwardsPage.test.tsx` (barrel-mock `useAchievements`, `useProgressionProfile`, `useGamification`, `useTitles`, `useGamificationActions`; render in `MemoryRouter`):
```tsx
test('hero 4 / 9 jelvény; streak card, titles, badge grid and perks in one EntranceGroup; ‹ Growth', () => {
  const { container } = renderPage()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Growth')
  expect(screen.getByText('/ 9 jelvény')).toBeInTheDocument()
  expect(screen.getByTestId('streak-card')).toBeInTheDocument()
  expect(screen.getByTestId('titles-section')).toBeInTheDocument()
  expect(container.querySelectorAll('.gr-bdg')).toHaveLength(9)
  expect(screen.getByText('Perkek')).toBeInTheDocument()
  for (const r of container.querySelectorAll('.rise')) expect(r.closest('.mz-play')).not.toBeNull()
})
test('locked ladder titles read LV n-TŐL, not a lock emoji', () => {
  renderPage()
  expect(screen.getAllByText(/^LV \d+-TŐL$/).length).toBeGreaterThan(0)
  expect(screen.queryByText('🔒')).toBeNull()
})
```
For `useTitles`/`useGamificationActions` mocks return `{ titles: TITLE_CATALOG.map((t) => ({ ...t, owned: t.kind === 'LADDER' ? (t.unlockLevel ?? 1) <= 12 : false, equipped: t.key === 'kovetkezetes' })) }` and `{ buyTitle: vi.fn(), equipTitle: vi.fn(), buyStreakSaver: vi.fn(), canMutate: true }`.

- [ ] **Step 2: Run — expect FAIL.** Implement.

`ProgressionHome.tsx` — keep every hook/logic line; change markup only:
- `StreakCard` root: `className="gr-band rise gr-streak"` with `style={{ '--d': …, background: 'var(--mz-wash-coral)', opacity: … }}`; flame `<ClayIcon name="i-lang" size={45} className="gr-flame" />`; number `<span className="gr-streak-n">`; the milestone bar → `<div className="gr-msbar"><i style={{ '--w': `${pct}%` }} /></div>`; keep the copy + `SaverRow`.
- `TitleRow`: root `className={cn('gr-titrow', !t.owned && 'lock')}`; name `<span className="nm">`; sub `<span className="sub">` (ladder `LV n`, shop `<ClayIcon name="i-erme" size={11} /> {price}`); actions: equipped → `<span className="gr-titact worn">Viselve</span>`; owned → `<button className="gr-titact" …>Felvesz</button>`; shop unowned → `<button className="gr-titact" disabled={…}>Megveszem</button>`; locked ladder → `<span className="gr-lockmk">LV {t.unlockLevel}-TŐL</span>`.
- `TitlesSection`: root `className="gr-band rise"`; Létra/Bolt → `<div className="gr-seg" role="tablist"><button className={cn(seg==='ladder' && 'on')} …>Létra</button><button …>Bolt</button></div>`.
- `SaverRow` button → `className="gr-titact"`.

`BadgesCard.tsx`:
```tsx
import type { GrowthBadge } from '@/data/types'
import { huInt } from '@/shared/lib/huNum'

/** Badge grid (mezo-rmi0.1): earned = sage wash + full sage ring + "✓ megvan"; unearned keeps a conic
 *  progress ring (--v = current/target %) and a muted icon — reachable badges stay visible. */
export function BadgesCard({ badges }: { badges: GrowthBadge[] }) {
  const done = badges.filter((b) => b.achieved).length
  return (
    <>
      <div className="gr-band-top rise" style={{ '--d': '110ms', padding: '4px 2px 7px' } as React.CSSProperties}>
        <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sage-ink)' }}>Jelvények</span>
        <span className="gr-band-chip ok">{done} / {badges.length} megszerezve</span>
      </div>
      <div className="gr-bdggrid rise" style={{ '--d': '140ms' } as React.CSSProperties}>
        {badges.map((b) => {
          const v = b.achieved ? 100 : Math.min(100, Math.round((b.current / b.target) * 100))
          return (
            <div key={b.key} className={b.achieved ? 'gr-bdg done' : 'gr-bdg'}>
              <div className="gr-ring" style={{ '--v': v } as React.CSSProperties}><span aria-hidden="true">{b.icon}</span></div>
              <b>{b.name}</b>
              <small>{b.achieved ? '✓ megvan' : `${huInt(b.current)} / ${huInt(b.target)}`}</small>
            </div>
          )
        })}
      </div>
    </>
  )
}
```

`PerksCard.tsx`:
```tsx
import type { PerkUnlock } from '@/data/types'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'

const skillName = (key: string) => ATHLETIC_META[key]?.name ?? LIFE_SKILLS.find((s) => s.key === key)?.name ?? MUSCLE_LABELS[key] ?? key

/** Unlocked perk milestones (mezo-rmi0.1): amber card, Lv plaque · name · effect · skill; the footer
 *  names the skill nearest its next milestone (FE-derived), or just the rule when none. */
export function PerksCard({ perks, next }: { perks: PerkUnlock[]; next: { name: string; level: number } | null }) {
  return (
    <div className="gr-band amber rise" style={{ '--d': '200ms', marginTop: 11 } as React.CSSProperties}>
      <div className="gr-band-top"><span className="mz-eyebrow" style={{ color: 'var(--mz-cell-amber-ink)' }}>Perkek</span><span className="gr-band-chip warn">{perks.length} feloldva</span></div>
      {perks.length === 0 && <p className="gr-band-foot">Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.</p>}
      {perks.map((p) => (
        <div key={p.perkKey + p.unlockedAt} className="gr-perkrow">
          <span className="gr-perk-pi">Lv{p.milestoneLevel}</span>
          <div style={{ flex: 1, minWidth: 0 }}><div className="pn">{p.name}</div><div className="pe">{p.effectCopy}</div></div>
          <span className="pl">{skillName(p.skillKey)}</span>
        </div>
      ))}
      {perks.length > 0 && (
        <div className="gr-band-foot">A skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket{next ? ` — a következő: ${next.name} Lv ${next.level}.` : '.'}</div>
      )}
    </div>
  )
}
```

`GrowthAwardsPage.tsx`:
```tsx
// ============================================================
// Mezo · GrowthAwardsPage (mezo-rmi0.1) — /me/growth/kituntetesek, prototype growth-tab.html
// #page-kit ×1.18 (spec §6). The progression's home (F7.4): StreakCard + TitlesSection
// (buy/equip/saver + canMutate gating verbatim — the coin's only sink), the badge grid with
// progress rings, the perks card. The hub's streak/coin chips and the legacy ?tab=awards land here.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useAchievements, useProgressionProfile } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { BadgesCard } from '@/features/me/components/BadgesCard'
import { PerksCard } from '@/features/me/components/PerksCard'
import { nearestMilestone } from '@/features/me/logic/perkMilestones'
import { StreakCard, TitlesSection } from '@/features/progression/components/ProgressionHome'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const nameOf = (key: string) => ATHLETIC_META[key]?.name ?? LIFE_SKILLS.find((s) => s.key === key)?.name ?? MUSCLE_LABELS[key] ?? key

export function GrowthAwardsPage() {
  const navigate = useNavigate()
  const { data } = useAchievements()
  const { data: profile } = useProgressionProfile()
  const done = data.badges.filter((b) => b.achieved).length
  const next = nearestMilestone([...(profile.life ?? []), ...(profile.athletic ?? []), ...(profile.muscle ?? [])].map((s) => ({ name: nameOf(s.skillKey), level: s.level })))
  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth" />
      <PageHero spot="s-medal" iconSize={59} big={done} name={`/ ${data.badges.length} jelvény`} />
      <PageBody principle="Az érme itt költhető el — címre vagy sorozat-mentőre. Semmi más nem vásárolható, és semmi nem jár le.">
        <EntranceGroup>
          <StreakCard delayMs={0} />
          <TitlesSection delayMs={60} />
          <BadgesCard badges={data.badges} />
          <PerksCard perks={data.perks} next={next} />
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```
Route: `{ path: 'me/growth/kituntetesek', element: <GrowthAwardsPage /> }`.

- [ ] **Step 3: Run both modes for `src/features/me src/features/progression src/app`; `pnpm build`; commit**
```bash
node scripts/gen-codemap.mjs
git add frontend/src/features frontend/src/app/router.tsx docs/CODEMAP.md
git commit -m "feat(me): GrowthAwardsPage — streak, titles, badge rings, perks (mezo-rmi0.1)"
```

---

### Task 12: Full gates + docs + design-iterations log

**Files:**
- Modify: `docs/features/growth.md` §2 (replace the "Growth keeps the full DailyQuestsCard… Skillek tab" description with the hub + 4 sub-pages + Ma strip; note the DERIVED/ACTIVITY chip semantics), §8 (tests list: the five page tests + MaStrip/GrowthHero/logic tests, both modes, visual goldens `me-growth`, `me-growth-awards` → `/me/growth/kituntetesek`), §9 (remove the stale "orphaned sheets" gotcha; add "Rutin cells visualise a counter, not days — follow-up mezo-11nm"), §10 (file list: GrowthHubPage/GrowthSkillsPage/GrowthRutinPage/GrowthNaploPage/GrowthAwardsPage, GrowthHero, MaStrip, logic/growthStats, logic/perkMilestones, data/progression/growthWeekMock; remove GrowthPage, RoutinesTab; fix the stale `features/progression/components/` line — it exists and hosts ProgressionHome), §7 (LIFE skill recipe: `clayIcon` field required).
- Modify: `docs/features/me.md` §2 Growth paragraph (~line 95: routes + hub), §10 key files.
- Modify: `docs/features/habit.md` §2/§10: the Rutin surface is `GrowthRutinPage` at `/me/growth/rutin` (RoutinesTab retired).
- Create: `docs/design_2.0/2026-09-02-growth-design-iterations.md` — header like `2026-08-31-karakter-design-iterations.md`; sections: **1. Brainstorm decisions (IA=A, hero=A, Ma=A)**, **2. v1 prototype**, **3. Implementation flags** (the spec §9 list, incl. the DERIVED/ACTIVITY chip semantics and the Rutin counter cells + mezo-11nm), **4. Prior art adopted/rejected** (copy from the spec).
- Modify: `docs/design_2.0/prototypes/README.md` — no change (already has growth-tab).

- [ ] **Step 1: Gates** from `frontend/`: `pnpm lint`, `VITE_USE_MOCK=false pnpm test`, `VITE_USE_MOCK=true pnpm test`, `pnpm build`; from the repo root: `node scripts/gen-codemap.mjs --check`, `node scripts/lint-docs.mjs` (if it exists). Fix anything red before proceeding.
- [ ] **Step 2: Docs edits** as listed (real content, no placeholders — quote the routes, the component names and the honest-state rules from the spec).
- [ ] **Step 3: Commit**
```bash
git add docs/features/growth.md docs/features/me.md docs/features/habit.md docs/design_2.0/2026-09-02-growth-design-iterations.md
git commit -m "docs(growth): hub + 4 sub-pages — feature docs, design iterations log (mezo-rmi0.1)"
```
- [ ] **Step 4: Hand off to finishing** — `superpowers:finishing-a-development-branch`: push the branch, open the self-PR (body: scope, implementation flags, the golden regeneration note + `update-visual-baselines.yml` dispatch), wait for CI green, `git pull --rebase` on main, merge `--no-ff`, push main (deploy.yml builds + rolls out), delete the branch, `bd close mezo-rmi0.1`, `bd close mezo-rmi0`.
