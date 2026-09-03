import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { adminApi, type AdminUserResponse, type InviteResponse, type UserStatus } from '@/data/admin/adminApi'
import { ADMIN_INVITES_MOCK, ADMIN_USERS_MOCK, MOCK_TEMP_PASSWORD, mockInviteCode } from '@/data/admin/adminMock'

export const ADMIN_INVITES_KEY = ['admin', 'invites'] as const
export const ADMIN_USERS_KEY = ['admin', 'users'] as const

/** Invite list (mezo-qw37.3). Only mounted on BetaAdminPage, which only an OWNER reaches. */
export function useAdminInvites() {
  return useDualQuery<InviteResponse[]>({
    queryKey: ADMIN_INVITES_KEY,
    mockData: ADMIN_INVITES_MOCK,
    realFetch: adminApi.listInvites,
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
}

export function useAdminUsers() {
  return useDualQuery<AdminUserResponse[]>({
    queryKey: ADMIN_USERS_KEY,
    mockData: ADMIN_USERS_MOCK,
    realFetch: adminApi.listUsers,
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
}

/**
 * Admin mutations. Mock flavor edits the query cache in place (the demo surface must show the
 * consequence of every button — a code appearing, a row disappearing, a status flipping); real
 * flavor calls the API and invalidates the affected list. Errors are NOT swallowed — the
 * QueryProvider mutation cache toasts them (frontend_conventions §7a).
 */
export function useAdminActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const createInvite = useMutation({
    mutationFn: async (label: string | null): Promise<InviteResponse> => {
      if (mock) {
        const invite: InviteResponse = {
          id: crypto.randomUUID(), code: mockInviteCode(), label, createdAt: new Date().toISOString(),
          expiresAt: null, usedBy: null, usedByName: null, usedAt: null,
        }
        qc.setQueryData<InviteResponse[]>(ADMIN_INVITES_KEY, (rows) => [invite, ...(rows ?? ADMIN_INVITES_MOCK)])
        return invite
      }
      return adminApi.createInvite(label)
    },
    onSettled: () => { if (!mock) qc.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }) },
  })

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      if (mock) {
        qc.setQueryData<InviteResponse[]>(ADMIN_INVITES_KEY, (rows) => (rows ?? ADMIN_INVITES_MOCK).filter((i) => i.id !== id))
        return
      }
      await adminApi.deleteInvite(id)
    },
    onSettled: () => { if (!mock) qc.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }) },
  })

  const resetPassword = useMutation({
    mutationFn: async (id: string): Promise<string> => (mock ? MOCK_TEMP_PASSWORD : adminApi.resetPassword(id)),
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UserStatus }) => {
      if (mock) {
        qc.setQueryData<AdminUserResponse[]>(ADMIN_USERS_KEY, (rows) =>
          (rows ?? ADMIN_USERS_MOCK).map((u) => (u.id === id ? { ...u, status } : u)))
        return
      }
      await adminApi.setStatus(id, status)
    },
    onSettled: () => { if (!mock) qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }) },
  })

  return {
    createInvite: (label?: string) => createInvite.mutateAsync(label?.trim() ? label.trim() : null),
    deleteInvite: (id: string) => deleteInvite.mutateAsync(id),
    resetPassword: (id: string) => resetPassword.mutateAsync(id),
    setStatus: (id: string, status: UserStatus) => setStatus.mutateAsync({ id, status }),
    pending: createInvite.isPending || deleteInvite.isPending || resetPassword.isPending || setStatus.isPending,
  }
}
