---
name: mezo-frontend
description: Use before touching ANY frontend/src code (pages, components, sheets, hooks, data layer, FE tests) — routes you to the mandatory house references.
---

# mezo Frontend Work

LOCATE FIRST: find the files via docs/CODEMAP.md (data module + the hooks it exports via
@/data/hooks, pages/sheets/components/logic), then read the matching docs/features/<x>.md
§10. Do NOT grep the tree for orientation.

READ FIRST: docs/references/frontend_conventions.md (full file), and the feature's
docs/features/<domain>.md if one exists.

Hard gates: four layers (app/ features/ shared/ data/) · routed = *Section or *Page, modals =
*Sheet, never *Screen/*View · hooks imported from @/data/hooks ONLY · dual-mode reads via
useDualQuery · @/* absolute imports, no barrels except data/hooks.ts · shared/ui is domain-free.
Gate: pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test — BOTH modes green.
