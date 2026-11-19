---
title: Boop — native iOS app
type: feature-domain
status: in-progress
updated: 2026-11-19
tags: [ios, blokk-epito, heti-atnezes, kezdolap, area-kit, l0, elo-fal, l0b, b4-etel, food, barcode, meal-photos, sensitivities, b3-napi-ritmus, offline-first, outbox, dayclose, b1-adatalap, health-samples, apns, swiftui, boop, napkelte, lagy, auth, onboarding, healthkit, eventkit, wearable, morning-brief, energy-curve, voice]
key_files:
  - ios/Boop
  - ios/BoopKit/Sources
  - backend/src/main/java/io/mrkuhne/mezo/feature/wearable
  - api/feature/wearable/wearable.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/boop
  - api/feature/boop/boop.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/dayclose
  - api/feature/dayclose/dayclose.yml
related: [fuel, pantry, recipe, dayclose, intention, journal, companion, proactive, _platform-auth-security, _platform-api-backend, me, today]
---

# Boop — native iOS app — Feature Documentation

> **2026-11-19 — Boop Pénz L4 (`mezo-r36n9.102`, no app change).** `ios/BoopKit/Sources/BoopAPI/openapi.yaml` was regenerated with the new Pénz paths; the openapi-generator filter does not include them, so no Swift client code changed. The Pénz area's screens are L5 (`mezo-r36n9.103`); the backend they will read is [`penz.md`](penz.md).

> **Owner-facing handbook (2026-11-12, `mezo-r36n9.29`):** a Hungarian, business-language handbook of every Boop
> section / feature / small feature (settings + data tables), the decision and release logs live in
> [`docs/boop-handbook/`](../boop-handbook/README.md) and are mirrored one-way into the owner's Notion "Boop" space
> (ticket board from bd) by `scripts/boop-notion-sync.mjs` + the `boop-notion` skill; every Boop slice updates it
> at report time (boop skill §5).

> **Re-planned 2026-11-11 (`mezo-r36n9.9`):** S4 is cancelled; Boop continues as a standalone app in slices
> **B0–B8** (repair → data foundation → new spine Ma · Terv · Napló · Boop → daily loop → food → training + Watch →
> the Plan → day capacity → one AI) — spec [`2026-11-11-boop-standalone-design.md`](../superpowers/specs/2026-11-11-boop-standalone-design.md),
> research [`boop-standalone/`](../superpowers/research/boop-standalone/13-synthesis.md). **B2 Gerinc (the new shell) shipped 2026-11-11** (`mezo-r36n9.12`, §2 "The spine"); **B3 Napi ritmus (the daily loop) shipped 2026-11-12** (`mezo-r36n9.13`, §2 "The daily loop"); **B4 Étel (food) shipped 2026-11-13** (`mezo-r36n9.14`, §2 "The Étel room"); **the home screen + the shared area-page kit shipped 2026-11-16** (`mezo-r36n9.47` / `.51` / `.37`, §2 "The home screen" and "The area-page kit"); **Ma became the living wall the same day** (`mezo-r36n9.45`, §2 "The living wall"); the older S1–S3 shell text below is superseded where it names the five-domain bar.

> One-line: the native SwiftUI iPhone app that replaces the web app once complete (epic `mezo-r36n9`).
> Design canon **Napkelte** since S2.5 (dark glass, painted sky, the orb rising as the sun — spec
> [`2026-11-10-boop-napkelte-design.md`](../superpowers/specs/2026-11-10-boop-napkelte-design.md); Lágy before), companion named **Boop**, same backend with a new account. Slice **S1** (the frame)
> is shipped: project, Lágy kit, sign-in / register with invite, onboarding (profile + first weight),
> the five-domain shell, a one-command weekly install. Slice **S2** (data) adds Apple Health (60-day
> backfill, then refresh on every open) and today's + tomorrow's calendar into new `wearable` endpoints;
> plan [`2026-11-09-boop-s2-adatok.md`](../superpowers/plans/2026-11-09-boop-s2-adatok.md). Spec:
> [`2026-11-09-boop-ios-v1-design.md`](../superpowers/specs/2026-11-09-boop-ios-v1-design.md) · plan:
> [`2026-11-09-boop-ios-v1.md`](../superpowers/plans/2026-11-09-boop-ios-v1.md) · approved look:
> [`boop-ios-spike`](../design_2.0/prototypes/boop-ios-spike/README.md) (`Aura*.swift`). Slice **S2.5** (the look) moved
> every shipped screen onto the Napkelte kit; plan [`2026-11-10-boop-napkelte-kit.md`](../superpowers/plans/2026-11-10-boop-napkelte-kit.md).
> Slice **S3** (reggel, shipped 2026-11-10) adds the real **Nap · Mai**: a new backend `boop` feature (the morning brief: five scores,
> an energy curve, Hungarian verdicts, today's day data) and the SwiftUI morning built on it; plan
> [`2026-11-10-boop-s3-reggel.md`](../superpowers/plans/2026-11-10-boop-s3-reggel.md).

## 1. Summary

Boop is built in four slices (spec §, plan "Slice map"): **S1 Alap**, **S2 Adatok** (Apple Health +
calendar ingestion), **S2.5 Napkelte** (the look) and **S3 Reggel** (the morning brief: five orbs, Boop's voice,
energy curve, paths) are this doc's base state; **B2 Gerinc** (2026-11-11) then replaced the five-domain shell with the
spine Ma · Terv · Napló · Boop + "+" (S4 is cancelled); **B3 Napi ritmus** (2026-11-12) then added the offline-first daily loop (check-in, goal, evening close, journal, Boop chat, reminders); **B4 Étel** (2026-11-13) then added the food room (Ma · Receptek · Kamra · Hét, offline-first meal capture, barcode, photos, sensitivities); and the **home screen + area-page kit** (2026-11-16) put a ring of eight area orbs in front of Ma and gave every area one frame to be built from, with **Ma itself becoming a living wall** of at most three cards; B5–B8 follow. The web PWA keeps running until Boop covers it.

## 2. User-facing behavior

- **The app icon (`mezo-r36n9.34`, 2026-11-13):** the Napkelte scene itself — Forma's painted sky, the four hazy
  ridges and the orb cresting them — with the iOS 18 dark and tinted variants. It is generated, not hand-drawn:
  `swift ios/tools/genappicon.swift <out> napkelte` (see `ios/README.md` §App icon); the script also carries the two
  directions the owner turned down. No watchOS icon yet (B5).
- **The look (S2.5, Napkelte):** near-black ground that keeps the page's hue all the way down, a painted landscape
  backdrop per page, white type on glass cards, colour only in the sky and the orbs. Bottom bar = five icons, no
  labels. Sign-in/register, offline, onboarding (profile, first weight, "Szia, Boop vagyok"), Health + calendar
  connect and backfill, the four web-only tabs and Nap · Mai all use it. **Nap · Mai** without a brief still shows
  one state: not connected ("Összekötöm" opens the connect flow), syncing, learning (< 14 nights:
  a still "még tanulom" orb with "9 / 14 éjszaka", no score), no calendar, offline, ready. With a brief loaded the
  real Mai (below) stays through syncing / failed / offline / no-calendar (no flip back on every foreground sync).
  Bell / "+" / avatar, Beszélgetés and Rutin answer "hamarosan" until S4.

- **Nap · Mai (S3, `MaiView`)** — Boop's morning, built from the server's brief:
  - **Hero:** title row, tabs (a dot on "A napom" 05–12 h), a row of **five mini orbs** — Forma (the old "készenlét"),
    Alvás, Mozgás, Fuel, Pulzus — and one big rising orb for the selected one (score or `display`: "7ó 12p", "3 240",
    Pulzus shows bpm), name in caps, serif headline, one–two sentences in Boop's voice. A missing or learning
    score reads "–" with "még tanulom", never 0. Tapping a mini orb re-colours the whole page (sky, ground, lights);
    the selected orb is the **lens**: the white pill under the text morphs to that orb's action (Forma: check-in,
    Alvás: bedtime reminder, Mozgás: today's workout / run / walk menu, Fuel: photo + quick chips, Pulzus: one-minute
    breathing with haptics) and a small voice circle. S4 actions toast "<név> · hamarosan". When Forma's current
    check-in is already done the pill is "Boop elmondja".
  - **Boop voice:** `Boop elmondja` reads the brief aloud in Hungarian (best hu-HU voice, plays with the silent
    switch on and ducks other audio) and types it word by word; the voice circle (long press) mutes, un-mutes and
    replays ("Mondd újra"); reduced motion = the text appears at once and the orbs stay still, but Boop still speaks
    (unless muted) — reduced motion is about movement, not sound.
  - **Below the hero, per orb:** tiles (Forma, Alvás: mély, elalvás; Mozgás: steps, active kcal vs 500; Fuel: kcal,
    macros, víz "–"; Pulzus: resting HR, today min·átl·max), a short **path** of stations ("most" first, then what
    belongs to that orb: check-ins, szándék, hypnogram + bedtime, dip walk + session strip, meals, breath before the
    densest meeting block, the meeting ribbon) and, on Forma, the **Boop mondja** card whose coloured phrases open the
    sleep / pulse / day sheets. Tiles without data are dropped, not shown as 0 (no wearable day → no Mozgás tiles; a night
    logged without bedtime/wakeup keeps its length tile, the times show "–", and the path skips its night stations).
  - **Boop észrevette:** up to three observation cards (the companion's proposed patterns); swipe right = Igaz
    (`decidePattern` confirm), left = Nem rólam szól (reject), with a thank-you toast after the last.
  - **Move today's session:** the session strip shows a conflict hint when the last meeting ends too close to the
    start; "Áttolom 18:30-ra" moves the session, the conflict card disappears, a toast + an inline "Vissza 17:30-ra"
    pill undo it (`PUT`/`DELETE session-time`). Nothing in the training plan itself changes.
  - **Sheets** (medium + large): Az éjszakád (tiles, hypnogram with legend, deep sleep ×7), A pulzusod (weekly resting
    HR bars, today min·átl·max; no per-night line, no HRV), A napod (energy curve with a press-and-drag **magnifier**:
    time · energy % · what is on, soft haptic per hour, busy ribbon with the training slot, hour anchors, the
    conflict card with Áttolom / Marad így).
  - **A napom** tab: the strict chronological full day as one path; meetings are a single "Megbeszélések · n esemény"
    station.
  - **Evening** (local hour ≥ 18): the whole Nap page takes the dusk (Pulzus) sky, Forma's pill is "Esti check-in"
    (hamarosan), Alvás's is "Esti levezetés", evening breath and fuel stations replace the morning ones.
    **Kímélő mód** (the brief's `recovery`): a calm grey-blue sky, a banner "Kímélő mód · N. nap · ok" with "Kilépek"
    (hamarosan), no session, walk / water / early-bed stations. Kímélő wins over evening; one sky per mode for the
    whole page (orb taps then re-colour only orbs and lights).
  - **Bedtime reminder:** the Alvás pill (and the bedtime card's "Emlékeztess") asks notification permission on the
    first tap, then a nightly local notification at **bedtime target − 30 min** ("Emlékeztetlek HH:mm-kor"); tap
    again to cancel; a changed target moves it; denied permission stays off with a gentle line pointing at Beállítások.
  - **Place switch (since B2: Ma · Terv · Napló · Boop):** the places share **one painted landscape** (`NKBackdropPanorama`, three
    screens wide, no seams): switching pans left/right by bar order with the sky cross-fading (0.95 s), a sliding
    nav pill and a sequenced content fade (owner OK 2026-11-10).

- **The spine (B2 Gerinc, 2026-11-11, `mezo-r36n9.12`):** one home, four places. `ShellView` hosts a glass bar
  (`NKSpineBar`) **Ma · Terv · Napló · Boop** with icons only (names are accessibility labels; Boop's icon is a small
  `StillOrb`) and the **"+"** as its own glass circle beside it. The shipped backdrop motion is kept: switching places slides the
  painted landscape (`NKBackdropPanorama`) toward the tapped place while the two skies blend (reduced motion = cross-fade),
  and a mini-orb tap still cross-fades the page sky. While a room is open the bar slides away.
  - **Ma** (`Nap/NapView` → `MaiView`) is **one scroll**: the S3 hero (orb, verdict, five mini orbs, lens strip) plus a
    **phase strip** Reggel · Napközben · Este that scrolls to its section; the Reggel plan card collapses once accepted (Napközben stays open). The phase follows the clock
    (`BoopCore/Morning/DayPhase`): Reggel 04:00–10:00, Napközben 10:00–18:00, Este 18:00–04:00 (wakes at 04:00, 10:00, 18:00).
    - **Reggel:** the plan card (`DayPlan`: the day's rows from the brief) with **"Elfogadom a napot"**, stored per day, and **Boop mondja**
      (tappable phrases, the meetings phrase opens the detail sheet).
    - **Napközben:** the whole day as one quiet path in clock order; proposals hang inline at **MOST** (never a pinned queue).
    - **Este:** the close-out frame; the close is live since B3 (see **The daily loop**).
  - **Proposals** (`BoopCore/Morning/Proposals`, `Boop/Nap/ProposalDesk`, kit `NKProposalCard`): B2's one live source is the brief's
    meeting conflict, which becomes a **move-session** proposal. **Elfogadom** = `moveSession` with an undo toast (the "Vissza ..." button lives on
    the Mozgás room's session card; the settled proposal row just says "Elfogadtad"); **Most nem** hides it for that day only (dismissed keys under `dismissedProposals` in UserDefaults); **miért?** opens a
    page-level sheet with the facts plus only the expert lines the brief carries — Közérzet / Szkeptikus lines arrive with B8. Cap **3 per day**.
    Nothing changes without the tap. Ma and the rooms share one desk, so accepting in a room shows on Ma.
  - **Rooms** (`Nap/MaDrill`, kit `NKDrillPage`): a tap on an orb (lens strip row, the big orb, a timeline station) pushes the orb's room
    (Forma, Alvás, Mozgás, Fuel, Pulzus) in a `NavigationStack` inside Ma. Four sections: **1 A szint** (number, caption, Alvás hypnogram,
    the orb's tiles, detail-sheet row), **2** the week (deep-sleep / resting-HR bars, Forma's energy line, else an honest "hamarosan" line),
    **3 A napok mögötte** (the days behind the week, today on top), **4 Mit tehetsz** (the orb's proposal plus the S3 orb path cards re-homed). A kept conflict ("Marad így") hides the proposal too, for the rest of the day.
    `NKDrillPage` takes an optional inner tab row (B4's Étel room uses it, as `NKCapsuleTabs`; B5 Edzés will too). Swipe-back via `Nap/RoomSwipeBack.swift`, scoped to the room: it stands in as the pop gesture's delegate only while a room is on screen and restores the original on exit.
  - **Étel · Receptek tab (B4 Task 12)** (`Etel/{EtelReceptek,RecipeDetail,RecipeImport,RecipeWorkshop}.swift`): the new-recipe rows (link/text, photo, Receptműhely) and the library, **one recipe per row** (owner, 2026-11-13: a 44 pt thumbnail, the full name with its sensitivity badge beside it, kcal / protein / servings in full underneath — never a card grid). Every route ends in the same review (`RecipeReview`, pure, tested): a doubtful row (server `needsReview` or confidence ≤ 0.6) must be confirmed or taken out before the save is enabled, an unmatched row blocks nothing but is visibly left out of the saved recipe (the server cannot save a line with no food, and it does not enforce that a doubtful row was looked at — the review is the enforcement). The review shows the owner's allergen hits per row and in a summary before the save (rows with no allergen data say "nincs adat"), and when two or more rows and a quarter of them would be left out it says so plainly and makes him confirm. A reviewed recipe goes through `FoodClient.createRecipe`; the workshop's estimate lines are left out the same way. The detail sheet shows the owner's own photo (add/replace/delete via `/api/recipe/{id}/image`; `NKThumb`'s glyph stays the fallback), ingredients, steps, the template score, the log history and a one-tap *Megeszem 1 adagot* (a recipe `DraftItem`, idempotent per tap session). An absent allergen key reads "nincs adat", never "mentes".
  - **Étel · Kamra and Hét tabs + Szokásos (B4 Task 13)** (`Etel/{EtelKamra,PantryItemDetail,PantryAdd,EtelHet}.swift`): *Kamra* = four add routes (vonalkód via the existing scanner, link via `scrapePantryItem`, címkefotó via `photoExtractPantryItem`, kézzel) that all end in ONE confirm (`PantryConfirm`, editable per-100 g facts; a macro left empty stays unknown, a doubtful reading holds the save until "Átnéztem"; saved by `importPantryItem`, or `createPantryItem` for typed foods), the shelf with search + category chips + the catalog behind the search (`addPantryItemFromCatalog`), and an item sheet (per-100 g facts, NOVA, sensitivity lines where a missing key reads "nincs adat", provenance; *Megeszem* reuses the Task 11 serving confirmation, in grams). `IngredientResponse` gained `allergens` + `barcode` (additive) so shelf rows can be read against the owner's rules. No prices, stock or expiry. *Hét* = `getFuelWeek` ending today: kcal and protein bars against the target waterline (`WeekBars` gained `lineLabel`/`marked`), day rows (training room, skipped kcal, kímélő = marked and not judged, excluded from averages, today never joins them), per-day scores from each day's own meals, week totals, tap a day for its numbers and meals. *Szokásos* = the composer's fifth entrance over the new `GET /api/fuel/usuals` (the existing `UsualMealRanker`; each row also carries the latest occurrence's own lines, `mealId` and summed `kcal`, so a choice opens that meal as it was eaten with no model call — and a row whose lines cannot be read falls back to the name through the ordinary draft, with a visible line saying it was re-estimated, not copied). A failed day read on *Hét* is said ("a pontszám most nem jött meg"), never a silent gap in the score average.
  - **Étel · settings, skipping, kímélő mode, supplement list (B4 Task 14)** (`Etel/{SensitivitySettings,DietSettings,RhythmSettings,SkipSheet,SupplementGroups,EtelSettingsKit}.swift`; the settings block is Kamra section 3 "BEÁLLÍTÁSOK" (`EtelSettingsList`), "Kihagyom" sits on an open Ma window, "A lista szerkesztése" under the supplement groups). *Amit kerülök* = `GET/PUT /api/sensitivity`: the EU-14 chips each at allergia / intolerancia / kerülöm, free-text words (lowercased like the server keeps them), and the NOVA rule as a switch with a 1–4 threshold — where the owner records lactose intolerance (key `milk`) and "nothing above level 2"; rules that could not be read are never shown as an empty editable list (a save would overwrite the real profile), and a key that is not set reads "nincs megadva", never "free of". *Étrend-beállítások* = preset or custom split (a custom split must sum to 100,0 %), protein tier, water, fibre, with the live preview over `POST /api/diet/settings/preview` (debounced; a preview of an older draft is dimmed, never shown as current; a failed preview does not block saving); saving re-evaluates the active goal server-side. *Napi ritmus* = `fuel_settings` (3–6 occasions, default 5 = "3 étkezés + 2 nasi", owner decision 21, and the caffeine cut-off). *Kihagyom* = the web chips (Nem vagyok éhes / Nincs időm / Gyomorrontás / Beteg vagyok / Úton vagyok / Egyéb + free text) → `PUT /api/train/skips` kind MEAL, `sessionKey` `<slot>#<n>`, `plannedKcal` from the window's budget, so the kcal leave the day. *Kímélő mód* = `PUT/DELETE /api/train/recovery` (ILLNESS / STOMACH → the day has no kcal target and is not judged): on from the skip sheet or the settings list, off in one tap (a period started today is discarded, an older one ends with the BETTER check-in); an open period of another kind (e.g. injury) is never overwritten by a tap, and a GUIDANCE day offers no Kihagyom. *Kiegészítők szerkesztése* (owner decision 18) = new supplements through `createPantryItem` (kind supplement) + `POST /api/fuel/protocol/items`, re-dose through `PATCH`, remove through `DELETE`; the one-tap group tick reads the protocol fresh, so it ticks only what is left. The daypart groups now use the server's real keys (`wake|breakfast|pre_workout|lunch|post_workout|dinner|evening|bedtime`) in day order with Hungarian names (the older coarse keys still read).
  - **"+" capture sheet** (`Capture/CaptureSheet`): the food chips are real since B4 (Fotó · Szöveg · Vonalkód · Recept · Kamra open the meal composer at the matching entrance, `CapturePick.mealStart` → `Entrance.openingStage`); the other items (edzés, súly, ...) still say "hamarosan".
  - **Account sheet** (`Shell/AccountSheet`, opened from the avatar on Ma's title row, accessibility label "Fiók"): the account card with the confirmed sign-out
    (the old Én account section, `EnAccountSection`).
  - **Placeholders:** Terv (`Terv/TervView`) is an honest frame until B6; Napló and the Boop tab became real in B3 (see **The daily loop**).
  - **Presentations stay at page level** (§9): the detail sheet and miért? hang outside the room stack, so they reach Ma and every room.
  - **DEBUG flags:** `-previewTab`, `-previewOpen`, `-previewSwitch`, `-previewPhase`, `-previewDrill`, `-previewWhy` — see `ios/README.md`.
  - **Known gaps:** between 00:00 and 04:00 Este still shows on the *day* sky (`isEvening` is hour ≥ 18).
  - **Hypnogram once** (owner, 2026-11-12): the Alvás room draws the night's stages only in section 1
    (`roomShowsHypnogram`); the path's night card appears only when the night has no stages, to say so.

- **The daily loop (B3 Napi ritmus, 2026-11-12, `mezo-r36n9.13`; spec [`2026-11-11-boop-b3-napi-ritmus-design.md`](../superpowers/specs/2026-11-11-boop-b3-napi-ritmus-design.md), plan [`2026-11-11-boop-b3-napi-ritmus.md`](../superpowers/plans/2026-11-11-boop-b3-napi-ritmus.md)).** The owner's reflection loop died in October because there was no internet while travelling, so **everything works offline first**: a capture is saved on the phone, shows at once, and syncs by itself later; only Boop's own sentences and answers wait for the network, with one quiet line. Four moments a day: **reggel, délben, délután** (check-ins) and **este** (the evening close, which *is* the evening check-in).
  - **Check-in** (`Ritmus/CheckinFlow`, `CheckinView`, `CheckinDone`; five core items every time + ONE question of the day from the plan engine, "Most csak ennyi" after the first answer): each item is answered by **swiping the orb up/down** (soft haptic per step, starting at the last answer of the day, so "unchanged" is one tap), then *Tovább*. The slot (reggel / délben / délután) is decided at the moment of saving. Saving freezes the **watch snapshot** (heart rate, HRV against the 14-day usual, steps, sleep) and the payoff is **a dot on the day's energy curve** next to Boop's dashed prediction, tappable for the answers and the snapshot (`EnergyCurveCard`, `CheckInDetail`); the dots also show in Ma · Napközben. After a check-in Boop adds one line (cheap tier, online only) and the owner may add a spoken or typed note.
  - **Goal of the day** (Ma · Reggel, `Nap/MaRitmus`): "Mi ma a legfontosabb?" — typed, spoken, or one tap on a suggestion (calendar-derived and earlier overdue goals, `GoalSuggestions`), one personal goal per day; Boop's own plan goals (the day's session, ...) tick **automatically from the data** (`DayPlan.goals` met → the brief's `planGoals`). A missed goal is never marked.
  - **Esti levezetés** (`Ritmus/EsteFlow`, `EsteView`): a one-minute close — the day's rating (1–5 orbs), the evening energy, *sikerült / részben / nem* for the goal, then **Mesélj**: the journal by voice (on-device Hungarian recognition when available; otherwise the recording waits in the outbox and the server transcribes it later) **or typed**. *Lezárom a napot* writes the day, then Boop answers with one sentence. A close opened before 04:00 belongs to the previous day. Re-closing a day replaces the earlier close.
  - **Boop tab** (`BoopChat/BoopTabView`, `BoopCore/Ritmus/ChatStore`) **knows today**: a "Boop látja · most" chip strip (the exact facts the model is given) and up to three ready questions ("miért vagyok fáradtabb, mint tegnap?"), then a plain chat; today's conversation is created on the first question (channel `boop`, titled with the date). Offline a question waits as a queued bubble; a refused one shows *Újra*.
  - **Napló** (`Naplo/NaploView`, `BoopCore/Ritmus/NaploDays`): the last **14 days** — energy line with the check-in dots, the goal and its outcome, the day's close (`Ritmus/ClosedDayCard`), the journal text — a day opens in a sheet; a day closed on the web shows too (no rating when the web evening had none).
  - **Reminders** (`Ritmus/RitmusReminders`): local notifications at 07:30 / 12:30 / 16:00 for each moment not done yet and the close at bedtime target − 75 min (21:30 without a target), on a rolling 7-day horizon of one-shots re-planned on every save, foreground and background wake; no badge, no guilt copy. **A tap opens the flow** (`RitmusRouter` → the check-in / close cover), also from a cold launch.
  - **Offline, retry, refused:** a pending write shows a small waiting glyph; a write the server will never take (a 4xx) stays on the phone as a quiet **"nem sikerült elküldeni · Újra"** row (`Ritmus/RefusedRow`) — nothing is ever dropped. The check-in dot, the goal, the close and the journal line each have such a row.
  - **DEBUG flags:** `-previewOpen checkin|checkinDone|este|esteDone|naploDay|chatAnswer|chatAsk|chatQueued`, `-previewOffline`, `-previewNotify`, `-previewColdTap`, `-previewRefuse` — see `ios/README.md`.
  - **Gated on the paid Apple team:** the home-screen **widget** and **answering a check-in from the notification** (design only; local notifications need no paid team) — and the real-device checks (cold-launch tap, background wake); see §9.

- **The home screen (shipped 2026-11-16, `mezo-r36n9.47`; the navigation map `mezo-r36n9.51`; spec
  [`2026-11-13-boop-kezdolap-design.md`](../superpowers/specs/2026-11-13-boop-kezdolap-design.md), decisions #32–#33).**
  Opening the app now shows **the ring**, not Ma: "boop" at the top, the **eight life areas** as living orbs on a
  circle (Nap · Alvás · Étel · Edzés · Energia · Forma · Pénz · Levél, clockwise from the top), **Boop's own pale orb in
  the middle** with his line for the day under the ring, over a photographed misty ridge (`NKPhoto.hegy`) in the
  cool blue world with three bands of drifting fog (`DriftingFog`). An orb opens its area; the middle opens today's
  Nap page, which was **not replaced — it moved one level in**. Pénz and Levél are not built (L4–L6): they sit faint
  and say so on tap. **The day has its own orb at the top** (decision #41, 2026-11-16, `mezo-r36n9.55`): it carries
  no score — nothing scores a day — but fills with **how full the day is** (`dayFullness`, from the brief's
  `calendar.busySlots`) and opens **the day's page** (`KezdolapRoute.day`) — the same page the ring's centre opens,
  since the day page itself became the Élet spike's Ma screen (`mezo-r36n9.56`, below). The
  "A napod" folded row inside it stays; an orb is another way in. Eight is also the better circle: seven points never
  sit symmetrically, eight are four cardinal plus four diagonal, at the cost of 6 pt of orb (62 → 56) to keep the
  labels apart at 375 pt. **The ring is full at eight** — a ninth area needs a designed answer, not another enum
  case (candidates in the spec §3). `KezdolapView` is the Ma place's root (`Kezdolap/`), and it is where the brief is fetched and
  kept fresh (`MorningTriggers` moved here from `NapView`). Tapping "Ma" in the bar while Ma is open brings the ring
  back from anywhere (`\.kezdolapHomeReset`). **The map it settles:** the ring does the job the Terv area grid was
  invented for, so the bar keeps its four places and **Terv becomes his plan**, not a second area menu — this
  overturns life-dashboard decision #3.
  *Motion, each with a still branch under Reduce Motion:* the orbs **arrive out of the fog** one after the other
  (`FogArrival`); a tap **zooms the ring into that orb** and cross-fades to the area; coming back fades it out.
  Four rules were learned by feel and must not be undone: never animate a blur over the live orbs; **never scale
  the backdrop** (a blurred fog canvas at 6.5× is what stuttered); freeze the orbs for the transition
  (`NKOrbRing(live:)`, and a paused `TimelineView` holds its last frame so the freeze is seamless); and give the
  incoming page one run-loop turn before anything moves. A room opened from the ring is **the page itself, with no
  `NavigationStack` under it** (`\.closeRoom` replaces `dismiss()` for its back button), because the stack's own
  back slides the room off sideways first.

- **The day's page (shipped 2026-11-16, `mezo-r36n9.56`; plan
  [`2026-11-16-boop-nap-oldal.md`](../superpowers/plans/2026-11-16-boop-nap-oldal.md)).** The build target was a
  screen, not a spec: the Élet spike's Ma (`docs/design_2.0/prototypes/boop-ios-spike/elet-1-ma.png`), which the
  owner pointed at and called finished. Behind **both** doors of the ring — the centre and the new Nap orb — the
  day is now one scroll: a short head (the date, `boop`, the hairline over the ridge), **Mai nap** (the energy
  curve with the day's own moments pinned on it and the way into the full list), **Most** (the living wall with
  its count), the folds (*Ma történt*, the morning plan, *A reggeli összefoglaló* with Boop's voice, *A napod*),
  **Amit ma észrevettem** (the brief's observations with their igaz / nem igaz verdict) and one row into Boop's
  place, then **Este**.
  *What left, by the owner's call the same day:* the **phase tabs** (Reggel · Napközben · Este were a switch for
  something he scrolls anyway — they are headings now) and the **big rising orb with its 42 pt verdict** (the ring
  carries the orbs; Boop's morning words live in the fold). The **orb ribbon of the spike screen was not built**:
  it predates the ring, and a second menu here would be the same menu twice (#32–#33 stand). The **lens action
  row went too** — the owner saw it in the build and said it does not belong there — and with it, on his next
  word, **the read-aloud itself**: `BoopVoice` and its tests are deleted, `BoopSaysCard` is text now (all of it
  at once, no word-by-word reveal, no *Mondd újra* / *Némítás*), and `MaiContext` no longer carries a voice. The
  bedtime switch lives on Alvás's bedtime card; the one-minute breathing exercise lost its only door and gets one
  on the Energia page (`mezo-r36n9.59`).
  *The pins* come from `dayMoments` (`BoopCore/Morning/DayMoments.swift`, pure, tested): waking, the meals, the
  longest busy stretch of the calendar, today's session, the bedtime target — only what the brief already carries,
  capped at six, each one tappable for its own line. `EnergyCurveCard` grew `events:`; Napló passes none and is
  unchanged. A page that already names the block passes `title: ""`, so the card does not say it twice.

- **The living wall (shipped 2026-11-16, `mezo-r36n9.45`, slice L0/b; plan
  [`2026-11-16-boop-elo-fal.md`](../superpowers/plans/2026-11-16-boop-elo-fal.md), decisions #13, #34, #35).**
  The page behind the ring's centre is no longer the day's timeline to scroll: it is **what Boop wants to say
  now** — at most three cards, the check-in pinned above them while it is due, and one warm line when there is
  nothing ("Most nincs teendőd. Legközelebb 08:00-kor szólok.").
  **Three fixed roles, always in this order** (#34, and the reason the wall can explain itself): `.expires` what
  breaks if he doesn't do it now · `.improves` what moves today the most · `.happened` one thing he should know.
  One card per role, at most three; **an empty slot shrinks the wall rather than padding it from a lower role**;
  an expired candidate is dropped; a photo decides how the hero looks, never which card wins; ties break on the id
  so the same day renders the same way twice. A card he acts on **settles into "Ma történt"** with its own line,
  kept per day in `@AppStorage`, and never returns that day. Every card has a **"miért?"** that also says which
  slot it is standing in.
  **Only `.expires` may ring the phone, twice a day** (#35, `wallNotifications`) — never for a card already seen,
  acted on or rung; the cap is in the function, not a setting.
  **The areas join by registering a `WallSource`** (`WallRegistry`): Étel hands in the closing window, the
  supplement group, the server's tip and the last meal; the brief hands in today's session and the strongest
  observation. B5 Edzés, then Pénz and Levél, add themselves with one line and no change to the engine or the
  view — there is a test that proves exactly that with a fake area.
  **What moved on the page:** the day's timeline folded into one row ("A napod · N megvolt, M hátra", open in the
  morning), the energy curve was hoisted above it so a forward-looking view stays visible, the **0–100 score left
  the home** (the hero orb keeps its fill and loses its number; the compact capsule carries the day's headline),
  and the **lens strip is gone** — the ring is the entrance, so a second door to every area here was the same menu
  twice. Engine `BoopCore/Morning/{Wall,WallSources}.swift` (pure, 25 tests), weights
  `BoopDesign/Napkelte/Wall.swift`, wiring `ios/Boop/Nap/MaWall.swift`.
  Review: `-previewWallEmpty YES` shows the quiet wall deliberately — the state that is hardest to catch by
  accident. **Known gap:** a wall card carries no photo yet; the only photo-worthy thing today is a logged meal,
  and its picture lives behind the Étel room's heavy day read, which the home should not pay for. The kit and the
  engine both carry the photo already.

- **The area-page kit (shipped 2026-11-16, `mezo-r36n9.37`, slice L0; spec
  [`2026-11-13-boop-life-dashboard-design.md`](../superpowers/specs/2026-11-13-boop-life-dashboard-design.md) §3.3).**
  One frame every area is built from, in `BoopDesign/Napkelte/{Area,AreaBlocks}.swift`: `NKAreaPage` (photo head
  under the hue's gradient, back + crumb, corner actions, the orb at the area's level with an optional number, serif
  verdict, sentence, then `NKAreaTabs` — inner tabs each with a count badge or a plain dot) and the blocks
  `NKHighlight` (with an optional photo band and up to three actions), `NKStatRow` (`NKStat` carries value/target/
  age, and a nil value reads "–" + "nincs friss adat", never a 0), `NKCurve`, `NKSteppedBars`, `NKComposition`,
  `NKRowList` (`NKAreaRow` with a photo thumbnail or a glyph medallion, a four-way `NKRowState`, chips, a level bar
  with `NKLevelTick` landmarks), `NKSearchableRowList` (owning or caller-owned query), `NKHeatStrip`,
  `NKCompareColumns`, `NKMenuGrid`, `NKAskRow`, and `NKAreaSubPage` for a page inside an area. It wears the **warm**
  treatment (decision #12): no card around the stats, the curve, the composition or the rows — `NKBare` gives them a
  hue tick and a label, and carries that block's own loading and failed-with-"Újra" state (`NKBlockState`), because
  every section of a room loads and fails on its own. `.nkStale(NKStale(age:loud:))` marks a block drawn from older
  data. The page returns to the tab row on a tab change, and only when it is below it. **`EtelRoom` is the proof:**
  it moved onto `NKAreaPage` with every sheet, flow and section unchanged. A full-screen flow with its own chrome
  (the workout player, the check-in, the evening close) stays a page-level cover outside this system.
  Review: `-previewKit YES` renders every block and every awkward state on one page (`Kezdolap/KitGallery.swift`).

- **The area pages (shipped 2026-11-16, `mezo-r36n9.57`; the build target is the Élet spike's own area screens —
  `BoopSpike/EletRooms.swift` + `EletContent.swift`, run with `-elet YES`, not the older PNGs).** The owner
  rejected the first attempt against the spike (*"nem úgy néz ki, mint amit a Boop · elet szimulátorban
  csináltunk… mindegyik saját menüvel"*), and he was right: what makes an area its own app there is **its own
  menu** — not the shared frame. Rebuilt to the spike:
  - **The kit grew the three pieces the spike needs** (`BoopDesign/Napkelte/`): `NKAreaBar`, the area's own
    bottom bar in place of the spine's (icon · label · the tab's badge, plus a fixed *Boop* item); the area head
    is now the spike's — the orb over a hairline, then the eyebrow (`glyph · AREA · TAB`), the 34 pt headline and
    the sentence **left-aligned**, with search and settings top right; and the blocks the spike has and the kit
    did not: `NKList`, `NKNote`, `NKActions`, `NKInfoRow`, plus `NKNotLiveYet` for a tab whose data is not built.
  - **Every area's tab set is the spike's**: Alvás *Ma · Hét · Előzmények* · Energia *Ma · Check-inek · Minták* ·
    Edzés *Ma · Blokk · Gyakorlatok · Előzmények* (the spike says "Terv"; the owner renamed it) · Forma
    *Ma · Mi hat rá* · Étel *Ma · Receptek · Kamra · Hét* (B4's room, now in the same bar) ·
    **Pénz** *Ma · Pénzem · Költés · Gyakorlás* · **Levél** *Ma · Figyelt · Szabályok · Fiókok*.
  - **Pénz and Levél have pages before they have data** (L1/L4): `Hue` gained the two colour worlds the ring
    already painted, so each tab is there and says what will be in it. **No invented number ever reaches them** —
    the spike's figures were drawn, not measured.
  - Blocks are filled from the brief, the day ledger and the food store only. Where the spike shows something the
    app cannot know yet (the mezociklus, exercise records, the six-week sleep curve), the tab says so.
  The gaps that remain, said out loud: three areas have no mood photo (`mezo-r36n9.60`), Pénz and Levél have no
  glyph of their own (a scale and a book stand in), and Edzés's three deeper tabs wait for B5.
- **The Edzés room (B5 phase 1, `mezo-r36n9.15`)** — the same page, with its own data. Edzés left `AreaRoom`
  for `ios/Boop/Edzes/EdzesRoom.swift`, branched beside `EtelRoom()` in `NapView`, because the morning brief
  cannot carry what the training API knows. **The frame is still the kit's** (`NKAreaPage`, the area's own bar,
  the tab set and its badge are unchanged — the owner has seen that page), and every control it had is still
  there. What is new on **Ma**:
  - the exercise rows now carry the **real warmup/working split and the weight the engine asks for**
    („2 bemelegítő · 3 sorozat · 6–10 ismétlés", „80 kg × 8"), and a row is ticked when the server has a logged
    set for it. With the hypertrophy engine **off** the server sends only counts, so the rows show counts and
    **no weight at all** — the plan's anchor weight is its reference, not a per-set target, and printing it as one
    would be a claim the server never made;
  - **„Az eligazítás"** — what the engine changed for today and why, **verbatim from the server's own
    `rationale`**. Nothing is written in the app, and with the engine off the block is simply absent;
  - **„A heted"** — Monday to Sunday, each day saying whether it has a finished session. A day still to come is
    drawn plain; nothing is claimed about it;
  - **offline is an answer, not an error**: reads go through `ServerCache`, and a cached plan is shown **with its
    age** („8 órás terv", „2 napos terv"). With no cache and no network the block says so (`NKNoFreshData`);
    a refusal or a server fault is reported as itself and never dressed as an old answer.
  **Edzés also speaks on the living wall** through one `WallSource` (`edzesWallCandidates`), the only way an area
  may say anything there: a planned session is `.improves` (rank 0.9 within two hours, ahead of the food tip's
  0.7; 0.5 beyond), a session **about to be missed** is `.expires` with the end of its grace window as
  `expiresAt` — so the wall drops it by itself, and it is the one role that may ring the phone under the
  two-a-day cap — and a finished session is `.happened`. The brief's old thin stand-in (`edzes-keszulj` inside
  `briefWallCandidates`) was **removed in the same change**: two sources offering a session card would bring back
  a card he had just dismissed, because `acted` is keyed by candidate id.
  **Round 2 (owner, 2026-11-17 — he had the live app's own screens in mind):**
  - **„A mai terhelés"** — the **real muscle map** he already has on the web, on Ma: the same MuscleMap (MIT)
    artwork from the same vendored upstream, generated into Swift by `scripts/gen-body-geometry-swift.mjs` and
    read by the kit's own SVG path reader (`NKPath`). Today's **working sets** light the muscles, read against
    the hardest-worked one — a single session has no meaning against a weekly landmark. One body normally; both
    when the session really works both sides, because hiding one would hide half of what he did. Beside it the
    three numbers he asked for: how many exercises, how many working sets, roughly how long.
  - **„Hol tartasz"** — the block as a timeline, **time across and difficulty up** (`NKBlockTimeline`): eight
    weeks, the week he is in lit and named, and the deload drawn **hollow** so a dip never reads as a week he
    missed.
  - **The exercises are a carousel** (`NKCarousel`), and **„Az eligazítás" is gone as a separate block** — it
    said the same thing twice (*„a mai edzés és az eligazítás kb ugyanaz"*). The engine's sentence now rides on
    the card of the exercise it is about. Every carousel in the app carries **dots** under it, so a row that
    continues says so.
  - **„A heted" moved to Blokk** as a day carousel (pick a day, see what it asks for), and Blokk gained **„A
    blokk terhelése"**: the timeline plus a line about the muscles, opening a page that breaks the whole block
    down muscle by muscle — the planned scaffold as a faint bar, what was actually logged on top of it, and
    **nothing at all** for a week that has not happened.
  - The area menu's **„Blokk" tile became „Egyedi edzés"**: Blokk is one tap away in the bar below, and the
    one-off custom workout had no way in at all.
  **Round 3 (owner, 2026-11-17 — he pointed at the web app's own week page,
  `/train/mesocycles/:id/week`, as the standard):** „A mai terhelés" runs the full width (the three numbers as
  the kit's own `NKStatRow`, the muscles beside the body with their set counts and bars); every exercise card
  carries a **`NKBodyMark`** — the same body with that exercise's muscle lit — as its left rail, with the muscle
  named under it, and its set plan reads in two short lines so the rep range never breaks in half.
  **„A blokk terhelése" was rebuilt on what made the web page good**, with the same maths
  (`BoopCore/Train/MuscleBands.swift` mirrors `mesoBands.ts` + `mesoWeek.ts`, so a muscle is never at its
  ceiling on one screen and short of it on the other) and deliberately **not** its vocabulary — „Hamstring",
  „Core" and „MV-n tart · nem rámpázik" are the bad translations he asked us to drop:
  - the page opens with a **verdict** („10 izomcsoportot edzel ezen a héten"), how many are still growing / at
    their ceiling / merely held, and the week-over-week delta as a sentence;
  - the week's total as **one big number**, next to a **body filled muscle by muscle** against each one's own
    ceiling;
  - the muscles **ranked by the room they still have**, each with its tier (Hangsúly · Építés · Tartás), a
    **sentence** („Még 3 szett fér bele" / „Elérte a felső értéket ebben a tervben"), a bar whose rim is **this
    plan's ceiling** with the lowest useful level marked in it, and the set count;
  - and a muscle opens **its own page**, where the weeks are finally labelled — „3. hét · építés · 8 / 12
    megvolt / terv" — which was his other complaint: the squares never said which week or how many sets. That
    page also spells the three landmarks out in words and shows where the muscle is on the body.
  **The one idea the whole thing rests on:** a muscle's ceiling is **not its MRV** — it is where *this plan*
  takes it, by the priority he set (emphasize → MRV, grow → MAV, maintain → MEV). Telling a maintained muscle it
  "has 8 sets left" would be a promise the plan never made.
- **The workout player and its closing (B5 phase 2, `mezo-r36n9.15`)** — **the owner's own Lágy player, taken
  over almost as it is** (`IRANY.md` §11b, owner 2026-11-05, and the „Mezo · Lágy irány" artifact's `jatszo()` /
  `cer()`), dressed in Napkelte. That was the easy half: the Lágy player was already dark with one vivid accent,
  so here the accent is the Mozgás hue and **gold stays for records alone**. Three screens and one rule between
  them:
  - **lifting** — the exercise, **its note visible** (not behind a button, the owner's own catch), what the plan
    asks, two big steppers, the sets so far (a done set opens for correction, − and + change how many there are),
    the reserve 0…3+, and one primary button that reads „Kész · a terv szerint" until he touches a number;
  - **rest** — the countdown as a **bar, never a ring** (`NKRestBar`; the Napkelte canon says the same from the
    other side: a circle here is a real clock), and above all **the verdict of the set just done** — record ·
    a terv fölött · pontosan a terv · a terv alatt, with the sentence behind it;
  - **the three questions** (Pumpa · érzed? / Ízületi fájdalom / Akarunk még?) — **once per exercise, after its
    last set**, never between sets. That is the rule the whole model is built around.
  Parity was the owner's catch on the first Lágy round, so it is the bar here: add and drop a set, correct one
  already logged, skip with the summary not punishing it, do it later, the note, finish early.
  `WorkoutSession` (BoopCore) is the model: **keyed by exercise id, never by position** — the web twin
  (`workoutState.ts`) assumed linear order in two places and logged sets against the wrong exercise when one was
  reordered. It is `Codable` and written to the **outbox folder** (his own unsent work, not the disposable
  cache), so a workout survives the phone locking, a crash and a relaunch. Every set, skip, debrief and finish
  goes out as an **outbox item** — a basement gym changes nothing.
  **The closing ceremony** follows the repo's own ceremony pattern: **one pass drives everything** (cubic
  ease-out, 2400 ms — the orb rises, the counters count up from zero, the sections arrive off that single
  number), Reduce Motion paints the finished state at once, and the verdict ladder **never shames**
  („Erős nap." → „Rögzítve."). The sunrise is behind the head only; the numbers sit on the dark ground. Left out
  of the Lágy version on purpose: the five stars, the score, the points and the quests — Boop hides gamification
  (2026-11-11), and a workout is not graded out of five here.
  **Two bugs of round 4, found by the owner and fixed the same day:**
  - **A black screen after „Mentés · tovább".** The rest screen asked the **current** exercise for its last
    set — but answering the three questions moves the session to the *next* exercise while the rest runs on,
    so at that moment the current exercise had no logged set and the whole screen rendered nothing, with no
    way out of it. It now reads `WorkoutSession.lastLogged` — the most recent set **anywhere** in the session
    — and names the exercise when it is not the one in front of him. Three tests pin it.
  - **The rest clock froze at 0:00 behind the three questions**, because `remaining` read `step`, which is
    `.debrief` there. It reads the rest's own end instant now.

  **Round 4 (owner, 2026-11-17 — „hiányzik az indítás előtti rész", with the Lágy briefing beside it):**
  - **„Eligazítás" — the screen before the first set** (`Edzes/WorkoutBriefing.swift`), the Lágy briefing in
    Napkelte: the day's own title big, a sentence counting the exercises, working sets and muscles, the
    **time estimate** on a 0–90 minute axis (`NKTimeRange`, the server's own `durationEst` ±10 %, said out
    loud), three numbers, the one thing worth a warning (a kímélő-mód comeback, or an exercise the server
    marked), **„Mit vállalsz ma?"**, **„A mai sor"** with every exercise's photograph and muscle group, Boop's
    one line, and „Indulás · N küldetéssel". It is a full-screen cover outside the area-page system, like the
    player it leads into.
  - **A mission is a step the engine actually took** (`BoopCore/Train/Missions.swift`) — **not gamification**:
    the decision to hide the web app's quests stands, there are no points and no score. `trainMissions` reads
    the progression's own lever (weight up → *Túlterhelés*, reps up → *Több ismétlés*) and, when his records
    are loaded, calls it a *Rekordkísérlet* if today's target would beat anything he has ever done on that
    exercise. **A deload is never a mission** and nor is a hold. **The card says where it stands and the
    button says what the tap does** (owner, 2026-11-17): a taken mission is lit, outlined in the hue and
    badged *✓ VÁLLALVA* with „Elengedem" under it; a released one has its photo and numbers faded and is
    badged *— ELENGEDVE*, its „Vállalom" staying at full strength because the action is live even when the
    mission is not. A filled button reading „Vállalom" had read as a command, so taking a mission on looked
    like switching it off. Two things of the Lágy version are deliberately
    missing because nothing real stands behind them: the per-mission **confidence percentage** (the engine
    computes nothing of the sort) and the quest vocabulary. **Letting a mission go** takes that exercise back to
    **last week's own numbers** (`TodayWorkout.withReleasedMissions`); with no last week it keeps the plan,
    because a lighter invented weight is exactly what this room must not print.
  - **Photographs, from the server's own catalog** (`NKRemoteThumb` / `NKRemoteBanner`, `BoopConfig.mediaURL`):
    124 of the 174 catalog rows have demo stills at `/exercises/<slug>-a.jpg` on the API's own origin. They are
    on the briefing's line-up, the mission cards, the Ma carousel, the player's head, the rest screen's
    „következik" row, the swap sheet and the technique sheet — toned like every other photo, with a gradient
    before any white type, and **every one of those views is correct with no photo at all**.
  - **Ma's session card carries the button** (`TodaySessionCard`): „Indítás" / „Folytatom", the running
    workout's progress as a bar with its percentage, and how many missions are taken. The **exercise cards were
    cut back to a photograph, the muscle group and the name** — the set plan and the engine's sentence moved to
    the briefing, where he reads them before he starts.
  - **The lifting screen's furniture is his** — the „2. szett / 6 · 1. gyakorlat / 2" counter and the
    „legutóbb…" line are **gone** (the strip above and the set list below say both), the **reserve is a third
    stepper directly under the weight and the reps**, all three a couple of points smaller, the sets are a
    **table** (`NKSetTable` + `NKSetRow`) — a header line and one row per set, each value in **its own cell**
    with the mark of how it went against the plan on the right, so the columns line up down the whole list
    (owner's second pass: *„ne csak odaírva"*). The weight is **centred** in its column, and the mark is a
    **tilted arrow**: green and up for a set that met the plan or beat it, red and down for one that fell
    short (`NK.good` / `NK.under`), with the gold medal, bigger than both, for a record. Arrows are the one
    SF family the Napkelte canon allows beside chevrons, and the rest screen's verdict card carries the same
    three marks so the card and the row agree at a glance. The row's left rail is the exercise's photograph
    and **its name alone** — the muscle group came off the top (owner: standing at the machine he knows what
    he is working) — and **everything else lives behind one „…"**: the note, the
    swap, the records, the technique, a set more or fewer, doing another exercise because the machine is
    taken, later, skip, and finishing the workout. There is exactly **one „…" on the screen**, and it sits
    **top right, level with the minimise chevron**: it lived beside the exercise for a round, which put it
    out of reach during the rest, where the exercise head is not on screen at all. `NKInlineStepper` put the
    reserve on one slim line instead of a third tall card.
    That menu also opens **„Eligazítás — a mai edzés"**: the briefing goes back over the running player so he
    can read the day again mid-workout, with its button reading „Vissza az edzéshez" and the mission toggles
    inert, because those decisions are already made.
  - **Typing, not only tapping**: weight, reps and reserve are fields (`NKStepper`'s `onSet`), because a stepper
    alone cannot enter 62,5 kg on a machine he has never used.
  - **„Foglalt a gép — mást csinálok most"** (`WorkoutSession.switchTo`) — the machine is taken, so he picks
    another exercise off today's list and carries on with it. The owner asked for exactly this instead of the
    reorder the round first shipped (*„ne is sorrend legyen, hanem simán lehessen másik gyakorlatot választani,
    ha épp foglalt a gép"*), and it is **not** a reorder: the plan's order stands, and when the chosen exercise
    is done the session returns to the first unfinished one after it. The rest is cleared on the switch —
    walking to another machine *is* the rest.
  - **The swap is live** (`TrainClient.changeExercise` → `POST /api/train/workouts/{id}/exercises`, scope
    `TODAY`). It is **the one write in the player that asks for a connection**, and it says so: the server mints
    the replacement row's id and every later set is addressed by it, so queueing it would mean queueing writes
    against an id that does not exist yet. A failure stays **in the sheet**, where he is still looking, rather
    than in a toast. The replacement keeps the old row's place and its logged sets but takes **its own** set
    plan (`WorkoutSession.swap(_:for:)`). Two bugs fell out of building it and are fixed: the app built **two
    `TrainClient`s** (one for the room, one inside `RitmusClient`), so the queue learned the server's workout id
    and the player never saw it — there is now one, passed in; and the player's own messages were raised on the
    room's toast, which lives **behind** this full-screen cover, so they were never seen.
  The area menu's **Gyakorlatok** tile took the dumbbell glyph: `ball-sun` draws as a plain filled circle on a
  dark tile, which read as a missing icon rather than an icon.
  Still a promise, and said so on the page: the custom workout, Gyakorlatok and Előzmények.
  **A review launch clears the workout in progress** (`RootView`, DEBUG preview only): it is written to the
  user's own folder, not to the preview's scratch root, so without that a workout left running sent the next
  launch straight into the player and the briefing could not be seen again. On his phone it stays on disk,
  which is the point of it.
  Simulator switches: `-previewHome edzes` (the room straight from the ring), `-previewEdzesRest YES` (a rest
  day), `-previewEdzesPlain YES` (the engine off — the state that must never print a weight), `-edzesTab <név>`.
  The preview day is five **real catalog exercises** with their real picture paths and a mix of levers, and the
  review answers `startWorkout`, the set/feedback/skip/finish writes and `changeWorkoutExercise` statefully, so
  the swap can be walked without a server.

- **The block builder and the weekly review (`mezo-r36n9.83`, shipped 2026-11-19; plan
  [`2026-11-19-boop-blokk-epito.md`](../superpowers/plans/2026-11-19-boop-blokk-epito.md), look: the approved spike
  `spike/boop-blokk-epito`)** — on Edzés → **Blokk**: an entrance card (`WeekReviewEntrance`) with this week's proposal
  (*Átnézem* / *Elfogadom átnézés nélkül* = `acceptRest`; read-only "életbe lépett" once applied/auto-applied; nothing for the
  week when there is no proposal) and *Blokk szerkesztése*. Code: `ios/Boop/EdzesTerv/`, models in `BoopCore/Train/`.
  - **Builder** (`BlockBuilderPage`, full-screen cover at page level): own bar **Izmok · Napok · Blokk**, the scope in the
    head („EGY HÉT · IZMONKÉNT" / „A TELJES BLOKK · 6 HÉT"), one primary button — *Igazítsd a sávba* (every outside muscle's
    proposal) while any outside muscle has one, else *Mentés*. **Every number is the server evaluator's**: `BlockBuilderModel`
    keeps a `BlockDraft` and re-POSTs it to `evaluateMesoPlan` 300 ms after the last edit; an answer for an older draft is
    dropped, a failed one keeps the last numbers on screen ("frissül…"). Izmok: body map, a card per banded muscle (tier
    switch, half dial, spread, proposal + *Elfogadom* / *miért?*). Napok: day pills with minutes, steppers 1–8, technique pill
    cycling the exercise's allowed list (free weights: "szabadsúly · nincs technika"; half reps only when lengthened-friendly),
    one challenge flag a day (it clears the exercise's technique), session-cap warnings with the server's cap. Blokk: style
    four-way choice, the *Technikák* and *A heti javaslatot én hagyom jóvá* switches, week totals + per-muscle path, technique
    weeks (the planner's count when sent, else every loading week while on). **Save** writes only what changed, in order
    settings → re-read (a new style re-stamps rows) → tiers → changed days (`replaceDayExercises`, style trio carried by omission
    except `workingSets` joins `overrides` on a styled row, technique trio sent as drafted), stops at the first failure and says
    what was saved, then re-reads (a day save re-mints ids). Leaving with unsaved edits asks first.
  - **Weekly review deck** (`WeekReviewDeck`): a card per changing muscle (body order), a tile per line (kind mark, day + kind
    pills, from → to loudest, reason pills — 27 codes, unknown → no pill; unknown kind → plain from → to), per-tile accept /
    keep, card-level *Elfogadom mind* / *A többi marad*, the "nem változik" card, the summary card (ring, three tiles,
    per-muscle result, where it lands in the week). **Decisions are local until the summary** sends them once with `keepRest`
    for anything undecided; a 409 (week closed) re-reads and says so. A closed proposal opens read-only.
  - States: no running block, loading, load error with *Újra*, offline, decision expired, smallest width (SE 3rd gen), reduced
    motion (no deck/ring animation), VoiceOver labels on steppers, dial, tiles. DEBUG review without sign-in:
    `-previewBlokk YES` (+ `-previewBlokkOpen epito|het`, `-previewBlokkTab napok|blokk`, `-previewBlokkCard N`,
    `-previewBlokkState empty|loading|error|offline|applied`) over `PlanPreviewTransport` — whose evaluator is a fixture.
- **The technique and the challenge in the player (`mezo-r36n9.84`, 2026-11-19; spec
  [`2026-11-17-train-style-and-techniques-design.md`](../superpowers/specs/2026-11-17-train-style-and-techniques-design.md)
  §6.4/§6.6/§6.10, look: the round-7 spike on `spike/boop-blokk-epito`, owner OK 2026-11-19)** — the player reads
  T1–T3's prescription: `PrescribedSet.technique/restSec/legs` and `TodayExercise.technique/challenge/challengeBest`
  (the BoopAPI contract copy was resynced; no new operation). The exercise head carries a **technique pill** (the
  builder's own `PlanMark`) and a **KIHÍVÁS** pill (`planWarn`); the planned technique set gets a line under its row.
  When the technique set is current a **step card** (`TechniqueStepCard`, lines built from the server's legs by
  `TechniqueLines`) lists the steps („Bukásig" · „30 mp pihenő" · „40 kg, ugyanannyi"). The main part opens a
  **`TechniqueRun`** in `WorkoutSession` (new steps `.techniqueRest`, `.leg`, `.partials`): the short rest counts
  down inside the card and moves on by itself, each leg is prefilled from what he **actually** lifted
  (`WorkoutSession.legDefaults`: 30 % off the real weight snapped down to 2,5 kg, „ugyanannyi" = his real reps), a myo
  mini-set below `minReps` ends the set, „Elég volt" stops early. The half reps are their own moment
  (`PartialsCounter`): a ring he taps, the best to beat, gold when beaten; the debrief says „Új csúcs: 9 félismétlés ·
  eddig 7". **The set is queued once, when the technique is over**, with `technique` + `legs` (the parent row stays
  the main part, T2's rule); a skip / postpone / switch / finish mid-technique closes it first, and the player sends
  whatever sets are new by diffing logged ids (`sendNew`). A set added in the gym never repeats the technique. **Technique + challenge on one set** (owner 2026-11-19,
  `mezo-r36n9.98`/`.99`): the set's legs are the technique's, then a `partials` leg; `liveChallenge` = the technique
  set ends in partials; `TechniqueRun.position` lets „Elég volt" (`stopTechniqueSteps`) or a short myo mini jump over
  the remaining technique steps to the challenge. The
  rest between sets is now the plan's own `restSec` on a styled block (else 90 s). Simulator switch:
  `-previewEdzesTechnique YES` (rest drop on the first exercise, the challenge on the second, myo on the last).

- **A set correction reaches the server (`mezo-r36n9.96`, 2026-11-19)** — the correction sheet used to change the
  phone's session only (no `workoutSetEdit` item was ever queued, though the sheet said otherwise). Now the player
  collects the corrected sets while the sheet is open and, when it closes, the room queues one `workoutSetEdit` per
  set, naming it by **exercise + position** (`WorkoutSetEditPayload.exerciseId/setIndex`; `setId` stays optional for
  items queued by an older build). The item waits behind the set it corrects in the same outbox group, and
  `TrainClient` resolves the server's set id at send time: from the `logWorkoutSet` answer remembered in this run, or
  after a relaunch from `getWorkoutDetail`. Not found (for example a set logged before a swap, which the server keeps
  on the old row) → the item fails visibly with `TRAIN_SET_NOT_FOUND`. Legs are never sent with a correction, so a
  technique set's steps stay as logged.

- **The Étel room (B4 Étel, shipped 2026-11-13, `mezo-r36n9.14`; spec [`2026-11-13-boop-b4-etel-design.md`](../superpowers/specs/2026-11-13-boop-b4-etel-design.md) — owner decisions 8–21, plan [`2026-11-13-boop-b4-etel.md`](../superpowers/plans/2026-11-13-boop-b4-etel.md)).** The Fuel orb on Ma opens `EtelRoom` (`Etel/EtelRoom.swift`, kit `NKDrillPage` in the fuel hue with a food photo head `NKPhoto.konyha`, four capsule tabs **Ma · Receptek · Kamra · Hét**, last tab kept in `@SceneStorage`). One `EtelStore` (`Etel/EtelRoom.swift`, logic in pure `EtelLogic.swift`) loads day / plan / coach / photos / supplement stash independently, so one failing read never blanks the room. All server calls go through `FoodClient` (`BoopCore/Etel/`); the model types in `FoodModels.swift`. The server owns the rules (day plan, scoring, sensitivities); the phone shows them and never recomputes a verdict.
  - **Ma tab** (`EtelMa`, `MealCard`, `DimensionSheet`): five numbered sections — **1** the day's budget (kcal headline + three macro bars; a kímélő GUIDANCE day shows "ma nincs kalóriakeret" and a "Kikapcsolom" button instead), **2** the day's plan (logged meals as photo cards with score and macros; the open windows from `GET /api/fuel/plan/{date}` with the MOST badge, the suggested recipe or ingredient tip, *Megeszem* / *Kihagyom* / camera), **3** the next-meal tip (*Megnézem a receptet* switches to Receptek when the window has a recipe; *Most nem* dismisses it locally), **4** víz (+250 / +500 ml, idempotent writes), **5** kiegészítők (one-tap group tick). A meal card opens the eight-dimension sheet (macro, micro, who, fat quality, NOVA, plant diversity, **energy density**, context — "Adag" is a recipe-only dimension; each shows what it measures, the server's own detail and the coach note). The processed-food line appears only as the coach's one quiet sentence when NOVA 3–4 carry more than half the meal's kcal; the phone adds no NOVA badge of its own. The headline wraps to two lines on long numbers (kit 38 pt); under 230 pt content width the dimension grid goes to two columns.
  - **Capture is offline-first** (`Etel/Composer.swift`, `PendingMeals.swift`, `PhotoCapture.swift`; `BoopCore/Etel/{MealDraft,FoodOutbox}.swift`). Five entrances — **Fotó · Szöveg · Vonalkód · Recept · Kamra** (plus **Szokásos**, below) — end in ONE editable draft (name, amount, delete per line; totals; sensitivity and "nincs adat" notes) and **nothing is saved without the owner's tap on *Mentem***. The draft is computed by the model through `draftMealFromAi` (a barcode-only capture never calls the model — the scanned product becomes the line). With no network the capture is parked in the **same `Outbox` as B3** (new `OutboxKind.mealDraft`; one queue, one backoff / age / failed machinery, flushed on foreground, net back and background; each meal is its own order group): the photo is stored as `meal-<uuid>.jpg` beside `queue.json` (the payload carries only the id), and when the net returns the draft is computed and parked as a **confirmation card** ("Jóváhagyásra vár" with *Mentem · Átnézem · Elvetem*) — the sender never saves a meal on its own. The capture keeps its own `capturedAt`, sent with the **phone's UTC offset, never `Z`** (`FlexibleISO8601Transcoder` writes the offset for every generated-client date; the server dates the meal by that offset, so a 00:30 Budapest meal sent as `Z` would land on the previous day) and a stable `clientRef`, so a retry after a lost answer creates no duplicate (§4, [`fuel.md`](fuel.md)). A capture older than 7 days is shown as failed with its values and photo kept (**Újra**), a refused save (400) says which shelf/recipe-tied lines may have been deleted and stays editable; a failed photo upload never fails or discards the meal (`hasPhoto` tells). The draft's lookup state is spoken honestly (`draftNotice`): lookup failed ≠ "unknown code" ≠ "no food found". Photos are JPEG downscaled to 1600 px (ImageIO); the camera needs `NSCameraUsageDescription` (`INFOPLIST_KEY_` in the app target, the only `project.pbxproj` change of the slice) and falls back to the photo library when it is absent or the device has no camera.
  - **Barcode** (`Etel/BarcodeScanner.swift`, `ServingConfirm.swift`): VisionKit `DataScannerViewController` (EAN-13 / EAN-8 / UPC-E, first code only, guarded `isSupported && isAvailable`) with a typed-code field that is always visible. The lookup (`lookupPantryItem`, response-level `source` OFF / CATALOG / NONE) shows the product with the owner's sensitivity line (no allergen data reads "nincs allergén-adat", never "free of"); a miss offers a label photo or words and the code rides along. The **serving confirmation is always shown** — 100 g / 1 adag / free grams (grams by default when the serving is missing, a CATALOG hit has no serving) — and scales the per-100 g facts; kcal absent ⇒ the line is marked needs-review, never a fabricated zero. **The live scan, the permission prompt and Fotó opening the camera were verified only in the simulator's typed-code path — they need a hands-on check on the phone** (§9).
  - **Sensitivities everywhere a food appears** (`BoopCore/Etel/SensitivityRules.swift`, mirror of the server's rules): the badge on a draft line, a shelf row, a recipe row or a suggestion is "Tej · Intolerancia: tartalmazza" style; an absent allergen key is **"nincs adat"**, an ALLERGY-level key with traces/unknown is warned, nothing ever reads "mentes". The profile is read once into the store; saving it in *Amit kerülök* reloads the room, so the tip cannot keep suggesting something just excluded.
  - **Photos** (`NKThumb`, `NKCardPhoto`): meal photos live on the server (`PUT/GET/DELETE /api/meal/{id}/photo`, `POST…`; recipe photos on `/api/recipe/{id}/image`), are fetched with revalidation (`ETag`, `no-cache`) and show on the Ma meal card, in the recipe row/detail and in Napló; the stored bytes are deleted with the meal / on replace (see [`fuel.md`](fuel.md), [`recipe.md`](recipe.md)).
  - **Cross-surface** (B4 Task 15, additive): Ma's timeline merges **food rows** in clock order after the B3 rows (`MaPhases.etelStations`: the next open window with a "kb. N kcal" budget sub line, or the first untaken supplement group, or one "Mind bevéve" row; a tap opens the room), `MaBelow` holds its own `EtelStore` loaded with the *light* read (`load(food:now:extras:false)` — day, plan, protocol; no coach, no photos) and re-reads the taken-supplement set from `UserDefaults` on every load so the two stores never disagree. The supplement clock is a daypart guess, shown hedged as "kb. 8:00" in the sub line (the 42 pt time column stays empty for it). **Napló** day detail gets "A NAP ÉTELEI": only meals with `hasPhoto`, photos fetched for those, one quiet line when a photo could not load (said only after the downloads finish), the section absent for a day with no photo meals. DEBUG launch flags for the room: `-etelTab`, `-etelSheet` (`kamra-item|kamra-catalog|add-link|add-label|add-manual|add-barcode|usuals|het-day|detail|import|text|workshop`), `-etelImportRun`, `-etelWorkshopAsk`, `-previewOpen barcode`, `-previewCode`, `-previewServing`, `previewFoodOffline` (see `ios/README.md`).
  - **Not in B4 (honest list):** the scanned barcode is not saved on the meal, so a code photographed once is a miss again next time (follow-up bd issue); no thumbnail on Ma's timeline meal rows; the shelf is read-only apart from add (no edit/delete of a food); Hét cannot name *which* meal was skipped (the week rollup carries only skipped kcal); `recipe.timesLogged` is always 0 so iOS does not show it; no link-an-unmatched-ingredient-to-a-food step in the import review.

- **Sign-in** (`SignInView`): e-mail + password; Hungarian problems under each field, cleared on edit;
  server errors in a peach card (wrong password, offline after 20 s, server error). "Van meghívókódom"
  → **Register** (`RegisterView`): invite code, name, e-mail, password (8–72); used invite and taken
  e-mail show under their own field.
- **Onboarding** (`OnboardingFlow`): Pár adat rólad (sex, height ruler, birth date wheel) → Mennyi ma?
  (weight ruler, 0,1 kg) → "Szia, Boop vagyok" → shell. Resumes at the right step after an interruption.
- **Shell** (`ShellView`): superseded by B2 — see **The spine (B2 Gerinc)** above.
- **Connect Health + calendar** (`ConnectFlow`, S2): after the first weigh-in, and from Nap's
  "Kössük össze az Egészséget és a naptárat" row. *Kössük össze* lists Apple Egészség and Naptár, hints to
  pick the full data range on the iPhone's Health sheet (iOS 26 offers "last 30 days" vs "all"), then asks
  Health (read: sleep, steps, active energy, heart rate, resting HR, workouts) and calendar (full access,
  read-only). *Behúzom az elmúlt 60 napot* fills Boop's orb with the progress and the live counts, then says
  "Megvan: *58 éjszaka*, 60 nap mozgás és 21 edzés." No Health data → a peach card with where to switch
  it on (Egészség app › Megosztás › Appok › Boop); calendar refused → a line with Beállítások › Boop ›
  Naptárak; the other source still syncs; "Most kihagyom" always leaves.
- **Nap card** once connected: "Beérkezett adatok" with the counts chip — everything synced so far
  (`HealthSync.totals`: distinct night dates / day dates / workout ids kept per user, so re-sent records
  count once; a phone synced before totals existed re-reads the 60 days once, `mezo-r36n9.5`) — and one status chip
  (frissítem… · nem sikerült frissíteni · naptár: nincs engedély · frissítve HH:mm); tapping refreshes.
- **Refresh on open**: every return to the foreground re-syncs (10-minute debounce); a calendar change
  re-sends today + tomorrow. **B1:** the code also wakes on new Health data in the background (`HKObserverQuery` +
  background delivery) — present but **unverified on a device** (the free team accepts the entitlement; verification is the paid-team follow-up `mezo-r36n9.19`).

## 3. Architecture & data flow

- **B1 · Adatalap (shipped 2026-11-11 on the FREE Apple team, `mezo-r36n9.11`; plan [`2026-11-11-boop-b1-adatalap.md`](../superpowers/plans/2026-11-11-boop-b1-adatalap.md))** — the data foundation:
  - **Hybrid storage.** `daily_metric` is widened for day rollups (distance, basal kcal, exercise min, HRV, respiratory rate, SpO2, wrist temperature, VO2max, walking HR, mindful min, daylight min) and the new per-sample table `health_sample` holds discrete samples (metric code, start/end, value, unit, source name/bundle, device, user-entered). **Heart rate is stored as 5-minute buckets** (avg/min/max in one row, key `hr-<bucket start epoch>`; HR backfill 14 days, everything else 60).
  - **23 HealthKit read types** (`HealthKitReader`), read with **anchored queries** (`HealthReader` + `HealthChange`); an anchor is saved only **after the server acknowledged** the batch, so an interrupted run re-sends and never loses. Cumulative day rollups use HealthKit statistics (Apple de-duplicates by the user's source order).
  - **Background delivery** (`HealthBackground`, `BoopAppDelegate`, `BackgroundSyncHost`): one `HKObserverQuery` + `enableBackgroundDelivery` per observed type from `didFinishLaunching`; each wake runs one coalesced incremental sync and always calls the completion handler. Code is in and the free team accepts the entitlement, but **delivery is unverified on a device** (→ `mezo-r36n9.19`).
  - **Nights.** Source priority per night: Apple Watch → ring apps (Oura/Ultrahuman/RingConn) → Sleep Cycle → any other app → (tie-break) the session with the most staged minutes. The phone computes **sleeping HR** over the winning session's asleep intervals and sends `sourceApp`. **One live night per date** (`uq_sleep_log_owner_date_live`, partial unique): the Health writer and the web/manual writer both go through `SleepNightMerge` — sensor fields (times, duration, stages, hypnogram, in-bed, sleeping HR, source app) come from Health, subjective ones (quality, awakenings, notes) are kept from the manual row; an insert race retries the merge once. A night the user **deleted stays deleted** (a re-send does not revive it). When the phone sends `windowFrom/windowTo`, Health nights inside the window that are missing from the payload are soft-deleted (this is how a deleted Health sleep propagates).
  - **Deletions.** Deleted workout/sample uuids from the anchored queries go to `POST /api/wearable/deletions` (soft delete, `WearableDeletionService`).
  - **Weight from Health.** `bodyMass` upserts into `weight_log` (`source` manual|apple_health, `external_id`) through a dedicated path — **one** goal recompute and **one** companion event per batch, only for a new weigh-in from today/yesterday (a 60-day backfill never floods).
  - **Workout reconciliation** (read-time, `WorkoutReconciler` in `wearable`; logged sessions via `LoggedSessionReadPort`, implemented in `train`): a Health workout matching a logged gym session or sport session (overlap ≥ 50 % of the shorter one) is counted once. `BoopDayAssembler`'s *yesterday load* now counts logged gym/sport sessions (matched Health workouts dropped, lending kcal/min) so Forma reflects real training even without Health.
  - **Calendar history.** `calendar_event.external_id` (EventKit external id + occurrence), unique per `(created_by, external_id, date)`; for each sent day, live rows missing from the payload are soft-deleted (cancelled event); first sync backfills 60 past days; past days are not touched again.
  - **APNs registration.** `PushRegistrar` (BoopCore) registers the device token with `PUT /api/devices/apns` (`apns_device`, `notification` feature; a token registered by another account is moved). The environment is **hard-coded to sandbox**; the backend does **not send** pushes yet.
  - **Account merge.** `scripts/ops/boop-b1-merge-accounts.sql` (+ rollback, [README](../../scripts/ops/README-boop-b1-merge.md)) moves the Boop account's Health data into the original account; dry-run unless `-v apply`, rehearsed in `BoopB1MergeScriptIT`. **Run in production on 2026-11-11 with the owner's OK** (12 nights merged, 23 moved, 61 days, 16 workouts, 9 events, 1 brief, 1 weight; backups `b1_backup_*` kept until the owner confirms). The phone now signs in with the original account; the old Boop account stays (it received one post-install sync at 11:04 before the switch — orphaned, harmless).

- **S3 — the morning brief, end to end** (backend feature `boop`, `io.mrkuhne.mezo.feature.boop`, a leaf: nothing imports it back):
  1. The phone sends **its local date** (`GET /api/boop/brief?date=YYYY-MM-DD`); the server never calls `LocalDate.now()` for the day.
  2. `BoopDayAssembler.assemble(user, date)` — read-only (no `@Transactional`; never `WorkoutService.getToday`, which writes) —
     gathers last night + 60-night window, 7-day deep-sleep / resting-HR series, 14-day baselines, today's wearable day, planned
     session (override time else gym-schedule time), yesterday's wearable workout minutes, meals + targets, check-in plan and
     answers, intention, up to 3 proposed patterns (observations), calendar → 72 busy slots, sleep-goal bedtime, recovery, weight.
  3. `BoopScores.compute` → five scores + state; `EnergyCurveModel.hourly` → 19 values (06:00…24:00).
  4. `BoopVerdictWriter.write` — one cheap-tier LLM call (`LlmCallContext("boop_brief", "verdicts")`) turns the computed numbers into
     Hungarian headline + sentence per metric, the spoken brief (segments with links `sleep|heart|day`), tonight and next-meal tips.
     The model never scores and never decides the session conflict (rule-detected in `RuleVerdicts`). Any failure — no LLM bean, a
     thrown call, a call slower than `mezo.boop.llm-timeout` (8 s; run on `applicationTaskExecutor` with the llm-log context and
     actor re-bound inside the task), no JSON, a missing field — falls back **per field** to `RuleVerdicts`, same schema; the brief
     never fails on the LLM. The prompt carries the calendar as count, time spans and busy minutes only — **never event titles**.
  5. `BoopBriefService` caches one `boop_brief` row per user + local day: an **input hash** (`v2|`: night id + content, calendar
     events, meal and logged-meal count, weight, session title + time, recovery, the sorted pending observation ids, each check-in's
     slot + done flag, the intention creed + foci, and a **time-of-day bucket** of the owner zone — reggel < 12:00, délután 12–18,
     este ≥ 18, a past day always este) equal to the stored one returns the stored payload with no scoring and no LLM call. So a
     decided pattern, a check-in done on the web or a changed intention regenerates on the next GET, and time-dependent sentences
     ("a nap nagy része még előtted") refresh at most three times a day. Steps, HR and the exact clock are not hashed. A changed
     hash regenerates. iOS keeps an observation it judged out of the brief locally until a brief arrives without it, so a stale
     brief can never bring it back to be decided twice. `POST …/regenerate` always
     regenerates, at most 3 per day (`regen_count`, atomic capped UPDATE; the 4th is 409 `BOOP_REGENERATE_LIMIT_REACHED`, refused before the LLM).
     Generation runs outside any transaction; only `BoopBriefStore.upsert` is transactional. Two racing first requests both
     generate, the loser's INSERT hits `uq_boop_brief_user_date`, re-reads and returns the winner's brief (never a 500).
     **Late model words (`mezo-r36n9.24`, 2026-11-12):** in production the model never once answered inside the 8 s wait, so every
     brief shipped the rule text and the old `cancel(true)` threw each answer away (no `boop_brief` llm-log row ever existed). Now
     `BoopVerdictWriter.ask` returns a `CompletableFuture` that is never cancelled; the request waits `llm-timeout`, answers with
     the rule words (`boop_brief.ai_words = false`) and the late answer is written by `BoopBriefStore.fillWords` — a conditional
     UPDATE onto the row only while its `input_hash` is unchanged and `ai_words` is still false — so the next open shows Boop's
     words. A rule-only row older than 10 min (`RULE_RETRY`, its call failed) is regenerated on the next open. The Postgres
     `23505` line in the logs during a backfill is Hibernate logging the handled race, not a 500. Test: `BoopBriefLateWordsIT`.
  6. A past date is judged as of 23:59 of that day; a date after today in the owner zone is a **400**.
  7. iOS: `MorningClient`/`MorningStore` (`BoopCore/Morning`) loads the brief, with a generation guard so an older load never
     overwrites a newer one; on a 400 for a future date (phone day ahead of the owner zone) it falls back to yesterday. Pure
     builders `PathBuilder.steps(for:…)` and `Lens.action(for:…)` (BoopCore, keyed by `MetricKey`) make stations and the pill;
     the app maps them to the kit's `PathStation` / `Hue` and `MaiView`/`MaiBelow` render. **Reload triggers:** every return to the
     foreground, a change of day, and right after a Health sync finishes (so the brief refreshes by itself after the morning sync).
     Move/undo of the session refetch the brief after success.

- `ios/Boop.xcodeproj` — app target `Boop` (bundle `io.mrkuhne.boop`, iOS 26) + `BoopTests`; screens
  under `ios/Boop/{Auth,Onboarding,Shell}`; `RootView` switches on `Session.State`
  (`loading · signedOut · offline · needsOnboarding · ready`).
- `ios/BoopKit` (local Swift package):
  - `BoopAPI` — client generated by swift-openapi-generator from `openapi.yaml`, a copy of
    `api/openapi.yml` made by `ios/scripts/sync-openapi.sh` (it rewrites the 3.1-style numeric
    `exclusiveMinimum` the generator rejects); operations filtered in `openapi-generator-config.yaml`.
  - `BoopCore` — `Session` (token + state), `KeychainTokenStore`, `makeClient`/`makeTransport`
    (Bearer middleware, ephemeral URLSession, 20 s request limit), `AuthError` + Hungarian texts,
    `OnboardingModel`, `localDay`; S2: `Health/` (`HealthReader` protocol + `HealthKitReader`,
    `buildNights` — sessions split at > 90 min gaps, 14–18 h wake = nap dropped, per wake day the
    session with most staged minutes wins, 5-min hypnogram letters D/R/L/A ≤ 200 — `mapDays`,
    `mapWorkout`, `HealthSync`) and `Calendar/` (`CalendarReader` + `CalendarKitReader`,
    `buildCalendarDays` → exactly today + tomorrow); S3: `Morning/` (`Brief`, `MorningClient` + `MorningStore`, `PathBuilder`, `Lens`, `BoopVoice`).
  - `HealthSync` (`@MainActor @Observable`): window = 60 days on first run, afterwards from the
    synced-through day − 2; sends nights (30/batch) → days (60) → workouts (100) → calendar; the
    synced-through mark (`boop.health.syncedThrough.<userId>`) moves only after a fully successful run, so
    an interrupted backfill re-reads the window (the server upserts are idempotent). 401 → sign-out.
    Sleep is read from 18 h before the window and nights waking before it are not re-sent (otherwise
    the window's first night would be overwritten by its after-midnight half). A run that read nothing
    does not move the mark (the 60-day backfill stays available once Health is switched on). The
    calendar is its own step: its failure sets `calendarFailed` and never undoes the Health upload;
    titles are sent as 1…200 UTF-16 units, blank → "(cím nélkül)".
  - `BoopDesign/Napkelte/` (S2.5) — the live kit: `Tokens` (`NK`, `Hue` ×5: sky, orb, glow), `Landscape`
    (`PaintedLandscape`, `MirroredLand`), `Orbs` (`orbPalette`, `heroOrbCenterY` — one horizon spot for every metric since 2026-11-12, `OrbMotion`, `LivingOrb`, `StillOrb`,
    `RisingOrb`, `MiniOrbRow`), `Glass` (`nkGlass`, `NKPill`, `NKMono`, `Trend`, `NKGlyph`, `nkToast`, `NKBoopCard`,
    `NKField`, `NKSkyScreen`, `NKTag`, `NKRow`), `Frames` (`NKTitleRow`, `NKTabStrip`, `NKTabPage`, `NKFlowFrame`,
    `NKSheetFrame`, `FloatingLights`, `NKGround`), `Charts`, `Tiles`, `DayPath`.
  - S3 additions to the kit: `NKSky` (`.hue` or `.calm`), `NKBackdropPanorama` (the shared landscape and the domain-switch pan), `nkToast(_:action:onAction:)`,
    `WeekBars` with optional days, `RisingOrb(orbScale:)`.
  - `BoopDesign` (legacy) — what is left of the Lágy kit: tokens, Outfit + Manrope (bundled), glyph assets
    (generated by `ios/tools/genglyphs.mjs` from the Lágy prototype's `G()` table), photos, components,
    page frames (`LagyTabPage`, `LagyFlowFrame`), `BoopFigure` (the Metal orb).

- **B3 · Napi ritmus (shipped 2026-11-12, `mezo-r36n9.13`)** — the offline-first daily loop. Pure logic lives in `BoopKit/Sources/BoopCore/Ritmus/` (testable without a simulator); screens and glue in `ios/Boop/Ritmus/`; the kit in `BoopDesign/Napkelte/Ritmus.swift`.
  - **Write path:** screen → **ledger first** (`DayLedger` per day, pending) → **`Outbox`** (persisted JSON queue, item id = the `clientRef` the server keys idempotency on, `capturedAt` = the phone's capture instant) → flush → `RitmusClient` (the real `OutboxSender`: each `OutboxKind` — `checkIn`, `checkInNote`, `goal`, `goalRemove`, `journal`, `voice`, `dayClose`, `chatQuestion` — goes to its generated operation). On `sent` the environment clears the ledger's pending flag. `LedgerStore` keeps per-day files (and merges a server fetch without wiping unsent or newer local rows); **ledger, outbox, goal history and chat map live in the signed-in user's own folder** (`RitmusEnvironment`, one per user).
  - **Verdicts of a send:** `offline` (only genuine no-connection `URLError`s — not an attempt, the drain stops and waits for the next trigger: foreground, back online, background wake); `retryLater` (5xx, 409, 429, a 401 so the item survives a re-login, a timeout; backoff, capped at **8 attempts**, then it becomes a failed row that the net coming back resets); `refused` = `failed` (any other 4xx, and the focus-cap 409 `INTENTION_FOCUS_CAP`) — kept with its values and shown as the **Újra** row; *Újra* re-queues it. Only items of the same date that depend on order wait behind a backed-off one.
  - **Sync order per day: close → journal → relink.** The close (`putDayClose`) goes first; the typed or transcribed journal line (`createJournalEntry` with its own `clientRef`) second; then the close is sent **again carrying `journalClientRef`** (the *relink*), because the server only resolves a ref whose entry has arrived. A re-close rewrites the relinks still queued, so a stale relink never undoes it; a refused row keeps its journal link until the server has the text.
  - **`SnapshotBuilder`** reads HealthKit at the moment of saving (HR = mean of the last 15 min else the latest within 60 min; HRV = the latest within 8 h + the 14-day median; steps = today up to now, `stepsIsDayTotal` false; sleep = the night that ended today). Nothing readable → the check-in goes without one and the server fills it from Health data it already has (`computedBy` server).
  - **`VoiceJournal`** records an m4a into the outbox folder; on-device Hungarian recognition writes the transcript and deletes the audio, otherwise a `voice` item uploads to `POST /api/companion/transcribe` when there is net (the audio goes nowhere else), and the sender then posts the transcript as the journal entry (or as the check-in note). `NSMicrophoneUsageDescription` / `NSSpeechRecognitionUsageDescription` are build settings in the project.
  - **`ChatStore`** finds today's `boop` conversation by when it started in the phone's day (or its date title), keeps day → conversation id per user, sends the non-stream answer, queues a question as `chatQuestion` when offline (before resending a retried one it skips a question the server already has as the last owner turn — `sendMessage` has no `clientRef`).
  - **`RitmusRouter`** (shared `@Observable`, no URL scheme is registered — `boop://checkin|este` is only the route name in a notification's userInfo) holds the cover the shell presents at page level; the notification delegate (`ReminderPresenter`, `BoopApp.init`) sets it.
  - **Backend:** the new `dayclose` feature ([`dayclose.md`](dayclose.md)), the check-in snapshot / window / merge, `clientRef` on goals and journal entries, the `boop` conversation channel with the pushed day block ([`companion.md`](companion.md)); see §4.


- **B4 · Étel (shipped 2026-11-13, `mezo-r36n9.14`)** — the food room. Pure logic in `BoopKit/Sources/BoopCore/Etel/` (`FoodClient`, `FoodModels`, `MealDraft`, `FoodOutbox`, `SensitivityRules`), screens in `ios/Boop/Etel/`, kit additions in `BoopDesign/Napkelte/Etel.swift` (`NKPhoto.konyha`, `NKPhotoSky`, `NKOrbScrim`, `NKCardPhoto`, `NKThumb`, `NKCapsuleTabs`, `nkPhotoTone()`; `NKDrillPage` gained `headPhoto:`).
  - **Read path:** `EtelStore` → `FoodClient` (the generated client over the operations listed in §4) → each read lands independently; the store never derives plan, score or verdict.
  - **Write path (meals):** composer → `MealCapture` → online: `draftMealFromAi` → editable draft → *Mentem* → `createMeal` carrying `clientRef` + `capturedAt`; offline: `FoodOutbox` over the shared B3 `Outbox` (`mealDraft` kind; `ready-<id>.json` written before the send answers `.sent`, so a crash cannot lose a computed draft) → confirmation card → *Mentem*. Water and supplement ticks carry their own `clientRef` (the tick derives per-item refs as SHA-256 of ref + item id, stable on replay). The photo uploads after `createMeal`; its failure leaves the meal saved.
  - **Backend this slice added** (details in the feature docs): sensitivity profile + allergen states ([`pantry.md`](pantry.md)), OFF allergens + barcode-keyed catalog ([`pantry.md`](pantry.md)), the server day plan and usuals ([`fuel.md`](fuel.md)), stored meal and recipe photos ([`fuel.md`](fuel.md), [`recipe.md`](recipe.md)), recipe import ([`recipe.md`](recipe.md)), `clientRef` / `capturedAt` on meal, water and intake writes ([`_platform-api-backend.md`](_platform-api-backend.md)), the softened coach prompt ([`_platform-language.md`](_platform-language.md), [`character.md`](character.md)).

## 4. Data model & API

**S2 — feature `wearable`** (contract tag `Wearable`, `api/feature/wearable/wearable.yml`):

| Operation | Endpoint | Stores |
|---|---|---|
| `ingestSleepNights` | `POST /api/wearable/sleep-nights` → `IngestResult{inserted,updated}` | `sleep_log` upsert by `(created_by, external_id)`, `source = 'apple_health'`, stages + hypnogram |
| `ingestDailyMetrics` | `POST /api/wearable/daily-metrics` | `daily_metric` upsert by `(created_by, date)` — steps, active kcal, resting/avg/min/max HR |
| `ingestWorkouts` | `POST /api/wearable/workouts` | `wearable_workout` upsert by `(created_by, external_id)`; date = local start day (Europe/Budapest) |
| `replaceCalendarDays` | `PUT /api/wearable/calendar-days` → 204 | `calendar_event`: each sent day's rows hard-deleted and replaced |

**B1 additions** (same tag, plus `Device`): `ingestHealthSamples` `POST /api/wearable/health-samples` (upsert into `health_sample` by `(created_by, external_id)`), `deleteHealthRecords` `POST /api/wearable/deletions` (soft delete workouts/samples/weights by external id), `SleepNightBatchRequest.windowFrom/windowTo` (window deletion above), widened `DailyMetricIn`/`WorkoutIn` (distance, max HR, source bundle) and `SleepNightIn` (`sourceApp`, `sleepingHr`), calendar days carry an `externalId` per event, `registerApnsDevice` `PUT /api/devices/apns` → 204 and `unregisterApnsDevice` `DELETE /api/devices/apns/{deviceId}` → 204 (contract `api/feature/device/device.yml`).

Caps (`mezo.wearable`): 100 nights, 120 days, 300 workouts, 3 calendar days × 150 events per request →
`WEARABLE_BATCH_TOO_LARGE`. Sleep: one `SleepLogSavedEvent` per batch at most — only for the newest night,
only when newly inserted and dated today or yesterday (a 60-night backfill never floods Boop's messages).
Wearable workouts are display + AI context only (no calorie-target effect). Changesets
`202611092300_mezo-r36n9.2_sleep_log_apple_health.sql`, `202611092310_mezo-r36n9.2_wearable_tables.sql`.

**S3 — feature `boop`** (contract tag `Boop`, `api/feature/boop/boop.yml`; the web app gets no new feed kind):

| Operation | Endpoint | Notes |
|---|---|---|
| `getBoopBrief` | `GET /api/boop/brief?date=YYYY-MM-DD` → `BoopBrief` | cached per user + local day in `boop_brief`; 400 on an impossible or future date |
| `regenerateBoopBrief` | `POST /api/boop/brief/regenerate?date=` → `BoopBrief` | 409 `BOOP_REGENERATE_LIMIT_REACHED` after 3 per day |
| `setSessionTime` | `PUT /api/boop/session-time` `{date, time HH:mm}` → `SessionTime{date,time,plannedTime}` | upsert into `workout_time_override`, last write wins; 404 `BOOP_NO_PLANNED_SESSION`; 400 on a bad time |
| `clearSessionTime` | `DELETE /api/boop/session-time?date=` → 204 | soft-deletes the override; the planned time is back |

iOS also uses the existing `decidePattern` for the observation swipes. `BoopBrief` carries `date`, `generatedAt`, `state`
(`good|okay|tired|learning`), `nightsKnown`, `metrics[5]` (`forma|alvas|mozgas|fuel|pulzus`: nullable `score`, `display`, `caption`,
`headline`, `sentence`, `trendUp`), `brief[]` (text + link), `energy{hourly[19], dipHour}`, `tonightTip`, `nextMealTip`, `conflict`,
and `day` (sleep + hypnogram stages 0 awake · 1 REM · 2 light · 3 deep, week series, `hrToday{min,avg,max}`, steps, session, meals,
check-ins, intention, observations, calendar `busySlots[72]` = 06:00–24:00 in 15-minute slots, weight, recovery). Nullable by design:
session minutes/time/plannedTime, sleep stage minutes, sleep `bedtime`/`wakeup` (a night may be logged without times) and `day.steps` /
`day.activeKcal` (null without a wearable day, never a fake 0).

**B1 tables** (changesets `202611111000…202611111130_mezo-r36n9.11_*.sql` in `1.1.0/script/`): `health_sample` (`created_by`, `external_id`, `metric`, start/end, value, unit, source name/bundle, device, user-entered; unique `(created_by, external_id)`, index `(created_by, metric, start_at)`); `daily_metric`, `wearable_workout` widened; `sleep_log` + `source_app`, `sleeping_hr`, `source` now `varchar(16)` (`manual|screenshot|apple_health`), generic dedup then `uq_sleep_log_owner_date_live`; `calendar_event` + `external_id`; `weight_log` + `source`, `external_id`; `apns_device` (device id, token, environment `sandbox|production`, bundle id, app version, last seen, invalidated at).

Tables (changeset `202611101300_mezo-r36n9.7_boop_brief.sql`, both soft-delete, partial unique indexes `where is_deleted = false`):

| Table | Columns | Unique |
|---|---|---|
| `boop_brief` | `created_by`, `date`, `payload jsonb` (the `BoopBrief` as JSON), `input_hash varchar(64)`, `regen_count int ≥ 0` (`ck_boop_brief_regen_count`), `generated_at` | `uq_boop_brief_user_date (created_by, date)` |
| `workout_time_override` | `created_by`, `date`, `time` | `uq_workout_time_override_user_date (created_by, date)` |

Tunables (`mezo.boop`, `BoopProperties`): `steps-goal` 9000, `regen-per-day` 3, `nights-needed` 14, `llm-timeout` 8s.

### B3 API operations (the generator filter, `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`)

Added to the `filter.operations` list in B3: `listCheckInsForDay`, `saveCheckIn`, `getCheckInPlan`, `getIntentionDay`, `addFocus`, `removeFocus`, `createJournalEntry`, `transcribeVoiceNote`, `putDayClose`, `getDayClose`, `listDayCloses`, `generateDayCloseLine`, `generateCheckInLine`, `listConversations`, `createConversation`, `listMessages`, `sendMessage`, `getDayContext`. Contract changes behind them (`api/feature/{biometrics,intention,journal,dayclose,companion,boop}`): `CheckInSnapshot`, `capturedAt` on check-ins, `clientRef` on goals and journal entries, the whole `DayClose` tag, conversation `channel`, `GET /api/companion/day-context`, and `BoopSession.done` / `planGoals` on the brief. Write ordering and idempotency are described in §3.

### B4 API operations (added to the same generator filter)

`getFuelDay`, `getFuelWeek`, `getFuelPlan`, `getUsualMeals`, `draftMealFromAi`, `createMeal`, `logWater`, `getMealCoachForDay`, `upsertPlannedSkip`, `listPlannedSkips`, `undoPlannedSkip`, `listRecipes`, `getRecipe`, `createRecipe`, `recipeLogs`, `getRecipeBreakdown`, `workshopTurn`, `importRecipeFromUrl|Text|Photo`, `getRecipeImage` / `putRecipeImage` / `deleteRecipeImage`, `getPantry`, `searchPantryCatalog`, `lookupPantryItem`, `importPantryItem`, `scrapePantryItem`, `photoExtractPantryItem`, `createPantryItem`, `addPantryItemFromCatalog`, `getSensitivityProfile` / `setSensitivityProfile`, `getDietSettings` / `setDietSettings` / `previewDietSettings`, `getFuelSettings` / `setFuelSettings`, `getProtocol`, `addProtocolItem` / `patchProtocolItem` / `deleteProtocolItem`, `logIntake` / `deleteIntake`, `getMealPhoto` / `putMealPhoto` / `deleteMealPhoto` / `deleteAllMealPhotos`, `getRecovery` / `upsertRecovery` / `deleteRecovery` / `recoveryCheckIn` — the filter file is the truth (an operation not in it is not generated). Preview mode (`PreviewTransport`, DEBUG) answers every one of them statefully.

### B5 API operations (added to the same generator filter) — Edzés, stage 1

29 train operations: `getTodayWorkout`, `startWorkout`, `logWorkoutSet`, `updateWorkoutSet`, `deleteWorkoutSet`, `saveWorkoutFeedback`, `skipWorkoutExercise`, `changeWorkoutExercise`, `addPlanWorkingSets`, `saveExerciseNote`, `saveWorkoutNote`, `finishWorkout`, `listWorkouts`, `getWorkoutDetail`, `getExerciseCatalog`, `getExerciseRecords`, `listMesocycles`, `getMesocycleReport`, `getMesocycleVolumeArc`, `generateMesoPlan`, `createMesoTemplate`, `startMesoTemplate`, `listMesoTemplates`, `getGymSchedule`, `getTodayReadiness`, `chooseTodayReadiness`, `listSportSessions`, `logSportSession`, `getSportSchedule`. **No contract change and no Liquibase** — the training API already existed for the web app.

`TrainClient` (`BoopCore/Train/`) wraps them behind plain value types (`TrainModels.swift`), with two rules the room's honesty rests on: **an absent server value stays `nil`, never `0`** (with the hypertrophy engine off the server sends only warmup/working *counts*, so the set rows carry no weight rather than printing the plan's anchor weight as a per-set target), and **wire enums read leniently**, so a value the server adds later degrades instead of emptying the room. `blockPlan()` returns an optional — no running block is a state the Blokk tab shows, not an error — and merges two reads (the block's MEV/MAV/MRV landmarks and days, plus the volume arc's per-week planned/actual sets).

**The write side is the outbox's** (`TrainClient: OutboxSender`, eight appended `OutboxKind` cases: `workoutStart`, `workoutSet`, `workoutSetEdit`, `workoutSkipExercise`, `workoutFeedback`, `workoutNote`, `workoutFinish`, `sportSession`; `RitmusClient.send` routes them). Two things make it safe with no `clientRef` on `/api/train/*`:

- **The server's start is idempotent on the template day** — `POST /api/train/workouts` answers *201 with the open instance* when one exists, so a replayed start never creates a second workout. The two 409s (`TRAIN_WORKOUT_OPEN_ELSEWHERE`, `TRAIN_DAY_DONE_THIS_WEEK`) are refusals with a meaning, not retries: the item fails with the server's own code and the room says what happened.
- **A queued write names a local `workoutRef`, never a server id**, because the workout may not exist yet when a set is logged without signal. `OutboxItem.groupRef` (appended, optional) carries it and is the item's **order group** — one workout is one chain, and a second session is a separate group, so one stuck session never holds another back. This is the first group keyed by something other than the date. The id is resolved at send time (what the run learned → today's open workout → today's completed workout) and **no queued payload is ever rewritten**.

### Block builder + weekly review — the hand-decoded calls (`mezo-r36n9.83`, 2026-11-19)

The builder and the review **do not use the generated client**. The generated code decodes every enum strictly, and the
technique planner (T3) adds proposal line kinds (`technique`, `rep_range`), reason codes and evaluation fields while these
screens are live — one unknown value would fail the whole response. So `RawJSONClient` (`BoopCore/Train/PlanTransport.swift`)
sends JSON over the **same** `ClientTransport`, base URL and bearer token as the generated client (`Session.raw`), and
`PlanWire.swift` declares hand-written `Decodable` shapes whose enums are plain `String`s. `PlanClient` wraps 8 operations:
`listMesocycles`, `getExerciseCatalog`, `evaluateMesoPlan`, `listWeekProposals`, `decideWeekProposal`, `replaceDayExercises`,
`updateMesocycleMusclePriorities`, and the new **`updateMesocycleSettings`** (`PUT /api/train/mesocycles/{id}/settings`
`{trainingStyle?, techniquesEnabled?, weeklyReviewMode?}`, absent = keep; the run's own review mode overrides
`mezo.volume.weekly-review.mode`; `MesocycleResponse.weeklyReviewMode` is the effective mode — `docs/features/train.md` §4).
**The BoopAPI generator filter is untouched.** Typed failures: `PlanFetchError` (`offline`, `unauthorized`, `notFound`,
`rejected(code)` for 400, `conflict(code)` for 409, `server`).

`ServerCache` (`BoopCore/ServerCache.swift`, `mezo-vxjj9`) is the read side's last-known-good cache: one JSON file per endpoint-and-day wrapping the payload and the instant it was fetched, so a screen can say how old what it shows is. It is read-only toward the server — no sender, no retry, no link to the outbox — and past `maxAge` a hit is not a hit (`get` returns nil and the caller says „nincs friss adat"). A corrupt entry is removed and reads as absent, unlike the outbox, which sets bad elements *aside* because those are the owner's unsent words. Its folder is `cache`, a third per-user folder beside `ledger` and `outbox`.

### Formulas (S3 — product calls; the code is the truth: `BoopScores`, `EnergyCurveModel`)

All scores are integers 0–100 (`clamp(round(x))`), computed from the assembled `BoopDay` and the owner-local "now".

- **alvás** = `round(100 × (0.7 × min(1, totalMin / targetMin) + 0.3 × clamp01((quality − 1) / 9)))`; with no quality, `min(1, totalMin / targetMin)` alone.
  Mirrors the sleep dimension of `DayEvaluationEngine` (private there, so duplicated). `null` without a night or with a non-positive target.
- **pulzus** = `clamp(round(70 + (baselineRestingHr − restingHr) × 6))`; `baselineRestingHr` = average resting HR of the 14 days before the date;
  display = today's bpm. `null` if either is missing.
- **mozgás** = `clamp(round(steps × 100 / stepsGoal))`; **steps null → mozgás null** (never a fake 0); non-positive goal → null.
- **fuel** = `clamp(round(kcalSoFar / (kcalTarget × share) × 100))` with `share = min(1, minutesSince07:00 / 840)` (linear 07:00 → 21:00). **null while
  `share < 0.05`** (before about 07:42, otherwise any breakfast reads 100 %), when `now` is not after 07:00, or the kcal target is not positive.
- **forma** = `round(0.45 × alvás + 0.35 × p + 0.20 × load)` with `load = 100 − min(60, yesterdayWorkoutMinutes / 2)` (unrounded) and `p` = pulzus,
  **neutral 70 when resting HR is missing** (a missing watch reading must not blank the hero); only the final forma is rounded.
  `null` when `nightsKnown < 14` (60-day window) or alvás is null.
- **state** (the **forma thresholds**): `≥ 70` good · `50–69` okay · `< 50` tired · forma null → learning (still orb, "még tanulom", no rise).
- **Energy curve** — 19 hourly points, index 0 = 06:00 … 18 = 24:00. Template by linear interpolation between anchors
  (06: 0.35, 10: 0.82, 11: 0.82, 14: 0.38, 15: 0.38, 17: 0.66, 18: 0.66, 24: 0.20), × `scale = 0.6 + 0.4 × forma / 100` (0.8 when forma is null).
  Then: first logged meal between 11:00 and 15:00 later than 13:30 → −0.05 at 14:00 and 15:00; a session at hour *h* → +0.06 at *h*, −0.08 at *h*+1 and *h*+2.
  A model, not a measurement. The mapper clamps each value to 0..1 (3 decimals); `dipHour` = the lowest point between 12:00 and 18:00 inclusive.
- **Session conflict** (rule only, `RuleVerdicts.conflict`): the latest-ending timed meeting that started before the session; if it ends less than 45 min
  before the session start (or is still running) → suggest meeting end + 60 min rounded up to :00/:30; past 24:00, all-day or overnight → no conflict.

S1 operations used: `login`, `register`, `me`, `completeOnboarding`,
`getBiometricProfile` (always 200; all-null fields = no profile), `upsertBiometricProfile`,
`listWeightLogs`, `logWeight` (201), `getWeightTrend`. JWT lasts 30 days, no refresh: a 401 signs out.

## 5. Integrations

Production API `https://46.225.112.172.sslip.io/api`. Plans (training, meals, calorie target, weight
goal) are set up in the web app with the Boop account (spec §8.1).

## 6. How to use it (consume)

Build/test commands and launch arguments: [`ios/README.md`](../../ios/README.md). Weekly install on the
owner's phone: `ios/scripts/install-on-phone.sh` (team id from `$BOOP_TEAM` or `~/.config/boop/team`;
exit 2 no team, 3 no phone, 4 build, 5 install). Until the paid Apple team is active (~2026-11-25) it signs with the **free
Personal Team** (weekly reinstall, `Boop.entitlements`: HealthKit + background-delivery, no push). When the paid team is active, `touch ~/.config/boop/paid`: the script then builds with
`CODE_SIGN_ENTITLEMENTS=Boop-Paid.entitlements` (adds `aps-environment`; the free team refuses the Push capability). Moving to the paid team is `mezo-r36n9.19` (label `paid-team`): subscribe, re-register the bundle id once, then verify background delivery, APNs and HealthKit deletions on the device.

## 7. How to extend it

New API call: add the operationId to the generator config, run `sync-openapi.sh`, wrap it in a
`BoopCore` model with a stub-transport test (`StubTransport` in `BoopCoreTests`). New screen: reuse
`LagyTabPage` / `LagyFlowFrame` and the kit; copy look and copy from the spike's `Lagy*.swift`.

## 8. Testing

- S2.5 kit tests: `NapkelteTokensTests`, `NapkelteRenderTests` (landscape per hue, glass, pills and tabs at
  accessibility sizes, frames, nav labels), `NapkelteOrbTests` (palette padding, rise clamp, learning state,
  reduced motion), `NapkelteChartTests`, `NapkeltePathTests`; core `NapEmptyStateTests`; app `ShellTests`,
  `AuthCopyTests`, `NapCopyTests`.

- `BoopKit-Package` (simulator): generated-client decoding, session states (no token, 401, offline,
  sign-in), error mapping + copy, onboarding order/resume/local day, design kit (fonts, glyph catalog,
  photos, tokens, `hu1`).
- `Boop` app tests: `AuthForm` rules, greeting by time of day, connect copy (`summaryLine`, `countsChip`).
- S2 kit tests: `HealthBuildersTests` (nights across midnight, naps, two sources, hypnogram, workouts, days),
  `CalendarSnapshotTests`, `HealthSyncTests` (60-day first window, 2-day overlap, batching + progress,
  interrupted backfill, idempotent re-send, calendar denied/granted, 401 stops).
- **B1:** backend `HealthSchemaIT`, `HealthSampleServiceIT`, `SleepLogDedupMigrationIT`, `SleepNightMergeTest`, `WorkoutReconcilerTest`, `ApnsDeviceContractIT`, `BoopB1MergeScriptIT`; BoopKit `HealthSyncTests` (anchors, deletions), `HealthBackgroundTests`, `PushRegistrarTests`, `HealthBuildersTests`.
- Backend: `WearableSleepServiceIT`, `WearableServiceIT`, `WearableContractIT` (+ existing sleep ITs).
- **S3 backend** (`-Dmezo.test.use-testcontainers=true`, brief ITs need `@ActiveProfiles("companion-fake")`):
  `BoopRepositoriesIT`, `BoopDayAssemblerIT` (owner scoping, 00:30 local picks the new day under a UTC server), `BoopScoresTest` + `EnergyCurveModelTest`
  (plain unit, value-pinning), `BoopVerdictWriterIT` (valid JSON used, junk falls back, learning headline), `BoopBriefServiceIT`, `BoopBriefConcurrencyIT`,
  `BoopContractIT`, `SessionTimeIT`, plus `ArchitectureTest`. Run e.g.
  `./mvnw test -Dtest='Boop*,SessionTimeIT,EnergyCurveModelTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true`; the full suite
  (7314 green before the last fix rounds) with `./mvnw clean test -Dmezo.test.use-testcontainers=true`.
- **S3 BoopKit** (`BoopKit-Package`): `MorningClientTests` (local date on the wire, gregorian dates on any device calendar, 409 → limit, move/undo,
  unauthorized sign-out, future-date fallback, load guard), `PathBuilderTests` (ordered id/title/time sequences per orb, after-midnight, 24:00),
  `PathFixtures`, `LensTests`, `BoopVoiceTests`; kit `NapkelteChartTests` (week bars with missing days).
- **S3 app** (`Boop` scheme): `MaiCopyTests`, `MaiBelowTests` (tile mapper, swipe mapping, -ra/-re suffix), `SheetsTests` (routing, magnifier index, weeks),
  `MaiModeTests` (evening, kímélő, sky choice, reminder target), `BedtimeReminderTests` (trigger = target − 30 min, crosses midnight).
  Last recorded counts: app 73, BoopKit 106 + 48. Commands: [`ios/README.md`](../../ios/README.md).
- **B3 BoopKit** (`BoopKit-Package`): `OutboxTests` (persistence, order, backoff vs order groups, attempt cap, offline not counted, refusal and *Újra*, relaunch), `RitmusClientTests` (status mapping per kind, idempotent resend, the 401/409/timeout rulings, voice upload), `DayLedgerTests`, `SnapshotBuilderTests`, `VoiceJournalTests`, `ChatStoreTests`, `CheckInQuestionsTests`, `CheckInSlotTests`, `GoalSuggestionsTests`, `NaploDaysTests`, `DayPlanGoalsTests`; kit `EnergyCurveGeometryTests`.
- **B3 app** (`Boop` scheme): `CheckinFlowTests`, `EsteFlowTests`, `MaRitmusTests`, `RitmusRemindersTests` (rolling horizon, done moments left out, tap routing), `RitmusSyncTests` (end-to-end sync order, refused rows, re-close, relink, sign-out), `BoopChatTests`; DEBUG flags in `ios/README.md` for simulator review of every route.
- **B3 backend** (`-Dmezo.test.use-testcontainers=true`): `DayCloseServiceIT`, `DayCloseApiIT`, `CheckInBoopIT`, `WearableCheckInBiomarkerSourceIT`, `IntentionFocusClientRefIT`, `JournalClientRefIT`, `BoopDayContextIT`, `BoopChannelChatIT`, `BoopSessionDoneIT`, `BoopPromptsTest`, `BiometricsContractIT`, `ArchitectureTest`.
- **B4 backend** (`-Dmezo.test.use-testcontainers=true`): `SensitivityServiceTest`, `RecipeAllergenRollupTest`, `OffClientTest`, `PantryImportBarcodeIT`, `PantryCatalogServiceIT` (barcode race), `MealCoachPolicyTest` / `MealCoachPromptTest`, the day-plan units (`WindowPlacerTest`, `BudgetSplitterTest`, `SuggestionPickerTest`, `UsualMealRankerTest`, values copied from the web planner's own pinned cases) + `FuelPlanIT`, `UsualMealsIT`, `ImageStoreTest` + `MealPhotoIT`, `RecipeImportIT` (+ SSRF / switch-off / LLM-unavailable variants) + `RecipeJsonLdParserTest`, `RecipeImageIT`, `ClientRefIdempotencyIT` (a real two-thread race), `PurgeRestartScriptIT`, `ArchitectureTest`. The full suite was 7575 tests.
- **B4 BoopKit / app** (`BoopKit-Package`, `Boop` scheme; run on a simulator): `FoodClientTests`, `FoodRecipeClientTests`, `SensitivityRulesTests`, `FoodOutboxTests` (offline capture keeps its own date after midnight, photo beside the queue, confirmation card not a saved meal, 7-day failed with values kept), app `EtelMaTests`, `EtelStoreTests`, `MealComposerTests`, `DraftNoticeTests`, `ServingConfirmTests`, `RecipeImportReviewTests`, `EtelKamraTests`, `EtelHetTests`, the settings/skip/supplement tests and `MaFoodRowsTests`. Last recorded: app 359, BoopKit 385 + 67. Two B3 tests (`MorningClientTests.olderLoadNeverOverwritesNewer`, `VoiceJournalTests.slowOnDeviceRecognitionTimesOutToTheUpload`) flake under machine load and pass idle. `swift test` on macOS fails (CMMotionManager) — use `xcodebuild` on the package scheme.
- Not in CI (`ci.yml` does not build `ios/`); run locally.

## 9. Decisions, gotchas & deferred

- **Contract copy re-synced after the web-only areas left (2026-11-19, `mezo-r36n9.97.4`).** `openapi.yaml` lost the tutorial, telemetry and admin hub operations (none in the filter); `node scripts/check-ios-contract.mjs` (in the cheap gates) proves all 121 filter operations are still in `api/openapi.yml`.
- **Contract copy re-synced after the XP world left (2026-11-19, `mezo-r36n9.97.5`).** `openapi.yaml` lost the gamification, quest, progression and activity operations (none in the filter) and their schemas; the optional `levelUp`/`medals` on `WorkoutInstanceResponse` stay (the app never reads them, and the server no longer fills `levelUp`). `check-ios-contract.mjs` still finds all 121 filter operations.
- **Contract copy re-synced after browser web push left (2026-11-19, `mezo-r36n9.97.7`).** `openapi.yaml` lost the web push subscription/test/pref/schedule operations and schemas (none in the filter); `registerApnsDevice`/`unregisterApnsDevice` and the server's `apns_device` registration are unchanged (`DeviceRegistrationStillWorksIT`). `check-ios-contract.mjs` still finds all 121 filter operations.
- **Web-app links removed (2026-11-19, `mezo-r36n9.97.2`, decision #52).** `BoopConfig.webAppURL` is gone: the Terv and Nap "a webes appban" cards and the account sheet's "Webes app" row no longer exist, with no replacement card. Web-only settings are changed by a session on the owner's request until a later slice adds screens. Terv with no weight and no session shows an `NKNotLiveYet` card ("A terveid ide költöznek", 2026-11-19).

- **Block builder traps (2026-11-19, `mezo-r36n9.83`).** (1) An overload trap cost a 51 GB runaway test: inside
  `RawJSONClient`, a generic `send<B: Encodable, T: Decodable>(…, body: B)` calling a raw `send(…, body: Data)` resolved to
  **itself** (`Data` is `Encodable` and `Decodable`) and recursed, re-encoding an ever-growing body. The raw one is now
  `sendRaw`. Run kit/app tests with `-test-timeouts-enabled YES -maximum-test-execution-time-allowance 60`. (2) The app has
  its own `ReviewLine` type; the deck spells `BoopCore.ReviewLine`. (3) The evaluator's `dayIndex`/`exerciseIndex` index the
  **request's** order — the draft sends days and exercises in block order, so proposals apply by index; never sort the
  draft. (4) `replaceDayExercises` keeps exercise ids when the list is the same exercises in the same order (updated in place, so a pending manual proposal's lines survive a builder save) and re-mints them otherwise: always re-read the block after a save before the next edit. (8) Technique + challenge together and the recommendation (`mezo-r36n9.98`, decisions #54/#55): `setTechnique`/`setChallenge` no longer clear each other (pill „Pihenős drop + kihívás”); the picker opens with a *Boop ajánlása* card from `MesoPlanEvaluation.recommendations` (server `TechniqueRecommender` = the planner's `defaultTechnique`; reason codes `stable_machine`, `isolation_pump`, `lengthened_safe`, `all_out`, `no_safe_technique` → `techniqueReasonText`; only for a block with a style and techniques on) plus the weekly AI's `note` for that exercise (`BlockBuilderModel.aiNotes`, from this week's proposal lines). (7) Technique picker (`mezo-r36n9.94`, 2026-11-19): on Napok each judged exercise has **one** pill (+ technika vagy kihívás / the technique / Kihívás a végén) so the row never changes height; tapping it opens `TechniquePicker` (sheet at page level, full height): the five techniques (unavailable ones dimmed with `DraftExercise.unavailableReason`), the day's challenge as its own row (`setChallenge`, one a day, replaces the technique), an *i* button revealing `SetTechnique.about` under each; a planner/AI pick (`techniqueSource` planner/ai, untouched) wears a **Boop** tag (`pickedByBoop`). The review tile shows T4's `WeekProposalLine.note`. DEBUG `-previewBlokkPicker N`, `-previewBlokkPickerInfo YES`. (6) Owner round after the first install (2026-11-19): the muscle card shows the band and the days as pills plus an always-visible *Miért ez a sáv* box (tier + numbers, sport note); the room **preloads** the builder (block, catalog, first evaluation) so it opens without a spinner, and a mid-preload open joins the in-flight load; the builder and the deck **zoom out of the tapped button / card** (`matchedTransitionSource` + `.navigationTransition(.zoom)`, `PlanZoom`) instead of sliding up — a swipe down zooms back. (5) Review fixes (2026-11-19): Save always wins over *Igazítsd a sávba* when there are edits; edits are carried onto a fresh read as deltas when the server changed the value too; a partial save failure keeps the unsaved edits; proposals apply only against a fresh evaluation.
- **Dates with fractional seconds (2026-11-11, `mezo-r36n9.25`).** Java `Instant`s reach the app with microseconds (the brief's `generatedAt`). The generated client is built with `FlexibleISO8601Transcoder` (`BoopCore/APIClient.swift`) that reads both forms; the runtime default rejected fractions and every live brief failed ("akadt el"). Test fixtures must include a fractional stamp (`MorningClientTests.loadReadsFractionalSecondTimestamps`).
- **Napkelte traps (S2.5):** the orb shader needs exactly four colours (`orbPalette` pads — three crashed it);
  a `LivingOrb` inside a tap target swallows the tap (`allowsHitTesting(false)` on the orb, tap on the column);
  four Lágy glyphs (check, clock, camera, book) blob when tinted white, so `NKGlyph` draws them as outlines;
  the simulator's network is blocked by the Mac's firewall, so DEBUG `-previewStep profile|weight|hello|connect`
  shows onboarding steps without the server.

- Free Personal Team: 7-day profiles, ≤ 3 sideloaded apps, ≤ 10 App IDs per week — never rename the
  bundle id; the team id is never committed.
- The Debug configuration must carry `SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG` (hand-written
  project); the `-preview onboarding|shell` launch switch is DEBUG-only.
- On the owner's Mac the **LuLu** firewall blocks network calls from the ad-hoc-signed simulator app
  (Safari in the simulator and host processes are fine); allow "Boop" in LuLu to test live calls.
- `confirmationDialog` attached inside scroll content did not present — attach it at page level.
- Presentations: attach sheets/covers/dialogs at page level and let the page read the flag in its body
  (`NapEmptyView` + `connectCover`); reading `scenePhase` on `RootView` itself stopped every presentation,
  so the foreground/calendar triggers live in the invisible `SyncTriggers` view (S2).
- HealthKit: the simulator has no Health data, so the walk-through ends on the no-data card; the
  `-preview` switch uses a DEBUG-only `PreviewTransport` that answers the Wearable endpoints locally.

- **S3 rulings** (ledger `.superpowers/sdd/2026-11-10-boop-s3-reggel/progress.md`):
  - P1: `day.hrToday {min, avg, max}` added to the contract and assembler — the pulse sheet shows daily min/avg/max (spec §9.3).
  - P2: `day.observations` are the patterns awaiting the owner's decision (what `decidePattern` accepts); swipe right = confirm, left = reject.
  - Error code is `BOOP_REGENERATE_LIMIT_REACHED` (UPPER_SNAKE like the other message codes), not `boop.brief.regenLimit`.
  - Hypnogram stage order 0 awake, 1 REM, 2 light, 3 deep, matching the shipped kit colours.
  - `busySlots` = 72 slots, 06:00–24:00, 15 min each; session minutes/time/plannedTime and sleep stage minutes are nullable (real data has nulls).
  - Observations = proposed patterns, newest 3; lead = title, bold/tail empty; strength from belief → confidence → |r| scaled 0..5.
  - Missing resting HR → forma uses a neutral pulzus 70; sleep score mirrors `DayEvaluationEngine` (no companion refactor), duration only without quality.
  - Conflict "last meeting" = latest-ending timed event that started before the session; a meeting running at the start counts; past 24:00 → none.
  - "≤ 2 sentences per metric" is a prompt instruction, not truncation (cutting Hungarian mid-thought reads worse).
  - Input hash uses night content + weight values (no updated/log id on `BoopDay`); steps, HR and the exact clock excluded — the movement score in a cached brief
    lags until a hashed input changes, the time-of-day bucket turns, or the owner regenerates. The intention is hashed by content (creed + foci), not an id.
  - `BoopCore` cannot import `BoopDesign`: `MetricKey` (string enum) is bridged to `Hue` in the app; `PathBuilder`/`Lens` take `MetricKey` and return BoopCore value types
    (`PathStep`, `LensAction` with a glyph name), mapped to `PathStation` in the app.
  - `Lens.action` is nil when Forma's current check-in is done (app shows "Boop elmondja"); weigh-in is not a station; the session is never marked done
    (the brief has no done flag); recovery adds walk / water / early bed.
  - Audio follows the approved spike (`.playback` + `.spokenAudio` + `.duckOthers`, deactivated with `.notifyOthersOnDeactivation`), not `.ambient`; there is an in-app mute.
  - With a brief loaded Mai stays through sync states; long-press menus use `Menu(primaryAction:)` (`contextMenu` does not open on glass).
  - Tiles without v1 data were adapted: Elalvás = bedtime, Feszültség → Pulzus ma min·átl·max, Víz "–" + hamarosan, kcal bar vs 500, glyphs instead of photos.
  - Pulzus breath targets the next upcoming densest block (an in-progress one loses).
  - A napom = strict chronological full day, meetings as one station (spec §5.2); curve anchors added per spec §10.3.
  - Evening (dusk = Pulzus sky) and kímélő (calm sky) keep one sky for the whole Nap page; orb taps re-colour orbs and lights only.
  - The bedtime reminder repeats nightly at target − 30 and follows a changed target.
  - Implementers run strictly sequentially on one branch (parallel commits mixed files in Task 8/9).
  - Owner OK 2026-11-10 on the domain-switch transition ("Jó, mehet tovább").
- **S3 traps:**
  - Brief ITs need `@ActiveProfiles("companion-fake")` so the LLM is the canned `FakeCompanionLlm` (marker `BOOP_BRIEF_V1`).
  - A future date is a **400**; a phone whose day is ahead of the owner zone falls back to yesterday (`MorningStore`).
  - `NKBackdropPanorama` conforms with `@preconcurrency Animatable` (a plain `Animatable` conformance clashes with the main-actor `View` under strict concurrency); keep the attribute when touching it.
  - DEBUG preview flags (simulator network is blocked): `-preview shell`, `-previewOrb`, `-previewTab ma|terv|naplo|boop` (B2), `-previewSheet sleep|heart|day`, `-previewDetent large`,
    `-previewScrub 15.5`, `-previewEvening` (clock 21:10), `-previewRecovery`, `-previewKept`, `-previewScroll`, `-previewSwitch`; `PreviewTransport` answers every Boop op coherently
    (moved session remembered, judged observations remembered).
  - `PathBuilder` lives in `BoopCore` and speaks `MetricKey`, never `Hue`.
  - A SwiftUI `DragGesture` on the observation card swallowed vertical page scrolls — the stack uses a `UIGestureRecognizerRepresentable` horizontal pan.
  - Reading and writing the observable `brief` in one statement is a Swift "Fatal access conflict" — use locals.
  - Native upsert of the session override relies on column defaults (`id`, `created_at`, `is_deleted`); a `PUT` with no body at all is a 500 from the platform handler (not Boop-specific).
  - Soft delete: derived finders on `daily_metric`/`wearable_workout`/`calendar_event` ignore `is_deleted` (parked minor, S2 tables).
- **B1 known limits / traps:**
  - Free team: no push (the entitlement is only in `Boop-Paid.entitlements`; putting `aps-environment` in `Boop.entitlements` breaks free-team signing). Background delivery is coded but unverified on a device.
  - An **empty sleep window** (the user deleted every night in the 60 days) cannot be sent (contract `minItems 1`), so that deletion is lost.
  - **HR bucket deletions are not propagated** (a deleted Health HR sample leaves its 5-minute bucket).
  - A **user-deleted night blocks its external id** permanently (a revived Health night with the same id stays deleted).
  - A cross-midnight logged session vs a Health workout dated on the other day can **double count** in the day load.
  - APNs environment is hard-coded to sandbox (a TestFlight/production build needs it switched); the register call goes out twice per launch; a keychain write failure mints a new device id.
  - `daily_metric` upsert overwrites every column, so the phone must send the full day; a Sleep Cycle rewrite re-builds the 60-day window (budget).
  - Deleting a Health weight does not recompute the goal; body-mass bounds are unvalidated (500 not 400).
  - The merge script is a production write — dry run first, owner OK with counts + rollback; never commit the user ids.
- **B3 known limits and deferred (2026-11-12).**
  - **Paid-team gated (`mezo-r36n9.19` family):** the in-place widget and answering a check-in straight from the notification — designed, not built; a notification tap from a cold launch, a sheet-up tap and the cold Health wake (which does not flush; the next foreground does) are only logic-verified, not proven on a device.
  - **`mezo-r36n9.26`** — migrate the evening readers (ritual, intention, check-in consumers) to `day_close` and retire the legacy dual-writes (see [`dayclose.md`](dayclose.md)).
  - **`mezo-r36n9.30`** — flaky `DayCloseApiIT.checkInLineIsCachedAndRejectsAnEmptySlot`: the shared fake model's `lastUserMessage` races an asynchronous prompt.
  - **`mezo-r36n9.31`** — a recorded check-in note still in flight while the owner redoes the same slot reaches the earlier check-in and the redo overwrites it on the server (the phone keeps the note).
  - **Accepted:** the voice target is `checkInNote(CheckInPayload)` (the sender re-upserts the whole check-in); a timeout counts as `retryLater`, not offline, so a slow-but-reachable server never freezes the queue invisibly (a long upload on a weak link may end as an *Újra* row after 8 tries); an unsent chat question identical to the server's last owner turn is not resent; the day context is not cached offline on a fresh launch (chips hidden).
  - **Dates:** the phone's local calendar day is the day; the server accepts today − 7 … today + 1 in the owner zone (a phone east of Budapest dates ahead), a capture moment more than 5 minutes in the future is a 400.
- **Parked minors (bd under `mezo-r36n9`):** payload versioning, `trendUp` on equal values, reload supersedes an in-flight regenerate, swallowed `setActive(false)`, real synthesizer adapter only verified on a device.
- **B4 known limits and deferred (2026-11-13).**
  - **Needs the phone (never driven on hardware):** the live barcode scan, the camera permission prompt, *Fotó* opening the camera (`PhotoCapture.cameraAvailable` is false in the simulator), a UPC-E payload through the server lookup; and the simulator never covered 320 pt width or reduced motion for the room.
  - **Visual polish owed:** a large near-black area under the last card on Ma and Kamra (the kit's `MirroredLand` renders dark), the hero orb reads almost black at low levels (the spike's was lit), tiny dimension-tile labels (9.5 pt).
  - **Ma debt:** the phone-only *taken* state of a supplement lives in `UserDefaults` (a reinstall or second device shows "Bevettem" again — there is no un-take/read-back op beyond the protocol), a failed stash read hides the supplement groups, a failed refresh is invisible, "Most nem" resets on reload, the screen does not re-key its day after midnight on a long-lived screen (a tap between midnight and the next load writes yesterday's key).
  - **Capture limits:** an in-flight draft reviewed online whose *Mentem* fails stays only on screen (retry is idempotent by `clientRef`); a stranded photo cannot be exported and a permanently refused upload loops on *Újra*; the label-photo re-lookup can skip the serving confirmation; a usual's pantry/recipe lines re-resolve at save (the wording says so).
  - **Traps found:** (1) Swift `Optional<LookupSource>`: `x == .none` means *nil*, not the enum case — a test passed vacuously for it, grep before comparing; (2) the old supplement groups used daypart keys the server rejects — the real keys are `wake|breakfast|pre_workout|lunch|post_workout|dinner|evening|bedtime`; (3) a cancelled composer list load must not be reported as a failure.
  - **Follow-ups filed in bd:** persist the scanned barcode on the meal, link an unmatched imported ingredient to a food, `createRecipe` `clientRef`, `recipe.timesLogged` always 0, windows collapse when the bed time is after midnight (the midnight axis is not ported), four pre-existing frontend Fuel tests fail on unmodified main.
- Deferred (B5+): widgets, Beszélgetés and Rutin tabs, the training room (B5); B4 delivered meal capture, the quick food log, the food chips of the "+" sheet and the food settings.

## 10. Key files

`ios/Boop/RootView.swift` · `ios/Boop/Auth/AuthFlow.swift` · `ios/Boop/Onboarding/OnboardingFlow.swift` ·
`ios/Boop/Shell/ShellView.swift` · `ios/BoopKit/Sources/BoopCore/Session.swift` ·
`ios/BoopKit/Sources/BoopCore/OnboardingModel.swift` · `ios/BoopKit/Sources/BoopDesign/Pages.swift` ·
`ios/scripts/install-on-phone.sh` · `ios/scripts/sync-openapi.sh` · S2: `ios/Boop/Connect/*` ·
`ios/BoopKit/Sources/BoopCore/Health/HealthSync.swift` · `…/Health/SleepNightBuilder.swift` ·
`…/Calendar/CalendarSnapshotBuilder.swift` · `backend/…/feature/wearable/service/WearableSleepService.java` ·
`backend/…/feature/wearable/controller/WearableController.java` ·
S3: `api/feature/boop/boop.yml` · `backend/…/feature/boop/service/{BoopDayAssembler,BoopScores,EnergyCurveModel,BoopVerdictWriter,RuleVerdicts,BoopPrompts,BoopBriefService,BoopBriefStore,SessionTimeService}.java` ·
`…/feature/boop/controller/BoopController.java` · `…/feature/boop/config/BoopProperties.java` · `backend/src/main/resources/db/changelog/1.1.0/script/202611101300_mezo-r36n9.7_boop_brief.sql` ·
`ios/BoopKit/Sources/BoopCore/Morning/{Brief,MorningClient,PathBuilder,Lens,BoopVoice}.swift` · `ios/Boop/Nap/{MaiView,MaiTiles,MaiPath,LensActionRow,ObservationStack,SessionMove,MaiMode,BedtimeReminder,DetailSheet,SleepSheet,PulseSheet,DaySheet,ANapomView,NapView}.swift` ·
`ios/Boop/Shell/ShellView.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Frames.swift` (`NKBackdropPanorama`) ·
B2: `ios/Boop/Shell/{ShellView,PlacePage,AccountSheet}.swift` · `ios/Boop/Capture/CaptureSheet.swift` · `ios/Boop/{Terv,Naplo,BoopChat}/*` ·
`ios/Boop/Nap/{MaPhases,MaDrill,ProposalDesk,RoomSwipeBack}.swift` · `ios/BoopKit/Sources/BoopCore/Morning/{DayPhase,DayPlan,Proposals}.swift` ·
`ios/BoopKit/Sources/BoopDesign/Napkelte/{SpineBar,Proposal,Drill}.swift` ·
B1: `ios/BoopKit/Sources/BoopCore/Health/{HealthKitReader,HealthReader,HealthSync,HealthBackground,SleepNightBuilder,WorkoutMapper}.swift` · `…/Push/PushRegistrar.swift` · `ios/Boop/App/{BoopAppDelegate,BackgroundSyncHost}.swift` · `ios/Boop.entitlements` · `ios/Boop-Paid.entitlements` · `backend/…/feature/wearable/service/{HealthSampleService,WearableDeletionService,WorkoutReconciler}.java` · `backend/…/feature/biometrics/sleep/service/SleepNightMerge.java` · `api/feature/device/device.yml` · `scripts/ops/boop-b1-merge-accounts*.sql`

Blokképítő + heti átnézés: `ios/Boop/EdzesTerv/{BlockBuilderPage,WeekReviewDeck,PlanKit,PlanEnvironment,PlanPreview}.swift` · `ios/BoopKit/Sources/BoopCore/Train/{PlanTransport,PlanWire,PlanClient,BlockDraft,WeekReview,BlockBuilderModel}.swift` · `backend/…/feature/train/service/{TrainService#updateSettings,ExerciseStyler#restampRows}`

L0/b (az élő fal): `ios/BoopKit/Sources/BoopCore/Morning/{Wall,WallSources}.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Wall.swift` · `ios/Boop/Nap/{MaWall,MaPhases,MaiView}.swift`

Kezdőlap + L0: `ios/Boop/Kezdolap/{KezdolapView,Area,KitGallery}.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/{Area,AreaBlocks,OrbRing,Fog}.swift` · `ios/BoopKit/Sources/BoopDesign/Resources/Photos.xcassets/p-hegy.imageset`

B4: `ios/Boop/Etel/*` · `ios/BoopKit/Sources/BoopCore/Etel/{FoodClient,FoodModels,MealDraft,FoodOutbox,SensitivityRules}.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Etel.swift` · `api/feature/meal/{fuel-plan,meal-photo}.yml` · `api/feature/sensitivity/sensitivity.yml` · `api/feature/recipe/{recipe-import,recipe-image}.yml` · `backend/…/feature/{nutrition/service/dayplan,meal/service/dayplan,nutrition/service/SensitivityService.java,common/image}` · `…/db/changelog/1.1.0/script/20261113*_mezo-r36n9.14_*.sql`

B3: `ios/BoopKit/Sources/BoopCore/Ritmus/{Outbox,DayLedger,RitmusClient,RitmusPayloads,SnapshotBuilder,VoiceJournal,ChatStore,CheckInQuestions,CheckInSlot,GoalSuggestions,NaploDays}.swift` · `ios/Boop/Ritmus/{RitmusEnvironment,RitmusRouter,RitmusReminders,RitmusPreview,CheckinFlow,CheckinView,CheckinDone,EsteFlow,EsteView,ClosedDayCard,RefusedRow}.swift` · `ios/Boop/Nap/MaRitmus.swift` · `ios/Boop/Naplo/NaploView.swift` · `ios/Boop/BoopChat/BoopTabView.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Ritmus.swift` · `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` · backend `feature/dayclose/**` · `feature/biometrics/checkin/service/{CheckInService,CheckInBiomarkerSource}.java` · `feature/wearable/service/WearableCheckInBiomarkerSource.java` · `feature/companion/service/BoopDayContext.java` · `feature/companion/controller/CompanionDayContextController.java` · `feature/companion/tools/DayTools.java` · `api/feature/dayclose/dayclose.yml` · migrations `202611121100…1130_mezo-r36n9.13_*.sql`.
