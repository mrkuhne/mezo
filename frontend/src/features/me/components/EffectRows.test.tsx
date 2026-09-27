import { render, screen } from '@testing-library/react'
import { EffectRows } from '@/features/me/components/EffectRows'
import { EFFECT_SIGNAL, personEffectSentence } from '@/features/me/logic/effectCopy'
import type { PersonEffect } from '@/data/types'

const ROWS: PersonEffect[] = [
  { metric: 'mental', direction: 'higher', strength: 'eros', confidence: 'kozepes', meanDiff: 1.04, subjectDays: 14 },
  { metric: 'stress', direction: 'lower', strength: 'enyhe', confidence: 'gyenge', meanDiff: -0.5, subjectDays: 7 },
]

// S6 (mezo-d6ivw.6) B12: the indicator rows shared by the person page and the Hatások cards.
describe('EffectRows', () => {
  test('one row per effect with the caller\'s sentence (the S4 wording)', () => {
    render(<EffectRows effects={ROWS} sentence={(e) => personEffectSentence('Barbi', e)} />)
    expect(document.querySelectorAll('.ppl-effrow')).toHaveLength(2)
    expect(screen.getByText('Úgy tűnik, azokon a napokon, amikor Barbi szóba kerül, jobb a hangulatod.')).toBeInTheDocument()
    expect(screen.getByText('Úgy tűnik, azokon a napokon, amikor Barbi szóba kerül, nyugodtabb vagy.')).toBeInTheDocument()
  })

  test('strength and confidence are two SEPARATE dot rows, never one', () => {
    render(<EffectRows effects={ROWS.slice(0, 1)} sentence={() => 'x'} />)
    const strength = screen.getByRole('img', { name: 'erősség: erős' })
    const confidence = screen.getByRole('img', { name: 'bizonyosság: közepes' })
    expect(strength).not.toBe(confidence)
    expect(strength.querySelectorAll('i.on')).toHaveLength(3)
    expect(strength).not.toHaveClass('ring')
    expect(confidence).toHaveClass('ring')
    expect(confidence.querySelectorAll('i.on')).toHaveLength(2)
    expect(screen.getByText(EFFECT_SIGNAL.strength)).toBeInTheDocument()
    expect(screen.getByText(EFFECT_SIGNAL.confidence)).toBeInTheDocument()
  })

  test('"N nap alapján" and the absolute mean difference', () => {
    render(<EffectRows effects={ROWS} sentence={() => 'x'} />)
    expect(screen.getByText('14 nap alapján · átlagosan ~1,0 ponttal')).toBeInTheDocument()
    expect(screen.getByText('7 nap alapján · átlagosan ~0,5 ponttal')).toBeInTheDocument()
  })

  test('the non-causal footnote is always there', () => {
    render(<EffectRows effects={ROWS} sentence={() => 'x'} />)
    expect(screen.getByText('Együttjárás, nem ok-okozat.')).toHaveClass('ppl-efffoot')
  })
})
