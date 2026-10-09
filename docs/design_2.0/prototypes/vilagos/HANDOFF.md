# Folyadék — handoff (state on 2026-10-08)

The owner chose **Folyadék** as the app's new UI identity after eight rounds. This file is the
memory of that journey. Read it before touching the prototype, the spec or the skill.

## Where things are

- **Prototype (the build target):** `docs/design_2.0/prototypes/klinikai-iranyok.html` (shell)
  + `vilagos/kit.js` (structure and helpers, `window.F`) + `vilagos/foly.js` (the Folyadék
  look and liquid primitives) + one file per domain `vilagos/{nap,edzes,fuel,mezo,en}.js`
  + `vilagos/koncepciok.js` (`k2inner` = the approved Nap · Mai concept screen).
  Agent brief and kit reference: `vilagos/README.md` (its last part, "FOLYADÉK", is current).
- **Artifact (owner's link, fixed):** https://claude.ai/artifact/Ax6faqjyEd6Xxw2J7MN45M
  Publish with the shell as `file_path` and the changed `vilagos/*.js` in `files`
  (`elo/*.html` are already published for the "Jelenlegi" view).
- **URL scheme:** `#w-<domain>-<route>[.<arg>]` = Folyadék · `#j-…` = the living prototype
  (`elo/<domain>.html`) in the same frame. Domains: `nap edzes fuel mezo en`.
  Serve: `python3 -m http.server 8731 --bind 127.0.0.1` in `docs/design_2.0/prototypes/`.
- **Tracker:** programme epic `mezo-n4wf5` (children `.1`–`.9` = slices C1–C9, none started).
  Direction issue `mezo-juo1e` is closed.
- **Verification scripts** (scratchpad, session-local; recreate if gone): a Playwright sweep
  over every route of all five domains at 390 and 320 px (322 loads; console/page errors,
  missing `<use>` ids, `.scroll` overflow). Import Playwright from the absolute path
  `frontend/node_modules/@playwright/test/index.mjs` (ESM ignores `NODE_PATH`), reload per
  route. Last run: 0 problems.

## STALE — must be rewritten before the build programme starts

- `docs/superpowers/specs/2026-10-07-csepp-irany-design.md` and
  `.claude/skills/cseppesites/SKILL.md` describe the **rejected** "clinical csepp" direction
  (dark graphite, steel icons, open lists). They are wrong now. The owner said: no skill
  until the prototype is settled. When he says go: rewrite both for Folyadék (light only,
  the page skeleton, the liquid language, per-page graphics), then start C1.
- `CLAUDE.md` §Design direction still says Üveg. Update it with the spec.
- `csepp/*.js` and `tiszta/*.html` are earlier rounds, kept only as content/parity sources.

## The journey (what was rejected and why — do not drift back)

| Round | What | Owner's verdict |
|---|---|---|
| Current app | Üveg: warm dark glass, 3D icons, Boop creatures | "tamagotchi, játékos, komolytalan" — start of all this |
| 1 | Clinical dark · parchment light | "unalmas, száraz, elveszett a lélek" |
| 2 | Warm hybrid (orange accent, one glass card) | the warm/orange palette is not it |
| 3–4 | Clinical dark + 3D icons + the csepp + "quiet rules" (no boxes) → all five domains | liked for a day, then: "elveszti a lelkét, baromi unalmas" |
| 5 | Tisztított Üveg (living look decluttered, bubbles for Boops) | "nem jó. Összefolyik, nem értem mit hol látok, hova kéne nézni, hol keresni. A színvilág sem tetszik, a dark mode sem." |
| 6 | Világos klinikai: light, structure-first | **"az irány, a tisztultság jó"** but "unalmas, stock" |
| 7 | Világos · élő: + display font, domain colours, 3D icons, depth → all five domains | "jobb", then "még mindig egyhangú és stock" |
| 8 | Three bold concepts: Műszer · **Folyadék** · Magazin | **"folyadék tetszik"** |
| 9 | Folyadék on the whole kit + per-page graphics + restored detail | "jó az irány"; iterating on details |

Lessons:
- **Structure and look are separate problems.** The structure from round 6 is approved and
  must stay; the identity came only from a single bold idea (round 8), not from decoration.
- Restyling by reaction pendulums between "soulless" and "noisy". Offer **distinct concepts**
  on one screen, let him choose, then propagate.
- He judges by seeing. Show, don't describe. He sends screenshots of what is wrong — fix
  exactly those, verify with a screenshot, then answer.
- He cares about **content richness**: a thinner page than the living app is a regression
  ("a részletgazdagság elveszett"). The living prototype is the floor.
- Re-dressing through the shared kit converts ~350 screens at once; agents (one per domain,
  one file each) do the per-page work. Kit changes after agents finish need a full re-sweep.

## Approved decisions (owner)

1. **Light only.** No dark mode, not the old colour world. (Én · night mode alone is dark — open.)
2. **Page skeleton, every screen:** title bar (domain name + date, search, bell, settings) →
   the domain's pages as top tabs → **one hero** (a verdict sentence + one primary button) →
   **3–5 numbered sections** as cards, ordered *do now → today's numbers → insight → log* →
   deeper things behind rows (sub-page or sheet). **Bottom bar = the five domains, always**
   (not the domain's tabs; no hidden switcher). This is a navigation change vs. production.
3. **Folyadék = everything is a level that fills.** Heroes are vessels whose action row is
   waving liquid; numbers are levels (tank, vials, capsules, filled silhouettes); time-ordered
   things sit on a stream; correlations are communicating vessels; a time series is a liquid
   surface with a target waterline; the five domains are drops.
4. **Every page has its own signature graphic drawn from its own data** — not the same card
   with different text. One strong graphic per screen, the rest quiet.
5. **No progress rings** (only real clocks/timers). Levels instead.
6. **Icons live in glass bubbles**, never naked on white. The Titanium 3D icons stay, in
   their original colours.
7. **Colour = meaning:** domain colour world (Nap blue-teal, Edzés orange, Fuel green, Mezo
   violet-pink, Én teal) on hero/primary/active; state colours ok/warn/bad only for state;
   stable category colours for macros and muscle regions.
8. **Boop creatures are gone.** The five team members (Szunya, Mocor, Falat, Derű, Mezo)
   are liquid sibling forms (`who()` / `msg()`); the form is the sender, the text the voice.
9. **Keep:** the muscle-map graphics (MuscleChip / BodyMap) — he loves them; the Fuel · Mai
   content (calorie vessel with eaten/remaining, five macros, per-meal blocks with macros,
   glucose and score); the in-workout layout (one exercise as the hero with Rekordok ·
   Technika · Műveletek **on top**, the rest as rows, floating rest timer) — "edzés jó így".
10. **Behaviour frozen** for the build: every control, state and sheet of the live app stays.
11. Typography: Bricolage Grotesque for titles and numerals, Geist for text.

## Open questions (asked, not yet answered)

- Edzés · Mai hero: the body silhouette replaced the big dumbbell art — OK?
- Edzés · Terv: day cards are full cards (long page) — keep, or later days as rows?
- Mezo · Üzenőfal: the separate "Rád vár" list above the posts — keep?
- Én: night mode stays dark? The streak only in Kitüntetések — keep or remove?
- The "boop" name/logo (the header shows no wordmark now; the PWA name is unchanged).
- Several numbers and sentences are invented so graphics have something to show (the
  glucose curve and per-ingredient lists, some goal percentages, team "has something for
  you" levels, hero verdict sentences on pages that had none). Real data/copy needed in the build.
- Dates are inconsistent across domains (Nap: Oct 7; others: Sept 21–27).

## Fixed in the last round (owner's screenshots)

Check-in answers as capsules; buttons never wrap (sheet primary full width); in-workout
progress row as slim levels with an orange ring on the current; "te és az app" as two vials
(communicating vessels only where things really move together).

## How to work with the owner (CLAUDE.md §Communication)

Hungarian, business language, no file names or jargon; short; when asking for a decision:
situation → problem → 2–3 options in a table with the price → a recommendation. He is a
non-engineer product owner. Tell him plainly what was verified and what was not.

## Icons — decided 2026-10-08: "Folyadék-jel"

Owner: "az ikonkészlet színben, stílusban nem passzol" → shown three families (re-lit porcelain 3D,
domain-tinted 3D, own glyph) → **chose the own glyph family and asked for all of them**.
This supersedes approved decision 6 ("the Titanium 3D icons stay"): the 3D sprite was drawn for a
dark ground (graphite bodies, purple/gold light) and is too detailed for a 26 px slot.
- `vilagos/ikon.js` holds the whole family: 150 glyphs (`GLY`), each an outline in the domain colour
  half-filled with the domain liquid (`--ic` line, `--ic2` liquid; white on liquid grounds). It maps
  every `t-*` and the clay icons used in chrome; a MutationObserver swaps `<use>` hrefs.
- Review sheet for the owner: `#w-nap-ikonok` (all glyphs by group). Panel switch "Új / Régi ikonok".
- Redrawn once on request: muscle, soreness, digestion, kettle, tennis, whistle. A glyph in a vial is
  drawn twice (vial colour + white clipped to the liquid). Muscle-map graphics are untouched.
- For the build: this becomes the shared sprite; the swap layer is prototype-only scaffolding.

## 2026-10-09 — reviewed by eye, and two owner notes

- Every route, every arg variant (202) and every sheet (138) was looked at in screenshots at 390
  and at 320 px. 320 fixes live in `foly.js` (`@media (max-width:360px)`): smaller page titles so
  they clear the header buttons, hyphenated hero verdicts, wrapping labels in footers and sheets.
- **Back = where you came from** (owner: Rólad → Tények → back landed on Tudástár). The header back
  button now pops the history; its `back:` route is only the fallback for a direct link. Build rule:
  back never jumps to a "parent" the user did not come through.
- **Team names decided (2026-10-09):** the nicknames read childish, so each member is named by its
  field: Alvás (pihenés), Mozgás (terhelés), Étkezés (étrend), Közérzet (hangulat), Mezo (a csapat),
  plus the Szkeptikus. Internal keys stay `szunya/mocor/falat/deru/mezo`. "Szobája" is now "oldala".
  This supersedes the names in approved decision 8. Build: the same rename in app copy and prompts.
- Copy rule after the rename: the field name is a **label** (sender line, eyebrow "Alvás · rád vár"),
  and in a sentence it takes an article ("az Alvás szerint", "a Mozgás jelezte") or the sentence turns
  to "we" ("este megnézzük", "rákérdezünk"). Never a bare field name as a person ("Alvás este megnézi").
  `msg()` drops a meta that only repeats the name. "karakter" for a team member → "terület".
