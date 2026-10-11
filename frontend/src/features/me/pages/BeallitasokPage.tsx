import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { Lines, SettingsFrame, useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { useM } from '@/shared/i18n'
import { useLanguageSetting } from '@/data/auth/languageHooks'
import type { Lang } from '@/shared/i18n'
import { isMockMode } from '@/data/_client/mode'
import { THEME_LOCK } from '@/shared/lib/theme'
import { useAuthActions, useLlmUsageSummary, useMe, useNotificationPrefs } from '@/data/hooks'
import { ChangePasswordSheet } from '@/features/auth/sheets/ChangePasswordSheet'
import { formatRollupCost } from '@/features/me/logic/llmCallFormat'
import { useTheme } from '@/app/ThemeProvider'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import type { ThemeMode } from '@/shared/lib/theme'

const THEME_OPTIONS: { key: ThemeMode; icon: 'sun' | 'moon' | 'sparkle' }[] = [
  { key: 'light', icon: 'sun' },
  { key: 'dark', icon: 'moon' },
  { key: 'auto', icon: 'sparkle' },
]

// Each language is named in itself, in both languages.
const LANGUAGE_CHOICES: { lang: Lang; label: string }[] = [{ lang: 'hu', label: 'Magyar' }, { lang: 'en', label: 'English' }]

export function BeallitasokPage() {
  const messages = useM().settings
  const t = messages.general
  const { lang, setLanguage } = useLanguageSetting()
  const navigate = useNavigate()
  const { state: originState } = useSettingsOrigin()
  const { mode, setMode } = useTheme()

  // Row bottom lines — the exact derivations the Én hub tiles carried (honest states).
  const { prefs, isPending: prefsPending } = useNotificationPrefs()
  const enabledPrefs = prefs.filter((p) => p.enabled).length
  const ertesitesLine = prefsPending || prefs.length === 0
    ? undefined
    : t.notificationsLine(enabledPrefs, prefs.length)

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
    : t.aiLine(llm.week.callCount, formatRollupCost(llm.week.costUsd))

  // A kalauzok újranézése (mezo-gb1s.4). Honest state: a hiba LÁTSZIK — a resetAll
  // szándékosan kiszáll hibára (mezo-gb1s.2), mert némán elnyelve a reset visszafordulna.
  const { resetAll } = useTutorial()
  const [kalauzState, setKalauzState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const kalauzLine = kalauzState === 'busy' ? t.guides.busy
    : kalauzState === 'done' ? t.guides.done
    : kalauzState === 'error' ? t.guides.error
    : t.guides.idle

  // Üveg (mezo-me75u.7): each row wears a Titanium 3D icon in a lit well; `tone` is the well's accent.
  const row = (icon: Icon3DName, tone: string, label: string, line: string | undefined, to: string) => (
    <button type="button" className={`settings-row settings-${tone}`} aria-label={label} onClick={() => navigate(to, { state: originState })}>
      <span className="settings-row-art uv-well"><Icon3D name={icon} size={28} /></span>
      <span className="settings-row-copy"><strong>{label}</strong>{line && <small>{line}</small>}</span>
      <span className="settings-chev" aria-hidden="true">›</span>
    </button>
  )

  return (
    <SettingsFrame title={t.title} subtitle={t.subtitle}>
      {/* Nyelv (mezo-n4wf5.11): the app language, stored with the account. The switch is optimistic,
          so the control stays usable while the save is in flight; choosing the current one does nothing. */}
      <h2 className="settings-section-label">{messages.language.heading}</h2>
      <section className="settings-lang glass settings-me">
        <div className="settings-lang-options" role="group" aria-label={messages.language.groupLabel}>
          {LANGUAGE_CHOICES.map(choice => <button key={choice.lang} type="button" className="settings-lang-choice" aria-pressed={lang === choice.lang} onClick={() => { if (lang !== choice.lang) setLanguage(choice.lang) }}>{choice.label}</button>)}
        </div>
        <p className="settings-lang-body">{messages.language.body}</p>
        <p className="settings-lang-note">{messages.language.note}</p>
      </section>

      {/* Dark-only lock (üveg bible §8, mezo-me75u.1): the theme choice is hidden while the
          lock holds — the picker's code stays so light can return by lifting THEME_LOCK. */}
      {THEME_LOCK === null && <>
      <h2 className="settings-section-label">{t.theme.heading}</h2>
      <div className="settings-theme-options">
        {THEME_OPTIONS.map(o => <button key={o.key} className={`settings-theme-choice settings-theme-${o.key}`} aria-pressed={mode === o.key} onClick={() => setMode(o.key)}>
          <span className="settings-theme-scene" aria-hidden="true"><Icon name={o.icon} size={23} /><i /><i /><i /></span>
          <strong>{t.theme[o.key].label}</strong><span className="settings-theme-selected" aria-hidden="true">{mode === o.key ? '✓' : '○'}</span>
        </button>)}
      </div>
      <p className="settings-theme-description">{t.theme[mode].desc}</p>
      <section className="settings-wash settings-fuel settings-theme-note"><p className="settings-editorial"><Lines text={t.theme.noteEditorial} /></p><p>{t.theme.noteBody}</p></section>
      </>}

      <h2 className="settings-section-label">{t.account}</h2>
      <button type="button" aria-label={t.editAccount} onClick={() => navigate('/settings/account', { state: originState })} className="settings-account-wash glass settings-me">
        <span className="settings-row-art uv-well"><Icon3D name="t-person" size={30} /></span><span><strong>{me?.name ?? '—'}</strong><small>{me?.email ?? '—'}</small></span><span className="settings-chev" aria-hidden="true">↗</span>
      </button>
      <div className="settings-rows glass settings-me">
        <button type="button" className="settings-row settings-nap" aria-label={t.passwordRow.title} onClick={() => setSheet('password')}><span className="settings-row-art uv-well"><Icon3D name="t-key" size={28} /></span><span className="settings-row-copy"><strong>{t.passwordRow.title}</strong><small>{t.passwordRow.description}</small></span><span className="settings-chev" aria-hidden="true">›</span></button>
        {canLogout && <button type="button" className="settings-row settings-train settings-logout" aria-label={t.logout} onClick={logout}><span className="settings-row-art uv-well"><Icon3D name="t-exit" size={28} /></span><span className="settings-row-copy"><strong>{t.logout}</strong></span><span className="settings-chev" aria-hidden="true">↗</span></button>}
      </div>

      <h2 className="settings-section-label">{t.around}</h2>
      <div className="settings-rows glass settings-sky">
        {row('t-bell', 'sky', t.notifications, ertesitesLine, '/settings/notifications')}
        <button type="button" className="settings-row settings-nap" aria-label={t.guides.title} disabled={kalauzState === 'busy'} onClick={() => {
          setKalauzState('busy')
          resetAll().then(() => setKalauzState('done')).catch(() => setKalauzState('error'))
        }}>
          <span className="settings-row-art uv-well"><Icon3D name="t-compass" size={28} /></span><span className="settings-row-copy"><strong>{t.guides.title}</strong><small role="status">{kalauzLine}</small></span><Icon3D name="t-repeat" size={22} className="settings-row-end" />
        </button>
      </div>
      {isOwner && <><h2 className="settings-section-label">{t.owner}</h2><div className="settings-rows glass settings-mezo">{row('t-coin', 'nap', t.aiLog, aiLine, '/admin/cost')}{row('t-people', 'mezo', t.admin, t.adminLine, '/admin')}</div></>}
      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}
    </SettingsFrame>
  )
}
