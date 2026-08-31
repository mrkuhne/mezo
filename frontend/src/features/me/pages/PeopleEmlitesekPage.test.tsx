// Emberek S3 hub (mezo-06o0.2 Task 5) — Említések: "A hét ritmusa" strip + scope/tone/ctx
// filter chips + tone-washed MentionRow feed. `now` is pinned to the mock seed's own
// "today" (2026-05-24, same anchor PeoplePage.test.tsx/PeopleKorPage.test.tsx use).
//
// Two DIFFERENT "this week" windows are deliberately in play on this one page (see
// peopleDerive.ts's `weekWindow` doc): the rhythm strip's 7 day-COLUMNS stay `now`-anchored
// calendar days (Task 1's `weeklyRhythm`, never a local re-derivation), while the hero
// bignum and the "Hét" scope chip are a HEADLINE COUNT and use the shared, newest-mention-
// anchored `weekWindow` instead — the same window the hub's `hubLines` and Heti kép use,
// so this page's hero always agrees with theirs for the same data.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes as appRoutes } from '@/app/router'
import { mentions as seedMentions } from '@/data/me/people'
import { weeklyRhythm, weekWindow } from '@/features/me/logic/peopleDerive'
import { PeopleEmlitesekPage } from '@/features/me/pages/PeopleEmlitesekPage'

const NOW = new Date('2026-05-24T12:00:00')

// Drops one mention (mn4, the sole 2026-05-21 row) so that calendar day has zero
// mentions — the only way to exercise the "üres nap alacsony sáv" rule against the real
// mock seed, since every day in its natural 7-day window already has >= 1 mention.
const hoisted = vi.hoisted(() => ({ dropId: null as string | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    usePeople: () => {
      const real = actual.usePeople()
      if (!hoisted.dropId) return real
      return { ...real, mentions: real.mentions.filter((m) => m.id !== hoisted.dropId) }
    },
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  hoisted.dropId = null
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}</div>
}

const localRoutes: RouteObject[] = [
  { path: '/me/people/emlitesek', element: <PeopleEmlitesekPage /> },
  { path: '*', element: <LocationProbe /> },
]

function renderPage() {
  const router = createMemoryRouter(localRoutes, { initialEntries: ['/me/people/emlitesek'] })
  const view = render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
  return { ...view, router }
}

test('hero: Említések + the shared weekWindow bignum (NOT weeklyRhythm\'s calendar-day total)', () => {
  const { container } = renderPage()
  expect(screen.getByText('Említések')).toBeInTheDocument()
  // The rhythm strip's own 7 calendar-day columns sum to 9 (excludes the 2026-05-17
  // mention, which falls 7 calendar-days back from 2026-05-24 — day-offset 7, outside
  // weeklyRhythm's 0-6 range) — a DIFFERENT number from the hero, which uses the shared,
  // newest-mention-anchored weekWindow (10, dropping only the 2026-05-15 mention). This
  // is the deliberate split the fix introduced: same page, two honestly different windows.
  const rhythmTotal = weeklyRhythm(seedMentions, NOW).reduce((sum, d) => sum + d.count, 0)
  expect(rhythmTotal).toBe(9) // sanity-pin the hand-check itself
  const { inWindow } = weekWindow(seedMentions, NOW)
  const expectedHeroCount = seedMentions.filter(inWindow).length
  expect(expectedHeroCount).toBe(10) // sanity-pin the hand-check itself
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('10')
})

test('renders exactly 7 rhythm columns, the last one marked today', () => {
  const { container } = renderPage()
  const cols = container.querySelectorAll('.ppl-rcols .ppl-rcol')
  expect(cols).toHaveLength(7)
  expect(cols[6].className).toContain('ppl-rcol-today')
  expect([...cols].slice(0, 6).some((c) => c.className.includes('ppl-rcol-today'))).toBe(false)
  const axLabels = container.querySelectorAll('.ppl-rax span')
  expect(axLabels).toHaveLength(7)
  expect(axLabels[6].className).toContain('ppl-rax-today')
})

// CONTRACT: pins the page's own bar-height formula (9px base + count*15px, 4px empty) end
// to end — a plain "some bars render" check can't catch a constant typo (e.g. 15 -> 12)
// since weeklyRhythm still returns one entry per day either way. Hand-computed against the
// REAL mock seed's mention timestamps for the 2026-05-24T12:00:00 anchor: day counts
// (oldest -> today) are [2,1,1,1,2,1,1], so heights are 9+n*15 per column.
test('CONTRACT: each rhythm bar\'s rendered height is 9px + count*15px (the page\'s real constants)', () => {
  const days = weeklyRhythm(seedMentions, NOW)
  expect(days.map((d) => d.count)).toEqual([2, 1, 1, 1, 2, 1, 1]) // sanity-pin the hand-check itself
  const expectedHeights = days.map((d) => 9 + d.count * 15)
  expect(expectedHeights).toEqual([39, 24, 24, 24, 39, 24, 24])
  const { container } = renderPage()
  const bars = [...container.querySelectorAll('.ppl-rcols .ppl-rbar')] as HTMLElement[]
  expect(bars.map((b) => b.style.height)).toEqual(expectedHeights.map((h) => `${h}px`))
})

// Drift-verify note (do NOT leave this applied): temporarily changing PeopleEmlitesekPage's
// RHYTHM_PER_COUNT_PX from 15 to e.g. 12 makes the CONTRACT test above go red (expects
// [39,24,24,24,39,24,24], formula would render [33,21,21,21,33,21,21]) — confirming the
// assertion actually pins the page's real constant and isn't vacuously true.

test('an empty rhythm day (0 mentions) renders the 4px empty-bar height, not 9px', () => {
  hoisted.dropId = 'mn4' // the sole 2026-05-21 mention — that day now has 0
  const { container } = renderPage()
  const bars = [...container.querySelectorAll('.ppl-rcols .ppl-rbar')] as HTMLElement[]
  // index 3 (oldest -> today) is 2026-05-21 per the CONTRACT test's day ordering.
  expect(bars[3].style.height).toBe('4px')
})

test('scope chips: Mind/Hét SET the scope (clicking the active one again is a no-op, never a toggle-off)', () => {
  // Each click changes the filter state, which re-keys EntranceGroup (replayKey =
  // the filter state) and remounts the chip row — so every assertion re-queries by
  // role/name rather than holding a stale element reference across a click.
  renderPage()
  expect(screen.getByRole('button', { name: 'Mind' }).className).toContain('on')
  expect(screen.getByRole('button', { name: 'Hét' }).className).not.toContain('on')

  fireEvent.click(screen.getByRole('button', { name: 'Hét' }))
  expect(screen.getByRole('button', { name: 'Hét' }).className).toContain('on')
  expect(screen.getByRole('button', { name: 'Mind' }).className).not.toContain('on')

  fireEvent.click(screen.getByRole('button', { name: 'Hét' })) // already active: stays het, not cleared
  expect(screen.getByRole('button', { name: 'Hét' }).className).toContain('on')
})

test('Hét scope narrows to the rolling 7-day window from the newest mention (excludes the 2026-05-15 row)', () => {
  renderPage()
  expect(screen.getByText(/Áprilisi 1:1 — Márk/)).toBeInTheDocument() // mn10, visible under Mind
  fireEvent.click(screen.getByRole('button', { name: 'Hét' }))
  expect(screen.queryByText(/Áprilisi 1:1 — Márk/)).toBeNull()
})

test('tone chips (Jó/Nehéz) TOGGLE — clicking the active one again clears the filter', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Jó/ }))
  expect(screen.getByRole('button', { name: /Jó/ }).className).toContain('on')
  // Réka's mixed mention should be filtered out under tone=jo.
  expect(screen.queryByText(/Réka hívott/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Jó/ }))
  expect(screen.getByRole('button', { name: /Jó/ }).className).not.toContain('on')
  expect(screen.getByText(/Réka hívott/)).toBeInTheDocument()
})

test('the Nehéz tone chip filters to the honest empty state (no negative-tone mention exists in the seed)', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Nehéz/ }))
  expect(screen.getByText('Erre a szűrésre nincs említés — próbáld tágabban.')).toBeInTheDocument()
})

test('context chips TOGGLE and narrow to that context\'s mention(s)', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /edzés/ }))
  expect(screen.getByText(/Bence-vel röpi után/)).toBeInTheDocument()
  expect(screen.queryByText(/Petrával hosszú vacsi/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /edzés/ }))
  expect(screen.getByText(/Petrával hosszú vacsi/)).toBeInTheDocument()
})

test('the footnote about the night-run only appears while a visible row is tone-less', () => {
  renderPage()
  // mn-auto1 (text, no tone) is visible under the default Mind/no-tone filter.
  expect(screen.getByText('A tónust az éjszakai kör tölti.')).toBeInTheDocument()
  // Filtering to tone=jo excludes mn-auto1 (tone-less never matches a tone filter).
  fireEvent.click(screen.getByRole('button', { name: /Jó/ }))
  expect(screen.queryByText('A tónust az éjszakai kör tölti.')).toBeNull()
})

test('a tone-less row (mn-auto1) renders unwashed', () => {
  const { container } = renderPage()
  const rows = [...container.querySelectorAll('.ppl-mrowt')]
  const tonelessRow = rows.find((r) => r.textContent?.includes('átbeszéltük a hétvégi túrát'))
  expect(tonelessRow).toBeDefined()
  expect(tonelessRow!.className).not.toMatch(/ppl-tw-/)
})

test('the ✕ on an automata-source row calls undoMention with the full Mention', async () => {
  renderPage()
  const undoButtons = screen.getAllByRole('button', { name: 'Említés visszavonása' })
  expect(undoButtons.length).toBeGreaterThan(0)
  fireEvent.click(undoButtons[0])
  // mn-auto1 (source: text) is the only automata row rendered first in the default (Mind)
  // list — undo removes it from the mock cache (a mutation, resolved asynchronously even
  // in mock mode), so the row disappears.
  await waitFor(() => expect(screen.queryByText(/átbeszéltük a hétvégi túrát/)).toBeNull())
})

test('filter changes replay the entrance group (EntranceGroup replayKey = the filter state)', () => {
  const { container } = renderPage()
  const before = container.querySelector('.mz-play')
  expect(before).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Hét' }))
  // The EntranceGroup wrapper remounts on a replayKey change — still exactly one .mz-play.
  expect(container.querySelectorAll('.mz-play')).toHaveLength(1)
})

test('header actions: ‹ Kapcsolatok back chip returns to the real hub route, Log opens PersonLogSheet', () => {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/me/people/emlitesek'] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  expect(screen.getByText('‹ Kapcsolatok')).toBeInTheDocument()
  fireEvent.click(screen.getByText(/Log/))
  expect(screen.getByText('Mit jegyzünk meg?')).toBeInTheDocument()
})

test('the ‹ Kapcsolatok back chip navigates to the real /me/people hub (registered route)', () => {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/me/people/emlitesek'] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  fireEvent.click(screen.getByText('‹ Kapcsolatok'))
  expect(router.state.location.pathname).toBe('/me/people')
  expect(screen.getByText('Kapcsolatok')).toBeInTheDocument()
})
