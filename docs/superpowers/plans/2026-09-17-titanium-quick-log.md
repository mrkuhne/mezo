# Titanium quick logging implementation

Driver: `mezo-62xey`. Tracking lives in Beads; the numbered work packages below are design instructions, not a second task tracker.

## Goal and architecture

Implement the [approved design](../specs/2026-09-17-titanium-quick-log.md) on existing capture flows. Reuse domain-free `CaptureHeader` and `CaptureSculpture` presentation primitives; domain sheets continue owning their current state and mutations. Scoped token-only CSS must not restyle other sheets.

## Constraints

Keep nine tiles in their existing order and preserve dedicated page routes. Keep water 250/400/500/manual, weight ±0.1/±0.5, sport branches, all sleep import fields, check-in unlimited notes, journal modes/voice/date and activity classification. No backend, DTO or hook changes. Both mock and real modes explicitly pinned. One worktree and branch; independent sheet packages may be delegated after the shared interface exists.

## 1. Shared presentation and launcher

Files: `shared/ui/CaptureHeader.tsx`, `CaptureSculpture.tsx`, `capture.css`; `features/quickinput/QuickLogSurface.tsx`, `QuickLogSurface.css`; `features/today/pages/NapGyorsPage.tsx` and its existing test.

Interfaces: `CaptureHeader({id,title,subtitle?,eyebrow?,kind,onClose,onBack?})`; `CaptureSculpture({kind,className?})`; kind is food/water/stack/training/sport/weight/checkin/journal/sleep/chat. Sheet gets `className="capture-sheet capture-tone-<kind>"`; the header imports the common CSS. Existing `Sheet` and all mutation signatures stay unchanged.

Add a regression asserting the page has one named heading and can open the water dialog; run it red. Implement the primitives, grid graphics and one heading, preserving tile callbacks. Run the page and QuickInputSheet suites. Commit `feat(quickinput): bring Titanium sculptures to quick logging (mezo-62xey)`.

## 2. Capture sheets

Files: WaterLogSheet, WeightLogSheet, SleepLogSheet (Fuel/Me); SportLogSheet (Train); CheckInSheet, ActivityLogSheet (Today); JournalSheet (Me), plus their colocated tests where behavior changes.

Replace duplicated headers with CaptureHeader, retain IDs/labels and sheet close render props. Give water a selected amount output, weight a decorative ruler, check-in a step-aware sculpture, sleep a night arc. Preserve all existing inputs, success/error handling and optional branches. Remove unsupported canned personalized advice. Existing mutation tests are the primary regression coverage; add a water output test that fails before adding the selected amount graphic. Independent sheet files may be worked on in parallel once package 1's interface exists. Commit each verified group with the issue ID.

## 3. Verification and delivery

Run `cd frontend && pnpm build`, `VITE_USE_MOCK=true pnpm test`, `VITE_USE_MOCK=false pnpm test`. Review actual sheets in a local mock browser at mobile widths and both themes; regenerate affected visual baselines if required. Update today/me/fuel/train/journal living docs, run `node scripts/lint-docs.mjs`, regenerate CODEMAP and refresh the Beads backup. Push branch and open self-PR. Green CI and the current-main premerge gate precede any previously authorized merge/deploy; no production deployment from prototype assets.
