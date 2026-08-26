import { describe, expect, it } from 'vitest'
import { mesoVolumeArcMock } from '@/data/train/train'

// Mock<->backend arc parity pin (mezo-3m5m, spec AD4): the `meso-hyp-04` fixture tags
// `shoulder: 'maintain'` and leaves every other muscle unset (Grow default) — the SAME
// fixture MesoOverviewPage renders from, so both non-default tier ceilings are proven
// against real demo data, not a synthetic one-off.
describe('mesoVolumeArcMock (mezo-3m5m tier ceiling parity)', () => {
  it('Grow default (absent key, e.g. chest) peaks the planned ramp at MAV, never reaching MRV', () => {
    const arc = mesoVolumeArcMock('meso-hyp-04')
    const chest = arc?.muscles.find((m) => m.muscle === 'chest')
    expect(chest).toBeDefined()
    const planned = chest!.weeks.map((w) => w.planned)
    // mev=8, mav=14, mrv=20 — ramps 8 -> 10 -> 12 -> 14 and clamps there; W6 is Deload:
    // round(ceiling(14) * MOCK_DELOAD_FRACTION).
    expect(planned).toEqual([8, 10, 12, 14, 14, 7])
    expect(Math.max(...planned)).toBe(14) // never touches mrv=20 (the pre-mezo-3m5m ceiling)
    expect(chest!.mrv).toBe(20) // the response's mrv CAPTION stays the raw landmark, untouched
  })

  it('Maintain (shoulder) stays flat at MEV — the tier disables the ramp entirely', () => {
    const arc = mesoVolumeArcMock('meso-hyp-04')
    const shoulder = arc?.muscles.find((m) => m.muscle === 'shoulder')
    expect(shoulder).toBeDefined()
    const planned = shoulder!.weeks.map((w) => w.planned)
    // mev=8, mav=12, mrv=18 — the ceiling (mev=8) clamps every ramp step back to 8; W6 is
    // Deload: round(ceiling(8) * MOCK_DELOAD_FRACTION).
    expect(planned).toEqual([8, 8, 8, 8, 8, 4])
  })
})
