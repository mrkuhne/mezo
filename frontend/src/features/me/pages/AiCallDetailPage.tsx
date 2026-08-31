import { useNavigate, useParams } from 'react-router-dom'
import { useLlmCall } from '@/data/hooks'
import { AiCallUsage } from '@/features/me/components/AiCallUsage'
import { AiPayloadBlock } from '@/features/me/components/AiPayloadBlock'
import { AiPriceSnapshot } from '@/features/me/components/AiPriceSnapshot'
import {
  callKindLabel, formatDateTime, formatLatency, statusLabel, statusTone,
} from '@/features/me/logic/llmCallFormat'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

// One audited call in full (mezo-uakh) — the debug view. A separate page rather than a sheet:
// each payload column can hold 64 000 characters, and a call is worth deep-linking to.

const TONE_COLOR: Record<'ok' | 'error' | 'cancelled', string> = {
  ok: 'var(--sage-deep)',
  error: 'var(--error-deep)',
  cancelled: 'var(--warning-deep)',
}

function Cell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    // `wide` spans both columns — an ODD cell count would otherwise leave the grid's own
    // background showing as a phantom half-cell at the end.
    <div style={{ background: 'var(--surface-1)', padding: '8px 10px', ...(wide ? { gridColumn: '1 / -1' } : null) }}>
      <div className="text-tertiary" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export function AiCallDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
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

  const totalTokens = (data.promptTokens ?? 0) + (data.candidatesTokens ?? 0) + (data.thoughtsTokens ?? 0)
  return (
    // F7.4 Mozaik re-face (mezo-d20.8.4.1, en-mely.html): sky shell, hero = feature·operation,
    // stat strip with the three headline numbers, then the existing cards on mz-qcard.
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate('/me/ai-usage')} label="‹ AI-használat" />
      <EntranceGroup>
      <PageBody className="col gap-md">
      <div className="rise" style={{ padding: '2px 2px 0' }}>
        <span className="mz-eyebrow">AI-használat · hívás</span>
        <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.15, margin: '4px 0 0', color: 'var(--text-primary)' }}>
          {data.feature}{data.operation ? ` · ${data.operation}` : ''}
        </h1>
      </div>
      {totalTokens > 0 && (
        <div className="rise" style={{ '--d': '30ms' } as React.CSSProperties}>
          <StatStrip>
            <StatCell value={totalTokens.toLocaleString('hu-HU')} label="token" />
            <StatCell value={data.costUsd != null ? `$${data.costUsd.toFixed(4)}` : '—'} label="költség" />
            <StatCell value={formatLatency(data.latencyMs)} label="válaszidő" />
          </StatStrip>
        </div>
      )}
      <div className="mz-qcard rise" style={{ padding: '13px 14px', marginBottom: 0, '--d': '0ms' } as React.CSSProperties}>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 5, padding: '2px 6px', background: 'var(--surface-2)' }}>
            {/* Nullish, not truthy: toolRounds: 0 is a KNOWN value (tools were available, the model
                invoked none) — distinct from null (no tool round ever tallied). Same distinction the
                grid's own "Tool-körök" cell below and AiCallRow.tsx already make (mezo-58ig). */}
            {callKindLabel(data.callKind)}{data.toolRounds != null ? ` ×${data.toolRounds}` : ''}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, color: TONE_COLOR[tone] }}>{statusLabel(data.status)}</span>
        </div>
        <div className="text-tertiary" style={{ fontSize: 11, marginTop: 6 }}>
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
          {/* mezo-8z79: az utolsó generálás lezárási oka. Ez különbözteti meg az ÜRES választ
              („MAX_TOKENS" — a gondolkodás elvitte a kimeneti keretet) attól, hogy a modell
              magától fejezte be („STOP"). Egy üres válaszmezőnél ez az egyetlen támpont. */}
          <Cell label="Lezárás oka" value={data.finishReason ?? '—'} wide />
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

      <div className="rise" style={{ '--d': '50ms' } as React.CSSProperties}>
        <AiCallUsage detail={data} />
      </div>

      {snapshot && (
        <div className="rise" style={{ '--d': '90ms' } as React.CSSProperties}>
          <AiPriceSnapshot snapshot={snapshot} />
        </div>
      )}

      <div className="mz-qcard rise" style={{ padding: '4px 13px 14px', marginBottom: 0, '--d': '130ms' } as React.CSSProperties}>
        <AiPayloadBlock label="Rendszerprompt" text={data.systemPrompt} />
        <AiPayloadBlock label="User üzenet" text={data.userMessage} />
        <AiPayloadBlock label="Válasz" text={data.responseText} />
        {data.truncated && !data.payloadScrubbedAt && (
          <p style={{ fontSize: 10, fontWeight: 700, marginTop: 8, color: 'var(--error-deep)' }}>
            A payload csonkolva lett — az eredeti mérete {data.payloadBytes} bájt.
          </p>
        )}
        {data.payloadScrubbedAt && (
          <p className="text-tertiary" style={{ fontSize: 10, fontWeight: 700, marginTop: 8 }}>
            A prompt/válasz szövegét a retention törölte — {formatDateTime(data.payloadScrubbedAt)}.
            A költség- és token-adatok megmaradtak.
          </p>
        )}
      </div>
      </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
