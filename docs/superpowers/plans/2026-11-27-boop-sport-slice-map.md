# Boop Sport — slice map (playbook §5)

> bd `mezo-r36n9.188` · epic `mezo-r36n9` · 2026-11-27 · **Spec:** `docs/superpowers/specs/2026-11-27-boop-sport-design.md`
> (owner OK 2026-11-27, „Mehet így") · **Spike (look + copy, throwaway, never merged):** branch `spike/boop-sport`,
> `ios/Boop/SportDemo/SportDemoRoom.swift` (flags in spec §8). Copy strings come from the spike verbatim unless a step
> says otherwise. **Status:** owner OK 2026-11-27 („Mehet így").

This is a **slice map**, not a task-by-task plan. Each step below is one fresh session (≤ ~150 tool calls), its own bd
issue under the epic, its own `feat/` branch, merged to main on its own (`--no-ff`, no self-PR). The step's session
starts with `superpowers:writing-plans` for **its** step only (a short TDD plan in `docs/superpowers/plans/`), then
builds it. No visual round in between: the spike is the approved look (CLAUDE.md §Owner gates — after the third OK the
owner does not iterate again). The handoff goes into the next step's bd notes (playbook §5.4).

## Global constraints (every step)

- B = `backend/src/main/java/io/mrkuhne/mezo`. Contract first (`api/feature/train/train-sport.yml`, tag `Sport`, appended
  to `api/generate/merge.yml`, regenerate `api/openapi.yml`, `node scripts/check-ios-contract.mjs`). Liquibase in
  `1.1.0/script/yyyyMMddHHmm_mezo-r36n9.188_<slug>.sql`, registered in `1.1.0_master.yml`; no bare jsonb `?`.
- Cross-feature reads through consumer-owned ports (the `feature/season` pattern); `boop` stays a leaf.
- iOS: the area is built on the L0 kit (`NKAreaPage`/`NKAreaSubPage`, `NKAreaBar`); a hand-written lenient client over
  `RawJSONClient` cached in `ServerCache` (`sport/overview`, `sport/load`, `sport/body`) — the Évad/Pénz pattern;
  captures go through the existing `OutboxKind.sportSession` (`clientRef`). Pure builders in `BoopCore/Sport/` tested
  with Swift Testing + `StubTransport`.
- **Gym and sport are two things**: never infer one from the other; a day = {gym?, sport[]}.
- **No invented number** (spec 2026-11-13 §5.1): every number comes from the server; unknown → „–".
- Never „Mezo" or emoji visible; no SF Symbols except chevrons/arrows; right at 375 pt; reduced motion = still.
- Hidden for good: stars, XP, medals, ceremony, jump count, run-plan builder (decisions Q1, Q2).
- Hot spots (one writer at a time, boop skill §3): `api/openapi.yml`, `merge.yml`, `ios/BoopKit/Sources/BoopAPI/**`,
  `1.1.0_master.yml`, `ResetDatabase.java`, `ios/Boop.xcodeproj/**`. Before touching one, check
  `bd list --parent mezo-r36n9 --status in_progress` for an owner.
- No personal health values in docs, commits, Notion; examples marked „például".

## Sequencing with parallel work (read before S3 and S6)

- **`mezo-r36n9.196`** (barless home ring, Évad becomes an orb) also edits the ring (`Kezdolap/**`, `Area`/`Hue`).
  Sport lands **after** it: the Sport orb sits right after Edzés in whatever ring `.196` leaves (it may be the 11th
  orb). If `.196` is still open when S3 starts, S3 builds the area page and its DEBUG preview but leaves the ring edit
  to S6, and says so in its handoff.
- **`mezo-r36n9.197`** (Edzés redesign) owns `ios/Boop/Edzes/**`. The Edzés „Ma sport van" line (S6) is either done by
  S6 after `.197` merged, or handed to `.197` as a one-line requirement — never two writers in `Edzes/**`.
- **`mezo-r36n9.15`** (B5 player) owns the in-workout player; no step touches it.

## Steps

```
S1 szerver: két réteg ─┬─> S2 szerver: Sport olvasómodellek ─> S3 iOS: terület + Ma ─┬─> S4 iOS: Hét + heti rend ─┐
                       │                                                             └─> S5 iOS: Napló + Test ─────┼─> S6 app-szintű + kiadás
                       └───────────────────────────────────────────────────────────────────────────────────────────┘
```
S4 and S5 may run in parallel (disjoint files, see Owns). S1 alone already fixes visible bugs (logged volleyball no
longer ticks the gym).

### S1 — Server: gym and sport as two layers, kinds widened · `mezo-r36n9.201`
**What:** Liquibase widening of `sport_schedule_slot` and `sport_event` kind CHECKs to the log's ten kinds + `other`, API
patterns aligned in `train.yml`; `BoopDay` gains `sport[]` next to `session` (boop contract); `BoopDayAssembler.markDone`
matches **by kind** (sport log / volleyball Health workout ticks sport, gym instance / strength workout ticks gym);
`SeasonMenuSourceAdapter` feeds **every** sport window of the day; the Edzés-day read exposes „sport today" so the room
can stop saying „pihenőnap".
**Owns:** `B/feature/train/**` (sport schedule/event validation only), `B/feature/boop/service/BoopDayAssembler.java`,
`B/feature/boop/**` DTO/mapper for `sport`, `B/feature/season/service/SeasonMenuSourceAdapter.java`,
`api/feature/train/train.yml`, `api/feature/boop/boop.yml`, `api/openapi.yml`, Liquibase script + `1.1.0_master.yml`,
matching tests.
**Kész, ha:**
- [ ] a slot and an event with kind `running`, `football`, `other` save and read back (contract IT); an unknown kind is 400
- [ ] a day with gym 07:00 + volleyball 18:00: logging the volleyball leaves the gym session not done, and vice versa (IT)
- [ ] a volleyball Health workout ticks the sport, a strength workout ticks the gym (IT with fixtures)
- [ ] a day with two sport windows gives two pre-session snacks in the menu source (unit test)
- [ ] focused ITs + `ArchitectureTest` green with `-Dmezo.test.use-testcontainers=true`; `check-ios-contract` green;
      codemap regenerated; `lint-docs` 0/0; `docs/features/train.md` + `boop` doc updated
- [ ] merged, `deploy` green for the commit, prod `\d sport_schedule_slot` shows the widened CHECK

### S2 — Server: the Sport read models · `mezo-r36n9.202`
**What:** `GET /api/train/sport/overview?week=` (both lanes, totals, week count done/planned, tonight's moment incl. the
unmatched Health workout for pre-fill, today's skip), `load?weeks=6` (sport RPE×min and gym load on one scale — pick
and document the rule, spec §6), `body?week=` (per-muscle heat for gym and sport; sport from a server-side sport →
muscle-load table scaled by session load; unknown kind → no heat, not a guess), `shoulder?weeks=6`, `gaps?week=`;
hints reusing the `SportInterferenceDetector` rules through a port (re-check the 6–8 h gap guidance before it becomes a
threshold, spec §7).
**Owns:** `B/feature/train/service/sport/**` (new), `B/feature/train/controller/SportReadController.java`,
`api/feature/train/train-sport.yml`, `merge.yml`, `api/openapi.yml`, `B/feature/character/detector/SportInterferenceDetector.java`
(extraction only), tests.
**Kész, ha:**
- [ ] each endpoint has a contract IT incl. an empty user (no rhythm → week count `null`, lists empty, never 500)
- [ ] week boundaries in the owner's zone (`mezo.wearable.zone`): Sunday 23:30 local is still this week (test)
- [ ] the pre-fill block appears only for an unmatched volleyball workout of today; a matched one moves to „done" (IT)
- [ ] `load` and `body` numbers are deterministic for a fixture week (golden unit test); the conversion rule is written
      in `docs/features/train.md`
- [ ] gates as S1; `_funkciok.json` rows for the new endpoints; merged + deployed

### S3 — iOS: the Sport area, the Ma tab and the two sheets · `mezo-r36n9.203`
**What:** `Hue.sport` (coral evening sky) + the outlined `ball-sun` glyph; `Area.sport` and the area page on the L0
kit with the four tabs (Hét/Napló/Test as `NKNotLiveYet` until S4/S5); `BoopCore/Sport/{SportWire,SportClient,
SportModel}` over `RawJSONClient` + `ServerCache`; **Ma** exactly as the spike (hero with four moments, A napod strip
with two blocks, week carousel with two lanes, Amire figyelek, ask row); **Log** sheet with the „Az órádról" pre-fill,
effort chips defaulting to the last value, sets, shoulder, note → Outbox; **Skip** sheet with eight reasons + undo
(kímélő rules unchanged); the ring orb only if `.196` has merged (see Sequencing).
**Owns:** `ios/Boop/Sport/**` (new), `ios/BoopKit/Sources/BoopCore/Sport/**` (new), `BoopDesign/Napkelte/Tokens.swift`
(the `.sport` hue only), the glyph asset, the exhaustive `Hue` switches (`Nap/MaiView.swift` metricKey,
`Nap/AreaRoom.swift` name/glyph/tabs), `Kezdolap/{Area,KezdolapView}.swift` (only after `.196`), tests.
**Kész, ha:**
- [ ] the four Ma moments, a sport-only day and a gym-only day („Ma nincs sport" + the next one) match the spike shots
- [ ] empty / loading / error / offline states (spec §5.9); cached week shows instantly, fresh data loads behind it
- [ ] a log saved offline appears at once and is sent once on reconnect (`clientRef` test)
- [ ] largest Dynamic Type: chips wrap whole words, effort row is two rows of five, hero stacks ring above text;
      VoiceOver labels on the ring, strip and every chip with its selected trait; reduced motion still; 375 pt right
- [ ] `xcodebuild test` BoopKit + Boop green; codemap; lint-docs 0/0; merged

### S4 — iOS: Hét and the weekly rhythm (parallel with S5) · `mezo-r36n9.204`
**What:** Hét as the spike: hero totals + two-lane week chart, Terhelés · 6 hét stacked bars, A heti rend with the
recurring slots (row → **slot editor**, **Új rendszeres alkalom**; eleven sport chips, day tiles, steppers, edzés/meccs,
place, the „Ez változik" box, delete; the phone sends the whole list — PUT is a full replace), one-off events (sheet,
delete), the eleven kinds.
**Owns:** `ios/Boop/Sport/Het/**`, `ios/BoopKit/Sources/BoopCore/Sport/{SportSchedule*,SportEvent*}.swift`, tests.
**Kész, ha:**
- [ ] editing one slot keeps every other slot unchanged after save (test on the full-replace payload)
- [ ] „Ez változik" names the gap to that morning's gym and a same-day clash (pure builder tests)
- [ ] a failed save keeps the sheet open with the entered values and a retry; nothing lost
- [ ] Dynamic Type / VoiceOver / 375 pt as S3; `xcodebuild test` green; merged

### S5 — iOS: Napló and Test (parallel with S4) · `mezo-r36n9.205`
**What:** Napló hero (4 weeks, avg effort, shoulder avg, RPE line, one sentence) + session cards with the Watch line;
tap → Log sheet in edit mode (correct / delete). Test: Együtt · Kondi · Röpi over `NKBodyMap(views: .both)` from
`body`, A vállad · 6 hét with the line at 7, Pihenő a kettő között strips from `gaps`, Amire figyelek with the shared
„miért?" sheet, ask row.
**Owns:** `ios/Boop/Sport/{Naplo,Test}/**`, `ios/BoopKit/Sources/BoopCore/Sport/{SportJournal*,SportBody*}.swift`, tests.
**Kész, ha:**
- [ ] edit and delete round-trip through the server and the cache (test); a deleted session leaves the week count right
- [ ] Együtt never exceeds full heat (capped); a kind with no muscle table shows no heat and says so
- [ ] charts have VoiceOver summaries; Dynamic Type / 375 pt / reduced motion as S3; `xcodebuild test` green; merged

### S6 — App-wide: two layers everywhere, ship · `mezo-r36n9.206`
**What:** the ring orb (if S3 could not) filling with week done/planned; the Ma wall `sport` `WallSource` (tonight's
game, „az órád felvette — egészítsd ki", skipped); the day page reads `BoopDay.sport` as its own card; the Edzés room's
„Ma sport van: röpi 18:00" with a door to Sport (coordinated with `.197`, see Sequencing); the capture sheet's quick
sport entry opens the same Log sheet; docs + handbook + release; install on the phone and live walk-through.
**Owns:** `ios/Boop/Nap/MaWall.swift`, `ios/BoopKit/Sources/BoopCore/Morning/WallSources.swift` (sport source),
`ios/Boop/Capture/CaptureSheet.swift` (sport entry), `Kezdolap/**` (orb only), the Edzés line per Sequencing,
`docs/features/boop-ios.md`, `docs/boop-handbook/**` Sport page, `_kiadasok.json`, `_funkciok.json`.
**Kész, ha:**
- [ ] ring: Sport right after Edzés, no name collision on iPhone 17 Pro Max and the smallest iPhone
- [ ] a day with gym + volleyball shows two separate items on the day page and the wall; logging one leaves the other open
- [ ] the Edzés room never says „pihenőnap" on a sport-only day
- [ ] installed on the phone; owner's first Watch volleyball pre-fills the log (or noted as pending until he plays —
      prod `wearable_workout` has no volleyball yet)
- [ ] `boop-ios.md`, handbook Sport page, feature index row, milestone entry, boop skill §6 row; Notion sync `check` 0
- [ ] `mezo-wyb54` closed (absorbed); `mezo-r36n9.188` closed

## Review focus (final fresh-context review, S6)
1. A logged sport never marks the gym done and vice versa — on the server, the wall, the ring and Edzés.
2. Full-replace schedule PUT from the phone never drops slots it did not show (stale cache → server wins + reload).
3. Week boundary in the owner's zone on Sunday night and Monday morning.
4. Pre-fill matching: two Health workouts on one day, a workout that started before midnight.
5. Offline log replay is idempotent (`clientRef`).
