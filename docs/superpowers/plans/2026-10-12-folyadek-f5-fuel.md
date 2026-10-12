# Folyadék F5 · Fuel — build plan (`mezo-n4wf5.5`)

> Owner OK on the prototype 2026-10-12. Build target: `docs/design_2.0/prototypes/vilagos/fuel.js`, every route arg and sheet
> in its side-panel notes, in BOTH languages (`?lang=en` before the hash). Canon: `docs/design_2.0/2026-10-09-folyadek-style-bible.md`
> (read the appendix: F2.3–F2.5, F2.12, F3.6–F3.10, F4.3–F4.5, F4.9, F4.11, N1.3, N1.5, N1.8, N1.13, N1.14). Language mechanism:
> `docs/features/_platform-language.md` §3 + §7. Exemplar of a converted hub page: `frontend/src/features/train/pages/TrainTodayPage.tsx`
> + `frontend/src/styles/folyadek-edzes-mai.css`; of a translated page: `frontend/src/features/settings/pages/NapSettingsPage.tsx`
> + `messages/settings.{hu,en}.ts` + `SettingsPages.en.test.tsx`. Kit: `frontend/src/shared/ui/folyadek/` (+ `folyadek-kit.css`).
> Fuel-shared pieces and the mapping table: `frontend/src/features/fuel/components/folyadek/README.md`.

## Owner decisions for this slice (2026-10-12)
- The prototype is the build target, including its wording changes („stack" → „kiegészítőid"; recipe „Slot" → „Étkezés", windows
  „Slot" → „Ablak", „Budget %" → „Rész %"; „AI / coach" → „Mezo"; „Koffein-cutoff" → „Koffein-stop"; full list: § Wording).
- Konyha hub hero = the empty pot as the invitation to the Műhely, real counts as supporting facts.
- **Behaviour change 1 (approved):** a meal logged outside every window is titled „Ablakon kívül · HH:mm" / "Between meals · HH:mm"
  (not after the day part) on Mai and wherever its slot name is printed.
- **Behaviour change 2 (approved):** on Trendek, tapping a FUTURE day of the current week opens the day box with „Ez a nap még
  előtted áll." / "This day is still ahead." and no „Pótolom a napot" row.
- New (not in live, drawn in the prototype, approved): the Mai verdict sentence („Még X kcal fér bele, Y g fehérje hiányzik." and
  its variants), the weight-goal waterline on the Trendek weight chart (existing goal hook; no line without a goal), Mai loading
  and error faces, „Visszavonom az utolsót" on the water sheet (existing hook), the medication no-dose sentence instead of
  „D0 / 0. nap", the settings hero with the real named windows, improve impact printed on the ten scale („+0,2").
- Removed as invented — do NOT build: everything listed under „Kikerült" in the prototype's notes (§ Not to build).
- Live quirks NOT to copy: the recipe score header prints whole-recipe kcal labelled „/ adag" (build per serving); FuelHorizon's
  „needs more weeks" face must key on non-empty weeks.
- English: user-typed and stored text is never translated (meal / recipe / pantry / supplement / brand names, tags, notes, stored
  AI prose, stored placement reasons); enums and system labels are translated; dates and numbers through `format.ts`.

## Rules for every builder
1. **Match the prototype exactly**: same order, graphic, copy, states — in Hungarian and in English. Open it:
   `http://127.0.0.1:8731/klinikai-iranyok.html#w-fuel-<route>[.<arg>]` and `…/klinikai-iranyok.html?lang=en#w-fuel-…` (server
   runs; never kill it). Port CSS **values** from the prototype's `css` / `cssA` / `cssB` / `cssC` strings and from computed styles,
   not from screenshots (bible F1.12). Token map: `--ink --sub --faint --hair --page` → `--fo-ink --fo-sub --fo-faint --fo-hair
   --fo-page`; `--disp` → `--ff-display`, `--ff` → `--ff-body`; `--ok --warn --bad` → `--fo-ok --fo-warn --fo-bad`;
   `--protein --carb --fat --fiber --water --lilac` → `--fx-protein --fx-carb --fx-fat --fx-fiber --fx-water --fx-lilac`.
2. **Behaviour frozen**: no change to routes, hooks, API calls, mutations, state machines, navigation targets, aria semantics
   that tests rely on. Only markup + classes + presentational derivations + words. The ONLY behaviour changes are the two approved
   above and the „New" list; a graphic that needs data the page does not load may add a call to an EXISTING hook (named in the
   prototype comments as „SZÁMOLHATÓ"); never a new endpoint. Demo route args of the prototype are states, not features.
3. **Kit first**: `@/shared/ui/folyadek` and the Fuel-shared pieces (`@/features/fuel/components/folyadek`, CSS
   `folyadek-fuel-kozos.css`, prefix `.fx-`) — code from the README's tables. Builders never edit the kit, `folyadek-kit.css`,
   `folyadek-fuel-kozos.css`, `prototype.css`, the app shell, `components/folyadek/*`, or another area's files. Missing a generic
   piece → build it locally in your area with your prefix and LIST it in the report (the controller folds it into the kit).
4. **One stylesheet per area**, its own class prefix (table below; the files are planted and imported). No new rule in
   `prototype.css`; do not delete old CSS (the controller removes it with a zero-usage proof afterwards). Motion only inside
   `@media (prefers-reduced-motion: no-preference)`; kit-style rules address their own children with `>`.
5. **Old skin leaves the markup** of the files you own: glass cards (`.glass`, `GlassBox`, `.uv-*`, `.fmx- .fsx- .ftx- .fkx- .fkk-
   .flp- .stk- .fset-`…), Titanium / clay icons outside the sprite ids (`ContentIcon`, `i-…` clay ids), progress rings
   (`FuelMacroRings` becomes vials), Boop. A glass box becomes `<Sheet className="fo-sheet" labelledBy>` + `FoSheetHead`; keep
   each component's name and props. `components/GlassBox.tsx` itself is nobody's: stop importing it, do not edit it.
6. **Language — every visible string of a file you own moves to YOUR catalog file, in both languages**
   (`shared/i18n/messages/fuel-<area>.hu.ts` + `.en.ts`; the pair is planted and registered — never edit `messages/index.ts`,
   `fuel-kozos.*`, `fuel-logika.*` or another area's catalog; you may only ADD keys to your own).
   - The prototype's `L(hu, en)` pairs are the approved wording: copy them exactly, both halves. No pair for a string → write the
     English by bible §2.5 (written, not converted; short, calm, sentence case; „you / your") and list it in the report.
   - `const M = useM()` in components, `m()` in logic at CALL time. No translated text in a module constant, a `useMemo` /
     `useState` initialiser / `useRef` without the language in its key (N1.3) — hold data, build the sentence at render.
   - One sentence = one message with slots (function leaves); plurals with `plural(n, { one, other })`. Never glue halves.
   - Dates and numbers only through `@/shared/lib/format` (`fmtDate`, `fmtNum`, `fmtGrouped`, `fmtInt`); no `hu-HU`,
     `toLocale*`, `new Intl.`, private month / weekday arrays, `.replace('.', ',')`. A style missing from `format.ts` → report it.
     When a file you own no longer formats by hand, delete ITS line from the sorted allowlist in `shared/lib/format.ratchet.test.ts`
     (only your own files' lines — the one shared test file a builder touches).
   - Included: `aria-label`s, placeholders, `title`s, toasts, error texts, chart axis labels, label maps in the logic files you own.
   - Never translated: what the user typed or what is stored (meal / recipe / pantry / supplement / brand names, tags, notes,
     stored AI headline / lead / prose, stored placement reasons). Enums and system labels are translated.
   - Existing tests keep asserting Hungarian — never mass-rewrite them. Add ONE `*.en.test.tsx` per page family of your area,
     following `features/settings/pages/SettingsPages.en.test.tsx` (English render + one runtime switch on the same node).
   - The accent guard does not see unaccented Hungarian („Mai", „Kamra", „Recept", „Vissza") — read your screens in English.
7. **Tests**: every test of your files that asserts old structure is rewritten to assert the new one — never deleted, never
   skipped. Where the prototype rewrote a live string, the test follows. Run only your own files:
   `cd frontend && CI=true pnpm exec vitest run <paths>` (mock mode) and again with `VITE_USE_MOCK=false`. Never run the full
   suite, the build or the layout specs (the controller does; parallel full runs corrupt each other). Type check:
   `pnpm exec tsc -p tsconfig.json --noEmit` — it may show other builders' errors; fix only yours.
8. **Not yours — REPORT, do not edit** (shared files; five builders fixing „their" lines rewrite one guard five ways, F4.4):
   `shared/ui/mozaik/prototypeCssStructure.test.ts`, `shared/ui/sheetGlassGuard.test.ts`, `shared/i18n/*` (guards, `index.ts`),
   `shared/ui/clay/*`, `app/*` (`navigation`, `TopTabs`, `hubHeaders`, `navModel`,
   `router.fuelRetiredRedirects`, `TitleBar.sticky`, `ScreenContent`, `AppLayout*` tests, `router.tsx`, `navModel.ts`,
   `pageIndex.ts`), `features/tutorial/registry/*` (kalauz copy and `anchors.test.tsx` / `registry.test.ts`), `tests/layout/*`
   (they select `.fmx-block`, `.fmx-frow`, `.fmx-fskip`, `.fmx-loggeneric`, `h1.fkx-title` — say which selector your markup
   replaces), `features/fuel/components/stackCssContract.test.ts`, `fuelBadges.test.tsx`, `kamraCards.test.tsx`, the kit, the
   Fuel-shared folder, `styles/prototype.css`, every file of § Not converted, components of other domains (bible F2.12:
   `VoiceField`, `RecoveryDurationRow`, `UnsavedChangesGuard`, `shared/ui/Sheet`, `SheetHead` stay as they are).
9. **Read-only neighbours.** A component owned by another area that your page renders (table column „reads") keeps its name and
   props; you do not edit it and you do not wait for it — your tests may see it in either look. A test file that mounts the
   real route tree and crosses into a neighbour's page asserts only YOUR page's structure after your change.
10. **Kalauz anchors survive** on the same logical element: `fuel-log` (A, `FuelMaiPage`), `log-forrasok` (B, `FuelLogModes` and
    `MealComposer`), `stack-hero` (E, `FuelStackPage`, both faces), `trendek-heti` (F), `konyha-felvetel` (G, `FuelKonyhaPage`),
    `kamra-tabs` (G, `FuelKamraPage`), `receptek-tabs` (H, `FuelRecipesPage`). `features/tutorial/registry/anchors.test.tsx` must
    stay green for your route (run it; it is the controller's to edit).
11. Loading / empty / error / not-found faces as drawn (`Skel`, `ErrorRow`, `Empty`). 320 px must not overflow in either
    language; 44 px hit areas come from the kit. Structural traps of the F4 README §(e) hold (floating bars portal into
    `.phone-screen`, a sheet scrolls its inside, unique SVG ids via `useId`, `fill: var(--c)` directly).
12. No commit, no push. Report: files changed, kit gaps (local pieces to fold), strings translated without a prototype pair,
    shared tests / selectors that need the controller, tests run with counts (both modes), deviations from the prototype with
    the reason, per route what was looked at in the browser and what only a test covers (F3.11), anything left.

## Areas (parallel after the foundation)

CSS file = `frontend/src/styles/folyadek-fuel-<name>.css`; catalog = `shared/i18n/messages/fuel-<name>.{hu,en}.ts` (key `fuel<Name>`).
Paths are under `frontend/src/features/fuel/` unless written out. Each area owns the tests of its files.

| Area | name · prefix | Prototype routes (`#w-fuel-…`) / sheets | Files owned | Reads (read-only) |
|---|---|---|---|---|
| 0 Foundation | `kozos` · `.fx-` (+ kit `.fo-`) | helpers at the top of `fuel.js` | kit additions (`Stat`, `StatGrid`, `Switch`, `SearchField`); `components/folyadek/*`; catalogs `fuel-kozos`, `fuel-logika`; the shared logic label maps (§ Logic files) | — |
| A Mai | `mai` · `.fa-` | `mai` + `d-10-06 d-10-05 kihagyva kihagyva-ok felett kesz jon javaslat nincs-ablak nincs-cel tolt hiba kimelo beteg serules serules-tartas uton`; sheets `eq`, `mealwhy:<0–3>`, `orvos:<…>` | `pages/FuelMaiPage`, `components/FuelEnergyHero`, `FuelMacroRings`, `FuelMealBlocks`, `DayLearningMark`, `DietSuggestionBanner`, `FuelGuidanceCard`, `FuelRecoveryNote`, `sheets/MealSkipSheet`, `DoctorSheet`, `frontend/src/shared/ui/DayNavigator.tsx` (only consumer: Mai; prototype `dayNav`) | `EnergyBreakdownSheet`, `WaterLogSheet`, `WeeklyLearningSheet`, `WeeklyLearningDot` (D); `GlycemicGlassFor`, `MealClockBox` (C) |
| B Logolás + ceremónia | `log` · `.fg-` | `log` + `w0–w3 foto-kesz elemez hiba ai-hiba szokasos szokasos-ures tetelek finom ido jovo potlas potlas-w2 javitas.<id> torles.<id> kamra-<id> recept-<id>`; `cer.<id>`; sheets `kamrapick[:ures]`, `receptpick[:ures]` | `pages/FuelLogNewPage`, `LogFlowPage`, `components/MealComposer`, `FuelLogModes`, `RecipeOverrideRow`, `NutrientCells`, `MacroCells`, `NovaDot`, `sheets/KamraPickSheet`, `ReceptPickSheet`, `components/FuelMealCeremony`, `MealCeremonyProvider.tsx`, `logic/mealCeremony`, `logic/usualMeals`, `logic/amountGuard`, `logic/eatingTimePlacement` | — |
| C Étkezés + értékelés | `etkezes` · `.fe-` | `meal.<id>` (+ `nincs`); `score.<id>` (+ `.keszul`, `nincs`); `score.r-<id>` (+ `.keszul .nincs .nincsmeg`); sheets `dim:<id>｜<0–7>`, `glu:<id>`, `ora:<…>` | `pages/FuelMealDetailPage`, `FuelMealScorePage`, `FuelRecipeScorePage`, `components/FuelScoreSurface`, `ContextPanel`, `MacroPanel`, `MicroPanel`, `NovaPanel`, `MealTimingStrip`, `FuelQualityBlocks`, `GlycemicGlass`, `MealClockBox`, `MealClock`, `mealClockWindow.ts`, `logic/mealForecast`, `logic/formatImpact`, `logic/scoreArithmetic` | — |
| D Tanulás + lapok | `tanulas` · `.ft-` | `tanulas` + `var ki ures tolt hiba`; sheets `energy`, `water`, `weekly[:var]`, `hw:<0–5>` | `pages/LearningPage`, `components/LearningDaysList`, `LearningHistoryChart`, `WeeklyLearningDot`, `sheets/LearnedBaseExplainer`, `LearnedBaseChart`, `WeeklyLearningSheet`, `EnergyBreakdownSheet`, `WaterLogSheet` | — |
| E Kiegészítők | `kieg` · `.fk-` | `stack` + `kesz ures tolt`; `protokoll` + `figyelj kotesnelkul ures tolt hiba`; `stack-uj` + `1 1-nincs 2 2-kezi 2-link(-olvas -kesz -ures -hiba) 2-foto(-olvas -ures -hiba) 3 3-kerekitve 3-ismeretlen 3-hianyzik 3-nincspolcon`; `gyogyszer` + `aktiv ujonnan leallitas`; sheets `item:<ix>[…]`, `stackitem:<ix>`, `dose`, `medform[:szerk]` | `pages/FuelStackPage`, `FuelStackProtocolPage`, `FuelStackAddPage`, `FuelMedicationPage`, `components/FuelStackItemGlass`, `StackMealMatch`, `StackPageScaffold`, `MedicationCycleBar`, `sheets/LogDoseSheet`, `MedicationFormSheet`, `StackItemSheet`, `logic/doseAdvice`, `matchMealsToStack`, `stackBands`, `useStackIntakeToggle` | — |
| F Trendek | `trendek` · `.fr-` | `trendek` + `mult elso ures egyszint hetkoznap kimelo sulynelkul sulyhezag nincs-cel rovid mintanelkul tolt`; sheet `day:<state>｜<0–6>[｜tolt｜tetelnelkul]` | `pages/FuelTrendekPage`, `components/FuelWeekDayGlass`, `FuelHorizon`, `logic/fuelPatternRefs`, `logic/fuelWeekView` | — |
| G Konyha + Kamra | `kamra` · `.fp-` | `konyha` + `ures`; `kamra` + `ures tolt szurt nincstalalat <id> <id>.hianyos <id>.torles nincs`; sheets `add[:…]`, `import[:…]`, `catalog[:ures]`, `catfilter[:2]` | `pages/FuelKonyhaPage`, `FuelKamraPage`, `KamraItemDetailPage`, `KamraSkeleton`, `components/SuggestionCard`, `SourceBadge`, `sheets/AddPantryItemSheet`, `CatalogSearchSheet`, `CategoryFilterSheet`, `ImportItemSheet`, `KamraSheetHead`, `logic/pantryProvenance`, `logic/kamraItems` | `FuelQualityBlocks` (C), `LogFlowPage` (B), `NutrientCells` (B) |
| H Receptek + Műhely | `recept` · `.fc-` | `receptek` + `ures szurt-ures tolt`; `recept.<id>` + `.egesz .ertekel .ujra .nincsolvasat .nemettem .torles`, `recept.nincs`; `recept-uj` + `kitoltve x szerk-<id> nincs`; `muhely` + `dolgozik hiba kamrabol vazlat vazlat-egesz kesz recept-<id> etkezesbol[-<id>] feloldatlan ures-vazlat`; sheets `reclogs:<id>`, `thread`, `ingpick[:…]` | `pages/FuelRecipesPage`, `RecipesSkeleton`, `RecipeDetailPage`, `RecipeEditorPage`, `RecipeWorkshopPage`, `components/workshop/WorkshopChatDock`, `workshop/WorkshopIngredientRow`, `RecipeLogsList`, `ServingToggle`, `sheets/IngredientPickerSheet` | `FuelQualityBlocks` (C), `LogFlowPage`, `MacroCells` (B), `SourceBadge` (G) |
| I Beállítások | `beallitas` · `.fb-` | `beallitas` + `modositva egyeni egyeni-hiba elonezet-tolt elonezet-hiba ablak-nelkul tolt hiba mentes-hiba`; `ablakok` + `reggeli esti szerk mentett hiba figyel ertekel olvasat olvasat-igazit olvasat-nincs tolt betolt-hiba mentes-hiba`; sheet `guard` (= `features/settings/components/UnsavedChangesGuard`, already Folyadék: not yours) | `pages/FuelSettingsPage`, `FuelSlotsPage`, `logic/validateSlotPlan`, `logic/fuelSettingsPreview` | — |

Sizes (non-test lines): A ≈ 1 750 · B ≈ 2 250 · C ≈ 1 850 · D ≈ 1 310 · E ≈ 2 200 · F ≈ 1 140 · G ≈ 1 830 · H ≈ 1 970 · I ≈ 1 210.
F and I are the two small ones and may go to one builder, one after the other.

**The cuts that keep one owner per file (F4.3)**
- `FuelMealBlocks.tsx` (A) also exports `FuelScoreChip`, used by `FuelMealDetailPage` (C) and `RecipeDetailPage` (H): C and H
  switch to the shared `ScoreChip` (`score = scorePct / 10`); A drops the export's last use; the controller deletes the export.
- `FuelMacroRings.tsx` (A) also exports `useFuelCountUp`, used by `FuelQualityBlocks` (C), `FuelKonyhaPage` (G), `FuelTrendekPage`
  (F): the Folyadék faces have no count-up (levels rise by CSS) — C, G and F drop the import with their old markup; A removes the
  rings. If a number must still count, report it (the kit has `CeremonyCount`); do not import from A's file.
- `GlycemicGlass.tsx` (C) exports `GlycemicMiniCurve`, used by `FuelMealBlocks` (A): A uses the shared `GlyMini` / `GlyChip`.
  `GlycemicGlassFor` and `MealClockBox` keep their props; A renders them as they are. The small clock in a block's head is the
  shared `Dial` (A no longer imports `MealClock`).
- `FuelQualityBlocks.tsx` (C) is rendered by `KamraItemDetailPage` (G), `RecipeDetailPage` and `RecipeWorkshopPage` (H): C keeps
  every export and prop (`FuelMacroShareSection`, `FuelIngredientSection`, `FuelNutriTiles`, `FuelQualitySection`,
  `FuelMicroSection`, `FuelMicroNote`, `qualityTiles`, `NOVA`, `ingredientStyle`); G and H lay their pages out around them.
- `FuelScoreSurface.tsx` (C) is the one surface of the meal AND the recipe score page (both pages are C's).
- `LogFlowPage` (B) opens from `KamraItemDetailPage` (G), `RecipeDetailPage` (H) and from Nap (`NapRutinPage`, `EletjelPage`);
  `EnergyBreakdownSheet` (D) from Mai (A) and `features/settings/pages/MeSettingsPage`; `WaterLogSheet` (D) from Mai and
  `features/quickinput/QuickLogSurface`; `MealCeremonyProvider` (B) is mounted by `app/AppLayout`. Props stay; the owner runs the
  consumers' tests: **B** `features/today/pages/NapRutinPage.test.tsx`, `EletjelPage.test.tsx`, `app/AppLayout.lightFirst.test.tsx`,
  `app/AppLayout.threadScope.test.tsx`; **D** `features/settings/pages/MeSettingsPage.test.tsx`, `SettingsPages.en.test.tsx`,
  `features/me/logic/buildTdeeBreakdown.test.ts`; **A** (shared logic) `features/today/components/NapFuelGraphic.test.tsx`,
  `features/today/pages/NapHubPage.test.tsx`; **E** `features/me/pages/NotificationsPage.test.tsx`, `NotificationsPage.en.test.tsx`,
  `data/notification/notificationScheduleWriter.test.ts`.
- `RecipeDetailPage.test.tsx` renders C's `FuelRecipeScorePage` too: H owns the file, C reports what it needs changed there.

### Logic files
Converted by the foundation to call-time `m()` (catalog `fuelLogika`) — read-only for everyone, a missing word is reported:
`logic/mealSkips`, `mealWindow`, `buildDayPlan`, `fuelSwimlane`, `keretHero`, `glycemicBand`, `mealShare`, `mealQualityTruth`,
`recipeRole`, `recipeSlotFace`, `buildEnergyBreakdown`, `projectStackDay`, `sheets/learnedBaseFormat.ts`, `data/fuel/stackZones.ts`
(`STACK_ZONE_LABEL`) and `data/fuel/fuelConfig.ts` (`ZONE_LABELS`). Exported constants kept their shape (getter-backed objects: `MEAL_REASONS[i].label`,
`MEAL_ROLE_LABEL`, `ROLE_OPTIONS[i].label`, `RECIPE_SLOT_FACE[x].label`, `CONFIDENCE_WORD`, `SAVED_ONLY`, `DAY_STATUS`) — read them at render,
never copy one into a module constant or a memo. English check: `logic/fuelLogika.en.test.ts`. Pure logic without words, nobody's to change: `backfillWindow`, `buildProtocol`, `compileTemplate`,
`dayZones`, `defaultMealSlot`, `deriveMealName`, `fuelMode`, `macroSplit`, `mealContext`, `mealDisplayName`, `mealNutrients`,
`resolveDayType`. Single-area logic files are in the area's „Files owned" column — their words go to the area's catalog.
`data/fuel/*` holds hooks, mock seeds and a few labels (`pantryPickables.ts` „Stim.", `pantry.ts` „Supplement", `fuelHooks.ts`
„Snack", `fuelConfig.ts`): a label there is changed by the area named in § Wording; mock seed text is the controller's.

### Not converted / dead — left for the controller and F9 (nobody edits)
| File | Why |
|---|---|
| `components/GlassBox.tsx` | every consumer (A, C, E, F) moves to `Sheet` + `FoSheetHead`; the controller deletes it once unused |
| `components/FuelWaterModule.tsx`, `KamraCard.tsx`, `RecipeFitBadge.tsx`, `RecipeIngredientList.tsx`, `RecipeIngredientRow.tsx`, `StackTimeline.tsx`, `logic/dimensionFace.ts`, `logic/heroWindow.ts` | no non-test importer (dead); their tests stay green untouched; deletion is a cleanup issue |
| `data/fuel/*` mock seeds, `features/tutorial/registry/fuel.ts`, `data/notification/notificationScheduleWriter.ts`, `features/quickinput/QuickLogSurface.tsx` | old words („stack", „Vacsi", „cutoff", „Stack · … slot") outside the nine areas — controller (kalauz, mocks) / F8 / N3 |

### Known edges the foundation leaves to the builders / the controller
- **Behaviour change 1** is decided in `logic/buildDayPlan.ts`, step 3b (`extraSlots`: `label: labelByKey[k] ?? mealDisplayName(m) ?? m.title`)
  and passes unchanged through `fuelSwimlane.buildWindowLane`. The controller changes it there (one message with the time slot,
  key in `fuelLogika`), with area A's tests; A, B and C print whatever label arrives.
- `tileKey` (`${time}-${label}`, the `?w=` URL contract) carries the current language's label: a `?w=` link made before a
  language switch does not resolve after it (falls back to the nearest time). Do not build on the label part.
- `sheets/learnedBaseFormat.ts` and `logic/keretHero.ts` still call `toLocaleString` (on `locale()`) and keep private Hungarian
  short-month / weekday arrays, because `format.ts` lacks three styles: fixed fraction digits („4,0 l"), the Hungarian dotted
  short month without the closing dot („szept. 14"), the one-letter weekday set. Controller: add the styles, then drop the ratchet lines.
- The glycemic sentences in `fuelLogika.glycemic` keep the LIVE Hungarian punctuation (hyphen ranges, em dashes); the prototype
  uses en-dash ranges and colons. Controller applies the prototype's Hungarian there after the builders (tests of C follow).
- English written without a prototype pair (to be read on screen): `fuelLogika.mealWindow.reason.*` (four reasons),
  `dayPlan.window` („Morning snack", „Evening snack", „Pre-workout snack"), `keretHero.role`, `stack.anchor.*`, `learned.savedOnly.*`.

## Wording (live → new) — who changes which word (F3.10, F4.9)
The word is changed ONCE, at the file named; **bold** = a logic / data file (a label map, not markup).

| Live | New HU · EN | File | Area |
|---|---|---|---|
| „Stack · időzítés" | Kiegészítők · időzítés · Supplements · timing | `sheets/StackItemSheet` | E |
| „Eltávolítás a stackből" · „Vissza autóra" · „Mozgatás másik zónába" | Eltávolítás a kiegészítőim közül · Vissza automatikusra · Áthelyezés másik idősávba | `sheets/StackItemSheet` | E |
| „a stackben" | a kiegészítőid között · among your supplements | `FuelStackAddPage`; `KamraItemDetailPage` | E; G |
| „‹ Stack" (back label) | Kiegészítők · Supplements | `StackPageScaffold`, `FuelStackAddPage`, `FuelStackProtocolPage` | E |
| „BEVETTEM" / „KÖVETKEZIK" | Bevettem / Következik: {név}. · Mark as taken / Next: {name}. | `FuelStackPage` | E |
| „Étkezés-egyeztetés · macro + micro match" | Étkezés-egyeztetés · makró és mikro · Meal match · macros and micros | `StackMealMatch` | E |
| „Kinetikus ciklus" · „Kadencia" | A ciklus · {n}. nap a {m}-ből · Gyakoriság (How often) | `FuelMedicationPage`, `MedicationCycleBar`; `MedicationFormSheet` | E |
| „Beadás" | + Beadás / Rögzítem · + Dose / Log dose | `FuelMedicationPage`; `LogDoseSheet` | E |
| „D0 / 0. nap" without a dose | the no-dose sentence of `gyogyszer` | `FuelMedicationPage` | E |
| „(törölt Kamra-item)" | „kamra-tétel" wording | **`logic/projectStackDay`** (foundation file — E reports the exact string) | E → controller |
| „{label} stack" | no prototype counterpart — keep, report | **`logic/buildDayPlan`** | controller |
| „SLOT" (recipe field) | Étkezés · Meal | `RecipeEditorPage` | H |
| „Vacsi" · „Snack" (recipe filter, editor) | Vacsora · Uzsonna (Dinner · Snack) | `FuelRecipesPage`, `RecipeEditorPage`; **`data/fuel/fuelHooks.ts`** | H |
| „Pontszám" (recipe row) | Mezo értékelése · Mezo's rating | `RecipeDetailPage` | H |
| „Iterálás a Műhelyben" | Tovább alakítom a Műhelyben · Rework it in the workshop | `RecipeDetailPage` | H |
| „Mentés a Receptkönyvbe" | Mentés a Receptek közé · Save to Recipes | `RecipeWorkshopPage` | H |
| „kamra-item" (three strings) · „patch" | kamra-tétel · javítás | `WorkshopIngredientRow`, `RecipeWorkshopPage` | H |
| „Kamra · pick" | Kamra · hozzávaló · Pantry · ingredient (+ the two other heads) | `IngredientPickerSheet` | H |
| „Slot neve" · „Új slot" · „Budget %" · „Σ BUDGET" | Ablak neve · + Új ablak · Rész % · „Ajánlott felosztás · Σ 100%" / „Testreszabás · Σ n%" | `FuelSlotsPage` | I |
| „A budgetek összege N% — 100% kell legyen" · „…a napi budget nagy része." | A részek összege N%: 100% kell. · …a napi keret nagy része. | **`logic/validateSlotPlan`** | I |
| „Eltolás perc" · „Edzés előtt‑után (kezdet)" · „Snack" | Eltolás (perc) · Edzés kezdete körül · Uzsonna | `FuelSlotsPage` | I |
| the windows page's rating section | Mezo véleménye · „Kérd Mezo véleményét" (Mezo's view · Ask Mezo) | `FuelSlotsPage` | I |
| „Koffein-cutoff" (+ „A cutoff…") · „Étkezés/nap" | Koffein-stop (Caffeine cut-off) · Étkezés / nap | `FuelSettingsPage` | I |
| „AI ÉRTÉKELÉS" · aria „AI értékelés: x" | Mezo értékelése · Mezo's rating | `FuelMealScorePage`, `FuelRecipeScorePage`, `FuelScoreSurface`; `FuelMealBlocks` → shared `ScoreChip`; `FuelRecipesPage` | C; A; H |
| „Bizonyosság" · „KOPPINTS A RÉSZLETEKÉRT" | megbízhatóság (confidence) · Koppints egy sorra a részletekért. | `FuelScoreSurface` | C |
| „A coach javaslata a tányérod tételeiből." | Javaslat a tányérod tételeiből. | `GlycemicGlass` | C |
| „…a coach értse a mintát" | …segít, hogy Mezo értse a mintát | `sheets/MealSkipSheet` | A |
| „Nem sikerült az AI-feldolgozás…" · „Az AI nem teljesen biztos ebben a sorban…" | Nem sikerült az elemzés. Próbáld újra, vagy add hozzá kézzel. · the „nézd át" tag (`LineTags review`) + its note | `MealComposer` | B |
| „Prot / Carb / Fat" | feh. / szénh. / zsír (`fuelKozos.macroShort`) | `MacroCells` | B |
| „BMR × NEAT" · „Alaphő · NEAT" · „NEAT-szorzó" · „Alaphő" | Képlet szerint · alapanyagcsere × életmód; Alap · tanult | `EnergyBreakdownSheet` | D |
| „Supp" / „Stim" / „Supplement" | Kiegészítő / Stimuláns (Supps / Stims / Supplement) | `FuelKamraPage`, `CatalogSearchSheet`, `AddPantryItemSheet`; **`data/fuel/pantryPickables.ts`**, **`data/fuel/pantry.ts`** | G |
| „Tétel · szerkesztés" / „Új tétel · kézi" · „Import · Fotó & Link" | the item's name / kézi felvétel · Import · fotó és link | `AddPantryItemSheet`; `ImportItemSheet` | G |
| a window-less meal named after the day part | Ablakon kívül · HH:mm · Between meals · HH:mm (behaviour change 1) | the function named in the foundation report (**`logic/…`**), printed by Mai (A), the log page and the meal page (B, C) | controller, with A |
| „FŐ CÉL", „Honnan a cél" | not in the prototype — leave out | `FuelMacroRings`; `MacroPanel` | A; C |

Kept on purpose: the „· AI" tag on a draft line, the „AI" source tile on „Mit ettél?", „Logolás · +10 XP", NOVA, kcal, RIR-like
units. Wording differences found between the live logic strings and the prototype are listed in the foundation report; the
controller applies them to `fuel-logika` after the builders.

## Not to build („Kikerült" in the prototype's notes)
„Heti egyeztetés"; „A hét képe" on Mai; per-ingredient lists and minute labels on the blood-sugar sheet; „Hatás a napra" and
„Jegyzet" on the meal page; the „Növényféle" tile (meal and recipe); Keresés / Gyors / Diktálás log modes; every „Prototípus ·
állapotváltó"; the „Cél felé" step chart and the smoothed weight trend; a fourth „Naplózott nap" tile; invented bottom rows on
patterns; „készlet 42 / 90 · kb. 6 hét"; the protocol's „fehérje rendben" row; the „25 mg fölött" limit; „becsült jelenlét" on
medication; „Kifőzöm a Műhelyben" on Receptek; a tappable swap suggestion in Kamra; Konyha goal buttons as separate launchers;
„becslés" rows inside a saved recipe; a jump from an ingredient to its pantry item; recipe logs from other days; the „horgony"
label; a „Hogy tanultam?" link in settings; the manual editor's „Recept mentve" message.
Live behaviour to KEEP: the stack page has no error face; the protocol saves at once (no history, no common Save); on `stack-uj`
steps 2–3 the header back exits to Protokoll and the in-page link steps back; the Trendek hero has no button and no error face;
ingredient rows are not tappable; the stack item box has no stock level; stopping a medication is never error-coloured.

## Icons
The Fuel prototype uses 73 `t-*` glyph ids; all are in `docs/design_2.0/assets/folyadek-glyphs.json`, in the app sprite
(`frontend/src/shared/ui/clay/titanium-icons.svg`) and in `Icon3DName` — **none missing, no „Új ikonok" sheet**. Prototype id =
sprite id. `i-check` is the prototype's line icon: use the kit `Tick` / `Mark`. Old clay ids in the live Fuel markup (`i-kristaly`,
`i-kamra`, `i-recept`, `i-muhely`, `i-polc`, `i-heti`, `i-lombik`, `i-fazek`, `s-energia`) leave with the old skin — take the
glyph the prototype draws on that spot.

## Controller, after the builders
Apply the wording that lives in foundation / data files and behaviour change 1 at its source → fold local pieces into the kit
(one recipe per thing) → remove `FuelScoreChip`, `useFuelCountUp`, `GlassBox`, `GlycemicMiniCurve` once unused → shared tests
rewritten once to the new truth (`prototypeCssStructure` fuel blocks, `sheetGlassGuard`, `stackCssContract`, `fuelBadges`,
`kamraCards`, kalauz registry copy, `tests/layout/*` selectors, `language-en.spec.ts` routes) → `features/fuel/` and
`shared/ui/DayNavigator.tsx` into `TRANSLATED`, allowlists shrunk, the ratchet lines of converted files removed → delete the
old Fuel skin from `prototype.css` with the zero-usage proof (F1.13, F4.11; the block map is in the foundation report) → full
gates (both modes, layout specs, build) → runtime pass at 390 / 320 / reduced motion in both languages against the prototype →
backend sentences of the Fuel screens in both bundles → docs (`fuel.md`, `pantry.md`, `recipe.md`, `_platform-language.md`,
index, roadmap, bible F5.x, HANDOFF) → codemap, lint-docs → merge, deploy, live check.

## Kész, ha…
The acceptance list on `mezo-n4wf5.5` (`bd show mezo-n4wf5.5`).
