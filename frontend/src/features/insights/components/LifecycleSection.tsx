import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Egy összecsukható életciklus-szekció a Minták dashboardon (spec 2026-08-14 · mezo-tk88.4):
 * cím+darabszám fejléc + chevron, nyitva/csukva `useState`-tel. Üres kosarat nem rajzol ki —
 * a hívó a hat `BUCKET_ORDER` szekciót sorban rendereli, ez dobja el a nullákat. `count` opcionális:
 * nélküle a szekció sosem tűnik el és a `· N` utótag sem jelenik meg.
 *
 * `forceOpen` (mezo-9ryh review fix) — opcionális, visszafelé kompatibilis: nyitva tartja a
 * szekciót a belső `open` állapottól függetlenül (a chevron/gomb tovább működik, csak a
 * megjelenítés nem hallgat rá). A Tudástár lista adja át, amíg aktív szűrő fut — enélkül egy
 * csak kikapcsolt tényekre illeszkedő keresés összecsukott „Kikapcsolva · 1" fejlécet mutatna,
 * a találat pedig sosem látszana. A `PatternsPage` hívói nem adnak át semmit, ezért változatlanul
 * viselkednek. */
export function LifecycleSection({
  title,
  accent,
  count,
  defaultOpen = false,
  forceOpen = false,
  footNote,
  children,
}: {
  /** pl. "✓ Megerősítve — él a tudásban" */
  title: string
  /** CSS color var a címhez */
  accent: string
  /** hiányában a szekció sosem tűnik el és a fejléc nem kap „· N" utótagot */
  count?: number
  defaultOpen?: boolean
  /** nyitva tartja a szekciót a belső toggle-állapottól függetlenül (aktív szűrő ablaka) */
  forceOpen?: boolean
  footNote?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen || open
  if (count === 0) return null

  // Üveg (U9 · mezo-me75u.9): a flat fold button (prototype `m9-fold`) and, open, a flat
  // `tf-tlist` of the rows + the foot note. Typographic chevrons stay (bible rule 19).
  return (
    <div className="tud9-fold">
      <button type="button" className="tud9-foldbtn" aria-expanded={isOpen} onClick={() => setOpen((v) => !v)}>
        <span style={{ color: accent }}>{title}{count != null ? ` · ${count}` : ''}</span>
        <em aria-hidden="true">{isOpen ? '⌃' : '⌄'}</em>
      </button>
      {isOpen && (
        <>
          <div className="tf-tlist tud9-facts">{children}</div>
          {footNote && <p className="tud9-fn">{footNote}</p>}
        </>
      )}
    </div>
  )
}

/** Egy sor egy `LifecycleSection` belsejében — a pár/minta rövid állapota + link a részletekhez.
 *  `to` opcionális (mezo-tk88.5 review fix): egy V3.2 AI-hipotézis sornak nincs katalógus-párja
 *  (`hyp-<hash>` pairKey, sosem szerepel a monitorban), így a `/insights/patterns/{pairKey}` cél
 *  garantáltan „Nincs ilyen minta."-ra futna — `to` hiányában a sor egyszerű, link/nyíl nélküli
 *  `<div>`-ként rendereli magát. */
export function LifecycleMiniRow({ title, sub, to }: { title: string; sub: string; to?: string }) {
  const rowStyle = {
    justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 10,
    padding: '10px 12px', background: 'var(--surface-recess)', borderRadius: 14,
  }
  const content = (
    <>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
      </div>
      {to && <span style={{ color: 'var(--lav-deep)', fontWeight: 700, fontSize: 14 }}>→</span>}
    </>
  )
  if (!to) {
    return <div className="row" style={rowStyle}>{content}</div>
  }
  return (
    <Link to={to} className="row" style={rowStyle}>
      {content}
    </Link>
  )
}
