import { describe, it, expect } from 'vitest'
import {
  formatCost, formatRollupCost, formatTokens, formatLatency, formatTime, formatDateTime, formatBytes,
  callKindLabel, statusTone, statusLabel, tokenSegments,
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

describe('formatRollupCost', () => {
  it('dashes an unknown cost instead of showing zero', () => {
    expect(formatRollupCost(null)).toBe('—')
    expect(formatRollupCost(undefined)).toBe('—')
  })

  it('always uses two decimals, even for a sub-dime aggregate (the regression this guards)', () => {
    expect(formatRollupCost(1.86)).toBe('$1.86')
    expect(formatRollupCost(0.09)).toBe('$0.09')
  })

  it('renders a genuinely nonzero but sub-half-cent rollup as "<$0.01", never a misleading $0.00', () => {
    expect(formatRollupCost(0.004)).toBe('<$0.01')
  })

  it('renders an exact zero as $0.00 (nothing to hide)', () => {
    expect(formatRollupCost(0)).toBe('$0.00')
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

describe('formatDateTime', () => {
  it('renders the full Hungarian date AND clock in the Europe/Budapest report zone', () => {
    // Same zone as formatTime (12:31 UTC is 14:31 in Budapest in August) — but the detail page is
    // deep-linkable, so it must also say WHICH day, instead of the raw ISO instant it used to print.
    expect(formatDateTime('2026-08-14T12:31:07Z')).toBe('2026. aug. 14. 14:31')
    // A UTC instant that falls on the NEXT day in Budapest — the zone has to move the date too.
    expect(formatDateTime('2026-01-05T23:05:00Z')).toBe('2026. jan. 6. 00:05')
  })

  it('returns empty string for empty input', () => {
    expect(formatDateTime('')).toBe('')
  })
})

describe('formatBytes', () => {
  it('scales to kB/MB and dashes an unknown size (0 bytes is not unknown)', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(842)).toBe('842 B')
    expect(formatBytes(862_208)).toBe('842.0 kB')
    expect(formatBytes(3_670_016)).toBe('3.5 MB')
  })
})

describe('callKindLabel / statusTone / statusLabel', () => {
  it('labels every call kind and maps every status to a tone', () => {
    expect(callKindLabel('CHAT_STREAM')).toBe('STREAM')
    expect(callKindLabel('EMBED_DOC')).toBe('EMBED')
    expect(callKindLabel('TOOL')).toBe('TOOL')
    expect(statusTone('SUCCESS')).toBe('ok')
    expect(statusTone('ERROR')).toBe('error')
    expect(statusTone('CANCELLED')).toBe('cancelled')
  })

  it('gives every status a Hungarian pill label (the raw enum is not UI text)', () => {
    expect(statusLabel('SUCCESS')).toBe('SIKER')
    expect(statusLabel('ERROR')).toBe('HIBA')
    expect(statusLabel('CANCELLED')).toBe('MEGSZAKADT')
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
