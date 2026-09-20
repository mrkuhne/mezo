import { describe, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MindenOldalPage, { groupsForDomain, pagesOfDomain } from '@/app/MindenOldalPage'
import { DOMAINS } from '@/app/navModel'
import { PAGE_INDEX } from '@/app/pageIndex'

const renderAt = (path = '/minden') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/minden" element={<MindenOldalPage />} /></Routes>
    </MemoryRouter>,
  )

describe('Minden oldal — az oldal-leltár', () => {
  test('every page in the leltár is rendered exactly once, as a link to itself', () => {
    const { container } = renderAt()
    const links = [...container.querySelectorAll<HTMLAnchorElement>('.mno-group a')]
    // The whole promise of the page: nothing is filtered out on the way to the screen.
    expect(links).toHaveLength(PAGE_INDEX.length)
    const hrefs = links.map((a) => a.getAttribute('href'))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const page of PAGE_INDEX) expect(hrefs).toContain(page.route)
  })

  test('each page shows its name and the one line saying what you can do there', () => {
    renderAt()
    const sample = PAGE_INDEX.find((p) => p.route === '/train/week/jelek')!
    expect(screen.getByText(sample.label)).toBeInTheDocument()
    expect(screen.getByText(sample.hint)).toBeInTheDocument()
  })

  test('all five domains get a section, and the counts add up to the whole leltár', () => {
    const { container } = renderAt()
    const sections = [...container.querySelectorAll('.mno-domain')]
    expect(sections.map((s) => s.id)).toEqual([...DOMAINS.map((d) => d.id), 'settings'])
    const counted = sections.reduce(
      (n, section) => n + section.querySelectorAll('.mno-group a').length, 0,
    )
    expect(counted).toBe(PAGE_INDEX.length)
  })

  test('the groups are the domain\'s own tabs, in bar order — not a second, drifting list', () => {
    const { container } = renderAt()
    const train = container.querySelector('#train')!
    const headings = [...within(train as HTMLElement).getAllByRole('heading', { level: 2 })].map(
      (h) => h.textContent,
    )
    const trainDomain = DOMAINS.find((d) => d.id === 'train')!
    // A subset, in order: a tab with no pages is omitted rather than shown empty.
    expect(headings).toEqual(trainDomain.tabs.map((t) => t.label).filter((l) => headings.includes(l)))
    expect(headings).toContain('Terhelés')
  })

  test('a cross-domain tab route is filed under the domain that owns the tab', () => {
    // `/ritual` is Nap's Napzárás — the case the path shape alone would get wrong.
    expect(pagesOfDomain('nap').map((p) => p.route)).toContain('/ritual')
    const napGroups = groupsForDomain(DOMAINS[0], pagesOfDomain('nap'))
    const napzaras = napGroups.find((g) => g.heading === 'Napzárás')
    expect(napzaras?.pages.map((p) => p.route)).toEqual(['/ritual'])
  })

  test('a page under no tab is shown, not dropped — it lands in „Máshonnan elérhető"', () => {
    // Train is the domain where this can happen: its first tab is `/train/mai`, not the bare
    // `/train`, so a page directly under `/train/` matches no tab route at all.
    const train = DOMAINS.find((d) => d.id === 'train')!
    const page = { route: '/train/valami-uj', label: 'Valami új', hint: 'Még nincs füle.' }
    expect(groupsForDomain(train, [page])).toEqual([{ heading: 'Máshonnan elérhető', pages: [page] }])
  })

  test('the leltár mirrors the CURRENT grouping, warts and all — it is a map, not a proposal', () => {
    // In four of five domains the first tab's route IS the domain root, so every deep page
    // falls under it on the longest-prefix rule — exactly as the bar lights it today. That
    // lopsidedness is the thing being restructured (mezo-ju4j6 phases 5–7); the leltár's job
    // is to SHOW it faithfully, not to quietly file pages where they arguably belong.
    const me = DOMAINS.find((d) => d.id === 'me')!
    const groups = groupsForDomain(me, pagesOfDomain('me'))
    const attekintes = groups.find((g) => g.heading === 'Áttekintés')!
    expect(attekintes.pages.map((p) => p.route)).toContain('/me/goals/weight/diet')
    expect(attekintes.pages.length).toBeGreaterThan(20)
  })

  test('the hash scrolls the matching domain section into view', () => {
    const scrolled: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id) }
    renderAt('/minden#me')
    expect(scrolled).toEqual(['me'])
  })
})
