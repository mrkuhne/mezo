# Boop B0 Javítás — memory + nightly konzílium repair (mezo-r36n9.10)

Backend only. Covers `mezo-lb2yb` (embeddings + retriever + fact merge + alerts) and `mezo-o8tcu`
(nightly konzílium). Evidence: research `07-rag-memory.md`, `08-konzilium-insights.md`; diagnosis
below was taken from production logs and `llm_log_history` on 2026-11-11 (read-only).

## Diagnosis (root causes, evidence-backed)

| # | Symptom | Root cause | Evidence |
|---|---|---|---|
| 1 | Every Gemini embed fails since 10-21 | Google AI Studio **prepay credits depleted** (HTTP 402). The adapter records `error_code = null` for the SDK's `ClientException`, so the reason never reached the log. | pod log `ClientException: 402 … Your prepayment credits are depleted`; 157 EMBED_DOC + 126 EMBED_QUERY errors |
| 1b | (side finding) | TRANSCRIBE + VISION are pinned to Gemini (`call-kind-providers`) — the same 402 would hit meal photos and voice transcription. No traffic since 10-16. | `application.yml` `call-kind-providers` |
| 2 | No alert | `memory_stuck` counts `memory_vector.status='failed'`, but writers throw before a vector row exists; `llm_errors` is a pull-only admin band and carries no reason. | `AdminAlertService.memoryStuck` |
| 3 | Lexical/facts retrievers time out, 0 hits | Deadline = **submit time** + 200 ms on the shared executor; consumers pass 500–2000-char dumps — trigram scoring of a 1500-char query costs ~2 s in prod, a short one ~7 ms FTS + ~80 ms trigram; `websearch_to_tsquery` ANDs every dump term. | prod timing, `MemoryContextService.retrieveCandidates` |
| 4 | `companion_fact_merge` 24/24 ERROR | `FactMergeJudge` calls `completeSmart(prompt, "")` — an **empty user message** is rejected client-side on the OpenAI path (IllegalArgumentException, 0 ms). | `llm_log_history` latency 0, user_message empty |
| 5 | Nightly pass FAILED 49/49 for the main account since 09-23 | `CharacterSignalReads.gatherChatToolCalls` dereferences `message.getConversation().getTitle()`; conversation `1e4a…` was soft-deleted (~09-22) while its 2 messages (09-19) stayed live → `EntityNotFoundException` → transaction rollback-only → FAILED. The daily council fails the same way (it heals the nightly pass first). | pod log stack trace; DB rows |
| 5b | `CHARACTER_COUNCIL_QUOTA_EXHAUSTED` 17× | Cross-talk **tool executions** (DB reads) are charged against the per-cycle *LLM call* cap (14); after 1 observe + 1 propose + 6 cross-talk + ~6 tool reads the skeptic is refused; the next 15-min tick redoes the work. | `CharacterCouncilEvidenceTools.bounded`, llm_log timeline 11-09 22:00 |
| 6 | `proactive_advice` silent since 09-23 | **Intended**: `mezo.proactive.advice-card.enabled=false` (mezo-a9bo7.25, 2026-09-26) — the team chat carries the teendő. No change. | config + commit |

## Changes

1. **Embedding provider → OpenAI** (owner decision pending; alternative = Google top-up, then steps 1a–1c drop out):
   a. `OpenAiEmbeddingAdapter` behind `EmbeddingPort` — `text-embedding-3-small`, `dimensions=768`,
      L2-normalised, same audit-record contract as the Gemini adapter; chosen by
      `mezo.companion.embedding.provider: gemini|openai` (default `gemini`, prod env `openai`).
   b. New generation `openai-text-embedding-3-small-768-v1`; prod flips `serving-embedding-version`,
      `embedding-provider/-model`, enables the re-embedding job with that target (backfills every
      active item), pricing row added.
   c. Gemini adapter stays (tests/dev, rollback = delete the env entries).
2. **Error text logged:** both embed adapters record the provider status (e.g. `HTTP_402`) as
   `error_code` and the message (truncated) as `response_text`.
3. **Alerts** (admin status band): `embedding_down` (BAD) when ≥ 3 embed calls in 24 h and 0
   successes / error rate > 50 %, detail carries the last error code; `memory_stuck` also counts
   **active memory items without a ready vector of the serving version** older than 6 h.
4. **Retriever:** deadline measured from the task's **start** on the pool (separate bounded
   queue-wait cap); lexical + facts get a **short keyword query** derived centrally from the
   consumer's text (stop-words dropped, ≤ 8 distinct terms, OR-joined tsquery, trigram on the short
   form). Dense keeps a capped (≤ 500 char) natural-language query.
5. **Fact merge:** instructions as system prompt, the numbered fact list as the user message.
6. **Nightly konzílium:** chat tool-call gather skips messages whose conversation is deleted (query
   joins live conversations only), never touches a dangling proxy; tool reads stop counting against
   the LLM call cap (the separate tool budget stays).
7. **Backfill in prod** (owner OK): re-embedding job runs once deployed; source repair fills the
   missing items; the nightly pass heals the last days on its own (catch-up window).

## Kész, ha…

- [ ] Failing tests first for 4, 5, 6 (fact merge user message, deleted-conversation gather, tool reads
      not charged, deadline from start, short lexical query) — red then green.
- [ ] Focused ITs + `ArchitectureTest` green with `-Dmezo.test.use-testcontainers=true`;
      `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0.
- [ ] Fresh-context review; Critical/Important fixed.
- [ ] Merged to main, deploy workflow green, new pod running.
- [ ] Prod: new `memory_vector` rows of the serving version appear (count ≈ active items), new
      EMBED_* calls SUCCESS.
- [ ] Prod: a retrieval run after deploy is not `PARTIAL_FAILURE` (or only graph-unrelated reasons),
      lexical not TIMEOUT.
- [ ] Prod: tonight's `character_run` NIGHTLY for the main account = SUCCESS (or a manual run via the
      catch-up path), no `QUOTA_EXHAUSTED` on the skeptic.
- [ ] Prod: Monday's fact merge runs without ERROR (or a dry check of the judge path in an IT).
- [ ] Admin band shows `embedding_down` while broken (IT) and nothing once healthy (prod).
- [ ] `docs/features/companion.md` + `character.md` updated; feature index row true; roadmap
      milestone entry; boop skill §6 row B0 → shipped; bd `mezo-lb2yb`, `mezo-o8tcu`,
      `mezo-r36n9.10` closed; tracker backup refreshed.
