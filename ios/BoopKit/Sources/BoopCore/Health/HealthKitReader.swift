#if canImport(HealthKit) && os(iOS)
import Foundation
import HealthKit

/// HealthKit reader (read-only): sleep stages, steps, active energy, heart rate, resting heart rate,
/// workouts. On a free team background delivery is not relied on — Boop reads when it opens.
public final class HealthKitReader: HealthReader, @unchecked Sendable {
    private let store = HKHealthStore()
    public init() {}

    public static var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private var readTypes: Set<HKObjectType> {
        [HKCategoryType(.sleepAnalysis), HKQuantityType(.stepCount), HKQuantityType(.activeEnergyBurned),
         HKQuantityType(.heartRate), HKQuantityType(.restingHeartRate), HKObjectType.workoutType()]
    }

    /// Shows the system Health sheet once; HealthKit never tells an app which types were refused.
    public func requestAuthorization() async throws {
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    public func sleepSamples(from: Date, to: Date) async throws -> [SleepSample] {
        let query = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: HKCategoryType(.sleepAnalysis),
                                         predicate: HKQuery.predicateForSamples(withStart: from, end: to))],
            sortDescriptors: [SortDescriptor(\.startDate)])
        return try await query.result(for: store).compactMap { s in
            guard let stage = Self.stage(s.value) else { return nil }
            return SleepSample(start: s.startDate, end: s.endDate, stage: stage, source: s.sourceRevision.source.name)
        }
    }

    private static func stage(_ raw: Int) -> SleepSample.Stage? {
        switch HKCategoryValueSleepAnalysis(rawValue: raw) {
        case .inBed: .inBed
        case .awake: .awake
        case .asleepCore: .core
        case .asleepDeep: .deep
        case .asleepREM: .rem
        case .asleepUnspecified: .asleepUnspecified
        default: nil
        }
    }

    public func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals] {
        let start = calendar.startOfDay(for: from)
        let perMinute = HKUnit.count().unitDivided(by: .minute())
        let steps = try await collect(.stepCount, .cumulativeSum, start, to, calendar) { $0.sumQuantity()?.doubleValue(for: .count()) }
        let kcal = try await collect(.activeEnergyBurned, .cumulativeSum, start, to, calendar) { $0.sumQuantity()?.doubleValue(for: .kilocalorie()) }
        let resting = try await collect(.restingHeartRate, .discreteAverage, start, to, calendar) { $0.averageQuantity()?.doubleValue(for: perMinute) }
        let hr = try await collectStats(.heartRate, [.discreteAverage, .discreteMin, .discreteMax], start, to, calendar)
        var days: [DayTotals] = []
        var day = start
        while day < to {
            let key = dayString(day, calendar)
            let h = hr[key]
            days.append(DayTotals(
                date: key, steps: steps[key].map { Int($0.rounded()) }, activeKcal: kcal[key].map { Int($0.rounded()) },
                restingHr: resting[key].map { Int($0.rounded()) },
                avgHr: h?.averageQuantity()?.doubleValue(for: perMinute).rounded().asInt,
                minHr: h?.minimumQuantity()?.doubleValue(for: perMinute).rounded().asInt,
                maxHr: h?.maximumQuantity()?.doubleValue(for: perMinute).rounded().asInt))
            day = calendar.date(byAdding: .day, value: 1, to: day)!
        }
        return days
    }

    private func collectStats(_ id: HKQuantityTypeIdentifier, _ options: HKStatisticsOptions, _ start: Date, _ end: Date,
                              _ calendar: Calendar) async throws -> [String: HKStatistics] {
        let query = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: HKQuantityType(id), predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: options, anchorDate: start, intervalComponents: DateComponents(day: 1))
        let collection = try await query.result(for: store)
        var out: [String: HKStatistics] = [:]
        collection.enumerateStatistics(from: start, to: end) { stats, _ in out[dayString(stats.startDate, calendar)] = stats }
        return out
    }

    private func collect(_ id: HKQuantityTypeIdentifier, _ options: HKStatisticsOptions, _ start: Date, _ end: Date,
                         _ calendar: Calendar, _ value: (HKStatistics) -> Double?) async throws -> [String: Double] {
        try await collectStats(id, options, start, end, calendar).compactMapValues(value)
    }

    public func workouts(from: Date, to: Date) async throws -> [WorkoutSample] {
        let query = HKSampleQueryDescriptor(
            predicates: [.workout(HKQuery.predicateForSamples(withStart: from, end: to))],
            sortDescriptors: [SortDescriptor(\.startDate)])
        let perMinute = HKUnit.count().unitDivided(by: .minute())
        return try await query.result(for: store).map { w in
            WorkoutSample(
                uuid: w.uuid, activity: Self.name(w.workoutActivityType), start: w.startDate, end: w.endDate,
                kcal: w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie()).rounded().asInt,
                avgHr: w.statistics(for: HKQuantityType(.heartRate))?.averageQuantity()?.doubleValue(for: perMinute).rounded().asInt,
                source: w.sourceRevision.source.name)
        }
    }

    private static func name(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .traditionalStrengthTraining: "traditionalStrengthTraining"
        case .functionalStrengthTraining: "functionalStrengthTraining"
        case .running: "running"
        case .walking: "walking"
        case .cycling: "cycling"
        case .volleyball: "volleyball"
        case .highIntensityIntervalTraining: "highIntensityIntervalTraining"
        case .yoga: "yoga"
        default: "other"
        }
    }
}

private extension Double {
    var asInt: Int { Int(self) }
}
#endif
