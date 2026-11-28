# Boop Sport S6 — app-wide: two layers everywhere, ship (`mezo-r36n9.206`)

Step S6 of `2026-11-27-boop-sport-slice-map.md`; spec `../specs/2026-11-27-boop-sport-design.md` §5.7. No owner gate:
everything here follows the approved spec + spike (the ring orb already shipped in S3).

**Goal:** the gym and the sport are two separate things everywhere outside the Sport room too — the day page, the Ma
wall, the Edzés room and the „+" sheet — then docs, Notion and the phone.

## Tasks

1. **BoopCore `Brief.Day.sport`** — map the server's `BoopDay.sport` (`BoopSport`: sport, time, minutes, done,
   doneMinutes, avgHr; already in the generated client) into `Brief.Sport`; default `[]`.
   Test: decoding a brief with gym + volleyball gives both, independent `done`.
2. **Day page** — `DayPlan.rows` gets one row per sport (`sport-<i>`, glyph `ball-sun`, title = kind name, sub =
   length), `DayPlan.goals` one goal per sport (met only by its own `done`); `PathBuilder.mozgas` one station per sport
   (`sport-<i>`, opens). `MaiPath` draws a small card for `sport-*` with a door to the Sport room.
   Test: gym + volleyball → two rows / two stations / two goals; a done volleyball leaves the gym undone and vice versa.
3. **Ma wall `sport` source** — `sportWallCandidates(_ overview: SportOverview?, now:)` from `tonight`:
   BEFORE later today → `.improves` (0.9 within two hours, else 0.5) „Ma *röpi* 18:00"; RECORDED → `.improves` 0.95
   „Az órád felvette a *röpit* — egészítsd ki"; DONE → `.happened` „*Röpi* megvolt"; SKIPPED → `.happened`
   „*Röpi* ma kimarad". `MaWall` registers it from `SportStore.week` (loads cache-first), a tap opens the Sport room,
   `hue(.sport)`. Tests per moment + no overview → nothing.
4. **Edzés room** — a day without a gym session but with sport (brief `day.sport`): the Ma hero reads „Ma sport van"
   + „Röpi 18:00" and a door „Sport megnyitása"; the start toast never says „pihenőnap" on such a day. Pure helper
   `edzesSportDayLine(_ sport: [Brief.Sport]) -> String?` tested.
5. **„+" sheet Sport** — `ShellView` opens `SportLogSheet` (Watch pre-fill from `SportStore.week.tonight`) instead of
   the old quick `SportSheet`; the „Mikor" row stays for a log without a Watch workout (static `dated(_:day:moment:)`,
   the old test moved onto it). The old `SportSheet`/`QuickSport` go.
6. **Gates** — `xcodebuild test` BoopKit + Boop; simulator: ring on 17 Pro Max + smallest iPhone, day page + wall with
   gym + volleyball, Edzés sport-only day, + sheet Sport, largest Dynamic Type, 375 pt; codemap; lint-docs.
7. **Ship** — docs (`boop-ios.md` milestone, handbook `07-edzes/10-sport-futas.md`, feature index row, boop skill §6),
   `_jegyek`/`_kiadasok`/`_funkciok`, merge `--no-ff`, push, install on the phone, Notion sync once (`check` 0),
   close `mezo-wyb54` (absorbed by S4 Hét) and `mezo-r36n9.188`.

## Kész, ha…
See `bd show mezo-r36n9.206` (acceptance) — mirrored from the slice map §S6.
