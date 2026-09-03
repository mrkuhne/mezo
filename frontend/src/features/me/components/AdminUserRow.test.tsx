import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AdminUserRow } from '@/features/me/components/AdminUserRow'
import { ADMIN_USERS_MOCK } from '@/data/admin/adminMock'

const user = ADMIN_USERS_MOCK.find((u) => u.role === 'USER')! // a non-self USER row — the only kind with a toggle

describe('AdminUserRow', () => {
  it('leaves Jelszó-reset and the status toggle enabled when nothing is pending', () => {
    render(<AdminUserRow user={user} self={false} onReset={vi.fn()} onToggleStatus={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Jelszó-reset/ })).toBeEnabled()
    expect(screen.getByRole('switch')).toBeEnabled()
  })

  it('disables Jelszó-reset and the status toggle while a mutation is pending', () => {
    render(<AdminUserRow user={user} self={false} onReset={vi.fn()} onToggleStatus={vi.fn()} pending />)
    // a rapid double-click on either control would otherwise mint a second temp password
    // (racing the sheet against it) or fire a redundant status flip.
    expect(screen.getByRole('button', { name: /Jelszó-reset/ })).toBeDisabled()
    expect(screen.getByRole('switch')).toBeDisabled()
  })
})
