import { describe, it, expect } from 'vitest'
import {
  formatCost, formatTokens, formatLatency, formatTime, callKindLabel, statusTone, tokenSegments,
} from '@/features/me/logic/llmCallFormat'
import { LLM_CALL_DETAIL_MOCK, LLM_CALL_DETAIL_EMPTY } from '@/data/me/llmUsageHooks'

describe('formatCost', () => {
  it('dashes an unknown cost instead of showing zero', () => {
    expect(formatCost(null)).toBe('—')
    expect(formatCost(undefined)).toBe('—')
  })

  it('keeps sub-cent costs readable and rounds larger ones to cents', () => {
    expect(formatCost(0.0004)).toBe('$0.0004')
    expect(formatCost(0.0583)).toBe('$0.0583')
    expect(formatCost(1.86)).toBe('$1.86')
    expect(formatCost(0)).toBe('$0.0000')
  })

  it('enforces the dime (0.1) threshold: below uses 4 decimals, at or above uses 2', () => {
    // Just below threshold: 4 decimals (per-call detail level precision)
    expect(formatCost(0.09)).toBe('$0.0900')
    expect(formatCost(0.099)).toBe('$0.0990')
    // At or above threshold: 2 decimals (aggregate / period level)
    expect(formatCost(0.1)).toBe('$0.10')
    expect(formatCost(0.74)).toBe('$0.74')
  })
})

describe('formatTokens', () => {
  it('groups thousands with a non-breaking space and dashes unknown counts', () => {
    expect(formatTokens(11204)).toBe('11 204')
    expect(formatTokens(120)).toBe('120')
    expect(formatTokens(null)).toBe('—')
  })
})

describe('formatLatency', () => {
  it('switches from milliseconds to seconds above a second', () => {
    expect(formatLatency(812)).toBe('812 ms')
    expect(formatLatency(7812)).toBe('7.8 s')
    expect(formatLatency(22600)).toBe('22.6 s')
  })
})

describe('formatTime', () => {
  it('parses ISO and formats in Europe/Budapest timezone', () => {
    // 2026-08-14T08:00:00Z is 08:00 UTC, which is 10:00 in Budapest (UTC+2 in August).
    // This test catches a missing or incorrect timeZone parameter.
    expect(formatTime('2026-08-14T08:00:00Z')).toBe('10:00')
    expect(formatTime('2026-08-14T14:32:45Z')).toBe('16:32')
  })

  it('returns empty string for empty input', () => {
    expect(formatTime('')).toBe('')
  })
})

describe('callKindLabel / statusTone', () => {
  it('labels every call kind and maps every status to a tone', () => {
    expect(callKindLabel('CHAT_STREAM')).toBe('STREAM')
    expect(callKindLabel('EMBED_DOC')).toBe('EMBED')
    expect(callKindLabel('TOOL')).toBe('TOOL')
    expect(statusTone('SUCCESS')).toBe('ok')
    expect(statusTone('ERROR')).toBe('error')
    expect(statusTone('CANCELLED')).toBe('cancelled')
  })
})

describe('tokenSegments', () => {
  it('splits the reported counts into percentage segments that sum to 100', () => {
    const segments = tokenSegments(LLM_CALL_DETAIL_MOCK)

    expect(segments.map((s) => s.key)).toEqual(['prompt', 'candidates', 'thoughts', 'cached'])
    // prompt is stored RAW (it INCLUDES cached), so the bar must show the NET prompt slice
    expect(segments[0].value).toBe(5826 - 896)
    expect(segments[2].value).toBe(3474)
    expect(Math.round(segments.reduce((sum, s) => sum + s.percent, 0))).toBe(100)
  })

  it('returns no segments when the provider reported no usage at all', () => {
    expect(tokenSegments(LLM_CALL_DETAIL_EMPTY)).toEqual([])
  })
})
