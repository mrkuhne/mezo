import type { ReactNode } from 'react'
import type { Experiment } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

/** Hungarian status chips (prototype .stch classes). */
export function experimentChipOf(e: Experiment): { label: ReactNode; chip: string; wash?: string } {
  switch (e.status) {
    case 'proposed':
      return { label: '◇ Javaslat', chip: 'prop' }
    case 'active':
      return { label: '◐ Aktív', chip: 'act', wash: 'amber' }
    case 'dismissed':
      // mezo-hq44: az elvetés x-ikont kap; a ✓ Megerősítve marad glifa (házi pipa-idióma).
      return { label: <><Icon name="x" size={11} /> Elvetve</>, chip: 'mut' }
    default:
      // completed: good / not-good / inconclusive (outcomeGood undefined) — never red
      return e.outcomeGood === true
        ? { label: '✓ Megerősítve', chip: 'ok', wash: 'sage' }
        : e.outcomeGood === false
          ? { label: '◯ Nem igazolódott', chip: 'mut' }
          : { label: '◌ Nem értékelhető', chip: 'mut' }
  }
}


/** A mélyoldal állapot-pirulája + a hero akcentusa (üveg, mezo-me75u.13 — uveg-uzenofal.html
 *  #kiserlet-oldal/*): szó + 3D jel, glifa nélkül (bible U6/45). A lista a fenti chipeket tartja. */
export function experimentStateOf(e: Experiment): {
  label: string
  tone: 'lav' | 'sage' | 'gold' | 'mute'
  art: 't-sprout' | 't-clock' | 't-skip' | 't-tick' | 't-info'
  /** a hero akcentusa: a javaslat és a lezárt kísérlet Mezo-levendula, a futó zsálya */
  hero: 'lav' | 'sage' | 'mute'
} {
  switch (e.status) {
    case 'proposed':
      return { label: 'Javaslat', tone: 'lav', art: 't-sprout', hero: 'lav' }
    case 'active':
      return { label: 'Aktív', tone: 'gold', art: 't-clock', hero: 'sage' }
    case 'dismissed':
      return { label: 'Elvetve', tone: 'mute', art: 't-skip', hero: 'mute' }
    default:
      return e.outcomeGood === true
        ? { label: 'Megerősítve', tone: 'sage', art: 't-tick', hero: 'lav' }
        : e.outcomeGood === false
          ? { label: 'Nem igazolódott', tone: 'mute', art: 't-skip', hero: 'lav' }
          : { label: 'Nem értékelhető', tone: 'mute', art: 't-info', hero: 'lav' }
  }
}
