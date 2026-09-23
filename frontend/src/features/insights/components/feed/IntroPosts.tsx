import { Link } from 'react-router-dom'
import { useCharacterBootstrap } from '@/data/hooks'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import { renderInline } from '@/shared/lib/markdown'
import { Icon3D } from '@/shared/ui/clay'
import { FeedAvatar } from './FeedPostHead'

/**
 * Hidegindítás (spec §2.6, mezo-a9bo7.10): az üres falon a csapat posztokban mutatkozik be —
 * ez váltja a Kalauz buborék-sorozatát. A szövegek SZÓ SZERINT a jóváhagyott prototípus
 * (`uveg-uzenofal.html` `elsonap`) 1. napi posztjai. Ezek statikus UI-szövegek, nem rekordok
 * (ADR 0049): nem állítanak semmit a userről, ezért nincs rajtuk „Miből látszik?” és hármas.
 */
const MEZO_TITLE = 'Szia! Mi leszünk a te kis csapatod.'
const MEZO_BODY = 'Öten vagyunk, és mostantól rád figyelünk. 👋 Én fogom össze a többieket: hetente leülünk, megvitatjuk, mit láttunk, és **csak az kerül a rólad szóló képbe, amiben egyetértünk** — a Szkeptikusunk erre kínosan ügyel. Te pedig bármikor rákérdezhetsz bármire: **miből látszik?** 🔍'

export const INTRO_POSTS: { id: TeamCharacterId; body: string }[] = [
  { id: 'szunya', body: 'Én az **éjszakáidra** figyelek majd. 🌙 Még semmit sem tudok rólad — pár naplózott alvás után jelentkezem az első észrevétellel. Addig is egy titok: már az is rengeteget elárul, hogy **mikor** fekszel le, nem csak az, hogy mennyit alszol.' },
  { id: 'falat', body: 'Én a **tányérodat** nézem: mit eszel, mikor, és mit tesz ez a céljaiddal. 🍳 Az első naplózott étkezés után már mondok valamit — nem pontozni fogok, hanem észrevenni. A kedvenc kérdésem: **mi vált be?** Azt ugyanis érdemes megismételni.' },
  { id: 'mocor', body: 'Én a **mozgásodra** és a terhelésedre figyelek — meg arra, hogy a naplózás ne maradjon el. 💪 Nem hajtalak, de észreveszem, és szólok, ha három nap ugyanaz megy: a tested a **változatosságból** épül, nem a megszokásból.' },
  { id: 'deru', body: 'Én arra figyelek, **hogy vagy**. 🌤️ Ehhez a te szavad kell: egy-egy rövid esti bejelentkezés — cserébe én veszem észre, mi mozgatja a hangulatod, és szólok, mielőtt te is éreznéd. Az energiád történetét szerintem együtt fogjuk megfejteni.' },
]

function IntroHead({ id, flag }: { id: TeamCharacterId; flag?: string }) {
  const who = TEAM[id]
  return (
    <div className="tf-ph">
      <Link to={`/mezo/csapat/${who.id}`} aria-label={`${who.name} szobája`}>
        <FeedAvatar id={who.id} />
      </Link>
      <span className="tf-who">
        <span className="tf-name">{who.name}</span>
        <span className="tf-area">{who.area}</span>
        <span className="tf-meta">bemutatkozás</span>
      </span>
      {flag && <span className="tf-flag tf-flag-new">{flag}</span>}
    </div>
  )
}

/** A dosszié indítása a KarakterHubPage-dzsel AZONOS mutációval (`useCharacterBootstrap`). */
function StartDossier() {
  const bootstrap = useCharacterBootstrap()
  if (bootstrap.result === 'created' || bootstrap.result === 'conflict') {
    return <p className="tf-note" role="status">Elindult — a csapat olvassa a történetedet. Az első bejegyzések hamarosan itt lesznek.</p>
  }
  if (bootstrap.result === 'empty') {
    return <p className="tf-note" role="status">Még nincs elég történet — pár nap naplózás után a csapat magától kezd.</p>
  }
  return (
    <button type="button" className="glass tf-send tf-intro-cta tf-c-gold" disabled={bootstrap.pending} onClick={() => bootstrap.start()}>
      <Icon3D name="t-sprout" size={22} />
      {bootstrap.pending ? 'A csapat olvassa a történetedet…' : 'Kezdjük el a dossziét'}
    </button>
  )
}

export function IntroPosts() {
  return (
    <section className="tf-daysec" aria-label="Bemutatkozunk">
      <div className="tf-day"><span>Bemutatkozunk</span></div>
      <article className="glass tf-poster tf-c-gold" data-intro="mezo">
        <IntroHead id="mezo" flag="Új arc" />
        <h3 className="tf-claim">{MEZO_TITLE}</h3>
        <p className="tf-body">{renderInline(MEZO_BODY, { boldOnly: true })}</p>
      </article>
      {INTRO_POSTS.map(p => (
        <article key={p.id} className={`tf-post tf-c-${TEAM[p.id].accent}`} data-intro={p.id}>
          <IntroHead id={p.id} />
          <p className="tf-body">{renderInline(p.body, { boldOnly: true })}</p>
        </article>
      ))}
      <StartDossier />
    </section>
  )
}
