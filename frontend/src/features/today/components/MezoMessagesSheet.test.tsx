import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MezoMessagesSheet } from '@/features/today/components/MezoMessagesSheet'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

const briefing: MezoMessageItem = {
  id: 'briefing', eyebrow: 'Reggeli briefing', time: '06:30',
  paragraphs: ['Jó reggelt.', 'Ma Pull Day.'],
  refs: [{ kind: 'workout', label: 'Push Day · tegnap' }],
  meta: 'Demo tartalom',
}
const note: MezoMessageItem = {
  id: 'note', eyebrow: 'Napközi jegyzet', time: '12:30',
  paragraphs: ['Fehérjéből 100 g van meg.'], refs: [], meta: null,
}

describe('MezoMessagesSheet', () => {
  test('párbeszédként nyílik, magyar címmel', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Mezo üzenetei')).toBeInTheDocument()
  })

  test('a briefing MINDEN bekezdése látszik — sehol nincs csonkolás', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByText('Jó reggelt.')).toBeInTheDocument()
    expect(screen.getByText('Ma Pull Day.')).toBeInTheDocument()
    expect(screen.queryByText(/bővebben/i)).not.toBeInTheDocument()
  })

  test('a hivatkozás-chipek és az őszinte meta-címke megjelennek', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByText(/Push Day · tegnap/)).toBeInTheDocument()
    expect(screen.getByText('Demo tartalom')).toBeInTheDocument()
  })

  test('minden üzenet a saját eyebrow-jával és idejével áll, kronologikusan', () => {
    render(<MezoMessagesSheet messages={[briefing, note]} onClose={() => {}} />)
    // A Sheet portálba (document.body) renderel, nem a render() konténerébe.
    const bubbles = [...document.body.querySelectorAll('.td-msg')]
    expect(bubbles).toHaveLength(2)
    expect(within(bubbles[0] as HTMLElement).getByText('Reggeli briefing')).toBeInTheDocument()
    expect(within(bubbles[0] as HTMLElement).getByText('06:30')).toBeInTheDocument()
    expect(within(bubbles[1] as HTMLElement).getByText('Napközi jegyzet')).toBeInTheDocument()
  })

  test('a Kész gomb zárja a sheetet', async () => {
    const onClose = vi.fn()
    render(<MezoMessagesSheet messages={[briefing]} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Kész' }))
    // A Sheet animálva zár; a tesztkörnyezetben a fallback időzítő hívja az onClose-t.
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1000 })
  })

  test('idő nélküli üzenet nem hagy üres időbélyeget', () => {
    render(
      <MezoMessagesSheet messages={[{ ...note, time: null }]} onClose={() => {}} />,
    )
    // A Sheet portálba (document.body) renderel, nem a render() konténerébe.
    expect(document.body.querySelector('.td-bub-t')).toBeNull()
  })
})
