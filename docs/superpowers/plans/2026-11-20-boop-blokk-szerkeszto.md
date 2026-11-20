# Boop — napi gyakorlatszerkesztő a futó blokkban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The block builder's Napok day card becomes an editor — add, remove (undoable), swap for the rest of the
block, reorder, and per-exercise rep range / reserve / starting weight / warm-ups — saved with the builder's one
*Mentés*, the evaluator's numbers following every edit.

**Architecture:** One new server read ranks add/swap suggestions for a block day by reusing the pure
`ExerciseSubstituteRanker` and returns each suggestion's style prescription; `replaceDayExercises` refuses a
structural save while that day's workout is running. On the phone, `BlockDraft` becomes identity-aware (stable local
keys, no wire ids), gains structural edit operations, and the existing save path sends each changed day once.

**Tech Stack:** Spring Boot, OpenAPI contract-first (`api/feature/train/train.yml`), JUnit/AssertJ + Testcontainers ITs;
Swift 6 / SwiftUI, `BoopCore` (hand-written `RawJSONClient` plan path), Napkelte kit.

**Spec:** `docs/superpowers/specs/2026-11-20-boop-blokk-szerkeszto-design.md` (owner OK 2026-11-20). **Approved look:**
branch `spike/boop-blokk-szerkeszto`, `ios/Boop/BlokkSzerkesztoDemo/*.swift`, screenshots
`docs/superpowers/specs/assets/blokk-szerkeszto/1-…10-*.png` (owner OK „Jó, jöhet a terv”). **Issues:** `mezo-r36n9.116`
(driving), `mezo-r36n9.118` (small-phone button), unblocks `mezo-r36n9.114`.

## Global Constraints

- The phone never computes a band or a ranking; the server measures and ranks.
- Override keys are exactly the server's: `workingSets`, `repRange` (min+max together), `targetRir`, `restSec`.
  Starting weight and warm-ups are never stamped. *Visszaállítom az edzésmódra* clears all of a row's keys.
- Wire rows carry no id; the server matches by catalogue id, else exact name. Proposals apply by request index —
  the draft is never sorted.
- Reason sentences come from the fixed phrase table only (`SubstituteReason`): no digits, no „legjobb”, no exercise
  names. New signal: `UNDER_BAND` → „ezen a héten kevés jut erre az izomra”.
- Today's check-in pain counts only when the edited day is today's weekday.
- Add-mode candidates are strictly the catalogue rows whose coarse group (`MuscleGroup.of`) is the chosen one.
- No change to `MesoPlanGeneratorService`, `StyleTable`, `WeeklySignalReader`, the style block of `application.yml`,
  `train.md` §4/§9 (owned by `mezo-r36n9.115`). `StyleStamper` / `StyleTable.stamp` are called read-only.
- Napkelte: never emoji, no SF Symbols except chevrons/arrows, white type, colour from the hue; reduced motion has a
  still branch; smallest iPhone width works.
- BoopKit builder tests run with a per-test timeout (the recursion incident).
- Before Task 3, write this issue's build-phase *Owns* (the B5 issue `mezo-r36n9.15` still lists `BoopCore/Train/**`;
  its session is idle — say so in the issue). One writer at a time for `train.yml` / `api/openapi.yml`.

## Review Focus

1. **A day whose workout is running** — phone: card read-only; server: structural save → 409, same-order save → 200.
   *(Task 2 IT, Task 5 screenshot.)*
2. **Swap of a row with overrides** — the new row keeps the overridden values and keys, takes the rest from the
   suggestion. *(Task 3 test.)*
3. **Reorder only** (same exercises, new order) is detected as a change and saved; **same-count swap** is detected.
   *(Task 3 test.)*
4. **A suggestion picked offline / from the full list without a prescription** gets 3 × 8–12 · 2 tartalék (unstyled
   default) and still evaluates. *(Task 3 test.)*
5. **Save fails after the first day** — the draft keeps unsaved rows (new rows included) across the reload.
   *(Task 3 carry test.)*

---

### Task 1: Server — block-day suggestions

**Files:**
- Modify: `api/feature/train/train.yml` (path + `BlockExerciseSuggestionsRequest`; response reuses
  `ExerciseSubstitutesResponse`, `ExerciseSubstitute` gains optional `prescription`), regenerate (`cd api/generate && npm run generate:api`)
- Create: `backend/.../feature/train/service/BlockSuggestionService.java`
- Modify: `ExerciseSubstituteService.java` (extract the shared pool / candidate / history / item-building helpers into
  package-private methods both services call — no logic copy), `ExerciseSubstituteRanker.java` (`Signal.UNDER_BAND`;
  `Context` gains `Set<String> underBandGroups`), `SubstituteReason.java` (phrase), `controller/TrainController.java`
- Test: `ExerciseSubstituteRankerTest`, `SubstituteReasonTest`, new IT `BlockExerciseSuggestionsIT`

**Interfaces — Produces:**
`POST /api/train/mesocycles/{id}/exercise-suggestions` → `getBlockExerciseSuggestions`:
```yaml
BlockExerciseSuggestionsRequest:
  mode: replace | add            # required
  dayIndex: integer              # required, 0..6 = Hét..Vas
  outgoing: { catalogId?: uuid, name: string, muscle: string, type: string }   # replace
  muscle: string                 # add — a coarse group key (back, chest, …)
  dayCatalogIds: uuid[]          # the draft day's current exercises
ExerciseSubstitute.prescription: { workingSets, repMin, repMax, targetRIR, restSec }  # null on an unstyled block
```
- `replace`: out = catalogue row of `outgoing.catalogId` (else a custom candidate from name/muscle/type).
- `add`: out = synthetic `Candidate(muscle = the group's most common catalogue token among the day's rows, else the
  first catalogue token of that group; type = "compound" if no compound of that group is in `dayCatalogIds`, else
  "isolation"; all attributes null, custom = false)`; pool pre-filtered to `MuscleGroup.of(c.muscle) == muscle`; no
  widening (call `rank` with the filtered pool; widening only reaches same-region rows already in it).
- Context: goal = the block's `goalPreset`; gym availability; discomfort history at today; `soreNow = false`;
  pain joints from today's check-in only if `dayIndex == today's weekday index`; `inWorkout = dayCatalogIds`;
  `underBandGroups` = groups whose weekly sets in the stored block are below their band low (reuse the run evaluation,
  `MesoPlanEvaluateService` run path) — `UNDER_BAND` is the second signal when the candidate's group is in it and no
  discomfort signal applies.
- `prescription` = `StyleStamper.stamp(...)` on a `GymExerciseJson` built from the catalogue row with the block style.
- 404 foreign/unknown block; 409 archived block (same error as `RUN_NOT_EDITABLE`).

- [ ] **Step 1: Failing ranker/reason tests:** `rank_shouldExplainUnderBand_whenGroupIsUnderBandAndNoDiscomfort`
  (signals `[SAME_ROLE, UNDER_BAND]`); `UNDER_BAND` never outranks anything (order unchanged with/without it);
  `SubstituteReasonTest` exact sentence for `[SAME_ROLE, UNDER_BAND]` and the existing digit/name guard passes.
- [ ] **Step 2: Failing IT `BlockExerciseSuggestionsIT`:** replace on a styled block → ≤5 suggestions, every one with a
  non-null `prescription` and a reason ending in „.” · unstyled block → `prescription` null · add `muscle: "back"` →
  every suggestion's catalogue muscle has group `back` · `dayCatalogIds` rows absent · gym profile `offKinds:[machine]`
  → no machine suggestion, labelled `NO_EQUIPMENT` · a STRONG-pain row labelled `HURT_BEFORE` · `dayIndex` ≠ today's
  weekday ignores a shoulder check-in (order equals the no-check-in order) · foreign block 404 · archived 409.
- [ ] **Step 3:** Implement. **Step 4:** `cd backend && ./mvnw test -Dtest='ArchitectureTest,ExerciseSubstitute*,SubstituteReasonTest,BlockExerciseSuggestionsIT,ExerciseSubstitutesIT' -Dmezo.test.use-testcontainers=true` green; `node scripts/gen-codemap.mjs`. Commit.

### Task 2: Server — no structural save over a running workout

**Files:** Modify `service/TrainService.java` (`replaceDayExercises`), `repository/WorkoutSessionRepository.java`
(`existsByCreatedByAndTemplateSessionIdAndStatus`); contract: document the 409 on `replaceDayExercises`. Test: new
`ReplaceDayExercisesRunningWorkoutIT`.

- [ ] **Step 1: Failing IT:** with an `active` instance whose `templateSessionId` = the day: a reorder → 409 with
  message key `DAY_WORKOUT_RUNNING`, rows unchanged; a same-order save with a changed rep range → 200; after the
  instance is finished the reorder → 200.
- [ ] **Step 2:** Implement: before any write, if `!alignedByIdentity(old, fresh)` and such an instance exists →
  `SystemRuntimeErrorException(SystemMessage.error(DAY_WORKOUT_RUNNING)…, CONFLICT)`.
- [ ] **Step 3:** Focused run incl. `ArchitectureTest` and the existing `MesoTemplateIT` / day-replace ITs. Commit.

### Task 3: BoopCore — identity-aware draft with structural edits

**Files:** Modify `ios/BoopKit/Sources/BoopCore/Train/BlockDraft.swift`, `BlockBuilderModel.swift`. Test:
`ios/BoopKit/Tests/BoopCoreTests/BlockDraftEditTests.swift` (new; every test with a time limit).

**Interfaces — Produces:**
```swift
// DraftExercise: `id` stays the stable local key (server id for loaded rows, "new-<uuid>" for added ones);
// gains `catalogId: String?`, `var repMin, repMax, targetRIR, warmups: Int`, `var anchorWeightKg: Double?`,
// `var overrides: Set<String>`, `var isNew: Bool { id.hasPrefix("new-") }`.
public struct Prescription: Equatable, Sendable { workingSets, repMin, repMax, targetRIR: Int; restSec: Int? }
extension BlockDraft {
  mutating func add(day: Int, catalog: CatalogExercise, prescription: Prescription?)
  mutating func remove(day: Int, at: Int) -> DraftExercise          // returns the row for undo
  mutating func insert(day: Int, _ row: DraftExercise, at: Int)     // undo
  mutating func move(day: Int, from: IndexSet, to: Int)
  mutating func replace(day: Int, at: Int, with: CatalogExercise, prescription: Prescription?)
  mutating func setRepRange(day: Int, at: Int, min: Int, max: Int)  // marks "repRange"
  mutating func setReserve(day: Int, at: Int, _ v: Int)             // marks "targetRir"
  mutating func setAnchor(day: Int, at: Int, _ kg: Double?)
  mutating func setWarmups(day: Int, at: Int, _ n: Int)
  mutating func resetToStyle(day: Int, at: Int)                     // clears all overrides
}
```
- New / replacement rows take `prescription` or, when nil, 3 × 8–12 · 2 tartalék, no overrides. `replace` keeps
  `technique`, `challenge`, per-exercise style, `restSec` and every overridden field of the old row; other fields from
  the prescription. Ranges: rep 1–30 with min ≤ max, reserve 0–4, warm-ups 0–4, anchor ≥ 0 in 0.5 steps or nil.
- `changes(since:)` per day compares the ordered list of local keys + every editable field → reorder, same-count
  swap and field edits are changes. `carryEdits(onto:original:)` keeps new rows and structural edits of unsaved days
  (matching saved days by local key; a day the server already took is not re-applied).
- `dayInput(_:forSave:)` writes `overrides`, `catalogId`, the edited fields; no id on the wire.
- Proposals (`apply(_:)`) still address request indices of the current draft order.

- [ ] **Step 1: Failing tests:** add with/without prescription · remove + insert restores equality with the original
  (`changes` empty) · move detected · same-count replace detected · replace keeps an overridden rep range and its key
  and the technique, takes sets from the prescription · setRepRange marks `repRange`, setReserve marks `targetRir`,
  resetToStyle clears all · bounds clamp · `dayInput` has no id and carries `overrides` · carryEdits keeps a new row
  on an unsaved day after a fresh read · an empty day with one added row produces a one-row `dayInput`.
- [ ] **Step 2:** Run BoopKit tests (README command, `-only-testing:BoopCoreTests/BlockDraftEditTests` while
  iterating) → fail. **Step 3:** Implement. **Step 4:** Whole BoopKit suite green. Commit.

### Task 4: BoopCore — suggestions client + preview stubs

**Files:** Modify `BoopCore/Train/PlanClient.swift`, `PlanWire.swift`; `ios/Boop/EdzesTerv/PlanPreview.swift`
(`PlanPreviewTransport`: answer `getBlockExerciseSuggestions`, honour `-previewBlokkSuggest fail`). Add the
builder's ops to the iOS contract gate (`check-ios-contract.mjs` input or the generator filter, whichever the gate
reads) so a contract change cannot silently break them. Test: `BoopKit/Tests/BoopCoreTests/PlanSuggestionsTests.swift`.

**Interfaces — Produces:**
`func suggestions(blockId: String, _ request: WireSuggestionsRequest) async throws(PlanFetchError) -> WireSuggestions`
with `WireSuggestions { suggestions: [WireSuggestion]; labels: [String: String] }`,
`WireSuggestion { exercise: WireCatalogItem; reasonText: String; signals: [String]; lastTopSet: WireTopSet?; prescription: Prescription? }`
(lenient decoding: unknown signals and missing `prescription` tolerated).

- [ ] **Step 1: Failing tests:** decodes two suggestions with prescription and a label map · missing prescription →
  nil · 409 maps to the existing not-editable error · request encodes `mode`, `dayIndex`, `dayCatalogIds`.
- [ ] **Step 2–4:** Implement, preview stubs (invented data mirroring the spike), BoopKit green. Commit.

### Task 5: The editor screens

**Files:** Modify `ios/Boop/EdzesTerv/BlockBuilderPage.swift` (`BuilderDayCard` rows, bottom bar); create
`ios/Boop/EdzesTerv/DayEditSheets.swift` (settings sheet, add sheet, swap sheet, ⋯ menu); `BlockBuilderModel` hooks
(`suggest(mode:day:…)`, `lockedDay: Int?` from today's open workout, `pendingReviewDays: Set<Int>` from the week review
already loaded). Delete nothing from the spike branch here — the spike stays unmerged.

Build to match the spike screenshots 1–9 exactly, with these spec rules: rows = ≡ handle (replaces the body mark),
name, subtitle `<izom> · <min>–<max> ism. · <r> tartalék`, set stepper (wraps under the name below ~434 pt), ⋯;
reorder by the handle (`onMove`); delete with the undo line; tap row → settings sheet (with *TE ÁLLÍTOTTAD* and
*Visszaállítom az edzésmódra*); ＋ → add sheet (muscle chips: *kevés* groups first from the evaluation, then the
day's groups, then *Más izom*; ≤5 suggestions; *Minden gyakorlat* with search and the two labels); ⋯ *Csere* → swap
sheet *„Mire cseréljük a blokk végéig?”*; empty day line; locked day (the day of today's open workout) read-only
with its line; on *Mentés*, if a changed day ∈ `pendingReviewDays` → the confirm alert (*Függő heti javaslat*, the
spec sentence, *Előbb átnézem* / *Mentem*); a 409 from a day save shows *„Ezen a napon most fut az edzésed — utána
szerkesztheted.”* and keeps the draft. Fix `mezo-r36n9.118`: the bottom main button's label fits at 375 pt
(`minimumScaleFactor` / shorter label *„Nincs változás”*). Suggestion failure → full list + the spec line.

- [ ] **Step 1:** Preview flags `-previewBlokkEdit default|menu|settings|add|swap|undo|empty|locked|confirm` (with
  `-previewBlokkOpen epito -previewBlokkTab napok`); document them in `docs/features/boop-ios.md`.
- [ ] **Step 2:** Implement. **Step 3:** In the session's own simulator screenshot every flag state + 375 pt default +
  reduced motion; compare with spike 1–10. App test target builds; BoopKit + Boop `xcodebuild test` green. Commit.

### Task 6: Docs, review, ship

- [ ] Handbook `docs/boop-handbook/07-edzes/16-blokk-epito.md` (Napok: the editor; *Mi marad ki* → only day
  add/rename/move; *Adattáblák* unchanged), `02-mezociklus-terv.md` (set editing and the editor are live), new release
  row in `_kiadasok.json`; `docs/features/boop-ios.md` (builder section, preview flags, the new op), `docs/features/train.md`
  (the suggestions endpoint and the 409 — **not** §4/§9 body text owned by `.115`; add under the reasoned-swap
  section), feature index row, `docs/milestones/roadmap.md` dated entry; boop skill §6 row.
- [ ] Gates: backend full suite `./mvnw clean test -Dmezo.test.use-testcontainers=true` (a lone connection-reset IT
  is re-run in isolation and reported); BoopKit + Boop `xcodebuild test`; `node scripts/gen-codemap.mjs`;
  `node scripts/lint-docs.mjs` (pre-existing stale finding from another session is reported, not fixed).
- [ ] Fresh-context review on the most capable model; fix Critical/Important test-first; minors → bd under the epic.
- [ ] Rebase → detached `--no-ff` merge → push → regenerate CODEMAP → `deploy` green → pod tag = release version.
- [ ] Announce, then `ios/scripts/install-on-phone.sh`; on the phone: open Blokk szerkesztése → Napok → add one
  exercise to an empty day, reorder two, change a rep range, *Mentés*, reopen and see it kept; then undo it all and
  save again (his real block must end as it started unless he wants the change).
- [ ] Close `mezo-r36n9.116`, `mezo-r36n9.118`; Notion sync (`plan` → apply → `check` 0); `check-beads-backup --fix`;
  delete the session simulator; delete the spike branch.

## Kész, ha…

**Amit látsz**
- [ ] A nap lapja megegyezik a bemutatóval: fogó, név, ismétlés · tartalék, sorozatléptető, „⋯”; „＋ Gyakorlat hozzáadása”.
- [ ] Hozzáadás izomválasztással („kevés” elöl), legfeljebb öt indokolt ajánlással, teljes listával és kereséssel.
- [ ] Csere a blokk végéig ugyanazzal az ajánlással; a te beállításaid megmaradnak.
- [ ] Törlés visszavonással; átrendezés húzással; üres napból edzésnap lesz.
- [ ] Beállítások: ismétléstartomány, tartalék, kezdősúly, bemelegítés; „TE ÁLLÍTOTTAD” és visszaállítás az edzésmódra.
- [ ] A futó edzés napja zárolt (a telefonon és a szerveren is); függő heti javaslatnál mentés előtt rákérdez.
- [ ] Töltődés, hiba, internet nélkül: a teljes lista működik, az ajánlás helyén egy mondat; kis telefonon minden olvasható (a fő gomb felirata is); csökkentett mozgásnál nincs ugráló animáció.
- [ ] Indoklásban nincs „legjobb”, szám vagy gyakorlatnév.

**Megmaradt működés** — sorozatléptető, technika- és kihívásválasztó, izomszámok, figyelmeztetések, „Igazítsd a sávba”, a heti javaslat elfogadása, az edzésmód és a Blokk fül változatlan.

**Kapuk** — a 6. feladat listája szerint, mind zöld, bizonyítékkal.

**Élesítve** — az új szerverváltozat fut; a telefonon kipróbálva egy valódi napon, és a blokk az eredeti állapotába visszaállítva (hacsak nem akarod megtartani a változást).

**Dokumentáció és Notion** — kézikönyv két oldala, kiadási sor, jegyek állapota, Notion-ellenőrzés hibátlan.
