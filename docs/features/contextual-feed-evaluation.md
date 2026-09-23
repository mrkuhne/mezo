---
title: Contextual feed evaluation
type: feature-domain
status: in-progress
updated: 2026-09-24
tags: [proactive, companion-feed, ai, backend]
key_files:
  - backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/ContextualFeedEvaluationIT.java
  - backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/ContextualFeedProviderEvalIT.java
  - backend/src/test/resources/eval/contextual-feed/cases.json
related: [proactive, companion]
---

# Contextual feed evaluation

## 1. Summary

Release gate for [ADR 0050](../decisions/0050-contextual-mezo-feed.md), tracked by `mezo-7nron.6`.
Fake-backed integration tests establish mechanics, not prose quality. Activation additionally
requires a real-provider review of twelve synthetic multi-day cases.

## 2. User-facing behavior

The review asks whether a message reacts immediately, follows the person's actual story,
connects relevant evidence, notices acted-on advice and revises stale interpretations. It must
not invent causes, turn missing logs into missing activity or reset the story every morning.

## 3. Architecture & data flow

`ContextualFeedEvaluationIT` replays the corpus through the actual assembly/generation service
with the fake provider. `ContextualFeedProviderEvalIT` is separately opt-in and calls the real
provider against throwaway Postgres users. Both assert that generation itself saves no feed row;
only fixture history is persisted. Neither invokes delivery jobs or push dispatch.

The comparison control uses the existing per-kind legacy prompt, given the **same richer
context and previous-day history** as the new path. It is deliberately stronger than the old
production input. This measures editorial behavior on equal evidence, not exact old-pipeline
latency or production repetition rates. Hydration's control paraphrases its existing three
numbers; the production baseline is deterministic. Advice's provider replay tests prose only;
its candidate guards and fallback are covered separately by the integration tests.

## 4. Data model & API

The corpus contains only synthetic statements, prior messages, dated weights and explicit case
expectations. No production transcript is included. Output is a local JSON report under
`backend/target/eval/`, with answer, trace, requested model, elapsed milliseconds, logged cost
(unknown remains null) and error. No API or schema changes.

## 5. Integrations

Uses existing populators, `FeedContextAssembler`, `FeedEvidenceAssembler`, `FeedGenerationService`,
`LlmActorContext` and the normal provider router/tool budget. The shell provides provider keys;
the report contains no credentials. The unavailable-source case tests honest prose about a
missing import; actual thrown tool errors and call limits have separate real-DB integration tests.

## 6. Configuration & operations

Normal gate: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=ContextualFeedEvaluationIT`.
Provider replay requires all of `-Dmezo.excludedTestGroups=`,
`-Dmezo.eval.contextual-feed=true`, `-Dmezo.eval.model=<deployed-model>` and
`-Dtest=ContextualFeedProviderEvalIT`. An explicit model without its API key fails visibly.
The evidence commit keeps the production feature switch off; activation is a separate commit after the review and corrective gates.

## 7. Verification

Score each dimension 0–2: grounding, continuity, relevant connections, usefulness, natural voice.
Every case must reach 8/10, satisfy its explicit expectation and contain no invented fact or
causal certainty. Review actual outputs manually; no LLM judge is added to the application.

The mechanical gates completed so far: shared tools/trace/chat compatibility 30 tests; all-kind
integration, fallback, applied-action continuity and legacy regressions 87 tests; the reasoned
read loop plus tool rendering and chat regressions 146 tests, all passing.

The initial native-tool path failed the manual gate in three trials: unsupported attribution of
EWMA lag to distorted measurements, a smoothed slope assigned to the raw series, and unsupported
causal language about work and sleep. These were rejected, not scored as successful releases.
[ADR 0051](../decisions/0051-contextual-feed-reasoned-read-loop.md) records the resulting change
from a reasoning-disabled native tool call to a smart answer-or-read protocol. The successful
mechanical test run alone does not establish prose quality.

The final `gpt-5.6-terra` review scored **9.0/10 mean**, minimum **8/10** (unavailable import),
versus **6.08/10** for the equal-context legacy-prompt control. This is a Codex qualitative
review, not an independent human assessment. All twelve contextual outputs satisfy their case
expectation; no fabricated measurement, past action, goal or certain causal explanation was
found. Remaining editorial weaknesses are occasional length, statistical wording and redundant
fatigue phrasing. The [reviewed outputs and dimension scores](contextual-feed-evaluation-results.json)
make that judgment inspectable.

Nine cases use the complete reasoned replay. Its goal-switch output incorrectly called a
three-observation/two-elapsed-day window three days ago. After adding explicit elapsed calendar
days to mandatory evidence, all three weight cases were rerun; those six final/control outputs
replace the weight cases in the report. They are transcribed from the displayed provider report
because Maven clean removed the original target artifact; the nine unchanged cases were extracted
from the saved full report. No case was silently dropped.

On these twelve final contextual calls, mean latency was **6.50 seconds** and logged total
generation cost **$0.231686** (about **$0.0193/message**); all twelve generation cost records were available. Retrieval/embedding operations are not included in this operation-scoped total. Control
mean latency was 8.01 seconds and total $0.088674. Both arms use the same requested smart model;
these figures do not compare against the cheaper old production model. The complete supplied
context meant no optional read was needed in these outputs; real tool execution, repeat-read
termination, failure behavior and source isolation are verified by integration tests, not
claimed as provider-tool-selection evidence.


| Kind | Cases | Mean latency | Logged cost | Degraded |
|---|---:|---:|---:|---:|
| weight | 3 | 5.84 s | $0.060120 | 0 |
| sleep | 2 | 12.50 s | $0.047418 | 0 |
| morning | 2 | 5.47 s | $0.035794 | 0 |
| midday | 1 | 4.91 s | $0.016922 | 0 |
| evening | 1 | 5.94 s | $0.017898 | 0 |
| people | 1 | 4.41 s | $0.017444 | 0 |
| advice | 1 | 5.75 s | $0.018056 | 0 |
| hydration | 1 | 3.56 s | $0.018034 | 0 |

The final selected provider replay plus evidence tests passed: 5 tests, zero failures/errors.
The first full-suite attempt inherited the real provider keys used for the opt-in replay.
`BiometricsContractIT` failed its 30-second async-drain guard; a thread dump showed the legacy
weight event writer blocked in Gemini `generateContent`. That attempt was stopped, retained as
a failure, and restarted with `OPENAI_API_KEY` and `GEMINI_API_KEY` unset to match ordinary CI
credentials. No test was excluded or its timeout widened. The restarted full suite completed **5780 tests,
5779 passing, one architecture failure, zero errors**. `FeedMessagePrompts.task` used a raw
`IllegalArgumentException` for an unsupported kind; it now uses the house
`SystemRuntimeErrorException` and existing `VALIDATION_INVALID_VALUE` code. No supported prompt
or normal generation behavior changed in this correction. A clean corrective gate covering
all 11 architecture rules plus the shared generator, all-kind integration and legacy generator
passed **51 tests, zero failures/errors**. The full suite was not repeated after this narrowly
scoped exception-type correction; the release evidence is the full run plus that targeted
corrective gate, not a claim of one entirely green full-suite invocation.

Independent code review found no actionable correctness/security defects. CODEMAP and conflict
marker checks pass. Doc lint has zero errors; strict repository-wide doc lint still reports
`today.md` stale from the earlier character-room routing change (`mezo-6gtwa`), with fuel/habit
key-file-count warnings. These predate this feature.

## 8. Limitations

A synthetic corpus cannot establish production repetition rate or user-perceived usefulness.
The first enabled production messages still need read-only inspection (`mezo-7bzwr`). Output quality is
model-dependent; rerun the comparison after changing provider/model or the common brief.

## 9. Decisions

[Approved design](../superpowers/specs/2026-09-23-contextual-mezo-feed-design.md) defines the
threshold and rollback. Disabling `mezo.feature.contextual-feed.enabled` restores legacy
writers while retaining already generated messages and provenance.

## 10. Key files

- `backend/src/test/resources/eval/contextual-feed/cases.json` — twelve synthetic cases and expectations.
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/ContextualFeedEvaluationIT.java` — fake mechanical corpus replay.
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/ContextualFeedProviderEvalIT.java` — opt-in real-provider comparison.
