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
   (the pipe is right for A napom and was wrong everywhere else). Ask "what is this page about?" first.
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
| Nap · Mai | the day as a flat line (06–22) filled to now, the number beside the sentence (the arc, a liquid layer and a plain level were shown and not picked) · next three vessels · tubes · observation (sheet) · the day's jar · seven icon links | shown; special faces (üres, hiba, kímélő, este) not drawn |
| Nap · Mai · Napi küldetések | three flasks; a finished one pours into the day's XP collector | shown 2026-10-12, waiting for feedback |
| Nap · Mai · Check-in | the four snapshots side by side: a column per moment, a row per core feeling; a finished column opens its snapshot in a sheet; the due one sits in the bottom action bar | shown 2026-10-13, waiting for feedback |
| Nap · Mai · Gyors logolás | nine drops above the open mouth of the day's jar (the jar of Mai napló); Mezo as the spoken way in | shown 2026-10-13, waiting for feedback |
| Nap · Mai · Életjelek (detail) | — | to do |
| Nap · A napom (today, closed day, sparse day) | the pipe through six vessels | liked |
| Nap · Beszélgetés · Üzenetek | depth: newest at the surface | shown |
| Nap · Beszélgetés · Életjelek | rack of six tubes, the remark as a tag on its tube | shown |
| Nap · Beszélgetés · Észrevételek | communicating vessels, pipe of evidence days | shown |
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
