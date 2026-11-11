#if canImport(HealthKit) && os(iOS)
import Foundation
import HealthKit

/// HealthKit reader (read-only), Boop B1 (mezo-r36n9.11): sleep stages, day rollups (statistics
/// collections), anchored reads of workouts and the discrete samples (anchors archived with
/// `NSKeyedArchiver`), heart rate in 5-minute buckets, heart-rate statistics over arbitrary intervals.
///
/// Anchored reads keep the same `from` predicate on every run, so the first (nil-anchor) read is the
/// 60-day backfill and later ones return only what changed. HealthKit reports deletions of matching
/// types by uuid only (`HKDeletedObject`).
public final class HealthKitReader: HealthReader, @unchecked Sendable {
    private let store = HKHealthStore()
    public init() {}

    public static var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private static var perMinute: HKUnit { HKUnit.count().unitDivided(by: .minute()) }

    /// The 23 read types (B1): sleep, activity, heart, breathing, body, mind, workouts.
    public static var readTypes: Set<HKObjectType> {
        let quantities: [HKQuantityTypeIdentifier] = [
            .stepCount, .distanceWalkingRunning, .activeEnergyBurned, .basalEnergyBurned, .appleExerciseTime,
            .timeInDaylight, .heartRate, .restingHeartRate, .walkingHeartRateAverage, .heartRateVariabilitySDNN,
            .heartRateRecoveryOneMinute, .respiratoryRate, .oxygenSaturation, .appleSleepingWristTemperature,
            .vo2Max, .appleSleepingBreathingDisturbances, .bodyMass, .bodyFatPercentage, .leanBodyMass,
        ]
        var types: Set<HKObjectType> = Set(quantities.map { HKQuantityType($0) })
        types.insert(HKCategoryType(.sleepAnalysis))
        types.insert(HKCategoryType(.mindfulSession))
        types.insert(HKObjectType.stateOfMindType())
        types.insert(HKObjectType.workoutType())
        return types
    }

    /// Shows the system Health sheet (only for types not asked before); HealthKit never tells an app
    /// which types were refused.
    public func requestAuthorization() async throws {
        try await store.requestAuthorization(toShare: [], read: Self.readTypes)
    }

    /// True when HealthKit would show its sheet for the read set — i.e. types were added since the user
    /// connected (the sheet then lists only the new ones). False when unavailable or already decided.
    public func needsAuthorizationRequest() async -> Bool {
        guard Self.isAvailable else { return false }
        return (try? await store.statusForAuthorizationRequest(toShare: [], read: Self.readTypes)) == .shouldRequest
    }

    // MARK: - Sleep

    public func sleepSamples(from: Date, to: Date) async throws -> [SleepSample] {
        let query = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: HKCategoryType(.sleepAnalysis),
                                         predicate: HKQuery.predicateForSamples(withStart: from, end: to))],
            sortDescriptors: [SortDescriptor(\.startDate)])
        return try await query.result(for: store).compactMap(Self.sleepSample)
    }

    public func sleepChanges(anchor: Data?, from: Date) async throws -> HealthChange<SleepSample> {
        let r = try await anchored(.categorySample(type: HKCategoryType(.sleepAnalysis), predicate: since(from)), anchor)
        return HealthChange(added: r.added.compactMap(Self.sleepSample), deletedIds: r.deleted, anchor: r.anchor)
    }

    private static func sleepSample(_ s: HKCategorySample) -> SleepSample? {
        guard let stage = stage(s.value) else { return nil }
        return SleepSample(start: s.startDate, end: s.endDate, stage: stage, source: s.sourceRevision.source.name,
                           bundle: s.sourceRevision.source.bundleIdentifier, device: device(s))
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

    private static func device(_ s: HKSample) -> String? {
        s.sourceRevision.productType ?? s.device?.model
    }

    // MARK: - Day rollups

    public func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals] {
        let start = calendar.startOfDay(for: from)
        let pm = Self.perMinute
        func sum(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit) async throws -> [String: Double] {
            try await collect(id, .cumulativeSum, start, to, calendar) { $0.sumQuantity()?.doubleValue(for: unit) }
        }
        func avg(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit) async throws -> [String: Double] {
            try await collect(id, .discreteAverage, start, to, calendar) { $0.averageQuantity()?.doubleValue(for: unit) }
        }
        let steps = try await sum(.stepCount, .count())
        let distance = try await sum(.distanceWalkingRunning, .meter())
        let active = try await sum(.activeEnergyBurned, .kilocalorie())
        let basal = try await sum(.basalEnergyBurned, .kilocalorie())
        let exercise = try await sum(.appleExerciseTime, .minute())
        let daylight = try await sum(.timeInDaylight, .minute())
        let resting = try await avg(.restingHeartRate, pm)
        let walking = try await avg(.walkingHeartRateAverage, pm)
        let hrv = try await avg(.heartRateVariabilitySDNN, .secondUnit(with: .milli))
        let resp = try await avg(.respiratoryRate, pm)
        let spo2 = try await avg(.oxygenSaturation, .percent())
        let wrist = try await avg(.appleSleepingWristTemperature, .degreeCelsius())
        let vo2 = try await collect(.vo2Max, .mostRecent, start, to, calendar) {
            $0.mostRecentQuantity()?.doubleValue(for: HKUnit(from: "ml/kg*min"))
        }
        let hr = try await collectStats(.heartRate, [.discreteAverage, .discreteMin, .discreteMax], start, to, calendar)
        let mindful = try await mindfulMinutes(start, to, calendar)

        var days: [DayTotals] = []
        var day = start
        while day < to {
            let key = dayString(day, calendar)
            let h = hr[key]
            days.append(DayTotals(
                date: key, steps: steps[key]?.asInt, activeKcal: active[key]?.asInt, restingHr: resting[key]?.asInt,
                avgHr: h?.averageQuantity()?.doubleValue(for: pm).asInt,
                minHr: h?.minimumQuantity()?.doubleValue(for: pm).asInt,
                maxHr: h?.maximumQuantity()?.doubleValue(for: pm).asInt,
                distanceM: distance[key]?.asInt, basalKcal: basal[key]?.asInt, exerciseMin: exercise[key]?.asInt,
                walkingHr: walking[key]?.asInt, mindfulMin: mindful[key]?.asInt, daylightMin: daylight[key]?.asInt,
                hrvMs: hrv[key]?.oneDecimal, respRate: resp[key]?.oneDecimal,
                spo2Pct: spo2[key].map(percentFromFraction), wristTempC: wrist[key]?.twoDecimals,
                vo2max: vo2[key]?.oneDecimal))
            day = calendar.date(byAdding: .day, value: 1, to: day)!
        }
        return days
    }

    /// Mindful minutes per start day (category samples have no statistics).
    private func mindfulMinutes(_ start: Date, _ end: Date, _ calendar: Calendar) async throws -> [String: Double] {
        let query = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: HKCategoryType(.mindfulSession),
                                         predicate: HKQuery.predicateForSamples(withStart: start, end: end))],
            sortDescriptors: [])
        var out: [String: Double] = [:]
        for s in try await query.result(for: store) {
            out[dayString(s.startDate, calendar), default: 0] += s.endDate.timeIntervalSince(s.startDate) / 60
        }
        return out
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

    // MARK: - Heart rate

    public func heartRateBuckets(from: Date, to: Date) async throws -> [HeartRateBucket] {
        let anchorDate = Calendar.current.startOfDay(for: from)
        let query = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: HKQuantityType(.heartRate), predicate: HKQuery.predicateForSamples(withStart: from, end: to)),
            options: [.discreteAverage, .discreteMin, .discreteMax], anchorDate: anchorDate,
            intervalComponents: DateComponents(minute: 5))
        let collection = try await query.result(for: store)
        let pm = Self.perMinute
        var out: [HeartRateBucket] = []
        collection.enumerateStatistics(from: from, to: to) { s, _ in
            guard let avg = s.averageQuantity()?.doubleValue(for: pm),
                  let lo = s.minimumQuantity()?.doubleValue(for: pm),
                  let hi = s.maximumQuantity()?.doubleValue(for: pm) else { return }
            out.append(HeartRateBucket(start: s.startDate, end: s.endDate, avg: avg, min: lo, max: hi))
        }
        return out
    }

    public func heartRate(during intervals: [DateInterval]) async throws -> HeartRateStats? {
        guard !intervals.isEmpty else { return nil }
        let parts = intervals.map { HKQuery.predicateForSamples(withStart: $0.start, end: $0.end) }
        let predicate = parts.count == 1 ? parts[0] : NSCompoundPredicate(orPredicateWithSubpredicates: parts)
        let pm = Self.perMinute
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<HeartRateStats?, Error>) in
            let query = HKStatisticsQuery(quantityType: HKQuantityType(.heartRate), quantitySamplePredicate: predicate,
                                          options: [.discreteAverage, .discreteMax]) { _, stats, error in
                if let error {
                    if let hk = error as? HKError, hk.code == .errorNoData { cont.resume(returning: nil) }
                    else { cont.resume(throwing: error) }
                    return
                }
                let avg = stats?.averageQuantity()?.doubleValue(for: pm)
                let max = stats?.maximumQuantity()?.doubleValue(for: pm)
                cont.resume(returning: avg == nil && max == nil ? nil : HeartRateStats(avg: avg, max: max))
            }
            store.execute(query)
        }
    }

    // MARK: - Workouts

    public func workoutChanges(anchor: Data?, from: Date) async throws -> HealthChange<WorkoutSample> {
        let r = try await anchored(.workout(since(from)), anchor)
        let pm = Self.perMinute
        let distanceTypes: [HKQuantityTypeIdentifier] = [.distanceWalkingRunning, .distanceCycling, .distanceSwimming]
        let workouts = r.added.map { w in
            let hr = w.statistics(for: HKQuantityType(.heartRate))
            let distance = distanceTypes.lazy
                .compactMap { w.statistics(for: HKQuantityType($0))?.sumQuantity()?.doubleValue(for: .meter()) }
                .first
            return WorkoutSample(
                uuid: w.uuid, activity: Self.name(w.workoutActivityType), start: w.startDate, end: w.endDate,
                kcal: w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie()).asInt,
                avgHr: hr?.averageQuantity()?.doubleValue(for: pm).asInt,
                source: w.sourceRevision.source.name,
                maxHr: hr?.maximumQuantity()?.doubleValue(for: pm).asInt,
                distanceM: distance?.asInt, bundle: w.sourceRevision.source.bundleIdentifier)
        }
        return HealthChange(added: workouts, deletedIds: r.deleted, anchor: r.anchor)
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

    // MARK: - Discrete samples

    public func sampleChanges(_ metric: HealthMetric, anchor: Data?, from: Date) async throws -> HealthChange<HealthSampleValue> {
        switch metric {
        case .heartRate:
            return HealthChange(added: [], deletedIds: [], anchor: anchor ?? Data())   // buckets, never anchored
        case .mindfulSession:
            let r = try await anchored(.categorySample(type: HKCategoryType(.mindfulSession), predicate: since(from)), anchor)
            let added = r.added.map { s in
                Self.value(s, metric, s.endDate.timeIntervalSince(s.startDate) / 60)
            }
            return HealthChange(added: added, deletedIds: r.deleted, anchor: r.anchor)
        case .stateOfMind:
            let r = try await anchored(.stateOfMind(since(from)), anchor)
            let added = r.added.map { s in
                Self.value(s, metric, s.valence, meta: [
                    "kind": .string(s.kind == .dailyMood ? "daily_mood" : "momentary_emotion"),
                    "labels": .numbers(s.labels.map { Double($0.rawValue) }),
                    "associations": .numbers(s.associations.map { Double($0.rawValue) }),
                ])
            }
            return HealthChange(added: added, deletedIds: r.deleted, anchor: r.anchor)
        default:
            guard let (id, unit) = Self.quantity(metric) else { return HealthChange(added: [], deletedIds: [], anchor: anchor ?? Data()) }
            let r = try await anchored(.quantitySample(type: HKQuantityType(id), predicate: since(from)), anchor)
            let added = r.added.map { s in Self.value(s, metric, s.quantity.doubleValue(for: unit)) }
            return HealthChange(added: added, deletedIds: r.deleted, anchor: r.anchor)
        }
    }

    /// HealthKit type + reading unit of each quantity metric (SpO2 / body fat as a fraction; the
    /// mapper turns those into percent).
    private static func quantity(_ m: HealthMetric) -> (HKQuantityTypeIdentifier, HKUnit)? {
        switch m {
        case .hrvSdnn: (.heartRateVariabilitySDNN, .secondUnit(with: .milli))
        case .respiratoryRate: (.respiratoryRate, perMinute)
        case .oxygenSaturation: (.oxygenSaturation, .percent())
        case .wristTemperature: (.appleSleepingWristTemperature, .degreeCelsius())
        case .vo2max: (.vo2Max, HKUnit(from: "ml/kg*min"))
        case .hrRecovery1min: (.heartRateRecoveryOneMinute, perMinute)
        case .walkingHrAvg: (.walkingHeartRateAverage, perMinute)
        case .bodyMass: (.bodyMass, .gramUnit(with: .kilo))
        case .bodyFatPct: (.bodyFatPercentage, .percent())
        case .leanBodyMass: (.leanBodyMass, .gramUnit(with: .kilo))
        case .sleepingBreathingDisturbances: (.appleSleepingBreathingDisturbances, .count())
        case .heartRate, .mindfulSession, .stateOfMind: nil
        }
    }

    private static func value(_ s: HKSample, _ metric: HealthMetric, _ v: Double, meta: [String: HealthMeta] = [:]) -> HealthSampleValue {
        HealthSampleValue(uuid: s.uuid, metric: metric, start: s.startDate, end: s.endDate, value: v,
                          sourceName: s.sourceRevision.source.name, sourceBundle: s.sourceRevision.source.bundleIdentifier,
                          device: device(s), userEntered: (s.metadata?[HKMetadataKeyWasUserEntered] as? Bool) ?? false,
                          meta: meta)
    }

    // MARK: - Anchored plumbing

    private func since(_ from: Date) -> NSPredicate { HKQuery.predicateForSamples(withStart: from, end: nil) }

    private func anchored<S: HKSample>(_ predicate: HKSamplePredicate<S>, _ anchor: Data?) async throws
        -> (added: [S], deleted: [UUID], anchor: Data) {
        let old = anchor.flatMap { try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: $0) }
        let result = try await HKAnchoredObjectQueryDescriptor(predicates: [predicate], anchor: old).result(for: store)
        let data = try NSKeyedArchiver.archivedData(withRootObject: result.newAnchor, requiringSecureCoding: true)
        return (result.addedSamples, result.deletedObjects.map(\.uuid), data)
    }
}

private extension Double {
    var asInt: Int { Int(rounded()) }
    var oneDecimal: Double { (self * 10).rounded() / 10 }
    var twoDecimals: Double { (self * 100).rounded() / 100 }
}
#endif
