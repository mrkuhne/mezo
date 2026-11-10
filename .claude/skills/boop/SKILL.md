---
name: boop
description: Session driver for Boop, the native SwiftUI iPhone app (epic mezo-r36n9, owner decisions 2026-11-09) that replaces the web app once complete — Napkelte design canon (dark glass, painted sky, the rising orb; replaced Lágy 2026-11-10), companion named Boop, same backend with a new account, visual iteration in the iOS Simulator (no HTML artifacts), weekly sideload on the owner's phone with a free Apple ID. Built in slices (S1 alap, S2 adatok = Apple Health + calendar, S2.5 Napkelte look shipped; S3 reggel = morning brief, orb, voice, energy curve; S4 lépések = check-in, intention, weight, meal, patterns). Several sessions may work on Boop in parallel; this skill holds the ownership rules that keep them apart. Use when the user invokes /boop or asks to work on Boop / the iPhone app / iOS / the simulator / the Napkelte look.
---

# Boop session driver

The owner opens a fresh session, types `/boop` and says what to work on. You load the context
below, claim the work, and run it to the end without extra check-ins. **Talk to the owner in
Hungarian, business language** (CLAUDE.md §Communication) — no file names, no jargon in questions.

## 1. Start of every session (in this order)

1. `gh run list --branch main --limit 1` — a red main outranks everything (AGENTS.md).
2. `git fetch && git checkout --detach origin/main` in your worktree, then `bd prime`.
3. **See who is working on what:** `bd list --parent mezo-r36n9 --status in_progress` and read each
   issue's description — the **"Owns:"** list is that session's files. You may not edit them.
4. Pick or create your issue under `mezo-r36n9`, write its **Owns:** list (paths/globs) into the
   description, then `bd update <id> --claim`. If what the owner asked overlaps an owned path,
   say so in Hungarian and offer a non-overlapping alternative or to wait.
5. Read what your task needs (don't read everything):
   - spec `docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md` (data, backend, §4, §8; its look sections are superseded by Napkelte)
   - slice plans `docs/superpowers/plans/2026-11-09-boop-ios-v1.md` (slice map + S1) and
     `docs/superpowers/plans/2026-11-09-boop-s2-adatok.md` (S2); a later slice gets its own plan
   - how it works now: `docs/features/boop-ios.md`; build/test/install: `ios/README.md`
   - the approved look in executable form: `docs/design_2.0/prototypes/boop-ios-spike/` (the `Aura*.swift` files are
     the build target for screens; README lists launch arguments; `Lagy*.swift` is the superseded look)
   - the look: Napkelte spec `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md` (§4–§5, §9–§10) and its kit
     `ios/BoopKit/Sources/BoopDesign/Napkelte/`; plan of the look slice `docs/superpowers/plans/2026-11-10-boop-napkelte-kit.md`

## 2. Owner decisions — do not re-litigate

- **Napkelte is the canon** (owner 2026-11-10, replaced Lágy): spec `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md`
  — dark glass, painted sky per page, colour only in sky + orbs, white type, serif headlines / Outfit numbers /
  mono labels, the orb rising as the sun, mini orbs as a lens (each orb shows only its own tiles + short path),
  icon-only bottom bar, "Készenlét" is called **Forma**. Build from the kit `ios/BoopKit/Sources/BoopDesign/Napkelte/`;
  the look's reference is the spike's `Aura*.swift`. Never emoji; no SF Symbols except chevrons/arrows.
- **The companion is Boop**, never "Mezo", in every user-visible string. The orb is Boop's face.
- **Simulator first**: visual iteration happens in Xcode + the iOS Simulator; no HTML artifacts for Boop.
  A new screen gets a throwaway simulator spike and the owner's OK before it is built.
- Same backend, **new Boop account** (registered 2026-11-09); plans are set up in the web app.
- Free Apple ID: weekly reinstall is fine for the owner. Google Calendar via the iPhone's calendar
  (EventKit), read-only. 60-day Health backfill. Action buttons move the session in the Boop
  account's training plan, never the calendar. One repo — Boop lives in `ios/` next to the backend.
- After the owner OKs a plan he does not want another visual round: build → gates → review →
  merge → deploy (if backend) → install → live check → Hungarian report.

## 3. Parallel sessions — the rules

- **One session = one issue = one feature branch** in its own worktree.
- **Never edit another in-progress issue's "Owns:" paths.** Shared hot spots, one writer at a time:
  - `ios/Boop.xcodeproj/**` (project file — two writers corrupt it; file-system synchronized groups
    mean new Swift files need **no** project edit, so most tasks never touch it),
  - `ios/BoopKit/Package.swift`, `ios/BoopKit/Sources/BoopAPI/**` (generator filter + synced contract),
  - `api/openapi.yml` and `api/generate/merge.yml`, `backend/src/test/.../support/ResetDatabase.java`,
    `AbstractIntegrationTest` imports, the Liquibase `1.1.0_master.yml`.
  If you need one of these and another session owns it, stop and tell the owner.
- **Your own simulator**: never use another session's device. Create one per session and boot it:
  `xcrun simctl create "Boop · <issue-id>" "iPhone 17 Pro Max"` → `xcrun simctl boot <udid>` →
  `xcrun simctl install/launch <udid> …`, and pass that device to the simulator tool. Several
  simulators can run at once; the owner can watch each in its own window (DeviceHub). Delete yours
  at the end (`xcrun simctl delete <udid>`).
- **Phone install is exclusive**: only the session that ships installs (`ios/scripts/install-on-phone.sh`);
  say so before running it. The free team allows 3 sideloaded apps and 10 App IDs a week — never
  create new bundle ids.
- **Merging is sequential**: `git fetch && git rebase origin/main` right before the local `--no-ff`
  merge (detached HEAD, `git push origin HEAD:main`), regenerate `docs/CODEMAP.md` after the merge,
  re-run the tests you own. If main moved under you, rebase again — never force-push main.
- **After every push to main, fast-forward the primary checkout's `main`** — new sessions' worktrees
  are cut from it, so a stale local main hides new skills and code from them:
  `P=$(git worktree list --porcelain | awk 'NR==1{print $2}'); git -C "$P" fetch -q origin &&
  [ -z "$(git -C "$P" status --porcelain)" ] && git -C "$P" merge --ff-only -q refs/remotes/origin/main`
  (skip with a note to the owner if that checkout is dirty or not on `main`).
- Close or update your issue and run `node scripts/check-beads-backup.mjs --fix` before you end.

## 4. Environment facts

- `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` (xcode-select points at the CLT).
- Build/test commands, launch arguments and the DEBUG `-preview onboarding|shell` switch: `ios/README.md`.
- Team id lives in `~/.config/boop/team` (never commit it; `git grep DEVELOPMENT_TEAM ios/` must be empty).
- **LuLu firewall on the Mac blocks network calls from the ad-hoc signed simulator app** (simulator
  Safari and host tools work). Test live calls on the phone or with stubbed transports; don't change
  the owner's firewall.
- The simulator tool's screenshots can lag one action — take a second screenshot before concluding.
- Production DB reads are free, writes need the owner's explicit OK per change (CLAUDE.md).
- Device launches from a locked phone fail harmlessly; ask the owner to unlock and open the app.

## 5. How work is done

- TDD for logic (`BoopCore` models with `StubTransport`, builders as pure functions); screens copy the
  spike and the kit in `BoopDesign` (`LagyTabPage`, `LagyFlowFrame`, `BoopCard`, `Chip`, `WidePill`…).
- Backend changes follow `docs/features/_platform-api-backend.md` §7 (contract first, Liquibase in
  `1.1.0/`, ArchUnit, ResetDatabase + populator) and the focused-IT command with
  `-Dmezo.test.use-testcontainers=true` plus `ArchitectureTest`.
- Every slice: a plan with a *Kész, ha…* list (owner OK), execute (inline or subagents), a final
  fresh-context review on the most capable model, fix Critical/Important with failing tests first,
  file minors under the epic, update `docs/features/boop-ios.md`, the feature index row, the roadmap
  row + milestone entry.
- Report to the owner in Hungarian: what he can now do, what was checked, what is not done.

## 6. Where things stand (update this block when a slice ships)

- **S2.5 Napkelte — shipped 2026-11-10** (`mezo-r36n9.3`): the Napkelte kit + every shipped screen re-skinned;
  plan `2026-11-10-boop-napkelte-kit.md`. S3/S4 build on the kit with the spec as visual target.
- **S1 alap — shipped 2026-11-09**: auth, onboarding, five-domain shell, install script; owner's Boop
  account live. Minors: `mezo-r36n9.1`.
- **S2 adatok — shipped 2026-11-10** (`mezo-r36n9.2`): Health + calendar connect flow, `HealthSync`
  (60-day backfill, refresh on open), backend feature `wearable` (4 endpoints, tables `daily_metric`,
  `wearable_workout`, `calendar_event`; Health nights in `sleep_log` as `apple_health`).
- Simulator gotchas found in S2: the simulator tool's screenshots can be several actions stale — use
  `xcrun simctl io <udid> screenshot`; SwiftUI presentations must sit at page level and the page must read
  the flag (see `boop-ios.md` §9); `@SceneStorage` restores the last tab on relaunch.
- **S3 reggel — shipped 2026-11-10** (`mezo-r36n9.7`, plan `2026-11-10-boop-s3-reggel.md`, v2.401.0): backend
  feature `boop` (`GET /api/boop/brief`, regenerate ≤3/day, `PUT/DELETE /api/boop/session-time`; tables
  `boop_brief`, `workout_time_override`), Mai (orb + five orbs, lens actions, path, observations), sheets, A napom,
  voice, evening/kímélő modes, bedtime reminder, shared-panorama domain switch. Minors: `mezo-r36n9.8`.
- **S4 lépések — not planned yet**; its look is the Napkelte spec §5 and the spike's `Aura*.swift`.
