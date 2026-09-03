// ============================================================
// Mezo · PrepNigglePage — the prep mosaic's Niggle tile opened into its own
// page (mezo-d20.3.8). Source: session-body.html #page-niggle. Compact hero
// (icon + muscle label row, no big number — there is no metric here), the
// niggle detail card, and the same "Értem · jó így" / "Tudatosítsuk később"
// pair the old inline pre-flight banner had — dismissal is local UI state,
// same as before, just relocated off the hub. The niggle never blocks.
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'

export function PrepNigglePage({ muscleLabel, detail, confirmed, onConfirm, onBack }: {
  muscleLabel: string
  detail: string
  confirmed: boolean
  onConfirm: () => void
  onBack: () => void
}) {
  return (
    <MozaikPage tone="gold">
      <PageHead label="‹ Indítás" onBack={onBack} />
      <div className="mz-page-hero">
        <div className="mz-hero-row" style={{ justifyContent: 'center' }}>
          <ClayIcon name="i-eletjel" size={45} />
          <span className="mz-hero-nm" style={{ fontSize: 16 }}>{muscleLabel} · {confirmed ? 'kezelve ✓' : 'aktív niggle'}</span>
        </div>
      </div>
      <PageBody principle="A niggle sosem tilt — csak emlékeztet. Te döntesz, mi fér bele ma.">
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12.5, fontWeight: 300, lineHeight: 1.5 }}>{detail}</p>
          {!confirmed && (
            <div className="row gap-sm mt-md">
              <button type="button" className="cta-ghost" style={{ fontSize: 10 }} onClick={onConfirm}>
                Értem · jó így
              </button>
              <button type="button" className="chip" style={{ fontSize: 9 }}>
                Tudatosítsuk később
              </button>
            </div>
          )}
        </div>
      </PageBody>
    </MozaikPage>
  )
}
