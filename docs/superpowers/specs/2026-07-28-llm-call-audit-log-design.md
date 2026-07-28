# LLM call audit log — `llm_log_history` (decorator-captured, per-call token/cost/entity trail)

- **Date:** 2026-07-28
- **Driving issue:** mezo-2zyu
- **Status:** design approved (implementation pending)
- **Related:** ADR 0008 (companion LLM = Spring AI 2 + Gemini, the `CompanionLlm` / `EmbeddingPort` seams), mezo-fnnq (companion epic — `ai_message` chat persistence already exists), mezo-h4wp (proactive layer — the background crons that generate invisible LLM volume)
- **New ADR:** yes — "Every LLM call is audited to `llm_log_history` with a frozen price snapshot" (append-only, INSERT-only deviation from the `is_deleted` house default). Write with the spec.

## 1. Context & problem

The Google AI Studio spend dashboard surfaced **~100 Gemini calls/day** on the prod key with **zero server-side visibility** into which feature, model, or entity drove them. That was the trigger. Three concrete gaps today:

1. **No cost attribution.** We cannot answer "which feature / model / day burned how many tokens (≈ how many $)". The dashboard only shows an aggregate per API key.
2. **No debug trail.** When an LLM turn misbehaves, there is no record of the exact `system` + `user` prompt we sent or the raw response we got back.
3. **No audit.** There is no immutable "who/when/what/for-which-entity" record of the calls.

We already persist `ai_message` (companion *chat* history, `202607031400_mezo-fnnq.2`) and per-feature provenance (e.g. the meal draft stores its `model`), but neither is a **comprehensive per-call audit** across all call types.

**The metadata-discard constraint (shapes the whole design).** Both LLM seams throw away the response metadata we most need:

- `CompanionLlm` (chat/vision/tool/smart/stream) → `GeminiCompanionLlm` (`feature/companion/llm/GeminiCompanionLlm.java:47-79`) calls `.call().content()`, which returns only the `String` — the `ChatResponse` (carrying the **actual served `modelVersion`** and the **`usageMetadata` token breakdown**) is discarded.
- `EmbeddingPort` (`feature/companion/EmbeddingPort.java`) → `GeminiEmbeddingAdapter` uses the **raw** Google GenAI client (`googleGenAiClient.models.embedContent(...)`), a different path from the Spring AI `ChatClient`, and likewise keeps only the vectors.

So an aspect/decorator that only sees the `String`/`float[]` return value **cannot** record tokens or the real model. Capturing those requires reading the response object **inside** the seam — which is exactly why we land on decorators over pure AOP (the "AOP keeps adapters untouched" advantage is void once we must touch the response path anyway).

The forensics that motivated this (ADR-worthy aside): the code requests `gemini-2.5-flash` everywhere (`application.yml:267`, `CompanionProperties.java:35`), a live probe confirmed Google serves & bills it **as** `gemini-2.5-flash` (no aliasing), yet the prod-key dashboard showed "Gemini 3.5 Flash" on a key (`…G42XlQ4`) that is **not** the local dev key (`…lVw4v6s`). Had this log existed, "what model + tokens do WE actually send?" would have been a single `SELECT`. That is the standing justification for the feature. (Identifying the `…G42XlQ4` consumer is a separate track, out of scope here.)

## 2. Decision summary

Agreed with the owner:

1. **Goals: all four** — cost attribution, debug/prompt-inspection, audit trail, latency/perf. → one rich, append-only row per call.
2. **Scope: everything, one table.** Chat/vision/tool/smart (`CompanionLlm`) **+** embeddings (`EmbeddingPort`) **+** proactive crons, all into `llm_log_history`, distinguished by a `call_kind` column. Embedding rows have a marker `response` (no text) — just input-count, dims, tokens.
3. **Capture: two `@Primary` decorator adapters** wrapping the real Gemini adapters. They read the real `ChatResponse` metadata directly (`.call().chatResponse()` instead of `.content()`). No AOP is introduced (the codebase has none today).
4. **Write: async, non-blocking.** The call returns to the user immediately; the row is written **after**, via an `ApplicationEvent` → `@Async @EventListener` in its **own** `REQUIRES_NEW` transaction, on **success and error**, at **stream-end** for SSE. A logging failure never touches the user call.
5. **Cost: token breakdown + frozen price snapshot.** Store the full `usageMetadata` breakdown (prompt / candidates / thinking / cached) **and** the unit prices in force at call time (snapshot from a `mezo.llm-log.pricing` config table). `cost_usd` is computed from the **snapshot**, so it never drifts when prices change. (Rejected: a bare pre-computed `$` that goes stale.)
6. **Entity-level attribution.** `user` + `call_kind` are automatic (security principal + which port method). `feature`/`operation` come from a small caller-set tag. `entity_kind` + `entity_id` are optional (the caller supplies them when a domain entity is the subject).
7. **INSERT-only, no soft delete.** Deliberate deviation from the `is_deleted` house default — audit rows are never mutated or soft-deleted. Retention/pruning is a separate later concern.
8. **Feature switch** `mezo.feature.llm-log.enabled`. Off → no decorator beans → consumers get the raw adapter → zero overhead.
9. **v1 = DB table only.** Query via `psql`/SQL. A read-API / admin view and retention pruning are explicitly **later** (separate bd).

## 3. Architecture

Transparent decorator wrapping — consumers keep injecting the port interface, unaware of the logging layer:

```
consumers (MealCoachService, PantryScrapeService, SleepShotService,
           RecipeBreakdownProseService, proactive *Generator, companion chat, …)
   │  inject CompanionLlm / EmbeddingPort  (unchanged)
   ▼
LoggingCompanionLlm   @Primary implements CompanionLlm    ┐ wrap the REAL adapter
LoggingEmbeddingPort  @Primary implements EmbeddingPort   ┘ (@ConditionalOnProperty llm-log.enabled)
   │  1. read LlmCallContext (request/thread-scoped) + current user (security principal)
   │  2. call delegate via .call().chatResponse()  → content + served modelVersion + usageMetadata
   │  3. measure latency, capture status/error, streamed flag, tool_rounds
   ▼
publish LlmCallEvent  (ApplicationEventPublisher — fire-and-forget, never blocks/fails the call)
   ▼
@Async @EventListener  LlmLogWriter  (@Transactional(REQUIRES_NEW))
   │  snapshot pricing for served_model → compute cost_usd → map → save
   ▼
llm_log_history   (INSERT-only)
```

- **Streaming.** For `stream(...)` the decorator wraps the returned `Flux` with `.doOnComplete(...)` / `.doOnError(...)` (and start-time captured before subscription) so the row is emitted when the stream terminates, with the final usage/latency. If the provider does not surface usage on the streamed path, token fields are recorded null with `streamed=true` (honest: unknown, not zero).
- **New package** `feature/llmlog/` (house `feature/{name}/{controller,service,repository,entity,dto,mapper}` layout): `entity/LlmLogEntity`, `repository/LlmLogRepository`, `service/LlmLogWriter` + `service/LlmPricingService`, `event/LlmCallEvent`, `context/LlmCallContext` (+ its holder), `config/LlmLogProperties` + `config/LlmPricingProperties`. The two decorators live **next to the real adapters** in `feature/companion/llm/` (they implement companion-owned ports) but depend only on `feature/llmlog` for the event/context — keeping the logging domain self-contained.

## 4. Data model — `llm_log_history` (append-only)

`UUID` PK (`gen_random_uuid()`), timestamps `timestamptz`. Liquibase changeset `2026NNNNNNNN_mezo-2zyu_create_llm_log_history.sql`. No `is_deleted` (INSERT-only). Indices on `(created_at)`, `(feature, created_at)`, `(served_model, created_at)` for the cost/debug queries.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `created_by` | uuid FK app_user, **nullable** | interactive → principal; cron → owning user; only truly system-less calls null. Server-set, never from client. |
| `created_at` | timestamptz | call start |
| `call_kind` | text | `CHAT` \| `CHAT_STREAM` \| `VISION` \| `SMART` \| `TOOL` \| `EMBED_DOC` \| `EMBED_QUERY` |
| `feature` | text | `meal_coach`, `meal_draft`, `pantry_scrape`, `pantry_photo`, `sleep_shot`, `recipe_breakdown`, `activity_classify`, `quest_flavor`, `companion_chat`, `proactive_briefing`, `proactive_weekly`, `proactive_memoir`, … |
| `operation` | text, nullable | finer op within a feature |
| `entity_kind` | text, nullable | e.g. `meal`, `recipe`, `sleep_shot` |
| `entity_id` | uuid, nullable | the domain row this call served |
| `requested_model` | text | what we asked for (`gemini-2.5-flash`) |
| `served_model` | text, nullable | `modelVersion` from the response — the honest actual |
| `status` | text | `SUCCESS` \| `ERROR` |
| `error_code` | text, nullable | `SystemMessage` code on failure |
| `error_class` | text, nullable | exception simple name |
| `latency_ms` | int | |
| `streamed` | boolean | |
| `tool_rounds` | int, nullable | number of tool-execution loops, when known |
| `service_tier` | text, nullable | from `usageMetadata` (`standard`, …) |
| `prompt_tokens` | int, nullable | `promptTokenCount` |
| `candidates_tokens` | int, nullable | `candidatesTokenCount` |
| `thoughts_tokens` | int, nullable | thinking tokens, when present |
| `cached_tokens` | int, nullable | cached-content tokens, when present |
| `total_tokens` | int, nullable | |
| `embed_input_count` | int, nullable | # texts embedded (embedding rows) |
| `embed_dimensions` | int, nullable | vector dims (768) |
| `system_prompt` | text, nullable | verbatim; truncation-capped (§5) |
| `user_message` | text, nullable | verbatim; truncation-capped |
| `response_text` | text, nullable | verbatim; null/marker for embeddings |
| `truncated` | boolean | any payload field was capped |
| `payload_bytes` | int | pre-truncation total payload size |
| `image_count` | int, nullable | multimodal: **marker only** |
| `image_bytes_total` | bigint, nullable | multimodal: total bytes — **image bytes are NOT stored** |
| `image_mime` | text, nullable | e.g. `image/jpeg` |
| `pricing_snapshot` | jsonb | `@JdbcTypeCode(JSON)` onto a typed embedded record: `{ input, output, thinking, cached }` USD per 1M tokens + `currency` + `priced_on` + `source_model` |
| `cost_usd` | numeric(12,6), nullable | Σ(tokenᵢ × snapshot_priceᵢ / 1e6); computed from the frozen snapshot, so immutable & reproducible |

**Single-user note.** All rows are the owner's own data, so verbatim prompt/response storage carries no cross-tenant privacy risk. The image-bytes exclusion is a size decision, not a privacy one.

## 5. Capture details

- **Metadata extraction (chat).** From `ChatResponse`: `getMetadata().getModel()` → `served_model`; `getMetadata().getUsage()` → token counts; provider-native `serviceTier`/thinking/cached fields via the raw metadata map where the typed getter is absent. *(Exact Spring-AI-2 / google-genai getter names to be pinned during implementation against the actual `ChatResponseMetadata` / `Usage` API — the plan verifies these, not this spec.)*
- **Metadata extraction (embedding).** `EmbedContentResponse` usage for input tokens; `embed_input_count` = `texts.size()`; `embed_dimensions` = `EmbeddingPort.DIMENSIONS`.
- **Payload cap.** `system_prompt` + `user_message` (+ `response_text`) stored verbatim up to a generous per-field cap (config `mezo.llm-log.max-payload-chars`, default e.g. 64 000); over the cap → truncate + `truncated=true`, always record true `payload_bytes`. At ~100 calls/day this effectively never fires.
- **Cost.** `LlmPricingService.snapshot(servedModel)` returns the frozen `PricingSnapshot` from `mezo.llm-log.pricing`; `cost_usd` computed from it in the writer. Unknown model → null snapshot + null cost + a `log.warn` (so a new model surfaces as a visible gap, not a silent zero).

## 6. Wiring, feature switch, edge cases

- **Decorator wiring (no self-injection cycle).** The decorator is itself a `CompanionLlm`, so it must not inject `CompanionLlm` by type. It injects the concrete delegate (`GeminiCompanionLlm` in prod, `FakeCompanionLlm` under `companion-fake`) via `@Qualifier` / concrete type, and is marked `@Primary`. Both are `@ConditionalOnProperty(mezo.feature.llm-log.enabled=true)`; when off, no decorator exists and the real adapter is the only (and thus primary) bean. The plan pins the exact qualifier strategy so it holds under both profiles.
- **`created_by` for crons.** Proactive generators run without an HTTP principal; they resolve the owning user server-side. The `LlmCallContext` (or the writer) sets `created_by` to that owner. The plan confirms the exact owner-resolution seam; null only for genuinely user-less calls.
- **`LlmCallContext` lifecycle.** A thread-bound holder set at each feature's LLM entry point and cleared in `finally`. Defaults (feature/operation "unknown", no entity) keep an un-tagged call still loggable rather than dropped.
- **`@EnableAsync` + executor.** A dedicated bounded executor (config `mezo.llm-log.executor.*`) so a write burst can never exhaust the common pool. Under the test profile the executor is a `SyncTaskExecutor` for determinism (§8).

## 7. Error handling (house `error_handling.md`)

- **Logging failures never propagate.** The `@EventListener` wraps its work; on failure it emits `log.warn` with an `exceptionTraceId` and drops the row — the user call already returned.
- **Logged-call failures are recorded.** When the delegate throws, the decorator captures `status=ERROR`, the `SystemMessage` `error_code` (if a `SystemRuntimeErrorException`) + `error_class`, any partial usage, then **re-throws** unchanged — behavior of the wrapped call is byte-for-byte preserved.

## 8. Testing (house `testing_standards.md`, `integration_test_framework.md`)

- **Integration-first**, `@SpringBootTest` + Testcontainers/fixed `mezo_test`, AssertJ, naming `test{Method}_should{Result}_when{Condition}`.
- `LlmLoggingIT`: a fake-backed `CompanionLlm.complete(...)` → **exactly one** `llm_log_history` row with the expected `call_kind`, `feature`, token/model/cost fields, `status=SUCCESS`.
- Error path: fake throws → one `status=ERROR` row (with `error_code`), and the original exception still surfaces to the caller.
- Embedding path: `embedDocuments(...)` → one `EMBED_DOC` row with `embed_input_count`/`embed_dimensions`, null `response_text`.
- Cost: a known token count × a test pricing table → asserted `cost_usd` and a `pricing_snapshot` that matches.
- Switch off (`llm-log.enabled=false`): no decorator, no rows, call still works.
- Infra: add `llm_log_history` to `ResetDatabase` TRUNCATE list; new `LlmLogPopulator` factory (house rule: new table → both). Async determinism via the sync executor under test profile.

## 9. Config (house `configuration_conventions.md`, `spring-config-properties`)

Everything under `mezo.` — no `@Value`, no hardcoded tunables:

- `mezo.feature.llm-log.enabled` (`FeaturesConfiguration` constant + `@ConditionalOnProperty`).
- `mezo.llm-log.max-payload-chars`, `mezo.llm-log.executor.{core-size,max-size,queue-capacity}` → `@Validated LlmLogProperties`.
- `mezo.llm-log.pricing` → `@Validated LlmPricingProperties`: `Map<String, ModelPrice>` where `ModelPrice = { input, output, thinking, cached }` USD per 1M tokens, plus `currency`. Seeded for `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-embedding-001`.

## 10. Docs & ADR impact

- **New ADR** — the audit-log decision + the append-only / no-`is_deleted` deviation + the frozen-price-snapshot honesty stance.
- **`docs/features/companion.md`** — the `CompanionLlm` / `EmbeddingPort` integration section gains a "every call is audited via a `@Primary` logging decorator" note + the `llm_log_history` data model. (`node scripts/lint-docs.mjs` after.)
- **`docs/features/_platform-*`** — a short cross-cutting entry if one fits (the logging concern spans features).

## 11. Non-goals (v1) / future

- Read API / admin UI over the log — **later**, separate bd.
- Retention / pruning / partitioning — **later** (the table is append-only; at ~100/day it is tiny for a long time).
- Alerting / budget thresholds on top of the log — **later**.
- Identifying the `…G42XlQ4` 3.5-Flash spender — **separate track** (owner-side kubectl + AI Studio check).

## 12. Open items the implementation plan must pin

1. Exact Spring-AI-2 `ChatResponseMetadata` / `Usage` getter names + how `serviceTier` / thinking / cached tokens surface for google-genai (verify against the running API, incl. the streamed path).
2. Whether the streamed `Flux` path exposes final usage; if not, document the null-token behavior.
3. The concrete `@Qualifier` / bean-selection that makes the `@Primary` decorator wrap the right delegate under both the prod and `companion-fake` profiles without a cycle.
4. The owner-resolution seam used by proactive crons for `created_by`.
5. Confirm `tool_rounds` is observable from the Spring AI tool-execution loop; null if not.
