import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AdminInviteRow } from '@/features/me/components/AdminInviteRow'
import { ADMIN_INVITES_MOCK } from '@/data/admin/adminMock'

const invite = ADMIN_INVITES_MOCK[0] // open (unused) code — the one that renders Törlés

describe('AdminInviteRow', () => {
  it('leaves Törlés enabled when nothing is pending', () => {
    render(<AdminInviteRow invite={invite} onDelete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Törlés/ })).toBeEnabled()
  })

  it('disables Törlés while a mutation is pending, guarding against a double-click', () => {
    render(<AdminInviteRow invite={invite} onDelete={vi.fn()} pending />)
    expect(screen.getByRole('button', { name: /Törlés/ })).toBeDisabled()
  })
})
