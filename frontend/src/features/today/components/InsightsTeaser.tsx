import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Chip } from '@/shared/ui/Chip'

export function InsightsTeaser() {
  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div className="card notch-8" style={{ padding: 14 }}>
        <Eyebrow brand>Új minta · 0.85 konfidencia</Eyebrow>
        <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text-primary)' }}>
          Reta beadás + 36h ablakban étvágy lefulladás — ezt 9 beadáson keresztül megerősítettük.
        </p>
        <div className="row mt-md gap-sm">
          <Chip variant="brand" style={{ fontSize: 9 }}>Insights → Patterns</Chip>
        </div>
      </div>
    </div>
  )
}
