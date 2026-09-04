import { useStackActions } from '@/data/hooks'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { useToast } from '@/shared/ui/ToastProvider'

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
        text: `${entry.name} bevéve`,
        action: {
          label: 'Visszavonás',
          onClick: () => undoIntake(entry.pantryItemId, entry.persistedZone, intake.id),
        },
      })
    } catch {
      // The shared MutationCache owns error feedback; success stays truthful here.
    }
  }

  return { toggleIntake }
}
