# 0050 — Grounded observations precede statistical proof

- **Status:** Accepted
- **Date:** 2026-09-23
- **Driver:** mezo-hben1

## Context

The live observation inbox stayed empty despite 15 stored patterns. Seventeen hypothesis
rounds from September 6–23 proposed 34 hypotheses and retained none: the weighted statistical
critique scored every candidate below even the cold-start threshold. The owner recognized
the rejected themes as useful questions. Separately, the feed excluded monitored statistical
patterns and discarded unanswered cards after their calendar day.

## Decision

Separate relevance and grounding from statistical confidence. A candidate with real owned
source references, an independently critiqued noncontradictory observation and a personally
answerable question may enter the inbox without sufficient correlation data. Statistical
scores remain evidence metadata; a user saying “Igen, jellemző” records their experience,
not a proved causal relationship.

Use the existing personal-record catalogue for original notes, user chat, check-ins and
dated events. Select sources round-robin inside a configured 28-day context; related
REFLECTION memories are bounded to 90 days. Assistant-authored recollections are not
independent original evidence. Preserve canonical provenance and readable source dates.

Publish through the existing pattern/event store and shared daily observation budget.
Unanswered cards persist in the current inbox; newer evidence enriches the same thread.
Monitored statistical patterns appear with their existing lifecycle and details link,
without reflection reply actions or synthetic confirmation counts. Historical day reads
remain bounded to that day's events.

Recovery uses owned hypothesis audit logs, revalidates against original records, previews
server-held candidates and applies those exact candidates idempotently. It sends no push,
creates no user confirmation and does not backdate publication. Preview plans expire and
are invalidated on restart; durable cards and deduplication survive restart.

## Consequences

The UI can ask relevant questions before it has enough observations to test an association.
Grounding and contradiction checks remain mandatory; missing logging is not evidence that
an event did not happen. New and recovered candidates share the same pipeline, ownership
checks, source-deletion handling and publication budget.

More original context and a separate critique cost more than silently dropping candidates.
Source, character and candidate limits bound that cost. Recovery is an explicit owner-only
operation; regular generation remains capped per night.

## Alternatives considered

- Lowering the weighted threshold alone leaves the feed lifecycle and source gaps intact.
- Showing every model proposal produces unsupported, repetitive claims.
- A second inbox/storage layer would split reply state from the existing feed and team wall.
