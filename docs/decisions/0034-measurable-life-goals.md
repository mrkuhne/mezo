# ADR 0034 — Life goals are measurable and visible: the PERMA-widget and identity-progress-bar prohibitions are overridden, with the anti-manipulation guardrails intact

- **Status:** accepted (2026-09-03)
- **Driving bd:** `mezo-iizd` (epic; slice 1 `mezo-iizd.1`)
- **Spec:** [`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`](../superpowers/specs/2026-09-02-lifegoal-system-design.md) §1 (D1, D2, D7), §2 (prior art) and §7 (AI, companion, ADR)
- **Feature doc:** [`docs/features/lifegoal.md`](../features/lifegoal.md)
- **Overrides (narrowly, for this feature only):** the old PRD's **IDENT-5** note — "PERMA never surfaces as a 5-dimension widget in the UI … only as `PERMANarrativeAnchor` injection into companion narrative" ([`docs/old docs/mezo-architecture.md`](../old%20docs/mezo-architecture.md) §1.1 IDENT-5 row, [`mezo-prd.md`](../old%20docs/mezo-prd.md) §2.4.1 + §3.1 IDENT-5) — and the **anti-pattern D38** clause that identity-goal progress "is internal-only … NOT surfaced as UI progress bar".
- **Does NOT override:** anti-pattern D38's actual subject — manufactured milestones — nor any of the other 47 dark-pattern non-goals (PRD §2.4.1), nor [ADR 0010](0010-gamified-growth-xp-feedback-not-payment.md)'s "XP is feedback, not payment".

## Context

Two clauses in the pre-Phase-1 governance documents forbade exactly the surface this feature ships.

**IDENT-5** established PERMA as Mezo's whole-life scope, then immediately fenced it off from the UI: the six dimensions were to reach the user *only* through companion narrative, never as a widget. **Anti-pattern D38** — one of the five ⭐ "mentor-role corruption" patterns that require explicit justification at review — was written against *manufactured 5-minute milestones* (app-open achievements, daily-login streaks, an achievement pop-up every five minutes). Its enforcement clauses swept `IdentityGoal.reinforcement_count` along with them: the counter became internal-only, consumed by the `mirrorIdentity` tool, and explicitly *"NOT surfaced as UI progress bar"*.

Both clauses were downstream of the same axiom, which remains the constitution of this product: **the primary reward is the sense of being seen** (PRD §2.3, IDENT-1 refinement of 2026-05-17) — the experience of being accurately recognised by the companion — and it *replaces* the classical points/coins/XP/badge reward class rather than sitting beside it. The fear both clauses encode is real and specific: a progress bar over something as identity-laden as "who I am becoming" invites the whole loss-aversion machinery (streak shame, decay, "your status downgrades in 7 days" — anti-patterns A and E), and a five-dimension PERMA gauge invites the Gyroscope-style single life score that the brainstorm's prior-art review rejected as opaque.

Three things have changed since those clauses were written.

1. **There is now real, passively-collected data to measure against.** IDENT-5 was drafted when PERMA had no signal behind it — a widget then would have been a gauge over nothing, which is precisely the fabrication this codebase's honest-state rule forbids. Today the app already logs meals, sleep, training, weight, four-a-day check-ins, habits, the day-close ritual, the activity ledger and mentioned people. D3 binds the feature to those existing signals only: **no new logging surface**, no external integration, no self-report. The closed 28-entry `SignalCatalog` is the whole permitted universe.
2. **The evidence points the other way for goal attainment specifically.** Harkin et al. 2016 (*Psychological Bulletin*, meta-analysis of 138 randomised studies, N ≈ 19,900) found that prompting progress monitoring raises goal attainment, and that the effect is **larger when progress is physically recorded and larger again when it is publicly — i.e. visibly — reported** (d ≈ 0.40). The "narrative only" posture was chosen to protect motivation; on the specific task of *reaching a stated goal*, hiding the progress is the weaker option. This is a per-goal measurement claim, not a claim about wellbeing gauges in general.
3. **The wizard's framing step gives the override its safety rail.** D8 puts a self-determination-theory nudge in front of every goal: an extrinsically-framed *why* ("so I look better on the beach") is offered an intrinsic reframe (health, capability, relationship) as a **suggestion the user may decline**, never a block (Niemiec, Ryan & Deci 2009 on intrinsic aspirations and wellbeing). Making progress visible is risky mainly when the goal itself is extrinsic; the wizard works on that first.

A fourth, smaller point: the owner is the single user of this product and asked for it directly. That is not evidence, but it is the decision right, and it is recorded here as D1's first line rather than dressed up as a finding.

## Decision

**Life goals are measurable and visible: each goal carries per-goal progress the user can see, and PERMAH is the visible life-area layer.** IDENT-5's "never a widget" and D38's "never a UI progress bar" clauses are overridden for the `lifegoal` feature and for nothing else.

1. **Per-goal progress is computed and shown.** A goal's pillars each resolve to a daily judgement from the existing signals, and the goal's own page presents where the goal stands. `IdentityGoal`'s narrative-only treatment is untouched — this ADR licenses progress on the *new* `life_goal` aggregate, not a retrofit of the old identity entity.
2. **PERMAH is a visible layer: six dimensions, a chip band and a hub ring** — Érzelem · Elmélyülés · Kapcsolatok · Értelem · Teljesítmény · Egészség (D2; Health is PERMA's practical extension and is labelled as such). It shows **how many active goals sit in each life area** — a distribution of the user's own declared commitments. It is deliberately **not** a wellbeing score, not a percentage per dimension, and not summable into a single life number; the Gyroscope-style aggregate score was considered and rejected (spec §2).
3. **Practice rides on skills, not on the dimension.** Each pillar points at a Growth skill (`ProgressionTaxonomy`), which is where XP lands (D2). The PERMAH layer classifies; the skill layer rewards. One economy, per ADR 0010.
4. **No cap on the number of active goals** (D7). Parking is the user's own instrument; a goal conflict (two goals demanding the same rest day) is a **companion sentence**, never a block — Gorges & Grund 2017's conflict finding is adopted as a warning, rejected as a hard limit.

### Guardrails that survive the override

These are not softenings of the decision; they are the conditions under which it holds. A future change that breaks one of them re-opens this ADR.

- **No loss mechanics of any kind.** No streak to break, no decay, no expiry, no countdown, no "you'll lose X". Anti-pattern categories A, B, E and I apply in full to this feature.
- **A declining trend is never red.** `↘` renders in the ordinary palette; terracotta remains the app-wide maximum intensity (ADR 0033). Down is information, not an alarm.
- **`no_data` is never a miss.** A day with no signal is honestly absent, never a zero and never a failure. "Ami nincs naplózva, az nem nulla — az üres."
- **Minimum-data gates before any trend is shown.** No arrow until the comparison windows carry enough real days (7-vs-21 with a ≥5 data-day floor); a baseline pillar needs its own minimum before it means anything. Until the gate is met, the slot renders an honest placeholder — an em dash and "még nincs adat" — never a computed-looking number, arrow or percentage.
- **XP stays feedback, never a penalty.** A fulfilled pillar-day awards XP to its skill through the same idempotent `award(...)` tail; a missed one awards nothing. There is no negative XP, no clawback, and no XP-gated content (ADR 0010).
- **The AI proposes from a closed catalog; the user approves** (D4, ADR 0019's propose-only pattern). The model may not invent a metric, and every proposal it returns must already be a legal save.
- **The measurement stays inside the user's own sphere.** No comparison to other people, no leaderboard, no external benchmark — IDENT-2's internal-sphere rule is untouched.

## Consequences

- **The old governance docs and this ADR now disagree in writing, and this ADR wins for `lifegoal`.** `docs/old docs/` is an archived pre-Phase-1 record and is not being rewritten; anyone reading IDENT-5 or D38 there must follow the override recorded here. The narrow scope is deliberate — a future feature that wants a visible gauge does not inherit this permission and needs its own decision.
- **Anti-pattern D38 keeps its teeth where they were aimed.** Manufactured milestones remain forbidden: no achievement for opening the app, no daily-login streak, no celebration for a trivial check-in. What this ADR permits is the honest display of progress toward a goal the user *declared and can edit*, which is the opposite of a manufactured milestone.
- **Honest-state handling becomes load-bearing rather than stylistic.** Because progress is now visible, an empty slot is the most common state a new goal will show for its first week. Every placeholder must read as "no data yet", never as zero — a fabricated number here would be a worse defect than the widget prohibition was ever guarding against.
- **The sense-of-being-seen axiom is not displaced, it is extended.** The dimension band and the goal page are the companion showing the user their own commitments back to them; the weekly narrative still *explains* the numbers rather than being replaced by them (D6: the nightly job computes, the LLM only narrates).
- **A per-goal number invites a per-life number, and that pressure is now permanent.** The most likely erosion of this decision is someone summing the six dimensions into one score. That is out of bounds by point 2 and was rejected on prior art; it should be refused on sight.

## Alternatives considered

- **Honour IDENT-5 literally — narrative-only life goals.** The companion would describe progress in prose, with no dimension band and no per-goal surface. Rejected on Harkin et al.: on goal attainment specifically, recorded and visible monitoring is the stronger intervention, and prose alone cannot answer "am I closer than last week" at a glance. It also leaves the computed daily rows invisible to the user while still storing them, which is a transparency loss, not a gain.
- **A single "life score".** Rejected on prior art (Gyroscope, spec §2): one aggregate number is opaque, cannot be acted on, and would make the dimensions compete for it — the exact aggregation IDENT-5 was right to fear.
- **Keep PERMA hidden and show only skills.** Skills alone measure *practice* and cannot express "which area of my life is this for", which is the whole point of a life-goal system; the hybrid (D2) exists because neither layer answers both questions.
- **Ship visible progress but cap active goals at three** (the original design's 409 gate). Rejected in the second design iteration (D7): a cap is a loss mechanic wearing a helpful hat, and the conflict it was meant to prevent is better handled by the companion saying so.
- **Amend the old PRD/architecture in place instead of writing an ADR.** Rejected: `docs/old docs/` is a historical record, and silently editing a governance clause a later feature contradicts would erase the reasoning. An override that is not written down is an override that gets re-litigated.
