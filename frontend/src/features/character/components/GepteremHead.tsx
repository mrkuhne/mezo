// ============================================================
// Mezo · Gépterem — the shared „dev-ajtó” page head (Üvegesítés U9, mezo-me75u.9)
// Source: docs/design_2.0/prototypes/src/uveg-mezo-teljes-u9.js `dh(small, strong)` — the
// csapatfal's glass back pill + small uppercase eyebrow + title (`tf-dhead`, boop-world.css;
// same anatomy as CharacterRoomPage's BackHead). A <button> rather than a <Link>: every Gépterem
// page navigated back through `navigate(...)` before the re-dress, and still does. The title
// carries the page's heading role (it was the PageHero name / an <h1> before).
// ============================================================
import '@/features/insights/boop-world.css'
import { FrameBack } from '@/shared/ui/folyadek'

export function GepteremHead({ small, title, onBack, fallback, titleId }: {
  small: string
  title: string
  /** A back handler that does more than navigate. Most pages pass `fallback` instead. */
  onBack?: () => void
  /** Back returns where the user came from; this route is only where a direct link goes. */
  fallback?: string
  /** For a page root that names itself by its title (`aria-labelledby`). */
  titleId?: string
}) {
  return (
    <div className="tf-dhead gtm-dhead">
      <FrameBack className="glass tf-back" {...(fallback ? { history: true, fallback } : { onBack })}>‹</FrameBack>
      <span className="tf-dtitle">
        <small>{small}</small>
        <strong id={titleId} role="heading" aria-level={1}>{title}</strong>
      </span>
    </div>
  )
}
