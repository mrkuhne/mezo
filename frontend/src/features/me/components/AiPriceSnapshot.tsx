import type { components } from '@/data/_client/api.gen'

type Snapshot = NonNullable<components['schemas']['LlmPricingSnapshot']>

// The frozen price table one call was billed against (mezo-uakh). Only the rates the snapshot
// ACTUALLY carries are rendered: `gemini-embedding-001` is priced with `embed-per-million-chars`
// alone, so its four generation rates are null — printing them unconditionally emitted four bare
// `$` signs and hid the one rate that produced the cost (that is roughly a third of the log, since
// embed_memory is the highest-volume feature).
//
// `!= null` throughout, never truthy: a rate of 0 is a real, free tier, not an absent rate.

const GENERATION_RATES = [
  { key: 'inputPerMillion', label: 'input' },
  { key: 'outputPerMillion', label: 'output' },
  { key: 'thinkingPerMillion', label: 'thinking' },
  { key: 'cachedPerMillion', label: 'cached' },
] as const satisfies readonly { key: keyof Snapshot; label: string }[]

export function AiPriceSnapshot({ snapshot }: { snapshot: Snapshot }) {
  const generation = GENERATION_RATES
    .map((r) => ({ label: r.label, value: snapshot[r.key] as number | null | undefined }))
    .filter((r) => r.value != null)

  return (
    <div className="card" style={{ padding: '9px 11px', fontSize: 10.5 }}>
      {/* pricedOn nested in its own span, like AiCallRow's badge values (see its top comment) — the
          call's own createdAt (rendered elsewhere) starts with the same date, so an isolated text
          node is what lets a test target this exact value rather than colliding with that one. */}
      <b>Befagyasztott ártábla</b> · {snapshot.sourceModel} · <span>{snapshot.pricedOn}</span>

      {generation.length > 0 && (
        <div className="text-tertiary" style={{ marginTop: 3 }}>
          {generation.map((r) => `${r.label} $${r.value}`).join(' · ')} / 1M token
        </div>
      )}
      {snapshot.embedPerMillionChars != null && (
        <div className="text-tertiary" style={{ marginTop: 3 }}>
          embed ${snapshot.embedPerMillionChars} / 1M karakter
        </div>
      )}

      {/* The net-prompt caveat is about GENERATION billing — an embedding call has no prompt and
          no cache slice, so the sentence would be noise on its detail page. */}
      {generation.length > 0 && (
        <div className="text-tertiary" style={{ marginTop: 3 }}>
          A számlázás nettó prompttal megy — a cache-elt szelet a promptban benne van.
        </div>
      )}
    </div>
  )
}
