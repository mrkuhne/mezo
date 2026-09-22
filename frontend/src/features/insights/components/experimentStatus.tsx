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

