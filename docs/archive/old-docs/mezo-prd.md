---
title: Mezo Product Requirements Document
version: 2.1
status: draft
date: 2026-05-15
last-edited: 2026-05-23
author: Daniel Kuhne
supersedes: _bmad-output/prd/_archive/mezo-prd-v1-hybrid.md
architecture-ref: _bmad-output/architecture/mezo-architecture.md
prototype-ref: frontend_design/  # HARD design contract, adopted 2026-05-23
realignment-ref: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-23.md
brainstorm-input: _bmad-output/brainstorming/brainstorming-session-2026-05-15-1245.md
related-beads:
  - mezo-eb8 (Spec v2 epic)
  - mezo-eb8.11 (Section 1 Vision rewrite)
  - mezo-eb8.12 (Section 4 Entities expand)
  - mezo-eb8.13 (Section 7+9 Design + Pages)
  - mezo-eb8.14 (Section 5 AI Pipeline extend)
  - mezo-eb8.15 (Section 6 Functions extend)
  - mezo-eb8.16 (Section 10 Roadmap rewrite)
  - mezo-eb8.17 (Section 11 Open Qs update)
  - mezo-ron (Phase 4+5 plan rewrites epic)
  - mezo-1go (PERMA scope expansion epic)
  - mezo-g7i (prototype-driven realignment epic)
  - mezo-0dv (PRD realignment task — this edit)
edit-history:
  - date: 2026-05-23
    by: bmad-edit-prd
    changes: 'v2.1 prototype-driven realignment — §3.2 re-scope principle, §4.1.1/§4.4/§4.5, §5.9-5.12 journeys, §6.5 FRs, §7.7 NFR-A-5..7'
---

# Mezo — Product Requirements Document (PRD)

**v2.0 · 2026-05-15 · Author: Daniel Kuhne**

This PRD is the canonical product specification for Mezo. It is paired with the [Architecture document](../architecture/mezo-architecture.md), which describes the technical implementation. Together they supersede the v1.0 hybrid spec at [_archive/mezo-prd-v1-hybrid.md](_archive/mezo-prd-v1-hybrid.md).

The v2.0 rewrite integrates the 2026-05-15 brainstorm session output: **79 feature ideas**, **6 product-identity principles (IDENT-1..6)**, and a **scope expansion from sport+health tracking to PERMA / whole-life companionship**.

**v2.1 · 2026-05-23 — prototype-driven realignment.** A complete Claude-designed frontend prototype (`frontend_design/`) is adopted as the **hard design contract**, the phases are being re-scoped, and this PRD is realigned accordingly. See the [Sprint Change Proposal](../planning-artifacts/sprint-change-proposal-2026-05-23.md) and [Prototype Inventory](../planning-artifacts/prototype-inventory.md). Cascade tracked under bd `mezo-g7i`.

---

## 0. Overview

| Aspect | Reference |
|---|---|
| Product name | Mezo |
| Form factor | iPhone-first PWA (mobile-first, dark canvas) |
| Primary user, Phase 1-7 | Daniel Kuhne (dogfood + product-market-fit validation) |
| Public launch | Phase 8 (multi-tenant SaaS, beta-1) |
| Primary problem | Six fragmented trackers; no entity-level correlations; no proactive companion |
| Primary outcome | A single source of truth + a layered-memory AI that walks every step of the user's day as a *companion*, not a coach |
| Tech foundation | Supabase (Postgres BaaS + RLS + Edge Functions + pgvector) · Google Gemini 3.1 · LangGraph.js hybrid · Vite + React 19 + Tailwind 4 PWA |
| Timeline | ~14 weeks across 8 phases |

---

## 1. Executive Summary

**Mezo** is a mobile-first, holistic AI performance and health platform. It unifies hypertrophy training (RP-philosophy mesocycles), precise nutrition (macros + micros + supplement timing), stimulant + medication management (Retatrutide, creatine, caffeine), sleep + weight monitoring, gut health, and 4×/day check-ins.

Above the data sits a **4-layer AI memory** (statistical L1 · iterative-pattern L2 · semantic-recall L3 · knowledge-graph L4) backed by Gemini 3.1 + pgvector + LangGraph. The AI does not behave as a tracker or a coach. It behaves as a **companion** — one that proactively walks every step of the user's day, remembers years of context, never goes silent, and never acts in the outside world without permission.

The product is built for Daniel as the primary user (Phase 1-7), with architecture multi-tenant-ready from day one (row-level RLS, user-bound namespaces). Phase 8 opens the platform to a broader audience of precision-tracker enthusiasts: biohackers, natural bodybuilders, performance-focused endurance athletes, and clinical patients on metabolic interventions.

**The differentiating thesis**, validated by the 2026-05-15 brainstorm session: *a tracker that knows you, a coach that instructs you, and a companion that walks with you are three different products*. Mezo is the third.

---

## 2. Product Vision & Identity

### 2.1 The problem we are solving

Daniel's current setup spans six trackers: Hevy (workouts), MyFitnessPal (food), Apple Health (passive metrics), paper notes, Excel, and ad-hoc memory. The cost is not effort — it is **invisible correlations**:

- How does the weekly Retatrutide injection interact with appetite, weight delta variance, and workout performance across the 7-day kinetic cycle?
- How does late-evening carbohydrate timing affect deep sleep, which in turn affects next-morning RPE and PR likelihood?
- How does caffeine pacing on a volleyball day cascade into evening recovery, which feeds back into the next gym session?
- How does a missed pre-workout protein meal cascade through late dinner → poor sleep → low morning energy → poorer training the following day?

No single-domain tracker can see these chains. They are by definition **cross-entity, time-shifted, causal** — and they are the actual driver of the user's outcomes.

### 2.2 The solution thesis

A **single source of truth** that loads every domain into a unified entity-relational model, with a **4-layer memory** on top that:

- Detects statistical correlations across all entities (Layer 1)
- Generates and critiques AI hypotheses about causal patterns iteratively (Layer 2)
- Retrieves semantically-similar past episodes for context (Layer 3)
- Stores user-confirmed knowledge as a long-lived graph that grows continuously (Layer 4)

This memory is injected into every Gemini call. The result is an AI that *actually knows the user*. But knowing is not the goal. **Companionship** is.

### 2.3 The six identity principles (IDENT-1..6)

The brainstorm session of 2026-05-15 surfaced six product-identity principles. These are not features. They are the **operating axioms** of every UI decision, every prompt template, every entity schema, every push notification, every silence, every celebration. They override any other consideration in case of conflict.

#### IDENT-1 — *Companion, not coach*

Mezo is not an AI coach. It is a **companion that walks alongside the user**. A coach instructs ("eat more protein"). A companion remembers, witnesses, and celebrates ("remember three weeks ago when you skipped lunch before leg day and felt terrible? Let's not do that today").

**Operational implications:**
- The brand voice prompt is `companionVoice.md`, not `coachVoice.md`.
- Default grammatical voice: **first-person plural** ("let's do this", not "you should do this").
- Every fifth message must reference a shared past moment — the new `recallSharedMemory(theme)` Coach tool exists for this.
- Empathy markers are first-class output (not decorative). Tone is performance-oriented but warm, never clinical, never moralizing.

**Refinement (brainstorm 2026-05-17 — gamification + motivation):**

The original "Companion, not coach" framing risks being misread as "Companion = infinitely accepting friend" — but a true mentor *challenges through relationship*, not through authority. The Mezo companion-archetype is closer to a **mentor-tanítvány viszony** (mentor-apprentice relationship; cf. Daniel's monthly "Mizu Velünk" 1:1 ritual with mentees) than to a passive-accepting friend. The refinement clarifies three crucial points:

1. **"Not coach" ≠ "not challenging"**. The companion *can disagree, push back, name avoidance, surface meta-patterns of rationalization* — through trust, never through authority. A companion who only agrees is a sycophant, not a mentor. This is the **Supportive Challenge mode**.

2. **Three-way distinction in "not doing"**. The companion must distinguish between (a) **legitimate rest/recovery** (illness, exhaustion, crisis → enhanced presence + lowered demands), (b) **drift / avoidance / self-sabotage** (rationalized inactivity → gentle naming of the pattern, never blame), and (c) **legitimate value evolution** (genuine priority change → curious exploration). Accepting everything passively is *neglect dressed as respect*.

3. **Primary reward axiom — sense-of-being-seen** (IDENT-1-derived): the central reward type in Mezo is the experience of being *accurately recognized* by the companion (`KnowledgeGraph` made legible to the user, mirrored back as memoir, identity-stage naming). This **replaces** the classical points / coins / XP / badge reward class entirely. Recognition-of-self > extrinsic juices.

**Additional operational implications:**
- `companionVoice.md` MUST include Supportive Challenge mode prompt fragments with example phrasings ("I hear you. AND — you said this two weeks ago too. Could there be something deeper?").
- 24 Coach tool catalog MUST add a `surfacePatternOfAvoidance(timeframe)` tool that runs when drift signals are detected by `Pattern` analysis.
- `AnchorMode` entity is subdivided into **`AnchorMode-A`** (Acceptance — legitimate crisis: presence + lowered demands) and **`AnchorMode-D`** (Drift — detected avoidance: supportive challenge + presence) — see Architecture entity tree.
- The companion MAY refuse user requests on wellbeing grounds (e.g., refusing a 7-day adaptation experiment when `AdaptationBudget` is depleted). This is IDENT-1-compatible, not paternalism — it is a mentor protecting the user from over-extension.
- Anti-pattern enforcement: the 48-pattern Dark-Pattern Non-Goals catalog in §2.4 is **non-optional governance**; any proposed feature that pattern-matches an item in the catalog must be flagged at PRD review.

**Source:** `_bmad-output/brainstorming/brainstorming-session-2026-05-17-1122.md` — items F2-A56 (the explicit refinement catch caught by Daniel mid-session), F2-A49 (rest/drift/evolution distinction), F1-#18 (sense-of-being-seen reward axiom), F2-A50..A52 (supportive challenge mechanics).

#### IDENT-2 — *Internal sphere only*

The companion **never acts in the outside world** without user consent for each action class. This is a safety + agency principle, not a feature limitation.

**Permitted (read + suggest + push + compute):**
- Read user data from any internal source.
- Make suggestions to the user.
- Send in-app and push notifications.
- Compute, predict, and propose.

**Forbidden by architecture (no Coach tool exists for these):**
- Send email or message to third parties.
- Modify external calendars.
- Place orders or initiate financial transactions.
- Communicate with friends, coaches, doctors, or partners on the user's behalf.
- Sign agreements, accept terms, or grant external permissions.

The LangGraph Coach tool registry explicitly excludes every outward-acting tool. This is documented in [Architecture §4.3](../architecture/mezo-architecture.md#43-coach-tool-registry).

#### IDENT-3 — *Never silent — continuous companionship*

The companion **never goes silent**. The brainstorm session surfaced an explicit emotional response from the user: "*one quiet week would mean abandonment and doubt*." The companion's presence is **architecturally guaranteed**, not engagement-driven.

**Minimum service level (SLA):**
- Minimum 3 contextual pushes per day: morning briefing, midday context-aware nudge, evening closing.
- Weekly memoir (Sunday evening, 1-paragraph narrative).
- Anniversary moments (monthly + annual milestones).
- WOW-moment target: 2+ per week of "ah, I hadn't thought of that" tips.
- 24 hours of silence triggers a `SelfHealthCheck` Edge Function ("I haven't reacted well today — what did I miss?").

The success metric for Mezo is **not** `engagement_rate`. It is `coach_presence_score` — a measure of *the companion's* daily reliability, not the user's effort to engage.

#### IDENT-4 — *Self-logging is the enemy*

Every form the user has to fill is a friction wall and a presence-killer. The companion is responsible for the data, not the user.

**Logging hierarchy, from most preferred to least:**
1. Passive / sensor-based (HR, GPS, calendar, screen-time, weight scale)
2. Voice-first (5-30 second voice notes, AI-structured into entities)
3. Photo (meal recognition, supplement-label scans)
4. AI-proactive question (one-tap answer chips)
5. Number-tap micro-input
6. Choice chips
7. Free text (last resort)

A unified `QuickInputSheet` component routes all input into the best available modality at the moment. The form-driven UI is the failure mode, not the default.

Voice-first free notes also enable **people-mention detection** (`PersonEntry`): when the user says "had a tense morning with Petra," the AI extracts the person, the emotional tone, and the relational impact over time.

#### IDENT-5 — *PERMA / whole-life scope*

The brainstorm session surfaced an explicit user-future-self quote: "*peak performance in every other area of life too*." Mezo is not a sport-and-health app. It is a **life-companion** with PERMA dimensions (Seligman):

- **P**ositive emotion (joy, calm, satisfaction tracking)
- **E**ngagement (flow states, deep work, athletic peak experiences)
- **R**elationships (`PersonEntry` interactions and quality)
- **M**eaning (`IdentityGoal` long-term alignment)
- **A**ccomplishment (training, work, life milestones)

This is reflected in:
- A new AI memory L3 sub-layer: `PersonalLifeContext` (work schedules, deep-work blocks, calendar events, social commitments, travel)
- New entities: `PERMAGoal`, `IdentityGoal`, `PersonEntry`, `Event`, `EventDebrief`, `ContextEpoch`, `PsychInsight`
- A new "Beyond-body" scope in the morning briefing and weekly memoir

#### IDENT-6 — *Cognitive offloading*

The brainstorm surfaced: "*there are too many cogwheels in life for the perfect life — I cannot see them all*." The companion's highest value is **taking decisions off the user's plate**.

**Decision-layer hierarchy:**
- **L1 — Companion decides autonomously**: what breakfast suits today, exact supplement timing, push-message scheduling, micro-corrections in the day's plan.
- **L2 — Companion proposes, user approves**: weekly training plan, goal adjustments, new patterns to confirm.
- **L3 — User decides, companion asks**: long-term vision, identity-level changes, opting in/out of feature classes.

The user is never asked to make a decision that the companion has enough context to make alone.

### 2.4 What Mezo is *not*

To make the identity sharper, here is what Mezo is explicitly **not**:

- Not a calorie tracker (it tracks pacing, distribution, timing, and micronutrients — calories are a side effect)
- Not a workout logger (it understands mesocycles, cross-sport load, recovery, and prediction)
- Not a generic LLM chat (every response is grounded in the user's actual data, with hallucination-grounding middleware)
- Not an engagement-maximization product (presence over engagement; no streaks-for-dopamine)
- Not an external-agent (no calendar writes, no orders, no third-party messaging — IDENT-2)
- Not a static tracker that "starts over" each session (IDENT-3, IDENT-1 — continuity is enforced)

#### 2.4.1 Dark-Pattern Non-Goals catalog (brainstorm 2026-05-17)

The brainstorm session of 2026-05-17 used Reverse Brainstorming to generate an explicit catalog of **48 manipulative anti-patterns** Mezo MUST NEVER implement. These are governance-referenced as **explicit non-goals**. Full catalog: [brainstorming-session-2026-05-17-1122.md](../brainstorming/brainstorming-session-2026-05-17-1122.md). Summary by category:

| # | Category | Anti-pattern theme | Representative example |
|---|---|---|---|
| **A** | Streak / loss-aversion weaponization | Streak shaming, loss-prevention purchases, public streak shame | *"Pay 50 coins to restore your streak"* ⭐ |
| **B** | FOMO / scarcity weaponization | Time-limited rewards exploiting meaningful events | Birthday-only badges that expire ⭐ |
| **C** | Social comparison manipulation | Public leaderboards, peer-shaming pushes | *"12 people in Budapest worked out — you didn't"* |
| **D** | Slot-machine / variable reward | Random multipliers, hidden achievement triggers, dangling carrots | Lucky-day 5× XP mystery |
| **E** | Identity-anchor abuse | Pay-to-rank, identity-level decay, past-self shame | *"Your Atléta status downgrades in 7 days"* |
| **F** | Push-notification weaponization | Escalating pings, guilt language, vulnerability exploitation | ping → buzz → ring → loud alarm ⭐ |
| **G** | Currency-burn manipulation | Premium tokens, paying out of healthy recovery | *"Spend 100 coins to skip the rest day"* ⭐ |
| **H** | Achievement-inflation / completion-OCD | App-open achievements, manufactured 5-minute milestones | Achievement-pop-up every 5 minutes ⭐ |
| **I** | Sunk-cost weaponization | "Hours invested" guilt, data-deletion threats | *"Your training history deletes in 30 days"* |
| **J** | Personal-data weaponization | Mood-for-monetization, confessions in marketing copy, more pushes on bad-sleep days | Negative-state → "you need a coach!" upsell |

⭐ = the **5 most-corrupt patterns** (Daniel-flagged 2026-05-17 as **mentor-role corruption** — those that weaponize the trust granted to the companion). These 5 receive special pre-PR-review gating: any new feature that even pattern-matches to **D3 / D10 / D27 / D34 / D38** (full IDs in the brainstorm doc) must be explicitly justified at PRD review.

**Unifying governance principle:** Mezo's danger profile is **not gamification in general** — it is specifically the **corruption of the mentor role**. Anything that weaponizes the trust-asymmetry between user and companion is forbidden, regardless of short-term engagement upside.

### 2.5 Differentiation matrix

| Product | What it gives | What it lacks |
|---|---|---|
| Hevy | Workout log + PR | Nutrition, AI, gut, holistic, companion |
| Strong | Workout log | Same as Hevy |
| MyFitnessPal | Nutrition log | Workout, AI insights, companion |
| Whoop | Sleep + HRV + recovery | Workout log, nutrition, companion |
| Levels Health | CGM + meal | $400/mo, narrow domain, no companion |
| Generic LLM coach (ChatGPT, Replika) | Conversation | No grounded data, no continuity, no specific domain knowledge |
| **Mezo** | **All of the above + 4-layer memory + companion presence + IDENT-1..6 axioms** | (multi-user only Phase 8+) |

### 2.6 Target user profile

**Phase 1-7** — Daniel as primary user (validation cohort N=1):
- 33 years old, intermediate-advanced trainee
- 5×/week gym (hypertrophy, RP mesocycles)
- 5×/week volleyball (high jump volume, shoulder rotations)
- Treadmill cardio (variable speed/incline)
- Weekly Retatrutide injection under medical supervision
- Daily creatine, careful caffeine pacing (cutoff 14:00)
- Buys primarily from kifli.hu (food) and myprotein.hu (supplements)
- Notable: chronic minor injuries are common (active life), not rare exceptions

**Daniel-specific motivational anchors** (brainstorm 2026-05-17 — for Phase 1-7 single-user fit):

- **Rendszer-szerelem ("system-love")** — Daniel reports falling in love with *systems themselves*, not with rewards. The intrinsic motivation profile is dopamine-loop-resistant but **system-elegance-receptive**. *Design implication:* Mezo MUST be **system-transparent** — the companion periodically self-discloses its own mechanism (*"I detected this pattern by running covariance analysis on 47 days of training data — want to see the calculation?"*). AI self-disclosure-as-reward is a Daniel-fit axis that other apps avoid (they usually rejtik the mechanism).
- **"Új-ötlet-pörgés" (new-idea spin-up)** — Daniel has a strong intrinsic *"I want to try this new mini-system"* response. *Design implication:* side-quest format = **mentor-recommended low-stakes 7–14 day micro-experiments** (*"I read an interesting paper on glycogen replenishment — want to try a 7-day protocol?"*). The *trying* is the reward; no points, no FOMO, no penalty for skipping.
- **Mentor-tanítvány relational frame** — Daniel runs a monthly "Mizu Velünk" 1:1 ritual with 4 mentees. He natively understands and values mentor-apprentice dynamics. The Mezo companion-archetype maps to *mentor*, not friend / not coach / not therapist.

These three anchors define Phase 1-7 design fit. **Phase 8 multi-user generalization will require profile-detection logic** (some users are system-curious; others want pure outcomes — the companion must adapt its self-disclosure depth and side-quest density accordingly). This is an explicit Phase 8 work-item, not a Phase 1-7 concern.

**Source:** `_bmad-output/brainstorming/brainstorming-session-2026-05-17-1122.md` — items F1-#20 (Rendszer-szerelem), F1-#21 (Új-ötlet-pörgés), F1-#12..F1-#19 (mentor archetype).

**Phase 8+** — Public cohort:
- Precision-tracker enthusiasts (biohackers, performance-oriented enthusiasts)
- Natural bodybuilders and endurance athletes who need cross-domain correlations
- Patients on metabolic interventions (GLP-1, GIP, metformin off-label) who need pharmacokinetic-aware logging
- Users seeking a long-term life-companion, not a habit tracker

The architecture is multi-tenant from day one (row-level RLS, user-scoped embeddings, per-user knowledge graph). Phase 8 is therefore a launch milestone, not a refactor.

---

## 3. Success Criteria

Each criterion is *testable* and *outcome-grounded*. Phase-gate readiness requires all criteria for that phase to be Met.

### 3.1 Per-IDENT principle

| ID | Criterion | Test |
|---|---|---|
| **IDENT-1** | Companion responses contain shared-memory references | ≥1 reference per 5 turns, validated by `recallSharedMemory` tool invocation log; voice audit on 50 sample turns shows first-person plural in ≥80% |
| **IDENT-2** | No outward-acting tool exists in registry | Static check of `_shared/tools/registry.ts`: zero tools with side effects outside `auth.uid()` scope; no email/calendar/HTTP-write capability |
| **IDENT-3** | Minimum 3 contextual pushes/day delivered | `HeartbeatScheduler` cron logs show ≥3 deliveries on every active day; 0 days with <2 deliveries over 30 days |
| **IDENT-4** | Form-driven inputs are not the default | `QuickInputSheet` voice/photo/AI-proactive paths used in ≥70% of weekly user logs; raw form fields <20% |
| **IDENT-5** | PERMA dimensions actively populated | After 60 days, every PERMA dimension has ≥5 entries; morning briefing references non-body life context at least 2×/week |
| **IDENT-6** | Decision-layer hierarchy respected | L1 decisions auto-applied (no user-tap); L2 decisions surfaced as "approve/adjust" cards; L3 decisions trigger reflective conversation prompts |

### 3.2 Per-Phase deliverables

Phase-level success criteria live in their phase plans (`_bmad-output/plans/<date>-mezo-phase-N.md`) and phase epics (`_bmad-output/epics/phase-N-epics.md`); Architecture §8 summarizes per-screen UX.

**v2.1 re-scope principle (2026-05-23).** Phases are being re-derived from the `frontend_design/` prototype's feature grouping (cascade bd `mezo-g7i`; final numbering settled by `bmad-create-epics-and-stories`). Two rules govern the re-scope:

- **AI/tool-transparency is a cross-cutting primitive, not a Phase-4 silo.** The prototype weaves tool-chips, provenance, confidence and companion narrative into every screen. The realignment therefore separates *form* from *source*: the transparency **surface** (the `ProvenanceEnvelope` data shape, `ToolChipRow`, confidence/provenance badges, and an honest "evidence-not-yet-available" state) ships from the phase where its host screen first appears, with stub/placeholder provenance; the **live AI pipeline** (Gemini + pgvector + LangGraph 4-layer memory) remains Phase 4+. No fabricated values are ever shown — an unknown confidence renders as a null/"learning" state, never a hardcoded number (IDENT-1, IDENT-4).
- **Provenance is one model, not per-feature.** Volume-recompute provenance (FR-2.2.12-14), meal-score provenance (FR-2.3.13) and briefing/chat tool-chips (FR-1.1.7) share a single `ProvenanceEnvelope` shape. The Architecture re-run owns the concrete design; the PRD only requires that the model be unified.

### 3.3 Quality gates across phases

| Gate | Criterion |
|---|---|
| Hallucination grounding | `EvidenceCheck` middleware rejects any response that references a non-data-grounded event. Audit on 100 sample responses shows 0 hallucinated references. |
| Never-ask-twice | `redundancyCheck` middleware prevents repeat questions on `KnowledgeFact.non_volatile=true` records. Test: ask Daniel his goal once, verify no goal-question for next 30 days. |
| Specificity-first | `numericGroundingCheck` rejects hardcoded numeric advice. Audit: 50 sample responses, zero numeric values not traceable to user data. |
| Prediction validation | All `Prediction` entities have post-hoc `PredictionOutcome` records. 60-day rolling success rate ≥60% per category. |
| Plan validation | All `Plan` entities have `expectedOutcome` and post-hoc `PlanOutcome` records. Weekly debrief explicitly compares expected vs. realized. |
| Multi-horizon context | Every chat response loads ≥7 days past + ≥7 days planned future context. Validated via `MultiHorizonLoader` log. |

### 3.4 Beta launch success criteria (Phase 8)

- Daniel uses Mezo as his primary tracker for ≥30 consecutive days without falling back to another app
- Knowledge Graph contains ≥150 user-confirmed `KnowledgeFact` records
- ≥10 distinct `Pattern` records confirmed and promoted to L4
- ≥5 successful `Prediction` validations on PRs and recovery
- ≥1 `IdentityGoal` mirror moment that the user describes as meaningful
- Zero `IDENT-2` violations across the dataset

---

## 4. Product Scope

### 4.1 In scope

**Data domains (51 entities total — see [Architecture §3](../architecture/mezo-architecture.md#3-data-model--51-entities)):**

- Training: mesocycles, workout sessions, exercise sets, RIR/RPE, plus new `NiggleEntry`, `WarmupBlock`, `MobilityBlock`, `ROMTestEntry`, `JumpCount` (cross-sport), `SportTransferRule`
- Nutrition: foods, meals, meal items, recipes, plus new `HydrationEntry`, `ElectrolyteEntry`, `Experiment` (N=1 dietary trials)
- Supplements + medications: with timing, kinetics, Retatrutide-phase context
- Sleep + weight + biometrics: with derived trends and variance
- Check-ins: 4×/day energy, stress, mental clarity, well-being + voice free-notes
- AI memory: embeddings, `Pattern`, `KnowledgeFact`, `LearnedFact` (candidate state), `CausalChain`
- Companion: `Prediction`, `Plan`, `Recommendation`, `CoachMemoirEntry`, `IdentityGoal`, `PERMAGoal`
- Life context (IDENT-5): `PersonEntry`, `FreeNoteEntry`, `Event`, `EventDebrief`, `ContextEpoch`, `EnvironmentSnapshot`, `FinancialContext`, `PsychInsight`

**Companion behaviors:**

- Dynamic morning briefing (narrative, multi-horizon, life-context-aware)
- 24 active Coach tools (18 read + 4 compute + 4 write)
- Iterative pattern detection (propose → critique → revise → user-confirm → promote)
- Causal chain detection (multi-step cause-effect inference)
- Behavior-change recognition and celebration
- Performance + outcome prediction with validation
- Weekly memoir + anniversary moments
- AnchorMode for crisis windows
- Pre-event preparation (pitch, interview, social events)
- Identity-anchor mirroring (rare, drama-aware)
- N=1 self-experiment framework (goal-aligned)

**Visualization + game mechanics:**

- Interactive Knowledge Graph (force-directed, live-growing mindmap)
- Memoir card archive
- Streaks, mesocycle map (MEV → MAV → MRV → deload), PR archive
- Identity-level achievements (non-XP)
- ProgressMomentum dashboard (multi-timescale)
- Retatrutide-phase gradient bar (context layer)
- Companion's transparent self-improvement display ("what Mezo learned about you this week")

**Privacy + safety:**

- Row-level RLS on every Postgres table
- 5+ year memory retention with `temporalRetrieval`
- GDPR data export
- Internal-sphere-only enforcement (IDENT-2)

#### 4.1.1 Prototype-driven additions (v2.1, 2026-05-23)

Adopting `frontend_design/` as the hard design contract surfaces capabilities and data the v2.0 scope did not name. Added in scope:

**New entities** (names are non-normative anchors — Architecture owns final modeling / normalization / RLS and may refactor): `SportSession` (volleyball/cardio session log: RPE, shoulder-strain, sets, duration, notes), `SupplementStashItem` (supplement/medication inventory: stock, brand, form, protocol, low-stock), `WeightGoal` (body-composition goal — additive to, **not** a replacement for, the PERMA `PERMAGoal`/`IdentityGoal` whole-life scope of IDENT-5), `GymSchedule` (recurring weekly training-time template), plus micronutrient tracking surfaced as a first-class weekly view.

**New / expanded features**: Mesocycle AI-planner (companion proposes a full mesocycle the user tweaks before activation), volume provenance + recompute + user-override, Sport screen (week / log / cross-load), Fuel "Terv" daily timeline (meal + supplement timing protocol), Fuel "Stash" inventory, per-meal optimality score with tap-through breakdown, pervasive tool-transparency surface, pre-workout micro-challenges.

**PERMA note (IDENT-5).** The prototype does not yet render a PERMAGoal UI (it shows only a body-composition goal). This is treated as prototype incompleteness, **not** a scope cut: `PERMAGoal` and the PERMA whole-life scope are retained (FR-3.1.2), with UI design deferred to Phase 5.

### 4.2 Out of scope (Phase 1-7)

- Apple Health integration (opt-out; may return Phase 7+ via Capacitor)
- Garmin / Whoop / Oura passive integration (Phase 8+)
- CGM (continuous glucose) integration (Phase 8+)
- Multi-tenant SaaS billing (Phase 8)
- Public catalog / social features (never; against IDENT-2 spirit)
- External coach / clinician collaboration UI (never; against IDENT-2)
- Family / partner shared views (Phase 8+, selective slices only, user-controlled)

### 4.3 Explicit non-goals

- *Maximizing engagement.* Presence is the metric (IDENT-3).
- *Gamifying behavior for its own sake.* Game mechanics serve identity, not dopamine loops (IDENT-1).
- *Generic AI chat.* Every response is grounded; no philosophical small-talk mode.
- *Replacing medical care.* The companion is explicitly not a doctor (prompt-level guardrails on Retatrutide and clinical topics).
- *Acting in the outside world.* IDENT-2 is absolute.
- *Prototype-authoring tooling in the product.* The `frontend_design/` Tweaks / Tweaks-panel (EDITMODE harness, `briefingVariants`, `applyPalette`) are design-time tooling, never a shipped product surface.

---

### 4.4 Prototype as design contract + boundary

The `frontend_design/` prototype is the **canonical visual + interaction contract** (layout, spacing, token values, notched-corner geometry, motion timing, state transitions, the tool-transparency surface). On any visual conflict it overrides the older `design-system.html` and the story-spec (CLAUDE.md §5 tiebreaker, updated 2026-05-23).

It is **not** a contract on implementation. Patterns present in the prototype that must NOT be carried into production code:

- `dangerouslySetInnerHTML` for markdown → `react-markdown` + `rehype-sanitize` (OWASP A03; the §1 security rule overrides the visual contract)
- hand-rolled SVG force-simulation → the planned viz library (D3 / react-force-graph, Architecture §4)
- `window.*` globals + inline `MezoData` mock → TanStack Query / React state + schema-driven providers (tech stack)

**Completeness axis = prototype-as-FLOOR.** Where the Architecture specifies *more* than the prototype, the richer depth is retained (e.g. `PRCelebrationOverlay`, AnchorMode-D, Two-Doors briefing, CausalChain visualization). FLOOR has a **ceiling rule**: arch-extra survives only when (a) it is *additive* depth AND (b) the prototype provides a mount-point for it; where the prototype makes an explicit positive UX claim (e.g. tool-chips visible by default), the Architecture may refine but not revoke it.

### 4.5 Entity reconciliation gate

Before the re-scoped epics are generated, every Architecture entity is reconciled against the prototype in a table: *in prototype? · gets an FR? · deferred (which phase + bd dep)? · dropped (Daniel sign-off)*. Rationale: prototype **presence** is evidence; prototype **absence is a question, not a verdict** — no entity may fall silently into "no FR" (mirror of the `mezo-8g1` "built-but-not-mounted" lesson).

---

## 5. User Journeys

These are the high-level user journeys. Detailed UX/UI architecture per screen is in [Architecture §8](../architecture/mezo-architecture.md#8-ux-architecture-per-screen).

### 5.1 Morning briefing journey (daily, all phases)

```
User opens app  →  Morning briefing card (narrative, multi-horizon)
                  → Today's planned workouts referenced
                  → Last 7 days trend referenced
                  → Specific micro-focus for today (2-3 actionable items)
                  → Retatrutide-phase context applied
                  → 1-tap quick check-in (energy / clarity)
```

**Success indicator:** User does not need to open any other screen to know what matters today.

### 5.2 Workout journey (Phase 2+)

```
Start workout  →  Active exercise card (target reps × RIR, last week ref)
              →  Niggle-aware adjustments surfaced before first set
              →  Live PR toast on set complete
              →  Feedback modal (RP-style soreness/pump/joint pain)
              →  Post-workout: prediction outcome logged (was the PR target met?)
              →  Companion celebrates (IDENT-1, brainstorm #34)
              →  Pre-next-workout window calculated for fueling
```

### 5.3 Logging journey (cross-cutting, IDENT-4)

```
User input intent  →  QuickInputSheet opens
                  →  AI detects modality:
                     - Voice (5-30s clip) → entities extracted
                     - Photo → meal/product recognition
                     - Number tap → micro-numeric (weight, supplements)
                     - Choice chips → predefined responses
                     - Free text → fallback only
                  →  Entities normalized + stored
                  →  Confirmation: "Got it" (single chip, no form)
```

**Success indicator:** Median input takes ≤10 seconds.

### 5.4 Pattern + Knowledge journey (Phase 5+)

```
Sunday 21:00  →  generateAiHypotheses StateGraph runs:
              propose → critique → revise → persist
              →  Pattern Inbox populated with new hypotheses

Monday morning  →  User opens Insights tab
                →  Pattern card shows mechanism + critique micro-bars
                →  User confirms / monitors / rejects
                →  Confirmed pattern promoted to KnowledgeFact (L4)
                →  Future chat turns include this fact in system prompt
                →  Companion publicly acknowledges: "I learned this about you"
                   (LearnedFact transparency, brainstorm #48)
```

### 5.5 Crisis journey (AnchorMode, Phase 5+)

```
Detection trigger  →  3+ days of poor sleep + low mood + skipped logs + late meals
                  →  AnchorMode activated automatically
                  →  Companion tone shifts to supportive (not performance)
                  →  Weekly plan paused
                  →  Three minimum-viable rituals surfaced (water, one protein meal, 10-min walk)
                  →  Daily check-in: "How are you today, 1-10?"
                  →  Exit when: 3 consecutive days above threshold
                  →  Re-entry: gradual, companion-paced (IDENT-6, decision-layer L1)
```

### 5.6 Pre-event journey (Phase 5+)

```
Calendar event detected ("Banco Santander pitch, Thursday 10:00")
or Daniel manually creates Event entity
              →  3-day preparation protocol applied:
                 - T-2 day: moderated training volume, sleep priority
                 - T-1 day: carb-loading, low effort, zero alcohol
                 - T-day morning: single espresso, slow breakfast, mental-prep audio (optional)
                 - T-day evening: debrief — what helped, what didn't
              →  EventDebrief entity captured for future similar events
```

### 5.7 Identity-anchor journey (Phase 4+, rare)

```
Behavior drift detected  →  3+ days of misaligned behavior + a meaningful decision pending
                       →  Companion invokes mirrorIdentity tool
                       →  Recalls user's most resonant IdentityGoal verbatim
                       →  Asks (never moralizing): "Is this the Daniel who carries the version
                          you described to me three months ago?"
                       →  User reflects; companion does not pressure.
                       →  Used very sparingly (max 1×/month, only when warranted)
```

### 5.8 Weekly memoir journey (Phase 4+)

```
Sunday 19:00  →  weeklyMemoir Edge Function runs
              →  Aggregates the week's entities + PatternHits + KnowledgeFact updates
              →  Generates 1-paragraph narrative from the companion's perspective
              →  Includes: shared memory, specific events, micro-celebrations, gentle observations
              →  CoachMemoirEntry persisted
              →  User opens Insights tab → Memoir reading area
              →  Optional reactions: like / love / save / dismiss
              →  Anniversary moments (monthly/annual) generated via separate function
```

### 5.9 Mesocycle planning journey (Phase 2+)

User opens Train → Mesocycles → "new" → companion proposes a full mesocycle (goal → length + phase-curve → split + days → AI program review) → user tweaks exercises/volume → activates. Niggle-aware substitutions and sport-cross load are applied during generation.

### 5.10 Sport logging journey (Phase 2+)

After a volleyball/cardio session the user logs RPE, shoulder-strain, sets and duration (voice or sheet); the session feeds cross-load reasoning (`SportTransferRule`) that adjusts next-day gym volume, fuel and recovery targets.

### 5.11 Fuel timeline journey (Phase 3+)

The day's eating + supplement protocol is presented as a single timeline (wake → meals → pre/post-workout → sport → evening) with kinetic-window, caffeine-cutoff and kitchen-close context; "now" is highlighted and each slot carries a companion note.

### 5.12 Pre-workout opportunity journey (Phase 2+)

Before a workout the companion may surface optional micro-challenges (skip = no penalty, niggle-aware, companion-voiced); accepting one frames a shared goal for the session and is recognized afterward via shared-memory reference.

---

## 6. Functional Requirements

Functional requirements are organized by tier (matching brainstorm prioritization) and by deliverable phase.

### 6.1 Tier 1 — Must-have for the companion vision

#### FR-1.1 Memory & continuity foundations

| ID | Requirement | Source | Phase |
|---|---|---|---|
| FR-1.1.1 | Continuity gate: every chat response includes ≥1 explicit context reference | Brainstorm #57, IDENT-1 | 4 |
| FR-1.1.2 | Never-ask-twice memory: non-volatile facts are not re-elicited from user | Brainstorm #73 | 4 |
| FR-1.1.3 | Bidirectional multi-horizon context loading (past 7d + planned future 7d) | Brainstorm #74 | 4 |
| FR-1.1.4 | 5-year memory continuity (long-range recall, soft retention commitment) | Brainstorm #61 | 4-5 |
| FR-1.1.5 | Transparent self-improvement: user sees what the AI is learning | Brainstorm #48 | 4 |
| FR-1.1.6 | Interactive Knowledge Graph visualization (live, growing mindmap) | Brainstorm #78 | 4-5 |

#### FR-1.2 Companion voice + identity

| ID | Requirement | Source | Phase |
|---|---|---|---|
| FR-1.2.1 | Iconic push notification voice (performance-framed, time-windowed, goal-anchored) | Brainstorm #36 | 4 |
| FR-1.2.2 | Specificity-first anti-generic rule (every advice grounded in user data) | Brainstorm #37 | 4 |
| FR-1.2.3 | No hardcoded numbers (`numericGroundingCheck` middleware) | Brainstorm #58 | 4 |
| FR-1.2.4 | Hallucination-grounded event referencing (`EvidenceCheck` middleware) | Brainstorm #72 | 4 |

#### FR-1.3 Proactivity architecture

| ID | Requirement | Source | Phase |
|---|---|---|---|
| FR-1.3.1 | Proactivity SLA: ≥3 contextual pushes/day + weekly memoir + anniversaries | Brainstorm #76 | 4 |
| FR-1.3.2 | HeartbeatScheduler: minimum 2 messages/day, even without data triggers | Brainstorm #43, IDENT-3 | 4 |
| FR-1.3.3 | OpportunityScanner: 4×/day looking-ahead 6-24h for proactive tips | Brainstorm #45 | 4 |
| FR-1.3.4 | Dynamic morning briefing (1-paragraph narrative synthesis) | Brainstorm #32 | 4 |

#### FR-1.4 Causal intelligence

| ID | Requirement | Source | Phase |
|---|---|---|---|
| FR-1.4.1 | Causal chain detection (multi-step cause-effect inference, `CausalChain` entity) | Brainstorm #33 | 5 |
| FR-1.4.2 | Behavior change recognition + celebration | Brainstorm #34 | 5 |
| FR-1.4.3 | Performance prediction + outcome validation | Brainstorm #35, #59 | 5 |
| FR-1.4.4 | Plan validation loop (expected vs realized outcome per weekly plan) | Brainstorm #60 | 5 |

#### FR-1.5 Logging friction reduction

| ID | Requirement | Source | Phase |
|---|---|---|---|
| FR-1.5.1 | QuickInputSheet — unified multimodal input component | Brainstorm #41, IDENT-4 | 2-3 |
| FR-1.5.2 | Voice-first free logging with `PersonEntry` extraction | Brainstorm #65 | 5 |

#### FR-1.6 Decision-layer hierarchy (IDENT-6)

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-1.6.1 | L1 — Companion-autonomous decisions: micro-choices (push timing, breakfast suggestion, supplement timing) auto-applied without user tap | At least 1 L1 decision/day auto-applied, logged in `Recommendation` with `decision_layer='L1'`; 0 user-taps required for L1 class | 4 |
| FR-1.6.2 | L2 — Companion proposes, user approves: weekly training plans, pattern confirmations, goal adjustments — surfaced as approve/adjust cards | 100% of L2 decisions surfaced via dedicated UI card with explicit ✓/✗ affordance; 0 L2 silently applied | 4-5 |
| FR-1.6.3 | L3 — User decides, companion asks: long-term vision, identity-level changes, feature opt-in/opt-out — companion never decides | 0 L3 decisions auto-applied; all L3 entry-points user-initiated; reflective prompt structure validated by sample audit | 4-5 |

### 6.2 Tier 2 — Strong-fit (per-persona expertise)

#### FR-2.1 Medical (doctor-perspective)

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-2.1.1 | Sleep-first triage — sleep quality is the upstream input weighting all other morning metrics | When prior-night sleep <7h, morning briefing flags it as primary risk factor BEFORE weight/calorie/recovery; verified by 30-day briefing audit | 4 |
| FR-2.1.2 | Calorie-timing window vs sleep — last-meal-to-sleep delta tracked as a derived metric | `meal_to_sleep_minutes` computed per night; weekly correlation with sleep quality surfaced; 100% of nights with prior-day Meal entries have this metric | 4-5 |
| FR-2.1.3 | Previous-day muscle-group load carryover — cumulative load across gym + sport + cardio | `MuscleLoadCarryover` score computed daily per muscle group; when above threshold, next-day workout suggestion adjusted; 30-day audit confirms ≥80% adjustment-vs-expected rate | 4-5 |
| FR-2.1.4 | Weight trend + variance (not raw weight) — 7-day + 14-day moving average + variance displayed | Weight displays show MA + variance, never single-day raw without trend context; 0 single-raw-weight-only displays in UI audit | 2-3 |
| FR-2.1.5 | Retatrutide-phase context layer — 7-day kinetic cycle modifies metric interpretation | All daily metric cards show inline phase indicator (D1-D7); kinetic context tooltip available; phase-modified suggestions surfaced on appetite-impact days | 4-5 |
| FR-2.1.6 | Daily calorie pacing alert — time-of-day-aware target tracking | By 15:00 local, pacing % vs daily target computed; if outside ±20% band, contextual push delivered | 4 |
| FR-2.1.7 | Pre-workout fueling window — prospective timing based on scheduled workouts | Push delivered 2-3h before scheduled workout if protein/carb intake-vs-target deficit detected; >95% delivery rate on workout days | 4 |
| FR-2.1.8 | Stimulant stacking risk — caffeine dose × half-life × workout & sleep timing | Caffeine entries past 14:00 trigger sleep-impact evaluation; alert if predicted sleep onset delayed >30 min | 4 |
| FR-2.1.9 | Hydration-salt imbalance flag (via `HydrationEntry`) — daily target with sport-day adjustments | Daily hydration target computed (35 ml/kg + 500-1000 ml on training days); if <60% by 15:00 on training day, push reminder | 3 |
| FR-2.1.10 | Cumulative stress-load index — HRV-free proxy combining sleep + training + check-in scores | Composite stress score 0-100 computed daily; 3-day MA above threshold triggers deload suggestion | 5 |
| FR-2.1.11 | Injection-workout conflict awareness — Medication × Workout cross-entity reasoning | When weekly Retatrutide day overlaps with high-volume workout, pre-workout fueling push triggered with appetite-elevation context; auditable from `Medication` + `Workout` join | 4-5 |

#### FR-2.2 Physiotherapy (movement-perspective)

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-2.2.1 | Overuse pattern detector — sport-agnostic muscle-load aggregator (gym + volleyball + cardio) | Muscle-group exposure aggregated across all entity sources; if same group exposed 4+ consecutive days, red flag surfaced | 4-5 |
| FR-2.2.2 | Warmup adequacy score (`WarmupBlock`) — warmup time/type evaluated against workout type | Warmup-adequacy ratio (logged vs recommended) computed per session; trend surfaced; below-target weeks flagged | 3 |
| FR-2.2.3 | Mobility deficit detection (`MobilityBlock`) — weekly mobility-minutes target | Weekly mobility minutes computed; if 0 minutes 3+ consecutive days + niggle present, push triggered | 3 |
| FR-2.2.4 | Cross-sport antagonism / synergy detection (`SportTransferRule`) — gym exercise effects on sport performance | When gym session interferes with next-day sport schedule per transfer matrix, pre-emptive scheduling suggestion surfaced | 5 |
| FR-2.2.5 | Recovery signal composite — derived daily scalar from sleep × stress × prior-day load | Composite recovery score 0-100 computed daily; below threshold reduces next-workout volume recommendation by ≥1 RIR or 1 set | 4-5 |
| FR-2.2.6 | Jump volume cap (`JumpCount`) — weekly impact-volume limit | Weekly jump count tracked (volleyball + plyometric + incline walks); when within 80% of cap, warning push delivered | 3 |
| FR-2.2.7 | ROM decline tracker (`ROMTestEntry`) — monthly home tests, trended | Monthly reminder delivered; 3 consecutive declining ROM scores in same region flagged for professional consultation | 3-4 |
| FR-2.2.8 | Bilateral asymmetry detection (`WorkoutSet.side` field) — unilateral exercise tracking | Bilateral diff >10% on 3+ workouts in same exercise flagged in UI | 2-3 |
| FR-2.2.9 | Pain / niggle diary (`NiggleEntry`) — body-region coordinates + active-until | Workout completion offers optional 5-second body-tap; data captured to `NiggleEntry`; heatmap viewable in Me tab | 2-3 |
| FR-2.2.10 | Active-niggle aware adaptive planning — niggle-state-driven training adjustments | When `NiggleEntry.active=true` for muscle group in next planned workout, exercise selection auto-adjusts; 100% of planned workouts query active niggles before generation | 4-5 |

#### FR-2.3 Nutrition (dietitian-perspective)

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-2.3.1 | Micronutrient gap detector — RDA tracking for Mg, Zn, B-complex, D, omega-3 | Weekly per-micronutrient % RDA computed; <60% for 5+ days triggers context-specific suggestion | 4 |
| FR-2.3.2 | Meal timing vs sport window — prospective meal-plan generator | Morning briefing presents the day's 4-5 ideal meal-windows (pre-workout, post-workout, last-meal-to-sleep) | 4-5 |
| FR-2.3.3 | Retatrutide-driven underfueling risk — medication-aware calorie floor | Daily kcal floor = max(1.4 × BMR, weight × 28); breach on 2+ consecutive days triggers strong-push | 4-5 |
| FR-2.3.4 | Protein distribution across meals — per-meal MPS target (0.4 g/kg × meal) | Per-meal protein flagged if < target post-meal; corrective suggestion offered | 3-4 |
| FR-2.3.5 | Last-meal-to-sleep window — proactive kitchen-close alarm | At T-2h before scheduled sleep, "kitchen close" push if last meal would breach 2h window | 4 |
| FR-2.3.6 | Sleep-quality ↔ carb-timing pattern detection | When pattern (late carbs ↔ poor sleep) is detected by the L2 engine and confirmed by user, it becomes a `KnowledgeFact` and is proactively cited in evening kitchen-close push | 5 |
| FR-2.3.7 | Hydration floor + electrolyte stack | Daily Na/K/Mg estimated from `MealItem.electrolytes` + `ElectrolyteEntry`; alert if below threshold | 3 |
| FR-2.3.8 | Fiber stability — variance as a metric | Weekly fiber variance computed; high-variance week triggers stabilization suggestion | 5 |
| FR-2.3.9 | Caffeine-adenosine cycle — proactive coffee schedule | Morning briefing presents the day's coffee schedule based on planned workout + 14:00 cutoff + sleep target | 4 |
| FR-2.3.10 | Creatine saturation tracker — saturation-decay model | Multi-day skip reduces saturation estimate; if 2+ skip days, restock suggestion with 7-day catch-up calculation | 3-4 |
| FR-2.3.11 | Supplement-food interaction alerts | When supplement timing collides with food category that blocks absorption (e.g., iron + coffee), pre-emptive timing-adjustment push | 4 |

#### FR-2.4 Companion relationship

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-2.4.1 | Companion vulnerability state — after 3+ ignored suggestions or worsening metrics | Internal coach state `coachUncertainty=true` triggered; explicit "I might be missing something — talk to me" message generated within 24h | 4-5 |
| FR-2.4.2 | Weekly memoir — Sunday 19:00 narrative `CoachMemoirEntry` | `CoachMemoirEntry` created every Sunday; user can react like/love/save/dismiss; >95% delivery reliability | 4-5 |
| FR-2.4.3 | Challenge with user-sovereignty — disagree, defer, replan with cost transparency | When user overrides a companion suggestion, companion auto-replans without re-challenge; explicit cost-explanation generated | 4-5 |
| FR-2.4.4 | Identity-anchor mirror — rare, dramatic, decision-pending only | `mirrorIdentity` tool invoked ≤1×/month; only when behavior drift + meaningful decision are both detected; tool log audited | 4-5 |
| FR-2.4.5 | Daniel-companion trust score — mutual metric | Mutual trust score (compliance% × prediction-accuracy%) computed weekly; <60% triggers companion vulnerability state | 5 |

### 6.3 Tier 3 — Phase 2-3 expansions

#### FR-3.1 PERMA / goals

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-3.1.1 | Mood as output, not just input — companion has an outcome goal: improve mood | Weekly target "≥3 days with evening mental_clarity ≥8" set; weekly retro evaluates target hit-rate | 5 |
| FR-3.1.2 | PERMA-based holistic goal framework — 5 dimensions populated | After 60 days, every PERMA dimension has ≥5 active `PERMAGoal` entries; morning briefing references at least 1 non-body dimension/week | 5 |
| FR-3.1.3 | Goal-behavior drift detection — weekly coherence check | `goalCoherenceCheck` runs Sundays; drift triggers a companion-initiated alignment prompt | 5 |

#### FR-3.2 Edge states

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-3.2.1 | Injury prevention as headline KPI (`InjuryDelta`) — surfaced at app-top | Top-of-dashboard widget shows 30-day rolling injury delta; PRD §3.4 beta-launch criteria reference this metric | 5 |
| FR-3.2.2 | Travel/context-switch flag (`ContextEpoch`) — auto-detect + manual flag | GPS or calendar event triggers auto-detect; manual flag available via QuickInputSheet; context-mode changes companion priorities | 5 |
| FR-3.2.3 | AnchorMode — crisis minimum-viable routine | Trigger conditions detect crisis; companion shifts to supportive tone; minimum 3 daily rituals surfaced; weekly plan suspended | 5 |
| FR-3.2.4 | Pre-event performance prep — `Event` entity + 3-day prep protocol | When calendar/manual `Event` created, T-2/T-1/T-day protocols auto-scheduled; post-event `EventDebrief` capture triggered | 5 |
| FR-3.2.5 | Psych-study-grounded behavioral insights (`PsychInsight`) — peer-reviewed citations | Every behavioral observation by companion paired with `PsychInsight` reference; 0 unsourced behavioral claims in audit | 5 |

#### FR-3.3 Contextual layers

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-3.3.1 | Age as persistent modifier — `User.birthDate` shapes defaults | Recovery, plateau, hormonal context auto-adjusted; sample audit shows age-aware defaults active on 100% of relevant suggestions | 4-5 |
| FR-3.3.2 | Circadian + environmental context — daily environment snapshot | `EnvironmentSnapshot` populated daily; companion adjustments (winter D-vit push, hot-day hydration boost) verifiable | 5 |
| FR-3.3.3 | Money as whole-life context (`FinancialContext`) — frictionless capture | Recurring costs set once; daily voice-quick capture path; financial stress detector runs weekly | 6+ |

#### FR-3.4 Identity reflection

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-3.4.1 | Identity pattern reflections (`PsychInsight`-grounded) — observations of repeated behavior patterns | Monthly reflection card surfaced based on `PsychInsight` library; user can confirm/dismiss; confirmed reflections feed `KnowledgeFact` | 5 |
| FR-3.4.2 | Anniversary moments — monthly + annual milestones | `anniversaryReflection` runs monthly; meaningful date-anchored cards delivered (1-year-since-X, 3-months-of-X) | 5 |

### 6.4 Tier 4 — Pirate / future

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-4.1 | Goal-aligned N=1 self-experiments (`Experiment` + `ExperimentReport`) — companion enforces goal-alignment | Experiment setup blocks intervention contradicting active goals; baseline + outcome captured; statistical N=1 report generated | 6+ |
| FR-4.2 | Feedback-closed recommendation loop — per-user effectiveness weighting | Each `Recommendation` tracked through `state ∈ {sent, acted, skipped}` and outcome; same suggestion not repeated after 3 ineffective rounds | 5+ |
| FR-4.3 | Continuous visual progress — multi-timescale dashboard widget | Daily/weekly/monthly/quarterly/annual progress visible at any time; each timescale has ≥1 element updated within that period | 7+ |
| FR-4.4 | Game mechanics + visual engagement (non-XP) — streaks, mesocycle map, PR archive, identity-levels | Streaks visible; mesocycle visual map MEV→MAV→MRV→deload rendered; PR archive permanent + filterable; identity-level momentums (non-XP) defined and surfaced | 6+ |

### 6.5 Prototype realignment additions (v2.1, 2026-05-23)

New FRs from the prototype-as-contract adoption. Final tier-placement / renumbering is settled by `bmad-create-epics-and-stories`; entity names are non-normative anchors (Architecture owns modeling).

#### Memory & transparency

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-1.1.7 | Tool-transparency surface — AI-derived values expose their tool-calls / references / confidence via a shared `ProvenanceEnvelope`, behind a schema-driven provider (stub in early phases, live AI Phase 4+); tool-chips visible by default | Every screen rendering an AI-derived value carries a provenance affordance; confidence renders as null/"learning" when unknown, never a hardcoded number; 0 fabricated values in audit | 2-4 |
| FR-1.3.5 | Graceful AI-degraded / offline state — when the AI layer is unavailable or still learning, the companion shows an honest "evidence-not-yet-available" state and never goes silent (IDENT-3) | On simulated AI timeout / quota-exhaustion no screen shows a broken or empty AI element; a companion-voiced fallback is present; integration test on synthetic outage | 4 |

#### Training

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-2.2.11 | Mesocycle AI-planner — companion proposes a complete mesocycle the user can tweak before activation (goal, length, phase-curve, split, day program) | A mesocycle can be created end-to-end from a companion proposal; every generated plan queries active niggles + sport schedule before output (L2 decision per FR-1.6.2) | 2-4 |
| FR-2.2.12 | Volume provenance — per-muscle MEV/MAV/MRV shows its derivation (baseline + typed adjustments: niggle / pattern / recovery / sport-cross) with a confidence indicator | Each volume target is traceable to a baseline + an itemized, typed adjustment list; provenance uses the shared `ProvenanceEnvelope` | 2-4 |
| FR-2.2.13 | Volume recompute — volume targets recompute on relevant triggers, with an append-only audit of what changed and why | Each recompute writes an immutable audit record (trigger, input snapshot, per-muscle delta + reason); history is viewable | 4 |
| FR-2.2.14 | Volume user-override — the user can override a computed volume target; overrides are append-only and never silently discarded by a later recompute | A conflict-resolution matrix (computed × recomputed × override → winner + companion message) is defined and tested; a recompute never overwrites a user override without an explicit, logged decision (IDENT-6) | 4 |
| FR-2.2.15 | Sport-session logging (`SportSession`) — RPE, shoulder-strain, sets-played, duration, notes per volleyball/cardio session; recurring sport schedule maintained | A sport session is loggable in ≤3 taps or by voice; sessions feed `SportTransferRule` cross-load; weekly sport load surfaced | 2-3 |

#### Medical / nutrition

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-2.1.12 | Weekly gym-schedule template (`GymSchedule`) — recurring training times set once, used as input to pre/post-workout meal + supplement timing | Schedule editable per day; pre/post-workout fueling + supplement-timing computations read from it; distinct from the mesocycle plan | 3-4 |
| FR-2.3.12 | Supplement inventory (`SupplementStashItem`) — stock, brand, form, protocol per supplement/medication, with low-stock alerting | Stock decrements on logged intake; when stock < threshold a restock suggestion is surfaced (IDENT-6 offloading) | 3-4 |
| FR-2.3.13 | Per-meal optimality score (0-100) with tap-through breakdown — four weighted dimensions: macro/kcal fit (30%), micro-balance (25%), processing/NOVA (25%), timing & context (20%); breakdown shows per-dimension status, confidence, companion summary, and actionable "could-be-better" suggestions ranked by score-impact, with tool-transparency (`lookupNutrients`, `classifyNOVA`, `predictGlycemicCurve`) | Score reproducible from a deterministic core (macro + timing computed in code); NOVA + micro use cached per-`FoodItem` AI classification; the displayed score is fully decomposable in the breakdown; suggestions are actionable + companion-voiced (observation + suggestion, not a bare grade — IDENT-1) | 3-5 |

#### Goals / motivation

| ID | Requirement | Acceptance Criterion | Phase |
|---|---|---|---|
| FR-3.1.4 | Body-composition goal (`WeightGoal`) — long-term cut/bulk/maintenance target with rate, projected end-date and linked mesocycles; additive to, not a replacement for, PERMA goals (FR-3.1.2) | Weight goal tracks current vs target with a projected completion date; linked mesocycles visible; PERMA scope unaffected | 2-5 |
| FR-4.5 | Pre-workout micro-challenges — companion-proposed optional challenges (skip = no penalty, niggle-aware, companion-voiced); recognized afterward via shared-memory reference, not points/badges | Challenges skippable with zero penalty / streak mechanic; never proposed against an active recovery/niggle state; recognition references a shared past moment (IDENT-1 sense-of-being-seen). **Owner-approved IDENT-1 trade-off (2026-05-23): challenge framing retained at Daniel's explicit direction; the guardrails above are the mitigation.** | 2-7 |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| NFR | Requirement | Validation |
|---|---|---|
| NFR-P-1 | Median chat tool-call response <8s SSE-streamed | LangSmith trace timing |
| NFR-P-2 | Morning briefing generation <15s (cron 06:30) | Edge Function exec log |
| NFR-P-3 | Voice transcription latency <3s p95 for a 10-second clip | APM measurement on the transcription endpoint |
| NFR-P-4 | Knowledge Graph render <2s for 200 nodes | Client-side measurement |
| NFR-P-5 | Pattern detection weekly batch <5 min | Edge Function exec log |

### 7.2 Privacy + safety (IDENT-2-driven)

| NFR | Requirement | Validation |
|---|---|---|
| NFR-S-1 | Every Postgres table has row-level RLS with `created_by = auth.uid()` | Migration linter pre-commit |
| NFR-S-2 | No Coach tool has external write capability (no email, calendar, HTTP-out) | Static analysis of `_shared/tools/registry.ts` |
| NFR-S-3 | Embeddings table is RLS-scoped (no cross-user vector leakage) | RLS test suite |
| NFR-S-4 | GDPR data export covers all user-scoped entities | `exportUserData` Edge Function test |
| NFR-S-5 | Retatrutide / clinical topics: companion deflects to professional, never advises | System prompt hard rule + Sentry log |
| NFR-S-6 | No PII in LangSmith traces (user identifiers hashed) | Tracing wrapper test |

### 7.3 Continuity + reliability (IDENT-3-driven)

| NFR | Requirement | Validation |
|---|---|---|
| NFR-C-1 | 99.5%+ Edge Function uptime (Supabase SLA) | Supabase dashboard |
| NFR-C-2 | Push notification delivery success rate >95% | iOS push delivery log |
| NFR-C-3 | Daily heartbeat (≥2 pushes/day) success rate ≥98% | `HeartbeatScheduler` log |
| NFR-C-4 | Long-term memory retention: 5+ years rolling retention | Backup + retention policy doc |
| NFR-C-5 | Offline mutation queue persists ≥7 days unsynced data | TanStack Query persist test |

### 7.4 Scalability + multi-tenancy

| NFR | Requirement | Validation |
|---|---|---|
| NFR-X-1 | Schema supports ≥1000 concurrent users without re-architecture | Stress test Phase 8-1 |
| NFR-X-2 | Vector similarity search response <500ms p95 at 10k entries/user | Benchmark at Phase 4 end |
| NFR-X-3 | AI context-window utilization <50% on max conversation length | Token count audit |
| NFR-X-4 | Edge Function cold-start <2s | Cron schedule resilient to cold-start |

### 7.5 Cost

| NFR | Requirement | Validation |
|---|---|---|
| NFR-$-1 | AI cost single-user Phase 1-8 <$0.80/day | LangSmith + Gemini API cost report |
| NFR-$-2 | Supabase free tier sufficient through Phase 7 | Supabase usage dashboard |
| NFR-$-3 | Per-user AI cost target Phase 8+: <$0.40/day median | Multi-user cost model |

### 7.6 Maintainability

| NFR | Requirement | Validation |
|---|---|---|
| NFR-M-1 | Entity schemas have a single source of truth with no manual type duplication | Automated type generation from the canonical schema; CI fails if drift detected |
| NFR-M-2 | Companion tool registry: each tool ≤120 lines, single-purpose | Code review |
| NFR-M-3 | No untyped values in TypeScript code without an explicit justification comment | Static analysis: strict mode + linter |
| NFR-M-4 | Stateful AI workflow nodes are pure-compute or pure-LLM-call, never mixed in the same node | Architecture review of workflow graph |

### 7.7 Accessibility + UX

| NFR | Requirement | Validation |
|---|---|---|
| NFR-A-1 | WCAG 2.2 AA on text contrast | a11y pass Phase 7 |
| NFR-A-2 | All interactive elements ≥44×44 pt touch target | Design system enforcement |
| NFR-A-3 | Voice input fallback to text on every input field | Cross-modal testing |
| NFR-A-4 | Brand voice: Hungarian primary, IDENT-1 enforced in prompt template | Companion voice audit |
| NFR-A-5 | The `frontend_design/` prototype is the canonical visual + interaction contract; production screens match it (notched corners, token families, tool-transparency surface) | Per-screen prototype-parity audit |
| NFR-A-6 | FLOOR rule — Architecture depth beyond the prototype is retained only when additive AND mountable in the prototype; explicit prototype UX claims are refined, not revoked | Design review against §4.4 |
| NFR-A-7 | Every new FR carries an IDENT-1 tone check — "would a companion say/do this, or a coach?"; coach-framed surfaces are reworked to relational/companion voice before build | IDENT-1 tone audit in PR review |

**Tone gate (IDENT-1).** Scores, plans, wizards and challenges are companion-framed: observation + actionable suggestion, first-person plural, grounded in the user's data and shared history — never a bare grade or a points/badge loop. The Dark-Pattern Non-Goals catalog (§2.4.1) governs; deviations require Daniel sign-off (see FR-4.5).

### 7.8 Clinical & Regulatory considerations

Mezo tracks healthcare-adjacent data (prescription medication kinetics for Retatrutide / GLP-1 / GIP agonists, supplement dosing, biometric markers, mood + stress dimensions, gut health). The product is deliberately positioned **outside** medical-device regulation but applies medical-grade guardrails to all user-facing AI behavior. This subsection codifies those guardrails as testable NFRs.

| NFR | Requirement | Validation |
|---|---|---|
| NFR-CR-1 | Mezo is positioned as a **personal data companion**, not a medical device. No FDA/CE/EU MDR classification is claimed; product copy + onboarding + legal disclaimer explicitly state this | Marketing audit + onboarding script review + visible disclaimer on Me tab |
| NFR-CR-2 | Companion **never** offers clinical advice on prescription medications (Retatrutide, GLP-1, GIP, off-label use). All such content is auto-deflected to "consult your prescribing physician" | System prompt hard rule; output classifier flags clinical-advice content; Sentry log on violation |
| NFR-CR-3 | Companion **never** suggests dose changes for any prescription drug | Audit on 100 sample medication-related responses shows 0 dose-change suggestions |
| NFR-CR-4 | The N=1 self-experiment framework (`Experiment` entity) blocks experiments involving prescription-medication doses or non-OTC compounds at the entity layer | DB constraint test + UI validation test |
| NFR-CR-5 | Quarterly clinical-claim audit on a random sample of companion outputs (n=100) for unsafe medical claims | Audit log + remediation tracked in beads |
| NFR-CR-6 | GDPR Article 9 compliance: medication + biometric data classified as special-category personal data; encrypted at rest; explicit user consent on first capture | Consent-flow audit; encryption-at-rest verification |
| NFR-CR-7 | Long-term data retention (5+ years per IDENT-3) is paired with the user's GDPR right to erasure at any time, even for memory-anchored data | `exportUserData` + `deleteUserData` integration test |
| NFR-CR-8 | Crisis indicators (severe mood collapse + self-harm vocabulary in `FreeNoteEntry`) trigger AnchorMode + a one-time professional-help banner; companion never engages in generic chat in this state | AnchorMode + crisis-trigger integration test on synthetic input |

**Scope note**: This subsection codifies guardrails for a non-medical-device product. If Mezo's scope ever expands to actual clinical decision support, a full regulatory re-classification is required and this PRD will be re-issued.

---

## 8. Constraints & Open Questions

### 8.1 Architectural constraints

- **No self-hosted infrastructure.** Everything on Supabase managed (Edge Functions, Postgres, pgvector, Realtime).
- **No multi-cloud LLM.** Gemini 3.1 family only; LangGraph runs the multi-step workflows, vanilla SDK for atomic.
- **Frontend bundle <500KB initial.** PWA constraints, mobile-first.
- **iOS 16.4+ push notifications.** Pre-16.4 devices: in-app polling fallback.
- **No native app Phase 1-7.** PWA only. Capacitor wrapper deferred to Phase 8+.

### 8.2 Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Gemini latency (chat + tool calls 3-8 sec) | Medium | SSE streaming, tool transparency chips, Flash fallback |
| Coach infinite tool loop | Medium | LangGraph `recursionLimit: 10`, rate limit 50 calls/min/user |
| Pattern detection false positive | Medium | 4-factor critique scoring + verdict thresholds, user-validation gate |
| Pattern detection cost | Low | ~$0.17/week single user (3 Pro calls) — manageable |
| iOS PWA push limitations | Medium | Daniel on iOS 18+ → works; older devices: in-app fallback |
| Gemini context window | Low | L3 ~500 tokens, L1 top-10 ~5k, tool results ~10k → total ~50k, well within 1M |
| AI hallucination on clinical topics (Retatrutide) | High | System prompt hard rule, Sentry critical log, no medical-write tool |
| Privacy / GDPR | Medium | RLS on every table, `exportUserData` Phase 8 |
| Multi-user transition refactor | Low | RLS row-level from day 1, embeddings user-scoped |
| LangChain dependency churn | Low | LangGraph 1.x stable since mid-2025; small blast radius |
| pgvector dimension lock-in | Low | text-embedding-3 (768-dim); migration path defined if needed |
| **Long-term memory retention drift** (new) | Medium | After 5 years, the model of "Daniel" may no longer match present-day Daniel. Anchor: identity-change check every 6 months. |
| **PERMA implementation depth** (new) | Medium | PERMA framework risks becoming an over-instrumented self-help tool. Mitigation: start with M (Meaning, via `IdentityGoal`) only; expand other dimensions when validated. |
| **Voice STT provider** (new) | Low | Gemini-native multimodal preferred (Hungarian accuracy unknown). Whisper API fallback. Browser Web Speech API as last resort. Decide at Phase 4 end. |

### 8.3 Open questions (must resolve before Phase 4 start)

- Pgvector dimension confirmation: `text-embedding-3` is 768-dim — verify before Phase 4.
- LangSmith Cloud vs Helicone self-host for prod tracing — decide Phase 4-end.
- Coach tool batching: meta-tool `batch_read_user_data([...])` to reduce round-trips — validate need in Phase 4.
- LangGraph checkpointing for chat conversation resume across sessions — Postgres `PostgresSaver` — Phase 5-6.
- Multi-tenant cutoff: Stripe (Supabase connector) vs Lemonsqueezy — Phase 8.

### 8.4 Open questions (Phase 5+)

- **Long-term memory retention policy**: how do we present 5-year-old memories so they feel meaningful rather than uncanny? Edge case research needed Phase 5-end.
- **PERMA framework depth**: do we implement all 5 dimensions, or only Meaning + Accomplishment initially? Decide Phase 5-start.
- **Voice STT provider**: final choice between Gemini-native, Whisper API, Web Speech API — cost + latency + Hungarian quality trade-off. Decide Phase 4-end.

---

## 9. References

### 9.1 Internal artifacts

- [Architecture document](../architecture/mezo-architecture.md) — companion to this PRD
- [Brainstorm session, 2026-05-15](../../../_bmad-output/brainstorming/brainstorming-session-2026-05-15-1245.md) — 79 ideas, 6 IDENT principles, scope expansion
- [Archived hybrid spec v1.0](_archive/mezo-prd-v1-hybrid.md) — superseded by this PRD + Architecture
- [Phase 1 plan](../plans/mezo-phase-1-foundations.md) — current implementation plan
- [Design canonical reference](../../../design/README.md) — 7 HTML mockups

### 9.2 Beads issues

This PRD's content corresponds to:

- `mezo-eb8` (Spec v2 epic)
- `mezo-eb8.11` (Vision rewrite — closed by this PRD's §2)
- `mezo-eb8.12` (Entities expand — implemented in Architecture §3)
- `mezo-eb8.13` (Design + Pages — implemented in Architecture §7+§8)
- `mezo-eb8.14` (AI Pipeline extend — implemented in Architecture §4)
- `mezo-eb8.15` (Functions extend — implemented in Architecture §5)
- `mezo-eb8.16` (Roadmap rewrite — implemented in §7 below + Architecture roadmap)
- `mezo-eb8.17` (Open Qs update — implemented in §8 of this PRD)

### 9.3 External references

- [RP Hypertrophy App](https://rpstrength.com/pages/hypertrophy-app) — periodization philosophy
- [Hevy App](https://www.hevyapp.com/) — PR types, live notification UX reference
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)
- [WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [OpenFoodFacts API](https://world.openfoodfacts.org/data)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [pgvector](https://github.com/pgvector/pgvector)
- [LangGraph.js](https://langchain-ai.github.io/langgraphjs/)
- [Seligman PERMA model](https://www.authentichappiness.sas.upenn.edu/learn/wellbeing) — IDENT-5 foundation

---

## 10. Approval & Versioning

- v1.0 spec approved by Daniel: 2026-05-14 (now archived)
- v2.0 PRD + Architecture split: 2026-05-15, integrating 2026-05-15 brainstorm
- Next step (v2.1 realignment cascade, bd `mezo-g7i`): `bmad-validate-prd` → architecture re-run (`bmad-create-architecture`) → UX-spec amendment → `bmad-create-epics-and-stories` (phase re-scope) → bulk bd import
- Then: `superpowers:writing-plans` for Phase 4 + 5 implementation plans (replaces previous Phase 4 + 5 plan stubs)

**Versioning rule**: This document is appended-only between formal version bumps. Substantive changes get a version bump (v2.0 → v2.1) + dated changelog entry below.

### 10.1 Changelog

- **v2.0 · 2026-05-15** — Full split from hybrid v1.0 spec into PRD + Architecture. Integrated 2026-05-15 brainstorm (79 ideas, 6 IDENT principles, PERMA scope expansion). Renamed Phase 4 "Coach with tools" → "AI Memory + Companion Identity". Renamed Phase 5 "Iterative pattern engine" → "Pattern Engine + PERMA + Life Context". Added 25 entities, 12 Edge Functions, 7 Coach tools, 5 middlewares (EvidenceCheck, redundancyCheck, MultiHorizonLoader, numericGroundingCheck, ContinuityGate) — see Architecture §4.5.
- **v2.0.1 · 2026-05-15** — Post-validation quick-fixes: (HIGH-1) Tier 2-4 FRs converted from bullets to tables with acceptance criteria; (HIGH-2) NFR implementation-leakage removed (capability-level reformulation in §7.1 / §7.4 / §7.6); (HIGH-3) added §7.8 Clinical & Regulatory considerations with 8 NFR-CR rules; (HIGH-4) middleware count fixed (4 → 5); added FR-1.6 decision-layer hierarchy for IDENT-6 mapping.
- **v2.0.2 · 2026-05-17** — Constitutional refinements from gamification + motivation brainstorm (103 ideas + 48 anti-patterns documented): (1) **IDENT-1 expanded** with mentor-apprentice framing, **Supportive Challenge mode**, **rest / drift / value-evolution three-way distinction**, and **Sense-of-being-seen primary reward axiom** (replaces classical points/coins/XP/badge reward class). (2) **§2.4.1 new** — 48-pattern **Dark-Pattern Non-Goals catalog** in 10 categories (A-J), with 5 ⭐ mentor-role-corruption patterns receiving special pre-PR-review gating. (3) **§2.6 expanded** with Daniel-specific Rendszer-szerelem + Új-ötlet-pörgés motivational anchors and mentor-tanítvány relational frame (Phase 1-7 single-user fit; Phase 8 needs profile-detection generalization). (4) **AnchorMode entity subdivided** in Architecture: AnchorMode-A (Acceptance) + AnchorMode-D (Drift). (5) Architecture entity tree adds 10 new entities (4 Resource entities — RecoveryCapital, CognitiveBandwidth, AdaptationBudget, RelationshipCredit; IdentityStage, StatDimension, QuarterlyMemoir, MemoirCapsule, DriftAlert, PRStory) — see Architecture amendment. (6) Phase 7 `mezo-23s` GamificationWidgets epic will be redesigned per the new constitution (4 sub-epics planned: Quest & Ritual / Intrinsic Reward Stack / Resource Economy / Companion Voice update) before story generation. **Source:** `_bmad-output/brainstorming/brainstorming-session-2026-05-17-1122.md`.
- **v2.1 · 2026-05-23** — Prototype-driven realignment. Adopted `frontend_design/` as the **hard design contract** (overrides `design-system.html` + story-spec on visual conflict; completeness axis = FLOOR with ceiling rule). §3.2 re-scope principle (AI/tool-transparency as a cross-cutting primitive; form-vs-source split; unified `ProvenanceEnvelope`). §4.1.1 new entities (`SportSession`, `SupplementStashItem`, `WeightGoal`, `GymSchedule`, micronutrient tracking) + features; §4.3 excludes Tweaks/EDITMODE tooling; §4.4 Prototype contract boundary (visual=contract, impl≠contract, forbidden patterns); §4.5 entity reconciliation gate. §5.9-5.12 new journeys. §6.5 new FRs (FR-1.1.7, FR-1.3.5, FR-2.1.12, FR-2.2.11–15, FR-2.3.12–13, FR-3.1.4, FR-4.5). §7.7 NFR-A-5..7 (prototype contract, FLOOR, IDENT-1 tone gate). PERMA (IDENT-5) retained — prototype absence treated as incompleteness, not a cut. Driven by `bmad-correct-course` → Sprint Change Proposal 2026-05-23; cascade tracked under bd `mezo-g7i` / `mezo-0dv`. **Source:** `_bmad-output/planning-artifacts/{sprint-change-proposal-2026-05-23,prototype-inventory}.md`.

---

*This PRD is the contract for what we are building. The Architecture document is the contract for how. They evolve together; conflicts between them must be resolved before any implementation work proceeds.*
