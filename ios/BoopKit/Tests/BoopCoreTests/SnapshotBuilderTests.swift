import Foundation
import Testing
@testable import BoopCore

struct SnapshotBuilderTests {
    let health = FakeHealth()
    /// 2026-11-10 16:02 Budapest (`at(16, 2)` of the shared fixtures).
    let now = at(16, 2)

    func sample(_ metric: HealthMetric, _ value: Double, minutesAgo: Double, bundle: String = "com.apple.health.watch") -> HealthSampleValue {
        let start = now.addingTimeInterval(-minutesAgo * 60)
        return HealthSampleValue(uuid: UUID(), metric: metric, start: start, end: start, value: value,
                                 sourceName: "Watch", sourceBundle: bundle)
    }

    func build() async -> CheckInSnapshotValue {
        await SnapshotBuilder(reader: health).snapshot(at: now, calendar: budapest)
    }

    @Test func hrMeanOfLastFifteenMinutes() async {
        health.samples[.heartRate] = [sample(.heartRate, 90, minutesAgo: 40), sample(.heartRate, 70, minutesAgo: 12),
                                      sample(.heartRate, 80, minutesAgo: 5), sample(.heartRate, 75, minutesAgo: 1)]
        let snap = await build()
        #expect(snap.hrBpm == 75)   // (70 + 80 + 75) / 3; the 40-minute-old sample stays out
        #expect(snap.hrAt == now.addingTimeInterval(-60))
        #expect(snap.source == "com.apple.health.watch")
    }

    @Test func hrFallsBackToLatestWithinHour() async {
        health.samples[.heartRate] = [sample(.heartRate, 90, minutesAgo: 50), sample(.heartRate, 66, minutesAgo: 30)]
        let snap = await build()
        #expect(snap.hrBpm == 66)
        #expect(snap.hrAt == now.addingTimeInterval(-30 * 60))
    }

    @Test func hrOlderThanAnHourIsNull() async {
        health.samples[.heartRate] = [sample(.heartRate, 66, minutesAgo: 90)]
        let snap = await build()
        #expect(snap.hrBpm == nil && snap.hrAt == nil)
    }

    @Test func hrvUsualIsFourteenDayMedian() async {
        // Latest within 8 h is 38; the 14-day set (incl. the latest) is 30, 38, 44, 50, 80 → median 44.
        health.samples[.hrvSdnn] = [sample(.hrvSdnn, 80, minutesAgo: 60 * 24 * 12), sample(.hrvSdnn, 30, minutesAgo: 60 * 24 * 9),
                                    sample(.hrvSdnn, 50, minutesAgo: 60 * 24 * 3), sample(.hrvSdnn, 44, minutesAgo: 60 * 20),
                                    sample(.hrvSdnn, 38, minutesAgo: 90)]
        let snap = await build()
        #expect(snap.hrvMs == 38)
        #expect(snap.hrvAt == now.addingTimeInterval(-90 * 60))
        #expect(snap.hrvUsualMs == 44)
    }

    @Test func hrvOlderThanEightHoursKeepsOnlyUsual() async {
        health.samples[.hrvSdnn] = [sample(.hrvSdnn, 40, minutesAgo: 60 * 10), sample(.hrvSdnn, 50, minutesAgo: 60 * 30)]
        let snap = await build()
        #expect(snap.hrvMs == nil && snap.hrvAt == nil)
        #expect(snap.hrvUsualMs == 45)   // median of an even set = mean of the middle two
    }

    @Test func stepsAndSleepOfToday() async {
        health.days = [DayTotals(date: "2026-11-10", steps: 7420)]
        health.nights = [
            SleepSample(start: at(23, 40).addingTimeInterval(-86400), end: at(6, 20), stage: .core, source: "Watch",
                        bundle: "com.apple.health.watch"),
        ]
        let snap = await build()
        #expect(snap.steps == 7420)
        #expect(snap.sleepMinutes == 400)   // 23:40 → 06:20
    }

    @Test func emptyHealthGivesNullSnapshot() async {
        let snap = await build()
        #expect(snap.isEmpty)
        #expect(snap == CheckInSnapshotValue())
    }
}
