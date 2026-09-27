import type { PredictionStatus } from '@/data/types'

/** A mélyoldal állapot-pirulája (üveg, mezo-me75u.13 — uveg-uzenofal.html #elore/*): szó +
 *  3D jel + a hero akcentusa. Glifa nélkül: a jelet a sprite adja (bible U6/45). A lista is
 *  ezt olvassa (U8b); a régi glifás `PREDICTION_STATUS` chip-térkép a U11-ben ment ki (mezo-mcb44).
 *  A `missed` sosem piros (guardrail). */
export const PREDICTION_STATE: Record<PredictionStatus, {
  label: string
  tone: 'lav' | 'sage' | 'mute'
  art: 't-clock' | 't-tick' | 't-skip'
}> = {
  pending: { label: 'Folyamatban', tone: 'lav', art: 't-clock' },
  validated: { label: 'Bevált', tone: 'sage', art: 't-tick' },
  missed: { label: 'Nem jött be', tone: 'mute', art: 't-skip' },
}
