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
    case none, restDrop = "rest_drop", drop, myo, restPause = "rest_pause", partials

    /// The owner's fixed rest-pause makes the whole exercise this many reps (mezo-r36n9.125; the server pins it too).
    public static let restPauseReps = 20

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
        case .restPause: "Rest pause"
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
        case .restPause: "20 ismétlés, aztán 10 mp pihenő és 5 ismétlés, ezt négyszer. Fix menet, nem áll le magától. Az egész gyakorlat 20 ismétlésre áll."
        case .partials: "Az utolsó teljes sorozat után azonnal félismétlések a nyújtott helyzetben, amennyi megy. Csak ott, ahol ez biztonságos."
        }
    }

    public var steps: [String] {
        switch self {
        case .none: []
        case .restDrop: ["Bukásig", "30 mp pihenő", "30%-kal kevesebb súly, ugyanannyi"]
        case .drop: ["Bukásig", "Azonnal 20%-kal kevesebb", "Újra bukásig"]
        case .myo: ["Majdnem bukásig", "20 mp pihenő", "3–5 ismétlés, amíg megy"]
        case .restPause: ["20 ismétlés", "10 mp pihenő", "5 ismétlés, négyszer"]
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

/// The style's prescription for one exercise, as the builder's suggestion read returns it (mezo-r36n9.116); nil on an
/// unstyled block. A new or replacement row takes it; without one a row starts at 3 × 8–12 · 2 in reserve.
public struct Prescription: Codable, Equatable, Sendable {
    public var workingSets: Int
    public var repMin: Int
    public var repMax: Int
    public var targetRIR: Int
    public var restSec: Int?

    public init(workingSets: Int, repMin: Int, repMax: Int, targetRIR: Int, restSec: Int? = nil) {
        self.workingSets = workingSets; self.repMin = repMin; self.repMax = repMax; self.targetRIR = targetRIR
        self.restSec = restSec
    }

    /// 3 × 8–12 · 2 in reserve: an unstyled block, or a row picked from the full list without a suggestion.
    public static let fallback = Prescription(workingSets: 3, repMin: 8, repMax: 12, targetRIR: 2)
}

public struct DraftExercise: Identifiable, Equatable, Sendable {
    /// The stable local key: the server's row id for a loaded row, `new-<uuid>` for one added in this draft. A swap
    /// keeps it (the row on screen stays the same row); the wire never carries it — the server matches rows by
    /// catalogue id, else exact name.
    public let id: String
    public let name: String
    /// Coarse group key (`back`, `biceps`, …).
    public let muscle: String
    /// The muscle key as the catalogue and the wire spell it (`chest-mid`).
    public let muscleKey: String
    public let catalogId: String?
    /// `compound` / `isolation` / `plyo` as the wire spells it.
    public let type: String
    public var sets: Int
    public var repMin: Int
    public var repMax: Int
    public var targetRIR: Int
    public var warmups: Int
    public var anchorWeightKg: Double?
    public var restSec: Int?
    /// The fields he set himself, with the server's keys (`workingSets`, `repRange`, `targetRir`, `restSec`): a style
    /// does not stamp over them.
    public var overrides: Set<String>
    public let counts: Bool
    public let isolation: Bool
    /// Catalog attributes the technique rules read; false when the exercise has no catalog row.
    public let stable: Bool
    public let lengthened: Bool
    /// The challenge rule's answer for the exercise itself (owner decision #72): the server's flag, else computed —
    /// see `DraftExercise.challengeAllowed(item:type:gear:)`. Whether it counts is `judged`'s.
    public let challengeAllowed: Bool
    public var technique: SetTechnique
    public var challenge: Bool
    /// The exercise's own style; nil = the block's.
    public let ownStyle: BlockStyle?
    /// The row as the server sent it (a synthetic one for an added row) — what the day save carries over by omission.
    public let wire: WireExercise

    /// Added in this draft, not yet on the server.
    public var isNew: Bool { id.hasPrefix("new-") }

    /// The row now stands for another exercise than the server's row (added or swapped): the server cannot carry
    /// anything over to it, so the save sends the style, rest, overrides and technique explicitly.
    public var identityChanged: Bool { isNew || catalogId?.lowercased() != wire.catalogId?.lowercased() || name != wire.name }

    /// What makes the row this exercise, for comparing a day's line-up across reads (ids are re-minted by a save).
    var identity: String { "\(catalogId?.lowercased() ?? "")|\(name.lowercased())" }

    /// The same row with another key — a server read after a save re-mints the ids.
    func withId(_ newId: String) -> DraftExercise {
        DraftExercise(id: newId, name: name, muscle: muscle, muscleKey: muscleKey, catalogId: catalogId, type: type,
                      sets: sets, repMin: repMin, repMax: repMax, targetRIR: targetRIR, warmups: warmups,
                      anchorWeightKg: anchorWeightKg, restSec: restSec, overrides: overrides, counts: counts,
                      isolation: isolation, stable: stable, lengthened: lengthened,
                      challengeAllowed: challengeAllowed, technique: technique,
                      challenge: challenge, ownStyle: ownStyle, wire: wire)
    }

    /// Every field he can edit is the same (the line-up itself is compared by key).
    func sameEdits(as o: DraftExercise) -> Bool {
        name == o.name && catalogId == o.catalogId && sets == o.sets && repMin == o.repMin && repMax == o.repMax
            && targetRIR == o.targetRIR && warmups == o.warmups && anchorWeightKg == o.anchorWeightKg
            && restSec == o.restSec && overrides == o.overrides && technique == o.technique && challenge == o.challenge
    }

    /// A set count change marks `workingSets` as his; stepping back to the server's count takes the mark off again
    /// (unless the server already held it).
    mutating func noteSets() {
        if identityChanged || sets != wire.workingSets { overrides.insert("workingSets") }
        else if !(wire.overrides ?? []).contains("workingSets") { overrides.remove("workingSets") }
    }

    /// Does it take part in the volume and technique story at all (not core, not plyo, not the closing block)?
    public var judged: Bool { counts && muscle != "core" && type != "plyo" }

    /// The techniques it may carry: none on a free-weight lift, half reps only where the stretched position is safe.
    public var allowedTechniques: [SetTechnique] {
        guard stable, judged else { return [.none] }
        return lengthened ? [.none, .restDrop, .drop, .myo, .restPause, .partials] : [.none, .restDrop, .drop, .myo, .restPause]
    }

    /// The day's challenge may sit here: it takes part in the volume and the challenge rule allows the exercise
    /// (every exercise but a free-weight compound, owner decision #72).
    public var canTakeChallenge: Bool { challengeAllowed && judged }

    /// The kit that makes a compound a free-weight lift.
    static let freeWeightKit: Set<String> = ["barbell", "dumbbell", "kettlebell"]

    /// The challenge rule for one exercise: the server's `challengeAllowed` when it sent one; else, with the kit known
    /// (`gear`), every non-plyo exercise but a compound with a barbell, dumbbell or kettlebell; else (an older server
    /// without the kit) the old stable + lengthened rule. No catalogue row at all: no challenge (unknown kit).
    static func challengeAllowed(item: WireCatalogItem?, type: String, gear fallbackGear: [String]? = nil) -> Bool {
        if let flag = item?.challengeAllowed { return flag }
        let kit = item?.gear ?? fallbackGear
        guard item != nil || kit != nil else { return false }
        if let kit, !kit.isEmpty {
            let t = item?.type ?? type
            return t != "plyo" && !(t == "compound" && kit.contains(where: freeWeightKit.contains))
        }
        return item?.stability == "stable" && (item?.lengthenedFriendly ?? false)
    }

    /// The pick on screen is Boop's own (the planner or the AI put it there, he has not touched it).
    public var pickedByBoop: Bool {
        // An added or swapped-in exercise is his choice, whatever pick it carries over.
        guard !identityChanged, ["planner", "ai"].contains(wire.techniqueSource ?? "") else { return false }
        return technique == SetTechnique(wire: wire.technique) && challenge == (wire.challenge ?? false) && (technique != .none || challenge)
    }

    /// Why the day's challenge cannot sit on this exercise; nil when it can.
    public var challengeUnavailableReason: String? {
        if canTakeChallenge { return nil }
        if !judged { return "Ez a gyakorlat nem számít bele a sorozatokba." }
        if catalogId == nil { return "Saját gyakorlaton nincs kihívás." }
        return "Szabadsúlyos alapgyakorlaton nincs kihívás."
    }

    /// The builder chip's grey, untappable label when the row can carry neither a technique nor the day's challenge;
    /// nil = the chip opens the picker. A free-weight isolation (no technique, but the challenge, decision #72) gets the
    /// picker. A free-weight compound says so; any other locked row keeps the old wording.
    public var techniqueLockLabel: String? {
        guard allowedTechniques == [.none], !canTakeChallenge else { return nil }
        // Only a catalogue row can be known as a free-weight lift: a custom compound (no kit on record) is not one.
        return type == "compound" && catalogId != nil ? "szabadsúlyos alapgyakorlat" : "szabadsúly · nincs technika"
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

    /// 0 = Monday … 6 = Sunday, from the weekday label; nil for a label this build does not know.
    public var weekdayIndex: Int? {
        ["hét", "ked", "sze", "csü", "pén", "szo", "vas"].firstIndex(of: String(weekday.prefix(3)).lowercased())
    }

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
    /// The block's catalog by lower-cased id: an added or swapped-in row reads its technique attributes from it.
    let catalogItems: [String: WireCatalogItem]

    // MARK: building

    /// The draft of the running block. `catalog` supplies the technique attributes by catalog id.
    public init(block: WireBlock, catalog: [WireCatalogItem]) {
        let byId = Dictionary(catalog.map { ($0.id.lowercased(), $0) }, uniquingKeysWith: { a, _ in a })
        catalogItems = byId
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
                let cat = e.catalogId.flatMap { byId[$0.lowercased()] }
                return DraftExercise(id: id, name: e.name, muscle: coarseMuscle(e.muscle), muscleKey: e.muscle,
                                     catalogId: e.catalogId, type: e.type ?? "compound", sets: e.workingSets,
                                     repMin: e.repMin ?? 8, repMax: e.repMax ?? 12, targetRIR: e.targetRIR ?? 2,
                                     warmups: e.warmupSets ?? 0, anchorWeightKg: e.anchorWeightKg, restSec: e.restSec,
                                     overrides: Set(e.overrides ?? []),
                                     counts: e.countsTowardVolume ?? true, isolation: e.type == "isolation",
                                     stable: cat?.stability == "stable", lengthened: cat?.lengthenedFriendly ?? false,
                                     challengeAllowed: DraftExercise.challengeAllowed(item: cat, type: e.type ?? "compound"),
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
        noteSets(day: day, exercise: exercise)
    }

    /// A set count change is marked as his only on a styled row — on an unstyled one nothing would stamp over it, and
    /// the save keeps sending no overrides, as before the day editor.
    private mutating func noteSets(day: Int, exercise: Int) {
        guard (days[day].exercises[exercise].ownStyle ?? style) != nil else { return }
        days[day].exercises[exercise].noteSets()
    }

    /// Apply the evaluator's proposal edits (`dayIndex`/`exerciseIndex` index this draft's order).
    public mutating func apply(_ edits: [WireEdit]) {
        for e in edits where days.indices.contains(e.dayIndex) && days[e.dayIndex].exercises.indices.contains(e.exerciseIndex) {
            days[e.dayIndex].exercises[e.exerciseIndex].sets = min(8, max(1, days[e.dayIndex].exercises[e.exerciseIndex].sets + e.delta))
            noteSets(day: e.dayIndex, exercise: e.exerciseIndex)
        }
    }

    /// The next technique in the exercise's allowed list. A no-op while techniques are off or none is allowed.
    public mutating func cycleTechnique(day: Int, exercise: Int) {
        guard techniquesEnabled, days.indices.contains(day), days[day].exercises.indices.contains(exercise) else { return }
        let ex = days[day].exercises[exercise]
        let options = ex.allowedTechniques
        guard options.count > 1 else { return }
        let i = options.firstIndex(of: ex.technique) ?? 0
        setTechnique(day: day, exercise: exercise, options[(i + 1) % options.count])
    }

    /// Picks a technique from the picker (an offered one only). The day's challenge stays: since 2026-11-19 an exercise
    /// may carry both — the technique first, then the half-rep challenge (owner decision #52).
    public mutating func setTechnique(day: Int, exercise: Int, _ technique: SetTechnique) {
        guard techniquesEnabled, days.indices.contains(day), days[day].exercises.indices.contains(exercise),
              days[day].exercises[exercise].allowedTechniques.contains(technique) else { return }
        days[day].exercises[exercise].technique = technique
        if technique == .restPause {
            // the whole exercise becomes 20 reps and the range is his (owner 2026-11-20, mezo-r36n9.125)
            days[day].exercises[exercise].repMin = SetTechnique.restPauseReps
            days[day].exercises[exercise].repMax = SetTechnique.restPauseReps
            days[day].exercises[exercise].overrides.insert("repRange")
        }
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

    // MARK: the day editor (mezo-r36n9.116)

    private func has(_ day: Int, _ row: Int) -> Bool { days.indices.contains(day) && days[day].exercises.indices.contains(row) }

    /// A new row at the end of the day: the style's prescription, or 3 × 8–12 · 2 in reserve; none of it his yet.
    public mutating func add(day: Int, catalog: CatalogExercise, prescription: Prescription?) {
        guard days.indices.contains(day) else { return }
        let p = prescription ?? .fallback
        let catalogId = catalog.id.uuidString.lowercased()
        let item = catalogItems[catalogId]
        let wire = WireExercise(id: nil, name: catalog.name, muscle: catalog.muscle, warmupSets: 0, workingSets: p.workingSets,
                                repMin: p.repMin, repMax: p.repMax, targetRIR: p.targetRIR, anchorWeightKg: nil,
                                type: catalog.type.rawValue, warning: nil, catalogId: catalogId, countsTowardVolume: true,
                                trainingStyle: nil, effectiveTrainingStyle: nil, restSec: p.restSec, overrides: nil,
                                technique: nil, techniqueSource: nil, challenge: nil)
        days[day].exercises.append(DraftExercise(
            id: "new-" + UUID().uuidString, name: catalog.name, muscle: coarseMuscle(catalog.muscle), muscleKey: catalog.muscle,
            catalogId: catalogId, type: catalog.type.rawValue, sets: p.workingSets, repMin: p.repMin, repMax: p.repMax,
            targetRIR: p.targetRIR, warmups: 0, anchorWeightKg: nil, restSec: p.restSec, overrides: [], counts: true,
            isolation: catalog.type == .isolation, stable: item?.stability == "stable",
            lengthened: item?.lengthenedFriendly ?? false,
            challengeAllowed: DraftExercise.challengeAllowed(item: item, type: catalog.type.rawValue, gear: catalog.gear),
            technique: .none, challenge: false, ownStyle: nil, wire: wire))
    }

    /// Takes the row off the day and hands it back, so the undo line can put it back where it was.
    /// nil when there is no such row.
    @discardableResult
    public mutating func remove(day: Int, at index: Int) -> DraftExercise? {
        guard has(day, index) else { return nil }
        return days[day].exercises.remove(at: index)
    }

    /// Puts a removed row back (undo); an index past the end appends.
    public mutating func insert(day: Int, _ row: DraftExercise, at index: Int) {
        guard days.indices.contains(day) else { return }
        days[day].exercises.insert(row, at: min(max(0, index), days[day].exercises.count))
    }

    /// Reorders within the day, with SwiftUI's `onMove` meaning (`to` is an offset in the list before the move).
    public mutating func move(day: Int, from offsets: IndexSet, to destination: Int) {
        guard days.indices.contains(day) else { return }
        var rows = days[day].exercises
        let picked = offsets.filter { rows.indices.contains($0) }.sorted()
        guard !picked.isEmpty else { return }
        let moving = picked.map { rows[$0] }
        var target = min(max(0, destination), rows.count)
        for i in picked.reversed() {
            rows.remove(at: i)
            if i < target { target -= 1 }
        }
        rows.insert(contentsOf: moving, at: target)
        days[day].exercises = rows
    }

    /// Swaps the row's exercise for the block's rest. The row keeps its key, technique (when the new exercise may carry
    /// it), challenge (when it may take it), its own style, rest, warm-ups and every field he set himself; the rest
    /// comes from the prescription (or 3 × 8–12 · 2). The starting weight belonged to the old exercise and goes.
    public mutating func replace(day: Int, at index: Int, with catalog: CatalogExercise, prescription: Prescription?) {
        guard has(day, index) else { return }
        let old = days[day].exercises[index]
        let p = prescription ?? .fallback
        let catalogId = catalog.id.uuidString.lowercased()
        let item = catalogItems[catalogId]
        let o = old.overrides
        var row = DraftExercise(
            id: old.id, name: catalog.name, muscle: coarseMuscle(catalog.muscle), muscleKey: catalog.muscle,
            catalogId: catalogId, type: catalog.type.rawValue,
            sets: o.contains("workingSets") ? old.sets : p.workingSets,
            repMin: o.contains("repRange") ? old.repMin : p.repMin, repMax: o.contains("repRange") ? old.repMax : p.repMax,
            targetRIR: o.contains("targetRir") ? old.targetRIR : p.targetRIR, warmups: old.warmups, anchorWeightKg: nil,
            restSec: old.restSec, overrides: o, counts: old.counts, isolation: catalog.type == .isolation,
            stable: item?.stability == "stable", lengthened: item?.lengthenedFriendly ?? false,
            challengeAllowed: DraftExercise.challengeAllowed(item: item, type: catalog.type.rawValue, gear: catalog.gear),
            technique: .none, challenge: false, ownStyle: old.ownStyle, wire: old.wire)
        if row.allowedTechniques.contains(old.technique) { row.technique = old.technique }
        if old.challenge, row.canTakeChallenge { row.challenge = true }
        days[day].exercises[index] = row
    }

    /// 1…30 each, min ≤ max (a min past the max lifts the max). Marks `repRange` as his.
    public mutating func setRepRange(day: Int, at index: Int, min lo: Int, max hi: Int) {
        guard has(day, index) else { return }
        let a = Swift.min(30, Swift.max(1, lo))
        let b = Swift.max(a, Swift.min(30, Swift.max(1, hi)))
        days[day].exercises[index].repMin = a
        days[day].exercises[index].repMax = b
        days[day].exercises[index].overrides.insert("repRange")
    }

    /// 0…4 reps in reserve. Marks `targetRir` as his.
    public mutating func setReserve(day: Int, at index: Int, _ value: Int) {
        guard has(day, index) else { return }
        days[day].exercises[index].targetRIR = Swift.min(4, Swift.max(0, value))
        days[day].exercises[index].overrides.insert("targetRir")
    }

    /// The starting weight: nil, or ≥ 0 kg in 0.5 steps. Never style-stamped, so no key.
    public mutating func setAnchor(day: Int, at index: Int, _ kg: Double?) {
        guard has(day, index) else { return }
        days[day].exercises[index].anchorWeightKg = kg.map { Swift.max(0, ($0 * 2).rounded() / 2) }
    }

    /// 0…4 warm-up sets. Never style-stamped, so no key.
    public mutating func setWarmups(day: Int, at index: Int, _ n: Int) {
        guard has(day, index) else { return }
        days[day].exercises[index].warmups = Swift.min(4, Swift.max(0, n))
    }

    /// „Visszaállítom az edzésmódra": all of the row's keys at once; the next save lets the style stamp the row.
    public mutating func resetToStyle(day: Int, at index: Int) {
        guard has(day, index) else { return }
        days[day].exercises[index].overrides = []
    }

    /// The small ismétlés / tartalék editor's reset (mezo-r36n9.138): only that one key (`repRange` or `targetRir`), so
    /// the row's other own values stay his.
    public mutating func resetToStyle(day: Int, at index: Int, key: String) {
        guard has(day, index) else { return }
        days[day].exercises[index].overrides.remove(key)
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
        let fresh = e.identityChanged
        var input = WireExerciseInput(
            name: e.name, muscle: e.muscleKey, warmupSets: e.warmups, workingSets: e.sets,
            repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR, anchorWeightKg: e.anchorWeightKg,
            type: e.type, warning: fresh ? nil : w.warning, catalogId: e.catalogId, countsTowardVolume: e.counts,
            trainingStyle: nil, restSec: nil, overrides: nil, technique: nil, techniqueSource: nil, challenge: nil)
        // The style trio is carried over by omission — unless his keys changed (a set count, a rep range, a reset), or
        // the row is a new identity the server has nothing to carry over to.
        // The `workingSets` key of a loaded row is decided here, against the style the save goes out with: a count he
        // stepped on an unstyled block and then styled in the same save stays his; a style cleared after a step sends
        // no key the old row did not have.
        var keys = e.overrides
        if !fresh {
            let styled = (e.ownStyle ?? style) != nil
            if styled && e.sets != w.workingSets { keys.insert("workingSets") }
            else if !styled && !(w.overrides ?? []).contains("workingSets") { keys.remove("workingSets") }
        }
        if forSave, fresh || keys != Set(w.overrides ?? []) {
            input.trainingStyle = w.trainingStyle
            input.restSec = e.restSec
            input.overrides = keys.sorted()
        }
        // The evaluator always gets the rest: its minutes model prices every set with it (mezo-r36n9.113).
        if !forSave { input.restSec = e.restSec }
        // The technique trio goes out only for a row whose technique or challenge he changed (or a new identity): an
        // untouched row omits all three, so the server carries the stored pick and its source (a planner's pick stays
        // the planner's) and may clear a stored pick that has become invalid instead of refusing the whole day. The
        // evaluator always gets the pick (it weighs a technique set against the caps).
        let samePick = e.technique == SetTechnique(wire: w.technique) && e.challenge == (w.challenge ?? false)
        guard !forSave || fresh || !samePick else { return input }
        input.technique = e.technique == .none ? nil : e.technique.rawValue
        input.challenge = e.challenge
        if !forSave {
            input.techniqueSource = w.techniqueSource
        } else if e.technique != .none || e.challenge {
            // A new identity is his choice: a carried-over planner pick becomes his.
            input.techniqueSource = samePick && !fresh ? (w.techniqueSource ?? "owner") : "owner"
        }
        return input
    }

    // MARK: what changed

    public struct Changes: Equatable, Sendable {
        /// Indexes of days whose line-up (add, remove, order, swap) or any row field changed.
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
            if day.exercises.map(\.id) != before.map(\.id)
                || zip(day.exercises, before).contains(where: { !$0.sameEdits(as: $1) }) { c.days.append(i) }
        }
        c.tiers = prioritiesWire != original.prioritiesWire
        c.sportGroups = sportGroups != original.sportGroups
        c.style = style != original.style
        c.techniquesEnabled = techniquesEnabled != original.techniquesEnabled
        c.reviewMode = reviewMode != original.reviewMode
        return c
    }

    /// Carry this draft's edits onto a freshly read block. Only what he changed against `original` moves, and per
    /// value: if the server already holds his value it stays; if the server still holds the original, his value wins;
    /// if the server changed it too (a new style re-stamped the row, a weekly proposal applied), his set-count **delta**
    /// is added to the server's value — so a style switch to two sets plus his +1 gives 3, not his old 5.
    ///
    /// A day whose line-up he changed (add, remove, order, swap) keeps his line-up — new rows included — unless the
    /// fresh read already shows it (the day's save reached the server and re-minted the ids): such a day is taken as
    /// the server has it, never re-applied.
    public func carryEdits(onto fresh: BlockDraft, original: BlockDraft) -> BlockDraft {
        var out = fresh
        let mine = Dictionary(days.flatMap(\.exercises).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let before = Dictionary(original.days.flatMap(\.exercises).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for d in out.days.indices {
            let server = out.days[d]
            if let myDay = Self.day(matching: server, in: days), let origDay = Self.day(matching: server, in: original.days),
               Self.lineUpChanged(myDay.exercises, from: origDay.exercises) {
                // The same line-up as the server's means it took the day — unless a removed-then-re-added row (`isNew`)
                // only mimics it: then the day is taken from the server only if its rows hold his very values.
                let sameLineUp = myDay.exercises.map(\.identity) == server.exercises.map(\.identity)
                if sameLineUp, !myDay.exercises.contains(where: \.isNew)
                    || zip(myDay.exercises, server.exercises).allSatisfy({ Self.sameValues($0, $1) }) { continue }
                let onServer = Dictionary(server.exercises.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
                out.days[d].exercises = myDay.exercises.map { row in
                    guard !row.identityChanged, let s = onServer[row.id], let o = before[row.id], s.identity == row.identity
                    else { return row }
                    return Self.mergeRow(mine: row, orig: o, server: s)
                }
                continue
            }
            for e in out.days[d].exercises.indices {
                let id = out.days[d].exercises[e].id
                guard let edit = mine[id], let orig = before[id], edit.identity == orig.identity else { continue }
                out.days[d].exercises[e] = Self.mergeRow(mine: edit, orig: orig, server: out.days[d].exercises[e])
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

    /// The same template day in another read: by id, else by weekday.
    private static func day(matching day: DraftDay, in list: [DraftDay]) -> DraftDay? {
        list.first { $0.id == day.id } ?? list.first { $0.weekday == day.weekday }
    }

    private static func sameValues(_ a: DraftExercise, _ b: DraftExercise) -> Bool {
        a.sets == b.sets && a.repMin == b.repMin && a.repMax == b.repMax && a.targetRIR == b.targetRIR
            && a.warmups == b.warmups && a.anchorWeightKg == b.anchorWeightKg && a.technique == b.technique
            && a.challenge == b.challenge && a.overrides == b.overrides
    }

    private static func lineUpChanged(_ rows: [DraftExercise], from before: [DraftExercise]) -> Bool {
        rows.map(\.id) != before.map(\.id) || rows.map(\.identity) != before.map(\.identity)
    }

    /// One loaded row's field edits onto the server's fresh row (see `carryEdits`).
    private static func mergeRow(mine edit: DraftExercise, orig: DraftExercise, server: DraftExercise) -> DraftExercise {
        var row = server
        row.sets = merge(mine: edit.sets, orig: orig.sets, server: server.sets) {
            min(8, max(1, server.sets + (edit.sets - orig.sets)))
        }
        if edit.technique != orig.technique || edit.challenge != orig.challenge {
            row.technique = edit.technique
            row.challenge = edit.challenge
        }
        row.repMin = merge(mine: edit.repMin, orig: orig.repMin, server: server.repMin) { edit.repMin }
        row.repMax = merge(mine: edit.repMax, orig: orig.repMax, server: server.repMax) { edit.repMax }
        row.targetRIR = merge(mine: edit.targetRIR, orig: orig.targetRIR, server: server.targetRIR) { edit.targetRIR }
        row.warmups = merge(mine: edit.warmups, orig: orig.warmups, server: server.warmups) { edit.warmups }
        row.anchorWeightKg = merge(mine: edit.anchorWeightKg, orig: orig.anchorWeightKg, server: server.anchorWeightKg) {
            edit.anchorWeightKg
        }
        if edit.overrides != orig.overrides {
            row.overrides = server.overrides.union(edit.overrides.subtracting(orig.overrides))
                .subtracting(orig.overrides.subtracting(edit.overrides))
        }
        return row
    }

    private static func merge<T: Equatable>(mine: T, orig: T, server: T, both: () -> T) -> T {
        if mine == orig || server == mine { return server }
        if server == orig { return mine }
        return both()
    }
}
