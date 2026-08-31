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
