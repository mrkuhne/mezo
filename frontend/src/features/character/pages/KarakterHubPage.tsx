// ============================================================
// Mezo · KarakterHubPage — the Karakter dossier's hub Mozaik face (mezo-1gim.13)
// Source of truth: docs/design_2.0/prototypes/src/karakter-body.html + karakter-head.html
// (the compact 2nd-iteration hub — values ×1.18, EnHubPage's convention).
// Anatomy: maturity-ring hero (7 CORE arcs, NO self-portrait line in v1 — the backend
// doesn't serve one yet) → a 4-tile mosaic (Dimenziók / Feed / Csapat / Konzílium).
// Honest states (plan's Global Constraints):
//  · overview === null (character switch off) -> a quiet degraded row, ChatPage's tone —
//    never red, never a crash.
//  · a fresh dossier (all CORE dims at maturity 0, no portrait yet) is the pre-bootstrap
//    state -> the bootstrap intro face (orb + 9-persona cluster + „Kezdjétek el").
//  · start() -> the progress face (staggered bootlines + a spinning arc) while pending.
//  · result 'created' -> the reveal face, then back to the (now populated) hub — the
//    overview cache already flipped, so the return replays the mosaic's entrance.
//  · result 'empty' (204 — nothing to read yet) -> the honest „Még nincs elég történet" face.
//  · result 'conflict' (already bootstrapped elsewhere) -> falls through to the plain hub.
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { ClaySpot } from '@/shared/ui/clay'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useCharacterBootstrap, useCharacterConferences, useCharacterExperts, useCharacterFeed, useCharacterOverview } from '@/data/hooks'
import { MaturityRing } from '@/features/character/components/MaturityRing'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'

// The prototype's `#bootLines` copy, verbatim (karakter-body.html).
const BOOT_LINES = [
  'Doki a súlytrendet olvassa…',
  'Drill a logolási mintákat nézi…',
  'Antropológus az életeseményeket rendezi…',
  'A Szkeptikus ellenőriz…',
  'Mezo összegzi a portrékat…',
]

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

type Ceremony = 'idle' | 'reveal' | 'empty'

export function KarakterHubPage() {
  const navigate = useNavigate()
  const { overview, isLoading } = useCharacterOverview()
  const bootstrap = useCharacterBootstrap()
  const { experts } = useCharacterExperts()
  const { items: feed } = useCharacterFeed()
  const { conferences } = useCharacterConferences()
  const [ceremony, setCeremony] = useState<Ceremony>('idle')

  useEffect(() => {
    if (bootstrap.result === 'created') setCeremony('reveal')
    else if (bootstrap.result === 'empty') setCeremony('empty')
  }, [bootstrap.result])

  if (isLoading) return null

  // Switch-off/degraded (overview null) — the ChatPage idiom: a quiet card, never a crash.
  if (overview == null) {
    return (
      <div className="kr-hub">
        <div className="kr-degraded">
          A karakter-dosszié jelenleg nem elérhető — ez nem hiba, csak a funkció ki van kapcsolva.
          A napló, az edzés és a Fuel változatlanul működik.
        </div>
      </div>
    )
  }

  const coreDims = overview.dimensions.filter((d) => d.kind === 'CORE')
  const preBootstrap = coreDims.length > 0 && coreDims.every((d) => d.maturity === 0 && d.portrait === '')

  if (bootstrap.pending) {
    return (
      <div className="kr-hub">
        <div className="kr-boot-progress">
          <div className="kr-progarc">
            <svg viewBox="0 0 100 100">
              <defs>
                <linearGradient id="kr-bootgrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FF7A55" />
                  <stop offset="100%" stopColor="#C9962E" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(43,33,24,0.08)" strokeWidth={7} />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#kr-bootgrad)" strokeWidth={7}
                strokeLinecap="round" strokeDasharray="90 174" />
            </svg>
            <div className="pct">gyűjtjük…</div>
          </div>
          <EntranceGroup replayKey="boot-progress">
            <div className="kr-bootlines">
              {BOOT_LINES.map((line, i) => (
                <div key={line} className="rise kr-bootline" style={{ '--d': `${i * 150}ms` } as React.CSSProperties}>
                  <span className="dot" aria-hidden="true" />
                  {line}
                </div>
              ))}
            </div>
          </EntranceGroup>
        </div>
      </div>
    )
  }

  if (ceremony === 'reveal') {
    return (
      <div className="kr-hub">
        <div className="kr-boot-reveal">
          <MaturityRing dimensions={overview.dimensions} size={132} />
          <h3>A dossziéd elkészült</h3>
          <p>7 dimenzió, kezdő állításokkal — mindegyik forrással. Ez csak a kezdet: minden héten
            tovább finomodik.</p>
          <button type="button" className="cta" onClick={() => setCeremony('idle')}>Rendben</button>
        </div>
      </div>
    )
  }

  if (ceremony === 'empty') {
    return (
      <div className="kr-hub">
        <div className="kr-empty">
          <ClaySpot name="s-hajtas" size={72} />
          <h3>Még nincs elég történet</h3>
          <p>A csapat pár nap logolás után kezd — addig nincs mit összegezni. Ez nem hiba, csak
            még korai.</p>
        </div>
      </div>
    )
  }

  if (preBootstrap && bootstrap.result !== 'conflict') {
    return (
      <div className="kr-hub">
        <div className="kr-boot-intro">
          <ClaySpot name="s-orb" size={64} className="kr-orb" />
          <h3>Kezdjük el a dossziét</h3>
          <p>A csapat elolvassa a teljes eddigi történetedet — napi összegzőket, mintákat, tényeket,
            heti áttekintéseket, naplóbejegyzéseket — és felépíti az első portrékat.</p>
          <div className="kr-boot-cluster">
            {experts.map((e) => (
              <div className="cd" key={e.key}><PersonaOrb expertKey={e.key} size={31} /></div>
            ))}
          </div>
          <button type="button" className="cta" onClick={() => bootstrap.start()}>Kezdjétek el</button>
        </div>
      </div>
    )
  }

  // ── the plain, populated hub ──
  const avgMaturity = coreDims.length > 0
    ? Math.round(coreDims.reduce((sum, d) => sum + d.maturity, 0) / coreDims.length)
    : 0
  const latestFeedItem = feed.find((f) => f.kind === 'OBSERVATION')
  const latestConference = conferences[0] ?? null
  const konzRecent = latestConference != null
    && Date.now() - new Date(latestConference.generatedAt).getTime() < THREE_DAYS_MS

  return (
    <div className="kr-hub">
      <EntranceGroup className="mz-panel-stack">
        <div className="kr-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <div className="kr-hero-title">Karakter</div>
          <MaturityRing dimensions={overview.dimensions} />
        </div>

        <Mosaic>
          <Tile wash="sky" icon="i-kristaly" eyebrow="Dimenziók" delayMs={80}
            line={`${avgMaturity}% átlag érettség · 7 + 1 dimenzió`}
            onClick={() => navigate('/me/karakter/dimenziok')} aria-label="Dimenziók" />
          <Tile wash="coral" eyebrow="Feed" delayMs={130}
            dot={feed.length > 0}
            line={latestFeedItem != null ? `„${latestFeedItem.text}”` : undefined}
            onClick={() => navigate('/me/karakter/feed')} aria-label="Feed" />
          <Tile wash="lav" eyebrow="Csapat" delayMs={180}
            line="9 profilozó — a csapat, ami épp most figyel rád"
            onClick={() => navigate('/me/karakter/csapat')} aria-label="Csapat">
            <div className="kr-clustrow">
              {experts.map((e) => (
                <div className="cd" key={e.key}><PersonaOrb expertKey={e.key} size={24} /></div>
              ))}
            </div>
          </Tile>
          <Tile wash="gold" eyebrow="Konzílium" delayMs={230}
            dot={konzRecent}
            line={latestConference != null
              ? `${new Date(latestConference.generatedAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}.`
              : undefined}
            onClick={() => navigate('/me/karakter/konzilium')} aria-label="Konzílium" />
        </Mosaic>
      </EntranceGroup>
    </div>
  )
}
