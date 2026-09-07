# Lifegoal polish + research-wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the six deferred minors from the `mezo-iizd.9/.4/.12` final review (`mezo-9r85`) and ingest the life-goal specs' §2 prior art into the research wiki (`mezo-iizd.13`) — one branch, one PR.

**Architecture:** Two independent halves on one branch. **Part A** (`mezo-9r85`, frontend) is a dead-code sweep plus three honesty/coverage fixes plus two documentation-of-intent fixes; it touches `frontend/src` and moves exactly one pair of visual goldens. **Part B** (`mezo-iizd.13`, docs) is pure markdown under `docs/research/` — zero code, gated by `node scripts/lint-docs.mjs` rather than by the test suites. They share a branch only because Part A's golden regeneration + the linux-baseline bot round-trip is the expensive serialized step and is worth paying once.

**Tech Stack:** React 19 + Vite + Tailwind v4 · Vitest + RTL + MSW · Playwright (visual goldens) · the repo's `docs/research/` wiki (SCHEMA.md + `scripts/lint-docs.mjs`).

## Global Constraints

- **Worktree:** `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220`. NEVER `cd` to the primary repo. The Bash cwd PERSISTS between calls → use an absolute path in every command.
- **Branch:** `feat/lifegoal-polish-doksi`, cut from `origin/main` at `d6594431f`.
- **Commit subjects:** Part A tasks carry `(mezo-9r85)`; Part B tasks carry `(mezo-iizd.13)`. Conventional-commit subject line.
- **Frontend tests run TWICE, in SEPARATE commands, with the mode stated explicitly and `--` before vitest's own flags.** An unset `VITE_USE_MOCK` silently means mock, so a bare `pnpm test` is a vacuous real-mode gate:
  ```bash
  cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 <files>
  cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 <files>
  ```
- **There is no `pnpm lint` script.** The type / dead-code gate is `pnpm build` — the tsconfig runs with `noUnusedLocals` + `noUnusedParameters`, which is what catches imports orphaned by a deletion.
- **Shared machine, several agent sessions.** Vitest `--maxWorkers=2`, Playwright `--workers=2`. If failures do not match the surface you changed, suspect machine load FIRST (measured: above load 20 Playwright's 30 s timeout fails en masse).
- **Design 2.0:** clay SVG icons, NEVER emoji; the existing `mozaik` / `lg-*` language. Honest states: loading / empty / error are THREE separate states; a fabricated number is forbidden.
- **`frontend/src/features/me/lifegoalCssTokens.test.ts` is a source-level CSS guard** pinning four invariants over the `lg-*` block (every `--lg-*` token declared in BOTH `:root` blocks · zero raw hex in the block · no bare `.play` selector anywhere · the hidden entrance state only under `.mz-play`). If a CSS edit trips it, FIX THE CSS — never loosen the guard.
- **Non-interactive shell flags always** (`rm -f`, `cp -f`, `mv -f`) — the interactive aliases hang the agent.

## File Structure

**Part A — frontend (`mezo-9r85`)**

| File | Responsibility after this change |
|---|---|
| `frontend/src/styles/prototype.css` | `.enh-gtrack`/`.enh-gtlbl`/`@keyframes enh-gfill` block (`:6271–6281`, `:6299`) DELETED; the `.goalmini` + shared `.track`/`.track-l` block (`:2862–2873`) DELETED; the `.lg-goalchip` rule (`:9377–9380`) gains the payload rule as a comment |
| `frontend/src/features/me/components/GoalMiniCard.tsx` + `.test.tsx` | DELETED — orphaned, last consumer of `.goalmini`/`.track` |
| `frontend/src/features/me/pages/CelokPage.test.tsx` | gains the missing "nincs aktív súlycél" real-mode branch test |
| `frontend/src/features/me/pages/GrowthSkillsPage.tsx` | gains the recorded decision on the goalchip pop-in (item 3) |
| `frontend/src/features/me/components/WeekGoalsCard.tsx`, `SkillBandCard.tsx`, `pages/EnHubPage.tsx` | each gains the one-line `.lg-goalchip` payload rule pointer (item 4) |
| `frontend/src/data/lifegoal/lifegoalMock.ts` | `mockProgress` returns a real conflict sentence for `lg-kockahas` |
| `frontend/src/features/me/pages/CelPage.test.tsx` | the "no conflict ⇒ no section remnant" test re-points to a conflict-FREE goal |
| `frontend/tests/visual/__screenshots__/…me-cel-reszlet-*-darwin.png` | regenerated (light + dark) |
| `docs/features/me.md`, `docs/features/lifegoal.md`, `docs/features/_platform-design-system.md` | corrected for the deletions + the recorded chip rule |

**Part B — research wiki (`mezo-iizd.13`)**

| File | Responsibility |
|---|---|
| `docs/research/raw/articles/2026-09-06-lifegoal-prior-art-research.md` | immutable capture — the system-design spec §2 sources |
| `docs/research/raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md` | immutable capture — the motor-design spec §2 sources |
| `docs/research/entities/exist-io.md` | the one product cited by BOTH specs, carrying two adopted lessons + one deferred layer |
| `docs/research/concepts/goal-type-taxonomies.md` | Strides' four kinds → our four; the rejected single "life score" |
| `docs/research/concepts/perma-and-wellbeing-taxonomies.md` | PERMA-Profiler adopted (D2); Gallup WB5 + Ryff rejected as a VISIBLE taxonomy |
| `docs/research/concepts/goal-conflict.md` | Gorges & Grund 2017 → companion warning, not a hard gate (D7) |
| `docs/research/concepts/goal-pursuit-evidence.md` | Harkin 2016 (D1) + Gollwitzer & Sheeran 2006 (D8) + SDT goal contents (D8) |
| `docs/research/concepts/trend-arrows-and-baselines.md` | Apple Trends + Exist baseline + Oura pillar normalization + WHOOP attribution (deferred) |
| `docs/research/concepts/idempotent-daily-recompute.md` | uhabits + Habitica cron + Exist resync window + partition-overwrite backfill |
| `docs/research/index.md`, `log.md`, `SCHEMA.md` | catalog rows, one log line, the `goals` tag added to the taxonomy |
| `docs/features/lifegoal.md`, `docs/features/goal-engine.md` | `related:` cross-links INTO the new research pages |

**Page-count rationale (SCHEMA §2):** a page is created when a subject is central OR appears in 2+ sources; below that bar it stays a *mention inside an existing page*, never a stub. Strides, Apple Trends, WHOOP, Oura, uhabits and Habitica are each a single source supporting a single lesson — that lesson IS the concept page, so they get rich mentions rather than entity stubs. Exist.io is the sole subject cited in BOTH spec §2s, carrying two distinct adopted lessons plus one explicitly deferred layer, which is exactly an entity page's job. Net: **1 entity + 6 concepts**, not ten source-shaped pages.

---

## PART A — `mezo-9r85` (frontend polish)

### Task A1: Delete the dead `.enh-gtrack` / `.enh-gtlbl` CSS

The Én-hub hero switched to a life-goal summary in `mezo-iizd.4`; the old weight-goal track's CSS survived with no consumer. `EnHubPage.test.tsx:152` already asserts `.enh-gtrack` is absent from the DOM — that assertion stays valid and is the regression guard for this deletion.

**Files:**
- Modify: `frontend/src/styles/prototype.css:6271-6281` and `:6299`
- Test: `frontend/src/features/me/pages/EnHubPage.test.tsx` (existing, unchanged)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Later tasks must not reintroduce `.enh-gtrack`/`.enh-gtlbl`/`enh-gfill`.

- [ ] **Step 1: Prove the classes have no consumer**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && grep -rn "enh-gtrack\|enh-gtlbl\|enh-gfill" frontend/src
```

Expected: hits ONLY in `frontend/src/styles/prototype.css` plus the single negative assertion at `frontend/src/features/me/pages/EnHubPage.test.tsx:152`. If any `.tsx` renders one of these classes, STOP and report — the premise is wrong.

- [ ] **Step 2: Check the neighbours you are NOT deleting**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && for c in enh-goalcard enh-goalhead enh-stch enh-newgoal; do echo "== $c"; grep -rn "$c" frontend/src --include='*.tsx'; done
```

`.enh-goalcard` / `.enh-goalhead` / `.enh-stch` / `.enh-newgoal` are the CURRENT hero's chrome and MUST survive. Only remove a class this step shows to have zero `.tsx` consumers.

- [ ] **Step 3: Delete the rules**

Remove exactly these from `frontend/src/styles/prototype.css`:
- `.enh-gtrack { … }` (`:6271`)
- `.enh-gtrack .fill { … }` (`:6272-6273`)
- `.mz-play .enh-gtrack .fill { … }` (`:6274`)
- `@keyframes enh-gfill { … }` (`:6275`)
- `.enh-gtrack .dot { … }` (`:6276-6278`)
- `.enh-gtlbl { … }` (`:6279-6280`)
- `.enh-gtlbl b { … }` (`:6281`)
- the `.mz-play .enh-gtrack .fill { animation: none; }` line inside the `@media (prefers-reduced-motion: reduce)` block (`:6299`) — keep the surrounding media block and its `.enh-goalcard { transition: none; }` line.

- [ ] **Step 4: Check whether the deletion orphaned any CSS token**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && for t in --mz-gbar-bg --mz-goalfill --mz-goaldot; do echo "== $t used:"; grep -c "var($t" frontend/src/styles/prototype.css; done
```

If a token's `var(...)` count is now 0, delete its `:root` AND its `:root[data-theme="dark"]` declaration TOGETHER (a token declared in only one of the two is exactly what the `mozaikCssTokens` guard family exists to catch). If the count is >0, leave the token alone.

- [ ] **Step 5: Run the guard + the hub tests, both modes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/me/lifegoalCssTokens.test.ts src/features/me/pages/EnHubPage.test.tsx
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me/lifegoalCssTokens.test.ts src/features/me/pages/EnHubPage.test.tsx
```

Expected: PASS in both.

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add frontend/src/styles/prototype.css && git commit -m "chore(fe/me): drop the consumer-less .enh-gtrack/.enh-gtlbl hero track CSS (mezo-9r85)"
```

---

### Task A2: Delete the orphaned `GoalMiniCard` and its now-dead `.goalmini`/`.track` CSS

`docs/features/me.md:690` claims `GoalsPage` still imports `GoalMiniCard` "for the shared mini-track idiom". **It does not** — that importer is gone, so `GoalMiniCard.tsx` is imported only by its own test, and it is the LAST consumer of the shared `.track`/`.track-l` vocabulary. The doc is corrected here too.

**Files:**
- Delete: `frontend/src/features/me/components/GoalMiniCard.tsx`, `frontend/src/features/me/components/GoalMiniCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css:2862-2873`
- Modify: `docs/features/me.md` (§9 orphan list, §10 file map), `docs/features/_platform-design-system.md:177`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. `TRAJECTORY_LABEL` (`features/me/logic/goalLabels.ts`) and `hu1` (`shared/lib/huNum.ts`) both keep OTHER consumers and MUST survive.

- [ ] **Step 1: Prove the orphanhood, and prove `.track` has no other consumer**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && echo "== GoalMiniCard importers:" && grep -rn "GoalMiniCard" frontend/src && echo "== className track/goalmini:" && grep -rn "goalmini\|\"track\|'track\|track-l" frontend/src --include='*.tsx'
```

Expected: the only `GoalMiniCard` hits are the component itself and `GoalMiniCard.test.tsx`; the only `.goalmini`/`.track`/`.track-l` markup hits are inside `GoalMiniCard.tsx`. If ANY other page renders `className="track"`, STOP — do not delete the CSS, delete only the component and report.

- [ ] **Step 2: Prove `TRAJECTORY_LABEL` and `hu1` survive the deletion**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && grep -rln "TRAJECTORY_LABEL" frontend/src && echo "---" && grep -rlc "hu1" frontend/src | head -20
```

Expected: `TRAJECTORY_LABEL` still has consumers besides `GoalMiniCard.tsx` (at minimum `features/me/pages/CelokPage.tsx`). If it does NOT, then `goalLabels.ts` also becomes dead and must be handled — report before deleting it.

- [ ] **Step 3: Delete the component and its test**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && rm -f frontend/src/features/me/components/GoalMiniCard.tsx frontend/src/features/me/components/GoalMiniCard.test.tsx
```

- [ ] **Step 4: Delete the now-dead CSS block**

From `frontend/src/styles/prototype.css` remove `:2862-2873` in full — the `/* ===== Napív goal mini-track (Profil, spec §4.6) — .track reused by the Cél hero ===== */` comment, `.goalmini`, `.goalmini .row1`, `.goalmini .t`, `.goalmini .pct`, `.track`, `.track .fill`, `.track .dot`, `.track-l`, and the `@media (prefers-reduced-motion: no-preference) { .track .fill { … } }` block that follows them.

Do NOT touch `.dot-gym`/`.dot-sport`/`.dot-cross`/`.dot-trx`/`.dot-run` (`:2423-2427`) or `.dot-sage`/`.dot-amber`/`.dot-coral` (`:3801-3803`) — different, live families that merely share the `dot` prefix.

- [ ] **Step 5: The `pnpm build` gate is the dead-import detector**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && pnpm build
```

Expected: PASS. `noUnusedLocals`/`noUnusedParameters` is what surfaces an import left dangling by the deletion. If it fails, fix the dangling import — do not relax the tsconfig.

- [ ] **Step 6: Full me-feature test sweep, both modes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/me
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me
```

Expected: PASS in both, with the `GoalMiniCard` test file simply gone from the run.

- [ ] **Step 7: Correct the docs that described this component as live**

In `docs/features/me.md`:
- §9 (`:690`) — the sentence "Only `GoalMiniCard` still has a live importer (`GoalsPage`, for the shared mini-track idiom); the other four are imported by their own tests" is now WRONG in both halves. Rewrite so it reads that **four** components remain orphaned (`MeBioRow`, `BiometricCard`, `AiUsageCard`, and — if still present — the rest of that list), and that `GoalMiniCard` was **deleted** in `mezo-9r85` together with the `.goalmini` + shared `.track`/`.track-l` CSS, because its last importer had already gone.
- §10 (`:725`, `:728`) — remove `GoalMiniCard` from the component file list and from the `goalLabels.ts` / `huNum.ts` consumer sentences; state that `goalLabels.ts`'s `TRAJECTORY_LABEL` is now read by the Súlycél row on `CelokPage` (and any other consumer Step 2 found).
- Bump the frontmatter `updated:` to `2026-09-06`.

In `docs/features/_platform-design-system.md:177` — the `.goalmini` + shared `.track`/`.fill`/`.dot`/`.track-l` entry describes a vocabulary that no longer exists. Replace it with a one-line note that the family was deleted in `mezo-9r85` when its last consumer (`GoalMiniCard`) went, and bump that doc's `updated:` to `2026-09-06`.

- [ ] **Step 8: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add -A frontend/src docs/features && git commit -m "chore(fe/me): delete the orphaned GoalMiniCard and its .goalmini/.track CSS (mezo-9r85)"
```

---

### Task A3: Cover the Súlycél row's untested "nincs aktív súlycél" branch

`CelokPage`'s Súlycél row has FOUR states (`frontend/src/features/me/pages/CelokPage.tsx:146-151`): `töltöm…` / `a súlycél most nem elérhető` / the measured `{trajectory} · {current} → {target} kg` / `nincs aktív súlycél`. Mock mode's `useGoal` returns a POPULATED goal and a hardcoded `isError: false` (`frontend/src/data/me/goalHooks.ts:106-122`), so only the "present" and (real-mode) "error" branches are exercised today. The empty branch needs a real-mode test with an EMPTY goal list — not a failing one.

**Files:**
- Modify: `frontend/src/features/me/pages/CelokPage.test.tsx` — add one test inside the existing `describe('real mode')` block, next to the `elhasalt /api/goals` test at `:119`

**Interfaces:**
- Consumes: the file's existing `renderHub()` helper, `server`, `http`, `HttpResponse`, `API_BASE` — all already imported.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add inside `describe('real mode', …)` in `frontend/src/features/me/pages/CelokPage.test.tsx`, immediately after the `elhasalt /api/goals` test:

```tsx
  /**
   * mezo-9r85, 2. tétel: a sor NEGYEDIK állapota — üres cél-lista. Mock módban a `useGoal`
   * populált célt és hardcode-olt `isError: false`-t ad (goalHooks.ts), tehát ez az ág CSAK
   * valós módban, üres listával mérhető — enélkül a „present" és az „error" ág futott, a
   * „nincs célod" pedig sosem.
   */
  test('a Súlycél sor „nincs aktív súlycél"-t mond üres cél-listára — nem hibát, nem töltést', async () => {
    server.use(http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])))
    renderHub()
    const row = await screen.findByRole('button', { name: /Súlycél/ })
    await waitFor(() => expect(row).toHaveTextContent('nincs aktív súlycél'))
    expect(row).not.toHaveTextContent('a súlycél most nem elérhető')
    expect(row).not.toHaveTextContent('töltöm…')
  })
```

- [ ] **Step 2: Run it and read the failure**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelokPage.test.tsx -t 'nincs aktív súlycél'
```

This test asserts behavior that SHOULD already be correct — it is a coverage gap, not a bug. Two legitimate outcomes:
- **PASS immediately** → the branch was correct all along and is now pinned. Good; go to Step 4.
- **FAIL** → you found a real bug behind the untested branch. Read the actual rendered text in the failure output, then fix `CelokPage.tsx`'s Súlycél ternary so an empty list resolves to `nincs aktív súlycél` — and describe the bug in the commit body.

Do NOT weaken the assertions to make it green.

- [ ] **Step 3: If Step 2 failed, fix the source and re-run**

Re-run the exact command from Step 2. Expected: PASS.

- [ ] **Step 4: Run the whole file in BOTH modes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelokPage.test.tsx
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelokPage.test.tsx
```

Expected: PASS in both. (The new test's own `vi.stubEnv` comes from the `describe` block's `beforeEach`, so it measures real mode regardless of the outer mode.)

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add frontend/src/features/me && git commit -m "test(fe/me): pin the Súlycél row's empty-goal-list branch (mezo-9r85)"
```

---

### Task A4: Record the two design rules (goalchip pop-in · `.lg-goalchip` payload)

Items 3 and 4 of the bd issue. **Both resolve to a recorded decision rather than a behavior change** — the reasoning below is the deliverable, and a reviewer may reject it on the reasoning alone.

**Item 3 — why the `isPending` gate is NOT applied.** `GrowthSkillsPage.tsx:42-43` reads `useLifeGoals()` and derives `chips`. While the query is pending, `goals` is the `[]` fallback, so `goalSkillChips([])` returns an empty map and **no chip renders**. Gating the chip layer on `isPending` produces the *identical* render — nothing, then chips — so it removes no pop-in and no layout shift; it only adds a branch. The actual pop-in is inherent to a secondary async source arriving after the primary one, and the only fixes that would change it (reserving chip-width space, or a skeleton chip) invent UI the design has not specified. `GrowthSkillsPage` also renders its primary content without gating on secondary data by existing convention. So: **no gate**, and the reason is written into the code so a future reader does not "fix" it again.

**Item 4 — the `.lg-goalchip` payload rule.** The token is a dimension-washed pill (dot + short label) reading its colour from the `--dc`/`--dw` custom properties that the nearest `.lg-d-*` ancestor sets. Three consumers carry two payloads: `WeekGoalsCard.tsx:31` prints the DIMENSION label, `SkillBandCard.tsx:42-44` and `EnHubPage.tsx:141` print the GOAL TITLE. That is not incoherent — the chip names **the half of the (goal, dimension) pair that the surrounding row does not already carry**: the Heti row's `nm` already prints the goal title, so its chip adds the dimension; a skill row and the hero carry no goal identity, so their chip adds the title. Unifying would make the Heti row print its own title twice. The rule is recorded so a fourth consumer has a decision procedure instead of a coin flip.

**Files:**
- Modify: `frontend/src/features/me/pages/GrowthSkillsPage.tsx:39-43` (item 3)
- Modify: `frontend/src/styles/prototype.css:9366-9367` and `:9377` (the `.lg-goalchip` rule's comment — item 4)
- Modify: `frontend/src/features/me/components/WeekGoalsCard.tsx:31`, `frontend/src/features/me/components/SkillBandCard.tsx:41`, `frontend/src/features/me/pages/EnHubPage.tsx:141` (one-line pointers)
- Modify: `docs/features/lifegoal.md` (§9 decisions)

**Interfaces:**
- Consumes: nothing.
- Produces: no runtime change whatsoever. **This task must not alter a single rendered pixel** — Task A6's visual run is the proof.

- [ ] **Step 1: Confirm the item-3 premise before recording it**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && sed -n '1,40p' frontend/src/features/me/logic/goalSkillChips.ts
```

Read `goalSkillChips` and verify that it returns an EMPTY map for an empty goal array (i.e. that a pending `useLifeGoals` renders no chip). If instead it can produce a chip from `[]`, the item-3 reasoning above is wrong — STOP and report rather than writing a false comment.

- [ ] **Step 2: Record the item-3 decision in `GrowthSkillsPage.tsx`**

Replace the comment at `frontend/src/features/me/pages/GrowthSkillsPage.tsx:39-41` with:

```tsx
  // A goalchip (mezo-iizd.12) mindhárom sávra megy: a pillér `skillKey`-e a LIFE-taxonómián
  // KÍVÜLRE is mutathat (a jel-katalógus `weight_goal`/`gym_volume` bejegyzései például
  // `max_strength`/`aerobic_capacity` atlétikai skillt adnak).
  //
  // SZÁNDÉKOSAN NINCS `isPending`-kapu a chip-rétegen (mezo-9r85, 3. tétel). Feloldatlan
  // lekérésnél a `goals` az üres tömb, tehát `goalSkillChips([])` üres mapet ad és chip nem
  // renderel — egy `isPending`-kapu BETŰRE ugyanazt rajzolná (semmi, majd chipek), csak egy
  // ággal többől. A beugrás magából a másodlagos aszinkron forrásból jön; elgondolkodtató
  // orvosság (chip-szélesség fenntartása vagy skeleton-chip) csak ÚJ, nem specifikált UI-t
  // találna ki. A lap amúgy is az elsődleges tartalmat kapuzatlanul rendereli.
```

- [ ] **Step 3: Record the item-4 rule at the token's definition**

In `frontend/src/styles/prototype.css`, extend the comment above the `.lg-goalchip` rule (currently `:9366-9367`) so it reads:

```css
/* Heti hub cél-kártya + goalchip (mezo-iizd.9, prototípus celok-body.html #page-heti .qcard/
   .wgrow/.goalchip). A `.lg-goalchip` a Growth skill-sorban is ezt a nyelvet viseli (mezo-iizd.12).
   SZABÁLY a chip TARTALMÁRA (mezo-9r85, 4. tétel): a chip a (cél, dimenzió) pár azon felét
   nevezi meg, amit a KÖRNYEZŐ SOR nem hordoz. A Heti sor `nm`-je már kiírja a cél címét → ott
   a chip a DIMENZIÓ-címke (WeekGoalsCard). Egy skill-sor és az Én-hub heroja nem hordoz
   cél-identitást → ott a chip a CÉL CÍME (SkillBandCard, EnHubPage). Egységesítés a Heti sorban
   duplán íratná ki a címet. Negyedik fogyasztó: ezt a szabályt alkalmazd, ne érmét dobj. */
```

- [ ] **Step 4: Point the three consumers at the rule**

Add a one-line comment directly above each `.lg-goalchip` render site — `WeekGoalsCard.tsx:31`, `SkillBandCard.tsx:41`, `EnHubPage.tsx:141`:

```tsx
{/* .lg-goalchip: a sor által NEM hordozott felét nevezi meg — a szabály a prototype.css-ben, a token definíciójánál (mezo-9r85). */}
```

Use the JSX-comment form where the site is inside JSX and a plain `//` line where it is not; match each file's surrounding style. State DIMENZIÓ in `WeekGoalsCard` and CÉL CÍME in the other two, so each site says which half it prints.

- [ ] **Step 5: Record the decisions in the feature doc**

In `docs/features/lifegoal.md` §9 (Decisions, gotchas & deferred), add two short bullets referencing `mezo-9r85`: the `.lg-goalchip` payload rule (with its "name the half the row lacks" formulation, and the note that a fourth consumer applies it), and the deliberate absence of an `isPending` gate on the Growth chip layer (with the reason: the gate renders identically). Bump the doc's `updated:` to `2026-09-06`.

- [ ] **Step 6: Prove nothing rendered changed**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && pnpm build
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/me src/features/me/lifegoalCssTokens.test.ts
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me
```

Expected: PASS everywhere. The CSS guard in particular must stay green — the new comment text must not introduce a raw hex or a bare `.play` token (the guard strips comments before the `.play` check but NOT before the hex check, so keep hex out of the comment).

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add frontend/src docs/features/lifegoal.md && git commit -m "docs(fe/me): record the .lg-goalchip payload rule and the no-gate goalchip decision (mezo-9r85)"
```

---

### Task A5: Give `.lg-conflict` a mock conflict so the golden actually draws it

`CelPage.tsx:131-136` renders the conflict sentence from `progress.conflicts`, but `mockProgress` (`frontend/src/data/lifegoal/lifegoalMock.ts:397`) hardcodes `conflicts: []`, so the `me-cel-reszlet` golden (`frontend/tests/visual/visual.spec.ts:88` → `/me/goals/lg-kockahas`) has never rendered the style. Seeding a conflict on **`lg-kockahas`** — the goal the golden opens — is what puts the rule under visual guard.

**Consequence to handle in the same task:** `CelPage.test.tsx:241-244` (`konfliktus nélkül nincs szekció-maradvány`) renders `lg-kockahas` in mock mode and asserts `.lg-conflict` is absent. It must re-point to a goal that still has no conflict, or it will fail — and it must KEEP existing, because "no conflict ⇒ no section remnant" is a real invariant.

**Files:**
- Modify: `frontend/src/data/lifegoal/lifegoalMock.ts` (the `mockProgress` return, `:390-399`)
- Modify: `frontend/src/features/me/pages/CelPage.test.tsx:241-244`

**Interfaces:**
- Consumes: `MOCK_LIFE_GOALS` and the existing `mockProgress(goalId)` signature — unchanged.
- Produces: `mockProgress('lg-kockahas').conflicts` is a one-element array; every OTHER goal id still returns `[]`. `mockToday()` calls `mockProgress` internally and reads only `arrow`/`weeklyPct`, so it is unaffected — confirm this in Step 1.

- [ ] **Step 1: Find a conflict-free goal for the re-pointed test, and check `mockToday`**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && grep -n "id: 'lg-" frontend/src/data/lifegoal/lifegoalMock.ts && echo "== mockToday reads:" && sed -n '400,430p' frontend/src/data/lifegoal/lifegoalMock.ts
```

Note the goal ids. Pick one ACTIVE, non-`lg-kockahas` id for the re-pointed test (`lg-hustle` and `lg-baratno` both appear in `CelokPage.test.tsx`'s expectations, so both are live). Confirm `mockToday` does not read `conflicts`; if it does, report before proceeding.

- [ ] **Step 2: Seed the conflict in `mockProgress`**

In `frontend/src/data/lifegoal/lifegoalMock.ts`, above `export function mockProgress`, add:

```ts
/** A cél-ütközés mondat (`.lg-conflict`, CelPage.tsx) mock-fedezete: a backend
 *  `LifeGoalProgressService.findConflicts` számolja, a mock eddig mindig `[]`-t adott, tehát a
 *  `me-cel-reszlet` golden SOSEM rajzolta a stílust (mezo-9r85, 5. tétel). Egyetlen célra
 *  ültetjük — arra, amit a golden nyit —, hogy a „nincs konfliktus ⇒ nincs szekció-maradvány"
 *  invariáns a többi célon mérhető maradjon. */
const MOCK_CONFLICTS: Record<string, string[]> = {
  'lg-kockahas': ['A Kockahas és a Side hustle ugyanazt az estét kéri — a napzárás mindkettőben pillér.'],
}
```

and change the return's last line from `days, pillars, conflicts: [],` to:

```ts
    days, pillars, conflicts: MOCK_CONFLICTS[goalId] ?? [],
```

- [ ] **Step 3: Re-point the "no remnant" test to a conflict-free goal**

In `frontend/src/features/me/pages/CelPage.test.tsx`, replace the test at `:241-244` with (substituting the id you chose in Step 1):

```tsx
// A mock MOST már ültet konfliktust `lg-kockahas`-ra (mezo-9r85, 5. tétel — a `me-cel-reszlet`
// golden fedezete), tehát az invariáns mérése egy konfliktus-MENTES célra költözik.
test('konfliktus nélkül nincs szekció-maradvány', async () => {
  renderGoal('lg-hustle')
  await screen.findByText(/Pillérek/)
  expect(document.querySelector('.lg-conflict')).toBeNull()
})
```

- [ ] **Step 4: Add the positive mock-mode assertion**

Directly after it, add:

```tsx
test('a mock-konfliktus tényleg rajzol a golden céljára (mezo-9r85)', async () => {
  renderGoal('lg-kockahas')
  expect(await screen.findByText(/ugyanazt az estét kéri/)).toBeInTheDocument()
  expect(document.querySelector('.lg-conflict')).not.toBeNull()
})
```

- [ ] **Step 5: Run `CelPage` + `CelokPage` + the lifegoal data tests in BOTH modes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelPage.test.tsx src/features/me/pages/CelokPage.test.tsx src/data/lifegoal
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelPage.test.tsx src/features/me/pages/CelokPage.test.tsx src/data/lifegoal
```

Expected: PASS in both. If the existing real-mode conflict test at `CelPage.test.tsx:229-239` now interferes, read WHY before touching it — it stubs `/api/life-goals/:id/progress` and should be independent of the mock seed.

- [ ] **Step 6: Update the feature doc**

In `docs/features/lifegoal.md`, in the section describing the mock seed (and §8 Testing), note that `mockProgress` now seeds one conflict sentence on `lg-kockahas` specifically so the `me-cel-reszlet` golden guards `.lg-conflict`, and that the "no remnant" invariant is measured on a conflict-free goal. Bump `updated:` to `2026-09-06` if Task A4 has not already.

- [ ] **Step 7: Commit** (goldens are NOT regenerated here — Task A6 owns that)

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add frontend/src docs/features/lifegoal.md && git commit -m "test(fe/me): seed a mock goal conflict so the me-cel-reszlet golden guards .lg-conflict (mezo-9r85)"
```

---

### Task A6: Regenerate the darwin visual goldens

**Files:**
- Modify: `frontend/tests/visual/__screenshots__/**/me-cel-reszlet-*-darwin.png` (light + dark) — and NOTHING else.

**Interfaces:**
- Consumes: the mock conflict from Task A5.
- Produces: the darwin baselines. The **linux** baselines come from the bot in Task C2 — never hand-generate them.

- [ ] **Step 1: Make sure no OTHER worktree is squatting on port 4318**

```bash
lsof -i :4318 -sTCP:LISTEN
```

`test:visual` uses a HARDCODED port 4318 with `reuseExistingServer: true`. If another worktree left a dev server there, Playwright silently attaches to **that tree's UI** and generates goldens of the wrong code with a false zero-diff and no error message. This has happened twice. If this command prints ANYTHING, stop and kill that server (or wait for the other session) before generating.

- [ ] **Step 2: Check machine load before a Playwright run**

```bash
uptime
```

If the 1-minute load average is above ~10, wait. Above load 20 the 30 s Playwright timeout fails en masse and the failures will look like real regressions.

- [ ] **Step 3: Run the visual suite WITHOUT updating, to see the expected diff first**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && pnpm test:visual -- --workers=2 -g 'me-cel-reszlet'
```

Expected: FAIL on `me-cel-reszlet` in both themes, with the diff showing the new conflict sentence. If it PASSES, the mock conflict is not reaching the page — go back to Task A5, do not proceed.

- [ ] **Step 4: Regenerate**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && pnpm test:visual:update -- --workers=2
```

- [ ] **Step 5: Keep ONLY the intended images**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git status --short frontend/tests/visual
```

`test:visual:update` rewrites many images. Expected intentional changes: the `me-cel-reszlet` light + dark `-darwin.png` pair ONLY.

**Task A1's CSS deletion should move NOTHING** — it removed rules with no consumer. If any other image is modified, do NOT just revert it: open the diff, understand why it moved, and report. An unexplained golden movement after a "dead code" deletion means the code was not dead.

Revert every unintended file:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git checkout -- <each unintended path>
```

- [ ] **Step 6: Verify the suite is green against the new baselines**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && pnpm test:visual -- --workers=2
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add frontend/tests/visual && git commit -m "test(fe/me): refresh the me-cel-reszlet darwin goldens for the conflict sentence (mezo-9r85)"
```

---

### Task A7: The stale test comment (item 6)

`frontend/src/features/me/pages/EnHubPage.test.tsx:44-46` still says the `useGoal()` call "only warms the weightLog cache". `EnHubPage.tsx:94` records that the bare `useGoal()` call was **dropped** — so the test's `vi.mock` entry for `useGoal` describes a call that no longer happens.

The second half of bd item 6 — `docs/features/proactive.md`'s `updated:` field — is **ALREADY FIXED**: it reads `2026-09-06`, corrected by the `mezo-d58h.7.5` commit. Verify and skip; do not "re-fix" it.

**Files:**
- Modify: `frontend/src/features/me/pages/EnHubPage.test.tsx:44-46`

**Interfaces:** none.

- [ ] **Step 1: Confirm both premises**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && echo "== EnHubPage still calls useGoal?" && grep -n "useGoal" frontend/src/features/me/pages/EnHubPage.tsx && echo "== proactive.md updated:" && sed -n '/^updated:/p' docs/features/proactive.md
```

Expected: the only `useGoal` hit in `EnHubPage.tsx` is the comment at `:94` recording its removal, and `proactive.md` shows `updated: 2026-09-06`.

- [ ] **Step 2: Try removing the dead mock entry**

Delete the `useGoal` entry AND its two-line stale comment from the `vi.mock('@/data/hooks', …)` factory at `frontend/src/features/me/pages/EnHubPage.test.tsx:44-46`.

- [ ] **Step 3: Run the file in both modes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/me/pages/EnHubPage.test.tsx
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me/pages/EnHubPage.test.tsx
```

- **PASS in both** → nothing in the rendered tree calls `useGoal`; the removal is correct. Done.
- **FAIL** with something like "useGoal is not a function" → a descendant component still calls it through the mocked module. In that case RESTORE the stub and replace only the comment with the truthful version:

```tsx
    // Az EnHubPage MAGA már nem hívja a `useGoal`-t (a hero életcél-összegzés, mezo-iizd.4 —
    // lásd EnHubPage.tsx:94). A stub azért marad, mert a `vi.mock` az EGÉSZ `@/data/hooks`
    // modult kiváltja, és a fa egy leszármazottja még hívja (mezo-9r85, 6. tétel).
    useGoal: () => ({ goal: null, goalResponse: null, pending: false }),
```

- [ ] **Step 4: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add frontend/src/features/me/pages/EnHubPage.test.tsx && git commit -m "test(fe/me): drop the stale useGoal cache-warm note from the Én-hub test (mezo-9r85)"
```

---

## PART B — `mezo-iizd.13` (research wiki)

> **Scope note.** The bd issue's body enumerates the **motor-design** spec's five sources; the session brief enumerates the **system-design** spec's ten. Both are authoritative statements of scope, so this plan covers their **union**. The 2026-09-05 companion-block spec's §2 is a THIRD set (ChatGPT Model Set Context, Whoop Coach, Anthropic context-engineering, Oura Advisor, Bloom CHI) named by neither — it is deliberately OUT of scope; file it as a follow-up in Task C1.

### B0 — What the sources actually say (READ THIS BEFORE WRITING ANY PAGE)

The two `raw/` captures are already written and hashed (Task B1 is therefore reduced to committing
them). Reading them turned up **five places where a spec's §2 misstates its own source**. The wiki's
job is to record what the source says, so **every one of these goes into the pages as a stated
correction** — with the adopted mezo behavior left ALONE. We are correcting the *provenance*, not
re-opening a shipped decision.

| # | The spec claims | The source actually says | What the page must do |
|---|---|---|---|
| 1 | Strides' four types are Habit / Target / Average / **Project** (system-design §2, D10) | The FAQ's fourth archetype is **Milestone**, not Project. It also documents a **"Bad Habit"** inverted variant and a **"Pace"** system (expected rate from start/end dates + target). | Name the four correctly; note that mezo's `kapcsolt` kind was a substitution for **Milestone**. Record Pace as an un-harvested idea. |
| 2 | Apple Fitness Trends = "short vs long window" (system-design §2) | Apple compares a **90-day** average against a **365-day** average, and needs **6 months** of history before it recommends anything. | State Apple's real numbers, then state that mezo's **7 vs 21 days / min-5-data-day** is a deliberate SHORTENING, not a mirror. That contrast is the interesting part. |
| 3 | Exist.io's baseline is a **60-day** rolling median (system-design §2); mezo adopted 28 days / min 14 | **Confirmed** — 60-day lookback, recomputed weekly, medians, broken down by day-of-week. | The one spec claim that fully survives contact. Say so, and note the day-of-week breakdown mezo did NOT take. |
| 4 | Exist.io has a **rolling re-sync window** — "minden futás az utolsó napokat írja újra" — cited to `kb.exist.io/article/55` (motor §2) | That article is about **cross-day correlations** (lag-1, day N vs day N+1). It contains **no sync-window or backfill content at all.** The citation does not support the claim. | Record the misattribution plainly. mezo's 3-day resync window keeps its OWN justification (the partition-overwrite pattern, row 5) — it just cannot cite Exist for it. |
| 5 | Gorges & Grund 2017 shows parallel goals' resource conflict **worsens attainment** (system-design §2, D7) | It is a **narrative/theoretical review**, not an empirical study: 161 articles screened 1985–2015 → **35** synthesized. It reports **no pooled effect size**. It does give a useful taxonomy: **resource-based** vs **inherent** conflict. | Do not attribute an effect to it. Present it as a conceptual warning + the two-type taxonomy — which is exactly why D7 made it a companion *warning* and not a hard gate. The decision was already better than its citation. |

**Three further gaps to state honestly rather than paper over:**

- **Habitica's wiki page (402) and the ml4devs backfilling article (403) were both unreachable.** The agent substituted better sources: Habitica **issue #8665**, a primary report of a real double-cron ("run at day-start" AND "run on first login" both firing, no durable done-for-today guard, user lost levels), and a dev.to article documenting the same partition-overwrite pattern. Cite what was actually read; name the assigned URLs as unreachable.
- **uhabits' "raw day is truth, everything else is a pure recomputation" is an INFERENCE**, not documented. What IS documented: exponential smoothing, `multiplier = pow(0.5, frequency/13.0)` (≈0.95/day for a daily habit), reaching 80%/96%/99% of max at 1/2/3 months. Retroactive-edit behavior is undocumented in both threads.
- **Oura publishes the normalization but NOT the weighting** — nine named contributors, each on 0–100 with published bands (85+/70+/60+), personalized against the user's own averages, needing up to **two weeks** to learn a baseline; the combination formula is undisclosed. That opacity is *why* mezo's 1..3 pillar weights are visible, so it strengthens the decision rather than undermining it.

**Consequences for the frontmatter:** every page carrying a corrected claim sets `confidence: medium`
at best; `goal-pursuit-evidence.md` sets **`low`** on its Harkin and Gollwitzer legs (neither primary
text was readable — the numbers come from secondary sources quoting the abstracts) even though its
SDT leg was read in full from PMC. Use the `contradictions: []` field for genuine page-vs-page
disagreement only; a spec-vs-source correction belongs in the page BODY, where a reader will see it.

**Numbers you may use, because a source was actually read for them:** Exist 60-day/weekly/median ·
Apple 90 vs 365 days, 6-month minimum · WHOOP min **5** logged responses per tag · Oura 9
contributors, 0–100, up-to-2-week baseline · uhabits 80/96/99% at 1/2/3 months and the
`pow(0.5, f/13.0)` multiplier · Gorges & Grund 161→35 articles, 1985–2015 · Gallup 150+ countries,
66% / 7% · Ryff 84/42/18 items, α ≈ .86–.93 · PERMA-Profiler 23 items (15 core + 8 filler), N=7,188
then N=31,966 · Niemiec β = .77 / −.66 / .00 / .38, N=147 · Harkin k=138, N=19,951, d+=1.98 and 0.40
· Gollwitzer k=94, N>8,000, d=0.65. **Invent nothing beyond this list.**

### Task B1: Capture the two raw sources

The two research reports were commissioned from `researcher` subagents in this session and are handed to the implementer as files in the scratchpad. They follow the repo's existing precedent (`raw/articles/2026-08-21-*-deep-research.md`, `source_url: agent-web-research`).

**Files:**
- Create: `docs/research/raw/articles/2026-09-06-lifegoal-prior-art-research.md`
- Create: `docs/research/raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md`

**Interfaces:**
- Produces: the two `raw/` paths and their SHA256 values, which every Part B page lists in its `sources:` frontmatter. `raw/` files are **IMMUTABLE after this task** — no later task may edit them.

- [ ] **Step 1: Write each report body to its raw path, with the provenance header FIRST**

Header shape (matching `raw/articles/2026-08-21-hermes-agent-deep-research.md`):

```yaml
---
title: "Life-goal system — prior art research report (agent web-research)"
type: article
source_url: agent-web-research (Claude subagent, sources cited inline)
ingested: 2026-09-06
sha256: <filled in Step 2>
---

<!-- RAW SOURCE — immutable. Agent web-research report (Claude subagent, 2026-09-06),
     commissioned for the life-goal system's research-wiki ingest (mezo-iizd.13); the sources
     are the ones named in docs/superpowers/specs/2026-09-02-lifegoal-system-design.md §2.
     Do not edit content below. -->
```

The second file's `title` is `"Life-goal progress engine — prior art research report (agent web-research)"` and its comment names `2026-09-03-lifegoal-slice2-motor-design.md §2`.

- [ ] **Step 2: Compute and write each SHA256**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/docs/research/raw/articles && shasum -a 256 2026-09-06-lifegoal-prior-art-research.md 2026-09-06-lifegoal-engine-prior-art-research.md
```

Paste each hash into that file's `sha256:` field. (The existing captures hash the file as written, matching the sibling files' convention — follow whatever `scripts/lint-docs.mjs` actually checks; verify with Step 3.)

- [ ] **Step 3: Confirm the lint agrees about source-drift**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/lint-docs.mjs 2>&1 | grep -i "drift\|sha" || echo "no drift reported"
```

If the lint reports drift on the two new files, your hash is computed over a different span than the linter's — read `scripts/lint-docs.mjs`'s source-drift check and match it exactly.

- [ ] **Step 4: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add docs/research/raw && git commit -m "docs(research): capture the life-goal prior-art research reports as raw sources (mezo-iizd.13)"
```

---

### Task B2: The `goals` tag + the Exist.io entity page

**Files:**
- Modify: `docs/research/SCHEMA.md` §3 (tag taxonomy)
- Create: `docs/research/entities/exist-io.md`

**Interfaces:**
- Produces: the `goals` tag (every Part B page uses it) and the slug `exist-io`, which the concept pages link to as `../entities/exist-io.md`.

- [ ] **Step 1: Add the tag**

SCHEMA §3 requires a tag be added only when ≥2 pages need it, listed in §3, and recorded in `log.md`. Seven pages need it. Add `goals` to the seed-set line in `docs/research/SCHEMA.md` §3 and bump that doc's `updated:` to `2026-09-06`. (The `log.md` line lands in Task B6.)

- [ ] **Step 2: Write `docs/research/entities/exist-io.md`**

Frontmatter:

```yaml
---
title: Exist.io
type: entity
updated: 2026-09-06
tags: [goals, me, technique]
related:
  - ../concepts/trend-arrows-and-baselines.md
  - ../concepts/idempotent-daily-recompute.md
  - ../../features/lifegoal.md
sources:
  - raw/articles/2026-09-06-lifegoal-prior-art-research.md
  - raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md
confidence: medium
contradictions: []
---
```

Body (< 200 lines), covering only what the raw reports actually establish:
- **What it is** — a personal-analytics aggregator; the load-bearing structural choice is that it has **no goal object at all**: an attribute plus a rolling baseline, with correlations layered on top.
- **The two lessons mezo ADOPTED** — the baseline-as-pillar idea (Exist's rolling median → our 28-day window with a min-14-data-day gate), and the rolling re-sync window (each run rewrites the last N days so late data backfills itself → our 3-day window).
- **The layer mezo DEFERRED** — the cross-attribute correlation engine.
- **Why it is the only entity page in this ingest** — it is the sole subject cited by BOTH spec §2s and carries three separable positions.
- Link out to both concept pages and into `../../features/lifegoal.md`.

Mark any number you could not verify against a primary source as such, and set `confidence` honestly — `medium` unless the raw report reached primary docs for every claim.

- [ ] **Step 3: Lint**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/lint-docs.mjs --errors-only
```

Expected: 0 errors. Broken `related:` links to pages not yet written are the likely complaint — if the linter treats a forward reference as an error, write the concept pages first (Task B3/B4) and commit them together with this one.

- [ ] **Step 4: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add docs/research && git commit -m "docs(research): Exist.io entity page + the goals tag (mezo-iizd.13)"
```

---

### Task B3: The three goal-design concept pages

**Files:**
- Create: `docs/research/concepts/goal-type-taxonomies.md`
- Create: `docs/research/concepts/perma-and-wellbeing-taxonomies.md`
- Create: `docs/research/concepts/goal-conflict.md`

**Interfaces:**
- Consumes: `sources: [raw/articles/2026-09-06-lifegoal-prior-art-research.md]` from Task B1; the `goals` tag from Task B2.
- Produces: the slugs `goal-type-taxonomies`, `perma-and-wellbeing-taxonomies`, `goal-conflict` — referenced by Task B6's index and by the feature-doc cross-links in Task B5.

- [ ] **Step 1: `goal-type-taxonomies.md`**

Frontmatter as in Task B2's shape, with `type: concept`, `tags: [goals, me, technique]`, `related: [../entities/exist-io.md, goal-pursuit-evidence.md, ../../features/lifegoal.md]`.

Body: Strides' four goal kinds (Habit / Target with a pace line / Average / Project) exactly as the raw report describes them; how mezo's four map onto them, with the **`Project` → `kapcsolt` (linked) substitution** recorded as decision **D10** of `docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`; and the explicitly REJECTED alternatives — Gyroscope's single opaque "life score", manual check-in-only goals, and an arrow with no minimum-data gate. Rejections carry their reason: a rejection is knowledge.

- [ ] **Step 2: `perma-and-wellbeing-taxonomies.md`**

`type: concept`, `tags: [goals, me]`, `related: [goal-pursuit-evidence.md, goal-type-taxonomies.md, ../../features/lifegoal.md]`.

Body: the PERMA-Profiler (Butler & Kern 2016) — its factors and what the raw report established about its psychometrics — as the ADOPTED basis of mezo's visible dimension taxonomy (**D2**). Then Gallup's Wellbeing 5 and Ryff's six dimensions: what each is, and why each was **rejected as a VISIBLE taxonomy** (vendor model / too abstract for a UI label). Be explicit that the rejection is about visibility, not validity.

- [ ] **Step 3: `goal-conflict.md`**

`type: concept`, `tags: [goals, me]`, `related: [goal-pursuit-evidence.md, ../../features/lifegoal.md, ../../features/companion.md]`.

Body: Gorges & Grund 2017 on parallel goals competing for the same resource and the effect on attainment — with whatever effect sizes / design the raw report actually verified, and nothing invented. Then mezo's position: **adopted as a companion WARNING, rejected as a hard constraint** (**D7**) — the user may hold conflicting goals; the app says so and does not block. Link to the concrete surface: the `.lg-conflict` sentence on the goal detail page (`frontend/src/features/me/pages/CelPage.tsx:131`), which Task A5 put under visual guard.

- [ ] **Step 4: Lint and commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/lint-docs.mjs --errors-only
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add docs/research && git commit -m "docs(research): goal-type, PERMA/wellbeing and goal-conflict concept pages (mezo-iizd.13)"
```

---

### Task B4: The three mechanism concept pages

**Files:**
- Create: `docs/research/concepts/goal-pursuit-evidence.md`
- Create: `docs/research/concepts/trend-arrows-and-baselines.md`
- Create: `docs/research/concepts/idempotent-daily-recompute.md`

**Interfaces:**
- Consumes: both raw captures from Task B1.
- Produces: the three slugs, referenced by Task B6's index and Task B5's feature-doc links.

- [ ] **Step 1: `goal-pursuit-evidence.md`**

`type: concept`, `tags: [goals, me, technique]`, `related: [goal-type-taxonomies.md, perma-and-wellbeing-taxonomies.md, ../../features/lifegoal.md]`, `sources: [raw/articles/2026-09-06-lifegoal-prior-art-research.md]`.

Three sources, one theme — *what actually makes a goal move*:
- **Harkin et al. 2016** — the progress-monitoring meta-analysis. Report the k / N / effect the raw capture verified, and label anything reached only via a secondary summary. This is decision **D1**: visible progress tracking is the product's core mechanism, not decoration.
- **Gollwitzer & Sheeran 2006** — implementation intentions, d≈0.65 (state it as the raw report states it). Decision **D8**: the wizard asks for a *when/where* plan, not just an aspiration.
- **SDT goal contents** (Niemiec, Ryan & Deci 2009) — intrinsic vs extrinsic aspirations and their wellbeing outcomes; the basis of the wizard's framing nudge (also **D8**).

Set `confidence` on the weakest leg, not the strongest.

- [ ] **Step 2: `trend-arrows-and-baselines.md`**

`type: concept`, `tags: [goals, me, technique]`, `related: [../entities/exist-io.md, idempotent-daily-recompute.md, ../../features/goal-engine.md]`, `sources:` BOTH raw captures.

Theme — *turning heterogeneous daily signals into an honest direction*:
- **Apple Fitness Trends** — the short-vs-long window arrow, one suggested next step, and the "how many weeks to turn it around" line. mezo's adoption: **7 vs 21 days, with a minimum-5-data-day gate** before an arrow is shown at all.
- **Exist.io** — the rolling-median baseline (→ 28 days, min 14 data days). Link the entity page rather than repeating it.
- **Oura Readiness contributors** — heterogeneous signals normalized per contributor then combined; mezo adopted the normalize-then-combine shape but **rejected the opaque weighting** — our pillar weights are visible 1..3.
- **WHOOP Journal** — yes-day vs no-day attribution on one outcome; **deferred to Phase 2** as a weekly-retrospective attribution card, not shipped.

The load-bearing shared rule across all four: **no arrow without a minimum-data gate** — too little data must never masquerade as a direction. Tie it to the `insufficient` state that `EnHubPage`'s trio deliberately excludes from all three buckets.

- [ ] **Step 3: `idempotent-daily-recompute.md`**

`type: concept`, `tags: [goals, backend, technique]`, `related: [trend-arrows-and-baselines.md, ../entities/exist-io.md, ../../features/goal-engine.md]`, `sources: [raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md]`.

Theme — *the recompute job's shape*:
- **Loop Habit Tracker (uhabits)** — the raw daily checkmark is the truth; every derived value is a pure recomputation; a retroactive edit recomputes the window. Adopted: `pillar_day` is the fact, the arrow and heatmap are read-time derivations.
- **Habitica cron** — the double-running daily evaluation that punished twice. The lesson mezo made non-negotiable (**D-1** of the motor spec): a `(pillar, day)`-keyed upsert plus a uniquely-keyed XP ledger.
- **Exist.io's rolling re-sync window** — adopted as a 3-day window.
- **Idempotent partition-overwrite batch / backfilling** — per-day upsert + bounded recomputation window + side-effect ledger; "a good pipeline is re-runnable" as the job's design rule.

- [ ] **Step 4: Length check — SCHEMA caps research pages at ~200 lines**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && wc -l docs/research/concepts/*.md docs/research/entities/exist-io.md
```

Any new page over ~200 lines must be SPLIT, not trimmed of substance.

- [ ] **Step 5: Lint and commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/lint-docs.mjs --errors-only
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add docs/research && git commit -m "docs(research): goal-pursuit evidence, trend arrows/baselines, idempotent recompute concepts (mezo-iizd.13)"
```

---

### Task B5: Cross-link the feature docs INTO the wiki

The skill's rule: an external source that informs our code lands in BOTH collections, joined by a link. Without this the new pages are orphans in the lint's sense.

**Files:**
- Modify: `docs/features/lifegoal.md` (frontmatter `related:` + a prose pointer)
- Modify: `docs/features/goal-engine.md` (same)

**Interfaces:**
- Consumes: all seven slugs from B2/B3/B4.

- [ ] **Step 1: Check how existing feature docs reference research pages**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && grep -rn "research/" docs/features/*.md | head -20
```

Copy that exact link form — do not invent a new one.

- [ ] **Step 2: Link from `lifegoal.md`**

In §9 (Decisions), add a line pointing at the prior art now in the wiki: `goal-type-taxonomies`, `perma-and-wellbeing-taxonomies`, `goal-conflict`, `goal-pursuit-evidence`, and the `exist-io` entity — noting that D1/D2/D7/D8/D10 each have their source recorded there. Add the slugs to the frontmatter `related:` in the form Step 1 established. Bump `updated:`.

- [ ] **Step 3: Link from `goal-engine.md`**

Same, for `trend-arrows-and-baselines`, `idempotent-daily-recompute` and `exist-io`. Bump `updated:`.

- [ ] **Step 4: Full lint — orphans must be zero**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/lint-docs.mjs
```

Read the FULL output (not `--errors-only`) here: orphan and broken-link warnings are exactly what this task exists to clear. Stale-feature-doc warnings are advisory.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add docs/features && git commit -m "docs(lifegoal): cross-link the feature docs into the new research pages (mezo-iizd.13)"
```

---

### Task B6: Close the wiki loop — catalog + log

SCHEMA §6 says every INGEST ends by updating `index.md` and appending one `log.md` line. An un-catalogued page is an orphan by the wiki's own definition.

**Files:**
- Modify: `docs/research/index.md`
- Modify: `docs/research/log.md`

- [ ] **Step 1: Add the catalog rows**

In `docs/research/index.md`, add the Exist.io row under **## Entities** and the six concept rows under **## Concepts**, each in the established one-line form — `[Title](path) — one-clause description; what consumes it. \`confidence: X\`.` Match the surrounding rows' voice exactly. Bump the doc's `updated:` to `2026-09-06`.

- [ ] **Step 2: Append the log line**

At the bottom of `docs/research/log.md`, append one line in the existing `YYYY-MM-DD · OP · summary` format recording: the INGEST date, the two raw captures, the 1 entity + 6 concepts distilled from them, the `goals` tag addition (SCHEMA §3 requires the tag addition be logged), and the driving issue `mezo-iizd.13` with the two specs whose §2 supplied the sources.

- [ ] **Step 3: Final lint**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/lint-docs.mjs --errors-only
```

Expected: **0 errors.** This is the authoritative gate for the whole docs half.

- [ ] **Step 4: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git add docs/research && git commit -m "docs(research): catalog + log the life-goal prior-art ingest (mezo-iizd.13)"
```

---

## PART C — gates, PR, merge

### Task C1: Full local gate

- [ ] **Step 1: Build**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && pnpm build
```

- [ ] **Step 2: Full suite, MOCK mode**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2
```

- [ ] **Step 3: Full suite, REAL mode** (separate command — this is the gate the unset env silently voids)

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2
```

- [ ] **Step 4: Codemap + doc lint**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/gen-codemap.mjs --check
```

`docs/CODEMAP.md:786` lists `GoalMiniCard.tsx`, so Task A2's deletion WILL make this stale. Regenerate and amend into the last commit:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/gen-codemap.mjs && git add docs/CODEMAP.md && git commit --amend --no-edit
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/lint-docs.mjs --errors-only
```

- [ ] **Step 5: File the deliberate follow-ups as bd issues**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && bd create --help
```

File, at P3: (a) the companion-block spec's §2 sources (ChatGPT Model Set Context, Whoop Coach, Anthropic context-engineering guide, Oura Advisor, Bloom CHI prototype) as a second research-wiki ingest, explicitly out of scope here; (b) the four still-orphaned Me components (`MeBioRow`, `BiometricCard`, `AiUsageCard`, and whichever else Task A2's Step 7 confirmed) as a deliberate cleanup pass, since Task A2 removed only `GoalMiniCard`.

### Task C2: PR, CI, goldens, merge

- [ ] **Step 1: Push and open the self-PR**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git push -u origin feat/lifegoal-polish-doksi
```

Open the PR with `gh pr create`; the body lists the commits, the gate output, and every point where this plan's "defensible to decline" judgment was exercised (items 3 and 4).

- [ ] **Step 2: Ask the bot for the linux baselines**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && gh workflow run update-visual-baselines.yml -r feat/lifegoal-polish-doksi
```

Only `*-darwin.png` was generated locally. The bot's commit does **not** trigger CI, so after it lands: `git pull`, then an empty commit to start the run.

- [ ] **Step 3: CI green, then re-check against CURRENT main**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && gh workflow run premerge.yml -f pr=<number>
```

A PR's own green tick can predate the base it will merge into. If the PR conflicts with main, GitHub silently runs NO checks — merge main into the branch and push to restart CI. **A golden conflict at merge is never resolved by picking a side — regenerate from the merged tree.**

- [ ] **Step 4: Merge on top of FRESH main, push, delete the branch**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git checkout main && git pull --rebase && git merge --no-ff feat/lifegoal-polish-doksi && git push
```

Rebase BEFORE the merge — rebasing after flattens the `--no-ff` merge commit.

- [ ] **Step 5: Close the issues and check the epic**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && bd close mezo-9r85 mezo-iizd.13 && bd show mezo-iizd
```

If `mezo-iizd` has no open children left, close the epic too. **The graph items `mezo-06o0.5`, `mezo-iizd.11` and `mezo-a9os` belong to the A round — if they are still open, the epic stays open.**

- [ ] **Step 6: Session close**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && node scripts/check-beads-backup.mjs --fix
```

Commit the refreshed `.beads/issues.jsonl`, then:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220 && git pull --rebase && bd dolt push && git push && git status
```

`git status` MUST report up to date with origin.

---

## Out of scope (deliberately)

- `mezo-06o0.5` + `mezo-iizd.11` + `mezo-a9os` — the A round (graph archiving, GOAL node, windowed weekly goal block). Do not touch.
- Any non-life-goal topic in `docs/research/`.
- The 2026-09-05 companion-block spec's §2 sources — filed as a follow-up in Task C1 Step 5.
