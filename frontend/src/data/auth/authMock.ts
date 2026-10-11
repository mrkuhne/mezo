import type { MeResponse } from '@/data/auth/authApi'
import { user } from '@/data/today/today'
import { LANG_KEY, normalizeLang, type Lang } from '@/shared/i18n/lang'

/** Mock account language: the device cache (`mezo-lang`) if it holds a supported value, else Hungarian —
 *  never the device/navigator language, so a fresh mock session and the unit tests stay Hungarian.
 *  Lets a layout spec load a route in English by seeding the cache. */
function mockLanguage(): Lang {
  try {
    return normalizeLang(localStorage.getItem(LANG_KEY)) ?? 'hu'
  } catch {
    return 'hu'
  }
}

/** Mock-mode identity — mirrors the static `user` seed so the Én hero and headers stay in sync. */
export const mockMe: MeResponse = {
  id: '00000000-0000-0000-0000-00000000mock',
  email: 'daniel@mezo.local',
  name: user.name,
  role: 'OWNER',
  onboarded: true,
  mustChangePassword: false,
  timezone: 'Europe/Budapest',
  get language(): Lang {
    return mockLanguage()
  },
}
