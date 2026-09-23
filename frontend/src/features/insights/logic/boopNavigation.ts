import type { ClayIconName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'

export interface BoopDestination {
  label: string
  to: string
  icon: ClayIconName
  wash: MozaikWash
  description: string
  primary?: boolean
}

/**
 * The old 12-tile grid lives on as the „Összes funkció” dev-menu beside the Gépterem
 * (csapat-üzenőfal spec §2.4, mezo-a9bo7.10) — no longer a dock tab. `/mezo/menu` redirects here.
 */
export const ALL_FEATURES_ROUTE = '/mezo/karakter/gepterem/osszes'

/** Original feature names and canonical records; menu and crosslinks share this catalog. */
export const BOOP_DESTINATIONS: BoopDestination[] = [
  { label: 'Minták', to: '/mezo/patterns', icon: 'i-minta', wash: 'lav', description: 'Amit újra és újra észreveszünk', primary: true },
  { label: 'Előrejelzések', to: '/mezo/predictions', icon: 'i-kristaly', wash: 'sky', description: 'Mit vártunk, és mi történt?', primary: true },
  { label: 'Diagnózis', to: '/mezo/diagnozis', icon: 'i-muhely', wash: 'gold', description: 'Keressünk magyarázatot együtt', primary: true },
  { label: 'Kísérletek', to: '/mezo/experiments', icon: 'i-lombik', wash: 'sage', description: 'Kis változtatás, követhető eredmény', primary: true },
  { label: 'Heti', to: '/me/week', icon: 'i-heti', wash: 'rose', description: 'Értékelés és a napjaid', primary: true },
  { label: 'Karakter', to: '/mezo/karakter/dimenziok', icon: 'i-emberek', wash: 'lav', description: 'Ahogyan a csapat lát téged' },
  { label: 'Tudástár', to: '/mezo/knowledge', icon: 'i-tudas', wash: 'sage', description: 'Tények, események, kapcsolatok' },
  { label: 'Emlékek', to: '/mezo/emlekek', icon: 'i-memoar', wash: 'lav', description: 'Napló, memoár és visszakeresés' },
  { label: 'Konzílium', to: '/mezo/karakter/konzilium', icon: 'i-mezo', wash: 'sky', description: 'A csapat beszélgetései és következtetései' },
  { label: 'Coaching', to: '/mezo/coaching', icon: 'i-cel', wash: 'gold', description: 'Miért ezt javasoltuk ma?' },
  { label: 'Beszélgetés', to: '/mezo/chat', icon: 'i-level', wash: 'rose', description: 'Booppal, szövegben és hanggal' },
  { label: 'Gépterem', to: '/mezo/karakter/gepterem', icon: 'i-beallitas', wash: 'white', description: 'Futások, adatforrások és memória' },
]
