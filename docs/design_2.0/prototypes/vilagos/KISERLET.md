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
- **Tab pages' header** (owner, 2026-10-19): no big page title (it repeated the active tab) and no date line; the "?" guide sits top left, in the row of the header buttons. Sub-pages with a back button keep their title.
- **Dividers are straight lines** (owner, 2026-10-19): the wave line between sections was replaced by a plain thin straight line everywhere.
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
| Nap · Mai · special faces (2026-10-19) | `#w-nap-mai.ures` (sentence "Még üres a napod…", empty tubes except the carried-over ones, the vessel shows their average), `mai.hiba` (an info drop + "Nem sikerült betölteni a mai napot." + Újra; only Továbbiak and the closing button stay), `mai.kimelo` / `mai.kimelo-lejart` (a "Hogy vagy?" block on top with Jobban vagyok / Még nem / Tévedés volt, later and confirm states; smaller vessel without a sentence; Mozgás tube marked "szünet"; Pull Day → Kimarad; no "Nem vagyok jól ma"), `maieste` (dusk vessel, "Tegyük le a napot.", Napzárás / Esti check-in / Esti rutin) | shown 2026-10-19, waiting for feedback |
| Nap · Mai · Napi küldetések | three flasks; a finished one pours into the day's XP collector; round 15 (2026-10-17): one ground, no eyebrow, the collector's caption just "a 60-ból", each offer on a card (flask, name + XP chip, the task, real buttons), the Részletek drawer in the area-drawer skeleton (flask + XP, the task and why, Hogyan záródik, Ha kimarad, the action, Cserélem) | shown 2026-10-17, waiting for feedback |
| Nap · Mai · Check-in | the four snapshots side by side: a column per moment, a row per core feeling; a finished column opens its snapshot in a sheet; the due one sits in the bottom action bar | shown 2026-10-13; round 14 (2026-10-17): one ground, no eyebrow, the group label became a wave line + the heading "Napszakhoz kötött" inside the grid |
| Nap · Mai · Gyors logolás | — the approved page stays. A drawn version (nine drops above the day's jar) was shown 2026-10-13 and NOT picked; do not redraw it. | kept as approved |
| Nap · Mai · Életjelek (detail) | the six tubes in two rows on two shelves, each with its own action; the low one in the bottom action bar | shown 2026-10-13, waiting for feedback |
| Nap · A napom (today, closed day, sparse day) | round 9 (owner 2026-10-14): top = the verdict sentence + the day's four check-ins as four drops in a row (filled to the energy; under each: the moment, "energia N", "hangulat N"; the due one is an open drop with "Kitöltöm", later/missed ones dashed). The arc chart (energy liquid + mood line on a time axis) was tried the same day and was unreadable to the owner · A nap szándéka (creed + foci; live: "Szerkesztem", closed: the evening answer) in place of Most érdemes (dropped) · Hat terület = stacked cards with preview + Részletek drawer · Mezo highlights carousel + Körülmények (closed) · Te és az app (the U-vessel, "magnet") at the bottom. Rejected: the pipe; Mai's tank on top; the U-vessel on top. Closed day is ~3.5 screens. | shown 2026-10-14, waiting for feedback |
| Nap · A napom · closed day (round 11) | owner 2026-10-14: a closed day opens with the main score (big number + a level bar with the base mark) and the adjustment sentence, then Mezo's overnight evaluation IN FULL on the page (feedback thumbs, "Beszélgess a napról"); the buttons "Beszéljünk a napról" and "Körülmények" sit in one row; "Körülmények" opens Te és az app + the circumstances in a drawer (owner, same day, to cut length); then highlights carousel, six area cards, the four check-in drops, the intention, Tovább. ~3.7 screens. | shown 2026-10-14, waiting for feedback |
| Nap · Beszélgetés · Üzenetek | round 12 (2026-10-14): the water layers went — sentence + "Beszélgess Mezóval" on top, the team's live topic with "Belehallgatok", then Ma / Tegnap with one card per message (team badge, name, time, kind chip, two-line preview, Elolvasom; "új" on the new ones). The Elolvasom drawer (owner: "very basic"): team badge + who/when + the kind as a title, the message at reading size, "Amire épült" chips, "Miből gondolom" rows with icons, the message's action, thumbs feedback with reasons | shown 2026-10-14, waiting for feedback |
| Nap · Beszélgetés · Életjelek | REMOVED (owner 2026-10-14: "I never look at them there"). The six tubes moved to Mai, a section right under the vessel (whose number is their average); each tube goes where you fill it (Étel→Fuel, Víz→+250 ml, Alvás→sleep sheet, Mozgás→Edzés, Kapcsolat→check-in, Rend→Rutin). The detail page is not needed (owner); Továbbiak lost its Életjelek item. Mai szintek was removed from Mai (owner, same day) and each sign got its own colour (Étel green, Víz cyan, Alvás violet, Mozgás coral, Kapcsolat rose, Rend teal; a low one keeps its colour + the "figyelj" chip). | shown 2026-10-14 |
| Nap · Beszélgetés · Észrevételek | round 12 (2026-10-14): one ground, the sentence on top, each observation on the same fixed-size card as Mai's carousel (communicating vessels + evidence-day pipe inside) plus, here only, the first sentence of the observation under the title (owner: "show more"), closing full-width "Beszéljük meg" | shown 2026-10-14, waiting for feedback |
| Nap · A napom · area drawer (Részletek) | one skeleton for all six (the area's vessel big + number + status/weight chip, then its own drawing, Mezo's text, one action): Tápanyag = calorie level + three macro tubes with target chips · Minőség = two levels with target marks · Edzés = the day's sessions · Alvás = the night on a 21:00–09:00 strip + bed/wake/quality + sleep time vs goal · Logolás = four check-in drops · Ritmus = the week's day vials. Today, closed day and sparse day variants. No wave lines inside the drawer (owner: overdone). | shown 2026-10-14, waiting for feedback |
| Nap · Rutin | chain links, three vessels per row; round 13 (2026-10-15): one ground with wave lines, no eyebrow, routine titles without numbered drops (the perfect counter beside, wrapping left under it on narrow phones), the row-wrap line one continuous line into the next row's first vessel, "Rutinok szerkesztése" as the closing full-width button; the bottom action bar stays | shown 2026-10-15, waiting for feedback |
| Nap · Rutin · szerkesztés, lánc, szokások, szokás, szerk, új szokás | round 18 (2026-10-19): the approved content in the new system — Rutinok hub (sentence, three tiles, cards with buttons: Reggeli lánc, Szokásaid, Új szokás, Új lánc, AI javaslat; closing "Pipálás a Rutin fülön") · Reggeli lánc (five tubes, numbered step cards with strength bars; edit mode from the bottom bar: name + napszak, Feljebb/Lejjebb, pause) · Szokásaid (four stage tubes as filters, habit cards with a mini tube) · a habit (maturity tube with the four stages, recipe chips, three context tubes, 29-day grid, weekday tubes; Szerkesztés in the bottom bar) · Szerkesztés (segmented toggles, inputs, chips, effort selector, pause/delete; Mégse/Mentés) · Új szokás wizard (progress bar, recipe chips filling step by step, framework cards; Vissza/Tovább). Originals at `<route>-lista`. | shown 2026-10-19, waiting for feedback |
| Nap · Napzárás (6 steps) | round 16 (2026-10-19): the approved content and order on one ground; a 6-segment progress bar; the day's jar fills through the steps and gets its lid at the end (1: jar 72 + the five next steps as icon drops · 2: the four check-in drops + 2×2 numbers · 3: jar 7 + text area + three gratitude lines, "Ma nem írok" in the bottom bar · 4: three cards to act on (check-in, intention Igen/Részben/Nem, Beírom) · 5: +185 XP as a layered jar with its five sources + level bar + three numbers · 6: lidded jar, Mezo's line, Lecsendesítés / Villanyoltás); Kilépés + the step's button in the bottom bar. Round 17 (owner: "no back button, lame and basic"): Vissza on every step (bottom bar, header arrow), a soft evening ground, a large picture on top of each step with "N. lépés · name" above the heading, a timeline for what comes next, soft white tiles for the numbers, Mezo's line as a quote | shown 2026-10-19, waiting for feedback |
| Edzés, Fuel, Mezo, Én | — | to do, after Nap |

## Traps paid for here

- A class named `top` (and other short kit names) is already styled by the kit — prefix everything.
- The week strip navigates to `nap.<date>`; a tab left on a removed route falls back to Mai. Keep aliases.
- Fragments cut out of the approved page (`cutOut`) depend on exact markup strings in `nap.js`.
- A Folyadék-jel icon on liquid needs all three: `--ic:#fff; --ic2:rgba(255,255,255,.3); --icf:transparent`. Without
  `--icf` the glyph's body fills near-white and closed shapes (ball, scale, clipboard, notebook) become blobs.
- In the drawings text is SVG text: break lines by hand, and check 320 px.

## Hand-off (2026-10-19) — the whole Nap domain is done; next: Edzés

**Nap is complete** in the new system (owner liked it, 2026-10-19: "tetszik"). Every page is in the table above with what it
became; originals stay reachable at `<route>-lista`. The system, as it stands now:
- **Tab pages' header:** no big title, no date line; the "?" guide top left in the header button row (`hubHead()` wraps every
  route's output). Sub-pages (back arrow) keep their title.
- **One ground**, sections divided by a thin **straight line** (`.mx-s.ln`; the wave line was dropped 2026-10-19).
- **The sentence on top** (`.n7-h`), then the page's own picture: Mai = the free-standing tank (avg of the six életjel) ·
  A napom = the four check-in drops (`arc()`), closed day = big score + level bar + Mezo's full evaluation · Napzárás = the jar.
- **Cards where things stand side by side to act on** (`.n8-c`: drawn icon/vessel in a glass drop `V.icd`, name + number,
  a two-line preview, real pill buttons `.n8-b` / filled `.n9-btn`), **card carousels** for parallel things (`.cr`, fixed
  card size), **card-less carousel** for Most következik (`.mx-next.cr0`).
- **Drawers** (bottom sheets) use one skeleton (`.dv`: the thing big + number + chip, its own drawing, Mezo's text, one action);
  no lines inside a drawer.
- **Tubes** (`F.vials`, `.ej6`) for levels, each sign its own colour (`EJC`).
- **Bottom action bar** (`.rt-foot`/`.nz-foot`: secondary "Vissza" + wide primary) on pages about doing.
- **Toggles redraw in place** (`reGo()` = hashchange, no history push).
- No grey helper lines, text ≥12 px at 320, targets ≥44 px (toggles 40 min), words left-aligned, page ≤~3 screens.

**Rejected on Nap (do not redo):** the pipe; Mai's tank reused on A napom; the U-vessel ("magnet") as hero; the arc chart;
wave dividers; numbered drop headings; the drawn Gyors logolás; Életjelek detail page (tubes now on Mai; tap goes where you fill).

**Next: Edzés** (then Fuel, Mezo, Én). Same method per page: screenshot the approved page (`vilagos/edzes.js`, routes
`#w-edzes-*`), say in Hungarian what changes, build it in a new experiment file or a new section (keep the Folyadék shell
untouched; register overrides like the Nap ones, keep originals as `-lista`), check 390/320 + audit + click test, commit,
push, republish via the publish subagent (reads the file, diffs against its saved copy, publishes the scratchpad shell copy
`a-napom-rajzolva.html` + all `vilagos/*.js`; if the scratchpad was cleaned, rebuild the copy from `klinikai-iranyok.html`
with the extra `<script src="vilagos/kiserlet-napom.js">` and default hash `#w-nap-mai`). Scripts `shot2.mjs` / `audit.mjs`
live in the scratchpad and get cleaned by the system: recreate them when missing.

**The published prototype opens on the page being worked on** (owner, 2026-10-21): every round, set the default hash in
`kiserlet-napom-grafika.html` and in the scratchpad shell copy `a-napom-rajzolva.html` to the route of that round
(e.g. `#w-edzes-terkep`), so the owner never has to navigate there by hand.

## Hand-off (2026-10-30) — Edzés: four tabs done; next: the workout journey

All in `vilagos/kiserlet-edzes.js` (overrides on `FREG.edzes.routes`, originals kept at `<route>-lista`):

- **Mai** + "Miért marad ki?" drawer (earlier rounds).
- **Terv** — six-week tubes as the picture, the week's days as a carousel (today first), muscle tubes, plan cards; faces `.elso`, `.ures`, `.nincs`.
- **Terhelés** — front/back body hero with three facts; group tubes open a **parts drawer** (every part of the group, arm split
  into Bicepsz/Tricepsz rows, "lemaradt" / "nincs a tervben"); `sportWeek()` (the week's sessions as drops, the body sport
  works, Mezo's line); faces `.elotte`, `.megvan`, `.ures`.
- **Izomtérkép** — larger bodies, tap a muscle (bounding-box hit test) or one of five group buttons → the parts drawer.
- **Gyakorlatok** — search pill + five group wheels (one group at a time, default Láb; search spans all); one card shape per
  exercise: drawing, name, part, max, "Legutóbb … · date", a badge with the change in numbers (owner rejected the list
  sparkline: "semmit nem mond"). **Exercise page** (sentence = next goal, kg + approved curve, record tiles, medal carousel
  old → new, where-used cards, edit/video buttons), **Medálok** (drop shelf, month sections, old → new), **new/edit
  exercise drawer** (muscle picked on the body, parts as pills, type switch).

Rules learnt in these rounds: a carousel always gets its dots; a picture must say something (no decorative curves); one
object
= one card shape in the same order everywhere; the published artifact opens on the page being worked on (set the default
hash in `kiserlet-napom-grafika.html` and the scratchpad shell copy every round); republish with the artifact `url` passed
explicitly (a path-only publish once created a duplicate after a date change).

**Next:** the workout journey — eligazítás (`#w-edzes-indulas`), edzés közben (`#w-edzes-session`), összegzés
(`#w-edzes-review`); then sport/futás pages. Same method: screenshot, say in Hungarian what changes, wait for the OK, build,
verify 390/320 + audit + click test, commit, push, republish.
