import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TitleBar } from '@/app/TitleBar'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { FrameProvider } from '@/shared/ui/folyadek'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'
import { setLang } from '@/shared/i18n'
import { act } from '@testing-library/react'

// The title bar in English (mezo-n4wf5.11): every visible word and aria-label of the frame bar and the
// notification panel. The Hungarian cases live in TitleBar.test.tsx (the test setup pins `hu`).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 30, 13, 0, 0))
  setLang('en', { persist: false })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const renderAt = (path: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider>
          <MezoThreadProvider>
            <FrameProvider><TitleBar /></FrameProvider>
          </MezoThreadProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

const barLabels = (container: HTMLElement) =>
  [...container.querySelectorAll('.fo-top button')].map((b) => b.getAttribute('aria-label'))

test('a hub speaks English: five round buttons, the guide, the title and the date', async () => {
  const { container } = renderAt('/fuel')
  await screen.findByRole('button', { name: 'Guide to this page' })
  const labels = barLabels(container)
  expect(labels[0]).toBe('All pages')
  expect(labels[1]).toMatch(/^Messages from Mezo(, \d+ unread)?$/)
  expect(labels[2]).toBe('Notifications, 5 unread')
  expect(labels[3]).toBe('Settings')
  expect(labels[4]).toMatch(/^Your day today · /)
  expect(labels[5]).toBe('Guide to this page')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fuel')
  expect(container.querySelector('.fo-eb')).toHaveTextContent('Sunday, 30 August')
})

test('the Today hub is titled Today', () => {
  renderAt('/nap')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Today')
})

test('a sub-page has Back and a context line in English', async () => {
  const { container } = renderAt('/fuel/recipes')
  expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument()
  expect(container.querySelector('.fo-title small')).toHaveTextContent('Fuel · Kitchen')
})

test('the settings and all-pages routes are titled in English', () => {
  renderAt('/settings')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings')
})

test('the notification panel reads English: heading, count, mark all read, filter, chips, footer', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: /^Notifications/ }))
  const panel = screen.getByRole('dialog', { name: 'Notifications' })
  expect(within(panel).getByText('5 new')).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()
  const filter = within(panel).getByRole('group', { name: 'Filter' })
  expect(within(filter).getByRole('button', { name: /^All, \d+ notifications?$/ })).toBeInTheDocument()
  expect(within(filter).getByRole('button', { name: /^Unread, 5 notifications$/ })).toBeInTheDocument()
  // The category chips follow the language too — no Hungarian label survives on the row.
  const chipText = within(filter).getAllByRole('button').map((b) => b.getAttribute('aria-label')).join('|')
  expect(chipText).not.toMatch(/Minták|Tudás|Kísérletek|Jóslatok|Célok|Összegzés|Emberek|Karakter/)
  expect(within(panel).getByRole('button', { name: 'All notifications ›' })).toBeInTheDocument()
  expect(within(panel).getAllByText('Unread').length).toBeGreaterThan(0)
})

test('the unread filter with nothing left says so in English', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: /^Notifications/ }))
  await user.click(screen.getByRole('button', { name: 'Mark all read' }))
  expect(await screen.findByText('none new')).toBeInTheDocument()
})

test('a mounted title bar re-labels the panel day headings and the orb when the language switches', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: /^Notifications/ }))
  const panel = screen.getByRole('dialog', { name: 'Notifications' })
  const heads = (el: HTMLElement) => within(el).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
  const en = heads(panel)
  expect(en.length).toBeGreaterThan(0)
  for (const h of en) expect(h).toMatch(/^(Today|Yesterday|\d{1,2} [A-Z][a-z]{2})$/)
  act(() => { setLang('hu', { persist: false }) })
  const huPanel = screen.getByRole('dialog', { name: 'Értesítések' })
  const hu = heads(huPanel)
  expect(hu).toHaveLength(en.length)
  for (const h of hu) expect(h).toMatch(/^(Ma|Tegnap|[a-zé]+\. \d{1,2}\.)$/)
  expect(screen.getByRole('button', { name: /^A mai napod/ })).toBeInTheDocument()
})
