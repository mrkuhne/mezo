import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// MARK: - The food client, handed down the view tree

private struct FoodClientKey: EnvironmentKey { static let defaultValue: FoodClient? = nil }

extension EnvironmentValues {
    /// The signed-in user's food client (nil before sign-in, and in tests that have no server).
    var foodClient: FoodClient? {
        get { self[FoodClientKey.self] }
        set { self[FoodClientKey.self] = newValue }
    }
}

// MARK: - What the room reads

/// The room's data: the day, the plan, the coach's words, the meals' photos and the supplement groups. Each piece
/// loads and fails on its own, so a missing coach or a slow photo never blanks the room.
@MainActor @Observable
final class EtelStore {
    private(set) var day: FoodDay?
    private(set) var dayProblem: FoodFetchError?
    private(set) var plan: FuelPlan?
    private(set) var planProblem: FoodFetchError?
    private(set) var coach: [UUID: MealCoach] = [:]
    private(set) var photos: [UUID: UIImage] = [:]
    /// Captures still in the owner's hands (B4 Task 10) and their photos, by id.
    private(set) var pending: [PendingDraft] = []
    private(set) var pendingPhotos: [UUID: UIImage] = [:]
    /// The owner's recipe library (Receptek), its photos by recipe id, and his sensitivity profile for the badges.
    private(set) var recipes: [Recipe] = []
    private(set) var recipesLoaded = false
    private(set) var recipesProblem: FoodFetchError?
    private(set) var recipeImages: [UUID: UIImage] = [:]
    private(set) var profile: SensitivityProfile?
    /// The owner's shelf (Kamra), the week (Hét) and each of its days' mean meal score (points, by date).
    private(set) var shelf: [PantryRow] = []
    private(set) var shelfLoaded = false
    private(set) var shelfProblem: FoodFetchError?
    private(set) var week: FuelWeek?
    private(set) var weekLoaded = false
    private(set) var weekProblem: FoodFetchError?
    private(set) var weekScores: [String: Int] = [:]
    /// Days whose meals could not be read for a score (the tab says so instead of showing a quietly wrong average).
    private(set) var weekScoreFailures: Set<String> = []
    private(set) var groups: [SupplementGroup] = []
    /// The protocol's rows by name, for the list editor (B4 Task 14).
    private(set) var protocolRows: [SupplementRow] = []
    private(set) var groupsLoaded = false
    private(set) var groupsProblem: FoodFetchError?
    /// The groups taken today and the intake entries that took them (kept so a mis-tap can be undone).
    private(set) var takenIds: [String: [UUID]] = [:]
    private(set) var busy: Set<String> = []
    var taken: Set<String> { Set(takenIds.keys) }
    private(set) var loading = false
    /// The tip the owner sent away with *Most nem* (until the next load).
    private(set) var tipDismissed = false

    @ObservationIgnored private var food: FoodClient?
    var currentFood: FoodClient? { food }
    @ObservationIgnored private var now = Date()
    /// Bumped whenever the day is replaced by a fresh read.
    @ObservationIgnored private var dayVersion = 0
    /// The day `takenIds` belongs to.
    @ObservationIgnored private var takenDay: String?
    @ObservationIgnored private var failedWater: (ml: Int, ref: UUID, at: Date)?

    /// The day's `yyyy-MM-dd`, as the server knows it.
    var ymd: String { food?.ymd(now) ?? day?.date ?? "" }

    private static func attempt<T: Sendable>(_ work: @Sendable () async throws -> T) async -> Result<T, FoodFetchError> {
        do { return .success(try await work()) } catch let e as FoodFetchError { return .failure(e) } catch { return .failure(.server) }
    }

    func load(food: FoodClient, now: Date) async {
        self.food = food; self.now = now
        loading = true
        tipDismissed = false
        // The taken state belongs to one day: a store left open past midnight starts the new day clean.
        let today = food.ymd(now)
        if takenDay != today {
            let saved = UserDefaults.standard.dictionary(forKey: "etel.takenIds.\(today)") as? [String: [String]] ?? [:]
            takenIds = saved.mapValues { $0.compactMap(UUID.init(uuidString:)) }
            takenDay = today
        }
        async let d = Self.attempt { try await food.day(now) }
        async let p = Self.attempt { try await food.plan(now) }
        async let s = Self.attempt { (try await food.protocol(), try await food.stash()) }
        switch await d {
        case .success(let v): day = v; dayVersion += 1; dayProblem = nil
        case .failure(let e): dayProblem = e
        }
        switch await p {
        case .success(let v): plan = v; planProblem = nil
        case .failure(let e): planProblem = e
        }
        switch await s {
        case .success(let (proto, stash)):
            applyProtocol(proto, stash: stash)
            groupsProblem = nil
        case .failure(let e): groupsProblem = e
        }
        groupsLoaded = true
        loading = false
        // The words and the photos arrive after the numbers; neither is needed to read the day.
        async let words: Void = loadCoach(food)
        async let pics: Void = loadPhotos(food)
        _ = await (words, pics)
    }

    private func applyProtocol(_ proto: FoodProtocol, stash: [StashRow]) {
        let names = Dictionary(stash.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        groups = supplementGroups(proto.items, names: names)
        protocolRows = supplementRows(proto.items, names: names)
    }

    private func loadCoach(_ food: FoodClient) async {
        if case .success(let verdicts) = await Self.attempt({ try await food.coach(now) }) { coach = verdicts }
    }

    /// Photos for the meals that say they have one — never a GET per meal to find out.
    private func loadPhotos(_ food: FoodClient) async {
        let wanted = (day?.meals ?? []).filter { $0.hasPhoto && photos[$0.id] == nil }.map(\.id)
        guard !wanted.isEmpty else { return }
        let fetched = await withTaskGroup(of: (UUID, Data?).self) { group in
            for id in wanted { group.addTask { (id, try? await food.photo(mealId: id)) } }
            var out: [(UUID, Data?)] = []
            for await r in group { out.append(r) }
            return out
        }
        for (id, data) in fetched { if let data, let image = UIImage(data: data) { photos[id] = image } }
    }

    // MARK: - Kamra (B4 Task 13)

    /// The shelf and the owner's sensitivity profile (for the row badges). A failed reload keeps what is on screen.
    func loadShelf(food: FoodClient) async {
        self.food = food
        switch await Self.attempt({ try await food.pantry() }) {
        case .success(let rows): shelf = rows.filter { $0.kind == "food" }; shelfProblem = nil
        case .failure(let e): shelfProblem = e
        }
        shelfLoaded = true
        if case .success(let p) = await Self.attempt({ try await food.sensitivity() }) { profile = p }
    }

    /// A food the owner just put on the shelf: at the top of the list at once (the server returned the stored row).
    func shelfAdded(_ row: PantryRow) {
        shelf.removeAll { $0.id != nil && $0.id == row.id }
        shelf.insert(row, at: 0)
        shelfLoaded = true; shelfProblem = nil
    }

    // MARK: - Hét (B4 Task 13)

    /// The last seven days ending today: one rollup read, then each logged day's meals for its own mean score.
    func loadWeek(food: FoodClient, now: Date) async {
        self.food = food
        let start = Calendar.current.date(byAdding: .day, value: -6, to: now) ?? now
        switch await Self.attempt({ try await food.week(from: start) }) {
        case .success(let w): week = w; weekProblem = nil
        case .failure(let e): weekProblem = e
        }
        weekLoaded = true
        guard let week else { return }
        let wanted = week.days.filter { $0.consumed.kcal > 0 && $0.fuelMode == nil }.map(\.date)
        let results = await withTaskGroup(of: (String, Result<Int?, Error>).self) { group in
            for date in wanted {
                group.addTask {
                    let p = date.split(separator: "-").compactMap { Int($0) }
                    guard p.count == 3, let at = Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) else {
                        return (date, .failure(FoodFetchError.server))
                    }
                    do {
                        let scores = try await food.day(at).meals.compactMap(\.score)
                        return (date, .success(scores.isEmpty ? nil : Int((scores.reduce(0, +) / Double(scores.count) * 100).rounded())))
                    } catch { return (date, .failure(error)) }
                }
            }
            var out: [(String, Result<Int?, Error>)] = []
            for await r in group { out.append(r) }
            return out
        }
        var scored: [String: Int] = [:], failed: Set<String> = []
        for (date, result) in results {
            switch result {
            case .success(let points): if let points { scored[date] = points }
            case .failure: failed.insert(date)
            }
        }
        weekScores = scored
        weekScoreFailures = failed
    }

    // MARK: - Recipes (B4 Task 12)

    /// The library and its photos. A failed reload keeps what the room already had on screen.
    func loadRecipes(food: FoodClient) async {
        self.food = food
        switch await Self.attempt({ try await food.recipes() }) {
        case .success(let list): recipes = list; recipesProblem = nil
        case .failure(let e): recipesProblem = e
        }
        recipesLoaded = true
        if case .success(let p) = await Self.attempt({ try await food.sensitivity() }) { profile = p }
        let wanted = recipes.filter { $0.hasImage && recipeImages[$0.id] == nil }.map(\.id)
        recipeImages = recipeImages.filter { id, _ in recipes.contains { $0.id == id && $0.hasImage } }
        guard !wanted.isEmpty else { return }
        let fetched = await withTaskGroup(of: (UUID, Data?).self) { group in
            for id in wanted { group.addTask { (id, try? await food.recipeImage(id)) } }
            var out: [(UUID, Data?)] = []
            for await r in group { out.append(r) }
            return out
        }
        for (id, data) in fetched { if let data, let image = UIImage(data: data) { recipeImages[id] = image } }
    }

    /// A recipe the owner just saved: at the top of the library at once (the server returned the stored row).
    func recipeSaved(_ recipe: Recipe) {
        recipes.removeAll { $0.id == recipe.id }
        recipes.insert(recipe, at: 0)
        recipesLoaded = true; recipesProblem = nil
    }

    /// The owner's own photo on a recipe (JPEG, long edge 1600). Returns the toast to show.
    func setRecipeImage(_ data: Data, recipeId: UUID) async -> String {
        guard let food else { return "Most nem tudom feltölteni a fotót" }
        guard let jpeg = MealPhoto.jpeg(from: data), let image = UIImage(data: jpeg) else { return "Ezt a képet nem tudom megnyitni" }
        do {
            try await food.setRecipeImage(jpeg, recipeId: recipeId)
            recipeImages[recipeId] = image
            if let i = recipes.firstIndex(where: { $0.id == recipeId }) { recipes[i].hasImage = true }
            return "A recept fotója elmentve"
        } catch FoodFetchError.offline {
            return "Nincs net — a fotót most nem tudom feltölteni"
        } catch {
            return "A fotót most nem tudom feltölteni"
        }
    }

    func removeRecipeImage(_ id: UUID) async -> String {
        guard let food else { return "Most nem tudom törölni a fotót" }
        do {
            try await food.deleteRecipeImage(id)
            recipeImages[id] = nil
            if let i = recipes.firstIndex(where: { $0.id == id }) { recipes[i].hasImage = false }
            return "A fotó törölve"
        } catch {
            return "A fotót most nem tudom törölni"
        }
    }

    /// Logs one serving of a recipe as a meal (one tap). `clientRef` is kept by the caller until the save worked, so a
    /// retry after a lost answer is the same meal.
    func logRecipe(_ recipe: Recipe, clientRef: UUID) async -> (ok: Bool, text: String) {
        guard let food else { return (false, "Most nem tudom rögzíteni") }
        let moment = BoopClock.now()
        let draft = MealDraft(date: food.ymd(moment), slot: recipe.category, title: recipe.name, items: [DraftItem(recipe: recipe)])
        do {
            let meal = try await food.save(draft, clientRef: clientRef, capturedAt: moment)
            return (true, "\(recipe.name) rögzítve · \(huInt(Int(meal.macros.kcal.rounded()))) kcal")
        } catch FoodFetchError.offline {
            return (false, "Nincs net — próbáld újra, ha van")
        } catch {
            return (false, "Nem sikerült rögzíteni — próbáld újra")
        }
    }

    /// Adds water: shown at once, undone when the server does not take it. Returns the toast to show.
    ///
    /// A tap that failed keeps its key: tapping the same amount again is the same logical tap, so a server that did
    /// record the lost one answers the retry with that row instead of counting the water twice.
    func addWater(_ ml: Int) async -> String {
        guard let food, var d = day else { return "Most nem tudom elküldeni" }
        let tap = failedWater.flatMap { $0.ml == ml ? $0 : nil } ?? (ml: ml, ref: UUID(), at: Date())
        let version = dayVersion
        d.consumed.water += Double(ml)
        day = d
        do {
            try await food.water(ml: ml, date: now, clientRef: tap.ref, capturedAt: tap.at)
            failedWater = nil
            return "Víz +\(ml) ml"
        } catch {
            failedWater = tap
            // A refresh that landed meanwhile replaced the day with the server's own count: leave that alone.
            if version == dayVersion, var back = day { back.consumed.water -= Double(ml); day = back }
            return "Nem sikerült elküldeni — próbáld újra"
        }
    }

    // MARK: - Captures waiting for the owner

    func refreshPending(_ box: FoodOutbox?) async {
        guard let box else { pending = []; return }
        let cards = await box.pendingDrafts()
        pending = cards
        var photos: [UUID: UIImage] = [:]
        for c in cards { if let ref = c.photoRef, let data = box.photoData(ref), let image = UIImage(data: data) { photos[c.id] = image } }
        pendingPhotos = photos
    }

    /// The owner's tap on a confirmation card: the only thing that saves a captured meal. The capture instant and the
    /// card's id travel with it, so a retry after a lost answer is the same meal.
    func saveCard(_ card: PendingDraft, box: FoodOutbox) async -> String {
        guard let food, case .ready(var draft) = card.state else { return "Most nem tudom elmenteni" }
        draft.photo = card.photoRef.flatMap { box.photoData($0) }
        do {
            let meal = try await food.save(draft, clientRef: card.id, capturedAt: card.capturedAt)
            // The photo goes up with the save on a good day; when it did not, it stays on the phone as a card.
            await box.finishSave(card.id, meal: meal)
            await refreshPending(box)
            await load(food: food, now: now)
            let stranded = draft.photo != nil && !meal.hasPhoto
            return "\(draftTitle(draft)) rögzítve · \(huInt(Int(meal.macros.kcal.rounded()))) kcal" + (stranded ? " · a fotó még a telefonon vár" : "")
        } catch FoodFetchError.offline {
            return "Nincs net — a kártya megvár"
        } catch {
            return "Nem sikerült elmenteni — próbáld újra"
        }
    }

    // MARK: - The supplement list on the phone (B4 Task 14, owner decision 18)

    /// Reads the protocol and the stash again after an edit. Returns false when the read failed (the list keeps what it had).
    private func reloadSupplements(_ food: FoodClient) async -> Bool {
        switch await Self.attempt({ (try await food.protocol(), try await food.stash()) }) {
        case .success(let (proto, stash)): applyProtocol(proto, stash: stash); groupsProblem = nil; groupsLoaded = true; return true
        case .failure: return false
        }
    }

    private func supplementProblem(_ e: Error, _ fallback: String) -> String {
        switch e as? FoodFetchError {
        case .offline: "Nincs net — ehhez kell"
        case .unauthorized: "Újra be kell jelentkezned"
        default: fallback
        }
    }

    /// Takes one item off the list. The next one-tap tick reads the protocol fresh, so it ticks only what is left.
    func removeSupplement(_ id: UUID) async -> String {
        guard let food else { return "Most nem tudom kivenni" }
        do { try await food.removeProtocolItem(id) } catch { return supplementProblem(error, "Nem sikerült kivenni — próbáld újra") }
        _ = await reloadSupplements(food)
        return "Kivettem a listádról"
    }

    func setSupplementDose(_ id: UUID, dose: String) async -> String {
        guard let food else { return "Most nem tudom átírni" }
        let value = dose.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return "Írd be az adagot" }
        do { try await food.setProtocolDose(id, dose: value) } catch { return supplementProblem(error, "Nem sikerült átírni — próbáld újra") }
        _ = await reloadSupplements(food)
        return "Az adag: \(value)"
    }

    /// A new supplement: made on the shelf, then put on the protocol in `slotKey`. A name already on the list is not added twice.
    func addSupplement(name: String, dose: String, slotKey: String) async -> String {
        guard let food else { return "Most nem tudom felvenni" }
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return "Írd be a kiegészítő nevét" }
        if let same = protocolRows.first(where: { $0.name.caseInsensitiveCompare(clean) == .orderedSame }) {
            return "\(same.name) már a listádon van"
        }
        let value = dose.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let pantryId = try await food.createSupplement(name: clean, dose: value.isEmpty ? nil : value)
            try await food.addProtocolItem(pantryItemId: pantryId, slotKey: slotKey, dose: value.isEmpty ? nil : value)
        } catch { return supplementProblem(error, "Nem sikerült felvenni — próbáld újra") }
        _ = await reloadSupplements(food)
        return "\(clean) a listádon"
    }

    // MARK: - Kímélő mode (B4 Task 14)

    /// The open recovery period, nil when there is none; throws when it could not be read.
    func kimelo() async throws -> KimeloPeriod? {
        guard let food else { throw FoodFetchError.unauthorized }
        return try await food.recovery()
    }

    /// Opens kímélő mode for today. An open period of any kind is left alone: a tap never turns an injury into an illness.
    func startKimelo(_ category: SkipReason) async -> EtelOutcome {
        guard let food else { return EtelOutcome(ok: false, text: "Most nem tudom bekapcsolni") }
        do {
            if try await food.recovery() != nil { return EtelOutcome(ok: false, text: "A kímélő mód már be van kapcsolva") }
            try await food.startKimelo(category)
        } catch FoodFetchError.offline { return EtelOutcome(ok: false, text: "Nincs net — ehhez kell")
        } catch { return EtelOutcome(ok: false, text: "Nem sikerült bekapcsolni — próbáld újra") }
        await load(food: food, now: now)
        return EtelOutcome(ok: true, text: "Kímélő mód bekapcsolva — ma nincs kalóriakeret")
    }

    /// Takes kímélő mode back out, in one tap.
    func endKimelo() async -> EtelOutcome {
        guard let food else { return EtelOutcome(ok: false, text: "Most nem tudom kikapcsolni") }
        do {
            guard let period = try await food.recovery() else {
                await load(food: food, now: now)
                return EtelOutcome(ok: true, text: "A kímélő mód már ki van kapcsolva")
            }
            try await food.endKimelo(period, today: now)
        } catch FoodFetchError.offline { return EtelOutcome(ok: false, text: "Nincs net — ehhez kell")
        } catch { return EtelOutcome(ok: false, text: "Nem sikerült kikapcsolni — próbáld újra") }
        await load(food: food, now: now)
        return EtelOutcome(ok: true, text: "A kímélő mód kikapcsolva — újra számolom a keretet.")
    }

    /// The owner's rules, as just saved: the badges everywhere read them from here.
    func profileSaved(_ p: SensitivityProfile) { profile = p }

    func isTaken(_ group: SupplementGroup) -> Bool { taken.contains(group.key) }
    func isBusy(_ group: SupplementGroup) -> Bool { busy.contains(group.key) }

    /// One tap takes the whole group; a second tap on "Bevéve" undoes it (the server soft-deletes the entries).
    func toggle(_ group: SupplementGroup) async -> String {
        guard let food, !busy.contains(group.key) else { return "" }
        let key = group.key, dayKey = ymd
        busy.insert(key); defer { busy.remove(key) }
        if let ids = takenIds[key] {
            takenIds[key] = nil
            var left = ids
            do {
                for id in ids { try await food.deleteIntake(id); left.removeFirst() }
                persistTaken(dayKey)
                return "Visszavontam"
            } catch {
                takenIds[key] = left
                persistTaken(dayKey)
                return "Nem sikerült visszavonni — próbáld újra"
            }
        }
        takenIds[key] = []
        do {
            let ids = try await food.tickGroupIntakes(daypart: key, clientRef: supplementRef(day: dayKey, daypart: key), capturedAt: Date())
            takenIds[key] = ids
            persistTaken(dayKey)
            return "\(group.label): mind a \(group.count) bevéve"
        } catch {
            takenIds[key] = nil
            return "Nem sikerült elküldeni — próbáld újra"
        }
    }

    private func persistTaken(_ dayKey: String) {
        UserDefaults.standard.set(takenIds.mapValues { $0.map(\.uuidString) }, forKey: "etel.takenIds.\(dayKey)")
    }

    func dismissTip() { tipDismissed = true }
}

/// What an action of the room says back: whether it went through, and the sentence for the owner.
struct EtelOutcome: Equatable {
    let ok: Bool
    let text: String
}

/// What the Ma tab's settings and skip sheets show (page level, one at a time).
enum EtelSheet: Identifiable {
    case sensitivity, diet, rhythm, kimelo, supplements
    case skip(PlanWindow)
    var id: String {
        switch self {
        case .sensitivity: "sensitivity"
        case .diet: "diet"
        case .rhythm: "rhythm"
        case .kimelo: "kimelo"
        case .supplements: "supplements"
        case .skip(let w): "skip-\(w.slot)-\(w.from)"
        }
    }
}

/// What the Receptek tab's sheet shows.
enum RecipeSheet: Identifiable {
    case detail(UUID)
    case importer(RecipeImportModel.Mode)
    case workshop
    var id: String {
        switch self {
        case .detail(let id): "detail-\(id)"
        case .importer(let m): "import-\(m)"
        case .workshop: "workshop"
        }
    }
}

/// What the Kamra tab's sheet shows: a food, or one of the four add routes.
enum KamraSheet: Identifiable {
    case item(PantryRow)
    case add(PantryAddRoute)
    var id: String {
        switch self {
        case .item(let r): "item-\(r.rowKey)"
        case .add(let route): "add-\(route.rawValue)"
        }
    }
}

/// Holds the import model for the life of the sheet (the sheet's content closure re-runs; the model must not).
struct RecipeImportHost: View {
    @State private var model: RecipeImportModel
    let onSaved: (Recipe) -> Void
    let profile: SensitivityProfile?
    init(mode: RecipeImportModel.Mode, food: FoodClient?, profile: SensitivityProfile?, onSaved: @escaping (Recipe) -> Void) {
        _model = State(initialValue: RecipeImportModel(
            mode: mode,
            reader: { source in
                guard let food else { throw FoodFetchError.unauthorized }
                return try await food.importRecipe(source)
            },
            saver: { recipe in
                guard let food else { throw FoodFetchError.unauthorized }
                return try await food.createRecipe(recipe)
            }))
        self.onSaved = onSaved
        self.profile = profile
    }
    var body: some View { RecipeImportSheet(model: model, profile: profile, onSaved: onSaved) }
}

// MARK: - The room

/// The Étel room (B4): the food world's drill-down with its own four tabs — Ma · Receptek · Kamra · Hét. The head is
/// the Fuel world's mood photo under the hue's sky, with the day's verdict; the last tab is kept across launches.
struct EtelRoom: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.foodClient) private var food
    @SceneStorage("etel.tab") private var selected: String = EtelTab.ma.rawValue
    @State private var store = EtelStore()
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    /// The meal composer, presented at page level (boop-ios.md §9).
    @State private var composer: MealStart?
    @State private var toast: String?
    /// The dimension whose sheet is open (page level, boop-ios.md §9).
    @State private var dimension: DimensionSelection?
    /// The Receptek tab's sheet: a recipe, an import, or the workshop (one at a time, page level).
    @State private var recipeSheet: RecipeSheet?
    /// The Kamra tab's sheet (a food, or an add route) and the Hét tab's opened day (page level, one at a time each).
    @State private var kamraSheet: KamraSheet?
    @State private var hetDay: HetDay?
    /// The Ma tab's settings, skip and supplement-list sheets (page level, one at a time).
    @State private var etelSheet: EtelSheet?

    init(tab: EtelTab = .ma) {
        #if DEBUG
        let preview = UserDefaults.standard.string(forKey: "etelTab").flatMap(EtelTab.init(rawValue:))
        _selected = SceneStorage(wrappedValue: (preview ?? tab).rawValue, "etel.tab")
        #else
        _selected = SceneStorage(wrappedValue: tab.rawValue, "etel.tab")
        #endif
    }

    private var tab: EtelTab { EtelTab(rawValue: selected) ?? .ma }

    var body: some View {
        let v = etelVerdict(day: store.day, plan: store.plan, problem: store.day == nil ? (store.dayProblem ?? (food == nil ? .unauthorized : nil)) : nil)
        NKDrillPage(hue: .fuel, crumb: "Ma · Étel", eyebrow: "Étkezés · ma", headline: v.headline, sentence: v.sentence,
                    level: v.level ?? 0, tabs: EtelTab.allCases.map(\.rawValue), selectedTab: $selected,
                    headPhoto: NKPhoto.konyha, onBack: { dismiss() }) {
            switch tab {
            case .ma:
                EtelMa(store: store, onDimension: { dimension = $0 }, onToast: { toast = $0 },
                       onRetry: { Task { await reload() } }, onTab: { selected = $0.rawValue },
                       onCapture: { composer = MealStart(entrance: $0) }, onCard: cardAction,
                       onSheet: { etelSheet = $0 })
            case .receptek:
                EtelReceptek(store: store, onImport: { recipeSheet = .importer($0) }, onWorkshop: { recipeSheet = .workshop },
                             onOpen: { recipeSheet = .detail($0.id) }, onRetry: { Task { await reload() } })
            case .kamra:
                EtelKamra(store: store, onAdd: { kamraSheet = .add($0) }, onOpen: { kamraSheet = .item($0) }, onRetry: { Task { await reload() } })
            case .het:
                EtelHet(store: store, onOpen: { hetDay = $0 }, onRetry: { Task { await reload() } })
            }
            Color.clear.frame(height: 20)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
        // Read the flag here so the page re-renders when it flips (boop-ios.md §9).
        .sheet(item: Binding(get: { [d = dimension] in d }, set: { dimension = $0 })) { d in
            DimensionSheet(selection: d)
        }
        .sheet(item: Binding(get: { [c = composer] in c }, set: { composer = $0 }), onDismiss: {
            // A swipe-dismissed composer leaves its parked draft as a card: show it.
            Task { await store.refreshPending(ritmus?.food) }
        }) { start in
            MealComposerSheet(start: start) { toast in
                composer = nil
                if let toast { self.toast = toast }
                Task { await reload() }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
        .sheet(item: Binding(get: { [r = recipeSheet] in r }, set: { recipeSheet = $0 })) { sheet in
            Group {
                switch sheet {
                case .detail(let id):
                    RecipeDetailSheet(recipeId: id, store: store, onToast: { toast = $0 }, onLogged: { Task { await reload() } })
                case .importer(let mode):
                    RecipeImportHost(mode: mode, food: food, profile: store.profile) { saved($0) }
                case .workshop:
                    RecipeWorkshopSheet(food: food, profile: store.profile) { saved($0) }
                }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
        .sheet(item: Binding(get: { [k = kamraSheet] in k }, set: { kamraSheet = $0 })) { sheet in
            Group {
                switch sheet {
                case .item(let row):
                    PantryItemDetailSheet(row: row, store: store, onEat: eat, onToast: { toast = $0 })
                case .add(let route):
                    PantryAddSheet(route: route, profile: store.profile) { added in
                        store.shelfAdded(added)
                        kamraSheet = nil
                        toast = "\(added.name) a kamrádban"
                    }
                }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
        .sheet(item: Binding(get: { [s = etelSheet] in s }, set: { etelSheet = $0 })) { sheet in
            Group {
                switch sheet {
                case .sensitivity:
                    SensitivitySheet(food: food) { profile, text in store.profileSaved(profile); toast = text }
                case .diet:
                    DietSettingsSheet(food: food) { text in toast = text; Task { await reload() } }
                case .rhythm:
                    RhythmSheet(food: food) { text in toast = text; Task { await reload() } }
                case .skip(let window):
                    SkipSheet(window: window, store: store, food: food) { text in toast = text; Task { await reload() } }
                case .kimelo:
                    SkipSheet(window: nil, store: store, food: food) { text in toast = text }
                case .supplements:
                    SupplementEditSheet(store: store)
                }
            }
            .etelSheetStyle()
        }
        .sheet(item: Binding(get: { [d = hetDay] in d }, set: { hetDay = $0 })) { day in
            HetDaySheet(day: day, store: store)
                .presentationDetents([.large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        .task { await reload() }
        #if DEBUG
        // Review hooks (`-etelSheet detail|import|text|workshop`): open the Receptek sheets without tapping.
        .task {
            guard let which = UserDefaults.standard.string(forKey: "etelSheet") else { return }
            try? await Task.sleep(for: .milliseconds(1200))
            switch which {
            case "detail": recipeSheet = .detail(UUID(uuidString: "7d2a0c74-3e5f-4a2a-9c74-9f1f6e3c2d03")!)
            case "detail2": recipeSheet = .detail(UUID(uuidString: "2f5c8b96-6b21-4d5c-9b96-c2b39b6f5a06")!)
            case "import": recipeSheet = .importer(.link)
            case "text": recipeSheet = .importer(.text)
            case "workshop": recipeSheet = .workshop
            case "kamra-item": if let food { await store.loadShelf(food: food); if let r = store.shelf.first { kamraSheet = .item(r) } }
            case "kamra-catalog": if let food, let r = (try? await food.pantry(query: "zab"))?.first(where: { !$0.onShelf }) { kamraSheet = .item(r) }
            case "add-link": kamraSheet = .add(.link)
            case "add-label": kamraSheet = .add(.label)
            case "add-manual": kamraSheet = .add(.manual)
            case "add-barcode": kamraSheet = .add(.barcode)
            case "usuals": composer = MealStart(entrance: .usual)
            case "sensitivity": etelSheet = .sensitivity
            case "diet": etelSheet = .diet
            case "rhythm": etelSheet = .rhythm
            case "kimelo": etelSheet = .kimelo
            case "supplements": etelSheet = .supplements
            case "skip": if let food, let plan = try? await food.plan(BoopClock.now()), let w = plan.windows.first(where: { $0.state == .now || $0.state == .pending }) { await store.load(food: food, now: BoopClock.now()); etelSheet = .skip(w) }
            case "het-day": if let food { await store.loadWeek(food: food, now: BoopClock.now()); if let w = store.week {
                hetDay = hetWeek(w, scores: store.weekScores, today: store.ymd).days.dropLast().last } }
            default: break
            }
        }
        #endif
        .task(id: tab) {
            guard let food else { return }
            switch tab {
            case .receptek: if !store.recipesLoaded { await store.loadRecipes(food: food) }
            case .kamra: if !store.shelfLoaded { await store.loadShelf(food: food) }
            case .het: if !store.weekLoaded { await store.loadWeek(food: food, now: BoopClock.now()) }
            case .ma: break
            }
        }
        .task(id: ritmus?.mealDraftsTick) { await store.refreshPending(ritmus?.food) }
        .refreshable { await reload() }
    }

    private func reload() async {
        guard let food else { return }
        // Pull to refresh is also "the net is here": what waited on the phone goes out now.
        await ritmus?.food.flush()
        await store.refreshPending(ritmus?.food)
        await store.load(food: food, now: BoopClock.now())
        if store.recipesLoaded || tab == .receptek { await store.loadRecipes(food: food) }
        if store.shelfLoaded || tab == .kamra { await store.loadShelf(food: food) }
        if store.weekLoaded || tab == .het { await store.loadWeek(food: food, now: BoopClock.now()) }
    }

    /// "Megeszem belőle" from a food's page: the sheet closes, then the serving confirmation opens (two sheets never
    /// swap in one tick).
    private func eat(_ facts: LookupItem) {
        kamraSheet = nil
        Task {
            try? await Task.sleep(for: .milliseconds(450))
            composer = MealStart(entrance: .serving, serving: facts)
        }
    }

    /// A recipe the owner just saved: into the library, the sheet closes, the toast says so.
    private func saved(_ recipe: Recipe) {
        store.recipeSaved(recipe)
        recipeSheet = nil
        toast = "\(recipe.name) elmentve"
        Task { if let food { await store.loadRecipes(food: food) } }
    }

    private func cardAction(_ action: PendingCardAction, _ card: PendingDraft) {
        guard let box = ritmus?.food else { return }
        switch action {
        case .save: Task { toast = await store.saveCard(card, box: box) }
        case .retryPhoto:
            guard let food else { return }
            Task {
                let ok = await box.retryPhoto(card.id, attacher: food)
                toast = ok ? "A fotó felment" : "A fotót most nem tudom feltölteni"
                await store.refreshPending(box)
            }
        case .edit: composer = MealStart(entrance: .pick, card: card)
        case .retry: Task { await box.retry(card.id); await box.flush(); await store.refreshPending(box) }
        case .discard: Task { await box.discard(card.id); await store.refreshPending(box) }
        }
    }
}
