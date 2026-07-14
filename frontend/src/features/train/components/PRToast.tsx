// ============================================================
// Mezo · PRToast — dark celebration toast shown for ~4.5s when a
// personal record is logged. Ported from prototype train.jsx.
// ============================================================
import { Icon } from '@/shared/ui/Icon'

export interface PRState {
  delta: string
  prev: number
  prevReps: number
}

export function PRToast({ pr }: { pr: PRState }) {
  return (
    <div
      className="toast notch-12"
      role="status"
      style={{
        background: 'linear-gradient(135deg, #FF7A55, #FF5B36)',
        boxShadow: '0 12px 40px rgba(255, 91, 54, 0.35)',
      }}
    >
      <div className="row gap-md" style={{ alignItems: 'center' }}>
        <Icon name="sparkle" size={28} color="var(--text-inverse)" />
        <div className="col flex-1">
          <span
            className="label-mono"
            style={{ fontSize: 9, color: 'var(--text-inverse)', opacity: 0.7 }}
          >
            Personal Record
          </span>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 22,
              color: 'var(--text-inverse)',
              marginTop: 2,
            }}
          >
            +{pr.delta} kg
          </div>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-inverse)',
              opacity: 0.85,
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            Március 4 óta vártuk ezt a momentumot — most megdöntöttük.
          </span>
        </div>
      </div>
    </div>
  )
}
