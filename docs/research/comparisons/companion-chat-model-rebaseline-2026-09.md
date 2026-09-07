---
title: Companion chat-model re-baseline (2026-09)
type: comparison
updated: 2026-09-07
tags: [backend, tooling]
related: [../../features/companion.md, ../../superpowers/specs/2026-09-06-openai-migration-design.md]
sources: [raw/measurements/2026-09-07-tool-selection-eval-gemini-2.5-flash.md, raw/measurements/2026-09-07-tool-selection-eval-gpt-5.6-luna.md, raw/measurements/2026-09-07-tool-selection-eval-gpt-5.6-terra.md, raw/measurements/2026-09-07-tone-judge-ab.md]
confidence: high
---

# Companion chat-model re-baseline (2026-09)

The go/no-go measurement behind the OpenAI migration's default-model choice (`mezo-ozri.3`,
spec §M2: **our own eval decides, not the public benchmark**). Three models over the same 42
Hungarian cases on 2026-09-07, plus a blind Hungarian tone A/B with two judges.

## How it is measured

`ToolSelectionEvalIT` sends each case as a fresh chat turn against a REAL provider adapter and
reads the numbers back out of `llm_log_history` — so the same run also proves the provider's cost
bookkeeping works (a null `cost_usd` on a streamed OpenAI row is the S2 trap, spec §8.6; both
OpenAI runs came back with non-null tokens and cost, and every row's `served_model` was the model
under test).

```bash
cd backend && ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= \
  -Dmezo.test.use-testcontainers=true [-Dmezo.eval.model=gpt-5.6-luna]
```

One property picks the model; the provider, its cheap tier and the API key the gate demands all
follow from that name (`EvalTarget`). The gate **fails loudly** when a requested model's key is
missing instead of skipping — the pre-S3 gate named `GEMINI_API_KEY` unconditionally and would have
gone silently green after the provider switch.

**Definitions** (`ToolSelectionEvalMetrics`): *hit* = at least one accepted tool selected;
*exact match* = something selected and nothing outside the accepted set; *critical wrong tool* = a
selected tool from a domain no accepted tool belongs to (`ToolDomains`) — answering a training
question out of the food log; *USD per successful action* = per-case cost over hit cases only.
The per-turn Gemini embedding row (SHADOW memory mode) is excluded: it is the same constant for
every candidate, and it costs $0.000000 across the run as priced today.

## The blocker this run uncovered

**GPT-5.6 rejects function tools and a reasoning effort in the same request** on
`/v1/chat/completions`:

> `400: Function tools with reasoning_effort are not supported for gpt-5.6-luna in
> /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.`

All 42 cases failed on it — that is *every chat turn the companion has*, so the OpenAI provider was
unusable for tool calling exactly as S2 shipped it. Fixed by pinning `reasoning_effort=none` on the
tool path only (`SpringAiCompanionLlm#toolCallOptions` → `OpenAiCompanionLlm`), which is why the
numbers below are the numbers of the *only shape available today*.

**Consequence for spec §Q1:** reasoning effort was the designated first quality lever. On the chat
path it is not a lever at all while Spring AI speaks Chat Completions only (Responses API support
is a 2.1.x issue). It remains available on the non-tool paths (smart tier, structured output).
This is S4's (`mezo-ozri.4`) problem now, and it is bigger than a spike.

## Results

| metrika | `gemini-2.5-flash` (incumbent) | `gpt-5.6-luna` | `gpt-5.6-terra` |
|---|---|---|---|
| cases | 42 | 42 | 42 |
| hit | 88.1% (37) | **92.9% (39)** | **97.6% (41)** |
| exact match | 88.1% (37) | **90.5% (38)** | **95.2% (40)** |
| critical wrong tool | 2 | 4 | **0** |
| JSON-érvényes turn | 97.6% | **100%** | **100%** |
| hibára futott eset | 1 | **0** | **0** |
| latency p50 / p95 | 2880 / 6268 ms | 4090 / **5591 ms** | 4779 / 8092 ms |
| USD / sikeres akció p50 / p95 | $0.003342 / $0.005586 | **$0.000465 / $0.000699** | $0.004670 / $0.015112 |
| teljes futás költsége | $0.142846 | **$0.022220** | $0.228281 |
| vak hangnem (candidate wins / 42) | — | 19 (gemini-judge) · 25 (openai-judge) | 18 · 17 |

## Against the spec's six gates

| # | gate | `gpt-5.6-luna` | `gpt-5.6-terra` |
|---|---|---|---|
| 1 | exact match ≥ 88.1% | ✅ 90.5% | ✅ 95.2% |
| 2 | critical wrong tool = 0 | ❌ 4 (incumbent: 2) | ✅ 0 |
| 3 | JSON validity ≥ 99.5% | ✅ 100% | ✅ 100% |
| 4 | HU tone blind win+tie ≥ incumbent | ➖ split: 45% / 60% | ❌ 43% / 40% |
| 5 | latency p95 ≤ +20% (≤ 7522 ms) | ✅ 5591 ms (−11%) | ❌ 8092 ms (+29%) |
| 6 | USD per successful action | ✅ 7.2× cheaper | ❌ 1.4× dearer than incumbent, 10× Luna |

**Gate 2 needs reading, not just counting.** Nobody clears it as literally written — the incumbent
itself scores 2. Luna's four are all *boundary* confusions, not dangerous ones: twice
`find_similar_past_days` → `get_insights` (the incumbent makes the same mistake once), once
`get_life_goals` for a goal/growth question, once an extra `get_weight_trend` beside a correct
`get_goal`. None of them answers a question out of an unrelated domain's data in a way that would
mislead about training or food. The lever for these is tool-description discipline
([`companion_tool_conventions.md`](../../references/companion_tool_conventions.md)), which is
exactly what this eval exists to re-measure after.

**Gate 4 is a near-tie, and the judges say so.** Neither shows family self-preference — the OpenAI
judge picks the Gemini baseline over `gpt-5.6-terra` 25–17. They disagree about Luna (45% vs 60%),
which is what "no meaningful difference" looks like.

## Decision

**`gpt-5.6-luna` is the default chat model; `gpt-5.6-terra` stays the smart tier.** It is better
than the incumbent on the metric that matters most (exact match 90.5% vs 88.1%), makes no errors,
is faster at p95, and costs **7.2× less per successful action** — $0.022 versus $0.143 for the same
42 turns. Its one weakness (four boundary tool confusions) is addressable through tool descriptions
and is not a model-class problem.

**Terra is the best model here and still not the default.** It is the only clean sweep on tool
selection (95.2% exact, zero critical), but it breaks the latency gate (+29% at p95), loses the
tone A/B under both judges, and costs 10× Luna — spec §4 already priced Terra-as-default at −19%
margin. Its measured strength confirms it belongs where §M1 put it: the smart tier.

## Not measured here

- **Structured-output schema conformance across the 13 `*LlmAdapter`s.** Gate 3 is measured on the
  tool-call arguments of these 42 turns only; a real schema eval over the adapters is separate work.
- **Reasoning effort as a quality lever** — see the blocker above; it is now an S4 design question
  (Responses API or nothing), not a tuning spike.
- **Streaming.** These are `call()` turns; the streamed chat path's usage/cost bookkeeping is
  `mezo-ozri.9`'s subject.
