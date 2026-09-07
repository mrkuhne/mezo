import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { KonziliumRoundMap, KonziliumWhatIs } from './KonziliumRoundMap'
import { MOCK_CONFERENCE_DETAIL } from '@/data/character/characterMock'

const THREADS = MOCK_CONFERENCE_DETAIL.w2.deliberation!

describe('KonziliumWhatIs', () => {
  test('a heti konzílium szövege a hetente szóval kezdődik', () => {
    render(<KonziliumWhatIs kind="WEEKLY" />)
    expect(screen.getByText(/^Hetente/)).toBeInTheDocument()
  })

  test('a havi konzílium szövege a havonta szóval kezdődik', () => {
    render(<KonziliumWhatIs kind="MONTHLY" />)
    expect(screen.getByText(/^Havonta/)).toBeInTheDocument()
  })

  test('a bootstrap konzílium az első beolvasásról beszél', () => {
    render(<KonziliumWhatIs kind="BOOTSTRAP" />)
    expect(screen.getByText(/első beolvasás/)).toBeInTheDocument()
  })
})

describe('KonziliumRoundMap', () => {
  test('mind a négy kör számai a szálakból számolódnak', () => {
    render(<KonziliumRoundMap threads={THREADS} crossTalkRan />)
    expect(screen.getByText('5 felvetés')).toBeInTheDocument()
    expect(screen.getByText('4 hozzászólás')).toBeInTheDocument()
    expect(screen.getByText('4 vizsgálat')).toBeInTheDocument()
    expect(screen.getByText('3 be · 1 el')).toBeInTheDocument()
  })

  test('a kereszt-vita cella kiemelt, ha volt hozzászólás', () => {
    const { container } = render(<KonziliumRoundMap threads={THREADS} crossTalkRan />)
    expect(container.querySelector('.kr-rst.hot')).not.toBeNull()
  })

  test('visszafejtett szálnál a kereszt-vita kör nem létezőnek látszik, nem nullának', () => {
    render(<KonziliumRoundMap threads={[]} crossTalkRan={false} />)
    expect(screen.getByText('nem volt ilyen kör')).toBeInTheDocument()
    expect(screen.queryByText('0 hozzászólás')).not.toBeInTheDocument()
  })

  test('tárolt, de üres kereszt-vita kör nullát mutat', () => {
    render(<KonziliumRoundMap threads={[]} crossTalkRan />)
    expect(screen.getByText('0 hozzászólás')).toBeInTheDocument()
  })
})
