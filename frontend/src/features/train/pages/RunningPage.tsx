// ============================================================
// Mezo · RunningPage (Futás) — Mozaik 2.0 re-face (mezo-d20.11).
// Source of truth: docs/design_2.0/prototypes/src/edzes-body.html #page-futas
// (p-sky tone, ×1.18): page-head (‹ Edzés + the Tervek-only `＋ Új terv`
// pgact) → compact hero (page name, i-futas clay spot + `Hét cur/weeks`) →
// the live stat strip → three segments (E heti edzés · Napló · Tervek).
//
// The old face — an `Edzés · Futás` eyebrow + an `Intervallum` h1, with the
// week number and stat row repeated INSIDE the week view's block card — is
// gone: the number is now stated exactly once, in the page hero. The block
// card keeps what only it can say (goal eyebrow, phase label, week strip).
// With no active block the big number is `—`, never a fabricated `0/0`.
//
// Napiv --tag-run/--wash-run sky vocabulary and the stag-run FUTÁS type tag on
// session rows/cards are unchanged, as is every data hook and mutation.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useRunning } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { RunningBlockResponse, RunSessionLogResponse, RunSessionLogRequest, RunPrescribedSession } from '@/data/train/runningApi'
import { newDraft } from '@/data/train/runningDraft'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { GhostState } from '@/shared/ui/GhostState'
import { Display } from '@/shared/ui/Display'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import { RunWeekStrip } from '@/features/train/components/RunWeekStrip'
import { RunSessionCard, type RunCtaState } from '@/features/train/components/RunSessionCard'
import { RunCrossLoadCard } from '@/features/train/components/RunCrossLoadCard'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { todayIdx, dateForDayOfWeek } from '@/data/train/runningAgenda'

const RUN = 'var(--tag-run)'

type RunLogCtx = { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number; date: string }

type RunSubView = 'week' | 'log' | 'blocks'

const SUB_VIEWS: { id: RunSubView; label: string }[] = [
  { id: 'week', label: 'E heti edzés' },
  { id: 'log', label: 'Napló' },
  { id: 'blocks', label: 'Tervek' },
]

// sessionKey → display label for the log (the prescribed labels live on the
// block structure; the log only carries the key, so map the common ones).
const SESSION_KEY_LABELS: Record<string, string> = {
  'tue-sprint': 'Sprint',
  'fri-pyramid': 'Piramis',
}
const sessionKeyLabel = (key: string) => SESSION_KEY_LABELS[key] ?? key

const STATUS_LABELS: Record<RunningBlockResponse['status'], string> = {
  active: 'aktív',
  planned: 'tervezett',
  archived: 'archív',
}

export function RunningPage() {
  const { runningBlocks, activeRunningBlock, runSessions, runningPending, saveRunningBlock, logRunSession } = useRunning()
  // Sticky so returning from the builder (＋ Új terv) lands back on the segment
  // the user left from (e.g. Tervek), not the default — see useStickyTab.
  const [view, setView] = useStickyTab<RunSubView>('train.futas.view', 'week')
  const navigate = useNavigate()

  const openBuilder = (id: string) => navigate(`/train/futas/${id}`)
  const createBlock = () => {
    const start = new Date().toISOString().slice(0, 10)
    const end = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10)
    saveRunningBlock(null, newDraft(start, end), { onSuccess: (b) => openBuilder(b.id) })
  }

  // Hero + stat strip (prototype #page-futas): `Hét cur/weeks` over the active
  // block, and the three live cells beneath it. With NO active block the big
  // number is `—` (never a fabricated 0/0) and the strip switches to the
  // library's own honest counts — the prototype's own no-block branch.
  const activeWeek = activeRunningBlock?.structure.weeks.find(
    (w) => w.weekNumber === activeRunningBlock.currentWeek,
  )
  const prescribed = activeWeek?.sessions ?? []
  const doneThisWeek = prescribed.filter((s) =>
    runSessions.some(
      (l) => l.blockId === activeRunningBlock?.id
        && l.weekNumber === activeRunningBlock?.currentWeek
        && l.sessionKey === s.key,
    ),
  ).length

  return (
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate('/train')} label="‹ Edzés">
        {/* `＋ Új terv` chip lives on the Tervek (blocks) segment */}
        {view === 'blocks' && (
          <button type="button" onClick={createBlock} className="mz-pgact">
            ＋ Új terv
          </button>
        )}
      </PageHead>
      {/* One-shot entrance choreography, re-armed on a segment switch. */}
      <EntranceGroup replayKey={view}>
        <div className="mz-page-hero">
          <div className="mz-hero-nm">Futás</div>
          <div className="mz-hero-row">
            <ClayIcon name="i-futas" size={85} />
            <span className="mz-bignum">
              {activeRunningBlock ? `${activeRunningBlock.currentWeek}/${activeRunningBlock.weeks}` : '—'}
            </span>
          </div>
        </div>
        <PageBody>
          <div className="mz-statstrip rise" style={{ '--d': '30ms' } as React.CSSProperties}>
            {activeRunningBlock ? (
              <>
                <StatCell value={`${doneThisWeek}/${prescribed.length}`} label="e heti edzés" />
                <StatCell value={`${prescribed.length}×`} label="/ hét" />
                <StatCell value={`${activeRunningBlock.weeks} hét`} label="blokk" />
              </>
            ) : (
              <>
                <StatCell value={0} label="aktív terv" />
                <StatCell value={runningBlocks.filter((b) => b.status === 'planned').length} label="tervezett" />
                <StatCell value={runSessions.length} label="logolt futás" />
              </>
            )}
          </div>

          {/* View switcher */}
          {/* Same `.segtabs` control Sport uses (mezo-setx.6.5): the selected segment
              speaks PRIMARY, because ADR 0018 D5 keeps the run sky in the data-viz
              band and off buttons. */}
          <div className="segtabs rise" style={{ '--d': '60ms', marginTop: 12 } as React.CSSProperties}>
            {SUB_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
                className="segtab"
              >
                {v.label}
              </button>
            ))}
          </div>

          {view === 'week' && <RunWeekView block={activeRunningBlock} sessions={runSessions} pending={runningPending} onLog={logRunSession} />}
          {view === 'log' && <RunLogView sessions={runSessions} />}
          {view === 'blocks' && <RunBlocksView blocks={runningBlocks} onOpen={openBuilder} />}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}

// === E heti edzés: active block hero + this week's prescribed sessions ===
function RunWeekView({ block, sessions: logs, pending, onLog }: {
  block: RunningBlockResponse | null
  sessions: RunSessionLogResponse[]
  pending: boolean
  onLog: (body: RunSessionLogRequest, opts?: { onSuccess?: (r?: RunSessionLogResponse) => void; onSettled?: () => void }) => void
}) {
  const [logCtx, setLogCtx] = useState<RunLogCtx | null>(null)
  const { showLevelUp } = useLevelUp()

  // Real-mode initial load: neutral skeleton until the query resolves, so the
  // no-active-block ghost doesn't flash before data lands. Mock mode is
  // synchronous (pending === false) so this never triggers there.
  if (pending) {
    return (
      <div style={{ paddingTop: 8 }}>
        <GhostState lines={3} message="Betöltés…" />
      </div>
    )
  }

  if (!block) {
    return (
      <div style={{ paddingTop: 8 }}>
        <GhostState lines={3} message="Nincs aktív futóterved — a Tervek fülön aktiválj egyet." />
      </div>
    )
  }

  const week = block.structure.weeks.find((w) => w.weekNumber === block.currentWeek)
  const prescribed = week?.sessions ?? []
  const today = todayIdx()
  const isDone = (key: string) => logs.some((l) => l.blockId === block.id && l.weekNumber === block.currentWeek && l.sessionKey === key)
  const ctaStateFor = (s: RunPrescribedSession): RunCtaState =>
    isDone(s.key) ? 'done' : s.dayOfWeek === today ? 'today' : s.dayOfWeek < today ? 'past' : 'future'

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Block card — the prototype's `blokk-kártya`: goal eyebrow, phase label
          and the week strip. The `Hét cur/weeks` big number and the stat row it
          used to repeat now live in the PAGE hero + strip (mezo-d20.11), so the
          number is stated once. */}
      <div
        className="card rise"
        style={{
          padding: 18,
          background:
            'linear-gradient(180deg, var(--wash-run) 0%, var(--surface-1) 100%)',
          borderColor: 'color-mix(in srgb, var(--tag-run) 30%, transparent)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 16,
          '--d': '90ms',
        } as React.CSSProperties}
      >
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: RUN }} />
        <span
          style={{
            position: 'absolute',
            right: -50,
            top: -50,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--wash-run), transparent 70%)',
          }}
        />
        <div style={{ position: 'relative' }}>
          <span className="eyebrow" style={{ color: RUN }}>{block.goal || 'Intervallum-blokk'}</span>
          {week?.phaseLabel && (
            <div className="text-secondary" style={{ fontSize: 14, marginTop: 4 }}>{week.phaseLabel}</div>
          )}
          <RunWeekStrip weeks={block.weeks} currentWeek={block.currentWeek} />
        </div>
      </div>

      {/* This week's sessions */}
      {week ? (
        <>
          <div className="rise" style={{ marginBottom: 12, '--d': '120ms' } as React.CSSProperties}>
            <Eyebrow>E hét · {prescribed.length} edzés</Eyebrow>
          </div>
          <div className="col gap-sm">
            {prescribed.map((s, i) => {
              const cta = ctaStateFor(s)
              const loggable = cta === 'today' || cta === 'past'
              return (
                <div key={s.key} className="rise" style={{ '--d': `${150 + i * 45}ms` } as React.CSSProperties}>
                  <RunSessionCard
                    session={s}
                    ctaState={cta}
                    onLog={loggable ? () => setLogCtx({
                      blockId: block.id,
                      weekNumber: block.currentWeek,
                      sessionKey: s.key,
                      label: s.label,
                      isSprint: s.kind === 'sprint',
                      // Sprint carries an explicit round count; pyramid has none (it's a
                      // ladder), so the honest default is its prescribed segment count.
                      defaultRounds: s.rounds ?? s.segments.filter((seg) => seg.type === 'work').length,
                      date: dateForDayOfWeek(s.dayOfWeek),
                    }) : undefined}
                  />
                </div>
              )
            })}
          </div>
          {/* Derived cross-load → gym leg volume (static in Phase 2) */}
          <div
            className="rise"
            style={{ marginTop: 16, '--d': `${150 + prescribed.length * 45}ms` } as React.CSSProperties}
          >
            <RunCrossLoadCard />
          </div>
        </>
      ) : (
        <span className="text-meta-sm text-tertiary">
          Az aktuális hét ({block.currentWeek}) nincs a tervben.
        </span>
      )}

      {logCtx && (
        <RunLogSheet
          ctx={logCtx}
          date={logCtx.date}
          onClose={() => setLogCtx(null)}
          onSave={(body, done) => onLog(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
    </div>
  )
}

// (RunStat retired with the duplicated in-card stat row, mezo-d20.11 — the
//  page-level `.mz-statstrip` + StatCell is the one stat vocabulary now.)

// === Napló: logged run sessions, newest first ===
function RunLogView({ sessions }: { sessions: RunSessionLogResponse[] }) {
  if (sessions.length === 0) {
    return (
      <div style={{ paddingTop: 8 }}>
        <span className="text-meta-sm text-tertiary">
          Még nincs logolt futás.
        </span>
      </div>
    )
  }
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div style={{ paddingTop: 8 }}>
      <div className="rise" style={{ '--d': '30ms' } as React.CSSProperties}>
        <RunHrTrend logs={ordered} />
      </div>
      <div className="rise" style={{ marginBottom: 12, '--d': '60ms' } as React.CSSProperties}>
        <Eyebrow>Utolsó {ordered.length} futás</Eyebrow>
      </div>
      <div className="col gap-sm">
        {ordered.map((s, i) => (
          <div key={s.id} className="rise" style={{ '--d': `${90 + i * 45}ms` } as React.CSSProperties}>
            <RunLogCard session={s} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Pulzus-megnyugvás (HR-recovery) trend — lower mp = better recovery, so a
// non-positive delta reads as improvement (success), a rise reads as amber
// (never red — a slower recovery isn't a failure state). `logs` is newest-first.
function RunHrTrend({ logs }: { logs: RunSessionLogResponse[] }) {
  const withHr = logs.filter((l) => l.hrRecoverySec != null).slice(0, 6).reverse()
  if (withHr.length < 2) return null
  const max = Math.max(...withHr.map((l) => l.hrRecoverySec!))
  const delta = withHr[withHr.length - 1].hrRecoverySec! - withHr[0].hrRecoverySec!
  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow>Pulzus-megnyugvás · utolsó {withHr.length} futás</Eyebrow>
        <span style={{ fontSize: 12, fontWeight: 700, color: delta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
          {delta <= 0 ? '' : '+'}{delta} mp
        </span>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'flex-end', height: 64, marginTop: 12 }}>
        {withHr.map((l) => (
          <div key={l.id} className="col" style={{ alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: RUN }}>{l.hrRecoverySec}</span>
            <div style={{
              width: '100%',
              maxWidth: 22,
              height: `${Math.max(14, Math.round((l.hrRecoverySec! / max) * 100))}%`,
              minHeight: 6,
              borderRadius: 2,
              background: 'linear-gradient(180deg, var(--wash-run), var(--tag-run))',
            }} />
            <span className="text-tertiary" style={{ fontSize: 9, marginTop: 2 }}>{huMonthDay(l.date)}</span>
          </div>
        ))}
      </div>
      <p className="text-tertiary" style={{ fontSize: 11, marginTop: 8 }}>
        mp a nyugalmi pulzusig — alacsonyabb = jobb regeneráció
      </p>
    </div>
  )
}

function RunLogChip({ text }: { text: string }) {
  return (
    <span className="excat-tag" style={{ background: 'var(--wash-run)', color: RUN }}>
      {text}
    </span>
  )
}

function RunLogCard({ session }: { session: RunSessionLogResponse }) {
  const chips: string[] = []
  if (session.rpeActual != null) chips.push(`RPE ${session.rpeActual}`)
  if (session.completedRounds != null) chips.push(`${session.completedRounds} kör`)
  if (session.hrRecoverySec != null) chips.push(`${session.hrRecoverySec}mp pulzus`)

  return (
    <div className="card" style={{ padding: '13px 14px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <span className="stag stag-run">FUTÁS</span>
          <span className="label-mono" style={{ color: 'var(--text-primary)' }}>{huMonthDayDow(session.date)}</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{sessionKeyLabel(session.sessionKey)}</span>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {chips.map((c) => (
            <RunLogChip key={c} text={c} />
          ))}
        </div>
      )}
      {session.notes && (
        <p className="text-secondary" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{session.notes}</p>
      )}
    </div>
  )
}

// === Tervek: Aktív / Tervezett / Archív sections (read-only library) ===
function RunBlocksView({ blocks, onOpen }: { blocks: RunningBlockResponse[]; onOpen: (id: string) => void }) {
  const active = blocks.filter((b) => b.status === 'active')
  const planned = blocks.filter((b) => b.status === 'planned')
  const archived = blocks.filter((b) => b.status === 'archived')

  if (blocks.length === 0) {
    return (
      <div style={{ paddingTop: 8 }}>
        <GhostState lines={2} message="Még nincs futóterved — itt fognak élni a blokkjaid." />
      </div>
    )
  }

  // One running stagger index across the three status sections, so the whole
  // library reads as a single entrance rather than three restarts.
  let d = 30
  const nextD = () => { const v = d; d += 45; return v }
  return (
    <>
      <div style={{ paddingTop: 8 }}>
        <div className="rise" style={{ marginBottom: 12, '--d': `${nextD()}ms` } as React.CSSProperties}>
          <Eyebrow>Aktív · {active.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {active.map((b) => (
            <div key={b.id} className="rise" style={{ '--d': `${nextD()}ms` } as React.CSSProperties}>
              <RunActiveBlockCard block={b} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 4 }}>
        <div className="rise" style={{ marginBottom: 12, '--d': `${nextD()}ms` } as React.CSSProperties}>
          <Eyebrow>Tervezett · {planned.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {planned.map((b) => (
            <div key={b.id} className="rise" style={{ '--d': `${nextD()}ms` } as React.CSSProperties}>
              <RunCompactBlockCard block={b} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 4 }}>
        <div className="rise" style={{ marginBottom: 12, '--d': `${nextD()}ms` } as React.CSSProperties}>
          <Eyebrow>Archív · {archived.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {archived.map((b) => (
            <div key={b.id} className="rise" style={{ '--d': `${nextD()}ms` } as React.CSSProperties}>
              <RunCompactBlockCard block={b} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function RunStatusChip({ status }: { status: RunningBlockResponse['status'] }) {
  const style =
    status === 'active'
      ? { color: RUN, background: 'var(--wash-run)', borderColor: 'color-mix(in srgb, var(--tag-run) 40%, transparent)' }
      : status === 'planned'
        ? { color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }
        : { color: 'var(--text-tertiary)', background: 'var(--surface-2)', borderColor: 'var(--divider)' }
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid',
        ...style,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function RunActiveBlockCard({ block, onOpen }: { block: RunningBlockResponse; onOpen: (id: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(block.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(block.id) } }}
      className="card"
      style={{
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'linear-gradient(180deg, var(--wash-run), var(--surface-1))',
        borderColor: 'color-mix(in srgb, var(--tag-run) 30%, transparent)',
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: RUN }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col">
          {block.goal && <span className="eyebrow" style={{ color: RUN }}>{block.goal}</span>}
          <div style={{ marginTop: 5 }}>
            <Display size="md">{block.title}</Display>
          </div>
          <span className="text-secondary" style={{ fontSize: 14, marginTop: 4 }}>
            {huMonthDay(block.startDate)} – {huMonthDay(block.endDate)} · {block.weeks} hét
          </span>
        </div>
        <RunStatusChip status="active" />
      </div>
      <RunWeekStrip weeks={block.weeks} currentWeek={block.currentWeek} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span className="eyebrow text-tertiary">
          Hét {block.currentWeek} / {block.weeks}
        </span>
        <span className="eyebrow" style={{ color: RUN }}>
          Builder ▸
        </span>
      </div>
    </div>
  )
}

function RunCompactBlockCard({ block, onOpen }: { block: RunningBlockResponse; onOpen: (id: string) => void }) {
  const isArchived = block.status === 'archived'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(block.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(block.id) } }}
      className="card"
      style={{ padding: 14, opacity: isArchived ? 0.7 : 1, cursor: 'pointer' }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="col">
          <span className="label-mono" style={{ color: 'var(--text-primary)' }}>{block.title}</span>
          <span className="eyebrow text-tertiary" style={{ marginTop: 4 }}>
            {huMonthDay(block.startDate)} – {huMonthDay(block.endDate)} · {block.weeks} hét
          </span>
        </div>
        <RunStatusChip status={block.status} />
      </div>
      {isArchived && block.summary && (
        <p className="text-secondary" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{block.summary}</p>
      )}
    </div>
  )
}
