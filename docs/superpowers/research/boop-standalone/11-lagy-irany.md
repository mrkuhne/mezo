# 11 — The "Lágy irány" list, mapped against Napkelte, Boop S1–S3 and the owner's 12-item core

Date 2026-11-10 · research only · issue `mezo-r36n9.9`.

## TL;DR

1. `IRANY.md` (branch `origin/claude/mai-napom-custom-graphics-eedeb2`, `.claude/skills/lagy/IRANY.md`, 231 lines, never merged to main) is **~90 % a visual/process canon** for the *web prototype* (Fuel/Edzés/Nap/Mezo/Én in `prototypes/kepes/b/`), not a product backlog.
2. Its visual layer (paper ground, white cards, photo heads, one deep-green card, Outfit+Manrope, sage, chips, rings/tubes) is **fully superseded by Napkelte** (dark glass, painted sky, orbs) for Boop. Only a few *principles* survive (one idea per screen, verdict sentence first, no grey helper text, Hungarian/no "kcal", no dead-end placeholders).
3. The real product ideas hide in §11b–11e (Edzés, Nap, Mezo, Én "notes") plus the Napkelte spec §10 "gap review", which already says "nothing dropped without a joint decision".
4. Already built in Boop S1–S3: auth/onboarding, Health+calendar ingest, Nap·Mai (5 orbs, lens actions, path, observations, sheets, A napom, voice, bedtime reminder, evening/kímélő modes, session move).
5. Not built, still valid, and mapping to core items: in-workout guided logging rules (item 4), photo meal analysis flow (2), weight ruler/goal trend (3), check-in (11), intention/close-out (10), conversation (8), team-by-field agents (9), live day adjustment (12).
6. Conflicts with the standalone direction: Lágy assumes **five domains copied from the web app** (Edzés, Fuel, Mezo, Én as full tab sets with dozens of inner pages: 20+ Edzés page archetypes, Én with 5 tabs...), gamification (medals, quests, XP, leaderboards, 29-day grids), and a **photo-led** look needing stock photography. All clash with "clean, purpose-built, not a port of the cluttered web app".
7. Napkelte §10 already excludes Életjelek (six vitals), quests/XP from Boop v1; keep that line and extend it (medals, leaderboard, Szkeptikus wall posts, share cards).
8. Note the naming trap: the Boop v1 spec §0 (2026-11-09) also says "Lágy is the design canon for Boop" — a short-lived pivot that Napkelte (2026-11-10) reversed. The `Lagy*.swift` spike files and `BoopDesign/Lagy.swift` + `LagyTabPage/LagyFlowFrame` remain in the repo as legacy.
9. Best-value survivors for the re-plan: Edzés player rules (11b), "data the app does not hold: never invent a field" (§16), "one tap does it", post-save auto-return, team named by field, widgets/notification actions.
10. Recommendation: treat IRANY as an archive plus a short list of ~12 behavioural rules (section 4 below); do not import its page inventory.

---

## 1. Scope and sources

- `IRANY.md` read in full (sections 1–16 incl. 11b–11e); `lagy/SKILL.md` (round order, one-Artifact setup); the branch has only those two Lágy files (`git ls-tree`: `.claude/skills/lagy/IRANY.md`, `SKILL.md`). No Lágy files on `origin/main`.
- Spike: `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Lagy*.swift` (Lagy, LagyCurve, LagyDomains, LagyFlowKit, LagyFlows, LagyMai, LagyShell; ~2 700 lines) — only skimmed (tokens + shell); they are the SwiftUI port of IRANY's look for Mai/flows/domains.
- Canon that replaced it: `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md` (§4–§10), `.claude/skills/boop/SKILL.md`, `docs/features/boop-ios.md`, `ios/BoopKit/Sources/BoopDesign/Napkelte/` (Charts, DayPath, Frames, Glass, Landscape, Orbs, Tiles, Tokens), `ios/Boop/Nap/*`.
- Also read the Boop v1 spec §0, §4.3, §8 (the Lágy pivot).

## 2. The Lágy list, item by item

Status codes: **SUP** superseded by Napkelte (visual) · **VAL** still-valid product idea · **BUILT** already in Boop S1–S3 · **TODO** not built yet · **CONF** conflicts with standalone direction. Core item numbers refer to the brief's 12.

### Process / communication (§1, §15, §16)
| # | Lágy item | Status | Note |
|---|---|---|---|
| 1 | Owner is a Hungarian non-engineer; Hungarian business-language chat, helyzet→gond→options→ajánlás | VAL (process) | Already in `CLAUDE.md`; unchanged. |
| 2 | Direct instructions executed at once, short reports, no "which direction wins" | VAL (process) | Carried by `boop` skill. |
| 3 | Review on Artifact; verify locally | SUP | Boop iterates in simulator, no HTML artifacts. |
| 4 | Round procedure: recon → play back in chat → build → verify → log → report | VAL (process) | Replaced in practice by Boop's spike → OK → plan → build rhythm. |
| 5 | Owner exceptions on a named page are honoured and logged; vague "no fuss" = lightest golden rule | VAL (process) | Napkelte spec uses *owner* / *call* marks instead. |
| 6 | Data the app does not hold: never invent a field; derive from a linked record or leave out and ask | VAL | Worth keeping verbatim; Napkelte §4 "tiles without data are dropped, not 0" is the same spirit (boop-ios.md §2). |
| 7 | A page becoming a sheet (or reverse) is a structural change: propose, don't do silently | VAL (process) | |
| 8 | Search/filter kit only for lists of 8+ items or with categories | VAL (UI rule) | Relevant only once Fuel/recipe lists exist natively (core 2, 3). |
| 9 | No dead-end placeholders ("comes later" toasts) | VAL, **currently violated**: Boop S3 shows "<név> · hamarosan" toasts for S4 actions and "hamarosan" for bell/+/Beszélgetés/Rutin (boop-ios.md §2). Accepted as slice boundary, but a standalone re-plan should avoid shipping such stubs. |

### Look (§2–§10, §12, §13, §14)
| # | Lágy item | Status | Note |
|---|---|---|---|
| 10 | Direction in one paragraph: light warm paper, white cards + one soft shadow, one sage accent, deep green emphasis, peach/sun/sky/berry tints | SUP | Napkelte: near-black ground, colour only in sky + orbs. |
| 11 | Tokens (`--paper #F6F4EF`, `--sage #5FB08A`, `--deep #2E6B52`…, macro colours: fehérje `#E09A6A`, szénhidrát `#E2B24A`, zsír `#8FBF9F`, víz `#6FAEDC`, rost `#B79AD8`, kalória `#2E6B52`) | SUP (tokens) / VAL (macro semantic) | Napkelte keeps categorical colour only where categories must be told apart (§5.5); macro-split colours could reuse that exception. |
| 12 | Fonts Outfit + Manrope; own logo mark; own glyph family `G(name,palette)` with soft gradients | SUP | Napkelte: serif display, Outfit Light numbers, mono caps; Manrope dropped. Glyphs blob on dark; thin-outline family is an open "later round" (Napkelte §4.4). Legacy glyph assets still in `BoopDesign`. |
| 13 | **Golden rule** (every tab, page, sheet): (1) photo head, (2) custom graphic for numbers, never bare tiles, (3) verdict sentence → sections → cards, (4) chips for small facts, (5) exactly one deep-green card + 1–2 tints, (6) a Boop/Mezo card at the end when it has something concrete | SUP (1, 4, 5); VAL as principle (2, 3, 6) | Napkelte tiles are drawn mini-graphics (same intent as 2); verdict sentence first = serif headline; "Boop mondja" card = rule 6 (only on Forma page). Photo head replaced by painted sky. |
| 14 | Page skeletons: tab = 440 px full-bleed photo head with glass tab pills, paper panel rising 32 px over it; inner page 360/250 px head; sheets with grabber/detents; summary-vs-detail never repeats | SUP (structure) / VAL (summary vs detail) | Napkelte: 330–360 pt painted head, sheets 170 pt band, medium+large detents. Summary/detail separation still a good rule. |
| 15 | Photo language: one warm grade, scrims, small text never on photo, stock photos CC0 in `kepes/foto/`, new downloads need OK | SUP | No photography in Napkelte. Also removes a licensing/asset burden. |
| 16 | Numbers table: ring+thin bars for day goal, macro-split ring, three-column `.trio`, level tubes for micros/days (peach <50 %, deep ≥100 %), limit bars ("54 % a 5 g határból"), stacked macro bar, photo stack, week tubes / weight road as normal section never hero | SUP (look) / VAL (data selection) | Napkelte equivalents: orb fill, tiles, stacked white macro bar, week bars with dashed avg, trend line with dashed goal line. The *choices of what to show* (limits as % of cap, micros as levels) still apply to core 2/3. |
| 17 | Rings/bars grow on load, tab switch never replays | SUP/VAL | Napkelte: springs; rule "tab switch never flashes" survives (domain panorama switch built). |
| 18 | Rejected: filling vessels/glasses, bowl scene, drawn scene as second hero, circle plate frame in photo analysis | SUP / partly **reversed**: Napkelte's orb is literally a filling liquid vessel, and the Víz tile is a "waving glass". Irrelevant now. |
| 19 | Chips (§7): calorie chip with flame "689 kalória", score chip star "8,4", dark rating badge, white in tinted cards | SUP (look); copy rule "kalória, never kcal" **violated** by Napkelte spec text "820 / 2 350 kcal" (Fuel tile) — check against §11 copy rule. |
| 20 | Search/category/filter kit: `searchBar` with camera button, `catChips` with round photos, `filterPills` (Rendezés first), used in every picker sheet | VAL (behaviour) / SUP (look); TODO | Needed once native meal/recipe/ingredient picker exists (core 2, 3). Camera next to search = photo meal entry. |
| 21 | Lists & cards (§9): aligned text columns, planned items dashed ("keret"/"Betervezve"), recipe card with eyebrow tag, meta (perc · kalória), rating badge, round "+" that opens logging for that window, star favourite, carousels with dots | SUP (look) / VAL (recipe card contents, planned-vs-done distinction); TODO | Recipe card → core 2/3. |
| 22 | Motion/iOS behaviours (§10): large title collapsing to frosted bar, logging as modal card, detent sheets, **swipe rows (Szerkesztem/Törlöm)**, long-press peek, **pull for yesterday**, time wheel, FLIP flights, post-save "Rögzítve" with auto-return, chart scrub, dark theme, text size | Mixed | BUILT: detent sheets, chart scrub/magnifier (energy curve), compact header capsule (Napkelte §5.1b), dark only. TODO/VAL: swipe rows, pull-for-yesterday, post-save auto-return, long press menus (partly: Mozgás pill context menu). Dark theme / text size toggles: n/a (dark only; Dynamic Type left to builder). |
| 23 | One tap does it — never a double tap / extra sheet for the primary action | VAL | Aligned with Napkelte quick-log chips ("one tap logs"). |
| 24 | Photo analysis choreography: flash → shimmer + scan line twice, "Felismerem…" → "Elemzem…" → "Kész · 93% biztos" → results panel (ingredients, four numbers, certainty) → Újra / Hozzáadom | VAL (flow) / look re-done in Napkelte §5.3 Első étkezés (scan line, status pill, draft with ± 10 g, verdict) | TODO — core 2. |
| 25 | `prefers-reduced-motion` and still state land on end state | VAL, BUILT | boop-ios.md §2 voice/reduced-motion. |
| 26 | Copy rules (§11): Hungarian, no abbreviations (units, day letters fine), "kalória" not kcal, no grey helper text, no emojis, no numbered headings, ≥12 px text, ≥40 px taps (44 primary), real-looking invented content | VAL (copy), look parts SUP | Napkelte: "never emoji; no SF Symbols except chevrons/arrows". |
| 27 | Rejected list (§12): boxed photo card, dark header, metallic 3D icons, many hues on one page, bare number tiles, grey helper lines, kcal, page flash | Mostly SUP — "dark header" and "many hues" are **now the opposite** of the canon. |
| 28 | Verification (§13) probe script + screenshots 390/320 + click every control + parity check vs old page | SUP (web tooling) / VAL (parity discipline) | For a standalone app "parity with web" is a conscious non-goal; replace with "core-12 coverage check". |
| 29 | Machine notes (§14): shared builders, class-name collision traps, `.phone overflow: clip`, tab-switch flash, shell-owned data attributes, etc. | SUP | Web-prototype only. |

### Edzés feature rules (§11b, 2026-11-05) — the richest product content
| # | Item | Status | Core |
|---|---|---|---|
| 30 | Three workout questions (Pumpa · érzed? / Ízületi fájdalom / Akarunk még?) asked **once per exercise after its last set**, never between sets | VAL, TODO | 4 |
| 31 | Between sets only rest; rest screen shows **verdict of the set just done** (record / above / on / below target), medal for a record | VAL, TODO | 4 |
| 32 | Workout player/rest/exercise-done are dark with one vivid accent (lime `#C9F24D`, gold for records); other Edzés pages light with each page type having its own structure | SUP (the player being dark is now consistent with Napkelte); the "different structure per page" rule is a Lágy-specific owner complaint | — |
| 33 | **Parity in the player:** add/drop a set, edit a done set, swap, skip with reason, do later, reorder, add exercise, technique, records, quest, finish early; exercise note visible while lifting | VAL, TODO | 4 |
| 34 | ~30 page archetypes (poster, body map/Terhelés, corridor line/Terv, exercise grid/Gyakorlatok, Érmek grid, pre-flight Eligazítás, lanes then-vs-now Összegzés, set ladder, record profile, running order, sticky live total, anatomy focus + six columns, leaderboard, week timeline, road + covers, trophy list, magazine report, week patterns/templates, split board, numbered wizard with live arc, interval track, 8-week calendar, head-to-head butterfly bars, slots + effect tiles…) | CONF — a web-port-scale inventory; keep only what core 4/5 need (plan, day, player, summary, history of an exercise). |
| 35 | Edzés five tabs: Mai · Terv · Sport · Terhelés · Tár; all sport (weekly plan, logging, röpi, running, events) lives under Sport | VAL idea (one place for non-gym sport incl. running) / CONF as five tabs | 4 |
| 36 | Titles: heavy uppercase only for big moments; Mezo speaks in a slim note not an illustrated card | SUP | |
| 37 | **Live Activity** on lock screen + Dynamic Island: workout shows outside the app; buttons +30 mp, Tovább, Kész a szett, Megnyitom; horizontal fill bar not a ring; opens itself at rest end | VAL, TODO ("later slice" per Napkelte §5.1a) | 4 (also Apple Watch angle) |
| 38 | Photo variety rule per training page | SUP | |

### Nap notes (§11c)
| # | Item | Status | Core |
|---|---|---|---|
| 39 | Nap = four tabs; inner pages: day as a line with four moments (≈ A napom path), six big levels, photo quest cards, photo tiles, **dusk full-screen ceremony for napzárás**, linked order for a chain, 29-day grid for a habit | A napom path BUILT; napzárás ceremony TODO (Napkelte §10: arrives with Rutin round, 21:30 Esti check-in closes the day until then); habit grid TODO | 10, 11 |
| 40 | Team named by field (Alvás, Mozgás, Étkezés, Közérzet, Mezo) with glyph badges in message cards | VAL | 9 (domain agents). Napkelte: single companion Boop; "team of fields" not carried — decision needed. |
| 41 | Tab's hero action never reappears in list below; every destination once per page; header "+" and bell; unread counts on tabs | VAL; "+" quick add (Víz · Étel · Súly · Edzés · Napló) and bell owner-approved in Napkelte §10, TODO (bell/+ answer "hamarosan") | 2, 10, 11 |
| 42 | Habits ticked from data are locked ("adatból") | VAL, TODO | 10 |
| 43 | Chat-like cards: reasoning opens in place; feedback is a thumbs reaction | VAL; BUILT partially as swipe Igaz / Nem rólam szól on Boop észrevette | 8, 9 |
| 44 | Outside the app: widgets + notifications do the job in place (water +250, tick, answer check-in, snooze) | VAL, TODO ("later slice", Napkelte §10.10); bedtime reminder notification BUILT | 11, 6 |

### Mezo notes (§11d) and Én notes (§11e)
| # | Item | Status | Core |
|---|---|---|---|
| 45 | Team named by field + the Szkeptikus, glyph badges, old nicknames never appear | VAL concept; the Szkeptikus is the "devil's advocate" cross-checker | 9 |
| 46 | One card shape for every wall post; full post on its own page, never a drawer; wall sentence names whoever is actually waiting | VAL idea of a team feed; look SUP. In Boop the Boop tab still opens the web app. | 8, 9 |
| 47 | Mezo round 2: Rólad + Emlékek + engine pages (person memory, insights, effect tracking, transparency) | VAL concept (memory/long-term conclusions), TODO | 3 (long-term effects), 8 |
| 48 | Én five tabs: Hol tartok · Súly · Alvás · Célok · Napló; everything goals under Célok; night mode; round 2 planned: week analysis (napok/felfedezések/tanulságok), Fejlődés + képességek/tevékenységek/kitüntetések, Emberek (kör/jelöltek/említések/heti/egy ember), Értesítések | Mixed. Súly, Alvás, Célok, Napló VAL; Fejlődés/kitüntetések/Emberek CONF (gamification, social-graph "people" tracking). | 3, 6, 10 |
| 49 | Trap: container CSS rules inflating glyph SVGs | SUP | |

### SKILL.md items
| # | Item | Status |
|---|---|---|
| 50 | One Artifact, five domains, domain files registering `DOM.<key>`; order Edzés → Nap → Mezo → Én; Fuel = Round 0 | SUP for Boop (simulator, Swift). Useful only as a sign of what was already prototyped: **all five domains exist as web prototype screens** (Fuel, Edzés done 2026-11-05, Nap 2026-11-06, Mezo 2026-11-09, Én round 1 2026-11-09, round 2 pending) — a screen inventory to mine if needed. |
| 51 | Red-flags table (golden rule, no grey text, kalória...) | partly SUP |

## 3. Cross-check: what the Napkelte spec §10 says is already decided about Lágy leftovers

- **Added (builder must deliver):** states (no sync / <14 nights / no calendar / offline / failed), voice mute + replay (BUILT), energy-curve magnifier (BUILT), full observations list "Mind ›" (not in boop-ios.md §2 — likely TODO), Mérlegelés as a morning station (TODO), finished-step summaries (TODO), bell/avatar destinations (TODO), midday/afternoon check-in content from "Check-in 2.0" (TODO), frame screens (BUILT S1/S2), widgets/in-place notification actions (later).
- **Owner decided:** "+" quick add returns; evening Mai (BUILT); napzárás ceremony later with Rutin; "Fáj valami?" body map stays as one check-in question (TODO); kímélő mód stays (BUILT, exit button "hamarosan"); **Életjelek and quests/XP not in v1**; Rutin / Beszélgetés / A napom deeper features "kept for their tabs' own rounds, not dropped".

## 4. Still-valid ideas mapped to the owner's core items

| Core item | Lágy-origin ideas worth carrying (not the look) | Built in Boop? |
|---|---|---|
| 1 Health/Sleep Cycle ingest | (none in Lágy; S2 covers) — only "habits ticked from data are locked" | S2 BUILT |
| 2 Meal logging + AI eval | photo analysis flow (Felismerem → Elemzem → Kész · % biztos → ingredient list with ± grams → Újra/Hozzáadom); search + camera pill; category chips and filter kit in every picker; recipe card with meta + round + logging for that window; planned items dashed ("keret"); limit bars (% of the salt/sugar cap); quick log chips; swipe rows to edit/delete; allergen flags are NOT in Lágy (gap) | TODO (S4 meal) |
| 3 Weight goal / plans / effects | weight road as a section, mérlegelés ruler with haptics + goal line, trend state; Mezo "effect tracking / memory" pages; Én Célok + Súly tabs; the "plans" notion (road + covers, trophy list of closed runs, templates) is Edzés-side | weight ruler exists only in onboarding; rest TODO |
| 4 Sport plans + guided logging | all of §11b: per-exercise questions after last set, rest-screen verdict + record medal, player parity list, visible note while lifting, Live Activity, Sport tab for running/events, interval track, week timeline, 8-week calendar, set ladder, exercise record profile | only the Mozgás pill/session strip + "Áttolom" move; TODO |
| 5 Plan coordination | Napkelte conflict card and session move are the only seeds; Lágy has none beyond "Mezo card with a concrete plan/fix/warning" | partial |
| 6 Full sleep + recommendations | Alvás sheet, hypnogram + legend, wind-down card, bedtime reminder, dusk ceremony | BUILT mostly |
| 7 Calendar scoring → units vs capacity | energy curve + busy ribbon + conflict callout (Lágy §0 "A nap energiája") | curve BUILT; AI event scoring/units not in Lágy |
| 8 One AI sees all, chat | Beszélgetés tab (Napkelte §5.2), chat-like cards with in-place reasoning and thumbs, Mezo "Rólad/Emlékek" | tab TODO |
| 9 Domain agents / konzílium | team named by field + Szkeptikus with glyph badges; one card shape; a wall sentence naming whoever waits | TODO; Napkelte has a single Boop voice |
| 10 Journal / day goal / close-out | Mai szándék (creed + 3 foci + AI verdict), napzárás dusk ceremony (gratitude, day score), Napló tab, habit chain, 21:30 Esti check-in | szándék/napzárás TODO |
| 11 Check-ins + biometrics snapshot | check-in orb answer, per-question hue, body-map "Fáj valami?", midday/afternoon sets, widget/notification answers | Forma pill present but "hamarosan"; TODO |
| 12 Live re-examination | Lágy: only "Mezo card at the end when it has something concrete"; Napkelte: the session-move suggestion + Boop-brief regenerate ≤3/day | seeds only |

## 5. Conflicts with the owner's standalone direction

1. **Port-of-web scale.** Lágy's explicit goal is "the whole Lágy app, five domains, as native iOS" with exhaustive parity (`§13.4`, boop v1 spec §0). The owner's new direction rejects a port of the cluttered web app. The Lágy page inventory (30+ Edzés archetypes, Én rounds, Emberek/Kitüntetések) should be treated as a catalogue of what *exists*, not what to build.
2. **Gamification and social.** Medals ("Érmek"), leaderboards, quests, XP, trophies, share cards, 29-day habit grids, "Emberek" (people the user mentions). Napkelte already drops Életjelek/quests/XP; the standalone core (12 items) contains none of it, so these are candidates to drop.
3. **Five equal domains.** Lágy keeps the bottom bar as Nap/Edzés/Fuel/Mezo(Boop)/Én; the core has different seams (data in, nutrition, plans, sleep/day, AI/chat, journal). Whether the bar stays five domains is an open product call.
4. **The team of named agents.** Lágy shows Alvás/Mozgás/Étkezés/Közérzet/Mezo/Szkeptikus as visible personalities. Core item 9 wants domain agents cross-checking each other — compatible — but Napkelte's decision is a single companion "Boop"; the visible-team idea would need an owner decision.
5. **Photography dependence.** Lágy's golden rule requires a photo on every page and CC0 stock photos with download approvals; standalone/dark Napkelte uses generated sky, so none of it carries.
6. **Web-prototype-only tooling and rules** (probe.mjs, Artifact publishing, class-collision traps) do not apply to a native app.
7. **Light "paper" theme and Lágy rejections** ("no dark header", "no many hues", "no vessels") are the literal opposite of the shipped canon; do not let an old session re-import them (the v1 spec §0 still says Lágy is canon — a stale pointer that Napkelte §6 says must be annotated).
8. **Copy/wording drift:** Napkelte spec shows "kcal" while Lágy copy rules forbid it; decide which copy rule wins for the standalone app.
9. **Parity-first rule** (never drop a control of the old page) conflicts with a clean standalone app; replace with "core-12 coverage".

## 6. Doc / code drift noticed

- `docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md` §0 still names Lágy canon; Napkelte spec §6 promised a pointer — verify it exists.
- `docs/features/boop-ios.md` header still mentions "Lágy kit" for S1; `BoopDesign/Lagy.swift` and `LagyTabPage` / `LagyFlowFrame` remain as legacy and the boop SKILL §5 still tells builders to copy `LagyTabPage` — contradictory with "Napkelte is the canon".
- The Lágy canon lives only on an unmerged branch (`claude/mai-napom-custom-graphics-eedeb2`, "pushed, never merged"). If the owner wants it preserved as a reference, it needs archiving to main; otherwise it is at risk of deletion.

## 7. Open questions

1. Archive IRANY.md (and the `kepes` prototype) to main as a reference, or let it go?
2. Does the standalone app keep the five-domain bottom bar, or reorganise around the core 12?
3. Should the visible team (by field + Szkeptikus) exist in Boop, or only as hidden agents behind one Boop voice?
4. Which of the Lágy Edzés player rules are non-negotiable for core 4 (suggest: 30, 31, 33, 37)?
5. Gamification (medals, quests, XP, leaderboard): confirm drop.
6. "kalória" vs "kcal" in Boop copy.
