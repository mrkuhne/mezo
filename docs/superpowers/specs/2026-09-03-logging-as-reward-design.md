# Logolás mint jutalom — `/nap/rutin` ünneplés-visszajátszás + erő-csík mozgás

- **bd:** `mezo-3zue.5` (epic: `mezo-3zue` Rutin-építő)
- **Előzmény:** S1 design (`docs/superpowers/specs/2026-09-02-routine-builder-design.md`),
  S2 backend (PR #373), S3+S4 frontend (PR #381)
- **Ground truth:** `docs/features/habit.md`
- **Dátum:** 2026-09-03

## 1. Miért

A keret-varázsló (`/me/rutin/uj`) 4. lépése bekéri a felhasználó saját ünneplés-mondatát
(`celebration`, FOGG-ág). Ma ez a mező sehol nem játszik: beírod, elmentődik, és soha nem
látod viszont. BJ Fogg szerint viszont épp az azonnali pozitív érzelem vési be a szokást,
nem az ismétlés — a mező addig dísz, amíg a tett pillanatában vissza nem jön.

Ez a szelet a `/nap/rutin` pipálás jutalom-pillanatát zárja be: a saját mondat visszajátszása
+ az erő-csík valódi mozgása.

**Terméken kívül marad:** a pipálás továbbra is KIZÁRÓLAG a `/nap/rutin` oldalon történik.
Ez a szelet nem visz pipáló kontrollt egyetlen rutin-felületre sem.

## 2. Viselkedés

Pipáláskor (`tickAction` `case 'check'`), a mai reward-toast fölött:

1. **Ünneplés-sor** — ha a bepipált szokásnak van `celebration` szövege, a toast egy plusz
   sort kap a cím alatt, a mérőcsík fölött: a felhasználó saját mondata.
2. **Erő-csík csusszanás** — a sor `.nr-str` csíkja átcsusszan a régi értékről az újra,
   amint a friss `strengthPct` megérkezik.

**Nincs generikus fallback.** Szöveg nélküli szokásnál a toast pontosan a mai marad. A
generikus „Ez az!" a kutatás szerint (Robinhood-konfetti) leértékelné a valódi, személyes
ünneplést is — és a mechanika hitelessége épp abból jön, hogy a mondat a felhasználóé.

**Nincs nudge sem** ebben a szeletben: aki nem írt ünneplést, annak a felület nem szól rá.
A felfedezhetőség a varázslóé és a szokás-oldalé.

### Időzítés és mozgás

| Elem | Érték | Indok |
|---|---|---|
| erő-csík szélesség-átmenet | 380 ms | NN/g: a több elemet mozgató átmenet sávja 200–500 ms; 500 ms felett lassúságként kódolódik |
| toast auto-hide | 4000 ms (változatlan) | a meglévő `AUTO_HIDE_MS.reward` |
| pipa-állapotváltás | 120 ms (változatlan) | a meglévő `.nr-tick` transition |

`prefers-reduced-motion: reduce` alatt a csík **ugrik** az új értékre (`transition: none`),
a toast a már meglévő `is-reduced` ágán megy. A jutalom-pillanat információtartalma megmarad,
csak a mozgás tűnik el — ez a bevált fokozatváltás-minta, nem „animáció ki".

### Trigger-hatókör

Szokásonként, a saját szövegével — nem „a nap első pipája". Egy szokás naponta egyszer
pipálható, tehát a gyakorlatban ez egyszerűen „pipáláskor". Kipipálás → visszavonás → újra
pipálás esetén az ünneplés újra lejátszik; ezt **nem** őrizzük külön állapottal, mert
szándékos, kétlépéses felhasználói gesztus, nem véletlen ismétlés.

## 3. Adatút

A `celebration` **nincs rajta** a napi lekérésen: a `HabitResponse`
(`api/feature/habit/habit.yml:215-232`) csak a sor megjelenítéséhez kellő mezőket viszi, a
keret-mezők a katalógus-olvasás (`HabitDefAdmin`, `:290-311`) dolgai. Ezt a szeletben **nem
bővítjük**.

Helyette FE-oldali join: a `NapRutinPage` már ma is mountolja a `useHabitCatalog()`-ot
(daypart-bucketing + ikonok miatt), tehát az adat új huzal nélkül a lapon van.

Új tiszta függvény:

```
frontend/src/features/today/logic/habitCelebration.ts
  celebrationFor(catalog: HabitCatalog, habitKey: string): string | null
```

A `tickAction` `case 'check'` ága ezt hívja, és átadja a `buildHabitRewardToast`-nak.

**Ha a katalógus üres** (hálózati hiba, vagy a `realEmpty: {chains:[]}` / 60 s stale ablak),
`null` jön vissza — pontosan a „nincs ünneplés" ág. A degradáció csendes és helyes, nem
kell külön kezelni.

**A `routineSentence.ts` érintetlen.** Az ünneplés itt nyers mezőként jelenik meg, nem
mondatba szőve — nincs második magyar prózagyártó (habit.md §6).

> Ha egy későbbi szelet (pl. S6, esemény-kötésű horgony) több keret-mezőt kér a napi soron,
> akkor érdemes egyben bővíteni a `HabitResponse`-t — nem most, egyetlen mezőért.

## 4. Toast

`RewardToast` (`shared/lib/toastBus.ts`) új opcionális mezője:

```ts
/** a felhasználó saját ünneplés-mondata (FOGG celebration) — a tett pillanatában visszajátszva */
celebration?: string
```

A `RewardBody` (`shared/ui/ToastProvider.tsx`) saját sorban rendereli, a cím alatt és a
mérőcsík fölött, `.t-celebrate` osztállyal.

A `meta` marad, ami: rövid mennyiségi addendum a cím **mellett** („2000 ml"). Az ünneplés a
felhasználó saját hangja, nem addendum — ezért kap külön sort, és nem a `meta`-t foglalja el.

`buildHabitRewardToast` inputja egy `celebration?: string | null` mezővel bővül; üres/`null`
esetén a mező kimarad a payloadból (a meglévő `...(x ? {x} : {})` idióma).

## 5. Erő-csík

`.nr-str div` kap egy `transition: width 380ms cubic-bezier(0.25, 0.8, 0.35, 1)`-et. A
belépő `scaleX` animáció (`.mz-play .nr-str div`) változatlan: mountoláskor a szélesség már
a helyén van, tehát a kettő nem ütközik.

A `@media (prefers-reduced-motion: reduce)` blokk meglévő `.nr-str div` sora kiegészül
`transition: none`-nal.

### Mock-arm: a csík mock módban is mozduljon

Ma a `patchMock` (`data/habit/habitHooks.ts:62-71`) csak `status`/`doneAt`-ot állít, a
`strengthPct`-et soha — enélkül a `VITE_USE_MOCK=true` arm vakon zöld lenne.

A backend képlete (`HabitService.strengthByKey:351-368`): `done / (done + missed)` a 28 napos
ablakon. Mock oldalon ezt tükrözzük: a megjelenített százalékot arányként véve hozzáadunk egy
„ma kész" napot —

```
next = round((p * C / 100 + 1) * 100 / (C + 1))
```

ahol `C` a `mockHabitSummary` adott szokásához tartozó `done28 + missed28`. Példa: 48% → 50%.
Kicsi, monoton, 100 felé konvergál, és nem talál ki új számformát.

`strengthPct == null` esetén marad `null` (a backend is `null`-t ad `minSample` alatt).

**Vállalt mock-korlát:** a `useHabitSummary` 28 napos aggregátuma mock módban nem mozdul
együtt a nappal — a napi sor csúszik, az összegző panel nem. Dokumentálva a habit.md
mock-eltérések listájában.

## 6. Mock-seed

Ma egyetlen pipálható mock-sor sem hordoz ünneplést: a `toDefInfo` (`habitMock.ts:89-118`)
fixen `celebration: null`-t ad, az egyetlen ünnepléses def (`bed_on_time`) pedig szándékosan
kimarad a napi nézetből (habit.md §9).

A `toDefInfo` kap egy kis keret-térképet, két pipálható MANUAL sorra:

| kulcs | lánc | keret | `celebration` |
|---|---|---|---|
| `morning_pushups` | MORNING | FOGG | `ökölbe szorított kéz + „ez az”` |
| `kitchen_close` | EVENING | FOGG | `lekapcsolom a lámpát és bólintok` |

Mindkét sor MANUAL és `pending` a mock napban, tehát ténylegesen pipálható. Mindkettőnek van
`anchorCopy`-ja (`napfény után`, illetve `vacsora után`), így a FOGG-keret teljes a backend
szabálya szerint (`HabitFrameworkValidator:37-44`: horgony — `anchorHabitKey` VAGY
`anchorCopy` — plusz `celebration`), és a mock nem ír le olyan állapotot, amit a valós oldal
elutasítana.

Így mindkét arc demózható, és a mock teszt-arm nem vákuum.

## 7. Tesztek

| Teszt | Mit fed |
|---|---|
| `habitCelebration.test.ts` | tiszta függvény: találat, hiányzó kulcs, üres katalógus, `celebration: null` |
| `NapRutinPage.test.tsx` | ünnepléses sor pipálása → a mondat a toastban; ünneplés nélküli sor → a mai toast változatlan. A stubolt katalógus `defs: []`-jét bővíteni kell |
| `rewardToast.test.ts` | a builder továbbadja / elhagyja a `celebration`-t |
| `habitHooks.test.tsx` | mock-arm: `check()` után a sor `strengthPct`-je a képlet szerint emelkedik; `null` marad `null` |

Kapuk: `pnpm exec tsc -b`, `VITE_USE_MOCK=false pnpm test`, `VITE_USE_MOCK=true pnpm test`,
`pnpm build`. Backend nem mozdul — nincs Testcontainers/ArchUnit felület.

Kötelező kísérők: `node scripts/gen-codemap.mjs` (új `today/logic/` fájl) és
`docs/features/habit.md` frissítés (§2 tick-felület, §9 mock-eltérések).

## 8. CSS-korlát

Csak a `frontend/src/styles/prototype.css`-ben **már létező** tokenek. Új hex nem mehet be,
még kommentbe sem (`mozaikCssTokens.test.ts` a kommenteket is nézi). A `.t-celebrate` a
meglévő toast-blokk (`:1319-1440`) tipográfiai és szín-tokenjeiből épül.

## 9. Prior art (researcher recon, szűrve)

- **Duolingo streak-mechanika** — https://apptitude.io/blog/how-duolingos-streak-mechanic-actually-works/ ,
  https://60fps.design/shots/duolingo-2-day-streak-animation — *átvéve:* kétrétegű modell, a
  napi ismétlődő eseményhez a leggyengébb, nem-blokkoló forma tartozik; *elvetve:* a teljes
  képernyős ünneplés napi eseményre (nálunk a `LevelUpProvider` overlay amúgy is tiltott
  szokás-pipára, habit.md §2).
- **„Why confetti celebrations backfire"** — https://uxplanet.org/why-confetti-celebrations-backfire-and-how-to-make-them-work-be838a6e7b8b ,
  https://builtformars.com/ux-glossary/gamification — *átvéve:* a jutalom legyen arányos és
  hiteles; ez a döntő érv a generikus fallback **elvetése** mellett.
- **NN/g — animation duration** — https://www.nngroup.com/articles/animation-duration/ —
  *átvéve:* a 380 ms-os csík-átmenet és a 200–500 ms-os sáv felső korlátja.
- **prefers-reduced-motion mint fokozatváltás** — https://css-tricks.com/almanac/rules/m/media/prefers-reduced-motion/ ,
  https://www.boia.org/blog/what-to-know-about-the-css-prefers-reduced-motion-feature —
  *átvéve:* nem kikapcsolás, hanem lecserélés; a csík ugrik, az információ megmarad.
- **Tiny Habits — celebration** — https://tinyhabits.com/rewire/ , https://tinyhabits.com/purpose/ —
  *átvéve:* az érzelemnek a viselkedés közben/közvetlenül utána kell jönnie, és a
  celebrationnek személyesen kell rezonálnia. **Fontos korlát:** a researcher nem talált
  gyártott app-precedenst a felhasználó saját mondatának automatikus visszajátszására — ez a
  rész zöldmezős, ezért a szelet szándékosan konzervatív (egy sor egy meglévő toastban,
  fallback nélkül, új vizuális réteg nélkül).

## 10. Codebase terrain (investigator recon, szűrve)

- **Érintett feature-blokkok:** `today` (a `/nap/rutin` oldal itt él, nem a `me` alatt),
  `habit` (FE-data mock-arm), `_platform-design-system` (toast-host + tokenek). A backend,
  a contract és a `me` oldalak **nem** mozdulnak.
- **Kulcsfájlok:**
  `frontend/src/features/today/pages/NapRutinPage.tsx:93-117` (`tickAction`, `case 'check'`),
  `:181-187` (a `.nr-str` csík),
  `frontend/src/features/progression/logic/rewardToast.ts:41-58` (`buildHabitRewardToast`),
  `frontend/src/shared/lib/toastBus.ts:17-31` (`RewardToast`),
  `frontend/src/shared/ui/ToastProvider.tsx:118-141` (`RewardBody`),
  `frontend/src/data/habit/habitHooks.ts:62-71` (`patchMock`),
  `frontend/src/data/habit/habitMock.ts:89-118` (`toDefInfo`),
  `frontend/src/styles/prototype.css:4885-4890` (`.nr-str`), `:4970` (reduced-motion blokk).
- **Követendő minták:** minden kontroll a meglévő `tickAction` switch-en megy át, nem
  mellette; a jutalom-visszajelzés tiszta builder → `emitToast` → az EGYETLEN toast-host
  (DS §2 item 7 — második `.toast-stack` tilos); egy mondat-renderer (`routineSentence.ts`);
  a mozgás kétszer védett (CSS media query + a runtime `useReducedMotion()` osztály);
  hookok kizárólag `@/data/hooks`-on át (habit.md §6).
- **Ismert csapdák:**
  1. `NapRutinPage.test.tsx` stubolt láncai `defs: []`-t hordoznak — bármely katalógus-join
     megbukik rajtuk, amíg nem bővítjük.
  2. A `.mz-play .nr-str div` belépő animáció mountonként egyszer fut (`EntranceGroup`);
     nem ez az újrajátszható mechanizmus — ezért megy a mozgás `width` transitionön.
  3. Mock módban `check()` `undefined`-ot resolvál (nincs `LevelUpResult`), a `meter` az
     `xp`-re esik vissza — az ünneplés-sor ettől független, mindig a katalógusból jön.
  4. A mock-arm `awardGamificationEvent`-je nem idempotens; a szelet **nem** vezet be új
     pipáló kontrollt, tehát ez nem aktiválódik.
  5. Éjfél után a pipa a KÖVETKEZŐ nap sorát írja (habit.md §9) — a szelet nem vezet be
     napra épülő heurisztikát, tehát ezt nem örökli.
  6. `frontend/tests/visual/visual.spec.ts` ma nem tartalmaz `/nap/rutin` útvonalat, tehát
     nincs vizuális baseline-mozgás — nem is adunk hozzá ebben a szeletben.

## 11. Nyitott adósság, amit ez a szelet NEM old meg

- `useHabitDay().levelUps` a `/nap/rutin`-on soha nincs elfogyasztva (`consumeLevelUps()`
  hívatlan) — egy olvasáskor landoló DERIVED teljesítés ma néma. Külön kérdés, nem ezé a
  szeleté.
- `docs/features/habit.md` §5 még `/me/growth`-ként hivatkozza a Rutin felületet, §2 már
  helyesen `/me/rutin`-ként; és a §2/§7/§9 „a sor semmi mást nem rajzol" állítása elavult
  (a `linkUrl` cím-link visszakerült, `mezo-d20.11`). Ezt a doc-frissítés menet közben
  javítja.
