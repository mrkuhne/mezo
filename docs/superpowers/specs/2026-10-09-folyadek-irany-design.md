# Folyadék — rebuilding the app in its new identity (design spec)

> Replaces the 2026-10-07 "csepp / clinical" spec (same epic `mezo-n4wf5`), which described a
> direction the owner rejected a day later. Styling reference:
> `docs/design_2.0/2026-10-09-folyadek-style-bible.md`. Executable target: the prototype
> `docs/design_2.0/prototypes/klinikai-iranyok.html` + `vilagos/*.js`
> (Artifact https://claude.ai/artifact/Ax6faqjyEd6Xxw2J7MN45M). Driver: the `/folyadek` skill.

## 1. Why

The owner found the shipped Üveg look (warm dark glass, 3D icons, Boop creatures) "tamagotchi,
játékos, komolytalan" and niche. He wants a professional, adult, unisex product that many
people find sympathetic — without the app becoming "száraz, lélektelen, stock", which is what
every merely *cleaner* attempt turned into. Nine prototype rounds (journey table in
`prototypes/vilagos/HANDOFF.md`) ended in two separate answers:

- **Structure:** a light, structure-first page skeleton — "az irány, a tisztultság jó".
- **Identity:** one bold idea, chosen from three distinct concepts — **Folyadék**: everything
  is a level that fills.

On 2026-10-09 he closed the prototype phase: *"a mostani design nagyon tetszik … így kell
kinéznie"*, and asked for the build programme.

## 2. What is being built

The whole app, every route, sheet and state, re-dressed to match the prototype:

1. **Light only.** The dark theme is removed, not parked.
2. **One page skeleton** on every screen (bible §2): title bar → the domain's pages as top
   tabs → one hero vessel with a verdict sentence and one primary action → 3–5 numbered card
   sections → rows leading deeper.
3. **Navigation:** the bottom bar always shows the five domains; the domain's pages are top
   tabs; there is no domain switcher; the header back button returns to where the user came
   from.
4. **The liquid language** (bible §4): tank, vials, capsules, levels, filled silhouettes,
   liquid time series with a target waterline, communicating vessels, streams, and the per-day
   vessels under every comparison of averages. No progress rings.
5. **One signature graphic per screen**, drawn from that screen's own data.
6. **The Folyadék-jel icon family** (bible §5) replaces the Titanium 3D sprite and the clay
   icons everywhere.
7. **The team** is named by field (Alvás, Mozgás, Étkezés, Közérzet, Mezo, Szkeptikus) and
   shown as the field glyph badge; Boop creatures and nicknames disappear (bible §6).

## 3. What does not change

Every control, state, sheet, data field, API contract, mutation and state machine — except the
navigation in §2.3. MuscleChip/BodyMap graphics, the Fuel · Mai content and the in-workout
layout are explicit keeps. Internal persona keys (`szunya|mocor|falat|deru|mezo`) stay.

## 4. How it is delivered

Nine slices, one fresh session each, driven by `.claude/skills/folyadek/SKILL.md`. Every slice:
**prototype checked against the live app and iterated on the Artifact → owner OK → build →
gates → merge → deploy → live check → Hungarian report.** The prototype already covers the
whole app (≈360 screens, ≈200 state variants, ≈140 sheets, looked at by eye at 390 and 320 px),
so a slice's prototype step is a parity pass and a reality pass, not a blank page.

| # | Slice | Depends on |
|---|---|---|
| F1 | Alap + keret + készlet (light lock, tokens, fonts, shared kit, icon sprite, navigation) | — |
| F2 | Nap | F1 |
| F3 | Edzés | F1 |
| F4 | Edzés közben | F1 |
| F5 | Fuel | F1 |
| F6 | Én | F1 |
| F7 | Mezo (incl. the team rename) | F1 |
| F8 | Átfedők (kalauz, quick input, voice, settings, splash, auth, admin, PWA icon) | F2 |
| F9 | Záró söprés | all |

The app is mixed-look between F1 and F9. F1 therefore has one design question of its own for
the owner: how the new frame (title bar, top tabs, bottom bar) looks around pages that still
wear Üveg — shown on the prototype before code.

## 5. Risks and how the programme handles them

- **The navigation change is structural** (terrain §7.1): tab dots, last-tab memory, the kalauz
  anchor, the bottom padding, the quick-log button and many guard tests hang on the current
  bar. It is done once, in F1, with its tests rewritten in the same commit.
- **Light has been parked since 2026-09-23** and the glass kit is dark-tuned and not
  theme-scoped: flipping the lock alone gives dark glass on a light ground. F1 rewrites the kit
  blocks; until a domain's slice lands its pages are verified only for *not being broken*.
- **The rename changes model input.** The LLM prompts carry the display names
  (`TeamCharacter.java`, the voice writers), so new names change what the model reads and
  probably what it writes. F7 lists every site, shows the owner the wording, and runs the
  backend tests that pin the names. Already-stored text (old posts, chat lines, push titles)
  still contains the old names — whether history is rewritten is a product decision raised in F7.
- **Invented prototype data.** Several graphics show numbers and sentences the app may not be
  able to compute. Each slice's reality pass names the real field behind every graphic or
  replaces the graphic.
- **Reaction pendulum.** Restyling by reaction swung between "soulless" and "noisy" for seven
  rounds. The look is now frozen; a slice does not redesign, it matches. A new idea goes to the
  owner as distinct options on one screen, never as a silent improvement.

## 6. Prior art (researcher, 2026-10-07; filtered for Folyadék)

Adopted: **Apple Activity rings** — a signature needs one guarded meaning and a terminal state
([HIG](https://developer.apple.com/design/human-interface-guidelines/activity-rings)); here the
signature is the *level*, and a full vessel is the terminal state. **Apple HIG charting** —
label + numeral + takeaway sentence per card
([HIG](https://developer.apple.com/design/human-interface-guidelines/charting-data)) → the hero
verdict. **Oura** — one grammar at three fidelities
([Instrument](https://www.instrument.com/work/oura-app)) → tank / vial / capsule.
**MacroFactor** and **Built With Science** (owner's references) — structure-first pages, one
hero number, stable macro colours, muscle maps. **Talking Blobs**
([hybridthings](https://hybridthings.tha.de/talking-blobs/)) — faceless companions; tried as
liquid sibling forms, kept only for the five domain drops after the owner found them wrong for
expert voices.
Rejected after being built and shown: **Whoop**-style dark clinical ("száraz"), **Function
Health** parchment editorial, a warm-orange hybrid, decluttered glass ("összefolyik"), the
re-lit 3D icon set (still unreadable at 26 px). The gamification critique
([APA blog](https://blog.apaonline.org/2023/02/06/reflections-on-the-gamification-of-fitness/))
supports dropping creatures, nicknames and hero streaks.

## 7. Codebase terrain (investigator, 2026-10-09)

Paths under `frontend/src` unless noted.

### 7.1 Shell and navigation
- `app/TabBar.tsx:30-96`: one Boop switch button + the active domain's four tabs; owns the
  last-tab memory effect (`:38`), tab dots (`:28`), the `train-tabs` kalauz anchor (`:56`).
- `app/DomainSwitcher.tsx:14-99`: the dialog with five Boops and the "Minden oldal" link
  (`:91`) — retired; the link needs a new home.
- `app/navModel.ts:45-140`: `DOMAINS` (5×4 with `owns`), `activeTabRoute` `:172`,
  `rememberRoute` `:193`, `routeForDomain` `:211`. `NavDomain.id` is typed `BoopDomain`.
- `app/AppLayout.tsx:54-117` (`hideChrome`, `hideFab`, `hideHeader`, `<TabBar dots>`);
  `app/AppHeader.tsx:33` (wordmark `:121`, kalauz `:127`, settings `:141`, messages `:148`,
  bell `:161`, DayOrb `:171`) — no title, date, search or back slot today.
- The swap: bottom bar maps `DOMAINS` → `routeForDomain(id)`; a new route-driven top-tab strip
  in the shell renders `domain.tabs` with `activeTabRoute` and takes the dots, the
  `rememberRoute` effect and the kalauz anchor with it. `.segtabs` + `useStickyTab` is an
  in-page switcher, not this.
- Back: `shared/hooks/useBackNav.ts` (`useBackNav` `:10`, `useBackTo` `:38`) already pops
  history with a fallback (22 files); `PageHead` (`shared/ui/mozaik/index.tsx:144`, 77 files)
  takes `onBack`; ~15 sites hand-roll `navigate(-1)` without fallback. The back control is
  page-owned today.
- Guards: `app/TabBar.test.tsx`, `navigation.test.tsx`, `navModel.test.ts`,
  `boopNavigation.test.ts`, `hubHeaders.test.tsx`, `backNavigation.test.tsx`,
  `napomTabDot.test.tsx`, `pageIndex.coverage.test.ts`; `features/tutorial/registry/anchors.test.tsx`;
  `frontend/tests/layout/{navigation,layout,tudastar-hub,fuel-learning}.spec.ts`.

### 7.2 Theme and CSS
- Lock in four places: `shared/lib/theme.ts:3,10,14`; `frontend/index.html:12,33-39`;
  `frontend/vite.config.ts:49-54`; tests expecting dark. Dark pockets: `RitualPage.tsx:91`,
  `/me/sleep/night`. Parked toggle: `features/me/pages/BeallitasokPage.tsx:24`.
- One stylesheet: `styles/prototype.css` (30.9k lines). Light is the base (`:root` `:9`), dark
  overrides from `:476`. Tokens `--mz-*` (331), `--macro-*`, `--dv-*`, `--nav-*`. Kit block
  `── uveg kit (` `:13553`, chrome `:13770`; 68 `── uveg` blocks, 783 `.glass` matches; the
  glass kit is unconditional and dark-tuned.
- Guards: `shared/ui/mozaik/prototypeCssStructure.test.ts` (~190 cases),
  `mozaikCssTokens.test.ts` (requires a dark value per token), `shared/ui/sheetGlassGuard.test.ts`
  (every `<Sheet>` wears glass; 70 files), `styles/tokens.test.tsx`, ThemeProvider / Circadian /
  forceTheme / pwaStatusBar / lightFirst tests; 20 test files read `prototype.css` raw.

### 7.3 Icons
- `scripts/gen-titanium-sprite.mjs` → `shared/ui/clay/titanium-icons.svg` (149 `t-*`).
  `shared/ui/clay/index.tsx`: `ClaySprites` `:112`, `ClayIcon` `:132`, `Icon3D` `:142`
  (viewBox 64), `CLAY_TO_3D` `:161-196`, `ContentIcon` `:200`. Usage: `<Icon3D` 304 files,
  `<ContentIcon` 47, `<ClayIcon` 17; a third inline family `shared/ui/Icon.tsx` (64 importers).
- Swap with ids unchanged: replace the sprite content and its generator/source, keep the
  component signatures, set `--ic`/`--ic2` at `.t-ico` and its wells; rewrite
  `titaniumSpriteSource.test.ts`. **To verify in F1:** the 150 prototype glyphs against all 149
  ids plus the clay ids used in the chrome.

### 7.4 Fonts
`styles/fonts.css` self-hosts Geist, Geist Mono, Fraunces. **Bricolage Grotesque is not loaded**
(ADR 0018 D2 retired it): F1 vendors it, adds `@font-face`, repoints `--ff-display`
(`prototype.css:162`), and supersedes that part of the ADR. ~6 rules hard-code `'Fraunces'`.

### 7.5 Kit
`shared/ui/mozaik/index.tsx`: `MozaikPage` (105 files), `PageBody` (102), `PageHead` (77),
`PageHero` (37), `StatCell`, `Tile`, `Mosaic`; `GlassBox` (12); `motion.tsx` `EntranceGroup`
(119); `shared/ui/Sheet.tsx` (70). 361 files write `glass` in a className.
Rings to replace: `shared/ui/ScoreRing.tsx` (6 pages), `WeekScoreRing`, `MaturityRing`,
`NapomSegRing`, `GoalCourseHero`, `FuelEnergyHero`, `GlycemicGlass`, `VerdictArc`,
`LevelUpScreen`; 14 CSS `conic-gradient` rings; the `.uv-ring-*` recipe. Real clocks that stay:
`MealClock`, `MealClockBox`, rest timer. Dead primitives: `ProgressBar`, `TrendChart`,
`AdherenceBar`.

### 7.6 The team
- Display names — two mirrored tables: `features/insights/logic/team.ts:36-43` (`name`,
  `nameAcc`, `nameIns`, `boop`) and
  `backend/.../feature/character/service/edition/TeamCharacter.java:22-37` (`displayName`,
  `voice`). The inflected FE forms collide with the new copy rule and need redesign.
- Prompts use the display names: `EditionVoiceWriter.java:237,255,271`,
  `chat/TeamChatVoiceWriter.java:247,257`, `chat/TeamChatContext.java:78`; push title in
  `TeamChatService.java:614`; `FakeCompanionLlm.java:323` maps names back to keys.
- A second cast, the konzílium experts (`CharacterExpertCatalog.java`: Doki, Edző, …), is not
  covered by the rename decision — raise it in F7.
- 12 further FE files hard-code names; 27 FE tests + 10 backend tests pin them.
- `<Boop>`: 21 render sites in 17 files (chrome, feed, character pages, settings, Nap
  companion, quick input, kalauz, `VoiceBubble` on every voice field); `Boop.tsx`,
  `public/logo-boop.svg`, PWA icons, the wordmark (`AppHeader.tsx:121`, `StartupSplash.tsx:176`).

### 7.7 Patterns and traps
Token-first re-skin in place (rewrite tokens and kit blocks, do not rename classes across 360
files) · one nav source (`navModel`) · `useBackTo` everywhere · guards rewritten in the same
commit, never deleted · sprite hidden with `position:absolute;width:0;height:0` · 320 px is the
chrome's hardest width · a grep hit is not a screen; dead CSS is deleted only with proof ·
unset `VITE_USE_MOCK` means mock; file filters do not scope the suite · regenerate the codemap
after file moves and after every merge.

Stale docs to fix in F1: `docs/features/_platform-design-system.md` (TabBar description,
display fonts), the `TabBar.tsx` header comment, `docs/features/today.md` header list.

## 8. Open decisions (to raise at the named slice, never to assume)

- F1: the frame around not-yet-converted pages; where "Minden oldal" goes.
- F3: body silhouette vs. dumbbell on Edzés · Mai; day cards vs. rows on Terv.
- F6: Én night mode dark or light; the streak.
- F7: prompt wording under the new names; stored history with old names; the konzílium
  experts' names; the separate "Rád vár" list.
- F8: the "boop" name, wordmark and PWA icon.
- Any slice: invented numbers and sentences; inconsistent dates across domains.

## 9. Owner decisions (do not re-litigate)

1. Folyadék is the identity; the prototype is the build target as it stands (2026-10-09).
2. Light only.
3. The page skeleton on every screen; hero = verdict sentence + one primary button.
4. Bottom bar = the five domains; domain pages = top tabs.
5. Back returns to where the user came from.
6. Everything is a level; no progress rings; one signature graphic per screen from its own data.
7. Averages are shown with the days behind them.
8. The Folyadék-jel icon family replaces the 3D icons (chosen over re-lit and tinted 3D).
9. The team is named by field and shown as the field glyph badge (chosen over monogram and
   colour-only); liquid forms only in the bottom bar.
10. Colour = meaning: domain colour, state colour, stable category colours.
11. Kept: muscle-map graphics, Fuel · Mai content, the in-workout layout.
12. Behaviour frozen apart from 4 and 5.
13. Typography: Bricolage Grotesque for titles and numerals, Geist for text.
14. The owner looks once per slice, at the Artifact, before code; no review round after the build.
