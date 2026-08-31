import { memoryIcon, parseToolName, refDomain, toolDomain } from '@/features/insights/logic/toolDomains'

describe('toolDomain', () => {
  it('maps the real companion tools to human labels + clay icons + washes', () => {
    expect(toolDomain('get_weight_log')).toEqual({ label: 'Súlynapló', icon: 'i-suly', wash: 'sky' })
    expect(toolDomain('get_recovery')).toEqual({ label: 'Alvás & pihenés', icon: 'i-alvas', wash: 'lav' })
    expect(toolDomain('get_fuel_log')).toEqual({ label: 'Fuel napló', icon: 'i-fuel', wash: 'sage' })
    expect(toolDomain('get_training_log')).toEqual({ label: 'Edzésnapló', icon: 'i-edzes', wash: 'coral' })
    expect(toolDomain('find_similar_past_days')).toEqual({ label: 'Emlékek', icon: 'i-retegek', wash: 'lav' })
  })
  it('falls back honestly on an unknown tool: raw name, neutral wash', () => {
    expect(toolDomain('recallSharedMemory')).toEqual({ label: 'recallSharedMemory', icon: 'i-mezo', wash: 'neutral' })
  })
  it('maps baked wire names name(args) to the same domain as the bare name', () => {
    expect(toolDomain('get_recovery(days=3)')).toEqual({ label: 'Alvás & pihenés', icon: 'i-alvas', wash: 'lav' })
    expect(toolDomain('get_weight_log(days=7)')).toEqual({ label: 'Súlynapló', icon: 'i-suly', wash: 'sky' })
  })
  it('falls back honestly on an unknown baked wire name: parsed base, neutral wash', () => {
    expect(toolDomain('recallSharedMemory(foo=1)')).toEqual({ label: 'recallSharedMemory', icon: 'i-mezo', wash: 'neutral' })
  })
})

describe('parseToolName', () => {
  it('splits a bare name with no params', () => {
    expect(parseToolName('get_recovery')).toEqual({ base: 'get_recovery' })
  })
  it('splits base and params at the first paren', () => {
    expect(parseToolName('get_recovery(days=3)')).toEqual({ base: 'get_recovery', params: 'days=3' })
  })
  it('extracts multiple comma-separated params verbatim', () => {
    expect(parseToolName('get_recovery(days=3, scope=sleep)')).toEqual({
      base: 'get_recovery',
      params: 'days=3, scope=sleep',
    })
  })
  it('takes everything after the first ( when the closing paren is missing', () => {
    expect(parseToolName('get_recovery(days=3')).toEqual({ base: 'get_recovery', params: 'days=3' })
  })
})

describe('refDomain', () => {
  it('maps ref kinds to the same domain families', () => {
    expect(refDomain('Workout').wash).toBe('coral')
    expect(refDomain('SleepLog').wash).toBe('lav')
    expect(refDomain('Pattern')).toEqual({ label: 'Minta', icon: 'i-minta', wash: 'gold' })
    expect(refDomain('Memory')).toEqual({ label: 'Emlék', icon: 'i-retegek', wash: 'lav' })
  })
  it('maps the full backend ref-kind vocabulary (mezo-vdf4)', () => {
    expect(refDomain('Weight')).toEqual({ label: 'Súly', icon: 'i-suly', wash: 'sky' })
    expect(refDomain('FuelDay')).toEqual({ label: 'Fuel nap', icon: 'i-fuel', wash: 'sage' })
    expect(refDomain('Medication').wash).toBe('rose')
  })
  it('falls back honestly on an unknown kind', () => {
    expect(refDomain('SomethingNew')).toEqual({ label: 'SomethingNew', icon: 'i-mezo', wash: 'neutral' })
  })
})

describe('memoryIcon', () => {
  it('maps recalled-memory wire kinds to clay icons', () => {
    expect(memoryIcon('daily_summary')).toBe('i-nap')
    expect(memoryIcon('journal_entry')).toBe('i-naplo')
    expect(memoryIcon('weekly_summary')).toBe('i-heti')
    expect(memoryIcon('chat_turn')).toBe('i-mezo')
    expect(memoryIcon('checkin_note')).toBe('i-checkin')
  })
  it('falls back to the layers icon', () => {
    expect(memoryIcon('whatever_new')).toBe('i-retegek')
  })
})
