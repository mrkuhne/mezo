# Heti felfedezések — one trace per discovery, grouped in drawers (mezo-p87ok)

Spec + plan in one doc (small change, CLAUDE.md §Frontend change workflow "Scaling").
Prototype: `docs/design_2.0/prototypes/elo/en.html` routes `#het` (the card) and
`#felfedezesek` (the page), published at https://claude.ai/artifact/TpZ8YTcX6rBLvLhpkfAK8M.

## Problem

1. **The hub card breaks.** `WeekHubPage` renders one `flex:none` dot per discovery
   (`.wkh-page .wkh-dots`). With 72 discoveries in production (week 2026-09-21), the dot row
   takes the full width and squeezes `.wkh-discparts` to one word per line.
2. **The page is a flat wall.** `/me/week/felfedezesek` renders all 72 as tiles.
3. **The count is inflated ~2×.** The digest emits one row per `pattern_event`, not per
   pattern. A pair confirmed and promoted in the same week appears twice, and the promotion's
   `knowledge_fact` (source=pattern) appears a third time in `newFacts`. Production:
   41 pattern events over **23 distinct pairs**, and 20 of the 26 facts are pattern-promotion facts.
   The duplicates also produce duplicate React keys (`p-${pairKey}`).

## Owner decisions (2026-09-28)

- Option 1 of the layout: the rare traces on top, in full, and the two bulk types in drawers.
- Option 2 of the count: fold. One pattern is one trace, and a promotion's fact is not
  counted again. Week 2026-09-21 becomes ≈34 (23 patterns + 6 facts + 3 life events + memoir + 1 prediction).
- Drawer order (proposed in the hand-off and not objected to): patterns go
  előléptetve → erősödött → megerősítve, newest first within a kind. Facts go newest first.

## Design

### Backend: fold in `WeeklyReviewDigestService` (no contract change)

- **Patterns:** group the week's events by pattern. Keep one ref per pattern, carrying the
  most significant event kind of the week (promoted > reinforced > confirmed). Order the
  refs by that rank, then by the latest `occurredAt` descending. Keep the existing
  forgotten/deleted/orphan drops.
- **Facts:** drop every fact whose id is the `promotedFactId` of a pattern in the folded
  list, because that pattern row already carries the discovery. Order the rest by `createdAt` descending.
- `WeeklyReviewWeekWindow` and the generator's `gather` are unchanged: the LLM payload keeps
  its raw events. The fold is the digest's presentation contract.
- The wire shape is unchanged (`patterns[]`, `newFacts[]`, …). Only the cardinality and the
  order change. Update the `patterns` description in `proactive.yml` only if it claims per-event
  semantics (it says "the pattern_event kind", which still holds per ref).

### Frontend

- **Hub card** (`WeekHubPage` + `weekHub.ts#discoverySummary`): replace the `dots` with
  `segments: {kind, count}[]`. The card shows the title ("N új nyom a memóriában"), a thin
  proportion bar (flex-grow = count, min width 7px, so a 1 never vanishes) and a wrapping
  legend (`● 23 minta · ● 6 új tudás · ● 3 életesemény · ● 1 emlékkönyv · ● 1 előrejelzés`).
  The quiet week keeps its current copy.
- **Page** (`WeekDiscoveries`):
  - The eyebrow „A HÉT KIEMELT NYOMAI” sits over a mosaic of the rare kinds: life events and memoir as half tiles, predictions wide.
  - The eyebrow „AMIT A MEMÓRIA TANULT” sits over two glass drawers, *Minták* and *Új tudás*. Each has an icon, a title and a big count, and Minták also shows a sub-line with its breakdown (`14 előléptetve · 4 erősödött · 5 megerősítve`). The rows are flat, not glass, and each keeps its link and chip.
  - Each drawer shows the first 3 rows. A `Mind a N minta ›` / `Mind a N új tudás ›` button expands it in place (`aria-expanded`), and `Kevesebb ‹` collapses it. The toggle appears only when N > 3.
  - The stagger is capped so no element rises later than about 400 ms.
- The lead copy drops „Koppints, és a Mezo tabon nyílnak ki.” to match the prototype.
- The hero, loading, error and quiet week are unchanged.
- Keys: patterns by `pairKey` (unique after the fold), facts by id.
- `weekHighlight.ts` still resolves pairKeys by title against `digest.patterns`, so no change is needed there.

## Kész, ha…

- [ ] `#het` card matches the prototype: bar + legend, no word-per-line break at 34 or 72 items, quiet week unchanged.
- [ ] `#felfedezesek` matches: rare tiles on top, two drawers, first 3 rows, expand/collapse works, chips/links as before.
- [ ] Icons are all from the sprite (t-pattern, t-book, t-pin, t-scroll, t-orb, and chip icons), with no new icons.
- [ ] The empty, loading and error states are unchanged, the page works at 320px, and reduced motion works.
- [ ] Parity: every link target (pattern page, `?fact=` deep link, Rólad `?start=`, memoir, predictions) and every status chip still present.
- [ ] Backend: an IT proves one ref per pattern with the highest kind, the rank order, the promotion fact dropped, and a non-pattern fact kept.
- [ ] Gates: FE tests (mock and `VITE_USE_MOCK=false`, `CI=true`), `pnpm build`, focused backend ITs, `gen-codemap`, and `lint-docs` with 0 errors.
- [ ] Docs: `docs/features/me.md` (Heti §2/§4) and `docs/features/proactive.md` (digest semantics) are updated, and the feature index row is still true.
- [ ] Shipped: merged to main, deploy green, the live week hub shows ≈34 for week 2026-09-21, and the production card is not broken.
- [ ] The living prototype is in sync and the `elo/README.md` row is dated.

## Plan

1. **Backend fold (TDD):** extend `WeeklyReviewControllerIT` (or a new digest IT) with a week
   that has a confirmed and a promoted event on one pair, a reinforced event on another, a
   promotion fact and a chat fact. Assert 2 pattern refs (promoted first), 1 fact, and the
   order. Implement the fold in `WeeklyReviewDigestService`, and run the focused ITs.
2. **Frontend logic (TDD):** update `weekHub.ts#discoverySummary` (from dots to segments) and
   `weekHub.test.ts`. Add a pure `logic/discoveryDrawers.ts` (rare vs bulk split, pattern
   breakdown line, `previewRows`) with unit tests.
3. **Components:**
   - Hub card: markup and CSS under `.wkh-page`, with tests updated (`WeekHubPage.test.tsx` strings).
   - `WeekDiscoveries` restructure: markup and CSS under `.wkf-page` (the `wkd-` prefix is shared with WeekDaysPage, so scope it). Update `WeekDiscoveriesPage.test.tsx`, and add an MSW override with more than 3 patterns to test expand/collapse.
   - `prototypeCssStructure.test.ts`: keep the glass selectors pinned, and make sure there is no glass inside glass (the drawer rows are flat).
4. **Docs + codemap + lint.**
5. **Merge:** local `--no-ff` to main, push, watch deploy, and verify live and in the DB.

## Prior art

- **Adopted:**
  - Apple Health's Highlights/Trends: changed items up front, the steady ones folded behind "Show All". https://www.myhealthyapple.com/how-to-use-health-trends-in-ios15/
  - WHOOP's and Oura's fixed-order weekly sections: each report has a fixed section order, and neither lists every data point. https://www.whoop.com/gb/en/thelocker/new-weekly-performance-assessment/, https://support.ouraring.com/hc/en-us/articles/360046061373-Oura-Reports
  - Datawrapper's warning that small segments vanish in a stacked bar, so the bar keeps a minimum segment width and always has a numeric legend. https://www.datawrapper.de/blog/chart-types-guide
- **Rejected for now:** Exist.io-style strength/confidence ranking (https://exist.io/blog/new-ios-correlations/). The wire carries no strength, so it would need a contract change. The event-kind rank gives a meaningful order without one.

## Codebase terrain

- **Backend:** `feature/proactive/service/WeeklyReviewDigestService.java` (the fold) and
  `WeeklyReviewWeekWindow.java` (unchanged). `PatternEventRepository`'s finder has no ORDER BY,
  so the fold must sort explicitly. `PatternEntity.promotedFactId` is the join to the fact.
- **Frontend:**
  - `features/me/pages/WeekHubPage.tsx:283-305`, `features/me/logic/weekHub.ts:111-139`
  - `features/me/components/WeekDiscoveries.tsx`, `features/me/pages/WeekDiscoveriesPage.tsx`
  - `styles/prototype.css` (`.wkh-page` around 22602, `.wkf-page .wkd-*` around 22845)
- **Precedents for show-more:** `SkillBandCard.tsx` ("Mind a N ▸ / Kevesebb") and `RoladInbox.tsx`.
- **Traps:**
  - The hub tile is a `<button>`, so no nested controls can go inside it.
  - The `wkd-` class prefix collides with WeekDaysPage.
  - The mock digest has only 5 items, so the drawer test needs an MSW override.
  - No `tests/layout` spec covers `/me/week/*`.
