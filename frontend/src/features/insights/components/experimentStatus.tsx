import type { Experiment } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'

/** A lista státusz-chipjének tónusa (üveg, mezo-me75u.8): egy akcentus chipenként. A lezárt,
 *  elvetett és a „nem igazolódott" kísérlet halk semleges — sosem piros (proactive.md §P2:
 *  „muted, no red/no-penalty tone"; bible U7/53). */
export type ExperimentChipTone = 'lav' | 'amber' | 'sage' | 'mute'

/** A lista státusz-chipje (uveg-mezo-body.html `EXS`): szó + 3D jel, glifa nélkül (bible U6/45). */
export function experimentChipOf(e: Experiment): { label: string; tone: ExperimentChipTone; art: Icon3DName } {
  switch (e.status) {
    case 'proposed':
      return { label: 'Javaslat', tone: 'lav', art: 't-bulb' }
    case 'active':
      return { label: 'Aktív', tone: 'amber', art: 't-clock' }
    case 'dismissed':
      return { label: 'Elvetve', tone: 'mute', art: 't-skip' }
    default:
      // completed: good / not-good / inconclusive (outcomeGood undefined) — never red
      return e.outcomeGood === true
        ? { label: 'Megerősítve', tone: 'sage', art: 't-tick' }
        : e.outcomeGood === false
          ? { label: 'Nem igazolódott', tone: 'mute', art: 't-down' }
          : { label: 'Nem értékelhető', tone: 'mute', art: 't-info' }
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
