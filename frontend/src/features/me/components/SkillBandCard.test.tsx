import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'

const rows: SkillRowVM[] = [
  { key: 'a', icon: '🧘', name: 'Tudatosság', level: 3, progressPct: 40, xp: 320 },
  { key: 'b', icon: '💰', name: 'Pénzügyek', level: 1, progressPct: 55, xp: 1085 },
]

test('renders each row with its name, level, formatted XP and a progressPct-wide .skl bar (Task 4 idiom reuse)', () => {
  const { container } = render(<SkillBandCard eyebrow="LIFE" chip="8 skill" rows={rows} />)
  expect(screen.getByText('LIFE')).toBeInTheDocument()
  expect(screen.getByText('8 skill')).toBeInTheDocument()
  expect(screen.getByText('Tudatosság')).toBeInTheDocument()
  expect(screen.getByText('Pénzügyek')).toBeInTheDocument()
  expect(screen.getByText('Lv 3')).toBeInTheDocument()
  expect(screen.getByText('Lv 1')).toBeInTheDocument()
  expect(screen.getByText('320')).toBeInTheDocument()
  expect(screen.getByText('1085')).toBeInTheDocument() // 4-digit hu-HU stays ungrouped
  const rowsEl = container.querySelectorAll('.skl')
  expect(rowsEl).toHaveLength(2)
  expect((rowsEl[0].querySelector('.bar i') as HTMLElement).style.width).toBe('40%')
  expect((rowsEl[1].querySelector('.bar i') as HTMLElement).style.width).toBe('55%')
})

test('renders the footer node when given, omits it otherwise', () => {
  const { rerender } = render(
    <SkillBandCard eyebrow="LIFE" chip="8 skill" rows={rows} footer={<div>Megtakarítás</div>} />,
  )
  expect(screen.getByText('Megtakarítás')).toBeInTheDocument()
  rerender(<SkillBandCard eyebrow="LIFE" chip="8 skill" rows={rows} />)
  expect(screen.queryByText('Megtakarítás')).not.toBeInTheDocument()
})
