import Foundation

/// One Apple Health sleep-analysis sample, reduced to what Boop needs.
public struct SleepSample: Sendable, Equatable {
    public enum Stage: Sendable, Equatable { case inBed, awake, core, deep, rem, asleepUnspecified }
    public let start: Date
    public let end: Date
    public let stage: Stage
    public let source: String
    public init(start: Date, end: Date, stage: Stage, source: String) {
        self.start = start; self.end = end; self.stage = stage; self.source = source
    }
}

/// Apple Health totals of one local day.
public struct DayTotals: Sendable, Equatable {
    public let date: String
    public var steps, activeKcal, restingHr, avgHr, minHr, maxHr: Int?
    public init(date: String, steps: Int? = nil, activeKcal: Int? = nil, restingHr: Int? = nil,
                avgHr: Int? = nil, minHr: Int? = nil, maxHr: Int? = nil) {
        self.date = date; self.steps = steps; self.activeKcal = activeKcal; self.restingHr = restingHr
        self.avgHr = avgHr; self.minHr = minHr; self.maxHr = maxHr
    }
}

/// One Apple Health workout; `activity` is the HKWorkoutActivityType case name.
public struct WorkoutSample: Sendable, Equatable {
    public let uuid: UUID
    public let activity: String
    public let start: Date
    public let end: Date
    public let kcal: Int?
    public let avgHr: Int?
    public let source: String
    public init(uuid: UUID, activity: String, start: Date, end: Date, kcal: Int?, avgHr: Int?, source: String) {
        self.uuid = uuid; self.activity = activity; self.start = start; self.end = end
        self.kcal = kcal; self.avgHr = avgHr; self.source = source
    }
}

/// What Boop reads from Apple Health. The HealthKit implementation lives in `HealthKitReader`;
/// tests use a fake.
public protocol HealthReader: Sendable {
    func sleepSamples(from: Date, to: Date) async throws -> [SleepSample]
    func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals]
    func workouts(from: Date, to: Date) async throws -> [WorkoutSample]
}
