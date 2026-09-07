---
title: Companion chat-model re-baseline (2026-09)
type: comparison
updated: 2026-09-07
tags: [backend, tooling]
related: [../../features/companion.md, ../../superpowers/specs/2026-09-06-openai-migration-design.md]
sources: [raw/measurements/2026-09-07-tool-selection-eval-gemini-2.5-flash.md]
confidence: medium
---

# Companion chat-model re-baseline (2026-09)

The go/no-go measurement behind the OpenAI migration's default-model choice (`mezo-ozri.3`,
spec §M2: **our own eval decides, not the public benchmark**). Three models over the same 42
Hungarian cases: the incumbent `gemini-2.5-flash`, and the two candidates `gpt-5.6-luna` (the
proposed default) and `gpt-5.6-terra` (the smart tier).

> **Status: incomplete.** The incumbent is measured. **Both OpenAI runs are blocked** — the API key
> is valid but the account has **no credit balance**: every call returns
> `429 … You have no credits remaining`. Nothing is decided until they run.

## How it is measured

`ToolSelectionEvalIT` sends each case as a fresh chat turn against a REAL provider adapter and
reads the numbers back out of `llm_log_history` — so the same run also proves the provider's cost
bookkeeping works (a null `cost_usd` on a streamed OpenAI row is the S2 trap, spec §8.6).

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

## Results

| metrika | `gemini-2.5-flash` (incumbent) | `gpt-5.6-luna` | `gpt-5.6-terra` |
|---|---|---|---|
| cases | 42 | *blocked — no credit* | *blocked — no credit* |
| hit | 88.1% (37) | — | — |
| exact match | 88.1% (37) | — | — |
| critical wrong tool | 2 | — | — |
| JSON-érvényes turn | 97.6% | — | — |
| hibára futott eset | 1 | — | — |
| latency p50 / p95 | 2880 ms / 6268 ms | — | — |
| USD / sikeres akció p50 / p95 | $0.003342 / $0.005586 | — | — |
| teljes futás költsége | $0.142846 | — | — |

The incumbent's five misses and two critical selections are listed verbatim in the
[raw capture](../raw/measurements/2026-09-07-tool-selection-eval-gemini-2.5-flash.md). Two of them
are the deliberately ambiguous today-cases (`Mi volt eddig a mai edzésem?` /
`Mi vár még ma a teremben?`), where the model selected no tool at all — one of those is also the
single errored case: `ChatService` raised `COMPANION_EMPTY_ANSWER`, i.e. the turn produced no
answer for the user. That is a product behaviour worth its own look regardless of provider.

## The gates the candidates must clear

From the spec (§S3), against the incumbent column above:

1. exact match **≥ 88.1%**
2. critical wrong tool **= 0** (the incumbent's own 2 are the honest bar to beat, not to match)
3. JSON-érvényes turn **≥ 99.5%**
4. Hungarian tone: blind A/B win+tie **≥** the incumbent's (`ToneJudgeEvalIT`, two judges)
5. latency p95 **≤ +20%** → **≤ 7522 ms**
6. USD per successful action: reported, weighed against spec §4's margin envelope

## Not measured here

- **Structured-output schema conformance across the 13 `*LlmAdapter`s.** Gate 3 is measured on the
  tool-call arguments of these 42 turns only; a real schema eval over the adapters is separate work
  and has not been done.
- **Reasoning effort.** Spec §Q1 makes it the first quality lever, but it is the S4 spike's subject
  (`mezo-ozri.4`), not this baseline.
