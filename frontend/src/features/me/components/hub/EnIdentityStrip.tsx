// Mezo · EnIdentityStrip — the Én hub's identity row (mezo-lhqw7).
// Prototype: docs/design_2.0/prototypes/elo/en.html `hub()` `.idstrip`. A thin FLAT strip (never
// glass — the week hero below is the loud thing): the monogram in a small rose ring, the name,
// the equipped title chip, then Lv · XP · streak · coin. The whole strip is ONE door to Fejlődés
// (/me/growth), where the level, the titles, the streak and the coins live.
// Honest states: no title chip when nothing is equipped; a broken streak is dimmed, not hidden;
// while the progression read is unresolved — or after it FAILED — the number line is absent
// (never the ghost „Lv 1 · 0 XP · 0 nap · 0"); the name stays and the strip still navigates.
import { useNavigate } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { useGamification, useProfile, useTitles } from '@/data/hooks'
import { huInt } from '@/shared/lib/huNum'

export function EnIdentityStrip() {
  const navigate = useNavigate()
  const { user: profile } = useProfile()
  const { profile: gam, isPending, isError } = useGamification()
  const { titles } = useTitles()
  const equipped = titles.find((t) => t.equipped)
  const name = (profile?.name ?? '').trim()

  return (
    <button type="button" className="enh-idstrip rise" data-kalauz-anchor="me-idhero"
      style={{ '--d': '0ms' } as React.CSSProperties}
      aria-label={name !== '' ? `${name} · Fejlődés` : 'Fejlődés'} onClick={() => navigate('/me/growth')}>
      <span className="enh-idmono" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      <span className="enh-idgrow">
        <span className="enh-idnm">
          <strong>{name}</strong>
          {equipped != null && <span className="enh-idtitle"><Icon3D name="t-record" size={14} />{equipped.name}</span>}
        </span>
        {!isPending && !isError && (
          <span className="enh-idln">
            <span><b>Lv {gam.level}</b></span>
            <span>{huInt(gam.totalXp)} XP</span>
            <span className="enh-idstreak" style={{ opacity: gam.streakAlive === false ? 0.45 : 1 }}>
              <Icon3D name="t-bolt" size={14} />{gam.streakDays} nap
            </span>
            <span><Icon3D name="t-coin" size={14} />{gam.coins}</span>
          </span>
        )}
      </span>
      <span className="enh-chev" aria-hidden="true">›</span>
    </button>
  )
}
