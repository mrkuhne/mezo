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

    // MARK: - B1: night source priority (Apple Watch → ring → Sleep Cycle → other; tie → most staged)

    func src(_ start: Date, _ parts: [(Int, SleepSample.Stage)], source: String, bundle: String, device: String? = nil) -> [SleepSample] {
        blocks(start, parts, source: source).map {
            SleepSample(start: $0.start, end: $0.end, stage: $0.stage, source: source, bundle: bundle, device: device)
        }
    }

    @Test func appleWatchBeatsSleepCycleEvenWithFewerStages() {
        let watch = src(at(8, 23, 10), [(40, .deep), (300, .core)], source: "Kuhne Apple Watch-ja",
                        bundle: "com.apple.health.4C1B", device: "Watch7,1")
        let cycle = src(at(8, 23, 0), [(90, .deep), (300, .core), (60, .rem)], source: "Sleep Cycle",
                        bundle: "com.lexwarelabs.goodmorning")
        let n = buildNights(cycle + watch, calendar: cal)
        #expect(n.count == 1)
        #expect(n[0].sourceApp == "Kuhne Apple Watch-ja")
        #expect(n[0].deepMin == 40)
    }

    @Test func iPhoneWrittenAppleNightIsNotAWatch() {
        let phone = src(at(8, 23, 10), [(40, .deep), (300, .core)], source: "iPhone", bundle: "com.apple.health.77", device: "iPhone17,2")
        let cycle = src(at(8, 23, 0), [(90, .deep), (300, .core)], source: "Sleep Cycle", bundle: "com.lexwarelabs.goodmorning")
        #expect(buildNights(phone + cycle, calendar: cal)[0].sourceApp == "Sleep Cycle")
    }

    @Test func ringBeatsSleepCycle() {
        let oura = src(at(8, 23, 10), [(30, .deep), (300, .core)], source: "Oura", bundle: "com.ouraring.oura")
        let cycle = src(at(8, 23, 0), [(90, .deep), (300, .core)], source: "Sleep Cycle", bundle: "com.lexwarelabs.goodmorning")
        #expect(buildNights(cycle + oura, calendar: cal)[0].sourceApp == "Oura")
    }

    @Test func sleepCycleBeatsAnyOtherApp() {
        let other = src(at(8, 23, 10), [(120, .deep), (300, .core)], source: "Huawei Health", bundle: "com.huawei.iossporthealth")
        let cycle = src(at(8, 23, 0), [(30, .deep), (300, .core)], source: "Sleep Cycle", bundle: "com.lexwarelabs.goodmorning")
        #expect(buildNights(other + cycle, calendar: cal)[0].sourceApp == "Sleep Cycle")
    }

    @Test func equalSourcesTieBreakOnStagedMinutes() {
        let a = src(at(8, 23, 10), [(30, .deep), (300, .core)], source: "Huawei Health", bundle: "com.huawei.iossporthealth")
        let b = src(at(8, 23, 0), [(60, .deep), (300, .core)], source: "Zepp", bundle: "com.huami.watch")
        #expect(buildNights(a + b, calendar: cal)[0].sourceApp == "Zepp")
    }

    @Test func draftCarriesMergedAsleepIntervals() {
        let parts = blocks(at(8, 23, 0), [(60, .core), (20, .awake), (60, .deep), (30, .rem)])
        let d = buildNightDrafts(parts, calendar: cal)
        #expect(d.count == 1)
        #expect(d[0].asleep == [DateInterval(start: at(8, 23, 0), end: at(9, 0, 0)),
                                DateInterval(start: at(9, 0, 20), end: at(9, 1, 50))])
        #expect(d[0].night.sleepingHr == nil)
    }

    // MARK: - B1: samples, units, buckets, days

    func sample(_ m: HealthMetric, _ v: Double, meta: [String: HealthMeta] = [:]) -> HealthSampleValue {
        HealthSampleValue(uuid: UUID(uuidString: "6A1F0C2E-0000-4000-8000-000000000001")!, metric: m, start: at(9, 6, 0),
                          end: at(9, 6, 0), value: v, sourceName: "Apple Watch", sourceBundle: "com.apple.health.1",
                          device: "Watch7,1", userEntered: false, meta: meta)
    }

    @Test func fractionsBecomePercent() {
        let spo2 = mapSample(sample(.oxygenSaturation, 0.97))
        #expect(spo2.value == 97)
        #expect(spo2.unit == "%")
        #expect(mapSample(sample(.bodyFatPct, 0.215)).value == 21.5)
        #expect(percentFromFraction(0.963) == 96.3)
    }

    @Test func sampleUnitsAndKeys() {
        let s = mapSample(sample(.hrvSdnn, 48.2))
        #expect(s.externalId == "6a1f0c2e-0000-4000-8000-000000000001")
        #expect(s.metric.rawValue == "hrv_sdnn")
        #expect(s.value == 48.2)
        #expect(s.unit == "ms")
        #expect(mapSample(sample(.bodyMass, 82.4)).unit == "kg")
        #expect(mapSample(sample(.vo2max, 41)).unit == "ml/kg/min")
        #expect(mapSample(sample(.wristTemperature, 35.9)).unit == "degC")
        #expect(mapSample(sample(.respiratoryRate, 14)).unit == "count/min")
        #expect(HealthMetric.allCases.allSatisfy { $0.wireUnit.count <= 16 })
        #expect(!HealthMetric.anchored.contains(.heartRate))
    }

    @Test func stateOfMindMetaTravels() throws {
        let s = mapSample(sample(.stateOfMind, -0.4, meta: ["kind": .string("daily_mood"), "labels": .numbers([3, 7])]))
        let meta = try #require(s.meta)
        #expect(meta.additionalProperties.value["kind"] as? String == "daily_mood")
        #expect(s.value == -0.4)
    }

    @Test func heartRateBucketMapping() throws {
        let b = HeartRateBucket(start: at(9, 5, 0), end: at(9, 5, 5), avg: 62.46, min: 55, max: 71)
        let s = mapBucket(b)
        #expect(s.externalId == "hr-\(Int(at(9, 5, 0).timeIntervalSince1970))")
        #expect(s.metric.rawValue == "heart_rate")
        #expect(s.value == 62.5)
        #expect(s.unit == "count/min")
        let meta = try #require(s.meta)
        #expect(meta.additionalProperties.value["min"] as? Double == 55)
        #expect(meta.additionalProperties.value["max"] as? Double == 71)
    }

    @Test func fullDayRowCarriesTheNewFields() {
        let d = mapDays([DayTotals(date: "2026-11-09", distanceM: 5400, basalKcal: 1700, exerciseMin: 32, walkingHr: 98,
                                   mindfulMin: 10, daylightMin: 45, hrvMs: 51.3, respRate: 14.2, spo2Pct: 96.5,
                                   wristTempC: -0.21, vo2max: 41.8)])
        #expect(d.count == 1)
        #expect(d[0].distanceM == 5400 && d[0].basalKcal == 1700 && d[0].exerciseMin == 32)
        #expect(d[0].hrvMs == 51.3 && d[0].spo2Pct == 96.5 && d[0].vo2max == 41.8 && d[0].wristTempC == -0.21)
        #expect(d[0].walkingHr == 98 && d[0].mindfulMin == 10 && d[0].daylightMin == 45 && d[0].respRate == 14.2)
        #expect(mapDays([DayTotals(date: "2026-11-08", hrvMs: 40)]).count == 1)     // one rollup is enough to send the day
    }

    @Test func workoutCarriesDistanceMaxHrAndBundle() {
        let w = WorkoutSample(uuid: UUID(), activity: "running", start: at(9, 18, 0), end: at(9, 18, 30), kcal: 250, avgHr: 150,
                              source: "Apple Watch", maxHr: 176, distanceM: 5100, bundle: "com.apple.health.9")
        let m = mapWorkout(w)
        #expect(m.maxHr == 176 && m.distanceM == 5100 && m.sourceBundle == "com.apple.health.9")
    }
}
