import type { StackZoneKey } from '@/data/types'
import { m } from '@/shared/i18n/catalog'

/** Canonical zone order + labels (mezo-vx9v). Keys are the wire contract — never rename. */
export const STACK_ZONE_ORDER: StackZoneKey[] = [
  'wake', 'breakfast', 'pre_workout', 'post_workout', 'lunch', 'dinner', 'evening', 'bedtime',
]
/** Getter-backed: `STACK_ZONE_LABEL[zone]` reads the catalog (`fuelLogika.stack.zone`) when it is READ,
 *  so every importer follows a language switch without an edit. Never copy it into a module constant. */
export const STACK_ZONE_LABEL: Record<StackZoneKey, string> = {
  get wake() { return m().fuelLogika.stack.zone.wake },
  get breakfast() { return m().fuelLogika.stack.zone.breakfast },
  get pre_workout() { return m().fuelLogika.stack.zone.pre_workout },
  get post_workout() { return m().fuelLogika.stack.zone.post_workout },
  get lunch() { return m().fuelLogika.stack.zone.lunch },
  get dinner() { return m().fuelLogika.stack.zone.dinner },
  get evening() { return m().fuelLogika.stack.zone.evening },
  get bedtime() { return m().fuelLogika.stack.zone.bedtime },
}
