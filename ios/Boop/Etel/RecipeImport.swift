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

    var markedCount: Int { lines.filter { $0.isMarked && !$0.removed }.count }
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

    mutating func confirm(_ id: UUID) { update(id) { $0.confirmed = true } }
    mutating func remove(_ id: UUID) { update(id) { $0.removed = true } }
    mutating func restore(_ id: UUID) { update(id) { $0.removed = false } }
    mutating func setAmount(_ id: UUID, _ amount: Double) {
        // A changed amount is a new decision: a doubtful row must be looked at again.
        update(id) { $0.line.amount = amount; if $0.mark == .lowConfidence { $0.confirmed = false } }
    }

    private mutating func update(_ id: UUID, _ change: (inout ReviewLine) -> Void) {
        guard let i = lines.firstIndex(where: { $0.id == id }) else { return }
        change(&lines[i])
    }

    /// The one save every route ends in: the rows that will be saved, in order, with the owner's edits.
    func request() -> NewRecipe {
        NewRecipe(name: name.trimmingCharacters(in: .whitespacesAndNewlines), category: category, servings: max(servings, 1),
                  steps: steps, sourceUrl: sourceUrl,
                  lines: savedLines.map { NewRecipeLine(catalogId: $0.line.catalogId, pantryItemId: $0.line.catalogId == nil ? $0.pantryItemId : nil,
                                                       amount: $0.line.amount, unit: $0.line.unit) })
    }
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
            case .review: ReviewBody(model: model, onSaved: onSaved)
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
    let onSaved: (Recipe) -> Void

    private let categories: [(key: String, label: String)] = [("breakfast", "Reggeli"), ("lunch", "Ebéd"), ("dinner", "Vacsora"), ("snack", "Nasi")]

    var body: some View {
        if let review = model.review {
            VStack(spacing: 12) {
                headCard(review)
                ingredientsCard(review)
                weightCard(review)
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
            Text(review.markedCount == 0
                 ? "\(review.steps.count) lépés · a hozzávalókat a kamrádhoz párosítottam"
                 : "\(review.steps.count) lépés · \(review.markedCount) hozzávalót nézz át")
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
