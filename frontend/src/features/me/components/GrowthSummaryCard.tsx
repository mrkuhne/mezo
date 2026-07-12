import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import type { ProgressionProfileResponse, SkillLevel } from '@/data/progression/progressionApi'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/** Compact progression summary on the Profile tab — the whole card opens /me/growth. */
export function GrowthSummaryCard({ profile }: { profile: ProgressionProfileResponse }) {
  const navigate = useNavigate()
  const all: SkillLevel[] = [...(profile.athletic ?? []), ...(profile.muscle ?? []), ...(profile.life ?? [])]
  const totalXp = all.reduce((s, x) => s + x.cumulativeXp, 0)

  if (totalXp === 0) {
    // Ghost: the retired Growth (LIFE) card's ghost markup + copy verbatim, as a
    // button that still opens /me/growth (so the tap target is honest before any XP).
    return (
      <button
        className="card notch-12"
        onClick={() => navigate('/me/growth')}
        aria-label="Growth oldal megnyitása"
        style={{ padding: '16px 15px', position: 'relative', overflow: 'hidden', background: 'rgba(94, 234, 212, 0.04)', borderColor: 'var(--border-brand)', textAlign: 'left', width: '100%', display: 'block' }}
      >
        <div className="row gap-md" style={{ alignItems: 'center' }}>
          <Icon name="sparkle" size={16} color="var(--brand-glow)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Growth — LIFE</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 4 }}>Az élet is edzés.</div>
            <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
              Jegyezd fel az első tevékenységed a Ma nézetben — olvasás, főzés, egy hívás — és elindul a nyolc LIFE skilled.
            </span>
          </div>
        </div>
      </button>
    )
  }

  const top3 = [...all].sort((a, b) => b.level - a.level || b.cumulativeXp - a.cumulativeXp).slice(0, 3)
  const iconName = (s: SkillLevel) =>
    s.kind === 'MUSCLE'
      ? { icon: '💪', name: MUSCLE_LABELS[s.skillKey] ?? s.skillKey }
      : s.kind === 'LIFE'
        ? { icon: LIFE_SKILLS.find((l) => l.key === s.skillKey)?.icon ?? '✨', name: LIFE_SKILLS.find((l) => l.key === s.skillKey)?.name ?? s.skillKey }
        : { icon: ATHLETIC_META[s.skillKey]?.icon ?? '✨', name: ATHLETIC_META[s.skillKey]?.name ?? s.skillKey }
  const disc = profile.traits?.disciplinePct
  const savings = profile.savingsHuf30d

  return (
    <button className="card notch-12" onClick={() => navigate('/me/growth')} aria-label="Growth oldal megnyitása"
      style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden', textAlign: 'left', width: '100%', display: 'block' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow brand">Growth</span>
        <span className="chip notch-4">{fmt(totalXp)} XP →</span>
      </div>
      <div className="row" style={{ gap: 14, marginTop: 9, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>Atléta-szint <b style={{ color: 'var(--brand-glow)' }}>{profile.athleteLevel ?? '–'}</b></span>
        <span>Streak <b style={{ color: 'var(--brand-glow)' }}>{profile.streakWeeks} hét</b></span>
        <span>Fegyelem <b style={{ color: 'var(--brand-glow)' }}>{disc == null ? '–' : `${disc}%`}</b></span>
      </div>
      <div style={{ marginTop: 9 }}>
        {top3.map((s) => {
          const m = iconName(s)
          return (
            <div key={s.skillKey} className="row" style={{ gap: 8, fontSize: 12, paddingTop: 4 }}>
              <span style={{ width: 16, textAlign: 'center' }}>{m.icon}</span>
              <span style={{ flex: 1 }}>{m.name}</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, color: 'var(--brand-glow)' }}>Lv {s.level}</span>
            </div>
          )
        })}
      </div>
      {typeof savings === 'number' && savings > 0 && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="text-secondary" style={{ fontSize: 12 }}>Megtakarítás (30 nap)</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--brand-glow)' }}>{fmt(savings)} Ft</span>
        </div>
      )}
    </button>
  )
}
