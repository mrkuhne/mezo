# F7.4 — Én mély kör: életterület-ikonok, cél-tervező, rutinok, a progresszió otthona

- **bd:** mezo-d20.8.4 (design) · mezo-d20.8.4.1 (dev)
- **Prototípus:** `docs/design_2.0/prototypes/en-mely.html` · artifact `d7744124-37bb-4e7d-ac57-45cf66f1fc24`
- **Jóváhagyva:** 2026-08-31 (Daniel) — első körben, iteráció nélkül.
- **Terjedelem:** FE-only + sprite-bővítés. Nulla kontraktus-változás.
- **Nyitott kérdések döntése** (a prototípus ajánlott defaultjai): a streak+címek a
  Kitüntetések fül tetejére kerülnek (nem külön fül); a hub 🔥/🪙 chipjei a clay
  láng/érme ikonra váltanak (a kör témája: emoji→clay); az AI-payload elhalványuló
  levágással jelenik meg („mutasd mind" nélkül — a teljes szöveg úgyis másolható marad
  a kártyán belüli görgetés nélkül is elég rövid, a levágás vizuális).

## A · Életterület-ikonográfia (8 clay szimbólum)

Az `assets/clay-icons.svg`-ben él a 8 új szimbólum (`i-life-tudatossag`, `i-life-szemlelet`,
`i-life-konyha`, `i-life-penzugyek`, `i-life-produktivitas`, `i-life-tanulas`,
`i-life-kapcsolatok`, `i-life-regeneracio`) + 3 új gradiens (`ig-life-eye/pan/pillow`).
Ezek VERBATIM másolódnak a frontend clay sprite-jába. A `LIFE_SKILLS` meta
(`features/progression/logic/levelUpMeta.ts`) `clayIcon` mezőt kap; a consumerek a
clay ikont renderelik az emoji helyett:
- GrowthPage LIFE skill-sorok (a `toRows` iconOf-ja),
- GratitudeRows életterület-chipek (ikon + magyar név),
- ReflectionStep (Napzárás act-3 — a hála-chipek a GratitudeRows-on át),
- level-up/gain meta ahol a LIFE ikon megjelenik.
Az emoji mező marad fallbacknek ott, ahol clay nem renderelhető (pl. plain-text kontextus).
Guard: a 8 LIFE emoji (🧘🌱🍳💰🎯📚🤝🛌) nem fordulhat elő a fenti komponensek
renderelt kimenetében.

## B · Cél-tervező (GoalPlannerPage) — arc-csere, szerkezet marad

A 2 lépés és a mezőkészlet változatlan (G6). Chrome: MozaikPage(coral) + PageHead,
wizard-progress a Mozaik-nyelven, trajektória-kártyák (`.trajcard` minta: kiválasztva
korall keret + wash), guard-chipek, fcard-mezők, a feasibility-panel sage/borostyán
wash-kártya (a borostyán ✚ „Reális dátum — Elfogadom" gomb marad). A viselkedés
(useFeasibilityPreview debounce, save-útvonalak, guardok) érintetlen.

## C · Rutinok (RoutineEditorPage + sheetek)

Oldal: MozaikPage(gold) + PageHead + hero. Chain-kártyák mz-qcard formán; a napszak-emojik
(🌅☀️🌙) helyét MEGLÉVŐ clay ikonok veszik át (i-hajnal / i-nap / i-alvas) — új szimbólum
nem kell. Habit-sorok: grip + cím + XP-chip + mód-chip + toggle. A HabitEditSheet skill-
választója a clay életterület-ikonokkal renderel. ChainEdit/AiSuggest a családi mintán.
Viselkedés (reorder, seed-védelem, PATCH-szemantika) érintetlen.

## D · A progresszió otthona: Growth

- A GrowthPage Kitüntetések füle a tetején két új blokkot kap:
  1. **Streak-kártya** (korall wash): clay láng + nap-szám + következő mérföldkő sor
     (7→50 / 30→150 / 100→500 érme) + mérföldkő-sáv + 🧊 mentő-chip (nálad: n/2, vétel 200).
  2. **Címek szekció** (qcard): érme-egyenleg (clay érme ikon), viselt cím sor,
     Létra/Bolt segment, cím-sorok a Viselve/Felvesz/Megveszem/🔒 állapotgéppel
     (a TitleShopSheet teljes tartalma + a bolt-fül streak-mentő sora).
- A **StreakSheet és a TitleShopSheet MEGSZŰNIK** (komponens + teszt törlés); az AppHero
  🔥/🪙 chipjei a clay láng/érme ikonra váltanak és a `/me/growth`-ra navigálnak úgy,
  hogy a Kitüntetések fül nyíljon (a tab-állapot query-parammal vagy location state-tel
  mélylinkelhető — a GrowthPage lokális tab-state-je kap egy induló-fül propot/olvasót).
- A `canMutate` bolt-gating logika költözik, nem változik.

## E · People + Sleep sheetek — tartalmi tagolás a családi mintán

- PersonDetailSheet: rose tónusú mz-sheet-hero (avatar + kadencia + említés-számok),
  a tudás/említések fcard-okban. PersonLogSheet: mic-hero sáv. PersonEditSheet: fcard-ok.
- SleepLogSheet: lav mz-sheet-hero (időtartam-gyűrű + lefekvés→ébredés + fázis-sín
  screenshot-módban), a minőség-rács és a chipek fcard-okban; az éjszaka-nyom jegyzet
  saját lav wash-sorban. SleepGoal/SleepStats: fcard-tagolás.
- Viselkedés (night-trace előtöltés+törlés, screenshot-flow fázisok, validációk) érintetlen.

## F · AI-hívás detail (AiCallDetailPage)

MozaikPage(sky) + PageHead(‹ AI-használat) + hero (feature·operation + idő/kind/modell
al-sor) + statstrip (össz-token · költség · válaszidő) + token-sáv kártya (prompt/
gondolkodás/válasz/cache szegmensek + legenda) + meta-chipsor (kért/kiszolgált modell,
hívó, szint, lezárás) + payload-kártyák elhalványuló levágással (a retention-törölt
állapot őszinte jegyzete marad). Hiba/megszakadt sávok wash-kártyán.

## Tesztek és kapuk

- Ikon-guard: a LIFE emojik nem jelenhetnek meg a Growth/Gratitude/Reflection renderben
  (mutáció-ellenőrzött mindkét irányban).
- GrowthPage: Kitüntetések-fül blokkok + a hub-chip navigáció + a két sheet törlésének
  zero-consumer ellenőrzése; GoalPlanner/RoutineEditor/AiCallDetail meglévő tesztei
  átírva a Mozaik-assertekre; sheet-tesztek zöldön.
- Goldenek: cél-tervező (2. lépés), rutinok, Growth-Kitüntetések, AI-hívás detail +
  egy sheet-shot — mindkét platform.

## Ütemezés

Egy PR, TDD-slice-okban: (1) sprite + LIFE consumerek + guard, (2) GoalPlanner,
(3) RoutineEditor + sheetjei, (4) Growth-otthon + sheet-törlés + hub-chipek,
(5) People/Sleep sheetek, (6) AiCallDetail, (7) goldenek + docs (me.md, CODEMAP).
