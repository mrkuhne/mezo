import type { PerkUnlock } from '@/data/types'

/**
 * Unlocked perk milestones, newest first (Growth page Kitüntetések tab). Mozaik reface
 * (mezo-d20.6.5): a single washed `.gr-chain` tile housing the list, matching the
 * prototype's foot9 caption ("Perkek — a skill-mérföldkövek… hozzák őket").
 */
export function PerksCard({ perks }: { perks: PerkUnlock[] }) {
  return (
    <div className="gr-chain rise" style={{ '--d': '60ms' } as React.CSSProperties}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="mz-eyebrow">Perkek — mérföldkövek</span>
        <span className="gr-band-chip">{perks.length} feloldva</span>
      </div>
      {perks.length === 0 && (
        <p className="text-tertiary" style={{ fontSize: 12, marginTop: 10 }}>
          Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.
        </p>
      )}
      {perks.map((p, i) => (
        <div key={p.perkKey + p.unlockedAt} className="row" style={{ gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(43, 33, 24, 0.08)', marginTop: i === 0 ? 8 : 0 }}>
          <span style={{ flex: 1, fontSize: 12 }}>
            {p.name}
            <span style={{ display: 'block', fontSize: 10, marginTop: 1, color: 'var(--mz-ink-soft)' }}>{p.effectCopy}</span>
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--mz-ink-mut)', textTransform: 'uppercase' }}>
            {p.skillKey} · LV{p.milestoneLevel}
          </span>
        </div>
      ))}
    </div>
  )
}
