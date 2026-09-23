import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { SettingsFrame, useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { isMockMode } from '@/data/_client/mode'
import { THEME_LOCK } from '@/shared/lib/theme'
import { useAuthActions, useLlmUsageSummary, useMe, useNotificationPrefs } from '@/data/hooks'
import { ChangePasswordSheet } from '@/features/auth/sheets/ChangePasswordSheet'
import { formatRollupCost } from '@/features/me/logic/llmCallFormat'
import { useTheme } from '@/app/ThemeProvider'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import type { ThemeMode } from '@/shared/lib/theme'

const THEME_OPTIONS: { key: ThemeMode; icon: 'sun' | 'moon' | 'sparkle'; label: string; desc: string }[] = [
  { key: 'light', icon: 'sun', label: 'Világos', desc: 'Mindig nappali felület' },
  { key: 'dark', icon: 'moon', label: 'Sötét', desc: 'Mindig sötét felület' },
  { key: 'auto', icon: 'sparkle', label: 'Cirkadián', desc: 'Este a tompítással (lefekvés −90 p) sötétre vált, ébredés előtt 30 perccel vissza világosra. Az alváscélodat követi.' },
]

export function BeallitasokPage() {
  const navigate = useNavigate()
  const { state: originState } = useSettingsOrigin()
  const { mode, setMode } = useTheme()

  // Row bottom lines — the exact derivations the Én hub tiles carried (honest states).
  const { prefs, isPending: prefsPending } = useNotificationPrefs()
  const enabledPrefs = prefs.filter((p) => p.enabled).length
  const ertesitesLine = prefsPending || prefs.length === 0
    ? undefined
    : `${enabledPrefs} / ${prefs.length} kategória`

  // Fiók (S2, mezo-qw37.2): identity from /api/auth/me (mock: the static owner), password change
  // in a sheet, logout. Logout only exists where a session does — mock mode has no token and
  // AuthGate short-circuits to the app there, so the row is hidden rather than dead.
  const { data: me } = useMe()
  const { logout } = useAuthActions()
  const [sheet, setSheet] = useState<'password' | null>(null)
  const canLogout = !isMockMode()

  const isOwner = me?.role === 'OWNER'
  // The endpoint is OWNER-only (LlmUsageController.requireOwner()) — a non-owner visiting
  // Beállítások must never fire this request (it would 403, twice with the query's retry).
  // `enabled: isOwner` skips the fetch entirely for a non-owner; the row below is ALSO
  // gated on `isOwner`, so aiLine is never even read in that case — but the query stays
  // permanently pending (never resolved, never errored) while disabled, which is the
  // deliberate honest-empty state a re-render-without-remount (e.g. role flips) would see,
  // not an accident of `llm` going unread.
  const { data: llm, isPending: llmPending } = useLlmUsageSummary({ enabled: isOwner })
  const aiLine = llmPending
    ? undefined
    : `${llm.week.callCount} hívás · ${formatRollupCost(llm.week.costUsd)} / hét`

  // A kalauzok újranézése (mezo-gb1s.4). Honest state: a hiba LÁTSZIK — a resetAll
  // szándékosan kiszáll hibára (mezo-gb1s.2), mert némán elnyelve a reset visszafordulna.
  const { resetAll } = useTutorial()
  const [kalauzState, setKalauzState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const kalauzLine = kalauzState === 'busy' ? 'Törlés…'
    : kalauzState === 'done' ? 'Kész — a következő oldalakon újra felugranak.'
    : kalauzState === 'error' ? 'Most nem sikerült — próbáld újra.'
    : 'Az első indítás és az oldal-kalauzok újra megjelennek'

  const row = (icon: 'i-ertesites' | 'i-erme' | 'i-emberek', label: string, line: string | undefined, to: string) => (
    <button type="button" className="settings-row" aria-label={label} onClick={() => navigate(to, { state: originState })}>
      <span className="settings-row-art"><ClayIcon name={icon} size={30} /></span>
      <span className="settings-row-copy"><strong>{label}</strong>{line && <small>{line}</small>}</span>
      <span aria-hidden="true">›</span>
    </button>
  )

  return (
    <SettingsFrame title="Otthon az appban." subtitle="Ugyanaz a világ. A saját fényeiddel és szokásaiddal.">
      {/* Dark-only lock (üveg bible §8, mezo-me75u.1): the theme choice is hidden while the
          lock holds — the picker's code stays so light can return by lifting THEME_LOCK. */}
      {THEME_LOCK === null && <>
      <h2 className="settings-section-label">Téma</h2>
      <div className="settings-theme-options">
        {THEME_OPTIONS.map(o => <button key={o.key} className={`settings-theme-choice settings-theme-${o.key}`} aria-pressed={mode === o.key} onClick={() => setMode(o.key)}>
          <span className="settings-theme-scene" aria-hidden="true"><Icon name={o.icon} size={23} /><i /><i /><i /></span>
          <strong>{o.label}</strong><span className="settings-theme-selected" aria-hidden="true">{mode === o.key ? '✓' : '○'}</span>
        </button>)}
      </div>
      <p className="settings-theme-description">{THEME_OPTIONS.find(o => o.key === mode)?.desc}</p>
      <section className="settings-wash settings-fuel settings-theme-note"><p className="settings-editorial">Jó itt lenni.<br />Nappal és este is.</p><p>A megjelenés ezen az eszközön érvényes. A cirkadián mód a saját alváscélodat követi.</p></section>
      </>}

      <h2 className="settings-section-label">Fiók</h2>
      <button type="button" aria-label="Fiókadatok szerkesztése" onClick={() => navigate('/settings/account', { state: originState })} className="settings-account-wash settings-me">
        <ClayIcon name="i-emberek" size={44} /><span><strong>{me?.name ?? '—'}</strong><small>{me?.email ?? '—'}</small></span><span aria-hidden="true">↗</span>
      </button>
      <button type="button" className="settings-row" aria-label="Jelszó módosítása" onClick={() => setSheet('password')}><span className="settings-row-copy"><strong>Jelszó módosítása</strong><small>A belépésed maradjon a tiéd</small></span><span aria-hidden="true">›</span></button>
      {canLogout && <button type="button" className="settings-row settings-logout" aria-label="Kijelentkezés" onClick={logout}><span className="settings-row-copy"><strong>Kijelentkezés</strong></span><span aria-hidden="true">↗</span></button>}

      <h2 className="settings-section-label">Ami körülvesz</h2>
      {row('i-ertesites', 'Értesítések', ertesitesLine, '/settings/notifications')}
      <button type="button" className="settings-row settings-nap" aria-label="Kalauzok újranézése" disabled={kalauzState === 'busy'} onClick={() => {
        setKalauzState('busy')
        resetAll().then(() => setKalauzState('done')).catch(() => setKalauzState('error'))
      }}>
        <span className="settings-row-art"><ClayIcon name="i-tudas" size={30} /></span><span className="settings-row-copy"><strong>Kalauzok újranézése</strong><small role="status">{kalauzLine}</small></span><span aria-hidden="true">↺</span>
      </button>
      {isOwner && <><h2 className="settings-section-label">Tulajdonosi eszközök</h2>{row('i-erme', 'AI-napló', aiLine, '/admin/cost')}{row('i-emberek', 'Admin', 'Meghívók · felhasználók', '/admin')}</>}
      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}
    </SettingsFrame>
  )
}
