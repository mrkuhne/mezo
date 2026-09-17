# Sticky domain navigation implementation

Goal: ship the [approved design](../specs/2026-09-17-sticky-domain-navigation.md).
Driver: `mezo-0i5y6`. Durable task status lives in Beads.

Architecture: retain `navModel.ts` as the route/icon source of truth. `TabBar.tsx`
provides a domain styling attribute; `DomainSwitcher.tsx` owns the accessible
phone-screen portal. Scoped rules in `prototype.css` replace the capsule geometry
and drawer styling without changing other sheets or page themes.

Global constraints: five choices, four contextual tabs per domain, existing routes
and chrome exclusions, no light-mode redesign, 44px minimum touch targets, safe-area
padding, reduced-motion support, keyboard focus containment and background inertness.

## Task 1 — navigation behavior and layout

Files: `frontend/src/app/TabBar.tsx`, `DomainSwitcher.tsx`, `TabBar.test.tsx`,
`frontend/src/styles/prototype.css`, `frontend/tests/layout/navigation.spec.ts`.
Interfaces: preserve `DomainSwitcher({currentDomainId,onClose})`, `DOMAINS`,
`routeForDomain`, `activeDomainId` and `rememberRoute`.

1. Add failing behavior tests for a panel-free named modal containing exactly five
   buttons, current-card focus, Tab wrapping, Escape/backdrop dismissal and focus
   return. Test switching back to a remembered tab and each domain's icon row.
2. Run `VITE_USE_MOCK=true pnpm test src/app/TabBar.test.tsx` and observe failure.
3. Replace the Sheet wrapper with a portal; inert siblings while mounted and restore
   prior values on cleanup. Keep a labelled dialog, explicit keyboard handlers and
   existing route actions. Add the domain attribute to the bar and cards.
4. Replace capsule geometry and obsolete drawer rules; preserve existing bottom
   action clearances. Add fixed dark navigation palette tokens and domain accents.
5. Run focused tests in both modes. Add browser geometry/interaction coverage for
   narrow screens, short landscape and desktop. Inspect the resulting live app.
6. Update living platform documentation. Run full frontend tests in both modes,
   `pnpm build`, `node scripts/lint-docs.mjs`, `node scripts/gen-codemap.mjs --check`.
7. Refresh tracker backup, commit as `feat(nav): dock domain menus and remove switcher
   drawer (mezo-0i5y6)`, push `feat/sticky-domain-navigation`, and open the self-PR.
