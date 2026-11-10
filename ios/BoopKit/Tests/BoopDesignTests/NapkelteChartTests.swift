import Testing
import SwiftUI
@testable import BoopDesign

@Test func hypnogramShareSumsToOne() {
    let s = stageShares([(0, 10), (2, 50), (3, 30), (1, 10)])
    #expect(abs(s.values.reduce(0, +) - 1) < 0.01)
    #expect(abs((s[2] ?? 0) - 0.5) < 0.001)
}

@Test func stageSharesOfNothingIsEmpty() { #expect(stageShares([]).isEmpty) }

@Test func weekBarsHandleFlatData() {
    let (lo, hi) = weekBarScale(values: [59, 59, 59, 59, 59, 59, 59])
    #expect(lo.isFinite && hi.isFinite)
    #expect(lo < hi)
}

@Test func weekBarsHandleEmptyData() {
    let (lo, hi) = weekBarScale(values: [])
    #expect(lo < hi)
}

@Test @MainActor func tileRendersAtAccessibilitySize() {
    #expect(render(NKTile(label: "NYUGALMI PULZUS", value: "57", sub: "heti átlag 59") { StepTrail(progress: 0.6) }
        .dynamicTypeSize(.accessibility3), width: 130, height: 150) != nil)
}

@Test @MainActor func chartsRender() {
    #expect(render(Hypnogram(segments: [(0, 8), (2, 40), (3, 30)]), width: 300, height: 100) != nil)
    #expect(render(GlowLine(points: [0.2, 0.8, 0.4], nowAt: 0.3), width: 300, height: 100) != nil)
    #expect(render(WeekBars(values: [1, 2, 3], average: 2, unit: "p", labels: ["K", "Sze", "Cs"]), width: 300, height: 140) != nil)
    #expect(render(BusyRibbon(slots: Array(repeating: 0.5, count: 72), trainingSlot: 50), width: 300, height: 14) != nil)
}

@Test func weekBarsScaleIgnoresMissingDays() {
    let (lo, hi) = weekBarScale(values: [nil, 60, nil, 58])
    #expect(lo == 58 * 0.85)
    #expect(hi == 60 * 1.04)
    let (lo2, hi2) = weekBarScale(values: [Double?](repeating: nil, count: 7))
    #expect(lo2 < hi2)
}

@Test func weekBarValueLabelSaysDashForAMissingDay() {
    #expect(weekBarValueLabel(96, unit: "p") == "96p")
    #expect(weekBarValueLabel(57.6, unit: "") == "58")
    #expect(weekBarValueLabel(nil, unit: "p") == "–")
}

@Test @MainActor func weekBarsRenderWithMissingDays() {
    #expect(render(WeekBars(values: [72, nil, 80, nil], average: 76, unit: "p", labels: ["K", "Sze", "Cs", "P"]), width: 300, height: 140) != nil)
    #expect(render(WeekBars(values: [Double?](repeating: nil, count: 7), average: nil, unit: "", labels: []), width: 300, height: 140) != nil)
}

@Test func glowLineValueFollowsTheDrawnCurve() {
    let pts = [0.2, 0.8, 0.4]
    #expect(abs(glowLineValue(pts, at: 0) - 0.2) < 1e-9)
    #expect(abs(glowLineValue(pts, at: 1) - 0.8) < 1e-9)
    #expect(abs(glowLineValue(pts, at: 2) - 0.4) < 1e-9)
    #expect(abs(glowLineValue(pts, at: 0.5) - 0.5) < 1e-6)       // symmetric halfway
    // a quarter in, the eased curve is still close to the start (linear would say 0.35)
    #expect(glowLineValue(pts, at: 0.25) < 0.33)
    #expect(abs(glowLineValue(pts, at: 9) - 0.4) < 1e-9)         // clamps to the ends
    #expect(abs(glowLineValue([0.7], at: 3) - 0.7) < 1e-9)
}
