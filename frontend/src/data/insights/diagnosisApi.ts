import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Diagnosis, DiagnosisConfidence, DiagnosisEvidence, DiagnosisSuspect } from '@/data/types'

type DiagnosisWire =
  paths['/api/proactive/diagnosis']['get']['responses']['200']['content']['application/json'][number]
type ExperimentWire =
  paths['/api/proactive/diagnosis/{id}/suspect/{rank}/experiment']['post']['responses']['201']['content']['application/json']

/** Wire → FE: the contract's nullables become optionals; nothing else is transformed. The
 *  numbers are the backend's own frozen evidence — the FE never recomputes them (mezo-hqfi). */
export function toDiagnosis(wire: DiagnosisWire): Diagnosis {
  return {
    id: wire.id,
    phenomenon: wire.phenomenon,
    windowDays: wire.windowDays,
    verdict: wire.verdict,
    confidence: wire.confidence as DiagnosisConfidence,
    evidence: wire.evidence.map(
      (e): DiagnosisEvidence => ({
        kind: e.kind as DiagnosisEvidence['kind'],
        label: e.label,
        detail: e.detail ?? undefined,
        sourceHu: e.sourceHu ?? undefined,
        metricKey: e.metricKey ?? undefined,
        value: e.value ?? undefined,
        baselineValue: e.baselineValue ?? undefined,
        delta: e.delta ?? undefined,
        coverageDays: e.coverageDays ?? undefined,
      }),
    ),
    suspects: wire.suspects.map(
      (s): DiagnosisSuspect => ({
        rank: s.rank,
        title: s.title,
        claim: s.claim,
        evidenceIndexes: s.evidenceIndexes,
        strength: s.strength as DiagnosisConfidence,
        probeText: s.probeText,
        metricKey: s.metricKey,
        expectedDirection: s.expectedDirection as DiagnosisSuspect['expectedDirection'],
        totalDays: s.totalDays,
      }),
    ),
    generatedAt: wire.generatedAt,
    stale: wire.stale,
  }
}

export const diagnosisApi = {
  list: () =>
    apiFetch<DiagnosisWire[]>('/api/proactive/diagnosis')
      .then((rows) => rows.map(toDiagnosis)),
  get: (id: string) =>
    apiFetch<DiagnosisWire>(`/api/proactive/diagnosis/${id}`).then(toDiagnosis),
  /** Costs a real SMART-tier call and one of the day's generations — live only. */
  generate: (phenomenon: string) =>
    apiFetch<DiagnosisWire>('/api/proactive/diagnosis', {
      method: 'POST',
      body: JSON.stringify({ phenomenon }),
    }).then(toDiagnosis),
  /** The tap IS the acceptance — this creates a real, active experiment. */
  startExperiment: (id: string, rank: number) =>
    apiFetch<ExperimentWire>(`/api/proactive/diagnosis/${id}/suspect/${rank}/experiment`, {
      method: 'POST',
    }),
}
