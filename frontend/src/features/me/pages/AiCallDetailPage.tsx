import { Link, useParams } from 'react-router-dom'
import { useLlmCall } from '@/data/hooks'
import { AiCallUsage } from '@/features/me/components/AiCallUsage'
import { AiPayloadBlock } from '@/features/me/components/AiPayloadBlock'
import { AiPriceSnapshot } from '@/features/me/components/AiPriceSnapshot'
import {
  callKindLabel, formatDateTime, formatLatency, statusLabel, statusTone,
} from '@/features/me/logic/llmCallFormat'
import { GhostState } from '@/shared/ui/GhostState'

// One audited call in full (mezo-uakh) — the debug view. A separate page rather than a sheet:
// each payload column can hold 64 000 characters, and a call is worth deep-linking to.

const TONE_COLOR: Record<'ok' | 'error' | 'cancelled', string> = {
  ok: 'var(--sage-deep)',
  error: 'var(--error-deep)',
  cancelled: 'var(--warning-deep)',
}

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
  const tone = statusTone(data.status)

  return (
    <div className="col gap-md" style={{ padding: '14px 12px 24px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <Link to="/me/ai-usage" aria-label="Vissza" style={{ fontSize: 19, color: 'var(--text-tertiary)' }}>‹</Link>
        <h1 style={{ fontSize: 16.5, fontWeight: 800, flex: 1, margin: 0 }}>Hívás részletei</h1>
      </div>

      <div className="card" style={{ padding: '13px 14px' }}>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 5, padding: '2px 6px', background: 'var(--surface-2)' }}>
            {/* Nullish, not truthy: toolRounds: 0 is a KNOWN value (tools were available, the model
                invoked none) — distinct from null (no tool round ever tallied). Same distinction the
                grid's own "Tool-körök" cell below and AiCallRow.tsx already make (mezo-58ig). */}
            {callKindLabel(data.callKind)}{data.toolRounds != null ? ` ×${data.toolRounds}` : ''}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, color: TONE_COLOR[tone] }}>{statusLabel(data.status)}</span>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '7px 0 2px' }}>
          {data.feature}{data.operation ? ` · ${data.operation}` : ''}
        </h2>
        <div className="text-tertiary" style={{ fontSize: 11 }}>
          {/* The raw ISO instant is wire data, not UI text — the same Europe/Budapest zone the
              list row's clock uses, but with the date, since a detail page is deep-linkable. */}
          {formatDateTime(data.createdAt)}{data.entityKind ? ` · ${data.entityKind}` : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden', marginTop: 11 }}>
          <Cell label="Kért modell" value={data.requestedModel} />
          <Cell label="Kiszolgált" value={data.servedModel ?? '—'} />
          <Cell label="Válaszidő" value={formatLatency(data.latencyMs)} />
          <Cell label="Tool-körök" value={data.toolRounds != null ? String(data.toolRounds) : '—'} />
          {/* A cron/stream call has no security context on its thread — say so, don't leave it blank. */}
          <Cell label="Hívó" value={data.createdBy ? 'te' : 'háttérfolyamat'} />
          <Cell label="Szolgáltatási szint" value={data.serviceTier ?? '—'} />
        </div>

        {/* WHY it failed — the same strip the list row that led here shows. An ERROR row has no
            tokens and no payload, so without this the whole page said "HIBA" and nothing else. */}
        {tone === 'error' && (
          <div style={{ marginTop: 8, borderRadius: 8, padding: '6px 9px', fontSize: 10.5, fontWeight: 600, background: 'var(--surface-2)' }}>
            HIBA · {data.errorClass ?? 'ismeretlen'}{data.errorCode ? ` · ${data.errorCode}` : ''}
          </div>
        )}
        {tone === 'cancelled' && (
          <div style={{ marginTop: 8, borderRadius: 8, padding: '6px 9px', fontSize: 10.5, fontWeight: 600, background: 'var(--surface-2)' }}>
            MEGSZAKADT · a kliens lecsatlakozott — a részleges válasz megvan
          </div>
        )}
      </div>

      <AiCallUsage detail={data} />

      {snapshot && <AiPriceSnapshot snapshot={snapshot} />}

      <div className="card" style={{ padding: '4px 13px 14px' }}>
        <AiPayloadBlock label="Rendszerprompt" text={data.systemPrompt} />
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
