import { render, screen } from '@testing-library/react'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
import { FeedGuests } from './FeedGuests'

const EMOJI = /\p{Extended_Pictographic}/u

const TWO: NonNullable<FeedPost['guests']> = [
  { author: 'mocor', body: 'A **4. setre** figyelek ⚡' },
  { author: 'szkeptikus', body: 'Ennyi nap még kevés: a pihentebb napok is magyarázhatják.' },
]

/**
 * H4 (mezo-a9bo7.15): a poszt alatti vendég-sorok — a prototípus kommentelőnézete
 * (`uveg-uzenofal.html` `.cmt`): kis avatár, a név, a karakter mondata.
 */
test('két vendég: név + szöveg, a Szkeptikus pala avatárral', () => {
  const { container } = render(<FeedGuests guests={TWO} />)
  const rows = container.querySelectorAll('.tf-cmt')
  expect(rows).toHaveLength(2)
  expect(screen.getByText('Mocor')).toBeInTheDocument()
  expect(screen.getByText('Szkeptikus')).toBeInTheDocument()
  expect(rows[0].textContent).toContain('figyelek')
  // a kiemelés a meglévő inline-renderen megy át
  expect(screen.getByText('4. setre').tagName).toBe('STRONG')

  const slate = rows[1].querySelector('.tf-av')!
  expect(slate.classList.contains('tf-c-slate')).toBe(true)
  expect(slate.querySelector('svg.boop')!.innerHTML).toContain('boop-slate-body')
})

test('a UI nem tesz emojit a sorokba — csak a karakter saját mondata hordozhat', () => {
  const { container } = render(<FeedGuests guests={TWO} />)
  for (const name of container.querySelectorAll('.tf-cmt-name')) expect(name.textContent).not.toMatch(EMOJI)
  for (const av of container.querySelectorAll('.tf-av')) expect(av.textContent).not.toMatch(EMOJI)
  // a Szkeptikus sora teljes egészében emoji-mentes
  expect(container.querySelectorAll('.tf-cmt')[1].textContent).not.toMatch(EMOJI)
})

test('legfeljebb két sor renderel', () => {
  const { container } = render(
    <FeedGuests guests={[...TWO, { author: 'deru', body: 'Harmadik sor.' }]} />,
  )
  expect(container.querySelectorAll('.tf-cmt')).toHaveLength(2)
  expect(screen.queryByText('Harmadik sor.')).not.toBeInTheDocument()
})

test('nulla vendég → semmi', () => {
  expect(render(<FeedGuests guests={[]} />).container.innerHTML).toBe('')
  expect(render(<FeedGuests guests={undefined} />).container.innerHTML).toBe('')
})
