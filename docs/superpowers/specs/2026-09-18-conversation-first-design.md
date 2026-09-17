# Conversation-first companion

Approved direction: the owner accepted all six findings in the chat review on 2026-09-17.
Driver: `mezo-rj214.9`; parent: `mezo-rj214`.

## Goal

Mezo is an open-ended conversation partner with access to the owner's stored information.
Health is a capability, not a mandatory topic or voice. Personal factual claims need evidence;
general knowledge, creative work and opinions do not require a database row.

## Architecture

Replace the keyword gear gate on the normal path with a history-aware smart retrieval loop.
Reuse the existing tool catalogue, validated JSON plan, audited executor and smart answerer.
The decision model sees the conversation and accumulated raw tool results on every lap, may
ask for further reads, and stops when it can answer. All topics have the same tools available.
The final smart answer streams natively, including analytical answers. No user-visible control
markers and no LLM verdict rewrite. Retain the deterministic clinical guard.

The existing Chat Completions adapter disables reasoning when native tools are attached.
Therefore retain separate reasoning-capable retrieval decisions and final prose; do not migrate
providers or invent a streamed control protocol in this change. Cost: at least one planning call
even for general conversation. Bound to three retrieval batches and the existing 15-call budget.
A failed/malformed decision produces an explicit unavailable-context notice for the answerer,
not a silent switch to a weaker model. Existing gear flow remains a configuration rollback.

## Context and continuity

Initial context contains the date, learned communication preferences and any explicit day/week
anchor. No automatic snapshot, character assessment or newly-learned announcement. Add audited,
owner-scoped reads for context sections, long-term memory and paginated older conversation.
Memory reads keep existing retrieval disclosure and references. All source material is data,
never instructions, and must be used only when relevant to the current request.

The normal recent window is 80 messages. Store bounded tool output inside the existing internal
JSONB tool audit (legacy rows remain readable); restore it as labelled historical evidence with
bounded size. Older-history reads expose pagination and truncation honestly. No REST change,
new table, frontend change, unscoped SQL or access to another user's messages.

## Verification

Integration regressions cover ordinary questions containing time/domain words, pronoun-only
follow-ups, iterative retrieval, result persistence, long conversations, on-demand context,
cross-user isolation, failed retrieval, budget exhaustion and streamed analytical responses.
Existing gear tests explicitly cover rollback. Deterministic tests verify orchestration and
source flow; they do not prove subjective conversational quality. A reusable multi-turn live
comparison corpus covers freedom, continuity, grounding and tone for subsequent model evals.

## Delivery

Focused local backend tests; full authoritative CI on the self-PR. Update the companion living
reference and tool conventions, generate CODEMAP, refresh the Beads backup, and push the PR.
