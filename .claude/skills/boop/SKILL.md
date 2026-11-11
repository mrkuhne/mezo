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
   - the look: Napkelte spec `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md` (§4 look, §5 screens —
     its five-domain bar/page skeleton is superseded by the spine), kit `ios/BoopKit/Sources/BoopDesign/Napkelte/`,
     executable reference `docs/design_2.0/prototypes/boop-ios-spike/Aura*.swift` (`Lagy*.swift` is dead)
   - data/backend background still valid: `docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md` (data, §4)

## 2. Owner decisions — do not re-litigate

- **Standalone, not a port** (2026-11-11). Boop reuses the backend's engines (goal engine, gym progression,
  meal scoring + AI draft, check-in, journal, sleep log, chat platform) and **hides** the web clutter
  (gamification, quests, titles, habits, needs rings, activity, medication/supplements, life goals, tutorial,
  team wall, Gépterem). Hide = no Boop API/screen; do not delete backend tables. The web app is not developed for
  Boop's sake.
- **The spine** (2026-11-11): one home **Ma** (Reggel plan → Napközben timeline + proposal cards → Este close
  <60 s), bottom bar **Ma · Terv · Napló · Boop** + global **`+`**; sleep/food/training/energy are identical
  drill-downs (verdict → level/graph → the days behind it → actions). **Nothing changes without the owner's tap**;
  every proposal has **"miért?"**.
- **One voice: Boop** (2026-11-11). Domain experts (Alvás, Mozgás, Étkezés, Közérzet, Szkeptikus) appear only as
  short labelled lines inside "miért?". No visible team, no expert pages. The companion is **Boop**, never
  "Mezo", in every user-visible string. The orb is Boop's face.
- **The original (web) account** is Boop's only account (2026-11-11); the Boop account's data migrates into it in
  B1 (production write → per-change owner OK + rollback plan).
- **Paid Apple Developer Program** (2026-11-11), subscribed when B1 starts: background HealthKit delivery, APNs,
  watchOS app, no weekly reinstall. Until then the free team rules in §3 apply.
- **Order** (2026-11-11): repair → data foundation → spine → **daily loop** → food / training + Watch → the Plan →
  day capacity → one AI.
- **Napkelte is the look** (2026-11-10): dark glass, painted sky per page, colour only in sky + orbs, white type,
  serif headlines / Outfit numbers / mono labels, the orb rising as the sun, mini orbs as a lens, icon-only bottom
  bar, "Készenlét" is called **Forma**. Never emoji; no SF Symbols except chevrons/arrows.
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
- Team id lives in `~/.config/boop/team` (never commit it; `git grep DEVELOPMENT_TEAM ios/` must be empty).
- **LuLu firewall on the Mac blocks network calls from the ad-hoc signed simulator app** (simulator Safari and host
  tools work). Test live calls on the phone or with stubbed transports; don't change the owner's firewall.
- Simulator tool screenshots can be several actions stale — use `xcrun simctl io <udid> screenshot`. SwiftUI
  presentations must sit at page level and the page must read the flag (`boop-ios.md` §9); `@SceneStorage` restores
  the last tab on relaunch.
- Production DB reads are free, writes need the owner's explicit OK per change (CLAUDE.md).
- Device launches from a locked phone fail harmlessly; ask the owner to unlock and open the app.
- Known prod health issues at re-plan time (fixed in B0): memory embeddings failing since 2026-10-21, nightly
  konzílium failing — check B0's status before building anything that reads memory or konzílium output.

## 5. How work is done

- Every slice opens with a short brainstorm (`superpowers:brainstorming` + `brainstorm-recon`; the research report
  for the area is the recon's head start), a **simulator spike** when anything new is seen, then a plan in
  `docs/superpowers/plans/` with a *Kész, ha…* list (owner OK) → execute (inline or subagents).
- TDD for logic (`BoopCore` models with `StubTransport`, builders as pure functions); screens build from the
  Napkelte kit in `BoopDesign/Napkelte/` and the approved spike. Logic that lives only in the web frontend moves to
  the backend when more than Boop's display needs it (spec §4), otherwise to Swift — never duplicate it in both.
- Backend changes follow `docs/features/_platform-api-backend.md` §7 (contract first, Liquibase in `1.1.0/`,
  ArchUnit, ResetDatabase + populator) and the focused-IT command with `-Dmezo.test.use-testcontainers=true` plus
  `ArchitectureTest`.
- Final fresh-context review on the most capable model, fix Critical/Important with failing tests first, file minors
  under the epic, update `docs/features/boop-ios.md`, the feature index row, the roadmap row + milestone entry, and
  the §6 block below.
- Report to the owner in Hungarian: what he can now do, what was checked, what is not done.

## 6. Where things stand (update this block when a slice ships)

**Shipped base (S-slices, 2026-11-09/10):** S1 alap (auth, onboarding, shell, install; `mezo-r36n9.1` minors) ·
S2 adatok (Health 60-day backfill + calendar → backend `wearable`; `mezo-r36n9.4`) · S2.5 Napkelte look
(`mezo-r36n9.6`) · S3 reggel (backend `boop` brief, Mai, sheets, A napom, voice, evening/kímélő, bedtime reminder,
v2.401.0; `mezo-r36n9.8`). **S4 lépések is cancelled** — its parts live in B3/B4.

**Re-plan 2026-11-11** (`mezo-r36n9.9`, research `docs/superpowers/research/boop-standalone/`):

| Slice | Issue | State | Can start |
|---|---|---|---|
| B0 Javítás — memory + konzílium repair (backend) | `mezo-r36n9.10` | open | now (parallel) |
| B1 Adatalap — paid team, account switch, wide Health, sources, background | `mezo-r36n9.11` | open | now (parallel) |
| B2 Gerinc — Ma · Terv · Napló · Boop + `+`, proposal card, drill-down | `mezo-r36n9.12` | open | spike now; live data after B1's account switch |
| B3 Napi ritmus — check-in + snapshot, goal, journal, evening close, basic chat | `mezo-r36n9.13` | open | after B2 |
| B4 Étel — native capture, allergens, day budget | `mezo-r36n9.14` | open | after B3 (∥ B5) |
| B5 Edzés + Watch — player, Live Activity, watchOS | `mezo-r36n9.15` | open | after B3 (∥ B4) |
| B6 A Terv — diet + training + goal plan, effect tracking | `mezo-r36n9.16` | open | after B4 + B5 |
| B7 Napi kapacitás — calendar scoring, units, live adjust | `mezo-r36n9.17` | open | after B6 (needs weeks of B3 data) |
| B8 Az egy AI — memory corpus, day council, horizons | `mezo-r36n9.18` | open | after B7 + B0 |
