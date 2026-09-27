// Mock seed for the csapat-chat (Task 12, mezo-a9bo7.24) — mirrored VERBATIM (plain text, HTML
// spans stripped) from the approved prototype, docs/design_2.0/prototypes/uveg-uzenofal.html
// (search `function elo()`, `const DERU`), mapped onto the real backend DTO shapes from
// api.gen.ts. Built from ONE builder (`buildTeamChatDay`) so the day's lines and its
// `openThreads` projection can never drift apart into hand-typed duplicates.
import { localDateString, nowOffsetIso, offsetIso } from '@/shared/lib/dates'
import type {
  TeamChatAction,
  TeamChatAnswerChoice,
  TeamChatDay,
  TeamChatLine,
  TeamChatThread,
} from '@/data/character/teamChatApi'

const SHIFT_SLEEP_ANCHOR: TeamChatAction = { key: 'shift_sleep_anchor', label: 'Horgony −30 perc' }

interface ThreadSeed {
  id: string
  flagKey: string
  ruleLabel: string
  owner: TeamChatThread['owner']
  guest?: string | null
  pushed: boolean
  actions: TeamChatAction[]
  applied?: string | null
  /** S7 (mezo-d6ivw.7): a known-exception offer seeded OPEN on this thread — 'EXCUSE' shows the
   *  one-tap "ismerős kifogás?" button in mock mode without needing a reply first. */
  offer?: TeamChatThread['offer']
  offerTag?: string | null
}

interface LineSeed {
  id: string
  threadId: string | null
  kind: TeamChatLine['kind']
  character: TeamChatLine['character']
  time: string
  body: string
  facts: string[]
  /** Only present on the line that OPENS or RESOLVES the thread — advances the thread's status. */
  closesThread?: boolean
}

const THREADS: ThreadSeed[] = [
  {
    id: 'tc-thread-sleep-debt',
    flagKey: 'sleep_debt',
    ruleLabel: 'Alvásadósság',
    owner: 'szunya',
    guest: 'szkeptikus',
    pushed: true,
    actions: [SHIFT_SLEEP_ANCHOR],
  },
  {
    id: 'tc-thread-load-fuel-mismatch',
    flagKey: 'load_fuel_mismatch',
    ruleLabel: 'Terhelés–táplálás',
    owner: 'mocor',
    guest: 'falat',
    pushed: true,
    actions: [],
  },
  {
    id: 'tc-thread-sustained-stress',
    flagKey: 'sustained_stress',
    ruleLabel: 'Tartós stressz',
    owner: 'deru',
    guest: null,
    pushed: false,
    actions: [],
  },
  // S7 (mezo-d6ivw.7, Task 8): a known-exception EXCUSE offer, seeded OPEN so the one-tap
  // answer button is visible in mock mode without a reply round-trip first.
  {
    id: 'tc-thread-late-eating',
    flagKey: 'late_eating',
    ruleLabel: 'Késői étkezés',
    owner: 'falat',
    guest: null,
    pushed: false,
    actions: [],
    offer: 'EXCUSE',
    offerTag: 'meccsnap',
  },
]

/** The seeded EXCUSE-offer thread's id — an OPEN ügy any reply/answer flow test can target. */
export const OPEN_ID = 'tc-thread-late-eating'

const LINES: LineSeed[] = [
  {
    id: 'tc-line-1',
    threadId: 'tc-thread-sleep-debt',
    kind: 'OPEN',
    character: 'szunya',
    time: '07:40',
    body:
      'Az elmúlt 3 éjszakán összesen 2 óra 10 perc hiányzik a 7 és fél órás célodhoz képest. 🌙 Ma este nem kell semmi különös — csak 22:45 előtt kerülj ágyba, és holnap reggelre a felét visszanyerjük.',
    facts: ['3 éjszaka alatt 2 óra 10 perc hiány', 'cél: 7 óra 30 perc', 'ma este: 22:45 előtti lefekvés'],
    closesThread: false,
  },
  {
    id: 'tc-line-2',
    threadId: 'tc-thread-sleep-debt',
    kind: 'SKEPTIC',
    character: 'szkeptikus',
    time: '07:41',
    body:
      'Egy megjegyzés: a szombati éjszakán az óra nem mérte a mély szakaszt, azt becsültük. A hiány ettől még valós, de lehet 20 perccel kevesebb is.',
    facts: ['becslés: akár 20 perccel kevesebb hiány is lehet'],
  },
  {
    id: 'tc-line-3',
    threadId: 'tc-thread-load-fuel-mismatch',
    kind: 'OPEN',
    character: 'mocor',
    time: '12:05',
    body:
      'Ma este 90 perces röplabda-edzés vár, de délig csak 620 kcal ment be — a szokásodnak a fele sincs meg. ⚡ Így a 4. szettre elfogy a lábad. @Falat, tudsz segíteni?',
    facts: ['90 perces edzés ma este', '620 kcal bevitel délig', 'a szokásos bevitel kevesebb, mint fele'],
  },
  {
    id: 'tc-line-4',
    threadId: 'tc-thread-load-fuel-mismatch',
    kind: 'GUEST',
    character: 'falat',
    time: '12:06',
    body:
      'Persze! Az ebédnél pótolnám: +40 g szénhidrát — egy adag rizs vagy két szelet kenyér a fehérjéd mellé. 🍽️ Ha 14 óráig bekerül, bőven marad idő megemészteni.',
    facts: ['+40 g szénhidrát az ebédnél', 'határidő: 14 óra'],
  },
  {
    id: 'tc-line-5',
    threadId: 'tc-thread-load-fuel-mismatch',
    kind: 'USER',
    character: null,
    time: '12:40',
    body: 'Rizses csirkét ettem, dupla adag rizzsel.',
    facts: [],
  },
  {
    id: 'tc-line-6',
    threadId: 'tc-thread-load-fuel-mismatch',
    kind: 'RESOLVE',
    character: 'falat',
    time: '13:05',
    body:
      'Megvan: az ebéddel 1 140 kcal és 95 g szénhidrát jött össze — ez bőven elég az estéhez. ✅ 🥦 Mocor, a te köröd!',
    facts: ['ebéd: 1 140 kcal', '95 g szénhidrát'],
    closesThread: true,
  },
  {
    id: 'tc-line-7',
    threadId: 'tc-thread-load-fuel-mismatch',
    kind: 'GUEST',
    character: 'mocor',
    time: '13:06',
    body: 'Akkor este teljes gázzal. 💪 Az első szettben figyelem, bírja-e a lábad.',
    facts: [],
  },
  {
    id: 'tc-line-8',
    threadId: 'tc-thread-sustained-stress',
    kind: 'OPEN',
    character: 'deru',
    time: '16:20',
    body:
      'Harmadik napja 7 fölötti stresszt jelöltél be délután. 🌤️ Nem kell most megoldani — de vacsora után 10 perc séta nálad eddig a következő reggelre átlag 2 ponttal lejjebb vitte.',
    facts: ['3 napja 7 fölötti stressz délután', '10 perc séta → átlag −2 pont a reggeli stresszen'],
    closesThread: false,
  },
  {
    id: 'tc-line-9',
    threadId: 'tc-thread-late-eating',
    kind: 'OPEN',
    character: 'falat',
    time: '17:50',
    body:
      'Ma 17:50-kor ettél utoljára — ez jóval a szokásos 15 óra körüli sávod után van. 🍽️ Ha ennek oka volt — mondjuk meccsnap —, szólj, és megjegyzem.',
    facts: ['utolsó étkezés: 17:50', 'szokásos sáv: 15:00 körül'],
    closesThread: false,
  },
]

/** Builds the whole mock day (lines + threads + openThreads projection) from the two seed
 *  tables above for the given local date — the single source both `MOCK_TEAM_CHAT_DAY` and any
 *  test assertion read from, so lines and threads can never hand-drift apart. */
export function buildTeamChatDay(date: string): TeamChatDay {
  const threadsById = new Map<string, TeamChatThread>()
  for (const t of THREADS) {
    threadsById.set(t.id, {
      id: t.id,
      flagKey: t.flagKey,
      ruleLabel: t.ruleLabel,
      owner: t.owner,
      guest: t.guest ?? null,
      status: 'OPEN',
      openedAt: '',
      closedAt: null,
      pushed: t.pushed,
      actions: t.actions,
      applied: t.applied ?? null,
      closeReason: null,
      closeNote: null,
      offer: t.offer ?? null,
      offerTag: t.offerTag ?? null,
      remembered: null,
    })
  }

  const lines: TeamChatLine[] = LINES.map((l) => {
    const occurredAt = offsetIso(date, l.time)
    if (l.threadId != null) {
      const thread = threadsById.get(l.threadId)
      if (thread != null) {
        if (l.kind === 'OPEN') thread.openedAt = occurredAt
        if (l.closesThread) {
          thread.status = 'RESOLVED'
          thread.closedAt = occurredAt
        }
      }
    }
    return {
      id: l.id,
      threadId: l.threadId,
      kind: l.kind,
      character: l.character,
      body: l.body,
      voiced: true,
      facts: l.facts,
      occurredAt,
    }
  })

  // The line that opened each thread carries the thread's embedded state (api.gen's `thread?`
  // field — the OPEN line's own snapshot of the ügy it started).
  for (const l of lines) {
    if (l.kind === 'OPEN' && l.threadId != null) {
      const thread = threadsById.get(l.threadId)
      if (thread != null) l.thread = thread
    }
  }

  const openThreads = THREADS.map((t) => threadsById.get(t.id)!).filter((t) => t.status === 'OPEN')

  return {
    date,
    lines,
    openThreads,
    pushesToday: THREADS.filter((t) => t.pushed).length,
    pushBudget: 2,
  }
}

/** The seeded "today" — what `useTeamChat()` (no explicit date) serves in mock mode. */
export const MOCK_TEAM_CHAT_DAY: TeamChatDay = buildTeamChatDay(localDateString())

// ---------------------------------------------------------------------------
// S7 (mezo-d6ivw.7, Task 8) — pure day builders for the mock reply/answer/undo flows.
// Each takes a `TeamChatDay` and returns a NEW one (no mutation) so they compose with
// `qc.setQueriesData` across every cached day. A thread can appear twice in a day (the
// OPEN line's embedded snapshot AND `openThreads`) — `replaceThreadEverywhere` keeps both
// in sync, mirroring `buildTeamChatDay`'s own "one source of truth" rule above.
// ---------------------------------------------------------------------------

/** A concrete, believable reason in the user's own words — matched against the reply text to
 *  decide whether Falat can close the ügy with a remembered exception, or just acknowledges it. */
const CONCRETE_REASON_RE = /meccs|kupa|meccsnap|röpi/i

function findThread(day: TeamChatDay, threadId: string): TeamChatThread | undefined {
  return day.lines.find((l) => l.threadId === threadId && l.thread != null)?.thread
    ?? day.openThreads.find((t) => t.id === threadId)
}

function replaceThreadEverywhere(day: TeamChatDay, threadId: string, next: TeamChatThread): TeamChatDay {
  return {
    ...day,
    lines: day.lines.map((l) => (l.threadId === threadId && l.thread != null) ? { ...l, thread: next } : l),
    openThreads: next.status === 'OPEN'
      ? (day.openThreads.some((t) => t.id === threadId)
        ? day.openThreads.map((t) => (t.id === threadId ? next : t))
        : [...day.openThreads, next])
      : day.openThreads.filter((t) => t.id !== threadId),
  }
}

/** Appends the USER line + Falat's synthetic REPLY. A concrete reason (`CONCRETE_REASON_RE`)
 *  closes the ügy and remembers it as a standing exception; otherwise it's a plain
 *  acknowledgement and the ügy stays exactly as it was. Unknown `threadId` → the day unchanged. */
export function mockReplyAfter(day: TeamChatDay, threadId: string, text: string): TeamChatDay {
  const current = findThread(day, threadId)
  if (current == null) return day

  const userAt = nowOffsetIso()
  // +60s is a deliberate ORDERING choice, not simulated elapsed time — it only has to sort
  // after `userAt` (`resolvedThreadIds` in teamChatHooks.ts compares occurredAt strings to
  // decide a reply "landed"); the real typing delay is the caller's `setTimeout(1200)`.
  const replyAt = nowOffsetIso(new Date(Date.now() + 60_000))
  const concrete = CONCRETE_REASON_RE.test(text)

  const nextThread: TeamChatThread = concrete
    ? {
        ...current,
        status: 'RESOLVED',
        closedAt: replyAt,
        closeReason: 'REPLY',
        closeNote: 'meccsnap',
        remembered: { text: 'Meccsnapokon későn eszel — ez rendben van.', contextTag: 'meccsnap', active: true },
      }
    : { ...current }

  const userLine: TeamChatLine = {
    id: `tc-line-user-${threadId}-${Date.now()}`,
    threadId,
    kind: 'USER',
    character: null,
    body: text,
    voiced: true,
    facts: [],
    occurredAt: userAt,
  }
  const replyLine: TeamChatLine = {
    id: `tc-line-reply-${threadId}-${Date.now()}`,
    threadId,
    kind: 'REPLY',
    character: current.owner,
    body: concrete
      ? 'Rendben, ez most tényleg kivétel volt — megjegyzem, és legközelebb emiatt nem szólok.'
      : 'Értem, köszönöm, hogy elmondtad.',
    voiced: true,
    facts: [],
    occurredAt: replyAt,
    thread: nextThread,
  }

  const withThread = replaceThreadEverywhere(day, threadId, nextThread)
  return { ...withThread, lines: [...withThread.lines, userLine, replyLine] }
}

const ANSWER_BODY: Record<TeamChatAnswerChoice, string> = {
  EXCUSED: 'Rendben, akkor ez most is kivétel volt.',
  KEEP: 'Rendben, akkor marad így — tovább figyelek.',
  STOP: 'Rendben, akkor újra szólok, ha előjön.',
}

/** The one-tap answer to a known-exception offer (`EXCUSE`) or the capped re-check (`REVIEW`).
 *  `EXCUSED`/`KEEP` close the ügy as a confirmed exception; `STOP` closes it as the user asking
 *  to be told again next time. Either way the offer is consumed. Unknown `threadId` → unchanged. */
export function mockAnswer(day: TeamChatDay, threadId: string, choice: TeamChatAnswerChoice): TeamChatDay {
  const current = findThread(day, threadId)
  if (current == null) return day

  const answeredAt = nowOffsetIso()
  const nextThread: TeamChatThread = choice === 'STOP'
    ? { ...current, status: 'RESOLVED', closedAt: answeredAt, closeReason: 'REPLY', closeNote: 'kivétel kikapcsolva', offer: null, offerTag: null }
    : { ...current, status: 'RESOLVED', closedAt: answeredAt, closeReason: 'EXCUSED', closeNote: current.offerTag ?? null, offer: null, offerTag: null }

  const line: TeamChatLine = {
    id: `tc-line-answer-${threadId}-${Date.now()}`,
    threadId,
    kind: 'REPLY',
    character: nextThread.owner,
    body: ANSWER_BODY[choice],
    voiced: true,
    facts: [],
    occurredAt: answeredAt,
    thread: nextThread,
  }

  const withThread = replaceThreadEverywhere(day, threadId, nextThread)
  return { ...withThread, lines: [...withThread.lines, line] }
}

/** Withdraws a remembered exception chip. If that's what closed the ügy (`closeReason ===
 *  'REPLY'`, the STOP/known-exception REPLY flow) it reopens; an `EXCUSED` closure stays closed
 *  — the ügy was legitimately resolved, only the standing exception is undone. No remembered
 *  chip on this thread → the day unchanged. */
export function mockUndo(day: TeamChatDay, threadId: string): TeamChatDay {
  const current = findThread(day, threadId)
  if (current == null || current.remembered == null) return day

  const reopen = current.closeReason === 'REPLY'
  const nextThread: TeamChatThread = {
    ...current,
    remembered: { ...current.remembered, active: false },
    ...(reopen ? { status: 'OPEN', closedAt: null, closeReason: null, closeNote: null } : {}),
  }
  return replaceThreadEverywhere(day, threadId, nextThread)
}
