# Boop Sport S5 — Napló and Test tabs (`mezo-r36n9.205`)

Step S5 of [the slice map](2026-11-27-boop-sport-slice-map.md) §S5; spec
[`2026-11-27-boop-sport-design.md`](../specs/2026-11-27-boop-sport-design.md) §5.4/§5.5. Spike and slice map are
owner-approved; no new visual round.

## Found at the start

The server had **no correct / delete for a logged sport session** (only `listSportSessions` + `logSportSession`),
yet spec §5.8 lists "sport log + edit/delete" as coming over and S5's Kész ha needs the round-trip. Nobody else owns
the training server now (S1/S2 done), so S5 adds the two operations (additive contract, invisible to the owner):

- `PUT /api/train/sport-sessions/{id}` (`updateSportSession`, body = `SportSessionCreateRequest`; absent
  date/time/sport keep the stored value; kcal = override verbatim, else the estimate again; no "logged" trigger).
- `DELETE /api/train/sport-sessions/{id}` (`deleteSportSession`, soft delete, 404 when not owned / gone).

## Build

1. Backend: contract in `train.yml` → `npm run generate:api`; `SportService.update/deleteSportSession`,
   repository finder, controller; `SportSessionEditContractIT` (round-trip, week count follows the delete, 404, 401).
2. BoopCore `Sport/SportJournal*.swift`: wire (`SportSessionRecord`), client ops (list 12 weeks, update, delete),
   `SportJournalStore` (cache first `sport/journal`, edit/delete update the cache and re-read the week), pure hero
   builder (alkalom · 4 hét, átlag megterhelés, váll átlag, RPE line, shoulder sentence) and card builder.
3. BoopCore `Sport/SportBody*.swift`: wire for `body` / `shoulder` / `gaps`, `SportBodyStore` (cache first,
   `sport/body|shoulder|gaps`), pure builders: heat per mode (Együtt capped at 1), mode line, unmapped-kind note,
   shoulder bars with the 7 line, rest strips, VoiceOver summaries.
4. iOS `Sport/Naplo/SportNaplo.swift`, `Sport/Test/SportTest.swift` (+ the „miért?" sheet), wired into
   `SportRoom` (heads, tabs, sheets); `SportLogSheet` gains an edit mode (correct + „Alkalom törlése").
5. Preview transport answers the new ops; DEBUG `-sportTab Napló|Test`, `-sportMap`, `-sportJournalEmpty`.

Spike lines that would claim what the app does not do are dropped: the card's „az órádról · átlagpulzus" line (a
logged session carries no watch link — kcal reads „becslés" or the own number); hints only from the server's
detector.

## Kész, ha…

- [ ] edit and delete round-trip through the server and the cache (test); a deleted session leaves the week count right
- [ ] Együtt never exceeds full heat (capped); a kind with no muscle table shows no heat and says so
- [ ] charts have VoiceOver summaries; largest Dynamic Type, 375 pt (iPhone SE), reduced motion; empty / loading /
      error / offline states shown in the simulator
- [ ] backend focused ITs + `ArchitectureTest`; `xcodebuild test` BoopKit + Boop green; codemap; lint-docs PASS
- [ ] `boop-ios.md` milestone, handbook Sport page, release row; merged to main and pushed
