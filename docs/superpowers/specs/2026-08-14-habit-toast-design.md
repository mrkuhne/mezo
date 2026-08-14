# Habit-pipa → reward toast — design

**Dátum:** 2026-08-14 · **bd:** `mezo-k5sa` · **Mockup:** [`2026-08-14-habit-toast-mockup.html`](2026-08-14-habit-toast-mockup.html)
**Státusz:** jóváhagyva (design), implementációs terv következik

---

## 1. A probléma

Egy habit pipálása a Today-en teljes képernyős `LevelUpScreen` overlayt nyit: elfedi a napot,
animált XP count-upot játszik, és egy `Tovább ›` CTA-t kér a felhasználótól. Ez a felület a
**post-workout** pillanatra készült (gym/sport/run — ritka, súlyos, megérdemli a megállást). Egy
reggeli szokás kipipálása napi 5-10-szer történik; ugyanaz a ceremónia ott aránytévesztés.

A design system **már tartalmazza a helyes primitívet**:
[`docs/references/design-system-mezo.html` §Notification · Toast system](../../references/design-system-mezo.html)
— top-right anchor, reward variáns (eyebrow + Fraunces cím + meter sor), stackelés, auto-dismiss.
A mai `ToastProvider` ennek csak a csontváza: egy toast egyszerre, egyszínű háttér, csak `text`.

**Egy másik, ma élő hiba ugyanebből fakad:** mivel egyszerre csak egy toast él, a lánc-záró
„🌅 Tökéletes reggel" ünneplés (`useChainCelebration`) **felülírja** az utolsó pipa visszajelzését.

**Mód-divergencia is van:** mock módban a habit-check `undefined`-ot ad vissza (nincs `levelUps`),
így soha nem jön full-screen — helyette a `gamificationStore.awardGamificationEvent` egy generikus
`+10 XP` toastot emitál. Real módban full-screen jön. A két mód ma **nem ugyanazt csinálja**.

## 2. Cél és hatókör

**Cél:** a Today minden „valamit teljesítettem" visszajelzése a DS reward toastja legyen — a nap
látható marad, semmit nem kell megnyomni, és a két mód ugyanúgy viselkedik.

**Hatókörben (5 hívóhely):**

| # | Hívóhely | Mit vált ki |
|---|---|---|
| 1 | [`TodayPage.tsx:289`](../../../frontend/src/features/today/pages/TodayPage.tsx) — `act()` `check` ág | kézi habit-pipa (mindhárom daypart-arc) |
| 2 | [`TodayPage.tsx:150-155`](../../../frontend/src/features/today/pages/TodayPage.tsx) — quest consume-effekt | szerver-oldalon kiértékelt quest-teljesítés |
| 3 | [`TodayPage.tsx:156-161`](../../../frontend/src/features/today/pages/TodayPage.tsx) — habit consume-effekt | DERIVED habit, amit a napi olvasás értékelt ki |
| 4 | [`DaypartEvening.tsx:109`](../../../frontend/src/features/today/components/DaypartEvening.tsx) | `wind_down` pipa a WindDownBanneren |
| 5 | [`DailyQuestsCard.tsx:29`](../../../frontend/src/features/today/components/DailyQuestsCard.tsx) · [`ActivityLogSheet.tsx:33`](../../../frontend/src/features/today/sheets/ActivityLogSheet.tsx) | quest-kártya + activity-naplózás |

**Hatókörön kívül — szándékosan:**
- A **Train-flow-k** (`ActiveWorkoutPage`, `SportPage`, `TrainTodayPage`, `RunningPage`) `showLevelUp`
  hívásai **változatlanok**. Az edzés lezárása megérdemli a full-screent; a `LevelUpScreen`,
  `LevelUpProvider` és `useLevelUp()` érintetlen marad.
- A **push notification** platform (`_platform-notifications.md`) — az másik réteg, nem érintjük.
- A DS referencia-implementációjának **config rétege** (`REWARD_CONFIG` / `useReward`): nálunk az
  XP-számítás és a szint-küszöb a **backend** `ProgressionService`-ében él. Egy FE-oldali config
  réteg ezt duplikálná és két igazságforrást csinálna. YAGNI — a payload-builder réteg nálunk
  **egyetlen pure függvény**.
- A másik 9 domén `awardGamificationEvent` hívása (súly/alvás/check-in/étkezés/…) — maradnak a mai
  generikus `+X XP` toastnál. Egyedül a habit-check kap gazdagabb visszajelzést.

## 3. Döntések

| Kérdés | Döntés | Miért |
|---|---|---|
| Mi legyen valódi szintlépéskor (`levelAfter > levelBefore`)? | **Toast, itt is** — a toast kap egy `★ LEVEL UP · <skill> · Lv3 → 4` badge-et | Egy szokás-pipa soha ne szakítsa meg a napot. A full-screen az edzés-flow-k privilégiuma marad. |
| Quest + derived habit is átáll? | **Igen, mind az 5 Today-forrás** | A Today-en egyetlen konzisztens visszajelzési nyelv legyen; egy fél-átállás rosszabb, mint bármelyik véglet. |
| Mit mutasson a toast? | **Teljes reward layout**: eyebrow + cím + meter sor (+ level-up badge) | A DS reward variánsának hű leképezése; a lánc-előrehaladás (`2 / 3`) az, ami a pipálásnak értelmet ad. |
| Új toast-host? | **Nem** — a meglévő egyetlen `ToastProvider` bővül | DS: *„Keep the single-host architecture — never mount a second toast root."* |
| XP a toastban? | **Csak a meter sor deltája** (`+15`), account-XP/skill-pontok nem | DS §Notification: *„We do not surface XP at all in the toast"* — a meter delta a kivétel, az a megszerzett skill-XP. |

## 4. Architektúra

Három réteg, a DS-ével egyező felosztásban — a config réteg helyén nálunk a backend áll:

```
[1] Trigger — a felhasználó pipál
    TodayPage act() / DaypartEvening / DailyQuestsCard / ActivityLogSheet
        │  check(habitKey) → Promise<LevelUpResult[] | undefined>
        ▼
[2] Payload-builder — features/progression/logic/rewardToast.ts  (PURE, új)
        buildHabitRewardToast({ title, chainDone, chainTotal, xp, levelUp? })
        buildQuestRewardToast({ title, meta?, levelUp? })
            → RewardToastMessage
        ▼  emitToast(payload)
[3] Render — shared/lib/toastBus.ts  +  shared/ui/ToastProvider.tsx  (bővül)
        egyetlen host, queue, stack, animáció, auto-dismiss
```

A backend (`ProgressionService.applyHabit` → `LevelUpResult`) a „config réteg": ő dönti el, mennyi
XP jár és mikor van szintlépés. A FE nem számol újra semmit — csak megjeleníti.

## 5. A payload

`shared/lib/toastBus.ts` — a `ToastMessage` **diszkriminált unióvá** válik, React-mentes marad:

```ts
export type ToastKind = 'error' | 'success' | 'info'

export interface SimpleToast {
  kind: ToastKind
  text: string
}

export interface RewardToast {
  kind: 'reward'
  /** „Szokás · 2 / 3" · „Küldetés" — 11/700/0.22em uppercase */
  eyebrow: string
  /** a habit/quest neve — Fraunces 16/500 */
  title: string
  /** italic kiegészítés a cím mellett: „2000 ml" */
  meta?: string
  /** a meter sor: skill neve (real) vagy 'XP' (mock) + a delta */
  meter?: { label: string; delta: number }
  /** csak ha levelAfter > levelBefore */
  levelUp?: { label: string; from: number; to: number }
}

export type ToastMessage = SimpleToast | RewardToast
```

A `SimpleToast` alakja **bitre azonos a maival** — a 10 domén `awardGamificationEvent` toastja, a
mutation-cache hibatoastjai és a `useChainCelebration` mind változtatás nélkül működnek tovább.

## 6. Render host — `ToastProvider` v2

A DS §Notification „Position · stack · animation" kártyája a normatív forrás:

| Aspektus | Érték |
|---|---|
| Anchor | `top: calc(env(safe-area-inset-top, 0px) + 14px)` · `right: 14px` · `width: calc(100vw - 28px)`, max **296px** · `z-toast (70)` |
| Stack | oszlop, `gap: 8px`, legújabb elöl. **Max 3 látható**: idx1 → `scale(0.96)` / `opacity .78`, idx2 → `scale(0.93)` / `.55`, idx3+ rejtett. Belső queue cap **20**, túlcsorduláskor a legrégebbi esik ki. |
| Belépés | `translateX(36px) translateY(-4px)` → `0`, **420ms**, `cubic-bezier(0.32, 0.72, 0.32, 1)` |
| Kilépés | `translateX(36px)` + fade; a node 450ms-ig mountolva marad, hogy az animáció lejátszódjon |
| Auto-dismiss | **reward 4000ms** · **error 6000ms** · success/info 4000ms (a mai 3200 helyett — DS-igazítás) |
| Kézi zárás | minden toaston ✕ gomb (22px, `rgba(0,0,0,0.10)`), azonnal indítja a kilépést |
| Reduced motion | `prefers-reduced-motion: reduce` → nincs slide/pulse/pop, a toast azonnal a végállapotban jelenik meg |
| A11y | a stack-konténer `role="status" aria-live="polite"`; a ✕ gomb `aria-label="Bezárás"` |

**A stack a legfontosabb viselkedésbeli változás:** ma egy új toast **lecseréli** a régit. Ezután
egymás alá kerülnek — ezzel a lánc-záró ünneplés többé nem lövi ki az utolsó pipa visszajelzését.

A reward kártya vizuális részletei (gradient, tipográfia, meter pill, level-up badge) a mockupban
1:1 megvannak; a CSS a `prototype.css` `.toast` blokkjából nő ki (ma [`prototype.css:769`](../../../frontend/src/styles/prototype.css)),
és a DS tokenjeit használja — nem hardcode-olt hexeket.

## 7. A builder és a két mód

`features/progression/logic/rewardToast.ts` — pure, DOM- és hook-mentes, könnyen tesztelhető.

**Real mód** — a `LevelUpResult` a forrás:
- `meter` = az **első gain**: `{ label: gains[0].name, delta: gains[0].xpGained }`. A habit-award
  mindig **pontosan egy** skill-deltát ír (`ProgressionService.applyHabit` egyetlen `signal.skillKey`-t
  tesz a `deltas` mapbe), tehát nincs mit válogatni.
- `levelUp` = `{ label: gain.name, from: levelBefore, to: levelAfter }`, **csak ha** `levelAfter > levelBefore`.
- `totalXp`, `perks`, `robustness` a habit-ágon nem jelenik meg (a `perks`/`robustness` az edzés-ág
  fogalmai; a `totalXp` a gain deltájával egyezik).

**Mock mód** — a `check()` `undefined`-ot ad vissza, nincs `LevelUpResult`:
- `meter` = `{ label: 'XP', delta: habit.xp }`. **Nem találunk ki skill-nevet** — a mock adat nem
  tartalmaz skillt, és a ház szabálya szerint kitalált címkét nem írunk ki. Az `'XP'` az, ami
  igazolhatóan igaz.
- `levelUp` nincs (a mock nem tud szintlépésről).

**A dupla-toast elkerülése mockban:** ma a habit-check mock ága
[`habitHooks.ts:78`](../../../frontend/src/data/habit/habitHooks.ts) `awardGamificationEvent`-et hív,
ami emitál egy `+10 XP` success toastot. A reward toast ezt lefedi, tehát a habit-check hívás
**elnémítja a generikus XP-sort**: `awardGamificationEvent(qc, { type: 'HABIT', xpOverride: xp, silentXp: true })`.
A `silentXp` **csak a `+X XP` sort** hallgattatja el — az account-szintlépés, a streak-mérföldkő és a
streak-mentő toastja **továbbra is jön**, mert azok más eseményről szólnak, nem a pipáról.

**Az eyebrow lánc-számlálója** a hívóhely már meglévő adatából jön: `TodayPage` `chainProgress(chainKey)`
függvénye (ma a `celebrationsFor` használja) adja a `done`/`total` párt. Pipáláskor a szerver-frissítés
még nem futott le, ezért a toast **optimistán `done + 1`-et** mutat — ugyanaz a szám, amit a lista
egy pillanattal később kiír. Ha egy hívóhelynek nincs lánc-kontextusa (quest, activity), az eyebrow
`„Küldetés"` / `„Naplózva"`, számláló nélkül.

## 8. Hibakezelés

- **Sikertelen check:** a mutation `onError`-ja a mai úton (mutation-cache → `toastBus`) marad; a
  reward toast csak sikeres írás után emitálódik. A hiba a DS **destruktív variánsán** jelenik meg
  (terrakotta gradient, meter és streak nélkül, Fraunces italic leírás, 6s) — ezt a `kind: 'error'`
  `SimpleToast` kapja meg, tehát **minden mai hibatoast automatikusan feljebb lép** vizuálisan.
- **Hiányzó/hibás payload:** ha a `LevelUpResult` nem tartalmaz gaint (elvben nem fordulhat elő,
  de a `gains` tömb üres lehet), a toast **meter nélkül** jelenik meg — eyebrow + cím önmagában is
  értelmes visszajelzés. Sosem dobunk el toastot és sosem írunk ki `+undefined`-ot.
- **Provider nélküli render (izolált tesztek):** a `toastBus` mai no-op viselkedése változatlan —
  feliratkozó nélkül az `emitToast` csendes.

## 9. Tesztelés

**Új / bővülő tesztek:**
- `features/progression/logic/rewardToast.test.ts` — a builder táblázatosan: szintlépéssel és
  anélkül, üres `gains`, mock-ág (`xp` → `'XP'` meter), quest-ág meta-val.
- `shared/ui/ToastProvider.test.tsx` (meglévő, bővül) — stack sorrend (legújabb elöl), a 4. toast
  elrejtése, queue cap, auto-dismiss reward 4s / error 6s (fake timers), ✕ azonnali zárás,
  reduced-motion ág, és hogy a `SimpleToast` renderje nem tört el.
- `features/today/pages/TodayPage.dispatch.test.tsx` (meglévő, **módosul**) — a pipa ma
  `showLevelUp` hívást vár; ezután `toastBus` emissziót és a helyes eyebrow-számlálót.
- `features/today/components/DaypartEvening.test.tsx`, `DailyQuestsCard` / `ActivityLogSheet` tesztek
  — ugyanez az átkötés.
- `data/habit/habitHooks` teszt — a `silentXp` ág: pipáláskor nem jön generikus `+X XP` toast, de a
  szint/streak toastok megmaradnak.

**Kapu (CLAUDE.md szerint):**
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Mindkét mód zöld; a Train-flow-k `LevelUpScreen` tesztjei **változatlanul** zöldek maradnak — ez a
hatókör-határ bizonyítéka.

**Futásidejű ellenőrzés:** a `verify` skill receptje szerint mock módban végigpipálva a reggeli
láncot — a stack, a level-up badge és az auto-dismiss élőben is látszik.

## 10. Dokumentáció

- [`docs/features/_platform-design-system.md`](../../features/_platform-design-system.md) — a Toast
  primitív leírása a v2 viselkedésre (stack, variánsok, időzítés).
- [`docs/features/today.md`](../../features/today.md) — a Today visszajelzési modellje: mi dob toastot
  és mi nem; a `LevelUpScreen` immár kizárólag a Train-flow-ké.
- [`docs/features/habit.md`](../../features/habit.md) — a pipa-visszajelzés leírása.
- [`docs/features/growth.md`](../../features/growth.md) — ha érinti az `awardGamificationEvent`
  hívási lista leírását (a `silentXp` ág).
- Zárás után: `node scripts/lint-docs.mjs`.

Külön **ADR nem indokolt**: ez a design system már meghozott döntésének végrehajtása, nem új irány.
A hatókör-határ (miért marad a full-screen a Train-flow-knál) ebben a specben rögzül.

## 11. Kockázatok

| Kockázat | Kezelés |
|---|---|
| A `ToastProvider` átírása minden meglévő toastot érint (10 domén + hibakezelés) | A `SimpleToast` alakja és az `emitToast` API **változatlan**; a meglévő `ToastProvider.test.tsx` regressziós hálóként marad, és bővül. |
| A stack elfedheti a képernyő tetejét 3 toastnál | DS-limit: max 3 látható, mindegyik ✕-elhető, és a legrégebbi 4s után magától megy. Az anchor a képernyő tetején van — a BottomNavot és a FAB-ot nem érinti. |
| Az optimista `done + 1` eltérhet, ha a szerver mást számol (pl. a check nem ment át) | A toast csak **sikeres** írás után emitálódik; hiba esetén a destruktív toast megy, nem a reward. |
| Mock és real vizuálisan eltér (meter címke `XP` vs skill-név) | Tudatos és honest: kitalált skill-nevet nem írunk. A dokumentációban rögzítjük. |
