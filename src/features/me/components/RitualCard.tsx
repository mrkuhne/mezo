import { Icon } from '@/components/ui/Icon'
import { affectColor } from '@/data/people'
import type { PersonEntry, Ritual } from '@/data/types'

export function RitualCard({ ritual, people }: { ritual: Ritual; people: PersonEntry[] }) {
  const mentees = people.filter(p => p.relationship === 'mentee')
  return (
    <div
      className="card notch-12"
      style={{
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--surface-1) 0%, rgba(94, 234, 212, 0.05) 100%)',
        borderColor: 'var(--border-brand)',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col flex-1">
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <Icon name="anchor" size={14} color="var(--brand-glow)" />
            <span className="eyebrow brand">Mentor ritual · közelít</span>
          </div>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, marginTop: 6, lineHeight: 1.25 }}>
            {ritual.title}
          </div>
          <span className="text-secondary" style={{ fontSize: 12, fontFamily: 'var(--ff-mono)', marginTop: 4 }}>
            {ritual.whenLabel}
          </span>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <span className="label-mono" style={{ fontSize: 8 }}>Mennyi még</span>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 600, color: 'var(--brand-glow)', lineHeight: 1, marginTop: 2 }}>
            {ritual.daysAway}
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 3 }}>nap</span>
          </span>
        </div>
      </div>

      {/* Attendee stack */}
      <div className="mt-lg" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-xs" style={{ alignItems: 'center' }}>
            {mentees.map((p, i) => (
              <div
                key={p.id}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  border: '1px solid ' + affectColor(p.affect_baseline),
                  marginLeft: i === 0 ? 0 : -8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--ff-display)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: affectColor(p.affect_baseline),
                  zIndex: mentees.length - i,
                }}
              >
                {p.initial}
              </div>
            ))}
            <span className="text-secondary" style={{ fontSize: 11, marginLeft: 10 }}>
              {ritual.attendees.join(' · ')}
            </span>
          </div>
        </div>
        <div className="row gap-sm mt-md" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={10} color="var(--brand-glow)" />
          <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
            Utolsó alkalom: <span style={{ color: 'var(--brand-glow)' }}>{ritual.lastHeldLabel}</span>.
            A 4-ből 4× szombat reggel utánad +0.8 SD energia — fennáll a Mizu-péntek pattern.
          </p>
        </div>
      </div>
    </div>
  )
}
