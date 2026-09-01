import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LifeEventCandidateCard } from './LifeEventCandidateCard'
import type { LifeEventCandidate } from '@/data/types'

const candidate: LifeEventCandidate = {
  id: 'ev-1',
  kind: 'LIFE_EVENT',
  title: 'Új munkahely első hete',
  summary: 'Kezdés a marketing csapatban.',
  occurredOn: '2026-08-24',
  proposedEdgeCount: 2,
}

describe('LifeEventCandidateCard — Pontosít (szerkeszt-aztán-elfogad, mezo-ms9a)', () => {
  it('(a) Pontosít-ra a cím- és összefoglaló-mezők a jelölt eredeti szövegével előtöltve jelennek meg', async () => {
    render(<LifeEventCandidateCard candidate={candidate} onDecide={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosít' }))

    const titleInput = screen.getByLabelText('Jelölt címe') as HTMLInputElement
    const summaryInput = screen.getByLabelText('Jelölt összefoglalója') as HTMLTextAreaElement
    expect(titleInput.value).toBe(candidate.title)
    expect(summaryInput.value).toBe(candidate.summary)
    expect(titleInput.maxLength).toBe(160)
    expect(summaryInput.maxLength).toBe(500)
  })

  it('(a) hiányzó summary esetén az összefoglaló-mező üresen indul', async () => {
    render(<LifeEventCandidateCard candidate={{ ...candidate, summary: null }} onDecide={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosít' }))
    expect((screen.getByLabelText('Jelölt összefoglalója') as HTMLTextAreaElement).value).toBe('')
  })

  it('(b) átírás után az „Elfogad így" a decide-ot a refined objektummal hívja', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosít' }))

    const titleInput = screen.getByLabelText('Jelölt címe')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '  Első hét az új csapatban  ')
    const summaryInput = screen.getByLabelText('Jelölt összefoglalója')
    await userEvent.clear(summaryInput)
    await userEvent.type(summaryInput, '  Frissített összefoglaló  ')

    await userEvent.click(screen.getByRole('button', { name: 'Elfogad így' }))

    expect(onDecide).toHaveBeenCalledWith('accept', {
      title: 'Első hét az új csapatban',
      summary: 'Frissített összefoglaló',
    })
  })

  it('(c) „Mégse" visszaviszi a normál kártyához, döntés nélkül, az edit eldobva', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosít' }))

    const titleInput = screen.getByLabelText('Jelölt címe')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Ezt nem kellene elmenteni')

    await userEvent.click(screen.getByRole('button', { name: 'Mégse' }))

    expect(onDecide).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Jelölt címe')).not.toBeInTheDocument()
    expect(screen.getByText(candidate.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pontosít' })).toBeInTheDocument()
  })

  it('(d) a sima „Elfogad" változatlanul refined nélkül hívja a decide-ot', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Elfogad' }))
    expect(onDecide).toHaveBeenCalledWith('accept')
    expect(onDecide).not.toHaveBeenCalledWith('accept', expect.anything())
  })

  it('„Elvet" változatlanul refined nélkül hívja a decide-ot', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Elvet' }))
    expect(onDecide).toHaveBeenCalledWith('reject')
  })

  it('üres cím (trim után) esetén az „Elfogad így" gomb letiltva', async () => {
    render(<LifeEventCandidateCard candidate={candidate} onDecide={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosít' }))
    const titleInput = screen.getByLabelText('Jelölt címe')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '   ')
    expect(screen.getByRole('button', { name: 'Elfogad így' })).toBeDisabled()
  })

  it('SEASON jelölten is megjelenik a Pontosít affordance (kind-agnosztikus)', async () => {
    const season: LifeEventCandidate = { ...candidate, id: 'season-1', kind: 'SEASON' }
    render(<LifeEventCandidateCard candidate={season} onDecide={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pontosít' })).toBeInTheDocument()
  })
})
