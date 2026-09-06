# lifegoal 3b: companion-beágyazás — [Célok] blokk + get_life_goals (mezo-iizd.10)

Szülő-spec: [2026-09-02-lifegoal-system-design.md](2026-09-02-lifegoal-system-design.md) §7 + §9/3. szelet.

## 0. Összefoglaló

A companion ma semmit nem tud az életcélokról. Ez a szelet két darabot szállít:

1. **[Célok] blokk** a `ContextSnapshotAssembler`-ben egy új `LifeGoalSource` companion-porton
   át: aktív célok + heti nyilak, a leggyengébb pillér, a ma élő ha–akkor tervek. A blokk a
   chat-snapshotba **és** a reggeli (`renderWithoutBiometrics`) variánsba is bekerül
   (user-döntés: a reggeli cél-emlékeztető kívánt, pozitív nudge).
2. **`get_life_goals` chat-tool**: on-demand, gazdag per-cél részletek, hogy a beszélgetésben
   érdemben rá lehessen kérdezni ("hogy állok a kapcsolatok céllal?").

Kemény korlát (ArchUnit): a lifegoal már függ a companiontól (`MetricSignalSource`,
`LifeGoalProposePort`), ezért a companion→lifegoal irány NEM nyitható — minden a porton át megy,
az adapter a lifegoal-ban él. A ha–akkor nudge a `LifeGoalTriggerService` feed-értesítéséé
(dedupKey `<goalId>:<planKey>:<day>`); a blokk kontextus, nem második nudge-csatorna.

## 1. Döntések (a brainstormból, véglegesek)

- **Tool-mélység: gazdag (B).** A blokk tömör összefoglaló; a tool per-cél részleteket ad
  (pillérek állapottal, heti százalék, tervek). Nincs paraméterezés (YAGNI — userenkénti
  pár aktív célnál a "minden részletesen" is kicsi).
- **Reggeli variáns: igen.** A [Célok] blokk a `renderWithoutBiometrics`-be is bekerül —
  eltérés az [Emberek] chat-only precedenstől, szándékosan. Ellensúly: a reggeli
  prompt-útmutató kimondja, hogy a célokra támogatóan hivatkozzon, de a feed-értesítés
  szövegét ("ma él: …" nudge) ne ismételje el.
- **Port-alak: házminta (A).** Egy `LifeGoalSource` interface a companion gyökerében, két
  metódus, port-tulajdonú nested rekordok. A generált `api.dto` típusok átadását elvetettük:
  az ArchUnit átengedné, de a blokkot a lifegoal API-alakjához kötné, és minden létező port
  a saját-rekordos mintát követi.
- **"Ma élő tervek": read-only újrakiértékelés (A).** Az adapter a `LifeGoalTriggerRules`
  pure predikátumait futtatja emit nélkül — a blokk és a feed sosem mond ellent egymásnak,
  és a chat-turn read-only marad. A mai `LIFE_GOAL_PLAN` feed-sorok visszaolvasását
  elvetettük (a késleltetett ág miatt lemaradna az élő-de-még-nem-notifikált tervekről).

## 2. Prior art

A recon (researcher) szerint a mezőny pont erre a kettéosztásra konvergál; adoptáltuk:

- **Tömör, mindig jelen lévő profil-blokk + on-demand drill-down tool** — a ChatGPT
  "Model Set Context" minta (mindig jelen lévő tömör blokk;
  [TheBigPromptLibrary elemzés](https://github.com/0xeb/TheBigPromptLibrary/blob/main/Articles/chatgpt-bio-tool-and-memory/chatgpt-bio-and-memory.md))
  + a Whoop Coach on-demand adatlekérő pipeline-ja
  ([Whoop Locker](https://www.whoop.com/us/en/thelocker/behind-the-development-of-whoop-coach/)).
  Az [Anthropic context-engineering guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
  explicit ezt a hibridet ajánlja: kompakt preload + JIT részlet-tool. Ebből következik,
  hogy a blokkba terv-*címek*/rövid szövegek kerülnek, nem teljes terv-törzsek.
- **Nudge-csatorna szétválasztása** — az [Oura Advisor](https://ouraring.com/blog/oura-advisor/)
  a "modell tudja a célokat" és a "modell pingel róluk" dolgot külön knobként kezeli; a
  [Bloom CHI-prototípus](https://arxiv.org/pdf/2510.05449) prompt-guardrailje: a cél-adat
  háttér a személyre szabáshoz, emlékeztetőt másik csatorna küld, célt csak akkor említs,
  ha a user üzenete relevánssá teszi. Ezt a keretezést a prompt-útmutató átveszi — a reggeli
  variánsban a user döntése szerint enyhítve (támogató hivatkozás igen, értesítés-ismétlés nem).
- **Elvetve**: Whoop-stílusú teljes on-demand (nincs preload) — pár célnál felesleges
  latency és a modell nem mindig hívná a toolt, amikor kellene.

## 3. Codebase terrain

A recon (investigator) kulcs-horgonyai:

- **Assembler**: `ContextSnapshotAssembler.render` (`feature/companion/service/ContextSnapshotAssembler.java:139`)
  — kilenc `[X]` blokk fix sorrendben; `renderWithoutBiometrics` (:171) a reggeli variáns;
  splice-minta `peopleLine()` (:158). Konvenciók: determinisztikus tömör magyar szöveg,
  `NO_DATA = "nincs adat"`, szigorúan read-only (a `WorkoutService.getToday`-elkerülés
  precedense :351).
- **Blokk-sablon**: `PeopleSnapshotBlock` (`.../service/PeopleSnapshotBlock.java:46`) —
  `@Service` + `COMPANION_SWITCH`, `ObjectProvider`, config-cap a
  `CompanionProperties.snapshot()`-ban, `""` ha ki, catch-`RuntimeException`→`nincs adat`
  (IDENT-3 kavealt: `DataAccessException` a catch ellenére rollback-only-ra teszi a turnt —
  elfogadott precedens).
- **Port-minta**: `feature/companion/TodayQuestSource.java` — interface a companion
  gyökerében, nested rekordok, adapter a tulajdonos feature-ben, `ObjectProvider`-fogyasztás.
  Fordított irányú precedens: `feature/lifegoal/engine/MetricSignalSource.java`.
- **Tool-sablon**: `GoalTools` (`.../tools/GoalTools.java:49`) — `@Tool` + hosszú magyar
  routing-leírás, `ToolContexts.userId`, `addRef`, lista-cap 3. Regisztráció:
  `CompanionToolRegistry.java:43` (batch!), `ChatService.java:126` `[Eszköz-útmutató]`
  (:121 "cél, kalóriacél → get_goal" sort pontosítani kell), `ChatToolDomains.java:15`.
- **Lifegoal-adat**: `LifeGoalProgressService.today` (:128) adja az aktív célokat + nyilakat;
  leggyengébb pillér sehol nincs számolva — a `buildPillarProgress` per-pillér nyilaiból
  derivált; `LifeGoalTriggerRules` pure és újrafuttatható (a `LifeGoalTriggerService.emit`
  :149-161 a dedup-os nudge-út, azt NEM hívjuk).
- **Szókincs**: `WeeklyReviewContextSources.appendLifeGoals` (:360-386) — nyilak szóként,
  "magyarázd, ne számold újra", hiány mondatban, soha nem "0".
- **Tesztek tükrözendők**: `ContextSnapshotAssemblerIT` (+ determinizmus: két render
  `equals` → `today` paraméter, semmi `LocalDate.now()` a blokkban), per-blokk switch-off IT,
  `CompanionToolsRenderIT`, `CompanionToolRegistryIT` (a 15-ös tool-batch pin → 16),
  `ChatServiceIT` (system-prompt pin), `ToolSelectionEvalIT`.
- **Csapdák**: az ArchUnit-ciklust csak a teljes `./mvnw test` fogja el (CI self-PR a kapu);
  `LIFEGOAL_SWITCH` független a `COMPANION_SWITCH`-től; codemap-regenerálás kötelező;
  `companion.md` blokk-szám állításai elavulnak.

## 4. Architektúra

### 4.1 `LifeGoalSource` port (companion gyökér)

```java
public interface LifeGoalSource {
    Summary summary(String userId, LocalDate today);   // a [Célok] blokknak
    Details details(String userId, LocalDate today);   // a get_life_goals toolnak

    record Summary(List<GoalLine> goals, String weakestPillar, List<String> livePlans) {}
    record GoalLine(String title, String dimension, String arrow, int pillarsHitToday,
                    int pillarsTotal) {}

    record Details(List<GoalDetail> goals) {}
    record GoalDetail(String id, String title, String dimension, String frame, String arrow,
                      Integer weekPercent, List<PillarLine> pillars, List<PlanLine> plans) {}
    record PillarLine(String name, String source, boolean hitToday, String weekState) {}
    record PlanLine(String text, boolean liveToday) {}
}
```

(A rekord-mezők véglegesítése az implementációs tervben, a `LifeGoalProgressService`
tényleges alakjaihoz igazítva — a lényeg: port-tulajdonú típusok, semmi lifegoal-import.)

- `arrow` már szóként érkezik (a `WeeklyReviewContextSources.arrowWord` szókincsével);
  `weakestPillar` `null`, ha nincs elég adat a derivációhoz.
- `weekPercent` `null`-olható (no-data kapu).

### 4.2 Adapter (lifegoal oldal)

`feature/lifegoal/service/LifeGoalCompanionAdapter` — `@Component`, `LIFEGOAL_SWITCH`-gátolt,
`implements LifeGoalSource`.

- Aktív célok + nyilak: `LifeGoalProgressService` today/progress útvonalai.
- Leggyengébb pillér: a per-pillér heti állapotokból derivált (a legrosszabb nyilú/legkevesebb
  találatú, determinisztikus tie-break névsorrenddel); `null`, ha minden pillér no_data.
- Ma élő tervek: `LifeGoalTriggerRules` predikátumok read-only futtatása a mai napra —
  **emit nélkül**, a `LifeGoalTriggerService`-t nem hívja.
- `today` mindig paraméter.

### 4.3 [Célok] blokk

`feature/companion/service/LifeGoalSnapshotBlock` a `PeopleSnapshotBlock` sablonján:

- `@Service` + `COMPANION_SWITCH`; `ObjectProvider<LifeGoalSource>` — hiányzó bean → `nincs adat`.
- Config: `CompanionProperties.snapshot()` új mezők — blokk be/ki + max cél-sor (default 3).
  Kikapcsolva `""`, a splice üres sor nélkül kihagyja.
- Catch-`RuntimeException` → `nincs adat` (IDENT-3 kavealt átvéve, savepoint nincs).
- Formátum (tömör, determinisztikus):

  ```
  [Célok] Kapcsolatok: heti szinten erősödik, ma 2/3 pillér. Egészség: stagnál, ma 1/4 pillér.
  Leggyengébb pillér: esti séta. Ma él: ha 21:00 után képernyő, akkor olvasás.
  ```

  Nincs aktív cél → `[Célok] nincs aktív életcél`. Szókincs a
  `WeeklyReviewContextSources`-ból; soha nem "0 találat-nap".
- Bekerül a `render()` ÉS a `renderWithoutBiometrics()` splice-listájába (fix pozíció,
  a meglévő sorrend-konvenció szerint).

### 4.4 `get_life_goals` tool

`feature/companion/tools/LifeGoalTools` a `GoalTools` sablonján, de a **porton** renderel
(`ObjectProvider<LifeGoalSource>` → `details`), lifegoal-import nélkül.

- `@Tool(name = "get_life_goals", description = <magyar routing-szöveg: életcél, életterület,
  PERMAH, pillér, ha–akkor terv, "hogy állok a … céllal">)`.
- `ToolContexts.userId(toolContext)`; `addRef("life_goal", goalId)` célonként — ehhez a
  `GoalDetail` hordozza az id-t.
- Kimenet: célonként cím + dimenzió + nyíl + heti % + pillérek (mai találat, heti állapot) +
  tervek ("ma él" jelzővel). Hiány őszintén; modul kikapcsolva → "az életcél-modul ki van
  kapcsolva".
- Regisztráció: `CompanionToolRegistry` (batch 15→16), `ChatToolDomains.DOMAIN_OF`
  (domain: growth/lifegoal a meglévő taxonómia szerint), `ChatService.SYSTEM_PROMPT`
  `[Eszköz-útmutató]` új sor + a "cél, kalóriacél → get_goal" sor elhatárolása
  ("számszerű napi cél (kalória, lépés) → get_goal; életcél, életterület → get_life_goals").

### 4.5 Prompt-keretezés (nem-nudge garancia)

- A system-prompt cél-útmutatója (Bloom-minta): a [Célok] blokk háttér a személyre szabáshoz;
  célt akkor említs, ha a user üzenete relevánssá teszi; az emlékeztetőket a feed küldi.
- A reggeli üzenet promptja (user-döntés szerint): a célokra támogatóan hivatkozhat, de a
  feed-értesítés tartalmát ("ma él: …" nudge) nem ismétli el.

## 5. Hibakezelés és kapcsoló-topológia

| Helyzet | Blokk | Tool |
|---|---|---|
| `LIFEGOAL_SWITCH` ki / nincs adapter-bean | `nincs adat` | "az életcél-modul ki van kapcsolva" |
| Snapshot-config ki | `""` (splice kihagyja) | tool változatlanul él |
| Adapter `RuntimeException` | `nincs adat` (catch) | tömör hibaszöveg, nem dől el a turn |
| Nincs aktív cél | `nincs aktív életcél` | ugyanaz mondatban |

## 6. Tesztelés

- **Unit**: `LifeGoalSnapshotBlockTest` (render, cap, mindhárom degradáció);
  adapter-unit: leggyengébb-pillér deriváció (tie-break!), read-only trigger-kiértékelés
  (assert: nem emittál — az `AppNotificationEmitter` felé nincs hívás).
- **Fókuszált IT** (`-Dmezo.test.use-testcontainers=true`): `ContextSnapshotAssemblerIT`
  bővítés — [Célok] jelen + sorrend + determinizmus (két render `equals`) + reggeli
  variánsban is jelen; dedikált `...LifeGoalOffIT` a házminta szerint;
  `CompanionToolsRenderIT` a `get_life_goals`-ra `LifeGoalPopulator`-seedelt adattal
  (populátor-elérhetőség ellenőrzendő a companion teszt-csomagból);
  `CompanionToolRegistryIT` 16-os pin; `ChatServiceIT` `[Eszköz-útmutató]` sor.
- **CI self-PR** (kötelező kapu): teljes backend suite — ArchUnit ciklusmentesség itt dől el.
- **FE**: nincs érintés; kapu csak fixture-érintés esetén.
- **Egyéb kapuk**: codemap-regenerálás (`node scripts/gen-codemap.mjs`), docs-lint;
  kontrakt nem változik (nincs új endpoint).

## 7. Scope-határok

**Nincs benne**: gráf GOAL-node (mezo-iizd.11), WeekGoalsCard per-cél AI-mondat (mezo-r4ei —
a port létrejöttével a blokkolása oldódik), új REST endpoint, FE-változás, paraméterezhető tool.

## 8. Dokumentáció

- `docs/features/companion.md`: blokk-szám állítások (kilenc→tíz), új port + tool + blokk
  szekciók, key_files.
- `docs/features/lifegoal.md`: a §1/§5/§9 "deferred" jelzések feloldása, adapter a key_files-ba.
- Codemap ugyanabban a change-ben.
