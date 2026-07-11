import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { QueryWrapper } from '@/test/queryWrapper'

// LevelUpProvider mirrors production (mounted once in AppLayout) — DailyQuestsCard requires it.
const renderAt = (path: string) => render(
  <QueryWrapper><LevelUpProvider><MemoryRouter initialEntries={[path]}><TodayPage /></MemoryRouter></LevelUpProvider></QueryWrapper>,
)

test('default (medium) renders briefing + quick stats, not AnchorMode', () => {
  renderAt('/today')
  expect(screen.getByText(/briefing/i)).toBeInTheDocument()
  expect(screen.getByText('Most')).toBeInTheDocument()
  expect(screen.queryByText(/Anchor mode/)).not.toBeInTheDocument()
})
test('day=rough renders AnchorMode instead of the normal screen', () => {
  renderAt('/today?day=rough')
  expect(screen.getByText(/Anchor mode · csendben/)).toBeInTheDocument()
  expect(screen.queryByText('Most')).not.toBeInTheDocument()
})
test('vulnerable=on shows the vulnerability card', () => {
  renderAt('/today?vulnerable=on')
  expect(screen.getByText(/sebezhetőbb hangnem/)).toBeInTheDocument()
})
