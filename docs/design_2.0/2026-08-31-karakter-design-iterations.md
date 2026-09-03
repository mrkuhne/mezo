# Karakter-tab design iteration — round 1 (2026-08-31)

Daniel reviewed the first-ship `karakter-tab` prototype (published artifact) and gave four
directions for the next pass. This file records **what changed, why, and what it means for
implementation** — `prototypes/src/karakter-head.html` + `prototypes/src/karakter-body.html`
(assembled into `prototypes/karakter-tab.html`) are the visual truth, this is the rationale.
Read together with [`docs/features/character.md`](../features/character.md) (backend ground
truth) and `prototypes/README.md` (current final state).

## 1. Hub compaction — hero + a 4-tile mosaic, not an 8-tile one

Daniel: *"túl sok a scroll a hubon."* The first ship put the hero, all 8 dimension tiles (7
CORE + 1 CHAPTER), a 3-row feed card, and the Csapat/Konzílium tiles on one scrolling panel —
roughly 1.1 screens of scroll before reaching the bottom.

**Decision: the 8 dimension tiles and the feed card each move behind one hub tile, on their
own page.** The hub itself is now hero + a compact 2×2 mosaic — **Dimenziók · Feed · Csapat ·
Konzílium** — sized to fit in ~one screen (panel scroll height 500px vs. 453px visible in the
phone frame, effectively one screen). Each new hub tile still earns its place with one live
datum per the tile-anatomy rule (§10 of the handoff), not just a label:

- **Dimenziók tile** — the live datum is the CORE-average maturity % plus the dimension count
  (`58% átlag érettség · 7 + 1 dimenzió`), computed from the same `DIMS` array the hero ring
  reads (`CORE_AVG` in `karakter-body.html`) — no duplicated number.
- **Feed tile** — the live datum is a one-line preview of the newest observation plus an
  "N új e héten" count and a pulsing dot; tapping opens the richer Feed page (§2).
- **Csapat / Konzílium tiles** — unchanged from the first ship (9-avatar cluster · "9
  profilozó"; latest session date · pulsing dot for unread).

**New pages**: `page-dims` (the 8 dimension tiles, unchanged content and interaction — tapping
one still opens `page-dim`, the existing generic detail template) and `page-feed` (see next
section). Implementation note: the dims-list tile markup is unchanged from the first ship's hub
mosaic — only its container moved from `#panel` to a nested page's `.page-body`.

## 2. Feed page — richer now that it has its own screen

Since the feed no longer has to compete with 8 dimension tiles for hub space, it can afford to
be denser and prettier. The `page-feed` now groups observations **by day** (`Ma · aug 30`,
`Tegnap · aug 29`, `aug 27`, `aug 24` — 4 day groups, 8 observation rows, 2 konzílium-diff rows
in the mock data, `FEED` array in `karakter-body.html`), each expert observation carries its
persona-tinted orb avatar (§3) and voice, and konzílium-diff rows can now point at either the
Konzílium page or directly at a specific dimension page (`data-dim="recovery"` on the "Portré
frissült: Alvás & regeneráció…" row) — a richer diff type than the hub's single generic line.
Rows animate in with a horizontal `rise-x` stagger (distinct from the vertical `rise` used
elsewhere) so the feed reads as "sliding in" rather than just fading up, per direction 4.

## 3. Every persona gets an orb variant, not initials-on-a-color-disc

Daniel: *"minden karakter kapjon saját ikont, ami a Mezo orb egy variánsa — ugyanaz az alap,
csak domain-színben, egy kis megkülönböztető motívummal."* The first ship used flat colored
discs with text initials (D / Sz / Dr…) for every avatar — hub tiles, feed rows, transcript
avatars, csapat cards, bootstrap cluster.

**Decision: every persona (7 experts + Szkeptikus) now renders as an orb** built from the same
recipe as the Mezo logo orb (`docs/design_2.0/assets/README.md`'s clay recipe: radial gradient
lit from top-left, specular highlight) but tinted to the persona's domain color, with a thin
dashed inner ring (rotated a different amount per persona, `(i*27+12) % 360`) as the "same
species, different individual" distinguishing touch. Mezo itself keeps the original coral
`s-orb` sprite unchanged, per the brief.

**Implementation**: these are **not** hand-authored sprites yet. `karakter-body.html` builds
them at runtime — `buildOrbDefs()` generates one `<radialGradient>` + one `<symbol>` per
persona (ids `og-<key>` / `orb-<key>`) from each persona's single base hex color via a `shade()`
helper (lighten for the gradient's highlight stop, darken for its shadow stop), injects them
into a hidden `<svg>` appended to `<body>`, and every avatar spot now renders
`<use href="#orb-<key>">` instead of initials text. This is a deliberate placeholder —
**if Daniel approves the direction, these graduate into hand-tuned SVGs in
`docs/design_2.0/assets/clay-icons.svg`** (or a new `clay-personas.svg`) following the same
"silhouette-first, one gradient + one highlight, light from top-left" mini-clay rules as every
other sprite, rather than staying a programmatic approximation baked into one prototype's
script.

## 4. Konzílium page — richer outcome header, phase structure, one more voice

Direction 3 asked for the Konzílium page to be prettier, more colorful, and a bit more
detailed:

- **Outcome header** changed from a single plain-text summary line to three **tinted mini-cells**
  (`Elfogadva` sage / `Nyugdíjazva` amber — never red / `Portré átírva` lavender), each reading
  its count from a `TRANSCRIPT.counts` object instead of being baked into a sentence.
- **Phase labels** now separate the transcript into three visually distinct rounds —
  `Javaslatok` → `A Szkeptikus` → `Döntés` — matching the real konzílium choreography
  (`KonziliumProposalRound` → `KonziliumVerdictRound`'s Szkeptikus pass → Mezo/Integrátor
  ruling, per `character.md` §3). A subtle dashed connector line runs behind the proposal
  turns' avatars (`.turnsgroup::before`) to read as one round.
- **One more proposal turn for rhythm**: the Táplálkozó now also proposes (a weekend-protein-gap
  observation), so the "Javaslatok" phase carries four voices instead of two, and the Szkeptikus's
  attack line was extended to address all three data-backed proposals (Doki, Drill, Táplálkozó),
  leaving the Pszichológus's more tentative observation for Mezo's ruling to handle directly.
- The transcript still opens from the session list exactly as before (only the newest, `aug 30.`,
  is wired in this demo), and the honesty note ("this is the real exchange, never re-dramatized")
  is unchanged.

## 5. Motion pass — "élőbb, mozgóbb, színesebb" applied to every page

Direction 4, mirroring the Mezo-tab v2 tile pass (`2026-08-27-mezo-en-design-iterations.md` §1):

- **Entrance choreography now fires on every page**, not just the hub. The dims-list tiles, the
  feed's day cards, the csapat cards, the konzílium list rows, and the konzílium transcript
  turns all carry `rise` (or `rise-x`) classes with per-item stagger delays; opening a page
  (or, for the transcript specifically, opening it in place inside the already-open Konzílium
  page) toggles the `.play` class off/reflow/on, replaying the animation every time — the
  transcript-open handler explicitly re-triggers `.play` on `#konzTranscript` since it doesn't
  go through `openPage()`.
- **Ambient life**: the pulsing-dot pattern (renamed from the single-purpose `.konzdot` to the
  reusable `.pulsedot`) now also marks the hub's Feed tile and the newest Konzílium list row, not
  just the hub's Konzílium tile. The Dimenziók-page mini-rings now **pop in** (scale 0.4→1 with a
  spring easing) instead of only fading, and the bootstrap cluster's avatar discs pop in one by
  one when the flow (re)starts.
- **Bootstrap arc is richer**: the progress ring's stroke is now a coral→gold `<linearGradient>`
  instead of a flat color, and a live **percentage counter** (`#bootPct`, driven by a
  `setInterval` synced to the staged-lines timeline) counts up 0→100% in the arc's center.
- **Hover/press micro-interactions**: dimension tiles and konzílium rows now lift slightly on
  hover (`translateY(-2px)`) in addition to the existing press-scale; the feed's diff row gained
  a press-scale it was missing.
- All of the above is **reduced-motion-guarded** exactly like the first ship — the
  `@media (prefers-reduced-motion: reduce)` block was extended to cover `.pulsedot`,
  `.rise-x`, the dims-page mini-ring pop, and the bootstrap cluster pop, in addition to the
  existing guarded list.

## Net effect / what's unchanged

- The claim-tile feedback loop (Talál / Nem igaz / Pontosítom), the confidence-word contract
  (biztos/valószínű/figyeljük, never a raw number), the ÉRZÉKENY mirror-toned variant, the
  204 empty state, and the CHAPTER dashed-tile treatment are all unchanged from the first ship.
- Dimension/expert data still comes straight from `CharacterCoreCatalog` / `CharacterExpertCatalog`
  in the backend — no new dimension or expert was invented for this round.
- Open questions carried into this round's aside (ring vs. radar hero, orb inner-motif strength,
  transcript bubble direction, bootstrap entry point, and a new one — whether the Dimenziók
  hub-tile's live datum should be the CORE average or "which dimension changed last") are listed
  in the prototype's own "Döntési kérdések Danielnek" section for the next round.

## Round 2 (mezo-1gim.14) — the Gépterem transparency surface

Daniel approved a new, geek-facing direction: a "Gépterem" page that concretely shows **what
data feeds the dossier**, not just the claim-level output the rest of the tab already shows.
This is one layer beneath the honest-words claim contract (biztos/valószínű/figyeljük) — it is
for the curious/technical reader who wants to see the actual pipeline mechanics.

### 1. Hub placement — a thin full-width tile, not a fifth grid square

The 2×2 mosaic from round 1 gained a **fifth, thin, full-width tile** underneath rather than
becoming a 2×2+1 grid (`.dimtile.wide`, `grid-column: 1 / -1`, flex-row layout). This keeps the
four "warm" content tiles (Dimenziók/Feed/Csapat/Konzílium) visually together as one group, and
lets the Gépterem tile read as a distinct, deliberately more technical stratum underneath —
reinforced by a graphite/slate wash (`#E7ECEE→#F5F8F9`) that stands apart from every other
tile's warm coral/sage/lavender/amber washes without breaking the clay-tile language (same
border-radius, shadow, rise-in behavior). Live datum: the last pipeline run's line ("ma 02:50 ·
3 megfigyelés"), read from the same `RUNS` data the Gépterem page itself renders.

### 2. Gépterem page — four sections in the Huawei subpage pattern

- **Futás-idővonal**: five expandable rows — two nightly runs, the Sunday konzílium, the monthly
  deep read, and the one-time bootstrap. Each row shows a time, a kind badge, and a one-line
  summary; tapping expands it in place (`.runrow.open`).
- **The quiet night is deliberately given equal visual weight.** `tegnap · 02:50` reads "csendes
  nap · 0 hívás" and expands to an explicit note: zero detectors fired, zero LLM calls, zero
  tokens, zero cost — framed as the system doing exactly what it should, not as a degraded or
  empty state. This is the same honest-state axiom (§2 of the handoff) applied one level deeper
  than usual: not just "no fabricated numbers" but "a true zero is worth stating proudly."
- **Jel-lánc (signal chain) drill-down**: inside the noisy nightly run, each of the three fired
  detectors renders as a two-tone block — a **KÓD** row (monospace `detchip` carrying the real
  detector key: `logging-gap`, `under-logging`, `journal-note`, a graphite background, the
  code-computed summary text, and `refIds` as small monospace pills) then a `↓ LLM értelmezi`
  connector, then an **LLM** row (the expert's orb avatar + their voiced observation). The
  "kód detektál, LLM értelmez" split from spec §3/§7 (`CharacterDetector` is pure code; the
  expert LLM interprets downstream) is now visually, not just documentarily, true.
- **Honesty detail carried through from `character.md` §9**: only Drill, Pszichológus, and
  Táplálkozó receive nightly detector-sourced observations today (the 5 shipped detectors —
  `checkin-gap`, `journal-silence`, `logging-gap`, `under-logging`, `journal-note` — are owned by
  exactly those three experts per the doc's decisions section). The noisy run's expanded view
  says so explicitly ("Doki · Edző · Szomnológus · Antropológus — ma éjjel nem kaptak hívást…"),
  rather than silently only showing the three that fired.
- **Adatforrás-leltár**: a static reference section listing what each job kind actually reads
  today (nightly's 14-day window, the konzílium's unconsumed-observations + ACTIVE-claims +
  user-feedback set, the monthly pass's full claim-base re-read, bootstrap's six-source corpus —
  all pulled from `character.md` §3/§9, not invented) followed by ten **dashed "még nincs
  bekötve"** rows for domains the dossier does not read yet (training sets/RIR, running, sport,
  fuel detail, chat topics, gratitude, decision journal, Életjel, streaks, people-mention detail).
  This list is explicitly framed as double-duty: it's also the working checklist for the next
  task, `mezo-1gim.15` ("MINDENT be").
- **AI-napló link row**: a chat-handoff-styled row noting every Karakter LLM call is stored in
  full (`feature=character`, one row per pipeline step — observe/propose/skeptic/integrate/
  portrait), with a demo-toast deep link (the real AI-napló surface is designed in the `en-tab`
  prototype, not rebuilt here).

### 3. Feed page — inline "⚙ miből?" disclosure

Every observation row on the existing Feed page (round 1) gained a small gear button that
expands the **same** signal-chain face inline, in place, using the same `chainPanelHTML()`
helper the Gépterem page calls — so the two surfaces are literally rendering the same data
through the same function, not two divergent mocks. This lets Daniel compare "the full pipeline
timeline" against "the chain in context, next to the claim it produced" and pick one in the next
round (decision question #2). Non-detector-sourced feed rows (Doki/Edző/Szomnológus/
Antropológus's items) expand to the same honest "not from a detector" note as their Gépterem
counterparts, reusing the identical wording.

### Implementation notes

- `chainPanelHTML(who, text, chain, source)` is the single shared renderer for both surfaces —
  given a `{detector, code, refs}` object it renders the two-tone code→LLM block; given a
  `source` string instead it renders a plain honesty note. Both `RUNS` (Gépterem) and `FEED`
  (Feed page) items carry either a `chain` or a `source` field, never both.
- All new interactive elements (`.runrow` expand, `.gepq` gear toggle) follow the existing
  `rise`/`rise-x` stagger + reduced-motion-guard conventions; the reduced-motion media query was
  extended to drop the new elements' transitions.
- Detector keys, expert-ownership mapping, and the konzílium's "one transaction, all-or-nothing"
  framing are pulled directly from `docs/features/character.md` (§3, §4, §9) — no invented
  pipeline mechanics.

### Net effect / what's unchanged

- Hub tile count is now 5 (4 content tiles + 1 wide technical tile); the hub still fits
  comfortably within the phone frame's one-screen budget.
- Nothing about the Dimenziók/Csapat/Konzílium/Bootstrap pages from round 1 changed structurally
  — only the Feed page gained the gear affordance.
- New decision questions (tile-vs-wide-row placement, whether the Feed "⚙" duplication earns its
  keep, how much run history to keep, and inventory grouping by job-kind vs. domain) are listed
  in the prototype's own "Döntési kérdések Danielnek" section for the next round.

## Round 2b — Adatforrás-leltár refined into four numbered rounds

Mid-round refinement on the Gépterem's Adatforrás-leltár (still `mezo-1gim.14`): Daniel wanted
the inventory to show the **planned full corpus**, not just today's connected sources, because
the not-yet-connected rows will light up here as work lands. The flat "még nincs bekötve" list
became three visual states: **bekötve** (solid rows — unchanged from round 2), **"N. KÖR"**
(dashed, numbered group headers for four planned future rounds — 1. Edzés & test, 2. Fuel &
ciklus, 3. Psziché & viselkedés-meta, 4. Kapcsolatok & AI-meta — each item showing its target
detector key as a monospace ghost chip where one is named, and a lavender "érzékeny" tag on the
medication-cycle, check-in-dimension, and knowledge-triage rows), and a fainter **"később"** tail
for the genuine remainder (e.g. the still-missing `WeightGapDetector` variant of `logging-gap`).
This list is explicitly framed as *being* the `mezo-1gim.15` ("MINDENT be") working checklist —
rows are expected to migrate into "bekötve" as each round ships.

## Round 3 (mezo-1gim.14) — run detail pages replace the accordion; week navigation replaces the flat list

Daniel reviewed round 2/2b and gave two directives, verbatim: *"NE DROPDOWN LEGYEN, és szép és
gazdag page legyen ahova átvisz"* and *"Mi van ha 1 évet nézek vissza? 1 évet kell görgetni?"*

### 1. No dropdowns — every run is a tap-through to its own page

The Futás-idővonal's expand-in-place accordion rows (`.runrow.open` / `.run-body`) are gone.
Tapping a run row now slides in a **run detail page** (`#page-run`, the same Huawei tile→page
pattern used everywhere else in this prototype) with:

- A **hero** — a kind-specific clay/orb visual (`s-orb-ejszaka` for nightly runs, the coral
  `s-orb` for konzílium since Mezo chairs it, `i-retegek`/`i-kristaly` for havi/bootstrap), the
  run's label, and its date/time.
- A **StatStrip** (`.runstats`, four tinted `.rc` cells) carrying the headline counts — for a
  noisy night: megfigyelés/szakértő hívva/detektor tüzelt; for a quiet night: a proud `0 hívás ·
  0 Ft · 0 detektor`; for a konzílium: feldolgozva/elfogadva (sage)/nyugdíjazva (amber)/portré
  átírva (lavender).
- The signal chains as **full-width, roomier cards** (`.chain.big` — the same two-tone
  KÓD→LLM structure from round 2, just given breathing room instead of accordion-compressed
  padding).
- A **"Hívott szakértők"** section of op-chips (`.opchip`: orb avatar + persona name + the
  actual operation — `megfigyelés` for nightly detector hits, `javaslat`/`ellenőrzés`/`döntés +
  portré` for a konzílium's proposal/skeptic/integrate+portrait steps, derived from the real
  `TRANSCRIPT.turns` for the one session with full transcript detail).
- For konzílium runs: outcome cells +, only when the full transcript is loaded (today, only the
  newest session), a **"Teljes transzkript megnyitása"** button that closes the run page and
  opens the real Konzílium page's transcript view (`openKonzTranscript()`, extracted as a shared
  function so both the konzílium list and any run-detail page can trigger it identically).
  Older sessions without loaded transcript detail say so honestly instead of showing a dead link.
- A run-scoped **AI-napló** deep-link row.
- **Quiet nights get their own honest mini-page** — same template, just the zero-cost stat strip
  and a single proud "0 hívás, 0 forint" panel — never a placeholder or degraded state.

The Feed page's "⚙ miből?" **inline** disclosure is gone too — the gear button now **navigates**
to the same run-detail page the observation came from (each `FEED` item carries a `runId`), so
Feed and Gépterem are two entry points into literally the same data and the same page, not two
diverging mocks. The run-detail page's back button reads the correct origin ("‹ Feed" vs.
"‹ Gépterem") depending on where it was opened from.

### 2. Week navigation replaces the flat, ever-growing list

The flat run list didn't scale — Daniel's question was direct: a year of history can't mean a
year of scrolling. The Futás-idővonal section now opens with a **week-stepper** header (‹ aug
24–30 › — the app's existing WeekHub/DayNavigator idiom), and the list below shows only the
selected week's runs, **grouped by day** (H–V labels, "MA" on today). Tapping the week label
opens a compact **month-jump popover** (`.weekmenu`, a horizontal chip row — the
dropdown/popover form already used elsewhere in this prototype for the notification bell and
daypart switch, so it stays consistent with the established idiom rather than introducing a new
one) letting Daniel jump straight to any available week in one tap instead of stepping through
one at a time. The demo ships 3 weeks of mock data (aug 10–30, `WEEKS` array in
`karakter-body.html`) with a real, working `‹`/`›` stepper (disabled at both ends of the mocked
range) — the aside is explicit that a real implementation would page/lazy-load older weeks
rather than hold a year in memory at once.

Rare, non-weekly runs (havi mélyolvasás, bootstrap) don't fit the week grid naturally (they
happen monthly / once) and got their own short **"Ritkább futások"** list below the week view,
using the same tap-through run-detail page.

### Implementation notes

- `WEEKS` is built from three `WEEK_STARTDAYS` (Monday anchors) via `buildDay()`, which looks up
  per-day noisy-chain data from a `CHAIN_POOL` keyed by day-of-month and per-Sunday konzílium
  data from a `KONZ_POOL` — days without an entry default to a quiet nightly run, so the 21-day
  mock didn't require hand-authoring every row.
- A single `RUN_INDEX` (id → run object) flattens `WEEKS` + `RARE_RUNS` and backs both the week
  list's navigation and the Feed's `⚙` navigation (`goToRun(id, origin)`), so there is exactly
  one source of truth for "what does this run contain" no matter which surface links to it.
- `chainPanelHTML()` lost its `source`-string fallback branch (no longer needed — quiet/no-chain
  states are now handled by the run-detail template directly) and gained a `big` flag for the
  roomier card variant.
- The Konzílium page's own session list (`KONZ`) gained a third entry (`w0`, aug 16) so the
  three mocked weeks' Sunday sessions are all consistently reachable from both surfaces.

### Net effect / what's unchanged

- The Dimenziók, Csapat, and Bootstrap-flow pages are untouched by this round.
- The Konzílium page's own transcript UI (persona bubbles, phase labels, outcome cells) is
  unchanged — the run-detail page links into it rather than duplicating it.
- Updated decision questions (dropped: run-history depth and the accordion question, both now
  answered by the week-nav + run-detail-page directions; kept: tile-vs-wide-row placement,
  inventory grouping, and round order; reframed: whether the Feed "⚙" should keep navigating away
  or also carry a shorter inline summary) are listed in the prototype's own "Döntési kérdések
  Danielnek" section for the next round.

## Round 4 (mezo-1gim.14) — the run page tells a story

Daniel reviewed a screenshot of the "Éjszakai kör" run-detail page from round 3: *"én itt most
nem értem mit látok"* — the page showed data but told no story. Seven concrete comprehension
fixes:

1. **Narrative first.** The hero gained one plain-Hungarian sentence under the date/badge that
   states what happened, built from the same data the page renders below it — e.g. "Átnéztük a
   vasárnapi napodat — 3 jel tüzelt, ebből 3 megfigyelés készült (Táplálkozó, Drill,
   Pszichológus)." for a noisy night, or the exact wording Daniel gave verbatim for a quiet one:
   "Csendes éjszaka — egyetlen jel sem tüzelt, ezért senkit sem hívtunk." Konzílium/havi/
   bootstrap runs got their own one-line summaries too — every run page is now understandable
   from the hero alone, before scrolling.
2. **The 3×"1" stat strip became a connected flow.** `[N jel] → [N hívás] → [N megfigyelés]`
   renders as three linked steps with visible arrows, not three floating identical numbers. The
   equality is now legible as *proof of the pipeline's determinism* (one fired detector → one
   LLM call → one observation, per `character.md` §3) rather than reading as broken/duplicated
   data — the aside explains this framing explicitly since it's a subtle point.
3. **The chain card reads as two numbered steps.** "1 · A KÓD ÉSZLELTE" (the detector-key chip
   stays monospace; the summary sentence is now normal body type — monospace prose was
   unreadable) → a connector that carries the "↓ LLM értelmezi" label as part of itself, not
   floating text → "2 · &lt;SZAKÉRTŐ&gt; ÉRTELMEZTE" (orb avatar + the observation, normal type).
4. **Cryptic refIds replaced.** `focus:204`-style chips are gone. Picked the honest-and-readable
   option: a single quiet line ("3 forrás-hivatkozás (étkezés-napló)") — count + category, no
   raw identifiers, and deliberately **not** an expandable list (that would just be another
   dropdown). Noted in the aside as the decision, with human labels (e.g. "heti fókusz · aug
   22.") flagged as a possible next-round upgrade if more detail is wanted.
5. **Mock semantic bug fixed across all run data.** The screenshot caught `under-logging` paired
   with a positive sentence about a nonexistent "heti fókuszok" (weekly-quest) domain — wrong on
   two axes: `under-logging` is the missing-meal-logs-plus-rising-weight detector, and it's a
   *negative* signal. Audited and corrected every mock chain in `CHAIN_POOL` and `FEED` against
   the real catalog: `logging-gap` (missing meal logs, Táplálkozó), `under-logging` (logged
   intake trailing the weight trend, negative/mirror-toned, Táplálkozó), `checkin-gap` (missed
   check-ins, Drill — replacing the fabricated focus-tracking domain), `journal-silence`/
   `journal-note` (Pszichológus, unchanged, already correct). One more latent bug caught in the
   same pass: a `logging-gap` (missing logs) entry paired with a positive "protein goal met"
   sentence — fixed to follow from the actual signal.
6. **"Who wasn't called" compressed.** The run page now shows one quiet line ("A többi szakértő
   ma nem kapott hívást — az ő jeleik a heti konzíliumon érkeznek."); the full geek detail
   (exactly which 3 of 5 detectors cover which 3 of 7 experts today) moved into the aside's
   design notes, where it belongs as commentary rather than product copy.
7. **Run-kind visuals now carry meaning, consistently.** Éjszaka = `s-orb-ejszaka` (Mezo's own
   night-state orb, already breathing); konzílium = an amber disc + `i-minta` icon (matching the
   HETI badge's gold tone); havi = a lavender disc + `i-retegek` icon (matching the HAVI badge's
   lavender tone, "layered re-read"); bootstrap = the original coral `s-orb` (the founding
   moment gets the "main" orb identity). The mapping is noted in the aside and ties directly to
   the existing run-badge color tokens rather than being arbitrary.

### Net effect / what's unchanged

- The week-stepper, month-jump popover, and "Ritkább futások" list from round 3 are untouched.
- The Feed page's "⚙" still navigates (not expands) to the same run-detail page — unchanged
  behavior, just now landing on a page that actually explains itself.
- The Konzílium page's own transcript UI is unchanged; the run-detail page's "Teljes transzkript
  megnyitása" link still hands off to it for the one session with full turn-level detail.

## Round 5 (mezo-1gim.14) — csempézett Gépterem-hub, no more long scroll

Daniel: *"nagyon sok a scrolling, csempézzünk, rendezzünk"* — the Gépterem page stacked the
week-stepper timeline, the full 4-round leltár, and the AI-napló row into one long scroll.
Restructured into the same compact tile-hub idiom as the Karakter hub itself.

### Structure

- **Gépterem page** is now a compact hero + a 4-tile mosaic, verified to fit exactly one screen
  in the demo (the page-body's `scrollHeight` equals its `clientHeight` — zero leftover scroll).
  The hero gained **one live line** reusing the run-detail page's narrative style: the plain-
  Hungarian summary of the most recent nightly run (`ejszakaLede()`, factored out of `renderRun`
  so both the hub hero and the run-detail page call the exact same function on the exact same
  data — no divergent copies).
- **Futások tile** (live datum: computed, not hardcoded — "e héten N futás · N megfigyelés" from
  the current week's actual day data) opens the new **Futások** page, which holds the
  week-stepper + day-grouped run rows + "Ritkább futások" exactly as built in round 3 — moved,
  not rebuilt.
- **Adatforrások tile** (live datum: "9 bekötve · 26 tervezett", both computed from
  `INVENTORY.reads.length + DETECTOR_CATALOG.length` and the sum of all four round's item
  counts) opens the new **Leltár** page, holding the bekötve section + the four MINDENT-be
  rounds + a később tail — moved unchanged from round 2b/3.
- **AI-napló tile** replaces the old full-width row — same toast demo, no page behind it (the
  content was too thin to earn a whole page).
- **Detektorok tile** (new, included because it earned a genuine live datum — "5 aktív
  detektor") opens a small new page listing the 5 real, shipped detectors with a one-line
  meaning and owning expert each (`DETECTOR_CATALOG`) — this used to live only in the 4.1
  round's aside notes; now it's an actual product surface.
- **Back-chain corrected**: Karakter → Gépterem → Futások → run-detail (the run page's back
  button now reads "‹ Futások", not "‹ Gépterem", since the run list moved one level deeper);
  the Feed's "⚙" entry point still returns "‹ Feed" — unaffected, since it's a separate route
  into the same run-detail template.
- All three new pages (Futások, Leltár, Detektorok) and all four new hub tiles share the
  Gépterem's graphite/technical wash family (`t-gepterem`, `p-gep`), keeping the whole surface
  read as one visual family distinct from the Karakter hub's warm tiles.

### Net effect / what's unchanged

- Run-detail pages are exactly v4.1 — narrative-first hero, N-jel→N-hívás→N-megfigyelés flow,
  two-step chain cards, quiet refcount line, compressed "who wasn't called" note, kind-specific
  hero visuals. Nothing there changed.
- Two new decision questions (Detektorok as its own tile vs. folded into Leltár; whether
  AI-napló deserves a page once the real surface is richer) added; the four carried-over
  questions from round 3/4 (tile-vs-wide-row on the Karakter hub, Feed "⚙" navigation, leltár
  grouping, round order) remain open — none were resolved by this restructuring round.

## Round 6 (mezo-1gim.14) — readable Adatforrások

Daniel: *"adatforrások így teljesen olvashatatlan"* — the leltár page (round 5's "Leltár" page,
reached from the Gépterem hub's Adatforrások tile) had become a dense, undifferentiated wall of
rows: 4 "bekötve" rows plus 26 "tervezett" rows in one continuous list, with monospace detector
keys sitting mid-sentence inside prose descriptions. Five readability fixes, applied per Daniel's
explicit principles:

1. **Plain language first, geek second.** Every row now leads with a short human label in normal
   body type; the monospace detector-key chip moved to a secondary, right-aligned position —
   never inline in a sentence.
2. **Cards, not a list wall.** One sage-toned **"Bekötve" card** (four rows, each with a quiet ✓
   and small mcell-style value chips) replaced the old prose rows. The four **"N. KÖR" cards**
   kept their dashed treatment, but the dash moved to the *card frame* — the content inside reads
   as solid, normal text, per Daniel's explicit instruction to "dash the frame, not the text."
3. **Segmented control chosen over one long scroll.** Weighed against the alternative (a single
   scroll of five cards, all expandable), a two-segment **"Bekötve | Tervezett"** switch won
   because a phone-width scroll of five full cards (four of them 4–8 items deep) still couldn't
   fit anywhere near 1.5 screens. The "Tervezett" segment shows a compact 4-row index (round
   number + title + item count) that taps through to a new generic **`page-kor`** mini-page per
   round — the exact escape hatch the brief offered ("the rounds become tap-through mini-pages
   from a compact 4-row index") when full inline content wouldn't fit.
4. **Content trimmed to fragments.** Every item label shortened to 2–4 words ("Niggle-jelentések"
   instead of a full sentence); items mapping to more than one detector (e.g. streak-törés → 3
   keys) collapse to a quiet "3 detektor" count instead of a wall of chips; ÉRZÉKENY became a
   small lavender dot instead of a shouting badge.
5. **Read-window facts as value chips.** "14 nap", "60 összegző", "40 tény" etc. now render as
   small tinted `.valchip` tiles inside the Bekötve card, not as prose sentences.

**Result, verified in the demo**: the Adatforrások page's `page-body` scrollHeight now equals its
clientHeight exactly — it fits with zero leftover scroll, well inside the 1.5-screen budget — and
a round's own mini-page (even the 8-item Psziché & viselkedés-meta round) fits comfortably too.

### Net effect / what's unchanged

- `INVENTORY` data is unchanged in shape (same 4 read-sources, same 4 rounds, same 26 total
  planned items, same detector/sensitive flags) — only presentation and label length changed.
- The Futások, Detektorok, and run-detail pages from round 5/4.1 are untouched; Detektorok's own
  list was restyled to the same card/row language for family consistency but its content and
  navigation are unchanged.
- The "Leltár csoportosítása" decision question was refreshed to ask about the new segmented-vs-
  continuous-scroll choice specifically, rather than the now-resolved grouping-logic question;
  all other carried-over decision questions remain open.
