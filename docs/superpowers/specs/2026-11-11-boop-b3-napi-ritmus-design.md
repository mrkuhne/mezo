# Boop B3 Napi ritmus — the daily loop (design)

- **Status:** approved by the owner 2026-11-12 (plan `../plans/2026-11-11-boop-b3-napi-ritmus.md`) · **Date:** 2026-11-11 · **Issue:** `mezo-r36n9.13` · **Epic:** `mezo-r36n9`
- **Parent spec:** [`2026-11-11-boop-standalone-design.md`](2026-11-11-boop-standalone-design.md) §3 (spine), §4 (reuse map), §5 B3.
- **Builds on:** B2 Gerinc (`mezo-r36n9.12`, branch `feat/boop-b2-gerinc` — shell, `DayPhase`, `DayPlan.rows/goals`, Ma
  phases, capture sheet, Boop tab placeholder) and B1 Adatalap (`mezo-r36n9.11`, branch `feat/boop-b1-adatalap` —
  `health_sample` with 5-minute HR buckets and `hrv_sdnn`, wider `daily_metric`, background delivery, the original
  account). Both are on main since 2026-11-12.
- **Approved spike:** `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Ritmus*.swift`, screenshots
  `ritmus-*.png` (launch `-ritmus YES`, see §11). Look = Napkelte (spec `2026-11-10-boop-napkelte-design.md` §4).

## 1. Intent — why this slice exists

The owner's daily reflection loop (check-ins, journal, goal, evening close) has been **dormant since mid-October**.
The research assumed "too many taps"; the owner's own answer (2026-11-11) is different and sharper:

> "októberben utaztam sokat és nem volt internetem, ezért hagytam abba"

So B3's first requirement is **offline-first**: every capture works with no network and syncs itself later. Fewer
taps remains a design goal and is **counted** (§6), but the loop died on connectivity, not effort.

The payoff he wants from logging (owner): **"hogy lássam, hogyan változik az energiám a nap során"** — every
check-in lands as a dot on the day's energy curve next to Boop's prediction, with what the watch said at that
moment. B3 also restarts the calibration data B7 (day capacity) needs.

## 2. Owner decisions (2026-11-11, this brainstorm) — do not re-litigate

| # | Decision | Consequence |
|---|---|---|
| D1 | **Offline-first** (logging stopped because of no internet while travelling). | Check-in, goal, journal (incl. voice), evening close save on the phone and sync later; only Boop's own answers wait for the network, shown with one quiet line. |
| D2 | **Payoff = the energy of the day.** | Each check-in's energy is a dot on the day's curve (Boop's dashed prediction + the owner's line), tappable for the answers and the biomarker snapshot; shown after saving and in Ma · Napközben. |
| D3 | **Four moments a day: reggel, délben, délután, este.** | Three check-ins (morning, midday, afternoon); **the evening check-in IS the evening close** (one moment instead of two). |
| D4 | **Check-in = the five core items every time + ONE question of the day**; "Most csak ennyi" after the first answer. (Owner chose this over a 3-item rotation after seeing the trade-off: continuous core curves, ~30 s; he filled the core items every time in Aug–Oct.) | The adaptive "question of the day" comes from the existing plan engine (`adaptive_item` + its "why" line). The other non-core items appear only as the question of the day. |
| D5 | **Answer by swiping the orb, then tap Tovább** (not tap-a-number). | The approved Napkelte orb gesture (drag up/down, soft haptic per step); every item starts at the owner's last answer of the day, so "unchanged" is one tap. |
| D6 | **Goal of the day = ONE personal thing** (his examples: a workout, a big meeting/task, meal prep he kept postponing, a day of decisions), plus **Boop's own plan goals ticked automatically from the data**. | Morning: "Mi ma a legfontosabb?" typed, spoken, or one tap on a suggestion. Evening: one tap sikerült / részben / nem. |
| D7 | **Journal = evening, by voice.** | The close's step 4 is one tap to talk; the transcript is attached to the day; offline the audio waits on the phone and is transcribed later. A short spoken/typed line is also offered after each check-in (optional). |
| D8 | **Chat must already know everything** ("ne kelljen mindig kontextet adni magamról, célról, edzés, sport, kaja") — questions like "miért vagyok fáradtabb, mint tegnap?", "mire figyeljek ma az edzésen?", "mikor és mit egyek, hogy kimaxoljam a versenyt / röpit / kondit?", "mennyivel egyek edzés előtt?". | Boop's chat gets today's day block pushed into every turn (§7.6), shows what it sees, offers ready questions, and names the data in its answers. |
| D9 | Push/widget limited until the paid team → **design now, gate it**. | Local notifications ship in B3 (they need no paid team); the in-place widget and answer-from-notification come when the paid team lands (§7.8). |

Spike iteration decisions: swipe instead of tapping (D5); five core items + question of the day (D4); the close's orbs
are living orbs and Mesélj takes typing as well as voice (2026-11-12).

## 3. Goals · non-goals · anti-goals

**Goals**
1. A check-in that takes ≤ 30 s and works offline, with a frozen biomarker snapshot.
2. The energy-of-the-day curve with the owner's dots (the reason to log).
3. The goal of the day set in the morning in ≤ 2 taps.
4. A one-minute evening close producing **one day-close record** (replacing the three evening stores as the source of truth).
5. Voice journal in the evening, offline-safe.
6. Check-in and close reminders on the phone (local notifications); notification tap opens the flow directly.
7. A basic Boop chat tab that knows today without being told.

**Non-goals (B3):** live re-planning / new proposal kinds (B7); the Plan (B6); food/training capture (B4/B5);
memory corpus redesign (B8); Napló · Minták (B8); APNs push from the server; Watch check-in (B5); a full Napló
history browser (B3 ships only a minimal "Napok" list, §7.7).

**Anti-goals (failure even if it works):** a chore that nags (no streaks, no "missed" marks, no guilt copy — a missed
check-in is simply absent); anything that loses an entry because the network dropped; a chat that answers
generically or asks the owner to re-explain his day; emoji; visible "team" characters.

## 4. Constraints

- **Napkelte look**: painted sky per page, white type, serif questions/headlines, Outfit numbers, mono labels, glass
  cards, the orb as the answer. No emoji; no SF Symbols except chevrons/arrows. New glyphs: **microphone** and
  **offline cloud** (drawn in the outline family, spike `RMicGlyph`/`ROfflineGlyph`) go into the Napkelte glyph set.
- **One voice: Boop**; never "Mezo" in user-visible strings.
- **Nothing changes without the owner's tap** (B3 adds no automatic changes).
- **Free Apple team until B1 moves to the paid team**: no APNs, no new App IDs (a widget extension = a new App ID —
  waits), App Groups unavailable. Local notifications are fine.
- **LuLu blocks the simulator app's network** — live calls are tested on the phone or with stubbed transports.
- **Production data is the owner's** — reads free, writes per-change OK; no real data in fixtures/docs.
- **Server-zone dates:** the phone sends its local date; the server judges "now" in the owner zone
  (`mezo.wearable.zone`), never `LocalDate.now()` (the ritual 409 `RITUAL_NOT_TODAY` pattern must not be copied —
  an offline close synced after midnight must be accepted for its own date).

## 5. The experience (approved spike, screen by screen)

### 5.1 Reggel — accept the day + the goal
B2's plan card ("A MAI TERVED", rows, compact proposal, *Elfogadom a napot* / *Módosítom*) gains a block
**"MI MA A LEGFONTOSABB?"** above the proposal: a one-line field with the mic, and up to three suggestion chips
(label + a small "why": *a naptárból*, *8 napja nem volt*, *a heti terv*). One tap on a chip sets the goal; a set
goal shows as a row with a star glyph and "csere". Accepting the day collapses the card to "A nap terve
elfogadva · 07:42 · a nap célja: …". Taps: chip 1 + accept 1 = **2**.

Suggestions (my call, deterministic, no LLM): the longest/most-attended calendar event today (title from the
phone's calendar, never sent to an LLM in B3); today's training/sport session; a recurring personal thing that is
overdue — B3 starts with none of these learned and uses only the first two; "overdue" suggestions come from past
goals the owner typed (a goal text seen on ≥ 2 past days and not in the last 7 days).

### 5.2 Check-in (full screen, from the timeline "Kitöltöm", the lens pill, "+", or a notification)
Painted sky in the item's hue; mono label; serif question; a large living orb whose liquid = the value; "Húzd fel
vagy le · legutóbb N volt". Swipe up/down on the orb sets 1–10 (soft haptic per step), *Tovább* moves on,
*Kihagyom* skips the item, progress dots on top, **"Most csak ennyi"** (top right) from the second item on saves what
is answered. Items: energia, hangulat, feszültség, test, fejtisztaság, then **a nap kérdése** (the plan engine's
adaptive item, with Boop's "why" line under the question). Every item starts at the last answer given today
(else 5). Saved on the last *Kész* (or "Most csak ennyi").

**After saving** ("MENTVE · 16:02 / Ráesett a görbére"): the energy-of-the-day card with the new dot selected → the
check-in detail (all answers in a 3-column grid + "AZ ÓRÁD EKKOR": pulzus · HRV (with "lejjebb" when below usual) ·
lépés · alvás) → "Mondj hozzá egy mondatot" (voice, optional) → Boop's one line (needs network; offline: a calm
"amint lesz net…" line) → *Kész*. Offline: the "Nincs net · a telefonon van, elküldöm, amint lesz" chip and a
dashed ring around the pending dot.

Item kinds: B3 supports **scale items**; if the question of the day is `pain`, show the yes/no gate then the region
chips and intensity (the existing model); if `craving`, the scale then the four kind chips. (My call: the plan
engine may return these; they must not crash or be skipped silently.)

### 5.3 Napközben — the energy curve on Ma
Top of the Napközben section: "AZ ENERGIÁD MA · n / 3 kitöltés" card with the curve (06–24, Boop's dashed
prediction with a soft fill, the owner's solid line through white numbered dots, a "most" line, hour ticks, legend);
tapping a dot opens the same detail inline. Past check-in rows on the timeline select their dot; the next one shows
*Kitöltöm*. The prediction is the brief's existing energy curve (S3); no new model.

### 5.4 Este — the close (full screen, dusk sky)
"ESTI ZÁRÁS · EGY PERC / Zárjuk le a napot" — one page, four numbered steps, each ticks when answered:
1. **Hogy vagy most?** — energy 1–10 (one tap on ten small **living** level orbs — the same moving orbs as everywhere else, owner 2026-11-12; this is the evening check-in's energy).
2. **A nap célja** — the goal text + *Sikerült · Részben · Nem*; under it **"BOOP CÉLJAI · MAGUKTÓL"**: B2's
   `DayPlan.goals` (protein, session, bedtime) ticked from data ("146 g", "90 perc · pulzus átl. 128", "még előtted").
   B2 leaves the session's `met = nil` (the brief has no done flag); **B3 adds it** (§7.4a).
3. **Milyen volt a nap?** — five living orbs, *Nehéz … Rendben … Remek*.
4. **Mesélj** (ha van kedved) — one tap to talk, one to stop; "Leírom…" then the transcript; **or type it** in the
   "Vagy írd be…" field under the mic (owner 2026-11-12) — typed text lands in the same journal entry, no transcription.
   The same voice-or-type row is used for the optional line after a check-in.

*Lezárom a napot* is enabled once step 3 is answered ("A napot az értékelés zárja le, a többi elhagyható").
After closing: Boop's one sentence about the day, "A MAI NAPOD" summary (értékelés, a nap célja, energia este,
Boop céljai n/3, the journal quote), and the bedtime-reminder line ("22:15-kor szólok a lefekvés miatt"). Offline:
saved on the phone, Boop's sentence later. Ma's Este section shows the closed card (tap → the summary).
Taps: open 1 + 3 answers + close 1 = **5** (+2 with voice).

### 5.5 Boop tab — chat that knows today
Painted head with the orb, "Boop", "Kérdezz bármit a mai napodról — tudom, mi történt." → **"BOOP LÁTJA · MOST"**: a
horizontal strip of fact chips (alvás vs tegnap, HRV vs usual, today's sport + time, n kitöltés + last energy, kcal
eaten / target, the goal of the day, calendar remaining) → **"MA KÉRDEZHETED"**: 3 ready questions for today →
the conversation (owner bubbles right, Boop's serif answers left with the orb) → composer (glass capsule, text +
mic). Offline: the question is queued with "Nincs net · a kérdésed elküldöm, amint lesz".

### 5.6 Outside the app (designed; partly gated — §7.8)
Lock-screen notifications "Délutáni kitöltés — Mennyi energia van benned most? · 6 kérdés, fél perc" and "Zárjuk le
a napot" (tap = straight into question 1 / the close). A medium home-screen widget answering in place (one tap per
item on a 2×5 number grid, "Ennyi" to stop, "16:02 · n koppintás" when done) — spike `RitmusLock`.

## 6. Tap budget (counted in the spike, enforced in UI tests where possible)

| Flow | Gestures | Notes |
|---|---|---|
| Morning goal + accept | 2 taps | chip + *Elfogadom a napot* (typing/voice instead of a chip adds the text) |
| Check-in, full | 1 open + up to 6 swipes + 6 taps | unchanged items need no swipe; ~30 s |
| Check-in, rushed | 1 open + ≤1 swipe + 2 taps | energy, *Tovább*, "Most csak ennyi" |
| Check-in from notification | the same minus the open (the tap on the notification opens item 1) | |
| Evening close | 5 taps (+2 voice) | open, energy, goal, rating, *Lezárom* |
| Widget check-in (gated) | 1 tap per item, app never opens | |

## 7. How it works

### 7.1 Offline-first capture (the core mechanism)
- **BoopCore `Outbox`**: a persisted, ordered queue of pending writes (JSON files in Application Support, survives
  relaunch and reinstall-free updates). Each item carries a **client id (UUID)** and the **captured-at instant +
  local date**. The UI reads local state first (a `DayLedger` per date: check-ins, goal, close, journal, pending
  flags) and merges server state when it arrives — the curve and the summary never wait for the network.
- **Flush** on: app foreground, network path becomes satisfied (`NWPathMonitor`), after each new capture, and from
  the existing background sync hooks when B1's background delivery runs. Exponential backoff; 4xx other than 409/429
  marks the item failed and surfaces a quiet "nem sikerült elküldeni" row with *Újra* in the day's summary (never
  silently dropped).
- **Idempotency on the server:** every B3 write is an upsert keyed by natural key or client id, so a retry after a
  lost response never duplicates: check-in by `(owner, date, slot)` (exists), day close by `(owner, date)`, goal by
  `(owner, date)` (one goal), journal entry by `(owner, client_ref)` (new unique column).
- **Captured-at, not received-at:** requests carry `capturedAt` (the phone's instant); the server stores it as the
  record's moment (check-in `saved_at`) — a check-in synced at 23:00 for 16:02 must sit at 16:02 on the curve.
- **Voice offline:** the recording (m4a) is kept in the outbox; transcription runs on-device when
  `SFSpeechRecognizer(locale: hu-HU).supportsOnDeviceRecognition` is true (check at build time on the phone), else the
  audio is uploaded to the existing `POST /api/companion/transcribe` when online and the transcript then posted as
  the journal text. Audio is deleted after a successful transcript; never sent anywhere else.
- **LLM answers** (Boop's post-check-in line, the close sentence, chat) are requested only online; until then a calm
  placeholder line.

### 7.2 Check-in mapping onto the existing model
- Storage stays `check_in` (`POST /api/biometrics/checkin`, upsert by slot) — the web and every reader keep working.
- **Slot assignment** (my call): Boop's three moments map to the existing configured slot ids so the plan engine and
  the web keep their keys — reggel → `06:30`, délben → `10:00`, délután → `14:00`; a check-in done before 10:00 is
  reggel, 10:00–14:30 délben, after 14:30 délután (the phone decides by its local clock at capture). **A check-in never
  moves to another slot and never to `20:00`.** If its own slot is already done today, the sheet opens with a quiet
  line "A délit már kitöltötted 12:40-kor — felülírod?" and saving replaces that slot (full replace, as today).
- **Dates and time (my call):** the check-in request gains optional `capturedAt` (stored as `saved_at`; default =
  now, as today). `date` must be within today … today − 7 days in the owner zone, future → 400 (same window as the
  day close). An outbox item older than 7 days is shown as failed with its values, never silently dropped.
- **Items asked:** the five core + the slot's `adaptive_item` from `GET /api/biometrics/checkin/plan` (its
  `adaptive_reason` is the "why" line). The plan is fetched ahead (on foreground, for all three slots of today and
  cached) so an offline check-in still has its question of the day; with no cached plan, the question of the day is
  skipped. `asked_items` records exactly what was shown; `quick_exit = true` on "Most csak ennyi".
- **The evening** moment writes the `20:00` slot from the close: `energy` = step 1 and `day_rating` = rating × 2 (the
  1–5 close scale onto the 1–10 item) — part of the dual-write (§7.4). This is a **merge write** (a new service
  method, not `save`'s full replace): it sets only these two fields and `saved_at` when the row exists (e.g. a web
  evening check-in) and creates a minimal `done` row otherwise.
- **The optional line after a check-in** is stored as that check-in's `note` (the owner's habit in Aug–Oct: 36/41
  rows had a note), sent as a follow-up upsert of the same slot carrying all its values (offline: the note waits in the
  outbox; a voice note is transcribed first).

### 7.3 Biomarker snapshot (frozen at capture)
- **Computed on the phone at the moment of saving**, from HealthKit (works offline, and the phone has the freshest
  watch data): heart rate = the mean of samples in the last 15 min (fallback: the latest sample within 60 min);
  HRV = the latest `heartRateVariabilitySDNN` within 8 h, plus a 14-day median as "usual"; steps = today's cumulative
  count up to now; sleep = last night's asleep minutes (the night that ended today). Each field nullable with its
  sample time, and the source bundle id. B1 supplies the HealthKit read set (HRV SDNN is in B1's widened types).
- **Stored** in a new table `check_in_snapshot` (1:1 with `check_in` by id; columns `hr_bpm`, `hr_at`, `hrv_ms`,
  `hrv_at`, `hrv_usual_ms`, `steps`, `sleep_minutes`, `source`, `computed_by` (`phone`|`server`), soft-delete) — not
  columns on `check_in`, so the web's model and its CHECK constraints stay untouched. Sent inside the check-in
  request as an optional `snapshot` object; the server writes both in one transaction.
- **Server fallback** (my call, small): if a check-in arrives without a snapshot (the web app), the server fills one
  from B1's `health_sample` (HR 5-min buckets ±15 min of `saved_at`, latest `hrv_sdnn` within 8 h) + `daily_metric`
  steps (day total — flagged as a day total) + `sleep_log`, `computed_by = server`. Needs a time-window finder on
  `HealthSampleRepository` (B1 has upsert/soft-delete only).
- ArchUnit: the snapshot lives in **biometrics/checkin**; the server fallback must not import `wearable` from
  biometrics (wearable→biometrics exists → cycle). Use a port in biometrics (`CheckInBiomarkerSource`, precedent
  `SleepAnchorPort`) implemented in `wearable`.
- Readers: the Boop day ledger (curve detail), the chat day block (§7.6), and B7 later. `CheckInText` adds one line
  ("pulzus 78, HRV 38 (szokott 50), 7 420 lépés") when a snapshot exists.

### 7.4 The day-close record (one source of truth) + compatibility
- New feature package **`dayclose`** (its own slice so companion, habit, character and proactive may read it; `boop`
  cannot be read by companion — boop→companion exists). Table `day_close`: `id`, `created_by`, `close_date` (unique
  per owner, partial index `where is_deleted = false`), `closed_at` (captured-at), `evening_energy` 1–10 nullable,
  `day_rating` 1–5, `goal_text` nullable (copied at close), `goal_outcome` (`done|partial|no`) nullable,
  `plan_goals` jsonb (B2's goals as seen at close: id, title, result, met), `journal_entry_id` nullable,
  `boop_line` text nullable (the generated sentence), `client_ref`, timestamps, soft-delete. Liquibase in `1.1.0/`,
  named constraints, timestamped after B1's changesets.
- API (contract-first, `api/feature/dayclose/dayclose.yml`): `PUT /api/day-close/{date}` (idempotent upsert; body =
  the fields above + `capturedAt` + `clientRef`; accepts any past date ≤ 7 days and today in the owner zone, 400 for
  future), `GET /api/day-close/{date}`, `GET /api/day-close?from&to` (Napló list), `POST /api/day-close/{date}/line`
  (generates/returns Boop's one sentence; cheap tier, cached by input hash; 503-safe → the phone retries later).
- **Dual-write, not reader migration (my call):** on a successful close the service also writes the three legacy
  stores so every existing reader keeps working unchanged — `daily_intention.reflection` from `goal_outcome`
  (done→yes, partial→partial, no→no), `ritual_day.closed_at` via a ritual service method that takes an explicit
  date (add one; no `LocalDate.now()`), and the `20:00` check-in slot merge (§7.2). **The evening transcript lives in
  one place only: `journal_entry`** (source `boop`, `occurred_on` = the close date, linked by
  `day_close.journal_entry_id`); `ritual_day.reflection_text` is **not** written, so the text is embedded / mined for
  people and life events once (journal listeners), never twice. `RitualClosedEvent` still fires for its other
  listeners (habits, metric series, abandonment detector) and sees an empty reflection.
- **Sync order:** the close (without text) syncs first; the transcript arrives later as `POST /api/journal` (client
  ref) and then `PUT /api/day-close/{date}` again with `journalClientRef`, which the server resolves to the entry id.
- **A day already closed on the web (my call):** `GET /api/day-close/{date}` falls back to the legacy stores when no
  `day_close` row exists (`ritual_day.closed_at` → closed; reflection text, `daily_intention`, the 20:00
  `day_rating` ÷ 2 rounded fill the summary) and marks it `source: web`. Boop shows it as closed (read-only summary,
  a *Módosítom* re-opens the close). Closing it again in Boop writes `day_close` and the legacy fields Boop has values
  for; it never clears the web's `reflection_text`. A `DayClosedEvent` is published
  for B8. Migrating readers to `day_close` and retiring the old writes is a later cleanup issue (filed, not B3).
- The web app's own Napzárás keeps working untouched; a day closed in Boop shows as closed there.

### 7.4a Boop's own goals, decided from data (B3 adds the missing signal)
The brief's `day.session` gains `done: Boolean`, `doneMinutes`, `avgHr` (nullable): done = a train session finished
today (`/api/train` finish) or a sport session logged, else a `wearable_workout` today overlapping the planned window
(±2 h) with ≥ 20 min; minutes/avg HR from the finished session's wearable match when present (Huawei rows have no HR
— then only minutes). The brief input hash includes the done flag. `DayPlan.goals` then sets `met` for the session;
bedtime stays `nil` at close time ("még előtted") and is decided by next morning's sleep (shown in the Napló day,
not in the close). Protein is already decidable.

### 7.5 Goal of the day
- Stored as the day's **first `intention_focus`** (existing `POST /api/intention/focus`; the 3-cap stays for the web).
  Boop shows and edits only the first; "csere" soft-deletes it and adds the new one. Offline: outbox item with
  client ref; the server endpoint is made idempotent for Boop by a new optional `clientRef` on the focus (unique per
  owner) — my call, cheaper than a new table.
- `BoopPrompts` must put **today's foci** into the brief prompt (today only the creed is written — research 04 §2.2
  flags this as unintended).
- Suggestions (§5.1) are built on the phone from the brief (session) + EventKit (calendar, read-only, local) + the
  past goals list (`GET /api/intention/day/{date}` over the last 30 days, cached) — no new endpoint.

### 7.6 Chat that knows today
- Boop's chat uses the existing companion conversation API; iOS starts with the **non-stream** `sendMessage` (SSE
  later — hand-written SSE in Swift is a separate risk).
- **One conversation per day (my call):** the Boop tab opens today's Boop conversation (created lazily on the first
  question, `channel = boop`, titled with the date); earlier days stay listed in the companion API but the tab shows
  only today in B3. The pushed day block is always today's, and for `channel = boop` the planner gets only today's
  turns as history (stale facts from earlier days never mix in). An offline question waits in the outbox with no
  conversation id; the conversation is created on flush.
- **Pushed day block** (new): for conversations started from Boop (`channel = boop` on the conversation, new optional
  field), every turn includes a compact, deterministic **"Ma" block** in the planner and answer context: last night's
  sleep (+ the night before), resting HR and HRV vs 14-day usual, today's steps so far, today's check-ins with
  energy/mood/stress and their snapshots, the goal of the day, today's and tomorrow's training/sport session (type,
  time, duration), meals eaten so far vs the kcal/protein targets, calendar blocks remaining today (times and
  durations only — titles not sent in B3, B7 decides), the bedtime target, the active weight goal. Source: a new
  `BoopDayContext` assembled in companion from leaf services (companion→wearable is cycle-safe; companion→boop is
  not — read the brief inputs, not the boop package). Tokens: target < 1 200.
- New read tools for the planner: `get_wearable(scope=today|week)` and `get_calendar(scope=today)` (times/durations).
- **"Boop látja" strip**: `GET /api/companion/day-context` returns the chips (label, value, sub) built from the same
  `BoopDayContext`, so the strip shows exactly what the model sees.
- **Ready questions**: deterministic templates chosen from the same context (my call, no LLM): HRV below usual or
  sleep shorter than yesterday → "Miért vagyok fáradtabb, mint tegnap?"; a session today → "Mennyit egyek a
  <session> előtt?" and "Mire figyeljek ma az edzésen?"; a session tomorrow / a competition → "Mikor és mit egyek, hogy
  holnap jól menjen?"; otherwise "Hogy alakul a napom?". Max 3.
- Answers must cite the data they use (prompt rule: name the number and its source in one clause), Hungarian,
  Boop's voice.

### 7.7 Napló — minimal "Napok" (B3 part)
B2 ships Napló as a placeholder. B3 fills its first section with the past 14 days from `GET /api/day-close?from&to` +
the check-ins: each day a glass row — date, rating word, goal + outcome, a mini energy line with the dots, the journal
quote's first line; tap → the same "A MAI NAPOD" summary + the energy curve card for that day. (Built from the
approved spike components; no new visual element. Minták stays a placeholder for B8.)

### 7.8 Reminders, notifications, widget
- **Now (free team): local notifications** via `UNUserNotificationCenter` (like the shipped bedtime reminder):
  check-in reminders at 07:30, 12:30, 16:00 (defaults, my call; editable in the account sheet later) — each fires only
  if that moment's check-in is not done (rescheduled on every save/foreground); the close reminder at **bedtime
  target − 75 min** (fallback 21:30); the existing bedtime reminder stays (target − 30 min). Category actions: tapping
  the body deep-links to item 1 of the check-in / the close (`boop://checkin`, `boop://este`). No badge counts, no
  repeats, quiet copy.
- **Gated until the paid team (B1):** the medium/Smart Stack **widget** with in-place App Intent buttons and an App
  Group + shared Keychain token; **answer-from-notification** buttons that save without opening the app (needs the
  same shared credentials in a notification extension). Built in B3 if B1's paid team has landed when B3 reaches that
  task; otherwise filed as `mezo-r36n9.13.x` and B3 ships without them (the owner is told).
- APNs (server push) is not used in B3.

### 7.9 Dependency order (B1 / B2)
B3's build starts when **B2 is on main** (shell, `DayPlan`, Ma phases, capture sheet, Boop tab). B1 may land later;
the plan puts the B1-dependent parts **behind a cut line at the end**: the server-side snapshot fallback (needs
`health_sample` + a window finder), HRV in the phone snapshot (needs B1's widened HealthKit read set — until then the
snapshot carries HR, steps and sleep, HRV null), and the widget/answer-from-notification (paid team). Notification
taps are handled with a `UNUserNotificationCenterDelegate` set at app start — **no app delegate and no project-file
edit from B3**; if B1's `BoopAppDelegate` has landed, B3 registers there instead. B3 data lands in whichever account
the app is signed into; B1's migration moves it.

## 8. What stays as it is (reverse parity)
B2's whole Ma (hero, lens, proposals, Boop mondja, drill-downs), the S3 brief and its sheets, the bedtime reminder,
the web app's check-in, intention, journal and Napzárás (untouched; they see Boop's data through the shared stores),
every reader of `check_in`, `daily_intention`, `ritual_day`, `journal_entry`.

## 9. Prior art (recon 2026-11-11)

| Pattern | Source | Adopted? |
|---|---|---|
| Interactive widget buttons run an App Intent without opening the app; only Button/Toggle, no slider/text | [Apple WidgetKit interactivity](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities) | **Adopted, gated** — the widget answers one item per tap on a number grid (no swipe is possible there). |
| Apple State of Mind: 1 tap fills several fields, context guessed from the calendar; prompt right after an event | [WWDC24 10109](https://nonstrict.eu/wwdcindex/wwdc2024/10109/) | Adopted in spirit: goal suggestions from the calendar; every item pre-filled with the last answer. Writing mood to HealthKit State of Mind: **later** (not B3). |
| WHOOP Journal: short evening yes/no list with defaults, dated automatically; correlations vs HRV/RHR with an explicit "correlation, not cause" | [WHOOP Journal](https://www.whoop.com/us/en/thelocker/the-whoop-journal/) | Adopted: the close's defaults (Boop's goals pre-ticked), the auto-date. The correlation layer is B8. |
| Oura smart tags: ask when the biomarkers move | [Oura](https://ouraring.com/blog/custom-smart-tags/) | Adopted via the existing plan engine's "question of the day" + its why line; **rejected** as a replacement for the per-check-in snapshot — the owner wants the watch values next to every dot. |
| EMA research: planned-missingness rotation keeps burden down; keep 1–2 anchors, keep the answer format stable within a session | [PMC3781177](https://pmc.ncbi.nlm.nih.gov/articles/PMC3781177), [Williams 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7970161) | Adopted: five fixed anchors + one rotating item, one answer format (the orb). |
| Market (research 12): logging cost decides whether the loop survives; evening close must be short and skippable | `docs/superpowers/research/boop-standalone/12-web-one-app-ux.md` | Adopted: counted taps (§6), close skippable, no streaks. |

## 10. Codebase terrain (recon 2026-11-11)

- **Check-in** `backend/.../feature/biometrics/checkin/` — `CheckInEntity` (14 items, `day_rating`, `asked_items`,
  `adaptive_item`, `quick_exit`, `saved_at`), `CheckInItem` (Hungarian copy), slots in `application.yml`
  (`mezo.checkin.plan`: 06:30/10:00/14:00/20:00), `CheckInService` (upsert by slot, `CheckInSavedEvent`, no
  concurrency guard — B3's outbox retries must tolerate the unique-violation race: catch + re-read),
  `CheckInPlanService` (stable adaptive pick per user/date/slot; 400 on an unknown slot id). Endpoints
  `GET/POST /api/biometrics/checkin`, `GET …/checkin/plan`.
- **Intention** `feature/intention/` — `intention_focus` (cap 3, 409 `INTENTION_FOCUS_CAP`), `daily_intention.reflection`
  yes|partial|no, `/api/intention/*`. Habit/quest XP tails read it (hidden from Boop, keep working).
- **Ritual** `feature/ritual/` — `ritual_day(closed_at, reflection_text)`; `close`/`saveReflection` use
  `LocalDate.now()` + 409 `RITUAL_NOT_TODAY` (do not reuse for Boop; add a dated method). `RitualClosedEvent` →
  embeddings + people + life events.
- **Journal** `feature/journal/` — `journal_entry(occurred_on, text, source ∈ quickinput|ritual)` (CHECK constraint →
  migration adds `boop`), `JournalEntrySavedEvent` → embedding/text signals. Voice = `POST /api/companion/transcribe`
  (multipart, audio not stored, 404 when companion is off).
- **Companion chat** — `listConversations/createConversation/listMessages/sendMessage/streamMessage`; the
  conversation-first planner pulls 23 tools; `get_personal_context(scope=today)` renders `ContextSnapshotAssembler`
  (check-ins, intention, ritual, sleep_log, weight) but **nothing in companion reads wearable or calendar** today.
  Chat `scope=today` uses `LocalDate.now()` — fix to the owner zone for the Boop block.
- **Boop backend** `feature/boop/` — `BoopDayAssembler` (check-in slot chips, intention creed + foci), brief hash
  covers check-in done flags and foci (saving one regenerates the brief on next GET). `BoopPrompts` writes only the
  creed (fix: today's foci).
- **Wearable (B1 branch)** — `health_sample(metric, start_at, end_at, value, source, meta)`, HR as 5-minute buckets,
  `hrv_sdnn` samples, steps only as the day rollup; `HealthSampleRepository` has no window finder yet.
- **iOS** — calls only the operations in `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (B3 adds
  checkin, checkin plan, intention day/focus, journal create, transcribe, day-close, companion conversations/messages/
  day-context) → `ios/scripts/sync-openapi.sh`; clients in BoopCore with `StubTransport` tests
  (`MorningClient` pattern). Bedtime reminder exists (`ios/Boop/Nap/BedtimeReminder.swift`). The project has no
  widget/notification extension target and no App Group. B1 adds the app delegate (needed for notification category
  handling) — B3 hooks into it.
- **Traps** — ArchUnit `feature_slices_are_cycle_free` (biometrics↛wearable, companion↛boop; `dayclose` is a fresh
  leaf); layer subpackages; no class-level `@Transactional`/`@Value`; Liquibase naming `{ts}_mezo-r36n9.13_*.sql`, a bare
  `?` in jsonb SQL breaks JDBC; new tables into `ResetDatabase` + populators; contract drift = regenerate
  `frontend/src/api.gen.ts` and the iOS copy and run both FE test modes even without FE changes; CODEMAP regenerated
  after every merge; boop/companion LLM ITs need `@ActiveProfiles("companion-fake")`.
- **Hot spots shared with B1** (one writer at a time): `api/openapi.yml` + `merge.yml`, `BoopAPI` generated contract,
  Liquibase master, `ResetDatabase`, `Boop.xcodeproj` (B3 needs no project edit unless the widget task runs — then the
  widget target is a project edit; coordinate).

## 11. Spike reference
`docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Ritmus{Root,Ma,Parts,Checkin,Este,Chat,Lock}.swift`; builds against
B2's `Gerinc*.swift` (on `feat/boop-b2-gerinc` until B2 merges) with `BoopSpikeApp` switching on `-ritmus YES`.
Arguments: `-ritmusTab 0–3`, `-ritmusPhase 0|1|2`, `-ritmusOffline YES`,
`-ritmusOpen checkin|checkinDone|este|esteDone|chat|chatAnswer|lock|widget`, `-ritmusScroll reggel|napkozben|este`.
Screenshots `ritmus-1…10*.png` (+ `ritmus-2b-kitoltes-hangulat.png`). Fake data; the build target is the look and
the flow, the numbers come from the real APIs.

## 12. Left to the builder
Exact layout constants (match the spike), outbox file format and backoff numbers, the cheap-tier prompt for the close
sentence and the post-check-in line (Hungarian, one sentence, cites the day), test fixtures, the order of tasks
within the plan, how the Napló list pages beyond 14 days (not needed in B3).

## 13. My calls (marked for the owner to check)
1. Reminder defaults 07:30 / 12:30 / 16:00, close reminder at bedtime − 75 min.
2. The close's rating is five steps (stored ×2 into the old 1–10 field).
3. Dual-write into the old evening stores instead of migrating their readers now.
4. Goal suggestions are rule-based (calendar, today's session, goals you repeat), no AI.
5. Ready chat questions are rule-based templates; calendar titles are not sent to the AI in B3.
6. A minimal Napló "Napok" list (last 14 days) is part of B3.
7. The widget and answer-from-notification are built only if the paid team has landed by then.
8. A check-in never jumps to another moment's slot; a second one in the same moment asks before overwriting.
9. The evening spoken text is stored once (in the journal), not also in the old evening ritual store.
10. A day already closed in the web app shows as closed in Boop.
11. The Boop chat is one conversation per day.
