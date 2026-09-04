# Életcél-beágyazás (Nap · Heti · Én · Growth) — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A már élő lifegoal-motort (mezo-iizd.5–.7) láthatóvá tenni a saját három oldalán kívül is: Nap-csempe, heti cél-kártya + heti AI-prompt cél-blokk, konfliktus-mondat, lezárt célok, Én-hub életcél-hero, Growth goalchip.

**Architecture:** Hét szelet, hat közülük tisztán frontend a MÁR MEGLÉVŐ `GET /api/life-goals` + `/today` + `/{id}/progress` végpontokra (nincs kontraktus-változás, nincs generálás). A hetedik backend: a heti visszatekintés prompt-payloadja megkap egy `ÉLETCÉLOK · A HÉT IRÁNYA` fact-blokkot. Ez `feature/proactive`-ban él (`WeeklyReviewContextSources`), ami már ma is közvetlenül olvas más feature-repókat — és mivel `lifegoal` **nem** importál `proactive`-ot, ez ciklusmentes. A companion `[Célok]` blokkjához kellő `LifeGoalSource` port NEM ennek a körnek a dolga (mezo-iizd.10).

**Tech Stack:** React 18 + TypeScript + TanStack Query (`useDualQuery` mock/real), Vitest + RTL, Playwright vizuális goldenek, Spring Boot 3 + Lombok, JUnit 5 + Testcontainers.

## Global Constraints

- **bd id-k a commit-subjectben:** a driving id `mezo-iizd.9`. A `.4` munkája (5–6. task) saját commitban `(mezo-iizd.4)`, a `.12` (7. task) `(mezo-iizd.12)`.
- **Worktree:** minden parancs abszolút úttal, a `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081` alól. SOHA ne `cd`-zz az elsődleges repóba. A Bash cwd ragad a hívások között.
- **FE teszt MINDIG kétszer, KÜLÖN parancsban, explicit móddal, `--`-ral:**
  `VITE_USE_MOCK=true pnpm test -- --run <fájl>` és `VITE_USE_MOCK=false pnpm test -- --run <fájl>`.
  Az unset `VITE_USE_MOCK` csendben mock → a bare futás vákuum real-mode kapu.
- **Maven wrapper a `backend/` alatt van, nem a repo gyökerében:**
  `cd <worktree>/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='...'`.
  `clean` és testcontainers nélkül a fixed-DB mód versenyez és HAMIS hibát ad.
- **Design 2.0 kötelező:** clay SVG ikon (`<ClayIcon>`), SOHA emoji; a meglévő `mozaik` / `lg-*` / `enh-*` / `wkh-*` / `gr-*` nyelvet használd, ne találj ki lapos listát.
- **CSS-guard:** minden ÚJ `lg-*` szabály a `frontend/src/styles/prototype.css`-ben a `/* ============ Today · maradék sheet-nyelv` blokk **ELÉ** megy (a Jelek-oldal `.lg-sighint` sora után).
- **Őszinte állapotok (házszabály):** a betöltés / üres / hiba HÁROM külön állapot. Kitalált szám tilos; `insufficient` nyíl SOHA nem irány (`—` glyph, `none` osztály). Adat nélküli cella `—`, sosem `0`.
- **`useSignalCatalog()` a sorait `entries` néven adja** (nem `data`).
- **Router/MSW szabály:** statikus route a `me/goals/:id` ELŐTT; MSW-ben szintén a statikus path a `:id` handler előtt. (Ez a kör nem vesz fel új route-ot — csak ne rontsd el a meglévő sorrendet.)
- **Nincs mock az integrációs tesztekben.** Ha egy ág mock nélkül nem provokálható, javadocba írd és bd-be tedd.
- **Meglévő tények, amikre építünk (ellenőrizve, ne találd ki újra):**
  - `useLifeGoalToday()` → `{ today: { goals: LifeGoalTodaySummary[] }, isPending, isError }`.
    `LifeGoalTodaySummary` = `{ goalId, title, dimension, arrow, days7, pillarsTotal?, pillarsHitToday? }`.
  - `useLifeGoals()` → `{ goals, isPending, isError, refetch }`; `LifeGoalResponse.status ∈ draft|active|parked|done|archived`.
  - `useLifeGoalProgress(id)` → `{ progress, isPending, isError }`; `LifeGoalProgressResponse.conflicts: string[]` (kötelező mező, magyar egymondatos sorok).
  - `LifeGoalPillarResponse.skillKey: string` — minden pillér hordozza.
  - `DIMENSIONS` / `DIMENSION_ORDER` / `ARROW_GLYPH` / `ARROW_CLASS` / `DOT_CLASS` / `STATUS_LABEL` a `@/features/me/logic/lifegoalLabels`-ből.
  - `LifeGoalProgressService.today(UUID userId)` → `LifeGoalTodayResponse` (backend).
  - `WeeklyReviewContextSources.render(userId, weekStart, weekEnd, since, until)` a heti prompt gather-blokkja.

## File Structure

**Új fájlok (FE)**
| Fájl | Felelősség |
|---|---|
| `frontend/src/features/today/components/LifeGoalTodayTile.tsx` | A Nap-mozaik „Célok · ma" csempéje. Egyetlen adatot mond: ma hány pillér teljesült az összesből + 7 pötty. Csak aktív cél mellett rendereli magát. |
| `frontend/src/features/today/components/LifeGoalTodayTile.test.tsx` | A csempe RTL-tesztje (van adat / nincs aktív cél / betöltés). |
| `frontend/src/features/me/components/WeekGoalsCard.tsx` | A Heti hub cél-szekciója: célonként nyíl + dimenzió-chip + egy determinisztikus mondat, alul CTA a `/me/goals`-ra. |
| `frontend/src/features/me/components/WeekGoalsCard.test.tsx` | A kártya RTL-tesztje. |
| `frontend/src/features/me/logic/goalWeekSentence.ts` | A kártya mondatát adó tiszta függvény (`goalWeekSentence(summary)`), hogy a copy egy helyen és tesztelhetően éljen. |
| `frontend/src/features/me/logic/goalWeekSentence.test.ts` | A mondat-függvény egységtesztje. |
| `frontend/src/features/me/logic/goalSkillChips.ts` | `skillKey → aktív cél címe` leképezés a Growth goalchiphez (tiszta függvény). |
| `frontend/src/features/me/logic/goalSkillChips.test.ts` | Egységteszt. |

**Módosított fájlok (FE)**
| Fájl | Mit |
|---|---|
| `frontend/src/features/today/pages/NapHubPage.tsx` | A `nap` panel mozaikjába beköti a `LifeGoalTodayTile`-t. |
| `frontend/src/features/me/pages/CelPage.tsx` | A `progress.conflicts` sorok megjelenítése a pillérek alatt. |
| `frontend/src/features/me/pages/WeekHubPage.tsx` | `WeekGoalsCard` beillesztése a „négy nézet" tömb után. |
| `frontend/src/features/me/pages/CelokPage.tsx` | Lezárt (`done`) célok szekció + Súlycél-sor; a hero elavult „a 2. szelettel jön" copyjának javítása. |
| `frontend/src/features/me/pages/EnHubPage.tsx` | A hero-kártya életcél-összegzésre vált (`/me/goals`); a súlycél-adat innen kikerül. |
| `frontend/src/features/me/components/SkillBandCard.tsx` | Soronkénti opcionális `goalChip` slot. |
| `frontend/src/features/me/pages/GrowthSkillsPage.tsx` | A LIFE-sávnak átadja a goalchipeket. |
| `frontend/src/data/lifegoal/lifegoalMock.ts` | Egy `done` státuszú mock cél, hogy a lezárt szekció a goldenben is látszódjon. |
| `frontend/src/styles/prototype.css` | `.lg-gtile`, `.lg-wgrow`, `.lg-goalchip`, `.lg-linkrow`, `.lg-donerow`, `.enh-lgcard` szabályok. |
| `frontend/tests/visual/visual.spec.ts` | Új `me-growth-skillek` képernyő. |

**Módosított fájlok (BE)**
| Fájl | Mit |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewContextSources.java` | Új `ÉLETCÉLOK · A HÉT IRÁNYA` fact-blokk `LifeGoalProgressService.today`-ből. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGenerator.java` | A `PROMPT` egy mondattal: a nyilakat MAGYARÁZD, ne számold. |
| `backend/src/test/java/.../WeeklyReviewContextSourcesIT.java` (vagy a meglévő IT) | Új IT: aktív célos user payloadjában ott a blokk; cél nélkül nincs scaffolding. |

**Kifejezetten NEM ebben a körben**
- `mezo-hhdo` (P2): az `lg-*` család sötét módban olvashatatlan. Ne javítsd — minden érintett goldent újragenerálna.
- A companion `[Célok]` blokk / `get_life_goals` chat-tool / `LifeGoalSource` port → `mezo-iizd.10`.
- A Nap-csempe a `reggel` és `este` panelre — a prototípus (`celok-body.html` #page-nap) CSAK a nap-panelen mutatja. Ne találd ki a másik kettőt.

---

### Task 1: Nap-csempe — `LifeGoalTodayTile` (mezo-iizd.9)

**Files:**
- Create: `frontend/src/features/today/components/LifeGoalTodayTile.tsx`
- Create: `frontend/src/features/today/components/LifeGoalTodayTile.test.tsx`
- Modify: `frontend/src/features/today/pages/NapHubPage.tsx` (a `face === 'nap'` `<Mosaic>` blokk)
- Modify: `frontend/src/styles/prototype.css` (új `.lg-gtile` szabályok, a Today-szekció ELÉ)

**Interfaces:**
- Consumes: `useLifeGoalToday()` a `@/data/hooks`-ból; `DIMENSIONS`, `DOT_CLASS` a `@/features/me/logic/lifegoalLabels`-ből.
- Produces: `export function LifeGoalTodayTile({ delayMs }: { delayMs: number }): JSX.Element | null` — `null`, ha nincs megjeleníthető aktív cél VAGY a lekérés még nem oldódott fel.

**Vizuális igazság:** `docs/design_2.0/prototypes/src/celok-body.html` #page-nap, a `tile gtile` csempe (~518. sor): eyebrow = dimenzió-pötty + „Célok · ma", alatta clay `i-cel` ikon + `5 / 9` nagy szám, alul a 7 pötty `pillér` felirattal. A csempe a legtöbb aktív célt hordozó dimenzió mosását viszi.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/LifeGoalTodayTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { LifeGoalTodayTile } from '@/features/today/components/LifeGoalTodayTile'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderTile() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/nap']}>
    <Routes>
      <Route path="/nap" element={<LifeGoalTodayTile delayMs={120} />} />
      <Route path="/me/goals" element={<div>CELOK HUB</div>} />
    </Routes>
  </MemoryRouter></QueryWrapper>)
}

test('a csempe a mai pillér-találatot mondja az összesből, hét pöttyel', async () => {
  renderTile()
  const tile = await screen.findByRole('button', { name: /Célok · ma/ })
  expect(tile).toBeInTheDocument()
  // a mock három aktív célt ad; a nagy szám "n / m" alakú, m > 0
  expect(tile.textContent).toMatch(/\d+\s*\/\s*\d+/)
  expect(tile.querySelectorAll('.lg-wk7 i')).toHaveLength(7)
})

test('nincs aktív cél → a csempe eltűnik, nem rajzol 0 / 0-t', async () => {
  server.use(http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json({ goals: [] })))
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderTile()
  await new Promise((r) => setTimeout(r, 0))
  expect(container.querySelector('.lg-gtile')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/today/components/LifeGoalTodayTile.test.tsx
```
Expected: FAIL — `Failed to resolve import "@/features/today/components/LifeGoalTodayTile"`.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/LifeGoalTodayTile.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { useLifeGoalToday } from '@/data/hooks'
import { DIMENSIONS, DOT_CLASS } from '@/features/me/logic/lifegoalLabels'
import type { LifeGoalDimension } from '@/data/lifegoal/lifegoalApi'

// Nap-mozaik „Célok · ma" csempe (mezo-iizd.9, prototípus celok-body.html #page-nap `.gtile`).
// EGY adatot mond: ma hány pillér teljesült az összesből, plusz a goal-napok hét pöttye.
//
// Miért rendereli null-ként magát három esetben:
//  · nincs aktív cél — a csempe nem foglalhat helyet egy üres funkció nevében (bd mezo-iizd.9:
//    „CSAK aktív cél mellett");
//  · a lekérés még fut vagy elhasalt — a `useLifeGoalToday` `realEmpty`-je feloldatlan ablakban
//    UGYANAZT az üres listát adja, mint a „nincs célod", tehát a feltétel nélküli számolás egy
//    kitalált „0 / 0"-t nyomtatna (a CelokPage `todayHonest` idiómája);
//  · egyetlen cél sem közöl pillér-számot — nincs mit mondani.
export function LifeGoalTodayTile({ delayMs }: { delayMs: number }) {
  const navigate = useNavigate()
  const { today, isPending, isError } = useLifeGoalToday()
  if (isPending || isError || today.goals.length === 0) return null

  const hit = today.goals.reduce((s, g) => s + (g.pillarsHitToday ?? 0), 0)
  const total = today.goals.reduce((s, g) => s + (g.pillarsTotal ?? 0), 0)
  if (total === 0) return null

  // A csempe mosása a legtöbb aktív célt hordozó dimenzióé — egy csempe egy színt visel.
  const byDim = today.goals.reduce((acc, g) => {
    acc[g.dimension] = (acc[g.dimension] ?? 0) + 1
    return acc
  }, {} as Partial<Record<LifeGoalDimension, number>>)
  const lead = today.goals.reduce((best, g) => ((byDim[g.dimension] ?? 0) > (byDim[best] ?? 0) ? g.dimension : best), today.goals[0].dimension)
  const dim = DIMENSIONS[lead]

  // A pöttysor a LEGTÖBB pillért vivő cél goal-napjai — a hét napja per cél, nem összegzés
  // (a státuszok nem összeadhatók: két cél „hit"-je nem egy nagyobb „hit").
  const leadGoal = today.goals.reduce((best, g) => ((g.pillarsTotal ?? 0) > (best.pillarsTotal ?? 0) ? g : best), today.goals[0])
  const days7 = leadGoal.days7.slice(-7)

  return (
    <button type="button" className={`mz-tile lg-gtile rise ${dim.cls}`}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
      onClick={() => navigate('/me/goals')} aria-label={`Célok · ma — ${hit} / ${total} pillér`}>
      <span className="mz-eyebrow"><i aria-hidden="true" />Célok · ma</span>
      <div className="lg-gtile-row">
        <ClayIcon name="i-cel" size={30} />
        <span className="lg-arrow up">
          <span className="v">{hit}<small> / {total}</small></span>
        </span>
      </div>
      <div className="lg-wk7" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
        {days7.map((status, i) => <i key={i} className={status ? DOT_CLASS[status] : 'n'} style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">pillér</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 4: Add the CSS**

A `frontend/src/styles/prototype.css`-ben, a `.lg-sighint { ... }` sor UTÁN és a `/* ============================================================\n   Today · maradék sheet-nyelv` blokk ELŐTT:

```css
/* Nap-mozaik „Célok · ma" csempe (mezo-iizd.9, prototípus celok-body.html #page-nap .gtile).
   A dimenzió-mosást a `.lg-d-*` osztály adja (ugyanaz a --dw/--dw2/--ds hármas, amit a
   `.lg-tile` is olvas), így a csempe a Célok hub tile-jaival egy nyelvet beszél. */
.lg-gtile { background: linear-gradient(150deg, var(--dw), var(--dw2)) !important;
  box-shadow: 0 14px 26px -14px var(--ds), 0 2px 5px rgba(43,33,24,0.04), inset 0 1px 0 rgba(255,255,255,0.7) !important; }
.lg-gtile .mz-eyebrow { color: var(--dc); display: inline-flex; align-items: center; gap: 5px; }
.lg-gtile .mz-eyebrow i { width: 6px; height: 6px; border-radius: 50%; background: var(--dc); flex: none; }
.lg-gtile-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.lg-gtile .lg-arrow .v { font-size: 22px; font-weight: 200; letter-spacing: -0.02em; }
.lg-gtile .lg-arrow .v small { font-size: 11px; font-weight: 500; color: #6E6257; }
```

- [ ] **Step 5: Run the test to verify it passes (both modes)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/today/components/LifeGoalTodayTile.test.tsx
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run src/features/today/components/LifeGoalTodayTile.test.tsx
```
Expected: PASS mindkettőben.

- [ ] **Step 6: Wire it into the Nap hub**

`frontend/src/features/today/pages/NapHubPage.tsx` — import a fájl tetején:

```tsx
import { LifeGoalTodayTile } from '@/features/today/components/LifeGoalTodayTile'
```

A `face === 'nap'` panel `<Mosaic>`-ában, a `nowWindow` csempe UTÁN és az Edzés-csempe ELŐTT:

```tsx
<LifeGoalTodayTile delayMs={90} />
```

- [ ] **Step 7: Extend the Nap hub test**

`frontend/src/features/today/pages/NapHubPage.test.tsx` — új teszt a fájl végére (a meglévő render-helper nevét vedd át a fájlból; ha `renderHub(...)`-nak hívják, azt használd):

```tsx
test('a nap-panel mozaikja viszi a Célok · ma csempét (mezo-iizd.9)', async () => {
  renderHub('/today?dp=nap')
  expect(await screen.findByRole('button', { name: /Célok · ma/ })).toBeInTheDocument()
})
```

- [ ] **Step 8: Run the Nap hub tests (both modes)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/today/pages/NapHubPage.test.tsx src/features/today/components/LifeGoalTodayTile.test.tsx
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run src/features/today/pages/NapHubPage.test.tsx src/features/today/components/LifeGoalTodayTile.test.tsx
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/src/features/today/components/LifeGoalTodayTile.tsx frontend/src/features/today/components/LifeGoalTodayTile.test.tsx frontend/src/features/today/pages/NapHubPage.tsx frontend/src/features/today/pages/NapHubPage.test.tsx frontend/src/styles/prototype.css && git commit -m "feat(fe): Nap-mozaik Célok · ma csempe az élő today-végpontból (mezo-iizd.9)"
```

---

### Task 2: Konfliktus-mondat a cél-oldalon (mezo-iizd.9)

A backend `LifeGoalProgressService.findConflicts` MA is számolja, és a `LifeGoalProgressResponse.conflicts` kötelező mezőben küldi — a `CelPage` viszont nem rajzolja, tehát a mező holtan érkezik a FE-re.

**Files:**
- Modify: `frontend/src/features/me/pages/CelPage.tsx`
- Modify: `frontend/src/features/me/pages/CelPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useLifeGoalProgress(id)` → `progress.conflicts: string[]` (a Task-tól függetlenül már létező szerződés).
- Produces: semmi új export.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/me/pages/CelPage.test.tsx` — új teszt a fájl végére (a meglévő render-helpert használd; ha `renderGoal('lg-kockahas')`, azt):

```tsx
test('a konfliktus-mondat megjelenik, ha a progress hoz ilyet (mezo-iizd.9)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/life-goals/:id/progress`, () => HttpResponse.json({
    goalId: 'lg-kockahas', from: '2026-08-08', to: '2026-09-04', arrow: 'flat',
    days: [], pillars: [],
    conflicts: ['A Kockahas és a Side hustle ugyanazt az estét kéri — a napzárás mindkettőben pillér.'],
  })))
  renderGoal('lg-kockahas')
  expect(await screen.findByText(/ugyanazt az estét kéri/)).toBeInTheDocument()
})

test('konfliktus nélkül nincs szekció-maradvány', async () => {
  renderGoal('lg-kockahas')
  await screen.findByText(/Pillérek/)
  expect(document.querySelector('.lg-conflict')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/pages/CelPage.test.tsx
```
Expected: FAIL — „Unable to find an element with the text: /ugyanazt az estét kéri/".

- [ ] **Step 3: Render the conflicts**

`frontend/src/features/me/pages/CelPage.tsx` — a `heroArrow` blokk mellé, a `pillarProgressById` után:

```tsx
  // A backend MÁR számolja (LifeGoalProgressService.findConflicts) és a `conflicts` mezőben
  // küldi — mezo-iizd.9-ig a FE eldobta. Betöltés alatt üres: a feloldatlan lekérés
  // `conflicts: []`-e ugyanaz, mint a „nincs konfliktus", és egy villanó szekció rosszabb,
  // mint egy késve érkező (a `heroArrow` progressPending-guardjának ugyanaz a logikája).
  const conflicts = progressPending ? [] : (progress?.conflicts ?? [])
```

A pillér-lista UTÁN, a „Miért · ha–akkor" blokk ELŐTT:

```tsx
          {conflicts.length > 0 && (
            <>
              <div className="mz-eyebrow rise" style={{ '--d': '240ms', padding: '8px 2px 6px' } as React.CSSProperties}>Cél-ütközés</div>
              {conflicts.map((line, i) => (
                <p key={i} className="lg-conflict rise" style={{ '--d': `${250 + i * 30}ms` } as React.CSSProperties}>
                  <ClayIcon name="i-retegek" size={18} />
                  <span>{line}</span>
                </p>
              ))}
            </>
          )}
```

Az import-blokk tetejére (ha még nincs ott): `import { ClayIcon } from '@/shared/ui/clay'`.

- [ ] **Step 4: Add the CSS**

A `prototype.css`-ben, közvetlenül a Task 1 `.lg-gtile` szabályai után:

```css
/* Cél-ütközés mondat (mezo-iizd.9): a backend findConflicts sorai. Figyelmeztetés, nem tiltás
   (spec D7: a konfliktus companion-mondat, nem kemény korlát) — ezért borostyán, nem piros. */
.lg-conflict { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 8px; padding: 10px 12px;
  border-radius: 16px; font-size: 11.5px; line-height: 1.45; color: #6E6257;
  background: linear-gradient(140deg, var(--lg-frame-warn), var(--lg-frame-warn2));
  box-shadow: 0 12px 22px -14px rgba(181,126,20,0.45); }
.lg-conflict svg { flex: none; margin-top: 1px; }
```

- [ ] **Step 5: Run the tests (both modes)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/pages/CelPage.test.tsx
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run src/features/me/pages/CelPage.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/src/features/me/pages/CelPage.tsx frontend/src/features/me/pages/CelPage.test.tsx frontend/src/styles/prototype.css && git commit -m "feat(fe): cél-ütközés mondat a cél-oldalon — a conflicts mező már nem hal el a FE-n (mezo-iizd.9)"
```

---

### Task 3: `WeekGoalsCard` a Heti hubon (mezo-iizd.9)

**Files:**
- Create: `frontend/src/features/me/logic/goalWeekSentence.ts`
- Create: `frontend/src/features/me/logic/goalWeekSentence.test.ts`
- Create: `frontend/src/features/me/components/WeekGoalsCard.tsx`
- Create: `frontend/src/features/me/components/WeekGoalsCard.test.tsx`
- Modify: `frontend/src/features/me/pages/WeekHubPage.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useLifeGoalToday()`; `DIMENSIONS`, `ARROW_CLASS`, `ARROW_GLYPH`.
- Produces:
  - `export function goalWeekSentence(s: LifeGoalTodaySummary): string`
  - `export function WeekGoalsCard(): JSX.Element | null`

**Miért determinisztikus a mondat:** a prototípus per-cél mondata AI-narratíva. A heti visszatekintés promptja a Task 4-ben kapja meg a nyilakat, és a narratíva a MÁR MEGLÉVŐ „Mezo · heti elemzés" csempén jelenik meg — ez a kártya nem másodpéldánya annak. Amit itt írunk, az a motor számolt tényeiből származik, tehát sosem hazudik.

- [ ] **Step 1: Write the failing unit test**

`frontend/src/features/me/logic/goalWeekSentence.test.ts`:

```ts
import { expect, test } from 'vitest'
import { goalWeekSentence } from '@/features/me/logic/goalWeekSentence'
import type { LifeGoalTodaySummary } from '@/data/lifegoal/lifegoalApi'

const base: LifeGoalTodaySummary = {
  goalId: 'g1', title: 'Kockahas', dimension: 'health', arrow: 'up',
  days7: ['hit', 'hit', 'partial', 'hit', 'miss', 'hit', 'no_data'],
  pillarsTotal: 3, pillarsHitToday: 2,
}

test('teli hét: találat-nap szám + mai pillér-arány', () => {
  expect(goalWeekSentence(base)).toBe('4 találat-nap a 7-ből · ma 2 / 3 pillér.')
})

test('insufficient nyíl: nem irány, hanem adat-hiány', () => {
  expect(goalWeekSentence({ ...base, arrow: 'insufficient' }))
    .toBe('Még kevés az adat az irányhoz — 4 találat-nap a 7-ből.')
})

test('nincs pillér-szám: a mai arány kimarad, nem lesz 0 / 0', () => {
  expect(goalWeekSentence({ ...base, pillarsTotal: undefined, pillarsHitToday: undefined }))
    .toBe('4 találat-nap a 7-ből.')
})

test('csupa no_data: nulla találat-napot sem állít', () => {
  expect(goalWeekSentence({ ...base, arrow: 'insufficient', days7: ['no_data', 'no_data'], pillarsTotal: undefined, pillarsHitToday: undefined }))
    .toBe('Ezen a héten még nincs adata.')
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/logic/goalWeekSentence.test.ts
```
Expected: FAIL — modul nem található.

- [ ] **Step 3: Write the function**

`frontend/src/features/me/logic/goalWeekSentence.ts`:

```ts
import type { LifeGoalTodaySummary } from '@/data/lifegoal/lifegoalApi'

/**
 * A Heti hub cél-sorának egy mondata (mezo-iizd.9) — KIZÁRÓLAG a motor számolt tényeiből.
 *
 * A prototípus (celok-body.html #page-heti) per-cél magyarázó mondata AI-narratíva; azt a heti
 * visszatekintés adja (a promptja a nyilakat a Task 4 óta megkapja), és a „Mezo · heti elemzés"
 * csempén jelenik meg. Ez a sor NEM annak a másolata: számolt tény, ezért sosem hazudik.
 *
 * Őszinteség: `no_data` nap SOSEM számít találatnak és sosem számít kihagyásnak; ha egyetlen
 * adat-nap sincs, a mondat ezt mondja ki ahelyett, hogy „0 találat-napot" állítana.
 */
export function goalWeekSentence(s: LifeGoalTodaySummary): string {
  const week = s.days7.slice(-7)
  const dataDays = week.filter((d) => d !== 'no_data').length
  const hits = week.filter((d) => d === 'hit').length
  if (dataDays === 0) return 'Ezen a héten még nincs adata.'

  const span = `${hits} találat-nap a ${week.length}-ből`
  const today = s.pillarsTotal != null && s.pillarsTotal > 0 && s.pillarsHitToday != null
    ? ` · ma ${s.pillarsHitToday} / ${s.pillarsTotal} pillér`
    : ''
  if (s.arrow === 'insufficient') return `Még kevés az adat az irányhoz — ${span}.`
  return `${span}${today}.`
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/logic/goalWeekSentence.test.ts
```
Expected: PASS (4 teszt).

- [ ] **Step 5: Write the failing card test**

`frontend/src/features/me/components/WeekGoalsCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { WeekGoalsCard } from '@/features/me/components/WeekGoalsCard'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderCard() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/me/week']}>
    <Routes>
      <Route path="/me/week" element={<WeekGoalsCard />} />
      <Route path="/me/goals" element={<div>CELOK HUB</div>} />
    </Routes>
  </MemoryRouter></QueryWrapper>)
}

test('célonként egy sor: cím, dimenzió-chip és egy mondat', async () => {
  renderCard()
  expect(await screen.findByText('Kockahas')).toBeInTheDocument()
  expect(screen.getByText('Side hustle')).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-wgrow')).toHaveLength(3)
  expect(document.querySelectorAll('.lg-goalchip').length).toBeGreaterThan(0)
})

test('a CTA a Célok hubra visz', async () => {
  renderCard()
  fireEvent.click(await screen.findByRole('button', { name: /Célok/ }))
  expect(screen.getByText('CELOK HUB')).toBeInTheDocument()
})

test('nincs aktív cél → a kártya eltűnik', async () => {
  server.use(http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json({ goals: [] })))
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderCard()
  await new Promise((r) => setTimeout(r, 0))
  expect(container.querySelector('.lg-wcard')).toBeNull()
})
```

- [ ] **Step 6: Run to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/components/WeekGoalsCard.test.tsx
```
Expected: FAIL — modul nem található.

- [ ] **Step 7: Write the card**

`frontend/src/features/me/components/WeekGoalsCard.tsx`:

```tsx
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLifeGoalToday } from '@/data/hooks'
import { ARROW_CLASS, ARROW_GLYPH, DIMENSIONS } from '@/features/me/logic/lifegoalLabels'
import { goalWeekSentence } from '@/features/me/logic/goalWeekSentence'

// Heti hub cél-szekció (mezo-iizd.9, prototípus celok-body.html #page-heti `.qcard` + `.wgrow`):
// célonként nyíl · cím + dimenzió-chip · egy mondat, alul a Célok hubra vivő CTA.
//
// A hub-idióma szerint a kártya feloldatlan/hibás lekérésnél és aktív cél nélkül egyaránt
// NEM renderel — egy „0 cél" szekció-fejléc üres funkciót hirdetne (WeekHubPage honest-states).
export function WeekGoalsCard() {
  const navigate = useNavigate()
  const { today, isPending, isError } = useLifeGoalToday()
  if (isPending || isError || today.goals.length === 0) return null

  return (
    <div className="lg-wcard rise" style={{ '--d': '210ms' } as CSSProperties}>
      <div className="lg-wcard-top">
        <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Célok · a hét iránya</span>
        <span className="lg-wcard-cnt">{today.goals.length} cél</span>
      </div>
      {today.goals.map((g) => {
        const dim = DIMENSIONS[g.dimension]
        return (
          <div key={g.goalId} className={`lg-wgrow ${dim.cls}`}>
            <span className={`lg-arrow ${ARROW_CLASS[g.arrow]}`}><span className="g">{ARROW_GLYPH[g.arrow]}</span></span>
            <div className="grow">
              <div className="nm">
                {g.title}
                <span className="lg-goalchip"><i />{dim.label}</span>
              </div>
              <div className="x">{goalWeekSentence(g)}</div>
            </div>
          </div>
        )
      })}
      <button type="button" className="lg-wcard-cta" onClick={() => navigate('/me/goals')}>
        Célok · nyisd ki ›
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Add the CSS**

A `prototype.css`-ben, a Task 2 `.lg-conflict` szabályai után:

```css
/* Heti hub cél-kártya + goalchip (mezo-iizd.9, prototípus celok-body.html #page-heti .qcard/
   .wgrow/.goalchip). A `.lg-goalchip` a Growth skill-sorban is ezt a nyelvet viseli (mezo-iizd.12). */
.lg-wcard { border-radius: 18px; padding: 4px 12px 10px; margin-bottom: 10px; background: #fff;
  border: 0.5px solid rgba(43,33,24,0.06); box-shadow: 0 14px 26px -16px rgba(43,33,24,0.3); }
.lg-wcard-top { display: flex; align-items: baseline; gap: 8px; padding: 10px 2px 4px; }
.lg-wcard-cnt { margin-left: auto; font-size: 9.5px; color: #A2958A; }
.lg-wgrow { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; }
.lg-wgrow + .lg-wgrow { border-top: 0.5px solid rgba(43,33,24,0.08); }
.lg-wgrow .grow { flex: 1; min-width: 0; }
.lg-wgrow .nm { font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lg-wgrow .x { font-size: 11px; color: #6E6257; margin-top: 2px; line-height: 1.4; }
.lg-goalchip { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 2px 8px 2px 6px;
  font-size: 8.5px; font-weight: 700; color: var(--dc, #6E6257); background: var(--dw, rgba(43,33,24,0.06)); flex: none; }
.lg-goalchip i { width: 6px; height: 6px; border-radius: 50%; background: var(--dc, #A2958A); flex: none; }
.lg-wcard-cta { width: 100%; margin-top: 6px; border: 1px solid rgba(43,33,24,0.14); background: #fff;
  border-radius: 999px; padding: 8px 0; font-size: 11px; font-weight: 700; color: #6E6257; font-family: inherit; cursor: pointer; }
```

- [ ] **Step 9: Wire it into the Week hub**

`frontend/src/features/me/pages/WeekHubPage.tsx` — import:

```tsx
import { WeekGoalsCard } from '@/features/me/components/WeekGoalsCard'
```

A „4 · Heti felfedezések" gomb UTÁN, a `{running && <WeekNextCard ... />}` sor ELŐTT:

```tsx
          {/* Célok · a hét iránya (mezo-iizd.9) — a motor számolt nyilai. A magyarázó
              narratíva a fenti „Mezo · heti elemzés" csempén él (a prompt a nyilakat a
              WeeklyReviewContextSources cél-blokkjából kapja), ez a kártya a tényeké. */}
          <WeekGoalsCard />
```

- [ ] **Step 10: Extend the Week hub test**

`frontend/src/features/me/pages/WeekHubPage.test.tsx` — új teszt a fájl végére (a meglévő render-helper nevével):

```tsx
test('a heti hub viszi a cél-kártyát (mezo-iizd.9)', async () => {
  renderWeek()
  expect(await screen.findByText('Célok · a hét iránya')).toBeInTheDocument()
})
```

- [ ] **Step 11: Run everything (both modes)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/logic/goalWeekSentence.test.ts src/features/me/components/WeekGoalsCard.test.tsx src/features/me/pages/WeekHubPage.test.tsx
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run src/features/me/logic/goalWeekSentence.test.ts src/features/me/components/WeekGoalsCard.test.tsx src/features/me/pages/WeekHubPage.test.tsx
```
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/src/features/me/logic/goalWeekSentence.ts frontend/src/features/me/logic/goalWeekSentence.test.ts frontend/src/features/me/components/WeekGoalsCard.tsx frontend/src/features/me/components/WeekGoalsCard.test.tsx frontend/src/features/me/pages/WeekHubPage.tsx frontend/src/features/me/pages/WeekHubPage.test.tsx frontend/src/styles/prototype.css && git commit -m "feat(fe): WeekGoalsCard a Heti hubon — célonként nyíl, dimenzió-chip, számolt mondat (mezo-iizd.9)"
```

---

### Task 4: A heti visszatekintés promptja megkapja a cél-nyilakat (mezo-iizd.9, backend)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewContextSources.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGenerator.java` (a `PROMPT` konstans)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklyReviewContextSourcesIT.java` (ma nincs ilyen IT — ez az első)

**Interfaces:**
- Consumes: `LifeGoalProgressService.today(UUID userId)` → `LifeGoalTodayResponse`, benne `getGoals()` → `LifeGoalTodaySummary` (`getTitle()`, `getDimension()`, `getArrow()`, `getDays7()`, `getPillarsTotal()`, `getPillarsHitToday()`).
- Produces: `WeeklyReviewContextSources.render(...)` visszatérési stringje egy új, opcionális szekcióval bővül. A metódus-szignatúra NEM változik.

**Architektúra-indoklás (írd bele a javadocba):** a `companion` nem importálhat `lifegoal`-t, mert a `lifegoal` MÁR importálja a `companion`-t (`MetricSeriesService`, `LifeGoalProposePort`) — az visszafelé ciklus lenne, amit az ArchUnit `feature_slices_are_cycle_free` elkap. A heti visszatekintés viszont `feature/proactive`-ban él, ami már ma is közvetlenül olvas journal/medication/people repókat, és a `lifegoal` nem importál `proactive`-ot. Tehát a közvetlen olvasás itt precedens-követő és ciklusmentes. A companion `[Célok]` blokkjához kellő `LifeGoalSource` port a `mezo-iizd.10` dolga.

- [ ] **Step 1: Write the failing integration test**

Hozd létre a `WeeklyReviewContextSourcesIT`-t. A fixture-utat a `LifeGoalTodayApiIT` (`backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalTodayApiIT.java`) mintájáról vedd át **változtatás nélkül**: `LifeGoalPopulator.goal(owner, "active")` + `.pillar(goal, label, kind, PillarSourceJson, PillarRuleJson)`, plusz egy `ActivityLogEntity` a mai napra, hogy a pillérnek legyen adata. Nincs mock — házirend.

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyReviewContextSources;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** A heti visszatekintés gather-payloadjának ÉLETCÉLOK blokkja (mezo-iizd.9). */
class WeeklyReviewContextSourcesIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private WeeklyReviewContextSources contextSources;

    private final LocalDate today = LocalDate.now();
    private final LocalDate weekStart = today.minusDays(6);

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private String render(UUID owner) {
        return contextSources.render(owner, weekStart, today,
            Instant.now().minus(7, ChronoUnit.DAYS), Instant.now());
    }

    @Test
    void renders_the_life_goal_block_for_an_active_goal() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.pillar(goal, "Fokusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(today);
        e.setText("test entry");
        e.setSkillKey("productivity");
        e.setExtracted(new ActivityExtract(40, null));
        activityLogRepository.saveAndFlush(e);

        String payload = render(owner);

        assertThat(payload).contains("ÉLETCÉLOK · A HÉT IRÁNYA");
        assertThat(payload).contains(goal.getTitle());
    }

    @Test
    void renders_no_scaffolding_when_the_user_has_no_active_goal() {
        assertThat(render(ownerId())).doesNotContain("ÉLETCÉLOK");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='WeeklyReviewContextSourcesIT'
```
Expected: FAIL — a payload nem tartalmazza az `ÉLETCÉLOK · A HÉT IRÁNYA` fejlécet.

- [ ] **Step 3: Add the block to `WeeklyReviewContextSources`**

Új mező a konstruktor-injektált listába:

```java
    /** Ciklusmentes közvetlen olvasás: `lifegoal` nem importál `proactive`-ot. A companion
     *  irányához (mezo-iizd.10) port kell — ide nem, lásd az osztály javadocját. */
    private final LifeGoalProgressService lifeGoalProgressService;
```

Új konstans a többi cap mellé:

```java
    static final int MAX_LIFE_GOALS = 5;
```

A `render(...)` végén, a meglévő szekciók után:

```java
        appendLifeGoals(b, userId);
```

És az új privát metódus:

```java
    /**
     * {@code ÉLETCÉLOK · A HÉT IRÁNYA} — a lifegoal-motor MÁR KISZÁMOLT heti nyilai
     * (mezo-iizd.9). Kód gyűjti, modell magyarázza: a nyíl, a találat-nap szám és a mai
     * pillér-arány mind tárolt/derivált tény, a prompt kifejezetten TILTJA az újraszámolást
     * ({@link WeeklyReviewGenerator#PROMPT}).
     *
     * <p>Csak az AKTÍV célok jönnek — a {@code today()} eleve ezeket adja, ugyanazzal az
     * „evaluable" definícióval, amit a motor használ, tehát parkolt/lezárt cél sosem szivárog
     * a promptba. Cél nélkül NINCS fejléc: egy üres szekció is kontextust foglalna, és a
     * modellt arra csábítaná, hogy a hiányról beszéljen (a többi forrás azonos szabálya).
     */
    private void appendLifeGoals(StringBuilder b, UUID userId) {
        var goals = lifeGoalProgressService.today(userId).getGoals();
        if (goals.isEmpty()) {
            return;
        }
        b.append("\nÉLETCÉLOK · A HÉT IRÁNYA (a motor számolta — magyarázd, ne számold újra):\n");
        goals.stream().limit(MAX_LIFE_GOALS).forEach(g -> {
            long hits = g.getDays7() == null ? 0
                    : g.getDays7().stream().filter(s -> s == PillarDayStatus.HIT).count();
            b.append("- ").append(g.getTitle())
                    .append(" [").append(g.getDimension()).append("] ")
                    .append(arrowWord(g.getArrow()))
                    .append(" · ").append(hits).append(" találat-nap a 7-ből");
            if (g.getPillarsTotal() != null && g.getPillarsHitToday() != null) {
                b.append(" · ma ").append(g.getPillarsHitToday()).append(" / ").append(g.getPillarsTotal()).append(" pillér");
            }
            b.append('\n');
        });
    }

    /** A nyíl magyar szava — a glyph a promptban félreolvasható, a szó nem. */
    private static String arrowWord(TrendArrow arrow) {
        if (arrow == null) {
            return "nincs irány";
        }
        return switch (arrow) {
            case UP -> "emelkedik";
            case FLAT -> "tartja";
            case DOWN -> "csúszik";
            case INSUFFICIENT -> "kevés adat az irányhoz";
        };
    }
```

Az importok: `io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProgressService`, valamint `io.mrkuhne.mezo.api.dto.PillarDayStatus` és `io.mrkuhne.mezo.api.dto.TrendArrow`. A generált enum-konstansok UPPER_SNAKE alakúak — `PillarDayStatus.HIT` / `NO_DATA`, `TrendArrow.UP` / `FLAT` / `DOWN` / `INSUFFICIENT` (ellenőrizve: `LifeGoalProgressService.java:323–331`).

- [ ] **Step 4: Extend the prompt**

`WeeklyReviewGenerator.PROMPT` — a meglévő láncolat végére egy sor:

```java
            + "Az ÉLETCÉLOK blokk nyilait a motor számolta ki: MAGYARÁZD őket a hét adataival, "
            + "de sose számold újra és sose mondj velük ellentétes irányt. "
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='WeeklyReviewContextSourcesIT'
```
Expected: PASS.

- [ ] **Step 6: Run the ArchUnit gate**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='*Arch*Test'
```
Expected: PASS — a `feature_slices_are_cycle_free` szabály zöld (proactive → lifegoal egyirányú).

Ha a ciklus-szabály MÉGIS elbukik, NE lazítsd a szabályt: állj meg, jelentsd, és a port-változat (`LifeGoalWeekSource` a `proactive` alatt + adapter a `lifegoal`-ban) legyen a terv-módosítás.

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewContextSources.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGenerator.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklyReviewContextSourcesIT.java && git commit -m "feat(proactive): a heti visszatekintés promptja megkapja a számolt cél-nyilakat (mezo-iizd.9)"
```

---

### Task 5: Lezárt célok + Súlycél-sor a Célok hubon (mezo-iizd.4)

**Files:**
- Modify: `frontend/src/data/lifegoal/lifegoalMock.ts` (egy `done` cél)
- Modify: `frontend/src/features/me/pages/CelokPage.tsx`
- Modify: `frontend/src/features/me/pages/CelokPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useLifeGoals()`, `useGoal()` (`@/data/hooks`, a súlycélhez: `{ goal, goalResponse, pending }`), `STATUS_LABEL`, `DIMENSIONS`, `TRAJECTORY_LABEL` (`@/features/me/logic/goalLabels`).
- Produces: semmi új export.

**Miért kerül ide a Súlycél-sor:** a `.4` az Én-hub heroját életcél-összegzésre váltja (Task 6), és ma az a hero az EGYETLEN bejárat a `/me/goals/weight`-re. A spec D5 szerint a súlycél a Célok alá költözik — tehát a bejárata is oda kerül, különben a súly-parancsnokság elárvul.

- [ ] **Step 1: Add a `done` goal to the mock**

`frontend/src/data/lifegoal/lifegoalMock.ts` — a `MOCK_LIFE_GOALS` tömb végére, a `Spanyol B2` (parked) után, a szomszédos bejegyzések mezőit másolva (`id`, `title`, `whyText`, `frame`, `dimension`, `status`, `startDate`, `targetDate`, `ifThenPlans`, `pillars`):

```ts
  {
    id: 'lg-felmarathon',
    title: 'Félmaraton',
    whyText: 'Meg akartam tudni, meddig bírom.',
    frame: 'intrinsic',
    dimension: 'health',
    status: 'done',
    startDate: '2026-02-02',
    targetDate: '2026-05-31',
    closedAt: '2026-06-01T09:00:00Z',
    ifThenPlans: [],
    pillars: [pillar('lg-fm-p1', 0, 'Sportterhelés · heti', 'aerobic_capacity', 'habit', 1, signalSource('sport_load'), { daysPerWeek: 3 })],
  },
```

Ha a `pillar(...)` helper szignatúrája eltér, igazodj a fájl tetején lévő tényleges definícióhoz (`id, position, label, skillKey, kind, weight, source, rule`) — ne írj újat.

- [ ] **Step 2: Write the failing test**

`frontend/src/features/me/pages/CelokPage.test.tsx` — új tesztek a fájl végére:

```tsx
test('a lezárt cél a saját szekciójában jelenik meg, nem a mozaikban (mezo-iizd.4)', async () => {
  renderHub()
  await screen.findByText('Célok')
  expect(screen.getByText('Lezárt célok')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Félmaraton · kész/ })).toBeInTheDocument()
  // nem szivárog a mozaikba
  expect(screen.queryByRole('button', { name: 'Félmaraton' })).toBeNull()
})

test('a súlycél sora a Célok hubról nyílik (mezo-iizd.4)', async () => {
  renderHub()
  fireEvent.click(await screen.findByRole('button', { name: /Súlycél/ }))
  expect(screen.getByText('SULYCEL')).toBeInTheDocument()
})
```

A `renderHub()` `<Routes>`-ába vedd fel:
```tsx
<Route path="/me/goals/weight" element={<div>SULYCEL</div>} />
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/pages/CelokPage.test.tsx
```
Expected: FAIL — „Unable to find an element with the text: Lezárt célok".

- [ ] **Step 4: Implement in `CelokPage`**

Az importokhoz add: `import { useGoal } from '@/data/hooks'` (a meglévő `@/data/hooks` importba fűzd be), `import { STATUS_LABEL } from '@/features/me/logic/lifegoalLabels'` (a meglévő importba), `import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'`, `import { hu1 } from '@/shared/lib/huNum'`.

A `parked` derivált mellé:

```tsx
  // A `done` cél mostanáig SEHOL nem jelent meg (sem a mozaikban, sem a parkolt sorban) — egy
  // lezárt cél eltűnt minden felületről, pedig a GET /api/life-goals visszaadja (mezo-iizd.4).
  // Külön szekció, nem a mozaikban: a mozaik az ÉLŐ célok tere, egy kész cél emlék.
  const done = goals.filter((g) => g.status === 'done')
  const { goal: weightGoal, goalResponse, pending: weightPending } = useGoal()
```

A Jelek-sor UTÁN (az `EntranceGroup` végén):

```tsx
          {/* Súlycél (mezo-iizd.4): a spec D5 szerint a súlycél a Célok alá költözött, és a
              .4 óta az Én-hub heroja életcél-összegzés — tehát a /me/goals/weight bejárata
              ITT van, különben a súly-parancsnokság elárvul. */}
          <button type="button" className="lg-parkrow rise"
            style={{ '--d': `${340 + parked.length * 40}ms`, marginTop: 10 } as React.CSSProperties}
            onClick={() => navigate('/me/goals/weight')} aria-label="Súlycél">
            <ClayIcon name="i-suly" size={22} />
            <div style={{ flex: 1 }}>
              <div className="nm" style={{ color: 'var(--text-primary)' }}>Súlycél</div>
              <div className="sb">
                {weightPending
                  ? 'töltöm…'
                  : goalResponse != null && weightGoal != null
                    ? `${TRAJECTORY_LABEL[goalResponse.trajectory]} · ${hu1(weightGoal.currentWeight)} → ${hu1(weightGoal.targetWeight)} kg`
                    : 'nincs aktív súlycél'}
              </div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12 }}>›</span>
          </button>

          {done.length > 0 && (
            <>
              <div className="mz-eyebrow rise" style={{ '--d': '380ms', padding: '12px 2px 6px' } as React.CSSProperties}>Lezárt célok</div>
              {done.map((g, i) => (
                <button key={g.id} type="button" className="lg-parkrow lg-donerow rise"
                  style={{ '--d': `${400 + i * 40}ms` } as React.CSSProperties}
                  onClick={() => navigate(`/me/goals/${g.id}`)} aria-label={`${g.title} · kész`}>
                  <ClayIcon name={DIMENSIONS[g.dimension].icon} size={22} />
                  <div style={{ flex: 1 }}>
                    <div className="nm">{g.title}</div>
                    <div className="sb">{STATUS_LABEL[g.status]} · {DIMENSIONS[g.dimension].label}</div>
                  </div>
                  <span className="lg-donetick" aria-hidden="true">✓</span>
                </button>
              ))}
            </>
          )}
```

Ugyanebben a lépésben javítsd a hero elavult copyját (a motor a `.5`–`.7` óta él, a nyíl NEM „a 2. szelettel jön"):

```tsx
                : todayHonest
                  ? <>A pillérek a meglévő naplódból számolnak. <strong>A heti irány most töltődik</strong> — a célok és pilléreik addig is itt élnek.</>
```

- [ ] **Step 5: Add the CSS**

A `prototype.css`-ben, a Task 3 `.lg-wcard-cta` szabálya után:

```css
/* Lezárt cél sora (mezo-iizd.4): a parkolt sor nyelve, halványabban — egy kész cél emlék,
   nem tennivaló. A pipa a jobb szélen a lezárás egyetlen jele. */
.lg-donerow { opacity: 0.72; }
.lg-donetick { margin-left: auto; flex: none; font-size: 12px; font-weight: 700; color: #4E6B42; }
```

- [ ] **Step 6: Run tests (both modes)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/pages/CelokPage.test.tsx src/data/lifegoal/lifegoalHooks.test.tsx
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run src/features/me/pages/CelokPage.test.tsx src/data/lifegoal/lifegoalHooks.test.tsx
```
Expected: PASS. Ha a `mockToday()` / `PermahRing` valamelyik meglévő teszt-assertje az új `done` cél miatt elmozdul (pl. cél-darabszám), javítsd az assertet — a `done` cél SEM az aktív számba, SEM a PERMAH-ívekbe nem tartozik.

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/src/data/lifegoal/lifegoalMock.ts frontend/src/features/me/pages/CelokPage.tsx frontend/src/features/me/pages/CelokPage.test.tsx frontend/src/styles/prototype.css && git commit -m "feat(fe): lezárt célok szekció + súlycél-sor a Célok hubon (mezo-iizd.4)"
```

---

### Task 6: Én-hub hero → életcél-összegzés (mezo-iizd.4)

**Files:**
- Modify: `frontend/src/features/me/pages/EnHubPage.tsx`
- Modify: `frontend/src/features/me/pages/EnHubPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useLifeGoals()`, `useLifeGoalToday()`, `DIMENSIONS`, `ARROW_GLYPH`, a meglévő `MCells` / `MCell` a `@/shared/ui/mozaik`-ból.
- Produces: semmi új export.

**Mi tűnik el:** a `goalCard` súly-blokkja (`enh-goalcard` a `goal.startWeight/targetWeight/eta` cellákkal) és a `enh-newgoal` gomb. A súly-adat marad a mozaik „Súly" csempéjén (`sulyLine`), a súlycél parancsnoksága pedig a Task 5-ben felvett Célok-hub sorról nyílik. A `TRAJECTORY_LABEL`, `etaWeeks`, `huSigned` importok közül csak azt töröld, amit tényleg semmi más nem használ a fájlban — a `huSigned` a `sulyLine`-hoz kell, tehát MARAD.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/me/pages/EnHubPage.test.tsx` — új tesztek:

```tsx
test('a hero-kártya az életcélokat összegzi és a Célok hubra visz (mezo-iizd.4)', async () => {
  renderHub()
  const card = await screen.findByRole('button', { name: /Célok/ })
  expect(card).toBeInTheDocument()
  fireEvent.click(card)
  expect(screen.getByText('CELOK HUB')).toBeInTheDocument()
})

test('a súlycél-track eltűnt az Én-hubról', async () => {
  renderHub()
  await screen.findByRole('button', { name: /Célok/ })
  expect(document.querySelector('.enh-gtrack')).toBeNull()
})
```

A `renderHub()` route-jai közé vedd fel: `<Route path="/me/goals" element={<div>CELOK HUB</div>} />`.

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/pages/EnHubPage.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Replace the goal card**

Az importokba: `useLifeGoals`, `useLifeGoalToday` a `@/data/hooks`-ból; `import { DIMENSIONS, ARROW_GLYPH } from '@/features/me/logic/lifegoalLabels'`.

A teljes `// ── goal card ──` blokkot (a `const { goal, goalResponse, pending: goalPending } = useGoal()`-tól a záró `}` -ig, ami a `goalCard`-ot állítja be) cseréld erre — a `useGoal()` hívás MARAD, mert a `rate` a `sulyLine`-hoz kell; ha a `goal`/`goalResponse` destrukturálás sehol máshol nem használt, hagyd el őket:

```tsx
  // ── életcél-hero (mezo-iizd.4) ───────────────────────────────────────
  // A hero mostanáig a SÚLYCÉL adata volt és /me/goals/weight-re vitt — az Én-hubról így
  // semmi nem nyílt a /me/goals Célok hubra, pedig a spec D5 szerint a hosszú cél ott lakik.
  // A súlycél parancsnoksága a Célok hub saját sorára költözött (mezo-iizd.4, CelokPage);
  // a napi súly-szám a mozaik Súly-csempéjén marad.
  const { goals: lifeGoals, isPending: lifeGoalsPending } = useLifeGoals()
  const { today: lifeToday, isPending: lifeTodayPending, isError: lifeTodayError } = useLifeGoalToday()
  const activeGoals = lifeGoals.filter((g) => g.status === 'active')
  // `insufficient` kimarad: túl kevés adat sosem irány (a CelokPage/LifeGoalTile guardrailje).
  const arrows = lifeToday.goals.reduce(
    (acc, s) => { if (s.arrow !== 'insufficient') acc[s.arrow] += 1; return acc },
    { up: 0, flat: 0, down: 0 } as Record<'up' | 'flat' | 'down', number>,
  )
  // Feloldatlan/hibás `today` üres listája alakilag azonos a „még nincs iránya" esettel —
  // számolni belőle kitalált „0↗ · 0→ · 0↘"-t adna (CelokPage `todayHonest` idióma).
  const arrowsHonest = lifeTodayPending || lifeTodayError

  let goalCard: React.ReactNode = null
  if (!lifeGoalsPending && activeGoals.length > 0) {
    const cells: MCell[] = arrowsHonest
      ? [{ label: 'aktív cél', value: `${activeGoals.length}`, tone: 'coral' }]
      : [
          { label: 'emelkedik', value: `${ARROW_GLYPH.up} ${arrows.up}`, tone: 'sage' },
          { label: 'tartja', value: `${ARROW_GLYPH.flat} ${arrows.flat}`, tone: 'lav' },
          { label: 'csúszik', value: `${ARROW_GLYPH.down} ${arrows.down}`, tone: 'coral' },
        ]
    goalCard = (
      <button type="button" className="enh-goalcard enh-lgcard rise" style={{ '--d': '70ms' } as React.CSSProperties}
        aria-label="Célok" onClick={() => navigate('/me/goals')}>
        <div className="enh-goalhead">
          <span className="mz-eyebrow"><ClayIcon name="i-cel" size={15} /> Célok</span>
          <span className="enh-stch">{activeGoals.length} aktív</span>
        </div>
        <div className="enh-lgdims">
          {activeGoals.slice(0, 4).map((g) => (
            <span key={g.id} className={`lg-goalchip ${DIMENSIONS[g.dimension].cls}`}><i />{g.title}</span>
          ))}
        </div>
        <MCells cells={cells} />
      </button>
    )
  } else if (!lifeGoalsPending) {
    // Nincs aktív életcél — nincs kitalált gyűrű. Az ajtó a varázslóra nyílik.
    goalCard = (
      <button type="button" className="enh-newgoal rise" style={{ '--d': '70ms' } as React.CSSProperties}
        onClick={() => navigate('/me/goals/new')}>
        ＋ Új cél
      </button>
    )
  }
```

- [ ] **Step 4: Add the CSS**

A `prototype.css`-ben, a Task 5 `.lg-donetick` után:

```css
/* Én-hub életcél-hero (mezo-iizd.4): az `.enh-goalcard` váza, súly-track nélkül — a helyére
   a célok dimenzió-chipjei kerülnek. */
.enh-lgcard .mz-eyebrow { display: inline-flex; align-items: center; gap: 5px; }
.enh-lgdims { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0 10px; }
```

- [ ] **Step 5: Run tests (both modes)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/pages/EnHubPage.test.tsx
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run src/features/me/pages/EnHubPage.test.tsx
```
Expected: PASS. A meglévő „identity hero a valódi fióknévre pinnelve" teszt (mezo-qw37.2) NEM sérülhet — ha mégis, az azt jelenti, hogy túl sokat töröltél a heroból; csak a goal-kártya cserélődik, az identity hero érintetlen.

- [ ] **Step 6: Typecheck + lint**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm lint && pnpm build
```
Expected: nincs unused-import hiba (a `TRAJECTORY_LABEL`/`etaWeeks` már használatlan lehet — töröld őket, ha a lint jelzi).

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/src/features/me/pages/EnHubPage.tsx frontend/src/features/me/pages/EnHubPage.test.tsx frontend/src/styles/prototype.css && git commit -m "feat(fe): Én-hub hero életcél-összegzésre vált, a súlycél a Célok hubról nyílik (mezo-iizd.4)"
```

---

### Task 7: Growth skill-sor goalchip (mezo-iizd.12)

**Files:**
- Create: `frontend/src/features/me/logic/goalSkillChips.ts`
- Create: `frontend/src/features/me/logic/goalSkillChips.test.ts`
- Modify: `frontend/src/features/me/components/SkillBandCard.tsx`
- Modify: `frontend/src/features/me/pages/GrowthSkillsPage.tsx`
- Modify: `frontend/src/features/me/pages/GrowthSkillsPage.test.tsx`
- Modify: `frontend/tests/visual/visual.spec.ts` (új `me-growth-skillek` képernyő)

**Interfaces:**
- Consumes: `useLifeGoals()`; `LifeGoalResponse.pillars[].skillKey`; `DIMENSIONS`.
- Produces:
  - `export interface GoalChip { title: string; dimension: LifeGoalDimension }`
  - `export function goalSkillChips(goals: LifeGoalResponse[]): Map<string, GoalChip>` — `skillKey → chip`; CSAK `status === 'active'` célokból, első találat nyer (a pillérek beérkezési sorrendjében).
  - `SkillBandCard` új opcionális prop: `goalChips?: Map<string, GoalChip>`.

- [ ] **Step 1: Write the failing unit test**

`frontend/src/features/me/logic/goalSkillChips.test.ts`:

```ts
import { expect, test } from 'vitest'
import { goalSkillChips } from '@/features/me/logic/goalSkillChips'
import { MOCK_LIFE_GOALS } from '@/data/lifegoal/lifegoalMock'

test('minden aktív cél minden pillére ad chipet a saját skilljére', () => {
  const chips = goalSkillChips(MOCK_LIFE_GOALS)
  const active = MOCK_LIFE_GOALS.filter((g) => g.status === 'active')
  for (const g of active) {
    for (const p of g.pillars) {
      expect(chips.get(p.skillKey)).toBeDefined()
    }
  }
})

test('parkolt és lezárt cél NEM ad chipet', () => {
  const parked = MOCK_LIFE_GOALS.find((g) => g.status === 'parked')!
  const chips = goalSkillChips([parked])
  expect(chips.size).toBe(0)
})

test('inaktív pillér nem ad chipet', () => {
  const g = MOCK_LIFE_GOALS.find((x) => x.status === 'active')!
  const chips = goalSkillChips([{ ...g, pillars: g.pillars.map((p) => ({ ...p, active: false })) }])
  expect(chips.size).toBe(0)
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/logic/goalSkillChips.test.ts
```
Expected: FAIL — modul nem található.

- [ ] **Step 3: Write the function**

`frontend/src/features/me/logic/goalSkillChips.ts`:

```ts
import type { LifeGoalDimension, LifeGoalResponse } from '@/data/lifegoal/lifegoalApi'

export interface GoalChip { title: string; dimension: LifeGoalDimension }

/**
 * `skillKey → goalchip` (mezo-iizd.12). Minden pillér hordoz `skillKey`-t, és a `.6` óta a
 * hit-napok XP-je is azon a skillen érkezik (LifeGoalXpService → ProgressionService.applyLifeGoal,
 * source_type=LIFE_GOAL) — a chip tehát azt a kapcsolatot teszi láthatóvá, ami a pontszámban
 * MÁR él, nem újat állít.
 *
 * CSAK aktív cél aktív pillére számít: ugyanaz az „evaluable" definíció, amit a motor használ.
 * Egy parkolt cél pillére nem gyűjt napot és nem ad XP-t, tehát chipet sem adhat — különben a
 * Growth-sor egy nem futó célt hirdetne.
 *
 * Ütközésnél az ELSŐ találat nyer (a célok, majd a pillérek beérkezési sorrendjében): egy sor
 * egy chipet visel, és a stabil sorrend fontosabb, mint egy „melyik cél a fontosabb" heurisztika,
 * amire nincs adatunk.
 */
export function goalSkillChips(goals: LifeGoalResponse[]): Map<string, GoalChip> {
  const out = new Map<string, GoalChip>()
  for (const g of goals) {
    if (g.status !== 'active') continue
    for (const p of g.pillars) {
      if (p.active === false) continue
      if (!p.skillKey || out.has(p.skillKey)) continue
      out.set(p.skillKey, { title: g.title, dimension: g.dimension })
    }
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/logic/goalSkillChips.test.ts
```
Expected: PASS.

- [ ] **Step 5: Add the chip slot to `SkillBandCard`**

A prop-listába: `goalChips`; az importokhoz `import { DIMENSIONS } from '@/features/me/logic/lifegoalLabels'` és `import type { GoalChip } from '@/features/me/logic/goalSkillChips'`.

```tsx
export function SkillBandCard({ eyebrow, chip, chipTone, rows, footer, wash, delayMs, previewRows = 4, goalChips }: {
  eyebrow: string; chip: string; chipTone: 'ok' | 'warn' | 'lav'; rows: SkillRowVM[]
  footer?: ReactNode; wash: SkillBandWash; delayMs?: number; previewRows?: number
  /** `skillKey → chip` (mezo-iizd.12). Csak akkor kap sor chipet, ha aktív cél pillére rá mutat. */
  goalChips?: Map<string, GoalChip>
}) {
```

A sor-renderelésben, a `Lv n` plakett ELŐTT:

```tsx
            {goalChips?.get(r.key) && (
              <span className={`lg-goalchip ${DIMENSIONS[goalChips.get(r.key)!.dimension].cls}`}>
                <i />{goalChips.get(r.key)!.title}
              </span>
            )}
```

- [ ] **Step 6: Wire it in `GrowthSkillsPage`**

Importok: `import { useLifeGoals } from '@/data/hooks'` (a meglévő `@/data/hooks` importba), `import { goalSkillChips } from '@/features/me/logic/goalSkillChips'`.

A `const s = growthStats(profile)` után:

```tsx
  // A goalchip (mezo-iizd.12) mindhárom sávra megy: a pillér `skillKey`-e a LIFE-taxonómián
  // KÍVÜLRE is mutathat (a jel-katalógus `weight_goal`/`gym_volume` bejegyzései például
  // `max_strength`/`aerobic_capacity` atlétikai skillt adnak).
  const { goals: lifeGoals } = useLifeGoals()
  const chips = goalSkillChips(lifeGoals)
```

Mindhárom `<SkillBandCard ... />`-ra add: `goalChips={chips}`.

- [ ] **Step 7: Extend the page test**

`frontend/src/features/me/pages/GrowthSkillsPage.test.tsx`:

```tsx
test('a skill-sor goalchipet kap, ha aktív cél pillére rá mutat (mezo-iizd.12)', async () => {
  renderSkills()
  await screen.findByText('LIFE')
  expect(document.querySelectorAll('.lg-goalchip').length).toBeGreaterThan(0)
})
```

- [ ] **Step 8: Add the visual screen**

`frontend/tests/visual/visual.spec.ts` — a `['me-growth', '/me/growth'],` sor UTÁN:

```ts
  // mezo-iizd.12: a Growth skill-sorok goalchipje (aktív cél pillére → skill) saját felület,
  // amit a /me/growth hub shotja nem lát — a chip enélkül pixel-szinten őrizetlen maradna.
  ['me-growth-skillek', '/me/growth/skillek'],
```

- [ ] **Step 9: Run tests (both modes)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/me/logic/goalSkillChips.test.ts src/features/me/pages/GrowthSkillsPage.test.tsx src/features/me/components/
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run src/features/me/logic/goalSkillChips.test.ts src/features/me/pages/GrowthSkillsPage.test.tsx src/features/me/components/
```
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/src/features/me/logic/goalSkillChips.ts frontend/src/features/me/logic/goalSkillChips.test.ts frontend/src/features/me/components/SkillBandCard.tsx frontend/src/features/me/pages/GrowthSkillsPage.tsx frontend/src/features/me/pages/GrowthSkillsPage.test.tsx frontend/tests/visual/visual.spec.ts && git commit -m "feat(fe): Growth skill-sor goalchip + saját vizuális golden (mezo-iizd.12)"
```

---

### Task 8: Teljes FE kapu, darwin goldenek, codemap, doksi (mezo-iizd.9)

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts-snapshots/*.png` (csak az érintettek!)
- Modify: `docs/CODEMAP.md`
- Modify: `docs/features/lifegoal.md` (ha létezik; ha nem, ez a `.13` dolga — akkor hagyd ki)

- [ ] **Step 1: Run the full frontend gate, both modes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test -- --run
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test -- --run
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm lint && pnpm build
```
Expected: mind zöld. Ha bármi piros, javítsd, MIELŐTT goldent generálsz — egy hibás fáról készült baseline mérgezi a következő köröket.

- [ ] **Step 2: Regenerate the darwin baselines**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm test:visual:update
```

- [ ] **Step 3: Keep ONLY the affected images**

A parancs SOK képet átír (a `.7` körben 82-t), de csak az érintetteket szabad commitolni. Az érintettek listája (light + dark, darwin):
`today-nap` · `me` · `me-cel` · `me-cel-reszlet` · `me-heti` · `me-growth-skillek` (ÚJ fájlok).

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git status --porcelain frontend/tests/visual/visual.spec.ts-snapshots/ | sed 's/^...//' | sort
```

Tedd stage-re csak az érintetteket, a többit dobd vissza:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/tests/visual/visual.spec.ts-snapshots/today-nap-*-darwin.png frontend/tests/visual/visual.spec.ts-snapshots/me-{light,dark}-darwin.png frontend/tests/visual/visual.spec.ts-snapshots/me-cel-*-darwin.png frontend/tests/visual/visual.spec.ts-snapshots/me-heti-*-darwin.png frontend/tests/visual/visual.spec.ts-snapshots/me-growth-skillek-*-darwin.png
```
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git checkout -- frontend/tests/visual/visual.spec.ts-snapshots/ && git status --porcelain frontend/tests/visual/visual.spec.ts-snapshots/
```

FIGYELEM: a `me-cel-*` glob a `me-cel`, `me-cel-suly`, `me-cel-reszlet` ÉS `me-cel-jelek` képeket is fogja. A `me-cel-suly` és `me-cel-jelek` ebben a körben NEM változhat — ha mégis diffelnek, az gépi drift: vedd ki őket a stage-ből (`git restore --staged <fájl> && git checkout -- <fájl>`) és ellenőrizd, mi mozgatta.

- [ ] **Step 4: Verify the visual suite is green against the new baselines**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm test:visual
```
Expected: PASS (darwin).

- [ ] **Step 5: Regenerate the codemap**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```
Expected: a codemap frissül, a lint-docs 0 errort ad (a stale-doc figyelmeztetések előzetesek, nem errorok).

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add docs/CODEMAP.md frontend/tests/visual/visual.spec.ts-snapshots/ && git commit -m "chore(visual): darwin baseline-ök a lifegoal-beágyazáshoz + codemap (mezo-iizd.9)"
```

- [ ] **Step 7: Push and open the self-PR**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git push -u origin feat/lifegoal-beagyazas
```

Nyisd meg a self-PR-t (`gh pr create`), majd várd meg a CI zöldet.

- [ ] **Step 8: Regenerate the linux baselines with the bot**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && gh workflow run update-visual-baselines.yml -r feat/lifegoal-beagyazas
```

A bot-commit NEM triggerel CI-t → utána:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git pull && git commit --allow-empty -m "chore(ci): trigger after the visual-baseline bot commit (mezo-iizd.9)" && git push
```

- [ ] **Step 9: Merge on a FRESH origin/main**

A main NAGYON aktív (a `.7` alatt kétszer ment előre). CI zöld után:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git fetch origin && git checkout --detach origin/main && git merge --no-ff feat/lifegoal-beagyazas
```

Ha **bináris golden-konfliktus** jön (a main ugyanazt a képet mozgatta): a megoldás NEM „valamelyik oldal", hanem ÚJRAGENERÁLÁS a mergelt fából — a mergelt UI mindkét változást viszi. Oldd fel a konfliktust bármelyik oldallal, majd futtasd újra a Step 2–4-et a mergelt fán, és amend-eld a merge-commitba. Ha a regenerálás után byte-azonos, az is érvényes eredmény — de ellenőrizd, ne feltételezd.

Merge UTÁN, push ELŐTT:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && node scripts/gen-codemap.mjs --check
```
Ha stale (párhuzamos ág mozgatta a fát): regen + `git commit --amend`.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git push origin HEAD:main && git checkout feat/lifegoal-beagyazas
```

- [ ] **Step 10: Close out**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git push origin --delete feat/lifegoal-beagyazas && bd close mezo-iizd.9 mezo-iizd.4 mezo-iizd.12
```

Majd a session-zárás:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git pull --rebase && bd dolt push && git push && git status
```
Expected: „up to date with origin".

---

## Nyitott tételek, amiket ez a kör bd-be tesz (nem old meg)

- **A heti visszatekintés per-cél AI-mondata** (a prototípus `#page-heti` `.wgrow .x` narratívája) a `mezo-iizd.10` companion-körével jön, amikor a `LifeGoalSource` port megépül. A Task 3 kártyája addig számolt tényt mond. → Új bd a `mezo-iizd` alá, `mezo-iizd.10` blokkolja.
- **`mezo-hhdo`** (P2): az `lg-*` család sötét módban olvashatatlan (fehér kártya + fehér szöveg). Az ebben a körben született `.lg-gtile` / `.lg-wcard` / `.lg-conflict` / `.lg-goalchip` szabályok UGYANEBBE a hibába esnek — vedd fel őket a `mezo-hhdo` leírásába, hogy a javítás egyszerre vigye mindet.
- **A Nap-csempe csak a `nap` panelen jelenik meg** (prototípus-hűség). Ha a `reggel`/`este` panel is kérné, az design-döntés — új bd, nem néma bővítés.
