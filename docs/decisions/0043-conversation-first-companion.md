# 0043 — Conversation first, personal data on demand

- **Status:** Accepted
- **Date:** 2026-09-18
- **Driver:** mezo-rj214.9

## Context

The owner wants an open-ended conversation partner that can consult their stored data when
useful. The prior gear router examined only the latest sentence, withheld all tools on CHAT,
injected an entire health snapshot on other turns, and buffered analytical prose. This makes
pronoun-only follow-ups lose retrieval and makes ordinary domain/time words trigger data work.

## Decision

All interactive turns use one history-aware smart retrieval loop. The model sees the same full
read catalogue on every decision, with prior messages and already retrieved evidence. It can
stop without any read or request further dependent reads. After at most three retrieval batches
and 15 total calls, the smart model writes a natively streamed answer from the gathered evidence.
Context, personal memory and older history are tools; date, preferences and explicit anchors are
the only initial background. The voice permits any topic and grounds personal facts separately
from general knowledge. No LLM judge silently rewrites the normal answer; the clinical guard stays.

Preserve bounded tool evidence in existing internal JSONB, retain up to 80 recent messages within
a character budget, and expose older pages with honest truncation. Keep the previous gear path
behind `mezo.companion.conversation.enabled=false` for rollback.

## Consequences

The same model tier selects data and answers. A general turn now pays one preparation call;
data-heavy turns can pay several. There is no promise of latency/cost parity or ChatGPT parity.
Native reasoning+tool calling is not added to the current provider adapter: its existing
Chat Completions constraints motivated the explicit split. Deterministic integration tests prove
flow/ownership, while opt-in synthetic multi-turn comparisons measure actual prose separately.
The existing domain tool coverage limits still apply; this is not arbitrary database access.

## Alternatives considered

- Prompt-only rewrite: leaves the keyword gate, unavailable tools and history loss intact.
- More keyword rules: cannot reliably resolve references or distinguish personal/general topics.
- Native provider migration: potentially removes the planning overhead, but would couple this
  change to new transport, accounting and provider compatibility work.

See [design](../superpowers/specs/2026-09-18-conversation-first-design.md) and
[living companion reference](../features/companion.md).
