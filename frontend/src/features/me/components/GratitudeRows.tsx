import { cn } from '@/shared/lib/cn'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import type { BoopDomain } from '@/shared/ui/clay/boop/Boop'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'

interface GratitudeRowsProps {
  rows: string[]
  onRowsChange: (rows: string[]) => void
  lifeArea: string | null
  onLifeAreaChange: (area: string | null) => void
  /** Hard cap on the number of rows the user may add. Default 3 (spec §5.3, "1–3 lines a day"). */
  max?: number
  /** Focus the first row on mount — the sheet wants it, the ritual act must not steal focus. */
  autoFocusFirst?: boolean
  /** Small tertiary line under the chips. Omitted → not rendered. */
  hint?: string
  /** Whose Boop listens in the voice bubble: the journal is Én (`me`), the evening ritual Nap. */
  voiceDomain?: BoopDomain
}

/**
 * The gratitude capture block (W1.3, `mezo-b3pp.3`) — up to `max` lines plus one optional
 * life-area chip, shared by `JournalSheet`'s „Hála" mode and Napzárás act 3's `ReflectionStep`
 * (W1.3b, `mezo-b3pp.25`, spec §5.2's combined writing act).
 *
 * Deliberately **state-free and data-free**: the rows, the chosen life area and the save all
 * belong to the caller, because the two callers save at genuinely different moments (the sheet
 * on „Mentem", the ritual act on „Tovább", fire-and-forget). That also keeps this file out of
 * `@/data/*` — the `frontend_conventions.md` rule for a component reused across features.
 *
 * Each row carries its own shared voice field (mezo-xojq8). `VoiceField` hands the transcript to
 * the callback as it stands when the text ARRIVES, so row `i` appends to the current rows even
 * though recording started renders earlier. (Before mezo-xojq8 one hook served every row through
 * a target ref; before the W1.3 extraction the text landed in the journal's note textarea, which
 * gratitude mode never renders, and vanished.)
 */
export function GratitudeRows({
  rows,
  onRowsChange,
  lifeArea,
  onLifeAreaChange,
  max = 3,
  autoFocusFirst = false,
  hint,
  voiceDomain = 'me',
}: GratitudeRowsProps) {
  const setRow = (i: number, value: string) => {
    const next = [...rows]
    next[i] = value
    onRowsChange(next)
  }

  return (
    <>
      {rows.slice(0, max).map((r, i) => (
        <div key={i} className="card" style={{ padding: 10 }}>
          <VoiceField domain={voiceDomain} size="sm"
            onTranscript={(t) => setRow(i, appendDictation(rows[i] ?? '', t, 280))}>
            <textarea
              value={r}
              onChange={(e) => setRow(i, e.target.value)}
              aria-label={`${i + 1}. hálás gondolat`}
              placeholder={`${i + 1}. dolog, amiért hálás vagy…`}
              maxLength={280}
              autoFocus={autoFocusFirst && i === 0 && rows.length === 1}
              style={{ width: '100%', minHeight: 60, resize: 'none', fontSize: 16, lineHeight: 1.45 }}
            />
          </VoiceField>
        </div>
      ))}

      {rows.length < max && (
        <button
          type="button"
          className="cta-ghost"
          onClick={() => onRowsChange([...rows, ''])}
          style={{ fontSize: 13 }}
        >
          + Még egy
        </button>
      )}

      <div className="row gap-sm" style={{ flexWrap: 'wrap' }} role="group" aria-label="Life area">
        {LIFE_SKILLS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={cn('chip', lifeArea === s.key && 'chip-active')}
            aria-pressed={lifeArea === s.key}
            onClick={() => onLifeAreaChange(lifeArea === s.key ? null : s.key)}
            style={{ fontSize: 12 }}
          >
            <ClayIcon name={s.clayIcon} size={13} className="chip-clay" /> {s.name}
          </button>
        ))}
      </div>

      {hint && <p className="text-tertiary" style={{ fontSize: 11 }}>{hint}</p>}
    </>
  )
}
