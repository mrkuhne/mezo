import { useNavigate } from 'react-router-dom'
import { useProtocol, useStackDay } from '@/data/hooks'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'

export function FuelStackProtocolPage() {
  const navigate = useNavigate()
  const { protocol, pending, error } = useProtocol()
  const { slots } = useStackDay()
  const ready = !pending && !error && protocol.status !== 'none'

  return (
    <StackPageScaffold
      tone="sage" backTo="/fuel/stack" backLabel="‹ Stack" icon="i-stack"
      name="Teljes protokoll"
      big={ready ? `${protocol.itemCount} tétel` : undefined}
      sub={ready ? `v${protocol.version} · ${Math.round(protocol.confidence * 100)}% bizalom` : undefined}
    >
      <div className="stk-protocol-actions rise">
        <p>A protokoll stabil alapja — itt átnézed, a kezelésben módosítod.</p>
        <button type="button" onClick={() => navigate('/fuel/stack/manage/protocol')}>Szerkesztés</button>
      </div>
      {pending && <div className="stk-detail-state">Protokoll betöltése…</div>}
      {error && <div className="stk-detail-state">A protokoll most nem tölthető be.</div>}
      {!pending && !error && slots.length === 0 && <div className="stk-detail-state">Még nincs protokolltétel.</div>}
      {!pending && !error && slots.map(slot => (
        <section className="stk-protocol-zone rise" key={`${slot.zone}-${slot.time}`}>
          <header><strong>{slot.label}</strong><time>{slot.time}</time></header>
          {slot.entries.map(entry => (
            <div className="stk-protocol-row" key={entry.occurrenceId}>
              <div><strong>{entry.name}</strong><small>{entry.dose}</small></div>
              <p>{entry.reason ?? 'Automatikusan időzítve.'}</p>
              <span>{entry.pinned ? 'kézi' : 'auto'}</span>
            </div>
          ))}
        </section>
      ))}
    </StackPageScaffold>
  )
}
