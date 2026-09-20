# ADR 0046: Central settings and inspectable personal companion context

- **Status:** Accepted
- **Date:** 2026-09-20
- **Driver:** mezo-txunr

## Context

Persistent preferences were scattered across domain pages, with duplicate editor entry points.
The learned communication profile was visible, but users could not add explicit instructions
or inspect the complete personal baseline actually supplied to chat.

## Decision

The global header opens `/settings`, highlighting the originating domain. Domain preferences
reuse their canonical data sources; former settings URLs redirect. Logging and operational
plan editing remain in their domains. Settings suppress the contextual dock and quick-log FAB.

Personal context has four independently explained sections: canonical core facts, user-written
introduction, explicit communication instructions, and the optional learned profile. A single
owner-scoped backend assembler renders both preview and chat input on all chat paths. User text
is bounded and represented as quoted data, never silently rewritten by background learning.
Explicit communication requests take precedence over learned tone within application rules.
The preview describes its scope: personal context, not the entire system prompt or turn memory.
Account name is corrected in the account source; biometrics and goals remain in their domains.

Target weight and remaining pace derive a date. Existing goal history is preserved; server
feasibility checks both the remaining window and stored full window because the engine's rate
remains the historical whole-goal average. Water and fiber use compact rows.

## Consequences

Users have one predictable entry point and can correct what the companion receives. Prompt
preview cannot drift from chat without breaking shared-assembler tests. Domain APIs remain
canonical rather than being copied into a settings aggregate. Remaining pace and engine average
must stay explicitly distinguished until any future goal-history model redesign.

See [living settings reference](../features/settings.md) and
[approved design](../superpowers/specs/2026-09-20-central-settings-design.md).
