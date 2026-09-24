import type { CSSProperties } from 'react'
import type { PerkUnlock } from '@/data/types'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'

const skillName = (key: string) => ATHLETIC_META[key]?.name ?? LIFE_SKILLS.find((s) => s.key === key)?.name ?? MUSCLE_LABELS[key] ?? key

/** Unlocked perk milestones (mezo-rmi0.1; üveg mezo-me75u.7, prototype uveg-en2.html `kitunt()`):
 *  a section head (Perkek · n feloldva) over ONE gold glass card of rows — Lv plaque · name ·
 *  effect · skill; the footer names the skill nearest its next milestone (FE-derived), or just the
 *  rule when none. No perk yet → the dashed empty card. */
export function PerksCard({ perks, next }: { perks: PerkUnlock[]; next: { name: string; level: number } | null }) {
  return (
    <>
      <div className="gr-h3 rise" style={{ '--d': '190ms' } as CSSProperties}>
        <span className="mz-eyebrow">Perkek</span>
        <span className="gr-h3-em">{perks.length} feloldva</span>
      </div>
      {perks.length === 0 ? (
        <div className="gr-band amber gr-perks uv-empty rise" style={{ '--d': '200ms', '--c': 'var(--dv-amber)' } as CSSProperties}>
          <p className="gr-band-foot">Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.</p>
        </div>
      ) : (
        <div className="gr-band amber gr-perks glass rise" style={{ '--d': '200ms', '--c': 'var(--dv-amber)' } as CSSProperties}>
          {perks.map((p) => (
            <div key={p.perkKey + p.unlockedAt} className="gr-perkrow">
              <span className="gr-perk-pi">Lv{p.milestoneLevel}</span>
              <div className="gr-perk-grow"><div className="pn">{p.name}</div><div className="pe">{p.effectCopy} · <span className="pl">{skillName(p.skillKey)}</span></div></div>
            </div>
          ))}
          <div className="gr-band-foot">A skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket{next ? ` — a következő: ${next.name} Lv ${next.level}.` : '.'}</div>
        </div>
      )}
    </>
  )
}
