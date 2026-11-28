# Boop Sport S3 — the Sport area, the Ma tab, Log + Skip sheets (`mezo-r36n9.203`)

Step S3 of [the slice map](2026-11-27-boop-sport-slice-map.md) (approved — no extra owner OK). Spec
[`2026-11-27-boop-sport-design.md`](../specs/2026-11-27-boop-sport-design.md) §5.1, §5.2, §5.6, §5.9. Look and copy:
`origin/spike/boop-sport:ios/Boop/SportDemo/SportDemoRoom.swift` (never merged; strings verbatim).

## Facts found at the start
- `.196` slice 1 (the ten-orb ring) is on main → S3 places the Sport orb right after Edzés (11 orbs). `.196` slice 2
  (`feat/boop-evad-szoba-2`) still touches `KezdolapView`/`NapView`/`RootView` — my edits there are one-line additions.
- `OutboxKind.sportSession` + `RitmusEnvironment.captureSport` already exist (quick capture). The server's
  `POST /api/train/sport-sessions` has **no `clientRef`**: the outbox sends an item once and drops it on any 2xx, but a
  lost 2xx reply can duplicate → follow-up bd issue (server idempotency), not S3.
- The watch kcal goes as the existing `kcalOverride` (added to `SportSessionPayload`, optional, backward compatible).
- Main briefly lost S2 (stale-tree commit `4565fe537`); `fix/restore-sport-s2` restores it. Merge S3 only once the
  contract is back on main.

## Tasks (TDD for logic)
1. **BoopCore/Sport/SportWire** — lenient Codable of `SportOverviewResponse` + skip response; `SportKind` (11 server
   kinds, full + short Hungarian names). Test: decode the contract example, unknown enums survive.
2. **SportClient** over `RawJSONClient`: `overview(week:)` (`getSportOverview`), `skip` (`upsertPlannedSkip`, kind
   SPORT, legacy dayOfWeek 0 = Hétfő), `undoSkip` (`undoPlannedSkip`). Tests with `StubTransport`: paths, bodies.
3. **SportModel** (`SportStore`, @Observable): cache-first (`ServerCache` `sport/overview`, shows instantly), fresh read
   behind it, offline keeps the cached week with its age, error only with nothing on screen; optimistic log (queued
   payload → tonight DONE at once) and skip/undo; last effort remembered. Pure copy builders (`SportLogic`): hero per
   moment, gym-only „Ma nincs sport" + next one, day strip, week cards, hints wording, ring display.
   Tests: each moment's copy, sport-only/gym-only days, cache-first, offline, optimistic log, ring count.
4. **Outbox**: `kcalOverride` through `TrainClient.sendSport`; test that a queued sport log is sent exactly once.
5. **Design**: `Hue.sport` + `ball-sun` glyph (+ „Beosztás" bar glyph not needed — tabs are Ma·Hét·Napló·Test).
6. **App**: `ios/Boop/Sport/{SportRoom,SportMa,SportSheets,SportPreview}.swift`; Area/ring/routing; `-previewHome sport`,
   `-previewSport YES`, `-sportMoment before|recorded|done|skipped|nosport|sportonly`, `-sportState …`, `-sportSheet log|skip`.
7. Gates: `xcodebuild test` BoopKit + Boop, codemap, lint-docs; simulator shots for every *Kész, ha…* item.

## Kész, ha… (from the slice map §S3)
- [ ] the four Ma moments, a sport-only day and a gym-only day („Ma nincs sport" + the next one) match the spike shots
- [ ] empty / loading / error / offline states; cached week shows instantly, fresh data loads behind it
- [ ] a log saved offline appears at once and is sent once on reconnect
- [ ] largest Dynamic Type: chips wrap whole words, effort row two rows of five, hero stacks ring above text; VoiceOver
      labels on the ring, strip and every chip with its selected trait; reduced motion still; 375 pt right
- [ ] `xcodebuild test` BoopKit + Boop green; codemap; lint-docs 0/0; merged
