// ============================================================
// Mezo · DayStripTile — a szerkesztő vízszintesen görgethető nap-csempesorának
// egy csempéje (mezo-yty6). A wizard régi 2-oszlopos DayTile-mozaikját váltja:
// fix szélesség, scroll-snap, arányos izom-sáv, borostyán pötty ha a napot
// lint érinti. Koppintásra a nap saját szerkesztője nyílik.
// ============================================================
export interface DayStripMuscle {
  label: string
  sets: number
  color: string
}

interface DayStripTileProps {
  /** Weekday key ('Hét'…'Vas') — the eyebrow. */
  day: string
  /**
   * The (renameable) day name shown big. MesoDay has no separate name field, so a rename
   * writes `day.type` and this IS the split type until the user renames it — which is why
   * the tile must not render it twice (mezo-yty6 final review, I5: the eyebrow used to
   * repeat the very same string under the heading).
   */
  name: string
  sets: number
  minutes: number
  muscles: DayStripMuscle[]
  tone: 'coral' | 'sage' | 'rose' | 'gold'
  flagged?: boolean
  onOpen: () => void
}

export function DayStripTile({
  day, name, sets, minutes, muscles, tone, flagged, onOpen,
}: DayStripTileProps) {
  return (
    <button
      type="button"
      className={`mz-dst mz-dst-${tone}`}
      aria-label={`${day} · ${name} · szerkesztés`}
      onClick={onOpen}
    >
      {flagged && <span className="mz-dst-dot" aria-hidden="true" />}
      <span className="mz-dst-tt">{day}</span>
      <span className="mz-dst-nm">{name}</span>
      <span className="mz-dst-meta">{sets} szett · ~{minutes}′</span>
      <span className="mz-dst-rail">
        {muscles.map((m) => (
          <i key={m.label} style={{ flexGrow: m.sets, background: m.color }} />
        ))}
      </span>
    </button>
  )
}
