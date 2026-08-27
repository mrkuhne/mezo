# Memory observatory reports every embedding kind — Implementation Plan (`mezo-b3pp.22`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stop the `/insights/memoria` observatory silently under-reporting the vector store. `MemoryObservatoryService.overview` counts only `daily_summary` and `chat_turn`, while `memory_embedding.kind` has carried **ten** legal values since W1.1 — and by now *every one of them has a writer* (`journal_entry`, `reflection`, `gratitude`, `decision`, `activity_note`, `checkin_note`, `weekly_summary`, `monthly_summary`). The L1 card claims a store size that is wrong by however much narrative capture has accumulated.

**The shape decision (the bd offered two).** bd `mezo-b3pp.22` says "widen `MemoryEmbeddingCounts` to carry all ten narrative kinds **or** a kind→count map". Take neither literally — take the shape **its own two siblings in the same response already use**: `MemoryOverviewL2.patterns` is `MemoryPatternCount[] {kind, status, count}` and `MemoryOverviewL3.facts` is `MemoryFactSourceCount[] {source, count}`. So the embeddings become `MemoryEmbeddingKindCount[] {kind, count}`. Ten fixed fields would mean a contract change every time the CHECK list grows — and it has already grown from three values to ten. An array does not.

**Architecture:** contract-first. The fragment changes, both generators run, then the backend fills the new shape from ONE `group by kind` query instead of N counts, and the FE renders the list with Hungarian labels. Zero-count kinds are omitted, exactly like the two sibling arrays (both are built from rows that exist).

**Tech Stack:** OpenAPI 3.0.3 fragments + `openapi-merge-cli` → generated `<Tag>Api` interfaces (backend) and `api.gen.ts` types (frontend); Java 21 / Spring Boot / JPA; React 19 + TypeScript + Vitest.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.22)`. Conventional-commit subjects.
- **Contract-first is mandatory** (`docs/references/api_contract_conventions.md`): the fragment `api/feature/companion/companion.yml` changes FIRST, then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. Never hand-edit `api/openapi.yml` or `frontend/src/data/_client/api.gen.ts` — they are generated. Never hand-write a boundary DTO.
- **This is a BREAKING contract change** — `MemoryEmbeddingCounts{dailySummary, chatTurn}` is replaced, not extended. That is deliberate and safe here: the only consumer is this repo's own frontend, which ships with the backend. Do not keep the old fields "for compatibility"; two sources of truth for the same number is how they drift.
- **Spec §11:** integration-first tests. No new table → `support/ResetDatabase.java` and populators untouched. No new LLM/embed call site → no `LlmCallContextHolder` obligation.
- **Frontend conventions** (`docs/references/frontend_conventions.md`): data hooks only via the `@/data/hooks` barrel; dual-mode with an honest mock seed for every surface; both test modes must be green.
- **Backend gate:** focused ITs only (`./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true`, Docker up). Testcontainers mode is mandatory.
- **Frontend gate:** `pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`. **Both modes explicitly** — `isMockMode()` is `VITE_USE_MOCK !== 'false'`, so a bare `pnpm test` runs mock TWICE and the real-mode gate is vacuous.
- **Docs in the same change:** `docs/features/companion.md`'s memory-observatory section (+ `insights.md` if it describes this card); regenerate `docs/CODEMAP.md`; `node scripts/lint-docs.mjs` with no new staleness.

---

## File Structure

| File | Responsibility |
|---|---|
| **Modify** `api/feature/companion/companion.yml` (~:904-910) | `MemoryEmbeddingCounts` → `MemoryEmbeddingKindCount[]`. |
| **Generated** `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` | Regenerated, never hand-edited. |
| **Modify** `backend/.../companion/repository/MemoryEmbeddingRepository.java` | One `group by kind` projection finder. |
| **Modify** `backend/.../companion/service/MemoryObservatoryService.java` (~:129-136) | Fill the new shape from that one query. |
| **Modify** `backend/src/test/.../companion/MemoryObservatoryApiIT.java` (find the real name) | Assert every populated kind is reported. |
| **Modify** `frontend/src/data/types.ts` (~:640), `frontend/src/data/insights/memory.ts` (~:10) | Domain type + honest mock seed. |
| **Modify** `frontend/src/features/insights/components/MemoryLayersPanel.tsx` (~:58-69) | Render the list with Hungarian labels. |
| **Modify** `docs/features/companion.md`, `docs/CODEMAP.md` | Ship state. |

---

### Task 1: The contract, and both generators

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (Tasks 2 and 3 depend on these exact names):
  ```yaml
  MemoryEmbeddingKindCount:
    type: object
    required: [kind, count]
    properties:
      kind: { type: string }
      count: { type: integer }
  ```
  reached from `MemoryOverviewL1.embeddings`, which becomes an **array** of it.

- [ ] **Step 1: Read the conventions and the neighbours first**

Read `docs/references/api_contract_conventions.md` (the checklist near the end binds), then read `MemoryPatternCount` and `MemoryFactSourceCount` in the same fragment — the new schema must match their style exactly (`required` list, inline property maps, Hungarian `description` where the neighbours carry one).

- [ ] **Step 2: Change the fragment**

In `api/feature/companion/companion.yml`, `MemoryOverviewL1.embeddings` currently `$ref`s `MemoryEmbeddingCounts`. Make it an array of the new schema, delete `MemoryEmbeddingCounts`, and add `MemoryEmbeddingKindCount` next to its two siblings:

```yaml
        embeddings:
          type: array
          description: 'Vektorok kind szerint, csak a nem-üresek — a lista nő, ahogy új narratív kind kap írót (mezo-b3pp.22).'
          items: { $ref: '#/components/schemas/MemoryEmbeddingKindCount' }
```
```yaml
    MemoryEmbeddingKindCount:
      type: object
      required: [kind, count]
      properties:
        kind: { type: string, description: 'memory_embedding.kind — a ck_memory_embedding_kind CHECK egyik értéke.' }
        count: { type: integer }
```

Keep `embeddings` in `MemoryOverviewL1`'s `required` list if it is already there (an empty array is a valid answer; a missing field is not).

Do **not** pattern-constrain `kind` to the current ten values. The CHECK is the authority and it grows; a duplicated enum in the contract would go stale silently — the same reasoning `MemoryEmbeddingKindCount`'s description records.

- [ ] **Step 3: Regenerate both sides**

```bash
cd api/generate && npm run generate:api
cd frontend && pnpm generate:api
```
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` both change. If `api/openapi.yml` does not change, the fragment edit did not land where you think — stop and re-check, do not proceed.

- [ ] **Step 4: Confirm the generated output carries the new shape**

```bash
grep -n 'MemoryEmbeddingKindCount' api/openapi.yml frontend/src/data/_client/api.gen.ts | head
grep -rn 'MemoryEmbeddingCounts' api/ frontend/src/data/_client/ backend/src/main/java | head
```
Expected: the first finds the new schema on both sides; the second finds **nothing** except possibly a stale backend import that Task 2 fixes. The backend will not compile until Task 2 — that is expected and fine.

- [ ] **Step 5: Commit**

```bash
git add api/feature/companion/companion.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): memory observatory reports vectors per kind, not two fixed fields (mezo-b3pp.22)"
```

---

### Task 2: Backend fills the new shape from one query

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MemoryObservatoryService.java` (the `l1(...)` assembly, ~:129-136)
- Test: the existing memory-observatory IT — `CompanionMemoryOverviewApiIT` — extend it.

**Interfaces:**
- Consumes: the generated `MemoryEmbeddingKindCount` (Task 1) and `MemoryOverviewL1`.
- Produces:
  ```java
  interface KindCount { String getKind(); long getCount(); }
  List<KindCount> countByKindForUser(UUID createdBy);
  ```

- [ ] **Step 1: Write the failing test**

Read the existing observatory IT in full and mirror its harness. Add:

```
testOverview_shouldReportEveryPopulatedKind_whenSeveralNarrativeKindsHaveVectors
  seed memory_embedding rows across at least four kinds (e.g. daily_summary x2, chat_turn x3,
  journal_entry x1, gratitude x1) for the owner
  => l1.embeddings contains exactly those four kinds with those counts

testOverview_shouldOmitKindsWithNoVectors_whenTheStoreIsPartiallyPopulated
  => a kind with zero rows does NOT appear in the list (the MemoryFactSourceCount idiom —
     these arrays are built from rows that exist)

testOverview_shouldCountOnlyTheOwner_whenAnotherUserHasVectors
  seed a second user's vectors of the same kind => absent from this user's counts

testOverview_shouldIgnoreSoftDeletedVectors_whenSomeWereReaped
  seed two vectors of a kind, soft-delete one => count is 1
  (mezo-b3pp.26 made reaping real; a reaped vector must not inflate the observatory)

testOverview_shouldReturnAnEmptyList_whenTheUserHasNoVectors
  => l1.embeddings is empty, not null
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMemoryOverviewApiIT' -Dmezo.test.use-testcontainers=true
```
Expected: it does not compile — `MemoryEmbeddingCounts` no longer exists after Task 1's regeneration.

- [ ] **Step 3: Add the group-by finder**

In `MemoryEmbeddingRepository`, next to `countByCreatedByAndKind`:

```java
    /** Every populated kind for one user, with its live-vector count — the memory observatory's L1
     *  read (mezo-b3pp.22). ONE query instead of one `countByCreatedByAndKind` per kind: the
     *  {@code ck_memory_embedding_kind} CHECK has already grown from three values to ten, and the
     *  observatory must not need a code change every time it grows again. JPQL, so
     *  {@code @SQLRestriction("is_deleted = false")} applies — a reaped vector (mezo-b3pp.26) is
     *  correctly absent rather than inflating the reported store size. */
    interface KindCount {
        String getKind();
        long getCount();
    }

    @Query("select m.kind as kind, count(m) as count from MemoryEmbeddingEntity m "
            + "where m.createdBy = :createdBy group by m.kind order by count(m) desc, m.kind asc")
    List<KindCount> countByKindForUser(@Param("createdBy") UUID createdBy);
```

The `order by` is not cosmetic: it makes the response deterministic, which is what lets the IT and the FE test assert on a list rather than a set.

- [ ] **Step 4: Fill the new shape**

In `MemoryObservatoryService.overview`, replace the `.embeddings(MemoryEmbeddingCounts.builder()...build())` block with:

```java
                        .embeddings(memoryEmbeddingRepository.countByKindForUser(userId).stream()
                                .map(row -> MemoryEmbeddingKindCount.builder()
                                        .kind(row.getKind())
                                        .count((int) row.getCount())
                                        .build())
                                .toList())
```

Fix the imports (`MemoryEmbeddingKindCount` in, `MemoryEmbeddingCounts` out). If `MemoryEmbeddingEntity.KIND_DAILY_SUMMARY`/`KIND_CHAT_TURN` become unused in this file, drop those imports too — but grep first, the class uses them elsewhere.

- [ ] **Step 5: Run the tests — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMemoryOverviewApiIT' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): the observatory counts every embedding kind in one query (mezo-b3pp.22)"
```

---

### Task 3: The frontend renders the list

**Files:**
- Modify: `frontend/src/data/types.ts` (~:640)
- Modify: `frontend/src/data/insights/memory.ts` (~:10, the mock seed)
- Modify: `frontend/src/data/insights/memoryApi.ts` (the wire→domain mapping, if it maps this field explicitly)
- Modify: `frontend/src/features/insights/components/MemoryLayersPanel.tsx` (~:58-69)
- Test: `frontend/src/features/insights/components/MemoryLayersPanel.test.tsx` (extend, or create if absent) and `frontend/src/data/insights/memoryHooks.test.tsx` if it asserts the shape

**Interfaces:**
- Consumes: the regenerated `api.gen.ts` type from Task 1 and the backend shape from Task 2.

- [ ] **Step 1: Write the failing test**

Read `MemoryLayersPanel.tsx` and any existing test for it, plus `memoryHooks.test.tsx`, and mirror their harness. Cases:

```
renders one stat line per populated embedding kind, with a Hungarian label
  given embeddings [{kind:'daily_summary',count:38},{kind:'chat_turn',count:112},
                    {kind:'journal_entry',count:9}]
  => the card shows "38 nap-vektor", "112 chat-vektor", "9 napló-vektor"
     (keep the two existing labels EXACTLY as they read today — "nap-vektor" and "chat-vektor" —
      so this is a widening, not a silent copy change)

falls back to the raw kind when a kind has no label yet
  given embeddings [{kind:'brand_new_kind',count:4}]
  => the card shows "4 brand_new_kind-vektor" (or your chosen fallback) and does NOT crash
     — the whole point of the array shape is that the backend can add a kind before the FE knows it

renders no vector lines when embeddings is empty
  => the card still renders (summary count, date range) and shows no vector stat
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd frontend && pnpm vitest run src/features/insights src/data/insights
```

- [ ] **Step 3: Update the domain type and the mock seed**

`frontend/src/data/types.ts` — replace `embeddings: { dailySummary: number; chatTurn: number }` with:
```ts
    embeddings: MemoryEmbeddingKindCount[]
```
and declare, next to `MemoryPatternCount`/`MemoryFactSourceCount` (match their exact style):
```ts
export interface MemoryEmbeddingKindCount {
  kind: string
  count: number
}
```

`frontend/src/data/insights/memory.ts` — the mock seed currently reads `embeddings: { dailySummary: 38, chatTurn: 112 }`. Make it an honest seed that exercises the widening: keep 38/112 and add the narrative kinds a real store would now hold, e.g.
```ts
    embeddings: [
      { kind: 'chat_turn', count: 112 },
      { kind: 'daily_summary', count: 38 },
      { kind: 'journal_entry', count: 9 },
      { kind: 'gratitude', count: 6 },
      { kind: 'reflection', count: 4 },
    ],
```
ordered the way the backend orders (count desc, then kind asc) so mock and real modes agree.

- [ ] **Step 4: Render the list**

In `MemoryLayersPanel.tsx`, add a label map near the other module constants and build the stat lines from it:

```tsx
/** Hungarian labels for `memory_embedding.kind` (mezo-b3pp.22). The backend sends whatever kinds
 *  are populated, and the CHECK list grows — an unknown kind falls back to its raw key rather than
 *  vanishing, so a new writer is visible here the day it ships, before this map learns about it. */
const EMBEDDING_KIND_LABEL: Record<string, string> = {
  daily_summary: 'nap',
  chat_turn: 'chat',
  weekly_summary: 'heti',
  monthly_summary: 'havi',
  journal_entry: 'napló',
  reflection: 'esti',
  gratitude: 'hála',
  decision: 'döntés',
  activity_note: 'tevékenység',
  checkin_note: 'check-in',
}
```

and replace the two hardcoded lines in `stats={[...]}`:
```tsx
        stats={[
          ...l1.embeddings.map((e) => `${e.count} ${EMBEDDING_KIND_LABEL[e.kind] ?? e.kind}-vektor`),
          l1.firstDate && l1.lastDate ? `${l1.firstDate} – ${l1.lastDate}` : 'még üres',
        ]}
```

Check what `stats` does with a long list before shipping — if the card truncates or wraps badly at ten entries, deal with it here (the same file's existing layout decides how; do not add a new component for it).

- [ ] **Step 5: Run the tests — expect PASS, both modes**

```bash
cd frontend && pnpm vitest run src/features/insights src/data/insights
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/insights src/data/insights
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(insights): the memory observatory lists every embedding kind (mezo-b3pp.22)"
```

---

### Task 4: Docs + full gates

**Files:**
- Modify: `docs/features/companion.md` — the memory-observatory section (grep for `MemoryEmbeddingCounts` / "observatory" / "memoria"); bump `updated:`.
- Modify: `docs/features/insights.md` if it describes the L1 card's contents.
- Modify: `docs/CODEMAP.md` (regenerate).

- [ ] **Step 1: Update the docs**

The prose must now say: the L1 embeddings figure is a **list per kind**, not two fixed fields; it is one `group by kind` query, `@SQLRestriction`-filtered so a reaped vector (`mezo-b3pp.26`) does not inflate it; zero-count kinds are omitted, matching the two sibling arrays in the same response; and the FE falls back to the raw kind key for a kind it has no label for, so a new writer shows up the day it ships. Record the shape decision and why ten fixed fields was rejected (the CHECK list has already grown three → ten; an array needs no contract change next time). Note the breaking contract change explicitly — `MemoryEmbeddingCounts` is gone.

- [ ] **Step 2: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs 2>&1 | tail -5
```
Expected: `--check` passes; `lint-docs` no NEW findings versus the pre-edit baseline (capture it before editing).

- [ ] **Step 3: Full gates, both FE modes**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMemoryOverviewApiIT,MemoryRecallServiceIT' -Dmezo.test.use-testcontainers=true
cd frontend && pnpm build
cd frontend && VITE_USE_MOCK=false pnpm test
cd frontend && VITE_USE_MOCK=true pnpm test
```
Both FE runs must be green. A bare `pnpm test` is NOT a real-mode run — `isMockMode()` is `VITE_USE_MOCK !== 'false'`, so the variable must be set explicitly to `false`.

- [ ] **Step 4: Confirm the contract is in sync (this is a CI gate)**

```bash
cd api/generate && npm run generate:api
cd frontend && pnpm generate:api
git status --short
```
Expected: **no diff**. CI's `contract-drift` job runs exactly this; a dirty tree here means a generated file was hand-edited or a regeneration was skipped.

- [ ] **Step 5: Commit**

```bash
git add docs/features docs/CODEMAP.md
git commit -m "docs(features): companion — the observatory reports every embedding kind (mezo-b3pp.22)"
```

---

## Self-Review

- **bd coverage.** "counts only `daily_summary` and `chat_turn`" → Task 2's `group by kind`. "widen `MemoryEmbeddingCounts` ... (or a kind→count map)" → Task 1, resolved to the array shape its two siblings in the same response already use, with the reasoning recorded. "update the FE memory observatory consumer + `docs/features/companion.md` together (contract-first)" → Tasks 1, 3 and 4, in that order, with the drift check as an explicit gate step.
- **What this plan adds beyond the bd:** the soft-delete case (the bd predates `mezo-b3pp.26`, which made reaping real — a reaped vector must not inflate the count, and there is now an IT for it), the unknown-kind FE fallback (without it the array shape buys nothing: a new writer would still be invisible until the FE shipped a label), and the deterministic `order by` that makes list assertions legitimate.
- **Placeholders.** Production code is literal. Test bodies are named cases with exact seed→act→assert; the observatory IT is `CompanionMemoryOverviewApiIT`, verified to exist.
- **Type consistency.** `MemoryEmbeddingKindCount {kind: string, count: integer}` is declared once in Task 1 and consumed by name in Task 2 (Java builder) and Task 3 (TS interface). `KindCount {getKind(), getCount()}` is produced in Task 2 Step 3 and consumed in Step 4 — note `getCount()` returns `long` (JPQL `count()`) and is cast to `int` for the DTO, matching how `MemoryFactSourceCount` already carries `int`.
