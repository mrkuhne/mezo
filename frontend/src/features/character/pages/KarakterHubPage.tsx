import { CharacterFeedPage } from '@/features/character/pages/CharacterFeedPage'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import '@/features/insights/boop-world.css'
import { Boop, Icon3D } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import {
  useCharacterBootstrap, useCharacterExperts, useCharacterOverview,
} from '@/data/hooks'
import { MaturityRing } from '@/features/character/components/MaturityRing'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { KarakterBackHead } from '@/features/character/components/KarakterBackHead'
import { personaCharacter, personaName } from '@/features/character/personaCharacter'
import { isDossierEmpty } from '@/features/character/dossierState'

// The prototype's `#bootLines` copy (karakter-body.html) — U9 (mezo-me75u.9): each line is spoken
// by the csapatfal character the persona folds into (Doki → Derű, Drill → Mocor, Antropológus →
// Mezo); the persona keys stay the source of truth.
const BOOT_LINES: { key: string; text: string }[] = [
  { key: 'doki', text: `${personaName('doki')} a súlytrendet olvassa…` },
  { key: 'drill', text: `${personaName('drill')} a logolási mintákat nézi…` },
  { key: 'antropologus', text: `${personaName('antropologus')} az életeseményeket rendezi…` },
  { key: 'szkeptikus', text: 'A Szkeptikus ellenőriz…' },
  { key: 'mezo', text: 'Mezo összegzi a portrékat…' },
]


type Ceremony = 'idle' | 'reveal' | 'empty'

export function KarakterHubPage({ embedded = false }: { embedded?: boolean }) {
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

  // U9 (mezo-me75u.9): every ceremony face wears the csapatfal back head (the feed renders its
  // own); an embedding host owns the heading, so `embedded` suppresses it.
  const face = (children: ReactNode) => (
    <div className="kr9-page kr9-hub">
      {!embedded && <KarakterBackHead small="Egyre jobban ismerünk" title="Karakter" onBack={() => navigate('/mezo')} />}
      {children}
    </div>
  )

  // Switch-off/degraded (overview null) — the ChatPage idiom: a quiet card, never a crash.
  if (overview == null) {
    return face(
      <div className="tf-dash kr9-degraded">
        <Icon3D name="t-info" size={30} />
        <span>
          A karakter-dosszié jelenleg nem elérhető — ez nem hiba, csak a funkció ki van kapcsolva.
          A napló, az edzés és a Fuel változatlanul működik.
        </span>
      </div>,
    )
  }

  // The ONE shared predicate (fix round 1) — EnHubPage's Karakter tile reads the same overview
  // through the same function, so the two surfaces can never disagree on "has this started".
  const preBootstrap = isDossierEmpty(overview)

  if (bootstrap.pending) {
    return face(
      <div className="kr9-boot">
        <div className="kr9-bootring tf-c-gold" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="uv-ring">
            <circle className="uv-ring-track" cx="60" cy="60" r="52" pathLength={100} />
            <circle className="uv-ring-prog" cx="60" cy="60" r="52" pathLength={100} strokeDasharray="34 100" />
          </svg>
          <span className="pct">gyűjtjük…</span>
        </div>
        <EntranceGroup replayKey="boot-progress">
          <div className="tf-rows kr9-bootlines">
            {BOOT_LINES.map((line, i) => (
              <div key={line.text} className={`rise tf-case tf-flatc tf-c-${personaCharacter(line.key).accent} kr9-bootline`}
                style={{ '--d': `${i * 150}ms` } as CSSProperties}>
                <span className="tf-cmain">
                  <PersonaOrb expertKey={line.key} size={30} />
                  <span className="tf-ctxt">{line.text}</span>
                </span>
              </div>
            ))}
          </div>
        </EntranceGroup>
      </div>,
    )
  }

  if (ceremony === 'reveal') {
    return face(
      <section className="tf-rhero tf-c-gold kr9-reveal">
        <MaturityRing dimensions={overview.dimensions} size={132} />
        <h3>A dossziéd elkészült</h3>
        <p className="kr9-prose">7 dimenzió, kezdő állításokkal — mindegyik forrással. Ez csak a kezdet: minden héten
          tovább finomodik.</p>
        <button type="button" className="kr9-cta tf-c-gold" onClick={() => navigate('/mezo/karakter/konzilium')}>
          <Icon3D name="t-council" size={18} />Nézd meg az első konzíliumot
        </button>
      </section>,
    )
  }

  if (ceremony === 'empty') {
    return face(
      <section className="tf-rhero tf-c-sage kr9-empty">
        <Icon3D name="t-sprout" size={72} className="kr9-heroicon" />
        <h3>Még nincs elég történet</h3>
        <p className="kr9-prose">A csapat pár nap logolás után kezd — addig nincs mit összegezni. Ez nem hiba, csak
          még korai.</p>
        {/* karakter-body.html's `#emptyBack` (fix round 1: this face was a dead end — no way
           out of it). Resetting ceremony to 'idle' re-evaluates the SAME shared predicate
           the rest of the page uses, so re-entry always lands somewhere sane: the intro face
           again (the dossier is still untouched — a 204 changed nothing) or the plain hub if
           it somehow isn't any more. Never re-traps on the empty face itself. */}
        <button type="button" className="kr9-cta is-ghost" onClick={() => setCeremony('idle')}>‹ vissza</button>
      </section>,
    )
  }

  if (preBootstrap && bootstrap.result !== 'conflict') {
    // U9: the catalogue's personas fold into the csapatfal's characters — one face per character.
    const cast = [...new Map(experts.map((e) => [personaCharacter(e.key).id, e.key])).values()]
    return face(
      <>
        <section className="tf-rhero tf-c-gold kr9-intro">
          <Boop domain="gold" size={92} alive className="tf-rboop" />
          <h3>Kezdjük el a dossziét</h3>
          <p className="kr9-prose">A csapat elolvassa a teljes eddigi történetedet — napi összegzőket, mintákat, tényeket,
            heti áttekintéseket, naplóbejegyzéseket — és felépíti az első portrékat.</p>
        </section>
        <div className="kr9-cast5">
          {cast.map((key) => (
            <span className="kr9-castb" key={key}>
              <PersonaOrb expertKey={key} size={46} />
              <b>{personaName(key)}</b>
            </span>
          ))}
        </div>
        <div className="kr9-center">
          <button type="button" className="kr9-cta tf-c-gold" onClick={() => bootstrap.start()}>
            <Icon3D name="t-play" size={18} />Kezdjétek el
          </button>
        </div>
      </>,
    )
  }

  return <CharacterFeedPage embedded={embedded} />
}
