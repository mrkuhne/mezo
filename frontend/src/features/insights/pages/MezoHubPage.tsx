// ============================================================
// Mezo · MezoHubPage — the Mezo tab's hub Mozaik face (mezo-d20.5.1)
// Source of truth: docs/design_2.0/prototypes/src/mezo-body.html hub section
// (values ×1.18). The Insights shell (AppHero + SubNavDropdown) dissolves:
// this page IS the /mezo index, the former sub-tabs are full-page siblings.
// Anatomy: header recipe (date · bell · avatar) → breathing orb hero (NO
// number — one companion sentence + the quiet status line) → composer-shaped
// chat opener → the motor's SINGLE decision card in a gold ring (the same
// decide mutation PatternsPage uses; deciding flips it to the sage
// acknowledgement) → 6-tile mosaic with live bottom lines from the pages'
// own hooks → the full-width L0→L3 memory band.
// Honest states: no fabricated numbers — tile lines vanish (or say
// „tanulom", the pages' own vocabulary) while their source is unresolved.
// ============================================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import {
  useToday, useTodayScenario, resolveBriefing, useCompanionFeed, useConversations,
  usePatterns, usePatternMonitor, usePatternActions, useMemoryOverview,
  useMeWeek, useMemoir, useKnowledge, usePredictions, useExperiments,
} from '@/data/hooks'
import { useNotificationFeed } from '@/data/notification/feedHooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import { bucketize } from '@/features/insights/logic/lifecycle'
import { confidenceMeta, findingSentence, pairLine } from '@/features/insights/logic/findings'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import { bucketFacts } from '@/features/insights/logic/factCopy'
import type { PatternStatus } from '@/data/types'

/** A prototípus döntés-visszaigazolásai — a sage decdone kártya szövege döntésenként. */
const DECIDED_MSG: Record<PatternStatus, string> = {
  confirm: '✓ Beépítettem a tudásba — mostantól számolok vele.',
  monitor: '👁 Rendben, figyeljük tovább — szólok, ha erősödik.',
  reject: '✕ Elvetve — nem hozom fel újra.',
}

export function MezoHubPage() {
  const navigate = useNavigate()
  const { today } = useToday()
  const scenario = useTodayScenario()
  const { items: notifications } = useNotificationFeed()
  const [ntfOpen, setNtfOpen] = useState(false)

  // ── orb hero: companion voice + status line ─────────────────────────
  const feed = useCompanionFeed()
  const conversations = useConversations()
  const chatMode = conversations.data.mode
  const chatDegraded = conversations.data.degraded
  const { overview } = useMemoryOverview()
  const messages = useMemo(
    () => buildMezoMessages({ feed, demoBriefing: resolveBriefing(scenario.dayState) }),
    [feed, scenario.dayState],
  )
  // The ONE proactive sentence (MezoChip precedent: the latest message's first paragraph).
  // A real feed row speaks in both modes; the labelled demo briefing only in mock mode —
  // a live user never gets demo prose presented as the companion's live voice.
  const latestReal = [...messages].reverse().find((m) => m.artifactId != null)
  const latest = latestReal ?? (chatMode === 'mock' ? messages[messages.length - 1] : undefined)
  const sentence = latest?.paragraphs[0]
  const statusBase = chatDegraded
    ? 'a társ most nem elérhető'
    : chatMode === 'mock' ? 'demo beszélgetés' : 'Gemini · élő'
  const togetherDays = overview != null && overview.l0.daysWithAnyData > 0 ? overview.l0.daysWithAnyData : null

  // ── the motor's single decision card (PatternsPage's data + mutation) ──
  const { patterns, degraded: patternsDegraded, isPending: patternsPending } = usePatterns()
  const { monitor, isPending: monitorPending } = usePatternMonitor()
  const { decide } = usePatternActions()
  const [decidedAs, setDecidedAs] = useState<PatternStatus | null>(null)
  const patternsPendingAny = patternsPending || monitorPending
  const buckets = useMemo(() => bucketize(patterns, monitor), [patterns, monitor])
  const decideBucket = buckets.get('decide') ?? []
  const confirmedCount = (buckets.get('confirmed') ?? []).length
  const decEntry = decideBucket[0] ?? null
  const decPair = decEntry?.pair ?? null
  const decConf = decPair != null && decPair.n != null && decPair.p != null ? confidenceMeta(decPair.n, decPair.p) : null
  const decFinding = decPair?.r != null ? findingSentence(decPair) : null
  const onDecide = (d: PatternStatus) => {
    if (!decEntry?.pattern) return
    decide(decEntry.pattern.id, d)
    setDecidedAs(d)
  }

  // ── tile lines — each from its page's own hook, honest while unresolved ──
  const mintaLine = patternsPendingAny || patternsDegraded || (patterns.length === 0 && (monitor?.pairs.length ?? 0) === 0)
    ? undefined
    : `${confirmedCount} él a tudásban${decideBucket.length > 0 ? ` · ${decideBucket.length} döntés` : ''}`

  const { week } = useMeWeek(mondayIso())
  const score = week?.weekly.score ?? null
  const prevScore = week?.weekly.prevWeekScore ?? null
  const delta = score != null && prevScore != null ? score - prevScore : null
  const hetiLine = week == null
    ? undefined
    : score == null
      ? 'tanulom'
      : `${score} pont${delta != null ? ` · ${delta >= 0 ? '+' : ''}${delta} ${delta > 0 ? '↗' : delta < 0 ? '↘' : '→'}` : ''}`

  const { memoir } = useMemoir()
  const memoarLine = memoir != null ? `${memoir.week.split(' · ')[0]} · új fejezet` : undefined

  const knowledge = useKnowledge()
  const tudasLine = knowledge.isPending || knowledge.degraded || knowledge.facts.length === 0
    ? undefined
    : `${knowledge.facts.length} tény · ${bucketFacts(knowledge.facts).inPrompt.length} a chatben`

  const { predictions } = usePredictions()
  const predPending = predictions.filter((p) => p.status === 'pending').length
  const predClosed = predictions.filter((p) => p.status !== 'pending')
  const predValidated = predClosed.filter((p) => p.status === 'validated').length
  const predLine = predictions.length === 0
    ? 'tanulom'
    : `${predPending} aktív${predClosed.length > 0 ? ` · ${Math.round((predValidated / predClosed.length) * 100)}% bevált` : ''}`

  const { experiments } = useExperiments()
  const activeExp = experiments.find((e) => e.status === 'active') ?? null
  const kisLine = experiments.length === 0
    ? 'tanulom'
    : activeExp != null
      ? `${experiments.filter((e) => e.status === 'active').length} aktív · ${activeExp.day}/${activeExp.total} nap`
      : `${experiments.length} kísérlet`

  // ── memory band counts — the real L0→L3 overview, no numbers without it ──
  const l2Count = overview?.l2.patterns.reduce((s, p) => s + p.count, 0) ?? null
  const l3Count = overview?.l3.facts.reduce((s, f) => s + f.count, 0) ?? null
  const unreadNtf = notifications.filter((n) => n.readAt === null).length

  return (
    <div className="mzh-hub">
      <div className="nap-head">
        <div className="nap-head-grow">
          <span className="mz-eyebrow">{today.dayLabel} · {today.dateLabel}</span>
        </div>
        <div className="nap-dpwrap">
          <button type="button" className="nap-roundbtn" aria-expanded={ntfOpen}
            aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
            onClick={() => setNtfOpen((o) => !o)}>
            <ClayIcon name="i-ertesites" size={21} />
            {unreadNtf > 0 && <span className="nap-badge">{unreadNtf}</span>}
          </button>
          {ntfOpen && (
            <div className="nap-ntfmenu" role="menu">
              <span className="mz-eyebrow">Értesítések · ma</span>
              {notifications.slice(0, 3).map((n) => (
                <button key={n.id} type="button" role="menuitem" className="nap-ntfrow"
                  onClick={() => { setNtfOpen(false); if (n.deeplink) navigate(n.deeplink) }}>
                  <span className="nap-ntf-t">{n.title}</span>
                  <span className="nap-ntf-x">{n.body}</span>
                </button>
              ))}
              <button type="button" role="menuitem" className="nap-ntffoot"
                onClick={() => { setNtfOpen(false); navigate('/me/ertesitesek') }}>
                Összes értesítés ›
              </button>
            </div>
          )}
        </div>
        <button type="button" className="nap-avatar" aria-label="Profil" onClick={() => navigate('/me')}>
          <ClayIcon name="i-mezo" size={19} />
        </button>
      </div>

      <EntranceGroup className="mz-panel-stack">
        {/* ===== orb hero — no number, one sentence, quiet status ===== */}
        <div className="mzh-orbhero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <ClaySpot name="s-orb" size={109} />
          <div className="mzh-nm">Mezo</div>
          {sentence != null && <div className="mzh-ln"><SafeMarkdown text={sentence} /></div>}
          <div className="mzh-lv">
            {statusBase}
            {togetherDays != null && <> · együtt <b>{togetherDays} napja</b></>}
          </div>
        </div>

        {/* ===== composer-shaped chat opener ===== */}
        <button type="button" className="mzh-chatopen rise" style={{ '--d': '70ms' } as React.CSSProperties}
          aria-label="Beszélgetés a társsal" onClick={() => navigate('/mezo/chat')}>
          <span className="mzh-ph">Mondj valamit…</span>
          <span className="mzh-micd"><ClayIcon name="i-mikrofon" size={17} /></span>
          <span className="mzh-snd" aria-hidden="true">➤</span>
        </button>

        {/* ===== the motor's single decision card ===== */}
        {decidedAs != null ? (
          <div className="mzh-decdone rise" style={{ '--d': '110ms' } as React.CSSProperties}>
            <ClaySpot name="s-orb-unnepel" size={26} />
            <span>{DECIDED_MSG[decidedAs]}</span>
          </div>
        ) : !patternsPendingAny && decEntry?.pattern != null && (
          <div className="mzh-deccard rise" style={{ '--d': '110ms' } as React.CSSProperties}>
            <div className="mzh-dechead">
              <span className="mz-eyebrow mzh-eb-gold">🔔 Döntésre vár · {decideBucket.length}</span>
              {decConf != null && <span className={`mzh-confch is-${decConf.tone}`}>{decConf.chip}</span>}
            </div>
            <div className="mzh-decq">{decPair?.questionHu ?? decEntry.pattern.title}</div>
            {decPair != null && (
              <div className="mzh-decpair">
                {pairLine(decPair)}{decPair.n != null ? ` · ${decPair.n} közös nap` : ''}
              </div>
            )}
            <div className="mzh-decobs">
              📈 Amit eddig látunk: {decFinding != null ? (
                <>{decFinding.prefix} {decFinding.before}<b>{decFinding.strength}</b>{decFinding.after}.</>
              ) : (
                decPair != null && decPair.verdict !== 'live'
                  ? verdictSentence(decPair, null)
                  : decEntry.pattern.mechanism
              )}
            </div>
            <div className="mzh-decrow">
              <button type="button" className="mzh-cta" onClick={() => onDecide('confirm')}>Megerősítem</button>
              <button type="button" className="mzh-ghost" onClick={() => onDecide('monitor')}>Figyeljük</button>
              <button type="button" className="mzh-ghost is-no" onClick={() => onDecide('reject')}>Elvetem</button>
            </div>
          </div>
        )}

        {/* ===== 6-tile mosaic — live bottom lines from the pages' own hooks ===== */}
        <Mosaic>
          <Tile wash="lav" icon="i-minta" eyebrow="Minták" delayMs={160} className="mzh-t-minta"
            line={mintaLine} onClick={() => navigate('/mezo/patterns')} aria-label="Minták" />
          <Tile wash="sage" icon="i-naplo" eyebrow="Heti" delayMs={200} className="mzh-eb-sage"
            line={hetiLine} onClick={() => navigate('/me/week')} aria-label="Heti" />
          <Tile wash="white" icon="i-memoar" eyebrow="Memoár" delayMs={240} className="mzh-t-kreed"
            line={memoarLine} onClick={() => navigate('/mezo/memoir')} aria-label="Memoár" />
          <Tile wash="gold" icon="i-tudas" eyebrow="Tudástár" delayMs={280} className="mzh-eb-gold"
            line={tudasLine} onClick={() => navigate('/mezo/knowledge')} aria-label="Tudástár" />
          <Tile wash="sky" icon="i-kristaly" eyebrow="Előrejelzések" delayMs={320} className="mzh-eb-sky"
            line={predLine} onClick={() => navigate('/mezo/predictions')} aria-label="Előrejelzések" />
          <Tile wash="gold" icon="i-lombik" eyebrow="Kísérletek" delayMs={360} className="mzh-eb-gold"
            line={kisLine} onClick={() => navigate('/mezo/experiments')} aria-label="Kísérletek" />
        </Mosaic>

        {/* ===== L0→L3 memory band ===== */}
        <button type="button" className="mzh-membnd rise" style={{ '--d': '400ms' } as React.CSSProperties}
          aria-label="Memória-rétegek" onClick={() => navigate('/mezo/memoria')}>
          <ClayIcon name="i-retegek" size={31} />
          {overview != null ? (
            <>
              <span className="mzh-lyr"><b>{overview.l0.daysWithAnyData}</b><small>nyers nap</small></span>
              <span className="mzh-arr" aria-hidden="true">›</span>
              <span className="mzh-lyr"><b>{overview.l1.summaryCount}</b><small>napló</small></span>
              <span className="mzh-arr" aria-hidden="true">›</span>
              <span className="mzh-lyr"><b>{l2Count}</b><small>ítélet</small></span>
              <span className="mzh-arr" aria-hidden="true">›</span>
              <span className="mzh-lyr"><b>{l3Count}</b><small>tény</small></span>
            </>
          ) : (
            /* honest absence: no overview yet (cold load / switched off) — the band stays a
               door to the Memória page, without fabricated layer counts */
            <span className="mzh-membnd-ph">Memória-rétegek</span>
          )}
          <span className="mzh-arr" aria-hidden="true">›</span>
        </button>
      </EntranceGroup>
    </div>
  )
}
