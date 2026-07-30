# 0014 — Every LLM call is audited to an append-only `llm_log_history`

- **Status:** Accepted
- **Date:** 2026-07-28
- **Driver:** mezo-2zyu

## Context

The Google AI Studio spend dashboard showed **~100 Gemini calls/day** on the prod key with **zero
server-side visibility** into which feature, which model, or which entity drove them. Three concrete
gaps: no **cost attribution** ("which feature/model/day burned how many tokens ≈ how many dollars"),
no **debug trail** (the exact system+user prompt we sent and the raw answer we got), no **audit**
(an immutable who/when/what-for-which-entity record). By this point the LLM surface is wide — the
companion chat (sync + SSE + tool rounds), six consumer-owned ports ([ADR 0012](0012-consumer-owned-llm-ports.md)),
the embedding pipeline, and a dozen proactive crons that generate invisible volume.

The trigger was a forensic question we could not answer from the app: the code requests
`gemini-2.5-flash` everywhere, and a live probe confirmed Google serves and bills it **as**
`gemini-2.5-flash` (no aliasing) — but answering that took a hand-written probe. With this log it is
one `SELECT`.

**The metadata-discard constraint shapes the whole design.** Both LLM seams
([ADR 0008](0008-companion-llm-spring-ai-2-gemini.md)) return plain values: `CompanionLlm` returns
`String`/`Flux<String>`, `EmbeddingPort` returns `float[]`. The things we need — the **actually
served model**, the **token breakdown** (prompt/candidates/thinking/cached), the service tier, the
embedding billable-character count — live on the provider's `ChatResponse` / `EmbedContentResponse`,
which exists **only inside the adapter** and is thrown away there.

Design of record:
[`docs/superpowers/specs/2026-07-28-llm-call-audit-log-design.md`](../superpowers/specs/2026-07-28-llm-call-audit-log-design.md).

## Decision

**Every LLM call the app makes is audited to one append-only table, `llm_log_history`** — chat,
vision, tool and smart-tier generations via `CompanionLlm`, embeddings via `EmbeddingPort`, including
every call made from a cron thread. One row per provider call, with the request shape, the outcome,
the provider's usage counters, the (capped) prompt/response payload, and the frozen unit prices its
cost was derived from.

1. **Capture is adapter-recording, NOT `@Primary` decorators.** The spec sketched two decorator beans
   wrapping the real adapters; that cannot work, because a decorator around the port only ever sees
   the `String`/`float[]` the port returns. So the two real adapters were modified instead:
   `GeminiCompanionLlm` (`feature/companion/llm/GeminiCompanionLlm.java:158` blocking,
   `:124` streamed) switched from `.call().content()` to `.call().chatResponse()` and
   `GeminiEmbeddingAdapter` (`llm/GeminiEmbeddingAdapter.java:70`) keeps its `EmbedContentResponse`,
   each emitting one `LlmCallRecord` through an injected `LlmCallRecorder`. Reading the provider
   metadata is delegated to one pure mapper, `GeminiUsageExtractor`. No `@Primary`, no self-injection,
   no AOP (the codebase has none).
2. **The write is async and non-blocking.** `LlmCallRecorder` publishes an `LlmCallEvent`
   (`EventPublishingLlmCallRecorder` when the switch is on, `NoOpLlmCallRecorder` when off) which an
   `@Async @EventListener LlmLogWriter` persists in its **own `REQUIRES_NEW`** transaction — on
   success **and** on error, at **stream-end** for SSE. Publishing is deliberately non-transactional
   (a failed call is exactly what we most want logged) and guarded: a logging failure is logged and
   dropped, never propagated into the user's call.
3. **The audit executor is isolated.** The `ThreadPoolTaskExecutor` is declared
   `@Bean(defaultCandidate = false)` (`feature/llmlog/config/LlmLogAsyncConfig.java:41`). Boot's
   `applicationTaskExecutor` autoconfiguration is `@ConditionalOnMissingBean(Executor.class)`, so a
   plain bean here would silently move **every** `@Async` in the app onto this 1-thread audit pool.
   Saturation policy is `DiscardPolicy`: under load we lose audit rows rather than throw
   `TaskRejectedException` back through the synchronous publish into a user's LLM call.
4. **Entity-level attribution comes from a thread-scoped context.** `LlmCallContext`
   (`feature`/`operation`/`entityKind`/`entityId`) is set by the caller via
   `LlmCallContextHolder.runWith(...)` (`feature/llmlog/context/LlmCallContextHolder.java:34`) at
   **29 call sites across 25 classes**; the adapter reads it on the calling thread. `created_by` and
   `call_kind` are automatic (security principal via `LlmActorResolver` / which port method ran). An
   untagged call site is honest, not broken: `feature` falls back to `unknown`.
5. **INSERT-only — a deliberate deviation from the `is_deleted` soft-delete house default.**
   `llm_log_history` (35 columns, UUID PK, `pricing_snapshot jsonb`, `cost_usd numeric(12,6)`) has no
   `is_deleted`, no `@SQLDelete`/`@SQLRestriction`, and `LlmLogEntity` does not extend `OwnedEntity`
   (that superclass mandates the soft-delete column). A soft-deletable audit trail is not an audit
   trail: rows are immutable and leave only via retention pruning (a hard `DELETE`). `created_by` is
   nullable with `on delete set null` so removing a user never takes the cost history with them.
6. **Cost is stored honestly, not conveniently.**
   - Token counters are stored **RAW, exactly as the provider reports them** — `cached` stays inside
     `prompt`, because that is what the API said.
   - Billing uses the **NET prompt** (`prompt - cached`): Gemini reports `cachedContentTokenCount` as
     a **subset** of `promptTokenCount`, so charging the full prompt at the input rate *and* the
     cached slice at the cached rate would double-charge it.
   - **Thinking tokens are DISJOINT from candidates** — verified against the live API
     (`total 209 = prompt 13 + candidates 8 + thoughts 188`) — so thoughts are billed separately at
     their own rate, with no double-count. That probe also validated the feature: thinking dominated
     the cost 188 : 8.
   - Each row **freezes its own price snapshot** from `mezo.llm-log.pricing` at write time and derives
     `cost_usd` from THAT snapshot, never from the live config — so a rate change never rewrites
     history and every past cost stays reproducible.
   - **The rule: unknown ⇒ null cost, never a fabricated `0`** — a zero is indistinguishable from a
     genuinely free call, so "unpriced/unknown" must stay visibly so. It holds today for an **unpriced
     model** (a null snapshot ⇒ null cost) and for **embeddings** (a null billable-char count ⇒ null
     cost), and `GeminiUsageExtractor` upholds it on the reporting side: every absent-usage shape
     Spring AI can hand us (`EmptyUsage`, a zeroed `GoogleGenAiUsage.from(null)`, a blank model id)
     is normalised to `null`, not `0`. It does **not** yet hold end-to-end on the generation path:
     when a PRICED snapshot meets an all-null token block, `LlmPricingService#perMillion` treats each
     missing count as zero and the row lands with `cost_usd = 0.000000` instead of null — tracked as
     **bd mezo-xyud**, to be fixed so the rule holds everywhere.
7. **The ERROR-row rule.** An ERROR row carries **no provider-reported usage and no cost** — the
   provider never answered. But **request-side** counters survive (image count/bytes/mime, embedding
   batch size and dimensions): those are facts of the attempt, not something the provider had to
   report. Consequently **every usage/cost aggregate must filter `status = 'SUCCESS'`**.
8. **Feature switch `mezo.feature.llm-log.enabled`** (`FeaturesConfiguration.LLM_LOG_SWITCH`),
   default **off**. Off ⇒ the injected recorder is the no-op ⇒ nothing is published, no event, no
   writer work, no row — zero overhead, and the adapters never branch on it. Switched **on in k8s**,
   where the real Gemini adapter actually runs.
9. **v1 is the table only.** Queries go through SQL/`psql`. A read API, an admin view, retention
   pruning and budget alerting are explicitly later (separate bd issues).

## Consequences

- **"What did we send and what did it cost?" is now one SQL query**, grouped by feature, model or
  day — the three indexes (`created_at`, `(feature, created_at)`, `(served_model, created_at)`) are
  exactly those three axes plus pruning.
- **Aggregates carry two mandatory rules**, both consequences of honesty above: filter
  `status = 'SUCCESS'` for usage/cost, and treat a null `cost_usd` as *unknown*, not free. Until
  **bd mezo-xyud** lands, the mirror caveat also applies: a `cost_usd` of `0.00` on a generation row
  is not proof of a free call — an absent-usage response on a priced model reads 0.00 today.
- **`created_by` is null on `@Async`/cron threads** — there is no security-context propagation and
  `LlmActorResolver` deliberately returns null rather than throwing (audit logging must never be the
  thing that fails a call). Acceptable in a single-user app, but it means **the eventual read side
  must NOT apply the usual `created_by = currentUser` ownership filter**, or it would hide exactly
  the invisible cron volume that motivated the feature.
- **Recording is now an adapter responsibility.** Every new call path added to `GeminiCompanionLlm`
  or `GeminiEmbeddingAdapter` must emit a record, and a second provider adapter would have to
  re-implement it. That is the price of seeing the provider metadata at all; the decorator
  alternative buys transparency it cannot use.
- **Every new LLM call site must be tagged** with `LlmCallContextHolder.runWith(...)` or its rows
  land under `feature = 'unknown'` — visible in the data rather than silently mis-attributed.
- **The price map is config that must be maintained.** The seeded rates in `application.yml` are
  **placeholders to be reconciled with current Gemini pricing**; until then `cost_usd` is only as
  right as that block. The frozen-snapshot design means correcting them fixes the future without
  corrupting the past (and old rows keep showing the price they were billed at).
- **The table only grows.** Nothing prunes it yet, and prompts/responses are stored (capped at
  `mezo.llm-log.max-payload-chars`, with the true pre-truncation byte size kept in `payload_bytes`
  so the cut is visible). Retention is the first follow-up.
- **Known limitations, filed rather than papered over:**
  - **bd mezo-58ig** — on a tool-round turn Spring AI's `UsageCalculator.getCumulativeUsage` returns
    a plain `DefaultUsage` with `nativeUsage = null`, so `thoughts`/`cached` are unrecoverable at the
    adapter and record as **null** (prompt/candidates/total stay cumulative-correct).
  - **bd mezo-1rz9** — a cancelled/aborted SSE stream terminates through neither `doOnComplete` nor
    `doOnError`, so it records **no row** at all.

## Alternatives considered

- **Two `@Primary` decorator beans wrapping the real adapters** (the spec's own §2.3 sketch) —
  rejected on contact with the code: a decorator sees only the port's `String`/`float[]` return
  value, so it cannot record the served model or a single token count. The decorator's whole selling
  point ("the adapters stay untouched") is void once the response object must be read inside them.
- **An AOP aspect around the port methods** — rejected for the same blindness, plus it would
  introduce AOP into a codebase that has none.
- **Log lines / a metrics counter instead of a table** — rejected: the point is per-call attribution
  joinable to domain ids (`entity_kind`/`entity_id`) and inspectable prompts. We already run a
  Postgres; a queryable table is strictly more than a counter and cheaper than an APM.
- **Writing the row synchronously in the call path** — rejected: it would put a DB write (and its
  failure modes) in front of every user-visible LLM answer.
- **Reusing the shared `applicationTaskExecutor`** — rejected: a burst of logged calls would compete
  with the companion's post-turn work; and simply declaring an `Executor` bean without
  `defaultCandidate = false` would have silently hijacked every `@Async` in the app.
- **A single pre-computed `$` column priced from live config** — rejected: historical costs would
  silently drift on every rate change. Freezing the snapshot per row is what makes the number
  reproducible.
- **`is_deleted` + soft delete like every other owned table** — rejected: mutable/soft-deletable
  audit rows defeat the audit goal. This ADR is the standing exception to that house default.
