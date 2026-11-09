import Foundation
import BoopAPI

private let activityTypes: [String: String] = [
    "traditionalStrengthTraining": "strength", "functionalStrengthTraining": "strength",
    "running": "running", "walking": "walking", "cycling": "cycling", "volleyball": "volleyball",
    "highIntensityIntervalTraining": "hiit", "yoga": "yoga",
]

/// Apple Health workout → contract shape; unknown activity types become `other`.
public func mapWorkout(_ w: WorkoutSample) -> Components.Schemas.WorkoutIn {
    .init(externalId: "hk-\(w.uuid.uuidString.lowercased())", activityType: activityTypes[w.activity] ?? "other",
          startAt: w.start, endAt: w.end, kcal: w.kcal, avgHr: w.avgHr, sourceName: String(w.source.prefix(80)))
}

/// Day totals → contract shape; a day with no metric at all is dropped.
public func mapDays(_ days: [DayTotals]) -> [Components.Schemas.DailyMetricIn] {
    days.compactMap { d in
        let values = [d.steps, d.activeKcal, d.restingHr, d.avgHr, d.minHr, d.maxHr]
        guard values.contains(where: { $0 != nil }) else { return nil }
        return .init(date: d.date, steps: d.steps, restingHr: d.restingHr, avgHr: d.avgHr,
                     minHr: d.minHr, maxHr: d.maxHr, activeKcal: d.activeKcal)
    }
}
