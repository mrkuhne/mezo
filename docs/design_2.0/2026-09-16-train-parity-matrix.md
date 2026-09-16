# Train domain — Titanium prototype ↔ production parity matrix

Evidence collected 2026-09-16.
Prototype: `http://localhost:5190/nap.html?r=102#train/*` (source: `docs/design_2.0/prototypes/companion-titanium/`).
Production: `http://localhost:5182/train/*` (mock mode), routes from `frontend/src/app/router.tsx`.
All screens were read live from the DOM (innerText + structural outline); no source file was changed.

---

## 0. Global shell (applies to EVERY row below)

| | Prototype | Production |
|---|---|---|
| Header | `mezo·` wordmark, a daypart pill (`Napközben ⌄`), avatar (`D`) | `boop` wordmark + **four** round icon buttons — `?` (Kalauz), Napszak, Mezo üzenetei **5**, Értesítések **4** — then the avatar (`header.nap-head.app-head`) |
| Date band | ONE row: `‹  MA · September 9., Szerda  ›`, footer hint `← Húzd oldalra a napváltáshoz →` | a **seven-day strip**: `HÉT 14 — / KEDD 15 ✓ / SZE 16 ✓✓ / MA 17 — / PÉN 18 — / SZO 19 — / VAS 20 pihenő` |
| Tab bar | `Edzés ⌃` domain switch + `Mai · Terv · Terhelés · Gyakorlatok` | identical (`Edzés ⌃` + the same four tabs) — **parity** |
| Extra layer | none | **`Kalauz · <oldal>` coach-mark dialog** auto-opens on `/train/mesocycles`, `/train/sport`, `/train/medals`, `/train/futas`, `/train/review/:id` (`KALAUZ · MESOCIKLUSOK 1 / 5 ✕ … Kihagyom / ‹ Vissza / Tovább`) |

**Severity: MAJOR** — the header wordmark, the extra two notification buttons, the `?`-Kalauz button and the seven-day strip are all production-only chrome wrapped around every Titanium screen; the prototype's single date row + swipe hint is absent.

---

## 1. `train/0` — Mai

**Production: `/train/mai` (`TrainTodayPage`)** — present.

| Prototype section (top → bottom) | Production |
|---|---|
| Poster `tr-day`: status chip `BETERVEZVE`, eyebrow `SZERDA 17:00 · GYM`, `h2 Felsőtest A`, `A 6 hetes „Alapból erő" blokk 3. hete.`, clay dumbbell spot graphic, pills `~45 perc · felsőtest · 3. hét / 6` | **present, different**: eyebrow `MA 07:30 · MAV · GYM`, sub `Hypertrophy 04 · 3. hét / 6`, pills `5 gyakorlat · 22 szett · ~67 perc`, plus an extra repeated `Pull Day` line under the pills |
| CTA `tr-start`: **`Kezdjük az edzést` / `A mai tervezett edzésed` →** | present-but-different: label **`Indítsuk`** (sub-line matches). Lands on the PREP screen, not the card list — see §11 |
| Heading `Bármi más, ami ma mozgás` + `GYORS INDÍTÁS` | **absent** — the heading is gone; the two tiles each carry their own `GYORS INDÍTÁS` eyebrow instead |
| Quick tiles `Egyedi edzés / Terv nélkül, most` and `Sport naplózása / Röplabda · futás · más` | present-but-different: sub-lines dropped |
| `A MAI KERETEDHEZ / Amit a mozgásod hozzáad / +260 kcal / … / Megnézem a mai keretem ›` | present (+525 kcal). **The tap-chip `Megnézem a mai keretem ›` is replaced by a note `Becslés, nem mérés.`** |
| `HATÁS AZ IZOMZATODRA / Mit terhel a mai mozgásod` + 4 muscle rows + note | present; 5 rows; note identical. Rows use `erős/enyhe/ma nem kap` instead of the prototype's `tervben erős` wording for a not-yet-started day |
| `HOLNAP 18:00 · SPORT / Röplabda / A vállad és a lábad is kap belőle ›` (`ahead()`) | **absent** |
| `További részletek` accordion (`TERHELÉS · REGENERÁCIÓ · TERV` → 3 secondary rows) | **absent** |
| — | **production-only**: a `Hypertrophy 04 · MAV · W3/6 — Sportjaid és szezonod` row, and a **`REGGELI EDZÉS` nudge card** (`Kedd 18:30 · Csü 18:30 → 07:45` / `Áthelyezés a reggeli ablakba` / `Maradjon így`) |

**Surrounding layers:** production wraps it in the `boop` header + 7-day strip (§0). The CTA leads into an extra screen (§11).

**Severity: MAJOR**

---

## 2. `train/1` — Terv (plan home)

**Production: `/train/mesocycles` (`MesoTervPage`)** — present.

| Prototype | Production |
|---|---|
| Hero numeral `3. hét / 6`, title `Alapból erő`, `A hat hétből a 3. héten jársz.`, prose `Ez a hét 8 szettel több…` | present; adds a phase word **`Emelkedés`** above the title; title `Hypertrophy 04 · Tavasz`; prose merged into one sentence |
| Week dots `1…6` | present |
| `A heted` — 7 day rows with `szett / perc / gyakorlat` | present, eyebrow uppercased to **`A HETED`**; 5 training days; `Szombat` row is `Volleyball · meccs` (prototype has only `pihenőnap`) |
| `Melyik izmod hol tart / 5 izom kap többet hétfőtől ↗` | present; sub-line `Hétfőtől minden izom tart` |
| `Edzéstervek / Amiből indíthatsz ↗` | present |
| `Edzésterv lezárása / Ha ezt a hat hetet végigcsináltad ›` | present |

**Surrounding layers:** production auto-opens the **`Kalauz · Mesociklusok` 5-step coach-mark dialog** on top of the page. Prototype has nothing of the kind.

**Severity: MINOR** (structure matches) — the Kalauz overlay is the only MAJOR element, counted in §0.

---

## 3. `train/1/day/{nap}` — one plan day

**Production: `/train/mesocycles/:id/days/:day` (`MesoDayPage`)** — present.

| Prototype | Production |
|---|---|
| Back `‹ Vissza` | `‹ A terved` |
| Eyebrow `MA · A TERV 3. HETE` + `Felsőtest A` + stat row `9 szett · 45 perc · 3 gyakorlat · a heted 13%-a` | present (`SZE · A TERV 3. HETE`, `Legs nap`, `19 szett · 96 perc · 6 gyakorlat · a heted 25%-a`) |
| `Mit terhel ez a nap` — muscle chips | present |
| `A nap gyakorlatai` — numbered `01…` cards with `szett × ismétlés / RIR / kg induló / bemelegítő` | present |
| `＋ Gyakorlat hozzáadása` — **end of screen** | present |
| — | **production-only, appended BELOW the Titanium page — an entire pre-Titanium editor**: `LEGS / 6 GYAKORLAT · ~96 PERC / 19 szett ma / Heti terhelés: 75 szett · 5 edzésnap / ⚠ 1 jelzés`, `MA · IZMONKÉNT / MAX 8 SZETT/IZOM`, `HETI SZETEK · IZMONKÉNT` (typo, and English `Grow` / `Maintain` / `Emphasize` labels), `CSÚCSHÉT · IDŐBECSLÉS ▾`, `STRUKTÚRA · 7 észrevétel ▾`, and a drag-handle exercise list `⠿ Barbell Squat · COMB · 🔥 4×6–8 ▾`, closing with `GYAKORLAT HOZZÁADÁSA` |

**Severity: BLOCKER** — a complete pre-Titanium screen is welded onto the bottom of the Titanium one (emoji `🔥`, `⠿` handles, English jargon, a duplicate exercise list and a duplicate add-CTA).

---

## 4. `train/1/week` — „Melyik izmod hol tart"

**Production: `/train/mesocycles/:id/week` (`MesoWeekPage`)** — present.

| Prototype | Production |
|---|---|
| `‹ Vissza` + `Melyik izmod hol tart` | `‹ A terved`, eyebrow **`HETI VIZSGÁLAT · 3. HÉT`** + same title + a hero numeral `88 szett ezen a héten` (prototype has no numeral here) |
| Prose `7 izomcsoportot edzel ezen a héten. 5 izomban van még hova nőni, 2 izmot csak szinten tartasz.` | present, same shape |
| — | production-only: `14 szettel több a múlt héthez képest.`, a live-system line `Élő rendszer · a következő görgetés hétfő hajnal`, and a summary chip row `Hát tart · Mell tart · … +3` |
| Muscle rows `Hát · 16szett · Még 4 szett fér bele. ›` | present; each row prefixed with the English-derived band word `Építés ·` / `Tartás ·` |
| Footer note `A sáv azt mutatja, hol tartasz… Koppints egy izomra, ha érdekel, miért pont ennyi.` | present, **plus a second note** `Koppints egy izomra: hol tartasz, mikor és miben dolgozik, honnan jön a szám… Piros itt sincs: a tartás is döntés, nem hiba.` |

**Severity: MINOR**

---

## 5. `train/1/muscle/{key}` — muscle detail

*(This screen DOES exist in the prototype — `planMuscle()` in `plan-pages.js:231`, reached from the week page's rows.)*

**Production: `/train/mesocycles/:id/week/:muscle` (`MesoMusclePage`)** — present.

| Prototype | Production |
|---|---|
| `‹ Vissza` + `Hát` + prose + `Hétfőn 2 szettel többet kapsz.` | present; adds eyebrow `3. HÉT · ÉPÍTÉS` and a hero numeral `14 szett hetente` |
| 3 stats `edzés hetente / szett az 1. héten / a legtöbb lesz` | present |
| `Hol tartasz` gauge (`10 ennyitől fejlődik · 20 eddig mész el`) | present, **plus** an explanatory paragraph `10 szett alatt nincs elég inger…` |
| `A hat hét` bar chart + deload note | present (`A 6 hét`) |
| `Hol edzed` day rows | present |
| `Az előző tervhez képest` (`Akkor 10 → 16 / Most 12 → 20`) | present (empty-state copy when there is no prior plan) |
| — | **production-only**: a whole `Honnan jön ez a szám` provenance block (`1 BASELINE · RP TÁBLA / 2 FÓKUSZ-SÁV · ÉPÍTÉS / 3 RÁD SZABVA / 4 EREDŐ · A BLOKKBAN`, `Mennyire biztos a sáv · 85%`, a `Felülír` action) and a closing note about the baseline |

**Severity: MAJOR** (production is a superset; the provenance block has no prototype counterpart)

---

## 6. `train/1/library` — „Edzéstervek / A terveid"

**Production: `/train/mesocycles/konyvtar` (`MesoKonyvtarPage`)** — present.

| Prototype | Production |
|---|---|
| `‹ A terved`, `EDZÉSTERVEK`, `A terveid`, lead `Ami most fut, ami következik, és amit már végigcsináltál — egy helyen.` | present; lead reworded to **`Itt élnek a terveid — ami fut, ami jön, és ami már mögötted van.`** |
| Stat strip `1 fut · 1 következik · 3 sablon · 2 lezárva` | present (`1 fut · 2 következik · 2 sablon · 3 lezárva`) |
| `Most fut` card + week dots `1…6` | present, **week dots absent**; replaced by a split line `Pull / Push / Legs · 5×/hét` |
| `Következik` card (`6 hét · 3 nap hetente · Felső / alsó` + `Akkor indul, amikor a mostani terved lezárul.`) | present (heading pluralised to `Következnek`) |
| `Új terv összeállítása / Sablonból indulsz, vagy nulláról építed ＋` | present |
| `Sablonjaid ↗` / `Lezárt futamaid ↗` | present (`3 lezárt terv története`) |

**Severity: MINOR**

---

## 7. `train/1/library/templates` — Sablonjaid

**Production: `/train/templates` (`MesoTemplatesPage`)** — present.

| Prototype | Production |
|---|---|
| `‹ Edzéstervek`, `SABLONJAID`, `Amiből indíthatsz`, lead `Egy sablon a recept — futamot indítasz belőle, és az már a te terved.` | **identical copy** |
| — | production-only stat strip `2 sablon · 2 futam indult belőlük` |
| Template cards (`6 hét · 3 nap hetente · ~48 perc` + provenance line) | present, identical shape |
| `Új terv összeállítása ＋` | present |

**Severity: MINOR**

---

## 8. `train/1/library/template/{key}` — one template, read-first

**Production: `/train/templates/:id` (`MesoTemplateStoryPage`)** — present.

| Prototype | Production |
|---|---|
| `‹ Sablonjaid`, `SABLON`, name, lead `6 hét, hetente 3 edzésnap — felső / alsó felosztásban.` | present; eyebrow carries the split (`SABLON · PULL / PUSH / LEGS`), lead shortened to `6 hét, hetente 5 edzésnap.` |
| Facts `~48 perc egy edzés · 7 izomcsoport` | present |
| `A hét felépítése` — day cards with exercise rows | present; adds `Szo Volleyball · meccs` / `Vas Pihenő` rows; starting weights show `—` |
| `Heti szettek izmonként` | present, **plus** an explanatory paragraph `Ennyi munkaszettet kap az izom egy héten…` |
| `Futamok ebből a sablonból` | present |
| `Futam indítása ebből / A sablon marad, a terv a tiéd lesz ›` | present |
| — | **production-only**: `Szerkesztés`, `Másolat készítése`, `Sablon törlése` action rows |

**Severity: MINOR**

---

## 9. `train/1/library/closed` — Lezárt futamaid (list)

**Production: `/train/mesocycles/futamok` (`MesoFutamokPage`)** — present.

| Prototype | Production |
|---|---|
| `‹ Edzéstervek`, `LEZÁRT FUTAMAID`, `Amit végigvittél`, lead `Minden lezárt terv itt őrzi a történetét — mit bírtál, és mit döntöttél meg.` | present; title **`Amit lezártál`**, lead reworded to `Minden lezárt terv itt őrzi a történetét — nyisd meg, és megnézheted, mit hozott.` |
| Stat strip `37 edzés · 10 rekord` | present-but-different: `3 lezárt futam · 20 hét összesen · Összevetés` (an action inside the stat strip) |
| Run rows: name, dates, `22 edzés a 24-ból · 7 rekord` | present-but-different: `8 hét · riport` + a free-text verdict line (`8/10 — Chest Row +12.5kg…`) + two action buttons per row (`Sablonná`, `Újrafuttatás`) |

**Severity: MAJOR**

---

## 10. `train/1/library/closed/{key}` — one closed run

**Production: `/train/mesocycles/:id/report` (`MesoReportPage`)** — present (reached from the list row).

| Prototype | Production |
|---|---|
| `‹ Lezárt futamaid` | `Vissza` (no chevron, different label) |
| Eyebrow `LEZÁRT FUTAM · JÚN. 15. – JÚL. 26.` + name + lead `A hátad vitte a legtöbbet — a végére húsz szettet is bírt hetente.` | present (`Erős futam volt.`) |
| 3 facts `22 edzés a 24-ból · 7 megdöntött rekord · 128 t összsúly` + `A tervezett edzéseid 92%-át végigcsináltad.` | present-but-different: a big `88 %` gauge + `8 hét / Lezárva · Ápr 23 / 21/24 EDZÉS / 8/8 HÉT` |
| `Izmaid ebben a futamban` (muscle + plain-word verdict + `10 → 20`) | present as `IZMONKÉNT · INDULÁS → ELÉRT CSÚCS / PLAFON`; the plain-word verdicts (`végig bírta az emelést`, `a negyedik héten állt meg`) are **absent** |
| `A mostani tervedhez képest` + note + 3 comparison rows | present, same shape |
| — | **production-only, pre-Titanium**: `HETI SZETTEK · A BLOKK ÍVE` chart with `MEV/MAV/MRV/DELOAD` jargon; `ERŐ · 6 GYAKORLAT`; `REKORDOK · 7 MEDÁL`; **`ÉLETMÓD-KONTEXTUS` emoji row** `😴 7,4 h alvás · 🍽 2429 kcal · ⚡ 6,5 energia · 😰 4,8 stressz · ⚖️ -1,1 kg · 🏐 760 perc · 🏃 9× futás`; a raw **spreadsheet table** (`Hét / Alvás / Kcal / Energia / Stressz / Súly Δ / Sport / Futás`, W1–W8); `SAJÁT ÉRTÉKELÉS`; `AI ÉRTÉKELÉS` (4 paragraphs) + `Újragenerálás`; `Újrafuttatás` / `Sablon mentése ebből a futamból` / `Riport újragenerálása` |

**Severity: BLOCKER** — the Titanium closed-run story exists, but a pre-Titanium report (emoji stat row + data table + AI prose) is stacked into the same page.

---

## 11. `train/1/new` (+ wizard steps) — Új terv

**Prototype flow:** `train/1/new` (source pick) → `new/basics` → `new/days` → `new/day/{nap}` → `new/focus` → `new/review`, with a persistent 4-step bar `Alapok · Napok · Izmok · Indítás`.

**Production: `/train/mesocycles/new` (`MesocyclePlannerPage`)** — present as a route, **but it is a different flow**.

| Prototype step | Production |
|---|---|
| **Source step** — `‹ Edzéstervek`, `ÚJ TERV`, `Miből induljunk?`, lead `Egy sablon a gyors út — de indulhatsz teljesen üres lappal is.`, 3 template cards + `Üres lappal / mindent te raksz össze` | **absent** — no template-vs-blank choice at all |
| **Steps bar** `Alapok · Napok · Izmok · Indítás` | **absent** |
| **`new/basics`** — `ALAPOK / Adj neki nevet és hosszt`, name field, `Hossz − 6 hét ＋`, week dots, deload note, `Tovább: a napok ›` | partially present as a `HOSSZ` slider (`4 5 6 7 8`, `6 hét = 5 rámpa + 1 deload`); **no name field**, no step CTA |
| **`new/days`** — `NAPOK / Melyik napokon edzel?`, 7 day toggles, per-day cards, `Tovább: az izmok ›` | partially present as `EDZÉSNAPOK 4 nap` + `H K Sze Cs P Szo V` toggles; **the per-day cards and the drill into a day are absent** |
| **`new/day/{nap}`** — `SZERDA / Felsőtest A`, reorderable exercise rows with `− 3 ＋ szett`, `Gyakorlat hozzáadása`, `A nap terhelése` | **MISSING — no such screen** in the creation flow (editing a day only exists later, on `/train/mesocycles/:id/days/:day`) |
| **`new/focus`** — `IZMOK / Melyik kapjon többet?` + Hungarian band choices `Tartás · Építés · Hangsúly` | present-but-different: `FÓKUSZ · MAX 2 HANGSÚLY` with **English labels `Emphasize / Grow / Maintain`** |
| **`new/review`** — `INDÍTÁS / <name>`, 3 facts, `Mikor induljon?` (3 Monday options), `A polcra teszem ›` | **absent** — replaced by `AMI MAGÁTÓL MEGY` (`5 + 1 rámpa + deload hét`, `+2 szett / hét / izom`, `~8 szett-plafon / edzés`) and a single **`✨ Program generálása`** button; no start-date choice |
| — | production-only: eyebrow `ÚJ BLOKK · INTERJÚ`, `A CÉLOD · OPCIONÁLIS` free-text field, a split preview (`2 FULL BODY … 6 PPL ×2`), `66 szett · 1. hét / 106 szett · csúcshét` |

**Severity: BLOCKER** — the prototype's 6-screen wizard is replaced by one pre-Titanium "interview" page; the source step, the per-day editor step and the review/start-date step have no counterpart.

---

## 12. `train/2` — Terhelés

**Production: `/train/week` (`TrainWeekPage`)** — present. *(`/train/gym` renders the SAME page — a duplicate route.)*

| Prototype | Production |
|---|---|
| Hero `TERHELÉS · 3. HÉT · RÁMPA` + `0 %` + `a heti munkádból megvan — 0 szett a 79-ből` + one prose line | present (`… · MAV` instead of `RÁMPA`) |
| — | production-only in the hero: `Időpontok`, `W3/6 ›`, `0 medál e héten` chips |
| `A tested térképe / Elöl és hátul, ami már dolgozott / 6 izom még munkára vár ezen a héten. ›` | present |
| `Izomcsoportok ezen a héten` rows | present; 9 rows; `Még N szett van hátra.` → `erre a hét második fele épül` for every row |
| `Sport a héten` — `Röplabda / 95 perc · 610 kcal · váll és láb is dolgozott` | present-but-different: `510 perc sport és futás a heti rendben` + `Ezeket is dolgoztatja: Váll, Láb, Core.` + `Becslés — a szettszámokba nem számít bele.` |
| `Minden mozgásod a héten / 151 perc gym és sport együtt · ~1002 kcal ›` | present, sub-line reworded |
| — | production-only: `+ Saját edzés` button and a jargon paragraph `A gym a mesociklus szerint, a sport (röpi/cross/TRX) **recurring · független**… együtt-mozgatja a **pacing**-et, alvás-**onsetet**…` |

**Severity: MAJOR** (the English-jargon footer paragraph and the extra hero chips are not in the prototype)

---

## 13. `train/2/map` — Izomtérkép

**Production: `/train/week/terkep` (`TrainWeekMapPage`)** — present.

| Prototype | Production |
|---|---|
| `‹ Terhelés`, `IZOMTÉRKÉP`, `Hol tart a tested?`, lead | **identical copy** |
| Toggle `Eddig megvolt / A heti terv`, `ELÖLRŐL / HÁTULRÓL`, legend `még vár · elkezdted · jó úton · megvan` | **identical** |
| `Még munkára vár` list | present (9 rows vs 6) |
| Footer note `A röplabda ezeken is dolgozott: … Becslés, nem mérés — a szettszámokba nem számít bele.` | present, `A röplabda` → `A sport` |
| **`Minden izomjel / A 21 izom, saját jellel, régiónként ›`** | **absent** — the doorway to `train/2/jelek` is gone |

**Severity: MAJOR** (the entry point to §15 is missing)

---

## 14. `train/2/mozgas` — Minden mozgásod

**Production: `/train/week/mozgas` (`TrainWeekMozgasPage`)** — present.

| Prototype | Production |
|---|---|
| `‹ Terhelés`, `MINDEN MOZGÁSOD`, hero `0 perc ezen a héten`, lead | present; eyebrow **`MINDEN MOZGÁSOD EDDIG A HÉTEN`**, hero split into numeral `90` + `perc` |
| `~1002 kcal a mozgásból` + the gym/sport split cards | present; the total-kcal line is **absent**, only the two split cards remain |
| `Izomcsoportok, sporttal együtt` rows with `sport is` flags | present |
| — | production-only: `Sport és futás a heti rendben` — 7 scheduled sessions with `Váll ▲▲▲ / Láb ▲▲ / Core ▲` arrow glyphs, + note `Becslés, nem mérés.` |

**Severity: MAJOR**

---

## 15. `train/2/jelek` — „Minden izomjel"

**Production: MISSING — no such screen.** There is no `/train/week/jelek` (or any equivalent) in `router.tsx`; `/me/jelek` (`JelekPage`) is the unrelated life-signals page.

Prototype content that has no production home: `‹ Izomtérkép` back link, `IZOMTÉRKÉP / Minden izomcsoport, saját jellel`, lead `Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó.`, and the 6 region groups covering all 21 muscles (`Mell 3 izom`, `Hát 4 izom`, `Váll 3 izom`, `Kar 6 izom`, `Láb 4 izom`, `Core 1 izom`) each with its own clay silhouette.

**Severity: BLOCKER**

---

## 16. `train/3` — Gyakorlatok

**Production: `/train/exercises` (`ExercisesPage`)** — present as a route, but it is an **entirely different, pre-Titanium page**.

| Prototype | Production |
|---|---|
| Poster `GYAKORLATOK / A mozdulataid` + lead `Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.` | **absent** — replaced by `EDZÉS · GYAKORLATOK / Gyakorlatok / Új gyakorlat` |
| Stat strip `19 gyakorlat · 3 rekorddal · 6 medál` | present-but-different: `21 / 5 rekord / 0 saját / 1 videóval` + a separate `Medálok` button |
| Filter chips `Mind · Mell · Hát · Váll · Kar · Láb · Core` | present as `Összes · Plyo · Mell · Hát · Váll · Kar · Láb · Core` |
| Search field `#gy-search` | **absent** |
| **Full catalogue** — 19 rows, each `név / izom / becsült 1RM / medálszám ›` | **absent** — production shows only `TOP GYAKORLATOK · REKORDJAID · 5 PR`, a ranked top-5 (`#1 … #5`) with letter-avatar circles, **English tags `COMPOUND` / `ISOLATION`**, and `LEGJOBB SZETT / E1RM / ÖSSZVOLUMEN`. The whole page is 718 characters of text — there is no list to scroll |

**Severity: BLOCKER**

---

## 17. `train/3/{key}` — exercise story

**Production: MISSING as a screen — no `/train/exercises/:id` route.** Tapping a card opens a **pre-Titanium modal sheet** titled `REKORDOK` instead.

| Prototype section | Production modal |
|---|---|
| `‹ Gyakorlatok` + eyebrow `MELL (KÖZÉP)` + `Fekvenyomás` + cue prose `Talpak lent. Stabil lapockák…` | cue prose absent; header is `REKORDOK` + name + `HÁT (KÖZÉP) · COMPOUND · 26 ALKALOM` |
| Facts `12 alkalom / jún. 3. óta / 18,2 t összsúly` | present in a different shape |
| `Rekordjaid` — `BECSÜLT 1RM 76,5 kg (+2,5 kg a múltkori óta)`, `LEGJOBB SZETT`, `LEGTÖBB VOLUMEN` | present (`LEGJOBB SZETT / BECSÜLT 1RM / LEGJOBB SESSION / ÖSSZ-VOLUMEN / SZETT · REP`) |
| `Következő cél: 62,5 kg × 9 — egy ismétléssel a legjobb szetted fölé.` | **absent** |
| **`Az erőd íve`** story-curve graphic (`0 kg most · eddig · a terv várakozása`) | **absent** |
| `Medáljaid` (3 medal cards) | **absent** from the modal (medals live on a separate `/train/medals` page) |
| `Hol szerepel` — `Felsőtest A / A futó tervedben · Szerda ›`, `Nyári tömegelés / Sablon a polcodon ›` | **absent** |

**Severity: BLOCKER**

---

## 18. OVERLAY A — the active workout (card list)

**Prototype:** `Mai`'s CTA (`[data-workout]`) opens the `.wo` full-screen overlay **immediately** — header `‹ / FELSŐTEST A · 3. HÉT / 6 / 0 / 9 szett / 4:44`, then one card per exercise (name, `⋮` menu, cue prose, `KG REP RIR` rows with `✓`), then `Edzés kihagyása` and the dock `0 / ELVÉGZETT MUNKA / 0 / 9 szett / Lezárás →`. **There is no screen between the CTA and this list.**

**Production: `/train/session` (`ActiveWorkoutPage`)** — present, but reached through an extra screen.

**PHASE 1 — production-only PREP screen** (confirmed): `← VISSZA / ? / SZERDA · W3 · MAV HÉT / Pull Day / +1192 várható XP / 15 szett / ~53′ idő / 3 izomcsoport / **⚡ Kezdjük el →** / GYAKORLATOK 5 gyakorlat · 22 szett / FEJLŐDÉS +1192 XP / HETI ZÓNA kész 0/5 edzés / KÜLDETÉSEK 0/4 elfogadva / BEMELEGÍTÉS 8 perc · 3 blokk / NIGGLE ! Jobb váll · aktív`. **The prototype has no such screen anywhere.**

**PHASE 2 — the card list** (after `⚡ Kezdjük el →`): the Titanium skeleton IS there (`Edzés kihagyása`, `ELVÉGZETT MUNKA`, `Lezárás →`), with pre-Titanium additions:
- a banner `⚠ Jobb váll aktív · óvatos, először warm-up`
- per-card `⚡ PROGRESSZIÓ / +2,5 kg ↑ / MÚLT HÉT / MA A CÉL` block (emoji)
- warm-up rows `B1 / B2` and an `OLDAL L B R` selector inside the set table
- the confirm sheet gains a title bar `Lezárás megerősítése ✕` (prototype's `.wo-glass-card.is-confirm` has none; the body copy is otherwise identical, word for word)

**Severity: BLOCKER** (the prep screen is a whole pre-Titanium phase in front of the Titanium overlay)

---

## 19. OVERLAY B — the ceremony + its details step

**Prototype (`session.js` `summary()` → `detailsStep()`, two steps inside the same `.wo` overlay, nothing else on screen):**
- **Step 1 `summary()`**: `A MAI EDZÉSED` (or `EDZÉS LEZÁRVA`), the 5-star ignition row, the comet bar, three counters (`szett` / `ismétlés` / `kg × rep`), `<n> csillag` as the sr-only heading, stats **`6′ a pulton töltött idő`** and **`+10 szerzett XP`**, an optional `Új rekord` row, and the single way on: **`Részletek / Izomcsoportok és a nyert kalória`**.
- **Step 2 `detailsStep()`**: `Izomcsoportok fejlődése a mai edzésen` (per-muscle rows with mini-stars and a zone track), `+29 kcal / Ennyit nyertél a mai mozgással ›`, `Edzés lezárása / 1 elvégzett · 8 még bepipálatlan`, `Vissza az értékeléshez`, note `Mintaedzés · a csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.`
- **The prototype's ceremony carries the XP itself** (`+<xp> szerzett XP`). There is **no** level/skill overlay, no emoji, no second layer. `runCeremony()` is the one-shot rAF choreography with a `prefers-reduced-motion` branch.

**Production:** on close, **both** of these render:
1. **In the page body** — a Titanium recap: `EDZÉS LEZÁRVA / 1 SZETT / 4 ISMÉTLÉS / 60 KG × REP / 0 csillag az ötből / Ma nem jött össze. / +480 SZERZETT XP`, then the pre-Titanium küldetés rows `PR-attempt · … SKIPPELTED`, `⚡ Túlterhelés · … SKIPPELTED`, `Mélység · …`, `Volumen · …`; then `Izomcsoportok fejlődése a mai edzésen`, `+24 kcal / Ennyit nyertél a mai mozgással / Becslés, nem mérés ›`, a `HOGY MENT?` note field, `Vissza a mai napra / Az edzés lezárva és elmentve`, the same star note, and a streak line **`🔥 7 napos sorozat — +50 🪙`**.
   Differences from the prototype: the **two-step structure is collapsed** (no `Részletek` CTA, no `Vissza az értékeléshez`), and the **`a pulton töltött idő` stat is absent**.
2. **On top of it — the pre-Titanium `.levelup` overlay**, measured live: `position: absolute`, **`z-index: 250`**, **416 × 932 px** (the entire phone frame). Content: `🏋️ KLASSZIK KONDI · 58' / ERŐS NAP VOLT. / +480 XP · ÖSSZESEN / Összesen 480 XP / SZINTLÉPÉS · 2 / 6 💪 MELL LEVEL UP · Lv5 → 6 / 7 🏋️ MAXIMÁLIS ERŐ LEVEL UP · Lv6 → 7 / ★ Vas-törzs II — push-volumen tűrés +6% / MÉG FEJLŐDÖTT · 3 / 🔁 Erő-állóképesség +70 / 💪 Váll +90 / 💪 Tricep +50 / 🛡️ Robusztusság · 5. egymást követő héten edzel +25 / Tovább ›`.
   **It also survives route changes** — after closing the workout it was still painted over `/train/mesocycles/new` and `/train/gym` until a full page reload.

**Severity: BLOCKER** (an old screen covering a new one, exactly the owner's complaint)

---

## 20. Production screens with NO prototype counterpart (extra surrounding layers)

These are reachable inside the Train domain and have no Titanium prototype design:

| Route | What it is |
|---|---|
| `/train/gym` | a **duplicate** of `/train/week` (byte-for-byte the same Terhelés page on a second URL) |
| `/train/sport` (`SportPage`) | pre-Titanium: `Sport 4/5 / 6,5 ó pályán e héten / 7,1 RPE átlag / 6,5 váll-terhelés`, tabs `Heti terv · Napló · Cross-load`, jargon note `A röplabda **recurring** · független a gym mesociklustól… a volleyball **cross-load**-ot` |
| `/train/sport/log` (`SportLogPage`) | `NAPLÓZÁS / Mi volt ma mozgás?` picker — the prototype has a `.sp` sport overlay instead |
| `/train/futas` (`RunningPage`) | pre-Titanium: `Futás 3/8`, `CROSS-LOAD → KONDI` note with `eccentric`, `MAV −2`, `Phase 3 pattern-engine` |
| `/train/medals` (`MedalsPage`) | pre-Titanium medal shelf with 🏅 emoji per row; in the prototype medals live inside the exercise story (`Medáljaid`) |
| `/train/review/:workoutId` (`WorkoutReviewPage`) | a second, separate recap page (`MIHEZ KÉPEST`, `KIHÍVÁSOK 0 MEGVAN · 4 KIMARADT` with `⊘` and `⚡`, `AMIT AZNAP ÍRTÁL`); the prototype re-opens the `.wo` overlay's `recap()` instead |
| `/train/custom/new`, `/train/custom/:id` | `ÚJ SAJÁT EDZÉS` builder (all-caps pre-Titanium labels) |
| `/train/mesocycles/templates/:id` | raw day-plan template EDITOR |
| `/train/mesocycles/compare` | two-run compare |
| `/train/mesocycles/:id` (`MesocycleBuilderPage`) | the old block builder |

---

## 21. Pre-Titanium artefacts still reachable in the Train domain

| # | Artefact | Where it lives | Severity |
|---|---|---|---|
| 1 | **Workout PREP mosaic** — `⚡ Kezdjük el →`, `+1192 várható XP`, tiles `GYAKORLATOK / FEJLŐDÉS / HETI ZÓNA / KÜLDETÉSEK / BEMELEGÍTÉS / NIGGLE` | `/train/session` phase 1 (`ActiveWorkoutPage`) | BLOCKER |
| 2 | **`.levelup` overlay** — `z-index: 250`, 416 × 932, `🏋️ KLASSZIK KONDI · 58'`, `ERŐS NAP VOLT.`, `+480 XP`, `💪`, `🔁`, `🛡️`, `★`; persists across route changes | after closing a workout, over the Titanium recap | BLOCKER |
| 3 | **Old exercise catalogue** — `EDZÉS · GYAKORLATOK` header, top-5-only ranked list, `COMPOUND` / `ISOLATION`, letter avatars, no search, no full list | `/train/exercises` (`ExercisesPage`) | BLOCKER |
| 4 | **`REKORDOK` modal sheet** standing in for the exercise story | `/train/exercises`, on card tap | BLOCKER |
| 5 | **Day-plan editor welded under the Titanium day page** — `⠿` handles, `🔥` per row, `Grow` / `Maintain` / `Emphasize`, `HETI SZETEK` (typo), `⚠ 1 jelzés`, `CSÚCSHÉT · IDŐBECSLÉS`, `STRUKTÚRA` | `/train/mesocycles/:id/days/:day` (`MesoDayPage`), below the fold | BLOCKER |
| 6 | **Old block "interview" replacing the 6-step wizard** — `ÚJ BLOKK · INTERJÚ`, `✨ Program generálása`, English `Emphasize/Grow/Maintain` | `/train/mesocycles/new` (`MesocyclePlannerPage`) | BLOCKER |
| 7 | **Closed-run report tail** — `ÉLETMÓD-KONTEXTUS` emoji row (`😴 🍽 ⚡ 😰 ⚖️ 🏐 🏃`), the W1–W8 spreadsheet table, `MEV/MAV/MRV/DELOAD`, the 4-paragraph `AI ÉRTÉKELÉS` | `/train/mesocycles/:id/report` (`MesoReportPage`) | BLOCKER |
| 8 | **`Kalauz · <oldal>` coach-mark dialogs** auto-opening over Titanium pages | `/train/mesocycles`, `/train/sport`, `/train/medals`, `/train/futas`, `/train/review/:id` | MAJOR |
| 9 | **`boop` header + four icon buttons + 7-day strip** instead of `mezo·` + daypart pill + avatar + one date row | every Train page (`header.nap-head.app-head`) | MAJOR |
| 10 | **Küldetés / streak rows in the recap** — `PR-attempt · … SKIPPELTED`, `⚡ Túlterhelés`, `🔥 7 napos sorozat — +50 🪙` | `/train/session` recap | MAJOR |
| 11 | **Per-card `⚡ PROGRESSZIÓ` block, `⚠` niggle banner, `B1/B2` warm-up rows, `OLDAL L B R`** in the live card list | `/train/session` phase 2 | MAJOR |
| 12 | **Old Sport / Futás / Medálok / Saját edzés / Compare / Builder pages** (English jargon: `recurring`, `cross-load`, `pacing`, `onset`, `eccentric`, `pattern-engine`; 🏅 emoji) | see §20 | MAJOR |
| 13 | **Duplicate Terhelés route** `/train/gym` = `/train/week` | `router.tsx` | MINOR |
| 14 | **English-jargon footer paragraph** on Terhelés (`recurring · független`, `pacing`, `alvás-onsetet`) | `/train/week` | MINOR |

---

## Severity roll-up (one row per prototype screen)

| Severity | Count | Screens |
|---|---|---|
| **BLOCKER** | 8 | §3 day page, §10 closed run, §11 wizard (all steps), §15 jelek, §16 Gyakorlatok, §17 exercise story, §18 active workout, §19 ceremony |
| **MAJOR** | 6 screens + the shell | §1 Mai, §5 muscle detail, §9 closed list, §12 Terhelés, §13 Izomtérkép, §14 Mozgás (+ §0 global shell, which applies to all of them) |
| **MINOR** | 5 | §2 Terv, §4 week, §6 library, §7 templates, §8 template story |
