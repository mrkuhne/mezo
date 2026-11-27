---
name: boop
description: Session driver for Boop, the native SwiftUI iPhone (+ Apple Watch) app (epic mezo-r36n9) — since the 2026-11-11 re-plan a STANDALONE, purpose-built personal coach (sleep, food, training, energy, reflection, one AI), not a port of the web app. Napkelte look (dark glass, painted sky, the rising orb), one-home spine Ma · Terv · Napló · Boop + "+", one voice (Boop), the original Mezo account, paid Apple developer team, visual iteration in the iOS Simulator (no HTML artifacts). Built in slices B0–B8 (repair, data foundation, spine, daily loop, food, training + Watch, the Plan, day capacity, one AI) on top of shipped S1–S3. Several sessions may work on Boop in parallel; this skill holds the ownership rules that keep them apart. Use when the user invokes /boop or asks to work on Boop / the iPhone app / the Watch app / iOS / the simulator / the Napkelte look.
---

# Boop session driver

The owner opens a fresh session, types `/boop` and says what to work on (usually "the next slice"). You load
the context below, claim the work, and run it to the end without extra check-ins. **Talk to the owner in
Hungarian, business language** (CLAUDE.md §Communication) — no file names, no jargon in questions.

## 1. Start of every session (in this order)

1. `gh run list --branch main --limit 1` — a red main outranks everything (AGENTS.md).
2. `git fetch && git checkout --detach origin/main` in your worktree, then `bd prime`.
3. **See who is working on what:** `bd list --parent mezo-r36n9 --status in_progress` and read each
   issue's description — the **"Owns:"** list is that session's files. You may not edit them.
4. Pick the slice (`bd ready | grep r36n9` — §6 has the map) or create an issue under `mezo-r36n9`, write its
   **Owns:** list (paths/globs) into the description, then `bd update <id> --claim`. If what the owner asked
   overlaps an owned path, say so in Hungarian and offer a non-overlapping alternative or to wait.
5. Read what your task needs (don't read everything):
   - **the product spec:** `docs/superpowers/specs/2026-11-11-boop-standalone-design.md` (spine §3, reuse map §4,
     slices §5, risks §7) and the owner decisions log `docs/superpowers/research/boop-standalone/14-decisions.md`
   - **the current-state research** for your slice's area: `docs/superpowers/research/boop-standalone/NN-*.md`
     (the slice issue lists which), synthesis `13-synthesis.md`
   - how the shipped app works: `docs/features/boop-ios.md`; build/test/install: `ios/README.md`
   - the owner-facing Hungarian handbook of every feature: `docs/boop-handbook/` (mirrored to his Notion, §5)
   - the look: Napkelte spec `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md` (§4 look, §5 screens —
     its five-domain bar/page skeleton is superseded by the spine), kit `ios/BoopKit/Sources/BoopDesign/Napkelte/`,
     executable reference `docs/design_2.0/prototypes/boop-ios-spike/Aura*.swift` (`Lagy*.swift` is dead);
     **photos: `docs/superpowers/specs/2026-11-13-boop-kepek-design.md`** — read it before any screen work
   - data/backend background still valid: `docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md` (data, §4)

## 2. Owner decisions — do not re-litigate

- **No plain text-and-list pages** (2026-11-26, `mezo-r36n9.177`, owner: „puritán és béna”). Every screen needs
  visual hierarchy and its own graphics: a hero element, glass cards, a mini graphic showing the thing's shape
  (week curve, ring, body map, time strip), carousels. All-rows lists only for search/settings-like pages. Applies
  from the FIRST spike round. **Never propose the „kevés kártya, sok egymondatos tény” / no-card direction again**
  (#119, 2026-11-27, `mezo-r36n9.184`, „egybefolyik, nincs vezetve a szemem”) — it is retired for every screen. Anything he can start or overwrite opens for review first; actions sit at the bottom.
- **Standalone, not a port** (2026-11-11). Boop reuses the backend's engines (goal engine, gym progression,
  meal scoring + AI draft, check-in, journal, sleep log, chat platform) and **hides** the web clutter
  (gamification, quests, titles, habits, needs rings, activity, medication (the supplement stack is kept, simplified), life goals, tutorial,
  team wall, Gépterem). Hide = no Boop API/screen; do not delete backend tables. The web app is not developed for
  Boop's sake.
- **The spine** (2026-11-11): one home **Ma** (Reggel plan → Napközben timeline + proposal cards → Este close
  <60 s), bottom bar **Ma · Terv · Napló · Boop** + global **`+`**; sleep/food/training/energy are identical
  rooms opening on one skeleton (verdict → level/graph → the days behind it → actions); **Étel and Edzés are full
  apps inside the spine** with inner top tabs and the feature lists of spec §3.1. **Nothing changes without the owner's tap**;
  every proposal has **"miért?"**.
- **One voice: Boop** (2026-11-11). Domain experts (Alvás, Mozgás, Étkezés, Közérzet, Szkeptikus) appear only as
  short labelled lines inside "miért?". No visible team, no expert pages. The companion is **Boop**, never
  "Mezo", in every user-visible string. The orb is Boop's face.
- **The original (web) account** is Boop's only account (2026-11-11); the Boop account's data migrates into it in
  B1 (production write → per-change owner OK + rollback plan).
- **Paid Apple Developer Program** (2026-11-11; the team arrives ~2026-11-25 — treat it as **still pending until the owner says it is active**; follow-up `mezo-r36n9.19`): background HealthKit delivery, APNs,
  watchOS app, no weekly reinstall. Until then the free team rules in §3 apply.
- **Order** (2026-11-11): repair → data foundation → spine → **daily loop** → food / training + Watch → the Plan →
  day capacity → one AI.
- **Napkelte is the look** (2026-11-10): dark glass, painted sky per page, colour only in sky + orbs, white type,
  serif headlines / Outfit numbers / mono labels, the orb rising as the sun, mini orbs as a lens, icon-only bottom
  bar, "Készenlét" is called **Forma**. Never emoji; no SF Symbols except chevrons/arrows.
- **Photos: "a photo in the sky, a photo on the card"** (2026-11-13, round B3/b, spec
  `docs/superpowers/specs/2026-11-13-boop-kepek-design.md`). Every page and room head carries a quiet nature photo
  (one fixed photo per hue) under that hue's own sky gradient; proposal cards, day stations, Napló days and plan rows
  carry a photo of the thing they are about. Nothing in between: no photo on numbers, orbs, charts, tiles, buttons or
  on a row that is a moment rather than a thing. Tone every photo (saturation 0.8, brightness −0.06), gradient over
  it before any white type, glass stays over the photo, and every screen must still be right with no photo at all.
  Mood photos are CC0 library; food/training use the owner's own where they exist (storing his meal photos is a B4
  decision). The blurred-photo ground ("C") is rejected — do not reintroduce. Applying it to shipped screens:
  `mezo-r36n9.36`.
- **Simulator first**: visual iteration in Xcode + the iOS Simulator; no HTML artifacts for Boop. A new screen gets
  a throwaway simulator spike and the owner's OK before it is built.
- Google Calendar via the iPhone's calendar (EventKit), **read-only**. Action buttons move things in Boop's plans,
  never the calendar. One repo — Boop lives in `ios/` next to the backend.
- After the owner OKs a plan he does not want another visual round: build → gates → review → merge → deploy (if
  backend) → install → live check → Hungarian report.

## 3. Parallel sessions — the rules

- **One session = one issue = one feature branch** in its own worktree.
- **Never edit another in-progress issue's "Owns:" paths.** Shared hot spots, one writer at a time:
  - `ios/Boop.xcodeproj/**` (project file — two writers corrupt it; file-system synchronized groups mean new Swift
    files need **no** project edit; a new **watchOS target** or extension does — B5 owns it then),
  - `ios/BoopKit/Package.swift`, `ios/BoopKit/Sources/BoopAPI/**` (generator filter + synced contract),
  - `api/openapi.yml` and `api/generate/merge.yml`, `backend/src/test/.../support/ResetDatabase.java`,
    `AbstractIntegrationTest` imports, the Liquibase `1.1.0_master.yml`.
  If you need one of these and another session owns it, stop and tell the owner.
- **Your own simulator**: never use another session's device. Create one per session and boot it:
  `xcrun simctl create "Boop · <issue-id>" "iPhone 17 Pro Max"` → `xcrun simctl boot <udid>` →
  `xcrun simctl install/launch <udid> …`, and pass that device to the simulator tool. Delete yours at the end
  (`xcrun simctl delete <udid>`).
- **Phone install is exclusive**: only the session that ships installs (`ios/scripts/install-on-phone.sh`); say so
  before running it. On the free team: 3 sideloaded apps and 10 App IDs a week — never create new bundle ids. After
  B1 moves to the paid team, bundle ids are re-registered there once (B1 owns that).
- **Merging is sequential**: `git fetch && git rebase origin/main` right before the local `--no-ff` merge (detached
  HEAD, `git push origin HEAD:main`), regenerate `docs/CODEMAP.md` after the merge, re-run the tests you own. If
  main moved under you, rebase again — never force-push main.
- **After every push to main, fast-forward the primary checkout's `main`** — new sessions' worktrees are cut from it:
  `P=$(git worktree list --porcelain | awk 'NR==1{print $2}'); git -C "$P" fetch -q origin &&
  [ -z "$(git -C "$P" status --porcelain)" ] && git -C "$P" merge --ff-only -q refs/remotes/origin/main`
  (skip with a note to the owner if that checkout is dirty or not on `main`).
- Close or update your issue and run `node scripts/check-beads-backup.mjs --fix` before you end.

## 4. Environment facts

- `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` (xcode-select points at the CLT).
- Build/test commands, launch arguments and the DEBUG `-preview onboarding|shell` switch: `ios/README.md`.
- Paid-team switch: `touch ~/.config/boop/paid` makes `install-on-phone.sh` sign with `Boop-Paid.entitlements` (push); never before the paid team is active.
- Team id lives in `~/.config/boop/team` (never commit it; `git grep DEVELOPMENT_TEAM ios/` must be empty).
- **LuLu firewall on the Mac blocks network calls from the ad-hoc signed simulator app** (simulator Safari and host
  tools work). Test live calls on the phone or with stubbed transports; don't change the owner's firewall.
- Simulator tool screenshots can be several actions stale — use `xcrun simctl io <udid> screenshot`. SwiftUI
  presentations must sit at page level and the page must read the flag (`boop-ios.md` §9); `@SceneStorage` restores
  the last tab on relaunch.
- Production DB reads are free, writes need the owner's explicit OK per change (CLAUDE.md).
- Device launches from a locked phone fail harmlessly; ask the owner to unlock and open the app.
- Prod health issues found at re-plan time (memory embeddings failing since 2026-10-21, nightly konzílium failing)
  were fixed and deployed in B0 (v2.402.0, 2026-11-11); memory now embeds on OpenAI. Check B0's issue for the
  overnight verification before building on memory or konzílium output.

## 5. How work is done

- **Flow = `munkamenet` skill + its `playbook.md`.** A B-slice (B5–B8 size) follows playbook §5: one slice map
  (owner OK once), then one step per fresh session, each merged, with the handoff in the next step's bd notes — never
  one multi-day session or a long-lived coordinator session. Bugs §3, new screens §4, server-into-app §6.
- Every slice opens with a short brainstorm (`superpowers:brainstorming` + `brainstorm-recon`; the research report
  for the area is the recon's head start), a **simulator spike** when anything new is seen, then a plan in
  `docs/superpowers/plans/` with a *Kész, ha…* list (owner OK) → execute inline (`superpowers:executing-plans`;
  subagent-driven only opt-in for a large plan of independent tasks — sonnet dispatches, no per-task reviewers;
  flow in the `munkamenet` skill, CLAUDE.md §Token diet).
- TDD for logic (`BoopCore` models with `StubTransport`, builders as pure functions); screens build from the
  Napkelte kit in `BoopDesign/Napkelte/` and the approved spike. Logic that lives only in the web frontend moves to
  the backend when more than Boop's display needs it (spec §4), otherwise to Swift — never duplicate it in both.
- Backend changes follow `docs/features/_platform-api-backend.md` §7 (contract first, Liquibase in `1.1.0/`,
  ArchUnit, ResetDatabase + populator) and the focused-IT command with `-Dmezo.test.use-testcontainers=true` plus
  `ArchitectureTest`.
- Final fresh-context review on the most capable model, fix Critical/Important with failing tests first, file minors
  under the epic, update `docs/features/boop-ios.md`, the feature index row, the roadmap row + milestone entry, and
  the §6 block below.
- **Keep the owner's Notion "Boop" space true (mandatory, every slice and every state change).** It is his
  Hungarian ticket board + handbook + decision and release log — a one-way mirror of bd and `docs/boop-handbook/`
  (driver: the `boop-notion` skill). When you **claim** an issue: add/refresh its row in
  `docs/boop-handbook/_jegyek.json` (Hungarian title, *mit kapsz*, `munkamenet` = your session name) and sync, so
  the board shows it as *Épül*. When it moves to review / waits for deploy / waits on the owner: `bd label add <id>
  allapot:ellenorzes|elesitesre-var|var-rad` (it rides the next push). **Push at most twice per session** — once
  after the claim, once at report time — and always through a fresh `sonnet` worker, never Notion MCP calls in the
  main session (`boop-notion` §2; token diet, mezo-hsc75). **At report time:** close/relabel the issue, add the merge to
  `_kiadasok.json`, any owner decision to `_dontesek.json`, update the handbook pages of every feature you added,
  changed or cut (state, how it works, settings, data tables), then dispatch the sync worker (plan → apply →
  `check` exits 0), and commit `_notion-state.json` with the slice. No Notion tools in the session → file a
  `notion-sync` bd issue under the epic instead of skipping silently.
- Report to the owner in Hungarian: what he can now do, what was checked, what is not done.

## 6. Where things stand (update this block when a slice ships)

**Shipped base (S-slices, 2026-11-09/10):** S1 alap (auth, onboarding, shell, install; `mezo-r36n9.1` minors) ·
S2 adatok (Health 60-day backfill + calendar → backend `wearable`; `mezo-r36n9.4`) · S2.5 Napkelte look
(`mezo-r36n9.6`) · S3 reggel (backend `boop` brief, Mai, sheets, A napom, voice, evening/kímélő, bedtime reminder,
v2.401.0; `mezo-r36n9.8`). **S4 lépések is cancelled** — its parts live in B3/B4.

**Re-plan 2026-11-11** (`mezo-r36n9.9`, research `docs/superpowers/research/boop-standalone/`):

| Slice | Issue | State | Can start |
|---|---|---|---|
| B0 Javítás — memory + konzílium repair (backend) | `mezo-r36n9.10` | deployed v2.402.0 (2026-11-11): embeddings on OpenAI, re-embed backfill running, nightly-pass + quota + fact-merge + retriever fixes, 2 new admin alerts; overnight prod check 2026-11-12 08:00 | done when the check passes |
| B1 Adatalap — wide Health, sources, background, merge scripts | `mezo-r36n9.11` | shipped 2026-11-11 (free team; paid items → `mezo-r36n9.19`; account merge run in prod 2026-11-11, phone on the original account; sleeping HR not filled yet → bug) | done |
| B2 Gerinc — Ma · Terv (Évad since B6 S1) · Napló · Boop + `+`, proposal card, drill-down | `mezo-r36n9.12` | **shipped 2026-11-11** | spine bar, Ma one-scroll (Reggel plan, Napközben MOST proposals, Este frame), five rooms, capture/account sheets, Terv/Napló/Boop frames |
| B3 Napi ritmus — check-in + snapshot, goal, journal, evening close, basic chat | `mezo-r36n9.13` | **shipped 2026-11-12** (offline-first Outbox/DayLedger/RitmusClient, backend `dayclose`; widget + answer-from-notification gated on the paid team `mezo-r36n9.19`; cleanup `mezo-r36n9.26`) | B4/B5 can build on `RitmusEnvironment` (ledger → outbox → flush; add an `OutboxKind` + a `RitmusClient` operation for food/training captures), the Napkelte `Ritmus.swift` kit, `RitmusRouter` covers + local-reminder planner, the per-user storage folder, and the idempotent `clientRef` write pattern; B7 gets weeks of check-in dots + snapshots as calibration data |
| B4 Étel — native capture, allergens, day budget | `mezo-r36n9.14` | **shipped 2026-11-13** — the Étel room Ma · Receptek · Kamra · Hét; offline-first meal capture (photo / text / barcode / recipe / pantry / usuals) over the shared B3 `Outbox` (`OutboxKind.mealDraft`, confirmation card, `clientRef` + `capturedAt` with the phone's offset); server-side day plan (`GET /api/fuel/plan/{date}`) + usuals; sensitivity profile (`GET/PUT /api/sensitivity`) + EU-14 allergen states + OFF allergens + barcode-keyed catalog; stored meal/recipe photos (`stored_image`, ETag); recipe import (URL / photo / text) with per-ingredient review; settings, skip + kímélő, supplement editor; food rows on Ma, meal photos in Napló. Needs a hands-on phone check: live barcode scan, camera permission, Fotó camera. Docs: `docs/features/boop-ios.md` §2 *The Étel room* | **B5 is next** (B4 left the room's four-tab `NKDrillPage` + `NKCapsuleTabs` and the `FoodClient`/`PreviewTransport` pattern for Edzés to copy); B6 now has the sensitivity rules and the server day plan to build the diet plan on |
| **Kezdőlap + útvonalterv** — the ring of eight area orbs is the app's entrance, and the day page behind it is the Élet spike's Ma | `mezo-r36n9.47`, `.51`, `.55`, `.56` | **shipped 2026-11-16** | the ring (`ios/Boop/Kezdolap/`) — Nap · Alvás · Étel · Edzés · Energia · Forma · Pénz · Levél, the day's own orb at the top filling with how full the day is (#41, the ring is now full at eight) — Boop's orb in the middle opening Ma, the fog-arrival / zoom-into-the-orb / fade-back motion with still branches, and the map it settles: the bar keeps four places and **Terv becomes his plan, not an area menu** (overturns life-dashboard decision #3). Decisions #32–#33; spec `2026-11-13-boop-kezdolap-design.md` |
| **L0 Közös területváz** — one frame every area is built from | `mezo-r36n9.37` | **shipped 2026-11-16** | `BoopDesign/Napkelte/{Area,AreaBlocks}.swift`: `NKAreaPage` + the blocks, warm treatment, per-block loading/failed, staleness, four-way rows, `NKAreaSubPage`. Covers B5's seven requirements. **Étel is moved onto it** as the proof. `-previewKit YES` shows every block |
| B5 Edzés + Watch — player, Live Activity, watchOS | `mezo-r36n9.15` | open | **next** — build the Edzés room on the L0 kit and register a `WallSource` so it joins the Ma wall; Terv's inner tab may be renamed Blokk (owner asked, answer pending) |
| **Blokképítő + heti átnézés** — Edzés → Blokk: the builder (Izmok · Napok · Blokk on the server evaluator) and the weekly review deck | `mezo-r36n9.83` | **shipped 2026-11-19** | code `ios/Boop/EdzesTerv/` + `BoopCore/Train/{PlanTransport,PlanWire,PlanClient,BlockDraft,WeekReview,BlockBuilderModel}` — a hand-written lenient JSON client (`Session.raw`), not the generator; server op `PUT /mesocycles/{id}/settings` (style, techniques, per-run review mode). Next: `mezo-r36n9.84` technique + challenge in the player (after T3) |
| **Indokolt csere + Mi van a termemben** — slice 1 of personalised exercise selection; feedback answers sent 1-based (`.67`) | `mezo-r36n9.66` | **shipped 2026-11-19** (v3.15.0/.1; not yet installed on the phone) | server `GET …/exercises/{exerciseId}/substitutes` (pure `ExerciseSubstituteRanker` + `SubstituteReason`, tiers role (muscle, type) → discomfort → fit (pattern, overlap) → goal → trackability — discomfort moved above fit 2026-11-20, #58), `gym-profile`, `…/discomfort`; catalogue `gear` (multi-valued kit list — `equipment` is the older single kind); iOS `Edzes/{SwapSheet,GymSettings}.swift`, `BoopCore/Train/{GymProfile,SwapList}.swift`, `EdzesStore.gym` is the one gym source. Open: `.111` (owner decision: should discomfort outrank plan-role overlap), `.112` hardening; slices 2–5 need their own spike + plan |
| **Napi gyakorlatszerkesztő** — Edzés → Blokk → Napok: reorder, add (muscle chips, ≤5 reasoned suggestions), swap, delete + undo, per-exercise settings, locked running day | `mezo-r36n9.116` | **shipped 2026-11-20** | server `POST …/mesocycles/{id}/exercise-suggestions` (`BlockSuggestionService`), 409 `TRAIN_DAY_WORKOUT_RUNNING`; iOS `EdzesTerv/{BlockBuilderPage,DayEditSheets}.swift`, identity-aware `BoopCore/Train/BlockDraft`. Next: `mezo-r36n9.114` coverage hints reuse add |
| **Tervajánló S1+S2** — Edzés → Új blokk: Alapok (hetek, perc, szintek az évad napjaira) · 2–3 hibátlan felosztásjelölt (vagy „nem fér” + javítások) · létrehozás + indítás, a builder „Mégsem, eldobom”-mal; builder: „miért?” lap, heti keret + percválasztó, egylépcsős emelés | `mezo-r36n9.113` | **S1+S2 shipped 2026-11-21** (v3.29.0, merge `08d505bf4`; phone install pending) | server `POST /meso-plans/candidates` (`MesoPlanCandidatesService`, pure `CandidateRanker`, `SplitCatalog`, `TierBudget`, `WarmupRule`), `split`/minutes on generate, `POST /mesocycles/{id}/discard`, minutes model v2, Tartás starts at band low; iOS `EdzesTerv/UjBlokk/**`, `MuscleWhySheet`, `BudgetLine`, `BoopCore/Train/NewBlockModel`. Next: S3 éves térkép + S4 követés (spec `2026-11-20-boop-eves-terv-design.md`, spike `spike/boop-eves-terv`); minors `mezo-r36n9.134` |
| **Éves terv S3+S4** — Edzés → Éves terv: létrehozás-előnézet · 52 hetes térkép (blokkok, könnyítő hetek, tartalék, 2 hetes lezárás, „itt tartasz”) · blokk lap (fókusz, időpont, sorrend, kihagyás) · év összegzés + Jövő évi terv; Következik kártya az Edzés Ma-n, előre kitöltött új blokk (kezdés: a tervezett nap / Jövő hétfőn / Ma); a tervezett blokk a saját napján elindul, az évad a tényleg elindult blokkot követi | `mezo-r36n9.113` | **S3+S4 built on `feat/boop-eves-terkep`, ships with the merge** (phone install pending) | server `/api/train/year-plans/**` (`YearGenerator`, `YearSchedule`, `YearRules`, `YearReconciler`, `PlannedBlockStarter`, `YearPlanLinker`), `MesocycleStarted` → `SeasonBlockLinkListener`; iOS `EdzesTerv/EvesTerv/**`, `Edzes/KovetkezikCard`, `BoopCore/Train/{YearPlanWire,YearPlanModel}`, DEBUG `-previewEvesTerv…` / `-previewKovetkezik`. Minors `mezo-r36n9.134` |
| B6 Évad (was „A Terv”) — the season: goal + block + slots + sleep need, live consequences, menu, list, experiments | `mezo-r36n9.16` | **S1 shipped 2026-11-20, S2–S4 shipped 2026-11-21 — B6 done** — S4: experiments — `season_experiment`, pure `ExperimentEvaluator` (equal-length baseline, 70 % marked gate, Cliff's δ ≥ 0.33 with ≥ 5 days a side, overlaps), `SeasonMetricsPort.experimentSignals` (7 keys), `ExperimentService` (one running, `EXPERIMENT_*`), `ExperimentProposalDetector` (`SeasonExperimentSourcePort`), `SeasonExperimentJob` 04:40, kept = `[Évad]` rule line, proactive `experiment-job` off; iOS `Evad/{EvadEffectTab,EvadExperimentPage}` + `BoopCore/Evad/EvadExperiment*`, proposal `.improves` „Indulhat” + result `.happened` wall cards. S3 (v3.28.0): the weekly menu + shopping list — `season_menu_week/meal`, `shopping_list/item`, `season_staple`; pure `MenuPlanner` over `DayPlanService.skeleton` (allowed recipes only, scaled portions, 3-day dinner rule, sport-day snack, seeding/repeat), `MenuJob` at the season's menu day, swap/approve, approved meals = the room's suggestions (meal-owned `SeasonMenuPort`, guarded by window size + still-allowed), refit after commit, `ShoppingListBuilder`; iOS `Evad/{EvadMenuTab,EvadListTab}` + `BoopCore/Evad/EvadMenu*`, the `.expires` menu wall card; prod has 0 allowed recipes until he picks them. S2: `AdherenceService` + `GET /api/seasons/adherence` (the single day judgement; the Étel Hét tab reads it, its local rule is the offline fallback), `SeasonInsights` (learned expenditure, short-night intake, guard) + the `sleep_food` number, `SeasonContextRenderer` `[Évad]` lines in the chat snapshot / morning brief / meal coach via three consumer-owned `SeasonContextPort`s + `get_season` (`overview`/`rules`), the `evad` `WallSource` (`BoopCore/Evad/EvadWall.swift`); known limitation: planned sessions read today's schedule. S1: backend `feature/season` (season / allowed recipes / revisions, no-persist preview through the goal engine's draft overload + SHA-256 fingerprint, lifecycle, sleep-need rule, overview read model, the `SEASON_REQUIRED` block gate behind `mezo.season.mesocycle-gate.enabled`, gym days locked while the block runs); iOS `ios/Boop/Evad/` + `BoopCore/Evad/` (the spine's second place is Évad; Évad tab, Módosítás, Szabályok, Új évad, empty state, `ServerCache` `evad/overview`). Docs `docs/features/season.md`. Follow-ups `mezo-r36n9.122` (one accept moves the block too, after `.116`), `.123` (Korábbi évadok, current weight in Új évad), `.124` (ThreadLocal draft energy → parameter) | B7 can build on the season (decision: B7 connects to Évad). Minor follow-ups `mezo-r36n9.132`, `.122`, `.123`, `.124` |
| B7 Napi kapacitás — calendar scoring, units, live adjust | `mezo-r36n9.17` | open | after B6 (needs weeks of B3 data) |
| B8 Az egy AI — memory corpus, day council, horizons | `mezo-r36n9.18` | open | after B7 + B0 |

**Életpanel (L-slices, owner 2026-11-13, `mezo-r36n9.33`):** Boop grows into a life dashboard — daily mail digest
and the owner's finances, with one AI over everything. Spec
[`2026-11-13-boop-life-dashboard-design.md`](../../../docs/superpowers/specs/2026-11-13-boop-life-dashboard-design.md),
research `docs/superpowers/research/boop-life/`, executable look: the Élet spike (`-elet YES`, `elet-*.png`).
**The B order is unchanged — nothing here starts before B6 ships, except L0.**
Owner decisions: money and mail are rooms, not a fifth bar button · **Terv is the home of the areas** · an area is
its own app (own top tabs with badges, built from the shared area-page kit) · **warm is the look** (photo heads,
the hue on key numbers; its *no card* part is RETIRED — #119, 2026-11-27) · **Ma is a living wall, not a timeline**,
and the **0–100 score leaves the home** · area names are Alvás, Étel, Edzés, Energia, Forma, Pénz, Levél ·
never ask him for a password.

| Slice | Issue | State | Can start |
|---|---|---|---|
| L0 Területek otthona → **the shared area-page kit** | `mezo-r36n9.37` | **shipped 2026-11-16** | scope changed: the ring took Terv's "home of the areas" job, so L0 is the kit (see the B table) |
| **A hátralévő szakaszok újranézése a kész felület ellen** — spec §5.1 widened: B5 fills the Edzés page's three empty tabs (the player stays a full-screen cover), B6/B7/B8 lose the card surface, the notification policy and the "miért?" to the wall, L1–L5 fill the Levél/Pénz pages that already exist (two stale tab lists corrected). Four rules bind every later slice: no second card surface, no second notification policy, no second explanation, no invented number | `mezo-r36n9.58` | **done 2026-11-16** | — |
| **A területek saját oldalai** — rebuilt against the Élet spike after the owner rejected v1: every area has **its own bottom bar** (`NKAreaBar`) with the spike's tab set and badges, the spike's left-aligned head, and the spike's blocks (`NKList`, `NKNote`, `NKActions`, `NKInfoRow`, `NKNotLiveYet` added to the kit). Pénz and Levél have pages with no data (`Hue.penz`, `Hue.level`). Code: `Nap/AreaRoom.swift` (replaces `MaDrill`) | `mezo-r36n9.57` | **shipped 2026-11-16** | next: `.58` the B4→B8 review against the new look |
| **A nap oldala** — the day page = the Élet spike's Ma (one scroll: Mai nap curve with the day's pins · Most · folds · Amit ma észrevettem · Este); no orb ribbon, no phase tabs, no big rising orb (owner, 2026-11-16). Pins: `BoopCore/Morning/DayMoments.swift`, `EnergyCurveCard(events:)` | `mezo-r36n9.56` | **shipped 2026-11-16** | next: `.57` every area's own page from the same spike, then `.58` the B4→B8 review against the new look |
| L0/b Ma · az élő fal | `mezo-r36n9.45` | **shipped 2026-11-16** | three fixed roles (#34), only `.expires` may ring twice a day (#35), areas join via `WallRegistry`. Engine `BoopCore/Morning/{Wall,WallSources}.swift`, weights `BoopDesign/Napkelte/Wall.swift`, wiring `ios/Boop/Nap/MaWall.swift`. `-previewWallEmpty YES` shows the quiet wall |
| L1 Levél · alap — IMAP intake, redaction, schedule, no AI | `mezo-r36n9.38` | **built 2026-11-21, one release with L2** (branch `feat/level-posta`; deploy + phone install pending at time of writing; `docs/features/mail.md`) | server `backend/.../feature/mail/` (`MailRunner`/`MailJob` 08:00+15:00, `service/{imap,redact,rules}`, read-only IMAP of a mirror Gmail — since 2026-11-25 the mailbox is reached via Google sign-in to his own Gmail (Gmail API, `service/google/`), IMAP kept but unused; AES-GCM credential, tables `mail_*`), contract `api/feature/mail/mail.yml`; switches `mezo.mail.enabled` + `mezo.techcore.cron.mail-job.enabled` (both OFF until deploy), env `MEZO_MAIL_SECRET_KEY` |
| L2 Levél · összefoglaló — the daily digest with 1–10 scores | `mezo-r36n9.39` | **built 2026-11-21, one release with L1** (same branch) | server `MailDigestService`/`MailDigestQuery`/`MailLearning` (rules → cheap model, three slugs, per-day cap 0.15 USD, fail-closed screen); phone `ios/Boop/Level/` + `BoopCore/Level/`, the first wall source from a life area (`levelWallCandidates`) and the wall's ring `ios/Boop/Nap/WallNotifier.swift` (cap 2 per fire day, 08:00–21:00, scheduled only at app open until the paid team's server push `mezo-r36n9.19`) |
| L3 Levél · figyelt termékek és árellenőrzés | `mezo-r36n9.40` | open | **Can start** (L1+L2 are built; wait for their deploy to have real deals): the price check builds on `PenzHttpFetcher` (the SSRF-guarded, allow-listed fetcher, `docs/features/penz.md` §3.8) and on `mail_item` deals; **10 checks a day is already decided** (owner 2026-11-21, do not re-ask); the *Figyelt* tab is still `NKNotLiveYet` and the Ma highlight must not claim a price comparison until L3 ships |
| L4 Pénz · adatalap — allowance engine, bank-SMS capture, amount guard | `mezo-r36n9.102` | **shipped 2026-11-19** (backend only, `docs/features/penz.md`) | done |
| L5 Pénz · a terület | `mezo-r36n9.103` | **shipped 2026-11-20** (merge `f44693781`; server savings goals v3.16.0; phone install waits for the cable) | `ios/Boop/Penz/` + `BoopCore/Penz/` (hand-written lenient client over `RawJSONClient`, store cached in ServerCache `penz/snapshot`, pure builders in `PenzLogic`), `OutboxKind.penzExpense` (cash, `clientRef` = item id, `PenzTriggers` in RootView keeps the store in step app-wide), `NKBare(glyph:)`, a read-only Pénz card on Terv. Gyakorlás is `NKNotLiveYet` (Pénzem shipped in L6) |
| L6 Pénz · portfólió és hírek | `mezo-r36n9.104` | **shipped 2026-11-20** | server: holdings by sleeve + FIFO lots + events (`penz_holding`, `penz_invest_txn`, `penz_holding_event`), the Yahoo quote cache behind the allow-listed SSRF fetcher `service/net/PenzHttpFetcher`, the valuation policy (price vs currency split), the news poller `PenzNewsJob` (06:30/13:30, two switches, own single-thread executor) → `PenzDigestService` (deterministic match/cluster/figures, one LLM narration, `DigestValidator` by the four-error taxonomy + boundaries, fixed fallback copy), provider health → `mezo_penz_provider_fail_streak` → vmalert. iOS: Pénzem, the digest at the bottom of Ma, `NKNewsCard` (`Napkelte/News.swift`), the analysis `NKAreaSubPage`, the record-investment and event sheets. Build notes `docs/superpowers/plans/2026-11-20-boop-penz-l6-build.md`. Next: L7 below |
| L7 Pénz · gyakorlás és javaslatok | `mezo-r36n9.105` | **built 2026-11-20** (not yet deployed) | server `feature/penz` `service/practice` (paper trades, R, cap, deterministic weekly review) + `service/proposal` (splitter, validator, `PenzCatalogSeed`, strategy); iOS `Penz/{PenzGyakorlas,PenzPracticeSheets,PenzProposalViews}` + `BoopCore/Penz/Penz{Practice,Proposal}*`, shared `NKProposalCard`/`NKWhyBody`, 422/409 coded rejections in `PlanTransport`. Build notes `docs/superpowers/plans/2026-11-20-boop-penz-l7-build.md` |
| L6 Az egy AI látja a pénzt és a levelet + szálak | `mezo-r36n9.43` | open | after L3 + L5 + B8 |

**B8 must allow for this even though it ships first:** area contributors in "miért?" are an **open set**, not five
fixed experts; the memory corpus must admit non-biometric daily facts (a cost, a mail verdict) through the same
day-scoped path as a check-in; areas are a list, not five hard-coded slots.
