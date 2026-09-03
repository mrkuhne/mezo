import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useAdminInvites, useAdminUsers, useAdminActions } from '@/data/admin/adminHooks'
import { ADMIN_INVITES_MOCK, ADMIN_USERS_MOCK, MOCK_BELA_ID } from '@/data/admin/adminMock'

afterEach(() => vi.unstubAllEnvs())

describe('admin hooks (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the seeds synchronously', () => {
    const wrapper = makeHookWrapper()
    expect(renderHook(() => useAdminInvites(), { wrapper }).result.current.data).toEqual(ADMIN_INVITES_MOCK)
    expect(renderHook(() => useAdminUsers(), { wrapper }).result.current.data).toEqual(ADMIN_USERS_MOCK)
  })

  it('createInvite prepends a fresh readable code to the cache without touching the network', async () => {
    const wrapper = makeHookWrapper()
    const invites = renderHook(() => useAdminInvites(), { wrapper })
    const actions = renderHook(() => useAdminActions(), { wrapper })
    await act(async () => { await actions.result.current.createInvite('Csaba') })
    // Cross-hook cache observation needs a waitFor tick — see the note in the next test.
    await waitFor(() => expect(invites.result.current.data).toHaveLength(ADMIN_INVITES_MOCK.length + 1))
    expect(invites.result.current.data[0].code).toMatch(/^MEZO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(invites.result.current.data[0].label).toBe('Csaba')
  })

  it('deleteInvite removes the row; setStatus flips it; resetPassword yields the demo password', async () => {
    const wrapper = makeHookWrapper()
    const invites = renderHook(() => useAdminInvites(), { wrapper })
    const users = renderHook(() => useAdminUsers(), { wrapper })
    const actions = renderHook(() => useAdminActions(), { wrapper })
    await act(async () => { await actions.result.current.deleteInvite(ADMIN_INVITES_MOCK[0].id) })
    // The mutation edits the cache synchronously, but the OTHER renderHook's observer only
    // re-renders once TanStack Query's notifyManager flushes (a real setTimeout(0), which
    // `act`'s microtask-only await does not wait out) — waitFor gives it that tick.
    await waitFor(() => expect(invites.result.current.data.map((i) => i.id)).not.toContain(ADMIN_INVITES_MOCK[0].id))
    await act(async () => { await actions.result.current.setStatus(MOCK_BELA_ID, 'ACTIVE') })
    await waitFor(() => expect(users.result.current.data.find((u) => u.id === MOCK_BELA_ID)?.status).toBe('ACTIVE'))
    let pw = ''
    await act(async () => { pw = await actions.result.current.resetPassword(MOCK_BELA_ID) })
    expect(pw).toHaveLength(12)
  })
})

describe('admin hooks (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from honest empties, then fetches both lists', async () => {
    const wrapper = makeHookWrapper()
    const invites = renderHook(() => useAdminInvites(), { wrapper })
    const users = renderHook(() => useAdminUsers(), { wrapper })
    expect(invites.result.current.data).toEqual([])
    expect(users.result.current.data).toEqual([])
    await waitFor(() => expect(invites.result.current.data).toHaveLength(ADMIN_INVITES_MOCK.length))
    await waitFor(() => expect(users.result.current.data).toHaveLength(ADMIN_USERS_MOCK.length))
  })

  it('createInvite POSTs the label and resetPassword returns the server password', async () => {
    let posted: unknown = null
    server.use(
      http.post(`${API_BASE}/api/admin/invites`, async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ ...ADMIN_INVITES_MOCK[0], id: 'new-id', code: 'MEZO-AAAA-BBBB', label: 'Csaba' })
      }),
      http.post(`${API_BASE}/api/admin/users/:id/reset-password`, () => HttpResponse.json({ temporaryPassword: 'Xk3pQ9rT2mWn' })),
    )
    const { result } = renderHook(() => useAdminActions(), { wrapper: makeHookWrapper() })
    let created
    await act(async () => { created = await result.current.createInvite('Csaba') })
    expect(posted).toEqual({ label: 'Csaba', expiresInDays: null })
    expect(created).toMatchObject({ code: 'MEZO-AAAA-BBBB' })
    let pw = ''
    await act(async () => { pw = await result.current.resetPassword(MOCK_BELA_ID) })
    expect(pw).toBe('Xk3pQ9rT2mWn')
  })
})
