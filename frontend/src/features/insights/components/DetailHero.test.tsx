import { render, screen } from '@testing-library/react'
import { DetailFrame } from '@/features/insights/components/DetailHero'

const back = { label: 'Minták', onBack: () => {} }

test('the frame shows either the eyebrow or the aside in the back row', () => {
  const { rerender } = render(<DetailFrame back={back} eyebrow="Előrejelzés"><p>test</p></DetailFrame>)
  expect(screen.getByText('Előrejelzés')).toHaveClass('pdt-nav-eb')
  rerender(<DetailFrame back={back} aside={<span>BEÉPÜLT</span>}><p>test</p></DetailFrame>)
  expect(screen.getByText('BEÉPÜLT')).toBeInTheDocument()
  expect(document.querySelector('.pdt-nav-eb')).toBeNull()
})

test('the props demand exactly one of eyebrow and aside (checked by tsc -b)', () => {
  // @ts-expect-error — neither: the back row would be empty
  const neither = <DetailFrame back={back}><p /></DetailFrame>
  // @ts-expect-error — both: the aside would silently hide the eyebrow
  const both = <DetailFrame back={back} eyebrow="x" aside={<span />}><p /></DetailFrame>
  expect([neither, both]).toHaveLength(2)
})
