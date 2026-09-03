import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GrowthSkillsPage } from '@/features/me/pages/GrowthSkillsPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { GHOST_PROGRESSION_PROFILE, progressionProfileMock } from '@/data/progression/progressionMock'
import type { ProgressionProfileResponse } from '@/data/progression/progressionApi'

const hooks = vi.hoisted(() => ({ useProgressionProfile: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/hooks')>()), ...hooks }))
const renderPage = () => render(<QueryWrapper><MemoryRouter initialEntries={['/me/growth/skillek']}><GrowthSkillsPage /></MemoryRouter></QueryWrapper>)
beforeEach(() => hooks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock }))
afterEach(() => vi.clearAllMocks())

test('hero: 33 skill + ‹ Growth; stat strip LIFE avg / athlete level / muscle best', () => {
  renderPage()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Growth')
  expect(screen.getByText('33')).toBeInTheDocument()
  expect(screen.getByText('1,8')).toBeInTheDocument()      // hu1(1.75) → "1,8"
  expect(screen.getByText('4,3')).toBeInTheDocument()      // athleteLevel
  expect(screen.getAllByText('Lv 6').length).toBeGreaterThanOrEqual(1)     // best muscle (also a plaque)
})

test('three bands with derived chips; one .gr-skl per skill; LIFE rows wear clay icons, no emoji', () => {
  const { container } = renderPage()
  expect(screen.getByText('8 skill · 1 085 XP')).toBeInTheDocument()
  expect(screen.getByText('12 skill · átlag 4,6')).toBeInTheDocument()
  expect(screen.getByText('13 izom · legjobb Lv 6')).toBeInTheDocument()
  expect(container.querySelectorAll('.gr-skl')).toHaveLength(33)
  expect(container.querySelectorAll('.gr-band.lav .gr-skl-ic use')).toHaveLength(8)
  expect(container.textContent).not.toMatch(/[🧘🌱🍳💰🎯📚🤝🛌✨]/u)
  expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
})

test('ghost profile: stat cells show — and no bands', () => {
  hooks.useProgressionProfile.mockReturnValue({ data: GHOST_PROGRESSION_PROFILE })
  const { container } = renderPage()
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  expect(container.querySelectorAll('.gr-band')).toHaveLength(0)
})

test('an unknown LIFE skillKey falls back to a two-letter icon cell, never an emoji', () => {
  const profile: ProgressionProfileResponse = {
    ...progressionProfileMock,
    life: [...progressionProfileMock.life, { skillKey: 'unknown_x', kind: 'LIFE', level: 1, cumulativeXp: 10, progressPct: 10 }],
  }
  hooks.useProgressionProfile.mockReturnValue({ data: profile })
  const { container } = renderPage()
  const unknownRow = [...container.querySelectorAll('.gr-band.lav .gr-skl')].find((el) => el.textContent?.includes('unknown_x'))
  expect(unknownRow).toBeDefined()
  expect(unknownRow?.querySelector('.gr-skl-ic')?.textContent).toBe('un')
  expect(unknownRow?.querySelector('.gr-skl-ic use')).toBeNull()
  expect(container.textContent).not.toMatch(/[🧘🌱🍳💰🎯📚🤝🛌✨]/u)
})
