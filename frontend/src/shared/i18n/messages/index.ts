import type { Lang } from '../lang'
import { frameHu } from './frame.hu'
import { frameEn } from './frame.en'
import { kitHu } from './kit.hu'
import { kitEn } from './kit.en'
import { settingsHu } from './settings.hu'
import { settingsEn } from './settings.en'

export type Messages = { frame: typeof frameHu; kit: typeof kitHu; settings: typeof settingsHu }

export const catalogs: Record<Lang, Messages> = {
  hu: { frame: frameHu, kit: kitHu, settings: settingsHu },
  en: { frame: frameEn, kit: kitEn, settings: settingsEn },
}
