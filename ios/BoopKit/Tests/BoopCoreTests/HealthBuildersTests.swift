import Foundation
import Testing
@testable import BoopCore

struct HealthBuildersTests {
    var cal: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c }
    func at(_ d: Int, _ h: Int, _ m: Int, month: Int = 11) -> Date {
        cal.date(from: DateComponents(year: 2026, month: month, day: d, hour: h, minute: m))!
    }
    func s(_ a: Date, _ minutes: Int, _ stage: SleepSample.Stage, _ source: String = "Sleep Cycle") -> SleepSample {
        SleepSample(start: a, end: a.addingTimeInterval(Double(minutes) * 60), stage: stage, source: source)
    }
    /// Consecutive stage blocks starting at `start`.
    func blocks(_ start: Date, _ parts: [(Int, SleepSample.Stage)], source: String = "Sleep Cycle") -> [SleepSample] {
        var t = start, out: [SleepSample] = []
        for (m, st) in parts { out.append(s(t, m, st, source)); t = t.addingTimeInterval(Double(m) * 60) }
        return out
    }

    @Test func nightAcrossMidnightLandsOnWakeDay() {
        let n = buildNights(blocks(at(8, 23, 40), [(430, .core)]), calendar: cal)
        #expect(n.count == 1)
        #expect(n[0].date == "2026-11-09")
        #expect(n[0].bedtime == "23:40")
        #expect(n[0].wakeup == "06:50")
    }

    @Test func stageMinutesAndDuration() {
        let n = buildNights(blocks(at(8, 23, 0), [(84, .deep), (11, .awake), (98, .rem), (11, .awake), (228, .core)]), calendar: cal)
        #expect(n.count == 1)
        #expect(n[0].deepMin == 84)
        #expect(n[0].remMin == 98)
        #expect(n[0].lightMin == 228)
        #expect(n[0].awakeMin == 22)
        #expect(n[0].durationH == 6.83)
    }

    @Test func hypnogramLettersFollowStages() {
        let n = buildNights(blocks(at(8, 23, 0), [(30, .core), (10, .deep)]), calendar: cal)
        #expect(n[0].hypnogram?.bucketMin == 5)
        #expect(n[0].hypnogram?.stages == "LLLLLLDD")
    }

    @Test func afternoonNapIsNotANight() {
        #expect(buildNights(blocks(at(9, 15, 0), [(40, .core)]), calendar: cal).isEmpty)
    }

    @Test func stagedSourceWinsOverUnstaged() {
        let staged = blocks(at(8, 23, 0), [(60, .deep), (300, .core), (60, .rem)], source: "Sleep Cycle")
        let plain = blocks(at(8, 22, 50), [(440, .asleepUnspecified)], source: "Óra")
        let n = buildNights(plain + staged, calendar: cal)
        #expect(n.count == 1)
        #expect(n[0].deepMin == 60)
        #expect(n[0].remMin == 60)
    }

    @Test func externalIdIsStablePerNight() {
        let input = blocks(at(8, 23, 40), [(430, .core)])
        #expect(buildNights(input, calendar: cal)[0].externalId == buildNights(input, calendar: cal)[0].externalId)
        #expect(buildNights(input, calendar: cal)[0].externalId == "hk-night-2026-11-09")
    }

    @Test func workoutTypeMapping() {
        func w(_ a: String) -> WorkoutSample { WorkoutSample(uuid: UUID(), activity: a, start: at(9, 18, 0), end: at(9, 19, 0), kcal: 480, avgHr: 128, source: "Huawei Health") }
        #expect(mapWorkout(w("traditionalStrengthTraining")).activityType == "strength")
        #expect(mapWorkout(w("running")).activityType == "running")
        #expect(mapWorkout(w("archery")).activityType == "other")
        #expect(mapWorkout(w("running")).externalId.hasPrefix("hk-"))
    }

    @Test func emptyDaysAreDropped() {
        let days = mapDays([DayTotals(date: "2026-11-08"), DayTotals(date: "2026-11-09", steps: 6000, restingHr: 57)])
        #expect(days.map(\.date) == ["2026-11-09"])
        #expect(days[0].steps == 6000)
    }
}
