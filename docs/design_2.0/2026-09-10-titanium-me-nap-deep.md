# Titanium — detailed Én and Nap

Driving issue `mezo-of6i`. Follows the [Mezo deep prototype](2026-09-09-titanium-mezo-deep.md).
Decision: [ADR 0040](../decisions/0040-titanium-personal-day-prototype-state.md).
This is the isolated Titanium demo, not a production feature migration.

Sources: [Me](../features/me.md) (weight, sleep, profile, goals and people),
[Today](../features/today.md) (dayparts, check-ins, signals and daily context),
[Journal](../features/journal.md) (notes, gratitude and decision review),
[Habit](../features/habit.md) (manual versus derived completion and propose-only suggestions).
The user's accepted menu and priority decisions take precedence over the existing production IA.
Growth/quests do not return to either menu. Knowledge and character remain in Mezo.

## Én: the personal story

Base URL: `nap.html#me/`.

| Route | Detailed behavior |
| --- | --- |
| `0` Áttekintés | Living companion, own bio, measured seven-day weight average, latest sleep, active goals, journal count, weekly overview, people and profile. |
| `0/goals`, `goal/{id}`, `goal-new` | Own goals with reason and next step, create/edit, pause/resume, routine handoff. |
| `0/week` | Current weight/sleep/food/workout snapshots and links to their source pages; no invented aggregate health score. |
| `0/profile` | Editable name, height and bio. Name updates the companion greeting and avatar initial. |
| `0/people`, `person/{id}` | Two explicitly fictional sample relationships, individual detail, own mention capture and journal handoff. |
| `0/settings`, `data` | Quiet decorative cards, demo-only reminder preference, communication preference link to Mezo, explanation of data boundaries. |
| `1` Súly | Selected-day measurement or honest empty state, measured seven-day average and comparison up to that day, editable target, 7/14/30-day chart/text alternative and collapsed measurement history. Fourteen sample dates exist; longer windows are not padded. |
| `1/weight-log/{optional date}`, `weight-day/{date}` | Date, kg and note, validation, existing-date replacement and linked day detail. |
| `1/weight-context`, `weight-goal` | Weight/sleep/food/training context and own target editor; the target does not automatically change food budgets or workouts. |
| `2` Alvás | The night ending on the selected day or an honest empty state, own quality, recorded-night average up to that day, own target, duration chart/text equivalent and collapsed individual-night history. |
| `2/sleep-log/{optional date}`, `sleep-night/{date}` | Separate bed/wake datetime fields, awake-minute subtraction, quality, optional circumstances and note. Date identifies the wake day. Saving the same day replaces its night. |
| `2/sleep-rhythm`, `sleep-context` | Own bedtime/duration targets, evening routine, cross-domain context and evidence links. |
| `2/night` | Quiet dark view with own bedtime and explicit return; shared header, bottom menu and quick button hidden while active, restored on exit. No sleep measurement/alarm starts. |
| `3` Napló | Entries for the selected day and explicit date-bound creation first; note/gratitude/decision/archive filters and Hungarian accent-tolerant global search remain in a collapsed secondary control. |
| `3/entry-new`, `entry-edit/{id}`, `entry/{id}` | Type-specific copy, dated writing, explicit save, stable-ID edit, reversible archive. Decision review is separate from the original words. Evening-reflection editing leads to the shared closing editor. |

## Nap: the shared day

Base URL: `nap.html#nap/`.

| Route | Detailed behavior |
| --- | --- |
| `0` Mai | Companion and next step adapt to morning/day/evening and closing state. Six live tiles show hydration, latest sleep, intake, gym completion, routine and journal. Entry points to all daily details. |
| `0/quick` | Full-page quick picker to the shared measurement/journal/check-in editors and the existing food/workout flows. The floating plus uses this picker. |
| `0/checkin`, `moment/{slot}` | Four replaceable snapshots (morning/day/afternoon/evening), energy/stress/body/mind sliders and note. No averaged wellbeing score. |
| `0/water` | 150/250/500ml shortcuts, custom amount, log list and undo of the last own entry; the seed baseline is protected. |
| `0/intention` | Own daily direction, sample suggestions that fill a draft, explicit save and goal link. |
| `0/signals`, `timeline`, `briefing` | Source-based signals, grouped logged events, daily overview with current snapshots and explicitly prewritten commentary. Untimed events do not receive invented timestamps. |
| `1` Beszélgetés | Own messages, bounded prewritten replies, suggested prompts, contextual action handoffs, save own words into journal exactly once per message. |
| `1/context` | Latest sleep/check-in, current food/workout, intention/goals, separate links to Mezo interpretations and facts. No real system-prompt generation. |
| `1/history`, `thread/{volley,rhythm}` | Current conversation and two prewritten previous sample threads. |
| `2` Rutin | Three daypart chains, source-derived completion, own habits, paused rows, suggestion and history entry points. |
| `2/chain/{reggel,nap,este}`, `habit/{id}`, `new` | Manual toggle/undo, derived-source navigation, own name/anchor/reason/daypart editing, creation and pause/resume. |
| `2/suggestion`, `routine-history` | Propose-only sample idea, explicit own-habit creation, illustrative two-week history whose current-day count is live. |
| `3` Napzárás | Current-day counts, unclosed/closed state, timeline, evening check-in, routine and quiet night entry. |
| `3/close-edit`, `close-summary`, `tomorrow` | Optional keep/release/tomorrow fields, explicit closing, one upserted reflection, editing, source journal link and non-automatic tomorrow handoff. Empty closing creates no empty journal entry. |

## Shared implementation

### Shared date navigation

Súly, Alvás, Napló, Fuel Mai and Edzés Mai share the same selected date. A horizontal swipe across
the daily canvas advances exactly one day (left for next, right for previous), with matching arrow
buttons for discoverability and keyboard access. The persistent header shows today/yesterday/age,
the full date and a native calendar picker; historical pages expose `Vissza mára`, and the next-day
control is disabled at the anchored demo date. Switching domains preserves the date.

Daily content follows the selection rather than changing only its label. Weight and sleep use the
actual dated sample rows; journal filters its own entries; Fuel and Train contain explicit sample
histories for September 7–8 plus honest empty states for earlier days. Logging remains attached to
today except for the personal forms that already accept a past date. Long histories remain
available as collapsed secondary controls, while weekly load and trend views keep their existing
routes.

### Fuel visual calibration

Fuel Mai is the first calibration page for a lower-friction mobile hierarchy. The initial compact
card version was rejected because shrinking every card preserved the original problem: too many
equal boxes and too much explanatory copy. The revised iteration uses the
[YAZIO diary hierarchy](../research/entities/yazio.md) as a reference while retaining Mezo's own
materials and iconography.

One open, borderless energy instrument now dominates: a large dimensional bowl sits in a progress
arc beside the remaining calorie number. The short `keret − étel + mozgás` equation explains it.
The three macros use flat meters, logging is one icon-led row, and meals are separated list rows
with large icons and numbers instead of cards. Frame explanation, movement context and recipes
remain in one collapsed disclosure. The task-focused companion header keeps the animated presence
and two icon controls, but removes its explanatory paragraph.

This establishes the pattern for evaluating the other daily roots: one visually interesting
answer, one primary action and the records needed right now. Interpretation and longer-term
analysis move one level deeper. Nap Mai keeps the full-size companion because arrival and
conversation are the page's purpose.

- `day-navigation-state.js`: shared ISO-date selection, route eligibility and deliberate horizontal-swipe threshold.
- `personal-state.js`: one memory model and validated state transitions, including selected-day weight summaries.
- `personal-state.test.js`: date-based corrections, sleep duration, journal identity/archive,
  separate decision review, check-in replacement, derived routine rules, closing upsert and water undo.
- `me-pages.js` / `day-pages.js`: all full-page renderers and local page composition.
- `life-ui.js` / `personal.css`: reusable dimensional-icon cards, readable charts, forms,
  quiet surfaces, mobile styling and reduced-motion handling.
- `food.js` / `fuel-dashboard.js` / `fuel-compact.css`: shared Fuel demo state plus the open energy
  instrument, primary meal logging, flat daily meal list and collapsed contextual layer.
- `personal.js`: route delegation, form handlers, bounded conversation demo, local state,
  shared legacy entry points and current-data snapshots.
- `navigation.js`: delegates both areas, contextual navigation, companion visibility/daypart greeting,
  night-mode shell, avatar journal command and profile initial.
- `nap.js`, `food.js`, `workout.js`: small read-only snapshot exports; their existing deep food and
  workout state machines remain the owners of those domains.

Old Nap markup stays hidden for its existing daypart/render controls; its old generic personal
sheet entry points are routed into the detailed pages. Personal/day screens have one active
source of truth. No new persisted user data or production frontend/backend files are touched.

## Validation

The date-navigation tests initially failed on the missing module, and the selected-day weight test
failed before the date-bounded summary existed. All 24 prototype tests pass. Vite builds both lab
and Nap entries; existing Three.js >500kB warning remains.

At 390px the selected date was moved from September 9 to September 8 on Alvás, then preserved while
switching to Súly, Napló, Fuel and Edzés. Each domain rendered its own September 8 content; the
historical Fuel page showed four meals and 2,260 kcal, while Edzés showed the logged 90-minute
röplabda session. Arrow movement, disabled future navigation, native calendar control, return to
today and the mobile layout were inspected in the browser.

Fuel Mai was then inspected in its borderless visual-dashboard state and on September 8. The first
view contains the compact companion, flat day navigator, animated bowl/gauge, dominant remaining
number, macro meters and meal-log action before the meal history. The log action opens the existing
three-stage food flow; the collapsed context remains reachable, and the historical day retains its
own 2,260 kcal total, four recorded meals and direct return to today.

At 390px: weight 81.4→81.2 correction retained 14 measurements; overnight sleep 23:15→07:15 minus
15 awake minutes produced 7h45, including a saved circumstance; decision capture/review preserved
original words; archive/restore worked; check-in values appeared in conversation context; own
chat text was saved into journal; custom routine creation/completion/pause/resume updated counts;
closing correction left one reflection. Avatar text command opened the new journal with its
sentence prefilled. A yogurt/banana log updated Nap to 1,383kcal.

At 360px: a DOM-grounded traversal followed 105 reachable route variants (including individual
dates and records), with no missing-page result or rightward content overflow. Screenshots
reviewed for weight, overview, Nap landing, closing and quiet night. Night return restored shell
navigation. This traversal verifies render/reachability, not every form permutation or backend.
