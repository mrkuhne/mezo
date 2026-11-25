# Boop — home ring numbers, the Pénz orb, the photo type, the full quick log (mezo-r36n9.151–.154)

**Owner report 2026-11-23/24**, four items: the home ring's orbs show no numbers although the Étel room shows one;
the Pénz orb is grey with no number although Pénz is live; a quick-log button is wanted on the home screen (right,
under the orbs, above the bar) with everything the web app's quick log had; logging a meal by photo throws an error.
Decisions 2026-11-24 (#96–#98): **one number** for Étel (the room's), **a percentage** for Pénz, **the full sheet
plus the home button**. The photo bug needed no decision. Spec and plan are folded into this one OK (small, visible
fixes + one sheet rebuilt on the existing kit; no new look).

Session: `kezdolap-orbok-fotos-naplozas`, branch `feat/boop-kezdolap-orbok-gyors-rogzites`, worktree `/Users/daniel.kuhne/mezo-kezdolap`.

## Findings (code reading + a native probe, 2026-11-23)

| # | Owner's words | Cause | Fix |
|---|---|---|---|
| 1 | no numbers in the home orbs; the Étel room shows one | `ringItem` reads the brief's score through `maiCopy`, which nils **every** score when `brief.state == .learning`; the server says learning whenever Forma is null (last night missing or < 14 known nights). The room's number (`etelDayPoints`, meal-point average) is a different number from the brief's fuel score (kcal pace) | `visibleScore`: learning hides Forma alone; the Étel orb reads the day's meals (`EtelStore.loadDay`) — one number with the room |
| 2 | Pénz orb grey, no number | `Area.penz.hue == nil` → `live == false` (still "planned"); the ring reads only the brief, which has no money metric; the Pénz room's orb is level-only by design | Pénz live; `penzWeekShare` (week remaining / budget, 0–100) from `PenzStore.allowance` |
| 3 | quick-log button + the web's nine doors | the bar's "+" opens a sheet with Étkezés, Check-in, Napló (= evening close), Súly/Edzés "hamarosan", Kiadás; Víz, Kiegészítők, Sport, Alvás missing | nine doors, all real (`CaptureSheet.doors`), six quick sheets (`QuickSheets.swift`), two new outbox kinds (`weightLog`, `sleepLog`), `logSleep` in the generator filter, the home's Rögzítés button, `RitmusRouter.openRoom` for Edzés indítása |
| 4 | photo meal → error | the generated `.photo` multipart part has no content type → `application/octet-stream` → the server's mime check (image/jpeg|png|webp) answers 400; the image store refuses too, so saved meals never got photos. Proved with a native probe test printing the multipart body | raw parts naming `image/jpeg` in `draft()` and `putPhoto()` (the „Ezt főztem" pattern); `FoodPhotoPartTests` |

**Found on the way (2026-11-24):** the app aborted at launch as soon as the home read the Pénz store — `PenzStore.read`'s ten `async let`s awaited as two tuples trip the Swift 6.2 / iOS 26.3 runtime (`swift_task_dealloc` fatal error); the same abort killed every Pénz client test suite natively (signal 6, the "full suite aborts" mystery of 2026-11-23). Rewritten as unstructured `Task`s: 114 Pénz tests green natively, the app launches. Filed under `mezo-r36n9.153`.

## Kész, ha…

- [x] BoopCore: `visibleScore`, `penzWeekShare`, `sleepDurationHours`, `QuickSport`, `WeightLogPayload`, `SleepLogPayload`, `OutboxKind.weightLog/.sleepLog` + groups, `RitmusClient.sendWeight/sendSleep`, `FoodClient.jpegPart`, `PenzStore.read` on unstructured tasks — native `swift test` green: the whole BoopCore suite, 951 tests in 92 suites, no skips (a design-free copy of BoopKit on macOS).
- [x] App: `Area.ringItem(_:brief:foodDay:penz:)`, `Area.penz.live`, `KezdolapView` loads the day + the allowance and carries the Rögzítés button, `MaiView.maiCopy` uses `visibleScore`, `EtelStore.loadDay`, `RitmusRouter.room`, `RitmusEnvironment.captureWeight/Sleep/Sport/Journal`, `CaptureSheet` nine doors, `QuickSheets.swift` six sheets, `ShellView` wiring + `-previewOpen` flags.
- [x] App tests written: `KezdolapRingTests`, `CaptureSheetTests`, `MaiCopyTests.learningKeepsTheOtherFourScores`, `MaFoodRowsTests` updated; the Boop test bundle compiles (`xcodebuild build-for-testing`).
- [ ] App tests run (`xcodebuild test` BoopKit + Boop) — on the Xcode-ready Mac (`mezo-r36n9.150`); the new Mac has no Developer Mode for the simulator runner.
- [x] Simulator: the home ring with numbers (learning brief → Forma "–" only), the Pénz orb lit with its share, the Rögzítés button, the "+" sheet with nine doors, each quick sheet; smallest width unaffected (sheets scroll).
- [x] Docs: handbook `01-alapok/gyors-rogzites.md` (rewritten), `01-alapok/kezdolap.md`, `11-penz/02-terulet.md`, `06-etel/02-etkezes-rogzitese.md`; `_dontesek.json` + `14-decisions.md` #96–#98; `_jegyek.json`; `docs/features/boop-ios.md` §2/§8/§9/§10; `ios/README.md` flags; `_kiadasok.json` row on merge; CODEMAP; lint-docs 0/0.
- [ ] Shipped: merged to main, CI green; installed on the phone and walked through — from the Xcode-ready Mac (`mezo-r36n9.150`): Étel › + › Fotó draft arrives and the saved meal shows its photo; the ring's numbers; the Pénz orb; the nine doors.
- [ ] Notion mirror synced (`mezo-r36n9.148`, no owner connector on this Mac).
