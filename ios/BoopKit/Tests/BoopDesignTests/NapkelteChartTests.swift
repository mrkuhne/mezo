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
