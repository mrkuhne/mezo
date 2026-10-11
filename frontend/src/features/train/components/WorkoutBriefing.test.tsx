import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Challenge } from '@/data/types'
import { WorkoutBriefing, type WorkoutBriefingProps } from './WorkoutBriefing'

const ch = (id: string, exerciseId: string, over: Partial<Challenge> = {}): Challenge => ({
  id, type: 'PR', typeLabel: 'PR-attempt', exerciseId, exercise: `Gyakorlat ${exerciseId}`, target: '107.5 kg × 8',
  confidence: 0.72, risk: 'low', why: 'mert', refs: [], glory: 'csúcs', ...over,
})

function renderBriefing(over: Partial<WorkoutBriefingProps> = {}) {
  const props: WorkoutBriefingProps = {
    title: 'Pull Day', eyebrow: 'PULL DAY · 3. HÉT', minutes: [70, 85], exerciseCount: 2, setCount: 7,
    niggle: null, challenges: [ch('a', 'ex1'), ch('b', 'ex2', { type: 'Depth', typeLabel: 'Mélység' })],
    pending: false, failed: false, ticked: { a: true, b: false }, onToggle: vi.fn(),
    overload: null,
    exercises: [
      { id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', sets: 4, goal: '105 × 10', chip: { text: '↑ +2,5 kg', tone: 'up' } },
      { id: 'ex2', name: 'Lat Pulldown', muscle: 'back-wide', sets: 3, goal: null, chip: null },
    ],
    onBack: vi.fn(), onStart: vi.fn(), ...over,
  }
  render(<WorkoutBriefing {...props} />)
  return props
}

describe('WorkoutBriefing', () => {
  it('explains a target past the range top, and only there (mezo-bk7sn)', () => {
    renderBriefing({
      exercises: [
        { id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', sets: 4, goal: '105 × 9', chip: { text: '↑ +2,5 kg', tone: 'up' }, why: null },
        { id: 'ex4', name: 'Hammer Curl', muscle: 'biceps-brachialis', sets: 3, goal: '15 × 13', chip: { text: '↑ +1 ism.', tone: 'up' },
          why: 'A 17,5 kg +17% ugrás lenne → előbb 13 ismétlés 15 kg-mal' },
      ],
    })
    expect(screen.getByText('A 17,5 kg +17% ugrás lenne → előbb 13 ismétlés 15 kg-mal')).toBeInTheDocument()
    expect(document.querySelectorAll('.ei-warn')).toHaveLength(1)
  })

  it('shows the duration band and the counts', () => {
    renderBriefing()
    const hero = screen.getByLabelText(/várható időtartam/)
    expect(hero).toHaveTextContent('70–85 perc, a saját tempód alapján.')
    // The band is a level: liquid up to the lower bound, the hatched part on to the upper one.
    expect(hero.querySelector('.fo-range > .t > i')).not.toBeNull()
    expect(hero.querySelector('.fo-range > .t > u')).not.toBeNull()
    const facts = [...hero.querySelectorAll('.fo-facts > div')].map((d) => d.textContent)
    expect(facts).toEqual(['2gyakorlat', '7szett', '1küldetés'])
  })

  it('draws the route\'s own title row: back, the context line, the title, the kalauz mark', async () => {
    const user = userEvent.setup()
    const props = renderBriefing({ kalauzButton: <button type="button" aria-label="Kalauz ehhez az oldalhoz">?</button> })
    const top = document.querySelector('[data-kalauz-anchor="session-start"]') as HTMLElement
    expect(within(top).getByRole('heading', { level: 1, name: 'Eligazítás' })).toBeInTheDocument()
    expect(top).toHaveTextContent('PULL DAY · 3. HÉT')
    expect(within(top).getByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeInTheDocument()
    await user.click(within(top).getByRole('button', { name: 'Vissza' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('wears the Folyadék skin only: no glass, no old workout classes, no emoji arrow on the chip', () => {
    const { container } = render(<WorkoutBriefing {...renderBriefingProps({
      challenges: [ch('a', 'ex1')], ticked: { a: true }, niggle: { muscle: 'shoulder', muscleLabel: 'Jobb váll', detail: 'óvatosan' },
      overload: { weightUp: 1, weightDown: 0, repUp: 0, hold: 0 },
      exercises: [{ id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', sets: 4, goal: '105 × 10', chip: { text: '↑ +2,5 kg', tone: 'up' } }],
    })} />)
    expect(container.querySelector('[class*="wbr"], [class*="wos-"], [class*="wo-"], [class*="cer-"], .glass, .uv-flat')).toBeNull()
    expect(container.querySelector('.fo-page.nonav.has-foot')).not.toBeNull()
    expect(container.textContent).not.toMatch(/[↑↓]/)
  })

  it('never prints a number while the band is unknown', () => {
    renderBriefing({ minutes: null })
    const hero = screen.getByLabelText(/várható időtartam/)
    expect(hero).toHaveTextContent('Még számolom, mennyi idő lesz.')
    expect(hero.textContent).not.toMatch(/perc/)
    // the empty vessel: the band's track without a level or tick numbers
    expect(hero.querySelector('.fo-range > .t')).not.toBeNull()
    expect(hero.querySelector('.fo-range > .t > i')).toBeNull()
    expect(hero.querySelector('.fo-range > .ax')).toBeNull()
  })

  it('counts the ticked challenges on the Indulás button and starts on tap', async () => {
    const user = userEvent.setup()
    const props = renderBriefing()
    await user.click(screen.getByRole('button', { name: 'Indulás · 1 küldetéssel' }))
    expect(props.onStart).toHaveBeenCalledTimes(1)
  })

  it('says "Indulás küldetés nélkül" when nothing is ticked', () => {
    renderBriefing({ ticked: {} })
    expect(screen.getByRole('button', { name: 'Indulás küldetés nélkül' })).toBeInTheDocument()
  })

  it('toggling a row reports its id', async () => {
    const user = userEvent.setup()
    const props = renderBriefing()
    await user.click(screen.getByRole('button', { name: /Mélység: vállalom$/ }))
    expect(props.onToggle).toHaveBeenCalledWith('b')
  })

  it('the tick is a pressed-state capsule: filled to the confidence, dashed while still learning', () => {
    renderBriefing({ challenges: [ch('a', 'ex1'), ch('o', 'ex2', { type: 'overload', typeLabel: '⚡ Túlterhelés', confidence: null })], ticked: { a: true, o: true } })
    const sure = screen.getByRole('button', { name: 'Gyakorlat ex1 · Rekord-kísérlet: vállalva' })
    expect(sure).toHaveAttribute('aria-pressed', 'true')
    expect(sure.querySelector('.ex-qc.on')).toHaveStyle({ '--p': '72%' })
    const learning = screen.getByRole('button', { name: 'Gyakorlat ex2 · Túlterhelés: vállalva' })
    expect(learning.querySelector('.ex-qc.nl')).not.toBeNull()
    expect(screen.getByText(/Még tanulom, mennyire biztos · alacsony kockázat/)).toBeInTheDocument()
    expect(screen.getByText(/72% biztos · alacsony kockázat/)).toBeInTheDocument()
    // one chip line: the type with its sprite glyph, then the target
    expect(screen.getAllByText('107,5 kg · 8 ism.', { selector: 'b' })).toHaveLength(2)
    expect(document.querySelector('.ei-quest .ex-qt use[href="#t-record"]')).not.toBeNull()
  })

  it('"Miért?" opens the reason and the glory under its own row, one at a time', async () => {
    const user = userEvent.setup()
    renderBriefing({ challenges: [ch('a', 'ex1', { why: 'első ok', glory: 'első dicsőség' }), ch('b', 'ex2', { why: 'második ok', glory: 'második dicsőség' })] })
    const [first, second] = screen.getAllByRole('button', { name: 'Miért?' })
    expect(first).toHaveAttribute('aria-expanded', 'false')
    await user.click(first)
    expect(screen.getByRole('button', { name: 'Kevesebb' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('első ok')).toBeInTheDocument()
    expect(screen.getByText('első dicsőség')).toBeInTheDocument()
    await user.click(second)
    expect(screen.queryByText('első ok')).toBeNull()
    expect(screen.getByText('második ok')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kevesebb' }))
    expect(screen.queryByText('második ok')).toBeNull()
  })

  it('marks only the exercises a ticked challenge targets', () => {
    renderBriefing()
    expect(screen.getAllByRole('img', { name: 'Van vállalt küldetés' })).toHaveLength(1)
    // the delta chip: the step in words, the direction in its tone
    const chip = screen.getByText('+2,5 kg')
    expect(chip).toHaveClass('ex-dchip', 'up')
    // every row ends in its empty set capsules, one per set
    const rows = [...document.querySelectorAll('.ei-rr')]
    expect(rows.map((r) => r.querySelectorAll('.fo-caps > i').length)).toEqual([4, 3])
    expect(document.querySelector('.ei-rr .fo-caps > i.f')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: /A mai sor · 7 szett vár megtöltésre/ })).toBeInTheDocument()
  })

  it('the overload section appears only on a day that moves something, numbered in order', () => {
    const { unmount } = render(<WorkoutBriefing {...renderBriefingProps({ overload: { weightUp: 2, weightDown: 1, repUp: 1, hold: 1 } })} />)
    expect(screen.getByRole('heading', { level: 2, name: /^2\s*Ma itt lépünk előre/ })).toBeInTheDocument()
    expect(screen.getByText('Túlterhelés · 2× +súly · 1× +ism. · 1× −súly')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /^3\s*A mai sor/ })).toBeInTheDocument()
    unmount()
    render(<WorkoutBriefing {...renderBriefingProps({ overload: { weightUp: 0, weightDown: 0, repUp: 0, hold: 4 } })} />)
    expect(screen.queryByText(/Ma itt lépünk előre/)).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: /^2\s*A mai sor/ })).toBeInTheDocument()
  })

  it('pending, failed and empty challenge states', () => {
    const { unmount } = render(<WorkoutBriefing {...renderBriefingProps({ challenges: [], failed: true, onRetry: vi.fn() })} />)
    expect(screen.getByText(/nem jöttek le/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
    expect(screen.getByText('Az edzés ettől még indulhat.')).toBeInTheDocument()
    // the quest card keeps its place and the workout can start without quests
    expect(screen.getByRole('heading', { level: 2, name: /Küldetések · mit vállalsz ma\?/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Indulás küldetés nélkül' })).toBeInTheDocument()
    unmount()
    const empty = render(<WorkoutBriefing {...renderBriefingProps({ challenges: [] })} />)
    expect(screen.getByText(/Ma nincs küldetés — ehhez az edzéshez még kevés az előzmény\./)).toBeInTheDocument()
    expect(document.querySelector('.fo-ev')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Újra' })).toBeNull()
    empty.unmount()
    // pending: a polite status in the card; quests that are not on screen are not counted anywhere
    render(<WorkoutBriefing {...renderBriefingProps({ challenges: [ch('a', 'ex1')], ticked: { a: true }, pending: true,
      exercises: [{ id: 'ex1', name: 'Row', muscle: 'back-mid', sets: 3, goal: null, chip: null }] })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Készülnek a mai küldetések…')
    expect(screen.getByRole('button', { name: 'Indulás küldetés nélkül' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Van vállalt küldetés' })).toBeNull()
    expect(screen.queryByRole('button', { name: /vállalva$/ })).toBeNull()
  })

  it('a failed load without a retry handler shows no Újra', () => {
    render(<WorkoutBriefing {...renderBriefingProps({ failed: true })} />)
    expect(screen.getByText(/nem jöttek le/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Újra' })).toBeNull()
  })

  it('renders the niggle callout only when one is active', () => {
    renderBriefing({ niggle: { muscle: 'shoulder', muscleLabel: 'Jobb váll', detail: 'óvatosan' } })
    const note = screen.getByRole('note', { name: 'Sérülés-figyelmeztetés' })
    expect(note).toHaveClass('fo-hero', 'warn')
    expect(note).toHaveTextContent('Figyelj ráJobb váll aktívóvatosan')
    expect(note.querySelector('use[href="#t-bandage"]')).not.toBeNull()
  })

  it('no niggle, no callout; a niggle without a detail gets the careful default', () => {
    const { unmount } = render(<WorkoutBriefing {...renderBriefingProps({})} />)
    expect(screen.queryByRole('note')).toBeNull()
    unmount()
    render(<WorkoutBriefing {...renderBriefingProps({ niggle: { muscle: 'shoulder', muscleLabel: 'Jobb váll', detail: '' } })} />)
    expect(screen.getByRole('note')).toHaveTextContent('Óvatosan, először bemelegítés')
  })
})

function renderBriefingProps(over: Partial<WorkoutBriefingProps>): WorkoutBriefingProps {
  return {
    title: 'Pull Day', eyebrow: 'X', minutes: [70, 85], exerciseCount: 0, setCount: 0, niggle: null,
    challenges: [], pending: false, failed: false, ticked: {}, onToggle: vi.fn(), overload: null,
    exercises: [], onBack: vi.fn(), onStart: vi.fn(), ...over,
  }
}
