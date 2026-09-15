import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { PrepFejlodesPage } from '@/features/train/pages/prep/PrepFejlodesPage'
import type { PrepForecast } from '@/features/train/logic/prepBriefing'

const FORECAST: PrepForecast = { totalXp: 40, skills: [], muscles: [] }

const base = { forecast: FORECAST, workSets: 12, onBack: vi.fn() }

describe('PrepFejlodesPage · overload honesty', () => {
  test('a drops-only day never claims overload, and shows the honest −súly chip', () => {
    render(
      <PrepFejlodesPage {...base} overload={{ weightUp: 0, weightDown: 2, repUp: 0, hold: 3 }} />,
    )
    expect(screen.queryByText(/Túlterhelés/)).toBeNull()
    expect(screen.getByText(/2× −súly/)).toBeInTheDocument()
    expect(screen.getByText(/A visszavett súly is a terv része — innen indul a következő emelkedés\./)).toBeInTheDocument()
    expect(screen.queryByText(/Ezek a gyakorlatok adják az XP-lökés nagyját ma\./)).toBeNull()
  })

  test('a mixed day shows both directions side by side', () => {
    render(
      <PrepFejlodesPage {...base} overload={{ weightUp: 1, weightDown: 1, repUp: 0, hold: 2 }} />,
    )
    expect(screen.getByText(/Túlterhelés/)).toBeInTheDocument()
    expect(screen.getByText(/1× \+súly/)).toBeInTheDocument()
    expect(screen.getByText(/1× −súly/)).toBeInTheDocument()
  })
})
