import Foundation
import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// MARK: - The import review

/// A said amount in the unit of the food it is now bound to — the phone's mirror of the server's rule (`PantryUnits`),
/// for a row the owner binds himself („Másik", „+ Kamrába"). Grams and millilitres convert inside their own family;
/// across the two (spoons against a gram food) the number is a 1:1 prefill to check; a piece, a can or no amount at all
/// stays as said and is doubtful. A doubtful amount is never saved without his look.
func reviewAmount(_ amount: Double, from said: String, into basis: String) -> (amount: Double, doubt: Bool) {
    guard amount.isFinite, amount > 0 else { return (0, true) }
    let from = said.trimmingCharacters(in: .whitespaces).lowercased(), to = basis.trimmingCharacters(in: .whitespaces).lowercased()
    if from == to { return (amount, false) }
    let mass: [String: Double] = ["g": 1, "dkg": 10, "dag": 10, "kg": 1000]
    let volume: [String: Double] = ["ml": 1, "cl": 10, "dl": 100, "l": 1000, "tk": 5, "ek": 15]
    func rounded(_ v: Double) -> Double { (v * 100).rounded() / 100 }
    if let f = mass[from], let t = mass[to] { return (rounded(amount * f / t), false) }
    if let f = volume[from], let t = volume[to] { return (rounded(amount * f / t), false) }
    if let f = mass[from] ?? volume[from], let t = mass[to] ?? volume[to] { return (rounded(amount * f / t), true) }
    return (amount, true)
}

/// One ingredient row on the review screen: what the source said, what it matched, and what the owner decided.
struct ReviewLine: Identifiable, Equatable {
    enum Mark: Equatable {
        /// Matched, and sure.
        case none
        /// Matched, but the match or the amount is doubtful: the owner must say it is right (or take the row out).
        case lowConfidence
        /// Matched nothing: it cannot be saved, and it says so.
        case unmatched
    }

    let id = UUID()
    var line: ImportedLine
    /// A row of the owner's own shelf (a workshop line); an import row carries `line.catalogId` instead.
    var pantryItemId: UUID?
    var confirmed = false
    var removed = false
    /// The food was put on the shelf from this screen with AI-estimated facts („becsült").
    var estimated = false
    /// The owner typed that food's facts himself („saját adat").
    var ownFacts = false

    /// The server flags a row at or below this confidence; the phone applies the same line to a row the server did not flag.
    static let doubtful = 0.6

    var isMatched: Bool { line.catalogId != nil || pantryItemId != nil }
    var mark: Mark {
        if !isMatched { return .unmatched }
        return line.state == .confirm || line.amountDoubt || line.needsReview || line.confidence <= Self.doubtful ? .lowConfidence : .none
    }
    var isMarked: Bool { mark != .none }
    /// A row with a food but no amount: nothing was stated, and the server refuses a zero. It must be typed.
    var needsAmount: Bool { isMatched && !(line.amount > 0) }
    /// A doubtful row that nobody has looked at yet, or one still without an amount — the only kinds that hold the save back.
    var awaitsConfirmation: Bool { !removed && isMatched && (needsAmount || (mark == .lowConfidence && !confirmed)) }
    /// Whether this row goes into the saved recipe.
    var willSave: Bool { !removed && isMatched && !awaitsConfirmation }
}

/// The reviewed recipe: the draft every route ends in (a page, pasted text, a photo, the workshop, „Ezt főztem"), edited
/// by the owner, then saved once. The server does not check that a doubtful row was looked at — this type is that check.
struct RecipeReview: Equatable {
    var name: String
    var category: String
    var servings: Int
    var steps: [String]
    var sourceUrl: String?
    var lines: [ReviewLine]
    /// The save's idempotency key: every save of this review is the same recipe (a double tap, a lost answer).
    let clientRef = UUID()
    /// The finished dish's weight when the source stated it.
    private(set) var statedCookedWeightG: Double?
    /// The owner said he knows a large share of the rows is not in the recipe (see `needsLeftOutAcknowledgement`).
    private(set) var leftOutAcknowledged = false

    init(draft: RecipeImportDraft) {
        name = draft.name; category = draft.category; servings = draft.servings; steps = draft.steps
        sourceUrl = draft.sourceUrl; statedCookedWeightG = draft.cookedWeightG
        lines = draft.lines.map { ReviewLine(line: $0) }
    }

    /// A workshop draft: its shelf lines are matched, its estimate lines are missing (the server needs a food to save a
    /// line) — the phone derives the state, the workshop's contract carries none.
    init(workshop d: WorkshopDraft) {
        name = d.name; category = d.category; servings = d.servings; steps = d.steps; sourceUrl = nil; statedCookedWeightG = nil
        lines = d.lines.map { w in
            let shelf = w.source == "pantry" ? w.pantryItemId : nil
            return ReviewLine(line: ImportedLine(name: w.name, amount: w.amount, unit: w.unit, catalogId: nil,
                                                 confidence: shelf == nil ? 0 : 1, needsReview: shelf == nil,
                                                 state: shelf == nil ? .missing : .matched, onShelf: shelf != nil,
                                                 basisUnit: shelf == nil ? nil : w.unit), pantryItemId: shelf)
        }
    }

    // MARK: what the screen shows

    /// Rows carrying a mark (doubtful or unmatched), whatever the owner decided about them.
    var markedCount: Int { lines.filter { $0.isMarked && !$0.removed }.count }
    /// Rows still waiting for the owner's look — what the header counts; it reaches zero as he goes. An unmatched row
    /// needs no look (it is left out and says so).
    var toReviewCount: Int { pendingConfirmation.count }
    /// Rows that matched nothing and were not taken out by the owner: they are not in the saved recipe.
    var unmatchedLeftOut: [ReviewLine] { lines.filter { !$0.isMatched && !$0.removed } }
    /// A large share of the recipe is left out, so its numbers and score would look authoritative and be wrong: the owner
    /// must say he knows before saving. Large = at least two rows and a quarter of the rows still in play.
    var needsLeftOutAcknowledgement: Bool {
        let inPlay = lines.filter { !$0.removed }.count
        return unmatchedLeftOut.count >= 2 && inPlay > 0 && Double(unmatchedLeftOut.count) / Double(inPlay) >= 0.25
    }
    /// The plain warning, e.g. "7 hozzávaló kimarad — a recept számai ennyivel kevesebbet mutatnak."
    var leftOutWarning: String? {
        needsLeftOutAcknowledgement
            ? "\(unmatchedLeftOut.count) hozzávaló kimarad — a recept számai ennyivel kevesebbet mutatnak, mint amit valójában megennél."
            : nil
    }
    var pendingConfirmation: [ReviewLine] { lines.filter(\.awaitsConfirmation) }
    /// Rows waiting that one „Mind rendben" can clear (a row without an amount cannot be: it must be typed).
    var confirmableCount: Int { pendingConfirmation.filter { !$0.needsAmount }.count }
    /// Rows the saved recipe will not contain: matched nothing, or taken out by the owner.
    var leftOut: [ReviewLine] { lines.filter { !$0.willSave && !$0.awaitsConfirmation } }
    var savedLines: [ReviewLine] { lines.filter(\.willSave) }

    var canSave: Bool { saveBlocker == nil }

    /// Why the save button is held back (nil = it is not). Only an unconfirmed doubtful row, a missing amount and an
    /// empty recipe hold it: a row that matched nothing blocks nothing, it simply is not saved.
    var saveBlocker: String? {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Adj nevet a receptnek." }
        let waiting = pendingConfirmation
        if !waiting.isEmpty {
            let names = waiting.prefix(3).map(\.line.name).joined(separator: ", ")
            if waiting.allSatisfy(\.needsAmount) {
                return "Írd be a mennyiséget: \(names)\(waiting.count > 3 ? "…" : ""). Amíg nincs, nem mentem."
            }
            return waiting.count == 1
                ? "Nézd át a jelölt hozzávalót: \(names). Ha jó, jelöld meg, vagy vedd ki."
                : "Nézd át a jelölt hozzávalókat: \(names)\(waiting.count > 3 ? "…" : ""). Ha jók, jelöld meg őket, vagy vedd ki."
        }
        if savedLines.isEmpty { return "Egyik hozzávalót sem tudtam a kamrádhoz kötni, ezért nincs mit elmenteni." }
        if needsLeftOutAcknowledgement && !leftOutAcknowledged { return (leftOutWarning ?? "") + " Jelöld meg, hogy tudod, ha így is mented." }
        return nil
    }

    /// The honest line under the list when some rows will not be in the saved recipe.
    var leftOutNote: String? {
        let names = leftOut.map(\.line.name)
        guard !names.isEmpty else { return nil }
        let unmatched = leftOut.filter { !$0.removed && !$0.isMatched }.map(\.line.name)
        guard !unmatched.isEmpty else { return nil }
        return "Nem kerül a receptbe, mert nincs a kamrádban: \(unmatched.joined(separator: ", ")). A receptet így is elmentem."
    }

    // MARK: the weight of the finished dish

    /// Grams and millilitres of what will be saved (a kilo counts a thousand); a piece or a bunch cannot be weighed and stays out.
    var rawWeightG: Double {
        savedLines.reduce(0) { sum, l in
            switch l.line.unit.lowercased() {
            case "g", "ml": sum + l.line.amount
            case "kg", "l": sum + l.line.amount * 1000
            case "dkg": sum + l.line.amount * 10
            case "dl": sum + l.line.amount * 100
            case "cl": sum + l.line.amount * 10
            default: sum
            }
        }
    }
    /// The finished dish's weight: what the source stated, else the raw sum (the owner can weigh the real thing later).
    var cookedWeightG: Double { statedCookedWeightG ?? rawWeightG }
    var cookedWeightIsEstimate: Bool { statedCookedWeightG == nil }

    // MARK: what the owner can do

    mutating func acknowledgeLeftOut(_ on: Bool = true) { leftOutAcknowledged = on }
    mutating func confirm(_ id: UUID) { update(id) { $0.confirmed = true } }
    /// „Mind rendben": every waiting row at once — except one that still has no amount.
    mutating func confirmAll() {
        for l in lines where l.awaitsConfirmation && !l.needsAmount { update(l.id) { $0.confirmed = true } }
    }
    mutating func remove(_ id: UUID) { update(id) { $0.removed = true } }
    mutating func restore(_ id: UUID) { update(id) { $0.removed = false } }
    mutating func setAmount(_ id: UUID, _ amount: Double) {
        // The server refuses an amount of zero or less; the field keeps the last good one.
        guard amount.isFinite, amount > 0 else { return }
        // A changed amount is a new decision: a doubtful row must be looked at again.
        update(id) { $0.line.amount = amount; if $0.mark == .lowConfidence { $0.confirmed = false } }
    }

    /// „Másik": the row is this food now — its name, its id and its own unit. The owner picked it, so the match is his;
    /// only an amount that does not convert cleanly into the new unit still needs his look.
    mutating func relink(_ id: UUID, to choice: FoodChoice, onShelf: Bool = false, allergens: [String: AllergenState]? = nil) {
        update(id) { l in
            Self.bind(&l, catalogId: choice.id, name: choice.name, basis: choice.basisUnit, onShelf: onShelf, allergens: allergens)
            l.estimated = false; l.ownFacts = false
        }
    }

    /// „+ Kamrába" worked: the row has the food that was just put on the shelf (tagged „becsült" when its facts are an estimate).
    mutating func quickAdded(_ id: UUID, row: PantryRow) {
        guard let catalogId = row.catalogId else { return }
        update(id) { l in
            Self.bind(&l, catalogId: catalogId, name: row.name, basis: row.unit ?? "g", onShelf: true, allergens: row.allergens)
            l.estimated = row.estimated; l.ownFacts = false
        }
    }

    /// The owner typed the facts of a food added from this screen: it is his own data now, not an estimate.
    mutating func factsTyped(_ id: UUID) { update(id) { $0.estimated = false; $0.ownFacts = true } }

    private static func bind(_ l: inout ReviewLine, catalogId: UUID, name: String, basis: String, onShelf: Bool, allergens: [String: AllergenState]?) {
        // a row that already had a food carries its amount in that food's unit, with the doubt the server found in it
        let carried = l.isMatched && l.line.amountDoubt
        let converted = reviewAmount(l.line.amount, from: l.line.unit, into: basis)
        let doubt = converted.doubt || carried
        l.line.name = name; l.line.catalogId = catalogId; l.pantryItemId = nil
        l.line.amount = converted.amount; l.line.unit = basis; l.line.basisUnit = basis
        l.line.amountDoubt = doubt
        l.line.state = doubt ? .confirm : .matched
        l.line.confidence = 1; l.line.needsReview = doubt
        l.line.onShelf = onShelf; l.line.allergens = allergens
        l.confirmed = !doubt; l.removed = false
    }

    private mutating func update(_ id: UUID, _ change: (inout ReviewLine) -> Void) {
        guard let i = lines.firstIndex(where: { $0.id == id }) else { return }
        let before = unmatchedLeftOut.map(\.id)
        change(&lines[i])
        // the owner's "I know" was about those rows: when they change, he is asked again
        if unmatchedLeftOut.map(\.id) != before { leftOutAcknowledged = false }
    }

    /// The one save every route ends in: the rows that will be saved, in order, with the owner's edits.
    func request() -> NewRecipe {
        NewRecipe(name: name.trimmingCharacters(in: .whitespacesAndNewlines), category: category, servings: max(servings, 1),
                  steps: steps, sourceUrl: sourceUrl,
                  lines: savedLines.map { NewRecipeLine(catalogId: $0.line.catalogId, pantryItemId: $0.line.catalogId == nil ? $0.pantryItemId : nil,
                                                       amount: $0.line.amount, unit: $0.line.unit) },
                  clientRef: clientRef)
    }
}

// MARK: - What a review row shows

/// One row's face, as plain values (the view only draws it): the state dot, the said phrase, the facts as pills, the
/// unit, and what the owner can do with it. No number is ever printed about a food added from this screen.
struct ReviewRowFace: Equatable {
    enum Dot: Equatable { case done, ask, add, off }
    enum Action: Equatable { case confirm, quickAdd, other, remove, restore }
    struct Pill: Equatable, Identifiable {
        let text: String
        let tone: EtelPill.Tone
        var glyph: String? = nil
        var id: String { text }
    }
    var dot: Dot
    /// What he said (or the source wrote), shown in quotes on every row that has it.
    var said: String?
    var pills: [Pill]
    var unit: String
    /// Once the row has a food, its unit is that food's own — a label, not a choice.
    var unitFixed: Bool
    /// The row holds the save until he looks: amber border.
    var needsLook: Bool
    var actions: [Action]
    /// The quiet door to the facts of a food added from this screen; nil when it is not such a row.
    var factsLink: String?
}

func reviewRowFace(_ l: ReviewLine) -> ReviewRowFace {
    let said = l.line.sourceText.flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
    let added = l.estimated || l.ownFacts
    if l.removed {
        return ReviewRowFace(dot: .off, said: said, pills: [.init(text: "kivetted", tone: .muted)], unit: l.line.unit, unitFixed: l.isMatched,
                             needsLook: false, actions: [.restore], factsLink: nil)
    }
    var pills: [ReviewRowFace.Pill] = []
    switch l.mark {
    case .unmatched:
        pills.append(.init(text: "nincs a kamrádban", tone: .muted))
        return ReviewRowFace(dot: .add, said: said, pills: pills, unit: l.line.unit, unitFixed: false, needsLook: false,
                             actions: [.quickAdd, .other, .remove], factsLink: nil)
    case .none, .lowConfidence:
        if l.estimated { pills.append(.init(text: "becsült", tone: .warn)) }
        if l.ownFacts { pills.append(.init(text: "saját adat", tone: .hue)) }
        if !l.line.onShelf && !added && l.pantryItemId == nil { pills.append(.init(text: "felveszem a kamrádba", tone: .plain)) }
        if l.awaitsConfirmation {
            // an AI pick (or a match the server doubted) asks "is this it?"; an amount that did not convert asks for a look
            if l.needsAmount { pills.append(.init(text: "írd be a mennyiséget", tone: .warn)) }
            else if l.line.amountDoubt { pills.append(.init(text: "mennyiség?", tone: .warn)) }
            if !l.confirmed && (l.line.confidence < 1 || (l.line.needsReview && !l.line.amountDoubt)) {
                pills.insert(.init(text: "ez az?", tone: .warn), at: pills.count - (l.needsAmount || l.line.amountDoubt ? 1 : 0))
            }
        } else if l.mark == .lowConfidence {
            pills.append(.init(text: "rendben", tone: .hue, glyph: "check-sage"))
        }
        let waiting = l.awaitsConfirmation
        // „Ez az" confirms a doubt; a row that only lacks an amount has nothing to confirm until it is typed
        let actions: [ReviewRowFace.Action] = waiting ? ((l.confirmed || l.needsAmount ? [] : [.confirm]) + [.other, .remove]) : [.other, .remove]
        return ReviewRowFace(dot: waiting ? .ask : .done, said: said, pills: pills, unit: l.line.unit, unitFixed: true, needsLook: waiting,
                             actions: actions, factsLink: added ? (l.ownFacts ? "Tápérték átírása" : "Tápérték megadása") : nil)
    }
}

/// The summary over the rows, as pills: how many, how many wait for him, how many are not in the pantry.
func reviewSummaryPills(_ review: RecipeReview) -> [ReviewRowFace.Pill] {
    let inPlay = review.lines.filter { !$0.removed }.count
    let waiting = review.toReviewCount, missing = review.unmatchedLeftOut.count
    var out: [ReviewRowFace.Pill] = [.init(text: "\(inPlay) hozzávaló", tone: .plain)]
    if waiting > 0 { out.append(.init(text: "\(waiting) megerősítésre vár", tone: .warn)) }
    if missing > 0 { out.append(.init(text: "\(missing) nincs a kamrádban", tone: .muted)) }
    if waiting == 0 && missing == 0 && inPlay > 0 { out.append(.init(text: "mind a kamrádból", tone: .hue, glyph: "check-sage")) }
    return out
}

// MARK: - Allergens on the review (before the save, not after)

/// One allergen the owner watches that some rows of the draft contain (or may contain).
struct ReviewAllergenWarning: Equatable, Identifiable {
    let text: String
    let severity: SensitivityRules.Badge.Severity
    let lineNames: [String]
    var id: String { text }
}

/// The badges of one row against the owner's profile (silence when the row says nothing; `reviewNoDataLines` names it).
func reviewLineBadges(_ line: ReviewLine, profile: SensitivityProfile?) -> [DraftBadge] {
    guard let profile, let map = line.line.allergens, !line.removed else { return [] }
    return SensitivityRules.badges(allergens: map, profile: profile).filter { $0.severity != .noData }.map {
        DraftBadge(text: "\(allergenName($0.key ?? "")) · \($0.text)",
                   tone: $0.severity == .block ? .stop : ($0.severity == .warn ? .warn : .notice))
    }
}

/// What the owner's rules find in the rows still in the draft, grouped by what they found.
func reviewAllergenWarnings(_ review: RecipeReview, profile: SensitivityProfile?) -> [ReviewAllergenWarning] {
    guard let profile else { return [] }
    var groups: [String: (severity: SensitivityRules.Badge.Severity, names: [String])] = [:]
    var order: [String] = []
    for l in review.lines where !l.removed {
        guard let map = l.line.allergens else { continue }
        for b in SensitivityRules.badges(allergens: map, profile: profile) where b.severity != .noData {
            let text = "\(allergenName(b.key ?? "")) · \(b.text)"
            if groups[text] == nil { order.append(text); groups[text] = (b.severity, []) }
            groups[text]?.names.append(l.line.name)
        }
    }
    return order.compactMap { t in groups[t].map { ReviewAllergenWarning(text: t, severity: $0.severity, lineNames: $0.names) } }
}

/// The rows that tell nothing about allergens (matched nothing, or a food with no declared states) — said out loud, never
/// read as "free of". Only when the owner has allergen rules at all.
func reviewNoDataLines(_ review: RecipeReview, profile: SensitivityProfile?) -> [String] {
    guard let profile else { return [] }
    let watched = profile.items.filter(\.isStructured).map { $0.key.lowercased() }
    guard !watched.isEmpty else { return [] }
    // a row is silent when it has no map at all, or its map lacks (or marks unknown) a key the owner watches
    return review.lines.filter { l in
        guard !l.removed else { return false }
        guard let map = l.line.allergens else { return true }
        return watched.contains { (map[$0] ?? .unknown) == .unknown }
    }.map(\.line.name)
}

// MARK: - The sheet's state

/// The pantry form that opens over the review (a sheet over the sheet), for one row.
enum ReviewFoodForm: Identifiable, Equatable {
    /// „+ Kamrába" hit a name it may not bind: the normal add form, with the name filled in.
    case add(line: UUID, name: String)
    /// „Minden adat a kamrában": the full form of a food added from this screen.
    case replace(line: UUID, row: PantryRow)
    var id: String {
        switch self {
        case .add(let line, _): "add-\(line)"
        case .replace(let line, _): "replace-\(line)"
        }
    }
}

/// The import sheet's state, apart from any view: read a link, pasted text or a photo, review, save once. The review
/// part serves every entrance (import, the workshop, „Ezt főztem"): confirm, re-pick, one-tap add, typed facts.
@MainActor @Observable
final class RecipeImportModel {
    enum Stage: Equatable {
        case input
        case working
        case review
        /// The source held no recipe the phone could read.
        case empty
        case failed(String)
    }
    enum Mode: Equatable { case link, text, photo }

    private(set) var stage: Stage = .input
    var mode: Mode
    var link = ""
    var pasted = ""
    var review: RecipeReview?
    private(set) var saving = false
    private(set) var saveProblem: String?
    private(set) var saved: Recipe?
    /// Rows whose „+ Kamrába" is in flight, and what the last try of a row said when it failed.
    private(set) var adding: Set<UUID> = []
    private(set) var addProblems: [UUID: String] = [:]
    /// The foods put on the shelf from this review, by row (their facts can be typed here).
    private(set) var added: [UUID: PantryRow] = [:]
    private(set) var savingFacts: Set<UUID> = []
    private(set) var factsProblems: [UUID: String] = [:]
    /// The pantry form open over the review; the host presents it at the sheet's own level.
    var foodForm: ReviewFoodForm?
    /// What the eyebrow says: where the draft came from.
    let eyebrow: String

    private let reader: @Sendable (RecipeImportSource) async throws -> RecipeImportDraft?
    private let saver: @Sendable (NewRecipe) async throws -> Recipe
    private let adder: @Sendable (String) async throws -> PantryRow
    private let factsSaver: @Sendable (FoodFacts, PantryRow) async throws -> PantryRow
    private let searcher: @Sendable (String) async throws -> [PantryRow]

    init(mode: Mode, reader: @escaping @Sendable (RecipeImportSource) async throws -> RecipeImportDraft?,
         saver: @escaping @Sendable (NewRecipe) async throws -> Recipe, review: RecipeReview? = nil, eyebrow: String? = nil,
         adder: @escaping @Sendable (String) async throws -> PantryRow = { _ in throw FoodFetchError.unauthorized },
         factsSaver: @escaping @Sendable (FoodFacts, PantryRow) async throws -> PantryRow = { _, _ in throw FoodFetchError.unauthorized },
         searcher: @escaping @Sendable (String) async throws -> [PantryRow] = { _ in [] }) {
        self.mode = mode; self.reader = reader; self.saver = saver; self.review = review
        self.adder = adder; self.factsSaver = factsSaver; self.searcher = searcher
        self.eyebrow = eyebrow ?? (mode == .link ? "RECEPT LINKRŐL" : mode == .text ? "RECEPT SZÖVEGBŐL" : "RECEPT FOTÓRÓL")
        if review != nil { stage = .review }
    }

    /// Wired to the signed-in owner's food client (nil = signed out: every call says so).
    convenience init(mode: Mode, food: FoodClient?, review: RecipeReview? = nil, eyebrow: String? = nil) {
        self.init(
            mode: mode,
            reader: { source in
                guard let food else { throw FoodFetchError.unauthorized }
                return try await food.importRecipe(source)
            },
            saver: { recipe in
                guard let food else { throw FoodFetchError.unauthorized }
                return try await food.createRecipe(recipe)
            },
            review: review, eyebrow: eyebrow,
            adder: { name in
                guard let food else { throw FoodFetchError.unauthorized }
                return try await food.quickAddPantry(name: name)
            },
            factsSaver: { facts, row in
                guard let food else { throw FoodFetchError.unauthorized }
                return try await food.setFacts(facts, of: row)
            },
            searcher: { query in
                guard let food else { throw FoodFetchError.unauthorized }
                // his own shelf first (it holds his own unreviewed foods), then the shared list behind it
                let shelf = filterShelf(try await food.pantry().filter { $0.kind == "food" }, query: query, category: nil)
                let catalog = (try? await food.pantry(query: query).filter { $0.kind == "food" }) ?? []
                return Array((shelf + catalogOnly(catalog, shelf: shelf)).prefix(12))
            })
    }

    var canRead: Bool {
        switch mode {
        case .link: !link.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .text: !pasted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .photo: false
        }
    }

    func read() async {
        switch mode {
        case .link: await read(.url(link.trimmingCharacters(in: .whitespacesAndNewlines)))
        case .text: await read(.text(pasted.trimmingCharacters(in: .whitespacesAndNewlines)))
        case .photo: break
        }
    }

    func read(_ source: RecipeImportSource) async {
        guard stage != .working else { return }
        stage = .working
        do {
            if let draft = try await reader(source) {
                review = RecipeReview(draft: draft)
                stage = .review
            } else {
                stage = .empty
            }
        } catch let e as FoodFetchError {
            stage = .failed(importProblemLine(e, source: source))
        } catch {
            stage = .failed(importProblemLine(.server, source: source))
        }
    }

    func back() { stage = .input; review = nil; saveProblem = nil; adding = []; addProblems = [:]; added = [:]; factsProblems = [:] }

    /// The one save. A second tap while the first is in flight does nothing; a failure leaves the review as it was. A
    /// retry after a lost answer carries the same key, so it is the same recipe.
    func save() async -> Recipe? {
        // a recipe this review already saved is never saved (or handed on) a second time
        guard !saving, saved == nil, let review, review.canSave else { return nil }
        saving = true; saveProblem = nil
        defer { saving = false }
        do {
            let recipe = try await saver(review.request())
            saved = recipe
            return recipe
        } catch let e as FoodFetchError {
            saveProblem = e == .offline ? "Nincs net — a recept megvár, próbáld újra, ha van." : "Nem sikerült elmenteni — próbáld újra."
            return nil
        } catch {
            saveProblem = "Nem sikerült elmenteni — próbáld újra."
            return nil
        }
    }

    // MARK: edits (each one routes through the review's own rules)

    func acknowledgeLeftOut(_ on: Bool) { review?.acknowledgeLeftOut(on) }
    func confirm(_ id: UUID) { review?.confirm(id) }
    func confirmAll() { review?.confirmAll() }
    func remove(_ id: UUID) { review?.remove(id) }
    func restore(_ id: UUID) { review?.restore(id) }
    func setAmount(_ id: UUID, _ amount: Double) { review?.setAmount(id, amount) }

    /// „Másik": the row takes the picked food (a shelf row or a catalog hit).
    func relink(_ id: UUID, to row: PantryRow) {
        guard let choice = FoodChoice(row: row) else { return }
        review?.relink(id, to: choice, onShelf: row.onShelf, allergens: row.allergens)
        added[id] = nil; addProblems[id] = nil
    }

    /// „Másik": one of the row's own alternatives (the server sent no more than its name and unit).
    func relink(_ id: UUID, to choice: FoodChoice) {
        review?.relink(id, to: choice)
        added[id] = nil; addProblems[id] = nil
    }

    /// What „Másik" searches: his shelf, then the shared list. Empty for a query too short to mean anything.
    func search(_ query: String) async throws -> [PantryRow] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return [] }
        return try await searcher(q)
    }

    /// „+ Kamrába": one tap puts the row's food on the shelf. A second tap while it runs does nothing (and the server
    /// answers a repeat with the same food). A name the quick way may not bind opens the normal add form instead.
    func quickAdd(_ id: UUID) async {
        guard let line = review?.lines.first(where: { $0.id == id }), !line.isMatched, !line.removed, !adding.contains(id) else { return }
        adding.insert(id); addProblems[id] = nil
        defer { adding.remove(id) }
        do {
            let row = try await adder(line.line.name)
            added[id] = row
            review?.quickAdded(id, row: row)
        } catch FoodFetchError.conflict {
            foodForm = .add(line: id, name: line.line.name)
        } catch FoodFetchError.offline {
            addProblems[id] = "Nincs net — a felvételhez kell."
        } catch FoodFetchError.unavailable {
            addProblems[id] = "Boop most nem tudja megbecsülni. Nem sikerült felvenni."
        } catch {
            addProblems[id] = "Nem sikerült felvenni."
        }
    }

    /// The normal add form saved a food for this row (after a name collision).
    func formAdded(_ id: UUID, row: PantryRow) {
        added[id] = row
        review?.quickAdded(id, row: row)
        foodForm = nil
    }

    /// The full pantry form replaced the facts of a food added from this screen.
    func formReplaced(_ id: UUID, row: PantryRow) {
        added[id] = row
        review?.factsTyped(id)
        foodForm = nil
    }

    /// The four facts as the food has them now (the estimate, or what he typed): what the facts block opens with.
    func facts(of id: UUID) -> FoodFacts? {
        added[id].map { FoodFacts(kcal: $0.kcal ?? 0, proteinG: $0.proteinG ?? 0, carbsG: $0.carbsG ?? 0, fatG: $0.fatG ?? 0) }
    }

    /// „Kész" on the facts block: saves only when he changed a number; the food is his own data from then on.
    /// Returns false when the save did not go through (the block stays open and says why).
    func saveFacts(_ id: UUID, _ facts: FoodFacts) async -> Bool {
        guard let row = added[id], !savingFacts.contains(id) else { return false }
        guard facts != self.facts(of: id) else { factsProblems[id] = nil; return true }
        guard [facts.kcal, facts.proteinG, facts.carbsG, facts.fatG].allSatisfy({ $0.isFinite && $0 >= 0 }) else {
            factsProblems[id] = "Egyik szám sem lehet negatív."
            return false
        }
        savingFacts.insert(id); factsProblems[id] = nil
        defer { savingFacts.remove(id) }
        do {
            added[id] = try await factsSaver(facts, row)
            review?.factsTyped(id)
            return true
        } catch FoodFetchError.offline {
            factsProblems[id] = "Nincs net — a számok itt maradnak, próbáld újra."
        } catch {
            factsProblems[id] = "Nem sikerült elmenteni — próbáld újra."
        }
        return false
    }
}

/// What the sheet says when a source could not be read.
func importProblemLine(_ e: FoodFetchError, source: RecipeImportSource) -> String {
    switch e {
    case .offline: "Nincs net. Nézd meg, és próbáld újra."
    case .unauthorized: "A belépésed lejárt — lépj be újra."
    case .rejected:
        switch source {
        case .url: "Ez nem egy olyan weboldal-cím, amit meg tudok nyitni. Egy http(s) linket várok."
        case .text: "Ez a szöveg üres vagy túl hosszú."
        case .photo: "Ezt a képet nem tudom beolvasni. JPEG vagy PNG kell."
        }
    case .unavailable:
        switch source {
        case .url: "Most nem érem el az oldalt, vagy nem tudom elolvasni. Próbáld újra, vagy másold be a szöveget."
        default: "Most nem tudom elolvasni — Boop nem érhető el. Próbáld újra később."
        }
    default: "Most nem jön válasz. Próbáld újra egy kicsit később."
    }
}

// MARK: - The sheet

/// The import sheet (spike `ERecipeImport`): ask for a link, text or a photo, then the review — every ingredient row says
/// what it matched; a doubtful row must be confirmed, an unmatched one is left out and says so.
struct RecipeImportSheet: View {
    @Bindable var model: RecipeImportModel
    /// The owner's allergen rules, for the warnings on the review.
    var profile: SensitivityProfile? = nil
    /// Called with the saved recipe once the owner's tap has saved it.
    let onSaved: (Recipe) -> Void
    /// „Mentem, és rögzítem mára": saved, and one serving goes into today.
    var onSavedLog: ((Recipe) -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showLibrary = false
    @State private var showCamera = false
    @FocusState private var typing: Bool

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: model.eyebrow, title: title) {
            switch model.stage {
            case .input: input
            case .working: working
            case .review: ReviewBody(model: model, profile: profile, onSaved: onSaved, onSavedLog: onSavedLog)
            case .empty:
                notice("Nem találtam ebben receptet.", "Nem hozzávalók és lépések vannak rajta, vagy nem tudtam elolvasni. Próbálj másik oldalt, másold be a szöveget, vagy fotózd le.",
                       action: "Másik forrás") { model.back() }
            case .failed(let line):
                notice("Nem sikerült beolvasni.", line, action: "Vissza") { model.back() }
            }
        }
        .reviewFoodForm(model, profile: profile)
        .scrollDismissesKeyboard(.interactively)
        .mealPhotoLibrary(isPresented: $showLibrary) { data in
            guard let data, let jpeg = MealPhoto.jpeg(from: data) else { return }
            Task { await model.read(.photo(jpeg)) }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(onPick: { data in
                showCamera = false
                if let jpeg = MealPhoto.jpeg(from: data) { Task { await model.read(.photo(jpeg)) } }
            }, onCancel: { showCamera = false }).ignoresSafeArea()
        }
        #if DEBUG
        .task {
            // `-etelImportRun YES`: read the sample link straight away (the preview server answers a draft).
            guard UserDefaults.standard.bool(forKey: "etelImportRun"), model.stage == .input else { return }
            model.link = "https://pelda.hu/gorog-csirkesalata"
            await model.read()
        }
        #endif
        .onAppear { if model.mode == .photo, model.stage == .input { if PhotoCapture.cameraAvailable { showCamera = true } else { showLibrary = true } } }
    }

    private var title: String {
        if let r = model.review, model.stage == .review { return r.name.isEmpty ? "Új recept" : r.name }
        return model.mode == .photo ? "Lefotózom a receptet" : "Új recept"
    }

    // MARK: input

    @ViewBuilder private var input: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                modeChip("Link", .link); modeChip("Szöveg", .text); modeChip("Fotó", .photo)
            }
            switch model.mode {
            case .link:
                HStack(spacing: 10) {
                    NKGlyph("link-deep", .white.opacity(0.6), size: 16)
                    TextField("", text: $model.link, prompt: Text("https://…").foregroundStyle(.white.opacity(0.4)))
                        .nkFont(14).foregroundStyle(.white).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .focused($typing).submitLabel(.go).onSubmit { Task { await model.read() } }
                        .accessibilityLabel("A receptoldal címe")
                }
                .padding(.horizontal, 16).frame(minHeight: 48).background(Capsule().fill(.white.opacity(0.08)))
                Text("Ha az oldal gépileg olvasható receptet ad, azt veszem át; ha nem, Boop elolvassa az oldalt. Semmi nem mentődik, amíg nem mented.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                NKPill("Kiolvasom") { typing = false; Task { await model.read() } }.disabled(!model.canRead).opacity(model.canRead ? 1 : 0.4)
            case .text:
                TextEditor(text: $model.pasted).scrollContentBackground(.hidden).focused($typing)
                    .nkFont(14).foregroundStyle(.white).frame(minHeight: 150).padding(10)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
                    .accessibilityLabel("A recept szövege")
                NKPill("Kiolvasom") { typing = false; Task { await model.read() } }.disabled(!model.canRead).opacity(model.canRead ? 1 : 0.4)
            case .photo:
                Text("Fotózz le egy könyvoldalt vagy egy képernyőt. A fotót csak elolvasom, nem őrzöm meg.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                if PhotoCapture.cameraAvailable { NKPill("Fotózok", glyph: "camera-ink") { showCamera = true } }
                NKPill("Kiválasztok egyet", primary: !PhotoCapture.cameraAvailable) { showLibrary = true }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func modeChip(_ label: String, _ mode: RecipeImportModel.Mode) -> some View {
        let on = model.mode == mode
        return Button { model.mode = mode } label: {
            Text(label).nkFont(14, on ? .semibold : .regular).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                .padding(.horizontal, 15).padding(.vertical, 8).background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
        }
        .buttonStyle(.plain).accessibilityAddTraits(on ? .isSelected : [])
    }

    private var working: some View {
        HStack(spacing: 12) {
            ProgressView().tint(.white)
            Text("Olvasom a receptet…").nkFont(15).foregroundStyle(.white.opacity(0.8))
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        .accessibilityElement(children: .combine)
    }

    private func notice(_ head: String, _ body: String, action: String, onTap: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(head).nkFont(17, .medium).foregroundStyle(.white)
            Text(body).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            NKPill(action, primary: false, wide: false, action: onTap)
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}
