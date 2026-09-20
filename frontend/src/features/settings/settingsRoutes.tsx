import type { RouteObject } from 'react-router-dom'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { TrainSettingsPage } from '@/features/settings/pages/TrainSettingsPage'
import { MeSettingsPage } from '@/features/settings/pages/MeSettingsPage'
import { MezoSettingsPage } from '@/features/settings/pages/MezoSettingsPage'
import { NapSettingsPage } from '@/features/settings/pages/NapSettingsPage'
import { BeallitasokPage } from '@/features/me/pages/BeallitasokPage'
import { NotificationsPage } from '@/features/me/pages/NotificationsPage'
import { FuelSettingsPage } from '@/features/fuel/pages/FuelSettingsPage'
import { FuelSlotsPage } from '@/features/fuel/pages/FuelSlotsPage'
import { GoalSettingsPage } from '@/features/me/pages/GoalSettingsPage'

/** Mounted under the authenticated app shell; personal-context editor routes join in router.tsx. */
export const settingsRoutes: RouteObject[] = [
  { path: 'settings', element: <SettingsPage /> },
  { path: 'settings/train', element: <TrainSettingsPage /> },
  { path: 'settings/train/gym', element: <TrainSettingsPage key="gym" editor="gym" /> },
  { path: 'settings/train/sport', element: <TrainSettingsPage key="sport" editor="sport" /> },
  { path: 'settings/me', element: <MeSettingsPage /> },
  { path: 'settings/me/biometrics', element: <MeSettingsPage key="biometrics" editor="biometrics" /> },
  { path: 'settings/me/sleep', element: <MeSettingsPage key="sleep" editor="sleep" /> },
  { path: 'settings/me/goal', element: <GoalSettingsPage /> },
  { path: 'settings/mezo', element: <MezoSettingsPage /> },
  { path: 'settings/nap', element: <NapSettingsPage /> },
  { path: 'settings/general', element: <BeallitasokPage /> },
  { path: 'settings/notifications', element: <NotificationsPage /> },
  { path: 'settings/fuel', element: <FuelSettingsPage /> },
  { path: 'settings/fuel/slots', element: <FuelSlotsPage /> },
]
