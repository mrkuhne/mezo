import type { Lang } from '../lang'
import { frameHu } from './frame.hu'
import { frameEn } from './frame.en'
import { kitHu } from './kit.hu'
import { kitEn } from './kit.en'
import { settingsHu } from './settings.hu'
import { settingsEn } from './settings.en'
// Fuel (Folyadék F5, mezo-n4wf5.5): one shared area, one for the logic label maps, one per build area
import { fuelKozosHu } from './fuel-kozos.hu'
import { fuelKozosEn } from './fuel-kozos.en'
import { fuelLogikaHu } from './fuel-logika.hu'
import { fuelLogikaEn } from './fuel-logika.en'
import { fuelMaiHu } from './fuel-mai.hu'
import { fuelMaiEn } from './fuel-mai.en'
import { fuelLogHu } from './fuel-log.hu'
import { fuelLogEn } from './fuel-log.en'
import { fuelEtkezesHu } from './fuel-etkezes.hu'
import { fuelEtkezesEn } from './fuel-etkezes.en'
import { fuelTanulasHu } from './fuel-tanulas.hu'
import { fuelTanulasEn } from './fuel-tanulas.en'
import { fuelKiegHu } from './fuel-kieg.hu'
import { fuelKiegEn } from './fuel-kieg.en'
import { fuelTrendekHu } from './fuel-trendek.hu'
import { fuelTrendekEn } from './fuel-trendek.en'
import { fuelKamraHu } from './fuel-kamra.hu'
import { fuelKamraEn } from './fuel-kamra.en'
import { fuelReceptHu } from './fuel-recept.hu'
import { fuelReceptEn } from './fuel-recept.en'
import { fuelBeallitasHu } from './fuel-beallitas.hu'
import { fuelBeallitasEn } from './fuel-beallitas.en'

export type Messages = {
  frame: typeof frameHu; kit: typeof kitHu; settings: typeof settingsHu
  fuelKozos: typeof fuelKozosHu; fuelLogika: typeof fuelLogikaHu
  fuelMai: typeof fuelMaiHu; fuelLog: typeof fuelLogHu; fuelEtkezes: typeof fuelEtkezesHu; fuelTanulas: typeof fuelTanulasHu
  fuelKieg: typeof fuelKiegHu; fuelTrendek: typeof fuelTrendekHu; fuelKamra: typeof fuelKamraHu; fuelRecept: typeof fuelReceptHu
  fuelBeallitas: typeof fuelBeallitasHu
}

export const catalogs: Record<Lang, Messages> = {
  hu: {
    frame: frameHu, kit: kitHu, settings: settingsHu,
    fuelKozos: fuelKozosHu, fuelLogika: fuelLogikaHu,
    fuelMai: fuelMaiHu, fuelLog: fuelLogHu, fuelEtkezes: fuelEtkezesHu, fuelTanulas: fuelTanulasHu,
    fuelKieg: fuelKiegHu, fuelTrendek: fuelTrendekHu, fuelKamra: fuelKamraHu, fuelRecept: fuelReceptHu,
    fuelBeallitas: fuelBeallitasHu,
  },
  en: {
    frame: frameEn, kit: kitEn, settings: settingsEn,
    fuelKozos: fuelKozosEn, fuelLogika: fuelLogikaEn,
    fuelMai: fuelMaiEn, fuelLog: fuelLogEn, fuelEtkezes: fuelEtkezesEn, fuelTanulas: fuelTanulasEn,
    fuelKieg: fuelKiegEn, fuelTrendek: fuelTrendekEn, fuelKamra: fuelKamraEn, fuelRecept: fuelReceptEn,
    fuelBeallitas: fuelBeallitasEn,
  },
}
