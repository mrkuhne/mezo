# Titanium startup implementation

Driving issue: mezo-qducz. Task status is tracked in Beads.
Spec: [approved design](../specs/2026-09-15-titanium-startup-design.md).

## Goal and architecture

Add an app-root overlay; let the router load under inert content. Reuse the existing
Titanium renderer and fallback without copying its geometry or importing Three.js eagerly.

## Global constraints

3000 ms total; three 900 ms pulses followed by 300 ms fade. Once per document,
no persisted flag, no deep-link rewrite, reduced-motion static presentation.

## Task 1 — startup lifecycle and Titanium presentation

Files: `frontend/src/app/StartupSplash.tsx`, `StartupSplash.css`,
`StartupSplash.test.tsx`, `frontend/src/main.tsx`,
`frontend/src/features/today/components/TitanCompanion.tsx` and its existing test.

Interface: `StartupSplash({ children }: { children: ReactNode })` wraps the router;
`TitanArtwork()` renders only the existing mark/scene in a sized span.

1. Add failing timer tests: visible at 2999 ms, removed at 3000 ms; children initially
   inert, then interactive; rerender does not restart; StrictMode unmount clears timers.
2. Run `VITE_USE_MOCK=true pnpm test src/app/StartupSplash.test.tsx` and observe failure.
3. Implement `useEffect(() => { const id = setTimeout(() => setVisible(false), 3000);
   return () => clearTimeout(id) }, [])`; wrap the router and reuse the lazy scene.
   Prefix SVG gradients with `useId()` to isolate simultaneous instances.
4. Verify the focused tests in both modes, build, then run full tests in both modes.
5. Update `docs/features/today.md` and `_platform-design-system.md`, regenerate
   CODEMAP, run doc lint, inspect the rendered mobile and desktop splash.
6. Commit with `git commit -m "feat(app): add Titanium startup splash (mezo-qducz)"`.

## Delivery

Refresh Beads backup, push `feat/titanium-startup`, open the self-PR, and follow the
repository's CI/premerge gate before integration. Record actual results in Beads.
