# Én and notifications — exploration coverage

Driving issue: **mezo-88jw.3**. Scope: the isolated Design 3.0 mock application. Production React and API sources remain unchanged. Both Mérték and Mezo companion variants use the original warm neutral/coral palette; companion copy gives context without slowing the logging controls.

## Evidence and adaptation

Orientation followed [`CODEMAP.md`](../CODEMAP.md)'s me, biometrics, people, habit, ritual and notification entries, then behavior and key-file sections in [`me.md`](../features/me.md), [`habit.md`](../features/habit.md), [`ritual.md`](../features/ritual.md) and [`_platform-notifications.md`](../features/_platform-notifications.md).

| Production reference inspected | Existing behavior | Exploration adaptation |
| --- | --- | --- |
| `frontend/src/features/me/pages/EnHubPage.tsx` (via feature documentation) | Identity and routes to personal domains | Quiet identity introduction; directly usable sleep and weight previews; relationships, routines, journal, goals, week and character links |
| `frontend/src/features/me/sheets/SleepLogSheet.tsx` | Bed/wake calculation, manual quality and notes; screenshot mode also exists | Dedicated manual form with wake-date meaning, midnight calculation, five-choice quality, factors, notes, history editing and adjustable personal duration target |
| `frontend/src/features/me/pages/WeightPage.tsx` and `logic/weightStats.ts` (via feature documentation) | Daily measurements and trend interpretation | Dated measurement series, 7/30-day views, arithmetic average/change, date/value/note editing; repeated same-day save updates one measurement |
| `frontend/src/features/me/pages/PeoplePage.tsx` | Contact circle, candidate/mention branches, person detail and logging | Searchable relationship list, person creation/editing, own notes and important dates, contact timeline, separate shared plans with completion/cancellation |
| `frontend/src/features/me/pages/RoutineWizardPage.tsx` | Fogg/Clear frameworks, anchor/action distinction; derived versus manual habits | Compact anchor → days/time → ordered small actions editor, today/yesterday check-off, reversible manual checks and log-derived weight/journal steps |
| Notifications feature §2/§10 | Day groups, categories, deeplinks and read state; production feed marks all on opening | Explicit mark-all and per-row read for the exploration, combined category/unread filters, grouped rows, actual route navigation, saved preferences/quiet hours |
| Ritual feature §2/§10 | Arrival, reflection and closing are a distinct activity | Journal and routine links preserve that distinction; this personal slice does not manufacture a second ritual engine |

## Reachable routes and outcomes

- **Én:** `me` links to all personal areas and root week, goals, journal and character routes.
- **Sleep:** `me-sleep`, `me-sleep-history`, `me-sleep-log`. New and edited logs update the latest metric and charts. The wake date identifies each night. Midnight and identical-time validation are explicit. Factors and personal quality remain separate from measured physiology.
- **Weight:** `me-weight`, `me-weight-log`. A blank or implausible input is rejected; decimal comma works; backdated editing preserves the most recent metric. Chart and average use the currently selected measurement window.
- **People:** `me-people`, `me-person`, `me-person-edit`, `me-contact-log`, `me-event`. Search and relationship filters combine. Person notes/dates can be edited. Contacts and planned shared activities are separate records; a planned event can be marked happened to prefill a contact form, or released from the upcoming list.
- **Routines:** `me-routines`, `me-routine`, `me-routine-edit`. Creation/editing changes schedule and steps; date-scoped manual checks toggle; derived weight steps read dated measurements and journal steps read the root's saved text for the scenario day. The seven-day visualization reports any completed step rather than claiming a perfect streak.
- **Notifications:** `notifications`, `notification-settings`. Opening a row marks only it read and navigates with its real route/params; mark-all clears unread state. Category and unread filters combine and empty states reset both. Preferences save and survive navigation; quiet hours may cross midnight.

## Root integration

`PersonalFlow.jsx` exports default `PersonalFlow({page,api})` and `PERSONAL_ROUTES`. `personal-state.mjs` exports `createPersonalState()`.

State paths consumed outside this slice are stable: `personal.sleep.latest.minutes`, `personal.weight.latest` (number), and `personal.notifications`. Notifications use `{id,title,body,route,params?,kind,time,read,day?}`; appended rows without `day` enter the Ma group. `personal.sleep.logs` use `{id,date,bed,wake,minutes,quality,factors,note}`. Routine completion is `checks: {[date]: stepIds}`. Existing root `state.journal` marks the current-day journal step complete.

Cross-domain links target `week`, `goals`, `journal`, `character`, `train`. The root redirects legacy `sleep` and `routine` routes to `me-sleep` and `me-routines`.

## Deliberate mock limits

The scenario date is 2026-09-08. Logs and notifications are illustrative local state. There is no actual message, invitation, contact import, external calendar write, push permission request, scheduled dispatch, medical sleep-stage inference or AI extraction. Sleep minutes describe the bed/wake interval, not measured time asleep. Weight charts join recorded points and show an arithmetic average, not the production moving-average model. The 30-day view contains only available seeded points. Quality is a prototype 1–5 scale. People candidates and automated mentions are not simulated; user-authored contact notes remain distinct from communication. Custom routines create manual steps; production Fogg/Clear framework wizards are reduced to an anchor-based editor. Notification preferences are saved mock choices, not an operating system permission or a working scheduler. Production feed's auto-read-on-arrival behavior is intentionally replaced by explicit read actions here.

## Verification

`node --test src/flows/personal-state.test.mjs` passes six behavioral tests after the initial missing-module red run: overnight/midnight handling and invalid times; sleep editing/history/latest; weight validation/decimal comma/backdated edits; separate contact and event records; reversible date-scoped routine checks with derived-step guard; combined notification filtering and mark-all link preservation.

Vite server rendering verifies every one of the 17 routes in both variants (34 renders), including populated detail routes. The root owns final integrated browser review, full build, documentation lint and repository gates.
