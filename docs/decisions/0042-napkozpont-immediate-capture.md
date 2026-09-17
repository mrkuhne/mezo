# ADR 0042: Napközpont puts immediate capture around the companion

- Status: Accepted
- Date: 2026-09-17
- Driving issue: mezo-26fw0

## Context

The owner uses the first screen to check in, capture a journal note or activity, quick-log, or start chat. The companion-only screen made these actions indirect. Repeating water/check-in/journal statistics added little value. The approved orbital prototype preserved the established animated Titanium language while giving these actions stable positions.

## Decision

Use five sculptural orbital action buttons surrounding the existing companion, followed by an interactive actual kcal/macro graphic, one evidence-backed observation from Mezo, and current-day capture history. Reuse existing capture sheets, quick picker, conversation and observation APIs. Check-in notes are unrestricted at the application boundary and stored as TEXT.

## Consequences

Mai becomes a scrollable capture hub. Deep browsing remains in existing navigation. Observation absence is explicit; no generated demo insight is substituted in real mode. Loading/error and unknown targets cannot look like measured zero. Reduced motion preserves the entire interaction surface. The former home composer is reached through Chat's existing text/voice flow.

Design and acceptance: [Napközpont specification](../superpowers/specs/2026-09-17-napkozpont-design.md). Current behavior: [Today](../features/today.md).
