import { useState } from 'react'
import { useSimilarDays } from '@/data/hooks'
import { CtaPrimary } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { SimilarDayCard } from '@/features/insights/components/SimilarDayCard'

/** Lusta kereső — a query a gombbal (submit) indul, nem gépelésre tüzel (spec §6).
 *  Az arc a prototípus .sfield pill-mezője (mezo-d20.5.7). */
export function MemorySearchPanel({ onPick }: { onPick: (date: string) => void }) {
  const [draft, setDraft] = useState('')
  const [submitted, setSubmitted] = useState('')
  const { results, degraded, isFetching } = useSimilarDays(submitted)

  return (
    <div className="col gap-md">
      <form
        className="row gap-sm"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(draft.trim()) }}
      >
        <div className="mem-sfield">
          <span aria-hidden="true">⌕</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Milyen napot keresel? (pl. rossz alvás edzés után)"
            aria-label="Hasonló nap keresése"
          />
        </div>
        <CtaPrimary type="submit" disabled={draft.trim() === ''}>Keresés</CtaPrimary>
      </form>

      {degraded && (
        <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center' }}>
          A memória-kereső most nem elérhető.
        </p>
      )}
      {isFetching && <GhostState message="Keresés a nap-vektorok között…" lines={2} />}
      {!isFetching && results !== null && results.length === 0 && (
        <GhostState message="Nincs elég hasonló nap a memóriában." lines={2} />
      )}
      {!isFetching && results && results.length > 0 && (
        <span className="mz-eyebrow">{results.length} hasonló nap a memóriából</span>
      )}
      {!isFetching && results?.map((day, rank) => (
        <SimilarDayCard key={day.date} day={day} rank={rank} onPick={onPick} />
      ))}
    </div>
  )
}
