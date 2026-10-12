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

## Pages

| Page | Graphic | State |
|---|---|---|
| Nap · Mai | the day's arc (06–22) filled to now · tubes · next three vessels · the day's jar of log layers | shown; special faces (üres, hiba, kímélő, este) not drawn |
| Nap · Mai · Napi küldetések | three flasks; a finished one pours into the day's XP collector | shown 2026-10-12, waiting for feedback |
| Nap · Mai · Check-in, Gyors logolás, Életjelek (detail) | — | to do |
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
- In the drawings text is SVG text: break lines by hand, and check 320 px.
