# Fuel · Logolás 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Fuel hub's horizontal window swimlane with a live "Logolás" hero tile
→ a new routed `/fuel/log` page of stacked, state-washed window blocks whose "Logold"
expands an in-place MealComposer (extracted from LogFlowPage); face-lift the composer line
cards and the Kamra/Recept picker sheets.

**Architecture:** View-layer recompose (Mozaik 2.0). The data layer, `buildWindowLane` VM,
mutations and contracts are untouched. `LogFlowPage`'s editor body is extracted into a
reusable `MealComposer`; `LogFlowPage` stays as the thin overlay wrapper for the 4 other
entry points. Spec: `docs/superpowers/specs/2026-08-31-fuel-logolas-2.0-design.md`;
visual truth: `docs/design_2.0/prototypes/fuel-logolas.html`.

**Tech Stack:** React 18 + TS, react-router, vitest + @testing-library, CSS in
`frontend/src/styles/prototype.css` (fh-/logflow- sections), clay icons, Mozaik primitives
(`@/shared/ui/mozaik`).

## Global Constraints

- bd issue: **mezo-byo1**; conventional commits carry `(mezo-byo1)`.
- Honest states: no fabricated 0s; missed = „még pótolható" (never punitive); fresh log
  score = „✨ folyamatban"; empty-line save disabled.
- mezo-bnsf: a window-launched log saves with THAT window's `slotKey` — never wall-clock.
- Reduced-motion: every new animation guarded (CSS `@media (prefers-reduced-motion)`).
- Frontend tests must pass in BOTH modes (`VITE_USE_MOCK=true` and `=false`); `pnpm build`.
- Do not rename `buildWindowLane` exports (imported sight-unseen).

---

### Task 1: Extract MealComposer from LogFlowPage (behavior-neutral)

**Files:**
- Create: `frontend/src/features/fuel/components/MealComposer.tsx`
- Modify: `frontend/src/features/fuel/pages/LogFlowPage.tsx` (becomes a thin wrapper)
- Test: existing `frontend/src/features/fuel/pages/LogFlowPage*.test.tsx` (must stay green unchanged)

**Interfaces:**
- Produces:
  ```ts
  export interface MealComposerProps {
    /** Fixed slot (window launch, mezo-bnsf): the MIKOR segmented control is HIDDEN and
     *  every save uses this slot. */
    fixedSlot?: MealSlot
    /** Initial slot for the visible segmented control (wrapper/free-block launches). */
    initialSlot?: MealSlot
    prefill?: LogFlowPrefill
    aiPanelOpenOnMount?: boolean
    onSaved: () => void
    onCancel: () => void
  }
  export function MealComposer(props: MealComposerProps): JSX.Element
  ```
  `LogFlowPrefill` stays exported from LogFlowPage.tsx (re-exported type alias is fine;
  keep the import path `@/features/fuel/pages/LogFlowPage` working for FuelMaiPage/others).

- [ ] **Step 1: Move the editor body.** Cut everything in `LogFlowPage.tsx` from the state
  block through the `.logflow-body` JSX (slot seg, NÉV input, source tiles, AI panel, line
  cards, totals, CTA row, both pick sheets) into `MealComposer.tsx`. `slotLocked` becomes:
  `fixedSlot != null || initialSlot != null` seeds the lock ref; when `fixedSlot` is set,
  do not render the MIKOR segment row at all and always save `slot = fixedSlot`.
  `save()` calls `onSaved()` instead of `onClose()`; Mégse → `onCancel()`.
- [ ] **Step 2: Rewrite LogFlowPage as wrapper.** Keeps: portal to `.phone-screen`,
  `.logflow-page` shell, header (`‹ Vissza` + `nowLabel()`), `Mit ettél?` title, Escape
  handler; body renders `<MealComposer initialSlot={initialSlot} prefill={prefill}
  aiPanelOpenOnMount={aiPanelOpenOnMount} onSaved={onClose} onCancel={onClose} />`.
  Public `LogFlowPageProps` unchanged.
- [ ] **Step 3: Run the existing suite** —
  `pnpm --dir frontend test -- LogFlowPage` (mock mode). Expected: all green with NO test edits.
- [ ] **Step 4: Commit** — `refactor(fuel): extract MealComposer from LogFlowPage (mezo-byo1)`

### Task 2: Composer facelift — NÉV mező ki, kind-wash tétel-kártyák

**Files:**
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx`
- Modify: `frontend/src/styles/prototype.css` (logflow- section, ~line 6215)
- Test: `frontend/src/features/fuel/pages/LogFlowPage.test.tsx` (NÉV cases → derived-name cases)

**Interfaces:**
- Consumes: Task 1's MealComposer.
- Produces: same props; saved `title` is now always `deriveMealName(...) || null`
  (no `nameOverride` state).

- [ ] **Step 1: Remove the NÉV input** + `nameOverride` state; `title: derivedName.trim() || null`.
- [ ] **Step 2: Line-card face** (prototype `lncard`): keep `.logflow-lncard` root +
  `data-tag`, add per-tag wash via CSS (below); replace the `MacroCells` row with:
  kcal cell right of the stepper (`.logflow-lnkcal`) + a 3-cell macro mini row
  (`.logflow-lnmac`: feh./szénh./zsír, coral/gold/lav tints) computed from
  `meta.contribution`; keep `NutrientCells` under it; keep overrides block.
- [ ] **Step 3: Totals card**: add the derived name as `.logflow-totname` line under
  „EZ AZ ÉTKEZÉS"; swap the plain `MacroCells` for the same colorful 4-cell row
  (kcal sage / feh. coral / szénh. gold / zsír lav) using `MCells` from
  `@/shared/ui/mozaik` (`cells=[{label:'kcal',tone:'sage'},…]`).
- [ ] **Step 4: CSS** — in prototype.css next to the existing `.logflow-lncard` rules:
  ```css
  .logflow-lncard { position: relative; overflow: hidden; border-left: none; border-radius: 15px; }
  .logflow-lncard::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--ln-spine); }
  .logflow-lncard[data-tag="kamra"]   { --ln-spine: var(--gold, #C9962E);  background: linear-gradient(135deg, var(--mz-tone-gold) 0%, var(--surface-1) 62%); }
  .logflow-lncard[data-tag="recept"]  { --ln-spine: var(--coral);          background: linear-gradient(135deg, var(--mz-tone-coral, #FFE3D8) 0%, var(--surface-1) 62%); }
  .logflow-lncard[data-tag="becslés"] { --ln-spine: var(--lav-deep);       background: linear-gradient(135deg, var(--mz-tone-lav, #EBE6F8) 0%, var(--surface-1) 62%); }
  .logflow-lnkcal { margin-left: auto; border-radius: 10px; padding: 4px 10px 3px; text-align: center; background: var(--surface-0, #fff); box-shadow: var(--shadow-cell, 0 2px 5px rgba(43,33,24,0.06)); color: var(--ln-spine); }
  .logflow-lnkcal b { display: block; font-size: 12px; font-variant-numeric: tabular-nums; }
  .logflow-lnkcal small { font-size: 6.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.75; }
  .logflow-lnmac { display: flex; gap: 5px; margin-top: 7px; }
  .logflow-lnmac span { flex: 1; border-radius: 9px; padding: 3px 2px 2px; text-align: center; }
  ```
  (exact tokens: reuse the vars the fh-/mz- sections already define; check
  `--mz-tone-gold` etc. exist — they are used by `.logflow-srct.tone-*` today).
- [ ] **Step 5: Update NÉV tests.** In LogFlowPage tests, cases asserting the name input
  (`Étkezés neve`) become: derived name shows in the totals card; saved input's `title`
  equals the derived join. Run `pnpm --dir frontend test -- LogFlowPage`.
- [ ] **Step 6: Commit** — `feat(fuel): composer facelift — derived name, kind-wash line cards (mezo-byo1)`

### Task 3: WindowBlock + FuelLogPage + `/fuel/log` route

**Files:**
- Create: `frontend/src/features/fuel/components/WindowBlock.tsx`
- Create: `frontend/src/features/fuel/pages/FuelLogPage.tsx`
- Modify: `frontend/src/app/router.tsx` (`{ path: 'fuel/log', element: <FuelLogPage /> }` before `fuel/kamra`)
- Modify: `frontend/src/styles/prototype.css` (new §Fuel log blocks)
- Test: `frontend/src/features/fuel/pages/FuelLogPage.test.tsx` (new; absorbs FuelMaiPage.logMeal cases)

**Interfaces:**
- Consumes: `buildWindowLane` (`WindowLaneVM`, `WindowTileVM`), `MealComposer` (Task 1/2),
  `useFuelDay`, `useFuelTimeline`, `MealScoreSheet`, `MozaikPage/PageHead/PageHero/PageBody`.
- Produces:
  ```ts
  export interface WindowBlockProps {
    tile: WindowTileVM
    open: boolean            // composer expanded in place
    onOpen: (ai: boolean) => void
    onScore: (mealId: string) => void
    children?: ReactNode     // the expanded composer, rendered inside .flog-composer
  }
  export function WindowBlock(props: WindowBlockProps): JSX.Element
  export function FuelLogPage(): JSX.Element
  ```

- [ ] **Step 1: WindowBlock (presentational).** Root `div.flog-blk.is-{state}` (+`is-open`),
  content per spec §2: top row (time + label eyebrow + stamp), main row (clay icon tile,
  name + meta/score-chip, right column kcal cell + 3 `MiniRing`s — port `MiniRing`+
  `ScoreChip` from WindowLane.tsx verbatim, incl. `useCountUp`), CTA row (hidden when
  open): primary `Logold`/`Pótold` + ghost `✨ AI` (done state renders no CTA row).
  Composer well: `div.flog-composer > div.flog-cin > {children}` (grid-rows expand).
- [ ] **Step 2: FuelLogPage.** Data: `useFuelDay` + `useFuelTimeline`; VM =
  `buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })`.
  State: `openKey: string | 'free' | null`, `aiOnMount: boolean`, `scoreMeal`.
  Layout: `MozaikPage tone="coral"` → `PageHead onBack={() => navigate('/fuel')}
  label="‹ Fuel"` → `PageHero name="Logolás" big={huInt(fuel.consumed.kcal)}
  sub={`/ ${huInt(fuel.targets.kcal)} kcal · ${doneCount}/${tiles.length} ablak kész`}` →
  `PageBody` with `EntranceGroup`: one `WindowBlock` per tile (`children` = open ?
  `<MealComposer fixedSlot={tile.slotKey} prefill={prefillFor(tile)}
  aiPanelOpenOnMount={aiOnMount} onSaved={close} onCancel={close} />` : null;
  `prefillFor` = `tile`'s slot `suggestedRecipeId` → `{source:'recipe',recipeId}` — find
  the slot by `key` exactly as FuelMaiPage.logFromTile does today, but skip prefill when
  AI-launched). Trailing free block (dashed, `＋ Logolás`/`✨ AI` → MealComposer with
  visible slot seg via `initialSlot={defaultMealSlot()}`); empty day (`tiles.length===0`):
  leading block „Üres nap / Nincs mai terv / ＋ tervezz" → `navigate('/fuel/plan')`.
  Score chip → `MealScoreSheet` (same wiring as FuelMaiPage today).
- [ ] **Step 3: CSS §Fuel log blocks** (values = prototype ×1.18, alongside the fh- section):
  ```css
  /* ==== Fuel · /fuel/log window blocks (mezo-byo1; prototype fuel-logolas.html) ==== */
  .flog-blk { border-radius: 22px; margin-bottom: 12px; overflow: hidden; background: var(--surface-0, #fff); border: 0.5px solid var(--border-subtle); box-shadow: var(--mz-shadow); }
  .flog-blk.is-done { background: linear-gradient(150deg, #EFF3EA, #FBFDF9); }
  .flog-blk.is-now { border: 1px solid var(--coral); box-shadow: var(--mz-shadow-coral); }
  .flog-blk.is-missed { border: 1.2px dashed color-mix(in srgb, var(--gold, #C9962E) 55%, transparent); box-shadow: none; }
  .flog-blk.is-free { border: 1.2px dashed var(--border-strong, rgba(43,33,24,0.2)); box-shadow: none; }
  .flog-in { padding: 12px 14px 13px; }
  .flog-top { display: flex; align-items: center; gap: 7px; }
  .flog-top time { font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  .flog-lbl { font-size: 8.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-tertiary); }
  .flog-top .fh-wstamp { margin-left: auto; }
  .flog-main { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
  .flog-icon { width: 50px; height: 50px; border-radius: 16px; flex: none; display: grid; place-items: center; background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--border-subtle); }
  .flog-name { font-size: 13.5px; font-weight: 700; line-height: 1.3; }
  .flog-name.is-ghost { color: var(--text-tertiary); font-weight: 600; }
  .flog-meta { font-size: 9.5px; color: var(--text-secondary); margin-top: 2px; }
  .flog-data { flex: none; display: grid; gap: 6px; justify-items: center; margin-left: auto; }
  .flog-kcal { border-radius: 12px; padding: 4px 12px 3px; text-align: center; background: var(--surface-0, #fff); box-shadow: inset 0 0 0 1px var(--border-subtle); }
  .flog-kcal b { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .flog-kcal small { font-size: 7px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-tertiary); margin-left: 3px; }
  .flog-rings { display: flex; gap: 7px; }
  .flog-blk.is-missed .flog-data { opacity: 0.7; }
  .flog-ctas { display: flex; gap: 8px; margin-top: 10px; }
  .flog-ctas .cta-primary { flex: 1; padding: 8px 0; }
  .flog-ctas .cta-ghost { flex: 0.6; padding: 8px 0; }
  .flog-blk.is-open .flog-ctas { display: none; }
  .flog-composer { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.38s cubic-bezier(0.25, 0.8, 0.35, 1); }
  .flog-cin { overflow: hidden; min-height: 0; }
  .flog-blk.is-open .flog-composer { grid-template-rows: 1fr; }
  .flog-cbody { border-top: 0.5px solid var(--border-subtle); margin: 10px 14px 0; padding: 10px 0 13px; }
  @media (prefers-reduced-motion: reduce) { .flog-composer { transition: none; } }
  ```
  Reuse `.fh-wstamp/.fh-st-*`, `.fh-wring`, `.fh-scorech` classes (they survive in CSS even
  after WindowLane.tsx dies — they belong to the shared fh- section).
- [ ] **Step 4: Tests** (`FuelLogPage.test.tsx`, same hoisted-useFuelTimeline harness as
  FuelMaiPage.logMeal.test.tsx — copy the `vi.mock` block + `baseCtx` verbatim, render
  `<FuelLogPage />` in `MemoryRouter`):
  - recipe-suggestion window: click `Logold` → composer expands IN PLACE (no `Mit ettél?`
    page title), the recipe pre-filled (`recept` tag visible), NO MIKOR segment rendered.
  - `Pótold` shows on a missed window; „még pótolható" meta present.
  - done window renders `KÉSZ ✓` + score chip; no Logold CTA.
  - free block: `＋ Logolás` → composer with MIKOR segment visible.
  - empty day (`slots: []`): „＋ tervezz" navigates to /fuel/plan (assert via router).
  - save in a window composer calls logMeal with the window's slotKey: add a pantry line
    via the Kamra sheet (mock pantry), click `✓ Logolás`, then assert the block flipped
    to `KÉSZ ✓` (state re-derives from the mock day; in the crafted-plan harness assert
    the composer closed instead).
- [ ] **Step 5: Run** `pnpm --dir frontend test -- FuelLogPage` (mock), fix, then commit —
  `feat(fuel): /fuel/log page — stacked window blocks with in-place composer (mezo-byo1)`

### Task 4: FuelLogHeroTile + hub swap (WindowLane törlés)

**Files:**
- Create: `frontend/src/features/fuel/components/FuelLogHeroTile.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Delete: `frontend/src/features/fuel/components/WindowLane.tsx`
- Modify: `frontend/src/styles/prototype.css` (add .fh-logtile styles; keep fh-wring/scorech, drop .fh-lane/.fh-wtile lane-only rules)
- Test: modify `FuelMaiPage.test.tsx`; delete `FuelMaiPage.logMeal.test.tsx` (absorbed by Task 3)

**Interfaces:**
- Consumes: `WindowLaneVM` (`buildWindowLane`), `ClayIcon`.
- Produces:
  ```ts
  export function FuelLogHeroTile({ vm, onOpen }: { vm: WindowLaneVM; onOpen: () => void }): JSX.Element
  ```

- [ ] **Step 1: FuelLogHeroTile.** Derivations from `vm.tiles`: `now = tiles.find(state==='now')`,
  `missed = tiles.filter('missed')`, `next = tiles.find('future')`, `done = tiles.filter('done').length`,
  `allDone = done === tiles.length && tiles.length > 0`. Content per spec §1 (eyebrow
  „LOGOLÁS · MOST" + pulsing dot / „LOGOLÁS"; big = `${now.label} · ${now.time}` |
  `Minden ablak kész ✓` | `köv. ${next.label} · ${next.time}` | `Logolás` (empty day:
  sub „nincs mai terv — tervezz és logolj"); sub = `a tervből: ${name}` only when
  `fromPlan || !ghost`); dot strip (one `<i>` per tile, class by state); status line
  `${done}/${n} ablak kész · ${m} pótolható`. Root: `button.fh-logtile[.is-alldone].rise`,
  `aria-label="Logolás"`, chevron `›`.
- [ ] **Step 2: Hub swap.** In FuelMaiPage: replace the `<WindowLane …>` block with
  `<FuelLogHeroTile vm={lane} onOpen={() => navigate('/fuel/log')} />`; DELETE the
  log-overlay state (`logOpen/logAiOnMount/logPrefill/logInitialSlot`, `openLog`,
  `logFromTile`, `aiFromTile`, the `<LogFlowPage …>` mount and its imports) — the
  score/water/energy/settings sheets stay. `openScoreForMeal` stays only if the hero
  still needs it (it does not — remove).
- [ ] **Step 3: Delete WindowLane.tsx** and its lane-specific CSS (`.fh-lanewrap`,
  `.fh-lane`, `.fh-wtile*`, `.fh-wtop`, `.fh-wlbl`, `.fh-wname`, `.fh-wmeta`, `.fh-wkcal`,
  `.fh-wcta`) — keep `.fh-wstamp/.fh-st-*`, `.fh-wring`, `.fh-scorech` (used by Task 3).
  Add `.fh-logtile` CSS (coral wash tile, `.is-alldone` sage variant, `.fh-lt-dots` strip,
  pulse keyframe guarded by reduced-motion) mirroring the prototype `logtile` block ×1.18.
- [ ] **Step 4: Tests.** `FuelMaiPage.test.tsx`: replace lane assertions with hero-tile
  ones (crafted plans via the same hoisted harness): MOST window → `Ebéd · 13:00` +
  „a tervből:" line; all-done plan → `Minden ablak kész ✓`; missed → `1 pótolható`;
  click → navigated to `/fuel/log` (MemoryRouter + Routes probe). Delete
  `FuelMaiPage.logMeal.test.tsx`.
- [ ] **Step 5: Run** `pnpm --dir frontend test -- FuelMaiPage` + grep for dangling
  `WindowLane` imports (`rg WindowLane frontend/src`). Commit —
  `feat(fuel): hub Logolás hero tile replaces the window swimlane (mezo-byo1)`

### Task 5: KamraPickSheet — kategória-chipek + kind-wash sorok

**Files:**
- Modify: `frontend/src/features/fuel/sheets/KamraPickSheet.tsx`
- Modify: `frontend/src/styles/prototype.css` (picker chip/row styles)
- Test: `frontend/src/features/fuel/sheets/KamraPickSheet.test.tsx`

**Interfaces:** props unchanged (`onPick`, `onClose`, `addedRefIds`).

- [ ] **Step 1:** Add `const [cat, setCat] = useState<string | null>(null)`; chip row under
  the search: „Mind" + one chip per category present in `ingredients`
  (`[...new Set(ingredients.map(i => i.category))]`), labeled/colored from
  `categoryMeta[cat]` (fallback: raw key + `var(--text-secondary)`); filter =
  query AND (cat == null || i.category === cat). Chips: `button.flog-fchip[.on]` with
  `style={{ '--cc': color }}`, color dot span; row scrolls horizontally.
- [ ] **Step 2:** Row face: keep the card + `borderLeft` spine but add the category wash
  (`background: linear-gradient(135deg, color-mix(in srgb, ${catColor} 14%, transparent), var(--surface-1) 62%)`)
  via inline style; add NOVA dot (reuse `NovaDot` component from
  `features/fuel/components/NovaDot.tsx`) next to the `NOVA n` text; move kcal into a
  right-aligned cell (`<b>{kcal}</b><small>kcal</small>` in `.flog-kcell`), keep
  `MacroCells` under.
- [ ] **Step 3: Tests:** clicking a category chip hides other-category items and shows its
  own; „Mind" restores; search + chip compose; added ✓ still disables. Run
  `pnpm --dir frontend test -- KamraPickSheet`.
- [ ] **Step 4: Commit** — `feat(fuel): Kamra picker category chips + kind-wash rows (mezo-byo1)`

### Task 6: ReceptPickSheet — ★ szűrő + korall wash

**Files:**
- Modify: `frontend/src/features/fuel/sheets/ReceptPickSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/ReceptPickSheet.test.tsx` (create if missing)

- [ ] **Step 1:** `const [onlyStar, setOnlyStar] = useState(false)`; „★ csillagos" chip
  (`aria-pressed`) under the search; filter composes with query. Row face: coral wash
  gradient + spine (like Task 5 with `var(--coral)`), name + `★` when `r.starred`,
  sub `{slot} · {n} hozzávaló · /adag`, kcal cell, `＋`.
- [ ] **Step 2: Tests:** star filter hides unstarred; toggling off restores; pick still
  closes the sheet (existing behavior). Run `pnpm --dir frontend test -- ReceptPickSheet`.
- [ ] **Step 3: Commit** — `feat(fuel): Recept picker star filter + coral wash rows (mezo-byo1)`

### Task 7: Gates, docs, ship

- [ ] **Step 1: Both-mode gate:**
  `cd frontend && VITE_USE_MOCK=true pnpm test -- --run && VITE_USE_MOCK=false pnpm test -- --run && pnpm build`
  (lint if configured: `pnpm lint`).
- [ ] **Step 2: Docs:** update `docs/features/fuel.md` (§hub anatomy: swimlane → hero tile
  + /fuel/log; §log flow: MealComposer split, derived-only name; picker facelifts) and
  `docs/CODEMAP.md` if it lists fuel components. Prototype README table: add
  `fuel-logolas.html` row.
- [ ] **Step 3: bd + push:** `bd close mezo-byo1` with summary; `git push -u origin
  claude/fuel-login-ui-redesign-ae0da2`; open self-PR (`gh pr create`), wait CI green;
  `git checkout main && git pull --rebase && git merge --no-ff <branch> && bd dolt push && git push`.
  (NEVER work from the primary checkout — merge from this worktree's clone of main is not
  possible; do the merge by pushing the branch and completing the flow per AGENTS.md from
  the worktree: fetch origin/main, create a temp main worktree if needed — see step notes
  at execution time. Deploy = push to main triggers CI/CD per repo setup.)

## Self-review

- Spec coverage: §1→Task 4, §2→Task 3, §3→Tasks 1-2, §4→Tasks 5-6, tests/gates→each task+7. ✔
- No placeholders; type names consistent (`MealComposerProps.fixedSlot`, `WindowBlockProps`). ✔
- Risk note: LogFlowPage tests may reference the NÉV input in more files than
  LogFlowPage.test.tsx (prefill/ai/timestamp variants) — Task 2 Step 5 covers "all NÉV
  assertions", search `rg "Étkezés neve" frontend/src` during execution.
