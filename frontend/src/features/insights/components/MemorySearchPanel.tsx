import { useEffect, useState } from 'react'
import { useSimilarDays } from '@/data/hooks'
import { Icon3D } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { SimilarDayCard } from '@/features/insights/components/SimilarDayCard'

/** Lusta kereső — a query a gombbal (submit) indul, nem gépelésre tüzel (spec §6).
 *  Az arc a prototípus .sfield pill-mezője (mezo-d20.5.7); üvegben (mezo-me75u.8) egy lapos
 *  mező t-lens ikonnal és a világító levendula „Keresés" pirulával. A panel a SAJÁT gyökér-
 *  osztályán (`.eml-search`) öltözik, hogy az Emlékek oldalon és a Memória „Kereső" fülén
 *  ugyanúgy nézzen ki (`── uveg mezo1 emlekek (` blokk). */
export function MemorySearchPanel({ onPick, initialQuery = '', onSearch }: {
  onPick: (date: string) => void
  initialQuery?: string
  onSearch?: (query: string) => void
}) {
  const [draft, setDraft] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  useEffect(() => { setDraft(initialQuery); setSubmitted(initialQuery) }, [initialQuery])
  const { results, degraded, isFetching, failed } = useSimilarDays(submitted)

  return (
    <div className="eml-search col gap-md">
      <form
        className="eml-srch"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(draft.trim()); onSearch?.(draft.trim()) }}
      >
        <Icon3D name="t-lens" size={26} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Milyen napot keresel? (pl. rossz alvás edzés után)"
          aria-label="Hasonló nap keresése"
        />
        <button type="submit" className="eml-srch-go" disabled={draft.trim() === ''}>Keresés</button>
      </form>

      {degraded && (
        <p className="eml-srch-note">A memória-kereső most nem elérhető.</p>
      )}
      {isFetching && <div className="eml-ghost"><GhostState message="Keresés a nap-vektorok között…" lines={2} /></div>}
      {/* Egy elbukott keresés SOSEM az „üres találat" mondatot kapja (mezo-eq85.10): az a user
          történetéről állítana valamit, miközben az igazság az, hogy nem tudtunk megnézni. */}
      {!isFetching && failed && (
        <div className="eml-ghost"><GhostState message="A keresés nem sikerült — a memóriát most nem értük el. Próbáld újra kicsit később." lines={2} /></div>
      )}
      {!isFetching && !failed && results !== null && results.length === 0 && (
        <div className="eml-empty uv-empty"><GhostState message="Nincs elég hasonló nap a memóriában." lines={2} /></div>
      )}
      {!isFetching && results && results.length > 0 && (
        <span className="eml-simh">{results.length} hasonló nap a memóriából</span>
      )}
      {!isFetching && results?.map((day, rank) => (
        <SimilarDayCard key={day.date} day={day} rank={rank} onPick={onPick} />
      ))}
    </div>
  )
}
