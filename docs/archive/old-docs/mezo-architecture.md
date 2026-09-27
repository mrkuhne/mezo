---
title: Mezo Architecture
version: 2.1
date: 2026-05-17
last-edited: 2026-05-23
status: draft
prd-ref: _bmad-output/prd/mezo-prd.md
prototype-ref: frontend_design/  # HARD design contract (supersedes design-system.html), 2026-05-23
realignment-ref: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-23.md
source-spec: _bmad-output/prd/_archive/mezo-prd-v1-hybrid.md
source-brainstorm:
  - _bmad-output/brainstorming/brainstorming-session-2026-05-15-1245.md
  - _bmad-output/brainstorming/brainstorming-session-2026-05-17-1122.md
source-ux: _bmad-output/planning-artifacts/ux-design-specification.md
source-design-system: _bmad-output/planning-artifacts/design-system.html
related-beads:
  - mezo-eb8 (Spec v2 epic — CLOSED)
  - mezo-7ur (Architecture v1.0 → v2.0 amendment — this rewrite)
  - mezo-g7i (v2.1 prototype-realignment epic)
  - mezo-dpt (v2.1 architecture update task)
---

# Mezo Architecture

## 0. Changelog v1.0 → v2.0 (2026-05-17)

This v2.0 absorbs three new inputs since the v1.0 lockdown on 2026-05-15:

1. **2026-05-17 gamification + motivation brainstorm** — 103 ideas + 48-entry dark-pattern anti-pattern catalog. Source for IDENT-1 mentor-archetype refinement, the **Supportive Challenge mode** + `surfacePatternOfAvoidance` tool, the **Resource Economy** entity family (RecoveryCapital / CognitiveBandwidth / AdaptationBudget / RelationshipCredit), Identity & progression entities (IdentityStage / StatDimension / MemoirCapsule), Mentor-rhythm entities (QuarterlyMemoir / DriftAlert / PRStory), the AnchorMode A/D subdivision, and the Phase 7 epic redesign into 4 sub-epics.
2. **PRD v2.0.2 amendments** — IDENT-1 refinement (§2.3), Dark-Pattern Non-Goals catalog (§2.4.1), Daniel motivational anchors (§2.6 *Rendszer-szerelem* / *Új-ötlet-pörgés* / mentor-tanítvány), Clinical & Regulatory NFRs (§7.8), Decision-layer hierarchy FR (FR-1.6).
3. **UX Design Specification v2** (Steps 1-14 + Step 1c audit, locked 2026-05-16/17) + **design-system.html** (locked 2026-05-17). Sources for: Deep Current rename, warm-derivative palette, 4 Step-1c sub-palettes (pattern-category / tool-transparency / Reta-phase / AnchorMode supportive), L4 elevation, NOTCHED_4 chamfer, motion tokens, dual-mode React-Context contract, the 22-component primitive catalog, WCAG 2.2 AA accessibility lockdowns, PatternCard v2 spec, ToolChip Power-mode contract, PRCelebrationOverlay (overlay-card, not toast).

**Major deltas vs. v1.0 (this document)**:

| Area | v1.0 | v2.0 |
|---|---|---|
| Entity count | 51 | **61** (+10 from 2026-05-17 brainstorm) |
| Coach tools | 24 | **26** (+`surfacePatternOfAvoidance` and +`getResourceSnapshot`; `mirrorIdentity` return-type extended) |
| Edge Functions | ~37 | **~43** (+`quarterlyMemoir`, `driftDetector`, `generateMemoirCapsule`, `resourceCalculator`, `deleteUserData`, `clinicalAdviceCheck`, `detectCrisisIndicator`) |
| Chat middlewares | 4 + ContinuityGate (mislisted as 4 in §1.3) | **6**: EvidenceCheck → redundancyCheck → numericGroundingCheck → ContinuityGate → clinicalAdviceCheck (post-chain) + MultiHorizonLoader (pre-LLM) |
| Brand color name | "Clinical Teal" | **"Deep Current"** (hex unchanged) |
| Design canvas modes | single (dark) | **dual (cold + warm derivative)** via React Context |
| Elevation layers | L0-L3 (4) | **L0-L4 (5)** — +L4 Modal |
| Notched chamfer sizes | 8 / 12 | **4 / 8 / 12** — +NOTCHED_4 for ToolChip |
| Component catalog | ad-hoc list | **22-component primitive catalog** (UX spec §11) |
| Knowledge Graph default view | force-directed mindmap | **flat-list-default**, force-directed = opt-in toggle (Step-9 D4) |
| PR celebration | toast | **PRCelebrationOverlay** (persistent 60-70% overlay-card) — Sally R8 |
| AnchorMode | single mode | **AnchorMode-A (acceptance) vs AnchorMode-D (drift)** discriminator |
| Heartbeat baseline | min 2 msg/day | **min 3 msg/day** (PRD §2.3 + §3.1 success criteria) |
| Phase 7 epic | single `mezo-23s` gamification | **4 sub-epics** (Quest & Ritual / Intrinsic Reward Stack / Resource Economy / Companion Voice update) |

**v2.1 delta (2026-05-23 — prototype-driven realignment).** The `frontend_design/` prototype is adopted as the **hard design contract**; this architecture is realigned to PRD v2.1. Summary: +8 entities (→ 69) incl. a volume-provenance sub-model; +6 AI tools (→ ~32) + a unified `ProvenanceEnvelope` + the meal-evaluation pipeline; +~5 Edge Functions; new design-system token families + components; §8 rewritten to the prototype + a Sport screen; a Prototype Contract Boundary (visual=contract, impl≠contract). `design-system.html` is **superseded** by `frontend_design/`. Details are appended as `(v2.1)` subsections: §3.7, §4.13, §5.2, §7.15, §8.9-8.11. Source: `_bmad-output/planning-artifacts/{sprint-change-proposal-2026-05-23,prototype-inventory}.md`; cascade bd `mezo-g7i`.

---

## Overview

This document is the **technical architecture** for Mezo — the holistic AI performance & health platform. It is the companion to the **PRD** (`_bmad-output/prd/mezo-prd.md`), which owns vision, user journeys, roadmap, and risk. Architecture owns: system topology, data model, AI pipeline, backend functions, cron, design system, per-screen UX architecture (design-decisions only, not journeys), and environment configuration.

Tech stack is unchanged across v1.0 → v2.0 (Supabase + Postgres + pgvector + Gemini 3.1 + LangGraph.js + Vite/React 19/Tailwind 4) — IDENT-1..6 are product-identity principles, not infrastructure changes. The v2.0 deltas above are **product-identity refinement, schema additions, design-system lockdown, and motivation-system replacement of classical gamification** — none of which change the topology.

---

## 1. Architecture Overview

**Approach**: Supabase (Postgres BaaS) + Gemini 3.1 + pgvector (Postgres extension, same DB) + LangGraph.js orchestration (hybrid pattern). **No self-hosted server.**

The hybrid AI rule: **vanilla `@google/genai`** SDK for atomic single-shot LLM calls; **LangGraph.js** for stateful multi-step workflows (Companion tool-using agent + iterative pattern detection). The two stacks coexist — LangGraph `ChatGoogleGenerativeAI` model internally calls the same `@google/genai` SDK.

### 1.1 IDENT-driven architectural implications

The 6 identity principles map onto the architecture as follows. Italicised additions from the 2026-05-17 brainstorm + PRD v2.0.2 amendments.

| Principle | Architectural consequence |
|---|---|
| **IDENT-1 · Companion, not Coach** | Tone-of-voice prompt renamed `coachVoice.md` → `companionVoice.md`. First-person plural. Memory reference every 5th message. *Refined 2026-05-17: companion is a **mentor that challenges through relationship, not authority**. Adds **Supportive Challenge mode** to `companionVoice.md` (gentle pushback prompts for detected drift/avoidance). New Coach tool **`surfacePatternOfAvoidance(timeframe)`** runs on `Pattern` drift signals. **Three-way distinction routing**: (a) **rest/recovery** (legitimate exhaustion, illness, life-event) → `AnchorMode-A` + enhanced presence + lowered demands; (b) **drift/avoidance** (rationalised inactivity) → `AnchorMode-D` + `DriftAlert` entity creation + `surfacePatternOfAvoidance` tool; (c) **value-evolution** (genuine priority shift) → `proposeGoalUpdate` tool. Routing logic lives in `companionAgent.ts` post-response classification step. **Primary reward axiom = sense-of-being-seen** — replaces XP/coins/points/badges entirely. Architectural manifestation: `KnowledgeFact` references inline in companion replies; `IdentityStage` transitions surfaced only via companion mondat; `MemoirCapsule` on milestones; `PRStory` narrative per Achievement; `PatternDetectionRevealDrawer` UI as system-transparency reward. See PRD §2.3 IDENT-1 refinement.* |
| **IDENT-2 · Internal Sphere Only** | LangGraph tool registry **excludes** any external-actor tool: no email, no calendar write, no purchase, no third-party messaging. No `StreakRestoreTransaction` / `RecoveryBypassTransaction` entity (anti-pattern D3 / D34 enforcement). |
| **IDENT-3 · Continuous Companionship — Never Silent** | New cron component `HeartbeatScheduler`. KPI: `coach_presence_score` instead of `engagement_rate`. **Minimum 3 messages/day baseline** (PRD §2.3 + §3.1 success criteria). `heartbeatScheduler` MUST implement **fail-silent** behavior — no retry-with-escalation on user silence (anti-pattern D27 enforcement). |
| **IDENT-4 · Self-Logging is the Enemy** | UI component `QuickInputSheet` — multimodal unified intake (voice / photo / number-tap / choice-chip / free-text), modality chosen by AI. |
| **IDENT-5 · PERMA Whole-Life Scope** | L3 sub-layer `PersonalLifeContext`. `PERMAGoal` entity. 5-dimension goal system. **Note:** PERMA never surfaces as a 5-dimension widget in the UI (UX spec §8.6) — only as `PERMANarrativeAnchor` injection into companion narrative. |
| **IDENT-6 · Cognitive Offloading** | Decision hierarchy L1 (companion autonomous) / L2 (companion proposes, user confirms) / L3 (user decides, companion asks). *Implemented as `Recommendation.decision_layer: enum["L1","L2","L3"]` field — see §3.3 amendment. PRD FR-1.6 mandate.* |

### 1.2 System diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                Mezo PWA (iPhone Safari, mobile-first)            │
│  Vite + React 19 + Tailwind 4 + shadcn/ui                        │
│  • Antonio condensed bold + Inter + JetBrains Mono              │
│  • Notched chamfer 4/8/12px tag-system                          │
│  • Deep Current accent + dual-mode canvas                       │
│    (cold #0A0F14 default · warm #1A1410 memoir/anniversary/     │
│     anchormode · React Context theme-swap)                      │
│  • Abstract conceptual SVG icon set (custom)                    │
│  • Bottom nav 5 tab: Today / Train / Fuel / Insights / Me       │
│  • QuickInputSheet (multimodal, IDENT-4)                        │
│  • Knowledge Graph viz page (flat-list default + graph toggle)  │
│  • TanStack Query (persist offline cache + mutation queue)      │
│  • Add to Home Screen + Push notif (iOS 16.4+)                  │
│  • 22-component primitive catalog (UX spec §11)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ @supabase/supabase-js (HTTPS + Realtime)
                           │ + SSE stream chat function
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase backend (managed Postgres BaaS)            │
│                                                                  │
│  Postgres tables (RLS row-level on created_by, 61 entities):     │
│    Auth: User                                                    │
│    Train: Mesocycle, MesocycleWeek, MuscleGroupVolumeLog,        │
│           WorkoutSession, Exercise, ExerciseSet,                 │
│           MuscleGroupFeedback, ExerciseJointPainFeedback,        │
│           Achievement (+pr_story_id),                            │
│           WarmupBlock*, MobilityBlock*, ROMTestEntry*,           │
│           NiggleEntry*, JumpCount*, SportTransferRule*           │
│    Fuel: Meal, MealItem, FoodItem, Recipe,                       │
│          HydrationEntry*, ElectrolyteEntry*                      │
│    Supps/Meds: SupplementIntake, Medication, MedicationDose      │
│    Biometria: SleepLog, WeightLog, DigestionLog, CheckIn         │
│    Vendor: PriceHistory                                          │
│    AI Memory: AiInsight, AiConversation, Pattern, KnowledgeFact, │
│               CausalChain*, Prediction*, PredictionOutcome*,     │
│               Plan*, PlanOutcome*,                               │
│               CoachMemoirEntry* (+capsule_ids), LearnedFact*,    │
│               IdentityGoal*, FreeNoteEntry*,                     │
│               Recommendation* (+decision_layer), PsychInsight*   │
│    Life context: PERMAGoal*, PersonEntry*, Event*,               │
│                  EventDebrief*, ContextEpoch*,                   │
│                  EnvironmentSnapshot*, FinancialContext*,        │
│                  Experiment* (+source), ExperimentReport*        │
│    Motivation (2026-05-17): RecoveryCapital†, CognitiveBandwidth†,│
│                  AdaptationBudget†, RelationshipCredit†,         │
│                  IdentityStage†, StatDimension†, MemoirCapsule†, │
│                  QuarterlyMemoir†, DriftAlert†, PRStory†         │
│    AnchorMode (entity) — split by mode discriminator             │
│    (* = brainstorm 2026-05-15 · † = brainstorm 2026-05-17)       │
│                                                                  │
│  pgvector extension (same Postgres DB):                          │
│    embeddings table: HNSW index, 768-dim, cosine                 │
│    L1 episodic memory + FoodItem catalog                         │
│                                                                  │
│  Edge Functions (Deno, ~43 fn, 150s execution limit):            │
│    ai/, ingestion/, checkin/, memory/, meta/,                    │
│    + presence/ (HeartbeatScheduler, OpportunityScanner)          │
│    + life/ (weeklyMemoir, anniversaryReflection,                 │
│             goalCoherenceCheck, financialStressDetector,         │
│             dailyEnvironment, quarterlyMemoir†, driftDetector†,  │
│             generateMemoirCapsule†, resourceCalculator†)         │
│    + meta-ai/ (EvidenceCheck, redundancyCheck,                   │
│                MultiHorizonLoader, SelfHealthCheck,              │
│                EffectivenessTracker, clinicalAdviceCheck†)       │
│    + safety/ (detectCrisisIndicator†)                            │
│    + compliance/ (deleteUserData†)                               │
│    († = 2026-05-17 amendment)                                    │
│                                                                  │
│  Cron: pg_cron + pg_net (Europe/Budapest)                        │
│  Auth: email/password (Google OAuth Phase 7+)                    │
│  Secrets: supabase secrets set                                   │
└────────┬─────────────────────────────────────┬──────────────────┘
         │                                     │
         │ vanilla @google/genai (atomic)      │ OpenFoodFacts + Open-Meteo
         │                                     ▼
         ▼                                ────────────
   ┌─────────────────────────┐
   │  AI orchestration layer │   ◀── chat + generateAiHypotheses
   │  LangGraph.js           │
   │  • createReactAgent     │
   │    (Companion + 26 tool)│
   │  • StateGraph           │
   │    (propose→critique→   │
   │     revise pattern det.)│
   │  • LangSmith tracing    │
   └────────┬────────────────┘
            │ @langchain/google-genai
            ▼
   ┌─────────────────────────┐
   │ gemini-3.1-pro-preview  │
   │ gemini-3.5-flash (GA)   │
   │ gemini-3.1-flash-lite   │
   │ gemini-embedding-001        │
   │ Vision + Audio          │
   └─────────────────────────┘
```

### 1.3 Component responsibilities

| Component | Responsibility |
|---|---|
| PWA frontend | Mobile UI, offline cache, push notification receive, Supabase SDK + SSE chat stream, QuickInputSheet, Knowledge Graph viz (flat-list default), dual-mode (cold/warm) React Context theme-swap, 22-component primitive catalog |
| Supabase Postgres | Single source of truth — all 61 entities, RLS row-level on `created_by` |
| Supabase pgvector | Vector store — L1 episodic + FoodItem catalog, HNSW + cosine |
| Supabase Edge Functions | Deno runtime, Gemini + pgvector orchestration, scraper, secret-handling, structured output validation, SSE streaming, ~43 functions |
| Supabase Auth | Email/password (Phase 1), Google OAuth (Phase 7), JWT for RLS |
| Supabase Realtime | Postgres CDC — Pattern Inbox auto-refresh, achievement notification, memoir delivery |
| pg_cron + pg_net | Scheduled Edge Function triggers — daily/weekly/monthly/quarterly cycle (see Section 6) |
| Vanilla `@google/genai` | Atomic single-shot Gemini calls |
| LangGraph.js | Stateful AI workflows: Companion (chat) + iterative pattern detection |
| Companion tools (26) | 19 read + 5 compute + 4 write — Zod-typed, Gemini function calling (see Section 4 + Appendix C) |
| Chat middlewares (5+1 post-chain, 1 pre-LLM) | Post: EvidenceCheck, redundancyCheck, numericGroundingCheck, ContinuityGate, clinicalAdviceCheck. Pre: MultiHorizonLoader. Brainstorm 2026-05-15 + 2026-05-17 + PRD NFR-CR-2. |
| LangSmith (optional) | Tracing + replay, env-flag gated |
| Gemini Pro (`gemini-3.1-pro-preview`) | Heavy reasoning |
| Gemini Flash (`gemini-3.5-flash`, GA) | Narrative workhorse |
| Gemini Flash-Lite (`gemini-3.1-flash-lite`) | Cheap high-volume; thinking via `thinkingConfig` (no separate model) |
| gemini-embedding-001 | All embeddings, 768-dim |
| OpenFoodFacts | Global food DB lookup |
| Open-Meteo + AQI APIs | Daily environment context (Phase 5+, brainstorm 2026-05-15) |

---

## 2. 4-Layer AI Memory Architecture

The "knows you" memory is not a single vector index — it is 4 layers, each specialised, building on each other. The 2026-05-15 brainstorm added two L3 sub-layers (PersonalLifeContext, IdentityGoal) and a multi-horizon load rule. The 2026-05-17 brainstorm added the Identity & progression entities (`IdentityStage`, `StatDimension`) at L3/L2 derived layers and `MemoirCapsule` / `QuarterlyMemoir` / `DriftAlert` at L2.

```
┌──────────────────────────────────────────────────────────────────┐
│ L3: KNOWLEDGE GRAPH (long-term, validated facts)                  │
│  ▸ KnowledgeFact entity + typed edges (related_facts[])           │
│  ▸ Sub-layers:                                                    │
│     • PersonalLifeContext — PERMA-related facts                   │
│     • IdentityGoal — deep identity-level goals                    │
│     • IdentityStage — permanent named stages along an arc (NEW)   │
│     • Niggle-state — active body-region issues                    │
│  ▸ Top-20 reinforcement_count injected into every Gemini system   │
│    prompt (~500 tokens)                                           │
│  ▸ User-toggle: prompt-injection on/off per fact                  │
│  ▸ Knowledge Graph viz page renders this as interactive D3.js     │
│    force-directed graph — flat-list-default with toggle           │
│    (UX spec §8.6 D4 lockdown)                                     │
└──────────────────────────────────────────────────────────────────┘
                    ↑ promote (user-confirmed pattern → fact)
┌──────────────────────────────────────────────────────────────────┐
│ L2: PATTERN STORE (mid-term, statistical + AI-detected) +         │
│     DERIVED METRICS                                                │
│  ▸ Pattern entity (4 sub-kinds) + critique metadata               │
│  ▸ Layer 1: statistical correlations (nightly cron, Pearson)      │
│  ▸ Layer 2: ITERATIVE AI hypothesis pipeline (Sunday cron)        │
│       LangGraph StateGraph: gather → propose → critique →         │
│       [keep | revise | discard] → revise → persist                │
│  ▸ Layer 3: similarity matches (RAG, on-demand, pgvector)         │
│  ▸ Causal multi-step extensions:                                  │
│     • CausalChain entity for 4-5 step causal patterns             │
│     • Prediction + PredictionOutcome entities                     │
│     • Plan + PlanOutcome entities                                 │
│  ▸ Drift detection (NEW 2026-05-17):                              │
│     • DriftAlert entity created by driftDetector function         │
│       on multi-day deviation from established rhythm              │
│     • Triggers surfacePatternOfAvoidance tool + AnchorMode-D      │
│  ▸ Derived resources (NEW 2026-05-17, Phase 7):                   │
│     • RecoveryCapital, CognitiveBandwidth,                        │
│       AdaptationBudget, RelationshipCredit                        │
│     • Recomputed daily + on-event by resourceCalculator           │
│  ▸ Identity progression (NEW 2026-05-17):                         │
│     • StatDimension (élő amplitude, NOT monotonic)                │
│     • MemoirCapsule (milestone narrative fragments)               │
│     • QuarterlyMemoir (90-day deep narrative)                     │
│     • PRStory (2-3 sentence narrative per Achievement)            │
│  ▸ User Inbox: [Confirm] [Reject] [Monitor]                       │
└──────────────────────────────────────────────────────────────────┘
                    ↑ aggregate (raw event sequences → pattern)
┌──────────────────────────────────────────────────────────────────┐
│ L1: EPISODIC MEMORY (short-term, raw event embeddings)            │
│  ▸ Daily log, workout, check-in, meal, weekly summary embeddings  │
│  ▸ pgvector (Postgres extension), HNSW index, cosine distance     │
│  ▸ RLS row-level: every vector created_by-scoped                  │
│  ▸ Multi-Horizon load rule (brainstorm 2026-05-15):               │
│     past 7d + next 7d both mandatorily loaded on every            │
│     companion turn (see middleware in Section 4.5)                │
└──────────────────────────────────────────────────────────────────┘
                    ↑ embed
┌──────────────────────────────────────────────────────────────────┐
│ L0: RAW DATA (Supabase Postgres entities — 61 total)              │
│  ▸ The source of truth                                            │
│  ▸ RLS row-level `created_by = auth.uid()`                        │
│  ▸ Soft-delete (is_deleted flag), never physically deleted        │
└──────────────────────────────────────────────────────────────────┘
```

**Concrete flow example — chat (Companion tool calling):**

User msg: *"What would improve tomorrow's training?"*

1. **L3** facts loaded (top-20 reinforcement_count, incl. `IdentityStage` + `IdentityGoal` + `PersonalLifeContext`) → companion system prompt
2. **MultiHorizonLoader** middleware (pre-LLM) injects: last 7d events + next 7d plans
3. **Companion agent (Gemini 3.1 Pro)** decides which tools to call:
   - `get_recent_sleep({days: 7})` → 4 nights <7h
   - `get_recent_workouts({days: 7, muscle_group: "chest"})` → last chest RPE 9.5
   - `find_similar_past_days({description: "bad sleep before good training", k: 5})` → L1 RAG top-5
   - `recallSharedMemory({theme: "leg-day before volleyball"})` → past episode
   - `getResourceSnapshot()` → RecoveryCapital 0.62, AdaptationBudget 1/4 slots used
4. **L2** active validated patterns + CausalChains + active `DriftAlert` (if any) injected
5. **Post-response middlewares (in order)** validate the response:
   - `EvidenceCheck` — every past reference has inline citation, else reject
   - `redundancyCheck` — no question already answered in L3 facts
   - `numericGroundingCheck` — no hardcoded numbers; all derived from Daniel data
   - `ContinuityGate` — response contains ≥1 explicit context reference
   - `clinicalAdviceCheck` — no dose-change recommendations for prescription drugs (NFR-CR-2 / NFR-CR-3)
6. Gemini Pro synthesises → structured response + ref-tags + tool-call transparency chips (Power-mode only)
7. Save → AiConversation, embed both turns → L1 pgvector

---

## 3. Data Model — 69 Entities (v2.0: 61 · v2.1: +8, see §3.7)

> **Format note**: schemas in `jsonc` for readability. Actual Postgres DDL + RLS lives in `supabase/migrations/*.sql` (per-phase plans). Every table gets `created_by uuid references auth.users(id)` and RLS policy `using (created_by = auth.uid())`.

### 3.1 Inventory

**26 entities from v1** (sections A-G in §3.2 / Appendix A):
- Auth (1): User
- Train (9): Mesocycle, MesocycleWeek, MuscleGroupVolumeLog, WorkoutSession, Exercise, ExerciseSet, MuscleGroupFeedback, ExerciseJointPainFeedback, Achievement
- Fuel (4): FoodItem, Meal, MealItem, Recipe
- Supps/Meds (3): SupplementIntake, Medication, MedicationDose
- Biometria (4): SleepLog, WeightLog, DigestionLog, CheckIn
- Vendor (1): PriceHistory
- AI Memory (4): AiInsight, AiConversation, Pattern, KnowledgeFact

**25 entities from brainstorm 2026-05-15** (sections H-M in §3.3):
- Train-extension (6): NiggleEntry, MobilityBlock, WarmupBlock, ROMTestEntry, JumpCount, SportTransferRule
- Fuel-extension (2): HydrationEntry, ElectrolyteEntry
- Causal/Predictive AI (5): CausalChain, Prediction, PredictionOutcome, Plan, PlanOutcome
- Memoir/Identity (4): CoachMemoirEntry, LearnedFact, IdentityGoal, FreeNoteEntry
- PERMA / Life context (8): PERMAGoal, PersonEntry, Event, EventDebrief, ContextEpoch, EnvironmentSnapshot, FinancialContext, Experiment, ExperimentReport
- Recommendation/Insight (2): Recommendation (3-state), PsychInsight
- (Plus AnchorMode entity — Phase 5+, treated as part of life context)

**10 entities from brainstorm 2026-05-17** (sections N-P in §3.5):
- Resource family (4): RecoveryCapital, CognitiveBandwidth, AdaptationBudget, RelationshipCredit
- Identity & progression (3): IdentityStage, StatDimension, MemoirCapsule
- Mentor-rhythm (3): QuarterlyMemoir, DriftAlert, PRStory
- (Plus AnchorMode subdivision — same entity, gains `mode` discriminator)

**Total (v2.0): 61 entities.** v2.1 adds 8 (see §3.7) → **69**.

### 3.2 v1 entities (migrated from old spec § 4)

> Per-field definitions for the 26 v1 entities are migrated verbatim from the old spec (sections A through G). Refer to **Appendix A: Entity Field Reference** at the end of this doc.

Sub-sections (full schemas in Appendix A):
- **A. Auth** — `User` (auth.users + public.user_profiles 1:1)
- **B. Train (9)** — `Mesocycle`, `MesocycleWeek`, `MuscleGroupVolumeLog`, `WorkoutSession`, `Exercise`, `ExerciseSet`, `MuscleGroupFeedback`, `ExerciseJointPainFeedback`, **`Achievement` (+`pr_story_id`, v2.0 amendment)**
- **C. Fuel (4)** — `FoodItem`, `Meal`, `MealItem`, `Recipe`
- **D. Supps/Meds (3)** — `SupplementIntake`, `Medication`, `MedicationDose`
- **E. Biometria (4)** — `SleepLog`, `WeightLog`, `DigestionLog`, `CheckIn`
- **F. Vendor (1)** — `PriceHistory`
- **G. AI Memory (4)** — `AiInsight`, `AiConversation`, `Pattern`, `KnowledgeFact` (L3)

**v2.0 amendment** to `Achievement`:
```jsonc
// in addition to existing fields
{
  pr_story_id: uuid | null,            // FK → PRStory (§3.5 P) — companion 2-3 sentence narrative
}
```

### 3.3 New entities from brainstorm 2026-05-15

#### H. Train-extension (6)

**`NiggleEntry`** — pain/discomfort body-region tracker (#20, T2, Phase 2-3)
```jsonc
{
  recorded_at: datetime,
  body_region: enum ["left_shoulder","right_shoulder","lower_back","right_knee", ...],
  body_coordinates: { x: 0-100, y: 0-100 } | null,
  severity: integer (1-10),
  triggered_by: enum ["workout","volleyball","sleep_position","unknown"] | null,
  workout_session_id: string | null,
  active_until: datetime | null,
  notes: text
}
```

**`MobilityBlock`** — stretch / mobility session (Phase 3)
```jsonc
{
  date: date,
  duration_min: integer,
  body_regions: string[],
  exercises_done: string[],
  perceived_benefit: integer (1-10) | null,
  notes: text
}
```

**`WarmupBlock`** — warmup content + minutes per workout (Phase 2-3)
```jsonc
{
  workout_session_id: string,
  duration_min: integer,
  components: enum[] ["dynamic_stretch","cardio_lite","activation_drill","movement_specific"],
  notes: text
}
```

**`ROMTestEntry`** — monthly home mobility / ROM tests (Phase 3-4)
```jsonc
{
  test_date: date,
  test_name: enum ["sit_and_reach","shoulder_internal_rot","ankle_dorsi","hip_external_rot", ...],
  side: enum ["left","right","both"],
  measurement: number,
  measurement_unit: enum ["degrees","cm"],
  delta_vs_baseline: number | null,
  notes: text
}
```

**`JumpCount`** — volleyball + plyometric aggregate (Phase 3)
```jsonc
{
  date: date,
  workout_session_id: string | null,
  source: enum ["volleyball_match","volleyball_practice","gym_plyo","other"],
  count: integer,
  notes: text
}
```

**`SportTransferRule`** — gym exercise × sport-goal mapping (Phase 3)
```jsonc
{
  exercise_id: string,
  target_sport: enum ["volleyball","running","other"],
  transfer_type: enum ["synergy","antagonism","neutral"],
  effect_description: text,
  evidence_pattern_id: string | null,
  confidence: number (0-1),
  is_curated: boolean = false
}
```

#### I. Fuel-extension (2)

**`HydrationEntry`** — water + electrolyte fluid intake (Phase 3)
```jsonc
{
  date: date,
  time: time,
  volume_ml: integer,
  source: enum ["water","sparkling","tea","coffee","electrolyte_mix","other"],
  food_item_id: string | null,
  notes: text
}
```

**`ElectrolyteEntry`** — Na/K/Mg pacing (Phase 3)
```jsonc
{
  date: date,
  time: time,
  sodium_mg: number,
  potassium_mg: number | null,
  magnesium_mg: number | null,
  calcium_mg: number | null,
  source: enum ["food","supplement","electrolyte_mix"],
  food_item_id: string | null
}
```

#### J. Causal & Predictive AI (5)

**`CausalChain`** — multi-step causal chain (Phase 4-5)
```jsonc
{
  detected_at: datetime,
  steps: [{
    step_index: integer,
    entity_ref: string,
    entity_kind: string,
    description: text
  }],
  outcome_description: text,
  outcome_entity_ref: string,
  mechanism_hypothesis: text,
  confidence: number (0-1),
  source_pattern_id: string | null,
  user_validated: boolean = false,
  derived_to_knowledge_fact_id: string | null
}
```

**`Prediction`** — tracked AI prediction (Phase 4-5)
```jsonc
{
  made_at: datetime,
  prediction_text: text,
  prediction_type: enum ["workout_performance","sleep_quality","energy_level","weight_trend","mood","other"],
  predicted_value: jsonb | null,
  prediction_horizon_hours: integer,
  source_chat_id: string | null,
  source_briefing_id: string | null,
  status: enum ["pending","outcome_recorded","stale"] = "pending"
}
```

**`PredictionOutcome`** — actual outcome of a prediction (Phase 4-5)
```jsonc
{
  prediction_id: string,
  outcome_recorded_at: datetime,
  actual_value: jsonb,
  accuracy_score: number (0-1),
  notes: text
}
```

**`Plan`** — weekly plan (Phase 4-5)
```jsonc
{
  week_start: date,
  plan_items: [{
    category: enum ["training","nutrition","sleep","supplement","life"],
    description: text,
    target_value: number | null,
    target_unit: string | null
  }],
  source: enum ["companion_proposed","user_set","mixed"],
  user_confirmed_at: datetime | null
}
```

**`PlanOutcome`** — realized outcome of a plan item (Phase 4-5)
```jsonc
{
  plan_id: string,
  plan_item_index: integer,
  actual_value: number | null,
  achievement_ratio: number (0-1.5),
  notes: text
}
```

#### K. Memoir / Identity / Free-form (4)

**`CoachMemoirEntry`** — weekly memoir narrative + Daniel's reaction (Phase 4-5)
```jsonc
{
  week_start: date,
  generated_at: datetime,
  narrative_md: text,
  themes: string[],
  anchor_entity_refs: string[],
  user_reaction: enum ["like","love","save","dismiss"] | null,
  user_reaction_at: datetime | null,
  capsule_ids: uuid[] | null         // v2.0 amendment: FKs → MemoirCapsule (§3.5 O) woven into this entry
}
```

**`LearnedFact`** — user-curatable KnowledgeFact candidate (Phase 4)
```jsonc
{
  candidate_text: text,
  derived_from_chat_id: string | null,
  derived_from_pattern_id: string | null,
  presented_to_user_at: datetime | null,
  user_decision: enum ["accept","reject","refine"] | null,
  refined_text: text | null,
  promoted_to_knowledge_fact_id: string | null
}
```

**`IdentityGoal`** — deep identity-level goal (Phase 4)
```jsonc
{
  goal_text: text,
  category: enum ["physical","mental","relational","career","creative","spiritual"],
  declared_at: datetime,
  reflected_count: integer = 0,        // v2.0: now consumed ONLY by mirrorIdentity tool; NOT surfaced as UI progress bar (anti-pattern D38)
  last_reflected_at: datetime | null,
  is_active: boolean = true,
  notes: text
}
```

**`FreeNoteEntry`** — voice/text free log + AI-extracted entities (Phase 4)
```jsonc
{
  recorded_at: datetime,
  raw_text: text,
  source: enum ["voice","text","quick_input_sheet"],
  ai_extracted_entities: [{
    entity_kind: string,
    confidence: number,
    suggested_fields: jsonb
  }] | null,
  user_confirmed_entities: string[] | null,
  embedding_id: uuid | null,
  crisis_indicator_score: number (0-1) | null  // v2.0: written by detectCrisisIndicator (§4.12)
}
```

#### L. PERMA / Life Context (8 + 1)

**`PERMAGoal`** — 5-dimension PERMA goal (Phase 5)
```jsonc
{
  dimension: enum ["positive_emotion","engagement","relationships","meaning","accomplishment"],
  goal_text: text,
  declared_at: datetime,
  target_metric: text | null,
  target_value: number | null,
  is_active: boolean = true,
  current_progress: number (0-1) | null
}
```

**`PersonEntry`** — people in Daniel's life (Phase 5)
```jsonc
{
  name: string,
  relationship: enum ["family","partner","friend","mentor","mentee","colleague","teammate","other"],
  affect_baseline: enum ["positive","neutral","mixed","negative"] | null,
  mention_count: integer = 0,
  last_mentioned_at: datetime | null,
  notes: text
}
```

**`Event`** — pitch / interview / family / medical event (Phase 5)
```jsonc
{
  scheduled_for: datetime,
  category: enum ["pitch","interview","family","medical","sport_competition","social","other"],
  description: text,
  prep_needed: boolean = false,
  prep_protocol_started_at: datetime | null,
  importance: integer (1-5)
}
```

**`EventDebrief`** — post-hoc reflection on an Event (Phase 5)
```jsonc
{
  event_id: string,
  debriefed_at: datetime,
  outcome: enum ["went_well","mixed","didnt_go_well"],
  reflections: text,
  lessons: text[],
  energy_cost: integer (1-10) | null
}
```

**`ContextEpoch`** — home / travel / sick / recovery / holiday window (Phase 5)
```jsonc
{
  start_at: datetime,
  end_at: datetime | null,
  kind: enum ["home","travel_domestic","travel_international","sick","recovery","holiday","high_stress_period"],
  location_label: string | null,
  expected_adjustments: jsonb | null,
  notes: text
}
```

**`EnvironmentSnapshot`** — daily weather/AQI/daylight (Phase 5)
```jsonc
{
  date: date,
  location_lat: number,
  location_lng: number,
  temp_min_c: number,
  temp_max_c: number,
  apparent_temp_min_c: number | null,
  apparent_temp_max_c: number | null,
  precipitation_mm: number,
  aqi: integer | null,
  uv_index_max: number | null,
  daylight_hours: number,
  source: enum ["open_meteo","manual"] = "open_meteo"
}
```

**`FinancialContext`** — recurring + discretionary spend awareness (Phase 6+)
```jsonc
{
  recorded_at: datetime,
  category: enum ["food","supplements","gym","health","other_recurring","discretionary"],
  amount_huf: number,
  is_recurring: boolean,
  notes: text
}
```

**`Experiment`** — N=1 study mode (Phase 6+)
```jsonc
{
  hypothesis: text,
  target_metric: text,
  intervention: text,
  duration_days: integer,                   // 7-14 typical for side-quest experiments (Új-ötlet-pörgés)
  started_at: datetime,
  ended_at: datetime | null,
  goal_alignment_score: number (0-1),
  status: enum ["proposed","running","completed","abandoned"],
  source: enum ["user_initiated","companion_proposed"] = "user_initiated"  // v2.0 amendment — PRD §2.6 Új-ötlet-pörgés distinction
}
```
**Constraint**: must NOT contain interventions modifying prescription-drug doses (NFR-CR-4). A DB-level CHECK constraint or a write-time validator in the corresponding Edge Function enforces this.

**`ExperimentReport`** — N=1 study output (Phase 6+)
```jsonc
{
  experiment_id: string,
  baseline_value: number,
  intervention_value: number,
  delta: number,
  significance_note: text,
  recommendation: enum ["adopt","reject","extend","inconclusive"]
}
```

**`AnchorMode`** — crisis/drift stabilising overlay (Phase 5+, subdivided in 2026-05-17 — see §3.5 Q for full v2 spec)

#### M. Recommendation / Insight (2)

**`Recommendation`** — 3-state Sent → Acted/Skipped → Outcome (Phase 5+)
```jsonc
{
  sent_at: datetime,
  category: enum ["nutrition","training","supplement","sleep","social","life"],
  recommendation_text: text,
  source: enum ["briefing","chat","push_notification","opportunity_scanner"],
  state: enum ["sent","acted","skipped","dismissed"],
  acted_at: datetime | null,
  outcome_evaluated_at: datetime | null,
  outcome_summary: text | null,
  effectiveness_score: number (0-1) | null,
  decision_layer: enum ["L1","L2","L3"]    // v2.0 amendment — PRD FR-1.6: L1=companion autonomous (audit-only), L2=companion proposes/user confirms (default card), L3=user decides/companion asks
}
```

**`PsychInsight`** — peer-reviewed observation + citation (Phase 5)
```jsonc
{
  observation: text,
  study_citation: text,
  study_url: string | null,
  applies_to_categories: string[],
  is_active_in_prompts: boolean = false
}
```

### 3.4 New L3 sub-layers

Four `KnowledgeFact.category` sub-categories appended (brainstorm 2026-05-15 + 2026-05-17):

- **PersonalLifeContext** — PERMA-related facts (relationships, meaning, accomplishment)
- **IdentityGoal-derived** — facts derived from `IdentityGoal` entity
- **IdentityStage-derived** — facts derived from `IdentityStage` permanent transitions (v2.0)
- **Niggle-state** — currently-active body-region issues

### 3.5 New entities from brainstorm 2026-05-17 — Motivation System

The 2026-05-17 gamification + motivation brainstorm (103 ideas + 48 anti-patterns) added the following entities. These are **Phase 7 implementation scope** (the redesigned `mezo-23s` epic now splits into 4 sub-epics — see §3.5.5).

**Source**: `_bmad-output/brainstorming/brainstorming-session-2026-05-17-1122.md`.

#### N. Resource family (4) — the "real currency" economy

Per IDENT-1 refinement + brainstorm §F1-#7 + §F3-#10..13, the "currency" in Mezo is **real physiological resource**, not abstract points. Each entity is a **derived rolling-window calculation** (not raw user input) refreshed by `resourceCalculator` (§5).

**Anti-pattern enforcement (PRD §2.4.1 D31):** all four entities have a **floor constraint** — `level` is never 0; companion "protects" rather than "punishes". Encoded as DB CHECK or write-time validator.

**`RecoveryCapital`** — central meta-resource (Phase 7)
```jsonc
{
  level: number (0.05-1.0),              // floor constraint: never reaches 0 (anti D31)
  window_days: integer = 7,
  inputs_snapshot: jsonb,                // { sleep_debt_hours, caloric_coverage_ratio, mobility_block_count, deload_marker_bool }
  costs_snapshot: jsonb,                 // { heavy_workout_count, stress_signals_count, alcohol_intake_g }
  computed_at: datetime,
  formula_version: string                // semver for the underlying calculation; allows backfill on formula changes
}
```

**`CognitiveBandwidth`** — deep-work hours/day (Phase 7)
```jsonc
{
  level: number (0.05-1.0),
  deep_work_available_hours: number,
  context_switch_penalty: number (0-1),
  event_density_today: integer,          // count of Event entities scheduled today
  computed_at: datetime,
  formula_version: string
}
```

**`AdaptationBudget`** — weekly cap on novel inputs (Phase 7)
```jsonc
{
  level: number (0.05-1.0),
  week_start: date,
  slots_used: integer,
  slots_total: integer,                  // TBD formula — Phase 7 design lock (likely 3-4, user-adjustable?)
  computed_at: datetime,
  formula_version: string
}
```
**Used by**: `proposeExperiment` write-tool — the companion REFUSES to propose new Experiments when `level < threshold`. This is IDENT-1 "companion that protects" (anti-pattern D34 enforcement: no bypass transaction).

**`RelationshipCredit`** — PERMA-R derived (Phase 7)
```jsonc
{
  level: number (0.05-1.0),
  window_days: integer = 30,
  person_entry_refs: uuid[],             // PersonEntry rows considered
  interaction_quality_summary: jsonb,    // { positive_count, neutral_count, mixed_count, negative_count }
  computed_at: datetime,
  formula_version: string                // TBD formula — Phase 7 design lock
}
```

#### O. Identity & progression (3) — replaces classical level/stat/achievement

**`IdentityStage`** — named life-stage descriptors (Phase 7)
```jsonc
{
  identity_goal_id: uuid,                // FK → IdentityGoal
  stage_name: text,                      // e.g., "Most már megy", "Tudod miért csinálod", "Csak csinálod", "Mester-szelő"
  stage_index: integer (1-6),
  reached_at: datetime,
  is_current: boolean = true,
  triggered_by: enum ["mirrorIdentity_tool","quarterly_memoir","companion_chat"]
  // NO expires_at, NO decay_after_days — IdentityStage is PERMANENT once reached (anti-pattern D21 enforcement)
}
```
**Constraint**: per `identity_goal_id`, exactly one row has `is_current=true`. Surfaced **only via companion narrative** (chat / memoir / quarterly Mizu Velünk); NOT a UI progress bar (anti-pattern D38 enforcement).

**`StatDimension`** — élő hullámzó dimensions (Phase 7)
```jsonc
{
  dimension_name: enum ["tartossag","turelem","jelenlet","batorsag","tisztasag"],
  current_amplitude: number (0-1),       // amplitude, NOT monotonic — formula TBD Phase 7 design lock
  phase_label: text | null,              // companion's narrative description of current phase
  samples: jsonb,                        // time-series snapshots: [{ at: datetime, amplitude: number, evidence_refs: string[] }, ...]
  updated_at: datetime,
  // NO percentile, NO rank — single-user scope; no shared scoreboard (anti-pattern D11-D15 enforcement)
  formula_version: string
}
```
**Note**: 5 fixed dimensions (Tartósság, Türelem, Jelenlét, Bátorság, Tisztaság). PERMA-aligned but not 1:1 with PERMA dimensions. Companion may reference an amplitude in narrative; UI displays as resonance visual (NOT progress bar).

**`MemoirCapsule`** — milestone narrative fragment (Phase 7)
```jsonc
{
  trigger_type: enum ["pr","identity_stage_transition","behavior_breakthrough"],
  trigger_entity_ref: uuid,              // points to the Achievement / IdentityStage / Pattern that triggered
  trigger_entity_kind: string,           // "Achievement" | "IdentityStage" | "Pattern"
  narrative_md: text,                    // ~1 paragraph
  generated_at: datetime,
  woven_into_memoir_id: uuid | null      // FK → CoachMemoirEntry (the weekly memoir that absorbed this capsule, if any)
}
```
**Trigger gating (anti-pattern D38 enforcement)**: `trigger_type` MUST be one of the three real-milestone types. `detectAchievements` and the pattern engine enforce this — NO capsules on app-open, daily-login, trivial check-in completion.

#### P. Mentor-rhythm entities (3)

**`QuarterlyMemoir`** — 3-5 paragraph deep narrative (Phase 7)
```jsonc
{
  quarter_start: date,                   // 1st of Jan/Apr/Jul/Oct (or DriftAlert-contingent)
  generated_at: datetime,
  narrative_md: text,                    // 3-5 paragraphs
  identity_arc_summary: text,            // 1-paragraph summary of identity evolution this quarter
  dominant_patterns: jsonb,              // [{ pattern_id, weight }, ...]
  next_quarter_intention: text | null,   // proposed direction (companion-authored, user-confirmable)
  trigger: enum ["cron_quarterly","drift_alert_contingent"]
}
```

**`DriftAlert`** — companion-internal signal (Phase 7)
```jsonc
{
  detected_at: datetime,
  pattern_id: uuid | null,               // FK → Pattern that surfaced the drift signal
  deviation_days: integer,               // how many consecutive days outside established rhythm
  reason_hypothesis: text,               // companion's hypothesis about the underlying cause
  resolved_at: datetime | null,
  resolution_type: enum ["companion_named","user_acknowledged","auto_resolved"] | null,
  // companion-internal entity: no monetization path, no push escalation (anti-pattern D44-D48 enforcement)
}
```
**Effects on creation**:
- Activates `AnchorMode-D` (sets `AnchorMode.mode = 'drift'` and links `drift_alert_id`).
- Companion calls `surfacePatternOfAvoidance` tool on next user turn.
- May contingently trigger `quarterlyMemoir` generation (off-schedule).

**`PRStory`** — 2-3 sentence companion narrative per Achievement (Phase 7)
```jsonc
{
  achievement_id: uuid,                  // FK → Achievement (1:1)
  narrative_md: text,                    // 2-3 sentences
  generated_at: datetime,
  voice_tone: enum ["warm","proud","matter_of_fact"]  // formula TBD Phase 7 — may vary by PR magnitude / IdentityStage
}
```

#### Q. AnchorMode subdivision (entity update, not +1)

The existing `AnchorMode` entity gains a `mode` discriminator field per brainstorm §F2-A55:

```jsonc
{
  // existing fields unchanged
  mode: enum ["acceptance","drift"],     // v2.0 amendment
  drift_alert_id: uuid | null,           // FK → DriftAlert (only set when mode='drift')
  // ...
}
```

- **`mode = 'acceptance'`** (AnchorMode-A) — legitimate crisis: illness, grief, life event, true exhaustion. Response: enhanced presence + lowered demands ("Csak ennyit ma. Tegnap is itt voltunk").
- **`mode = 'drift'`** (AnchorMode-D) — detected avoidance/sabotage via `DriftAlert`. Response: presence + **supportive challenge** ("Látom hogy szunyókálsz mostanában. Tényleg pihenés ez, vagy van valami amit nem nézünk együtt?"). Differentiated visual treatment (color/tone) from AnchorMode-A.

Both share the "anchor" semantics (stabilising presence) but differ in mode of stabilisation (holding vs. naming).

#### §3.5.5 — Phase 7 epic decomposition (4 sub-epics)

The original `mezo-23s` "GamificationWidgets" epic is **redesigned and split** per PRD v2.0.2 changelog §10.1 and brainstorm §F3. Each sub-epic maps to a coherent slice of the §3.5 N/O/P entities + supporting infrastructure:

| Sub-epic | Entities | Tools | Functions | UI components |
|---|---|---|---|---|
| **1. Quest & Ritual** | `Experiment` (+`source`), `QuarterlyMemoir`, `DriftAlert` | `proposeExperiment` (existing, gated by `AdaptationBudget`), `surfacePatternOfAvoidance` (new) | `quarterlyMemoir`, `driftDetector` | `TwoDoorsSessionCard`, `Quest3StageLifecycleView`, `QuarterlyMemoirReader` |
| **2. Intrinsic Reward Stack** | `IdentityStage`, `MemoirCapsule`, `PRStory`, +`Achievement.pr_story_id`, +`CoachMemoirEntry.capsule_ids` | `mirrorIdentity` (return-type extended to include `IdentityStage` data) | `generateMemoirCapsule` | `PatternDetectionRevealDrawer`, `IdentityStageNarrativeCard`, `PRStoriedHall`, `QuarterlyMemoirReader` |
| **3. Resource Economy** | `RecoveryCapital`, `CognitiveBandwidth`, `AdaptationBudget`, `RelationshipCredit` | `getResourceSnapshot` (new) | `resourceCalculator` | `ResourceDashboardWidget` (4-gauge), `StatDimensionDisplay` |
| **4. Companion Voice update** | `AnchorMode` subdivision (`mode` discriminator), `DriftAlert` (UI surface) | (no new tools; `surfacePatternOfAvoidance` shared with #1) | (no new functions) | `AnchorModeBanner` (A vs D differentiation), Supportive Challenge mode + Two Doors structural rule + System-Disclosure mode + Mentor-Tone framing in `companionVoice.md` |

### 3.6 Anti-pattern architectural constraints

PRD §2.4.1 defines a 48-entry Dark-Pattern Non-Goals catalog. The 5 ⭐ mentor-role-corruption patterns and several others impose **schema-level and tooling-level constraints** that the architecture MUST enforce. This section consolidates those constraints — the PRD owns the rationale narrative; the architecture owns the structural prohibitions.

| Anti-pattern (PRD §2.4.1) | Architecture constraint |
|---|---|
| **D3 — pay-to-rescue streak** | NO `StreakRestoreTransaction` entity. NO `premium_streak_rescue` field. The existing `streak` is a mini-stat (no dedicated UI widget; no economy attached). |
| **D10 — birthday lock-out / FOMO** | NO `TimeLimitedReward` entity. NO `expires_at` field on `Achievement` / `MemoirCapsule` / `QuarterlyMemoir`. Anniversary cards (`anniversaryReflection`) produce timeless memoir gifts, never countdown-gated content. |
| **D11-D15 — leaderboards / social comparison** | NO shared-aggregate scoreboard tables. `StatDimension` and `IdentityStage` have NO `percentile` / `rank` field. Single-user RLS scope (`created_by = auth.uid()`) enforces no cross-user reads anywhere. |
| **D21 — identity decay** | `IdentityStage` has NO `expires_at` / `decay_after_days` field. Once reached, **permanent**. |
| **D27 — escalating push notifications** | `heartbeatScheduler` MUST be **fail-silent** — no retry-with-escalation pipeline. No `escalation_attempt_count` field. Companion absorbs silence ("Csendben tovább itt vagyok"). |
| **D31 — stamina-to-zero shame** | All four `Resource*` entities have a **floor constraint** (`level >= 0.05`, never reaches 0). Encoded as DB CHECK or write-time validator in `resourceCalculator`. |
| **D34 — buy out of rest** | `AdaptationBudget` is **read-only** from the companion's tool surface — NO write tool can bypass the gate. NO `RecoveryBypassTransaction` entity. The companion's refusal is IDENT-1-compatible (mentor protecting apprentice). |
| **D38 — manufactured 5-minute milestones** | `Achievement` is PR-only (real performance records). `detectAchievements` Edge Function MUST gate on real performance thresholds — NO `AppOpenAchievement` / `DailyLoginStreak` / trivial-trigger achievement. `MemoirCapsule.trigger_type` restricted to `["pr","identity_stage_transition","behavior_breakthrough"]`. `IdentityGoal.reinforcement_count` is internal-only (consumed by `mirrorIdentity` tool); NOT surfaced as UI progress bar. |
| **D40 — "Achievement Unlocked!" toast** | Replaced by `MemoirCapsule` (narrative-anchored, persistent, re-readable). NO transient achievement-toast component. `PRCelebrationOverlay` is a **persistent overlay-card** (Sally R8), not a toast. |
| **D44-D48 — data weaponization** | `DriftAlert` is **companion-internal** — no monetization path, no push escalation on bad data. `DriftAlert.resolution_type` restricted to behavioral values only (no `paid_resolution` etc.). |

These constraints are non-negotiable. If a future feature spec proposes anything that violates a constraint above, the PR must be rejected and the constraint surfaced as the rejection reason.

### 3.7 v2.1 prototype-realignment entities + fields (2026-05-23)

Adopting the `frontend_design/` prototype as the design contract adds 8 entities (→ 69) + a volume-provenance sub-model, plus field additions. Standard RLS applies (`created_by = auth.uid()`). Entity names trace the prototype; Architecture owns final modeling.

**New entities**

```jsonc
// Sport (volleyball/cardio session log — fills the §8.9 Sport screen)
SportSession {
  id, created_by,
  sport: "volleyball" | "cardio" | "other",
  date, time, duration_min: int,
  sets_played: int | null,         // volleyball
  rpe: int,                        // 1-10 session RPE
  shoulder_strain: int | null,     // 1-10 overhead load
  jump_count_id: uuid | null,      // → JumpCount (existing)
  notes: text | null
}

SupplementStashItem {              // supplement/medication INVENTORY (Fuel "Stash")
  id, created_by,
  name, brand: text | null, form: text | null,   // capsule/powder/liquid
  type: "supplement" | "stimulant" | "medication",
  links_medication_id: uuid | null,    // → Medication (Reta etc.) — restock reminder only, NFR-CR-2/3
  caffeine_mg: int | null,
  dose: text, protocol: text | null,
  stock: numeric | null, stock_unit: text | null,
  low_stock_threshold: numeric | null
}

WeightGoal {                       // body-composition goal — ADDITIVE to PERMAGoal, NOT a replacement
  id, created_by,
  kind: "cut" | "bulk" | "maintenance", title,
  start_weight, current_weight, target_weight, unit: "kg",
  start_date, target_date,
  rate_target_value: numeric, rate_target_unit: "kg/week",
  identity_frame: text | null,         // slice of IdentityGoal; PERMA stays separate (IDENT-5)
  linked_mesocycle_ids: uuid[]         // → Mesocycle
}

GymSchedule {                      // recurring weekly training-time template (fuel/supplement-timing input)
  id, created_by,
  weekly: [{ day: 0-6, active: bool, time, type: text, duration_min: int }]
}

MicronutrientTarget {              // per-micronutrient RDA target (drives micro-balance score + FR-2.3.1)
  id, created_by,
  nutrient: text,                  // Mg, Zn, B-complex, D, omega-3, ...
  rda_amount: numeric, unit: text
}
```

**Volume-provenance sub-model** (FR-2.2.12-14; append-only — separates *target derivation* from `MuscleGroupVolumeLog`, which logs *performed* volume):

```jsonc
VolumeTarget {                     // current effective target per muscle × meso-week (derived cache)
  id, created_by,
  mesocycle_id, mesocycle_week, muscle_group,
  mev: int, mav: int, mrv: int, effective_sets: int,
  derived_from_computation_id: uuid     // → VolumeComputation; never hand-edited
}

VolumeComputation {                // APPEND-ONLY audit; one row per recompute
  id, created_by, mesocycle_id, mesocycle_week, muscle_group,
  baseline: int,
  adjustments: [{ kind: "niggle"|"pattern"|"recovery"|"sport-cross",
                  delta_sets: int, reason: text, provenance: ProvenanceEnvelope }],
  confidence: numeric | null,           // null = unknown (never fabricated)
  input_snapshot: jsonb,                // immutable snapshot of triggering entity ids+values
  computed_by: "ai" | "system" | "user-override",
  superseded_by: uuid | null, created_at
}

VolumeOverride {                   // APPEND-ONLY; user override of a computed target
  id, created_by,
  overrides_computation_id: uuid,       // → VolumeComputation it replaced
  muscle_group, mesocycle_week,
  override_value: int, reason: text | null, created_at
}
```

**Field additions to existing entities**

| Entity | New field(s) | Source |
|---|---|---|
| `ExerciseSet` | `side: "L" \| "B" \| "R"` (unilateral) | FR-2.2.8, prototype |
| `Exercise` | `stim: int` (1-5), `fatigue: int` | meso-planner `rankByStimFatigue` |
| `SleepLog` | `meal_to_sleep_min: int` | FR-2.1.2, prototype |
| `Meal` | `score: int \| null` (0-100), `score_breakdown: jsonb \| null` | FR-2.3.13 |
| `FoodItem` | `nova_class: 1-4 \| null`, `micro_vector: jsonb \| null` (cached AI enrichment) | meal-eval §4.13 |

`Context` parse-kind from prototype QuickInput → existing `ContextEpoch` / `EnvironmentSnapshot` (no new entity).

#### 3.7.1 Entity reconciliation (PRD §4.5 gate — full row table tracked under bd `mezo-8co`)

Prototype **presence** is evidence; **absence is a question, not a verdict**. Disposition by family:

| Entity / family | In prototype? | Disposition |
|---|---|---|
| Train v1 (Mesocycle, WorkoutSession, ExerciseSet, …) | yes | confirmed; +fields above |
| Volume-provenance (VolumeTarget/Computation/Override) | yes (MesoVolume) | **NEW** |
| SportSession (+ schedule) | yes (Sport screen) | **NEW** |
| Fuel v1 + HydrationEntry | yes | confirmed |
| `ElectrolyteEntry` | **no UI** | RETAINED; UI deferred (Phase 3-4) — not a cut |
| SupplementStashItem / MicronutrientTarget | yes (Stash / micro) | **NEW** |
| WeightGoal | yes (Goals) | **NEW** |
| `PERMAGoal` / `IdentityGoal` | only `identityFrame` | RETAINED (IDENT-5); full UI Phase 5 — not a cut |
| AI Memory (Pattern, KnowledgeFact, Prediction, Experiment, CoachMemoirEntry) | yes (Insights 7-tab) | confirmed |
| `Experiment.source` + `AdaptationBudget` | **no UI** | RETAINED; Phase 5/7 — not a cut |
| Phase-7 Motivation (IdentityStage, ResourceDashboard, PRStoriedHall, QuarterlyMemoir) | **no UI** | RETAINED; Phase 7 (`mezo-23s` redesign) — not a cut |
| Resource family (RecoveryCapital, CognitiveBandwidth, RelationshipCredit) | partial | RETAINED; Phase 5-7 |

**No entity is dropped in v2.1.** Drops require Daniel sign-off (none taken).

---

## 4. AI Pipeline

### 4.1 Model selection + framework rule

**Models**:

| Model (verified ID, 2026-05-25, bd `mezo-e2m`) | Where | Token typical | Why |
|---|---|---|---|
| `gemini-3.1-pro-preview` (Pro) | Weekly report, pattern propose/critique/revise, deep chat, mesocycle adjust, recipe gen, memoir, quarterly memoir | 30-60K in, 1-3K out | Heavy reasoning + structured output + function calling. **Preview** — re-point to `gemini-3.5-pro` when it GAs (~2026-06). |
| `gemini-3.5-flash` (Flash) + `thinkingConfig` | Daily briefing, user-facing narrative, pattern explanation, mid-complexity ("Flash-thinking" = this model with a thinking budget, not a separate model) | 10K in, 1K out | GA workhorse; thinking via `thinkingConfig` |
| `gemini-3.1-flash-lite` (Flash-Lite) | Inline cards, check-in extraction, scraper, classifyNOVA, achievement copy, environment fetch, clinical-advice classifier, crisis indicator | 2-8K in, 0.3-1.5K out | Cheap, fast, high-volume — protects NFR-$-1 |
| `gemini-embedding-001` @ 768 | All embeddings | n/a | bd `mezo-c30`; L2-normalize sub-3072 (§4.8) |

> **Model-ID single source of truth**: keep these in one config constant (`_shared/models.ts → { pro, flash, flashLite, embedding }`). Logical names elsewhere in this doc (`Gemini 3.1 Pro/Flash`) map here. `gemini-3.5-flash` is GA (I/O 2026); `gemini-3.1-pro-preview` is still preview (no stable Pro until `gemini-3.5-pro`, ~2026-06); legacy `gemini-3.1-flash` / `gemini-3.1-flash-thinking` do NOT exist as GA models. Verification: `_bmad-output/planning-artifacts/research/technical-gemini-model-ids-research-2026-05-25.md`.

**Framework rule**: LangGraph if (2+ LLM calls with shared state) OR (conditional routing between LLM nodes). Otherwise vanilla `@google/genai`.

### 4.2 Vanilla atomic workflows

Daily Briefing, Weekly Sunday Report, Inline Cards, Recipe Generator, Voice-to-log, Photo Recognition, URL Scraper, extractCheckInTopics, detectAchievements, suggestNextMesocycleWeek, **clinicalAdviceCheck**, **detectCrisisIndicator**, **generateMemoirCapsule**, **driftDetector**, **resourceCalculator**, **quarterlyMemoir**. Pattern: input → context fetch (pure TS) → 1 Gemini call with Zod-validated structured output → DB write.

### 4.3 Companion — LangGraph `createReactAgent` (the `chat` function)

The Companion (renamed from "Coach", IDENT-1) is a tool-using ReAct agent using **26 tools** (was 17 → 24 → 26: +`surfacePatternOfAvoidance`, +`getResourceSnapshot`; `mirrorIdentity` return-type extended to include `IdentityStage` data). Streaming SSE with transparent tool calls (Power-mode only — see §7.13).

**Flow:**

```
user msg → POST /functions/chat (SSE)
         ↓
  buildSystemPrompt(userId):
    L3 facts top-20 (incl. IdentityGoal, IdentityStage, PersonalLifeContext sub-layers)
    + L2 active patterns + active CausalChains + active DriftAlert
    + companionVoice.md tone (first-person plural, memory ref every 5th,
      + Supportive Challenge mode if AnchorMode-D active,
      + Two Doors structural rule if daily briefing context,
      + System-Disclosure mode if milestone-trigger,
      + Mentor-Tone framing always)
         ↓
  MultiHorizonLoader middleware (pre-LLM):
    past 7d events + next 7d plans both loaded
         ↓
  createReactAgent({
    llm: ChatGoogleGenerativeAI({ model: MODELS.pro /* gemini-3.1-pro-preview → gemini-3.5-pro when GA */, streaming: true }),
    tools: allTools (26, see Appendix C),
    stateModifier: systemPrompt + companionVoice + multiHorizonContext,
  })
         ↓
  agent.streamEvents({ messages: [...history, userMsg] })
         ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ Per LangGraph event:                                         │
  │  • on_tool_start  → SSE: tool_call (visible only in         │
  │                    Power-mode UI — §7.13)                    │
  │  • on_tool_end    → SSE: tool_result                         │
  │  • on_chat_model_stream → SSE: text_delta                    │
  │  • on_chain_end → APPLY POST-RESPONSE MIDDLEWARES (5):       │
  │     1. EvidenceCheck — every past ref has inline citation    │
  │     2. redundancyCheck — no already-answered question        │
  │     3. numericGroundingCheck — no hardcoded numbers          │
  │     4. ContinuityGate — min 1 explicit context ref present   │
  │     5. clinicalAdviceCheck — no Rx dose-change suggestion    │
  │        (NFR-CR-2 / NFR-CR-3, v2.0)                           │
  │     If any fail → re-prompt with violation summary, retry x1 │
  │     If second fail → log to SelfHealthCheck, deliver with    │
  │                      [degraded] flag                         │
  │  • SSE: done                                                 │
  └─────────────────────────────────────────────────────────────┘
         ↓
  Persist + embed both turns → pgvector
         ↓
  Post-turn classification step (companionAgent.ts):
    Three-way distinction (IDENT-1 refinement):
      detect rest signal       → AnchorMode-A trigger logic
      detect drift signal      → DriftAlert.create + AnchorMode-D + 
                                  surfacePatternOfAvoidance next turn
      detect value-evolution   → proposeGoalUpdate suggestion next turn
```

### 4.4 Companion voice prompt — `companionVoice.md`

> Lives at `supabase/functions/_shared/prompts/companionVoice.md` — loaded on every chat turn + briefing/memoir generators.

**Base rules** (from IDENT-1, brainstorm 2026-05-15):

1. **First-person plural** — "let's do this", "we noticed", never "you should"
2. **Memory reference every 5th message** — explicitly anchor to a past episode
3. **Iconic push notification style** — performance-framed, time-windowed, goal-anchored
   - Example: *"Idd meg a fehérjét + glutamint a következő 15 percben, mert tarolnod kell a röpi pályán"*
4. **Specificity-First** — never generic advice; always user-data-derived
5. **No hardcoded numbers** — every number derived from Daniel's logged data, with inline source citation
6. **Hallucination-grounded** — every past event reference has citation `[entity_kind:row_id]`
7. **Never-ask-twice** — non-volatile facts (height, allergies, partner's name) never re-asked
8. **Continuity gate** — every response contains min 1 explicit context reference

**v2.0 amendment mode blocks** (brainstorm 2026-05-17):

#### `[SUPPORTIVE_CHALLENGE_MODE]` (activates when AnchorMode-D / DriftAlert is active)

> Tone: relationship-based authority, never positional. The mentor naming a pattern through trust.

Example phrasings to draw from:
- "Hallom amit mondasz. ÉS — két hete is ezt mondtad. Lehet hogy van valami mélyebb dolog?"
- "Tényleg pihenés ez? Vagy van valami amit nem nézünk együtt?"
- "Ne haragudj de muszáj megkérdezzem — emlékszel mit beszéltünk három hete a {[pattern_ref]} kapcsán?"

**Guardrails**: NEVER blame. NEVER moralise. Always end with curiosity, not verdict.

#### `[TWO_DOORS_BRIEFING]` (structural rule for `generateDailyBriefing`)

Every morning briefing presents **two doors**:
- **Option A — Reflection door** — a question / journaling prompt for inner work
- **Option B — Action door** — a concrete time-windowed action

User taps a door to engage; ignoring both is also a valid signal (records as `briefing_no_engagement`, surfaces in pattern detection).

#### `[SYSTEM_DISCLOSURE_MODE]` (gated: activates on milestone-trigger only)

> *Rendszer-szerelem* anchor (PRD §2.6) — Daniel is receptive to seeing the mechanism behind the recognition.

When companion surfaces a newly confirmed `KnowledgeFact` or pattern, optionally self-disclose **how** it was detected:

- "Ezt úgy ismertem fel, hogy 47 nap tréning-adatból kovariáns elemzést csináltam {[metric_a]} és {[metric_b]} közt. Megmutassam a számítást?"

**Gated**: NOT on every turn. Only on (a) Tier-2 reward events (confirmed pattern), (b) Tier-3 reward events (QuarterlyMemoir generation), (c) explicit user request. **Phase 8 note**: depth must become user-profile-configurable (system-curious users get full disclosure; outcome-only users get summary).

#### `[MENTOR_TONE]` (always-on framing layer)

Explicit register: **not friend, not coach, not therapist — mentor with explicit reciprocity ritual**. Companion may push back via Supportive Challenge mode; companion may say "no" via `AdaptationBudget` gate; companion may surface drift via `surfacePatternOfAvoidance`. Always through relationship + trust, never positional authority.

Late-stage `IdentityStage` (stage 5-6) regiszter-shift to peer/mentor frame.

### 4.5 Chat response middlewares

Applied as follows. **5 post-LLM** + **1 pre-LLM**:

| Middleware | Phase in flow | Purpose | Source |
|---|---|---|---|
| **MultiHorizonLoader** | pre-LLM | Inject past 7d + next 7d context into system prompt | 2026-05-15 |
| **EvidenceCheck** | post-LLM #1 | Reject responses where past-event references lack inline DB citation | 2026-05-15 |
| **redundancyCheck** | post-LLM #2 | Reject if response asks a question already answered in L3 facts | 2026-05-15 |
| **numericGroundingCheck** | post-LLM #3 | Reject if response contains numbers not derived from Daniel data | 2026-05-15 |
| **ContinuityGate** | post-LLM #4 | Reject if response has zero explicit context references | 2026-05-15 |
| **clinicalAdviceCheck** | post-LLM #5 | Reject if response suggests a prescription-drug dose change or violates the clinical-positioning disclaimer (NFR-CR-2 / NFR-CR-3) | 2026-05-17 (v2.0) |

On any post-LLM failure: re-prompt LLM once with violation summary embedded. On second failure: log to `SelfHealthCheck` table, deliver response with `[degraded]` flag.

### 4.6 Companion Tools Catalog — 26 tools

Full table in **Appendix C**.

**Breakdown**: 19 read + 5 compute + 4 write = 28 numbered, 26 unique (compute/write doubled-numbered from v1).

**v1 tools (17 unchanged)** — `get_recent_sleep`, `get_recent_workouts`, `get_workout_volume_trend`, `get_recent_meals`, `get_recent_supplements`, `get_recent_medications`, `get_recent_check_ins`, `get_weight_trend`, `get_digestion_log`, `get_active_mesocycle`, `find_similar_past_days`, `get_knowledge_facts`, `get_active_patterns`, `compute_correlation`, `compare_periods`, `propose_pattern`, `reinforce_knowledge_fact`.

**Brainstorm 2026-05-15 tools (7)** — `recallSharedMemory`, `mirrorIdentity` (*v2.0: return-type extended — see below*), `proposeGoalUpdate`, `applyAgeAdjustment`, `getPersonalEffectiveness`, `proposeExperiment` (*v2.0: now gated by `AdaptationBudget`*), `optimizeForMood`, `getActiveNiggles`, `getEnvironmentToday`.

**Brainstorm 2026-05-17 tools (2)**:

| Tool | Type | Purpose | Phase |
|---|---|---|---|
| **`surfacePatternOfAvoidance`** | read+compute | Pull avoidance pattern themes when `DriftAlert` is active or rationalisation phrases recur in chat history. Returns `{ avoidance_pattern, occurrences, last_occurrence_at, rationalization_themes[] }`. | 7 |
| **`getResourceSnapshot`** | read | Return current values of all 4 Resource entities (`RecoveryCapital`, `CognitiveBandwidth`, `AdaptationBudget`, `RelationshipCredit`). Called before proposing any new Quest / Experiment / high-load activity (quest opt-in cost transparency — F3-#14). | 7 |

**`mirrorIdentity` v2.0 extension** (per Q2 design decision):
```jsonc
// existing args: { context: string }
// return-type extended in v2.0:
{
  identity_goals: IdentityGoal[],          // active goals (existing)
  current_stages: IdentityStage[],         // current IdentityStage per goal (NEW)
  next_stage_preview: string | null        // companion's optional preview of next stage (NEW)
}
```

This avoids tool-count proliferation; `mirrorIdentity` becomes the canonical identity-reflection surface.

### 4.7 Iterative Pattern Detection — LangGraph `StateGraph`

`generateAiHypotheses` Edge Function — Sunday 21:00 CET cron — runs StateGraph: gather_weekly_data → gather_l3_context → propose_hypotheses → critique_hypotheses → filter_by_verdict → [keep|revise|discard] → revise_hypotheses → persist_patterns.

4-factor critique scoring: 0.35 × statistical_support + 0.25 × confounders + 0.20 × l3_alignment + 0.20 × actionability. Verdict thresholds: ≥0.75 keep, ≥0.50 revise (max 1 iter), <0.50 discard.

Pattern types extended to detect Causal multi-step chains → persist as `CausalChain` entity. **v2.0**: pattern engine may additionally emit `DriftAlert` rows when a deviation pattern exceeds drift-threshold without legitimate `ContextEpoch` reason — see `driftDetector` (§5).

### 4.8 Embedding pipeline + pgvector setup

Single `embeddings` table as `vector(768)`, HNSW index (m=16, ef_construction=64), `vector_cosine_ops`, RLS user-scoped. Public catalog policy for FoodItem. Free-tier capacity: ~11MB/year single user.

**Model + dimension (decided 2026-05-25, bd `mezo-c30`)**: `gemini-embedding-001` @ `outputDimensionality: 768` (MRL). 768 loses only ~0.26% MTEB vs the 3072 default while using 25% storage; 1536 matches 3072 exactly (the 1536 upgrade path stays inside the 2000-dim `vector` HNSW ceiling, so 3072/`halfvec` is never needed). **Implementation note**: `gemini-embedding-001` does NOT auto-normalize sub-3072 outputs — the client must **L2-normalize** the 768-d vector before insert. Use `task_type` `RETRIEVAL_DOCUMENT` (store) / `RETRIEVAL_QUERY` (search). Rationale: `_bmad-output/planning-artifacts/research/technical-pgvector-dimension-research-2026-05-25.md`.

### 4.9 Master system prompt

Master prompt at `supabase/functions/_shared/prompts.ts` extended with `companionVoice.md` overlay. `{{KNOWLEDGE_FACTS}}` runtime substituted. New section `{{IDENTITY_GOALS}}` (top-3 active `IdentityGoal` + current `IdentityStage` per goal). New section `{{ACTIVE_DRIFT_ALERT}}` (if any open `DriftAlert` row).

### 4.10 Cost

Single user, v2: ~$5-6/month Gemini base + ~$1-2/month from 2026-05-15 additions (HeartbeatScheduler, weeklyMemoir, OpportunityScanner). v2.0 additions (clinicalAdviceCheck on every chat turn, driftDetector daily, resourceCalculator daily, generateMemoirCapsule event-triggered, quarterlyMemoir quarterly, detectCrisisIndicator on FreeNoteEntry) add ~$1-2/month, mostly absorbed by Flash-tier calls. Estimated total ~$8/month Gemini. Supabase Pro $25/month. Grand total ~$33/month.

### 4.11 Clinical-advice output classifier (NFR-CR-2)

`clinicalAdviceCheck` middleware (post-LLM #5) runs on every chat response, briefing, memoir, and inline insight. Classifies the response against a Hungarian-tuned rule set + Gemini Flash classifier:

- **Block triggers**: any explicit dose suggestion for a prescription-drug pattern (regex on med names + dose units + verbs like "vegyél", "emeld", "csökkentsd"). Architecture-level enforcement of NFR-CR-3.
- **Soft warnings**: medical claims without `PsychInsight` citation (downgraded to opinion phrasing in re-prompt).
- **Pass-through**: lifestyle / training / nutrition / supplement (non-Rx) suggestions.

On block: re-prompt with `[CLINICAL_GUARD_VIOLATION: <reason>]` system message; the model rephrases as observation + suggest professional consultation. On second block: log to `SelfHealthCheck` + deliver fallback message ("Ezt a részt jobban beszéld meg az orvosoddal — én csak megfigyeléseket tudok megosztani.")

### 4.12 Crisis indicator detection (NFR-CR-8)

`detectCrisisIndicator` triggered Edge Function — runs on every `FreeNoteEntry.create`. Gemini Flash classifier scores `crisis_indicator_score` (0-1) against Hungarian-tuned crisis-language patterns (suicidal ideation, self-harm references, acute medical emergency mentions).

- Score ≥ 0.7 → `AnchorMode-A` trigger (force-activate, override any other state) + professional-help banner ("Te szabsz tempót — de van itt egy szám amit hívhatsz: ..."). Crisis-helpline numbers configured via env (no hardcoded numbers in code).
- Score 0.4-0.7 → flag to `SelfHealthCheck` for review; no automatic UI change.
- Score < 0.4 → no action.

Output written to `FreeNoteEntry.crisis_indicator_score`.

### 4.13 v2.1 — ProvenanceEnvelope, new tools, meal-eval + volume-recompute (2026-05-23)

**Unified `ProvenanceEnvelope`** — the single provenance shape shared by tool-chips (FR-1.1.7), volume provenance (FR-2.2.12) and the meal score (FR-2.3.13). Form ships early (Phase 1-2) with honest-empty values; the live source fills it Phase 4+.

```ts
type ProvenanceEnvelope = {
  source: "user" | "sensor" | "ai-inference" | "external-api";
  toolCalls?: ToolCallRef[];   // Phase 4+ fills; [] until then
  confidence?: number | null;  // null = "learning"/unknown — NEVER a hardcoded number
  basis?: EvidenceRef[];       // causal-chain / multi-horizon refs (Phase 5+)
};
```

Rule (PRD §3.2 form/source split): the UI renders an honest "evidence-not-yet-available / still learning" state when `source !== "ai-inference"` or `confidence == null`. No fabricated numbers (IDENT-1, IDENT-4). `FR-1.3.5` graceful-degraded state is the offline/timeout branch.

**New companion tools (→ ~32; full catalog Appendix C)**

| Tool | Type | Purpose | Phase |
|---|---|---|---|
| `generateMesoPlan(goal, split, days)` | compute | propose a full mesocycle (FR-2.2.11); niggle + sport-cross aware | 4 |
| `rankByStimFatigue(muscle, candidates)` | compute | rank exercises by `stim`/`fatigue` for plan generation | 4 |
| `computeVolumeProvenance(meso, week)` | compute | derive VolumeTarget from baseline + typed adjustments → write VolumeComputation | 4 |
| `lookupNutrients(foodItem)` | read | nutrient/micro lookup (OpenFoodFacts / DB; AI estimation fallback, cached on FoodItem) | 3-4 |
| `classifyNOVA(foodItem)` | compute | per-ingredient NOVA 1-4 classification, cached on FoodItem | 3-4 |
| `predictGlycemicCurve(meal, context)` | compute | sophisticated postprandial glucose estimate (GI + macros + fiber + NOVA + timing + activity); informational only (NFR-CR-1) | 4-5 |

**Meal-evaluation pipeline (FR-2.3.13) — "deterministic core, AI at the edges".** Score 0-100, weighted, fully decomposable for the breakdown modal.

- **Layer 1 — deterministic (code, no LLM, instant):** macro/kcal fit (30%) from Meal macros vs targets; timing & context (20%) from meal timestamp × `GymSchedule` × Reta phase × sport-window. = 50%, shippable Phase 3 with real data.
- **Layer 2 — cached AI enrichment (LLM once per `FoodItem`, stored):** NOVA processing (25%) via `classifyNOVA` → `FoodItem.nova_class`; micro-balance (25%) via `lookupNutrients` → `FoodItem.micro_vector` vs `MicronutrientTarget`. Aggregated in code per meal — keeps meal-view off the LLM hot path.
- **Layer 3 — narrative (Gemini Flash, structured output via Zod responseSchema):** fed the already-computed sub-scores + gaps → companion-voiced summary + "could-be-better" suggestions ranked by score-impact. Cannot fabricate the number (numericGroundingCheck-safe); only explains it.
- **Score:** `0.30·macro + 0.25·micro + 0.25·nova + 0.20·timing` → `Meal.score`; per-dimension detail + `confidence` (= data completeness: % ingredients with known vs estimated data) + tool-chips → `Meal.score_breakdown`.
- **IDENT-1:** the breakdown + actionable suggestions convert the score from an opaque grade into observation + suggestion; the summary speaks companion-voice, never clinical grading.

**Volume-recompute pipeline (FR-2.2.13-14).** Triggered by NiggleEntry / SportSession / Pattern change (+ weekly cron). `computeVolumeProvenance` writes an append-only `VolumeComputation` (immutable `input_snapshot`); `VolumeTarget` repoints. A `VolumeOverride` is never silently discarded:

| current ↓ / incoming → | system recompute | AI recompute | user override |
|---|---|---|---|
| **no override** | apply, supersede | apply (L1, logged) | apply, write VolumeOverride |
| **active user override** | keep override; log skipped recompute | **do NOT auto-overwrite** → L2 approve card + companion message | replace override (append) |

Recompute over an active override is an **L2 decision** (FR-1.6.2): never auto-applied (IDENT-6 + IDENT-1).

---

## 5. Backend Functions — ~43 Edge Functions

```
supabase/functions/
├── _shared/
│   ├── geminiClient.ts
│   ├── prompts.ts
│   ├── prompts/companionVoice.md         # incl. Supportive Challenge / Two Doors / System-Disclosure / Mentor-Tone mode blocks
│   ├── schemas.ts
│   ├── structuredOutput.ts
│   ├── memoryBuilder.ts
│   ├── pgvectorClient.ts
│   ├── supabaseAdmin.ts
│   ├── langgraph/
│   │   ├── companionAgent.ts             # renamed from coachAgent.ts
│   │   ├── patternDetection.ts
│   │   ├── streamHandler.ts
│   │   ├── tracing.ts
│   │   └── middlewares/
│   │       ├── evidenceCheck.ts
│   │       ├── redundancyCheck.ts
│   │       ├── multiHorizonLoader.ts
│   │       ├── numericGroundingCheck.ts
│   │       ├── continuityGate.ts
│   │       └── clinicalAdviceCheck.ts    # NEW v2.0 (NFR-CR-2)
│   └── tools/                            # 26 tools (was 24)
│       ├── readTools.ts                  (19, was 18 — +getResourceSnapshot)
│       ├── computeTools.ts               (5, was 4 — +surfacePatternOfAvoidance, partly compute)
│       ├── writeTools.ts                 (4, unchanged)
│       └── registry.ts
│
├── ai/                                   # ~7 functions
│   ├── chat/                             (uses 26 tools now, 5 post-middlewares)
│   ├── generateDailyBriefing/            (Two Doors structural rule)
│   ├── generateWeeklyReport/
│   ├── getInlineInsight/
│   ├── suggestNextMesocycleWeek/
│   ├── detectAchievements/               (anti-D38 gating on real performance thresholds only)
│   └── generateRecipes/
│
├── ingestion/                            # 4 functions
│   ├── transcribeVoice/
│   ├── analyzeMealPhoto/
│   ├── scrapeProduct/
│   └── searchOpenFoodFacts/
│
├── checkin/                              # 2 functions
│   ├── recordCheckIn/
│   └── extractCheckInTopics/
│
├── memory/                               # 9 functions
│   ├── embedAndStore/
│   ├── dailyEmbeddingFlush/
│   ├── semanticSearch/
│   ├── runStatisticalAnalysis/
│   ├── generateAiHypotheses/
│   ├── promotePatternToKnowledge/
│   ├── reinforceKnowledgeFact/
│   ├── findSimilarPastDays/
│   └── buildContextForLLM/
│
├── meta/                                 # 1 function
│   └── exportUserData/
│
├── presence/                             # 2 functions (IDENT-3)
│   ├── heartbeatScheduler/               # cron, min 3 msg/day baseline (PRD §2.3)
│   └── opportunityScanner/               # 4×/day looking-ahead 6-24h
│
├── life/                                 # 5 + 4 functions (IDENT-5 PERMA + 2026-05-17)
│   ├── weeklyMemoir/                     # Sun evening narrative memoir
│   ├── anniversaryReflection/            # monthly/yearly milestone
│   ├── goalCoherenceCheck/               # weekly behavior vs goal drift
│   ├── financialStressDetector/          # weekly, Phase 6+
│   ├── dailyEnvironment/                 # Open-Meteo + AQI daily fetch
│   ├── quarterlyMemoir/                  # NEW v2.0 — quarterly cron OR DriftAlert-contingent
│   ├── driftDetector/                    # NEW v2.0 — daily cron, writes DriftAlert
│   ├── generateMemoirCapsule/            # NEW v2.0 — event-triggered (Achievement/IdentityStage/breakthrough)
│   └── resourceCalculator/               # NEW v2.0 — daily cron + on-event resource refresh
│
├── meta-ai/                              # 6 functions (chat infra)
│   ├── evidenceCheck/                    # middleware standalone callable
│   ├── redundancyCheck/                  # middleware standalone callable
│   ├── multiHorizonLoader/               # tool/middleware
│   ├── selfHealthCheck/                  # companion self-eval 24h
│   ├── effectivenessTracker/             # per-Daniel suggestion weighting
│   └── clinicalAdviceCheck/              # NEW v2.0 — middleware standalone (NFR-CR-2)
│
├── safety/                               # NEW — 1 function (v2.0, NFR-CR-8)
│   └── detectCrisisIndicator/            # trigger on FreeNoteEntry.create
│
└── compliance/                           # NEW — 1 function (v2.0, NFR-CR-7)
    └── deleteUserData/                   # GDPR right to erasure
```

### 5.1 New function specs (v2.0, 2026-05-17 brainstorm + PRD NFRs)

**`quarterlyMemoir`** (cron quarterly + DriftAlert-contingent, T2, Phase 7)
- Trigger: pg_cron 1st of Jan / Apr / Jul / Oct at 09:00 OR on `DriftAlert.create` (off-schedule)
- Input: `userId`, `quarter_start`
- Output: `QuarterlyMemoir` row + push notification (Mizu Velünk session invite, mentor-tanítvány framing per PRD §2.6)
- Why: 90-day deep narrative ritual — sister to weekly `CoachMemoirEntry`

**`driftDetector`** (cron daily 23:30, T1, Phase 7)
- Trigger: pg_cron 23:30 daily (after `runStatisticalAnalysis`)
- Input: `userId`
- Output: 0-N `DriftAlert` rows when multi-day deviation detected without legitimate `ContextEpoch` reason
- Effects on emit: activates `AnchorMode-D`; next chat turn surfaces `surfacePatternOfAvoidance` tool call; optionally triggers contingent `quarterlyMemoir`
- Why: IDENT-1 three-way distinction rest/drift/value-evolution — drift detection runs daily (not weekly via `goalCoherenceCheck`) so the companion catches drift on Day 3 not Day 10

**`generateMemoirCapsule`** (event-triggered, T2, Phase 7)
- Trigger: on `Achievement.create` OR `IdentityStage.create` OR breakthrough signal from `detectAchievements`
- Input: `userId`, trigger entity ref + kind
- Output: `MemoirCapsule` row; if within the current week, optionally weaves `capsule_id` into the next `weeklyMemoir` invocation
- Why: replaces "Achievement Unlocked!" toast with persistent narrative anchor (anti-D40)

**`resourceCalculator`** (cron daily 21:30 + on-event, T2, Phase 7)
- Trigger: pg_cron 21:30 daily + on heavy-event hooks (`WorkoutSession.create`, `SleepLog.create`)
- Input: `userId`
- Output: refreshed `RecoveryCapital`, `CognitiveBandwidth`, `AdaptationBudget`, `RelationshipCredit` rows
- Floor enforcement: `level` clamped to ≥ 0.05 (anti-D31)
- Why: companion needs current resource snapshot for quest opt-in cost transparency + `proposeExperiment` gating

**`clinicalAdviceCheck`** (middleware + HTTP, T1, Phase 4+)
- Trigger: every chat response, briefing, memoir, inline insight (middleware mode); standalone HTTP for testing
- Input: response text + entity refs
- Output: `{ verdict: "pass" | "soft_warn" | "block", reason: text | null, redacted_text: text | null }`
- Spec ref: PRD §7.8 NFR-CR-2 + NFR-CR-3
- Why: structural prohibition on Rx dose-change suggestions

**`detectCrisisIndicator`** (trigger on FreeNoteEntry.create, T1, Phase 5+)
- Trigger: postgres trigger on `FreeNoteEntry` insert
- Input: `freeNoteEntryId`
- Output: writes `crisis_indicator_score` (0-1) back to row + on score ≥0.7 activates `AnchorMode-A` + raises professional-help banner state
- Spec ref: PRD §7.8 NFR-CR-8

**`deleteUserData`** (HTTP, T1, Phase 8)
- Trigger: authenticated HTTP POST
- Input: `userId` (must match auth uid), confirmation token
- Output: hard-delete of all user rows across all 61 entities, including pgvector embeddings, AiConversation history, AiInsight, KnowledgeFact, etc.
- Audit: writes a `deletion_audit` row to a separate compliance table (retained for legal proof of deletion)
- Spec ref: PRD §7.8 NFR-CR-7 (GDPR right to erasure)

(Brainstorm 2026-05-15 functions `heartbeatScheduler`, `opportunityScanner`, `weeklyMemoir`, `anniversaryReflection`, `goalCoherenceCheck`, `financialStressDetector`, `dailyEnvironment`, `evidenceCheck`, `redundancyCheck`, `multiHorizonLoader`, `numericGroundingCheck`, `continuityGate`, `selfHealthCheck`, `effectivenessTracker` — specs unchanged from v1.0; see Appendix B for the consolidated reference.)

### 5.2 v2.1 new Edge Functions (2026-05-23)

| Function | Trigger | Purpose |
|---|---|---|
| `generateMesoPlan` | on-demand (planner) | full mesocycle proposal (FR-2.2.11) via `generateMesoPlan` + `rankByStimFatigue` |
| `classifyNOVA` | `FoodItem.create` | cache NOVA 1-4 per ingredient on `FoodItem.nova_class` |
| `lookupNutrients` | `FoodItem.create` / on-demand | nutrient + micro lookup (OFF / DB; AI estimation fallback) → `FoodItem.micro_vector` |
| `scoreMeal` | `Meal.create/update` | run the meal-eval pipeline (§4.13) → `Meal.score` + `score_breakdown` |
| `predictGlycemicCurve` | on-demand (meal breakdown) | sophisticated glycemic estimate; informational (NFR-CR-1) |
| `recomputeVolume` | NiggleEntry/SportSession/Pattern change + weekly cron | append `VolumeComputation`, repoint `VolumeTarget` (§4.13 matrix) |

→ ~48 Edge Functions total. NOVA/nutrient functions run at `FoodItem`-create time (cache), keeping meal-view off the LLM hot path.

---

## 6. Cron + Entity Automations

### 6.1 Cron schedule (Europe/Budapest)

```
04:00 daily          — selfHealthCheck
05:00 daily          — dailyEnvironment
06:00 daily          — heartbeatScheduler tick 1
06:30 daily          — generateDailyBriefing (Two Doors structural rule) + Morning CheckIn push
07:00 Mon            — goalCoherenceCheck weekly
08:00 daily          — opportunityScanner tick 1
09:00 1st-of-month   — anniversaryReflection
09:00 1st-of-quarter — quarterlyMemoir (NEW v2.0 — Jan/Apr/Jul/Oct 1st)
10:00 daily          — heartbeatScheduler tick 2 + Midday CheckIn push
14:00 daily          — heartbeatScheduler tick 3 + Afternoon CheckIn push
14:00 daily          — opportunityScanner tick 2
18:00 daily          — opportunityScanner tick 3
19:30 Sun            — weeklyMemoir
20:00 daily          — heartbeatScheduler tick 4 + Evening CheckIn push
20:00 Sun            — generateWeeklyReport
20:30 Sun            — embed weekly report
21:00 daily          — dailyEmbeddingFlush
21:00 Sun            — generateAiHypotheses
21:30 daily          — resourceCalculator (NEW v2.0)
21:30 Sun            — suggestNextMesocycleWeek
22:00 daily          — opportunityScanner tick 4
23:00 daily          — runStatisticalAnalysis
23:30 daily          — driftDetector (NEW v2.0)
Mon 06:00            — mesocycleWeekStart (volume reset)
Weekly Sun           — financialStressDetector (Phase 6+)
```

### 6.2 Entity event automations

```
ExerciseSet → detectAchievements (anti-D38 thresholding)
CheckIn → extractCheckInTopics
WorkoutSession update → embedAndStore + resourceCalculator refresh (NEW v2.0)
AiConversation update → embedAndStore both turns
Pattern validated → promotePatternToKnowledge
MedicationDose for Retatrutide → 48h pattern detection window
Recommendation.create → push notification (if state=sent)
Recommendation.update (state=acted|skipped) → effectivenessTracker queue
CausalChain.create (validated) → optional knowledge_fact promotion
Prediction.create → scheduled PredictionOutcome reminder at prediction_horizon_hours
NiggleEntry.create (active) → flag in next workout planning + Companion system prompt
IdentityGoal.update → invalidate cached system prompts for user
Event.create (importance >= 4) → schedule prep_protocol trigger 3d before
ContextEpoch.start → invalidate cached system prompts, load expected_adjustments
Achievement.create → generateMemoirCapsule (NEW v2.0)
IdentityStage.create → generateMemoirCapsule (NEW v2.0)
SleepLog.create → resourceCalculator refresh (NEW v2.0)
DriftAlert.create → activate AnchorMode-D + trigger surfacePatternOfAvoidance next chat turn + optional contingent quarterlyMemoir (NEW v2.0)
FreeNoteEntry.create → detectCrisisIndicator (NEW v2.0)
```

---

## 7. Design System (Mezo v2 — locked 2026-05-16/17)

> **Canonical visual reference**: `_bmad-output/planning-artifacts/design-system.html` (locked 2026-05-17, 22-component primitive catalog). All token values + visual states rendered in browser-openable HTML.
>
> **Single source of truth for tokens in code**: `src/theme/tokens.ts` (TypeScript canonical) + `src/index.css` `@theme {…}` directive (Tailwind 4 CSS-first).

### 7.1 Color tokens

#### Brand — Deep Current 5-step (renamed 2026-05-17 from "Clinical Teal"; hex unchanged)

| Token | Hex | Use |
|---|---|---|
| `--color-brand-deep` | `#064E5B` | hero card accent stripe; AnchorMode base derivative |
| `--color-brand-core` | `#0E7C7B` | primary CTA gradient pair |
| `--color-brand-primary` | `#14B8A6` | primary CTA fill, active tab indicator |
| `--color-brand-glow` | `#5EEAD4` | highlight, em-text, tab-active glow (9.4:1 AAA vs canvas) |
| `--color-brand-tint` | `#CCFBF1` | light-surface accent (rare) |
| `--on-brand` | `#FFFFFF` | text on brand-primary/core |
| `--text-inverse` | `#0A0F14` | text on brand-glow/tint |

#### Cold canvas + surfaces (Companion-mode default)

| Token | Hex | Layer |
|---|---|---|
| `--color-canvas` | `#0A0F14` | L0 |
| `--color-surface-1` | `#121A22` | L1 static |
| `--color-surface-2` | `#1A242E` | L1.5 elevated |
| `--color-surface-glass` | `rgba(255,255,255,0.04)` | L2 glass |

#### Warm derivative palette (Memoir / Anniversary / AnchorMode / Sunday-memoir / Forgotten-Mention / Event-prep)

| Token | Hex | Note |
|---|---|---|
| `--color-canvas-warm` | `#1A1410` | warm L0 |
| `--color-surface-1-warm` | `#221C16` | warm L1 *(2026-05-22 mezo-77w.23: was `#241C18`)* |
| `--color-warm-surface-2` | `#2A241D` | warm L2 *(2026-05-22 mezo-77w.24: added)* |
| `--color-accent-warm` | `#D97757` | supportive terracotta (replaces brand-glow in warm contexts; warning collision avoided — mezo-77w.25) |
| `--color-warm-text` | `#F3F4F6` | text-primary remap in warm mode *(2026-05-22 mezo-77w.24)* |
| `--color-warm-deep` | (derived: brand-deep desaturated 30%) | warm hero accent stripe |

**Phase 0 device-test gate**: ✅ **passed 2026-05-17** (Daniel manual verification — bd `mezo-5u6`). `#D97757` on `#1A1410` measured ≥4.5:1 on iPhone.

#### Text (3-step)

| Token | Hex | Contrast vs canvas | Use |
|---|---|---|---|
| `--text-primary` | `#E5E7EB` | 15.5:1 AAA | body, headings *(2026-05-22 mezo-77w.22: was `#ECECF1`)* |
| `--text-secondary` | `#9CA3AF` | 7.0:1 AAA | secondary labels |
| `--text-tertiary` | `#7E848F` | 5.05:1 AA (canonical WCAG) | eyebrows, captions, low-emphasis chrome *(2026-05-22 mezo-77w.21: was `#6B7280` 3.98:1 AA fail; warm-canvas residual ~4.6:1 tracked under mezo-zif)* |

#### Semantic

| Token | Hex | Use |
|---|---|---|
| `--success` | `#34D399` | success state |
| `--warning` | `#F59E0B` | warning state, stale fact, AI-estimated disclaimer; also Reta-phase Day 4-5 segment |
| `--error` | `#F43F5E` | error state |
| `--info` | `var(--color-brand-glow)` | informational |

**Anti-pattern guard**: `--warning` / `--error` MUST NOT be used in `AnchorMode-A` context (supportive palette only).

#### Border

| Token | Value |
|---|---|
| `--border-subtle` | `rgba(255,255,255,0.06)` |
| `--border-strong` | `rgba(255,255,255,0.12)` |

#### 4 sub-palettes (Step-1c audit)

1. **Pattern-category** — 6 tokens (`physiology`, `preference`, `trigger`, `response`, `tendency`, `goal_state`) — hex TBD pre-Phase-4 implementation; AA-min constraint (≥4.5:1 on canvas at ≥14pt).
2. **Tool-transparency** — `read` = ghost border (`--border-strong`) + brand-text (`--color-brand-primary`), no fill; `compute` = reduced-opacity `--warning` fill; `write` = `--color-brand-glow` fill.
3. **Reta-phase 7-segment** — Day 1 = `--color-brand-primary`; Day 2-3 = brand-primary → brand-core gradient; Day 4-5 = `--warning`; Day 6-7 = `--text-tertiary`.
4. **AnchorMode supportive** — warm derivative (`--color-canvas-warm` + `--color-warm-deep` accent). NEVER `--warning` / `--error`.

### 7.2 Typography

Three families (Google Fonts CDN, Phase 1 preconnect):
- **Antonio** — condensed bold, display/headline
- **Inter** — body sans-serif
- **JetBrains Mono** — tabular numerals, `font-feature-settings: "tnum"`

**Antonio narrative-chrome boundary** (Paige R9, locked v2):
- **Title-Case** in narrative-bearing hero contexts (briefing hero, memoir, anniversary, PRCelebrationOverlay)
- **UPPERCASE** in chrome only (tab labels, section eyebrows, metric eyebrows, status pills)

| Role | Family | Size | Weight | Line-height (v2) | Tracking | Case |
|---|---|---|---|---|---|---|
| Display | Antonio | 40 | 600 | **1.1** (v1: 1.0) | +0.005em | Title-Case / UPPER per context |
| Headline | Antonio | 30 | 600 | **1.1** (v1: 1.05) | +0.005em | Title-Case / UPPER per context |
| Title-LG | Antonio | 22 | 600 | **1.15** (v1: 1.1) | +0.01em | UPPER (pure chrome) |
| Title | Antonio | 18 | 600 | **1.2** (v1: 1.15) | +0.01em | UPPER or Title-Case |
| Body | Inter | 16 | 400 | 1.5 | 0 | Sentence |
| Label | Inter | 14 | 600 | 1.4 | 0 | Sentence |
| Caption | Inter | 12 | 700 | 1.33 | +0.12em | UPPER |
| Mono | JBM | 18 | 500 | 1.22 | -0.01em | natural |

Line-height adjustments (v2): Hungarian double-acute (ő, ű) collision risk on iPhone Safari mitigated.

**Body minimum**: 16px enforced (NFR-A baseline). **Dynamic Type**: `clamp(14px, 1rem, 22px)` body; `clamp(28px, 7vw, 48px)` Antonio display.

**Phase 0 device-test gate** (✅ **passed 2026-05-17**, Daniel manual verification — bd `mezo-5u6`): Antonio at sizes 40/30/22/18 rendering test on iPhone with strings *"TÁPLÁLKOZÁS"*, *"EGY NEHÉZ HETÜNK"*, *"PR-PRÓBA CHEST ROW-ON"* — PASS (no ő/ű clipping). Warm canvas contrast — PASS (≥4.5:1 measured).

### 7.3 Spacing

9 tokens, 8pt grid + 4px specialty:

| Token | px | Tailwind |
|---|---|---|
| `--space-xs` | 4 | `gap-1` |
| `--space-sm` | 8 | `gap-2` |
| `--space-md` | 12 | `gap-3` |
| `--space-lg` | 16 | `gap-4` |
| `--space-xl` | 24 | `gap-6` |
| `--space-2xl` | 32 | `gap-8` |
| `--space-3xl` | 40 | `gap-10` |
| `--space-4xl` | 48 | `gap-12` |
| `--space-5xl` | 64 | `gap-16` |

**Rule**: internal padding ≤ external margin for any component pair.

### 7.4 Elevation (5 layers — L4 added in v2)

| Layer | Shadow | Use |
|---|---|---|
| L0 Canvas | none | page background |
| L1 Static | `0 1px 0 var(--border-subtle)` | cards |
| L2 Glass | `0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)` + `backdrop-filter: blur(24px) saturate(180%)` | BottomTabBar, BriefingCard, glass overlays |
| L3 Floating | `0 12px 32px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)` | FAB, PRCelebrationOverlay, achievement-notif |
| L4 Modal (NEW v2) | `0 24px 48px rgba(0,0,0,0.45), 0 12px 24px rgba(0,0,0,0.3)` | modal sheet, AnchorMode full-screen, WeeklyPlanApprovalSheet |

### 7.5 Notched chamfer (3 sizes — NOTCHED_4 added in v2)

`clip-path` 45° diagonal cuts. Positive-action variant: top-left + bottom-right. Negative-action variant: top-right + bottom-left.

- **`NOTCHED_4`** (4px) — ToolChip only (Phase 4+, Power-mode opt-in)
- **`NOTCHED_8`** (8px) — status tags, mid-size buttons, mini-slots (default)
- **`NOTCHED_12`** (12px) — large CTAs, primary buttons, hero cards

### 7.6 Motion tokens (NEW in v2)

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | `160ms` | tap feedback, micro-interactions, ToolChip expand |
| `--dur-med` | `240ms` | standard transitions |
| `--dur-slow` | `360ms` | PRCelebrationOverlay fade-in, memoir "breathe" (scale 0.98→1.0), AnchorMode entrance |
| `--ease` | `cubic-bezier(0.2, 0, 0, 1)` | standard easing |

**Reduced-motion override**: `@media (prefers-reduced-motion: reduce)` collapses all `--dur-*` to 40ms linear. PRCelebrationOverlay, MemoirCard, AnchorMode render instantly with animation disabled. KnowledgeGraph force-directed layout uses precomputed static positions.

### 7.7 Dual-mode visual (NEW in v2)

Mezo has **two visual modes**, governed by React Context (NOT prop drilling). Components do not accept a `warm` prop; instead they read `<DualModeContext>` to determine which canvas/surface/accent token set to use.

#### When cold canvas (Companion-mode default)
- Today (daily briefing, weekday)
- Train (workout flow)
- Fuel (macro/meal tracking)
- Insights → Chat
- Insights → Patterns (Power-mode)

#### When warm derivative activates
- Insights → Memoir tab (full canvas swap)
- Anniversary cards (monthly / yearly via `anniversaryReflection`)
- AnchorMode crisis-state overlay (full canvas swap)
- Forgotten Mention recovery moments (Phase 5+)
- Pre-event prep T-day briefing (`Event.create importance >= 4`)
- Sunday memoir-delivery briefing (subtle: accent-stripe only on BriefingCard hero, NOT full canvas)

**Anti-pattern guard**: warm-mode NEVER applied to Today (weekday) / Train / Fuel / Chat.

#### Warm-mode token override list

When warm context is active, ONLY these tokens are overridden:

| Cold token | Warm override |
|---|---|
| `--color-canvas` | `--color-canvas-warm` (`#1A1410`) |
| `--color-surface-1` | `--color-surface-1-warm` (`#221C16`) *(2026-05-22 mezo-77w.23)* |
| `--color-surface-2` | `--color-warm-surface-2` (`#2A241D`) *(2026-05-22 mezo-77w.24)* |
| `--color-text-primary` | `--color-warm-text` (`#F3F4F6`) *(2026-05-22 mezo-77w.24)* |
| `--color-brand-glow` (as accent) | `--color-accent-warm` (`#D97757`) |
| `--color-brand-deep` | `--color-warm-deep` |
| info border-left (Pattern 2 feedback) | `--color-accent-warm` |
| active filter chip / tab indicator | `--color-accent-warm` |
| focus ring | `--color-accent-warm` (2px ring) |

`--text-*` and semantic tokens (`--success` / `--warning` / `--error`) are NOT overridden.

#### Implementation contract

`src/index.css`:

```css
.warm-mode {
  --color-canvas: var(--color-canvas-warm);
  --color-surface-1: var(--color-surface-1-warm);
  --color-brand-glow: var(--color-accent-warm);
  --color-brand-deep: var(--color-warm-deep);
}
```

The class is applied by a `<DualModeProvider>` to the root element or a section container. Components consume tokens via Tailwind utility resolution — no per-component conditional logic.

### 7.8 Token-implementation contract

Single canonical chain:
1. **`src/theme/tokens.ts`** — TypeScript canonical export; master source of all token values
2. **`src/index.css`** — Tailwind 4 `@theme {…}` directive block; cold-mode tokens + `.warm-mode { ... }` override class

Exact `@theme` structure (UX spec §13.5, verbatim):

```css
@theme {
  --breakpoint-sm: 375px;
  --breakpoint-md: 393px;
  --breakpoint-lg: 430px;

  --color-brand-primary: #14B8A6;
  --color-brand-glow: #5EEAD4;
  --color-canvas: #0A0F14;
  --color-warm-canvas: #1A1410;
  --color-warm-accent: #D97757;  /* 2026-05-22 mezo-77w.25: was #F59E0B (warning collision) */
  /* (full token list in src/index.css; abbreviated here) */

  --font-display: "Antonio", "Helvetica Neue Condensed Bold", sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Courier New", monospace;

  --dur-fast: 160ms;
  --dur-med: 240ms;
  --dur-slow: 360ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);
}
```

**Hard governance rules**:
- No component-level hex/rgba color literals in JSX — ESLint `no-restricted-syntax` rule
- No design-token framework (Style Dictionary, Token Studio) — tokens owned in-codebase, no extra build step
- `src/components/ui/` shadcn baseline NEVER edited directly — wrap in `mezo/` layer
- No 3rd-party UI kits (Tremor, NextUI, Aceternity)
- Tailwind 4 CSS-first (`@theme` directive), NOT JS config

### 7.9 22-component primitive catalog (locked v2)

> All 22 components numbered in `design-system.html` §Section 09. Implementation contract: each component lives at `src/components/mezo/<ComponentName>.tsx`; shadcn baselines (where wrapped) live at `src/components/ui/<kebab-name>.tsx`. Visualization components live at `src/components/viz/`.

| # | Component | Purpose | Screens | Phase |
|---|---|---|---|---|
| 1 | **MezoButton** | primary / secondary / text / FAB; NOTCHED_8/12; wraps shadcn `button.tsx` | all | 1 |
| 2 | **NotchTag** | status tag, filter chip, category pill; NOTCHED_8 | all | 1 |
| 3 | **Icon** | 24×24 custom SVG set; tab + functional icons | all | 1 |
| 4 | **MezoCard** | base card container, L1 surface; wraps shadcn `card.tsx` | Today / Train / Fuel / Insights / Me | 1 |
| 5 | **TextInput** | form input with voice-fallback sibling; wraps shadcn `input.tsx` | global | 1 |
| 6 | **Typography-sample** | design-system reference component only | (DS reference) | 1 |
| 7 | **BottomTabBar** | 5-tab glass L2, fixed bottom | all | 1 |
| 8 | **SubNav** | Insights 7-tab row (Patterns / Weekly / Memoir / Knowledge / Chat / Predictions / Experiments); scrollable | Insights | 4 |
| 9 | **RetaPhaseBar** | 7-segment gradient strip, Day 1-7 peak-to-trough | Today + Fuel header | 5 |
| 10 | **SetLogger** | weight/reps steppers + RIR chip-row + set-dot progress; ≤4 taps per set; RP tri-question FeedbackModal trigger | Train | 2 |
| 11 | **MacroHero** | kcal + 3 macro progress bars | Fuel | 3 |
| 12 | **HydrationChip** | water intake quick-log inline in MacroHero | Fuel | 3 |
| 13 | **NiggleWidget** | body-region tap-map pre-workout flag | Train pre-workout | 2-3 |
| 14 | **QuickInputSheet trigger** | FAB + bottom-anchored sheet; voice-first primary (120×120 mic); photo/chips/number/text secondary | global | 1 |
| 15 | **ToolChip** (Power-mode) | "🔧 tool_name(args)" chip; color-coded read/compute/write; NOTCHED_4; opt-in only (§7.13) | Insights→Chat | 4 |
| 16 | **PatternCard** (v2) | mechanism expander + AI reasoning expander + 4-factor critique micro-bars + category-color stripe + CausalChain visual + Confirm/Monitor/Reject (§7.12) | Insights→Patterns | 4 |
| 17 | **ChatRefsRow** | ref-tag footnote row below assistant bubble; `[entity_kind:row_id]` rendered via `CitationResolver` | Insights→Chat | 4 |
| 18 | **PlanRibbonBanner** | L1 single-line mid-week replan ribbon | Today | 5 |
| 19 | **MemoirCard** (warm-mode) | 1-paragraph narrative + 4 reactions (like/love/save/dismiss) + 3-5 anchor entity chips | Insights→Memoir | 4-5 |
| 20 | **AnchorModeBanner** | full-canvas warm-mode crisis-state overlay; A vs D differentiation; 3 minimum rituals | global | 5 |
| 21 | **PRCelebrationOverlay** | 60-70% viewport persistent overlay-card with backdrop dim; memory-anchored copy + tnum stat; **NOT a toast** (Sally R8) | Train | 4 |
| 22 | **KnowledgeGraph node** | D3 / react-force-graph node representation; flat-list-default with graph-toggle | Me→Knowledge Graph | 4-5 |

**Companion modules** (not numbered but architecture-relevant):
- **`CitationRef` / `CitationResolver`** module — `src/lib/citationResolver.ts`; Phase 1 stub (renders `[entity_kind:row_id]` as plain chip), Phase 4 full (clickable → entity drawer)
- **`DualModeProvider`** — `src/lib/dualMode.tsx`; React Context for warm-mode token swap
- **`PERMANarrativeAnchor`** — narrative-injection block; PERMA dimensions surface via companion narrative, NOT as a 5-dimension widget
- **`ResourceDashboardWidget`** (Phase 7) — 4-gauge composite (Recovery / Cognitive / Adaptation / Relationship) — uses gauge primitive TBD Phase 7
- **`StatDimensionDisplay`** (Phase 7) — 5 élő amplitude dimensions (Tartósság / Türelem / Jelenlét / Bátorság / Tisztaság); resonance visual TBD Phase 7 — explicitly NOT progress bar
- **`IdentityStageNarrativeCard`** (Phase 7) — replaces 5-level progression bar; shows current stage as companion-authored sentence
- **`TwoDoorsSessionCard`** (Phase 4+) — daily briefing Option A (reflection) + Option B (action) presentation
- **`QuarterlyMemoirReader`** (Phase 7) — full-screen / modal reader for `QuarterlyMemoir`; reactions identical to MemoirCard
- **`Quest3StageLifecycleView`** (Phase 7) — micro-experiment lifecycle: Felvezetés → Kontingens check-in → Retrospect
- **`PatternDetectionRevealDrawer`** (Phase 4+) — system-transparency reward; companion explains HOW it detected a pattern (Rendszer-szerelem anchor)
- **`PRStoriedHall`** (Phase 7) — replaces flat PR list with `PRStory` narrative-first scroll
- **`WeeklyPlanApprovalSheet`** (Phase 4-5) — Heti Brief swap-pattern instrumentation

### 7.10 Brand voice guidelines (consolidated)

`companionVoice` tone-of-voice rules + UX spec §Brand voice section. Lives at `supabase/functions/_shared/prompts/companionVoice.md` AND mirrored as a design-system documentation section.

Core rules (existing v1.0 + v2.0 amendments):
- First-person plural always
- Memory reference every 5th message
- Iconic push: performance-framed + time-windowed + goal-anchored + aspirational verb
- Specificity-First: no generics, all advice user-data-derived
- No hardcoded numbers
- Hallucination-grounded citations: `[entity_kind:row_id]` inline
- Epistemic humility canonical: companion expresses uncertainty when data thin ("Még nem látok elég adatot — de mintha…")

v2.0 mode-block additions (full text in §4.4):
- Supportive Challenge mode (relationship-based authority, not positional)
- Two Doors structural rule (daily briefing default)
- System-Disclosure mode (Rendszer-szerelem anchor, milestone-gated)
- Mentor-Tone framing (not friend, not coach, not therapist)

**Naming governance**: "Mezo Coach" → "Mezo" (IDENT-1 alignment). String-sweep mandated across all surfaces — chat header, push notifications, briefing voice, marketing copy.

### 7.11 Accessibility lockdowns (NEW in v2)

**Compliance target**: WCAG 2.2 AA (NOT AAA in Phase 1-7).

#### Contrast ratios (measured, UX spec §13.3.1)

| Pair | Ratio | Verdict |
|---|---|---|
| `text-primary` `#E5E7EB` on `#0A0F14` canvas | 15.5:1 | AAA *(2026-05-22 mezo-77w.22: was `#ECECF1` 13.5:1)* |
| `text-secondary` `#9CA3AF` on canvas | 7.0:1 | AAA |
| `text-tertiary` `#7E848F` on canvas | 5.05:1 | AA (canonical WCAG) *(2026-05-22 mezo-77w.21: was `#6B7280` 3.98:1 AA fail; warm-canvas residual ~4.6:1 tracked under mezo-zif)* |
| `--color-brand-primary` on canvas | 7.2:1 | AAA |
| `--color-brand-glow` on canvas | 9.4:1 | AAA |
| `--color-brand-glow` on `--color-brand-primary` fill | 1.3:1 | **FAIL** — never use as button text on brand-primary fill; use `#0A0F14` (7.2:1) instead |
| `--warning` `#F59E0B` on canvas | 9.1:1 | AAA |
| `--warning` on `--color-canvas-warm` `#1A1410` | 8.7:1 | AAA |
| `--color-accent-warm` `#D97757` on `--color-canvas-warm` | Phase 0 device-test required | ≥4.5:1 minimum |

#### Touch targets (NFR-A-2)

All interactive elements ≥44×44pt hit area (visual size may be smaller; padding extends hit-area). 8pt minimum between adjacent hit-zones (WCAG 2.5.8).

| Component | Visual | Hit-area |
|---|---|---|
| MezoButton default | 48pt | 48pt ✓ |
| MezoButton sm | 32pt | 44pt via padding ✓ |
| NotchTag | 28pt | 44pt via padding ✓ |
| ToolChip | 24pt | 44pt via padding ✓ |
| QuickInputSheet voice button | 64×64pt (oversized primary) | 64×64pt ✓ |
| BottomTabBar icon | full 56×75pt cell tappable | ✓ |

#### Focus rings

2px ring + 2px offset on `:focus-visible` only (NOT `:focus`):
- Cold mode: `--color-brand-glow` ring
- Warm mode: `--color-accent-warm` ring

#### Reduced motion

`@media (prefers-reduced-motion: reduce)` → all `--dur-*` → 40ms linear. PRCelebrationOverlay, MemoirCard, AnchorMode render instantly. KnowledgeGraph uses precomputed static layout (no force simulation).

#### Hungarian VoiceOver (NFR-A-4)

- `<html lang="hu">` root
- Antonio UPPERCASE chrome text → `sr-only` Title-Case duplicate for VoiceOver pronunciation
- JBM numeric `aria-label` in natural-language Hungarian: `aria-label="huszonöt kiló"` for "25 kg"
- Citation chips: `aria-label="hivatkozás a múlt heti edzésre"` for `[workout:abc123]`
- No nested clauses >2 levels deep in companion copy

#### Other rules

- Color is NEVER the sole carrier of meaning — every color-communicating state has a non-color cue (icon, text, shape)
- axe-core in CI + Lighthouse a11y ≥95 gate on every PR touching pages or `mezo/` components (Phase 1+)

### 7.12 PatternCard v2 spec (NEW in v2)

Component #16 in catalog. Lives at `src/components/mezo/PatternCard.tsx`.

**Layout (locked v2)**:
- Left-edge 3px **category-color stripe** (physiology / preference / trigger / response / tendency / goal_state — pattern-category sub-palette)
- Top row: category `NotchTag` + confidence bar (Architecture §4.7 criteria) + Confirm / Monitor / Reject action row
- Title: Antonio Title-Case (narrative-bearing context per Paige R9)
- Body: Inter Body 16 — mechanism summary

**Expandable sections** (UX spec §B.5 + Architecture §4.7):
- **Mechanism expander** — body shows the causal-chain explanation in plain language
- **AI reasoning expander** — "gondolatmenete" (reasoning chain used to generate the hypothesis)
- **4-factor critique micro-bars**:
  1. `statistical_support` — sample size / strength
  2. `confounders` — competing explanations accounted for
  3. `l3_alignment` — consistency with existing L3 KnowledgeFacts
  4. `actionability` — whether Daniel can act on this pattern
- **CausalChain step visual** — for `CausalChain` pattern type: 4-5-step horizontal chain (e.g., *Reta Day 3 → appetite suppression → lower caloric intake → recovery deficit → RPE +1.2*)

**L2 decision surface**:
- Confirm → promotes pattern to `KnowledgeFact` (L3); companion acknowledges in next briefing
- Monitor → keeps in Pattern Inbox for more data accumulation
- Reject → flags as wrong; seeds negative-reinforcement for the hypothesis generator

### 7.13 ToolChip Power-mode opt-in contract (NEW in v2)

Component #15 in catalog. Lives at `src/components/mezo/ToolChip.tsx`.

**Trigger**: Appears as a chip-row before each assistant bubble in Insights → Chat. **Hidden by default** (Companion-mode). Visible **only** when Power-mode context is active.

**Format**: `🔧 tool_name(args)` — one chip per tool call in the turn.

**Three visual variants (color-coded by tool type)**:
- `read` — ghost border + brand-text (cold `--color-brand-primary` text, `--border-strong` outline, no fill)
- `compute` — low-intensity `--warning` fill (reduced opacity)
- `write` — `--color-brand-glow` fill

**Chamfer**: `NOTCHED_4` (4px) — only ToolChip uses this tightest chamfer size.

**Hit area**: 24pt visual height, padded to 44pt hit-area (NFR-A-2).

**Interaction**: Tap → Power-mode expand via shadcn `ui/popover` → shows full tool arguments + return value. This is the opt-in engineering view per UX spec Step-4 Principle #5 (quiet competence in Companion-mode; engineering transparency in Power-mode).

**Motion**: `--dur-fast` 160ms on expand/collapse.

**Progressive disclosure contract** (party-mode R1 "AI-nerd lobster" ruling): ToolChip row is NEVER ambient default. Ambient default = zero tool-chip visibility. Power-mode is an explicit opt-in at the chat session level (not a global setting).

### 7.14 PRCelebrationOverlay (NEW in v2)

Component #21 in catalog. Sally R8 explicit change vs. v1.0:

- **NOT a toast** — was originally specified as a transient notification
- **IS** a 60-70% viewport overlay-card with backdrop dim, **persistent until user dismisses**
- L3 elevation
- Memory-anchored copy: "Tavaly augusztusban {[previous_pr_value]} volt — ma {[current_pr_value]}. Csendben szakadt rólad. Csak megjegyzem."
- tnum stat-emphasis (JetBrains Mono Display)
- Animation: `--dur-slow` 360ms fade-in with scale 0.98→1.0; `prefers-reduced-motion` collapses to instant render
- Dismiss: tap anywhere on backdrop or dedicated "OK" button

### 7.15 v2.1 design tokens + components (2026-05-23)

**`design-system.html` is superseded by `frontend_design/`** as the canonical visual reference (PRD §4.4). New token families (add to `src/index.css` @theme):

- **Reta gradient:** `--reta-d1 … --reta-d7` (7-day kinetic cycle bar)
- **AnchorMode warm:** `--anchor-canvas`, `--anchor-surface`, `--anchor-text`, `--anchor-accent`
- **Pattern/category sub-palette (6):** `--cat-physiology`, `--cat-preference`, `--cat-trigger`, `--cat-response`, `--cat-tendency`, `--cat-goal-state`
- **Notch scale:** `notch-4 / notch-8 / notch-12` (standard 3-step scale; supersedes the NOTCHED_4/8 pair)
- **Fuel-slot taxonomy:** `KIND_META` (wake / meal / midday / snack / preworkout / workout / sport / evening) — color + icon per slot

**Token resync (decision 2026-05-23, bd MEZO-token-resync).** The token layer is NOT phaseable: editing `@theme` shifts every shipped primitive at once. The resync is a single non-phaseable task gating Phase 3, covered by snapshot tests on existing primitives — explicit exception to the "no rebuild" rule (Decision #3).

**New components (prototype → brand / viz layer):**

| Component | Layer | Notes |
|---|---|---|
| `ToolChipRow` + provenance/confidence badge | mezo | renders `ProvenanceEnvelope`; honest-empty state; **always-on default (C4)** |
| `MealScoreBreakdown` (modal) | mezo | 4-dimension breakdown + confidence + summary + suggestions + tool-chips |
| `MesocyclePlanner` (4-step wizard) | mezo | goal → length+phase-curve → split+days → AI program review |
| `VolumeProvenanceCard` | mezo | baseline→adjustments→result + confidence + "Felülír" (FR-2.2.12-14) |
| Sport views (week/log/cross-load) + `SportLogSheet` | mezo | §8.9 |
| Fuel `Timeline` + `StashCard` | mezo | Terv / Stash |
| `ChallengeCarousel` + `ChallengeCard` | mezo | FR-4.5 (companion-voiced; skip=no-penalty; niggle-aware) |
| Knowledge graph | viz | `react-force-graph` (NOT the prototype's hand-rolled sim — §8.11) |

FLOOR-retained (prototype simpler — keep arch): `PRCelebrationOverlay` (overlay, not toast — C1), AnchorMode-D drift (C2), Two-Doors briefing (C3), CausalChain viz in PatternCard (C5).

---

## 8. UX Architecture Per Screen

> User journeys live in PRD § 5 — this section captures design-decisions only.

The 5 bottom-tab pages remain: **Today / Train / Fuel / Insights / Me**. Plus modal overlays: **AnchorMode** (global, full-canvas), **QuickInputSheet** (FAB-triggered bottom sheet), **PRCelebrationOverlay** (Train workout success).

Visual references (open in browser to match): `_bmad-output/planning-artifacts/design-system.html`, `ux-component-library-v2.html`, `ux-screen-mockups-v2.html`, `ux-design-directions-v2.html`.

### 8.1 Today

**Layout**:
- Wordmark + actions
- Date eyebrow (JBM Mono caption)
- State-tag row (NotchTag NOTCHED_8 — e.g., "Reta D3", "Mesocycle MEV W2", active niggle flags)
- **BriefingCard** hero (glass L2, 3px Deep Current accent stripe, Antonio Title-Case headline, Inter Body 16 paragraph, citation chips, confidence bar)
- **Heartbeat strip** — 4 slots, 4-state semantics: pending / heartbeat-delivered / user-responded / skipped
- **Today plan-slice card** (Phase 4+, mid-week replan ribbon via `PlanRibbonBanner` L1 if applicable)
- Primary CTA
- **QuickInputSheet** FAB (bottom-right, Phase 1+, IDENT-4)
- **RetaPhaseBar** at the top (Phase 5+)

**Data**: `AiInsight` row (pre-cached by 06:30 cron), `SleepLog`, `NiggleEntry.active`, Reta-cycle day, `MesocycleWeek` position, `Plan` slice (Phase 4+).

**State variants**:
- Cold-default (Mon-Sat)
- Subtle-warm Sunday memoir-delivery briefing (accent-stripe only on BriefingCard hero)
- Subtle-warm Anniversary briefing (when `anniversaryReflection` ran)
- Subtle-warm Event-prep T-day briefing (`Event.importance >= 4`, 3d before)
- Full-warm AnchorMode override (replaces Today layout entirely)

**Two Doors briefing structural rule** (Phase 4+, via `TwoDoorsSessionCard`): every morning briefing presents reflection door + action door.

### 8.2 Train

**Phase 2-3 home**: MesocycleWeek CRUD + WorkoutSession log.
**Phase 4-5 home**: Heti Brief — full-screen weekly Plan (Step-9 D1 direction chosen via `WeeklyPlanApprovalSheet`).

**Active workout**: exercise card + `SetLogger` (weight/reps/RIR/set-dots) + RP tri-question FeedbackModal + **niggle-aware substitution ribbon** (inline warning ribbon, non-alarming affordance — *"⚠ Right shoulder active → exercise swap suggested"*).

**On PR**: `PRCelebrationOverlay` (60-70% viewport persistent overlay-card, NOT toast — §7.14).

**v2.0 amendment**:
- `WorkoutSession.create` triggers `resourceCalculator` refresh
- `Achievement.create` triggers `generateMemoirCapsule` → `MemoirCapsule` woven into next `weeklyMemoir` + linked via `Achievement.pr_story_id` to a freshly generated `PRStory`

### 8.3 Fuel

**Layout**: `MacroHero` (kcal + 3 macros + progress bars) + `HydrationChip` (Phase 3) + meal cards + Fuel-specific quick-add row (coexists with global QuickInputSheet FAB).

**`RetaPhaseBar` at TOP** (Phase 5+) — Reta phase directly affects caloric floor, hence positioned above MacroHero.

Kitchen-close T-2h push visualization integrated into layout.

### 8.4 Recipe Maker

Unchanged from v1. Phase 6+ implementation. Mockup reference deferred.

### 8.5 Insights — 7-tab sub-nav

`SubNav` component (#8) scrollable, 7 tabs:

1. **Patterns** — `PatternCard` v2 with mechanism + AI reasoning + 4-factor critique + CausalChain visual + Confirm/Monitor/Reject (L2 decision surface, §7.12)
2. **Weekly** — `generateWeeklyReport` cards
3. **Memoir** (NEW v2.0-aware) — `MemoirCard` (warm-mode) + `AnniversaryCard` variant; filterable by year / theme; reactions like/love/save/dismiss
4. **Knowledge** — link to Me → Knowledge Graph page; quick top-20 fact list inline
5. **Chat** — companion (was "Mezo Coach") message bubble; **ToolChip Power-mode opt-in only** (§7.13); `ChatRefsRow` citation grammar; 26 tools; SSE streaming with `BriefingCard` typing-indicator
6. **Predictions** (Phase 4-5) — `Prediction` + `PredictionOutcome` accuracy tracking
7. **Experiments** (Phase 6+) — `Experiment` + `ExperimentReport`; companion-proposed vs. user-initiated via `Experiment.source` discriminator; `AdaptationBudget` gauge inline

### 8.6 Me

**Layout**: profile hero + integrations + mesocycle library + export.

**Sub-sections**:
- **Profile** (Phase 1) — basic info + `Streak` mini-stat (no dedicated UI widget — anti-D27 / D38)
- **IdentityGoal section** (Phase 4+) — 1-3 active `IdentityGoal` cards; `reflected_count` consumed by `mirrorIdentity` tool, NEVER surfaced as UI progress bar
- **PERMA section** (Phase 5+) — narrative-injected `PERMANarrativeAnchor`; NEVER as 5-dimension widget
- **Knowledge Graph** (Phase 4-5):
  - **DEFAULT view**: flat-list (category-grouped fact cards via 4 pattern-category sub-palette tokens) — Step-9 D4 lockdown, v2.0 FLIP from v1.0 "force-directed default"
  - Toggle: "View as graph →" → force-directed visualisation (D3.js or react-force-graph); nodes pulse `--color-brand-glow` on new fact; edges grow on `reinforcement_count++`; Phase 5 precomputed layout for iPhone Safari CPU
  - Fact cards: `include_in_prompt` toggle, stale/deprecated dimmed, related-fact edge tags
- **Motivation System (Phase 7)** — replaces v1.0 GamificationWidgets entirely:
  - `IdentityStageNarrativeCard` (replaces 5-level progression bar)
  - `StatDimensionDisplay` (5 élő amplitude dimensions; NEVER progress bar)
  - `ResourceDashboardWidget` (4-gauge Recovery / Cognitive / Adaptation / Relationship)
  - `PRStoriedHall` (replaces flat PR list)
  - `QuarterlyMemoirReader` link

### 8.7 AnchorMode (NEW global modal in v2)

Global UI state (not a screen); replaces Today layout entirely. Warm-mode palette active at canvas level. 3 minimum rituals + supportive companion voice.

**AnchorMode-A (acceptance)**:
- Trigger: sleep <5h × 3d OR energy <3 × 5d OR illness/life-event flag OR user-flagged OR `detectCrisisIndicator` score ≥0.7
- Visual: dim non-essentials, surface only 3 daily anchors (hydrate / 1 meal / 1 walk)
- Tone: supportive ("Csak ennyit ma. Tegnap is itt voltunk")
- FAB hidden; tab bar hidden
- Exit: 7 consecutive days above recovery threshold

**AnchorMode-D (drift)**:
- Trigger: `DriftAlert.create` (via `driftDetector` daily cron)
- Visual: presence-preserving (no dimming), but adds companion-initiated **supportive challenge** surface; differentiated color/tone from AnchorMode-A
- Tone: gentle naming ("Látom hogy szunyókálsz mostanában. Tényleg pihenés ez, vagy van valami amit nem nézünk együtt?")
- Tab bar visible (presence preserved)
- Required: `surfacePatternOfAvoidance` tool invoked on next chat turn
- Exit: drift pattern resolves with new identified intent (user acknowledgement OR companion-named resolution)

**Anti-pattern enforcement**: warning/error tokens NEVER used in either mode (UX spec §1c sub-palette rule).

### 8.9 Sport (NEW screen, v2.1)

Train sub-nav gains **Sport** (week / log / cross-load):
- **Week:** recurring sport schedule, today highlight, per-session intensity.
- **Log:** `SportSession` list (RPE, shoulder-strain, sets, duration, jump count); `SportLogSheet` capture (≤3 taps / voice).
- **Cross-load:** `SportTransferRule` surface — volleyball load fanning into Train volume / Fuel / Sleep / Weight, with tool-chips (`get_sport_load`, `computeMuscleLoadCarryover`, `applySportTransferRule`).

### 8.10 v2.1 screen updates + FLOOR resolutions

- **Train:** add `MesocyclePlanner` (4-step), `VolumeProvenanceCard` (MesoVolume: baseline→adjustments→result + confidence + override), niggle-aware prep, `ChallengeCarousel` (pre-workout, FR-4.5).
- **Fuel:** add `Timeline` (Terv: meal+supplement protocol, kinetic window, caffeine cutoff, kitchen close), `StashCard` (inventory + low-stock), per-meal `score` + `MealScoreBreakdown` modal, micronutrient weekly tracker.
- **Goals / Me:** `WeightGoal` hero (target/rate/projection + linked mesocycles); PERMA stays narrative (full UI Phase 5).
- **Tool-transparency:** `ToolChipRow` always-on by default across screens (C4 — prototype wins; quieter variant if noisy, never hidden).
- **FLOOR resolutions:** keep arch depth where it exceeds the prototype — **C1** `PRCelebrationOverlay` (60-70% overlay, NOT the prototype toast), **C2** AnchorMode-D drift (prototype has only -A), **C3** Two-Doors briefing, **C5** CausalChain viz in PatternCard. Ceiling rule: arch-extra survives only if additive AND mountable in the prototype.

### 8.11 Prototype Contract Boundary

The `frontend_design/` prototype is the **visual + interaction contract**, NOT an implementation contract. Forbidden prototype patterns in production code:

| Prototype pattern | Production replacement | Reason |
|---|---|---|
| `dangerouslySetInnerHTML` (markdown) | `react-markdown` + `rehype-sanitize` | XSS / OWASP A03 (overrides visual contract) |
| hand-rolled SVG force-sim | `react-force-graph` (§4 stack) | maintainability + stack rule |
| `window.*` globals + inline `MezoData` | TanStack Query / React state + schema-driven providers | §5 state rule; testability |
| hardcoded confidence/score numbers | `ProvenanceEnvelope` (null when unknown) | IDENT-1/4 — no fabricated values |

Visual output stays byte-faithful; implementation conforms to the stack.

### 8.12 Modal-stack z-index contract (Phase 4.6 / mezo-z6p.1.5)

Two bottom-sheet surfaces can be simultaneously open in normal use: `QuickInputSheet` (globally mounted in `AppLayout.tsx` — IDENT-4 capture FAB) and `CheckInModal` (route-local on Today — 4×/day check-in). To prevent visual collisions and guarantee the topmost sheet receives focus + tap dismissal, both surfaces pin their content stacking layer explicitly (SHELL-I-01, SHELL-M-02):

| Surface | SheetContent z-index | Mount scope | Rationale |
|---|---|---|---|
| `QuickInputSheet` | `z-40` | global (AppLayout) | base capture layer; lives BENEATH any task-specific modal |
| `CheckInModal` | `z-50` | route-local (Today) | task-specific 4×/day check-in; content visually overlays QuickInput when both are open |

Implementation: Tailwind `last-wins` class order on each consumer's `SheetContent className` overrides the shadcn baseline (`z-50`). The `ui/sheet.tsx` baseline is treated as CDP-1 read-only (per `scripts/lint-shadcn-readonly.mjs`); the `SheetOverlay` backdrop stays at the shadcn default `z-50` for both sheets — DOM mount-order resolves the natural backdrop layering between two simultaneously-open sheets (later-mounted overlay sits visually atop the earlier one, which matches user intent: the most-recently-opened modal claims the foremost backdrop).

Closing the topmost sheet (CheckInModal) MUST reveal the underlying QuickInputSheet intact — Radix Dialog portals are independent, so no portal collapse occurs naturally; this is verified by `src/components/mezo/modal-stack.test.tsx` (4.6.A.5).

Future modal layers (e.g. AnchorMode-A overlay) extend this contract above `z-50` via explicit content-class pinning at their own component boundary.

---

## 9. Secrets & Environment Configuration

```bash
# Required Phase 4+ (AI layer)
GEMINI_API_KEY=...                    # Google AI Studio key
LANGCHAIN_API_KEY=...                 # OPTIONAL — LangSmith tracing
LANGCHAIN_PROJECT=mezo-dev            # or mezo-prod
LANGCHAIN_TRACING_V2=true             # only if LANGCHAIN_API_KEY is set

# Phase 5+ (brainstorm 2026-05-15)
OPEN_METEO_USER_AGENT="Mezo/1.0"      # for dailyEnvironment function

# Phase 5+ safety (v2.0, NFR-CR-8)
CRISIS_HELPLINE_HU="06 1 116 123"     # Hungarian Suicide Prevention Hotline (or current best resource)
CRISIS_HELPLINE_INTERNATIONAL="..."   # fallback if user is abroad (per ContextEpoch)

# Phase 7+
OPENFOODFACTS_USER_AGENT="Mezo/1.0"
SENTRY_DSN=...

# Set via Supabase CLI:
supabase secrets set GEMINI_API_KEY=... --project-ref <project-ref>
supabase secrets set LANGCHAIN_API_KEY=... --project-ref <project-ref>
supabase secrets set CRISIS_HELPLINE_HU="..." --project-ref <project-ref>
```

**Env split**: `mezo-dev` and `mezo-prod` Supabase projects.

Frontend env (`.env.local`):
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public anon key, RLS-protected>
```

---

## Appendix A: Entity Field Reference (61 entities)

> **v1 entities (26)**: per-field schemas migrated from old spec § 4 (lines 237-933). For full per-field detail of `User`, `Mesocycle`, `MesocycleWeek`, `MuscleGroupVolumeLog`, `WorkoutSession`, `Exercise`, `ExerciseSet`, `MuscleGroupFeedback`, `ExerciseJointPainFeedback`, `Achievement`, `FoodItem`, `Meal`, `MealItem`, `Recipe`, `SupplementIntake`, `Medication`, `MedicationDose`, `SleepLog`, `WeightLog`, `DigestionLog`, `CheckIn`, `PriceHistory`, `AiInsight`, `AiConversation`, `Pattern`, `KnowledgeFact` — see `_bmad-output/prd/_archive/mezo-prd-v1-hybrid.md` § 4 (authoritative field-level reference until this doc absorbs it).
>
> **v2.0 amendment** to v1 entities: `Achievement` gains `pr_story_id: uuid | null` (FK → PRStory).
>
> **v2 entities (25 from 2026-05-15)**: full per-field schemas in §3.3 H-M above.
>
> **v2 entities (10 from 2026-05-17)**: full per-field schemas in §3.5 N-P above.

**TODO v2.1**: absorb v1 entity schemas inline here so old spec can be archived.

---

## Appendix B: Edge Function Reference (43 functions)

| # | Function | Trigger | Input | Output | Phase | Source |
|---|---|---|---|---|---|---|
| 1 | `chat` | HTTP SSE | userMsg, conversationId | SSE stream + persisted convo | 4 | v1 |
| 2 | `generateDailyBriefing` | cron 06:30 | userId | AiInsight row + push (Two Doors structural rule) | 4 | v1 |
| 3 | `generateWeeklyReport` | cron Sun 20:00 | userId | AiInsight row + push | 5 | v1 |
| 4 | `getInlineInsight` | HTTP | scope | AiInsight row | 4 | v1 |
| 5 | `suggestNextMesocycleWeek` | cron Sun 21:30 | userId | MesocycleWeek row | 5 | v1 |
| 6 | `detectAchievements` | trigger | ExerciseSet | Achievement row (anti-D38 gated) | 2 | v1 |
| 7 | `generateRecipes` | HTTP | constraints | 3 Recipe candidates | 6 | v1 |
| 8 | `transcribeVoice` | HTTP | audio blob | typed entity hint | 7 | v1 |
| 9 | `analyzeMealPhoto` | HTTP | image | identified items | 7 | v1 |
| 10 | `scrapeProduct` | HTTP | URL | FoodItem row | 3 | v1 |
| 11 | `searchOpenFoodFacts` | HTTP | barcode/name | OFF passthrough | 3 | v1 |
| 12 | `recordCheckIn` | HTTP | check-in form | CheckIn row | 1 | v1 |
| 13 | `extractCheckInTopics` | trigger | CheckIn | topics + sentiment | 4 | v1 |
| 14 | `embedAndStore` | internal | text + ref | embeddings row | 4 | v1 |
| 15 | `dailyEmbeddingFlush` | cron 21:00 | userId | embeddings rows | 4 | v1 |
| 16 | `semanticSearch` | internal | query vector | top-k rows | 4 | v1 |
| 17 | `runStatisticalAnalysis` | cron 23:00 | userId | Pattern rows | 5 | v1 |
| 18 | `generateAiHypotheses` | cron Sun 21:00 | userId | Pattern rows (iter) | 5 | v1 |
| 19 | `promotePatternToKnowledge` | HTTP | pattern_id | KnowledgeFact | 5 | v1 |
| 20 | `reinforceKnowledgeFact` | trigger | evidence | fact++ | 5 | v1 |
| 21 | `findSimilarPastDays` | internal | description | top-k days | 4 | v1 |
| 22 | `buildContextForLLM` | internal | userId | system prompt | 4 | v1 |
| 23 | `exportUserData` | HTTP | userId | GDPR export | 8 | v1 |
| 24 | `heartbeatScheduler` | cron 4×/day | userId | 0-1 push (min 3/day baseline, fail-silent) | 4 | 2026-05-15 |
| 25 | `opportunityScanner` | cron 4×/day | userId, window | 0-2 recs | 4 | 2026-05-15 |
| 26 | `weeklyMemoir` | cron Sun 19:30 | userId | CoachMemoirEntry | 4-5 | 2026-05-15 |
| 27 | `anniversaryReflection` | cron monthly/yearly | userId | reflection card | 5 | 2026-05-15 |
| 28 | `goalCoherenceCheck` | cron Mon 07:00 | userId | drift score + write | 5 | 2026-05-15 |
| 29 | `financialStressDetector` | cron weekly | userId | flag + push | 6+ | 2026-05-15 |
| 30 | `dailyEnvironment` | cron 05:00 | lat/lng | EnvironmentSnapshot | 5 | 2026-05-15 |
| 31 | `evidenceCheck` | middleware + HTTP | response, refs | validation result | 4 | 2026-05-15 |
| 32 | `redundancyCheck` | middleware + HTTP | response, L3 | validation result | 4 | 2026-05-15 |
| 33 | `multiHorizonLoader` | middleware (pre-LLM) + HTTP | userId | past 7d + next 7d | 4 | 2026-05-15 |
| 34 | `numericGroundingCheck` | middleware | response | validation result | 4 | 2026-05-15 |
| 35 | `continuityGate` | middleware | response | validation result | 4 | 2026-05-15 |
| 36 | `selfHealthCheck` | cron 04:00 | userId | self-eval audit | 4 | 2026-05-15 |
| 37 | `effectivenessTracker` | weekly + on-recs | userId | weights | 5+ | 2026-05-15 |
| 38 | **`quarterlyMemoir`** | cron quarterly + DriftAlert-contingent | userId, quarter_start | QuarterlyMemoir row + push | 7 | **v2.0 (2026-05-17)** |
| 39 | **`driftDetector`** | cron daily 23:30 | userId | 0-N DriftAlert rows | 7 | **v2.0 (2026-05-17)** |
| 40 | **`generateMemoirCapsule`** | event-triggered | userId, trigger ref | MemoirCapsule row | 7 | **v2.0 (2026-05-17)** |
| 41 | **`resourceCalculator`** | cron daily 21:30 + on-event | userId | 4 Resource* rows refreshed | 7 | **v2.0 (2026-05-17)** |
| 42 | **`clinicalAdviceCheck`** | middleware + HTTP | response | block/soft_warn/pass verdict | 4+ | **v2.0 (PRD NFR-CR-2)** |
| 43 | **`detectCrisisIndicator`** | trigger on FreeNoteEntry.create | freeNoteEntryId | crisis_indicator_score + AnchorMode-A trigger if ≥0.7 | 5+ | **v2.0 (PRD NFR-CR-8)** |
| 44 | **`deleteUserData`** | HTTP (auth) | userId, confirm_token | hard-delete all user rows + audit | 8 | **v2.0 (PRD NFR-CR-7)** |

---

## Appendix C: Companion Tool Reference (26 tools)

**Read tools (19)**:

| # | Tool | Args (Zod) | Return | Source |
|---|---|---|---|---|
| 1 | `get_recent_sleep` | `{ days: 1-30 }` | SleepLog[] + summary | v1 |
| 2 | `get_recent_workouts` | `{ days: 1-30, muscle_group? }` | WorkoutSession[] + aggregates | v1 |
| 3 | `get_workout_volume_trend` | `{ muscle_group, weeks: 4-12 }` | MuscleGroupVolumeLog series | v1 |
| 4 | `get_recent_meals` | `{ days: 1-7, macro_focus? }` | Meal[] + aggregates | v1 |
| 5 | `get_recent_supplements` | `{ days: 1-7 }` | SupplementIntake[] | v1 |
| 6 | `get_recent_medications` | `{ days: 1-30 }` | MedicationDose[] | v1 |
| 7 | `get_recent_check_ins` | `{ days: 1-7, topic_filter? }` | CheckIn[] + topic freq | v1 |
| 8 | `get_weight_trend` | `{ weeks: 4-26 }` | WeightLog[] + smoothed + delta | v1 |
| 9 | `get_digestion_log` | `{ days: 1-7 }` | DigestionLog[] | v1 |
| 10 | `get_active_mesocycle` | `{}` | Mesocycle + current week | v1 |
| 11 | `find_similar_past_days` | `{ description, k: 3-10 }` | pgvector top-k | v1 |
| 12 | `get_knowledge_facts` | `{ topic_filter? }` | KnowledgeFact[] top-20 | v1 |
| 13 | `get_active_patterns` | `{ category? }` | Pattern[] proposed+validated | v1 |
| 14 | `recallSharedMemory` | `{ theme }` | past episode entity refs | 2026-05-15 |
| 15 | `mirrorIdentity` (extended v2.0) | `{ context }` | `{ identity_goals: IdentityGoal[], current_stages: IdentityStage[], next_stage_preview: string | null }` | 2026-05-15, extended **v2.0** |
| 16 | `getPersonalEffectiveness` | `{ suggestion_type }` | weight + history | 2026-05-15 |
| 17 | `getActiveNiggles` | `{}` | NiggleEntry[] active | 2026-05-15 |
| 18 | `getEnvironmentToday` | `{}` | EnvironmentSnapshot today | 2026-05-15 |
| 19 | **`getResourceSnapshot`** | `{}` | `{ recovery_capital, cognitive_bandwidth, adaptation_budget, relationship_credit, computed_at }` | **v2.0 (2026-05-17)** |

**Compute tools (5)**:

| # | Tool | Args (Zod) | Return | Source |
|---|---|---|---|---|
| 20 | `compute_correlation` | `{ metric_a, metric_b, window_days }` | r + p + n + sample | v1 |
| 21 | `compare_periods` | `{ metric, period_a, period_b }` | delta + t_stat | v1 |
| 22 | `applyAgeAdjustment` | `{ metric, age }` | adjusted default | 2026-05-15 |
| 23 | `optimizeForMood` | `{ target_dimension }` | actionable recommendations | 2026-05-15 |
| 24 | **`surfacePatternOfAvoidance`** | `{ timeframe_days: 1-30 }` | `{ avoidance_pattern, occurrences, last_occurrence_at, rationalization_themes[] }` | **v2.0 (2026-05-17, §F2-A51)** |

**Write tools (4)**:

| # | Tool | Args (Zod) | What it does | Source |
|---|---|---|---|---|
| 25 | `propose_pattern` | `{ description, evidence, confidence, mechanism }` | Pattern row → inbox | v1 |
| 26 | `reinforce_knowledge_fact` | `{ fact_id, evidence_summary }` | fact++ | v1 |
| 27 | `proposeGoalUpdate` | `{ drift_evidence }` | IdentityGoal update suggestion | 2026-05-15 |
| 28 | `proposeExperiment` (gated v2.0) | `{ hypothesis, goal_alignment }` | Experiment row, **gated by AdaptationBudget.level** — refuses when budget depleted (IDENT-1 protection, anti-D34) | 2026-05-15, gated **v2.0** |

**Total numbered 28 — 26 unique tools.** (Two cross-category overlaps: `surfacePatternOfAvoidance` is classified primarily as compute but also reads; `getResourceSnapshot` is read-only but exposed as a single aggregator.)

**Tool boundary** (unchanged, IDENT-2):
- No DELETE, no auth/profile mutation, no cron trigger, no external-actor (no email, calendar write, purchase, third-party messaging)
- No payment / transaction tools (anti-D3 / D34)
- All audit-logged in `AiConversation.messages[].tool_calls`
- RLS + explicit `created_by` filter in tool body
- Rate limit: 10 calls/turn (LangGraph recursionLimit), 50/min/user

---

## Deferred specs (v2.0)

Items the brainstorm + UX spec explicitly defer; must be locked before Phase 7 implementation stories can be written:

| # | Item | Defer-to | Source |
|---|---|---|---|
| D1 | `AdaptationBudget.slots_total` formula | Phase 7 design | Brainstorm §F3-#12 |
| D2 | `StatDimension` amplitude computation formula (5 dimensions × source entities mapping) | Phase 7 design | Brainstorm §F3-#18 |
| D3 | `IdentityStage` transition threshold (when does `mirrorIdentity` surface a new stage?) | Phase 7 design | Brainstorm §F3-#17, §F3-#24 |
| D4 | `PRStory.voice_tone` formula (fixed vs PR-magnitude-varying vs IdentityStage-varying) | Phase 7 design | Brainstorm §F3-#20 |
| D5 | `RelationshipCredit` regen/decay formula | Phase 7 design | Brainstorm §F3-#13 |
| D6 | Pattern-category sub-palette hex values (6 tokens) | Phase 4 design | UX spec Step-1c |
| D7 | `ResourceDashboardWidget` gauge primitive visual | Phase 7 design | Brainstorm §F3-#14 |
| D8 | `TwoDoorsSessionCard` morning briefing layout details | Phase 4 design | Brainstorm §F2-A53, §F3-#16 |
| D9 | Phase 8 self-disclosure depth user-profile-detection logic (Rendszer-szerelem generalisation) | Phase 8 | PRD §2.6 |
| D10 | Voice STT provider (Gemini-native vs Whisper API vs Web Speech) | Phase 4-end | PRD §8.4 |
| ~~D11~~ | ✅ RESOLVED 2026-05-25 (bd `mezo-c30`): `gemini-embedding-001` @ 768-dim, `vector(768)` + HNSW, L2-normalized. See research doc + §4.8. | — | — |
| D12 | LangSmith Cloud vs Helicone proxy for prod tracing | Phase 4-end | PRD §8.3 |

---

*End of Mezo Architecture v2.0. Companion to PRD v2.0.2. Locked 2026-05-17. Next phase: `bmad-create-epics-and-stories` for Phase 1 against this architecture + PRD §3 success criteria.*
