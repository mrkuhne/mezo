---
title: Set-Volume Landmarks (failure vs volume styles, session cap)
type: concept
updated: 2026-08-02
tags: [train, technique]
related:
  - ../entities/jeremy-ethier.md
  - ../../features/train.md
sources:
  - raw/transcripts/2026-08-02-ethier-fastest-20lb-muscle.md
confidence: medium
contradictions: []
---

# Set-Volume Landmarks — failure vs volume styles, weekly ranges, session cap

The evidence-based dosing rules for weekly hypertrophy set volume, as synthesized by **Jeremy
Ethier** from **Dr. Mike Zourdos**'s meta-analyses and **Jake Remmert**'s per-session
meta-regression ([extraction notes](../raw/transcripts/2026-08-02-ethier-fastest-20lb-muscle.md)).
These numbers are the direct source of mezo's **planning-time set-budget layer**
([`train.md` §4](../../features/train.md), `frontend/src/features/train/logic/setBudget.ts`).

## The two styles and their productive weekly ranges (per muscle group)

| Style | Proximity to failure | Productive range | mezo mapping |
|---|---|---|---|
| **Intensity ("failure")** | every set to true mechanical failure (RIR 0) | **5–12 sets/week** | `targetRIR ≤ 1` → 🔥, weekly cap **12** |
| **Volume** | stop 2–3 reps short (RIR 2–3) | **12–20 sets/week** | `targetRIR ≥ 2` → 🌿, weekly cap **20** |

- The hypertrophy difference between the styles is marginal ("a few millimeters" — Zourdos);
  **adherence should decide**. Styles can be **mixed per muscle group** (Ethier: failure for
  arms/back, volume for legs) — which is why mezo prices a mixed week as a **budget**
  (`failureSets/12 + volumeSets/20`, over-limit when > 1) rather than a single cap.
- Supporting evidence in the source: elite naturals average **~12 sets/muscle/week**; per-set
  returns diminish steeply after ~5 weekly sets; training 1–2 reps from failure roughly
  **doubles** growth vs stopping ~8 reps short; all-sets-to-failure at high volume backfires via
  downstream fatigue.

## The per-session cap and the frequency fix

- **~10–11 sets per muscle per session** is where within-session returns tap out (Remmert).
  mezo warns strictly above **11** working sets/muscle-group/day.
- The same weekly volume split across **≥2 sessions/week** may speed gains by **up to ~30%** —
  the session-cap warning therefore says "oszd el két napra", not "csinálj kevesebbet".

## Confidence & caveats

- Popular-education synthesis of real research (Zourdos lab, Remmert meta-regression), not a
  primary source → `confidence: medium`. The specific numbers (12/20/11, +30%) are the video's
  presentation of the underlying analyses, unverified against the papers themselves.
- The video's nutrition/sleep clusters are captured in the same raw notes but are NOT part of this
  concept; the sleep claims overlap the existing [Walker cluster](qqrt.md).
- Relation to mezo's **MEV/MAV/MRV** engine: deliberately separate layers — the budget is a
  planning-time sanity check; the RP-style landmark engine handles in-cycle progression (decision
  D4 in the [2026-08-01 spec](../../superpowers/specs/2026-08-01-set-budget-unified-editor-design.md)).
