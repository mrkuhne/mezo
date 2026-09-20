import { CharacterFeedPage } from '@/features/character/pages/CharacterFeedPage'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import {
  useCharacterBootstrap, useCharacterExperts, useCharacterOverview,
} from '@/data/hooks'
import { MaturityRing } from '@/features/character/components/MaturityRing'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { isDossierEmpty } from '@/features/character/dossierState'

// The prototype's `#bootLines` copy, verbatim (karakter-body.html).
const BOOT_LINES = [
  'Doki a súlytrendet olvassa…',
  'Drill a logolási mintákat nézi…',
  'Antropológus az életeseményeket rendezi…',
  'A Szkeptikus ellenőriz…',
  'Mezo összegzi a portrékat…',
]


type Ceremony = 'idle' | 'reveal' | 'empty'

export function KarakterHubPage() {
  const navigate = useNavigate()
  const { overview, isLoading } = useCharacterOverview()
  const bootstrap = useCharacterBootstrap()
  const { experts, isLoading: expertsLoading } = useCharacterExperts()
  const [ceremony, setCeremony] = useState<Ceremony>('idle')

  useEffect(() => {
    if (bootstrap.result === 'created') setCeremony('reveal')
    else if (bootstrap.result === 'empty') setCeremony('empty')
  }, [bootstrap.result])

  // Fix round (final review, I5): folding the experts loading window into this page's own
  // gate too — without it, the pending window between the overview settling and the experts
  // catalog arriving renders the persona cluster/count off a still-empty `experts` array (Mezo
  // loses the ruling face, "0 profilozó" flashes) instead of the honest loading no-render.
  if (isLoading || expertsLoading) return null

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

  // The ONE shared predicate (fix round 1) — EnHubPage's Karakter tile reads the same overview
  // through the same function, so the two surfaces can never disagree on "has this started".
  const preBootstrap = isDossierEmpty(overview)

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
          <button type="button" className="cta" onClick={() => navigate('/mezo/karakter/konzilium')}>
            Nézd meg az első konzíliumot
          </button>
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
          {/* karakter-body.html's `#emptyBack` (fix round 1: this face was a dead end — no way
             out of it). Resetting ceremony to 'idle' re-evaluates the SAME shared predicate
             the rest of the page uses, so re-entry always lands somewhere sane: the intro face
             again (the dossier is still untouched — a 204 changed nothing) or the plain hub if
             it somehow isn't any more. Never re-traps on the empty face itself. */}
          <button type="button" className="kr-emptyback" onClick={() => setCeremony('idle')}>‹ vissza</button>
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

  return <CharacterFeedPage />
}
