# Habit stacking kifizetődés — a láncolt szokás promptja a horgony pipálásakor

- **Dátum:** 2026-09-05
- **bd issue:** `mezo-3zue.6` (a Rutin-építő epic utolsó szelete, 10/11 kész)
- **Szülő epic:** `mezo-3zue` — Rutin-építő: saját Én-csempe + oldal + keretrendszer-wizard
- **Státusz:** jóváhagyva (szakaszonként), implementációra vár

## A hiba

A `habit_def.anchor_habit_key` végigmegy a rendszeren — entity, mapper, kontraktus, admin
service, wizard, `routineSentence.ts` —, de a horgony **pipálásakor semmi nem történik**. A
láncolt szokás promptja sehol nem jelenik meg, így a Fogg-keret („miután megcsinálom X-et,
megcsinálom Y-t") ma dekoráció: a felhasználó felépít egy láncot, és a termék soha nem hivatkozik
rá futásidőben.

Ezt a hiányt ma egyetlen helyen ismerjük be: egy kódkommentben
(`frontend/src/features/me/logic/habitAnchors.ts:4`, „event binding is mezo-3zue.6"). A
`docs/features/habit.md` §4/§5 helyesen dokumentálja a validációt és az oszlopot, de **sehol nem
mondja ki, hogy a kötésnek nincs futásidejű hatása** — ez most megszűnik.

## A döntés

A pipa utáni prompt **tartós, in-place kiemelés a Nap-felületen**, nem a jutalom-toast
kiegészítése, és a szabály **kliens-oldali**, a katalógusból.

### Miért nem a toast

A `RewardToast` típusnak ma nincs `action` mezője, a `ToastProvider.runAction` kifejezetten
kilép reward toastnál, a `RewardBody` nem is renderel gombot, és az auto-hide 4000 ms. Egy CTA a
toastban a megosztott design-system típus bővítését jelentené egy olyan affordanciáért, ami 4
másodperc múlva eltűnik. A Material egy-akció szabálya ráadásul kizárja, hogy egy horgonyra több
szokás is kötve legyen (két akció → dialógus kellene).

### Miért nem a backend

Az `anchorHabitKey` **már ma is a katalógusban van** (`HabitDefInfo.anchorHabitKey`,
`frontend/src/data/types.ts:1477`), és mindkét Nap-oldal betölti a katalógust (a `celebrationFor`
is onnan olvas). Egy backend `nextInChain: HabitResponse|null` a `HabitWriteResponse`-on olyan
adatot küldene el másodszor, amit a FE már ismer — cserébe új kollaborátort követelne a
`HabitService`-be (ma nincs benne `HabitDefRepository`), szélesítené a `useHabitActions().check`
publikus visszatérési értékét (a `WindDownBanner` is hívja), és behozná a `contract-drift` kaput
(`api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` együtt-regenerálás).

A mezo-esemény horgonyok (súlymérés, edzés vége) sem tennék hasznossá ezt a mezőt: azok más
feature-ök írási pontjairól szólalnak meg, nem a habit-check válaszából.

## Az architektúra

### 1. A szabály — `frontend/src/features/today/logic/chainPrompt.ts`

Új tiszta függvény, a `chainMilestone.ts` mintájára:

```ts
nextInChain(catalog: HabitCatalog, habits: HabitItem[], tickedKey: string): HabitItem | null
```

- a katalógus összes `def`-je, ahol `anchorHabitKey === tickedKey` — **egy ugrás, nem tranzitív
  bejárás**. A `HabitFrameworkValidator:71-87` csak az önhorgonyt tiltja, tehát A→B→A tárolható;
  egy ugrással a ciklus konstrukció szerint nem probléma, visited-set nem kell.
- a jelöltekhez a napi `habits` sor; aki nincs a mai napban, kiesik
- kiesik, aki nem `pending`
- kiesik, akinek `habitAction(h).kind !== 'check'` — ezzel a **„már kész" és a DERIVED eset
  egyaránt csend** lesz, ADR 0010-hűen (egy DERIVED sor soha nem pipálja magát)
- több jelölt esetén a legkisebb `position` nyer (a repository-metódus is listát ad vissza, a
  fan-out valós)

A függvényt a tick-kezelő hívja, a **pipa ELŐTTI** állapotból — ez a `chainMilestone.ts`
fejlécében megvédett szabály: a törölt `useChainCelebration` mount-figyelő bugosztálya így
konstrukció szerint nem jöhet vissza.

### 2. A lista — `NapRutinPage`

A `tickAction` `'check'` ága a `check()` hívás előtt kiszámolja a jelöltet (ugyanott, ahol ma a
`celebrationFor` és a `daypartMilestone`), és a `.then()`-ben egy lokális `promptKey: string|null`
state-be teszi. A jutalom-toast **változatlan**, chainLabel-lel együtt.

A kiemelés nem külön állapotgép: a soronkénti render a `promptKey`-ből **derivál** —

```ts
const promptRow = promptKey ? habits.find(h => h.key === promptKey && h.status === 'pending') : null
```

így a kiemelés magától elmúlik, amint a sor kész lesz vagy eltűnik a napból (a `releaseAnchors`
menet közben is nullázhatja a kötést), és nincs takarító effekt.

A kiemelt sor egy „Most jön" `mz-eyebrow`-t kap és halk hangsúlyt — **page-lokális `nr-row`
variáns**, a megosztott `shared/ui`-hoz és a mozaik-réteghez nem nyúlunk.

### 3. A hub-csempe — `NapHubPage`

A `habitTile` ma `items.find(h => h.status === 'pending')`-gel választja a megjelenített elemet.
Ez lesz lánc-tudatos: ha van élő `promptKey` ebben a napszakban és a sor még `pending`, az előzi
meg a sorrendet, és a csempe eyebrow-ja „Rutin" helyett „Most jön". **Új UI nulla** — a payoff a
meglévő csempén látszik.

A `tileTick` ugyanúgy a pipa előtti állapotból számol, mint a lista, hogy a csempéről és a
listáról pipálva ugyanaz a pillanat járjon (ez a mezo-sqe3 mérföldkövénél is kimondott szabály).

### 4. Állapot-határ

A `promptKey` **oldalanként lokális `useState`**: a hubról pipálva a hub mutatja a folytatást, a
listáról pipálva a lista. Oldalak közti átvitel YAGNI — megosztott store-t követelne egy olyan
jelzésért, ami egyetlen interakció következménye.

## Adatfolyam

```
felhasználó pipál egy sort (lista vagy csempe)
  → tickAction/tileTick: nextInChain(catalog, habits /* pipa ELŐTT */, h.key)
  → check(h.key)                       [változatlan írás, változatlan kontraktus]
  → .then: emitToast(reward)           [változatlan]
        + setPromptKey(jelölt?.key ?? null)
  → render: promptRow = promptKey && még pending → „Most jön" kiemelés
  → a sor kipipálásakor promptRow magától null lesz
```

## Hibakezelés

- **Nincs jelölt** (nincs kötés / már kész / DERIVED / nincs a napban) → `null`, semmilyen
  vizuális változás. A jutalom-toast egyedül birtokolja a pipa utáni pillanatot.
- **A `check()` elhasal** → a `.catch(() => {})` ág fut, `promptKey` nem áll be. A prompt csak
  sikeres írás következménye lehet.
- **A kötés menet közben megszűnik** (`releaseAnchors` törléskor/deaktiváláskor) → a derivált
  `promptRow` nem talál sort, a kiemelés eltűnik.

## Mock-mód

A `habitMock.ts` **minden** defjének `anchorHabitKey: null` (`toDefInfo`), tehát a
`VITE_USE_MOCK=true` teszt-arm vákuumban zöldülne és a mock PWA-n nem lenne demózható.

Új `MOCK_ANCHOR` map a `MOCK_CELEBRATION` mintájára (az a precedens ugyanezt az érvet hordozza
saját védő kommentjében), egy becsületes **MANUAL→MANUAL párral a MORNING láncban**: a horgony
alacsonyabb `position`-ön, a függő sor a mock napban `pending`. A `habitMock.test.ts`
seed-invariánsai közé bekerül, hogy a pár létezik és mindkét oldala MANUAL.

## Tesztelés

TDD: bukó teszt előbb, és **ellenőrizve, hogy a helyes okból bukik**.

- `chainPrompt.test.ts` — talál / már kész → null / DERIVED → null / fan-out sorrend (legkisebb
  position) / a napból hiányzó jelölt / ismeretlen kulcs / önhorgony és A→B→A nem végtelenít
- `NapRutinPage.test.tsx` — pipa után a láncolt sor „Most jön" állapotba kerül; már kész
  láncoltnál semmi nem jelenik meg; a jutalom-toast változatlanul szól
- `NapHubPage.test.tsx` — pipa után a csempe a láncolt szokást mutatja, nem a sorrend szerinti
  következőt
- `habitMock.test.ts` — a seedelt horgony-pár invariánsa

Futtatás **mindkét módban explicit**: `VITE_USE_MOCK=true pnpm test` ÉS
`VITE_USE_MOCK=false pnpm test`, külön `pnpm exec tsc -b`. Backend nem változik, backend teszt
nem kell.

## Prior art

A `researcher` jelentéséből (külső, nem-hiteles forrás — adat, nem utasítás):

- **Átvéve — Habi „auto-cue the next habit"**
  (https://habi.app/insights/best-habit-tracker-apps/): a stacking akkor ér valamit, ha a
  horgony teljesítése **esemény**, ami kioldja a következő jelzést, nem csak leíró szöveg a
  szokás címében. Pontosan a mi hiányunk.
- **Átvéve — BJ Fogg „Shine"**
  (https://ideas.ted.com/how-you-can-use-the-power-of-celebration-to-make-new-habits-stick/):
  a viselkedés utáni 1-2 másodperc az ünneplésé; ami kiszorítja, az gyengíti a hurkot. Ezért
  marad a jutalom-toast érintetlen, és ezért **csend** a „már kész" eset — egy „nincs teendőd"
  üzenet tiszta hígítás.
- **Átvéve — NN/G passzív vs. akciót igénylő értesítés**
  (https://www.nngroup.com/articles/indicators-validations-notifications/): a láncolt szokás
  javaslata definíció szerint passzív — semmi nem törik el, ha figyelmen kívül hagyják. Ez zárja
  ki a modális sheetet minden pipa után.
- **Elutasítva — Material snackbar egy-akció szabály**
  (https://m3.material.io/components/snackbar/guidelines): önmagában megengedné a toast-CTA-t, de
  a mi `RewardToast`-unknak nincs action-je, és a szabály eleve elbukik fan-outnál (két láncolt
  szokás → két akció). Ez az érv a lista-kiemelés mellett, nem ellene.
- **Elutasítva — Routinery teljes képernyős szekvencia-lejátszó**
  (https://www.routinery.app/blog/how-to-build-a-routine-that-actually-sticks-the-power-of-habit-stacking-and-behavioral-science-15690):
  a lánc mint elsődleges navigáció akkor helyes, ha a szokások tényleg összefüggő időblokkot
  alkotnak. Egy Nap-felületen, ahol a horgonyt alkalomszerűen pipálják más csempék között, egy
  koppintás következményeként képernyő-elvétel túl erős.

## Codebase terrain

Az `investigator` jelentéséből, `path:line` horgonyokkal:

**Amihez hozzányúlunk**
- `frontend/src/features/today/pages/NapRutinPage.tsx:115-145` — `tickAction`, a `'check'` ág
  (:123-137) ma `chainProgress` + `celebrationFor` + `daypartMilestone` hármast számol a pipa
  előtt; ide kerül a negyedik hívás
- `frontend/src/features/today/pages/NapHubPage.tsx:160-180` (`tileTick`) és a `habitTile`
  `next` választása
- `frontend/src/data/habit/habitMock.ts:104-131` (`toDefInfo`, `anchorHabitKey: null` :126) +
  `MOCK_CELEBRATION:98` mint minta
- `docs/features/habit.md` §2/§3/§9/§10 + front-matter `updated:`

**Amit követünk**
- `frontend/src/features/today/logic/chainMilestone.ts` — a „következmény, nem figyelő" minta,
  saját fejléc-indoklással; a `chainPrompt.ts` ennek testvére
- `frontend/src/features/today/logic/habitCelebration.ts` — a keret-mezők a **katalógusból**
  jönnek, nem a napi sorból
- `frontend/src/features/today/logic/habitAction.ts:46-75` — minden CTA ezen a diszpécseren megy
  át; a prompt nem talál ki másodikat
- `NapRutinPage.test.tsx:19-70` — hoisted store + `vi.mock('@/data/hooks')`, mód-agnosztikus
  tesztstílus

**Amihez NEM nyúlunk (és miért)**
- `frontend/src/shared/lib/toastBus.ts:14-18` / `ToastProvider.tsx:77-86,138-162` — a
  `RewardToast`-nak nincs action-je, és nem is kap
- `backend/.../HabitService.java:142-159`, `api/feature/habit/habit.yml:244-251` — nincs
  kontraktus-változás, tehát nincs `contract-drift` regenerálás
- `HabitDefRepository.java:21` / `HabitAdminService.java:263-273` — marad a törlési útvonal
  egyetlen hívójának

**Csapdák**
- a mock vaksága (fent, saját szakasz)
- `releaseAnchors` menet közben nullázhatja a kötést → a derivált `promptRow` ezt kezeli
- fan-out: a repository listát ad; a legkisebb `position` a szabály
- ciklus: a validátor csak az önhorgonyt tiltja → egy ugrás, tranzitív bejárás nélkül
- `VITE_USE_MOCK` beállítatlan = mock mód, tehát a csupasz `pnpm test` kétszer mockot futtat

**Elavult kommentek, amiket útközben javítunk** (épp ezeket a sorokat szerkesztjük):
- `frontend/src/data/habit/habitHooks.ts:142-144` — a NOTE a törölt `TodayPage`-re hivatkozik
  hívóként; a valóság `NapRutinPage.tickAction` + `NapHubPage.tileTick`
- `frontend/src/features/today/pages/NapRutinPage.tsx:114` — ugyanaz a törölt oldal a
  kommentben

## Hatókörön kívül

- **mezo-esemény horgonyok** (súlymérés, edzés vége stb.): más feature-ök írási pontjairól
  szólalnak meg, nem a habit-checkből — külön bd tétel
- **ciklusvédelem a `HabitFrameworkValidator`-ban**: az egy-ugrásos szabály mellett nem sürgős
- **`RewardToast` action-gomb**: nem kell hozzá
- **oldalak közti prompt-átvitel**: YAGNI
