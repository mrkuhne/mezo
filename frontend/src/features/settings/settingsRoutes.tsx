import type { RouteObject } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage'

const SettingsPage = lazyPage(() => import('@/features/settings/pages/SettingsPage'), 'SettingsPage')
const TrainSettingsPage = lazyPage(() => import('@/features/settings/pages/TrainSettingsPage'), 'TrainSettingsPage')
const MeSettingsPage = lazyPage(() => import('@/features/settings/pages/MeSettingsPage'), 'MeSettingsPage')
const MezoSettingsPage = lazyPage(() => import('@/features/settings/pages/MezoSettingsPage'), 'MezoSettingsPage')
const NapSettingsPage = lazyPage(() => import('@/features/settings/pages/NapSettingsPage'), 'NapSettingsPage')
const BeallitasokPage = lazyPage(() => import('@/features/me/pages/BeallitasokPage'), 'BeallitasokPage')
const NotificationsPage = lazyPage(() => import('@/features/me/pages/NotificationsPage'), 'NotificationsPage')
const FuelSettingsPage = lazyPage(() => import('@/features/fuel/pages/FuelSettingsPage'), 'FuelSettingsPage')
const FuelSlotsPage = lazyPage(() => import('@/features/fuel/pages/FuelSlotsPage'), 'FuelSlotsPage')
const GoalSettingsPage = lazyPage(() => import('@/features/me/pages/GoalSettingsPage'), 'GoalSettingsPage')

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
