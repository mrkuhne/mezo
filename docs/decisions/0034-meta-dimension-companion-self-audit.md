# ADR 0034 — META dimension: the companion's self-audit claims live beside, not inside, the user's dossier

- **Status:** accepted (2026-09-02)
- **Driving bd:** `mezo-1gim.15` (round 4, "Kapcsolatok & AI-meta")
- **Spec:** [`docs/superpowers/specs/2026-09-01-character-round4-kapcsolatok-ai-meta-design.md`](../superpowers/specs/2026-09-01-character-round4-kapcsolatok-ai-meta-design.md) §4.1–4.2
- **Domain doc:** [`docs/features/character.md`](../features/character.md)

## Context

Round 4 wires up two new detector groups. One reads people-mention context, sleep-clock/
logging weekend patterns, and the assistant's own executed tool calls — squarely claims
**about the user** (who Daniel spends time on, how his week splits, what he talks to the
companion about), and belongs in the existing 7 CORE dimensions the way every prior round's
detectors did.

The second group is different in kind, not degree: it reads whether Daniel *kept or rejected*
the companion's suggested Tudástár facts and patterns, whether the companion's *own*
predictions were well calibrated, whether its *own* quest-difficulty tuning held up per slot,
and whether its *own* proposed experiments/challenges paid off. Every one of these is a claim
about **the companion's performance**, not Daniel's. Filing it into a CORE dimension — say,
`discipline` or `mental` — would silently relabel a system-quality signal as a Daniel
personality trait: "elutasítja a javaslatokat" reads as a claim about Daniel's skepticism when
the actual fact is that four of five recent suggestions were wrong. Prior art review
(round-4 spec §2, the Copilot-acceptance-rate literature) converged on the same point: raw
acceptance-style rates are a weak, easily-misattributed trust proxy, and the literature's fix is
to keep the accuracy signal legible as being about the system, not the user.

The round's own decision matrix (spec §4.1) weighed this against dossier-focus and
prompt-block usability, and honesty (weight 5, "the claim's subject decides") and the
system-blame risk (weight 5, "this is exactly the risk") dominated both alternatives below.

## Decision

**A third `character_dimension.kind`, `META`, holding exactly one seeded row.**

1. **Migration**: `ck_character_dimension_kind` widens to `CORE|CHAPTER|META`
   (`202609011600_mezo-1gim.15_character_dimension_meta_kind.sql`).
2. **Catalog**: `CharacterCoreCatalog.META` is a one-element list —
   `("self-audit", "A társ önvizsgálata", "szkeptikus")`. `ensureCoreDimensions` seeds CORE + META
   together (8 rows) via the unified `SEEDED` list; `kind = "META"` for the self-audit row.
3. **Ownership**: the Szkeptikus — until now only a konzílium verdict role with no dimension of
   its own — gains a dedicated `CharacterExpertCatalog.SKEPTIC` record (`key="szkeptikus"`,
   `primaryDimensionKey="self-audit"`, its own observer/proposer `systemPersona` distinct from
   its verdict-round voice), deliberately kept **outside** `EXPERTS` so the Csapat page and
   `MaturityRing` keep their fixed seven-expert shape. `byKey` checks `SKEPTIC` after `EXPERTS`.
4. **Rendering order**: the `[Karakter]` prompt block and the dimension list both render
   CORE (catalog order) → META → CHAPTER (`createdAt` order); the block gains a header clause
   telling the model the self-audit lines are about its own hit rate, not to overstate
   confidence beyond what they show.
5. **Retirement**: the monthly stale-chapter pass is `kind = "CHAPTER"`-scoped only — META is
   never eligible, the same as CORE.
6. **The subject rule** (spec §4.1): the claim's SUBJECT decides which dimension it lands in,
   never the data's source. A detector reading companion-authored data (a prediction, a quest,
   a suggested fact) is not automatically META — `chat-topic-shift` reads the companion's own
   tool-call log but is squarely about Daniel's conversation habits, so it stays CORE
   (`mental`, pszichológus). Conversely `knowledge-rejection-pattern` reads Daniel's own
   accept/reject decisions but is about the companion's suggestion quality, so it is META,
   Szkeptikus-owned, and ÉRZÉKENY (the companion's own prompt frames it as a mirror, never a
   verdict on Daniel).

## Rejected alternatives

- **A seeded CHAPTER with an assigned owner.** CHAPTER dimensions are AI-*opened* (via a
  konzílium chapter proposal), ownerless, and subject to 90-day stale retirement — a
  permanently-seeded, expert-owned CHAPTER would silently break both invariants for one row,
  and every future reader of `character_dimension.kind = 'CHAPTER'` would need a special case to
  exclude it. Not worth the maintenance tax for a shape that is structurally different anyway.
- **An 8th CORE dimension.** The seven CORE dimensions are spec-fixed as claims about Daniel;
  folding a system-quality dimension into that list breaks the "CORE = about the user"
  invariant `MaturityRing` and the Csapat page's SKEPTIC-vs-EXPERT distinction both lean on —
  the Szkeptikus is deliberately not one of the 7 EXPERTS, and giving it a CORE dimension would
  either force it into `EXPERTS` (colliding with its konzílium verdict role) or leave a CORE
  dimension with no expert owner (breaking every FE assumption that a CORE dimension's owner is
  in `CharacterExpertCatalog.EXPERTS`).

## Consequences

- `CharacterExpertCatalog.SKEPTIC` lives outside `EXPERTS` — any future code that iterates
  `EXPERTS` expecting "every dimension owner" must also check `SKEPTIC` (the prompt assembler,
  the konzílium proposal round, and `byKey` already do; a new call site that iterates only
  `EXPERTS` will silently skip the self-audit dimension, not crash).
- The `kind` enum widens in two places in the API contract
  (`CharacterDimensionSummary.kind`, `CharacterDimensionResponse.kind`), requiring a client
  regen and passing the contract-drift gate; `CharacterExpertDto.dimensionKey` gains the
  documented "`self-audit` for the Szkeptikus" case.
- The FE `MaturityRing` stays CORE-only by construction — it was already scoped to the CORE
  array, so a META dimension existing does not add an 8th arc; `DimensionsPage` renders it as
  its own solid-styled tile (`.kr-dimtile.meta`), distinct from both the CORE default and the
  dashed CHAPTER variant.
- Every Szkeptikus-authored META claim/observation/summary must keep the system as its
  grammatical subject — a wording bug here (blaming Daniel for the companion's own
  miscalibration) reintroduces exactly the honesty risk this ADR exists to prevent; there is no
  code-level gate for this, only the persona-prompt wording and review discipline (mirroring how
  `sensitive`-claim tone already relies on prompt wording, not a code gate).
