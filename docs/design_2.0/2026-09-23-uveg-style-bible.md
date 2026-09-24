# Üveg style bible: Mozaik colors on warm-dark glass

**Date:** 2026-09-23 · **Status:** canon · **Epic:** `mezo-me75u` (`bd list --label epic:uvegesites`)
**Session driver:** the `/uvegesites` skill (`.claude/skills/uvegesites/SKILL.md`)
**Reference prototype (owner-approved 2026-09-23):** [`prototypes/fuel-uveg.html`](prototypes/fuel-uveg.html),
**Sötét** switch. Fuel · Mai, meal detail and meal-score detail.

> **Direction change, 2026-09-23 (owner decision).** The restored Mozaik/Clay world
> ([2026-09-17 bible](2026-09-17-restored-world-style-bible.md)) reads flat to the owner. He
> preferred the Titanium *material*: the 3D icons, glass cards with a colored gradient frame,
> the light sweep, the soft color glow around cards. He did not want Titanium's *palette*, the
> cold graphite and the neon nav accents. The new direction combines the two:
>
> - **Material** comes from Titanium: glass, gradient frame, sheen, glow, 3D icon set.
> - **Colors** come from Mozaik: the `--dv-*` domain accents and the `--macro-*` band.
> - **Ground** is the app's own **warm graphite dark** (`#191614`), the "Pulse" dark tokens in
>   `prototype.css`. Never Titanium's cold `#0B0D12`.
> - **Dark only.** The app is locked to dark. Light mode is **parked, not deleted**: its CSS
>   stays in place so it can return later. Nobody designs or verifies light until the owner
>   asks for it back.
> - **Header and bottom menu keep their content** (the "boop" wordmark, ?, settings, messages,
>   notifications, the filling day orb; the fixed TabBar with the living Boop and the domain
>   switcher), and **wear glass** (§7). There is no day-part switcher.
>
> The 2026-09-17 bible remains canon for **everything this document does not override**: card
> anatomy (§3), the §3.4 ranking rule, data-as-graphics (§4), ceremony *pattern*, and the
> Appendix A–E slice lessons. Where the two conflict (§2.3 "forbidden": `backdrop-filter`,
> icon `drop-shadow` halos, glows), **this document wins.**

---

## 1. Ground

| Token | Value | Use |
| --- | --- | --- |
| `--page` / `--surface-page` | `#191614` | the app canvas |
| `--surface-card` | `#221E1B` | solid fallback under glass |
| `--surface-elevated` | `#2A2521` | sheets, the device-frame ring |
| `--text-primary` | `#F5EFE6` | ink |
| `--text-secondary` | `#B7A899` | sub copy |
| `--text-muted` | `#8A7A6A` | eyebrows, units, hints |
| `--divider` | `rgba(245,239,230,.08)` | hairlines |

These are the existing dark "Pulse" values in `prototype.css`. **Write the token, never the
literal.**

**Aurora.** The glass needs something behind it to refract, otherwise it reads as a flat grey
box. Each page shell carries 3–4 large, blurred color blobs (`filter: blur(60px)`,
`opacity: .22`) in the domain's hues: sage `#5E8A67`, amber `#C98A3A`, lavender `#6D5FA8`,
coral `#B8584A`. They are fixed decoration: no motion and no interaction.

## 2. Palette

Unchanged Mozaik accents, in their **dark-mode values**:

| Role | Token | Dark value |
| --- | --- | --- |
| Fuel | `--dv-sage` | `#8FB49A` |
| Train | `--dv-coral` | `#FF7E5C` |
| Nap / reward | `--dv-amber` | `#FFBE60` |
| Mezo / Boop / AI score | `--dv-lav` | `#AB9FD2` |
| Én / sport | `--dv-rose` | `#E98D9D` |
| Water / time | `--dv-sky` | `#7FB2DE` |
| Protein · carb · fat · fiber | `--macro-*` | `#F07E78` · `#E3A45A` · `#D8B640` · `#86BC63` |

Every glass surface takes **one** accent through a single custom property, `--c`. The frame,
glow, inner shade, icon halo and numeral tint all derive from it. A card never mixes two
accents.

## 3. The glass card: the one material

```css
.glass {
  --c: var(--dv-sage);
  position: relative; isolation: isolate; overflow: hidden;
  border-radius: 22px;                       /* 17–22; rows 17–20; chips 999px */
  background:
    radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--c) 22%, transparent), transparent 62%),
    linear-gradient(160deg, rgba(52,46,41,.72), rgba(30,27,24,.60));
  backdrop-filter: blur(16px) saturate(1.5);
  box-shadow:
    0 16px 30px -16px rgba(0,0,0,.75),                                  /* lift */
    0 0 26px -6px color-mix(in srgb, var(--c) 30%, transparent),        /* color glow */
    inset 0 1px 0 rgba(255,244,230,.10),                                /* top edge light */
    inset 0 -14px 26px -18px color-mix(in srgb, var(--c) 55%, transparent); /* inner floor */
}
/* gradient hairline frame: accent → faint light → accent */
.glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.3px;
  pointer-events: none; z-index: 2;
  background: linear-gradient(145deg,
    color-mix(in srgb, var(--c) 80%, transparent) 0%,
    rgba(255,244,230,.16) 30%,
    color-mix(in srgb, var(--c) 18%, transparent) 62%,
    color-mix(in srgb, var(--c) 60%, transparent) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
/* the sheen: a skewed light band that sweeps across every ~7s */
.glass::after {
  content: ''; position: absolute; top: -20%; bottom: -20%; left: -40%; width: 28%;
  pointer-events: none; z-index: 3; opacity: 0;
  transform: skewX(-20deg) translateX(-120%);
  background: linear-gradient(90deg, transparent, rgba(255,244,230,.16), transparent);
}
```

The four layers are the signature. When a card "doesn't look right", check them in this order:
**frame → glow → top edge → sheen.**

**Ranking still applies (2026-09-17 bible §3.4).** Glass is loud only next to something that
isn't glass. Per screen:

1. **Hero:** no card. A frameless radial halo in the accent (see §5), big numeral, big 3D icon.
2. **Primary objects** (meal blocks, score tiles, ingredient rows): `.glass`.
3. **Secondary** (chips, tags, pills inside a card): a flat `rgba(245,239,230,.05)` fill with a
   hairline. **Never glass inside glass.**
4. **Empty/free states:** a dashed accent outline (`1.5px dashed` at 45% `--c`) with no glass
   and no glow.

## 4. Icons: the Titanium 3D set

The icon set is **the Titanium companion sprite**: 62 symbols in
`prototypes/companion-titanium/nap.html` (`<symbol id="i-…">`), with its gradient `<defs>`
(`titanium`, `blue`, `gold`, `purple`, `lime`, `red`, `avo`) and the `#shadow` filter
(`flood-opacity .5`, black). On the dark ground they are used **verbatim**: original metal
stops and original shadow.

- **Custom icons are expected, not a fallback.** The 62-symbol sprite does not cover the app.
  Every slice designs the icons its screens need, shows them on the prototype's "Új ikonok"
  sheet, and adds them to the shared sprite after the owner's OK.
- A glyph the app needs that the sprite lacks is drawn **in the same recipe**: 64×64 viewBox,
  gradient-filled body, a light 0.6–1px stroke in a pale tint of the fill, highlight strokes at
  0.7–0.85 opacity, wrapped in `<g filter="url(#shadow)">`. It is added to the shared sprite,
  never inlined into a page.
- Inside a glass card an icon also gets a halo:
  `filter: drop-shadow(0 6px 7px rgba(0,0,0,.55)) drop-shadow(0 0 10px color-mix(in srgb, var(--c) 40%, transparent))`.
- Hero art is **big**: 74–112px. Row art sits in a 52px lit "well"
  (`radial-gradient(circle at 35% 28%, #3A332D, color-mix(--c 14%, #1E1B18))`).
- **Still no emoji.** Every glyph is a sprite symbol.
- The sprite must be hidden with `position:absolute;width:0;height:0`, **never
  `display:none`**, or its gradients never resolve (visszaöltöztetés trap).

## 5. Data as graphics: the dark-glass treatments

| Element | Recipe |
| --- | --- |
| **Hero halo** | `radial-gradient(ellipse at 50% 40%, <accent> .26–.36 alpha, <second accent> .10–.16, transparent 66%)` behind the hero, with no box |
| **Big numeral** | Geist 300, `letter-spacing: -2.4px … -5px`. A score/reward numeral is gradient text (lavender → pale lavender → warm gold) with a breathing `drop-shadow` glow |
| **Ring / gauge** | track `rgba(245,239,230,.07)`, progress `stroke: var(--c)`, round caps, `filter: drop-shadow(0 0 5px color-mix(--c 55%))`. The ring's svg needs `overflow: visible` or the glow clips to a square. Macro rings sit on a lit inner disc |
| **Bar** | 5–6px, track `rgba(245,239,230,.07)`, fill `linear-gradient(90deg, color-mix(--c 55% #fff), --c)` with a `0 0 8px` accent glow |
| **Time window** | a recessed track, the window as an accent-tinted band with an inset accent hairline, and the "now" knob as a lit orb with a `0 0 14px` accent glow |
| **Eyebrow** | 9.5–10px, weight 600, `letter-spacing: 1.2–1.6px`, `--text-muted` |
| **Voice copy** | Fraunces italic (`--ff-serif`) for Mezo's own sentences ("Mezo jegyzete", score lead) |

## 6. Motion

All motion sits inside `@media (prefers-reduced-motion: no-preference)`. The reduced branch
shows the final state immediately.

| Motion | Spec |
| --- | --- |
| Entrance | `rise`: `opacity 0 → 1`, `translateY(14px) → 0`, `.7s cubic-bezier(.2,.78,.24,1)`, staggered 70ms per item (`--i`) |
| Rings | `stroke-dasharray 0 → value`, 1.1s, staggered 80ms. Bars grow `width 0 → value`, 1s |
| Sheen | `.glass::after` sweeps every 7s, staggered .45s per card so cards never flash in unison |
| Float | hero icons drift ±3px / ±2° over 5s |
| Glow | the score/reward numeral's `drop-shadow` breathes over 5s |
| FAB | a 3s breathing accent glow |

One-shot choreography is rAF-driven in the app (`shared/ui/mozaik/motion.tsx`). The CSS
keyframes above describe the *look*; reuse the kit's arrival and motion primitives rather than
new timers.

## 7. App chrome: same content, glass material (owner-approved 2026-09-23)

The header and the bottom menu keep **exactly the content and behavior they ship with today**.
Only their material changes to glass. The reference is the chrome in
[`prototypes/fuel-uveg.html`](prototypes/fuel-uveg.html), approved by the owner on 2026-09-23.

### 7.1 Header (`app/AppHeader.tsx`)

| Element | Keep | Glass treatment |
| --- | --- | --- |
| **"boop" wordmark** (left) | text, position | gradient text (ink → pale lavender → warm gold) with a soft lavender `drop-shadow` |
| **? (Kalauz)** | shown only when the page has a kalauz, plus the gold "unseen" dot | 40px round `.glass` button, `--c` amber, `?` glyph in pale gold |
| **Settings (gear)** | route + return state | 40px round `.glass`, neutral `--c` |
| **Messages** | route, unread badge | 40px round `.glass`, `--c` lavender |
| **Notifications (bell)** | the panel (filter chips, day groups, 30-row cap, mark-all-read) | 40px round `.glass`, `--c` sky, `is-open` state. The **panel** is a `.glass` card under the header: chips as flat cells (the active one filled sky with a glow), rows as flat `rgba(245,239,230,.04)` cells, unread rows marked by a 2px sky inset edge |
| **Day orb ("töltődő kör")** | fill % = today's recorded signals, intensity, and the tap going to today's day page | a 46px `.glass` sphere holding a **coral liquid** clipped to the circle, rising from the bottom to `pct`, with a slow horizontal wave (3.2s, reduced-motion: still) and a `0 0 6px` coral glow, plus a white highlight arc top-left |

- **Badges** sit *outside* the button. Round header buttons therefore set
  `overflow: visible` and **drop the sheen** (`::after` off), or the badge clips to a quarter
  circle. Badge: coral gradient pill, `0 0 10px` coral glow, `0 0 0 2px var(--page)` ring.
- Existing clay icons (`i-beallitas`, `i-level`, `i-ertesites`) stay in the header. **Chrome
  keeps the live clay icons; content uses the Titanium 3D set (§4).**
- **There is no day-part switcher.** The "Napközben ⌄" pill in the first prototype draft was
  obsolete and is gone. Never add one.
- The condensed-on-scroll behavior (`useCondensedHeader`) and `HeaderAurora` stay. The
  aurora may be retuned to the §1 dark aurora hues.

### 7.2 Bottom menu (`app/TabBar.tsx` + `DomainSwitcher`)

> **Decided by comparison, 2026-09-23.** The owner looked at both versions side by side: the
> live docked bar kept as it is, and this glass version. He **chose the glass version**. Do not
> offer the docked bar again.

- **Fixed** at the bottom, floating 10–12px off the edges, as **one `.glass` bar**
  (`--c` = the active domain accent, radius 28px).
- **No sheen on the bar** (owner, 2026-09-23). The periodic light sweep (`.glass::after`) is
  switched off on the TabBar. A sweep passing through the always-visible menu reads as random
  flicker. The frame, glow and top edge stay.
- **Left: the living Boop** of the active domain (`<Boop alive>`, blink/look/brow/breathe), about
  44px, inside a lit 62×58 well with a domain-accent halo, separated from the tabs by a hairline.
  Tapping it opens the **domain switcher**.
- **Tabs:** the live `navModel` tabs, in their order, with their clay icons and labels.
  Inactive tabs are dimmed (`grayscale(.45) brightness(.8)`). The **active** tab gets a soft
  radial accent wash, a 1px accent inset ring and an outer accent glow, and its icon gets a halo.
- **Domain switcher:** a `.glass` card above the bar with the "TERÜLETVÁLTÓ" eyebrow and all five
  living Boops (Nap, Edzés, Fuel, Mezo, Én), each tinted by its domain. The current domain is
  shown lit (radial wash + inset ring).
- The **FAB (+)** stays where it is, as a lavender `.glass` rounded square with the breathing glow.

### 7.3 What stays exactly as it is

- **Behavior.** Every slice is visual only. A changed route, hook, contract, mutation or state
  machine is out of scope. Stop and ask the owner.
- **The chrome's content** (§7.1–7.2): which buttons exist, their order, badges, the panel's
  logic, the nav model, and the Boop character art (`shared/ui/clay/boop`).
- **Light mode CSS.** It is parked, not deleted.

## 8. Dark-only lock

The app resolves to dark regardless of stored preference or circadian `auto`. The theme choice
is hidden from settings (the code path is kept so light can return). `index.html`,
`manifest` and `theme.ts` `THEME_COLOR` all agree on `#191614`. The foundation slice owns this
change. Every later slice verifies **dark only**.

## Appendix: slice lessons

*(Each `/uvegesites` slice appends its lessons here as numbered rules, the way the
2026-09-17 bible's Appendices A–E grew. Start numbering at U1.)*

### U1 · Alap + Fuel mag (`mezo-me75u.1`, 2026-09-23)

The kit lives at the END of `prototype.css` (`── uveg kit (`, `── uveg chrome (`). What the first
slice paid for:

1. **`.glass` wins ties it was never meant to win.** It comes last, so at equal specificity it
   overrides `position`, `overflow`, `background` and `box-shadow` of earlier rules. The FAB lost
   `position: absolute` to `.glass { position: relative }`; restate geometry in a
   `.<thing>.glass` rule of the slice's block.
2. **`.glass > *` makes every child `position: relative; z-index: 1`.** An absolutely placed
   child (a badge, a dot) must restate `position: absolute` in a rule that outranks it, or it
   drops into the flow (the header badges did).
3. **`.glass` clips (`overflow: hidden`).** A glass surface that scrolls (the Fuel glass boxes)
   or lets something stick out (the time box's stopwatch, round buttons with badges) must say so
   on `.<thing>.glass`, and turn the sheen off where it would clip oddly.
4. **Publish the hue on the element that wears the glass.** `--c: var(--block-color)` works only
   when `--block-color` is set on that same element. The Fuel rings set `--macro-color` on an
   inner child, so the glass tile around them saw nothing; the TSX now sets it on the tile too.
5. **Never glass in glass, even when a prototype draws it.** `fuel-uveg.html` has a
   `.score.glass` pill inside a `.block.glass`; the build makes it a flat lavender-lit pill. Same
   for the glucose spark, tags and callouts inside a glass box.
6. **Empty is dashed, not glass.** A meal block with nothing logged is free space
   (`.fmx-block.is-open`); an unknown tile, micro card or degraded dimension is dashed, with the
   glass layers (`::before`, `::after`, `backdrop-filter`) switched off explicitly.
7. **Icons: map meanings, not glyphs.** `CLAY_TO_3D` holds only context-free meanings. A clay
   glyph that means two things (the flask = "becslés" source AND the fat-quality dimension;
   `i-termes` = raw-material share AND honey) gets a `t-*` name at its call site. Unmapped clay
   names fall back to clay, so a half-migrated surface never breaks.
8. **320px is the chrome's hardest width.** The wordmark and five round controls overlap unless
   they shrink at ≤360px; a row with rings + two chips must wrap the chips as ONE group
   (`.fmx-meal-chips`), or the second chip wraps alone to the left.
9. **A floating bar changes what "reachable" means.** A card can sit inside the scroller's
   viewport yet under the glass bar, so `scrollIntoViewIfNeeded` does nothing. Layout specs lift
   the card above the bar's top instead (tests/layout/layout.spec.ts).
10. **The dark lock is the theme provider's, not the pages'.** `ThemeProvider` takes `lock`
    (default `THEME_LOCK`); tests of the parked light/auto/claim machinery pass `lock={null}`, and
    any spec that seeded a light preference now expects dark.

### U2 · Fuel többi (`mezo-me75u.2`, 2026-09-23)

Each surface got its own block at the end of `prototype.css` (`── uveg fuel konyha|receptek|log|
stack|trendek (`), so five builders could work in parallel without touching each other's rules.

11. **Old house rules outrank `.glass` too, not only earlier kit-less ones.** Sub-head buttons,
    CTA rules, empty-state buttons and save bars kept their own `background`/`box-shadow` at a
    higher specificity. Restate the glass body and shadow on `.<scope> .x.glass` inside the slice's
    block, or the element keeps its old skin under a glass frame.
12. **The kit halo is 340px; a 320px screen is not.** A `.uv-halo` hero scrolls the page sideways
    at 320px. Clip it with `overflow-x: clip` on the hero (never `hidden` on the scroller, which
    kills sticky children).
13. **Scope the rules, because the old classes are shared.** `fkx-*`, `logflow-*` and `fkp-*` are
    used by more than one surface (Kamra and Receptek; the composer and the Műhely). Scope overrides
    to the page root (`.fkx-kamra`, `.logflow-composer`), or one surface's re-dress repaints another.
14. **Header chip rows must be able to shrink.** The layout spec swaps every ≥10-char label for a
    long name; a `flex: 0 0 auto` / `white-space: nowrap` chip row then pushes the page 300px wide.
    Chip rows wrap, chips carry `min-width: 0` + ellipsis.
15. **Sheets float.** Every U2 sheet sits 10px off the left, right and bottom edges with a 30px
    radius on all corners (the prototype `.sheet`); buttons inside a glass sheet are lit flat pills,
    not glass (rule 5).
16. **Test the meaning, not the emoji.** Tests that matched `'kamra ✨'`, `★` or `✓/⚠` now assert
    the accessible text or a data hook (`data-ai`, a marker role). Swap the assertion, never delete it.

### U3 · Nap (`mezo-me75u.3`, 2026-09-23)

Five parallel builders again (`── uveg nap mai|oldalak|rogzites|uzenetek|napzaras (`), plus 11 new
sprite icons (`t-checkin t-quick t-steps t-people t-chain t-quest t-harvest t-coin t-orb t-flask
t-scroll`). Prototype: [`prototypes/uveg-nap.html`](prototypes/uveg-nap.html).

17. **Plant every builder's block marker BEFORE dispatch, and edit only between the anchors.** The
    controller committed five empty `── uveg nap <area> (` / `── /uveg nap <area> ──` pairs first. Two
    builders still rewrote the whole of `prototype.css` in one read-modify-write; nothing was lost
    this time, but a whole-file save during another builder's edit silently drops it. Diff every
    block at integration.
18. **Sweep for dead code before you re-dress.** Island, DailyQuestsCard, ActivityLogCard and
    MezoMessagesSheet had no importer; restyling them would have been wasted work, and their emoji
    looked like live bugs. Grep importers up to a route first and hand builders only live files.
19. **A text glyph is an icon too.** `✓ ✕ ·` marks (check-in, rutin, küldetés, ritual loops,
    observation tallies) become `t-tick` / `t-skip` / a flat dot, and the meaning moves to an
    accessible name (`kész`, `bejött`) that tests assert (rule 16). Typographic arrows (`‹ › ↗`)
    stay.
20. **One clay glyph, three meanings on one screen: map at the call site.** `i-kristaly` is the
    Gyors-logolás node (`t-quick`), a forecast in the notification panel (`t-orb`) and the AI score
    (`t-score`); `i-sport` is Aktivitás (`t-steps`) and the Sport tile (`t-volley`). Only
    context-free meanings go into `CLAY_TO_3D`.
21. **A shared frame that takes no class is not a reason to reskin it for everyone.** `PageHead` /
    `PageHero` (shared/ui/mozaik) serve Én, Train and Fuel too, so the Nap pages render their own glass
    back pill and halo hero (`.nap-back`, `.nap-hero`). The next slice that meets them should extend
    the kit (a `className` / `variant` prop) instead of copying the markup a third time.
22. **`build.sh` rebuilds every prototype.** Running it whole rewrites ~36 older files against the
    current sprite. Run only your slice's line.

### A napom (`mezo-yjzhw`, 2026-09-24)

The live day page (`features/today/pages/NapomPage.tsx`, `/nap/napom[/:date]`) replaced
`WeekDayPage` and reworked §5's "Voice copy" row and the tab-dot chrome.

23. **No italic serif for paragraph prose (owner, 2026-09-24).** §5's "Voice copy" row
    (Fraunces italic for "Mezo's own sentences") **now applies to one-liners only** — a lead,
    a score subline, a chip label. It is unreadable at paragraph length. The closed-day review
    card's narrative, dimension notes and reading sentence are upright Geist instead: 15px/1.6
    for the narrative, 14px/1.55 for notes (`NapomReviewCard.tsx:3`). Any future multi-sentence
    Mezo prose follows the same rule; only the short lead lines keep the serif italic.
24. **A live page's "friss" state comes from `dataUpdatedAt`, never from a clock.** Today's
    "ÉLŐ · FRISSÜLT hh:mm" status line reads the query's own `dataUpdatedAt`
    (`NapomPage.tsx:165`, `dayEvaluationHooks.ts:43,65`), not `Date.now()` or a tick timer — the
    same value the 60 s poll and the mutation-cache invalidation both bump on a real change, so
    the displayed timestamp always matches the data actually on screen, including right after an
    optimistic write.
25. **A tab dot sits outside the icon with a `0 0 0 2px var(--page)` ring, like the header
    badges.** The morning-mode dot on the "A napom" tab (`tb-dot`, `prototype.css:18864`) is
    absolutely positioned at the icon's top-right corner (outside its box, `top:-2px;
    right:-5px`), lavender-filled with a lavender glow, and rung with `0 0 0 2px var(--canvas)`
    (the app's `--canvas` alias for `--page`, `prototype.css:824`) — the same silhouette-cutting
    trick §7.1's header badges use so the dot reads as sitting on top of the icon rather than
    stuck to it. It is `aria-hidden`; its meaning is carried by an `sr-only` description on the
    tab link, not by the dot itself (`TabBar.tsx:68-88`).
