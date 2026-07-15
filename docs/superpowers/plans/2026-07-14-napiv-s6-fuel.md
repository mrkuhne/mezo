# Napív Redesign — S6 Fuel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Fuel domain to the Napív vocabulary — sage pill sub-nav, Napív page heads, the Mai screen rebuilt per the mockup (semicircle kcal gauge sage→amber, cutoff/close chips, macro soft bars, ✨ AI strip, enriched timeline slot cards with emoji avatars + F/Sz/Zs dots + sage-ringed "következő", water slot with +250/+500 pills), and in-vocabulary re-skins of Terv/Stack/Receptek/Kamra/Gyógyszer — including de-darkening the recipe hero bands (retiring the `--text-on-media` tokens). No functionality lost; both test modes green after every task.

**Architecture:** Fuel adopts the S4 pill/pghead vocabulary via the `--pill-accent` parametrization built for exactly this (`.np-pills` with sage; a new `.pghead-np.sage` accent modifier). New Mai-specific classes (`.gauge`, `.fuelchips`, `.macror`/`.mac`, `.slot`/`.fav`/`.mrow`/`.mm`/`.st`) append to the Napív section of `prototype.css`, driven by three new wash tokens (`--wash-sage/-amber/-lav`). The gauge is a new presentational `KcalGauge` component; `MacroHero` is superseded on Mai (file stays for now — S8 deletes if orphaned); `SlotCard`/`FuelTimeline` restyle in place keeping every behavior (score sheet, tap-to-log, suggestions, budget slots). Water logging moves from MacroHero into a dedicated timeline-bottom water slot on Mai (function preserved).

**Tech Stack:** React 19, TanStack Query hooks via `@/data/hooks` (signatures untouched), plain CSS in `frontend/src/styles/prototype.css`, Vitest + RTL. Driving spec §4.4: `docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md`. Interactive reference: `docs/superpowers/specs/2026-07-13-napiv-redesign-mockup.html` (`#v-fuel`, lines ~544-628; gauge/slot CSS ~207-229).

## Global Constraints

- Worktree `/Users/daniel.kuhne/MrKuhne/mezo/.worktrees/frontend-design-rethink`, branch `feat/frontend-design-rethink`, bd **mezo-8141**. Verify `git rev-parse --show-toplevel` before every commit; NEVER touch the main checkout. NEVER use `git stash` (shared stack) — RED-check via `git show HEAD:path` to a scratch file.
- Commit with hooks disabled: `git -c core.hooksPath=/dev/null commit -m "... (mezo-8141)"`. Stage explicit paths only — never `git add .` or `-a`. After EVERY commit run `git show --stat HEAD` and verify only intended files; strip a stray `issues.jsonl` with `git reset --soft HEAD~1 && git restore --staged issues.jsonl && git -c core.hooksPath=/dev/null commit -m "<same message>"`.
- Gate after EVERY task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green) + `node scripts/lint-docs.mjs` PASS when a doc/key_file was touched.
- Conventions: no `*Screen`/`*View`; data hooks only from `@/data/hooks`; no barrels; deep `@/*` imports; colocated tests; `shared/ui` untouched (call-site swaps only, per the S5 precedent).
- Hungarian copy, sentence case. Exact strings below are binding: h1 `Mai pacing`, over `Fuel · Reta D{n} · kcal floor {kcal}`, chips `kávé cutoff {t}` / `konyha zár {t}`, timeline secthead `Mai timeline` + `{done}/{total} slot`, next-slot marker `következő`, water slot `Víz · {ml} / {ml} ml`, `+250`/`+500`.
- **Gutter rule:** new full-width blocks carry their own **24px** horizontal gutter.
- **jsdom hazard:** `.np-anim` nodes — presence-only assertions, never `toBeVisible()`. The gauge draw animation gets a `prefers-reduced-motion` guard.
- Dual-mode honesty: real mode never shows mock-seed data; the `pct` helper's 0/0→0 guard stays load-bearing (real-mode cold window renders a zero day); ghost/skeleton/error triads stay as-is.
- Accent discipline: washes get `:root[data-theme="dark"]` overrides; fg accents theme-invariant. Sage family: `--sage` #7FA48A, `--sage-deep` (existing tokens).
- **No functionality lost (spec §5):** meal scoring sheet, tap-to-log (recipe prefill + budget slot), replan, protocol meta row, water logging (+250/+500), micronutrients, RetaPhaseBar on Mai, all sub-page flows (stack builder, recipe editor, kamra detail, medication cycle) survive restyled. A reviewer finding "X removed" is Critical. The Mai context-strip's four data points survive relocated: gym/vb → already in the timeline's workout/sport blocks; coffee/kitchen → the new `.fuelchips`.
- **CI reality:** GitHub Actions billing block may persist (check `gh pr checks` at close). If blocked: replicate CI locally (FE both modes + lint-docs + lint-liquibase + contract-drift) and ask the owner for the no-CI merge. **Merge ONLY via a temporary worktree** (`git worktree add <scratch>/merge-main main`) — NEVER in the shared main checkout (S5 lesson: a parallel session can switch its branch).

---

### Task 1: Sage pills + Fuel page-head vocabulary

**Files:**
- Modify: `frontend/src/styles/prototype.css` (pghead accent modifier + fuel wash tokens)
- Modify: `frontend/src/features/fuel/pages/FuelSubNav.tsx` + `FuelSubNav.test.tsx`

**Interfaces:**
- Produces: `.pghead-np.sage` modifier (over-line in `--sage-deep`); tokens `--wash-sage`, `--wash-amber`, `--wash-lav` (+ dark overrides); FuelSubNav on `.np-pills`/`.np-pill` with `--pill-accent: var(--sage)` — active pill sage. Later tasks use these verbatim.
- FuelSubNav keeps its no-prop signature, `aria-label="Fuel alnavigáció"`, routes and labels (`Mai · Terv · Stack · Receptek · Kamra · Gyógyszer`) unchanged.

- [ ] **Step 1: Append the CSS** (Napív section, before the safe-area block):

```css
/* ===== Napív S6 — Fuel accent vocabulary ===== */
.pghead-np.sage .over { color: var(--sage-deep); }
:root {
  --wash-sage: #EAF0E3;
  --wash-amber: #FFF3E4;
  --wash-lav: #EEEBF6;
}
:root[data-theme="dark"] {
  --wash-sage: rgba(127,164,138,.16);
  --wash-amber: rgba(255,179,71,.16);
  --wash-lav: rgba(155,143,196,.16);
}
```

- [ ] **Step 2: Update `FuelSubNav.test.tsx` FIRST** (failing): mirror the Train pattern — six labels via `getByRole('link', ...)`, active via `.np-pill.on` (`/fuel/stack` → `Stack`; index-only `Mai` at `/fuel`). Run → FAIL.
- [ ] **Step 3: Rewrite `FuelSubNav.tsx`:**

```tsx
import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

const SUBNAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/fuel', label: 'Mai', end: true },
  { to: '/fuel/plan', label: 'Terv' },
  { to: '/fuel/stack', label: 'Stack' },
  { to: '/fuel/recipes', label: 'Receptek' },
  { to: '/fuel/kamra', label: 'Kamra' },
  { to: '/fuel/gyogyszer', label: 'Gyógyszer' },
]

export function FuelSubNav() {
  return (
    <nav className="np-pills" aria-label="Fuel alnavigáció" style={{ '--pill-accent': 'var(--sage)' } as React.CSSProperties}>
      {SUBNAV.map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('np-pill np-press', isActive && 'on')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4:** Tests PASS. Grep `subnav-item` assertions touching Fuel (`grep -rn "subnav" frontend/src/features/fuel frontend/src/app` — fix stragglers the S4 way; Insights/Me sub-navs stay legacy). Full gate both modes → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/styles/prototype.css frontend/src/features/fuel/pages/FuelSubNav.tsx frontend/src/features/fuel/pages/FuelSubNav.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(fe/fuel): sage Napiv pill sub-nav + fuel wash tokens (mezo-8141)"` + content check.

---

### Task 2: `KcalGauge` semicircle component

**Files:**
- Create: `frontend/src/features/fuel/components/KcalGauge.tsx`
- Test: `frontend/src/features/fuel/components/KcalGauge.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `pct` from `@/shared/lib/pct` (0/0→0 guard).
- Produces (Task 4 mounts it): `KcalGauge({ consumed, target }: { consumed: number; target: number })` — renders `.gauge`: a 230×124 SVG semicircle (`M 20 110 A 90 90 0 0 1 200 110`, arc length ≈282.74), track `var(--warm)`, progress stroke `url(#gauge-grad)` (sage→amber linearGradient) with `strokeDasharray={`${(p/100)*ARC} ${ARC}`}` where `p = min(pct(consumed,target),100)`; centered `.big` block: `.n` = consumed (hu tabular), `.u` = `` `/ ${target} kcal · ${pct}%` `` (un-capped pct shown, capped arc).

- [ ] **Step 1: Failing test** (`KcalGauge.test.tsx`):

```tsx
import { render, screen } from '@testing-library/react'
import { KcalGauge } from '@/features/fuel/components/KcalGauge'

test('renders consumed, target and percent with a progress arc', () => {
  const { container } = render(<KcalGauge consumed={1840} target={3100} />)
  expect(screen.getByText('1840')).toBeInTheDocument()
  expect(screen.getByText('/ 3100 kcal · 59%')).toBeInTheDocument()
  const arc = container.querySelector('.gauge-p') as SVGPathElement
  expect(arc).not.toBeNull()
  expect(arc.getAttribute('stroke-dasharray')).toMatch(/^167\.8/) // 59.35% of 282.74
})

test('zero day renders 0% without NaN (real-mode cold window)', () => {
  const { container } = render(<KcalGauge consumed={0} target={0} />)
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByText('/ 0 kcal · 0%')).toBeInTheDocument()
  expect((container.querySelector('.gauge-p') as SVGPathElement).getAttribute('stroke-dasharray')).toMatch(/^0\.0 /)
})

test('overshoot caps the arc at 100% but shows the real percent', () => {
  const { container } = render(<KcalGauge consumed={3500} target={3000} />)
  expect(screen.getByText(/117%/)).toBeInTheDocument()
  expect((container.querySelector('.gauge-p') as SVGPathElement).getAttribute('stroke-dasharray')).toMatch(/^282\.7/)
})
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `KcalGauge.tsx`:

```tsx
import { pct } from '@/shared/lib/pct'

const ARC = Math.PI * 90 // ≈ 282.74, the semicircle path length (r=90)

/** Napív semicircle kcal gauge (spec §4.4) — sage→amber progress, capped at full arc. */
export function KcalGauge({ consumed, target }: { consumed: number; target: number }) {
  const p = pct(consumed, target)
  const filled = (Math.min(p, 100) / 100) * ARC
  return (
    <div className="gauge">
      <svg width="230" height="124" viewBox="0 0 220 120" aria-hidden="true">
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--sage)" />
            <stop offset="1" stopColor="var(--amber)" />
          </linearGradient>
        </defs>
        <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="var(--warm)" strokeWidth="13" strokeLinecap="round" />
        <path
          className="gauge-p" d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="url(#gauge-grad)"
          strokeWidth="13" strokeLinecap="round" strokeDasharray={`${filled.toFixed(1)} ${ARC.toFixed(1)}`}
        />
      </svg>
      <div className="big">
        <div className="n">{consumed}</div>
        <div className="u">/ {target} kcal · {p.toFixed(0)}%</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Append the gauge CSS:**

```css
/* ===== Napív kcal gauge (Fuel Mai, spec §4.4) ===== */
.gauge { position: relative; display: flex; flex-direction: column; align-items: center; }
.gauge .big { position: absolute; top: 56px; text-align: center; }
.gauge .big .n { font-family: var(--ff-display); font-size: 37px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.5px; color: var(--ink); }
.gauge .big .u { font-size: 11.5px; color: var(--faint); font-weight: 700; }
@media (prefers-reduced-motion: no-preference) {
  .gauge-p { transition: stroke-dasharray .9s ease; }
}
```

- [ ] **Step 5:** Tests PASS; full gate → PASS. **Step 6: Commit** — `git add frontend/src/features/fuel/components/KcalGauge.tsx frontend/src/features/fuel/components/KcalGauge.test.tsx frontend/src/styles/prototype.css && git -c core.hooksPath=/dev/null commit -m "feat(fe/fuel): KcalGauge semicircle with sage-amber progress (mezo-8141)"` + content check.

---

### Task 3: Timeline enriched slot cards (`SlotCard`/`FuelTimeline` restyle)

**Files:**
- Modify: `frontend/src/features/fuel/components/SlotCard.tsx`, `FuelTimeline.tsx`, `FuelTimeline.test.tsx`, `SlotCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- ALL props and behaviors UNCHANGED: `SlotCard({ slot, meta, scoredMeal, onOpenScore, onLogMeal })`; done/now/pending states; suggestion + budget-slot pending shapes with their log CTAs; supplement item rows (esti stack capsules); score chip opening `MealScoreSheet`; `windowTip`.
- New structure per slot: `.slot` (+ `.done` / `.next` when `state === 'now'`) — `.fav` emoji avatar (kind-tinted wash bg), `.tx` with `.t1` (meal name / slot label) + `.mrow` (time · **kcal** + `.mm` F/Sz/Zs dots when macros exist; `következő` marker inside the now-slot's mrow), `.st` status circle (done ✓ / supplement 🌙). Log CTAs render under `.tx` as `.chx`-style pill buttons (keep exact labels/handlers).
- Fav emoji per kind: meal 🥣 (breakfast/lunch/dinner may share), snack 🍎, supplement 💊, workout 🏋️, sport 🏐 — derive from the existing `KIND_META` (read `data/kindMeta.ts` FIRST; if it carries an icon/emoji field use it, else map by kind key and note it). Fav washes: meal→`--wash-sage`, snack→`--wash-amber`, supplement→`--wash-lav`, workout/sport→`--wash-gym`/`--wash-sport`, water→`--wash-run`.

**CSS (append):**

```css
/* ===== Napív fuel timeline slots (spec §4.4) ===== */
.slot { display: flex; gap: 12px; background: var(--surface); border-radius: 20px; padding: 13px 15px; box-shadow: var(--np-shadow-row); margin-bottom: 9px; align-items: center; }
.slot.next { box-shadow: 0 0 0 2px var(--sage), 0 10px 24px rgba(127,164,138,.2); }
.slot.done { opacity: .78; }
.slot .fav { width: 42px; height: 42px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; }
.slot .tx { flex: 1; min-width: 0; }
.slot .t1 { font-size: 14px; font-weight: 800; color: var(--ink); }
.slot .mrow { display: flex; align-items: center; gap: 9px; font-size: 10.5px; color: var(--faint); font-weight: 700; margin-top: 4px; flex-wrap: wrap; }
.slot .mrow b { color: var(--ink); font-weight: 800; font-size: 11.5px; }
.slot .mm { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 800; color: var(--sub); }
.slot .mm i { width: 6px; height: 6px; border-radius: 50%; }
.slot .st { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.slot.done .st { background: var(--wash-sage); color: var(--sage-deep); }
.chx { border: 0; cursor: pointer; font: inherit; border-radius: 999px; padding: 7px 13px; font-size: 11.5px; font-weight: 700; }
```

Macro dot colors: F→`var(--sage)`, Sz→`var(--amber)`, Zs→`var(--lav)` (inline `style` on `.mm i`).

- [ ] Steps: update the two test files FIRST (keep every behavior assertion — score chip opens sheet, log CTA fires with the right prefill, supplement rows, windowTip; swap structural assertions to `.slot`/`.slot.next`/`.fav`/`.mrow`/`következő`) → FAIL → restyle both components + CSS → PASS → full gate → commit (`feat(fe/fuel): enriched Napiv timeline slot cards (mezo-8141)` — stage the 5 files) + content check.

---

### Task 4: Mai recomposition — pghead, gauge card, fuelchips, macro bars, aistrip, water slot

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx` + its test (find it: `grep -rln "FuelMaiPage" frontend/src --include='*.test.tsx'`)
- Modify: `frontend/src/features/fuel/components/PacingCard.tsx` (internals → `.aistrip`; name/props stay)
- Modify: `frontend/src/styles/prototype.css` (fuelchips + macror CSS)

**Interfaces:**
- Consumes: `KcalGauge` (Task 2), restyled timeline (Task 3), existing hooks — usage unchanged.
- New render order:
  1. `.pghead-np sage`: `.over` = `` `Fuel · Reta D${retaDay} · kcal floor 2500` `` (the floor value comes from the existing header copy — keep the current source if dynamic), `h1` = `Mai pacing`; the `+ Log` action → `.pgact-np np-press` with `background: 'var(--wash-sage)', color: 'var(--sage-deep)'`, same `openLog()` onClick + `aria-label="Logolás"`.
  2. `RetaPhaseBar` stays (unchanged component).
  3. Gauge card (`.card`-style Napív surface, 24px gutter): `<KcalGauge consumed={fuel.consumed.kcal} target={fuel.targets.kcal} />` + `.fuelchips` (`kávé cutoff {plan.caffeineCutoff}` sage wash / `konyha zár {plan.kitchenClose}` lav wash) + `.macror` soft bars — Fehérje/Szénhidrát/Zsír, widths `pct(consumed.x, targets.x)` capped 100, colors sage/amber/lav, values `` `${consumed} / ${target} g` ``.
  4. `PacingCard` restyled to `.aistrip` (✨ + pacing copy; props unchanged).
  5. Timeline secthead → `.secthead-np`: `Mai timeline` + `` `${doneCount}/${plan.slots.length} slot` ``; protocol meta row keeps content (restyle surfaces to warm/sage); `FuelTimeline` mount unchanged.
  6. NEW water `.slot` after the timeline: 💧 fav (`--wash-run`), `.t1` `` `Víz · ${consumed.water} / ${targets.water} ml` ``, `.mrow` `` `${pct}% · cél` ``, two `.chx` buttons `+250`/`+500` (sky wash/`--tag-run` text) calling `logWater(250|500)` with the existing aria-labels (`Víz +250 ml`).
  7. Micronutrients block keeps content; card surface → Napív tokens.
- **Removals (data preserved elsewhere — document in Task 8):** the context-strip card (gym/vb live in the timeline's workout/sport blocks; coffee/kitchen → fuelchips); `MacroHero` unmounted from Mai (water → the new slot; kcal → gauge; macro cells → macror). MacroHero file NOT deleted (S8 if orphaned — check other consumers with grep and report).

**CSS (append):**

```css
/* ===== Napív fuel Mai — chips + macro soft bars (spec §4.4) ===== */
.fuelchips { display: flex; gap: 7px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }
.macror { margin-top: 14px; }
.mac { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.mac:last-child { margin-bottom: 0; }
.mac .k { width: 70px; font-size: 11.5px; font-weight: 700; color: var(--sub); }
.mac .bar { flex: 1; height: 11px; border-radius: 999px; background: var(--warm); overflow: hidden; }
.mac .bar i { display: block; height: 100%; border-radius: 999px; }
.mac .v { width: 78px; text-align: right; font-size: 11.5px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--ink); }
```

- [ ] Steps: update the page test FIRST (keep behavior: log sheet opens with prefill, water logging fires, replan/score flows; structural: `Mai pacing` h1, `.gauge` present, `.fuelchips` texts, three `.mac` bars, `következő`, water `+250` button) → FAIL → recompose + CSS → PASS → fix suite fallout (navigation tests asserting old `Pacing` title etc.) → full gate → commit (`feat(fe/fuel): Mai recomposed — kcal gauge, fuelchips, macro bars, water slot (mezo-8141)`) + content check.

---

### Task 5: Terv + Stack re-skin (sage)

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelPlanPage.tsx` + test, `FuelStackPage.tsx` + test
- Modify (accent swaps only, if brand-teal accented): `frontend/src/features/fuel/components/RetaWeekStrip.tsx`, `ProtocolSlot.tsx`, `SuggestionCard.tsx`, `ReasoningRow.tsx`

**Scope — in-vocabulary re-skin, content/behavior identical (S4 Task 6/7 precedent applies verbatim):**
- Headers → `.pghead-np sage`: Terv `.over` = `Fuel · Heti terv` / `h1` keeps the current dynamic title; Stack `.over` = `Fuel · Stack` / `h1` = `AI builder`. Header action chips → `.pgact-np np-press` (wash-sage/sage-deep), same handlers.
- `eyebrow brand`/`var(--brand-glow)`/`BRAND_TINT_*` inside the touched files → sage family (`var(--sage-deep)` text, `var(--sage)` accents, `var(--wash-sage)` flat washes; parameterized color-mix keeps color-mix with the token swapped — flat-vs-mix split per S4).
- Keep: all sheets, builder flows, ghost/skeleton states, behavior/aria assertions.
- End-check grep (report): zero `--brand-glow` in the touched files.

- [ ] Steps: test-first header/class updates → FAIL → re-skin → PASS → full gate → commit (`feat(fe/fuel): Terv + Stack re-skinned to sage Napiv (mezo-8141)` — stage touched files explicitly) + content check.

---

### Task 6: Receptek re-skin + recipe hero de-darkening (`--text-on-media` retired)

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelRecipesPage.tsx` + test, `RecipeDetailPage.tsx` + test, `RecipeEditorPage.tsx` (header-only)
- Modify: `frontend/src/features/fuel/components/RecipeCard.tsx` + `RecipeCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (remove the `--text-on-media`/`--text-on-media-dim` token definitions once zero consumers remain)

**Scope:**
- FuelRecipesPage header → `.pghead-np sage` (`.over` = `Fuel · Receptek`, `h1` = `Receptek`); RecipeEditorPage header-only pass.
- **Hero band de-darkening (spec §4.4 verbatim: "recipe hero bands stop being hardcoded-dark (token-driven, `--text-on-media` retired with them)"):** `RecipeCard.tsx:~44` and `RecipeDetailPage.tsx:~129-132` render title/meta over a media/gradient band with hardcoded near-white `var(--text-on-media)`. Replace the band treatment: token-driven Napív surface — a soft wash overlay (`linear-gradient(180deg, transparent, color-mix(in srgb, var(--ink) 55%, transparent))` stays acceptable ONLY if text keeps `--ink`-on-light in light theme; the simpler compliant route: move the title/meta OFF the image onto the card surface below it, `color: var(--ink)`/`var(--faint)`). Read both files first and pick the structure-preserving variant; the binding outcome: **no `--text-on-media` consumer remains, and the two token definitions are deleted from `prototype.css`** (grep proves zero references).
- Keep: recipe fit badges, serving toggle, ingredient lists, logs list, editor flows, all behavior tests.

- [ ] Steps: test-first (class/structural swaps in RecipeCard.test + page tests; keep behavior) → FAIL → re-skin + token retirement → grep `text-on-media` → zero → PASS → full gate → commit (`feat(fe/fuel): recipe heroes de-darkened, text-on-media tokens retired (mezo-8141)`) + content check.

---

### Task 7: Kamra + Gyógyszer re-skin

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelKamraPage.tsx` + test, `KamraItemDetailPage.tsx` (header-only), `FuelMedicationPage.tsx` + test
- Modify (accent swaps only if brand-teal accented): `frontend/src/features/fuel/components/KamraCard.tsx`, `MedicationCycleBar.tsx`

**Scope:**
- Headers → `.pghead-np sage`: Kamra `.over` = `Fuel · Kamra` / `h1` = `Polc`; Gyógyszer `.over` = `Fuel · Gyógyszer` / `h1` keeps the current title; KamraItemDetail header-only.
- Accent swaps per the S4/S5 split (flat wash vs color-mix); `RetaPhaseBar` on Gyógyszer stays (shared/ui untouched).
- Keep: kamra add/edit flows, medication cycle logic, behavior/aria assertions.
- End-check grep: zero `--brand-glow` in touched files.

- [ ] Steps: test-first → FAIL → re-skin → PASS → full gate → commit (`feat(fe/fuel): Kamra + Gyógyszer on sage Napiv page heads (mezo-8141)`) + content check.

---

### Task 8: Slice close — docs, gates, merge

**Files:**
- Modify: `docs/features/fuel.md` (§2 Mai composition: pghead → RetaPhaseBar → gauge card [gauge+fuelchips+macror] → aistrip → timeline slots → water slot → micronutrients; §5 integrations unchanged-but-verify; §9 gotchas: context-strip data relocation [gym/vb in timeline, coffee/kitchen in chips], MacroHero unmounted [orphan status per Task 4's grep], water logging moved to the timeline slot, `--text-on-media` retired, gauge arc capped at 100% while percent is honest; §10 file map: KcalGauge.tsx added)
- Modify: `docs/features/_platform-design-system.md` (S6 classes: `.pghead-np.sage`, `--wash-sage/-amber/-lav`, `.gauge`/`.big`, `.fuelchips`/`.chx`, `.macror`/`.mac`, `.slot`/`.fav`/`.mrow`/`.mm`/`.st`; `--text-on-media` tokens removed; staleness cleared)
- Check: `docs/features/today.md` + `train.md` staleness (prototype.css key_file)

- [ ] Steps: edit docs → `node scripts/lint-docs.mjs` PASS → full gate both modes → commit (`docs(features): fuel + design-system docs updated for Napiv S6 (mezo-8141)`) + content check → controller: `bd update mezo-8141 --notes "S6 Fuel landed: ..."` → push branch → **CI check** (`gh pr checks` on the fresh PR; if the billing block persists: local CI replication [FE both modes + lint-docs + lint-liquibase + contract-drift] + owner consent for the no-CI merge) → **merge via temporary worktree ONLY** (`git worktree add <scratch>/merge-main main` → `git pull --rebase` → `merge --no-ff` → push → `git worktree remove`) → resolve any `.beads/issues.jsonl` conflict via `bd import <theirs> && bd export` union.

---

## Out of scope (later plans)

S7 Me (avatar header, goal track, lavender pills) → S8 Insights re-skin + Pulse dark + cleanup basket (bd `mezo-mifi`: now also `.beat.done`/`.done-chip` hardcoded `#EAF0E3` → `--wash-sage` unification, MacroHero deletion if orphaned, legacy `.subnav` retirement once Me leaves it too) + `mezo-o7ds` (exact weight entry). The replan engine (P8) and any new Fuel data stay Phase-2/3 scope.
