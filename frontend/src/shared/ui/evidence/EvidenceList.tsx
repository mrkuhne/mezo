// ============================================================
// Mezo · EvidenceList — az észrevétel-kártya „Miből látom” sorai (mezo-d6ivw.1).
// Lapos cellák a kártya üvegén belül (üveg az üvegben tilos, bible §3): forrás 3D-ikon +
// cím + nap, címkézett érték-pillek, a saját jegyzet idézetként; két+ egymást követő
// check-in alatt egy közös „Változás” grafikon (1–10 sáv, üres karika → teli pötty). A
// bemenet strukturált `EvidenceItem[]` (a szerver már veszteségmentesen küldi a rekordot,
// a modul nem tud csonkolásról). Vizuális igazság: docs/design_2.0/prototypes/uveg-eszrevetel.html.
// ============================================================
import { Icon3D } from '@/shared/ui/clay'
import {
  CHECKIN_DIMS, evidenceBlocks, evidenceDayLabel,
  type CheckinShift, type EvidenceItem, type EvidenceRecord,
} from './observationEvidence'

const pos = (v: number) => `${((Math.min(10, Math.max(1, v)) - 1) / 9) * 100}%`
const fmt = (v: number) => String(v).replace('.', ',')

function RecordRow({ r, hideCheckin, today }: { r: EvidenceRecord; hideCheckin?: boolean; today: string }) {
  const long = (r.quote?.length ?? 0) > 140
  return (
    <div className="nap-ev-row">
      <div className="nap-ev-h">
        <Icon3D name={r.icon} size={26} />
        <span className="nap-ev-src"><strong>{r.title}</strong>{r.subtitle && <small>{r.subtitle}</small>}</span>
        <time dateTime={r.date}>{evidenceDayLabel(r.date, today)}{r.time ? ` · ${r.time}` : ''}</time>
      </div>
      {r.values.length > 0 && (
        <div className="nap-ev-vals">
          {r.values.map((v, i) => (
            <span key={i} className={v.hot ? 'hot' : undefined}>
              {v.label && <>{v.label} </>}<b>{v.value}</b>{v.unit && <i>{v.unit}</i>}
            </span>
          ))}
        </div>
      )}
      {r.checkin && !hideCheckin && (
        <div className="nap-ev-cells">
          {CHECKIN_DIMS.map((d) => r.checkin?.[d.key] == null ? null : (
            <span key={d.key} style={{ '--k': d.color } as React.CSSProperties}>
              <b>{fmt(r.checkin[d.key]!)}</b><small>{d.label}</small>
            </span>
          ))}
        </div>
      )}
      {r.quote && <p className={long ? 'nap-ev-quote clip' : 'nap-ev-quote'}>„{r.quote}”</p>}
    </div>
  )
}

function ShiftBlock({ s, today }: { s: CheckinShift; today: string }) {
  const same = s.from.date === s.to.date
  const at = (r: EvidenceRecord) => same ? (r.time ?? '') : `${evidenceDayLabel(r.date, today)}${r.time ? ` ${r.time}` : ''}`
  return (
    <div className="nap-ev-shift" aria-label={`Változás: ${at(s.from)} → ${at(s.to)}`}>
      <div className="nap-sh-h">
        <span>Változás</span>
        <span className="nap-sh-t"><i className="o" />{at(s.from)}<b>→</b><i className="f" />{at(s.to)}</span>
      </div>
      {CHECKIN_DIMS.map((d) => {
        const a = s.from.checkin?.[d.key]
        const b = s.to.checkin?.[d.key]
        if (a == null || b == null) return null
        const delta = b - a
        const lo = Math.min(a, b)
        const hi = Math.max(a, b)
        return (
          <div key={d.key} className="nap-sh-row" data-dim={d.key} style={{ '--k': d.color } as React.CSSProperties}>
            <span className="nap-sh-l">{d.label}</span>
            <span className="nap-sh-tr" aria-hidden="true">
              <span className={delta < 0 ? 'seg dn' : 'seg'}
                style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
              <i className="o" style={{ left: pos(a) }} />
              <i className="f" style={{ left: pos(b) }} />
            </span>
            <span className="nap-sh-n">{fmt(a)}<b>→</b><strong>{fmt(b)}</strong></span>
            <span className={delta === 0 ? 'nap-sh-d z' : 'nap-sh-d'}>
              {delta > 0 ? '+' : delta < 0 ? '−' : '±'}{fmt(Math.abs(delta))}
            </span>
          </div>
        )
      })}
      <div className="nap-sh-sc" aria-hidden="true"><span /><span className="r"><i>1</i><i>10</i></span></div>
    </div>
  )
}

export function EvidenceList({ evidence, today }: { evidence: EvidenceItem[]; today: string }) {
  const blocks = evidenceBlocks(evidence)
  const tags = blocks.filter((b) => b.kind === 'tag')
  return (
    <div className="nap-obs-evid">
      {blocks.map((b, i) => b.kind === 'record'
        ? <RecordRow key={i} r={b} hideCheckin={b.hideCheckin} today={today} />
        : b.kind === 'shift' ? <ShiftBlock key={i} s={b} today={today} /> : null)}
      {tags.length > 0 && (
        <div className="nap-ev-tags">{tags.map((t, i) => <span key={i}>{t.text}</span>)}</div>
      )}
    </div>
  )
}
