# Retiring the web app and the web-only server areas (design)

Status: for owner approval · 2026-11-19 · owner decision of the same day (this conversation)

## 1. Intent

On 2026-11-17 (#48) the owner stopped developing the web app and kept it deployed as-is. On 2026-11-19 he
went one step further: **"a webes appban már semmit nem fogok használni, csak az iphone appot"**, and chose
the option *"Web le + kivezetés"* — switch the web app off **and** remove the server areas that only the web
app ever used, **keeping their data** in the database.

Why: every backend change still has to keep the frozen web app compiling and green, web-only background work
keeps running and spending AI money nobody reads (≈ 4 of the ≈ 8.3 USD AI spend of the last 30 days), the
Boop chat keeps drawing on web-only data the owner no longer maintains, and the suite carries tests for code
with no user. The test-time saving is now small (mezo-dubmh already cut CI from 59 to ~20 min); cleanliness,
cost and focus are the gain.

## 2. Goals, non-goals, anti-goals

**Goals**
- The web app is no longer built, deployed or served; `frontend/` leaves the repository (recoverable from git).
- The web-only server areas (§4.2) are gone: code, endpoints, contract fragments, background jobs, tests.
- Their tables and rows stay untouched in production.
- Kept code that read those areas stops reading them; nothing the iPhone calls changes behaviour.
- Web-only background generators inside the kept AI areas stop running (§4.3).
- CI, deploy, docs, house rules and the Notion space describe the iPhone + server world only.

**Non-goals**
- No change to Boop's AI brain (companion, character konzílium, proactive memory, people) beyond the reads and
  jobs named in §4.3 — slice B8 decides what the "one AI" keeps.
- No new iPhone feature, except removing the links that point at the web app (§4.5).
- No endpoint the iPhone calls changes; no endpoint of a **kept** area is removed even if only the web called it
  today — the remaining Boop slices (B6 Plan, B7, B8, L-slices) are planned to call them.
- No data deletion, no Liquibase drop of any table.

**Anti-goals (a failure even if everything compiles)**
- Anything on the iPhone breaks: login, chat, the day page, food, training — in particular **exercise images**
  (§4.4) and Watch/Health ingest.
- Any production row is lost or rewritten.
- A web-only job keeps running after its code is gone (e.g. a stale cron property re-enabling it).

## 3. Constraints and facts found (2026-11-19)

- **The iPhone calls 123 operations** (`ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`); none belongs
  to a removed area. (`getIntentionDay` is the intention area, which stays.)
- **Routing:** `k8s/ingress.yaml` sends `/api` to the backend and `/` to the frontend service. ArgoCD runs with
  `prune: true`, so deleting `k8s/frontend/*` removes the deployment.
- **Exercise images live in the web app:** `frontend/public/exercises/` (15 MB, `<slug>-a.jpg` / `-b.jpg`). The
  catalog stores root-relative paths (`/exercises/barbell-row-a.jpg`, see
  `backend/src/main/resources/content/exercise-catalog.json` and the `mezo-8xdl.1` changelog script), and the
  iPhone resolves them against the API origin (`BoopConfig.swift`). They are served today by the **web server**.
- **The iPhone links to the web app** in three places (`BoopConfig.webAppURL`): `Terv/TervView.swift:24`,
  `Nap/NapView.swift:146` ("Az edzés- és étrendtervedet a webes appban állítsd be…") and
  `Shell/AccountSheet.swift:24` ("Webes app — ami még csak ott van meg").
- **Only-on-the-web settings that remain:** the weight goal (the `goal` area has 24 operations, none in the iPhone
  filter) and a few schedules (sport/gym week). Training-plan setup is being built natively (block builder,
  #49–#51); diet settings, supplements, recipes and pantry are already native.
- **Push:** the only push sender today is **web push** (`notification/service/PushSender` → `techcore/webpush`).
  The iPhone registers an APNs device (`DeviceController`, `ApnsDeviceService`) but nothing sends APNs yet.
- **Habits are not hand-ticked:** of the last 14 days' manual habit rows all are `missed`/`pending` (auto-closed);
  the derived ones re-state signals the iPhone already logs (training done, weight logged, sleep window). Nothing
  of value to Boop is lost.
- **The web bell has not been opened since 2026-10-12** (every notification after that date is unread), and
  only 2 weight-goal suggestions are pending, the newest from 2026-09-14. Nothing has been approved through the
  web for over a month; retiring the bell changes nothing the owner does today.
- **Every stored exercise image path is `/exercises/<file>`** (production read of `exercise_catalog`, both
  columns, 2026-11-19) — no custom or uploaded media elsewhere.
- **Production rows in the removed areas** (kept): habit 1 142 days / 32 definitions, life-goal 308 pillar days,
  level-up events 322, skill progress 33, medication 0, needs 9, ritual 10, quest/challenge data, tutorial 1.

## 4. The design

### 4.1 Approaches considered

| Approach | What | Trade-off |
|---|---|---|
| Web off only | Remove the web app, CI jobs and deploy; server unchanged | Small; web-only jobs, AI spend and couplings stay |
| **Web off + web-only server areas out, data kept** (chosen) | The above + §4.2 removed, §4.3 switched off | Several sessions; Boop chat stops seeing habits / life goals |
| Same, and drop the data | Also delete the rows/tables | Irreversible for no gain; rejected |

### 4.2 Server areas removed (code, endpoints, contract fragments, jobs, tests; tables kept)

`gamification`, `quest`, `progression`, `activity`, `medication`, `needs`, `ritual`, `tutorial`, `habit`,
`lifegoal`, `admin` (+ `api/feature/admin-*`), `telemetry` (web screen events), `appnotification` (the web bell —
**last**, in step 8, see §4.3), and the **web-push half of `notification`** (`PushSender`, push subscriptions, `NotificationDispatchJob`,
notification prefs/schedules, `techcore/webpush`). **Kept in `notification`:** APNs device registration
(`registerApnsDevice` / `unregisterApnsDevice` are iPhone operations).

Jobs that disappear with the code: `QuestJob` (2 crons), `HabitJob`, `LifeGoalEvalJob`,
`ScreenEventRetentionJob`, `NotificationDispatchJob`. Their `mezo.*` properties leave `application.yml`,
`k8s/backend/deployment.yaml` and test properties.

**Kept code that reads them** (found by import, to be cut cleanly — each read is removed, not stubbed):
`train` → `progression` (XP on workouts, 8 imports); `companion` → `habit`, `ritual`, `medication`,
`gamification`, `progression`, `people`-adjacent prompt blocks; `character` → `habit`, `needs`, `medication`,
`notification`; `proactive` → `medication` (8), `lifegoal`, `needs`, `habit`; `meal` → `medication`;
`dayclose` → `ritual`; `people` → `ritual`. Prompt blocks that cited habits, life goals, medication cycles,
rituals or XP disappear from Boop's context.

**The day close and `ritual` (builder's call, recorded here).** `DayCloseService` (iPhone operations
`putDayClose`, `getDayClose`, `listDayCloses`) still writes the legacy ritual row and publishes
`RitualClosedEvent`, which three kept listeners consume (`people/ReflectionMentionListener`,
`companion/embedding/ReflectionEmbeddingListener`, `train/TimingProfileListener`); its reads also merge old
web-only closes into the iPhone history. Because nothing the iPhone calls may change and chat memory is out of
scope: those listeners move onto `DayClosedEvent`, the legacy write stops, and a small **read-only** reader of the
ritual tables stays inside `dayclose` so the old closes remain in the history. The rest of `ritual` goes.

### 4.3 Kept AI areas: web-only generators switched off, code stays for B8

`proactive` (feed, challenges, memoirs, weekly reviews, predictions, experiments), `character` (konzílium,
team chat) and `companion` are woven into the chat and memory the iPhone uses, and B8 plans to build on them.
They are **not** removed. Only the generators whose output is shown **solely on the web** are switched off by
configuration: the **contextual feed** (`proactive_feed`, ≈ 3.8 USD/30 d), **challenges** (`proactive_challenge`,
≈ 0.5 USD) and the **team chat** (`team_chat`) for certain, and **every other `proactive` / `character`
generator that passes the same test** — memoir, weekly review, prediction, experiment, portrait, team edition.
The test, applied per generator: its output is shown only on the web (or only through the bell) **and** it is not
an input to the chat, the memory or anything the iPhone shows. Anything that fails the test stays on and is noted
for B8.

**The bell (`appnotification`) goes last**, after the generators are off: ~25 kept classes (companion 10,
proactive 8, character 4, goal 2, …) emit into it, so cutting those calls is a companion edit and runs after
steps 5–6, not beside them. Items still waiting in it (2 goal suggestions, memory candidates) stay in their tables
as they are. Approving things returns to the owner when Boop's proposal cards arrive (B7), not before.

### 4.4 Exercise images move to the backend, same URLs

The 15 MB `exercises/` folder moves into the backend as static content and is served at the **same path**
`/exercises/<file>` (ingress rule `/exercises` → backend; Spring static resource handler, long cache headers,
public — the images are not personal data). Stored catalog paths and the iPhone stay unchanged. Verified on the
phone before the web deployment is deleted.

### 4.5 iPhone: the web links go

The two "állítsd be a webes appban" cards and the account sheet's "Webes app" row are removed (`webAppURL`
deleted). No replacement card: the owner asks a session for web-only settings until B6 (§6). Requires `xcodebuild test`, a build and an install on the phone.

### 4.6 Repository, CI, deploy, docs

- `frontend/` deleted; `api/generate` stops producing frontend types; `contract-drift` keeps only the
  fragments → `api/openapi.yml` half (and the iPhone's copy of the spec stays in sync as today).
- `ci.yml`: `test-frontend` and `test-layout` removed; `ci-scope.sh` prefixes lose `frontend/`;
  `require-checks.test.sh` job count updated. `deploy.yml`: the frontend build/push and `force_frontend` input
  removed; `ghcr-retention.yml` frontend image cleanup checked.
- `k8s/frontend/*` deleted, ingress `/` rule removed (§4.4 rule added first).
- House rules (`AGENTS.md`, `CLAUDE.md`), the `verify` and `folyadek` skills, `docs/infrastructure/*` lose the
  web obligations. Feature docs of removed areas get `status: retired` with a dated note (history kept);
  `key_files` pointing at deleted paths are fixed so `lint-docs` stays 0 errors / 0 stale; CODEMAP regenerated.
- Owner record: decision row in `docs/boop-handbook/_dontesek.json` and `14-decisions.md` (#52), handbook pages of
  retired areas updated, release rows for merges he can feel; Notion synced.

### 4.7 Order (each step its own merge; main green after each)

1. **Exercise images on the backend** (§4.4) — live and verified on the phone.
2. **iPhone links removed** (§4.5) — installed on the phone.
3. **Web off:** frontend deployment, ingress `/`, deploy and CI jobs, `frontend/` deleted, contract-drift trimmed.
4. **Leaf areas out:** `tutorial`, `telemetry`, `admin`.
5. **XP world out:** `gamification`, `quest`, `progression`, `activity` (incl. the `train` → `progression` cut).
6. **Daily-life areas out:** `habit`, `lifegoal`, `needs`, `ritual`, `medication` (incl. companion/character/
   proactive/meal/dayclose reads).
7. **Web push out**, APNs registration kept.
8. **Web-only generators off, then the bell out** (§4.3), and docs/rules/Notion close-out.

Steps 4–7 touch different packages and may run as parallel sessions once 3 is merged; 5 and 6 both edit
`companion` prompt assembly and must not run at the same time.

## 5. Done when (Kész, ha…)

- iPhone: login, day page, chat, food capture, training (with exercise images), Watch/Health ingest all work on
  the installed build; no web link remains; no emoji, no "Mezo" in a visible string.
- `https://46.225.112.172.sslip.io/` no longer serves the web app; `/api/**` and `/exercises/**` answer.
- Backend: full suite green with `-Dmezo.test.use-testcontainers=true`, `ArchitectureTest` green; no `@Scheduled`
  left in removed packages; no `mezo.*` property of a removed area left in config.
- Production: row counts of the removed areas' tables unchanged after deploy; backend logs free of new errors for
  24 h; AI spend of `proactive_feed`, `proactive_challenge`, `team_chat`, `quest_flavor` is zero after the switch.
- `xcodebuild test` for BoopKit and Boop green; `node scripts/gen-codemap.mjs`; `lint-docs` 0 errors / 0 stale.
- Notion `check` exits 0.

## 6. Owner answers (2026-11-19)

- **Settings only the web has today** (the weight goal, sport/gym week): **"Kérésre megcsinálod."** The web goes
  off as planned; until the Plan slice (B6) gives the iPhone these screens, the owner asks and a session makes the
  change through the existing backend endpoints of the kept `goal` / `train` areas (which is why those endpoints
  stay, §2). No interim native screen.

**Calls made by the designer** (check while reading): the day close keeps its listeners and old web closes via a
read-only reader (§4.2); every web-only `proactive` / `character` generator is switched off by one test, not only
the three named (§4.3); the bell goes last and its pending items stay as they are (§4.3); exercise images keep their
URL (§4.4); steps 5 and 6 never run at the same time (§4.7).

## 7. Left to the builder

Exact class-level cuts, test fixture clean-up (`AbstractIntegrationTest` populators of removed areas), Liquibase
untouched, the static-resource mechanism for §4.4, how each generator in §4.3 is switched off (existing
`mezo.feature.*` flags first), and the per-step gates.
