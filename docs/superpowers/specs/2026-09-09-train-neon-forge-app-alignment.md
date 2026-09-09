# Neon Forge — align the prototype with the Mezo app

Date: 2026-09-09 · Driver: mezo-fdjv · User-requested correction to the
[original visual exploration](2026-09-09-train-neon-forge-design.md).

## Decision

Use the existing Train functional structure as the prototype's information
architecture. The original game dashboard/navigation overemphasized rewards and
did not represent the app. Preserve the approved visual style while restoring the
Train hub and its six destinations: weekly agenda, mesocycles, sport, running,
exercise catalog and medals. Include the separate daily view and the existing
workout log/completion prototype.

## Phone presentation

The entry page is a device frame with an independent, scrolling 390-pixel app
iframe. Navigation, dialogs, particles and quick logging remain inside the phone.
On a real narrow mobile viewport the bezel disappears and the app fills the screen.
The bottom bar uses the app's Nap · Edzés · Fuel · Mezo · Én order. Non-Train tabs
are explicitly labeled context previews; they do not claim full implementations.

## Representative working interactions

Sport supports Röplabda/Cross/TRX, kind-specific sets/rounds and shoulder fields,
duration/RPE/notes, a log and adding multiple weekly slots. Running uses prescribed
sprint/pyramid sessions, rounds/RPE/HR-recovery/notes, date-aware future disabling,
and session-keyed log state. Gym retains weight/reps and adds RIR.

Mesocycles expose the active block, selectable weeks, gym days and muscle load
details; the Upper/Lower sample template can be named, given a duration and
activated. The catalog is searchable/filterable; medal unlocks derive from mock
activity state. New activity logs update the daily view and demo XP/currency.

## Boundaries and validation

This remains a static mock visual prototype, not API integration or complete
production parity. Sample exercise/day plans and load charts are illustrative;
the own-workout shortcut uses the existing three-exercise log fixture. Production
Train and its API contracts are untouched. Node tests cover sport/run validation,
session identity, multi-slot schedules, meso activation and gym RIR; browser checks
exercise navigation, form saving and in-frame display.
