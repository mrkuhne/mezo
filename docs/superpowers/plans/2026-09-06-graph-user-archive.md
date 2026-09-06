# Gráf-archiválás + életcél GOAL-node + ablakos heti cél-blokk — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A kézzel archivált tudásgráf-node tartós felhasználói szándék legyen (az éjszakai szinkron ne kapcsolja vissza), az aktív életcél jelenjen meg GOAL node-ként a gráfban, és a heti visszatekintés cél-blokkja a reviewed hetet mérje.

**Architecture:** A `knowledge_node` kap egy `user_archived_at` markert; a `status` gép-származtatott marad, ezért **egyetlen olvasási utat sem** kell módosítani. A `GraphPromotionService` négy státusz-emelő ága a markerre őrzött; a visszaállítás törli a markert és a node `source_kind`-ja szerint újrafuttatja a meglévő szinkront. Az életcél a `companion`-ban definiált új porton át jut a gráfba (a fordított import ArchUnit ciklus-hibát adna). A `LifeGoalProgressService` kap egy ablakos `summary(userId, from, to)` metódust, amire a meglévő `today` overloadok delegálnak.

**Tech Stack:** Java 21 / Spring Boot 3, JPA + Liquibase (nem Flyway), OpenAPI-fragment → generált DTO-k, JUnit 5 integration testek Testcontainers-szel, React + TypeScript frontend (egyetlen szöveg-változás).

## Global Constraints

- **Worktree:** minden parancs `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7` alól, ABSZOLÚT úttal. A Bash cwd ragad a hívások között. SOHA ne `cd`-zz az elsődleges repóba.
- **Ág:** `feat/graf-archivalas`. Driving bd id: `mezo-06o0.5`. Az S2 commitjai `mezo-iizd.11`, az S3-é `mezo-a9os`.
- **Maven wrapper a `backend/` alatt van, nem a repo gyökerében.** A `clean` és a testcontainers-flag KÖTELEZŐ, különben a fixed-DB mód versenyzik és HAMIS hibát ad:
  `cd <worktree>/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='...'`
- **Nincs mock az integration testekben** (házirend). Amit mock nélkül nem lehet provokálni, azt javadocba kell írni és bd-be tenni.
- **ArchUnit `feature_slices_are_cycle_free` FROZEN.** A `companion` NEM importálhat `lifegoal`-t. A freeze-store-hoz TILOS nyúlni; ha a ciklus-szabály bukik, ÁLLJ MEG és jelentsd, ne lazíts rajta.
- **Liquibase**, nem Flyway: `backend/src/main/resources/db/changelog/1.0.0/script/<yyyymmddHHMM>_<bd-id>_<desc>.sql`, regisztrálva az `1.0.0_master.yml`-ben; fut a `node scripts/lint-liquibase.mjs`.
- **FE teszt MINDIG kétszer, KÜLÖN parancsban, explicit móddal, `--`-ral** — az unset `VITE_USE_MOCK` csendben mock: `VITE_USE_MOCK=true pnpm test -- --run <fájl>` és `VITE_USE_MOCK=false pnpm test -- --run <fájl>`. Nincs `pnpm lint` script; a típus/holt-kód kapu a `pnpm build`.
- **A gép osztott.** Ha tömeges, a változás-felülettől független bukást látsz, ELŐSZÖR a terhelésre gyanakodj. Vitest: `--maxWorkers=2`.
- **Doksi-mandátum:** ha egy feature változik és a `docs/features/*.md` nem, a munka nincs kész.
- **Spec:** `docs/superpowers/specs/2026-09-06-graph-user-archive-design.md`. A D1–D8 döntések kötelezőek.

---

## File Structure

**Létrehozandó**

| Fájl | Felelősség |
|---|---|
| `backend/src/main/resources/db/changelog/1.0.0/script/<ts>_mezo-06o0.5_knowledge_node_user_archived.sql` | `user_archived_at` oszlop |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalGraphSource.java` | Port: az életcélok gráf-árnyékolásához szükséges minimum (`id + title + status`) |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphUserArchiveIT.java` | A `mezo-06o0.5` regressziós ITje |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionLifeGoalIT.java` | Az életcél-promóció ITje |

**Módosítandó**

| Fájl | Mit |
|---|---|
| `GraphNodeEntity.java` | `userArchivedAt` mező + `isUserArchived()` |
| `GraphNodeRepository.java` | finder a kézzel archivált node-okra |
| `GraphService.java` | `archive` beállítja a markert; új `restore` |
| `GraphPromotionService.java` | 4 guard, `resyncNode`, `SOURCE_LIFE_GOAL`, `syncLifeGoal`, `retractLifeGoal`, reconcile-ágak |
| `GraphController.java` | `restoreGraphNode`, `listArchivedGraphNodes` |
| `api/feature/knowledge-graph/knowledge-graph.yml` | két új operáció (a `status` enum NEM változik) |
| `LifeGoalCompanionAdapter.java` | a második port implementációja |
| `LifeGoalService.java` | azonnali gráf-szinkron a státusz-váltásnál |
| `LifeGoalProgressService.java` | `summary(userId, from, to)`, a `today` overloadok delegálnak |
| `WeeklyReviewContextSources.java` | ablakos `appendLifeGoals`, fejléc, javadoc |
| `NodeDetailSheet.tsx` | egy őszinte mondat |
| `docs/features/companion.md`, `docs/features/lifegoal.md`, `docs/features/proactive.md` | doksi-mandátum |

---

## Task 1: `user_archived_at` marker — adat + írás

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/<ts>_mezo-06o0.5_knowledge_node_user_archived.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (a lista VÉGÉRE)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/entity/GraphNodeEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphService.java:181-186`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphUserArchiveIT.java` (új)

**Interfaces:**
- Produces: `GraphNodeEntity.getUserArchivedAt() : OffsetDateTime`, `GraphNodeEntity.isUserArchived() : boolean`, `GraphService.archive(UUID userId, UUID nodeId) : GraphNodeEntity` (viselkedés-bővítés, szignatúra változatlan).

- [ ] **Step 1: Írd meg a bukó tesztet**

Új fájl `GraphUserArchiveIT.java`. A meglévő `GraphServiceIT` osztály-fejét másold (`@SpringBootTest`, `ResetDatabase`, user-fixture) — a pontos annotáció-készletet onnan vedd, ne találd ki.

```java
@Test
void archive_shouldStampTheUserIntentMarker() {
    GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
        "Kockahas", "Kockahas", "goal", goalId, null, Map.of());
    assertThat(node.isUserArchived()).isFalse();

    GraphNodeEntity archived = graphService.archive(userId, node.getId());

    assertThat(archived.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    assertThat(archived.getUserArchivedAt()).isNotNull();
    assertThat(archived.isUserArchived()).isTrue();
}
```

- [ ] **Step 2: Futtasd, hogy lássad a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='GraphUserArchiveIT'
```

Elvárt: fordítási hiba — `isUserArchived()` nem létezik.

- [ ] **Step 3: Liquibase script**

A fájlnév időbélyege a MOSTANI perc (`date +%Y%m%d%H%M`), ne másold be a példát vakon.

```sql
--liquibase formatted sql
--changeset mrkuhne:<ts>_mezo-06o0.5_knowledge_node_user_archived
-- mezo-06o0.5: a kézzel archiválás tartós felhasználói SZÁNDÉK, nem gép-származtatott állapot.
-- A `status` a forrás tükre marad (a promoterek írják); ez az oszlop az egyetlen hely, ahol a
-- felhasználó akarata él. Külön oszlop, nem új status-érték: a status varchar(10), a
-- ck_knowledge_node_status, az entity @Pattern, a kontraktus StatusEnum és négy hardkódolt
-- `status = 'active'` SQL-literál mind ellene szólt (spec D2).
-- Nincs backfill: a ma archivált node-ok gép-archiváltnak számítanak, mert ma nem is tudjuk
-- megkülönböztetni őket.
alter table knowledge_node add column user_archived_at timestamptz null;
```

Regisztráld az `1.0.0_master.yml` végén, a meglévő bejegyzések alakját másolva.

- [ ] **Step 4: Entity mező**

`GraphNodeEntity`-ben, a `meta` mező elé:

```java
    /** mezo-06o0.5: a kézzel archiválás időbélyege — felhasználói SZÁNDÉK, amit a promóciós
     *  szinkron soha nem ír felül (lásd GraphPromotionService státusz-guardjait). Null = a node
     *  státusza tisztán gép-származtatott. */
    @Column(name = "user_archived_at")
    private OffsetDateTime userArchivedAt;

    /** A felhasználó rejtette el ezt a node-ot — a promoterek nem emelhetik vissza aktívra. */
    public boolean isUserArchived() {
        return userArchivedAt != null;
    }
```

Import: `java.time.OffsetDateTime`.

- [ ] **Step 5: `GraphService.archive` állítsa a markert**

```java
    /** A felhasználó kézi archiválása (mezo-06o0.5): a státusz mellé a SZÁNDÉK is rögzül, és
     *  ettől kezdve a promóciós szinkron nem emelheti vissza aktívra — a rejtés csak
     *  {@link #restore} útján oldható. */
    @Transactional
    public GraphNodeEntity archive(UUID userId, UUID nodeId) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        node.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        node.setUserArchivedAt(OffsetDateTime.now());
        return nodeRepository.saveAndFlush(node);
    }
```

- [ ] **Step 6: Futtasd újra**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='GraphUserArchiveIT,GraphServiceIT,GraphApiIT'
```

Elvárt: PASS.

- [ ] **Step 7: Liquibase lint + commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/lint-liquibase.mjs
```

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java backend/src/test/java && git commit -m "feat(companion): user_archived_at marker a gráf-node-okon (mezo-06o0.5)"
```

---

## Task 2: A promoterek tiszteljék a markert

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionService.java` — `promotePattern:89-91`, `promoteFact:119-121`, `syncGoal:141-144`, `syncPerson:183-186`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphUserArchiveIT.java`

**Interfaces:**
- Consumes: `GraphNodeEntity.isUserArchived()` (Task 1).
- Produces: `GraphPromotionService.raiseStatus(GraphNodeEntity node, String target) : void` — privát segéd, a négy ág közös alakja.

- [ ] **Step 1: Írd meg a bukó teszteket**

Négy eset egy fájlban. A pattern/fact/goal/person fixture-öket a meglévő `GraphRetractionIT`-ből másold (ott mind a négy forrás felépítése megvan), ne találj ki újat.

```java
@Test
void reconcile_shouldNotResurrect_whenTheUserArchivedAPersonNode() {
    UUID personId = createActivePerson("Anna");
    GraphNodeEntity node = promotionService.syncPerson(userId, personId).orElseThrow();
    assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    graphService.archive(userId, node.getId());

    promotionService.reconcile(userId);

    GraphNodeEntity after = nodeRepository.findById(node.getId()).orElseThrow();
    assertThat(after.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    assertThat(after.isUserArchived()).isTrue();
}

@Test
void reconcile_shouldNotResurrect_whenTheUserArchivedAGoalNode() {
    UUID goalId = createActiveGoal("Fogyás");
    GraphNodeEntity node = promotionService.syncGoal(userId, goalId).orElseThrow();
    graphService.archive(userId, node.getId());

    promotionService.reconcile(userId);

    assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}

@Test
void promotePattern_shouldNotRevive_whenTheUserArchivedTheNode() {
    UUID patternId = createConfirmedPattern("Alvás és hangulat");
    GraphNodeEntity node = promotionService.promotePattern(userId, patternId).orElseThrow();
    graphService.archive(userId, node.getId());

    promotionService.promotePattern(userId, patternId);

    assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}

@Test
void promoteFact_shouldNotRevive_whenTheUserArchivedTheNode() {
    UUID factId = createPromptIncludedFact("Nem eszem laktózt");
    GraphNodeEntity node = promotionService.promoteFact(userId, factId).orElseThrow();
    graphService.archive(userId, node.getId());

    promotionService.promoteFact(userId, factId);

    assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}

/** A guard CSAK a státuszt fogja: a gráf továbbra is naprakészen árnyékolja a forrást. */
@Test
void syncPerson_shouldStillRefreshTitle_whenTheUserArchivedTheNode() {
    UUID personId = createActivePerson("Anna");
    GraphNodeEntity node = promotionService.syncPerson(userId, personId).orElseThrow();
    graphService.archive(userId, node.getId());

    renamePerson(personId, "Anna Kovács");
    promotionService.syncPerson(userId, personId);

    GraphNodeEntity after = nodeRepository.findById(node.getId()).orElseThrow();
    assertThat(after.getTitle()).isEqualTo("Anna Kovács");
    assertThat(after.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}
```

- [ ] **Step 2: Futtasd, hogy lássad a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='GraphUserArchiveIT'
```

Elvárt: mind a négy resurrect-teszt FAIL (`expected "archived" but was "active"`), a title-teszt PASS.

- [ ] **Step 3: Vezess be egy közös guardot**

`GraphPromotionService`-be, a `truncateTitle` mellé:

```java
    /**
     * A négy promoter KÖZÖS státusz-emelése, a felhasználói szándékra őrizve (mezo-06o0.5).
     *
     * <p>A promóció addig feltétel nélkül visszaírta a státuszt a forrás állapotából, így a
     * Tudástárban kézzel archivált node-ot a következő éjszakai {@link #reconcile} némán
     * visszakapcsolta — és a címe értesítés nélkül visszakerült a {@code [Összefüggések]}
     * rendszerpromptba. A kézi archiválás felhasználói SZÁNDÉK: a szinkron nem írhatja felül,
     * csak {@link GraphService#restore} oldhatja.
     *
     * <p>Az ARCHIVÁLÁS iránya szándékosan NEM őrzött: ha a forrás megszűnik kvalifikálni, a
     * node akkor is archiválódik, ha a felhasználó már elrejtette — az eredmény ugyanaz, és a
     * marker a szándékot így is megőrzi a későbbi visszaállításhoz.
     */
    private static void raiseStatus(GraphNodeEntity node, String target) {
        if (GraphNodeEntity.STATUS_ACTIVE.equals(target) && node.isUserArchived()) {
            return;
        }
        if (!target.equals(node.getStatus())) {
            node.setStatus(target);
        }
    }
```

- [ ] **Step 4: Cseréld le a négy ágat**

`promotePattern` (a `:89-91` blokk, a meglévő magyarázó kommentet HAGYD MEG felette):

```java
        raiseStatus(node, GraphNodeEntity.STATUS_ACTIVE);
```

`promoteFact` ugyanígy. `syncGoal` és `syncPerson`:

```java
        raiseStatus(node, active ? GraphNodeEntity.STATUS_ACTIVE : GraphNodeEntity.STATUS_ARCHIVED);
```

- [ ] **Step 5: Futtasd a teljes gráf-teszt-területet**

A meglévő revive-teszteknek (`GraphRetractionIT:129`, `:166`) TOVÁBBRA IS zöldnek kell lenniük — azok nem kézzel archivált node-ot élesztenek.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='Graph*IT'
```

Elvárt: PASS. Ha a `GraphRetractionIT` bukik, a guard túl széles — nézd meg, hogy tényleg csak az `active` célra fog-e.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test && git commit -m "fix(companion): a promóciós szinkron ne kapcsolja vissza a kézzel archivált node-ot (mezo-06o0.5)"
```

---

## Task 3: Visszaállítás — service, repository, kontraktus, végpont

**Files:**
- Modify: `GraphPromotionService.java` (új `resyncNode`)
- Modify: `GraphService.java` (új `restore`), `GraphNodeRepository.java` (új finder)
- Modify: `api/feature/knowledge-graph/knowledge-graph.yml`, `GraphController.java`
- Test: `GraphUserArchiveIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphApiIT.java`

**Interfaces:**
- Consumes: `raiseStatus` (Task 2), `GraphNodeEntity.isUserArchived()` (Task 1).
- Produces:
  - `GraphNodeRepository.findByCreatedByAndUserArchivedAtIsNotNullAndDeletedFalseOrderByUserArchivedAtDesc(UUID createdBy) : List<GraphNodeEntity>`
  - `GraphPromotionService.resyncNode(UUID userId, GraphNodeEntity node) : void`
  - `GraphService.restore(UUID userId, UUID nodeId) : GraphNodeEntity`
  - REST: `POST /api/companion/graph/node/{id}/restore` (`restoreGraphNode`), `GET /api/companion/graph/node/archived` (`listArchivedGraphNodes`)

**Körkörösség — figyelem:** a `GraphService` ma NEM ismeri a `GraphPromotionService`-t, a `GraphPromotionService` viszont igen a `GraphService`-t. A `restore`-nak szüksége van a promóterre → **`ObjectProvider<GraphPromotionService>`-szel** injektáld a `GraphService`-be (a promóter `@ConditionalOnProperty` mögött van, tehát az `ObjectProvider` amúgy is helyes), különben Spring körkörös-függés hibát kapsz induláskor.

- [ ] **Step 1: Írd meg a bukó teszteket**

```java
@Test
void restore_shouldReturnAnActiveNode_whenTheSourceIsStillActive() {
    UUID personId = createActivePerson("Anna");
    GraphNodeEntity node = promotionService.syncPerson(userId, personId).orElseThrow();
    graphService.archive(userId, node.getId());

    GraphNodeEntity restored = graphService.restore(userId, node.getId());

    assertThat(restored.getUserArchivedAt()).isNull();
    assertThat(restored.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
}

/** D5: a visszaállítás a FORRÁSBÓL származtat, nem vakon aktivál — különben a felhasználó
 *  „visszaállítottam, másnap eltűnt" élményt kapna a hajnali reconcile után. */
@Test
void restore_shouldStayArchived_whenTheSourceWentInactiveMeanwhile() {
    UUID personId = createActivePerson("Anna");
    GraphNodeEntity node = promotionService.syncPerson(userId, personId).orElseThrow();
    graphService.archive(userId, node.getId());
    archivePerson(personId);

    GraphNodeEntity restored = graphService.restore(userId, node.getId());

    assertThat(restored.getUserArchivedAt()).isNull();
    assertThat(restored.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}

@Test
void restore_shouldActivate_whenTheNodeHasNoSourceRow() {
    GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_INSIGHT,
        "Kézi jegyzet", "Kézi jegyzet", null, null, null, Map.of());
    graphService.archive(userId, node.getId());

    assertThat(graphService.restore(userId, node.getId()).getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
}

@Test
void listUserArchived_shouldReturnOnlyTheHandArchivedNodes() {
    UUID personId = createActivePerson("Anna");
    GraphNodeEntity byUser = promotionService.syncPerson(userId, personId).orElseThrow();
    graphService.archive(userId, byUser.getId());
    UUID otherPersonId = createActivePerson("Béla");
    GraphNodeEntity byMachine = promotionService.syncPerson(userId, otherPersonId).orElseThrow();
    archivePerson(otherPersonId);
    promotionService.syncPerson(userId, otherPersonId);

    assertThat(graphService.listUserArchived(userId))
        .extracting(GraphNodeEntity::getId)
        .containsExactly(byUser.getId());
}
```

A `GraphApiIT`-be (a `:54` archive-eset mintájára) egy HTTP-szintű eset:

```java
@Test
void restoreGraphNode_shouldReturn404_forAForeignNode() throws Exception {
    UUID foreignNodeId = createNodeForAnotherUser();
    mockMvc.perform(post("/api/companion/graph/node/" + foreignNodeId + "/restore")
            .headers(authHeaders()))
        .andExpect(status().isNotFound());
}
```

- [ ] **Step 2: Futtasd, hogy lássad a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='GraphUserArchiveIT'
```

Elvárt: fordítási hiba — `restore` / `listUserArchived` nem létezik.

- [ ] **Step 3: Repository finder**

`GraphNodeRepository`-be:

```java
    /** mezo-06o0.5: a KÉZZEL archivált node-ok — a visszaállító felület adatforrása. A
     *  gép-archivált node-ok (a forrásuk megszűnt kvalifikálni) szándékosan kimaradnak: azokat
     *  nem a felhasználó rejtette el, és nincs mit visszavonnia rajtuk. */
    List<GraphNodeEntity> findByCreatedByAndUserArchivedAtIsNotNullAndDeletedFalseOrderByUserArchivedAtDesc(
        UUID createdBy);
```

- [ ] **Step 4: `resyncNode` a promóterben**

```java
    /**
     * Egy node státuszának újraszármaztatása a forrásából (mezo-06o0.5) — a
     * {@link GraphService#restore} fogyasztója. A meglévő promóciós metódusokat futtatja,
     * nem duplikálja a kvalifikációs szabályaikat: a visszaállított node pontosan azt a
     * státuszt kapja, amit a következő éjszakai {@link #reconcile} adna neki, csak azonnal.
     *
     * <p>Forrás nélküli node (kézi/extractor eredetű) nem tartozik egyetlen promoterhez sem —
     * ott a visszaállítás maga az aktiválás.
     */
    @Transactional
    public void resyncNode(UUID userId, GraphNodeEntity node) {
        UUID sourceId = node.getSourceId();
        if (sourceId == null) {
            raiseStatus(node, GraphNodeEntity.STATUS_ACTIVE);
            return;
        }
        switch (node.getSourceKind() == null ? "" : node.getSourceKind()) {
            case SOURCE_PATTERN -> promotePattern(userId, sourceId);
            case SOURCE_FACT -> syncFact(userId, sourceId);
            case SOURCE_GOAL -> syncGoal(userId, sourceId);
            case SOURCE_PERSON -> syncPerson(userId, sourceId);
            default -> raiseStatus(node, GraphNodeEntity.STATUS_ACTIVE);
        }
    }
```

Megjegyzés: `syncFact`, nem `promoteFact` — az opt-outolt fact visszaállítása így helyesen archiválva marad.

- [ ] **Step 5: `GraphService.restore` + `listUserArchived`**

A `GraphService` mezőihez:

```java
    // ObjectProvider, nem közvetlen függés: a promóter @ConditionalOnProperty mögött van, és a
    // közvetlen injektálás kör-függést zárna (GraphPromotionService -> GraphService).
    private final ObjectProvider<GraphPromotionService> promotionService;
```

```java
    /**
     * A kézi archiválás visszavonása (mezo-06o0.5): a szándék-marker törlődik, és a státusz
     * AZONNAL a forrásból származik újra — nem vakon `active`, mert a forrás közben inaktívvá
     * válhatott, és akkor a hajnali reconcile csendben visszaarchiválná (spec D5).
     */
    @Transactional
    public GraphNodeEntity restore(UUID userId, UUID nodeId) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        node.setUserArchivedAt(null);
        GraphPromotionService promoter = promotionService.getIfAvailable();
        if (promoter == null) {
            node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        } else {
            promoter.resyncNode(userId, node);
        }
        return nodeRepository.saveAndFlush(node);
    }

    /** A kézzel archivált node-ok, legutóbb elrejtett elöl. */
    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listUserArchived(UUID userId) {
        return nodeRepository
            .findByCreatedByAndUserArchivedAtIsNotNullAndDeletedFalseOrderByUserArchivedAtDesc(userId);
    }
```

- [ ] **Step 6: Kontraktus**

`api/feature/knowledge-graph/knowledge-graph.yml`-be, az `archive` operáció UTÁN. A `GraphNodeResponse` séma és a `status` enum NEM változik.

```yaml
  /api/companion/graph/node/{id}/restore:
    post:
      tags: [KnowledgeGraph]
      operationId: restoreGraphNode
      summary: >-
        Undo a hand-archive — clears the user's intent marker and re-derives the status from the
        node's source row (KnowledgeGraph)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: Restored node — active when its source still qualifies, archived otherwise
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GraphNodeResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: GRAPH_NODE_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/graph/node/archived:
    get:
      tags: [KnowledgeGraph]
      operationId: listArchivedGraphNodes
      summary: Hand-archived nodes, most recently hidden first (KnowledgeGraph)
      responses:
        '200':
          description: Nodes the user archived by hand
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/GraphNodeResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

**Útvonal-ütközés ellenőrzése:** a `/node/archived` és a meglévő `/node/candidate` ugyanazon a szinten van (a `{id}` mindig egy alszinttel lejjebb szerepel: `/node/{id}/archive`), tehát nincs ütközés. Ha a generált kontroller mégis kétértelműséget jelez, a `candidate` mintáját kövesd.

- [ ] **Step 7: Controller**

`GraphController`-be, az `archiveGraphNode` mellé:

```java
    @Override
    public GraphNodeResponse restoreGraphNode(UUID id) {
        return graphMapper.toResponse(graphService.restore(currentUserId.get(), id));
    }

    @Override
    public List<GraphNodeResponse> listArchivedGraphNodes() {
        return graphService.listUserArchived(currentUserId.get()).stream()
            .map(graphMapper::toResponse)
            .toList();
    }
```

- [ ] **Step 8: Generáld újra a kontraktust és futtass**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/gen-openapi.mjs && node scripts/gen-api-types.mjs
```

Ha ezek a script-nevek nem léteznek, keresd meg a helyeset: `ls scripts/ | grep -i -E 'openapi|api'` — a contract-drift kaput a `.github/scripts/cheap-gates.sh` írja le, azt kövesd.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='Graph*IT'
```

Elvárt: PASS.

- [ ] **Step 9: Commit**

```bash
git add api backend frontend/src/api 2>/dev/null; git add -A && git commit -m "feat(companion): kézi archiválás visszavonása — restore végpont + archivált lista (mezo-06o0.5)"
```

---

## Task 4: S1 doksi + a hazudó FE-szöveg

**Files:**
- Modify: `docs/features/companion.md:2432-2437`, `:2461`, `:2541-2566`
- Modify: `frontend/src/features/insights/sheets/NodeDetailSheet.tsx:62-64`
- Test: `frontend/src/features/insights/sheets/NodeDetailSheet.test.tsx`

- [ ] **Step 1: Írd át a companion doksit**

A `:2541-2555` bekezdés ma SZÁNDÉKOS viselkedésként írja le a feltámasztást („hand-archiving its graph node from the Tudástár UI is not a substitute for `include_in_prompt`"). Ez a mondat a javítás után hamis. **Írd át, ne told meg.** Az új szövegnek el kell mondania:
- a kézi archiválás mostantól tartós, a `user_archived_at` marker hordozza;
- a promoterek csak a `status` FELEMELÉSÉT hagyják ki, a cím/meta frissül tovább;
- a visszaállítás a forrásból származtat újra;
- az `include_in_prompt` továbbra is a fact-oldali kill-switch — a kettő most már nem versenyzik, de nem is ugyanaz: az egyik a forrást némítja, a másik a gráf-node-ot.

A `:2461` „four promotion entries" megfogalmazást is nézd át (a Task 6 után ötre nő).

- [ ] **Step 2: Cseréld ki a FE-mondatot**

`NodeDetailSheet.tsx`, a `mz-fact-origin` bekezdés:

```tsx
          <p className="mz-fact-origin" style={{ marginTop: 8 }}>
            Archiválás után nem kerül a beszélgetésbe. Ez tartós — csak te hozhatod vissza.
          </p>
```

- [ ] **Step 3: Frissítsd a teszt-állítást, ha van rá**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && grep -rn "heti összegzésig" frontend/src
```

Ha találat van egy tesztben, igazítsd az új szöveghez.

- [ ] **Step 4: FE tesztek KÉTSZER, külön parancsban**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/insights
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/insights
```

- [ ] **Step 5: Típus-kapu**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/frontend && pnpm build
```

- [ ] **Step 6: Vizuális goldenek — ELLENŐRZÉS, ne futtatás vakon**

Előbb nézd meg, van-e egyáltalán golden erre a felületre:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && grep -rln "kategoriak\|Tudásgráf\|NodeDetail" frontend/tests/visual/ ; lsof -i :4318 -sTCP:LISTEN
```

Ha NINCS találat: nincs teendő, lépj tovább. Ha VAN: a `lsof` MUST üres legyen (egy másik worktree ottfelejtett szervere csendben hamis nulla-eltérést ad); csak utána futtasd a `pnpm test:visual:update`-et, és KIZÁRÓLAG az érintett `*-darwin.png` képeket commitold.

- [ ] **Step 7: Doksi-lint + commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/lint-docs.mjs --errors-only
```

```bash
git add -A && git commit -m "docs(companion): a kézi archiválás tartós — doksi + FE-szöveg őszintére (mezo-06o0.5)"
```

---

## Task 5: `LifeGoalGraphSource` port + lifegoal-oldali implementáció

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalGraphSource.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalCompanionAdapter.java`

**Interfaces:**
- Produces: `LifeGoalGraphSource.GraphGoal(UUID id, String title, String status)`, `LifeGoalGraphSource.all(UUID userId) : List<GraphGoal>`, `LifeGoalGraphSource.find(UUID userId, UUID goalId) : Optional<GraphGoal>`

**Miért port és nem közvetlen olvasás:** az ArchUnit `feature_slices_are_cycle_free` FROZEN, és a `lifegoal` már importálja a `companion`-t (`MetricSignalSource`, `LifeGoalSource`). Egy `companion` → `lifegoal` import 2-szeletes ciklust zárna és bukna a build. A freeze-store-hoz TILOS nyúlni.

- [ ] **Step 1: Írd meg a portot**

```java
package io.mrkuhne.mezo.feature.companion;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port az életcélok gráf-árnyékolásához (mezo-iizd.11) — a {@link LifeGoalSource} testvére,
 * ugyanazzal az irány-szabállyal: a lifegoal implementálja
 * ({@code lifegoal/service/LifeGoalCompanionAdapter}), a companion csak fogyasztja. A fordított
 * import 2-szeletes ciklust zárna (a lifegoal már függ a companiontól), amit az ArchUnit
 * {@code feature_slices_are_cycle_free} tilt.
 *
 * <p>Szándékosan MINIMÁLIS: a {@code GraphPromotionService} csak azt kapja meg, amiből egy GOAL
 * node felépül — azonosító, cím, státusz. A pillérek, tervek és a haladás a {@link LifeGoalSource}
 * dolga, az a prompt-blokké; a gráf ennél kevesebbet tud, és kevesebbet is kell tudnia.
 *
 * <p>MINDEN életcélt ad vissza, nem csak az aktívakat: a promóter maga dönti el, hogy a nem
 * aktív cél node-ját archiválja ({@code syncLifeGoal}), és a komplementer-söprésnek is látnia
 * kell a parkolt/lezárt célokat. A bean csak {@code LIFEGOAL_SWITCH} mellett létezik —
 * {@code ObjectProvider}-rel fogyaszd; hiányzó bean = nincs életcél-node, sosem kitalált cél.
 */
public interface LifeGoalGraphSource {

    /** {@code status} NYERS kulcsként (active|parked|closed|draft) — a promóter csak az
     *  „aktív-e" kérdést teszi fel rá, a magyar szót senki nem innen veszi. */
    record GraphGoal(UUID id, String title, String status) {}

    List<GraphGoal> all(UUID userId);

    Optional<GraphGoal> find(UUID userId, UUID goalId);
}
```

- [ ] **Step 2: Implementáld a meglévő adapterben**

`LifeGoalCompanionAdapter` — a class-deklarációt bővítsd, ne írj új osztályt (a két port ugyanannak a szeletnek a kifelé néző felülete, és a bean-feltétel is ugyanaz):

```java
public class LifeGoalCompanionAdapter implements LifeGoalSource, LifeGoalGraphSource {
```

A metódusok:

```java
    @Override
    @Transactional(readOnly = true)
    public List<GraphGoal> all(UUID userId) {
        return goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId).stream()
            .map(LifeGoalCompanionAdapter::toGraphGoal)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<GraphGoal> find(UUID userId, UUID goalId) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId)
            .map(LifeGoalCompanionAdapter::toGraphGoal);
    }

    private static GraphGoal toGraphGoal(LifeGoalEntity goal) {
        return new GraphGoal(goal.getId(), goal.getTitle(), goal.getStatus());
    }
```

Ellenőrizd, hogy a `LifeGoalRepository` tényleg így hívja a findereket:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && grep -n "find" backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/repository/LifeGoalRepository.java
```

Ha nincs `findByIdAndCreatedByAndDeletedFalse`, vedd fel — a repo-ban ez a bevett alak.

- [ ] **Step 3: Fordítás + ArchUnit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='*Arch*Test'
```

Elvárt: PASS. **Ha a ciklus-szabály bukik, ÁLLJ MEG és jelentsd** — ne lazíts a szabályon, ne nyúlj a freeze-store-hoz.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main && git commit -m "feat(lifegoal): LifeGoalGraphSource port az életcélok gráf-árnyékolásához (mezo-iizd.11)"
```

---

## Task 6: `life_goal` forrású GOAL node

**Files:**
- Modify: `GraphPromotionService.java` (konstans, `syncLifeGoal`, `retractLifeGoal`, reconcile két helyen, `resyncNode` egy ág)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalService.java:91-110` (`changeStatus`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionLifeGoalIT.java` (új)

**Interfaces:**
- Consumes: `LifeGoalGraphSource.all/find/GraphGoal` (Task 5), `raiseStatus` (Task 2), `resyncNode` (Task 3).
- Produces: `GraphPromotionService.SOURCE_LIFE_GOAL = "life_goal"`, `syncLifeGoal(UUID userId, UUID goalId) : Optional<GraphNodeEntity>`, `retractLifeGoal(UUID userId, UUID goalId) : Optional<GraphNodeEntity>`

**Nincs migráció:** a `source_kind` bare `varchar(20)`, nincs rajta CHECK constraint, a `"life_goal"` 9 karakter. Az `uq_knowledge_node_source` a `(created_by, source_kind, source_id)` hármason ül, tehát a `SOURCE_GOAL` (**súlycél**) és a `SOURCE_LIFE_GOAL` sosem ütközik.

- [ ] **Step 1: Írd meg a bukó teszteket**

Új `GraphPromotionLifeGoalIT.java`. Az osztály-fejet a `GraphPromotionServiceIT`-ből másold.

```java
@Test
void syncLifeGoal_shouldPromoteAnActiveGoal() {
    UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);

    GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();

    assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_GOAL);
    assertThat(node.getSourceKind()).isEqualTo(GraphPromotionService.SOURCE_LIFE_GOAL);
    assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    assertThat(node.getTitle()).isEqualTo("Kockahas");
}

/** A parkolt cél node-ja archiválódik — a syncGoal mintája. A .11 bd-leírása ezt tévesen
 *  „minden éjjel visszakapcsolna"-ként írta le (spec D8). */
@Test
void syncLifeGoal_shouldArchiveTheNode_whenTheGoalIsParked() {
    UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
    promotionService.syncLifeGoal(userId, goalId);
    setLifeGoalStatus(goalId, "parked");

    assertThat(promotionService.syncLifeGoal(userId, goalId).orElseThrow().getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}

@Test
void syncLifeGoal_shouldBeANoop_whenAGoalWasNeverActive() {
    UUID goalId = createLifeGoal("Ötlet", "draft");

    assertThat(promotionService.syncLifeGoal(userId, goalId)).isEmpty();
}

@Test
void syncLifeGoal_shouldReviveTheNode_whenAParkedGoalIsReactivated() {
    UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
    GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();
    setLifeGoalStatus(goalId, "parked");
    promotionService.syncLifeGoal(userId, goalId);
    setLifeGoalStatus(goalId, LifeGoalEntity.STATUS_ACTIVE);

    promotionService.syncLifeGoal(userId, goalId);

    assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
}

/** Az S1 guardja az életcél-node-ra is áll. */
@Test
void reconcile_shouldNotResurrect_whenTheUserArchivedALifeGoalNode() {
    UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
    GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();
    graphService.archive(userId, node.getId());

    promotionService.reconcile(userId);

    assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}

@Test
void reconcile_shouldPromoteEveryActiveLifeGoal() {
    createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
    createLifeGoal("Side hustle", LifeGoalEntity.STATUS_ACTIVE);

    promotionService.reconcile(userId);

    assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            userId, GraphNodeEntity.STATUS_ACTIVE))
        .filteredOn(n -> GraphPromotionService.SOURCE_LIFE_GOAL.equals(n.getSourceKind()))
        .hasSize(2);
}

/** A komplementer-söprés ága: egy törölt életcél node-ja nem maradhat aktív. */
@Test
void reconcile_shouldArchiveTheNode_whenTheLifeGoalWasDeleted() {
    UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
    GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();
    deleteLifeGoal(goalId);

    promotionService.reconcile(userId);

    assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
        .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}
```

- [ ] **Step 2: Futtasd, hogy lássad a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='GraphPromotionLifeGoalIT'
```

Elvárt: fordítási hiba — `SOURCE_LIFE_GOAL` / `syncLifeGoal` nem létezik.

- [ ] **Step 3: Konstans + függés**

A `SOURCE_PERSON` alá:

```java
    /** Életcél-rendszer (mezo-iizd.11). KÜLÖN a {@link #SOURCE_GOAL}-tól: az a SÚLYCÉL
     *  ({@code feature/goal}), ez a PERMAH-életcél ({@code feature/lifegoal}). A
     *  {@code uq_knowledge_node_source} a (created_by, source_kind, source_id) hármason ül, így a
     *  kettő sosem ütközik — de minden {@code findBySource} hívási helynek meg kell
     *  különböztetnie őket. */
    public static final String SOURCE_LIFE_GOAL = "life_goal";
```

A mezőkhöz:

```java
    // ObjectProvider: az életcél-rendszer külön switch mögött van (LIFEGOAL_SWITCH), a gráf
    // futhat nélküle. Hiányzó bean = nincs életcél-node, sosem kitalált cél.
    private final ObjectProvider<LifeGoalGraphSource> lifeGoalGraphSource;
```

- [ ] **Step 4: `syncLifeGoal` + `retractLifeGoal`**

```java
    /**
     * Aktív életcél -> GOAL node (mezo-iizd.11, spec §7) — a {@link #syncGoal} alakja, azzal a
     * különbséggel, hogy a forrás egy PORTON át érkezik ({@link LifeGoalGraphSource}), mert a
     * companion nem importálhatja a lifegoal szeletet (ArchUnit ciklus-szabály).
     *
     * <p>Aktív ⇒ {@code active}, minden más állapot (parkolt, lezárt, draft) ⇒ {@code archived}:
     * a gráf árnyékol, sosem felejt. Egy soha nem promótált, nem aktív cél no-op — a parkolás a
     * felhasználó eszköze, egy sosem élt cél nem kerül be csak azért, hogy rögtön archiváljuk.
     */
    @Transactional
    public Optional<GraphNodeEntity> syncLifeGoal(UUID userId, UUID goalId) {
        LifeGoalGraphSource source = lifeGoalGraphSource.getIfAvailable();
        if (source == null) {
            return Optional.empty();
        }
        Optional<LifeGoalGraphSource.GraphGoal> found = source.find(userId, goalId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        LifeGoalGraphSource.GraphGoal goal = found.get();
        boolean active = "active".equals(goal.status());
        if (!active && graphService.findBySource(userId, SOURCE_LIFE_GOAL, goalId).isEmpty()) {
            return Optional.empty();   // sosem volt node — nincs mit árnyékolni
        }
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
            truncateTitle(goal.title()), goal.title(), SOURCE_LIFE_GOAL, goal.id(), null,
            Map.of("status", goal.status()));
        raiseStatus(node, active ? GraphNodeEntity.STATUS_ACTIVE : GraphNodeEntity.STATUS_ARCHIVED);
        return Optional.of(node);
    }

    /** A {@link #syncLifeGoal} tükre a komplementer-söpréshez: egy törölt (vagy a port számára
     *  eltűnt) életcél node-ja nem maradhat aktív. A nem-aktív, de LÉTEZŐ célt a syncLifeGoal
     *  maga archiválja — ide csak az kerül, amit a forrás már nem is ismer. */
    @Transactional
    public Optional<GraphNodeEntity> retractLifeGoal(UUID userId, UUID goalId) {
        LifeGoalGraphSource source = lifeGoalGraphSource.getIfAvailable();
        boolean stillQualifies = source != null
            && source.find(userId, goalId).filter(g -> "active".equals(g.status())).isPresent();
        return stillQualifies ? Optional.empty() : archiveBySource(userId, SOURCE_LIFE_GOAL, goalId);
    }
```

- [ ] **Step 5: Kösd be a `reconcile`-be — MINDKÉT helyen**

A negyedik promóciós hurok (person) UTÁN:

```java
        LifeGoalGraphSource goalSource = lifeGoalGraphSource.getIfAvailable();
        if (goalSource != null) {
            for (LifeGoalGraphSource.GraphGoal goal : goalSource.all(userId)) {
                try {
                    count += proxy.syncLifeGoal(userId, goal.id()).isPresent() ? 1 : 0;
                } catch (Exception e) {
                    skipped++;
                    log.warn("Reconcile: life goal {} sync failed for user {}", goal.id(), userId, e);
                }
            }
        }
```

És a komplementer-söprés `switch`-ébe, a `default` ELÉ:

```java
                    case SOURCE_LIFE_GOAL -> proxy.retractLifeGoal(userId, sourceId).isPresent();
```

**Ez a lépés nem hagyható ki**: a `default -> false` miatt egy hiányzó ág örökre aktívan hagyná az életcél-node-okat.

- [ ] **Step 6: `resyncNode` ága**

A Task 3-ban írt `switch`-be, a `SOURCE_PERSON` alá:

```java
            case SOURCE_LIFE_GOAL -> syncLifeGoal(userId, sourceId);
```

- [ ] **Step 7: Azonnali szinkron a lifegoal írási útjáról**

`LifeGoalService.changeStatus` végére (az irány lifegoal → companion, tehát legális). A promótert `ObjectProvider<GraphPromotionService>`-szel injektáld — a gráf külön switch mögött van.

```java
        // mezo-iizd.11: egy frissen aktivált (vagy parkolt) cél ne csak a hajnali reconcile után
        // jelenjen meg/tűnjön el a gráfban. Az irány lifegoal -> companion, mint a MetricSignalSource-nál.
        graphPromotionService.ifAvailable(promoter -> promoter.syncLifeGoal(userId, id));
```

- [ ] **Step 8: Futtass**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='GraphPromotionLifeGoalIT,Graph*IT,LifeGoal*IT'
```

Elvárt: PASS.

- [ ] **Step 9: ArchUnit külön**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='*Arch*Test'
```

Elvárt: PASS. Bukás esetén ÁLLJ MEG.

- [ ] **Step 10: Commit**

```bash
git add backend && git commit -m "feat(companion): aktív életcél mint life_goal forrású GOAL node (mezo-iizd.11)"
```

---

## Task 7: S2 doksi + a `.11` bd-leírás javítása

**Files:**
- Modify: `docs/features/lifegoal.md:90`, `:673-674`, `:959`
- Modify: `docs/features/companion.md` (promóciós szakasz, `:2456` körül)

- [ ] **Step 1: Írd át a lifegoal doksit**

Mindhárom hely azt mondja, a gráf GOAL node „még halasztva, mezo-06o0.5 blokkolja". **Együtt kell frissíteni** őket: a node megvan, `source_kind = life_goal`, a nem aktív cél node-ja archiválódik, a kézi archiválás tartós.

- [ ] **Step 2: Írd át a companion promóciós szakaszát**

Ötödik promóciós bejegyzés (`life_goal`), a port-idióma említésével és azzal, hogy MIÉRT port (ArchUnit ciklus-szabály).

- [ ] **Step 3: Javítsd a bd-leírást (spec D8)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && bd update mezo-iizd.11 --description "$(cat <<'EOF'
Spec 2026-09-02-lifegoal-system-design.md §7: aktív életcél -> GOAL node a tudásgráfban,
source_kind = life_goal (KÜLÖN a SOURCE_GOAL-tól, az a súlycél).

JAVÍTVA (mezo-06o0.5 köre, 2026-09-06): a korábbi leírás túllőtt. Azt állította, hogy "a
parkolt és lezárt célok minden éjjel visszakapcsolnának". A syncGoal meglévő mintája viszont
aktív => active, egyéb => archived, soha-nem-promotált+nem-aktív => no-op, tehát egy ugyanígy
megírt life-goal sync a parkolt célt helyesen archiválja. A valódi (és szűkebb) blokkoló csak a
KÉZZEL archivált node visszakapcsolása volt.
EOF
)"
```

- [ ] **Step 4: Doksi-lint + commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/lint-docs.mjs --errors-only
```

```bash
git add -A && git commit -m "docs(lifegoal): az életcél GOAL node megvan — doksi + bd-leírás javítás (mezo-iizd.11)"
```

---

## Task 8: Ablakos `LifeGoalProgressService.summary`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java:134-148`, `:174-195`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalTodayApiIT.java` (vagy a szomszédos progress-IT — a fájlnevet a futtatás előtt ellenőrizd)

**Interfaces:**
- Produces: `LifeGoalProgressService.summary(UUID userId, LocalDate from, LocalDate to) : LifeGoalTodayResponse`
- A `today(UUID)` és `today(UUID, LocalDate)` **megmarad** és erre delegál — a `LifeGoalCompanionAdapter:59` és a `LifeGoalController:47-49` NEM változik.

- [ ] **Step 1: Írd meg a bukó tesztet**

```java
/** mezo-a9os: a lezárt hét ablaka — a mai nap NEM számít bele. */
@Test
void summary_shouldMeasureTheGivenWindow_notTheTrailingSevenDays() {
    LocalDate today = LocalDate.now();
    LocalDate weekStart = today.minusDays(7);
    LocalDate weekEnd = today.minusDays(1);
    UUID goalId = createActiveGoalWithHitOn(weekStart);   // a reviewed hét ELSŐ napja

    LifeGoalTodaySummary summary = progressService.summary(userId, weekStart, weekEnd)
        .getGoals().get(0);

    assertThat(summary.getDays7()).hasSize(7);
    assertThat(summary.getDays7().get(0)).isEqualTo(PillarDayStatus.HIT);
}

/** A meglévő today() viselkedése nem változhat: [ma-6, ma]. */
@Test
void today_shouldStillMeasureTheTrailingSevenDays() {
    LocalDate today = LocalDate.now();
    UUID goalId = createActiveGoalWithHitOn(today.minusDays(7));   // az ablakon KÍVÜL

    LifeGoalTodaySummary summary = progressService.today(userId, today).getGoals().get(0);

    assertThat(summary.getDays7()).hasSize(7);
    assertThat(summary.getDays7()).doesNotContain(PillarDayStatus.HIT);
}

@Test
void summary_shouldRejectAWindowThatIsNotSevenDays() {
    LocalDate today = LocalDate.now();

    assertThatThrownBy(() -> progressService.summary(userId, today.minusDays(2), today))
        .isInstanceOf(SystemRuntimeErrorException.class);
}
```

- [ ] **Step 2: Futtasd, hogy lássad a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoal*IT'
```

Elvárt: fordítási hiba — `summary` nem létezik.

- [ ] **Step 3: Írd meg a `summary`-t, és delegáltasd rá a `today`-t**

```java
    /** Aktív célonként: nyíl + 7 napi cél-pont-pötty + pillér-számláló. Az ablak a MAI napig tart. */
    @Transactional(readOnly = true)
    public LifeGoalTodayResponse today(UUID userId) {
        return today(userId, LocalDate.now());
    }

    /** Dátum-paraméteres változat (mezo-iizd.10): a companion-snapshot determinizmusa miatt a
     *  hívó mondja meg, mi a „ma" — a HTTP-út a fenti overloadon át változatlan. */
    @Transactional(readOnly = true)
    public LifeGoalTodayResponse today(UUID userId, LocalDate today) {
        return summary(userId, today.minusDays(RECENT_WINDOW_DAYS - 1), today);
    }

    /**
     * A {@link #today} ablakos általánosítása (mezo-a9os): a 7 napos ablakot a HÍVÓ adja meg,
     * nem a mai nap rögzíti.
     *
     * <p>A heti visszatekintés a {@code [D-7, D-1]} hetet nézi, a {@code today()} viszont a
     * {@code [most-6, most]} ablakot — a kettő egy nappal el van tolva, így a reviewed hétfő
     * kiesett, a mai (~7 órás) hétfő pedig bekerült. A blokk ezt eddig CÍMKÉZÉSSEL kezelte
     * („AZ ELMÚLT 7 NAP"); innentől valóban a lezárt hetet méri.
     *
     * <p>A {@code pillarsHitToday} az ablak UTOLSÓ napjára értendő — egy lezárt héten ez a hét
     * utolsó napja, nem a mai. A heti prompt-blokk amúgy sem rendereli.
     *
     * <p>Az ablak KÖTELEZŐEN 7 napos: a válasz {@code days7} mezője hét elemet ígér, és egy
     * más hosszúságú ablak csendben hazudna a fogyasztóinak.
     */
    @Transactional(readOnly = true)
    public LifeGoalTodayResponse summary(UUID userId, LocalDate from, LocalDate to) {
        if (ChronoUnit.DAYS.between(from, to) != RECENT_WINDOW_DAYS - 1) {
            throw new SystemRuntimeErrorException(HttpStatus.BAD_REQUEST,
                SystemMessage.of("LIFE_GOAL_WINDOW_INVALID"));
        }
        List<LifeGoalEntity> activeGoals = goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().filter(g -> LifeGoalEntity.STATUS_ACTIVE.equals(g.getStatus())).toList();
        List<LifeGoalTodaySummary> summaries = activeGoals.stream()
            .map(goal -> buildTodaySummary(userId, goal, from, to)).toList();
        return LifeGoalTodayResponse.builder().goals(summaries).build();
    }
```

**A `SystemRuntimeErrorException` pontos konstruktorát és a `SystemMessage` gyártó-metódusát a `LifeGoalProgressService.progress` `from > to` ágából másold** (`:74` környéke) — az a repo bevett alakja, ne találj ki újat.

- [ ] **Step 4: Írd át a `buildTodaySummary`-t ablakosra**

A jelenlegi szignatúra `(userId, goal, from, today)`, ahol a `from` a 28 napos SZÁMÍTÁSI ablak kezdete, a `days7` pedig a `today`-ból származik. Ezt kell szétválasztani:

```java
    private LifeGoalTodaySummary buildTodaySummary(UUID userId, LifeGoalEntity goal,
            LocalDate windowStart, LocalDate windowEnd) {
        LocalDate computeFrom = windowEnd.minusDays(PROGRESS_WINDOW_DAYS - 1);
        List<LifeGoalPillarEntity> activePillars = activePillars(goal.getId());
        GoalComputation computation = compute(userId, activePillars, computeFrom, windowEnd);
        String arrow = LifeGoalScorer.arrow(computation.goalPoints(), windowEnd);
        List<PillarDayStatus> days7 = new ArrayList<>();
        for (LocalDate day = windowStart; !day.isAfter(windowEnd); day = day.plusDays(1)) {
            days7.add(dotStatus(computation.goalPoints().get(day)));
        }
        int pillarsHit = (int) activePillars.stream()
            .filter(p -> {
                PillarDayScore score = computation.byPillar().get(p.getId()).get(windowEnd);
                return score != null && "hit".equals(score.status());
            }).count();
        return LifeGoalTodaySummary.builder()
            .goalId(goal.getId()).title(goal.getTitle())
            .dimension(LifeGoalDimension.fromValue(goal.getDimension()))
            .arrow(TrendArrow.fromValue(arrow))
            .days7(days7)
            .pillarsTotal(activePillars.size())
            .pillarsHitToday(pillarsHit)
            .build();
    }
```

Import: `java.time.temporal.ChronoUnit`.

- [ ] **Step 5: Futtass**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoal*IT,SignalSourceIT'
```

Elvárt: PASS — a `LifeGoalCompanionAdapterIT`-nek is zöldnek kell lennie, mert a `today(userId, today)` viselkedése változatlan.

- [ ] **Step 6: Commit**

```bash
git add backend && git commit -m "feat(lifegoal): ablakos summary(userId, from, to) a today mellé (mezo-a9os)"
```

---

## Task 9: A heti cél-blokk a reviewed hetet mérje

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewContextSources.java:171`, `:320-382`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklyReviewContextSourcesIT.java:30-39`, `:76-88`, `:95-104`
- Modify: `docs/features/proactive.md`, `docs/features/lifegoal.md`

**Interfaces:**
- Consumes: `LifeGoalProgressService.summary(UUID, LocalDate, LocalDate)` (Task 8).

- [ ] **Step 1: Fordítsd meg a meglévő állítást**

`WeeklyReviewContextSourcesIT:95-104` ma azt állítja, hogy a fejléc NEM mondja a hetet. Cseréld le:

```java
@Test
void the_header_claims_the_reviewed_week() {
    String rendered = renderReviewedWeek();

    assertThat(rendered).contains("ÉLETCÉLOK · A HÉT IRÁNYA");
    assertThat(rendered).doesNotContain("AZ ELMÚLT 7 NAP");
}

/** mezo-a9os: a mai nap adata a reviewed héten KÍVÜL van, nem számíthat bele. */
@Test
void todays_data_does_not_count_towards_the_reviewed_week() {
    seedGoalHitOn(LocalDate.now());

    assertThat(renderReviewedWeek()).contains(NO_DATA_PHRASE_TEXT);
}
```

A `:76-88` „1 találat-nap a 7-ből" esethez a fixture találat-napját a **reviewed** héten belülre tedd (a `renderReviewedWeek` helper `[today-7, today-1]`-et rendereli).

Az osztály-javadoc `:30-39` és a `WeeklyReviewContextSources:326-339` javadoc is a HALASZTÁST kódolja — **írd át mindkettőt, ne told meg**: a blokk innentől a reviewed hetet méri, a címke ezért tér vissza a „hét iránya" alakra.

- [ ] **Step 2: Futtasd, hogy lássad a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='WeeklyReviewContextSourcesIT'
```

Elvárt: FAIL — a fejléc még `AZ ELMÚLT 7 NAP`.

- [ ] **Step 3: Add át az ablakot**

`render:171`:

```java
        appendLifeGoals(out, userId, weekStart, weekEnd);
```

`appendLifeGoals` szignatúrája és a két érintett sor:

```java
    private void appendLifeGoals(StringBuilder out, UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        LifeGoalProgressService progress = lifeGoalProgressService.getIfAvailable();
        if (progress == null) {
            return; // life goals switched off — nothing is known, so nothing is said
        }
        List<LifeGoalTodaySummary> goals = progress.summary(userId, weekStart, weekEnd).getGoals();
        if (goals == null || goals.isEmpty()) {
            return;
        }
        out.append("\nÉLETCÉLOK · A HÉT IRÁNYA (a motor számolta — magyarázd, ne számold újra):\n");
```

A ciklus törzse VÁLTOZATLAN — a `days7` most a reviewed hetet írja le, a „találat-nap a 7-ből" számlálás alakja ugyanaz.

- [ ] **Step 4: Futtass**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='WeeklyReview*IT,LifeGoal*IT'
```

Elvárt: PASS.

- [ ] **Step 5: Doksi**

`docs/features/proactive.md` heti-visszatekintés szakasza és `docs/features/lifegoal.md`: a blokk mostantól a **reviewed** hetet méri, a fejléc `A HÉT IRÁNYA`. Ha valamelyik doksi az egy napos eltolódást „vállalt korlát"-ként írja le, azt is át kell írni.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/lint-docs.mjs --errors-only
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "fix(proactive): a heti cél-blokk a reviewed hetet mérje (mezo-a9os)"
```

---

## Task 10: Teljes kapu + PR

- [ ] **Step 1: Codemap + doksi-lint**

Új source-fájlok és ITek kerültek be, tehát a CODEMAP majdnem biztosan elavult.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/gen-codemap.mjs --check || node scripts/gen-codemap.mjs
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs
```

- [ ] **Step 2: A változás-felület fókuszált backend-suite-ja**

A teljes backend-suite CI-ban fut (a gép nem bírja). Itt a felület:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='Graph*IT,LifeGoal*IT,WeeklyReview*IT,*Arch*Test'
```

- [ ] **Step 3: Frontend kapuk**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/frontend && VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/insights
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/insights
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7/frontend && pnpm build
```

- [ ] **Step 4: Beads-backup frissítés**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && node scripts/check-beads-backup.mjs --fix
```

Ha módosult, commitold.

- [ ] **Step 5: Push + self-PR**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && git push -u origin feat/graf-archivalas
```

PR-t a `gh pr create`-tel nyiss; a leírás a spec 0. szakaszából és a commit-térképből álljon.

- [ ] **Step 6: CI zöld + premerge a FRISS main ellen**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && gh workflow run premerge.yml -f pr=<number>
```

A PR saját zöld pipája ELŐZHETI a bázist, amibe ténylegesen merge-ölődik. „No checks reported" = konfliktus → merge-eld be a `main`-t az ágba és pushold.

- [ ] **Step 7: Merge + zárás**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && git checkout main && git pull --rebase && git merge --no-ff feat/graf-archivalas && git push
```

`git pull --rebase` a merge ELŐTT — utána a rebase ellapítaná a `--no-ff` merge-commitot.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && bd close mezo-06o0.5 mezo-iizd.11 mezo-a9os
```

- [ ] **Step 8: Nyisd meg a B kör FE-issue-ját (spec D6)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/daily-rating-card-display-5e69a7 && bd create "Tudástár: Archivált szekció + Visszaállítás gomb" --type feature -p 3 --description "A mezo-06o0.5 köre backend-oldalon már szállította a GET /api/companion/graph/node/archived listát és a POST /node/{id}/restore végpontot, de FE felület nincs hozzá: a kézzel archivált node ma nem érhető el a Tudástárból, tehát a rejtés a felhasználó számára visszavonhatatlan. Kell egy 'Archivált' szekció a Tudástár kategóriák nézetében (Design 2.0, clay SVG ikon, három őszinte állapot: betöltés / üres / hiba) és egy Visszaállítás művelet. Spec: docs/superpowers/specs/2026-09-06-graph-user-archive-design.md D6."
```

---

## Önellenőrzés (a terv írója futtatta)

- **Spec-lefedettség:** D1 → Task 2 (guard); D2 → Task 1 (oszlop); D3/D4 → elvetve, nincs task; D5 → Task 3 (`resyncNode`); D6 → Task 10 Step 8 (B kör issue); D7 → Task 5 (port) + Task 6 Step 9 (ArchUnit kapu); D8 → Task 7 Step 3. Spec §4 → Task 1–4; §5 → Task 5–7; §6 → Task 8–9; §7 (kimaradó) → Task 10 Step 8.
- **Típus-konzisztencia:** `raiseStatus(GraphNodeEntity, String)` a Task 2-ben születik, a Task 3 (`resyncNode`) és a Task 6 (`syncLifeGoal`) használja — ugyanaz a név és szignatúra. `LifeGoalGraphSource.GraphGoal(id, title, status)` a Task 5-ben, fogyasztva a Task 6-ban ugyanazokkal az accessor-nevekkel. `summary(userId, from, to)` a Task 8-ban, hívva a Task 9-ben.
- **Ismert bizonytalanság, amit a végrehajtónak ellenőriznie kell** (nem placeholder, hanem tudatosan a végrehajtóra bízott lépés): a kontraktus-generátor script pontos neve (Task 3 Step 8), a `LifeGoalRepository` finder-nevei (Task 5 Step 2), a `SystemRuntimeErrorException` konstruktor-alakja (Task 8 Step 3) és a `LifeGoalService.changeStatus` `id`-paraméterének neve (Task 6 Step 7). Mindegyikhez ott a konkrét parancs vagy a másolandó hely.
