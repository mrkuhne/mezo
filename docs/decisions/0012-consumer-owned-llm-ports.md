# 0012 — Consumer-owned LLM ports for feature→companion seams

- **Status:** Accepted
- **Date:** 2026-07-18
- **Driver:** mezo-8vum (Fuel Kamra URL-scrape import — the first non-companion feature to need an LLM)

## Context

The URL-scrape import (Fuel Kamra, `docs/superpowers/specs/2026-07-18-fuel-url-scrape-import-design.md`)
needs an LLM to extract a nutrition draft from a stripped product page. The LLM seam is the
`CompanionLlm` port ([ADR 0008](0008-companion-llm-spring-ai-2-gemini.md)), owned by
`feature/companion`. The scrape pipeline lives in `feature/pantry`.

The obvious wiring — inject `CompanionLlm` directly into `feature/pantry` — introduces a
`pantry → companion` package edge. But **companion already depends transitively on pantry**
(`companion → fuel`/`meal → pantry`, because the companion reads meals and the pantry for its
context), so a direct `pantry → companion` edge closes a cycle. The `ArchitectureTest` feature-slice
cycle rule (part of the 11-rule ArchUnit suite) rejects it: the direct edge would have formed **3
slice cycles**. This is not a freeze-the-cycle situation — the convention
([ADR 0007](0007-machine-enforcement-of-conventions.md)) exists precisely to keep the feature graph
acyclic; the dependency direction has to stay one-way.

Two ways keep it one-way:

- **(a) Relocate `CompanionLlm` down to `techcore`** — then any feature can depend on it with no
  feature→feature edge at all.
- **(b) Consumer-owned port** — the *consuming* feature (pantry) defines the narrow interface it
  needs, and the companion feature provides the adapter that delegates to `CompanionLlm`. The only
  cross-feature edge is then companion → pantry (the adapter imports the pantry-owned interface),
  which runs the **same direction** the transitive dependency already runs — no cycle.

## Decision

Adopt **(b) — the consumer-owned port + companion-side adapter** for feature→companion LLM seams.

1. **The consumer owns the seam it needs.** `ScrapeLlm` (`feature/pantry/service`) is a one-method
   interface (`complete(systemPrompt, userMessage)`) mirroring `CompanionLlm`'s cheap-tier overload.
   Pantry never imports `feature.companion`.
2. **The provider feature supplies the adapter.** `PantryScrapeLlmAdapter`
   (`feature/companion/llm`) implements `ScrapeLlm` by delegating to `CompanionLlm`. It is
   `@ConditionalOnProperty(companion switch)` exactly like every other `CompanionLlm` consumer, so
   with the companion off there is **no adapter bean**.
3. **The consumer reaches the port through `ObjectProvider<ScrapeLlm>`** (the scrape switch is
   independent of the companion switch): companion-off → no adapter bean → the scrape endpoint
   degrades to a clean **503** (`ScrapeExtractionService#requireAvailable`), never a 500.
4. **This is the prescribed pattern for future feature→companion consumers.** In particular the
   upcoming meal AI-log feature (mezo-78rn,
   `docs/superpowers/specs/2026-07-18-fuel-ai-meal-log-design.md`) will define a meal-owned port +
   companion adapter of the same shape; **this ADR supersedes that spec's "meal → companion one-way
   edge" line** (a direct edge would cycle the same way pantry's would).

## Consequences

- **Per-consumer ports + thin adapters proliferate.** Each new feature→companion seam adds a
  one-method interface in the consumer plus a one-line delegating adapter in companion. Accepted:
  the blast radius per consumer is tiny, and each port stays exactly as narrow as its consumer needs
  (no leaking of the full `CompanionLlm` surface).
- **`CompanionLlm` stays the single provider seam** ([ADR 0008](0008-companion-llm-spring-ai-2-gemini.md)).
  The adapters all funnel into it, so the provider-swap story (one adapter behind `CompanionLlm`) and
  the model-tier config are unchanged — the tiers live in one place still.
- **The ArchUnit feature-slice cycle rule stays green with no per-edge exception** — the architecture
  stays honestly acyclic; no cycle is frozen.
- **`techcore` relocation remains a future option.** If the adapters multiply (several consumers each
  with a near-identical delegating adapter), moving `CompanionLlm` (or a thin `Llm` seam) down to
  `techcore` collapses them into direct `techcore` dependencies. Deferred until the adapter count
  justifies the larger blast radius; the consumer-owned port was the smallest-blast-radius choice for
  the first one-to-two consumers.

## Alternatives considered

- **Relocate `CompanionLlm` to `techcore` now** — one seam, zero adapters, any feature depends on it
  directly. Rejected for now: it drags the companion's core port (and its Spring AI wiring lineage)
  out of the companion slice on the strength of a *single* second consumer — a larger blast radius
  than two small ports. Kept as the escape hatch above if adapters multiply.
- **Direct `pantry → companion` injection + freeze the ArchUnit cycle** — rejected: freezing a slice
  cycle defeats the machine-enforced convention ([ADR 0007](0007-machine-enforcement-of-conventions.md))
  whose entire job is to keep the feature graph acyclic; it would rot the dependency direction for
  every future reader.
- **No LLM (per-vendor HTML parsers)** — rejected in the scrape design itself: brittle per-site code,
  and the point of the slice is a site-agnostic extractor. This alternative removes the companion
  dependency but fails the feature.
