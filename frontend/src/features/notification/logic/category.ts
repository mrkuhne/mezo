// ============================================================
// Mezo · értesítés-KATEGÓRIÁK (mezo-g9fz) — a fejléc értesítés-panelének szűrő-chipjei.
//
// A 15 wire-kind önmagában nem szűrő-nyelv: „experiment_proposed" vagy „fact_reinforced"
// nem az, amit a felhasználó keres. Ez a modul hat, a felhasználó nyelvén beszélő
// kategóriába vonja őket. A leképezés SZÁNDÉKOSAN nem a `tint`-en ül (`data/types.ts`):
// a tint az ikon-tok washa (`challenge_event` és `life_goal_plan` is `experiment`), a
// kategória viszont jelentés szerint sorol — a kettő nem ugyanaz a tengely.
// ============================================================
import type { ClayIconName } from '@/shared/ui/clay'

export type NotificationCategoryId =
  | 'minta' | 'tudas' | 'kiserlet' | 'joslat' | 'cel' | 'osszegzes'
  | 'emberek' | 'karakter'

export interface NotificationCategory {
  id: NotificationCategoryId
  label: string
  icon: ClayIconName
  kinds: readonly string[]
}

/** Fix sorrend — ez a chip-sor sorrendje is. */
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  { id: 'minta', label: 'Minták', icon: 'i-minta',
    kinds: ['pattern_inbox', 'pattern_signal', 'hypothesis_new'] },
  { id: 'tudas', label: 'Tudás', icon: 'i-tudas',
    kinds: ['fact_candidate', 'fact_reinforced', 'memory_note'] },
  { id: 'kiserlet', label: 'Kísérletek', icon: 'i-lombik',
    kinds: ['experiment_proposed', 'experiment_closed', 'challenge_event'] },
  { id: 'joslat', label: 'Jóslatok', icon: 'i-kristaly',
    kinds: ['prediction_new', 'prediction_outcome'] },
  { id: 'cel', label: 'Célok', icon: 'i-cel',
    kinds: ['life_goal_plan', 'goal_suggestion'] },
  { id: 'osszegzes', label: 'Összegzés', icon: 'i-memoar',
    kinds: ['memoir_ready', 'weekly_review_ready'] },
  /* mezo-0cbh. A két jelölt-fajta EGY kategóriában: mindkettő ugyanaz a mozdulat — egy sor,
   *  ami a döntésedre vár —, csak az egyik emberről, a másik eseményről/szezonról szól. */
  { id: 'emberek', label: 'Emberek', icon: 'i-emberek',
    kinds: ['person_candidate', 'graph_candidate'] },
  /* A szokás-formálódás és a havi portré is „valami rólad beért" — de a Karakter a dosszié
   *  saját neve, és a szokás oda tartozik hangulatilag: mindkettő ritka, kimondott mérföldkő. */
  { id: 'karakter', label: 'Karakter', icon: 'i-eletjel',
    kinds: ['habit_formation', 'character_portrait'] },
]

const BY_KIND = new Map<string, NotificationCategoryId>(
  NOTIFICATION_CATEGORIES.flatMap((c) => c.kinds.map((k) => [k, c.id] as const)),
)

/** TOTÁLIS olvasó, ugyanabból az okból, mint a `notificationKindMeta()`: a wire-kind sima
 *  string, a backend enum bővülhet anélkül, hogy ez a build tudna róla. Egy ismeretlen fajta
 *  kategória NÉLKÜL marad (`null`) — a `Mind` szűrőben ott van, kategória-chip alá nem esik —
 *  ahelyett, hogy egy rossz kategóriába hazudnánk bele. */
export function notificationCategory(kind: string): NotificationCategoryId | null {
  return BY_KIND.get(kind) ?? null
}
