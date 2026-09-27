# S6c · Rólad rövid elosztó — plan (mezo-2dfy2)

Spec: `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` §"S6c addendum".
Prototype (owner OK 2026-09-27): `uveg-mezo-teljes.html` `#rolad` (S6c layer,
`src/uveg-mezo-teljes-s6.js`). FE-only; no contract change, no backend.

## Shape

`/mezo/rolad` (BoopAboutPage) becomes: quote → Döntésre vár (max 2 open cards, rest
behind a "Még N javaslat" fold) → kirakat (the hub's four section tiles, reusing
`HubTiles` + `hubCounts`, dooring to `/mezo/knowledge?view=*`) → Tovább doors (dimenziók
· **Életesemények** new subpage · Így beszélj velem · Kapcsolatok) → the "A te kezedben"
note as a quiet footnote. `RoladFacts` is deleted (duplicates the hub's Rólad section).

## Tasks

1. **RoladInbox fold** — new `collapsible` prop (Rólad passes it): collapsed shows the
   first 2 OPEN cards (plus anything settled during this mount, so a decision's
   afterlife stays visible in place); a `Még N javaslat` glass row toggles expansion
   ("Mutass kevesebbet" when open). Fold strings in `ROLAD_COPY`. TDD in
   `RoladInbox.test.tsx` / page test.
2. **Életesemények subpage** — new route `mezo/rolad/eletesemenyek` + small page
   (eyebrow RÓLAD / h1 Életesemények, lede, `RoladTimeline`, footnote). Door on Rólad
   (t-sun, gold). Router entry beside `mezo/rolad`.
3. **BoopAboutPage rework** — drop `RoladFacts` + `RoladTimeline` + the glass note; add
   the kirakat: section head "Amit a csapat megjegyzett" (hint: A TUDÁSTÁRBAN) +
   `HubTiles` wrapped in a `.tud9` scope div (its grid CSS lives under `.tud9`),
   counts via `hubCounts` from `useRoladInbox`'s knowledge state + `usePeople` +
   `useKnowledgeObservations` + `useEffectSubjects` (same wiring as
   KnowledgeListPage); `onOpen` → `/mezo/knowledge?view=<key>`. Footnote = `ROLAD_COPY.note`
   as quiet text.
4. **Cleanup** — delete `RoladFacts.tsx` + test, prune `topRoladFacts` from
   `roladCopy.ts` (+ its test cases); fix the stale RoladFacts comment reference in
   `RoladTimeline.tsx`.
5. **Tests/gates** — update `BoopAboutPage.test.tsx` (ranking, tiles, fold, door),
   `RoladInbox.test.tsx`; FE tests both modes `CI=true`, `pnpm build`; runtime verify
   (dark, 320px, reduced motion) on `/mezo/rolad`, the subpage, and a tile-door into
   the hub; codemap regen (files added/removed); `docs/features/insights.md` refresh.

## Traps

- `.th-tiles` CSS is scoped under `.tud9` — wrap, don't fork a second grid (üveg rule:
  never a second glass recipe). Watch double side-padding inside `.kr9-rflow` at 320px.
- Never an invented zero: HubTiles' off/error/loading dash states must keep working on
  Rólad (companion off → Tények tile dashes; graph off → unaffected sections keep counts).
- Mock mode: user-message ids absent (lesson 16) — irrelevant here, but candidate seeds
  drive the fold counts in tests; use `candidateSeed`/`lifeEventCandidateSeed` lengths.
- `useKnowledge` is already mounted via `useRoladInbox` — reuse its state for the facts
  Loadable instead of a second hook call with different flags.
