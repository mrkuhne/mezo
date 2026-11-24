import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// The meal capture composer (B4 Task 10, spike `EComposer`): five entrances, the free-text field, the editable draft, and the
// offline path. Offline-first is the point — the owner stopped logging food because he had no signal: the phone keeps the
// photo and the words, Boop computes when the net returns, and a card asks for one tap. Nothing is saved without it.

/// How the composer opens: the entrance the owner chose, words already typed, or a confirmation card to look over.
extension MealStart.Entrance {
    /// The composer stage an entrance opens straight on; nil for the ones that act (photo, text) or wait (pick, serving).
    var openingStage: MealComposerModel.Stage? {
        switch self {
        case .recipe: .recipes
        case .pantry: .pantry
        case .barcode: .barcode
        case .usual: .usuals
        case .photo, .text, .serving, .pick: nil
        }
    }
}

struct MealStart: Identifiable {
    enum Entrance: Equatable { case pick, photo, text, recipe, pantry, barcode, usual, serving }
    let id = UUID()
    var entrance: Entrance = .pick
    var text = ""
    var card: PendingDraft?
    /// A shelf or catalog food the owner chose to eat (the Kamra): it opens the serving confirmation, in grams.
    var serving: LookupItem?
}

/// The composer's state and its decisions, apart from any view.
@MainActor @Observable
final class MealComposerModel {
    enum Stage: Equatable { case pick, working, draft, queued, recipes, pantry, barcode, serving, usuals }
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
    /// The barcode that rides along with the capture (an unknown code, kept for the label photo's draft).
    private(set) var barcode: String?
    /// The scanned product waiting for the owner to say how much he ate (the serving confirmation).
    private(set) var scanned: (item: LookupItem, source: LookupSource, code: String)?
    /// The capture came from a card the owner is looking over (not made in this sheet).
    private(set) var adopted = false
    /// The old failed card this capture replaces; it goes once the new capture is safe (a draft, or queued).
    private var replacing: UUID?
    private var capturedOverride: Date?
    /// The old capture was too old for the server: this one is dated today and the sheet says so.
    private(set) var redated = false
    private var parkedPhotoRef: UUID?
    private(set) var recipes: [Recipe]?
    private(set) var shelf: [PantryRow]?
    /// The owner's usual meals, ranked by the server (the fifth entrance).
    private(set) var usuals: [UsualMeal]?
    /// What the draft says about where a chosen usual meal came from: its own lines, or only its name (re-estimated).
    private(set) var usualNote: String?
    private(set) var listProblem: String?
    /// When the owner says he ate, if not now (a meal logged afterwards). nil = now.
    private(set) var chosenAt: Date?
    /// A draft is open and the owner is adding one more thing to it (a recipe, a shelf food, a scanned product, more
    /// words or a photo): what he picks joins the draft instead of replacing it.
    private(set) var adding = false
    /// What he types to add to an open draft.
    var moreText = ""
    /// The shortest time the "working" stage stays up (the scan over the photo is worth seeing); zero in tests.
    var minWorking: Duration = .zero

    private let drafter: any MealDrafting
    private let saver: @Sendable (MealDraft, UUID, Date) async throws -> BoopCore.Meal
    private let lists: (recipes: @Sendable () async throws -> [Recipe], shelf: @Sendable () async throws -> [PantryRow])?
    private let usualsLoader: (@Sendable () async throws -> [UsualMeal])?
    private let outbox: FoodOutbox?
    private let online: () -> Bool
    private let clock: () -> Date
    private let calendar: Calendar
    /// Tells the room its cards changed (a draft was parked, a card went).
    var changed: () -> Void = {}

    init(drafter: any MealDrafting, saver: @escaping @Sendable (MealDraft, UUID, Date) async throws -> BoopCore.Meal,
         lists: (recipes: @Sendable () async throws -> [Recipe], shelf: @Sendable () async throws -> [PantryRow])? = nil,
         usuals: (@Sendable () async throws -> [UsualMeal])? = nil,
         outbox: FoodOutbox?, online: @escaping () -> Bool = { true }, clock: @escaping () -> Date = { Date() },
         calendar: Calendar = .current) {
        self.drafter = drafter; self.saver = saver; self.lists = lists; self.usualsLoader = usuals; self.outbox = outbox; self.online = online
        self.clock = clock; self.calendar = calendar
        capturedAt = clock()
    }

    convenience init(food: FoodClient, outbox: FoodOutbox?, online: @escaping () -> Bool, clock: @escaping () -> Date = { BoopClock.now() }) {
        self.init(drafter: food, saver: { draft, ref, at in try await food.save(draft, clientRef: ref, capturedAt: at) },
                  lists: (recipes: { try await food.recipes() }, shelf: { try await food.pantry() }),
                  usuals: { try await food.usuals(slot: FoodClient.slot(at: BoopClock.now(), cal: .current)) },
                  outbox: outbox, online: online, clock: clock)
    }

    var isOnline: Bool { online() }

    // MARK: When

    /// The moment a new capture is stamped with: the time he chose, else the failed capture's own, else now.
    private func stamp() -> Date { chosenAt ?? capturedOverride ?? clock() }

    /// How far back a meal may be dated (the server refuses a day more than a week old).
    var earliestTime: Date { calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: clock())) ?? clock() }

    /// The owner says when he ate. nil = now. Never in the future, never older than the server takes; an open draft
    /// moves with it (its day and its window follow the time).
    func setTime(_ date: Date?) {
        let now = clock()
        chosenAt = date.map { min(now, max(earliestTime, $0)) }
        capturedAt = stamp()
        redated = false
        if draft != nil {
            draft?.date = dayString(capturedAt)
            draft?.slot = FoodClient.slot(at: capturedAt, cal: calendar)
        }
    }

    /// Minutes between the stamped time and now, for the quick chips (0 = now).
    var minutesAgo: Int { max(0, Int(clock().timeIntervalSince(capturedAt) / 60)) }

    /// The row's Tegnap chip (`mezo-r36n9.159`): yesterday at this clock time, the picker then moves the hour.
    func setYesterday() {
        setTime(calendar.date(byAdding: .day, value: -1, to: clock()) ?? clock())
    }

    // MARK: Adding to an open draft

    func addMore(_ stage: Stage) { adding = true; show(stage) }
    func cancelAdding() { adding = false; show(draft == nil ? .pick : .draft) }

    /// More words and/or a photo for an open draft: Boop reads them and the lines join the ones already there. The
    /// first photo becomes the meal's photo. Needs the net; with none the draft stays exactly as it was.
    func addFromBoop(photo extra: Data?) async {
        let words = moreText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard draft != nil, !words.isEmpty || extra != nil else { return }
        guard online() else { problem = "Ehhez net kell — a vázlat marad, ahogy volt."; return }
        problem = nil; stage = .working
        let started = ContinuousClock.now
        do {
            let d = try await drafter.draft(date: capturedAt, text: words.isEmpty ? nil : words, photo: extra, barcode: nil)
            await linger(since: started)
            if d.items.isEmpty { problem = "Ebből nem ismertem fel semmit — írd le másképp." }
            draft?.items.append(contentsOf: d.items)
            if photo == nil, let extra { photo = extra }
            moreText = ""
        } catch {
            problem = "Most nem sikerült hozzáadnom. A vázlat marad, ahogy volt."
        }
        adding = false; stage = .draft
        await ensureParked()
    }

    /// A photo taken while a draft is open: shrunk like any other, then read into the draft.
    func addPhotoToDraft(_ data: Data?) async {
        guard let data, let jpeg = await Task.detached(operation: { MealPhoto.jpeg(from: data) }).value else {
            problem = "Ezt a képet nem tudtam megnyitni."; return
        }
        await addFromBoop(photo: jpeg)
    }

    /// Keeps the working stage up for its minimum time, so the scan over a photo is seen and never flashes.
    private func linger(since started: ContinuousClock.Instant) async {
        let left = minWorking - (ContinuousClock.now - started)
        if left > .zero { try? await Task.sleep(for: left) }
    }
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

    // MARK: Barcode

    /// Keeps an unknown code for the capture: the label photo's draft is asked for with it, and the draft keeps it.
    func carryCode(_ code: String) { barcode = code }
    func clearCode() { barcode = nil }

    /// A found product goes to the serving confirmation — never straight into the draft.
    func showServing(_ item: LookupItem, source: LookupSource, code: String) {
        scanned = (item, source, code); show(.serving)
    }

    /// The owner confirmed the amount: the scanned product is now one line of an editable draft (nothing is saved yet).
    func confirmServing(_ line: DraftItem) {
        guard let scanned else { return }
        if adding, draft != nil {
            draft?.items.append(line)
            barcode = nil; self.scanned = nil; adding = false
            stage = .draft
            return
        }
        capturedAt = stamp()
        // A food chosen from the Kamra has no scanned code: the draft carries none (and no lookup source).
        let scannedCode = !scanned.code.isEmpty
        draft = MealDraft(date: dayString(capturedAt), slot: FoodClient.slot(at: capturedAt, cal: calendar), title: nil,
                          items: [line], barcode: scannedCode ? scanned.code : nil, lookupSource: scannedCode ? scanned.source : nil)
        barcode = nil; self.scanned = nil
        stage = .draft
    }

    func show(_ stage: Stage) { problem = nil; if stage == .usuals || stage == .pick { usualNote = nil }; self.stage = stage }

    // MARK: Draft

    /// Asks Boop for a draft — or, with no net (or no model), keeps the capture on the phone for later.
    func submit() async {
        // The owner's own submit: whatever a chosen usual meal said about itself no longer applies.
        usualNote = nil
        await performSubmit()
    }

    private func performSubmit() async {
        guard canSubmit, stage == .pick else { return }
        capturedAt = stamp(); problem = nil
        let words = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard online() else { return await keep(words: words, why: .offline) }
        stage = .working
        let started = ContinuousClock.now
        do {
            var d = try await drafter.draft(date: capturedAt, text: words.isEmpty ? nil : words, photo: photo, barcode: barcode)
            await linger(since: started)
            // A meal logged afterwards belongs to the window of the time he gave, not of the moment he typed it.
            if chosenAt != nil { d.date = dayString(capturedAt); d.slot = FoodClient.slot(at: capturedAt, cal: calendar) }
            draft = d; stage = .draft
            await ensureParked()
            await discardReplaced()
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
        var ref: UUID?
        do {
            ref = try photo.map { try outbox.storePhoto($0, rescale: false) }
            try await outbox.enqueueMeal(draft: MealCapture(text: words.isEmpty ? nil : words, barcode: barcode), photoRef: ref, capturedAt: capturedAt)
            await discardReplaced()
            changed()
            chip = why == .offline ? "Nincs net · a telefonon van, elküldöm, amint lesz"
                : "Most nem tudok számolni · a telefonon van, később újra próbálom"
            stage = .queued
        } catch {
            // The capture was rolled back as a whole: the photo file goes with it, nothing half-kept.
            if let ref { outbox.deletePhoto(ref) }
            stage = .pick
            problem = "Nem tudtam eltenni a telefonra — ne zárd be, próbáld újra."
        }
    }

    /// Writes the draft down as a card before any save is tried (see `FoodOutbox.park`). Never blocks the save.
    private func ensureParked() async {
        guard let outbox, let d = draft else { return }
        let id = cardId ?? clientRef
        if parkedPhotoRef == nil, let photo { parkedPhotoRef = try? outbox.storePhoto(photo, rescale: false) }
        guard (try? outbox.park(d, id: id, capturedAt: capturedAt, text: text.isEmpty ? nil : text, photoRef: parkedPhotoRef)) != nil else { return }
        cardId = id
        changed()
    }

    private func discardReplaced() async {
        guard let old = replacing else { return }
        replacing = nil
        await outbox?.discard(old)
        changed()
    }

    /// A confirmation card's draft, opened for a last look and the tap.
    func adopt(_ card: PendingDraft, photo: Data?) {
        guard case .ready(var d) = card.state else { return }
        d.photo = photo
        capturedAt = card.capturedAt
        // The server refuses a day more than a week back: the meal is dated today, and the sheet says so.
        if card.isTooOld(now: clock(), calendar: calendar) { capturedAt = clock(); d.date = dayString(capturedAt); redated = true }
        draft = d; self.photo = photo
        clientRef = card.id; cardId = card.id; adopted = true; parkedPhotoRef = card.photoRef
        stage = .draft
    }

    /// A capture that failed, looked over: its words and photo come back into the picker, so nothing is retyped.
    /// It replaces the failed card once the new one is safe.
    func adoptFailed(_ card: PendingDraft, photo: Data?) {
        text = card.text ?? ""
        self.photo = photo
        replacing = card.id
        if card.isTooOld(now: clock(), calendar: calendar) { capturedOverride = nil; redated = true }
        else { capturedOverride = card.capturedAt; capturedAt = card.capturedAt }
        stage = .pick
    }

    /// A recipe's serving or a shelf food as a one-line draft.
    func use(_ item: DraftItem?) {
        guard let item else { return }
        if adding, draft != nil {
            draft?.items.append(item)
            adding = false; stage = .draft
            return
        }
        capturedAt = stamp()
        draft = MealDraft(date: dayString(capturedAt), slot: FoodClient.slot(at: capturedAt, cal: calendar), title: nil, items: [item])
        stage = .draft
    }

    /// One of the usual meals. With its latest occurrence's own lines the draft IS that meal (no model call, no re-estimate);
    /// without them the name goes through the ordinary draft like typed words and the draft says plainly that it is a
    /// re-estimate, not a copy. Either way nothing is saved without the owner's tap.
    func chooseUsual(_ usual: UsualMeal) async {
        if !usual.items.isEmpty {
            capturedAt = stamp()
            draft = MealDraft(date: dayString(capturedAt), slot: FoodClient.slot(at: capturedAt, cal: calendar), title: usual.title, items: usual.items)
            usualNote = "Ezek a legutóbbi „\(usual.title)” tételei. A számok mentéskor a kamrád és a receptjeid mostani adataiból frissülhetnek — nézd át, mielőtt mented."
            show(.draft)
            return
        }
        show(.pick)
        text = usual.title
        usualNote = "Az előző „\(usual.title)” tételeit nem tudtam előhívni, ezért a nevéből becsültem újra — ez nem a korábbi étkezésed másolata. Nézd át a tételeket."
        await performSubmit()
    }

    func loadLists() async {
        if stage == .usuals {
            guard let usualsLoader else { listProblem = "Most nem érem el."; return }
            listProblem = nil
            do { usuals = try await usualsLoader(); listProblem = nil }
            catch {
                // A load the view already replaced (the stage changed under it) must not leave its cancellation as a problem.
                if Task.isCancelled { return }
                listProblem = (error as? FoodFetchError) == .offline ? "Nincs net — a listához kell." : "Most nem sikerült betölteni."
            }
            return
        }
        guard let lists else { listProblem = "Most nem érem el."; return }
        listProblem = nil
        do {
            if stage == .recipes { recipes = try await lists.recipes() } else { shelf = try await lists.shelf() }
            listProblem = nil
        } catch {
            if Task.isCancelled { return }
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
        draft = d
        await ensureParked()
        do {
            let meal = try await saver(d, clientRef, capturedAt)
            if let cardId { await outbox?.finishSave(cardId, meal: meal) }
            changed()
            let kcal = Int(meal.macros.kcal.rounded())
            let stranded = d.photo != nil && !meal.hasPhoto
            return .saved("\(draftTitle(d)) rögzítve · \(huInt(kcal)) kcal" + (stranded ? " · a fotó még a telefonon vár" : ""))
        } catch FoodFetchError.offline {
            return .failed("Nincs net — a vázlat itt marad, próbáld újra, amint van.")
        } catch FoodFetchError.unauthorized {
            return .failed("Újra be kell jelentkezned, aztán mentsd újra.")
        } catch FoodFetchError.rejected {
            return .failed(Self.rejectedSaveLine(d))
        } catch {
            return .failed("Nem sikerült elmenteni — próbáld újra.")
        }
    }

    /// A refused save of a draft with lines tied to the shelf or the recipes: the likeliest cause is a source deleted since
    /// (a usual meal from weeks ago). The server does not say which line, so the sentence names the tied ones and what to do.
    static func rejectedSaveLine(_ d: MealDraft) -> String {
        let tied = d.items.filter { $0.pantryItemId != nil || $0.recipeId != nil }.map(\.name)
        guard !tied.isEmpty else { return "A szerver nem fogadta el ezt a vázlatot — nézd át a tételeket." }
        return "A szerver nem fogadta el a vázlatot. Lehet, hogy az egyik tétel forrását (\(tied.joined(separator: ", "))) törölted azóta a kamrádból vagy a receptjeid közül. Töröld ki a hibásat a \"Töröl\" gombbal, a többit el tudod menteni."
    }

    /// The owner sends a confirmation card away.
    func discardCard() async { if let cardId { await outbox?.discard(cardId); changed() } }
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
    /// The typed search and the chosen chip of the recipe / shelf list; cleared whenever the list changes.
    @State private var listQuery = ""
    @State private var listFilter: String?
    @State private var showCamera = false
    @State private var cardPhoto: UIImage?
    @State private var scan: BarcodeScanModel
    @FocusState private var typing: Bool
    private let food: FoodClient
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(start: MealStart, food: FoodClient, ritmus: RitmusEnvironment?, onDone: @escaping (String?) -> Void) {
        self.start = start; self.food = food; self.onDone = onDone
        let m = MealComposerModel(food: food, outbox: ritmus?.food, online: { [weak ritmus] in ritmus?.online ?? true })
        m.text = start.text
        m.minWorking = .milliseconds(2600)
        m.changed = { [weak ritmus] in ritmus?.mealDraftsChanged() }
        if let card = start.card {
            let bytes = card.photoRef.flatMap { ritmus?.food.photoData($0) }
            if case .ready = card.state {
                m.adopt(card, photo: bytes)
                _cardPhoto = State(initialValue: bytes.flatMap(UIImage.init(data:)))
            } else if case .failed = card.state {
                m.adoptFailed(card, photo: bytes)
            }
        }
        _model = State(initialValue: m)
        _scan = State(initialValue: BarcodeScanModel(lookup: { code in try await food.lookup(barcode: code) }))
    }

    private var time: String {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "hu_HU")
        return f.string(from: model.capturedAt)
    }

    private var title: String {
        switch model.stage {
        case .pick: "Mit ettél?"
        case .working: model.hasPhoto ? "Nézem a tányért" : "Egy pillanat"
        case .draft: model.adopted ? "Nézd át" : "Ezt látom"
        case .queued: "Eltettem"
        case .recipes: "Melyik receptet?"
        case .pantry: "Mit a kamrából?"
        case .barcode: "Vonalkód"
        case .serving: "Mennyit ettél belőle?"
        case .usuals: "Szokásos"
        }
    }

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "Rögzítés · \(etelSlotLabel(FoodClient.slot(at: model.capturedAt, cal: .current))) · \(time)", title: title,
                     closable: !(model.stage == .working || model.saving)) {
            switch model.stage {
            case .pick: pick
            case .working: working
            case .draft: draftView
            case .queued: queued
            case .recipes, .pantry, .usuals: list
            case .barcode: barcodeView
            case .serving: servingView
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .confirmationDialog("Biztosan elveted? A vázlat és a fotó véglegesen törlődik.", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("Elvetem", role: .destructive) { Task { await model.discardCard(); onDone(model.adopted ? "Elvetettem" : nil) } }
            Button("Mégsem", role: .cancel) {}
        }
        .mealPhotoLibrary(isPresented: $showLibrary) { data in Task { await took(data) } }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(onPick: { data in showCamera = false; Task { await took(data) } }, onCancel: { showCamera = false })
                .ignoresSafeArea()
        }
        #if DEBUG
        // Simulator review (`-etelCompose photo|scan|draft`): the composer with a sample photo and words, without a camera.
        .task {
            guard let which = UserDefaults.standard.string(forKey: "etelCompose") else { return }
            let day = try? await food.day(BoopClock.now())
            if let id = day?.meals.first(where: \.hasPhoto)?.id, let bytes = try? await food.photo(mealId: id) { await model.setPhoto(bytes) }
            model.text = "csirke rizzsel, kb. másfél adag, kevés olajjal"
            if which == "scan" || which == "draft" {
                if which == "scan" { model.minWorking = .seconds(20) }
                await model.submit()
            }
        }
        #endif
        .task {
            if let stage = start.entrance.openingStage { model.show(stage); return }
            switch start.entrance {
            case .photo: choosePhoto()
            case .text: typing = true
            case .recipe, .pantry, .barcode, .usual: break
            case .serving: if let facts = start.serving { model.showServing(facts, source: .catalog, code: "") }
            case .pick: break
            }
        }
        .task { model.profile = try? await food.sensitivity() }
        .task(id: model.stage) { listQuery = ""; listFilter = nil; if model.stage == .recipes || model.stage == .pantry || model.stage == .usuals { await model.loadLists() } }
        .interactiveDismissDisabled(model.stage == .working || model.saving)
    }

    private func choosePhoto() {
        if PhotoCapture.cameraAvailable { showCamera = true } else { showLibrary = true }
    }

    /// A picture came back from the camera or the library: into the capture, or into the draft that is already open.
    private func took(_ data: Data?) async {
        if model.stage == .draft { await model.addPhotoToDraft(data) } else { await model.setPhoto(data) }
    }

    // MARK: Pick

    /// Everything a capture can carry, on one page and all at once: when he ate, a photo, his own words — and under
    /// them the ways that need no describing (a recipe, a shelf food, a barcode, a usual meal).
    private var pick: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !model.isOnline { OfflineChip() }
            if model.redated { Text("Ez a rögzítés több mint egy hete készült, a szerver már nem fogadja el a régi napra — a mai napra kerül.").nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true) }
            MealTimeRow(model: model)
            photoZone
            words
            if let code = model.barcode {
                HStack(spacing: 10) {
                    EtelPill(text: "Vonalkód: \(code)", glyph: "search-ink", tone: .hue)
                    Text("a vázlathoz teszem").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                    Spacer(minLength: 0)
                    Button("Töröl") { model.clearCode() }.nkFont(12.5).foregroundStyle(.white.opacity(0.65)).buttonStyle(.plain)
                        .frame(minHeight: 28).accessibilityLabel("Vonalkód törlése")
                }
            }
            if let p = model.problem { problemLine(p) }
            Button { typing = false; Task { await model.submit() } } label: {
                HStack(spacing: 8) {
                    NKGlyph("spark-cream", NK.ground, size: 16)
                    Text(model.isOnline ? submitTitle : "Elteszem a telefonon").nkFont(16, .semibold).foregroundStyle(NK.ground)
                }
                .frame(maxWidth: .infinity).frame(height: 52)
                .background(Capsule().fill(model.canSubmit ? AnyShapeStyle(LinearGradient(colors: [.white, Hue.fuel.glow.opacity(0.9)], startPoint: .leading, endPoint: .trailing)) : AnyShapeStyle(.white.opacity(0.25))))
            }
            .buttonStyle(.plain).disabled(!model.canSubmit)
            VStack(alignment: .leading, spacing: 10) {
                NKMono("VAGY LEÍRÁS NÉLKÜL")
                HStack(spacing: 8) {
                    entrance("book-sage", "Recept") { model.show(.recipes) }
                    entrance("bowl-sage", "Kamra") { model.show(.pantry) }
                    entrance("search-ink", "Vonalkód") { scan.reset(); model.show(.barcode) }
                    entrance("repeat-peach", "Szokásos") { model.show(.usuals) }
                }
                Text("A vázlathoz utána is hozzátehetsz még receptet, kamra-tételt, fotót vagy szöveget.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var submitTitle: String {
        let hasWords = !model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return model.hasPhoto && hasWords ? "Kiszámolom a fotóból és a leírásból" : model.hasPhoto ? "Kiszámolom a fotóból" : "Kiszámolom"
    }

    /// The photo, or the place it goes: a lit drop zone with the camera and the library one tap away.
    @ViewBuilder private var photoZone: some View {
        if let data = model.photo, let image = UIImage(data: data) {
            ZStack(alignment: .bottom) {
                // the picture fills the zone without ever widening it
                Color.clear.frame(maxWidth: .infinity).frame(height: 210)
                    .overlay { Image(uiImage: image).resizable().scaledToFill().nkPhotoTone() }
                    .clipped()
                LinearGradient(colors: [.clear, NK.ground.opacity(0.75)], startPoint: .center, endPoint: .bottom)
                HStack(spacing: 8) {
                    EtelPill(text: "a fotó megvan", glyph: "check-sage", tone: .hue)
                    Spacer(minLength: 0)
                    photoButton("Másik kép") { choosePhoto() }
                    photoButton("Törlöm") { model.clearPhoto() }
                }
                .padding(12)
            }
            .frame(height: 210)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Hue.fuel.glow.opacity(0.45)))
        } else {
            VStack(spacing: 14) {
                ZStack {
                    Circle().fill(Hue.fuel.glow.opacity(0.18)).frame(width: 64, height: 64)
                    NKGlyph("camera-ink", Hue.fuel.glow, size: 26)
                }
                VStack(spacing: 4) {
                    Text("Fotózd le a tányért").nkFont(17, design: .serif).foregroundStyle(.white)
                    Text("Boop felismeri, mi van rajta és mennyi").nkFont(13).foregroundStyle(.white.opacity(0.6))
                }
                HStack(spacing: 8) {
                    Button { choosePhoto() } label: {
                        Text(PhotoCapture.cameraAvailable ? "Fotózok" : "Képet választok").nkFont(14.5, .semibold).foregroundStyle(NK.ground)
                            .padding(.horizontal, 20).frame(height: 42).background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain)
                    if PhotoCapture.cameraAvailable {
                        Button { showLibrary = true } label: {
                            Text("Képtárból").nkFont(14.5, .medium).foregroundStyle(.white)
                                .padding(.horizontal, 18).frame(height: 42)
                                .background(Capsule().fill(.white.opacity(0.1)).overlay(Capsule().stroke(.white.opacity(0.18))))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxWidth: .infinity).padding(.vertical, 22)
            .background {
                let shape = RoundedRectangle(cornerRadius: 24, style: .continuous)
                shape.fill(LinearGradient(colors: [Hue.fuel.glow.opacity(0.16), Hue.fuel.glow.opacity(0.04)], startPoint: .top, endPoint: .bottom))
                    .overlay(shape.stroke(Hue.fuel.glow.opacity(0.5), style: StrokeStyle(lineWidth: 1.2, dash: [6, 5])))
            }
        }
    }

    private func photoButton(_ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(12.5, .semibold).foregroundStyle(.white)
                .padding(.horizontal, 12).frame(minHeight: 32).background(Capsule().fill(.black.opacity(0.5)))
        }
        .buttonStyle(.plain)
    }

    /// His own words — alone, or beside the photo to help Boop with what a picture cannot show.
    private var words: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                NKGlyph("pen-sun", .white.opacity(0.7), size: 13)
                NKMono(model.hasPhoto ? "SEGÍTS BOOPNAK A FOTÓHOZ" : "VAGY ÍRD LE")
            }
            TextField("", text: $model.text,
                      prompt: Text(model.hasPhoto ? "pl. másfél adag, olívaolajjal sütve, a szósz tejszínes" : "pl. vacsora: csirke rizzsel és salátával").foregroundStyle(.white.opacity(0.4)),
                      axis: .vertical)
                .lineLimit(2...5)
                .nkFont(15).foregroundStyle(.white).focused($typing)
                .padding(.horizontal, 16).padding(.vertical, 14)
                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.07)))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(typing ? Hue.fuel.glow.opacity(0.6) : .white.opacity(0.12)))
        }
    }

    private func entrance(_ glyph: String, _ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                NKGlyph(glyph, .white, size: 19)
                Text(title).nkFont(12.5, .semibold).foregroundStyle(.white.opacity(0.9)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity).frame(height: 66)
            .background {
                let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
                shape.fill(.white.opacity(0.08)).overlay(shape.stroke(.white.opacity(0.14)))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func problemLine(_ text: String) -> some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel("Gond: \(text)")
    }

    // MARK: Barcode

    private var barcodeView: some View {
        BarcodeScanView(
            model: scan, profile: model.profile,
            onServing: { item, source, code in model.showServing(item, source: source, code: code) },
            onLabelPhoto: { code in model.carryCode(code); model.show(.pick); choosePhoto() },
            onWords: { code in model.carryCode(code); model.show(.pick); typing = true },
            onBack: { model.adding ? model.cancelAdding() : model.show(.pick) })
    }

    @ViewBuilder private var servingView: some View {
        if let scanned = model.scanned {
            ServingConfirm(facts: scanned.item, onConfirm: { model.confirmServing($0) },
                           onBack: { scanned.code.isEmpty ? (model.adding ? model.cancelAdding() : onDone(nil)) : model.show(.barcode) })
        }
    }

    // MARK: Working / queued

    /// Boop at work: the scan passing over the photo, or — with words only — the orb, each saying what it is doing.
    private var working: some View {
        MealScanView(image: model.photo.flatMap(UIImage.init(data:)), reduceMotion: reduceMotion)
    }

    private var queued: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let data = model.photo, let image = UIImage(data: data) {
                NKCardPhoto(Image(uiImage: image), hue: .fuel, height: 150).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            Text("\(model.hasPhoto ? "A fotó" : "A leírás") a telefonodon van. Amint lesz net, kiszámolom, és egy koppintással jóváhagyod — addig semmi nem mentődik el.")
                .nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            if let note = model.usualNote { Text(note).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true) }
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
            let t = draft.total
            // the plate: its photo, when and what window, the total in four tiles
            VStack(alignment: .leading, spacing: 0) {
                if let photo = (model.photo.flatMap(UIImage.init(data:)) ?? cardPhoto) {
                    NKCardPhoto(Image(uiImage: photo), hue: .fuel, height: 170)
                }
                VStack(alignment: .leading, spacing: 14) {
                    MealTimeRow(model: model)
                    VStack(alignment: .leading, spacing: 8) {
                        NKMono("ÖSSZESEN")
                        EtelMacroTiles(kcal: t.kcal, p: t.p, c: t.c, f: t.f)
                    }
                    .accessibilityElement(children: .contain)
                    if model.redated { note("Ez a rögzítés több mint egy hete készült, a szerver már nem fogadja el a régi napra — a mai napra kerül.") }
                    if let text = model.usualNote { note(text) }
                    if let notice = draftNotice(draft) { note(notice) }
                }
                .padding(18)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous)).nkGlass()

            // what is on it, line by line
            EtelSheetCard(label: "A TÁNYÉRON", trailing: "\(draft.items.count) tétel") {
                if draft.items.isEmpty {
                    Text("Nem ismertem fel semmit. Tegyél hozzá lent egy receptet, egy kamra-tételt, vagy írd le másképp.")
                        .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                }
                VStack(spacing: 10) {
                    ForEach(Array(draft.items.enumerated()), id: \.offset) { i, item in line(i, item) }
                }
                if draftHasUnknownAllergens(draft, profile: model.profile) {
                    Text("Egyes tételeknél nincs allergén-adat, ezért ott nem jelzek semmit — ez nem azt jelenti, hogy nincs benne.")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                }
                if let text = draft.note, !text.isEmpty { Text(text).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true) }
            }

            // one more thing onto the same plate
            EtelSheetCard(label: "HOZZÁTESZEK MÉG") {
                HStack(spacing: 8) {
                    entrance("camera-ink", "Fotó") { choosePhoto() }
                    entrance("book-sage", "Recept") { model.addMore(.recipes) }
                    entrance("bowl-sage", "Kamra") { model.addMore(.pantry) }
                    entrance("search-ink", "Vonalkód") { scan.reset(); model.addMore(.barcode) }
                }
                HStack(spacing: 8) {
                    TextField("", text: $model.moreText, prompt: Text("…vagy írd le, mi volt még").foregroundStyle(.white.opacity(0.4)), axis: .vertical)
                        .lineLimit(1...3).nkFont(15).foregroundStyle(.white).focused($typing)
                        .padding(.horizontal, 16).padding(.vertical, 12)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.07)))
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.white.opacity(0.12)))
                    Button { typing = false; Task { await model.addFromBoop(photo: nil) } } label: {
                        NKGlyph("plus-ink", NK.ground, size: 18).frame(width: 46, height: 46)
                            .background(Circle().fill(.white.opacity(model.moreText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.25 : 0.95)))
                    }
                    .buttonStyle(.plain).disabled(model.moreText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityLabel("Hozzáadom a leírtakat")
                }
                if let p = model.problem { problemLine(p) }
            }

            if let p = savingProblem { problemLine(p) }
            HStack(spacing: 10) {
                Button { Task { await save() } } label: {
                    HStack(spacing: 8) {
                        NKGlyph("check-ink", NK.ground, size: 16)
                        Text(model.saving ? "Mentem…" : "Mentem").nkFont(16, .semibold).foregroundStyle(NK.ground)
                    }
                    .frame(maxWidth: .infinity).frame(height: 52)
                    .background(Capsule().fill(model.canSave ? AnyShapeStyle(LinearGradient(colors: [.white, Hue.fuel.glow.opacity(0.9)], startPoint: .leading, endPoint: .trailing)) : AnyShapeStyle(.white.opacity(0.25))))
                }
                .buttonStyle(.plain).disabled(!model.canSave)
                Button { confirmDiscard = true } label: {
                    Text(model.adopted ? "Elvetem" : "Mégsem").nkFont(15).foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 20).frame(height: 52)
                        .background(Capsule().fill(.white.opacity(0.1)).overlay(Capsule().stroke(.white.opacity(0.18))))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func note(_ text: String) -> some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
    }

    @State private var savingProblem: String?
    @State private var confirmDiscard = false

    private func save() async {
        savingProblem = nil
        switch await model.save() {
        case .saved(let toast): onDone(toast)
        case .failed(let why): savingProblem = why
        }
    }

    /// One thing on the plate, as a tile of its own with three clear rows: what it is and what it adds; how much
    /// (a stepper, the number typeable); its macros and the way to take it off. Flags that matter to him close it.
    private func line(_ i: Int, _ item: DraftItem) -> some View {
        let badges = draftBadges(for: item, profile: model.profile)
        let glyph = switch item.source { case .recipe: "book-sage"; case .pantry: "bowl-sage"; case .estimate: "spark-cream" }
        let doubt = sourceTag(item).contains("nézd át")
        let c = item.contribution
        // grams and millilitres move by ten, servings and pieces by a half
        let step: Double = ["g", "ml"].contains(item.unit.lowercased()) ? 10 : 0.5
        return VStack(alignment: .leading, spacing: 12) {
            // 1 · what it is, and the energy it adds
            HStack(alignment: .center, spacing: 12) {
                EtelMedallion(glyph: glyph, size: 40, lit: item.source != .estimate)
                VStack(alignment: .leading, spacing: 4) {
                    TextField("", text: Binding(get: { item.name }, set: { model.rename(i, $0) }))
                        .nkFont(16, .medium).foregroundStyle(.white)
                    EtelPill(text: sourceTag(item), tone: doubt ? .warn : (item.source == .estimate ? .plain : .hue))
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 0) {
                    Text(huInt(Int(c.kcal.rounded()))).font(.custom(Lagy.outfitFamily, size: 22).weight(.medium))
                        .foregroundStyle(.white).monospacedDigit()
                    Text("kcal").nkFont(11).foregroundStyle(.white.opacity(0.5))
                }
                .accessibilityElement(children: .combine)
            }
            Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
            // 2 · how much
            HStack(spacing: 10) {
                Text("Mennyiség").nkFont(13).foregroundStyle(.white.opacity(0.6))
                Spacer(minLength: 6)
                HStack(spacing: 0) {
                    stepButton("−", "\(item.name) kevesebb") { model.setAmount(i, max(0, item.amount - step)) }
                    HStack(spacing: 4) {
                        TextField("", value: Binding(get: { item.amount }, set: { model.setAmount(i, $0) }), format: .number)
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                            .font(.custom(Lagy.outfitFamily, size: 17).weight(.medium)).foregroundStyle(.white)
                            .frame(width: 58).accessibilityLabel("\(item.name) mennyisége")
                        Text(item.unit).nkFont(13).foregroundStyle(.white.opacity(0.6)).frame(minWidth: 28, alignment: .leading)
                    }
                    .padding(.horizontal, 6)
                    stepButton("+", "\(item.name) több") { model.setAmount(i, item.amount + step) }
                }
                .background(Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.16))))
            }
            // 3 · its macros, and the way off the plate
            HStack(spacing: 6) {
                macroChip("F", c.p, lit: true)
                macroChip("Sz", c.c)
                macroChip("Zs", c.f)
                Spacer(minLength: 6)
                Button { model.remove(i) } label: {
                    Text("Leveszem").nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.7))
                        .padding(.horizontal, 12).frame(minHeight: 30)
                        .background(Capsule().stroke(.white.opacity(0.22)))
                }
                .buttonStyle(.plain).accessibilityLabel("\(item.name) levétele a tányérról")
            }
            if !badges.isEmpty {
                NKFlowRow(spacing: 6, rowSpacing: 6) { ForEach(badges) { EtelPill(badge: $0) } }
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.05)))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(doubt ? Color(red: 0.96, green: 0.78, blue: 0.38).opacity(0.45) : .white.opacity(0.1)))
    }

    private func stepButton(_ sign: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(sign).font(.custom(Lagy.outfitFamily, size: 20).weight(.medium)).foregroundStyle(.white)
                .frame(width: 40, height: 40).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityLabel(label)
    }

    /// One macro of a line: its letter, then the grams.
    private func macroChip(_ letter: String, _ grams: Double, lit: Bool = false) -> some View {
        HStack(spacing: 4) {
            Text(letter).nkFont(11, .semibold).foregroundStyle(lit ? Hue.fuel.glow : .white.opacity(0.55))
            Text("\(Int(grams.rounded())) g").nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.9)).monospacedDigit()
        }
        .padding(.horizontal, 9).frame(minHeight: 26)
        .background(Capsule().fill(lit ? Hue.fuel.glow.opacity(0.14) : .white.opacity(0.08)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(letter == "F" ? "fehérje" : letter == "Sz" ? "szénhidrát" : "zsír") \(Int(grams.rounded())) gramm")
    }

    private func sourceTag(_ item: DraftItem) -> String { draftSourceTag(item) }

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
                    else { recipeFinder(recipes) }
                    ForEach(filterRecipes(recipes, query: listQuery).filter { listFilter == nil || $0.category == listFilter }) { r in
                        row(r.name, "\(huInt(Int((r.macros.kcal / Double(max(r.servings, 1))).rounded()))) kcal · \(Int(r.perServing.p.rounded())) g fehérje adagonként",
                            glyph: "book-sage", points: etelPoints(r.fit)) { model.use(DraftItem(recipe: r)) }
                    }
                } else { loadingRow }
            } else if model.stage == .usuals {
                if let usuals = model.usuals {
                    if usuals.isEmpty { Text("Még nincs elég rögzített étkezésed ahhoz, hogy szokásosat mondjak — pár nap után itt lesznek.").nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true) }
                    ForEach(usuals) { u in
                        row(u.title, usualMealLine(u), glyph: "repeat-peach") { Task { await model.chooseUsual(u) } }
                    }
                } else { loadingRow }
            } else {
                if let shelf = model.shelf {
                    let rows = shelf.filter { $0.kind == "food" && DraftItem(pantry: $0) != nil }
                    if rows.isEmpty { Text("A kamrád még üres, vagy nincs benne étel.").nkFont(14).foregroundStyle(.white.opacity(0.7)) }
                    else { shelfFinder(rows) }
                    ForEach(Array(filterShelf(rows, query: listQuery, category: listFilter).enumerated()), id: \.offset) { _, p in
                        row(p.name, "\(huInt(Int((p.kcal ?? 0).rounded()))) kcal / \(Int(p.per ?? 0)) \(p.unit ?? "")",
                            glyph: etelCategoryGlyph(p.category)) { model.use(DraftItem(pantry: p)) }
                    }
                } else { loadingRow }
            }
            Button { model.adding ? model.cancelAdding() : model.show(.pick) } label: {
                Text("Vissza").nkFont(15).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity).frame(height: 46)
                    .background(Capsule().fill(.white.opacity(0.1)))
            }
            .buttonStyle(.plain)
        }
    }

    /// The recipe list's search and slot chips — the same as on the Receptek tab — and the line when nothing matches.
    @ViewBuilder private func recipeFinder(_ recipes: [Recipe]) -> some View {
        let slots = recipeSlots(recipes)
        EtelSearchField(query: $listQuery, prompt: "Keresés a receptek között")
        if slots.count > 1 {
            EtelFilterChips(chips: [(nil, "Mind · \(recipes.count)")] + slots.map { (Optional($0.key), "\($0.label) · \($0.count)") },
                            selected: $listFilter)
        }
        if filterRecipes(recipes, query: listQuery).filter({ listFilter == nil || $0.category == listFilter }).isEmpty {
            Text("Ilyen receptet nem találok.").nkFont(14).foregroundStyle(.white.opacity(0.6))
        }
    }

    /// The shelf list's search and category chips — the same as on the Kamra tab — and the line when nothing matches.
    @ViewBuilder private func shelfFinder(_ rows: [PantryRow]) -> some View {
        let categories = shelfCategories(rows)
        EtelSearchField(query: $listQuery, prompt: "Keresés a kamrában")
        if categories.count > 1 {
            EtelFilterChips(chips: [(nil, "Mind · \(rows.count)")] + categories.map { (Optional($0.key), "\($0.label) · \($0.count)") },
                            selected: $listFilter)
        }
        if filterShelf(rows, query: listQuery, category: listFilter).isEmpty {
            Text("Ilyet nem találok a kamrádban.").nkFont(14).foregroundStyle(.white.opacity(0.6))
        }
    }

    private var loadingRow: some View {
        Text("Betöltés folyamatban").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder)
    }

    private func row(_ title: String, _ sub: String, glyph: String, points: Int? = nil, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                EtelMedallion(glyph: glyph, size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15.5, .medium).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                    Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                }
                Spacer(minLength: 0)
                if let points { EtelScoreRing(points: points, size: 34) }
                NKGlyph("plus-ink", Hue.fuel.glow, size: 16)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(18)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - When he ate

/// When the meal was eaten: now by default, a quick step back, or any moment of the last week — a meal logged
/// afterwards lands where it belongs in the day.
struct MealTimeRow: View {
    @Bindable var model: MealComposerModel
    @State private var picking = false

    private var label: String {
        let f = DateFormatter(); f.locale = Locale(identifier: "hu_HU")
        f.dateFormat = Calendar.current.isDateInToday(model.capturedAt) ? "'ma' HH:mm" : "MMM d. HH:mm"
        return f.string(from: model.capturedAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                NKGlyph("clock-ink", .white.opacity(0.7), size: 14)
                NKMono("MIKOR ETTED")
                Spacer(minLength: 8)
                Text("\(etelSlotLabel(FoodClient.slot(at: model.capturedAt, cal: .current))) · \(label)")
                    .nkFont(13, .medium).foregroundStyle(Hue.fuel.glow)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("Most", on: model.chosenAt == nil) { model.setTime(nil); picking = false }
                    ForEach([(30, "fél órája"), (60, "1 órája"), (120, "2 órája")], id: \.0) { minutes, text in
                        chip(text, on: model.chosenAt != nil && abs(model.minutesAgo - minutes) <= 1) {
                            model.setTime(BoopClock.now().addingTimeInterval(-Double(minutes) * 60)); picking = false
                        }
                    }
                    chip("Tegnap", on: model.chosenAt != nil && Calendar.current.isDateInYesterday(model.capturedAt)) {
                        model.setYesterday(); picking = true
                    }
                    chip("Más időpont", on: picking) { picking.toggle(); if picking, model.chosenAt == nil { model.setTime(model.capturedAt) } }
                }
            }
            if picking {
                DatePicker("Mikor etted", selection: Binding(get: { model.capturedAt }, set: { model.setTime($0) }),
                           in: model.earliestTime...BoopClock.now(), displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.compact).labelsHidden().colorScheme(.dark).tint(Hue.fuel.glow)
                    .environment(\.locale, Locale(identifier: "hu_HU"))
            }
        }
    }

    private func chip(_ text: String, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).nkFont(12.5, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                .padding(.horizontal, 12).frame(minHeight: 34)
                .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

// MARK: - Boop reading the plate

/// The working stage. With a photo: the picture, corner marks, and a scan line sweeping down and back over it while
/// the pill says what Boop is doing. With words only: the orb and the same steps. Still when motion is reduced.
struct MealScanView: View {
    let image: UIImage?
    let reduceMotion: Bool
    /// What the pill says, in turn (nil = the meal's own steps).
    var phrases: [String]? = nil
    /// The line under it.
    var footnote = "Semmi nem mentődik el, amíg át nem nézted."
    @State private var sweep: CGFloat = 0
    @State private var step = 0
    @State private var pulse = false
    private let hue = Hue.fuel

    init(image: UIImage?, reduceMotion: Bool, phrases: [String]? = nil, footnote: String = "Semmi nem mentődik el, amíg át nem nézted.") {
        self.image = image; self.reduceMotion = reduceMotion; self.phrases = phrases; self.footnote = footnote
    }

    private var steps: [String] {
        if let phrases, !phrases.isEmpty { return phrases }
        return image == nil ? ["Olvasom, amit írtál…", "Megkeresem a kamrádban…", "Kiszámolom…"]
            : ["Megnézem a képet…", "Felismerem, mi van rajta…", "Megbecsülöm az adagot…", "Kiszámolom…"]
    }

    var body: some View {
        VStack(spacing: 16) {
            if let image {
                GeometryReader { g in
                    ZStack(alignment: .top) {
                        Image(uiImage: image).resizable().scaledToFill().nkPhotoTone()
                            .frame(width: g.size.width, height: g.size.height).clipped()
                        Color.black.opacity(0.18)
                        if !reduceMotion {
                            // the band of light trailing the line, then the line itself
                            LinearGradient(colors: [hue.glow.opacity(0), hue.glow.opacity(0.38)], startPoint: .top, endPoint: .bottom)
                                .frame(height: 80).offset(y: sweep * (g.size.height - 2) - 80)
                            Capsule().fill(.white).frame(height: 2.5).shadow(color: hue.glow, radius: 10).shadow(color: hue.glow, radius: 4)
                                .offset(y: sweep * (g.size.height - 2))
                        }
                        corners.padding(16)
                    }
                }
                .frame(height: 330)
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(hue.glow.opacity(0.5)))
                .overlay(alignment: .bottom) { pill.padding(.bottom, 16) }
            } else {
                VStack(spacing: 18) {
                    StillOrb(palette: hue.orb, size: 110, level: 0.62)
                        .scaleEffect(pulse ? 1.06 : 0.96)
                        .shadow(color: hue.glow.opacity(pulse ? 0.55 : 0.2), radius: pulse ? 30 : 14)
                    pill
                }
                .frame(maxWidth: .infinity).padding(.vertical, 34)
            }
            Text(footnote).nkFont(12.5).foregroundStyle(.white.opacity(0.5))
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.25).repeatForever(autoreverses: true)) { sweep = 1 }
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { pulse = true }
        }
        .task {
            while !Task.isCancelled, step < steps.count - 1 {
                try? await Task.sleep(for: .milliseconds(image == nil ? 900 : 1150))
                if Task.isCancelled { return }
                withAnimation(.easeInOut(duration: 0.25)) { step += 1 }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(steps[min(step, steps.count - 1)])
    }

    private var pill: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small).tint(NK.ground)
            Text(steps[min(step, steps.count - 1)]).nkFont(14, .semibold).foregroundStyle(NK.ground)
                .contentTransition(.opacity)
        }
        .padding(.horizontal, 16).frame(height: 40)
        .background(Capsule().fill(.white.opacity(0.95)))
    }

    /// Four corner marks, the way a viewfinder frames what it is looking at.
    private var corners: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height, l: CGFloat = 26
            Path { p in
                p.move(to: CGPoint(x: 0, y: l)); p.addLine(to: .zero); p.addLine(to: CGPoint(x: l, y: 0))
                p.move(to: CGPoint(x: w - l, y: 0)); p.addLine(to: CGPoint(x: w, y: 0)); p.addLine(to: CGPoint(x: w, y: l))
                p.move(to: CGPoint(x: w, y: h - l)); p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: w - l, y: h))
                p.move(to: CGPoint(x: l, y: h)); p.addLine(to: CGPoint(x: 0, y: h)); p.addLine(to: CGPoint(x: 0, y: h - l))
            }
            .stroke(.white.opacity(0.9), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
        }
    }
}
