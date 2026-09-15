import { useEffect, useState, type ReactNode } from 'react'
import { TitanArtwork } from '@/features/today/components/TitanCompanion'
import { PhoneFrame } from '@/app/PhoneFrame'
import '@/app/StartupSplash.css'

/** App-root lifetime: route changes and foregrounding never restart the intro. */
export function StartupSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Independent of animation events and lazy/WebGL loading, so failure cannot trap users.
    const timeout = window.setTimeout(() => setVisible(false), 3000)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <>
      <div className="startup-content" inert={visible} aria-hidden={visible || undefined}>
        {children}
      </div>
      {visible && (
        <div className="startup-stage">
          <PhoneFrame>
            <div className="startup-splash" role="status" aria-label="Mezo betöltése">
              <div className="startup-splash__mark" aria-hidden="true">
                <div className="startup-splash__light"><TitanArtwork /></div>
              </div>
            </div>
          </PhoneFrame>
        </div>
      )}
    </>
  )
}
