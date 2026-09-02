// Emberek S3 hub, person-detail page (mezo-06o0.2 Task 4) — the sheet-to-page
// migration off PersonDetailSheet. Source: docs/design_2.0/prototypes/src/
// emberek-body.html renderDet() + emberek-head.html `.trendcard`/`.affbars`/
// `.ctxcard`/`.ctxbar`/`.factcard`/`.fact`/`.pavat.lg` (×1.18).
//
// Navigation is asserted through the REAL `routes` export (PeopleKorPage.test.tsx
// idiom) so the query-controlled route guard (isPending vs. genuinely-missing) is
// exercised against the actual router wiring, not a test-local stand-in.
import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes } from '@/app/router'
import { people, mentions } from '@/data/me/people'
import { contextBreakdown, trendAxisLabels, trendHeights } from '@/features/me/logic/peopleDerive'
import { TONE_META, CTX_META } from '@/features/me/logic/peopleVisuals'

const hoisted = vi.hoisted(() => ({
  emptyTrendFor: null as string | null,
  isPending: false,
  extraMentionsFor: null as string | null,
  affectOverrideFor: null as string | null,
  cadenceOverrideFor: null as string | null,
  factsOverrideFor: null as string | null,
  logMention: null as ((input: unknown) => void) | null,
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    usePeople: () => {
      const real = actual.usePeople()
      let people = real.people
      let mentions = real.mentions
      if (hoisted.emptyTrendFor) {
        people = people.map((p) => (p.id === hoisted.emptyTrendFor
          ? { ...p, affectTrend: [], affectTrendStart: null, direction: 'flat' as const, directionReason: null }
          : p))
      }
      if (hoisted.affectOverrideFor) {
        people = people.map((p) => (p.id === hoisted.affectOverrideFor ? { ...p, affect_baseline: undefined as never } : p))
      }
      if (hoisted.cadenceOverrideFor) {
        people = people.map((p) => (p.id === hoisted.cadenceOverrideFor ? { ...p, contactCadenceLabel: '' } : p))
      }
      if (hoisted.factsOverrideFor) {
        people = people.map((p) => (p.id === hoisted.factsOverrideFor ? { ...p, knownFacts: [] } : p))
      }
      if (hoisted.extraMentionsFor) {
        const extra = Array.from({ length: 10 }, (_, i) => ({
          id: `extra-${i}`,
          ts: '2026-05-24T09:00',
          dayLabel: 'Ma',
          timeLabel: '09:00',
          person_id: hoisted.extraMentionsFor as string,
          personName: 'X',
          source: 'text' as const,
          excerpt: `extra ${i}`,
        }))
        mentions = [...extra, ...mentions]
      }
      const logMention = (input: unknown) => {
        hoisted.logMention?.(input)
        real.logMention(input as never)
      }
      return { ...real, people, mentions, isPending: hoisted.isPending, logMention }
    },
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.emptyTrendFor = null
  hoisted.isPending = false
  hoisted.extraMentionsFor = null
  hoisted.affectOverrideFor = null
  hoisted.cadenceOverrideFor = null
  hoisted.factsOverrideFor = null
  hoisted.logMention = null
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return { ...view, router }
}

const petra = people.find((p) => p.id === 'pp-petra')!
const bence = people.find((p) => p.id === 'pp-bence')!
const adam = people.find((p) => p.id === 'pp-adam')!
const mark = people.find((p) => p.id === 'pp-mark')!

test('an unknown :id navigates back to /me/people/kor', () => {
  const { router } = renderAt('/me/people/does-not-exist')
  expect(router.state.location.pathname).toBe('/me/people/kor')
})

test('an unknown :id does NOT navigate away while usePeople().isPending is true (query-guard rule)', () => {
  hoisted.isPending = true
  const { router } = renderAt('/me/people/does-not-exist')
  expect(router.state.location.pathname).toBe('/me/people/does-not-exist')
})

test('hero: avatar initial + name + "kapcsolat · cadence" sub', () => {
  renderAt(`/me/people/${petra.id}`)
  expect(screen.getByText(petra.name)).toBeInTheDocument()
  expect(screen.getByText(`${petra.relationshipHu} · ${petra.contactCadenceLabel}`)).toBeInTheDocument()
  expect(screen.getByText(petra.initial)).toBeInTheDocument()
})

test('hero sub omits the cadence segment when contactCadenceLabel is empty', () => {
  hoisted.cadenceOverrideFor = petra.id
  renderAt(`/me/people/${petra.id}`)
  expect(screen.getByText(petra.relationshipHu)).toBeInTheDocument()
  expect(screen.queryByText(`${petra.relationshipHu} · `)).toBeNull()
  expect(screen.queryByText(new RegExp(`${petra.relationshipHu} ·`))).toBeNull()
})

test('statstrip is Hungarian: összes / e héten / hangulat, hangulat = TONE_META label of affect_baseline', () => {
  renderAt(`/me/people/${petra.id}`)
  expect(screen.getByText('összes')).toBeInTheDocument()
  expect(screen.getByText('e héten')).toBeInTheDocument()
  expect(screen.getByText('hangulat')).toBeInTheDocument()
  expect(screen.getByText(String(petra.mentionCount))).toBeInTheDocument()
  expect(screen.getByText(`${petra.mentionsThisWeek}×`)).toBeInTheDocument()
  expect(screen.getByText(TONE_META[petra.affect_baseline].label)).toBeInTheDocument()
})

test('hangulat cell renders — when affect_baseline has no TONE_META entry', () => {
  hoisted.affectOverrideFor = petra.id
  renderAt(`/me/people/${petra.id}`)
  const statcells = document.querySelectorAll('.mz-statcell b')
  expect([...statcells].some((el) => el.textContent === '—')).toBe(true)
})

test('CONTRACT: mood-arc bar heights are trendHeights(affectTrend, 50)', () => {
  const expected = trendHeights(petra.affectTrend, 50)
  renderAt(`/me/people/${petra.id}`)
  const bars = [...document.querySelectorAll('.ppl-affbars i')] as HTMLElement[]
  expect(bars.map((b) => b.style.height)).toEqual(expected.map((h) => `${h}px`))
})

test('an empty affectTrend renders an honest "—" empty state instead of bars', () => {
  hoisted.emptyTrendFor = petra.id
  renderAt(`/me/people/${petra.id}`)
  expect(document.querySelector('.ppl-affbars')).toBeNull()
  const card = document.querySelector('.ppl-trendcard')!
  expect(card.textContent).toContain('—')
})

test('CONTRACT: the mood-arc axis row renders trendAxisLabels(affectTrendStart, now), not the prototype\'s hardcoded JÚL/AUG', () => {
  const expected = trendAxisLabels(petra.affectTrendStart, new Date())!
  renderAt(`/me/people/${petra.id}`)
  const axis = document.querySelector('.ppl-affax')!
  expect(axis).not.toBeNull()
  const spans = [...axis.querySelectorAll('span')].map((s) => s.textContent)
  expect(spans).toEqual(expected)
})

test('an empty affectTrend renders no axis row either (nothing to label)', () => {
  hoisted.emptyTrendFor = petra.id
  renderAt(`/me/people/${petra.id}`)
  expect(document.querySelector('.ppl-affax')).toBeNull()
})

test('context card shows contextBreakdown of the person\'s own mentions, with pct', () => {
  renderAt(`/me/people/${bence.id}`)
  const benceMentions = mentions.filter((m) => m.person_id === bence.id)
  const expected = contextBreakdown(benceMentions)
  expect(expected.length).toBeGreaterThan(0)
  for (const slice of expected) {
    expect(document.querySelector('.ppl-ctxcard')?.textContent).toContain(CTX_META[slice.ctx].label)
    expect(screen.getByText(`${slice.pct}%`)).toBeInTheDocument()
  }
})

test('context card is OMITTED entirely when the person has no labeled mentions', () => {
  renderAt(`/me/people/${petra.id}`)
  expect(document.querySelector('.ppl-ctxcard')).toBeNull()
})

test('facts card shows knownFacts pills', () => {
  renderAt(`/me/people/${petra.id}`)
  for (const fact of petra.knownFacts) {
    expect(screen.getByText(fact)).toBeInTheDocument()
  }
})

test('facts card is OMITTED when knownFacts is empty', () => {
  hoisted.factsOverrideFor = mark.id
  renderAt(`/me/people/${mark.id}`)
  expect(document.querySelector('.ppl-factcard')).toBeNull()
  expect(screen.queryByText('Amit Mezo tud')).toBeNull()
})

test('timeline: renders the person\'s own mentions (max 8), never a stranger\'s', () => {
  renderAt(`/me/people/${adam.id}`)
  const adamMentions = mentions.filter((m) => m.person_id === adam.id)
  for (const m of adamMentions) {
    expect(screen.getByText(`„${m.excerpt}”`)).toBeInTheDocument()
  }
  expect(screen.queryByText(/Petrával hosszú vacsi/)).toBeNull()
})

test('timeline caps at 8 rows even when a person has more mentions', () => {
  hoisted.extraMentionsFor = adam.id
  renderAt(`/me/people/${adam.id}`)
  expect(document.querySelectorAll('.ppl-mrowt')).toHaveLength(8)
})

test('a tone-less timeline row gets a neutral dot, and the footnote appears only then', () => {
  renderAt(`/me/people/${adam.id}`)
  // mn-auto1 (Ádám) carries no `tone` in the seed.
  expect(screen.getByText('A tónust az éjszakai kör tölti.')).toBeInTheDocument()
})

test('the footnote is absent when every rendered row already carries a tone', () => {
  renderAt(`/me/people/${bence.id}`)
  expect(screen.queryByText('A tónust az éjszakai kör tölti.')).toBeNull()
})

test('renders the "Kapcsolt események · gráf" section from graphEdges (S5)', async () => {
  renderAt(`/me/people/${petra.id}`)
  expect(await screen.findByText('Kapcsolt események · gráf')).toBeInTheDocument()
  expect(screen.getByText('Nyári szabadság · júl 14–21')).toBeInTheDocument()
  expect(screen.getByText(/Cél · támogatja/)).toBeInTheDocument()
})

test('the section is OMITTED entirely when the person has no graph edges', async () => {
  const reka = people.find((p) => p.id === 'pp-reka')!
  renderAt(`/me/people/${reka.id}`)
  expect(await screen.findByText('Hangulat-ív')).toBeInTheDocument()
  expect(screen.queryByText(/Kapcsolt események/)).toBeNull()
})

test('"Log most" opens PersonLogSheet preselecting this person', () => {
  const onLog = vi.fn()
  hoisted.logMention = onLog
  renderAt(`/me/people/${petra.id}`)
  fireEvent.click(screen.getByRole('button', { name: /Log most/ }))
  expect(screen.getByText('Mit jegyzünk meg?')).toBeInTheDocument()
  // Submit WITHOUT picking anyone in the sheet's own "Ki?" chip row — a successful
  // save proves the sheet's `chosen` state was preloaded with this page's person.
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ personId: petra.id }))
})

test('"Szerkesztés" header action opens PersonEditSheet with the person', () => {
  renderAt(`/me/people/${petra.id}`)
  fireEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(screen.getByText('Személy szerkesztése')).toBeInTheDocument()
  expect(screen.getByDisplayValue(petra.name)).toBeInTheDocument()
})
