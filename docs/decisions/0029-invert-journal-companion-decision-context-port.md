# 0029 — Invert the journal→companion decision-context edge into a journal-owned port

- **Status:** Accepted
- **Date:** 2026-08-21
- **Driver:** mezo-b3pp.4 (Decision journal + review loop) — caught by the whole-branch final review before merge, not during original implementation

## Context

W1.4's decision journal (`feature/journal/service/DecisionService`) freezes a server-side context
snapshot into `decision_entry.context_snapshot` at create time (`journal.md` §4/§5.4). The
implementation reached for the obvious wiring: inject `feature/companion`'s
`ContextSnapshotAssembler` and `CompanionProperties` (for `journal().decisionReviewDays()`) directly
into `DecisionService`, behind an `ObjectProvider` so a companion-off system degrades to an empty
snapshot text (IDENT-3) instead of failing the write.

That direct wiring closes a cycle. `feature/companion` already imports `feature/journal` — correctly
— for the embed pipeline: `JournalEmbeddingListener`/`DecisionEmbeddingListener`
(`companion/embedding/`) read `JournalEntryRepository`/`DecisionEntryRepository` and the two
`*SavedEvent` records to keep `memory_embedding` in sync. Adding a `journal → companion` edge on top
of that makes `journal ↔ companion` a genuine two-way cycle at the package-slice level.

`ArchitectureTest.feature_slices_are_cycle_free` (mezo-ah18.7, [ADR 0007](0007-machine-enforcement-of-conventions.md))
is a `FreezingArchRule` over `SlicesRuleDefinition.slices().matching("io.mrkuhne.mezo.feature.(*)..")`.
Two cycles are already frozen as pre-existing debt (its javadoc is explicit that these are debt, not
a pattern to extend); the same javadoc states that **any NEW cycle — including any widening of a
frozen one — fails the build**. `./mvnw clean test -Dtest=ArchitectureTest` confirmed this: the
branch as shipped fails with `Cycle detected: Slice companion -> Slice journal -> Slice companion`,
naming exactly the `ObjectProvider<ContextSnapshotAssembler>`/`CompanionProperties` edges in
`DecisionService`. This is CI-blocking — the rule does not silently absorb a new cycle the way a
non-freezing rule might.

This is not the first time this exact shape has come up. [ADR 0012](0012-consumer-owned-llm-ports.md)
hit the identical problem for `feature/pantry`'s scrape-import LLM call: the natural consumer of a
companion capability sits in a feature companion transitively (or, here, directly) depends on, so a
direct edge closes a cycle, and freezing it would defeat the very convention ADR 0007 introduced.

## Decision

Invert the two journal→companion edges into one journal-owned port, following ADR 0012's
consumer-owned-port idiom exactly — the same shape as `SleepAnchorPort`, `CaffeineCutoffPort`,
`HabitSuggestPort`, and `AccountProgressPort` elsewhere in the codebase.

1. **`feature/journal/service/DecisionContextPort`** — a one-method interface
   (`render(userId, today)`) owned by journal, narrowed to exactly what `DecisionService` needs:
   the rendered context-snapshot text. `DecisionService` depends on this and nothing from
   `feature/companion`.
2. **`feature/companion/service/DecisionContextAssemblerAdapter`** implements the port by
   delegating straight to `ContextSnapshotAssembler#render` — the same rendering every other
   context-snapshot consumer gets. Gated `@ConditionalOnProperty(COMPANION_SWITCH)` alone (the
   journal switch is already `DecisionService`'s own gate). `DecisionService` consumes the port
   through `ObjectProvider<DecisionContextPort>`: companion off ⇒ no adapter bean ⇒ empty
   `snapshotText` — the exact honest-degraded behavior the branch already had (IDENT-3), unchanged
   by the inversion; `DecisionApiCompanionOffIT` (asserting exactly this) passes unmodified.
3. **`CompanionProperties.journal().decisionReviewDays()` moves to a journal-owned config record**,
   `feature/journal/config/JournalProperties` (`@Validated @ConfigurationProperties`), for the same
   reason — it had exactly one production reader (`DecisionService`) and one test reader
   (`DecisionApiIT`), both in `feature/journal`, so `CompanionProperties.Journal` was itself a
   `journal → companion` dependency in miniature (a journal concern, config-owned by companion).
   **The YAML prefix stays `mezo.companion.journal.*` on purpose** — only the *owning Java type*
   moved, not the key. `application.yml` needed no change, and the Phase 5 W1 design spec's
   configured key (`mezo.companion.journal.decision-review-days`) stays exactly as specified.
   Registration is automatic via `@ConfigurationPropertiesScan` on `MezoApplication` — no extra
   wiring.
4. `DecisionApiIT` (the one test reader) now autowires `JournalProperties` instead of
   `CompanionProperties`.

The resulting cross-feature edge is `companion → journal` (the adapter importing the journal-owned
port interface) — the SAME direction the embed-listener edges already run. No cycle, no frozen
exception, no widening of the two pre-existing frozen cycles.

## Consequences

- **`ArchitectureTest.feature_slices_are_cycle_free` passes** with the `archunit-store` freeze file
  unchanged (no new violation recorded, none of the two pre-existing frozen cycles widened).
- **One more small port + thin adapter joins the pattern** ADR 0012 started (now five:
  `SleepAnchorPort`, `CaffeineCutoffPort`, `HabitSuggestPort`, `AccountProgressPort`,
  `DecisionContextPort`). Accepted per ADR 0012's own reasoning — the blast radius per port is a
  one-method interface and a one-line delegating adapter, and each stays exactly as narrow as its
  consumer needs.
- **A config record now lives in the feature that reads it, not the feature whose YAML namespace it
  historically shared.** `JournalProperties` on the `mezo.companion.journal.*` prefix is slightly
  unusual (an owning package that doesn't match its YAML prefix), but changing the prefix would have
  touched `application.yml` and drifted from the design spec's already-configured key for no
  behavioral benefit — the mismatch is documented in both the class javadoc and `journal.md` §4/§10
  so a future reader isn't surprised by it.
- **The companion→journal direction is now the ONLY direction**, end to end, for this seam —
  `journal.md` §5 and `me.md` §5.10 describe the port explicitly rather than only asserting "no
  import of companion," so the one exception (reached through a port, not a direct import) is
  visible rather than an implicit carve-out future readers would have to rediscover.

## Alternatives considered

- **Freeze the new cycle** (add it to `archunit-store`, matching the two existing pre-existing-debt
  cycles) — rejected: the rule's own javadoc frames those two as debt, not a pattern to extend, and
  freezing a THIRD one on a brand-new feature (not legacy code) would normalize doing this going
  forward, defeating ADR 0007's entire point.
- **Relocate `ContextSnapshotAssembler` (or a narrow rendering seam) to `techcore`** — the ADR 0012
  escape hatch, deferred there for the same reason: one additional consumer doesn't yet justify
  pulling the companion's context-assembly logic out of its slice. Revisit if a third or fourth
  feature needs the same snapshot-text seam.
- **Leave `CompanionProperties.Journal` in place, only invert the `ContextSnapshotAssembler` edge**
  — rejected: the config record was itself a live `journal → companion` compile-time dependency
  (`DecisionService` calling `companionProperties.journal().decisionReviewDays()`), so it needed the
  same treatment; leaving it would have left one of the two ArchUnit-flagged edges unfixed.
