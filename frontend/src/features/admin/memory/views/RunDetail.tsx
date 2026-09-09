import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AdminMemoryCandidate, AdminMemoryFusionConfig, AdminMemoryRunDetailResponse } from '@/data/admin/adminMemoryApi'
import { decompose, runVerdictSentence } from '@/features/admin/memory/contribution'
import { InspectorRow, InspectorSection, sourceLink } from '@/features/admin/memory/MemoryInspector'
import type { ViewKey } from '@/features/admin/memory/MemorySegmentBar'

// Futások · run detail (mezo-4qyt.3): retriever-trace strip, one expandable row per candidate
// with the stacked contribution bar (contribution.ts), and "Amit az LLM látott". Reused
// verbatim by ReplayBox to render a dry-run result — the DRY-RUN badge and mode caveat are
// derived from `detail.dryRun` itself (server-authoritative), never from client state, per the
// Step 3.6 trap ("must be unconditional on a replay result").

export interface InspectorBody { title: string; content: ReactNode }

const RETRIEVER_COLORS: Record<string, string> = {
  dense: '#4E8FB8',
  lexical: '#C9962E',
  graph: '#D8481F',
  facts: '#5D4FA0',
}
const BOOST_COLOR = '#6E8B5E'
const FALLBACK_COLOR = '#8B7E6E'

const PROMPT_TRACE_REASON: Record<string, string> = {
  SHADOW_RUN: 'Ehhez a futáshoz nincs prompt-lenyomat: árnyékfutás sosem ért el a modellig.',
  NO_PROMPT_IMPRINT: 'Ehhez a futáshoz nem találtunk prompt-lenyomatot (a kirenderelt blokkot nem tároljuk).',
  DRY_RUN: 'Próbafutás — nem ment modellhez, így nincs prompt-lenyomata.',
}

const NOTE_LABEL: Record<string, string> = {
  reranker_skipped: 'újrarangsorolás kihagyva',
  rewrite_skipped: 'újraírás kihagyva',
  rewrite_unreachable_no_history: 'újraírás nem elérhető — nincs korábbi beszélgetés',
  projection_embed_extra_call: 'a térkép-elhelyezéshez egy extra beágyazás készült',
  pca_unavailable: 'a térkép-elhelyezés nem sikerült',
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id
}

export function RunDetail({
  detail,
  onGo,
  onInspect,
}: {
  detail: AdminMemoryRunDetailResponse
  onGo: (view: ViewKey, sel: string | null) => void
  onInspect: (body: InspectorBody | null) => void
}) {
  const { run, candidates, fusion, promptTrace, promptTraceReason, dryRun, replayNotes } = detail
  const [openId, setOpenId] = useState<string | null>(candidates[0]?.candidateRefId ?? null)

  // The run's own lead line (mezo-k5zy Task 3, Rulings) — the plain-Hungarian verdict for the
  // TOP result the run actually surfaced (selected, lowest rank), so a reader gets "why this run
  // worked" without opening a single candidate. Falls back to the first candidate when the run
  // selected none (every candidate got dropped downstream).
  const topCandidate = [...candidates].filter((c) => c.selected).sort((a, b) => a.rank - b.rank)[0] ?? candidates[0]
  const topVerdict = topCandidate ? runVerdictSentence(topCandidate.scoreBreakdown, fusion.retrieverWeights, fusion.rrfK) : null

  useEffect(() => {
    const c = candidates.find((x) => x.candidateRefId === openId)
    if (!c) { onInspect(null); return }
    onInspect({ title: 'Jelölt részletei', content: <CandidateInspectorBody candidate={c} /> })
    // onInspect is a setState wrapper from the parent — stable across renders, not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, candidates])

  return (
    <div>
      {dryRun && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="am-dryrun">DRY-RUN</span>
            <span className="ad-mut" style={{ fontSize: 10.5 }}>
              — nem ír <code style={{ fontFamily: 'ui-monospace,monospace' }}>memory_retrieval_*</code> sort
            </span>
          </div>
          <div className="am-caveat" style={{ marginBottom: 10 }}>
            Azt mutatja, mit adna a NEW mód — nem azt, amit a kísérő ténylegesen kiszolgált.
          </div>
        </>
      )}
      {replayNotes.length > 0 && (
        <div className="am-notes" style={{ marginBottom: 10 }}>
          {replayNotes.map((n) => (
            <span key={n} className="am-note-chip">{NOTE_LABEL[n] ?? n}</span>
          ))}
        </div>
      )}

      {topVerdict && (
        <p className="am-verdict-lead">A legjobb találatot {topVerdict} találta meg a rendszer.</p>
      )}

      {run.retrieverTrace.length > 0 && (
        <div className="am-trace">
          {run.retrieverTrace.map((t) => (
            <span key={t.retriever} className={`chip${t.error ? ' err' : ''}`}>
              <span className="dot" /><b>{t.retriever}</b>
              <span className="n">{t.durationMs} ms · {t.candidateCount} db{t.error ? ` · ${t.error}` : ''}</span>
            </span>
          ))}
        </div>
      )}

      {candidates.map((c, i) => (
        <CandidateRow
          key={c.candidateRefId}
          candidate={c}
          index={i + 1}
          fusion={fusion}
          errorCode={run.errorCode}
          open={openId === c.candidateRefId}
          onToggle={(open) => setOpenId(open ? c.candidateRefId : null)}
          onGo={onGo}
        />
      ))}

      <div className="ad-tile sp12" style={{ marginTop: 13 }}>
        <div className="ad-eyebrow">Amit az LLM látott</div>
        {promptTrace ? (
          <div className="am-prompt" style={{ marginTop: 8 }}>
            {promptTrace.map((p, i) => (
              <div className="p" key={`${p.kind}-${p.refId}-${i}`}>
                <div className="rk">{p.label}</div>
                {p.gist ?? ''}
              </div>
            ))}
          </div>
        ) : (
          <p className="am-empty" style={{ marginTop: 8 }}>
            {PROMPT_TRACE_REASON[promptTraceReason ?? 'NO_PROMPT_IMPRINT']}
          </p>
        )}
      </div>
    </div>
  )
}

function CandidateRow({
  candidate,
  index,
  fusion,
  errorCode,
  open,
  onToggle,
  onGo,
}: {
  candidate: AdminMemoryCandidate
  index: number
  fusion: AdminMemoryFusionConfig
  errorCode?: string | null
  open: boolean
  onToggle: (open: boolean) => void
  onGo: (view: ViewKey, sel: string | null) => void
}) {
  const { segments } = decompose(candidate, fusion)
  const activeTotal = segments.reduce((sum, s) => sum + (s.rank != null || s.kind === 'boost' ? s.value : 0), 0)
  const allAbsent = segments.filter((s) => s.kind === 'retriever').every((s) => s.rank == null)
  const verdict = runVerdictSentence(candidate.scoreBreakdown, fusion.retrieverWeights, fusion.rrfK)

  return (
    <details
      className="am-cand"
      open={open}
      onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="rk">{index}.</span>
        <span className="am-candhead">
          <span className="tt">{candidate.contentSnapshot}</span>
          <span className="verdict">{verdict}</span>
        </span>
        <span className="fs">{candidate.scoreBreakdown.finalScore.toFixed(3)}</span>
      </summary>
      <div className="inner">
        <div className="am-stack">
          {segments.map((s) => {
            if (s.rank == null && s.kind === 'retriever') {
              return <span key={s.key} className="absent" title={`${s.key} — nincs találat ennél a jelöltnél`}>–</span>
            }
            const pct = activeTotal > 0 ? Math.round((s.value / activeTotal) * 1000) / 10 : 0
            const color = s.kind === 'boost' ? BOOST_COLOR : (RETRIEVER_COLORS[s.key] ?? FALLBACK_COLOR)
            const title = s.kind === 'boost'
              ? `${s.key} · +${s.value.toFixed(2)}`
              : `${s.key} · rank ${s.rank} · ${s.value.toFixed(3)}`
            return <i key={s.key} style={{ width: `${pct}%`, background: color }} title={title} />
          })}
        </div>
        <div className="am-seglegend">
          {segments.map((s) => {
            const absent = s.rank == null && s.kind === 'retriever'
            const color = absent ? 'rgba(43,33,24,.15)' : (s.kind === 'boost' ? BOOST_COLOR : (RETRIEVER_COLORS[s.key] ?? FALLBACK_COLOR))
            const label = s.kind === 'boost'
              ? `${s.key} · +${s.value.toFixed(2)}`
              : absent ? `${s.key} · hiányzik` : `${s.key} · rank ${s.rank} · ${s.value.toFixed(3)}`
            return <span key={s.key}><i style={{ background: color }} />{label}</span>
          })}
        </div>
        <div className="am-candfoot">
          {allAbsent ? (
            <>
              {errorCode && <span className="ad-tag warn">{errorCode}</span>}
              <span className="ad-mut">egyik retriever sem adott találatot ennél a jelöltnél</span>
            </>
          ) : candidate.rerankDelta != null ? (
            <span>
              újrarangsorolt hely: <b>{candidate.rank}</b>{' '}
              <span className={`am-delta${candidate.rerankDelta > 0 ? ' up' : candidate.rerankDelta < 0 ? ' down' : ''}`}>
                Δ {candidate.rerankDelta > 0 ? '+' : ''}{candidate.rerankDelta}
              </span>
            </span>
          ) : (
            <span className="ad-mut">újrarangsorolás nem futott erre a jelöltre</span>
          )}
          <span className={`am-pill ${candidate.selected ? 'in' : 'out'}`}>{candidate.selected ? 'bekerült' : 'kimaradt'}</span>
        </div>
        {(candidate.candidateKind === 'knowledge_edge' || candidate.memoryItemId) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            {candidate.candidateKind === 'knowledge_edge' && (
              <button type="button" className="ad-fk" onClick={() => onGo('graph', candidate.candidateRefId)}>
                Megnyitás a Gráfon →
              </button>
            )}
            {candidate.memoryItemId && (
              <button type="button" className="ad-fk" onClick={() => onGo('map', candidate.memoryItemId ?? null)}>
                Megnyitás a Térképen →
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  )
}

function CandidateInspectorBody({ candidate }: { candidate: AdminMemoryCandidate }) {
  const link = sourceLink(candidate.candidateKind, candidate.memoryItemId ?? candidate.candidateRefId)
  return (
    <>
      <InspectorRow label="candidateKind" value={candidate.candidateKind} />
      {candidate.memoryItemId && <InspectorRow label="memoryItemId" value={<span className="ad-fk">{shortId(candidate.memoryItemId)}</span>} />}
      {candidate.occurredOn && <InspectorRow label="occurredOn" value={candidate.occurredOn} />}
      <InspectorRow label="rank" value={candidate.rank} />
      <InspectorRow label="selected" value={candidate.selected ? 'igen' : 'nem'} />
      <InspectorSection label="Tartalom">{candidate.contentSnapshot}</InspectorSection>
      <InspectorSection label="Forrás">
        {link ? (
          <Link className="ad-fk" to={link}>Megnyitás az adatböngészőben →</Link>
        ) : (
          <span className="ad-mut">{candidate.candidateKind} · {shortId(candidate.candidateRefId)}</span>
        )}
      </InspectorSection>
    </>
  )
}
