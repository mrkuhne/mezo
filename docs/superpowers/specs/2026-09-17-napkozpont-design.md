# Napközpont — approved design

Date: 2026-09-17 · Driving issue: mezo-26fw0

## Decision and approval

The owner approved the orbital Napközpont prototype, including its custom kcal/macronutrient graphic, and explicitly authorized implementation, CI-gated merge, push and deployment. The Mai page is the immediate capture hub: check-in, quick log, journal, activity and chat are always directly reachable. Existing Titanium companion and application navigation remain.

## Composition

Five sculptural, colorful animated action nodes surround the existing Titanium companion. Check-in occupies the primary upper position. Quick log opens the existing full-page picker; journal and activity open their existing capture sheets; chat opens the existing conversation surface. Tapping the companion still opens Életjelek. The page scrolls into a metallic kcal core with three individual macro progress arcs, a grounded Mezo observation with inspectable evidence and feedback, then today's recorded moments. No duplicate water/stat/journal dashboard panels.

Nutrition uses the day's actual consumed totals and targets; selecting a macro exposes grams versus its own target. Unknown, loading and failed data are distinct from zero. Observations come from the existing observations API, never invented prototype copy. An empty feed invites recording without claiming AI knowledge. Timeline entries come from current-day check-ins, meals, notes and activities; missing timestamps are not invented.

Check-in notes have no application character limit: remove the UI cap and migrate storage to TEXT. Existing independent AI-input bounds remain.

## Accessibility and scope

Labeled native buttons, keyboard access, visible focus, responsive 320px layout, reduced-motion fallback. Reuse capture, chat and feedback APIs. No new AI generation or duplicate persistence. Prototype demo numbers are excluded from real mode.

## Acceptance

All five entry points work. Graph and insight remain honest during loading, empty and failed reads. Existing capture tests plus focused new behavior tests pass in both modes. Frontend build and both complete test modes, focused backend regressions, docs/contract/codemap gates, PR CI and current-main premerge must pass before merge. Deployment is verified after push.
