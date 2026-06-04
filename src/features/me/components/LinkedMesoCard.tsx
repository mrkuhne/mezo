import type { LinkedMeso } from '@/data/types'

const STATUS_LABEL: Record<LinkedMeso['status'], string> = {
  active: 'AKTÍV',
  planned: 'TERVEZETT',
  archived: 'ARCHÍV',
}

export function LinkedMesoCard({ meso }: { meso: LinkedMeso }) {
  const isActive = meso.status === 'active'
  return (
    <div
      className="card notch-4"
      style={{
        padding: '10px 14px',
        borderColor: isActive ? 'var(--border-brand)' : 'var(--border-subtle)',
        background: isActive ? 'rgba(94, 234, 212, 0.04)' : 'var(--surface-1)',
      }}
    >
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="col">
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{meso.shortTitle}</span>
          <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2, fontFamily: 'var(--ff-mono)' }}>
            {meso.startDate} → {meso.endDate} · {meso.weeks} hét
          </span>
        </div>
        <span
          className="chip"
          style={{
            fontSize: 9,
            padding: '2px 6px',
            color: isActive ? 'var(--brand-glow)' : 'var(--text-tertiary)',
            borderColor: isActive ? 'var(--border-brand)' : 'var(--border-subtle)',
          }}
        >
          {STATUS_LABEL[meso.status]}
        </span>
      </div>
    </div>
  )
}
