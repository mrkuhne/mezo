# Today iOS-nyelvű lap-redesign + MezoChip/MezoMessagesSheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Mai lap egyetlen iOS-szerű doboznyelvre (inset grouped list) vált, a full-bleed briefing sáv helyére egy 44px-es `MezoChip` + `MezoMessagesSheet` lép, és a habit-sorok ismétlődő napszak-emojiját egy `habitKey → skillKey → napszak` ikon-létra váltja.

**Architecture:** Frontend-only re-kompozíció. A nap-modell (`dayFace`, `todayItems`, `islandFacts`, `questAction`/`habitAction`, `windDown`) **változatlan**; csak a render-réteg cserélődik. A `shared/ui/ItemRow` **egyetlen sorral sem változik** — a Today saját `TodayRow`/`TodayList` párost kap, így a Fuel „Mai" és a rutin-szerkesztő nem mozdul. Minden új döntés (ikon, kísérő-alak, üzenet-szál, olvasatlan-állapot) **pure függvény**, saját teszttel; a komponensek prezentációsak.

**Tech Stack:** React 19 · TypeScript · Vite · vitest + @testing-library/react + @testing-library/user-event · Tailwind v4 (de a Today CSS-e kézi, a `frontend/src/styles/prototype.css`-ben) · Playwright (vizuális goldenek).

**Spec:** [`docs/superpowers/specs/2026-08-11-today-ios-redesign-design.md`](../specs/2026-08-11-today-ios-redesign-design.md)
**Mockup:** [`docs/superpowers/specs/assets/2026-08-11-today-ios-redesign-mockup.html`](../specs/assets/2026-08-11-today-ios-redesign-mockup.html)
**Driving bd:** `mezo-e26w`

## Global Constraints

- **Nyelv:** minden felhasználónak látszó szöveg **magyar**. Kód, azonosító, kommentár angol (a repo bevett kettőssége).
- **A `shared/ui/ItemRow.tsx` TILOS módosítani.** Ugyanígy tilos a `features/fuel/**` és a `features/me/**` bármely fájlját érinteni. Ha egy taszk ezt kívánná, az a taszk rossz — állj meg és jelezd.
- **Nincs backend-, API- vagy `api/`-változás. Nincs új adatforrás, nincs új data-hook.**
- **Nincs új CSS-token.** Minden szín/rádiusz/árnyék/spacing a `prototype.css` `:root` blokkjából jön (`--surface-card`, `--surface-recess`, `--divider`, `--text-*`, `--r-lg`, `--r-full`, `--r-sm`, `--gradient-cta`, `--shadow-cta`, `--sp-*`, `--dv-lav`, `--dv-sage`, `--dv-rose`, `--primary-*`, `--success-*`, `--warning-hover`, `--accent-base`, `--duration-fast`, `--ease-out`).
- **Szövegszín sosem `--primary-base`** (2,8:1, megbukik AA-n) — tintás szöveg mindig `--primary-hover` vagy `--primary-deep`.
- **Tap target ≥ 44px** minden interaktív elemen.
- **Az „ItemRow doktrína" él:** nincs olyan kontroll, ami semmit nem csinál. A `TodayPage` `servableAction` szűrője és a `habitHint` fallback változatlan.
- **Import-konvenció:** mély + abszolút a `@/*` aliason át; nincs relatív `../`; nincs barrel a `@/data/hooks`-on kívül; a tesztek kolokáltak (`X.test.tsx` az `X.tsx` mellett).
- **Minden taszk végén commit**, conventional subject a bd id-vel: `feat(today): ... (mezo-e26w)`.
- **Kapu minden taszk végén:** `cd frontend && pnpm test -- <az érintett tesztfájlok>`. A TELJES kapu (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`) a 15. taszkban fut.

---

## File Structure

| Fájl | Felelősség |
|---|---|
| `frontend/src/styles/prototype.css` | ÚJ `.td-*` blokk (§Today iOS list language); a `.dayview` gutter 20px → 0; a `.dv-*` + `.cb-band` blokk törlése a 14. taszkban |
| `frontend/src/features/today/logic/itemIcon.ts` | `DAYPART_EMOJI` + `habitIcon()` — a háromfokú ikon-létra. Pure. |
| `frontend/src/features/today/logic/rowAccessory.ts` | `rowAccessory(item)` → `'tick' \| 'button' \| 'none'`. Pure. |
| `frontend/src/features/today/logic/mezoMessages.ts` | `buildMezoMessages({ briefing, note })` → `MezoMessageItem[]`. Pure. |
| `frontend/src/shared/lib/seenMessages.ts` | `localStorage` olvasatlan-állapot, dátumra kulcsolva. Domain-mentes. |
| `frontend/src/features/today/components/TodayRow.tsx` | Egy sor: ikon · cím+alsor · kísérő (karika/szöveggomb/chevron/semmi). Prezentációs. |
| `frontend/src/features/today/components/TodayList.tsx` | A csoportos listadoboz (`.td-list`) — sorok konténere, elválasztókkal. Prezentációs. |
| `frontend/src/features/today/components/TodayStats.tsx` | Az egydobozos statisztika-csoport (`IslandFactsStrip` utódja). Prezentációs. |
| `frontend/src/features/today/components/MezoChip.tsx` | A 44px-es chip + olvasatlan-pötty. |
| `frontend/src/features/today/components/MezoMessagesSheet.tsx` | Az üzenet-szál a házi `Sheet`-en. |
| `frontend/src/features/today/components/DaypartTabs.tsx` | Vályú + csúszó bélyeg (átalakul). |
| `frontend/src/features/today/components/DayGroups.tsx` | A `TodayList`-re épül (átalakul). |
| `frontend/src/features/today/components/IntentionBanner.tsx` | A creed a listadoboz feje, a fókuszok sorok (átalakul). |
| `frontend/src/features/today/components/DaypartPanel.tsx` | `.dayview` marad (az animáció + `is-night` hordozója); `DaypartHero` az új `.td-hero`-ra. |
| `frontend/src/features/today/components/Daypart{Morning,Day,Evening}.tsx` | Az új nyelvre (átalakul). |
| `frontend/src/features/today/pages/TodayPage.tsx` | `MezoMessage` → `MezoChip` + `MezoMessagesSheet` state. |
| `frontend/src/features/today/pages/TodaySkeleton.tsx` | Az új layout váza. |
| **TÖRLENDŐ** | `components/MezoMessage.tsx(+test)`, `components/IslandFactsStrip.tsx`, `components/CompanionNoteCard.tsx(+test)` |

---

### Task 1: A `.td-*` CSS-nyelv

Ez alapozza meg az összes többi taszkot: minden komponens ezekre az osztályokra renderel.

**Files:**
- Modify: `frontend/src/styles/prototype.css` (új blokk a fájl végére; a `.dayview` szabály módosítása a 3278. sor környékén)
- Test: `frontend/src/features/today/todayReducedMotion.test.ts` (**változatlanul kell maradnia** — ez a taszk bizonyítéka)

**Interfaces:**
- Consumes: semmit.
- Produces: a `.td-segwrap`, `.td-seg`, `.td-now`, `.td-chip`, `.td-av`, `.td-chip-t`, `.td-chip-n`, `.td-chev`, `.td-hero`, `.td-hero-v`, `.td-hero-u`, `.td-hero-s`, `.td-stats`, `.td-stat`, `.td-stat-v`, `.td-stat-l`, `.td-stat-d`, `.td-cta`, `.td-ghost`, `.td-sec`, `.td-sech`, `.td-list`, `.td-row`, `.td-ic`, `.td-tx`, `.td-t1`, `.td-t2`, `.td-act`, `.td-tick`, `.td-foot`, `.td-done`, `.td-creed`, `.td-sheet-h`, `.td-daysep`, `.td-msg`, `.td-bub`, `.td-bub-h`, `.td-bub-n`, `.td-bub-t`, `.td-bub-x`, `.td-bub-refs`, `.td-bub-meta` osztályokat.

**Fontos, hogy miért marad a `.dayview`:** a `DaypartPanel` gyökerén ez az osztály hordozza a tabváltás `isl-phasein` keresztfade-jét és az `is-night` sötét állapotot. A `todayReducedMotion.test.ts` **erre a szelektorra** állít. Ha megtartjuk, a guard-teszt **egy sort sem változik** — csak a vízszintes paddingja kerül át a `.td-*` elemekre.

- [ ] **Step 1: Ellenőrizd, hogy a guard-teszt most zöld**

Run: `cd frontend && pnpm test -- src/features/today/todayReducedMotion.test.ts`
Expected: PASS

- [ ] **Step 2: A `.dayview` vízszintes paddingjának átadása**

A `prototype.css`-ben cseréld ki ezt az egy sort (a `.dayview` blokk, ~3278):

```css
.dayview { padding: 2px 20px 6px; }
```

erre:

```css
/* A Today lapnyelve a 16px-es sínt ELEMENKÉNT hordozza (`--td-gut`), nem a panelen —
   így a listadobozok, a hero és a CTA mind pontosan egy vonalban ülnek. A `.dayview`
   megmarad, mert ő viszi a tabváltás `isl-phasein` fade-jét és az `is-night` állapotot
   (lásd `todayReducedMotion.test.ts`). */
.dayview { padding: 2px 0 6px; }
```

- [ ] **Step 3: Az új `.td-*` blokk a `prototype.css` VÉGÉRE**

```css
/* ============================================================
   Today · iOS list language (mezo-e26w)
   Egyetlen doboznyelv: „inset grouped list". Minden vízszintes él ugyanaz a
   16px-es sín (`--td-gut`). Árnyék helyett .5px hajszálvonal. A sorelválasztó
   a vezető ikon szélességétől (52px) indul, nem a doboz élétől.
   Kizárólag meglévő DS-tokenekből épül — nincs új szín, nincs új token.
   ============================================================ */
.dayview, .daytabs, .todaychip { --td-gut: 16px; }

/* ── szegmentált napszak-váltó — egy vályú + csúszó bélyeg ── */
.td-segwrap { padding: 6px var(--td-gut) 14px; }
.td-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
          background: var(--surface-recess); border-radius: var(--r-full); padding: 3px; }
.td-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 5px;
                 min-height: 38px; border: 0; background: transparent; border-radius: var(--r-full);
                 font-family: var(--ff-body); font-size: 13.5px; font-weight: 600; letter-spacing: -.01em;
                 color: var(--text-secondary); cursor: pointer;
                 transition: background var(--duration-fast) var(--ease-out),
                             color var(--duration-fast) var(--ease-out); }
.td-seg button em { font-style: normal; font-size: 13px; opacity: .9; }
.td-seg button[aria-pressed='true'] { background: var(--surface-card); color: var(--text-primary);
                                      box-shadow: 0 1px 3px rgba(43, 33, 24, .10),
                                                  0 0 0 .5px rgba(43, 33, 24, .04); }
.td-now { width: 5px; height: 5px; border-radius: 50%; background: var(--accent-base);
          box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--accent-base) 24%, transparent); }

/* ── MezoChip ── */
.td-chip { display: flex; align-items: center; gap: 10px; width: calc(100% - 2 * var(--td-gut));
           margin: 0 var(--td-gut) 18px; padding: 11px 14px; min-height: 44px;
           border-radius: var(--r-lg); background: var(--surface-card);
           border: .5px solid var(--divider); cursor: pointer; text-align: left;
           box-shadow: 0 1px 2px rgba(43, 33, 24, .05); font-family: var(--ff-body); }
.td-av { flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%; position: relative;
         background: var(--gradient-cta); color: var(--text-inverse); display: grid;
         place-items: center; font-size: 12px; box-shadow: 0 2px 6px rgba(255, 91, 54, .30); }
.td-av.is-unread::after { content: ''; position: absolute; top: -1px; right: -1px;
                          width: 9px; height: 9px; border-radius: 50%; background: var(--primary-base);
                          box-shadow: 0 0 0 2px var(--surface-card); }
.td-chip-t { flex: 1; min-width: 0; }
.td-chip-t b { display: block; font-size: 13.5px; font-weight: 600; color: var(--text-primary);
               letter-spacing: -.01em; }
.td-chip-t i { display: block; font-style: normal; font-size: 12px; color: var(--text-muted);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.td-chip-n { flex: 0 0 auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: var(--r-full);
             background: var(--primary-base); color: var(--text-inverse); font-size: 11.5px;
             font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.td-chev { flex: 0 0 auto; color: var(--text-disabled); font-size: 16px; font-weight: 600; }

/* ── napszak-hero ── */
.td-hero { padding: 2px var(--td-gut) 0; }
.td-hero-l { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
.td-hero-v { font-family: var(--ff-display); font-size: 36px; font-weight: 250; line-height: 1.05;
             letter-spacing: -.035em; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.td-hero-u { font-size: 15px; font-weight: 400; color: var(--text-secondary); letter-spacing: -.01em; }
.td-hero-s { display: block; font-family: var(--ff-body); font-size: 12.5px; color: var(--text-muted);
             margin-top: 5px; letter-spacing: -.005em; }

/* ── statisztika-csoport: EGY doboz, függőleges hajszálvonallal ── */
.td-stats { display: grid; margin: 14px var(--td-gut) 0; background: var(--surface-card);
            border: .5px solid var(--divider); border-radius: var(--r-lg); overflow: hidden; }
.td-stat { padding: 12px 14px; }
.td-stat + .td-stat { border-left: .5px solid var(--divider); }
.td-stat-v { font-family: var(--ff-display); font-size: 21px; font-weight: 400; letter-spacing: -.02em;
             color: var(--text-primary); font-variant-numeric: tabular-nums; }
.td-stat-v small { font-size: 12px; font-weight: 500; color: var(--text-muted); margin-left: 2px; }
.td-stat-l { font-family: var(--ff-body); font-size: 10.5px; font-weight: 700; letter-spacing: .07em;
             text-transform: uppercase; color: var(--text-muted); margin-top: 3px; }
.td-stat-d { font-family: var(--ff-body); font-size: 11.5px; margin-top: 4px; color: var(--text-secondary); }
.td-stat-d.is-good { color: var(--success-hover); }
.td-stat-d.is-warn { color: var(--warning-hover); }
.td-stat-d.is-muted { color: var(--text-muted); }

/* ── elsődleges CTA + ghost ── */
.td-cta { display: flex; align-items: center; justify-content: center; gap: 8px;
          width: calc(100% - 2 * var(--td-gut)); margin: 16px var(--td-gut) 0; min-height: 50px;
          border: 0; border-radius: var(--r-lg); background: var(--gradient-cta);
          color: var(--text-inverse); font-family: var(--ff-body); font-size: 16px; font-weight: 600;
          letter-spacing: -.01em; box-shadow: var(--shadow-cta); cursor: pointer; }
.td-cta.is-lav { background: linear-gradient(135deg, #A99BD3, #8B7CC0);
                 box-shadow: 0 8px 20px rgba(139, 124, 192, .32); }
.td-ghost { display: block; width: calc(100% - 2 * var(--td-gut)); margin: 8px var(--td-gut) 0;
            min-height: 44px; border-radius: var(--r-lg); border: .5px solid var(--divider);
            background: var(--surface-card); font-family: var(--ff-body); font-size: 14.5px;
            font-weight: 600; color: var(--text-secondary); cursor: pointer; }

/* ── szekció + inset grouped list ── */
.td-sec { margin-top: 26px; }
.td-sech { display: flex; align-items: baseline; padding: 0 var(--td-gut) 7px; }
.td-sech b { font-family: var(--ff-body); font-size: 11px; font-weight: 700; letter-spacing: .075em;
             text-transform: uppercase; color: var(--text-muted); }
.td-sech a, .td-sech button { margin-left: auto; font-family: var(--ff-body); font-size: 12.5px;
                              font-weight: 600; color: var(--primary-hover); text-decoration: none;
                              letter-spacing: -.005em; border: 0; background: none; cursor: pointer;
                              padding: 6px 0 6px 8px; }
.td-list { margin: 0 var(--td-gut); background: var(--surface-card); border: .5px solid var(--divider);
           border-radius: var(--r-lg); overflow: hidden; }
.td-row { display: flex; align-items: center; gap: 11px; padding: 9px 13px; min-height: 56px;
          position: relative; background: transparent; width: 100%; text-align: left;
          font-family: var(--ff-body); }
/* iOS-elválasztó: a vezető ikon szélességétől indul, nem a doboz élétől */
.td-row + .td-row::before { content: ''; position: absolute; top: 0; left: 52px; right: 0;
                            border-top: .5px solid var(--divider); }
.td-ic { flex: 0 0 auto; width: 28px; height: 28px; border-radius: 8px; display: grid;
         place-items: center; font-size: 15px; background: var(--surface-recess); }
.td-ic.t-habit { background: color-mix(in srgb, var(--dv-lav) 18%, transparent); }
.td-ic.t-quest { background: color-mix(in srgb, var(--accent-base) 20%, transparent); }
.td-ic.t-fuel  { background: color-mix(in srgb, var(--dv-sage) 22%, transparent); }
.td-ic.t-check { background: color-mix(in srgb, var(--dv-rose) 20%, transparent); }
.td-ic.t-train { background: color-mix(in srgb, var(--primary-base) 16%, transparent); }
.td-tx { flex: 1; min-width: 0; }
.td-t1 { display: block; font-size: 15.5px; font-weight: 500; letter-spacing: -.015em;
         color: var(--text-primary); line-height: 1.25; }
.td-t2 { display: block; font-size: 12.5px; color: var(--text-muted); margin-top: 2px;
         letter-spacing: -.005em; line-height: 1.3; }
.td-tm { flex: 0 0 auto; font-size: 13px; font-weight: 600; color: var(--text-muted);
         font-variant-numeric: tabular-nums; }
/* kísérő #1 — tintás szöveggomb (NEM szürke pirula) */
.td-act { flex: 0 0 auto; border: 0; background: none; padding: 12px 2px 12px 10px; cursor: pointer;
          font-family: var(--ff-body); font-size: 14.5px; font-weight: 600; letter-spacing: -.01em;
          color: var(--primary-hover); white-space: nowrap; }
.td-act.is-inert { color: var(--text-disabled); cursor: default; }
/* kísérő #2 — pipáló karika */
.td-tick { flex: 0 0 auto; width: 26px; height: 26px; margin: 9px 0 9px 10px; border-radius: 50%;
           border: 1.6px solid var(--text-disabled); background: none; cursor: pointer;
           display: grid; place-items: center; font-size: 14px; color: transparent; }
.td-tick.is-done { border-color: var(--success-base); background: var(--success-base);
                   color: var(--text-inverse); }
.td-link { flex: 0 0 auto; width: 44px; height: 44px; display: inline-flex; align-items: center;
           justify-content: center; color: var(--text-muted); text-decoration: none; font-size: 14px; }
.td-row.is-done .td-t1 { color: var(--text-muted); text-decoration: line-through; }
.td-row.is-done .td-ic { opacity: .45; }

/* ── lábjegyzet a csoport alatt — doboz nélkül ── */
.td-foot { padding: 7px var(--td-gut) 0; font-family: var(--ff-body); font-size: 12px;
           line-height: 1.45; color: var(--text-muted); letter-spacing: -.005em; }
.td-foot.is-warn { color: var(--warning-hover); }

/* ── kész-hajtás ── */
.td-done { display: flex; align-items: center; gap: 6px; width: calc(100% - 2 * var(--td-gut));
           margin: 12px var(--td-gut) 0; padding: 11px 14px; min-height: 44px; border-radius: var(--r-lg);
           background: transparent; border: .5px dashed var(--divider); cursor: pointer;
           font-family: var(--ff-body); font-size: 13px; font-weight: 600;
           color: var(--success-hover); letter-spacing: -.005em; }
.td-done span { margin-left: auto; color: var(--text-disabled); }
.td-dayxp { text-align: center; font-family: var(--ff-body); font-size: 12px; font-weight: 700;
            color: var(--success-hover); padding: 10px var(--td-gut) 0; }

/* ── fókusz (creed) — ugyanaz a listadoboz, halk levendula fejjel ── */
.td-creed { padding: 12px 14px; background: color-mix(in srgb, var(--dv-lav) 9%, var(--surface-card)); }
.td-creed-q { display: block; width: 100%; text-align: left; border: 0; background: none;
              cursor: pointer; font-family: var(--ff-display); font-size: 14.5px; font-style: italic;
              font-weight: 300; color: var(--secondary-base); line-height: 1.45; }

/* ── MezoMessagesSheet ── */
.td-sheet-h { display: flex; align-items: center; padding: 4px 16px 12px;
              border-bottom: .5px solid var(--divider); }
.td-sheet-h h2 { font-family: var(--ff-body); font-size: 16.5px; font-weight: 700;
                 letter-spacing: -.02em; color: var(--text-primary); }
.td-sheet-h button { margin-left: auto; font-family: var(--ff-body); font-size: 15px; font-weight: 600;
                     color: var(--primary-hover); border: 0; background: none; cursor: pointer;
                     padding: 10px 0 10px 12px; }
.td-thread { padding: 14px 0 0; overflow-y: auto; max-height: 62vh; }
.td-daysep { text-align: center; font-family: var(--ff-body); font-size: 11px; font-weight: 700;
             letter-spacing: .07em; text-transform: uppercase; color: var(--text-disabled);
             margin: 2px 0 12px; }
.td-msg { display: flex; gap: 9px; align-items: flex-end; padding: 0 16px 14px; }
.td-msg .td-av { margin-bottom: 2px; }
.td-bub { flex: 1; min-width: 0; background: var(--surface-card); border: .5px solid var(--divider);
          border-radius: 20px; border-bottom-left-radius: 6px; padding: 11px 14px 12px;
          box-shadow: 0 1px 2px rgba(43, 33, 24, .05); }
.td-bub-h { display: flex; align-items: baseline; gap: 6px; margin-bottom: 5px; }
.td-bub-n { font-family: var(--ff-body); font-size: 12.5px; font-weight: 700;
            color: var(--primary-deep); letter-spacing: -.005em; }
.td-bub-t { font-family: var(--ff-body); font-size: 11.5px; color: var(--text-muted);
            font-variant-numeric: tabular-nums; }
.td-bub-x { font-family: var(--ff-body); font-size: 14.5px; line-height: 1.47;
            color: var(--text-primary); margin: 0; letter-spacing: -.005em; }
.td-bub-x + .td-bub-x { margin-top: 9px; }
.td-bub-refs { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.td-bub-meta { font-family: var(--ff-body); font-size: 10.5px; font-weight: 700; letter-spacing: .06em;
               text-transform: uppercase; color: var(--text-disabled); margin-top: 9px; }
```

- [ ] **Step 4: A guard-teszt továbbra is zöld, és a build fordul**

Run: `cd frontend && pnpm test -- src/features/today/todayReducedMotion.test.ts && pnpm build`
Expected: PASS + sikeres build. Ha a guard-teszt elbukik, **a `.dayview` szabályt rontottad el** — az `animation: isl-phasein` és a reduce-override nem változhat.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/prototype.css
git commit -m "feat(today): a .td-* iOS listanyelv CSS-alapja (mezo-e26w)"
```

---

### Task 2: `itemIcon.ts` — az ikon-létra

**Files:**
- Create: `frontend/src/features/today/logic/itemIcon.ts`
- Create: `frontend/src/features/today/logic/itemIcon.test.ts`
- Modify: `frontend/src/features/today/logic/todayItems.ts` (a 120. sor `DAYPART_EMOJI` konstansa átkerül; a 161. sor `emoji:` mezője hívja a létrát)

**Interfaces:**
- Consumes: `HabitChainInfo`, `HabitDaypart` a `@/data/types`-ból.
- Produces:
  - `export const DAYPART_EMOJI: Record<HabitDaypart, string>`
  - `export function habitIcon(habitKey: string, chain: HabitChainInfo): string`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `frontend/src/features/today/logic/itemIcon.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { habitIcon } from '@/features/today/logic/itemIcon'
import type { HabitChainInfo, HabitDefInfo } from '@/data/types'

const def = (habitKey: string, skillKey: string): HabitDefInfo => ({
  id: `def-${habitKey}`, habitKey, chainKey: 'MORNING', position: 0, title: habitKey,
  why: null, anchorCopy: null, mode: 'MANUAL', metric: '', skillKey, xp: 5,
  linkUrl: null, isActive: true,
})

const chain = (defs: HabitDefInfo[], daypart: HabitChainInfo['daypart'] = 'MORNING'): HabitChainInfo => ({
  id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart, position: 0, isActive: true, defs,
})

describe('habitIcon — a háromfokú létra', () => {
  test('1. fok: a kurált habitKey-tábla nyer minden más előtt', () => {
    // A `pushups` a táblában 💪; a skillKey `recovery` lenne, a napszak 🌅 — egyik sem nyerhet.
    expect(habitIcon('pushups', chain([def('pushups', 'recovery')]))).toBe('💪')
  })

  test('2. fok: ismeretlen habitKey a lánc def-jéből vett skillKey emojiját kapja', () => {
    expect(habitIcon('sajat_szokas', chain([def('sajat_szokas', 'mindfulness')]))).toBe('🧘')
  })

  test('2. fok: mind a nyolc life-skill ad emojit', () => {
    const skills = ['mindfulness', 'mindset', 'cooking', 'financial',
                    'productivity', 'learning', 'connection', 'recovery']
    const icons = skills.map((s) => habitIcon('x', chain([def('x', s)])))
    expect(icons.every((i) => i.length > 0)).toBe(true)
    expect(new Set(icons).size).toBe(skills.length) // mind a nyolc KÜLÖNBÖZŐ
  })

  test('3. fok: ha se kurált kulcs, se ismert skillKey, a napszak emojija jön', () => {
    expect(habitIcon('sajat_szokas', chain([def('sajat_szokas', 'ismeretlen')], 'EVENING'))).toBe('🌙')
    expect(habitIcon('sajat_szokas', chain([def('sajat_szokas', 'ismeretlen')], 'DAY'))).toBe('☀️')
  })

  test('3. fok: hiányzó def sem dob — a napszakra esik vissza', () => {
    expect(habitIcon('nincs_ilyen', chain([], 'MORNING'))).toBe('🌅')
  })
})
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/logic/itemIcon.test.ts`
Expected: FAIL — „Failed to resolve import … itemIcon"

- [ ] **Step 3: Írd meg a minimális implementációt**

Create `frontend/src/features/today/logic/itemIcon.ts`:

```ts
// ============================================================
// Mezo · itemIcon — a habit-sorok ikonja (mezo-e26w). A régi viselkedés minden
// lánc minden sorára a NAPSZAK emojiját tette, amitől öt egyforma 🌅 állt a
// reggeli rutinban. A létra három fokú, és mindig ad találatot:
//   1. `habitKey` → kurált tábla (a beépített szokások)
//   2. `skillKey` → a life-skill emojija — a `LifeSkillKey` ZÁRT, 8 értékű enum,
//      tehát minden jövőbeli, AI-generált szokásra is van értelmes találat
//   3. napszak-emoji — a régi viselkedés, végső tartalékként
// Pure: no React, no hooks, no side effects.
// A `DAYPART_EMOJI` innen exportálódik (nem a `todayItems`-ből), különben a
// `todayItems → itemIcon → todayItems` import-kör bezárulna.
// ============================================================
import type { HabitChainInfo, HabitDaypart } from '@/data/types'

export const DAYPART_EMOJI: Record<HabitDaypart, string> = { MORNING: '🌅', DAY: '☀️', EVENING: '🌙' }

/** 1. fok — a beépített szokások saját ikonja. Kulcs = `HabitItem.key`. */
const HABIT_ICON: Record<string, string> = {
  pushups: '💪',
  morning_video: '🎬',
  mushroom_coffee: '☕',
  morning_workout: '🤸',
  protein_breakfast: '🍳',
  weigh_in: '⚖️',
  sunlight: '🌞',
  water: '💧',
  caffeine_cutoff: '☕',
  kitchen_closed: '🍽️',
  wind_down: '📵',
  evening_ritual: '🕯️',
  intention_check: '✍️',
  reading: '📖',
  meditation: '🧘',
  stretch: '🤸',
}

/** 2. fok — a nyolc `LifeSkillKey`. Mindegyik KÜLÖNBÖZŐ emojit kap. */
const SKILL_ICON: Record<string, string> = {
  mindfulness: '🧘',
  mindset: '🧠',
  cooking: '🍳',
  financial: '💰',
  productivity: '⚡',
  learning: '📚',
  connection: '🤝',
  recovery: '🛌',
}

export function habitIcon(habitKey: string, chain: HabitChainInfo): string {
  const curated = HABIT_ICON[habitKey]
  if (curated) return curated
  const skillKey = chain.defs.find((d) => d.habitKey === habitKey)?.skillKey
  const bySkill = skillKey ? SKILL_ICON[skillKey] : undefined
  if (bySkill) return bySkill
  return DAYPART_EMOJI[chain.daypart]
}
```

> **Figyelem — `mushroom_coffee` és `caffeine_cutoff` is `☕`.** Ez szándékos: két külön napszakban élnek, sosem állnak egy listában.
> **`meditation` (💪-tábla) és `mindfulness` (skill) is `🧘`.** Szintén szándékos — ugyanaz a fogalom két fokon.

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `cd frontend && pnpm test -- src/features/today/logic/itemIcon.test.ts`
Expected: PASS (5 teszt)

- [ ] **Step 5: Kösd be a `todayItems.ts`-be**

A `frontend/src/features/today/logic/todayItems.ts`-ben **töröld** ezt a sort (~120):

```ts
const DAYPART_EMOJI: Record<HabitDaypart, string> = { MORNING: '🌅', DAY: '☀️', EVENING: '🌙' }
```

Az import-blokkba (a `questAction` import mellé) vedd fel:

```ts
import { habitIcon } from '@/features/today/logic/itemIcon'
```

És a habit-item `emoji:` mezőjét (~161) cseréld:

```ts
      emoji: DAYPART_EMOJI[chain.daypart],
```

erre:

```ts
      emoji: habitIcon(h.key, chain),
```

Ha a `HabitDaypart` típusimport ezzel használatlanná válna, **hagyd meg** — a `DAYPART_FACE` és a `DAYPART_TONE` továbbra is használja.

- [ ] **Step 6: A `todayItems` tesztje továbbra is zöld**

Run: `cd frontend && pnpm test -- src/features/today/logic/todayItems.test.ts src/features/today/logic/itemIcon.test.ts`
Expected: PASS mindkettő. (A `todayItems.test.ts` a habit-emojira nem állít semmit — ha mégis bukna, olvasd el a hibát, ne írd át a tesztet.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/logic/itemIcon.ts frontend/src/features/today/logic/itemIcon.test.ts frontend/src/features/today/logic/todayItems.ts
git commit -m "feat(today): habitKey→skillKey→napszak ikon-létra a habit-sorokra (mezo-e26w)"
```

---

### Task 3: `rowAccessory.ts` — a kísérő alakja

**Files:**
- Create: `frontend/src/features/today/logic/rowAccessory.ts`
- Create: `frontend/src/features/today/logic/rowAccessory.test.ts`

**Interfaces:**
- Consumes: `TodayItem` a `@/features/today/logic/todayItems`-ből.
- Produces: `export type RowAccessory = 'tick' | 'button' | 'none'` és `export function rowAccessory(item: TodayItem): RowAccessory`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `frontend/src/features/today/logic/rowAccessory.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { rowAccessory } from '@/features/today/logic/rowAccessory'
import type { TodayItem } from '@/features/today/logic/todayItems'
import type { HabitItem } from '@/data/types'

const habit = (mode: HabitItem['mode']): HabitItem => ({
  key: 'pushups', chain: 'MORNING', position: 0, title: '50 fekvőtámasz', why: '',
  anchorCopy: 'napfény után', mode, status: 'pending', xp: 8,
})

const item = (action: TodayItem['action']): TodayItem => ({
  id: 'x', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '💪',
  tag: 'REGGELI RUTIN', title: '50 fekvőtámasz', subtitle: null, time: null, xp: 8,
  group: 'Reggeli rutin', action, linkUrl: null,
})

describe('rowAccessory', () => {
  test('MANUAL szokás → pipáló karika', () => {
    expect(rowAccessory(item({ kind: 'habit', habit: habit('MANUAL'), label: 'Pipa' }))).toBe('tick')
  })

  test('nem-MANUAL (DERIVED) szokás → szöveggomb', () => {
    expect(rowAccessory(item({ kind: 'habit', habit: habit('DERIVED'), label: 'Logolás' }))).toBe('button')
  })

  test('nav / checkin / quest akció → szöveggomb', () => {
    expect(rowAccessory(item({ kind: 'nav', to: '/fuel', label: 'Logold' }))).toBe('button')
    expect(rowAccessory(item({ kind: 'checkin', slotIdx: 0, label: 'Koppints' }))).toBe('button')
  })

  test('akció nélküli sor → semmi', () => {
    expect(rowAccessory(item(null))).toBe('none')
  })

  test('a döntés SOSEM a címke szövegéből jön', () => {
    // Ugyanaz a „Pipa" címke egy DERIVED szokáson NEM ad karikát.
    expect(rowAccessory(item({ kind: 'habit', habit: habit('DERIVED'), label: 'Pipa' }))).toBe('button')
  })
})
```

> Ha a `HabitItem.mode` uniója nem `'MANUAL' | 'DERIVED'`, olvasd ki a `HabitMode` típust a `frontend/src/data/types.ts`-ből, és használd a valódi nem-MANUAL értéket. Ne találj ki értéket.

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/logic/rowAccessory.test.ts`
Expected: FAIL — „Failed to resolve import … rowAccessory"

- [ ] **Step 3: Írd meg a minimális implementációt**

Create `frontend/src/features/today/logic/rowAccessory.ts`:

```ts
// ============================================================
// Mezo · rowAccessory — melyik kísérőt viseli egy sor (mezo-e26w).
// A `TodayAction` MINDEN változata visel `label`-t (todayItems.ts:168,194,217,
// 239,256), tehát a „nincs címke" nem megkülönböztető jel — a `mode` az.
// A negyedik alak, a chevron, NEM innen jön: az a `TodayRow` propja, amit a
// nézet által közvetlenül renderelt, sheetet nyitó sorok viselnek (Reflexió,
// Fókusz) — azok nem `TodayItem`-ből származnak.
// Pure: no React, no hooks, no side effects.
// ============================================================
import type { TodayItem } from '@/features/today/logic/todayItems'

export type RowAccessory = 'tick' | 'button' | 'none'

export function rowAccessory(item: TodayItem): RowAccessory {
  const a = item.action
  if (!a) return 'none'
  if (a.kind === 'habit' && a.habit.mode === 'MANUAL') return 'tick'
  return 'button'
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `cd frontend && pnpm test -- src/features/today/logic/rowAccessory.test.ts`
Expected: PASS (5 teszt)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/logic/rowAccessory.ts frontend/src/features/today/logic/rowAccessory.test.ts
git commit -m "feat(today): rowAccessory — a sor kísérőjének alakja a mode-ból (mezo-e26w)"
```

---

### Task 4: `mezoMessages.ts` — az üzenet-szál

**Files:**
- Create: `frontend/src/features/today/logic/mezoMessages.ts`
- Create: `frontend/src/features/today/logic/mezoMessages.test.ts`

**Interfaces:**
- Consumes: `Briefing`, `BriefingRef`, `CompanionNote` a `@/data/types`-ból.
- Produces:
  ```ts
  export interface MezoMessageItem {
    id: string                 // stabil a napon belül: 'briefing' | 'note'
    eyebrow: string            // a buborék feje, magyarul
    time: string | null        // 'HH:mm' vagy null
    paragraphs: string[]       // markdown-forrásszöveg, a renderelő SafeMarkdown-ozza
    refs: BriefingRef[]
    meta: string | null        // „Demo tartalom" / „Confidence 88%" / null
  }
  export function buildMezoMessages(input: {
    briefing: Briefing | null
    note: CompanionNote | null
    briefingDemo?: boolean
  }): MezoMessageItem[]
  ```

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `frontend/src/features/today/logic/mezoMessages.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import type { Briefing, CompanionNote } from '@/data/types'

const briefing: Briefing = {
  eyebrow: 'Mezo · reggeli briefing · 06:30',
  body: [{ type: 'p', text: 'Jó reggelt.' }, { type: 'p', text: 'Ma Pull Day.' }],
  refs: [{ kind: 'workout', label: 'Push Day · tegnap' }],
  confidence: 0.88,
}
const note: CompanionNote = { window: '12:30', kind: 'nudge', text: 'Fehérjéből 100 g van meg.' }
const closing: CompanionNote = { window: '21:15', kind: 'closing', text: 'Szép nap volt.' }

describe('buildMezoMessages', () => {
  test('üres nap → üres tömb (honest absence)', () => {
    expect(buildMezoMessages({ briefing: null, note: null })).toEqual([])
  })

  test('csak briefing → egy üzenet, minden bekezdéssel és a refekkel', () => {
    const msgs = buildMezoMessages({ briefing, note: null })
    expect(msgs).toHaveLength(1)
    expect(msgs[0].id).toBe('briefing')
    expect(msgs[0].paragraphs).toEqual(['Jó reggelt.', 'Ma Pull Day.'])
    expect(msgs[0].refs).toHaveLength(1)
  })

  test('a briefing ideje az eyebrow-ból jön, a szöveg pedig magyar cím marad', () => {
    const [m] = buildMezoMessages({ briefing, note: null })
    expect(m.time).toBe('06:30')
    expect(m.eyebrow).toBe('Reggeli briefing')
  })

  test('idő nélküli eyebrow → null idő, de a saját eyebrow-szöveg marad', () => {
    const [m] = buildMezoMessages({ briefing: { ...briefing, eyebrow: 'Mezo · esti szó' }, note: null })
    expect(m.time).toBeNull()
    expect(m.eyebrow).toBe('Reggeli briefing')
  })

  test('real módban a fabrikált confidence helyett őszinte demo-címke', () => {
    expect(buildMezoMessages({ briefing, note: null })[0].meta).toBe('Confidence 88%')
    expect(buildMezoMessages({ briefing, note: null, briefingDemo: true })[0].meta).toBe('Demo tartalom')
  })

  test('a jegyzet kind-ja adja az eyebrow-t, a window az időt', () => {
    const [, m] = buildMezoMessages({ briefing, note })
    expect(m.eyebrow).toBe('Napközi jegyzet')
    expect(m.time).toBe('12:30')
    expect(buildMezoMessages({ briefing, note: closing })[1].eyebrow).toBe('Napzárás')
  })

  test('a sorrend kronologikus — a briefing elöl, a jegyzet mögötte', () => {
    expect(buildMezoMessages({ briefing, note }).map((m) => m.id)).toEqual(['briefing', 'note'])
  })

  test('csak jegyzet → egyetlen üzenet, briefing nélkül', () => {
    const msgs = buildMezoMessages({ briefing: null, note })
    expect(msgs.map((m) => m.id)).toEqual(['note'])
  })
})
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/logic/mezoMessages.test.ts`
Expected: FAIL — „Failed to resolve import … mezoMessages"

- [ ] **Step 3: Írd meg a minimális implementációt**

Create `frontend/src/features/today/logic/mezoMessages.ts`:

```ts
// ============================================================
// Mezo · mezoMessages — a nap mezo-üzeneteinek egyetlen szála (mezo-e26w).
// NINCS új adatforrás: a szál a Mai lapon MÁR meglévő két hookból áll össze
// (`useToday().briefing` + `useCompanionNote()`). Ez a modul az a hely, ahova
// minden jövőbeli generált üzenet befűződik — a chip és a sheet érintése nélkül.
// Pure: no React, no hooks, no side effects.
// ============================================================
import type { Briefing, BriefingRef, CompanionNote } from '@/data/types'

export interface MezoMessageItem {
  /** Stabil a napon belül. */
  id: string
  eyebrow: string
  time: string | null
  /** Markdown-forrás; a renderelő `SafeMarkdown`-ozza. */
  paragraphs: string[]
  refs: BriefingRef[]
  meta: string | null
}

const NOTE_EYEBROW: Record<CompanionNote['kind'], string> = {
  nudge: 'Napközi jegyzet',
  closing: 'Napzárás',
}

/** A briefing eyebrow-ja hordozhat egy `HH:mm`-et (pl. „Mezo · reggeli briefing · 06:30"). */
const timeIn = (s: string): string | null => s.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null

export function buildMezoMessages({ briefing, note, briefingDemo }: {
  briefing: Briefing | null
  note: CompanionNote | null
  briefingDemo?: boolean
}): MezoMessageItem[] {
  const out: MezoMessageItem[] = []
  if (briefing) {
    out.push({
      id: 'briefing',
      eyebrow: 'Reggeli briefing',
      time: timeIn(briefing.eyebrow),
      paragraphs: briefing.body.map((p) => p.text),
      refs: briefing.refs,
      meta: briefingDemo
        ? 'Demo tartalom'
        : briefing.confidence != null
          ? `Confidence ${Math.round(briefing.confidence * 100)}%`
          : null,
    })
  }
  if (note) {
    out.push({
      id: 'note',
      eyebrow: NOTE_EYEBROW[note.kind],
      time: note.window || null,
      paragraphs: [note.text],
      refs: [],
      meta: null,
    })
  }
  return out
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `cd frontend && pnpm test -- src/features/today/logic/mezoMessages.test.ts`
Expected: PASS (8 teszt)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/logic/mezoMessages.ts frontend/src/features/today/logic/mezoMessages.test.ts
git commit -m "feat(today): mezoMessages — a nap üzenet-szála a meglévő hookokból (mezo-e26w)"
```

---

### Task 5: `seenMessages.ts` — az olvasatlan-állapot

**Files:**
- Create: `frontend/src/shared/lib/seenMessages.ts`
- Create: `frontend/src/shared/lib/seenMessages.test.ts`

**Interfaces:**
- Consumes: semmit.
- Produces:
  - `export function lastSeenMessage(date: string): string | null`
  - `export function markMessagesSeen(date: string, lastId: string): void`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `frontend/src/shared/lib/seenMessages.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { lastSeenMessage, markMessagesSeen } from '@/shared/lib/seenMessages'

describe('seenMessages', () => {
  beforeEach(() => { localStorage.clear() })

  test('érintetlen napra nincs látott üzenet', () => {
    expect(lastSeenMessage('2026-08-11')).toBeNull()
  })

  test('a megjelölt id visszaolvasható', () => {
    markMessagesSeen('2026-08-11', 'note')
    expect(lastSeenMessage('2026-08-11')).toBe('note')
  })

  test('dátumra kulcsolt — a következő nap újra olvasatlan', () => {
    markMessagesSeen('2026-08-11', 'note')
    expect(lastSeenMessage('2026-08-12')).toBeNull()
  })

  test('sérült/elérhetetlen localStorage nem dob — csendben null', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: private mode')
    })
    expect(() => lastSeenMessage('2026-08-11')).not.toThrow()
    expect(lastSeenMessage('2026-08-11')).toBeNull()
    spy.mockRestore()
  })

  test('elérhetetlen írás sem dob', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => markMessagesSeen('2026-08-11', 'note')).not.toThrow()
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/shared/lib/seenMessages.test.ts`
Expected: FAIL — „Failed to resolve import … seenMessages"

- [ ] **Step 3: Írd meg a minimális implementációt**

Create `frontend/src/shared/lib/seenMessages.ts`:

```ts
// ============================================================
// Mezo · seenMessages — a mezo-üzenetek olvasatlan-állapota (mezo-e26w).
// Kliensoldali, DÁTUMRA KULCSOLT: a kulcs másnap magától elavul, így nincs se
// takarítás, se szerveroldali read-state. Minden hozzáférés defenzív: privát
// módban / kvótatúllépéskor a `localStorage` DOB, és egy olvasatlan-pötty
// sosem érhet meg egy összeomlott képernyőt.
// ============================================================
const keyFor = (date: string) => `mezo.msgseen.${date}`

/** Az adott napon utoljára LÁTOTT üzenet id-je, vagy `null`. */
export function lastSeenMessage(date: string): string | null {
  try {
    return localStorage.getItem(keyFor(date))
  } catch {
    return null
  }
}

/** A nap üzeneteit látottnak jelöli a szál UTOLSÓ elemének id-jével. */
export function markMessagesSeen(date: string, lastId: string): void {
  try {
    localStorage.setItem(keyFor(date), lastId)
  } catch {
    // privát mód / kvóta — az olvasatlan-pötty megmarad, semmi más nem törik
  }
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `cd frontend && pnpm test -- src/shared/lib/seenMessages.test.ts`
Expected: PASS (5 teszt)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/seenMessages.ts frontend/src/shared/lib/seenMessages.test.ts
git commit -m "feat(shared): seenMessages — dátumra kulcsolt olvasatlan-állapot (mezo-e26w)"
```

---

### Task 6: `TodayRow` + `TodayList`

Ez a taszk a lap szíve. A `TodayRow`-nak **négy kiharcolt viselkedési szabályt** kell vinnie az `ItemRow`-tól (spec §5.2) — a tesztek pontosan ezeket állítják.

**Files:**
- Create: `frontend/src/features/today/components/TodayRow.tsx`
- Create: `frontend/src/features/today/components/TodayRow.test.tsx`
- Create: `frontend/src/features/today/components/TodayList.tsx`
- Create: `frontend/src/features/today/components/TodayList.test.tsx`

**Interfaces:**
- Consumes: `RowAccessory` a `@/features/today/logic/rowAccessory`-ból; `cn` a `@/shared/lib/cn`-ből.
- Produces:
  ```ts
  export type RowTone = 'habit' | 'quest' | 'fuel' | 'check' | 'train' | 'plain'
  export interface TodayRowProps {
    tone: RowTone
    icon: string
    title: string
    subtitle?: string | null
    time?: string | null
    accessory: RowAccessory | 'chevron'
    /** A szöveggomb felirata — `accessory: 'button'` esetén kötelező. */
    actionLabel?: string
    onAction?: () => void
    done?: boolean
    linkUrl?: string | null
    disabled?: boolean
  }
  export function TodayRow(props: TodayRowProps): JSX.Element
  export function TodayList({ children }: { children: ReactNode }): JSX.Element
  ```

- [ ] **Step 1: Írd meg a `TodayRow` bukó tesztjét**

Create `frontend/src/features/today/components/TodayRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { TodayRow } from '@/features/today/components/TodayRow'

describe('TodayRow — a négy kísérő', () => {
  test('tick: pipáló karika, a sor címét tartalmazó akadálymentes névvel', async () => {
    const onAction = vi.fn()
    render(<TodayRow tone="habit" icon="💪" title="50 fekvőtámasz" accessory="tick" onAction={onAction} />)
    const tick = screen.getByRole('button', { name: /50 fekvőtámasz/ })
    await userEvent.click(tick)
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('button: tintás szöveggomb a saját feliratával', async () => {
    const onAction = vi.fn()
    render(<TodayRow tone="fuel" icon="🍳" title="Fehérjés reggeli" accessory="button"
                     actionLabel="Logolás" onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Logolás' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('chevron: az EGÉSZ sor a gomb', async () => {
    const onAction = vi.fn()
    render(<TodayRow tone="plain" icon="✦" title="Szándékkal élted a napot?" accessory="chevron"
                     onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: /Szándékkal élted a napot\?/ }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('none: olvasható sor, semmilyen gomb nélkül', () => {
    render(<TodayRow tone="plain" icon="✦" title="Jelen lenni" accessory="none" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Jelen lenni')).toBeInTheDocument()
  })
})

describe('TodayRow — az ItemRow-tól átvett viselkedési szabályok', () => {
  test('`actionLabel` `onAction` nélkül inert szöveg, sosem halott gomb', () => {
    render(<TodayRow tone="habit" icon="💪" title="Még vár" accessory="button" actionLabel="Még vár" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Még vár')).toBeInTheDocument()
  })

  test('`disabled` VISSZAVONJA a kontrollt (nem halványítja) — semmi nem marad kattintható', () => {
    const onAction = vi.fn()
    render(<TodayRow tone="habit" icon="💪" title="50 fekvőtámasz" accessory="tick"
                     onAction={onAction} disabled />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('`linkUrl` az akció MELLETT áll, és nincs a sor gombján BELÜL', () => {
    const onAction = vi.fn()
    render(<TodayRow tone="habit" icon="🎬" title="Reggeli videó" accessory="chevron"
                     onAction={onAction} linkUrl="https://example.com/v" />)
    const link = screen.getByRole('link', { name: /Reggeli videó megnyitása/ })
    const hit = screen.getByRole('button', { name: /Reggeli videó/ })
    expect(link).toBeInTheDocument()
    expect(hit).not.toContainElement(link) // sosem beágyazva
  })

  test('`done` sor: áthúzott cím + telt karika, de az IKON NEM cserélődik ✓-ra', () => {
    render(<TodayRow tone="habit" icon="💪" title="50 fekvőtámasz" accessory="tick" done />)
    expect(screen.getByText('💪')).toBeInTheDocument()
    expect(screen.getByText('50 fekvőtámasz')).toBeInTheDocument()
  })

  test('az alsó sor és az idő is megjelenik', () => {
    render(<TodayRow tone="check" icon="💗" title="Hogy vagy?" subtitle="4 kérdés"
                     time="14:00" accessory="none" />)
    expect(screen.getByText('4 kérdés')).toBeInTheDocument()
    expect(screen.getByText('14:00')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/components/TodayRow.test.tsx`
Expected: FAIL — „Failed to resolve import … TodayRow"

- [ ] **Step 3: Írd meg a `TodayRow`-t**

Create `frontend/src/features/today/components/TodayRow.tsx`:

```tsx
// ============================================================
// Mezo · TodayRow — a Mai lap sora az iOS listanyelven (mezo-e26w).
// TUDATOSAN NEM a `shared/ui/ItemRow`: azt a Fuel „Mai" és a rutin-szerkesztő
// is rendereli, és ebben a változásban egyiket sem mozdítjuk (spec §7).
// Négy kísérő-alak — `tick` (MANUAL szokás pipálása) · `button` (tintás
// szöveggomb) · `chevron` (az EGÉSZ sor a gomb) · `none` (olvasható sor).
// Az `ItemRow`-tól szó szerint átvett négy viselkedési szabály:
//   • `linkUrl` → trailing ↗ az akció MELLETT, sosem helyette, és SOSEM a sor
//     saját <button>-jén belül (érvénytelen HTML + kattintás-ütközés).
//   • `disabled` (repülő írás) → a kontroll VISSZAVONÓDIK, nem halványul —
//     nem marad kattintható felület, így dupla koppintás nem indít másodikat.
//   • `actionLabel` `onAction` nélkül → inert szöveg, sosem halott gomb.
//   • `done` → áthúzott cím + telt karika, de az IKON NEM cserélődik ✓-ra
//     (az `ItemRow` cseréli; itt a karika hordozza a pipálást).
// Domain-mentes: csak prezentációs propok.
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { RowAccessory } from '@/features/today/logic/rowAccessory'

export type RowTone = 'habit' | 'quest' | 'fuel' | 'check' | 'train' | 'plain'

export interface TodayRowProps {
  tone: RowTone
  icon: string
  title: string
  subtitle?: string | null
  /** Trailing HH:mm; csak akkor látszik, ha nincs kísérő kontroll. */
  time?: string | null
  accessory: RowAccessory | 'chevron'
  /** A szöveggomb felirata — `accessory: 'button'` esetén kötelező. */
  actionLabel?: string
  onAction?: () => void
  done?: boolean
  /** Külső tartalom új lapon; a trailing ↗-t rendereli. */
  linkUrl?: string | null
  /** Repülő írás — minden interaktív kontrollt visszavon a soron. */
  disabled?: boolean
}

export function TodayRow({
  tone, icon, title, subtitle, time, accessory, actionLabel, onAction, done, linkUrl, disabled,
}: TodayRowProps) {
  const live = Boolean(onAction) && !disabled

  const core = (
    <>
      <span className={cn('td-ic', tone !== 'plain' && `t-${tone}`)} aria-hidden="true">{icon}</span>
      <span className="td-tx">
        <span className="td-t1">{title}</span>
        {subtitle ? <span className="td-t2">{subtitle}</span> : null}
      </span>
    </>
  )

  const link = linkUrl ? (
    <a
      className="td-link np-press"
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} megnyitása`}
    >
      ↗
    </a>
  ) : null

  const cls = cn('td-row', done && 'is-done')

  // chevron — az EGÉSZ sor a gomb. A link SOSEM kerül a gomb belsejébe.
  if (accessory === 'chevron') {
    const hit = (
      <button type="button" className="td-row-hit np-press" onClick={onAction} aria-label={title}
        style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0,
                 background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
        {core}
        <span className="td-chev" aria-hidden="true">›</span>
      </button>
    )
    return live ? <div className={cls}>{hit}{link}</div> : <div className={cls}>{core}{link}</div>
  }

  // tick — pipáló karika; a neve a sor címe, mert a karikának nincs látható szövege.
  if (accessory === 'tick') {
    return (
      <div className={cls}>
        {core}
        {link}
        {live ? (
          <button type="button" className={cn('td-tick', done && 'is-done')}
            onClick={onAction} aria-label={`${title} kipipálása`}>
            ✓
          </button>
        ) : done ? (
          <span className="td-tick is-done" aria-hidden="true">✓</span>
        ) : null}
      </div>
    )
  }

  // button — tintás szöveggomb; címke onAction nélkül inert szöveg.
  if (accessory === 'button') {
    return (
      <div className={cls}>
        {core}
        {link}
        {actionLabel && live ? (
          <button type="button" className="td-act np-press" onClick={onAction}>{actionLabel}</button>
        ) : actionLabel ? (
          <span className="td-act is-inert">{actionLabel}</span>
        ) : null}
      </div>
    )
  }

  // none — olvasható sor; ilyenkor (és csak ilyenkor) jöhet a trailing idő.
  return (
    <div className={cls}>
      {core}
      {link}
      {time ? <span className="td-tm">{time}</span> : null}
    </div>
  )
}
```

- [ ] **Step 4: Futtasd a `TodayRow` tesztjét**

Run: `cd frontend && pnpm test -- src/features/today/components/TodayRow.test.tsx`
Expected: PASS (9 teszt)

- [ ] **Step 5: Írd meg a `TodayList` bukó tesztjét**

Create `frontend/src/features/today/components/TodayList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { TodayList } from '@/features/today/components/TodayList'
import { TodayRow } from '@/features/today/components/TodayRow'

describe('TodayList', () => {
  test('a sorokat EGY dobozba fogja', () => {
    const { container } = render(
      <TodayList>
        <TodayRow tone="habit" icon="💪" title="Egy" accessory="none" />
        <TodayRow tone="habit" icon="☕" title="Kettő" accessory="none" />
      </TodayList>,
    )
    const boxes = container.querySelectorAll('.td-list')
    expect(boxes).toHaveLength(1)
    expect(boxes[0].querySelectorAll('.td-row')).toHaveLength(2)
  })

  test('a fejléc a dobozon KÍVÜL, fölötte áll', () => {
    const { container } = render(
      <TodayList label="Reggeli rutin" count={5}>
        <TodayRow tone="habit" icon="💪" title="Egy" accessory="none" />
      </TodayList>,
    )
    expect(screen.getByText('Reggeli rutin · 5')).toBeInTheDocument()
    const head = container.querySelector('.td-sech')
    expect(head?.nextElementSibling).toHaveClass('td-list')
  })

  test('fejléc nélkül nem renderel fejlécet', () => {
    const { container } = render(
      <TodayList><TodayRow tone="habit" icon="💪" title="Egy" accessory="none" /></TodayList>,
    )
    expect(container.querySelector('.td-sech')).toBeNull()
  })

  test('a fejléc jobb oldali linkje megjelenik', () => {
    render(
      <TodayList label="Napi küldetések" count={1} action={<a href="/me/growth">1/3 · +48 XP ›</a>}>
        <TodayRow tone="quest" icon="📖" title="Olvass" accessory="none" />
      </TodayList>,
    )
    expect(screen.getByRole('link', { name: '1/3 · +48 XP ›' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/components/TodayList.test.tsx`
Expected: FAIL — „Failed to resolve import … TodayList"

- [ ] **Step 7: Írd meg a `TodayList`-et**

Create `frontend/src/features/today/components/TodayList.tsx`:

```tsx
// ============================================================
// Mezo · TodayList — egy szekció az iOS listanyelven (mezo-e26w): a fejléc a
// 16px-es sínen, a dobozon KÍVÜL áll (iOS grouped-list konvenció), a sorok
// EGY lekerekített dobozban, hajszálvonalas elválasztókkal. A doboz nem visel
// árnyékot — a `.5px` keret és a `--surface-card` háttér adja az elkülönülést.
// Domain-mentes: csak prezentációs propok.
// ============================================================
import type { ReactNode } from 'react'

export interface TodayListProps {
  /** A szekció neve; hiányában nincs fejléc (pl. egy önálló, cím nélküli doboz). */
  label?: string
  /** A fejlécben a név mögé kerülő darabszám. */
  count?: number
  /** A fejléc jobb szélén álló link/gomb (küldetés → /me/growth, fuel → napló). */
  action?: ReactNode
  children: ReactNode
}

export function TodayList({ label, count, action, children }: TodayListProps) {
  return (
    <div className="td-sec">
      {label && (
        <div className="td-sech">
          <b>{count != null ? `${label} · ${count}` : label}</b>
          {action}
        </div>
      )}
      <div className="td-list">{children}</div>
    </div>
  )
}
```

- [ ] **Step 8: Futtasd mindkét tesztet**

Run: `cd frontend && pnpm test -- src/features/today/components/TodayRow.test.tsx src/features/today/components/TodayList.test.tsx`
Expected: PASS (13 teszt)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/today/components/TodayRow.tsx frontend/src/features/today/components/TodayRow.test.tsx frontend/src/features/today/components/TodayList.tsx frontend/src/features/today/components/TodayList.test.tsx
git commit -m "feat(today): TodayRow + TodayList — az iOS csoportos listanyelv (mezo-e26w)"
```

---

### Task 7: `TodayStats`

**Files:**
- Create: `frontend/src/features/today/components/TodayStats.tsx`
- Create: `frontend/src/features/today/components/TodayStats.test.tsx`

**Interfaces:**
- Consumes: `IslandFact` a `@/features/today/logic/islandFacts`-ból (alakja: `{ label, value, unit?, delta?: { text, tone } }`).
- Produces: `export function TodayStats({ facts }: { facts: IslandFact[] }): JSX.Element | null`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `frontend/src/features/today/components/TodayStats.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { TodayStats } from '@/features/today/components/TodayStats'
import type { IslandFact } from '@/features/today/logic/islandFacts'

const weight: IslandFact = {
  label: 'Súly', value: '78,6', unit: 'kg',
  delta: { text: '−0,6 a héten · cél 73,0', tone: 'good' },
}
const hrv: IslandFact = { label: 'HRV', value: '64', unit: 'ms' }

describe('TodayStats', () => {
  test('üres listán semmit nem renderel (strip-filozófia: nincs forrás → nincs cella)', () => {
    const { container } = render(<TodayStats facts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('minden cella EGY dobozban ül', () => {
    const { container } = render(<TodayStats facts={[weight, hrv]} />)
    expect(container.querySelectorAll('.td-stats')).toHaveLength(1)
    expect(container.querySelectorAll('.td-stat')).toHaveLength(2)
  })

  test('érték, egység, címke és delta mind megjelenik', () => {
    render(<TodayStats facts={[weight]} />)
    expect(screen.getByText('78,6')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getByText('Súly')).toBeInTheDocument()
    expect(screen.getByText('−0,6 a héten · cél 73,0')).toBeInTheDocument()
  })

  test('a delta hangneme osztályba fordul', () => {
    const { container } = render(<TodayStats facts={[weight]} />)
    expect(container.querySelector('.td-stat-d')).toHaveClass('is-good')
  })

  test('delta nélküli cella nem hagy üres helyet', () => {
    const { container } = render(<TodayStats facts={[hrv]} />)
    expect(container.querySelector('.td-stat-d')).toBeNull()
  })

  test('a rács a cellák számát követi', () => {
    const { container } = render(<TodayStats facts={[weight, hrv]} />)
    const box = container.querySelector('.td-stats') as HTMLElement
    expect(box.style.gridTemplateColumns).toBe('repeat(2, 1fr)')
  })
})
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/components/TodayStats.test.tsx`
Expected: FAIL — „Failed to resolve import … TodayStats"

- [ ] **Step 3: Írd meg az implementációt**

Create `frontend/src/features/today/components/TodayStats.tsx`:

```tsx
// ============================================================
// Mezo · TodayStats — a napszak 1–2 kontextuális tény-cellája (mezo-e26w), az
// `IslandFactsStrip` utódja. Egyetlen dobozban ülnek, függőleges hajszálvonallal
// elválasztva — a mai kétdobozos strip helyett. A strip-filozófia változatlan:
// nincs forrás → NINCS cella, sosem `—` placeholder.
// ============================================================
import type { IslandFact } from '@/features/today/logic/islandFacts'

export function TodayStats({ facts }: { facts: IslandFact[] }) {
  if (facts.length === 0) return null
  return (
    <div className="td-stats" style={{ gridTemplateColumns: `repeat(${facts.length}, 1fr)` }}>
      {facts.map((f) => (
        <div key={f.label} className="td-stat">
          <div className="td-stat-v">
            {f.value}
            {f.unit && <small>{f.unit}</small>}
          </div>
          <div className="td-stat-l">{f.label}</div>
          {f.delta && <div className={`td-stat-d is-${f.delta.tone}`}>{f.delta.text}</div>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `cd frontend && pnpm test -- src/features/today/components/TodayStats.test.tsx`
Expected: PASS (6 teszt)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/components/TodayStats.tsx frontend/src/features/today/components/TodayStats.test.tsx
git commit -m "feat(today): TodayStats — egydobozos statisztika-csoport (mezo-e26w)"
```

---

### Task 8: `MezoChip`

**Files:**
- Create: `frontend/src/features/today/components/MezoChip.tsx`
- Create: `frontend/src/features/today/components/MezoChip.test.tsx`

**Interfaces:**
- Consumes: `MezoMessageItem` a `@/features/today/logic/mezoMessages`-ből.
- Produces:
  ```ts
  export function MezoChip({ messages, unread, onOpen }: {
    messages: MezoMessageItem[]
    unread: boolean
    onOpen: () => void
  }): JSX.Element | null
  ```

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `frontend/src/features/today/components/MezoChip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MezoChip } from '@/features/today/components/MezoChip'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

const msg = (id: string, first: string): MezoMessageItem => ({
  id, eyebrow: 'Reggeli briefing', time: '06:30', paragraphs: [first], refs: [], meta: null,
})

describe('MezoChip', () => {
  test('üzenet nélkül SEMMIT nem renderel (honest absence)', () => {
    const { container } = render(<MezoChip messages={[]} unread={false} onOpen={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('a legfrissebb üzenet első mondatát mutatja', () => {
    render(<MezoChip unread={false} onOpen={() => {}}
      messages={[msg('briefing', 'Jó reggelt.'), msg('note', 'Fehérjéből 100 g van meg.')]} />)
    expect(screen.getByText('Fehérjéből 100 g van meg.')).toBeInTheDocument()
    expect(screen.queryByText('Jó reggelt.')).not.toBeInTheDocument()
  })

  test('a plecsni az üzenetek darabszáma', () => {
    render(<MezoChip unread={false} onOpen={() => {}}
      messages={[msg('a', 'x'), msg('b', 'y'), msg('c', 'z')]} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('az akadálymentes név hordozza a darabszámot és az olvasatlanságot', () => {
    render(<MezoChip messages={[msg('a', 'x'), msg('b', 'y')]} unread onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: /Mezo üzenetei, 2 üzenet, olvasatlan/ })).toBeInTheDocument()
  })

  test('olvasottan nincs olvasatlan-pötty és a név sem említi', () => {
    const { container } = render(
      <MezoChip messages={[msg('a', 'x')]} unread={false} onOpen={() => {}} />,
    )
    expect(container.querySelector('.td-av.is-unread')).toBeNull()
    expect(screen.getByRole('button', { name: /Mezo üzenetei, 1 üzenet$/ })).toBeInTheDocument()
  })

  test('olvasatlanul ott a pötty', () => {
    const { container } = render(<MezoChip messages={[msg('a', 'x')]} unread onOpen={() => {}} />)
    expect(container.querySelector('.td-av.is-unread')).toBeInTheDocument()
  })

  test('a TELJES chip a gomb, és megnyitja a szálat', async () => {
    const onOpen = vi.fn()
    render(<MezoChip messages={[msg('a', 'x')]} unread onOpen={onOpen} />)
    const chip = screen.getByRole('button', { name: /Mezo üzenetei/ })
    expect(chip).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(chip)
    expect(onOpen).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/components/MezoChip.test.tsx`
Expected: FAIL — „Failed to resolve import … MezoChip"

- [ ] **Step 3: Írd meg az implementációt**

Create `frontend/src/features/today/components/MezoChip.tsx`:

```tsx
// ============================================================
// Mezo · MezoChip — a companion hangja a Mai lapon, EGYETLEN 44px-es sorban
// (mezo-e26w), a full-bleed `MezoMessage` sáv utódja. A sáv azért ment nyugdíjba,
// mert mind a három napszakon ugyanaz a REGGELI briefing állt benne, ~600px-en.
// A chip csak az utolsó üzenet első mondatát mutatja; minden más a sheetben van.
// Honest absence: üzenet nélkül a chip EGYÁLTALÁN nem renderel — nincs üres
// állapot, nincs placeholder (mock módban ma csak a briefing van, tehát „1").
// Prezentációs: az olvasatlan-állapotot a hívó adja (`shared/lib/seenMessages`).
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

export function MezoChip({ messages, unread, onOpen }: {
  messages: MezoMessageItem[]
  unread: boolean
  onOpen: () => void
}) {
  if (messages.length === 0) return null
  const latest = messages[messages.length - 1]
  const preview = latest.paragraphs[0] ?? ''
  const label = `Mezo üzenetei, ${messages.length} üzenet${unread ? ', olvasatlan' : ''}`

  return (
    <button
      type="button"
      className="td-chip np-press"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={onOpen}
    >
      <span className={cn('td-av', unread && 'is-unread')} aria-hidden="true">✦</span>
      <span className="td-chip-t">
        <b>Mezo</b>
        <i>{preview}</i>
      </span>
      <span className="td-chip-n" aria-hidden="true">{messages.length}</span>
      <span className="td-chev" aria-hidden="true">›</span>
    </button>
  )
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `cd frontend && pnpm test -- src/features/today/components/MezoChip.test.tsx`
Expected: PASS (7 teszt)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/components/MezoChip.tsx frontend/src/features/today/components/MezoChip.test.tsx
git commit -m "feat(today): MezoChip — a companion hangja egy 44px-es sorban (mezo-e26w)"
```

---

### Task 9: `MezoMessagesSheet`

**Files:**
- Create: `frontend/src/features/today/components/MezoMessagesSheet.tsx`
- Create: `frontend/src/features/today/components/MezoMessagesSheet.test.tsx`

**Interfaces:**
- Consumes: `MezoMessageItem`; `Sheet` a `@/shared/ui/Sheet`-ből; `RefTag` a `@/shared/ui/RefTag`-ből; `SafeMarkdown` a `@/shared/lib/safeMarkdown`-ból.
- Produces: `export function MezoMessagesSheet({ messages, onClose }: { messages: MezoMessageItem[]; onClose: () => void }): JSX.Element`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `frontend/src/features/today/components/MezoMessagesSheet.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MezoMessagesSheet } from '@/features/today/components/MezoMessagesSheet'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

const briefing: MezoMessageItem = {
  id: 'briefing', eyebrow: 'Reggeli briefing', time: '06:30',
  paragraphs: ['Jó reggelt.', 'Ma Pull Day.'],
  refs: [{ kind: 'workout', label: 'Push Day · tegnap' }],
  meta: 'Demo tartalom',
}
const note: MezoMessageItem = {
  id: 'note', eyebrow: 'Napközi jegyzet', time: '12:30',
  paragraphs: ['Fehérjéből 100 g van meg.'], refs: [], meta: null,
}

describe('MezoMessagesSheet', () => {
  test('párbeszédként nyílik, magyar címmel', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Mezo üzenetei')).toBeInTheDocument()
  })

  test('a briefing MINDEN bekezdése látszik — sehol nincs csonkolás', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByText('Jó reggelt.')).toBeInTheDocument()
    expect(screen.getByText('Ma Pull Day.')).toBeInTheDocument()
    expect(screen.queryByText(/bővebben/i)).not.toBeInTheDocument()
  })

  test('a hivatkozás-chipek és az őszinte meta-címke megjelennek', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByText(/Push Day · tegnap/)).toBeInTheDocument()
    expect(screen.getByText('Demo tartalom')).toBeInTheDocument()
  })

  test('minden üzenet a saját eyebrow-jával és idejével áll, kronologikusan', () => {
    const { container } = render(<MezoMessagesSheet messages={[briefing, note]} onClose={() => {}} />)
    const bubbles = [...container.querySelectorAll('.td-msg')]
    expect(bubbles).toHaveLength(2)
    expect(within(bubbles[0] as HTMLElement).getByText('Reggeli briefing')).toBeInTheDocument()
    expect(within(bubbles[0] as HTMLElement).getByText('06:30')).toBeInTheDocument()
    expect(within(bubbles[1] as HTMLElement).getByText('Napközi jegyzet')).toBeInTheDocument()
  })

  test('a Kész gomb zárja a sheetet', async () => {
    const onClose = vi.fn()
    render(<MezoMessagesSheet messages={[briefing]} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Kész' }))
    // A Sheet animálva zár; a tesztkörnyezetben a fallback időzítő hívja az onClose-t.
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1000 })
  })

  test('idő nélküli üzenet nem hagy üres időbélyeget', () => {
    const { container } = render(
      <MezoMessagesSheet messages={[{ ...note, time: null }]} onClose={() => {}} />,
    )
    expect(container.querySelector('.td-bub-t')).toBeNull()
  })
})
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/components/MezoMessagesSheet.test.tsx`
Expected: FAIL — „Failed to resolve import … MezoMessagesSheet"

- [ ] **Step 3: Írd meg az implementációt**

Create `frontend/src/features/today/components/MezoMessagesSheet.tsx`:

```tsx
// ============================================================
// Mezo · MezoMessagesSheet — a nap MINDEN generált mezo-üzenete egy szálban
// (mezo-e26w). Ez az az EGY hely, ahova minden jövőbeli üzenet befut; a szálat
// a `logic/mezoMessages.ts` állítja össze a lapon MÁR meglévő hookokból, tehát
// itt nincs se hook, se adatforrás — a komponens prezentációs.
// Sehol nincs csonkolás: a `bővebben` kapcsoló a sávval együtt nyugdíjba ment,
// mert itt nincs mit elrejteni. A szál görgethető (`.td-thread`).
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

export function MezoMessagesSheet({ messages, onClose }: {
  messages: MezoMessageItem[]
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="mezo-msgs-title">
      {(close) => (
        <>
          <div className="td-sheet-h">
            <h2 id="mezo-msgs-title">Mezo üzenetei</h2>
            <button type="button" onClick={close}>Kész</button>
          </div>
          <div className="td-thread">
            <div className="td-daysep">Ma</div>
            {messages.map((m) => (
              <div key={m.id} className="td-msg">
                <div className="td-av" aria-hidden="true">✦</div>
                <div className="td-bub">
                  <div className="td-bub-h">
                    <span className="td-bub-n">{m.eyebrow}</span>
                    {m.time && <span className="td-bub-t">{m.time}</span>}
                  </div>
                  {m.paragraphs.map((p, i) => (
                    <p key={i} className="td-bub-x"><SafeMarkdown text={p} /></p>
                  ))}
                  {m.refs.length > 0 && (
                    <div className="td-bub-refs">
                      {m.refs.map((r, i) => <RefTag key={i} kind={r.kind} label={r.label} />)}
                    </div>
                  )}
                  {m.meta && <div className="td-bub-meta">{m.meta}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy zöld**

Run: `cd frontend && pnpm test -- src/features/today/components/MezoMessagesSheet.test.tsx`
Expected: PASS (6 teszt)

> Ha a „Kész gomb zárja a sheetet" teszt időtúllépéssel bukik, a `Sheet` jsdom alatt a 380ms-os fallback időzítőre támaszkodik — emeld a `waitFor` timeoutját 2000-re, de **ne** kerüld meg a `close()` hívást direkt `onClose`-zal: a sheetnek a saját záró-mozgásával kell zárnia.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/components/MezoMessagesSheet.tsx frontend/src/features/today/components/MezoMessagesSheet.test.tsx
git commit -m "feat(today): MezoMessagesSheet — a nap üzenet-szála (mezo-e26w)"
```

---

### Task 10: `DaypartTabs` — vályú + csúszó bélyeg

**Files:**
- Modify: `frontend/src/features/today/components/DaypartTabs.tsx`
- Modify: `frontend/src/features/today/components/DaypartTabs.test.tsx` (a meglévő 5 teszt **állításai megmaradnak**; csak a szövegfelbontás igazodik az `<em>` wrapperhez)

**Interfaces:**
- Consumes: `DAY_FACES`, `FACE_EMOJI`, `FACE_LABEL`, `DayFace` a `@/features/today/logic/dayFace`-ből.
- Produces: `DaypartTabsProps` **változatlan** (`selected`, `current`, `onSelect`).

- [ ] **Step 1: Bővítsd a meglévő tesztet**

A `DaypartTabs.test.tsx` első tesztje ma a `textContent`-et hasonlítja. Az emoji `<em>`-be kerül, de a `textContent` ugyanaz marad. **Ne írd át.** Adj hozzá EGY új tesztet a fájl végére, a `describe`-on belülre:

```tsx
  test('a vályú EGY doboz, a kiválasztott szegmens a csúszó bélyeg', () => {
    const { container } = render(<DaypartTabs selected="nap" current="nap" onSelect={() => {}} />)
    expect(container.querySelectorAll('.td-seg')).toHaveLength(1)
    expect(container.querySelectorAll('.td-seg > button')).toHaveLength(3)
    expect(container.querySelector('.segtabs')).toBeNull() // a régi hármas-pirula kontroll nyugdíjban
  })
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy az ÚJ teszt bukik**

Run: `cd frontend && pnpm test -- src/features/today/components/DaypartTabs.test.tsx`
Expected: 5 PASS, 1 FAIL („expected 0 to be 1" a `.td-seg`-en)

- [ ] **Step 3: Írd át a komponenst**

Replace `frontend/src/features/today/components/DaypartTabs.tsx` teljes tartalmát:

```tsx
// ============================================================
// Mezo · DaypartTabs — a Mai lap napszak-váltója (mezo-e26w). A három külön
// keretes pirula (`.segtabs`) helyére EGY vályú + egy csúszó bélyeg lép, az
// iOS szegmentált kontroll nyelvén. Két független jel, sosem összemosva:
// a NYOMOTT szegmens az, amit nézel (`selected`, a `?dp=`-ből derivált), az
// arany pötty pedig az, hol jár az óra (`current`) — a DayFaceStrip dual-signal
// öröksége. Prezentációs: nem birtokol state-et és nem olvas hookot.
// ============================================================
import { DAY_FACES, FACE_EMOJI, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'

export interface DaypartTabsProps {
  /** Amit a képernyő mutat — a `?dp=`-ből, az órára visszaesve. */
  selected: DayFace
  /** Hol jár az óra — a kiválasztástól FÜGGETLENÜL jelölve. */
  current: DayFace
  onSelect: (face: DayFace) => void
}

export function DaypartTabs({ selected, current, onSelect }: DaypartTabsProps) {
  return (
    <div className="daytabs td-segwrap">
      <div className="td-seg" role="group" aria-label="Napszak">
        {DAY_FACES.map((face) => (
          <button
            key={face}
            type="button"
            className="np-press"
            aria-pressed={face === selected}
            onClick={() => onSelect(face)}
          >
            <em aria-hidden="true">{FACE_EMOJI[face]}</em> {FACE_LABEL[face]}
            {face === current && <span className="td-now" role="img" aria-label="most" />}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Futtasd, és győződj meg róla, hogy mind a 6 zöld**

Run: `cd frontend && pnpm test -- src/features/today/components/DaypartTabs.test.tsx`
Expected: PASS (6 teszt). Ha az első teszt `textContent`-je most extra szóközt kap, javítsd a **tesztet** `.replace(/\s+/g, ' ').trim()`-mel — a komponens szóköz-elrendezése helyes.

- [ ] **Step 5: Töröld a `.daytabs` régi szabályait**

A `prototype.css`-ben (~2406) **töröld** ezt a három sort — a `.td-segwrap`/`.td-seg`/`.td-now` váltotta le őket:

```css
.daytabs { padding: 4px 20px 12px; }
.daytabs .segtab { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.daytab-now { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-base);
```

> A `.daytab-now` blokk több soros — töröld a teljes szabályt a záró `}`-ig. A `.segtabs`/`.segtab` **általános** blokk (~3239) MARAD: azt a Sport és a Futás oldal használja.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/components/DaypartTabs.tsx frontend/src/features/today/components/DaypartTabs.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): a napszak-váltó vályú + csúszó bélyeg lesz (mezo-e26w)"
```

---

### Task 11: `DayGroups` a `TodayList`-re + `IntentionBanner` átalakítás

**Files:**
- Modify: `frontend/src/features/today/components/DayGroups.tsx`
- Modify: `frontend/src/features/today/components/DayGroups.test.tsx`
- Modify: `frontend/src/features/today/components/IntentionBanner.tsx`
- Modify: `frontend/src/features/today/components/IntentionBanner.test.tsx`

**Interfaces:**
- Consumes: `TodayList`, `TodayRow`, `rowAccessory`, `TodayItem`, `GrowthTodaySummary`.
- Produces: `DayGroupsProps` **változatlan** (`open`, `done`, `doneLabel`, `dayXp`, `head`, `focus`, `growth`, `habitPending`, `onAct`).

- [ ] **Step 1: Igazítsd a `DayGroups` tesztjét az új DOM-ra**

A `DayGroups.test.tsx` meglévő **viselkedési** állításai (csoport-sorrend, darabszám a fejlécben, a küldetés-fejléc `/me/growth` linkje, kész-hajtás nyit-zár) **mind maradnak**. Ami változik: az `.itemrow` szelektorok `.td-row`-ra, az `.isl-grouph` `.td-sech`-re, a `.dv-done` `.td-done`-ra. Menj végig a fájlon és cseréld a szelektorokat; a `screen.getByText`/`getByRole` alapú állításokhoz **ne nyúlj**.

Adj hozzá EGY új tesztet a `describe` végére:

```tsx
  test('minden csoport EGY dobozban ül, és a MANUAL szokás karikát kap', () => {
    const { container } = render(
      <DayGroups open={[manualHabitItem]} done={[]} doneLabel="✓ 0 kész" onAct={() => {}} />,
    )
    expect(container.querySelectorAll('.td-list')).toHaveLength(1)
    expect(container.querySelector('.td-tick')).toBeInTheDocument()
  })
```

> A `manualHabitItem` fixture-t a fájl tetején lévő meglévő item-építő mintájára írd meg: `source: 'habit'`, `action: { kind: 'habit', habit: { …, mode: 'MANUAL' }, label: 'Pipa' }`. Ha a fájlban már van habit-fixture, azt használd.

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy az ÚJ teszt bukik**

Run: `cd frontend && pnpm test -- src/features/today/components/DayGroups.test.tsx`
Expected: FAIL az új teszten (és a szelektorosokon, amíg nincs implementáció)

- [ ] **Step 3: Írd át a `DayGroups`-ot**

Replace `frontend/src/features/today/components/DayGroups.tsx`:

```tsx
// ============================================================
// Mezo · DayGroups — egy napszak-nézet tétel-listája (mezo-e26w). A csoportosító
// logika VÁLTOZATLAN a mezo-puci óta: első-megjelenés sorrend, darabszám a
// fejlécben, a küldetés-fejléc egyetlen /me/growth útvonala, head/focus slotok.
// Ami változott: minden csoport EGY `TodayList` dobozban ül, és a sorok a
// Today saját `TodayRow`-ja — NEM a `shared/ui/ItemRow` (spec §7: azt a Fuel
// és a rutin-szerkesztő is rendereli, és ebben a változásban nem mozdulnak).
// Az EGYETLEN összecsukott elem a lapon továbbra is a kész-hajtás.
// ============================================================
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TodayList } from '@/features/today/components/TodayList'
import { TodayRow, type RowTone } from '@/features/today/components/TodayRow'
import { rowAccessory } from '@/features/today/logic/rowAccessory'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { ItemSource, TodayItem } from '@/features/today/logic/todayItems'

const SOURCE_TONE: Record<ItemSource, RowTone> = {
  habit: 'habit', quest: 'quest', fuel: 'fuel', checkin: 'check', session: 'train', ritual: 'habit',
}

export interface DayGroupsProps {
  open: TodayItem[]
  done: TodayItem[]
  /** A becsukott hajtás teljes felirata, pl. „✓ 3 kész ma · +40 XP". */
  doneLabel: string
  /** Esti visszatekintés összege — a kinyitott kész-blokkot zárja. */
  dayXp?: number | null
  /** A nap/este companion-jegyzete, a csoportok fölött. */
  head?: ReactNode
  /** IntentionBanner slot — saját „Fókusz" fejléc alatt. */
  focus?: ReactNode
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function DayGroups({
  open, done, doneLabel, dayXp, head, focus, growth, habitPending, onAct,
}: DayGroupsProps) {
  const [doneOpen, setDoneOpen] = useState(false)

  // Első-megjelenés sorrend — a Map megőrzi a beszúrási sorrendet.
  const groups = new Map<string, TodayItem[]>()
  for (const it of open) {
    const bucket = groups.get(it.group)
    if (bucket) bucket.push(it)
    else groups.set(it.group, [it])
  }

  const rowOf = (it: TodayItem, isDone = false) => (
    <TodayRow
      key={it.id}
      tone={SOURCE_TONE[it.source]}
      icon={it.emoji}
      title={it.title}
      subtitle={it.subtitle}
      time={it.time}
      accessory={isDone ? 'none' : rowAccessory(it)}
      actionLabel={isDone ? undefined : it.action?.label}
      onAction={!isDone && it.action ? () => onAct(it) : undefined}
      linkUrl={it.linkUrl}
      disabled={habitPending && it.action?.kind === 'habit'}
      done={isDone}
    />
  )

  return (
    <div className="dv-groups">
      {head}
      {[...groups].map(([group, rows]) => (
        <TodayList
          key={group}
          label={group}
          count={rows.length}
          action={
            group === 'Napi küldetések' && growth && growth.total > 0 ? (
              <Link to="/me/growth" aria-label="Küldetések kezelése a Növekedésben">
                {growth.done}/{growth.total} · +{growth.xp} XP ›
              </Link>
            ) : undefined
          }
        >
          {rows.map((it) => rowOf(it))}
        </TodayList>
      ))}
      {focus}
      {done.length > 0 && (
        <>
          <button
            type="button"
            className="td-done np-press"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((v) => !v)}
          >
            {doneLabel}
            <span aria-hidden="true">{doneOpen ? '▴' : '▾'}</span>
          </button>
          {doneOpen && (
            <>
              <TodayList>{done.map((it) => rowOf(it, true))}</TodayList>
              {dayXp != null && <div className="td-dayxp">Ma összesen +{dayXp} XP</div>}
            </>
          )}
        </>
      )}
    </div>
  )
}
```

> **Figyelem:** a `focus` slot most már **maga hozza a saját `TodayList`-jét** (az `IntentionBanner`), ezért a régi „Fókusz" `isl-grouph` fejléc innen KIKERÜLT. Ezt a következő lépés valósítja meg.

- [ ] **Step 4: Írd át az `IntentionBanner` `chip` variánsát**

A `frontend/src/features/today/components/IntentionBanner.tsx` `reflect` variánsa **változatlan marad**. A `chip` variáns `return`-jét (az 51–97. sorokat) cseréld erre:

```tsx
  return (
    <>
      <TodayList
        label="Fókusz"
        action={
          !data.creed ? (
            <button type="button" onClick={() => setCreedOpen(true)}>+ Vezérelv megírása</button>
          ) : data.foci.length < data.focusCap ? (
            <button type="button" aria-label="Fókusz hozzáadása" onClick={() => setFocusOpen(true)}>
              + Mai fókusz
            </button>
          ) : undefined /* a napi sapkán — nincs halott kontroll (az ItemRow doktrína) */
        }
      >
        <div className="td-creed">
          {data.creed ? (
            // A vezérelv maga a szerkesztő affordancia — a CreedSheet-nek nincs más belépője.
            <button type="button" className="td-creed-q" aria-label="Vezérelv szerkesztése"
              onClick={() => setCreedOpen(true)}>
              „{data.creed}"
            </button>
          ) : (
            <span className="td-creed-q">
              Fogalmazd meg az irányt, ami a döntéseidet vezeti — egy mondat, amire minden nap ránézel.
            </span>
          )}
        </div>
        {data.foci.map((f) => (
          <TodayRow key={f.id} tone="plain" icon="✦" title={f.text} accessory="none" />
        ))}
      </TodayList>

      {focusOpen && <IntentionSheet creed={data.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {creedOpen && <CreedSheet initial={data.creed ?? ''} onSave={setCreed} onClose={() => setCreedOpen(false)} />}
    </>
  )
```

És vedd fel az importokat a fájl tetejére:

```tsx
import { TodayList } from '@/features/today/components/TodayList'
import { TodayRow } from '@/features/today/components/TodayRow'
```

- [ ] **Step 5: Igazítsd az `IntentionBanner` tesztjét**

A meglévő állítások (a vezérelv megjelenik · a `+ Mai fókusz` a sapkánál eltűnik · a fókuszok láthatók · a sheetek nyílnak · üres állapotban a felhívó szöveg) **mind maradnak**. Csak a `.creedchip*` szelektorokat cseréld `.td-creed` / `.td-list` / `.td-row`-ra. A `screen.getByText`/`getByRole` állításokhoz ne nyúlj.

- [ ] **Step 6: Futtasd mindkét tesztet**

Run: `cd frontend && pnpm test -- src/features/today/components/DayGroups.test.tsx src/features/today/components/IntentionBanner.test.tsx`
Expected: PASS mindkettő

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/components/DayGroups.tsx frontend/src/features/today/components/DayGroups.test.tsx frontend/src/features/today/components/IntentionBanner.tsx frontend/src/features/today/components/IntentionBanner.test.tsx
git commit -m "feat(today): DayGroups és a Fókusz az iOS csoportos listanyelven (mezo-e26w)"
```

---

### Task 12: A három napszak-nézet

**Files:**
- Modify: `frontend/src/features/today/components/DaypartPanel.tsx`
- Modify: `frontend/src/features/today/components/DaypartMorning.tsx` (+ `.test.tsx`)
- Modify: `frontend/src/features/today/components/DaypartDay.tsx` (+ `.test.tsx`)
- Modify: `frontend/src/features/today/components/DaypartEvening.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `TodayStats`, `TodayList`, `TodayRow`, `DayGroups`.
- Produces: mind a négy komponens **propja változatlan** — a `TodayPage` hívása egy sort sem változik.

- [ ] **Step 1: `DaypartHero` az új osztályokra**

A `DaypartPanel.tsx`-ben a `DaypartHero` `return`-jét cseréld (a `DaypartPanel` maga **változatlan**, a `.dayview` osztály marad):

```tsx
export function DaypartHero({ value, unit, sub }: {
  value: string
  unit?: string | null
  sub?: string | null
}) {
  return (
    <div className="td-hero">
      <div className="td-hero-l">
        <span className="td-hero-v">{value}</span>
        {unit && <span className="td-hero-u">{unit}</span>}
      </div>
      {sub && <span className="td-hero-s">{sub}</span>}
    </div>
  )
}
```

Frissítsd a `DaypartPanel.tsx` fejléc-kommentárját is: a „boxes exist only INSIDE (fact strip, ItemRows, chips)" mondat helyére „the content speaks ONE box language (`TodayList`); this component only carries the tab-switch cross-fade and the night state".

- [ ] **Step 2: `DaypartMorning` — a strip cseréje**

A `DaypartMorning.tsx`-ben:
- import: `IslandFactsStrip` → `TodayStats` (`import { TodayStats } from '@/features/today/components/TodayStats'`)
- a JSX-ben `<IslandFactsStrip facts={facts} />` → `<TodayStats facts={facts} />`

- [ ] **Step 3: `DaypartDay` — strip + CTA + warn**

A `DaypartDay.tsx`-ben:
- import: `IslandFactsStrip` → `TodayStats`
- `<IslandFactsStrip facts={facts} />` → `<TodayStats facts={facts} />`
- a warn-chipet és a CTA-sort cseréld (a mai 68–79. sorok):

```tsx
      {hero ? (
        <button type="button" className="td-cta np-press" onClick={() => hero.onLog?.()}>
          {hero.ctaLabel ?? 'Indítsuk'}
        </button>
      ) : (
        <button type="button" className="td-cta np-press" onClick={onCustom}>
          Saját edzés
        </button>
      )}
      {heroWarn && <div className="td-foot is-warn">⚠ {heroWarn}</div>}
```

> A figyelmeztetés a CTA **alá** került (spec §4: „a CTA alatt lábjegyzet-szöveg, doboz nélkül") — a mai sorrend fordított volt.

- [ ] **Step 4: `DaypartEvening` — strip + CTA + ghost + éjszakai sor**

A `DaypartEvening.tsx`-ben:
- import: `IslandFactsStrip` → `TodayStats`
- `<IslandFactsStrip facts={phaseFacts} />` → `<TodayStats facts={phaseFacts} />`
- a `dv-act` blokkot (120–136. sorok) cseréld:

```tsx
      {ritualState === 'open' && (
        <button type="button" className="td-cta is-lav np-press" onClick={() => navigate('/ritual')}>
          Zárjuk le a napot
        </button>
      )}
      {ritualState === 'waiting' && (
        <button type="button" className="td-ghost np-press" onClick={() => navigate('/ritual')}>
          Napzárás {opensAt}-kor nyílik
        </button>
      )}
      {wdCheckable && (
        <button type="button" className="td-ghost np-press" onClick={doWindDown}>
          Leállás megvolt ✓
        </button>
      )}
```

- a két `dv-state` sort (137–138.) cseréld `td-foot`-ra:

```tsx
      {ph === 'winddown' && wdDone && <div className="td-foot">Leállás megvolt ✓</div>}
      {ritualState === 'done' && <div className="td-foot">Napzárás kész ✓</div>}
```

- az éjszakai ágban a `dv-nightrow` **marad** (saját sötét állapota van, és a `.dayview.is-night` alatt él).

- [ ] **Step 5: Igazítsd a három nézet tesztjét**

Mind a háromban: a `.isl-facts` → `.td-stats`, `.isl-cta` → `.td-cta`, `.isl-more` → `.td-ghost`, `.isl-warnchip` → `.td-foot.is-warn`, `.dv-state` → `.td-foot`. **Minden viselkedési állítás (a négy esti fázis, a ritual-sor szűrés, a `wind_down` offered-exactly-once trió, a CTA-navigáció, a pihenőnapi `Saját edzés`) marad.**

- [ ] **Step 6: Futtasd a négy tesztet**

Run: `cd frontend && pnpm test -- src/features/today/components/DaypartMorning.test.tsx src/features/today/components/DaypartDay.test.tsx src/features/today/components/DaypartEvening.test.tsx src/features/today/components/DaypartPanel.test.tsx`
Expected: PASS mind

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/components/Daypart*.tsx
git commit -m "feat(today): a három napszak-nézet az új lapnyelven (mezo-e26w)"
```

---

### Task 13: `TodayPage` — chip + sheet, és a `TodaySkeleton`

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.test.tsx`
- Modify: `frontend/src/features/today/pages/TodaySkeleton.tsx`
- Modify: `frontend/src/features/today/pages/TodaySkeleton.test.tsx`

**Interfaces:**
- Consumes: `MezoChip`, `MezoMessagesSheet`, `buildMezoMessages`, `lastSeenMessage`, `markMessagesSeen`.
- Produces: semmit (ez a kompozíciós gyökér).

- [ ] **Step 1: Írd meg a bukó tesztet**

A `TodayPage.test.tsx`-ben **töröld** azokat a teszteket, amelyek a `MezoMessage` sávot a lapon állítják (a briefing prózájának jelenlétét a `.cb-band`-ben), és tegyél a helyükre hármat:

```tsx
  test('a briefing NEM a lapon áll — a chip csak az első mondatát mutatja', async () => {
    renderToday()
    expect(await screen.findByRole('button', { name: /Mezo üzenetei/ })).toBeInTheDocument()
    expect(screen.queryByText(/Ma Pull Day, és a Chest Supported Row/)).not.toBeInTheDocument()
  })

  test('a chip megnyitja a szálat, és abban ott a teljes briefing', async () => {
    renderToday()
    await userEvent.click(await screen.findByRole('button', { name: /Mezo üzenetei/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Mezo üzenetei')).toBeInTheDocument()
  })

  test('megnyitás után a chip már nem olvasatlan', async () => {
    const { container } = renderToday()
    await userEvent.click(await screen.findByRole('button', { name: /Mezo üzenetei/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Kész' }))
    await waitFor(() => expect(container.querySelector('.td-av.is-unread')).toBeNull())
  })
```

> A `renderToday()` a fájlban már meglévő render-helper. Ha más a neve, használd azt. A `waitFor`-t és a `userEvent`-et importáld, ha még nincs.

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

Run: `cd frontend && pnpm test -- src/features/today/pages/TodayPage.test.tsx`
Expected: FAIL az új három teszten

- [ ] **Step 3: Írd át a `TodayPage`-et**

Az importoknál **töröld**:

```tsx
import { MezoMessage } from '@/features/today/components/MezoMessage'
```

és a `resolveBriefing` maradjon a `@/data/hooks` importban. **Vedd fel:**

```tsx
import { MezoChip } from '@/features/today/components/MezoChip'
import { MezoMessagesSheet } from '@/features/today/components/MezoMessagesSheet'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import { lastSeenMessage, markMessagesSeen } from '@/shared/lib/seenMessages'
```

A state-blokkhoz (a `reflectOpen` mellé) vedd fel:

```tsx
  const [msgsOpen, setMsgsOpen] = useState(false)
  const [seenId, setSeenId] = useState<string | null>(() => lastSeenMessage(date))
```

A `growth` derivációja mellé (a `return` ELÉ) vedd fel:

```tsx
  // A mezo hangja: a nap üzenet-szála a MÁR MEGLÉVŐ két hookból — nincs új adatforrás.
  // Az olvasatlan-jelzés a szál UTOLSÓ elemének id-jét hasonlítja a napra mentett
  // `localStorage` értékhez; a napváltás magától elavulttá teszi a kulcsot.
  const messages = buildMezoMessages({
    briefing: briefing ?? resolveBriefing(scenario.dayState),
    note: companionNote,
    briefingDemo,
  })
  const latestId = messages.length > 0 ? messages[messages.length - 1].id : null
  const msgsUnread = latestId != null && latestId !== seenId
  const openMessages = () => {
    setMsgsOpen(true)
    if (latestId) {
      markMessagesSeen(date, latestId)
      setSeenId(latestId)
    }
  }
```

A JSX-ben cseréld ezt az egy sort:

```tsx
      <MezoMessage briefing={briefing ?? resolveBriefing(scenario.dayState)} demo={briefingDemo} />
```

erre:

```tsx
      <MezoChip messages={messages} unread={msgsUnread} onOpen={openMessages} />
```

És a sheet-blokk végére (a `reflectOpen` mellé) vedd fel:

```tsx
      {msgsOpen && <MezoMessagesSheet messages={messages} onClose={() => setMsgsOpen(false)} />}
```

- [ ] **Step 4: Igazítsd a `TodaySkeleton`-t**

A `TodaySkeleton.tsx` ma a tab-sor + sáv + nézet vázát rajzolja. Cseréld a sáv vázát chip-vázra, a sorokét listadoboz-vázra:

```tsx
      <div className="daytabs td-segwrap"><Skeleton height={44} radius={999} /></div>
      <div style={{ padding: '0 16px 18px' }}><Skeleton height={44} radius={14} /></div>
      <div style={{ padding: '2px 16px 0' }}><Skeleton height={44} width="60%" /></div>
      <div style={{ padding: '14px 16px 0' }}><Skeleton height={78} radius={14} /></div>
      <div style={{ padding: '26px 16px 0' }}><Skeleton height={168} radius={14} /></div>
```

> A `Skeleton` prop-nevei a `@/shared/ui/Skeleton`-ból jönnek — **olvasd el a fájlt**, és a valódi propokat használd (ha nincs `radius`, hagyd el). Ne találj ki propot.

A `TodaySkeleton.test.tsx` állítása (hogy a váz a tabos layoutot tükrözi) maradjon; ha szelektorra állít, igazítsd.

- [ ] **Step 5: Futtasd a lap tesztjeit**

Run: `cd frontend && pnpm test -- src/features/today/pages/`
Expected: PASS mind (`TodayPage.test.tsx`, `TodayPage.dispatch.test.tsx`, `TodayPage.skeleton.test.tsx`, `TodaySkeleton.test.tsx`)

> A `TodayPage.dispatch.test.tsx` egyetlen állítása sem változhat — ha bukik, a `act()` útvonalakat rontottad el, nem a tesztet kell javítani.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/pages/
git commit -m "feat(today): a lap a MezoChip + MezoMessagesSheet párost hordozza (mezo-e26w)"
```

---

### Task 14: Nyugdíjazás + a hatósugár strukturális őre

**Files:**
- Delete: `frontend/src/features/today/components/MezoMessage.tsx`, `MezoMessage.test.tsx`
- Delete: `frontend/src/features/today/components/IslandFactsStrip.tsx`
- Delete: `frontend/src/features/today/components/CompanionNoteCard.tsx`, `CompanionNoteCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a `.dv-*` és `.cb-band` blokkok)
- Create: `frontend/src/features/today/todayScope.test.ts`

**Interfaces:**
- Consumes: semmit.
- Produces: semmit.

- [ ] **Step 1: A `CompanionNoteCard` utolsó hívóinak lekötése**

A jegyzet a sheetbe költözött, tehát a `DaypartDay` és a `DaypartEvening` `head={note ? <CompanionNoteCard note={note} /> : undefined}` propja **feleslegessé vált**. Mindkét fájlban:
- töröld a `CompanionNoteCard` importját,
- töröld a `head={...}` propot a `DayGroups` hívásából,
- töröld a `note` propot a komponens `Props` interfészéből és a destrukturálásból,
- a `TodayPage`-ben töröld a `note={companionNote}` propot mindkét hívásból.

A `useCompanionNote()` hook hívása a `TodayPage`-ben **MARAD** — a `buildMezoMessages` használja.

- [ ] **Step 2: Töröld a három komponenst**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/today-page-ux-redesign-293a0c
git rm frontend/src/features/today/components/MezoMessage.tsx \
       frontend/src/features/today/components/MezoMessage.test.tsx \
       frontend/src/features/today/components/IslandFactsStrip.tsx \
       frontend/src/features/today/components/CompanionNoteCard.tsx \
       frontend/src/features/today/components/CompanionNoteCard.test.tsx
```

- [ ] **Step 3: Ellenőrizd, hogy senki nem hivatkozik rájuk**

Run:
```bash
cd frontend && grep -rn "MezoMessage\b\|IslandFactsStrip\|CompanionNoteCard" src | grep -v MezoMessages
```
Expected: **üres kimenet**. (A `grep -v MezoMessages` azért kell, hogy az új `MezoMessagesSheet` és `mezoMessages` találatai ne zavarjanak.)

- [ ] **Step 4: Töröld a halott CSS-t**

A `prototype.css`-ből töröld a `.coach-bubble.cb-band` blokkot (~3267–3272) és a `.dv-*` szabályokat, amelyeknek nincs több fogyasztójuk:
`.dv-hero`, `.dv-hero-v`, `.dv-hero-u`, `.dv-hero-sub`, `.dayview .isl-facts`, `.dayview .isl-warnchip`, `.dv-act`, `.dayview .isl-cta`, `.dayview .isl-grouph`, `.dayview .itemrow`, `.dayview .creedchip`, `.dv-done`, `.dv-done-arr`, `.dv-state`.

**MARADNAK:** `.dayview` (az animáció + a `--td-gut` hordozója), `.dayview.is-night` + a hozzá tartozó `.dayview.is-night .dv-hero-*` felülírások **átcímezve `.td-hero-*`-ra**, `.dv-nightrow`, `.dv-nightrow-arr`, `.dv-groups`.

Az `is-night` felülírásokat írd át:

```css
.dayview.is-night .td-hero-v { color: #F5EFE6; }
.dayview.is-night .td-hero-u, .dayview.is-night .td-hero-s { color: #9c92b8; }
```

- [ ] **Step 5: Írd meg a hatósugár-őrt**

Create `frontend/src/features/today/todayScope.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * A mezo-e26w hatósugarának STRUKTURÁLIS őre (a `todayReducedMotion.test.ts`
 * cascade-guardjának nyelvén). A Today saját iOS listanyelvet kapott, DE a
 * `shared/ui/ItemRow`-t a Fuel „Mai" ablak-folyója és a rutin-szerkesztő is
 * rendereli — ebben a változásban egyiket sem mozdítjuk. Ha a Today lapnyelvének
 * bármelyik komponense visszanyúl az `ItemRow`-hoz, a két nyelv összecsúszik, és
 * a Fuel vizuális goldenjei kezdenek indokolatlanul mozogni.
 *
 * A Today SHEETJEI és az AnchorIsland KIVÉTELEK: azok nem a lap nyelvét beszélik.
 */
const DIR = join(process.cwd(), 'src/features/today/components')
const EXEMPT = new Set(['AnchorIsland.tsx'])

describe('a Today lapnyelve nem nyúl vissza a shared ItemRow-hoz', () => {
  test('egyetlen Today-komponens sem importálja az ItemRow-t', () => {
    const offenders = readdirSync(DIR)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !EXEMPT.has(f))
      .filter((f) => readFileSync(join(DIR, f), 'utf8').includes("shared/ui/ItemRow"))
    expect(offenders).toEqual([])
  })

  test('a nyugdíjazott felületek tényleg eltűntek', () => {
    const files = readdirSync(DIR)
    expect(files).not.toContain('MezoMessage.tsx')
    expect(files).not.toContain('IslandFactsStrip.tsx')
    expect(files).not.toContain('CompanionNoteCard.tsx')
  })
})
```

- [ ] **Step 6: Futtasd az egész Today-csomagot**

Run: `cd frontend && pnpm test -- src/features/today src/shared/lib/seenMessages.test.ts`
Expected: PASS mind

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src/features/today frontend/src/styles/prototype.css
git commit -m "refactor(today): a sáv, a strip és a jegyzetkártya nyugdíjazása + hatósugár-őr (mezo-e26w)"
```

---

### Task 15: Teljes kapu — build + mindkét mód

**Files:** nincs új; ez a taszk a bizonyíték.

- [ ] **Step 1: Típusellenőrzés + build**

Run: `cd frontend && pnpm build`
Expected: sikeres. Ha `TS6133` (használatlan import) jön a `todayItems.ts`-ből vagy a napszak-nézetekből, töröld a tényleg használatlan importot — de **ne** töröld a `HabitDaypart`-ot, ha a `DAYPART_FACE`/`DAYPART_TONE` még használja.

- [ ] **Step 2: Teljes teszt, REAL módban**

Run: `cd frontend && pnpm test`
Expected: PASS minden

- [ ] **Step 3: Teljes teszt, MOCK módban**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test`
Expected: PASS minden

> Mindkét módnak zöldnek kell lennie. Ha csak az egyik bukik, a `useDualQuery`/mock-seed határon van a hiba — **ne** a tesztet igazítsd.

- [ ] **Step 4: Futásidejű ellenőrzés mock módban**

Run: `cd frontend && VITE_USE_MOCK=true pnpm dev` (háttérben), majd nyisd meg 375×812-n:
- `http://localhost:5180/today?dp=reggel` — a chip 1 üzenetet mutat olvasatlan pöttyel; a reggeli rutin öt sora **öt KÜLÖNBÖZŐ ikont** visel; minden szekció egy dobozban ül; a bal élek egy vonalban.
- Koppints a chipre — a sheet felnyílik, benne a teljes briefing a hivatkozás-chipekkel; `Kész`-re bezár, és a pötty eltűnik.
- `?dp=nap` és `?dp=este` — a chip **nem** a reggeli briefinget mutatja többé a lapon, a napszakok tartalma azonnal látszik.

- [ ] **Step 5: Commit (ha bármit javítanod kellett)**

```bash
git add -A frontend/src
git commit -m "fix(today): a teljes kapu zöldre igazítása (mezo-e26w)"
```

---

### Task 16: Dokumentáció + ADR

**Files:**
- Modify: `docs/features/today.md`
- Modify: `docs/features/_platform-design-system.md`
- Create: `docs/decisions/0023-today-ios-list-language.md`
- Modify: `docs/decisions/0022-today-three-islands.md` (státusz → Superseded)

- [ ] **Step 1: Olvasd el a doksi-konvenciót**

Run: `cat docs/README.md` — a 10 szekciós feature-doc sablon és az ADR-sablon onnan jön. A `knowledge-base` skill az üzemeltetési kézikönyv; ha bizonytalan vagy, hívd meg.

- [ ] **Step 2: `docs/features/today.md` frissítése**

A living doc, **helyben felülírva** (nincs changelog, nincs dátumozott pillanatkép — a git a történet). Az érintett szekciók:
- **§2/§3 (anatómia/UI):** a full-bleed `MezoMessage` sáv helyére `MezoChip` + `MezoMessagesSheet`; a lap egyetlen doboznyelve (inset grouped list, 16px sín); `TodayRow`/`TodayList`/`TodayStats`.
- **§4 (logika):** az új pure modulok — `itemIcon`, `rowAccessory`, `mezoMessages`; a `seenMessages` a `shared/lib`-ben.
- **§5 (integrációk):** a `shared/ui/ItemRow` **nem** Today-fogyasztó többé (a sheetek és az `AnchorIsland` kivételével); a Fuel/Me érintetlen.
- **file map:** a három törölt komponens ki, a hét új be.
- A `key_files` frontmattert igazítsd, és az `updated:` dátumot állítsd `2026-08-11`-re.

- [ ] **Step 3: `docs/features/_platform-design-system.md` frissítése**

Vedd fel a `.td-*` családot mint a **Today saját listanyelvét**, és rögzítsd, hogy ez **nem** promotálódott a `shared/ui`-ba: a `shared/ui/ItemRow` a Fuel és a Me nyelve marad, az egyesítés külön munka. Az `updated:` dátumot állítsd `2026-08-11`-re.

- [ ] **Step 4: ADR 0023**

Create `docs/decisions/0023-today-ios-list-language.md` a `docs/README.md` ADR-sablonja szerint. Tartalma: **Context** — a három-sziget (ADR 0022) és a napszak-tabok után a lap öt párhuzamos doboznyelvet beszélt, a briefing sáv mind a három napszakon ugyanaz volt; **Decision** — egyetlen iOS inset-grouped-list nyelv 16px-es sínen, a companion hangja chip + sheet, Today-lokális `TodayRow` a `shared/ui/ItemRow` **érintése nélkül**; **Consequences** — két sornyelv él átmenetileg egymás mellett (Today vs Fuel/Me), amit egy strukturális teszt őriz és külön bd-issue old fel.

A `0022-today-three-islands.md` fejlécében a státuszt írd át `Superseded by ADR 0023`-ra. **A tartalmát ne írd át** — az ADR-ek immutábilisak.

- [ ] **Step 5: Doc-lint**

Run: `node scripts/lint-docs.mjs`
Expected: a `today.md` és a `_platform-design-system.md` **nem** szerepel a stale listán. (A `companion.md`, `fuel.md`, `me.md`, `proactive.md`, `_platform-auth-security.md` stale-jei **előzetesek** — nem ez a változás okozta őket, ne javítsd itt.)

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs(today): iOS listanyelv — feature-doc, DS-doc és ADR 0023 (mezo-e26w)"
```

---

### Task 17: Vizuális goldenek + a bd lezárása

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts-snapshots/today-*-darwin.png` (6 fájl)

- [ ] **Step 1: Generáld újra a darwin baseline-okat**

Run: `cd frontend && pnpm exec playwright test tests/visual/visual.spec.ts --update-snapshots -g "today"`
Expected: a hat `today-{reggel,nap,este}-{light,dark}-darwin.png` frissül.

> Ha a parancs nem fut (hiányzó böngésző), előbb: `pnpm exec playwright install chromium`.

- [ ] **Step 2: Nézd meg a képeket**

Nyisd meg mind a hatot, és ellenőrizd, hogy tényleg az új lapot mutatják (chip a sáv helyén, egydobozos szekciók, különböző sor-ikonok). **Ha bármelyik a régi lapot mutatja, a generálás nem futott le — ne commitold.**

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/visual/
git commit -m "test(visual): darwin goldenek az iOS listanyelvhez (mezo-e26w)"
```

- [ ] **Step 4: A linux baseline-ok**

A linux baseline-ok **nem** generálhatók lokálisan — a `update-visual-baselines.yml` workflow felelős értük. Ezt a PR megnyitása UTÁN kell futtatni; jegyezd meg, hogy a CI vizuális lépése addig pirosat adhat.

- [ ] **Step 5: bd lezárása**

```bash
bd close mezo-e26w
bd create "Today iOS listanyelv átvitele a Fuel Mai-ra és a rutin-szerkesztőre" -t task -p 2 \
  -d "A mezo-e26w a Today-ra korlátozta az inset-grouped-list nyelvet; a shared/ui/ItemRow érintetlen maradt, így a Fuel WindowIsland és a Me RoutineEditorPage a régi sorlanyelvet beszéli. Ha a Today-n bevált, a TodayRow/TodayList promotálódjon shared/ui-ba, és mindkét képernyő álljon át. Őr: frontend/src/features/today/todayScope.test.ts"
bd create "Habit-ikon mező az adatmodellben + ikonválasztó a rutin-szerkesztőben" -t feature -p 3 \
  -d "A mezo-e26w frontend-oldali létrát adott (habitKey→skillKey→napszak, frontend/src/features/today/logic/itemIcon.ts). A teljes kontrollhoz icon mező kell a habit-defen (Liquibase + API + backend) és egy ikonválasztó a Me › Rutin szerkesztőben."
```

---

## Self-Review

**1. Spec coverage** — a spec minden szekciója taszkhoz kötve:

| Spec | Taszk |
|---|---|
| §2 anatómia | 12, 13 |
| §3.1 chip + olvasatlan | 5, 8, 13 |
| §3.2 sheet + `buildMezoMessages` | 4, 9 |
| §4 lapnyelv (sín, hajszálvonal, tokenek) | 1 |
| §5.1 kísérő-alakok | 3, 6 |
| §5.2 az `ItemRow`-tól átvett 4 szabály | 6 (mind a négyre saját teszt) |
| §5.3 ikon-létra | 2 |
| §6 napszakok + wind-down fázisok | 12 |
| §7 hatósugár (`ItemRow` érintetlen) | 14 (strukturális őr) |
| §8 komponens-terv + nyugdíjazás | 6–14 |
| §9 mozgás-nyelv (`.dayview` guard) | 1 (a guard-teszt változatlansága a bizonyíték) |
| §10 a11y | 6, 8, 9 (aria-label, aria-haspopup, karika-név) |
| §11 tesztelés | minden taszk + 15 |
| §12 scope-on kívül | Global Constraints + 17/5. lépés (követő bd-k) |

**2. Placeholder scan** — nincs „TBD"/„TODO"/„hasonlóan a N. taszkhoz"; minden kódlépés valódi kódot tartalmaz. Két helyen szándékosan utasítom az implementálót, hogy **olvassa el a valódi típust, ne találjon ki** (`HabitMode` a 3. taszkban, `Skeleton` propjai a 13. taszkban) — ez nem placeholder, hanem a találgatás tiltása.

**3. Type consistency** — `habitIcon(habitKey, chain)`, `rowAccessory(item)`, `buildMezoMessages({briefing, note, briefingDemo})`, `lastSeenMessage(date)` / `markMessagesSeen(date, lastId)`, `TodayRow` `accessory: RowAccessory | 'chevron'`, `TodayList` `{label, count, action, children}`, `MezoChip` `{messages, unread, onOpen}`, `MezoMessagesSheet` `{messages, onClose}` — mindegyik ugyanazzal a névvel és aláírással szerepel a definíciójánál és minden hívásánál.

**Egy eltérés a spectől, tudatosan:** a spec §9 azt írta, a reduced-motion guardot „át kell címezni a `.td-*` családra". A terv ehelyett **megtartja a `.dayview` osztályt** a `DaypartPanel` gyökerén (ő hordozza a tabváltás fade-jét és az `is-night` állapotot), így a `todayReducedMotion.test.ts` **egyetlen sorral sem változik** — ez szigorúbb bizonyíték, mint az átcímzés, mert a guard érintetlenül marad zöld.
