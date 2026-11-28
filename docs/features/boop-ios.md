---
title: Boop — native iOS app
type: feature-domain
status: in-progress
updated: 2026-11-28
tags: [ios, etel-ma, meal-detail, level, l1-l2-level, evad, b6-evad, season, penz, l5-penz, blokk-epito, heti-atnezes, kezdolap, area-kit, l0, elo-fal, l0b, b4-etel, food, barcode, meal-photos, sensitivities, b3-napi-ritmus, offline-first, outbox, dayclose, b1-adatalap, health-samples, apns, swiftui, boop, napkelte, lagy, auth, onboarding, healthkit, eventkit, wearable, morning-brief, energy-curve, voice]
key_files:
  - ios/Boop
  - ios/BoopKit/Sources
  - backend/src/main/java/io/mrkuhne/mezo/feature/wearable
  - api/feature/wearable/wearable.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/boop
  - api/feature/boop/boop.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/dayclose
  - api/feature/dayclose/dayclose.yml
related: [season, penz, mail, fuel, pantry, recipe, dayclose, intention, journal, companion, proactive, _platform-auth-security, _platform-api-backend, me, today]
---

# Boop — native iOS app — Feature Documentation

> **2026-11-28 — Ma tab redesign (`mezo-r36n9.197.3`, step 3 of the Edzés redesign, decisions #119 #129).** `EdzesRoom.ma` renders the `NKPagedHero` „A mai edzés" (label · title · time · perc/gyakorlat/éles sorozat · one `NKCardActions` primary · the in-hero „Másik napot" / „Mégis a mai napot" links; page 2 the body map), then Következik, „A mai gyakorlatok", „Hol tartasz" (`EdzesWeeksArc(compact:)` → Mezociklus tab), „Az Edzés terület", ask row. Decisions in `MaHeroKind` / `MaHeroPrimary`. See *Ma tab redesign* below.

> **2026-11-28 — Mezociklus tab redesign (`mezo-r36n9.197.2`, step 2 of the Edzés redesign, decisions #119 #129).** One hero (`MezoHero`: title, week line, `EdzesWeeksArc`, Szerkesztés; Újraindítás · Lezárás · Mentés a sablonba in its `NKMoreMenu`), then the week review entrance, „A heted" and „Izmok ezen a héten" (`EdzesMuscleBars`) as `NKSectionCard`s, the two tiles, the ask row. `MezoHeroState.resolve` keeps the hero in a calm loading state until `EdzesStore.blockAnswered`; `NKFlowRow` now wraps an item wider than the row (the „ÚJ HÉT" capsule at XXXL). Review: `-edzesTab Mezociklus -previewEdzesState nincs|hiba|offline`.

> **2026-11-28 — Sport S3: the Sport area and its Ma tab (`mezo-r36n9.203`, step 3 of six; spec [`2026-11-27-boop-sport-design.md`](../superpowers/specs/2026-11-27-boop-sport-design.md) §5.1/5.2/5.6/5.9, plan [`2026-11-28-boop-sport-s3.md`](../superpowers/plans/2026-11-28-boop-sport-s3.md)).** The **eleventh ring orb, right after Edzés** (`Area.sport`, `Hue.sport` coral, the outlined `ball-sun` glyph; the orb shows the week's sport done / planned, „–" without a rhythm) opens `Sport/SportRoom` on the shared area page: Ma · Hét · Napló · Test (the last three are `NKNotLiveYet` until S4/S5), actions „Sport rögzítése" + „Heti rend". **Ma** (`Sport/SportMa`) is the approved spike's: the hero for tonight's moment (before · the watch recorded it, with a badge on the Ma tab · logged · skipped with Visszavonás · „Ma nincs sport" + the next one), the ring of the week, **A NAPOD** (gym and sport as two separate blocks on a 6–23 strip), **EZEN A HÉTEN** (seven day cards, two lanes), **AMIRE FIGYELEK** (the server's hints in words, a calm line when none), the ask row. Every word comes from the pure `BoopCore/Sport/SportLogic`; data from `SportStore` (`SportModel.swift`): cache first (`ServerCache` `sport/overview`), fresh read behind, offline keeps the week with its age, a fault only with nothing to show. **Log sheet** (`Sport/SportSheets`): with tonight's Health workout the time, length and kcal are pre-filled („Az órádról", sent as `kcalOverride`), else sport chips + length; effort 1–10 defaulting to the last one (two rows of five at accessibility sizes), sets + shoulder for volleyball, note → `RitmusEnvironment.captureSport` (`OutboxKind.sportSession`) → `SportStore.noteLogged` shows it done at once. **Skip sheet**: eight reasons → `PUT /api/train/skips` (kind SPORT) through `SportClient`; undo `DELETE`. Wiring: `RootView` (store), `KezdolapView` (ring + `-previewHome sport`), `NapView` (room). Preview: `-preview shell -previewHome sport` with `-sportMoment before|recorded|done|skipped|nosport|sportonly`, `-sportState ready|empty|loading|error|offline`, `-sportSheet log|skip`, `-sportTab` (`Sport/SportPreview.swift`). Known gap: `POST /api/train/sport-sessions` has no `clientRef`, so a lost 2xx reply can duplicate a log (follow-up filed).

> **2026-11-28 — The recipe evaluation card (`mezo-r36n9.199`; spec [`2026-11-27-boop-receptertekeles-design.md`](../superpowers/specs/2026-11-27-boop-receptertekeles-design.md), plan [`2026-11-28-boop-receptertekeles.md`](../superpowers/plans/2026-11-28-boop-receptertekeles.md), decisions #139–#140).** `RecipeDetail`'s *BOOP ÉRTÉKELÉSE* is now `RecipeScoreCard` (`Etel/RecipeScoreCard.swift`) in the Étel palette (`EtelPalette`: green #3FBF8F, honey #F4C860, coral #F28B6E, one colour per dimension): a **rosette** hero (one petal per dimension, length = score, a degraded one a faint stub) with the verdict (server `tagline`, else `recipeVerdict` = score band + weakest dimension), confidence bar, `fitsFor` pills and summary; **HA MA MEGENNÉD** (`recipeDayImpact` over today's `FoodDay`: eaten → after per kcal/protein/carbs/fat, „felett” wording in the same hue when over, a kímélő GUIDANCE day shows no target); **MIBŐL ÁLL ÖSSZE** (2×4 tiles, the weakest marked amber; tap → `RecipeDimensionDetail` over the blurred sheet: MIT MÉR / MIÉRT ENNYI / A SZÁMOK / HONNAN JÖN (server `contributors`) / ÍGY JAVÍTHATÓ, tap outside to close, no animation under reduced motion); **A RECEPTJEID KÖZÖTT** (`recipeRank`: ≥ 3 scored recipes, ties share a rank, strip dot at `stripIndex`, standout macro, eaten line); **ÍGY LENNE JOBB** (tip + dimension pill + impact tag); **Hasznos volt?** (`FoodClient.breakdownVote` / `setBreakdownVote`, companion feedback kind `recipe_breakdown`; writes serialized, a late read never overwrites a tap). At accessibility text sizes the day rows and `EtelSheetCard` headers stack. Review hooks: `-etelSheet detail -previewScroll N`, `-receptDim <id>`, `-receptState slow|error` (`NKSheetFrame` honours `nkInitialScrollY`). Server half: [`recipe.md`](recipe.md) §3 *Prose v2*.

> **2026-11-28 — Kit: hero + glass-card pieces and the lighter Edzés sky (`mezo-r36n9.197.1`, step 1 of the Edzés redesign, decision #119).** `NKSectionCard`, `NKPagedHero`, `NKCardActions`, `NKMoreMenu`, `nkInnerCard` join the Napkelte kit; the Edzés room paints `Hue.mozgas.roomSky`; Étel Ma runs on the new pieces unchanged. See §2 *Area kit*.

> **2026-11-28 — The barless home (`mezo-r36n9.196`, step 1 of the Évad-szoba work; decisions #132–#138; spec [`2026-11-27-boop-evad-szoba-kezdolap-design.md`](../superpowers/specs/2026-11-27-boop-evad-szoba-kezdolap-design.md)).** **Current navigation — this supersedes every "spine / place / bar / quick doors" description below.** There is **no bottom bar, no `ShellTab`, no `NKSpineBar`, no `PlacePage`, no panorama place switch and no quick doors**: `ShellView` hosts `KezdolapView` as the root. The ring has **ten orbs** clockwise from the top — Nap, Alvás, Étel, Edzés, Energia, **Évad** (new, violet, shows this week's adherence %, „–" with no season or nothing judged yet), Súly, Forma, Pénz, Levél. The centre orb and Boop's line (caption „KÉRDEZD BOOPOT") open Boop's chat (back button to the ring); the **Nap orb opens the Nap room** (`Nap/NapRoom.swift`: `NapTab`, `napRoomHead`, `NapRoomPage`) with its own bar **Ma** (the day page) · **Napok** (`Naplo/NapokTab.swift`, replaces `NaploView`: the last 14 days, each row opens that day's sheet) · **Boop**; the Évad orb opens today's Évad page in a room frame with a back button (its own tabbed room followed the same day, see the next note). A floating glass  (`NKFloatingPlus`, BoopKit `Napkelte/FloatingPlus.swift`, a11y „Rögzítés") sits bottom-right on the ring, raised above a room's bar, hidden on the chat, and opens the unchanged capture sheet — the five former quick doors are gone from the ring and remain on that sheet. One destination type, `BoopDestination` (`Shell/BoopDestination.swift`: `RoomEntry`, `homeDestination(restored:)`, env `openDestination`), replaces `openPlace`; an old remembered place maps once on launch (Napló → Nap › Napok, Boop → chat, Évad → Évad room, else the ring). Simulator: `-previewTab` and `-previewSwitch` are removed; `-previewHome nap|napok|chat|evad|alvas|etel|edzes|energia|suly|forma|penz|level` opens the home moved on (`nap-oldal` aliases `nap`). See §9 *One destination type, no spine*.

> **2026-11-28 — The Évad room (`mezo-r36n9.196`, step 2; decisions #132–#138).** The Évad orb now opens **`EvadRoom`** (`Evad/EvadRoom.swift`, `EvadRoomTab`) with four tabs **Most · Hét · Terv · Kísérlet** (`EvadMost`, `EvadHet`/`EvadHetPages`, `EvadTerv`/`EvadYearStrip`, `EvadKiserlet`; shared cards in `EvadParts`/`EvadShared`): each tab is a hero + one *what you see here* sentence + at most five cards. The old single Évad page and its Menü · Lista · Hatás tabs (`EvadPage`, `EvadOverviewTab`, `EvadMenuTab`, `EvadListTab`, `EvadRecipesPage`) are deleted. A **guided five-page Sunday weekly review** (`Evad/Review/WeeklyReview{Flow,Pages,Reminder}.swift`, pure logic `BoopCore/Evad/{EvadReview,EvadRoomLogic}.swift`; window Sunday 18:00 – Monday 23:59 phone time, done stored per week on the phone only; local notification Sunday 18:00 only with a season and only if notifications are already allowed) opens from a Ma wall card, the Hét tab card and that notification. The **weekly menu + shopping list moved to Étel › Hét** (`Etel/EtelMenu.swift`, `Etel/EtelList.swift`), and every recipe gets a **„Menübe jöhet" toggle** (Receptek row + recipe detail) with a filter chip. Wall cards re-routed (§2 *Évad room*). **No backend change, no new API.** See §2 *Évad room*, §9 *Recipe toggle = full-set write*.

> **2026-11-27 — The player says the challenge and the special last set in words, also on a day that skips them (`mezo-r36n9.195`).** Contract: `TodayExercise.skippedToday` (`SkippedTechnique {technique?, challenge, reason DELOAD|GENTLE|SPORT}`), set in `WorkoutService.getToday` where the technique overlay is suppressed — deload week → DELOAD, comeback / readiness lighten → GENTLE (an invalid catalog pick gets none), sport day → SPORT with the dropped challenge (and a dropped planner technique); null on a normal day. App: `PlannedExercise`/`SessionExercise.skippedToday`; the pure `BoopCore/Train/TechniqueHeadline` builds the head's sentence (`today(technique:challenge:best:)`) and the dim skipped line (`skipped(_:keptTechnique:)`); `TechniqueHeadlineRow` / `TechniqueSkippedRow` (`Edzes/PlayerTechnique.swift`) replace `TechniquePill`/`ChallengePill` under the name in `WorkoutPlayer.exerciseHead`. Preview: `-previewEdzesSkipped deload|gentle|sport` (with `-previewEdzesTechnique YES`), `-previewEdzesAt N`. Tests: `TechniqueHeadlineTests`, `WorkoutTodayTechniqueIT` (deload/comeback/sport assertions).

> **2026-11-27 — The top of a page no longer pulls down; a tap outside closes the keyboard (`mezo-r36n9.191`).** New kit modifier `nkTopBounceLock()` (`BoopDesign/Napkelte/TopBounceLock.swift`): a zero-size `UIViewRepresentable` probe inside the scroll content finds its hosting `UIScrollView` and KVO-clamps `contentOffset.y` at `-adjustedContentInset.top` (not the delegate — SwiftUI owns it), so the top bar and the sky stop following an overscroll and no empty band opens above them; the bottom still bounces. No page pulls to refresh any more (owner, same day): `.refreshable` was removed from the Étel room (its head's Frissítés action reloads) and Mezociklusok (reloads in `.task` on every open), and the lock has no `refreshControl` exemption. Applied inside `NKTabPage`, `NKAreaPage`, `NKAreaSubPage`, `NKDrillPage`, `NKFlowFrame` and the full-screen pages with their own scroll (`WorkoutCeremony`, `EsteView`, `EvesTervLetrehozas`, `EvesTervTerkep`, `UjBlokkAlapok`, `UjBlokkJeloltek`); never in sheets (their pull-down closes them). Keyboard: `Boop/App/KeyboardDismiss.swift`, installed in `BoopApp.init`, puts one `UITapGestureRecognizer` (`cancelsTouchesInView = false`) on every app window; it only receives while the keyboard is up, ignores touches inside a `UITextField`/`UITextView`/`UISearchBar` and inside views marked `.keepsKeyboard()` (the Boop chat composer), and calls `endEditing(true)`. Checked in the Simulator (pull-down held on Ma and the Alvás room; chat keyboard closed by a tap, text kept).

> **2026-11-27 — Étel Ma redesign: three tiers, meal pages, correction and delete (`mezo-r36n9.184`; spec [`2026-11-27-boop-etel-ma-ujratervezes-design.md`](../superpowers/specs/2026-11-27-boop-etel-ma-ujratervezes-design.md), plan `2026-11-27-boop-etel-ma-ujratervezes.md`).** `EtelMa` is rebuilt in three tiers. **(1) Hero glass card** — a kcal ring (centre „még N kcal”; over budget „−N kcal” in the normal colour; kímélő day „ma nincs keret”) + Fehérje/Szénhidrát/Zsír bars („120/176 g” — eaten/target, since 2026-11-27 `mezo-r36n9.198`; was „még N g”) on page 1 of a paging `TabView`, the „A NAP MENETE” `NKCurve` (eaten vs plan vs budget) on page 2; at accessibility text sizes and with VoiceOver the pages stack and the curve is read as words. **(2) One glass card per plan window** — header with **+** (logs into that window), logged meal rows (time, F/Sz/Zs, kcal, points), open later windows with suggestion + *Kihagyom*, skipped-window undo, the pending/outbox cards kept. **(3)** Víz (+250/+500), Kiegészítők (*Bevettem* groups), Italok cards, then the ask row. A meal or drink opens its own full-screen page `Etel/MealDetailPage.swift` (numbers, ingredients card, Boop's evaluation — cached words first, the dimension grid explains on tap) with **Javítás** and **Törlés**. *Javítás* opens the composer pre-filled in **edit mode** (`MealComposerModel`) and saves through `FoodClient.updateMeal` (`PUT /api/meal/{id}`): the same meal, its time and window kept, never a duplicate or an outbox card (tests `MealEditTests` in BoopCore, `MealComposerEditTests`). *Törlés* — from the page, the custom row swipe (`MealRowActions`), the context menu or VoiceOver actions — removes the meal at once (`EtelStore` `removeLocally`) and raises a „Visszavonás” toast for 6 s (same as `NKToast`'s action toast) that restores it with **no server call**; after 6 s the deferred `FoodClient.deleteMeal` (`DELETE /api/meal/{id}`, soft delete `is_deleted` server-side) runs, and a failed delete restores the meal and the numbers with a calm line (`EtelStoreDeleteTests`, `EtelMaTests`). Offline, Javítás/Törlés are dimmed with a spoken reason. The Étel room alone gets a lighter sky, `NKSky.room(hue)` („világos 2”, used by `NKAreaPage`/`NKAreaSubPage`). **No backend change** — the PUT/DELETE meal endpoints already existed. Known kit-wide follow-ups, not fixed: the room tab bar truncates at XXXL, `NKCurve` hour labels crowd at XXXL, `Font.nkSerif` does not scale. Final review: a correction never parks an outbox card (`MealComposerModel.ensureParked` guards `editingId`; `MealComposerEditTests.addingMoreWordsWhileCorrectingNeverParksACard`), Visszavonás rides only on the delete's own toast line (`undoLine`), waiting deletes commit on `.background` (not `.inactive`) inside a `beginBackgroundTask`, and a refused delete restores from the freshest record. Under VoiceOver both hero pages stack and the curve is read through its note.
> **2026-11-27 — B7 K4 „Előrejelzés” (`mezo-r36n9.17`).** `KapacitasWire` reads the K4 fields leniently (an older server still decodes): `KapacitasPattern` + `body`/`consistent`/`weekday`, `KapacitasWeek.history` (`KapacitasHistoryItem`, default `[]`), `KapacitasProposal.outcomeWord/outcomeSub`, `KapacitasSeasonLoad.patterns` + `deloadForward` (`KapacitasDeloadHint`); `KapacitasClient.seasonHints()` (`getCapacitySeasonHints`). Átrendezés: *Korábban áttettük* („és hogyan sült el”) shows the server's outcome word + line for this week's lived moves and the decided proposals of the eight weeks before (`kapacitasHistory`); *Ebből tanulok* shows title + evidence sentence (`kapacitasPatternRows`). Évad (`EvadTeher`): the advisory lighter-week card (`NKHighlight` „Boop javaslata”, only „Megbeszélem Boop-pal” → the Boop place; decision #121, nothing is written) under *Teher és pihenés*, and *Amit a mozgatásokból tanultam* at the bottom. Új évad step 2 lists the hints („AMIT A MOZGATÁSOKBÓL TANULTAM”). From Sunday 18:00 local the wall card, the Ma wall's week read and the day page's Átrendezés use next week (`kapacitasWallMonday`). The Ma wall then also loads this week, so an urgent today-proposal about Sunday still reaches the wall (`kapacitasWallCandidates(currentWeek:)`). Previews: `-previewKapacitas YES -kapState settled` (history + a pattern), `-preview shell -previewTab terv -evadState full [-evadOpen uj]` (season K4 fields, hints). See [`capacity.md`](capacity.md) §4 *Outcomes and patterns (K4)*.

> **2026-11-26 — A recipe logged ingredient by ingredient (`mezo-r36n9.181`).** Picking a recipe in the composer (`MealComposerModel.useRecipe`) and the recipe page's one-tap log (`EtelRoom.logRecipe`) now put **one shelf line per ingredient** on the plate — `DraftItem.ingredientLines(of:shelf:)` in `BoopCore/Etel/MealDraft.swift`: grams = recipe amount ÷ servings (kg/l scaled; whole above 10, one decimal below), numbers from the shelf row, each line carrying `recipeId` + `recipeName` as the marker. Any ingredient without a shelf row (the shelf list holds foods only — a supplement ingredient falls back), without numbers or in a non-mass unit → the old single `DraftItem(recipe:)` "1 adag" line. The draft tile's pill reads „<recept> része” (`draftSourceTag`), its medallion the book glyph; `MealItem` decodes `recipeId`/`recipeName` and `MealDetail` lists each such recipe as „<recept> receptből” with its lines (`recipePartGroups`, `huQuantity`). Tests: `RecipeIngredientLinesTests`.

> **2026-11-26 — K3 final review (`mezo-r36n9.17`).** `clockSublative` reads minutes ending in 3, 6, 8 with „-ra” (három, hat, nyolc); the contract copy was re-synced after each rebase (`sync-openapi.sh`, `check-ios-contract.mjs` green). Étel's skip undo answers a capacity-owned skip (409) with „Ezt az Átrendezés oldalon tudod visszavonni” instead of a retry message (`EtelSettingsTests.aCapacityOwnedSkipPointsToTheAtrendezesPage`).

> **2026-11-25 — Évad: one accept moves the running block too (`mezo-r36n9.122`, spec §5.12-1).** Módosítás no longer locks the gym days while a block runs: the preview shows **A blokkod új hete** and *Elfogadom* re-arranges the block (same count = days move in order; more = the evaluator's best repeat; fewer = the day whose loss the evaluator minds least) with the goal, slots and sleep need in one transaction — see the Módosítás entry in §2 and [`season.md`](season.md).

> **2026-11-25 — Levél: Google sign-in to his own Gmail (`mezo-r36n9.38`/`.39`, owner 2026-11-25: no mirror mailbox, „Belépés Google-lel”; spec §12).** *Fiókok* is now one **Google button** (states *not connected · unconfigured · connected · auth_failed*), signing in through `ASWebAuthenticationSession` + PKCE (`BoopCore/Level/GooglePKCE.swift`, `ios/Boop/Level/GoogleSignIn`) with **no Google SDK**; the six-step mirror guide and app-password fields are gone from the app. Server side: [`mail.md`](mail.md) §3.10.

> **2026-11-25 — No warm-ups in the app; kcal at the end of a workout (`mezo-r36n9.170`, owner 2026-11-25: „vegyük ki mindenhonnan a bemelegítő szettek mutatását… becslés, utána óra").** **Warm-ups:** `PlannedExercise.init` drops every `kind == .warmup` prescribed set (wire, cache and preview alike), keeping only `warmupCount` so a swap (`EdzesStore.swapExercise`) hands the server's count back untouched; `WorkoutSession.init` ignores logged warm-ups of an open instance from an older build; the player's „BEMELEGÍTŐ n/m" step line, the day-edit sheet's „Bemelegítő sorozat" stepper and the `more_warmups` candidate reason are gone, and the Új blokk minutes copy no longer says „bemelegítéssel". The server still prescribes warm-ups (its minutes model counts them) — only the app hides them. **kcal:** `WorkoutInstance.energy` (`WorkoutEnergy {kcal, source estimate|watch}`, from the new optional `WorkoutInstanceResponse.energy`) is read off today's `completedWorkout`; `EdzesStore.energy(for:)` accepts it only for today's completed instance of the same template day. To have it while the ceremony is open, `EdzesRoom` now **sends the finish when the ceremony opens** (`sendFinish`, guarded by `finishSent`), not on its „Kész"; closing the ceremony any way ends the workout locally. `WorkoutCeremony(energy:)` shows a glass line under the three counters — „kb. N kcal · becslés · az órád pontosítja" or „N kcal · az órád mérte" — fading in when it arrives, absent when unknown (nothing is computed on the phone). Server side: [`train.md`](train.md).

> **2026-11-25 — Another day of the week, started today (`mezo-r36n9.163`, owner 2026-11-25: Tuesday's gym day was missed, Wednesday he does it live without the week slipping; approach 1 of three — not shifting the week, not only marking it missed; screenshots `docs/superpowers/specs/assets/masik-nap/`).** Under the Ma card a quiet row **„Másik napot csinálok ma"** (while nothing runs, today is not done and no other day is on the card — also on a rest day) opens `Edzes/OtherDaySheet.swift` „Melyik napot csinálod ma?": BoopCore `otherDayChoices` (`Train/OtherDay.swift`) lists the block's days with an id and at least one exercise that are not today's weekday and not done this week — missed first, the most recent first („KEDD · KIMARADT"), then the later ones („KÉSŐBB"). A pick → `EdzesStore.pick(_:)` reads `todayWorkout(templateSessionId:)` (the server's cross-day read, `mezo-p7rp`) and keeps `pickedDay` for every later `load` (never written to the offline cache as today's plan; offline → „Most nem érem el a szervert, a másik nap tervét nem tudom letölteni."); the card turns **PÓTLÁS** with „keddi nap, ma pótolod · …" (`isAnotherDay`: the plan's `dayLabel` is not today's weekday — also true after a relaunch while that day runs), Indítás starts it through the usual briefing and player, **„Mégis a mai napot csinálom"** goes back (`pick(nil)`). `EdzesStore.loadWeek(queued:)` reads the Mon–Sun history (`weekDoneTemplates`: completed instances of the week by template day + queued Napló bookings + a finished session on the phone), so **A heted ticks the template day done, not the date** (a Tuesday done on Wednesday ticked Wednesday before), and a done card names the workout actually done today (`doneTodayTitle`) when it was another weekday's. No server change. Preview: `-previewOtherDay sheet|pick`; the preview block now carries `weeklyReviewMode` (it had stopped decoding, so the preview's Blokk tab and the week were empty). App-target tests (`EdzesStoreTests` additions) run on the Xcode Mac (`mezo-r36n9.150`).

> **2026-11-24 — Backdated capture, the Napló's catch-ups, the gym catch-up and drinks (`mezo-r36n9.159`–`.161`, decisions #103–#105; spec [`2026-11-24-boop-visszamenoleg-ital-design.md`](../superpowers/specs/2026-11-24-boop-visszamenoleg-ital-design.md), plan [`2026-11-24-boop-visszamenoleg-ital.md`](../superpowers/plans/2026-11-24-boop-visszamenoleg-ital.md), built on `feat/boop-visszamenoleg-ital`).** (1) **The „Mikor" row** — the kit's `NKWhenRow` (`BoopDesign/Napkelte/When.swift`, primitives only: the design kit has no BoopCore dependency) bound by the app's `Capture/WhenRow.swift` to BoopCore's `WhenChoice` and the pure rules in `BoopCore/When/When.swift` (`whenEarliest` = start of today − 6 days, `whenClamp`, `whenResolved`, `whenLabel` „ma / tegnap / nov. 22. · vasárnap" and the time form „most / tegnap · 13:11", `whenToast` „… rögzítve · tegnap", `whenSleepNote`) — on the Súly, Alvás, Sport and Napló quick sheets (payload dates from the chosen moment; the sleep's day is the chosen morning; a past morning shows the Health-keeps-its-times note) and a **Tegnap** chip on the composer's `MealTimeRow` (`MealComposerModel.setYesterday`). (2) **The Napló lists today and the previous six days always** (`NaploDays.weekEntries` → `NaploListEntry.day/.empty`); a day's sheet (`NaploDayDetail`) carries the **PÓTLÁS** block (`Naplo/NaploCatchUp.swift`: `NaploCatchUpModel` reads the ledger, the block's template day for the weekday via `TrainClient.blockPlan`/`todayWorkout(templateSessionId:)`, the date's Mon–Sun week of history via `history(from:to:)` plus the outbox's queued bookings (`gymDone`, `asPlannedBookings`), the phone's live session file (`EdzesStore.sessionFile`), the day's journal lines via `RitmusClient.journalLines(on:)` (`listJournalEntries`) merged with the ledger's pending ones, and that day's brief via `MorningStore.brief(for:)`; the pure `NaploCatchUps.compute` decides: today only the passed, missing check-in moments; a past day inside the week every missing moment, the close when none, the gym day when there is a template day not done in that week — neither completed on the server nor booked in the queue — and no workout open on the phone) and **A NAP SORAI**. The covers hang on the sheet itself (`fullScreenCover` for the check-in and the close, `sheet` for the Megvolt sheet); after a catch-up the sheet stays and re-reads its block. (3) **`CheckinFlow(env:catchUp:)`** fixes the day and the moment and stamps `capturedAt` at the moment's own time (`CheckInMoment.time(on:calendar:)`: 06:30 · 10:00 · 14:00 — the energy dot and the Health snapshot belong to that day); eyebrow `catchUpLabel` „PÓTLÁS · TEGNAP · DÉL", line „Ahogy akkor voltál."; **`EsteFlow(env:brief:date:)`** closes a past day with its own goal and brief at `esteCatchUpInstant` (21:00). (4) **Drinks (`mezo-r36n9.160`)** — `MealKind.drink` (`BoopCore/Etel/MealDraft.swift`; `MealCapture.kind`, decoding `.meal` for older queues; `FoodClient.slot(at:cal:kind:)` pins `drink`; `MealDraftSender` stamps it on the computed draft, so an offline drink stays a drink); `MealStart.Entrance.drink` opens the composer in drink mode (eyebrow „Ital · HH:mm", „Mit ittál?", MIKOR ITTAD, the **SZOKÁSOS ITALAID** chips from `usuals(slot: "drink")` filtered to drinks, the same photo/words/Recept · Kamra · Vonalkód doors, every draft saved with `slot = "drink"`); the Ital chip on the „+" sheet and „Ital rögzítése" in the Étel room's menu; `etelWindowItems` leaves drinks out of the windows, `etelDrinks`/`etelDrinkKcal` feed the **ITALOK** `NKBare` on Étel · Ma (cup glyph `cup-cream`, no ring), `etelStats` counts meals only, the Hét day sheet draws no ring for a drink; the orb's mean skips the nil score. (5) **The Megvolt sheet (`mezo-r36n9.161`, `Edzes/WorkoutAsPlanned.swift`)** — `WorkoutAsPlannedModel` loads `todayWorkout(templateSessionId:)`, `asPlannedRows` says „3 × 8 · 60 kg" / „3 × 15 · – kg · írd be" (`BoopCore/Train/AsPlanned.swift`), a tap opens a weight field (one override per exercise), MIKOR = the plan's session time else 18:00 (`asPlannedDefaultTime`), `book` enqueues `OutboxKind.workoutAsPlanned` (`WorkoutAsPlannedPayload`, group `workout|<id>`, stands alone) → `TrainClient.sendAsPlanned` → `POST /api/train/workouts/as-planned` with the item id as `clientRef`; a 409/400 is final and carries the server's own words, a 404 (the template day's block rotated or ended) is final in the owner's words. Preview flags: `-previewWhen tegnap`, `-previewOpen naploDay|drink|megvolt`, `-previewCatchup YES`, `-previewDrinks YES`. The app-target tests (`QuickSheetsWhenTests`, `NaploCatchUpModelTests`, `CheckinFlowTests`/`EsteFlowTests` additions, `MealComposerDrinkTests`, `EtelDrinkRowsTests`, `WorkoutAsPlannedModelTests`) run on the Xcode Mac (`mezo-r36n9.150`).

> **2026-11-21 — Levél final review.** Signing out (or switching account) cancels every pending `wall.*` notification and clears the notifier's stored state (`WallNotifier.signedOut`, called from `RootView`).

> **2026-11-21 — Boop Levél L1 + L2 (`mezo-r36n9.38` + `.39`), built on `feat/level-posta`.** The Levél area is real: the
> morning post (four groups, scored deals, a learned taste, the mirror-Gmail setup in Fiókok — replaced 2026-11-25 by Google sign-in) and the **first wall source
> from a life area** — and the wall's ring (`WallNotifier`) is built for the first time, for every `.expires` source. See
> **Levél** in §2 and [`mail.md`](mail.md); deploy and the phone install pending at the time of writing.
> **2026-11-21 — Boop B7 K3 Task 17 (`mezo-r36n9.17`, server only).** The synced `BoopAPI/openapi.yaml` gained the Átrendezés operations (`getCapacityWeek`, accept / decline / regenerate); the phone does not call them yet (the Kapacitás client is hand-written; Task 19 builds the page). See [`capacity.md`](capacity.md) §4.
> **2026-11-25 — Boop B7 K3 Task 20 (`mezo-r36n9.17`).** The Ma wall gains the `kapacitas` source (`WallSources.kapacitas`, hue `.pulzus`, `BoopCore/Kapacitas/KapacitasWall.swift`): while the current week has an open proposal, one `.improves` card `kapacitas-het` (rank 0.85, the spike's KapMaPreview copy — „A csütörtök *túl sok* lenne. Négy dolgot tennék át a héten.", sub the moves in brief, „Megnézem"); an open proposal about today while today's session (the brief's) is under three hours away replaces it with `.expires` `kapacitas-ma-<id>` (deadline = the session start; the wall's two-a-day cap applies). Offline-queued accepts are not counted. `MaWall` reads the week on appear (`.task` on its non-empty body) and on return to the foreground; a tap opens Átrendezés, presented by `NapView`'s page-level sheets (`\.openAtrendezes`, crumb „Ma"). The server's live loop may add a today-proposal meanwhile (see [`capacity.md`](capacity.md) §4). Screenshot `docs/superpowers/specs/assets/kapacitas/built/k3-ma-wall-440.png`.
> **2026-11-25 — Boop B7 K3 Task 20 (`mezo-r36n9.17`).** The Ma wall gains the `kapacitas` source (`WallSources.kapacitas`, hue `.pulzus`, `BoopCore/Kapacitas/KapacitasWall.swift`): while the current week has an open proposal, one `.improves` card `kapacitas-het-<hash of the open proposal ids>` (rank 0.85, the spike's KapMaPreview copy — „A csütörtök *túl sok* lenne. Négy dolgot tennék át a héten.", sub the moves in brief, „Megnézem" · „Most nem"; a new open proposal is a new id, so it comes back after he settled the old one); an open proposal about today while today's session (the brief's) is under three hours away replaces it with `.expires` `kapacitas-ma-<id>` (deadline = the session start; the wall's two-a-day cap applies). Offline-queued accepts are not counted. `MaWall` reads the week on appear (`.task` on its non-empty body) and on return to the foreground; „Most nem" settles the card for the day and opens nothing (the pressed label now reaches `MaWall.act`; `NKWallRows` shows a card's secondary as a quiet link — only `.improves`/`.happened` cards are rows, and none of the others has one); „Megnézem" opens Átrendezés, presented by `NapView`'s page-level sheets (`\.openAtrendezes`, crumb „Ma"). The server's live loop may add a today-proposal meanwhile (see [`capacity.md`](capacity.md) §4). Screenshot `docs/superpowers/specs/assets/kapacitas/built/k3-ma-wall-440.png`.
>
> **2026-11-25 — K3 Task 19 fix round 1.** *Ha mindet jóváhagyod* draws the server's `CapacityWeek.allEffects` (≥ 2 open proposals); *Megbeszélem Boop-pal* closes the page and opens the Boop place (`openPlace(.boop)`, the Pénz pattern); *Minden hatása* gains *Ha jóváhagyod, itt látod* (`kapacitasWhereYouSee`: fixed words per step kind naming the days from the step payload, never the kcal target). A replay refused with `CAPACITY_DAY_STARTED` / `TRAIN_DAY_WORKOUT_RUNNING` says the day started; a stale one runs the same refresh as an online stale accept. „vissza” on an accept the outbox is sending right now waits (disabled, one line). `kapacitasMonday(for:)` is always Gregorian in the given zone.
>
> **2026-11-25 — Boop B7 K3 Task 19 (`mezo-r36n9.17`).** The Átrendezés page (`Boop/Kapacitas/AtrendezesPage.swift`, hue `.pulzus`) and *Minden hatása* (`MindenHatasaPage.swift`) are built: `KapacitasClient` gained `week` / `regenerate` / `accept` / `decline` / `undo`; `KapacitasStore` holds the weeks by Monday (`ServerCache` key `kapacitas/week`, cached week shown with its age offline). An offline accept goes into the outbox as `OutboxKind.dayAdjustment` (`DayAdjustmentPayload {proposalId, clientRef}`, the item id = the clientRef, sent by `KapacitasOutboxSender`); a replay refused with 409 is dropped and the week refreshed. A 409 `CAPACITY_PROPOSAL_STALE` refreshes the week (regenerates when that day has no open card) with one quiet line. Entry points: the day page's *Mit tennél át?* (presented by `DaySheet`) and Évad's *A jövő heted* (`EvadSub.atrendezes`, only while the next week has open proposals). *Ha mindet jóváhagyod* is left out (no server figures) and *Ebből tanulok* waits for patterns (K4). Review: `-previewKapacitas YES -kapOpen atrendezes|hatas -kapState full|settled|empty|offline [-kapStale YES]`.
>
> **2026-11-21 — Boop B7 K3 Task 17 (`mezo-r36n9.17`, server only).** The synced `BoopAPI/openapi.yaml` gained the Átrendezés operations (`getCapacityWeek`, accept / decline / regenerate); the phone does not call them yet (the Kapacitás client is hand-written; Task 19 builds the page). Fix round 1: `upsertPlannedSkip` documents a 409 `TRAIN_SKIP_CAPACITY_OWNED` (a capacity skip cannot be re-reasoned from the skip sheet); the stale-card rule means a week read may return a proposal as `expired`. See [`capacity.md`](capacity.md) §4.

> **2026-11-21 — Boop B6 Évad S4 (`mezo-r36n9.16`).** The Évad page's **Hatás** tab is live: Boop's one open
> experiment proposal (*Indulhat* / *Most nem*), the running experiment (day X / L, *Ma megvolt*, overlaps, *Leállítom*),
> past experiments, *Új kísérlet*, and the result page (Előtte | Közben with day counts, the honest verdict, *Megtartom
> szokásnak* / *Újra kipróbálom*). Code `BoopCore/Evad/EvadExperiment{Wire,Store,Logic}.swift` (ServerCache
> `evad/experiments`), `Evad/{EvadEffectTab,EvadExperimentPage,EvadExperimentPreview}.swift`. The `evad` wall source adds
> the proposal (`.improves`, primary „Indulhat” starts it) and a fresh result (`.happened`) — see [`season.md`](season.md) §3.14.

> **2026-11-21 — Boop B6 Évad S3 (`mezo-r36n9.16`).** The Évad page's **Menü** and **Lista** tabs are live: next week's
> menu as a carousel of seven day cards (approve, swap a meal, another menu, „Kiválasztott receptek"), and the approved
> week's shopping list (shelves, „mihez kell", check-off, „Változott", staples on tap, plain-text share, past lists). The
> Ma wall's `evad` source adds the menu waiting for approval as an `.expires` card on the menu day — see **Évad** in §2
> and [`season.md`](season.md) §3.11–§3.13.

> **2026-11-21 — Évad: a gym + sport day is two sessions (`mezo-r36n9.131`).** Hogy megy counts training and sport
> apart („3 / 4 edzés megvolt", „1 / 2 sport megvolt"; an older server's total alone still shows as „edzés"), the food
> row, the *Mi mire hat* Edzés sentence, the new-season summary (`evadKcalSentence`) and *Ennyi változna* („Edzés +
> sport napon") show a gym + sport day's own kcal when the season has one, and `EvadAdherenceDay` decodes the server's
> `dayKind` + `sessions`; `evadDayKindLabel` names the four kinds (edzésnap · sportnap · edzés + sport nap ·
> pihenőnap). Server side: [`season.md`](season.md) §3.7.

> **2026-11-21 — reviewed after the Évad S2 review round (`mezo-r36n9.16`).** A reasoned skip excuses only the session (food and night still count), today's night is never judged, the season title is made inert before it reaches a prompt, the learned-expenditure wall card is keyed on the ISO week, and the Hét tab no longer waits on the day judgement — all described below.

> **2026-11-21 — Boop B6 Évad S2 (`mezo-r36n9.16`).** The Évad tab's **Hogy megy** and **Amit Boop észrevett** are now
> filled from the server (adherence + gated insights), the *Mi mire hat* Alvás → Étel link shows the server's number,
> the **Étel Hét tab reads the server's day judgement** (`GET /api/seasons/adherence`, its own rule kept as the offline
> fallback), and the Ma wall has an **`evad` source** (the learned-expenditure proposal, the season ending soon) — see
> **Évad** in §2. Backend: the season's `[Évad]` rules now reach the chat snapshot, the morning brief and the meal coach
> ([`season.md`](season.md) §3.7–§3.10).

> **2026-11-20 — Boop B6 Évad S1 (`mezo-r36n9.16`).** The spine's second place is **Évad** (was Terv; the tab key stays
> `terv`, the VoiceOver label is „Évad"): `Terv/TervView` is deleted and the Évad page (replaced by `EvadRoom` on 2026-11-28) takes its place — see **Évad** in §2.
> The old Terv frame's weight, today's-session and read-only Pénz cards are gone with it (the Pénz area itself is
> unchanged). Backend: [`season.md`](season.md).

> **2026-11-20 — Pénz cash account on first use (`mezo-r36n9.103`).** Production starts with no Pénz account (the old app's import is `mezo-r36n9.107`), so the cash sheet offers *Készpénz számla létrehozása* when no forint account exists: `PenzClient.createAccount(.cash)` → `POST /api/penz/accounts` `{name: "Készpénz", type: "cash", currency: "HUF", isDefault: true}`, then a forced reload shows the form. *Kiadás* stays active with no account (so the sheet that creates it can open), and the empty Pénz card carries the same *Készpénz számla létrehozása* button itself while no account exists (`PenzRoom.swift`), so the create step is never hidden behind *Kiadás*.

> **2026-11-20 — Boop Pénz L5 (`mezo-r36n9.103`).** `BoopAPI/openapi.yaml` re-synced with the savings-goal paths (server v3.16.0); the generator filter still excludes every Pénz operation — the area reads them through the hand-written `BoopCore/Penz/PenzClient` (see *The Pénz area* below).

> **2026-11-19 — Boop Pénz L4 (`mezo-r36n9.102`, no app change).** `ios/BoopKit/Sources/BoopAPI/openapi.yaml` was regenerated with the new Pénz paths (again after the review round added amount caps and two error codes); the openapi-generator filter does not include them, so no Swift client code changed. The Pénz area's screens are L5 (`mezo-r36n9.103`); the backend they will read is [`penz.md`](penz.md).

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
> backfill, then refresh on every open) and the calendar (since B7 K1: yesterday … today + 8 days, every event field) into new `wearable` endpoints;
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
spine Ma · Terv · Napló · Boop + "+" (S4 is cancelled); **B3 Napi ritmus** (2026-11-12) then added the offline-first daily loop (check-in, goal, evening close, journal, Boop chat, reminders); **B4 Étel** (2026-11-13) then added the food room (Ma · Receptek · Kamra · Hét, offline-first meal capture, barcode, photos, sensitivities); and the **home screen + area-page kit** (2026-11-16) put a ring of eight area orbs in front of Ma and gave every area one frame to be built from, with **Ma itself becoming a living wall** of at most three cards; **B6 Évad S1** (2026-11-20) turned Terv into **Évad** — the season page with its live consequence preview; B5's remaining parts, B6 S2–S4, B7 and B8 follow. The web PWA keeps running until Boop covers it.

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

- **Emlékeztetők és ébresztők (step 1, `mezo-r36n9.172`, 2026-11-25; spec `docs/superpowers/specs/2026-11-25-boop-ebreszto-widget-design.md`, plan `docs/superpowers/plans/2026-11-25-boop-ebreszto-widget.md`).** The phone can now remind the owner of anything he chooses, ring a real alarm through silent mode, and signal the end of a rest on a locked phone. Built for the **free Apple team** (D7); widgets and the workout card are step 2. Owner decisions D1–D8 are in the spec §2 and `docs/boop-handbook/_dontesek.json`.
  - **Model (`BoopCore/Reminders/`).** `Reminder` (title, time, `ReminderRepeat` once/daily/weekdays, `ReminderStrength` alarm|notification, `ReminderLink` none|`supplement(daypart:)`). `ReminderPlanner` turns the list into a **rolling window**: alarms for the next **7 days**, dated notifications for the next **3 days**, capped at **24** notifications (`notificationCap`; the plan also says which reminders the cap `cut`, and whose ring *today* it cut — `cutToday`); with alarms not allowed an alarm reminder falls back to a notification inside the 3-day window; a pure function over an injected calendar. `ReminderStore` keeps one `reminders.json` per user (`RitmusEnvironment.userRoot(for:)`), plus `BoopReminderSettings` (the built-in reminders' on/off and lead times — bedtime's `bedtimeEnabled` is the single source of truth, default off) in the same `ReminderFile` — a change on the page re-arms at once: `RitmusTriggers` keys its refresh on the settings (`RitmusRefreshKey`) and Ma's bedtime refresh on `BedtimeRefreshKey` (target + on/off + lead), and a bedtime refresh asked for while one is running goes round once more instead of being dropped; `changes` ticks on every edit/reload, write failures are swallowed (memory stays authoritative). An unreadable `reminders.json` is never overwritten silently: its bytes are copied to `reminders.json.corrupt` first (`recoveredFromCorrupt`), and if that copy fails nothing is written over it.
  - **`ReminderHub` (`ios/Boop/Emlekeztetok/ReminderHub.swift`).** The one per-user owner of the live `store`, `scheduler` and `restEnd`, set by `RootView` when the user's folders exist (`ReminderHub.activate` in the `.ready` branch, before the shell). **Only `signedOut` deactivates** (cancels every alarm/notification of the old user and drops the instances); `loading` and `offline` keep everything armed — an offline session must not silence the owner's alarms. A user switch activates the new scheduler and hands the old clear to it as `startingAfter`, so the new refresh queues behind the old clear. A sign-out **retires** the old scheduler synchronously (`retire()`): a refresh queued later by anyone still holding it (an alarm press awaiting the supplement tick, a trigger task) arms nothing; only its clear runs. The notification's „10 perc múlva” and „Kész” act only on a reminder of the signed-in user's store (`ReminderActions.currentStore()`), so with nobody signed in, or another account's leftover notification, nothing rings again with the old title.
   - **`ReminderScheduler` (+ `AlarmScheduling.swift`).** Re-arming through a serialized task chain: `refresh(askPermission:)` clears this app's reminder notifications and re-adds the planned window (`boop.rem.<uuid>|<day>` notification ids; pending `boop.rem.snooze.` one-offs are kept, only sign-out clears them). Alarms go through AlarmKit (`SystemAlarmScheduler`, stateless); the AlarmKit id is a **SHA-256 of `boop.rem|<key>`** (AlarmKit wants a UUID and the key is `<uuid>|<day>`). Which ids are ours, with a fingerprint of what each was armed as (moment, title, button), is kept **per user** by the MainActor-isolated `AlarmIdBook` in `UserDefaults` (`boop.rem.alarms.<userKey>`; the old `boop.rem.alarmIds.<userKey>` list migrates once) — every change is one synchronous read-modify-write, so two schedulers never lose an id. A refresh **keeps an alarm that still stands as planned**, cancels only the ones that left the plan or changed (or that the system lost: they are armed again), and **never cancels an alarm that is ringing right now** (`alertingIds`) — a Health wake or an unrelated edit must not silence it; it is tidied away on the first refresh after he silenced it. Sign-out cancels every remembered alarm, every pending `boop.rem.` request and takes the delivered ones out of Notification Center. Each reminder reports an `ArmState`: `armed(until:)`, `fellBackToNotification`, `failed(String)`, `notificationsDenied` — the page draws it ("Ébresztő helyett értesítés", "Nem sikerült beállítani"); an AlarmKit limit failure marks the row failed without a notification fallback. A reminder whose ring today the cap cut is marked `failed("Ma már nem fér több értesítés")` (one left with nothing armed by the cap: „Most nem fér több értesítés”), and `todayOverflow` puts a warning line above the page's footer. The footer's „Előre beállítva” is honest per kind: `ArmHorizon` keeps the last armed alarm and the last armed notification separately, so with both it reads „az ébresztők dec. 2-ig, az értesítések nov. 28-ig” instead of one alarm stretching the date for every notification. **Permission flow:** the alarm prompt is asked only when an enabled alarm reminder exists, and `ReminderTriggers` (RootView) asks only when the reminder *list* changed — launch, foreground, background wake, ticks and built-in-settings edits never prompt (they refresh with `askPermission: false`).
  - **The alarm's buttons (`ReminderIntents.swift`).** `ReminderSilenceIntent` is AlarmKit's stop action: it logs only. `ReminderDoneIntent(key:)` is the secondary button, **„Kész" / „Bevettem"**, and is the **only alarm path that ticks** (D8: silencing never ticks — an accidental "taken" would spoil the later vitamin ↔ sleep/form comparison; no snooze on the alarm screen). Both are `LiveActivityIntent`s that run in the app process without opening it, with `isDiscoverable = false` (not offered in Shortcuts or Spotlight). **A `.custom` secondary button does not dismiss the alert** (on-phone probe 2026-11-26: the intent ran and recorded, the full-screen alarm kept ringing), so `ReminderDoneIntent` goes through `ReminderActions.alarmDone(key:alarms:done:)`: it first **stops the ringing alarm** (`AlarmScheduling.stop(id:)` → `AlarmManager.stop`, falling back to `cancel`; the id is `ReminderOccurrence.alarmId(forKey:)`, the same SHA-256 derivation the arming used), whatever the key, then ticks.
  - **Notifications.** Category **`boop.rem`** with two actions, **Kész** and **10 perc múlva**; `SystemReminderCenter.scheduleOnce` sets the category and `userInfo["key"]` for ids with the `boop.rem.` prefix. A snooze is a `boop.rem.snooze.<rid>` one-off whose **route query carries the originating key** (`boop://emlekeztetok?key=…`, `ReminderActions.snoozeRoute`/`key(inRoute:)`), so a snooze across midnight still ticks the original day; ticking cancels the pending snooze; a body tap strips the query before routing. `ReminderActions.toggleTick` is the one tick path for the page, the Ma fold and the intents (untick stays reminder-only).
  - **`HeadlessContext`.** When an intent or a notification action runs with no live environment (app killed), `HeadlessContext` builds the minimum — the user's reminder store, `supplements-taken.json` and an outbox that only writes `queue.json` — cached per (user, base) and invalidated by `ReminderHub.deactivate`. It also caches **one headless `ReminderScheduler`** per user, so back-to-back presses queue on one chain; when the UI comes up, `ReminderHub.activate` retires it (`HeadlessContext.handOver()`) and starts the live scheduler after its queued work. `HeadlessContext.activeScheduler()` (the live one, else the headless one over the re-read file) is what a **HealthKit background wake** refreshes — on a cold launch there is no scene and no hub, and those wakes are what keep the 3-day notification window topped up on a phone left alone. `ReminderActions.done(key:)` takes the live branch (and logs a capture failure) or the headless one.
  - **The supplement tick (D1).** `OutboxKind.supplementTick` (appended, in the same sender group as the food writes) carries a `SupplementTickPayload` (`day`, daypart group): a **one-way** offline write of "this supplement group was taken on this day", shared by the Étel room's supplement list and the alarm's „Bevettem". `SupplementTakenStore` (`supplements-taken.json` per user, 14-day prune, migrates the old `UserDefaults` flag once) is the phone-side "taken" state; `SupplementTickHub` (`Etel/EtelRoom.swift`) binds the user's store and capture to every `EtelStore`; an `EtelStore` without a hub (previews, tests) falls back to the direct `FoodClient` write. **An early tick (the room, before the alarm rings) cancels that day's ring.** A reminder's „Kész” / „Bevettem” files the intake on **the occurrence's day** (from its key, `SupplementPress`), not the press day: clearing yesterday's notification the next morning logs yesterday's intake at yesterday's ring time and ticks only yesterday's linked occurrence, so today's alarm still rings (D8: the data must say when it happened). The live path (`captureSupplementTick(daypart:at:day:)`) and the headless one (`HeadlessContext.Parts.tick(_:)`) do the same. Undo in the room unticks the linked reminder; undo has no server op beyond the protocol, so an unknown-undo says so.
  - **Screens.** The **Emlékeztetők** page (`EmlekeztetokPage.swift`, rows in `ReminderRows.swift`, `ReminderLine` for the time column), the edit sheet (`ReminderEditSheet.swift`; the supplement-linked variant shows the daypart and fixes the title), the **Ma fold** (`MaReminders.swift`, under the wall: today's reminders, tickable), the **10th door of the "+" sheet** (`CapturePick.reminder` — since 2026-11-26 it opens the Emlékeztetők *page*, so the page is reachable on a day with no reminder too (the Ma fold hides then); a new one is made with the page's own "+"; the sheet's detent was raised to 760 and it scrolls so the door is reachable at 667 pt), and the **„Emlékeztess" switch** on every supplement row of the Étel list sheet (creates/removes the linked alarm reminder, default 08:00 ÉBRESZTŐ). The switch shows the reminder's arming line under it (`ReminderArmLine`: a denied permission or a failed arming is told at the vitamin alarm's main door), and its time wheel saves once it rests (`Debouncer`, 0.6 s; flushed when the sheet closes) instead of re-arming on every tick. When a successfully loaded protocol no longer has a group, its linked reminder is deleted (`ReminderStore.removeLinked(keeping:)`, called by `EtelStore` after a protocol read) and the page says so once (`ReminderFile.notices`, cleared when the page closes); a failed read, offline or an empty group list never deletes anything. A tick of a linked reminder on the page also takes the supplement.
  - **Install expiry (`InstallExpiry.swift`, notification id `boop.expiry`).** A free-team install stops opening after seven days and its alarms stop with it; the date is read from `embedded.mobileprovision` (nil on a simulator or App Store build), and one notification „Holnap lejár a Boop telepítése" is queued for 10:00 the day before, re-queued on every launch/foreground.
  - **Rest end (`Edzes/RestEndSignal.swift`, notification id `boop.rest`; D5).** A serial task chain armed from `EdzesStore.update/endWorkout/attach` and the scene phase: **vibrate** (default) = a `boop.rest` notification at the exact `restEndsAt` (`ReminderCenter.scheduleAt`), **alarm** = an AlarmKit alarm with a fixed id (`scheduleRest`/`cancelRest`), deliberately outside the reminder family (not in `AlarmIdBook`, so the reminder scheduler never touches it); if AlarmKit refuses it falls back to the notification, and a denied alarm authorization stays on vibrate with a Hungarian note. The mode is per user in `UserDefaults` `boop.restEnd.<userKey>` (`RestEndMode`), chosen in `RestEndSheet` from the bell action „Pihenő vége" in the Edzés room header; `willPresent` suppresses `boop.rest` in the foreground.
  - **Ids and the 64-notification budget.** iOS keeps at most **64** pending local notifications per app. The budget is spent as: the reminder window (≤24 dated + repeating built-ins), at most a few snoozes, `boop.expiry`, `boop.rest`, and the older check-in/close/bedtime requests; the planner's 24-cap is what keeps the total below 64. Alarms are not notifications and do not count.
  - **Not in step 1:** widgets (Következő, Mai nap, Napközbeni kérdés, Lock Screen line), the Lock Screen workout card / Dynamic Island, no iCloud sync of reminders, no location reminders.
- **Widgetek és edzéskártya (step 2, `mezo-r36n9.172`, 2026-11-27) — the workout Live Activity.** A new widget extension target **`BoopWidgets`** (`io.mrkuhne.boop.widgets`, synchronized group `ios/BoopWidgets`, Info merged from `ios/BoopWidgets-Info.plist`, compile condition `BOOP_WIDGETS`, links `BoopDesign`, embedded in the app; free team, no App Group). A shared synchronized group **`ios/BoopLive`** is compiled into both targets: `WorkoutActivityAttributes` (ref + day name; state = phase set/rest/technique/debrief, exercise, set i/n, done/total, target kg × reps, `restEndsAt`/`restTotal`, `canLogHere`) and three `LiveActivityIntent`s — **Kész** (`LogPlannedSetIntent`, logs the planned set), **+15 mp** (`AddRestIntent`), **Tovább** (`SkipRestIntent`) — whose `perform` is compiled out of the extension (`#if !BOOP_WIDGETS`) and runs `WorkoutLiveActions` in the app. `ios/Boop/Edzes/WorkoutActivityController.swift`: `WorkoutActivityState.state(_:now:)` builds the card from the `WorkoutSession`; one serial chain applies it over ActivityKit (one card per workout ref, others ended; stale date = rest end → „Lejárt a pihenő"); `WorkoutLiveActions` acts on the live `EdzesStore` when the room exists, else on the last signed-in user's `workout.json` (a killed app is launched in the background for the intent). `EdzesStore.update`/`signalRestEnd` sync the card; `RootView` ends it on sign-out, user switch, or a missing workout file. `NSSupportsLiveActivities` is in `Boop-Info.plist`. **Card size:** the Lock Screen gives a Live Activity at most ~160 pt — the first cut (padding 16, serif 22, countdown 34, 46 pt pills) clipped the header and the buttons; sizes in `WorkoutLiveActivity.swift` are budgeted to fit. Simulator review: `-previewLiveActivity rest -preview shell`, then lock (README flag table). Tests: `BoopTests/WorkoutLiveActivityTests`.
- **Widgetek a kezdő- és a zárolt képernyőn (step 2, `mezo-r36n9.172`, 2026-11-27).** Three widgets in `ios/BoopWidgets/DayWidgets.swift`: **Következő** (`systemSmall`: the next open thing — plan row or unticked reminder — big clock, serif title, „még 1 ó 20 p”, sky of its hue), **Mai nap** (`systemMedium`: the next three plan rows left, today's reminders right with tick circles — open ones first, then done ones, three at most) and **Boop · Következő** (`accessoryRectangular` + `accessoryInline` on the Lock Screen). **Free-team probe (on the owner's phone, 2026-11-27):** the free Apple team **refuses App Groups** (the provisioning profiles carry an empty group list), but a **shared Keychain access group `$(AppIdentifierPrefix)io.mrkuhne.boop.shared` works** — so the transport is a Keychain item, not an App Group file (spec §7.1 fallback). New package target **`BoopShared`** (pure, linked by the app, the extension and BoopCore's builder): `WidgetSnapshot` (writtenAt, owner, day, hasPlan, items with short title + hue, today's and tomorrow's reminder occurrences), `WidgetDay` (state normal / stale / empty, `upcoming`, `next` — an unticked reminder stays next for an hour past its time —, `tomorrowFirst`, the timeline: now, every time ahead today, an hour after each reminder, a ten-minute grid, midnight) and `SharedKeychain` / `WidgetSnapshotStore`. BoopCore `WidgetSnapshotBuilder` turns `DayPlan.rows(brief)` + the reminder file into a snapshot. The app's `WidgetSnapshotWriter` (`ios/Boop/Emlekeztetok`) writes it when the brief arrives, on `store.changes` and on scene phase (RootView `WidgetTriggers`), rebuilds only the reminders after every `ReminderActions.done` / untick (the plan rows last written are kept when they are today's and the same owner's), skips a write that changes nothing a widget shows, and **clears it on sign-out** (`ReminderHub.deactivate`). The owner field means another account's plan is never shown. **Ticks:** `WidgetReminderTickIntent` (`ios/BoopLive`, a `LiveActivityIntent`, `perform` compiled out of the extension) runs `ReminderActions.widgetTick` in the app process — an open occurrence goes through the alarm's „Kész” / „Bevettem” path (supplement intake included), a ticked one opens again — so no tick queue is needed. **Stale:** snapshot not today's (or no plan) → reminders only + „Nyisd meg a Boopot a mai tervhez”; **empty:** „Mára nincs több teendő” + tomorrow's first reminder. The Napközbeni kérdés widget of the spec is **deferred** to its own ticket (pain and craving questions do not fit a number grid, and the multi-step save needs a headless check-in path). Simulator review: `-preview shell -previewMaReminders YES` writes a snapshot from the sample reminders; add the widgets from the Home Screen editor (the Simulator's Lock Screen editor does not open, so the accessory line is checked on the phone). Simulator trap: the Mai nap clock column must size to its text (`fixedSize`) — a fixed 46 pt width truncated „17:…” and wrapped „21:3 / 0”. Tests: `BoopSharedTests/WidgetDayTests`, `BoopCoreTests/WidgetSnapshotBuilderTests`.

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
  - **Place switch (HISTORICAL — removed 2026-11-28 with the barless home):** the places share **one painted landscape** (`NKBackdropPanorama`, three
    screens wide, no seams): switching pans left/right by bar order with the sky cross-fading (0.95 s), a sliding
    nav pill and a sequenced content fade (owner OK 2026-11-10).

- **The spine (B2 Gerinc, 2026-11-11, `mezo-r36n9.12`) — HISTORICAL, replaced 2026-11-28 by the barless home (see the top note and §9):** one home, four places. `ShellView` hosts a glass bar
  (`NKSpineBar`) **Ma · Terv · Napló · Boop** (the second place is **Évad** since B6 S1, 2026-11-20) with icons only (names are accessibility labels; Boop's icon is a small
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
  - **Étel · Receptek tab (B4 Task 12)** (`Etel/{EtelReceptek,RecipeDetail,RecipeImport,RecipeReviewBody,RecipeWorkshop,CookedCapture}.swift`): the new-recipe rows („Ezt főztem" first since `mezo-r36n9.63`, link/text, photo, Receptműhely) and the library, **one recipe per row** (owner, 2026-11-13: a 44 pt thumbnail, the full name with its sensitivity badge beside it, kcal / protein / servings in full underneath — never a card grid). Every route ends in the same review (`RecipeReview`, pure, tested): a doubtful row (server `needsReview` or confidence ≤ 0.6) must be confirmed or taken out before the save is enabled, an unmatched row blocks nothing but is visibly left out of the saved recipe (the server cannot save a line with no food, and it does not enforce that a doubtful row was looked at — the review is the enforcement). The review shows the owner's allergen hits per row and in a summary before the save (rows with no allergen data say "nincs adat"), and when two or more rows and a quarter of them would be left out it says so plainly and makes him confirm. A reviewed recipe goes through `FoodClient.createRecipe`; the workshop's estimate lines are left out the same way. The detail sheet shows the owner's own photo (add/replace/delete via `/api/recipe/{id}/image`; `NKThumb`'s glyph stays the fallback), ingredients, steps, the template score, the log history and a one-tap *Megeszem 1 adagot* (a recipe `DraftItem`, idempotent per tap session). An absent allergen key reads "nincs adat", never "mentes".
  - **Étel · Kamra and Hét tabs + Szokásos (B4 Task 13)** (`Etel/{EtelKamra,PantryItemDetail,PantryAdd,EtelHet}.swift`): *Kamra* = four add routes (vonalkód via the existing scanner, link via `scrapePantryItem`, címkefotó via `photoExtractPantryItem`, kézzel) that all end in ONE confirm (`PantryConfirm`, editable per-100 g facts; a macro left empty stays unknown, a doubtful reading holds the save until "Átnéztem"; saved by `importPantryItem`, or `createPantryItem` for typed foods), the shelf with search + category chips + the catalog behind the search (`addPantryItemFromCatalog`), and an item sheet (per-100 g facts, NOVA, sensitivity lines where a missing key reads "nincs adat", provenance; *Megeszem* reuses the Task 11 serving confirmation, in grams). `IngredientResponse` gained `allergens` + `barcode` (additive) so shelf rows can be read against the owner's rules. No prices, stock or expiry. *Hét* = `getFuelWeek` ending today: kcal and protein bars against the target waterline (`WeekBars` gained `lineLabel`/`marked`), day rows (training room, skipped kcal, kímélő = marked and not judged, excluded from averages, today never joins them), per-day scores from each day's own meals, week totals, tap a day for its numbers and meals. *Szokásos* = the composer's fifth entrance over the new `GET /api/fuel/usuals` (the existing `UsualMealRanker`; each row also carries the latest occurrence's own lines, `mealId` and summed `kcal`, so a choice opens that meal as it was eaten with no model call — and a row whose lines cannot be read falls back to the name through the ordinary draft, with a visible line saying it was re-estimated, not copied). A failed day read on *Hét* is said ("a pontszám most nem jött meg"), never a silent gap in the score average.
  - **Étel · settings, skipping, kímélő mode, supplement list (B4 Task 14)** (`Etel/{SensitivitySettings,DietSettings,RhythmSettings,SkipSheet,SupplementGroups,EtelSettingsKit}.swift`; the settings block is Kamra section 3 "BEÁLLÍTÁSOK" (`EtelSettingsList`), "Kihagyom" sits on an open Ma window, "A lista szerkesztése" under the supplement groups). *Amit kerülök* = `GET/PUT /api/sensitivity`: the EU-14 chips each at allergia / intolerancia / kerülöm, free-text words (lowercased like the server keeps them), and the NOVA rule as a switch with a 1–4 threshold — where the owner records lactose intolerance (key `milk`) and "nothing above level 2"; rules that could not be read are never shown as an empty editable list (a save would overwrite the real profile), and a key that is not set reads "nincs megadva", never "free of". *Étrend-beállítások* = preset or custom split (a custom split must sum to 100,0 %), protein tier, water, fibre, with the live preview over `POST /api/diet/settings/preview` (debounced; a preview of an older draft is dimmed, never shown as current; a failed preview does not block saving); saving re-evaluates the active goal server-side. *Napi ritmus* = `fuel_settings` (3–6 occasions, default 5 = "3 étkezés + 2 nasi", owner decision 21, and the caffeine cut-off). *Kihagyom* = the web chips (Nem vagyok éhes / Nincs időm / Gyomorrontás / Beteg vagyok / Úton vagyok / Egyéb + free text) → `PUT /api/train/skips` kind MEAL, `sessionKey` `<slot>#<n>`, `plannedKcal` from the window's budget, so the kcal leave the day. *Kímélő mód* = `PUT/DELETE /api/train/recovery` (ILLNESS / STOMACH → the day has no kcal target and is not judged): on from the skip sheet or the settings list, off in one tap (a period started today is discarded, an older one ends with the BETTER check-in); an open period of another kind (e.g. injury) is never overwritten by a tap, and a GUIDANCE day offers no Kihagyom. *Kiegészítők szerkesztése* (owner decision 18) = new supplements through `createPantryItem` (kind supplement) + `POST /api/fuel/protocol/items`, re-dose through `PATCH`, remove through `DELETE`; the one-tap group tick reads the protocol fresh, so it ticks only what is left. The daypart groups now use the server's real keys (`wake|breakfast|pre_workout|lunch|post_workout|dinner|evening|bedtime`) in day order with Hungarian names (the older coarse keys still read).
  - **"+" capture sheet** (`Capture/CaptureSheet`): the food chips are real since B4 (Fotó · Szöveg · Vonalkód · Recept · Kamra — and **Ital** since 2026-11-24, `mezo-r36n9.160` — open the meal composer at the matching entrance, `CapturePick.mealStart` → `Entrance.openingStage`). **Since 2026-11-24 (`mezo-r36n9.154`, decision #98) it is the whole web quick log:** a three-column grid of nine doors — Víz · Kiegészítők · Edzés indítása · Sport · Súly · Check-in · Napló · Alvás · Kiadás (`CaptureSheet.doors`, every one real; `CapturePick.quick(QuickLog)` / `.area(.mozgas)` / `.cover(.checkin)` / `.penzExpense`). The quick log's own sheets live in `Capture/QuickSheets.swift`: **Víz** (five amounts, `FoodClient.water` straight to the server like the room), **Kiegészítők** (its own `EtelStore` light-loaded, the room's `toggle(group)`), **Sport** (the server's ten sports as `QuickSport`, minutes on `NKScale`, RPE stepper → `OutboxKind.sportSession`), **Súly** (`NKScale` 0,1 kg from the last typed weight → new `OutboxKind.weightLog` → `logWeight`), **Alvás** (two time pickers, `sleepDurationHours`, quality → new `OutboxKind.sleepLog` → `logSleep`, added to the generator filter), **Napló** (a line at any hour → `OutboxKind.journal` + a pending `LedgerJournal` on the day). "Edzés indítása" asks `RitmusRouter.openRoom(.mozgas)`: the shell lands on Ma and `KezdolapView` opens the Edzés room from the ring. Each sheet hangs on the shell (`ShellView.quick`), opens after the "+" sheet has gone, and closes with its toast. The home screen carries its own **Rögzítés** button (under Boop's line, right, above the bar; `\.openCapture`) to the same sheet. **Since 2026-11-24 (`mezo-r36n9.157`, decision #100) that capsule was replaced by five quick doors (themselves removed 2026-11-28, decision #133 — the floating "+" and the full sheet are the only entrance now):** under Boop's line sat **five glass quick doors** — Étkezés · Víz · Súly · Check-in · Napló (`KezdolapView.doors`, 46 pt circles with the door's glyph and a 10 pt mono caps name, evenly spread) — each opening its sheet **at once** through the `\.openPick` environment the shell provides (`ShellView.handle(_:afterSheet:)` is the one switch both the "+" sheet and the doors go through; from a door there is no sheet to wait for). The bar's "+" keeps the full nine-door sheet.
  - **Every sheet closes with a tap (`mezo-r36n9.156`, decision #99).** `NKSheetFrame` carries a glass close circle top-right (`NKCloseButton`: a drawn hairline cross — no SF Symbol — 36 pt to the eye, 44 pt to the finger, environment `dismiss`, a11y „Bezárom"; `closable: false` opts a frame out). The drag stays. The second half of the owner's report („lehúzom és frissül") was the Étel room's `.refreshable` sitting **outside** its six `.sheet`s: the refresh action flows through the environment into every scrolling sheet below, so a pull at a sheet's top reloaded the room instead of dismissing — it now wraps the page alone (§9).
  - **The Súly room (`mezo-r36n9.158`, decisions #101–#102; spec [`2026-11-24-boop-suly-orb-gyorsajtok-design.md`](../superpowers/specs/2026-11-24-boop-suly-orb-gyorsajtok-design.md), plan [`2026-11-24-boop-suly-orb-gyorsajtok.md`](../superpowers/plans/2026-11-24-boop-suly-orb-gyorsajtok.md), spike shots `docs/superpowers/specs/assets/suly-orb-gyorsajtok/`).** The ring is **nine**: `Area.suly` between Energia and Forma in the new gold `Hue.suly` world (sky `3A2606 · C9901E · FFE9A8`); the orbs shrink with the ring's side (56 / 52 under 400 pt / 46 under 360 pt) so no name touches its neighbour. The orb's number is **`sulyPaceScore`** (`BoopCore/Suly/SulyLogic.swift`): the trend's `last4wRateKgPerWeek` ÷ the season's planned `weight.kgPerWeek` — 100 at the planned pace, 50 at half, 0 standing still or the wrong way, faster costs half; maintain = distance from the band (80–100 inside); nil → „–" without a season, a trend, or with `dataSufficiency == none`. **`SulyStore`** (`BoopCore/Suly/SulyStore.swift`) reads five things as `Task {}` handles — the season overview (`EvadClient.overview`, 404 = no season, still an answer), the trend and the weigh-ins (`SulyClient` over `RawJSONClient`: `GET /api/biometrics/weight/trend`, `GET /api/biometrics/weight`), the profile's height (`GET /api/biometrics/profile`, a failure only costs the BMI) and 90 days of `bodyFatPct` / `leanBodyMass` samples from the app's `HealthReader` — into one `SulySnapshot` cached as one (`ServerCache` "suly/snapshot", 14 d; offline shows it with its age). `SulyRoom` (`Suly/SulyRoom.swift`, tabs in `SulyTabs.swift`, faces in `SulyFaces.swift`) is `NKAreaPage(hue: .suly)` with **Ma** (the highlight: today's weigh-in and the trend; stats most (trend) · a cél · heti ütem „terv x"; „A súlyod" = the season's series + projection with the target line, else the trend's last eight weeks — `sulyCurve`; eddig lement · van még hátra · hetek; „A hét mérései" — `sulyThisWeek`; „A cél" row → Évad; the rule as an info sheet), **Test** (testzsír · izomtömeg · BMI — `sulyLatest` ≤ 30 d, `sulyBmi`; 90-day `NKCurve`s; its own drawn **`body-cream`** tab glyph, owner: „a test kapjon saját új ikont") and **Napló** (`sulyWeeks`: EZ A HÉT · MÚLT HÉT · „NOV. 9–15.", the week's average, 12 weeks). The head's words come from the season's `status` (`sulyHead`: on_course · slower · faster · in_band · out_of_band · no_data · no season → „Nincs évad", pointing at the Évad). `RitmusEnvironment.weightTick` (bumped by `captureWeight` and when a `.weightLog` item lands) re-reads the orb and the room. Route: `-previewHome suly`, `-sulyTab Test|Napló`, `-sulyState …` (`Suly/SulyPreview.swift`). Absorbs the phone half of `mezo-r36n9.28` (Testösszetétel).
  - **Account sheet** (`Shell/AccountSheet`, opened from the avatar on Ma's title row, accessibility label "Fiók"): the account card with the confirmed sign-out
    (the old Én account section, `EnAccountSection`).
  - **Placeholders:** Terv (`Terv/TervView`) was an honest frame until B6 — replaced by the Évad page on 2026-11-20 (see **Évad** below); Napló and the Boop tab became real in B3 (see **The daily loop**).
  - **Presentations stay at page level** (§9): the detail sheet and miért? hang outside the room stack, so they reach Ma and every room.
  - **DEBUG flags:** `-previewHome`, `-previewOpen`, `-previewPhase`, `-previewDrill`, `-previewWhy` — see `ios/README.md`.
  - **Known gaps:** between 00:00 and 04:00 Este still shows on the *day* sky (`isEvening` is hour ≥ 18).
  - **Hypnogram once** (owner, 2026-11-12): the Alvás room draws the night's stages only in section 1
    (`roomShowsHypnogram`); the path's night card appears only when the night has no stages, to say so.

- **The daily loop (B3 Napi ritmus, 2026-11-12, `mezo-r36n9.13`; spec [`2026-11-11-boop-b3-napi-ritmus-design.md`](../superpowers/specs/2026-11-11-boop-b3-napi-ritmus-design.md), plan [`2026-11-11-boop-b3-napi-ritmus.md`](../superpowers/plans/2026-11-11-boop-b3-napi-ritmus.md)).** The owner's reflection loop died in October because there was no internet while travelling, so **everything works offline first**: a capture is saved on the phone, shows at once, and syncs by itself later; only Boop's own sentences and answers wait for the network, with one quiet line. Four moments a day: **reggel, délben, délután** (check-ins) and **este** (the evening close, which *is* the evening check-in).
  - **Check-in** (`Ritmus/CheckinFlow`, `CheckinView`, `CheckinDone`; five core items every time + ONE question of the day from the plan engine, "Most csak ennyi" after the first answer): each item is answered by **swiping the orb up/down** (soft haptic per step, starting at the last answer of the day, so "unchanged" is one tap), then *Tovább*. The slot (reggel / délben / délután) is decided at the moment of saving. Saving freezes the **watch snapshot** (heart rate, HRV against the 14-day usual, steps, sleep) and the payoff is **a dot on the day's energy curve** next to Boop's dashed prediction, tappable for the answers and the snapshot (`EnergyCurveCard`, `CheckInDetail`); the dots also show in Ma · Napközben. After a check-in Boop adds one line (cheap tier, online only) and the owner may add a spoken or typed note.
  - **Goal of the day** (Ma · Reggel, `Nap/MaRitmus`): "Mi ma a legfontosabb?" — typed, spoken, or one tap on a suggestion (calendar-derived and earlier overdue goals, `GoalSuggestions`), one personal goal per day; Boop's own plan goals (the day's session, ...) tick **automatically from the data** (`DayPlan.goals` met → the brief's `planGoals`). A missed goal is never marked.
  - **Esti levezetés** (`Ritmus/EsteFlow`, `EsteView`): a one-minute close — the day's rating (1–5 orbs), the evening energy, *sikerült / részben / nem* for the goal, then **Mesélj**: the journal by voice (on-device Hungarian recognition when available; otherwise the recording waits in the outbox and the server transcribes it later) **or typed**. *Lezárom a napot* writes the day, then Boop answers with one sentence. A close opened before 04:00 belongs to the previous day. Re-closing a day replaces the earlier close.
  - **Boop tab** (`BoopChat/BoopTabView`, `BoopCore/Ritmus/ChatStore`) **knows today**: a "Boop látja · most" chip strip (the exact facts the model is given) and up to three ready questions ("miért vagyok fáradtabb, mint tegnap?"), then a plain chat; today's conversation is created on the first question (channel `boop`, titled with the date). Offline a question waits as a queued bubble; a refused one shows *Újra*.
  - **Napló → Nap › Napok** (`Naplo/NapokTab`, since 2026-11-28; was `NaploView`, `BoopCore/Ritmus/NaploDays`): the last **14 days** — today and the previous six always (an empty day is a row, 2026-11-24), the older ones with content — energy line with the check-in dots, the goal and its outcome, the day's close (`Ritmus/ClosedDayCard`), the journal text — a day opens in a sheet (with its PÓTLÁS block and A NAP SORAI since `mezo-r36n9.159`); a day closed on the web shows too (no rating when the web evening had none).
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
  Nap page, which was **not replaced — it moved one level in**. (At the time Pénz and Levél were not built and sat
  faint; both are live since L5 / 2026-11-21 — Pénz as a *live* ring orb only since 2026-11-24, `mezo-r36n9.153`.) **Three orbs do not read the brief's score (2026-11-24, decisions #96–#97):** Étel shows the Étel room's own number (`etelDayPoints` of the day the home reads with `EtelStore.loadDay`), Pénz the week's remaining as a share of its budget (`penzWeekShare` of `PenzStore.allowance`), the day its fullness; and a "learning" brief blanks **Forma alone** (`visibleScore`, `mezo-r36n9.152` — before, every orb and hero went "–" whenever Forma was unknown). The home re-reads the two numbers on arrival, when the app comes back, when a room closes, and on the meal / expense ticks. **The day has its own orb at the top** (decision #41, 2026-11-16, `mezo-r36n9.55`): it carries
  no score — nothing scores a day — but fills with **how full the day is** (`dayFullness`, from the brief's
  `calendar.busySlots`) and opens **the day's page** (`KezdolapRoute.day`) — the same page the ring's centre opens,
  since the day page itself became the Élet spike's Ma screen (`mezo-r36n9.56`, below). The
  "A napod" folded row inside it stays; an orb is another way in. Eight is also the better circle: seven points never
  sit symmetrically, eight are four cardinal plus four diagonal, at the cost of 6 pt of orb (62 → 56) to keep the
  labels apart at 375 pt. **The ring is full at eight** — a ninth area needs a designed answer, not another enum
  case (candidates in the spec §3). `KezdolapView` is the Ma place's root (`Kezdolap/`), and it is where the brief is fetched and
  kept fresh (`MorningTriggers` moved here from `NapView`). Tapping "Ma" in the bar while Ma is open brings the ring
  back from anywhere (`\.kezdolapHomeReset`). **The map it settles:** the ring does the job the Terv area grid was
  invented for, so the bar keeps its four places and **Terv becomes his plan** (since B6 S1 named **Évad**), not a second area menu — this
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
  acted on or rung; the cap is in the function, not a setting. **The ring is shipped since 2026-11-21**
  (`mezo-r36n9.39`, `WallNotifier`, see **Levél** below): until then `wallNotifications` existed but nothing called
  it, so no wall card ever rang. It is **scheduled only when the app is opened** (no background refresh, no server
  push until the paid team, `mezo-r36n9.19`), and it serves **every** `.expires` source — Étel and Edzés too.
  **The areas join by registering a `WallSource`** (`WallRegistry`): Étel hands in the closing window, the
  supplement group and the last meal (the server's „Következik: …” tip card was dropped 2026-11-21, `mezo-r36n9.135`); the brief hands in today's session and the strongest
  observation; since B6 Évad S2 (2026-11-21) the season hands in its learned-expenditure proposal and its ending
  (`WallSources.evad`, see **Évad** below); since 2026-11-21 **Levél is the first life area on the wall**
  (`WallSources.level`: the deadline or deal about to expire, and *Megjött a reggeli posta*). **Pénz never registered
  a source** — it is not on the wall. Each area adds itself with one line and no change to the engine or the
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
  treatment (decision #12; its no-card part is **retired by #119, 2026-11-27** — pages are being moved to hero + glass cards): no card around the stats, the curve, the composition or the rows — `NKBare` gives them a
  hue tick and a label, and carries that block's own loading and failed-with-"Újra" state (`NKBlockState`), because
  every section of a room loads and fails on its own. `.nkStale(NKStale(age:loud:))` marks a block drawn from older
  data. The page returns to the tab row on a tab change, and only when it is below it. **`EtelRoom` is the proof:**
  it moved onto `NKAreaPage` with every sheet, flow and section unchanged. A full-screen flow with its own chrome
  (the workout player, the check-in, the evening close) stays a page-level cover outside this system.
  Review: `-previewKit YES` renders every block and every awkward state on one page (`Kezdolap/KitGallery.swift`).
  **Hero + glass-card pieces (`mezo-r36n9.197.1`, 2026-11-28, decision #119; spec
  [`2026-11-27-boop-edzes-ujratervezes-design.md`](../superpowers/specs/2026-11-27-boop-edzes-ujratervezes-design.md) §5.1).**
  New kit files, additive: `NKSectionCard` (`Napkelte/NKSectionCard.swift` — the `NKBare` head on `nkGlass(24)`,
  padding 16/12, its own `NKBlockState`; trailing `NKCardTrailing` `.none | .text | .menu(AnyView) | .chevron`;
  optional `onOpen` makes the whole card a tap target via a gesture so inner buttons keep their taps), `NKMoreMenu`
  (the 44 pt „…" system menu, a11y „Továbbiak"), `View.nkInnerCard(radius: 20)` (fill white 0.06, stroke 0.08 — the
  no-glass-on-glass rule), `NKPagedHero` (`Napkelte/NKPagedHero.swift` — radius 28, 1–3 swipe pages with capsule
  dots; `showsDots(pageCount:)` is false for one page; `stacks(accessibilitySize:voiceOver:)` puts the pages under
  each other at the accessibility sizes and under VoiceOver) and `NKCardActions` (`Napkelte/NKCardActions.swift` —
  one primary capsule, white or `.hue(_)`, plus at most `maxQuiet = 2` quiet ones; a row via `ViewThatFits`, a
  column at large type where titles wrap between words). `NKBare` gained an internal `trailingView:` init for the
  menu/chevron slot. `Tokens.swift`: `Hue.mozgas.roomSky` = `[0x5C7FC0, 0xF4BC8E, 0xFFEFCB]`, `roomTop` `0x34507E`
  (the Edzés room's lighter sky; the Mozgás orb elsewhere keeps `sky`/`top`). **Étel Ma is the proof:** its private
  `card()` and hero moved onto `NKSectionCard`/`NKPagedHero` with pixel-identical simulator shots (normal, XXXL,
  kímélő day). Review: `-previewKit YES -previewKitCards YES` shows only these pieces on a plain page.

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
  The gaps that remain, said out loud: three areas have no mood photo (`mezo-r36n9.60`), Levél has no
  glyph of its own (a book stood in; Pénz got its coin with L5, Levél its envelope `e-level` on 2026-11-21), and
  Edzés's three deeper tabs wait for B5.
- **The Levél area (L1 + L2, `mezo-r36n9.38` + `.39`, built 2026-11-21 — one release; spec
  [`2026-11-21-boop-level-posta-design.md`](../superpowers/specs/2026-11-21-boop-level-posta-design.md), plan
  [`2026-11-21-boop-level-posta.md`](../superpowers/plans/2026-11-21-boop-level-posta.md); backend
  [`mail.md`](mail.md)); deploy and the phone install were pending at the time of writing.**
  Levél left `AreaRoom`'s planned tab for its own room `ios/Boop/Level/LevelRoom.swift`, routed from `NapView.swift:69-71`
  the way `PenzRoom` is (`AreaRoom` lost only its `.level` branches). Tabs **Ma · Figyelt · Szabályok · Fiókok**, warm
  `NKAreaPage(hue: .level)`; the area has its own envelope glyph `e-level` (a kit addition, also the ring's orb glyph)
  and the kit's `NKHighlight` gained an additive `badge` (the score chip). Every number is measured by the server.
  - **Ma** (`LevelMa.swift`): head verdict + sentence from `levelHead` (*"Két dolgot nézz meg"* — digits for arrived /
    handled, words for worth-a-minute; "ma" when the last run was at/after 15:00 Budapest, else "reggel óta"); the
    highlight (`levelHighlight`: best deal by score → earliest `validUntil` → id, or the nearest due-today/tomorrow
    deadline; flagged or unknown-screen items skipped); `NKStatRow` arrived · handled · worth a minute; the
    `NKHeatStrip` of 12 two-hour slots; people and sensitive rows first (sensitive = sender only); **Határidős** rows
    sorted by date with *lejárt / ma / holnap / weekday* marks (`levelDeadlineRows`, Budapest calendar); **Csomagok**
    (one row per parcel, state words); **Akciók és lehetőségek** as `LevelDealCard`s with the score chip, the one-line
    *miért*, **érdekel / nem érdekel** (optimistic, reverted on failure, one in flight per item) and **Megnyitás a
    Gmailben**; **A többi** as one row per category that unfolds to up to 20 lines. A rules-only day carries
    the note `levelRulesOnlyNote` ("ma már nem pontoztam tovább" for the cap); a score already given still shows on such
    a day. A flagged item shows a warning and never rings. Not connected → a plain note pointing at Fiókok.
  - **Figyelt** stays `NKNotLiveYet` with its existing line (L3).
  - **Szabályok** (`LevelSzabalyok.swift`): *Amit gép soha nem olvas* (seed + own senders, add / remove), *Amit mindig
    megmutatok*, *Amit csendben eltészek*, the proposal row (*Igen, tedd félre*), one sentence on when the phone rings.
    Edits go through `LevelRules.ownerRequest` → `store.saveRules`; removal matches case-insensitively.
  - **Fiókok** (`LevelFiokok.swift`, rewritten 2026-11-25 for Google sign-in): **not connected** → the **„Belépés Google-lel”**
    button, two lines (what Boop sees — Beérkezett + Spam, read-only — and what it never does: send, delete, mark read)
    and the optional iCloud-forwarding line; **unconfigured** (`GET` returns `googleClientId: null`) → a plain note that
    setup is pending, no button; **connected** → address, last run, count, state in words; *Frissítés most* (a 429 shows
    "Most néztem át — pár perc múlva újra próbálhatod."); **auth_failed** → „A Google visszavonta a hozzáférést — lépj be
    újra” with the button (the Levél head points there, no ring). Sign-in is `GoogleSignIn` (`ASWebAuthenticationSession`,
    PKCE from `GooglePKCE`/`GoogleAuth` in BoopCore, redirect `com.googleusercontent.apps.<id>:/oauth2redirect`, scopes
    `gmail.readonly openid email`, **no SDK, no new package**); the phone posts `{code, codeVerifier, redirectUri}` once via
    `LevelStore.connectGoogle` (outcomes connected / refused / notConfigured / offline / failed) and never stores a token.
    **Lecsatolás** (revokes at Google) sits behind a confirmation dialog presented at page level in `LevelRoom` (§9 rule: no
    dialog inside scroll content). The old six-step mirror guide (`levelGuideSteps`) is removed; the legacy `PUT` connect
    stays in the client/store, unused by the UI. Preview states: `googleNone|googleUnconfigured|connected|authFailed`.
  - **Data layer** (`BoopCore/Level/`): `LevelWire` (lenient — every enum has an `.unknown`, item arrays decode per
    element, ISO dates with or without fractions), `LevelClient` over `RawJSONClient` (not the generator),
    `LevelStore` (`@MainActor @Observable`, `ServerCache` `level/digest` per Budapest day read back today / yesterday /
    day before when offline → stale + age; `level/mailbox`; a server fault is never dressed as old data),
    `LevelLogic` (head, highlight, deadline rows, error text). The store is created per user in `RootView` with a
    preview store; preview switches `-preview shell -previewHome level -previewLevel normal|empty|loading|failed|
    rulesOnly|disconnected|connected|stalled|authFailed|offline|cooldown`, `-levelTab`.
  - **Wall source** (`levelWallCandidates`, `WallSources.swift:219`, registered in `MaWall.swift:62`): `.expires` for a
    server-`notifiable` deadline (expiry = its due time) or deal (needs `screen == clean`); `.happened`
    *Megjött a reggeli posta · N érdekes* only when worth > 0 and a run happened today; no `.improves` candidate. Card
    ids `level-expires-<itemId>`, `level-post-<yyyy-MM-dd>`; a tap opens the Levél room. A score-7 deal never gets
    `.expires`.
  - **The ring — `WallNotifier`** (`ios/Boop/Nap/WallNotifier.swift`, `WallRinger` seam over
    `UNUserNotificationCenter`, one shared notifier per user via `WallNotifier.shared(for:)`, reconciles serialised
    through a task chain, state in `UserDefaults` `wall.notifier.<userKey>`): `MaWall` reconciles on appear, on a change
    of the expiring ids and when the scene turns active. The rules, all in the code and pinned by 20+ tests:
    - **When:** `WallRingTime.fire` — now if the deadline is within 12 h, else 12 h before it, **clamped into
      08:00–21:00 local** (before 08:00 waits for 08:00; after 21:00 rings at 21:00 if that is still ahead, else the next
      08:00; nil — no ring — if it is not before the deadline).
    - **Cap 2 per fire day** (`wallNotifications`, `cap: 2`); a candidate with no allowed fire time is filtered before the
      cap so it takes no slot; a slot is freed when a pending request is cancelled.
    - **`seen` suppresses only same-day fires:** the wall marks the `.expires` cards it shows as seen on appear, so
      those are not rung for *today*; a card due tomorrow that was seen today is still scheduled for tomorrow.
    - **No double ring per deadline:** `ringed: [cardId: expiresAt]` is kept until the deadline passes.
    - Only `wall.*` pending requests are ever cancelled (vanished / acted / seen-today); other notifications are
      untouched. Denied → silent; undetermined → asked once ever per user. `ReminderPresenter` shows `wall.*` in the
      foreground. **Limits:** a tap opens the app, not the Levél room (no deep route); rings are scheduled only while the
      app is opened; the Gmail deep link (`googlegmail:///cv=<hex>`) is untested on a device.
  - **Accepted spike deviations** (ruling R12): no glyph over the head orb, a painted sky instead of a photo, a plain
    `NKNote` for the rules-only line, Figyelt's existing copy, a shorter heat-strip note.
- **The Pénz area (L5, `mezo-r36n9.103`, 2026-11-20; spec
  [`2026-11-13-boop-penz-design.md`](../superpowers/specs/2026-11-13-boop-penz-design.md) §5.1/§5.3/§5.6/§6; look = the
  approved round-11 spike, `BoopSpike/EletContent.swift` `penz` + `EletPenzKit.swift`, `penz-1-ma.png` /
  `penz-4-koltes.png`).** Pénz left `AreaRoom`'s planned tab for its own room, `ios/Boop/Penz/PenzRoom.swift`, branched
  beside `EtelRoom()` / `EdzesRoom()` in `NapView`. Head: the orb is the week's remaining / budget (clamped 0…1, never a
  number in it); headline "Ezen a héten még 34 500 Ft-od van" + the per-day and month sentence; bar
  *Ma · Pénzem · Költés · Gyakorlás* + Boop, Költés's badge = rows needing review; corner actions Keresés (soon) ·
  Frissítés.
  - **Költés** in the spike's order: the week's level card (*EZEN A HÉTEN*, days left, bar with the days-left marker,
    "Napi *X Ft*. A hét eddigi költése Y Ft volt.") → *Kiadás* · *N tétel ellenőrzése* (disabled "Nincs ellenőrizendő"
    at 0) → *HONNAN JÖN EZ A SZÁM*: the server's ten `lines[]` grouped into six rows (income = recurring + one-off ·
    fixed · aside = savings target + invested · **Gyakorlás** on its own line · **the previous month's deficit, always**,
    its sub saying why it is 0 — none, or the month still open · free, lit) with *Egy sor módosítása* (PUT settings:
    savings target + Gyakorlás monthly, every other field carried over) → stats (spent · left, lit only when ≥ 0 · tempo
    Ft/nap with the "worse" arrow only when it would overspend the month) → *MIRE MEGY EL* (day-to-day spend = expense
    not linked to a rule, by category: top 4 + "Minden más", note with the top-two share) → *A MAI TÉTELEK* (category
    glyphs, never photos; "banki üzenetből" / "készpénz, kézzel" / "rendszeres tétel"; pending cash drawn as a
    still-to-come row "küldésre vár"; the hot "N üzenet ellenőrzésre vár" row with its badge; *A hónap összes tétele ·
    N db* opens an `NKAreaSubPage` by day) → *MIRE GYŰJTÖK* (savings goals and purchases: level saved/target, "a X-ből",
    "Júniusra kell · még 7 hónap"; empty = one honest line; *Cél vagy vásárlás hozzáadása* = online POST; Boop's
    purchase advice is L7 and is not invented) → *Hónap lezárása* (the oldest open month: transferred / kept, or
    none for a deficit; server codes said in words) · *Keretek* (read-only budgets vs this month's spend) →
    `NKInfoRow` "Mi történik a hónap végén?" (he chooses; nothing happens by itself) → ask row.
  - **Ma**: the verdict highlight by a pure rule (`penzVerdict`): rows to review → that one thing
    with *Átnézem*; else the oldest open month → "Lezárhatod az októbert" with *Lezárom*; else "Ma nincs dolgod a
    pénzeddel" with a sub from the real figures. *Kiadás* · *Befektetnék* (an honest "comes later" sheet). Stats: left of
    the week (lit) · of the month, N days · **napi X Ft "ennyi jut ma egy napra"** — *deviation from the spike*: its third
    number "ennyit tudsz befektetni" is not computed by the server yet, so it is the engine's `perDay`, never an invented
    figure. `NKInfoRow` "Honnan tudom, van-e dolgod?" spells the rule out; menu *A PÉNZ TERÜLET* (Kiadás live; Nagyobb
    összeg · Havi stratégia · Kimutatás open "later" sheets); ask row. Since L6 the news digest sits between the info
    row and the menu (below). **Gyakorlás** was `NKNotLiveYet` until L7 (below).
  - **The kit, additive only:** `NKBare(_:hue:glyph:…)` carries the section glyph (spike `sectionGlyph`; no caller
    changed); `NKGlyph` draws Pénz's coin `e-penz` (the spike's), now the area's eyebrow glyph and the bar's Pénzem
    icon; `NKAreaPage` honours `-previewScroll` like the tab pages. The two-button row (`PenzActionRow`, equal widths,
    hue-filled primary) and the level card are Pénz's own faces (`Penz/PenzFaces.swift`) — the kit's `NKActions` is a
    wrapping white-pill row other areas wear. Outfit has no U+202F glyph, so figures drawn in Outfit group with a plain
    no-break space (`penzOutfit`); prose keeps the narrow one.
  - **Data** (`BoopCore/Penz/`): `PenzWire` (lenient, hand-decoded — enums are strings) + `PenzClient` over the block
    builder's `RawJSONClient` (no generator change): allowance, `transactions?month=`, categories, accounts,
    `month-closes/open`, settings, `savings-goals` (L5 server half: `{id, name, kind: goal|purchase, target, saved,
    dueDate?, note?, position, clientRef?}`); PUT settings, PUT transaction + POST `…/reviewed` (category first, then
    reviewed), POST `month-closes/{month}`, POST/PUT/DELETE goals. `PenzStore` (one per user, `RootView`, shared by the
    room and the capture; the Terv card it also fed left with B6 S1) caches the whole read in `ServerCache` (`penz/snapshot`, 14 days): offline =
    the cached answer with `NKStale` ("5 órás adat"), no cache = said; a fault is reported as itself. Money =
    `PenzMoney`, printed as whole forints of `hufMinor / 100` (`penzFt`: narrow no-break space, U+2212 minus). Pure,
    tested builders in `PenzLogic.swift`.
  - **Cash, offline-first:** `OutboxKind.penzExpense` (never rename) + `PenzExpensePayload` (`RitmusPayloads`) sent by
    `PenzOutboxSender` (`RitmusClient`'s new branch) as `POST /api/penz/transactions {clientRef: item id, accountId,
    kind: expense, amountMinor, currency, categoryId?, date, note?}` — 2xx sent · no connection offline · 401/409/429/5xx
    retry · other 4xx failed with *Újra*. Account = the HUF cash account, else the HUF default (a row's currency is its
    account's); never loaded → the sheet says it needs the net once. The capture sheet (amount on the number pad,
    expense chips, note, one button riding above the keyboard) is on Ma, Költés, the menu and the global "+" (*Kiadás*
    tile). The row shows at once and the week's remaining drops by unsent cash (`penzPendingAdjusted`; a delivered
    `clientRef` never counts twice). `PenzTriggers` (`RootView`, app-wide, page open or not) re-reads the outbox into
    the store on every capture, delivery or refusal and re-reads the server on capture and delivery, so every Pénz figure
    counts unsent cash too; a refused cash row opens *Újra küldöm* / *Törlöm a telefonról*. The store re-runs a forced
    reload that arrived mid-read, retries a first read that found no net, keeps a failed transactions read's old rows
    only when they are this month's, takes "today" from the device clock, and builds a settings save from a fresh GET
    (or sends only the two edited lines). Today's rows leave review rows to the aggregate row; the month list counts
    what it shows (no transfer legs, no empty days).
  - **Terv** carried a read-only glass card "PÉNZ · EZEN A HÉTEN · 34 500 Ft maradt · napi X Ft" until B6 S1
    (2026-11-20) replaced Terv with the Évad page; the card left with it (no Pénz card outside the area now).
  - **Review (DEBUG):** `-preview shell -previewHome penz -penzTab Ma|Pénzem|Költés|Gyakorlás`,
    `-penzState review|calm|close|empty|offline|error`, `-penzSheet capture|review|edit|close|budgets|goal|invest|month`,
    `-penzPending 1890` (+ `-previewOffline YES` keeps it waiting), `-previewOpen penzCapture` (the "+" route); invented
    figures from `Penz/PenzPreview.swift`. Checked on iPhone 17 Pro Max and SE (3rd gen, 375 pt) with reduced motion;
    320 pt was not available as a runtime.
- **Pénz L6 — Pénzem, the news digest, the analysis page (`mezo-r36n9.104`, 2026-11-20; contract
  `api/feature/penz/penz-portfolio.yml`, build notes `docs/superpowers/plans/2026-11-20-boop-penz-l6-build.md`; look =
  spike `penz-2-hirek.png` / `penz-3-hirelemzes.png` / `penz-6-penzem.png`).** Screens in `Penz/PenzPenzem.swift`,
  sheets in `Penz/PenzInvestSheets.swift`; full-screen pages ride one page-level `fullScreenCover(item: PenzPage)`
  (`month` · `news` · `sleeve`).
  - **Ma's digest** (`PenzDigestBlock`): *A MAI HÍREK · AMI TÉGED ÉRINT* (search glyph) → one `NKNewsCard` per item →
    `NKInfoRow` "Hogyan készül ez az összefoglaló?" (the spike's text). States by `penzDigestView`: pending (an honest
    "még nem készült el"), quiet (no story touched his holdings — said calmly), `newsHealthy=false` (`NKNoFreshData`),
    build failed, no holdings (one line pointing to Pénzem, tappable), read failed (`NKBare` *Újra*), cached offline
    (`NKStale`, loud). No push. Ma's third stat stays the per-day figure (build notes call 8).
  - **Asking for a fresh digest** (`PenzStore.refreshDigestRound`, started by `PenzRoom` and cancelled when he leaves
    the room): once a day, when today's digest is `pending` or `quiet` and he has holdings — and once more right after
    his first holding lands (`digestRefreshWanted`) — `POST /api/penz/digest/refresh` (202), the block says „Utánanézek a
    híreknek — pár perc.", and the digest is re-read after ~45 s and ~120 s, then the round stops (never a loop). A 429
    `PENZ_DIGEST_REFRESH_LIMITED` (mapped to `.conflict(code)` by `RawJSONClient`) keeps the current state with
    „Nemrég frissült — pár perc múlva újra."
  - **The analysis page** (`PenzNewsPage`, `NKAreaSubPage`, crumb "Pénz · Ma", title = the item's): the spike's five
    parts, none dropped — MIT JELENT NEKED (the backend's `effectHufMinor` in Outfit, warm when negative, with "Ezt a
    számot a rendszer számolta ki…"), AMIT BOOP GONDOL RÓLA (`NKHueText` for `*emphasis*`), MENNYIRE BIZTOS (dots + level
    + uncertainty), HONNAN VAN (each source opens its http(s) url in Safari; other schemes are not openable),
    `NKNothingToDo` with the per-item `noAction`; buttons *Kérdezek róla* (Boop) · *A befektetésem* (Pénzem) only.
  - **Pénzem** (`PenzPenzem`): hero `NKStatRow` (total · "a befektetések mozgása" = `priceMovePct` · "ebből az
    árfolyam" = `fxMovePct`, never `hot`; a missing pct = "–") with a loud `NKStale` ("6 napos árak · November 14.")
    when `stale`, `NKNoFreshData` when nothing is priced, a line when some holdings are at cost → *Befektetést rögzítek*
    · *Felosztást kérek* (L7 "later" sheet) → "Mikoriak ezek az árak?" (daily closes, bond accrual or cost, daily FX
    close) → *A HÁROM REKESZ* (always three; the long one's sub = coverage "N év M hónapnyi fix kiadásod", or "nincs
    rögzített fix kiadás"; tap → `PenzSleevePage`: holdings with platform, value, share of the sleeve, "vételáron"
    chip) → "Miért évek a hosszú rekesz mérőszáma?" (§10.2.2 sentence) → *MI VAN BENNE* (by product across sleeves,
    five parts or top four + "Minden más"; same product in two sleeves → the spike's note) → *AMI JÖN…* (events by kind,
    maturity ≤ 90 days badged; *Esemény hozzáadása*) → *GYAKORLÁS* (monthly cap + "még nincs kereskedés" chip until L7;
    never an invented P/L; taps to the Gyakorlás tab) → ask row. Empty portfolio = an honest highlight with the record
    button.
  - **Writes (online, never the outbox)**: `PenzRecordSheet` (an existing holding, or a new one: name, kind, optional
    symbol, platform, sleeve, currency; then Vettem/Eladtam, total amount in the holding currency, optional quantity,
    date) → `PenzStore.recordInvestment` (POST holding with its own `clientRef`, then POST invest-transaction with
    another; both refs live for the sheet so a retry never doubles); `PenzEventSheet` → POST holding-events. Pénzem is
    re-read after each. `PENZ_SYMBOL_UNKNOWN` / `PENZ_SELL_EXCEEDS_POSITION` / `PENZ_FX_UNAVAILABLE` are said in
    Hungarian (`penzErrorText`); `RawJSONClient` maps a 503 that carries a message code to `.conflict(code)`.
  - **Paid from / into a money account (`mezo-r36n9.119`, 2026-11-21)**: under the date the record sheet offers
    *MELYIK SZÁMLÁDRÓL* (a sell: *MELYIK SZÁMLÁDRA*) — *Nem adom meg* (default: no `accountId`, the L6 request
    byte-for-byte) plus his live checking and cash accounts, default first (`penzPayableAccounts`); hidden when he has
    none. An account in another currency than the holding gets one quiet line (the server converts at the day's
    official rate; no second amount field). For a buy whose account shares the holding's currency, the sheet asks
    `GET invest-transactions/sms-candidates` (debounced on account · amount · day, `penzSmsLookupAmount`) and, when
    any match, shows *EZ VOLT A BANKI TERHELÉS?* (chips "nov. 19. · Spar", *Egyik sem* default) → `linkTransactionId`,
    so the bank row becomes the buy instead of counting twice. While that lookup is pending (the 450 ms debounce or
    the request in flight, tracked per lookup key) *Rögzítem* is disabled, so a save never skips a possible bank
    match (`.119` review). `PenzInvestTxnRequest` gained `accountId` /
    `accountAmountMinor` / `linkTransactionId` (sent only when set), `PenzInvestTxn` decodes `accountId` /
    `transactionId`; a save with an account re-reads the whole snapshot (the allowance and Költés moved), not only
    Pénzem. New refusals in Hungarian: `PENZ_SMS_LINK_MISMATCH` (the sheet looks the bank rows up again) and
    `PENZ_TRANSACTION_INVEST_LINKED` (editing / deleting a money row that belongs to a recorded investment).
  - **The weekly long-horizon review (`mezo-r36n9.120`, owner decision #66, 2026-11-21; contract
    `api/feature/penz/penz-weekly.yml`, server side [`penz.md`](penz.md) §3.14)**: on Pénzem, under *A HÉT, HOSSZÚ
    TÁVON* (search glyph, the reviewed week "nov. 10–16." at the head's right) right after the three sleeves and their
    info row — built only from existing parts, no new look, **no push, no action button, Ma unchanged**. One
    `NKAreaRow` per horizon in short → mid → long order: title = the horizon label, sub = the verdict (wraps to two
    lines — the kit's new `NKAreaRow.subLines`, default 1), right side a quiet word ("számít" when `matters`, else
    "nincs teendő"; never `hot`). A tap opens `PenzWeeklyPage` (page `PenzPage.weekly`, `NKAreaSubPage`, crumb "Pénz ·
    Pénzem", title = the horizon, sentence = the verdict): *Amit Boop gondol róla* (`NKHueText` for `*emphasis*`, plus
    the long sleeve's coverage sentence when known), *Mennyire biztos* (uncertainty), *Honnan van* (story / source
    counts, then each story: headline, holding, source capsules that open their http(s) link), `NKNothingToDo` with the
    per-horizon `noAction`. Fallback and quiet copy is shown as it came. States (`penzWeeklyView`): never loaded or the
    first read failed → no block (never breaks Pénzem); `pending` → one line „Az első heti áttekintés hétfő reggel
    készül el."; `quiet` / `failed` with no sections → one honest line; `failed` with sections → the rows. Data:
    `PenzWeeklyWire.swift` (lenient), `PenzClient.weeklyReview(week:)`, `PenzStore.weekly` read with the full load
    and cached in `ServerCache` (`penz/weekly` "current"; a failure keeps the last one), pure builders in
    `PenzWeeklyLogic.swift`, tests `PenzWeeklyTests.swift`. Review: `-penzWeekly ready|pending|quiet|failed|error`,
    `-penzPage weekly|weekly-short|weekly-mid`.
  - **Data**: `PenzPortfolioWire.swift` (lenient), `PenzPortfolioClient.swift` (portfolio, digest, holdings CRUD,
    invest-transactions, `holdings/{id}/transactions`, holding-events), `PenzStore.portfolio` / `.digest` read beside the
    snapshot, each with its own problem/offline flags, cached in `ServerCache` (`penz/portfolio` "current", `penz/digest`
    keyed by today — never yesterday's). Pure builders in `PenzPortfolioLogic.swift`, tests `PenzPortfolioTests.swift`.
  - **Kit (additive)**: `Napkelte/News.swift` — `NKNewsCard`, `NKConfidenceDots`, `NKNewsEffect`, `NKNewsSection`,
    `NKNothingToDo` (also in the `-previewKit YES` gallery).
  - **Review (DEBUG)**: `-penzPortfolio full|empty|stale|unpriced|error`, `-penzDigest ready|pending|quiet|unhealthy|failed|limited|error`,
    `-penzPage news1|news2|news3|sleeve|sleeve-short|sleeve-mid`, `-penzSheet record|event|allocation`; the preview
    refuses the symbol `NOPE`, a sell above the value, and a non-forint buy dated on a Sunday (no FX rate).
- **Pénz L7 — Gyakorlás, Termékjegyzék, javaslatok, Havi stratégia (`mezo-r36n9.105`, built 2026-11-20, not yet
  deployed; contracts `api/feature/penz/penz-practice.yml` + `penz-proposals.yml`, build notes
  `docs/superpowers/plans/2026-11-20-boop-penz-l7-build.md`; look = the approved spike's Pénz → Gyakorlás tab and Ma
  menu).** The Gyakorlás tab is no longer `NKNotLiveYet`; screens in `Penz/PenzGyakorlas.swift` (tab + journal page),
  `PenzPracticeSheets.swift` (sheets), `PenzProposalViews.swift` (proposal, strategy, catalog); logic and wire in
  `BoopCore/Penz/Penz{Practice,Proposal}{Wire,Client,Logic}.swift` + `PenzStore+Practice.swift`. All figures and copy
  are the server's (the weekly review is deterministic, no model); the phone only lays them out and sends what he typed.
  - **Gyakorlás** (paper trading, never real money): highlight = the week's headline/sub (or "még nincs lezárt
    kereskedés a héten") → *Új kereskedés* · *A teljes napló* → stats (month P/L "papíron" · average R · cap used /
    cap) → the week's cumulative curve → *A HÉT KERESKEDÉSEI* (closed, open and planned) → *AMIT A HÉTEN LÁTOK* (the
    commonest mistake tag and its cost in Ft, setup table, ≤ 3 observations) → the noise line under 50 tagged closes
    → `NKInfoRow` "Mit jelent az R, és miért papíron megy?". Menu: Új terv · Címkék · A keret · Élesre fordítás (an
    honest "not built, your switch later" sheet).
  - **Plan before, one line after:** the plan sheet (`PenzTradePlanSheet`: instrument, long/short, why, stop —
    required —, quantity, optional entry/target) creates a *plan*; the trade sheet (`PenzTradeSheet`) opens it (typed
    entry price + date; the cap is checked here), records a last typed close, closes it (typed exit, ≥ 1 of the eight
    tag chips, a mistake toggle, one line ≤ 140), or cancels a plan. A closed trade cannot be deleted (409 — its result
    stays in the cap and the review); an entry date before the current month is refused. No market data: every price is typed. The journal
    page lists all trades.
  - **The cap** is `penz_settings.practice_monthly_minor` — the same figure as Költés's *Gyakorlás* line; the *A keret*
    sheet shows used/left and links to the Költés lines editor.
  - **Proposals:** *Befektetnék* (Ma), *Felosztást kérek* (Pénzem) and the menu's *Nagyobb összeg* open `PenzAmountSheet`
    → `POST /api/penz/proposals {lump_sum}` → the proposal sub-page (`NKAreaSubPage`, crumb "Pénz · Javaslat"): the
    split per horizon with its rules, two–three approved options per sleeve with the server's yearly cost (always
    labelled with the sleeve's proposed amount), ±10 000 Ft steppers / typed amounts, *Elfogadom* (sends his per-sleeve
    amounts and product choices) → the accepted plan is a checklist he ticks himself (`steps/{i}`); ticking records
    nothing in Pénzem — the real buy goes through *Befektetést rögzítek*. Open proposals sit on Pénz Ma as the **shared**
    `NKProposalCard` (Elfogadom opens the page, Most nem = dismiss) with `NKWhyBody` behind *miért?* — no second card
    component, no wall source, no push.
  - **Havi stratégia** (menu): `GET /api/penz/strategy` → the investable figure with its inputs → *Kérek javaslatot*
    (`POST /api/penz/proposals {monthly}`); asked only on demand. **Termékjegyzék** (`PenzCatalogPage`, from the proposal
    page's "Honnan vannak a termékek?" and the menu): Boop's researched suggestions grouped by horizon with one-tap
    *Jóváhagyom* / *Nem kell*, then the approved list; every fee line carries "ellenőrizve: <date>" and its source. The
    model never adds a product; only approved rows appear in a proposal.
  - **Data / cache:** new `ServerCache` keys `penz/practice`, `penz/proposals`, `penz/catalog`. All L7 writes are online
    (never the outbox). Coded rejections: `PlanTransport` now maps a **422 that names its rule** to
    `.rejected(code)` (`PENZ_PRACTICE_CAP_EXCEEDED`, `PENZ_PAPER_TRADE_INVALID_STOP`, …), a **409** to `.conflict(code)`
    (`PENZ_PAPER_TRADE_STATE`, `PENZ_PROPOSAL_STATE`, …), beside the existing 400/503/429 mappings; `penzErrorText` /
    `penzCapExceededText` / `penzProposalCreateErrorText` say them in Hungarian and what he typed is kept.
  - **Review (DEBUG)**, invented figures from `Penz/PenzPreviewL7.swift` (writes kept for the run; an entry above the cap
    answers 422): `-penzPractice full|quiet|empty|error`, `-penzProposals open|accepted|none`;
    `-penzSheet newTrade|tags|cap|live|trade|trade-plan|trade-closed|why`; `-penzPage journal|strategy|catalog|proposal|proposal-accepted`
    (with `-previewHome penz -penzTab Gyakorlás|Ma`).
- **Évad room — Most · Hét · Terv · Kísérlet (2026-11-28, `mezo-r36n9.196` step 2; decisions #132–#138; spec [`2026-11-27-boop-evad-szoba-kezdolap-design.md`](../superpowers/specs/2026-11-27-boop-evad-szoba-kezdolap-design.md)).** **Current — supersedes the single-page *Évad — the season* description that follows (kept for the cards' content, which now lives in these tabs).** The Évad orb opens `EvadRoom` (`Evad/EvadRoom.swift`; `EvadRoomTab` = Most · Hét · Terv · Kísérlet; sub-pages are `EvadRoomSub` covers: days, load, learned, map, whatIf, rules, newSeason, atrendezes, experiment, newExperiment). Every tab is a hero + one *what you see here* sentence + at most five cards (`EvadParts`):
  - **Most** (`EvadMost`): this week's adherence with seven day dots (a dot opens Nap › Napok — **known deviation:** not that specific day), what's next, the review countdown. The pure builders live in `BoopCore/Evad/EvadRoomLogic.swift` (day dots, bars, weeks, year bracket, wall targets); the orb number is the same adherence %.
  - **Hét** (`EvadHet`, `EvadHetPages`): the Sunday-review card, *Terhelés és pihenés* over the season, next week (**Átrendezés** opens the reorder page), Boop's lighter-week word, *Amit Boop tanult*.
  - **Terv** (`EvadTerv`, `EvadYearStrip`): the year strip (tap → Edzés › Éves terv; with no year plan only the season is drawn — decision #136, blocks are still edited in Edzés), the season's weeks, the goal (→ Súly), *Mi mire hat* (`EvadSystemMap`), the per-room plan rows (each opens that room), *Szabályok*, *Módosítás*, *Új évad*.
  - **Kísérlet** (`EvadKiserlet`, the former Hatás tab: proposal, running, past, new; result page `EvadExperimentPage`).
  - **Weekly review „Heti átnézés"** (`Evad/Review/WeeklyReviewFlow.swift` shell, `WeeklyReviewPages.swift`, `WeeklyReviewIllustration.swift`; logic `BoopCore/Evad/EvadReview.swift`). Five pages: 1 „Hogy ment a hét?" · 2 „Mit tanult Boop?" · 3 „Milyen lesz a jövő hét?" (Boop's proposals accepted / declined one by one; none → „Jól néz ki a jövő hét") · 4 „Mit eszel jövő héten?" (one menu line, „Megnézem a menüt" opens the Étel › Hét menu page) · 5 „Kész" (one takeaway sentence: an accepted proposal first, else the plan's weekly sessions + bedtime). Window **Sunday 18:00 – Monday 23:59 phone time**; „Később" closes and changes nothing; „Kész" records the week as done **on this phone only** (per-week key, no server). Opened from the Ma wall card (the `evad` wall source), the Hét tab card and the notification. `WeeklyReviewReminder` schedules a local notification **Sunday 18:00** („Kész a heti átnézés" / „Öt rövid lépés a hetedről — két perc.") only while a season exists **and** notifications are already authorised — it never asks.
  - **Ma wall re-routing** (`EvadWall` → `BoopDestination`, §9): learned-energy correction → Évad › Terv › Módosítás · menu waiting → Étel › Hét menu page · experiment proposal → Évad › Kísérlet · experiment result → that result page · season end → Évad › Terv · review → the review flow.
  - **Étel › Hét carries the weekly menu + shopping list** (`Etel/EtelMenu.swift`, `Etel/EtelList.swift`, hosted by `EtelHet`): a menu card and a list card above the week, then the menu page, list page, past lists and staples. The menu page shows „N recept a menüben" → opens Receptek with the filter on. `EvadMenuStore` is unchanged and still lives in `BoopCore/Evad`.
  - **„Menübe jöhet" toggle** on every recipe (Receptek list row `EtelReceptek` and recipe detail `RecipeDetail`) + a filter chip „Menübe jöhet · N". Hidden without a season; a recipe outside his season rules shows the reason instead of a toggle; offline a tap says „Ehhez internet kell."; write semantics in §9.
  - **Simulator:** `-previewHome evad`, `-evadTab Most|Hét|Terv|Kísérlet`, `-evadOpen …`, `-previewOpen review` / `-reviewPage 1…5` (opens the review outside the Sunday window), `-previewHome etel -etelTab Hét|Receptek`, `-etelMenuOnly YES` — full table in `ios/README.md`.
- **Évad — the season (B6 S1, `mezo-r36n9.16`, 2026-11-20; spec
  [`2026-11-20-boop-evad-design.md`](../superpowers/specs/2026-11-20-boop-evad-design.md) §5.1, backend
  [`season.md`](season.md)).** **Terv → Évad:** the spine's second place renders the old Évad page (removed 2026-11-28; `ShellView.page(.terv)`;
  the `ShellTab` key stays `terv` so scene storage and `-previewTab terv` keep working; `NKSpineBar.labels[1]` =
  „Évad"; the place's default hue is `evadHue` = `.forma`). A spine place, not a ring-opened room: an `NKAreaPage`
  **without** its own `NKAreaBar` (two bottom bars would stack), inner tabs `NKAreaTabs` **Évad · Menü · Lista ·
  Hatás** at the top of the content, *Szabályok* as the head's corner action, sub-pages as page-level
  `fullScreenCover(item: EvadSub)` (`modositas | szabalyok | uj`, §9).
  - **Head:** orb level = week / N, eyebrow „Őszi fogyás · 12 hétből a 7." (`evadEyebrow`), serif verdict + one hue
    sentence from the overview's `head.status` (`evadVerdict`: on course / slower / faster / no data; maintain „Tartod
    a súlyod" / „Kicsit kijjebb mentél a sávból") — never free text.
  - **Évad tab** (the old overview tab, removed 2026-11-28; its cards live on in the room's Most/Hét/Terv tabs): **Mi mire hat** (`EvadSystemMap`: four orbs Edzés · Étel · Alvás · Súly, dotted
    links with a light running cause → effect, still under reduced motion; a tap lights one pillar and lists its links
    with the server's numbers — a link without a number says so, never an invented one), **Súly** (trend curve with
    the target line and the dashed plan after now; a band for a maintain season; trend, target, weekly pace +
    feasibility word), **Az évad terve** (block + sport days · training/rest-day kcal + protein · sleep need +
    bedtime · target + date), **Hogy megy** / **Amit Boop észrevett** (S2, below), **Következik** (deload weeks,
    season end), actions
    *Módosítás* (offline: „Ehhez internet kell.") · *Új évad*. *Korábbi évadok* is `mezo-r36n9.123`.
  - **Hogy megy (S2, 2026-11-21)** — `evadAdherenceFacts(adherence, needMin:)` turns the overview's last-week
    summary (server `AdherenceService`, [`season.md`](season.md) §3.7) into an `NKStatRow` of plain counts: „4 / 5
    napon belefértél a keretbe", „3 / 4 edzés megvolt", „1 / 2 sport megvolt" (training and sport apart since
    mezo-r36n9.131), „4 / 7 éjjel aludtál eleget". A fact with nothing to count is
    left out (never „0 / 0"); `evadExcusedLine` adds „N kímélő nap nem számít bele." before „Ez nem pontszám, csak
    összesítés.". A reasoned skip only takes that day's session out of the count (food and night still count). The
    block is absent when `adherence` is null, or when no fact remains and no kímélő day was left out.
  - **Amit Boop észrevett (S2)** — `NKList` of the overview's insights (≤ 3: learned expenditure, short-night
    intake, „Erre figyelek"), each present only past its server gate ([`season.md`](season.md) §3.8).
  - **Mi mire hat, Alvás → Étel (S2)** — `evadLinkText` prints the server's `sleep_food` value rounded to 10 kcal
    („rövid éjszaka után +280 kcal"); null = no computed effect = the no-number line.
  - **The Ma wall's Évad source (S2)** — `evadCandidates` (`BoopCore/Evad/EvadWall.swift`, registered in `MaWall`
    as `WallSources.evad`, hue `evadHue`): the learned-expenditure insight as `.improves` (at most once a week — the id is keyed on the ISO week; rank 0.8, „Átnézem" →
    `EvadStore.pendingSub = "modositas"` + `openPlace(.terv)`, the Évad page opens Módosítás once the overview is
    on screen) and the season ending within 7 days as `.happened` („*N nap múlva* véget ér az évad", *Megnézem*).
    `MaWall` loads the Évad overview once (`.task`, cached offline). Nothing here is `.expires`, so it never rings.
  - **Étel Hét reads the server's judgement (S2)** — see the Hét tab paragraph below.
  - **Hatás (S4):** `EvadEffectTab` over `EvadExperimentStore` (owned by `EvadStore`, ServerCache `evad/experiments`,
    every write re-reads the list, a refused or failed one too, so a card the server already finished is replaced):
    the proposal highlight, *Folyamatban* (`NKLevelBar`, `NKTag(warn:)` per overlap, a row of up to seven day chips
    `EvadDayChip` — the window's days so far, `evadMarkDates` = the last 7 of `[start, min(end, today)]`, weekday over a
    drawn `check-ink` tick, today ringed, each tap ticks/unticks that date so a missed day can be made up;
    *Leállítom* confirms first), *Korábbi kísérletek*, *Új kísérlet* (`EvadSub` page-level). **Refresh rule:** the
    store re-reads when forced, while the list is from the cache, or once the calendar day of the last server answer
    is not today; the tab forces a read on appear and on returning to the app (scenePhase active), the Ma wall's evad
    source on returning to the app. The wall's „Indulhat" settles the card only when `start` returns true. Result page
    `EvadExperimentPage` (`NKCompareColumns` Előtte | Közben, `NKList` „Mit jelent ez?"; a column is lit only under a
    „clear" verdict). Copy is pure (`EvadExperimentLogic`: labels, units, verdict sentences per signal and direction).
    DEBUG `-evadOpen kiserlet`.
  - **Módosítás** (`EvadWhatIf`, „Mi változna?"): stepper *Edzések hetente* (the kit's plus glyph and a drawn minus,
    no system symbols; picks gym days that avoid the sport days), sport-day chips, *Heti fogyás / hízás* slider (not
    for maintain). Every change re-previews (debounced, `POST /api/seasons/{id}/preview`) → **Ennyi változna**
    (`NKCompareColumns` Most | Utána: Edzésnapon, Pihenőnapon or „nincs pihenőnap", Szénhidrát edzésnapon,
    **Heti összesen** (`weekKcal`), Alvásigény, Lefekvés, then Célba érsz + A tempó, or A sáv), red guard lines
    (`EvadWarningBox`), **Ehhez ezt kell tenned** (the server's `todo[]`), *Elfogadom* / *Mégsem*. Each day's own
    target is base + that day's movement + the goal balance, so a 5th session does **not** change the training-day
    kcal — it changes *Heti összesen*, the sleep need and the bedtime. *Elfogadom* only accepts the draft the preview
    on screen was made for (`evadCanAccept`); a 409 `SEASON_PREVIEW_STALE` re-previews with „Közben változott valami,
    újraszámoltam." **A gym-day change moves the running block in the same accept** (`mezo-r36n9.122`, 2026-11-25,
    replaced S1's lock): the preview's `block` (`EvadBlockWeek`) renders as **A blokkod új hete** (`NKBare` +
    `NKList` of `evadBlockWeekRows`: „Szerda · Alsó A — Eddig kedden volt.", „Új nap: a hétfői edzés még egyszer.",
    „Kimarad · Felső B …"); refusals `SEASON_BLOCK_NEEDS_GYM_DAY` and the shared `.dayWorkoutRunning` are worded in
    `evadErrorText`. Server side: [`season.md`](season.md) §apply.
  - **Szabályok** (`EvadRules`): switches „Csak kevéssé feldolgozott ételek" (NOVA max), „Vasárnap este kérem a jövő
    heti menüt", „Könnyebb edzéshéten ne fogyjak", „A valódi égetésemmel számoljon", „Ajánljon kísérletet, ha valami
    újat kezdek" → `PUT …/rules`; read-only rows *Kiválasztott receptek*, *Blokk*, *Alvásigény* („az edzésből
    számolva"), *Súlycél*.
  - **Új évad** (`EvadNewSeason`, „Jöhet a következő évad"): five steps (A cél · Az edzés · Az étel · Az alvás ·
    Összesítve) prefilled from `GET /api/seasons/draft` and summarised by `POST /api/seasons/draft/preview`;
    *Indulhat az évad* = `EvadStore.start` (create once, then activate; a retry after a failed activate reuses the
    planned season, never a second) / *Később*.
  - **No season yet** (`EvadEmpty`, the overview's 404): „Még nincs évadod · Indítsunk egy évadot", a note that a
    draft from the current goal and block is ready, *Megnézem* → Új évad. Nothing is written before *Indulhat az évad*.
  - **The Blokk builder's gate copy:** starting a block without a season is refused (409 `SEASON_REQUIRED`) and
    `planErrorText` says „Edzésblokk csak évadhoz indulhat. Az Évad oldalon indíthatsz egyet."
  - **Data** (`BoopCore/Evad/`): `EvadWire` (lenient, hand-decoded — enums are strings; `weekKcal` and `menuDay`
    may be missing) + `EvadClient` over `RawJSONClient` (no generator change; typed `PlanFetchError`, 404 =
    `.notFound`, 409 → `.conflict(code)`, `evadErrorText` per `SEASON_*` code) + `EvadStore` (one per user in
    `RootView`): the overview cached in `ServerCache` endpoint **`evad/overview`** (max 14 days); offline = the cached
    copy with its age (`NKStale`, „5 órás adat") and every change says it needs the net; 404 = the empty state, never
    a failure; a refusal or fault reported as itself. Pure builders in `EvadLogic.swift`.
  - **Review (DEBUG, `-preview shell -previewTab terv`)** — `Evad/EvadPreview.swift` answers the season API locally
    with the spike's invented figures: `-evadState full|maintain|empty|offline|error` (default `full`; `offline`
    primes the cache five hours old), `-previewOffline YES` (= `offline`), `-evadTab Évad|Menü|Lista|Hatás`,
    `-evadOpen modositas|szabalyok|uj` (opens the sub-page after 1.2 s), `-evadLit 0…3` (lights a pillar),
    `-evadSessions N` / `-evadPace 0.6` (pre-set Módosítás), `-evadStale YES` (the first accept answers 409
    `SEASON_PREVIEW_STALE`), `-evadAutoAccept YES` (taps *Elfogadom* once the first changed preview is in),
    `-evadBottom YES` (sub-pages open scrolled to their actions). S2: the overview carries Hogy megy and three
    insights by default; `-evadQuiet YES` leaves both out (data still short, the S1 look) and nulls the `sleep_food`
    number; `-evadEndSoon YES` puts the season in its last week (the wall's season-end card); `getAdherence` answers
    the Étel preview's week (day 4 a kímélő day, today still going). The preview's learned-insight body still carries
    the spike's Monday sentence — the server no longer says it.
  - **Menü + Lista (S3, 2026-11-21).** `EvadStore.menu` is an `EvadMenuStore` (`BoopCore/Evad/EvadMenuStore.swift`, same
    client + `ServerCache`, keys `evad/menu` / `evad/list`, offline = last answer with its age). It shows next week's menu
    when it has meals, else this week's, else next week's empty state; the list is next week's, else this week's (404 =
    `listMissing`). the old menu tab (screen 05: `NKHighlight` approve, `NKCarousel` of day cards 372 pt × 0.84, a meal tap →
    `EvadSwapSheet` presented at page level, *Kérek másikat*, *Kiválasztott receptek*; seeding / none / repeated states),
    the old list tab (screen 06: `evadShelfGroups`, `EvadTick` drawn tick, „Változott", staple chips, `ShareLink` with
    `evadShareText`, *Korábbi listák*, *Szokásos tételek*); sub-pages (the recipe picker was removed — see the toggle; the past-lists and staples pages now live in Étel › Hét): `EvadPastListsPage`,
    `EvadStaplesPage` (`EvadSub` receptek / listak / tetelek). Check-off is optimistic and outbox-free: one retry, then the
    tick is put back with a line; a line with a tick still in flight ignores another tap (`inFlight`). The menu and the list
    keep their own offline state and age (`menuOffline` / `listOffline`). A past day's meal is not tappable (`evadIsPast`);
    week dates are computed on a Gregorian calendar whatever the phone's calendar setting. Tab badges: Menü dot = next week `proposed` (overview), Lista = lines still to buy.
    Wall: `evadMenuCandidate` — `.expires` from the menu day until the week starts (`expiresAt` = next Monday), *Átnézem*
    → `pendingSub = "menu"` → the Menü tab. DEBUG preview `EvadMenuPreview.swift` (`-evadMenu proposed|approved|seeding|none`,
    `-evadRepeated YES`, `-evadChanged YES`).
- **The Edzés room (B5 phase 1, `mezo-r36n9.15`)** — the same page, with its own data. Edzés left `AreaRoom`
  for `ios/Boop/Edzes/EdzesRoom.swift`, branched beside `EtelRoom()` in `NapView`, because the morning brief
  cannot carry what the training API knows. **The frame is still the kit's** (`NKAreaPage`, the area's own bar,
  the tab set and its badge are unchanged — the owner has seen that page), and every control it had is still
  there — since 2026-11-19 the room's *Beállítások* action opens *Mi van a termemben* (§ below, `mezo-r36n9.66`) instead of a „soon" toast. What is new on **Ma**:
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

- **Mezociklus tab, Mezociklusaim, detail pages, lifecycle (`mezo-r36n9.177`, shipped 2026-11-26).** The Edzés room's fourth tab is now **„Mezociklus"** (was „Blokk"); every visible „blokk" in the app became „mezociklus". Code: `ios/Boop/Edzes/Mezociklus/` (`MezoCurrentCard`, `MezociklusokPage`, `MezoDetailPage`, `MezoRestartSheet`, `MezoCloseSheet`, `MezoReportPage`, `MezoKit`, `Mezociklusok.swift`) over `ios/BoopKit/Sources/BoopCore/Train/Mezociklusok.swift` + `MezociklusokModel` + `MezoReportModel` and the `PlanClient` lifecycle calls (hand-decoded, like the rest of the builder). **Tab** (redesigned 2026-11-28, `mezo-r36n9.197.2` — see *Mezociklus tab redesign* below): on top the running card; the weekly-review card's duplicate „Blokk szerkesztése" button is gone; at the bottom two tiles „Mezociklusaim" and „Éves terv" (the old year-plan row is gone). **Mezociklusaim:** hero „MOST FUT" (weeks timeline with today lit, ring, body map), KÖVETKEZIK planned cards, SABLONJAIM carousel (body map, mini curve, „N×" run count), LEZÁRTAK ring cards; loading / empty („Még nincs mezociklusod — indíts egyet") / error / offline states — offline shows the cached list (`ServerCache`) with its age and disables actions with a stated reason. **Detail page** (any card): weeks curve, report teaser for closed runs, day carousel, muscle map. **Tapping never starts anything** — only the bottom bar does: Indítás (template / planned) or Újrafuttatás (closed) + Szerkesztés, with a confirm („A most futó „X" lezárul.") when a run is active; the running one is closed first with its report. **Restart sheet** „Újrakezded ma az 1. héttől?" with the toggle „A sablont is frissítem": ONE server step (`POST /api/train/mesocycles/{id}/restart`, `MesoTemplateService.restart`) — new active run today from week 1 with every phone edit, old run closed with its report, year-plan link kept; on failure nothing changes. **Close sheet** „Hogy sikerült? (nem kötelező)" → graphic **zárójelentés** (weeks plan vs actual, adherence ring, strength rows with records, own note, Boop's evaluation pending / ready / off — the AI review lands minutes later; the missed-workout count is shown only when computable from logged data). **Save-to-template** (`POST …/{id}/save-to-template`) overwrites the template with the run's current state (a legacy run without one gets one). **Template mode:** the builder opens as „SABLON SZERKESZTÉSE" and saves via `updateMesoTemplate`, never touching the running run. Server side is documented in [`train.md`](train.md) §4 (*Restart + save-to-template*). Final-review hardening: the restart sheet warns when a queued planned mezociklus falls into the new weeks and would be discarded (existing server rule); after a failed refresh the page stays in its offline state over the cache; Hungarian elative suffix (-ból/-ből) follows the title's vowel harmony (`mezoOf`). Handbook: `docs/boop-handbook/07-edzes/20-mezociklusaim.md`.
- **Ma tab redesign (`mezo-r36n9.197.3`, shipped 2026-11-28; spec [`2026-11-27-boop-edzes-ujratervezes-design.md`](../superpowers/specs/2026-11-27-boop-edzes-ujratervezes-design.md) §5.3, §6.1).** `EdzesRoom.ma`, top → bottom: **`maHero`** — an `NKPagedHero` whose page 1 (`maFront`) is the label (ma / pótlás / megvolt), FUT capsule + progress while running, the missions count, title, time line (or „keddi nap, ma pótolod"), the three stats (perc · gyakorlat · éles sorozat; stacked at accessibility sizes), one `NKCardActions` primary (Indítás / Folytatom on the hue capsule, „Megnézem a mai eredményt" white on a done day with a phone-side result) and the quiet links „Mégis a mai napot csinálom" / „Másik napot csinálok ma" (#129: inside the hero). Page 2 (`maLoadPage`) is „A mai terhelés" — body map + top-5 muscle rows (the old standalone block and its stat row are gone; the stats live on page 1). Page 1 is measured (`fixedSize` + `onGeometryChange` → `maFrontHeight`) so the pager has no empty band; with page 2 the height is `max(page 1, maLoadMinHeight 236 scaled)`. **`MaHeroKind.resolve(anotherDay:briefSession:briefDone:planWorkout:restDay:doneToday:)`** keeps the old card's order (picked other day unless done → brief session → plan workout → rest → none); `pages(hasLoad:)` — rest/none or no heat → 1. **`MaHeroPrimary.resolve(_:running:hasResult:)`** — a done day offers the result, never a start. Rest: „Pihenőnap" + `maNextSessionLine` („Következő: Alsó A · szerda", from the block's days, wrapping to next week). None: the brief's `maiCopy`, or the no-data line on a failure, or a calm loading line before the first answer. Then **`KovetkezikCard`** (moved under the hero), **„A mai gyakorlatok"** (`NKSectionCard`, `ExerciseCard` now `nkInnerCard`; offline brief-only list inside the same card), **„Hol tartasz"** (`NKSectionCard` + `onOpen` → Mezociklus tab; `shortTitle · N. hét mezoOf(weeks)` + `EdzesWeeksArc(compact: true)`), **„Az Edzés terület"** (`NKMenuGrid` in an `NKSectionCard`; its tiles already carry the inner fill), ask row. `TodaySessionCard` and the free-standing `quietLink` rows are gone. Tests: `BoopTests/EdzesMaTabTests.swift`.
- **Mezociklus tab redesign (`mezo-r36n9.197.2`, shipped 2026-11-28; spec [`2026-11-27-boop-edzes-ujratervezes-design.md`](../superpowers/specs/2026-11-27-boop-edzes-ujratervezes-design.md) §5.2, §6.1).** `EdzesRoom.blokk` renders, top → bottom: **`MezoHero`** (`Edzes/Mezociklus/MezoCurrentCard.swift`, which replaced `MezoCurrentCard` and `MezoPlannedCard`) — a `nkGlass(28)` card whose head carries the `NKMoreMenu` (Újraindítás · Lezárás (destructive) · Mentés a sablonba, #129); body per `MezoHeroState` (`.loading` · `.running(BlockPlan)` · `.none(planned:)` · `.failed(String)`), chosen by `MezoHeroState.resolve(block:firstAnswerArrived:failure:planned:)`: a block (fresh or cached) wins, then a failure, then `.none` only once `EdzesStore.blockAnswered` (set after the first `loadBlock` answer or failure) — no „Nincs futó mezociklusod" flash on a cold start. Running: title (wraps, `minimumScaleFactor(0.8)`, capped at `accessibility1` so a long word never breaks mid-word), „N. hét a M-ből · split", **`EdzesWeeksArc`** (`Edzes/EdzesWeeksArc.swift`, from `edzesTimeline(b)`; current week lit + phase name, past ticked, deload dashed; `compact: true` for the Ma tab in step 3; labels capped at `xxxLarge`), `NKCardActions` with Szerkesztés (the builder's zoom source), the offline line. None: „Nincs futó mezociklusod", the planned card's body as an `nkInnerCard`, Új mezociklus primary + Megnézem quiet. Then `WeekReviewEntrance` (unchanged), **„A heted"** (`NKSectionCard`; `DayCard` is now `nkInnerCard` with today ringed; carousel height `@ScaledMetric` 150, max 330), **„Izmok ezen a héten"** (`NKSectionCard` with `onOpen` → `BlockLoadPage`; **`EdzesMuscleBars`** (`Edzes/EdzesMuscleBars.swift`) over `muscleRows(_:top:)` — top 5 by sets + „+N további izomcsoport"; name above bar at accessibility sizes, where the week total moves from the head into the card), `MezoTiles`, ask row. The old „A MEZOCIKLUS TERHELÉSE" card is gone (its arc lives in the hero, its muscles in the new card). Kit: `NKFlowRow` gives an item wider than the row the row's width (so `NKHighlight`'s capsules wrap at XXXL instead of overflowing). Preview: `-previewEdzesState nincs|hiba|offline` in `PreviewTransport` (with `-preview shell -previewHome edzes -edzesTab Mezociklus`). Tests: `BoopTests/EdzesMezociklusTabTests.swift`.
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
    switch, half dial, spread, proposal + *Elfogadom* / *miért?*). Napok: day pills with minutes, steppers 1–8, and a technique chip that opens `TechniquePicker`. `WireCatalogItem.allowedTechniques` carries the server's reviewed palette into `DraftExercise` on load, add and swap; absent on an older server it falls back to the former stable/lengthened rule. `none` is always offered. Hammer Curl offers myo, rest-drop and drop; Hip Thrust offers the 2-second top hold; Overhead Press offers only straight sets. The quiet chip remains tappable so the dimmed choices and their reasons can be read. The day's challenge is a separate choice with its own eligibility rule (`mezo-r36n9.127`), and one challenge flag per day; a technique and challenge may coexist. The server revalidates saves. Session-cap warnings use the server's cap. Blokk: style
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
  - **The Napok day editor (`mezo-r36n9.116`, spec
    [`2026-11-20-boop-blokk-szerkeszto-design.md`](../superpowers/specs/2026-11-20-boop-blokk-szerkeszto-design.md) §6,
    look: the spike on `spike/boop-blokk-szerkeszto`; row layout `mezo-r36n9.138`, variant D of `spike/boop-nap-sorok`)** —
    each `BuilderDayCard` row is three lines. **Top:** ≡ handle (drag reorders through `BlockDraft.move`, no lift scale
    under reduced motion; VoiceOver *Feljebb/Lejjebb* actions), name, ⋯ menu (*Csere · Beállítások · Törlés*). **Cells:**
    three equal tiles, big numeral over the written-out word — `BuilderSetCell` *sorozat* is itself the 1–8 stepper (left
    half −, right half +, each ≥ 44 pt at 375 pt, `BlockDraft.step`; amber when the server's exercise cap warns),
    `BuilderValueCell` *ismétlés ⌄* / *tartalék ⌄* (0 amber) open the small editor `DayEditValueSheet` (sheet
    `.reps` / `.reserve`, fixed height 470 / 400): ismétlés *Legalább* / *Legfeljebb* 1–30 (min ≤ max, a min past the max
    lifts it, a max under the min lowers it) via `setRepRange`, tartalék 0–4 (*bukásig* at 0) via `setReserve`, the
    own-value line *Ezt te állítottad; az edzésmód nem írja felül.* + *Visszaállítom az edzésmódra* (`resetToStyle(day:at:key:)`,
    only that field's key; the settings sheet keeps the reset-all), *Kész*; detents `[.height(n), .large]`. The sorozat
    halves are labelled *Kevesebb / Több sorozat*, the cell adjustable only on an editable day; the name carries the
    settings as a VoiceOver action. A hue dot in a cell's corner marks the field in the row's `overrides` (`workingSets` /
    `repRange` / `targetRir`). **Pills** (`NKFlowRow`, wraps at 375 pt): the **sub-muscle** of the row's fine token
    (`DraftExercise.muscleKey` → `SubMuscles.name`, e.g. *Hát · középső*; the day's top chips stay coarse groups, volume
    still groups by `muscle`; a jump row says *ugrás · nem számít a sorozatokba* instead) and the technique chip. No
    animation on cells/editors under reduced motion. Delete leaves an undo line; a tap elsewhere on the row →
    `DayEditSettingsSheet` (rep range,
    reserve, starting weight, warm-ups, *TE ÁLLÍTOTTAD*, *Visszaállítom az edzésmódra*); ＋ → `DayEditAddSheet`
    (`mezo-r36n9.127`, look: spike `spike/boop-izomreszek`): a compact *Izmok: … ▾* dropdown (`SubMuscles.summary`, a
    whole group by name, else *Hát · középső +2*, *Minden izom* when empty) opening `DayEditMusclePanel` — group
    checkbox (all/none/partial, drawn `DayEditCheckbox`), sub-muscle pills, *kevés* once on a group under its band (on the
    part for the stand-alone leg tokens), *Törlés* / *Kész*, scrolls on small phones, ticks apply live (250 ms settle);
    ≤5 suggestions from `BlockBuilderModel.suggest(mode: "add", muscles:)` — nothing picked sends `muscles: []` and the
    server answers for the week's under-band groups (*AJÁNLOM · A HÉT KEVÉS IZMAIRA* + the one-line hint) — then the full
    list filtered to the picked tokens; ⋯ *Csere* → `DayEditSwapSheet`. Every card and list row in these sheets and the
    player's `SwapSheet` is the shared `ExercisePickCard` / `ExercisePickRow` (`Edzes/SwapSheet.swift`): the catalogue
    start still (`imageStartUrl` → `BoopConfig.mediaURL`, 44 pt `NKRemoteThumb`, the glyph tile without one), the
    catalogue name, *hát · középső · összetett* (`exerciseRoleLine`), the server's reason only. The day card's top chips
    stay coarse groups with counts but are spelled by `SubMuscles.groupName` (*Mell*, *Comb*, *Combhajlító*, *Far* …) —
    as is every muscle word in the app now: the Izmok tab, the weekly review deck, cap warnings and the player (`muscleName`
    is the lower-case group name for running text; an exercise's own line in the player reads `SubMuscles.name`);
    the quiet full-list labels cover the whole catalogue (the server labels every row in add mode). Empty day line; the day of today's open workout
    (`BlockBuilderModel.lockedDay`, passed by `EdzesRoom`) is read-only; *Mentés* on a structurally changed day that a
    waiting weekly proposal touches (`pendingReviewDays`, from the proposals the load already read) asks *Függő heti
    javaslat* first. Indices of the evaluation (recommendations, cap warnings, proposals) are hidden while the line-up
    differs from the evaluated one (`indicesFresh`); a swapped/new row drops the weekly AI note (`aiNote(_:)`). The main
    button falls back to *Nincs változás* where *Nincs mit menteni* does not fit (`mezo-r36n9.118`). DEBUG (with
    `-previewBlokk YES -previewBlokkOpen epito -previewBlokkTab napok`): `-previewBlokkEdit
    default|menu|settings|reps|reserve|add|addOpen|addEmpty|swap|undo|empty|locked|confirm` (*reps* / *reserve*: the first
    row's small ismétlés / tartalék editor; *add*: two sub-muscles picked,
    *addOpen*: the dropdown open, *addEmpty*: nothing picked), `-previewBlokkDay N` (day page),
    `-previewBlokkSuggest fail` (suggestions 503 → the full list with its one-line note).
  - **Coverage hints on the Izmok tab (`mezo-r36n9.114`, 2026-11-25; spec
    [`2026-11-25-boop-hianyjelzes-design.md`](../superpowers/specs/2026-11-25-boop-hianyjelzes-design.md), look: spike
    `spike/boop-hianyjelzes`, owner decision #59)** — after every successful evaluation `BlockBuilderModel` asks
    `PlanClient.coverage(blockId:days:)` (`POST /api/train/mesocycles/{id}/coverage`, `getBlockCoverage`, on the lenient
    `RawJSONClient`; `WireCoverage` drops an unreadable finding, a broken `lastTopSet` / `prescription` reads as absent) with
    each non-empty draft day as its weekday (0 = Monday), its catalogue ids lower-cased and the evaluator's
    `minutesEstimate`. The findings are keyed by group; between two answers only the **touched** groups hide (`weekday:catalogId`
    counts compared with the answer's basis — a set step or a reorder touches nothing; an added / removed / swapped row
    hides its own coarse group, a back row also the biceps, a chest / shoulder row also the triceps), the rest stay, and the
    glance keeps its room while the last answer has findings (no 176 → 200 → 176 jump); a failed read is silent (no
    findings, never an error). `coverageFinding(_:)` also hides a finding while the row taken with Hozzáadom is still on the
    draft (deleted by hand → the hint returns; stale undo entries are dropped on the next answer) and one whose proposal
    lands on the locked day; Tartás / untrained groups are the server's silence
    (not re-filtered). Screens (`BlockBuilderPage`): the glance line under the body map *„N hiányzó kiegészítő mozgás ›"*
    (steps to the next hinted card; the map shrinks to 176 pt while it shows), a hollow ring in the dot strip (amber when the
    muscle is also outside its band), and `CoverageHintBox` on `BuilderMuscleCard` after the band proposal: hairline outline,
    *KIEGÉSZÍTŐ MOZGÁS*, *miért?* (chevron toggle, the server's `whyText`), the verdict (head before „ — " white, the rest
    quieter), the proposal as `ExercisePickCard` with `footnote` *„csütörtök · 3 × 10–15"* (prescription, else
    `Prescription.fallback`), **Hozzáadom** (`acceptCoverage` → `BlockDraft.add(day:catalog:prescription:)` on the draft day of
    the proposal's weekday; the box becomes *„Hozzáadva csütörtökhöz · visszavonom"*, `undoCoverage` removes that row; a
    successful save clears the undo lines) and **Mást választok** (`DayEditSheet.add(day, muscles: finding.muscles)` on
    `coverageOtherDay` — the proposal's day, else the first open day training the group). No proposal → *„Ehhez most nem
    találtam olyan gyakorlatot, ami a termedben megvan…"* and only Mást választok. Never enables *Igazítsd a sávba*. DEBUG
    (with `-previewBlokk YES -previewBlokkOpen epito`): `-previewBlokkHiany list|why|added|none` — the fixture week's
    hamstrings hinge only (Építés) and its back rows only: Combhajlító + Hát hints, Mell silent (Tartás); *why*: the „miért?"
    open and the card scrolled to it, *added*: the leg curl taken, *none*: no hint (`PlanPreviewTransport.coverage`).
  - **Új blokk — the new-block flow and the plan recommender (`mezo-r36n9.113`, S1 + S2, 2026-11-21; spec
    [`2026-11-20-boop-eves-terv-design.md`](../superpowers/specs/2026-11-20-boop-eves-terv-design.md) §5, plan
    [`2026-11-21-boop-eves-terv-s1-s2.md`](../superpowers/plans/2026-11-21-boop-eves-terv-s1-s2.md))** — the no-block state of
    Edzés → Blokk has an *Új blokk* button; the flow (`ios/Boop/EdzesTerv/UjBlokk/`, model `BoopCore/Train/NewBlockModel`)
    is **Alapok · Jelöltek · nem fér · létrehozva**. *Alapok* (step 1/2): the block length, the session minutes
    (*Meddig tarthat egy edzés*), the training days read from the season's gym slots (changing them is the Évad page's job;
    no season → the *Előbb egy évad kell* state with a link, no call made; fewer than 2 or more than 6 gym days → the
    `seasonDaysOutOfRange(n)` state *„Az évadodban n edzésnap van — a tervajánló 2–6 napra tud tervet adni…"* with the Évad
    link, no call made), one tier switch per landmark muscle (Hangsúly · Építés · Tartás; no Törzs row) and the **heti
    keret** line from the server's **`intakeBudget`** (week 1 of the lead candidate — *„az első héten"* — consistent with
    the candidate filter; a failed refresh clears it so the failure notice shows). A raise is checked **one tier per tap**
    (`RaiseCheck`, no maths of our own): a third Hangsúly is refused (`emphasizeFull`); a raise the server marked
    `raiseAllowed[m] = false` (raising only that muscle leaves no candidate) is refused (`noRoom`), the reason shown under
    the row; a missing key, no target, or a tier on screen other than the one the server priced is not a refusal. The
    minutes pills add the current minutes as its own selected pill when a fix set one outside 45/60/75/90. *Jelöltek*
    (2/2): 1–3 ranked flawless candidates, the first marked *AJÁNLOTT*, each `splitLabel · ~N perc` (longest day) with the
    server's reasons and a **„miért?"** sheet; *Mikor kezdjük* (*Jövő hétfőn* default, or today). *nem fér*: when
    `nothingFits`, the closest candidate (*a legközelebbi, ha mégis kéred*) and the server's fixes as buttons (*EZ MEGOLDANÁ*:
    more minutes applies, fewer Hangsúly lowers the muscle the server names in the fix — else the heaviest — to Építés, more
    days sends him to the Évad tab).
    *Ezzel kezdem* → `generate` (with the candidate's `splitKey` and the session minutes, so the server keeps the AI's picks
    only while the plan still fits them; a failed generate falls back to the candidate's own
    template) → `createMesoTemplate` → `startMesoTemplate` (next Monday `planned`, or today `active`; a saved template is
    reused on retry, keyed by request + minutes) → the ordinary builder opens on the new block with **„Mégsem, eldobom"**
    (`discardMesocycle`: the server deletes the never-trained block and its template — no report, no AI review). A start failure keeps the candidates on screen with an inline error; `SEASON_REQUIRED` → the
    needs-season state. The builder itself gains the **heti keret** line (the server's `budget` for the open draft),
    the minutes row (pills = the session-minutes target) and a **„miért?"** sheet per muscle (the server's `basis` +
    band). No wording of a number is the phone's own: minutes, bands, costs and fixes all come from the candidates /
    evaluate answers. DEBUG: `-previewUjBlokk YES` with `-previewUjBlokkScreen alapok|tele|jeloltek|nemfer|letrehozva`,
    `-previewUjBlokkSeason none`, `-previewUjBlokkScroll Y`, `-previewUjBlokkStart fail`; the builder's own
    `-previewBlokkMinutes 60` and `-previewBlokkWhy back` (all in `PlanPreview.swift`; `ios/README.md`'s table lists
    spine flags only). Not in this slice: experience level (dropped), an AI pass on the
    chosen candidate. The year map and following it arrived with S3+S4 (next bullet).
  - **Éves terv — the year map and following it (S3+S4, `mezo-r36n9.113`, 2026-11-21; spec `2026-11-20-boop-eves-terv-design.md` §5, plan `2026-11-21-boop-eves-terv-s3-s4.md`).** Its **own page-level cover** (`ios/Boop/EdzesTerv/EvesTerv/`, opened by `EdzesPage`'s `openYearPlan`; the entry is an *Éves terv* tile in the Ma tab's *AZ EDZÉS TERÜLET* menu and an *AZ ÉVES TERV* row under the load card on the Blokk tab, both once the block plan has loaded; the sheets sit at page level so they are not clipped). **No plan** → the *Még nincs éves terved* state leading to **`EvesTervLetrehozas`**: the server's *preview* (`previewYearPlan`) — the blocks, the Hangsúly picks, the notes (`emphasis_once`, `no_focus`, `pair_relaxed` as plain sentences — what did not fit is said out loud) — and *Elfogadom* creates it (a running block becomes block 1 and „itt tartasz" sits on the right week). **The map** (`EvesTervTerkep`, `YearStrip`): the 52-week strip with the blocks, light weeks, the buffer, the consolidation and the *itt tartasz* mark (it draws `52 + overrun` columns when the year slipped), one card per block, the rule-break cards from `warnings`, the *A futó blokkod nincs az éves tervben* banner (*Hozzákötöm a következő blokkhoz*; for a planned run it reads *A tervezett blokkod …* and „… {date}-tól indul" — „fut" only when it runs, from `unlinkedRunning.status`), and — while the consolidation runs — the **year-review card** (blocks done/skipped, focused / unfocused groups) with **Jövő évi terv** (`replaceActive`), which starts on the server's **`nextYearStart`** (a late consolidation can outlast the plan's end; the phone does no date maths — a plan cached before the field falls back to the Monday on/after today). **The block sheet** (`EvesTervBlokkSheet`): swap the focus, *Időpont* (a week later / earlier), *Sorrend* (*Előrébb / Hátrébb a sorban*) and *Kihagyom* — each is one `patchYearBlock`; **a planned block already linked to a planned run** shows only „Indul {date-tól}. A blokkot a blokképítőben tudod módosítani." and *Kihagyom* (the server refuses its other edits with 409) — and the page re-draws from the whole re-dated plan that comes back. **A rule break is a warning, never a refusal.** The **skip box shows only the server's consequence** (which groups lose their only focus); **the „move the focus to block N" suggestion is a map card after the skip** (one extra tap, an accepted spike difference). The map ends with a quiet *Éves terv lezárása* (confirm → `archiveYearPlan`). The page holds the last plan in `ServerCache` (`train/year-plan`, 14 days): offline it shows that plan **with its true age** (a „… órája" line); **a decode that misses a required number is the error state, never a plan with invented weeks** (`WireYearPlan` is strict on every required field). `YearPlanModel` (`BoopCore/Train/YearPlanModel.swift`) is the logic — it renders what the server computed and does no date or rotation maths of its own.
  - **Következik + the pre-filled intake (S4).** At the top of the Edzés room's **Ma** tab the **Következik card** (`Edzes/KovetkezikCard.swift`) shows the year plan's `next` block — focus names (with the Hangsúly pill), „6 hét · dec. 14-től · 3. blokk a 8-ból", the climb as a small timeline and the server's sentence — in the block's last week, or when no block runs and the next is due. **Offline or from a cached plan the card does not appear** (the room shows it only for a freshly loaded plan). **Indítás** opens the ordinary *Új blokk* intake **pre-filled** (the intake's model rides on the page item — `EdzesPage.newBlock(NewBlockCover)` — like the year cover's, so the cover never presents without it) (`YearBlockPrefill` → `NewBlockModel(prefill:)`): the block's focus groups on **Hangsúly**, the rest on **Tartás**, the weeks and the start. The **start-day pills** become *„dec. 14-től"* (the planned date, from the plan — shown when it is the server's date), *Jövő hétfőn*, *Ma*; **a due or overdue block opens on „Ma"** (the server's `next.startsOn` is `max(plannedStart, today)`, so the card, the intake and the year agree). The **consolidation intake** has no tier switches: every muscle on Tartás, 1–3 weeks (`consolidation: true` on candidates/generate), light level. *Ezzel kezdem* sends the block's id as `yearBlockId` on `startMesoTemplate`, so the started block is **linked to the year plan**; a „Jövő hétfőn" block starts on its own day server-side (`PlannedBlockStarter`, see [`train.md`](train.md) §4 *Éves terv*), and the season then follows it ([`season.md`](season.md) §3.3). Consolidation copy is „{w} hetes lezárás".
  - **DEBUG flags (`EvesTerv/EvesTervPreview.swift`, served from invented fixtures in the server's shape; `ios/README.md`'s table lists spine flags only):** `-previewEvesTerv YES` with `-previewEvesTervScreen letrehozas|terkep|blokk|nincs|lezaras|csuszas|kotetlen` (create screen · the map in week 9 · a block's sheet · empty state · the consolidation runs with the year review · a late year — buffer eaten, consolidation 1 week, one week over 52 · an unlinked block runs), `-previewEvesTervScroll Y`, the shared `-previewBlokkState loading|error|offline` (offline = the last plan, 3 hours old); and `-previewKovetkezik YES|nincs|lezaras` (with `-preview shell -previewHome edzes`: the running block's last week · no block runs and the next is due · the consolidation is next; dates follow today, so the next block starts next Monday).
  - **The identity-aware draft (`BlockDraft`, `BlockBuilderModel`; no wire ids in the editor).** A `DraftExercise.id` is a
    **local key** — the server's row id for a loaded row, `new-<uuid>` for one added in the draft; a swap keeps the row's key,
    technique (when the new exercise may carry it) and his picks; the ids are re-minted by every structural save, so the model
    re-reads the block after a save (`withKey`). `changes(since:)` compares the line-up **by key** (order, add, remove, swap
    and every field edit mark the day) and `carryEdits(onto:original:)` carries only his deltas onto a fresh read — a set-count
    delta is added to the server's value if the server moved too; a day whose line-up he changed keeps his line-up unless the
    fresh read already shows it (its save reached the server) — such a day is taken as the server has it; a matching line-up that only a removed-then-re-added (new) row mimics counts as taken only when every row holds his values, else his other edits on the day carry on.
    **The save-time `workingSets` rule:** on a styled block a loaded row sends `workingSets` in `overrides` only when its set
    count differs from the server's (the style stamps the rest); on an unstyled one a count he did not touch drops the key; a
    swapped or new row sends no wire id and its drafted values (`overrides`) as his; unstyled steps send no overrides.
    `BlockBuilderModel.suggest(...)` calls `getBlockExerciseSuggestions` (the model decides *add* vs *replace*, sends
    `dayCatalogIds` and the day index); a server-side 409 `TRAIN_DAY_WORKOUT_RUNNING` on a day save shows a running-day error
    and keeps the unsaved edits.
- **The technique and the challenge in the player (`mezo-r36n9.84`, 2026-11-19; spec
  [`2026-11-17-train-style-and-techniques-design.md`](../superpowers/specs/2026-11-17-train-style-and-techniques-design.md)
  §6.4/§6.6/§6.10, look: the round-7 spike on `spike/boop-blokk-epito`, owner OK 2026-11-19)** — the player reads
  T1–T3's prescription: `PrescribedSet.technique/restSec/legs/topHoldSec` and `TodayExercise.technique/challenge/challengeBest`
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
  whatever sets are new by diffing logged ids (`sendNew`). A set added in the gym never repeats the technique. **Top hold (`top_pause`, `mezo-eiux9`)** is different: `liveTechnique` still shows its pill, but the final planned working set has no legs and `isTechnique` stays false. Before and during that set the player says "Minden ismétlés tetején tartsd meg 2 másodpercig." Logging appends one normal set with `technique=top_pause`, no `TechniqueRun` or extra timer; the completed row and reopened workout show "Fent megtartás · 2 mp". The optional `topHoldSec` decodes as nil from older caches. Extra sets do not inherit the technique. **Technique + challenge on one set** (owner 2026-11-19,
  `mezo-r36n9.98`/`.99`): the set's legs are the technique's, then a `partials` leg; `liveChallenge` = the technique
  set ends in partials; `TechniqueRun.position` lets „Elég volt" (`stopTechniqueSteps`) or a short myo mini jump over
  the remaining technique steps to the challenge. The
  rest between sets is now the plan's own `restSec` on a styled block (else 90 s). Simulator switch:
  `-previewEdzesTechnique YES` (rest drop on the first exercise, the challenge on the second, myo on the last).
  **Rest pause** (`SetTechnique.restPause`, wire `rest_pause`, `mezo-r36n9.125`, owner 2026-11-20): the owner's fixed
  20 + 4 × (10 s, 5). It rides the myo path — `mini` legs, `TechniqueLines` shares the myo branch — but its legs carry
  no `minReps`, so `WorkoutSession.logLeg` never ends it early; only „Elég volt" does. Offered wherever myo is
  (`allowedTechniques`), drawn with the myo mark. `BlockDraft.setTechnique(.restPause)` pins the row to
  `repMin = repMax = SetTechnique.restPauseReps` (20) and marks `repRange` his (the server pins it again on save);
  taking the technique off leaves the range.

- **The owner's ten findings on the player (`mezo-r36n9.147`, 2026-11-23; plan
  [`2026-11-23-boop-edzes-lejatszo-javitasok.md`](../superpowers/plans/2026-11-23-boop-edzes-lejatszo-javitasok.md),
  decisions #94–#95)** — one bundle, no visual round: **(1)** weight and reps are set on **`NKScale`**
  (`BoopDesign/Napkelte/Scale.swift`): a Canvas ruler sliding under a fixed pointer, **0,5 kg / 1 rep** steps, the
  plan's value as a dot on the ruler, a tap on the number still types, a selection haptic per step **only under the
  finger**; it replaces `NKStepper` in the lifting pads, the technique legs and the correction sheet (the reserve keeps
  `NKInlineStepper`). **(2)** `WorkoutSession.prefill(for:)` (pure, `WorkoutPrefillTests`): warm-ups and the first
  working set from the plan, every later working set from **the previous working set's real weight**, the plan's reps
  and reserve; the pad's tag says `TERV` / `ELŐZŐ`. **(3)** a persistent `TERV · 60 kg · 8 ismétlés · 2 tartalék` line
  under the pads, „ehhez még nincs ajánlott súly, az első alkalom után lesz" when the server sent none (his case: no
  identity has history yet, decision log). **(4)** a warm-up set gets a big `BEMELEGÍTŐ 1/2 · könnyű súllyal, 4
  ismétlés` line above the pads (the ladder's 4 reps read as a bug behind a 9 pt pill). **(5)** the note sheet has
  **Mentés** and a keyboard **Kész**, and the note is queued as **`.workoutNote` with `exerciseId`** when the sheet
  closes (`EdzesRoom.enqueueNote` → `TrainClient.sendNote` → `saveExerciseNote`); before this nothing ever enqueued that
  kind and the note died with the session. **(6)** the correction sheet gets the reserve. **(7)** the swap is said twice:
  `Ma mást csinálok helyette` (`.TODAY`) and `Lecserélem a blokkban is` (`.MESO`) — `PlayerSheet.swap(id, whole)`,
  `SwapSheet.wholeBlock`; the old „Végleg lecserélem" was the today swap mislabelled. **(8) A fresh plan reaches the
  running workout:** `EdzesStore.load(force:)` runs after a builder close, on „Indítás" and on `edzesTick`, and a fresh
  answer is merged into the running session by **`WorkoutSession.apply(plan:)`** (`WorkoutApplyPlanTests`: order, set
  plans, technique and the server's note follow the fresh plan; logged sets stay, even on a dropped row; a phone-typed
  note wins; the current exercise is kept once he lifted on it; another day's plan is ignored via the new
  `templateSessionId`). Server side `TrainService.replaceDayExercises` saves a **pure permutation in place**
  (`matchByIdentity`, ids kept — always, decision #94); add/remove/swap stay 409 `TRAIN_DAY_WORKOUT_RUNNING` while the
  workout runs; the builder's running day therefore keeps the handle, the cells and the settings and hides only add,
  Csere and Törlés (`BlockBuilderPage`, `lockLine` reworded). **(9)** the Ma card's done state is
  **`EdzesStore.doneToday`** (server `completed` dated today, `weekDoneDates`, or `finishedToday`) OR the brief's
  `done`; `finishWorkout` queues the finish and calls `RitmusEnvironment.sendNow()` **in one task** (no race with the
  enqueue), then reloads today + the brief; `onSent` bumps `edzesTick` on `.workoutStart`/`.workoutFinish`;
  `endWorkout` keeps the session as `workout-finished.json` so **„Megnézem a mai eredményt"** reopens
  `WorkoutCeremony(finishedAt:)` in review (no note row, the stopped clock); the wall's `edzes-megvolt` card carries
  `Megnézem` → the room, `PathBuilder` passes `s.done`, `SessionMove` says „Megvolt", the room's menu says „Megvolt ·
  A mai eredmény", and „Indítás" on a done day is refused on the phone before the server's 409. **(10)** progression:
  no change — the engine already references the heaviest set (train.md §Set recommendation engine).
- **The reasoned swap sheet (`mezo-r36n9.66`, 2026-11-19; spec
  [`2026-11-17-boop-gyakorlatvalasztas-design.md`](../superpowers/specs/2026-11-17-boop-gyakorlatvalasztas-design.md)
  §6.2, look: the approved spike `spike/boop-gyakorlatcsere`)** — *Végleg lecserélem másikra* opens `Edzes/SwapSheet.swift`
  (full height): the chips *ehhez nincs eszközöm* / *nem esik jól*, a note line with *visszavonom*, **AJÁNLOM** with up to
  five server-ranked cards (`getExerciseSubstitutes`: name, `izom · típus`, the server's reason sentence, *Legutóbb: …* in the
  hue — a bodyweight top set reads „N ismétlés", never „0 kg" — or *Ezt még nem csináltad*; the first card lit), *Minden
  gyakorlat* expanding to a search field over the cached catalogue (same muscle first, accent- and case-blind) where a
  filtered-out row is dimmed with *nincs hozzá eszközöd* / *legutóbb fájt* and stays pickable, the footer line and *Mi van a
  termemben ›* (`WorkoutPlayer.onGym`; nil until the gym page lands → a „hamarosan" toast). The outgoing exercise's catalogue
  row is found **by name** (`catalogRow(named:in:)`, as the technique sheet does); without one both chips are hidden. The
  equipment chip runs `missingEdit(for:)`: a machine / Smith / specialty row marks that exercise missing, one portable kind is
  switched off, several ask which one (bench last); un-tapping a lit chip undoes every edit blocking it
  (`GymProfile.edits(blocking:)`). `EdzesStore.saveGym` (behind `markMissing/undoMissing` and the gym page) **re-reads the
  profile from the server before every write** and applies the edit to that (an edit from another device or run is never
  written over; a profile it cannot read is never written — the PUT replaces it whole), runs one write at a time, and on a
  refusal leaves the profile as the server last said it; both return the sentence to show. `setDiscomfort` records / clears
  the swap-time discomfort and keeps the flag on the session's exercise (`SessionExercise.discomfort`, saved with the
  session file), so the chip tells the truth after a relaunch. Each chip re-fetches the suggestions; chips and
  *visszavonom* ignore a second tap while one is in flight, and when the suggestions cannot be fetched both chips are
  disabled and dimmed (a change would show no effect). Today's exercises are left
  out of suggestions and list **by name** — the old filter compared catalogue ids with the workout's row ids and so never
  excluded anything on a real server. Loading says *Keresem…*; a failed fetch says *„Most nem érem el az ajánlásokat — a
  teljes listából választhatsz.”* over the plain list. The swap itself is unchanged (online, *Cserélem…*, rows disabled,
  „… — lecserélve"). Pure parts in `BoopCore/Train/SwapList.swift`. Simulator: `-previewEdzesSwap YES`
  (+ `-previewEdzesSwapAt N`, `-previewEdzesSwapFail YES`); the preview catalogue now carries the real catalogue's `gear` and
  type, and `PreviewTransport` answers suggestions with a toy ranker over it, keeping the gym profile and discomforts in memory.
- **„Mi van a termemben" (`mezo-r36n9.66`, 2026-11-19)** — `Edzes/GymSettings.swift`: the intro sentence, nine switches
  (the §6.1 labels, `EquipmentKind.label`) and *AMI KONKRÉTAN HIÁNYZIK* with a *mégis van* per marked exercise (names from the
  cached catalogue; one it no longer has reads „Törölt gyakorlat" but can still be undone). Opens from the room's
  *Beállítások* action and from the swap sheet's *Mi van a termemben ›* link — the latter **inside the player**
  (`WorkoutPlayer.gymSheet`, a `PlayerSheet.gym`), because the room cannot present while the player's cover is up. One
  source of truth: `EdzesStore.gym`. `GymEditor` shows a copy, sends every change through `EdzesStore.saveGym` (profile
  read from the server first, whole PUT, taken back by the store on a refusal) and re-reads the store's profile; each
  switch saves at once, a failed save puts the switch back and shows *„Nem sikerült elmenteni · Újra”*, and a profile that
  could not be read shows no switches at all (*„Most nem érem el a termed beállításait · Újra”*). Simulator:
  `-previewEdzesGym YES` (+ `-previewEdzesGymSeed YES` two kinds off and one exercise missing, `-previewEdzesGymFail YES`
  every save refused). `-previewEdzesSwapFail YES` makes the suggestion fetch fail (the plain-list fallback).
  Opening the swap sheet may **start the workout on the server** (the discomfort and suggestion calls address the workout
  by its server id, asked for idempotently like the swap itself — `serverWorkoutId`), and opening *Mi van a termemben* from
  the sheet **replaces the swap sheet** (one sheet at a time inside the player). The after-exercise three questions now go
  to the server exactly as tapped (`mezo-r36n9.67`, the server stores them 1-based).

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
  - **Ma tab — redesigned 2026-11-27 (`mezo-r36n9.184`):** three tiers — a hero glass card (kcal ring + macro bars, paging to the day curve), one glass card per plan window (rows open `MealDetailPage`; Javítás = `FoodClient.updateMeal`, Törlés = deferred `FoodClient.deleteMeal` behind a 6 s „Visszavonás” toast), then Víz · Kiegészítők · Italok · ask row; see the milestone entry at the top. The two paragraphs below describe the earlier layout (kept for the budget, dimension and kímélő details that still hold). **Earlier layout** (`EtelMa`, `MealCard`, `DimensionSheet`): five numbered sections — **1** the day's budget (kcal headline + three macro bars; a kímélő GUIDANCE day shows "ma nincs kalóriakeret" and a "Kikapcsolom" button instead), **2** the day's plan (logged meals as photo cards with score and macros; the open windows from `GET /api/fuel/plan/{date}` with the MOST badge, the suggested recipe or ingredient tip, *Megeszem* / *Kihagyom* / camera), **3** ~~the next-meal tip~~ (removed 2026-11-21, `mezo-r36n9.135`), **4** víz (+250 / +500 ml, idempotent writes), **5** kiegészítők (one-tap group tick). A meal card opens the eight-dimension sheet (macro, micro, who, fat quality, NOVA, plant diversity, **energy density**, context — "Adag" is a recipe-only dimension; each shows what it measures, the server's own detail and the coach note). The processed-food line appears only as the coach's one quiet sentence when NOVA 3–4 carry more than half the meal's kcal; the phone adds no NOVA badge of its own. The headline wraps to two lines on long numbers (kit 38 pt); under 230 pt content width the dimension grid goes to two columns.
  - **Capture is offline-first** (`Etel/Composer.swift`, `PendingMeals.swift`, `PhotoCapture.swift`; `BoopCore/Etel/{MealDraft,FoodOutbox}.swift`). Five entrances — **Fotó · Szöveg · Vonalkód · Recept · Kamra** (plus **Szokásos**, below) — end in ONE editable draft (name, amount, delete per line; totals; sensitivity and "nincs adat" notes) and **nothing is saved without the owner's tap on *Mentem***. The draft is computed by the model through `draftMealFromAi` (a barcode-only capture never calls the model — the scanned product becomes the line). With no network the capture is parked in the **same `Outbox` as B3** (new `OutboxKind.mealDraft`; one queue, one backoff / age / failed machinery, flushed on foreground, net back and background; each meal is its own order group): the photo is stored as `meal-<uuid>.jpg` beside `queue.json` (the payload carries only the id), and when the net returns the draft is computed and parked as a **confirmation card** ("Jóváhagyásra vár" with *Mentem · Átnézem · Elvetem*) — the sender never saves a meal on its own. The capture keeps its own `capturedAt`, sent with the **phone's UTC offset, never `Z`** (`FlexibleISO8601Transcoder` writes the offset for every generated-client date; the server dates the meal by that offset, so a 00:30 Budapest meal sent as `Z` would land on the previous day) and a stable `clientRef`, so a retry after a lost answer creates no duplicate (§4, [`fuel.md`](fuel.md)). A capture older than 7 days is shown as failed with its values and photo kept (**Újra**), a refused save (400) says which shelf/recipe-tied lines may have been deleted and stays editable; a failed photo upload never fails or discards the meal (`hasPhoto` tells). The draft's lookup state is spoken honestly (`draftNotice`): lookup failed ≠ "unknown code" ≠ "no food found". Photos are JPEG downscaled to 1600 px (ImageIO); the camera needs `NSCameraUsageDescription` (`INFOPLIST_KEY_` in the app target, the only `project.pbxproj` change of the slice) and falls back to the photo library when it is absent or the device has no camera.
  - **Barcode** (`Etel/BarcodeScanner.swift`, `ServingConfirm.swift`): VisionKit `DataScannerViewController` (EAN-13 / EAN-8 / UPC-E, first code only, guarded `isSupported && isAvailable`) with a typed-code field that is always visible. The lookup (`lookupPantryItem`, response-level `source` OFF / CATALOG / NONE) shows the product with the owner's sensitivity line (no allergen data reads "nincs allergén-adat", never "free of"); a miss offers a label photo or words and the code rides along. The **serving confirmation is always shown** — 100 g / 1 adag / free grams (grams by default when the serving is missing, a CATALOG hit has no serving) — and scales the per-100 g facts; kcal absent ⇒ the line is marked needs-review, never a fabricated zero. **The live scan, the permission prompt and Fotó opening the camera were verified only in the simulator's typed-code path — they need a hands-on check on the phone** (§9).
  - **Sensitivities everywhere a food appears** (`BoopCore/Etel/SensitivityRules.swift`, mirror of the server's rules): the badge on a draft line, a shelf row, a recipe row or a suggestion is "Tej · Intolerancia: tartalmazza" style; an absent allergen key is **"nincs adat"**, an ALLERGY-level key with traces/unknown is warned, nothing ever reads "mentes". The profile is read once into the store; saving it in *Amit kerülök* reloads the room, so the tip cannot keep suggesting something just excluded.
  - **Photos** (`NKThumb`, `NKCardPhoto`): meal photos live on the server (`PUT/GET/DELETE /api/meal/{id}/photo`, `POST…`; recipe photos on `/api/recipe/{id}/image`), are fetched with revalidation (`ETag`, `no-cache`) and show on the Ma meal card, in the recipe row/detail and in Napló; the stored bytes are deleted with the meal / on replace (see [`fuel.md`](fuel.md), [`recipe.md`](recipe.md)).
  - **Cross-surface** (B4 Task 15, additive): Ma's timeline merges **food rows** in clock order after the B3 rows (`MaPhases.etelStations`: the next open window with a "kb. N kcal" budget sub line, or the first untaken supplement group, or one "Mind bevéve" row; a tap opens the room), `MaBelow` holds its own `EtelStore` loaded with the *light* read (`load(food:now:extras:false)` — day, plan, protocol; no coach, no photos) and re-reads the taken-supplement set from `UserDefaults` on every load so the two stores never disagree. The supplement clock is a daypart guess, shown hedged as "kb. 8:00" in the sub line (the 42 pt time column stays empty for it). **Napló** day detail gets "A NAP ÉTELEI": only meals with `hasPhoto`, photos fetched for those, one quiet line when a photo could not load (said only after the downloads finish), the section absent for a day with no photo meals. DEBUG launch flags for the room: `-etelTab`, `-etelSheet` (`kamra-item|kamra-estimated|kamra-catalog|add-link|add-label|add-manual|add-barcode|usuals|het-day|detail|import|text|workshop|cooked|cooked-filled|cooked-review`), `-etelReview other|added|facts` (with `cooked-review`), `-etelImportRun`, `-etelWorkshopAsk`, `-previewOpen barcode`, `-previewCode`, `-previewServing`, `previewFoodOffline` (see `ios/README.md`).
  - **The Étel room on the warm blocks (`mezo-r36n9.101`, 2026-11-19).** **Head:** no photo (owner, 2026-11-19 — the painted sky only, also on `DimensionSheet`); the orb's number is the mean score of today's meals (`etelDayPoints`); each tab speaks for itself (`etelTabVerdict`: Ma/Hét the day, Receptek the library, Kamra the shelf); corner actions *Étkezés rögzítése* + *Frissítés*; the area bar's Boop item. **Ma** (`EtelMa`): `NKHighlight` only for the kímélő card (the server's „Következik: …” tip is no longer shown here or on the Ma wall — owner, 2026-11-21, `mezo-r36n9.135`) → three capture tiles (Fotó · Leírom · Szokásos; the barcode stays in the composer and on Kamra) → `NKStatRow` *MA EDDIG* (`etelStats`) → *A NAP MENETE* (`etelDayCurve`: hourly 06–22, eaten up to "now", the open windows' budgets after it, drawn dashed via `NKCurve(planAfterNow:)` with a three-entry legend) → macro rows with "még N g" → the day's meals as rows (a logged one opens `MealDetail` in place; the window that is open now shows its suggestion + Megeszem/Kihagyom, a later one is one quiet line until tapped) → water → supplements → `NKAskRow`. **Receptek** (`EtelReceptek`): entrance tiles, the library numbers (`recipeStats`; a hero card since `.207`, below), search + slot chips, rows with pills (`EtelPill`) and the recipe's fit as `EtelScoreRing`; the sensitivity flags sit on their own line, so a long name never collides with them. **RecipeDetail**: pills, `EtelMacroTiles` per serving, *BOOP ÉRTÉKELÉSE* (since 2026-11-28 `RecipeScoreCard`: rosette, day block, 2×4 tiles → `RecipeDimensionDetail`, rank, tips, vote — see the milestone entry at the top; a cancelled load no longer leaves "unavailable", plus an *Újra*), *AMIRE FIGYELSZ* (`EtelAllergenRows`), numbered steps. **Kamra** (`EtelKamra`) and **PantryItemDetail**: category glyphs (`etelCategoryGlyph`), pills, the food's own score ring + breakdown, `EtelNovaScale`. The shared faces live in `Etel/EtelFaces.swift`. **The meal composer** (`Composer.swift`): one page carries time + photo + words at once (`MealTimeRow`: Most / fél órája / 1 / 2 órája / any moment of the last 6 days; the draft's day and window follow it — `MealComposerModel.setTime`); a photo with words goes up as one draft request; the working face is `MealScanView` (scan line + corner marks over the photo, the orb without one, stepped phrases, held ≥ 2.6 s by `minWorking`); the draft is a plate card (photo, time, `EtelMacroTiles`), the recipe and shelf pick lists carry the same `EtelSearchField` + `EtelFilterChips` as the Receptek / Kamra tabs (`filterRecipes`/`recipeSlots`, `filterShelf`/`shelfCategories`; cleared when the list changes — `mezo-r36n9.135`); one tile per line (glyph + name + source pill + kcal / a stepper for the amount / macro chips + *Leveszem*; a doubtful line has the amber border) and *HOZZÁTESZEK MÉG* — photo, recipe, shelf food, barcode or more words join the **same** draft (`addMore`, `addFromBoop`, `adding`). Review hooks: `-etelSheet compose`, `-etelCompose photo|scan|draft`.
  - **The Hét tab reads the server's day judgement (B6 Évad S2, 2026-11-21).** `EtelStore.loadWeek(food:evad:now:)`
    fetches `GET /api/seasons/adherence` for the same seven days beside `getFuelWeek` (`EvadClient.adherence`), and
    `hetWeek(…, adherence:)` takes each answered day's **judged** flag and **kímélő** excuse from the server — the one
    judgement the Évad tab and Boop's AI also use ([`season.md`](season.md) §3.7). A day the server did not answer
    (offline, refused, an older server) keeps the local rule (`!isToday && fuelMode == nil && consumed.kcal > 0` —
    identical by contract), so the tab never goes blank. The amber kcal pill still means „over 110 %"; the server's
    ±10 % band is the Évad summary's notion.
  - **The Hét tab in tiers on the calendar week (`mezo-r36n9.200`, 2026-11-27, decisions #130/#131).** `EtelStore.weekOffset` (0 = this week, never > 0, ≥ −52) + `stepWeek(_:food:evad:now:)`; `loadWeek` reads `getFuelWeek` from `etelWeekMonday(of:offset:)` (Monday 00:00 in the phone's zone) and asks the adherence judgement only up to `min(Sunday, now)`; another week's scores are cleared before the new week's are read. `hetWeek` marks days after `today` as `future` (no kcal, never judged, note „még előtted” — never „nincs rögzítés”), and carries `carbsG`/`fatG`/`trainingDay`; `HetWeek` adds the carb/fat means and targets, `containsToday`, `elapsedDays`, `loggedDays`, `trainingDays`, `closestDay` (≥ 2 judged days) and `rangeLabel` (`hetRangeLabel`: „november 23–29." / „november 30. – december 6."); `hetWeekAgo` names the offset. The tab: week stepper (SF chevrons, 44 pt) → hero glass card (`NKStatRow` over a paged kcal / protein `WeekBars`, dots; stacked at accessibility sizes and under VoiceOver) → `NKHighlight` → **A NAPOK** as a free-standing `NKCarousel` of glass day cards (no card around the row, #131; opens on today via the carousel's new `initial:`; future cards faint and disabled) → **A HÉT RÉSZLETEI** glass card (seven logged-day dots, three macro mean bars, edzésnap / kihagyott / kímélő / legközelebb a célhoz rows, the score-gap pill, the footnote). `WeekBars` gained `lit:` (the lit bar; a past week passes `.some(nil)`). The day sheet is unchanged.
  - **The Receptek and Kamra tabs in tiers (`mezo-r36n9.207`, 2026-11-28, decisions #119/#120/#131).** Both tabs drop the bare `NKBare` blocks for the Ma/Hét tiers: a private `card()` helper (`NKBare` + `.padding(16/12).nkGlass(24)`) per section and a hero glass card (`.nkGlass(28)`) on top. **Receptek** (`EtelReceptek`): hero *A RECEPTKÖNYVED* = `recipeStats` over `EtelMixBar(recipeSlotMix)` (the slot mix, lit from the first slot down) — shown only for a loaded, non-empty library; *ÚJ RECEPT* card (the four `recipeEntrances` tiles); *A LEGJOBBAK NEKED* = a free-standing `NKCarousel` (never inside a card, #131) of `recipeTopPicks` (scored recipes, best first, at most five; none below three scored), each a glass card with the photo (`NKCardPhoto`, glyph fallback), the score ring, slot · kcal · protein, one VoiceOver label, tap = `onOpen`; *A KÖNYVTÁRAD* card (search, slot chips, rows unchanged; trailing count). **Kamra** (`EtelKamra`): hero *A POLCOD* = `shelfStats` over `EtelMixBar(shelfNovaMix)` (NOVA 1–2 / 3 / 4 / unknown, empty groups left out, unknown drawn quiet white); *FELVESZEK EGYET* card (the four add chips, a 2 × 2 `Grid` at accessibility sizes); *A KAMRÁD* card (search, category chips, „Még N tétel", catalog; trailing count); *BEÁLLÍTÁSOK* card. At the accessibility text sizes the heroes stack their numbers one per line (`EtelHeroStats`, in place of `NKStatRow`'s three columns) and the *ÚJ RECEPT* tiles go one column with free height. `EtelMixBar`/`EtelMixPart`/`EtelHeroStats` live in `EtelReceptek.swift`; tests in `RecipeImportReviewTests` (`theTopPicks…`, `theSlotMix…`) and `EtelKamraTests` (`theProcessingMix…`).
  - **The Hét tab on the warm blocks (`mezo-r36n9.109`, 2026-11-19).** Head: `hetVerdict` (the week's mean kcal and whether it closed under or over the target, judged days only). Blocks: `NKHighlight` *A HÉT EGY MONDATBAN* from `hetObservation` (rule-based, judged days only, nothing under two: the protein gap when it hits at least half the days, else days >110 % of target, else ≥2 skipped days, else "rendben"); `NKStatRow` (`hetStats`); kcal + protein `WeekBars` with legend pills; day rows (weekday disc, pills — kcal/target amber when >110 %, protein lit when ≥90 % of target, még tart, kímélő, kihagyva — and the day's `EtelScoreRing`); details as pills. `HetDaySheet`: pills, four `NKLevelBar` macro rows against the target, meal rows with pills and score rings, the eyebrow as `hetDateLabel` ("november 18.").
  - **„Ezt főztem" + the shared review's three faces (`mezo-r36n9.63`, iOS half built 2026-11-19; spec [`2026-11-17-boop-ezt-foztem-design.md`](../superpowers/specs/2026-11-17-boop-ezt-foztem-design.md), plan [`2026-11-17-boop-ezt-foztem.md`](../superpowers/plans/2026-11-17-boop-ezt-foztem.md); screenshots `docs/superpowers/specs/assets/ezt-foztem/built/`).** Receptek's „ÚJ RECEPT" opens with the lit **„Ezt főztem"** tile (`recipeEntrances`, always shown). The capture sheet (`Etel/CookedCapture.swift`, state in `BoopCore/Etel/CookedCaptureModel.swift`): a text field, a mic row and a photo strip of up to six (camera or a multi-select library picker capped at the free slots, `PhotoCapture.photoLibrary(limit:)`; every photo re-encoded to JPEG), then **Elemzés** → `FoodClient.cooked(text:photos:)` (`POST /api/recipe/cooked`; the photo parts are sent as raw multipart parts with `Content-Type: image/jpeg` — the generated part type would say `application/octet-stream`, which the server refuses). Working face = `MealScanView` (first photo → scan line, text only → orb; still when motion is reduced) with its own phrases; `result: null` → „Ebből nem tudtam hozzávalókat kiolvasni."; failures keep the text and photos (offline: „Nincs net. A szöveged megmarad, próbáld újra."). **Dictation** (`BoopCore/Etel/Dictation.swift`, `VoiceDictation`) reuses `VoiceJournal`'s recorder + on-device recogniser but never uploads: a recording the phone could not write down is deleted; the transcript is appended to the field after stop; mic/speech denied or no on-device Hungarian → the row says so and the field still works (the microphone and speech `INFOPLIST_KEY_*` strings already existed — no project edit). The draft lands in the **same review every route ends in** (`ReviewBody`, now `Etel/RecipeReviewBody.swift`; logic `RecipeReview`/`reviewRowFace` in `RecipeImport.swift`, tested in `BoopTests/RecipeReviewTests.swift`): one tile per ingredient — state dot (tick / amber „?" / dashed „+"), name, the said phrase in quotes, facts as pills (`felveszem a kamrádba`, `ez az?`, `mennyiség?`, `írd be a mennyiséget`, `nincs a kamrádban`, `becsült`, `saját adat`), a stepper whose unit is the food's own basis unit as a fixed label once the row has a food, and the actions **Ez az · Másik · Kiveszem** (confirm) / **+ Kamrába · Másik · Kiveszem** (missing); a waiting row has the amber border and holds both save buttons. **Mind rendben** confirms every waiting row except one with no amount (an unstated amount arrives as 0 and must be typed — the server refuses 0). **Másik** (`ReviewOtherPicker`) lists the server's runners-up, then searches the shelf (his own unreviewed foods included) and the shared catalog; a pick rebinds the row and converts the amount with `reviewAmount` (the phone's mirror of the server's `PantryUnits`: same family exact, g↔ml or a piece = doubtful). **+ Kamrába** → `quickAddPantry(name:)` (spinner „Felveszem…", a second tap ignored, 409 opens `PantryAddSheet(.manual)` prefilled with the name over the review, other failures say so with „Újra"); the row then shows only `becsült` and a quiet **„Tápérték megadása"** link — no numbers on the row — which opens kcal / fehérje / szénh. / zsír per 100 g/ml prefilled; **Kész** saves only a change through `setFacts` (`PUT /api/pantry/{id}` without a source → the server stops calling it an estimate; tag → `saját adat`), **Minden adat a kamrában** opens the full pantry form in replacing mode. Exits **Mentem a receptjeim közé** and **Mentem, és rögzítem mára** (save, then `EtelStore.logRecipe` for one serving, one toast). Every save of one review carries one `NewRecipe.clientRef` (sent as `RecipeRequest.clientRef`), and a saved review never saves again. The link/text/photo import and the workshop get the same faces (the workshop row's state is phone-derived: shelf id → matched, none → missing).
  - **Kamra: the food score, `becsült` and „Pontosítom" (`mezo-r36n9.63` / `.101`).** Shelf and catalog rows carry the server's own `score` (`IngredientResponse.score` / `PantryCatalogEntry.score`, ring via `etelPoints`; nil = „–", never 0) and `estimated`; the item page's breakdown comes from `FoodClient.pantryBreakdown` (`getPantryItemBreakdown` by shelf id, `getPantryCatalogBreakdown` by catalog id; five dimensions, no prose). The DEBUG stand-in scores are gone. An estimated food wears an `EtelPill("becsült", .warn)` on its row and page, and the page has a **PONTOSÍTOM** card (Vonalkód / Címkefotó / Kézzel) that opens `PantryAddSheet(route:, replacing:)` — `PantryAddModel.Mode.replacing` saves through `FoodClient.replaceFood` (`PUT /api/pantry/{id}` with the reader's `source` and barcode), never a second food; a reader that brings no name keeps the food's own.
  - **Not in B4 (honest list):** the scanned barcode is not saved on the meal, so a code photographed once is a miss again next time (follow-up bd issue); no thumbnail on Ma's timeline meal rows; the shelf is read-only apart from add (no edit/delete of a food); Hét cannot name *which* meal was skipped (the week rollup carries only skipped kcal); `recipe.timesLogged` is always 0 so iOS does not show it; ~~no link-an-unmatched-ingredient-to-a-food step in the import review~~ (built by „Ezt főztem": „Másik" and „+ Kamrába").

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
  re-sends yesterday … today + 8 (B7 K1). **B1:** the code also wakes on new Health data in the background (`HKObserverQuery` +
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
  - **Calendar history.** `calendar_event.external_id` (EventKit external id + occurrence), unique per `(created_by, external_id, date)`; for each sent day, live rows missing from the payload are soft-deleted (cancelled event); the phone's first sync after B7 K1 backfills 60 past days (key `boop.calendar.backfilled.v2.<user>`; the old key re-runs it once so old events gain the new fields), then sends yesterday … today + 8; the server upserts by `external_id` (soft delete for cancelled events, cap 31 days per request) and finders exclude deleted rows. A replace publishes `CalendarDaysReplacedEvent`, which makes the capacity feature score the coming days in the background ([`capacity.md`](capacity.md)).
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
    `buildCalendarDays` → yesterday … today + 8, each event with attendee count + names, organizer-is-me, location, recurring, availability and notes (≤ 2000), mezo-r36n9.17); S3: `Morning/` (`Brief`, `MorningClient` + `MorningStore`, `PathBuilder`, `Lens`, `BoopVoice`).
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

> **2026-11-28 — the Évad room, the weekly review, the Étel menu move and the „Menübe jöhet" toggle add no backend change and no new API operation** (`mezo-r36n9.196`): everything reads and writes through the existing `/api/seasons/**` calls (`EvadClient`, `EvadMenuStore`); the review's done mark is phone-local.

**S2 — feature `wearable`** (contract tag `Wearable`, `api/feature/wearable/wearable.yml`):

| Operation | Endpoint | Stores |
|---|---|---|
| `ingestSleepNights` | `POST /api/wearable/sleep-nights` → `IngestResult{inserted,updated}` | `sleep_log` upsert by `(created_by, external_id)`, `source = 'apple_health'`, stages + hypnogram |
| `ingestDailyMetrics` | `POST /api/wearable/daily-metrics` | `daily_metric` upsert by `(created_by, date)` — steps, active kcal, resting/avg/min/max HR |
| `ingestWorkouts` | `POST /api/wearable/workouts` | `wearable_workout` upsert by `(created_by, external_id)`; date = local start day (Europe/Budapest) |
| `replaceCalendarDays` | `PUT /api/wearable/calendar-days` → 204 | `calendar_event`: upsert by `external_id`, live rows of a sent day missing from the payload soft-deleted (B7 K1; was hard-delete + replace); carries attendee/location/recurrence/availability/notes fields |

**B1 additions** (same tag, plus `Device`): `ingestHealthSamples` `POST /api/wearable/health-samples` (upsert into `health_sample` by `(created_by, external_id)`), `deleteHealthRecords` `POST /api/wearable/deletions` (soft delete workouts/samples/weights by external id), `SleepNightBatchRequest.windowFrom/windowTo` (window deletion above), widened `DailyMetricIn`/`WorkoutIn` (distance, max HR, source bundle) and `SleepNightIn` (`sourceApp`, `sleepingHr`), calendar days carry an `externalId` per event, `registerApnsDevice` `PUT /api/devices/apns` → 204 and `unregisterApnsDevice` `DELETE /api/devices/apns/{deviceId}` → 204 (contract `api/feature/device/device.yml`).

Caps (`mezo.wearable`): 100 nights, 120 days, 300 workouts, 31 calendar days × 150 events per request →
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

**The capacity ledger in the brief (B7 K3, `mezo-r36n9.17`).** The brief's day follows what the owner accepted:
- The session is the one moved onto the day, never the one moved away from it (train's ledger-aware resolution).
- Its planned time comes from the plan day's gym slot.
- An accepted time shift wins over a `workout_time_override` for the same day. Both are read, with no migration.
- Sets and minutes follow an accepted lighten or shorten.
- `day.bedtimeTarget` is the night's accepted bedtime (`BoopDayAdjustmentPort`), else the sleep goal's.
- These session reads all go through train's `EffectivePlanService.plannedSession`, the same helper the chat context uses.

Details: [`capacity.md`](capacity.md) §4.

iOS also uses the existing `decidePattern` for the observation swipes. `BoopBrief` carries `date`, `generatedAt`, `state`
(`good|okay|tired|learning`), `nightsKnown`, `metrics[5]` (`forma|alvas|mozgas|fuel|pulzus`: nullable `score`, `display`, `caption`,
`headline`, `sentence`, `trendUp`), `brief[]` (text + link), `energy{hourly[19], dipHour}`, `tonightTip`, `nextMealTip`, `conflict`,
and `day` (sleep + hypnogram stages 0 awake · 1 REM · 2 light · 3 deep, week series, `hrToday{min,avg,max}`, steps, session, meals,
check-ins, intention, observations, calendar `busySlots[72]` = 06:00–24:00 in 15-minute slots, weight, recovery). Nullable by design:
session minutes/time/plannedTime, sleep stage minutes, sleep `bedtime`/`wakeup` (a night may be logged without times) and `day.steps` /
`day.activeKcal` (null without a wearable day, never a fake 0).
**B7 K1:** the brief also carries a nullable `capacity` block (verdict `laza|rendben|szoros|tulSok`, reason line, ratio, `tanulo`, demand items, capacity factors) and `energy.hourly` is bent by the day's demand; null when `mezo.capacity.enabled=false` or the capacity read fails. **K2 Task 9** draws it: `Brief.capacity` (nil = Ma unchanged), the verdict row in Ma's plan card, the day page blocks (`Nap/DayCapacity.swift`) and the event label through `KapacitasClient` (lenient `RawJSONClient`, `putCapacityEventFeedback`; env `\.kapacitasClient`). Final fix: the row's „te: …" and the sheet's pre-selection come from the item's server `effect` (survives a relaunch); a run of labels reloads the brief once (`KapacitasReloadGate`); the Évad chart draws a lone lived week's recovery as a tick and its footnote uses `evadLoadFootnote` / `hungarianArticle`. See [`capacity.md`](capacity.md) §2, §4.

**B1 tables** (changesets `202611111000…202611111130_mezo-r36n9.11_*.sql` in `1.1.0/script/`): `health_sample` (`created_by`, `external_id`, `metric`, start/end, value, unit, source name/bundle, device, user-entered; unique `(created_by, external_id)`, index `(created_by, metric, start_at)`); `daily_metric`, `wearable_workout` widened; `sleep_log` + `source_app`, `sleeping_hr`, `source` now `varchar(16)` (`manual|screenshot|apple_health`), generic dedup then `uq_sleep_log_owner_date_live`; `calendar_event` + `external_id`; `weight_log` + `source`, `external_id`; `apns_device` (device id, token, environment `sandbox|production`, bundle id, app version, last seen, invalidated at).

Tables (changeset `202611101300_mezo-r36n9.7_boop_brief.sql`, both soft-delete, partial unique indexes `where is_deleted = false`):

| Table | Columns | Unique |
|---|---|---|
| `boop_brief` | `created_by`, `date`, `payload jsonb` (the `BoopBrief` as JSON), `input_hash varchar(64)`, `regen_count int ≥ 0` (`ck_boop_brief_regen_count`), `generated_at` | `uq_boop_brief_user_date (created_by, date)` |
| `workout_time_override` | `created_by`, `date`, `time` | `uq_workout_time_override_user_date (created_by, date)` |

Tunables (`mezo.boop`, `BoopProperties`): `steps-goal` 9000, `regen-per-day` 3, `nights-needed` 14, `llm-timeout` 8s.

### Sport S1 — gym and sport as two layers on the brief (`mezo-r36n9.201`, 2026-11-27, backend only)
`BoopDay` (the brief's day sheet) gains **`sport[]`** (`BoopSport {sport, time, minutes, done, doneMinutes, avgHr}`)
next to the gym `session`; it comes from `WorkoutWindowQueryService.windowsFor` (slots + events − skips). Done is
matched **by kind** (`BoopDayAssembler.training`, pure `BoopWorkoutKinds`): a finished gym instance or a strength
Health workout ticks the gym; a sport log (the resolver pairs it with the nearest plan) or that sport's own Health
workout (`volleyball`, `running`, `cycling` for bike, `hiit` for cross/TRX, …) ticks the sport; Health `other` ticks
neither. Before S1 any logged sport or any ≥ 20 min workout near the gym window ticked the gym. The brief fingerprint
adds a `|sport:` part only when the day has sport (sport-less days keep their hash). The Sport area (S3, `mezo-r36n9.203`)
reads the S2 overview (`GET /api/train/sport/overview`) instead; the Edzés room can read `sportToday[]` on the today workout read (`train.md` §4).

### Sport S2 — the Sport read models (`mezo-r36n9.202`, 2026-11-28, backend only)
Five GETs under `/api/train/sport/` — `overview` (the week's two lanes, totals, week count, tonight incl. the
unmatched Watch workout for pre-fill, hints), `load` (6 weeks, session-RPE × minutes), `body` (muscle heat gym /
sport / together), `shoulder`, `gaps`. Rules and shapes: [`train.md`](train.md) §4 *Sport / volleyball · cross ·
TRX*. Not yet in the app's generator filter — S3 (`mezo-r36n9.203`) adds them and builds the Sport area.

### B3 API operations (the generator filter, `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`)

Added to the `filter.operations` list in B3: `listCheckInsForDay`, `saveCheckIn`, `getCheckInPlan`, `getIntentionDay`, `addFocus`, `removeFocus`, `createJournalEntry`, `transcribeVoiceNote`, `putDayClose`, `getDayClose`, `listDayCloses`, `generateDayCloseLine`, `generateCheckInLine`, `listConversations`, `createConversation`, `listMessages`, `sendMessage`, `getDayContext`. Contract changes behind them (`api/feature/{biometrics,intention,journal,dayclose,companion,boop}`): `CheckInSnapshot`, `capturedAt` on check-ins, `clientRef` on goals and journal entries, the whole `DayClose` tag, conversation `channel`, `GET /api/companion/day-context`, and `BoopSession.done` / `planGoals` on the brief. Write ordering and idempotency are described in §3.

### „Ezt főztem" API operations (`mezo-r36n9.63`, backend half — added to the same generator filter 2026-11-19)

`cookedRecipe` (`POST /api/recipe/cooked`, multipart `text?` + `photos[]?`), `quickAddPantryItem` (`POST /api/pantry/items/quick-add`), `updatePantryItem` (`PUT /api/pantry/{id}` — „Pontosítom" and the facts form), `getPantryItemBreakdown` and `getPantryCatalogBreakdown` (a food's own score). `openapi.yaml` is re-synced; the generated types now carry `RecipeImportMatch.{state,onShelf,basisUnit,amountDoubt,alternatives}`, `RecipeRequest.clientRef`, `PantryItemRequest.barcode`, `estimated` / `score` on the pantry rows and `PantrySource.ai_estimate`. The iOS half (2026-11-19) uses all five through `FoodClient.{cooked,quickAddPantry,setFacts,replaceFood,pantryBreakdown}` and sends `RecipeRequest.clientRef` from `createRecipe` (§2 *„Ezt főztem"*); `PreviewTransport` answers each of them. Server behaviour: [`recipe.md`](recipe.md) §9 *„Ezt főztem"* / *The review row*, [`pantry.md`](pantry.md) §4.

### B4 API operations (added to the same generator filter)

`getFuelDay`, `getFuelWeek`, `getFuelPlan`, `getUsualMeals`, `draftMealFromAi`, `createMeal`, `logWater`, `getMealCoachForDay`, `upsertPlannedSkip`, `listPlannedSkips`, `undoPlannedSkip`, `listRecipes`, `getRecipe`, `createRecipe`, `recipeLogs`, `getRecipeBreakdown`, `workshopTurn`, `importRecipeFromUrl|Text|Photo`, `getRecipeImage` / `putRecipeImage` / `deleteRecipeImage`, `getPantry`, `searchPantryCatalog`, `lookupPantryItem`, `importPantryItem`, `scrapePantryItem`, `photoExtractPantryItem`, `createPantryItem`, `addPantryItemFromCatalog`, `getSensitivityProfile` / `setSensitivityProfile`, `getDietSettings` / `setDietSettings` / `previewDietSettings`, `getFuelSettings` / `setFuelSettings`, `getProtocol`, `addProtocolItem` / `patchProtocolItem` / `deleteProtocolItem`, `logIntake` / `deleteIntake`, `getMealPhoto` / `putMealPhoto` / `deleteMealPhoto` / `deleteAllMealPhotos`, `getRecovery` / `upsertRecovery` / `deleteRecovery` / `recoveryCheckIn` — the filter file is the truth (an operation not in it is not generated). Preview mode (`PreviewTransport`, DEBUG) answers every one of them statefully.

### Backdated capture + drinks + the gym catch-up (added to the same generator filter, 2026-11-24)

`completeWorkoutAsPlanned` (`POST /api/train/workouts/as-planned`, `mezo-r36n9.161`) and `listJournalEntries` (the Napló day sheet's A NAP SORAI, `mezo-r36n9.159`); the drink slot widened `MealRequest.slot`, the usuals query and `UsualMeal.slot` (`mezo-r36n9.160`). 232 operations in the phone's copy after the sync.

### B5 API operations (added to the same generator filter) — Edzés, stage 1

34 train operations (29 + the five of `mezo-r36n9.66`, listed last; the block builder's own `getBlockExerciseSuggestions` is hand-decoded — see below, not in the generator filter): `getTodayWorkout`, `startWorkout`, `logWorkoutSet`, `updateWorkoutSet`, `deleteWorkoutSet`, `saveWorkoutFeedback`, `skipWorkoutExercise`, `changeWorkoutExercise`, `addPlanWorkingSets`, `saveExerciseNote`, `saveWorkoutNote`, `finishWorkout`, `listWorkouts`, `getWorkoutDetail`, `getExerciseCatalog`, `getExerciseRecords`, `listMesocycles`, `getMesocycleReport`, `getMesocycleVolumeArc`, `generateMesoPlan`, `createMesoTemplate`, `startMesoTemplate`, `listMesoTemplates`, `getGymSchedule`, `getTodayReadiness`, `chooseTodayReadiness`, `listSportSessions`, `logSportSession`, `getSportSchedule`, `getGymProfile`, `putGymProfile`, `markExerciseDiscomfort`, `clearExerciseDiscomfort`, `getExerciseSubstitutes`. **No contract change and no Liquibase** — the training API already existed for the web app.

`TrainClient` (`BoopCore/Train/`) wraps them behind plain value types (`TrainModels.swift`), with two rules the room's honesty rests on: **an absent server value stays `nil`, never `0`** (with the hypertrophy engine off the server sends only warmup/working *counts*, so the set rows carry no weight rather than printing the plan's anchor weight as a per-set target), and **wire enums read leniently**, so a value the server adds later degrades instead of emptying the room. `blockPlan()` returns an optional — no running block is a state the Blokk tab shows, not an error — and merges two reads (the block's MEV/MAV/MRV landmarks and days, plus the volume arc's per-week planned/actual sets).

**The write side is the outbox's** (`TrainClient: OutboxSender`, eight appended `OutboxKind` cases: `workoutStart`, `workoutSet`, `workoutSetEdit`, `workoutSkipExercise`, `workoutFeedback`, `workoutNote`, `workoutFinish`, `sportSession`; `RitmusClient.send` routes them). Two things make it safe with no `clientRef` on `/api/train/*`:

- **The server's start is idempotent on the template day** — `POST /api/train/workouts` answers *201 with the open instance* when one exists, so a replayed start never creates a second workout. The two 409s (`TRAIN_WORKOUT_OPEN_ELSEWHERE`, `TRAIN_DAY_DONE_THIS_WEEK`) are refusals with a meaning, not retries: the item fails with the server's own code and the room says what happened.
- **A queued write names a local `workoutRef`, never a server id**, because the workout may not exist yet when a set is logged without signal. `OutboxItem.groupRef` (appended, optional) carries it and is the item's **order group** — one workout is one chain, and a second session is a separate group, so one stuck session never holds another back. This is the first group keyed by something other than the date. The id is resolved at send time (what the run learned → today's open workout → today's completed workout) and **no queued payload is ever rewritten**.

### Éves terv calls (`mezo-r36n9.113` S3+S4, same hand-decoded rule — `BoopCore/Train/YearPlanWire.swift`, `PlanClient`)
`yearPlanPreview` (`POST /api/train/year-plans/preview` → `WireYearPlan`), `createYearPlan` (`POST /api/train/year-plans`; 409 `TRAIN_YEAR_PLAN_ACTIVE_EXISTS` without `replaceActive`), `activeYearPlan` (`GET /api/train/year-plans/active`; 404 `TRAIN_YEAR_PLAN_NONE` → `nil`, the empty state), `patchYearBlock` (`PATCH …/blocks/{id}` with `WireYearBlockPatch` — focus, weeks, ordinal, shiftWeeks, skip, linkRunning; 409 `TRAIN_YEAR_BLOCK_LOCKED`), `archiveYearPlan` (`POST …/{id}/archive`). `WireYearPlan` decodes the required numbers/statuses **strictly** (a miss is an error, never an invented value) and the optional lists leniently; unknown note/next codes pass as plain strings. The new-block calls gain `consolidation` (candidates, generate) and `startMesoTemplate` an optional `yearBlockId`. Cache: `ServerCache` endpoint `train/year-plan` (14 days); `YearPlanModel` keeps a cached plan's age and never offers the Következik card from it.

### Block builder + weekly review — the hand-decoded calls (`mezo-r36n9.83`, 2026-11-19)

The builder and the review **do not use the generated client**. The generated code decodes every enum strictly, and the
technique planner (T3) adds proposal line kinds (`technique`, `rep_range`), reason codes and evaluation fields while these
screens are live — one unknown value would fail the whole response. So `RawJSONClient` (`BoopCore/Train/PlanTransport.swift`)
sends JSON over the **same** `ClientTransport`, base URL and bearer token as the generated client (`Session.raw`), and
`PlanWire.swift` declares hand-written `Decodable` shapes whose enums are plain `String`s. `PlanClient` wraps 15 operations (the first nine below, then the six of the new-block flow):
`listMesocycles`, `getExerciseCatalog`, `evaluateMesoPlan`, `listWeekProposals`, `decideWeekProposal`, `replaceDayExercises`,
`updateMesocycleMusclePriorities`, **`blockSuggestions`** (`mezo-r36n9.116`: `POST /api/train/mesocycles/{id}/exercise-suggestions`
→ `PlanWire.BlockSuggestions*`, each suggestion with an optional style `prescription`; `scripts/check-ios-contract.mjs` now also
covers these raw-client operations), and **`updateMesocycleSettings`** (`PUT /api/train/mesocycles/{id}/settings`
`{trainingStyle?, techniquesEnabled?, weeklyReviewMode?}`, absent = keep; the run's own review mode overrides
`mezo.volume.weekly-review.mode`; `MesocycleResponse.weeklyReviewMode` is the effective mode — `docs/features/train.md` §4).
**New-block calls (`mezo-r36n9.113`, same hand-decoded rule — enums are plain strings, so a new fix or reason code never fails the response):** **`candidates`** (`POST /api/train/meso-plans/candidates` → `PlanWire.WireCandidates {candidates[], nothingFits, fixes[]}` with `lead`, each candidate its `splitKey`, `splitLabel`, `template`, `evaluation`, `recommended`, `reasons`), **`generate`** (`POST /api/train/meso-plans/generate` with `split` = the candidate's key → `WireGenerateResponse`), **`createTemplate`** (`createMesoTemplate`, returns the template id), **`startTemplate`** (`startMesoTemplate` `{startDate, status}` → the block) **`closeBlock`** (`closeMesocycle`) and **`discardBlock`** (`discardMesocycle`, the *Mégsem, eldobom* path; 409 `TRAIN_MESO_DISCARD_HAS_LOGS` when a workout is already logged). `WireCandidates` also carries `intakeBudget` (`WireIntakeBudget {usedSets, capacitySets?, emphasizeCount, emphasizeMax, raiseAllowed}`), `WireFix` an optional `muscle`, `WireGenerateRequest` optional `sessionMinutesTarget` + `sportGroups`. The builder's evaluate request always carries each row's `restSec` (minutes model v2 prices every set with its rest). `evaluate` and the builder's `WireEvaluation` carry the new `budget`, `basis` and `consecutiveHeavy` fields. **The BoopAPI generator filter is untouched.** Typed failures: `PlanFetchError` (`offline`, `unauthorized`, `notFound`,
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

- **Backdated capture, catch-ups and drinks (2026-11-24, `mezo-r36n9.159`–`.161`):** BoopKit `WhenTests` (window, clamp, labels, toast, sleep note), `NaploWeekEntriesTests`, `NaploCatchUpsTests` (today's passed moments at the 10:00 / 14:30 edges, a past day's three doors, nothing outside the week), `CheckInCatchUpTests` (the moment's own time, the eyebrow, 21:00), `RitmusClientTests` (+ journal lines), `MealCaptureKindTests` + `FoodOutboxTests` (an offline drink stays a drink), `AsPlannedTests`, `TrainAsPlannedClientTests` (clientRef = item id, a 409 is final), `OutboxTests` (+ the booking's group) — native on this Mac; app `QuickSheetsWhenTests`, `NaploCatchUpModelTests`, `CheckinFlowTests`/`EsteFlowTests` (+1 each), `MealComposerTests` (+1), `MealComposerDrinkTests`, `EtelDrinkRowsTests`, `WorkoutAsPlannedModelTests`, `NapkelteTokensTests` (+ `cup-cream`) under `xcodebuild test` on the Xcode Mac; backend `MealSlotsTest`, `UsualMealRankerTest` (+1), `MealDrinkApiIT`, `WorkoutAsPlannedIT` (8).
- **Sheet close + quick doors + the Súly area (2026-11-24, `mezo-r36n9.156`–`.158`):** Merged in `a32ba6cdc` after a fresh-context review whose four important findings were fixed with failing tests first (the scale's weigh-in re-read on scene active / room open, the trend's own direction words, the close button honouring the saving guards, a fault after offline keeping the age); the full native BoopCore suite then stood at 995 tests in 97 suites. BoopKit `SulyLogicTests` + `SulyHeadTests` (the pace score's bands, the head's words), `SulyClientTests` (trend, logs, profile, typed faults), `SulyStoreTests` (score from trend + season, no season, insufficient data, offline cache with age, body samples from a stub `HealthReader`, the BMI), `SulyRowsTests` (weeks, curve, BMI, latest sample) — 41 tests, run natively; `NapkelteTokensTests` (the gold world, the body glyph, the tab marks); app `KezdolapRingTests` (nine areas, the Súly orb's number and dash), `CaptureSheetTests` (the five doors and their picks), `MaiCopyTests` (hue count + 3), `RitmusTickTests` (the weight tick) — compile for the Boop test bundle, run on the Xcode-ready Mac (`mezo-r36n9.150`). Flags: `-previewHome suly -sulyTab …`, `-sulyState …`.
- **Home ring numbers + quick log (2026-11-24, `mezo-r36n9.151`–`.154`):** BoopKit `FoodPhotoPartTests` (the photo parts say `image/jpeg`), `OrbScoreTests`, `PenzWeekShareTests`, `QuickLogTests` (night length, sports), `QuickLogSenderTests` (weight / sleep senders, refusal, queue groups) — the **whole BoopCore suite, 951 tests in 92 suites, ran natively on macOS** with no skips once `PenzStore.read` stopped using `async let` (§9; the new Mac has no Developer Mode for the simulator runner); app `KezdolapRingTests`, `CaptureSheetTests`, `MaiCopyTests.learningKeepsTheOtherFourScores` compile in the Boop test bundle and run on the Xcode-ready Mac (`mezo-r36n9.150`). Flags: `-previewOpen water|supplements|sport|weight|sleep|journal`, `-previewLearning YES`.

- **Levél (2026-11-21):** BoopKit `LevelLogicTests`, `LevelClientTests`, `LevelWallTests` (793 BoopKit tests at the last run); app `LevelRoomTests` (23) and `WallNotifierTests` (20+: ring time clamp, cap per fire day, seen-today, per-user isolation, overlapping reconciles, markSeen during a reconcile); the Boop scheme ran 480 tests. Pre-existing flakes, not Levél: `EdzesSwapTests.overlappingSavesLeaveTheStoreAsTheServerHasIt`, `MorningClientTests.movingIsTrueOnlyWhileAMoveIsInFlight`.

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
- **B6 Évad S1** (`BoopKit-Package`): `EvadClientTests`, `EvadStoreTests`, `EvadLogicTests` (see [`season.md`](season.md) §8); app `ShellTabTests` and kit `NapkelteSpineTests` pin the „Évad" label.
- **B6 Évad S2**: kit `EvadWallTests` (no season → no candidates, season end `.happened`, learned insight `.improves`), `EvadLogicTests` (Hogy megy facts, excused line, `sleep_food` line), `EvadClientTests` (adherence path); app `EtelHetTests` (server days = local rule, the server's kímélő day and judged flag win, an unanswered day keeps the local rule).
- Not in CI (`ci.yml` does not build `ios/`); run locally.

## 9. Decisions, gotchas & deferred

- **Recipe toggle = full-set write (2026-11-28, `mezo-r36n9.196`, decision #137).** The server takes the **whole allowed-recipe set** (`EvadClient.putRecipes`), so every „Menübe jöhet" tap in `EvadMenuStore.setAllowed` is a read-modify-write. Two quick taps must keep **both**: the store keeps the unconfirmed taps in `desired`, `allowedIds` applies them on top of the last server answer, and taps made while a write is under way ride the next loop iteration. Never build the set from the server answer alone, and never queue a toggle offline — it refuses with „Ehhez internet kell." and leaves the set as it was. A recipe that does not fit his rules (`usable == false`) cannot be switched on.
- **One destination type, no spine (2026-11-28, `mezo-r36n9.196`).** Every cross-page jump goes through `openDestination` → `RitmusRouter.go` → `KezdolapView`, which closes an open route and then opens the new one after 0.5 s (a room cannot be swapped in place; opening both at once drops the second). `BoopDestination` is the only vocabulary (`.nap(tab)`, `.chat`, `.room(RoomEntry)`, …); `RitmusRouter.destination` holds the pending one and `takeDestination()` consumes it exactly once. Never reintroduce a place/tab enum or a per-screen `openPlace`; a new "go to X" link adds a `BoopDestination` case. `homeDestination(restored:)` maps the old persisted place once on launch (Napló → Nap › Napok, Boop → chat, Évad → Évad room, else the ring). The floating "+" is hidden on the chat and lifted above a room's bar — a new room bar must raise it too.
- **Mezociklus management ships as one server step per lifecycle action (2026-11-26, `mezo-r36n9.177`).** Restart, run-again and close are single endpoints, not phone-side chains, so a failure leaves nothing half-done; a tap on a card only navigates (starting is the bottom bar's job, behind a confirm when a run is active). The missed-workout count is shown only when computed from logged data; Boop's evaluation arrives minutes after the close. The template is only overwritten on „A sablont is frissítem" / „Mentés a sablonba".
- **A photo draft needs a funded vision provider (2026-11-24, `mezo-h38eq`).** After the JPEG multipart fix, two live meal-photo analyses still failed before the draft: Gemini returned `402 prepayment credits are depleted`. The server's common vision route now uses OpenAI `gpt-5.6-luna` in production ([ADR 0059](../decisions/0059-route-vision-to-openai.md)); the installed Boop app needs no update for this server-side change. The sound-transcription route remains on Gemini.
- **A contract edit is not live until the fragments are merged (2026-11-24).** `api/openapi.yml` is the bundle the backend's generator and `sync-openapi.sh` read; editing `api/feature/*.yml` alone changes nothing — run `cd api/generate && npm run generate:api` first (the worktree needs that folder's `node_modules`). Two test runs were lost to this in `mezo-r36n9.160`.
- **The design kit has no BoopCore dependency (2026-11-24, `mezo-r36n9.159`).** `NKWhenRow` therefore takes primitives (the resolved label, which chip is on, the picker binding and range, callbacks); the app's `WhenRow` binds `WhenChoice` to it. Keep kit views free of core types.
- **A catch-up is stamped at the moment's own time, never „now" (2026-11-24, `mezo-r36n9.159`).** The server keeps one instant per check-in (`savedAt`) and the phone draws the energy dot and reads the Health snapshot around it; a dél caught up at 21:40 would otherwise land at 21:40 with today's pulse. The same for the close (21:00). The „utólag" marker was dropped for that reason (no second instant to derive it from).
- **A drink captured offline must carry its kind (2026-11-24, `mezo-r36n9.160`).** `MealDraftSender` computes the draft later with the drafter's slot; `MealCapture.kind` pins `drink` on it. An older queue without the field decodes as a meal.
- **A booked workout's 409 is final (2026-11-24, `mezo-r36n9.161`).** `TrainClient.map` retries most 409s; the as-planned sender returns `.failed` with the server's words instead, so the Napló's row says „Ezen a héten már megvolt." rather than waiting.
- **The gym door reads the week and the queue (2026-11-24, `mezo-r36n9.161`).** `gymDone` (BoopCore `AsPlanned.swift`) counts a template day done when the server's history has it completed on any day of the date's Mon–Sun week (D5) or a `workoutAsPlanned` booking for it still waits in the outbox (`asPlannedBookings`); a live session on the phone (`EdzesStore.sessionFile`) hides the door. Found by the final review: the door reappeared after an offline Megvolt and offered days the server would refuse. A drink card from the queue carries `PendingDraft.kind`, so the composer reopens it in drink mode (`MealStart.kind`); the Recept/Kamra doors in drink mode go through the kind-aware `slot(at:)` too.
- **Covers over a sheet (2026-11-24).** The Napló day sheet presents its own `fullScreenCover`s (check-in, close) and `sheet` (Megvolt) from inside the sheet — the one exception to „presentations at page level", because the sheet is the day's page.
- **A generated multipart binary part has no content type (2026-11-24, `mezo-r36n9.151`).** The contract declares `photo: {type: string, format: binary}` without an `encoding` block, so swift-openapi-runtime writes `content-type: application/octet-stream` for `.photo(...)` — and the server's meal AI draft refuses any photo part whose type is not `image/jpeg|png|webp` (400 `VALIDATION_INVALID_VALUE photo`), the image store likewise. The owner saw „Most nem sikerült kiszámolnom…" on every photo capture, and no saved meal ever got its photo. `FoodClient.jpegPart` sends both parts as raw `.undocumented` parts naming `image/jpeg` (the „Ezt főztem" pattern); `FoodPhotoPartTests` pins it. Any new binary upload must do the same (or the contract must grow an `encoding` block and the generated part must be checked).
- **`.refreshable` leaks into every sheet below it (2026-11-24, `mezo-r36n9.156`).** The refresh action is an environment value: a `.refreshable` applied *outside* a view's `.sheet` modifiers reaches the sheets' content, and every `ScrollView` in them grows pull-to-refresh — a pull at a sheet's top then runs the page's reload instead of the drag-to-dismiss (the owner's „lehúzom és frissül"). Apply `.refreshable` to the page view itself, before the `.sheet` chain; `EnvironmentValues.refresh` is read-only, so it cannot be cleared inside the sheet.
- **Ten `async let`s abort the app (2026-11-24, `mezo-r36n9.153`).** `PenzStore.read` fired its ten reads as `async let`s awaited in two tuples; built with Xcode 26.3 (Swift 6.2, iOS 26.3) that aborts the process — `swift_task_dealloc` fatal error in `asyncLet_finish_after_task_completion` — the moment the store loads: in the simulator (the Pénz room, the "+" Kiadás sheet, and now the home ring) and natively (every Pénz client suite exited with signal 6). Rewritten as ten unstructured `Task`s awaited by `.value`: the 11 Pénz suites (114 tests) pass natively, the app launches. `LevelStore` (two async lets) and `BlockBuilderModel` do not trip it; prefer `Task {}` handles or a task group over long `async let` fan-outs.
- **"learning" is about Forma alone (2026-11-24, `mezo-r36n9.152`).** `BoopScores.stateOf` says `learning` whenever Forma is null (last night missing, or fewer nights than `nights-needed`); the app used to nil every metric's score in that state, so the whole ring and every hero read "–" while Alvás, Étel, Edzés and Energia had numbers. `visibleScore` keeps the four.

- **Capacity reason guard moved (B7 K3).** `BoopVerdictWriter.acceptReason` now delegates to the shared `techcore/text/DigitGuard` (same rule: the model's capacity reason is kept only if it brings no new digit run); the proposal wording in capacity uses the same guard. Behaviour unchanged (`BoopCapacityReasonTest`).
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
  draft. (4) `replaceDayExercises` keeps exercise ids when the list is the same exercises in the same order (updated in place, so a pending manual proposal's lines survive a builder save) and re-mints them otherwise: always re-read the block after a save before the next edit. (8) Technique + challenge together and the recommendation (`mezo-r36n9.98`, decisions #54/#55): `setTechnique`/`setChallenge` no longer clear each other (pill „Pihenős drop + kihívás”); the picker opens with a *Boop ajánlása* card from `MesoPlanEvaluation.recommendations` (server `TechniqueRecommender` = the planner's `defaultTechnique`; reason codes `stable_machine`, `isolation_pump`, `lengthened_safe`, `all_out`, `no_safe_technique` → `techniqueReasonText`; only for a block with a style and techniques on) plus the weekly AI's `note` for that exercise (`BlockBuilderModel.aiNotes`, from this week's proposal lines). **The challenge rule (decision #72, `mezo-r36n9.127`):** `DraftExercise.canTakeChallenge = challengeAllowed && judged`; `challengeAllowed` is the catalogue item's server-computed `challengeAllowed` (every exercise but a free-weight compound), falling back to the same kit rule from `gear` and, against a server without either, the old stable + lengthened-friendly rule (`DraftExercise.challengeAllowed(item:type:gear:)`); the refusal reads „Szabadsúlyos alapgyakorlaton nincs kihívás.” („Saját gyakorlaton nincs kihívás.” without a catalogue row). (7) Technique picker (`mezo-r36n9.94`, 2026-11-19): on Napok each judged exercise has **one** pill (+ technika vagy kihívás / the technique / Kihívás a végén) so the row never changes height; tapping it opens `TechniquePicker` (sheet at page level, full height): all techniques including `top_pause` (unavailable ones dimmed with `DraftExercise.unavailableReason`), the day's challenge as its own row (`setChallenge`, one a day, compatible with a technique), an *i* button revealing `SetTechnique.about` under each; a planner/AI pick (`techniqueSource` planner/ai, untouched) wears a **Boop** tag (`pickedByBoop`). The review tile shows T4's `WeekProposalLine.note`. DEBUG `-previewBlokkPicker N`, `-previewBlokkPickerInfo YES`. (6) Owner round after the first install (2026-11-19): the muscle card shows the band and the days as pills plus an always-visible *Miért ez a sáv* box (tier + numbers, sport note); the room **preloads** the builder (block, catalog, first evaluation) so it opens without a spinner, and a mid-preload open joins the in-flight load; the builder and the deck **zoom out of the tapped button / card** (`matchedTransitionSource` + `.navigationTransition(.zoom)`, `PlanZoom`) instead of sliding up — a swipe down zooms back. (5) Review fixes (2026-11-19): Save always wins over *Igazítsd a sávba* when there are edits; edits are carried onto a fresh read as deltas when the server changed the value too; a partial save failure keeps the unsaved edits; proposals apply only against a fresh evaluation.
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
- **Multipart photo parts need an image content type** (`mezo-r36n9.63`): the generated multipart part for a
  `format: binary` array item is sent as `application/octet-stream`, and the server checks each part's own type
  against JPEG/PNG/WebP. `FoodClient.cooked` therefore sends the photos as `.undocumented(MultipartRawPart)` with
  `Content-Type: image/jpeg` (pinned by `testCooked_sendsMultipartWithTextAndEveryPhoto`). The older single-photo
  routes still use the generated type — the live import-photo route is worth a look on the phone.
- **DEBUG review hooks must not persist**: a hook that writes `UserDefaults` survives every later launch (the
  `-etelReview` state stuck once and `defaults delete` via `simctl spawn` cannot reach the app container). Read
  hooks from the launch arguments only.
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
  - Soft delete: derived finders on `daily_metric`/`wearable_workout` ignore `is_deleted` (parked minor, S2 tables); `calendar_event` finders exclude deleted rows since B7 K1.
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
- **Emlékeztetők és ébresztők — traps found (2026-11-25, `mezo-r36n9.172`).**
  - **Only `signedOut` may clear the alarms.** The first hub switched off on `offline` too, so an offline launch cancelled every alarm; the rule is now tested (`ReminderHubTests`). A user switch must queue the new refresh behind the old clear.
  - **AlarmKit runs the stop action on every dismissal** (button, swipe, side button), so stop can never mean "done" — that is D8: stop = silence, the secondary button is the only tick.
  - **A snooze must carry the originating key.** Deriving the key from "now" ticked the next day's occurrence after midnight; the key rides in the snooze's route query instead, and the planner's refresh keeps pending snoozes.
  - **Bedtime on/off had two states** (the Ma toggle and the settings default). With a store `bedtimeEnabled` is the single source of truth and defaults to off; the legacy `UserDefaults` flag is migrated once.
  - **Permission prompts belong to edits only.** Asking on every refresh pops the system sheet at launch; `ReminderTriggers` asks only when the list changed.
  - **A page/fold tick must go through `ReminderActions.toggleTick`**, not the store: otherwise a linked reminder ticks without taking the supplement and a pending snooze fires after the tick.
  - **A static hub is not observed.** Views read `ReminderHub.store/scheduler` once; set the hub before the shell is built. Binding the global hub in a unit test broke `BedtimeReminderTests` in a full run (their default seams read it).
  - **Headless intents only write `queue.json`.** A live process holding an `Outbox` does not see an entry the headless path appended until relaunch; the headless path runs only when there is no environment.
  - **Notification "Kész" is the label for supplement-linked reminders too** (the alarm says „Bevettem"); accepted.
  - **The 10th "+" door** broke the 3×3 grid and the 650 pt detent: the sheet scrolls now and a lone tile is centred.
  - **On-phone probe (2026-11-26, free team, no extension):** the AlarmKit full-screen alarm rings on a locked, silenced phone; slide-to-stop works; the `.custom` secondary button's intent runs in the background and records, **but leaves the alert on screen** — fixed by stopping the alarm inside the intent (above). The probe (`AlarmProbe.swift`, `-probeAlarm YES`) is removed. Still to see on the device: `boop.rest` at the exact second on a locked phone.
- Deferred: Beszélgetés and Rutin tabs; widgets and the Lock Screen workout card are step 2 of *Emlékeztetők és ébresztők* (`mezo-r36n9.172`, see §2 below and the spec `docs/superpowers/specs/2026-11-25-boop-ebreszto-widget-design.md`). B4 delivered meal capture, the quick food log, the food chips of the "+" sheet and the food settings.

## 10. Key files

2026-11-28 (barless home, `mezo-r36n9.196`): `ios/Boop/Shell/{BoopDestination,ShellView}.swift` · `ios/Boop/Ritmus/RitmusRouter.swift` (`destination`/`go`/`takeDestination`) · `ios/Boop/Kezdolap/KezdolapView.swift` (`KezdolapRoute` `.nap`/`.room`/`.chat`) · `ios/Boop/Nap/NapRoom.swift` · `ios/Boop/Naplo/NapokTab.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/FloatingPlus.swift` (`NKFloatingPlus`). **Removed:** `Naplo/NaploView`, `Shell/PlacePage`, BoopKit `Napkelte/SpineBar` (`NKSpineBar`), `ShellTab`, the panorama place switch — the older B2/B3 lists below still name them.


2026-11-25 (Emlékeztetők és ébresztők): `ios/BoopKit/Sources/BoopCore/Reminders/{Reminder,ReminderPlanner,ReminderStore,BoopReminderSettings}.swift` · `ios/BoopKit/Sources/BoopCore/Etel/SupplementTick.swift` · `ios/Boop/Emlekeztetok/{ReminderHub,ReminderScheduler,AlarmScheduling,ReminderIntents,ReminderActions,HeadlessContext,InstallExpiry,EmlekeztetokPage,ReminderEditSheet,ReminderRows,MaReminders,ReminderPresentation}.swift` · `ios/Boop/Edzes/{RestEndSignal,RestEndSheet}.swift` · 2026-11-27 (step 2): `ios/BoopLive/{WorkoutActivity,WidgetIntents}.swift` · `ios/BoopKit/Sources/BoopCore/Morning/WidgetSnapshotBuilder.swift` · `ios/BoopWidgets/{BoopWidgetsBundle,WorkoutLiveActivity}.swift` · `ios/Boop/Edzes/WorkoutActivityController.swift` · `ios/BoopKit/Sources/BoopShared/{WidgetSnapshot,SharedKeychain}.swift` · `ios/BoopWidgets/DayWidgets.swift` · `ios/Boop/Emlekeztetok/WidgetSnapshotWriter.swift`

2026-11-24: `ios/BoopKit/Sources/BoopCore/When/When.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/When.swift` · `ios/Boop/Capture/WhenRow.swift` · `ios/Boop/Capture/QuickSheets.swift` · `ios/BoopKit/Sources/BoopCore/Ritmus/{NaploDays,NaploCatchUps,CheckInSlot}.swift` · `ios/Boop/Naplo/{NaploView,NaploCatchUp}.swift` · `ios/Boop/Ritmus/{CheckinFlow,CheckinView,EsteFlow,EsteView}.swift` · `ios/BoopKit/Sources/BoopCore/Etel/{MealDraft,FoodClient,FoodOutbox}.swift` · `ios/Boop/Etel/{Composer,EtelMa,EtelLogic,EtelHet,EtelRoom}.swift` · `ios/BoopKit/Sources/BoopCore/Train/{AsPlanned,TrainClient}.swift` · `ios/Boop/Edzes/WorkoutAsPlanned.swift` · `backend/…/feature/train/service/WorkoutService.java` (`completeAsPlanned`) · `backend/…/feature/nutrition/service/dayplan/{SlotKey,MealSlots}.java` ·

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
B2: `ios/Boop/Shell/{ShellView,PlacePage,AccountSheet}.swift` · `ios/Boop/Capture/{CaptureSheet,QuickSheets}.swift` · `ios/Boop/{Naplo,BoopChat}/*` (`Terv/` deleted in B6 S1) ·
`ios/Boop/Nap/{MaPhases,MaDrill,ProposalDesk,RoomSwipeBack}.swift` · `ios/BoopKit/Sources/BoopCore/Morning/{DayPhase,DayPlan,Proposals}.swift` ·
`ios/BoopKit/Sources/BoopDesign/Napkelte/{SpineBar,Proposal,Drill}.swift` ·
B1: `ios/BoopKit/Sources/BoopCore/Health/{HealthKitReader,HealthReader,HealthSync,HealthBackground,SleepNightBuilder,WorkoutMapper}.swift` · `…/Push/PushRegistrar.swift` · `ios/Boop/App/{BoopAppDelegate,BackgroundSyncHost}.swift` · `ios/Boop.entitlements` · `ios/Boop-Paid.entitlements` · `backend/…/feature/wearable/service/{HealthSampleService,WearableDeletionService,WorkoutReconciler}.java` · `backend/…/feature/biometrics/sleep/service/SleepNightMerge.java` · `api/feature/device/device.yml` · `scripts/ops/boop-b1-merge-accounts*.sql`

Éves terv (S3+S4, `mezo-r36n9.113`): `ios/Boop/EdzesTerv/EvesTerv/{EvesTervTerkep,EvesTervLetrehozas,EvesTervBlokkSheet,EvesTervKit,YearStrip,EvesTervPreview}.swift` · `ios/Boop/Edzes/{KovetkezikCard,EdzesRoom}.swift` · `ios/BoopKit/Sources/BoopCore/Train/{YearPlanWire,YearPlanModel,NewBlockModel}.swift` · tests `YearPlanModelTests`, `NewBlockPrefillTests`, `EvesTervKitTests`, `KovetkezikTests`

Blokképítő + heti átnézés: `ios/Boop/EdzesTerv/{BlockBuilderPage,DayEditSheets,WeekReviewDeck,PlanKit,PlanEnvironment,PlanPreview}.swift` · `ios/BoopKit/Sources/BoopCore/Train/{PlanTransport,PlanWire,PlanClient,BlockDraft,WeekReview,BlockBuilderModel}.swift` · `backend/…/feature/train/service/{TrainService#updateSettings,ExerciseStyler#restampRows}`

Gyakorlatonkénti SPE (`mezo-eiux9`): `ios/BoopKit/Sources/BoopCore/Train/{PlanWire,BlockDraft,TrainModels,TrainClient,WorkoutSession}.swift` · `ios/Boop/EdzesTerv/{TechniquePicker,BlockBuilderPage,PlanPreview}.swift` · `ios/Boop/Edzes/{WorkoutPlayer,PlayerTechnique}.swift` · tests `BlockDraftTests`, `BlockDraftEditTests`, `WorkoutTechniqueTests`, `TrainTechniqueWireTests`. The approved [specification](../superpowers/specs/2026-11-24-gyakorlat-spe-alkalmassag-design.md) and [plan](../superpowers/plans/2026-11-24-gyakorlat-spe-alkalmassag.md) preserve the static spike's screenshots; the spike entry point was removed once the live screen replaced it.

L0/b (az élő fal): `ios/BoopKit/Sources/BoopCore/Morning/{Wall,WallSources}.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Wall.swift` · `ios/Boop/Nap/{MaWall,MaPhases,MaiView}.swift`

2026-11-28 (Évad room, `mezo-r36n9.196` step 2): `ios/Boop/Evad/{EvadRoom,EvadMost,EvadHet,EvadHetPages,EvadTerv,EvadYearStrip,EvadKiserlet,EvadParts,EvadShared,EvadDaysPage}.swift` · `ios/Boop/Evad/Review/{WeeklyReviewFlow,WeeklyReviewPages,WeeklyReviewIllustration,WeeklyReviewReminder}.swift` · `ios/Boop/Etel/{EtelMenu,EtelList,EtelHet,EtelReceptek,RecipeDetail}.swift` · `ios/BoopKit/Sources/BoopCore/Evad/{EvadReview,EvadRoomLogic,EvadWall,EvadMenuStore}.swift` · tests `BoopCoreTests/{EvadReviewTests,EvadRoomLogicTests,EvadWallTests,EvadMenuTests}.swift`, `BoopTests/{EvadRoomTests,WeeklyReviewTests,EtelMenuTests}.swift`. **Removed:** the old Évad page, its overview/menu/list tab files and the recipes sub-page (the S1–S2 line below is historical).

B6 Évad S1–S2: `ios/Boop/Evad/{EvadSystemMap,EvadWhatIf,EvadRules,EvadNewSeason,EvadPreview}.swift` · `ios/BoopKit/Sources/BoopCore/Evad/{EvadClient,EvadStore,EvadWire,EvadLogic,EvadWall}.swift` · S2: `ios/Boop/Etel/{EtelHet,EtelRoom}.swift`, `ios/Boop/Nap/MaWall.swift` · backend [`season.md`](season.md)

L1+L2 Levél: `ios/Boop/Level/{LevelRoom,LevelMa,LevelSzabalyok,LevelFiokok,LevelDealCard,LevelModel,LevelPreview}.swift` · `ios/BoopKit/Sources/BoopCore/Level/{LevelWire,LevelClient,LevelStore,LevelLogic}.swift` · `ios/Boop/Nap/WallNotifier.swift` · backend [`mail.md`](mail.md)

L5 Pénz: `ios/Boop/Penz/{PenzRoom,PenzTabs,PenzSheets,PenzFaces,PenzPreview}.swift` · `ios/BoopKit/Sources/BoopCore/Penz/{PenzWire,PenzClient,PenzStore,PenzLogic,PenzOutbox}.swift` · `OutboxKind.penzExpense` in `Ritmus/{Outbox,RitmusPayloads,RitmusClient}.swift` · tests `BoopCoreTests/{PenzLogicTests,PenzClientTests}.swift`, `BoopTests/PenzRoomTests.swift`

Kezdőlap + L0: `ios/Boop/Kezdolap/{KezdolapView,Area,KitGallery}.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/{Area,AreaBlocks,OrbRing,Fog}.swift` · `ios/BoopKit/Sources/BoopDesign/Resources/Photos.xcassets/p-hegy.imageset`

B4: `ios/Boop/Etel/*` · `ios/BoopKit/Sources/BoopCore/Etel/{FoodClient,FoodModels,MealDraft,FoodOutbox,SensitivityRules}.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Etel.swift` · `api/feature/meal/{fuel-plan,meal-photo}.yml` · `api/feature/sensitivity/sensitivity.yml` · `api/feature/recipe/{recipe-import,recipe-image}.yml` · `backend/…/feature/{nutrition/service/dayplan,meal/service/dayplan,nutrition/service/SensitivityService.java,common/image}` · `…/db/changelog/1.1.0/script/20261113*_mezo-r36n9.14_*.sql`

B3: `ios/BoopKit/Sources/BoopCore/Ritmus/{Outbox,DayLedger,RitmusClient,RitmusPayloads,SnapshotBuilder,VoiceJournal,ChatStore,CheckInQuestions,CheckInSlot,GoalSuggestions,NaploDays}.swift` · `ios/Boop/Ritmus/{RitmusEnvironment,RitmusRouter,RitmusReminders,RitmusPreview,CheckinFlow,CheckinView,CheckinDone,EsteFlow,EsteView,ClosedDayCard,RefusedRow}.swift` · `ios/Boop/Nap/MaRitmus.swift` · `ios/Boop/Naplo/NaploView.swift` · `ios/Boop/BoopChat/BoopTabView.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Ritmus.swift` · `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` · backend `feature/dayclose/**` · `feature/biometrics/checkin/service/{CheckInService,CheckInBiomarkerSource}.java` · `feature/wearable/service/WearableCheckInBiomarkerSource.java` · `feature/companion/service/BoopDayContext.java` · `feature/companion/controller/CompanionDayContextController.java` · `feature/companion/tools/DayTools.java` · `api/feature/dayclose/dayclose.yml` · migrations `202611121100…1130_mezo-r36n9.13_*.sql`.
- **Súly (`mezo-r36n9.158`):** `ios/Boop/Suly/{SulyRoom,SulyTabs,SulyFaces,SulyPreview}.swift`, `ios/BoopKit/Sources/BoopCore/Suly/{SulyLogic,SulyWire,SulyClient,SulyStore,SulyRows}.swift`, `ios/Boop/Kezdolap/Area.swift` (nine areas), `BoopDesign/Napkelte/Tokens.swift` (`Hue.suly`), `Glass.swift` (`body-cream`), `Frames.swift` (`NKCloseButton`, `NKSheetFrame(closable:)`); tests `BoopCoreTests/Suly*Tests.swift`, `BoopTests/{KezdolapRingTests,CaptureSheetTests,RitmusTickTests}.swift`.
