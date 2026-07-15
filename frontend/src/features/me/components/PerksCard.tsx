import type { PerkUnlock } from '@/data/types'

/** Unlocked perk milestones, newest first (Growth page Kitüntetések tab). */
export function PerksCard({ perks }: { perks: PerkUnlock[] }) {
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Perkek — mérföldkövek</span>
        <span className="chip notch-4">{perks.length} feloldva</span>
      </div>
      {perks.length === 0 && (
        <p className="text-tertiary" style={{ fontSize: 12, marginTop: 10 }}>
          Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.
        </p>
      )}
      {perks.map((p, i) => (
        <div key={p.perkKey + p.unlockedAt} className="row" style={{ gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', marginTop: i === 0 ? 8 : 0 }}>
          <span style={{ flex: 1, fontSize: 12 }}>
            {p.name}
            <span className="text-tertiary" style={{ display: 'block', fontSize: 10, marginTop: 1 }}>{p.effectCopy}</span>
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            {p.skillKey} · LV{p.milestoneLevel}
          </span>
        </div>
      ))}
    </div>
  )
}
