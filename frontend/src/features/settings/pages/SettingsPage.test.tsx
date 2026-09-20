import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'

describe('Settings center', () => {
  it('highlights the originating domain and keeps every domain accessible', () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/settings', state: { from: '/fuel/mai?day=2026-09-20' } }]}><SettingsPage /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Innen érkeztél.*Fuel/ })).toHaveAttribute('href', '/settings/fuel')
    for (const name of ['Fuel', 'Train', 'Mezo', 'Én', 'Nap']) expect(screen.getAllByRole('link', { name: new RegExp(name) }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Vissza az oldalra' })).toHaveAttribute('href', '/fuel/mai?day=2026-09-20')
  })
  it('does not invent an originating domain on direct entry', () => {
    render(<MemoryRouter initialEntries={['/settings']}><SettingsPage /></MemoryRouter>)
    expect(screen.queryByText('Innen érkeztél')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vissza az oldalra' })).toHaveAttribute('href', '/nap')
  })
})
