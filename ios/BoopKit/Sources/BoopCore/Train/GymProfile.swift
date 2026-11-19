import Foundation
import BoopAPI

/// „Mi van a termemben": the kit kinds the gym lacks and the individual exercises it cannot do. Everything counts
/// as available until he says otherwise, so both sets are empty by default.
public struct GymProfile: Equatable, Sendable {
    public var offKinds: Set<String>
    public var missing: Set<UUID>
    public init(offKinds: Set<String> = [], missing: Set<UUID> = []) { self.offKinds = offKinds; self.missing = missing }
}

/// The nine kit kinds the owner sees (spec §6.1). `bodyweight` is always available and not listed.
public enum EquipmentKind: String, CaseIterable, Sendable {
    case barbell, dumbbell, kettlebell, cable, machine, smith, bench
    case pullupBar = "pullup-bar"
    case specialty

    public var label: String {
        switch self {
        case .barbell: "Rúd és tárcsák"
        case .dumbbell: "Kézisúlyzók"
        case .kettlebell: "Kettlebell"
        case .cable: "Csiga (kábel)"
        case .machine: "Gépek"
        case .smith: "Smith-keret"
        case .bench: "Pad"
        case .pullupBar: "Húzódzkodó és tolódzkodó állvány"
        case .specialty: "Különleges eszközök"
        }
    }

    /// One missing machine is not „no machines": these three are marked per exercise.
    public var isPerExercise: Bool { self == .machine || self == .smith || self == .specialty }
}

/// What „ehhez nincs eszközöm" on an exercise edits.
public enum MissingEdit: Equatable, Sendable {
    /// A machine, Smith frame or specialty tool: that one exercise is marked missing.
    case exercise(UUID)
    /// One portable kind: the kind is switched off.
    case kind(EquipmentKind)
    /// Several portable kinds: ask which one is missing (the bench, which rarely is, comes last).
    case ask([EquipmentKind])
}

/// Nil when the exercise carries no kit attributes (a custom exercise, or bodyweight only) — nothing to edit.
public func missingEdit(for e: CatalogExercise) -> MissingEdit? {
    let kinds = Set((e.gear ?? []).compactMap(EquipmentKind.init(rawValue:)))
    if kinds.contains(where: \.isPerExercise) { return .exercise(e.id) }
    let ordered = EquipmentKind.allCases.filter { kinds.contains($0) && $0 != .bench } + (kinds.contains(.bench) ? [.bench] : [])
    switch ordered.count {
    case 0: return nil
    case 1: return .kind(ordered[0])
    default: return .ask(ordered)
    }
}

public enum SubstituteLabel: Equatable, Sendable { case noEquipment, hurtBefore }

public struct Substitute: Identifiable, Sendable {
    public let exercise: CatalogExercise
    public let reason: String
    public let signals: [String]
    /// `kg` is nil for a bodyweight set, never a made-up 0.
    public let lastTopSet: (kg: Double?, reps: Int)?
    public var id: UUID { exercise.id }
}

public struct Substitutes: Sendable {
    public let suggestions: [Substitute]
    public let labels: [UUID: SubstituteLabel]
}

extension TrainClient {
    public func gymProfile() async throws -> GymProfile {
        try await call {
            switch try await client.getGymProfile() {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    public func saveGymProfile(_ p: GymProfile) async throws -> GymProfile {
        try await call {
            let body = Components.Schemas.GymProfile(offKinds: p.offKinds.sorted(),
                                                     missingExerciseIds: p.missing.map(\.wire).sorted())
            switch try await client.putGymProfile(body: .json(body)) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .badRequest: throw TrainFetchError.rejected
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    /// Ranked, reasoned alternatives for one exercise of the active workout. Online only, like `changeExercise`.
    public func substitutes(workoutId: UUID, exerciseId: UUID) async throws -> Substitutes {
        try await call {
            switch try await client.getExerciseSubstitutes(path: .init(id: workoutId.wire, exerciseId: exerciseId.wire)) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .notFound: throw TrainFetchError.notFound
            case .conflict: throw TrainFetchError.conflict(code: nil, workoutId: nil)
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    /// „Nem esik jól": a day-keyed note on the outgoing exercise that steers the ranking. Idempotent per day.
    public func markDiscomfort(workoutId: UUID, exerciseId: UUID) async throws {
        try await call {
            switch try await client.markExerciseDiscomfort(path: .init(id: workoutId.wire, exerciseId: exerciseId.wire)) {
            case .noContent: return
            case .notFound: throw TrainFetchError.notFound
            case .conflict: throw TrainFetchError.conflict(code: nil, workoutId: nil)
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    public func clearDiscomfort(workoutId: UUID, exerciseId: UUID) async throws {
        try await call {
            switch try await client.clearExerciseDiscomfort(path: .init(id: workoutId.wire, exerciseId: exerciseId.wire)) {
            case .noContent: return
            case .notFound: throw TrainFetchError.notFound
            case .conflict: throw TrainFetchError.conflict(code: nil, workoutId: nil)
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    static func map(_ g: Components.Schemas.GymProfile) -> GymProfile {
        GymProfile(offKinds: Set(g.offKinds), missing: Set(g.missingExerciseIds.compactMap(UUID.init(uuidString:))))
    }

    static func map(_ r: Components.Schemas.ExerciseSubstitutesResponse) -> Substitutes {
        var labels: [UUID: SubstituteLabel] = [:]
        for l in r.labels {
            guard let id = UUID(uuidString: l.catalogId) else { continue }
            labels[id] = l.label == .NO_EQUIPMENT ? .noEquipment : .hurtBefore
        }
        let list = r.suggestions.map { s in
            Substitute(exercise: map(s.exercise), reason: s.reasonText, signals: s.signals,
                       lastTopSet: s.lastTopSet.map { ($0.value1.weightKg, $0.value1.reps) })
        }
        return Substitutes(suggestions: list, labels: labels)
    }
}
