import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { MOCK_EFFECT_SUBJECTS } from '@/data/insights/knowledgeHub'
import { DEGRADED, EMPTY, FOOT, MUTED_HINT, TOAST, lead } from '@/features/insights/logic/hubCopy'
import { eventEffectSentence, personEffectSentence } from '@/features/me/logic/effectCopy'
import { onToast } from '@/shared/lib/toastBus'

const renderPage = (path = '/?view=hatasok') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const subj = (key: string) => MOCK_EFFECT_SUBJECTS.find((s) => s.key === key)!
const unmuted = (kind: 'person' | 'event') => MOCK_EFFECT_SUBJECTS.filter((s) => s.kind === kind && !s.muted)
const fold = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} ·`) })
const cardOf = (kind: string, key: string) => document.querySelector(`.th-eff[data-row="e:${kind}:${key}"]`) as HTMLElement | null
const rowOf = (kind: string, key: string) => document.querySelector(`.th-row[data-row="e:${kind}:${key}"]`) as HTMLElement | null
const open = async (label: string) => {
  const f = await screen.findByRole('button', { name: new RegExp(`^${label} ·`) })
  if (f.getAttribute('aria-expanded') !== 'true') await userEvent.click(f)
}

// S6 (mezo-d6ivw.6) B12: the Hatások section runs in the mode the suite was started with — the
// final gate runs it twice (VITE_USE_MOCK unset AND =false), so both paths are covered.
describe(`HatasokSection (${isMockMode() ? 'mock' : 'real'} mode)`, () => {
  test('lead, two collapsed groups + Elhallgattatott, and the standing footnote', async () => {
    renderPage()
    expect(await screen.findByText(lead.effects)).toBeInTheDocument()
    expect(fold('Emberek')).toHaveAttribute('aria-expanded', 'false')
    expect(fold('Emberek')).toHaveTextContent(`Emberek · ${unmuted('person').length}ábécérendben`)
    expect(fold('Események')).toHaveTextContent(`Események · ${unmuted('event').length}erősség szerint`)
    expect(fold('Elhallgattatott')).toHaveTextContent(`Elhallgattatott · 1${MUTED_HINT.effects}`)
    expect(screen.getByText(FOOT.effects[0])).toBeInTheDocument()
    expect(document.querySelector('.th-eff')).toBeNull()
  })

  test('Emberek: one glass card per person, alphabetical, nothing glass inside', async () => {
    renderPage()
    await open('Emberek')
    const cards = [...document.querySelectorAll('.th-eff')] as HTMLElement[]
    expect(cards.map((c) => c.dataset.row)).toEqual(['e:person:pp-bence', 'e:person:pp-petra'])
    for (const c of cards) {
      expect(c).toHaveClass('glass')
      expect(c.querySelector('.glass')).toBeNull()
      expect(within(c).getByText('Együttjárás, nem ok-okozat.')).toBeInTheDocument()
    }
    const petra = cardOf('person', 'pp-petra')!
    expect(petra.querySelectorAll('.ppl-effrow')).toHaveLength(subj('pp-petra').effects.length)
    expect(within(petra).getByText(personEffectSentence('Petra', subj('pp-petra').effects[0]))).toBeInTheDocument()
    expect(within(petra).getAllByRole('img', { name: /^erősség:/ })).toHaveLength(subj('pp-petra').effects.length)
    expect(within(petra).getAllByRole('img', { name: /^bizonyosság:/ })).toHaveLength(subj('pp-petra').effects.length)
    expect(within(petra).getAllByText(`${subj('pp-petra').effects[0].subjectDays} nap alapján`, { exact: false }).length).toBeGreaterThan(0)
    // no "Honnan tudom?" on effects (owner-approved)
    expect(within(petra).queryByRole('button', { name: /Honnan tudom/ })).toBeNull()
  })

  test('Események: by strength, with the event sentence', async () => {
    renderPage()
    await open('Események')
    const cards = [...document.querySelectorAll('.th-eff')] as HTMLElement[]
    expect(cards.map((c) => c.dataset.row)).toEqual(['e:event:edzes', 'e:event:mizu-pentek'])
    expect(within(cards[0]).getByText(eventEffectSentence('edzes', subj('edzes').effects[0]))).toBeInTheDocument()
  })

  test('a muted subject sits ONLY under Elhallgattatott, as a flat row with Visszakapcsolom', async () => {
    renderPage()
    await open('Emberek')
    expect(cardOf('person', 'pp-adam')).toBeNull()
    await open('Elhallgattatott')
    const row = rowOf('person', 'pp-adam')!
    expect(row).toHaveClass('is-muted')
    expect(row.closest('.glass')).toBeNull()
    expect(within(row).getByText('Ádám')).toBeInTheDocument()
    expect(within(row).getByText('ember · 1 jelzés')).toBeInTheDocument()
    expect(within(row).getByText('te hallgattattad el')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: /Visszakapcsolom/ })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /Honnan tudom/ })).toBeNull()
  })

  test('Elhallgattatom mutes the whole subject at once (PUT mode muted)', async () => {
    const puts: { path: string; body: unknown }[] = []
    server.use(http.put(`${API_BASE}/api/companion/effects/:kind/:key/mute`, async ({ request }) => {
      puts.push({ path: new URL(request.url).pathname, body: await request.json() })
      return new HttpResponse(null, { status: 204 })
    }))
    const toasts: string[] = []
    const off = onToast((t) => { if ('text' in t) toasts.push(t.text) })
    renderPage()
    await open('Emberek')
    const card = cardOf('person', 'pp-petra')!
    await userEvent.click(within(card).getByRole('button', { name: 'További műveletek' }))
    expect(within(card).getByText(/Elfelejtve soha többé/)).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: /Elhallgattatom/ }))
    off()
    expect(toasts).toEqual([TOAST.muted])
    if (isMockMode()) {
      expect(cardOf('person', 'pp-petra')).toBeNull()
      await open('Elhallgattatott')
      expect(rowOf('person', 'pp-petra')).not.toBeNull()
    } else {
      await waitFor(() => expect(puts).toEqual([{ path: '/api/companion/effects/person/pp-petra/mute', body: { mode: 'muted' } }]))
    }
  })

  test('Visszakapcsolom unmutes (DELETE mute)', async () => {
    const deletes: string[] = []
    server.use(http.delete(`${API_BASE}/api/companion/effects/:kind/:key/mute`, ({ request }) => {
      deletes.push(new URL(request.url).pathname)
      return new HttpResponse(null, { status: 204 })
    }))
    renderPage()
    await open('Elhallgattatott')
    await userEvent.click(within(rowOf('person', 'pp-adam')!).getByRole('button', { name: /Visszakapcsolom/ }))
    if (isMockMode()) {
      await open('Emberek')
      expect(cardOf('person', 'pp-adam')).not.toBeNull()
    } else {
      await waitFor(() => expect(deletes).toEqual(['/api/companion/effects/person/pp-adam/mute']))
    }
  })

  describe('Elfelejtem', () => {
    beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
    afterEach(() => { vi.useRealTimers() })

    test('hides the card at once and PUTs mode forgotten only after 5 s', async () => {
      const puts: { path: string; body: unknown }[] = []
      server.use(http.put(`${API_BASE}/api/companion/effects/:kind/:key/mute`, async ({ request }) => {
        puts.push({ path: new URL(request.url).pathname, body: await request.json() })
        return new HttpResponse(null, { status: 204 })
      }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage()
      await user.click(await screen.findByRole('button', { name: /^Események ·/ }))
      const card = cardOf('event', 'edzes')!
      await user.click(within(card).getByRole('button', { name: 'További műveletek' }))
      await user.click(within(card).getByRole('button', { name: /Elfelejtem/ }))
      expect(cardOf('event', 'edzes')).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent('Elfelejtettem: „Edzésnapok — hatás”')
      expect(screen.getByRole('status')).toHaveTextContent('többé nem mutatom és nem használom')
      await act(() => vi.advanceTimersByTimeAsync(4900))
      expect(puts).toEqual([])
      await act(() => vi.advanceTimersByTimeAsync(200))
      if (!isMockMode()) {
        await waitFor(() => expect(puts).toEqual([{ path: '/api/companion/effects/event/edzes/mute', body: { mode: 'forgotten' } }]))
      } else {
        expect(cardOf('event', 'edzes')).toBeNull()
      }
    })
  })

  test('a search opens the groups with hits; no hits says so', async () => {
    renderPage()
    const box = await screen.findByRole('textbox', { name: 'Keresés ember vagy esemény szerint…' })
    await userEvent.type(box, 'petr')
    expect(fold('Emberek')).toHaveAttribute('aria-expanded', 'true')
    expect(fold('Emberek')).toHaveTextContent('1 találat')
    expect(screen.queryByRole('button', { name: /^Események ·/ })).toBeNull()
    expect(screen.getByText('Petr', { selector: 'mark' })).toBeInTheDocument()
    await userEvent.clear(box)
    await userEvent.type(box, 'zzzz')
    expect(screen.getByText('Nincs találat erre: „zzzz”.')).toBeInTheDocument()
  })

  if (!isMockMode()) {
    test('real mode: the switch off → the section says it is not available', async () => {
      server.use(http.get(`${API_BASE}/api/companion/effects`, () => new HttpResponse(null, { status: 404 })))
      renderPage()
      expect(await screen.findByText(DEGRADED.section)).toBeInTheDocument()
    })

    test('real mode: not enough days yet → the empty line', async () => {
      server.use(http.get(`${API_BASE}/api/companion/effects`, () => HttpResponse.json({ effects: [] })))
      renderPage()
      expect(await screen.findByText(EMPTY.effects)).toBeInTheDocument()
    })

    test('real mode: a failed load offers a retry', async () => {
      server.use(http.get(`${API_BASE}/api/companion/effects`, () => new HttpResponse(null, { status: 500 })))
      renderPage()
      expect(await screen.findByText(DEGRADED.error)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
    })
  }
})
