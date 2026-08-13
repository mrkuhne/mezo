# Pattern-katalógus bővítés + AI-kontextus (V3.4) — design

**Dátum:** 2026-08-11 · **Státusz:** approved design (brainstorm session)
**Kapcsolódó:** [`companion.md`](../../features/companion.md) (V3.1 motor, V3.2 hipotézis-kör),
`2026-08-11-pattern-monitor-design.md` (monitor al-oldal — a diagnosztika fogyasztója és
részben előfeltétele a B3-nak).

## 1. Probléma

A motor 12 metrikát / 8 párt figyel, miközben az app ennél jóval több releváns adatot gyűjt
(edzés-feedback, check-in body/mental, alvás-részletek, meal score, People-említések,
habit/rituálé/XP). Ráadásul az adatokat AI is elemzi (V3.2 heti hipotézis-kör, később a
Phase-3 agy) — a determinisztikus párokon túl a hipotézis-körnek is gazdagabb takarmány kell.

## 2. Cél / nem cél

**Cél:** (A) 19 új metrika + 21 új pár (össz-katalógus: 31 metrika, 29 pár) — tisztán
additív bővítés; (B) három AI-kontextus tétel: digest-gazdagítás, heti metrika-tábla és
kapu-diagnosztika a `gather()`-ben.

**Nem cél:** a detektálási matek, az upsert-szabályok, az inbox vagy a FE változtatása
(az új párok maguktól jelennek meg); szöveg→szám leképezések (említés-tónus pontozás,
note-szentiment — az értelmezés az LLM dolga, nem a determinisztikus motoré); új tábla;
mélyalvás-metrika (`deepMin`/`remMin` — wearable-import felület nélkül permanensen üres
sorozat lenne; ha egyszer lesz wearable-import, V3.5-ként kerül be).

**Gyűjtő-UI audit (2026-08-11):** minden felvett metrika mögött MÁR LÉTEZIK gyűjtő-felület —
gym-feedback: a FeedbackModal „Set debrief" (pump/jointPain/workload, valódi POST);
body/mental: CheckInSheet; bedtime/wakeup/awakenings: SleepLogSheet; hrRecovery: RunLogSheet;
mentions: PersonLogSheet (Slice E). Új gyűjtő-UI-t a bővítés NEM igényel.

## 3. A) Új metrikák (19)

A `MetricKey` bővül (labelHu + a monitor-spec `sourceHu` mezője — amelyik spec előbb
implementálódik, az adja hozzá a mezőt, a másik követi); extraktoruk a
`MetricSeriesService`-ben. Aggregálási elv változatlan: hiányzó nap = nincs adat, sosem
találunk ki értéket.

### Közvetlen metrikák

| # | Kulcs | Forrás | Napi aggregálás |
|---|---|---|---|
| 1 | `gym-workload` | ExerciseFeedback `workload` 1–3 | átlag — **a gym-RPE proxy** |
| 2 | `gym-joint-pain` | ExerciseFeedback `jointPain` 1–3 | **max** (a fájdalom csúcs-érzékeny) |
| 3 | `checkin-body` | CheckIn `body` | átlag |
| 4 | `checkin-mental` | CheckIn `mental` | átlag |
| 5 | `bedtime-hour` | SleepLog `bedtime` | törtóra; **éjfél utáni órák +24** (01:00 → 25.0) |
| 6 | `sleep-awakenings` | SleepLog `awakenings` | max (több sor esetén) |
| 7 | `daily-protein-g` | FuelDay rollup | csak étkezéses napok (a DAILY_KCAL mintája) |
| 8 | `habits-done` | HabitDay `status=done` | darabszám |
| 9 | `ritual-closed` | RitualDay `closedAt` léte | 0/1 (point-biserial; konstans-kapu véd) |
| 10 | `daily-xp` | ActivityLog + HabitDay + DailyQuest `xpAwarded`/`xp` | összeg |
| 11 | `meal-score` | Meal `score` | átlag |
| 12 | `reta-dose-mg` | MedicationCycleService derivált aktuális dózis (a cycle JSON lépcsőjéből, a ciklusnap-deriválás mintájára) | napi érték |
| 13 | `wakeup-hour` | SleepLog `wakeup` | törtóra |
| 14 | `run-hr-recovery-s` | RunSessionLog `hrRecoverySec` | átlag (ritka adat — a kapu kezeli) |
| 15 | `social-mentions` | Mention (People) napi darabszám (`ts` napja) | darabszám |

### Derivált metrikák (sport-tudományi jelek)

| # | Kulcs | Számítás |
|---|---|---|
| 16 | `acwr` | 7 napos / 28 napos gördülő napi-terhelés arány; terhelés = sport-perc + gym-volumen közös skálára normalizálva. Az extraktor az ablak ELŐTTI 28 napot is beolvassa (belső ablak-kiterjesztés — a hívó `[from,to]`-ja változatlan). |
| 17 | `training-monotony` | Foster-monotónia: 7 napos gördülő átlag/szórás a napi terhelésen; szórás=0 → nincs adatpont (definiálatlan, nem ∞) |
| 18 | `bedtime-variability` | a `bedtime-hour` 7 napos gördülő szórása (social jetlag jel); min. 3 nap adat a gördülő ablakban |
| 19 | `weekend` | 0/1 (szo–vas) — tiszta naptári sorozat, minden napra létezik; kontroll-változó / hétvége-hatás |

## 4. A) Új párok (21 — össz 29; mindegyik metrikája mögött élő gyűjtő-UI van, ld. §2 audit)

Konvenciók változatlanok (kulcs = stabil identitás, sosem nevezzük át élőben; kategória +
magyar címke + cím a configban).

| Pár (`key`) | Lag | Kategória | Sejtett mechanizmus |
|---|---|---|---|
| `sleep-quality~next-day-gym-workload` | 1 | physiology | a hiányzó gym-RPE pár |
| `gym-volume~next-day-joint-pain` | 1 | response | túlterhelés-jel |
| `checkin-body~gym-joint-pain` | 0 | physiology | testérzet ↔ fájdalom |
| `gym-workload~next-day-checkin-body` | 1 | response | nehéz edzés → másnapi testérzet |
| `bedtime-hour~sleep-quality` | 0 | trigger | alvás-higiénia |
| `late-meal~next-sleep-awakenings` | 1 | trigger | a meglévő late-meal pár testvére |
| `checkin-stress~late-meal-hour` | 0 | trigger | stressz-evés |
| `habits-done~checkin-mental` | 0 | response | |
| `ritual-closed~next-sleep-quality` | 1 | trigger | esti lezárás hatása |
| `daily-protein~next-day-checkin-energy` | 1 | physiology | |
| `daily-xp~checkin-mental` | 0 | response | aktív nap → hangulat |
| `meal-score~next-day-checkin-energy` | 1 | physiology | étkezés-minőség → energia |
| `reta-dose~daily-kcal` | 0 | physiology | étvágy-elnyomás dózisfüggése |
| `sport-load~next-sleep-quality` | 1 | physiology | edzés → rákövetkező alvásminőség (az edzés→alvás irány eddig lefedetlen volt) |
| `wakeup-hour~checkin-energy` | 0 | trigger | |
| `sleep-quality~next-day-hr-recovery` | 1 | physiology | regeneráció-jel |
| `social-mentions~checkin-mental` | 0 | response | társas nap → hangulat |
| `acwr~next-day-joint-pain` | 1 | response | a sérülés-prediktor klasszikus |
| `training-monotony~checkin-energy` | 0 | physiology | Foster-monotónia |
| `bedtime-variability~checkin-mental` | 0 | trigger | social jetlag |
| `weekend~late-meal-hour` | 0 | trigger | hétvége-hatás láthatóvá téve |

**Futásköltség + kis refaktor:** a `detect()` (és a monitor) metrikánként EGYSZER számol
sorozatot futásonként (`Map<MetricKey, Map<LocalDate, Double>>` futás-szintű cache) — több
pár osztozik ugyanazon metrikán; 29 párra e nélkül is olcsó lenne, ezzel triviális.

## 5. B) AI-kontextus bővítés (a hipotézis-kör takarmánya)

1. **Digest-gazdagítás (L1):** a `DailySummaryService` digestje a számszerű L0 mellé
   felveszi a minőségi mezőket: check-in `note`, alvás `notes`, futás `notes`,
   étkezés-címek, említés-tónus + kivonat (People), intention-`reflection`. Mezőnként
   karakter-cap (config: `mezo.companion.summary.note-max-chars`, default ~200), a digest
   össz-cap változatlan elv szerint. A narratíva és az embedding is gazdagodik — a
   determinisztikus motor számára tiltott szöveges jel pont az LLM-rétegnek való.
2. **Heti metrika-tábla a `gather()`-ben:** kompakt blokk — az összes metrika utolsó 7 napi
   értéke (metrika-sor × nap-oszlop, hiányzó = `–`), a napi összefoglalók + tények +
   pár-statisztikák MELLÉ. A nyers számsorral az LLM nemlineáris/többváltozós sejtést is
   tehet (küszöb, U-alak, interakció), amire a páronkénti Pearson vak.
3. **Kapu-diagnosztika a `gather()`-ben:** a monitor-spec `PatternMonitorService`-éből a
   nem-élő párok egysoros összegzése (pár + verdikt + alignedN/minN). Az AI így a *hiányzó*
   adatról is tud actionable hipotézist tenni („ha edzés után workload-ot pontoznál…").
   Függőség: a monitor-service megléte; ha a katalógus előbb készül el, a B3 tétel a
   monitor-implementációval együtt landol.

## 6. Tesztek

- **Extraktor IT-k** (populátor-adat → elvárt sorozat): kiemelten a bedtime `+24`
  normalizálás, a bináris metrikák, az ACWR ablak-kiterjesztés (az ablak előtti 28 nap
  beszámít) és a monotónia szórás=0 esete; a többi extraktorra a meglévő minta.
- **Detektálási IT** legalább egy új párra end-to-end (adat → éjjeli detect → pattern sor).
- **Digest-teszt:** note-os nap digestje tartalmazza a capelt szöveget; üres note nem hagy
  nyomot.
- **Gather-teszt:** a metrika-tábla és a diagnosztika-blokk megjelenik a hipotézis-prompt
  kontextusában (fake LLM-mel).

## 7. Docs-hatás

`companion.md` (metrika-tábla + katalógus + gather-kontextus szakaszok), monitor-oldal
magától mutatja az új párokat (nincs FE munka), contract nem változik.
