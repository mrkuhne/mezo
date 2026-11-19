import Foundation

// The block builder's editable copy of the running block (mezo-r36n9.83). A value type: every edit is a pure
// function, and what the builder sends — the evaluator's draft, the saves — is derived from it. **No band maths
// lives here**: where a muscle stands, its band and the proposal all come from the server's evaluator. The only rules
// kept on the phone are the ones the screens need before the server answers: a stepper's 1…8 range, the technique
// list an exercise may cycle through (the server re-checks every pick), and one challenge a day.

/// The block's way of working (T1): an exercise may override it.
public enum BlockStyle: String, CaseIterable, Sendable, Equatable {
    case balanced, volume, heavy, allout

    public var name: String {
        switch self {
        case .balanced: "Kiegyensúlyozott"
        case .volume: "Sok ismétlés"
        case .heavy: "Nagyobb súly"
        case .allout: "Két sorozat bukásig"
        }
    }

    /// One line on what this style changes — the four-way choice's caption.
    public var line: String {
        switch self {
        case .balanced: "6–10 a nagy gyakorlatokon, 10–15 a kicsiken, 2 marad a tartalékban."
        case .volume: "10–15 és 15–25 ismétlés, rövidebb pihenők."
        case .heavy: "5–8 és 8–12 ismétlés, hosszabb pihenők."
        case .allout: "Gyakorlatonként két sorozat, mindkettő bukásig. Csak stabil gyakorlaton."
        }
    }

    public func range(isolation: Bool) -> String {
        switch self {
        case .balanced: isolation ? "10–15" : "6–10"
        case .volume: isolation ? "15–25" : "10–15"
        case .heavy: isolation ? "8–12" : "5–8"
        case .allout: isolation ? "8–12" : "6–10"
        }
    }
}

/// What may sit on an exercise's last set (T2). The wire spells `rest_drop`.
public enum SetTechnique: String, CaseIterable, Codable, Sendable, Equatable {
    case none, restDrop = "rest_drop", drop, myo, partials

    public init(wire: String?) { self = SetTechnique(rawValue: wire ?? "none") ?? .none }

    /// Lenient like every wire enum: a technique the server adds later reads as straight sets.
    public init(from decoder: Decoder) throws {
        self.init(wire: try decoder.singleValueContainer().decode(String.self))
    }

    public var name: String {
        switch self {
        case .none: "Sima sorozatok"
        case .restDrop: "Pihenős drop"
        case .drop: "Drop set"
        case .myo: "Myo set"
        case .partials: "Félismétlések"
        }
    }

    /// One or two sentences on what it is — the picker's info text.
    public var about: String {
        switch self {
        case .none: "Minden sorozat ugyanúgy megy, technika nélkül."
        case .restDrop: "Az utolsó sorozat bukásig, 30 mp pihenő, aztán 30%-kal kisebb súllyal ugyanannyi ismétlés. Kevesebb idő alatt ugyanannyi munka."
        case .drop: "Az utolsó sorozat bukásig, majd pihenő nélkül 20%-kal kisebb súllyal újra bukásig."
        case .myo: "Az utolsó sorozat majdnem bukásig, aztán 20 mp-es pihenőkkel 3–5 ismétléses mini-sorozatok, amíg megy."
        case .partials: "Az utolsó teljes sorozat után azonnal félismétlések a nyújtott helyzetben, amennyi megy. Csak ott, ahol ez biztonságos."
        }
    }

    public var steps: [String] {
        switch self {
        case .none: []
        case .restDrop: ["Bukásig", "30 mp pihenő", "30%-kal kevesebb súly, ugyanannyi"]
        case .drop: ["Bukásig", "Azonnal 20%-kal kevesebb", "Újra bukásig"]
        case .myo: ["Majdnem bukásig", "20 mp pihenő", "3–5 ismétlés, amíg megy"]
        case .partials: ["Az utolsó teljes sorozat", "Azonnal félismétlések", "Amennyi megy"]
        }
    }
}

/// The weekly proposal's mode on this block.
public enum ReviewMode: String, Sendable, Equatable { case auto, manual }

/// The coarse group a catalog muscle key belongs to (`back-wide` → `back`). Display grouping only — bands are the
/// server's. `core` and keys outside the landmark table carry no band.
public func coarseMuscle(_ key: String) -> String {
    let k = key.lowercased()
    switch k {
    case "lats", "back": return "back"
    case "shoulders", "rear-delt", "delts": return "shoulder"
    case "quads", "quadriceps": return "quad"
    case "hams", "hamstring", "hamstrings": return "ham"
    case "glutes", "gluteal": return "glute"
    case "calves": return "calf"
    case "abs", "core": return "core"
    default: return String(k.split(separator: "-").first ?? Substring(k))
    }
}

public struct DraftExercise: Identifiable, Equatable, Sendable {
    /// The server's exercise row id (template day row).
    public let id: String
    public let name: String
    /// Coarse group key (`back`, `biceps`, …).
    public let muscle: String
    public var sets: Int
    public let counts: Bool
    public let isolation: Bool
    /// Catalog attributes the technique rules read; false when the exercise has no catalog row.
    public let stable: Bool
    public let lengthened: Bool
    public var technique: SetTechnique
    public var challenge: Bool
    /// The exercise's own style; nil = the block's.
    public let ownStyle: BlockStyle?
    /// The row as the server sent it — the day save is built from it, so nothing it carries is lost.
    public let wire: WireExercise

    /// Does it take part in the volume and technique story at all (not core, not plyo, not the closing block)?
    public var judged: Bool { counts && muscle != "core" && wire.type != "plyo" }

    /// The techniques it may carry: none on a free-weight lift, half reps only where the stretched position is safe.
    public var allowedTechniques: [SetTechnique] {
        guard stable, judged else { return [.none] }
        return lengthened ? [.none, .restDrop, .drop, .myo, .partials] : [.none, .restDrop, .drop, .myo]
    }

    public var canTakeChallenge: Bool { stable && lengthened && judged }

    /// The pick on screen is Boop's own (the planner or the AI put it there, he has not touched it).
    public var pickedByBoop: Bool {
        guard ["planner", "ai"].contains(wire.techniqueSource ?? "") else { return false }
        return technique == SetTechnique(wire: wire.technique) && challenge == (wire.challenge ?? false) && (technique != .none || challenge)
    }

    /// Why the day's challenge cannot sit on this exercise; nil when it can.
    public var challengeUnavailableReason: String? {
        if canTakeChallenge { return nil }
        if !judged { return "Ez a gyakorlat nem számít bele a sorozatokba." }
        if !stable { return "Szabadsúlyos gyakorlaton nincs kihívás." }
        return "A kihívás félismétlés a nyújtott helyzetben — ennél a gyakorlatnál ez nem biztonságos."
    }

    /// Why a technique is not offered on this exercise, in his words; nil when it is.
    public func unavailableReason(_ technique: SetTechnique) -> String? {
        if allowedTechniques.contains(technique) { return nil }
        if !judged { return "Ez a gyakorlat nem számít bele a sorozatokba." }
        if !stable { return "Szabadsúlyos gyakorlaton nincs technika." }
        return "Ennél a gyakorlatnál a nyújtott helyzet ismétlése nem biztonságos."
    }
}

public struct DraftDay: Identifiable, Equatable, Sendable {
    /// The template day row id — the address of a day save.
    public let id: String
    /// `Hét` … `Vas` on the wire.
    public let weekday: String
    public let title: String
    public let wire: WireDay
    public var exercises: [DraftExercise]

    /// „Hétfő" — the day the way he says it.
    public var name: String { Self.longName(weekday) }

    public static func longName(_ short: String) -> String {
        switch short.prefix(3).lowercased() {
        case "hét": "Hétfő"
        case "ked": "Kedd"
        case "sze": "Szerda"
        case "csü": "Csütörtök"
        case "pén": "Péntek"
        case "szo": "Szombat"
        case "vas": "Vasárnap"
        default: short
        }
    }
}

public struct BlockDraft: Equatable, Sendable {
    public let blockId: String
    public let title: String
    public let weeks: Int
    public let currentWeek: Int
    public let phaseCurve: [String]
    public var days: [DraftDay]
    /// Coarse muscle → tier; absent = Építés.
    public var tiers: [String: MuscleTier]
    public var sportGroups: [String]
    public var style: BlockStyle?
    public var techniquesEnabled: Bool
    public var reviewMode: ReviewMode

    // MARK: building

    /// The draft of the running block. `catalog` supplies the technique attributes by catalog id.
    public init(block: WireBlock, catalog: [WireCatalogItem]) {
        let byId = Dictionary(catalog.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        blockId = block.id
        title = block.title
        weeks = block.weeks
        currentWeek = block.currentWeek
        phaseCurve = block.phaseCurve
        tiers = (block.musclePriorities ?? [:]).reduce(into: [:]) { $0[$1.key] = MuscleTier(wire: $1.value) }
        sportGroups = block.sportGroups ?? []
        style = block.trainingStyle.flatMap(BlockStyle.init(rawValue:))
        techniquesEnabled = block.techniquesEnabled ?? false
        reviewMode = ReviewMode(rawValue: block.weeklyReviewMode ?? "auto") ?? .auto
        days = (block.days ?? []).map { d in
            DraftDay(id: d.id, weekday: d.day, title: d.type, wire: d, exercises: d.exercises.compactMap { e in
                guard let id = e.id else { return nil }
                let cat = e.catalogId.flatMap { byId[$0] }
                return DraftExercise(id: id, name: e.name, muscle: coarseMuscle(e.muscle), sets: e.workingSets,
                                     counts: e.countsTowardVolume ?? true, isolation: e.type == "isolation",
                                     stable: cat?.stability == "stable", lengthened: cat?.lengthenedFriendly ?? false,
                                     technique: SetTechnique(wire: e.technique), challenge: e.challenge ?? false,
                                     ownStyle: e.trainingStyle.flatMap(BlockStyle.init(rawValue:)), wire: e)
            })
        }
    }

    // MARK: edits

    public func tier(_ muscle: String) -> MuscleTier { tiers[muscle] ?? .grow }

    /// Építés → Hangsúly → Tartás → Építés.
    public mutating func cycleTier(_ muscle: String) {
        switch tier(muscle) {
        case .grow: tiers[muscle] = .emphasize
        case .emphasize: tiers[muscle] = .maintain
        case .maintain: tiers[muscle] = nil
        }
    }

    public mutating func setTier(_ muscle: String, _ tier: MuscleTier) { tiers[muscle] = tier == .grow ? nil : tier }

    /// One stepper tap: 1…8 sets.
    public mutating func step(day: Int, exercise: Int, by delta: Int) {
        guard days.indices.contains(day), days[day].exercises.indices.contains(exercise) else { return }
        days[day].exercises[exercise].sets = min(8, max(1, days[day].exercises[exercise].sets + delta))
    }

    /// Apply the evaluator's proposal edits (`dayIndex`/`exerciseIndex` index this draft's order).
    public mutating func apply(_ edits: [WireEdit]) {
        for e in edits where days.indices.contains(e.dayIndex) && days[e.dayIndex].exercises.indices.contains(e.exerciseIndex) {
            days[e.dayIndex].exercises[e.exerciseIndex].sets = min(8, max(1, days[e.dayIndex].exercises[e.exerciseIndex].sets + e.delta))
        }
    }

    /// The next technique in the exercise's allowed list. A no-op while techniques are off or none is allowed.
    public mutating func cycleTechnique(day: Int, exercise: Int) {
        guard techniquesEnabled, days.indices.contains(day), days[day].exercises.indices.contains(exercise) else { return }
        let ex = days[day].exercises[exercise]
        let options = ex.allowedTechniques
        guard options.count > 1 else { return }
        let i = options.firstIndex(of: ex.technique) ?? 0
        days[day].exercises[exercise].technique = options[(i + 1) % options.count]
    }

    /// Picks a technique from the picker (an offered one only). The day's challenge stays: since 2026-11-19 an exercise
    /// may carry both — the technique first, then the half-rep challenge (owner decision #52).
    public mutating func setTechnique(day: Int, exercise: Int, _ technique: SetTechnique) {
        guard techniquesEnabled, days.indices.contains(day), days[day].exercises.indices.contains(exercise),
              days[day].exercises[exercise].allowedTechniques.contains(technique) else { return }
        days[day].exercises[exercise].technique = technique
    }

    /// Puts the day's challenge on this exercise (taking it from any other that day; its technique stays) or takes it off.
    public mutating func setChallenge(day: Int, exercise: Int, _ on: Bool) {
        guard techniquesEnabled, days.indices.contains(day), days[day].exercises.indices.contains(exercise) else { return }
        if on {
            guard days[day].exercises[exercise].canTakeChallenge else { return }
            for e in days[day].exercises.indices { days[day].exercises[e].challenge = false }
            days[day].exercises[exercise].challenge = true
        } else {
            days[day].exercises[exercise].challenge = false
        }
    }

    /// One challenge a day: picking a new one takes it from the old; tapping the same one clears it. A technique on the
    /// exercise stays (owner decision #52).
    public mutating func toggleChallenge(day: Int, exercise: Int) {
        guard techniquesEnabled, days.indices.contains(day), days[day].exercises.indices.contains(exercise),
              days[day].exercises[exercise].canTakeChallenge else { return }
        let was = days[day].exercises[exercise].challenge
        for e in days[day].exercises.indices { days[day].exercises[e].challenge = false }
        days[day].exercises[exercise].challenge = !was
    }

    public func techniqueCount(_ day: Int) -> Int {
        days.indices.contains(day) ? days[day].exercises.filter { $0.technique != .none || $0.challenge }.count : 0
    }

    // MARK: what is sent

    public func evaluateRequest() -> WireEvaluateRequest {
        WireEvaluateRequest(weeks: weeks, phaseCurve: phaseCurve, days: days.map { dayInput($0, forSave: false) },
                            musclePriorities: prioritiesWire, sportGroups: sportGroups,
                            trainingStyle: style?.rawValue, techniquesEnabled: techniquesEnabled)
    }

    /// The sparse tier map the server takes (Építés is the absence of a key).
    public var prioritiesWire: [String: String] {
        tiers.reduce(into: [:]) { out, kv in if kv.value != .grow { out[kv.key] = kv.value.rawValue } }
    }

    /// One day as the evaluator or the day save takes it. On a save the style trio is carried over by omission —
    /// except when the set count of a styled exercise changed, where `workingSets` must join its overrides or the
    /// server would stamp the style's own count back. The technique trio is always sent as the draft has it (the
    /// evaluator weighs a technique set against the caps).
    public func dayInput(_ day: DraftDay, forSave: Bool) -> WireDayInput {
        WireDayInput(day: day.weekday, type: day.title, muscle: day.wire.muscle ?? "", muscleAccent: day.wire.muscleAccent ?? false,
                     note: day.wire.note, exercises: day.exercises.map { exerciseInput($0, forSave: forSave) })
    }

    func exerciseInput(_ e: DraftExercise, forSave: Bool) -> WireExerciseInput {
        let w = e.wire
        var input = WireExerciseInput(
            name: w.name, muscle: w.muscle, warmupSets: w.warmupSets ?? 0, workingSets: e.sets,
            repMin: w.repMin ?? 8, repMax: w.repMax ?? 12, targetRIR: w.targetRIR ?? 2, anchorWeightKg: w.anchorWeightKg,
            type: w.type ?? "compound", warning: w.warning, catalogId: w.catalogId, countsTowardVolume: e.counts,
            trainingStyle: nil, restSec: nil, overrides: nil, technique: nil, techniqueSource: nil, challenge: nil)
        if forSave, e.sets != w.workingSets, (e.ownStyle ?? style) != nil {
            input.trainingStyle = w.trainingStyle
            input.restSec = w.restSec
            input.overrides = Array(Set((w.overrides ?? []) + ["workingSets"])).sorted()
        }
        // The technique trio goes out only for a row whose technique or challenge he changed: an untouched row omits all
        // three, so the server carries the stored pick and its source (a planner's pick stays the planner's) and may clear
        // a stored pick that has become invalid instead of refusing the whole day. The evaluator always gets the pick
        // (it weighs a technique set against the caps).
        let techniqueChanged = e.technique != SetTechnique(wire: w.technique) || e.challenge != (w.challenge ?? false)
        guard !forSave || techniqueChanged else { return input }
        input.technique = e.technique == .none ? nil : e.technique.rawValue
        input.challenge = e.challenge
        input.techniqueSource = forSave ? (e.technique == .none && !e.challenge ? nil : "owner") : w.techniqueSource
        return input
    }

    // MARK: what changed

    public struct Changes: Equatable, Sendable {
        /// Indexes of days whose sets, technique or challenge changed.
        public var days: [Int] = []
        public var tiers = false
        public var sportGroups = false
        public var style = false
        public var techniquesEnabled = false
        public var reviewMode = false
        public var isEmpty: Bool { days.isEmpty && !tiers && !sportGroups && !style && !techniquesEnabled && !reviewMode }
        public var settings: Bool { style || techniquesEnabled || reviewMode }
    }

    public func changes(since original: BlockDraft) -> Changes {
        var c = Changes()
        for (i, day) in days.enumerated() where original.days.indices.contains(i) {
            let before = original.days[i].exercises
            if day.exercises.count != before.count || zip(day.exercises, before).contains(where: {
                $0.sets != $1.sets || $0.technique != $1.technique || $0.challenge != $1.challenge
            }) { c.days.append(i) }
        }
        c.tiers = prioritiesWire != original.prioritiesWire
        c.sportGroups = sportGroups != original.sportGroups
        c.style = style != original.style
        c.techniquesEnabled = techniquesEnabled != original.techniquesEnabled
        c.reviewMode = reviewMode != original.reviewMode
        return c
    }

    /// Carry this draft's edits onto a freshly read block, matched by exercise id. Only what he changed against
    /// `original` moves, and per value: if the server already holds his value it stays; if the server still holds the
    /// original, his value wins; if the server changed it too (a new style re-stamped the row, a weekly proposal applied),
    /// his **delta** is added to the server's value — so a style switch to two sets plus his +1 gives 3, not his old 5.
    public func carryEdits(onto fresh: BlockDraft, original: BlockDraft) -> BlockDraft {
        var out = fresh
        let mine = Dictionary(days.flatMap(\.exercises).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let before = Dictionary(original.days.flatMap(\.exercises).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for d in out.days.indices {
            for e in out.days[d].exercises.indices {
                let id = out.days[d].exercises[e].id
                guard let edit = mine[id], let orig = before[id] else { continue }
                let server = out.days[d].exercises[e]
                out.days[d].exercises[e].sets = Self.merge(mine: edit.sets, orig: orig.sets, server: server.sets) {
                    min(8, max(1, server.sets + (edit.sets - orig.sets)))
                }
                if edit.technique != orig.technique || edit.challenge != orig.challenge {
                    out.days[d].exercises[e].technique = edit.technique
                    out.days[d].exercises[e].challenge = edit.challenge
                }
            }
        }
        if prioritiesWire != original.prioritiesWire, fresh.prioritiesWire == original.prioritiesWire { out.tiers = tiers }
        if sportGroups != original.sportGroups, fresh.sportGroups == original.sportGroups { out.sportGroups = sportGroups }
        if style != original.style, fresh.style == original.style { out.style = style }
        if techniquesEnabled != original.techniquesEnabled, fresh.techniquesEnabled == original.techniquesEnabled {
            out.techniquesEnabled = techniquesEnabled
        }
        if reviewMode != original.reviewMode, fresh.reviewMode == original.reviewMode { out.reviewMode = reviewMode }
        return out
    }

    private static func merge(mine: Int, orig: Int, server: Int, both: () -> Int) -> Int {
        if mine == orig || server == mine { return server }
        if server == orig { return mine }
        return both()
    }
}
