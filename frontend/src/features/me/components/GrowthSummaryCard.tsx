import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { clampPct } from '@/shared/lib/pct'
import type { ProgressionProfileResponse, SkillLevel } from '@/data/progression/progressionApi'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/**
 * Compact progression summary on the Profile tab — the whole card opens
 * /me/growth. Re-skinned to the Napiv .growth2 idiom (spec §4.6, mezo-8141
 * Task 4): the XP chip now also carries the weekly streak, the top-3 skills
 * render as .skl progress rows (SkillLevel.progressPct drives the within-level
 * fill), and a footer meta row keeps athlete-level/discipline/30-day savings
 * (streak left that row since it lives in the chip now).
 */
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
        style={{ padding: '16px 15px', position: 'relative', overflow: 'hidden', background: 'var(--wash-lav)', textAlign: 'left', width: '100%', display: 'block' }}
      >
        <span className="sr-only">Growth oldal megnyitása — </span>
        <div className="row gap-md" style={{ alignItems: 'center' }}>
          <Icon name="sparkle" size={16} color="var(--lav-deep)" />
          <div className="col flex-1">
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Growth — LIFE</span>
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
    <button className="card notch-12 growth2" onClick={() => navigate('/me/growth')}
      style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden', textAlign: 'left', width: '100%', display: 'block' }}>
      <span className="sr-only">Growth oldal megnyitása — </span>
      <div className="hd">
        <span className="t">🌱 Growth</span>
        <span className="xp">
          {fmt(totalXp)} XP · {profile.streakWeeks} hét sorozat
        </span>
      </div>
      <div>
        {top3.map((s) => {
          const m = iconName(s)
          return (
            <div key={s.skillKey} className="skl">
              <span className="k">
                <span aria-hidden="true">{m.icon} </span>
                <span>{m.name}</span>
              </span>
              <div className="bar">
                <i style={{ width: `${clampPct(s.progressPct)}%` }} />
              </div>
              <span className="lv">Lv {s.level}</span>
            </div>
          )
        })}
      </div>
      <div className="row" style={{ gap: 14, marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 12 }}>
        <span>
          Atléta-szint <b style={{ color: 'var(--lav-deep)' }}>{profile.athleteLevel ?? '–'}</b>
        </span>
        <span>
          Fegyelem <b style={{ color: 'var(--lav-deep)' }}>{disc == null ? '–' : `${disc}%`}</b>
        </span>
        {typeof savings === 'number' && savings > 0 && (
          <span>
            Megtakarítás (30 nap) <b style={{ color: 'var(--sage-deep)' }}>{fmt(savings)} Ft</b>
          </span>
        )}
      </div>
    </button>
  )
}
