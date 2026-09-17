# Train 1:1 parity — the ⓘ explain layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the prototype's explain layer exists in production — one small ⓘ button beside a
heading, opening the workout-style 3D glass with a short plain-language explanation — placed
at all 13 sites across 8 Train screens, with the owner-iterated copy word for word.

**Architecture:** one shared primitive (`InfoButton` + its glass, built ON the shipped
`GlassBox` — the prototype's own `infoGlass()` uses the same `.wo-glass` family GlassBox
ports, and the owner's 2026-09-15 call is recorded in the prototype itself: "Every ⓘ opens
the workout-style 3D glass, never the drawer"), one `.pl-info` CSS rule ported, then 13
placements. No new screen, no data work.

**Driving artifacts:** recon `info-layer-recon.md` (2026-09-17 — the mechanism, all 13
verbatim copy blocks, every production anchor with line numbers, the GlassBox gap list),
`docs/design_2.0/2026-09-17-train-deep-parity-audit.md` (the 13-row missing-controls
table), bd `mezo-b516k`, branch `feat/train-parity-info`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:

- **The copy ships word for word** from the prototype (the recon quotes all 13 blocks) —
  it was iterated with the owner. The THREE adjudicated exceptions, decided here so no
  implementer invents one:
  1. **#5 (closed-run report):** production's muscle-journey section renders text rows, not
     the prototype's bars (a documented P1 decision), so the button title "Mit mutat a
     sáv?" would point at a bar that is not there. The COPY stays verbatim (it describes
     the journey, not the bar); the TITLE is `Hogyan olvasd?` until the surfaces slice
     (mezo-fsz2r) returns the bars, when it flips to the prototype's. Record the swap in
     the parity matrix.
  2. **#4 (template story):** production currently prints this explanation as a static
     paragraph under the heading. The prototype keeps it BEHIND the button — move it there
     (delete the inline paragraph in the same change; the sentence must not appear twice).
  3. **#3 (muscle page):** the copy interpolates the muscle's real MEV value
     (`${muscle.mev}`) — interpolate the production value the page already has; never a
     literal number.
- **The glass is 1:1 with the prototype's `infoGlass()`**: the `MEZO · RÉSZLET` eyebrow,
  the title, the leading icon, the copy paragraph, the ✕ — and the prototype's FIXED accent
  `#bca6f1` for every info glass (it is the explain-layer's identity colour; do NOT tint it
  per section). GlassBox has no eyebrow/icon slot — put them inside `children` in the
  shared component rather than widening GlassBox's props.
- **Route change closes the glass.** The prototype auto-closes on `hashchange`
  (`navigation.js:100`); GlassBox does not listen for navigation — the shared component
  owns that (a `useLocation` effect), tested.
- **The button is icon-only**: no visible text, `aria-label` = `"<title> — mit jelent?"`
  exactly as the prototype builds it; 22px visual size per `.pl-info` (plan.css:313-314)
  but the TOUCH target must still meet the 44px house rule (padding/hit-area, not a bigger
  glyph).
- CSS: the `.pl-info` rule and the copy paragraph's style (`info-glass-copy`,
  load.css:179) port into `frontend/src/styles/prototype.css` inside the existing terv
  section as a marked sub-block; structure-test registered; zero unprefixed selectors (the
  copy class ports as `.pl-info-copy`).
- Every task runs `pnpm test:layout`; the final task runs the whole-screen check on ALL
  8 screens (the button present beside the right heading, the glass opening with the right
  copy) — controls and surfaces, not just text (the mezo-i8ahy standard).

Verified anchors (recon 2026-09-17): prototype `plan-pages.js:131` / `load-pages.js:11` /
`gyak-pages.js:11` (the `info()` helper), `navigation.js:88-101,139` (`infoGlass` + the
owner-call comment), `plan.css:313-314` (`.pl-info`), `load.css:179` (`info-glass-copy`),
`session.css:202-225` (the glass family GlassBox already ports); production anchors for all
13 placements with line numbers in the recon §3 — including the four notes: #5's reworded
section (`MesoReportPage.tsx:501-520`), #4's inline paragraph
(`MesoTemplateStoryPage.tsx:263` + its test at `:265` which clicks the heading text — the
icon-only sibling must not intercept that click), #6/#10's slightly different anchor
sentences (production wording stays; the button attaches to what is there);
`GlassBox.tsx` (ports the same family; dismissal Escape/backdrop/✕ — route-close is the
caller's), `prototypeCssStructure.test.ts` (the structural guard).

---

### Task 1: The primitive — `InfoButton` + its glass + the CSS

**Files:**
- Create: `frontend/src/features/train/components/InfoButton.tsx` + test
- Modify: `frontend/src/styles/prototype.css` (the `.pl-info` + `.pl-info-copy` sub-block),
  `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` (register both)

```tsx
export function InfoButton({ title, copy, icon = 'i-info' }: {
  title: string
  /** The owner-iterated explanation, word for word. May contain an interpolated value. */
  copy: string
  icon?: ClayIconName
})
```

Renders the 22px icon-only button (`.pl-info`, `aria-label={title + ' — mit jelent?'}`,
44px hit area) and owns its open state; open renders `GlassBox` (label = title, tint =
the prototype's `#bca6f1`) whose children are the `MEZO · RÉSZLET` eyebrow + the icon +
the copy paragraph (`.pl-info-copy`). A route change closes it. Pick the clay glyph
closest to the prototype's `info` icon (grep the sprite; if none reads as "info", use the
quietest neutral glyph and note it).

- [ ] **Step 1: Failing tests** — renders icon-only with the exact aria-label; opening
  shows eyebrow/title/copy in a GlassBox; Escape, backdrop, ✕ and a ROUTE CHANGE each
  close it; the structure test's two classes.
- [ ] **Step 2:** FAIL → port the CSS → implement. **Step 3:** PASS both modes +
  `tsc -b` + `pnpm build` + `pnpm test:layout`.
- [ ] **Step 4:** Commit `feat(train): the InfoButton explain primitive (mezo-b516k)`.

### Task 2: The 13 placements

**Files:** the eight pages the recon §3 anchors (MesoDayPage ×2, MesoMusclePage,
MesoTemplateStoryPage, MesoReportPage, TrainWeekPage ×3, TrainWeekMapPage,
TrainWeekMozgasPage ×2, ExerciseStoryPage ×2) + their tests.

Each placement: the button beside the anchored heading/sentence (trailing sibling inside
the heading row, as the prototype inlines it; #8 sits inside the sport card and carries the
prototype's `volley` art override; #6/#9/#10 attach to their `.pl-say`-style sentences),
copy verbatim from the recon (with the three adjudicated exceptions from the Global
Constraints). #4 also deletes the now-duplicate inline paragraph. #3 interpolates the real
MEV. Per placement, one test: the button exists with its aria-label and opens its copy.
Verify `MesoTemplateStoryPage.test.tsx:265`'s heading-click still lands on the heading.

- [ ] Failing per-placement tests → place all 13 → both modes + `tsc -b` + `pnpm build` +
  `pnpm test:layout` → commit
  `feat(train): the 13 explain buttons, copy word for word (mezo-b516k)`.

### Task 3: Whole-screen checks, docs, ship

- [ ] **The parity check, all 8 screens** (the mezo-i8ahy standard — controls, not text):
  in a live browser beside the prototype, confirm per screen that the button sits beside
  the same heading, opens the same glass anatomy, and the copy matches the prototype
  word for word (the three exceptions as adjudicated). Report per screen.
- [ ] Docs: `docs/features/train.md` (the explain layer: the primitive, the rule that copy
  is owner-iterated and ships verbatim, the three exceptions); the parity matrix — close
  the 13 missing-control rows, record the #5 title swap; CODEMAP regen.
- [ ] Gates FOREGROUND: both-mode full `pnpm test`, `tsc -b`, `pnpm build`,
  `pnpm test:layout`.
- [ ] Ship (controller): push, PR, CI, detached merge, post-merge CODEMAP, close
  `mezo-b516k`.

## Self-review notes

- One primitive, thirteen call sites, zero data work — the whole slice is deliberately
  shallow so the copy and the glass are the only things that can go wrong, and both are
  specified verbatim.
- The three copy exceptions are adjudicated HERE; the fixed `#bca6f1` accent is the
  prototype's own choice, not a new decision.
- The #5 title swap is temporary by design and tracked in the matrix so the surfaces slice
  flips it back.
