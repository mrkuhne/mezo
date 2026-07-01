import { RetaPhaseBar } from '@/shared/ui/RetaPhaseBar'

export function RetaPhaseSection({ day }: { day: number }) {
  return (
    <>
      <RetaPhaseBar day={day} />
      <div className="row" style={{ padding: '4px 24px', justifyContent: 'space-between' }}>
        <span className="eyebrow">Retatrutide · D{day}/7</span>
        <span className="eyebrow text-tertiary">
          {day <= 2 ? 'Peak · étvágy stabil' : day <= 4 ? 'Mid · étvágy lefulladás' : 'Trough · stabilizálódik'}
        </span>
      </div>
    </>
  )
}
