# Hub-csempe átszervezés (Mezo↔Én + Beállítások oldal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move AI-related tiles (Karakter) to the Mezo hub, shrink the Én hub to personal tiles + a new Beállítások tile, and promote Beállítások from a theme-only sheet to a real page hosting Téma + Értesítések + AI-napló entries.

**Architecture:** Pure frontend change. Pages stay on their stable routes ("stable full-page siblings" idiom); only tile JSX + the hook-derived bottom lines move between the two hardcoded hub mosaics. One new page (`BeallitasokPage`) + one new route (`me/beallitasok`); `SettingsSheet` is deleted (content absorbed by the page).

**Tech Stack:** React + react-router, vitest + @testing-library, Mozaik UI primitives (`MozaikPage`, `PageHead`, `PageHero`, `PageBody`, `Mosaic`, `Tile`), `styles/prototype.css`.

**Spec:** `docs/superpowers/specs/2026-09-01-hub-tile-reorg-design.md`

## Global Constraints

- Honest states: a tile/row bottom line is `undefined` (renders nothing) while its source is unresolved/empty — no fabricated numbers, ever.
- Hungarian copy, no i18n framework — tests assert the literal Hungarian strings.
- FE tests must pass in BOTH modes: `VITE_USE_MOCK=true` and `VITE_USE_MOCK=false` (MSW). Bare `pnpm test` with the var unset runs mock twice — always set it explicitly.
- All frontend commands run from `frontend/`: `pnpm vitest run <paths>`, full gate `VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build` + lint.
- Any new/deleted page file ⇒ `node scripts/gen-codemap.mjs` in the same change (CI checks with `--check`).
- Conventional commits carrying the driving bd id (created in Task 1, referred to below as `<BD-ID>`).
- No backend / contract work.

---

### Task 1: BeallitasokPage + route

**Files:**
- Create: `frontend/src/features/me/pages/BeallitasokPage.tsx`
- Create: `frontend/src/features/me/pages/BeallitasokPage.test.tsx`
- Modify: `frontend/src/app/router.tsx` (me/* block, around line 280)

**Interfaces:**
- Consumes: `useTheme()` from `@/app/ThemeProvider` (`{ mode, setMode }`, `ThemeMode = 'light'|'dark'|'auto'`); `useNotificationPrefs()` / `useLlmUsageSummary()` from `@/data/hooks`; `formatRollupCost` from `@/features/me/logic/llmCallFormat`; Mozaik primitives from `@/shared/ui/mozaik`.
- Produces: `BeallitasokPage` component exported by name; route `me/beallitasok`. Task 2's Beállítások tile navigates here.

- [ ] **Step 0: bd issue + status check**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-en-menu-reorganize-e85846
bd create "Hub-csempe átszervezés: Mezo↔Én + Beállítások oldal" -d "Spec: docs/superpowers/specs/2026-09-01-hub-tile-reorg-design.md" -p 1
# note the returned id — use it as <BD-ID> in every commit subject
bd update <BD-ID> --claim
git status   # expect: clean, on branch claude/mezo-en-menu-reorganize-e85846
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/me/pages/BeallitasokPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BeallitasokPage } from '@/features/me/pages/BeallitasokPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Beállítások oldal — a korábbi téma-only SettingsSheet utódja (hub-tile-reorg spec).
// Csoportosított lista: Téma választó helyben + Értesítések / AI-napló sorok, amelyek a
// meglévő oldalakra navigálnak. A téma-viselkedés a sheet-teszt kontraktusának portja.

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.setItem('mezo-theme', 'light')
})
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/me/beallitasok']}>
          <>
            <Routes>
              <Route path="/me/beallitasok" element={<BeallitasokPage />} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('a Téma választó helyben él az oldalon és átbillenti a data-theme-et', async () => {
  renderPage()
  expect(await screen.findByText('Téma')).toBeInTheDocument()
  // Manual light => no attribute (light is the CSS base); choosing Sötét flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Sötét/ }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('az Értesítések sor a kapcsolók oldalára navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Értesítések' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek/beallitasok')
})

test('az AI-napló sor az AI-napló oldalra navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'AI-napló' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ai-usage')
})

test('a vissza-chip az Én hubra visz', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('loc')).toHaveTextContent(/^\/me$/)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/me/pages/BeallitasokPage.test.tsx
```
Expected: FAIL — cannot resolve `@/features/me/pages/BeallitasokPage`.

- [ ] **Step 3: Write the page**

Create `frontend/src/features/me/pages/BeallitasokPage.tsx`:

```tsx
// ============================================================
// Mezo · BeallitasokPage — Beállítások (hub-tile-reorg spec, <BD-ID>)
// A korábbi téma-only SettingsSheet utódja: az Én hub Beállítások csempéje
// nyitja. Csoportosított lista (Android settings-guideline minta): Téma
// választó helyben (useTheme — az egyetlen perzisztált beállítás) + a ritkán
// használt felületek sorai (Értesítések kapcsolói, AI-napló). Nincs saját
// design_2.0 prototípus — a Mozaik oldal-primitívekből épül.
// Honest states: a sor-alsósor eltűnik, amíg a forrása nem mond semmit.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLlmUsageSummary, useNotificationPrefs } from '@/data/hooks'
import { formatRollupCost } from '@/features/me/logic/llmCallFormat'
import { useTheme } from '@/app/ThemeProvider'
import type { ThemeMode } from '@/shared/lib/theme'

const THEME_OPTIONS: { key: ThemeMode; icon: 'sun' | 'moon' | 'sparkle'; label: string; desc: string }[] = [
  { key: 'light', icon: 'sun', label: 'Világos', desc: 'Mindig nappali felület' },
  { key: 'dark', icon: 'moon', label: 'Sötét', desc: 'Mindig sötét felület' },
  { key: 'auto', icon: 'sparkle', label: 'Cirkadián', desc: 'Este a tompítással (lefekvés −90 p) sötétre vált, ébredés előtt 30 perccel vissza világosra. Az alváscélodat követi.' },
]

export function BeallitasokPage() {
  const navigate = useNavigate()
  const { mode, setMode } = useTheme()

  // Row bottom lines — the exact derivations the Én hub tiles carried (honest states).
  const { prefs, isPending: prefsPending } = useNotificationPrefs()
  const enabledPrefs = prefs.filter((p) => p.enabled).length
  const ertesitesLine = prefsPending || prefs.length === 0
    ? undefined
    : `${enabledPrefs} / ${prefs.length} kategória`

  const { data: llm, isPending: llmPending } = useLlmUsageSummary()
  const aiLine = llmPending
    ? undefined
    : `${llm.week.callCount} hívás · ${formatRollupCost(llm.week.costUsd)} / hét`

  const row = (icon: 'i-ertesites' | 'i-erme', label: string, line: string | undefined, to: string) => (
    <button type="button" className="card row" aria-label={label} onClick={() => navigate(to)}
      style={{ justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left' }}>
      <div className="row gap-md" style={{ alignItems: 'center' }}>
        <ClayIcon name={icon} size={28} />
        <div className="col">
          <span>{label}</span>
          {line != null && <span style={SECTION_LABEL}>{line}</span>}
        </div>
      </div>
      <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>›</span>
    </button>
  )

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me')} label="‹ Én" />
      <PageHero icon="i-beallitas" name="Beállítások" sub="téma · értesítések · AI-napló" />
      <PageBody>
        <EntranceGroup className="col gap-lg">
          <div className="col gap-sm rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <span style={SECTION_LABEL}>Téma</span>
            <div className="col gap-sm">
              {THEME_OPTIONS.map((o) => (
                <button key={o.key} className="card row" aria-pressed={mode === o.key}
                  onClick={() => setMode(o.key)}
                  style={{
                    justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left',
                    borderColor: mode === o.key ? 'var(--lav-deep)' : 'var(--border-subtle)',
                    background: mode === o.key ? 'var(--wash-lav)' : undefined,
                  }}>
                  <div className="row gap-md" style={{ alignItems: 'flex-start' }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: mode === o.key ? 'var(--wash-lav)' : 'var(--surface-2)' }}>
                      <Icon name={o.icon} size={16} color={mode === o.key ? 'var(--lav-deep)' : 'var(--text-tertiary)'} />
                    </span>
                    <div className="col">
                      <span>{o.label}</span>
                      <span style={SECTION_LABEL}>{o.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="col gap-sm rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            <span style={SECTION_LABEL}>Felületek</span>
            {row('i-ertesites', 'Értesítések', ertesitesLine, '/me/ertesitesek/beallitasok')}
            {row('i-erme', 'AI-napló', aiLine, '/me/ai-usage')}
          </div>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

Note: the theme-selector JSX is a verbatim port of `SettingsSheet.tsx:37-59` (the sheet is deleted in Task 2). If `ClayIcon`'s name union rejects a literal, check `frontend/src/shared/ui/clay/index.tsx:17` — both `i-ertesites` and `i-erme` are registered there.

- [ ] **Step 4: Wire the route**

In `frontend/src/app/router.tsx`, add the import next to the other me-page imports, and insert after the `me/ertesitesek/beallitasok` line (~285):

```tsx
      // Beállítások oldal (hub-tile-reorg): az Én hub Beállítások csempéjének célja —
      // Téma helyben + az Értesítések-kapcsolók és az AI-napló ajtajai.
      { path: 'me/beallitasok', element: <BeallitasokPage /> },
```

- [ ] **Step 5: Run tests both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/BeallitasokPage.test.tsx && VITE_USE_MOCK=false pnpm vitest run src/features/me/pages/BeallitasokPage.test.tsx
```
Expected: PASS ×2. (The page reads only hook data already MSW-fixtured for the Én hub; if a real-mode fixture gap surfaces, the lines legitimately render nothing — the tests do not assert line content.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me/pages/BeallitasokPage.tsx frontend/src/features/me/pages/BeallitasokPage.test.tsx frontend/src/app/router.tsx
git commit -m "feat(fe): Beállítások oldal — téma + értesítések + AI-napló sorok (<BD-ID>)"
```

---

### Task 2: Én hub reshuffle — 6 tiles, band → tile, SettingsSheet deleted

**Files:**
- Modify: `frontend/src/features/me/pages/EnHubPage.tsx`
- Modify: `frontend/src/features/me/pages/EnHubPage.test.tsx`
- Delete: `frontend/src/features/me/sheets/SettingsSheet.tsx`, `frontend/src/features/me/sheets/SettingsSheet.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (remove `.enh-band` rules)

**Interfaces:**
- Consumes: route `me/beallitasok` from Task 1.
- Produces: Én hub = Súly · Alvás · Growth · Napló · Emberek · Beállítások (6 tiles). The Heti/Tudás/Karakter/Értesítés/AI-napló tiles and the band are gone. (Task 3 re-homes Karakter on the Mezo hub; the karakterLine derivation to copy is preserved in this task's diff history and repeated verbatim in Task 3.)

- [ ] **Step 1: Update the tests first**

In `frontend/src/features/me/pages/EnHubPage.test.tsx`:

1. Delete the `MOCK_OVERVIEW`/`MOCK_OVERVIEW_EMPTY`/`CharacterOverviewResponse` imports (lines 7–8), the `characterStore` hoisted store (32–34), the `useCharacterOverview` stub inside `vi.mock` (line 64), and `characterStore.overview = MOCK_OVERVIEW` in `beforeEach` (line 75).
2. Replace BOTH tile lists (the `TILES` arrays at lines 186–197 and 208–219) with:

```tsx
  const TILES: [string, string][] = [
    ['Súly', '/me/weight'],
    ['Alvás', '/me/sleep'],
    ['Growth', '/me/growth'],
    ['Napló', '/me/naplo'],
    ['Emberek', '/me/people'],
    ['Beállítások', '/me/beallitasok'],
  ]
```

Rename the two tests to `'the mosaic carries the six tiles and each opens its own page'` and `'a hat csempe mindegyike a saját oldalára navigál'`.
3. Delete the three Karakter tile tests (lines 242–264) — Task 3 ports them to `MezoHubPage.test.tsx`.
4. Replace the `'the Beállítások band opens the theme sheet…'` test (lines 266–276) with:

```tsx
test('a Beállítások csempe a témát mutatja és a Beállítások oldalra navigál', async () => {
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Beállítások' })
  expect(tile).toHaveTextContent('téma: világos')
  await userEvent.click(tile)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/beallitasok')
})
```

5. Update the file-header comment: `10-tile mosaic + Beállítások band` → `6-tile mosaic (Beállítások csempével)`.

- [ ] **Step 2: Run to verify the new assertions fail**

```bash
cd frontend && pnpm vitest run src/features/me/pages/EnHubPage.test.tsx
```
Expected: FAIL — the six-tile list finds the removed tiles still present / no `/me/beallitasok` navigation.

- [ ] **Step 3: Rework EnHubPage.tsx**

1. Imports: remove `useCharacterOverview`, `useKnowledge`, `useLlmUsageSummary`, `useMeWeek`, `useNotificationPrefs` from the `@/data/hooks` import; remove the `mondayIso`, `SettingsSheet`, `formatRollupCost`, `isDossierEmpty` imports.
2. Sheet state: `useState<'settings' | 'biometric' | 'energy' | null>` → `useState<'biometric' | 'energy' | null>`; delete the `{sheet === 'settings' && <SettingsSheet …/>}` line (296).
3. Delete the line-derivation blocks that fed the removed tiles: `hetiLine` (147–155), `tudasLine` (192–195), `ertesitesLine` (197–201), `aiLine` (203–206), `karakterLine` + its comment block (208–218). Keep `sulyLine`, `alvasLine`, `growthLine`, `naploLine`, `emberekLine`, and keep `rate` (goal card uses it).
4. Replace the mosaic (264–285) with:

```tsx
        {/* ===== 6-tile mosaic ===== */}
        <Mosaic>
          <Tile wash="sky" icon="i-suly" eyebrow="Súly" delayMs={130} className="enh-eb-sky"
            line={sulyLine} onClick={() => navigate('/me/weight')} aria-label="Súly" />
          <Tile wash="lav" icon="i-alvas" eyebrow="Alvás" delayMs={170} className="enh-eb-lav"
            line={alvasLine} onClick={() => navigate('/me/sleep')} aria-label="Alvás" />
          <Tile wash="lav" icon="i-growth" eyebrow="Growth" delayMs={210} className="enh-t-minta enh-eb-lav"
            line={growthLine} onClick={() => navigate('/me/growth')} aria-label="Growth" />
          <Tile wash="white" icon="i-naplo" eyebrow="Napló" delayMs={250} className="enh-t-kreed enh-eb-coral"
            line={naploLine} onClick={() => navigate('/me/naplo')} aria-label="Napló" />
          <Tile wash="rose" icon="i-emberek" eyebrow="Emberek" delayMs={290} className="enh-eb-rose"
            line={emberekLine} onClick={() => navigate('/me/people')} aria-label="Emberek" />
          <Tile wash="sage" icon="i-beallitas" eyebrow="Beállítások" delayMs={330} className="enh-eb-sage"
            line={`téma: ${THEME_LABEL[themeMode]}`} onClick={() => navigate('/me/beallitasok')} aria-label="Beállítások" />
        </Mosaic>
```

5. Delete the Beállítások band block (287–293). `THEME_LABEL` and `useTheme` stay (the tile line reads them). `ClayIcon` import: delete only if no other use remains in the file (the streak/coin stats still use it — keep).
6. Update the file-header comment (lines 9–11): `the 10-tile mosaic … → the Beállítások band opening the existing SettingsSheet (theme only)` → `the 6-tile mosaic with live bottom lines — Beállítások is a tile opening /me/beallitasok (hub-tile-reorg: the AI tiles moved to the Mezo hub, Értesítés + AI-napló under Beállítások)`.
7. Delete `frontend/src/features/me/sheets/SettingsSheet.tsx` and `SettingsSheet.test.tsx` (`git rm`). Verify no import remains: `grep -rn "sheets/SettingsSheet" frontend/src` → no hits (FuelSettingsSheet is a different file and stays).
8. In `frontend/src/styles/prototype.css`: delete the `.enh-band` rule block (~5411–5419) and shrink line 5423 `.enh-goalcard, .enh-band { transition: none; }` → `.enh-goalcard { transition: none; }`.

- [ ] **Step 4: Run tests both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me src/shared/ui/mozaik && VITE_USE_MOCK=false pnpm vitest run src/features/me/pages/EnHubPage.test.tsx src/features/me/pages/BeallitasokPage.test.tsx
```
Expected: PASS (including the CSS structure/token guards). `navigation.test.tsx` still fails at this point — it clicks Karakter on the Én hub; Task 3 fixes it. Verify only that failure is the known one:

```bash
cd frontend && pnpm vitest run src/app/navigation.test.tsx
```
Expected: exactly one failure — `'the Én hub links to the Karakter dossier hub'`.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/me frontend/src/styles/prototype.css
git commit -m "feat(fe): Én hub 6 csempére szűkül — Beállítások csempe, sáv + SettingsSheet törölve (<BD-ID>)"
```

---

### Task 3: Mezo hub — Karakter wide tile + navigation tests

**Files:**
- Modify: `frontend/src/features/insights/pages/MezoHubPage.tsx`
- Modify: `frontend/src/features/insights/pages/MezoHubPage.test.tsx`
- Modify: `frontend/src/app/navigation.test.tsx` (~line 75)
- Modify: `frontend/src/styles/prototype.css` (extend the wide-tile selector)

**Interfaces:**
- Consumes: `useCharacterOverview()` from `@/data/hooks` (`{ overview: CharacterOverviewResponse | null }`); `isDossierEmpty(overview)` from `@/features/character/dossierState`; mock seeds `MOCK_OVERVIEW`, `MOCK_OVERVIEW_EMPTY` from `@/data/character/characterMock`.
- Produces: Mezo hub carries a full-width Karakter tile (aria-label `Karakter`) → `/me/karakter`, with the avg-CORE-maturity line under the same `isDossierEmpty` predicate the Én hub used.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/features/insights/pages/MezoHubPage.test.tsx`:

1. Add a hook-boundary stub (NapHubPage.test idiom) above `renderHub` — only `useCharacterOverview` is overridden, everything else stays the real dual-mode hook:

```tsx
import { MOCK_OVERVIEW, MOCK_OVERVIEW_EMPTY } from '@/data/character/characterMock'
import type { CharacterOverviewResponse } from '@/data/character/characterApi'

const characterStore = vi.hoisted(() => ({
  overview: null as unknown as CharacterOverviewResponse | null,
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterOverview: () => ({ overview: characterStore.overview, isLoading: false }),
  }
})
```

2. In the mock-mode `describe`'s `beforeEach`, add `characterStore.overview = MOCK_OVERVIEW_EMPTY` (mirrors mock mode's real pre-bootstrap default).
3. Add to the mock-mode `describe` (ported from the Én hub's Karakter tests, `EnHubPage.test.tsx:242-264` pre-Task-2):

```tsx
  test('a Karakter széles csempe a Mezo hubon él és a dossziéra navigál (hub-tile-reorg)', async () => {
    renderHub()
    const karakter = screen.getByRole('button', { name: 'Karakter' })
    expect(karakter.classList.contains('mzh-t-karakter')).toBe(true)
    await userEvent.click(karakter)
    expect(screen.getByTestId('location')).toHaveTextContent('/me/karakter')
  })

  test('a Karakter csempe az élő átlag CORE érettséget mutatja (post-bootstrap)', () => {
    characterStore.overview = MOCK_OVERVIEW
    renderHub()
    // MOCK_OVERVIEW's 7 CORE dims: (58+71+45+66+39+74+33)/7 = 55.14 -> 55
    expect(screen.getByRole('button', { name: 'Karakter' })).toHaveTextContent('55% átlag érettség')
  })

  test('a Karakter csempe nem hord kitalált sort — kikapcsolt forrás (overview null)', () => {
    characterStore.overview = null
    renderHub()
    expect(screen.getByRole('button', { name: 'Karakter' }).querySelector('.mz-tile-line')).toBeNull()
  })

  test('a Karakter csempe nem hord sort érintetlen (pre-bootstrap) dossziénál — az isDossierEmpty predikátum', () => {
    renderHub() // beforeEach: MOCK_OVERVIEW_EMPTY
    expect(screen.getByRole('button', { name: 'Karakter' }).querySelector('.mz-tile-line')).toBeNull()
  })
```

4. In the real-mode test (line ~126), add `expect(screen.getByRole('button', { name: 'Karakter' })).toBeInTheDocument()` next to the Minták assert. In the real-mode `describe`, add the same `beforeEach` line `characterStore.overview = MOCK_OVERVIEW_EMPTY`.
5. In `frontend/src/app/navigation.test.tsx` replace the `'the Én hub links to the Karakter dossier hub'` test (~line 75) with:

```tsx
test('the Mezo hub links to the Karakter dossier hub (hub-tile-reorg)', async () => {
  renderApp('/mezo')
  await userEvent.click(await screen.findByRole('button', { name: 'Karakter' }))
  expect(await screen.findByRole('button', { name: 'Kezdjétek el' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend && pnpm vitest run src/features/insights/pages/MezoHubPage.test.tsx src/app/navigation.test.tsx
```
Expected: FAIL — no `Karakter` button on the Mezo hub.

- [ ] **Step 3: Add the tile**

In `frontend/src/features/insights/pages/MezoHubPage.tsx`:

1. Imports: add `useCharacterOverview` to the `@/data/hooks` import; add `import { isDossierEmpty } from '@/features/character/dossierState'`.
2. After the `kisLine` derivation (~line 127), add the derivation the Én hub carried (verbatim contract, same predicate):

```tsx
  // Karakter dossier tile (hub-tile-reorg — moved from the Én hub): honest states — the
  // switch-off 404 (overview null) drops the line, and so does the pre-bootstrap
  // "untouched dossier" state. `isDossierEmpty` is the ONE shared predicate (mezo-1gim.13
  // fix round 1) both this tile and KarakterHubPage's bootstrap face read.
  const { overview: character } = useCharacterOverview()
  const coreDims = character?.dimensions.filter((d) => d.kind === 'CORE') ?? []
  const karakterLine = character == null || coreDims.length === 0 || isDossierEmpty(character)
    ? undefined
    : `${Math.round(coreDims.reduce((sum, d) => sum + d.maturity, 0) / coreDims.length)}% átlag érettség`
```

3. In the mosaic, after the Diagnózis tile (line 209), add:

```tsx
          {/* Karakter (hub-tile-reorg): AI-domain dossier — wide like Diagnózis, so the
              6-cell 2-col pairing stays intact. */}
          <Tile wash="lav" icon="i-kristaly" eyebrow="Karakter" delayMs={440} aria-label="Karakter"
            className="mzh-eb-lav mzh-t-karakter" line={karakterLine} onClick={() => navigate('/me/karakter')} />
```

(`mzh-eb-lav` exists — `grep -n "mzh-eb-lav" frontend/src/styles/prototype.css` to confirm; if not, use `mzh-eb-sage` and match the test's class assert accordingly — the wide class is the one that matters.)
4. In `frontend/src/styles/prototype.css` line 5248, extend the wide-tile selector:

```css
.mzh-t-diag, .mzh-t-karakter { grid-column: 1 / -1; align-items: flex-start; text-align: left; }
```

5. Update the file-header comment (line 10): `6-tile mosaic` → `6+2-tile mosaic (a széles Diagnózis + Karakter csempékkel)`.

- [ ] **Step 4: Run tests both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/insights src/app/navigation.test.tsx src/shared/ui/mozaik && VITE_USE_MOCK=false pnpm vitest run src/features/insights/pages/MezoHubPage.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights frontend/src/app/navigation.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fe): Karakter széles csempe a Mezo hubon — élő érettség-sor, isDossierEmpty (<BD-ID>)"
```

---

### Task 4: Tudásgráf — back chip + Tudástár entry copy

**Files:**
- Modify: `frontend/src/features/me/pages/KnowledgePage.tsx:61`
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx:115-120`
- Test: `frontend/src/features/me/pages/KnowledgePage.test.tsx` (if it asserts the back label — check first), `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx` (likewise)

**Interfaces:**
- Consumes: nothing new.
- Produces: with the Én Tudás tile gone, the graph's only doors are the Tudástár link (already present) and deep links; the back chip now points deterministically at the Tudástár.

- [ ] **Step 1: Check existing test coverage**

```bash
cd frontend && grep -rn "‹ Én\|Tudásgráfon\|Vissza" src/features/me/pages/KnowledgePage.test.tsx src/features/insights/pages/KnowledgeListPage.test.tsx 2>/dev/null
```
If a test pins the `‹ Én` label or the link copy, update it in the same edit below (assert the new strings BEFORE changing the source — run to see it fail, TDD).

- [ ] **Step 2: Update the back chip**

`KnowledgePage.tsx:61` — the graph's home is the Tudástár now, so the chip is deterministic instead of history-dependent:

```tsx
      <PageHead onBack={() => navigate('/mezo/knowledge')} label="‹ Tudástár" />
```

Also update the file-header comment's `‹ Én back chip` mention (line ~6) to `‹ Tudástár back chip (hub-tile-reorg: the Én hub's Tudás tile is gone — the Tudástár is the graph's door)`.

- [ ] **Step 3: Strengthen the entry copy**

`KnowledgeListPage.tsx:115-120` — the existing prose link is the graph's entry point; make it name the mindmap:

```tsx
      <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, padding: '0 4px', margin: 0 }}>
        A kapcsolatok és életesemények a{' '}
        <Link to="/me/knowledge" style={{ color: 'var(--lav-deep)', fontWeight: 600, textDecoration: 'none' }}>
          Tudásgráfon
        </Link>{' '}
        élnek — élő mindmap →
      </p>
```

- [ ] **Step 4: Run tests both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx src/features/insights/pages/KnowledgeListPage.test.tsx && VITE_USE_MOCK=false pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx src/features/insights/pages/KnowledgeListPage.test.tsx
```
Expected: PASS. (Skip whichever file doesn't exist.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/pages frontend/src/features/insights/pages
git commit -m "feat(fe): Tudásgráf vissza-chip ‹ Tudástár + mindmap-belépő szöveg (<BD-ID>)"
```

---

### Task 5: Docs, CODEMAP, full gates, wrap-up

**Files:**
- Modify: `docs/features/me.md` (§2 and wherever the mosaic/SettingsSheet/tile list appears)
- Modify: `docs/features/insights.md` (Mezo hub tile list)
- Modify: `docs/features/character.md` (entry point: Én hub → Mezo hub)
- Modify: `docs/decisions/0032-five-tab-ia-dissolved-section-shells.md` (short dated amendment note)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Update feature docs**

Read each doc, then update the drifted sections to the new reality:
- `me.md`: the Én hub is a **6-tile** mosaic (Súly, Alvás, Growth, Napló, Emberek, Beállítások); Heti/Tudás/Karakter/Értesítés/AI-napló tiles moved per the hub-tile-reorg spec; SettingsSheet replaced by `BeallitasokPage` (`/me/beallitasok`: Téma + Értesítések + AI-napló rows); the notification FEED stays on the header dropdown (`/me/ertesitesek`). Fix the stale "nine-tile" count while there.
- `insights.md`: Mezo hub tile list gains the wide Karakter tile (→ `/me/karakter`, line = avg CORE maturity, `isDossierEmpty` predicate); note the guiding principle (Mezo = AI, Én = personal) citing the spec.
- `character.md`: the dossier's hub entry is the **Mezo** hub tile now.
- ADR 0032: append a short `**Módosítás (2026-09-01, hub-tile-reorg):**` note — the Én hub's settings band became a tile + page (`/me/beallitasok`), and the AI-domain tiles (Karakter; Tudás-gráf entry) consolidated on the Mezo hub. Do not rewrite the ADR body.

- [ ] **Step 2: Regenerate CODEMAP**

```bash
node scripts/gen-codemap.mjs
git diff --stat docs/CODEMAP.md   # expect: BeallitasokPage added, SettingsSheet gone
```

- [ ] **Step 3: Full frontend gates**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build && pnpm exec eslint src
```
Expected: all green. Fix anything that surfaces before proceeding (systematic-debugging if non-obvious).

- [ ] **Step 4: Commit docs + close out**

```bash
git add docs
git commit -m "docs: hub-tile-reorg átvezetés — me/insights/character docs, ADR 0032 megjegyzés, CODEMAP (<BD-ID>)"
bd close <BD-ID>
```

- [ ] **Step 5: Push + PR (the CI gate)**

```bash
git push -u origin claude/mezo-en-menu-reorganize-e85846
gh pr create --title "feat(fe): Mezo↔Én hub-csempe átszervezés + Beállítások oldal (<BD-ID>)" --body "Spec: docs/superpowers/specs/2026-09-01-hub-tile-reorg-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Then follow the house merge flow: wait for CI green → `git pull --rebase` on main → merge `--no-ff` locally → push main → delete branch. Session close: `git pull --rebase && bd dolt push && git push`.
