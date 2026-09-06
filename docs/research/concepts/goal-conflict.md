---
title: Goal Conflict
type: concept
updated: 2026-09-06
tags: [goals, me]
related:
  - goal-pursuit-evidence.md
  - ../../features/lifegoal.md
  - ../../features/companion.md
sources:
  - raw/articles/2026-09-06-lifegoal-prior-art-research.md
confidence: medium
contradictions: []
---

# Goal Conflict

What happens when a user holds two goals whose pursuit competes for the same finite resource, or
whose end-states are logically incompatible. mezo surfaces this as a companion warning rather than a
gate. The project's own design spec overstates what its cited source establishes; this page
corrects that.

## Correction: Gorges & Grund 2017 is a review, not an effect-size study

`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md` §2 cites Gorges & Grund (2017) as
showing that parallel goals' resource conflict *"rontja az elérést"* ("worsens attainment"). Read in
full from its primary text (PMC5696770), the paper is **not an empirical study with its own effect
sizes** — it is a **narrative/theoretical review**. The authors systematically screened **161**
candidate articles published **1985–2015**, narrowing to **35** peer-reviewed studies meeting their
inclusion criteria for intraindividual goal conflict, and synthesized definitions and methodological
approaches across that set. It reports **no pooled or meta-analytic effect size, and no
correlation** between goal conflict and attainment. Do not attribute a quantified effect to this
paper — it does not measure one.

## What it does give: a definition and a two-way taxonomy

The paper is still useful, just not for a number. It supplies:

- **The definition** (quoting Emmons et al., 1993): goal conflict is *"a goal that a person wishes to
  accomplish interferes with the attainment of at least one other goal that the individual
  simultaneously wishes to accomplish."*
- **A taxonomy of two conflict types:**
  - **Resource-based conflict** — goals competing for a finite, shared resource: time, energy,
    money.
  - **Inherent conflict** — goals whose pursuit strategies or end-states are logically
    incompatible, independent of any shared resource.

That taxonomy — not an effect size — is the part mezo actually uses.

## mezo's position: companion warning, not a hard constraint

Decision **D7** of the system-design spec: *there is no cap on active goals.* Parking a
conflicting goal is left as the user's own tool; goal conflict (two goals pulling the same
underlying signal in opposite directions) is surfaced as a **companion-voiced sentence**, not a
block. Per the spec's own D7 rationale: *"a korábban tervezett 3-as 409-es kapu törölve"* — a
previously planned HTTP-409-style hard gate on conflicting goals was deleted from the design.

This means D7 was already better-calibrated than its own citation: Gorges & Grund never claimed
conflict makes goals unattainable, only that it exists as a documented phenomenon worth naming and
distinguishing by type. Treating it as a warning rather than a constraint fits what the source
actually supports — a conceptual heads-up, not a quantified attainment penalty — even though the
spec text reached for a stronger empirical claim than the paper makes.

## Where it renders

The conflict signal is a derived read-time check: when two active goals' pillars pull the same
underlying signal in opposing directions (the system-design spec's own example: a `GYM_VOLUME_KG`
habit pushing up against an `ACWR` guard pushing down), mezo renders a companion sentence under a
"Cél-ütközés" ("Goal conflict") heading on the goal detail page. The concrete surface is the
`.lg-conflict` line in `frontend/src/features/me/pages/CelPage.tsx:135` — each conflict renders as
one `<p className="lg-conflict">` row with a layered-icon glyph and the warning text, never a
blocking control. A sibling task in this same round put this render path under visual-golden guard
by seeding a mock conflict, so the rendered sentence now has regression coverage.

## See also

- [`goal-pursuit-evidence.md`](goal-pursuit-evidence.md) — the other goal-science findings (monitoring, implementation intentions, goal content) this conflict warning sits alongside.
- [`lifegoal.md`](../../features/lifegoal.md) — the shipped pillar model the conflict check reads.
- [`companion.md`](../../features/companion.md) — the companion-voice surface the conflict sentence renders through.
