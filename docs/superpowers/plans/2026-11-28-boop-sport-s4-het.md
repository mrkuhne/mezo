# Boop Sport S4 — Hét and the weekly rhythm (build plan)

> bd `mezo-r36n9.204` · slice map `2026-11-27-boop-sport-slice-map.md` §S4 · spec `2026-11-27-boop-sport-design.md` §5.3
> · look + copy: `origin/spike/boop-sport:ios/Boop/SportDemo/SportDemoRoom.swift` (`SportHet`, `SportBeosztas`,
> `SportSlotSheet`, `FlowChips`; never merged). Owner OK: the slice map (2026-11-27) + „mehet a 4. lépés" (2026-11-28).

**Goal:** the Sport area's Hét tab replaces its not-live-yet block: the week's totals and the two-lane chart from the
overview, the six-week load bars (`GET /api/train/sport/load`), the recurring slots with the slot editor (full-replace
`PUT /api/train/sport-schedule`), the one-off events (`GET/POST/DELETE /api/train/sport-events`) and the eleven kinds.

## Architecture

- `BoopCore/Sport/SportScheduleWire.swift` — lenient `SportSlot`, `SportSlotInput`, `SportEvent`, `SportEventDraft`,
  `SportLoad`/`SportLoadWeek`.
- `BoopCore/Sport/SportScheduleClient.swift` — `extension SportClient`: `schedule()`, `replaceSchedule(_:)`,
  `events(from:)`, `createEvent(_:)`, `deleteEvent(id:)`, `load(weeks:)`.
- `BoopCore/Sport/SportScheduleLogic.swift` — pure builders: the full-replace payload (`sportScheduleSaving`,
  `sportScheduleRemoving`), „Ez változik" (`sportSlotEffect`: the gap to that weekday's gym from the overview, the server's
  gap rule; a same-day clash), the Hét head, the two-lane days, the load bars, slot/event row lines.
- `BoopCore/Sport/SportScheduleStore.swift` — cache-first slots / events / load (`sport/schedule`, `sport/events`,
  `sport/load`); writes call back into `SportStore.load(force:)` so the week re-reads. `SportStore` carries it as
  `schedule` (one stored line).
- `ios/Boop/Sport/Het/{SportHet,SportSlotSheet,SportEventSheet}.swift` — the views; `SportRoom` swaps the Hét block and
  presents the two sheets at page level; `SportPreviewTransport` answers the six new operations.

## Honest-copy deviations from the spike (the server does not do these)

- „A jövő héttől…" → „Mostantól…": a saved rhythm applies to the rest of this week too.
- „…és a másnapi kondit ehhez igazítom" dropped; „Aznap és előtte nem teszek nehéz lábnapot" replaced by what is true
  (the event joins the week's sport lane and the gap hints).

## Tasks (TDD)

1. Wire + client tests (decode, the PUT body is the whole list, delete 404 = gone) → code.
2. Logic tests: editing one slot keeps every other slot byte-identical in the payload; new slot appended; remove;
   „Ez változik" names the gap to that morning's gym (07:00 + 70 min → 18:00 = „9 ó 50 p") and a same-day clash; no
   gym → the free-day line; Hét head; load bars → code.
3. Store tests: cache first; a failed save throws and keeps the list; a save re-reads the week → code.
4. Views + room wiring + preview transport; simulator walk-through.

## Kész, ha…

- [ ] editing one slot keeps every other slot unchanged after save (test on the full-replace payload)
- [ ] „Ez változik" names the gap to that morning's gym and a same-day clash (pure builder tests)
- [ ] a failed save keeps the sheet open with the entered values and a retry; nothing lost
- [ ] Hét matches the spike: totals, two lanes (filled = done, outlined = planned, today coral), Terhelés · 6 hét,
      A heti rend, Rendszeres alkalmak, Egyszeri események, the eleven kinds; empty / loading / error / offline
- [ ] largest Dynamic Type: chips wrap whole words, day tiles and steppers stay usable; VoiceOver labels on the chart,
      bars, rows, chips (selected trait); reduced motion still; 375 pt right
- [ ] `xcodebuild test` BoopKit + Boop green; codemap; lint-docs 0/0; merged
