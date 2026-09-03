// ============================================================
// Mezo · MezoHubPage — the Mezo tab's hub Mozaik face (mezo-d20.5.1)
// Source of truth: docs/design_2.0/prototypes/src/mezo-body.html hub section
// (values ×1.18). The Insights shell (AppHero + SubNavDropdown) dissolves:
// this page IS the /mezo index, the former sub-tabs are full-page siblings.
// Anatomy: the shell fejléc (app/AppHeader.tsx, mezo-atry) → breathing orb hero (NO
// number — one companion sentence + the quiet status line) → composer-shaped
// chat opener → the motor's SINGLE decision card in a gold ring (the same
// decide mutation PatternsPage uses; deciding flips it to the sage
// acknowledgement) → 6+2-tile mosaic (a széles Diagnózis + Karakter csempékkel) with live
// bottom lines from the pages' own hooks → the full-width L0→L3 memory band.
// Honest states: no fabricated numbers — tile lines vanish (or say
// „tanulom", the pages' own vocabulary) while their source is unresolved.
// ============================================================
import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { useNavigate } from 'react-router-dom'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import {
  useTodayScenario, resolveBriefing, useCompanionFeed, useConversations,
  usePatterns, usePatternMonitor, usePatternActions, useMemoryOverview,
  useMeWeek, useMemoir, useKnowledge, usePredictions, useExperiments, useDiagnoses,
  useCharacterOverview,
} from '@/data/hooks'
import { isDossierEmpty } from '@/features/character/dossierState'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import { bucketize } from '@/features/insights/logic/lifecycle'
import { confidenceMeta, findingSentence, pairLine } from '@/features/insights/logic/findings'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import { bucketFacts } from '@/features/insights/logic/factCopy'
import type { PatternStatus } from '@/data/types'

/** A prototípus döntés-visszaigazolásai — a sage decdone kártya szövege döntésenként. */
const DECIDED_MSG: Record<PatternStatus, ReactNode> = {
  // A ✓ marad glifa: az a ház pipa-idiómája (rutin/küldetés/szokás). A két másik
  // nyugtázás pikto-glifája viszont ikonra vált (mezo-hq44).
  confirm: '✓ Beépítettem a tudásba — mostantól számolok vele.',
  monitor: <><Icon name="eye" size={14} /> Rendben, figyeljük tovább — szólok, ha erősödik.</>,
  reject: <><Icon name="x" size={14} /> Elvetve — nem hozom fel újra.</>,
}

export function MezoHubPage() {
  const navigate = useNavigate()
  const scenario = useTodayScenario()

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

  const { diagnoses, isPending: diagPending } = useDiagnoses()
  const diagLine = diagPending ? undefined
    : diagnoses.length === 0 ? 'kérdés → gyanúsítottak evidenciával → próba'
    : `${diagnoses.length} korábbi riport · a legutóbbi: ${diagnoses[0].suspects[0]?.title ?? '—'}`

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

  // Karakter dossier tile (hub-tile-reorg — moved from the Én hub): honest states — the
  // switch-off 404 (overview null) drops the line, and so does the pre-bootstrap
  // "untouched dossier" state. `isDossierEmpty` is the ONE shared predicate (mezo-1gim.13
  // fix round 1) both this tile and KarakterHubPage's bootstrap face read.
  const { overview: character } = useCharacterOverview()
  const coreDims = character?.dimensions.filter((d) => d.kind === 'CORE') ?? []
  const karakterLine = character == null || coreDims.length === 0 || isDossierEmpty(character)
    ? undefined
    : `${Math.round(coreDims.reduce((sum, d) => sum + d.maturity, 0) / coreDims.length)}% átlag érettség`

  // ── memory band counts — the real L0→L3 overview, no numbers without it ──
  const l2Count = overview?.l2.patterns.reduce((s, p) => s + p.count, 0) ?? null
  const l3Count = overview?.l3.facts.reduce((s, f) => s + f.count, 0) ?? null

  return (
    <div className="mzh-hub">
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
        <button type="button" className="mzh-chatopen rise" data-kalauz-anchor="mezo-chat" style={{ '--d': '70ms' } as React.CSSProperties}
          aria-label="Beszélgetés a társsal" onClick={() => navigate('/mezo/chat')}>
          <span className="mzh-ph">Mondj valamit…</span>
          <span className="mzh-micd"><ClayIcon name="i-mikrofon" size={17} /></span>
          <span className="mzh-snd" aria-hidden="true"><Icon name="send" size={17} /></span>
        </button>

        {/* ===== the motor's single decision card ===== */}
        {decidedAs != null ? (
          <div className="mzh-decdone rise" style={{ '--d': '110ms' } as React.CSSProperties}>
            <ClaySpot name="s-orb-unnepel" size={26} />
            <span className="mz-icin">{DECIDED_MSG[decidedAs]}</span>
          </div>
        ) : !patternsPendingAny && decEntry?.pattern != null && (
          <div className="mzh-deccard rise" style={{ '--d': '110ms' } as React.CSSProperties}>
            <div className="mzh-dechead">
              <span className="mz-eyebrow mzh-eb-gold mz-ebic"><Icon name="bell" size={12} /> Döntésre vár · {decideBucket.length}</span>
              {decConf != null && <span className={`mzh-confch is-${decConf.tone}`}>{decConf.chip}</span>}
            </div>
            <div className="mzh-decq">{decPair?.questionHu ?? decEntry.pattern.title}</div>
            {decPair != null && (
              <div className="mzh-decpair">
                {pairLine(decPair)}{decPair.n != null ? ` · ${decPair.n} közös nap` : ''}
              </div>
            )}
            <div className="mzh-decobs mz-icin">
              <Icon name="trend-up" size={13} /> Amit eddig látunk: {decFinding != null ? (
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
          {/* Diagnózis (mezo-hqfi.4, design round 2): the wide question tile — a full-width
              catalog entry, not a 7th cell that would break the 2-col pairing. */}
          <Tile wash="gold" eyebrow="Diagnózis" delayMs={400} aria-label="Diagnózis"
            className="mzh-eb-gold mzh-t-diag" line={diagLine} onClick={() => navigate('/mezo/diagnozis')}>
            <div className="mz-icin" style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Miért vagyok fáradt? <Icon name="sparkle" size={13} color="var(--mz-decring)" /></div>
          </Tile>
          {/* Karakter (hub-tile-reorg): AI-domain dossier — wide like Diagnózis, so the
              6-cell 2-col pairing stays intact. */}
          <Tile wash="lav" icon="i-kristaly" eyebrow="Karakter" delayMs={440} aria-label="Karakter"
            className="mzh-eb-sage mzh-t-karakter" line={karakterLine} onClick={() => navigate('/me/karakter')} />
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
