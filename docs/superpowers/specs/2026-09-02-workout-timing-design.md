# Edzésidő mérése és dinamikus becslés

- **bd:** mezo-2k4q
- **Dátum:** 2026-09-02
- **Állapot:** elfogadott spec, implementáció előtt

## Probléma

A gyakorlati edzésidőről az app ma semmit nem tud. Az egyetlen időszám egy statikus
képlet (`frontend/src/features/train/logic/sessionLength.ts`,
`estimateSessionMinutes`), amely fix konstansokból (rep-idő 3.5s, átmenet 90s,
pihenő 150s/90s) számol, felhasználótól függetlenül. A `workout_session.duration_est`
oszlop létezik, de **soha semmi nem írja** — éles módban mindig NULL.

Cél: mérjük az aktív edzés és az egyes gyakorlatok tényleges végrehajtási idejét,
tároljuk, és a felhalmozott előzményből személyre szabottan pontosítsuk a jövőbeli
edzések időbecslését.

## Döntések

| Kérdés | Döntés |
|---|---|
| Granularitás | Edzés-szint + gyakorlat-szint (a már meglévő szett-időbélyegekből származtatva) |
| A becslés szerepe | **Kalibrációs réteg** a meglévő képlet felett, nem csere |
| Hol számol | Backend, perzisztált per-user profil |
| Időfogalom | **Két óra:** nyers `elapsed` + származtatott `active` (Strava-minta) |
| Profil kulcsai | Komponensenként, globális szorzó fallbackkel |
| Pihenő-timer | Változatlan — csak a becslés tanul |
| Látható felületek | Terv/tény a `WorkoutSummary`-ban; kalibrált szám a today-kártyán és a MesoEditorban |
| Szeletelés | Két szelet; a backfill az elsőben |

## Prior art

A `researcher` recon-ügynök jelentéséből átvett és elvetett minták.

**Átvéve:**

- **Strava — kettős óra.** Az `elapsed` (finish − start) nyers és megváltoztathatatlan;
  a `moving`/`active` külön, származtatott érték. A kettő soha nem írja felül egymást,
  és különböző fogyasztók különbözőt használnak. Nálunk: `elapsed` a megjelenítésé,
  `active` a becslőé.
  <https://support.strava.com/hc/en-us/articles/115001188684-Moving-Time-Speed-and-Pace-Calculations>
- **Hevy — esemény-alapú időrögzítés.** Az időadat a logolási eseményekből származik,
  nem külön timer-UI-ból: a „szett kész" koppintás ingyen ad időbélyeget. Nálunk ez már
  megvan (`ExerciseSetEntity.done_at`), csak nincs kihasználva — ezért nem kell új
  UI a méréshez. (Amit a forrás nem old meg: a félbehagyott sessionök kezelése; és a
  PWA-nak nincs iOS Live Activity megfelelője, ezért a „mindig látható futó óra"
  nudge-ot nem másoljuk.)
  <https://www.hevyapp.com/features/live-activity/>
- **RFC 6298 (TCP RTO) — EWMA + társított szórás + Karn-szabály.** A kanonikus
  „zajos ismételt megfigyelésekből adaptálj egy becslést" algoritmus: simított érték
  és simított eltérés (α = 1/8, β = 1/4), az első minta beveti magát, konzervatív
  alapérték minta előtt, és a **bizonytalan eredetű mintát el kell dobni, nem
  megbecsülni**. Kulcskomponensenként két float állapot, előzménytábla nélkül.
  <https://datatracker.ietf.org/doc/html/rfc6298>
- **Robusztus szűrés (medián/MAD, Hampel-kapu).** Nem az EWMA versenytársa, hanem
  előszűrője: a zajunk nem Gauss, hanem néhány óriási kiugró érték szennyezi.
  Nálunk két szinten jelenik meg: a szett-közi különbségek levágása a `gapCapSeconds`
  küszöbnél, és az eltérés-alapú kapu a profilfrissítés előtt.
  <https://towardsdatascience.com/the-comprehensive-guide-to-moving-averages-in-time-series-analysis-3fb2baa749a/>

**Elvetve:**

- **Fitbod — az időtartam mint generálási korlát.** A felhasználó megadja a
  célhosszt, és a generátor ahhoz komponál. Vonzó második felhasználása ugyanennek az
  adatnak, de első lépésnek rossz: összekötné a becslőt a mezociklus-generátorral, és
  egy rossz becslés nem csak téves számot mutatna, hanem megcsonkítaná a programot.
  <https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout>

## Codebase terrain

Az `investigator` recon-ügynök jelentéséből.

**Érintett feature-blokkok:** `train` (BE `feature/train`, contract
`api/feature/train/train.yml`, FE `data/train` + `features/train`, doc
`docs/features/train.md`). Másodlagos olvasó: `appnotification`
(`AnchorResolver.gymTitle`), `today` (FE re-export).

**Kulcsfájlok:**

| fájl | miért |
|---|---|
| `backend/.../train/entity/WorkoutSessionEntity.java:80` | `duration_est` az egyetlen időoszlop; **nincs `started_at`/`finished_at`** |
| `backend/.../train/entity/ExerciseSetEntity.java:74` | **`done_at Instant` már létezik és íródik** — a mérés nyersanyaga |
| `backend/.../train/service/WorkoutService.java:527` | a start útvonal (`date`, `status="active"`) — ide jön a `started_at` |
| `backend/.../train/service/WorkoutService.java:555` | `set.setDoneAt(Instant.now())` a `logSet`-ben; `:679` ugyanez a skip markeren |
| `backend/.../train/service/WorkoutService.java:745` | `finishWorkout` — ide jön a `finished_at` és az `active_seconds` |
| `backend/.../train/service/WorkoutService.java:525` | `instance.setDurationEst(template.getDurationEst())` — a `duration_est` **egyetlen** olvasója/írója |
| `backend/.../train/service/WorkoutAutoCloseService.java:31` | másnapi auto-close — az „elhagyott session" forrása |
| `backend/.../notification/service/AnchorResolver.java:203` | a `duration_est` egyetlen backend-olvasója (értesítés címe) |
| `frontend/src/features/train/logic/sessionLength.ts` | a statikus képlet + `SESSION_TIME` konstanstábla |
| `frontend/src/features/train/logic/restTimer.ts` | `restSecondsFor` (150s/90s) — a képlet és az élő timer közös száma |
| `frontend/src/features/train/components/WorkoutSummary.tsx:44` | `durationMin` — az egyetlen felület, ahová a tényidő változtatás nélkül befér |
| `frontend/src/features/train/pages/TrainTodayPage.tsx:319` | `workoutMinutes` chip |
| `frontend/src/features/train/components/MesoEditor.tsx:115` | `dayMinutes` hero |
| `frontend/src/features/train/logic/structureLint.ts:175` | `session-length` szabály, 45–90 perces sáv |
| `frontend/src/features/train/logic/peakWeekFit.ts:134` | a képlet másik szabály-fogyasztója |

**Követendő minták:** contract-first (a fragment, az `api/openapi.yml` és az
`api.gen.ts` egy commitban); ArchUnit-kényszerített alcsomagok
(`controller`/`service`/`entity`/`repository`), metódus-szintű `@Transactional`,
`@Value` tiltva — `@Validated @ConfigurationProperties` record (minta:
`feature/train/config/HypertrophyProperties.java`); tranzakciós self-invocation seam
(írás olvasási útvonalról → külön bean, minta: `WorkoutAutoCloseService`,
`ClosingBlockService`); feature-kapu `@ConditionalOnProperty` marker beannel +
`ObjectProvider`, kulcs a `FeaturesConfiguration`-ben, kötelező `*SwitchOffIT`;
származtatott számítás soha nem gördíti vissza az írást (`finishWorkout` medál-
derivációja try/catch-ben); Liquibase egy SQL/változás
`YYYYMMDDHHmm_<bd-id>_<snake_desc>.sql` néven; FE tiszta logika a
`features/train/logic/*.ts`-ben, táblázatos teszttel.

**Csapdák:** a CODEMAP-frissesség (`gen-codemap.mjs --check`) és a contract-drift
kapuk CI-ben; az `archunit-store` befagyasztja a megengedett kereszt-feature
ciklusokat; a teljes BE suite `-Dmezo.test.use-testcontainers=true` nélkül hamis
hibákat ad; a `VITE_USE_MOCK` beállítatlanul mock módot jelent, tehát a valós módú
kapu külön futtatás; a `POST /workouts` **folytat** egy nyitott instance-t (409
`TRAIN_WORKOUT_OPEN_ELSEWHERE` / `TRAIN_DAY_DONE_THIS_WEEK` őrökkel); a
`durationEst` élő contract-mező **producer nélkül** — a mock fixture-ök viszont
tartalmaznak értéket; az aktív edzés lapja zero-layout-shift és
`prefers-reduced-motion` konvenciót követ.

**Doc-elavulások, amiket menet közben javítani kell** (`docs/features/train.md` §4):
a „no UI reads `durationEst`" állítás szó szerint hamis (két hívó olvassa, csak
mindig NULL-t kap); a `TodayPage` `gymMinutes` fogyasztója már nem létezik; és sehol
nincs dokumentálva, hogy a `duration_est` oszlopnak nincs írója.

## Megoldás

### 1. szelet — mérés, tárolás, láthatóság

**Séma.** A `workout_session` táblára: `started_at Instant`, `finished_at Instant`,
`active_seconds Integer`. A `duration_est` érintetlen marad.

**Írási pontok.**

- **Start** (`WorkoutService:527`): `started_at = now()`, **csak ha még NULL** — a
  folytatás-szemantika miatt egy megszakított és újranyitott edzés órája nem indul újra.
- **Finish** (`WorkoutService:745`): `finished_at = now()`, majd `active_seconds`
  számítás.
- **Auto-close** (`WorkoutAutoCloseService`): `status = completed`, de `finished_at`
  **szándékosan NULL marad**. Így a `status = completed AND finished_at IS NULL`
  predikátum azonosítja az elhagyott sessiont, extra oszlop nélkül.

**Az `active_seconds` számítása.** Tiszta függvény külön decider osztályban (sima
unit teszt, `ProgressionDecider` precedens):

1. A session szettjeinek `done_at` bélyegei növekvő sorrendben.
2. A szomszédos különbségek összege, **minden különbség levágva `gapCapSeconds`-nél**.
3. Plusz a `started_at`-től az első `done_at`-ig tartó bevezető szakasz, szintén levágva.
4. Nulla szett → NULL. Egy szett → csak a bevezető szakasz.

Az `elapsed` nem tárolódik: `finished_at − started_at`, mindig származtatható.

**Backfill.** Liquibase SQL migráció Postgres `LAG()` ablakfüggvénnyel a `done_at`
fölött, ugyanazzal a levágással, minden meglévő completed sessionre. A régi sorok
`started_at`/`finished_at` mezője NULL marad (nincs miből előállítani), tehát
visszamenőleg csak `active` idő keletkezik — pontosan az, amit a 2. szelet használ.
A migráció idempotens: csak ott ír, ahol az `active_seconds` NULL.

**Konfiguráció.** `mezo.train.timing.*` egy `@Validated @ConfigurationProperties`
recordban: `gapCapSeconds`, `leadInCapSeconds`.

**Contract.** `ExerciseSetResponse` += `doneAt`; `WorkoutDetailResponse` és
`WorkoutTodayResponse` += `startedAt`, `finishedAt`, `activeSeconds`.

**Frontend.** A `WorkoutSummary` `durationMin` propja mellé egy tényleges idő; a
komponens ma is csak akkor renderel, ha az érték igaz, tehát a NULL eset magától
helyes. Az aktív edzés képernyője **nem változik**.

### 2. szelet — kalibrációs profil és becslés

**Entitás.** `workout_timing_profile`, felhasználónként egy sor, `OwnedEntity`
leszármazott. Komponensenként három érték: simított érték, simított eltérés, mintaszám.

| komponens | mit tanul | statikus párja |
|---|---|---|
| `work_per_set` | egy munkaszett tényleges hossza | `repSeconds 3.5` × ismétlés |
| `rest_compound` | pihenő összetett gyakorlat után | `restSecondsFor` 150s |
| `rest_isolation` | pihenő izolációs gyakorlat után | `restSecondsFor` 90s |
| `transition` | gyakorlatok közti átállás | `transitionSeconds 90` |
| `global_multiplier` | tényleges aktív idő / képlettel becsült idő | — |

**Tanulási szabály** (RFC 6298 szerkezet, komponensenként):

```
deviation ← (1 − β) · deviation + β · |érték − megfigyelés|
érték     ← (1 − α) · érték     + α · megfigyelés
```

α = 1/8, β = 1/4. Az első minta beveti magát kezdőértéknek, `deviation = érték / 2`.

**Outlier-kapu.** Egy megfigyelés csak akkor tanul be, ha a mintaszám elér egy
minimumot **és** a megfigyelés a simított értéktől `k · deviation`-nél közelebb van.
Különben **eldobjuk — nem vágjuk le**, mert a levágás tartósan felfelé torzítana.
Teljes session szintjén kizárva: `finished_at IS NULL` (auto-lezárt), és az a
session, amelyben a levágott lyukak aránya meghalad egy küszöböt.

**Cold start.** Minimum alatti mintaszámú komponens a statikus konstansát használja
`global_multiplier`-rel szorozva. A globális szorzó egyetlen befejezett edzés után
értelmes. A backfill miatt ez az állapot a gyakorlatban nem áll elő.

**Hol fut.** Külön bean, a finish útvonalról hívva (a `finishWorkout`
tranzakciójából self-invocation nem működne), `try/catch`-be zárva — a
profilfrissítés hibája **soha nem buktathatja meg az edzés lezárását**. Feature-kapu
`@ConditionalOnProperty` marker beannel, `ObjectProvider` injektálással, kulcs a
`FeaturesConfiguration`-ben, plusz `*SwitchOffIT`.

**Contract és felhasználás.** Egy `GET` végpont adja vissza a profilt. Az
`estimateSessionMinutes(exercises)` **opcionális második paramétert** kap: profil
nélkül bitre a mai értékeket adja, profillal a kalibráltakat. Ez a
visszafelé-kompatibilitás teszi lehetővé, hogy a hat hívóból csak kettőt állítsunk át.

**Ki kapja meg a profilt — szándékos aszimmetria:**

- **Igen:** `TrainTodayPage` `workoutMinutes`, `MesoEditor` `dayMinutes`. Ezek
  előrejelzések a felhasználónak.
- **Nem:** `structureLint` `session-length` (45–90 perces sáv), `peakWeekFit`. Ezek
  programozási szabályok. Ha a felhasználó lassú tempója felnyomná a számot, a lint
  panaszkodni kezdene egy jól megtervezett edzésre — a sáv jelentése felhasználónként
  elcsúszna.
- **Nyitva:** `AnchorResolver.gymTitle`. Ma NULL-ra esik vissza, mert a `duration_est`
  oszlopnak nincs írója. Külön bd issue, mert saját döntést igényel.

## Élhelyzetek

| helyzet | viselkedés |
|---|---|
| Auto-lezárt session | `finished_at` NULL → nincs tényidő, nem tanít |
| Nulla logolt szett | nincs `done_at` sorozat → `active_seconds` NULL, nem tanít |
| Egyetlen szett | csak a levágott bevezető szakasz |
| Éjfélen átnyúló edzés | `Instant` alapú számítás, nem `LocalDate` — nem gond |
| Utólag szerkesztett szett | `done_at` = a rögzítés pillanata; a rendezés helyreteszi |
| Backfillelt régi session | van `active_seconds`, nincs `started_at`/`finished_at` → tanít, tényidőt nem mutat |
| Kihagyott gyakorlat (skip marker) | `done_at`-et kap, de a `transition` tanulásából kizárva |

## Tesztelés

- **Unit (Spring nélkül):** `active_seconds` számítás (lyuk-levágás, egy/nulla szett,
  éjfél); EWMA + outlier-kapu (első minta, kiugró érték elutasítása, mintaszám).
- **Backend IT** (`@SpringBootTest` + Testcontainers, `TrainPopulator`): start írja a
  `started_at`-et; folytatás nem írja felül; finish számol és tárol; auto-close nem ír
  `finished_at`-et; a profil frissül finish után; auto-lezárt session nem frissíti;
  `*SwitchOffIT` a feature-kapura.
- **Backfill migráció IT:** ismert `done_at` sorozat, levágás és idempotencia.
- **Frontend:** `estimateSessionMinutes` táblázatos teszt profil nélkül (a mai értékek
  **változatlanok** — regressziós háló a hat hívóra) és profillal; mindkét mód
  explicit zöld.
- **Amit a fókuszált futtatás kihagy:** ArchUnit és a CODEMAP-frissesség. Új entitás,
  service és FE modul mind eltolja a CODEMAP-et; az `api/openapi.yml` és az
  `api.gen.ts` ugyanabban a commitban regenerálandó.

## Hatókörön kívül (YAGNI)

Futó óra az aktív edzésen · gyakorlatonkénti időbontás a review oldalon · explicit
szünet gomb · a pihenő-timer személyre szabása · időbüdzsé a mezociklus-generátornak ·
az értesítés címének javítása. Mindegyik önálló, későbbi döntés.
