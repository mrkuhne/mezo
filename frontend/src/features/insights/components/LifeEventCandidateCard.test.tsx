import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LifeEventCandidateCard } from './LifeEventCandidateCard'
import type { LifeEventCandidate } from '@/data/types'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'

const candidate: LifeEventCandidate = {
  id: 'ev-1',
  kind: 'LIFE_EVENT',
  title: 'Új munkahely első hete',
  summary: 'Kezdés a marketing csapatban.',
  occurredOn: '2026-08-24',
  proposedEdgeCount: 2,
  createdAt: '2026-08-25T02:00:00Z',
}

describe('LifeEventCandidateCard — Pontosít (szerkeszt-aztán-elfogad, mezo-ms9a)', () => {
  it('(a) Pontosítom-ra a cím- és összefoglaló-mezők a jelölt eredeti szövegével előtöltve jelennek meg', async () => {
    render(<LifeEventCandidateCard candidate={candidate} onDecide={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))

    const titleInput = screen.getByLabelText('Jelölt címe') as HTMLInputElement
    const summaryInput = screen.getByLabelText('Jelölt összefoglalója') as HTMLTextAreaElement
    expect(titleInput.value).toBe(candidate.title)
    expect(summaryInput.value).toBe(candidate.summary)
    expect(titleInput.maxLength).toBe(160)
    expect(summaryInput.maxLength).toBe(500)
  })

  it('(a) hiányzó summary esetén az összefoglaló-mező üresen indul', async () => {
    render(<LifeEventCandidateCard candidate={{ ...candidate, summary: null }} onDecide={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))
    expect((screen.getByLabelText('Jelölt összefoglalója') as HTMLTextAreaElement).value).toBe('')
  })

  it('(b) átírás után az „Így jegyezd meg" a decide-ot a refined objektummal hívja', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))

    const titleInput = screen.getByLabelText('Jelölt címe')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '  Első hét az új csapatban  ')
    const summaryInput = screen.getByLabelText('Jelölt összefoglalója')
    await userEvent.clear(summaryInput)
    await userEvent.type(summaryInput, '  Frissített összefoglaló  ')

    await userEvent.click(screen.getByRole('button', { name: 'Így jegyezd meg' }))

    expect(onDecide).toHaveBeenCalledWith('accept', {
      title: 'Első hét az új csapatban',
      summary: 'Frissített összefoglaló',
    })
  })

  it('(b2) üres összefoglalóval az „Így jegyezd meg" a summary mezőt undefined-ként küldi (nem ""-ként)', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))

    const summaryInput = screen.getByLabelText('Jelölt összefoglalója')
    await userEvent.clear(summaryInput)

    await userEvent.click(screen.getByRole('button', { name: 'Így jegyezd meg' }))

    expect(onDecide).toHaveBeenCalledWith('accept', {
      title: candidate.title,
      summary: undefined,
    })
    const [, refined] = onDecide.mock.calls[0]
    expect('summary' in refined).toBe(true)
    expect(refined.summary).toBeUndefined()
  })

  it('(c) „Mégse" visszaviszi a normál kártyához, döntés nélkül, az edit eldobva', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))

    const titleInput = screen.getByLabelText('Jelölt címe')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Ezt nem kellene elmenteni')

    await userEvent.click(screen.getByRole('button', { name: 'Mégse' }))

    expect(onDecide).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Jelölt címe')).not.toBeInTheDocument()
    expect(screen.getByText(candidate.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pontosítom' })).toBeInTheDocument()
  })

  it('(d) a sima „Igen, jegyezd meg" változatlanul refined nélkül hívja a decide-ot', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Igen, jegyezd meg' }))
    expect(onDecide).toHaveBeenCalledWith('accept')
    expect(onDecide).not.toHaveBeenCalledWith('accept', expect.anything())
  })

  it('„Nem igaz" változatlanul refined nélkül hívja a decide-ot', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Nem igaz' }))
    expect(onDecide).toHaveBeenCalledWith('reject')
  })

  it('„Most ne" onDecide(\'snooze\')-t hív', async () => {
    const onDecide = vi.fn()
    render(<LifeEventCandidateCard candidate={candidate} onDecide={onDecide} />)
    await userEvent.click(screen.getByRole('button', { name: 'Most ne' }))
    expect(onDecide).toHaveBeenCalledWith('snooze')
  })

  it('üres cím (trim után) esetén az „Így jegyezd meg" gomb letiltva', async () => {
    render(<LifeEventCandidateCard candidate={candidate} onDecide={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))
    const titleInput = screen.getByLabelText('Jelölt címe')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '   ')
    expect(screen.getByRole('button', { name: 'Így jegyezd meg' })).toBeDisabled()
  })

  it('SEASON jelölten is megjelenik a Pontosítom affordance (kind-agnosztikus)', async () => {
    const season: LifeEventCandidate = { ...candidate, id: 'season-1', kind: 'SEASON' }
    render(<LifeEventCandidateCard candidate={season} onDecide={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pontosítom' })).toBeInTheDocument()
  })
})

describe('LifeEventCandidateCard — byline + státusz (U9b Task 8, mezo-zpxv7)', () => {
  it('LIFE_EVENT esetén az „Életesemény-jelölt" státuszt és a mezo-bylinet mutatja', () => {
    render(<LifeEventCandidateCard candidate={candidate} onDecide={vi.fn()} />)
    expect(screen.getByText('Életesemény-jelölt')).toBeInTheDocument()
  })

  it('SEASON esetén az „Évszak-jelölt" státuszt mutatja', () => {
    const season: LifeEventCandidate = { ...candidate, id: 'season-1', kind: 'SEASON' }
    render(<LifeEventCandidateCard candidate={season} onDecide={vi.fn()} />)
    expect(screen.getByText('Évszak-jelölt')).toBeInTheDocument()
  })
})

describe('LifeEventCandidateCard — byline dátuma + elfogadás-előtti kapcsolat-hint (final-review fix, mezo-zpxv7)', () => {
  it('LIFE_EVENT + occurredOn esetén a byline a jelölt saját napját mutatja, emberi alakban (lastSeenLabel), nem a nyers ISO-t', () => {
    render(<LifeEventCandidateCard candidate={candidate} onDecide={vi.fn()} />)
    expect(screen.getByText(`Mezo hozta · ${lastSeenLabel(candidate.occurredOn!)}`)).toBeInTheDocument()
    expect(screen.queryByText(`Mezo hozta · ${candidate.occurredOn}`)).not.toBeInTheDocument()
  })

  it('SEASON + occurredOn esetén a byline a negyedévet írja ki, nem a nyers dátumot', () => {
    const season: LifeEventCandidate = { ...candidate, id: 'season-1', kind: 'SEASON', occurredOn: '2026-07-01' }
    render(<LifeEventCandidateCard candidate={season} onDecide={vi.fn()} />)
    expect(screen.getByText('Mezo hozta · 2026. III. negyedév')).toBeInTheDocument()
  })

  it('occurredOn hiányában a byline a jelölt felfedezésének napjára esik vissza', () => {
    const noDate: LifeEventCandidate = { ...candidate, occurredOn: null }
    render(<LifeEventCandidateCard candidate={noDate} onDecide={vi.fn()} />)
    expect(screen.getByText(/^Mezo hozta · /)).toBeInTheDocument()
    expect(screen.queryByText(`Mezo hozta · ${candidate.occurredOn}`)).not.toBeInTheDocument()
  })

  it('proposedEdgeCount > 0 esetén az elfogadás-előtti kapcsolat-hint megjelenik', () => {
    render(<LifeEventCandidateCard candidate={candidate} onDecide={vi.fn()} />)
    expect(screen.getByText(`Elfogadás után ${candidate.proposedEdgeCount} kapcsolat is bekerül.`)).toBeInTheDocument()
  })

  it('proposedEdgeCount === 0 esetén nincs kapcsolat-hint', () => {
    const noEdges: LifeEventCandidate = { ...candidate, proposedEdgeCount: 0 }
    render(<LifeEventCandidateCard candidate={noEdges} onDecide={vi.fn()} />)
    expect(screen.queryByText(/kapcsolat is bekerül/)).not.toBeInTheDocument()
  })
})
