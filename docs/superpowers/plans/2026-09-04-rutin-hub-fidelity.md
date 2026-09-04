# Rutin hub prototípus-hűségi újravágás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/me/rutin` hub vizuálisan a `#pg-rutin` prototípus legyen (statstrip, kétsoros szokás-sor read-only pipával, csendes lánc-fejléc, záró elvi mondat), a napnavigátor megtartásával.

**Architecture:** Tiszta frontend re-face helyben, a `RutinHubPage.tsx`-ben; a stílusok a `prototype.css`-be, a meglévő `StatStrip`/`StatCell` primitívet fogyasztva. Egyetlen shared-primitív változás: a `SortableList` kap egy opcionális `chevrons="focus"` módot, hogy a ▲▼ gombok csak billentyű-fókuszra látszódjanak (a11y megmarad, a kép prototípus-hű lesz). Se kontraktus-, se backend-, se migrációváltozás.

**Tech Stack:** React 18 + TypeScript, vitest + @testing-library/react, `frontend/src/styles/prototype.css`, Playwright vizuális goldenek.

**Spec:** [`docs/superpowers/specs/2026-09-04-rutin-hub-fidelity-design.md`](../specs/2026-09-04-rutin-hub-fidelity-design.md) · **bd:** `mezo-3zue.10`

## Global Constraints

- **Munkakönyvtár (abszolút, a Bash cwd ragad a hívások között):** `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity`. Az ág: `feat/rutin-hub-fidelity`. Soha ne `cd`-zz a primary checkoutba.
- **Prototípus-hűség ×1.18:** minden prototípus-px × 1.18, a színek a meglévő tokenekre képezve (`docs/features/_platform-design-system.md:528`). Bevallott eltérés csak a PR-ben jelezve.
- **Hard rule:** ezen a lapon soha nincs pipálható kontroll — a `✓` read-only jelző. A ticket a `/nap/rutin` adja (`docs/features/habit.md` §2/§5).
- **Gomb a gombban tilos:** a sor maga `<button>`, minden más kontroll testvér. A sor `aria-label`-je hordozza a százalékot.
- **Honesty rule:** hiányzó adatnál a cella/chip **elmarad**, sosem írunk hamis nullát (`NapRutinPage.tsx:146-151` az idióma).
- **Reorder:** a `SortableList` mindig a lánc TELJES def-halmazának permutációját küldi; részhalmaz 400 `HABIT_REORDER_MISMATCH`.
- **Frontend tesztek MINDKÉT módban, explicit** (a beállítatlan `VITE_USE_MOCK` = mock mód, a csupasz `pnpm test` vákuum): `VITE_USE_MOCK=true pnpm test` ÉS `VITE_USE_MOCK=false pnpm test`, plusz külön `pnpm exec tsc -b`.
- **Commit-subject hordozza a bd id-t:** `fix(me): ... (mezo-3zue.10)`; trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Doc-lint:** csak `node scripts/lint-docs.mjs --errors-only`.
- **TDD:** előbb bukó teszt, és ellenőrizd, hogy a HELYES okból bukik.

## File Structure

| Fájl | Felelősség | Művelet |
|------|------------|---------|
| `frontend/src/features/me/pages/RutinHubPage.tsx` | a lap: statstrip, sorok, lánc-kártyák, elvi mondat | módosítás |
| `frontend/src/features/me/pages/RutinHubPage.test.tsx` | a lap tesztjei | módosítás |
| `frontend/src/shared/ui/SortableList.tsx` | drag-handle + ▲▼ a11y-átrendezés | `chevrons` prop hozzáadása |
| `frontend/src/styles/prototype.css` | `.rt-*` blokk (átvágás), `.gr-cov*` (törlés), `.srt-chev*` (új) | módosítás |
| `docs/features/habit.md` | §2 lap-leírás, §9 gotcha, §10 fájltérkép | módosítás |
| `docs/features/_platform-design-system.md` | `SortableList` `chevrons` mód | módosítás |
| `docs/design_2.0/prototypes/src/rutin-epito-body.html` | `#pg-rutin` — napnavigátor mint elfogadott bővítés (komment) | módosítás |
| `docs/design_2.0/2026-09-02-rutin-epito-design-iterations.md` | záró jegyzet a két bevallott eltérésről | módosítás |

Nem születik új fájl → `gen-codemap.mjs` futtatása nem kötelező, de a 7. feladat ellenőrzi.

---

### Task 1: Statstrip a covtile-ok helyett

**Files:**
- Modify: `frontend/src/features/me/pages/RutinHubPage.tsx:33` (`DAYS`), `:52-71` (`Cells`, `CounterTile`), `:234-238` (mount)
- Modify: `frontend/src/styles/prototype.css:6084-6094` (törlés), `:6166-6168` (reduced-motion sor)
- Test: `frontend/src/features/me/pages/RutinHubPage.test.tsx:116`

**Interfaces:**
- Consumes: `StatStrip`, `StatCell` a `@/shared/ui/mozaik`-ból — `StatCell({ value: ReactNode, label: string, over?: boolean })`.
- Produces: a lapon egy `.mz-statstrip` három `.mz-statcell`-lel; a `.gr-covgrid`/`.gr-covtile`/`.gr-cells` osztályok sehol nem maradnak.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `RutinHubPage.test.tsx`-ben cseréld le a `keeps the 30-day counter tiles and the day navigator from the Growth page` tesztet erre a háromra:

```tsx
  test('shows the prototype statstrip instead of the 30-cell counter tiles', () => {
    const { container } = renderPage()
    expect(screen.getByText('tökéletes reggel · 30 n')).toBeInTheDocument()
    expect(screen.getByText('tökéletes este · 30 n')).toBeInTheDocument()
    expect(screen.getByText('aktív szokás')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument() // perfectMorningDays30
    expect(container.querySelector('.gr-covtile')).toBeNull()
    expect(container.querySelector('.gr-cells')).toBeNull()
  })

  test('keeps the day navigator — the accepted extension over the prototype', () => {
    renderPage()
    expect(screen.getByLabelText(/előző nap/i)).toBeInTheDocument()
  })

  test('the active-habit cell counts ACTIVE definitions only', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: [MORNING.defs[0], MORNING.defs[1], { ...MORNING.defs[2], isActive: false }] }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    const cell = screen.getByText('aktív szokás').closest('.mz-statcell') as HTMLElement
    expect(within(cell).getByText('2')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy a HELYES okból bukik**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/RutinHubPage.test.tsx
```

Elvárt: mindhárom új teszt bukik `Unable to find an element with the text: tökéletes reggel · 30 n`-nel (NEM importhibával, NEM `.mz-statcell is null`-lal).

- [ ] **Step 3: Cseréld le a mountot a statstripre**

A `RutinHubPage.tsx`-ben töröld a `DAYS` konstanst, a `Cells` és `CounterTile` függvényeket, a `ClaySpot` importot (ha máshol nem használt — ellenőrizd `grep -n 'ClaySpot' frontend/src/features/me/pages/RutinHubPage.tsx`), és a `MozaikPage`-importot bővítsd `StatStrip, StatCell`-lel. Az aktív szokások száma a többi derivált mellé (a `meanStrength` alá):

```tsx
  const activeDefs = catalog.chains.flatMap((c) => c.defs).filter((d) => d.isActive).length
```

A `.gr-covgrid` blokk (`isToday && (...)`) helyére:

```tsx
          {/* A 30 napos aggregátum a kiválasztott naptól független, ezért a múltnapi ágon is
              itt marad — a lap identitása nem ugrik napváltáskor. */}
          <StatStrip className="rise">
            <StatCell value={summary.perfectMorningDays30} label="tökéletes reggel · 30 n" />
            <StatCell value={summary.perfectEveningDays30} label="tökéletes este · 30 n" />
            <StatCell value={activeDefs} label="aktív szokás" />
          </StatStrip>
```

(A `rise` belépő-animációhoz a `style={{ '--d': '0ms' } as CSSProperties}` marad a `StatStrip`-en, ha az `EntranceGroup` megkívánja — ellenőrizd a `NapRutinPage.tsx:146-151` mintát, és kövesd azt.)

- [ ] **Step 4: Töröld az árván maradt CSS-t**

A `prototype.css`-ből töröld a `/* rutin */` komment alatti `.gr-covgrid`, `.gr-covtile`, `.gr-cov-hd`, `.gr-cov-hd b`, `.gr-cov-n`, `.gr-cov-n small`, `.gr-cells`, `.gr-cells i`, `.gr-cells i.on`, `.gr-cells i.ev.on` és a `.mz-play .gr-cells i` sorokat (`:6084-6094`), valamint a reduced-motion listából a `.gr-cells i, .mz-play .gr-cells i` tagokat (a lista többi tagja marad!). Ha a `gr-dotpop` keyframe így fogyasztó nélkül marad (`grep -n 'gr-dotpop' frontend/src/styles/prototype.css`), azt is töröld.

- [ ] **Step 5: Futtasd a teszteket**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/RutinHubPage.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts
```

Elvárt: PASS mindkét fájlban (a `prototypeCssStructure` a kézi CSS-törlés zárójel-hibáit fogja).

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && git add frontend/src/features/me/pages/RutinHubPage.tsx frontend/src/features/me/pages/RutinHubPage.test.tsx frontend/src/styles/prototype.css && git commit -F - <<'EOF'
fix(me): statstrip a 30 cellás covtile-ok helyett a rutin hubon (mezo-3zue.10)

A prototípus (#pg-rutin) három statcellát ír elő: tökéletes reggel/este · 30 n
és az aktív szokások száma. A harmadik cellának nincs kontraktus-mezője, FE-oldali
derivált az aktív def-ekből. A .gr-cov*/.gr-cells blokk fogyasztó nélkül maradt, törölve.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Sor-anatómia — read-only pipa a csík mellé, per-soros Toggle nélkül

**Files:**
- Modify: `frontend/src/features/me/pages/RutinHubPage.tsx:118-158` (`defRow`)
- Modify: `frontend/src/styles/prototype.css:9068` (`.rt-hrow` blokk)
- Test: `frontend/src/features/me/pages/RutinHubPage.test.tsx` (a `the per-definition toggle pauses that definition` teszt helyére)

**Interfaces:**
- Consumes: `HabitDefInfo`, `HabitItem` (`@/data/types`), `strength(key)` helper a lapon.
- Produces: `.rt-hrow` kétsoros rács `"n f" / "b b"` területekkel; a `.rt-tick` a read-only jelző (a `.gr-ck` helyett), a `.rt-bar` a második sor konténere. A grip a `SortableList` fogantyúja, a soron KÍVÜL marad.

- [ ] **Step 1: Írd meg a bukó teszteket**

Cseréld a `the per-definition toggle pauses that definition` tesztet erre a háromra:

```tsx
  test('the row carries a read-only tick beside the bar and no per-def toggle', () => {
    const { container } = renderPage()
    const row = screen.getByLabelText('Reggeli fény · szokás-láncolás · 28 napos erő 71%')
    expect(within(row).getByText('✓')).toBeInTheDocument()
    expect(row.closest('.row')).toHaveClass('rt-done')
    // a toggle a soron soha többé — a szüneteltetés a HabitPage-en él
    expect(screen.queryByLabelText('Napi szándék aktív')).toBeNull()
    expect(container.querySelector('.rt-hrow .rt-bar')).not.toBeNull()
  })

  test('a paused definition dims but stays tappable through to its habit page', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: [MORNING.defs[0], MORNING.defs[1], { ...MORNING.defs[2], isActive: false }] }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    useHabitDay.mockReturnValue({ habits: habitsToday.slice(0, 2) })
    renderPage()
    const paused = screen.getByLabelText('Hidratálás · keret nélkül')
    expect(paused.closest('.row')).toHaveClass('is-inert')
    expect(paused).not.toBeDisabled()
    fireEvent.click(paused)
    expect(navigate).toHaveBeenCalledWith('/me/rutin/szokas/water')
  })
```

A `the chain toggle pauses the whole chain`-szerű LÁNC-szintű toggle teszt (ha van) MARAD — a lánc-fejléc toggle-je nem változik. Ellenőrizd: `grep -n 'aktív' frontend/src/features/me/pages/RutinHubPage.test.tsx`.

- [ ] **Step 2: Futtasd, és nézd meg, hogy a HELYES okból bukik**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/RutinHubPage.test.tsx -t 'read-only tick'
```

Elvárt: FAIL — `expected null not to be null` a `.rt-bar`-ra, illetve a `queryByLabelText('Napi szándék aktív')` még talál toggle-t. (NEM `navigate is not defined`.)

- [ ] **Step 3: Írd át a `defRow`-t**

```tsx
  const defRow = (def: HabitDefInfo, item: HabitItem | undefined) => {
    const fw = frameworkKey(def.framework)
    const pct = strength(def.habitKey)
    const done = item?.status === 'done'
    return (
      // A prototípus .hrow kétsoros rácsa: "n f" / "b b". A grip a SortableList fogantyúja,
      // a soron kívül. A per-def Toggle ELTŰNT — szüneteltetni a HabitPage-en lehet, ezért a
      // szünetelő sor halványul, de tapphatóan odanavigál (mezo-3zue.4 hibahulláma).
      <div className={cn('row', !def.isActive && 'is-inert', done && 'rt-done')} style={{ alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className={cn('rt-hrow', newHabitKey === def.habitKey && 'rt-row-new')}
          style={{ flex: 1, minWidth: 0 }}
          onClick={() => navigate(`/me/rutin/szokas/${def.habitKey}`)}
          aria-label={`${def.title} · ${FRAMEWORK_LABEL[fw]}${pct != null ? ` · 28 napos erő ${pct}%` : ''}`}
        >
          <span className="rt-nm">{def.title}</span>
          <span className={cn('rt-fw', `rt-fw-${fw.toLowerCase()}`)}>{FRAMEWORK_BADGE[fw]}</span>
          <span className="rt-bar">
            {/* READ-ONLY jelző, nem kontroll: a pipálás a /nap/rutin-on él (ADR). */}
            <span className="rt-tick" aria-hidden="true">✓</span>
            {item && <span className="sr-only">{STATUS_SR[item.status]}</span>}
            {pct != null && (
              <>
                <span className="rt-strength" aria-hidden="true">
                  <div style={{ width: `${pct}%` }} />
                </span>
                <span className="rt-strength-n">{pct}%</span>
              </>
            )}
          </span>
        </button>
      </div>
    )
  }
```

A `Toggle` import maradjon (a lánc-fejléc még használja), a `gr-chainrow` osztály viszont eltűnik a def-sorról — a `pastRow` továbbra is használja, ne töröld a CSS-ből.

- [ ] **Step 4: Vágd át a `.rt-hrow` CSS-blokkot**

A `prototype.css` `Rutin hub — framework badge...` blokkjában cseréld a `.rt-hrow { cursor: pointer; }` sort erre (prototípus `rutin-epito-head.html` `.hrow` ×1.18: 11px→13px név, 7px→8.3px oszlopköz, 3px→3.5px sorköz, 14px→16.5px tick):

```css
.rt-hrow {
  display: grid; grid-template-columns: 1fr auto; grid-template-areas: "n f" "b b";
  column-gap: 8.3px; row-gap: 3.5px; align-items: center;
  width: 100%; padding: 8px 2px; cursor: pointer; text-align: left;
  border: none; background: none; font-family: inherit; color: var(--mz-ink);
}
.rt-hrow + .rt-hrow, .row + .row > .rt-hrow { border-top: 0.5px solid var(--mz-line-soft); }
.rt-nm { grid-area: n; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-hrow .rt-fw { grid-area: f; }
.rt-bar { grid-area: b; display: flex; align-items: center; gap: 7px; }
.rt-tick {
  width: 16.5px; height: 16.5px; border-radius: 50%; flex: none; display: grid; place-items: center;
  font-size: 9.5px; border: 1.4px solid var(--mz-line); color: transparent;
}
.rt-done .rt-tick { background: var(--gradient-sage); border-color: transparent; color: #fff; }
.rt-done .rt-strength div { background: var(--gradient-sage); }
```

A `.rt-strength` `max-width: 64px` korlátját töröld — a második sorban a csík `flex: 1` teljes szélességű a prototípus szerint. A régi `.gr-chainrow.done .rt-strength div` szabályt töröld (helyette `.rt-done`).

- [ ] **Step 5: Futtasd a teszteket**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/RutinHubPage.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts
```

Elvárt: PASS. Ha a `never renders a tick control` teszt bukik, olvasd el: az a `role="checkbox"`/kattintható tick hiányát állítja — a `.rt-tick` `<span aria-hidden>`, tehát át kell mennie. Ha mégis a `✓` szövegre matchel, szűkítsd a teszt lekérdezését `queryByRole`-ra, ne a jelzőt vedd ki.

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && git add frontend/src/features/me/pages/RutinHubPage.tsx frontend/src/features/me/pages/RutinHubPage.test.tsx frontend/src/styles/prototype.css && git commit -F - <<'EOF'
fix(me): prototípus-hű szokás-sor — read-only pipa, per-soros toggle nélkül (mezo-3zue.10)

A .hrow kétsoros rács ("n f" / "b b"): név + keret-chip, alatta pipa + erő-csík + %.
A per-def Toggle kikerül; szüneteltetni a HabitPage-en lehet, a szünetelő sor
halványul, de tapphatóan odanavigál. A pipa read-only jelző — ticket a /nap/rutin ad.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: A ▲▼ átrendező gombok csak billentyű-fókuszra láthatók

**Files:**
- Modify: `frontend/src/shared/ui/SortableList.tsx:118-185`
- Modify: `frontend/src/styles/prototype.css` (új `.srt-chev*` szabályok a Rutin hub blokk mellé)
- Modify: `frontend/src/features/me/pages/RutinHubPage.tsx:184-189` (`SortableList` hívás)
- Test: `frontend/src/shared/ui/SortableList.test.tsx` (ha nincs, hozd létre a meglévő teszt-idióma szerint — `ls frontend/src/shared/ui/SortableList.test.tsx`)

**Interfaces:**
- Produces: `SortableList` új opcionális propja — `chevrons?: 'always' | 'focus'` (alapértelmezés `'always'`, azaz minden meglévő fogyasztó változatlan). `'focus'` esetén a ▲▼ konténer osztálya `srt-chev srt-chev-focus`, egyébként `srt-chev`.
- Consumes: semmit a korábbi feladatokból.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `SortableList.test.tsx`-ben (a fájl meglévő render-helperét használva):

```tsx
  test('chevrons="focus" hides the reorder buttons visually but keeps them focusable', () => {
    const { container } = renderList({ chevrons: 'focus' })
    const chev = container.querySelector('.srt-chev') as HTMLElement
    expect(chev).toHaveClass('srt-chev-focus')
    // a gombok az a11y fában maradnak — csak CSS rejti őket
    expect(within(chev).getByRole('button', { name: /feljebb/i })).toBeInTheDocument()
  })

  test('the default keeps the chevrons visible', () => {
    const { container } = renderList()
    expect(container.querySelector('.srt-chev')).not.toHaveClass('srt-chev-focus')
  })
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy a HELYES okból bukik**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/shared/ui/SortableList.test.tsx
```

Elvárt: FAIL — `.srt-chev` nincs a DOM-ban (`received: null`), NEM típushiba a `chevrons` propra (az `tsc -b` szintje, nem a vitesté).

- [ ] **Step 3: Implementáld a propot**

A `SortableList.tsx`-ben vidd végig a propot a `SortableList` → `SortableRow` láncon (a `disabled` prop mintájára), és a ▲▼ konténeren:

```tsx
      <div className={cn('row gap-sm', 'srt-chev', chevrons === 'focus' && 'srt-chev-focus')} style={{ alignItems: 'center' }}>
```

A `cn` import a `@/shared/lib/cn`-ből. A `SortableListProps`/`SortableRowProps` típusba: `chevrons?: 'always' | 'focus'`, és a `SortableList` alapértelmezése `chevrons = 'always'`.

- [ ] **Step 4: Írd meg a CSS-t**

A `prototype.css` Rutin hub blokkja mellé:

```css
/* A ▲▼ átrendező gombok a11y-affordanciák: a prototípus .hrow-ján nincsenek, ezért
   alapból nem foglalnak helyet, és csak billentyű-fókuszra jelennek meg. Rejtve is az
   a11y fában maradnak (nincs display:none / visibility:hidden). */
.srt-chev-focus { width: 0; overflow: hidden; opacity: 0; transition: opacity 0.15s ease; }
.srt-chev-focus:focus-within { width: auto; overflow: visible; opacity: 1; }
```

- [ ] **Step 5: Kapcsold be a lapon**

A `RutinHubPage.tsx` `SortableList` hívásához add hozzá: `chevrons="focus"`.

- [ ] **Step 6: Futtasd a teszteket**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/shared/ui/SortableList.test.tsx src/features/me/pages/RutinHubPage.test.tsx && pnpm exec tsc -b
```

Elvárt: PASS mindkét fájlban (a hub `reorder sends every definition id` tesztje továbbra is a `/lejjebb/i` gombon megy — a gomb létezik, csak vizuálisan rejtett), és a `tsc -b` hibátlan.

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && git add frontend/src/shared/ui/SortableList.tsx frontend/src/shared/ui/SortableList.test.tsx frontend/src/styles/prototype.css frontend/src/features/me/pages/RutinHubPage.tsx && git commit -F - <<'EOF'
feat(ui): SortableList chevrons="focus" — a ▲▼ gombok csak fókuszra látszanak (mezo-3zue.10)

A prototípus sorában a sorrend a grippel megy, chevron nincs. A billentyűs
átrendezés viszont az a11y-minimum, ezért a gombok a fában maradnak, és csak
:focus-within-re jelennek meg. Alapértelmezés változatlan ('always').

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Lánc-fejléc — csak erő %, és a záró elvi mondat

**Files:**
- Modify: `frontend/src/features/me/pages/RutinHubPage.tsx:169-180` (`todayCard` fejléc-chip), `:231` (`PageBody principle`)
- Test: `frontend/src/features/me/pages/RutinHubPage.test.tsx`

**Interfaces:**
- Consumes: a `todayCard` meglévő `avg` deriváltja (a lánc def-jeinek átlagereje).
- Produces: `.gr-band-chip` tartalma `erő {avg}%` vagy semmi; a `pastCard` fejléce változatlanul `{kész} / {összes}`.

- [ ] **Step 1: Írd meg a bukó teszteket**

```tsx
  test('the chain head shows only the chain strength, not today\'s done/total', () => {
    renderPage()
    const morning = screen.getByText('Reggeli rutin').closest('.gr-chain') as HTMLElement
    expect(within(morning).getByText('erő 71%')).toBeInTheDocument()
    expect(within(morning).queryByText(/1 \/ 3/)).toBeNull()
  })

  test('a chain with no strength data shows no chip at all (honesty rule)', () => {
    renderPage()
    const evening = screen.getByText('Esti rutin').closest('.gr-chain') as HTMLElement
    expect(evening.querySelector('.gr-band-chip')).toBeNull()
  })

  test('closes with the prototype principle sentence', () => {
    renderPage()
    expect(screen.getByText(/A logolás maga a jutalom/)).toBeInTheDocument()
    expect(screen.getByText(/a sor a szerkesztőt nyitja/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy a HELYES okból bukik**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/RutinHubPage.test.tsx -t 'chain head'
```

Elvárt: FAIL — `Unable to find an element with the text: erő 71%`, mert a chip ma `1 / 3 · erő 71%`.

- [ ] **Step 3: Írd át a chipet és az elvi mondatot**

A `todayCard` fejlécében a chip:

```tsx
          {/* A prototípus .pw-je: a lánc EREJE. A napi kész/összes a heróban és a múltnapi
              summában él — a hub nem napi teljesítés-felület. */}
          {avg != null && (
            <span className={cn('gr-band-chip', chain.daypart === 'EVENING' ? 'lav' : 'warn')}>erő {avg}%</span>
          )}
```

A `PageBody principle`:

```tsx
      <PageBody principle="Egyszerre egy szokás. A logolás maga a jutalom: a csík minden pipával emelkedik, egy kihagyás nem nullázza — csak halványítja. A pipa a Nap tabon él, itt a sor a szerkesztőt nyitja.">
```

A `pastCard` fejléce VÁLTOZATLAN marad (`{doneOf(items)} / {items.length}`).

Ha a `doneOf`/`items` a `todayCard`-ban ezzel fogyasztó nélkül marad, a TypeScript `noUnusedLocals` jelezni fogja — akkor töröld az érintett sort, de a `items` a `defRow` státusz-overlayéhez KELL, ne dobd ki.

- [ ] **Step 4: Futtasd a teszteket**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/RutinHubPage.test.tsx && pnpm exec tsc -b
```

Elvárt: PASS + hibátlan `tsc -b`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && git add frontend/src/features/me/pages/RutinHubPage.tsx frontend/src/features/me/pages/RutinHubPage.test.tsx && git commit -F - <<'EOF'
fix(me): csendes lánc-fejléc + a prototípus záró elvi mondata (mezo-3zue.10)

A fejléc-chip a prototípus .pw-je szerint már csak a lánc erejét viszi (adat híján
elmarad); a napi kész/összes a heróban és a múltnapi summában marad. A PageBody
elvi mondata a prototípus .habnote-ja, szó szerint.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Teljes FE kapu mindkét módban

**Files:** nincs változtatás — ez a kapu.

- [ ] **Step 1: Mock mód**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=true pnpm test
```

Elvárt: minden zöld. Ha a `RitualPage` / `EnHubPage` / `NapRutinPage` tesztje bukik, az a `.gr-ck` vagy a `Toggle` eltűnésének kereszthatása — javítsd a HÍVÓ tesztet csak akkor, ha a viselkedés szándékosan változott; egyébként a lapot javítsd.

- [ ] **Step 2: Valós mód**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && VITE_USE_MOCK=false pnpm test
```

Elvárt: minden zöld.

- [ ] **Step 3: Típusok + build**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && pnpm exec tsc -b && pnpm build
```

Elvárt: hibátlan.

- [ ] **Step 4: Ha bármi javításra szorult, commitold**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && git add -A && git commit -F - <<'EOF'
test(me): a rutin hub újravágásának kereszthatásai (mezo-3zue.10)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Vizuális goldenek újrabaseline-ja

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts-snapshots/me-rutinok-{light,dark}-{darwin,linux}.png`

- [ ] **Step 1: Nézd meg a lapot élesben, mielőtt goldent írsz**

Kövesd a `verify` skillt (mock módú PWA indítás + navigálás a `/me/rutin`-ra), és vizuálisan hasonlítsd össze a `docs/design_2.0/prototypes/src/rutin-epito-body.html` `#pg-rutin` szekciójával. Amit ellenőrizz: három statcella, kétsoros sorok pipával, chevronok nem látszanak, lánc-chip csak erő %, záró mondat a lap alján, napnavigátor a statstrip alatt.

- [ ] **Step 2: darwin goldenek**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity/frontend && pnpm test:visual:update
```

Elvárt: a `me-rutinok-{light,dark}-darwin.png` frissül. Nézd meg a diffet szemmel (`git diff --stat` + a kép megnyitása), és győződj meg róla, hogy CSAK a rutin hub változott — ha más képernyő is mozdult, az regresszió.

- [ ] **Step 3: Commit a darwin goldeneket**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && git add frontend/tests/visual && git commit -F - <<'EOF'
test(visual): rutin hub goldenek újrabaseline (darwin) (mezo-3zue.10)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
git push -u origin feat/rutin-hub-fidelity
```

- [ ] **Step 4: linux goldenek a CI-ban**

```bash
gh workflow run update-visual-baselines.yml -r feat/rutin-hub-fidelity
```

Várd meg a futást (`gh run list --workflow=update-visual-baselines.yml -L 3`), majd húzd le az általa pusholt commitot: `git pull --rebase`.

---

### Task 7: Doksi + bd + PR

**Files:**
- Modify: `docs/features/habit.md` (front-matter `updated:`, §2, §9, §10)
- Modify: `docs/features/_platform-design-system.md` (`SortableList` `chevrons` mód)
- Modify: `docs/design_2.0/prototypes/src/rutin-epito-body.html` (`#pg-rutin` komment), `docs/design_2.0/2026-09-02-rutin-epito-design-iterations.md` (záró jegyzet)

- [ ] **Step 1: `habit.md`**

§2 `/me/rutin` blokkjában: a „két 30 cellás counter tile" leírását cseréld a három cellás statstripre (tökéletes reggel/este · 30 n + aktív szokás mint FE-derivált); a sor-anatómiánál rögzítsd, hogy a sor kétsoros, read-only pipát visel, és **nincs rajta toggle** — a szüneteltetés útja a `/me/rutin/szokas/{habitKey}`; a napnavigátornál jegyezd meg, hogy ez a prototípus tudatosan elfogadott bővítése. §9-ben a mock-erő gotcha szövegében a covtile-hivatkozást igazítsd a statstriphez. §10-ben a FE-UI sorból vedd ki a `.gr-covtile` említést. A front-matter `updated:` legyen `2026-09-04`.

- [ ] **Step 2: `_platform-design-system.md`**

A `SortableList` bejegyzéséhez egy sor: a `chevrons="focus"` mód (a ▲▼ gombok a11y-ban maradnak, vizuálisan `:focus-within`-ig rejtve), első fogyasztó a Rutin hub. A `DayNavigator` sora VÁLTOZATLAN — a primitív fogyasztója marad a `RutinHubPage`.

- [ ] **Step 3: Prototípus + design-iterations jegyzet**

A `rutin-epito-body.html` `#pg-rutin` szekciójába a statstrip után egy HTML-komment:

```html
            <!-- ELFOGADOTT BŐVÍTÉS (mezo-3zue.10, 2026-09-04): a shipped hubon itt áll a
                 napnavigátor (‹ Ma ›) + a múltnapi read-only nézet. A prototípus nem fedte le,
                 de valódi funkció, és a hub az egyetlen felület, ami múltnapi szokás-böngészést
                 kínál (mezo-x9c2 gazdafelülete). -->
```

A design-iterations doc végére egy rövid „2026-09-04 — fidelity-kör (mezo-3zue.10)" szakasz: mi vágódott újra, és a két bevallott eltérés (napnavigátor; a ▲▼ gombok mint fókusz-rejtett a11y-affordancia).

- [ ] **Step 4: Doc-lint + codemap**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && node scripts/lint-docs.mjs --errors-only && node scripts/gen-codemap.mjs && git status --porcelain
```

Elvárt: a lint PASS (0 error). A codemap generálás után a `docs/CODEMAP.md` nem változhat (nem született új fájl) — ha mégis, commitold vele.

- [ ] **Step 5: bd — `mezo-11nm` hatókör-szűkítés**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && bd comment mezo-11nm --body-file - <<'EOF'
Hatókör szűkül (mezo-3zue.10, 2026-09-04): a /me/rutin hubról eltűntek a 30 cellás
covtile-ok, helyükön három aggregált statcella áll. A napi bitek + perfectStreak igény
így már NEM blokkolja a hubot; ha valaha becsületes 30 napos rácsot akarunk, az egy
külön felület (napnavigátor-mélység vagy per-szokás detail) kérdése lesz.
EOF
EOF
```

(A `bd` hívásnak átadott szövegben kerüld a verziókezelő nevét és a parancs-behelyettesítést — a worktree-guard különben visszautasítja a hívást; a heredoc + `--body-file -` alak megy.)

- [ ] **Step 6: Commit + push**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && git add docs .beads && git commit -F - <<'EOF'
docs(habit): a rutin hub újravágásának dokumentálása (mezo-3zue.10)

habit.md §2/§9/§10 a statstriphez és a toggle nélküli sorhoz; a prototípus
#pg-rutin szekciója megjelöli a napnavigátort elfogadott bővítésként; a
design-iterations doc záró jegyzete rögzíti a két bevallott eltérést.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
git push
```

- [ ] **Step 7: Self-PR — a CI a hiteles kapu**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/rutin-hub-fidelity && gh pr create --title "fix(me): Rutin hub prototípus-hűségi újravágás (mezo-3zue.10)" --body-file - <<'EOF'
A `/me/rutin` vizuálisan az elfogadott `#pg-rutin` prototípusra vágva.

- statstrip (tökéletes reggel/este · 30 n + aktív szokás) a két 30 cellás covtile helyett
- kétsoros szokás-sor: név + keret-chip / read-only pipa + erő-csík + %; per-soros toggle nélkül
- lánc-fejléc: csak a lánc ereje
- záró elvi mondat a prototípus `.habnote`-jából

**Bevallott eltérések a prototípustól** (mindkettő döntés, nem csúszás):
1. A napnavigátor marad a hubon — valódi funkció, a prototípus nem fedte le, más felület nem kínálja.
2. A `SortableList` ▲▼ gombjai megmaradnak a11y-affordanciaként, de csak `:focus-within`-re láthatók.

Spec: `docs/superpowers/specs/2026-09-04-rutin-hub-fidelity-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 8: CI zöld → merge → zárás**

```bash
gh pr checks --watch
```

Zöld után (worktree-izolált sessionben a helyi `--no-ff` merge nem járható, a `gh` merge topológiája azonos):

```bash
gh pr merge <n> --merge
```

Külön parancsban, a merge tényének ellenőrzése (`gh pr view <n> --json state,mergeCommit`) UTÁN:

```bash
git push origin --delete feat/rutin-hub-fidelity
```

Végül: `bd close mezo-3zue.10`, `bd dolt push`, és a worktree eltakarítása.
