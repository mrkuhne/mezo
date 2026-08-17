// ============================================================
// Mezo · QuickSleepSheet — SleepLogSheet a quick-log menü számára
// A SleepLogSheet `onSave`-et vár a hívótól; ez az adapter adja hozzá a
// useSleep() mutációt, hogy a sheet felülete `{ onClose }` legyen — ugyanaz,
// mint az önellátó ActivityLogSheet-é. Így a hook csak akkor mount-olódik,
// amikor a felhasználó tényleg alvást logol, nem minden + koppintásra.
// ============================================================
import { useSleep } from '@/data/hooks'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'

export function QuickSleepSheet({ onClose }: { onClose: () => void }) {
  const { logSleep } = useSleep()
  return <SleepLogSheet onClose={onClose} onSave={logSleep} />
}
