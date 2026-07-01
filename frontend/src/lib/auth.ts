import { apiFetch, setToken } from '@/lib/api'
import type { components } from '@/lib/api.gen'

type LoginRequest = components['schemas']['LoginRequest']
type TokenResponse = components['schemas']['TokenResponse']

export async function bootstrapOwnerToken(): Promise<void> {
  const { token } = await apiFetch<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: import.meta.env.VITE_OWNER_EMAIL,
      password: import.meta.env.VITE_OWNER_PASSWORD,
    } satisfies LoginRequest),
  })
  setToken(token)
}
