# 0051 — Preserve reasoning while reading contextual feed evidence

- **Status:** Accepted — evaluation completed, activation default enabled
- **Date:** 2026-09-23
- **Driver:** mezo-7nron.6

## Context

The first three synthetic real-provider replays of ADR 0050's initial native tool loop failed
its quality gate. Even after correcting slope labels and prompt ambiguity, the cheap model
made unsupported causal statements. The existing `OpenAiCompanionLlm.optionsFor` forces
reasoning effort to `none` when a Chat Completions call carries function tools. The improved
chat already separates reasoning from native tool registration for this reason. The official
[GPT-5.6 Luna reference](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and
[function-calling guide](https://developers.openai.com/api/docs/guides/function-calling) describe
the API/tool integration; the local adapter is authoritative for this application's behavior.

## Decision

Use the existing smart completion port for a combined answer-or-read protocol. The model may
return a final structured message immediately, or request a bounded batch of named read tools.
Reuse the chat's `ToolCatalogue`, `PlanValidator`, `PlanExecutor`, `ToolOutcomeDigest` and
registry callbacks. Feed-specific owner/date/audit remain server-supplied. The executor returns
actual tool output for the next reasoned pass; it does not supply an AI-written evidence summary.
No separate planner call or judge is mandatory. Sufficient initial context takes one model call.

The six-call feed tool budget also bounds dependent rounds; a final answer pass is allowed after
exhaustion. Duplicate reads do not execute again. Existing provider model routing, configured
smart tier, spend caps and output budgets remain in force. No provider SDK or global chat
configuration changes. This refines ADR 0050's native tool-loop starting point based on measured
failure, preserving its context/delivery/API/provenance constraints.

## Consequences

The feed gains the same reasoning capability that motivates the chat's modern path without
inventing a conversation. Read-dependent cases may use multiple model calls, bounded by actual
read budget. Cost/latency and all twelve prose cases must be measured again before activation.
An invalid read request never becomes an executable action; malformed final output retains
kind-specific absence/fallback behavior.

## Alternatives considered

- More caution sentences in the prompt: tested, still produced unsupported causal claims and
  repetitive methodological prose.
- A mandatory planner followed by a judge: unnecessary calls and contrary to ADR 0045.
- Migrate every adapter to Responses: larger provider migration than this feature requires;
  retain the existing provider-independent port and chat execution primitives here.
