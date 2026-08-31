// Emberek S3 hub, "Heti kép" sibling page (mezo-06o0.2 Task 6) — the color-mosaic weekly
// read reached from the hub's "Heti kép" tile. Source: docs/design_2.0/prototypes/src/
// emberek-body.html renderHeti() + emberek-head.html `.tonemixc`/`.tonemix`/`.mixleg`/
// `.dirgrid`/`.dirt`/`.arr2`/`.why2`/`.wk`/`.momentt`/`.bigq`/`.quiett`/`.nm3`/`.q3` (x1.18).
//
// Navigation is asserted through the REAL `routes` export (PeopleKorPage.test.tsx /
// PersonDetailPage.test.tsx idiom) so the hub tile -> heti route wiring is exercised end
// to end, not a test-local stand-in.
//
// The weekly scope (tone-mix + "A hét pillanata") is the rolling-7-day window measured
// from the newest mention's OWN timestamp (Task 5's isThisWeek rule, PeopleEmlitesekPage's
// "hét" scope chip) -- never Date.now(). "Irányok"/"Csendben maradt" instead read the
// PersonEntry.mentionsThisWeek FIELD directly (per the brief) -- a persisted count that can
// legitimately diverge from a live recount of the mock mentions array, so the two families
// of section are deliberately tested against different sources of truth below.
import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes } from '@/app/router'
import { people, mentions } from '@/data/me/people'
import { trendHeights } from '@/features/me/logic/peopleDerive'

const hoisted = vi.hoisted(() => ({
  quietPersonId: null as string | null,
  emptyMentions: false,
  noToneMentions: false,
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
      if (hoisted.quietPersonId) {
        people = people.map((p) => (p.id === hoisted.quietPersonId ? { ...p, mentionsThisWeek: 0 } : p))
      }
      if (hoisted.emptyMentions) mentions = []
      if (hoisted.noToneMentions) mentions = mentions.map((m) => ({ ...m, tone: undefined }))
      const logMention = (input: unknown) => {
        hoisted.logMention?.(input)
        real.logMention(input as never)
      }
      return { ...real, people, mentions, logMention }
    },
  }
})

afterEach(() => {
  hoisted.quietPersonId = null
  hoisted.emptyMentions = false
  hoisted.noToneMentions = false
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
const reka = people.find((p) => p.id === 'pp-reka')!
const mark = people.find((p) => p.id === 'pp-mark')!

// Hand-computed against the REAL mock seed (frontend/src/data/me/people.ts), the same
// idiom as PeopleKorPage.test.tsx's spark-height CONTRACT test: this pins the actual
// numbers so a drift in toneMix/isThisWeek's own math fails honestly instead of the test
// re-deriving the same (possibly buggy) formula. Newest mention ts is mn-auto1's
// 2026-05-24T09:00 -> the rolling-7d cutoff is 2026-05-17T09:00, which drops only mn10
// (2026-05-15T21:02, Márk) from the week. Of the remaining 10 week mentions, 9 carry a
// tone: 5 positive (mn1/mn3/mn6/mn7/mn9), 3 mixed (mn2/mn5/mn8), 1 neutral (mn4), 0
// negative — round(5/9*100)=56, round(3/9*100)=33, round(1/9*100)=11.
const WEEK_MENTION_COUNT = 10
const EXPECTED_SLICES = [
  { tone: 'positive', count: 5, pct: 56 },
  { tone: 'mixed', count: 3, pct: 33 },
  { tone: 'neutral', count: 1, pct: 11 },
]

test('hero: "Heti kép" + the week mention bignum', () => {
  renderAt('/me/people/heti')
  expect(screen.getByText('Heti kép')).toBeInTheDocument()
  expect(document.querySelector('.mz-bignum')?.textContent).toBe(String(WEEK_MENTION_COUNT))
})

test('header back chip reads "‹ Kapcsolatok"', () => {
  renderAt('/me/people/heti')
  expect(screen.getByText('‹ Kapcsolatok')).toBeInTheDocument()
})

test('the hub tile\'s "Heti kép" navigation lands here (real router wiring)', () => {
  const { router } = renderAt('/me/people')
  fireEvent.click(screen.getByRole('button', { name: 'Heti kép' }))
  expect(router.state.location.pathname).toBe('/me/people/heti')
})

test('CONTRACT: tone-mix slice widths are toneMix(weekMentions)\'s real pct, hand-computed against the seed', () => {
  renderAt('/me/people/heti')
  const bars = [...document.querySelectorAll('.ppl-tonemix i')] as HTMLElement[]
  expect(bars).toHaveLength(EXPECTED_SLICES.length)
  expect(bars.map((b) => b.style.width)).toEqual(EXPECTED_SLICES.map((s) => `${s.pct}%`))
})

test('tone-mix legend reads "N <tone lowercased>" per TONE_META, and the header shows the week total', () => {
  renderAt('/me/people/heti')
  expect(screen.getByText('A hét tónusa')).toBeInTheDocument()
  expect(screen.getByText(`${WEEK_MENTION_COUNT} említés`)).toBeInTheDocument()
  expect(screen.getByText('5 jó')).toBeInTheDocument()
  expect(screen.getByText('3 vegyes')).toBeInTheDocument()
  expect(screen.getByText('1 ok')).toBeInTheDocument()
})

test('no toned mentions this week renders the honest line instead of a bar', () => {
  hoisted.noToneMentions = true
  renderAt('/me/people/heti')
  expect(document.querySelector('.ppl-tonemix')).toBeNull()
  expect(screen.getByText('Még nincs tónusozott említés ezen a héten.')).toBeInTheDocument()
})

test('Irányok: only mentionsThisWeek > 0 people appear, sorted ↘ down, ↗ up, → flat', () => {
  renderAt('/me/people/heti')
  const cards = [...document.querySelectorAll('.ppl-dirt')]
  // Réka (down, negative-trend), Petra (up, tie -> "változó hetek" not asserted here),
  // Ádám (up), Bence (flat), Márk (flat) — hand-verified against each person's own
  // affectTrend via directionFor's average-of-last-2-vs-earlier rule.
  expect(cards.map((c) => c.querySelector('b')?.textContent)).toEqual([
    reka.name, petra.name, adam.name, bence.name, mark.name,
  ])
  expect(cards.map((c) => c.querySelector('.ppl-arr2')?.textContent)).toEqual(['↘', '↗', '↗', '→', '→'])
})

test('each direction card carries a real trendHeights spark (same idiom as PersonCard/kor)', () => {
  renderAt('/me/people/heti')
  const petraCard = [...document.querySelectorAll('.ppl-dirt')].find((c) => c.querySelector('b')?.textContent === petra.name)!
  const bars = [...petraCard.querySelectorAll('.ppl-spark i')] as HTMLElement[]
  const expected = trendHeights(petra.affectTrend, 19)
  expect(bars.map((b) => b.style.height)).toEqual(expected.map((h) => `${h}px`))
})

test('each direction card shows "N× E HÉTEN" off the person\'s own mentionsThisWeek field', () => {
  renderAt('/me/people/heti')
  expect(screen.getByText(`${reka.mentionsThisWeek}× E HÉTEN`)).toBeInTheDocument()
  expect(screen.getByText(`${petra.mentionsThisWeek}× E HÉTEN`)).toBeInTheDocument()
})

test('why line: majority tone among the person\'s OWN week mentions — deterministic S3 stand-in', () => {
  renderAt('/me/people/heti')
  // Bence's only week mention (mn3) is positive -> majority positive.
  const benceCard = [...document.querySelectorAll('.ppl-dirt')].find((c) => c.querySelector('b')?.textContent === bence.name)!
  expect(benceCard.querySelector('.ppl-why2')?.textContent).toBe('sok jó pillanat')
  // Ádám's two week mentions (mn6, mn7) are both positive -> majority positive.
  const adamCard = [...document.querySelectorAll('.ppl-dirt')].find((c) => c.querySelector('b')?.textContent === adam.name)!
  expect(adamCard.querySelector('.ppl-why2')?.textContent).toBe('sok jó pillanat')
  // Réka's two week mentions (mn2, mn8) are both mixed -> no positive/negative majority.
  const rekaCard = [...document.querySelectorAll('.ppl-dirt')].find((c) => c.querySelector('b')?.textContent === reka.name)!
  expect(rekaCard.querySelector('.ppl-why2')?.textContent).toBe('változó hetek')
  // Márk has NO week mention in the mock feed (mn10 falls outside the 7d window) even
  // though his own mentionsThisWeek field is 1 -> no toned week mentions -> "változó hetek".
  const markCard = [...document.querySelectorAll('.ppl-dirt')].find((c) => c.querySelector('b')?.textContent === mark.name)!
  expect(markCard.querySelector('.ppl-why2')?.textContent).toBe('változó hetek')
})

test('clicking a direction card navigates to /me/people/:id (real router)', () => {
  const { router } = renderAt('/me/people/heti')
  const benceCard = [...document.querySelectorAll('.ppl-dirt')].find((c) => c.querySelector('b')?.textContent === bence.name)!
  fireEvent.click(benceCard)
  expect(router.state.location.pathname).toBe(`/me/people/${bence.id}`)
})

test('"A hét pillanata": the weekMoment mention\'s quote, person, time/source line, tonedot', () => {
  renderAt('/me/people/heti')
  // weekMoment(weekMentions) picks the first FLAGGED week mention: mn2 (Réka, mixed).
  expect(screen.getByText('A hét pillanata')).toBeInTheDocument()
  const moment = document.querySelector('.ppl-momentt')!
  expect(moment.querySelector('.ppl-bigq')?.textContent).toBe(
    '„Réka hívott · másfél óra · munkahely, lakhatás. Megint a \'lebegés\' szót használta. Holnap follow-up.”',
  )
  expect(moment.textContent).toContain(reka.name)
  expect(moment.textContent).toContain('22:18')
  expect(moment.textContent).toContain('hang')
})

test('"A hét pillanata" is OMITTED entirely when the week has no mentions', () => {
  hoisted.emptyMentions = true
  renderAt('/me/people/heti')
  expect(screen.queryByText('A hét pillanata')).toBeNull()
  expect(document.querySelector('.ppl-momentt')).toBeNull()
})

test('"Csendben maradt" is OMITTED when nobody has mentionsThisWeek === 0 (real seed)', () => {
  renderAt('/me/people/heti')
  expect(screen.queryByText('Csendben maradt')).toBeNull()
  expect(document.querySelector('.ppl-quiett')).toBeNull()
})

test('"Csendben maradt" shows a row per quiet person; "Írok neki" opens PersonLogSheet preselecting them', () => {
  hoisted.quietPersonId = mark.id
  const onLog = vi.fn()
  hoisted.logMention = onLog
  renderAt('/me/people/heti')
  expect(screen.getByText('Csendben maradt')).toBeInTheDocument()
  expect(screen.getByText(mark.name)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Írok neki' }))
  expect(screen.getByText('Mit jegyzünk meg?')).toBeInTheDocument()
  // Submit WITHOUT picking anyone in the sheet's own "Ki?" chip row — a successful save
  // proves the sheet's `chosen` state was preloaded with this quiet person (PersonDetailPage
  // "Log most" test idiom).
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ personId: mark.id }))
})

void mentions
