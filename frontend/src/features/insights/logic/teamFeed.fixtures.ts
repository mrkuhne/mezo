/**
 * Lerögzített minimál-rekordok a team-feed builder tesztjeihez (mezo-a9bo7.7).
 * A mezőformák a mock-seedekből idézve: `data/insights/insights.ts`, `data/insights/observations.ts`,
 * `data/character/characterMock.ts` — új rekordforma nincs kitalálva.
 */
import type { CharacterFeedItem } from '@/data/character/characterApi'
import type { Experiment, Observation, Pattern, PatternMonitorPair, Prediction } from '@/data/types'
import { mapEvidence } from '@/shared/ui/evidence/observationEvidence'

export const TODAY = '2026-09-23'
export const YESTERDAY = '2026-09-22'

function pair(key: string, a: PatternMonitorPair['metricADomain'], b: PatternMonitorPair['metricBDomain']): PatternMonitorPair {
  return {
    key,
    title: key,
    category: 'trigger',
    categoryLabel: 'Kiváltó',
    lagDays: 1,
    metricAKey: key.split('~')[0],
    metricALabel: 'A',
    metricAValueKind: 'number',
    metricBKey: key.split('~')[1],
    metricBLabel: 'B',
    metricBValueKind: 'number',
    mechanismHu: '',
    questionHu: '',
    expectedDirection: 'negative',
    whenPositiveHu: '',
    whenNegativeHu: '',
    metricADomain: a,
    metricBDomain: b,
    verdict: 'live',
    alignedDays: 21,
    missingDays: null,
    bottleneckMetricKey: null,
    groupZeroDays: null,
    groupOneDays: null,
    requiredPerGroup: null,
    r: null,
    n: null,
    p: null,
    status: null,
  }
}

export const pairs: PatternMonitorPair[] = [
  pair('late-meal~next-sleep-quality', 'fuel', 'sleep'),
  pair('sleep-duration~sleep-quality', 'sleep', 'sleep'),
  pair('sport-load~next-sleep-quality', 'train', 'sleep'),
]

/** proposed, fuel→sleep — Falat posztol, Szunya a vendég; MA észlelve. */
export const lateMealPattern: Pattern = {
  id: 'p2',
  pairKey: 'late-meal~next-sleep-quality',
  category: 'trigger',
  categoryLabel: 'Kiváltó',
  confidence: 0.78,
  title: 'Késő szénhidrát (>20:00 · >60g) → másnap reggeli RPE +1',
  mechanism: 'Késői szénhidrát-bevitel csökkenti az első deep sleep ciklus minőségét.',
  evidence: ['8 késői étkezés', '6 éjszaka rosszabb'],
  status: 'proposed',
  evidenceHits: 6,
  evidenceMisses: 2,
  lastDetectedAt: `${TODAY}T03:10:00`,
}

/** monitoring, n=5 < minN=8, sleep→sleep — Szunya sejtése; TEGNAP észlelve. */
export const monitoringPattern: Pattern = {
  id: 'p5',
  pairKey: 'sleep-duration~sleep-quality',
  category: 'physiology',
  categoryLabel: 'Fiziológia',
  title: 'Hosszabb alvás → jobb alvásminőség',
  mechanism: 'A 7,5 óránál hosszabb éjszakákon jobb az alvásminőség.',
  evidence: ['5 éjszaka'],
  status: 'monitoring',
  kind: 'ai_hypothesis',
  testPlan: {
    seriesA: 'sleep-duration-h',
    seriesB: 'sleep-quality',
    seriesALabel: 'alváshossz',
    seriesBLabel: 'alvásminőség',
    lagDays: 0,
    expectedDirection: 'positive',
    minN: 8,
    windowDays: 60,
  },
  evidenceHits: 4,
  evidenceMisses: 1,
  lastDetectedAt: `${YESTERDAY}T03:10:00`,
}

/** a felhasználó már elutasította — nem poszt. */
export const rejectedPattern: Pattern = {
  id: 'p9',
  pairKey: 'sport-load~next-sleep-quality',
  category: 'physiology',
  categoryLabel: 'Fiziológia',
  title: 'Elutasított minta',
  mechanism: 'Elutasított.',
  evidence: [],
  status: 'rejected',
  evidenceHits: 0,
  evidenceMisses: 0,
  lastDetectedAt: `${TODAY}T03:10:00`,
}

export const activeExperiment: Experiment = {
  id: 'e1',
  title: 'Délutáni koffein-stop',
  status: 'active',
  day: 4,
  total: 14,
  hypothesis: '14:00 utáni koffein nélkül rövidebb az elalvási idő.',
}

export const proposedExperiment: Experiment = {
  id: 'e2',
  title: 'Javasolt kísérlet',
  status: 'proposed',
  day: 0,
  total: 7,
  hypothesis: 'Még nem indult.',
}

export const pendingPrediction: Prediction = {
  id: 'pr1',
  title: 'Holnap 7 óra fölött alszol',
  confidence: 0.62,
  status: 'pending',
  date: TODAY,
}

export const missedPrediction: Prediction = {
  id: 'pr2',
  title: 'Tegnap jól fogsz aludni',
  confidence: 0.7,
  status: 'missed',
  date: YESTERDAY,
  basis: 'A pihenőnap után rendszerint jól alszol.',
  actual: 'Az alvás-score 62 lett.',
}

/** fresh esemény egy reflexiós mintáról (a pattern-listában nincs) — Mezo gazdálkodik vele. */
export const freshObservation: Observation = {
  id: 'obs-fresh-1',
  patternId: 'op-anna-alvas',
  hypothesisKey: 'ref-anna-alvas',
  card: 'fresh',
  occurredAt: `${TODAY}T14:12:00`,
  title: 'Anna és az alvásod',
  text: 'Amikor **Anna** szerepel a hála-naplódban, másnap átlag **40 perccel többet** alszol.',
  question: 'Négy ilyen napot látok eddig — **Figyeljem tovább?**',
  evidence: [mapEvidence({ type: 'tag', text: '4 hála-bejegyzés' })],
  status: 'proposed',
  evidenceHits: 4,
  evidenceMisses: 0,
  minN: 8,
  belief: 0.38,
  sourceIcon: 'i-naplo',
}

/** watching SOR-kártya — nem esemény, nem poszt. */
export const watchingObservation: Observation = {
  id: 'p5',
  patternId: 'p5',
  card: 'watching',
  occurredAt: `${TODAY}T08:00:00`,
  title: 'Hosszabb alvás',
  text: '',
  evidence: [],
  status: 'monitoring',
  evidenceHits: 4,
  evidenceMisses: 1,
  minN: 8,
  sourceIcon: 'i-mezo',
}

export const characterItems: CharacterFeedItem[] = [
  {
    sourceType: 'OBSERVATION',
    sourceId: '00000000-0000-0000-0000-000000000004',
    sourceIndex: 0,
    kind: 'OBSERVATION',
    at: `${YESTERDAY}T12:52:00`,
    expertKey: 'edzo',
    text: 'A tegnapi teremedzésen minden RIR-cél 1-en belül teljesült.',
  },
  {
    sourceType: 'OBSERVATION',
    sourceId: '00000000-0000-0000-0000-000000000010',
    sourceIndex: 0,
    kind: 'OBSERVATION',
    at: `${YESTERDAY}T12:40:00`,
    expertKey: 'szkeptikus',
    text: 'Három nap még nem trend.',
  },
  {
    sourceType: 'CONFERENCE_CHANGE',
    sourceId: 'w2',
    sourceIndex: 0,
    kind: 'CONFERENCE_CHANGE',
    at: `${YESTERDAY}T09:00:00`,
    expertKey: null,
    dimensionKeys: [],
    text: 'Vasárnapi konzílium: 2 új állítás · 1 portré átírva',
  },
]

export const input = {
  patterns: [lateMealPattern, monitoringPattern, rejectedPattern],
  monitorPairs: pairs,
  predictions: [pendingPrediction, missedPrediction],
  experiments: [activeExperiment, proposedExperiment],
  observations: [freshObservation, watchingObservation],
  characterItems,
  today: TODAY,
}
