# Napív Redesign — S8 Insights + Pulse Dark + Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Napív redesign: re-skin Insights (the last legacy domain) onto the lavender Napív vocabulary, finalize the dark theme as the warm-graphite "Pulse" palette (a token swap, not a redesign), land the spec §3.5 motion polish + reduced-motion gaps, drain the mezo-mifi cleanup basket, and stand up the self-baselined Playwright visual-regression harness that replaced the retired parity suite.

**Architecture:** Three central levers first, everything else rides on them. (1) **Token re-point** — the legacy Deep-Current tokens (`--brand-*`, `--cat-*`, `--info`, `--tool-*`, `--reta-*`) become `var()` aliases onto the Napív accent family in `:root`, and the legacy dark block's canvas/surface/ink values are rewritten to Pulse warm graphite; because aliases resolve against the cascaded Napív tokens, the dark blocks shrink instead of growing (spec §3.1: "dark is a palette swap, not a redesign"). (2) **Literal sweep** — hardcoded teal rgba/hex literals that bypass tokens get replaced by tokens so the swap actually reaches them. (3) **Central primitive re-skin** — `.eyebrow`/`.label-mono`/`.chip`/`.cta-*`/`.h-display`/`.page-title` CSS moves to the Jakarta/pill idiom once, restyling ~200 legacy call sites without JSX churn (spec §3.2 "ALL-CAPS retired", R1 "Display/Eyebrow/PageTitle/LabelMono re-skin"). Then Insights re-skins in-vocabulary (lavender, per spec §3.1 accent table), the basket drains per-domain, and the visual baselines are captured LAST, after every visual change has settled.

**Tech Stack:** React 19, plain CSS in `frontend/src/styles/prototype.css`, Vitest + RTL, `@playwright/test` ^1.60 (already in devDependencies, browsers cached). Driving spec: `docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md` §3.1 (accents + Pulse), §3.2, §3.5, §7/S8, §8. Basket: bd **mezo-mifi** (claim at start, close at end). Ledger: `.superpowers/sdd/progress.md`.

## Global Constraints

- Worktree `/Users/daniel.kuhne/MrKuhne/mezo/.worktrees/frontend-design-rethink`, branch `feat/frontend-design-rethink`, bd **mezo-8141** (+ mezo-mifi for basket tasks). Verify `git rev-parse --show-toplevel` before every commit; NEVER touch the main checkout; NEVER `git stash`.
- Commit with hooks disabled: `git -c core.hooksPath=/dev/null commit -m "... (mezo-8141)"`. Stage explicit paths only. After EVERY commit `git show --stat HEAD` — strip a stray `issues.jsonl` via soft-reset re-commit.
- Gate after EVERY task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both genuine modes — `.env` with `VITE_USE_MOCK=false` exists in this worktree since S7) + `node scripts/lint-docs.mjs` when docs/key_files touched.
- Conventions: no `*Screen`/`*View`; hooks only from `@/data/hooks`; no barrels; deep `@/*` imports; colocated tests; `shared/ui` stays domain-free.
- **Accent discipline (binding):** Insights chrome/nav/eyebrows/selected states → `--lav`/`--lav-deep`/`--wash-lav` (spec §3.1: lav = "Sleep/Me/Insights accent"). Success/done → sage family. Teal glows (textShadow/drop-shadow/boxShadow on `--brand-glow`) → **removed, not recolored** (S7 precedent). `--border-brand` usages → `var(--line)`. Flat tints → wash tokens; parameterized `color-mix(...)` keeps color-mix with the token swapped (S4 precedent).
- **Legacy tokens are re-pointed, not deleted** (T1): JSX that says `var(--brand-glow)` or `var(--cat-tendency)` keeps working and renders Napív colors. Migrating such JSX onto semantic Napív tokens is REQUIRED only where a task's file list names it; elsewhere it is a follow-up (bd issue, T12).
- **jsdom hazard:** `.np-anim` nodes — presence-only assertions, never `toBeVisible()`. Animated fills stay behind `prefers-reduced-motion: no-preference`.
- **Gutter rule:** new full-width blocks carry their own 24px horizontal gutter.
- Hungarian copy, sentence case. **Binding Insights copy** (pill label / section h1): Minták/Minták · Heti/Heti riport · Memoár/Memoár · Tudástár/Tudástár · Chat/Chat · Előrejelzések/Előrejelzések · Kísérletek/Kísérletek. Over-line: `Insights`. (English→Hungarian rename = S7 Sleep→Alvás precedent; present to human at close.)
- **No functionality lost (spec §5):** every Insights view/action (pattern confirm/monitor/reject, AI-reasoning expander, weekly tervjavaslat, memoir reactions + archive, knowledge fact edit/accept, chat composer, prediction list, experiment accept/dismiss/propose) survives restyled. Exception decided here: the InsightsSection **decorative** settings chip (`InsightsSection.tsx:21-23`, comment says "no handler") is **dropped, not restyled** (S6 PacingCard decorative-chrome precedent) — present to human at close.
- **Proposed Pulse/alias hex values in T1/T7 are starting values** — the controller tunes them in live visual QA before the task closes; the reviewer checks structure + coverage, not hue taste.
- CI: full gate via self-PR (repo public, CI green since S6). Merge only via detached temp worktree (`git worktree add --detach <tmp> origin/main` + `push HEAD:main`).
- Baselines (T11) are captured **after all visual tasks** — any later visual change must re-run `pnpm test:visual:update` and re-commit shots in the same commit.

---

### Task 1: Token re-point + Pulse dark palette

**Files:**
- Modify: `frontend/src/styles/prototype.css` (`:root` L3–75; dark blocks L78–126, L1151–1160, L1343–1347)
- Modify: `frontend/src/shared/lib/theme.ts` (THEME_COLOR.dark) + `frontend/src/shared/lib/theme.test.ts:30`
- Test: existing `frontend/src/styles/tokens.test.tsx` is self-injecting (own `<style>`) — no change needed; add nothing.

**Interfaces:**
- Produces: legacy tokens resolve to Napív colors in BOTH themes; Pulse graphite canvas/surface/ink in dark. Every later task may rely on `var(--brand-*)`/`var(--cat-*)`/`var(--info)` rendering warm.

- [ ] **Step 1: Alias the legacy light tokens** (replace values in `:root` L3–75; keep property names):

```css
  /* Legacy Deep-Current tokens — re-pointed onto the Napív palette (S8, spec §3.1:
     "domain-accent mapping replaces --cat-* 1:1, brand-teal→coral as default accent").
     Kept as aliases so un-migrated call sites render in-family; new code uses Napív tokens. */
  --brand-deep: var(--coral-deep);
  --brand-core: var(--coral-deep);
  --brand-primary: var(--coral);
  --brand-glow: var(--coral);
  --brand-tint: var(--wash-gym);

  --border-brand: var(--line);

  --success: var(--sage-deep);
  --warning: var(--amber-deep);
  --error: #D9534F;              /* stays a true red; Napív has no error hue */
  --info: var(--sky);

  --cat-physiology: var(--sky);
  --cat-preference: var(--lav-deep);
  --cat-trigger:    var(--amber-deep);
  --cat-response:   var(--sage-deep);
  --cat-tendency:   var(--rose);
  --cat-goal-state: var(--coral-deep);

  --tool-read:    var(--lav);
  --tool-compute: var(--amber-deep);
  --tool-write:   var(--coral);

  --reta-d1: #7FA48A; --reta-d2: #8FAC7E; --reta-d3: #A3B272; --reta-d4: #BCB466;
  --reta-d5: #D6B25B; --reta-d6: #EBB250; --reta-d7: #FFB347;   /* sage→amber ramp */
```

Canvas/surface/ink/border light values (L12–27) stay — they already match Napív light. Check `grep -n "anchor-" frontend/src -r`: if `--anchor-*` has zero non-CSS consumers, delete the four tokens from both blocks (S2 remapped AnchorMode), else leave.

- [ ] **Step 2: Rewrite dark Block A** (L78–126) to Pulse and DELETE every line that is now an alias (aliases resolve against dark Napív tokens automatically — that is the palette-swap structure):

```css
:root[data-theme="dark"] {
  /* Pulse — warm graphite (spec §3.1 dark: direction B) */
  --canvas: #191614;
  --surface-1: #221E1B;
  --surface-2: #2A2521;
  --surface-3: #332D27;
  --surface-glass: rgba(245, 239, 230, 0.05);

  --border-subtle: rgba(245, 239, 230, 0.07);
  --border-strong: rgba(245, 239, 230, 0.14);

  --text-primary: #F5EFE6;
  --text-secondary: #B7A899;
  --text-tertiary: #8A7A6A;
  --text-quaternary: #5E5348;
  --text-inverse: #191614;

  --error: #F08A85;
  /* --brand-*, --cat-*, --info, --success, --warning, --tool-*, --border-brand, --reta-*:
     aliased in :root — they follow the dark Napív accents below. */
}
```

Keep the page/card shadow overrides if present; re-tint any `rgba(0,0,0,…)`→`rgba(0,0,0,…)` stays fine on graphite.

- [ ] **Step 3: Finalize dark Block B accents** (L1151–1160) — replace the "Accents unchanged" placeholder with glowing Pulse accents + add the missing `--tag-*` overrides to the S4 dark fragment (L1343–1347):

```css
  /* Pulse accents — same family, lifted for the graphite canvas */
  --coral: #FF7E5C; --coral-deep: #F0966B;
  --amber: #FFBE60; /* --amber-deep dark already exists (S7, #E3B565) */
  --sage: #8FB49A; --sage-deep: #A9C79A;
  --lav: #AB9FD2; --lav-deep: #B9ACD9;
  --rose: #E98D9D; --sky: #7FB2DE;
```

```css
:root[data-theme="dark"] { --tag-gym: #F0966B; --tag-sport: #E9A3AE; --tag-run: #9CC0E4; }
```

- [ ] **Step 4:** `theme.ts` `THEME_COLOR.dark: '#0A0F14'` → `'#191614'`; update `theme.test.ts:30` expectation first (RED→GREEN). `vite.config.ts` manifest stays light-only (static — document in T12).
- [ ] **Step 5:** Full gate both modes. Visual QA (controller): light unchanged everywhere; dark = warm graphite on all five tabs; legacy surfaces (Train sheets, Fuel chips) render coral/rose/sky instead of teal in both themes.
- [ ] **Step 6: Commit** `feat(fe): re-point legacy tokens onto Napiv palette + Pulse dark graphite (mezo-8141)`.

### Task 2: Hardcoded-literal sweep (teal + wash unification)

**Files:**
- Modify: `frontend/src/styles/prototype.css` — component-class literals: L176 (`.phone` shadow), L284 (`.tab-item.active svg` drop-shadow), L433 (`.chip.brand` bg), L457 (`.toolchip.write` bg), L622 (`.checkin-slot.done` — dies in T9 anyway; skip), L654–659 (`.set-dot.active` + `pulse-soft`), L674 (`.sk::after` shimmer), L724 (`.rir-cell.active`), L567 (`.toast` shadow), L1285–1290 (`.typetag-*` → wash/tag tokens, basket #2), L1313/1389/1468 (`#EAF0E3` → `var(--wash-sage)`, basket #16), L1518 (`.slot.next` glow rgba → `color-mix(in srgb, var(--sage) 20%, transparent)`, basket #11), L1270/1274 (reggel hexes → `var(--amber-deep)` / `var(--amber)`-family tokens, basket #8), L1296+L1474 (`.np-cta`/`.donebtn` gradient: introduce `--cta-g1:#FF7A55; --cta-g2:#FF5B36;` + dark `--cta-g1:#FF8A66; --cta-g2:#FF6B47;` and use them + `color-mix` shadow).
- Modify (JSX teal literals → tokens): `fuel/pages/FuelKamraPage.tsx:212,237`, `fuel/sheets/CategoryFilterSheet.tsx:66`, `fuel/components/RecipeFitBadge.tsx:25` (basket #12, sage-family borders); `insights` teal literals are handled in T5/T6; `today/sheets/ActivityLogSheet.tsx:67,115`, `today/sheets/CheckInSheet.tsx:320`, `train/sheets/SportLogSheet.tsx:219`, `train/sheets/ExerciseRecordSheet.tsx:79`, `train/pages/SportPage.tsx:338,403`, `train/pages/TrainTodayPage.tsx:372`, plus `rgba(20,184,166,…)` sites (`LogMealSheet.tsx:205`, `MealPickerSheet.tsx:47,69`, `IngredientPickerSheet.tsx:67`, `RecipeEditorPage.tsx:309`, `FuelRecipesPage.tsx:81`) — each onto its domain accent (train→coral/rose/sky by context, fuel→sage, today→amber/coral) using wash tokens for flat tints and `color-mix` for alphas.
- Modify: `frontend/src/data/fuel/pantry.ts:20,26,27` (`#5EEAD4` category colors → `var(--sage)` / sage-family tokens).

**Interfaces:** Produces zero `#5EEAD4`/`#2DD4BF`/`rgba(94,234,212`/`rgba(20,184,166` literals under `frontend/src` **except** `features/insights/**` (T5/T6) and `me/components/LinkedMesoCard.tsx` (deleted in T10). The reviewer verifies with that exact grep.

- [ ] Steps: per-file token swap (no structural edits) → both-modes gate → visual spot-check dark+light on Kamra filters, RecipeFitBadge, CheckIn, Sport pages → commit `fix(fe): retire hardcoded teal/wash literals onto Napiv tokens (mezo-8141, mezo-mifi)`.

### Task 3: Central primitive re-skin (Jakarta idiom)

**Files:**
- Modify: `frontend/src/styles/prototype.css`: `.eyebrow` (L363–370), `.label-mono` (L371–377), `.h-display` (L378–389), `.page-title` (L391–399), `.chip`/`.chip.brand` (L~425–434), `.cta-primary`/`.cta-ghost` (L~400s), `.toolchip` accents (L455–457)
- Modify: `frontend/src/shared/ui/Toggle.tsx:24` (thumb `--brand-core` → `var(--sage)`), `frontend/src/shared/ui/ScoreRing.tsx:1` (default color → `'var(--sage)'`)
- Tests: run the full suite — class NAMES survive, so most render-tests pass; fix any style-pinning assertions the suite surfaces.

**Interfaces:** Produces the Napív typography idiom on every legacy call site: `.eyebrow`/`.label-mono` = Jakarta 10–11px/800/letter-spaced (`--ff-mono` retired from these classes; `.toolchip` keeps mono deliberately — debug surface, spec §3.6); `.h-display`/`.page-title` = Bricolage, **`text-transform: uppercase` dropped** (spec §3.2), tracking −0.3…−0.5px; `.chip` = pill (radius 999px, Jakarta 11px/700, border `var(--line)`, bg `var(--surface-1)`), `.chip.brand` = coral selected state (`background: var(--wash-gym); border-color: var(--coral); color: var(--coral-deep)`); `.cta-primary` = coral gradient pill (`--cta-g1/--cta-g2` from T2); `.cta-ghost` = warm neutral pill.

```css
.eyebrow { font: 800 10px/1 var(--ff-body); letter-spacing: .08em; text-transform: uppercase; color: var(--faint); }
.eyebrow.brand { color: var(--coral-deep); }
.label-mono { font: 700 11px/1.2 var(--ff-body); letter-spacing: .06em; text-transform: uppercase; color: var(--faint); font-variant-numeric: tabular-nums; }
```

- [ ] Steps: CSS rewrite (keep selectors + layout-affecting props conservative: sizes stay within 1px of current so page rhythm holds) → Toggle/ScoreRing swaps → both-modes gate → **heavy visual QA** (controller): Fuel sheets (Display titles now sentence-case), Train sheets, FeedbackModal chips, ActiveWorkoutPage PageTitle, toolchips on ChatMessage → commit `feat(fe): central primitive re-skin — Jakarta eyebrows/labels, pill chips+CTAs, sentence-case display (mezo-8141)`.

### Task 4: Insights shell — lavender pills + pghead

**Files:**
- Modify: `frontend/src/features/insights/pages/tabs.ts` (Hungarian labels + `title` field), `InsightsSection.tsx`, `InsightsSubNav.tsx`, `InsightsSubNav.test.tsx`, `insights.nav.test.tsx`
- Delete: `frontend/src/features/insights/components/PhaseTeaserCard.tsx` (verified orphan)
- Modify: `frontend/src/styles/prototype.css` — DELETE `.subnav` block (L773–798) + dead `.train-subnav` selector (L233); fix `.np-pill.on` contrast (basket #7): `.np-pill.on { color:#fff; background: var(--pill-accent-strong, var(--pill-accent, var(--coral))); }` and set `--pill-accent-strong` per sub-nav.

**Interfaces:**
- Produces: `InsightsTab` gains `title: string` (h1 text; label = pill text). `InsightsSubNav` on `.np-pills` with `--pill-accent: var(--lav)`, `--pill-accent-strong: var(--lav-deep)`, `aria-label="Insights alnavigáció"`. `InsightsSection` renders `.pghead-np.lav` (over `Insights`, h1 = `active.title`), decorative settings chip dropped, `<InsightsSubNav/>`, `<Outlet/>` wrapper padding unchanged. `FuelSubNav.tsx`/`MeSubNav.tsx`/`TrainSubNav` gain `--pill-accent-strong: var(--sage-deep)`/`var(--lav-deep)`/`var(--coral-deep)` (contrast fix is global).

```tsx
export const INSIGHTS_TABS: InsightsTab[] = [
  { id: 'patterns', to: '/insights', label: 'Minták', title: 'Minták', end: true },
  { id: 'weekly', to: '/insights/weekly', label: 'Heti', title: 'Heti riport' },
  { id: 'memoir', to: '/insights/memoir', label: 'Memoár', title: 'Memoár' },
  { id: 'knowledge', to: '/insights/knowledge', label: 'Tudástár', title: 'Tudástár' },
  { id: 'chat', to: '/insights/chat', label: 'Chat', title: 'Chat' },
  { id: 'predictions', to: '/insights/predictions', label: 'Előrejelzések', title: 'Előrejelzések' },
  { id: 'experiments', to: '/insights/experiments', label: 'Kísérletek', title: 'Kísérletek' },
]
```

- [ ] Steps: tests FIRST (nav tests → Hungarian labels + `.np-pill.on` idiom, mirror `FuelSubNav.test.tsx`; section test → over/h1) → tabs.ts → SubNav (MeSubNav shape, lav) → Section (pghead-np.lav; grep the S7 Me pages for the exact pghead markup) → delete PhaseTeaserCard + `.subnav` CSS + `.train-subnav` → grep `subnav` under `frontend/src` = zero hits → gate → commit `feat(fe/insights): lavender Napiv shell — pghead + pill sub-nav, subnav retired (mezo-8141, mezo-mifi)`.

### Task 5: Insights re-skin A — Minták + Heti

**Files:**
- Modify: `frontend/src/features/insights/pages/PatternsPage.tsx` (+`.test.tsx`), `WeeklyPage.tsx` (+`.test.tsx`), `components/PatternCard.tsx` (+`.test.tsx`), `components/GrowthWeekCard.tsx` (+`.test.tsx`)

**Interfaces:** Consumes T1 re-pointed `--cat-*` (PatternCard's `patternCategoryColor` stays as-is — the data-layer mapping now emits Napív hues; document in T12). Produces: zero `notch-*` class tokens, zero teal literals, zero `--brand-*` refs in these files.

- [ ] Steps per file (S7 Me-page recipe): `card notch-N` → `card` (drop the notch token); `eyebrow brand` → `eyebrow` + `style={{color:'var(--lav-deep)'}}`; `--brand-glow`/`--brand-primary` refs → `var(--lav-deep)` (text/borders) or **removed** (glows); PatternsPage L41 teal `rgba(94,234,212,0.03)` tint → `var(--wash-lav)`; CTAs keep `.cta-ghost` (now pill via T3); confirm/monitor/reject + expander + tervjavaslat flows untouched (tests keep passing; add an assertion where a class swap voids one) → gate → visual QA (patterns list + weekly, both themes) → commit `feat(fe/insights): Mintak + Heti re-skin in Napiv vocabulary (mezo-8141)`.

### Task 6: Insights re-skin B — Memoár · Tudástár · Chat · Előrejelzések · Kísérletek

**Files:**
- Modify: `MemoirPage.tsx` (+test — **fix the `/brand/` chip-class pin** L26–31 to the T3 `.chip.brand` coral semantics or an aria-pressed assertion), `KnowledgeListPage.tsx` (+test), `ChatPage.tsx`, `components/ChatMessage.tsx`, `PredictionsPage.tsx`, `ExperimentsPage.tsx` (+tests)

**Interfaces:** Produces: zero teal literals (`MemoirPage.tsx:38,75`, `PatternsPage` done in T5), zero `--brand-*`/`--border-brand` refs in `features/insights/**`; **bugfix ride-along:** `KnowledgeListPage.tsx:43,84` use undefined `var(--brand)` (renders no color today) → `var(--lav-deep)`, disclose in the report. ToolChip rows on ChatMessage survive (spec §3.6: debug surface).

- [ ] Steps: same recipe as T5 per file; memoir reaction chips = `.chip`+`.brand` selected (coral) — adjudicated: reactions are a selected-state, not Insights chrome, so coral-selected is correct; knowledge fact category dots via `factCategoryColor` stay (re-pointed) → gate → visual QA all five pages both themes → commit `feat(fe/insights): Memoar/Tudastar/Chat/Elorejelzesek/Kiserletek re-skin (mezo-8141)`.

### Task 7: Pulse daypart night variants + motion polish

**Files:**
- Modify: `frontend/src/styles/prototype.css`: dark daypart block (L1228–1232), `.tab-fab` (L1180–1186) + new `@keyframes np-fabglow`, reduced-motion guards for `.set-dot.active` (L654–659) and `.graph-node-pulse` (L766), new `.np-twinkle` class
- Modify: `frontend/src/features/fuel/components/RecipeFitBadge.tsx` + `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` (inline `mezo-twinkle` animation style → `className="np-twinkle"`), `frontend/src/features/fuel/sheets/ImportItemSheet.tsx:148` (inline `animation:'pulse …'` references a keyframe that doesn't exist → `np-twinkle` or remove)

**Interfaces:** Produces spec §3.5 completeness: FAB soft 3.2s glow pulse; night sky variants; **every** infinite animation behind `prefers-reduced-motion`.

```css
@keyframes np-fabglow { 0%,100% { box-shadow: 0 6px 18px color-mix(in srgb, var(--cta-g2) 35%, transparent); }
  50% { box-shadow: 0 8px 28px color-mix(in srgb, var(--cta-g2) 55%, transparent); } }
@media (prefers-reduced-motion: no-preference) { .tab-fab { animation: np-fabglow 3.2s ease-in-out infinite; } }

/* Pulse night skies — canvas stays graphite; only the sky band glows faintly */
:root[data-theme="dark"] .sky { opacity: .5; }
:root[data-theme="dark"] .phone-screen[data-day="reggel"] .sky { background: radial-gradient(60% 40% at 18% 0%, rgba(255,179,71,.10), transparent 70%); }
:root[data-theme="dark"] .phone-screen[data-day="delutan"] .sky { background: radial-gradient(60% 40% at 50% 0%, rgba(245,239,230,.06), transparent 70%); }
:root[data-theme="dark"] .phone-screen[data-day="este"] .sky { background: radial-gradient(60% 40% at 82% 0%, rgba(155,143,196,.12), transparent 70%); }
```

- [ ] Steps: CSS (replace the S1 blanket `.sky{opacity:.18}` with the variants; keep the canvas-neutralize rule; update the L1228 comment — the "until the Pulse S8 pass" note is now satisfied) → FAB pulse → guards + `.np-twinkle { animation: mezo-twinkle 2.6s ease-in-out infinite; } @media (prefers-reduced-motion: reduce) { .np-twinkle { animation: none; } }` → JSX swaps → gate → visual QA: dark reggel/délután/este via devtools clock, FAB pulse, reduced-motion emulation kills everything → commit `feat(fe): Pulse night skies + FAB glow pulse + reduced-motion gap fixes (mezo-8141, mezo-mifi)`.

### Task 8: Cleanup basket — Train

**Files:**
- Modify: `train/sheets/SportLogSheet.tsx:159,184-186` + `SportScheduleSheet.tsx:78,96,116,118,152,162` (`--cat-tendency` → rose family: `var(--rose)` accents, `var(--wash-sport)` tints, `var(--tag-sport)` text), `train/sheets/RunLogSheet.tsx:29,37-38` (`--info` → `var(--sky)`/`--wash-run`/`--tag-run`), `train/components/ChallengeCard.tsx:15-16` (Depth→rose, Volume→sky) — basket #1
- Modify: `train/pages/ExercisesPage.tsx:139` (`chip notch-4 brand` → `pgact-np np-press`, keep `+ Új gyakorlat` copy) — basket #3
- Modify: `train/components/WeeklyDayRow.tsx:116` (chevron only when `hasContent`) + `prototype.css:1386` (`.dayrow.today { cursor: pointer; }` on the clickable row) — basket #4 (+ test: rest row renders no `.chev`)
- Modify: dead `label-mono brand` combo — drop the inert `brand` token: `train/components/GymDayCard.tsx:56`, `train/components/WeekRhythmGrid.tsx:44` (fuel-side siblings in T9) — basket #5
- Modify: `train/logic/weeklyLoad.ts:38` — `steady` stops collapsing to `piramis`: map run kinds `sprint→'sprint' | 'pyramid'→'piramis' | 'steady'→'tempó'` (+ tile test case) — basket #8
- Visual spot-fixes (controller adjudicates live): `RunningBlockBuilderPage.tsx:122-126` header alignment, `MesocycleBuilderPage.tsx:78-82` goal-text rhythm — basket #6

**Interfaces:** Produces `--cat-tendency`/`--info` zero-hit under `features/train/**` (reviewer grep).

- [ ] Steps: tests-first where behavior changes (WeeklyDayRow chevron, weeklyLoad steady) → mechanical swaps → gate → visual QA (Sport rose sheets, Futás sky sheet, Mai weekly rows) → commit `fix(fe/train): S8 basket — rose/sky token migration, pgact header action, dayrow affordances, steady load label (mezo-mifi)`.

### Task 9: Cleanup basket — Fuel + Today

**Files:**
- Modify: `fuel/components/KcalGauge.tsx:15,22` (`useId()` for `gauge-grad`) — #9; `fuel/pages/FuelMaiPage.tsx:82,85` (non-interactive `.chx` spans → `cursor:'default'` inline or a `.chx.static` modifier) — #10; `fuel/components/PacingCard.tsx:5` (drop dead `eyebrow` prop + call-site) — #13; `fuel/components/SlotCard.tsx:61-62` (`FAV_WASH[slot.kind] ?? FAV_WASH.meal`, same for emoji — KIND_META symmetry) — #15; `fuel/{components,sheets,pages}` `label-mono brand` inert combos (`ReplanSheet.tsx:182`, `RecommendationCard.tsx:42`, `MealMatchRow.tsx:33`, `FuelStackPage.tsx:188,285`, `FuelPlanPage.tsx:113`) — #5
- Delete: `fuel/components/MacroHero.tsx` + `MacroHero.test.tsx` (verified orphan; closes **mezo-azmu**'s sibling — check `MacroRow` too: `shared/ui/MacroRow.tsx` has ZERO consumers → delete with its test, closes **mezo-azmu**) — #14
- Delete: `.checkin-strip`/`.checkin-slot` CSS (`prototype.css:609-632`, zero consumers) — #8
- Delete: `useInsightsTeaser` + `InsightsTeaserItem` (`data/today/todayHooks.ts:169,177`, `data/types.ts:158`, `data/hooks.ts:4` re-export) + `QuickStatItem.delta` (`data/types.ts:156`) — #8 (grep-verify zero consumers first)
- Modify: `today/components/WorkoutTeaser.tsx:25` — `🏋️ Gym · hipertrófia` → derive the phase word from the session data (MEV/MAV/MRV/Deload live in `data/train/train.ts:536`; if the teaser type lacks phase, use the session type only: `🏋️ Gym`) — #8
- Test: `today/components/GreetingHeader.test.tsx` — add `user.name` interpolation assertion — #8; `today/components/BriefingCard.test.tsx` — add the `összecsuk` round-trip (click bővebben → click összecsuk → collapsed assertion) — #8

**Interfaces:** Produces: `data/hooks.ts` barrel drops one export (breaking only for dead code); reviewer greps `useInsightsTeaser|InsightsTeaserItem|MacroHero|MacroRow` = zero.

- [ ] Steps: deletions first (grep-verify), tests-first for the two test additions → gate BOTH modes (barrel change!) → commit `fix(fe): S8 basket — fuel/today cleanups, dead code drop (mezo-mifi, mezo-azmu)`.

### Task 10: Cleanup basket — Me

**Files:**
- Create: `frontend/src/shared/ui/sectionLabel.ts` — `export const SECTION_LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }` (copy the exact current object from `EditGoalSheet.tsx:11`)
- Modify (hoist onto it, delete local consts): `me/sheets/EditGoalSheet.tsx:11`, `me/sheets/PersonLogSheet.tsx:15`, `me/sheets/SleepLogSheet.tsx:8`, `me/sheets/AttachPlanSheet.tsx:8`, `me/sheets/WeightLogSheet.tsx:7`, `me/components/WeightHero.tsx:6` (CAPTION), `me/sheets/SettingsSheet.tsx:13`, `me/sheets/BiometricSheet.tsx:9` (8 files; `TimePicker.tsx:13` 9px variant stays local with a comment) — #19
- Delete: `me/components/LinkedMesoCard.tsx` (+ stale comment ref `GoalsPage.tsx:18`) — #18
- Modify: `me/components/MentionRow.tsx:67-81` + `people/PersonDetailSheet.tsx:72` — unify on the flat-tint idiom: badge keeps tint, NO border (matches MentionRow), and PersonDetailSheet drops its absolute left accent bar (siblings dropped theirs in S7 T7) — #20, #21
- Modify: `me/components/GoalMiniCard.tsx` — `total===0` branch renders a `tartás` caption instead of `0% · X kg hátra` (+ RED→GREEN MSW regression test) — #22
- Modify: `me/pages/GoalPlannerPage.tsx:368,458,514,532` — delete the local `hu1`, import `{ hu1 } from '@/shared/lib/huNum'`; update test anchors expecting `"2,0"`-style strings — #23
- Modify: `me/components/GrowthSummaryCard.tsx:76` — clamp: reuse `SkillBandCard`'s pattern (`Math.min(100, Math.max(0, s.progressPct))`) — #24
- Modify: `me/pages/GoalsPage.tsx:201` — `remaining.toFixed(1)` → `hu1(remaining)` (+ test anchor update) — #25

**Interfaces:** Produces `SECTION_LABEL` from `@/shared/ui/sectionLabel` (style-only const, domain-free) — future sheets import it.

- [ ] Steps: tests-first (GoalMiniCard tartás, hu1 anchors) → hoist + deletions + fixes → gate → visual QA (Profil goal card maintain state via mock edit, People sheets) → commit `fix(fe/me): S8 basket — SECTION_LABEL hoist, maintain-goal tartas caption, hu-num unification, dead code (mezo-mifi)`.

### Task 11: Visual baseline harness (Playwright self-baselines)

**Files:**
- Create: `frontend/tests/visual/playwright.config.ts`, `frontend/tests/visual/visual.spec.ts`
- Modify: `frontend/package.json` (scripts `test:visual`, `test:visual:update`), `frontend/vite.config.ts:40` (`exclude: [...configDefaults.exclude, 'tests/**']` — also resolves the redundant-spread nit), `frontend/tsconfig.node.json` (include the playwright config), root `.gitignore` (drop stale parity lines L19-20/51-54; add `frontend/tests/visual/test-results/`; baselines in `visual.spec.ts-snapshots/` are COMMITTED)

**Interfaces:** Produces `pnpm test:visual` (compare) / `pnpm test:visual:update` (re-baseline) against mock mode on port 4318. **Local-only** (darwin baselines); CI job deferred → bd issue in T12.

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixels: 120 } },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    baseURL: 'http://localhost:4318',
  },
  webServer: {
    command: 'VITE_USE_MOCK=true pnpm dev --port 4318',
    url: 'http://localhost:4318',
    reuseExistingServer: true,
    cwd: '../..',
  },
})
```

```ts
// visual.spec.ts — one spec, two theme loops
import { test, expect } from '@playwright/test'
const SCREENS: Array<[string, string]> = [
  ['today', '/today'], ['train', '/train'], ['train-gym', '/train/gym'],
  ['fuel', '/fuel'], ['fuel-terv', '/fuel/plan'],
  ['me', '/me'], ['me-cel', '/me/goals'],
  ['insights-mintak', '/insights'], ['insights-heti', '/insights/weekly'],
  ['insights-memoar', '/insights/memoir'], ['insights-tudastar', '/insights/knowledge'],
  ['insights-chat', '/insights/chat'], ['insights-elorejelzesek', '/insights/predictions'],
  ['insights-kiserletek', '/insights/experiments'],
]
for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme === 'dark' ? 'dark' : 'light' })
    for (const [name, path] of SCREENS) {
      test(name, async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-05-21T13:42:00')) // délután; freezes sky tint + greeting
        await page.addInitScript((t) => localStorage.setItem('mezo-theme', t), theme)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveScreenshot(`${name}-${theme}.png`)
      })
    }
  })
}
```

- [ ] Steps: config + spec → `pnpm test:visual:update` (generates 28 darwin PNGs) → `pnpm test:visual` green twice in a row (determinism check — if a shot flakes, mask/fix the source and note it) → vitest suite still green both modes (exclude works) → commit baselines + harness `test(fe): self-baselined Playwright visual harness, 14 screens x 2 themes (mezo-8141)`. **Rule from here: any visual change re-runs `test:visual:update` in the same commit.**

### Task 12: Docs final pass + bd close-out

**Files:**
- Modify: `docs/features/_platform-design-system.md` — final Napív rewrite pass (acceptance #6): Pulse dark palette section (token architecture: aliases + Block A/B), primitive re-skin (§ eyebrow/label-mono/chip/cta), np-pill contrast fix, visual-baseline harness replaces the §8 "returns in S8" note, fix drifted `prototype.css:303–335` citations (now ~317+), supersede the `.subnav` mentions
- Modify: `docs/features/insights.md` — re-skin: shell (pghead-np.lav + np-pills + Hungarian labels), category colors now Napív via re-pointed `--cat-*` (`prototype.css` new line refs), settings-chip drop, PhaseTeaserCard deletion, key_files check
- Modify: parity-mention purge (harness is gone; the NEW harness is different): `docs/features/_platform-data-layer.md:29`, `docs/decisions/0003-frontend-structure-conventions.md:38` (append a dated addendum line — ADRs are immutable in spirit; do not rewrite the decision, just note the S8 replacement), src comments `GoalPlannerPage.tsx:40`, `GoalPlannerPage.test.tsx:287`, `SportScheduleSheet.tsx:7`, `SportPage.tsx:63`, `experimentsHooks.ts:15` (+ grep `parity` for stragglers; leave mock-seed "byte-parity" mentions — different concept)
- Modify: `docs/features/today.md` (~L195 bold-as-header → real heading; useInsightsTeaser removal), `docs/features/train.md`/`fuel.md`/`me.md` — basket behavior changes (steady label, chevron, tartás caption, hu1, MacroHero/MacroRow/LinkedMesoCard deletions), `docs/milestones/roadmap.md` (S8 done = Napív redesign complete)
- Modify: `frontend/src/styles/prototype.css` stale comments: L4 ("until S3–S7"), L1233 ("lands with Today in S3"), L294–297 recipe-save-bar rationale (keep the mezo-ci5 WHY, drop the stale opacity sentence)
- bd: close **mezo-mifi** (basket drained; note the deferred items), close **mezo-azmu**; file NEW issues: (1) CI visual-baseline job (linux snapshot generation channel), (2) legacy JSX sweep — inert `notch-*` tokens (~130 lines) + inline `var(--brand-*)` refs (~230 lines) migrate onto Napív tokens mechanically, (3) `--ff-mono`/`LabelMono` primitive retirement decision. Check **mezo-74iz**/**mezo-4wd** against lint output — close if the S8 doc pass cleared them.

- [ ] Steps: doc edits → `node scripts/lint-docs.mjs` PASS (staleness flags cleared) → bd ops → commit `docs: S8 final pass — design-system Pulse/harness sections, insights re-skin, parity purge (mezo-8141, mezo-mifi)`.

---

## Execution order & review protocol

T1 → T2 → T3 (global levers, heavy visual QA) → T4 → T5 → T6 (Insights) → T7 → T8/T9/T10 (basket; independent, sequential dispatch) → T11 (baselines LAST) → T12 (docs+close). Per-task: fresh implementer subagent (brief in `.superpowers/sdd/task-N-brief.md`) + independent reviewer gate (diff review vs brief), controller visual QA on every visually-affecting task, ledger update in `.superpowers/sdd/progress.md`. Final whole-branch review (fable) before merge; both-modes + lint-docs gates; PR → CI green → detached-worktree `--no-ff` merge.

**Present to human at close:** (1) Insights English→Hungarian tab renames, (2) decorative settings-chip drop, (3) `.h-display` sentence-case flip across legacy sheets, (4) Pulse hex values as tuned, (5) `--error` staying red (non-Napív hue), (6) predictions label "Előrejelzések" (longest pill).
