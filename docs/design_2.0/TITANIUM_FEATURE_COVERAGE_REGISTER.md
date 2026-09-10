# Titanium production rebuild — feature coverage register

This is the master discovery register for page-by-page production redesign. It is product coverage
evidence, not the implementation task tracker; bd owns tasks and dependencies. The list is seeded
from every feature block in `docs/CODEMAP.md` on 2026-09-10 and must be refreshed from the generated
map at the start of each slice.

## Decision vocabulary

| Value | Rule |
| --- | --- |
| `UNKNOWN` | Not yet discussed; blocks prototype work when relevant |
| `KEEP` | Preserve behavior and give it an explicit destination |
| `MERGE` | Combine presentation/data ownership; name one canonical destination and compatibility path |
| `MOVE` | Preserve behavior in a different page/sheet/action/background surface |
| `DEFER` | Deliberately exclude from this slice; explicit owner decision and a bd follow-up required |
| `DROP` | Deliberately remove; explicit owner decision, reason and migration/compatibility impact required |
| `N/A` | Proven unrelated to this slice, with evidence; not a shortcut for an unread feature |

## Master CODEMAP inventory

For a target page, copy all relevant rows to a dated coverage record and expand each into its
individual routes, mutations, automatic behaviors and consequential states. The “probable concern”
column is an orientation hint, not a decision.

| CODEMAP block | Living reference | Probable concern in the redesign | Baseline decision |
| --- | --- | --- | --- |
| `activity` | related docs via CODEMAP | Cross-domain activity/log stream and provenance | `UNKNOWN` |
| `admin` | `admin-hub.md`, `admin-memory-explorer.md` | Owner console, diagnostics and memory inspection | `UNKNOWN` |
| `aidraft` | related docs via CODEMAP | AI-generated drafts and acceptance boundary | `UNKNOWN` |
| `appnotification` | `_platform-notifications.md` | In-app notification records, routing and state | `UNKNOWN` |
| `auth` | `_platform-auth-security.md` | Login, registration, identity and ownership | `UNKNOWN` |
| `biometrics` | `me.md`, `today.md` | Weight, sleep and cross-domain measurements | `UNKNOWN` |
| `character` | `character.md` | Character claims, feedback, conference and provenance | `UNKNOWN` |
| `companion` | `companion.md` | Chat, memory context, tools, streaming and persona | `UNKNOWN` |
| `feedback` | related docs via CODEMAP | User correction/usefulness signals to AI features | `UNKNOWN` |
| `fuel` | `fuel.md` | Daily energy/macros/water, meal flow and context | `UNKNOWN` |
| `gamification` | `growth.md` | XP, currency/feedback rules, rewards and medals | `UNKNOWN` |
| `goal` | `goal-engine.md`, `lifegoal.md` | Goals, feasibility, prescriptions and next actions | `UNKNOWN` |
| `habit` | `habit.md` | Routine chains, manual/derived completion and suggestions | `UNKNOWN` |
| `insights` | `insights.md` | Patterns, facts, forecasts, experiments and memories | `UNKNOWN` |
| `intention` | `intention.md` | Creed, daily foci and evening reflection | `UNKNOWN` |
| `journal` | `journal.md` | Notes, gratitude, decisions, review and embeddings | `UNKNOWN` |
| `lifegoal` | `lifegoal.md` | Long-term personal goals and links | `UNKNOWN` |
| `llmlog` | related docs via CODEMAP | AI transparency, trace and owner observability | `UNKNOWN` |
| `me` | `me.md` | Profile, weight, sleep, people, settings and personal overview | `UNKNOWN` |
| `meal` | `fuel.md` | Meal records, editing, analysis and day attribution | `UNKNOWN` |
| `medication` | `fuel.md` | Medication/supplement protocol and logging | `UNKNOWN` |
| `needs` | `needs.md` | Life-need signals, rings and source data | `UNKNOWN` |
| `notification` | `_platform-notifications.md` | Push schedule, preferences and deep links | `UNKNOWN` |
| `nutrition` | `fuel.md` | Targets, macro/fibre calculations and food data | `UNKNOWN` |
| `pantry` | `pantry.md` | Stock, expiry, shopping and recipe integration | `UNKNOWN` |
| `people` | `me.md`, `journal.md` | Relationships, mentions and memory context | `UNKNOWN` |
| `proactive` | `proactive.md` | Briefings, nudges, predictions, weekly prose and challenges | `UNKNOWN` |
| `progression` | `growth.md` | Levels, trait/progress computation and display | `UNKNOWN` |
| `quest` | `growth.md` | Optional quests, completion and reward feedback | `UNKNOWN` |
| `quickinput` | related docs via CODEMAP | Global fast log, voice/text dispatch and tool handoffs | `UNKNOWN` |
| `recipe` | `recipe.md` | Recipe library, detail, workshop and meal handoff | `UNKNOWN` |
| `ritual` | `ritual.md` | Napzárás sequence, reflection and release | `UNKNOWN` |
| `telemetry` | related docs via CODEMAP | Product/AI reliability and privacy-safe observability | `UNKNOWN` |
| `today` | `today.md` | Dayparts, check-ins, timeline and current next step | `UNKNOWN` |
| `train` | `train.md` | Workout, set logging, sport, load, plans, exercises and history | `UNKNOWN` |
| `tutorial` | `tutorial.md` | In-app guides and redesigned-route discovery | `UNKNOWN` |

## Starting sets for the five domains

These sets prevent a narrow page audit. They are the minimum starting points; CODEMAP and code may
add more related blocks.

| Destination | Primary blocks | Mandatory related checks |
| --- | --- | --- |
| Nap | `today`, `habit`, `intention`, `needs`, `ritual` | `companion`, `quickinput`, `proactive`, `appnotification`, `notification`, `journal`, `lifegoal`, `biometrics`, `activity`, `gamification`, `quest` |
| Edzés | `train` | `activity`, `goal`, `proactive`, `companion`, `quickinput`, `progression`, `gamification`, `quest`, `fuel`, `biometrics`, `notification` |
| Fuel | `fuel`, `meal`, `nutrition`, `recipe`, `pantry`, `medication` | `train`, `activity`, `quickinput`, `companion`, `aidraft`, `feedback`, `proactive`, `notification`, `biometrics` |
| Mezo | `insights`, `character`, `companion`, `proactive` | `feedback`, `aidraft`, `llmlog`, `journal`, `people`, `lifegoal`, `goal`, `needs`, `activity`, `telemetry`, `admin` |
| Én | `me`, `biometrics`, `journal`, `people`, `lifegoal`, `goal` | `character`, `growth`, `progression`, `gamification`, `habit`, `needs`, `today`, `fuel`, `train`, `notification`, `tutorial` |

Global `auth`, platform docs, `telemetry`, admin observability and tutorial/deep-link impact are
assessed for every shipped slice even when they stay visually unchanged.

## Cross-cutting platform inventory

These do not always become visible components, but each production slice must assess their impact.

| Living reference / CODEMAP area | Audit question | Baseline decision |
| --- | --- | --- |
| `_platform-api-backend.md` | Does the approved flow already have a contract, ownership and error model? | `UNKNOWN` |
| `_platform-auth-security.md` | Are current-user boundaries and foreign-row behavior preserved? | `UNKNOWN` |
| `_platform-data-layer.md` | Do mock and real hooks retain identical public behavior? | `UNKNOWN` |
| `_platform-design-system.md` | Which Titanium patterns become production primitives rather than page-local copies? | `UNKNOWN` |
| `_platform-notifications.md` | Which redesigned destinations are notification/deep-link targets? | `UNKNOWN` |
| `techcore` | Which errors, configuration, security or AI foundations are touched? | `UNKNOWN` |
| `shared` | Can a domain-free primitive be reused without moving domain logic into shared UI? | `UNKNOWN` |
| `test infrastructure` | Which integration/populator/reset or dual-mode fixtures are required? | `UNKNOWN` |
| `scripts` | Which generators, contract drift, docs and visual gates apply? | `UNKNOWN` |

## Page-level expansion template

Create a table with one row per capability. Do not combine distinct mutations or hide consequential
states in prose.

| Capability | Evidence | Current behavior | Frequency/value | New destination | Decision | Preservation test | Owner note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Example: selected-day meal correction | route + hook + endpoint + test | Replaces the meal on its logged day and recalculates totals | Frequent correction | Fuel Mai → meal detail editor | `KEEP` | Editing a past meal updates that date only | Keep the daily swipe context |

The expansion must include, where present:

- primary task and success state;
- create, edit, archive/delete, undo and resume paths;
- automatic/derived behavior and scheduled/proactive output;
- filters, search, sort, history, comparison and date navigation;
- AI context, tool call, preview/confirmation, provenance and feedback;
- cross-domain entry and return paths, deep links and notifications;
- loading, empty, error, validation, disabled, permission and stale-data states;
- accessibility, keyboard/touch alternative and reduced motion;
- owner/admin/diagnostic surfaces affected by the same data;
- backend-only or currently unreachable behavior.

## Coverage closure record

Before prototype work, append a short record to the page-specific document:

| Check | Required evidence |
| --- | --- |
| CODEMAP freshness | Generation/check command and commit state |
| Domain closure | Every related block classified; no relevant `UNKNOWN` |
| Backend closure | Contract through persistence/tools/jobs/security mapped |
| Frontend closure | Routes through hooks/sheets/states/deep links mapped |
| Owner closure | Every `DEFER`/`DROP`, and every ambiguous `MERGE`, explicitly decided |
| Prototype scope | Exact rows the prototype must demonstrate |
| Preservation scope | Exact observable tests required in production |

Prototype approval freezes these decisions for implementation. New evidence can reopen a row, but
Claude must surface the contradiction rather than silently changing scope.
