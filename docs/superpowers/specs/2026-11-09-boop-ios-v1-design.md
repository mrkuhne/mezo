# Boop — native iOS app, v1 (the morning) — design

> **Look superseded 2026-11-10:** the visual canon is now **Napkelte** —
> [`2026-11-10-boop-napkelte-design.md`](2026-11-10-boop-napkelte-design.md). Everything here that is not about looks
> (data, backend, install, slices, owner decisions in §8) still holds.

- **Date:** 2026-11-09 (revised the same day: **Lágy pivot**, §0) · **Epic:** `mezo-r36n9` · **Status:** draft for owner OK (builder check done, §8)
- **Design canon:** the **Lágy** direction (`.claude/skills/lagy/IRANY.md` + `docs/design_2.0/prototypes/kepes/b/*`,
  currently on branch `claude/mai-napom-custom-graphics-eedeb2`), built natively. The orb, Boop's voice and
  "A nap energiája" from the first spike are merged into it in Lágy dress.
- **Approved look so far:** the Xcode spike in [`docs/design_2.0/prototypes/boop-ios-spike/`](../../design_2.0/prototypes/boop-ios-spike/README.md) — the **Lágy** files (`Lagy*.swift`): Nap · Mai morning + the five morning steps
- **Decided by the owner in this brainstorm** (marked *owner* below); everything marked *call* is the
  designer's call, open to correction.

## 0. The Lágy pivot (owner, 2026-11-09, supersedes earlier wording below)

After the first spike round the owner said nothing had been carried over from the **Lágy** prototype,
where many decisions were already settled, and decided (*owner*):

- **Lágy is the design canon for Boop.** The whole Lágy app (five domains: Nap, Edzés, Fuel, Mezo→Boop, Én)
  is the target, built as a native iOS app. Light warm paper, white cards, one sage accent + one
  deep-green card per page, photo heads on every page, Outfit + Manrope, the Lágy glyph family, chips,
  rings / bars / level tubes. Lágy's rejections apply (no vessels/tanks, no dark header, no many hues).
- **Merged in from the first spike, in Lágy dress:** the **living orb** (now inside the page's single
  deep-green card as readiness, and Boop's small figure on Boop cards), **Boop speaks** (the verdict
  read aloud in Hungarian and typed in sync, accent phrases deep green and tappable), and
  **A nap energiája** (white card: sage energy curve, anchors, busy ribbon, magnifier, conflict callout).
- **The companion is called Boop, not Mezo** (*owner*): Lágy's "Mezo card" is the **Boop card**,
  "Mezo mondja" is "Boop mondja", the Mezo domain in the bottom bar is labelled **Boop**.
- **All iteration happens in the iOS Simulator** from now on (*owner*) — no HTML artifacts for Boop.
- Dropped from the first spike: the dark sky ground, mood-tinted multi-hue palettes, the liquid-tank
  check-in, serif type, SF Symbol icons.
- Kept unchanged: every backend / data / install decision (§3, §4.3–§4.5, §8).

Where a later section still describes the dark first-spike look, §0 and §4.2 win.

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
- The **Lágy Nap · Mai morning** with orb, Boop's voice and the energy curve, as approved in the spike (§4.2).
- Apple Health ingestion (sleep with stages, steps, heart rate, resting HR, active energy, workouts)
  and device-calendar ingestion from first launch.
- Boop's morning brief reads aloud in Hungarian, typed in sync.
- Runs on the owner's iPhone 17 Pro Max via free Apple ID, with a **one-command weekly reinstall**.

**Non-goals (v1)** — later slices, not forgotten
- The other domains' full functions (training plans/active workout, full Fuel, Boop chat/team, Én),
  evening ritual, journal, people. Their Lágy landing pages may exist in the spike as the app shell,
  but their real flows are later slices; the web app keeps covering them until Boop takes them over.
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
(gate 3), then build → test → simulator check → install on phone → report. The **Lágy** canon governs
every Boop screen (§0); the Lágy HTML prototype is the reference for structure and content, the
simulator spike is the approved look. CLAUDE.md must be updated to say so (Boop = Lágy, simulator-first).

### 4.2 The morning screen — Nap · Mai, Lágy skeleton (approved spike: `LagyMai.swift`)
Light paper ground; status bar white on the photo, dark once the page scrolls onto paper. Top to bottom:

1. **Photo head** (full bleed, ~440 pt, warm grade + scrims): logo mark + "boop", "+", bell with count,
   avatar; the Nap tabs as glass pills (Mai · A napom · Beszélgetés · Rutin, a dot on A napom in the
   morning); at the foot eyebrow "Jó reggelt · hétfő, 06:50", title "Kezdjük a napot", one line, one
   white pill **Kitöltöm** → check-in. The paper panel rises over the photo (−32 pt, 34 pt radius).
   Scrolling collapses it into a frosted compact bar ("Mai" + date).
2. **The verdict** — Outfit 28, the key phrase in deep green ("Jól aludtál: *7 óra 12 perc*. Este szorít a naptár.").
3. **Boop mondja** — a tiny orb + label, speaker toggle, "Újra". The longer brief in Manrope, typed **in sync
   with the Hungarian voice word by word**; accent phrases deep green, dotted underline, **tappable** →
   a Lágy sheet (photo strip, title, chips, a graphic: sleep stages, resting-HR week, the day).
4. **Készenlét** — the page's **one deep-green card**: the **living orb** (Metal shader glass sphere,
   sage liquid filling to readiness, tilt/drag slosh, tap ripple + haptic, word surges) with the count-up
   number "78 · a 100-ból", beside it the state line and three thin bars (sleep, resting pulse, deep sleep;
   peach when weak).
5. **A nap energiája** — white card: sage energy curve 06–24 with "most" line; anchors (meal, training,
   sleep) in Lágy hues, conflicts lifted on a stem; meetings only as the 15-minute **busy ribbon**;
   clusters when < ~1.4 h apart; press-and-drag magnifier (time, energy %, what is on); a peach callout
   with Boop's note and the action for conflicts; "<n> esemény · Google Naptár".
6. **Mai szintek** — sky-tinted card with four level tubes (kalória, fehérje, alvás, mozgás; peach under 50 %).
7. **Utána jön** — photo rows (44 pt round photo, title, chips, chevron): Alvás (beolvasva), Mai szándék,
   Mérlegelés, Első étkezés; a done step gets a check badge and its summary chip. The hero's check-in is
   not repeated in the list (it appears there only once done).
8. **Észrevétel** — one observation card (warm status chip, sentence with a deep-green phrase, evidence
   dots, Igaz / Nem rólam szól / Majd meglátjuk); "Mind" → Boop észrevette.
9. **Boop card** — white→sage gradient, "BOOP", one concrete sentence, one soft action; the orb is Boop's figure.
10. Floating bottom bar: Nap · Edzés · Fuel · Boop · Én with Lágy glyphs.

The five morning steps are Lágy inner pages (`LagyFlows.swift`): photo head with back + crumb, paper body,
a Boop card at the end that speaks. **Check-in**: one question at a time, Lágy level tube (draggable) +
big number + 2/4/6/8/10 scale, Vissza / Kihagyom / Tovább, "Most csak ennyi"; summary rows with bars,
Gondolatok, Boop, Mentés. **Mai szándék**: the creed as the deep card, three numbered focus cards, Boop's
feedback adds fit chips. **Mérlegelés**: ruler dial; then deep card (today + trend), the weight road chart
with the 79 kg goal line, a three-column card. **Első étkezés**: photo tile + text pill; photo analysis
(scan line twice, label pill Felismerem… → Elemzem… → Kész · 86% biztos, corner marks, no circle);
ingredient rows with photos and ± grams, stacked macro bar; verdict with score chip, ring + macro bars in
the deep card, improvement chips, week tubes. **Boop észrevette**: observation cards with evidence dots and
"Figyeljem tovább?".

Entrance: soft rise on first load; **reduced motion** lands on end states (no typing, no slosh).
Icons: the **Lágy glyph family** (generated from the prototype's `G()` table as vector assets), no emoji,
no SF Symbols except system chevrons/arrows.

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
- Light Lágy UI in v1 (Lágy's dark theme is a later slice); Lágy glyph family as vector assets; Outfit + Manrope bundled (OFL).
- Hungarian only in v1. Widgets / lock screen / Live Activities are the first follow-up slice.
- Calendar via EventKit (Google account in iOS Settings), not Google OAuth.
- The Xcode project lives in the monorepo under `ios/`; bundle id `io.mrkuhne.boop`.
