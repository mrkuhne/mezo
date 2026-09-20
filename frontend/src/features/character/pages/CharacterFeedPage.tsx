import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { useCharacterExperts, useCharacterFeed } from '@/data/hooks'
import { CharacterHeader } from '@/features/character/components/CharacterHeader'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { CharacterPostCard } from '@/features/character/components/CharacterPostCard'

export function CharacterFeedPage() {
  const navigate = useNavigate()
  const { items, isLoading, isError, refetch } = useCharacterFeed(60)
  const { experts } = useCharacterExperts()
  const [count, setCount] = useState(12)
  const [filter, setFilter] = useState<'all' | 'observations' | 'outcomes'>('all')
  const visible = items.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'observations' ? item.kind === 'OBSERVATION' : item.kind === 'CONFERENCE_CHANGE'),
  )
  return (
    <div className="kr-hub kr-social">
      <CharacterHeader active="feed" />
      <div className="kr-social-welcome">
        <PersonaOrb expertKey="mezo" size={42} />
        <div>
          <strong>A csapat gondolatai. A te történeted.</strong>
          <p>Olvasd el, szólj hozzá — együtt pontosítjuk, amit rólad tudunk.</p>
        </div>
      </div>
      <div className="kr-feed-tools" aria-label="Bejegyzések szűrése">
        {(
          [
            { value: 'all', text: 'Minden' },
            { value: 'observations', text: 'Megfigyelések' },
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
            <CharacterPostCard
              key={
                item.sourceId
                  ? `${item.sourceType}-${item.sourceId}-${item.sourceIndex}`
                  : `${item.at}-${index}`
              }
              item={item}
              experts={experts}
            />
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
