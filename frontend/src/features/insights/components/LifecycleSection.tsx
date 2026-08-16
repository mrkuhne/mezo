import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'

/**
 * Egy összecsukható életciklus-szekció a Minták dashboardon (spec 2026-08-14 · mezo-tk88.4):
 * cím+darabszám fejléc + chevron, nyitva/csukva `useState`-tel. Üres kosarat nem rajzol ki —
 * a hívó a hat `BUCKET_ORDER` szekciót sorban rendereli, ez dobja el a nullákat. `count` opcionális
 * (mezo-tk88.5 review fix) — a részlet-oldal „Motor-diagnosztika" szekciója nem egy lista-elemszám,
 * hanem egy önálló blokk, ezért nincs `· N` utótagja: `count` nélkül a szekció sosem tűnik el ÉS
 * a suffix sem jelenik meg; a dashboard hívói (mind számot adnak át) változatlanok.
 */
export function LifecycleSection({
  title,
  accent,
  count,
  defaultOpen = false,
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
  footNote?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (count === 0) return null

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '13px 16px' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{title}{count != null ? ` · ${count}` : ''}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={11} color="var(--text-tertiary)" />
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
          {footNote && (
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-tertiary)', padding: '0 4px' }}>{footNote}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Egy sor egy `LifecycleSection` belsejében — a pár/minta rövid állapota + link a részletekhez. */
export function LifecycleMiniRow({ title, sub, to }: { title: string; sub: string; to: string }) {
  return (
    <Link
      to={to}
      className="row"
      style={{
        justifyContent: 'space-between', alignItems: 'center', gap: 10,
        padding: '10px 12px', background: 'var(--surface-recess)', borderRadius: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--lav-deep)', fontWeight: 700, fontSize: 14 }}>→</span>
    </Link>
  )
}
