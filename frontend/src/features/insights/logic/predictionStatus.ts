import type { PredictionStatus } from '@/data/types'

/** Hungarian status chips (prototype .stch) — localizing the shipped English ones.
 *  `missed` has no prototype card; it wears the muted chip, never red (guardrail). */
export const PREDICTION_STATUS: Record<PredictionStatus, { label: string; chip: string; wash?: string }> = {
  pending: { label: '◐ Folyamatban', chip: 'pend', wash: 'lav' },
  validated: { label: '✓ Bevált', chip: 'ok', wash: 'sage' },
  missed: { label: '◯ Nem jött be', chip: 'mut' },
}


/** A mélyoldal állapot-pirulája (üveg, mezo-me75u.13 — uveg-uzenofal.html #elore/*): szó +
 *  3D jel + a hero akcentusa. Glifa nélkül: a jelet a sprite adja (bible U6/45). A lista a
 *  fenti `PREDICTION_STATUS` chipjeit tartja (U8b). */
export const PREDICTION_STATE: Record<PredictionStatus, {
  label: string
  tone: 'lav' | 'sage' | 'mute'
  art: 't-clock' | 't-tick' | 't-skip'
}> = {
  pending: { label: 'Folyamatban', tone: 'lav', art: 't-clock' },
  validated: { label: 'Bevált', tone: 'sage', art: 't-tick' },
  missed: { label: 'Nem jött be', tone: 'mute', art: 't-skip' },
}
