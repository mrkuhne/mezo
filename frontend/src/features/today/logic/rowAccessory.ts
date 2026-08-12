// ============================================================
// Mezo · rowAccessory — melyik kísérőt viseli egy sor (mezo-e26w).
// A `TodayAction` MINDEN változata visel `label`-t (todayItems.ts:168,194,217,
// 239,256), tehát a „nincs címke" nem megkülönböztető jel — a `mode` az.
// A negyedik alak, a chevron, NEM innen jön: az a `TodayRow` propja, amit a
// nézet által közvetlenül renderelt, sheetet nyitó sorok viselnek (Reflexió,
// Fókusz) — azok nem `TodayItem`-ből származnak.
// Pure: no React, no hooks, no side effects.
// ============================================================
import type { TodayItem } from '@/features/today/logic/todayItems'

export type RowAccessory = 'tick' | 'button' | 'none'

export function rowAccessory(item: TodayItem): RowAccessory {
  const a = item.action
  if (!a) return 'none'
  if (a.kind === 'habit' && a.habit.mode === 'MANUAL') return 'tick'
  return 'button'
}
