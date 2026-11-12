import Foundation

/// One Apple Health sleep-analysis sample, reduced to what Boop needs.
///
/// `bundle` is the writer's bundle id (`com.apple.health.<uuid>` for Apple's own, Watch included);
/// `device` is the recording device's product type or model (e.g. `Watch7,1`, `iPhone17,2`), when known.
/// Both feed the night source priority (`buildNightDrafts`).
public struct SleepSample: Sendable, Equatable {
    public enum Stage: Sendable, Equatable { case inBed, awake, core, deep, rem, asleepUnspecified }
    public let start: Date
    public let end: Date
    public let stage: Stage
    public let source: String
    public let bundle: String
    public let device: String?
    public init(start: Date, end: Date, stage: Stage, source: String, bundle: String = "", device: String? = nil) {
        self.start = start; self.end = end; self.stage = stage; self.source = source
        self.bundle = bundle; self.device = device
    }
}

/// Apple Health totals of one local day — the full `daily_metric` row (the server overwrites every
/// column, so a day is always sent whole). Wire units: distance m, energy kcal, minutes, HRV ms,
/// rates count/min, SpO2 percent 0–100, wrist temperature °C, VO2max ml/(kg·min).
public struct DayTotals: Sendable, Equatable {
    public let date: String
    public var steps, activeKcal, restingHr, avgHr, minHr, maxHr: Int?
    public var distanceM, basalKcal, exerciseMin, walkingHr, mindfulMin, daylightMin: Int?
    public var hrvMs, respRate, spo2Pct, wristTempC, vo2max: Double?
    public init(date: String, steps: Int? = nil, activeKcal: Int? = nil, restingHr: Int? = nil,
                avgHr: Int? = nil, minHr: Int? = nil, maxHr: Int? = nil,
                distanceM: Int? = nil, basalKcal: Int? = nil, exerciseMin: Int? = nil, walkingHr: Int? = nil,
                mindfulMin: Int? = nil, daylightMin: Int? = nil, hrvMs: Double? = nil, respRate: Double? = nil,
                spo2Pct: Double? = nil, wristTempC: Double? = nil, vo2max: Double? = nil) {
        self.date = date; self.steps = steps; self.activeKcal = activeKcal; self.restingHr = restingHr
        self.avgHr = avgHr; self.minHr = minHr; self.maxHr = maxHr
        self.distanceM = distanceM; self.basalKcal = basalKcal; self.exerciseMin = exerciseMin
        self.walkingHr = walkingHr; self.mindfulMin = mindfulMin; self.daylightMin = daylightMin
        self.hrvMs = hrvMs; self.respRate = respRate; self.spo2Pct = spo2Pct; self.wristTempC = wristTempC
        self.vo2max = vo2max
    }

    /// True when Health gave nothing for this day (it is then not sent).
    var isEmpty: Bool {
        let ints: [Int?] = [steps, activeKcal, restingHr, avgHr, minHr, maxHr, distanceM, basalKcal, exerciseMin,
                            walkingHr, mindfulMin, daylightMin]
        let doubles: [Double?] = [hrvMs, respRate, spo2Pct, wristTempC, vo2max]
        return !ints.contains { $0 != nil } && !doubles.contains { $0 != nil }
    }
}

/// One Apple Health workout; `activity` is the HKWorkoutActivityType case name. `avgHr`/`maxHr` are
/// what the writer attached (Huawei attaches none — `HealthSync` then asks Health for the heart rate
/// over the workout's time range).
public struct WorkoutSample: Sendable, Equatable {
    public let uuid: UUID
    public let activity: String
    public let start: Date
    public let end: Date
    public let kcal: Int?
    public var avgHr: Int?
    public var maxHr: Int?
    public let distanceM: Int?
    public let source: String
    public let bundle: String
    public init(uuid: UUID, activity: String, start: Date, end: Date, kcal: Int?, avgHr: Int?, source: String,
                maxHr: Int? = nil, distanceM: Int? = nil, bundle: String = "") {
        self.uuid = uuid; self.activity = activity; self.start = start; self.end = end
        self.kcal = kcal; self.avgHr = avgHr; self.source = source
        self.maxHr = maxHr; self.distanceM = distanceM; self.bundle = bundle
    }
}

/// The per-sample metrics Boop keeps with provenance (`health_sample.metric`). `heartRate` is never
/// sent raw: it travels as 5-minute buckets (`HeartRateBucket`).
public enum HealthMetric: String, CaseIterable, Sendable {
    case heartRate = "heart_rate"
    case hrvSdnn = "hrv_sdnn"
    case respiratoryRate = "respiratory_rate"
    case oxygenSaturation = "oxygen_saturation"
    case wristTemperature = "wrist_temperature"
    case vo2max = "vo2max"
    case hrRecovery1min = "hr_recovery_1min"
    case walkingHrAvg = "walking_hr_avg"
    case bodyMass = "body_mass"
    case bodyFatPct = "body_fat_pct"
    case leanBodyMass = "lean_body_mass"
    case mindfulSession = "mindful_session"
    case stateOfMind = "state_of_mind"
    case sleepingBreathingDisturbances = "sleeping_breathing_disturbances"

    /// The metrics read sample by sample through anchored queries (everything but heart rate).
    public static var anchored: [HealthMetric] { allCases.filter { $0 != .heartRate } }

    /// The unit the server stores (≤ 16 characters).
    public var wireUnit: String {
        switch self {
        case .heartRate, .respiratoryRate, .hrRecovery1min, .walkingHrAvg: "count/min"
        case .hrvSdnn: "ms"
        case .oxygenSaturation, .bodyFatPct: "%"
        case .wristTemperature: "degC"
        case .vo2max: "ml/kg/min"
        case .bodyMass, .leanBodyMass: "kg"
        case .mindfulSession: "min"
        case .stateOfMind: "valence"
        case .sleepingBreathingDisturbances: "count"
        }
    }

    /// Reader value → wire value. The reader reports each metric in its HealthKit unit
    /// (SpO2 and body fat as a fraction 0–1 of `HKUnit.percent()`); the wire wants percent 0–100.
    public func wireValue(_ raw: Double) -> Double {
        switch self {
        case .oxygenSaturation, .bodyFatPct: percentFromFraction(raw)
        default: raw
        }
    }
}

/// HealthKit percent (fraction 0–1) → percent 0–100, rounded to 2 decimals (0.97 → 97, not 97.00000000000001).
public func percentFromFraction(_ fraction: Double) -> Double {
    (fraction * 100 * 100).rounded() / 100
}

/// One free-form `meta` value of a sample (the contract's open object).
public enum HealthMeta: Sendable, Equatable {
    case string(String), number(Double), strings([String]), numbers([Double])
}

/// One discrete Apple Health sample with provenance. `value` is in the metric's HealthKit unit
/// (see `HealthMetric.wireValue`); mindful sessions carry their duration in minutes, State of Mind its
/// valence (−1…1) with `meta` {kind, labels, associations}.
public struct HealthSampleValue: Sendable, Equatable {
    public let uuid: UUID
    public let metric: HealthMetric
    public let start: Date
    public let end: Date
    public let value: Double
    public let sourceName: String
    public let sourceBundle: String
    public let device: String?
    public let userEntered: Bool
    public let meta: [String: HealthMeta]
    public init(uuid: UUID, metric: HealthMetric, start: Date, end: Date, value: Double, sourceName: String,
                sourceBundle: String = "", device: String? = nil, userEntered: Bool = false, meta: [String: HealthMeta] = [:]) {
        self.uuid = uuid; self.metric = metric; self.start = start; self.end = end; self.value = value
        self.sourceName = sourceName; self.sourceBundle = sourceBundle; self.device = device
        self.userEntered = userEntered; self.meta = meta
    }
}

/// Heart rate of one 5-minute bucket (count/min).
public struct HeartRateBucket: Sendable, Equatable {
    public let start: Date
    public let end: Date
    public let avg, min, max: Double
    public init(start: Date, end: Date, avg: Double, min: Double, max: Double) {
        self.start = start; self.end = end; self.avg = avg; self.min = min; self.max = max
    }
}

/// Heart rate statistics over some time range (count/min); nil fields when Health has no reading.
public struct HeartRateStats: Sendable, Equatable {
    public let avg: Double?
    public let max: Double?
    public init(avg: Double?, max: Double?) { self.avg = avg; self.max = max }
}

/// The result of one anchored read: what was added and deleted since `anchor` was handed out, and the
/// new anchor (opaque; `HealthKitReader` archives an `HKQueryAnchor`). A nil anchor in means "everything
/// since `from`" (the first run's backfill).
public struct HealthChange<Value: Sendable>: Sendable {
    public let added: [Value]
    public let deletedIds: [UUID]
    public let anchor: Data
    public init(added: [Value], deletedIds: [UUID], anchor: Data) {
        self.added = added; self.deletedIds = deletedIds; self.anchor = anchor
    }
}

/// What Boop reads from Apple Health. The HealthKit implementation lives in `HealthKitReader`;
/// tests use a fake.
///
/// The plan's `changes(kind:anchor:from:)` is split into one typed method per record family (sleep,
/// workouts, discrete samples) so each returns its own value type.
public protocol HealthReader: Sendable {
    /// Sleep-analysis samples overlapping [from, to] (the nights are rebuilt from these).
    func sleepSamples(from: Date, to: Date) async throws -> [SleepSample]
    /// Anchored read of sleep analysis — only used to decide whether (and how far back) to rebuild nights.
    func sleepChanges(anchor: Data?, from: Date) async throws -> HealthChange<SleepSample>
    /// One full row per local day in [from, to] (statistics collections).
    func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals]
    /// Anchored read of workouts.
    func workoutChanges(anchor: Data?, from: Date) async throws -> HealthChange<WorkoutSample>
    /// Anchored read of one discrete metric (never `.heartRate`).
    func sampleChanges(_ metric: HealthMetric, anchor: Data?, from: Date) async throws -> HealthChange<HealthSampleValue>
    /// Heart rate in 5-minute buckets over [from, to]; buckets without readings are left out.
    func heartRateBuckets(from: Date, to: Date) async throws -> [HeartRateBucket]
    /// Average and maximum heart rate over the union of `intervals` (nil when there are none at all).
    func heartRate(during intervals: [DateInterval]) async throws -> HeartRateStats?
    /// The raw samples of one metric whose start lies in [from, to], oldest first. Heart rate and the quantity metrics
    /// only (anything else answers empty) — the watch snapshot's heart-rate mean and HRV median read from here.
    func readSamples(_ metric: HealthMetric, from: Date, to: Date) async throws -> [HealthSampleValue]
}
