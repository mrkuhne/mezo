/**
 * Az elfogadott életesemény-jelölt helyén maradó megerősítés (mezo-0ap9). A jóváhagyás a
 * Tudástárban történik, az eredmény is ott, a Tudástár Kategóriák nézetében él — enélkül a
 * kártya némán eltűnik, és a felhasználó azt látja, hogy „elfogadtam, mégsem lett belőle semmi"
 * (IDENT-6: a megerősítés sosem néma, a `LifeEventCandidateCard` idiómája). A külön Tudásgráf
 * oldal megszűnt (mezo-ms9a) — a „Megnézed? → Tudásgráf" link vele együtt törlődött; a csík +
 * szöveg önmagában elég megerősítés.
 */
export function LifeEventAcceptedCard({ title, edgeCount }: { title: string; edgeCount: number }) {
  return (
    <div className="card" style={{ padding: '12px 14px 12px 16px', position: 'relative', borderColor: 'var(--line)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--sage)' }} />

      <span className="label-mono" style={{ fontSize: 9, color: 'var(--sage)' }}>
        {edgeCount > 0 ? `Bekerült a gráfba · ${edgeCount} kapcsolattal` : 'Bekerült a gráfba'}
      </span>
      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: '6px 0 0' }}>{title}</p>
    </div>
  )
}
