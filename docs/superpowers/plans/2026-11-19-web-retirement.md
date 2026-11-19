# Web Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the web app off and remove the server areas only the web used, keeping every production row and every behaviour the iPhone relies on.

**Architecture:** Eight tasks, each its own `feat/<topic>` branch merged to main with main green after it (house rule: local gates → `--no-ff` merge → push). Removal is guarded test-first: one growing `RetiredAreasGoneIT` proves each retired area is gone (no bean, no route), and a contract check proves every iPhone operation still exists. Tables are never dropped; Liquibase is not touched.

**Tech Stack:** Spring Boot 4 / Java 21 (backend, Testcontainers ITs, ArchUnit), SwiftUI (`ios/`), GitHub Actions, k3s + ArgoCD (`prune: true`), Node scripts for gates.

**Spec:** `docs/superpowers/specs/2026-11-19-web-retirement-design.md` (approved 2026-11-19, decision #52)

## Global Constraints

- Tables and rows of retired areas stay; no Liquibase changeset drops anything; no hand write to production.
- No operation in `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (123 today) may disappear or change.
- No endpoint of a **kept** area is removed (`goal`, `train`, `meal`, `fuel`, `biometrics`, `journal`, `intention`, `dayclose`, `boop`, `wearable`, `pantry`, `recipe`, `nutrition`, `companion`, `character`, `proactive`, `people`, `llmlog`, `auth`).
- `habit`, `lifegoal`, `needs`, `ritual`, `medication` are touched **only after the owner checkpoint in Task 6**, and only the areas he releases.
- Tasks 5 and 6 never run in parallel (both edit companion prompt assembly); Task 8's bell removal runs after 5–7.
- Every task: backend full suite `cd backend && ./mvnw -B clean test -Dmezo.test.use-testcontainers=true -Dmezo.test.forks=3` green, `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs` 0 errors / 0 stale, `bash .github/scripts/cheap-gates.sh > /tmp/g.log 2>&1; echo rc=$?` → `rc=0` (never pipe a gate into `tail` inside an `&&` chain).
- iOS tasks: `xcodebuild test` per `ios/README.md` for BoopKit and Boop, then `ios/scripts/install-on-phone.sh`.
- No visible string with emoji or "Mezo"; owner-facing reports in Hungarian business language.
- Each task: bd issue under epic `mezo-r36n9` + row in `docs/boop-handbook/_jegyek.json`; merges the owner can feel get a `_kiadasok.json` row; Notion `node scripts/boop-notion-sync.mjs check` exits 0 before reporting.

## Review Focus

1. **Exercise images requested without a login token** (the iPhone's image loader sends no `Authorization`) must still return the JPEG → `ExerciseImagesIT.testGetImage_shouldReturnJpeg_whenUnauthenticated` (Task 1).
2. **A day closed on the iPhone after `ritual` is cut** must still reach the people-mention, reflection-embedding and timing-profile listeners → `DayCloseListenersIT` (Task 6).
3. **Days closed only on the old web** must still appear in `listDayCloses` → `DayCloseServiceIT.testList_shouldIncludeLegacyWebCloses_whenRitualRowsExist` (Task 6).
4. **Production still carries env vars / properties of removed areas** after a deploy; the backend must boot and nothing may re-enable a removed job → `RetiredAreasGoneIT.testContext_shouldStart_whenRetiredPropertiesStillSet` (Task 4, extended in 5–7) plus the `k8s/backend/deployment.yaml` grep in each task.
5. **An iPhone operation silently removed with a fragment** → `scripts/check-ios-contract.mjs` in cheap gates (Task 4).

---

### Task 1: Exercise images served by the backend at the same URL

**Files:**
- Move: `frontend/public/exercises/*` (248 files) → `backend/src/main/resources/static/exercises/`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/security/SecurityConfig.java:44` (permit `GET /exercises/**`)
- Modify: `k8s/ingress.yaml` (add path `/exercises` → service `backend:8090`, before `/`)
- Modify: `scripts/import-exercise-images.mjs:31-34` (`OUT_DIR` → `backend/src/main/resources/static/exercises`, comment)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseImagesIT.java`

**Interfaces:**
- Produces: `GET /exercises/<slug>-a.jpg|-b.jpg` answered by the backend, public, `Content-Type: image/jpeg`, `Cache-Control` max-age ≥ 7 days.

- [ ] **Step 1: Write the failing tests** (`ExerciseImagesIT extends ApiIntegrationTest`)
  - `testGetImage_shouldReturnJpeg_whenUnauthenticated`: GET `/exercises/barbell-row-a.jpg` with no headers → 200, `image/jpeg`, body length > 0, `Cache-Control` contains `max-age`.
  - `testCatalog_shouldResolveEveryImagePath_whenLoadedFromContent`: every `imageStartUrl` / `imageEndUrl` in `content/exercise-catalog.json` exists as `classpath:static` + path (248 paths).
  - `testUnknownImage_shouldReturn404_whenMissing`: GET `/exercises/nope-a.jpg` → 404 (not 401).
- [ ] **Step 2: Run** `./mvnw test -Dtest=ExerciseImagesIT -Dmezo.test.use-testcontainers=true` → FAIL (401/404).
- [ ] **Step 3: Move the folder with `git mv`, permit `GET /exercises/**` in `SecurityConfig`, set `spring.web.resources.cache.cachecontrol.max-age=7d` in `application.yml`.**
- [ ] **Step 4: Run the test** → PASS; then the full suite.
- [ ] **Step 5: Add the ingress rule; leave the frontend rule in place.** `kubeconform` via `lint-k8s` job shape: `find k8s -name '*.yaml' ! -name values.yaml | xargs kubeconform -strict -ignore-missing-schemas` passes.
- [ ] **Step 6: Merge, push, wait for `deploy` green and the pod tag = release version.** Verify live: `curl -sI https://46.225.112.172.sslip.io/exercises/barbell-row-a.jpg` → `200`, `content-type: image/jpeg`, and `kubectl -n mezo logs deploy/backend --since=5m | grep -c exercises` shows the request reached the backend (or the backend access shows in its metrics). Open an exercise on the phone: both images show.
- [ ] **Step 7: Commit** `feat(train): exercise images served by the backend at the same URL (mezo-…)`

### Task 2: iPhone no longer links to the web app

**Files:**
- Modify: `ios/Boop/Terv/TervView.swift:24-25` (remove the web card)
- Modify: `ios/Boop/Nap/NapView.swift:146-147` (remove the web card)
- Modify: `ios/Boop/Shell/AccountSheet.swift:24-…` (remove the "Webes app" row)
- Modify: `ios/BoopKit/Sources/BoopCore/BoopConfig.swift:7` (delete `webAppURL`)

**Interfaces:**
- Produces: no symbol `webAppURL` anywhere in `ios/`.

- [ ] **Step 1: Remove the three call sites and `webAppURL`.** No replacement card (spec §6).
- [ ] **Step 2: Verify** `grep -rn 'webAppURL\|webes app' ios --include='*.swift'` → no output (case-insensitive for the copy).
- [ ] **Step 3: `xcodebuild test`** for BoopKit and Boop → green; Simulator screenshots of Terv, Nap and the account sheet at the smallest iPhone width show no gap where the cards were.
- [ ] **Step 4: Install on the phone** (`ios/scripts/install-on-phone.sh`), walk Terv / Nap / Fiók.
- [ ] **Step 5: Commit** `feat(boop): the web-app links leave the iPhone (mezo-…)`

### Task 3: The web app is switched off

**Files:**
- Delete: `frontend/`, `k8s/frontend/`, `scripts/gen-folyadek-sprite.mjs`, `scripts/gen-body-geometry.mjs`
- Modify: `k8s/ingress.yaml` (remove the `/` → `frontend` rule; `/api` and `/exercises` stay)
- Modify: `.github/workflows/deploy.yml` (remove `build-frontend`, `force_frontend`, `frontend_changed` outputs/conditions)
- Modify: `.github/scripts/release-commit.sh:30-32` + `release-commit.test.sh` (drop the frontend retag)
- Modify: `.github/workflows/ghcr-retention.yml` (matrix `package: [mezo-backend]`, drop the frontend pin read)
- Modify: `.github/workflows/ci.yml` (delete `test-frontend`, `test-layout`; `contract-drift` keeps only `api/generate` + `git diff --exit-code -- api/openapi.yml`; drop the pnpm steps)
- Modify: `.github/workflows/premerge.yml:98-118` (same contract-drift trim, drop pnpm)
- Modify: `.github/scripts/ci-scope.sh` callers (`test-backend` keeps `backend/ api/`) + `ci-scope.test.sh` (frontend cases removed)
- Modify: `.github/scripts/require-checks.test.sh:16` (job count `6` → `4`: lint, lint-k8s, contract-drift, test-backend)
- Modify: `scripts/check-generator-toolchain.mjs` (remove the `frontend` toolchain), `scripts/gen-codemap.mjs` + `gen-codemap.test.mjs` (backend + contract spaces only)
- Modify: `AGENTS.md`, `CLAUDE.md` (drop every frontend gate/obligation; §"What we build" says the web app is retired, decision #52), `.claude/skills/verify/SKILL.md` and `.claude/skills/folyadek/SKILL.md` (frontmatter description starts "RETIRED 2026-11-19 (#52) —"), `docs/infrastructure/local-dev-testing.md`, `docs/infrastructure/deployment-k3s-argocd.md`

- [ ] **Step 1: Write the failing check:** extend `ci-scope.test.sh`/`require-checks.test.sh` expectations first (4 jobs; no `frontend/` prefix) → `bash .github/scripts/require-checks.test.sh` FAILS on the job count.
- [ ] **Step 2: Make the workflow, script and k8s edits above.**
- [ ] **Step 3: Verify** `bash .github/scripts/cheap-gates.sh > /tmp/g.log 2>&1; echo rc=$?` → `rc=0`; `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'` parses; `grep -rn 'frontend' .github scripts k8s` → only historical comments that say "retired".
- [ ] **Step 4: Delete `frontend/` with `git rm -r`;** regenerate CODEMAP; fix every `docs/features/*.md` `key_files` entry under `frontend/` (29 docs) — drop the entry, add a dated line "Web screens retired 2026-11-19 (#52)" in section 9; `lint-docs` 0/0.
- [ ] **Step 5: Merge, push.** Verify: `deploy` green with no frontend job; ArgoCD pruned it: `kubectl -n mezo get deploy,svc | grep frontend` → no output; `curl -s -o /dev/null -w '%{http_code}' https://46.225.112.172.sslip.io/` → `404`; `/api/auth/login` POST still 4xx-with-JSON, `/exercises/barbell-row-a.jpg` → 200; the phone app logs in and loads the day.
- [ ] **Step 6: Commit** `chore: the web app is switched off (mezo-…)`

### Task 4: Leaf areas out — `tutorial`, `telemetry`, `admin`

**Files:**
- Delete: `backend/src/main/java/io/mrkuhne/mezo/feature/{tutorial,telemetry,admin}/`, their tests under `backend/src/test/java/io/mrkuhne/mezo/feature/{tutorial,telemetry,admin}/`, `api/feature/{tutorial,telemetry,admin,admin-data,admin-insights,admin-memory}/` and their entries in `api/generate/merge.yml`
- Create: `scripts/check-ios-contract.mjs`; wire it into `.github/scripts/cheap-gates.sh`
- Create: `backend/src/test/java/io/mrkuhne/mezo/RetiredAreasGoneIT.java`
- Modify: `application.yml`, `src/test/resources/application.properties`, `k8s/backend/deployment.yaml` (remove `mezo.tutorial.*`, `mezo.telemetry.*`, `mezo.admin*` keys and env), `api/openapi.yml` (regenerated), `ios/BoopKit/Sources/BoopAPI/openapi.yaml` (`ios/scripts/sync-openapi.sh`)

**Interfaces:**
- Produces: `RetiredAreasGoneIT` with a `RETIRED_PACKAGES` list and a `RETIRED_ROUTES` list that Tasks 5–8 append to; `scripts/check-ios-contract.mjs` (exit 1 naming every iOS-filter operation missing from `api/openapi.yml`).

- [ ] **Step 1: Write `check-ios-contract.mjs`** — parses the `filter.operations` list of the iOS generator config and the `operationId`s of `api/openapi.yml`; prints `✅ all <n> iPhone operations present` or `✗ missing: …`. Run it → passes today (123).
- [ ] **Step 2: Write the failing `RetiredAreasGoneIT extends ApiIntegrationTest`:**
  - `testBeans_shouldBeAbsent_whenAreaRetired`: no bean in the context whose class name starts with any `RETIRED_PACKAGES` entry (`io.mrkuhne.mezo.feature.tutorial.`, `…telemetry.`, `…admin.`).
  - `testRoutes_shouldReturn404_whenAreaRetired`: for each `RETIRED_ROUTES` entry (one representative GET per area, authenticated as the owner) → 404.
  - `testContext_shouldStart_whenRetiredPropertiesStillSet`: `@TestPropertySource` sets the removed keys from today's `application.yml` (e.g. `mezo.telemetry.retention-cron`) → context starts, no scheduled task of a retired package is registered (`ScheduledTaskHolder`).
  Run → FAIL.
- [ ] **Step 3: Delete the three areas** (main, tests, fragments, merge.yml entries, populators/fixtures they own, config keys); regenerate `api/openapi.yml` (`cd api/generate && npm ci && npm run generate:api`) and sync the iOS copy.
- [ ] **Step 4: Run** `RetiredAreasGoneIT`, `ArchitectureTest` → PASS (refreeze the ArchUnit store only for entries of deleted classes); `node scripts/check-ios-contract.mjs` → 123 present; full suite green.
- [ ] **Step 5: Merge, push, deploy green.** Production: the row counts of `tutorial_progress`, `screen_event` and admin-owned tables equal the pre-deploy read; `kubectl -n mezo logs deploy/backend --since=1h | grep -c ERROR` not above the pre-deploy hour.
- [ ] **Step 6: Commit** `refactor: tutorial, telemetry and admin leave the server (mezo-…)`

### Task 5: XP world out — `gamification`, `quest`, `progression`, `activity`

**Files:**
- Delete: the four packages (main + test), `api/feature/{gamification,quest,progression,activity}/`, merge.yml entries, populators `QuestPopulator`, `ActivityPopulator`, `SkillProgressPopulator`, `LevelUpEventPopulator`, `GamificationPopulator` (+ their `@Import` in `AbstractIntegrationTest`)
- Modify (cut the reads, not stubs): `feature/train/**` (8 `ProgressionService`/`ProgressionGate`/`LevelUpResultMapper` uses — XP/level-up on workout finish and its response fields), `feature/companion/**` (progression ×3, gamification ×2), `feature/habit/**` (×2), `feature/lifegoal/**` (×3), `feature/needs/**` (×1), `feature/proactive/**` (×1), `feature/character/**` (quest ×1), `feature/lifegoal/**` (activity ×1); remove `QuestJob` crons from config/env

**Interfaces:**
- Consumes: `RetiredAreasGoneIT.RETIRED_PACKAGES` / `RETIRED_ROUTES` (Task 4).
- Produces: no import of the four packages anywhere in `backend/src/main`; `finishWorkout`'s response fields for XP/level-up — **only if they are not in the iPhone's spec**: check `ios/BoopKit/Sources/BoopAPI/openapi.yaml`; if the iPhone schema carries them, keep the fields and return empty/neutral values, recorded in the commit.

- [ ] **Step 1: Append the four packages and one route each to `RetiredAreasGoneIT`;** add `QuestJob`'s cron keys to the properties test. Run → FAIL.
- [ ] **Step 2: Cut every kept-code import** (`grep -rnE 'feature\.(gamification|quest|progression|activity)\.' backend/src/main --include='*.java' | grep -vE '/feature/(gamification|quest|progression|activity)/'` → empty), then delete the packages, fragments, populators, config keys.
- [ ] **Step 3: Run** `RetiredAreasGoneIT`, the train/companion/character/habit/lifegoal/needs/proactive focused ITs, `ArchitectureTest`, `check-ios-contract.mjs` → PASS; full suite green.
- [ ] **Step 4: Merge, push, deploy green;** production row counts of `level_up_event`, `skill_progress`, `gamification_profile`, `challenge`, `activity_log`, quest tables unchanged; finish a workout on the phone → no error.
- [ ] **Step 5: Commit** `refactor: the XP world leaves the server (mezo-…)`

### Task 6: Owner checkpoint, then the daily-life areas the owner releases

**Files (only for released areas):**
- Delete: released packages among `habit`, `lifegoal`, `needs`, `ritual`, `medication` (main + test), their `api/feature/*` fragments, populators, `HabitJob` / `LifeGoalEvalJob` config
- Modify: `feature/dayclose/service/DayCloseService.java` (if `ritual` released: stop `writeLegacy`; publish only `DayClosedEvent`; keep a read-only `LegacyRitualCloseReader` in `feature/dayclose/repository/` over the ritual tables for `getDayClose`/`listDayCloses`), listeners `people/service/ReflectionMentionListener`, `companion/embedding/ReflectionEmbeddingListener`, `train/service/TimingProfileListener` (subscribe to `DayClosedEvent`), and every kept import found by `grep -rnE 'feature\.(habit|lifegoal|needs|ritual|medication)\.'` in companion, character, proactive, meal, notification, dayclose, people
- Test: `feature/dayclose/DayCloseListenersIT.java`, `feature/dayclose/DayCloseServiceIT.java`

**Interfaces:**
- Consumes: `RetiredAreasGoneIT` lists; `DayClosedEvent` (existing, `feature/dayclose`).
- Produces: `LegacyRitualCloseReader.findClosedDays(UUID userId, LocalDate from, LocalDate to): List<LegacyClose>` (read-only, no writes).

- [ ] **Step 1: Checkpoint.** Show the owner, in Hungarian business language (§Communication format), where the iPhone app stands and ask **area by area** (szokások · életcélok · igény-körök · rituálék · gyógyszer-ciklus) whether it goes. Record each answer in the bd issue and `_dontesek.json`. Kept areas are out of scope for the rest of this task.
- [ ] **Step 2: Write the failing tests** (ritual released):
  - `DayCloseListenersIT.testPutDayClose_shouldNotifyMentionEmbeddingAndTiming_whenClosedFromIphone`: `PUT /api/day-close/{date}` with a reflection naming a known person → a mention row, a reflection embedding row and a timing-profile update exist.
  - `DayCloseServiceIT.testList_shouldIncludeLegacyWebCloses_whenRitualRowsExist`: a ritual row seeded by populator for a day with no day-close row → `GET /api/day-close?from&to` includes that day, read-only.
  - Append released packages/routes to `RetiredAreasGoneIT`.
  Run → the listener test FAILS once `writeLegacy` is removed (write the test against today's code first: it passes; then remove `writeLegacy` and watch it fail before moving the listeners).
- [ ] **Step 3: Move the three listeners to `DayClosedEvent`, add `LegacyRitualCloseReader`, cut the remaining imports, delete the released packages.**
- [ ] **Step 4: Run** the new ITs, `RetiredAreasGoneIT`, `ArchitectureTest`, `check-ios-contract.mjs` → PASS; full suite green.
- [ ] **Step 5: Merge, push, deploy green;** production counts of released areas' tables unchanged; close a day on the phone → it appears in Napló, Boop's chat can quote the reflection.
- [ ] **Step 6: Commit** `refactor: <released areas> leave the server (mezo-…)`

### Task 7: Web push out, APNs registration kept

**Files:**
- Delete: `feature/notification/controller/NotificationController.java`, entities/repositories `NotificationPref*`, `NotificationSchedule*`, `PushLog*`, `PushSubscription*`, services `AnchorResolver`, `DueEvaluator`, `NotificationDispatchJob`, `NotificationPrefService`, `NotificationScheduleService`, `NudgeSendPushLogAdapter`, `PushDispatchExecutor`, `PushSender`, `PushSubscriptionService`, `techcore/webpush/`, their tests, the web-push part of `api/feature/notification/`
- Keep: `DeviceController`, `ApnsDeviceEntity`, `ApnsDeviceRepository`, `ApnsDeviceService`, `api/feature/device/`
- Modify: `feature/character/**` (2 `NotificationProperties` uses), any emitter that called `PushSender` (found by grep), `NotificationProperties` reduced to what APNs registration needs or deleted, VAPID keys/env out of `application.yml` and `k8s/backend/deployment.yaml`

- [ ] **Step 1: Append** `…notification.service.PushSender`, `…techcore.webpush.` and the push route to `RetiredAreasGoneIT`; add `DeviceRegistrationStillWorksIT.testRegister_shouldStoreDevice_whenIphoneRegistersApnsToken` (existing behaviour, must pass before and after). Run → `RetiredAreasGoneIT` FAILS.
- [ ] **Step 2: Delete and cut** as listed; `grep -rn 'webpush\|WebPush\|vapid' backend/src/main k8s` → empty.
- [ ] **Step 3: Run** the two ITs, `ArchitectureTest`, `check-ios-contract.mjs` (`registerApnsDevice`, `unregisterApnsDevice` present) → PASS; full suite green.
- [ ] **Step 4: Merge, push, deploy green;** production `apns_device` count unchanged; the phone app launches without a registration error.
- [ ] **Step 5: Commit** `refactor: web push leaves the server, iPhone device registration stays (mezo-…)`

### Task 8: Web-only generators off, the bell out, close-out

**Files:**
- Modify: `application.yml` / `k8s/backend/deployment.yaml` (generator flags off, existing `mezo.feature.*` / `mezo.techcore.cron.*` keys)
- Delete (after 5–7 merged): `feature/appnotification/` (main + test), `api/feature/` bell fragment, `AppNotificationPopulator`; cut the emit calls in companion (10 classes), proactive (8), character (4), goal (2) and any left elsewhere
- Modify: retired feature docs (`status: retired`, dated note), `docs/features/boop-ios.md`, `docs/features/index`, handbook pages under `docs/boop-handbook/`, `_kiadasok.json`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WebOnlyGeneratorsOffIT.java`

- [ ] **Step 1: Generator audit (written into the bd issue):** for each of feed, challenge, team chat, memoir, weekly review, weekly suggestion, prediction, experiment, character portrait, team edition: who reads its output (grep the repository / entity across `backend/src/main` and the iPhone spec). Off **only** if every reader is web-only or the bell; otherwise it stays on and is listed "for B8".
- [ ] **Step 2: Write the failing `WebOnlyGeneratorsOffIT`:** with production-equivalent config (the flags as set in `application.yml`), the jobs of every generator marked off are not registered (`ScheduledTaskHolder`) and calling their trigger service produces no LLM call (`FakeCompanionLlm` call count unchanged). Run → FAIL.
- [ ] **Step 3: Set the flags** in `application.yml` (and env in `deployment.yaml` if overridden there) → PASS.
- [ ] **Step 4: Append `appnotification` to `RetiredAreasGoneIT`; cut the emit calls; delete the package and fragment** → `RetiredAreasGoneIT`, `ArchitectureTest`, `check-ios-contract.mjs`, full suite green.
- [ ] **Step 5: Docs, handbook, decision and release rows; Notion** `node scripts/boop-notion-sync.mjs plan` → apply → `check` exits 0.
- [ ] **Step 6: Merge, push, deploy green.** Production: `app_notification` row count unchanged; after 48 h the AI log shows zero calls for every generator switched off:
  `select feature, count(*) from llm_log_history where created_at > now()-interval '48 hours' and feature in (<off list>) group by 1` → no rows.
- [ ] **Step 7: Commit** `refactor: web-only generators off and the bell leaves the server (mezo-…)`; Hungarian report to the owner with the before/after AI spend.
