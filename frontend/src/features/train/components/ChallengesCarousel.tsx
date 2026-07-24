// ============================================================
// Mezo · ChallengesCarousel — pre-workout L2 decisions, restyled as the
// "⚔ A mai küldetések" quest section (mission-briefing redesign, mezo-bxpg).
// The companion proposes low-stakes micro-experiments; the user approves/skips
// freely. Three states, in render-priority order: pending (the lazy LLM
// generation is in flight — a visible skeleton closes the old silent-gap bug),
// resolved-empty (honest "no quests today" line), else the quest-card rail
// (scroll-snap + dot pager, accepted dots get the coral glow).
// Ported from prototype challenges.jsx.
// ============================================================
import { useRef, useState, type UIEvent } from 'react'
import type { Challenge } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { SkeletonText } from '@/shared/ui/Skeleton'
import { ChallengeCard } from '@/features/train/components/ChallengeCard'

export function ChallengesCarousel({
  challenges,
  accepted,
  onToggle,
  pending = false,
}: {
  challenges: Challenge[]
  accepted: Record<string, boolean>
  onToggle: (id: string) => void
  pending?: boolean
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const w = e.currentTarget.clientWidth
    const idx = Math.round(e.currentTarget.scrollLeft / w)
    if (idx !== activeIdx) setActiveIdx(idx)
  }

  const scrollTo = (i: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' })
  }

  const acceptedCount = Object.values(accepted).filter(Boolean).length
  const empty = challenges.length === 0
  const showCards = !pending && !empty

  return (
    <div style={{ padding: '16px 0 8px' }}>
      <div
        className="row"
        style={{ padding: '0 24px 12px', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <div className="col">
          <Eyebrow brand>⚔ A mai küldetések · {challenges.length}</Eyebrow>
          {showCards && (
            <span
              className="text-tertiary"
              style={{ fontSize: 11, marginTop: 4 }}
            >
              {acceptedCount > 0
                ? `${acceptedCount} elfogadva · skip-elhető bármelyik`
                : 'skip-elhető · a try maga a jutalom'}
            </span>
          )}
        </div>
        {showCards && (
          <div className="row gap-xs">
            {challenges.map((c, i) => (
              <button
                key={c.id}
                type="button"
                aria-label={`Kihívás ${i + 1}`}
                onClick={() => scrollTo(i)}
                style={{
                  width: i === activeIdx ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: accepted[c.id]
                    ? 'var(--coral)'
                    : i === activeIdx
                      ? 'var(--coral)'
                      : 'var(--border-strong)',
                  transition: 'all 0.25s ease',
                  border: 'none',
                  padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {pending ? (
        <div style={{ padding: '0 24px' }}>
          <div
            className="card"
            style={{ padding: 16, border: '1px solid var(--coral)', background: 'var(--wash-gym)' }}
          >
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              Kihívások generálása…
            </span>
            <div className="mt-sm">
              <SkeletonText lines={2} />
            </div>
          </div>
        </div>
      ) : empty ? (
        <div style={{ padding: '0 24px' }}>
          <span className="text-tertiary" style={{ fontSize: 13 }}>
            Ma nincs kihívás
          </span>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="challenge-track"
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            gap: 0,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {challenges.map((c) => (
            <div
              key={c.id}
              style={{
                flexShrink: 0,
                width: '100%',
                scrollSnapAlign: 'center',
                padding: '0 24px',
              }}
            >
              <ChallengeCard
                challenge={c}
                accepted={!!accepted[c.id]}
                onToggle={() => onToggle(c.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
