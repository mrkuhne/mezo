import Foundation
import OpenAPIRuntime
import BoopAPI

private let activityTypes: [String: String] = [
    "traditionalStrengthTraining": "strength", "functionalStrengthTraining": "strength",
    "running": "running", "walking": "walking", "cycling": "cycling", "volleyball": "volleyball",
    "highIntensityIntervalTraining": "hiit", "yoga": "yoga",
]

/// The server key of a Health workout (also what a deletion sends).
func workoutExternalId(_ uuid: UUID) -> String { "hk-\(uuid.uuidString.lowercased())" }

/// The server key of a discrete Health sample (its HealthKit uuid; also what a deletion sends).
func sampleExternalId(_ uuid: UUID) -> String { uuid.uuidString.lowercased() }

/// Apple Health workout → contract shape; unknown activity types become `other`.
public func mapWorkout(_ w: WorkoutSample) -> Components.Schemas.WorkoutIn {
    .init(externalId: workoutExternalId(w.uuid), activityType: activityTypes[w.activity] ?? "other",
          startAt: w.start, endAt: w.end, kcal: w.kcal, avgHr: w.avgHr, sourceName: String(w.source.prefix(80)),
          distanceM: w.distanceM, maxHr: w.maxHr, sourceBundle: w.bundle.isEmpty ? nil : String(w.bundle.prefix(120)))
}

/// Day totals → contract shape (the whole row: the server overwrites every column); a day with no
/// metric at all is dropped.
public func mapDays(_ days: [DayTotals]) -> [Components.Schemas.DailyMetricIn] {
    days.compactMap { d in
        guard !d.isEmpty else { return nil }
        return .init(date: d.date, steps: d.steps, restingHr: d.restingHr, avgHr: d.avgHr,
                     minHr: d.minHr, maxHr: d.maxHr, activeKcal: d.activeKcal,
                     distanceM: d.distanceM, basalKcal: d.basalKcal, exerciseMin: d.exerciseMin,
                     hrvMs: d.hrvMs, respRate: d.respRate, spo2Pct: d.spo2Pct, wristTempC: d.wristTempC,
                     vo2max: d.vo2max, walkingHr: d.walkingHr, mindfulMin: d.mindfulMin, daylightMin: d.daylightMin)
    }
}

/// Discrete sample → contract shape, in wire units (fraction → percent for SpO2 and body fat).
public func mapSample(_ s: HealthSampleValue) -> Components.Schemas.HealthSampleIn {
    .init(externalId: sampleExternalId(s.uuid), metric: metricPayload(s.metric), start: s.start, end: max(s.start, s.end),
          value: s.metric.wireValue(s.value), unit: s.metric.wireUnit,
          sourceName: s.sourceName.isEmpty ? nil : String(s.sourceName.prefix(80)),
          sourceBundle: s.sourceBundle.isEmpty ? nil : String(s.sourceBundle.prefix(120)),
          device: s.device.map { String($0.prefix(80)) }, userEntered: s.userEntered,
          meta: s.meta.isEmpty ? nil : objectContainer(s.meta))
}

/// One 5-minute heart-rate bucket → a `heart_rate` sample keyed `hr-<bucket start epoch seconds>`;
/// value = average, `meta` {min, max}. Buckets are never deleted (documented in B1).
public func mapBucket(_ b: HeartRateBucket) -> Components.Schemas.HealthSampleIn {
    .init(externalId: "hr-\(Int(b.start.timeIntervalSince1970))", metric: metricPayload(.heartRate),
          start: b.start, end: b.end, value: round1(b.avg), unit: HealthMetric.heartRate.wireUnit,
          meta: objectContainer(["min": .number(round1(b.min)), "max": .number(round1(b.max))]))
}

private func round1(_ v: Double) -> Double { (v * 10).rounded() / 10 }

private func metricPayload(_ m: HealthMetric) -> Components.Schemas.HealthSampleIn.metricPayload {
    // Every HealthMetric raw value is one of the contract's enum codes.
    Components.Schemas.HealthSampleIn.metricPayload(rawValue: m.rawValue)!
}

private func objectContainer(_ meta: [String: HealthMeta]) -> Components.Schemas.HealthSampleIn.metaPayload? {
    var out: [String: (any Sendable)?] = [:]
    for (k, v) in meta {
        switch v {
        case .string(let s): out[k] = s
        case .number(let n): out[k] = n
        case .strings(let list): out[k] = list.map { $0 as (any Sendable)? }
        case .numbers(let list): out[k] = list.map { $0 as (any Sendable)? }
        }
    }
    return (try? OpenAPIObjectContainer(unvalidatedValue: out)).map { .init(additionalProperties: $0) }
}
