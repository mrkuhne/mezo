# 0040 — Share personal and daily state in the Titanium prototype

- **Status:** Accepted for the isolated prototype only
- **Date:** 2026-09-10
- **Driver:** mezo-of6i

## Context

The approved Titanium direction places one animated companion across five contextual areas.
The user prioritizes weight, sleep and their relationships with food and training. The Én and
Nap surfaces need detailed, navigable flows to assess this direction, not disconnected mock
cards. Production already has different routes, contracts and feature implementations.

## Decision

Develop Én (Áttekintés, Súly, Alvás, Napló) and then Nap (Mai, Beszélgetés, Rutin, Napzárás)
inside `docs/design_2.0/prototypes/companion-titanium`. One in-memory personal/day model owns
weights, sleep, journal, check-ins, water, routines, personal goals and evening closure.
Existing food/workout demos expose read-only snapshots for current intake/completion.

A measurement correction replaces the matching date. Derived routine completion follows its
source log. A closing reflection upserts one journal entry. The avatar's journal command opens
the same editor used by Én. Discoveries and the character/knowledge models remain the preceding
Mezo prototype's explicit sample world: personal logging does not pretend to run AI pipelines.

The demo remains anchored to 2026-09-09 so all existing examples stay coherent. Reload/reset
clears modifications. No persistence, production route migration, actual voice/AI connection,
medical inference, notification delivery or backend contract change is introduced.

## Consequences

The user can assess cross-area continuity: sleep → daily context, food → daily intake,
conversation → own journal words, routine → completion, evening reflection → journal.
State rules have focused tests; visual and route integration is checked in the browser.
The prototype needs a later deliberate mapping to production contracts if adopted.

## Alternatives considered

- Separate static cards per destination: quick to draw, but cannot demonstrate the connected flows.
- Immediate production rewrite: premature while the user is still validating the design direction.
- Live AI and persistence in the prototype: would turn a reversible design exercise into a new
  data integration project before the interaction structure is accepted.

Implementation map and validation: [Én and Nap prototype](../design_2.0/2026-09-10-titanium-me-nap-deep.md).
