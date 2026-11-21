import Foundation
import Observation

/// The Menü and Lista tabs' data (Boop B6 Évad S3, `mezo-r36n9.16`), owned by `EvadStore`.
///
/// **Which week.** Next week's menu when it has meals (a proposal to approve, or an approved week); otherwise this
/// week's when it has meals; otherwise next week's (empty — „Összeállítom most", or the seeding prompt). The list is the
/// newest approved week's: next week's, else this week's.
///
/// **Offline is an answer** (the Évad rule): the last menu and list are cached per user with their age; every change
/// says it needs the net. Ticking a line off is optimistic and outbox-free: it shows at once, is sent once more on a
/// failure, and is put back (with a line saying so) when that fails too.
@MainActor @Observable
public final class EvadMenuStore {
    public private(set) var week: EvadMenuWeek?
    public private(set) var list: EvadShoppingList?
    /// No approved week yet, so no list (the Lista tab says how one is made).
    public private(set) var listMissing = false
    /// The menu on screen came from the cache (and how old it is).
    public private(set) var menuOffline = false
    public private(set) var menuAge: TimeInterval?
    /// The list on screen came from the cache (and how old it is).
    public private(set) var listOffline = false
    public private(set) var listAge: TimeInterval?
    /// Lines whose tick is on its way to the server: another tap waits until it settles.
    public private(set) var inFlight: Set<String> = []
    public private(set) var menuProblem: PlanFetchError?
    public private(set) var listProblem: PlanFetchError?
    public private(set) var busy = false
    /// A change that did not go through, in his words (shown under the block).
    public var actionProblem: String?

    static let menuEndpoint = "evad/menu"
    static let listEndpoint = "evad/list"
    static let key = "-"
    public static let maxAge: TimeInterval = 14 * 86_400

    @ObservationIgnored let client: EvadClient?
    @ObservationIgnored let cache: ServerCache?
    @ObservationIgnored let clock: @MainActor () -> Date
    @ObservationIgnored let calendar: Calendar
    /// Called after a menu change, so the overview (the tab's dot, the wall's card) follows.
    @ObservationIgnored public var onMenuChanged: (@MainActor () async -> Void)?

    public init(client: EvadClient?, cache: ServerCache?, clock: @escaping @MainActor () -> Date = { Date() },
                calendar: Calendar = .current) {
        self.client = client; self.cache = cache; self.clock = clock; self.calendar = calendar
    }

    public var thisMonday: String { evadMonday(clock(), calendar: calendar) }
    public var nextMonday: String { evadAddDays(thisMonday, 7) }
    /// The week on screen is next week's.
    public var showsNextWeek: Bool { week?.weekStart == nextMonday }
    public var menuAgeText: String? { menuOffline ? penzAgeText(menuAge) : nil }
    public var listAgeText: String? { listOffline ? penzAgeText(listAge) : nil }

    // MARK: - The menu

    public func loadMenu(force: Bool = false) async {
        guard let client else { menuProblem = .unauthorized; return }
        guard force || week == nil || menuOffline else { return }
        do throws(PlanFetchError) {
            let next = try await client.menu(weekStart: nextMonday)
            var shown = next
            if !next.hasMeals {
                let current = try await client.menu(weekStart: thisMonday)
                if current.hasMeals { shown = current }
            }
            week = shown; menuProblem = nil; menuOffline = false; menuAge = nil
            try? await cache?.put(shown, endpoint: Self.menuEndpoint, date: Self.key)
        } catch .offline {
            if let hit = await cache?.get(EvadMenuWeek.self, endpoint: Self.menuEndpoint, date: Self.key, maxAge: Self.maxAge) {
                week = hit.value; menuAge = hit.age; menuOffline = true; menuProblem = nil
            } else if week == nil {
                menuProblem = .offline
            }
        } catch {
            if week == nil { menuProblem = error }
        }
    }

    /// „Összeállítom most" / „Kérek másikat": a (new) proposal for the week on screen — or for next week when this
    /// week's is already approved.
    public func generate() async {
        guard let client else { return }
        let target = week.map { $0.status == "approved" && $0.weekStart == thisMonday ? nextMonday : $0.weekStart }
            ?? nextMonday
        await run { week = try await client.generateMenu(weekStart: target) }
        await onMenuChanged?()
    }

    public func approve() async {
        guard let client, let id = week?.id else { return }
        await run { week = try await client.approveMenu(id: id) }
        if week?.status == "approved" { await loadList(force: true) }
        await onMenuChanged?()
    }

    public func alternatives(for meal: EvadMenuMeal) async throws(PlanFetchError) -> [EvadMenuAlternative] {
        guard let client else { throw .unauthorized }
        return try await client.alternatives(mealId: meal.id)
    }

    public func swap(_ meal: EvadMenuMeal, to recipeId: String) async {
        guard let client else { return }
        await run { week = try await client.swap(mealId: meal.id, recipeId: recipeId) }
        if week?.status == "approved" { await loadList(force: true) }
    }

    // MARK: - Kiválasztott receptek

    public func recipes() async throws(PlanFetchError) -> [EvadRecipeOption] {
        guard let client else { throw .unauthorized }
        return try await client.recipes()
    }

    /// Saves the chosen recipes, then re-reads the menu (a seeding week may now be plannable).
    public func putRecipes(seasonId: String, _ ids: [String]) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        _ = try await client.putRecipes(id: seasonId, recipeIds: ids)
        await loadMenu(force: true)
    }

    // MARK: - The list

    public func loadList(force: Bool = false) async {
        guard let client else { listProblem = .unauthorized; return }
        guard force || list == nil || listOffline else { return }
        do throws(PlanFetchError) {
            let found: EvadShoppingList?
            do throws(PlanFetchError) {
                found = try await client.shoppingList(weekStart: nextMonday)
            } catch .notFound {
                do throws(PlanFetchError) {
                    found = try await client.shoppingList(weekStart: thisMonday)
                } catch .notFound {
                    found = nil
                }
            }
            list = found; listMissing = found == nil; listProblem = nil; listOffline = false; listAge = nil
            if let found { try? await cache?.put(found, endpoint: Self.listEndpoint, date: Self.key) }
        } catch .offline {
            if let hit = await cache?.get(EvadShoppingList.self, endpoint: Self.listEndpoint, date: Self.key, maxAge: Self.maxAge) {
                list = hit.value; listOffline = true; listAge = hit.age; listProblem = nil; listMissing = false
            } else if list == nil {
                listProblem = .offline
            }
        } catch {
            if list == nil { listProblem = error }
        }
    }

    /// Ticks a line off (or back on) at once; sent, then once more on a failure, else put back.
    public func toggle(_ item: EvadShoppingItem) async {
        guard let client, !inFlight.contains(item.id), var l = list,
              let i = l.items.firstIndex(where: { $0.id == item.id }) else { return }
        inFlight.insert(item.id)
        defer { inFlight.remove(item.id) }
        let target = !l.items[i].checked
        l.items[i].checked = target
        list = l
        actionProblem = nil
        for attempt in 0..<2 {
            do throws(PlanFetchError) {
                _ = try await client.check(itemId: item.id, checked: target)
                if let cur = list { try? await cache?.put(cur, endpoint: Self.listEndpoint, date: Self.key) }
                return
            } catch {
                if attempt == 1 {
                    if var back = list, let j = back.items.firstIndex(where: { $0.id == item.id }) {
                        back.items[j].checked = !target
                        list = back
                    }
                    actionProblem = error == .offline ? "A pipa nem ment át, mert nincs net. Próbáld újra, ha lesz."
                        : "A pipát most nem tudtam elmenteni. Próbáld újra."
                }
            }
        }
    }

    /// One of his staples onto the list, or off it — only ever on his tap.
    public func toggleStaple(_ chip: EvadStapleChip) async {
        guard let client, let id = list?.id else { return }
        await run { list = try await client.toggleStaple(listId: id, name: chip.name, on: !chip.onList) }
    }

    public func pastLists() async throws(PlanFetchError) -> [EvadShoppingListSummary] {
        guard let client else { throw .unauthorized }
        return try await client.shoppingLists()
    }

    public func list(weekStart: String) async throws(PlanFetchError) -> EvadShoppingList {
        guard let client else { throw .unauthorized }
        return try await client.shoppingList(weekStart: weekStart)
    }

    public func staples() async throws(PlanFetchError) -> EvadStaples {
        guard let client else { throw .unauthorized }
        return try await client.staples()
    }

    public func putStaples(_ names: [String]) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        _ = try await client.putStaples(names)
        await loadList(force: true)
    }

    // MARK: -

    private func run(_ body: () async throws -> Void) async {
        guard !busy else { return }
        busy = true; actionProblem = nil
        defer { busy = false }
        do { try await body() } catch {
            actionProblem = evadErrorText((error as? PlanFetchError) ?? .server)
        }
    }
}
