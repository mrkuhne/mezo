import { Link, useParams } from 'react-router-dom'
import { useLlmCall } from '@/data/hooks'
import { AiPayloadBlock } from '@/features/me/components/AiPayloadBlock'
import { AiTokenBar } from '@/features/me/components/AiTokenBar'
import { callKindLabel, formatCost, formatLatency } from '@/features/me/logic/llmCallFormat'
import { GhostState } from '@/shared/ui/GhostState'

// One audited call in full (mezo-uakh) — the debug view. A separate page rather than a sheet:
// each payload column can hold 64 000 characters, and a call is worth deep-linking to.

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-1)', padding: '8px 10px' }}>
      <div className="text-tertiary" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export function AiCallDetailPage() {
  const { id = '' } = useParams()
  const { data, isPending, isError, refetch } = useLlmCall(id)

  if (isError) {
    return <GhostState message="Ez a hívás nem elérhető." ctaLabel="Újra" onCta={refetch} />
  }
  // LLM_CALL_DETAIL_EMPTY.id is '' — while a real-mode fetch is unresolved, useDualQuery returns
  // that honest empty (never the mock seed), so an empty id is the load-in-progress signal.
  if (isPending && !data.id) {
    return <GhostState message="A hívás betöltése…" />
  }

  const snapshot = data.pricingSnapshot

  return (
    <div className="col gap-md" style={{ padding: '14px 12px 24px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <Link to="/me/ai-usage" aria-label="Vissza" style={{ fontSize: 19, color: 'var(--text-tertiary)' }}>‹</Link>
        <h1 style={{ fontSize: 16.5, fontWeight: 800, flex: 1, margin: 0 }}>Hívás részletei</h1>
      </div>

      <div className="card" style={{ padding: '13px 14px' }}>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 5, padding: '2px 6px', background: 'var(--surface-2)' }}>
            {callKindLabel(data.callKind)}{data.toolRounds ? ` ×${data.toolRounds}` : ''}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800 }}>{data.status}</span>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '7px 0 2px' }}>
          {data.feature}{data.operation ? ` · ${data.operation}` : ''}
        </h2>
        <div className="text-tertiary" style={{ fontSize: 11 }}>
          {data.createdAt}{data.entityKind ? ` · ${data.entityKind}` : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden', marginTop: 11 }}>
          <Cell label="Kért modell" value={data.requestedModel} />
          <Cell label="Kiszolgált" value={data.servedModel ?? '—'} />
          <Cell label="Latency" value={formatLatency(data.latencyMs)} />
          <Cell label="Tool-körök" value={data.toolRounds != null ? String(data.toolRounds) : '—'} />
          {/* A cron/stream call has no security context on its thread — say so, don't leave it blank. */}
          <Cell label="Hívó" value={data.createdBy ? 'te' : 'háttérfolyamat'} />
          <Cell label="Service tier" value={data.serviceTier ?? '—'} />
        </div>
      </div>

      <div className="card" style={{ padding: '11px 13px 12px' }}>
        <div className="row" style={{ alignItems: 'baseline' }}>
          <span className="eyebrow" style={{ flex: 1 }}>Tokenek</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sage-deep)' }}>{formatCost(data.costUsd)}</span>
        </div>
        <AiTokenBar detail={data} />
      </div>

      {snapshot && (
        <div className="card" style={{ padding: '9px 11px', fontSize: 10.5 }}>
          {/* pricedOn nested in its own span, like AiCallRow's badge values (see its top comment) — the
              call's own createdAt (rendered elsewhere) starts with the same date, so an isolated text
              node is what lets a test target this exact value rather than colliding with that one. */}
          <b>Befagyasztott ártábla</b> · {snapshot.sourceModel} · <span>{snapshot.pricedOn}</span>
          <div className="text-tertiary" style={{ marginTop: 3 }}>
            input ${snapshot.inputPerMillion} · output ${snapshot.outputPerMillion} · thinking ${snapshot.thinkingPerMillion} · cached ${snapshot.cachedPerMillion} / 1M
          </div>
          <div className="text-tertiary" style={{ marginTop: 3 }}>
            A számlázás nettó prompttal megy — a cache-elt szelet a promptban benne van.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '4px 13px 14px' }}>
        <AiPayloadBlock label="System prompt" text={data.systemPrompt} />
        <AiPayloadBlock label="User üzenet" text={data.userMessage} />
        <AiPayloadBlock label="Válasz" text={data.responseText} />
        {data.truncated && (
          <p style={{ fontSize: 10, fontWeight: 700, marginTop: 8, color: 'var(--error-deep)' }}>
            A payload csonkolva lett — az eredeti mérete {data.payloadBytes} bájt.
          </p>
        )}
      </div>
    </div>
  )
}
