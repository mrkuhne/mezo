# W2.6 Tudástár Kapcsolatok surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real "Kapcsolatok" section to the Me→Tudás page (`KnowledgePage.tsx`) that shows
active knowledge-graph nodes (from W2.1–W2.5, `mezo-b3pp.6/.7/.8/.9/.10`) grouped by kind, each
with its strongest touching edges rendered as Hungarian text lines, plus an archive action per
node — bd `mezo-b3pp.11`, spec §6.6.

**Architecture:** The read/archive backend plumbing (`GET /api/companion/graph/node`,
`POST /api/companion/graph/node/{id}/archive`, `GraphNodeResponse`) already exists from W2.1 — this
slice (1) extracts the Hungarian edge-line renderer that W2.4's `GraphPromptAssembler` already has
into a small shared class so the prompt block and this new REST field render identically off one
source of truth, (2) adds a `topEdges: string[]` field to `GraphNodeResponse` computed by a new
`GraphService.listActiveWithTopEdges` method (top-3-by-weight edges per node, both directions,
archived/candidate endpoints excluded), and (3) builds the FE surface: a new dual-mode
`useKnowledgeGraphNodes`/`useKnowledgeGraphActions` hook pair plus a "Kapcsolatok" section in
`KnowledgePage.tsx`. No graph **visualization** — text lines only (spec §12, `mezo-2m4` stays
parked).

**Tech Stack:** Spring Boot (Java 21), JPA/Hibernate, PostgreSQL; React + TanStack Query
(`useDualQuery`), MSW for FE tests, Vitest + Testing Library, contract-first OpenAPI
(`api/feature/knowledge-graph/knowledge-graph.yml`).

## Global Constraints

- Contract-first: the `topEdges` field is added to the YAML fragment before any code references
  it; regenerate both backend (`api/generate`) and FE (`pnpm generate:api`) types.
- Every LLM/embed call site must be `LlmCallContextHolder`-tagged — **not applicable here**, this
  slice adds no LLM/embed call (pure read + rendering).
- Integration-first tests for backend behavior; new/changed FE data hooks get MSW-backed tests in
  both mock and real mode (the `useLifeEventCandidates` idiom in `graphHooks.test.tsx`).
- `topEdges` is capped at **3 lines per node**, weight-descending — a fixed UI display constant,
  not a new `CompanionProperties.Graph` tuning knob (this is presentation, not graph behavior).
- Docs updated in this same change: `docs/features/companion.md` (REST endpoint + new W2.6
  subsection) and `docs/features/me.md` (Tudás table row + `Tudás` page description + the
  "mock-only" gotcha line); `node scripts/lint-docs.mjs` must pass with no new staleness.
- Frontend: new data hooks live in `data/insights/graphHooks.ts` / `data/insights/graphApi.ts`
  (existing files from W2.3), re-exported through the `@/data/hooks` barrel; new UI component
  under `features/me/components/`, following the existing `KnowledgeFactCard`/`CategoryHeader`
  Napiv row-card idiom (`var(--surface)` + `var(--np-shadow-row)`, no left accent bar).

---

## File Structure

- Modify: `api/feature/knowledge-graph/knowledge-graph.yml` — add `GraphNodeResponse.topEdges`.
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRenderer.java`
  — the shared Hungarian line renderer (extracted from `GraphPromptAssembler`).
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromptAssembler.java`
  — delegates line rendering to `GraphEdgeLineRenderer`.
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphService.java`
  — add `listActiveWithTopEdges`.
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/controller/GraphController.java`
  — `listGraphNodes()` uses the new service method and sets `topEdges`.
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRendererTest.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphServiceIT.java` — add
  `listActiveWithTopEdges` coverage.
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphApiIT.java` — add
  `topEdges`-in-response coverage.
- Modify: `frontend/src/data/types.ts` — add `GraphNodeKind`, `KnowledgeGraphNode`.
- Modify: `frontend/src/data/insights/graph.ts` — add `graphNodeSeed`, `GRAPH_KIND_GROUPS`.
- Modify: `frontend/src/data/insights/graphApi.ts` — add `toKnowledgeGraphNode`, `listNodes`,
  `archiveNode`.
- Modify: `frontend/src/data/insights/graphHooks.ts` — add `useKnowledgeGraphNodes`,
  `useKnowledgeGraphActions`.
- Modify: `frontend/src/data/hooks.ts` — re-export the two new hooks.
- Modify: `frontend/src/data/insights/graphHooks.test.tsx` — mock/real/404/archive coverage.
- Create: `frontend/src/features/me/components/KnowledgeGraphNodeCard.tsx`.
- Modify: `frontend/src/features/me/pages/KnowledgePage.tsx` — add the "Kapcsolatok" section.
- Modify: `frontend/src/features/me/pages/KnowledgePage.test.tsx` — cover the new section +
  archive interaction.
- Modify: `docs/features/companion.md`, `docs/features/me.md`.

---

### Task 1: Contract — `GraphNodeResponse.topEdges`

**Files:**
- Modify: `api/feature/knowledge-graph/knowledge-graph.yml`

**Interfaces:**
- Produces: `GraphNodeResponse.topEdges: string[]` (generated getter/setter
  `getTopEdges()`/`setTopEdges(List<String>)` on the Java DTO; generated FE type
  `components['schemas']['GraphNodeResponse']['topEdges']`).

- [ ] **Step 1: Add the field to the schema**

In `api/feature/knowledge-graph/knowledge-graph.yml`, inside `GraphNodeResponse.properties`, add
(after `proposedEdgeCount`):

```yaml
        topEdges:
          type: array
          items: { type: string }
          description: >-
            Up to 3 Hungarian text lines for this node's strongest touching edges, weight-desc
            (W2.6, mezo-b3pp.11) — "<cause> → <verb> → <effect> · <erős|közepes|gyenge>", the same
            renderer the [Összefüggések] prompt block uses. Empty for candidates and nodes with no
            edges.
```

- [ ] **Step 2: Regenerate backend + frontend API types**

Run:
```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

- [ ] **Step 3: Verify generated code picked up the field**

Run: `grep -n "topEdges" backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/GraphNodeResponse.java frontend/src/data/_client/api.gen.ts`

Expected: matches in both files (`private List<String> topEdges = new ArrayList<>();` /
`setTopEdges` in the Java file; a `topEdges?: string[]` property in the generated FE type).

- [ ] **Step 4: Commit**

```bash
git add api/feature/knowledge-graph/knowledge-graph.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): add GraphNodeResponse.topEdges to the knowledge-graph contract (mezo-b3pp.11)"
```

(The regenerated backend sources under `backend/target/` are build output and are not committed —
confirm with `git status` that nothing under `backend/target/` is staged.)

---

### Task 2: Backend — extract `GraphEdgeLineRenderer`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRenderer.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromptAssembler.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRendererTest.java`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `GraphEdgeLineRenderer.renderLine(String kind, String fromTitle, String toTitle,
  BigDecimal weight): String` — package-private static method, same package as `GraphService`/
  `GraphPromptAssembler` (`io.mrkuhne.mezo.feature.companion.graph.service`). Task 3 calls this.

This task moves `GraphPromptAssembler`'s `KIND_VERBS` map, `strength(weight)`, and the
`PRECEDED_BY`-swap "cause/effect" logic into a new standalone class, so both the prompt block
(existing) and the new REST `topEdges` field (Task 3) render identically off one source of truth.
`GraphPromptAssembler`'s own behavior and its existing test
(`GraphPromptAssemblerTest.java`) must be unchanged after this refactor — it is a pure extraction.

- [ ] **Step 1: Write the failing test for the new class**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRendererTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class GraphEdgeLineRendererTest {

    @Test
    void testRenderLine_shouldRenderCauseVerbEffectAndStrength() {
        String line = GraphEdgeLineRenderer.renderLine(
            GraphEdgeEntity.KIND_TRIGGERS, "Késői evés", "Rossz alvás", new BigDecimal("0.800"));

        assertThat(line).isEqualTo("Késői evés → kiváltja → Rossz alvás · erős");
    }

    @Test
    void testRenderLine_shouldSwapEndpoints_whenKindIsPrecededBy() {
        // stored: Stressz PRECEDED_BY Költözés => Költözés happened first => it leads the line
        String line = GraphEdgeLineRenderer.renderLine(
            GraphEdgeEntity.KIND_PRECEDED_BY, "Stressz", "Költözés", new BigDecimal("0.800"));

        assertThat(line).isEqualTo("Költözés → megelőzte → Stressz · erős");
    }

    @Test
    void testStrength_shouldBucketWeightIntoThreeHungarianWords() {
        assertThat(GraphEdgeLineRenderer.strength(new BigDecimal("0.700"))).isEqualTo("erős");
        assertThat(GraphEdgeLineRenderer.strength(new BigDecimal("0.350"))).isEqualTo("közepes");
        assertThat(GraphEdgeLineRenderer.strength(new BigDecimal("0.100"))).isEqualTo("gyenge");
        assertThat(GraphEdgeLineRenderer.strength(null)).isEqualTo("gyenge");
    }

    @Test
    void testRenderLine_shouldFallBackToRawKind_whenKindUnknown() {
        String line = GraphEdgeLineRenderer.renderLine("MADE_UP", "A", "B", new BigDecimal("0.500"));

        assertThat(line).isEqualTo("A → MADE_UP → B · közepes");
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && ./mvnw -q -pl . test -Dtest=GraphEdgeLineRendererTest`
Expected: FAIL — compile error, `GraphEdgeLineRenderer` does not exist yet.

- [ ] **Step 3: Create `GraphEdgeLineRenderer`**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRenderer.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import java.math.BigDecimal;
import java.util.Map;

/**
 * The Hungarian "cause → verb → effect · strength" edge-line format — extracted out of
 * {@link GraphPromptAssembler} (W2.4, mezo-b3pp.9) so the `[Összefüggések]` prompt block and the
 * W2.6 (mezo-b3pp.11) `GraphNodeResponse.topEdges` REST field render identically off one source
 * of truth. Package-private: only {@link GraphPromptAssembler} and {@link GraphService} call it.
 */
final class GraphEdgeLineRenderer {

    private GraphEdgeLineRenderer() {
    }

    /** Hungarian relation verb per edge kind — unknown kinds fall back to the raw kind. */
    static final Map<String, String> KIND_VERBS = Map.of(
            GraphEdgeEntity.KIND_TRIGGERS, "kiváltja",
            GraphEdgeEntity.KIND_PRECEDED_BY, "megelőzte",
            GraphEdgeEntity.KIND_SUPPORTS, "támogatja",
            GraphEdgeEntity.KIND_CONFLICTS, "ütközik vele",
            GraphEdgeEntity.KIND_RELATES_TO, "kapcsolódik");

    /** Weight → coarse Hungarian strength word; the model/UI reads words better than 0.437. */
    static String strength(BigDecimal weight) {
        double w = weight == null ? 0 : weight.doubleValue();
        return w >= 0.7 ? "erős" : w >= 0.35 ? "közepes" : "gyenge";
    }

    /**
     * Renders one line, cause-first. {@code PRECEDED_BY} stores the opposite direction — {@code
     * from PRECEDED_BY to} means the TO-node happened first — so its endpoints are SWAPPED here;
     * no other kind is swapped.
     */
    static String renderLine(String kind, String fromTitle, String toTitle, BigDecimal weight) {
        boolean swap = GraphEdgeEntity.KIND_PRECEDED_BY.equals(kind);
        String cause = swap ? toTitle : fromTitle;
        String effect = swap ? fromTitle : toTitle;
        return cause + " → " + KIND_VERBS.getOrDefault(kind, kind) + " → " + effect + " · " + strength(weight);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw -q -pl . test -Dtest=GraphEdgeLineRendererTest`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `GraphPromptAssembler.renderBlock` to delegate**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromptAssembler.java`,
replace the `KIND_VERBS`/`strength` fields and the inline cause/effect construction in
`renderBlock` with a call to the new class. Replace:

```java
    /** Hungarian relation verb per edge kind — unknown kinds fall back to the raw kind. The
     *  PRECEDED_BY verb reads the edge BACKWARDS on purpose; see {@link #renderBlock}. */
    static final Map<String, String> KIND_VERBS = Map.of(
            GraphEdgeEntity.KIND_TRIGGERS, "kiváltja",
            GraphEdgeEntity.KIND_PRECEDED_BY, "megelőzte",
            GraphEdgeEntity.KIND_SUPPORTS, "támogatja",
            GraphEdgeEntity.KIND_CONFLICTS, "ütközik vele",
            GraphEdgeEntity.KIND_RELATES_TO, "kapcsolódik");
```

with nothing (delete it — moved to `GraphEdgeLineRenderer.KIND_VERBS`), and replace the body of
`renderBlock`'s loop:

```java
        for (NeighborEdge edge : edges) {
            boolean swap = GraphEdgeEntity.KIND_PRECEDED_BY.equals(edge.kind());
            String cause = swap ? edge.toTitle() : edge.fromTitle();
            String effect = swap ? edge.fromTitle() : edge.toTitle();
            String line = "- " + cause + " → " + KIND_VERBS.getOrDefault(edge.kind(), edge.kind())
                    + " → " + effect + " · " + strength(edge.weight()) + '\n';
            if (estimateTokens(block.length() + line.length()) > maxTokens) {
                break;
            }
            block.append(line);
            rendered.add(edge);
        }
```

with:

```java
        for (NeighborEdge edge : edges) {
            String line = "- " + GraphEdgeLineRenderer.renderLine(
                    edge.kind(), edge.fromTitle(), edge.toTitle(), edge.weight()) + '\n';
            if (estimateTokens(block.length() + line.length()) > maxTokens) {
                break;
            }
            block.append(line);
            rendered.add(edge);
        }
```

Delete the now-unused `strength(BigDecimal weight)` static method at the bottom of the class (its
body moved to `GraphEdgeLineRenderer.strength`). Remove the now-unused `Map` import if no other
member of the class needs it (check remaining usages first — `import java.util.Map;` at the top).

- [ ] **Step 6: Run the existing `GraphPromptAssembler` tests to confirm no regression**

Run: `cd backend && ./mvnw -q -pl . test -Dtest=GraphPromptAssemblerTest`
Expected: PASS (all 3 pre-existing tests, unchanged assertions).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRenderer.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromptAssembler.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphEdgeLineRendererTest.java
git commit -m "refactor(companion): extract GraphEdgeLineRenderer out of GraphPromptAssembler (mezo-b3pp.11)"
```

---

### Task 3: Backend — `GraphService.listActiveWithTopEdges` + controller wiring

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/controller/GraphController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphServiceIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphApiIT.java`

**Interfaces:**
- Consumes: `GraphEdgeLineRenderer.renderLine(...)` (Task 2); `GraphNodeResponse.setTopEdges(List<String>)`
  (Task 1, generated).
- Produces: `GraphService.NodeWithTopEdges(GraphNodeEntity node, List<String> topEdgeLines)` record;
  `GraphService.listActiveWithTopEdges(UUID userId): List<NodeWithTopEdges>`.

- [ ] **Step 1: Write the failing IT for the new service method**

In `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphServiceIT.java`, add
(imports: add `java.math.BigDecimal` is already imported; add
`io.mrkuhne.mezo.feature.companion.graph.service.GraphService.NodeWithTopEdges` — no new import
needed, referenced via `GraphService.NodeWithTopEdges`):

```java
    @Test
    void testListActiveWithTopEdges_shouldRenderTop3EdgesByWeightDesc_perNode() {
        UUID owner = ownerId();
        GraphNodeEntity lateEating = nodeRepository.saveAndFlush(newNode(owner, "Késői evés"));
        GraphNodeEntity badSleep = nodeRepository.saveAndFlush(newNode(owner, "Rossz alvás"));
        GraphNodeEntity weakWorkout = nodeRepository.saveAndFlush(newNode(owner, "Gyenge edzés"));
        GraphNodeEntity unrelated = nodeRepository.saveAndFlush(newNode(owner, "Független csomópont"));
        service.upsertEdge(owner, lateEating.getId(), badSleep.getId(), GraphEdgeEntity.KIND_TRIGGERS,
            new BigDecimal("0.800"), null);
        service.upsertEdge(owner, badSleep.getId(), weakWorkout.getId(), GraphEdgeEntity.KIND_SUPPORTS,
            new BigDecimal("0.400"), null);

        List<GraphService.NodeWithTopEdges> result = service.listActiveWithTopEdges(owner);

        GraphService.NodeWithTopEdges badSleepResult = result.stream()
            .filter(nwe -> nwe.node().getId().equals(badSleep.getId())).findFirst().orElseThrow();
        // badSleep touches BOTH edges (incoming from lateEating, outgoing to weakWorkout) —
        // weight-desc order.
        assertThat(badSleepResult.topEdgeLines()).containsExactly(
            "Késői evés → kiváltja → Rossz alvás · erős",
            "Rossz alvás → támogatja → Gyenge edzés · közepes");

        GraphService.NodeWithTopEdges unrelatedResult = result.stream()
            .filter(nwe -> nwe.node().getId().equals(unrelated.getId())).findFirst().orElseThrow();
        assertThat(unrelatedResult.topEdgeLines()).isEmpty();
    }

    @Test
    void testListActiveWithTopEdges_shouldCapAtThreeLines_andExcludeEdgesToArchivedNodes() {
        UUID owner = ownerId();
        GraphNodeEntity hub = nodeRepository.saveAndFlush(newNode(owner, "Központ"));
        GraphNodeEntity archived = service.upsertNode(owner, GraphNodeEntity.KIND_PATTERN,
            "Archivált szomszéd.", null, null, null, null, null);
        service.archive(owner, archived.getId());
        for (int i = 0; i < 4; i++) {
            GraphNodeEntity neighbor = nodeRepository.saveAndFlush(newNode(owner, "Szomszéd " + i));
            service.upsertEdge(owner, hub.getId(), neighbor.getId(), GraphEdgeEntity.KIND_RELATES_TO,
                new BigDecimal("0." + (100 * (i + 1))), null);
        }
        service.upsertEdge(owner, hub.getId(), archived.getId(), GraphEdgeEntity.KIND_RELATES_TO,
            new BigDecimal("0.999"), null);

        GraphService.NodeWithTopEdges hubResult = service.listActiveWithTopEdges(owner).stream()
            .filter(nwe -> nwe.node().getId().equals(hub.getId())).findFirst().orElseThrow();

        assertThat(hubResult.topEdgeLines()).hasSize(3);
        assertThat(hubResult.topEdgeLines()).noneMatch(line -> line.contains("Archivált szomszéd"));
        // strongest surviving 3 of the 4 non-archived edges (weights .400/.300/.200), weight-desc.
        assertThat(hubResult.topEdgeLines().get(0)).contains("Szomszéd 3");
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && ./mvnw -q -pl . test -Dtest=GraphServiceIT`
Expected: FAIL — compile error, `listActiveWithTopEdges`/`NodeWithTopEdges` do not exist yet.

- [ ] **Step 3: Implement `GraphService.listActiveWithTopEdges`**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphService.java`, add
imports (`java.util.ArrayList`, `java.util.Comparator`, `java.util.HashMap`,
`java.util.stream.Collectors` alongside the existing `java.util.Map`/`java.util.List`), and add
after `listActive`:

```java
    /** Fixed UI display cap — not a {@code CompanionProperties.Graph} tuning knob, this is
     *  presentation, not graph behavior. */
    private static final int TOP_EDGES_PER_NODE = 3;

    /** W2.6 (mezo-b3pp.11, spec §6.6): one active node + its strongest touching edges,
     *  pre-rendered as Hungarian text lines for the Tudástár "Kapcsolatok" surface. */
    public record NodeWithTopEdges(GraphNodeEntity node, List<String> topEdgeLines) {
    }

    /**
     * Active nodes plus each node's top-{@value #TOP_EDGES_PER_NODE} touching edges (both
     * directions), rendered via {@link GraphEdgeLineRenderer} — the same renderer {@code
     * GraphPromptAssembler} uses for the {@code [Összefüggések]} prompt block. An edge whose
     * OTHER endpoint is archived/candidate/deleted is dropped entirely: a line that names a node
     * no longer in "current knowledge" would confuse the surface, not inform it.
     */
    @Transactional(readOnly = true)
    public List<NodeWithTopEdges> listActiveWithTopEdges(UUID userId) {
        List<GraphNodeEntity> nodes = listActive(userId);
        if (nodes.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> titleById = nodes.stream()
            .collect(Collectors.toMap(GraphNodeEntity::getId, GraphNodeEntity::getTitle));
        Map<UUID, List<GraphEdgeEntity>> touchingByNode = new HashMap<>();
        for (GraphEdgeEntity edge : edgeRepository.findByCreatedByAndDeletedFalse(userId)) {
            if (!titleById.containsKey(edge.getFromNodeId()) || !titleById.containsKey(edge.getToNodeId())) {
                continue;
            }
            touchingByNode.computeIfAbsent(edge.getFromNodeId(), k -> new ArrayList<>()).add(edge);
            touchingByNode.computeIfAbsent(edge.getToNodeId(), k -> new ArrayList<>()).add(edge);
        }
        return nodes.stream()
            .map(node -> new NodeWithTopEdges(node, topEdgeLines(node.getId(), touchingByNode, titleById)))
            .toList();
    }

    private List<String> topEdgeLines(UUID nodeId, Map<UUID, List<GraphEdgeEntity>> touchingByNode,
            Map<UUID, String> titleById) {
        return touchingByNode.getOrDefault(nodeId, List.of()).stream()
            .sorted(Comparator.comparing(GraphEdgeEntity::getWeight).reversed())
            .limit(TOP_EDGES_PER_NODE)
            .map(e -> GraphEdgeLineRenderer.renderLine(e.getKind(),
                titleById.get(e.getFromNodeId()), titleById.get(e.getToNodeId()), e.getWeight()))
            .toList();
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw -q -pl . test -Dtest=GraphServiceIT`
Expected: PASS (all tests in the class, including the 2 new ones).

- [ ] **Step 5: Write the failing IT for the controller wiring**

In `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphApiIT.java`, add:

```java
    @Test
    void testListGraphNodes_shouldIncludeTopEdges_forNodesWithEdges() {
        UUID owner = ownerId();
        GraphNodeEntity from = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity to = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        graphPopulator.createEdge(owner, from.getId(), to.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");

        List<GraphNodeResponse> nodes = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        GraphNodeResponse fromResponse = nodes.stream()
            .filter(n -> n.getId().equals(from.getId())).findFirst().orElseThrow();
        assertThat(fromResponse.getTopEdges()).containsExactly("Késői evés → kiváltja → Rossz alvás · erős");
    }
```

Add the missing import at the top of the file: `import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;`.

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && ./mvnw -q -pl . test -Dtest=GraphApiIT`
Expected: FAIL — `fromResponse.getTopEdges()` is empty (controller still calls `listActive`, not
`listActiveWithTopEdges`).

- [ ] **Step 7: Wire the controller**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/controller/GraphController.java`,
replace:

```java
    @Override
    public List<GraphNodeResponse> listGraphNodes() {
        return graphService.listActive(currentUserId.get()).stream().map(graphMapper::toResponse).toList();
    }
```

with:

```java
    @Override
    public List<GraphNodeResponse> listGraphNodes() {
        return graphService.listActiveWithTopEdges(currentUserId.get()).stream()
            .map(nwe -> {
                GraphNodeResponse response = graphMapper.toResponse(nwe.node());
                response.setTopEdges(nwe.topEdgeLines());
                return response;
            })
            .toList();
    }
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && ./mvnw -q -pl . test -Dtest=GraphApiIT`
Expected: PASS (all tests in the class, including the new one).

- [ ] **Step 9: Run the full graph package test suite**

Run: `cd backend && ./mvnw -q -pl . test -Dtest='io.mrkuhne.mezo.feature.companion.graph.**'`
Expected: PASS — confirms the extraction (Task 2) and the new method didn't break any of the
existing 17 graph test classes (traversal, promotion, maintenance, switch-off, prompt assembler).

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphService.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/controller/GraphController.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphServiceIT.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphApiIT.java
git commit -m "feat(companion): GraphService.listActiveWithTopEdges + wire into node listing (mezo-b3pp.11)"
```

---

### Task 4: Frontend — data layer (`graphApi`/`graphHooks`/mock seed)

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/insights/graph.ts`
- Modify: `frontend/src/data/insights/graphApi.ts`
- Modify: `frontend/src/data/insights/graphHooks.ts`
- Modify: `frontend/src/data/hooks.ts`
- Test: `frontend/src/data/insights/graphHooks.test.tsx`

**Interfaces:**
- Consumes: generated `components['schemas']['GraphNodeResponse']` (Task 1, now carries
  `topEdges?: string[]`).
- Produces: `KnowledgeGraphNode` type; `graphApi.listNodes(): Promise<KnowledgeGraphNode[]>`;
  `graphApi.archiveNode(id: string): Promise<GraphNodeResponse>`; `useKnowledgeGraphNodes(): {
  nodes: KnowledgeGraphNode[], isPending, isError, refetch }`; `useKnowledgeGraphActions(): {
  archive(id: string): void, pending: boolean }`. Task 5 consumes all four.

- [ ] **Step 1: Add the FE domain type**

In `frontend/src/data/types.ts`, after the `LifeEventDecision` type (around line 701), add:

```ts
export type GraphNodeKind = 'PATTERN' | 'PREFERENCE' | 'GOAL' | 'LIFE_EVENT' | 'SEASON' | 'INSIGHT'

/** W2.6 (mezo-b3pp.11): one active knowledge-graph node for the Tudástár "Kapcsolatok" section —
 *  `topEdges` are pre-rendered Hungarian lines from the backend `GraphEdgeLineRenderer`, the same
 *  renderer the `[Összefüggések]` prompt block uses, so the UI and the model never disagree on
 *  phrasing. */
export interface KnowledgeGraphNode {
  id: string
  kind: GraphNodeKind
  title: string
  summary: string | null
  topEdges: string[]
}
```

- [ ] **Step 2: Add the mock seed + kind-label groups**

In `frontend/src/data/insights/graph.ts`, add the import and the new exports:

```ts
import type { LifeEventCandidate, KnowledgeGraphNode, GraphNodeKind } from '@/data/types'
```

(replacing the existing `import type { LifeEventCandidate } from '@/data/types'` line), then append
at the end of the file:

```ts
/**
 * Mock-mód seed (W2.6): négy csomópont különböző kind-ekből, néhány kapcsolattal — ugyanazt a
 * Hungarian sorformátumot használva, amit a backend `GraphEdgeLineRenderer` (és a régi
 * `[Összefüggések]` prompt blokk) renderel, hogy a demó és az éles felület sose térjen el.
 */
export const graphNodeSeed: KnowledgeGraphNode[] = [
  {
    id: 'gn-1',
    kind: 'PATTERN',
    title: 'Késői evés rontja az alvást',
    summary: null,
    topEdges: [
      'Késői evés → kiváltja → Rossz alvás · erős',
      'Rossz alvás → támogatja → Gyenge edzés · közepes',
    ],
  },
  {
    id: 'gn-2',
    kind: 'PREFERENCE',
    title: 'Niggle-aware exercise substitution preferred',
    summary: null,
    topEdges: [],
  },
  {
    id: 'gn-3',
    kind: 'GOAL',
    title: 'Identity goal: peak performance every life domain',
    summary: null,
    topEdges: [
      'Identity goal: peak performance every life domain → kapcsolódik → PR celebration moments · gyenge',
    ],
  },
  {
    id: 'gn-4',
    kind: 'LIFE_EVENT',
    title: 'Új munkahely első hete',
    summary: 'Hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
    topEdges: ['Új munkahely első hete → kiváltja → Megnövekedett stressz · közepes'],
  },
]

/** Ordered kind → Hungarian label groups for the "Kapcsolatok" section (mirrors the backend enum
 *  `GraphNodeResponse.KindEnum`). */
export const GRAPH_KIND_GROUPS: Array<[GraphNodeKind, string]> = [
  ['PATTERN', 'Minták'],
  ['PREFERENCE', 'Preferenciák'],
  ['GOAL', 'Célok'],
  ['LIFE_EVENT', 'Életesemények'],
  ['SEASON', 'Szezonok'],
  ['INSIGHT', 'Belátások'],
]
```

- [ ] **Step 3: Extend `graphApi.ts`**

In `frontend/src/data/insights/graphApi.ts`, replace the import line and add the new functions:

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { GraphNodeKind, KnowledgeGraphNode, LifeEventCandidate, LifeEventDecision } from '@/data/types'

export type GraphNodeResponse = components['schemas']['GraphNodeResponse']
export type GraphCandidateDecisionRequest = components['schemas']['GraphCandidateDecisionRequest']

const NODE = '/api/companion/graph/node'

/** Wire → FE domain (W2.3): only the fields the L2 inbox card needs. */
export function toLifeEventCandidate(n: GraphNodeResponse): LifeEventCandidate {
  return {
    id: n.id,
    title: n.title,
    summary: n.summary ?? null,
    occurredOn: n.occurredOn ?? null,
    proposedEdgeCount: n.proposedEdgeCount ?? 0,
  }
}

/** Wire → FE domain (W2.6): the Tudástár "Kapcsolatok" card shape. */
export function toKnowledgeGraphNode(n: GraphNodeResponse): KnowledgeGraphNode {
  return {
    id: n.id,
    kind: n.kind as GraphNodeKind,
    title: n.title,
    summary: n.summary ?? null,
    topEdges: n.topEdges ?? [],
  }
}

export const graphApi = {
  listCandidates: async () =>
    (await apiFetch<GraphNodeResponse[]>(`${NODE}/candidate`)).map(toLifeEventCandidate),
  decideCandidate: (id: string, decision: LifeEventDecision) =>
    apiFetch<GraphNodeResponse>(`${NODE}/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision } satisfies GraphCandidateDecisionRequest),
    }),
  listNodes: async () => (await apiFetch<GraphNodeResponse[]>(NODE)).map(toKnowledgeGraphNode),
  archiveNode: (id: string) => apiFetch<GraphNodeResponse>(`${NODE}/${id}/archive`, { method: 'POST' }),
}
```

- [ ] **Step 4: Write the failing hook tests**

In `frontend/src/data/insights/graphHooks.test.tsx`, add the import and two new `describe` blocks:

```tsx
import { useLifeEventCandidates, useKnowledgeGraphNodes, useKnowledgeGraphActions } from '@/data/insights/graphHooks'
import { lifeEventCandidateSeed, graphNodeSeed } from '@/data/insights/graph'
```

(replacing the existing two import lines), then append at the end of the file:

```tsx
describe('useKnowledgeGraphNodes (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('mock módban a seed csomópontokat adja vissza', async () => {
    const { result } = renderHook(() => useKnowledgeGraphNodes(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.nodes.length).toBeGreaterThan(0))
    expect(result.current.nodes).toEqual(graphNodeSeed)
  })
})

describe('useKnowledgeGraphNodes (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('real módban a 404-et (gráf-kapcsoló ki) üres listaként olvassa, nem hibaként', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useKnowledgeGraphNodes(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.nodes).toEqual([])
    expect(result.current.isError).toBe(false)
  })

  it('real módban a wire választ FE alakra képezi, topEdges-szel', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node`, () =>
        HttpResponse.json([
          {
            id: 'n1', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
            status: 'active', createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
            proposedEdgeCount: 0, topEdges: ['Késői evés → kiváltja → Rossz alvás · erős'],
          },
        ])),
    )
    const { result } = renderHook(() => useKnowledgeGraphNodes(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.nodes.length).toBe(1))
    expect(result.current.nodes[0]).toMatchObject({
      id: 'n1', kind: 'PATTERN', title: 'Késői evés rontja az alvást',
      topEdges: ['Késői evés → kiváltja → Rossz alvás · erős'],
    })
  })
})

describe('useKnowledgeGraphActions (archive)', () => {
  it('mock módban archiváláskor lekerül a csomópont a listáról', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const wrapper = makeHookWrapper()
    const nodes = renderHook(() => useKnowledgeGraphNodes(), { wrapper })
    await waitFor(() => expect(nodes.result.current.nodes.length).toBeGreaterThan(0))

    const actions = renderHook(() => useKnowledgeGraphActions(), { wrapper })
    actions.result.current.archive(graphNodeSeed[0].id)

    await waitFor(() => expect(nodes.result.current.nodes.map((n) => n.id)).not.toContain(graphNodeSeed[0].id))
    vi.unstubAllEnvs()
  })

  it('real módban POST-ol az archive végpontra', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let called = false
    server.use(
      http.post(`${API_BASE}/api/companion/graph/node/n1/archive`, () => {
        called = true
        return HttpResponse.json({
          id: 'n1', kind: 'PATTERN', title: 'x', status: 'archived',
          createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z', proposedEdgeCount: 0,
        })
      }),
    )
    const { result } = renderHook(() => useKnowledgeGraphActions(), { wrapper: makeHookWrapper() })
    result.current.archive('n1')
    await waitFor(() => expect(called).toBe(true))
    vi.unstubAllEnvs()
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/data/insights/graphHooks.test.tsx`
Expected: FAIL — `useKnowledgeGraphNodes`/`useKnowledgeGraphActions` are not exported yet.

- [ ] **Step 6: Implement the hooks**

In `frontend/src/data/insights/graphHooks.ts`, replace the top imports and append the new hooks +
their mock-mutation helper:

```ts
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { graphApi } from '@/data/insights/graphApi'
import { lifeEventCandidateSeed, graphNodeSeed } from '@/data/insights/graph'
import type { KnowledgeGraphNode, LifeEventCandidate, LifeEventDecision } from '@/data/types'

const GRAPH_CANDIDATE_KEY = ['graph', 'candidates'] as const
const GRAPH_NODE_KEY = ['graph', 'nodes'] as const
```

(keeping `useLifeEventCandidates`/`useLifeEventActions`/`mockDecide` exactly as they are), then
append at the end of the file:

```ts
/**
 * W2.6 (mezo-b3pp.11): active knowledge-graph nodes for the Tudástár "Kapcsolatok" section. The
 * graph switch is independent of the companion switch, so a 404 here (graph off) is an honest
 * empty list, not `degraded` — the `useLifeEventCandidates` idiom.
 */
export function useKnowledgeGraphNodes() {
  const { data, isPending, isError, refetch } = useDualQuery<KnowledgeGraphNode[]>({
    queryKey: GRAPH_NODE_KEY,
    mockData: graphNodeSeed,
    realFetch: async () => {
      try {
        return await graphApi.listNodes()
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return []
        throw err
      }
    },
    realEmpty: [],
  })
  return { nodes: data, isPending, isError, refetch }
}

/** Archivál egy csomópontot — L2 kontroll, azonnal lekerül az aktív listáról/promptból. */
export function useKnowledgeGraphActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const archiveM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) {
        mockArchiveNode(qc, id)
        return
      }
      await graphApi.archiveNode(id)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: GRAPH_NODE_KEY }),
  })

  return {
    archive: (id: string) => archiveM.mutate(id),
    pending: archiveM.isPending,
  }
}

function mockArchiveNode(qc: QueryClient, id: string) {
  qc.setQueryData<KnowledgeGraphNode[]>(GRAPH_NODE_KEY, (old) => (old ?? graphNodeSeed).filter((n) => n.id !== id))
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/data/insights/graphHooks.test.tsx`
Expected: PASS (all tests, old + new).

- [ ] **Step 8: Re-export the new hooks from the data barrel**

In `frontend/src/data/hooks.ts`, replace:

```ts
export { useLifeEventCandidates, useLifeEventActions } from '@/data/insights/graphHooks'
```

with:

```ts
export { useLifeEventCandidates, useLifeEventActions, useKnowledgeGraphNodes, useKnowledgeGraphActions } from '@/data/insights/graphHooks'
```

- [ ] **Step 9: Run the full FE data-layer test file once more + typecheck**

Run: `cd frontend && pnpm vitest run src/data/insights/graphHooks.test.tsx && pnpm tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/insights/graph.ts \
        frontend/src/data/insights/graphApi.ts frontend/src/data/insights/graphHooks.ts \
        frontend/src/data/insights/graphHooks.test.tsx frontend/src/data/hooks.ts
git commit -m "feat(frontend): dual-mode knowledge-graph node listing + archive hooks (mezo-b3pp.11)"
```

---

### Task 5: Frontend — `KnowledgeGraphNodeCard` + `KnowledgePage` "Kapcsolatok" section

**Files:**
- Create: `frontend/src/features/me/components/KnowledgeGraphNodeCard.tsx`
- Modify: `frontend/src/features/me/pages/KnowledgePage.tsx`
- Test: `frontend/src/features/me/pages/KnowledgePage.test.tsx`

**Interfaces:**
- Consumes: `useKnowledgeGraphNodes`, `useKnowledgeGraphActions` (Task 4); `CategoryHeader` (existing,
  `frontend/src/features/me/components/CategoryHeader.tsx`); `GRAPH_KIND_GROUPS` (Task 4, in
  `data/insights/graph.ts`).
- Produces: `KnowledgeGraphNodeCard` component (`{ node: KnowledgeGraphNode, onArchive: () => void }`
  props) — used only by `KnowledgePage.tsx`.

- [ ] **Step 1: Write the failing page tests**

In `frontend/src/features/me/pages/KnowledgePage.test.tsx`, add `fireEvent, waitFor` to the
existing `@testing-library/react` import and append two tests:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
```

(replacing the existing import line), then append at the end of the file:

```tsx
test('renders the Kapcsolatok section grouped by kind with strongest-edge lines', () => {
  renderPage()
  expect(screen.getByText(/Kapcsolatok/)).toBeInTheDocument()
  expect(screen.getByText('Minták · 1')).toBeInTheDocument()
  expect(screen.getByText('Késői evés rontja az alvást')).toBeInTheDocument()
  expect(screen.getByText('Késői evés → kiváltja → Rossz alvás · erős')).toBeInTheDocument()
})

test('archiving a graph node removes it from the Kapcsolatok section (mock mode)', async () => {
  renderPage()
  const archiveButtons = screen.getAllByRole('button', { name: 'Archivál' })
  fireEvent.click(archiveButtons[0])
  await waitFor(() =>
    expect(screen.queryByText('Késői evés rontja az alvást')).not.toBeInTheDocument())
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx`
Expected: FAIL — no "Kapcsolatok" text, no "Archivál" button exists yet.

- [ ] **Step 3: Create `KnowledgeGraphNodeCard`**

Create `frontend/src/features/me/components/KnowledgeGraphNodeCard.tsx`:

```tsx
import type { KnowledgeGraphNode } from '@/data/types'

/** One active knowledge-graph node in the Tudástár "Kapcsolatok" section (W2.6, mezo-b3pp.11) —
 *  the `KnowledgeFactCard` Napiv row-card idiom (flat surface, no left accent bar), plus the
 *  backend-rendered `topEdges` lines and an L2 archive action. */
export function KnowledgeGraphNodeCard({ node, onArchive }: {
  node: KnowledgeGraphNode
  onArchive: () => void
}) {
  return (
    <div
      data-graph-node-card
      style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--np-shadow-row)', padding: 10 }}
    >
      <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{node.title}</span>
        <button
          type="button"
          className="chip"
          onClick={onArchive}
          style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}
        >
          Archivál
        </button>
      </div>
      {node.summary && (
        <p className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, margin: '6px 0 0' }}>
          {node.summary}
        </p>
      )}
      {node.topEdges.length > 0 && (
        <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
          {node.topEdges.map((line) => (
            <li key={line} className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.6 }}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the "Kapcsolatok" section to `KnowledgePage.tsx`**

In `frontend/src/features/me/pages/KnowledgePage.tsx`, replace the full file with:

```tsx
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { useKnowledge, useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { FACT_CATEGORIES, factCategoryColor } from '@/data/insights/knowledge'
import { GRAPH_KIND_GROUPS } from '@/data/insights/graph'
import { CategoryHeader } from '@/features/me/components/CategoryHeader'
import { KnowledgeFactCard } from '@/features/me/components/KnowledgeFactCard'
import { KnowledgeGraphNodeCard } from '@/features/me/components/KnowledgeGraphNodeCard'

export function KnowledgePage() {
  const { facts, edges, activeCount } = useKnowledge()
  const { nodes } = useKnowledgeGraphNodes()
  const { archive } = useKnowledgeGraphActions()

  return (
    <>
      {/* Header */}
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Tudás</div>
          <h1>Tudásgráf</h1>
        </div>
      </div>

      {/* Summary band */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card"
          style={{
            padding: 16,
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, var(--wash-lav) 0%, var(--surface-1) 65%)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Élő mindmap · növekvő</span>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 6, lineHeight: 1.1 }}>
                {`${facts.length} tudás · ${edges.length} kapcsolat`}
              </div>
              <span className="text-secondary" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.45, display: 'block' }}>
                {`${activeCount} aktív a prompt kontextusban · ${facts.length - activeCount} stabilizált vagy archiv`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Facts by category */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Kategóriánként</Eyebrow>
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{facts.length}</span>
        </div>
        <div className="col gap-md">
          {FACT_CATEGORIES.map(([cat, label]) => {
            const items = facts.filter(f => f.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <CategoryHeader label={label} color={factCategoryColor(cat)} count={items.length} />
                <div className="col gap-xs">
                  {items.map(f => (
                    <KnowledgeFactCard key={f.id} fact={f} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Graph connections (W2.6, mezo-b3pp.11) */}
      {nodes.length > 0 && (
        <div style={{ padding: '0 24px 32px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Eyebrow>Kapcsolatok</Eyebrow>
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{nodes.length}</span>
          </div>
          <div className="col gap-md">
            {GRAPH_KIND_GROUPS.map(([kind, label]) => {
              const items = nodes.filter(n => n.kind === kind)
              if (items.length === 0) return null
              return (
                <div key={kind}>
                  <CategoryHeader label={label} color="var(--lav-deep)" count={items.length} />
                  <div className="col gap-xs">
                    {items.map(n => (
                      <KnowledgeGraphNodeCard key={n.id} node={n} onArchive={() => archive(n.id)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx`
Expected: PASS (all 5 tests: 3 pre-existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me/components/KnowledgeGraphNodeCard.tsx \
        frontend/src/features/me/pages/KnowledgePage.tsx \
        frontend/src/features/me/pages/KnowledgePage.test.tsx
git commit -m "feat(frontend): Tudástár Kapcsolatok section on KnowledgePage (mezo-b3pp.11)"
```

---

### Task 6: Docs + full gates

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/me.md`

- [ ] **Step 1: Update `docs/features/companion.md` REST endpoint doc**

At line ~1858 (`### REST endpoints — knowledge graph`), replace:

```
- `GET /api/companion/graph/node` — active nodes for the current user, newest first.
- `POST /api/companion/graph/node/{id}/archive` — archive a node (200 + the archived node body;
  404 `GRAPH_NODE_NOT_FOUND` if not owned).
```

with:

```
- `GET /api/companion/graph/node` — active nodes for the current user, newest first; each carries
  `topEdges` (W2.6, `mezo-b3pp.11`) — up to 3 Hungarian text lines for its strongest touching
  edges (both directions), pre-rendered by the shared `GraphEdgeLineRenderer` (the same renderer
  `GraphPromptAssembler` uses for the `[Összefüggések]` block, so the UI and the model never
  disagree on phrasing); `[]` when the node has no edges. Candidates (`GET .../candidate`) always
  carry `topEdges: []` — the field is active-listing-only.
- `POST /api/companion/graph/node/{id}/archive` — archive a node (200 + the archived node body;
  404 `GRAPH_NODE_NOT_FOUND` if not owned).
```

- [ ] **Step 2: Update the stale "no GraphEdgeResponse REST DTO" note**

At line ~1406 (inside `### Backend tables (W2.1 knowledge graph, ✅ mezo-b3pp.6)`), find the
sentence containing `no `GraphEdgeResponse` REST DTO yet` and replace it with:

```
`GraphEdgeResponse` never shipped as its own DTO — W2.6 (`mezo-b3pp.11`) exposes edges pre-rendered
as `GraphNodeResponse.topEdges` text lines instead of raw rows, since the only two HTTP consumers
(the `[Összefüggések]` prompt block and the Tudástár "Kapcsolatok" UI) both want Hungarian lines,
never structured edge data.
```

- [ ] **Step 3: Add the W2.6 subsection**

After the `### W2.5 graph maintenance job (✅ mezo-b3pp.10)` section (ends right before `###
Entities`, around line 1694), insert:

```markdown
### W2.6 Tudástár Kapcsolatok surface (✅ `mezo-b3pp.11`)

- **`GraphEdgeLineRenderer`** (`graph/service/GraphEdgeLineRenderer.java`, new) — the Hungarian
  `cause → verb → effect · strength` line format, extracted out of `GraphPromptAssembler` so the
  prompt block (W2.4) and this REST surface render identically off one source of truth. Holds
  `KIND_VERBS` + `strength(weight)` + `renderLine(kind, fromTitle, toTitle, weight)` (the
  `PRECEDED_BY` endpoint-swap lives here now); `GraphPromptAssembler.renderBlock` calls it instead
  of keeping its own copy — behavior unchanged, `GraphPromptAssemblerTest` untouched.
- **`GraphService.listActiveWithTopEdges(userId)`** (new) — loads the user's active nodes + every
  active edge once (`GraphEdgeRepository.findByCreatedByAndDeletedFalse`, the W2.5 precedent),
  buckets edges by each touching node (both `from` and `to`), and renders the top-3-by-weight
  lines per node via `GraphEdgeLineRenderer`. An edge whose OTHER endpoint is archived/candidate
  is silently dropped — a line naming a node no longer in "current knowledge" would confuse the
  surface. Top-3 is a fixed UI constant (`GraphService.TOP_EDGES_PER_NODE`), not a tuning knob —
  a display concern, not graph behavior.
- **`GraphController.listGraphNodes()`** now calls this instead of the plain `listActive`, setting
  `GraphNodeResponse.topEdges` per node; `listGraphCandidates()` is untouched (default `[]`).
- **FE** — `frontend/src/features/me/pages/KnowledgePage.tsx` gains a "Kapcsolatok" section: the
  new dual-mode `useKnowledgeGraphNodes()` (`data/insights/graphHooks.ts`) lists active nodes
  grouped by `GRAPH_KIND_GROUPS` (`data/insights/graph.ts` — the 6 kind labels), each rendered as
  a `KnowledgeGraphNodeCard` (title + optional summary + `topEdges` lines + an "Archivál" button
  wired to `useKnowledgeGraphActions().archive`, `POST .../archive`). Real-mode 404 (graph switch
  off) reads as an honest empty list — the `useLifeEventCandidates` idiom — so the rest of the
  Tudástár page stays fully usable. No graph **visualization** — text lines only (`mezo-2m4` stays
  parked, spec §12).
- **Acceptance:** `GraphApiIT` pins `topEdges` in the node-listing response (weight-desc, capped
  at 3, edges to archived nodes excluded); `GraphServiceIT` covers the bucketing; FE
  `graphHooks.test.tsx`/`KnowledgePage.test.tsx` cover mock, real, 404, and
  archive-removes-from-list.
```

- [ ] **Step 4: Update `docs/features/me.md` — Tudás table row**

At line 40, replace:

```
| `Tudás` (Knowledge) | `/me/knowledge` | 🔶 **graph prototype** — title + summary band + facts-by-category list over the dual-mode `useKnowledge` (facts ✅ real since companion V1.2; `edges` real-mode `[]`, so the graph counts stay honest). Insights-domain data (see §5.5 — out of Me scope). | ✅ facts / 🔶 edges (Insights-domain) |
```

with:

```
| `Tudás` (Knowledge) | `/me/knowledge` | 🔶 **graph prototype** — title + summary band + facts-by-category list over the dual-mode `useKnowledge` (facts ✅ real since companion V1.2; `edges` real-mode `[]`, so the mock-prototype graph counts stay honest), **plus a real "Kapcsolatok" section (W2.6, `mezo-b3pp.11`)** — active `knowledge_node`/`knowledge_edge` rows grouped by kind with archive, via `useKnowledgeGraphNodes` (Insights-domain, `data/insights/graphHooks.ts`). Insights-domain data (see §5.5 — out of Me scope). | ✅ facts / ✅ graph nodes (W2.6) / 🔶 mock fact-edges (Insights-domain) |
```

- [ ] **Step 5: Update `docs/features/me.md` — `Tudás` page description**

At line 170 (end of the `### `Tudás` (`pages/KnowledgePage.tsx`)` paragraph), append a new
paragraph right after it:

```markdown

**Kapcsolatok section (W2.6, `mezo-b3pp.11`, real data):** below the facts, when the
knowledge-graph switch is on and the user has active nodes, a "Kapcsolatok" `Eyebrow` groups them
by kind (`GRAPH_KIND_GROUPS` — Minták/Preferenciák/Célok/Életesemények/Szezonok/Belátások) via the
dual-mode `useKnowledgeGraphNodes()` (`GET /api/companion/graph/node`, real-mode 404 reads as an
honest empty list, the W2.3 life-event-candidates idiom). Each `KnowledgeGraphNodeCard` shows the
node's title, optional summary, its `topEdges` (up to 3 backend-rendered Hungarian lines, e.g.
"Késői evés → kiváltja → Rossz alvás · erős" — the same renderer the `[Összefüggések]` prompt block
uses) and an "Archivál" button (`useKnowledgeGraphActions().archive` → `POST
/api/companion/graph/node/{id}/archive`); archiving removes the node from the section immediately
(mock: optimistic cache filter; real: query invalidation) and, per `GraphTraversalQuery`, from
prompt traversal on the next turn. No graph **visualization** — text lines only (`mezo-2m4` stays
parked).
```

- [ ] **Step 6: Update the "mock-only" gotcha line**

At line 478, replace:

```
- **Mock-only, no backend:** `Tudás`/Knowledge edges/graph (trimmed to a working mock shell in `mezo-lfw`; facts are real).
```

with:

```
- **Mock-only, no backend:** the `Tudás`/Knowledge summary band's **fact-edge count** (`useKnowledge().edges`, trimmed to a working mock shell in `mezo-lfw`; facts are real). The page's separate **graph-node "Kapcsolatok" section is real** since W2.6 (`mezo-b3pp.11`) — `useKnowledgeGraphNodes`/`useKnowledgeGraphActions` hit the live `knowledge_node`/`knowledge_edge` tables.
```

- [ ] **Step 7: Update the "Key files" components list**

At line 502, this is a long single line listing every Me view-local component. Make two small,
exact-match edits inside it (do not retype the whole line):

1. In the `{...}.tsx` brace list, find the substring `CategoryHeader,KnowledgeFactCard,TimePicker`
   and change it to `CategoryHeader,KnowledgeFactCard,KnowledgeGraphNodeCard,TimePicker` (inserting
   `KnowledgeGraphNodeCard,` between `KnowledgeFactCard,` and `TimePicker`).
2. In the parenthetical that follows, find `(**`AiUsageCard`** = the Profil AI-használat tiles` and
   insert a new clause immediately before it, inside the same parenthesis:
   `(**`KnowledgeGraphNodeCard`** = the W2.6 (`mezo-b3pp.11`) Tudástár "Kapcsolatok" row — title +
   optional summary + backend-rendered `topEdges` lines + Archivál button; **`AiUsageCard`** = the
   Profil AI-használat tiles`.

Everything else on the line (the rest of the component list and the rest of the parenthetical)
stays exactly as it is today.

- [ ] **Step 8: Lint the docs**

Run: `node scripts/lint-docs.mjs`
Expected: exits 0, no new orphan/broken-link/staleness findings.

- [ ] **Step 9: Commit**

```bash
git add docs/features/companion.md docs/features/me.md
git commit -m "docs(companion,me): document W2.6 Tudástár Kapcsolatok surface (mezo-b3pp.11)"
```

- [ ] **Step 10: Run the full local gates from the house workflow**

```bash
cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.graph.**'
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: all green. (The full backend suite is CI's job per `AGENTS.md`/`CLAUDE.md` — only the
focused graph package ITs run locally.)

- [ ] **Step 11: Ship per the house git workflow**

```bash
git push -u origin feat/w2-6-tudastar-kapcsolatok
gh pr create --title "feat(companion): W2.6 Tudástár Kapcsolatok surface (mezo-b3pp.11)" --body "$(cat <<'EOF'
## Summary
- Active knowledge-graph nodes now render as a grouped "Kapcsolatok" section on Me→Tudás, each with its strongest edges as backend-rendered Hungarian text lines, plus an archive action.
- Extracted `GraphEdgeLineRenderer` out of `GraphPromptAssembler` so the `[Összefüggések]` prompt block and this new REST field share one rendering source of truth.

## Test plan
- [ ] `GraphEdgeLineRendererTest`, `GraphServiceIT`, `GraphApiIT`, full `graph.**` package green
- [ ] `graphHooks.test.tsx`, `KnowledgePage.test.tsx` green in both FE test modes
- [ ] `pnpm build` clean; `node scripts/lint-docs.mjs` clean
- [ ] CI green on the self-PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for CI green (`gh pr checks <PR#> --watch`), then merge locally with `--no-ff` per
`CLAUDE.md`'s Git Workflow section, push `main`, `bd close mezo-b3pp.11 && bd dolt push`, delete
the branch locally + remote.

---

## Self-Review Notes

- **Spec coverage:** §6.6 acceptance criteria — "grouped render from live data" (Task 5, grouped by
  `GRAPH_KIND_GROUPS`), "strongest edges as text lines" (Task 3's `topEdgeLines`, weight-desc top
  3), "archive action per node" (Task 5 wires the pre-existing `POST .../archive` endpoint —
  already built in W2.1, confirmed via `GraphApiIT`'s existing archive tests), "archive hides from
  prompt traversal immediately" (already true — `GraphTraversalQuery` filters `status = 'active'`,
  unchanged by this slice, confirmed by reading the query and `GraphServiceIT`'s existing archive
  test — no new task needed, just noted here since it's a pre-existing guarantee this slice
  depends on). "No graph visualization" — Task 5 renders only text lines, no new component library.
- **Cross-cutting conventions (§11):** contract-first (Task 1 before Task 3); no new LLM/embed call
  (N/A); integration-first tests (Tasks 2/3 IT + unit); docs in the same change (Task 6);
  `lint-docs.mjs` (Task 6 Step 8); FE dual-mode with honest mock seeds (Task 4); data hooks via the
  `@/data/hooks` barrel (Task 4 Step 8); new page content is a section on an existing `*Page`, not
  a new page.
