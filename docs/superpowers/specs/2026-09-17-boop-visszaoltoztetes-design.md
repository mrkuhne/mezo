# Boop visszaöltöztetés — Titanium visual rollback, functionality kept

**Date:** 2026-09-17 · **Status:** approved direction, pre-plan
**Owner decision:** the Titanium visual direction (~2026-09-09 → 2026-09-17) is rejected.
Return the app to the pre-Titanium design_2.0 visual world (Mozaik/Clay: dark living-material
ground, domain-color washes, clay 3D icons, polished-stone celebratory surfaces) while
**keeping every piece of functionality** shipped during the Titanium period. Nothing visual
survives from Titanium; everything functional does.

## Goal

Re-dress the current codebase (forward-fix), never revert it. The pre-Titanium tree is a
*reference* for the old look, not a restore target. Execution is stepwise: one feature area
per bd issue/branch through the house merge flow ("no-wait, net stays", AGENTS.md §Git
Workflow), so the app is shippable after every
step; a temporarily mixed look is accepted by the owner.

### Keep-list (functional, must survive untouched in behavior)

- Sticky/docked 5-domain navigation (`frontend/src/app/navModel.ts:41`, `TabBar.tsx`,
  `DomainSwitcher.tsx`; PR #676, mezo-0i5y6) — plus a NEW 5th menu item per domain surfacing
  every card/page unreachable from the new nav (see Phase 3).
- Entire rebuilt Fuel surface: `frontend/src/features/fuel/pages/` (FuelMaiPage, FuelStackPage,
  FuelTrendekPage, FuelKonyhaPage, LogFlowPage, FuelMealScorePage, GlycemicGlass…), logic in
  `features/fuel/logic/`, data in `frontend/src/data/fuel` (mezo-jb84 family, recipe scoring
  mezo-tm3sb, serving-unit mezo-6ezjv, window roles mezo-ud77t, glycemic chip mezo-ya2wp,
  macro-ring grams mezo-n9peo, time-box rings mezo-l2gp0).
- `GlassBox` centered modal (`frontend/src/shared/ui/mozaik/GlassBox.tsx`, mezo-88iwa.13,
  21 consumers: 9 fuel + 12 train) — the drawer replacement stays; it gets re-skinned only.
- Nap/Mai tab layout redesign (structure kept; skin + centered Clay Mezo icon change).
- Train: BodyMap/MuscleMap (`features/train/components/BodyMap.tsx`, mezo-88iwa.4), scrolling
  in-workout UI (`features/train/pages/ActiveWorkoutPage.tsx` + WorkoutDock/WorkoutMenuGlass/
  FinishConfirmGlass, mezo-88iwa.7), Terv, Terhelés, Gyakorlatok pages, overload honesty +
  Epley (88iwa.2/.3), train parity work (#669/#673/#674/#675).
- App rename to **Boop** (name stays; the dark Titanium header styling does not).
- All backend work of the window (untouched by the skin).

### Kill-list (visual, to be replaced by the old world)

- `titanDark` route scope: `frontend/src/app/AppLayout.tsx:69-99` (`.titan-dark` class on the
  phone shell for `/nap`, `/nap/gyors`, `/fuel/*`, `/train/*`).
- Titanium prototype.css sections: `titanium companion` (:11110), `nap-mai titanium` (:11180),
  fuel titanium (:11234–:12984), `.titan-dark` scope (:13036), boop dark header (:13184),
  `train mai titanium` (:13218), `.gl-*` glass primitive (:13454), and the `wo-`/`pl-`/`sp-`/
  `cer-`/`gy-` Titanium sections to EOF — replaced section-by-section as areas are re-dressed
  (line anchors are as of 2026-09-17 and will drift; re-locate by section markers).
- Titanium clay icon redraw (`frontend/src/shared/ui/clay/clay-icons.svg`, commit d302e941f,
  mezo-ve03) — restore pre-d302e941f art, re-draw the ~8 Titanium-only icons (fuel tabs,
  macros, glucose, i-info) in the old clay material.
- Titanium StartupSplash (mezo-qducz, PR #643) and boop dark header (mezo-xscdx, PR #636
  styling part).
- Titanium reward ceremonies' skin (mezo-6z0ai, 88iwa.8) — ceremony *pattern* per
  `docs/design_2.0/2026-09-15-ceremony-pattern.md` stays canon; surfaces return to
  polished-stone/gold material.

### Non-goals

- No behavior changes, no new features beyond the 5th-menu-item card index and the Boop avatar.
- No revert of any functional commit; `git revert` is used for nothing entangled (see Prior art).
- No re-tokenization project: reuse the existing DS token layers (prototype.css:1/:469) and
  per-section CSS conventions.

## Approach (approved: "A — two-beat re-dress")

1. **Beat 1 — global strip (cheap, early win):** remove the `titan-dark` shell scope, restore
   header/splash/clay icons. The app immediately reads as the old world at shell level.
2. **Beat 2 — strangler-fig per area:** re-dress one feature area per bd issue in order
   nav-orphans → GlassBox → Fuel → Nap/Mai → Train → avatar, each behind the normal CI gate,
   each closing with a **reverse parity checklist** (see below).

Rejected alternatives: (B) big revert + re-implement features on the old base — high risk of
exactly the feature loss the owner fears; (C) token-value swap only — the Titanium look is
baked into feature markup (poster-anatomy DOM + inline `fmx-/st-/tk-/tr-/wo-/gl-/cer-` class
families), tokens alone cannot revert it.

### Reverse parity checklist (the feature-loss guard)

`docs/design_2.0/TITANIUM_FEATURE_COVERAGE_REGISTER.md` recorded old→Titanium feature
coverage. Each area task inverts the relevant slice: before merge, every feature listed for
that area must be demonstrated present in the re-dressed page (runtime check via the `verify`
skill in mock mode + focused tests). The checklist result is pasted into the bd issue on close.
Phase 9 closes the register as a whole.

## Phases / bead breakdown

One epic (`boop-visszaoltoztetes`), children below, `blocked-by` as listed. Effort/model
guidance is advisory per task; "strong" = Opus/Fable with design judgment, "fast" = Sonnet
executing an established pattern.

| # | Task | Depends on | Sessions | Model |
|---|------|-----------|----------|-------|
| 0 | Rulebook flip: CLAUDE.md §Design direction, `docs/design_2.0/README.md` canon index (Titanium → superseded, restored world → living), `docs/features/_platform-design-system.md` staleness, `bd memories` audit for Titanium-mandating entries | — | 1 | fast |
| 1 | **Old-world style bible**: mine git history ≤ v2.243 (pre #630/#635, ~2026-09-12) for the deleted CSS families (`.flog-*` :3179-area, `.fh-logtile*`, `.fh-naplorow*`, `.khero-*`, `.trainhero*`), old clay icon art (pre-d302e941f), materials/colors/card anatomy; write `docs/design_2.0/2026-09-17-restored-world-style-bible.md` + extract old `clay-icons.svg` to an assets reference. Also define the old-world treatment for components that never existed pre-Titanium (GlassBox, BodyMap, in-workout list) | 0 | 1–2 | strong |
| 2 | Shell strip: remove `titanDark` from AppLayout, restore header (keep "Boop" wordmark) + StartupSplash, merge clay icons (old art + ~8 new icons redrawn old-material) | 1 | 2 | strong |
| 3 | ~~Nav orphans: 5th menu item per domain ("Továbbiak")~~ — **dropped, owner 2026-09-18** (see §Nav orphans: the measurement); re-skin TabBar/DomainSwitcher to old world; navModel stays frozen | 2 | 1–2 | fast |
| 4 | GlassBox re-skin (single component, 21 consumers inherit) per style-bible treatment | 2 | 1 | strong |
| 5 | Fuel re-dress: Mai → Stack → Trendek → Konyha → LogFlow → score/glycemic pages; one bead per page-group; reverse parity checklist from the fuel coverage docs (2026-09-11-fuel-coverage.md) | 4 | 4–5 | first strong, rest fast |
| 6 | Nap/Mai re-dress + centered Clay Mezo icon (nap-mai coverage doc as checklist) | 2 | 1–2 | strong |
| 7 | Train re-dress: Mai, ActiveWorkout (`wo-`), Terv, Terhelés, Gyakorlatok, ceremony/sport surfaces; parity from train coverage/parity-matrix docs | 4 | 3–4 | first strong, rest fast |
| 8 | Boop avatar: design in bible-strong-avatar-lab (AGPL-3.0 — **assets-only decision approved**: export SVG/PNG/animation data, no code linkage), 5 domain-color variants (kék Train, zöld Fuel, narancs Nap, lila Boop/Mezo, piros Én); integrate center of Nap/Mai, bottom-left corner, and as the domain glyphs in the nav | 2, 3, 6 | 2–3 | strong |
| 9 | Close-out: tutorial/kalauz anchor sweep (`features/tutorial/registry` anchors Titanium DOM), coverage-register close, docs lint, CODEMAP regen, delete now-dead Titanium CSS sections + their structure-test entries | 5, 6, 7, 8 | 1 | fast |

Total ≈ 17–23 sessions, 2–3 calendar weeks at a relaxed pace. Phases 5/6/7 are mutually
independent after their deps — parallelizable across sessions if desired.

## Master prompt / session driver

A project skill (slash command) `visszaoltoztetes` under `.claude/skills/`, created in the
writing-plans step. On invocation it: reads this spec + the style bible, runs `bd ready`
scoped to the epic, claims the next unblocked child, loads that bead's stored instructions,
executes through the standard gates (worktree, focused tests both FE modes, `--no-ff` merge
to main per the no-wait flow, CODEMAP regen, beads backup), closes the bead, and reports what is next.
Every bead's description must be self-contained (paths, checklist pointer, style-bible
pointer) so a fresh session needs no prior context.

## Error handling / traps

- `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` asserts section markers —
  CSS sections and their test entries move/die together, per task, never in bulk.
- GlassBox lives inside the mozaik kit: any "restore shared/ui from history" action is
  forbidden; icon restore is file-level (`clay-icons.svg`) with the new-icon merge.
- Tutorial registry anchors Titanium DOM — each area task greps `features/tutorial/registry`
  for its page anchors; Phase 9 sweeps the rest.
- FE tests in both modes (`VITE_USE_MOCK` unset = mock; CI=true for scoping); CODEMAP
  freshness gate after file moves; regenerate CODEMAP after every merge.
- prototype.css line anchors in this spec drift as sections are deleted — always re-locate
  by marker comments, not line numbers.
### Nav orphans: the measurement (mezo-ju4j6.4, 2026-09-18)

The 5th "Továbbiak" tab was planned on the premise that the retired Titanium funnels had left
pages reachable only by legacy URL. **Measured: that premise is false.** Two independent passes
over `router.tsx`'s 106 concrete routes — a strict per-route link search across `frontend/src`
(dynamic template-literal prefixes included), and a transitive BFS from the navModel tabs, their
`owns` prefixes and the global chrome — found **zero orphaned pages**. Everything that is
genuinely unreachable is a bare `<Navigate>` stub for a retired URL (`/mezo/weekly`,
`/me/growth/rutin`, `/me/routines/edit`, `/me/beallitasok/admin`), and every destination named in
the row above (`/fuel`, `/fuel/trendek`, `/fuel/stack`, `/fuel/stack/protocol`, `/nap`, `/mezo`,
`/mezo/karakter`, `/me/week`, `/mezo/patterns`) is a nav tab or reachable from one.

Owner decision (2026-09-18): **no 5th tab.** It would show an empty list and narrow the bar on
all five domains for nothing. Task 3 is the nav re-skin alone; the matrix stays 5×4. Do not
re-open this without a new reason — the *discovery-index* framing (a per-domain contents page for
beta onboarding) was offered and declined.

- Nav geometry changes go only into the `.tab-bar[data-domain]` rules (design-system doc
  §"Docked navigation").

## Testing

Per task: focused FE tests both modes + affected layout specs (`frontend/tests/layout`) +
`verify`-skill runtime pass + reverse parity checklist. CI on main-push is the post-merge safety net ("no-wait, net stays"); a red main is fixed
before any new work.

## Prior art

- **Rebrand-back via semantic tokens** (Webflow, Rangle): keep shipped components, port the
  old skin forward onto them — adopted as the core frame ("old look applied to new code").
  https://webflow.com/blog/theming-design-tokens ·
  https://rangle.io/blog/rebrand-and-scale-your-website-and-applications-with-design-tokens
- **Strangler-fig incremental cutover** (Microsoft): theme seam + one area at a time, each
  slice shippable — adopted as Beat 2. https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig
- **Selective `git revert`** (Atlassian): rejected for anything entangled; used only as
  read-only reference mining (`git show <old-sha>:path`).
  https://www.atlassian.com/git/tutorials/undoing-changes/git-revert
- **bible-strong-avatar-lab** (React 19/Vite/Motion, exports `.avatar.json` + SVG/PNG;
  AGPL-3.0): assets-only reuse approved by owner — no runtime code linkage.
  https://github.com/smontlouis/bible-strong-avatar-lab

## Codebase terrain

Investigator summary (2026-09-17): data/logic/hooks layers are skin-free; the Titanium look
lives in (a) the single `titan-dark` shell scope (AppLayout.tsx:69-99), (b) named Titanium
sections of `frontend/src/styles/prototype.css` (≈:11110→EOF), (c) inline Titanium class
families in feature markup — so markup and skin are one at page level and a token swap alone
cannot revert it. The mozaik kit is intact (and gained GlassBox); the clay icon set was
redrawn wholesale in Titanium material (d302e941f). Pre-Titanium Fuel/Train page families
(`.flog-*`, `.fh-logtile*`, `.fh-naplorow*`, `.khero-*`, `.trainhero*`) were deleted and
exist only in git history (≤ v2.243). Nav = frozen 5×4 matrix in `navModel.ts:41` with
redirect-only legacy funnels listed at `router.tsx:161` and :260/:383/:394/:455. Rule
contradiction: CLAUDE.md §Design direction and `docs/design_2.0/README.md` currently mandate
Titanium — Phase 0 flips them first or future agents re-apply Titanium by rule.
