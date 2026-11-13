import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// The meal capture composer (B4 Task 10, spike `EComposer`): five entrances, the free-text field, the editable draft, and the
// offline path. Offline-first is the point — the owner stopped logging food because he had no signal: the phone keeps the
// photo and the words, Boop computes when the net returns, and a card asks for one tap. Nothing is saved without it.

/// How the composer opens: the entrance the owner chose, words already typed, or a confirmation card to look over.
struct MealStart: Identifiable {
    enum Entrance: Equatable { case pick, photo, text, recipe, pantry }
    let id = UUID()
    var entrance: Entrance = .pick
    var text = ""
    var card: PendingDraft?
}

/// The composer's state and its decisions, apart from any view.
@MainActor @Observable
final class MealComposerModel {
    enum Stage: Equatable { case pick, working, draft, queued, recipes, pantry }
    enum SaveOutcome: Equatable { case saved(String), failed(String) }

    private(set) var stage: Stage = .pick
    var text = ""
    /// The chosen photo, already JPEG at a long edge of 1600 px.
    private(set) var photo: Data?
    var draft: MealDraft?
    private(set) var problem: String?
    /// What the offline chip says once the capture waits on the phone.
    private(set) var chip: String?
    private(set) var capturedAt: Date
    /// The save's idempotency key: a retry after a lost answer is the same meal, never two.
    private(set) var clientRef = UUID()
    private(set) var saving = false
    var profile: SensitivityProfile?
    private(set) var cardId: UUID?
    private(set) var recipes: [Recipe]?
    private(set) var shelf: [PantryRow]?
    private(set) var listProblem: String?

    private let drafter: any MealDrafting
    private let saver: @Sendable (MealDraft, UUID, Date) async throws -> BoopCore.Meal
    private let lists: (recipes: @Sendable () async throws -> [Recipe], shelf: @Sendable () async throws -> [PantryRow])?
    private let outbox: FoodOutbox?
    private let online: () -> Bool
    private let clock: () -> Date
    private let calendar: Calendar

    init(drafter: any MealDrafting, saver: @escaping @Sendable (MealDraft, UUID, Date) async throws -> BoopCore.Meal,
         lists: (recipes: @Sendable () async throws -> [Recipe], shelf: @Sendable () async throws -> [PantryRow])? = nil,
         outbox: FoodOutbox?, online: @escaping () -> Bool = { true }, clock: @escaping () -> Date = { Date() },
         calendar: Calendar = .current) {
        self.drafter = drafter; self.saver = saver; self.lists = lists; self.outbox = outbox; self.online = online
        self.clock = clock; self.calendar = calendar
        capturedAt = clock()
    }

    convenience init(food: FoodClient, outbox: FoodOutbox?, online: @escaping () -> Bool, clock: @escaping () -> Date = { BoopClock.now() }) {
        self.init(drafter: food, saver: { draft, ref, at in try await food.save(draft, clientRef: ref, capturedAt: at) },
                  lists: (recipes: { try await food.recipes() }, shelf: { try await food.pantry() }),
                  outbox: outbox, online: online, clock: clock)
    }

    var isOnline: Bool { online() }
    var canSubmit: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || photo != nil }
    var hasPhoto: Bool { photo != nil }

    // MARK: Pick

    /// Takes the chosen picture (shrunk to what the server accepts); an unreadable one is said, not swallowed.
    func setPhoto(_ data: Data?) async {
        guard let data else { problem = "Ezt a képet nem tudtam megnyitni."; return }
        let jpeg = await Task.detached { MealPhoto.jpeg(from: data) }.value
        guard let jpeg else { problem = "Ezt a képet nem tudtam megnyitni."; return }
        photo = jpeg; problem = nil
    }

    func clearPhoto() { photo = nil }

    func show(_ stage: Stage) { problem = nil; self.stage = stage }

    // MARK: Draft

    /// Asks Boop for a draft — or, with no net (or no model), keeps the capture on the phone for later.
    func submit() async {
        guard canSubmit, stage == .pick else { return }
        capturedAt = clock(); problem = nil
        let words = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard online() else { return await keep(words: words, why: .offline) }
        stage = .working
        do {
            let d = try await drafter.draft(date: capturedAt, text: words.isEmpty ? nil : words, photo: photo, barcode: nil)
            draft = d; stage = .draft
        } catch FoodFetchError.offline {
            await keep(words: words, why: .offline)
        } catch FoodFetchError.unavailable {
            await keep(words: words, why: .modelDown)
        } catch FoodFetchError.unauthorized {
            stage = .pick; problem = "Újra be kell jelentkezned, aztán próbáld újra."
        } catch {
            stage = .pick; problem = "Most nem sikerült kiszámolnom. Próbáld újra, vagy írd le másképp."
        }
    }

    private enum Why { case offline, modelDown }

    private func keep(words: String, why: Why) async {
        guard let outbox else { stage = .pick; problem = "Most nem tudom eltenni a telefonra."; return }
        stage = .working
        do {
            let ref = try photo.map { try outbox.storePhoto($0) }
            try await outbox.enqueueMeal(draft: MealCapture(text: words.isEmpty ? nil : words), photoRef: ref, capturedAt: capturedAt)
            chip = why == .offline ? "Nincs net · a telefonon van, elküldöm, amint lesz"
                : "Most nem tudok számolni · a telefonon van, később újra próbálom"
            stage = .queued
        } catch {
            stage = .pick
            problem = "Nem tudtam eltenni a telefonra — ne zárd be, próbáld újra."
        }
    }

    /// A confirmation card's draft, opened for a last look and the tap.
    func adopt(_ card: PendingDraft, photo: Data?) {
        guard case .ready(var d) = card.state else { return }
        d.photo = photo
        draft = d; self.photo = photo
        capturedAt = card.capturedAt; clientRef = card.id; cardId = card.id
        stage = .draft
    }

    /// A recipe's serving or a shelf food as a one-line draft.
    func use(_ item: DraftItem?) {
        guard let item else { return }
        capturedAt = clock()
        draft = MealDraft(date: dayString(capturedAt), slot: FoodClient.slot(at: capturedAt, cal: calendar), title: nil, items: [item])
        stage = .draft
    }

    func loadLists() async {
        guard let lists else { listProblem = "Most nem érem el."; return }
        listProblem = nil
        do {
            if stage == .recipes { recipes = try await lists.recipes() } else { shelf = try await lists.shelf() }
        } catch {
            listProblem = (error as? FoodFetchError) == .offline ? "Nincs net — a listához kell." : "Most nem sikerült betölteni."
        }
    }

    private func dayString(_ d: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    // MARK: Editing the lines

    func setAmount(_ index: Int, _ value: Double) {
        guard draft?.items.indices.contains(index) == true, value >= 0 else { return }
        draft?.items[index].amount = value
    }
    func rename(_ index: Int, _ name: String) {
        guard draft?.items.indices.contains(index) == true else { return }
        draft?.items[index].name = name
    }
    func remove(_ index: Int) {
        guard draft?.items.indices.contains(index) == true else { return }
        draft?.items.remove(at: index)
    }

    var canSave: Bool { !(draft?.items.isEmpty ?? true) && !saving }

    // MARK: Save — the owner's tap

    func save() async -> SaveOutcome {
        guard var d = draft, !d.items.isEmpty, !saving else { return .failed("Nincs mit menteni.") }
        d.photo = photo ?? d.photo
        saving = true; defer { saving = false }
        do {
            let meal = try await saver(d, clientRef, capturedAt)
            if let cardId { await outbox?.discard(cardId) }
            let kcal = Int(meal.macros.kcal.rounded())
            return .saved("\(draftTitle(d)) rögzítve · \(huInt(kcal)) kcal")
        } catch FoodFetchError.offline {
            return .failed("Nincs net — a vázlat itt marad, próbáld újra, amint van.")
        } catch FoodFetchError.unauthorized {
            return .failed("Újra be kell jelentkezned, aztán mentsd újra.")
        } catch {
            return .failed("Nem sikerült elmenteni — próbáld újra.")
        }
    }

    /// The owner sends a confirmation card away.
    func discardCard() async { if let cardId { await outbox?.discard(cardId) } }
}

// MARK: - The sheet

/// Reads the signed-in user's food client and outbox from the environment and hosts the composer.
struct MealComposerSheet: View {
    let start: MealStart
    let onDone: (String?) -> Void
    @Environment(\.foodClient) private var food
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?

    var body: some View {
        if let food {
            MealComposerHost(start: start, food: food, ritmus: ritmus, onDone: onDone)
        } else {
            NKSheetFrame(hue: .fuel, eyebrow: "Rögzítés", title: "Most nem érem el") {
                Text("Jelentkezz be újra, és utána rögzíthetsz.").nkFont(15).foregroundStyle(.white.opacity(0.8))
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            }
        }
    }
}

private struct MealComposerHost: View {
    let start: MealStart
    let onDone: (String?) -> Void
    @State private var model: MealComposerModel
    @State private var showLibrary = false
    @State private var showCamera = false
    @State private var cardPhoto: UIImage?
    @FocusState private var typing: Bool
    private let food: FoodClient
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(start: MealStart, food: FoodClient, ritmus: RitmusEnvironment?, onDone: @escaping (String?) -> Void) {
        self.start = start; self.food = food; self.onDone = onDone
        let m = MealComposerModel(food: food, outbox: ritmus?.food, online: { [weak ritmus] in ritmus?.online ?? true })
        m.text = start.text
        if let card = start.card, case .ready = card.state {
            let bytes = card.photoRef.flatMap { ritmus?.food.photoData($0) }
            m.adopt(card, photo: bytes)
            _cardPhoto = State(initialValue: bytes.flatMap(UIImage.init(data:)))
        }
        _model = State(initialValue: m)
    }

    private var time: String {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "hu_HU")
        return f.string(from: model.capturedAt)
    }

    private var title: String {
        switch model.stage {
        case .pick: "Mit ettél?"
        case .working: "Egy pillanat"
        case .draft: model.cardId == nil ? "Ezt látom" : "Nézd át"
        case .queued: "Eltettem"
        case .recipes: "Melyik receptet?"
        case .pantry: "Mit a kamrából?"
        }
    }

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "Rögzítés · \(time)", title: title) {
            switch model.stage {
            case .pick: pick
            case .working: working
            case .draft: draftView
            case .queued: queued
            case .recipes, .pantry: list
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .mealPhotoLibrary(isPresented: $showLibrary) { data in Task { await model.setPhoto(data) } }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(onPick: { data in showCamera = false; Task { await model.setPhoto(data) } }, onCancel: { showCamera = false })
                .ignoresSafeArea()
        }
        .task {
            switch start.entrance {
            case .photo: choosePhoto()
            case .text: typing = true
            case .recipe: model.show(.recipes)
            case .pantry: model.show(.pantry)
            case .pick: break
            }
        }
        .task { model.profile = try? await food.sensitivity() }
        .task(id: model.stage) { if model.stage == .recipes || model.stage == .pantry { await model.loadLists() } }
        .interactiveDismissDisabled(model.stage == .working || model.saving)
    }

    private func choosePhoto() {
        if PhotoCapture.cameraAvailable { showCamera = true } else { showLibrary = true }
    }

    // MARK: Pick

    private var pick: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !model.isOnline { OfflineChip() }
            if let data = model.photo, let image = UIImage(data: data) {
                ZStack(alignment: .topTrailing) {
                    NKCardPhoto(Image(uiImage: image), hue: .fuel, height: 150).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    Button { model.clearPhoto() } label: {
                        Text("Másik kép").nkFont(12.5, .semibold).foregroundStyle(.white)
                            .padding(.horizontal, 12).frame(minHeight: 32).background(Capsule().fill(.black.opacity(0.45)))
                    }
                    .buttonStyle(.plain).padding(10)
                }
            }
            HStack(spacing: 8) {
                entrance("camera-ink", "Fotó", primary: model.photo == nil) { choosePhoto() }
                entrance("pen-sun", "Szöveg") { typing = true }
                entrance("search-ink", "Vonalkód") { onDone(soonToast("Vonalkód")) }
            }
            HStack(spacing: 8) {
                entrance("book-sage", "Recept") { model.show(.recipes) }
                entrance("bowl-sage", "Kamra") { model.show(.pantry) }
                if PhotoCapture.cameraAvailable { entrance("plus-ink", "Képtár") { showLibrary = true } }
                else { Color.clear.frame(maxWidth: .infinity) }
            }
            HStack(spacing: 10) {
                TextField("", text: $model.text, prompt: Text("Mondd vagy írd: vacsora, csirke rizzsel…").foregroundStyle(.white.opacity(0.45)),
                          axis: .vertical)
                    .lineLimit(1...3)
                    .nkFont(15).foregroundStyle(.white).focused($typing)
                    .submitLabel(.done)
                NKGlyph("chat-ink", .white.opacity(0.8), size: 18).accessibilityHidden(true)
            }
            .padding(.horizontal, 18).padding(.vertical, 14).frame(minHeight: 54)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
            if let p = model.problem { problemLine(p) }
            Button { Task { await model.submit() } } label: {
                Text(model.isOnline ? "Kiszámolom" : "Eltenem a telefonon").nkFont(16, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity).frame(height: 50)
                    .background(Capsule().fill(.white.opacity(model.canSubmit ? 0.95 : 0.3)))
            }
            .buttonStyle(.plain).disabled(!model.canSubmit)
        }
    }

    private func entrance(_ glyph: String, _ title: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                NKGlyph(glyph, primary ? NK.ground : .white, size: 20)
                Text(title).nkFont(13, .semibold).foregroundStyle(primary ? NK.ground : .white).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity).frame(height: 70)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(primary ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }

    private func problemLine(_ text: String) -> some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel("Gond: \(text)")
    }

    // MARK: Working / queued

    private var working: some View {
        HStack(spacing: 14) {
            ProgressView().tint(.white)
            Text(model.hasPhoto ? "Megnézem a képet és kiszámolom." : "Kiszámolom.").nkFont(15).foregroundStyle(.white.opacity(0.85))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private var queued: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let data = model.photo, let image = UIImage(data: data) {
                NKCardPhoto(Image(uiImage: image), hue: .fuel, height: 150).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            Text("\(model.hasPhoto ? "A fotó" : "A leírás") a telefonodon van. Amint lesz net, kiszámolom, és egy koppintással jóváhagyod — addig semmi nem mentődik el.")
                .nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            if let chip = model.chip { OfflineChip(chip) }
            Button { onDone("Eltettem a telefonra") } label: {
                Text("Rendben").nkFont(16, .semibold).foregroundStyle(NK.ground).frame(maxWidth: .infinity).frame(height: 50)
                    .background(Capsule().fill(.white.opacity(0.95)))
            }
            .buttonStyle(.plain)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    // MARK: Draft

    @ViewBuilder private var draftView: some View {
        if let draft = model.draft {
            VStack(alignment: .leading, spacing: 0) {
                if let photo = (model.photo.flatMap(UIImage.init(data:)) ?? cardPhoto) {
                    NKCardPhoto(Image(uiImage: photo), hue: .fuel, height: 140)
                }
                VStack(alignment: .leading, spacing: 12) {
                    if let notice = draftNotice(draft) { Text(notice).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true) }
                    ForEach(Array(draft.items.enumerated()), id: \.offset) { i, item in line(i, item) }
                    Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                    let t = draft.total
                    HStack(alignment: .firstTextBaseline) {
                        Text("Összesen").nkFont(14).foregroundStyle(.white.opacity(0.8))
                        Spacer(minLength: 8)
                        Text("\(huInt(Int(t.kcal.rounded()))) kcal · F \(Int(t.p.rounded())) g · Sz \(Int(t.c.rounded())) g · Zs \(Int(t.f.rounded())) g")
                            .nkFont(12.5, design: .monospaced).foregroundStyle(.white).multilineTextAlignment(.trailing)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                    if draftHasUnknownAllergens(draft, profile: model.profile) {
                        Text("Egyes tételeknél nincs allergén-adat, ezért ott nem jelzek semmit — ez nem azt jelenti, hogy nincs benne.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }
                    if let note = draft.note, !note.isEmpty { Text(note).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true) }
                }
                .padding(18)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous)).nkGlass(22)
            if let p = savingProblem { problemLine(p) }
            HStack(spacing: 10) {
                Button { Task { await save() } } label: {
                    Text(model.saving ? "Mentem…" : "Mentem").nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity).frame(height: 50)
                        .background(Capsule().fill(.white.opacity(model.canSave ? 0.95 : 0.3)))
                }
                .buttonStyle(.plain).disabled(!model.canSave)
                Button { Task { await model.discardCard(); onDone(model.cardId == nil ? nil : "Elvetettem") } } label: {
                    Text(model.cardId == nil ? "Mégsem" : "Elvetem").nkFont(15).foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 20).frame(height: 50).background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @State private var savingProblem: String?

    private func save() async {
        savingProblem = nil
        switch await model.save() {
        case .saved(let toast): onDone(toast)
        case .failed(let why): savingProblem = why
        }
    }

    private func line(_ i: Int, _ item: DraftItem) -> some View {
        let badges = draftBadges(for: item, profile: model.profile)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    TextField("", text: Binding(get: { item.name }, set: { model.rename(i, $0) }))
                        .nkFont(15, .medium).foregroundStyle(.white)
                    HStack(spacing: 8) {
                        TextField("", value: Binding(get: { item.amount }, set: { model.setAmount(i, $0) }), format: .number)
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                            .nkFont(14, design: .monospaced).foregroundStyle(.white).frame(width: 64)
                            .padding(.vertical, 5).padding(.horizontal, 8).background(Capsule().fill(.white.opacity(0.1)))
                            .accessibilityLabel("\(item.name) mennyisége")
                        Text(item.unit).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                        Text("· \(huInt(Int(item.contribution.kcal.rounded()))) kcal").nkFont(12.5, design: .monospaced)
                            .foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 6) {
                    Text(sourceTag(item)).nkFont(11.5).foregroundStyle(.white.opacity(0.5))
                    Button("Töröl") { model.remove(i) }.nkFont(12.5).foregroundStyle(.white.opacity(0.65)).buttonStyle(.plain)
                        .frame(minHeight: 28).accessibilityLabel("\(item.name) törlése")
                }
            }
            if !badges.isEmpty {
                HStack(spacing: 6) { ForEach(badges) { badge($0) } }
            }
        }
    }

    private func sourceTag(_ item: DraftItem) -> String {
        switch item.source {
        case .pantry: "kamra"
        case .recipe: "recept"
        case .estimate: item.needsReview || item.confidence < 0.6 ? "becslés · nézd át" : "becslés"
        }
    }

    private func badge(_ b: DraftBadge) -> some View {
        Text(b.text).nkFont(11.5, .semibold)
            .foregroundStyle(b.tone == .stop ? NK.ground : .white.opacity(0.9))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(Capsule().fill(b.tone == .stop ? .white.opacity(0.92) : .white.opacity(b.tone == .warn ? 0.22 : 0.1)))
            .overlay(Capsule().stroke(.white.opacity(b.tone == .processed ? 0.35 : 0), lineWidth: 1))
    }

    // MARK: Recipes and the shelf

    @ViewBuilder private var list: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let problem = model.listProblem {
                Text(problem).nkFont(14).foregroundStyle(.white.opacity(0.75))
                Button { Task { await model.loadLists() } } label: {
                    Text("Újra").nkFont(14, .semibold).foregroundStyle(NK.ground).padding(.horizontal, 18).frame(minHeight: 38)
                        .background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain)
            } else if model.stage == .recipes {
                if let recipes = model.recipes {
                    if recipes.isEmpty { Text("Még nincs mentett recepted.").nkFont(14).foregroundStyle(.white.opacity(0.7)) }
                    ForEach(recipes) { r in
                        row(r.name, "\(huInt(Int((r.macros.kcal / Double(max(r.servings, 1))).rounded()))) kcal adagonként") { model.use(DraftItem(recipe: r)) }
                    }
                } else { loadingRow }
            } else {
                if let shelf = model.shelf {
                    let rows = shelf.filter { $0.kind == "food" && DraftItem(pantry: $0) != nil }
                    if rows.isEmpty { Text("A kamrád még üres, vagy nincs benne étel.").nkFont(14).foregroundStyle(.white.opacity(0.7)) }
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, p in
                        row(p.name, "\(huInt(Int((p.kcal ?? 0).rounded()))) kcal / \(Int(p.per ?? 0)) \(p.unit ?? "")") { model.use(DraftItem(pantry: p)) }
                    }
                } else { loadingRow }
            }
            Button { model.show(.pick) } label: {
                Text("Vissza").nkFont(15).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity).frame(height: 46)
                    .background(Capsule().fill(.white.opacity(0.1)))
            }
            .buttonStyle(.plain)
        }
    }

    private var loadingRow: some View {
        Text("Betöltés folyamatban").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder)
    }

    private func row(_ title: String, _ sub: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                NKThumb(image: nil, glyph: "bowl-cream", size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15.5, .medium).foregroundStyle(.white).lineLimit(2)
                    Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                }
                Spacer(minLength: 0)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(18)
        }
        .buttonStyle(.plain)
    }
}
