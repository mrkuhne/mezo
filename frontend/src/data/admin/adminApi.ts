import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Beta admin (mezo-qw37.3) — OWNER-only; every call answers 403 AUTH_FORBIDDEN for a USER,
// which apiFetch surfaces as ApiError and the mutation cache toasts.
export type InviteResponse = components['schemas']['InviteResponse']
export type AdminUserResponse = components['schemas']['AdminUserResponse']
export type CreateInviteRequest = components['schemas']['CreateInviteRequest']
export type SetUserStatusRequest = components['schemas']['SetUserStatusRequest']
type ResetPasswordResponse = components['schemas']['ResetPasswordResponse']

export type UserStatus = 'ACTIVE' | 'DISABLED'

export const adminApi = {
  listInvites: (): Promise<InviteResponse[]> => apiFetch<InviteResponse[]>('/api/admin/invites'),
  createInvite: (label: string | null): Promise<InviteResponse> =>
    apiFetch<InviteResponse>('/api/admin/invites', {
      method: 'POST',
      body: JSON.stringify({ label, expiresInDays: null } satisfies CreateInviteRequest),
    }),
  deleteInvite: (id: string): Promise<void> => apiFetch<void>(`/api/admin/invites/${id}`, { method: 'DELETE' }),
  listUsers: (): Promise<AdminUserResponse[]> => apiFetch<AdminUserResponse[]>('/api/admin/users'),
  resetPassword: async (id: string): Promise<string> =>
    (await apiFetch<ResetPasswordResponse>(`/api/admin/users/${id}/reset-password`, { method: 'POST' })).temporaryPassword,
  setStatus: (id: string, status: UserStatus): Promise<void> =>
    apiFetch<void>(`/api/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status } satisfies SetUserStatusRequest),
    }),
}
