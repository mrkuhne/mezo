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
| `--text-secondary` | `#D8CEC2` | sub copy (lifted 2026-09-26, `mezo-nn7h0`) |
| `--text-muted` | `#AFA294` | eyebrows, units, hints (lifted 2026-09-26) |
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
    (`NapomPage.tsx:190`, `dayEvaluationHooks.ts:43,65`), not `Date.now()` or a tick timer — the
    same value the 60 s poll and the mutation-cache invalidation both bump on a real change, so
    the displayed timestamp always matches the data actually on screen, including right after an
    optimistic write.
25. **A tab dot sits outside the icon with a `0 0 0 2px var(--page)` ring, like the header
    badges.** The morning-mode dot on the "A napom" tab (`tb-dot`, `prototype.css:18915`) is
    absolutely positioned at the icon's top-right corner (outside its box, `top:-2px;
    right:-5px`), lavender-filled with a lavender glow, and rung with `0 0 0 2px var(--canvas)`
    (the app's `--canvas` alias for `--page`, `prototype.css:824`) — the same silhouette-cutting
    trick §7.1's header badges use so the dot reads as sitting on top of the icon rather than
    stuck to it. It is `aria-hidden`; its meaning is carried by an `sr-only` description on the
    tab link, not by the dot itself (`TabBar.tsx:68-88`).

### U4 · Edzés I (`mezo-me75u.4`, 2026-09-24)

Six parallel builders (`── uveg edzes mai|session|zaras|terheles|sport|gyakorlatok (`), two new sprite
icons (`t-muscle`, `t-bandage`). Prototype: [`prototypes/uveg-edzes.html`](prototypes/uveg-edzes.html).
The workout-closing ceremony moved here from U10 at the owner's request.

26. **The page frame has its üveg variant now: use it.** `<PageHead glass label="…">` is the glass back
    pill, `<PageHero art="t-…" accent="var(--dv-…)">` the frameless halo hero (U3 rule 21, done). A slice
    that meets `PageHead`/`PageHero` switches the prop instead of copying markup.
27. **`GlassBox` takes no className.** The session builder dressed its dialogs with
    `.gl-card:has(> .wos-gb.glass)` and an absolutely placed header; that works but is fragile. The next
    slice that re-dresses a GlassBox should add a glass variant prop to the kit first (bead filed).
28. **The owner reads chips, not captions.** Record and challenge rows went through four rounds: the
    settled shape is *name*, then ONE wrapping chip line — a framed type chip with its 3D icon, then the
    values as lit pills ("105 kg", "10 ism."; no "×", "@" or "előző") — and an outcome is a round icon at
    the row's top-right, never a word. Reuse this shape for any record/outcome list.
29. **A destructive action keeps its warning tone.** A builder lit the futóterv "Lezárás" as the page's
    primary; closing a block ends it, so it stays the flat coral outline. Only constructive CTAs get lit.
30. **Keep the old icon field when an untouched surface still reads it.** `logic/sports.ts` gained
    `art3d` beside `art` so the sport picker wears 3D icons while `SportCeremony` (U10) keeps its clay art.
31. **The glass-in-glass guard regex also fires on sibling combinators.** `.glass + .x.glass` is not
    nesting, but `/\.glass [^{,]*\.glass/` catches it; write sibling spacing on non-glass class names.
32. **In the in-app browser a screenshot round trip throttles rAF.** The ceremony looked frozen after
    4 s; its classes (`is-b1..b3 is-told`) were already set. Check the DOM before calling a pass broken.
33. **Prototype anatomy: measure, don't trust `BODY.b`.** The generated boxes in
    `companion-titanium/body-geometry.js` are wrong for thin shapes (height 3), so a prototype chip crops
    to nothing; measure the paths with `getBBox()` the way the live `MuscleChip` does.

### U5 · Edzés II (`mezo-me75u.5`, 2026-09-24)

Terv, sablonok, saját edzés and the three Hét sub-pages (the Terhelés landing was U4's).
Blocks: `── uveg edzes2 terv|run|nap|izmok|konyvtar|sablonok|het (`. Three new sprite icons
(`t-template t-compare t-trash`). Prototype: [`prototypes/uveg-edzes2.html`](prototypes/uveg-edzes2.html).

34. **„Nice elements" is not a design — decide the composition out loud.** The owner approved
    the day card's every PIECE in one round and rejected the pile in the next: *„rendszer nélkül
    összevissza odavágott elemek"*. What settled it was naming the system: two zones split by a
    hairline, one shared left margin, one rhythm (9px), a shared right edge for status + chevron,
    three EQUAL boxes in a real grid, and exactly ONE loud thing (what you train). State changes
    colour and volume, never structure. Decide those five before showing a card, and say them in
    the reply — the owner reads the rules back.
35. **One week, one component.** The Terv landing and the run page both draw „A heted"; they were
    a `.pl-day` loop and a `DayTile` mosaic. Two copies of the same week always drift, so both now
    render `MesoWeekDays` → `MesoDayCard`. A slice that meets a list ALREADY drawn elsewhere
    renders that component instead of dressing its own copy.
36. **A filled CTA must restate every colour.** `.pl-lib-new` inherited the old skin's title,
    sub-line and art-well colours, all tuned for a dark card — on an accent fill they render
    dark-on-dark and the button reads as broken. Paid for twice in one slice (library, sablonok).
37. **A „megvolt" stamp may never sit over a planned number.** A card that can show both the plan
    and the result reads the result from the instance (`logic/mesoWeekDone.ts`), and where the data
    cannot answer — a record count lives only on the frozen report — the field is left OUT, not
    guessed (the MesoFutamokPage rule, now a card rule too).
38. **`.glass` clips, on every new shape.** U1 rule 3 again: the volume gauge's „most" pin sits
    ABOVE its track and rendered cut in half. The card declares `overflow: visible`, adds top
    padding, and drops its sheen — an unclipped sweep would run off the edge.
39. **A mini bar cluster needs a fixed basis.** `.mz-wmini b { flex: 1 }` is fine in a narrow tile
    and becomes five 38px colour slabs at half-screen width. Give the bars a `flex: 0 0 13px`
    basis so the graphic stays a chart.
40. **Read the week's log from the hook that already fetched it.** The Terv landing's done-state
    comes from `useWeekMuscleLog` — the same cached reads the Terhelés tab makes — so the two
    surfaces cannot disagree and the second visit costs nothing. Mock mode has no persisted
    instances, so a done-state feature is honestly absent there; say so rather than faking it.

### U6 · Én I (`mezo-me75u.6`, 2026-09-24)

Én hub, Célok (+ Cél, wizard, Jelek), the weight goal and its sub-pages, Súly, Alvás + night mode, and
the four week pages. Blocks: `── uveg en hub|celok|sulycel|suly|alvas|het (`. Five new sprite icons
(`t-compass t-signal t-lens t-breath t-candle`); the six PERMAH `i-life-*` icons joined `CLAY_TO_3D`.
Prototype: [`prototypes/uveg-en.html`](prototypes/uveg-en.html).

41. **Builders still rewrite the whole stylesheet: verify by selector, not by line count.** Three of six
    builders saved `prototype.css` whole (a Python replace, a ranged `sed -i`) despite rule 17. Nothing
    was lost, but only because integration scripted a check that every builder's reported key selectors
    were present in its block. Ask every builder for its key selectors and check them, then put them in
    the `U<n>_BLOCKS` structure test so a later loss fails CI.
42. **There is no `--page` token in the app.** §1 and §7.1 name the ground `--page`, but the app CSS aliases
    it as `--canvas`; a badge ring written `0 0 0 2px var(--page)` silently draws nothing. Write
    `var(--canvas)` in app CSS (the U6 guard rejects `var(--page)`); prototypes may keep `--page`.
43. **A capture sheet opened from many areas belongs to none of them.** The weight and sleep log sheets
    have been glass since U3 and open from Nap, Életjel, rutin and quick input too. Leave them to their
    block; a scoped tweak on the sheet reaches every opener (the sleep sheet's note box went flat
    everywhere — acceptable, but know it).
44. **A legacy class with `!important` is renamed, not outranked.** `.lg-tile` carried `!important`
    backgrounds that no `.glass` rule can beat; the builder renamed it (`.enc-tile`) and kept the
    animation hooks (`.lg-wk7`). Escalating to `!important` in the üveg block would have poisoned the next
    slice.
45. **A status glyph becomes a word with an icon.** ✓ Megerősítve → `t-tick`, ▲ Erősödött → `t-up`,
    ★ Előléptetve → `t-record`, ◐ Folyamatban → `t-clock`, ✗ Nem jött be → `t-skip`; ⚠ → `t-info`. Reuse
    this table wherever a status chip carries a glyph.
46. **Colour that carries data outranks the prototype's colour.** The prototype drew the week's score
    bars in lavender; the live bars keep their score-band colours (sage/amber/coral), the same bands the
    day tiles use. A prototype decides the look, not what a colour means.
47. **A chrome-less full-screen page gets the calm variant.** The night page hides the header and the
    bar; bright glass there would wake the user. It uses faint lavender flat rows, a soft orb and light
    numerals, with no sheen, and its breathing motion lives only in the no-preference branch.

### Észrevétel-kártya (`mezo-me75u.12`, 2026-09-24)

The Észrevételek card, re-thought after the owner found it unreadable. Prototype:
[`prototypes/uveg-eszrevetel.html`](prototypes/uveg-eszrevetel.html).

48. **Raw machine text never reaches the screen, even when it is "evidence".** The server sends
    observation evidence as LLM-context lines (`notes=…; rpe=7.0; kcal_is_estimate=true`). Parse
    it on the client into rows (icon + title + relative day, labelled value pills, the user's own
    words as a quote) and drop machine fields; keep an unparseable string as a plain tag. The
    wire stays as it is (`logic/observationEvidence.ts`).
49. **A comparison is ONE graphic, not deltas under each number.** The owner rejected „−3 / +2”
    printed under the second check-in's cells: the relation did not show. Two+ consecutive
    readings of the same scales get one shared track per dimension (hollow ring = earlier, lit
    dot = later, the segment glowing in the dimension hue) with `7 → 4` and the delta beside it.
50. **The question sits on its answers.** Evidence between a question and its reply pills breaks
    the reading order; the order is sentence → evidence → question + pills (with a hairline).
    Evidence opens by default on an unanswered card and folds once answered.

51. **(U8a) One number per page.** A deep page's hero ring, its sentence and its chart must read
    the SAME day count from the SAME source (the chart's own points) — the owner's "0 nap
    bizonyíték" next to an 8-day chart was a trust bug, not a styling one. When two honest counts
    exist (plotted days vs. the calculation's aligned days), name both, never show them bare.
52. **(U8a) Deep pages go back where you came from.** A "Miből látszik?" page is reached from the
    wall, a room or a list; its back control steps back through history („‹ Vissza”) and only a
    direct open falls back to the list by name (`useBackTo`).

### U7 · Én II (`mezo-me75u.7`, 2026-09-24)

Növekedés, rutin + szokások, napló, emberek, the full notification feed, and every settings page but
Fuel's. Blocks: `── uveg en2 novekedes|rutin|naplo|emberek|ertesitesek|beallitasok (`. Ten new sprite
icons (`t-bell t-anchor t-bulb t-scissors t-spark t-key t-exit t-palette t-flag t-brain`); the last two
LIFE skills and `i-ertesites` joined `CLAY_TO_3D`. Prototype: [`prototypes/uveg-en2.html`](prototypes/uveg-en2.html).

53. **A product rule outranks the approved prototype's colour.** The prototype drew a missed habit day
    as a coral outline; ADR 0010 forbids failure styling, and the old grey was deliberate. The build
    keeps it neutral, pinned by a structure test. Rule 46's twin: before shipping a colour that means
    "bad", grep the decisions for it.
54. **Boop stands for a domain, a 3D icon stands for a thing (owner, "vegyes", 2026-09-24).** The settings
    hero and the domain tiles keep the living Boop; every `SettingsRow` now requires an `icon` and draws
    it in a lit well, `domain` only tints it. Apply the same split wherever a mascot is used as a list glyph.
55. **A page that borrows another area's classes owns them before it re-dresses.** The Napló page wore
    Mezo's `mzh-*`/`mzp-*`/`mem-*` classes; scoping overrides would still have fought the Mezo skin, so it
    renamed them to its own `mzj-*`. Cheaper than scoping, and the Mezo slice starts clean.
56. **One list, one icon map.** The header panel and the feed page draw the same notification kinds, so
    `NTF_3D`/`ntfIcon` moved to `features/notification/logic/kindIcon.ts` (rule 35's twin for icons).
57. **An inline-styled shared control gets a `glass` prop, not `!important`.** `Toggle` set its colours
    inline; it now takes `glass` and draws `.uv-tgl` from CSS. Those rules still live in the ertesitesek
    block — the next slice that passes `<Toggle glass>` moves them into the kit first.
58. **`PageHero` has no eyebrow slot.** Three builders worked around it (dropped it, or pushed a child up
    with `order`). The next slice that needs one adds an `eyebrow` prop to the kit.
59. **The ground is black now.** `--surface-page` became `#000000` in dark (`mezo-x4r3c`, 2026-09-23),
    so §1's `#191614` is the card family, not the page. Keep writing `var(--canvas)`; never a literal.

### U8 · Mezo I (`mezo-me75u.8`, 2026-09-25)

Beszélgetés, coaching (áttekintő, Megfigyelő, napi kártya), diagnózis, Emlékek + napi emlék, N=1 kísérletek,
memoár (+ archívum, fejezet) and Memória. Blocks: `── uveg mezo1 chat|coaching|diagnozis|kiserletek|emlekek|memoar|memoria (`.
Seven new sprite icons (`t-whistle t-eye t-card t-diagnose t-album t-layers t-pencil`). The Üzenőfal (`/mezo`) and the
experiment detail were already glass (csapatfal, U8a). Prototype: [`prototypes/uveg-mezo.html`](prototypes/uveg-mezo.html).

60. **Own the prefix before you dress, on every page, not only the borrowed one.** Rule 55 generalised: every U8
    builder moved its page off the shared `mzp-*` / `mem-*` / `mz-memoir*` / `mz-qcard` families onto its own
    (`mzc-u8`, `coach-`, `dgx-`, `exl-`, `eml-`, `mmo-`, `mmr-`). Seven builders touched pages that shared class
    names three ways, and no rule reached a neighbour. The old rules stay until a dead-CSS sweep removes them.
61. **A shared component gets an opt-in prop and exactly ONE owner.** `FeedbackChips glyph3d`, `RefTag glass`,
    `VerdictArc glow`, and `MemorySearchPanel` styled by its own root (it lives on both Emlékek and Memória). The trap
    is the consumer that forgets the prop: it keeps the old look silently (the memoir pages did, caught at
    integration). Grep every consumer of an opt-in prop before merging.
62. **Never group what the engine sorts.** The prototype put Megfigyelő's rules under state headings; the live order is
    the engine's severity order and mixes states, so headings would have reordered it. The ranking is carried by the
    material instead (flagged = glass, resting = amber flat, ok = dim flat, unmeasurable = dashed).
63. **The glass back pill writes its ‹ as its own element.** `PageHead glass` reads „‹Mezo" as text; a test that
    expected „‹ Mezo" failed on spacing, not meaning. Compare labels without whitespace.
64. **`PageHero` has `eyebrow` and `glass` now** (rule 58 done): `glass` is the halo hero without art, for a hero whose
    graphic is its own child (the Memória ring) or which is text only (a memoir chapter).
65. **A refuted experiment is neutral.** „Nem igazolódott" keeps no failure colour (`docs/features/proactive.md`:
    muted, no red/no-penalty tone), whatever the prototype drew. Rule 53 again: grep the product rules first.

### U9 · Mezo II (`mezo-me75u.9`, 2026-09-25)

Karakter (napló, dimenziók, egy dimenzió), Rólad, Konzílium, Gépterem (+ futások, egy futás, adatforrások, kör,
detektorok, Összes funkció), Tudástár (minden nézet + egy kapcsolat), Minták, Előrejelzések. Blocks:
`── uveg mezo2 karakter|konzilium|gepterem|tudastar|mintak (`. Four new sprite icons (`t-council t-radar t-graph t-grid`).
Prototype: the WHOLE Mezo section in one file, [`prototypes/uveg-mezo-teljes.html`](prototypes/uveg-mezo-teljes.html).

66. **Another programme's approved world outranks this slice's first draft.** The first U9 prototype was built on the
    live pages and drew the old nine experts; the csapatfal (`/csapatfal`, epic `mezo-a9bo7`) had already designed Rólad,
    Konzílium and Gépterem (D3/D5) with five characters. Before prototyping a Mezo (or any) surface, grep every approved
    prototype for its route — `uveg-uzenofal.html` is the Mezo world's canon, and a slice re-dresses the live page IN that
    world's material (`tf-*`), never beside it.
67. **One reference file for a whole area, assembled, not forked.** `uveg-mezo-teljes.html` is spliced from the
    untouched csapatfal world + the U8 screens (their CSS scoped under `.u8` by `src/scope-css.py`, views in a module that
    registers with the host router) + the U9 screens. Two copies of an approved world always drift; a splice keeps the
    canon file canon.
68. **A module that registers views must not shadow the host's globals it reads.** The U8 code declared its own `CH`
    (memoir chapters) and silently hid the csapatfal's `CH` (the characters); every U9 view threw. Scan the names both
    scripts declare before concatenating them.
69. **Display mapping belongs in one helper, and it must accept every key shape it will meet.** Personas fold into the
    five characters through `personaCharacter()`; the evening edition's rows already carry a TEAM id, which the first
    version turned into Mezo. Map persona keys AND pass-through team ids, and test both.
70. **A retired duplicate is redirected, not re-dressed.** The in-page Karakter tabs and the 9-expert roster duplicated
    the dock and A csapat; the owner chose to drop them (redirect `/mezo/karakter/csapat` → `/mezo/csapat`, keep the old
    feed as the wall's source page). Ask before styling a page the new world has already replaced.
71. **Builders still save the whole stylesheet (rule 41 again).** One U9 builder used `sed -i` on `prototype.css`; all five
    blocks survived because integration re-checked every builder's key selectors before the structure test pinned them.

### U9b · Rólad — a közös kép (`mezo-zpxv7`, 2026-09-26)

The one slice allowed to move behaviour: `/mezo/rolad` became the csapatfal D3 „közös kép” page (quote · decision inbox ·
facts with owner · life-event timeline · „A te kezedben” · doors) and the Tudástár inbox moved there (the Tudástár keeps
the archive and a pointer). New backend: fact `owner` and a 14-day „Most ne” snooze. No new sprite icons. Spec
`docs/superpowers/specs/2026-09-26-rolad-kozos-kep-design.md`; prototype `uveg-mezo-teljes.html#rolad`.

72. **A button's promise is a backend contract.** The approved card said „Most ne — később újra megkérdezzük”, but
    reject was terminal. Before relabelling an action, read what the endpoint does; a promise the backend cannot keep
    is either a new state (this slice: snooze) or different words. Then check every job that can delete the thing you
    just promised to bring back (the nightly graph prune aged snoozed candidates out before they returned).
73. **Moving a surface moves its styles, not only its component.** The inbox cards and the week banner carried
    `.tud9`-scoped rules; on Rólad they rendered unstyled (the banner squeezed into a 70px column at 320px, caught only
    by the runtime pass). When a component changes page root, grep every class it renders and re-own the rules under
    the new prefix in the same change; drop the old half only when its last consumer is gone.
74. **A decision UI confirms only what the server recorded.** The afterlife line („Bekerült…”) is shown optimistically;
    it must roll back when the mutation fails, or the page claims a decision that never happened.
75. **Two sessions, one timestamp.** A parallel slice's migration landed with the same `yyyyMMddHHmm` prefix; the rebase
    kept both and moved ours an hour later. Re-run the full backend suite after any rebase that brings in a migration.

### Olvashatóság + egy háttér (`mezo-nn7h0`, 2026-09-26)

Owner: the gray copy was unreadable on the black ground, and every page had a different background.
Picked variant 3 of [`prototypes/uveg-olvashatosag.html`](prototypes/uveg-olvashatosag.html).

76. **The ground is near-black graphite `#141210`, not `#000`** (supersedes rule 59's value). Black made the
    warm-gray copy sink; a slightly lifted ground keeps the glass glowing and the copy legible.
77. **The gray ladder is `#D8CEC2` (secondary) / `#AFA294` (muted).** White title → light warm gray → mid warm gray:
    three steps you can still tell apart. Never write the old `#B7A899` / `#8A7A6A` literals for copy.
78. **One background for every page.** The `.uv-aurora` field (opacity .16) is back on in dark and is THE page
    background. A hero halo is a glow around the hero object, not a page wash: the shared rule at the end of
    `prototype.css` mutes every hero `::before` halo to 40%. A new page hero with its own halo joins that list.
79. **Header, status bar and page are one color, no transition** (`mezo-5knnj`). Nothing may tint the page right
    under the header: `MozaikPage`'s `.mz-p-<tone>` top wash is transparent in dark and the dark `--halo-*` tokens
    run at ~40% strength.
80. **The header is see-through, the background runs to the top of the phone** (`mezo-r3s4j`). In dark the status
    bar and `.app-head-bg` have no fill: the header layer is a frosted veil (backdrop blur, reaching up behind the
    status bar, 18px fade at its foot). At rest you see the aurora straight through it; only once the header
    condenses on scroll does a 45% canvas tint join the blur. Never give the dark header an opaque background again.

### Emodzsi-söprés (`mezo-z5lov`, 2026-09-26)

The last live emoji outside the character voices went to existing sprite symbols (`t-sun t-sleep t-spark t-info t-flame
t-sprout t-tick`); no new icons. Surfaces: the sleep-goal sheet, the meso wizard CTA, the week/day editor lints, the
Failure/Volume set style, the macro-panel note. Prototype: [`prototypes/uveg-emodzsi.html`](prototypes/uveg-emodzsi.html).

80. **A grep hit is not a screen.** The source held ~90 distinct emoji; five spots rendered. The rest were dead modules,
    data fields nobody reads, maps already converted to sprites (`badgeArt`, `cleanTypeLabel`) or comments. Trace every
    hit to a routed render site before counting it (rule 18 for glyphs); the dead ones go to a cleanup bead
    (`mezo-8slef`), because deleting them also means fixing the feature docs that still call them live.
81. **A character's own sentence may carry emoji; the UI may not.** The csapatfal voice rule (spec §2.6/§2.7, owner
    reconfirmed 2026-09-26) allows sparing emoji inside Szunya/Falat/Mocor/Derű/Mezo lines (`IntroPosts`, `teamRooms`,
    edition posts). "Still no emoji" (§4) governs glyphs the app draws — buttons, chips, warnings — never voice copy.
82. **`.t-ico` is `display: block`.** An icon inside a run of text (a warning line, a chip label, a CTA label) takes the
    kit's `uv-inline` class (inline-block, baseline nudge, the old glyph's trailing gap; `uv-after` when it trails).
    An `aria-hidden` sprite that replaced a meaningful glyph gets an `sr-only` word for what it meant.
83. **A prototype's change marker must not sit on the content.** Corner „ITT” badges covered the numbers they pointed at;
    the owner read it as a broken layout. Mark a change with a dashed outline (`outline-offset`) and offer a switch to
    hide the markers and one to show the before state.

### Sprite forrás (`mezo-wnfdv`, 2026-09-26)

84. **A new icon goes into `assets/titanium-custom.svg`, then the generator is run.** `titanium-icons.svg` (both the
    `assets/` and the `frontend/src/shared/ui/clay/` copy) is the output of `node scripts/gen-titanium-sprite.mjs`,
    built from the `nap.html` sprite plus `titanium-custom.svg`. U5–U10 pasted 29 approved symbols straight into the
    frontend copy, so the next run would have silently dropped them. Append the symbol after the file's
    `<!-- symbols -->` marker with a one-line comment naming the approving slice, then regenerate and commit both outputs.
    `titaniumSpriteSource.test.ts` fails when a shipped symbol has no source, or a source symbol never reached the sprite.

### U10 · Rétegek és ünnepek (`mezo-me75u.10`, 2026-09-26)

Ceremonies (meal, sport), level-up, the shared GlassBox + DatePicker + resume FAB + error card, every old sheet + toasts,
KalauzSheet + T0 welcome, auth + splash + Minden oldal, admin. Blocks: `── uveg reteg unnep|szint|ablak|lap|kalauz|belepes|admin (`,
pinned as `U10_BLOCKS`. Six new sprite icons (`t-jump t-sprint t-core t-juggle t-stretch t-target`). Prototype:
[`prototypes/uveg-reteg.html`](prototypes/uveg-reteg.html).

85. **Every Boop is alive (owner, 2026-09-26).** `<Boop>` defaults to `alive`, and each instance gets its own phase
    (`--boop-delay`, a negative animation delay from its id), so a screenful never blinks in unison. A test that seeks a
    Boop keyframe must seek WITHIN the iteration (`progress = currentTime − delay`), not assume phase 0.
86. **A layer's choreography waits for the layer.** The owner saw the meal stars ignite while the drawer was still rising.
    Sequence it inside the ONE rAF pass (rise first, then ignition) rather than chaining a CSS transition + `transitionend`
    — a throttled webview freezes a CSS transition (the ceremony pattern's own rule).
87. **Make the glass the component's default when the slice migrates every consumer.** GlassBox went glass-by-default
    (plus a `className`), so no caller could be forgotten (rule 61's trap); `<Sheet>` stayed opt-in (`glass`) because many
    sheets were already dressed in their own scope — and a guard test (`sheetGlassGuard.test.ts`) now fails any new
    `<Sheet>` that ships on the old skin.
88. **A caller's tint must stay overridable.** Read it through a custom property the stylesheet can win
    (`--c: var(--gl-tint)`), never set `--c` inline — an inline `--c` beats a slice rule that pins its dialogs to a hue.
89. **Scrolling glass loses its frame below the fold.** `.glass::before` is absolutely placed, so in a scrolling sheet or
    dialog the gradient hairline covers only the first screenful. Acceptable for tall pickers; know it.
90. **The kit's field rule is heavy.** `.sheet.glass.uv-sheet :is(input…)` has specificity 0,6,1; a search wrapper that
    draws its own field gets a second box unless it is bared at a higher specificity. A future kit pass should lower it
    (`:where()`) or add a `.uv-bare` opt-out.
91. **Pre-auth screens have no sprite.** AuthGate renders above main.tsx's `<ClaySprites/>`, so every `t-*` icon on login,
    register, onboarding and the boot failure drew nothing until AuthShell mounted the sprite itself. Any surface rendered
    outside the app tree must mount its own sprite.
92. **A root scope beats renaming for a self-contained surface.** Admin carried ~256 legacy light-hex rules; one root class
    (`.uv-admin`) outranked them all without renaming anything the tests read. Prefix ownership (rule 60) is for pages
    that SHARE classes with neighbours.
93. **Never quote a block marker in a comment.** The structure test's `slice()` finds the first `── <marker> (` string; a
    comment that mentions it earlier in the file makes the test read the wrong section.
94. **A sprite symbol is not done until `Icon3DName` lists it.** The six U10 icons were in the sprite but not in the type.
    Add the symbol to `assets/titanium-custom.svg` and run the generator (rule 84).
95. **A peek strip is sized for the longest voice, not the prototype's one-liner.** Kalauz voices run to four sentences;
    the peek bar clamps to three lines in a 100px strip.
