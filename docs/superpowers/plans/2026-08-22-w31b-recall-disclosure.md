# W3.1b Emlékek disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make W3.1's ambient recall visible: every assistant message carries the memories that were injected into its prompt (`MessageResponse.recalled`), persisted on the row, and the chat UI shows a collapsible „Emlékek · N" row under the bubble (date · source · gist · match %).

**Architecture:** `PromptMemoryAssembler.AmbientRecall` exposes the rendered items (not only the Memory refs); `ChatService` persists them as a typed jsonb envelope in a new `ai_message.recalled_memories` column (the `refs`/`tool_calls` envelope precedent) on both the sync and the streamed path; `CompanionMapper` maps the envelope to the contract's `RecalledMemory[]`; the FE maps it onto the `ChatMessage` domain type and renders a `RecalledMemoriesRow` (the `ToolChipRow`/`LifecycleSection` idioms) with mock-mode seeds and MSW fixtures in both modes. Additive contract change only.

**Tech Stack:** OpenAPI fragments → `openapi-generator` (BE) + `openapi-typescript` (FE); Spring Boot 3 / Hibernate `@JdbcTypeCode(SqlTypes.JSON)`; Liquibase SQL changesets; React + Vitest + MSW; Playwright visual goldens.

**Driving bd issue:** `mezo-b3pp.28` — every commit subject ends with `(mezo-b3pp.28)`. Branch `feat/recall-disclosure` (cut from origin/main at `fac81ba8`, which contains W3.1).

## Global Constraints

- Worktree only: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/phase-3-status-b1a9fa`; never `cd` to the primary repo.
- Contract-first: edit `api/feature/companion/companion.yml`, then `cd api/generate && npm run generate:api` and `cd frontend && pnpm generate:api`; commit `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` (CI contract-drift gate). Backend DTOs are generated on build (`io.mrkuhne.mezo.api.dto.*`) — never hand-write boundary DTOs.
- New column → Liquibase changeset `backend/src/main/resources/db/changelog/1.0.0/script/202608221700_mezo-b3pp.28_ai_message_recalled_memories.sql` registered in `1.0.0/1.0.0_master.yml` (`id: "1.0.0:<filename stem>"`, `author: daniel.kuhne`, `sqlFile.relativeToChangelogFile: true`). No new table ⇒ no `ResetDatabase`/populator change.
- ArchUnit: no class-level `@Transactional`, no `@Value`, no raw `RuntimeException` construction; `@Service` in `..service..`, entities in `..entity..`.
- Backend tests from `backend/`: `./mvnw test -Dtest='…' -Dmezo.test.use-testcontainers=true` (long timeout; capture `MVN_EXIT=$?` via redirect, never through a pipe). Tests that assert a COMMIT live in non-`@Transactional` classes (`ChatServiceAmbientRecallIT` precedent).
- Frontend: hooks only via `@/data/hooks`; domain types in `data/types.ts`; real path typed off `api.gen.ts`; mock seeds honest in both modes; `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` must be green (bare `pnpm test` in this worktree runs mock mode unless `VITE_USE_MOCK=false` — run real mode explicitly: `VITE_USE_MOCK=false pnpm test`).
- Wire shape (exact): `MessageResponse.recalled: RecalledMemory[]` **required, `[]` when none** (like `tools`/`refs`); `RecalledMemory { occurredOn: string(date), kind: string, label: string, gist: string, similarity: number }` all required; `similarity` is the raw cosine 0..1 (the FE renders `Math.round(s*100)%`).
- Hungarian copy: row header „Emlékek · N", item line `<YYYY-MM-DD> · <label> · <NN>%` then the gist; tooltip „Ezekre emlékezett a társ a válasz előtt (W3.1 ambient recall)".
- Docs in the same change: `docs/features/companion.md` (§2 user-facing, §3 flow line, §4 table column + API schema, §8 tests, §10 key files), `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs`.

## File map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `api/feature/companion/companion.yml` | `MessageResponse.recalled` + `RecalledMemory` schema |
| Regen | `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` | generated |
| Create | `backend/.../db/changelog/1.0.0/script/202608221700_mezo-b3pp.28_ai_message_recalled_memories.sql` + master.yml entry | column |
| Create | `backend/.../feature/companion/entity/RecalledMemoriesEnvelope.java` | typed jsonb envelope |
| Modify | `backend/.../feature/companion/entity/AiMessageEntity.java` | `recalledMemories` field |
| Modify | `backend/.../feature/companion/service/PromptMemoryAssembler.java` | `AmbientRecall.items` |
| Modify | `backend/.../feature/companion/service/ChatService.java`, `ChatStreamService.java` | persist the envelope on both paths |
| Modify | `backend/.../feature/companion/mapper/CompanionMapper.java` | `toRecalled` |
| Modify | ITs: `PromptMemoryAssemblerIT`, `ChatServiceAmbientRecallIT`, `ChatStreamServiceIT`, `CompanionApiIT`, `CompanionStreamApiIT`, `ConversationServiceIT`/history IT if present | coverage |
| Modify | `frontend/src/data/types.ts`, `frontend/src/data/insights/chatApi.ts`, `frontend/src/data/insights/chat.ts`, `frontend/src/data/insights/chatHooks.ts` (sendMock), `frontend/src/test/msw/handlers.ts` | domain type, mapping, seeds, fixtures |
| Create | `frontend/src/features/insights/components/RecalledMemoriesRow.tsx` | the disclosure |
| Modify | `frontend/src/features/insights/components/ChatMessage.tsx`, `frontend/src/features/insights/pages/ChatPage.test.tsx` | render + tests |
| Regen | `frontend/tests/visual/visual.spec.ts-snapshots/insights-chat-*.png` | goldens (darwin locally, linux via workflow) |
| Modify | `docs/features/companion.md`, `docs/CODEMAP.md` | docs |

---

### Task 1: Contract + backend — persist and expose the recalled memories

**Files:** see map (contract, migration, envelope, entity, assembler, ChatService, ChatStreamService, mapper, ITs).

**Interfaces:**
- Produces: `RecalledMemoriesEnvelope(List<Item> items)` with `record Item(String kind, UUID refId, LocalDate occurredOn, String label, String gist, double similarity)`; `AiMessageEntity.getRecalledMemories()`; `PromptMemoryAssembler.AmbientRecall(String block, List<RefsEnvelope.Ref> refs, List<RecalledMemoriesEnvelope.Item> items)`; `ChatService.PreparedTurn(..., List<RefsEnvelope.Ref> recalledRefs, RecalledMemoriesEnvelope recalled)`; `ChatService.completeTurn(..., ToolCallAudit audit, boolean degraded, RecalledMemoriesEnvelope recalled)`; generated `MessageResponse.getRecalled()` → `List<RecalledMemory>` (`getOccurredOn(): LocalDate`, `getKind()`, `getLabel()`, `getGist()`, `getSimilarity(): Double`).

- [ ] **Step 1: Contract.** In `api/feature/companion/companion.yml` extend `MessageResponse`:

```yaml
    MessageResponse:
      type: object
      required: [id, role, content, createdAt, tools, refs, recalled, degraded]
      properties:
        …existing…
        recalled:
          type: array
          description: >-
            W3.1b (mezo-b3pp.28): the memories ambient recall injected into this answer's prompt
            (the [Emlékek] block), in prompt order — date + source + one-line gist + raw cosine
            similarity. Empty on user rows, on pre-W3.1 rows, and when recall found nothing or
            failed (the turn is never degraded by a failed recall).
          items: { $ref: '#/components/schemas/RecalledMemory' }
    RecalledMemory:
      type: object
      required: [occurredOn, kind, label, gist, similarity]
      properties:
        occurredOn: { type: string, format: date, description: "The day the remembered episode happened" }
        kind: { type: string, description: "memory_embedding.kind (journal_entry | daily_summary | chat_turn | …)" }
        label: { type: string, description: "Hungarian source tag as rendered in the prompt (napló, napi összefoglaló, …)" }
        gist: { type: string, description: "The one-line excerpt that was injected (first line, capped)" }
        similarity: { type: number, format: double, minimum: 0, maximum: 1, description: "Raw cosine similarity to the user message" }
```
Run `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`; `git diff --stat api/openapi.yml frontend/src/data/_client/api.gen.ts` shows both changed.

- [ ] **Step 2: Migration.** File `202608221700_mezo-b3pp.28_ai_message_recalled_memories.sql`:
```sql
-- W3.1b (bd mezo-b3pp.28): the memories ambient recall injected into an answer's prompt,
-- persisted next to refs/tool_calls as a typed jsonb envelope so history re-renders the
-- „Emlékek" disclosure. Additive; null on user rows and on every pre-W3.1 answer.
alter table ai_message add column recalled_memories jsonb;
```
Register in `1.0.0_master.yml` after the last changeset (`202608221200_mezo-b3pp.16_create_feedback_rollup`), same 6-line idiom.

- [ ] **Step 3: Envelope + entity.** `entity/RecalledMemoriesEnvelope.java`:
```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Typed jsonb envelope for ai_message.recalled_memories (W3.1b, mezo-b3pp.28) — what the
 * [Emlékek] block carried into this answer's prompt, in prompt order. The RefsEnvelope precedent:
 * null when nothing was recalled; {@code label}/{@code gist} are snapshots of what was rendered.
 */
public record RecalledMemoriesEnvelope(List<Item> items) {

    public record Item(String kind, UUID refId, LocalDate occurredOn, String label, String gist, double similarity) {
    }
}
```
`AiMessageEntity` after `refs`:
```java
    /** W3.1b: the memories ambient recall injected into this answer's prompt — null when none. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recalled_memories", columnDefinition = "jsonb")
    private RecalledMemoriesEnvelope recalledMemories;
```

- [ ] **Step 4: Assembler exposes items.** In `PromptMemoryAssembler`: `public record AmbientRecall(String block, List<RefsEnvelope.Ref> refs, List<RecalledMemoriesEnvelope.Item> items) { public static final AmbientRecall EMPTY = new AmbientRecall("", List.of(), List.of()); }`. In `recall(...)`, after computing `rendered`, build `items` from `rendered.rendered()` in order: `new RecalledMemoriesEnvelope.Item(item.kind(), item.refId(), item.occurredOn(), KIND_LABELS.getOrDefault(item.kind(), item.kind()), oneLine(item.content(), recall.renderMaxChars()), item.similarity())` and return `new AmbientRecall(rendered.block(), List.copyOf(refs), items)`. (Reuse `oneLine` so the gist is byte-identical to the prompt line.) Add a helper `public static RecalledMemoriesEnvelope toEnvelope(List<RecalledMemoriesEnvelope.Item> items)` returning `null` for empty — hmm, put that on the envelope record instead: `public static RecalledMemoriesEnvelope ofOrNull(List<Item> items) { return items == null || items.isEmpty() ? null : new RecalledMemoriesEnvelope(List.copyOf(items)); }`.

- [ ] **Step 5: ChatService + ChatStreamService.** `persistMessage(...)` gains a trailing `RecalledMemoriesEnvelope recalled` param → `message.setRecalledMemories(recalled)`; user rows pass `null`. `sendMessage`: assistant row gets `RecalledMemoriesEnvelope.ofOrNull(recalled.items())`. `PreparedTurn` gains `RecalledMemoriesEnvelope recalled` (after `recalledRefs`); `prepareTurn` passes `RecalledMemoriesEnvelope.ofOrNull(recalled.items())`. `completeTurn(..., boolean degraded, RecalledMemoriesEnvelope recalled)` persists it. `ChatStreamService` passes `turn.recalled()` to `completeTurn`. Grep for other `completeTurn`/`PreparedTurn` callers (e.g. advisor ITs) and update.

- [ ] **Step 6: Mapper.** `CompanionMapper.toMessageResponse` adds `.recalled(toRecalled(entity.getRecalledMemories()))`; 
```java
    default List<RecalledMemory> toRecalled(RecalledMemoriesEnvelope envelope) {
        if (envelope == null || envelope.items() == null) {
            return List.of();
        }
        return envelope.items().stream()
                .map(item -> RecalledMemory.builder()
                        .occurredOn(item.occurredOn()).kind(item.kind()).label(item.label())
                        .gist(item.gist()).similarity(item.similarity()).build())
                .toList();
    }
```

- [ ] **Step 7: Tests (TDD — write first, see them fail on compile/assert, then implement 2–6).**
  - `PromptMemoryAssemblerIT`: in the first render test assert `recalled.items()` has 4 items in score order with `label`/`gist`/`occurredOn` (gist of the daily summary = "Kemény nap volt."), similarity ≈ 1.0; in the same-day collapse test assert `items()` has 2 but `refs()` 1; failure tests assert `items()` empty (`EMPTY`).
  - `ChatServiceAmbientRecallIT` (non-transactional): in the block-position test assert `answer.getRecalled()` has one item `occurredOn = today-3`, `kind = journal_entry`, `label = "napló"`, `gist = "futás után jobban aludtam"`, `similarity` within 1e-6 of 1.0; and the persisted row `getRecalledMemories().items()` matches; in the embed-failure and ANN-failure tests assert `getRecalled()` is empty and the persisted row's `recalledMemories` is null; the user row's is null.
  - `ChatStreamServiceIT` streamed memories test: the `done` row's `getRecalled()` carries the item; the persisted assistant row too.
  - `CompanionApiIT.testSendMessage_…`: add `assertThat(answer.getRecalled()).isEmpty()`; add a history round-trip: after a recall-bearing turn (seed a journal vector via `MemoryEmbeddingPopulator` — check the class's fixture idiom and whether it is `@Transactional`; if it is, put the test in `ChatServiceAmbientRecallIT` using `conversationService.listMessages` instead) `GET /messages` returns the assistant row with `recalled` populated.
  - `CompanionStreamApiIT`: SSE body of a recall-bearing turn contains `"recalled":[{` and `"label":"napló"` (seed via populator; the class is non-transactional per its SSE nature — verify).

- [ ] **Step 8: Gates.** `cd backend && ./mvnw test -Dtest='ArchitectureTest,PromptMemoryAssemblerTest,PromptMemoryAssemblerIT,ChatServiceIT,ChatServiceAmbientRecallIT,ChatStreamServiceIT,ChatStreamAdvisorIT,CompanionApiIT,CompanionStreamApiIT,CompanionAdvisorsSwitchOffIT,ConversationServiceIT,LiquibaseChangelog*IT' -Dmezo.test.use-testcontainers=true` → BUILD SUCCESS (drop names that do not exist). Also run `node scripts/lint-liquibase.mjs` if it exists.

- [ ] **Step 9: Commit** (contract + regen + backend + tests in one): `feat(companion): persist and expose the recalled memories behind every answer (mezo-b3pp.28)`.

---

### Task 2: Frontend — `RecalledMemoriesRow` under the assistant bubble, both modes

**Files:** `frontend/src/data/types.ts`, `frontend/src/data/insights/chatApi.ts`, `frontend/src/data/insights/chat.ts`, `frontend/src/data/insights/chatHooks.ts`, `frontend/src/test/msw/handlers.ts`, create `frontend/src/features/insights/components/RecalledMemoriesRow.tsx`, modify `ChatMessage.tsx`, `ChatPage.test.tsx`.

**Interfaces:**
- Consumes: generated `components['schemas']['RecalledMemory']` from `api.gen.ts` (Task 1 regen).
- Produces: `export interface ChatRecalledMemory { occurredOn: string; kind: string; label: string; gist: string; similarity: number }` and `ChatMessage.recalled?: ChatRecalledMemory[]` in `data/types.ts`; `toChatMessage` maps `recalled: m.recalled.length ? m.recalled : undefined`.

- [ ] **Step 1: Failing tests.** In `ChatPage.test.tsx`, BOTH describe blocks:
  - mock mode: `test('the first assistant message shows a collapsed Emlékek row that reveals the recalled gists', …)` — `await screen.findByText(/Emlékek · 2/)`; the gist `'futás után jobban aludtam'` is NOT in the document; `fireEvent.click(screen.getByText(/Emlékek · 2/))`; now `screen.getByText('futás után jobban aludtam')` and `screen.getByText(/napló · 92%/)` are present.
  - real mode: after the streamed reply lands (existing test idiom), `screen.getByText(/Emlékek · 1/)`; click → `screen.getByText('korábban is rosszul aludtál edzés után')` present. Also the history fixture's first assistant message shows `Emlékek · 2`.
- [ ] **Step 2: Types + mapping.** `types.ts`: add `ChatRecalledMemory` (after `ChatRef`) and `recalled?: ChatRecalledMemory[]` on `ChatMessage` with a one-line doc (W3.1b). `chatApi.toChatMessage`: `recalled: m.recalled.length ? m.recalled : undefined`.
- [ ] **Step 3: Seeds + fixtures.** `chat.ts` `initialChat[0]` (the first assistant message) gains
```ts
    recalled: [
      { occurredOn: '2026-05-18', kind: 'journal_entry', label: 'napló', gist: 'futás után jobban aludtam', similarity: 0.92 },
      { occurredOn: '2026-05-12', kind: 'daily_summary', label: 'napi összefoglaló', gist: 'Kemény Pull Day, este korán ágyba.', similarity: 0.71 },
    ],
```
  `chatHooks.sendMock` canned assistant reply gains `recalled: [{ occurredOn: '2026-05-19', kind: 'chat_turn', label: 'korábbi beszélgetés', gist: 'Daniel: fáradt vagyok ma', similarity: 0.66 }]`. `handlers.ts`: the `GET /messages` mapping adds `recalled: m.recalled ?? []`; the streamed `done` frame adds `recalled: [{ occurredOn: '2026-07-01', kind: 'journal_entry', label: 'napló', gist: 'korábban is rosszul aludtál edzés után', similarity: 0.88 }]`.
- [ ] **Step 4: Component.** `RecalledMemoriesRow.tsx`:
```tsx
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'   // verify the Icon import path used by LifecycleSection.tsx
import type { ChatRecalledMemory } from '@/data/types'

/** W3.1b (mezo-b3pp.28): what ambient recall put in front of the model before it answered —
 *  collapsed by default (the answer is the point; this is its provenance), one line per memory. */
export function RecalledMemoriesRow({ items }: { items: ChatRecalledMemory[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="col gap-xs" style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="row gap-xs"
        style={{ alignItems: 'center', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
        title="Ezekre emlékezett a társ a válasz előtt (W3.1 ambient recall)"
        aria-expanded={open}
      >
        <span className="eyebrow text-tertiary" style={{ fontSize: 9 }}>Emlékek · {items.length}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
      </button>
      {open && (
        <ul className="col gap-xs" style={{ listStyle: 'none', margin: 0, padding: '0 0 0 2px' }}>
          {items.map((r, i) => (
            <li key={i} className="col" style={{ fontSize: 11 }}>
              <span className="text-tertiary" style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>
                {r.occurredOn} · {r.label} · {Math.round(r.similarity * 100)}%
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.gist}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```
  `ChatMessage.tsx`: render `{m.recalled && <RecalledMemoriesRow items={m.recalled} />}` directly after the card `</div>` and before the feedback chips (assistant branch only).
- [ ] **Step 5: Gates.** `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test` → all green; `pnpm lint` if a script exists.
- [ ] **Step 6: Commit:** `feat(fe): Emlékek disclosure under the companion answer — recalled memories row (mezo-b3pp.28)`.

---

### Task 3: Visual goldens + docs + codemap

- [ ] **Step 1:** `cd frontend && pnpm test:visual` — expect `insights-chat-*-darwin.png` to differ (the first assistant bubble gains the collapsed „Emlékek · 2" row). Inspect the diff image once (it must be ONLY that row), then `pnpm test:visual:update`; commit the darwin goldens: `test(visual): insights-chat goldens — Emlékek row (mezo-b3pp.28)`. The linux goldens come from `gh workflow run update-visual-baselines.yml -r feat/recall-disclosure` after push (controller step).
- [ ] **Step 2: Docs** `docs/features/companion.md`: §2 user-facing — a bullet describing the „Emlékek · N" row (collapsed, date · source · %, gist); §3 — in both prompt-order renderings note that the rendered items are persisted as `ai_message.recalled_memories` and returned as `MessageResponse.recalled` (sync row / streamed `done` row); §4 — `ai_message` column list gains `recalled_memories jsonb` (W3.1b, migration name) and the API schema note (`RecalledMemory`); §8 — the new IT assertions + the FE `ChatPage.test.tsx` cases in both modes + visual goldens moved; §10 key files — `RecalledMemoriesEnvelope.java`, `RecalledMemoriesRow.tsx`, the migration. `updated: 2026-08-22`. Then `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only`. Commit LAST: `docs(companion): W3.1b Emlékek disclosure — contract, column, UI (mezo-b3pp.28)`.
