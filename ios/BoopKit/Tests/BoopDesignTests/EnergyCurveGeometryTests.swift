import Foundation
import Testing
import SwiftUI
@testable import BoopDesign

/// The energy-of-the-day curve's geometry (B3 Task 8): 06:00 → 24:00 across the width, levels up the height.
struct EnergyCurveGeometryTests {
    private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()

    @Test func dotsMapHoursSixToTwentyFour() {
        let w: CGFloat = 360
        #expect(EnergyCurveGeometry.x(hour: 6, width: w) == 0)
        #expect(EnergyCurveGeometry.x(hour: 24, width: w) == w)
        #expect(EnergyCurveGeometry.x(hour: 15, width: w) == w / 2)
        // outside the day's span the dot stays on the edge instead of leaving the card
        #expect(EnergyCurveGeometry.x(hour: 5, width: w) == 0)
        #expect(EnergyCurveGeometry.x(hour: 25, width: w) == w)
    }

    @Test func levelsMapUpTheHeight() {
        let h: CGFloat = 132
        #expect(EnergyCurveGeometry.y(level: 0, height: h) == h)
        // a full 10 sits just under the top edge (room for the dot)
        #expect(EnergyCurveGeometry.y(level: 1, height: h) == 10)
        #expect(EnergyCurveGeometry.y(level: 0.5, height: h) == h - 0.5 * (h - 10))
        #expect(EnergyCurveGeometry.y(level: 2, height: h) == 10)
    }

    @Test func captureTimeBecomesFractionalHour() {
        let d = Self.budapest.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: 16, minute: 3))!
        #expect(abs(EnergyCurveGeometry.hour(of: d, calendar: Self.budapest) - 16.05) < 0.0001)
    }

    @Test func predictionInterpolatesBetweenHours() {
        let hourly = (0...18).map { Double($0) / 18 }   // 06:00 → 0, 24:00 → 1
        #expect(EnergyCurveGeometry.predicted(hourly, at: 6) == 0)
        #expect(abs((EnergyCurveGeometry.predicted(hourly, at: 15.5) ?? 0) - 9.5 / 18) < 0.0001)
        #expect(abs((EnergyCurveGeometry.predicted(hourly, at: 24) ?? 0) - 1) < 0.0001)
        #expect(EnergyCurveGeometry.predicted([], at: 12) == nil)
    }

    @Test func hrvBelowUsualReadsLower() {
        #expect(snapshotHrvLabel(hrv: 38, usual: 50) == "HRV · lejjebb")
        #expect(snapshotHrvLabel(hrv: 52, usual: 50) == "HRV")
        #expect(snapshotHrvLabel(hrv: 38, usual: nil) == "HRV")
        #expect(snapshotSleep(minutes: 432) == "7ó 12p")
        #expect(snapshotSleep(minutes: nil) == "—")
    }
}

@Test @MainActor func ritmusPartsRenderAtAccessibilitySize() {
    let dots = [EnergyCurveDot(id: UUID(), hour: 7.3, energy: 7, pending: false),
                EnergyCurveDot(id: UUID(), hour: 16, energy: 5, pending: true)]
    #expect(render(EnergyCurveCard(title: "AZ ENERGIÁD MA", predicted: Array(repeating: 0.6, count: 19), dots: dots, now: 16.05,
                                   selected: .constant(dots[1].id)).dynamicTypeSize(.accessibility3), width: 360, height: 260) != nil)
    #expect(render(CheckInDetail(heading: "DÉLUTÁN · 16:02", pending: true,
                                 answers: [.init(label: "Energia", value: "5"), .init(label: "Hangulat", value: nil)],
                                 note: "Leeresztettem.", snapshot: CheckInSnapshotFigures(hr: 78))
        .dynamicTypeSize(.accessibility3), width: 360, height: 360) != nil)
    #expect(render(OfflineChip().dynamicTypeSize(.accessibility3), width: 360, height: 80) != nil)
    #expect(render(VoiceRecorderRow(phase: .idle, prompt: "Mondj hozzá egy mondatot", onMic: {}, onTyped: { _ in }), width: 360, height: 160) != nil)
    #expect(render(VoiceRecorderRow(phase: .saved(text: nil, typed: false), prompt: "x", onMic: {}, onTyped: { _ in }), width: 360, height: 160) != nil)
    #expect(render(LevelRow(palette: Hue.mozgas.orb, value: 4, motion: OrbMotion(), onPick: { _ in }), width: 360, height: 60) != nil)
}
