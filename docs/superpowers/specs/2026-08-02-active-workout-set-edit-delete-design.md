# Aktív edzés — logolt szett szerkesztése + slot törlése (design spec)

- **Date:** 2026-08-02 · **bd:** `mezo-l3on` · **Domain:** Train (aktív edzés / workout execution)
- **Living docs to update on ship:** [`docs/features/train.md`](../../features/train.md) §2/§4/§9 · [`docs/features/_platform-data-layer.md`](../../features/_platform-data-layer.md) (hook-lista)
- **Design references (mandatory):** `api_contract_conventions.md` · `spring_patterns.md` · `error_handling.md` · `testing_standards.md` · `integration_test_framework.md` · `frontend_conventions.md` · `java_package_structure.md`
- **UI preview (reviewed & approved 2026-08-02):** [`2026-08-02-active-workout-set-edit-delete-mockup.html`](2026-08-02-active-workout-set-edit-delete-mockup.html) — három affordancia-variáns a valódi szett-listán; a **B** (sor → alsó lap) lett elfogadva.

---

## 1. Goal

Az aktív edzés szett-listáján a felhasználó tudjon **egy már logolt szettet javítani** (elgépelt súly/ismétlés/RIR) és **egy szettet törölni** — akár mert tévesen logolta, akár mert a tervezettnél kevesebbet csinál. Ma egyik sem lehetséges: a `logSet` kizárólag hozzáfűz, a lista sorai read-only-k, és a `＋ Szett`-nek nincs párja.

Idézet a felhasználói bejelentésből: *„Logolt setet nem tudok módosítani, nem tudok edzés közben törölni setet ha mondjuk kevesebbet fogok csinálni vagy már logoltam és törölném."*

---

## 2. Background — mi van ma

- **FE model.** `frontend/src/features/train/logic/workoutState.ts` — `Session.logged: Record<exerciseId, LoggedSet[]>`, ahol `LoggedSet = {weight, reps, rir}`. A per-gyakorlat kurzor **pozicionális**: `nextSetIdx = logged[id].length`. A slot-darabszám `effectiveSetCount = planned[id] + extra[id]`, ahol `planned` a sablon `warmupSets + workingSets` összege, az `extra` pedig a `＋ Szett` (kliensoldali, nem perzisztens). Az egyetlen mutáló művelet a `completeSet` (append) és a `skipExercise`.
- **Logolás.** `ActiveWorkoutPage.completeSet()` (`frontend/src/features/train/pages/ActiveWorkoutPage.tsx:400`) kiszámolja a `wasSetIdx`-et, lokálisan appendel, majd `logSet(workoutId, {exerciseId, setIndex, …})`-t hív. A válasz `medals` mezője tölti a `medalsBySet[`${exId}:${idx}`]` + `sessionMedals` klienskét.
- **Megjelenítés.** Ugyanezen fájl alján (`:1104`-től) a „prescribed set list": soronként `B{n}`/ordinál + `Bemel.`/`Working` tag + súly × ismétlés + RIR chip; a már logolt sor `opacity: .5` + ✓, **semmilyen interakció nincs rajta**. Fölötte a `.setdots` pont-sor és a `SetStepper` páros.
- **Backend.** `POST /api/train/workouts/{id}/sets` → `WorkoutService.logSet` (`:485`) — owned + `active` instance guard, a gyakorlat lánc-ellenőrzése, majd `ExerciseSetEntity` mentés + `medalService.forSet` derivált érmek (hibatűrően). **Nincs sem PUT/PATCH, sem DELETE a szetten.** Az entitáson viszont már ott a soft delete (`@SQLDelete` + `@SQLRestriction`, `ExerciseSetEntity:31`), így a törlés infrastruktúrája adott.
- **Miért nem elég a meglévő `Kihagyás`.** Az egész gyakorlatot jelöli kihagyottnak (skip-marker sor), és a volumen-motorban/heti számokban másképp számít, mint egy kevesebb szettel elvégzett gyakorlat.
- **Származtatott adatok.** Az érmek, a rekordok (`/exercise-records`) és a heti volumen-ramp mind a logolt szettekből **olvasáskor** derválódnak — nincs perzisztált aggregátum, amit egy szerkesztés elronthatna. Az XP/level-up a **finish**-nél keletkezik, ami ebben a hatókörben mindig a szerkesztés *után* következik.

---

## 3. Decisions (a brainstorming lezárt döntései)

- **D1 — Hatókör: kizárólag az aktív (`status = active`) instance.** A lezárt edzés (`/train/review/:id`) és a `complete` fázis érintetlen. Indok: a `finish` után az XP/level-up már kiosztott és a heti aggregátumok is beszámították a szettet; a visszamenőleges javítás külön, nagyobb feladat. A záró lapról (`phase = 'summary'`) a meglévő `← Vissza az edzéshez` visszavisz az aktív fázisba, tehát az utolsó pillanatban észrevett hiba is javítható.
- **D2 — Egységes slot-törlés.** A szett sor törlése **mindig elviszi a slotot is**: 4 tervezettből a 2. törlése után 3 slot marad, a mögöttes sorok előrelépnek. Ugyanez a gesztus működik logolt és még függő szetten. A hibás adat javítása **nem** törlés+újralogolás, hanem szerkesztés.
- **D3 — Affordancia: a teljes sor egy gomb → alsó lap.** A lap ugyanazokat a beviteli elemeket hozza, mint a logolás (`SetStepper` páros + RIR sor + Side + megjegyzés), így nincs második beviteli nyelv az appban, és izzadt kézzel egy egész sor a célpont. (Elvetve: soron belüli ✎/🗑 ikonok — 26px-es célpont, zsúfolt sor; húzás-törlés — rejtett affordancia, sehol máshol nincs húzós gesztus az appban.)
- **D4 — Padló: gyakorlatonként minimum 1 slot.** Az utolsó slot törlése tiltott (inaktív gomb + magyarázat), a gyakorlat elhagyására a `Kihagyás` való. Indok: a törlés ne írja felül egy másik művelet jelentését, és ne keletkezzen „sem nem kihagyott, sem nem elvégzett" gyakorlat.
- **D5 — Törlés után szerveroldali újraszámozás.** A megmaradt szettek `setIndex`-e 0..n-1-re rendeződik. Indok: a FE kurzor pozicionális (`logged.length`), és index-hézag esetén a következő `POST` ütköző `setIndex`-et küldene; a `seedFromOpen` dokumentált feltevése is a hézagmentesség.
- **D6 — Címzés szett-id alapján, nem index alapján.** `PUT`/`DELETE .../sets/{setId}`. Indok: a FE fire-and-forget `mutate`-et használ, két gyors, index-címzett törlés az újraszámozás miatt rossz sort vihetne el; az id ezt kizárja. A mock ág is generál id-t, hogy a két mód ne térjen el (mock fixture, ami elhagy egy mezőt, amit a valódi API kitölt = láthatatlan hiba).
- **D7 — Teljes csere, nem részleges patch.** A `PUT` törzse a szett mutálható teljesítmény-mezőit **egyben** hordozza (`weightKg` + `reps` kötelező, `rir`/`side`/`note` opcionális, hiányzó = törölt). Indok: elkerüli a JSON `null` vs. hiányzó kulcs háromállapotot, és a lap úgyis mindig a teljes szettet küldi. A `kind`, `setIndex`, `exerciseId` és a `targetWeightKg`/`targetReps` prescription-pillanatkép **nem** szerkeszthető.
- **D8 — Érmek a szerkesztés után.** A `PUT` válasza újraderivált `medals`-t hoz az adott szettre. A gyakorlat *többi* szettjének érme elvben szintén változhat (egy lehúzott 1. szett után a 2. lehet az új PR), ezért a kliens az érintett gyakorlat **összes** in-session érem-chipjét eldobja a művelet előtt, és csak a válasz érmeit rakja vissza — inkább hiányzó chip, mint hazug. A teljes, hiteles lista úgyis a `finish` válaszában érkezik (a meglévő merge+dedupe úton).

---

## 4. User-facing behavior

**Belépés.** Az aktív fázis szett-listájának minden sora gomb (teljes sor a célpont, jobb szélen chevron); `aria-label` pl. `„1. working szett szerkesztése — 82,5 kg × 9"`. Koppintásra `SetEditSheet` nyílik.

**Logolt szetten.** Cím: `{n}. working szett` / `{n}. bemelegítő szett`, alatta a gyakorlat neve. Tartalom: `Súly` + `Ismétlés` `SetStepper` (plyo gyakorlaton nincs súly, ahogy a logolásnál sem), `RIR` sor **csak working szetten**, `Side` sor **csak izolációs gyakorlaton**, végül a szett megjegyzése. Akciók: **`Mentés ✓`** (elsődleges) és **`Szett törlése`** (destruktív, körvonalas).

**Még nem logolt sloton.** Ugyanaz a lap, a stepperek a *célértéket* mutatják és le vannak tiltva; egyetlen akció a `Szett törlése`. Egy szabály marad: „a sor megnyitása → a szett kezelése".

**Törlés hatása.** A slot eltűnik: a `.setdots` pont-sor, a `n/m` számlálók és a pager azonnal követik; a mögöttes sorok előrelépnek. Ha logolt szettet töröltél, a gyakorlat visszaeshet befejezetlenre — ez rendben van, egyszerűen újra logolható (a debrief majd a következő „utolsó szett" logolásakor jön elő).

**Padló.** Ha a gyakorlatnak egyetlen slotja maradt, a `Szett törlése` inaktív, alatta: *„Az utolsó szett nem törölhető — a gyakorlat kihagyásához használd a `Kihagyás`-t."*

**Mit nem érint.** A `＋ Szett` változatlan. A kihagyott gyakorlat skip-markere nem szerkeszthető/törölhető innen. A lezárt edzés review-ja érintetlen.

---

## 5. Frontend design

### 5.1 `logic/workoutState.ts` — a modell bővítése

```ts
export interface LoggedSet {
  weight: number
  reps: number
  rir: number
  /** Szerver-oldali szett-id (PUT/DELETE címzéshez). A logolás pillanatában még hiányzik,
   *  a logSet válasza tölti; resume-nál a perzisztált sorból jön. */
  id?: string
  side?: 'L' | 'B' | 'R' | null
  note?: string
}

export interface Session {
  …
  /** Törölt slotok per exerciseId — a `＋ Szett` (`extra`) tükörképe, szintén kliens-állapot. */
  removed: Record<string, number>
}
```

Új tiszta függvények (mind ugyanabban a React-mentes stílusban, új Session-t adnak vissza):

| Függvény | Szemantika |
|---|---|
| `effectiveSetCount(s, id)` | **módosul:** `max(1, planned + extra − removed)` |
| `canRemoveSet(s, id)` | `effectiveSetCount(s, id) > 1` — a padló-szabály egyetlen forrása |
| `removeSet(s, id, index)` | Ha `!canRemoveSet` → változatlan `s`. Egyébként `removed[id]++`, és ha `index < logged[id].length`, a logolt bejegyzést is kiveszi (`splice`) |
| `updateLoggedSet(s, id, index, patch)` | A megadott indexű logolt szett mezőinek felülírása |
| `attachSetId(s, id, index, setId)` | A `logSet` válaszából érkező szerver-id bekötése |

`seedFromOpen` **kiegészül**: a perzisztált sorból `id`, `side`, `note` is átkerül a `LoggedSet`-be (ma csak `weight/reps/rir`).

### 5.2 `sheets/SetEditSheet.tsx` (új)

A megosztott `Sheet` primitívre épül (mint a `NoteEditSheet`). Props:

```ts
{
  exerciseName: string
  setLabel: string            // "1. working szett" / "B1 bemelegítő szett"
  mode: 'logged' | 'pending'
  kind: 'warmup' | 'working'
  exerciseType: 'compound' | 'isolation' | 'plyo'
  initial: { weight: number; reps: number; rir: number; side?: Side | null; note?: string }
  canDelete: boolean
  onSave: (v: { weight: number; reps: number; rir: number; side: Side | null; note: string }) => void
  onDelete: () => void
  onClose: () => void
}
```

`mode: 'pending'` → stepperek `disabled`, nincs `Mentés`. `kind === 'warmup'` → nincs RIR sor. `exerciseType !== 'isolation'` → nincs Side sor. `exerciseType === 'plyo'` → nincs súly-stepper. `canDelete === false` → a törlés gomb `disabled` + a magyarázó sor.

### 5.3 `ActiveWorkoutPage.tsx` wiring

- A read-only sor `<div>` → `<button type="button" className="setrow …">` (a meglévő inline stílusok megmaradnak; a `.setrow` osztály a `prototype.css`-be kerül a fókusz/press állapothoz).
- Új state: `editingSetIdx: number | null`. A lap mountja `editingSetIdx !== null && !feedbackEx` mellett (a debrief-átvétel ugyanúgy elsőbbséget élvez, mint az `ExerciseActionSheet`-nél).
- `handleSetSave(idx, v)`: `setSession(updateLoggedSet(…))` → `clearExerciseMedals(current)` → `updateSet(workoutId ?? 'mock', setId, body, { ctx, onSuccess: r => applyMedals(r, idx) })`.
- `handleSetDelete(idx)`: `rest.skip()` (a törölt szetthez tartozó pihenő-visszaszámlálás ne fusson tovább), `setSession(removeSet(…))`, `clearExerciseMedals(current)`, majd real módban `deleteSet(workoutId, setId)` — csak akkor, ha az `idx < logged.length` (a függő slot törlése tisztán kliens-művelet, nincs szerver-oldali sora).
- `completeSet()` `onSuccess`-e kiegészül: `if (r?.id) setSession(s => attachSetId(s, finishing.id, wasSetIdx, r.id))`.
- `clearExerciseMedals(ex)`: kiüríti a `medalsBySet` `${ex.id}:` prefixű kulcsait, és a `sessionMedals`-ból kiveszi az érintett érmeket (`medalKey` szerint).

### 5.4 Data layer (`data/train/`)

`trainApi.ts`:

```ts
updateSet: (workoutId: string, setId: string, body: SetUpdateRequest): Promise<ExerciseSetResponse> => …PUT…
deleteSet: (workoutId: string, setId: string): Promise<void> => …DELETE…
```

`trainHooks.ts` — `useTrain` két új mutációval, a meglévő `logSetMutation` mintájára, `onSuccess: invalidateToday`:

- `updateSet(workoutId, setId, body, opts?: { onSuccess?: (r?: ExerciseSetResponse) => void })` — **mock ág:** `{ id: setId, medals: [] }`. Szándékosan **nem** futtatja újra az `evaluateMockSetMedals`-t: az evaluátor modul-szintű futó előzményt vezet (`ps.push(...)` a `medalEvaluator.ts` végén), így egy újraértékelés a szerkesztett szettet **második** történeti sorként rögzítené és felfelé hazudná a következő rekordokat. Mock módban tehát a szerkesztett gyakorlat érem-chipjei egyszerűen eltűnnek — hiányzó chip, nem hamis chip.
- `deleteSet(workoutId, setId)` — mock ág no-op.
- A `logSetMutation` **mock ága kiegészül `id: crypto.randomUUID()`-val**, hogy a szerkeszthetőség mock módban is működjön (a `TrainData` felület nem változik ettől).

---

## 6. API contract (`api/feature/train/train.yml`) — contract-first

Két új művelet a meglévő `/api/train/workouts/{id}/sets` mellé:

```yaml
  /api/train/workouts/{id}/sets/{setId}:
    put:
      operationId: updateWorkoutSet
      summary: Overwrite the performance fields of one logged set in an ACTIVE workout instance
      # 200 ExerciseSetResponse (re-derived medals) · 400 · 401 · 404 · 409
    delete:
      operationId: deleteWorkoutSet
      summary: Soft-delete one logged set and renumber the exercise's remaining setIndexes
      # 204 · 401 · 404 · 409
```

Új séma:

```yaml
    SetUpdateRequest:
      type: object
      required: [weightKg, reps]
      properties:
        weightKg: { type: number, minimum: 0, maximum: 999 }
        reps:     { type: integer, minimum: 1, maximum: 100 }
        rir:      { type: integer, minimum: 0, maximum: 5, nullable: true }
        side:     { type: string, pattern: '^[LBR]$' }
        note:     { type: string, maxLength: 500 }
```

A `404` fed le minden „nem a tiéd / nem ehhez az instance-hoz tartozik / skip-marker sor" esetet (a `logSet` idiómája), a `409` a nem `active` instance-ot (`TRAIN_WORKOUT_NOT_ACTIVE`).

Regenerálás: `cd api/generate && npm run generate:api`, majd `cd frontend && pnpm generate:api`; a backend típusai a `generate-sources`-szal jönnek.

---

## 7. Backend design

`WorkoutService` (`feature/train/service/`):

```java
@Transactional
public ExerciseSetResponse updateSet(UUID createdBy, UUID workoutId, UUID setId, SetUpdateRequest req)
@Transactional
public void deleteSet(UUID createdBy, UUID workoutId, UUID setId)
```

Közös, a `logSet`-tel azonos őrök, egy privát segédbe emelve (`ownedActiveSetOrThrow`):

1. `ownedInstanceOrThrow(createdBy, workoutId)`;
2. `!"active".equals(status)` → `SystemRuntimeErrorException(SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE"), CONFLICT)`;
3. `exerciseSetRepository.findById(setId)` szűrve `createdBy` + `workoutSessionId == instance.getId()` + `!isSkipped()` → különben `notFound()` (404).

`updateSet`: felülírja a `weightKg`/`reps`/`rir`/`side`/`note` mezőket (a `rir`-t **warmup soron mindig `null`-ra**, tükrözve a logolás szabályát), `save` + `flush`, majd `medalService.forSet(...)` a `logSet`-ből ismert `try/catch` degradációval (az érem dekoratív, a felhasználó adata nem veszhet el egy derivációs hibán).

`deleteSet`: `exerciseSetRepository.delete(entity)` (a `@SQLDelete` miatt soft delete), `flush`, majd **újraszámozás** — a **már létező** `findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc` derived query eredményén végigfutva `setSetIndex(i)`, `saveAll`, `flush`. Új repository-metódus nem kell.

`TrainController`: a generált `TrainApi` két új metódusa, egysoros delegálás a service-re (`currentUserId.get()`), a `logWorkoutSet` mintájára.

Nincs migráció: az `exercise_set` tábla és a soft delete már létezik.

---

## 8. Testing

**Backend** (`integration_test_framework.md`, `ApiIntegrationTest`, AssertJ, populátorok):

- `PUT` 200 → a mezők perzisztálnak, a `kind`/`setIndex`/`targetWeightKg` **nem** változik;
- `PUT` warmup soron → `rir` `null` marad akkor is, ha küldtek;
- `PUT` idegen (más user) / más instance-hoz tartozó / skip-marker `setId` → 404;
- `PUT` lezárt (`completed`) instance-on → 409 `TRAIN_WORKOUT_NOT_ACTIVE`;
- `PUT` határon kívüli `reps`/`weightKg` → 400;
- `DELETE` 204 → a sor `is_deleted = true`, a lekérdezések nem hozzák, **és a megmaradt szettek `setIndex`-e 0..n-1** (a középső törlésével bizonyítva);
- `DELETE` után egy új `POST` `setIndex = n-1`-gyel nem ütközik (a hézagmentesség tényleges haszna);
- `DELETE` lezárt instance-on → 409.

**Frontend** (kolokált vitest, mindkét mód):

- `workoutState.test.ts`: `removeSet` (logolt közép / függő slot / padló-visszautasítás), `updateLoggedSet`, `attachSetId`, `effectiveSetCount` a `removed`-dal, `seedFromOpen` id/side/note átvétele;
- `SetEditSheet.test.tsx`: logged vs pending render, warmup → nincs RIR, isolation → van Side, plyo → nincs súly, `canDelete=false` → inaktív törlés + magyarázat;
- `ActiveWorkoutPage.test.tsx`: sor koppintás → lap; mentés → a sor új értéket mutat és a hook meghívódik a helyes `setId`-vel; törlés → eggyel kevesebb `.setdots` pont és sor; az utolsó slotnál a törlés tiltott;
- `trainHooks.test.tsx`: `updateSet`/`deleteSet` a helyes URL-t hívja (real), a mock ág érmet derivál újra és nem hív hálózatot.

**Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (a `data/**` érintése miatt a **teljes** FE suite mindkét módban), backend oldalon fókuszált `./mvnw clean test -Dtest='<újIT>,ArchitectureTest'` — a teljes IT-suite a CI dolga.

---

## 9. Out of scope / ismert korlátok

- **A slot-darabszám kliens-állapot marad.** A `removed` (ahogy a `＋ Szett` `extra`-ja is ma) nem perzisztál, így egy edzés közbeni app-újratöltés visszahozza a tervezett darabszámot. A **logolt szettek javítása/törlése viszont perzisztens.** Szerveroldali per-instance slot-override külön migrációt + kontraktus-bővítést kívánna → külön bd issue.
- **Lezárt edzés utólagos javítása** (D1) — külön feladat, az XP/aggregátum-visszahatás miatt.
- **Skip-marker visszavonása** („mégis csinálom") — nem ez a spec tárgya.
- **Kereszt-szett érem-újraderiválás** in-session (D8) — a hiteles lista a `finish`-nél érkezik.

---

## 10. Ship checklist

1. `api/feature/train/train.yml` + regenerálás (FE + BE típusok), contract-drift zöld.
2. Backend: service + controller + repository metódus + IT-k.
3. FE: `workoutState` → `SetEditSheet` → `ActiveWorkoutPage` → `trainApi`/`trainHooks` + tesztek.
4. `docs/features/train.md` §2/§4 (+ `_platform-data-layer.md` hook-lista), majd `node scripts/lint-docs.mjs`.
5. Self-PR → CI zöld → `--no-ff` merge → `git push origin main` → branch törlése.
