# Titanium Mezo — connected discoveries, portrait and memory

Driving issue `mezo-bywr`. Continues the approved Titanium direction and
[navigation consolidation](2026-09-09-titanium-navigation-demo.md), following the
[food flow](2026-09-09-titanium-food-flow.md). This is an isolated, interactive design
prototype, not a migration of production features or contracts.

Sources: [Insights](../features/insights.md) (patterns, investigations, experiments,
forecasts, coaching, knowledge and memory) and [Character](../features/character.md)
(portrait, claim feedback, conferences, personas and engine inspection).

## Consolidation and visual direction

Four destinations answer four different questions. Discoveries owns the story of an
observation, including its evidence, investigation and experiment. Forecasts owns future
expectations and subsequent outcomes. Character owns Mezo's evolving interpretation of
the person, with correction and provenance. Knowledge owns the single editable fact list,
its use controls, episodic memories, memoir and relationship map.

The same item is linked across these destinations rather than copied into competing lists.
Confirming a pattern creates one linked fact; its source remains the original pattern.
Character claims stay distinct from facts. Correcting a claim produces a pending correction,
not an instant rewrite of the portrait. The old diagnostic entry is now “Járjunk utána”.

The Felfedezések landing retains the animated Titanium companion. Subpages give the content
room: custom dimensional icons, graphite/lavender surfaces, local constellation animation,
large editorial titles and evidence cards. Colored topics carry across their related pages.
The four-button contextual navigation and miniature companion domain switch remain visible.
Detail pages use hash URLs, scrollable content and a parent return button.

## Page map

All routes start at `nap.html#mezo/`. The first number is the contextual tab.

| Destination | Detailed pages and interactions |
| --- | --- |
| `0` Felfedezések | Status filters, three cross-domain observations, active experiments, coaching and data coverage. |
| `0/pattern/{topic}` | Finding, paired chart with units and text alternative, limitations, agree/watch/reject feedback, linked fact, experiment, forecast, memory and contextual sample conversation. |
| `0/investigate` | Question chooser and prior investigation. `/{fatigue,sleep,archive}` opens a source-led report, alternative explanations and next steps. |
| `0/experiment/{topic}` | Proposal, explicit start, seven-day progress, notes and a mixed-result completion. Explicit demo time-advance control; no real logs are created. |
| `0/coaching` and `coaching-detail` | Proposal, rationale, four-step reasoning trace and a handoff to the existing training load page. |
| `0/coverage` | Sample source coverage, missing context and links back to findings and engine inspection. |
| `0/talk/{topic}` | Three expandable, prewritten questions/answers with topic context and a journal entry handoff. |
| `1` Előrejelzések | Pending/closed filters, one open prediction and two outcomes; accuracy denominator excludes the open item. |
| `1/forecast/{id}` | Expected versus observed result, uncertainty, source pattern, associated experiment and separate usefulness feedback. |
| `2` Karakter | Constellation overview, seven proposed portrait dimensions, feedback counts and entries to conference, team, activity and audit. |
| `2/dimension/{id}` | A specific claim, source context, agree/reject/correct controls, pending correction, related memory and conference. |
| `2/conference` and `conference-archive` | Decisions/discussion toggle, accepted versus rejected proposals, rationale and a previous sample decision. |
| `2/team` and `team/{1..9}` | Nine sample perspectives, individual remit and links to the shared conference. These are AI roles, not actual professionals. |
| `2/feed` | Demo events, user feedback and prior example events. |
| `2/audit`, `engine`, `engine/run` | Uncertainty and feedback counts, detector overview, one source-to-observation trace, source coverage and memory layers. |
| `3` Tudástár | Candidate approval/rejection, one searchable fact list, own-fact entry and linked memory surfaces. |
| `3/fact/{id}` and `new-fact` | Source, editable wording and use toggle; disabling retains the fact while excluding it from the demo's active list. |
| `3/graph` and `graph/{topic}` | Topic constellation and links between observation, memory and character dimension. |
| `3/memory` and `memory/{id}` | Accent-insensitive search of three example days, full day narrative, provenance and related pattern/memoir. |
| `3/memoir` and `memoir/older` | Longer current and previous narrative chapters with source links. |
| `3/tone` and `layers` | Editable communication preference; explanation and navigation across records, summaries, patterns and facts. |

Topic IDs: `evening`, `load`, `rhythm`. Forecast IDs: `sleep`, `strength`, `routine`.
Portrait dimensions and persona names are proposed presentation groupings, not changes to
the production character schema. Engine inspection is illustrative; it does not claim actual
server status, detector execution, token use or cost.

## State and limitations

`mezo-state.js` owns sample records and meaningful state transitions. `mezo.js` renders full
pages, connects the routes and handles local input. `mezo.css` supplies the visual layer;
`navigation.js` delegates Mezo routes and controls companion visibility.

All AI narratives, graphs and observations are explicitly demo fixtures. There is no LLM,
backend call, real psychological assessment, causal inference or actual memory persistence.
Reload or the sample-day reset clears edits. The seven-day result is a prewritten mixed
example; it never automatically confirms the hypothesis. Usefulness feedback cannot change
a forecast's observed outcome. Search is local text matching, tolerant of Hungarian accents,
case and surrounding whitespace, not semantic retrieval.

## Validation

Five state tests cover linked-fact uniqueness and exclusion after rejection, experiment
uniqueness/bounded progress, candidate idempotency, pending claim corrections, closed-only
forecast scoring and Hungarian search normalization. The initial missing-module/export failures
were observed before implementation. All 13 prototype tests pass.

Mobile browser checks at 390 × 844 covered pattern confirmation → linked fact; claim correction
→ pending state; conference discussion switching; prediction → usefulness feedback → experiment
start → all seven demo days → mixed completion; candidate approval; fact search, disable and
wording edit; accentless memory search → day detail → memoir. Screenshots reviewed for portrait,
predictions, pattern detail and memoir. Experiment completion had no horizontal overflow.
The full prototype build and repository documentation checks are recorded in the PR.
