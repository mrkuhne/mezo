# Three exploratory Mezo UX prototypes

Driver: mezo-88jw.2. Scope approved by Daniel on 2026-09-08: build three substantial mock prototypes before choosing an art direction, then iterate visually. Approval is for exploration, not production migration.

## Goal

Compare precise data-led Mérték, warm guided Ritmus, and immersive character-led Liget through the same actual tasks and data. Each has Nap, Edzés, Fuel, Mezo and Chat, plus a working Avatar Lab character. Differences must include composition, hierarchy, imagery and motion.

## Architecture and state

Standalone React/Vite application in docs/design_3.0/prototypes. A common local mock state and navigation shell supplies independent per-direction state, browser-history back, saved scroll and contextual headers. No production API calls, credentials, user health data or production frontend changes. Core workflow transitions are tested before implementation. Variant modules compose the same API with distinct art direction; detailed flows and avatar runtime are integrated by the root agent. Exact interface: ../../design_3.0/prototypes/CONTRACT.md.

## User journeys

Open day → choose next action → start workout → complete sets → finish → summary. Fuel → search meal → choose food → log → updated totals. Mezo → inspect evidence → confirm observation → contextual chat. Daily routine completion, water quick log, weekly summary, sleep view and journal broaden the comparison. Chat replies are scripted and visibly identified as such. Avatar states can be explored directly and respond to actions.

## Avatar

Use the actual Bible Strong Avatar Lab React/core packages with a custom coral Orb-derived definition. Preserve clear third-party provenance and licensing in the isolated prototype. Include portable avatar definition and state showcase. No claim that a SVG logo was automatically imported or that a studio project format is supported unless verified.

## Validation and delivery

Test meaningful state transitions, build the standalone app, inspect all fifteen main variant/page combinations, exercise workout/food/chat/back navigation, check mobile overflow and reduced motion. Provide a comparison launcher and individual URLs in the Codex browser. Save the source, usage guide and QA evidence; push a feature branch and open a draft PR. No production merge or deployment in this exploration.
