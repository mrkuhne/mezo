// frontend/src/app/CircadianTheme.tsx
import { useEffect, useState } from 'react'
import { useSleepGoal } from '@/data/hooks'
import { useTheme } from '@/app/ThemeProvider'
import { isDarkWindow } from '@/features/today/logic/windDown'

const TICK_MS = 60_000

/**
 * The circadian resolver (spec D9): while mode === 'auto', dark inside [bed-90, wake-30),
 * light otherwise — the exact WindDownBanner windows (one clock source, windDown.ts).
 * Renders nothing; mounted once in AppLayout under the data providers.
 */
export function CircadianTheme() {
  const { mode, setAutoTheme } = useTheme()
  const { goal } = useSleepGoal()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return
    setAutoTheme(isDarkWindow(now, goal) ? 'dark' : 'light')
  }, [mode, now, goal, setAutoTheme])

  return null
}
