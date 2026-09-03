import type { AdminUserResponse, InviteResponse } from '@/data/admin/adminApi'

// Mock-mode admin seed (spec §7): 2–3 fictive accounts + 2 codes. The owner id matches
// LLM_CALL_DETAIL_MOCK.createdBy so the AI-napló per-user chips and this list agree.
export const MOCK_OWNER_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_ANNA_ID = '00000000-0000-4000-8000-000000000002'
export const MOCK_BELA_ID = '00000000-0000-4000-8000-000000000003'

export const ADMIN_USERS_MOCK: AdminUserResponse[] = [
  { id: MOCK_OWNER_ID, email: 'daniel@mezo.local', name: 'Daniel', role: 'OWNER', status: 'ACTIVE',
    createdAt: '2026-06-01T08:00:00Z', onboardedAt: '2026-06-01T08:00:00Z', lastSeenAt: '2026-08-14T12:32:00Z' },
  { id: MOCK_ANNA_ID, email: 'anna@test.local', name: 'Anna', role: 'USER', status: 'ACTIVE',
    createdAt: '2026-08-02T18:20:00Z', onboardedAt: '2026-08-02T18:35:00Z', lastSeenAt: '2026-08-14T07:10:00Z' },
  { id: MOCK_BELA_ID, email: 'bela@test.local', name: 'Béla', role: 'USER', status: 'DISABLED',
    createdAt: '2026-08-05T09:00:00Z', onboardedAt: null, lastSeenAt: null },
]

export const ADMIN_INVITES_MOCK: InviteResponse[] = [
  { id: 'a1111111-1111-4111-8111-111111111111', code: 'MEZO-7KQ2-XN4P', label: 'Csaba',
    createdAt: '2026-08-13T10:00:00Z', expiresAt: '2026-09-12T10:00:00Z', usedBy: null, usedByName: null, usedAt: null },
  { id: 'a2222222-2222-4222-8222-222222222222', code: 'MEZO-B3RT-9WQA', label: 'Anna',
    createdAt: '2026-08-01T10:00:00Z', expiresAt: null, usedBy: MOCK_ANNA_ID, usedByName: 'Anna', usedAt: '2026-08-02T18:20:00Z' },
]

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Client-side code for mock mode only — the real code is minted by InviteService. */
export function mockInviteCode(): string {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  const block = () => pick() + pick() + pick() + pick()
  return `MEZO-${block()}-${block()}`
}

export const MOCK_TEMP_PASSWORD = 'Teszt-Jelszo'
