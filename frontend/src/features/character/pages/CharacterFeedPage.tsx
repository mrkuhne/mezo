import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import '@/features/insights/boop-world.css'
import { Icon3D } from '@/shared/ui/clay'
import { KarakterBackHead } from '@/features/character/components/KarakterBackHead'
import { useCharacterExperts, useCharacterFeed } from '@/data/hooks'
import { CharacterMorningStory } from '@/features/character/components/CharacterMorningStory'
import { CharacterPostCard } from '@/features/character/components/CharacterPostCard'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { CharacterCouncilStatus } from '@/features/character/components/CharacterCouncilStatus'

export function CharacterFeedPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { items, isLoading, isError, refetch } = useCharacterFeed(60)
  const { experts } = useCharacterExperts()
  const [count, setCount] = useState(12)
  const [filter, setFilter] = useState<'all' | 'observations' | 'outcomes' | 'discussions'>('all')
  const [openStory, setOpenStory] = useState(0)
  const storyPost = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const featured = items.find(item => item.expertKey !== 'user' && item.sourceId && item.sourceType)
  useEffect(() => {
    if (!openStory) return
    storyPost.current?.focus({ preventScroll: true })
    storyPost.current?.scrollIntoView?.({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [openStory, reducedMotion])
  const visible = items.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'observations' ? item.kind === 'OBSERVATION' : filter === 'discussions' ? item.kind === 'CONFERENCE_POST' : item.kind === 'CONFERENCE_CHANGE'),
  )
  return (
    <div className="kr9-page kr9-feed">
      {/* U9 (mezo-me75u.9): the in-page tab strip is gone — the dock owns navigation. A
         standalone feed wears the csapatfal back head; an embedding host owns its heading. */}
      {!embedded && <KarakterBackHead small="Egyre jobban ismerünk" title="Karakter" onBack={() => navigate('/mezo')} />}
      <CharacterCouncilStatus />
      {!isLoading && !isError && featured && (
        <CharacterMorningStory item={featured} experts={experts} onOpen={() => {
          setFilter('all')
          setCount(value => Math.max(value, items.indexOf(featured) + 1))
          setOpenStory(value => value + 1)
        }} />
      )}
      <div className="kr9-filt" role="group" aria-label="Bejegyzések szűrése">
        {(
          [
            { value: 'all', text: 'Minden' },
            { value: 'observations', text: 'Megfigyelések' },
            { value: 'discussions', text: 'Beszélgetések' },
            { value: 'outcomes', text: 'Következtetések' },
          ] as const
        ).map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.text}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="kr9-note" role="status">
          A bejegyzések betöltése…
        </p>
      ) : isError ? (
        <div className="tf-dash kr9-note-dash" role="alert">
          <Icon3D name="t-info" size={28} />
          <span>
            Nem sikerült betölteni az üzenőfalat.{' '}
            <button type="button" className="kr9-inline" onClick={refetch}>
              Újrapróbálom
            </button>
          </span>
        </div>
      ) : visible.length === 0 ? (
        <p className="kr9-note">Egyelőre nincs friss megfigyelés ebben a nézetben.</p>
      ) : (
        <div className="kr9-posts">
          {visible.slice(0, count).map((item, index) => (
            <div
              key={
                item.sourceId
                  ? `${item.sourceType}-${item.sourceId}-${item.sourceIndex}`
                  : `${item.at}-${index}`
              }
              ref={item === featured ? storyPost : undefined}
              tabIndex={-1}
              className="kr9-story-target"
            >
              <CharacterPostCard item={item} experts={experts} />
            </div>
          ))}
        </div>
      )}
      {visible.length > count && (
        <div className="kr9-center">
          <button className="kr9-cta is-ghost" type="button" onClick={() => setCount((value) => value + 12)}>
            Korábbi bejegyzések
          </button>
        </div>
      )}
      <div className="tf-sec"><h2>Mögötte</h2></div>
      <div className="tf-rows">
        <button type="button" className="glass tf-rowg tf-c-slate" onClick={() => navigate('/mezo/karakter/gepterem')}>
          <Icon3D name="t-gear" size={40} />
          <span className="tf-rowtxt">
            <span className="tf-rowname">Hogyan működik?</span>
            <span className="tf-rowsub">Források, megfigyelések és feldolgozás</span>
          </span>
          <span className="tf-rowbadge" aria-hidden="true">›</span>
        </button>
        <button type="button" className="glass tf-rowg tf-c-gold" onClick={() => navigate('/mezo/karakter/konzilium')}>
          <Icon3D name="t-council" size={40} />
          <span className="tf-rowtxt">
            <span className="tf-rowname">A csapat beszélgetései</span>
            <span className="tf-rowsub">Korábbi tanácskozások és döntések</span>
          </span>
          <span className="tf-rowbadge" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  )
}
