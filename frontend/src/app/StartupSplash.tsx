import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { TitanArtwork } from '@/features/today/components/TitanCompanion'
import { PhoneFrame } from '@/app/PhoneFrame'
import '@/app/StartupSplash.css'

/** App-root lifetime: route changes and foregrounding never restart the intro. */
export function StartupSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    // Three visible seconds after the first frame; a stalled chunk has a bounded wait.
    const timeout = window.setTimeout(() => setVisible(false), ready ? 3000 : 5000)
    return () => window.clearTimeout(timeout)
  }, [ready])

  return (
    <>
      <div className="startup-content" inert={visible} aria-hidden={visible || undefined}>
        {children}
      </div>
      {visible && (
        <div className="startup-stage" data-ready={ready}>
          <PhoneFrame>
            <div className="startup-splash" role="status" aria-label="Mezo betöltése">
              <div className="startup-splash__mark" aria-hidden="true">
                <div className="startup-splash__light"><TitanArtwork onReady={onReady} /></div>
              </div>
            </div>
          </PhoneFrame>
        </div>
      )}
    </>
  )
}
