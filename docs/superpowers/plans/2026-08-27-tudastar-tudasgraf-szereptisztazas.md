# Tudástár ↔ Tudásgráf szerep-tisztázás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tények egyetlen gazdája a Tudástár, a gráfé a Me → Tudás oldal, és a két felület láthatóan össze van kötve — így az elfogadott életesemény nem „tűnik el" némán.

**Architecture:** Tisztán frontend információ-architektúra. A `KnowledgePage` elveszíti a duplikált ténylistát és kap egy linket a Tudástárra; a `KnowledgeListPage` egy page-szintű `acceptedEvents` state-tel megerősítő kártyát rajzol az elfogadott életesemény-jelölt helyére, plusz egy kereszt-linket a fejlécbe. Backend, API, adatmodell változatlan.

**Tech Stack:** React 19 + TypeScript, react-router-dom (`Link`), TanStack Query, Vitest + Testing Library, `@/test/queryWrapper`.

**Spec:** [`docs/superpowers/specs/2026-08-27-tudastar-tudasgraf-szereptisztazas-design.md`](../specs/2026-08-27-tudastar-tudasgraf-szereptisztazas-design.md) · **Driver:** mezo-0ap9

## Global Constraints

- Minden felhasználónak látható szöveg **magyar**, a meglévő copy-hangnem szerint (l. `KnowledgeExplainer`, `LifeEventCandidateCard`).
- Útvonalak pontosan: Tudástár = `/insights/knowledge`, Tudásgráf = `/me/knowledge`.
- `Link` a `react-router-dom`-ból — a bevett idióma `features/insights/components/PatternImpactCard.tsx:63` és `PatternJournal.tsx:37`. Sosem `<a href>`.
- Link-stílus idióma: `className="eyebrow"` + `style={{ color: 'var(--lav-deep)' }}` (l. `PatternDecisionCard.tsx:170`).
- Aki `Link`-et renderel, annak a **tesztje `MemoryRouter`-t igényel** — a `QueryWrapper` NEM ad router-kontextust (`frontend/src/test/queryWrapper.tsx`). Idióma: `app/TabBar.test.tsx:9`.
- Backend, OpenAPI, `api.gen.ts` **nem módosul** — ha egy taszk oda nyúlna, az hiba.
- A frontend gate mindkét módban fut (`vite-use-mock-unset-means-mock`: a csupasz `pnpm test` kétszer mock-ot futtat).
- Minden taszk saját committal zárul, conventional subject + `(mezo-0ap9)`.

## File Structure

| Fájl | Felelősség | Taszk |
|---|---|---|
| `frontend/src/features/me/pages/KnowledgePage.tsx` | MÓDOSUL — a `Kategóriánként` szekció ki, Tudástár-link be | 1 |
| `frontend/src/features/me/components/KnowledgeFactCard.tsx` | TÖRLŐDIK — a `KnowledgePage` az egyetlen fogyasztója volt | 1 |
| `frontend/src/features/me/pages/KnowledgePage.test.tsx` | MÓDOSUL — ténylista-assertionök ki, link-teszt be, `MemoryRouter` | 1 |
| `frontend/src/features/insights/components/LifeEventAcceptedCard.tsx` | ÚJ — a megerősítő kártya | 2 |
| `frontend/src/features/insights/pages/KnowledgeListPage.tsx` | MÓDOSUL — `acceptedEvents` state + megerősítő kártya + kereszt-link | 2, 3 |
| `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx` | MÓDOSUL — `MemoryRouter`, új tesztek | 2, 3 |
| `docs/features/me.md`, `docs/features/insights.md`, `docs/CODEMAP.md` | MÓDOSUL — szerep-elhatárolás dokumentálva | 4 |

---

### Task 1: A Tudás oldal tisztán a gráfé

**Files:**
- Modify: `frontend/src/features/me/pages/KnowledgePage.tsx`
- Delete: `frontend/src/features/me/components/KnowledgeFactCard.tsx`
- Test: `frontend/src/features/me/pages/KnowledgePage.test.tsx`

**Interfaces:**
- Consumes: `useKnowledge()` → `{ facts, edges, activeCount }` (marad, az összegző sávhoz), `useKnowledgeGraphNodes()`, `useKnowledgeGraphActions()`.
- Produces: semmi, amire később taszk épül. A `KnowledgeFactCard` export **megszűnik**.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `KnowledgePage.test.tsx`-ben a render helper kap `MemoryRouter`-t, a két ténylista-teszt (`renders category headers in order with counts`, `renders 15 fact cards`) **törlődik**, és bejön két új teszt. A fájl tetején az import sor egészüljön ki:

```tsx
import { MemoryRouter } from 'react-router-dom'
```

A helper cserélődik erre:

```tsx
const renderPage = () =>
  render(
    <MemoryRouter>
      <KnowledgePage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
```

A törölt két teszt helyére:

```tsx
test('a tényeket már nem listázza — azoknak a Tudástár a gazdája', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('[data-fact-card]')).toHaveLength(0)
  expect(screen.queryByText('Kategóriánként')).not.toBeInTheDocument()
  expect(screen.queryByText(/Étkezés · 5/)).not.toBeInTheDocument()
})

test('a Tudástárra mutató link ott van az összegző sáv alatt', () => {
  renderPage()
  const link = screen.getByRole('link', { name: /Tények kezelése/ })
  expect(link).toHaveAttribute('href', '/insights/knowledge')
})
```

A `renders the summary band with derived counts` teszt **marad változatlanul** (az összegző sáv nem tűnik el).

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx
```

Várt: a két új teszt BUKIK (`Kategóriánként` még ott van, 15 fact-card renderelődik, nincs link).

- [ ] **Step 3: Írd át a `KnowledgePage.tsx`-et**

Törlendő importok: `FACT_CATEGORIES`, `factCategoryColor` a `@/data/insights/knowledge`-ból és a `KnowledgeFactCard` import. **A `CategoryHeader` import MARAD** — a Kapcsolatok szekció használja. Új import: `Link`.

A fájl teteje így néz ki:

```tsx
import { Link } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { useKnowledge, useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { CategoryHeader } from '@/features/me/components/CategoryHeader'
import { KnowledgeGraphNodeCard } from '@/features/me/components/KnowledgeGraphNodeCard'
import { ProfileNodeCard } from '@/features/me/components/ProfileNodeCard'
```

A `{/* Facts by category */}` blokk (a `<div style={{ padding: '0 24px 32px' }}>`-től a záró `</div>`-ig, a `FACT_CATEGORIES.map`-pel együtt) **teljesen törlődik**.

Az összegző sáv kártyáján belül, a meglévő `<div className="row">…</div>` UTÁN, még a `card` div-en belül kerüljön be a link-sor:

```tsx
          <Link
            to="/insights/knowledge"
            className="eyebrow"
            style={{ color: 'var(--lav-deep)', display: 'block', marginTop: 12, textDecoration: 'none' }}
          >
            Tények kezelése → Tudástár
          </Link>
```

Az `activeCount` és `facts.length` továbbra is az összegző sávban használatos, tehát a `useKnowledge()` destrukturálás változatlan.

- [ ] **Step 4: Töröld a holt komponenst**

```bash
git rm frontend/src/features/me/components/KnowledgeFactCard.tsx
```

Ellenőrzés, hogy tényleg nincs több hivatkozás (a `KnowledgeGraphNodeCard.tsx:4` és `CategoryHeader.tsx:1` KOMMENTBEN említi — az nem hivatkozás, de a komment szövegét igazítsd: „a `KnowledgeFactCard` Napiv row-card idiom" → „a Napiv row-card idiom", hogy ne mutasson nem létező fájlra):

```bash
grep -rn "KnowledgeFactCard" frontend/src
```

Várt: **nincs találat**.

- [ ] **Step 5: Futtasd a tesztet**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx
```

Várt: mind PASS (6 teszt: summary band, a két új, Kapcsolatok, archiválás, profil-node).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(me): a Tudás oldal tisztán a gráfé — duplikált ténylista ki, Tudástár-link be (mezo-0ap9)"
```

---

### Task 2: Elfogadás-visszajelzés az életesemény-jelöltnél

**Files:**
- Create: `frontend/src/features/insights/components/LifeEventAcceptedCard.tsx`
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx`
- Test: `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx`

**Interfaces:**
- Consumes: `LifeEventCandidate` (`@/data/types`) — mezői közül itt `id`, `title`, `proposedEdgeCount` kell; `useLifeEventActions()` → `{ decide(id, decision) }`.
- Produces: `LifeEventAcceptedCard` komponens, propjai: `{ title: string; edgeCount: number }`. A Task 3 ugyanebben a page-fájlban dolgozik, de más blokkban (fejléc), nem függ ettől.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `KnowledgeListPage.test.tsx` render-helperje kap `MemoryRouter`-t (a Task 3 kereszt-linkje és ez a kártya is `Link`-et renderel). A fájl importjaihoz:

```tsx
import { MemoryRouter } from 'react-router-dom'
```

és a helper:

```tsx
const renderPage = () =>
  render(
    <MemoryRouter>
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
```

Új teszt a `describe('KnowledgeListPage (mock mode)')` blokk végére, közvetlenül az `elvetés után eltűnik a jelölt a listáról` teszt után:

```tsx
  it('elfogadás után megerősítő kártya marad a helyén, linkkel a Tudásgráfra', async () => {
    renderPage()
    const card = (await screen.findByText('Új munkahely első hete')).closest('.card') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Elfogad' }))

    expect(await screen.findByText(/Bekerült a gráfba/)).toBeInTheDocument()
    // a cím továbbra is olvasható, hogy tudd, MI került be
    expect(screen.getByText('Új munkahely első hete')).toBeInTheDocument()
    // a döntés gombjai eltűntek — a kártya már nem jelölt
    expect(within(screen.getByText(/Bekerült a gráfba/).closest('.card') as HTMLElement)
      .queryByRole('button', { name: 'Elfogad' })).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Tudásgráf/ })
    expect(link).toHaveAttribute('href', '/me/knowledge')
  })
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/insights/pages/KnowledgeListPage.test.tsx
```

Várt: az új teszt BUKIK („Bekerült a gráfba" nem található).

- [ ] **Step 3: Hozd létre a megerősítő kártyát**

`frontend/src/features/insights/components/LifeEventAcceptedCard.tsx`:

```tsx
import { Link } from 'react-router-dom'

/**
 * Az elfogadott életesemény-jelölt helyén maradó megerősítés (mezo-0ap9). A jóváhagyás a
 * Tudástárban történik, de az eredmény a Tudásgráfon él — enélkül a kártya némán eltűnik, és
 * a felhasználó azt látja, hogy „elfogadtam, mégsem lett belőle semmi" (IDENT-6: a megerősítés
 * sosem néma, a `LifeEventCandidateCard` idiómája).
 */
export function LifeEventAcceptedCard({ title, edgeCount }: { title: string; edgeCount: number }) {
  return (
    <div className="card" style={{ padding: '12px 14px 12px 16px', position: 'relative', borderColor: 'var(--line)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--sage)' }} />

      <span className="label-mono" style={{ fontSize: 9, color: 'var(--sage)' }}>
        {edgeCount > 0 ? `Bekerült a gráfba · ${edgeCount} kapcsolattal` : 'Bekerült a gráfba'}
      </span>
      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: '6px 0 0' }}>{title}</p>
      <Link
        to="/me/knowledge"
        className="eyebrow"
        style={{ color: 'var(--lav-deep)', display: 'inline-block', marginTop: 8, textDecoration: 'none' }}
      >
        Megnézed? → Tudásgráf
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Kösd be a page-be**

`KnowledgeListPage.tsx` — új import a többi komponens-import mellé:

```tsx
import { LifeEventAcceptedCard } from '@/features/insights/components/LifeEventAcceptedCard'
```

A komponens törzsében, a meglévő `const [category, setCategory] = useState<FactCategory | 'all'>('all')` sor UTÁN:

```tsx
  // Az elfogadott életesemény a szerver-listáról azonnal lekerül (query-invalidálás), ezért a
  // megerősítést page-szintű state tartja életben az oldal elhagyásáig (mezo-0ap9). Mock és real
  // módban azonos, hogy a mock-módú ellenőrzés a valós élményt mutassa.
  const [acceptedEvents, setAcceptedEvents] = useState<{ id: string; title: string; edgeCount: number }[]>([])
```

Az életesemény-blokk (`{lifeEvents.length > 0 && (…)}`) cserélődik erre — a feltétel most a `||`, hogy a megerősítések akkor is látszódjanak, ha a jelölt-lista már kiürült:

```tsx
      {(lifeEvents.length > 0 || acceptedEvents.length > 0) && (
        <div className="col gap-sm">
          <span className="eyebrow" style={{ color: 'var(--amber-deep)' }}>
            Életesemény-jelöltek · {lifeEvents.length}
          </span>
          {acceptedEvents.map((a) => (
            <LifeEventAcceptedCard key={a.id} title={a.title} edgeCount={a.edgeCount} />
          ))}
          {lifeEvents
            .filter((c) => !acceptedEvents.some((a) => a.id === c.id))
            .map((c) => (
              <LifeEventCandidateCard
                key={c.id}
                candidate={c}
                onDecide={(decision) => {
                  if (decision === 'accept') {
                    setAcceptedEvents((prev) => [
                      ...prev,
                      { id: c.id, title: c.title, edgeCount: c.proposedEdgeCount },
                    ])
                  }
                  decideLifeEvent(c.id, decision)
                }}
              />
            ))}
        </div>
      )}
```

A `.filter(…)` azért kell, mert real módban a jelölt a refetch megérkezéséig még a listában van — enélkül egy pillanatra a jelölt-kártya és a megerősítés is látszana.

- [ ] **Step 5: Futtasd a tesztet**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/insights/pages/KnowledgeListPage.test.tsx
```

Várt: mind PASS, az új teszttel együtt.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(insights): az elfogadott életesemény megerősítő kártyát hagy, linkkel a Tudásgráfra (mezo-0ap9)"
```

---

### Task 3: Kereszt-link a Tudástár fejlécében

**Files:**
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx`
- Test: `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx`

**Interfaces:**
- Consumes: a Task 2-ben már behozott `Link` import és `MemoryRouter`-es render helper.
- Produces: semmi további.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `describe('KnowledgeListPage (mock mode)')` blokkba, a fejléc-tesztek mellé:

```tsx
  test('a fejléc alatt kereszt-link mutat a Tudásgráfra', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /Tudásgráf/ })
    expect(link).toHaveAttribute('href', '/me/knowledge')
    expect(screen.getByText(/kapcsolatok és életesemények/)).toBeInTheDocument()
  })
```

Figyelem: ha a Task 2 megerősítő kártyája is renderelődne ugyanebben a tesztben, a `getByRole('link')` többszörös találatra bukna — ez a teszt friss oldalt renderel, ahol még nincs elfogadott esemény, tehát pontosan egy ilyen link van.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/insights/pages/KnowledgeListPage.test.tsx -t 'kereszt-link'
```

Várt: BUKIK (nincs ilyen link).

- [ ] **Step 3: Implementáld**

`KnowledgeListPage.tsx` — a `<KnowledgeExplainer />` sor UTÁN közvetlenül:

```tsx
      <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, padding: '0 4px', margin: 0 }}>
        A kapcsolatok és életesemények a{' '}
        <Link to="/me/knowledge" style={{ color: 'var(--lav-deep)', fontWeight: 600, textDecoration: 'none' }}>
          Tudásgráfon
        </Link>{' '}
        élnek.
      </p>
```

Ha a `Link` import a Task 2-ből még nem lenne bent, add hozzá:

```tsx
import { Link } from 'react-router-dom'
```

- [ ] **Step 4: Futtasd a teljes fájlt**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/insights/pages/KnowledgeListPage.test.tsx
```

Várt: mind PASS. Ha a Task 2 tesztje most a link-lekérdezésen bukik (két „Tudásgráf" link az oldalon), szűkítsd ott a lekérdezést a megerősítő kártyára:

```tsx
    const acceptedCard = screen.getByText(/Bekerült a gráfba/).closest('.card') as HTMLElement
    const link = within(acceptedCard).getByRole('link', { name: /Tudásgráf/ })
    expect(link).toHaveAttribute('href', '/me/knowledge')
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(insights): kereszt-link a Tudástárból a Tudásgráfra (mezo-0ap9)"
```

---

### Task 4: Dokumentáció + teljes gate

**Files:**
- Modify: `docs/features/me.md`, `docs/features/insights.md`, `docs/CODEMAP.md`

**Interfaces:**
- Consumes: az 1–3. taszk végállapota.
- Produces: semmi kód.

- [ ] **Step 1: Frissítsd a `docs/features/me.md` §`Tudás` szakaszát**

A `### \`Tudás\` (\`pages/KnowledgePage.tsx\`)` bekezdés `CategoryHeader` + `KnowledgeFactCard` ténylistát leíró mondatai cserélődnek. Az új szöveg mondja ki: az oldal **nem** listázza a tényeket (azoknak a Tudástár a gazdája, `/insights/knowledge`), az összegző sáv marad, alatta „Tények kezelése → Tudástár" link, és a `KnowledgeFactCard` törölve (mezo-0ap9). A `CategoryHeader` maradt, a Kapcsolatok szekció használja.

- [ ] **Step 2: Frissítsd a `docs/features/insights.md` Tudástár-szakaszát**

Vedd fel: az életesemény-jelölt elfogadása megerősítő kártyát hagy a helyén (`LifeEventAcceptedCard`), linkkel a `/me/knowledge`-re, és a fejléc alatt kereszt-link mutat a Tudásgráfra. Mondd ki a szerep-elhatárolást: Tudástár = „mit kap most a társ" (tény-inbox, prompt-vödrök, kapcsoló), Tudásgráf = „hogyan függ össze, amit rólam tud" (node-ok, élek, archiválás).

- [ ] **Step 3: Regeneráld a CODEMAP-et**

```bash
node scripts/gen-codemap.mjs
git diff --stat docs/CODEMAP.md
```

Várt: a `KnowledgeFactCard.tsx` eltűnik, a `LifeEventAcceptedCard.tsx` megjelenik.

- [ ] **Step 4: Doc-lint**

```bash
node scripts/lint-docs.mjs --errors-only
```

Várt: hibamentes (a 🔶 staleness advisory nem blokkol).

- [ ] **Step 5: Teljes frontend gate mindkét módban + build**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run && VITE_USE_MOCK=false pnpm vitest run && pnpm build
```

Várt: mindhárom zöld. Backend nem érintett, nem kell futtatni.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(features): Tudástár ↔ Tudásgráf szerep-elhatárolás dokumentálva (mezo-0ap9)"
```
