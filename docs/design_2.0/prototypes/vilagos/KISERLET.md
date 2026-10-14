# Kísérlet — the alternative prototype ("every page its own drawing")

Owner experiment, started 2026-10-11 (`mezo-pi0jf`). **Not the build target.** The approved Folyadék
prototype and the app build programme (`/folyadek`) go on unchanged; this runs beside them. The owner
decides what happens with it only after the whole alternative prototype exists (his words, 2026-10-12:
no rushed UI rebuilds — that went wrong several times before). Do not propose bible changes, rebuild
plans or "which direction wins" decisions until he asks.

- Page: `../kiserlet-napom-grafika.html` (the Folyadék shell + `kiserlet-napom.js`; the shell does not load it).
- Artifact (fixed): https://claude.ai/artifact/2ZdMk9D8jsjbFRhf2cB9cP — publish a copy of the shell with the
  extra `<script>` tag as `file_path`, all `vilagos/*.js` in `files`.
- Approved pages stay reachable inside the experiment as `<route>-lista`.

## Rules the owner set (in the order he set them)

1. **No cards, no lists.** A unit is separated by its own graphic, not by a box or a row.
2. **No hero vessel.** The page opens with plain words (eyebrow, verdict, the one number, the one button).
3. **Every page gets its own graphic, the one its content asks for.** Do not carry one device across pages
   (the pipe was tried on A napom and everywhere else and dropped on 2026-10-14 — no app feeling). Ask "what is this page about?" first.
4. **The four "Mai szintek" tubes are liked** — tubes in a row stay as they are wherever they appear.
5. **Grouping without cards = layers.** Each logical unit is one full-width layer (`.bd` / `.bd w`, or
   `band()` inside a drawing); layers alternate between the ground and a lighter one with a wave edge.
6. **One page (or sub-page) per round**, in the order of the domain's page map; show it, wait for his word.
7. It has to work for any user: variable counts (habits, messages, log entries) must just add rows/layers.

## UX floor (owner-approved round, 2026-10-12) — applies to every page, old and new

- **Text:** nothing renders under 12 px on a 360 px phone. Text inside a drawing scales with the drawing, so it
  is at least 13 user units there. No faint grey for anything that carries information.
- **Targets:** every tappable thing has a 44 px target (text links, small buttons, segment tabs), even when its
  drawing is smaller.
- **What is tappable says so, one way:** a blue "… ›" line (or a "›" at the row's end). A drawing without it
  does nothing when tapped. Never make a decorative mark look tappable.
- **Words are left-aligned, always.** The vessel may change sides; the text block never flips its alignment.
- **Length:** a hub page aims at three phone screens at most; long repeating content shows the newest three and
  opens the rest on a tap (the jar on Mai). On a hub, a unit that has its own page appears in its short form.
- **No explanatory sub-lines** (owner, 2026-10-12, on Mai): a section heading stands alone; under a number only its
  name (Kalória, Fehérje…); under an action only its name and its "… ›" line. Grey helper sentences go.
- **On the page: the drawing and one action. The words open in a bottom sheet** (owner, 2026-10-12, on the
  observation). A unit whose text can be any length shows heading + drawing + one "… ›" line; sentence, answers and
  evidence live in the sheet. Bottom sheet for a short look-and-answer; a page for something you stay in; a centred
  dialog only for a confirmation that blocks.
- **Round 6 (owner, 2026-10-14, after Strava), tried on Mai first:** one ground for the whole page, sections divided by a
  wave LINE only (no alternating layer colours); cards ONLY inside a card carousel for several parallel things
  (Észrevétel, Továbbiak) — a single block is not a card (the top card was tried and dropped the same day). The layer rule above holds for the other pages until he says so.
- **No repeats:** two pages never open with the same sentence; one action has one entry point per page.
- **One thing moves per screen** (the pipe's flow on A napom, the next vessel on Rutin). Levels and drops stand still.
- **A drawing explains itself in words, not with a legend** ("4 nap egybevág · 3 még hiányzik", "erő 82%").
- **Rows read left to right, every row.** A chain that wraps runs back under the labels to the next row's start.
- **The page's one action sits by the thumb** when the page is about doing (Rutin: the bottom action bar).
- Open: the floating "+" still covers content at the bottom right (made smaller only). Moving it into the bottom
  bar would change the approved navigation — the owner's call, not raised yet.
- Measure with the audit script idea (first screen, text sizes, targets, page length) before showing a page.

## Pages

| Page | Graphic | State |
|---|---|---|
| Nap · Mai | the old hero vessel WITHOUT its card (liquid free-standing, rounded bottom; owner's pick 2026-10-14 — the arc, the flat day line, a plain level and full-width liquid were tried) (no button in the vessel — the check-in starts from Most következik, owner 2026-10-14) · next three vessels with real pill buttons · tubes · observation carousel · icon carousel; one ground with wave-line dividers | **DONE (owner, 2026-10-14) — the reference page for the next ones** |
| Nap · Mai · Most következik (2026-10-14) | a card-less carousel (about three in view, a peek of the next, dots): the due check-in (full drop), the open training (kettlebell), Szándék when the day has none (t-compass), Napzárás 21:00 (t-moon), Esti rutin (t-chain) — every kind the real hub can put there (NapHubPage: check-in, Napzárás, Esti rutin, Edzés) plus the intention. Things with no drawing of their own use an empty glass drop with the coloured icon (`V.icd`). The prototype-only "Vacsora" item is gone (the real app never shows a meal there). A napom has a no-intention face: `#w-nap-napom.nincs` ("Még nincs szándékod mára." + Megadom). | shown 2026-10-14, waiting for feedback |
| Nap · Mai · Napi küldetések | three flasks; a finished one pours into the day's XP collector | shown 2026-10-12, waiting for feedback |
| Nap · Mai · Check-in | the four snapshots side by side: a column per moment, a row per core feeling; a finished column opens its snapshot in a sheet; the due one sits in the bottom action bar | shown 2026-10-13, waiting for feedback |
| Nap · Mai · Gyors logolás | — the approved page stays. A drawn version (nine drops above the day's jar) was shown 2026-10-13 and NOT picked; do not redraw it. | kept as approved |
| Nap · Mai · Életjelek (detail) | the six tubes in two rows on two shelves, each with its own action; the low one in the bottom action bar | shown 2026-10-13, waiting for feedback |
| Nap · A napom (today, closed day, sparse day) | round 9 (owner 2026-10-14): top = the verdict sentence + the day's four check-ins as four drops in a row (filled to the energy; under each: the moment, "energia N", "hangulat N"; the due one is an open drop with "Kitöltöm", later/missed ones dashed). The arc chart (energy liquid + mood line on a time axis) was tried the same day and was unreadable to the owner · A nap szándéka (creed + foci; live: "Szerkesztem", closed: the evening answer) in place of Most érdemes (dropped) · Hat terület = stacked cards with preview + Részletek drawer · Mezo highlights carousel + Körülmények (closed) · Te és az app (the U-vessel, "magnet") at the bottom. Rejected: the pipe; Mai's tank on top; the U-vessel on top. Closed day is ~3.5 screens. | shown 2026-10-14, waiting for feedback |
| Nap · A napom · closed day (round 11) | owner 2026-10-14: a closed day opens with the main score (big number + a level bar with the base mark) and the adjustment sentence, then Mezo's overnight evaluation IN FULL on the page (feedback thumbs, "Beszélgess a napról"); the buttons "Beszéljünk a napról" and "Körülmények" sit in one row; "Körülmények" opens Te és az app + the circumstances in a drawer (owner, same day, to cut length); then highlights carousel, six area cards, the four check-in drops, the intention, Tovább. ~3.7 screens. | shown 2026-10-14, waiting for feedback |
| Nap · Beszélgetés · Üzenetek | depth: newest at the surface | shown |
| Nap · Beszélgetés · Életjelek | rack of six tubes, the remark as a tag on its tube | shown |
| Nap · Beszélgetés · Észrevételek | communicating vessels, pipe of evidence days | shown |
| Nap · A napom · area drawer (Részletek) | one skeleton for all six (the area's vessel big + number + status/weight chip, then its own drawing, Mezo's text, one action): Tápanyag = calorie level + three macro tubes with target chips · Minőség = two levels with target marks · Edzés = the day's sessions · Alvás = the night on a 21:00–09:00 strip + bed/wake/quality + sleep time vs goal · Logolás = four check-in drops · Ritmus = the week's day vials. Today, closed day and sparse day variants. No wave lines inside the drawer (owner: overdone). | shown 2026-10-14, waiting for feedback |
| Nap · Rutin | chain links, three vessels per row | shown |
| Nap · Rutin · szerkesztés, lánc, szokások, új rutin | — | to do |
| Nap · Napzárás (6 steps) | — | to do |
| Edzés, Fuel, Mezo, Én | — | to do, after Nap |

## Traps paid for here

- A class named `top` (and other short kit names) is already styled by the kit — prefix everything.
- The week strip navigates to `nap.<date>`; a tab left on a removed route falls back to Mai. Keep aliases.
- Fragments cut out of the approved page (`cutOut`) depend on exact markup strings in `nap.js`.
- A Folyadék-jel icon on liquid needs all three: `--ic:#fff; --ic2:rgba(255,255,255,.3); --icf:transparent`. Without
  `--icf` the glyph's body fills near-white and closed shapes (ball, scale, clipboard, notebook) become blobs.
- In the drawings text is SVG text: break lines by hand, and check 320 px.

## Hand-off (2026-10-14) — how the next session continues

**Mai is done** and is the model for every other page. What it looks like now (route `#w-nap-mai`, `mai2()`):
- One ground for the whole page (`.mx`), sections divided by a wave LINE only (`.mx-s.ln`). No alternating layers.
- Top: the old hero vessel WITHOUT its card (`maiHero()` = `F.tank` in `.tk-lebego`): the sentence on the ground, the
  liquid free with a rounded bottom, big number + "a 100-ból…" caption + scale. No label above the sentence, no button
  in the vessel.
- "Most következik": three vessels with real pill buttons (`.mx-btn`, the current one filled).
- "Mai szintek": the four tubes, number + name only, target marks on white chips.
- "Észrevétel": a card carousel (`.cr`), one observation per card (drawing + one pill button; details in a sheet),
  dots under it. "Összes ›" in the heading.
- "Továbbiak": a carousel of icon cards (8 items incl. Check-in), dots = stops.
- A closing section with a full-width outlined "Nem vagyok jól ma" button, then room for the floating "+".
- Cards ONLY inside carousels. No grey explanatory sub-lines. Buttons look like buttons.

**Next:** bring the other Nap pages to the same level, one page per round, with the owner looking at each:
A napom (today, closed day, sparse day) → Beszélgetés (Üzenetek, Életjelek, Észrevételek) → Rutin → Check-in →
Életjelek (detail) → Napi küldetések; then the pages not drawn yet (Mai special faces, Rutin editing, Napzárás).
For each: switch to the Mai system (one ground + wave lines instead of `.bd`/`band()` layers; cards only in
carousels; pill buttons; no sub-lines), then run the UX floor checks, then show it and wait.

**Working loop (keep it):** edit `vilagos/kiserlet-napom.js` only → `node -e "new Function(...)"` syntax check →
Playwright screenshots at 390 and 320 (scratchpad scripts; `frontend/node_modules/@playwright/test/index.mjs`;
local server `python3 -m http.server 8757 --bind 127.0.0.1` in `docs/design_2.0/prototypes/`) → audit (text ≥12 px,
targets ≥44 px, no overflow, no missing icons) → look at the screenshots → commit + push the branch
`claude/mai-napom-custom-graphics-eedeb2` → republish the artifact (a publish subagent reads the file and publishes
the scratchpad shell copy `a-napom-rajzolva.html` + all `vilagos/*.js`; rebuild that copy from `klinikai-iranyok.html`
with the extra `<script src="vilagos/kiserlet-napom.js">` and the default hash `#w-nap-mai` if the scratchpad is gone).
Report to the owner in Hungarian, short, then wait.
