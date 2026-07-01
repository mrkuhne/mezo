// ============================================================
// Mezo · ChallengesCarousel — pre-workout L2 decisions. The companion
// proposes low-stakes micro-experiments; the user approves/skips freely.
// Scroll-snap carousel + dot pager (accepted dots get brand-glow).
// Ported from prototype challenges.jsx.
// ============================================================
import { useRef, useState, type UIEvent } from 'react'
import type { Challenge } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { ChallengeCard } from '@/features/train/components/ChallengeCard'

export function ChallengesCarousel({
  challenges,
  accepted,
  onToggle,
}: {
  challenges: Challenge[]
  accepted: Record<string, boolean>
  onToggle: (id: string) => void
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

  // Real mode has no AI challenges until Phase 3 — render nothing instead of an
  // empty rail. Placed after the hook calls so the hook order is render-stable.
  if (challenges.length === 0) return null

  return (
    <div style={{ padding: '16px 0 8px' }}>
      <div
        className="row"
        style={{ padding: '0 24px 12px', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <div className="col">
          <Eyebrow brand>Mai kihívások · proposál</Eyebrow>
          <span
            className="text-tertiary"
            style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--ff-mono)' }}
          >
            {acceptedCount > 0
              ? `${acceptedCount} elfogadva · skip-elhető bármelyik`
              : 'skip-elhető · a try maga a jutalom'}
          </span>
        </div>
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
                  ? 'var(--brand-glow)'
                  : i === activeIdx
                    ? 'var(--brand-primary)'
                    : 'var(--border-strong)',
                transition: 'all 0.25s ease',
                border: 'none',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

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
    </div>
  )
}
