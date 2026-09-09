# Train — Neon Forge prototype

Date: 2026-09-09 · Driver: mezo-i18d · Direction approved in conversation.

## Goal

A clickable Hungarian game-like visual exploration of the Train daily overview,
workout logging and completion. Dark ink, electric lime, violet and cyan; custom
dimensional SVG equipment, energy crystals and reward chests; patterned background,
animated progress and action-triggered reward bursts.

## Scope and architecture

Standalone browser prototype under `prototypes/train-neon-forge/`, served by any
static HTTP server. No production routing, backend calls or real user data.
ES modules separate pure mock state transitions, SVG art and DOM presentation.
An in-memory state persists across the three views; refreshing or resetting starts
the demo again. Local session storage is deliberately unnecessary for this exploration.

## Interaction

Daily overview shows today's strength quest, weekly streak, currency, level,
muscle skills and daily challenges. Start opens a three-exercise, nine-set workout.
Each validated set records weight and repetitions, grants 35 XP and 5 coins, and
starts a skippable rest countdown. Completion opens a recap; claiming the chest
grants 200 XP and 60 coins exactly once and reveals a level-up when earned.
Returning to the overview updates all derived totals and quest states. Skill
details and a cosmetic shop are clickable; the shop spends only mock currency.

## Validation

Node tests prove logging validation, exact workout volume, no logging after finish,
one-time rewards and insufficient-funds handling. Browser verification covers the
full flow, reset and responsive layout. Motion respects reduced-motion preferences.

## Implementation sequence

The durable task and execution status live in Beads (mezo-i18d). Implement the
tested state model, SVG asset library, responsive three-view UI and animation
choreography; then verify the browser flow, record results and push a self-PR.
This document records the approved design, not a production gamification change.
