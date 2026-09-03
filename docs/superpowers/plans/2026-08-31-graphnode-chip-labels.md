# GraphNode chips get a name, and stop flooding the footer — Implementation Plan (`mezo-b3pp.33`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the `[GraphNode]` chips in the chat `Hivatkozott` footer readable instead of raw UUIDs, and stop a graph-heavy turn filling the whole footer with them.

**Two problems, both from W2.4.**
1. `GraphPromptAssembler` emits `Ref("GraphNode", node.id.toString())`, and the FE has nothing to turn a UUID into a name — `chatRefs.ts`'s `labelFromId` only humanises ids that literally contain an ISO date, so a graph chip renders a bare UUID.
2. `graph.topK` defaults to **8 edges**, and each edge contributes **two** node refs — up to 16 — against `tools.max-refs-per-turn: 10`. Graph refs are added **last** (`ChatService:283`, after tool and Memory refs), and `ToolCallAudit.addRef` silently drops everything past the cap, so a graph-heavy turn can consume the entire remaining budget with UUID chips and then truncate mid-list.

**The decision — where the label comes from.** The bd offers "resolve to the node title on the FE (W2.6 exposes the node list) or carry a label". Take **carry a label**:
- The backend already *has* the title at ref-creation time — `GraphTraversalQuery.NeighborEdge` carries `fromTitle` and `toTitle`, which is what renders the `[Összefüggések]` block in the first place. Nothing needs looking up.
- FE resolution would mean an extra graph-node fetch on the chat page purely for a cosmetic label, and it would **fail exactly where it matters**: W2.6's list is *active* nodes only, and archiving is now real (`mezo-b3pp.31`, `mezo-b3pp.30`), so a chip pointing at a since-retracted node would fall back to a UUID forever.
- `MessageRef`'s neighbour `RecalledMemory` already carries a `label` field, so the shape and the name are the house idiom, not an invention.

The `id` stays exactly as it is — `label` is additive, so nothing that identifies a node is lost.

**Tech Stack:** OpenAPI 3.0.3 fragment + both generators; Java 21 / Spring Boot; React 19 + TypeScript + Vitest.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.33)`. Conventional-commit subjects.
- **Contract-first** (`docs/references/api_contract_conventions.md`): the fragment changes first, then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. Never hand-edit `api/openapi.yml` or `frontend/src/data/_client/api.gen.ts`.
- **The contract change is ADDITIVE and must stay so.** `label` is optional/nullable; `MessageRef.required` keeps `[kind, id]` exactly. Old `ai_message.refs` jsonb rows have no `label` and must keep deserialising — they simply get `null`.
- **Spec §11:** integration-first tests. No new table. New tuning goes in `CompanionProperties.Graph` as a `@Valid`-record field with bounds, the way `maxHops`/`topK`/`decayFactor` already do.
- **Both FE test modes green, explicitly:** `VITE_USE_MOCK=false pnpm test` and `VITE_USE_MOCK=true pnpm test` (a bare `pnpm test` is a mock run — the real-mode gate would be vacuous).
- **Docs in the same change:** `docs/features/companion.md` (the refs footer + W2.4 graph block sections).

---

### Task 1: Contract — `MessageRef` gains an optional label

**Files:** modify `api/feature/companion/companion.yml` (the `MessageRef` schema); regenerate `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts`.

- [ ] **Step 1: Read the neighbours**

Read `MessageRef` and `RecalledMemory` in the fragment. `RecalledMemory` already has `label` — match its style (inline property map, a `description` explaining what the value IS).

- [ ] **Step 2: Add the field**

Add to `MessageRef.properties` only — do **not** touch its `required` list:

```yaml
        label:
          type: string
          nullable: true
          description: >-
            Human name for the referenced entity when the producer knows one (mezo-b3pp.33) —
            today only GraphNode refs carry it (the graph node's title). Absent/null for every
            other kind, and for rows persisted before this field existed; the FE falls back to
            its own id-derived label then.
```

- [ ] **Step 3: Regenerate both sides and verify**

```bash
cd api/generate && npm run generate:api
cd frontend && pnpm generate:api
grep -n 'label' api/openapi.yml | grep -i ref | head
```
`api/openapi.yml` and `api.gen.ts` must both change. If `api/openapi.yml` does not change, the fragment edit did not land — stop and re-check.

- [ ] **Step 4: Commit**

```bash
git add api/feature/companion/companion.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): message refs may carry a human label (mezo-b3pp.33)"
```

---

### Task 2: Backend — populate the label, and cap the graph refs

**Files:**
- Modify: `backend/.../companion/entity/RefsEnvelope.java`
- Modify: `backend/.../companion/tools/ToolCallAudit.java`
- Modify: `backend/.../companion/graph/service/GraphPromptAssembler.java`
- Modify: `backend/.../companion/config/CompanionProperties.java` (the `Graph` record) + `backend/src/main/resources/application.yml`
- Modify: the mapper that turns `RefsEnvelope.Ref` into the API `MessageRef` (grep for it)
- Test: `GraphPromptAssemblerIT` (or the graph prompt test — grep) and the `ToolCallAudit` test if one exists

**THE TRAP THIS TASK MUST NOT FALL INTO — dedup.** `ToolCallAudit` dedups refs with a `LinkedHashSet<RefsEnvelope.Ref>`, and `Ref` is a **record**, so its `equals` covers every component. The moment `label` becomes a component, two refs with the same `(kind, id)` but different labels — e.g. the same Memory day arriving from the tool path with no label and from ambient recall with one, or the same graph node reached by two edges — stop deduping and BOTH occupy the cap. Dedup must stay on `(kind, id)` only. Fix it explicitly (a `LinkedHashMap` keyed on a `(kind,id)` pair, or an explicit contains-check), and pin it with a test.

- [ ] **Step 1: Write the failing tests**

Read the existing graph-prompt test and `ToolCallAudit`'s test (grep) and extend them in their own harness. Cases:

```
GraphPromptAssembler:
  testAssemble_shouldLabelEachGraphRefWithItsNodeTitle_whenEdgesRender
    seed a traversal that renders two edges over three distinct nodes
    => every emitted ref has kind GraphNode, an id equal to the node's uuid,
       and a label equal to that node's title (assert per ref, not just "some label present")

  testAssemble_shouldCapGraphRefs_whenTheTraversalRendersMoreNodesThanTheLimit
    with graph.max-refs = 3 and a traversal rendering 5 distinct nodes
    => exactly 3 refs, and they are the FIRST three in first-appearance order
       (the order is the relevance statement — see the assembler's own javadoc)

ToolCallAudit:
  testAddRef_shouldStillDedupe_whenTheSameKindAndIdArriveWithDifferentLabels
    addRef("Memory","2026-05-21", null) then addRef("Memory","2026-05-21","valami")
    => exactly ONE ref survives
       (without this, adding `label` to the record silently doubles such refs and they eat the cap)
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend && ./mvnw clean test -Dtest='GraphPromptAssembler*,ToolCallAudit*' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Widen `Ref`, keep dedup on `(kind, id)`**

Add the component:
```java
    public record Ref(String kind, String id, String label) {
        /** The label-less form every non-graph producer uses — keeps the ~20 existing call sites
         *  unchanged and makes "no label" explicit rather than accidental (mezo-b3pp.33). */
        public Ref(String kind, String id) {
            this(kind, id, null);
        }
    }
```

Then fix `ToolCallAudit`: keep insertion order and the cap, but make identity `(kind, id)`. Add an `addRef(String kind, String id, String label)` overload and keep the two-arg one delegating. Whatever structure you choose, the FIRST ref for a `(kind,id)` wins — do not let a later labelled ref replace an earlier one, because tool refs are meant to win the cap (`ChatService:281-283`) and reordering would change which provenance survives.

- [ ] **Step 4: Populate the graph labels and cap them**

In `GraphPromptAssembler`, the refs loop already walks `rendered.rendered()`. Emit labelled refs and stop at the configured cap:

```java
            // one ref per node, first-appearance order — the same node may sit on several lines.
            // Capped (mezo-b3pp.33): topK edges yield up to 2×topK node refs against the shared
            // tools.max-refs-per-turn budget, and graph refs are added LAST, so an uncapped graph
            // turn fills the whole footer with graph chips and truncates mid-list.
            LinkedHashMap<UUID, RefsEnvelope.Ref> byNode = new LinkedHashMap<>();
            for (NeighborEdge edge : rendered.rendered()) {
                byNode.putIfAbsent(edge.fromNodeId(),
                    new RefsEnvelope.Ref(REF_KIND, edge.fromNodeId().toString(), edge.fromTitle()));
                byNode.putIfAbsent(edge.toNodeId(),
                    new RefsEnvelope.Ref(REF_KIND, edge.toNodeId().toString(), edge.toTitle()));
            }
            List<RefsEnvelope.Ref> refs = byNode.values().stream()
                .limit(properties.graph().maxRefs())
                .toList();
```
(adjust to however this class reaches `CompanionProperties` — read it first).

Add `maxRefs` to `CompanionProperties.Graph` with bounds in the style of its siblings, and the value + a comment to `application.yml`'s `graph:` block. Choose a default that leaves room in the shared 10-ref budget for tool and Memory refs — **6** is the suggested value; justify whatever you pick in the yaml comment.

- [ ] **Step 5: Carry the label through the mapper**

Grep for where `RefsEnvelope.Ref` becomes the API `MessageRef` and pass `label` through. Verify by reading that no other mapper drops it.

- [ ] **Step 6: Run the tests**

```bash
cd backend && ./mvnw clean test -Dtest='GraphPromptAssembler*,ToolCallAudit*,ChatServiceGraphBlock*,CompanionChat*' -Dmezo.test.use-testcontainers=true
```
Include whatever chat ITs assert on `refs` — grep for them; a persisted-shape assertion may need the new field.

- [ ] **Step 7: Commit**

```bash
git add backend api/.. -- backend
git commit -m "feat(companion): graph refs carry the node title and stop flooding the ref cap (mezo-b3pp.33)"
```

---

### Task 3: Frontend — prefer the carried label

**Files:**
- Modify: `frontend/src/data/types.ts` (`ChatRef`)
- Modify: `frontend/src/features/insights/logic/chatRefs.ts` (`chatRefDisplay`)
- Test: `frontend/src/features/insights/logic/chatRefs.test.ts`

- [ ] **Step 1: Write the failing tests**

Extend `chatRefs.test.ts` in its own style:

```
uses the carried label when the ref has one
  {kind:'GraphNode', id:'<uuid>', label:'Késői evés'} => label 'Késői evés'

falls back to the id-derived label when there is none
  {kind:'Workout', id:'w-2026-05-21'} => 'máj. 21.' (unchanged behaviour)

falls back to the raw id when the label is null and the id carries no date
  {kind:'GraphNode', id:'<uuid>', label:null} => the raw uuid, not 'null' or empty
  (pre-mezo-b3pp.33 rows persist without a label — they must degrade to today's behaviour,
   not to a broken chip)
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd frontend && pnpm vitest run src/features/insights
```

- [ ] **Step 3: Implement**

`types.ts`: `export interface ChatRef { kind: string; id: string; label?: string | null }`.

`chatRefs.ts`: prefer the carried label, keep everything else:
```ts
/** The carried label wins when the producer knew a human name (mezo-b3pp.33 — today GraphNode
 *  refs, whose uuid `labelFromId` can never humanise); otherwise the id-derived label, which is
 *  also what pre-mezo-b3pp.33 rows fall back to. Still nothing fabricated. */
export function chatRefDisplay(ref: ChatRef): { kind: string; label: string } {
  return { kind: KIND_LABELS[ref.kind] ?? ref.kind, label: ref.label?.trim() || labelFromId(ref.id) }
}
```
The `?.trim() ||` (not `??`) is deliberate: an empty or whitespace-only label must fall back rather than render a blank chip.

Add a `GraphNode` entry to `KIND_LABELS` if a Hungarian kind word is obvious (e.g. `Gráf`); if not, leave it — the raw kind is the honest fallback and this slice is about the id half.

- [ ] **Step 4: Run, both modes**

```bash
cd frontend && pnpm vitest run src/features/insights
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/insights
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(insights): ref chips show the carried label instead of a raw uuid (mezo-b3pp.33)"
```

---

### Task 4: Docs + full gates

- [ ] **Step 1: Docs**

`docs/features/companion.md`: the refs footer section and the W2.4 graph section must now say that `MessageRef` may carry an optional `label`; that only GraphNode refs populate it today, from the traversal's own `fromTitle`/`toTitle`, so no lookup is needed and an archived node still shows its name; that pre-`mezo-b3pp.33` rows have no label and fall back to the id-derived one; that graph refs are capped at `graph.max-refs` because `topK` edges yield up to `2×topK` node refs against the shared `tools.max-refs-per-turn` budget and graph refs are added last; and that `ToolCallAudit` dedups on `(kind, id)` only, deliberately, so a label can never split one ref into two. Bump `updated:`.

- [ ] **Step 2: Gates**

```bash
cd backend && ./mvnw clean test -Dtest='GraphPromptAssembler*,ToolCallAudit*,ChatServiceGraphBlock*,CompanionChat*' -Dmezo.test.use-testcontainers=true
cd frontend && pnpm build
cd frontend && VITE_USE_MOCK=false pnpm test
cd frontend && VITE_USE_MOCK=true pnpm test
node scripts/lint-docs.mjs
node scripts/gen-codemap.mjs --check
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd .. && git status --short
```
The last line is the contract-drift gate: it must leave **no diff**.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs(features): companion — labelled refs and the graph ref cap (mezo-b3pp.33)"
```

---

## Self-Review

- **bd coverage.** "ChatMessage renders RefTag label={r.id}; GraphNode refs carry node.id … resolve on the FE or carry a label" → Task 1–3, resolved to *carry a label*, with the FE-resolution option rejected in writing for a concrete reason (archived nodes, and an extra fetch for cosmetics). "topK=8 edges can yield up to 16 GraphNode refs against max-refs-per-turn=10 — consider capping graph refs to the first N distinct nodes" → Task 2 Step 4, as a bounded config knob in the house idiom.
- **What this plan adds beyond the bd:** the dedup trap. `RefsEnvelope.Ref` is a record inside a `LinkedHashSet`, so adding `label` silently breaks `(kind,id)` dedup and lets the same entity occupy the cap twice — invisible in a diff review, and exactly the kind of thing that only shows up as "the footer has duplicates sometimes". Pinned by its own test.
- **Backward compatibility** is called out at three layers: the contract keeps `required: [kind, id]`, old jsonb rows deserialise `label` as null, and the FE falls back to today's id-derived label for them.
- **Placeholders.** Production code is literal where the shape is fixed; the two spots that depend on local structure (how the assembler reaches config, which mapper converts the ref) are explicitly "read it first" rather than guessed.
