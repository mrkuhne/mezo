import type { SimilarDay } from '@/data/types'
import { cn } from '@/shared/lib/cn'

function ageDays(date: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000))
}

/**
 * Találati kártya (mezo-d20.5.7) — a prototípus .daycard + .mring arca: egyezés-gyűrű
 * (conic, % a közepén) + memoir-kivonat + a pontszám-matek chipsora (egyezés × frissesség
 * = végső). A frissesség kliens-oldalon számolt (finalScore / similarity — pontosan a
 * szerver decay-szorzója); ≥0.9 → zsálya, alatta borostyán. Kattintás/Enter/Szóköz: Napló.
 */
export function SimilarDayCard({ day, rank, onPick }: { day: SimilarDay; rank: number; onPick: (date: string) => void }) {
  const freshness = day.similarity === 0 ? 0 : day.finalScore / day.similarity
  const pct = Math.round(day.similarity * 100)
  return (
    <div
      className="mem-daycard np-press rise" role="button" tabIndex={0}
      style={{ '--d': `${rank * 60}ms`, cursor: 'pointer' } as React.CSSProperties}
      onClick={() => onPick(day.date)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(day.date) } }}
    >
      <div className="mem-layrow">
        <span
          className="mem-ring" role="img" aria-label={`egyezés ${pct}%`}
          style={{ '--v': pct } as React.CSSProperties} data-l={`${pct}%`}
        />
        <div className="mem-laygrow">
          <div className="mem-dl">{day.date} · {ageDays(day.date)} napja</div>
          <p className="mem-bd">{day.excerpt}</p>
        </div>
      </div>
      <div className="mem-scmath">
        <span>egyezés {day.similarity.toFixed(2)}</span>
        <span aria-hidden="true">×</span>
        <span className={cn(freshness < 0.9 && 'is-amber')}>frissesség {freshness.toFixed(2)}</span>
        <span aria-hidden="true">=</span>
        <span className={cn('is-final', freshness < 0.9 && 'is-amber')}>végső {day.finalScore.toFixed(2)}</span>
      </div>
    </div>
  )
}
