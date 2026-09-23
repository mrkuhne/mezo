import { useMemo, useState } from 'react'
import {
  useCharacterFeed, useExperiments, useObservations, usePatternMonitor, usePatterns, usePredictions,
} from '@/data/hooks'
import type { TeamCharacterId } from '@/features/insights/logic/team'
import { buildTeamFeed, withSessionAfterlife, type FeedPost } from '@/features/insights/logic/teamFeed'
import { FeedPostCard } from '@/features/insights/components/feed/FeedPostCard'
import { FeedPosterCard } from '@/features/insights/components/feed/FeedPosterCard'
import { FeedReplySheet, type FeedReplyTarget } from '@/features/insights/components/feed/FeedReplySheet'
import type { FeedReplyMode } from '@/features/insights/components/feed/FeedTrio'
import { StoryStrip } from '@/features/insights/components/feed/StoryStrip'
import { useFeedSession } from '@/features/insights/components/feed/useFeedSession'
import { localDateString } from '@/shared/lib/dates'
import { Icon3D } from '@/shared/ui/clay'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import '@/features/insights/boop-world.css'

/**
 * A csapat-üzenőfal (spec 2026-09-23, mezo-a9bo7.8) — a Mezo-világ főoldala. A MÁR LÉTEZŐ
 * rekordokat (minták, kísérletek, előrejelzések, észrevételek, karakter-feed) mutatja az öt
 * karakter posztjaiként; semmit nem fogalmaz (ADR 0049). Ritmus: fejléc → story-sáv → „Rád vár”
 * sáv → napok (naponta egy üveg-poszter, a többi csendes lapos panel) → „Ennyi történt”.
 */
export function TeamFeedPage() {
  const patterns = usePatterns()
  const monitor = usePatternMonitor()
  const predictions = usePredictions()
  const experiments = useExperiments()
  const observations = useObservations()
  const characterFeed = useCharacterFeed(60)
  const session = useFeedSession()
  const [reply, setReply] = useState<FeedReplyTarget | null>(null)
  const today = localDateString()

  // Betöltés-kapu AZ ÜRES-ÁLLAPOT ELŐTT (mezo-yew): félkész adatból nem villan fel „csend van”.
  const loading = patterns.isPending || monitor.isPending || predictions.isPending
    || experiments.isPending || observations.isPending || characterFeed.isLoading

  const feed = useMemo(() => buildTeamFeed({
    patterns: patterns.patterns,
    monitorPairs: monitor.monitor?.pairs ?? [],
    predictions: predictions.predictions,
    experiments: experiments.experiments,
    observations: observations.observations,
    characterItems: characterFeed.items,
    today,
  }), [patterns.patterns, monitor.monitor, predictions.predictions, experiments.experiments,
    observations.observations, characterFeed.items, today])
  const days = useMemo(() => withSessionAfterlife(feed.days, session.afterlife, today), [feed.days, session.afterlife, today])

  if (loading) return <ScreenSkeleton />

  const posts = days.flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts])
  const waitingBy: Partial<Record<TeamCharacterId, boolean>> = {}
  for (const p of posts) if (p.waiting) waitingBy[p.author] = true
  const waitingCount = posts.filter(p => p.waiting).length
  const degraded = patterns.degraded || observations.degraded
  const openReply = (post: FeedPost, mode: FeedReplyMode) => setReply({ post, mode })
  const toFirstWaiting = () =>
    document.querySelector('[data-waiting]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="tf-page">
      <header className="tf-head">
        <small>A te kis csapatod</small>
        <h1>Üzenőfal</h1>
      </header>
      <StoryStrip today={today} fresh={feed.freshByCharacter} waiting={waitingBy} />
      {waitingCount > 0 && (
        <button type="button" className="glass tf-strip tf-c-lav" onClick={toFirstWaiting}>
          <Icon3D name="t-chat" size={24} />
          <span className="tf-strip-text">
            {waitingCount === 1 ? 'Egy beszélgetésben vár rád a csapat.' : `${waitingCount} beszélgetésben várnak rád.`}
          </span>
          <em className="tf-strip-count">Megnézem</em>
        </button>
      )}
      {degraded && (
        <p className="tf-note" role="status">
          A csapat egy része most nem elérhető — amit látsz, az a legutóbbi állapot. Amint újra bekapcsol, a hiányzó bejegyzések is visszatérnek.
        </p>
      )}
      {days.length === 0 ? (
        <p className="tf-note">Még csend van a falon. Ahogy naplózol, a csapat itt szólal meg — minden bejegyzés a te adataidból születik.</p>
      ) : (
        days.map(day => (
          <section key={day.key} className="tf-daysec" aria-label={day.label}>
            <div className="tf-day"><span>{day.label}</span></div>
            {day.poster && <FeedPosterCard post={day.poster} onReply={openReply} />}
            {day.posts.map(post => <FeedPostCard key={post.id} post={post} onReply={openReply} />)}
          </section>
        ))
      )}
      {days.length > 0 && (
        <>
          <div className="tf-day"><span>Ennyi történt</span></div>
          <p className="tf-note tf-end">A folyamatban lévő ügyeket közben tovább figyeljük.</p>
        </>
      )}
      <FeedReplySheet target={reply} onClose={() => setReply(null)} />
    </div>
  )
}
