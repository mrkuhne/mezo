// ============================================================
// Mezo · RunningView (Futás) — the 6th Train sub-tab, READ-ONLY in R1.
// Thin TrainScreen shell ⇒ this view owns its own .page-header (eyebrow
// `Train · Futás`, title `Intervallum`) and a 3-button view-switcher:
// E heti edzés · Napló · Tervek. Mirrors SportView's DNA (own header, hero
// .card.notch-12 with left accent strip + radial glow + <Display>, ghost
// states) but uses the running accent --info instead of --cat-tendency.
// Ported from the approved mockups futas-app-faithful.html (week landing)
// and futas-blocks-builder.html (Tervek library). No writes, no builder
// navigation, no Mai/cross-load — those are later R-steps.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useRunning } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { RunningBlockResponse, RunSessionLogResponse, RunSessionLogRequest } from '@/lib/runningApi'
import { newDraft } from '@/data/runningDraft'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Icon } from '@/shared/ui/Icon'
import { GhostState } from '@/shared/ui/GhostState'
import { Display } from '@/shared/ui/Display'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import { RunWeekStrip } from '@/features/train/components/RunWeekStrip'
import { RunSessionCard } from '@/features/train/components/RunSessionCard'
import { RunCrossLoadCard } from '@/features/train/components/RunCrossLoadCard'
import { RunLogSheet } from '@/features/train/components/RunLogSheet'

const RUN = 'var(--info)'

type RunLogCtx = { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }

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

export function RunningView() {
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

  return (
    <>
      {/* Header — `＋ Új terv` chip lives on the Tervek (blocks) segment */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Train · Futás</Eyebrow>
          <PageTitle>Intervallum</PageTitle>
        </div>
        {view === 'blocks' && (
          <button type="button" className="chip notch-4" style={{ padding: '8px 10px' }} onClick={createBlock}>
            <Icon name="plus" size={12} /> Új terv
          </button>
        )}
      </div>

      {/* View switcher */}
      <div className="row gap-xs" style={{ padding: '0 24px 12px' }}>
        {SUB_VIEWS.map((v) => {
          const active = view === v.id
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={active}
              onClick={() => setView(v.id)}
              className="flex-1 notch-4"
              style={{
                padding: '10px',
                background: active ? 'color-mix(in srgb, var(--info) 8%, transparent)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'color-mix(in srgb, var(--info) 40%, transparent)' : 'var(--border-subtle)'}`,
                color: active ? RUN : 'var(--text-secondary)',
                fontFamily: 'var(--ff-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>

      {view === 'week' && <RunWeekView block={activeRunningBlock} pending={runningPending} onLog={logRunSession} />}
      {view === 'log' && <RunLogView sessions={runSessions} />}
      {view === 'blocks' && <RunBlocksView blocks={runningBlocks} onOpen={openBuilder} />}
    </>
  )
}

// === E heti edzés: active block hero + this week's prescribed sessions ===
function RunWeekView({ block, pending, onLog }: { block: RunningBlockResponse | null; pending: boolean; onLog: (body: RunSessionLogRequest, opts?: { onSuccess?: (r?: RunSessionLogResponse) => void; onSettled?: () => void }) => void }) {
  const [logCtx, setLogCtx] = useState<RunLogCtx | null>(null)
  const { showLevelUp } = useLevelUp()

  // Real-mode initial load: neutral skeleton until the query resolves, so the
  // no-active-block ghost doesn't flash before data lands. Mock mode is
  // synchronous (pending === false) so this never triggers there.
  if (pending) {
    return (
      <div style={{ padding: '8px 24px 16px' }}>
        <GhostState lines={3} message="Betöltés…" />
      </div>
    )
  }

  if (!block) {
    return (
      <div style={{ padding: '8px 24px 16px' }}>
        <GhostState lines={3} message="Nincs aktív futóterved — a Tervek fülön aktiválj egyet." />
      </div>
    )
  }

  const week = block.structure.weeks.find((w) => w.weekNumber === block.currentWeek)
  const sessions = week?.sessions ?? []

  return (
    <div style={{ padding: '0 24px 16px' }}>
      {/* Hero */}
      <div
        className="card notch-12"
        style={{
          padding: 18,
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--info) 6%, transparent) 0%, var(--surface-1) 100%)',
          borderColor: 'color-mix(in srgb, var(--info) 30%, transparent)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 16,
        }}
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
            background: 'radial-gradient(circle, color-mix(in srgb, var(--info) 12%, transparent), transparent 70%)',
          }}
        />
        <div style={{ position: 'relative' }}>
          <span className="eyebrow" style={{ color: RUN }}>{block.goal || 'Intervallum-blokk'}</span>
          <div style={{ marginTop: 6 }}>
            <Display size="lg">Hét {block.currentWeek} / {block.weeks}</Display>
          </div>
          {week?.phaseLabel && (
            <span className="text-secondary mt-sm" style={{ fontSize: 12 }}>{week.phaseLabel}</span>
          )}

          <RunWeekStrip weeks={block.weeks} currentWeek={block.currentWeek} />

          {/* Stat row */}
          <div
            className="row gap-md mt-lg"
            style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}
          >
            <RunStat val={`${block.weeks}`} unit="hét" label="blokk" />
            <RunStat val={`${sessions.length}`} unit="×/hét" label="edzés" />
            <RunStat val="RPE" label="intervallum cél" />
          </div>
        </div>
      </div>

      {/* This week's sessions */}
      {week ? (
        <>
          <div style={{ marginBottom: 12 }}><Eyebrow>E hét · {sessions.length} edzés</Eyebrow></div>
          <div className="col gap-sm">
            {sessions.map((s) => (
              <RunSessionCard
                key={s.key}
                session={s}
                onLog={() => setLogCtx({
                  blockId: block.id,
                  weekNumber: block.currentWeek,
                  sessionKey: s.key,
                  label: s.label,
                  isSprint: s.kind === 'sprint',
                  defaultRounds: s.rounds ?? undefined,
                })}
              />
            ))}
          </div>
          {/* Derived cross-load → gym leg volume (static in Phase 2) */}
          <div style={{ marginTop: 16 }}>
            <RunCrossLoadCard />
          </div>
        </>
      ) : (
        <span className="text-tertiary" style={{ fontSize: 11, fontStyle: 'italic' }}>
          Az aktuális hét ({block.currentWeek}) nincs a tervben.
        </span>
      )}

      {logCtx && (
        <RunLogSheet
          ctx={logCtx}
          onClose={() => setLogCtx(null)}
          onSave={(body, done) => onLog(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
    </div>
  )
}

// Compact hero stat (mockup .stat): Antonio value + optional mono unit + mono label.
function RunStat({ val, unit, label }: { val: string; unit?: string; label: string }) {
  return (
    <div className="col">
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>
        {val}
        {unit && (
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 2 }}>{unit}</span>
        )}
      </div>
      <span
        style={{
          fontFamily: 'var(--ff-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginTop: 3,
        }}
      >
        {label}
      </span>
    </div>
  )
}

// === Napló: logged run sessions, newest first ===
function RunLogView({ sessions }: { sessions: RunSessionLogResponse[] }) {
  if (sessions.length === 0) {
    return (
      <div style={{ padding: '8px 24px 16px' }}>
        <span className="text-tertiary" style={{ fontSize: 11, fontStyle: 'italic' }}>
          Még nincs logolt futás.
        </span>
      </div>
    )
  }
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div style={{ padding: '8px 24px 16px' }}>
      <div style={{ marginBottom: 12 }}><Eyebrow>Utolsó {ordered.length} futás</Eyebrow></div>
      <div className="col gap-sm">
        {ordered.map((s) => (
          <RunLogCard key={s.id} session={s} />
        ))}
      </div>
    </div>
  )
}

function RunLogChip({ text }: { text: string }) {
  return (
    <span
      className="chip"
      style={{
        fontSize: 9,
        padding: '2px 7px',
        background: 'color-mix(in srgb, var(--info) 8%, transparent)',
        borderColor: 'color-mix(in srgb, var(--info) 35%, transparent)',
        color: RUN,
      }}
    >
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
    <div className="card notch-4" style={{ padding: '13px 14px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <span className="label-mono" style={{ color: 'var(--text-primary)' }}>{huMonthDayDow(session.date)}</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{sessionKeyLabel(session.sessionKey)}</span>
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
        <p className="text-secondary" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{session.notes}</p>
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
      <div style={{ padding: '8px 24px 16px' }}>
        <GhostState lines={2} message="Még nincs futóterved — itt fognak élni a blokkjaid." />
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: '8px 24px 16px' }}>
        <div style={{ marginBottom: 12 }}><Eyebrow>Aktív · {active.length}</Eyebrow></div>
        <div className="col gap-sm">
          {active.map((b) => (
            <RunActiveBlockCard key={b.id} block={b} onOpen={onOpen} />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ marginBottom: 12 }}><Eyebrow>Tervezett · {planned.length}</Eyebrow></div>
        <div className="col gap-sm">
          {planned.map((b) => (
            <RunCompactBlockCard key={b.id} block={b} onOpen={onOpen} />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ marginBottom: 12 }}><Eyebrow>Archív · {archived.length}</Eyebrow></div>
        <div className="col gap-sm">
          {archived.map((b) => (
            <RunCompactBlockCard key={b.id} block={b} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </>
  )
}

function RunStatusChip({ status }: { status: RunningBlockResponse['status'] }) {
  const style =
    status === 'active'
      ? { color: RUN, background: 'color-mix(in srgb, var(--info) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--info) 40%, transparent)' }
      : status === 'planned'
        ? { color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }
        : { color: 'var(--text-tertiary)', background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }
  return (
    <span
      style={{
        fontFamily: 'var(--ff-mono)',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 10,
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
      className="card notch-12"
      style={{
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--info) 6%, transparent), var(--surface-1))',
        borderColor: 'color-mix(in srgb, var(--info) 30%, transparent)',
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: RUN }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col">
          {block.goal && <span className="eyebrow" style={{ color: RUN }}>{block.goal}</span>}
          <div style={{ marginTop: 5 }}>
            <Display size="md">{block.title}</Display>
          </div>
          <span className="text-secondary" style={{ fontSize: 12, marginTop: 4 }}>
            {huMonthDay(block.startDate)} – {huMonthDay(block.endDate)} · {block.weeks} hét
          </span>
        </div>
        <RunStatusChip status="active" />
      </div>
      <RunWeekStrip weeks={block.weeks} currentWeek={block.currentWeek} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span className="text-tertiary" style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Hét {block.currentWeek} / {block.weeks}
        </span>
        <span style={{ color: RUN, fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
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
      className="card notch-4"
      style={{ padding: 14, opacity: isArchived ? 0.7 : 1, cursor: 'pointer' }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="col">
          <span className="label-mono" style={{ color: 'var(--text-primary)' }}>{block.title}</span>
          <span className="text-tertiary" style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
            {huMonthDay(block.startDate)} – {huMonthDay(block.endDate)} · {block.weeks} hét
          </span>
        </div>
        <RunStatusChip status={block.status} />
      </div>
      {isArchived && block.summary && (
        <p className="text-secondary" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{block.summary}</p>
      )}
    </div>
  )
}
