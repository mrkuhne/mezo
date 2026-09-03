import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminActions, useAdminInvites, useAdminUsers, useMe } from '@/data/hooks'
import { AdminInviteRow } from '@/features/me/components/AdminInviteRow'
import { AdminUserRow } from '@/features/me/components/AdminUserRow'
import { TempPasswordSheet } from '@/features/me/sheets/TempPasswordSheet'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

// Beta admin (mezo-qw37.3, spec §7): the owner's minimal console — invite codes and accounts.
// Reached only from the OWNER-only row on BeallitasokPage; the backend gates every call with
// requireOwner() regardless, so a USER deep-linking here sees 403 toasts and empty lists.

type Tab = 'invites' | 'users'
const TABS: { key: Tab; label: string }[] = [
  { key: 'invites', label: 'Meghívók' },
  { key: 'users', label: 'Felhasználók' },
]
const INPUT: React.CSSProperties = { flex: 1, minHeight: 40, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface-1)', padding: '0 12px', fontSize: 13, color: 'var(--text-primary)' }
const PRIMARY: React.CSSProperties = { minHeight: 40, borderRadius: 999, padding: '0 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--text-primary)', color: 'var(--surface-1)' }

export function BetaAdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('invites')
  const [label, setLabel] = useState('')
  const [reset, setReset] = useState<{ name: string; password: string } | null>(null)

  const me = useMe()
  const invites = useAdminInvites()
  const users = useAdminUsers()
  const actions = useAdminActions()

  const mint = async () => {
    await actions.createInvite(label)
    setLabel('')
  }
  const resetFor = async (id: string) => {
    const name = users.data.find((u) => u.id === id)?.name ?? ''
    const password = await actions.resetPassword(id)
    setReset({ name, password })
  }

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me/beallitasok')} label="‹ Beállítások" />
      <PageHero icon="i-emberek" name="Beta admin" sub="meghívók · felhasználók" />
      <PageBody>
        <EntranceGroup className="col gap-md">
          <div className="row rise" style={{ gap: 6, '--d': '0ms' } as React.CSSProperties}>
            {TABS.map((t) => (
              <button key={t.key} type="button" className="chip" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}
                style={tab === t.key ? { background: 'var(--text-primary)', color: 'var(--surface-1)', borderColor: 'transparent' } : undefined}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'invites' && (
            <div className="col gap-sm rise" style={{ '--d': '60ms' } as React.CSSProperties}>
              <div className="row" style={{ gap: 8 }}>
                <input aria-label="Címke" placeholder="Kinek szól? (opcionális)" value={label} style={INPUT}
                  onChange={(e) => setLabel(e.target.value)} />
                <button type="button" style={PRIMARY} disabled={actions.pending} onClick={mint}>Új kód</button>
              </div>
              {invites.isError ? (
                <GhostState message="Nem sikerült betölteni a meghívókat." ctaLabel="Újra" onCta={invites.refetch} />
              ) : invites.data.length === 0 ? (
                <GhostState message="Nincs nyitott meghívó." />
              ) : (
                invites.data.map((invite) => (
                  <AdminInviteRow key={invite.id} invite={invite} onDelete={(id) => { void actions.deleteInvite(id) }} />
                ))
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="col gap-sm rise" style={{ '--d': '60ms' } as React.CSSProperties}>
              {users.isError ? (
                <GhostState message="Nem sikerült betölteni a felhasználókat." ctaLabel="Újra" onCta={users.refetch} />
              ) : users.data.length === 0 ? (
                <GhostState message="Még nincs regisztrált felhasználó." />
              ) : (
                users.data.map((user) => (
                  <AdminUserRow key={user.id} user={user} self={user.id === me.data?.id}
                    onReset={(id) => { void resetFor(id) }}
                    onToggleStatus={(id, next) => { void actions.setStatus(id, next) }} />
                ))
              )}
            </div>
          )}
        </EntranceGroup>
      </PageBody>
      {reset && <TempPasswordSheet name={reset.name} password={reset.password} onClose={() => setReset(null)} />}
    </MozaikPage>
  )
}
