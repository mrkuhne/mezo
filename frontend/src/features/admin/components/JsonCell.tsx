import { useState } from 'react'

// A jsonb cell (mezo-d5iy.12) — the payload arrives as REAL nested JSON (Task 7 verified this,
// not a quoted string), so this only needs to distinguish object/array from every other cell
// value. Collapsed shows a compact `{…}` / `[n]` preview; expanding renders the pretty-printed
// value in place (no modal — admin-body.html's own `.ad-json` recipe).
export function JsonCell({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false)

  if (value === null || typeof value !== 'object') {
    return <span className="ad-mut">—</span>
  }

  const preview = Array.isArray(value) ? `[${value.length}]` : '{…}'

  return (
    <div className="ad-json-wrap">
      <button type="button" className="ad-json" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="shut">{preview}</span>
      </button>
      {open && <pre className="ad-json-open">{JSON.stringify(value, null, 2)}</pre>}
    </div>
  )
}
