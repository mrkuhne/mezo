// ============================================================
// Mezo · RunningPage (Futás) — Mozaik 2.0 re-face (mezo-d20.11), üveg re-dress
// (mezo-me75u.4, prototype docs/design_2.0/prototypes/src/uveg-edzes-body.html
// `futas()`): glass back pill (+ the Tervek-only lit sky `＋ Új terv` pill) → the
// frameless sky halo hero (t-run, `Hét cur/weeks`) → three flat stat cells → the
// flat segmented control (active segment filled sky) → the segment.
//
// Ranking (bible §3.4): the block card, the prescribed session cards, the
// cross-load note, the HR-recovery card and the logged-run rows are sky `.glass`
// (the planned block lavender); chips/segments/week cells inside them flat; the
// archived blocks flat rows; every empty state dashed (`.uv-empty`).
// With no active block the big number is `—`, never a fabricated `0/0`.
//
// The stag-run FUTÁS type tag on session rows/cards is unchanged, as is every
// data hook and mutation.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useRunning } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { RunningBlockResponse, RunSessionLogResponse, RunSessionLogRequest, RunPrescribedSession } from '@/data/train/runningApi'
import { newDraft } from '@/data/train/runningDraft'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import { RunWeekStrip } from '@/features/train/components/RunWeekStrip'
import { RunSessionCard, type RunCtaState } from '@/features/train/components/RunSessionCard'
import { RunCrossLoadCard } from '@/features/train/components/RunCrossLoadCard'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { todayIdx, dateForDayOfWeek } from '@/data/train/runningAgenda'

const SKY = { '--c': 'var(--dv-sky)' } as CSSProperties

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

/** The dashed empty state (bible §3 rank 4): no glass, no glow. */
function UvEmpty({ art, message }: { art: Icon3DName; message: string }) {
  return (
    <div className="uvs-ghost uv-empty rise" style={SKY}>
      <Icon3D name={art} size={56} />
      <p className="uv-voice">{message}</p>
    </div>
  )
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

  // Hero + stat strip: `Hét cur/weeks` over the active block, and the three live
  // cells beneath it. With NO active block the big number is `—` (never a
  // fabricated 0/0) and the strip switches to the library's own honest counts.
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
    <MozaikPage tone="sky" className="uvs-page uvs-futas">
      <PageHead glass onBack={() => navigate('/train')} label="Edzés">
        {/* `＋ Új terv` lives on the Tervek (blocks) segment — a lit sky pill */}
        {view === 'blocks' && (
          <button type="button" onClick={createBlock} className="mz-pgact uvs-act" style={SKY}>
            ＋ Új terv
          </button>
        )}
      </PageHead>
      {/* One-shot entrance choreography, re-armed on a segment switch. */}
      <EntranceGroup replayKey={view}>
        <PageHero
          art="t-run"
          accent="var(--dv-sky)"
          name="Futás"
          big={activeRunningBlock
            ? <>{activeRunningBlock.currentWeek}<small>/{activeRunningBlock.weeks}</small></>
            : '—'}
          sub={activeRunningBlock ? `hét a blokkból · ${activeRunningBlock.title}` : undefined}
        />
        <PageBody>
          <div className="mz-statstrip uvs-strip rise" style={{ '--d': '30ms' } as CSSProperties}>
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

          {/* View switcher — the flat segmented control, active segment filled sky. */}
          <div className="segtabs uvs-seg rise" data-kalauz-anchor="futas-tabs" style={{ '--d': '60ms', ...SKY } as CSSProperties}>
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

// === E heti edzés: the active block card + this week's prescribed sessions ===
function RunWeekView({ block, sessions: logs, pending, onLog }: {
  block: RunningBlockResponse | null
  sessions: RunSessionLogResponse[]
  pending: boolean
  onLog: (body: RunSessionLogRequest, opts?: { onSuccess?: (r?: RunSessionLogResponse) => void; onSettled?: () => void }) => void
}) {
  const [logCtx, setLogCtx] = useState<RunLogCtx | null>(null)
  const { showLevelUp } = useLevelUp()

  // Real-mode initial load: a neutral placeholder until the query resolves, so the
  // no-active-block empty state doesn't flash before data lands. Mock mode is
  // synchronous (pending === false) so this never triggers there.
  if (pending) return <UvEmpty art="t-clock" message="Betöltés…" />

  if (!block) return <UvEmpty art="t-run" message="Nincs aktív futóterved — a Tervek fülön aktiválj egyet." />

  const week = block.structure.weeks.find((w) => w.weekNumber === block.currentWeek)
  const prescribed = week?.sessions ?? []
  const today = todayIdx()
  const isDone = (key: string) => logs.some((l) => l.blockId === block.id && l.weekNumber === block.currentWeek && l.sessionKey === key)
  const ctaStateFor = (s: RunPrescribedSession): RunCtaState =>
    isDone(s.key) ? 'done' : s.dayOfWeek === today ? 'today' : s.dayOfWeek < today ? 'past' : 'future'

  return (
    <div className="uvs-sec">
      {/* Block card — goal eyebrow, the block's name, the phase label and the week
          strip. The `Hét cur/weeks` numeral lives in the PAGE hero, stated once. */}
      <article className="uvs-blk glass rise" style={{ '--d': '90ms', ...SKY } as CSSProperties}>
        <span className="uv-eyebrow uv-tint">{block.goal || 'Intervallum-blokk'}</span>
        <strong>{block.title}</strong>
        {week?.phaseLabel && <small>{week.phaseLabel}</small>}
        <RunWeekStrip weeks={block.weeks} currentWeek={block.currentWeek} />
      </article>

      {/* This week's sessions */}
      {week ? (
        <>
          <div className="uvs-sechead rise" style={{ '--d': '120ms' } as CSSProperties}>
            <span className="uv-eyebrow">E hét · {prescribed.length} edzés</span>
          </div>
          <div className="uvs-list">
            {prescribed.map((s, i) => {
              const cta = ctaStateFor(s)
              const loggable = cta === 'today' || cta === 'past'
              return (
                <div key={s.key} className="rise" style={{ '--d': `${150 + i * 45}ms`, '--i': i + 1 } as CSSProperties}>
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
            className="uvs-sec rise"
            style={{ '--d': `${150 + prescribed.length * 45}ms` } as CSSProperties}
          >
            <RunCrossLoadCard />
          </div>
        </>
      ) : (
        <UvEmpty art="t-calendar" message={`Az aktuális hét (${block.currentWeek}) nincs a tervben.`} />
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

// === Napló: logged run sessions, newest first ===
function RunLogView({ sessions }: { sessions: RunSessionLogResponse[] }) {
  if (sessions.length === 0) return <UvEmpty art="t-journal" message="Még nincs logolt futás." />
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="uvs-sec">
      <div className="rise" style={{ '--d': '30ms' } as CSSProperties}>
        <RunHrTrend logs={ordered} />
      </div>
      <div className="uvs-sechead rise" style={{ '--d': '60ms' } as CSSProperties}>
        <span className="uv-eyebrow">Utolsó {ordered.length} futás</span>
      </div>
      <div className="uvs-list">
        {ordered.map((s, i) => (
          <div key={s.id} className="rise" style={{ '--d': `${90 + i * 45}ms`, '--i': i } as CSSProperties}>
            <RunLogCard session={s} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Pulzus-megnyugvás (HR-recovery) trend — lower mp = better recovery, so a
// non-positive delta reads as improvement, a rise reads as amber (never red — a
// slower recovery isn't a failure state). `logs` is newest-first. A sky glass
// card: the delta big, the line glowing sky, each point's value + date flat below.
const HR_W = 300
const HR_H = 100
function RunHrTrend({ logs }: { logs: RunSessionLogResponse[] }) {
  const withHr = logs.filter((l) => l.hrRecoverySec != null).slice(0, 6).reverse()
  if (withHr.length < 2) return null
  const vals = withHr.map((l) => l.hrRecoverySec!)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = Math.max(1, hi - lo)
  const pts = vals.map((v, i) => [
    10 + (i * (HR_W - 20)) / (vals.length - 1),
    HR_H - 12 - ((v - lo) / span) * (HR_H - 24),
  ] as const)
  const delta = vals[vals.length - 1] - vals[0]
  return (
    <article className="uvs-hrc glass" style={SKY}>
      <div className="uvs-chead">
        <Icon3D name="t-heart" size={40} />
        <span className="uv-eyebrow uv-tint">Pulzus-megnyugvás · utolsó {withHr.length} futás</span>
      </div>
      <div className={delta <= 0 ? 'uvs-hr-delta is-better' : 'uvs-hr-delta is-worse'}>
        <b>{delta <= 0 ? '' : '+'}{delta} mp</b>
      </div>
      <svg className="uvs-hr-line" viewBox={`0 0 ${HR_W} ${HR_H}`} aria-hidden="true">
        <path d={`M${pts.map((p) => p.join(' ')).join(' L')}`} />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3.5} className={i === pts.length - 1 ? 'is-last' : undefined} />
        ))}
      </svg>
      {/* one label per point, spread edge to edge so each sits under its dot */}
      <div className="uvs-hr-cols">
        {withHr.map((l) => (
          <div key={l.id}>
            <b>{l.hrRecoverySec}</b>
            <small>{huMonthDay(l.date)}</small>
          </div>
        ))}
      </div>
      <p className="uvs-fnote">mp a nyugalmi pulzusig — alacsonyabb = jobb regeneráció</p>
    </article>
  )
}

function RunLogCard({ session }: { session: RunSessionLogResponse }) {
  return (
    <article className="uvs-rsc glass" style={SKY}>
      <div className="uvs-tagl">
        <span className="stag stag-run">FUTÁS</span>
        <em>{huMonthDayDow(session.date)}</em>
        <strong>{sessionKeyLabel(session.sessionKey)}</strong>
      </div>
      {(session.rpeActual != null || session.completedRounds != null || session.hrRecoverySec != null) && (
        <div className="uvs-chips">
          {session.rpeActual != null && <span className="uvs-chip">RPE {session.rpeActual}</span>}
          {session.completedRounds != null && <span className="uvs-chip">{session.completedRounds} kör</span>}
          {session.hrRecoverySec != null && (
            <span className="uvs-chip"><Icon3D name="t-heart" size={16} />{session.hrRecoverySec}mp pulzus</span>
          )}
        </div>
      )}
      {session.notes && <p className="uvs-rsc-note">{session.notes}</p>}
    </article>
  )
}

// === Tervek: Aktív / Tervezett / Archív sections (read-only library) ===
function RunBlocksView({ blocks, onOpen }: { blocks: RunningBlockResponse[]; onOpen: (id: string) => void }) {
  const active = blocks.filter((b) => b.status === 'active')
  const planned = blocks.filter((b) => b.status === 'planned')
  const archived = blocks.filter((b) => b.status === 'archived')

  if (blocks.length === 0) return <UvEmpty art="t-calendar" message="Még nincs futóterved — itt fognak élni a blokkjaid." />

  // One running stagger index across the three status sections, so the whole
  // library reads as a single entrance rather than three restarts.
  let d = 30
  const nextD = () => { const v = d; d += 45; return v }
  const sections: { label: string; list: RunningBlockResponse[]; render: (b: RunningBlockResponse) => React.ReactNode }[] = [
    { label: 'Aktív', list: active, render: (b) => <RunActiveBlockCard block={b} onOpen={onOpen} /> },
    { label: 'Tervezett', list: planned, render: (b) => <RunCompactBlockCard block={b} onOpen={onOpen} /> },
    { label: 'Archív', list: archived, render: (b) => <RunCompactBlockCard block={b} onOpen={onOpen} /> },
  ]
  return (
    <>
      {sections.map((sec) => (
        <div key={sec.label} className="uvs-sec">
          <div className="uvs-sechead rise" style={{ '--d': `${nextD()}ms` } as CSSProperties}>
            <span className="uv-eyebrow">{sec.label} · {sec.list.length}</span>
          </div>
          <div className="uvs-list">
            {sec.list.map((b, i) => (
              <div key={b.id} className="rise" style={{ '--d': `${nextD()}ms`, '--i': i } as CSSProperties}>
                {sec.render(b)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function RunStatusChip({ status }: { status: RunningBlockResponse['status'] }) {
  return <span className={`uvs-status is-${status}`}>{STATUS_LABELS[status]}</span>
}

/** Enter/Space open a role=button card — kept from the pre-üveg cards. */
const openOnKey = (open: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
}

function RunActiveBlockCard({ block, onOpen }: { block: RunningBlockResponse; onOpen: (id: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(block.id)}
      onKeyDown={openOnKey(() => onOpen(block.id))}
      className="uvs-plan glass"
      style={SKY}
    >
      <div className="uvs-plan-top">
        <div className="uvs-plan-copy">
          {block.goal && <span className="uv-eyebrow uv-tint">{block.goal}</span>}
          <strong>{block.title}</strong>
          <small>{huMonthDay(block.startDate)} – {huMonthDay(block.endDate)} · {block.weeks} hét</small>
        </div>
        <RunStatusChip status="active" />
      </div>
      <RunWeekStrip weeks={block.weeks} currentWeek={block.currentWeek} />
      <div className="uvs-plan-foot">
        <span className="uv-eyebrow">Hét {block.currentWeek} / {block.weeks}</span>
        <span className="uvs-plan-go">Builder ›</span>
      </div>
    </div>
  )
}

function RunCompactBlockCard({ block, onOpen }: { block: RunningBlockResponse; onOpen: (id: string) => void }) {
  const isArchived = block.status === 'archived'
  // Archived = a flat row (history, not a live object); planned = a lavender glass card.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(block.id)}
      onKeyDown={openOnKey(() => onOpen(block.id))}
      className={isArchived ? 'uvs-arch uv-flat' : 'uvs-plan is-compact glass'}
      style={isArchived ? undefined : ({ '--c': 'var(--dv-lav)' } as CSSProperties)}
    >
      <div className="uvs-plan-top">
        {isArchived && <Icon3D name="t-history" size={30} />}
        <div className="uvs-plan-copy">
          <strong>{block.title}</strong>
          <small>{huMonthDay(block.startDate)} – {huMonthDay(block.endDate)} · {block.weeks} hét</small>
        </div>
        <RunStatusChip status={block.status} />
      </div>
      {isArchived && block.summary && <p className="uvs-arch-sum">{block.summary}</p>}
    </div>
  )
}
