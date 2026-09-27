import { Icon3D } from '@/shared/ui/clay'
import { highlight } from '@/features/insights/logic/hubSearch'
import { CLEAR_SEARCH, noHits } from '@/features/insights/logic/hubCopy'

/** S6 (mezo-d6ivw.6): the query's hits inside a title, as `<mark>` — the prototype's `hl()`
 *  without innerHTML (accent- and case-insensitive, original characters kept). */
export function Highlight({ text, query }: { text: string; query: string }) {
  return <>{highlight(text, query).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>
}

/** The Tudástár's flat search field (prototype `search()`); the ✕ clears it. */
export function HubSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className={`th-search rise${value ? ' has' : ''}`}>
      <Icon3D name="t-lens" size={22} />
      <input type="text" value={value} placeholder={placeholder} aria-label={placeholder}
        autoComplete="off" spellCheck={false} enterKeyHint="search" onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" className="x" aria-label={CLEAR_SEARCH} onClick={() => onChange('')}>✕</button>}
    </label>
  )
}

/** The dashed "no hits" state under a search (prototype `none()`), with a clear link. */
export function NoHits({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="th-empty">
      <Icon3D name="t-lens" size={22} />
      {noHits(query)} <button type="button" className="th-link" onClick={onClear}>{CLEAR_SEARCH}</button>
    </div>
  )
}
