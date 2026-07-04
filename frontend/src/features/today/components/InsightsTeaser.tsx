import { useNavigate } from 'react-router-dom'
import { useInsightsTeaser } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Chip } from '@/shared/ui/Chip'

export function InsightsTeaser() {
  const teaser = useInsightsTeaser()
  const navigate = useNavigate()
  if (!teaser) return null
  return (
    <div style={{ padding: '0 24px 24px' }}>
      <button
        className="card notch-8"
        onClick={() => navigate('/insights')}
        style={{ padding: 14, textAlign: 'left', display: 'block', width: '100%' }}
      >
        <Eyebrow brand>{teaser.eyebrow}</Eyebrow>
        <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text-primary)' }}>
          {teaser.text}
        </p>
        <div className="row mt-md gap-sm">
          <Chip variant="brand" style={{ fontSize: 9 }}>Insights → Patterns</Chip>
        </div>
      </button>
    </div>
  )
}
