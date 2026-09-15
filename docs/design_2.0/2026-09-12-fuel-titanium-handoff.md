# Fuel Titanium rebuild — handoff

**Shipped 2026-09-12** · PR [#635](https://github.com/mrkuhne/mezo/pull/635) · driving issue `mezo-jb84`
112 commits, 225 files, +19 628 / −8 262.

This is the "what happened and what to know next" note. The frozen decisions live in
[`2026-09-11-fuel-coverage.md`](2026-09-11-fuel-coverage.md) (manifest, now closed with a delivery
record) and [`../superpowers/specs/2026-09-11-fuel-titanium-design.md`](../superpowers/specs/2026-09-11-fuel-titanium-design.md)
(spec + owner decisions). The per-slice implementation plans are in `../superpowers/plans/2026-09-12-fuel-titanium-*.md`.

---

## What the user sees now

The Fuel domain's four destinations are **Mai · Kiegészítők · Trendek · Konyha**, in that order,
each with its own new clay icon, and every `/fuel*` route renders in the Titanium dark scope.

| Page | What it answers | Key surfaces |
| --- | --- | --- |
| **Mai** | "Hogy állok ma, és naplózzunk villámgyorsan" | energy hero (bowl-in-arc gauge, the *remaining* kcal as the one number, `alap + mozgás − étel` in a glass box), five macro rings, the day's planned blocks each with a budget ring and its eating-window bar, day paging, water, a quiet settings corner |
| **Kiegészítők** | "Mit veszek be ma?" | today's doses grouped by time band with one-tap check-off and undo, Protokoll as its own page, a standalone three-step dose setup |
| **Trendek** | "Jól ment a hetem?" | the week's days with per-day AI scores and the weekday/weekend contrast, week switching with week-over-week deltas, the intake × weight long horizon, pattern rows linking to canonical Mezo insights |
| **Konyha** | "Mentsd el, ami jött" | two capture actions, the Receptműhely as its own poster, Receptek and Kamra behind two doors, recipe detail at meal-detail depth |

Plus two deeper pages reached from Mai: `/fuel/etkezes/:id` (a logged meal's full detail) and
`/fuel/etkezes/:id/ertekeles` (the per-dimension AI score breakdown).

The logger at `/fuel/log/uj` opens on the **camera**, with voice, typing and a time-of-day-ranked
"szokásosak" row one tap away, an honest failure state that offers the other three routes, and —
new — editing and two-step deletion of a logged meal.

---

## Capabilities that existed but were unreachable, now connected

These were the cheapest real wins in the whole rebuild. None needed new backend work.

- **`PUT` / `DELETE /api/meal/{id}`** had no UI caller at all. Editing and two-step delete now use them.
- **`FuelWeekResponse.mealScoreAvg` / `weightAvgKg`** were computed by the backend and silently
  discarded by the frontend mapper (`mealApi.getWeek`). Trendek renders both.
- **Voice logging** is pure wiring: `useVoiceInput`'s transcript feeds the existing AI text-draft arm.
- **The six-dimension day evaluation** (`getDayEvaluation` → `MeWeekDay.score`) already existed and
  now supplies Trendek's per-day score — no new formula.

---

## Bugs found and fixed along the way

| What | Why it mattered |
| --- | --- |
| **The AI draft outcome signal never fired from the full-page logger** (`mezo-qt5q`) | `MealComposer` reported it from `logMeal`'s per-call `onSuccess`, and TanStack binds those callbacks to the observer — dropped when the caller unmounts first. `/fuel/log/uj` navigates away the instant it saves, and the discard guard had already claimed the draft id, so an AI-drafted meal saved there reported **neither** accepted/edited **nor** discarded. Pre-existing; surfaced only because S5 pins the invisible rows on the rebuilt path. Fixed with `logMealAsync`, which resolves from the mutation itself. |
| The hero said "ma" on a past day | Day paging made the hero reachable for any of the last seven days; the copy and the screen-reader sentence stayed hardcoded to today. |
| Konyha's door counters rendered the count-up's raw fractional value | Live, the Receptek door read `0.58258258124…`. The only unrounded numeral in the rebuild. |
| Two macro icons and two tab icons missed their brief | At 26–27 px the protein read as a pink blob, the fat as a dark olive (indistinguishable from the green fibre leaf), the pot as a bucket and the plate's cutlery merged into its rim. Redrawn after looking at them rendered, not just at the code. |
| A timezone-fragile test and nine stale layout tests | Both CI-only failures. See "Traps" below. |

---

## Traps for the next session

**The vitest suite is not the whole gate.** `pnpm test` does not run the Playwright layout suite —
that is `pnpm test:layout`, and it is the one that catches "this test still drives a surface that no
longer exists". Nine of them did. Run it before pushing a UI slice.

**CI runs in UTC, this machine does not.** A fixture with a fixed `+02:00` offset plus a hardcoded
wall-clock expectation passes locally and fails in CI by exactly two hours. Derive expected times
from the fixture with the production helper (`hhmmFromLoggedAt`), never hardcode them. `TZ=UTC
CI=true VITE_USE_MOCK=true pnpm test` reproduces CI locally.

**The count-up freezes in a hidden tab.** Every Fuel numeral animates via `useFuelCountUp`
(exported from `FuelMacroRings.tsx`). `requestAnimationFrame` is throttled when the document is
hidden, so a screenshot taken against a hidden preview pane shows a partial value — this looked like
three separate bugs during verification and was none of them. It resumes on visibility. Use
`useFuelCountUp`, never `useCountUp`, which animates in jsdom and breaks synchronous assertions.

**One CSS block per slice, one prefix per page.** `prototype.css` is ~13 500 lines and the main
conflict surface. The Fuel blocks are fenced: `fuel-mai titanium` (`fmx-`), `fuel-stack titanium`
(`fsx-`), `fuel-trendek titanium` (`ftx-`), `fuel-konyha titanium` (`fkx-`), all before the
`titan-dark scope` fence. `prototypeCssStructure.test.ts` parses the whole file.

**The clay sprite is an asset contract.** New art lands in `docs/design_2.0/assets/clay-icons.svg`
FIRST, then is copied verbatim to `frontend/src/shared/ui/clay/clay-icons.svg`; the two must `diff`
clean. The gradient palette is CLOSED (`ig-titanium`, `ig-blue`, `ig-gold`, `ig-purple`, `ig-lime`,
`ig-rose`, plus the `ig-shadow` filter) — do not add one. The set is now **65** `i-*` symbols and
`Clay.test.tsx` pins the count in three places (test name, assertion, header comment).

**`?w=` means two different things.** On the logger it is the eating-window key, produced only by
`tileKey()` — never hand-built. On Trendek it is the week selector. Both carry comments saying so.

**Two shared helpers now have exactly one home** — do not fork them: `logic/backfillWindow.ts` (the
7-day backfill rule, which had three copies) and `logic/scoreArithmetic.ts` (the score weight/
contribution maths, lifted out of `ScoreBreakdownBody` so the sheet and the score page cannot drift).

---

## Owner decisions that must not be "fixed"

Each of these is an explicit DROP with a test asserting the absence, so a later session cannot
mistake it for a gap: **no barcode / OpenFoodFacts UI** (the endpoint stays contracted and
UI-less), **no imports feed list** (per-item provenance lives on the pantry item's source card),
**no shopping list**, **no stock/expiry UI** (`SHOW_PANTRY_STOCK` stays `false`, dormant surfaces
untouched), **no "mit főzzünk itthon lévőből"**, **no recipe URL import** (the pantry's URL import is
unrelated and stays).

Also untouched by decision: **medication is production-empty** (`mezo-lwmq`) — its empty state lives
and `/fuel/gyogyszer` still resolves; the **protocol's lazy backfill write-on-read** stays
transactional; **`ProtocolViewResponse.history[]`** stays mapped with no UI.

---

## Retired routes — all redirect, none 404

`/fuel/log` → `/fuel` · `/fuel/plan` → `/fuel/trendek` · `/fuel/naplo` → `/fuel/trendek` ·
`/fuel/stack/today` → `/fuel/stack` · `/fuel/stack/meals` and the four `manage/*` pages →
`/fuel/stack/protocol`. The day parameter survives the redirect, and
`router.fuelRetiredRedirects.test.tsx` pins every row plus the surviving siblings
(`/fuel/stack/manage/add`, `/fuel/log/uj`). The Kalauz was re-anchored and a lint now forbids a
tutorial entry pointing at a retired path.

---

## Open follow-ups

| Issue | What it is | Why it was not done here |
| --- | --- | --- |
| `mezo-rm6ps` **(P1)** | The pantry import endpoint resolves to `void`, so the guided dose setup cannot bind a brand-new product in one pass — the advice appears, but the product has to reach the Kamra first. This is exactly the case the owner described ("veszek egy kiegészítőt…"). | Needs the endpoint to return the created id: contract + backend change. |
| `mezo-0dws` (P2) | Editing a meal silently drops its stored provenance, because `provenance` is write-only (`MealRequest` has it, `MealResponse` does not) so the frontend cannot round-trip it. Low harm — it feeds AI-quality analytics, never the UI — but it is a new way to lose data. | Contract + backend change. |
| `mezo-nmzh` (P2) | The supplement dose advisor's backend. The frontend heuristic (`logic/doseAdvice.ts`) shipped with S2. | Its own feature slice. |
| `mezo-vj61` (P2) | Micronutrients end-to-end: store vitamins and minerals for pantry items, recipe lines and meal snapshots, extracted by every AI flow. Until then the Mikrotápanyagok sections show the four facts that genuinely exist (rost, cukor, só, telített zsír) and `—` for the rest. | Backend + AI extraction slice; deliberately deferred at prototype approval (manifest row F1). |

**If you pick up `mezo-rm6ps` and `mezo-nmzh`, do them together** — the dose advisor's backend is
where the import-id change belongs.

---

## House rules this rebuild leaned on hardest

- **Honest-null over fabricated zeros.** An unlogged day is excluded from every average and drawn as
  "nincs adat", never a zero bar. A missing weight sample is a real break in the horizon line, never
  interpolated. A dose the reference table does not know gets no number at all.
- **Adherence-neutral framing.** Going over budget is never coloured or worded as failure; the page
  says "így alakult". Trendek asserts that `elrontott|túlléptél|hiba|rossz|bukta|kudarc` appear
  nowhere on it.
- **Verify by looking, not only by testing.** Every slice was checked in the running app. Three of
  the bugs above — the fractional door counters, the "ma" on a past day, the four weak icons — were
  invisible to a green test suite.
