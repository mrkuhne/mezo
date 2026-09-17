# Napközpont implementation plan

Driving issue: mezo-26fw0. Task progress lives in Beads, not this document.
Design: [approved spec](../specs/2026-09-17-napkozpont-design.md).

## Independent implementation units

1. Check-in capture: red regression for >500 characters; remove CheckInSheet's UI truncation, use TEXT entity/migration, document unconstrained API, regenerate types. Run focused BiometricsContractIT and CheckInSheet tests in both FE modes.
2. Nutrition graphic: NapFuelGraphic component with consumed/targets MacroSet and pending/error/retry props. Test macro selection, unknown targets, overflow and loading/error; implement responsive metallic core and three arcs with reduced motion.
3. Personal insight: NapPersonalInsight reads existing observations/reply hooks; tests empty/error/evidence and single submission. Render real prose, evidence and safe chat/feedback actions with decorative Titanium graphics.
4. Hub composition: replace NapHubPage with orbital direct capture entry points. Reuse TitanCompanion and existing sheets. Add pure timeline normalization with day filtering, ordering and honest unknown time. Expose Fuel read errors additively. Test actions, sheet wiring, and timeline edge cases before implementation.

## Integration and release

Update today feature reference and generated CODEMAP; capture the composition decision. Run pnpm build, VITE_USE_MOCK=true pnpm test, VITE_USE_MOCK=false pnpm test, focused backend tests and node scripts/lint-docs.mjs. Inspect the page at mobile widths and reduced motion. Refresh Beads backup. Push branch and open self-PR, wait for CI, dispatch premerge.yml against current main. Pull main before local --no-ff merge, push and verify deploy workflow/ArgoCD rollout. Owner authorization overrides the generic execution skill's no-merge ending.
