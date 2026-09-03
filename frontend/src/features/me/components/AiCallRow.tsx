import { Link } from 'react-router-dom'
import {
  callKindLabel, formatCost, formatLatency, formatTime, formatTokens, statusTone,
} from '@/features/me/logic/llmCallFormat'
import type { LlmCallListItem } from '@/data/me/llmUsageApi'

// One audit row in the list (mezo-uakh). Two lines: identity on top, the numbers below. A failed
// or cancelled call gets an extra explanatory strip — those rows are the reason the page exists,
// and an empty cost cell alone would read as "free" rather than "never answered".
//
// Token note: the brief's `--danger`/`--brand`/`--gold-deep` do not exist on this surface (grepped
// frontend/src/styles/prototype.css). Substituted `--error-deep` for the error tone and
// `--warning-deep` for the cancelled tone — both already carry that exact semantic split elsewhere
// (insights VerdictFilterChips/PairRow: `few_days` = warning-deep "soft issue", `degenerate` =
// error-deep "hard failure"), which matches error (hard failure) vs. cancelled (soft interruption)
// here. `--sage-deep` for 'ok' was already correct and is kept as-is.
//
// The kind-badge label and the token count (UsageCell) each nest their formatted value in its own
// inner span, rather than a flat `{value}{suffix}` string, because RTL's `getByText` matches a
// node's OWN direct text nodes, not its full recursive textContent — a flat "TOOL" + " ×2" (or
// "11 204" + " tok") joins into one string on the outer span, and the tests' exact
// `getByText('TOOL')` / `getByText('11 204')` cannot find a value-only node. Nesting isolates the
// value's own text node so the exact match resolves.

const TONE_COLOR: Record<'ok' | 'error' | 'cancelled', string> = {
  ok: 'var(--sage-deep)',
  error: 'var(--error-deep)',
  cancelled: 'var(--warning-deep)',
}

/** The usage cell says whatever the call kind actually measured — tokens, images or vectors. */
function UsageCell({ call }: { call: LlmCallListItem }) {
  if (call.embedInputCount != null) {
    return <>{call.embedInputCount} db · {call.embedDimensions ?? '?'} d</>
  }
  if (call.imageCount != null) return <>{call.imageCount} kép</>
  if (call.totalTokens != null) return <><span>{formatTokens(call.totalTokens)}</span> tok</>
  return <>nincs használat</>
}

export function AiCallRow({ call }: { call: LlmCallListItem }) {
  const tone = statusTone(call.status)

  return (
    <Link
      to={`/me/ai-usage/${call.id}`}
      className="aiu-callt"
      style={{ display: 'block', color: 'inherit', '--rc': TONE_COLOR[tone] } as React.CSSProperties}
    >
      <div className="row" style={{ alignItems: 'center', gap: 7 }}>
        <span className="text-tertiary" style={{ fontSize: 10.5, width: 38, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(call.createdAt)}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>
          {call.feature}
          {call.operation && <span className="text-tertiary" style={{ fontWeight: 500, fontSize: 11 }}> · {call.operation}</span>}
        </span>
        <span style={{ fontSize: 8.5, fontWeight: 800, borderRadius: 5, padding: '2px 5px', background: 'var(--surface-2)' }}>
          <span>{callKindLabel(call.callKind)}</span>
          {/* Nullish, not truthy: a TOOL call with 0 rounds executed is a KNOWN zero (the model saw
              tools and chose none), distinct from null (no tool round ever tallied) — same
              null-vs-zero distinction ADR 0014 makes for cost. See GeminiCompanionLlm.usageRecord /
              mezo-58ig. A truthy check would render both as a bare "TOOL" badge. */}
          {call.toolRounds != null ? ` ×${call.toolRounds}` : ''}
        </span>
      </div>

      <div className="row text-tertiary" style={{ alignItems: 'center', gap: 9, marginTop: 6, fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
        <span>{call.servedModel ?? `${call.requestedModel} kért`}</span>
        <span><UsageCell call={call} /></span>
        <span>{formatLatency(call.latencyMs)}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12, color: call.costUsd == null ? 'var(--text-tertiary)' : 'var(--sage-deep)' }}>
          {formatCost(call.costUsd)}
        </span>
      </div>

      {tone === 'error' && (
        <div style={{ marginTop: 6, borderRadius: 8, padding: '5px 8px', fontSize: 10.5, fontWeight: 600, background: 'var(--surface-2)' }}>
          HIBA · {call.errorClass ?? 'ismeretlen'}{call.errorCode ? ` · ${call.errorCode}` : ''}
        </div>
      )}
      {tone === 'cancelled' && (
        <div style={{ marginTop: 6, borderRadius: 8, padding: '5px 8px', fontSize: 10.5, fontWeight: 600, background: 'var(--surface-2)' }}>
          MEGSZAKADT · a kliens lecsatlakozott — a részleges válasz megvan
        </div>
      )}
    </Link>
  )
}
