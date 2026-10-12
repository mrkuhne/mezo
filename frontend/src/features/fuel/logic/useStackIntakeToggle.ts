import { useStackActions } from '@/data/hooks'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { useToast } from '@/shared/ui/ToastProvider'
import { m } from '@/shared/i18n'

export function useStackIntakeToggle() {
  const { logIntake, undoIntake } = useStackActions()
  const { show } = useToast()

  const toggleIntake = async (entry: StackDayEntry) => {
    try {
      if (entry.taken) {
        await undoIntake(entry.pantryItemId, entry.persistedZone)
        return
      }

      const intake = await logIntake(entry.pantryItemId, entry.persistedZone, entry.dose)
      show({
        kind: 'success',
        text: m().fuelKieg.hub.toastTaken(entry.name),
        action: {
          label: m().fuelKieg.hub.toastUndo,
          onClick: () => undoIntake(entry.pantryItemId, entry.persistedZone, intake.id),
        },
      })
    } catch {
      // The shared MutationCache owns error feedback; success stays truthful here.
    }
  }

  return { toggleIntake }
}
