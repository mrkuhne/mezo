# Boop — native iOS app, v1 (the morning) — design

- **Date:** 2026-11-09 · **Epic:** `mezo-r36n9` · **Status:** draft for owner OK (builder check done, §8)
- **Approved look:** the Xcode spike in [`docs/design_2.0/prototypes/boop-ios-spike/`](../../design_2.0/prototypes/boop-ios-spike/README.md), variant **A "Orb"**
- **Decided by the owner in this brainstorm** (marked *owner* below); everything marked *call* is the
  designer's call, open to correction.

## 1. Intent — what this is and why

Mezo's end goal is an **iPhone app**, and the owner wants it built in iPhone language, not as the
web app in a wrapper (*owner*). The new app is called **Boop** (*owner*). The web PWA stays alive
while Boop grows and **is shut down once Boop is complete** (*owner*).

The owner's reasons, in his words and from the session:

- The web app often feels **clunky** on the phone; the target is an app that could win an award for
  a **unique feeling and experience** — animation, "filling" elements, premium airy design, orbs —
  inspired by **Ultrahuman** (calm, premium, animated, "what to do now" instead of a chart wall) and
  **Oura** (clean, orderly, beautiful icons).
- Most of what he logged by hand now **arrives automatically**: Apple Health was proven on his
  phone on 2026-11-09 (free Apple ID, HealthKit entitlement signs) — sleep **with stages** comes from
  **Sleep Cycle**, steps/heart rate/resting HR/workouts come from his **Huawei** watch via Apple
  Health. HRV does **not** arrive (Huawei does not write it).
- **The calendar is critical** (*owner*): "if it can't see that I have no time to train because I
  have to work, the whole recommendation collapses in the morning."

**Boop v1 = the owner's morning**, the first 3–4 times he opens the app each day (his description):

1. Wake up, stop Sleep Cycle → Boop has already pulled the night: how he slept, what it concludes,
   what kind of day to expect; today's food target, planned movement, and how they relate to the
   sleep — **one companion voice** that, from the night plus the last days/weeks' trends **and the
   calendar**, says *how to approach today according to his plans*.
2. First **check-in**: how does he feel.
3. **Daily intention + three daily goals**, with AI feedback on whether they fit his calendar,
   training and weight goal, plus a tip when it makes sense.
4. **Weight**: where he stands vs the goal — fine / daily fluctuation / longer drift that is a problem.
5. **First meal**: AI verdict on the food itself, then in the context of the day's and week's
   kcal/macro/movement plan.
6. With spare time: **new patterns and correlations** Boop noticed.

Still logged by hand: weight, meals, free-text journal/activity, people, check-ins.

## 2. Goals, non-goals, anti-goals

**Goals (v1)**
- A native SwiftUI app that runs the six morning moments above end to end against the real backend.
- The **living-orb morning screen** exactly as approved in the spike (§4.2).
- Apple Health ingestion (sleep with stages, steps, heart rate, resting HR, active energy, workouts)
  and device-calendar ingestion from first launch.
- Boop's morning brief reads aloud in Hungarian, typed in sync.
- Runs on the owner's iPhone 17 Pro Max via free Apple ID, with a **one-command weekly reinstall**.

**Non-goals (v1)** — later slices, not forgotten
- The other domains as full screens (training plans/active workout, full Fuel, Mezo chat/team, Én),
  evening ritual, journal, people. The web app keeps covering them until Boop takes them over.
- Home/lock-screen widgets, Live Activities, Control Center, Siri/Shortcuts, Apple Watch — the first
  follow-up slice (see §8 Q2).
- Server push notifications (impossible on a free account; see §3). Cloud TTS voice.
- Migrating the owner's old web-account history (Boop starts with a fresh account, *owner*).
- English UI (Hungarian only in v1, *call*; the backend is bilingual so it can come later).

**Anti-goals** — would be a failure even if it "works"
- A web view or a re-skin of the PWA. No HTML/JS UI in the app.
- A **chart wall**. The morning answers "how do I approach today", one verdict + one action first.
- Showing every calendar event as an icon (the CEO-day problem): only body-relevant anchors.
- Changing what the owner's **web app** shows while Boop is built: shared AI paths (morning prompt,
  meal coach) must not be altered in a way that changes web output (§5 traps).
- Duplicate nights or workouts when HealthKit re-syncs.

## 3. Constraints

- **Free Apple ID (Personal Team), owner reinstalls weekly** (*owner*). Consequences, verified or
  researched: profiles expire after 7 days; ≤ 3 sideloaded apps per device; ≤ 10 App IDs per 7 days
  (keep bundle IDs stable, never rename); allowed capabilities include HealthKit, App Groups,
  Background Modes, Keychain sharing; **not** allowed: push notifications, iCloud, Associated Domains,
  Sign in with Apple. Local notifications, widgets, Live Activities (local updates) are fine.
  HealthKit *background delivery* on a free team is unconfirmed → design for **sync on open**.
- **Same backend, new empty account** (*owner*): Boop talks to the existing Spring API at
  `https://46.225.112.172.sslip.io/api`; the owner gets a second user via the invite flow.
- iOS 26+ (the owner's phone runs iOS 27; Liquid Glass and `MeshGradient` APIs available) — *call*.
- **Hungarian** copy, business-plain, the companion's warm voice.
- The owner is a non-engineer: every owner-facing step (install, permissions) must be one action
  or a written walkthrough.

## 4. The how — decided parts

### 4.1 Workflow (changes the house rhythm for Boop) — *owner*
Visual iteration happens **directly in Xcode + the iOS Simulator**, not in HTML artifacts. A Boop
screen gets a throwaway SwiftUI spike the owner reviews in the simulator (gate 2), then the plan
(gate 3), then build → test → simulator check → install on phone → report. If a page or diagram is
ever needed on the web, it is a new Boop-specific artifact. The Folyadék/Lágy directions do **not**
apply to Boop; Lágy continues elsewhere (*owner*). CLAUDE.md must be updated to say so.

### 4.2 The morning screen (approved look, spike variant A)
Dark, a sky gradient tinted by the day's state. Top to bottom:

1. **Date + greeting.**
2. **The living orb** — Boop's face. A Metal-shader glass sphere: marbled colour flowing inside,
   a liquid filling to the **day's readiness** on open (ease-out ~1.8 s) with waves that swell and
   settle, caustics, rising bubbles, rim light, specular glint, soft halo. **Tilt** (CoreMotion
   gravity) and **drag** slosh the liquid (under-damped spring), **tap** sends a ripple from the tap
   point with a soft haptic, every **spoken word** surges the liquid. **Palette = state**: good →
   indigo/violet/sky/mint; okay → teal/mint/sun; tired → amber/peach/rose; the background sky follows.
   The readiness number counts up inside it.
3. **Boop speaks** — label with a "talking" dot, speaker toggle, "Mondd újra". Headline in a serif
   ("Jó napod lesz" / "Átlagos nap jön" / "Kíméld ma magad"), then the brief in serif body text, left
   aligned, typed **in sync with the Hungarian voice word by word**. Key phrases are bold with a
   dotted underline and **tappable**: they open a sheet with the data behind them (sleep stages,
   resting-HR week, the day). One primary action button appears when Boop finishes (e.g. "Edzés
   áttétele 18:30-ra").
4. **A nap energiája** — the day 06:00–24:00 as a liquid energy curve with a "most" line.
   **Anchors** (icons on the curve): meals, training, sleep; **conflicts** lifted above on a stem.
   **Meetings never become icons**: they form a 15-minute **busy ribbon** under the curve (darker =
   overlapping). Anchors < ~1.4 h apart merge into a **numbered cluster**. **Press-and-drag**
   magnifier: time, predicted energy %, what is on at that moment, 15-minute haptic tick. A callout
   under the curve explains the selected anchor with Boop's note and, for conflicts, an action.
   Header: "<n> esemény · Google Naptár".
5. **Mai keret** — three filling capsules: sleep, food (eaten/target kcal), movement (done/planned).
6. **Hogy érzed magad?** — the check-in entry.
7. Then the rest of the morning: intention + 3 goals, weight, first meal, patterns (§4.3).

Staggered entrance choreography; full **reduced-motion** branch (no typing, no slosh, instant fill,
voice off by default). Icons: SF Symbols in v1 (*call*, see §8 Q3).

### 4.3 The six moments — what each needs

| Moment | Backend today | v1 work |
|---|---|---|
| 1 Morning brief + energy curve | `morning` message (05:45 cron, lazy on `GET /api/proactive/feed`) **strips sleep & weight** and runs before sleep is logged; `sleep` message is separate, event-driven | **New**: a Boop **morning brief** generated **on demand after the app's sync** (sleep + calendar + trends + today's plan) — a new message kind, so the web's `morning` message is untouched. Returns: readiness 0–100 + state (good/okay/tired), headline, brief text with marked key phrases (each with a target: sleep/heart/day/…), one action, the energy curve (hourly values), anchors and conflicts. |
| 2 Check-in | `GET/POST /api/biometrics/checkin`, `GET /checkin/plan` | Native check-in UI on the existing endpoints. |
| 3 Intention + 3 goals | `GET /api/intention/day/{date}`, `PUT /creed`, `POST /focus` (≤ 3), `POST /reflect`; **no AI feedback exists** | **New**: AI feedback on the day's intention + foci vs calendar, training plan and weight goal (one short verdict + optional tip). |
| 4 Weight | `POST /api/biometrics/weight` triggers the `weight` message (raw + EWMA trend), `GET /weight/trend`, `GET /api/goals/{id}/overview` | Native weight entry + show the `weight` message and trend state (fine / fluctuation / drift). |
| 5 First meal | `POST /api/meal`, `POST /api/meal/ai-draft` (photo/text), `GET /api/meal/{id}/coach`, `GET /api/fuel/day/{date}` | Native photo/text capture on the existing draft→confirm flow; show the coach verdict and the day state. |
| 6 Patterns | `/api/companion/pattern`, `/pattern/monitor`, `/observation`, `/memory/similar-days` | Read-only list of what Boop noticed. |
| — Onboarding | Scheduled jobs only run for **onboarded** users (`UserFanOut`): profile → first weight → `POST /api/auth/onboarding-complete` | Native minimal onboarding: login/register with invite code, profile, first weight, permissions (Health, Calendar, motion). |

### 4.4 Data in

**Apple Health** (*call* on the shape): on first launch a **60-day backfill** (*owner*, §8), then on
every app open (and opportunistically via background refresh) an anchored HealthKit query collects
new samples since the last anchor and sends them to
**new idempotent ingestion endpoints** keyed by the HealthKit sample UUID:
- **Sleep nights** → `sleep_log` with phase minutes + hypnogram, **source `apple_health`**
  (requires widening `sleep_log.source` beyond `varchar(10)` and its CHECK, and the contract
  pattern) + an external id for upsert. A night with stages from Sleep Cycle must land as one row
  per night, never duplicated on re-sync.
- **Daily metrics** (new table): steps, resting HR, average/min/max HR, active energy, per day.
- **Workouts** (new table, display + AI context only in v1): type, start/end, kcal, avg HR, source.
  They do **not** raise the calorie target automatically in v1 (*call*: avoids double counting with
  manually logged sessions; see §8 Q4).

**Calendar** (*call*): **EventKit on the device** — the owner's Google calendars reach EventKit
through the Google account in iOS Settings, so no Google OAuth, no verification, no 7-day token
expiry. Full-access permission. On open and on `EKEventStoreChanged`, Boop sends a **snapshot of
today + tomorrow** (title, start, end, all-day, calendar name) to a new endpoint that replaces that
day's snapshot server-side; the brief and the intention feedback read it. Known cost: Google→iOS
sync is fetch-based (15+ min latency); secondary/shared Google calendars must be enabled by the
user. Event titles go to the LLM — acceptable for the owner's own data.

### 4.5 App shape
- Xcode project in the monorepo under **`ios/`** (*call*), bundle id `io.mrkuhne.boop`, display
  name **Boop**, App Group `group.io.mrkuhne.boop` reserved for the widget slice. SwiftUI,
  Swift Concurrency, Observation, Swift Charts, Metal shader for the orb.
- **API client** generated from `api/openapi.yml` with Apple's swift-openapi-generator, filtered to
  the operations Boop uses (committed output or plugin — builder's choice).
- **Auth**: email + password login → 30-day JWT stored in the Keychain; on 401 or expiry → login
  screen (there is no refresh token). New account via an owner-created invite code.
- **Voice**: on-device `AVSpeechSynthesizer`, best installed hu-HU voice; the owner is told how to
  download the enhanced Hungarian voice.
- **Weekly reinstall**: a script (e.g. `ios/scripts/install-on-phone.sh`) that builds, signs with the
  personal team and installs on the cabled iPhone in one command; documented for the owner.

## 5. Prior art (recon, 2026-11-09)

- **Ultrahuman "Emerald" redesign (Jul 2026)** dropped the dashboard for context-aware "Next Best
  Actions", a daily **Windows** timeline of time-sensitive items, and one nightly sleep view; added
  light + dark mode. Takeaway: *verdict + next action, not charts*. (gadgetsandwearables.com,
  techtimes.com, Jul 2026.)
- **Oura**: calm, three scores on a Today feed, soft gradients, restrained type. **Whoop**: dense,
  dark, colour-coded recovery. Boop sits between: Oura's calm, Ultrahuman's action, its own living orb.
- **Native iOS on a free team**: Apple's capability table (checked in the browser 2026-11-09) —
  HealthKit, App Groups, Background Modes allowed; push, iCloud, Associated Domains not.
- **HealthKit sync**: anchored queries on foreground are the reliable path; background delivery
  entitlement on a free team is unconfirmed (Apple DTS forum threads).
- **Calendar**: EventKit + iOS Google account avoids Google OAuth; Google API in "testing" mode
  expires refresh tokens after 7 days and caps at 100 users.
- **API client**: apple/swift-openapi-generator 1.13 (SwiftPM plugin/CLI, async/await, `filter:`
  to keep the generated surface small).
- **Probe results** (owner's phone, 2026-11-09): Sleep Cycle → sleep with REM/core/deep/awake/in-bed;
  Huawei Health → steps, HR, resting HR, active energy, workouts; no HRV, no Huawei sleep.

## 6. Codebase terrain (recon, 2026-11-09)

- **Auth**: `feature/auth/service/AuthService.java:179-184` (HS256, 30 days, no refresh);
  public routes only `/api/auth/login|register` (`techcore/security/SecurityConfig.java:44`);
  invites `POST /api/admin/invites`; onboarding gate `feature/auth/service/UserFanOut.java:27`.
- **Contract**: `api/openapi.yml` merged from `api/feature/*/*.yml` via `api/generate/merge.yml`
  (a fragment missing there is silently dropped); `cd api/generate && npm run generate:api`;
  12-step recipe in `docs/features/_platform-api-backend.md` §7; CI `contract-drift` job.
- **Morning/sleep messages**: `proactive/service/CompanionMessageJob.java:41`,
  `CompanionMessageEventListener`; `docs/features/proactive.md` (morning prompt strips biometrics).
- **Sleep**: `sleep_log` (`…/202606101310_mezo-v67_create_sleep_log.sql`; phases + `source`
  CHECK `('manual','screenshot')` in `…/202607230957_mezo-dbsr_create_sleep_goal.sql:23-33`;
  contract pattern `api/feature/sleep/sleep.yml:116-118,176`); hypnogram jsonb `{bucketMin, stages}`
  (`SleepHypnogram.java`); `SleepLogService.java:29` insert-only, no (user, date) uniqueness.
- **No tables** for steps/HR/wearable workouts or calendar; "Ma (terv)" in prompts comes from
  `gym_schedule_slot`, sport schedule, run prescriptions, meal windows.
- **Meal coach**: `MealCoachEagerListener.java:30-39`, `MealCoachContextReader.java` (weekly
  context thin). **Weight**: `WeightTrendService`, `WeightDecomposition`.
- **Traps**: ArchUnit layering/no cycles/no class-level `@Transactional`/no `@Value`
  (`ArchitectureTest.java`); Liquibase jsonb `?` → `jsonb_exists()`; changesets `{ts}_{bd-id}_…`;
  new tables into `ResetDatabase` + a Populator; `node scripts/gen-codemap.mjs` in the same change;
  feature switches are global (companion, proactive, feed-job must be on); the morning prompt and
  meal coach are **shared with the web app** — new Boop paths, don't mutate the shared ones.

## 7. Left to the builder

- Readiness formula and the hourly energy-curve model (deterministic, from sleep vs baseline,
  resting HR vs baseline, recent load, circadian template, post-lunch dip, training boost) —
  must produce the three states and believable curves; document it.
- Conflict rules (e.g. < 45 min between a meeting's end and training; a meal window < 30 min) and
  the anchor clustering threshold.
- The exact new endpoint/table names and payloads, following the contract-first recipe.
- The Swift module structure, generated-client strategy, test layout.
- How the morning brief is cached per day and when it regenerates (new sleep, calendar change).
- Slicing of the plan (suggested: S1 app shell + auth + onboarding + install script; S2 HealthKit +
  calendar ingestion; S3 morning brief + orb screen; S4 check-in / intention+AI / weight / meal /
  patterns).

## 8. Decisions from the builder check (owner, 2026-11-09)

1. **Where the new account's plan comes from** — the owner logs into the **web app with the new
   Boop account** and sets up training schedule, meal windows, calorie target and weight goal there,
   as today. Boop v1 builds **no plan-setup screens** and copies nothing from the old account. The
   plan's first slice must make this an explicit owner step (invite → register → web setup) before
   the brief is judged.
2. **HealthKit backfill** — on first launch Boop pulls **the last 60 days** of sleep, heart rate,
   resting HR, steps, active energy and workouts, with visible progress; afterwards incremental by
   anchor. Ingestion endpoints must accept batches and stay idempotent. Readiness still needs a
   graceful state while baselines are thin (e.g. fewer than 14 nights).
3. **What the action buttons do** — "Told az edzést 18:30-ra"-style actions **move that day's
   planned session in the Boop account's training plan** (backend write), and the brief/curve
   recompute. Boop does **not** write to the device calendar (read-only EventKit). This only touches
   the Boop account, so the owner's old web account is unaffected.
4. **Screens beyond the morning hero** — check-in, intention + 3 goals with AI feedback, weight,
   first meal, patterns and onboarding/login get **one combined simulator spike round** for the
   owner's OK **before** they are built (gate 2 for those screens).

## 9. Designer's calls to check while reading

- LLM use: the Boop brief is cached per day and regenerated at most a few times (first sync,
  when the night's sleep arrives, on a meaningful calendar change — rate-limited); existing model
  tiers, no new budget.
- Wearable workouts are display + AI context only in v1; they do not raise the calorie target.
- Dark-only UI in v1; SF Symbols as icons in v1 (a custom Boop icon family can come later).
- Hungarian only in v1. Widgets / lock screen / Live Activities are the first follow-up slice.
- Calendar via EventKit (Google account in iOS Settings), not Google OAuth.
- The Xcode project lives in the monorepo under `ios/`; bundle id `io.mrkuhne.boop`.
