import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BodyLiq, DayNum, DuoBody, Mchp, MuscleRow, MuscleStack, MuscleTags, Rcap, deepMuscle, muscleLiquid } from './index'

describe('Edzés · shared Folyadék pieces', () => {
  it('deepMuscle: 74% of the muscle colour, the rest ink; an unknown key falls back to the quiet ink', () => {
    expect(muscleLiquid('back-wide')).toBe('var(--sky)')
    expect(deepMuscle('back-wide')).toBe('color-mix(in srgb,var(--sky) 74%,#0A2A3C)')
    expect(muscleLiquid('nope')).toBe('var(--fo-faint)')
  })

  it('Mchp wraps the kept MuscleChip in a chip of the muscle colour; an unknown muscle renders nothing', async () => {
    const { container, rerender } = render(<Mchp muscle="quad" sm />)
    const chip = container.querySelector('.ex-mchp')!
    expect(chip).toHaveStyle({ '--c': 'var(--sage)', '--s': '32px' })
    expect(chip).toHaveAttribute('aria-hidden', 'true')
    await waitFor(() => expect(chip.querySelector('svg.muscle-chip')).not.toBeNull())
    rerender(<Mchp muscle="quad" size={24} />)
    expect(container.querySelector('.ex-mchp')).toHaveStyle({ '--s': '24px' })
    rerender(<Mchp muscle="nope" />)
    expect(container.querySelector('.ex-mchp')).toBeNull()
  })

  it('MuscleStack shows at most three chips', () => {
    const { container } = render(<MuscleStack muscles={['chest-mid', 'back-wide', 'quad', 'shoulder-side']} />)
    expect(container.querySelectorAll('.ex-stk .ex-mchp')).toHaveLength(3)
  })

  it('BodyLiq: one tank per muscle shape of the view, light = planned, deep = done; shared shapes take the highest level', async () => {
    render(
      <BodyLiq view="back" ariaLabel="A mai terhelés hátulról" entries={[
        { muscle: 'back-wide', done: 0.5, planned: 1 },
        { muscle: 'back-mid', done: 0.2, planned: 0.4 },
        { muscle: 'traps', planned: 0.75 },
        { muscle: 'quad', done: 1, planned: 1 },
      ]} />,
    )
    const root = screen.getByRole('img', { name: 'A mai terhelés hátulról' })
    expect(root).toHaveClass('ex-body')
    await waitFor(() => expect(root.querySelector('svg')).not.toBeNull())
    expect(root.querySelector('.sil')!.querySelectorAll('path').length).toBeGreaterThan(10)
    const shapes = [...root.querySelectorAll('[data-shape]')].map((g) => g.getAttribute('data-shape'))
    // the front-only quad is not drawn on the back; back-wide and back-mid share one shape
    expect(shapes).toEqual(['back/upper-back', 'back/trapezius'])
    const upper = root.querySelector('[data-shape="back/upper-back"]')!
    expect(upper.querySelectorAll('path.pl')).toHaveLength(1)
    expect(upper.querySelectorAll('path.dn')).toHaveLength(1)
    expect(upper).toHaveStyle({ '--c': 'var(--sky)', '--cd': deepMuscle('back-wide') })
    const traps = root.querySelector('[data-shape="back/trapezius"]')!
    expect(traps.querySelector('path.dn')).toBeNull()
    // direct fills, no shared gradient (bible §8.1)
    expect(root.querySelector('linearGradient')).toBeNull()
  })

  it('BodyLiq: clip ids are unique per instance and safe in url() (bible §8.2); a caption wraps the figure', async () => {
    const e = [{ muscle: 'chest-mid', done: 0.5, planned: 1 }]
    const { container } = render(<><BodyLiq view="front" entries={e} caption="ennyit kér a ma" width={112} /><BodyLiq view="front" entries={e} off /></>)
    await waitFor(() => expect(container.querySelectorAll('clipPath')).toHaveLength(2))
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((i) => /^[a-zA-Z0-9_-]+$/.test(i))).toBe(true)
    expect(container.querySelector('g[clip-path]')!.getAttribute('clip-path')).toBe(`url(#${ids[0]})`)
    const hb = container.querySelector('.ex-hb')!
    expect(hb).toHaveStyle({ '--w': '112px' })
    expect(hb.querySelector('small')?.textContent).toBe('ennyit kér a ma')
    expect(container.querySelectorAll('.ex-body')[1]).toHaveClass('off')
    expect(container.querySelectorAll('.ex-body')[1]).toHaveAttribute('aria-hidden', 'true')
  })

  it('DuoBody draws the front and the back', async () => {
    const { container } = render(<DuoBody size="sm" ariaLabel="A hét terhelése" entries={[{ muscle: 'quad', done: 1 }, { muscle: 'ham', planned: 1 }]} />)
    expect(screen.getByRole('img', { name: 'A hét terhelése' })).toHaveClass('ex-duo', 'sm')
    await waitFor(() => expect(container.querySelectorAll('.ex-body svg')).toHaveLength(2))
    expect([...container.querySelectorAll('.ex-body')].map((b) => b.getAttribute('data-view'))).toEqual(['front', 'back'])
    expect(container.querySelector('[data-view="front"] [data-shape="front/quadriceps"]')).not.toBeNull()
    expect(container.querySelector('[data-view="back"] [data-shape="back/hamstring"]')).not.toBeNull()
  })

  it('MuscleRow: chip, label, value and a level in the deepened colour; a split or a custom end instead; a button when clickable', () => {
    const on = vi.fn()
    const { container, rerender } = render(<MuscleRow muscle="back-wide" label="Hát" sub="erős" value="0 / 10 szett" pct={40} />)
    const row = container.querySelector('.ex-mus')!
    expect(row.tagName).toBe('DIV')
    expect(row.querySelector('.ex-mchp')).not.toBeNull()
    expect(row.querySelector('.l')?.textContent).toBe('Háterős')
    expect(row.querySelector('.v')?.textContent).toBe('0 / 10 szett')
    expect(row.querySelector('.fo-level')).toHaveStyle({ '--c': deepMuscle('back-wide'), '--h': '12px' })
    rerender(<MuscleRow muscle="back-wide" label="Hát" split={{ a: 30, b: 50 }} onClick={on} ariaLabel="Hát részletei" />)
    expect(container.querySelector('.ex-mus .fo-split i')).toHaveStyle({ width: '30%' })
    expect(container.querySelector('.ex-mus .fo-level')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hát részletei' }))
    expect(on).toHaveBeenCalled()
    rerender(<MuscleRow muscle="back-wide" label="Hát" pct={40} right={<i data-testid="end" />} />)
    expect(container.querySelector('.ex-mus [data-testid="end"]')).not.toBeNull()
    expect(container.querySelector('.ex-mus .fo-level')).toBeNull()
  })

  it('Rcap: the old record is a dashed line kept inside the capsule; DayNum; MuscleTags', () => {
    const { container } = render(<><Rcap prev={99} /><Rcap prev={null} color="green" /><DayNum>21</DayNum><MuscleTags items={[{ muscle: 'back-wide', label: 'Hát' }, { muscle: 'biceps-long', label: 'Kar' }]} /></>)
    const rc = container.querySelectorAll('.ex-rc')
    expect(rc[0]).toHaveStyle({ '--c': 'var(--fo-gold)' })
    expect(rc[0].querySelector('u')).toHaveStyle({ bottom: '92%' })
    expect(rc[1].querySelector('u')).toBeNull()
    expect(container.querySelector('.ex-day')?.textContent).toBe('21')
    expect(container.querySelectorAll('.fo-tags > span > .ex-mchp')).toHaveLength(2)
    expect(container.querySelector('.fo-tags')?.textContent).toBe('HátKar')
  })
})
