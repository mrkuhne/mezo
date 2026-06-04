import { useNavigate } from 'react-router-dom'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { useProfile, usePeople, useKnowledge } from '@/data/hooks'
import { ConcentricAvatar } from '../components/ConcentricAvatar'
import { ProfileStat } from '../components/ProfileStat'
import { EntryCard } from '../components/EntryCard'
import { SettingsListRow } from '../components/SettingsListRow'

export function ProfileView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const navigate = useNavigate()
  const { user, identityGoal, areas, quickSettings, version } = useProfile()
  const { summary, people } = usePeople()
  const { facts, edges, activeCount } = useKnowledge()

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me</Eyebrow>
          <PageTitle className="mt-sm">{user.name}</PageTitle>
        </div>
        <button className="chip" onClick={onOpenSettings} aria-label="Beállítások">
          <Icon name="settings" size={12} />
        </button>
      </div>

      {/* Profile hero */}
      <div style={{ padding: '8px 24px 16px' }}>
        <div className="card notch-12" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              right: -50,
              top: -50,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(94, 234, 212, 0.08), transparent 70%)',
            }}
          />
          <div className="row gap-lg" style={{ alignItems: 'center' }}>
            <ConcentricAvatar />
            <div className="col">
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.05 }}>
                {user.name}
              </div>
              <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>{user.handle}</span>
            </div>
          </div>
          <div className="row mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <ProfileStat label="Member" val={`${user.memberDays}d`} />
            <ProfileStat label="Streak" val={`${user.streakDays}d`} highlight />
            <ProfileStat label="Mesocycle" val={user.mesoLabel.split(' · ')[0]} />
          </div>
        </div>
      </div>

      {/* IdentityGoal */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ marginBottom: 10 }}>
          <Eyebrow>{identityGoal.eyebrow}</Eyebrow>
        </div>
        <div
          className="card notch-12"
          style={{ padding: 18, background: 'rgba(94, 234, 212, 0.04)', borderColor: 'var(--border-brand)' }}
        >
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 18,
              lineHeight: 1.35,
              color: 'var(--text-primary)',
              letterSpacing: '0.005em',
            }}
          >
            "{identityGoal.quote}"
          </div>
          <p className="text-secondary mt-md" style={{ fontSize: 12, lineHeight: 1.5, paddingTop: 8 }}>
            {identityGoal.note}
          </p>
        </div>
      </div>

      {/* Aktív területek (PERMA-as-narrative) */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ marginBottom: 10 }}>
          <Eyebrow>Aktív területek · hét 21</Eyebrow>
        </div>
        <div className="card notch-4" style={{ padding: 14 }}>
          <div className="col gap-md">
            {areas.map((p, i) => (
              <div key={i} className="row gap-md" style={{ alignItems: 'center' }}>
                <div className="col flex-1">
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{p.area}</span>
                  <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>{p.last}</span>
                </div>
                <div style={{ width: 60 }}>
                  <div className="bar">
                    <div className="bar-fill glow" style={{ width: `${p.weight * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-tab shortcuts (Tudás / Emberek entry cards) */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="col gap-sm">
          <EntryCard
            icon="graph"
            color="var(--brand-glow)"
            eyebrow="Knowledge graph · Tudás"
            eyebrowBrand
            display={`${facts.length} fact · ${edges.length} kapcsolat`}
            tertiary={`${activeCount} aktív · ${facts.length - activeCount} stabilizált`}
            onClick={() => navigate('/me/knowledge')}
          />
          <EntryCard
            icon="heart"
            iconSize={14}
            color="var(--cat-tendency)"
            eyebrow="People · Emberek"
            display={`${people.length} aktív · ${summary.mentionsThisWeek} említés · hét 21`}
            tertiary="Petra · Bence · Mizu Velünk (3)"
            onClick={() => navigate('/me/people')}
          />
        </div>
      </div>

      {/* Quick rows */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="col gap-sm">
          {quickSettings.map((row, i) => (
            <SettingsListRow key={i} row={row} />
          ))}
        </div>
      </div>

      {/* Version footer */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ justifyContent: 'center', padding: 16 }}>
          <span
            className="text-tertiary"
            style={{
              fontSize: 10,
              fontFamily: 'var(--ff-mono)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            {version}
          </span>
        </div>
      </div>
    </>
  )
}
