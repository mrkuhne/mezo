import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
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
    <div className="kr-hub kr-social">
      <CharacterCouncilStatus />
      {!isLoading && !isError && featured && (
        <CharacterMorningStory item={featured} experts={experts} onOpen={() => {
          setFilter('all')
          setCount(value => Math.max(value, items.indexOf(featured) + 1))
          setOpenStory(value => value + 1)
        }} />
      )}
      <div className="kr-feed-tools" aria-label="Bejegyzések szűrése">
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
        <p className="kr-degraded" role="status">
          A bejegyzések betöltése…
        </p>
      ) : isError ? (
        <div className="kr-degraded" role="alert">
          Nem sikerült betölteni az üzenőfalat.{' '}
          <button type="button" onClick={refetch}>
            Újrapróbálom
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="kr-degraded">Egyelőre nincs friss megfigyelés ebben a nézetben.</p>
      ) : (
        <div className="kr-social-posts">
          {visible.slice(0, count).map((item, index) => (
            <div
              key={
                item.sourceId
                  ? `${item.sourceType}-${item.sourceId}-${item.sourceIndex}`
                  : `${item.at}-${index}`
              }
              ref={item === featured ? storyPost : undefined}
              tabIndex={-1}
              className="kr-story-target"
            >
              <CharacterPostCard item={item} experts={experts} />
            </div>
          ))}
        </div>
      )}
      {visible.length > count && (
        <button className="kr-load-more" type="button" onClick={() => setCount((value) => value + 12)}>
          Korábbi bejegyzések
        </button>
      )}
      <button type="button" className="kr-social-how" onClick={() => navigate('/mezo/karakter/gepterem')}>
        Hogyan működik? <span>Források, megfigyelések és feldolgozás ›</span>
      </button>
      <button type="button" className="kr-social-how" onClick={() => navigate('/mezo/karakter/konzilium')}>
        A csapat beszélgetései <span>Korábbi tanácskozások és döntések ›</span>
      </button>
    </div>
  )
}
