# Nap → Mai — Titanium slice-1 coverage record

Date: 2026-09-10. Scope: the `/nap` landing page only (owner decision, slice A).
Register source: [TITANIUM_FEATURE_COVERAGE_REGISTER.md](TITANIUM_FEATURE_COVERAGE_REGISTER.md).
Design spec: [2026-09-10-nap-mai-titanium-design.md](../superpowers/specs/2026-09-10-nap-mai-titanium-design.md).
Evidence base: `frontend/src/features/today/pages/NapHubPage.tsx` (read in full 2026-09-10),
`frontend/src/app/router.tsx:198-209`, investigator terrain report 2026-09-10.

**FROZEN — prototype approved by the owner 2026-09-10 (prototype commit 2e4cebf20; driving issue mezo-mhum). All rows decided by the owner on 2026-09-10** (brainstorm Q&A, one row at a time; the
"KEEP bundle" rows were confirmed as one explicitly enumerated batch). No `UNKNOWN` remains.

## A. Hero layer (daypart-adaptive top of page)

| # | Capability | Evidence | Current behavior | Freq/value | Destination | Decision | Preservation test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Daypart resolution (reggel/nap/este) incl. `?dp=` override shared with shell header | `useDayFace`, `useMinuteTick`, NapHubPage.tsx:72 | One hook, one clock decides which panel renders; header switch overrides | Automatic, constant | Titanium hero layer: greeting + next-step adapt by the same single-sourced daypart | KEEP | `NapHubPage.test.tsx` — "A1: a napszak a köszönést váltja — a hat csempe sorrendje reggel és este UGYANAZ" |
| A2 | Morning hero: last-night sleep duration + quality | NapHubPage.tsx:296-308, `useSleep().lastNight` (duration = HOURS) | `7:30` + `minőség 8/10`, `—` when no data | Daily | Sleep tile (one of the six) | MOVE | `NapHubPage.test.tsx` — "A2/B6: az alvás-csempe a tegnap éjszakát mondja (7:30 · minőség)"; "A2/B6: alvásadat nélkül nagy „—" áll ott, sosem kitalált nulla" |
| A3 | Morning hero sub-line: latest weight + trend arrow | NapHubPage.tsx:312-322, `useWeight` | `Súly 84,2 kg ↘`; arrow only with a previous weigh-in | Daily glance | Companion morning context line | MOVE | `NapHubPage.test.tsx` — "A3: reggel a súly-chip a trend-nyíllal jön — EGYETLEN mérésnél nyíl nélkül"; "A3: két AZONOS mérés között sincs nyíl — a trend csak akkor hír, ha tényleg változott" |
| A4 | Morning hero sub-line: first intention focus | NapHubPage.tsx:323, `useIntentionDay` | `Fókusz <text>` | Daily | Companion greeting (with C3) | MERGE | `NapHubPage.test.tsx` — "A4: reggel az első fókusz ott áll a társ blokkjában" |
| A5 | Day hero: kcal-left + protein + meal-slot day bar with `now` marker | NapHubPage.tsx:345-359, `useFuelDay`, `useFuelPreview` | Big kcal-left count-up, protein n/m, segment bar fills on entrance | Daily, core | Intake tile (one of the six) carries kcal-left + protein + window state | MERGE | `NapHubPage.test.tsx` — "A5/B4: az étkezés-csempe a keret maradékát és a fehérjét viszi" |
| A6 | Evening hero: minutes to lights-out + bedtime + "Zárjuk le a napot" CTA → `/ritual` | NapHubPage.tsx:412-426, `minsToBed`, `useSleepGoal` | Countdown + primary CTA to napzárás | Daily, evening | Evening next-step: companion suggests napzárás; CTA stays primary in evening | KEEP | `NapHubPage.test.tsx` — "A6: este a következő lépés maga a napzárás — egy koppintás a /ritual"; `nextStep.test.ts` — "este mindig a napzárás, lezárás után lecsendesül" |
| A7 | Evening day stat strip: kcal (within/over frame) · workout+sets · XP | NapHubPage.tsx:444-452, `useGamificationDay` | Three stat cells close the evening panel; `—` when no source | Daily, evening | Evening-only calm strip under the tiles | KEEP | `NapHubPage.test.tsx` — "A7: az este a nap három statisztikájával zár (kcal · edzés · XP)"; "A7: edzésterv nélkül a strip cellája őszinte „—", nem kitalált nulla"; "A7: futó gamifikációs lekérés alatt az XP cella „—", nem egy kitalált +0"; "A7: feloldott lekérésnél az XP cella a nap tényleges termését mondja" |

## B. The six approved tiles

| # | Capability | Evidence | Current behavior | Freq/value | Destination | Decision | Preservation test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Water tile: one-tap +2,5 dl, value/goal, fill bar | NapHubPage.tsx:382-400, `useWaterActions(date)` | Tap logs 250 ml immediately; bar fills | Several times daily | Hydration tile; one-tap `+` stays, undo of the last own entry added (owner decision) | KEEP | `NapHubPage.test.tsx` — "B1: a víz „+" gombja 2,5 dl-t logol, és megjelenik a visszavonás — a visszavonás vissza is állítja"; "B1: a víz-csempe egésze a részletekbe visz (billentyűvel is)" |
| B2 | Routine tile: next habit w/ chain-aware pick, own clay icon, n/m, in-place tick (ADR 0010: only `check`-kind), reward toast + celebration + milestone, "Most jön" chain prompt | NapHubPage.tsx:164-237, `habitAction`, `chainPrompt`, `habitCelebration`, `buildHabitRewardToast` | Morning/evening tile shows next pending habit; honest tick only where the action IS a check; derived rows open Rutin page | Daily, high | Routine tile (one of the six) with full chain/tick logic | KEEP | `NapHubPage.test.tsx` — "B2: a csempe pipája UGYANAZT a jutalom-payloadot küldi, mint a Rutin oldal"; "B2: pipa után a csempe a horgonyra kötött szemre vált („Most jön"), nem a sorrendire"; "B2: DERIVED szokás soha nem kap pipa-gombot (ADR 0010)" |
| B3 | Gym tile: workout type + done state | NapHubPage.tsx:367-369 + evening strip, `useToday()` (`workoutDone`, `workoutDoneSets`) | Day panel: tile when workoutType set → `/train` | Daily on training days | Gym completion tile (one of the six) | KEEP | `NapHubPage.test.tsx` — "B3: edzésterv nélkül is ott a csempe, őszintén üresen" (evening done/sets state covered by the A7 strip tests above) |
| B4 | Intake: meal "now" window tile (`Logold ›`) → `/fuel` | NapHubPage.tsx:361-365 | Extra tile appears only during a meal window | Daily, meal times | Intake tile "now" highlight + deep link to logging | MERGE | `NapHubPage.test.tsx` — "A5/B4: az étkezés-csempe a keret maradékát és a fehérjét viszi"; "B4: nyitott étkezési ablakban a csempe „most"-ot jelez és a logolóba visz" |
| B5 | Journal tile (new in Titanium; no journal presence on today's Nap landing) | prototype nap.html#nap/0; `useJournalNotes(from,to)` | — (new) | Daily | Journal tile (one of the six) | KEEP | `NapHubPage.test.tsx` — "B5: a napló-csempe a mai bejegyzések számát mutatja"; "B5: futó lekérés alatt „—" áll a napló-csempén, nem egy kitalált nulla" |
| B6 | Sleep tile (new as tile; data from A2) | prototype; `useSleep` | — (hero today) | Daily | Sleep tile (one of the six) | KEEP | see A2 — `NapHubPage.test.tsx` "A2/B6: …" pair |

## C. Current tiles without a slot in the approved six

| # | Capability | Evidence | Current behavior | Freq/value | Destination | Decision | Preservation test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Küldetések tile: one dot per quest + XP pot → `/nap/kuldetesek` | NapHubPage.tsx:134-149, `useDailyQuests(date)` | On every panel; visual dots, no failure state (ADR 0010) | Daily, gamification | Off the landing; `/nap/kuldetesek` route + notification deep links keep working; final Titanium home decided in a later slice (bd follow-up filed, mezo-51ev) | DEFER | `NapHubPage.test.tsx` — "C1: a küldetés-felület lekerült a nyitóoldalról (a route maga él tovább)"; `NapKuldetesekPage.test.tsx` — "/nap/kuldetesek still resolves and renders the page, while the hub carries no quest entry (manifest C1)" |
| C2 | Check-in tile: 4 slot dots → `/nap/checkin` | NapHubPage.tsx:151-159, `useCheckins` | On every panel | Daily ×4 | Quick picker entry (≤2 taps) + companion next-step prompts when a slot is stale ("Hogy vagy most?") | MOVE | `NapHubPage.test.tsx` — "C2: a check-in csempe eltűnt — a felület a gyors-felvevőé és a létráé"; `nextStep.test.ts` — "napközbeni létra: check-in → víz → edzés → cél → napló", "a check-in megelőzi a vizet (egy dolog egyszerre)" |
| C3 | Kreed tile: creed text + n fókusz, opens IntentionSheet (add focus) | NapHubPage.tsx:331-340,457, `useIntentionActions` | Morning panel; sheet owned by hub | Daily, morning | Companion greeting carries the creed/intention; one tap opens view/add-focus | MERGE | `NapHubPage.test.tsx` — "C3: a kreed a társ blokkjában áll, és koppintásra nyílik a fókusz-sheet" |
| C4 | Életjel tile: needs ring gradient → `/nap/eletjel` | NapHubPage.tsx:371-379, `useNeeds(tick)`, `needRingGradient` | Day panel; FE-computed rings | Daily glance | Needs colors tint/illuminate the companion form itself (companion as live gauge); tap opens `/nap/eletjel` | MERGE | `NapHubPage.test.tsx` — "C4: a társ maga az Életjelek ajtaja"; `TitanCompanion.test.tsx` — "tap opens the signals surface and the button is labelled", "aura colors come from the need meta, per band" |
| C5 | Stack tile: supplements taken n/m → `/fuel/stack` | NapHubPage.tsx:401-403, `useStackDay(date)` | Day panel | Daily | Quick picker entry + full surface stays in Fuel; companion may prompt a missed dose | MOVE | `NapHubPage.test.tsx` — "C5/C6: a stack- és a cél-csempe sincs többé a mozaikban"; `NapGyorsPage.test.tsx` — "the Stack tile navigates to /fuel/stack" |
| C6 | LifeGoalTodayTile | NapHubPage.tsx:366, `LifeGoalTodayTile` | Day panel | Weekly-ish | Companion next-step rotation includes the goal-linked daily step; goals home is Én | MOVE | `NapHubPage.test.tsx` — "C5/C6: a stack- és a cél-csempe sincs többé a mozaikban"; "C6: cél esetén a következő lépés a cél foka lesz, a cél címével"; "C6: még fel nem oldott cél-lekérésből nem találunk ki lépést — marad a napló-fok" |
| C7 | Night mode tile (timed: within wind-down 90 min) → `/me/sleep/night` | NapHubPage.tsx:436-440 | Evening panel, only inside window | Nightly | Timed evening element, unchanged behavior | KEEP | `NapHubPage.test.tsx` — "C7: az Éjszakai mód csempe csak a levezető ablakban jelenik meg"; "C7: délután nincs Éjszakai mód ajtó — időzített, nem állandó csempe" |

## D. Shell, modes, background

| # | Capability | Evidence | Current behavior | Freq/value | Destination | Decision | Preservation test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Anchor mode `?day=rough` ("nehéz nap": 3 anchors, local ticks, exit) | NapHubPage.tsx:242-291, `useTodayScenario` | Provisional (F7) full-page replacement | Rare, high-empathy | Rebuilt now in Titanium form: quieted companion + three anchors (owner chose the full rebuild over deferring) | KEEP | `NapHubPage.test.tsx` — "D1: ?day=rough a csendes horgony-felületet adja, mozaik nélkül" |
| D2 | Shell header: daypart switch, Mezo badge, bell, DayOrb, profile orb | `AppHeader.tsx` (mezo-atry), `MezoThreadProvider` | Shell-owned, not page-owned | Constant | Shell-owned stays; the Titanium landing does not fork the header | KEEP | Unchanged by this slice — `AppHeader.test.tsx` + `hubHeaders.test.tsx` (existing, pre-Titanium suites, still green against the rebuilt `/nap`) |
| D3 | Quick log FAB → QuickInputSheet | `features/quickinput/QuickInputSheet.tsx`, `QuickLogFab` | Global fast log (voice/text dispatch, tool handoffs) | Daily, high | Full-page Titanium quick picker becomes the one canonical quick surface on this page; old entry points redirect | MERGE | `TabBar.test.tsx` — "the floating FAB navigates to the full-page picker from /nap exactly", "the floating FAB opens the quick-log sheet away from /nap"; `NapGyorsPage.test.tsx` — "renders all nine quick-log tiles and the Mondd el Mezónak row", "the Stack tile navigates to /fuel/stack"; `navigation.test.tsx` — "/nap/gyors resolves from the router config to the full-page quick-log picker" |
| D4 | Entrance choreography (EntranceGroup, replay on daypart change) + count-ups | NapHubPage.tsx:295, `useCountUp` | One-shot rise, bars fill, numbers count | Constant | Titanium one-shot entrance; reduced-motion honored | KEEP | `NapHubPage.test.tsx` — "D4: prefers-reduced-motion mellett a szám azonnal a helyén áll (nincs beúszó animáció)" |
| D5 | Tutorial/kalauz anchor (`data-kalauz-anchor="nap-hero"`) | NapHubPage.tsx:246,298,347,412; tutorial feature | Guides target the hero | Onboarding | Anchors preserved on the new hero/companion block | KEEP | `NapHubPage.test.tsx` — "D5: a kalauz horgonya megvan a normál ÉS a horgony-módú renderen is" |
| D6 | Companion feed / proactive advice (`useCompanionFeed`, real-mode only) + `/nap/uzenetek` | terrain report; `GET /api/proactive/feed` | Feed chips real-mode only; Mezo thread via provider | Daily | Companion layer surfaces the feed; `/nap/uzenetek` unchanged this slice | KEEP | `NapHubPage.test.tsx` — "D6: a társ blokkjából egy koppintás a Mezo-beszélgetés" (the feed page itself is `NapMezoPage.test.tsx`/`NapMezoPage.deeplink.test.tsx`, unchanged by this slice) |
| D7 | Subroute compatibility: `/nap/uzenetek|rutin|kuldetesek|checkin|eletjel`, `today/*` redirects, `?dp=` deep links | router.tsx:198-209 | Notification/tutorial deep-link targets | Background | All routes keep working | KEEP | `navigation.test.tsx` — "/nap renders the day spine (Today content) and /today redirects to it", "/nap/gyors resolves from the router config to the full-page quick-log picker"; `NapKuldetesekPage.test.tsx` — "/nap/kuldetesek still resolves and renders the page…" (C1); the other subroutes' own page tests (`NapMezoPage.test.tsx`, `NapRutinPage.test.tsx`, `NapCheckinPage.test.tsx`, `EletjelPage.test.tsx`) are unchanged by this slice |
| D8 | XP display (day XP pot on quest tile, evening strip, habit toast levelUp) | NapHubPage.tsx:146,450, `useGamificationDay` | XP shown as feedback, never currency | Daily | Follows hosts: habit-tick toast keeps XP/level-up; evening strip keeps day XP; quest XP goes with C1 (deferred) | KEEP | `NapHubPage.test.tsx` — "B2: a csempe pipája UGYANAZT a jutalom-payloadot küldi, mint a Rutin oldal" (habit toast XP/level-up); "A7: feloldott lekérésnél az XP cella a nap tényleges termését mondja" (evening strip XP) |

## Owner decisions summary (2026-09-10)

- Slice scope: landing page only (A); one-tap logging on the water tile only, with undo.
- Structure: full companion + ONE computed next step + six stable tiles; daypart changes
  greeting/next-step only.
- No day paging on Nap Mai (matches approved prototype and current production).
- Quests: DEFER off the landing, final home later (bd follow-up).
- Kreed → companion greeting (MERGE). Életjel → companion tint (MERGE). Stack, check-in →
  quick picker + companion prompts (MOVE). Life-goal step → companion next-step rotation (MOVE).
- Anchor mode: rebuilt now in Titanium form (KEEP).

## Closure record

| Check | Evidence |
| --- | --- |
| CODEMAP freshness | `node scripts/gen-codemap.mjs --check` run 2026-09-10 (see commit) |
| Domain closure | Nap starting set + mandatory related checks classified in rows A–D; quests explicit DEFER |
| Backend closure | Slice 1 touches no backend; consumed endpoints listed in the design spec |
| Frontend closure | Rows A–D cover every hook/component/route of `NapHubPage` + shell surfaces |
| Owner closure | Every DEFER and ambiguous MERGE explicitly decided (see summary above) |
| Prototype scope | Companion (greeting+creed, needs tint, next-step engine), six tiles incl. water one-tap+undo, quick picker, evening state incl. strip + night-mode window, anchor mode, reduced motion |
| Preservation scope | The "Preservation test" column above, verbatim, becomes the production test checklist |
