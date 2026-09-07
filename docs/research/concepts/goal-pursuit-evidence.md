---
title: Goal-Pursuit Evidence
type: concept
updated: 2026-09-06
tags: [goals, me, technique]
related:
  - goal-type-taxonomies.md
  - perma-and-wellbeing-taxonomies.md
  - ../../features/lifegoal.md
sources:
  - raw/articles/2026-09-06-lifegoal-prior-art-research.md
confidence: low
contradictions: []
---

# Goal-Pursuit Evidence

Three strands of goal-science literature, one theme: what actually makes a goal move, as opposed to
what merely decorates a goal-tracking screen. All three inform decisions in
`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md` — two feed **D1** and **D8** directly.
This page also carries the ingest's most important honesty caveat: two of its three legs never
reached their primary text.

## Progress monitoring: Harkin et al. 2016 — decision D1

**Citation:** Harkin, B., Webb, T. L., Chang, B. P. I., Prestwich, A., Conner, M., Kellar, I., Benn,
Y., & Sheeran, P. (2016). Does monitoring goal progress promote goal attainment? A meta-analysis of
the experimental evidence. *Psychological Bulletin*, 142(2), 198–229.

**Scale:** **k = 138** studies, **N = 19,951** participants, all randomized experiments comparing a
progress-monitoring intervention against a no/less-monitoring control.

**Effect sizes:** monitoring interventions raised the *frequency of monitoring* itself with
**d+ = 1.98** (95% CI [1.71, 2.24]); increased monitoring in turn promoted **goal attainment** with
**d+ = 0.40** (95% CI [0.32, 0.48]).

**The moderator that matters:** the effect on goal attainment was **larger when progress was
physically recorded and/or made visible to another person** — writing it down and/or making it
public each independently strengthen the monitoring → attainment link, relative to purely private,
unrecorded self-tracking.

This is why mezo treats visible progress tracking as the product's **core mechanism, not
decoration** (decision **D1**): a pillar's arrow, ring, and weekly sentence exist because recorded,
visible progress is the load-bearing part of the effect, not a UI nicety layered on top of a number
that would work just as well unrecorded.

**Honesty note — secondary source.** Neither the APA press-release PDF nor the PubMed abstract page
was readable directly (binary/stream-only PDF; the abstract page sat behind a cookie wall). The
k=138/N=19,951/d+=1.98/d+=0.40 figures and the public/recorded moderator finding come from
**search-engine-surfaced secondary sources** (an EurekAlert press release and a secondary blog
summary) that themselves quote the paper's own abstract. The numbers are corroborated across
sources but were never verified against the primary *Psychological Bulletin* text.

## Implementation intentions: Gollwitzer & Sheeran 2006 — decision D8

**Citation:** Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal
achievement: A meta-analysis of effects and processes. *Advances in Experimental Social Psychology*,
38, 69–119.

**Scale and effect:** **k = 94** independent tests, **N > 8,000** participants total, pooled effect
on goal attainment of **d = 0.65** (medium-to-large).

**Mechanism:** implementation intentions are concrete if-then plans ("if situation X arises, then I
will perform response Y") formed in service of a goal; the meta-analysis finds they reliably
outperform a mere goal intention ("I want to achieve X") at translating intention into actual
behavior.

This is decision **D8**: mezo's goal wizard asks for a concrete **when/where** plan attached to a
new goal, not just the aspiration itself — the wizard step exists because the if-then structure is
the evidenced part, not the aspiration text.

**Honesty note — secondary source.** The ScienceDirect chapter record returned a 403 on direct
fetch; the k=94/N>8,000/d=0.65 figures are corroborated across multiple independent secondary
listings (ResearchGate, Semantic Scholar, a university repository record) that consistently cite
the same numbers, but none of them is the primary chapter text itself.

## Goal content: SDT / Niemiec, Ryan & Deci 2009 — also decision D8

**Citation:** Niemiec, C. P., Ryan, R. M., & Deci, E. L. (2009). The path taken: Consequences of
attaining intrinsic and extrinsic aspirations in post-college life. *Journal of Research in
Personality*, 43(3), 291–306.

**Sample:** **N = 147** post-college participants, followed longitudinally roughly 1–2 years after
graduation.

**Key statistics:**
- Intrinsic aspiration attainment (personal growth, relationships, community, health) predicted
  wellbeing with **β = .77** and ill-being with **β = −.66**.
- Extrinsic aspiration attainment (wealth, fame, image) was unrelated to wellbeing (**β = .00**,
  ns) but positively predicted ill-being (**β = .38**).

Attaining an extrinsic-type goal carries no wellbeing upside and a measurable ill-being downside;
attaining an intrinsic-type goal carries both a wellbeing upside and an ill-being reduction. This is
the second half of decision **D8**: the wizard's framing nudge steers a new goal's phrasing toward
intrinsic content (mastery, relationships, health) rather than extrinsic content (appearance,
status, external validation) precisely because the two attainment types diverge this sharply on
outcomes that matter.

**This leg was read in full.** Unlike the two above, the PMC copy of this paper (PMC2736104) was
directly reachable and readable — only the self-hosted PDF at selfdeterminationtheory.org returned
binary-stream garbage. The β-values above are quoted straight from the primary text.

## Why `confidence: low`

Two of this page's three legs — Harkin and Gollwitzer — never reached a primary text; their numbers
are secondary-sourced, however consistently corroborated. The SDT leg, by contrast, was read in
full from PMC. A page's confidence is the confidence of its **weakest** leg, not its strongest: a
reader citing this page for the Harkin or Gollwitzer numbers is one hop further from the primary
literature than the page's SDT section alone would suggest, so the page as a whole is rated `low`
rather than `medium` or `high`.

## See also

- [Goal-Type Taxonomies](goal-type-taxonomies.md) — the pillar-kind taxonomy these effects apply to.
- [PERMA and Wellbeing Taxonomies](perma-and-wellbeing-taxonomies.md) — the life-area split the SDT
  wellbeing outcomes above sit alongside.
- [`lifegoal.md`](../../features/lifegoal.md) — the shipped wizard (D8) and pillar-tracking UI (D1)
  these findings feed.
