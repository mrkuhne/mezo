import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'

/** iOS grants Web Push to home-screen-installed PWAs only — so when the app is not standalone
 *  this REPLACES the master toggle rather than sitting next to it (a toggle that cannot work
 *  must not be offered). Presentational only — no `@/data/*` import. bd mezo-h4wp.6.1
 *  Üveg (mezo-me75u.7): the page's one object, an amber glass notice; the old 📲 emoji is the
 *  3D info icon, the meaning lives in the text. */
export function PushInstallGate() {
  return (
    <div className="ntf-gate glass" style={{ '--c': 'var(--dv-amber)' } as CSSProperties}>
      <Icon3D name="t-info" size={30} />
      <p>
        <strong>iOS:</strong> a push csak akkor jön meg, ha a mezo a{' '}
        <strong>kezdőképernyőn</strong> van (Megosztás → Főképernyőhöz). Safari-fülön az Apple
        nem engedi.
      </p>
    </div>
  )
}
