import type { MeResponse } from '@/data/auth/authApi'
import { user } from '@/data/today/today'

/** Mock-mode identity — mirrors the static `user` seed so the Én hero and headers stay in sync. */
export const mockMe: MeResponse = {
  id: '00000000-0000-0000-0000-00000000mock',
  email: 'daniel@mezo.local',
  name: user.name,
  role: 'OWNER',
  onboarded: true,
  mustChangePassword: false,
  timezone: 'Europe/Budapest',
}
