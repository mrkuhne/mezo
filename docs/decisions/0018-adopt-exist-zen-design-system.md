# 0018 — Adopt the Exist Zen design system as "Mezo Edition"

- **Status:** Accepted
- **Date:** 2026-08-04 (decisions settled in-session 2026-07-31; ADR written with P0, mezo-setx.1)
- **Driver:** mezo-setx (epic) / mezo-setx.1 (P0)

## Context

mezo's current visual system ("Napív") grew page by page: tokens exist but with loose discipline
(inline hex/rgba survives, ad-hoc font sizes like 13/17/20px, invented z-indexes, per-page tab and
FAB re-implementations). A sibling project (Exist Zen) shipped a mature design system v2 — 52 color
tokens organized as 5-stop ramps, a strict type-role table, spacing/radius/shadow/motion/z scales,
33 documented components, and 21 enforceable anti-patterns — backed by a mobile-UX rulebook
(`exist-zen-MOBILE_UX.md`). Both artifacts are now imported into this repo under `docs/references/`.

Copying the DS verbatim would erase mezo's identity (warm coral/cream, 3-mode theme, domain color
coding, Hungarian UI); keeping Napív forfeits the DS's system discipline. The migration plan
([`2026-07-31-exist-zen-mezo-edition-migration.md`](../superpowers/plans/2026-07-31-exist-zen-mezo-edition-migration.md))
chose a merge, settled as decisions D1–D4; this ADR records them durably. The epic re-skins every
page (per-page beads under `mezo-setx`, label `ds-migration`); the data layer (`src/data/**`, hook
signatures, API contract) is explicitly untouched.

## Decision

The normative reference is **[`docs/references/design-system-mezo.html`](../references/design-system-mezo.html)**
(created in P0 by porting Exist Zen DS v2 and re-skinning it per D1–D4, with Hungarian sample copy,
a dark "Pulse" chapter, a data-viz domain-accent chapter, and a Mezo-extensions chapter). Where this
doc and the imported source DS disagree, the Mezo edition wins.

**D1 — Coral is primary; warm surfaces stay.** The DS's lavender primary ramp is replaced by a coral
ramp built from mezo's brand coral: `bg #FFF4EF · soft #FFDFD3 · base #FF6B4A · hover #E05535 ·
deep #A84A26`. Surfaces/text come from mezo, not the lavender-tinted DS scale: page `#FBF6EF`, card
`#FFFFFF`, ink `#2B2118/#5F5346/#8A7A6A/#A5978A`, divider `rgba(43,33,24,0.10)`. The secondary ramp
is rebuilt from the warm ink family (replacing plum). The DS gold accent ramp and the
success/warning/error ramps are adopted as-is; lavender is demoted to a data-viz domain color.

**P0 fine-tune within D1:** the plan's proposed `--primary-deep #C4622F` (mezo's legacy
`--coral-deep`) measures **4.09:1** on white — it fails AA for normal text, defeating the ramp's own
"text uses hover/deep" rule (gold's deep stop passes at 4.77). Exercising the plan's pre-authorized
adjustment, `--primary-deep` is **`#A84A26`** (5.72:1 on white, 5.32:1 on cream). Encoded usage
rules: coral **base** is for fills, icons and the CTA gradient only (white-on-base is 2.82:1 —
never text); **hover** carries white ≥14-bold button labels (3.8:1, AA-large); **deep** is "the
coral you write with" (links, brand eyebrows). The coral→deep-coral **CTA gradient**
(`--cta-g1 #FF7A55 → --cta-g2 #FF5B36`, one definition: `--gradient-cta` + `--shadow-cta`) survives
as the primary-CTA treatment (FAB, one-per-section solid CTA), inverting the source DS's gold-CTA
role: coral = primary action, gold = reward/claim moments.

**D2 — Typography = Geist + Fraunces, role table verbatim.** Display 56/200, h1 36/700, h2 24/700,
h3 18/600, coach 22/Geist 200 (never italic), pull-quote 22/Fraunces 500i, body floor 16, caption 14,
eyebrow 12/700/0.22em (12px legal only in the three documented exception classes). Bricolage
Grotesque and Plus Jakarta Sans are retired (P1 swaps `fonts.css`).

**D3 — The 3-mode theme stays; dark is token-level.** Light / dark "Pulse" / circadian all survive.
Every ramp gets a `[data-theme="dark"]` stop block seeded from the shipped Pulse values (surfaces
`#191614/#221E1B/#2A2521`, ink `#F5EFE6/#B7A899/…`, lifted coral `#FF7E5C`, dark text-stop
`#F0966B`). The dark inversion rule is normative: bg/soft darken to tinted graphite, base lifts, and
**deep lifts lighter than base** — deep stays the text-safe stop in both themes. Components never
branch on theme; the `CircadianTheme` resolver and the sky band stay (sky is decoration — contrast
is always measured against surface tokens).

**D4 — Domain accents survive only in the data-viz band.** Six `--dv-*` tokens (Train=coral,
Fuel=sage `#7FA48A`, Sleep/Me=lav `#9B8FC4`, Sport=rose `#E27A8B`, Futás=sky `#6FA7D8`, plus amber
`#FFB347`), each with a Pulse stop. Like the DS macro colors they sit outside the ~12-role UI cap:
legal in charts, rings, heatmaps, domain icons and signal tints; **illegal** on buttons, badges,
links and surfaces. Coral is deliberately double-booked — in UI chrome it always means
primary/interactive, in the data-viz band it means Train; the bands never mix.

Additionally, seven mezo-only components are documented as first-class **DS extensions**
(SortableList, DayNavigator, CountUp, SubNavDropdown, Toggle, DatePicker, circadian sky): restyle to
tokens, never rewrite their machinery (`Sheet.tsx` `requestClose`, SortableList dnd/a11y,
CircadianTheme resolver are out of scope for the entire epic).

## Consequences

- **P1 gates on this doc:** `prototype.css` `:root` + dark block are rewritten to these ramps with a
  legacy alias bridge (`--coral → --primary-base`, `--ink → --text-primary`, …) so unmigrated pages
  keep rendering; `#C4622F` disappears as a text color (aliases resolve to `#A84A26`).
- Every page bead applies the doc's 8-point check; the 21 anti-patterns become the P9 sweep list
  (grep: inline hex, literal ms, off-scale sizes, arbitrary z-index, `<div onClick>`).
- The contrast table in the reference is recomputed for the new palette (secondary ink is now
  AAA 7.5:1 where the DS's plum was AA 4.7:1; muted rises to 4.1:1) — tests and reviews should cite
  it rather than re-deriving ratios.
- White-on-coral (2.8:1) is confined to FAB glyphs / CTA-gradient icons with `aria-label`, and CTA
  labels ≥16-bold ride the gradient's dark stop (3.1:1 AA-large) — a knowing brand trade-off,
  documented instead of accidental.
- `docs/features/_platform-design-system.md` keeps describing the shipped Napív system until P1/P2
  actually change the code; it is rewritten as the migration lands, not in P0.
