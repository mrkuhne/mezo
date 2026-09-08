# Full exploration integration contract — mezo-88jw.3

User approved building two rich mock prototypes, original neutral/warm palette: softer Mérték and genuinely companion-centred Mezo (no green Liget, no new blue). Existing icons/SVG language retained. Production source is read-only. User wants all named functional flows to be represented, not exhaustive backend behaviour. Agents own disjoint files, no commits or root-file edits.

## Files and exports

Fuel agent: `src/flows/FuelFlow.jsx`, `fuel-flow.css`, `fuel-state.mjs`, `fuel-state.test.mjs`.
Training agent: `src/flows/TrainFlow.jsx`, `train-flow.css`, `train-state.mjs`, `train-state.test.mjs`.
Personal agent: `src/flows/PersonalFlow.jsx`, `personal-flow.css`, `personal-state.mjs`, `personal-state.test.mjs`.
Root owns `main.jsx`, `model.mjs`, `shared.jsx`, `shell.css`, `FlowUI.jsx`, `flow-ui.css`, insight and companion files, route/navigation integration. Agents may add original media ONLY within their own `public/fuel/`, `public/train/`, `public/personal/` directory.

Each flow exports default `function XFlow({page,api})`, plus named `X_ROUTES` object mapping route key to `{title,parent}`. Hub keys: `fuel`, `train`, `me`. Other route keys use `fuel-`, `train-`, `me-` prefix. Notification routes: `notifications`, `notification-settings`. Existing root route keys remain: `home`, `mezo`, `chat`, `workout`, `meal`, `pattern`, `week`, `routine`, `avatar`, `sleep`, `journal`, `goals`. Avoid collisions. Root handles `workout`; Training links there. Root will redirect `sleep` → personal sleep overview and `routine` → personal routines; use YOUR explicit route in new code.

Each state module exports `createFuelState` / `createTrainState` / `createPersonalState`. Additional reducers/pure functions can be any named exports. Own meaningful tests use node:test + assert. Implement behaviour with TDD; do not test pure markup. Root test command will run all `src/flows/*.test.mjs` as well as existing model tests.

## API

- `api.variant`: `measure` or `companion` (legacy views may also have rhythm/grove).
- `api.state`: existing shared state plus `fuel`, `training`, `personal`, `insight`, `companion` slices. Read your domain from your slice; root hydrates all seeds.
- `api.update(domain, updater)`: immutable slice update. updater receives freshest slice and returns new slice. e.g. `api.update('fuel', s=>addPantryItem(s,item))`. No external storage in feature components.
- `api.params`: object from route hash query, e.g. `{id:'r1'}`. `api.go('fuel-recipe', {id:'r1'})`; only string values. Root ensures same-page/new-id rerender.
- `api.back()`: browser-history back, fallback parent. Do NOT add a second header or own back header. Local wizard step-back buttons are fine.
- `api.toast(text)`; `api.celebrate()`; `api.ask(text)`: goes to chat and submits contextual scripted message.
- `api.notify({title,body,route,params?,kind?})`: adds an unread in-app mock notification. Root stores under `personal.notifications`, with `id`, `time:'Most'`, `read:false`. Personal seed uses same fields.
- `api.nutrition`: totals `{kcal,protein,carbs,fat}` across `api.state.meals`. `api.remaining`: kcal left, floored zero.
- `api.addMeal(food)`: appends food WITHOUT navigating. food has `id,name,kcal,protein,carbs,fat,kind,time` and optional assessment/ingredients. `api.logFood(food)` is old add+back; prefer addMeal then explicit navigation.
- Existing `api.water()`, `api.toggleSet`, `api.setValue`, `api.finishWorkout`, `api.saveJournal` remain.

## Shared presentation

Import React explicitly. Imports inside this separate prototype can be relative (not production conventions).
`../shared.jsx`: `Icon`, `Avatar`, `Sparkline`, `Ring`, `FoodArt`, `WorkoutArt`, `Chat`. Icon names supported sun moon arrow-right arrow-up-right arrow-left plus check chevron-right play pause send mic heart sparkles dumbbell utensils droplet clock flame leaf activity chart book settings x search coffee more headphones target calendar chevron-down volume rotate wind zap; root adds bell users scale camera scan box chef medal run layers edit trash info chevron-left filter image video lightbulb brain message check-circle. Unknown icon falls back to sparkles.

Root provides `./FlowUI.jsx`: exports `FlowHead({eyebrow,title,description,children})`, `FlowTabs({items,value,onChange})` (items `[id,label]`), `FlowRow({icon,title,subtitle,value,onClick,children})`, `CompanionNote({children,action,onClick,state})`, `EmptyState({icon,title,description,action,onClick})`. You may use these after checking implementation or create domain-local presentation. Do not rely on undeclared props. Shared CSS: `flow-page` padding24; `flow-section` margin28; `flow-section-heading` flex heading/action; `flow-kicker`; `flow-title`; `flow-copy`; `flow-row`; `flow-list`; `flow-field` labeled native input/select/textarea; `flow-form`; `flow-grid` 2columns; `flow-actions`; `flow-tag`; `flow-status`; `flow-sheet` only local content not native modal; `primary-button`, `secondary-button`, `text-button`, `detail-card`, `week-stats`, `evidence-note` existing.
Theme tokens inherited: --app-bg --ink --muted --accent --line --panel --soft --font-display --button-ink. Main surfaces width360–430, own scrolling from root, no fixed screen heights, no own global headers/nav. No card nesting. Minimum text11px secondary,14px body,16px inputs; touch controls44px. Use whitespace, rows and typography with purposeful art/figures. Rounded details12–20px. Both variants light themes; companion may use more narrative introductions and Avatar assistance, but quick tools remain efficient.

## Audit and coverage

Read docs/CODEMAP.md matching blocks first, feature docs §2 + §10, then representative production UI read-only. Record concise evidence and proposed adaptation in your owned `docs/design_3.0/<fuel|train|personal>-coverage.md` (not TODO lists). State exactly where mock behaviour differs. Do not invent working external AI, photo recognition, actual messages to friends, GPS or video. Can use real local exercise media discovered via docs/code or a clearly labelled original animated technique study with play/pause (prefer actual local media if available). User-facing tools must change state or navigate meaningfully; no fake button forest.
