# Memória-obszervatórium — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Új „Memória" Insights-tab (`/insights/memoria`) négy nézettel — Áttekintés (L0→L3 réteg-folyam) · Napló (L1 böngésző) · Kereső (pgvector hasonló-nap) · Audit (tény-provenancia + LLM-használat) — 4 új read-only `/api/companion/memory/*` végponttal.

**Architecture:** A backend egy új, csak-olvasó `MemoryObservatoryService`-t kap a companion szeletben: az L0 a `PatternMonitorService` sorozat-cache idiómáját másolja (metrikánként egy `series()`-hívás, kulcs-unió), a kereső a V2.3 `MemoryRecallService`-t hasznosítja újra változatlanul, az LLM-rollup a meglévő `LlmUsageService`-re kerül. A FE egy `MemoryPage` leaf lokális szegmens-váltóval (`useStickyTab`), nézetenként egy `*Panel` komponenssel és kézzel írt `useDualQuery`-hookokkal.

**Tech Stack:** Java 21 · Spring Boot 4 · MapStruct/Lombok · OpenAPI contract-first (`api/feature/companion/companion.yml`) · React 19 + TanStack Query + Vitest/MSW.

**Spec:** [`docs/superpowers/specs/2026-08-11-memory-observatory-design.md`](../specs/2026-08-11-memory-observatory-design.md) · **UI-spec (mockup-validált):** [`2026-08-14-memory-observatory-ui-design.md`](../specs/2026-08-14-memory-observatory-ui-design.md) + [`2026-08-14-memory-observatory-ui-mockup.html`](../specs/2026-08-14-memory-observatory-ui-mockup.html) · **bd:** `mezo-al1i`

> **A vizuális részletek forrása a UI-spec** (réteg-érés színskála: L0 semleges → L1 lav → L2 warning/amber → L3 success/sage; wash-hátterek `color-mix`-szel). A Task 3/5/7 komponens-kódja már ehhez igazítva.

**Felderítési korrekciók a spec-hez képest (as-built döntések):**
- **`KnowledgeFactResponse.lastReinforcedAt` MÁR LÉTEZIK** (kontraktus `companion.yml:493`, entitás `KnowledgeFactEntity.java:64-65`, mapper `CompanionMapper.java:92`) — a spec §4 „Plusz" pontja backend-oldalon no-op, csak a FE `toKnowledgeFact` mapper nem olvassa. A ③ szelet így FE-only.
- A spec „8. chip"-et mond, de a Motor tab (`mezo-viqs`, a spec után született) már a 8.; a Memória a **9. chip** lesz.
- Kikapcsolt llm-log kapcsolónál a végpont a spec szerint `enabled:false` + **üres sorok** — a rollup-query le sem fut (a történelmi sorok SQL-lel továbbra is elérhetők, ADR 0014).
- A `k` paramétert a `MemoryRecallService` `[1, recall.max-k=5]`-re vágja — a kontraktus `maximum: 5`-tel őszintén ezt mondja ki.

## Global Constraints

- **Nincs új DB-tábla, nincs Liquibase-migráció, nincs írás** — minden végpont read-only; a `ResetDatabase` TRUNCATE-listája nem változik.
- **Contract-first:** minden boundary-DTO a generált `io.mrkuhne.mezo.api.dto` / `api.gen.ts` típusokból jön; kézzel írt boundary-DTO tilos. A fragment (`api/feature/companion/companion.yml`) már szerepel a `merge.yml`-ben — új fragment nem kell.
- **A generált `CompanionApi` interfész absztrakt** (`skipDefaultInterface: true`) — amint a YAML-be kerül egy végpont, a `CompanionController`-nek implementálnia KELL, különben nem fordul. Ezért kontraktus + controller mindig **egy taskban** van.
- **Backend build mindig `clean`-nel:** `./mvnw clean test` (a Lombok+MapStruct inkrementális fordítás megbízhatatlan).
- **Minden új companion bean** `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` — enélkül switch-off módban a controller nem tud felállni.
- **DI konstruktoron át** (`@RequiredArgsConstructor`), soha nem mezőn; `@Transactional` csak metóduson.
- **Teszt-elnevezés:** `test{Method}_should{Result}_when{Condition}`, kizárólag AssertJ; IT-k az `ApiIntegrationTest` / `AbstractIntegrationTest` bázison, adat a `*Populator` gyárakból.
- **FE import:** mély + abszolút `@/*` alias, relatív `../` tilos, barrel csak `@/data/hooks`.
- **FE dual-mode:** minden olvasó hook `useDualQuery` (vagy a lusta esetben a `useFeasibilityPreview`-mintájú raw `useQuery`); a mock seed SOHA nem real-módú fallback.
- **A UI nyelve magyar**, a meglévő token-készlettel (`card`/`chip`/`eyebrow`/`bar`/`bar-fill`/`memoir-card`, `var(--lav-deep)`, `var(--wash-lav)`, `var(--success)`, `var(--surface-glass)`, `var(--text-primary|secondary|tertiary)`, `var(--ff-display)`, `var(--ff-mono)`, adatvizhez `var(--dv-*)`) — **új CSS-token bevezetése tilos** (új keyframe szabad).
- **A Task 7 token-grafikonjának implementálása ELŐTT a végrehajtó hívja meg a `dataviz` skillt** (a spec §6 kimondja).
- **Commit-üzenet:** conventional subject a bd id-val, pl. `feat(companion): ... (mezo-al1i)`.

---

## File Structure

| fájl | felelősség |
|---|---|
| `api/feature/companion/companion.yml` | **MÓD** (T1, T4, T6) — 4 végpont + sémák |
| `backend/.../companion/repository/DailySummaryRepository.java` | **MÓD** (T1) — count + first/last + between finder |
| `backend/.../companion/repository/MemoryEmbeddingRepository.java` | **MÓD** (T1) — kind-count + ref-id halmaz |
| `backend/.../companion/repository/LearnedFactRepository.java` | **MÓD** (T1) — pending count |
| `backend/.../companion/service/MemoryObservatoryService.java` | **ÚJ** (T1, bővül T4/T6) — a 4 read-only aggregátum |
| `backend/.../companion/controller/CompanionController.java` | **MÓD** (T1, T4, T6) — a 4 generált metódus implementációja |
| `backend/.../llmlog/repository/LlmDailyAggregate.java` + `LlmLogRepository.java` | **ÚJ/MÓD** (T6) — napi natív rollup |
| `backend/.../llmlog/service/LlmUsageService.java` | **MÓD** (T6) — `perDay(days)` + `auditEnabled()` |
| `frontend/src/data/types.ts` | **MÓD** (T2, T7) — Memory* domain típusok, `FactSource`, `KnowledgeFact` bővítés |
| `frontend/src/data/insights/memory.ts` | **ÚJ** (T2, bővül T5/T7) — mock seedek |
| `frontend/src/data/insights/memoryApi.ts` | **ÚJ** (T2, bővül T5/T7) — wire → domain mapping |
| `frontend/src/data/insights/memoryHooks.ts` | **ÚJ** (T2, bővül T5/T7) — a 4 hook |
| `frontend/src/data/insights/knowledgeApi.ts` + `knowledge.ts` | **MÓD** (T7) — `source` + `lastReinforcedAt` a FE-n |
| `frontend/src/data/hooks.ts` | **MÓD** (T2, T5, T7) — barrel re-export |
| `frontend/src/test/msw/handlers.ts` | **MÓD** (T2, T5, T7) — 4 default handler |
| `frontend/src/features/insights/components/MemoryLayerCard.tsx` | **ÚJ** (T3) — egy réteg-kártya |
| `frontend/src/features/insights/components/MemoryLayersPanel.tsx` | **ÚJ** (T3) — Áttekintés: 4 kártya + konnektorok |
| `frontend/src/features/insights/components/MemoryJournalPanel.tsx` | **ÚJ** (T3) — Napló: memoir-kártyák hónap-elválasztókkal |
| `frontend/src/features/insights/components/SimilarDayCard.tsx` + `MemorySearchPanel.tsx` | **ÚJ** (T5) — Kereső |
| `frontend/src/features/insights/components/TokenColumns.tsx` + `MemoryAuditPanel.tsx` | **ÚJ** (T7) — Audit |
| `frontend/src/features/insights/pages/MemoryPage.tsx` (+ test) | **ÚJ** (T3, bővül T5/T7) — a leaf + szegmens-váltó |
| `frontend/src/features/insights/pages/tabs.ts` · `frontend/src/app/router.tsx` | **MÓD** (T3) — 9. tab + route |
| `frontend/src/features/insights/pages/MotorPage.tsx` | **MÓD** (T3) — kölcsönös link a Memória tabra |
| `frontend/src/styles/prototype.css` | **MÓD** (T3) — áramlás-konnektor keyframe + reduce-guard |
| `docs/features/companion.md` · `docs/features/insights.md` | **MÓD** (T8) — living docs |

---

## Task 1: Kontraktus ① (overview + napló) + repo-bővítések + `MemoryObservatoryService` + controller

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/DailySummaryRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/LearnedFactRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MemoryObservatoryService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryOverviewApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemorySummaryApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemorySwitchOffIT.java`

**Interfaces:**
- Consumes: `MetricSeriesService.series(UUID, MetricKey, LocalDate, LocalDate) → Map<LocalDate,Double>` · `PatternGate.window(Map, LocalDate, LocalDate)` (package-private static, azonos csomag) · `CompanionProperties.patterns()/summary()/hypotheses()` rekordok (`cron()`, `lookbackDays()`) · `PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc` · `KnowledgeFactRepository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc` · `MemoryEmbeddingEntity.KIND_DAILY_SUMMARY / KIND_CHAT_TURN` · `PatternEntity.KIND_STATISTICAL`.
- Produces: `GET /api/companion/memory/overview → MemoryOverviewResponse` · `GET /api/companion/memory/summary?from&to → MemorySummaryListResponse` · `MemoryObservatoryService.overview(UUID)` / `.summaries(UUID, LocalDate, LocalDate)` · új repo-metódusok (lásd Step 3).

- [ ] **Step 1: Bővítsd a kontraktust**

`api/feature/companion/companion.yml` — a `/api/companion/pattern/monitor` path-blokk UTÁN, még a `components:` előtt:

```yaml
  /api/companion/memory/overview:
    get:
      tags: [Companion]
      operationId: getMemoryOverview
      summary: >-
        Memória-obszervatórium áttekintés (mezo-al1i) — a 4 memória-réteg (L0 nyers napok →
        L1 napló + vektorok → L2 ítélet-inbox → L3 tartós tudás) élő számai + a cron-ütemezés.
        Read-only aggregátum, semmit nem ír.
      responses:
        '200':
          description: A memória-rétegek pillanatképe
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MemoryOverviewResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Companion switched off — the whole surface is absent
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/memory/summary:
    get:
      tags: [Companion]
      operationId: listMemorySummaries
      summary: >-
        Az L1 epizodikus napló (mezo-al1i) — napi összefoglaló-narratívák date-desc, opcionális
        [from,to] tartomány-szűréssel; embedded = van-e élő daily_summary vektora a napnak.
      parameters:
        - name: from
          in: query
          required: false
          description: A tartomány első napja (inkluzív); elhagyva nincs alsó határ.
          schema: { type: string, format: date }
        - name: to
          in: query
          required: false
          description: A tartomány utolsó napja (inkluzív); elhagyva nincs felső határ.
          schema: { type: string, format: date }
      responses:
        '200':
          description: A napló bejegyzései (date-desc)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MemorySummaryListResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Companion switched off — the whole surface is absent
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Ugyanebben a fájlban a `components.schemas` végére (a `PatternMetricCoverage` után):

```yaml
    MemoryOverviewResponse:
      type: object
      required: [l0, l1, l2, l3, jobs]
      properties:
        l0: { $ref: '#/components/schemas/MemoryOverviewL0' }
        l1: { $ref: '#/components/schemas/MemoryOverviewL1' }
        l2: { $ref: '#/components/schemas/MemoryOverviewL2' }
        l3: { $ref: '#/components/schemas/MemoryOverviewL3' }
        jobs: { $ref: '#/components/schemas/MemoryOverviewJobs' }
    MemoryOverviewL0:
      type: object
      required: [daysWithAnyData, windowDays]
      properties:
        daysWithAnyData: { type: integer, description: 'Hány napon van BÁRMELY metrikán adat a minta-ablakban (a MetricKey-k uniója).' }
        windowDays: { type: integer, description: 'mezo.companion.patterns.lookback-days (60).' }
    MemoryOverviewL1:
      type: object
      required: [summaryCount, embeddings]
      properties:
        summaryCount: { type: integer }
        firstDate: { type: string, format: date, nullable: true }
        lastDate: { type: string, format: date, nullable: true }
        embeddings: { $ref: '#/components/schemas/MemoryEmbeddingCounts' }
    MemoryEmbeddingCounts:
      type: object
      required: [dailySummary, chatTurn]
      properties:
        dailySummary: { type: integer }
        chatTurn: { type: integer }
    MemoryOverviewL2:
      type: object
      required: [patterns, pendingFactCandidates]
      properties:
        patterns:
          type: array
          items: { $ref: '#/components/schemas/MemoryPatternCount' }
        pendingFactCandidates: { type: integer, description: 'Eldöntetlen learned_fact jelöltek (L2 tény-inbox).' }
    MemoryPatternCount:
      type: object
      required: [kind, status, count]
      properties:
        kind: { type: string, pattern: '^(statistical|ai_hypothesis)$' }
        status: { type: string, pattern: '^(proposed|monitoring|confirmed|rejected)$' }
        count: { type: integer }
    MemoryOverviewL3:
      type: object
      required: [facts, totalReinforcements, factsInPrompt]
      properties:
        facts:
          type: array
          items: { $ref: '#/components/schemas/MemoryFactSourceCount' }
        totalReinforcements: { type: integer, description: 'A reinforcement_count-ok összege.' }
        factsInPrompt: { type: integer, description: 'include_in_prompt = true tények (a top-N injekció jelöltjei).' }
    MemoryFactSourceCount:
      type: object
      required: [source, count]
      properties:
        source: { type: string, pattern: '^(chat|pattern|manual)$' }
        count: { type: integer }
    MemoryOverviewJobs:
      type: object
      required: [summaryCron, patternCron, hypothesisCron]
      properties:
        summaryCron: { type: string, description: 'mezo.companion.summary.cron — nyers cron, a FE csak megjeleníti.' }
        patternCron: { type: string }
        hypothesisCron: { type: string }
        lastSummaryDate: { type: string, format: date, nullable: true, description: 'max(summary_date) — az utolsó megírt napló-nap.' }
        lastDetectedAt: { type: string, format: date-time, nullable: true, description: 'max(lastDetectedAt) a user statisztikai során — az utolsó FELISMERÉS, nem az utolsó futás (a pattern/monitor lastRunAt szemantikája).' }
    MemorySummaryListResponse:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items: { $ref: '#/components/schemas/MemorySummaryItem' }
    MemorySummaryItem:
      type: object
      required: [date, narrative, embedded]
      properties:
        date: { type: string, format: date }
        narrative: { type: string }
        embedded: { type: boolean, description: 'Van-e élő daily_summary vektor ehhez az összefoglalóhoz.' }
```

- [ ] **Step 2: Generálj, és nézd meg, hogy a fordítás elhasal**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw clean compile
```

Elvárt: **fordítási hiba** — `CompanionController is not abstract and does not override abstract method getMemoryOverview()` (és `listMemorySummaries`). Ez a contract-first „piros" állapot.

- [ ] **Step 3: Repo-bővítések**

`DailySummaryRepository.java` — a meglévő metódusok után (ez a repo a `@SQLRestriction`-re támaszkodik, a metódusnevekben nincs `DeletedFalse` — tartsd ezt az idiómát):

```java
    /** Memória-obszervatórium (mezo-al1i) — az L1 réteg-kártya számai. */
    long countByCreatedBy(UUID createdBy);

    Optional<DailySummaryEntity> findTop1ByCreatedByOrderBySummaryDateAsc(UUID createdBy);

    Optional<DailySummaryEntity> findTop1ByCreatedByOrderBySummaryDateDesc(UUID createdBy);

    /** A napló-nézet tartomány-szűrt listája (mezo-al1i) — date-desc. */
    List<DailySummaryEntity> findByCreatedByAndSummaryDateBetweenOrderBySummaryDateDesc(
            UUID createdBy, LocalDate from, LocalDate to);
```

`MemoryEmbeddingRepository.java` — a meglévő metódusok mellé (importáld: `java.util.Set`, `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param` — az utóbbi kettő már ott lehet a `findNearest` miatt):

```java
    /** Memória-obszervatórium (mezo-al1i) — vektor-darabszám rétegenként. */
    long countByCreatedByAndKind(UUID createdBy, String kind);

    /** A napló-nézet batch embed-jelzője — a kind élő ref-id-i (a @SQLRestriction JPQL-re is áll). */
    @Query("select m.refId from MemoryEmbeddingEntity m where m.createdBy = :createdBy and m.kind = :kind")
    Set<UUID> findRefIdsByCreatedByAndKind(@Param("createdBy") UUID createdBy, @Param("kind") String kind);
```

`LearnedFactRepository.java`:

```java
    /** Memória-obszervatórium (mezo-al1i) — az L2 kártya függő-jelölt száma. */
    long countByCreatedByAndUserDecisionIsNullAndDeletedFalse(UUID createdBy);
```

- [ ] **Step 4: Írd meg a `MemoryObservatoryService`-t**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MemoryObservatoryService.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MemoryEmbeddingCounts;
import io.mrkuhne.mezo.api.dto.MemoryFactSourceCount;
import io.mrkuhne.mezo.api.dto.MemoryOverviewJobs;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL0;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL1;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL2;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL3;
import io.mrkuhne.mezo.api.dto.MemoryOverviewResponse;
import io.mrkuhne.mezo.api.dto.MemoryPatternCount;
import io.mrkuhne.mezo.api.dto.MemorySummaryItem;
import io.mrkuhne.mezo.api.dto.MemorySummaryListResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Memória-obszervatórium (mezo-al1i): a 3-4 rétegű memória (L0 nyers adat → L1 epizodikus napló +
 * vektorok → L2 ítélet-inbox → L3 tartós tudás) read-only pillanatképe a /insights/memoria tabnak.
 * Semmit nem ír; az L0 a {@link PatternMonitorService} sorozat-cache idiómáját követi (metrikánként
 * egy series()-hívás), így az áttekintés ugyanazt a világot látja, mint a minta-motor.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryObservatoryService {

    private final MetricSeriesService metricSeriesService;
    private final DailySummaryRepository dailySummaryRepository;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final PatternRepository patternRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionProperties properties;

    @Transactional(readOnly = true)
    public MemoryOverviewResponse overview(UUID userId) {
        CompanionProperties.Patterns patterns = properties.patterns();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(patterns.lookbackDays() - 1L);

        // L0 — a minta-ablak napjai, amelyeken BÁRMELY metrika ad adatot (kulcs-unió).
        Set<LocalDate> daysWithData = new HashSet<>();
        for (MetricKey metric : MetricKey.values()) {
            daysWithData.addAll(PatternGate.window(
                    metricSeriesService.series(userId, metric, from, to), from, to).keySet());
        }

        LocalDate firstDate = dailySummaryRepository.findTop1ByCreatedByOrderBySummaryDateAsc(userId)
                .map(DailySummaryEntity::getSummaryDate).orElse(null);
        LocalDate lastDate = dailySummaryRepository.findTop1ByCreatedByOrderBySummaryDateDesc(userId)
                .map(DailySummaryEntity::getSummaryDate).orElse(null);

        // L2 — kind×status rollup Java-ban: egy user élő mintái kevesen vannak, nem kell GROUP BY.
        Map<String, Integer> byKindStatus = new LinkedHashMap<>();
        Instant lastDetectedAt = null;
        for (PatternEntity row : patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)) {
            byKindStatus.merge(row.getKind() + "|" + row.getStatus(), 1, Integer::sum);
            if (PatternEntity.KIND_STATISTICAL.equals(row.getKind()) && row.getLastDetectedAt() != null
                    && (lastDetectedAt == null || row.getLastDetectedAt().isAfter(lastDetectedAt))) {
                lastDetectedAt = row.getLastDetectedAt();
            }
        }
        List<MemoryPatternCount> patternCounts = byKindStatus.entrySet().stream()
                .map(entry -> {
                    String[] key = entry.getKey().split("\\|", 2);
                    return MemoryPatternCount.builder().kind(key[0]).status(key[1]).count(entry.getValue()).build();
                })
                .toList();

        Map<String, Integer> bySource = new LinkedHashMap<>();
        int totalReinforcements = 0;
        int factsInPrompt = 0;
        for (KnowledgeFactEntity fact : knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)) {
            bySource.merge(fact.getSource(), 1, Integer::sum);
            totalReinforcements += fact.getReinforcementCount();
            if (fact.isIncludeInPrompt()) {
                factsInPrompt++;
            }
        }

        return MemoryOverviewResponse.builder()
                .l0(MemoryOverviewL0.builder()
                        .daysWithAnyData(daysWithData.size())
                        .windowDays(patterns.lookbackDays())
                        .build())
                .l1(MemoryOverviewL1.builder()
                        .summaryCount((int) dailySummaryRepository.countByCreatedBy(userId))
                        .firstDate(firstDate)
                        .lastDate(lastDate)
                        .embeddings(MemoryEmbeddingCounts.builder()
                                .dailySummary((int) memoryEmbeddingRepository
                                        .countByCreatedByAndKind(userId, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY))
                                .chatTurn((int) memoryEmbeddingRepository
                                        .countByCreatedByAndKind(userId, MemoryEmbeddingEntity.KIND_CHAT_TURN))
                                .build())
                        .build())
                .l2(MemoryOverviewL2.builder()
                        .patterns(patternCounts)
                        .pendingFactCandidates((int) learnedFactRepository
                                .countByCreatedByAndUserDecisionIsNullAndDeletedFalse(userId))
                        .build())
                .l3(MemoryOverviewL3.builder()
                        .facts(bySource.entrySet().stream()
                                .map(entry -> MemoryFactSourceCount.builder()
                                        .source(entry.getKey()).count(entry.getValue()).build())
                                .toList())
                        .totalReinforcements(totalReinforcements)
                        .factsInPrompt(factsInPrompt)
                        .build())
                .jobs(MemoryOverviewJobs.builder()
                        .summaryCron(properties.summary().cron())
                        .patternCron(patterns.cron())
                        .hypothesisCron(properties.hypotheses().cron())
                        .lastSummaryDate(lastDate)
                        .lastDetectedAt(lastDetectedAt == null ? null : lastDetectedAt.atOffset(ZoneOffset.UTC))
                        .build())
                .build();
    }

    /** A napló listája — a hiányzó határok tág defaultra esnek, így egyetlen query-ág van. */
    @Transactional(readOnly = true)
    public MemorySummaryListResponse summaries(UUID userId, LocalDate from, LocalDate to) {
        LocalDate lo = from != null ? from : LocalDate.of(1970, 1, 1);
        LocalDate hi = to != null ? to : LocalDate.now();
        Set<UUID> embeddedRefs = memoryEmbeddingRepository
                .findRefIdsByCreatedByAndKind(userId, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY);
        List<MemorySummaryItem> items = dailySummaryRepository
                .findByCreatedByAndSummaryDateBetweenOrderBySummaryDateDesc(userId, lo, hi)
                .stream()
                .map(summary -> MemorySummaryItem.builder()
                        .date(summary.getSummaryDate())
                        .narrative(summary.getNarrative())
                        .embedded(embeddedRefs.contains(summary.getId()))
                        .build())
                .toList();
        return MemorySummaryListResponse.builder().items(items).build();
    }
}
```

- [ ] **Step 5: Implementáld a controller-metódusokat**

`CompanionController.java` — importok: `io.mrkuhne.mezo.api.dto.MemoryOverviewResponse`, `io.mrkuhne.mezo.api.dto.MemorySummaryListResponse`, `io.mrkuhne.mezo.feature.companion.service.MemoryObservatoryService`, `java.time.LocalDate`; új mező a többi service alá: `private final MemoryObservatoryService memoryObservatoryService;`; a `patternMonitor()` metódus után:

```java
    @Override
    public MemoryOverviewResponse getMemoryOverview() {
        return memoryObservatoryService.overview(currentUserId.get());
    }

    @Override
    public MemorySummaryListResponse listMemorySummaries(LocalDate from, LocalDate to) {
        return memoryObservatoryService.summaries(currentUserId.get(), from, to);
    }
```

- [ ] **Step 6: Fordulnia kell**

```bash
cd backend && ./mvnw clean compile
```

Elvárt: BUILD SUCCESS.

- [ ] **Step 7: Írd meg az integrációs teszteket**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryOverviewApiIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemoryFactSourceCount;
import io.mrkuhne.mezo.api.dto.MemoryOverviewResponse;
import io.mrkuhne.mezo.api.dto.MemoryPatternCount;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** A memória-obszervatórium áttekintés HTTP-kontraktusa (mezo-al1i) — rétegszámok, config-echo, izoláció. */
class CompanionMemoryOverviewApiIT extends ApiIntegrationTest {

    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private MemoryOverviewResponse overview() {
        return getForBody("/api/companion/memory/overview", ownerAuthHeaders(),
                HttpStatus.OK, MemoryOverviewResponse.class);
    }

    @Test
    void testGetMemoryOverview_shouldReturnZerosAndConfigEcho_whenUserHasNoData() {
        MemoryOverviewResponse response = overview();

        assertThat(response.getL0().getDaysWithAnyData()).isZero();
        assertThat(response.getL0().getWindowDays()).isEqualTo(60);
        assertThat(response.getL1().getSummaryCount()).isZero();
        assertThat(response.getL1().getFirstDate()).isNull();
        assertThat(response.getL1().getLastDate()).isNull();
        assertThat(response.getL1().getEmbeddings().getDailySummary()).isZero();
        assertThat(response.getL1().getEmbeddings().getChatTurn()).isZero();
        assertThat(response.getL2().getPatterns()).isEmpty();
        assertThat(response.getL2().getPendingFactCandidates()).isZero();
        assertThat(response.getL3().getFacts()).isEmpty();
        assertThat(response.getL3().getTotalReinforcements()).isZero();
        assertThat(response.getL3().getFactsInPrompt()).isZero();
        assertThat(response.getJobs().getSummaryCron()).isEqualTo("0 20 2 * * *");
        assertThat(response.getJobs().getPatternCron()).isEqualTo("0 40 2 * * *");
        assertThat(response.getJobs().getHypothesisCron()).isEqualTo("0 0 3 * * SUN");
        assertThat(response.getJobs().getLastSummaryDate()).isNull();
        assertThat(response.getJobs().getLastDetectedAt()).isNull();
    }

    @Test
    void testGetMemoryOverview_shouldCountEveryLayer_whenAllLayersPopulated() {
        UUID owner = ownerId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        // L0: két alvás-nap a minta-ablakban (sleep-quality + sleep-duration széria — unió: 2 nap)
        sleepLogPopulator.createSleepLog(owner, yesterday, new BigDecimal("7.5"), 4);
        sleepLogPopulator.createSleepLog(owner, yesterday.minusDays(2), new BigDecimal("6.0"), 3);
        // L1: két összefoglaló, az egyik vektorizálva + egy chat-turn vektor
        DailySummaryEntity embedded = dailySummaryPopulator.summary(owner, yesterday);
        dailySummaryPopulator.summary(owner, yesterday.minusDays(1));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                embedded.getId(), "n", yesterday, MemoryEmbeddingPopulator.axisVector(0));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN,
                UUID.randomUUID(), "t", yesterday, MemoryEmbeddingPopulator.axisVector(1));
        // L2: két statisztikai minta + egy függő jelölt
        patternPopulator.statistical(owner, "a~b", PatternEntity.STATUS_CONFIRMED);
        patternPopulator.statistical(owner, "c~d", PatternEntity.STATUS_PROPOSED);
        learnedFactPopulator.candidate(owner, "függő jelölt", null);
        // L3: chat- és minta-forrású tény (3 + 2 megerősítés, az utóbbi nincs a promptban)
        knowledgeFactPopulator.fact(owner, "tény1", "train", 3, true, KnowledgeFactEntity.SOURCE_CHAT);
        knowledgeFactPopulator.fact(owner, "tény2", "health", 2, false, KnowledgeFactEntity.SOURCE_PATTERN);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL0().getDaysWithAnyData()).isEqualTo(2);
        assertThat(response.getL1().getSummaryCount()).isEqualTo(2);
        assertThat(response.getL1().getFirstDate()).isEqualTo(yesterday.minusDays(1));
        assertThat(response.getL1().getLastDate()).isEqualTo(yesterday);
        assertThat(response.getL1().getEmbeddings().getDailySummary()).isEqualTo(1);
        assertThat(response.getL1().getEmbeddings().getChatTurn()).isEqualTo(1);
        assertThat(response.getL2().getPatterns())
                .extracting(MemoryPatternCount::getKind, MemoryPatternCount::getStatus, MemoryPatternCount::getCount)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("statistical", "confirmed", 1),
                        org.assertj.core.groups.Tuple.tuple("statistical", "proposed", 1));
        assertThat(response.getL2().getPendingFactCandidates()).isEqualTo(1);
        assertThat(response.getL3().getFacts())
                .extracting(MemoryFactSourceCount::getSource, MemoryFactSourceCount::getCount)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("chat", 1),
                        org.assertj.core.groups.Tuple.tuple("pattern", 1));
        assertThat(response.getL3().getTotalReinforcements()).isEqualTo(5);
        assertThat(response.getL3().getFactsInPrompt()).isEqualTo(1);
        assertThat(response.getJobs().getLastSummaryDate()).isEqualTo(yesterday);
        assertThat(response.getJobs().getLastDetectedAt()).isNotNull();
    }

    @Test
    void testGetMemoryOverview_shouldIgnoreForeignRows_whenAnotherUserHasMemory() {
        UUID foreign = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(foreign, LocalDate.now().minusDays(1));
        knowledgeFactPopulator.fact(foreign, "idegen tény", "life", 9);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getSummaryCount()).isZero();
        assertThat(response.getL3().getFacts()).isEmpty();
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemorySummaryApiIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemorySummaryItem;
import io.mrkuhne.mezo.api.dto.MemorySummaryListResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.UUID;

/** Az L1 napló-lista HTTP-kontraktusa (mezo-al1i) — rendezés, tartomány-szűrés, embed-jelző. */
class CompanionMemorySummaryApiIT extends ApiIntegrationTest {

    private static final LocalDate D = LocalDate.of(2026, 8, 1);

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private MemorySummaryListResponse list(String query) {
        return getForBody("/api/companion/memory/summary" + query, ownerAuthHeaders(),
                HttpStatus.OK, MemorySummaryListResponse.class);
    }

    @Test
    void testListMemorySummaries_shouldOrderDateDescWithEmbedFlags_whenNoRangeGiven() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, D, "első nap");
        DailySummaryEntity middle = dailySummaryPopulator.summary(owner, D.plusDays(5), "második nap");
        dailySummaryPopulator.summary(owner, D.plusDays(10), "harmadik nap");
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                middle.getId(), "második nap", D.plusDays(5), MemoryEmbeddingPopulator.axisVector(0));

        MemorySummaryListResponse response = list("");

        assertThat(response.getItems()).extracting(MemorySummaryItem::getDate)
                .containsExactly(D.plusDays(10), D.plusDays(5), D);
        assertThat(response.getItems()).extracting(MemorySummaryItem::getEmbedded)
                .containsExactly(false, true, false);
        assertThat(response.getItems().get(1).getNarrative()).isEqualTo("második nap");
    }

    @Test
    void testListMemorySummaries_shouldFilterInclusive_whenRangeGiven() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, D, "kint");
        dailySummaryPopulator.summary(owner, D.plusDays(5), "bent");
        dailySummaryPopulator.summary(owner, D.plusDays(10), "kint");

        MemorySummaryListResponse response = list("?from=2026-08-02&to=2026-08-08");

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getDate()).isEqualTo(D.plusDays(5));
    }

    @Test
    void testListMemorySummaries_shouldIgnoreForeignRows_whenAnotherUserHasSummaries() {
        dailySummaryPopulator.summary(userPopulator.createUser().getId(), D, "idegen");

        assertThat(list("").getItems()).isEmpty();
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemorySwitchOffIT.java` (a `CompanionPatternMonitorSwitchOffIT` kanonikus mintája):

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.MemoryObservatoryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Companion switch off ⇒ az obszervatórium bean nem létezik (a végpontok 404 — a FE degraded ága). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionMemorySwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoObservatoryBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(MemoryObservatoryService.class).getIfAvailable()).isNull();
    }
}
```

Plusz a meglévő `CompanionApiSwitchOffIT.java`-ba egy új teszt a többi mellé (1:1 a `testListFacts_...` mintája):

```java
    @Test
    void testGetMemoryOverview_shouldReturn404_whenCompanionSwitchedOff() {
        // mezo-al1i memória-obszervatórium — ugyanaz a bean-határ kapuzza
        String body = getForBody(
                "/api/companion/memory/overview", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
```

- [ ] **Step 8: Futtasd az IT-ket**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMemoryOverviewApiIT,CompanionMemorySummaryApiIT,CompanionMemorySwitchOffIT,CompanionApiSwitchOffIT'
```

Elvárt: PASS. (Az overview populált tesztjének L0-asszertje a `sleep-quality`/`sleep-duration` szériákra épül — a két alvás-nap a 60 napos ablakon belül van, mert `yesterday` és `yesterday-2`.)

- [ ] **Step 9: A companion-suite maradjon zöld**

```bash
cd backend && ./mvnw clean test -Dtest='Companion*,MemoryRecallServiceIT,PatternDetectionServiceIT'
```

- [ ] **Step 10: Commit**

```bash
git add api/ backend/ frontend/src/data/_client/api.gen.ts && git commit -m "feat(companion): memória-obszervatórium — overview + napló végpontok (mezo-al1i)"
```

---

## Task 2: FE adatréteg ① — típusok, seed, api, hookok, MSW

**Files:**
- Modify: `frontend/src/data/types.ts`
- Create: `frontend/src/data/insights/memory.ts`
- Create: `frontend/src/data/insights/memoryApi.ts`
- Create: `frontend/src/data/insights/memoryHooks.ts`
- Modify: `frontend/src/data/hooks.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/insights/memoryHooks.test.tsx`

**Interfaces:**
- Consumes: `components['schemas']['MemoryOverviewResponse' | 'MemorySummaryListResponse']` az `@/data/_client/api.gen`-ből (Task 1 regen) · `apiFetch` / `ApiError` (`@/data/_client/api`) · `useDualQuery` (`@/data/useDualQuery`).
- Produces: `useMemoryOverview() → { overview: MemoryOverview | null, degraded, mode, isPending, isError, refetch }` · `useMemorySummaries() → { summaries: MemorySummaryItem[], degraded, mode, isPending }` a `@/data/hooks` barrelből · `MemoryOverview`, `MemorySummaryItem`, `SimilarDay`, `MemoryLlmUsage`, `LlmUsageDay`, `FactSource` domain típusok · `memoryOverview`, `memorySummaries` mock seedek.

- [ ] **Step 1: Domain típusok**

`frontend/src/data/types.ts` — a `KnowledgeFact` típus közelébe:

```ts
/** A knowledge_fact source oszlopa a dróton — chat-kivonat / minta-promóció / kézi felvétel. */
export type FactSource = 'chat' | 'pattern' | 'manual'

export interface MemoryPatternCount { kind: string; status: string; count: number }
export interface MemoryFactSourceCount { source: FactSource; count: number }

/** A memória-obszervatórium áttekintés (mezo-al1i) — L0→L3 réteg-számok + cron-ütemezés. */
export interface MemoryOverview {
  l0: { daysWithAnyData: number; windowDays: number }
  l1: {
    summaryCount: number
    firstDate: string | null
    lastDate: string | null
    embeddings: { dailySummary: number; chatTurn: number }
  }
  l2: { patterns: MemoryPatternCount[]; pendingFactCandidates: number }
  l3: { facts: MemoryFactSourceCount[]; totalReinforcements: number; factsInPrompt: number }
  jobs: {
    summaryCron: string
    patternCron: string
    hypothesisCron: string
    lastSummaryDate: string | null
    lastDetectedAt: string | null
  }
}

export interface MemorySummaryItem { date: string; narrative: string; embedded: boolean }

/** Egy hasonló-nap találat — MINDKÉT pontszám kimegy (similarity × exp(-age/τ) mechanika). */
export interface SimilarDay { date: string; excerpt: string; similarity: number; finalScore: number }

export interface LlmUsageDay {
  date: string
  calls: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}

export interface MemoryLlmUsage {
  enabled: boolean
  perDay: LlmUsageDay[]
  totals: { calls: number; inputTokens: number; outputTokens: number; costUsd: number | null }
}
```

- [ ] **Step 2: Mock seed**

`frontend/src/data/insights/memory.ts` (új fájl — a Kereső/Audit seedjei az 5/7. taskban jönnek):

```ts
import type { MemoryOverview, MemorySummaryItem } from '@/data/types'

/** A demo áttekintés (mezo-al1i) — a számok a napló-seeddel nagyságrendben konzisztensek. */
export const memoryOverview: MemoryOverview = {
  l0: { daysWithAnyData: 47, windowDays: 60 },
  l1: {
    summaryCount: 38,
    firstDate: '2026-07-01',
    lastDate: '2026-08-12',
    embeddings: { dailySummary: 38, chatTurn: 112 },
  },
  l2: {
    patterns: [
      { kind: 'statistical', status: 'proposed', count: 2 },
      { kind: 'statistical', status: 'confirmed', count: 3 },
      { kind: 'ai_hypothesis', status: 'monitoring', count: 1 },
    ],
    pendingFactCandidates: 2,
  },
  l3: {
    facts: [
      { source: 'chat', count: 9 },
      { source: 'pattern', count: 3 },
      { source: 'manual', count: 2 },
    ],
    totalReinforcements: 31,
    factsInPrompt: 12,
  },
  jobs: {
    summaryCron: '0 20 2 * * *',
    patternCron: '0 40 2 * * *',
    hypothesisCron: '0 0 3 * * SUN',
    lastSummaryDate: '2026-08-12',
    lastDetectedAt: '2026-08-13T00:40:00Z',
  },
}

/** Az L1 napló demo-bejegyzései — két hónapot fed, hogy a hónap-elválasztó látsszon. */
export const memorySummaries: MemorySummaryItem[] = [
  {
    date: '2026-08-12',
    narrative:
      'Erős pull-nap volt: a Chest Supported Row 3×8-ra ment 62,5 kg-mal, a válla nem szólt bele. ' +
      'Este 21:40-kor zárta a konyhát, a fehérje 168 g-on állt meg. Az alvás 7,4 óra lett, minőség 4/5.',
    embedded: true,
  },
  {
    date: '2026-08-11',
    narrative:
      'Röplabda-este kedden — 95 perc pályán, utána késői vacsora 21:55-kor. A reggeli check-in ' +
      'energiája 3/5 volt, a stressz alacsony. Vízbevitel 2,8 l.',
    embedded: true,
  },
  {
    date: '2026-08-09',
    narrative:
      'Pihenőnap volt, de a napzárás elmaradt. Rövidebb alvás (6,1 óra, 2/5) követte — a vasárnap ' +
      'esti mintázat megint kirajzolódott. Reta ciklusnap 6.',
    embedded: false,
  },
  {
    date: '2026-07-30',
    narrative:
      'Push-nap 8 900 kg összvolumennel, a bench 5 kg-os PR-kísérlete 1 ismétlésen elakadt. ' +
      'A kreatin + kollagén stack ment, a kcal 2 450-en zárt.',
    embedded: true,
  },
  {
    date: '2026-07-28',
    narrative:
      'Nehéz munkanap után 40 perces easy futás — a HR-recovery 52 s volt, jobb a szokásosnál. ' +
      'Az esti reflexió „részben" lett: a foci csak félig valósult meg.',
    embedded: true,
  },
  {
    date: '2026-07-21',
    narrative:
      'Deload-hét első napja. Korai lefekvés 22:10-kor, 8,1 óra alvás (5/5) — másnap a gym-workload ' +
      'is könnyebbnek érződött. A társ ezt a párost figyeli.',
    embedded: true,
  },
]
```

- [ ] **Step 3: Írd meg a bukó hook-tesztet**

`frontend/src/data/insights/memoryHooks.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useMemoryOverview, useMemorySummaries } from '@/data/insights/memoryHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const overviewWire = {
  l0: { daysWithAnyData: 12, windowDays: 60 },
  l1: { summaryCount: 5, embeddings: { dailySummary: 4, chatTurn: 9 } }, // first/lastDate hiányzik
  l2: { patterns: [{ kind: 'statistical', status: 'proposed', count: 1 }], pendingFactCandidates: 0 },
  l3: { facts: [{ source: 'chat', count: 2 }], totalReinforcements: 3, factsInPrompt: 2 },
  jobs: { summaryCron: '0 20 2 * * *', patternCron: '0 40 2 * * *', hypothesisCron: '0 0 3 * * SUN' },
}

describe('memory hooks (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('useMemoryOverview normalizes absent optional wire fields to null', async () => {
    server.use(http.get(`${API_BASE}/api/companion/memory/overview`, () => HttpResponse.json(overviewWire)))
    const { result } = renderHook(() => useMemoryOverview(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.overview).not.toBeNull())
    expect(result.current.overview!.l0.daysWithAnyData).toBe(12)
    expect(result.current.overview!.l1.firstDate).toBeNull()
    expect(result.current.overview!.jobs.lastDetectedAt).toBeNull()
    expect(result.current.degraded).toBe(false)
    expect(result.current.mode).toBe('live')
  })

  test('useMemoryOverview flags degraded on a 404 (companion switch off)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/overview`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useMemoryOverview(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.overview).toBeNull()
  })

  test('useMemorySummaries maps items and flags degraded on 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/summary`, () =>
        HttpResponse.json({ items: [{ date: '2026-08-12', narrative: 'jó nap', embedded: true }] }),
      ),
    )
    const { result } = renderHook(() => useMemorySummaries(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.summaries).toHaveLength(1))
    expect(result.current.summaries[0]).toEqual({ date: '2026-08-12', narrative: 'jó nap', embedded: true })
  })
})

describe('memory hooks (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seeds synchronously without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result: o } = renderHook(() => useMemoryOverview(), { wrapper: makeHookWrapper() })
    const { result: s } = renderHook(() => useMemorySummaries(), { wrapper: makeHookWrapper() })

    expect(o.current.mode).toBe('mock')
    expect(o.current.overview!.l1.summaryCount).toBe(38)
    expect(s.current.summaries).toHaveLength(6)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Futtasd — bukjon**

```bash
cd frontend && pnpm test src/data/insights/memoryHooks.test.tsx
```

Elvárt: FAIL — `Failed to resolve import "@/data/insights/memoryHooks"`.

- [ ] **Step 5: API-réteg**

`frontend/src/data/insights/memoryApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { FactSource, MemoryOverview, MemorySummaryItem } from '@/data/types'

export type MemoryOverviewResponse = components['schemas']['MemoryOverviewResponse']
export type MemorySummaryListResponse = components['schemas']['MemorySummaryListResponse']

/** Wire → FE domain: a hiányzó opcionális mezők egységesen `null`-ra normalizálódnak. */
export function toOverview(w: MemoryOverviewResponse): MemoryOverview {
  return {
    l0: { daysWithAnyData: w.l0.daysWithAnyData, windowDays: w.l0.windowDays },
    l1: {
      summaryCount: w.l1.summaryCount,
      firstDate: w.l1.firstDate ?? null,
      lastDate: w.l1.lastDate ?? null,
      embeddings: { dailySummary: w.l1.embeddings.dailySummary, chatTurn: w.l1.embeddings.chatTurn },
    },
    l2: {
      patterns: w.l2.patterns.map((p) => ({ kind: p.kind, status: p.status, count: p.count })),
      pendingFactCandidates: w.l2.pendingFactCandidates,
    },
    l3: {
      // a wire string a saját backendünk pattern-kényszeréből jön
      facts: w.l3.facts.map((f) => ({ source: f.source as FactSource, count: f.count })),
      totalReinforcements: w.l3.totalReinforcements,
      factsInPrompt: w.l3.factsInPrompt,
    },
    jobs: {
      summaryCron: w.jobs.summaryCron,
      patternCron: w.jobs.patternCron,
      hypothesisCron: w.jobs.hypothesisCron,
      lastSummaryDate: w.jobs.lastSummaryDate ?? null,
      lastDetectedAt: w.jobs.lastDetectedAt ?? null,
    },
  }
}

export const memoryApi = {
  overview: async () =>
    toOverview(await apiFetch<MemoryOverviewResponse>('/api/companion/memory/overview')),
  summaries: async (): Promise<MemorySummaryItem[]> => {
    const wire = await apiFetch<MemorySummaryListResponse>('/api/companion/memory/summary')
    return wire.items.map((i) => ({ date: i.date, narrative: i.narrative, embedded: i.embedded }))
  },
}
```

- [ ] **Step 6: A hookok**

`frontend/src/data/insights/memoryHooks.ts`:

```ts
import { ApiError } from '@/data/_client/api'
import { useDualQuery } from '@/data/useDualQuery'
import { memoryApi } from '@/data/insights/memoryApi'
import { memoryOverview as mockOverview, memorySummaries as mockSummaries } from '@/data/insights/memory'
import type { MemoryOverview, MemorySummaryItem } from '@/data/types'

const isSwitchedOff = (err: unknown) => err instanceof ApiError && err.status === 404

export interface MemoryOverviewBootstrap {
  overview: MemoryOverview | null
  degraded: boolean
  mode: 'mock' | 'live'
}

const OVERVIEW_MOCK: MemoryOverviewBootstrap = { overview: mockOverview, degraded: false, mode: 'mock' }
const OVERVIEW_EMPTY: MemoryOverviewBootstrap = { overview: null, degraded: false, mode: 'live' }

/** A memória-rétegek áttekintése (mezo-al1i) — companion switch off 404 ⇒ degraded. */
export function useMemoryOverview() {
  const { data, isPending, isError, refetch } = useDualQuery<MemoryOverviewBootstrap>({
    queryKey: ['memory', 'overview'],
    mockData: OVERVIEW_MOCK,
    realFetch: async () => {
      try {
        return { overview: await memoryApi.overview(), degraded: false, mode: 'live' as const }
      } catch (e) {
        if (isSwitchedOff(e)) return { ...OVERVIEW_EMPTY, degraded: true }
        throw e
      }
    },
    realEmpty: OVERVIEW_EMPTY,
  })
  return { ...data, isPending, isError, refetch }
}

export interface MemorySummariesBootstrap {
  summaries: MemorySummaryItem[]
  degraded: boolean
  mode: 'mock' | 'live'
}

const SUMMARIES_MOCK: MemorySummariesBootstrap = { summaries: mockSummaries, degraded: false, mode: 'mock' }
const SUMMARIES_EMPTY: MemorySummariesBootstrap = { summaries: [], degraded: false, mode: 'live' }

/** Az L1 napló (mezo-al1i) — teljes lista date-desc; a tartomány-szűrés a szerveren opció marad. */
export function useMemorySummaries() {
  const { data, isPending } = useDualQuery<MemorySummariesBootstrap>({
    queryKey: ['memory', 'summaries'],
    mockData: SUMMARIES_MOCK,
    realFetch: async () => {
      try {
        return { summaries: await memoryApi.summaries(), degraded: false, mode: 'live' as const }
      } catch (e) {
        if (isSwitchedOff(e)) return { ...SUMMARIES_EMPTY, degraded: true }
        throw e
      }
    },
    realEmpty: SUMMARIES_EMPTY,
  })
  return { ...data, isPending }
}
```

- [ ] **Step 7: Barrel + MSW default handlerek**

`frontend/src/data/hooks.ts` — az insights-blokk végére:

```ts
export { useMemoryOverview, useMemorySummaries } from '@/data/insights/memoryHooks'
```

`frontend/src/test/msw/handlers.ts` — a companion-blokk végére (üres, de séma-helyes defaultok; a nav-teszt is ezekre fut):

```ts
  http.get(`${API_BASE}/api/companion/memory/overview`, () =>
    HttpResponse.json({
      l0: { daysWithAnyData: 0, windowDays: 60 },
      l1: { summaryCount: 0, firstDate: null, lastDate: null, embeddings: { dailySummary: 0, chatTurn: 0 } },
      l2: { patterns: [], pendingFactCandidates: 0 },
      l3: { facts: [], totalReinforcements: 0, factsInPrompt: 0 },
      jobs: {
        summaryCron: '0 20 2 * * *',
        patternCron: '0 40 2 * * *',
        hypothesisCron: '0 0 3 * * SUN',
        lastSummaryDate: null,
        lastDetectedAt: null,
      },
    }),
  ),
  http.get(`${API_BASE}/api/companion/memory/summary`, () => HttpResponse.json({ items: [] })),
```

- [ ] **Step 8: Futtasd a hook-teszteket mindkét módban**

```bash
cd frontend && pnpm test src/data/insights/memoryHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/insights/memoryHooks.test.tsx
```

Elvárt: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data frontend/src/test && git commit -m "feat(insights): memória adatréteg ① — overview + napló hookok (mezo-al1i)"
```

---

## Task 3: FE `MemoryPage` — Áttekintés + Napló nézet + tab/route/nav

**Files:**
- Create: `frontend/src/features/insights/components/MemoryLayerCard.tsx`
- Create: `frontend/src/features/insights/components/MemoryLayersPanel.tsx`
- Create: `frontend/src/features/insights/components/MemoryJournalPanel.tsx`
- Create: `frontend/src/features/insights/pages/MemoryPage.tsx`
- Modify: `frontend/src/features/insights/pages/tabs.ts`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/insights/pages/MotorPage.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Test: `frontend/src/features/insights/pages/MemoryPage.test.tsx`
- Test: `frontend/src/features/insights/pages/insights.nav.test.tsx` (kiegészítés)

**Interfaces:**
- Consumes: `useMemoryOverview` / `useMemorySummaries` a `@/data/hooks`-ból (Task 2) · `useStickyTab` (`@/shared/hooks/useStickyTab`) · `GhostState` (`@/shared/ui/GhostState`).
- Produces: `/insights/memoria` route · `MemoryPage` · `MemoryLayerCard({ eyebrow, title, big, stats, last?, onOpen? })` · `MemoryLayersPanel({ overview, onOpenJournal })` · `MemoryJournalPanel({ summaries, focusDate? })` — a `focusDate` propot az 5. task Keresője tölti.

- [ ] **Step 1: Írd meg a bukó oldal-tesztet**

`frontend/src/features/insights/pages/MemoryPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { MemoryPage } from '@/features/insights/pages/MemoryPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <MemoryPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('MemoryPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the four layer cards with the flow connectors', () => {
    renderPage()
    expect(screen.getByText('L0 · Nyers adat')).toBeInTheDocument()
    expect(screen.getByText('47/60 nap')).toBeInTheDocument()
    expect(screen.getByText('L1 · Epizodikus napló')).toBeInTheDocument()
    expect(screen.getByText('38 nap-vektor')).toBeInTheDocument()
    expect(screen.getByText('112 chat-vektor')).toBeInTheDocument()
    expect(screen.getByText('L2 · Ítélet-inbox')).toBeInTheDocument()
    expect(screen.getByText('2 függő tényjelölt')).toBeInTheDocument()
    expect(screen.getByText('L3 · Tartós tudás')).toBeInTheDocument()
    expect(screen.getByText('31× megerősítés')).toBeInTheDocument()
    // a konnektorokon a cron-idők látszanak
    expect(screen.getByText('napi összefoglaló · 0 20 2 * * *')).toBeInTheDocument()
    expect(screen.getByText('minta-felismerés · 0 40 2 * * *')).toBeInTheDocument()
    expect(screen.getByText('hipotézis + tudás-promóció · 0 0 3 * * SUN')).toBeInTheDocument()
  })

  test('switches to the journal with month separators and embed dots', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Napló' }))
    expect(screen.getByText('2026. augusztus')).toBeInTheDocument()
    expect(screen.getByText('2026. július')).toBeInTheDocument()
    expect(screen.getByText(/Chest Supported Row 3×8-ra ment/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('vektorizálva')).toHaveLength(5)
    expect(screen.getAllByLabelText('még nincs vektor')).toHaveLength(1)
  })

  test('the L1 card opens the journal segment', async () => {
    renderPage()
    await userEvent.click(screen.getByText('L1 · Epizodikus napló'))
    expect(screen.getByText('2026. augusztus')).toBeInTheDocument()
  })
})

describe('MemoryPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the degraded card on a 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/overview`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/api/companion/memory/summary`, () => new HttpResponse(null, { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText(/A társ memóriája most nem elérhető/)).toBeInTheDocument()
  })

  test('renders the honest empty journal state', async () => {
    renderPage()
    expect(await screen.findByText('L0 · Nyers adat')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Napló' }))
    expect(
      await screen.findByText(/Az első éjszakai összefoglaló még nem készült el/),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test src/features/insights/pages/MemoryPage.test.tsx
```

Elvárt: FAIL — `Failed to resolve import "@/features/insights/pages/MemoryPage"`.

- [ ] **Step 3: Konnektor-animáció a CSS-ben**

`frontend/src/styles/prototype.css` — a `.graph-node-pulse` blokk után (a meglévő „definiálj + reduce-guard egy sorban" konvenció):

```css
/* Memória-obszervatórium — L0→L3 áramlás-konnektor (mezo-al1i) */
@keyframes memory-flow { to { stroke-dashoffset: -16; } }
.memory-flow-line { animation: memory-flow 1.6s linear infinite; }
@media (prefers-reduced-motion: reduce) { .memory-flow-line { animation: none; } }
```

- [ ] **Step 4: `MemoryLayerCard`**

`frontend/src/features/insights/components/MemoryLayerCard.tsx`:

```tsx
interface MemoryLayerCardProps {
  eyebrow: string
  title: string
  big: string
  stats: string[]
  /** A réteg accent-színe (UI-spec §1) — eyebrow + bal csík + chip-szín. */
  accent: string
  /** A réteg wash-háttere (UI-spec §1). */
  wash: string
  last?: string | null
  onOpen?: () => void
}

/** Egy memória-réteg kártyája (érés-oszlop, UI-spec §2) — wash-háttér + 4px accent-csík; koppintható, ha a rétegnek saját felülete van. */
export function MemoryLayerCard({ eyebrow, title, big, stats, accent, wash, last, onOpen }: MemoryLayerCardProps) {
  return (
    <div
      className={onOpen ? 'card np-press' : 'card'}
      style={{ padding: '14px 14px 14px 18px', cursor: onOpen ? 'pointer' : undefined,
        background: wash, position: 'relative', overflow: 'hidden' }}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen() } : undefined}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow" style={{ color: accent }}>{eyebrow}</span>
        {last && <span className="eyebrow text-tertiary">utoljára: {last}</span>}
      </div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 6, color: 'var(--text-primary)' }}>
        {title}
      </div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>
        {big}
      </div>
      <div className="row gap-sm" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        {stats.map((stat) => (
          <span key={stat} className="chip" style={{ fontSize: 9, color: accent }}>{stat}</span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `MemoryLayersPanel`**

`frontend/src/features/insights/components/MemoryLayersPanel.tsx`:

```tsx
import { Link, useNavigate } from 'react-router-dom'
import type { MemoryOverview } from '@/data/types'
import { MemoryLayerCard } from '@/features/insights/components/MemoryLayerCard'

const KIND_HU: Record<string, string> = { statistical: 'statisztikai', ai_hypothesis: 'AI-hipotézis' }
const STATUS_HU: Record<string, string> = {
  proposed: 'javasolt', monitoring: 'figyelt', confirmed: 'megerősített', rejected: 'elvetett',
}
const SOURCE_HU: Record<string, string> = { chat: 'chat', pattern: 'minta', manual: 'kézi' }

/** A réteg-érés színskála (UI-spec §1) — kizárólag meglévő tokenekből. */
const L0_ACCENT = 'var(--text-tertiary)'
const L0_WASH = 'var(--surface-glass)'
const L1_ACCENT = 'var(--lav-deep)'
const L1_WASH = 'var(--wash-lav)'
const L2_ACCENT = 'var(--warning)'
const L2_WASH = 'color-mix(in srgb, var(--warning) 10%, transparent)'
const L3_ACCENT = 'var(--success)'
const L3_WASH = 'color-mix(in srgb, var(--success) 10%, transparent)'

/** Pulzáló szaggatott vonal a rétegek között — a KÖVETKEZŐ réteg színében (oda folyik az adat), a cron mutatja, MIKOR. */
function FlowConnector({ label, color }: { label: string; color: string }) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 10, paddingLeft: 22 }}>
      <svg width="2" height="28" viewBox="0 0 2 28" aria-hidden="true">
        <line
          x1="1" y1="0" x2="1" y2="28"
          stroke={color} strokeWidth="2" strokeDasharray="4,4"
          className="memory-flow-line"
        />
      </svg>
      <span className="eyebrow text-tertiary" style={{ fontFamily: 'var(--ff-mono)' }}>{label}</span>
    </div>
  )
}

export function MemoryLayersPanel({
  overview, onOpenJournal,
}: { overview: MemoryOverview; onOpenJournal: () => void }) {
  const navigate = useNavigate()
  const { l0, l1, l2, l3, jobs } = overview
  const patternTotal = l2.patterns.reduce((n, p) => n + p.count, 0)
  const factTotal = l3.facts.reduce((n, f) => n + f.count, 0)

  return (
    <div className="col" style={{ gap: 4 }}>
      <MemoryLayerCard
        eyebrow="L0 · Nyers adat"
        title="Mért napok a minta-ablakban"
        big={`${l0.daysWithAnyData}/${l0.windowDays} nap`}
        stats={[`${l0.windowDays} napos ablak`]}
        accent={L0_ACCENT}
        wash={L0_WASH}
      />
      <FlowConnector label={`napi összefoglaló · ${jobs.summaryCron}`} color={L1_ACCENT} />
      <MemoryLayerCard
        eyebrow="L1 · Epizodikus napló"
        title="Éjszakai összefoglalók + vektorok"
        big={`${l1.summaryCount} nap`}
        stats={[
          `${l1.embeddings.dailySummary} nap-vektor`,
          `${l1.embeddings.chatTurn} chat-vektor`,
          l1.firstDate && l1.lastDate ? `${l1.firstDate} – ${l1.lastDate}` : 'még üres',
        ]}
        accent={L1_ACCENT}
        wash={L1_WASH}
        last={l1.lastDate}
        onOpen={onOpenJournal}
      />
      <FlowConnector label={`minta-felismerés · ${jobs.patternCron}`} color={L2_ACCENT} />
      <MemoryLayerCard
        eyebrow="L2 · Ítélet-inbox"
        title="Felismert minták + tényjelöltek"
        big={`${patternTotal} minta`}
        stats={[
          ...l2.patterns.map((p) => `${p.count} ${KIND_HU[p.kind] ?? p.kind} · ${STATUS_HU[p.status] ?? p.status}`),
          `${l2.pendingFactCandidates} függő tényjelölt`,
        ]}
        accent={L2_ACCENT}
        wash={L2_WASH}
        last={jobs.lastDetectedAt ? jobs.lastDetectedAt.slice(0, 10) : null}
        onOpen={() => navigate('/insights')}
      />
      <FlowConnector label={`hipotézis + tudás-promóció · ${jobs.hypothesisCron}`} color={L3_ACCENT} />
      <MemoryLayerCard
        eyebrow="L3 · Tartós tudás"
        title="Megerősített tények"
        big={`${factTotal} tény`}
        stats={[
          ...l3.facts.map((f) => `${f.count} ${SOURCE_HU[f.source] ?? f.source}`),
          `${l3.totalReinforcements}× megerősítés`,
          `${l3.factsInPrompt} a promptban`,
        ]}
        accent={L3_ACCENT}
        wash={L3_WASH}
        onOpen={() => navigate('/insights/knowledge')}
      />
      <Link to="/insights/motor" style={{ fontSize: 12, color: 'var(--lav-deep)', marginTop: 12 }}>
        Miért nem lát még mintát a motor? →
      </Link>
    </div>
  )
}
```

- [ ] **Step 6: `MemoryJournalPanel`**

`frontend/src/features/insights/components/MemoryJournalPanel.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import type { MemorySummaryItem } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', {
    month: 'long', day: 'numeric', weekday: 'long',
  })
}

/** Az L1 napló — memoir-tipográfiájú kártyák hónap-elválasztókkal; a sarok-pötty az embed-jelző. */
export function MemoryJournalPanel({
  summaries, focusDate,
}: { summaries: MemorySummaryItem[]; focusDate?: string | null }) {
  const focusRef = useRef<HTMLDivElement>(null)
  useEffect(() => { focusRef.current?.scrollIntoView({ block: 'center' }) }, [focusDate])

  if (summaries.length === 0) {
    return (
      <GhostState message="Az első éjszakai összefoglaló még nem készült el — a napló éjjelente, magától íródik." />
    )
  }

  let lastMonth = ''
  return (
    <div className="col gap-md">
      {summaries.map((summary) => {
        const month = monthLabel(summary.date)
        const showSeparator = month !== lastMonth
        lastMonth = month
        const focused = summary.date === focusDate
        return (
          <div key={summary.date} className="col gap-md">
            {showSeparator && (
              <span className="eyebrow text-tertiary" style={{ marginTop: 4 }}>{month}</span>
            )}
            <div
              ref={focused ? focusRef : undefined}
              className="card memoir-card"
              style={{
                padding: 18, position: 'relative', overflow: 'hidden',
                border: focused ? '1px solid var(--lav-deep)' : undefined,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', width: 100, height: 100, right: -32, top: -32, borderRadius: '50%',
                  background: 'radial-gradient(circle, color-mix(in srgb, var(--lav) 16%, transparent), transparent 70%)',
                }}
              />
              <span
                aria-label={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
                title={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
                style={{
                  position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%',
                  background: summary.embedded ? 'var(--success)' : 'var(--text-tertiary)', opacity: 0.7,
                }}
              />
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{dayLabel(summary.date)}</span>
              <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 10, color: 'var(--text-primary)' }}>
                {summary.narrative}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: `MemoryPage`**

`frontend/src/features/insights/pages/MemoryPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useMemoryOverview, useMemorySummaries } from '@/data/hooks'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { GhostState } from '@/shared/ui/GhostState'
import { MemoryLayersPanel } from '@/features/insights/components/MemoryLayersPanel'
import { MemoryJournalPanel } from '@/features/insights/components/MemoryJournalPanel'

type MemoryView = 'overview' | 'journal'

export function MemoryPage() {
  const [view, setView] = useStickyTab<MemoryView>('insights.memoria.view', 'overview')
  const { overview, degraded, isPending } = useMemoryOverview()
  const { summaries } = useMemorySummaries()

  if (degraded) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          A társ memóriája most nem elérhető — a rétegek itt jelennek majd meg.
        </p>
        <Link to="/insights/motor" style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
          A minta-motor diagnosztikája →
        </Link>
      </div>
    )
  }
  if (!overview) {
    return isPending ? <GhostState message="A memória-rétegek betöltése…" /> : null
  }

  return (
    <div className="col gap-md">
      <div
        className="row" role="tablist" aria-label="Memória nézetek"
        style={{ background: 'var(--surface-glass)', borderRadius: 12, padding: 3 }}
      >
        <SegButton on={view === 'overview'} onClick={() => setView('overview')}>Áttekintés</SegButton>
        <SegButton on={view === 'journal'} onClick={() => setView('journal')}>Napló</SegButton>
      </div>

      {view === 'overview' && (
        <MemoryLayersPanel overview={overview} onOpenJournal={() => setView('journal')} />
      )}
      {view === 'journal' && <MemoryJournalPanel summaries={summaries} />}
    </div>
  )
}

/** A GrowthPage/FuelSlotsPage szegmens-gomb idiómájának lokális másolata (a bevett norma). */
function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      role="tab" aria-selected={on} onClick={onClick} className="rad-12"
      style={{
        flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: 1,
        textTransform: 'uppercase', padding: '7px 0', borderRadius: 3,
        color: on ? 'var(--lav-deep)' : 'var(--text-tertiary)',
        background: on ? 'var(--wash-lav)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 8: Route + tab + kölcsönös link**

`frontend/src/features/insights/pages/tabs.ts` — az `INSIGHTS_TABS` tömb végére (a `motor` után; a spec „8. chip"-je a Motor tab születése miatt 9. lett):

```ts
  { id: 'memory', to: '/insights/memoria', label: 'Memória' },
```

`frontend/src/app/router.tsx` — import a többi Insights-oldal mellé:

```ts
import { MemoryPage } from '@/features/insights/pages/MemoryPage'
```

és az `insights` `children` tömb végére (a `motor` után):

```tsx
          { path: 'memoria', element: <MemoryPage /> },
```

`frontend/src/features/insights/pages/MotorPage.tsx` — import `Link` a `react-router-dom`-ból (ha még nincs), és a visszaadott `col gap-md` konténer LEGVÉGÉRE (a metrika-lefedettség kártya után) — a spec §3 kölcsönös linkje:

```tsx
      <Link to="/insights/memoria" style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
        Memória-obszervatórium →
      </Link>
```

- [ ] **Step 9: Egészítsd ki a nav-tesztet**

`frontend/src/features/insights/pages/insights.nav.test.tsx` — a real-módú bejárás végére (a Motor-hop után; a dropdown gombjának neve ekkor `Motor`):

```tsx
    // Memória — a memória-obszervatórium tab (mezo-al1i)
    await userEvent.click(screen.getByRole('button', { name: 'Motor' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Memória' }))
    expect(await screen.findByText('L0 · Nyers adat')).toBeInTheDocument()
```

- [ ] **Step 10: Futtasd az érintett teszteket mindkét módban**

```bash
cd frontend && pnpm test src/features/insights && VITE_USE_MOCK=true pnpm test src/features/insights
```

Elvárt: PASS.

- [ ] **Step 11: Teljes FE kapu**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 12: Commit**

```bash
git add frontend/src && git commit -m "feat(insights): /insights/memoria — réteg-folyam + napló nézet (mezo-al1i)"
```

---

## Task 4: Kontraktus ② — hasonló-nap kereső végpont

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MemoryObservatoryService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemorySimilarDaysApiIT.java`

**Interfaces:**
- Consumes: `MemoryRecallService.recallSimilarDays(UUID, String, int) → List<RecalledMemory>` ahol `RecalledMemory(LocalDate occurredOn, String content, double similarity, double score)` · `CompanionProperties.recall().renderMaxChars()` (300).
- Produces: `GET /api/companion/memory/similar-days?q=&k= → SimilarDaysResponse` · `MemoryObservatoryService.similarDays(UUID, String, Integer)`.

- [ ] **Step 1: Bővítsd a kontraktust**

`companion.yml` — a `/api/companion/memory/summary` path-blokk után:

```yaml
  /api/companion/memory/similar-days:
    get:
      tags: [Companion]
      operationId: searchSimilarDays
      summary: >-
        pgvector hasonló-nap kereső (mezo-al1i) — a V2.3 MemoryRecallService változatlan
        újrahasznosítása: embed query → ANN a daily_summary vektorokon → recency re-rank
        (similarity × exp(-age/τ)). A min-similarity küszöb alatti találat itt sem jön vissza
        (őszinte üres lista); a tool és a felület garantáltan ugyanazt a memóriát látja.
      parameters:
        - name: q
          in: query
          required: true
          description: A keresett élmény/téma/állapot szabad szövege.
          schema: { type: string, minLength: 1 }
        - name: k
          in: query
          required: false
          description: Max találat; alapértelmezés 3, a szerver a recall.max-k (5) fölé nem enged.
          schema: { type: integer, minimum: 1, maximum: 5 }
      responses:
        '200':
          description: Hasonló napok (finalScore-desc)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SimilarDaysResponse' }
        '400':
          description: Validation error (üres q, k a határokon kívül)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Companion switched off — the whole surface is absent
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

A `components.schemas` végére:

```yaml
    SimilarDaysResponse:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items: { $ref: '#/components/schemas/SimilarDayItem' }
    SimilarDayItem:
      type: object
      required: [date, excerpt, similarity, finalScore]
      properties:
        date: { type: string, format: date }
        excerpt: { type: string, description: 'A napi narratíva recall.render-max-chars-ra (300) vágva.' }
        similarity: { type: number, format: double, description: 'Nyers koszinusz-egyezés (0..1) — a floor erre vonatkozik.' }
        finalScore: { type: number, format: double, description: 'similarity × exp(-ageDays/decayDays) — a rangsor kulcsa.' }
```

- [ ] **Step 2: Generálj — a fordítás hasaljon el**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw clean compile
```

Elvárt: fordítási hiba — `searchSimilarDays` nincs implementálva.

- [ ] **Step 3: Service-metódus**

`MemoryObservatoryService.java` — új mező a többi alá: `private final MemoryRecallService memoryRecallService;`; importok: `io.mrkuhne.mezo.api.dto.SimilarDayItem`, `io.mrkuhne.mezo.api.dto.SimilarDaysResponse`; a `summaries` metódus után:

```java
    /**
     * A V2.3 recall változatlan újrahasznosítása — a kereső ugyanazt a memóriát látja, mint a
     * {@code find_similar_past_days} tool. Szándékosan NEM @Transactional: az embed hálózati
     * hívása alatt nem tartunk DB-kapcsolatot (a {@link MemoryRecallService} saját indoklása).
     */
    public SimilarDaysResponse similarDays(UUID userId, String query, Integer k) {
        int limit = k != null ? k : 3;
        int renderCap = properties.recall().renderMaxChars();
        List<SimilarDayItem> items = memoryRecallService.recallSimilarDays(userId, query, limit).stream()
                .map(memory -> SimilarDayItem.builder()
                        .date(memory.occurredOn())
                        .excerpt(excerpt(memory.content(), renderCap))
                        .similarity(memory.similarity())
                        .finalScore(memory.score())
                        .build())
                .toList();
        return SimilarDaysResponse.builder().items(items).build();
    }

    /** A tool render-vágásának párja (MemoryTools) — a stored text hosszú, a kártyára kivonat megy. */
    private static String excerpt(String content, int cap) {
        return content.length() > cap ? content.substring(0, cap) + "…" : content;
    }
```

- [ ] **Step 4: Controller**

`CompanionController.java` — import `io.mrkuhne.mezo.api.dto.SimilarDaysResponse`; a `listMemorySummaries` után:

```java
    @Override
    public SimilarDaysResponse searchSimilarDays(String q, Integer k) {
        return memoryObservatoryService.similarDays(currentUserId.get(), q, k);
    }
```

```bash
cd backend && ./mvnw clean compile
```

Elvárt: BUILD SUCCESS.

- [ ] **Step 5: IT a determinisztikus fake-embeddinggel**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemorySimilarDaysApiIT.java` (a `MemoryRecallServiceIT` geometriája HTTP-n át; a `[fake-embed:…]` sentinel a query-ben pontos koszinuszt ad):

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.SimilarDayItem;
import io.mrkuhne.mezo.api.dto.SimilarDaysResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

/** A hasonló-nap kereső HTTP-kontraktusa (mezo-al1i) — rangsor, floor, kivonat-vágás, validáció. */
@ActiveProfiles("companion-fake")
class CompanionMemorySimilarDaysApiIT extends ApiIntegrationTest {

    /** A query fake-embeddingje pontosan a 0. tengely — a koszinusz kézzel számolható. */
    private static final String AXIS0_QUERY = "[fake-embed:1] rossz alvás edzés után";

    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private SimilarDaysResponse search(String q, String kQuery) {
        String encoded = URLEncoder.encode(q, StandardCharsets.UTF_8);
        return getForBody("/api/companion/memory/similar-days?q=" + encoded + kQuery,
                ownerAuthHeaders(), HttpStatus.OK, SimilarDaysResponse.class);
    }

    @Test
    void testSearchSimilarDays_shouldRankBySimilarityAndDropOrthogonal_whenVectorsSeeded() {
        UUID owner = ownerId();
        LocalDate exact = LocalDate.now().minusDays(1);
        LocalDate blend = LocalDate.now().minusDays(3);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, exact, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "kevert nap", blend, MemoryEmbeddingPopulator.blendVector(0, 1));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                LocalDate.now().minusDays(5), 1); // ortogonális — a floor kiejti

        SimilarDaysResponse response = search(AXIS0_QUERY, "&k=5");

        assertThat(response.getItems()).hasSize(2);
        SimilarDayItem first = response.getItems().getFirst();
        assertThat(first.getDate()).isEqualTo(exact);
        assertThat(first.getSimilarity()).isCloseTo(1.0, within(1e-6));
        assertThat(first.getFinalScore()).isLessThanOrEqualTo(first.getSimilarity());
        SimilarDayItem second = response.getItems().get(1);
        assertThat(second.getDate()).isEqualTo(blend);
        assertThat(second.getSimilarity()).isCloseTo(0.7071, within(1e-3));
    }

    @Test
    void testSearchSimilarDays_shouldReturnEmptyList_whenNothingAboveFloor() {
        memoryEmbeddingPopulator.embedding(ownerId(), MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                LocalDate.now().minusDays(2), 1);

        assertThat(search(AXIS0_QUERY, "").getItems()).isEmpty();
    }

    @Test
    void testSearchSimilarDays_shouldCapExcerpt_whenNarrativeLongerThanRenderMax() {
        String longContent = "x".repeat(400);
        memoryEmbeddingPopulator.embedding(ownerId(), MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), longContent, LocalDate.now().minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));

        SimilarDayItem item = search(AXIS0_QUERY, "").getItems().getFirst();

        assertThat(item.getExcerpt()).hasSize(301).endsWith("…");
    }

    @Test
    void testSearchSimilarDays_shouldReturn400_whenQBlankOrKOutOfBounds() {
        exchangeForResponse(org.springframework.http.HttpMethod.GET,
                "/api/companion/memory/similar-days?q=", null, ownerAuthHeaders());
        // a státusz-asszertekhez a nyers exchange kell — mindkét ág 400
        assertThat(exchangeForResponse(org.springframework.http.HttpMethod.GET,
                "/api/companion/memory/similar-days?q=", null, ownerAuthHeaders())
                .getStatusCode().value()).isEqualTo(400);
        assertThat(exchangeForResponse(org.springframework.http.HttpMethod.GET,
                "/api/companion/memory/similar-days?q=valami&k=9", null, ownerAuthHeaders())
                .getStatusCode().value()).isEqualTo(400);
    }
}
```

- [ ] **Step 6: Futtasd**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMemorySimilarDaysApiIT,MemoryRecallServiceIT'
```

Elvárt: PASS. (A `finalScore` a recency-decay miatt mindig ≤ similarity; az 1 napos kor mellett `exp(-1/90) ≈ 0.989`.)

- [ ] **Step 7: Commit**

```bash
git add api/ backend/ frontend/src/data/_client/api.gen.ts && git commit -m "feat(companion): hasonló-nap kereső végpont (mezo-al1i)"
```

---

## Task 5: FE Kereső nézet

**Files:**
- Modify: `frontend/src/data/insights/memory.ts`
- Modify: `frontend/src/data/insights/memoryApi.ts`
- Modify: `frontend/src/data/insights/memoryHooks.ts`
- Modify: `frontend/src/data/hooks.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/features/insights/components/SimilarDayCard.tsx`
- Create: `frontend/src/features/insights/components/MemorySearchPanel.tsx`
- Modify: `frontend/src/features/insights/pages/MemoryPage.tsx`
- Test: `frontend/src/data/insights/memoryHooks.test.tsx` (kiegészítés)
- Test: `frontend/src/features/insights/pages/MemoryPage.test.tsx` (kiegészítés)

**Interfaces:**
- Consumes: `components['schemas']['SimilarDaysResponse']` (Task 4 regen) · a lusta query mintája: `data/me/goalHooks.ts` `useFeasibilityPreview` (raw `useQuery` + `enabled`).
- Produces: `useSimilarDays(query: string) → { results: SimilarDay[] | null, degraded, mode, isFetching }` (üres query ⇒ nem tüzel, `results: null`) · `SimilarDayCard({ day, onPick })` · `MemorySearchPanel({ onPick })` · a `MemoryPage` 3. szegmense + `focusDate` állapot.

- [ ] **Step 1: Bukó hook-teszt a lustaságra**

`memoryHooks.test.tsx` — új describe-ok a fájl végére:

```tsx
describe('useSimilarDays (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('does not fire while the query is empty', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useSimilarDays(''), { wrapper: makeHookWrapper() })

    expect(result.current.results).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('maps results once a query is submitted', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/similar-days`, () =>
        HttpResponse.json({
          items: [{ date: '2026-08-09', excerpt: 'rövid alvás', similarity: 0.81, finalScore: 0.64 }],
        }),
      ),
    )
    const { result } = renderHook(() => useSimilarDays('rossz alvás'), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(result.current.results![0].finalScore).toBe(0.64)
  })

  test('flags degraded on 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/similar-days`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useSimilarDays('bármi'), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
  })
})

describe('useSimilarDays (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the deterministic seed for any submitted query', () => {
    const { result } = renderHook(() => useSimilarDays('fáradt nap'), { wrapper: makeHookWrapper() })
    expect(result.current.results).toHaveLength(3)
    expect(result.current.mode).toBe('mock')
  })
})
```

(Importáld a fájl tetején: `useSimilarDays` a `@/data/insights/memoryHooks`-ból.) Futtasd — bukjon (`useSimilarDays` nem létezik).

- [ ] **Step 2: Seed + API + hook**

`memory.ts` végére — a dátumok szándékosan a napló-seed napjai, így a koppintás létező bejegyzésre ugrik:

```ts
/** A kereső demo-találatai — determinisztikus, a query-től független (demo-világ). */
export const similarDaysSeed: SimilarDay[] = [
  {
    date: '2026-08-09',
    excerpt: 'Pihenőnap volt, de a napzárás elmaradt. Rövidebb alvás (6,1 óra, 2/5) követte…',
    similarity: 0.81,
    finalScore: 0.78,
  },
  {
    date: '2026-07-28',
    excerpt: 'Nehéz munkanap után 40 perces easy futás — a HR-recovery 52 s volt…',
    similarity: 0.64,
    finalScore: 0.54,
  },
  {
    date: '2026-07-21',
    excerpt: 'Deload-hét első napja. Korai lefekvés 22:10-kor, 8,1 óra alvás (5/5)…',
    similarity: 0.52,
    finalScore: 0.41,
  },
]
```

(Bővítsd az importot: `SimilarDay` a `@/data/types`-ból.)

`memoryApi.ts` — a `memoryApi` objektumba:

```ts
  similarDays: async (q: string, k: number): Promise<SimilarDay[]> => {
    const wire = await apiFetch<components['schemas']['SimilarDaysResponse']>(
      `/api/companion/memory/similar-days?q=${encodeURIComponent(q)}&k=${k}`,
    )
    return wire.items.map((i) => ({
      date: i.date, excerpt: i.excerpt, similarity: i.similarity, finalScore: i.finalScore,
    }))
  },
```

(Bővítsd az importot: `SimilarDay`.)

`memoryHooks.ts` — a fájl végére (raw `useQuery` — a `useDualQuery`-nek nincs `enabled` opciója; ez a `useFeasibilityPreview` precedense):

```ts
export interface SimilarDaySearch {
  results: SimilarDay[] | null
  degraded: boolean
  mode: 'mock' | 'live'
}

const SEARCH_EMPTY: SimilarDaySearch = { results: null, degraded: false, mode: 'live' }

/**
 * Lusta hasonló-nap kereső (mezo-al1i) — üres query-vel nem tüzel (a gomb indítja, nem a gépelés).
 * Mock módban determinisztikus seedet ad; 404 (companion off) ⇒ degraded.
 */
export function useSimilarDays(query: string) {
  const mock = isMockMode()
  const enabled = query.trim() !== ''
  const q = useQuery<SimilarDaySearch>({
    queryKey: ['memory', 'similar', query],
    enabled,
    staleTime: mock ? Infinity : 60_000,
    initialData: mock && enabled
      ? { results: similarDaysSeed, degraded: false, mode: 'mock' } : undefined,
    queryFn: mock
      ? async () => ({ results: similarDaysSeed, degraded: false, mode: 'mock' as const })
      : async () => {
          try {
            return { results: await memoryApi.similarDays(query, 3), degraded: false, mode: 'live' as const }
          } catch (e) {
            if (isSwitchedOff(e)) return { results: null, degraded: true, mode: 'live' as const }
            throw e
          }
        },
  })
  return { ...(q.data ?? SEARCH_EMPTY), isFetching: q.isFetching }
}
```

(Új importok a fájl tetején: `useQuery` a `@tanstack/react-query`-ből, `isMockMode` a `@/data/_client/mode`-ból, `similarDaysSeed` a `@/data/insights/memory`-ből, `SimilarDay` a `@/data/types`-ból.)

`hooks.ts` barrel-sor bővítése: `useSimilarDays` hozzáadása a memory-exporthoz.

`test/msw/handlers.ts` — a memory-blokkba:

```ts
  http.get(`${API_BASE}/api/companion/memory/similar-days`, () => HttpResponse.json({ items: [] })),
```

Futtasd a hook-teszteket mindkét módban — PASS.

- [ ] **Step 3: `SimilarDayCard` + `MemorySearchPanel`**

`frontend/src/features/insights/components/SimilarDayCard.tsx` (UI-spec §4 — gyűrű + sáv + matek-chipsor):

```tsx
import type { SimilarDay } from '@/data/types'

const RING_R = 21
const RING_C = 2 * Math.PI * RING_R

function ageDays(date: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000))
}

/**
 * Gazdag találati kártya (UI-spec §4): egyezés-gyűrű + similarity-sáv + memoir-kivonat + a
 * pontszám-matek chipsora (egyezés × frissesség = végső). A frissesség kliens-oldalon számolt
 * (finalScore / similarity — pontosan a szerver decay-szorzója), színe ≥0.9 → success, alatta warning.
 */
export function SimilarDayCard({ day, rank, onPick }: { day: SimilarDay; rank: number; onPick: (date: string) => void }) {
  const freshness = day.similarity === 0 ? 0 : day.finalScore / day.similarity
  const ringColor = rank === 0 ? 'var(--lav-deep)' : 'var(--lav)'
  const freshColor = freshness >= 0.9 ? 'var(--success)' : 'var(--warning)'
  return (
    <div
      className="card np-press" role="button" tabIndex={0}
      style={{ padding: 14, cursor: 'pointer' }}
      onClick={() => onPick(day.date)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(day.date) } }}
    >
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r={RING_R} fill="none" stroke="var(--surface-glass)" strokeWidth="5" />
          <circle
            cx="26" cy="26" r={RING_R} fill="none" stroke={ringColor} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${day.similarity * RING_C} ${RING_C}`} transform="rotate(-90 26 26)"
          />
          <text x="26" y="24" textAnchor="middle" fontSize="12" fontWeight="700" fill={ringColor}
            fontFamily="var(--ff-display)">{Math.round(day.similarity * 100)}%</text>
          <text x="26" y="35" textAnchor="middle" fontSize="6" fontWeight="700" fill="var(--text-tertiary)">EGYEZÉS</text>
        </svg>
        <div style={{ flex: 1 }}>
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{day.date}</span>
          <div className="eyebrow text-tertiary" style={{ marginTop: 3 }}>{ageDays(day.date)} napja</div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div
              className="bar-fill"
              style={{ width: `${Math.round(day.similarity * 100)}%`, background: ringColor }}
            />
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.6, marginTop: 10, color: 'var(--text-primary)', fontFamily: 'var(--ff-display)' }}>
        {day.excerpt}
      </p>
      <div className="row gap-sm" style={{ marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="chip" style={{ fontSize: 9, color: 'var(--lav-deep)' }}>egyezés {day.similarity.toFixed(2)}</span>
        <span className="eyebrow text-tertiary">×</span>
        <span className="chip" style={{ fontSize: 9, color: freshColor }}>frissesség {freshness.toFixed(2)}</span>
        <span className="eyebrow text-tertiary">=</span>
        <span className="chip" style={{ fontSize: 9, color: freshColor, fontWeight: 800 }}>végső {day.finalScore.toFixed(2)}</span>
        <span style={{ flex: 1 }} />
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Napló →</span>
      </div>
    </div>
  )
}
```

`frontend/src/features/insights/components/MemorySearchPanel.tsx`:

```tsx
import { useState } from 'react'
import { useSimilarDays } from '@/data/hooks'
import { CtaPrimary } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { SimilarDayCard } from '@/features/insights/components/SimilarDayCard'

/** Lusta kereső — a query a gombbal (submit) indul, nem gépelésre tüzel (spec §6). */
export function MemorySearchPanel({ onPick }: { onPick: (date: string) => void }) {
  const [draft, setDraft] = useState('')
  const [submitted, setSubmitted] = useState('')
  const { results, degraded, isFetching } = useSimilarDays(submitted)

  return (
    <div className="col gap-md">
      <form
        className="row gap-sm"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(draft.trim()) }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Milyen napot keresel? (pl. rossz alvás edzés után)"
          aria-label="Hasonló nap keresése"
          style={{
            flex: 1, background: 'var(--surface-glass)', border: '1px solid var(--line)',
            borderRadius: 10, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)',
          }}
        />
        <CtaPrimary type="submit" disabled={draft.trim() === ''}>Keresés</CtaPrimary>
      </form>

      {degraded && (
        <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center' }}>
          A memória-kereső most nem elérhető.
        </p>
      )}
      {isFetching && <GhostState message="Keresés a nap-vektorok között…" lines={2} />}
      {!isFetching && results !== null && results.length === 0 && (
        <GhostState message="Nincs elég hasonló nap a memóriában." lines={2} />
      )}
      {!isFetching && results && results.length > 0 && (
        <span className="eyebrow text-tertiary">{results.length} hasonló nap a memóriából</span>
      )}
      {!isFetching && results?.map((day, rank) => (
        <SimilarDayCard key={day.date} day={day} rank={rank} onPick={onPick} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: A `MemoryPage` 3. szegmense + fókusz-ugrás**

`MemoryPage.tsx` módosításai:
- `import { useState } from 'react'` és `import { MemorySearchPanel } from '@/features/insights/components/MemorySearchPanel'`;
- `type MemoryView = 'overview' | 'journal' | 'search'`;
- a komponens elejére: `const [focusDate, setFocusDate] = useState<string | null>(null)`;
- a szegmens-sorba a Napló után: `<SegButton on={view === 'search'} onClick={() => setView('search')}>Kereső</SegButton>`;
- a Napló render-sora `focusDate`-tel: `{view === 'journal' && <MemoryJournalPanel summaries={summaries} focusDate={focusDate} />}`;
- új render-ág:

```tsx
      {view === 'search' && (
        <MemorySearchPanel onPick={(date) => { setFocusDate(date); setView('journal') }} />
      )}
```

- [ ] **Step 5: Oldal-teszt kiegészítés**

`MemoryPage.test.tsx` — a mock-describe-ba:

```tsx
  test('search is lazy, results jump to the journal entry', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Kereső' }))
    expect(screen.queryByText('egyezés 0.81')).not.toBeInTheDocument() // lusta — még nincs találat
    await userEvent.type(screen.getByLabelText('Hasonló nap keresése'), 'rossz alvás')
    await userEvent.click(screen.getByRole('button', { name: 'Keresés' }))
    // a matek-chipsor: egyezés × frissesség = végső (0.78/0.81 ≈ 0.96)
    expect(await screen.findByText('egyezés 0.81')).toBeInTheDocument()
    expect(screen.getByText('frissesség 0.96')).toBeInTheDocument()
    expect(screen.getByText('végső 0.78')).toBeInTheDocument()
    await userEvent.click(screen.getByText('egyezés 0.81'))
    // a koppintás a Napló szegmensre vált, a 08-09-es bejegyzés látszik
    expect(await screen.findByText(/a vasárnap esti mintázat megint kirajzolódott/)).toBeInTheDocument()
  })
```

a real-describe-ba:

```tsx
  test('search renders the honest empty state on no match', async () => {
    renderPage()
    await screen.findByText('L0 · Nyers adat')
    await userEvent.click(screen.getByRole('tab', { name: 'Kereső' }))
    await userEvent.type(screen.getByLabelText('Hasonló nap keresése'), 'teljesen egyedi nap')
    await userEvent.click(screen.getByRole('button', { name: 'Keresés' }))
    expect(await screen.findByText('Nincs elég hasonló nap a memóriában.')).toBeInTheDocument()
  })
```

- [ ] **Step 6: Futtasd mindkét módban + commit**

```bash
cd frontend && pnpm test src/features/insights src/data/insights && VITE_USE_MOCK=true pnpm test src/features/insights src/data/insights
```

```bash
git add frontend/src && git commit -m "feat(insights): memória-kereső nézet (mezo-al1i)"
```

---

## Task 6: Kontraktus ③ — LLM-usage napi rollup

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmDailyAggregate.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmUsageService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MemoryObservatoryService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryLlmUsageApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryLlmUsageDisabledIT.java`

**Interfaces:**
- Consumes: `LlmLogPopulator.logAt(Instant, UUID, CallKind, String, String, int, int, PricingSnapshot, BigDecimal)` · `LlmLogProperties.reportZone()` · `EventPublishingLlmCallRecorder` (bean-jelenlét = a switch állása) · `FeaturesConfiguration.LLM_LOG_SWITCH`.
- Produces: `GET /api/companion/memory/llm-usage?days= → LlmUsageResponse` · `LlmUsageService.perDay(int days) → List<LlmDailyAggregate>` + `LlmUsageService.auditEnabled() → boolean` · `MemoryObservatoryService.llmUsage(Integer)`.

- [ ] **Step 1: Kontraktus**

`companion.yml` — a `/api/companion/memory/similar-days` blokk után:

```yaml
  /api/companion/memory/llm-usage:
    get:
      tags: [Companion]
      operationId: getMemoryLlmUsage
      summary: >-
        LLM-használat napi bontásban (mezo-al1i) — rollup az llm_log_history felett (ADR 0014):
        napi hívás/token/költség + összesen, naptári napok a report-zónában. A teljes táblát
        olvassa (a cron/async sorok created_by-a null — a user-szűrés pont a legdrágább forgalmat
        rejtené el; single-user app, JWT mögött). enabled=false esetén a sorok üresek — a FE
        őszinte „audit kikapcsolva" állapotot mutat.
      parameters:
        - name: days
          in: query
          required: false
          description: Hány naptári napra visszamenőleg (a mai nappal bezárólag); alapértelmezés 30.
          schema: { type: integer, minimum: 1, maximum: 90 }
      responses:
        '200':
          description: Napi rollup + összesen
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LlmUsageResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Companion switched off — the whole surface is absent
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Sémák (a `SimilarDayItem` után; a meglévő llm-usage fragment sémái `LlmUsageSummaryResponse`/`LlmUsagePeriod` — nincs név-ütközés):

```yaml
    LlmUsageResponse:
      type: object
      required: [enabled, perDay, totals]
      properties:
        enabled: { type: boolean, description: 'mezo.feature.llm-log.enabled állása — false esetén a napló nem bővül és a sorok üresek.' }
        perDay:
          type: array
          items: { $ref: '#/components/schemas/LlmUsageDay' }
        totals: { $ref: '#/components/schemas/LlmUsageTotals' }
    LlmUsageDay:
      type: object
      required: [date, calls, inputTokens, outputTokens]
      properties:
        date: { type: string, format: date }
        calls: { type: integer, format: int64, description: 'Minden hívás, a hibásak is (az audit hívást számol).' }
        inputTokens: { type: integer, format: int64, description: 'prompt_tokens összege — a nyers szám, a cached rész is benne.' }
        outputTokens: { type: integer, format: int64, description: 'candidates + thoughts tokenek összege.' }
        costUsd: { type: number, format: double, nullable: true, description: 'null = nincs beárazott sor (ismeretlen ≠ nulla költség).' }
    LlmUsageTotals:
      type: object
      required: [calls, inputTokens, outputTokens]
      properties:
        calls: { type: integer, format: int64 }
        inputTokens: { type: integer, format: int64 }
        outputTokens: { type: integer, format: int64 }
        costUsd: { type: number, format: double, nullable: true }
```

Generálás + „piros" fordítás, mint korábban:

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw clean compile
```

- [ ] **Step 2: Napi rollup a repository-n**

`backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmDailyAggregate.java` (új):

```java
package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Egy naptári nap rollupja az {@code llm_log_history} felett — a memória-obszervatórium Audit
 * nézete olvassa (mezo-al1i). A {@code costUsd} null marad, ha aznap egyetlen beárazott sor sincs
 * (ismeretlen ≠ nulla — a {@link LlmUsageAggregate} elve).
 */
public interface LlmDailyAggregate {

    LocalDate getDay();

    long getCalls();

    long getInputTokens();

    long getOutputTokens();

    BigDecimal getCostUsd();
}
```

`LlmLogRepository.java` — az `aggregateSince` után (natív SQL: a nap-vágás a report-zónában történik; az idézett aliasok a projekció getterjeihez kellenek):

```java
    /** Napi rollup (mezo-al1i) — naptári napok a report-zónában; a SUM a null költséget kihagyja. */
    @Query(value = """
        select (l.created_at at time zone :zone)::date as "day",
               count(*) as "calls",
               coalesce(sum(l.prompt_tokens), 0) as "inputTokens",
               coalesce(sum(coalesce(l.candidates_tokens, 0) + coalesce(l.thoughts_tokens, 0)), 0) as "outputTokens",
               sum(l.cost_usd) as "costUsd"
        from llm_log_history l
        where l.created_at >= :since
        group by 1
        order by 1
        """, nativeQuery = true)
    List<LlmDailyAggregate> aggregatePerDaySince(@Param("since") Instant since, @Param("zone") String zone);
```

(Importok: `java.time.Instant`, `java.util.List` — az `@Query`/`@Param` már ott van.)

- [ ] **Step 3: `LlmUsageService` bővítés**

`LlmUsageService.java` — új mező: `private final ObjectProvider<EventPublishingLlmCallRecorder> auditRecorder;` (import `org.springframework.beans.factory.ObjectProvider`); a `summary()` után:

```java
    /** Az audit-kapcsoló állása — a recorder bean jelenléte MAGA a kapcsoló (nincs @Value). */
    public boolean auditEnabled() {
        return auditRecorder.getIfAvailable() != null;
    }

    /** Az utolsó {@code days} naptári nap (a maival bezárólag) napi rollupja, date-asc. */
    @Transactional(readOnly = true)
    public List<LlmDailyAggregate> perDay(int days) {
        ZoneId zone = llmLogProperties.reportZone();
        Instant since = LocalDate.now(zone).minusDays(days - 1L).atStartOfDay(zone).toInstant();
        return llmLogRepository.aggregatePerDaySince(since, zone.getId());
    }
```

(Importok: `io.mrkuhne.mezo.feature.llmlog.repository.LlmDailyAggregate`, `java.time.Instant`, `java.util.List`.)

- [ ] **Step 4: `MemoryObservatoryService.llmUsage` + controller**

`MemoryObservatoryService.java` — új mező: `private final LlmUsageService llmUsageService;` (import `io.mrkuhne.mezo.feature.llmlog.service.LlmUsageService`, `io.mrkuhne.mezo.feature.llmlog.repository.LlmDailyAggregate`, `io.mrkuhne.mezo.api.dto.LlmUsageDay`, `io.mrkuhne.mezo.api.dto.LlmUsageResponse`, `io.mrkuhne.mezo.api.dto.LlmUsageTotals`, `java.math.BigDecimal`, `java.util.ArrayList`); a `similarDays` után:

```java
    /**
     * Az Audit nézet LLM-rollupja (ADR 0014 v1 fölött). Kikapcsolt audit-lognál a query le sem fut:
     * enabled=false + üres sorok — a FE őszinte „audit kikapcsolva" állapotot mutat (spec §4).
     */
    @Transactional(readOnly = true)
    public LlmUsageResponse llmUsage(Integer days) {
        if (!llmUsageService.auditEnabled()) {
            return LlmUsageResponse.builder()
                    .enabled(false)
                    .perDay(List.of())
                    .totals(LlmUsageTotals.builder()
                            .calls(0L).inputTokens(0L).outputTokens(0L).costUsd(null).build())
                    .build();
        }
        List<LlmUsageDay> perDay = new ArrayList<>();
        long calls = 0;
        long inputTokens = 0;
        long outputTokens = 0;
        BigDecimal cost = null;
        for (LlmDailyAggregate row : llmUsageService.perDay(days != null ? days : 30)) {
            perDay.add(LlmUsageDay.builder()
                    .date(row.getDay())
                    .calls(row.getCalls())
                    .inputTokens(row.getInputTokens())
                    .outputTokens(row.getOutputTokens())
                    .costUsd(row.getCostUsd() == null ? null : row.getCostUsd().doubleValue())
                    .build());
            calls += row.getCalls();
            inputTokens += row.getInputTokens();
            outputTokens += row.getOutputTokens();
            if (row.getCostUsd() != null) {
                cost = (cost == null ? BigDecimal.ZERO : cost).add(row.getCostUsd());
            }
        }
        return LlmUsageResponse.builder()
                .enabled(true)
                .perDay(perDay)
                .totals(LlmUsageTotals.builder()
                        .calls(calls).inputTokens(inputTokens).outputTokens(outputTokens)
                        .costUsd(cost == null ? null : cost.doubleValue())
                        .build())
                .build();
    }
```

`CompanionController.java` — import `io.mrkuhne.mezo.api.dto.LlmUsageResponse`; a `searchSimilarDays` után:

```java
    @Override
    public LlmUsageResponse getMemoryLlmUsage(Integer days) {
        return memoryObservatoryService.llmUsage(days);
    }
```

```bash
cd backend && ./mvnw clean compile
```

Elvárt: BUILD SUCCESS.

- [ ] **Step 5: IT-k**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryLlmUsageApiIT.java` — a tesztkörnyezet `application.yml`-je a switch-et `false`-on hagyja, ezért ez az osztály kapcsolja be (saját cached context, a `NotificationDispatchJobIT` mintája):

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmUsageDay;
import io.mrkuhne.mezo.api.dto.LlmUsageResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/** A napi LLM-rollup HTTP-kontraktusa (mezo-al1i) — napi bontás, null-költség becsülete, ablak. */
@TestPropertySource(properties = "mezo.feature.llm-log.enabled=true")
class CompanionMemoryLlmUsageApiIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private LlmLogProperties llmLogProperties;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private Instant at(LocalDate day, int hour) {
        return day.atTime(hour, 0).atZone(llmLogProperties.reportZone()).toInstant();
    }

    private LlmUsageResponse usage(String query) {
        return getForBody("/api/companion/memory/llm-usage" + query, ownerAuthHeaders(),
                HttpStatus.OK, LlmUsageResponse.class);
    }

    @Test
    void testGetMemoryLlmUsage_shouldRollUpPerCalendarDay_whenRowsLogged() {
        ZoneId zone = llmLogProperties.reportZone();
        LocalDate today = LocalDate.now(zone);
        UUID owner = ownerId();
        llmLogPopulator.logAt(at(today, 10), owner, CallKind.CHAT, "companion", "gemini-2.5-flash",
                100, 40, null, null);
        llmLogPopulator.logAt(at(today, 11), owner, CallKind.CHAT, "companion", "gemini-2.5-flash",
                200, 60, null, new BigDecimal("0.010000"));
        llmLogPopulator.logAt(at(today.minusDays(1), 9), null, CallKind.SMART, "companion",
                "gemini-2.5-pro", 500, 100, null, new BigDecimal("0.020000"));
        llmLogPopulator.logAt(at(today.minusDays(40), 9), owner, CallKind.CHAT, "companion",
                "gemini-2.5-flash", 999, 999, null, new BigDecimal("9.000000"));

        LlmUsageResponse response = usage("?days=30");

        assertThat(response.getEnabled()).isTrue();
        assertThat(response.getPerDay()).hasSize(2); // a 40 napos sor az ablakon kívül
        LlmUsageDay yesterday = response.getPerDay().getFirst(); // date-asc
        assertThat(yesterday.getDate()).isEqualTo(today.minusDays(1));
        assertThat(yesterday.getCalls()).isEqualTo(1L);
        assertThat(yesterday.getInputTokens()).isEqualTo(500L);
        assertThat(yesterday.getOutputTokens()).isEqualTo(100L);
        assertThat(yesterday.getCostUsd()).isEqualTo(0.02);
        LlmUsageDay todayRow = response.getPerDay().get(1);
        assertThat(todayRow.getCalls()).isEqualTo(2L);
        assertThat(todayRow.getInputTokens()).isEqualTo(300L);
        assertThat(todayRow.getOutputTokens()).isEqualTo(100L);
        assertThat(todayRow.getCostUsd()).isEqualTo(0.01); // a null-költségű sor nem nulláz le
        assertThat(response.getTotals().getCalls()).isEqualTo(3L);
        assertThat(response.getTotals().getInputTokens()).isEqualTo(800L);
        assertThat(response.getTotals().getOutputTokens()).isEqualTo(200L);
        assertThat(response.getTotals().getCostUsd()).isEqualTo(0.03);
    }

    @Test
    void testGetMemoryLlmUsage_shouldKeepCostNull_whenNoPricedRowExists() {
        LocalDate today = LocalDate.now(llmLogProperties.reportZone());
        llmLogPopulator.logAt(at(today, 10), ownerId(), CallKind.EMBED_DOC, "companion",
                "gemini-embedding-001", 0, 0, null, null);

        LlmUsageResponse response = usage("");

        assertThat(response.getPerDay().getFirst().getCostUsd()).isNull();
        assertThat(response.getTotals().getCostUsd()).isNull();
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryLlmUsageDisabledIT.java` (a default teszt-configban a switch OFF):

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmUsageResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** llm-log switch OFF (a teszt-default) ⇒ enabled:false + üres sorok, akkor is, ha a tábla nem üres. */
class CompanionMemoryLlmUsageDisabledIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testGetMemoryLlmUsage_shouldReportDisabledAndEmpty_whenLlmLogSwitchOff() {
        llmLogPopulator.log(
                appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId(),
                CallKind.CHAT, "companion", "gemini-2.5-flash", 100, 40);

        LlmUsageResponse response = getForBody("/api/companion/memory/llm-usage",
                ownerAuthHeaders(), HttpStatus.OK, LlmUsageResponse.class);

        assertThat(response.getEnabled()).isFalse();
        assertThat(response.getPerDay()).isEmpty();
        assertThat(response.getTotals().getCalls()).isZero();
        assertThat(response.getTotals().getCostUsd()).isNull();
    }
}
```

- [ ] **Step 6: Futtasd + teljes backend + commit**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMemoryLlmUsageApiIT,CompanionMemoryLlmUsageDisabledIT,LlmUsageIT'
```

```bash
cd backend && ./mvnw clean test
```

```bash
git add api/ backend/ frontend/src/data/_client/api.gen.ts && git commit -m "feat(companion): LLM-usage napi rollup végpont (mezo-al1i)"
```

---

## Task 7: FE Audit nézet — tény-provenancia + token-grafikon

> **A `TokenColumns` megírása ELŐTT hívd meg a `dataviz` skillt** — a grafikon szín/forma szabályait az adja (a `--dv-*` sáv az adatviz-színek helye, ADR 0018 D5).

**Files:**
- Modify: `frontend/src/data/types.ts` (KnowledgeFact bővítés)
- Modify: `frontend/src/data/insights/knowledgeApi.ts`
- Modify: `frontend/src/data/insights/knowledge.ts` (seed bővítés)
- Modify: `frontend/src/data/insights/memory.ts` + `memoryApi.ts` + `memoryHooks.ts` + `frontend/src/data/hooks.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/features/insights/components/TokenColumns.tsx`
- Create: `frontend/src/features/insights/components/MemoryAuditPanel.tsx`
- Modify: `frontend/src/features/insights/pages/MemoryPage.tsx`
- Test: `frontend/src/data/insights/memoryHooks.test.tsx` + `frontend/src/features/insights/pages/MemoryPage.test.tsx` (kiegészítések)

**Interfaces:**
- Consumes: `useKnowledge()` (`@/data/insights/knowledgeHooks` — változatlan) · `components['schemas']['LlmUsageResponse']` (Task 6 regen) · `factCategoryColor` (`@/data/insights/knowledge`).
- Produces: `KnowledgeFact` += `source: FactSource; lastReinforcedAt: string | null` · `useLlmUsage(days = 30) → { usage: MemoryLlmUsage | null, degraded, mode, isPending }` · `TokenColumns({ days, ariaLabel })` · `MemoryAuditPanel()` · a `MemoryPage` 4. szegmense.

- [ ] **Step 1: `KnowledgeFact` bővítés (típus + mapper + seed)**

`frontend/src/data/types.ts` — a `KnowledgeFact` interface-be a `reinforced` után:

```ts
  /** A tény eredete — az Audit nézet provenancia-chipje (a wire-ön V1.1 óta ott van). */
  source: FactSource
  /** Az utolsó megerősítés időpontja (ISO), null ha még sosem erősítették meg újra. */
  lastReinforcedAt: string | null
```

`frontend/src/data/insights/knowledgeApi.ts` — a `toKnowledgeFact` mapperbe:

```ts
    source: w.source as FactSource,
    lastReinforcedAt: w.lastReinforcedAt ?? null,
```

(Import: `FactSource` a `@/data/types`-ból.)

`frontend/src/data/insights/knowledge.ts` — a `facts` seed MINDEN elemébe `source` + `lastReinforcedAt` kerül (a fordító minden kihagyott elemre rámutat). Elosztás: **f8 → `source: 'pattern'` + `patternTitle: 'Késői étkezés ↔ rákövetkező alvásminőség'`**; **f7, f14 → `source: 'manual'`, `lastReinforcedAt: null`**; a többi `source: 'chat'`. `lastReinforcedAt` a magas reinforced-számúaknál friss (pl. f2 → `'2026-08-11T21:05:00Z'`, f5 → `'2026-08-10T20:40:00Z'`, f4 → `'2026-08-09T18:00:00Z'`, f1/f3/f8 → augusztus eleji dátumok), f12/f15 → `null`. Példa (az első három elem):

```ts
  { id: 'f1', text: 'Pull Day-en a Chest Supported Row a key compound', category: 'train', active: true, reinforced: 12, source: 'chat', lastReinforcedAt: '2026-08-05T19:20:00Z' },
  { id: 'f2', text: 'Caffeine cutoff: 14:00 hard limit', category: 'fuel', active: true, reinforced: 23, source: 'chat', lastReinforcedAt: '2026-08-11T21:05:00Z' },
  { id: 'f3', text: 'Reta beadás: hétfő reggel · 7-day kinetic cycle', category: 'health', active: true, reinforced: 11, source: 'chat', lastReinforcedAt: '2026-08-04T08:10:00Z' },
```

Futtasd `cd frontend && pnpm build`-et — ha az MSW `handlers.ts` companion-blokkja vagy bármely teszt `KnowledgeFact`-literált épít, a fordító kilistázza; azokat is egészítsd ki ugyanígy.

- [ ] **Step 2: LLM-usage seed + API + hook**

`memory.ts` végére (import bővítés: `MemoryLlmUsage`):

```ts
/** Az Audit demo LLM-forgalma — 7 nap; a totals a perDay pontos összege. */
export const memoryLlmUsage: MemoryLlmUsage = {
  enabled: true,
  perDay: [
    { date: '2026-08-06', calls: 9, inputTokens: 41200, outputTokens: 6300, costUsd: 0.021 },
    { date: '2026-08-07', calls: 4, inputTokens: 18400, outputTokens: 2900, costUsd: 0.009 },
    { date: '2026-08-08', calls: 12, inputTokens: 55600, outputTokens: 8800, costUsd: 0.028 },
    { date: '2026-08-09', calls: 7, inputTokens: 32800, outputTokens: 5100, costUsd: 0.016 },
    { date: '2026-08-10', calls: 3, inputTokens: 12100, outputTokens: 1800, costUsd: 0.006 },
    { date: '2026-08-11', calls: 11, inputTokens: 50900, outputTokens: 8200, costUsd: 0.026 },
    { date: '2026-08-12', calls: 8, inputTokens: 37300, outputTokens: 5600, costUsd: 0.019 },
  ],
  totals: { calls: 54, inputTokens: 248300, outputTokens: 38700, costUsd: 0.125 },
}
```

`memoryApi.ts` — a `memoryApi` objektumba:

```ts
  llmUsage: async (days: number): Promise<MemoryLlmUsage> => {
    const wire = await apiFetch<components['schemas']['LlmUsageResponse']>(
      `/api/companion/memory/llm-usage?days=${days}`,
    )
    return {
      enabled: wire.enabled,
      perDay: wire.perDay.map((d) => ({
        date: d.date, calls: d.calls, inputTokens: d.inputTokens,
        outputTokens: d.outputTokens, costUsd: d.costUsd ?? null,
      })),
      totals: {
        calls: wire.totals.calls, inputTokens: wire.totals.inputTokens,
        outputTokens: wire.totals.outputTokens, costUsd: wire.totals.costUsd ?? null,
      },
    }
  },
```

(Import bővítés: `MemoryLlmUsage`.)

`memoryHooks.ts` végére:

```ts
export interface MemoryLlmUsageBootstrap {
  usage: MemoryLlmUsage | null
  degraded: boolean
  mode: 'mock' | 'live'
}

const USAGE_MOCK: MemoryLlmUsageBootstrap = { usage: memoryLlmUsage, degraded: false, mode: 'mock' }
const USAGE_EMPTY: MemoryLlmUsageBootstrap = { usage: null, degraded: false, mode: 'live' }

/** Az Audit LLM-rollupja (mezo-al1i) — enabled:false a válaszBAN jön, nem hibaág. */
export function useLlmUsage(days = 30) {
  const { data, isPending } = useDualQuery<MemoryLlmUsageBootstrap>({
    queryKey: ['memory', 'llm-usage', days],
    mockData: USAGE_MOCK,
    realFetch: async () => {
      try {
        return { usage: await memoryApi.llmUsage(days), degraded: false, mode: 'live' as const }
      } catch (e) {
        if (isSwitchedOff(e)) return { ...USAGE_EMPTY, degraded: true }
        throw e
      }
    },
    realEmpty: USAGE_EMPTY,
    realStaleTime: 60_000,
  })
  return { ...data, isPending }
}
```

(Import bővítés: `memoryLlmUsage`, `MemoryLlmUsage`.)

`hooks.ts`: `useLlmUsage` a memory-export sorába. `handlers.ts` a memory-blokkba:

```ts
  http.get(`${API_BASE}/api/companion/memory/llm-usage`, () =>
    HttpResponse.json({
      enabled: false, perDay: [],
      totals: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: null },
    }),
  ),
```

Hook-teszt kiegészítés (`memoryHooks.test.tsx`):

```tsx
describe('useLlmUsage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the disabled default handler honestly', async () => {
    const { result } = renderHook(() => useLlmUsage(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.usage).not.toBeNull())
    expect(result.current.usage!.enabled).toBe(false)
    expect(result.current.usage!.perDay).toHaveLength(0)
    expect(result.current.usage!.totals.costUsd).toBeNull()
  })
})
```

(Import: `useLlmUsage`.)

- [ ] **Step 3: `TokenColumns` (előtte: `dataviz` skill!)**

`frontend/src/features/insights/components/TokenColumns.tsx` — a `SleepChart` oszlop-matematikája, halmozott be/ki tokenekkel, `--dv-*` színekkel:

```tsx
import type { LlmUsageDay } from '@/data/types'

const W = 360
const H = 120
const PAD = 6

/** Napi token-oszlopok — alul a bemenet (dv-lav), felül a kimenet (dv-sage); halmozott skála. */
export function TokenColumns({ days, ariaLabel }: { days: LlmUsageDay[]; ariaLabel: string }) {
  const max = Math.max(1, ...days.map((d) => d.inputTokens + d.outputTokens))
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2
  const stepX = innerW / Math.max(1, days.length)
  const barW = stepX * 0.7

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ width: '100%', height: 'auto' }}>
        {days.map((day, i) => {
          const total = day.inputTokens + day.outputTokens
          const totalH = (total / max) * innerH
          const inH = total === 0 ? 0 : (day.inputTokens / total) * totalH
          const x = PAD + i * stepX + (stepX - barW) / 2
          const yTop = PAD + innerH - totalH
          return (
            <g key={day.date}>
              <rect x={x} y={yTop} width={barW} height={totalH - inH} rx={1.5} fill="var(--dv-sage)" />
              <rect x={x} y={yTop + (totalH - inH)} width={barW} height={inH} rx={1.5} fill="var(--dv-lav)" />
            </g>
          )
        })}
      </svg>
      <div className="row gap-md" style={{ marginTop: 6 }}>
        <span className="eyebrow text-tertiary">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--dv-lav)', marginRight: 5 }} />
          bemenet
        </span>
        <span className="eyebrow text-tertiary">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--dv-sage)', marginRight: 5 }} />
          kimenet
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `MemoryAuditPanel`**

`frontend/src/features/insights/components/MemoryAuditPanel.tsx`:

```tsx
import { useKnowledge, useLlmUsage } from '@/data/hooks'
import { factCategoryColor } from '@/data/insights/knowledge'
import type { FactSource, KnowledgeFact } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { TokenColumns } from '@/features/insights/components/TokenColumns'

/** A csoport-sorrend a bizalmi lánc: beszélgetésből → mintából → kézzel (UI-spec §5). */
const GROUPS: Array<{ source: FactSource; label: string; color: string }> = [
  { source: 'chat', label: 'Chatből tanulta', color: 'var(--lav-deep)' },
  { source: 'pattern', label: 'Mintából promótálva', color: 'var(--success)' },
  { source: 'manual', label: 'Kézzel rögzítve', color: 'var(--text-secondary)' },
]

const fmtCost = (cost: number | null) => (cost == null ? '—' : `$${cost.toFixed(3)}`)
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

function FactProvenanceRow({ fact }: { fact: KnowledgeFact }) {
  return (
    <div className="card" style={{ padding: '12px 12px 12px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: factCategoryColor(fact.category) }} />
      <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)', fontWeight: 500 }}>{fact.text}</p>
      <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center', marginTop: 7 }}>
        <span className="chip" style={{ fontSize: 9 }}>×{fact.reinforced} megerősítve</span>
        <span className="eyebrow text-tertiary">
          {fact.lastReinforcedAt
            ? `utoljára: ${fact.lastReinforcedAt.slice(0, 10)}`
            : 'még nem erősítette meg újra'}
        </span>
      </div>
      {fact.patternTitle && (
        <span className="chip" style={{ fontSize: 9, marginTop: 7, color: 'var(--success)', display: 'inline-block' }}>
          ⧉ minta: {fact.patternTitle}
        </span>
      )}
    </div>
  )
}

/** Audit (UI-spec §5) — 1. mibe kerül (költség-hero), 2. honnan tud a társ (forrás-csoportos provenancia). */
export function MemoryAuditPanel() {
  const { facts, degraded: factsDegraded } = useKnowledge()
  const { usage, degraded: usageDegraded, isPending } = useLlmUsage()

  return (
    <div className="col gap-md">
      {usageDegraded || (!usage && !isPending) ? (
        <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center' }}>
          Az LLM-napló most nem elérhető.
        </p>
      ) : !usage ? (
        <GhostState message="Az LLM-napló betöltése…" lines={2} />
      ) : !usage.enabled ? (
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            Az LLM-hívás audit-napló ki van kapcsolva — nincs mit auditálni.
          </p>
        </div>
      ) : (
        <div className="card col gap-sm" style={{ padding: 14, background: 'var(--wash-lav)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>LLM-használat · 30 nap</span>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, color: 'var(--lav-deep)' }}>
              {fmtCost(usage.totals.costUsd)}
            </span>
          </div>
          <TokenColumns days={usage.perDay} ariaLabel="Napi LLM token-oszlopok" />
          <span className="eyebrow text-tertiary">
            {usage.totals.calls} hívás · bemenet {fmtTokens(usage.totals.inputTokens)} · kimenet{' '}
            {fmtTokens(usage.totals.outputTokens)}
          </span>
        </div>
      )}

      {factsDegraded ? (
        <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center' }}>
          A tudástár most nem elérhető.
        </p>
      ) : facts.length === 0 ? (
        <GhostState message="Még nincs megerősített tény — a Tudástár inboxában születnek." lines={2} />
      ) : (
        GROUPS.map(({ source, label, color }) => {
          const group = facts.filter((fact) => fact.source === source)
          if (group.length === 0) return null
          return (
            <div key={source} className="col gap-sm">
              <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                <span className="eyebrow" style={{ color }}>{label}</span>
                <span className="chip" style={{ fontSize: 9, color }}>{group.length} tény</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>
              {group.map((fact) => (
                <FactProvenanceRow key={fact.id} fact={fact} />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 5: A `MemoryPage` 4. szegmense**

`MemoryPage.tsx`: `type MemoryView = 'overview' | 'journal' | 'search' | 'audit'`; import `MemoryAuditPanel`; a szegmens-sor végére `<SegButton on={view === 'audit'} onClick={() => setView('audit')}>Audit</SegButton>`; új render-ág: `{view === 'audit' && <MemoryAuditPanel />}`.

- [ ] **Step 6: Oldal-teszt kiegészítés**

`MemoryPage.test.tsx` — mock describe:

```tsx
  test('audit renders the cost hero and the source-grouped provenance', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    // 1 · költség-hero
    expect(screen.getByText('$0.125')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Napi LLM token-oszlopok' })).toBeInTheDocument()
    expect(screen.getByText(/54 hívás · bemenet 248\.3k · kimenet 38\.7k/)).toBeInTheDocument()
    // 2 · forrás-csoportok (a seed elosztása: 12 chat · 1 pattern · 2 manual)
    expect(screen.getByText('Chatből tanulta')).toBeInTheDocument()
    expect(screen.getByText('Mintából promótálva')).toBeInTheDocument()
    expect(screen.getByText('Kézzel rögzítve')).toBeInTheDocument()
    expect(screen.getByText('×23 megerősítve')).toBeInTheDocument() // f2
    expect(screen.getByText('⧉ minta: Késői étkezés ↔ rákövetkező alvásminőség')).toBeInTheDocument()
    expect(screen.getAllByText('még nem erősítette meg újra').length).toBeGreaterThan(0) // null lastReinforcedAt sorok
  })
```

real describe:

```tsx
  test('audit shows the honest disabled state when the llm-log switch is off', async () => {
    renderPage()
    await screen.findByText('L0 · Nyers adat')
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    expect(
      await screen.findByText(/Az LLM-hívás audit-napló ki van kapcsolva/),
    ).toBeInTheDocument()
  })
```

- [ ] **Step 7: Teljes FE kapu + commit**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

```bash
git add frontend/src && git commit -m "feat(insights): audit nézet — tény-provenancia + token-grafikon (mezo-al1i)"
```

---

## Task 8: Dokumentáció + záró kapuk + PR

**Files:**
- Modify: `docs/features/insights.md`
- Modify: `docs/features/companion.md`

- [ ] **Step 1: `docs/features/insights.md`**

A meglévő szerkezetbe illesztve:
- a tab-táblába a **9. tab: `memory` → `/insights/memoria` → `Memória` → `MemoryPage`** (mindkét módban látszik; a spec „8. chipje" a Motor tab miatt lett 9.);
- új §2.9 a `MemoryPage`-ről: a 4 szegmens (`useStickyTab('insights.memoria.view')`), az Áttekintés réteg-folyama (4 kártya + cron-feliratú pulzáló konnektorok, `prefers-reduced-motion` guard), a Napló memoir-kártyái + embed-pötty + hónap-elválasztók, a Kereső lusta submitje + `cos · végső` kettős pontszám + koppintásra napló-ugrás, az Audit provenancia-sorai + `TokenColumns` + az `enabled:false` őszinte állapot; a degraded ág (companion off 404);
- a fájltérképbe: `pages/MemoryPage.tsx`, `components/Memory{LayerCard,LayersPanel,JournalPanel,SearchPanel,AuditPanel}.tsx`, `components/SimilarDayCard.tsx`, `components/TokenColumns.tsx`, `data/insights/memory{,Api,Hooks}.ts`;
- a `MotorPage` leírásához: kölcsönös link a Memória tabbal;
- a `KnowledgeFact` FE-típus `source`/`lastReinforcedAt` bővítése (a wire eddig is hozta, most a mapper is olvassa).

- [ ] **Step 2: `docs/features/companion.md`**

- Új bekezdés (a pattern-monitor blokk mintájára): **Memória-obszervatórium (`mezo-al1i`)** — 4 read-only `GET /api/companion/memory/*` végpont (`overview` / `summary` / `similar-days` / `llm-usage`) a `MemoryObservatoryService`-en; az L0 a monitor sorozat-cache idiómája; a kereső a `MemoryRecallService` változatlan újrahasznosítása (tool és UI ugyanazt a memóriát látja); az llm-usage a `LlmUsageService.perDay` napi natív rollupja, `enabled=false`-nál üres sorok; nincs új tábla/migráció.
- Az endpoint-felsorolásba a 4 új végpont `200 · 401 · 404` jelzéssel.
- Jegyezd fel: a `lastDetectedAt` a jobs-blokkban ugyanaz a „utolsó FELISMERÉS, nem utolsó futás" szemantika, mint a monitor `lastRunAt`-ja.

- [ ] **Step 3: Doc-lint + teljes kapusor**

```bash
node scripts/lint-docs.mjs
```

```bash
cd backend && ./mvnw clean test
```

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 4: Commit + push + self-PR**

```bash
git add docs && git commit -m "docs(insights,companion): memória-obszervatórium (mezo-al1i)" && git push -u origin HEAD
```

```bash
gh pr create --title "feat(insights): Memória-obszervatórium — /insights/memoria + 4 memory végpont (mezo-al1i)" --body "$(cat <<'EOF'
## Mit

Új „Memória" Insights-tab 4 nézettel + 4 read-only companion memory végpont.

- **Áttekintés:** L0→L3 réteg-folyam dashboard (élő számok, cron-feliratú animált konnektorok)
- **Napló:** az L1 napi összefoglalók memoir-kártyákon, embed-jelzővel
- **Kereső:** pgvector hasonló-nap keresés a V2.3 `MemoryRecallService` újrahasznosításával — `cos · végső` kettős pontszám, őszinte üres lista a floor alatt
- **Audit:** tény-provenancia (forrás-chip, ×N, utolsó megerősítés) + napi LLM token/költség rollup az `llm_log_history` felett

Nincs új DB-tábla, nincs írás — minden végpont read-only. A `KnowledgeFactResponse.lastReinforcedAt` már a dróton volt; a FE mapper most már olvassa.

Spec: `docs/superpowers/specs/2026-08-11-memory-observatory-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Utána: `gh pr checks --watch` — **CI zöld** a merge feltétele.

- [ ] **Step 5: Merge + zárás (csak zöld CI után)**

A `<branch>` helyére a feature-ág neve (`git rev-parse --abbrev-ref HEAD` a merge ELŐTT):

```bash
git checkout main && git pull --rebase && git merge --no-ff <branch> && git push && bd close mezo-al1i
```

```bash
bd dolt push && git status
```

Elvárt: `git status` „up to date with origin".

---

## Self-Review

**Spec-lefedettség:** §3 elhelyezés (9. chip, `MemoryPage`, lokális szegmens-váltó, kölcsönös Motor-link) → Task 3 · §4 kontraktus: overview+summary → Task 1 Step 1, similar-days → Task 4 Step 1, llm-usage → Task 6 Step 1, `lastReinforcedAt` → már a dróton (felderítés), FE-oldala Task 7 Step 1 · §5 backend: `MemoryObservatoryService` + hiányzó count-metódusok → Task 1, recall-újrahasznosítás → Task 4, llm-rollup + `enabled` → Task 6 · §6 FE: Áttekintés+Napló → Task 3, Kereső (lusta) → Task 5, Audit (+`dataviz` skill) → Task 7, hookok + degraded → Task 2/5/7 · §7 tesztek: overview populált/üres → Task 1 Step 7, tartomány-szűrés → Task 1, determinisztikus fake-embedding → Task 4 Step 5, llm-rollup + disabled ág → Task 6 Step 5, switch-off 404 → Task 1 (`CompanionMemorySwitchOffIT` + `CompanionApiSwitchOffIT` bővítés), FE render/lusta/degraded → Task 3/5/7 tesztjei · §8 docs → Task 8 · §2 nem-cél (embedding-térkép, chat-turn lista, írás) → egyik task sem nyúl hozzá.

**Típus-konzisztencia:** a wire mezőnevek (`daysWithAnyData`, `pendingFactCandidates`, `finalScore`, `perDay`, `enabled`…) azonosak a YAML-ben, a Java builderekben, a TS domain típusokban és a tesztek asszertjeiben. A `RecalledMemory.score` → wire `finalScore` átnevezés egyetlen helyen, a Task 4 service-mapperében történik. A `FactSource` ('chat'|'pattern'|'manual') azonos a YAML patternnel és a `KnowledgeFactEntity.SOURCE_*` konstansokkal. A hook-visszatérések (`overview`/`summaries`/`results`/`usage` + `degraded` + `mode`) végig egyeznek a panelek fogyasztásával.

**Ismert érzékeny pontok (a végrehajtónak):**
- A Task 1 L0-asszertje (2 nap) az alvás-populátor két napjára épül — ha más metrikát is vetsz, az unió nő.
- A Task 3/5/7 oldal-tesztjei a Task 2/5/7 seed-literálok KONKRÉT értékeire épülnek (47/60, ×23, $0.125, egyezés 0.81 / frissesség 0.96) — seed-módosításkor vezesd át.
- A vizuális részletek (réteg-színek, kártya-anatómiák, copy) forrása a UI-spec (`2026-08-14-memory-observatory-ui-design.md`) + a mockup HTML — eltérés esetén az a mérvadó.
- A `useStickyTab` sessionStorage-t használ; a teszt-setup üríti, de manuális teszteléskor a szegmens „ragad".
- A Task 6 natív query idézett aliasai (`"inputTokens"`) kellenek a projekció-getterekhez — ne írd kisbetűsre.
- A nav-teszt bővítése feltételezi, hogy a Motor-hop az utolsó a meglévő bejárásban — ha közben más tab került a végére, a gomb neve (`name: 'Motor'`) változik.
