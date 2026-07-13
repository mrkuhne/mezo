# „Napív" — Frontend Design Rethink (mezo-8141)

**Date:** 2026-07-13 · **Status:** approved by Daniel (interactive prototype reviewed) · **Driving bd issue:** mezo-8141
**Live prototype (reference artifact):** [`2026-07-13-napiv-redesign-mockup.html`](2026-07-13-napiv-redesign-mockup.html) — open in a browser; screens are switchable (tab bar), the „+" sheet, the workout Live Activity and the daypart toggle all work.

---

## 1. Context & problem

The Phase-1 visual system ("Deep Current v2" — see [`2026-06-02-mezo-phase1-frontend-design.md`](2026-06-02-mezo-phase1-frontend-design.md)) reads as a technical dashboard: blue-gray canvas, one petrol accent, Antonio + JetBrains-Mono ALL-CAPS labels, chamfered (notch) corners, no motion. Daniel's verdict after living with it:

- **too cold** — blue-gray + teal + white everywhere; mono uppercase eyebrows feel like a terminal;
- **too angular** — zero border-radius, chamfer corners, sharp segmented controls;
- **not mobile-friendly** — desktop-dashboard density (4-up stat rows, 10px mono labels, 6–7-tab sub-navs), small tap targets, primary CTAs mid-scroll;
- **no focus / no guidance** — Today is 8+ equally-weighted cards; nothing says "do this now".

**Goal:** full visual + structural redesign. **No functionality may be lost**; restructuring is allowed and desired.

## 2. Decision

Direction **A · „Napív" (warm companion)** was chosen from three explored directions (A Napív · B Pulse soft-dark athletic · C Sportklub warm editorial), then iterated twice with Daniel on a live prototype. B's warm-graphite palette survives as the future **dark theme variant**; C is dropped.

The one deliberate aesthetic risk (the signature): **the app lives with the user's day** — a circadian arc + a daypart-tinted atmosphere on every screen. Everything else stays quiet and disciplined around it.

## 3. Design language

### 3.1 Color tokens (light = primary designed theme)

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#FBF6EF` | app background (délután base; see §3.4 for daypart tints) |
| `--surface` | `#FFFFFF` | cards |
| `--warm` | `#F4EBDF` | soft inset surfaces (brief, beats, steppers) |
| `--line` | `#EFE5D8` | hairlines/borders |
| `--ink` | `#2B2118` | primary text (warm, not black) |
| `--sub` / `--faint` | `#8A7A6A` / `#A5978A` | secondary/tertiary text |
| `--coral` / `--coral-deep` | `#FF6B4A` / `#C4622F` | primary action + **Train** accent |
| `--amber` | `#FFB347` | warm secondary (carbs, morning sun, warnings-soft) |
| `--sage` / `--sage-deep` | `#7FA48A` / `#5F7A52` | **Fuel** accent, success/done |
| `--lav` / `--lav-deep` | `#9B8FC4` / `#7A6DA8` | **Sleep/Me/Insights** accent, evening |
| `--rose` | `#E27A8B` | **Sport (röplabda)** accent |
| `--sky` | `#6FA7D8` | **Futás** accent, water |

Domain-accent mapping replaces the old `--cat-*` usage 1:1 (Sport pink→rose, Futás info-blue→sky, brand-teal→coral as default accent). Shadows are warm-tinted (`rgba(43,33,24,…)`), layered ambient+key; CTA gradients (`#FF7A55→#FF5B36`) carry an inner top highlight.

**Dark theme (later slice):** warm graphite `#191614` canvas / `#221E1B` surfaces / `#F5EFE6` ink with the same accent family glowing — the "Pulse" palette from direction B. Not designed screen-by-screen yet; tokens must be structured so dark is a palette swap, not a redesign.

### 3.2 Typography

- **Display: Bricolage Grotesque** (Google Fonts, variable) — page titles, hero titles, big numerals. Weight 700–800, tracking −0.3…−0.5px. Sentence case — **the ALL-CAPS display style is retired.**
- **Body/UI: Plus Jakarta Sans** — 400–800. Replaces Inter.
- **JetBrains Mono is retired from the UI.** Numbers use `font-variant-numeric: tabular-nums` instead. Tiny uppercase *eyebrows* survive only as 10–11px/800/letter-spaced Jakarta in an accent color, used sparingly (one per card max).
- Antonio + Inter + JetBrains `<link>`s in `index.html` are replaced by Bricolage + Jakarta.

### 3.3 Shape, elevation & materials

- **The notch-chamfer corner is retired.** Cards: 20–28px radius (hero 26–28, rows 18–20). Buttons/controls: pills (`border-radius:999px`). Round icon buttons 42–52px.
- Tap targets ≥ 44px; primary CTA full-width pill at thumb height inside its card.
- **Frosted-glass floating tab bar**: `rgba(255,252,246,.66)` + `backdrop-filter: blur(20px) saturate(1.5)`, floating capsule 14px from edges; content scrolls under it. ⚠️ This deliberately supersedes the mezo-ci5 "opaque tab bar" decision — the two failure modes recorded there (bleed-through, hardcoded-dark in light theme) are both addressed (blur+tint instead of transparency; token-driven tint per theme). Fallback: browsers without `backdrop-filter` get a near-opaque tint.
- Sheets: keep the existing `Sheet` portal idiom; restyle — 36px top radius, grabber, iOS ease `cubic-bezier(.32,.72,0,1)`, backdrop blur(3px).

### 3.4 Signature: the Napív + circadian atmosphere

**Napív (day-arc), Today only.** An SVG arc at the top of Today plots today's anchors as dots: check-ins (done = sage-filled), workout (coral outline until done), evening close (lavender). The sun/moon dot glows at the current position; the elapsed portion of the arc is stroked with a gradient (amber→coral→lavender), the rest stays neutral. The dot **after** "MOST" is the guided next action.

**Circadian atmosphere, every screen.** A `daypart` (reggel · délután · este) drives:
1. a top **sky band** (295px, masked fade) rendered once at the shell level under all views:
   - reggel: gold-peach radial glow at top-left + `#FFDDAE→#FFEDD4` band; canvas warms to `#FCF1DF`;
   - délután: near-neutral warm white, faint high sun glow; canvas `#FBF6EF`;
   - este: lavender radial glow top-right + `#E2D9EF→#F0E9E9`; canvas cools to `#F3EDF2`;
2. greeting copy + greeting accent color on Today (gold / coral / lavender);
3. sun/moon position + arc progress on the napív.

Daypart bands: reggel 04:00–11:59 · délután 12:00–17:59 · este 18:00–03:59, derived from local time in a pure helper (`shared/lib/daypart.ts`), transitions animated (~1s background ease). **AnchorMode** (rough day) maps to a desaturated, lower-contrast variant of the current daypart with motion minimized — it replaces the old `--anchor-*` skin.

### 3.5 Motion language

- **Enter orchestration** per screen: cards stagger-rise (translateY 16px→0, 550ms, iOS ease, 70ms stagger); the napív draws itself (stroke-dashoffset, 1.3s); arc dots pop with spring overshoot; macro bars / progress fills scaleX from 0.
- **Live states:** the next heartbeat slot pulses (2.4s ring); the FAB has a soft 3.2s glow pulse; rest countdown ring ticks per second.
- **Press feedback:** every pressable scales to .955 with spring curve `cubic-bezier(.34,1.4,.44,1)`.
- **`prefers-reduced-motion: reduce` disables all of the above** (animations off, static states) — non-negotiable.
- Implementation: CSS-first (keyframes + transitions); no animation library in scope.

### 3.6 Iconography & content richness

- Tab bar + chrome icons: extend the existing custom stroke SVG `Icon` set (sun, dumbbell, water-drop, person, sparkle); **no emoji in chrome**.
- Emoji is allowed as *content garnish only*: food avatars on Fuel timeline cards (🥣🐟💊💧 in tinted rounded squares), Growth skill rows.
- Session **type tags** everywhere a session appears: `GYM` (coral-tint), `RÖPI` (rose-tint), `FUTÁS` (sky-tint) — small 9px/800 rounded chips.
- Every food card shows **kcal + F/Sz/Zs macros** as color-dotted values (sage/amber/lav).
- The AI toolchip rows (`get_meal_pacing()`…) disappear from primary surfaces; AI advice renders as a warm amber strip with a ✨ and plain Hungarian text. (ToolChip primitive survives for Insights/Phase-3 debug surfaces.)

## 4. Structure & navigation changes

### 4.1 App shell
- **Tab bar: 4 tabs + center FAB** — `Ma · Edzés · [+] · Fuel · Én`. **Insights leaves the tab bar**; its entry is a ✨ icon button top-right on Today (routes `/insights/*` unchanged, deep links intact).
- **The center „+" FAB opens the Quick-log sheet** (Étkezés · Edzés · Víz +250 · Súly · Stack · Check-in): this gives `features/quickinput/QuickInputSheet` its missing mount point — rebuilt to this 6-tile design.
- PhoneFrame/desktop mockup, StatusBar, 519px full-bleed breakpoint, zoom-disabled viewport: **unchanged**.

### 4.2 Today — "Mi van most?"
Order: greeting + date (daypart-aware) → **napív** → **one hero card** (next best action: the workout when one is planned; its type tag, meta, niggle warm-strip, full-width `Indítsuk` CTA) → AI brief **collapsed to 2 lines** with `bővebben` expander (full briefing text preserved behind it) → heartbeat beats row (2/4 etc.) → "Ma eddig" 3 mini-rings (kcal/fehérje/alvás) → **"Növekedés ma" one-row summary** (quests count + XP + streak, links to `/me/growth`). The Insights teaser and the activity-log list leave Today (they live in Insights / Growth). No feature is deleted — only relocated/demoted.

### 4.3 Train
- Sub-nav: 6 mono tabs → **scrollable pill row** (Mai · Gym · Sport · Futás · Gyakorlatok · Mesociklusok), coral active pill. Same routes.
- Mai: coral-gradient hero (type tag, chips: gyakorlat/szett/perc/fókusz, CTA) → **weekly load summary tiles** (GYM 5×·75p / RÖPLABDA 4×·6,5h / FUTÁS 2×) → weekly plan as day cards, each session with type tag + context line (mell-fókusz, RPE, PR-ablak); "MA" row ringed coral; rest days dashed.
- Sport/Futás/Gym/Exercises/Mesocycles keep their content model, restyled to the same vocabulary (accent: rose / sky / coral).

### 4.4 Fuel
- Sub-nav: pill row (Mai · Terv · Stack · Receptek · Kamra · Gyógyszer), sage active.
- Mai: **semicircle kcal gauge** (sage→amber, animated) + cutoff/close chips + macro **soft bars** → AI strip → timeline of enriched cards (avatar + name + time + kcal + F/Sz/Zs dots; next meal ringed sage with "következő"; esti stack lists capsules; water card with +250/+500 pills).
- Terv/Stack/Receptek/Kamra/Gyógyszer restyled in-vocabulary; recipe hero bands stop being hardcoded-dark (token-driven, `--text-on-media` retired with them).

### 4.5 Active workout (`/train/session`)
- Full-screen (no tab bar). Top: back pill + title + per-exercise progress dots.
- **One exercise = one big card**: eyebrow (n. gyakorlat · muscle), name, last-week ghost line, set circles (done ✓ / current / pending), **giant −/+ steppers** for súly/ismétlés, full-width `Szett kész ✓`.
- **Rest Live Activity:** during rest the in-frame dynamic island expands into a dark capsule — countdown ring + `PIHENŐ m:ss` + next exercise — then collapses. (Real Live Activity/DI is a PWA no-go; this is an in-shell reinterpretation on the existing fake island.)
- Warm-up list, challenge/PR proposal cards, warm AI strip keep their content, restyled.

### 4.6 Me
- Header: **avatar circle (initials, lavender ring) + name + one-line biometrics** + gear.
- Pill sub-nav (Profil · Growth · Cél · Súly · Alvás · Emberek · Tudás), lavender active.
- Order: **goal progress track first** (81,4 → 78,6 → 73 with marker), then Biometria grid + TDEE row, then Growth summary (XP chip + skill bars). Other Me pages restyled in-vocabulary.

## 5. What does NOT change

- **All functionality and data.** Every view, sheet, flow, and mock scenario survives (relocations per §4).
- **The data layer**: `@/data/hooks` barrel, hook signatures, `useDualQuery`, mock/real modes, ghost-guard + skeleton + error triad idioms.
- **Hungarian UI copy** verbatim, except where a screen's structure changes (new labels follow the writing rules: active verbs, sentence case, consistent names — `Indítsuk` → started workout stays `Pull Day`).
- **Conventions**: four layers, `*Section`/`*Page` naming, deep absolute imports, colocated tests ([ADR 0003](../../decisions/0003-frontend-structure-conventions.md), [`frontend_conventions.md`](../../references/frontend_conventions.md)).
- **A11y floor**: aria roles/labels, keyboard focus visible, `prefers-reduced-motion`, Sheet semantics.
- **Theme persistence mechanism** (`mezo-theme` localStorage + pre-paint script) — see risk R2 for the attribute semantics change.

## 6. Engineering impact & risks

- **R1 · Token migration.** `prototype.css` (~1130 lines) is the single token+component vocabulary. Strategy: introduce the Napív token set + new component classes alongside, migrate screen-by-screen, delete dead Deep-Current classes at the end. The Tailwind `@theme inline` bridge in `index.css` is remapped to the new tokens. `NotchCard` becomes a plain rounded `Card` (accent prop survives); `Display`/`Eyebrow`/`PageTitle`/`LabelMono` re-skin (LabelMono likely retired).
- **R2 · Theme attribute inversion.** Today `:root` is the dark base and `data-theme="light"` opts into light, while the *default* is light — historically justified, now backwards (light is the designed primary). We invert: **`:root` = Napív light; `data-theme="dark"` = warm-graphite override**; `theme.ts`, the pre-paint script, `vite.config.ts` manifest colors and the platform doc all update together. This supersedes the "never add data-theme=dark" gotcha in [`_platform-design-system.md`](../../features/_platform-design-system.md) §9.
- **R3 · Pixel-parity harness.** `pnpm parity` diffs against the *old* prototype — obsolete by design. The old-prototype parity suite is **retired in the foundation slice**; after the redesign stabilizes, visual regression returns as self-baselined Playwright screenshots per key screen.
- **R4 · Render-test churn.** Tests assert classes/structure/aria. Class-name assertions tied to retired classes (`notch-*`, `eyebrow brand`…) will be updated slice-by-slice; behavior/aria assertions must keep passing throughout. Both test modes green after every slice.
- **R5 · Frosted tab bar** (supersedes mezo-ci5): must be verified on iOS Safari standalone PWA (backdrop-filter quirks) with the opaque-tint fallback ready.
- **R6 · Fonts.** Two Google font families replace three; check Hungarian diacritics rendering (Bricolage covers Latin-Ext) and font-loading flash (keep `display=swap`, preconnect).

## 7. Slice map (proposal for the implementation plan)

1. **S1 Foundation** — Napív tokens (+dark placeholders), fonts, theme inversion (R2), base primitives re-skin (Card/pill/CTA/Chip/Sheet/Icon additions), frosted tab bar + FAB + Quick-log sheet shell, parity retirement (R3).
2. **S2 Circadian layer** — `daypart.ts`, sky band in shell, canvas tints, AnchorMode remap, motion utility classes (stagger/press/reduced-motion).
3. **S3 Today** — restructure per §4.2 incl. napív component + Insights ✨ entry.
4. **S4 Train** — pill nav, Mai + weekly plan, type tags, load tiles; then Sport/Futás/Gym/catalog/meso re-skins.
5. **S5 Active workout** — execution card, steppers, rest Live-Activity island.
6. **S6 Fuel** — gauge + macro bars + timeline; then Terv/Stack/Receptek/Kamra/Gyógyszer re-skins.
7. **S7 Me** — header/avatar, goal track, biometria, Growth; remaining Me pages.
8. **S8 Insights re-skin + dark theme (Pulse palette) + motion polish + new visual baselines.**

Each slice ends green in **both** test modes + updates the touched `docs/features/*.md`.

## 8. Acceptance criteria

1. Every route/view/sheet reachable before the redesign is reachable after it (routes unchanged; Insights via Today ✨).
2. `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` green after every slice.
3. No `Screen`/`View` names introduced; no new barrels; `shared/ui` stays domain-free.
4. Daypart atmosphere visibly distinct (reggel/délután/este) on all tabs; `prefers-reduced-motion` yields a static but fully usable app.
5. Old-prototype parity harness removed; interim visual QA via the reference mockup; final self-baselines in S8.
6. `docs/features/_platform-design-system.md` rewritten for Napív in the same effort (per-slice edits allowed, final pass in S8).

## 9. References

- Live prototype: [`2026-07-13-napiv-redesign-mockup.html`](2026-07-13-napiv-redesign-mockup.html)
- Superseded visual spec: [`2026-06-02-mezo-phase1-frontend-design.md`](2026-06-02-mezo-phase1-frontend-design.md) (structure/conventions parts remain valid)
- Living structure doc to keep updated: [`../../features/_platform-design-system.md`](../../features/_platform-design-system.md)
- bd: **mezo-8141** (P1) · branch `feat/frontend-design-rethink` (worktree `.worktrees/frontend-design-rethink`)
