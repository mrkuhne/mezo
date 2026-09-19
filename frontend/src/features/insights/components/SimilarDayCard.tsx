import type { SimilarDay } from '@/data/types'

function ageDays(date: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000))
}

/**
 * Találati kártya (mezo-d20.5.7; a pontszámok eltávolítva mezo-eq85.10 — lásd
 * `task-10-codebase-notes.md` §1: a memória-platform `finalScore`-ja RRF-alapú, nem 0..1
 * arány, a kártya korábbi `similarity`/`finalScore` mezői ezért félrevezetőek lettek volna).
 * A gyűrű most a sorrendi helyet mutatja (1., 2., 3. …), nem egy egyezés-százalékot; a
 * pontszám-matek chipsor törölve. Kattintás/Enter/Szóköz: Napló.
 */
export function SimilarDayCard({ day, rank, onPick }: { day: SimilarDay; rank: number; onPick: (date: string) => void }) {
  const place = day.rank
  return (
    <div
      className="mem-daycard np-press rise" role="button" tabIndex={0}
      style={{ '--d': `${rank * 60}ms`, cursor: 'pointer' } as React.CSSProperties}
      onClick={() => onPick(day.date)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(day.date) } }}
    >
      <div className="mem-layrow">
        <span
          className="mem-ring" role="img" aria-label={`${place}. legjobb találat`}
          style={{ '--v': 100 } as React.CSSProperties} data-l={`${place}.`}
        />
        <div className="mem-laygrow">
          <div className="mem-dl">{day.date} · {ageDays(day.date)} napja</div>
          <p className="mem-bd">{day.excerpt}</p>
        </div>
      </div>
    </div>
  )
}
