// ============================================================
// Mezo · RunningPage (Futás) — Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `futas()`,
// args `het` · `naplo` · `tervek` · `nincs` · `het-nincs` · `naplo-ures` · `tervek-ures` · `tolt`).
//
// Hero: the block's weeks as tubes (RunWeekStrip — a past week holds what was logged, the
// current one is ringed, the rest wait under the waterline) under the verdict „A N hetes
// blokk M. hetében jársz.", three facts, and ONE button: the first session of the week that
// can be logged („Naplózd · …" / „Pótold · …"), or „＋ Új terv" on the Tervek view. With no
// active block the hero says so and shows the library's own honest counts.
// Then the three views behind the segmented control:
//   E heti edzés — 1 the prescribed sessions (RunSessionCard: row + interval tube + tags),
//                  2 the cross-load note;
//   Napló        — 1 the heart-rate-recovery trend as a liquid surface, 2 the logged runs;
//   Tervek       — Aktív / Tervezett / Archív, one card of rows each (a row opens the editor).
//
// Every data hook and mutation is unchanged.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useRunning } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { RunningBlockResponse, RunSessionLogResponse, RunPrescribedSession, RunSegment } from '@/data/train/runningApi'
import { newDraft } from '@/data/train/runningDraft'
import {
  Area, Big, Btn, Bub, Caps, Card, EmptyTank, Facts, FrameBack, Hero, Note, Page, Row, Section, Seg, Skel, St,
  type SegItem,
} from '@/shared/ui/folyadek'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import { RunWeekStrip } from '@/features/train/components/RunWeekStrip'
import { RunSessionCard, type RunCtaState } from '@/features/train/components/RunSessionCard'
import { RunCrossLoadCard } from '@/features/train/components/RunCrossLoadCard'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { todayIdx, dateForDayOfWeek } from '@/data/train/runningAgenda'

type RunLogCtx = {
  blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean
  defaultRounds?: number; date: string; segments: RunSegment[]
}

type RunSubView = 'week' | 'log' | 'blocks'

const SUB_VIEWS: SegItem<RunSubView>[] = [
  { key: 'week', label: 'E heti edzés' },
  { key: 'log', label: 'Napló' },
  { key: 'blocks', label: 'Tervek' },
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

/** „A 8 hetes" / „Az 5 hetes": the article follows the spoken number (egy, öt, ezer start with a vowel). */
const article = (n: number) => (n === 1 || n === 5 || String(n).startsWith('5') || (n >= 1000 && n < 2000) ? 'Az' : 'A')

export function RunningPage() {
  const { runningBlocks, activeRunningBlock, runSessions, runningPending, saveRunningBlock, logRunSession } = useRunning()
  // Sticky so returning from the builder (＋ Új terv) lands back on the segment
  // the user left from (e.g. Tervek), not the default — see useStickyTab.
  const [view, setView] = useStickyTab<RunSubView>('train.futas.view', 'week')
  const navigate = useNavigate()
  const [logCtx, setLogCtx] = useState<RunLogCtx | null>(null)
  const { showLevelUp } = useLevelUp()

  const openBuilder = (id: string) => navigate(`/train/futas/${id}`)
  const createBlock = () => {
    const start = new Date().toISOString().slice(0, 10)
    const end = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10)
    saveRunningBlock(null, newDraft(start, end), { onSuccess: (b) => openBuilder(b.id) })
  }

  const back = <FrameBack history fallback="/train" className="es-back">‹ Edzés</FrameBack>

  // Real-mode initial load: the page's own shape as quiet blocks until the query resolves, so
  // the no-active-block state doesn't flash before data lands. Mock mode is synchronous
  // (pending === false) so this never triggers there.
  if (runningPending) {
    return <Page className="es-page es-futas">{back}<Skel blocks={[300, 60, 300]} /></Page>
  }

  const block = activeRunningBlock
  const activeWeek = block?.structure.weeks.find((w) => w.weekNumber === block.currentWeek)
  const prescribed = activeWeek?.sessions ?? []
  const isDone = (key: string, weekNumber = block?.currentWeek) =>
    runSessions.some((l) => l.blockId === block?.id && l.weekNumber === weekNumber && l.sessionKey === key)
  const doneThisWeek = prescribed.filter((s) => isDone(s.key)).length
  const today = todayIdx()
  const ctaStateFor = (s: RunPrescribedSession): RunCtaState =>
    isDone(s.key) ? 'done' : s.dayOfWeek === today ? 'today' : s.dayOfWeek < today ? 'past' : 'future'
  const openLog = (s: RunPrescribedSession) => {
    if (!block) return
    setLogCtx({
      blockId: block.id,
      weekNumber: block.currentWeek,
      sessionKey: s.key,
      label: s.label,
      isSprint: s.kind === 'sprint',
      // Sprint carries an explicit round count; pyramid has none (it's a
      // ladder), so the honest default is its prescribed segment count.
      defaultRounds: s.rounds ?? s.segments.filter((seg) => seg.type === 'work').length,
      date: dateForDayOfWeek(s.dayOfWeek),
      segments: s.segments,
    })
  }

  // The hero's one button: today's session first, else the earliest one still to make up.
  const loggable = prescribed.find((s) => ctaStateFor(s) === 'today') ?? prescribed.find((s) => ctaStateFor(s) === 'past')
  const newPlan = <Btn onClick={createBlock}>＋ Új terv</Btn>
  const heroActions = view === 'blocks'
    ? newPlan
    : loggable
      ? <Btn onClick={() => openLog(loggable)}>{ctaStateFor(loggable) === 'today' ? 'Naplózd' : 'Pótold'} · {loggable.label}</Btn>
      : undefined

  // Per week: what the plan prescribes and what the log holds — the hero's tubes.
  const plannedByWeek = block ? Array.from({ length: block.weeks }, (_, i) =>
    block.structure.weeks.find((w) => w.weekNumber === i + 1)?.sessions.length ?? 0) : []
  const doneByWeek = block ? Array.from({ length: block.weeks }, (_, i) => {
    const sessions = block.structure.weeks.find((w) => w.weekNumber === i + 1)?.sessions ?? []
    return sessions.filter((s) => isDone(s.key, i + 1)).length
  }) : []

  return (
    <Page className="es-page es-futas">
      {back}
      {block ? (
        <Hero
          label={[block.goal || 'Intervallum-blokk', activeWeek?.phaseLabel].filter(Boolean).join(' · ')}
          verdict={`${article(block.weeks)} ${block.weeks} hetes blokk ${block.currentWeek}. hetében jársz.`}
          sub={`${block.title} · e héten ${doneThisWeek} / ${prescribed.length} edzés kész.`}
          actions={heroActions}
        >
          <RunWeekStrip weeks={block.weeks} currentWeek={block.currentWeek} done={doneByWeek} planned={plannedByWeek} />
          <Facts items={[
            [`${doneThisWeek}/${prescribed.length}`, 'e heti edzés'],
            [`${prescribed.length}×`, '/ hét'],
            [`${block.weeks} hét`, 'blokk'],
          ]} />
        </Hero>
      ) : (
        // No active block: never a fabricated 0/0 — the library's own honest counts instead.
        <Hero
          label="Futás"
          verdict="Nincs aktív futóterved."
          sub="A Tervek fülön aktiválj egyet."
          left={<Bub icon="t-run" size={60} />}
          actions={view === 'blocks' ? newPlan : undefined}
        >
          <Facts items={[
            [0, 'aktív terv'],
            [runningBlocks.filter((b) => b.status === 'planned').length, 'tervezett'],
            [runSessions.length, 'logolt futás'],
          ]} />
        </Hero>
      )}

      <Seg items={SUB_VIEWS} value={view} onChange={setView} data-kalauz-anchor="futas-tabs" />

      {view === 'week' && (
        <RunWeekView block={block} week={activeWeek != null} prescribed={prescribed} ctaStateFor={ctaStateFor} onLog={openLog} />
      )}
      {view === 'log' && <RunLogView sessions={runSessions} />}
      {view === 'blocks' && <RunBlocksView blocks={runningBlocks} onOpen={openBuilder} />}

      {logCtx && (
        <RunLogSheet
          ctx={logCtx}
          date={logCtx.date}
          onClose={() => setLogCtx(null)}
          onSave={(body, done) => logRunSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
    </Page>
  )
}

// === E heti edzés: this week's prescribed sessions + the cross-load note ===
function RunWeekView({ block, week, prescribed, ctaStateFor, onLog }: {
  block: RunningBlockResponse | null
  /** The current week exists in the block's structure. */
  week: boolean
  prescribed: RunPrescribedSession[]
  ctaStateFor: (s: RunPrescribedSession) => RunCtaState
  onLog: (s: RunPrescribedSession) => void
}) {
  if (!block) {
    return (
      <>
        <Section n={1} title="E heti edzés" />
        <Card><EmptyTank icon="t-run">Nincs aktív futóterved — a Tervek fülön aktiválj egyet.</EmptyTank></Card>
      </>
    )
  }
  if (!week) {
    return (
      <>
        <Section n={1} title="E heti edzés" />
        <Card><EmptyTank icon="t-calendar">Az aktuális hét ({block.currentWeek}) nincs a tervben.</EmptyTank></Card>
      </>
    )
  }
  return (
    <>
      <Section n={1} title={`E hét · ${prescribed.length} edzés`} />
      <Card className="es-logs">
        {prescribed.map((s) => {
          const cta = ctaStateFor(s)
          return (
            <RunSessionCard key={s.key} session={s} ctaState={cta}
              onLog={cta === 'today' || cta === 'past' ? () => onLog(s) : undefined} />
          )
        })}
        <Note>A cső szintje az iram: magas a sprint, alacsony a séta, a két vége a bemelegítés és a levezetés.</Note>
      </Card>
      {/* Derived cross-load → gym leg volume (static in Phase 2) */}
      <Section n={2} title="Keresztterhelés · futás és láb" />
      <RunCrossLoadCard />
    </>
  )
}

// === Napló: the heart-rate-recovery trend + the logged run sessions, newest first ===
function RunLogView({ sessions }: { sessions: RunSessionLogResponse[] }) {
  if (sessions.length === 0) {
    return (
      <>
        <Section n={1} title="Napló" />
        <Card><EmptyTank icon="t-journal">Még nincs logolt futás.</EmptyTank></Card>
      </>
    )
  }
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  // Pulzus-megnyugvás (HR-recovery) trend — lower mp = better recovery. Needs two points.
  const withHr = ordered.filter((l) => l.hrRecoverySec != null).slice(0, 6).reverse()
  const trend = withHr.length >= 2
  return (
    <>
      {trend && (
        <>
          <Section n={1} title={`Pulzus-megnyugvás · utolsó ${withHr.length} futás`} />
          <RunHrTrend logs={withHr} />
        </>
      )}
      <Section n={trend ? 2 : 1} title={`Utolsó ${ordered.length} futás`} />
      <Card className="es-runs">
        {ordered.map((s) => <RunLogRow key={s.id} session={s} />)}
      </Card>
    </>
  )
}

// The trend as a liquid surface (in the cool sleep/pulse blue, not the Edzés orange): the big
// number is the change since the first of the shown runs, the ink point is the latest one.
// `logs` is oldest-first, every one carries a value.
function RunHrTrend({ logs }: { logs: RunSessionLogResponse[] }) {
  const vals = logs.map((l) => l.hrRecoverySec!)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const delta = vals[vals.length - 1] - vals[0]
  return (
    <Card className={delta <= 0 ? 'es-hr is-better' : 'es-hr is-worse'}>
      <Big value={delta === 0 ? '0' : `${delta < 0 ? '−' : '+'}${Math.abs(delta)}`} unit="mp az első óta" />
      <Area
        values={vals} height={120} labels={logs.map((l) => huMonthDay(l.date))}
        color="#19C7C0" color2="#1877F2" min={lo - Math.max(8, (hi - lo) / 2)} max={hi + 4}
        marks={[{ i: vals.length - 1, label: `${vals[vals.length - 1]} mp`, kind: 'now' }]}
      />
      <Note>mp a nyugalmi pulzusig — alacsonyabb = jobb regeneráció</Note>
    </Card>
  )
}

function RunLogRow({ session }: { session: RunSessionLogResponse }) {
  const facts = [
    huMonthDayDow(session.date),
    session.rpeActual != null ? `RPE ${session.rpeActual}` : null,
    session.completedRounds != null ? `${session.completedRounds} kör` : null,
  ].filter(Boolean).join(' · ')
  return (
    <Row
      icon="t-run"
      title={<>{sessionKeyLabel(session.sessionKey)} <St>Futás</St></>}
      sub={<>{facts}{session.notes && <span className="es-q">{session.notes}</span>}</>}
      value={session.hrRecoverySec != null ? <>{session.hrRecoverySec} <small>mp pulzus</small></> : undefined}
    />
  )
}

// === Tervek: Aktív / Tervezett / Archív sections (read-only library; a row opens the editor) ===
function RunBlocksView({ blocks, onOpen }: { blocks: RunningBlockResponse[]; onOpen: (id: string) => void }) {
  if (blocks.length === 0) {
    return (
      <>
        <Section n={1} title="Tervek" />
        <Card><EmptyTank icon="t-calendar">Még nincs futóterved — itt fognak élni a blokkjaid.</EmptyTank></Card>
      </>
    )
  }
  const sections: { status: RunningBlockResponse['status']; label: string }[] = [
    { status: 'active', label: 'Aktív' },
    { status: 'planned', label: 'Tervezett' },
    { status: 'archived', label: 'Archív' },
  ]
  return (
    <>
      {sections.map((sec, i) => {
        const list = blocks.filter((b) => b.status === sec.status)
        return (
          <RunBlockSection key={sec.status} n={i + 1} title={`${sec.label} · ${list.length}`} list={list} onOpen={onOpen} />
        )
      })}
    </>
  )
}

function RunBlockSection({ n, title, list, onOpen }: {
  n: number; title: string; list: RunningBlockResponse[]; onOpen: (id: string) => void
}) {
  return (
    <>
      <Section n={n} title={title} />
      {list.length > 0 && (
        <Card className="es-plans">
          {list.map((b) => <RunBlockRow key={b.id} block={b} onOpen={onOpen} />)}
        </Card>
      )}
    </>
  )
}

function RunBlockRow({ block, onOpen }: { block: RunningBlockResponse; onOpen: (id: string) => void }) {
  const span = `${huMonthDay(block.startDate)} – ${huMonthDay(block.endDate)} · ${block.weeks} hét`
  const pill = <St tone={block.status === 'active' ? 'ok' : 'q'}>{STATUS_LABELS[block.status]}</St>
  if (block.status === 'active') {
    return (
      <Row
        icon="t-run"
        title={<>{block.title} {pill}</>}
        sub={[block.goal, span, `Hét ${block.currentWeek} / ${block.weeks}`].filter(Boolean).join(' · ')}
        more={<Caps n={block.weeks} done={block.currentWeek - 1} cur={block.currentWeek - 1} size="wide" className="es-rowbar" />}
        onClick={() => onOpen(block.id)}
      />
    )
  }
  const archived = block.status === 'archived'
  return (
    <Row
      icon={archived ? 't-history' : 't-calendar'}
      title={<>{block.title} {pill}</>}
      sub={<>{span}{archived && block.summary && <span className="es-q">{block.summary}</span>}</>}
      onClick={() => onOpen(block.id)}
    />
  )
}
