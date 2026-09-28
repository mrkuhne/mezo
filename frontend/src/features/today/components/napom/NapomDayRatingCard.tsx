// A napom · „Te: X/10" (Check-in 2.0, mezo-ck2, spec §3.10; prototype elo/nap.html `napom()`,
// owner OK 2026-09-27). The evening check-in's last question („Milyen volt a napod
// összességében?") next to the app's day score: two flat halves in one gold glass — „AZ APP
// SZERINT" and „SZERINTED" — each with its band word. When the two bands differ, one line says so.
// A day not yet scored (today, before the dawn close) shows the app half honestly empty.
import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { ratingBand, scoreRatingBand } from '@/features/today/logic/checkinItems'

export function NapomDayRatingCard({ rating, score, i }: { rating: number; score: number | null; i: number }) {
  const mine = ratingBand(rating)
  const app = score != null ? scoreRatingBand(score) : null
  return (
    <section className="napom-dayc glass rise" style={{ '--c': 'var(--dv-amber)', '--i': i } as CSSProperties}
      aria-label="A nap értékelése">
      <div className="napom-duo">
        <div>
          <small>AZ APP SZERINT</small>
          <b>{score ?? '–'}<small>/100</small></b>
          <em>{app ? `${app} nap` : 'hajnalban zárom'}</em>
        </div>
        <div className="is-me">
          <small>SZERINTED</small>
          <b>{rating}<small>/10</small></b>
          <em>{mine} nap</em>
        </div>
      </div>
      {app && app !== mine && (
        <div className="napom-gapl">
          <Icon3D name="t-day" size={22} />
          <span>Az app szerint {app} nap, szerinted {mine} volt.</span>
        </div>
      )}
    </section>
  )
}
