// The pieces folded into the kit at the end of the Edzés slice (mezo-n4wf5.3): each was a local copy in two or more areas.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Btn, Ft, Hero, HeroGraphic, Level, Lk, Note, Row, Section, St, Stepper, Tags } from './index'

test('Hero: `art` draws the corner glyph, `big` the larger verdict; a Note among the actions is the line on the liquid', () => {
  const { container } = render(
    <Hero big art="t-peak" verdict="Push" actions={<><Btn>Indítás</Btn><Note>Sablonból indulsz</Note></>}>
      <HeroGraphic wide>g</HeroGraphic>
      <Ft items={['a', 'b', 'c']} />
    </Hero>,
  )
  const hero = container.querySelector('.fo-hero')!
  expect(hero).toHaveClass('big', 'has-art')
  expect(hero.querySelector('.fo-hero-art')).toHaveAttribute('aria-hidden', 'true')
  expect(hero.querySelector('.fo-hero-art use')?.getAttribute('href')).toBe('#t-peak')
  expect(hero.querySelector('.fo-hero-g')).toHaveClass('ar')
  expect([...hero.querySelectorAll('.fo-ft span')].map((s) => s.textContent)).toEqual(['a', 'b', 'c'])
  expect(hero.querySelector('.fo-hero-acts > .fo-note')).toHaveTextContent('Sablonból indulsz')
  expect(render(<Hero verdict="x" />).container.querySelector('.fo-hero')).not.toHaveClass('big', 'has-art')
})

test('Row: `chev` — default, hidden, and after a right slot', () => {
  const { container, rerender } = render(<Row title="A" onClick={() => {}} />)
  expect(container.querySelectorAll('.chev')).toHaveLength(1)
  rerender(<Row title="A" onClick={() => {}} chev={false} />)
  expect(container.querySelector('.chev')).toBeNull()
  rerender(<Row title="A" onClick={() => {}} right={<St>riport</St>} />)
  expect(container.querySelector('.chev')).toBeNull()
  rerender(<Row title="A" onClick={() => {}} right={<St>riport</St>} chev />)
  expect(container.querySelector('.fo-row-end > .fo-st + .chev')).not.toBeNull()
  rerender(<Row title="A" onClick={() => {}} chev />)
  expect(container.querySelector('.fo-row-end')).toBeNull()
  expect(container.querySelectorAll('.fo-row > .chev')).toHaveLength(1)
})

test('Row: `disabled` switches the button off, `bad` tones the title', async () => {
  const onClick = vi.fn()
  render(<Row title="Sablon törlése" bad disabled onClick={onClick} />)
  const row = screen.getByRole('button', { name: 'Sablon törlése' })
  expect(row).toBeDisabled()
  expect(row).toHaveClass('fo-row', 'bad')
  await userEvent.click(row)
  expect(onClick).not.toHaveBeenCalled()
})

test('Lk / Btn: the danger tone is a class of the kit', () => {
  render(<><Lk bad>Kivesz</Lk><Btn bad>Lezárás</Btn></>)
  expect(screen.getByRole('button', { name: 'Kivesz' })).toHaveClass('fo-lk', 'bad')
  expect(screen.getByRole('button', { name: 'Lezárás' })).toHaveClass('fo-btn', 'bad')
})

test('Stepper `input`: the value is a text field that alone carries the label; − / + keep their names', async () => {
  const onChange = vi.fn(); const onInc = vi.fn()
  render(<Stepper label="Körök" input={{ value: '4', onChange }} onDec={() => {}} onInc={onInc} />)
  const field = screen.getByLabelText('Körök') // exactly one element answers to the label
  expect(field.tagName).toBe('INPUT')
  expect(field).toHaveValue('4')
  expect(screen.queryByRole('group')).toBeNull()
  await userEvent.type(field, '2')
  expect(onChange).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Körök növelése' }))
  expect(onInc).toHaveBeenCalledTimes(1)
})

test('Stepper without `input` keeps the read-only number in a named group', () => {
  render(<Stepper label="Szett" value={3} onDec={() => {}} onInc={() => {}} />)
  expect(screen.getByRole('group', { name: 'Szett' }).querySelector('b')).toHaveTextContent('3')
})

test('Tags: an icon tag takes a bubble colour; the bubble is not a tag itself', () => {
  const { container } = render(<Tags items={[{ icon: 't-flame', color: 'red', label: 'becslés' }, 'sima']} />)
  const tags = container.querySelectorAll('.fo-tags > span')
  expect(tags).toHaveLength(2)
  expect(tags[0]).toHaveClass('ic')
  expect((tags[0].querySelector('.fo-bub') as HTMLElement).style.getPropertyValue('--c')).toBe('red')
  expect(tags[1]).toHaveClass('tx')
})

test('Level: the label is written once in the DOM; the liquid carries its white copy as data', () => {
  const { container } = render(<Level pct={12} label="3 szett megvan" value="24" />)
  expect(screen.getAllByText('3 szett megvan')).toHaveLength(1)
  expect(container.querySelector('.fo-level i')).toHaveAttribute('data-l', '3 szett megvan')
  expect(render(<Level pct={12} />).container.querySelector('.fo-level i')).not.toHaveAttribute('data-l')
})

test('Section takes a className', () => {
  render(<Section n={2} title="Hol tartasz" className="x" />)
  expect(screen.getByRole('heading', { name: /Hol tartasz/ })).toHaveClass('fo-sec', 'x')
})
