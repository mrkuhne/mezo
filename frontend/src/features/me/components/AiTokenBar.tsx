import { formatTokens, tokenSegments } from '@/features/me/logic/llmCallFormat'
import type { LlmCallDetailResponse } from '@/data/me/llmUsageApi'

// The billable token split of one call (mezo-uakh) — the view that shows when THINKING is what
// costs the money (a live probe once measured 188 thinking tokens against 8 answer tokens).
//
// Token note: the brief's `--lav-deep`/`--gold-deep` are not on the sanctioned DS token list
// (grepped frontend/src/styles/prototype.css — `--lav-deep` only survives as a legacy Napív alias,
// due to retire in P9; `--gold-deep` never existed). Substituted `--coral-deep` for the prompt
// segment (the brand accent, since prompt is the base input) and `--warning-deep` for thoughts
// (the amber/gold family — matches the "thinking costs money" framing the brief calls out).
// `--sage-deep` (candidates) and `--text-tertiary` (cached) were already correct DS tokens and are
// kept as-is. The four resolve to visually distinct hues in both themes: rust-orange, green,
// amber-gold, warm gray.
const SEGMENT_COLOR: Record<string, string> = {
  prompt: 'var(--coral-deep)',
  candidates: 'var(--sage-deep)',
  thoughts: 'var(--warning-deep)',
  cached: 'var(--text-tertiary)',
}

export function AiTokenBar({ detail }: { detail: LlmCallDetailResponse }) {
  const segments = tokenSegments(detail)
  if (segments.length === 0) {
    return (
      <p className="text-tertiary" style={{ fontSize: 11 }}>
        A szolgáltató nem jelentett token-használatot ehhez a híváshoz.
      </p>
    )
  }

  return (
    <div>
      <div className="row" style={{ height: 9, borderRadius: 5, overflow: 'hidden', margin: '7px 0 8px' }}>
        {segments.map((s) => (
          <div key={s.key} style={{ width: `${s.percent}%`, background: SEGMENT_COLOR[s.key] }} />
        ))}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 9, fontSize: 10.5 }}>
        {segments.map((s) => (
          <span key={s.key} className="row" style={{ alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: SEGMENT_COLOR[s.key] }} />
            {s.label} {formatTokens(s.value)}
          </span>
        ))}
      </div>
    </div>
  )
}
