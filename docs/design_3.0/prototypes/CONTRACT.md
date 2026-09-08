# Prototype integration contract

User explicitly approved building all three exploratory prototypes before selecting an art direction. This is a standalone React/Vite mock app, outside frontend/src. No production changes. Driver mezo-88jw.2.

Three directions: `measure` (Mérték, precise editorial instrument), `rhythm` (Ritmus, warm guided day), `grove` (Liget, immersive botanical companion). Each must use genuinely different compositions, not only colors. Hungarian UI. Minimum touch targets 44px, normal input font 16px, responsive 360–460px mobile content and desktop previews. Do not use emoji as icons. Main content must not be buried beneath oversized introductions. One contextual header and five consistent tabs, supplied by root shell.

Each variant owns ONLY `src/variants/Name.jsx` and `src/variants/name.css` and optional variant-local tests. Export default `function Name({page, api})`. `page` is `home|train|fuel|mezo|chat`. Render page body ONLY, shell handles main navigation, header, scrolling, dialog and details. CSS must be scoped to `.theme-measure`, `.theme-rhythm`, `.theme-grove`. Prefix custom classes m-/r-/g-. Root sets class on whole app and shared details.

Imports available from `../shared.jsx`: `Icon({name,size=20,...})` (Lucide names: sun,moon,arrow-right,arrow-up-right,arrow-left,plus,check,chevron-right,play,pause,send,mic,heart,sparkles,dumbbell,utensils,droplet,clock,flame,leaf,activity,chart,book,settings,x,search,coffee,more,headphones,target,calendar,chevron-down,volume,rotate,wind,zap), `Avatar({state='idle',size=120,className=''})` (actual Avatar Lab renderer), `Sparkline({values=[...],color,height=64,fill=false})`, `Ring({value,max=100,size=100,width=7,label,color})`, `Chat({api})` (functional shared chat, variant CSS overrides), `FoodArt({kind='bowl',className=''})` (SVG bowl/oats/salmon), `WorkoutArt({className=''})` (SVG training illustration).

api shape:
```
{
 state: { water:1750, meals:[{id,name,kcal,protein,carbs,fat,time,kind}],
   completedSets:[], workoutFinished:false, routineDone:false,
   patternConfirmed:false, messages:[{id,role:'assistant'|'user',text}],
   daypart:'morning'|'day'|'evening' },
 nutrition: {kcal,protein,carbs,fat}, // sum meals, defaults 1260 kcal, 92g protein
 remaining: 1140, // 2400 minus sum
 go: (route) => void, // 'home','train','fuel','mezo','chat','workout','meal','pattern','week','routine','avatar','sleep','journal','goals'
 back: () => void,
 water: () => void, // +250 ml, toast + avatar response
 logFood: (food) => void, // root meal search normally handles this
 toggleSet: (key) => void, // keys '0-0' etc
 finishWorkout: () => void,
 completeRoutine: () => void,
 confirmPattern: () => void,
 send: (text) => void, // scripted local mock reply
 typing: false,
 toast: (text) => void
}
```

Stable common mock story: Daniel, Tuesday September 8. Sleep 7h42, recovery 82/100, planned Pull Day at 17:30, 4 exercises/12 sets/45min, nutrition target 2400kcal/160g protein, water target 2500ml. Meals: breakfast oats 460kcal/28P; lunch chicken bowl 620kcal/52P; snack yogurt 180kcal/12P. Personal AI finding: evening walk associated with +34min sleep across 12 observed days (explicit association, not causality). Weekly: 3 workouts, 18.4km, average sleep7h28. All numbers illustrative. No clinical recommendations. Demo label lives outside app in prototype toolbar; chat also says 'Próba-beszélgetés · előre megírt válaszok'.

Home: immediate state, next meaningful action, schedule or contextual day path, water quick action, companion entry, weekly review entry, routine/check-in via routine. Train: next session, start action, week rhythm, workout history/progression or exercise preview. Fuel: energy/macros, clear meal add, three meal entries, water, recipe/meal planning affordance opens meal. Mezo: visible companion, daily synthesis, pattern detail, weekly reading, memory/context via pattern or journal, direct chat. Chat: use shared Chat and design surroundings sparingly. Avatar controls page supplied by root, linked from Mezo (go('avatar')).

Root owns history, shell, data/actions, rich detail flows, avatar integration, build, tests and docs. Variant authors should write intentional design, not reimplement actions or browser state. No dead buttons: wire to api.go or meaningful api action. Do not invent unavailable imports. Do not modify another agent's files. No git commits; root integrates and commits. Root runs common state TDD plus browser interaction QA. Variant components are reversible visual mockups; no mirroring snapshot tests needed.
