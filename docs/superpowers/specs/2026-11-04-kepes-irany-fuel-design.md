# Képes irány — a prototípus újraépítése képekkel, Fuel először (design)

**Date:** 2026-11-04 · **Owner decision** · **Driving issue:** `mezo-pi0jf` (the alternative-prototype
issue carries the direction change in its comments; a new epic follows once the Fuel pages are approved).
**Status:** spec approved in chat (owner, 2026-11-04: "jó így, mehet a prototípus"); prototype of Fuel · Mai
in review.

## Intent and why

The owner reviewed the drawn alternative prototype ("every page its own drawing", `vilagos/kiserlet-*.js`)
and said it still does not feel right: he misses the old dark-glass + 3D-icon world, and the six reference
apps he attached (a mood app, a social feed, three food/recipe apps, a radio app) share something neither
our Folyadék nor the drawn experiment has — **rich imagery on cards** (photos, custom illustrations, not
only icons), **cards of varied sizes**, **many horizontal carousels**, clearer sectioning. Decision: cancel
the drawn experiment as the way forward (its pages stay as reference), and rebuild the prototype **page by
page in a new, image-rich direction, starting with Fuel**.

## Owner decisions (2026-11-04) — do not re-litigate

1. **Light tinted ground, dark zones.** The ground is light and tinted per domain; the dark glass comes back
   as *accents*: the header block, the floating bottom nav, and one highlighted card per page. Not a dark
   app.
2. **The user's own photos on the meal cards; a drawn image where there is none.** Recipe cards carry the
   recipe's photo. The old Titanium 3D icons return on category tiles (log modes, windows, nav) and as the
   drawn stand-in.
3. **Fuel · Mai opens with the next meal, not the numbers.** Dark header with the day's sentence; a card
   floating on the dark/light seam with the next meal (photo, window, calorie pill, one round log button, and
   the remaining-calorie pill so the first glance has both); the day's numbers one row lower, smaller.
4. **The rest of Mai, top to bottom** (approved playback): the day's numbers (segmented arc + five macro
   bars incl. fibre and water) → the day's windows with compact meal rows (photo thumbnail, name, time,
   calories large, macros as text, score pill; the current window highlighted, a missed window marked in
   place, future windows as dashed "még előtted" slots that open logging) → the six log modes as a tile row
   → "Neked most" recipe carousel with "Összes" → one dark Mezo card with a concrete plan for the rest of
   the day → the supplements row → the floating five-domain nav.
5. Every earlier owner rule stands: opens on the current page, carousels have dots where they page,
   pictures must say something, one object one card shape, no grey helper text (Mezo's line instead), no
   abbreviations, no numbered headings, roomy cards, mode switches in place, no emojis, no purple/orange
   hero boxes, ≥ 12 px text and ≥ 40 px taps at 320 px (44 for primary), "kalória" never kcal, dates agree
   with today = csütörtök, szeptember 24.

## Goals / non-goals / anti-goals

- **Goal:** a clickable Fuel prototype in the new look the owner can judge page by page (Mai first, then
  Kiegészítők, Trendek, Konyha and the inner pages), realistic Hungarian content of the real record types.
- **Non-goal (for now):** touching the app, the Folyadék build programme (`mezo-n4wf5`), the bibles or
  CLAUDE.md's design-direction section. Those change only after the owner approves the Fuel pages and
  decides what happens with the three directions — his own standing rule: no rushed UI rebuilds.
- **Anti-goal:** a diary of giant image cards. The log itself stays compact and on the first screen; big
  images belong to the next meal, recipes and suggestions (see Prior art).

## Constraints

- Prototype only; nothing merges to main from this work except the prototype files and docs.
- The photos in the prototype are **free stand-ins** (Wikimedia Commons, credits in
  `docs/design_2.0/prototypes/kepes/foto/CREDITS.md`), never the owner's real meal photos (personal data,
  shareable artifact). Owner OK for the download: 2026-11-04.
- **Product fact the owner must keep in mind (from the codebase recon): the app stores no photos today.**
  Meal, recipe and pantry photos go to the AI and are dropped; there is no binary storage. "Own photos on
  the cards" is therefore a product feature to build (storage, upload, serving, migration), not a skin. The
  prototype shows the target; the build cost is a later decision.
- The 3D sprite exists only inside the prototype HTMLs (production `titanium-icons.svg` now holds
  Folyadék-jel glyphs under the same ids); the prototype uses its own copy (`kepes/sprite-3d.svg`, 125
  `t-*` symbols with their `tg-*` defs).

## The how (decided)

- **Files:** `docs/design_2.0/prototypes/kepes/fuel.html` (standalone: own data, hash-less single page with
  sheets; chrome built for the new look, not the Folyadék shell), `kepes/foto/*.jpg` (960×720 and 480×480
  crops, ≤ 180 KB each), `kepes/sprite-3d.svg`. One **fixed Artifact per domain**, recorded in
  `kepes/README.md`.
- **Look tokens:** ground `#F1F4EE` (Fuel tint), white cards radius 22 with one soft shadow, dark `#15201A`
  with green glow blobs for the header / nav / Mezo card, glass pills on dark (`rgba(255,255,255,.10)` +
  blur), Bricolage Grotesque display + Geist body, pill chips 26 px, primary round button 46 px, nav 66 px
  floating pill with the active domain as a white tile + label.
- **Imagery rules:** photo as a clipped thumbnail (60 px rows, 104 px next-meal, 4:3 recipe cards); numbers
  never over the photo except a single calorie pill with solid dark fill; no-photo fallback = tinted tile
  (`#E3F0E6`) with a 3D icon at 36–110 px.
- **Interaction:** `data-sheet` + `data-arg` (meal, recept, log), `data-toast` for everything outside this
  page's scope ("következő kör"), `data-close`; reduced motion via `prefers-reduced-motion` and `body.still`
  (only the load-in rise animates; carousels are manual).
- **Verification before hand-off:** HTTP serve, Playwright at 390 and 320 (no horizontal scroll, no text
  < 12 px outside header badges, no tap < 40 px, no missing sprite ids, console clean), sheet screenshots
  looked at, `still` branch.

## Left to the builder

Exact copy of Mezo's lines, the segment count of the arc, chip order on the next-meal card, and how the
remaining three tabs reuse these pieces — each next page goes through the same chat playback → prototype
→ owner OK loop.

## Prior art (researcher, 2026-11-04)

- **Adopted — "remaining calories is the verdict, meals are slots that fill, capture opens from the slot"**
  (ScreensDesign teardown of EatWell / MyFitnessPal / Cal AI / SnapCal,
  https://screensdesign.com/articles/calorie-tracker-app-design/): our windows are slots; future windows are
  dashed and open logging; the remaining number sits on the next-meal card so the first glance has it even
  though the owner chose the next meal as the hero.
- **Adopted as a warning — MyFitnessPal's April 2026 "Today" redesign backlash**
  (https://piunikaweb.com/2026/04/24/myfitnesspal-new-update-complaints/): the diary moved behind "View All"
  and became giant cards; users left. Hence: today's log on the first screen, compact rows, big cards only
  for the next meal and recipes.
- **Adopted — Lifesum's photo lessons** (App Store reviews 2025; Pratt design critique 2020,
  https://ixd.prattsi.org/2020/02/design-critique-lifesum-ios-app/): own photo as a thumbnail, never a
  half-screen header; meal grouping and per-meal calories stay regardless of photo; photo is never the only
  path (quick / usuals stay equal).
- **Adopted — text over images** (Smashing Magazine / WCAG 1.4.3,
  https://smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1): numbers below or beside
  the photo; at most one large number on the photo in a solid pill.
- **Thin field:** dark floating nav / dark accent card on light ground is a platform trend (iOS 26, Google
  apps) with no nutrition-app evidence either way — treated as the prototype's own styling decision.

## Codebase terrain (investigator, 2026-11-04)

- **Content floor:** `docs/features/fuel.md:97-118` (route table), `vilagos/fuel.js:15-70` (day model:
  `DAY`, `SLOTS` four windows, `MEALS`, `REC`, `KAM`, `STACK`, `WEEK`), `elo/fuel.html` (frozen Üveg
  living prototype, routes `#mai #meal #score #log #konyha #receptek #recept #muhely #kamra #stack
  #protokoll #stack-uj #gyogyszer #trendek #tanulas #beallitas #ablakok`). Behaviour frozen; reverse parity
  list per page when the inner pages come.
- **Old dark-glass recipe:** `docs/design_2.0/2026-09-23-uveg-style-bible.md:70-119` (four layers; the
  sheen was removed by the owner 2026-09-30); light `.glass` at `elo/fuel.html:58-79`.
- **3D icons:** inline `<symbol id="t-*">` blocks with `tg-*` gradient defs, `elo/fuel.html:1323-1515`
  (125 symbols) — copied to `kepes/sprite-3d.svg`. Production sprite no longer holds the 3D art (commit
  `3e6e66679`); reintroducing it in the app means a second sprite namespace.
- **Photos:** none persisted anywhere (`api/feature/meal/meal.yml:64` "stateless, nothing persisted";
  `pantry.yml:123`; `fuel.md:625` "no binary storage"); recipes and pantry items have no image field. The
  only image precedent is the vendored exercise stills (`frontend/public/exercises`, 15 MB,
  precache-excluded). → the photo cards are a product decision with backend work.
- **Traps:** sprite hidden with `width:0;height:0`, never `display:none`; unique gradient ids per instance
  where needed; `:has()` specificity; dark fills of some 3D icons read as "black holes" on light grounds
  (use a tinted well behind them); reduced motion for every animation; reload per route when verifying.
- **Canon that this direction will supersede when approved:** CLAUDE.md §Design direction, the Folyadék
  bible and `docs/design_2.0/README.md` banner, `prototype-recipe.md`, the `/folyadek` and `/kiserlet`
  skills, epics `mezo-n4wf5` and `mezo-pi0jf`. Not touched in this slice.
