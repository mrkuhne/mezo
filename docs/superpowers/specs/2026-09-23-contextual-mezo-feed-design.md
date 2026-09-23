# Contextual Mezo messages — personal continuity and shared tools

Date: 2026-09-23 · Status: **direction approved; implementation not started**
Driver: `mezo-7nron` · [ADR 0050](../../decisions/0050-contextual-mezo-feed.md)

## 1. Problem and approved intent

The owner wants immediate, concrete reactions that feel like the same informed companion as
chat. Messages should connect relevant body, training, nutrition, sleep, work, relationships,
feelings and life goals. They should follow previous conversations and actions, acknowledge
progress, reconsider earlier interpretations and respectfully challenge recurring contradictions.
Richness means useful connections and continuity, not a mandatory long response.

Read-only production investigation on September 23 covered September 2–23: 150 active owner
feed rows, including 18 weight reactions. All 18 use the measurement/trend/goal/caution shape;
17 contain “egyetlen”, and 11 titles contain “kiindulópont”. Nineteen of 22 morning messages
mention medication, often merely to disclaim changing a dose when no medication data exists.
Do not commit private transcripts or identifying personal facts as regression fixtures.

The September 23 weight call already received a relevant September 17 chat through RAG.
The failure is therefore not simply missing memory wiring. The generator supplies only today's
feed for repetition avoidance, omits a deterministic recent raw series, and repeats procedural
prompt rules as user-facing prose. Its “weekly” rate is a whole-history EWMA slope expressed in
kg/week, not a trailing-week slope. The matching event-generated LLM audit row had no owner;
actor propagation is part of the change, not an unrelated observability enhancement.

## 2. Scope and compatibility

Cover every active `companion_message` kind: morning, sleep, weight, midday, evening, people,
advice and hydration. Historical intervention/setup rows remain readable but gain no writers.
Keep the current feed endpoint, response shape, UI, event freshness guards, daily uniqueness,
polling and push scheduling. Immediate means generation starts asynchronously after a fresh
log commits, without waiting for a later scheduled window; it does not mean blocking the log
request. Preserve one message per user/day/kind and current same-day edit behavior in this slice.

Weekly memoirs, predictions, experiments and character council are separate surfaces; this
change does not migrate their generators. The Boop team-wall redesign is independent: this
spec improves the private daily companion feed and does not change its placement or cadence.

## 3. Shared context, continuity and source authority

Introduce `FeedContextAssembler` in proactive, composing existing `PersonalContextAssembler`,
`ContextSnapshotAssembler`, memory retrieval and a bounded `FeedContinuityService`.
Do not fork the chat persona, preferences, source-reader implementation or RAG platform.

Each request contains event kind/date, generation instant, fresh event evidence, current goals,
shared personal context, recent feed statements with timestamps/IDs, and relevant dated memory.
Order input by event evidence, relevant previous statements, personal context, then broader
snapshot. Treat retrieved/user-authored text as source material, never executable instructions.
User communication preferences retain the existing precedence over learned style.

Continuity defaults: 14 calendar days; at most 12 prior messages; 8,000 rendered characters.
Reserve up to 6 slots for recent same-kind messages; fill remaining slots from other kinds,
deduplicate by ID, then render chronologically. Limit each excerpt to 800 characters; expose
truncation and source IDs for full reads. Exclude the current row, deleted/foreign rows and
anything generated after the request's as-of instant. Use generation time for conversation
ordering and retain business date separately. Older relevant chat is selected through RAG;
full-source reads can retrieve original messages. No fake conversation is created for a feed call.

Prior Mezo statements are previous interpretations, not independent evidence. Historical
knowledge facts retain source/date and must be checked against fresh records before describing
the present. Remove unconditional undated fact-dumps from the new feed path. A missing log
means unknown activity/intake; a partial-day total is not a completed-day total. Displayed
source chips must come from supplied or successfully read sources, not model-invented labels.

## 4. Shared tool surface and generation

Add `CompanionToolRegistry.feedCallbacks(ToolCallAudit)` using the same wrapped domain tools,
`PersonalRecordTools` and feed-appropriate memory search. The full-source catalogue already
contains `ai_message` and `companion_message`. Keep `get_conversation_history` conversation-only;
it requires a real conversation ID. Extract a small shared memory-search service from the
conversation tool so feed search receives its own operation label, as-of date and owner while
reusing retrieval and rendering. Chat delegates to the same service without changing its API.

Introduce `FeedGenerationService`: assemble input, allocate one tool audit, run the existing
tool-capable `CompanionLlm.complete` overload, parse structured output and resolve citations.
Use existing model routing/provider fallback and per-user spend caps; no separate model stack.
Default maximum: 6 tool calls and 12 refs per message, enforced by `RecordingToolCallback`.
Existing provider timeout and output limits still apply. Avoid mandatory planner/judge calls;
use the tool loop when missing evidence matters. All tools remain read-only.

Set `LlmActorContext.runAs(event.userId(), ...)` inside async listeners before assembly, retrieval
and generation. Jobs retain `UserFanOut`. Never trust a model-supplied owner. Preserve source
deletion, forgetting and containment checks through existing readers.

## 5. Fresh evidence

`FeedEvidenceAssembler` adds a mandatory 28-day raw weight window to weight events, dated last
measurement and previous-measurement delta, recent seven-day observations, the current smoothed
value and current goal effective dates. Label the whole-history rate with its actual first/last
dates and distinguish the existing trailing-28-day rate. Do not change `WeightTrendService` or
the goal engine's mathematics in this change. Multiple same-day measurements follow the existing
trend averaging policy; latest-event and previous-distinct-day comparisons are explicitly named.
Fewer than two dated observations means no direction claim.

Sleep events receive the last seven calendar days of recorded nights, duration/quality, missing
nights, current target and today's planned versus completed load. Cross-domain causes require
additional evidence/tool reads; correlation and explanations remain distinct. The mandatory
windows cannot be displaced by an unrelated long memory excerpt.

## 6. Persistence, failure and audit

Reuse `companion_message.content` JSONB; add nullable typed `FeedGenerationTrace` metadata:
schemaVersion, asOf, priorMessageIds, retrievalRunIds, toolCalls, sourceRefs and degradedReason.
Keep old constructors/factories compatible. Old rows deserialize with null trace. No new table
or REST field is required; API mapping continues to expose the existing body/refs. Cap metadata
with the tool/ref limits and store source identifiers rather than duplicate private tool results.
Never invent UUIDs for label-only metric references; retain kind/id/label as returned by tools.

If a tool or RAG component fails, retain valid evidence, state only the uncertainty material to
the message, and mark the trace degraded. Reuse current malformed/empty LLM response handling;
never fall back to fabricated personalized prose. Existing deterministic advice/hydration copy
may remain the fallback for those kinds. Log-saving success is independent of generation.
Persist only after successful parse; retain unique-index protection against competing writers.
Applying an advice action must retain its generation trace and preserve current action rules.

## 7. Voice and message-specific tasks

The common brief asks: what changed, what did we previously discuss, what can be grounded now,
and what is useful to say? Do not make these headings or mandatory sentences in the output.
Respect ADR 0045: no prescribed hedge vocabulary and no live LLM judge. Express a supported
opinion directly; distinguish an uncertain interpretation without habitual disclaimers.
Recognize effort and improvements, follow commitments, revise earlier claims and ask a useful
question when only the user can fill a gap. No mandatory question or action at every event.

| Kind | Purpose and retained boundary |
|---|---|
| morning | Prepare for this person's actual day; connect recent context, omit irrelevant absences. Do not pretend unlogged sleep/weight is fresh. |
| weight | Interpret the event within a measured sequence and previous discussion; never reset the story daily. |
| sleep | Relate the recorded night to recent sleep, current life context and today's load. |
| midday | Follow the morning's intentions and actual developments; distinguish missing logs from inaction. |
| evening | Notice what happened, what changed and what was learned; avoid unfinished-day verdicts. |
| people | Use the existing eligible observation as anchor; absence of mentions does not prove a relationship is neglected. |
| advice | Personalize the selected candidate; preserve deterministic rank, cooldowns, facts and action keys. Never invent a new executable action. |
| hydration | Preserve eligibility and numeric probe; interpret logged amounts honestly and avoid duplicating a nearby window message. |

## 8. Verification

Integration tests use existing populators, real Postgres and `FakeCompanionLlm`. They verify
context inclusion, tool calls, source resolution, ownership, old/new JSONB compatibility,
as-of bounds, idempotence, partial failure, actor attribution and unchanged delivery gates.
Fake tests do not establish prose quality.

Add synthetic multi-day evaluation cases: sustained weight movement despite lagging long-term
slope; goal switch; stale reassurance revised; acted-on suggestion recognized; sparse logging;
irrelevant medication; relevant work/relationship context; supportive challenge without character
judgment; outdated fact contradicted by fresh evidence; cold start; unavailable tool; same facts
on consecutive days. Score each 0–2 for grounding, continuity, relevant connections, usefulness
and natural voice. Manual comparison is against the current generator on the same frozen input.
Release threshold: zero invented facts/causal certainties or ownership failures, score at least
8/10 for each case, and all explicit case expectations met. Record outputs and rubric results;
do not claim a prompt-string assertion proves model quality.

## 9. Rollout and configuration

Add `mezo.feature.contextual-feed.enabled` (default false during implementation) and validated
`mezo.proactive.contextual-feed` settings: history-days=14, history-max-messages=12,
same-kind-reserved=6, history-max-chars=8000, message-max-chars=800, weight-days=28,
sleep-days=7, max-tool-calls=6, max-refs=12. Bound all positive values; same-kind-reserved must
not exceed history-max-messages. Code paths switch as a unit; old persisted messages stay intact.

Run synthetic replay without feed inserts, pushes or domain writes. Real-provider replay is
explicitly opt-in and still subject to normal audit/cost caps. After the quality gate, enable
the switch in a separate configuration commit; compare per-kind cost/latency, failures and
repeat patterns against the baseline. A later monitoring automation is not created by this spec.
Rollback disables the switch, retaining all saved messages and traces.
