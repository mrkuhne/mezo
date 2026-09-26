// Mock seed for the csapat-chat (Task 12, mezo-a9bo7.24) — mirrored VERBATIM (plain text, HTML
// spans stripped) from the approved prototype, docs/design_2.0/prototypes/uveg-uzenofal.html
// (search `function elo()`, `const DERU`), mapped onto the real backend DTO shapes from
// api.gen.ts. Built from ONE builder (`buildTeamChatDay`) so the day's lines and its
// `openThreads` projection can never drift apart into hand-typed duplicates.
import { localDateString, offsetIso } from '@/shared/lib/dates'
import type { TeamChatAction, TeamChatDay, TeamChatLine, TeamChatThread } from '@/data/character/teamChatApi'

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
]

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
