# 0059 — Exercise-specific SPE eligibility

- **Status:** Accepted
- **Date:** 2026-11-24
- **Driver:** mezo-eiux9

## Context

The old SPE rule used one `stable`/`free` flag. It prevented the owner from selecting appropriate techniques on the dumbbell Hammer Curl and barbell Hip Thrust in his active block. Stability still matters for the automatic planner, but it cannot describe which manual techniques fit a particular movement. The day's challenge has a separate equipment and movement rule.

## Decision

The versioned exercise catalogue records `allowedTechniques` for every master row. The startup loader persists the list; the server validates every manual pick against it and sends the same list to Boop. `none` remains universally available. The 57 stable rows retain their earlier palette; among 109 free rows, Hammer Curl permits `myo`, `rest_drop` and `drop`, and Hip Thrust permits `top_pause`. The other free rows have an explicit empty list. A user-authored row with no list retains the older stable/lengthened fallback. The automatic planner remains stable-only; the challenge rule is unchanged.

`top_pause` marks the last working set with a configured two-second hold at the top of each rep. It does not add a set or leg or change load, reps, reserve or rest. The phone logs one normal set carrying the technique token.

## Consequences

Eligibility now requires reviewing catalogue content rather than only setting stability. The server is the final authority, and the phone can explain unavailable choices from the same palette. An invalidated stored pick is omitted from a new day's prescription without rewriting past logs. The optional API fields preserve older phone caches and server responses.

## Alternatives considered

- Reclassify these lifts as `stable`: this would change other stability-dependent behavior, including automatic planning.
- Allow every technique on every free-weight exercise: this would expose inappropriate choices without movement-level review.
