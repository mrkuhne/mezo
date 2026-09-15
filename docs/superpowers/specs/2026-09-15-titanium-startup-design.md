# Titanium app startup

Date: 2026-09-15. Status: approved by owner ("mehet"). Driving issue: mezo-qducz.

## Goal and owner decisions

On a fresh app document, show the existing Dashboard Titanium Mezo icon large and
centered on a fullscreen, theme-aware background. Three gentle flashes and the
final fade take exactly 3 seconds together. Normal entry reveals Mai nap (`/nap`).
Internal navigation and returning from the background do not replay the animation.

## Architecture and behavior

`StartupSplash` lives above the router in `main.tsx`. Its children mount immediately
but stay inert and hidden from assistive technology until the overlay is removed.
The existing `/` → `/nap` routing remains authoritative; explicit deep links and
authentication keep their destinations. No API or persisted preference is added.

Reuse the existing lazy `TitanScene`, with `TitanMark` for loading, missing WebGL,
reduced motion and chunk failure. Share the presentation through `TitanArtwork`
in `TitanCompanion.tsx`; the Dashboard keeps its existing interactive wrapper.
SVG gradient identifiers must be instance-specific because both marks can coexist.

Three 900 ms brightness pulses precede a 300 ms fade. A 3000 ms React timer removes
the splash independently of CSS/WebGL completion, with cleanup for StrictMode and
unmount. Reduced motion keeps the 3-second duration with a static mark and no fade.

## Verification

Colocated tests cover the time boundary, inert content, no replay on rerender,
StrictMode cleanup, reduced-motion fallback and simultaneous SVG instances.
Browser checks cover fullscreen mobile/desktop geometry, actual three-pulse CSS,
reduced motion, the `/nap` landing, and subsequent navigation. Run build, both
frontend test modes, doc lint and generated codemap checks.
