import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { DetailStat } from '@/features/me/components/DetailStat'
import { affectColor, affectLabel } from '@/data/me/people'
import type { Mention, PersonEntry } from '@/data/types'

export function PersonDetailSheet({
  person,
  mentions,
  onClose,
  onLog,
}: {
  person: PersonEntry
  mentions: Mention[]
  onClose: () => void
  onLog: () => void
}) {
  const color = affectColor(person.affect_baseline)
  return (
    <Sheet onClose={onClose} labelledBy="person-detail-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="row gap-md" style={{ alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid ' + color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, color }}>{person.initial}</div>
              <div className="col">
                <span className="eyebrow" style={{ color }}>{person.relationshipHu}</span>
                <div id="person-detail-title" className="h-display size-md" style={{ marginTop: 4 }}>{person.name}</div>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>
          <div className="row gap-sm">
            <DetailStat label="Affect" val={affectLabel(person.affect_baseline)} color={color} />
            <DetailStat label="Cadence" val={person.contactCadenceLabel} />
            <DetailStat label="Mentions" val={person.mentionCount} />
          </div>
          <div className="card notch-4 mt-lg" style={{ padding: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{person.notes}</p>
          </div>
          {person.knownFacts.length > 0 && (
          <div className="mt-lg">
            <span className="eyebrow" style={{ marginBottom: 8, display: 'block' }}>Amit Mezo tud</span>
            <div className="col gap-xs">
              {person.knownFacts.map((f, i) => (
                <div key={i} className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: color, marginTop: 7, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          )}
          {person.ties.length > 0 && (
            <div className="mt-lg">
              <span className="eyebrow" style={{ marginBottom: 8, display: 'block' }}>Kapcsolt patternek</span>
              <div className="col gap-xs">
                {person.ties.map((t, i) => (
                  <div key={i} className="card notch-4" style={{ padding: 10, background: 'var(--surface-2)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-lg">
            <span className="eyebrow" style={{ marginBottom: 8, display: 'block' }}>Friss említések · {mentions.length}</span>
            <div className="col gap-sm">
              {mentions.slice(0, 5).map(m => (
                <div key={m.id} className="card notch-4" style={{ padding: 10, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: affectColor(m.tone) }} />
                  <div style={{ paddingLeft: 8 }}>
                    <div className="row gap-xs" style={{ alignItems: 'center' }}>
                      <Icon name={m.source === 'voice' ? 'mic' : m.source === 'chip' ? 'check' : 'send'} size={10} color="var(--text-tertiary)" />
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)' }}>{m.dayLabel} · {m.timeLabel}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, marginTop: 4, fontStyle: 'italic' }}>"{m.excerpt}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Vissza</button>
            <button className="cta-primary notch-4 flex-1" onClick={onLog}>
              <Icon name="mic" size={14} /> Log most
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
