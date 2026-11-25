import Foundation
import Testing
@testable import BoopCore

/// The Súly room's pure builders (`mezo-r36n9.158`): the weigh-ins by week, the curve, the body numbers.
@Suite("Súly — the rows")
struct SulyRowsTests {
    static let cal: Calendar = {
        var c = Calendar(identifier: .gregorian); c.firstWeekday = 2; c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()

    private func log(_ date: String, _ kg: Double, id: String? = nil) -> SulyLog { SulyLog(id: id ?? date, date: date, kg: kg) }

    // 2026-11-24 is a Tuesday; the week runs Mon 23 → Sun 29.
    @Test func weeksGroupMondayFirst() {
        let logs = [log("2026-11-10", 85.6), log("2026-11-13", 85.3), log("2026-11-17", 85.1), log("2026-11-23", 84.9), log("2026-11-24", 84.6)]
        let weeks = sulyWeeks(logs, today: "2026-11-24", calendar: Self.cal)
        #expect(weeks.map(\.label) == ["EZ A HÉT", "MÚLT HÉT", "NOV. 9–15."])
        #expect(weeks[0].logs.map(\.kg) == [84.6, 84.9])          // newest first inside a week
        #expect(weeks[0].averageKg == 84.75 && weeks[2].averageKg == 85.45)
        #expect(weeks[1].logs.count == 1)
    }

    @Test func weeksSkipEmptyWeeksAndStopAtTwelve() {
        let logs = [log("2026-11-24", 84.6), log("2026-08-01", 88.0)]
        let weeks = sulyWeeks(logs, today: "2026-11-24", calendar: Self.cal)
        #expect(weeks.count == 1 && weeks[0].label == "EZ A HÉT")
        #expect(sulyWeeks([], today: "2026-11-24", calendar: Self.cal).isEmpty)
    }

    @Test func logTitleIsTheWeekday() {
        #expect(sulyLogTitle(log("2026-11-24", 84.6), calendar: Self.cal) == "Kedd")
        #expect(sulyLogTitle(log("2026-11-22", 84.6), calendar: Self.cal) == "Vasárnap")
        #expect(sulyLogTitle(log("bad", 84.6), calendar: Self.cal) == "bad")
    }

    @Test func curvePrefersTheSeason() throws {
        let season = EvadFixtures.overview()   // series 86.9, 84.1 · projection 83.7, 82.0 · target 82
        let c = try #require(sulyCurve(season, trend: nil))
        #expect(c.values == [86.9, 84.1, 83.7, 82.0])
        #expect(c.now == 1 && c.target == 82)
        #expect(c.labels.count == 4 && c.labels.first == "1." && c.labels.last == "12.")
    }

    @Test func curveFallsBackToTheTrend() throws {
        let points = (0..<10).map { SulyTrendPoint(date: "2026-11-\(10 + $0)", trendKg: 85.0 - Double($0) * 0.05) }
        let trend = SulyTrend(ewmaSeries: points, latestTrendKg: 84.55, weeklyRateKgPerWeek: -0.35, weeklyRatePctPerWeek: nil,
                              last4wRateKgPerWeek: -0.4, dataSufficiency: "full")
        let c = try #require(sulyCurve(nil, trend: trend))
        #expect(c.values.count == 10 && c.now == 9 && c.target == nil)
        #expect(sulyCurve(nil, trend: nil) == nil)
        #expect(sulyCurve(nil, trend: SulyTrend(ewmaSeries: [points[0]], latestTrendKg: 85, weeklyRateKgPerWeek: nil,
                                                 weeklyRatePctPerWeek: nil, last4wRateKgPerWeek: nil, dataSufficiency: "provisional")) == nil)
    }

    @Test func bmiNeedsBoth() {
        #expect(sulyBmi(kg: 84.6, heightCm: 180) == 26.1)
        #expect(sulyBmi(kg: nil, heightCm: 180) == nil)
        #expect(sulyBmi(kg: 84.6, heightCm: 0) == nil)
    }

    @Test func latestBodyValueIsRecentOnly() {
        let now = Date(timeIntervalSince1970: 1_795_089_600)
        let old = SulyBodySample(date: now.addingTimeInterval(-40 * 86_400), value: 22.1, source: "Feelfit")
        let fresh = SulyBodySample(date: now.addingTimeInterval(-2 * 86_400), value: 21.4, source: "Feelfit")
        #expect(sulyLatest([old, fresh], now: now) == 21.4)
        #expect(sulyLatest([old], now: now) == nil)
        #expect(sulyLatest([], now: now) == nil)
    }

    @Test func thisWeeksLogsAndTodays() {
        let logs = [log("2026-11-17", 85.1), log("2026-11-23", 84.9), log("2026-11-24", 84.6)]
        #expect(sulyThisWeek(logs, today: "2026-11-24", calendar: Self.cal).map(\.kg) == [84.6, 84.9])
        #expect(sulyToday(logs, today: "2026-11-24")?.kg == 84.6)
        #expect(sulyToday(logs, today: "2026-11-25") == nil)
    }
}
