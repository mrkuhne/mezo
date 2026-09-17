# Train domain — Titanium prototype ↔ production parity matrix

Evidence collected 2026-09-16.
Prototype: `http://localhost:5190/nap.html?r=102#train/*` (source: `docs/design_2.0/prototypes/companion-titanium/`).
Production: `http://localhost:5182/train/*` (mock mode), routes from `frontend/src/app/router.tsx`.
All screens were read live from the DOM (innerText + structural outline); no source file was changed.

**This is a LIVE scoreboard, not a frozen report.** Train parity **P1** (`mezo-e1ii9`, 2026-09-17)
closed a first wave of rows; each closed row is marked **✅ CLOSED (P1)** in place, with the original
finding kept underneath as history so nothing silently disappears. P1 also **created or changed** a
few things the original pass could not have seen — those are added as new rows (§3, §18, §19, §21
rows 15–19, the last two from the fix wave), so the matrix keeps telling the truth about the tree as it now stands. Everything still
open belongs to **P2** (the missing screens) and **P3** (the in-card/in-page differences). The global
shell (§0) is explicitly **out of scope by owner decision A** and is excluded from every parity check.

---

## 0. Global shell (applies to EVERY row below)

| | Prototype | Production |
|---|---|---|
| Header | `mezo·` wordmark, a daypart pill (`Napközben ⌄`), avatar (`D`) | `boop` wordmark + **four** round icon buttons — `?` (Kalauz), Napszak, Mezo üzenetei **5**, Értesítések **4** — then the avatar (`header.nap-head.app-head`) |
| Date band | ONE row: `‹  MA · September 9., Szerda  ›`, footer hint `← Húzd oldalra a napváltáshoz →` | a **seven-day strip**: `HÉT 14 — / KEDD 15 ✓ / SZE 16 ✓✓ / MA 17 — / PÉN 18 — / SZO 19 — / VAS 20 pihenő` |
| Tab bar | `Edzés ⌃` domain switch + `Mai · Terv · Terhelés · Gyakorlatok` | identical (`Edzés ⌃` + the same four tabs) — **parity** |
| Extra layer | none | ✅ **CLOSED (P1 Task 6)** — nothing auto-opens over a Train page any more: the Kalauz auto-open is gated off the **whole Train domain**; every entry is still reachable on demand via the `?` (and, on the chrome-less `/train/session`, the card list's own mini `?`). *Was:* the **`Kalauz · <oldal>` coach-mark dialog** auto-opening on `/train/mesocycles`, `/train/sport`, `/train/medals`, `/train/futas`, `/train/review/:id` (`KALAUZ · MESOCIKLUSOK 1 / 5 ✕ … Kihagyom / ‹ Vissza / Tovább`). Recorded a second time as §21 row 8. |

**Severity: MAJOR** — the header wordmark, the extra two notification buttons, the `?`-Kalauz button and the seven-day strip are all production-only chrome wrapped around every Titanium screen; the prototype's single date row + swipe hint is absent.

---

## 1. `train/0` — Mai

**Production: `/train/mai` (`TrainTodayPage`)** — present.

| Prototype section (top → bottom) | Production |
|---|---|
| Poster `tr-day`: status chip `BETERVEZVE`, eyebrow `SZERDA 17:00 · GYM`, `h2 Felsőtest A`, `A 6 hetes „Alapból erő" blokk 3. hete.`, clay dumbbell spot graphic, pills `~45 perc · felsőtest · 3. hét / 6` | **present, different**: eyebrow `MA 07:30 · MAV · GYM`, sub `Hypertrophy 04 · 3. hét / 6`, pills `5 gyakorlat · 22 szett · ~67 perc`, plus an extra repeated `Pull Day` line under the pills |
| CTA `tr-start`: **`Kezdjük az edzést` / `A mai tervezett edzésed` →** | present-but-different: label **`Indítsuk`** (sub-line matches). ✅ **CLOSED (P1 Task 1)** for the destination: the CTA now lands straight on the **card list** (`/train/session` renders it on its first frame), exactly like the prototype — see §18. *Was:* „Lands on the PREP screen, not the card list — see §11" (the cross-reference was wrong too: §11 is the wizard, the overlay is §18). The label difference stays open. |
| Heading `Bármi más, ami ma mozgás` + `GYORS INDÍTÁS` | **absent** — the heading is gone; the two tiles each carry their own `GYORS INDÍTÁS` eyebrow instead |
| Quick tiles `Egyedi edzés / Terv nélkül, most` and `Sport naplózása / Röplabda · futás · más` | present-but-different: sub-lines dropped |
| `A MAI KERETEDHEZ / Amit a mozgásod hozzáad / +260 kcal / … / Megnézem a mai keretem ›` | present (+525 kcal). **The tap-chip `Megnézem a mai keretem ›` is replaced by a note `Becslés, nem mérés.`** |
| `HATÁS AZ IZOMZATODRA / Mit terhel a mai mozgásod` + 4 muscle rows + note | present; 5 rows; note identical. Rows use `erős/enyhe/ma nem kap` instead of the prototype's `tervben erős` wording for a not-yet-started day |
| `HOLNAP 18:00 · SPORT / Röplabda / A vállad és a lábad is kap belőle ›` (`ahead()`) | **absent** |
| `További részletek` accordion (`TERHELÉS · REGENERÁCIÓ · TERV` → 3 secondary rows) | **absent** |
| — | **production-only**: a `Hypertrophy 04 · MAV · W3/6 — Sportjaid és szezonod` row, and a **`REGGELI EDZÉS` nudge card** (`Kedd 18:30 · Csü 18:30 → 07:45` / `Áthelyezés a reggeli ablakba` / `Maradjon így`) |

**Surrounding layers:** production wraps it in the `boop` header + 7-day strip (§0). The CTA no longer leads into an extra screen — see §18 (closed in P1 Task 1).

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
| `＋ Gyakorlat hozzáadása` — **end of screen** | present, plus a quiet `A nap szerkesztése` link into §3b (production-only, deliberate) |
| Exercise cells carry `↑ ↓` reorder arrows | **absent** — reordering lives on the edit route (§3b). *Found in the P1 parity walk, 2026-09-17; open, P3* |
| — | ✅ **CLOSED (P1 Task 4)** — the welded editor is gone; the page ends on `＋ Gyakorlat hozzáadása` + a quiet `A nap szerkesztése` link, exactly like the prototype's end-of-screen `.pl-add`. *Was:* **production-only, appended BELOW the Titanium page — an entire pre-Titanium editor**: `LEGS / 6 GYAKORLAT · ~96 PERC / 19 szett ma / Heti terhelés: 75 szett · 5 edzésnap / ⚠ 1 jelzés`, `MA · IZMONKÉNT / MAX 8 SZETT/IZOM`, `HETI SZETEK · IZMONKÉNT` (typo, and English `Grow` / `Maintain` / `Emphasize` labels), `CSÚCSHÉT · IDŐBECSLÉS ▾`, `STRUKTÚRA · 7 észrevétel ▾`, and a drag-handle exercise list `⠿ Barbell Squat · COMB · 🔥 4×6–8 ▾`, closing with `GYAKORLAT HOZZÁADÁSA` |

**Severity: ✅ CLOSED (P1 Task 4)** — was BLOCKER (a complete pre-Titanium screen welded onto the bottom of the Titanium one: emoji `🔥`, `⠿` handles, English jargon, a duplicate exercise list and a duplicate add-CTA). The editing was **relocated, not deleted** — the run's day plan had no other editor route.

### 3b. `/train/mesocycles/:id/days/:day/edit` — NEW in P1, no prototype counterpart

**Production: `MesoDayEditPage`** — created by P1 Task 4 to receive the editor that used to be welded under §3. The prototype has no edit screen for a plan day at all (its day screen is read-only plus the add-CTA).

| Prototype | Production |
|---|---|
| — | the whole pre-Titanium editor, now one route down: `MA · IZMONKÉNT`, `HETI SZETEK` (typo), English `Grow`/`Maintain`/`Emphasize`, `CSÚCSHÉT · IDŐBECSLÉS`, `STRUKTÚRA`, `⠿` drag handles, `🔥` per row. `?add=1` opens the picker on arrival. |

**Severity: MAJOR (open, P2/P3)** — a pre-Titanium screen one route down instead of under the fold. Filed as **bd `mezo-3dz0y`**. Deliberate: removing it without a relocation would have deleted the capability outright.

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
| — | ✅ **CLOSED (P1 Task 5 + fix round 1)** — the tail is gone: no arc chart, no MEV/MAV/MRV legend, no emoji row, no W1–W8 table. The page ENDS on the versus block, as the prototype does. The **AI evaluation stays**, demoted to a closed `details` („Mit olvas ki ebből a gép?") captioned as a guess, not a measurement — a real backend feature the prototype has no counterpart for; the run-window lifestyle averages ride in that same collapsed block as plain prose rows (`Alvás`/`Kcal`/`Energia`/`Stressz`/`Súlyváltozás`/`Sport`, `–` for unmeasured), because the compare page that was supposed to hold them needs TWO closed runs. The **fix wave** added the three totals that accounting had missed: `Sportalkalom` and `Futás` as two further rows, and a target line on the `Kcal` row („A cél {n} kcal volt — {±n} kcal a célhoz képest.", rendered only when both numbers exist). The per-week granularity and `gymRpeAvg` are **recorded deaths** — row 18 below. `ERŐ`/`REKORDOK`/`SAJÁT ÉRTÉKELÉS` and the three run actions stay. *Was:* **production-only, pre-Titanium**: `HETI SZETTEK · A BLOKK ÍVE` chart with `MEV/MAV/MRV/DELOAD` jargon; `ERŐ · 6 GYAKORLAT`; `REKORDOK · 7 MEDÁL`; **`ÉLETMÓD-KONTEXTUS` emoji row** `😴 7,4 h alvás · 🍽 2429 kcal · ⚡ 6,5 energia · 😰 4,8 stressz · ⚖️ -1,1 kg · 🏐 760 perc · 🏃 9× futás`; a raw **spreadsheet table** (`Hét / Alvás / Kcal / Energia / Stressz / Súly Δ / Sport / Futás`, W1–W8); `SAJÁT ÉRTÉKELÉS`; `AI ÉRTÉKELÉS` (4 paragraphs) + `Újragenerálás`; `Újrafuttatás` / `Sablon mentése ebből a futamból` / `Riport újragenerálása` |

**Severity: ✅ CLOSED (P1 Task 5)** — was BLOCKER. Remaining OPEN differences on this screen are P3 detail, not the tail: the back label (`Vissza` vs `‹ Lezárt futamaid`), the `88 %` gauge instead of the prototype's three facts, and the missing plain-word muscle verdicts.

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
| **`Minden izomjel / A 21 izom, saját jellel, régiónként ›`** | ✅ **CLOSED (P2 Task 1)** — the quiet `.pl-row.is-quiet` doorway is back at the foot of the screen, copy verbatim, routing to `/train/week/jelek` (§15), and now sits BELOW the `A sport ezeket is dolgoztatta: …` footnote, matching `mapScreen()`'s render order (`load-pages.js:139` footnote, then `:140-141` doorway). *Was:* „absent — the doorway to `train/2/jelek` is gone", then briefly present but ABOVE the footnote (parity-walk fix). |

**Severity: MAJOR** (the entry point to §15 is now present; what stays open on this screen is the 9-vs-6 wait list and the „röplabda"→„sport" wording above)

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

**Production: ✅ CLOSED (P2 Task 1)** — the screen exists at `/train/week/jelek` (`TrainWeekJelekPage`), and so does its doorway (§13). The head carries the prototype copy verbatim (`IZOMTÉRKÉP / Minden izomcsoport, saját jellel` + `Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó.`), the back pill reads `‹ Izomtérkép`, and all six region blocks are there with the prototype own counts — `Mell 3 izom`, `Hát 4 izom`, `Váll 3 izom`, `Kar 6 izom`, `Láb 4 izom`, `Core 1 izom` — each cell drawn by the shipped `MuscleChip` silhouette path (T3), never a second geometry path and never an emoji. *Was:* „MISSING — no such screen… There is no `/train/week/jelek`".

| Prototype | Production |
|---|---|
| `‹ Izomtérkép`, `IZOMTÉRKÉP`, `Minden izomcsoport, saját jellel`, lead | **identical copy**; the back pill and the head are docked INSIDE the slim `.ld-hero`, the idiom §13/§14 already carry, rather than floating above plain body text |
| 6 region blocks · 21 clay silhouettes · `N izom` counters · 3-wide grid | **identical** (`REGION_MUSCLES`, the same source the picker/filter surfaces read) |
| A lit cell = the muscle worked this week | present, but read off the REAL week log (`useWeekMuscleLog().details` → `workedMusclesThisWeek`) — the prototype lights a scripted fixture set. In mock mode no workout instance is persisted at all, so **nothing is lit and nothing is guessed lit** |
| — | production-only: one honest closing line („…még egy izmod sincs naplózva — amint egy edzés lezárul, a jele kigyullad.") so an all-dark screen reads as an empty week rather than a broken one |

**Severity: ✅ CLOSED (P2 Task 1)** — was BLOCKER.

---

## 16. `train/3` — Gyakorlatok

**Production: ✅ CLOSED (P2 Task 4)** — `/train/exercises` (`ExercisesPage`) was replaced wholesale: the
pre-Titanium page (DS header + `Új gyakorlat` + the ranked top-5 + dashed ghost rows + the ⋯/▶ sheets)
is gone, and the screen is now the prototype's catalogue — poster, search, region chips, one `.gy-card`
per catalogue exercise. The joins live in `features/train/logic/exerciseLibrary.ts` (catalogue × records
× medals, identity via the shared `recordFor` rule).

| Prototype | Production |
|---|---|
| Poster `GYAKORLATOK / A mozdulataid` + lead `Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.` | **identical copy** on the house `.pl-dhero.pl-lhero` poster; the hero art is the clay `i-polc` (the set has no book) |
| Stat strip `19 gyakorlat · 3 rekorddal · 6 medál` | **identical shape, real counts** — `21 gyakorlat · 5 rekorddal · 8 medál` in mock; all three derived (`libraryCounts`) and honest at zero |
| Search field `#gy-search`, placeholder `Keresés névre vagy izomra…` | present, placeholder verbatim; matches the NAME or the MUSCLE label, **accent-blind** (`foldAccents` — „hat" finds `Hát (közép)`). The house `.searchfield` chrome (48px target + a leading magnifier) wears the prototype's `.gy-search` row: the prototype's own `.wz-pick-search` input styling belongs to the wizard CSS and was not ported |
| Filter chips `Mind · Mell · Hát · Váll · Kar · Láb · Core` | `Mind` + one chip per region the catalogue ACTUALLY has rows in (mock: no Core exercise ⇒ no Core chip — a chip that filters to nothing is a lie). Drawn with the house DS chip (44px tap height), one scrolling row instead of the prototype's wrapping pills |
| **Full catalogue** — 19 rows, each `név / izom / becsült 1RM / medálszám ›` | **present** — 21 rows, same anatomy: `MuscleChip` art, name, muscle label, and either the best e1RM + `becsült 1RM` + the medal count, or `még nincs naplózva`. A logged exercise with no trustworthy estimate (bodyweight, every set above the rep cap) shows an em dash, never a 0 |
| Tap → the exercise's story | routes to `/train/exercises/:key` (§17, P2 Task 5) |

**Deliberate losses (capabilities the prototype's catalogue has no home for — recorded, not silent):**
the ⋯ per-exercise edit/delete sheet (`CatalogExerciseSheet` in its edit mode) and the ▶ demo-video
sheet (`VideoUrlSheet`); the `REKORDOK` modal (`ExerciseRecordSheet` — §17's story page replaces it).
**All three are resolved by P2 Task 5:** the edit and video sheets have a home on the story page
(gated on the server's own `editable`/`mediaEditable`), and the `REKORDOK` sheet is deleted.
The ranked top-5 and the dashed ghost rows are NOT losses — they are presentation the catalogue
replaces. `Új gyakorlat` authoring itself (create mode) is **not** a loss any more: fix round 1
gave it a quiet `.pl-add` row at the foot of the list.

**Two more losses the first pass did not declare (found in fix round 1, both undeclared until now):**
- The `Saját` / `Közös · {név}` authorship stamps (`ExerciseLibraryItem.authoredByMe` /
  `.authorName`) render nowhere in the catalogue — the retired page's only renderer for them is gone
  and the catalogue's `.gy-card` never grew a replacement. **Pending, not dead:** Task 5 (the exercise
  story page) is asked to give them a home; until then the fields are fetched and carried but never
  shown. **Resolved by P2 Task 5 — the stamps render in the story page's hero.**
- The Plyo filter chip (`muscleFilters.ts`'s `TOP_FILTERS`: `all | plyo | <region>`) survives only
  inside the plan-builder's `ExercisePickerSheet` — the catalogue's own chip row
  (`libraryRegions`/`exerciseLibrary.ts`) is region-only and has no type axis, so „Plyo" as a
  catalogue-level filter has no home here.

The medal foot fact (`counts.medals`) is also worth reading precisely: it is **catalogue-scoped**
(`libraryCounts`'s own comment) — a medal earned on an exercise absent from the catalogue is excluded,
so this poster count can legitimately read LOWER than the medal vitrine's own total.

**Severity: ✅ CLOSED (P2 Task 4)** — was BLOCKER. Fix round 1 (mezo-lf3cv) additionally: gave the
poster's medal fact a doorway to `/train/medals` (it was `owns`-claimed in `navModel.ts` but
unreachable), gave `Új gyakorlat` creation the `.pl-add` row above, dropped the card's overriding
`aria-label` (it hid the e1RM/medal-count/„még nincs naplózva" from a screen reader), and folded
`useMedals()`'s own pending state into the skeleton gate (it was painting a fake „0 medál" while
loading).

---

## 17. `train/3/{key}` — exercise story

**Production: ✅ CLOSED (P2 Task 5)** — `/train/exercises/:key` (`ExerciseStoryPage`) is the screen. It
was MISSING entirely: Task 4's catalogue already routed every card here and the router's catch-all
dropped the reader on `/nap`; the only per-exercise story production had was the pre-Titanium
`REKORDOK` modal (`sheets/ExerciseRecordSheet.tsx`), which is **retired with this commit** — grepped,
this page was its last consumer. The joins stay in `features/train/logic/exerciseLibrary.ts` (the same
`recordFor` identity rule the catalogue uses), the curve is
`features/train/components/StrengthCurve.tsx`.

| Prototype section | Production |
|---|---|
| `‹ Gyakorlatok` + eyebrow `MELL (KÖZÉP)` + `Fekvenyomás` + cue prose `Talpak lent. Stabil lapockák…` | present, on the house `PageHead` + `.pl-dhero.gy-hero`. **The cue prose is OMITTED** — no production field carries per-exercise cue text and none was invented (see the deliberate omissions below) |
| Facts `12 alkalom / jún. 3. óta / 18,2 t összsúly` | **identical shape, real figures** — `26 alkalom · 2025. Szep 3 óta · 42 t összsúly` in mock. The middle fact is the one the wire makes hardest to say honestly, and it is now said two ways (fix round 1): an ABSOLUTE date only when the series covers the whole history, carrying its YEAR once it is old enough to be misread as recent (`huMonthDayAged` — „Szep 3 óta" on a September screen reads as a fortnight when the truth is a year); otherwise — `sessionCount` greater than the number of points the capped series carries — **„ebből az utolsó N látszik"**, because the oldest date the row holds is then the WINDOW's start, not a beginning (`sinceFact`). A BODYWEIGHT row says `N ismétlés` instead of „0 t összsúly", which is a different true fact rather than a missing one |
| `Rekordjaid` — `BECSÜLT 1RM 76,5 kg (+2,5 kg a múltkori óta)`, `LEGJOBB SZETT`, `LEGTÖBB VOLUMEN` | **present, the three `.gy-rec` cards.** Every absent figure is an EM DASH, never a 0 (Face Pull: `— / 22 ismétlés / —`). The 1RM delta is measured against the best estimate that stood BEFORE the session which set the record (`+2,1 kg a korábbi csúcsod óta`) rather than the prototype's „a múltkori óta" — the headline is the all-time best, so its delta has to be about the same quantity — and the card carries the „Becslés, nem mérés" caveat as its own line |
| `Következő cél: 62,5 kg × 9 — egy ismétléssel a legjobb szetted fölé.` | **present**, `.gy-next`, DERIVED from the real best set (`nextTarget`): the same load, one rep more, worded as the prototype's own note („ugyanaz a súly, egy ismétléssel több"). A TARGET, never a prediction; no best set ⇒ no line at all |
| **`Az erőd íve`** story-curve graphic (`0 kg most · eddig · a terv várakozása`) | **present** — the SOLID line only, over Task 2's `e1rmSeries`. The DASHED „a terv várakozása" branch is **NOT drawn**: nothing in production forecasts an e1RM, so the caption reads `ami eddig megtörtént · <dátum> óta` / `becslés, nem mérés`. Two further honesty rules: the x axis is TIME (not index), and an interval out of character for the series' own cadence BREAKS the stroke, so a wire gap reads as a gap. Under two points there is a sentence instead of a line — never a flat line through one measurement |
| `Medáljaid` (3 medal cards) | **present** — this exercise's medals only, filtered from `useMedals` through the SAME identity join. Unlike the prototype (which omits the section entirely on an unlogged exercise) production always shows the heading with an honest empty line |
| `Hol szerepel` — `Felsőtest A / A futó tervedben · Szerda ›`, `Nyári tömegelés / Sablon a polcodon ›` | **present**, derived CLIENT-SIDE (`whereUsed`, no new endpoint) from the running plan's days and the template shelf, each row a door (`/train/mesocycles/:id/days/:day`, `/train/templates/:id`). Mirrors the prototype's own subtraction: the template the active run was STARTED from is left out, because its week is the same week the day rows already list |

**Three capabilities that had no reachable home after Task 4 and live here now** (the rule: no feature
dies silently) — all three were listed as losses under §16:
- **per-exercise edit/delete** → a quiet `Szerkesztés` row opens `CatalogExerciseSheet` in EDIT mode
  (which also hosts its two-tap `Gyakorlat törlése`), offered ONLY when the server says `editable`;
- **the demo-video URL** → a `Demó videó` row opens `VideoUrlSheet`, gated on `mediaEditable`, and the
  row itself says whether a video is attached („Csere vagy eltávolítás" / „Még nincs videó");
- **the `Saját` / `Közös · {név}` authorship stamps** (`authoredByMe`/`authorName`) → in the hero.
  This page is the app's FIRST renderer for them.

Both authoring rows are absent when the viewer may not author (and in mock mode, whose static seed
carries no flags at all), so the page never offers an affordance that would come back 403.

**Deliberate omissions (recorded, not silent):**
- the hero's **cue prose** — no production field carries it; writing coaching copy out of nothing was
  refused rather than faked;
- the curve's **dashed projected branch** — no model behind it;
- **the demo VIDEO PLAYER and the demo stills.** Production has `videoUrl`/`imageStartUrl`/
  `imageEndUrl` and the prototype's story shows neither. Watching already survives elsewhere (the
  workout card glass, the plan picker), so the story page keeps only the AUTHORING half as the one
  quiet row above — a player would have been a new section, not a ported one.

**Severity: ✅ CLOSED (P2 Task 5)** — was BLOCKER. **Fix round 1 (mezo-lf3cv):** the hero's „…óta" fact
was wrong twice over and is honest in both directions now — it carries the YEAR on an old date
(`huMonthDayAged`, added beside `huMonthDay` rather than changing it app-wide: most of its callers state
inherently recent dates) and it says „ebből az utolsó N látszik" when the wire's 52-point cap means the
date is a window start rather than a beginning (`sinceFact`, table-tested both branches); the same
year-aware date now runs on the record cards. The 1RM card no longer paints a FULL bar under an em dash
(no figure ⇒ no bar, and no „Becslés, nem mérés" caption under a number that is not there), and a best
with an empty series gets an unfilled rail instead of silently claiming „you are at your peak right
now". `StrengthCurve`'s header now records where the median gap rule is weak (on three points a hole
must be ~7× the normal step before the stroke breaks — under-breaking is the safer direction). The mock
catalogue seeds the authorship stamps (one `Saját`, one `Közös · {név}`) so the display-only half of the
rescued trio is walkable offline — deliberately NOT `editable`/`mediaEditable`, since mock write
mutations are no-ops and an authoring row whose Save does nothing is a worse lie than an absent one. And
[`docs/features/train.md`](../features/train.md) §2 `Gyakorlatok` was rewritten to what ships (the
Titanium catalogue + this story page), with `ExerciseRecordSheet`'s retirement recorded among the deaths.

---

## 18. OVERLAY A — the active workout (card list)

**Prototype:** `Mai`'s CTA (`[data-workout]`) opens the `.wo` full-screen overlay **immediately** — header `‹ / FELSŐTEST A · 3. HÉT / 6 / 0 / 9 szett / 4:44`, then one card per exercise (name, `⋮` menu, cue prose, `KG REP RIR` rows with `✓`), then `Edzés kihagyása` and the dock `0 / ELVÉGZETT MUNKA / 0 / 9 szett / Lezárás →`. **There is no screen between the CTA and this list.**

**Production: `/train/session` (`ActiveWorkoutPage`)** — present, but reached through an extra screen.

**PHASE 1 — ✅ CLOSED (P1 Task 1): there is no prep screen.** `/train/session` renders the card list on its FIRST frame, exactly like `openSession()`; `Phase` is `'active' | 'summary'` and the old CTA's two start paths fire as a mount effect. Everything the mosaic showed has a home: counts = the list, XP forecast = the ceremony's real `+XP`, weekly zone = the Terhelés tab, warm-up = the cards' amber B-rows **only in part** (those are a PER-EXERCISE warm-up; the Bemelegítés page's SESSION-level 3-block protocol has no home at all — `logic/warmupProtocol.ts` is deleted and the protocol is a recorded death, see row 18 below), niggle = the list's banner (now carrying the backend's own `detail` prose), challenges = the header `⋯` menu's `Küldetések` glass. *Was, production-only:* `← VISSZA / ? / SZERDA · W3 · MAV HÉT / Pull Day / +1192 várható XP / 15 szett / ~53′ idő / 3 izomcsoport / **⚡ Kezdjük el →** / GYAKORLATOK 5 gyakorlat · 22 szett / FEJLŐDÉS +1192 XP / HETI ZÓNA kész 0/5 edzés / KÜLDETÉSEK 0/4 elfogadva / BEMELEGÍTÉS 8 perc · 3 blokk / NIGGLE ! Jobb váll · aktív`. **The prototype has no such screen anywhere.**

**PHASE 2 — the card list** (now the first frame): the Titanium skeleton IS there (`Edzés kihagyása`, `ELVÉGZETT MUNKA`, `Lezárás →`), with pre-Titanium additions:
- a banner `⚠ Jobb váll aktív · óvatos, először warm-up`
- per-card `⚡ PROGRESSZIÓ / +2,5 kg ↑ / MÚLT HÉT / MA A CÉL` block (emoji)
- warm-up rows `B1 / B2` and an `OLDAL L B R` selector inside the set table
- the confirm sheet gains a title bar `Lezárás megerősítése ✕` (prototype's `.wo-glass-card.is-confirm` has none; the body copy is otherwise identical, word for word)

**NEW in P1 — two header affordances the prototype's session header does not have** (Task 1, deliberate, not a regression): the mini **`?`** (the kalauz entry — this route is chrome-less, so the global header's `?` does not exist here; it moved off the retired prep breadcrumb) and the **`⋯` `Gyakorlat műveletek`** chip, which also hosts the `Küldetések` glass. Both are real capabilities with no prototype counterpart. Also new at the head of the list: the day-level **overload tally** (`WorkoutOverloadLine`, honest-empty) and a **failed-start strip** that surfaces a rejected start POST and BLOCKS logging until a retry binds a real instance id.

**Also open (found in the P1 parity walk, 2026-09-17):** the prototype's session header carries a **live elapsed timer** (`0:01` … `4:44`) next to `n / m szett`; production's `.wk-top` has none.

**Severity: MAJOR (open, P3)** — was BLOCKER; the prep phase is gone, and what remains is §21 row 11, the in-card differences (per-card `⚡ PROGRESSZIÓ` block, `B1/B2` warm-up rows, the `OLDAL L B R` selector, the confirm sheet's title bar) plus the two header affordances above.

---

## 19. OVERLAY B — the ceremony + its details step

**Prototype (`session.js` `summary()` → `detailsStep()`, two steps inside the same `.wo` overlay, nothing else on screen):**
- **Step 1 `summary()`**: `A MAI EDZÉSED` (or `EDZÉS LEZÁRVA`), the 5-star ignition row, the comet bar, three counters (`szett` / `ismétlés` / `kg × rep`), `<n> csillag` as the sr-only heading, stats **`6′ a pulton töltött idő`** and **`+10 szerzett XP`**, an optional `Új rekord` row, and the single way on: **`Részletek / Izomcsoportok és a nyert kalória`**.
- **Step 2 `detailsStep()`**: `Izomcsoportok fejlődése a mai edzésen` (per-muscle rows with mini-stars and a zone track), `+29 kcal / Ennyit nyertél a mai mozgással ›`, `Edzés lezárása / 1 elvégzett · 8 még bepipálatlan`, `Vissza az értékeléshez`, note `Mintaedzés · a csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.`
- **The prototype's ceremony carries the XP itself** (`+<xp> szerzett XP`). There is **no** level/skill overlay, no emoji, no second layer. `runCeremony()` is the one-shot rAF choreography with a `prefers-reduced-motion` branch.

**Production: ✅ CLOSED (P1 Tasks 2 + 3).** The close is now ONE layer and TWO steps, 1:1 with `summary()` → `detailsStep()`: step one is the ignition + the reading (eyebrow, five-star row, comet bar, the three counters, the sr-only star heading, the verdict, the `perc`/`XP` stat tiles, the optional `Új rekord` row, the pending-sets line) ending in exactly one way on — `Részletek · Izomcsoportok és a nyert kalória`; step two is the per-muscle star rows, the kcal tile, the closing note, `Vissza a mai napra` and `Vissza az értékeléshez`. The `.levelup` overlay is not raised by the workout finish at all (and the provider now dismisses itself on a route change, so it can no longer survive one from the sport/run flows either). The küldetés rows and the mock streak/level-up toast left with it — the ceremony owns the screen alone. The `a pulton töltött idő` stat is present and **really measured**: the finish POST's own response carries `startedAt`/`finishedAt`/`activeSeconds`; mock mode falls back to its own mount-to-finish wall clock. An unmeasurable session renders **no tile at all** rather than an estimate dressed as a measurement.

**NEW in P1 — two things production's step one keeps that `summary()` does not have** (Task 3 rulings, deliberate): a **verdict sentence** under the star heading (shared Titanium copy, adherence-neutral) and the **pending-sets line** when the session closed with unticked sets (honest: the ceremony must not celebrate a whole that was not whole). Also deliberately NOT drawn: the prototype's `.zone` band on the per-muscle rows — production carries no low/high bounds for it, and nothing is fabricated.

**Was, before P1 — both of these rendered:**
1. **In the page body** — a Titanium recap: `EDZÉS LEZÁRVA / 1 SZETT / 4 ISMÉTLÉS / 60 KG × REP / 0 csillag az ötből / Ma nem jött össze. / +480 SZERZETT XP`, then the pre-Titanium küldetés rows `PR-attempt · … SKIPPELTED`, `⚡ Túlterhelés · … SKIPPELTED`, `Mélység · …`, `Volumen · …`; then `Izomcsoportok fejlődése a mai edzésen`, `+24 kcal / Ennyit nyertél a mai mozgással / Becslés, nem mérés ›`, a `HOGY MENT?` note field, `Vissza a mai napra / Az edzés lezárva és elmentve`, the same star note, and a streak line **`🔥 7 napos sorozat — +50 🪙`**.
   Differences from the prototype: the **two-step structure is collapsed** (no `Részletek` CTA, no `Vissza az értékeléshez`), and the **`a pulton töltött idő` stat is absent**.
2. **On top of it — the pre-Titanium `.levelup` overlay**, measured live: `position: absolute`, **`z-index: 250`**, **416 × 932 px** (the entire phone frame). Content: `🏋️ KLASSZIK KONDI · 58' / ERŐS NAP VOLT. / +480 XP · ÖSSZESEN / Összesen 480 XP / SZINTLÉPÉS · 2 / 6 💪 MELL LEVEL UP · Lv5 → 6 / 7 🏋️ MAXIMÁLIS ERŐ LEVEL UP · Lv6 → 7 / ★ Vas-törzs II — push-volumen tűrés +6% / MÉG FEJLŐDÖTT · 3 / 🔁 Erő-állóképesség +70 / 💪 Váll +90 / 💪 Tricep +50 / 🛡️ Robusztusság · 5. egymást követő héten edzel +25 / Tovább ›`.
   **It also survives route changes** — after closing the workout it was still painted over `/train/mesocycles/new` and `/train/gym` until a full page reload.

**Still open on this screen (found in the P1 parity walk, 2026-09-17, all P3):**
- The prototype keeps the **session header** (`‹ · FELSŐTEST A · 3. HÉT / 6 · 1 / 9 szett · timer`) painted above BOTH ceremony steps; production's ceremony replaces the whole frame and shows no header.
- Step two adds a production-only page title **`Az edzés részletei`** and the **`HOGY MENT?`** closing-note field (a real feature — the workout-level note, `mezo-d20.8.2.2`), and its way-out CTA reads `Vissza a mai napra / Az edzés lezárva és elmentve` rather than the prototype's `Edzés lezárása / 1 elvégzett · 8 még bepipálatlan` — production's ceremony is POST-finish by design (T7), so there is nothing left to close there.
- The `a pulton töltött idő` tile is honest-null: a session under 60 seconds (easy to hit in mock) renders no tile, where the prototype always prints one.

**Severity: ✅ CLOSED (P1 Tasks 2 + 3)** — was BLOCKER (an old screen covering a new one, exactly the owner's complaint).

---

## 20. Production screens with NO prototype counterpart (extra surrounding layers)

These are reachable inside the Train domain and have no Titanium prototype design:

| Route | What it is |
|---|---|
| `/train/gym` | a **duplicate** of `/train/week` (byte-for-byte the same Terhelés page on a second URL) |
| `/train/sport` (`SportPage`) | pre-Titanium: `Sport 4/5 / 6,5 ó pályán e héten / 7,1 RPE átlag / 6,5 váll-terhelés`, tabs `Heti terv · Napló · Cross-load`, jargon note `A röplabda **recurring** · független a gym mesociklustól… a volleyball **cross-load**-ot` |
| `/train/sport/log` (`SportLogPage`) | `NAPLÓZÁS / Mi volt ma mozgás?` picker — the prototype has a `.sp` sport overlay instead |
| `/train/futas` (`RunningPage`) | pre-Titanium: `Futás 3/8`, `CROSS-LOAD → KONDI` note with `eccentric`, `MAV −2`, `Phase 3 pattern-engine` |
| `/train/medals` (`MedalsPage`) | pre-Titanium medal shelf with 🏅 emoji per row; in the prototype medals live inside the exercise story (`Medáljaid`). **P2 kept it, deliberately** (§21 row 21): the story page's `Medáljaid` is ONE exercise's medals, the shelf is every medal you own — a whole-collection view the prototype has no screen for, so folding it into the story would delete a capability, not port it. §16's poster gave it a real doorway (Task 4 fix round 1); re-facing or retiring it is a P3 decision |
| `/train/review/:workoutId` (`WorkoutReviewPage`) | a second, separate recap page (`MIHEZ KÉPEST`, `KIHÍVÁSOK 0 MEGVAN · 4 KIMARADT` with `⊘` and `⚡`, `AMIT AZNAP ÍRTÁL`); the prototype re-opens the `.wo` overlay's `recap()` instead |
| `/train/custom/new`, `/train/custom/:id` | `ÚJ SAJÁT EDZÉS` builder (all-caps pre-Titanium labels) |
| `/train/mesocycles/templates/:id` | raw day-plan template EDITOR |
| `/train/mesocycles/compare` | two-run compare |
| `/train/mesocycles/:id` (`MesocycleBuilderPage`) | the old block builder |

---

## 21. Pre-Titanium artefacts still reachable in the Train domain

| # | Artefact | Where it lives | Severity |
|---|---|---|---|
| 1 | **Workout PREP mosaic** — `⚡ Kezdjük el →`, `+1192 várható XP`, tiles `GYAKORLATOK / FEJLŐDÉS / HETI ZÓNA / KÜLDETÉSEK / BEMELEGÍTÉS / NIGGLE` | `/train/session` phase 1 (`ActiveWorkoutPage`) | ✅ **CLOSED** (P1 Task 1 — the workout opens in the card list) |
| 2 | **`.levelup` overlay** — `z-index: 250`, 416 × 932, `🏋️ KLASSZIK KONDI · 58'`, `ERŐS NAP VOLT.`, `+480 XP`, `💪`, `🔁`, `🛡️`, `★`; persists across route changes | after closing a workout, over the Titanium recap | ✅ **CLOSED** (P1 Task 2 — the gym finish no longer raises it; the provider also dismisses on route change) |
| 3 | **Old exercise catalogue** — `EDZÉS · GYAKORLATOK` header, top-5-only ranked list, `COMPOUND` / `ISOLATION`, letter avatars, no search, no full list | `/train/exercises` (`ExercisesPage`) | ✅ **CLOSED** (P2 Task 4 — the page is the prototype's catalogue: poster, search, region chips, the full list; §16) |
| 4 | **`REKORDOK` modal sheet** standing in for the exercise story | `/train/exercises`, on card tap | ✅ **CLOSED** (P2 Task 5 — `/train/exercises/:key` is the story; the sheet is deleted, this page was its last consumer) |
| 5 | **Day-plan editor welded under the Titanium day page** — `⠿` handles, `🔥` per row, `Grow` / `Maintain` / `Emphasize`, `HETI SZETEK` (typo), `⚠ 1 jelzés`, `CSÚCSHÉT · IDŐBECSLÉS`, `STRUKTÚRA` | `/train/mesocycles/:id/days/:day` (`MesoDayPage`), below the fold | ✅ **CLOSED** (P1 Task 4 — moved to its own `/edit` route; still pre-Titanium there, row 15) |
| 6 | **Old block "interview" replacing the 6-step wizard** — `ÚJ BLOKK · INTERJÚ`, `✨ Program generálása`, English `Emphasize/Grow/Maintain` | `/train/mesocycles/new` (`MesocyclePlannerPage`) | BLOCKER |
| 7 | **Closed-run report tail** — `ÉLETMÓD-KONTEXTUS` emoji row (`😴 🍽 ⚡ 😰 ⚖️ 🏐 🏃`), the W1–W8 spreadsheet table, `MEV/MAV/MRV/DELOAD`, the 4-paragraph `AI ÉRTÉKELÉS` | `/train/mesocycles/:id/report` (`MesoReportPage`) | ✅ **CLOSED** (P1 Task 5 — the emoji row, the W1–W8 table and the MEV/MAV/MRV arc are gone; the AI evaluation survives as a collapsed `details`, captioned as a guess) |
| 8 | **`Kalauz · <oldal>` coach-mark dialogs** auto-opening over Titanium pages | `/train/mesocycles`, `/train/sport`, `/train/medals`, `/train/futas`, `/train/review/:id` | ✅ **CLOSED** (P1 Task 6 — auto-open is gated off the whole Train domain; the `?` still opens every entry) |
| 9 | **`boop` header + four icon buttons + 7-day strip** instead of `mezo·` + daypart pill + avatar + one date row | every Train page (`header.nap-head.app-head`) | MAJOR |
| 10 | **Küldetés / streak rows in the recap** — `PR-attempt · … SKIPPELTED`, `⚡ Túlterhelés`, `🔥 7 napos sorozat — +50 🪙` | `/train/session` recap | ✅ **CLOSED** (P1 Task 3 — the küldetés rows and the streak toast left the ceremony; challenges live on the review page's `Kihívások` strip and in the workout's `⋯` glass) |
| 11 | **Per-card `⚡ PROGRESSZIÓ` block, `⚠` niggle banner, `B1/B2` warm-up rows, `OLDAL L B R`** in the live card list | `/train/session` phase 2 | MAJOR |
| 12 | **Old Sport / Futás / Medálok / Saját edzés / Compare / Builder pages** (English jargon: `recurring`, `cross-load`, `pacing`, `onset`, `eccentric`, `pattern-engine`; 🏅 emoji) | see §20 | MAJOR |
| 13 | **Duplicate Terhelés route** `/train/gym` = `/train/week` | `router.tsx` | MINOR |
| 14 | **English-jargon footer paragraph** on Terhelés (`recurring · független`, `pacing`, `alvás-onsetet`) | `/train/week` | MINOR |
| 15 | **NEW (P1 Task 4) — the day-plan editor, one route down.** The same pre-Titanium screen row 5 named (`⠿`, `🔥`, `Grow`/`Maintain`/`Emphasize`, `HETI SZETEK` typo, `CSÚCSHÉT · IDŐBECSLÉS`, `STRUKTÚRA`), no longer welded under the Titanium day page but on its own route. Relocated rather than deleted: the run's day plan had no other editor. Filed as bd `mezo-3dz0y` | `/train/mesocycles/:id/days/:day/edit` (`MesoDayEditPage`) | MAJOR |
| 16 | **NEW (P1 Task 1) — two session-header affordances the prototype has not**: the mini `?` (kalauz entry on a chrome-less route) and the `⋯` `Gyakorlat műveletek` chip (per-exercise menu glass, also hosting `Küldetések`). Real capabilities with no prototype counterpart — kept deliberately | `/train/session` `.wk-top` | MINOR (deliberate) |
| 17 | **NEW (P1 Task 3) — two ceremony elements `summary()` has not**: the verdict sentence and the pending-sets line. Shared Titanium copy, and honest — the ceremony must not celebrate a whole that was not whole | `/train/session` close, step 1 | MINOR (deliberate) |
| 18 | **RECORDED DEATHS (P1 fix wave) — three capabilities with no screen left anywhere.** (a) `MesoContext.weeks[]`, the whole per-week lifestyle granularity (sleep / kcal / energy / stress / weight-delta / sport / run, W1–W8) and (b) `MesoContextWeek.gymRpeAvg` (despite the name, the sport+running RPE average) lost their only renderer when the report's W1–W8 spreadsheet went; the prototype's closed-run story has no week-by-week view, so none was invented. (c) The **session-level 3-block warm-up protocol** the prep Bemelegítés page showed — `logic/warmupProtocol.ts` is deleted; the cards' amber `B1/B2` rows are a PER-EXERCISE warm-up, not the same thing. **The backend still computes and ships (a) and (b) on every report**, so a later slice can surface them with no server work. Written down so they are rediscovered by reading, not by grep | `/train/mesocycles/:id/report` (data), `/train/session` (warm-up) | MINOR (deliberate, deferred) |
| 19 | **NEW (P1 fix wave) — the day-level overload strip's glyph is CLAY.** `WorkoutOverloadLine` first shipped its headline as `⚡ Túlterhelés`, which is precisely the artefact row 11 lists for removal. It is now a clay `i-growth` + `Túlterhelés`, words unchanged. The per-card `⚡ PROGRESSZIÓ` block of row 11 is untouched and still open | `/train/session`, head of `.wo-list` | ✅ **CLOSED** (fix wave) |
| 20 | **NEW (P2 Task 5) — the curve's DASHED „a terv várakozása" branch is NOT drawn.** The prototype's story-curve runs a solid past and a dashed future; production draws only the past. Nothing in the app forecasts an e1RM, and a dashed line is read as a prediction whatever its caption says — so the branch was refused, not deferred. The caption says what IS there (`ami eddig megtörtént · <dátum> óta` / `becslés, nem mérés`). Task 6's sweep also deleted the CSS Task 3 had ported for it (`.gy-curve-will`, `.gy-curve-cap .is-will`) — dead rules with no renderer; `StrengthCurve.test.tsx` and `ExerciseStoryPage.test.tsx` each keep an assertion that the class is ABSENT, so the decision is guarded by tests rather than by a comment. Re-opening it means shipping a model first | `/train/exercises/:key`, `Az erőd íve` | MINOR (deliberate, deferred) |
| 21 | **NEW (P2 Task 5) — the hero's CUE PROSE is omitted.** The prototype's story opens with per-exercise coaching copy („Talpak lent. Stabil lapockák…"). No production field carries it — not on the catalogue row, not on the record — so the alternatives were inventing coaching copy per exercise or leaving the slot out. It is left out. Adding it later is a CONTENT problem (161 catalogue rows need real text) plus one nullable column, not a layout one | `/train/exercises/:key` hero | MINOR (deliberate, deferred) |
| 22 | **NEW (P2 Task 5) — production-only date hedging the prototype has not.** The prototype's `jún. 3. óta` is a fixture, so it is always both recent and complete. Production's is neither: the story page therefore carries the YEAR on a date old enough to be misread as recent (`huMonthDayAged`, added beside `huMonthDay` rather than changing it app-wide — most callers state inherently recent dates), and says **„ebből az utolsó N látszik"** instead of an „óta" date whenever the series came back **FULL at the wire's 52-point cap** with more sessions behind it, because the oldest date the row then holds is the WINDOW's start, not a beginning (`sinceFact`, table-tested both branches). **The cap, not a mere shortfall, is the tell** (fix wave): points are also lost to ELIGIBILITY — a session with nothing e1RM-eligible is omitted while still counting in `sessionCount` — and those are scattered through the history rather than cut off the front, so „az utolsó 6 alkalom" on a 21-session row with 6 points was a falsehood on the common case. Below the cap the page states the absolute date instead. Extra copy against the prototype, kept deliberately: the alternative is a sentence that is wrong by up to a year | `/train/exercises/:key` hero + record cards | MINOR (deliberate) |
| 23 | **NEW (P2, kept) — the medal VITRINE stays a production-only screen.** In the prototype medals exist only as a story section (`Medáljaid` = this exercise's medals). Production also has `/train/medals` (`MedalsPage`), the whole collection, which the prototype has no screen for — so it is kept rather than folded in, and §16's catalogue poster gave its medal fact a real doorway to it (Task 4 fix round 1; it was `owns`-claimed in `navModel.ts` but unreachable). The page itself is still pre-Titanium (🏅 emoji rows, §20/§21 row 12): re-facing or retiring it is a P3 call, not a P2 parity blocker | `/train/medals` | MAJOR (open → P3) |
| 24 | **NEW (P2 Task 4) — the Plyo filter has no catalogue-level home.** The retired page's chip row was `all \| plyo \| <region>` (`muscleFilters.ts`'s `TOP_FILTERS`); the prototype's catalogue filters by REGION only, and that is what shipped (`libraryRegions`). So „Plyo" as a way to browse the catalogue is gone. It survives where it was actually used for work — the plan-builder's `ExercisePickerSheet`, still `muscleFilters.ts`'s only production consumer — so the module stays and only the catalogue axis died | `/train/exercises` chip row | MINOR (deliberate) |
| 25 | **NEW (P2 Task 6) — what the rebuild orphaned, swept.** An import-specifier scan of the final tree (not a word grep — the P1 lesson) found exactly ONE module that lost its last production consumer across Tasks 1–5: **`shared/ui/PageTitle.tsx`**, deleted with its case in `shared/ui/text.test.tsx`. The pre-Titanium `ExercisesPage` head was the app's last caller — every other page had already moved to a Titanium poster — so the primitive and its `.page-title` rule are gone. CSS: the whole **`.excat*`** catalogue family went too, **except `.excat-tag`**, which the Futás session card and the running page still stamp descriptors with. Pre-existing orphans (`MESOCYCLE_PHASE_COLORS`, `phaseBarHeight`, `workoutDetail*Mock`, `MiniStat`, `SportStat`, …) were left alone: already orphaned on `main`, tracked by `mezo-3iuoe`, not this branch's to judge. **What that scan CANNOT see, by construction:** it matches import specifiers — MODULES that lost their last importer. A WIRE FIELD has no import specifier of its own (it arrives inside an already-imported response type), so a field whose last renderer was deleted is invisible to it and stays invisible however thorough the sweep is. Row 26 is exactly that class of loss, and it was found by reading the retired sheet against the new page, not by this scan | `shared/ui`, `styles/prototype.css` | ✅ **CLOSED** (P2 Task 6) |
| 26 | **RECORDED DEATHS (P2 fix wave) — two wire fields whose last renderer went with `ExerciseRecordSheet`.** The retired REKORDOK sheet drew (a) the **`recentTopSets` sparkline** („Utolsó N alkalom · top szett", the top set of the last five sessions) and (b) the **`totalSets` half of its „Szett · rep ALL-TIME" pair**. `ExerciseStoryPage` ports neither: the prototype's story has no section for either — the strength curve is what it says about recent sessions, and the hero foot states VOLUME, not a set tally — so these are refusals, not oversights, and the page is a far richer story but **not** the "strict superset" `train.md` §9 first claimed (corrected there in the same wave). `totalReps` survives, in the bodyweight hero foot where volume would be a fake 0; `recentTopSets` survives only as dates inside `firstSeenDate`, never as a graphic. **The wire still carries both on every record** (`ExerciseRecordResponse`), so a later slice can surface them with no server work. Written down so they are rediscovered by reading — row 25's import-specifier scan cannot see a wire field, ever | `/train/exercises/:key` (data) | MINOR (deliberate, deferred) |

---

## 22. The ⓘ explain layer — all 13 controls, CLOSED (P3 wave, `mezo-b516k`, 2026-09-17)

The prototype's smallest control: one 22px icon-only button beside a heading (or inlined at
the end of a hero sentence), opening the workout-style 3D glass with a short plain-language
explanation. Production had **no info idiom at all** — rows 7, 8, 11–21 of the deep audit's
closing table (`2026-09-17-train-deep-parity-audit.md` §22) were thirteen BLOCKER-severity
missing controls across eight screens. All thirteen are now **✅ CLOSED**: one shared
primitive (`features/train/components/InfoButton.tsx`, built on `GlassBox`) placed thirteen
times, with the owner-iterated copy shipped **word for word**.

| Audit row | Screen | Title (the `aria-label` is `„<title> — mit jelent?"`) | Anchor in production | State |
|---|---|---|---|---|
| 7 | §3 plan day | Miért nyolcnál a jelölés? | `h3` „Mit terhel ez a nap" | ✅ CLOSED |
| 8 | §3 plan day | Mikortól él a változtatás? | `h3` „A nap gyakorlatai" | ✅ CLOSED |
| 11 | §5 muscle | Mit jelentenek a jelölések? | `h3` „Hol tartasz" | ✅ CLOSED — the copy interpolates the muscle's REAL MEV, never a literal |
| 12 | §8 template story | Mit jelent a szám? | `h3` „Heti szettek izmonként" | ✅ CLOSED — the static paragraph that used to print this sentence on the page was **deleted** in the same change, so it is said once, behind the button, as the prototype keeps it |
| 13 | §10 closed run | **Hogyan olvasd?** | the `Eyebrow` „Izmonként · indulás → elért csúcs / plafon" | ✅ CLOSED — **⚠ TEMPORARY TITLE SWAP** (see below) |
| 14 | §12 Terhelés | Miből áll össze a szám? | the `.ld-hero-say` hero sentence | ✅ CLOSED |
| 15 | §12 Terhelés | Mit mutat a sáv? | `h3` „Izomcsoportok ezen a héten" | ✅ CLOSED |
| 16 | §12 Terhelés | A sport és a szettek | inside the `.ld-sport` card | ✅ CLOSED — the prototype's `volley` art override has no clay equivalent; the card's own `i-sport` glyph stands in |
| 17 | §13 Izomtérkép | Miből rajzoljuk? | the `.ld-hero-say` sentence | ✅ CLOSED |
| 18 | §14 Mozgás | Miért becslés? | the `.ld-hero-say` sentence | ✅ CLOSED |
| 19 | §14 Mozgás | Hogyan olvasd? | `h3` „Izomcsoportok, sporttal együtt" | ✅ CLOSED |
| 20 | §17 exercise story | Mi számít rekordnak? | `h3` „Rekordjaid" | ✅ CLOSED |
| 21 | §17 exercise story | Mit mutat a vonal? | `h3` „Az erőd íve" | ✅ CLOSED |

**⚠ The one temporary divergence — audit row 13, §10 closed run.** The prototype's title
there is **„Mit mutat a sáv?"**. Production's muscle-journey section renders TEXT ROWS, not
the prototype's bars (a documented P1 decision, `mezo-e1ii9`), so that title would point at a
bar that is not on the screen. The **copy is verbatim** (it describes the journey, not the
bar); only the TITLE reads **„Hogyan olvasd?"**, and it **flips back to the prototype's
„Mit mutat a sáv?" when the surfaces slice (`mezo-fsz2r`) returns the bars**. This row is the
reason the matrix carries this table at all — do not close `mezo-fsz2r` without flipping it.

---

## Severity roll-up (one row per prototype screen)

| Severity | Count | Screens |
|---|---|---|
| **✅ CLOSED by P1** (`mezo-e1ii9`) | 4 | §3 day page, §10 closed run, §19 ceremony, and §18's prep phase (the screen itself drops to MAJOR) |
| **✅ CLOSED by P2** (`mezo-lf3cv`) | 3 | §15 jelek (Task 1 — the screen AND its §13 doorway), §16 Gyakorlatok (Task 4 — the catalogue), §17 exercise story (Task 5 — the screen, and the three capabilities §16 had orphaned) |
| **BLOCKER** (open → P2) | 1 | §11 wizard (all steps) |
| **MAJOR** (open → P2/P3) | 8 screens + the shell | §1 Mai, §3b day EDIT route (new in P1), §5 muscle detail, §9 closed list, §12 Terhelés, §13 Izomtérkép, §14 Mozgás, §18 active workout (in-card differences) (+ §0 global shell — **out of scope, owner decision A**) |
| **MINOR** (open → P3) | 5 | §2 Terv, §4 week, §6 library, §7 templates, §8 template story |

P1's own additions (§21 rows 16–17) are deliberate deviations, not debt: they are capabilities with no prototype counterpart, kept knowingly. Row 18 is the opposite bookkeeping — capabilities the slice ENDED, written down so the loss is a decision on record rather than a silent gap.

**P2's own additions (§21 rows 20–25) read the same way, in three groups.** *Refused, not deferred by accident:* the curve's dashed projection (row 20) and the hero's cue prose (row 21) — both need something production does not have (a forecasting model; 161 rows of real coaching copy), and both would have been easy to fake. *Kept against the prototype:* the date hedging (row 22) and the medal vitrine (row 23) — the prototype's fixtures are always recent and always complete, and it has no whole-collection screen; production is honest about both. *Ended:* the catalogue's Plyo axis (row 24) and the primitives the rebuild orphaned (row 25). Nothing on this list is waiting on a follow-up bead except row 23, which is a P3 re-face call.
