/**
 * Az elfogadott életesemény-jelölt helyén maradó megerősítés (mezo-0ap9). A jóváhagyás a
 * Tudástárban történik, az eredmény is ott, a Tudástár Kategóriák nézetében él — enélkül a
 * kártya némán eltűnik, és a felhasználó azt látja, hogy „elfogadtam, mégsem lett belőle semmi"
 * (IDENT-6: a megerősítés sosem néma, a `LifeEventCandidateCard` idiómája). A külön Tudásgráf
 * oldal megszűnt (mezo-ms9a) — a „Megnézed? → Tudásgráf" link vele együtt törlődött; a csík +
 * szöveg önmagában elég megerősítés.
 */
export function LifeEventAcceptedCard({ title, edgeCount }: { title: string; edgeCount: number }) {
  // Üveg (U9 · mezo-me75u.9): a settled row is flat (ranking) — a sage dot, the title, the line.
  return (
    <div className="tf-case tf-flatc tf-c-sage tud9-accepted" data-graph-card data-accepted>
      <u aria-hidden="true" />
      <span className="tud9-acctx">
        <b>{title}</b>
        <small>{edgeCount > 0 ? `Bekerült a gráfba · ${edgeCount} kapcsolattal` : 'Bekerült a gráfba'}</small>
      </span>
    </div>
  )
}
