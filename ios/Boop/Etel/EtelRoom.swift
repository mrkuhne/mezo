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
    private(set) var groups: [SupplementGroup] = []
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
            groups = supplementGroups(proto.items, names: Dictionary(stash.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a }))
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
            await box.discard(card.id)
            await refreshPending(box)
            await load(food: food, now: now)
            return "\(draftTitle(draft)) rögzítve · \(huInt(Int(meal.macros.kcal.rounded()))) kcal"
        } catch FoodFetchError.offline {
            return "Nincs net — a kártya megvár"
        } catch {
            return "Nem sikerült elmenteni — próbáld újra"
        }
    }

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
                       onCapture: { composer = MealStart(entrance: $0) }, onCard: cardAction)
            case .receptek, .kamra, .het:
                NKDrillSection(number: 1, label: tab.rawValue.uppercased()) {
                    Text("Ez a lap hamarosan itt lesz.").nkFont(15).foregroundStyle(.white.opacity(0.7))
                }
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
        .sheet(item: Binding(get: { [c = composer] in c }, set: { composer = $0 })) { start in
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
        .task { await reload() }
        .task(id: ritmus?.mealDraftsTick) { await store.refreshPending(ritmus?.food) }
        .refreshable { await reload() }
    }

    private func reload() async {
        guard let food else { return }
        // Pull to refresh is also "the net is here": what waited on the phone goes out now.
        await ritmus?.food.flush()
        await store.refreshPending(ritmus?.food)
        await store.load(food: food, now: BoopClock.now())
    }

    private func cardAction(_ action: PendingCardAction, _ card: PendingDraft) {
        guard let box = ritmus?.food else { return }
        switch action {
        case .save: Task { toast = await store.saveCard(card, box: box) }
        case .edit: composer = MealStart(entrance: .pick, card: card)
        case .retry: Task { await box.retry(card.id); await box.flush(); await store.refreshPending(box) }
        case .discard: Task { await box.discard(card.id); await store.refreshPending(box) }
        }
    }
}
