import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useDiagnoses, useDiagnosisActions } from '@/data/insights/diagnosisHooks'
import { mockDiagnoses } from '@/data/insights/diagnosisMock'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const wireRow = {
  id: 'd1',
  phenomenon: 'fatigue',
  windowDays: 14,
  verdict: 'Az alvásod esett vissza.',
  confidence: 'strong',
  evidence: [
    {
      kind: 'metric', label: 'alváshossz', detail: 'átlag 6.1', sourceHu: 'Alvás-napló',
      metricKey: 'SLEEP_DURATION_H', value: 6.1, baselineValue: 7.3, delta: -1.2, coverageDays: 13,
    },
  ],
  suspects: [
    {
      rank: 1, title: 'Alváshiány', claim: 'Kevesebbet alszol.', evidenceIndexes: [0],
      strength: 'strong', probeText: 'Feküdj le 23:00 előtt.', metricKey: 'SLEEP_DURATION_H',
      expectedDirection: 'up', totalDays: 7,
    },
  ],
  generatedAt: '2026-08-31T06:12:00Z',
  stale: false,
}

describe('useDiagnoses (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps a wire row and never returns the seed', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([wireRow])),
    )
    const { result } = renderHook(() => useDiagnoses(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.diagnoses).toHaveLength(1))
    const d = result.current.diagnoses[0]
    expect(d.verdict).toBe('Az alvásod esett vissza.')
    expect(d.suspects[0].evidenceIndexes).toEqual([0])
    expect(d.evidence[0].delta).toBe(-1.2)
    expect(d.id).not.toBe(mockDiagnoses[0].id)
    expect(result.current.mode).toBe('live')
  })

  test('returns [] on the default empty list (honest empty state)', async () => {
    const { result } = renderHook(() => useDiagnoses(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.diagnoses).toEqual([])
  })

  test('a 429 on generate maps to the quota error kind', async () => {
    server.use(
      http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([{ code: 'DIAGNOSIS_QUOTA_EXCEEDED', message: 'quota' }], { status: 429 })),
    )
    const { result } = renderHook(() => useDiagnosisActions(), { wrapper: makeHookWrapper() })
    result.current.generate('fatigue')
    await waitFor(() => expect(result.current.error).toBe('quota'))
  })

  test('a 409 on generate maps to the insufficient error kind', async () => {
    server.use(
      http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([{ code: 'DIAGNOSIS_INSUFFICIENT_DATA', message: 'thin' }], { status: 409 })),
    )
    const { result } = renderHook(() => useDiagnosisActions(), { wrapper: makeHookWrapper() })
    result.current.generate('fatigue')
    await waitFor(() => expect(result.current.error).toBe('insufficient'))
  })
})

describe('useDiagnoses (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seed without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useDiagnoses(), { wrapper: makeHookWrapper() })
    expect(result.current.mode).toBe('mock')
    expect(result.current.diagnoses).toBe(mockDiagnoses)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
