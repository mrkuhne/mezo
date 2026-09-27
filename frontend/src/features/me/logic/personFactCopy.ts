import type { Icon3DName } from '@/shared/ui/clay'
import type { PersonFactKind } from '@/data/types'

// S3 (mezo-d6ivw.3): a normalizált személy-tények fajta-címkéi. S6 (mezo-d6ivw.6): kiemelve a
// PersonDetailPage-ből — a Tudástár Emberek szakasza is ezt a szótárat használja.
export const FACT_KIND_LABEL: Record<PersonFactKind, string> = {
  preference: 'kedveli / nem szereti',
  relationship_state: 'kapcsolat most',
  shared_activity: 'közös',
  important_date: 'fontos dátum',
  sensitivity: 'érzékeny',
}

/** S6: fajta → Titanium 3D ikon a Tudástár személy-tény soraiban (prototype `KIND`). */
export const FACT_KIND_ICON: Record<PersonFactKind, Icon3DName> = {
  preference: 't-thumb-up',
  relationship_state: 't-person',
  shared_activity: 't-link',
  important_date: 't-calendar',
  sensitivity: 't-shield',
}
