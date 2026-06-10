import type { IdentityGoalCard, AreaRow, QuickSettingRow, NotifSetting } from './types'

export const identityGoal: IdentityGoalCard = {
  eyebrow: 'Identity goal · reflected 7×',
  quote: 'Peak performance every other area of life too.',
  note: 'A te szavaid · 2026 Január. Mezo havonta egyszer visszakanyarítja a beszélgetést erre, ha drift-et észlel.',
}

export const areas: AreaRow[] = [
  { area: 'Edzés · hypertrophy Q2', weight: 0.92, last: 'Pull Day · ma' },
  { area: 'Volleyball · heti 3 alkalom', weight: 0.78, last: 'Csütörtök · 18:00' },
  { area: 'Kapcsolatok · Petra + mentorok', weight: 0.62, last: 'Mizu Velünk · péntek' },
  { area: 'Munka · deep work blokkok', weight: 0.71, last: 'Szerda délelőtt' },
]

export const quickSettings: QuickSettingRow[] = [
  { icon: 'tool', label: 'Integrációk', val: 'Apple Health · Phase 7+' },
  { icon: 'train', label: 'Mesocycle library', val: '12 archived' },
  { icon: 'bookmark', label: 'PsychInsight library', val: '23 study refs' },
  { icon: 'settings', label: 'Adatexport · GDPR', val: '' },
]

export const notifSettings: NotifSetting[] = [
  { icon: 'anchor', label: 'AnchorMode push', val: '06:30' },
  { icon: 'sparkle', label: 'Heti tükör · vasárnap', val: '20:00' },
  { icon: 'voice-wave', label: 'Voice-first input', val: 'Be' },
]

export const appVersion = 'Mezo · v2.0.1 · build 2026.05.22'
