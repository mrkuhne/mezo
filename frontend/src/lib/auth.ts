import { apiFetch, setToken } from './api'

export async function bootstrapOwnerToken(): Promise<void> {
  const { token } = await apiFetch<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: import.meta.env.VITE_OWNER_EMAIL,
      password: import.meta.env.VITE_OWNER_PASSWORD,
    }),
  })
  setToken(token)
}
