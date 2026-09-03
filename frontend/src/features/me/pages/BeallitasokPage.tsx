// ============================================================
// Mezo · BeallitasokPage — Beállítások (hub-tile-reorg spec, mezo-o486)
// A korábbi téma-only SettingsSheet utódja: az Én hub Beállítások csempéje
// nyitja. Csoportosított lista (Android settings-guideline minta): Téma
// választó helyben (useTheme — az egyetlen perzisztált beállítás) + a ritkán
// használt felületek sorai (Értesítések kapcsolói, AI-napló). Nincs saját
// design_2.0 prototípus — a Mozaik oldal-primitívekből épül.
// Honest states: a sor-alsósor eltűnik, amíg a forrása nem mond semmit.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLlmUsageSummary, useMe, useNotificationPrefs } from '@/data/hooks'
import { formatRollupCost } from '@/features/me/logic/llmCallFormat'
import { useTheme } from '@/app/ThemeProvider'
import type { ThemeMode } from '@/shared/lib/theme'

const THEME_OPTIONS: { key: ThemeMode; icon: 'sun' | 'moon' | 'sparkle'; label: string; desc: string }[] = [
  { key: 'light', icon: 'sun', label: 'Világos', desc: 'Mindig nappali felület' },
  { key: 'dark', icon: 'moon', label: 'Sötét', desc: 'Mindig sötét felület' },
  { key: 'auto', icon: 'sparkle', label: 'Cirkadián', desc: 'Este a tompítással (lefekvés −90 p) sötétre vált, ébredés előtt 30 perccel vissza világosra. Az alváscélodat követi.' },
]

export function BeallitasokPage() {
  const navigate = useNavigate()
  const { mode, setMode } = useTheme()

  // Row bottom lines — the exact derivations the Én hub tiles carried (honest states).
  const { prefs, isPending: prefsPending } = useNotificationPrefs()
  const enabledPrefs = prefs.filter((p) => p.enabled).length
  const ertesitesLine = prefsPending || prefs.length === 0
    ? undefined
    : `${enabledPrefs} / ${prefs.length} kategória`

  const { data: llm, isPending: llmPending } = useLlmUsageSummary()
  const aiLine = llmPending
    ? undefined
    : `${llm.week.callCount} hívás · ${formatRollupCost(llm.week.costUsd)} / hét`

  const isOwner = useMe().data?.role === 'OWNER'

  const row = (icon: 'i-ertesites' | 'i-erme' | 'i-emberek', label: string, line: string | undefined, to: string) => (
    <button type="button" className="card row" aria-label={label} onClick={() => navigate(to)}
      style={{ justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left' }}>
      <div className="row gap-md" style={{ alignItems: 'center' }}>
        <ClayIcon name={icon} size={28} />
        <div className="col">
          <span>{label}</span>
          {line != null && <span style={SECTION_LABEL}>{line}</span>}
        </div>
      </div>
      <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>›</span>
    </button>
  )

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me')} label="‹ Én" />
      <PageHero icon="i-beallitas" name="Beállítások" sub="téma · értesítések · AI-napló · admin" />
      <PageBody>
        <EntranceGroup className="col gap-lg">
          <div className="col gap-sm rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <span style={SECTION_LABEL}>Téma</span>
            <div className="col gap-sm">
              {THEME_OPTIONS.map((o) => (
                <button key={o.key} className="card row" aria-pressed={mode === o.key}
                  onClick={() => setMode(o.key)}
                  style={{
                    justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left',
                    borderColor: mode === o.key ? 'var(--lav-deep)' : 'var(--border-subtle)',
                    background: mode === o.key ? 'var(--wash-lav)' : undefined,
                  }}>
                  <div className="row gap-md" style={{ alignItems: 'flex-start' }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: mode === o.key ? 'var(--wash-lav)' : 'var(--surface-2)' }}>
                      <Icon name={o.icon} size={16} color={mode === o.key ? 'var(--lav-deep)' : 'var(--text-tertiary)'} />
                    </span>
                    <div className="col">
                      <span>{o.label}</span>
                      <span style={SECTION_LABEL}>{o.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="col gap-sm rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            <span style={SECTION_LABEL}>Felületek</span>
            {row('i-ertesites', 'Értesítések', ertesitesLine, '/me/ertesitesek/beallitasok')}
            {isOwner && row('i-erme', 'AI-napló', aiLine, '/me/ai-usage')}
            {isOwner && row('i-emberek', 'Beta admin', 'meghívók · felhasználók', '/me/beallitasok/admin')}
          </div>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
