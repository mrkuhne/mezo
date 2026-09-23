import { Link } from 'react-router-dom'
import { useCharacterOverview } from '@/data/hooks'
import { FeedAvatar } from '@/features/insights/components/feed/FeedPostHead'
import { useTeamFeed } from '@/features/insights/components/feed/useTeamFeed'
import { TEAM } from '@/features/insights/logic/team'
import { ROOM_IDS, dimensionsFor, roomCases, roomMaturity } from '@/features/insights/logic/teamRooms'
import { Icon3D } from '@/shared/ui/clay'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import '@/features/insights/boop-world.css'

const WATCH_MAX = 64

function clip(text: string): string {
  const plain = text.replace(/\*\*/g, '')
  return plain.length > WATCH_MAX ? `${plain.slice(0, WATCH_MAX - 1).trimEnd()}…` : plain
}

/**
 * A csapat (spec 2026-09-23 §2.5, mezo-a9bo7.9) — az öt karakter egy-egy üveg-sorban a saját
 * akcentusával: mit figyel most (a szobája első ügye), és mennyire érett a képe rólad. Alatta a
 * Szkeptikus magyarázata (nem posztol, nincs szobája) és a Gépterem-ajtó.
 */
export function TeamPage() {
  const { feed, loading } = useTeamFeed()
  const { overview, isLoading } = useCharacterOverview()
  if (loading || isLoading) return <ScreenSkeleton />

  const dims = overview?.dimensions ?? []
  return (
    <div className="tf-page">
      <header className="tf-head">
        <small>Ők figyelnek rád</small>
        <h1>A csapat</h1>
      </header>
      <div className="tf-rows">
        {ROOM_IDS.map(id => {
          const who = TEAM[id]
          const cases = roomCases(feed.days, id)
          const waiting = cases.filter(c => c.waiting).length
          const maturity = roomMaturity(dimensionsFor(id, dims))
          const sub = cases.length === 0
            ? 'Most csendben figyel — ahogy naplózol, itt jelennek meg az ügyei.'
            : `Most figyeli: ${clip(cases[0].title ?? cases[0].body)}${waiting > 0 ? ` · ${waiting} dolga vár rád` : ''}`
          return (
            <Link key={id} to={`/mezo/csapat/${id}`} className={`glass tf-rowg tf-c-${who.accent}`}>
              <FeedAvatar id={id} />
              <span className="tf-rowtxt">
                <span className="tf-rowname">{who.name} · {who.area}</span>
                <span className="tf-rowsub">{sub}</span>
              </span>
              <em className="tf-rowbadge">{maturity > 0 ? `${maturity}% érett` : 'ismerkedik'}</em>
            </Link>
          )
        })}
      </div>
      <div className="tf-dash">
        <FeedAvatar id="szkeptikus" size={30} />
        <span>
          <strong>A Szkeptikus</strong> nem posztol — a beszélgetésekben kérdez vissza, mielőtt bármi bekerülne rólad. A gépezet a <strong>Gépteremben</strong> él.
        </span>
      </div>
      <div className="tf-rows">
        <Link to="/mezo/karakter/gepterem" className="glass tf-rowg tf-c-slate">
          <Icon3D name="t-gear" size={34} />
          <span className="tf-rowtxt">
            <span className="tf-rowname">Gépterem · Összes funkció</span>
            <span className="tf-rowsub">A motorháztető és a teljes eszköztár</span>
          </span>
          <em className="tf-rowbadge" aria-hidden="true">›</em>
        </Link>
      </div>
    </div>
  )
}
