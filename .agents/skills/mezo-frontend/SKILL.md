---
name: mezo-frontend
description: Use before touching ANY frontend/src code (pages, components, sheets, hooks, data layer, FE tests) — routes you to the mandatory house references.
---

# mezo Frontend Work

READ FIRST: docs/references/frontend_conventions.md (full file), and the feature's
docs/features/<domain>.md if one exists.

Hard gates: four layers (app/ features/ shared/ data/) · routed = *Section or *Page, modals =
*Sheet, never *Screen/*View · hooks imported from @/data/hooks ONLY · dual-mode reads via
useDualQuery · @/* absolute imports, no barrels except data/hooks.ts · shared/ui is domain-free.
Gate: pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test — BOTH modes green.
