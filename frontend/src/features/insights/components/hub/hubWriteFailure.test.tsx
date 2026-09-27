import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { people as personSeed } from '@/data/me/people'
import type { PersonResponse } from '@/data/me/peopleApi'
import type { PersonEntry } from '@/data/types'
import { TOAST } from '@/features/insights/logic/hubCopy'
import { MOCK_OBSERVATIONS } from '@/data/insights/knowledgeHub'
import { topicOf } from '@/features/insights/logic/hubTopics'
import { onToast } from '@/shared/lib/toastBus'

/**
 * S6 final review Minor 9 (real mode only — mock mode never fails a write): a hub write updates
 * the cache optimistically when it starts, so a forgotten row never flashes back between the
 * undo window closing and the refetch; and a FAILED write rolls the row back and says so, instead
 * of leaving an "Elfelejtettem"/"Elhallgattattam" toast that is not true.
 */
const renderPage = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const row = (key: string) => document.querySelector<HTMLElement>(`.th-row[data-row="${key}"], .th-eff[data-row="${key}"]`)
const findRow = (key: string) => waitFor(() => {
  const el = row(key)
  if (!el) throw new Error(`row ${key} not yet rendered`)
  return el
})

/** A response the test releases by hand — the request is "in flight" until then. */
function gate() {
  let release!: () => void
  const opened = new Promise<void>((r) => { release = r })
  return { release, fail: async () => { await opened; return new HttpResponse(null, { status: 500 }) } }
}

function collectToasts() {
  const toasts: { kind: string; text: string }[] = []
  const off = onToast((t) => { if ('text' in t) toasts.push({ kind: t.kind, text: t.text }) })
  return { toasts, off }
}

const toWire = (p: PersonEntry) => ({
  id: p.id, name: p.name, initial: p.initial, relationship: p.relationship, relationshipHu: p.relationshipHu,
  aliases: p.aliases, status: p.status, sourceKind: p.sourceKind, affectBaseline: p.affect_baseline,
  contactCadenceLabel: p.contactCadenceLabel, notes: p.notes, knownFacts: p.knownFacts, ties: p.ties,
  affectTrend: p.affectTrend, affectTrendStart: p.affectTrendStart, direction: p.direction,
  directionReason: p.directionReason, mentionCount: p.mentionCount, mentionsThisWeek: p.mentionsThisWeek,
  lastMentionedAt: p.last_mentioned_at || null, graphEdges: p.graphEdges,
  facts: p.facts.map((f) => ({
    id: f.id, personId: f.personId, kind: f.kind, factText: f.text, confidence: f.confidence,
    sourceRefKind: f.sourceKind, sourceRefId: f.sourceRefId, includeInPrompt: f.includeInPrompt, seen: f.seen,
    createdAt: f.createdAt,
  })),
}) as unknown as PersonResponse

describe.skipIf(isMockMode())('hub writes that fail (real mode)', () => {
  describe('Elfelejtem', () => {
    beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
    afterEach(() => { vi.useRealTimers() })

    const forgetAndFail = async (opts: {
      path: string; key: string; method: 'delete' | 'put'; url: string; open?: () => Promise<void>
    }) => {
      const g = gate()
      const sent: string[] = []
      server.use(http[opts.method](`${API_BASE}${opts.url}`, ({ request }) => {
        sent.push(new URL(request.url).pathname)
        return g.fail()
      }))
      const { toasts, off } = collectToasts()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage(opts.path)
      if (opts.open) await opts.open()
      const r = await findRow(opts.key)
      await user.click(within(r).getByRole('button', { name: 'További műveletek' }))
      await user.click(within(r).getByRole('button', { name: /Elfelejtem/ }))
      await act(() => vi.advanceTimersByTimeAsync(5100))
      await waitFor(() => expect(sent).toHaveLength(1))
      // the window closed and the request is in flight: the row must NOT flash back
      expect(row(opts.key)).toBeNull()
      g.release()
      await waitFor(() => expect(row(opts.key)).not.toBeNull())
      await waitFor(() => expect(toasts).toContainEqual({ kind: 'error', text: TOAST.forgetFailed }))
      off()
    }

    test('Rólad: a fact', async () => {
      await forgetAndFail({
        path: '/?view=tenyek', key: 'f:f10', method: 'delete', url: '/api/companion/fact/:id',
        open: async () => { await userEvent.click(await screen.findByRole('button', { name: /Étkezés ·/ })) },
      })
    })

    test('Emberek: a person fact', async () => {
      server.use(http.get(`${API_BASE}/api/people`, () =>
        HttpResponse.json({ persons: personSeed.map(toWire), mentions: [], mezoNote: '' })))
      await forgetAndFail({
        path: '/?view=emberek&person=pp-petra', key: 'p:pf-petra-2', method: 'delete', url: '/api/people/:pid/facts/:fid',
      })
    })

    test('Észrevételek: an observation', async () => {
      await forgetAndFail({
        path: '/?view=eszrevetelek', key: 'o:o1', method: 'delete', url: '/api/companion/observation/:id',
        open: async () => {
          await screen.findByRole('button', { name: /^Mind/ })
          const o1 = MOCK_OBSERVATIONS.find((o) => o.patternId === 'o1')!
          await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${topicOf(o1)} ·`) }))
        },
      })
    })

    test('Hatások: an effect subject', async () => {
      await forgetAndFail({
        path: '/?view=hatasok', key: 'e:event:edzes', method: 'put', url: '/api/companion/effects/:kind/:key/mute',
        open: async () => { await userEvent.click(await screen.findByRole('button', { name: /^Események ·/ })) },
      })
    })
  })

  describe('Elhallgattatom', () => {
    test('Rólad: a failed mute puts the fact back among the active ones and says so', async () => {
      server.use(http.patch(`${API_BASE}/api/companion/fact/:id`, () => new HttpResponse(null, { status: 500 })))
      const { toasts, off } = collectToasts()
      renderPage('/?view=tenyek')
      await userEvent.click(await screen.findByRole('button', { name: /Étkezés ·/ }))
      const r = await findRow('f:f10')
      await userEvent.click(within(r).getByRole('button', { name: 'További műveletek' }))
      await userEvent.click(within(r).getByRole('button', { name: /Elhallgattatom/ }))
      await waitFor(() => expect(toasts).toContainEqual({ kind: 'error', text: TOAST.muteFailed }))
      await waitFor(() => expect(row('f:f10')).not.toHaveClass('is-muted'))
      off()
    })

    test('Emberek: a failed person-fact mute rolls back and says so', async () => {
      server.use(
        http.get(`${API_BASE}/api/people`, () =>
          HttpResponse.json({ persons: personSeed.map(toWire), mentions: [], mezoNote: '' })),
        http.patch(`${API_BASE}/api/people/:pid/facts/:fid`, () => new HttpResponse(null, { status: 500 })),
      )
      const { toasts, off } = collectToasts()
      renderPage('/?view=emberek&person=pp-petra')
      const r = await findRow('p:pf-petra-1')
      await userEvent.click(within(r).getByRole('button', { name: 'További műveletek' }))
      await userEvent.click(within(r).getByRole('button', { name: /Elhallgattatom/ }))
      await waitFor(() => expect(toasts).toContainEqual({ kind: 'error', text: TOAST.muteFailed }))
      await waitFor(() => expect(row('p:pf-petra-1')).not.toHaveClass('is-muted'))
      off()
    })

    test('Hatások: a failed subject mute rolls back and says so', async () => {
      server.use(http.put(`${API_BASE}/api/companion/effects/:kind/:key/mute`, () => new HttpResponse(null, { status: 500 })))
      const { toasts, off } = collectToasts()
      renderPage('/?view=hatasok')
      await userEvent.click(await screen.findByRole('button', { name: /^Emberek ·/ }))
      const card = await findRow('e:person:pp-petra')
      await userEvent.click(within(card).getByRole('button', { name: 'További műveletek' }))
      await userEvent.click(within(card).getByRole('button', { name: /Elhallgattatom/ }))
      await waitFor(() => expect(toasts).toContainEqual({ kind: 'error', text: TOAST.muteFailed }))
      await waitFor(() => expect(document.querySelector('.th-eff[data-row="e:person:pp-petra"]')).not.toBeNull())
      off()
    })
  })
})
