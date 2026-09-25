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
      className="eml-simrow np-press rise" role="button" tabIndex={0}
      style={{ '--d': `${rank * 60}ms`, cursor: 'pointer' } as React.CSSProperties}
      onClick={() => onPick(day.date)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(day.date) } }}
    >
      {/* Üveg (mezo-me75u.8): a kicsi, világító uv-ring a sorrendi helyet mutatja (teli gyűrű,
          közepén a hely) — továbbra sem egyezés-százalék. */}
      <span className="eml-simring" role="img" aria-label={`${place}. legjobb találat`}>
        <svg viewBox="0 0 44 44" aria-hidden="true" className="uv-ring">
          <circle className="uv-ring-track" cx="22" cy="22" r="18" />
          <circle className="uv-ring-prog" cx="22" cy="22" r="18" />
        </svg>
        <b aria-hidden="true">{place}.</b>
      </span>
      <div className="eml-simrow-grow">
        <strong className="eml-simrow-dl">{day.date} · {ageDays(day.date)} napja</strong>
        <p className="eml-simrow-bd">{day.excerpt}</p>
      </div>
      <span className="eml-chev" aria-hidden="true">›</span>
    </div>
  )
}
