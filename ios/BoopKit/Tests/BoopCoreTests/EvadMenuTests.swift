import Foundation
import Testing
@testable import BoopCore

/// Invented menu and list payloads ("például") — never the owner's figures.
enum EvadMenuFixtures {
    static func meal(_ id: String, _ slot: String, _ label: String, _ name: String, _ kcal: Int, recipe: String? = "r-\(UUID().uuidString.prefix(4))") -> String {
        let r = recipe.map { #""\#($0)""# } ?? "null"
        return #"{"id":"\#(id)","slot":"\#(slot)","label":"\#(label)","recipeId":\#(r),"name":"\#(name)","servings":1.25,"kcal":\#(kcal),"proteinG":30,"preSession":false,"locked":false,"changed":false}"#
    }

    static func weekJSON(status: String = "proposed", weekStart: String = "2026-11-23", repeated: Bool = false) -> String {
        let days = status == "proposed" || status == "approved" ? #"""
        [{"date":"\#(weekStart)","kind":"edzesnap","sportName":null,"kcal":2440,"meals":[\#(meal("m1", "breakfast", "Reggeli", "Zabkása áfonyával", 600)),\#(meal("m2", "dinner", "Vacsora", "Lazac édesburgonyával", 780))]},
         {"date":"2026-11-24","kind":"edzes_sport","sportName":"volleyball","kcal":2440,"meals":[]}]
        """# : "[]"
        return #"{"id":"w1","weekStart":"\#(weekStart)","status":"\#(status)","repeated":\#(repeated),"allowedCount":24,"recipeCount":53,"days":\#(days),"brandNew":1}"#
    }

    static func week(_ status: String = "proposed") -> EvadMenuWeek {
        try! JSONDecoder().decode(EvadMenuWeek.self, from: Data(weekJSON(status: status).utf8))
    }

    static let listJSON = #"""
    {"id":"l1","weekStart":"2026-11-23","itemCount":5,"checkedCount":1,"changedCount":2,
     "items":[
      {"id":"i1","name":"Brokkoli","amountText":"600 g","shelf":"zoldseg","forRecipes":["Csirkés rizstál ×2"],"checked":true,"changed":false,"removed":false,"staple":false},
      {"id":"i2","name":"Csirkemell","amountText":"1,4 kg","shelf":"hus","forRecipes":["Rizstál","Wok"],"checked":false,"changed":true,"removed":false,"staple":false},
      {"id":"i3","name":"Laktózmentes joghurt","amountText":"1,6 kg","shelf":"tej","forRecipes":["Zabkása ×4"],"checked":false,"changed":false,"removed":false,"staple":false},
      {"id":"i4","name":"Lencse","amountText":null,"shelf":"kamra","forRecipes":[],"checked":false,"changed":true,"removed":true,"staple":false},
      {"id":"i5","name":"Kávé","amountText":null,"shelf":"egyeb","forRecipes":[],"checked":false,"changed":false,"removed":false,"staple":true}],
     "staples":[{"name":"Kávé","onList":true},{"name":"Olívaolaj","onList":false}]}
    """#

    static var list: EvadShoppingList { try! JSONDecoder().decode(EvadShoppingList.self, from: Data(listJSON.utf8)) }
}

@Suite("Évad — menu and list")
struct EvadMenuTests {
    private static var cal: Calendar {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }

    private static func at(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 9) -> Date {
        cal.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
    }

    private static func overview(menu: String) -> EvadOverview {
        let json = EvadFixtures.overviewJSON().replacingOccurrences(of: #""upcoming":["#, with: #""menu":\#(menu),"upcoming":["#)
        return try! JSONDecoder().decode(EvadOverview.self, from: Data(json.utf8))
    }

    // MARK: - dates and words

    @Test func mondaysAndRanges() {
        #expect(evadMonday(Self.at(2026, 11, 22), calendar: Self.cal) == "2026-11-16", "a Sunday belongs to the week before")
        #expect(evadMonday(Self.at(2026, 11, 23), calendar: Self.cal) == "2026-11-23")
        #expect(evadWeekRange("2026-11-23") == "nov. 23–29.")
        #expect(evadWeekRange("2026-11-30") == "nov. 30. – dec. 6.")
        #expect(evadDayName("2026-11-24") == "Kedd")
    }

    @Test func dayKindLines() {
        let w = EvadMenuFixtures.week()
        #expect(evadDayKindText(w.days[0]) == "edzésnap")
        #expect(evadDayKindText(w.days[1]) == "edzés + röplabda")
        #expect(evadServingsText(1.25) == "1,25 adag" && evadServingsText(1) == "1 adag" && evadServingsText(1.5) == "1,5 adag")
    }

    // MARK: - the client

    @Test func menuCallsUseTheContractPaths() async throws {
        let stub = StubTransport()
        stub.on("getMenuWeek", .json(200, EvadMenuFixtures.weekJSON(status: "seeding")))
        stub.on("generateMenuWeek", .json(200, EvadMenuFixtures.weekJSON()))
        stub.on("approveMenuWeek", .json(200, EvadMenuFixtures.weekJSON(status: "approved")))
        stub.on("swapMenuMeal", .json(200, EvadMenuFixtures.weekJSON()))
        stub.on("generateMenuWeek", .json(409, #"{"messages":[{"code":"MENU_NOT_PROPOSED"}]}"#))
        let client = EvadClient(raw: EvadClientTests.raw(stub))
        let seeding = try await client.menu(weekStart: "2026-11-23")
        #expect(seeding.status == "seeding" && seeding.days.isEmpty && !seeding.hasMeals)
        let w = try await client.generateMenu(weekStart: "2026-11-23")
        #expect(w.days.count == 2 && w.days[0].meals[0].name == "Zabkása áfonyával" && w.hasMeals)
        _ = try await client.approveMenu(id: "w1")
        _ = try await client.swap(mealId: "m1", recipeId: "r9")
        await #expect(throws: PlanFetchError.conflict("MENU_NOT_PROPOSED")) {
            _ = try await client.generateMenu(weekStart: "2026-11-23")
        }
        #expect(stub.sent.map(\.path) == ["/api/seasons/menu?weekStart=2026-11-23", "/api/seasons/menu/generate",
                                          "/api/seasons/menu/w1/approve", "/api/seasons/menu/meals/m1",
                                          "/api/seasons/menu/generate"])
        #expect(stub.sent[1].body?.contains(#""weekStart":"2026-11-23""#) == true)
        #expect(stub.sent[3].body?.contains(#""recipeId":"r9""#) == true)
        #expect(evadErrorText(.conflict("MENU_NOT_PROPOSED")).contains("jóváhagytad"))
    }

    @Test func overviewCarriesTheMenuStatus() {
        let o = Self.overview(menu: #"{"weekStart":"2026-11-23","weekId":"w1","status":"proposed","menuDay":6,"menuTime":"18:00"}"#)
        #expect(o.menu?.status == "proposed" && o.menu?.menuDay == 6)
        #expect(EvadFixtures.overview().menu == nil, "an older server without the field still decodes")
    }

    // MARK: - the wall

    @Test func menuWaitingIsExpiresOnMenuDay() throws {
        let o = Self.overview(menu: #"{"weekStart":"2026-11-23","weekId":"w1","status":"proposed","menuDay":6,"menuTime":"18:00"}"#)
        // Sunday evening: the card is up, may ring (it is .expires), and expires when the week starts
        let sunday = Self.at(2026, 11, 22, 18)
        let c = try #require(evadMenuCandidate(o, now: sunday, calendar: Self.cal))
        #expect(c.role == .expires && c.area == WallSources.evad && c.primary == "Átnézem")
        #expect(c.expiresAt == Self.cal.date(from: DateComponents(year: 2026, month: 11, day: 23)))
        #expect(evadCandidates(o, now: sunday, calendar: Self.cal).contains { $0.id == c.id })
        #expect(evadWallOpens(c.id) == "menu")
        // Saturday (before the menu day) — not yet; Monday (the week has started) — gone
        #expect(evadMenuCandidate(o, now: Self.at(2026, 11, 21, 20), calendar: Self.cal) == nil)
        #expect(evadMenuCandidate(o, now: Self.at(2026, 11, 23, 8), calendar: Self.cal) == nil)
    }

    @Test func noMenuCardWhenApprovedOrNothingToApprove() {
        let sunday = Self.at(2026, 11, 22, 19)
        for status in ["approved", "none", "seeding"] {
            let o = Self.overview(menu: #"{"weekStart":"2026-11-23","status":"\#(status)","menuDay":6,"menuTime":"18:00"}"#)
            #expect(evadMenuCandidate(o, now: sunday, calendar: Self.cal) == nil, "\(status)")
        }
        let off = Self.overview(menu: #"{"weekStart":"2026-11-23","status":"proposed","menuDay":null,"menuTime":"18:00"}"#)
        #expect(evadMenuCandidate(off, now: sunday, calendar: Self.cal) == nil)
    }

    // MARK: - the list

    @Test func shareTextGroupsByShelf() {
        let text = evadShareText(EvadMenuFixtures.list)
        #expect(text == """
        Bevásárlólista · nov. 23–29.

        Hús, hal:
        - Csirkemell · 1,4 kg

        Tejtermék:
        - Laktózmentes joghurt · 1,6 kg

        Egyéb:
        - Kávé
        """, "ticked lines and lines no longer needed stay out; a staple has no amount")
    }

    @Test func shelfGroupsAndChangedLines() {
        let l = EvadMenuFixtures.list
        #expect(evadShelfGroups(l).map(\.title) == ["Zöldség, gyümölcs", "Hús, hal", "Tejtermék", "Egyéb"])
        #expect(evadChangedItems(l).map(\.name) == ["Csirkemell", "Lencse"])
    }

    // MARK: - the store

    @Test @MainActor func storeShowsNextWeekWhenItHasAMenuElseThisWeek() async {
        let clock: @MainActor () -> Date = { Self.at(2026, 11, 18) } // a Wednesday: this week 11-16, next 11-23
        let stub = StubTransport()
        stub.on("getMenuWeek", .json(200, EvadMenuFixtures.weekJSON(status: "none", weekStart: "2026-11-23")))
        stub.on("getMenuWeek", .json(200, EvadMenuFixtures.weekJSON(status: "approved", weekStart: "2026-11-16")))
        let store = EvadMenuStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil, clock: clock,
                                        calendar: Self.cal)
        await store.loadMenu()
        #expect(store.week?.weekStart == "2026-11-16" && store.week?.status == "approved")
        #expect(store.showsNextWeek == false)
        #expect(stub.sent.map(\.path) == ["/api/seasons/menu?weekStart=2026-11-23", "/api/seasons/menu?weekStart=2026-11-16"])
    }

    @Test @MainActor func checkOffIsOptimisticAndPutBackAfterTwoFailures() async {
        let stub = StubTransport()
        stub.on("getShoppingList", .json(200, EvadMenuFixtures.listJSON))
        stub.on("checkShoppingItem", .fail(URLError(.notConnectedToInternet)))
        stub.on("checkShoppingItem", .fail(URLError(.notConnectedToInternet)))
        stub.on("checkShoppingItem", .json(500, "{}"))
        stub.on("checkShoppingItem", .json(200, #"{"id":"i2","name":"Csirkemell","shelf":"hus","forRecipes":[],"checked":true,"changed":true,"staple":false}"#))
        let store = EvadMenuStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil,
                                        clock: { Self.at(2026, 11, 18) }, calendar: Self.cal)
        await store.loadList()
        let item = store.list!.items[1]
        await store.toggle(item)
        #expect(store.list?.items[1].checked == false, "two failed sends put the tick back")
        #expect(store.actionProblem?.contains("nincs net") == true)
        await store.toggle(item)
        #expect(store.list?.items[1].checked == true, "a failure then a success keeps the tick")
        #expect(store.actionProblem == nil)
    }

    @Test @MainActor func noApprovedWeekMeansNoList() async {
        let stub = StubTransport()
        stub.on("getShoppingList", .json(404, #"{"messages":[{"code":"RESOURCE_NOT_FOUND"}]}"#))
        stub.on("getShoppingList", .json(404, #"{"messages":[{"code":"RESOURCE_NOT_FOUND"}]}"#))
        let store = EvadMenuStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil,
                                        clock: { Self.at(2026, 11, 18) }, calendar: Self.cal)
        await store.loadList()
        #expect(store.listMissing && store.list == nil && store.listProblem == nil)
        #expect(stub.sent.map(\.path) == ["/api/seasons/shopping?weekStart=2026-11-23", "/api/seasons/shopping?weekStart=2026-11-16"])
    }

    @Test func pastDaysAreRecognised() {
        let wed = Self.at(2026, 11, 18)
        #expect(evadIsPast("2026-11-17", now: wed, calendar: Self.cal))
        #expect(!evadIsPast("2026-11-18", now: wed, calendar: Self.cal))
        #expect(!evadIsPast("2026-11-24", now: wed, calendar: Self.cal))
    }

    @Test @MainActor func anOfflineListDoesNotMarkTheMenuOffline() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let cache = ServerCache(directory: dir)
        let online = StubTransport()
        online.on("getShoppingList", .json(200, EvadMenuFixtures.listJSON))
        let first = EvadMenuStore(client: EvadClient(raw: EvadClientTests.raw(online)), cache: cache,
                                  clock: { Self.at(2026, 11, 18) }, calendar: Self.cal)
        await first.loadList()
        let offline = StubTransport()
        offline.on("getShoppingList", .fail(URLError(.notConnectedToInternet)))
        offline.on("getMenuWeek", .json(200, EvadMenuFixtures.weekJSON(status: "proposed", weekStart: "2026-11-23")))
        let later = EvadMenuStore(client: EvadClient(raw: EvadClientTests.raw(offline)), cache: cache,
                                  clock: { Self.at(2026, 11, 18) }, calendar: Self.cal)
        await later.loadList()
        await later.loadMenu()
        #expect(later.listOffline && later.list != nil)
        #expect(!later.menuOffline && later.menuAgeText == nil)
    }
    // MARK: - „Menübe jöhet" (mezo-r36n9.196)

    private static func optionsJSON(allowed: [String]) -> String {
        let rows = ["a", "b", "c", "d"].map { id in
            #"{"id":"\#(id)","name":"Recept \#(id)","category":"dinner","kcal":500,"allowed":\#(allowed.contains(id)),"usable":true,"reason":null}"#
        } + [#"{"id":"x","name":"Mogyorós","category":"dinner","kcal":500,"allowed":false,"usable":false,"reason":"mogyoró van benne"}"#]
        return "[" + rows.joined(separator: ",") + "]"
    }

    @MainActor private static func toggleStore(_ stub: StubTransport) async -> EvadMenuStore {
        stub.on("listSeasonRecipes", .json(200, optionsJSON(allowed: ["a", "b"])))
        let store = EvadMenuStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil,
                                  clock: { Self.at(2026, 11, 18) }, calendar: Self.cal)
        await store.loadRecipeOptions()
        return store
    }

    private static func putBodies(_ stub: StubTransport) -> [String] {
        stub.sent.filter { $0.op == "putSeasonRecipes" }.compactMap(\.body).map { $0.replacingOccurrences(of: " ", with: "") }
    }

    @Test @MainActor func toggleSendsTheWholeSetWithOneChanged() async {
        let stub = StubTransport()
        let store = await Self.toggleStore(stub)
        #expect(store.allowedIds == ["a", "b"])
        stub.on("putSeasonRecipes", .json(200, EvadFixtures.seasonJSON))
        stub.on("listSeasonRecipes", .json(200, Self.optionsJSON(allowed: ["a", "b", "c"])))
        await store.setAllowed("c", on: true, seasonId: "s1")
        #expect(Self.putBodies(stub) == [#"{"recipeIds":["a","b","c"]}"#])
        #expect(stub.sent.last { $0.op == "putSeasonRecipes" }?.path == "/api/seasons/s1/recipes")
        #expect(store.allowedIds == ["a", "b", "c"] && store.actionProblem == nil)
    }

    @Test @MainActor func twoTogglesKeepBoth() async {
        let stub = StubTransport()
        let store = await Self.toggleStore(stub)
        stub.on("putSeasonRecipes", .slowJson(200, EvadFixtures.seasonJSON, ms: 150))
        stub.on("putSeasonRecipes", .json(200, EvadFixtures.seasonJSON))
        stub.on("listSeasonRecipes", .json(200, Self.optionsJSON(allowed: ["a", "b", "c", "d"])))
        let first = Task { await store.setAllowed("c", on: true, seasonId: "s1") }
        try? await Task.sleep(for: .milliseconds(30))
        let second = Task { await store.setAllowed("d", on: true, seasonId: "s1") }
        await first.value; await second.value
        let bodies = Self.putBodies(stub)
        #expect(bodies.last == #"{"recipeIds":["a","b","c","d"]}"#, "the second write carries the first")
        #expect(store.allowedIds == ["a", "b", "c", "d"])
    }

    @Test @MainActor func offlineToggleChangesNothing() async {
        let stub = StubTransport()
        let store = await Self.toggleStore(stub)
        stub.on("putSeasonRecipes", .fail(URLError(.notConnectedToInternet)))
        await store.setAllowed("c", on: true, seasonId: "s1")
        #expect(store.allowedIds == ["a", "b"])
        #expect(store.actionProblem == "Ehhez internet kell.")
    }

    @Test @MainActor func blockedRecipeIsRefused() async {
        let stub = StubTransport()
        let store = await Self.toggleStore(stub)
        await store.setAllowed("x", on: true, seasonId: "s1")
        #expect(Self.putBodies(stub).isEmpty && store.allowedIds == ["a", "b"])
    }
}
