# Train 1:1 parity — the surfaces

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** every Train card family paints what the prototype paints. The CSS ports' "tint
dark-only literals against house tokens" step silently changed 21 near-transparent surfaces
into opaque cards and made a dozen discrete meaning-changes (a tinted note lost its box, a
chip became a bare row, two tiles gained boxes the prototype never had). All of it goes back
to what the prototype RENDERS.

**Architecture:** CSS-only, one stylesheet, driven line by line from the deep audit's two
lists (`docs/design_2.0/2026-09-17-train-deep-parity-audit.md` — §A systemic, §B discrete),
verified by computed-style measurement in a live browser against the prototype, family by
family. No markup changes except where a lost box needs its element back.

**The safety insight that makes this correct:** the whole Train domain renders inside the
`titanDark` scope — the ground behind these surfaces is ALWAYS the dark canvas, exactly as
in the prototype. The original ports' light-theme worry does not apply to Train-scoped
families; restoring the prototype's translucent literals is safe here. (Families shared
outside Train, if any turn up, keep tokens — name them in the report.)

**Driving artifacts:** the deep audit §A+§B (measured 2026-09-17), the prototype's own
stylesheets (the source of every restored declaration), the owner's rule from `mezo-fsz2r`:
**match what the prototype renders** — including where the prototype's own latent bug is
what renders (the `.gy-rec` case: its border/background are invalid at computed time, so
the card is flat; production restores the FLAT rendering, not the buggy declarations'
intent). bd `mezo-fsz2r`, branch `feat/train-parity-surfaces`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:

- **The measure of done is computed style, not source diff:** for every touched family,
  `getComputedStyle` of the first instance in production vs the prototype, on the same
  screen at the same width — `background-color`, `background-image`, `border-top-width`,
  `border-top-color`, `border-radius`, `box-shadow`, `padding`. The audit's per-family
  tables are the checklist; the fix round is not done until the measured values match.
- **`.gy-rec` and any sibling "invalid-at-computed-time" case:** reproduce the RENDERED
  result (flat) with clean CSS — never copy invalid declarations to be bug-compatible.
- **The flip-back debt from mezo-b516k** (the closed-run info title `Hogyan olvasd?` →
  `Mit mutat a sáv?`) fires ONLY if this slice restores the muscle-journey BARS — it does
  not; the bars are §10 content work, not surface work. State that explicitly in the
  matrix so the debt stays visibly chained, and do NOT close mezo-fsz2r's comment thread
  claim silently.
- Structure tests keep passing; zero unprefixed selectors; `pnpm test:layout` in every
  task; the whole-screen walk at the end covers every screen the audit's §A/§B rows touch.

Verified anchors: the audit's §A list (21 declarations: `.ld-group`, `.ld-sport`,
`.ld-map-card`, `.ld-move-card`, `.ld-move-box`, `.ld-wait-row`, `.gy-card`, `.gy-rec`,
`.gy-curve-box`, `.mm-region`, `.pl-item`, `.pl-day`, `.pl-day.is-now`, `.pl-dest`,
`.pl-ex`, `.pl-lib-card`, `.pl-lib-card.is-now`, `.tr-day`, `.tr-day.is-done`,
`.tr-pills span`, `.pl-poster-foot span`/`.pl-dhero-pills span`) and §B discrete list
(`.tr-day` band→poster incl. radius 26 + border, `.tr-day.is-live` ring, `.tr-start`
inner highlight + own background + radius 22 + small opacity .72, `.tr-energy`/`.tr-mus`
boxes REMOVED (the prototype has none), `.ld-hero` border/padding, **`.ld-sport-note`'s
tinted box restored**, `.ld-sport-chip` outlined, `.ld-map-big` flex, `.ld-map-stage`/
`.ld-wait-row`/`.ld-move-box` paddings, `.ld-glass-name small`/`.ld-sport-copy small`
display, **`.pl-mrow`'s chip restored** (background/border/radius 14/padding 9px 12px),
`.pl-dhero`/`.pl-poster` shadow/border/padding, `.pl-day` shadow, `.pl-day.is-rest`
opacity .45, `.pl-days`/`.pl-dests` gutters, `.pl-dhero-number strong` gradient clip,
`.wo-verdict` grid, `.cer-cta` display); the prototype stylesheets under
`docs/design_2.0/prototypes/companion-titanium/` (train-pages.css, load.css, plan.css,
gyak.css, session.css) as the source of every restored declaration.

---

### Task 1: The `ld-` and `mm-` families (Terhelés, map, mozgás, jelek)

Restore per the audit's rows: the six §A `ld-` surfaces + `.mm-region`, and the §B items —
`.ld-sport-note` gets its tinted box back, `.ld-sport-chip` goes outlined, `.ld-hero`
border/padding, `.ld-map-big`/`.ld-map-stage`/`.ld-wait-row`/`.ld-move-box` geometry,
the two `small` display fixes. Sources: `load.css`.

- [ ] Per-family: restore → measure BOTH apps live (`getComputedStyle`, the audit's seven
  properties) → record the matched values in the report. Tests: structure test + layout
  suite; adjust any test pinning the old surface. Commit
  `fix(train): the Terhelés families paint what the prototype paints (mezo-fsz2r)`.

### Task 2: The `pl-` family (Terv, day, library, report)

The eight §A `pl-` rows + §B: `.pl-mrow`'s chip restored, `.pl-dhero`/`.pl-poster`
shadow/border/padding, `.pl-day` shadow + `.is-rest` opacity, the gutters, the
`.pl-dhero-number strong` gradient clip. Source: `plan.css`. Same measure-both-sides
discipline; same commit shape.

### Task 3: The `tr-`, `gy-`, `wo-`/`cer-` families (Mai, Gyakorlatok, workout)

§A: `.tr-day`(+`.is-done`), `.tr-pills span`, `.gy-card`, `.gy-rec` (FLAT per the
rendered-result rule), `.gy-curve-box`. §B: the `.tr-day` rounded-poster restoration
(radius 26 + border, the band's border-bottom/shadow gone), `.tr-day.is-live` ring,
`.tr-start` (inner highlight, own background, radius 22, small .72), **`.tr-energy` and
`.tr-mus` lose the boxes the prototype never gave them**, `.wo-verdict` grid,
`.cer-cta` display. Sources: `train-pages.css`, `gyak.css`, `session.css`.

- [ ] NOTE for `.tr-*`: the Mai page has its own parity slice (mezo-edg42) for missing
  CONTROLS; this task fixes only SURFACES on what already renders — no new sections here.

### Task 4: The walk, docs, gates

- [ ] The whole-screen walk on every audit-row screen: production vs prototype, computed
  styles per family — the audit's §A/§B tables re-measured and every row ticked MATCHED
  in `docs/design_2.0/2026-09-17-train-deep-parity-audit.md` itself (it is the scoreboard).
- [ ] Docs: the parity matrix's surface rows closed; the flip-back note per the Global
  Constraint; `docs/features/train.md` only if it stated a surface fact that changed.
  CODEMAP regen (likely no-op — CSS-only).
- [ ] Gates FOREGROUND: both-mode full `pnpm test`, `tsc -b`, `pnpm build`,
  `pnpm test:layout`.
- [ ] Ship (controller): push, PR, CI, detached merge, close `mezo-fsz2r` (the flip-back
  comment stays open-referenced to the bars work).

## Self-review notes

- CSS-only by design; the one place markup may change is where a box's element vanished
  entirely — none known; if an implementer finds one, it is a report item, not a silent
  addition.
- The titanDark insight is the plan's load-bearing safety argument — it is stated up top
  so a reviewer can attack it; if any touched family renders OUTSIDE titan-dark, tokens
  stay and the report says so.
- The `.gy-rec` rendered-result rule is the owner's own observation formalised: we ship
  what he sees in the prototype, not what its source mistakenly asked for.
