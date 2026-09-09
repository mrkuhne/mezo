# Boop Play — data-first RPG visual prototype

Driver: mezo-88jw.11. User-directed complete visual alternative to the expanded editorial Boop. Navigation stays; all other visual/communication choices change. Keep `?v=boop` intact. New `?v=rpg` variant uses separate persisted mock state.

## Intent

A vivid, friendly science-fiction training and nutrition dashboard. Bright blue, lime, coral and violet on pale cool surfaces, deep navy feature modules, bold sans titles, tabular numerical metrics. Functional Hungarian labels remain primary. RPG visual devices: module emblems, segmented progress, program checkpoints, skill/PR readouts and action-earned XP. One major task per screen; secondary data in concise rows with drill-down.

## Surfaces

Home becomes a daily command deck: training, energy/macros, daily logging progress and quick actions. Movement gives volume, sessions, personal records, mesocycle weeks and the next workout. Fuel gives remaining/consumed/target energy, three macro channels, meal slots, logging and water. Life hosts the original two-eye Boop, check-in, journal, body logs, goals and people. Insights keeps factual patterns, facts and profile access, with a data-led hierarchy rather than companion narration.

Domain switching and local tabs remain in their known positions. Outside Life, navigation uses distinct module emblems; AI conversation actions open Life. Full mock subpages remain available in the new visual system. The editorial prototype retains its existing behavior.

## Data and feedback

Use the full shared mock model from the core prototype; no production source changes. New variant starts independently. Numerical summaries derive from saved meals, exercise records, logs and goals. Fixture records are labeled as demo data. XP reflects unique recorded entries and never rewards eating less or increasing weight lifted. Editing an entry does not farm XP. No health/sleep value is turned into a moral score. Missing data has an explicit empty state.

Animations mark a confirmed action, selected domain or checkpoint. Static indicators stay readable and reduced-motion disables ornamental motion. Food score remains a labeled simulation. Original Boop geometry stays unchanged.

## Implementation sequence

Create and verify pure selectors and storage isolation first. Introduce variant injection into the existing navigation shell. Build fresh domain dashboards and code-native SVG instruments, then reskin detailed flows through scoped CSS and identity context. Finally test route parity, mutations, mobile width, history/chat navigation and old-variant regression. Record reference transfers and prototype coverage.

## References

Yazio diary: calorie/macro hierarchy and quick capture. Strava Best Efforts: comparable personal performance. Duolingo milestone design: conspicuous action feedback and progress. BitePal app listing: approachable playful logging and pet identity. Keep earlier principles: direct task tools, distinct hierarchy, contextual disclosure, one header and shared navigation.
