# Rutin hub (/me/rutin) prototípus-hűségi újravágás (design spec)

- **Dátum:** 2026-09-04 · **bd:** `mezo-3zue.10` (bug, a `mezo-3zue` epic gyereke) · **Feature doc:** [habit.md](../../features/habit.md)
- **Forrás:** Daniel képernyőképe (2026-09-04) — a `/me/rutin` ma is nagyrészt az abszorbeált régi felületet rajzolja, nem a `mezo-3zue.1`-ben elfogadott prototípust ([`rutin-epito-body.html`](../../design_2.0/prototypes/src/rutin-epito-body.html) `#pg-rutin`, rationale: [design-iterations](../../design_2.0/2026-09-02-rutin-epito-design-iterations.md)). Az IA-döntés (egy otthon, redirectek) megvalósult, a **vizuális** újravágás nem.
- **Terjedelem:** tiszta frontend. Nincs kontraktus-, backend- és migrációváltozás.

## 1. Cél

A `/me/rutin` vizuálisan a `#pg-rutin` prototípus legyen — statstrip, kétsoros szokás-sor read-only pipával, csendes lánc-fejléc, záró elvi mondat —, a napnavigátor mint **tudatosan elfogadott bővítés** megtartásával.

## 2. Döntések (Daniel, 2026-09-04, in-session)

| # | Kérdés | Döntés |
|---|--------|--------|
| 1 | 30 cellás covtile-ok vs. statstrip | **Statstrip**, a prototípus szerint |
| 2 | Napnavigátor sorsa | **Marad a hubon**, a prototípust bővítjük hozzá |
| 3 | Sor-anatómia | **Prototípus-hű sor**, a ▲▼ chevronok csak billentyű-fókuszra láthatók |
| 4 | Lánc-fejléc chipje | **Csak erő %** (a `{kész}/{összes}` elmarad) |
| 5 | Záró `.habnote` | Bekerül, szó szerint |

A 2. döntés tudatosan szembemegy a külső prior arttal (ld. §8) — a hubod a rutin egyetlen otthona, és a „hol jártam tegnap" kérdésre ma nincs más felület. Ára: a hub megtartja kettős szerepét (szerkesztő **és** naplóvisszanézés).

## 3. Hatókör

**Benne:**
- `frontend/src/features/me/pages/RutinHubPage.tsx` — statstrip, sor-anatómia, lánc-fejléc, elvi mondat.
- `frontend/src/styles/prototype.css` — `.rt-hrow` kétsoros ráccsá; a `.gr-cov*` / `.gr-cells` blokk törlése; a ▲▼ fókusz-láthatóság.
- Tesztek (`RutinHubPage.test.tsx`) + vizuális goldenek újrabaseline-ja mindkét platformon.
- Doksi: `habit.md` §2/§9/§10, a prototípus `#pg-rutin` szekciója (napnavigátor-bővítés), design-iterations záró jegyzet.

**Kívül:**
- A napnavigátor áthelyezése/megszüntetése (a 2. döntés lezárta).
- A becsületes 30 napos naptár-rács — `mezo-11nm`, aminek a hatóköre ezzel **szűkül**: a rács igénye lekerül a hubról; a bd tételt ugyanebben a körben frissítjük.
- `mezo-x9c2` (tegnapi visszamenőleges logolás) — a napnavigátor megmaradásával a gazdafelülete is megmarad, változatlanul.
- `DayNavigator` / `DatePicker` primitívek — érintetlenek.

## 4. Változások részletesen

### 4a. Statstrip (1. eltérés)
A `.gr-covgrid` két `CounterTile`-ja helyére `<StatStrip className="rise">` három `StatCell`-lel:

| érték | címke | forrás |
|-------|-------|--------|
| `summary.perfectMorningDays30` | `tökéletes reggel · 30 n` | `HabitSummary` |
| `summary.perfectEveningDays30` | `tökéletes este · 30 n` | `HabitSummary` |
| aktív szokások száma | `aktív szokás` | `catalog.chains.flatMap(c => c.defs).filter(d => d.isActive).length` |

A 3. cellának nincs kontraktus-mezője; FE-oldali derivált. A prototípus JS-e az **összes** kirajzolt sort számolja (`rutin-epito-body.html:381`) — szándékosan az **aktív** olvasatot vesszük, mert a címke ezt állítja.

A strip a **múltnapi ágon is látszik**: 30 napos aggregátum, független a kiválasztott naptól — így a lap identitása nem ugrik napváltáskor.

Törlődik: `DAYS`, `Cells`, `CounterTile`, és a `prototype.css` `.gr-covgrid` / `.gr-covtile` / `.gr-cov-hd` / `.gr-cov-n` / `.gr-cells` (+ `gr-dotpop` és a hozzá tartozó reduced-motion sor) blokk.

### 4b. Napnavigátor (2. eltérés)
Változatlan, a statstrip alatt. Ez a prototípus **bővítése**, nem eltérés — a prototípus `#pg-rutin` szekciója és a design-iterations doc kap erről egy jegyzetet.

### 4c. Sor-anatómia (3. eltérés)
A `.rt-hrow` kétsoros rácsra vált (`grid-template-areas: "g n f" / "g b b"`, ×1.18-as prototípus-értékekkel):

- **1. sor:** `grip ⠿` · név · keret-chip (`⚓ FOGG` / `◈ CLEAR` / `– RÉGI`).
- **2. sor:** read-only `tick ✓` · erő-csík · `%`. A mai napon kész szokásnál a pipa kitöltött és a csík zöld (`.strength.done`), egyébként üres karika és arany csík.

A per-soros `Toggle` **kikerül**. A szüneteltetés/újraindítás egyetlen útja a `/me/rutin/szokas/{habitKey}` HabitPage saját toggle-je; a szünetelő def sora `is-inert`-ként halványul, de **tapphatóan** oda navigál (külön teszt fedi — ez volt a `mezo-3zue.4` hibahulláma).

A `SortableList` ▲▼ gombjai megmaradnak (a billentyűs átrendezés és a meglévő reorder-teszt hajtja őket), de alapból vizuálisan rejtettek, és `:focus-visible`-re jelennek meg. A grip marad a látható fogantyú.

**Hard rule marad:** a pipa read-only jelző, ticket ezen a lapon soha nem adunk — a pipálás a `/nap/rutin`-on él (ADR, `habit.md` §2/§5; kettős kattintható kontroll mock módban duplán oszt XP-t).

### 4d. Lánc-fejléc (4. eltérés)
A `.gr-band-chip` tartalma `{doneOf(items)} / {items.length}{· erő {avg}%}` helyett csak `erő {avg}%` (a prototípus `.pw`-je), és ha nincs erőadat, a chip elmarad — nem írunk oda hamis nullát. A napi kész/összes megmarad a heróban (`3 / 6`) és a múltnapi `.gr-daysum`-ban.

A **múltnapi** kártya fejléce (`pastCard`) továbbra is a napi `{kész}/{összes}`-t viszi: ott ez az adott nap egyetlen értelmes mérőszáma.

### 4e. Záró elv (5. eltérés)
A `PageBody principle=` szövege a prototípus `.habnote`-jára cserélődik szó szerint:

> Egyszerre egy szokás. A logolás maga a jutalom: a csík minden pipával emelkedik, egy kihagyás nem nullázza — csak halványítja. A pipa a Nap tabon él, itt a sor a szerkesztőt nyitja.

A mai szöveg („Kimaradt nap nem törli a láncot…") tartalma ebben benne van („egy kihagyás nem nullázza — csak halványítja"), tehát nem veszik el gondolat.

## 5. Megvalósítási irány

**Helyben, egy fájlban.** A `RutinHubPage.tsx` ~290 sor; a `defRow` / `todayCard` átírása és a `CounterTile` törlése lokális művelet. Elvetve: (a) a mai/múltnapi ág külön komponensfájlokba bontása — új fájlok, codemap-mozgás, több kockázat egy fidelity-körben; (b) a sor és a statstrip `shared/ui` primitívvé emelése — nincs második fogyasztó, YAGNI (a `StatStrip` már létező primitív, azt fogyasztjuk).

Új CSS a `prototype.css`-be, fejléc-kommenttel a prototípus fájl + szelektor + ×1.18 megnevezésével, a `mezo-3zue.3` blokk mintájára (`prototype.css:9066`).

## 6. Tesztelés (TDD)

Előbb bukó tesztek, mindegyiknél ellenőrizve, hogy a **helyes okból** bukik:

1. A hub három statcellát mutat (`tökéletes reggel · 30 n`, `tökéletes este · 30 n`, `aktív szokás`), és **nincs** 30 cellás covtile.
2. Az aktív-szokás cella az aktív def-eket számolja (szünetelő def nem számít bele).
3. A szokás-sor read-only pipa-jelzőt visel, és a kész szokás sora `done`-ként jelenik meg.
4. A soron **nincs** per-def toggle.
5. A szünetelő (`is-inert`) def sora továbbra is kattintható és a HabitPage-re navigál.
6. A lánc-fejléc chipje csak az erőt mutatja, kész/összes nélkül.
7. A záró elvi mondat megjelenik.

Átíródnak: a „keeps the 30-day counter tiles and the day navigator" eset (a navigátor-ága marad, a covtile-ág fordul), a per-def-toggle eset. **Változatlanul zöld marad:** a négy múltnapi eset, a chevron-vezérelt reorder, a `?new=` kiemelés, a heró-elnyomás.

Kapuk: `VITE_USE_MOCK=true pnpm test` **és** `VITE_USE_MOCK=false pnpm test` explicit, külön `pnpm exec tsc -b`, `node scripts/lint-docs.mjs --errors-only`. A `prototypeCssStructure.test.ts` fogja a kézi CSS-blokktörlés hibáit.

**Vizuális goldenek:** a `/me/rutin` a 14 screenshotolt képernyő egyike — újrabaseline **darwinon** (`cd frontend && pnpm test:visual:update`) **és linuxon** (`gh workflow run update-visual-baselines.yml -r <branch>`), ugyanebben a körben.

## 7. Doksi-kötelezettség

- `docs/features/habit.md` §2 (a `/me/rutin` blokk: covtile-leírás → statstrip, a sor-anatómia, a szüneteltetés útja), §9 (mock-erő gotcha szövege), §10 (FE-UI sor), front-matter `updated:`.
- `docs/design_2.0/prototypes/src/rutin-epito-body.html` `#pg-rutin` + `docs/design_2.0/2026-09-02-rutin-epito-design-iterations.md`: a napnavigátor mint elfogadott bővítés, és a lánc-fejléc/`aktív szokás` szemantika rögzítése.
- `mezo-11nm` bd tétel hatókör-szűkítése (a hub már nem kér napi biteket).
- `node scripts/gen-codemap.mjs`, ha új fájl születik (a jelenlegi terv szerint nem születik).

## 8. Prior art (researcher recon)

- [Habitify](https://intercom.help/habitify-app/en/articles/11957562-get-started-with-habitify) — a **Journal** (napi logolás) az egyetlen dátumsávos felület, a **Progress** tab kizárólag aggregátum (7/30 napos arányok), a per-szokás naptárrács a **Single Progress** drill-downban. [Progress tab](https://intercom.help/habitify-app/en/articles/8191613-progress-tab-overall-on-all-habits).
- [Loop Habit Tracker](https://github.com/iSoron/uhabits) — a listasor rövid, akcióvezérlő (név + score + néhány napnyi pipa); a teljes naptárrács, streak-lista, trendgörbe a per-szokás detailben. Globális „múltnap" képernyő nincs.
- [Streaks](https://streaksapp.com/) — dátummentes „ma" rács a home-on, külön statisztika-képernyő.
- [Apple Fitness](https://www.idownloadblog.com/2016/10/27/how-to-look-back-at-your-weekly-move-goals-progress-in-the-activity-app/) — a summary aggregált, a dátumos böngészés drill-down (gyűrűre koppintva swipe/naptár).

**Átvéve:** az aggregált statstrip a menedzsment-felületen (mind a négy forrás ezt csinálja), és a per-soros 30 napos heatmap elutasítása — a sor akcióvezérlő, a sűrűség a detailbe való.
**Elutasítva:** a napnavigátor áthelyezése a Nap tabra / külön history-felületre. Prior art szerint ez lenne a kanonikus, de nálunk a hub a rutin egyetlen otthona, más felület ma nem kínál múltnapi szokás-böngészést, és a `mezo-x9c2` (visszamenőleges logolás) is ezt a felületet célozza. Tudatos, jegyzőkönyvezett eltérés.

## 9. Codebase terrain (investigator recon)

- **Feature-blokkok:** `habit` (contract + FE data), `me` (FE-only, a lap itt él), `_platform-design-system` (`prototype.css`, `shared/ui`). A `today` (`/nap/rutin`) és a `growth` érintetlen.
- **Kulcshelyek:** `RutinHubPage.tsx:54-71` (`Cells`/`CounterTile`), `:234-238` (covtile mount), `:239-241` (`DayNavigator` mount), `:118-158` (`defRow` — `.gr-ck`, `.rt-fw`, `.rt-strength`, `Toggle`), `:162-200` (`todayCard`, lánc-chip a `:169-180` körül), `:203-218`/`:263-272` (múltnapi ág), `:231` (`PageBody principle=`).
- **Primitívek:** `shared/ui/mozaik/index.tsx:89-105` (`StatStrip`/`StatCell`), `:177-184` (`PageBody principle` → `.mz-principle`); `shared/ui/SortableList.tsx:118-140` (grip + ▲▼).
- **CSS:** `prototype.css:6084-6094` (`.gr-cov*`, törlendő), `:6095-6109` (`.gr-daynav`, `.gr-ck`, `.gr-daysum`, `.gr-softnote` — maradnak), `:9066-9095` (a `mezo-3zue.3` `.rt-*` blokk — ez vágódik át), `:4459-4469` (`.mz-statstrip` már ×1.18-ra skálázva).
- **Adat:** `data/types.ts:1387-1388` (`HabitSummary` = `perfectMorningDays30` / `perfectEveningDays30` / `habits[]`; **nincs** aktív-szokás szám, nincs napi bit, nincs streak), `habitHooks.ts:49-56` (`useHabitDay`), `:172` (`useHabitSummary`), `habitMock.ts:58-64` (statikus mock summary).
- **Minta, amit követünk:** `NapRutinPage.tsx:146-151` a repóbeli statstrip-idióma — hiányzó adatnál a cella **elmarad**, sosem hamis nulla.
- **Csapdák:** ×1.18-as prototípus-hűség (`_platform-design-system.md:528`), gomb-a-gombban tilalom (a sor `<button>`, az `aria-label` viszi a százalékot), a reorder pontos permutációt kíván (`HABIT_REORDER_MISMATCH`), a szünetelő elem sosem rejtőzik el, a vizuális golden-kapu, a `prototypeCssStructure.test.ts` blokk-parszolása, és hogy mock módban a summary statikus fixture (a statstrip állni fog, míg a `/nap/rutin` csíkja mozog — `habit.md` §9).
