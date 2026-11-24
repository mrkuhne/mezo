import Foundation

// The gym catch-up's pure parts (`mezo-r36n9.161`, spec §3.6): what the Megvolt sheet's rows say, the default start,
// and the booking the outbox carries to `POST /api/train/workouts/as-planned`.

/// One exercise row on the Megvolt sheet: „3 × 8 · 60 kg", or „3 × 15 · – kg · írd be" when nothing prescribes a
/// weight and none was typed (such a row is skipped in the booking).
public struct AsPlannedRow: Equatable, Identifiable, Sendable {
    public let id: UUID
    public let name: String
    public let setsText: String
    public let needsWeight: Bool

    public init(id: UUID, name: String, setsText: String, needsWeight: Bool) {
        self.id = id; self.name = name; self.setsText = setsText; self.needsWeight = needsWeight
    }
}

/// „60" · „62,5" — a weight in the owner's decimal comma, no trailing zero.
public func asPlannedKg(_ kg: Double) -> String {
    kg == kg.rounded() ? "\(Int(kg))" : String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")
}

/// The sheet's rows from the day's prescription (as of today) with the owner's typed weights on top.
public func asPlannedRows(_ workout: TodayWorkout, overrides: [UUID: Double]) -> [AsPlannedRow] {
    workout.exercises.map { e in
        let first = e.sets.first { $0.kind == .working }
        let weight = overrides[e.id] ?? first?.targetKg
        let reps = first?.targetReps ?? e.repMin
        let working = e.sets.filter { $0.kind == .working }.count
        let count = e.workingCount > 0 ? e.workingCount : max(1, working)
        let kg = weight.map { "\(asPlannedKg($0)) kg" } ?? "– kg · írd be"
        return AsPlannedRow(id: e.id, name: e.name, setsText: "\(count) × \(reps) · \(kg)", needsWeight: weight == nil)
    }
}

/// When the booked workout starts: the day's planned session time (`HH:mm`) on that day, else six in the evening.
public func asPlannedDefaultTime(session: String?, on day: String, calendar: Calendar) -> Date {
    let p = day.split(separator: "-").compactMap { Int($0) }
    let t = (session ?? "").split(separator: ":").compactMap { Int($0) }
    let (hour, minute) = t.count == 2 && (0..<24).contains(t[0]) && (0..<60).contains(t[1]) ? (t[0], t[1]) : (18, 0)
    guard p.count == 3 else { return Date() }
    return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: hour, minute: minute)) ?? Date()
}

/// The booking as the outbox carries it; the queued item's id is the server's idempotency key.
public struct WorkoutAsPlannedPayload: Codable, Equatable, Sendable {
    public struct Override: Codable, Equatable, Sendable {
        public var exerciseId: UUID
        public var weightKg: Double
        public init(exerciseId: UUID, weightKg: Double) { self.exerciseId = exerciseId; self.weightKg = weightKg }
    }

    public var templateSessionId: UUID
    public var date: String
    public var startedAt: Date
    public var overrides: [Override]

    public init(templateSessionId: UUID, date: String, startedAt: Date, overrides: [Override]) {
        self.templateSessionId = templateSessionId; self.date = date; self.startedAt = startedAt; self.overrides = overrides
    }
}

/// The booking for a day: only the typed weights travel, in the day's exercise order; nil without a template day.
public func asPlannedPayload(workout: TodayWorkout, date: String, startedAt: Date, overrides: [UUID: Double]) -> WorkoutAsPlannedPayload? {
    guard let template = workout.templateSessionId else { return nil }
    let typed = workout.exercises.compactMap { e in overrides[e.id].map { WorkoutAsPlannedPayload.Override(exerciseId: e.id, weightKg: $0) } }
    return WorkoutAsPlannedPayload(templateSessionId: template, date: date, startedAt: startedAt, overrides: typed)
}
