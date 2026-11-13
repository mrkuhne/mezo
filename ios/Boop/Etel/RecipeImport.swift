import Foundation
import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// MARK: - The import review

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

    /// The server flags a row at or below this confidence; the phone applies the same line to a row the server did not flag.
    static let doubtful = 0.6

    var isMatched: Bool { line.catalogId != nil || pantryItemId != nil }
    var mark: Mark {
        if !isMatched { return .unmatched }
        return line.needsReview || line.confidence <= Self.doubtful ? .lowConfidence : .none
    }
    var isMarked: Bool { mark != .none }
    /// A doubtful row that nobody has looked at yet — the only kind that holds the save back.
    var awaitsConfirmation: Bool { mark == .lowConfidence && !confirmed && !removed }
    /// Whether this row goes into the saved recipe.
    var willSave: Bool { !removed && isMatched && (mark != .lowConfidence || confirmed) }
}

/// The reviewed recipe: the draft every route ends in (a page, pasted text, a photo, the workshop), edited by the owner,
/// then saved once. The server does not check that a doubtful row was looked at — this type is that check.
struct RecipeReview: Equatable {
    var name: String
    var category: String
    var servings: Int
    var steps: [String]
    var sourceUrl: String?
    var lines: [ReviewLine]
    /// The finished dish's weight when the source stated it.
    private(set) var statedCookedWeightG: Double?
    /// The owner said he knows a large share of the rows is not in the recipe (see `needsLeftOutAcknowledgement`).
    private(set) var leftOutAcknowledged = false

    init(draft: RecipeImportDraft) {
        name = draft.name; category = draft.category; servings = draft.servings; steps = draft.steps
        sourceUrl = draft.sourceUrl; statedCookedWeightG = draft.cookedWeightG
        lines = draft.lines.map { ReviewLine(line: $0) }
    }

    /// A workshop draft: its shelf lines are matched, its estimate lines are not (the server needs a food to save a line).
    init(workshop d: WorkshopDraft) {
        name = d.name; category = d.category; servings = d.servings; steps = d.steps; sourceUrl = nil; statedCookedWeightG = nil
        lines = d.lines.map { w in
            let shelf = w.source == "pantry" ? w.pantryItemId : nil
            return ReviewLine(line: ImportedLine(name: w.name, amount: w.amount, unit: w.unit, catalogId: nil,
                                                 confidence: shelf == nil ? 0 : 1, needsReview: shelf == nil), pantryItemId: shelf)
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
    /// Rows the saved recipe will not contain: matched nothing, or taken out by the owner.
    var leftOut: [ReviewLine] { lines.filter { !$0.willSave && !$0.awaitsConfirmation } }
    var savedLines: [ReviewLine] { lines.filter(\.willSave) }

    var canSave: Bool { saveBlocker == nil }

    /// Why the save button is held back (nil = it is not). Only an unconfirmed doubtful row and an empty recipe hold it:
    /// a row that matched nothing blocks nothing, it simply is not saved.
    var saveBlocker: String? {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Adj nevet a receptnek." }
        let waiting = pendingConfirmation
        if !waiting.isEmpty {
            let names = waiting.prefix(3).map(\.line.name).joined(separator: ", ")
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
    mutating func remove(_ id: UUID) { update(id) { $0.removed = true } }
    mutating func restore(_ id: UUID) { update(id) { $0.removed = false } }
    mutating func setAmount(_ id: UUID, _ amount: Double) {
        // The server refuses an amount of zero or less; the field keeps the last good one.
        guard amount.isFinite, amount > 0 else { return }
        // A changed amount is a new decision: a doubtful row must be looked at again.
        update(id) { $0.line.amount = amount; if $0.mark == .lowConfidence { $0.confirmed = false } }
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
                                                       amount: $0.line.amount, unit: $0.line.unit) })
    }
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

/// The import sheet's state, apart from any view: read a link, pasted text or a photo, review, save once.
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
    /// What the eyebrow says: where the draft came from.
    let eyebrow: String

    private let reader: @Sendable (RecipeImportSource) async throws -> RecipeImportDraft?
    private let saver: @Sendable (NewRecipe) async throws -> Recipe

    init(mode: Mode, reader: @escaping @Sendable (RecipeImportSource) async throws -> RecipeImportDraft?,
         saver: @escaping @Sendable (NewRecipe) async throws -> Recipe, review: RecipeReview? = nil, eyebrow: String? = nil) {
        self.mode = mode; self.reader = reader; self.saver = saver; self.review = review
        self.eyebrow = eyebrow ?? (mode == .link ? "RECEPT LINKRŐL" : mode == .text ? "RECEPT SZÖVEGBŐL" : "RECEPT FOTÓRÓL")
        if review != nil { stage = .review }
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

    func back() { stage = .input; review = nil; saveProblem = nil }

    /// The one save. A second tap while the first is in flight does nothing; a failure leaves the review as it was.
    func save() async -> Recipe? {
        guard !saving, let review, review.canSave else { return nil }
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
    func remove(_ id: UUID) { review?.remove(id) }
    func restore(_ id: UUID) { review?.restore(id) }
    func setAmount(_ id: UUID, _ amount: Double) { review?.setAmount(id, amount) }
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
    @Environment(\.dismiss) private var dismiss
    @State private var showLibrary = false
    @State private var showCamera = false
    @FocusState private var typing: Bool

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: model.eyebrow, title: title) {
            switch model.stage {
            case .input: input
            case .working: working
            case .review: ReviewBody(model: model, profile: profile, onSaved: onSaved)
            case .empty:
                notice("Nem találtam ebben receptet.", "Nem hozzávalók és lépések vannak rajta, vagy nem tudtam elolvasni. Próbálj másik oldalt, másold be a szöveget, vagy fotózd le.",
                       action: "Másik forrás") { model.back() }
            case .failed(let line):
                notice("Nem sikerült beolvasni.", line, action: "Vissza") { model.back() }
            }
        }
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

// MARK: - The review

/// The reviewed draft: name, servings, the ingredient rows with their marks, the weight and the one save button.
struct ReviewBody: View {
    @Bindable var model: RecipeImportModel
    var profile: SensitivityProfile? = nil
    let onSaved: (Recipe) -> Void

    private let categories: [(key: String, label: String)] = [("breakfast", "Reggeli"), ("lunch", "Ebéd"), ("dinner", "Vacsora"), ("snack", "Nasi")]

    var body: some View {
        if let review = model.review {
            VStack(spacing: 12) {
                headCard(review)
                ingredientsCard(review)
                allergenCard(review)
                weightCard(review)
                leftOutCard(review)
                if let blocker = review.saveBlocker {
                    Text(blocker).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
                }
                if let problem = model.saveProblem {
                    Text(problem).nkFont(13.5).foregroundStyle(Color(hex: 0xF7A8C4)).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
                }
                NKPill(model.saving ? "Mentem…" : "Mentem a receptjeim közé") {
                    Task { if let recipe = await model.save() { onSaved(recipe) } }
                }
                .disabled(!review.canSave || model.saving).opacity(review.canSave ? 1 : 0.4)
            }
        }
    }

    private func headCard(_ review: RecipeReview) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("", text: Binding(get: { review.name }, set: { model.review?.name = $0 }), prompt: Text("A recept neve").foregroundStyle(.white.opacity(0.4)))
                .nkFont(20, design: .serif).foregroundStyle(.white).accessibilityLabel("A recept neve")
            HStack(spacing: 12) {
                Stepper(value: Binding(get: { review.servings }, set: { model.review?.servings = $0 }), in: 1...12) {
                    Text("\(review.servings) adag").nkFont(14, design: .monospaced).foregroundStyle(.white.opacity(0.85))
                }
                .tint(.white)
            }
            Menu {
                ForEach(categories, id: \.key) { c in Button(c.label) { model.review?.category = c.key } }
            } label: {
                HStack(spacing: 6) {
                    Text(categories.first { $0.key == review.category }?.label ?? "Ebéd").nkFont(14).foregroundStyle(.white.opacity(0.85))
                    Image(systemName: "chevron.up.chevron.down").font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
                }
                .padding(.horizontal, 14).padding(.vertical, 8).background(Capsule().fill(.white.opacity(0.1)))
            }
            .accessibilityLabel("Étkezés típusa")
            if let url = review.sourceUrl {
                HStack(spacing: 8) {
                    NKGlyph("link-deep", .white.opacity(0.55), size: 14)
                    Text(url).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1).truncationMode(.middle)
                }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func ingredientsCard(_ review: RecipeReview) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(review.toReviewCount == 0
                 ? "\(review.steps.count) lépés · a hozzávalókat a kamrádhoz párosítottam"
                 : "\(review.steps.count) lépés · \(review.toReviewCount) hozzávalót nézz át")
                .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            ForEach(review.lines) { l in
                lineRow(l)
                if l.id != review.lines.last?.id { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
            }
            if let note = review.leftOutNote {
                Text(note).nkFont(13).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func lineRow(_ l: ReviewLine) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                NKThumb(image: nil, glyph: "leaf-sage", size: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(l.line.name).nkFont(15, .medium).foregroundStyle(.white.opacity(l.removed ? 0.4 : 1))
                        .strikethrough(l.removed).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 6) {
                        if l.isMatched && !l.removed {
                            TextField("", value: Binding(get: { l.line.amount }, set: { model.setAmount(l.id, $0) }), format: .number)
                                .keyboardType(.decimalPad).multilineTextAlignment(.trailing).nkFont(12.5, design: .monospaced)
                                .foregroundStyle(.white.opacity(0.8)).frame(width: 56).padding(.vertical, 3).padding(.horizontal, 6)
                                .background(Capsule().fill(.white.opacity(0.08))).accessibilityLabel("\(l.line.name) mennyisége")
                            Text(l.line.unit).nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                        } else {
                            Text("\(huAmount(l.line.amount)) \(l.line.unit)").nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                        }
                    }
                    let badges = reviewLineBadges(l, profile: profile)
                    if !badges.isEmpty { FlowRow { ForEach(badges) { RecipeBadgeView(badge: $0) } }.padding(.top, 2) }
                    if let src = l.line.sourceText, !src.isEmpty, l.isMarked {
                        Text("Így állt a forrásban: „\(src)”").nkFont(11.5).foregroundStyle(.white.opacity(0.45)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 4)
                markChip(l)
            }
            if l.removed {
                Button("Visszateszem") { model.restore(l.id) }.nkFont(13).foregroundStyle(.white.opacity(0.7)).buttonStyle(.plain).frame(minHeight: 32)
            } else if l.mark == .lowConfidence {
                HStack(spacing: 10) {
                    if l.confirmed {
                        Text("Rendben, ez az").nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.6))
                    } else {
                        Button { model.confirm(l.id) } label: {
                            Text("Jó így").nkFont(13, .semibold).foregroundStyle(NK.ground).padding(.horizontal, 14).frame(minHeight: 34)
                                .background(Capsule().fill(.white.opacity(0.95)))
                        }
                        .buttonStyle(.plain).accessibilityLabel("\(l.line.name): jó így")
                    }
                    Button("Kiveszem") { model.remove(l.id) }.nkFont(13).foregroundStyle(.white.opacity(0.7)).buttonStyle(.plain).frame(minHeight: 34)
                        .accessibilityLabel("\(l.line.name) kivétele")
                }
            } else if l.mark == .unmatched {
                Button("Kiveszem") { model.remove(l.id) }.nkFont(13).foregroundStyle(.white.opacity(0.6)).buttonStyle(.plain).frame(minHeight: 32)
                    .accessibilityLabel("\(l.line.name) kivétele")
            }
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder private func markChip(_ l: ReviewLine) -> some View {
        if l.removed {
            EmptyView()
        } else if l.mark == .lowConfidence && !l.confirmed {
            Text("ellenőrizd").nkFont(11, .medium).foregroundStyle(Color(hex: 0xF4C860))
                .padding(.horizontal, 9).padding(.vertical, 4).background(Capsule().fill(Color(hex: 0xF4C860).opacity(0.14)))
        } else if l.mark == .unmatched {
            Text("nincs a kamrádban · kimarad").nkFont(11, .medium).foregroundStyle(.white.opacity(0.65)).multilineTextAlignment(.trailing)
                .padding(.horizontal, 9).padding(.vertical, 4).background(Capsule().fill(.white.opacity(0.1)))
        }
    }

    /// What the owner's rules find in the draft, before he saves; rows with no allergen data say so, never "free of".
    @ViewBuilder private func allergenCard(_ review: RecipeReview) -> some View {
        let warnings = reviewAllergenWarnings(review, profile: profile)
        let silent = reviewNoDataLines(review, profile: profile)
        if !warnings.isEmpty || !silent.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                NKMono("ALLERGÉNEK")
                ForEach(warnings) { w in
                    Text("\(w.text) — \(w.lineNames.joined(separator: ", "))").nkFont(14, .medium).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !warnings.isEmpty {
                    Text("Tedd bele, cseréld, vagy hagyd ki — a recept így is elmentődik.").nkFont(13).foregroundStyle(.white.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !silent.isEmpty {
                    Text("Nincs allergén-adat: \(silent.joined(separator: ", ")). Ez nem azt jelenti, hogy nincs benne semmi — csak nem tudom.")
                        .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        }
    }

    /// A large share of the rows is not in the recipe: say so plainly and make the owner own it.
    @ViewBuilder private func leftOutCard(_ review: RecipeReview) -> some View {
        if let warning = review.leftOutWarning {
            VStack(alignment: .leading, spacing: 10) {
                Text(warning).nkFont(14, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Button { model.acknowledgeLeftOut(!review.leftOutAcknowledged) } label: {
                    HStack(spacing: 10) {
                        Image(systemName: review.leftOutAcknowledged ? "checkmark.circle.fill" : "circle").nkFont(20)
                        Text("Tudom, így is mentem").nkFont(14, .medium)
                    }
                    .foregroundStyle(.white.opacity(review.leftOutAcknowledged ? 1 : 0.8)).frame(minHeight: 44)
                }
                .buttonStyle(.plain).accessibilityAddTraits(review.leftOutAcknowledged ? .isSelected : [])
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        }
    }

    private func weightCard(_ review: RecipeReview) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NKMono("ELKÉSZÜLT SÚLY")
            if review.cookedWeightIsEstimate {
                Text("Nyersen \(huInt(Int(review.rawWeightG.rounded()))) g. Amit nem lehet grammban mérni (darab, csokor), az nincs benne.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            } else {
                Text("A forrás szerint az elkészült étel \(huInt(Int(review.cookedWeightG.rounded()))) g.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func huAmount(_ v: Double) -> String { v == v.rounded() ? "\(Int(v))" : String(format: "%.1f", v) }
}
