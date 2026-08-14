import { AiTokenBar } from '@/features/me/components/AiTokenBar'
import { formatBytes, formatCost, formatTokens } from '@/features/me/logic/llmCallFormat'
import type { LlmCallDetailResponse } from '@/data/me/llmUsageApi'

// What one call actually MEASURED (mezo-uakh) — the detail page's usage card. The counters differ
// per call kind, so the card follows the data instead of assuming tokens:
//
// - a GENERATION call reports the four token slices → `AiTokenBar`;
// - an EMBEDDING call reports batch size / vector dimensions / billable characters, and it is
//   those characters (× `embedPerMillionChars`) that produced the cost shown here — the token bar
//   used to claim "the provider reported no token usage" on top of three populated counters;
// - a VISION or TRANSCRIBE call additionally rides the generic media columns (`imageCount` /
//   `imageBytesTotal` / `imageMime`), appended below whichever block applies.
//
// Every check is `!= null`, never truthy (ADR 0014's null-vs-zero rule): 0 billable characters is
// a reported zero, "no counter at all" is unknown. `imageMime` is the one truthy check — it is a
// string, and an empty MIME type is not a fact worth a stat cell.

interface Stat { label: string; value: string }

function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
      {stats.map((s) => (
        <div key={s.label}>
          <div className="text-tertiary" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 800 }}>
            {s.label}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AiCallUsage({ detail }: { detail: LlmCallDetailResponse }) {
  // formatTokens is plain thousands-grouping (with the "—" for null) — it reads counts, not only
  // tokens, so the dimension and character counters use it too.
  const embed: Stat[] = []
  if (detail.embedInputCount != null) embed.push({ label: 'Bemenet', value: `${detail.embedInputCount} db` })
  if (detail.embedDimensions != null) embed.push({ label: 'Dimenzió', value: formatTokens(detail.embedDimensions) })
  if (detail.embedBillableChars != null) embed.push({ label: 'Számlázott karakter', value: formatTokens(detail.embedBillableChars) })

  const media: Stat[] = []
  if (detail.imageCount != null) media.push({ label: 'Média', value: `${detail.imageCount} db` })
  if (detail.imageBytesTotal != null) media.push({ label: 'Méret', value: formatBytes(detail.imageBytesTotal) })
  if (detail.imageMime) media.push({ label: 'Típus', value: detail.imageMime })

  return (
    <div className="card" style={{ padding: '11px 13px 12px' }}>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="eyebrow" style={{ flex: 1 }}>{embed.length > 0 ? 'Beágyazás' : 'Tokenek'}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: detail.costUsd == null ? 'var(--text-tertiary)' : 'var(--sage-deep)' }}>
          {formatCost(detail.costUsd)}
        </span>
      </div>

      {embed.length > 0 ? <StatRow stats={embed} /> : <AiTokenBar detail={detail} />}
      {media.length > 0 && <StatRow stats={media} />}
    </div>
  )
}
