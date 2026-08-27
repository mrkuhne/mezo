# Feedback batch read is chunked — Implementation Plan (`mezo-b3pp.23`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stop the page-hydration feedback read from silently losing the whole page's 👍/👎 state on a long conversation — and stop it silently losing the oldest chips on an even longer one.

**The bug, and the second one underneath it.** `useFeedback` comma-joins up to `FEEDBACK_MAX_IDS = 200` uuids into a `GET /api/companion/feedback` query string. 200 uuids ≈ 7399 chars, so the request line is ~7.45 KB before `Authorization: Bearer …` and the browser's own headers — over Tomcat's default 8 KB `server.max-http-request-header-size`, which this repo does not override. Tomcat answers a bare 400 with no `SystemMessageList` body, `useDualQuery` degrades to `realEmpty`, and **every chip on the page reads unvoted** — then the invalidate after the next vote reverts the chip the user just tapped. Underneath that, `feedbackHooks.ts:75` does `[...new Set(ids)].slice(-FEEDBACK_MAX_IDS)`, so a conversation past 200 assistant messages **already** shows its oldest chips as unvoted, quietly, today.

**The decision (neither of the bd's two options).** The issue offers "set `server.max-http-request-header-size: 16KB`" or "lower `FEEDBACK_MAX_IDS` to ~120". Both are band-aids and the second makes the truncation strictly worse — it would start losing chips at 120 instead of 200. Confirmed with the human partner: **chunk the request instead**. `feedbackApi.list` splits the ids into header-safe batches, fires them together and merges. That removes the header wall *and* the truncation, needs no server config change, and needs no contract change — each chunk is far below the contract's `maxItems: 200`.

**Architecture:** the chunking lives entirely inside `feedbackApi.list`, so `useFeedback` still runs **one** query with **one** cache key. Every piece of the hook's cache machinery (`feedbackQueryKeys`, `writeRow`, the mock branch, the dual-mode key derivation) is untouched — that is the whole reason to chunk in the api layer rather than fan out queries.

**Tech Stack:** React 19 + TypeScript, TanStack Query v5, Vitest + Testing Library + MSW.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.23)`. Conventional-commit subjects.
- **No backend change, no contract change.** Do not touch `api/feature/**`, `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`, or `application.yml`. Do not run the generators. The contract's `maxItems: 200` stays exactly as it is — the fix keeps every request well under it.
- `docs/references/frontend_conventions.md` binds: deep absolute `@/*` imports only (never relative `../`), no `index.ts` barrels, data hooks only through the `@/data/hooks` barrel, `var(--token)` colors only.
- **Both FE test modes must be green, run explicitly:** `VITE_USE_MOCK=false pnpm test` and `VITE_USE_MOCK=true pnpm test`. `isMockMode()` is `VITE_USE_MOCK !== 'false'`, so a bare `pnpm test` is a MOCK run and the real-mode gate would be vacuous.
- **Docs in the same change:** `docs/features/companion.md`'s W4.1 feedback section; `node scripts/lint-docs.mjs` with no new staleness.

---

## File Structure

| File | Responsibility |
|---|---|
| **Modify** `frontend/src/data/feedback/feedbackApi.ts` | `list` chunks, fires, merges; the two constants and their reasoning. |
| **Modify** `frontend/src/data/feedback/feedbackHooks.ts` (~:75) | Stop truncating at the old single-request cap. |
| **Create** `frontend/src/data/feedback/feedbackApi.test.ts` | Chunk boundaries, merging, failure propagation — asserted against real request URLs via MSW. |
| **Modify** `frontend/src/data/feedback/feedbackHooks.test.tsx` | The no-longer-truncated case. |
| **Modify** `docs/features/companion.md` | Ship state + the recorded decision. |

---

### Task 1: `feedbackApi.list` chunks and merges

**Files:**
- Modify: `frontend/src/data/feedback/feedbackApi.ts`
- Test: `frontend/src/data/feedback/feedbackApi.test.ts` (new)

**Interfaces:**
- Produces (Task 2 depends on these names):
  ```ts
  /** Ids per HTTP request — a header-budget number, not a contract number. */
  export const FEEDBACK_IDS_PER_REQUEST = 100
  /** Overall ceiling on one page's hydration read, i.e. at most 10 requests. */
  export const FEEDBACK_MAX_IDS = 1000
  ```
  `feedbackApi.list(kind, ids)` keeps its exact signature `(kind: FeedbackArtifactKind, ids: string[]) => Promise<ArtifactFeedback[]>`.

- [ ] **Step 1: Write the failing test** — `feedbackApi.test.ts`

Read `frontend/src/data/feedback/feedbackHooks.test.tsx` first for the MSW/harness idiom in this folder, and note the default handler at `frontend/src/test/msw/handlers.ts:1325` returns `[]` for this GET. Your test overrides it per case with `server.use(...)` and **records the request URLs** so the chunking is asserted against what actually went over the wire, not against a mock of the api module. Cases:

```
list_shouldSendOneRequest_whenIdsFitInOneChunk
  100 ids => exactly 1 request; its `ids` param holds all 100

list_shouldSplitIntoTwoRequests_whenIdsExceedOneChunk
  101 ids => exactly 2 requests, of 100 and 1; the union of both `ids` params equals the input,
  with no id sent twice

list_shouldSplitIntoThreeRequests_whenIdsAreWellOverTwoChunks
  250 ids => exactly 3 requests (100/100/50)

list_shouldMergeEveryChunksRows_whenSeveralChunksAnswer
  seed the handler so chunk 1 answers one row and chunk 2 answers another
  => the resolved array contains BOTH rows, mapped through toArtifactFeedback
     (assert on artifactId + verdict, so a merge that drops a chunk fails)

list_shouldKeepEveryRequestUnderTheHeaderBudget
  200 ids => assert each request's full URL length is comfortably under 8192 bytes
  (this is the actual bug; a chunk size someone later raises "to save a round trip" must fail here)

list_shouldSendNoRequest_whenIdsIsEmpty
  [] => zero requests, resolves to []
  (a bare `?ids=` would be a contract violation and a wasted round trip)

list_shouldReject_whenOneChunkFails
  make the second chunk 500 => the whole call rejects
  (deliberate: a partially-merged answer would render some chips unvoted with no signal, which is
   the exact failure this slice exists to remove. Failing loudly lets useDualQuery degrade
   honestly, as it does today.)
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd frontend && pnpm vitest run src/data/feedback
```
Expected: the multi-chunk cases fail — today `list` sends exactly one request whatever it is given.

- [ ] **Step 3: Implement the chunking**

In `feedbackApi.ts`, replace the single `FEEDBACK_MAX_IDS = 200` constant and the `list` body:

```ts
/**
 * Ids per HTTP request. This is a HEADER-BUDGET number, not a contract number (the contract's
 * `maxItems` is 200 and every chunk stays well under it): a uuid costs ~37 chars comma-joined, so
 * 100 ids is a ~3.7 KB query string, leaving room for `Authorization: Bearer …` and the browser's
 * own headers inside Tomcat's default 8 KB `server.max-http-request-header-size` (mezo-b3pp.23).
 * At the old 200 the request line alone was ~7.45 KB, Tomcat answered a bare 400 with no
 * `SystemMessageList` body, and the page's every chip silently read unvoted.
 */
export const FEEDBACK_IDS_PER_REQUEST = 100

/**
 * Overall ceiling for one page's hydration read — at most ten requests. Chunking removed the
 * header wall, so this is purely about not fanning out unboundedly on a very long conversation
 * (`CompanionController.listMessages` returns the WHOLE conversation, unwindowed). Past this the
 * oldest ids are dropped, which is the same quiet truncation the old 200 had — just an order of
 * magnitude further out. The real cure is windowing the message read upstream.
 */
export const FEEDBACK_MAX_IDS = 1000
```

and

```ts
  /** Batch page-hydration read, chunked (mezo-b3pp.23). `ids` is comma-joined per chunk (OpenAPI
   * `style: form, explode: false`); ids that carry no verdict are simply absent from the response.
   * The chunks are merged here so the CALLER still sees one list and `useFeedback` still runs one
   * query with one cache key — chunking in the api layer is what keeps the hook's cache machinery
   * untouched. One failing chunk rejects the whole call on purpose: a partially merged answer
   * would render some chips unvoted with no signal at all. */
  list: async (kind: FeedbackArtifactKind, ids: string[]): Promise<ArtifactFeedback[]> => {
    if (ids.length === 0) {
      return []
    }
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += FEEDBACK_IDS_PER_REQUEST) {
      chunks.push(ids.slice(i, i + FEEDBACK_IDS_PER_REQUEST))
    }
    const pages = await Promise.all(
      chunks.map((chunk) =>
        apiFetch<FeedbackListResponse>(
          `/api/companion/feedback?kind=${kind}&ids=${chunk.map(encodeURIComponent).join(',')}`,
        ),
      ),
    )
    return pages.flat().map(toArtifactFeedback)
  },
```

Keep `toArtifactFeedback`, `put` and `remove` exactly as they are.

- [ ] **Step 4: Run the tests — expect PASS**

```bash
cd frontend && pnpm vitest run src/data/feedback
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data/feedback
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/feedback/feedbackApi.ts frontend/src/data/feedback/feedbackApi.test.ts
git commit -m "fix(feedback): chunk the batch read so it cannot exceed the request header limit (mezo-b3pp.23)"
```

---

### Task 2: The hook stops truncating

**Files:**
- Modify: `frontend/src/data/feedback/feedbackHooks.ts` (~:75)
- Modify: `frontend/src/data/feedback/feedbackHooks.test.tsx`

**Interfaces:**
- Consumes from Task 1: `FEEDBACK_MAX_IDS` (now 1000) and the chunking inside `feedbackApi.list`.

- [ ] **Step 1: Write the failing test**

Extend `feedbackHooks.test.tsx` in its existing harness and style:

```
useFeedback_shouldHydrateEveryChip_whenThePageRendersMoreThanTheOldSingleRequestCap
  render the hook with 250 ids, one of which is the FIRST (oldest) id and carries a verdict
  => `get(oldestId)` returns that verdict
  (before this slice the hook kept only the LAST 200, so the oldest id was never even requested
   and its chip read unvoted — assert on the oldest id specifically, not on a count)

useFeedback_shouldStillBoundTheRequest_whenThePageRendersMoreThanTheOverallCeiling
  render with FEEDBACK_MAX_IDS + 50 ids
  => the number of ids actually requested (summed across chunks) is FEEDBACK_MAX_IDS, and it is
     the NEWEST ones that survive (the existing `slice(-N)` semantics are preserved, just at a
     much higher N)
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd frontend && pnpm vitest run src/data/feedback
```

- [ ] **Step 3: Keep the slice, drop nothing else**

`feedbackHooks.ts:75` currently reads:
```ts
  const requestIds = useMemo(() => [...new Set(ids)].slice(-FEEDBACK_MAX_IDS), [ids])
```
This line does not change — but its meaning does, because `FEEDBACK_MAX_IDS` moved from 200 (a header-budget number that had leaked into the hook) to 1000 (a request-count ceiling). Update the comment above it, or add one if there is none, to say exactly that: the cap is no longer about what fits in one request — `feedbackApi.list` chunks — it is about not fanning out unboundedly, and past it the oldest ids are still dropped.

If the hook carries a doc comment describing the 200 cap or the single request anywhere (check the big `useFeedback` javadoc), correct it too — a stale "one HTTP request per page" claim would now be false.

- [ ] **Step 4: Run the tests — expect PASS, both modes**

```bash
cd frontend && pnpm vitest run src/data/feedback src/features/companion
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data/feedback src/features/companion
```
(adjust the second path to wherever the feedback chips are consumed — grep for `useFeedback` to find every page that mounts it, and include those suites.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/feedback
git commit -m "fix(feedback): hydrate every chip on a long page, not only the newest 200 (mezo-b3pp.23)"
```

---

### Task 3: Docs + full gates

**Files:**
- Modify: `docs/features/companion.md` — the W4.1 feedback section (grep for `FEEDBACK_MAX_IDS`, "batch", "200"); bump `updated:`.

- [ ] **Step 1: Update the docs**

The prose must now say:
- The batch read is **chunked** at `FEEDBACK_IDS_PER_REQUEST` ids per request, and why that number exists: a header budget, not a contract limit. Name the concrete failure it removes — at 200 the request line was ~7.45 KB, over Tomcat's default 8 KB limit, and the bare 400 made `useDualQuery` degrade to empty so *every* chip on the page read unvoted, with the next vote's invalidate then reverting the chip the user had just tapped.
- The chunking lives in the **api layer**, so `useFeedback` still runs one query with one cache key and none of its cache machinery changed.
- One failing chunk **rejects the whole call**, deliberately — a partial merge would show some chips unvoted with no signal.
- `FEEDBACK_MAX_IDS` is now an overall ceiling (ten requests), not a header limit, and past it the oldest ids are still dropped. Say plainly that the real cure for a very long page is windowing `CompanionController.listMessages`, which returns the whole conversation today.
- Record the decision: the bd offered a 16 KB header override or lowering the cap to ~120; both were rejected, the second because it would have made the existing silent truncation start at 120 instead of 200.

- [ ] **Step 2: Lint the docs**

```bash
node scripts/lint-docs.mjs 2>&1 | tail -5
```
No NEW findings versus the pre-edit baseline (capture it by running the linter once before editing).

- [ ] **Step 3: Full frontend gates, both modes explicitly**

```bash
cd frontend && pnpm build
cd frontend && VITE_USE_MOCK=false pnpm test
cd frontend && VITE_USE_MOCK=true pnpm test
```
Both green. No backend gate — this slice touches no Java. No `gen-codemap` regeneration is needed unless a new source directory appeared; run `node scripts/gen-codemap.mjs --check` to confirm rather than assuming.

- [ ] **Step 4: Commit**

```bash
git add docs/features/companion.md
git commit -m "docs(features): companion — the feedback batch read is chunked (mezo-b3pp.23)"
```

---

## Self-Review

- **bd coverage.** "200 uuids = 7399 chars … over Tomcat's 8 KB default" → Task 1's chunk size, pinned by `list_shouldKeepEveryRequestUnderTheHeaderBudget`. "Tomcat rejects with a bare 400 … every chip silently reads unvoted" → removed, because no request can reach the limit any more. The bd's two proposed fixes are explicitly rejected in the docs with the reasoning, per the human partner's decision.
- **What this plan adds beyond the bd:** the truncation the bd never mentions. `feedbackHooks.ts:75` already dropped everything but the newest 200 ids, so a long conversation's oldest chips read unvoted **today**, before any header limit is reached — and the bd's own option (b) would have moved that loss to 120. Task 2 fixes it, and the residual ceiling is documented honestly rather than presented as solved.
- **Placeholders.** Production code is literal. Test bodies are named cases with exact seed→act→assert, deferring harness boilerplate to `feedbackHooks.test.tsx`, which the implementer is told to read first.
- **Type consistency.** `feedbackApi.list` keeps its exact signature, so no caller changes. `FEEDBACK_IDS_PER_REQUEST` and `FEEDBACK_MAX_IDS` are both declared in Task 1 and consumed in Task 2. `FeedbackListResponse` / `toArtifactFeedback` are the existing module-local names and are reused unchanged.
