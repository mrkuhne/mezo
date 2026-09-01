# Edzés-szintű záró jegyzet — valódivá tétel

**bd**: `mezo-d20.8.2.2` (supersedálja a `mezo-s52z`-t) · **Epic**: `mezo-d20` (Design 2.0), F7.2 farok
**Dátum**: 2026-09-01

## 1. A probléma

A `WorkoutSummary` `closing` módja évekig egy **halott `<textarea>`-t** kínált: nem volt
`value`/`onChange`, a `finishWorkout` nem vitt bodyt, és a `WorkoutDetailResponse`-ban nem
volt hova visszaolvasni. Az F7.2 (`mezo-d20.8.2.1`) ezért **eltávolította** — „nem ígérünk
olyat, amit nem tartunk meg" —, és a helyét megjelölte a
[review-riport specben](2026-08-31-edzes-review-kontextus-riport.md) §5.

Ez a slice tartja meg az ígéretet: a mező valódi adattal tér vissza.

**Fontos elhatárolás.** A *gyakorlat-szintű* és a *set-szintű* jegyzet **már valódi**
(`PUT /api/train/exercises/{exerciseId}/note`, illetve `ExerciseSetResponse.note` — ez utóbbi
táplálja a review „· N jegyzet" számlálóját). Ami hiányzik, az az **egész edzésre** vonatkozó
egyetlen záró mondat.

## 2. Prior art

A `researcher` sub-agent jelentéséből (max 5 forrás), szűrve:

- **Átvéve — Hevy alakja**: egyetlen nullable szövegmező a munkameneten, a befejezéskor írva,
  **később a szerkesztő felületről átírható**. Egyetlen vizsgált alkalmazás sem kezeli a
  munkamenet-jegyzetet megváltoztathatatlan naplóbejegyzésként; az immutabilitás csak egy
  „a saját elgépelésedet sem javíthatod" büntetést adna, ami az ADR 0010-zel szembemegy.
  ([hevyapp.com/features/exercise-notes](https://www.hevyapp.com/features/exercise-notes/),
  [help.hevyapp.com](https://help.hevyapp.com/hc/en-us/articles/34463684392983-How-do-the-exercise-notes-routine-and-workout-notes-work))
- **Átvéve — Strava kérdés-címkéje**: a mentés-képernyőn nem csupasz mező áll, hanem egy
  kérdés („How did that activity feel?"). A kérdés-alakú címke leveszi a „mit is írjak ide?"
  költséget, ami az üres textarea fő elhagyási oka.
  ([support.strava.com/…/perceived-exertion](https://support.strava.com/en-us/articles/15401767-perceived-exertion))
- **Átvéve — Strong szemantikai kettévágása**: a munkamenet-jegyzet *szubjektív kontextus*
  (alvás, közérzet, betegség), a gyakorlat-jegyzet *technikai*. A mi placeholderünk ezt a
  regisztert célozza. ([help.strongapp.io/article/134-about-notes](https://help.strongapp.io/article/134-about-notes))
- **Elvetve — Strava strukturált skálája (chipek/RPE a jegyzet mellé)**: az alkalmazás az
  RPE-t (RIR-t) **már set-szinten gyűjti**, és a review Ø RIR cellája fogyasztja is. Egy
  második, edzés-szintű érzés-skála ezzel versenyezne, és fogyasztó nélkül puszta dísz lenne.
- **Figyelembe véve — a billentyűzet/CTA ütközés**: mobil böngészőben a `position: fixed`
  alsó CTA-t a virtuális billentyűzet elnyeli. A mi `.wsum-ctas`-unk **folyamban** van
  (`prototype.css:4283`, sima `padding` + `flex column`), ezért a billentyűzet tolja, nem
  takarja — a hibaosztály szerkezetileg elkerülve, nem workaroundolva.
  ([ishadeed.com/article/virtual-keyboard-api](https://ishadeed.com/article/virtual-keyboard-api/))
- Fenntartással: a „jegyzetek értékéről" szóló forrás gyártói blog, kemény adat nélkül —
  a fill-rate-eket senki nem publikálja. A belőle megtartott állítás annyi, hogy a **hozam a
  visszaolvasás oldalán van**, tehát a review-blokk nem utólagos ráadás, hanem maga a funkció.

## 3. Codebase terrain

Az `investigator` sub-agent jelentéséből, szűrve. Érintett feature: **`train`**
(`docs/CODEMAP.md:993`); érintkező: `_platform-data-layer` (Liquibase), `_platform-api-backend`
(kontraktus-first).

**A befejezés útja**
- `TrainController.java:312-315` — `finishWorkout(UUID id)` → `workoutService.finishWorkout(userId, id)`.
- `WorkoutService.java:730-755` — `ownedInstanceOrThrow` (`:758`, 404 idegen/ismeretlen/nem-instance
  sorra) → `if ("active") setStatus("completed")` (**idempotens**, az újra-lezárás no-op) →
  `toInstanceResponse` → progresszió → medálok `try/catch`-ben. **Nincs `completedAt` oszlop**,
  a lezártság maga a státusz.
- `WorkoutService.java:328-363` — `getWorkoutDetail`, a builder-lánc `:336-343`.

**A `note` oszlop csapdája — megerősítve**
`WorkoutSessionEntity.java:61-62` `@Column private String note;` **a terv-nap jegyzete**:
írja `TrainService.java:250` (mezociklus-létrehozás, template sor) és `TrainSeedData.java:353`;
**olvassa és publikálja** `TrainService.java:561` → **`MesoDay.note`**, továbbá
`MesoTemplateService.java:192` a `MesoDayJson` snapshotokba. Az instance-sorok soha nem
töltik: a példány-konstruktor (`WorkoutService.java:515-528`) 11 mezőt másol, a `note`-ot
szándékosan nem. Újrahasznosítva egy oszlop két jelentést hordozna, és bármely kódút, ami
instance-sort ad `toDay`-nek, a záró jegyzetet a mezociklus-terv felületére szivárogtatná.

**Követendő minták**
- Opcionális body meglévő body-nélküli POST-on: `MesocycleCloseRequest` (`train.yml:2113`,
  bekötve `:71-78` `required: false`-szal) + null-toleráns delegálás
  (`TrainController.java:175-180`).
- Fill-if-empty idempotencia: `TrainService.closeMesocycle:314-336` (`hasNote` guard — az
  újra-zárás csak *kitölti* az üres önértékelést, sosem írja felül).
- Jegyzet-írás alakja: `PUT /api/train/exercises/{exerciseId}/note` (`train.yml:1357-1393`),
  `TrainController.java:307-310`, `WorkoutService.java:717-728` (tulajdonos-szűrt 404,
  **blank = törlés**).
- Liquibase: `db/changelog/1.0.0/script/<yyyyMMddHHmm>_<bd-id>_<snake_case>.sql` + changeSet
  az `1.0.0_master.yml` végén (`id: "1.0.0:<fájlnév-tő>"`, `author: daniel.kuhne`,
  `sqlFile` + `relativeToChangelogFile: true`).
- FE dual-mode: minden hooknak explicit `isMockMode()` ága van; a mock finish no-op, ami
  seedelt választ ad — a mock jegyzetnek **körbe kell érnie a mock detail fixture-ön**, nem
  eltűnnie miközben mentést színlel.

**Csapdák**
- **Két guard-teszt azt állítja, hogy a mező nincs** — `WorkoutSummary.test.tsx:121-132`
  (`offers no workout-note field it cannot keep`, mindkét módra) és
  `WorkoutReviewPage.test.tsx:33-35`. Ezek **átírandók**, nem törlendők.
- Kontraktus-drift CI kapu (`ci.yml:39-68`): a commitolt `api/openapi.yml` és
  `frontend/src/data/_client/api.gen.ts` regenerálva kell legyen ugyanabban a commitban.
- `WorkoutSummary` **két hívós** (`ActiveWorkoutPage` fázis-gép + `WorkoutReviewPage` útvonal),
  és prezentációs: a jegyzet értéke és írása **az oldalé marad**.
- A `workoutDetail*Mock` fixture-ök `satisfies WorkoutDetailResponse` — a `note` maradjon
  opcionális, különben fordítási hiba.
- **A train-nek nincs feature-flagje és nincs train-szintű SwitchOffIT** (csak al-feature
  switch-off ITk: `ClosingBlockSwitchOffIT` stb.). Ide nem kell — és cargo-cultból sem.
- `WorkoutAutoCloseService` közvetlenül zár le elakadt sorokat, nem a `finishWorkout`-on át:
  a jegyzet-nélküli lezárást tovább kell tűrnie.
- ArchUnit `feature_slices_are_cycle_free` (freeze store): ez a slice nem visz be új
  feature-közti élt.

**Elavult dokumentáció, amit ez a kör javít**
- `docs/features/train.md` L133/L135 még azt írja, hogy a `closing` „egy opcionális,
  csak-lezáráskori jegyzetet" renderel `<textarea>`-ként, és hogy a perzisztálást a
  `mezo-s52z` viszi. A textarea az F7.2-ben eltűnt; a `mezo-s52z` ezzel a körrel supersedálva.
- `WorkoutSummary.tsx:5` fejléc-kommentje még `note`-ot sorol a `closing` módban — a kör
  végén újra igaz lesz.

## 4. Döntések

### 4.1 Tárolás — új `closing_note` oszlop
A §3 csapdája miatt a meglévő `note` nem hasznosítható újra. Új nullable `TEXT` oszlop a
`workout_session` táblán, Liquibase-scripttel. Entitáson `@Column(name = "closing_note")
private String closingNote;`.

### 4.2 Kontraktus — két írási út, egy séma
```yaml
WorkoutNoteRequest:
  type: object
  properties:
    note: { type: string, maxLength: 1000, nullable: true }
```
- `POST /api/train/workouts/{id}/finish` kap `requestBody: { required: false }`-t ezzel a
  sémával. A body-nélküli hívás **változatlanul működik** (a `WorkoutContractIT:80` ma is így hív).
- Új **`PUT /api/train/workouts/{id}/note`** ugyanezzel a sémával, `204/400/401/404`.
- `WorkoutDetailResponse` += opcionális `note: { type: string }`.

### 4.3 Szemantika
- **Finish: fill-if-empty.** A `finishWorkout` szerződés szerint idempotens; egy második
  lezárás (vagy egy body-nélküli újrapróbálkozás) **sosem törli** a már meglévő jegyzetet.
  A `closeMesocycle` szabálya, IT rögzíti.
- **PUT: last-write-wins**, `null`/blank → **törlés** (a `saveExerciseNote` szabálya).
- Mindkét út tulajdonos-szűrt (`ownedInstanceOrThrow`), idegen vagy ismeretlen id → 404.

### 4.4 Felület
- **`closing` mód** — a `.wsum-ctas` blokk **fölött**, `EntranceGroup`-on belül (pontosan ott,
  ahol a prototípus ma azt jelöli: „a halott `<textarea>` HELYE"):
  kérdés-címke **„Hogy ment?"**, alatta példa-placeholder és a textarea.
  A mező **opcionális és átugorható**: a `Edzés lezárása ✓` sosem függ tőle, és nincs
  „nem írtál semmit" jellegű visszajelzés (ADR 0010).
- **`closed` mód** — a mentett szöveg **Fraunces-kurzív blokként** (a `mezo-s52z` által
  hozott 2026-08-10-i mockup formanyelve). **Jegyzet híján a blokk nem renderel** — nem
  üres helyőrző valamiért, ami jogosan nincs.
- **Review oldal** — a blokk mellett `✎`, ami helyben textarea-vá nyitja (Mentés / Mégse).
  Mentés → `PUT`, majd a detail-query invalidálása; mock módban `setQueryData`. Így egy régi
  edzéshez utólag is fűzhető emlék, és a hiányzó jegyzet is pótolható.
- A jegyzet **értéke és `onChange`-e prop**, az oldal tulajdona — a megosztott
  `WorkoutSummary`-be mutáció nem kerül.

### 4.5 Elvetve
- **Hangulat-/erőfeszítés-chipek** a mező mellé: a RIR már set-szinten gyűjtött és fogyasztott.
- **A jegyzet betáplálása a companion/Memoár kontextusába**: önálló érték, külön bd issue
  nyílik rá. Ez a slice az adatot teremti meg, amire az épülhet.

## 5. Tesztelés

**Backend (Testcontainers)**
- `WorkoutContractIT`: finish jegyzettel → perzisztál; finish body nélkül → változatlanul
  működik; **újra-lezárás nem törli** a meglévő jegyzetet; >1000 karakter → 400.
- Új `WorkoutNoteApiIT`: PUT happy → 204 + visszaolvasható; blank → törlés; idegen/ismeretlen
  id → 404; >1000 karakter → 400.
- `WorkoutDetailContractIT`: `note` visszaolvasás a detail válaszban.
- SwitchOffIT **nincs** (a train nem flagelt).

**Frontend (mindkét mód)**
- `WorkoutSummary.test.tsx`: a guard-teszt megfordítva — `closing` bekötött mezőt kínál
  (gépelés → `onNoteChange`); `closed` a mentett szöveget olvashatóan mutatja; **üres
  jegyzetnél `closed` semmit nem renderel**.
- `WorkoutReviewPage.test.tsx`: a mentett jegyzet megjelenik; `✎` → szerkesztés → Mentés hívja
  a mutációt; a jegyzet nélküli fixture-ön nincs blokk.
- `ActiveWorkoutPage`: a beírt jegyzet eljut a `finishWorkout` hívásig.

**Vizuális goldenek**: az érintett edzés-review képernyők darwin + linux újragenerálva
(a golden PNG-k **mtime-ja és képe** ellenőrizve, nem a „passed" sor).

## 6. Nem cél

- Hangulat-/RPE-chip edzés-szinten.
- A jegyzet LLM-kontextusba emelése (külön issue).
- A `WorkoutAutoCloseService` viselkedésének változtatása — csak azt kell garantálni, hogy
  a jegyzet-nélküli automatikus zárás tovább működik.
