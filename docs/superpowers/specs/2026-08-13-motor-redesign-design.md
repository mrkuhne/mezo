# Motor tab redesign — domén-csoportos, élénk kapu-diagnosztika (design)

**Dátum:** 2026-08-13 · **Státusz:** approved design (brainstorm session, mockup jóváhagyva)
**bd:** `mezo-18bx` · **Mockup:** [`2026-08-13-motor-redesign-mockup.html`](2026-08-13-motor-redesign-mockup.html)
**Kapcsolódó:** [`insights.md` §2.8](../../features/insights.md) (a mai Motor tab),
`2026-08-11-pattern-monitor-design.md` (az eredeti monitor), `2026-08-11-pattern-catalog-expansion-design.md`
(V3.4 — a 29 pár / 31 metrika, ami miatt a lapos lista kinőtte magát).

## 1. Probléma

A Motor tab a V3.4 katalógus-bővítés után 29 pár-verdikt sort + 31 lefedettség-sort mutat két
lapos listában — fal. Emellett az appból nem derül ki, *honnan* jön egy metrika (melyik felület
gyűjti), sem az, *miért* figyelünk egy párt (a sejtett mechanizmus csak a spec-ben él); a puritán
UI pedig nem illik az app játékos-meleg vizuális nyelvéhez.

## 2. Cél / nem cél

**Cél:** ugyanaz az információ emészthető, élénk formában — státusz-összkép szűrőkkel,
domén-csoportosított pár-lista kibontható sorokkal (forrás + miért + kereszt-link a Patterns
kártyára), lefedettség domén nélkül, vékonyság szerint. Kis additív contract-bővítés
(forrás/domén/mechanizmus mezők).

**Nem cél:** új oldal vagy tab; a detektálási logika, a kapu, az 5-verdikt modell változtatása;
sparkline/sorozat-kiszállítás a FE-nek (ha kell, külön spec); a B-tételek (heti metrika-tábla,
digest) láthatósága; sötét téma-specifikus munka a token-rendszeren túl.

## 3. Szerkezet (a jóváhagyott mockup szerint)

Fentről lefelé a `MotorPage`-en:

1. **Korall hero-kártya** (primary gradiens, a gamified-header családja): eyebrow „Minta-motor",
   nagy szám: „**N élő összefüggés**", alatta három tény: figyelt párok száma · mért metrikák
   száma · „utolsó felismerés" (a mai fejléc `lastRunAt` szemantikája és „még nem talált mintát"
   esete változatlan). Az ablak/min-n/cron ide költözik kis szövegként vagy a hero alá.
2. **Státusz-chipek** — vízszintesen görgethető, nagy számos kártya-chipek: Élő / Kevés nap /
   Nincs adat / Degenerált / Fagyasztva, darabszámmal. Koppintás = **szűrő-toggle** (több is
   aktív lehet; aktív chip kiemelt keret). Alapállapot: nincs szűrés. Az Élő chip zöld
   kiemelést kap alapból is.
3. **Domén-szekciók** (összecsukható kártyák, bal színsáv + ikon-badge + tinted fejléc):
   - 🌙 **Alvás** (lila) · 🏋️ **Edzés** (korall) · 🥗 **Táplálkozás** (zöld) ·
     🧠 **Mentális & társas** (arany) · ⚖️ **Test** (barna) · **Egyéb** (semleges).
   - Fejlécen: domén-név, pár-darabszám, zöld „N élő" pill ha van, caret.
   - **Elsődleges domén-szabály (döntés):** a pár abba a szekcióba kerül, ahová a
     **B-metrikája (a kimenet)** tartozik — minden pár pontosan egyszer szerepel. Ha az
     A-metrika más doménű, kis színes chip jelzi a soron (a másik domén tint-színével).
   - Alapállapot: az a szekció nyitva, amelyben élő pár van (a többi csukva); szekción belül a
     mai verdikt-sorrend (`live → few_days kevés-hiányzó-elöl → degenerate → no_data → frozen`).
4. **Pár-sor** (a mai `GateVerdictRow` utódja): cím + verdikt-pill (élő: telt zöld,
   kevés nap: „MÉG N NAP" sárga, nincs adat: szürke, degenerált: téglavörös, fagyasztva: arany)
   + élő párnál **r-erősség mini-sáv** és az `r/n/p` egy sorban.
   - **Kevés-napos pár:** 🎯 **nudge-sor** — „<szűk keresztmetszet metrika logolása> még N napon,
     és ez a pár életre kel!" (determinisztikus magyar mondat a bottleneck metrikából + a
     `missingDays`-ből; a meglévő no_data/degenerate mondat-logika marad a maga eseteire).
   - **Koppintásra kibontás** (arany-tintás kártya):
     - 💡 *Miért figyeljük* — a pár `mechanismHu` egysorosa (új config-mező);
     - 📥 *Honnan jön az adat* — két forrás-pill: metrika-név + `sourceHu` („Alvás-napló",
       „Set debrief a workoutban", „származtatott: sport + gym terhelésből"…);
     - élő/fagyasztott párnál korall CTA: **„Minta megnyitása →"** —
       `/insights/patterns?pair=<pairKey>`-re navigál (a PatternsPage a query-paramra a
       megfelelő kártyához görget és kiemeli); a `PatternCard`-ra kis visszalink kerül:
       „Motor-diagnosztika →" (`/insights/motor`).
5. **Metrika-lefedettség szekció** (semleges kártya, csukható): soronként **progress-gyűrű**
   (lefedett napok aránya, benne a nap-szám), metrika-név, jobbra „N/60 nap · M pár vár rá"
   (élő párral rendelkező metrikánál „M pár"). Rendezés változatlan: legvékonyabb elöl.
   Sor-koppintásra mini-kibontás: `sourceHu` + a hivatkozó párok címei.

A státusz-chip szűrő a domén-szekciók TARTALMÁT szűri (üresre szűrt szekció fejléce halványan,
„0 találat" — nem tűnik el, hogy a szerkezet stabil maradjon).

## 4. Backend / contract (additív)

- **`MetricKey`** két új mezővel a `labelHu` mintájára:
  - `sourceHu` — honnan jön az adat, magyar egysoros (gyűjtő-felület vagy derivált-magyarázat);
  - `domain` — új `MetricDomain` enum: `SLEEP · TRAIN · FUEL · MIND · BODY · OTHER`.
    Besorolás: SLEEP = sleep-quality/duration, bedtime/wakeup-hour, awakenings,
    bedtime-variability; TRAIN = training-rpe, sport-load, gym-volume, gym-workload,
    gym-joint-pain, acwr, training-monotony, run-hr-recovery-s; FUEL = late-meal-hour,
    daily-kcal, daily-protein-g, meal-score, daily-water, reta-cycle-day, reta-dose-mg;
    MIND = checkin-stress/energy/mental, habits-done, ritual-closed, daily-xp, social-mentions;
    BODY = weight-delta-kg, checkin-body; OTHER = weekend.
- **`PatternPair` config** új kötelező `mechanism` mezővel (`@NotBlank`, magyar egysoros) — a
  29 pár mechanizmusa a V3.4-spec §4 táblájából, a 8 eredetihez újonnan írva.
- **Contract** (`api/feature/companion/companion.yml`, additív):
  - `PatternMetricCoverage` += `sourceHu` (string), `domain` (string enum, wire: kisbetűs);
  - `PatternMonitorPair` += `mechanismHu` (string), `metricADomain`, `metricBDomain` (string enum).
  - A `PatternMonitorService` csak áttölti az enum/config értékeket — új számítás nincs.
- **Patterns kereszt-link:** semmi új adat — a `PatternResponse` már hordozza a `pairKey`-t;
  a FE query-parammal görget. A fordított link statikus route.

## 5. Frontend

- `MotorPage.tsx` átszervezése + új prezentációs komponensek a `features/insights/components/`
  alatt: `MotorHero`, `VerdictFilterChips`, `DomainSection`, `PairRow` (a `GateVerdictRow`
  utódja — kibontás-állapottal), `MetricCoverageRing` (a `MetricCoverageRow` utódja). Mind pure
  props (`frontend_conventions.md`); a szűrő/kibontás lokális `useState`, nem URL-állapot.
- Domén-színek a meglévő token-rendszerből (lila kivétel: új `--domain-sleep` token a
  prototype.css-be, a többi a primary/success/accent/secondary rampákból) — sötét témában a
  tokenek váltanak.
- A mock-seed (`insights.ts` `patternMonitor`) bővül az új mezőkkel, mindkét mód zöld marad.
- `PatternsPage.tsx`: `?pair=` query-param kezelés (scroll + rövid kiemelés), `PatternCard`
  visszalink.

## 6. Tesztek

- **BE IT:** `CompanionPatternMonitorApiIT` — az új mezők jelen vannak és az enum/config
  értékeket tükrözik; config-validáció: mind a 29 pár `mechanism`-je nem üres (context-start).
- **FE (`MotorPage.test.tsx` bővítés, mindkét mód):** chip-szűrés (toggle, több aktív, üres
  szekció „0 találat" állapota); domén-szekcióba sorolás a B-metrika doménje szerint +
  másik-domén chip; kibontott sor tartalma (mechanizmus + két forrás-pill); nudge-mondat
  few_days-en; „Minta megnyitása →" csak élő/fagyasztott soron; lefedettség-gyűrű értéke.
- **FE (`PatternsPage.test.tsx`):** `?pair=` görgetés/kiemelés + visszalink.
- Vizuális baseline-ok frissülnek (CI `test-visual`).

## 7. Docs-hatás

`insights.md` §2.8 (szerkezet + komponens-lista + §10 key files), `companion.md` (contract-mezők
+ MetricKey mezők), `_platform-design-system.md` ha új token születik.
