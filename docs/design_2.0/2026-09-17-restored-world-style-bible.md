# Restored-world style bible — Mozaik 2.0 / Clay

**Date:** 2026-09-17 · **Status:** canon · **Bead:** `mezo-ju4j6.2` (epic `mezo-ju4j6`)
**Supersedes for styling purposes:** every Titanium doc in this folder.

> **This is the ONLY styling reference for the visszaöltöztetés.** Re-dress beads (`mezo-ju4j6.3`
> … `.16`) read this document and nothing else for visual decisions. Do not restyle from memory,
> do not open a Titanium doc for a look, and do not invent a new material.
>
> **Behaviour is frozen.** Every recipe here is chrome: surfaces, type, color, motion. If applying
> one would change what a screen *does*, stop — that is a bug in the recipe, not a licence.

---

## 0. How to use this document

| You are… | Read |
| --- | --- |
| re-dressing a page | §1 (ground) → §2 (palette) → §3 (card anatomy) → §4 (data graphics) → the §8 recipe closest to your screen |
| replacing a Titanium component with no old-world ancestor | §7 — GlassBox, BodyMap, in-workout list, docked TabBar are **designed here, once** |
| touching icons | §6 |
| doing a ceremony / reward screen | §5 |
| needing a detail this doc does not carry | §9 — the recovery points and the exact `git show` commands |

**The single most important fact:** the Mozaik material vocabulary is **still in the stylesheet**.
`frontend/src/styles/prototype.css` carries ~1700 live `--mz-*` references, the full DS token
ramps, the halos and the Mozaik motion vocabulary. Titanium did not replace the token layer — it
added *feature sections* on top of it and one shell scope (`.titan-dark`) that locally re-declares
the washes in cold graphite. **Re-dressing is therefore mostly: delete the Titanium section, write
markup that consumes the tokens that were there all along.** Never introduce a parallel palette.

---

## 1. The ground — token layers that survive

Four layers, all live today, in `prototype.css` source order:

1. **DS ramps (`:1`)** — Mezo Edition design system: `--primary-*` (coral), `--secondary-*` (warm
   ink), `--accent-*` (gold), `--success/warning/error-*`, the surface scale
   (`--surface-page/card/elevated/recess`), text scale (`--text-primary/secondary/muted/disabled`),
   `--divider`, the `--sp-1..9` spacing scale, the `--r-sm..3xl` radius scale, `--shadow-*`,
   `--duration/--ease-*`, the `--z-*` ladder. Type: **Geist** (display + body) + **Fraunces**
   (`--ff-serif`, the italic meta voice).
2. **Dark "Pulse" overrides (`:469`)** — warm graphite. This is the app's *real* dark mode.
3. **Legacy alias bridge (`:819`)** — every Napív / Deep-Current name (`--ink`, `--sub`, `--faint`,
   `--sage`, `--coral`, `--lav-deep`, …) is a `var()` alias onto a DS token. Old recipes mined from
   history therefore still compile unchanged. **Do not "modernise" an alias while re-dressing** —
   that is a separate, unrelated change.
4. **Mozaik layer (`--mz-*`)** — the washes, tones, cell colors, shadows and per-surface tokens the
   tile language is built from. Listed in §2.

Plus two data-viz families: the **`--dv-*` domain accents** and the **`--macro-*` band**.

### Light-first, with a real dark mode

The restored world is **light-first**: warm sand page (`--surface-page`), white/washed cards, warm
graphite dark mode via `data-theme="dark"`. Titanium inverted this — `AppLayout` *forces* dark on
`/nap`, `/nap/gyors`, `/fuel/*`, `/train/*` (`useForceTheme('dark')`) and then paints cold graphite
over it with `.titan-dark`. **Both halves die together in `mezo-ju4j6.3`:** the forced theme AND
the scope class. A page that keeps the forced dark theme but drops `.titan-dark` lands in warm
graphite — legal, but it is not the restored default and must not be shipped as "done".

---

## 2. Palette & materials per domain

### 2.1 Domain accents (`--dv-*`, light values)

| Domain | Accent | Token | Wash | Shadow |
| --- | --- | --- | --- | --- |
| **Edzés / Train** | coral `#FF6B4A` | `--dv-coral` / `--primary-base` | `--mz-wash-coral` | `--mz-shadow-coral` |
| **Fuel** | sage `#7FA48A` | `--dv-sage` | `--mz-wash-sage` | `--mz-shadow-sage` |
| **Nap** | gold `#FFB347` | `--dv-amber` | `--mz-wash-gold` | `--mz-shadow-gold` |
| **Mezo / Boop** | lavender `#9B8FC4` | `--dv-lav` | `--mz-wash-lav` | `--mz-shadow-lav` |
| **Én** | rose `#E27A8B` | `--dv-rose` | `--mz-wash-rose` | `--mz-shadow-rose` |
| *(sport)* | rose · *(futás)* sky `#6FA7D8` (`--dv-sky`, `--mz-wash-sky`, `--mz-shadow-sky`) |

Titanium's nav accents (`--nav-nap` sand, `--nav-train` lime, `--nav-fuel` cyan, `--nav-mezo`
violet, `--nav-me` dusty rose) are a **cold-graphite** set. They are replaced in §7.4.

### 2.2 The three material grades

Everything in this world is one of exactly three surfaces. Do not invent a fourth.

**A. Wash tile** — the default. A 150° two-stop gradient from the domain tint to near-page, a
hairline border, a colored lift shadow with an inset top highlight:

```css
background: var(--mz-wash-sage);              /* 150deg, #E9F1E2 → #F7FBF3 */
border: 0.5px solid rgba(43, 33, 24, 0.06);
border-radius: 21px;                           /* 18–22 band; see §3.1 */
box-shadow: var(--mz-shadow-sage);
/* = 0 17px 31px -17px rgba(110,139,94,.45),
     0 2px 6px rgba(43,33,24,.04),
     inset 0 1px 0 rgba(255,255,255,.7); */
```

The shadow formula is the signature: **a long, soft, hue-tinted drop (`-17px` spread) + a tiny
neutral contact shadow + a 1px white inset top edge.** That inset is what makes the tile read as a
raised physical object rather than a flat rectangle. It is also the first thing to check when a
re-dressed tile "doesn't look right".

Dark mode redefines the same names with `color-mix(… var(--surface-card))`, so **write the token,
never the literal**, and both themes follow.

**B. Cell / chip** — flat, no shadow, no gradient: a solid tinted background + its ink partner.

```css
background: var(--mz-cell-sage-bg);  color: var(--mz-cell-sage-ink);  /* #E9F1E2 / #4E6B42 */
border-radius: 999px; padding: 4px 11px;
font: 600 10.5px/1 var(--ff-body);
```

Pairs: sage `#E9F1E2`/`#4E6B42` · coral `#FFE7DC`/`#A84A26` · amber `#FFF1D6`/`#8A5E07` ·
lav `#EBE6F8`/`#5D4FA0` · sky `#DFEDF5`/`#2E6E96` · rose `#FAE3ED`/`#8E3F6F` · gold `#FBEBCB`/`#8A5E07`.
The `--mz-tone-*` family is the same idea one step lighter, for tinting a page band.

**C. Halo band** — a frameless, centered atmosphere behind a hero. No border, no shadow, no card.

```css
background: var(--halo-sage);
/* radial-gradient(ellipse at 50% 30%, rgba(154,184,143,.30) 0%,
                   rgba(244,208,111,.10) 30%, rgba(251,246,239,0) 60%) */
padding: 16px 18px 12px; text-align: center;
```

Also `--halo-amber`, `--halo-rose`, `--halo-blue`, `--halo-violet`. **The halo is how the old world
did a hero.** Titanium used a bordered dark poster instead — that is the single most visible
difference on Fuel · Mai and Train · Mai.

### 2.3 What is forbidden

- Cold graphite (`#0B0D12`, `#13151D`, `#20222A`) as a surface. The dark mode is **warm**.
- `backdrop-filter` frosting as a *decorative* material. It survives only where it is functional
  (the `DomainSwitcher` overlay, §7.4).
- Metal/chrome gradients, brushed-titanium fills, neon accent glows, `drop-shadow` halos on icons.
- A poster card whose body is a large dark rectangle. Cards are washed and light.
- Emoji. Ever. Every glyph is a clay symbol (§6).

---

## 3. Card anatomy — the poster tile

### 3.1 Geometry

| Slot | Value |
| --- | --- |
| Outer margin | `0 24px` horizontally, `12–16px` vertical gap between cards |
| Radius | **21–22px** for a full tile (`--r-2xl` = 18 for a DS card; the mined Mozaik families use 21/22) · **15–18px** for a row/nested field · **999px** for a chip |
| Padding | `12px 14px 13px` (row) · `14px 15px` (tile) · `var(--sp-4)` (DS hero card) |
| Border | `0.5px solid rgba(43,33,24,.06)` — hairline, not `1px` |
| Icon shield | `50×50`, radius `16`, `display:grid; place-items:center`, `background: var(--surface-1)`, `box-shadow: inset 0 0 0 1px var(--border-subtle)` |

### 3.2 The vertical rhythm

Every poster tile is the same four-beat stack, top to bottom:

1. **Eyebrow** — `font: 800 8.5–9.5px; letter-spacing: .16–.18em; text-transform: uppercase`, in the
   domain's `*-ink` color. Optionally prefixed by a state dot (`8px` circle, §4.4).
2. **Spot graphic or icon shield** — a clay spot (`ClaySpot`, §6) or the 50px shield. Left of the
   text in a row; centered above it in a hero.
3. **One big numeral** — `font-family: var(--ff-display)`, **weight 200**, `font-size: 40–46px`,
   `letter-spacing: -0.04em`, `line-height: 1`, `font-variant-numeric: tabular-nums`,
   `color: var(--ink)`. Its unit rides beside it at `18px/300` in `var(--faint)`.
   **One numeral per card.** If a card wants two, it wants to be two cards.
4. **The of-line** — the quiet context sentence under the numeral:
   `11.5px/500` in `var(--sub)`, with the meaningful figure in `<b>` at `700` in the domain ink.

Then, optionally: a **chip row** (§2.2 B, `gap: 6px`, centered, wrapping) and/or a **fact-pill row**
(`.metapill`, one fact of a session each).

### 3.3 Title type

- Card title / `h2`: `var(--ff-display)`, `24px/700`, `letter-spacing: -0.02em`, `--text-primary`.
- Row title: `15px/700`, `line-height 1.3`, clamped to 2 lines.
- Secondary meta: `9.5–11px`, `--text-secondary`, `tabular-nums` whenever it contains a number.
- The **serif italic meta voice** (`--ff-serif`, Fraunces) is reserved for the companion's voice and
  reflective copy — never for data.

### 3.4 Depth and focus — mix the grades, don't pick one

**A wash tile is loud only next to something that isn't one.** This is the most-repeated mistake of
the re-dress: every re-dressed screen's first pass made *every* surface a §2.2 A wash tile, and each
time the result read **flatter than the Titanium version it replaced** — the owner felt it on the
Terv/Terhelés prototype before he could name it ("something was better in Titanium, I don't know
what"). Titanium bought its depth cheaply, with a dark ground and a glow. The restored world buys it
with **contrast between the three material grades**, and that only works if all three are on screen.

Per screen, in this order:

1. **Name the ONE thing the screen says.** That gets the loud treatment — the wash tile, or the
   `--gradient-cta` primary if it is an action (Appendix C/13).
2. **Demote everything else by one grade.** Wash tile → house row (`--surface-1` +
   `inset 0 0 0 1px var(--border-subtle)`) → cell/chip (§2.2 B). Empty and free states take the
   §4.4 dashed neutral outline and no shadow at all.
3. **Let the hero's graphic be genuinely big.** The §3.2 numeral at weight 200 *and* its drawing at
   real size — a body figure, a ring, a curve. A hero whose art is decoration-sized reads as a
   header, not a hero.
4. **Check 320px** after any step-up in size or weight (A.2 rule 5).

Worked example (Phase 7b): on the plan library ONLY the running block is a wash tile — queued and
closed runs are house rows, the blank slot is dashed. On the day list the wash marks a *training*
day; the rest day is dashed, not dimmed. On Terhelés the muscle-group tiles are washed and the two
doorway cards sit one grade below them. Nothing about the materials changed — only which surface got
which one.

**Retro-fit:** the screens re-dressed before this rule existed (Fuel 5a–5d, Nap/Mai 6, Train Mai 7a,
the shell 3–4) still wear the flat all-wash pass. `mezo-ju4j6.19` is the sweep that ranks them.

---

## 4. Data drawn as graphics

The rule: **a number the user should feel gets a graphic; a number they should read gets tabular
digits.** Never a bare progress `<div>` where a ring belongs.

### 4.1 Progress ring (the canonical one — mined from `.khero-ring`)

```
wrapper 58×58 · svg rotated -90deg · track stroke: var(--surface-recess)
fill: stroke-dashoffset, transitioned 2s cubic-bezier(.2,.8,.2,1)
center: 13px/700 tabular-nums var(--ink); its % sign 8px/600 var(--faint)
label below: 8px/800 letter-spacing .14em uppercase
value below that: 10px/700 var(--ink), its unit 10px/500 var(--faint)
row: display:flex; justify-content:center; gap:9px; flex-wrap:wrap
```

The fill animates by flipping `stroke-dashoffset` from full circumference to target **one frame
after mount** — the component drives that, the CSS only carries the transition. Wrap the transition
in `:where()` so the reduced-motion override wins without `!important`, and add the
`@media (prefers-reduced-motion: reduce) { transition: none }` branch in the same block.

### 4.2 Segmented day bar (`.khero-dayseg`)

```
height 8px · radius 4 · max-width 280px · background: var(--surface-recess)
segments: flat var(--sage) / var(--sage-deep) alternating
now-marker: 2px wide, var(--accent-base), inset -2px top/bottom,
            box-shadow: 0 0 0 2px rgba(212,168,83,.25)
```

### 4.3 Dot strip (`.fh-lt-dots`) — "how the day went, at a glance"

A row of `flex: 1` bars, `height 6px`, `radius 3`, `gap 5px`, base `rgba(43,33,24,.09)`; filled =
`--dv-sage`, now = `--mz-fh-now-ring` (and pulsing, §4.4), missed = `--mz-cell-amber-ink` at 55%.

### 4.4 State vocabulary — never punitive

| State | Treatment |
| --- | --- |
| **done** | sage wash (`--mz-wash-sage`) + sage shadow; check glyph |
| **now** | coral 1px border + `--mz-shadow-coral`, plus the now-pulse: `box-shadow: 0 0 0 0 → 0 0 0 4px rgba(255,107,74,.3)`, `2.6s ease-in-out 1.2s infinite` |
| **missed** | `1.2px dashed` amber at 55%, **no shadow**. Amber, never red. |
| **free / empty** | `1.2px dashed` neutral `rgba(43,33,24,.2)`, no shadow |
| **degraded / partial** | full chrome, value marked partial in copy — never a red card |

### 4.5 Sparkline / story-curve

Library-free inline SVG (`shared/ui/TrendChart` already does this): 1–3 series, null-gap aware,
`--dv-*` stroke, a 12%-alpha area fill of the same hue, dashed stroke for a projected trajectory,
no gridlines, no axis chrome. Tabular-num end labels instead of a legend where two series fit.

---

## 5. Celebratory surfaces — polished stone / gold

The **ceremony pattern** (`2026-09-15-ceremony-pattern.md`) stays canon for structure, triggers,
step order, glucose step and copy rules. Only the material changes back:

- **Ground:** `--halo-amber` over the page, not a dark poster.
- **The stone:** the gold "Ritmus" material — a 3-stop radial (`#FFE9A8` → `#E0AC2F` → `#A9770F`,
  `cx 36% cy 30% r 85%`) with a white specular ellipse at ~`38%/32%`, `rgba(255,255,255,.6)`,
  rotated ~-22°. This is exactly the clay recipe (§6.1) at hero scale — stone and icon are the same
  material, which is the point.
- **Accent stroke:** `--accent-base` gold, `--mz-shadow-dec`
  (`0 24px 40px -17px rgba(201,150,46,.45)` + contact + white inset).
- **Numeral:** §3.2 beat 3 at `56–64px`, weight 200.
- **Motion:** one-shot `.mz-play` choreography (§4.6 below / §8.6), no looping shine, no confetti.

---

## 6. Icons — the clay material recipe

Reference asset: **`docs/design_2.0/assets/restored-world/clay-icons-pre-titanium.svg`** (54 symbols)
and **`clay-spots-pre-titanium.svg`** (24 spots), both extracted verbatim from `8c18f331d` — the
commit *before* `d302e941f` redrew the whole set in Titanium material.

### 6.1 The recipe

```
viewBox           0 0 100 100          (Titanium redrew at 0 0 64 64)
per-object fill   its OWN named gradient, id `ig-<thing>` / `sg-<thing>`
rounded volume    3-stop radial for spheres/organic:
                  cx 34–40%, cy 28–35%, r 80–90%
                  stop 0   light tint      (#FFEDB8, #B9D3A8, #FFC3A8 …)
                  stop .5  the hue itself  (#F0B429, #7FA06C, #FF7A55 …)
                  stop 1   deep shade      (#B57E14, #4E6B42, #D8481F …)
extruded volume   2-stop vertical linear for slabs/bars/shelves
                  (#DCCFBE → #AE9F8E, #FF9A78 → #B03E1E …)
specular          one white ellipse, rgba(255,255,255,.55–.6), rotated ~-22°,
                  placed upper-left of the mass
```

**No** shared `ig-titanium` metal gradient, **no** `ig-shadow` drop filter, **no** dark inner disc,
**no** `stroke` outlines. Each object is lit from the upper-left and carries its own hue.

`ClayIcon`/`ClaySpot` render `<svg viewBox="0 0 100 100"><use href="#<id>"/></svg>`, so a symbol
authored at `0 0 100 100` is 1:1 — restoring the old art restores the intended optical weight.

### 6.2 Icons that need an old-material redraw

The 13 symbols that exist **only** in the Titanium set — they have no pre-Titanium ancestor and must
be drawn fresh in the §6.1 recipe (`mezo-ju4j6.3`):

| Symbol | Subject | Hue / gradient family to use |
| --- | --- | --- |
| `i-tanyer` | Fuel tab — plate | coral (`ig-plate`) |
| `i-kiegeszito` | Fuel tab — supplements | sage (`ig-caps`) |
| `i-trend` | Fuel tab — trend | sky (`ig-drop` ramp, re-hued) |
| `i-fazek` | Fuel tab — pot / Konyha | sage + wood (`ig-bowl`, `ig-wood`) |
| `i-hus` | macro: protein | coral/rose (`ig-orb`) |
| `i-gabona` | macro: carbs | gold (`ig-harvest`) |
| `i-avokado` | macro: fat | sage (`ig-bowl`) |
| `i-noveny` | macro: fibre | leaf green (`ig-leaf`) |
| `i-makro` | score dimension: macros | coral |
| `i-mikro` | score dimension: micros | lavender (`ig-nlav`) |
| `i-feldolgozas` | score dimension: processing | sand/stone (`ig-stone2`) |
| `i-vercukor` | glucose response (hill metaphor) | sky + gold pebble |
| `i-info` | the ⓘ affordance | lavender, flat disc + 3-stop radial |

Everything else: take the pre-Titanium art verbatim.

### 6.3 Spots

All 24 `s-*` spot symbols survived Titanium by *name*; only their gradient defs were swapped to the
metal set (`sg-titanium`/`sg-blue`/`sg-gold`/…). Restore the 24 `sg-*` gradient defs from
`clay-spots-pre-titanium.svg` and the spots come back whole — **no spot needs redrawing.**

---

## 7. New components, old world

These four shipped during the Titanium period and have **no pre-Titanium ancestor**. Their
old-world treatment is defined here, once, and every consumer inherits it. All four are on the
spec's keep-list: **their behaviour, API and DOM structure do not change.**

### 7.1 GlassBox — **there are TWO of them**

> **Correction to the spec (found while writing this bible, `mezo-ju4j6.2`).** The spec and bead
> `mezo-ju4j6.5` say "GlassBox re-skin — one component, 21 consumers inherit". That is wrong:
> the app ships **two independent glass-dialog components with two separate class families**, and
> a re-skin of one leaves the other untouched. Both are on the keep-list and both must be
> re-dressed in Phase 4.
>
> | Component | Class family | Geometry | Consumers |
> | --- | --- | --- | --- |
> | `shared/ui/mozaik/GlassBox.tsx` (Train, `mezo-88iwa.13`) | `.gl-*`, CSS section `glassbox` (was `titanium glass primitive`, renamed in `mezo-ju4j6.5`) | bottom-docked, z 220/221 | 6 files: `WorkoutMenuGlass`, `WorkoutRecordsGlass`, `InfoButton`, `FinishConfirmGlass`, `SportLogPage`, `TrainWeekPage` |
> | `features/fuel/components/GlassBox.tsx` (Fuel, `mezo-jb84`) | `.fmx-glass*`, inside the fuel titanium sections | centered, z 60 | 6 files: `FuelScoreSurface`, `GlycemicGlass`, `FuelWeekDayGlass`, `FuelStackItemGlass`, `FuelMealBlocks`, `FuelEnergyHero` |
>
> ~36 `<GlassBox>` call sites across those 12 files. **Do not merge the two components** — that is
> a refactor, and behaviour is frozen. Re-skin each in place.

#### 7.1a The Train GlassBox (`.gl-*`) — the docked one

*What it is:* a bottom-docked dialog card over a frosted backdrop, portaled into `.phone-screen`,
z-ladder 220/221 (above `Sheet`'s 200/201, below toast 300). Caller sets `--gl-tint`.

*Today (Titanium):* `rgba(5,7,10,.72)` + `blur(18px) saturate(.85)` backdrop; card is
`linear-gradient(#181d26f2,#10141bf7)` with a tint radial, `30px 30px 0 0`, white-on-dark,
`0 -20px 60px -20px #000`.

*Restored treatment — "the Sheet's louder sibling":* GlassBox becomes a **Mozaik sheet raised one
tier**. It must be visibly *more* than a `Sheet` (it outranks one) without becoming a different
material.

```css
.gl-backdrop {
  /* keep: position:absolute; inset:0; z-index:220 */
  background: rgba(43, 33, 24, 0.44);          /* warm ink veil, not black */
  backdrop-filter: blur(10px) saturate(1.02);  /* functional separation only */
}
.gl-card {
  --gl-tint: var(--primary-base);
  /* keep: absolute; left/right/bottom:0; max-width:428px; max-height:92%; the padding */
  border: none;
  border-top: 1px solid var(--border-strong);
  border-radius: var(--r-3xl) var(--r-3xl) 0 0;   /* 28 — the house sheet radius */
  background:
    radial-gradient(120% 60% at 80% 0%,
      color-mix(in srgb, var(--gl-tint) 14%, transparent), transparent 60%),
    var(--mz-sheet-bg);
  box-shadow: 0 -20px 60px -20px rgba(43, 33, 24, 0.32),
              inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
}
.gl-head strong    { font: 700 17px/1.3 var(--ff-display); color: var(--text-primary); }
.gl-head-title small { font: 800 9.5px/1 var(--ff-body); letter-spacing: .14em;
                       text-transform: uppercase; color: var(--mz-cell-coral-ink); }
.gl-x { width: 34px; height: 34px; border-radius: 50%;
        border: 1px solid var(--divider); background: var(--surface-1); color: var(--text-secondary); }
```

- The tint radial **stays** — it is how a caller says which domain is speaking. Its strength drops
  15% → 14% because it now sits on a light ground.
- The white inset top edge (§2.2 A) is what separates it from a plain `Sheet`.
- Entrance is unchanged: `.gl-anim` added by the component only when motion is allowed, `gl-fade-in`
  0.22s + `gl-slide-up` 0.24s `cubic-bezier(.22,1,.36,1)`, reduced motion renders the final state.
- **Rename nothing.** The `.gl-*` prefix stays (it exists to dodge a Tailwind v4 single-word utility
  collision), and the section moves out of `titanium glass primitive` into a `glassbox` section —
  with its `prototypeCssStructure.test.ts` describe block renamed **in the same commit**.

#### 7.1b The Fuel GlassBox (`.fmx-glass*`) — the centered one

*What it is:* `.fmx-glass-layer` (`absolute; inset:0; z-index:60; display:grid; place-items:center`)
over `.fmx-glass-backdrop`, with a centered `.fmx-glass` card — `width: min(86%, 338px)`,
`max-height: 74dvh`, `border-radius: 24px`, on `--surface-elevated`.

*It is already mostly old-world* — it is token-based, light-surfaced and centered. Four changes:

```css
.fmx-glass-backdrop {
  background: rgba(43, 33, 24, 0.40);   /* was rgba(5,7,12,.62) — warm ink, not near-black */
  backdrop-filter: blur(10px);           /* was 15px */
}
.fmx-glass {
  backdrop-filter: none;                 /* was blur(22px) saturate(1.25) — decorative frosting */
  border: 0.5px solid rgba(43, 33, 24, 0.06);
  box-shadow: 0 24px 40px -17px rgba(43, 33, 24, 0.32),
              0 2px 7px rgba(43, 33, 24, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.85);
}
.fmx-glass-hero svg { filter: none; }    /* clay icons carry their own volume — §6.1 */
```

Keep the `.fmx-glass-hero` numeral as it is: `38px/200`, `letter-spacing -0.04em` — that is already
the §3.2 beat-3 recipe. Keep `.fmx-glass-bar`, `.fmx-flow`, `.fmx-node` shapes; re-tone the
`.fmx-node-art` glow (`box-shadow: 0 0 12px …`) to the §2.2 A shadow formula instead.
The `.fmx-timebox` entrance (`0.34s cubic-bezier(.2,.9,.25,1.18)`) already matches §8.6 — leave it.

### 7.2 `BodyMap` (`features/train/components/BodyMap.tsx`)

*Already old-world compatible* — it fills from `--mz-ink-mut` and per-region `--dv-*` rails, and its
CSS is six skin-free lines. Two changes only:

1. **Frame it.** The map sits in a wash tile (§2.2 A) with a coral shadow, not on a bare dark ground:
   eyebrow "IZOMTÉRKÉP" → the two figures → a chip row of the hot regions (§2.2 B).
2. **Heat ramp = the domain ramp.** Cold/untouched `--mz-ink-mut` at `opacity .42`; warm regions step
   `--mz-cell-sage-ink` → `--dv-amber` → `--dv-coral`. No neon, no glow filter. Keep the
   `opacity .3s ease` transition and its reduced-motion branch.

### 7.3 The in-workout list (`ActiveWorkoutPage` + `WorkoutDock` / `WorkoutMenuGlass` / `FinishConfirmGlass`, `.wo-*`)

*What it is:* a scrolling exercise list with a docked bottom control bar; the menu and finish-confirm
surfaces are `GlassBox` instances.

*Restored treatment:* this is the one screen the old world never had, so it is built from mined
parts rather than invented:

- **Page ground:** plain `--surface-page`. No page-level poster, no dark canvas. The workout is a
  *working* screen; calm ground, loud content.
- **Exercise card:** the mined **execution-card v2** idiom — a wash tile per exercise, tinted by the
  muscle family via `--tc-accent`/`--tc-wash` (the `.todaycard` custom-property pattern, §8.5), with
  a 50px clay icon shield (§3.1), title `15px/700`, and the set table below it.
- **Set rows:** the mined **set-list v4** strict table — exercise-level constants in the header,
  one row per set, `tabular-nums` throughout, completed rows take the sage cell fill
  (`--mz-cell-sage-bg`), the active row takes the coral now-border + now-pulse (§4.4).
- **Rest timer:** the mined **in-card rest-timer bar (CTA-morph)** — the timer *replaces* the primary
  button in place rather than opening anything, coral fill draining left-to-right.
- **Docked bar (`WorkoutDock`):** `--surface-card` with the §2.2 A shadow inverted upward
  (`0 -17px 31px -17px`), a hairline top border, 44pt targets, primary action on the DS CTA gradient
  (`--gradient-cta` + `--shadow-cta`). It is chrome — it does not take a domain wash.
- **`WorkoutMenuGlass` / `FinishConfirmGlass`:** inherit §7.1 automatically with
  `--gl-tint: var(--dv-coral)`.

### 7.4 The docked TabBar + DomainSwitcher (`.tab-bar[data-domain]`, `navModel.ts`)

*Keep-list:* the sticky 5-domain nav, its 5×4 matrix, the switch button, the switcher's focus
management, `inert` siblings and scroll-lock. **Geometry changes go only into the
`.tab-bar[data-domain]` rules** (design-system doc §"Docked navigation") — never into the base
`.tab-bar`.

> **CORRECTED 2026-09-18 (`mezo-ju4j6.18`, owner report + git archaeology).** This section used
> to read: *"the docked bar is graphite in both themes by design (`mezo-0i5y6`, predates
> Titanium) — that is not a Titanium artefact and it stays."* **The date is wrong.**
> `b02e06a8c` (`mezo-0i5y6`, the docked nav) landed **2026-09-17**, at the *tail* of the
> Titanium period, and the last pre-Titanium stylesheet (`0f887e565`, 2026-09-12) carries
> neither `--nav-surface` nor `.tab-bar[data-domain]`. The old world's bar was the floating
> pill whose ground is `color-mix(… var(--canvas) …)` — **theme-aware**. A permanently dark
> dock is therefore a Titanium-period artefact, and §1's light-first rule applies to it like
> to every other surface.
>
> **Lesson for the rest of the programme:** "this predates Titanium" is a claim to *verify in
> git*, not to carry forward from a doc. `git log -1 --format=%ad <commit>` against the
> Titanium window (2026-09-09 → 2026-09-17) settles it in one command.

*The decision, as corrected:* the docked bar **follows the theme** — a warm sand bar in light,
the warm graphite in dark. What is Titanium is the *permanently* dark ground, the *cold*
graphite and the pastel neon accents. The docked **geometry** is keep-list and does not move.

```css
:root {
  /* Light: page-family chrome, one step brighter than the ground, separated by the
     §2.2 A white inset top edge rather than by being a dark band. */
  --nav-surface:     #F7F2E9;
  --nav-surface-top: #FFFDF9;
  --nav-card:        var(--surface-card);
  --nav-ink:         var(--text-primary);
  --nav-muted:       var(--text-secondary);
  --nav-idle:        var(--text-secondary);  /* --text-tertiary is 3.71:1 here — under AA */
  --nav-line:        rgba(43, 33, 24, 0.08);
  --nav-highlight:   rgba(255, 255, 255, 0.75);
  /* On a light bar the accents are the READABLE `--mz-cell-*-ink` halves (5.1–6.1:1);
     the lifted pastels below are calibrated for graphite and vanish here. */
  --nav-nap:   var(--mz-cell-amber-ink);
  --nav-train: var(--mz-cell-coral-ink);
  --nav-fuel:  var(--mz-cell-sage-ink);
  --nav-mezo:  var(--mz-cell-lav-ink);
  --nav-me:    var(--mz-cell-rose-ink);
}
:root[data-theme="dark"] {
  --nav-surface:     #241E1A;   /* warm graphite, the dark-mode ground family */
  --nav-surface-top: #2C2521;
  --nav-card:        #2C2521;
  --nav-ink:         #F6F1EA;
  --nav-muted:       #C6BAAD;
  --nav-idle:        #9A8D80;
  --nav-line:        rgba(246, 241, 234, 0.10);
  --nav-highlight:   rgba(255, 255, 255, 0.05);
  /* domain accents = the §2.1 --dv- ramp, lifted for contrast on graphite */
  --nav-nap:   #FFC46B;   /* amber  */
  --nav-train: #FF8A6A;   /* coral  */
  --nav-fuel:  #9DC4AC;   /* sage   */
  --nav-mezo:  #B7ABDD;   /* lav    */
  --nav-me:    #EE9AA8;   /* rose   */
}
```

- **Drop the accent glow.** `filter: drop-shadow(0 0 6px …)` on the active tab icon is a Titanium
  tell; the active tab is identified by the accent *color* + the clay icon's own volume.
- Keep the `88px` height, `12px 8px 24px` padding, the `56px` switch column and its divider, the
  focus-visible outlines, and the `home-indicator` tint hook.
- **Light bar chrome:** `box-shadow: 0 -10px 24px -14px var(--nav-shadow), inset 0 1px 0
  var(--nav-highlight)`. The white inset top edge is what lifts the bar off a light page; on
  graphite the same line is near-invisible, so one rule serves both themes.
- **`DomainSwitcher`:** the five cards become §2.2 A wash tiles, one per domain wash, each with its
  clay domain icon at 44px, the four-tab summary at `10.5px/600` and a sage check on the current
  domain. The overlay keeps its blur — there it is functional (it separates a modal layer), and it
  is the one place §2.3's frosting ban does not apply.

---

## 8. Mined recipes — the deleted old-world families

Recovered from **`0f887e565`** (2026-09-12, the commit before `74ca59e09` deleted the Fuel families).
These are *annotated recipes*, not restore targets: read the shape, write it against today's markup.

### 8.1 `.khero-*` — the Fuel keret-hero (the canonical old hero)

Halo band (§2.2 C), centered, **no card frame**: a 46px/200 count-up numeral with an 18px/300 unit →
the `11.5px` of-line ("eddig X / Y · n/m ablak") → the segmented day bar with a gold now-marker
(§4.2) → 3 energy chips (§2.2 B, `--surface-card` + `--divider` border) → 5 progress rings
(§4.1: protein, carbs, fat, fibre, water). Count-up is a 2s ease-out rAF in the component; the CSS
carries only the ring transition.

**This is the shape Fuel · Mai returns to** (`mezo-ju4j6.6`).

### 8.2 `.fh-logtile` / `.fh-lt-*` — the logging hero tile

Full-width button, `radius 22`, `padding 14px 15px`, `--mz-wash-band` ground + `--mz-shadow-coral`,
`transform: scale(.975)` on `:active` (`.15s cubic-bezier(.3,.8,.4,1.4)`). Inside: eyebrow with a
pulsing 8px now-dot → `17px/700` headline + `11px/300` truncating sub + a chevron pushed right by
`margin-left:auto` → the §4.3 dot strip → a `9.5px/700` tabular detail line. All-done state swaps to
`--mz-qdone-bg` + sage shadow. The past-day "pótlás" chip is a **sibling** below the tile, never
nested inside the button.

### 8.3 `.fh-naplorow` — the log row

`radius 18`, `padding 11px 13px`, `--mz-wash-white`, hairline border, `--mz-shadow`; flex-wrap with
`gap: 4px 9px`; title `12.5px/700` flexing, a full-width `10px` tabular meta line wrapping beneath.
Empty state: `12px/300` in `--mz-ink-soft`, no card.

### 8.4 `.flog-*` — the stacked window blocks

One `radius 22` block per eating window on `--surface-card` + hairline + `--mz-shadow`, states per
§4.4 (done sage / now coral ring / missed dashed amber / free dashed neutral). Inside: a top row of
`11px/800` tabular time + `8.5px/800` uppercase label + a right-pushed stamp, then a main row of the
50px icon shield + a 2-line-clamped `15px/700` name + `9.5px` tabular meta. The composer expands
**in place** via a `grid-template-rows: 0fr → 1fr` well — it does not open a dialog. Day stepper:
28px round buttons flanking a `min-width:128px` pill label.

### 8.5 `.trainhero` / `.todaycard` — the session card family

One family, tinted by a custom-property pair set on the root element:

```css
--tc-accent: var(--tag-gym);  --tc-wash: var(--wash-gym);
background: linear-gradient(165deg, var(--tc-wash), var(--surface-card) 72%);
border: 1px solid color-mix(in srgb, var(--tc-accent) 16%, transparent);
border-radius: var(--r-2xl); padding: var(--sp-4); margin: 0 24px 16px;
box-shadow: var(--shadow-sm);
```

`.trainhero` adds a decorative corner bloom — `::after`, `160×160`, `top/right: -46px`, `border-radius: 50%`,
`radial-gradient(circle, color-mix(in srgb, var(--primary-base) 17%, transparent), transparent 68%)`.
Tones: gym coral · sport rose · run sky · cross amber · trx lavender.
`.todaycard` **is still live** (it is the app's one full-size item card, emitted by `shared/ui/ItemCard`)
— so Train · Mai re-dress is largely *re-adopting a family that never left*.

### 8.6 Motion

The whole world's entrance is one vocabulary:

```css
.mz-play .rise {
  opacity: 0; transform: translateY(19px) scale(0.98);
  animation: mz-rise 0.5s cubic-bezier(0.22, 0.9, 0.32, 1.15) forwards;
  animation-delay: var(--d, 0ms);
}
@keyframes mz-rise { to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .mz-play .rise { opacity: 1; transform: none; animation: none; }
}
```

`.mz-play` is added by `motion.tsx` **in JS**, only when motion is allowed — so without it
`.mz-play .rise` never matches and the page renders in its final state with no animation at all.
Stagger with `--d` (roughly 60–90ms per card). Bars grow with `scaleX(0) → 1`; rings with
`stroke-dashoffset`. **One shot, then calm** — the only permitted loops are the 2.6s now-pulse
(§4.4) and the companion orb's breathe.

---

## 9. Recovery points & how to mine more

| What | Command |
| --- | --- |
| Pre-Titanium Fuel + Train CSS families | `git show 0f887e565:frontend/src/styles/prototype.css` |
| Pre-Titanium clay icons | `git show 8c18f331d:frontend/src/shared/ui/clay/clay-icons.svg` (already copied to `assets/restored-world/`) |
| Pre-Titanium clay spots | `git show 8c18f331d:frontend/src/shared/ui/clay/clay-spots.svg` (ditto) |
| The commit that deleted the Fuel families | `74ca59e09` (2026-09-12) |
| The commit that redrew the icons | `d302e941f` (2026-09-11) |

**Rules for mining.** File-level `git show` only — **never** restore a whole directory: `GlassBox`
lives inside the mozaik kit and post-dates the old world, so a "restore `shared/ui` from history"
would delete a keep-list component. Locate CSS by its **section marker comment**, never by line
number — the anchors in the spec and in this document drift as sections are deleted.

> **Redirect a `git show … | grep` through a file.** Piping a large `git show` straight into `grep`
> silently returned zero matches in this repo's shell (`grep` is `ugrep`); writing to a scratch file
> first and grepping that gives the right answer. A false "not found" here looks exactly like
> "the old world never had this".

---

## 10. Kill-list → replacement map (self-review)

Every Titanium visual named in the spec's kill-list has a defined replacement above:

| Titanium visual | Replacement | §  |
| --- | --- | --- |
| `.titan-dark` shell scope + forced dark on `/nap`, `/fuel/*`, `/train/*` | light-first ground, warm-graphite dark mode | §1 |
| Cold-graphite surfaces `#0B0D12` / `#13151D` / `#20222A` | `--surface-page/card` + `--mz-wash-*` | §2.2 A, §2.3 |
| Titanium dark poster hero (`nap-mai`, `fuel-mai`, `train mai`) | halo band + 46px/200 numeral (`.khero` shape) | §2.2 C, §3.2, §8.1 |
| Titanium boop dark header | warm header on `--surface-card`, "Boop" wordmark kept | §2.2 A + `mezo-ju4j6.3` |
| Titanium StartupSplash | halo-amber ground + clay logo-orb | §2.2 C, §6 |
| `.gl-*` dark glass primitive (Train GlassBox) | the Sheet's louder sibling | §7.1a |
| `.fmx-glass*` frosted box (Fuel GlassBox — **a second component**) | warm veil, no decorative frosting | §7.1b |
| Titanium clay icon material (metal + `ig-shadow`) | clay recipe, 100×100, per-object gradients | §6.1 |
| The 13 Titanium-only icons | redraw list with hue assignments | §6.2 |
| Titanium spot gradients (`sg-titanium`…) | restore the 24 `sg-*` defs | §6.3 |
| Cold nav palette + accent glow | warm-graphite nav tokens, no glow | §7.4 |
| Titanium ceremony skin | polished-stone / gold, pattern unchanged | §5 |
| `wo-` / `pl-` / `sp-` / `cer-` / `gy-` feature sections | §8 recipes + §7.3 for the workout screen | §7.3, §8 |

Anything not in this table is functionality and is kept untouched.

---

## Appendix A — the Fuel re-dress exemplar (`mezo-ju4j6.6`, Phase 5a)

Phase 5a re-dressed **Fuel · Mai** (`FuelMaiPage` + the `fmx-` families it renders:
`FuelEnergyHero`, `FuelMacroRings`, `FuelMealBlocks`, the water module and the quiet corner).
The CSS block was renamed `fuel-mai titanium` → **`fuel-mai`** in the same commit as the rules,
and registered in `prototypeCssStructure.test.ts`. **Phases 5b–5d copy the decisions below
verbatim** rather than re-deriving them; everything here is an application of §1–§8, not a new
rule. Behaviour, DOM and routes were untouched — only material moved.

### A.1 The substitution table

| Titanium material found | Restored replacement | § |
| --- | --- | --- |
| Bordered hero card (`border` + `--mz-shadow-sage` on `.fh-hero`) | **halo band**: `background: var(--halo-sage)`, no border, no shadow | §2.2 C, §8.1 |
| Glass chip (`--surface-glass` + `backdrop-filter: blur()` + drop shadow) | flat **cell chip**: `--mz-cell-<hue>-bg` / `-ink`, `border-radius: 999px`, `border: 0` | §2.2 B, §2.3 |
| Decorative sheen element (`.fmx-chip-sheen`) | `display: none` — the element stays in the DOM (the component draws it), the material does not | §2.3, §8.6 |
| `filter: drop-shadow(… )` on any clay `<svg>` | deleted — the icon's own gradients carry the volume | §6.1, §2.3 |
| `box-shadow: … rgba(0,0,0,.x)` on a card | `var(--mz-shadow)` (or the hue variant); never a raw black shadow | §2.2 A |
| Tinted card = `color-mix(tint 11%, transparent)` + `1px` tint border | **wash tile**: `linear-gradient(150deg, color-mix(tint 16%, var(--surface-card)), color-mix(tint 5%, var(--surface-page)))` + `0.5px solid rgba(43,33,24,.06)` + `--mz-shadow`, radius **22** | §2.2 A, §3.1 |
| `is-now` = brighter tint border + tint glow | **coral**: `1px solid var(--dv-coral)` + `--mz-shadow-coral` + the 2.6s now-pulse | §4.4 |
| `is-missed` = `border-style: dashed` keeping its shadow | `1.2px dashed` amber at 55%, **`box-shadow: none`** | §4.4 |
| Glass disc button (`--surface-glass` + blur) | **icon shield**: `var(--surface-1)` + `inset 0 0 0 1px var(--border-subtle)`, `border: 0` | §3.1 |
| `text-shadow`/`drop-shadow` glow on a numeral or arc | deleted; the lead number is distinguished by **colour alone** (`--ink` vs `--sub`) | §2.3 |
| `7–8px` eyebrow with `letter-spacing: 1.2px` | `9px / 800 / .16em`, uppercase, in the domain's `*-ink` | §3.2 |
| Big numeral at weight `300` | weight **200** + `font-variant-numeric: tabular-nums` | §3.2 beat 3 |
| Section `h2` at `17px/500` | `var(--ff-display) 24px/700`, `letter-spacing: -0.02em` | §3.3 |
| Infinite decorative loop (float, sheen, attention-pulse) | deleted. The **only** surviving loop is the now-pulse | §8.6, §4.4 |

### A.2 Rules of engagement learned here

1. **Domain accent before Titanium accent.** Fuel's arc and its chips were `--sky`; sage is the
   Fuel accent (§2.1). `--sky` survives only where it *means water* (the water module, the water
   ring) — a hue that carries meaning is not a skin and does not get re-hued.
2. **Never write a literal where a `--mz-*` token exists.** Every replacement above is a token,
   so dark mode follows for free — this is what makes a re-dress a one-pass job.
3. **The DOM is frozen, so kill materials, not elements.** A decorative node with no job left
   (`.fmx-chip-sheen`) is turned off in CSS; removing it from the component would be a
   behaviour change and is out of scope.
4. **A guard travels with the re-dress.** The section-registration describe added in
   `prototypeCssStructure.test.ts` also asserts the banished materials (`--surface-glass`,
   `drop-shadow`) cannot come back on that slice, and that the chips are `--mz-cell-*` pairs.
   Strip comments before scanning — the block's own prose names the materials it banished.
5. **Check 320px after a type change.** Raising an eyebrow from 7px to 9px broke a three-column
   hero at 320px; the fix is a `@media (max-width: 360px)` step-down inside the same block, not
   a retreat from §3.2.

### A.3 Phase 5b addenda (`mezo-ju4j6.7`)

Applying A.1 to the meal-detail page, the AI score page, the camera-first logger and the
glucose glass added three rows to the table and one rule:

| Titanium material found | Restored replacement | § |
| --- | --- | --- |
| A decorative radial "glow" element behind a hero (`.fmx-detail-glow`, `.fmx-score-glow`) | the **hero itself** gets the halo (`--halo-violet`, or a `--block-color` ellipse); the glow element goes `display: none` | §2.2 C |
| `border-style: dashed` kept on top of a coloured card (honest-null / degraded states) | `1.2px dashed` neutral **plus `box-shadow: none`** — an empty state does not float | §4.4 |
| A tinted disc behind an icon (`--surface-recess` + tint border + tint glow) | the **icon shield**: `var(--surface-1)` + `inset 0 0 0 1px var(--border-subtle)` | §3.1 |

6. **Separate a functional loop from a decorative one before you kill it.** Every infinite
   animation in these sub-blocks was decoration except the microphone breathe, which is the
   user's only signal that recording is live. It survives, narrowed from `.fmx-mic:not(:disabled)`
   (which also ran at idle) to `.fmx-mic.is-live`. Everything else — hero tilt, glow pulse, bowl
   and finder float — is gone, and the keyframes they orphaned (`fmx-float`, `fmx-score-tilt`)
   went with them. A re-dress that leaves dead `@keyframes` behind is not finished.

### A.4 Phase 5c addenda (`mezo-ju4j6.8`)

Applying A.1 to the Kiegészítők hub + protocol + dose setup (`fsx-`) and the Trendek weekly
picture (`ftx-`) added one table row and two rules:

| Titanium material found | Restored replacement | § |
| --- | --- | --- |
| A **dynamic**, per-item tint fed in from markup (`--fsx-band-color`, `--ftx-dim-color`…) as `color-mix(tint 12%, transparent)` + `1px` tint border + a raw black drop | the **same** wash-tile formula, written against the variable: `linear-gradient(150deg, color-mix(tint 16%, var(--surface-card)), color-mix(tint 5%, var(--surface-page)))` + `0.5px` hairline + the **neutral** `var(--mz-shadow)` (a named `--mz-shadow-<hue>` is only available where the hue is fixed at author time) | §2.2 A |

7. **A legacy hue token is not the restored accent.** Feature markup that hands a colour down
   (`face.color = 'var(--sky)'`) was still on the pre-`--dv-` palette. Moving those to
   `var(--dv-*)` is part of the re-dress, not a refactor — it is what puts the card on the
   §2.1 accent set and lets dark mode re-point it. Grep every touched page for
   `var(--sky|lav|rose|amber|sage|coral)` before calling a slice done.
8. **A.2 rule 1 cuts both ways: the same quantity wears the same hue everywhere.** The Trendek
   week bars, the daily-average tile, the weekday split row and the long-horizon intake curve
   all measure what the Mai energy arc measures — so all four moved from `--sky` to
   `--dv-sage`. What stayed: the weight series' rose (a second measure on one axis), the
   over-target amber (§4.4), and the time-of-day band vocabulary (hajnal amber · ebéd sage ·
   edzés korall · este levendula), because there the hue is the wayfinding, not the skin.

### A.5 Phase 5d addenda (`mezo-ju4j6.9`)

Applying A.1 to the Konyha family (hub, the Receptek/Kamra libraries, the two detail pages and
the Receptműhely canvas, `fkx-`) closed the Fuel domain. It added no new material — the whole
block is A.1 rows plus A.4's dynamic-tint wash — and two rules:

9. **A big title on a poster is an eyebrow plus a numeral, not a heading.** The Titanium posters
   carried a `17px/600` card title AND a tinted 50px number. The restored anatomy (§3.2) splits
   that into a `9.5px/800/.16em` uppercase eyebrow in the domain ink and ONE `display 200 / 44px`
   tabular numeral in plain `--ink`. It reads quieter and lands the number harder — and it is the
   change an owner notices first, so show it before you ship it.
10. **A door that is not a card gets a shield, not a wash.** Rows that merely lead somewhere
   (`.fkx-door`, the head actions, the search field, the filter pills) take the §3.1 shield
   material — `var(--surface-1)` + `inset 0 0 0 1px var(--border-subtle)` — while only the things
   that *carry a number or a promise* (captures, posters, tiles, the note, the two CTAs) become
   wash tiles. Washing everything flattens the page's hierarchy just as thoroughly as Titanium's
   borders did.

## Appendix B — the Nap/Mai re-dress (`mezo-ju4j6.10`, Phase 6)

The Nap landing is not a card page: it is one **orbit** — a centred presence mark with five
action nodes around it — plus the fuel instrument, Mezo's observation and the day's moments.
Geometry, routes and behaviour were untouched; three decisions are worth copying.

1. **A hero that is not a card is a halo, and a mark that is not a card is a symbol.** The orbit's
   cold lavender/sky fog became the §2.2 C halo (gold centre, lavender company), and the Titanium
   presence mark — titanium petals + gold core in front of a live WebGL scene — became the **clay
   Mezo symbol** over a need-coloured halo. The aura keeps its meaning (the first three needs,
   dimmed per band); only the material changed. That centre box is the **Boop avatar's reserved
   slot** (Phase 8b swaps the art, not the layout).
2. **A retired material can take a dependency with it.** The 3D scene was the tree's only
   `three.js` consumer, so retiring it removed the package as well (`TitanCompanion.tsx`,
   `TitanScene.tsx` and the WebGL-gate test went with it; `todayScope.test.ts` pins them out).
   A re-dress that leaves a dead 3D engine in the bundle is not finished.
3. **One quantity, one face, app-wide** (owner, 2026-09-18). The Nap fuel instrument measured the
   same three macros as Fuel · Mai but wore its own vocabulary: sky/amber/lavender arcs with
   blurred gradient "beads". It now wears the Fuel faces — `--macro-protein/carbs/fat` and the
   clay `i-hus` / `i-gabona` / `i-avokado` — so a macro looks the same wherever it appears. This
   is A.2 rule 1 read forward: if two screens measure the same thing, the hue and the symbol are
   part of the meaning, not of the skin.

### 6.4 Boop — the house character (`mezo-ju4j6.14`)

`frontend/src/shared/ui/clay/boop/boop.svg` carries one `<symbol>` per domain hue
(`boop-train` · `boop-fuel` · `boop-nap` · `boop-mezo` · `boop-en`, plus `boop-train-sky`
while the Train hue is an open owner decision). Four things make it part of this world rather
than a sticker dropped into it:

1. **Drawn in the §6.1 recipe, not imported.** `viewBox 0 0 100 100`, a 3-stop radial per
   object, ONE white specular ellipse rotated ~-22° upper-left, no stroke, no drop-shadow
   filter, a flat tinted ground ellipse instead of a glow. The `bible-strong-avatar-lab`
   (AGPL-3.0) named in the spec was an idea source only — no code and no exported art crossed
   over, so nothing in the app is a derivative work.
2. **The hue is the domain, the shape is constant.** Only the gradient ramp changes between
   variants; geometry, eyes and mouth are identical, so the five read as one character wearing
   the room's colour rather than five mascots.
3. **The gestures live in CSS, on named parts — and blinking is NOT one of them.** The handles
   are `.boop-pupil` (the gaze: a ±3-unit horizontal shift, each pupil resting at its eye's
   centre so both directions have the same room), `.boop-brow` (a -1.6 raise) and `.boop-body`
   (a ≤2% breath from the feet). All three belong inside a `prefers-reduced-motion:
   no-preference` branch — the static figure is complete on its own. A closing eyelid was
   drawn, reviewed and **rejected by the owner (2026-09-18)**: at this scale the lid read as a
   glitch rather than a blink, so the lid ellipses were deleted rather than left dormant.
   `docs/design_2.0/prototypes/boop-avatar.html` runs the surviving loop and is the reference
   8b ports.
4. **`<use>` clones share one timeline, so Boop is inlined per instance.** CSS cannot reach
   into a `<use>` shadow tree: rules match the symbol's SOURCE elements, so every instance
   would move together and none could be stilled on its own. `shared/ui/clay/boop/Boop.tsx`
   therefore inlines the symbol's markup per instance and namespaces the gradient ids with
   `useId` — without that, two Boops of different domains on one screen (the bar wears the
   current domain, the Nap centre wears lavender) would both resolve to the first definition
   and wear one colour.

**Where she appears** (`mezo-ju4j6.15`): the Nap/Mai centre (lavender, `alive`), the docked
bar's domain-switch mark and every row of the DomainSwitcher (each in ITS domain's hue, still).
Only the Nap centre moves — in navigation chrome a moving figure competes with the thing the
user came to tap. The component takes the NAV domain id (`nap` · `train` · `fuel` · `mezo` ·
`me`) rather than a symbol name, and `navModel`'s `NavDomain.id` is typed to that union: a new
domain cannot ship without a figure, which is exactly how the Én row shipped blank in the first
integration pass (`me` vs `boop-en`).


## Appendix C — the Train re-dress (`mezo-ju4j6.11`, Phase 7a)

Train · Mai (`tr-`) and the in-workout list (`wo-`) were the most literal-bound blocks in the
file: together they carried 133 hardcoded colours, nearly all of them translucent whites
(`#ffffff05`…`#ffffff40`) or dark grounds (`#0c1014` dock, `#090e13` input) drawn for the
Titanium night. On the restored light ground they were either invisible or a black strip on
cream. Three rules came out of the pass:

11. **A translucent white is not a material — it is a bet on a dark ground.** Every
   `#ffffffXX` fill became `var(--surface-1)` (or a §2.2 A wash), every `#ffffffXX` border
   became `inset 0 0 0 1px var(--border-subtle)` or the 0.5px hairline, and every light ink
   (`#e6ead9`, `#c8e895`, `#edf6dc`) became `--ink`/`--sub`/`--faint`. The block guards now
   assert no `#ffffffXX` can return.
12. **The docked bar is lit from below.** `.wo-dock` is `var(--surface-1)` with a hairline top
   border and an UPWARD lift (`0 -17px 31px -17px rgba(43,33,24,.28)`) — the §7.4 recipe. The
   Titanium version was a blurred near-black glass strip; on a cream page it read as a hole.
13. **The one big action is the house primary, not a tinted tile.** Train's start CTA, the
   finish CTA, the dock's finish and the confirm glass's „Befejezem így" all take
   `var(--gradient-cta)` + `var(--shadow-cta)`. A wash tile on top of a washed poster
   disappears; the primary is the one place the restored world still shouts.

**Owner-driven detail work in the same pass** (2026-09-19): the set row's verdict marks were a
10px text glyph (`▲`/`▼`) and an 18px disc wrapping a 14px coin — unreadable in a 22px cell. They
are now three OWN clay symbols at 24px — `i-trend-fel` (sage, up), `i-trend-le` (amber, down),
`i-erem` (gold medal, coral ribbon), drawn to the §6.1 recipe and added to the sprite. The done
row's tick was also mis-centred (its box had no grid); `.wo-check` centres now. Two records on one
set drop to 18px so the pair still fits the cell.

### C.1 Phase 7b addenda (`mezo-ju4j6.12`) — Terv + Terhelés

Three sections came off Titanium together: `terv` (`.pl-*`, the whole Terv tab — landing poster,
day list, day hero, exercise cells, muscle gauge, library, templates), `train terheles` (`.ld-*`)
and `train izomjel` (`.mm-*`). 60+ `#ffffffXX` films, four infinite spins, a brushed-metal sheen, a
breathing glow and five accent glows left with them. Four decisions are worth carrying forward:

14. **Train gets its own halo (`--halo-coral`).** The domain had none, because the Titanium era drew
   every Train hero as a dark bordered poster — the one thing §2.3 forbids outright. The new token
   sits beside `--halo-amber`/`--halo-blue` and is deliberately **deeper** than its siblings (.34
   against .30–.32): the two bands it grounds each carry one big numeral and a body figure, and a
   fainter halo left them floating. `.pl-poster`, `.pl-dhero` and `.ld-hero` all take it; the
   decorative glow/sheen/wash nodes stay in the DOM with `display: none` (A.2 rule 3).

15. **A second `animation` on a `.rise` element silently cancels the entrance.** The §4.4 now-pulse
   was the obvious treatment for „today" on the day list — and it made the tile *invisible*:
   `.rise` sets `opacity: 0` and relies on its own animation to bring it back, so a higher-specificity
   `animation` shorthand replaces it and the tile never fades in. Measured in the before/after lab.
   The „now" state therefore takes the 7a exemplar's **border ring** (`.tr-day.is-live`), not the
   pulse. Anywhere an element already carries `.rise`, add motion on a CHILD or a pseudo-element.

16. **Hierarchy comes from mixing the three grades, not from using one everywhere.** This lesson
   was general enough that it was promoted out of this appendix into the main body — see **§3.4**,
   which carries the rule, the four-step ranking and this slice as its worked example. Recorded here
   because this is where it was found, and because `mezo-ju4j6.19` (the app-wide ranking sweep)
   exists as its consequence.

17. **The rule-local lift is not a `--mz-` token.** The §2.2 A shadow formula generalised over a
   runtime hue (`--mus-color` / `--ex-color` / `--mm-color`) belongs in the rule that uses it, as
   `--tile-lift`. Naming it `--mz-shadow-mus` put it in the house namespace and tripped
   `mozaikCssTokens.test.ts`, which requires every `--mz-*` the stylesheet reads to be declared in
   BOTH `:root` blocks — correctly, since a `--mz-` name is a promise that dark mode follows.

**Owner-facing decision in the same pass:** `TrainWeekPage` wore `tone="gold"` while every accent on
it was Train coral. Changed to `tone="coral"` — the one markup edit in the slice (A.2 rule 1).

### C.2 Phase 7c addenda (`mezo-ju4j6.13`) — Gyakorlatok + sport + ceremony

The last three Titanium blocks in Train (`train gyakorlatok` `.gy-*`, `train sport` `.sp-*`,
`train ceremony` `.cer-*`) came off together. This was the **first slice to run §3.4 the way
§3.4 asks** — the ranking was named, drawn in a before/after lab and approved by the owner
*before* any CSS moved — and it is the reference for how a re-dress slice should open. Five
things are worth carrying forward:

18. **A list is not a set of heroes.** The catalogue's forty rows, the vitrine's medals and the
   ceremony's muscle rows all dropped to the **house row** (`--surface-1` + `inset 0 0 0 1px
   var(--border-subtle)`), because each screen already had a louder surface above them — the
   poster, the section head, the kcal tile. What survives of the per-item colour is a **3px
   rail** in the row's own `box-shadow` inset. A row is allowed exactly one coloured mark.
19. **One hero, then a pair.** Three equal stat cards is the flat pass wearing a different
   layout. `.gy-recs` became a 2-column grid where `:first-child` spans both — a wash tile with
   the §3.2 numeral at 44px/200 — and the two lesser records sit beside each other one grade
   down. The page now reads **1-2**; it used to read 1-1-1. With a `@media (max-width: 360px)`
   step back to one column and a 44 → 38px numeral (A.2 rule 5).
20. **A runtime-hue formula must NOT be hoisted into a shared custom property.** A custom
   property's own `var()`s are substituted **on the element that declares it**, so a
   `--tile-wash: linear-gradient(… var(--mus-color, var(--dv-coral)) …)` declared on a common
   ancestor freezes at its *fallback* hue, and every tile beneath it comes out coral regardless
   of the hue it sets on itself. Measured in the lab, where the sage minutes tile rendered
   salmon. Write the §2.2 A wash + lift formula out **per rule** — which C.1 rule 17 already
   wanted for a different reason.
21. **A colour vocabulary is not a skin when the art is identical.** The sport picker's eleven
   tiles were the one place A.5 rule 10 ("a door gets a shield") would have made things *worse*:
   every sport's `art` is the same clay ball (`sports.ts` `i-sport`), so the hue is the only
   thing that tells Foci from Úszás. They became §2.2 **B cells** — flat colour, no shadow, no
   gradient — one grade under a wash and one over a shield, with the screen's question as the
   only loud element. The eleven hues themselves moved off the Titanium neon set onto the
   restored palette (owner, 2026-09-20); eleven is more than the six `--dv-*` accents, so the
   deeper clay stops (`#4E6B42`, `#E05535`, `#9C5F33`, `#8C7F72`, `#2E6E96`) fill the rest.
22. **A selector with no consumer is a page with no style.** `.sp-foot`'s „Naplózom" CTA was
   reached by neither `.gl-card .wo-close-cta` nor `.cer-cta .wo-close-cta`, so once Phase 2
   stripped the dark scope it rendered as a **bare unstyled button** — and nothing caught it,
   because every guard asked what the CSS *says*, not what the page *gets*. It is the third arm
   of that rule now. When a slice inherits a scoped rule, grep every consumer of the class for
   ancestors the scope does not cover.

**The ceremony's material, restored.** §5 in full: a `--mz-tone-gold → --canvas` ground, the
`--halo-amber` band behind the hero, the Ritmus stone bar **unchanged** (it was already the right
material) minus its two neon glows, counters demoted to icon-shield + numeral, and the kcal tile
in **sage** — it is Fuel's number, and A.2 rule 1 says the same quantity wears the same hue
everywhere. The two ceremonies in the app (`fuel-ceremony` `.fcx-*` and this one) are now
deliberately one material.

**Open, not this slice's:** the gym close ceremony still cannot be driven to its end in mock
(`mezo-p30l2`), so only the *sport* ceremony was verified live; and all eleven sports share one
clay ball for art, which is why the hue has to work as hard as it does (`mezo-ju4j6.16` territory).

---

### C.3 Jutalomoldalak addenda (`mezo-p2777`, 2026-09-22) — the reward family

The owner asked for the Titanium ceremony's *composition* back, in this world's material. Three
rules came out of it, and they override §5 where they disagree:

23. **The stone is the §5 radial, everywhere.** C.2 kept the Titanium 4-stop linear
   (`#FFF0C8 → #AF9371 → #322A29 → #DBC4A0`) as "already the right material"; on the restored light
   ground its dark band read as a dirty stripe. Both ceremonies now use
   `radial-gradient(85% 160% at 36% 30%, #FFE9A8 0%, #E0AC2F 55%, #A9770F 100%)` (the meal ring as
   an SVG `radialGradient` with the same stops) — stone and clay star are one material.
24. **A reward has one hero, and it may be the graphic alone.** §5's "Numeral 56–64px" does NOT
   apply to the workout ceremony: the owner ruled the stars themselves are the reward. Every other
   number moves into ONE card below the verdict; the record is that card's only gold wash.
25. **Weight follows frequency.** A ceremony that fires several times a day (meal log) is the
   *small* moment — a sheet over the day, ~1 s, one beat; the full multi-beat stage is for rare,
   earned closes (workout). Same stone, same stars, same CTA pair: one family.

## Appendix D — the depth & focus sweep (`mezo-ju4j6.19`)

The §3.4 retro-fit across every screen re-dressed **before** §3.4 existed. No new materials, no
DOM change: each screen's surfaces were re-ranked inside the existing three grades. What it
settled, screen by screen — and, just as usefully, what it deliberately left alone.

| Screen | The ONE thing it says (stays loud) | Demoted, and to what |
| --- | --- | --- |
| Fuel · étkezés-értékelés | the score, on its halo | the six dimension tiles → §2.2 **B cells** |
| Fuel · Kiegészítők | the ring + KÖVETKEZIK | the four time bands → **house rows**; the wash returns on the one band that is *due* |
| Fuel · Trendek | the week picture (halo + day bars) | the three glance tiles → **cells**; the weekday/weekend rows and the day-glass dimension rows → **house rows** |
| Fuel · Konyha | the Receptműhely | the two captures → **shields**; Receptek + Kamra → **house cards** (their numerals stay) |
| Train · in-workout list | the work still ahead | `.wo-card.is-complete` → **house card**, its progression banner with it |
| Train · progression banner | — | `.pobanner` → §2.2 **B cell** everywhere (it lives *inside* a wash tile) |
| Shell · DomainSwitcher | where you are standing now | the other four domains → **house rows** |

Four rules came out of it:

23. **The hierarchy can be a state, not a place.** The in-workout list has no privileged
   exercise — every card carries its own cursor — so there was nothing to promote. The axis
   that *does* exist is **time**: work still ahead keeps the wash, finished work drops a grade.
   The page then re-ranks itself as the session goes, and what stays loud is always what is
   left to do. Same move on Fuel · Kiegészítők, where the wash marks the band that is *due*.
   When a screen has no hero, look for the state that separates its items and rank by that.
24. **A wash tile inside a wash tile makes both disappear.** `.pobanner` sat bordered and
   tinted on top of `.wo-card`'s wash. Anything nested inside a §2.2 A surface is a **cell** or
   a **shield** — never a second washed, bordered box. (§3.4 says this about screens; it is
   just as true about one card.)
25. **Re-ranking edits the guard that froze the old ranking.** Two slice guards asserted the
   flat pass as a *requirement* — 5c pinned `.fsx-band.is-due`'s exact one-line rule, and 5d
   demanded that every Konyha tile carry a `--mz-shadow-*` lift. A ranking sweep must rewrite
   those in the same commit, or a guard written before the rule outranks the rule. Both now
   assert the *ranking* (one lifted tile, the rest below it) instead of the uniformity.
26. **An explicit owner decision outranks the sweep — say so, don't silently reverse it.**
   Fuel · Mai's meal blocks are five wash tiles, and the `fuel-mai` block records *why*: the
   owner rejected an earlier pass for not separating them ("saját mosás, saját árnyék, 16px
   hézag"). The screen already has three grades on it (halo hero → washed blocks → shield
   door), so it was left as it is. The sweep reports that; it does not overrule it.

**Also fixed in passing** (A.2 rule 5, found by the 320px check the sweep mandates): Fuel ·
Kiegészítők' hero put a 112px ring and the KÖVETKEZIK row side by side, which crushed the
product name onto three lines at 320px. They stack there now, the ring keeping its real size.

**Left for `mezo-ju4j6.16`:** `ProgressionBanner` still writes a literal „⚡" into its label
(§2.3: no emoji, ever), and the level-up overlay is still full of them. Both are DOM edits, and
this task is a CSS ranking sweep.

---

## Appendix E — the quick-log surface (`mezo-reocc`, 2026-09-21)

The last Titanium screen outside the programme: `/nap/gyors` and the FAB sheet (one
`QuickLogSurface`), plus the shell and header of every capture sheet it opens. Lab:
`prototypes/redress/2026-09-21-gyors-logolas-before-after.html`.

27. **The ranking the bible predicts is not always the one the owner buys — and his wins.** The
   §3.4 / A.5 rule 10 pass demoted the nine equal doors to house shields under one loud
   `--gradient-cta` row. The owner rejected it in the lab: "not 3D enough", and he wanted the
   colours of the Titanium version back. The tiles are therefore **coloured, raised §2.2 A wash
   tiles in their own hue** — one step deeper than the stock `--mz-wash-*` (30% / 9% `color-mix`),
   a hue-tinted lift, the white inset top edge and a faint hue-tinted lower edge. What keeps the
   screen ranked is that the loud element is a *different grade entirely* (the CTA primary), so
   nine washes under it still read as a set of doors, not nine heroes. Record the decision in the
   CSS block, per Appendix D rule 26.
28. **A retired art family is retired at its component, not at each consumer.** The metal
   `CaptureSculpture` had three consumers (the grid, `CaptureHeader` → seven sheets, the check-in
   orbit). It became `CaptureArt`, a kind → clay-symbol map over `ClayIcon`, so every capture
   header flipped in one edit and a tile and the sheet it opens now wear the same mark.
29. **Mezo's row wears Mezo.** The chat entry sits on the coral primary, where the clay `i-mezo`
   orb disappeared; Boop (`domain="mezo"`, still) in a light 50px icon shield keeps her lavender
   readable on the coral.
30. **Titles only** (owner, 2026-09-21): the live sublines on the tiles were removed. That is a
   content decision, not a skin one — it was his call, and the unit suite now asserts the
   accessible name is exactly the label, so a subline cannot creep back unnoticed.

### E.1 The capture-sheet bodies (`mezo-luik9`)

The seven sheets the grid opens (water, weight, sleep, sport, journal, activity, check-in).
Owner-approved from real before/after screenshots
(`prototypes/redress/2026-09-21-rogzito-lapok-before-after.html`).

31. **One loud value per sheet, the same primary on every sheet.** What the user is logging (ml ·
   kg · hours · the check-in number) is the hero: a §2.2 A wash in the sheet's `--capture-accent`
   with the numeral at 64px/200 (`.capture-hero`, the water hero, and the check-in orbit as a
   §2.2 C halo in the step's own hue). Mentés is `--gradient-cta` everywhere — the Titanium
   per-accent tinted CTA made the primary a different colour on each sheet. Sheets with no single
   number (sport, journal, activity) have no hero: the CTA is their loud element.
32. **Scales are cells, and state is a data attribute.** Three sheets drew their 1–10 scales with
   inline styles (a runtime hue, `clipPath` corners, glows), which no stylesheet could reach. They
   now render `.capture-scale-cell` with the hue as an inline `--cell-hue` and the state as
   `data-state="filled|active"`: recess → the hue's cell tint → the hue solid, no border, no
   shadow. A runtime colour belongs in a custom property on the element, never in a style literal.
33. **Inside the hero, a field is a shield.** The sleep hero's time selects carried the shared
   `TimePicker` inline beige; inside a wash they become house shields (App. D rule 24). The
   `!important` is scoped to `.capture-hero select` because the inline style is shared with the Én
   sleep page, which this slice does not touch.
34. **When a surface is mostly inline styles, the lab is real screenshots.** Cloning seven sheets'
   inline-styled markup into a `<template>` would not have been "the same markup" in any honest
   sense. A throwaway Playwright spec under `tests/layout` (seeds + dev server for free) shot every
   sheet on `main` and again on the branch, light and dark; the owner judged those before merge.
