// ============================================================
// Mezo · DayStripTile — a szerkesztő heti arcának egy napja (mezo-yty6; Folyadék mezo-n4wf5.3,
// prototype vilagos/edzes.js `weekEd()` → „A heted · koppints egy napra"). A vízszintesen görgethető
// csempesor helyett egy SOR: a nap kerek jele, a nap neve, szett · perc, alatta az izmok egy
// edénybe öntve (arányos rétegek), és az „átfedés" jelző, ha a napot érinti az egymást követő
// napok figyelmeztetése. Koppintásra a nap saját szerkesztője nyílik.
// ============================================================
import { DayNum } from '@/features/train/components/folyadek'
import { Chev, Pour, Row, St } from '@/shared/ui/folyadek'

export interface DayStripMuscle {
  label: string
  sets: number
  color: string
}

interface DayStripTileProps {
  /** Weekday key ('Hét'…'Vas') — the round badge. */
  day: string
  /**
   * The (renameable) day name. MesoDay has no separate name field, so a rename writes
   * `day.type` and this IS the split type until the user renames it — which is why the row
   * must not render it twice (mezo-yty6 final review, I5).
   */
  name: string
  sets: number
  minutes: number
  muscles: DayStripMuscle[]
  flagged?: boolean
  /** A day with no training on it: a quiet row (still opens — that is how a rest day gets work). */
  rest?: boolean
  onOpen: () => void
}

export function DayStripTile({ day, name, sets, minutes, muscles, flagged, rest, onOpen }: DayStripTileProps) {
  return (
    <Row
      className="ew-day"
      state={rest ? 'dim' : undefined}
      left={<DayNum>{day}</DayNum>}
      title={rest && name === 'Rest' ? 'Pihenőnap' : name}
      sub={rest ? undefined : `${sets} szett · ~${minutes}′`}
      more={!rest && muscles.length > 0 && (
        <Pour sm parts={muscles.map((m) => ({ n: m.sets, color: m.color }))} />
      )}
      right={<span className="ew-end">{flagged && <St tone="warn">átfedés</St>}<Chev /></span>}
      aria-label={`${day} · ${name} · szerkesztés`}
      onClick={onOpen}
    />
  )
}
