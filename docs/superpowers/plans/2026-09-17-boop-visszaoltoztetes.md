# Boop visszaöltöztetés — Program Implementation Plan

> **For agentic workers:** This is a PROGRAM plan: each task below is one bd bead executed in
> its own fresh session via the `visszaoltoztetes` project skill. Within a task-session, use
> superpowers:executing-plans discipline (TDD where tests apply, frequent commits, verification
> before completion). Re-dress tasks (5–7) begin with a short in-session design pass against
> the style bible before touching code. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return the app to the pre-Titanium design_2.0 visual world (Mozaik/Clay) while keeping
every piece of functionality shipped during the Titanium period (2026-09-09 → 2026-09-17).

**Architecture:** Forward-fix re-dress, never revert. Beat 1 strips the global Titanium shell
(one scope class + header + splash + icons); Beat 2 strangler-figs one feature area per bead,
each closing with a reverse parity checklist. The pre-Titanium tree (≤ v2.243) is read-only
reference, mined once into a "style bible".

**Tech Stack:** React + Vite PWA (`frontend/`), single `frontend/src/styles/prototype.css`
style monolith with marker-delimited sections, mozaik/clay UI kits, bd (beads) tracker,
"no-wait, net stays" merge flow (AGENTS.md §Git Workflow).

**Spec:** `docs/superpowers/specs/2026-09-17-boop-visszaoltoztetes-design.md` — read it first
in every session.

**Epic:** `mezo-ju4j6`. Bead map: .1=Task 0 · .2=Task 1 · .3=Task 2 · .4=Task 3 · .5=Task 4 ·
.6/.7/.8/.9=Task 5a–d · .10=Task 6 · .11/.12/.13=Task 7a–c · .14/.15=Task 8a–b · .19=Task 8.5 · .16=Task 9.

## Global Constraints

- Behavior is frozen: no functional change in any re-dress task. Keep-list in spec §Keep-list.
- Never restore whole directories from git history (GlassBox lives in the mozaik kit and
  post-dates the old world). File-level restores only, explicitly listed per task.
- `prototypeCssStructure.test.ts` section markers and CSS sections move/die together, in the
  same commit.
- FE tests run in BOTH modes (`VITE_USE_MOCK` unset = mock; set `VITE_USE_MOCK=false` for real;
  `CI=true` required for scoping) + affected `frontend/tests/layout` specs.
- Every task: own `feat/<topic>` branch in a worktree; merge per the "no-wait, net stays"
  flow (AGENTS.md §Git Workflow, 2026-09-18): local gates → `--no-ff` merge to main → push;
  no PR/CI wait. A red main at session start is fixed before any new work.
- After file moves/deletes: `node scripts/gen-codemap.mjs` and commit CODEMAP; regenerate after
  every merge. Session close: `node scripts/check-beads-backup.mjs --fix` + `bd dolt push`.
- Re-dress tasks close by pasting the reverse parity checklist result into the bd issue.
- prototype.css line numbers drift — locate sections by their marker comments, never by line.
- Model guidance: "strong" = Opus/Fable (design judgment, first-of-kind), "fast" = Sonnet
  (established pattern). Advisory, recorded per bead label `model:strong` / `model:fast`.

---

### Task 0: Rulebook flip (bead: phase 0, model:fast, ~1 session)

**Files:**
- Modify: `CLAUDE.md` §"Design direction" — rewrite to mandate the restored Mozaik/Clay world;
  Titanium becomes the superseded direction; point at the style bible (Task 1 output) as canon
  once it exists (leave a forward pointer now).
- Modify: `docs/design_2.0/README.md` — flip the canon index: Titanium docs → superseded,
  Mozaik/Clay-era docs → living; add a "2026-09-17 direction reversal" note explaining why.
- Modify: `docs/features/_platform-design-system.md` — add a direction-reversal banner at top;
  fix the stale title.
- Audit: `bd memories titanium`, `bd memories design` — update/`bd forget` any memory mandating
  Titanium.

**Steps:**
- [ ] Grep the repo for rule-carrying Titanium mandates: `grep -rn "Titanium" CLAUDE.md AGENTS.md docs/design_2.0/README.md docs/features/_platform-design-system.md .claude/`
- [ ] Rewrite CLAUDE.md §Design direction (keep the section shape: canon pointer, key patterns, do/don't list; ceremony *pattern* doc stays canon, its Titanium skin does not)
- [ ] Flip `docs/design_2.0/README.md` statuses; do NOT delete Titanium docs (history + coverage registers stay, they feed parity checklists)
- [ ] Banner + title fix in `_platform-design-system.md`
- [ ] `bd memories` audit; update with `bd remember --key <k>`; record the reversal itself as a new memory
- [ ] Verify: fresh-eyes read — could a new session still conclude "Titanium is mandatory"? Fix until no.
- [ ] Commit, local gates, --no-ff merge to main (no-wait flow)

### Task 1: Old-world style bible (bead: phase 1, model:strong, ~1–2 sessions)

**Files:**
- Create: `docs/design_2.0/2026-09-17-restored-world-style-bible.md`
- Create: `docs/design_2.0/assets/restored-world/clay-icons-pre-titanium.svg` (reference copy)

**Interfaces:**
- Produces: the single styling reference every re-dress task (2–8) reads. Sections: palette &
  materials per domain; card anatomy (poster: eyebrow + spot graphic + numeral); ring/gauge/
  sparkline treatments; celebratory polished-stone/gold; icon material recipe; AND "new
  components, old world" — the defined old-world treatment for GlassBox, BodyMap, the
  in-workout list, sticky TabBar (these never existed pre-Titanium; design them here ONCE).

**Steps:**
- [ ] Locate the recovery point: `git log --oneline --before=2026-09-12 -20 main` and tags ≤ v2.243; identify last pre-#630/#635 sha
- [ ] Extract deleted CSS families for reference: `git show <sha>:frontend/src/styles/prototype.css` → pull `.flog-*`, `.fh-logtile*`, `.fh-naplorow*`, `.khero-*`, `.trainhero*` sections into the bible (as annotated recipes, not raw dumps)
- [ ] Extract old icon art: `git show <pre-d302e941f-sha>:frontend/src/shared/ui/clay/clay-icons.svg > docs/design_2.0/assets/restored-world/clay-icons-pre-titanium.svg`; list the ~8 Titanium-only icons (fuel tabs, macros, glucose, i-info) that need old-material redraws
- [ ] Mine the Mozaik-era design docs (marked living again by Task 0) for material/motion rules; distill, don't duplicate — link
- [ ] Write the "new components, old world" section (GlassBox, BodyMap, in-workout list, TabBar) — this is the design-judgment heart of the task
- [ ] Self-review against spec kill-list: every Titanium visual has a defined replacement recipe
- [ ] Commit, local gates, --no-ff merge to main (no-wait flow)

### Task 2: Shell strip (bead: phase 2, model:strong, ~2 sessions, blocked by 1)

**Files:**
- Modify: `frontend/src/app/AppLayout.tsx` (remove `titanDark` route scope, ~lines 69–99)
- Modify: `frontend/src/app/AppHeader.tsx` (keep "Boop" wordmark, restore old header styling)
- Modify: `frontend/src/app/StartupSplash.tsx` + `.css` (restore pre-mezo-qducz splash look)
- Modify: `frontend/src/shared/ui/clay/clay-icons.svg` (old art + 8 redrawn icons)
- Modify: `frontend/src/styles/prototype.css` (delete `.titan-dark` scope + boop dark header
  sections; update `prototypeCssStructure.test.ts` in the same commit)

**Steps:**
- [ ] Remove `titanDark` computation and the `titan-dark` class from AppLayout; delete the `.titan-dark` prototype.css section + its structure-test entry together
- [ ] Restore header: old visual per style bible; wordmark text stays "Boop"
- [ ] Restore splash per pre-#643 reference (mine via `git show`), adjusted for the Boop name
- [ ] Icon merge: start from `clay-icons-pre-titanium.svg`, redraw the 8 Titanium-only glyphs in old clay material (style bible §icon recipe); verify every symbol id referenced in code still exists: `grep -rhoE 'clay-icons\.svg#[a-z-]+' frontend/src | sort -u` vs `grep -oE 'id="[a-z-]+"' clay-icons.svg`
- [ ] Tests both modes + `frontend/tests/layout/startup.spec.ts` + navigation.spec.ts
- [ ] `verify`-skill runtime pass: shell reads as old world on /nap, /fuel, /train
- [ ] Commit(s), local gates, --no-ff merge to main (no-wait flow)

### Task 3: Nav re-skin (bead: phase 3, model:fast, ~1–2 sessions, blocked by 2) — DONE 2026-09-18

> **Scope change, owner 2026-09-18.** The orphan measurement came back empty — **no page in the
> app lacks a menu path** (method and full classification: spec §"Nav orphans: the measurement",
> and the `mezo-ju4j6.4` bd comment). The 5th "Továbbiak" tab is therefore **dropped**: it would
> list nothing and narrow the bar on all five domains. The matrix stays 5×4. Task 3 is the nav
> re-skin alone. The *discovery-index* re-framing was offered to the owner and declined.

**Files:**
- Modify: `frontend/src/app/TabBar.tsx`, `DomainSwitcher.tsx` (old-world skin via
  `.tab-bar[data-domain]` / `.domain-*` rules ONLY; `navModel.ts` untouched)
- Modify: `frontend/src/styles/prototype.css` (nav section re-skin)
- Test: `frontend/tests/layout/navigation.spec.ts`; router redirect tests untouched

**Steps:**
- [x] Build the definitive orphan list: two passes over `router.tsx` (strict per-route link search incl. dynamic prefixes; transitive BFS from the nav tabs + `owns` + global chrome) → **0 orphaned pages**, 4 retired `<Navigate>` stubs; classification recorded in the bd issue
- [x] ~~Add 5th tab to navModel matrix~~ — dropped per the scope change above
- [x] ~~Továbbiak page~~ — dropped per the scope change above
- [x] Re-skin TabBar/DomainSwitcher; geometry changes only in `.tab-bar[data-domain]` — warm-graphite chrome, `--dv-` domain accents, glow dropped, switcher cards → §2.2 A wash tiles
- [x] Tutorial anchor check: `train-tabs` anchor untouched (`registry/train.ts:49`, `anchors.test.tsx:70` green)
- [x] Tests both modes (7303/7304 passed) + `test:layout` (91 passed); `verify` runtime pass
- [x] Commit, local gates, --no-ff merge to main (no-wait flow)

### Task 4: GlassBox re-skin (bead: phase 4, model:strong, ~1 session, blocked by 2)

**Files:**
- Modify: `frontend/src/shared/ui/mozaik/GlassBox.tsx` + its prototype.css section (`.gl-*`)
- Test: existing GlassBox/consumer tests stay green; add a layout assertion if none covers it

**Steps:**
- [ ] Implement the style bible §"GlassBox, old world" treatment on the component + `.gl-*` section (keep API/props identical — 21 consumers must not change)
- [ ] `grep -rln "GlassBox" frontend/src | wc -l` before/after — consumer files untouched
- [ ] Spot-check 3 consumers in `verify` runtime (one fuel modal, one train workout menu, finish-confirm)
- [ ] Tests both modes; commit, local gates, --no-ff merge to main (no-wait flow)

### Task 5: Fuel re-dress (beads: phase 5a–5d, first strong then fast, ~4–5 sessions, blocked by 4; 5b–5d also by 5a)

Sub-beads: **5a** FuelMaiPage (+ shared fuel patterns — the exemplar), **5b** LogFlowPage +
FuelMealScorePage + GlycemicGlass, **5c** FuelStackPage + FuelTrendekPage, **5d** FuelKonyhaPage.

**Files (per sub-bead):** the page components under `frontend/src/features/fuel/pages/` and
their prototype.css sections (`fmx-`, `st-`, `tk-` families). Logic (`features/fuel/logic/`)
and data (`frontend/src/data/fuel`) are OFF-LIMITS.

**Steps (pattern, each sub-bead):**
- [ ] In-session design pass: map the page's Titanium sections/classes; write the target treatment from the style bible (5a records the exemplar decisions in the bible's appendix for 5b–5d to copy)
- [ ] Re-dress markup classes + CSS section (rename Titanium section to restored equivalent; structure test updated same commit)
- [ ] Reverse parity checklist from `docs/design_2.0/2026-09-11-fuel-coverage.md` + `TITANIUM_FEATURE_COVERAGE_REGISTER.md` fuel rows: demonstrate each listed feature live in `verify` mock run; paste result into the bd issue
- [ ] Tutorial anchors grep for the touched pages
- [ ] Tests both modes; commit, local gates, --no-ff merge to main (no-wait flow)

### Task 6: Nap/Mai re-dress (bead: phase 6, model:strong, ~1–2 sessions, blocked by 2)

**Files:** `frontend/src/features/today/` Mai page components + `nap-mai titanium` and
`titanium companion` prototype.css sections; centered Clay Mezo icon from the restored icon set.

**Steps:**
- [ ] Design pass per style bible; keep the new layout structure, swap skin
- [ ] Center: Clay Mezo icon (restored art) — placeholder position for the Task 8 avatar (same slot, so 8 swaps the asset, not the layout)
- [ ] Parity from `docs/design_2.0/2026-09-10-nap-mai-coverage.md`; paste into bd issue
- [ ] Tests both modes + affected layout specs; `verify` pass; commit, local gates, --no-ff merge to main (no-wait flow)

### Task 7: Train re-dress (beads: phase 7a–7c, first strong then fast, ~3–4 sessions, blocked by 4; 7b–7c also by 7a)

Sub-beads: **7a** Train Mai + ActiveWorkoutPage + WorkoutDock/WorkoutMenuGlass/
FinishConfirmGlass (`wo-` sections — the exemplar), **7b** Terv + Terhelés (`pl-` etc.),
**7c** Gyakorlatok + sport + ceremony surfaces (`gy-`, `sp-`, `cer-` — ceremony returns to
polished-stone/gold per ceremony-pattern doc).

**Steps (pattern):** identical to Task 5's, with parity sources
`docs/design_2.0/2026-09-12-train-coverage.md`, `2026-09-16-train-parity-matrix.md`,
`2026-09-17-train-deep-parity-audit.md`. BodyMap keeps its geometry; skin per style bible
§"BodyMap, old world".

### Task 8: Boop avatar (beads: phase 8a asset, 8b integration; model:strong, ~2–3 sessions, blocked by 3 and 6)

**8a — asset creation (no repo code):** design the Boop character in bible-strong-avatar-lab
(AGPL-3.0 — assets-only decision: export SVG/PNG/animation frames or `.avatar.json`-derived
SVG; NO code/package linkage in the app). Produce 5 domain-color variants: kék Train, zöld
Fuel, narancs Nap, lila Boop/Mezo, piros Én; blink + idle micro-gesture. Store under
`frontend/src/shared/ui/clay/boop/` as SVG(s).
**8b — integration:** center slot of Nap/Mai (replacing the Task 6 placeholder icon),
bottom-left corner of the shell, and as the 5 domain glyphs in TabBar/DomainSwitcher
(color = domain). Blink animation via CSS/rAF with a reduced-motion branch.

**Steps (8b):**
- [ ] Wire the SVG assets; blink loop honors `prefers-reduced-motion`
- [ ] TabBar swap: domain glyphs → Boop variants; navigation.spec.ts still green
- [ ] Tests both modes; `verify` pass across all 5 domains; commit, local gates, --no-ff merge to main (no-wait flow)

### Task 8.5: Depth & focus sweep (bead: `mezo-ju4j6.19`, model:strong, ~2 sessions, blocked by 7c)

> **Found during Task 7b (2026-09-20).** Every slice's first pass turned *every* surface into a
> §2.2 A wash tile, and each time the screen read flatter than the Titanium one it replaced. The
> owner named it on the Terv/Terhelés prototype ("something was better in Titanium"). The rule is
> now style-bible **§3.4** and the `visszaoltoztetes` skill reads it every session; this task is the
> retro-fit for everything re-dressed before the rule existed.

**Scope:** rank the surfaces (no new materials, no DOM change) on Fuel Mai/LogFlow/MealScore/Stack/
Trendek/Konyha, Nap/Mai, Train Mai + the in-workout list, the Gyakorlatok/sport/ceremony surfaces,
and the shell (TabBar, DomainSwitcher, header). Terv + Terhelés (Task 7b) is the reference.

**Steps (per screen):**
- [ ] Name the ONE thing the screen says; that surface keeps the loud grade
- [ ] Demote the rest a grade (wash → house row → cell/chip); empty/free states go §4.4 dashed
- [ ] Give the hero's graphic real size (§3.2 numeral + its drawing), then check 320px
- [ ] Tests both modes + layout specs; `verify` pass; reverse parity checklist into the bead
- [ ] Commit, local gates, --no-ff merge to main (no-wait flow)

### Task 9: Close-out (bead: phase 9, model:fast, ~1 session, blocked by 5*, 6, 7*, 8*)

**Steps:**
- [ ] Tutorial/kalauz full sweep: every registry anchor resolves against the re-dressed DOM (registry tests + `verify` walkthrough)
- [ ] Delete any now-dead Titanium prototype.css sections + structure-test entries missed by area tasks; `grep -n "titan" frontend/src/styles/prototype.css` should return only intentional survivors (none expected)
- [ ] Close `TITANIUM_FEATURE_COVERAGE_REGISTER.md`: add reversal outcome note; docs lint via knowledge-base skill
- [ ] CODEMAP regen; final epic close: `bd close` children check, `node scripts/check-beads-backup.mjs --fix`, `bd dolt push`, git push
- [ ] Commit, local gates, --no-ff merge to main (no-wait flow); close epic

---

## Session driver

Fresh sessions run the `visszaoltoztetes` project skill (`.claude/skills/visszaoltoztetes/`):
it reads the spec + this plan + the style bible (if merged), picks the next unblocked epic
child via `bd ready`, claims it, executes it under the house gates, closes it, and reports
what's next. Owner-facing communication in Hungarian, business language, per CLAUDE.md.
