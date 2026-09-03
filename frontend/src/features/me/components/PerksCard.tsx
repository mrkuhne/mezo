import type { PerkUnlock } from '@/data/types'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'

const skillName = (key: string) => ATHLETIC_META[key]?.name ?? LIFE_SKILLS.find((s) => s.key === key)?.name ?? MUSCLE_LABELS[key] ?? key

/** Unlocked perk milestones (mezo-rmi0.1): amber card, Lv plaque · name · effect · skill; the footer
 *  names the skill nearest its next milestone (FE-derived), or just the rule when none. */
export function PerksCard({ perks, next }: { perks: PerkUnlock[]; next: { name: string; level: number } | null }) {
  return (
    <div className="gr-band amber rise" style={{ '--d': '200ms', marginTop: 11 } as React.CSSProperties}>
      <div className="gr-band-top"><span className="mz-eyebrow" style={{ color: 'var(--mz-cell-amber-ink)' }}>Perkek</span><span className="gr-band-chip warn">{perks.length} feloldva</span></div>
      {perks.length === 0 && <p className="gr-band-foot">Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.</p>}
      {perks.map((p) => (
        <div key={p.perkKey + p.unlockedAt} className="gr-perkrow">
          <span className="gr-perk-pi">Lv{p.milestoneLevel}</span>
          <div style={{ flex: 1, minWidth: 0 }}><div className="pn">{p.name}</div><div className="pe">{p.effectCopy}</div></div>
          <span className="pl">{skillName(p.skillKey)}</span>
        </div>
      ))}
      {perks.length > 0 && (
        <div className="gr-band-foot">A skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket{next ? ` — a következő: ${next.name} Lv ${next.level}.` : '.'}</div>
      )}
    </div>
  )
}
