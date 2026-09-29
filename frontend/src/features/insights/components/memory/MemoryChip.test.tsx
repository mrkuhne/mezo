import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryChip, memoryLabel } from '@/features/insights/components/memory/MemoryChip'

/** S8 (mezo-d6ivw.12): four variants, each with busy / error / done (lesson 33: gate on the artefact). */
describe('MemoryChip', () => {
  test('remembered (chat): who — text, undo → done line; a failed undo keeps the chip and says so', async () => {
    let fail = true
    const onUndo = vi.fn(async () => { if (fail) throw new Error('x') })
    render(<MemoryChip variant="remembered" item={{ who: 'Dóri', text: 'a strandröpi-párod' }} onUndo={onUndo} />)
    expect(screen.getByText('Megjegyeztem:')).toBeInTheDocument()
    expect(screen.getByText('Dóri')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült visszavonni — próbáld újra.')
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    expect(await screen.findByText('Visszavonva — nem jegyeztem meg.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Visszavonom' })).not.toBeInTheDocument()
  })

  test('remembered (chat) + aboutMe: Rólam is ⇄ Rólad is · kész, two-action layout, locked while busy', async () => {
    let release!: () => void
    const onToggle = vi.fn(() => new Promise<void>((r) => { release = r }))
    const { container, rerender } = render(<MemoryChip variant="remembered" item={{ who: 'Dóri', text: 'mellette önmagam vagyok' }}
      sub="Dóri lapján látod" onUndo={vi.fn()} aboutMe={{ on: false, onToggle }} />)
    expect(container.querySelector('.mzc-memchip.is-remembered.is-two')).not.toBeNull()
    expect(screen.getByText('Dóri lapján látod')).toBeInTheDocument()
    const me = screen.getByRole('button', { name: 'Rólam is' })
    expect(me).toHaveAttribute('aria-pressed', 'false')
    expect(me).toHaveClass('mzc-mbtn', 'is-me')
    await userEvent.click(me)
    expect(onToggle).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Visszavonom' })).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Visszavonom' })).toBeEnabled())
    rerender(<MemoryChip variant="remembered" item={{ who: 'Dóri', text: 'mellette önmagam vagyok' }}
      sub="Dóri lapján és a Tudástár Rólad részében is látod" onUndo={vi.fn()} aboutMe={{ on: true, onToggle }} />)
    const on = screen.getByRole('button', { name: 'Rólad is · kész' })
    expect(on).toHaveAttribute('aria-pressed', 'true')
    expect(on).toHaveClass('is-on')
    expect(screen.getByText('Dóri lapján és a Tudástár Rólad részében is látod')).toBeInTheDocument()
  })

  test('remembered + aboutMe: a failed toggle keeps the chip and says so', async () => {
    const onToggle = vi.fn(async () => { throw new Error('x') })
    render(<MemoryChip variant="remembered" item={{ who: 'Dóri', text: 'x' }} onUndo={vi.fn()} aboutMe={{ on: false, onToggle }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rólam is' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült — próbáld újra.')
    expect(screen.getByRole('button', { name: 'Rólam is' })).toBeEnabled()
  })

  test('remembered without aboutMe keeps the one-action layout', () => {
    const { container } = render(<MemoryChip variant="remembered" item={{ text: 'x' }} onUndo={vi.fn()} />)
    expect(container.querySelector('.is-two')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rólam is' })).not.toBeInTheDocument()
  })

  test('remembered: the sensitivity pill and the kept sub-line', () => {
    render(<MemoryChip variant="remembered" item={{ text: 'x' }} sensitive sub="a Tudástár Rólad részében látod" onUndo={vi.fn()} />)
    expect(screen.getByText('érzékeny')).toBeInTheDocument()
    expect(screen.getByText('a Tudástár Rólad részében látod')).toBeInTheDocument()
  })

  test('remembered/proposed: a forgotten item renders the struck Elfelejtve line', () => {
    render(<MemoryChip variant="proposed" item={{ text: 'nehéz egyedül' }} forgotten onAccept={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/Elfelejtve ·/)).toBeInTheDocument()
    expect(screen.getByText('nehéz egyedül').tagName).toBe('S')
  })

  test('proposed: Igen/Ne with the sub-line; Ne → the no-repropose line; buttons lock while busy', async () => {
    let release!: () => void
    const onReject = vi.fn(() => new Promise<void>((r) => { release = r }))
    render(<MemoryChip variant="proposed" item={{ text: 'nehéz egyedül' }} onAccept={vi.fn()} onReject={onReject} />)
    expect(screen.getByText('Megjegyezném:')).toBeInTheDocument()
    expect(screen.getByText('rólad szól, ezért előbb megkérdezlek')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ne' }))
    expect(screen.getByRole('button', { name: 'Igen' })).toBeDisabled()
    release()
    expect(await screen.findByText('Rendben, nem jegyzem meg — és nem is javaslom újra.')).toBeInTheDocument()
  })

  test('recalled: Emlékszem with the names, tap opens', async () => {
    const onOpen = vi.fn()
    render(<MemoryChip variant="recalled" names={['Dóri', 'Bence']} onOpen={onOpen} />)
    expect(screen.getByText('Dóri · Bence')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mit vettem elő róluk' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  test('forgotten: the list, the permanence note, and the widen offer only when there is more', () => {
    const { rerender } = render(<MemoryChip variant="forgotten" items={[{ who: 'Anna', text: 'régi csapattársad' }]} canWiden onWiden={vi.fn()} />)
    expect(screen.getByText('Elfelejtettem:')).toBeInTheDocument()
    expect(screen.getByText('Anna — régi csapattársad')).toBeInTheDocument()
    expect(screen.getByText('végleg — ezeket többé nem használom, és nem is tanulom meg újra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).toBeInTheDocument()
    rerender(<MemoryChip variant="forgotten" items={[{ text: 'x' }]} canWiden={false} onWiden={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).not.toBeInTheDocument()
  })

  test('forgotten: an empty list (nothing was learned from the preceding message) renders the empty state', () => {
    const { rerender } = render(<MemoryChip variant="forgotten" items={[]} canWiden onWiden={vi.fn()} />)
    expect(screen.getByText('Nem volt mit elfelejteni — az előző üzenetedből semmit nem jegyeztem meg.')).toBeInTheDocument()
    expect(screen.queryByText('Elfelejtettem:')).not.toBeInTheDocument()
    expect(screen.queryByText('végleg — ezeket többé nem használom, és nem is tanulom meg újra')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).toBeInTheDocument()

    rerender(<MemoryChip variant="forgotten" items={[]} canWiden={false} onWiden={vi.fn()} />)
    expect(screen.getByText('Nem volt mit elfelejteni — az előző üzenetedből semmit nem jegyeztem meg.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).not.toBeInTheDocument()
  })

  test('csapatfal surface never shows Rólam is', () => {
    render(<MemoryChip variant="remembered" surface="csapatfal" item={{ text: 'meccsnap' }} onUndo={vi.fn()}
      aboutMe={{ on: false, onToggle: vi.fn() }} />)
    expect(screen.queryByRole('button', { name: 'Rólam is' })).not.toBeInTheDocument()
  })

  test('csapatfal surface keeps the S7 DOM: link-style undo, tf-remgone done line', async () => {
    const { container } = render(<MemoryChip variant="remembered" surface="csapatfal" item={{ text: 'meccsnap' }}
      undoneText="Visszavonva — nem jegyeztem meg, és az ügy újra nyitott." onUndo={async () => {}} />)
    expect(container.querySelector('.mzc-remwrap .mzc-remchip .mzc-remundo')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    await waitFor(() => expect(container.querySelector('p.tf-remgone')).toHaveTextContent('az ügy újra nyitott'))
  })

  test('memoryLabel joins who and text with an em dash', () => {
    expect(memoryLabel({ who: 'Bence', text: 'szervez' })).toBe('Bence — szervez')
    expect(memoryLabel({ text: 'rólad' })).toBe('rólad')
  })
})
