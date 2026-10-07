# Csepp — the clinical re-dress of the app (design spec)

**Date:** 2026-10-07 · **Driver:** `mezo-juo1e` (direction) → programme epic `cseppesites` (see §8)
**Status:** direction approved by the owner on the prototype (`docs/design_2.0/prototypes/klinikai-iranyok.html`, variant **Ajánlott** + the **Jelek** sheet, Artifact https://claude.ai/artifact/Ax6faqjyEd6Xxw2J7MN45M, version 8). This spec records what was approved and the rules a later slice must not re-litigate.

## 1. Why

The Üveg look (2026-09-23, `mezo-me75u`) is complete and polished, but the owner's verdict on
2026-10-07: with the Boop creatures and the five-pastel glass world the app reads as a
*tamagotchi* — playful, niche, and off-putting for many adults. The target is a **professional,
clinical, adult, unisex** look that still has a soul and is recognisably *this* app.

Four prototype rounds narrowed it down. What was rejected and why (owner, same day):

| Tried | Verdict |
|---|---|
| Pure clinical dark, line icons | "unalmas, száraz, elveszett belőle a lélek" |
| Parchment "lelet" light theme | too big a flip, cold on the phone at night; the 3D icons look like stickers on paper |
| Warm hybrid (graphite + orange accent + one glass card) | the warm/orange palette is not it |
| Clinical dark + the existing 3D icons + one glass card | right material and soul, but **no signature graphic** — "nem tudom, hogy ez a Boop app" |
| **+ the living drop (élő csepp) + the five quiet rules** | **approved direction** |

## 2. The direction in one paragraph

Cool graphite ground, one steel-blue accent for the whole app, colour otherwise only as
**meaning** (ok / attention / bad). The **Titanium 3D icon sprite stays** (it is the app's
warmth). Glass survives only as **ranking**: one or two glass cards per screen carry the most
important thing; everything else is an open list with hairlines, no boxes. The signature is the
**élő csepp**: a faceless, breathing, liquid-filling organic form that means exactly one thing —
*your day* — large on Nap, small in every header and on the bottom-menu domain mark. The Boop
personas survive as **sibling forms** of the same material (owner decision B: keep the roles,
replace the creature artwork).

## 3. Tokens (the approved values)

Dark only (the light theme stays parked, as under Üveg).

| Token | Value | Use |
|---|---|---|
| ground `--surface-page` | `#0F1214` | the page |
| card `--card` | `#161B1E` (flat cards, where any) · open lists use the ground | |
| hairline `--hair` | `rgba(230,233,234,.09)` | the only divider |
| ink / sub / faint | `#E6E9EA` / `#9AA3A8` / `#6B757B` | the three text greys |
| accent `--acc` | `#7FB2D0` steel blue | primary button, active tab icon, glass frame, links |
| ok / warn / bad | `#5FA98A` / `#CFA14A` / `#CF6B5E` | state only, never decoration |
| domain tint `--dom` | Nap `#CFA14A` · Edzés `#CF6B5E` · Fuel sage · Mezo lavender · Én rose (desaturated like the two above) | **only** the bottom-menu domain mark and the selected day in a day strip |
| aurora | four cool blobs (`#2F6B7A`, `#3B5A8A`, `#2E6B5E`), blur 70px, opacity `.16` | depth behind the ground |

Type: Geist (display 600, tight tracking), Geist Mono for labels and values with tabular
numerals. **Four text roles only:** title, body, small mono label, big numeral. Chips and
footnotes only where irreplaceable.

## 4. The élő csepp (signature)

- **One meaning:** the user's day. Fill level = how much of the day's signals are in
  (e.g. 4/7); colour + form + rhythm = state (ok: round, slow breath, green · warn: wavier,
  faster, amber · bad: angular, quick, red). Never a button for something else, never
  decoration, never a progress bar for another metric. This rule is what makes it a signature
  (Apple Activity rings HIG, Whoop ring).
- **Sizes:** 128px hero on Nap (with the day score numeral inside), 56px on a state card,
  40px in every header (replaces the DayOrb), 36px on the TabBar domain mark (tinted `--dom`),
  28px inline.
- **Motion:** breathe (scale 1 → 1.035, 4.6s ok / 3.2s warn / 2.2s bad), liquid wave 3.6s;
  everything under `prefers-reduced-motion: no-preference`, still otherwise.
- **The team as sibling forms:** Szunya (pebble, lavender), Mocor (bean, steel blue), Falat
  (drop, sage), Derű (leaf, gold), Mezo (crystal, slate). Same material, no face. In messages
  the form is the sender, the text is the voice. Final silhouettes get an owner round in C7.
- Reference implementation: `csepp()` in `klinikai-iranyok.html` (CS_FORM paths, clip-path
  liquid, `#cs-sheen` overlay, `.csepp` CSS).

## 5. The five quiet rules (ranking and noise)

1. **Four text roles**, not eight.
2. **A box only for glass.** Hero cards (1–2 per screen) wear the glass recipe; everything else
   is an open section: mono eyebrow, hairline-separated rows, no border, no background.
3. **Two shades:** ground and hairline. Chips lose their background.
4. **Colour = meaning, otherwise grey.** A bar for something that is fine is grey. Accent only
   on the one primary action.
5. **Say a thing once.** The csepp *is* "a napod"; the Nap screen has no title. A verdict
   sentence ("Ma jó nap egy közepes edzéshez.") replaces descriptive headings.

Plus, carried from the Üveg canon: §3.4 ranking before material; the chrome keeps its content
(wordmark, ?, settings, messages, notifications, day glyph; TabBar with domain mark + nav-model
tabs); behaviour frozen; glass-in-glass forbidden.

## 6. What changes in the chrome

- **Header:** a small mark + the "boop" wordmark, quieter (the mark is a placeholder — the
  name/logo decision is separate and open). The DayOrb becomes the 40px csepp.
- **TabBar:** the living Boop on the domain switcher becomes the 36px csepp tinted `--dom`;
  tabs keep their clay icons; active tab icon in accent.
- **No day-part switcher** (unchanged).

## 7. What stays untouched

Routes, hooks, data, state machines, copy that is not a heading. The Titanium sprite and the
`CLAY_TO_3D` meaning map. The muscle-map (MuscleChip / BodyMap) graphics — the owner's explicit
keep; they are the Edzés-domain hero rendered in the same material. The ceremony *pattern*.

## 8. Programme shape (the `cseppesites` skill drives it)

One fresh session = one slice; every slice: living prototype edited in place → Artifact →
owner OK → build → gates → merge → deploy → live check → report. Slices and order:

| # | Slice | Scope |
|---|---|---|
| C1 | Alap + keret + kit | tokens on the dark root, the `Csepp` component, header + TabBar, the quiet primitives (open section, row, four text roles), guard tests rewritten, **the Csepp style bible** written, `CLAUDE.md` design banner updated. Prototype already approved (klinikai-iranyok Ajánlott + Jelek); only the chrome details and the mark need an OK. |
| C2 | Nap | Mai (approved), A napom, Beszélgetés, Rutin + sheets |
| C3 | Edzés | Mai (approved), Terv, Terhelés, Gyakorlatok |
| C4 | Edzés közben | session, eligazítás, review, ceremonies |
| C5 | Fuel | all four tabs + log flows |
| C6 | Én | Hol tartok, Test, Célok, Napló |
| C7 | Mezo + csapatfal | the sibling forms replace the Boop avatars (design round with owner OK on the five forms first), feed, Rólad, Tudástár |
| C8 | Átfedők | kalauz, quick input, Hallgató Boop → csepp in VoiceBubble, settings, splash, PWA icon |
| C9 | Záró söprés | route audit, dead CSS, light remnants, bible appendix consolidation, living prototypes all republished |

C1 blocks everything; C2–C6 are independent after C1; C7 and C8 after C2; C9 last.

## 9. Prior art (researcher, 2026-10-07)

Adopted: **Whoop** — one score, one three-colour vocabulary learned once, black ground makes
data the only saturated thing ([925studios breakdown](https://www.925studios.co/blog/whoop-design-breakdown)).
**Oura** (Instrument) — semantic desaturated palette, three fidelity levels with one grammar
([instrument.com/work/oura-app](https://www.instrument.com/work/oura-app)). **Apple Activity
rings** — a signature needs a terminal state and a guarded single meaning
([HIG](https://developer.apple.com/design/human-interface-guidelines/activity-rings),
[Engadget 2015](https://www.engadget.com/2015-03-10-apple-watch-activity-design.html)).
**Talking Blobs** (Hybrid Things lab) — faceless companions that speak through form, rhythm and
presence ([hybridthings.tha.de/talking-blobs](https://hybridthings.tha.de/talking-blobs/)).
**Apple HIG charting** — label + numeral + takeaway sentence per card
([HIG](https://developer.apple.com/design/human-interface-guidelines/charting-data)).
Rejected: **Function Health** parchment editorial (full theme flip, stickers-on-paper icons);
**Gentler Streak** path as primary anchor (time-series only; may return for the mesocycle load
view). The gamification critique ([APA blog](https://blog.apaonline.org/2023/02/06/reflections-on-the-gamification-of-fitness/))
supports dropping creatures and hero streaks.

## 10. Codebase terrain (investigator, 2026-10-07)

- **One stylesheet, token-first:** `frontend/src/styles/prototype.css` (30.8k lines); dark root
  `:root[data-theme="dark"]` l.476–560, the `── uveg kit (` block l.13555–13762 (`.glass`
  l.13591, `.uv-*`), the chrome block l.13764–13952; 52 `── uveg …` blocks, 783 `.glass`
  matches, 1057 `var(--c)` reads. Re-skin = change tokens + rewrite the kit rules in place,
  not rename classes across 376 files.
- **Kit:** `shared/ui/mozaik/index.tsx` (`PageHead`, `PageHero`, `Tile`), `GlassBox.tsx`,
  `motion.tsx`; `shared/ui/clay/index.tsx` (`Icon3D`, `CLAY_TO_3D`, `Boop` re-export).
  Sprite: `titanium-icons.svg` from `docs/design_2.0/assets/titanium-custom.svg` via
  `scripts/gen-titanium-sprite.mjs`.
- **Boop render sites (26):** chrome `TabBar.tsx:64`, `DomainSwitcher.tsx:79`,
  `MindenOldalPage.tsx:125`; Nap `NapCompanion.tsx:41`, `ObservationCard.tsx:187`,
  `NapMezoPage.tsx`; shared `VoiceBubble.tsx:127` (every text field), `KalauzWelcome.tsx`,
  `QuickLogSurface.tsx`; Mezo/csapatfal `StoryStrip`, `FeedPostHead`, `CharacterRoomPage`,
  `BoopAboutPage`, `PersonaOrb`, `KarakterHubPage`, `RunPage`; settings `SettingsFrame`,
  `SettingsPage`. `Boop.tsx` is typed to `NavDomain.id`; `boop.svg` has 7 variants.
- **DayOrb:** `shared/ui/DayOrb.tsx` with hex-pinning tests (`DayOrb.test.tsx`,
  `AppHeader.dayOrbTone.test.tsx`).
- **Guard tests that freeze the skin:** `prototypeCssStructure.test.ts` (kit recipe, chrome
  block, per-slice blocks, glass-in-glass regex), `mozaikCssTokens.test.ts`, `TabBar.test.tsx`,
  `tests/layout/layout.spec.ts`, `navigation.spec.ts`, feature tests commenting "üveg az
  üvegben tilos". Rewrite in the same commit to assert the new ranking; never delete.
- **Dark lock** in three places: `theme.ts:10,14`, `index.html:12,34–39`, `vite.config.ts`
  manifest colours.
- **Living prototypes:** `docs/design_2.0/prototypes/elo/{nap,edzes,fuel,mezo,en}.html` with
  fixed Artifact URLs in `elo/README.md`; `_hang-kit.html` injected by `_inject-hang-kit.mjs`.
- **Predecessor skill:** `docs/archive/skills/uvegesites.md` — the template for `cseppesites`.
- **Stale docs to fix in C1:** `docs/features/today.md` header list (daypart switch),
  `_platform-design-system.md` §10 TabBar description, üveg bible §1 ground hex and the sheen
  sections, the chrome-block comment in `prototype.css:13764`.

## 11. Open decisions (to raise, not to assume)

- The **name and logo**: the "boop" wordmark stays until the owner decides; the header mark in
  the prototype is a placeholder.
- The **five sibling forms'** final silhouettes (C7 design round).
- Whether the **open-list sections** get a very faint shared background band if the screens
  feel too airy in practice (owner's call after seeing C2 live).
