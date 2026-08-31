# F7.3 — Fuel mély kör: gyógyszer-flow, recept-mozaik, ablakok, sheet-család

- **bd:** mezo-d20.8.3 (design) · mezo-d20.8.3.1 (dev) · a mezo-d20.7.4 (add-medication API) ebbe a körbe olvad
- **Prototípus:** `docs/design_2.0/prototypes/fuel-mely.html` · artifact `d5c6d770-a067-4642-baa3-9dee63613718`
- **Jóváhagyva:** 2026-08-31 (Daniel) — a recept-oldal első, tabos változata elvetve („nagyon sok info"),
  a mozaik+sheet tagolás jóváhagyva; a többi blokk első körben átment.
- **Terjedelem-döntés:** FE + kis kontraktus. Az egyetlen új kontraktus-elem a `POST /api/medication`.

## Miért

A Fuel tab felszíne Mozaik (F3), a mélye viszont két generációt kever: a recept detail/editor és
13 sheet még a régi nyelvet beszéli, a Gyógyszer oldal pedig zsákutca — megjelenít és beadást
naplóz, de gyógyszert felvenni a UI-ból nem lehet (a kontraktusban a PUT/dose-log/ciklus már él,
csak a create hiányzik). A kör négy blokkja ezt zárja fel.

## A · Gyógyszer teljes életút

**Kontraktus (az egyetlen új elem):** `POST /api/medication` — request `MedicationRequest`
(a meglévő séma, változatlanul), response `201 MedicationResponse`. Üzleti szabály: egy usernek
egyszerre EGY aktív gyógyszere lehet (a `GET /api/medication` szingularitása ezt már kimondja) —
ha már van aktív, `400`. A leállítás NEM új végpont: `PUT` `active:false`-szal (soft-archive,
a dózis-történet megmarad). A `MedicationDayResponse` üres esetben ma is „nincs aktív" jelentésű —
ez nem változik.

**FE:**
- `MedicationFormSheet` (új, közös create/edit): név + hatóanyag, beviteli út chipek
  (subQ injekció / IM injekció / orális), dózis + egység, kadencia (heti + nap-chipek / napi),
  ciklus: 7 napos alap-sablon **2P·3S·2T** előnézettel (P/S/T cellasor a beadás napjától számolva).
  Fázis-szerkesztő NINCS ebben a körben (jóváhagyott default) — a sablon a `MedicationCycleConfig`
  alapértékét küldi.
- Üres állapot: a mai minimál-scaffold helyett clay ikon + „Nincs követett gyógyszer" + magyarázó
  sor + `＋ Gyógyszer felvétele` CTA → create sheet.
- Kitöltött oldal: a meglévő Mozaik-anatómia marad; alul ghost-pár `Szerkesztés` (edit sheet,
  prefill) + `Leállítás`. A Leállítás **kétlépcsős inline** megerősítés (szaggatott kártya +
  Mégse / Leállítom), és **soha nem error-tónusú** — döntés, nem hiba (ADR 0010 szellemében);
  a lav CTA viszi. Leállítás után az oldal az üres állapotra vált.
- A helye a lap alján (jóváhagyott default), nem a szerkesztő-sheetben.

## B · Recept detail + editor

**Detail — a tabok megszűnnek, a lap mozaikra tagolódik** (a jóváhagyott 2. iteráció):

1. Mozaik-hero kártya: kép-sáv (gradiens-placeholder — valódi kép nincs a dróton; jóváhagyott
   default), rajta slot-chip + ★ + fit-jelvény; alatta név + meta-sor (adag · idő · NOVA ·
   mérce · létrehozva).
2. Makró: eyebrow + `/adag ↔ egész` toggle + `.mz-statstrip` (kcal · P · C · F).
3. **2×2 mozaik** (a Fuel hub csempe-nyelve):
   - **Pontszám** (sage wash): score-gyűrű + „N szempont · megbízh. X%" + mérce + a két
     legerősebb dimenzió egy sorban. Koppintva a **teljes bontás sheetben** nyílik —
     a `ScoreBreakdownBody` MA IS közös a `MealScoreSheet`-tel; a sheet-héj is közössé válik
     (egy felület, két hívó). AI-olvasat lazy-load változatlanul.
   - **Mezo · olvasat** (lav wash): rövid próza (3 soros clamp) + fit-chip. Statikus csempe
     (nyitott kérdés volt; döntés: statikus marad, amíg a próza elfér).
   - **Hozzávalók** (gold wash): darabszám + tétel-nevek. Koppintva **saját csúszó lokális nézet**
     (nem útvonal — a prep csempe-oldalak precedense): soronként kategória-színsínes kártya,
     mennyiség + per-sor makró-hozzájárulás (+ NutrientCells, ahogy ma a tabon).
   - **Logok** (sky wash): darabszám + utolsó log. Koppintva kis sheet a log-sorokkal.
4. Akciók: `Mai étkezéshez` CTA + `★ Csillag` / `Törlés` ghostok — változatlan viselkedés.

**Ami nem változik:** minden adat és akció (serving-basis számítás, score lazy-load,
useRecipeActions, LogFlow-prefill, route guard). A törlés error-színe marad (destruktív akció,
nem riport — az ADR 0010 a riportokra vonatkozik).

**Editor — arc-csere, szerkezet marad:** a mezőlista változatlan (név, slot+csillag, szerep,
adag/idő, makró-összeg panel, hozzávaló-sorok stepperrel, Kamrából hozzáad, címkék, save-bar);
a chrome vált: `MozaikPage(sage)` + fcard-nyelv + chips + `.mz-statstrip` a makró-panelben.
A „finomhangolás" hozzávaló-override a log-flow-ban él és OTT marad.

## C · Étkezési ablakok (slots editor)

A logika (`validateSlotPlan`, Tier-2 gating) változatlan — a MEGJELENÉS rendeződik:
- Tier-1 hiba: korall wash-kártya (`role="alert"`) — itt jogos a korall: tiltott állapot,
  nem teljesítmény-ítélet.
- Warning: borostyán wash-kártya, sosem blokkol.
- Σ BUDGET sor: pill (sage `ok` / korall `bad` ±1% szabállyal) — a meglévő szabály vizuális
  nyelve a prototípus szerint.
- `✨ Mezo értékelése`: ghost gomb (hibánál disabled) → twinkle busy-sor → lav aicard verdikt-
  chippel (`rendben` sage / `érdemes igazítani` borostyán). A verdikt SOSEM kapuzza a mentést.
- A slot-kártyák a `.zcard` Mozaik-formát kapják (fcard-input, chips, stepper, budget-mező).
- Oldal-héj: MozaikPage(sage) + PageHero, a day-type váltó segtabs.

## D · Sheet-család — egy minta, 13 sheet

**A minta** (a prototípus sheet-anatómiája): grabber → eyebrow + cím (+ mono al-sor) + ✕ →
opcionális **tónusos hero-sáv** (csak ahol van mit headline-olni: MealScore score-gyűrű,
StackItem aktuális zóna — jóváhagyott default) → tartalom fcard/chips nyelven → gomb-sor
(ghost + CTA). A Sheet-héj (portal, drag-dismiss, animált csukás) változatlan.

**Érintett sheetek:** MealScoreSheet, StackPickerSheet, StackItemSheet, ImportItemSheet
(mindhárom mód), EnergyBreakdownSheet, LogDoseSheet, ReplanSheet, WaterLogSheet,
AddPantryItemSheet, CategoryFilterSheet, FuelSettingsSheet, IngredientPickerSheet,
ReceptPickSheet. (A KamraPickSheet már Mozaik — ő a precedens.)
Tartalmi változás nincs — arc-csere. A hat kulcs-sheet a prototípusban rajzolva; a többi a
mintát követi.

## Tesztek és kapuk

- Backend: create-medication IT-k (create, második aktív → 400, create után GET, inaktiválás
  utáni újra-create), a meglévő Medication IT-k zöldön maradnak.
- FE: MedicationFormSheet + üres állapot + leállítás tesztek; RecipeDetailPage tesztek átírása
  tab-assertekről mozaik/sheet-assertekre; slots megjelenés-tesztek; sheet-reface-ek meglévő
  tesztei zöldön.
- Guard: a leállítás-út és a gyógyszer-oldal sosem kap error-tónust (a slots Tier-1 hibája
  kivétel-lista, mert ott a korall a tiltott-állapot nyelve).
- Vizuális goldenek: recept-detail (mozaik), gyógyszer (kitöltött + üres), slots (hiba-állapot),
  + a score-sheet nyitva — mindkét platform.

## Ütemezés

Egy PR, TDD-slice-okban: (1) backend POST + kontraktus, (2) gyógyszer FE, (3) recept detail
mozaik, (4) recept editor, (5) slots, (6) sheet-família, (7) goldenek + docs (fuel.md,
CODEMAP ha kell).
