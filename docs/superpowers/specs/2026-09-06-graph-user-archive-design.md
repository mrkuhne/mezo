# Gráf-archiválás mint tartós felhasználói szándék + életcél GOAL-node + ablakos heti cél-blokk — design spec

**Dátum:** 2026-09-06 · **bd:** `mezo-06o0.5` (P2 bug, driving) + `mezo-iizd.11` (P3) + `mezo-a9os` (P3) · **Státusz:** brainstorm lezárva, spec review előtt · **Ág:** `feat/graf-archivalas`

## 0. Összefoglaló

Három backend-tétel egy körben, mert az első kettő ugyanazt a fájlt (`GraphPromotionService`) és ugyanazt a teszt-területet érinti, és a második a második fogyasztója annak a jelzőnek, amit az első bevezet.

1. **`mezo-06o0.5`** — a Tudásgráfon kézzel archivált node-ot az éjszakai `reconcile` némán visszaaktiválja, és a cím visszakerül a chat `[Összefüggések]` rendszerpromptjába. Ez a kör bevezet egy **felhasználói szándék-markert**, amit a promoterek tisztelnek, plusz egy **visszaállítás** végpontot, hogy a rejtés ne legyen visszavonhatatlan.
2. **`mezo-iizd.11`** — az aktív életcél GOAL node-ként a gráfban, `source_kind = life_goal`.
3. **`mezo-a9os`** — a heti visszatekintés cél-blokkja a **reviewed** hetet mérje, ne a `[most−6, most]` ablakot.

## 1. Döntések (a brainstormból, véglegesek)

| # | Döntés | Indok |
|---|---|---|
| D1 | Az archiválás **ragadós felhasználói szándék**: a szinkron soha nem írja felül, és csak a felhasználó oldhatja fel. A forrás állapot-változása (a cél lezárul, majd újraaktiválódik) **nem** oldja fel. | Tulajdonosi döntés. A gráf egy LLM-promptot táplál, amit a felhasználó máshogy nem tud kontrollálni; a „nem akarom látni" tartós preferencia, nem karbantartási ablak. |
| D2 | A szándék **külön oszlopban** él (`user_archived_at`), a `status` marad gép-származtatott. | A `status` bővítése aránytalan: `varchar(10)` (a `user_archived` 13 karakter), `ck_knowledge_node_status`, entity `@Pattern`, a kontraktus `StatusEnum` (`GraphMapper:16` **dob** ismeretlen értékre → contract-drift kapu), és ~12 olvasási hely, köztük 4 hardkódolt `status = 'active'` SQL-literál. A külön oszloppal **egyetlen olvasási utat sem** kell hozzányúlni. Ez a Kubernetes server-side-apply mező-tulajdonlás minimális desztillátuma (lásd 2.). |
| D3 | Meta-jsonb marker **elvetve**. | `GraphService.upsertNode:56` a teljes meta-térképet felülírja, és három promoter friss `Map`-et ad át — a marker minden éjjel elveszne, hacsak át nem írom mind a hármat merge-re. Rejtett, nem indexelhető, és a `meta` ma is típustalan közös szemétláda. |
| D4 | Lejáró némítás (Alertmanager-silence minta) **elvetve**. | Pontosan a bugot hozná vissza, csak lassabban. |
| D5 | A `restore()` **azonnal a forrásból származtatja újra** a státuszt (a node `source_kind`-ja szerinti egy-forrású szinkron), nem vakon `active`-ra állít. | Különben egy közben inaktívvá vált forrásnál a felhasználó „visszaállítottam, másnap eltűnt" élményt kapna. A `GraphPromotionService` a szükséges repository-kat már injektálja, tehát nincs új függés, és nem duplikálódik logika. |
| D6 | A **FE visszaállító felület a B körbe** kerül (új bd issue); ebben a körben a backend-végpont + az archivált-lista végpont készül el. | A kör backend-jellegű; a FE szekció vizuális goldeneket mozdítana. Vállalt ár: a csapda technikailag egy körig nyitva marad. |
| D7 | `mezo-iizd.11` wiring: **új port a `companion`-ban**, amit a `lifegoal` implementál. | ArchUnit `feature_slices_are_cycle_free` (frozen store): a `lifegoal` **már importálja** a `companion`-t, tehát a fordított import 2-szeletes ciklust zárna és bukna a build. A `people` precedens nem visz át (`feature/people`-nek nulla companion-importja van). |
| D8 | A `.11` bd-leírása **túllő**, javítandó. | Azt állítja, „a parkolt és lezárt célok minden éjjel visszakapcsolnának". A `syncGoal:135-144` mintája viszont *aktív⇒`active`, egyéb⇒`archived`, soha-nem-promotált+nem-aktív⇒no-op* — egy ugyanígy megírt life-goal sync a parkolt célt helyesen archiválná. A valódi blokkoló szűkebb: csak a KÉZZEL archivált node visszakapcsolása. |

## 2. Prior art

A `researcher` ügynök jelentéséből, szűrve:

- **Kubernetes server-side apply / `managedFields`** — mezőnkénti tulajdonlás: a controller csak a saját mezőit írja, a humán által birtokolt mezőre írás konfliktus. **Átvéve a minimális formájában** (D2): a `status` gép-tulajdonú marad, a felhasználói szándék külön mezőben él. A teljes managed-fields gépezet elvetve — aránytalan. https://kubernetes.io/docs/reference/using-api/server-side-apply/
- **GitHub Dependabot alert dismiss/reopen** — a felhasználói elutasítás ragadós (nincs TTL), explicit módon visszavonható, és a „Closed" fül alatt marad elérhető. **Átvéve** (D1 + D6: a ragadósság és az explicit restore). https://docs.github.com/en/code-security/dependabot/dependabot-alerts/viewing-and-updating-dependabot-alerts
- **Dependabot auto-reopen lényeges forrás-változásnál** — **elvetve** (D1): a tulajdonos döntése szerint a rejtés a forrás újraaktiválódását is túléli. Kevesebb meglepetés-csatorna.
- **Prometheus Alertmanager silences** (lejáró némítás) — **elvetve** (D4).
- **Salesforce/Marketo field-level write-deny** (a szinkron-user egyszerűen nem írhatja a mezőt) — **elvetve**: befagyasztaná a forrás későbbi változásait is. A mi guardunk csak a *felemelést* tiltja, az archiválás irányát nem.
- **CDC soft-delete / tombstone** — a tárolási alak (marker + időbélyeg, nem újraszámolt státusz-érték) innen jön; a szemantika nem. https://streamkap.com/resources-and-guides/cdc-soft-deletes-tombstones

## 3. Codebase terrain

Az `investigator` ügynök jelentéséből, szűrve. Érintett feature-blokkok: **companion** (`graph` al-feature, `docs/features/companion.md`), **lifegoal**, **proactive**, valamint egy sor FE-szöveg az **insights** felületen.

**Kulcsfájlok**

- `backend/.../feature/companion/graph/service/GraphPromotionService.java` — `SOURCE_*` konstansok `:43-49`; a négy feltétel nélküli státusz-emelés `:89-91` (`promotePattern`), `:119-121` (`promoteFact`), `:141-144` (`syncGoal`), `:183-186` (`syncPerson`); `reconcile(UUID)` `:368-447`, komplementer-söprés `:419-442`; `archiveBySource` `:300-307`; `truncateTitle` `:469-471`.
- `backend/.../graph/service/GraphService.java` — `upsertNode:43-58` (**a `setMeta:56` a teljes térképet cseréli**), `putMeta:73-79`, `listActive:82-85`, `archive:181-186`.
- `backend/.../graph/entity/GraphNodeEntity.java:43-101` — `STATUS_*` `:52-54`, `status varchar(10)` + `@Pattern` `:82-83`, `meta` jsonb `:99-101`.
- `db/changelog/1.0.0/script/202608221600_mezo-b3pp.6_create_knowledge_graph.sql` — `ck_knowledge_node_status:23`, `uq_knowledge_node_source:26-27`. **A `source_kind`-on nincs CHECK** (bare `varchar(20)`), tehát a `life_goal` migráció nélkül fér.
- `backend/.../feature/lifegoal/service/LifeGoalProgressService.java` — `progress:74`, `evaluate:86`, `evaluateDays:105/:111`, `today:134/:141`, `buildTodaySummary:174-195` (`RECENT_WINDOW_DAYS=7` `:59`).
- `backend/.../feature/proactive/service/WeeklyReviewContextSources.java` — `render:163-172` (az `appendLifeGoals:171` az EGYETLEN appender ablak nélkül), `appendLifeGoals:320-382`, a halasztást kódoló javadoc `:326-339`, `progress.today(userId)` `:361-365`, fejléc `:369`.
- `backend/.../feature/companion/LifeGoalSource.java` — a `.10`-ben bevezetett port; a javadoc maga mondja ki az irány-szabályt (lifegoal → companion).
- FE archiválási út: `insights/sheets/NodeDetailSheet.tsx:54-64` → `data/insights/graphHooks.ts:143-159` → `graphApi.ts:56` → `GraphController:42` → `GraphService.archive:181`.

**Olvasási utak, amik a státuszra szűrnek** (a D2 miatt egyiket sem kell módosítani): `GraphService.listActive/listActiveWithTopEdges/listCandidates`; `GraphTraversalQuery` nyers SQL `:80,:96,:100,:113` (**ez az `[Összefüggések]` forrása**); `GraphEdgeRepository:38,43`; `GraphEdgeStructurer:119`; `GraphMaintenanceService:89`; `LifeEventExtractionService:134`; `LifeEventCandidateService:69,84,113`; `ProfileAssembler:156-157`; `PersonExtractionService:285`; `CharacterHistoryReads:283`; `WeeklyReviewWeekWindow:65`.

**Csapdák**

1. **ArchUnit ciklus-szabály (FROZEN store)** — `companion` NEM importálhat `lifegoal`-t. → D7. A freeze-store-hoz tilos nyúlni; ha a szabály bukik, a terv rossz, nem a szabály.
2. **`GraphMapper:16` `StatusEnum.fromValue`** ismeretlen státuszra dob — a D2 épp ezért kerüli a státusz-bővítést.
3. **Promote/retract szimmetria**: minden source kind-nak van `promoteX`/`syncX` + `retractX` **és** egy ág a reconcile komplementer-söprésében. A `default -> false` miatt egy hiányzó ág örökre aktívan hagyja a node-okat.
4. **Idempotencia**: soha `repository.save` a node-ra — mindig `GraphService.upsertNode` a `(createdBy, sourceKind, sourceId)` kulcson.
5. **`GraphRetractionIT:129` és `:166`** azt állítja, hogy egy újra-megerősített pattern / újra-promotált fact **visszatér** `active`-ra. A marker bevezetése után ezt meg kell különböztetni a felhasználói archiválástól — a meglévő teszteket bővíteni kell, nem csak újakat írni.
6. **`GraphFactOptOutIT:163`** a legközelebbi meglévő precedens („a reconcile nem támaszthat fel").
7. **A FE szöveg teherhordó**: `NodeDetailSheet.tsx:62-64` ma azt ígéri, a node „a következő heti összegzésig" marad ki — a javítás után ez a másik irányba hazudik.
8. Fókuszált ITek **kihagyják** az ArchUnitot és a codemap-kaput; ezek csak a teljes CI-ban buknak.

## 4. S1 — Kézzel archiválás mint tartós szándék (`mezo-06o0.5`)

### 4.1 Adat

Új Liquibase script `db/changelog/1.0.0/script/<yyyymmddHHMM>_mezo-06o0.5_knowledge_node_user_archived.sql`, regisztrálva az `1.0.0_master.yml`-ben:

```sql
alter table knowledge_node add column user_archived_at timestamptz null;
```

Nincs CHECK-csere, nincs oszlop-szélesítés, nincs backfill (a meglévő archivált node-ok gép-archiváltnak számítanak — ez a helyes default: ma sem tudjuk megkülönböztetni őket, és a gép-archiválás a gyakoribb eset).

`GraphNodeEntity`: `private OffsetDateTime userArchivedAt;` + `public boolean isUserArchived()`.

A `ResetDatabase` TRUNCATE-listája már tartalmazza a `knowledge_node`-ot — nincs teendő.

### 4.2 Írás

- `GraphService.archive(userId, nodeId)`: `status=archived` **és** `userArchivedAt=now()`.
- Új `GraphService.restore(userId, nodeId)`: `userArchivedAt=null`, majd a státusz újraszármaztatása (4.4).

### 4.3 A javítás magja

A négy státusz-emelés (`:89-91`, `:119-121`, `:141-144`, `:183-186`) `isUserArchived()`-re őrzött: marker esetén a **felemelés** kimarad. Minden más (cím, összefoglaló, meta, él-strukturálás) fut tovább — a gráf továbbra is naprakészen árnyékolja a forrást, csak nem hozza vissza a színpadra.

Az **archiválás iránya érintetlen**: a `syncGoal`/`syncPerson` else-ága és a `retract*` metódusok változatlanul futnak; egy már archivált node archiválása no-op.

### 4.4 Visszaállítás

`GraphPromotionService.resyncNode(userId, node)`: a node `source_kind`-ja szerint switch-el, és a meglévő `promotePattern` / `promoteFact` / `syncGoal` / `syncPerson` metódust futtatja (az S2 ide teszi be az ötödik ágat). Forrás nélküli node (`source_id is null` — kézi/extractor eredetűek) `active`-ra megy.

`GraphService.restore` először törli a markert, majd ezt hívja — így a felszabaduló mező-tulajdonlás azonnal a gép aktuális ítéletét kapja, nem egy hajnalig hazudó `active`-ot.

### 4.5 Felület

Kontraktus-bővítés `api/feature/knowledge-graph/knowledge-graph.yml`-ben (a `status` enum **nem** változik):

- `POST /api/companion/graph/node/{id}/restore` → `GraphNodeResponse`
- `GET /api/companion/graph/node/archived` → `GraphNodeResponse[]` — a **kézzel** archivált node-ok (`user_archived_at is not null`), a visszaállító felület adatforrása.

Új repository-metódus a `GraphNodeRepository`-ban a kézzel archiváltak listázásához (derived query, nem nyers SQL).

### 4.6 Tesztek (IT, mock nélkül)

- `GraphRetractionIT:129` / `:166` mellé: ugyanaz a forgatókönyv **kézzel archivált** node-dal → a re-promóció NEM emel vissza.
- `GraphPromotionServiceIT`: `reconcile` kézzel archivált PERSON/GOAL node-on → marad archivált (a bug regressziós tesztje).
- `GraphApiIT`: archive → a marker beáll; restore → aktív forrásnál `active`, inaktív forrásnál `archived`; idegen node-ra 404.
- A cím/meta frissülésének igazolása kézzel archivált node-on (a guard csak a státuszt fogja).

### 4.7 Doksi

- `docs/features/companion.md:2541-2555` — a bekezdés ma **szándékos** viselkedésként írja le a feltámasztást; átírandó, nem toldandó. `:2461` a promóciós bejegyzések számát is említi.
- `NodeDetailSheet.tsx:62-64` szövege őszinte formára: az archiválás mostantól tartós. Ez az egyetlen FE-érintés ebben a körben.

## 5. S2 — Aktív életcél → GOAL node (`mezo-iizd.11`)

- Új konstans `SOURCE_LIFE_GOAL = "life_goal"` — a `SOURCE_GOAL` (súlycél) érintetlen. Nincs migráció (nincs CHECK a `source_kind`-on, `varchar(20)`, 9 karakter). Az `uq_knowledge_node_source` a `(created_by, source_kind, source_id)` hármason ül, ütközés kizárva.
- Új port a `companion`-ban (`LifeGoalGraphSource`), amit a `lifegoal` implementál: az összes életcél `id + title + status` hármasa. `ObjectProvider`-rel fogyasztva, `LIFEGOAL_SWITCH` mögött — hiányzó bean = nincs életcél-node, sosem kitalált cél. Ez a `LifeGoalSource` bevált idiómája (D7).
- `syncLifeGoal(userId, goalId)` a `syncGoal` mintáját másolja: aktív⇒`active`, egyéb (parkolt, lezárt)⇒`archived`, soha-nem-promotált+nem-aktív⇒no-op. A 4.3 guard rá is vonatkozik.
- `retractLifeGoal` + **ág a reconcile komplementer-söprésében** (csapda 3.).
- Trigger: a nightly `reconcile`, plusz azonnali szinkron a `lifegoal` írási útjáról (lifegoal → companion, legális irány), hogy egy frissen aktivált cél ne csak másnap jelenjen meg.
- Tesztek: új `GraphPromotionLifeGoalIT` — promóció aktív célra; parkolás→archivált; újraaktiválás→aktív; kézzel archivált life-goal node a reconcile után is archivált marad; a `LIFEGOAL_SWITCH` kikapcsolva nincs node.
- Doksi: `docs/features/lifegoal.md:90`, `:673-674`, `:959` (mindhárom „még halasztva, mezo-06o0.5 blokkolja") + `docs/features/companion.md` promóciós szakasza.
- A `.11` bd-leírásának javítása D8 szerint.

## 6. S3 — A heti cél-blokk a reviewed hetet mérje (`mezo-a9os`)

- `LifeGoalProgressService.summary(userId, from, to)` — az összes aktív cél összefoglalója tetszőleges ablakra. A meglévő `today(userId)` és `today(userId, LocalDate)` erre delegál (`from = to−6`), így a publikus felület **bővül, nem törik**; a `LifeGoalCompanionAdapter:59` és a `LifeGoalController:47-49` változatlan.
- A `pillarsHitToday` egy lezárt héten az ablak **utolsó napján** (`to`) értendő — definiált és őszinte; a prompt ma amúgy sem rendereli.
- `WeeklyReviewContextSources.appendLifeGoals(out, userId, weekStart, weekEnd)` — a másik öt appender alakja; a `render:171` hívás adja át az ablakot. Fejléc vissza `ÉLETCÉLOK · A HÉT IRÁNYA`-ra.
- A halasztást kódoló javadocok átírandók, nem toldandók: `WeeklyReviewContextSources:326-339` és a `WeeklyReviewContextSourcesIT` osztály-javadoc `:30-39`.
- Tesztek: `WeeklyReviewContextSourcesIT:95-104` állítása **megfordul** (a fejléc mostantól állítja a hetet); a `:76-88` találat-nap számláló a reviewed hét adataira igazítva; új eset: a reviewed héten kívüli (mai) adat NEM számít bele. Plusz `LifeGoalProgressApiIT`/unit szinten a `summary` ablak-határai.
- Doksi: `docs/features/lifegoal.md` + `docs/features/proactive.md` heti-visszatekintés szakasza.

## 7. Ami tudatosan kimarad

- **FE visszaállító felület** (Tudástár „Archivált" szekció + Visszaállítás gomb, Design 2.0) — új bd issue, B kör (D6).
- **Backfill** a meglévő archivált node-okra — nincs; a mai archiváltak gép-archiváltnak számítanak.
- **Élek visszaépítése visszaállításkor** — egy revive-olt node `isNew`-ja hamis, tehát a `GraphEdgeStructurer` nem fut újra (`companion.md:2556-2566`). Ismert, dokumentált korlát; ha a visszaállítás valódi felületet kap a B körben, ott mérendő fel.
- `mezo-iizd.13` (research-wiki), `mezo-9r85`, és minden más a `mezo-06o0` epicből.

## 8. Commit-térkép

| Szelet | bd id a commit-subjectben |
|---|---|
| S1 (marker, guard, restore, kontraktus, doksi, FE-szöveg) | `mezo-06o0.5` |
| S2 (life_goal source kind, port, sync/retract/reconcile) | `mezo-iizd.11` |
| S3 (ablakos summary, heti blokk) | `mezo-a9os` |
