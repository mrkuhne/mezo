// Emberek S3 "A köröm" (mezo-06o0.2) — PersonCard's new OPTIONAL spark/ctxDots props.
// Backward-compat is the point: a caller (the hub facepile, older call sites) that never
// passes them must never see an empty `.ppl-spark`/`.ppl-ctxdots` container rendered anyway.
import { render, screen } from '@testing-library/react'
import { people } from '@/data/me/people'
import { PersonCard } from '@/features/me/components/PersonCard'

const petra = people[0] // 'pp-petra' — affectTrend.length === 12, positive baseline

test('without spark/ctxDots props, renders no empty spark/ctxdots containers', () => {
  const { container } = render(<PersonCard person={petra} />)
  expect(container.querySelector('.ppl-spark')).toBeNull()
  expect(container.querySelector('.ppl-ctxdots')).toBeNull()
})

test('spark renders exactly one <i> per height, using the person\'s affect color', () => {
  const { container } = render(<PersonCard person={petra} spark={[4, 8, 12]} />)
  const bars = container.querySelectorAll('.ppl-spark i')
  expect(bars).toHaveLength(3)
  expect((bars[0] as HTMLElement).style.height).toBe('4px')
  expect((bars[2] as HTMLElement).style.height).toBe('12px')
})

test('an empty spark array renders no spark container at all (honest empty state)', () => {
  const { container } = render(<PersonCard person={petra} spark={[]} />)
  expect(container.querySelector('.ppl-spark')).toBeNull()
})

test('ctxDots renders at most 3 dots, colored via CTX_META cssVar tokens', () => {
  const { container } = render(<PersonCard person={petra} ctxDots={['munka', 'csalad', 'edzes', 'egyeb']} />)
  const dots = container.querySelectorAll('.ppl-ctxdots i')
  expect(dots).toHaveLength(3)
  expect((dots[0] as HTMLElement).style.background).toBe('var(--ppl-ctx-munka)')
})

test('an empty ctxDots array renders no ctxdots container at all', () => {
  const { container } = render(<PersonCard person={petra} ctxDots={[]} />)
  expect(container.querySelector('.ppl-ctxdots')).toBeNull()
})

test('the mention-count line reads "N× e héten · N említés"', () => {
  render(<PersonCard person={petra} />)
  expect(screen.getByText(`${petra.mentionsThisWeek}× e héten · ${petra.mentionCount} említés`)).toBeInTheDocument()
})

test('onTap fires on click', () => {
  const onTap = vi.fn()
  render(<PersonCard person={petra} onTap={onTap} />)
  screen.getByRole('button', { name: `${petra.name} részletei` }).click()
  expect(onTap).toHaveBeenCalled()
})
