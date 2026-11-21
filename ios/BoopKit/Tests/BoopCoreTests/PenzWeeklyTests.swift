import Foundation
import Testing
@testable import BoopCore

/// Invented, real-looking content, never the owner's.
enum PenzWeeklyFixtures {
    /// Out of order on purpose (long, short, mid), one section missing optional fields, an unsafe url, a future field.
    static let readyJSON = #"""
    {"weekStart":"2026-11-09","weekEnd":"2026-11-15","status":"ready","generatedAt":"2026-11-16T06:31:00+01:00",
     "somethingNew":1,
     "sections":[
      {"sleeve":"long","horizonLabel":"10+ év","storyCount":3,"sourceCount":5,"matters":true,
       "verdict":"Egy szabályozási döntés tartósan számít a 10+ éves képben.","body":"A *te* alapod.\n\nMásodik bekezdés.",
       "uncertainty":"A hatás mértéke vitatott.","noAction":"Ez a pénz 10+ évre szól.","narratedBy":"model","coverageMonths":55,
       "stories":[{"id":"s1","title":"Új szabály","holdingName":"Világ-ETF","kind":"holding",
                   "sources":[{"name":"Portfolio","url":"https://www.portfolio.hu/a"},{"name":"Rossz","url":"javascript:alert(1)"}],
                   "publishedAt":"2026-11-12T09:30:00+01:00"},
                  {"id":"s2","title":"Forint","kind":"fx","sources":[]}]},
      {"sleeve":"short","horizonLabel":"1–3 év","storyCount":0,"sourceCount":0,"matters":false,
       "verdict":"Ezen a héten egy hír sem érintette.","body":"","uncertainty":"Nincs mit mérlegelni.",
       "noAction":"A rövid pénz fut tovább.","narratedBy":"quiet","stories":[]},
      {"sleeve":"mid","verdict":"Ezt a hetet nem tudtam megbízhatóan összefoglalni.","narratedBy":"fallback"}]}
    """#

    static let pendingJSON = #"{"weekStart":"2026-11-09","weekEnd":"2026-11-15","status":"pending","generatedAt":null,"sections":[]}"#
    static let quietJSON = #"{"weekStart":"2026-11-09","weekEnd":"2026-11-15","status":"quiet","sections":[]}"#
    static let failedEmptyJSON = #"{"weekStart":"2026-11-09","weekEnd":"2026-11-15","status":"failed","sections":[]}"#
}

@Suite("Pénz — the weekly long-horizon review")
@MainActor
struct PenzWeeklyTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }

    // MARK: - The client

    @Test func decodesLenientlyIncludingMissingOptionalFields() async throws {
        let stub = StubTransport()
        stub.on("getPenzWeeklyReview", .json(200, PenzWeeklyFixtures.readyJSON))
        stub.on("getPenzWeeklyReview", .json(200, #"{}"#))
        let c = PenzClient(raw: Self.raw(stub))
        let r = try await c.weeklyReview()
        #expect(r.status == "ready" && r.weekStart == "2026-11-09" && r.sections.count == 3)
        let mid = try #require(r.sections.first { $0.sleeve == "mid" })
        #expect(mid.horizonLabel.isEmpty && mid.storyCount == 0 && !mid.matters && mid.coverageMonths == nil && mid.stories.isEmpty)
        #expect(r.sections[0].stories[1].holdingName == nil && r.sections[0].stories[1].publishedAt == nil)
        #expect(stub.sent[0].path == "/api/penz/weekly-review" && stub.sent[0].auth == "Bearer tok")
        let empty = try await c.weeklyReview(week: "2026-11-09")
        #expect(empty.status == "pending" && empty.sections.isEmpty)
        #expect(stub.sent[1].path == "/api/penz/weekly-review?week=2026-11-09")
    }

    // MARK: - The view

    @Test func sectionsComeShortMidLongWithTheQuietWord() throws {
        let r = try JSONDecoder().decode(PenzWeeklyReview.self, from: Data(PenzWeeklyFixtures.readyJSON.utf8))
        guard case .rows(let week, let rows) = penzWeeklyView(r) else { Issue.record("expected rows"); return }
        #expect(week == "nov. 9–15.")
        #expect(rows.map(\.sleeve) == ["short", "mid", "long"])
        #expect(rows.map(\.title) == ["1–3 év", "5–10 év", "10+ év"], "a missing label falls back to the sleeve's")
        #expect(rows.map(\.quietWord) == ["nincs teendő", "nincs teendő", "számít"])
        #expect(rows[0].verdict == "Ezen a héten egy hír sem érintette." && rows[0].counts == penzWeeklyNoStoriesText)
        // fallback copy is shown as it came; its empty body falls back to the verdict, its noAction to ours
        #expect(rows[1].narratedBy == "fallback" && rows[1].body == rows[1].verdict && rows[1].noAction == penzWeeklyNoActionText)
        let long = rows[2]
        #expect(long.counts == "3 hír · 5 forrás a héten" && long.coverage == penzCoverageSentence(55))
        #expect(rows[0].coverage == nil)
        #expect(long.stories[0].holding == "Világ-ETF" && long.stories[1].holding == "Deviza")
        #expect(long.stories[0].sources.map(\.text) == ["Portfolio", "Rossz"])
        #expect(long.stories[0].sources[0].url != nil && long.stories[0].sources[1].url == nil, "only http(s) opens")
    }

    @Test func pendingQuietFailedAndNeverLoaded() throws {
        func view(_ json: String) throws -> PenzWeeklyView {
            penzWeeklyView(try JSONDecoder().decode(PenzWeeklyReview.self, from: Data(json.utf8)))
        }
        #expect(try view(PenzWeeklyFixtures.pendingJSON) == .pending(week: "nov. 9–15."))
        #expect(try view(PenzWeeklyFixtures.quietJSON) == .line(week: "nov. 9–15.", text: penzWeeklyQuietText))
        #expect(try view(PenzWeeklyFixtures.failedEmptyJSON) == .line(week: "nov. 9–15.", text: penzWeeklyFailedText))
        // failed *with* sections: they are honest fallback copy, so they show
        let failed = PenzWeeklyReview(weekStart: "2026-11-09", weekEnd: "2026-11-15", status: "failed", sections: [
            PenzWeeklySection(sleeve: "long", horizonLabel: "10+ év", verdict: "Nem tudtam összefoglalni.", narratedBy: "fallback")])
        guard case .rows(_, let rows) = penzWeeklyView(failed) else { Issue.record("expected rows"); return }
        #expect(rows.count == 1 && !rows[0].matters)
        #expect(penzWeeklyView(nil) == .hidden)
    }

    @Test func theWeekRangeReadsLikeOtherPenzDates() {
        #expect(penzWeekRange("2026-11-10", "2026-11-16") == "nov. 10–16.")
        #expect(penzWeekRange("2026-10-27", "2026-11-02") == "okt. 27. – nov. 2.")
        #expect(penzWeekRange("2026-12-28", "2027-01-03") == "dec. 28. – jan. 3.")
        #expect(penzWeekRange("", "") == "")
    }

    // MARK: - The store

    private func scriptRest(_ stub: StubTransport) {
        stub.on("getPenzAllowance", .json(200, PenzClientTests.allowanceJSON))
        for op in ["listPenzTransactions", "listPenzCategories", "listPenzAccounts", "listOpenPenzMonths", "listPenzSavingsGoals"] {
            stub.on(op, .json(200, "[]"))
        }
        stub.on("getPenzSettings", .json(200, #"{"savingsTargetHufMinor":0,"practiceMonthlyHufMinor":0}"#))
        stub.on("getPenzPortfolio", .json(200, PenzL6Fixtures.portfolioJSON))
        stub.on("getPenzDigest", .json(200, PenzL6Fixtures.digestJSON))
    }

    @Test func theStoreReadsItWithPenzemCachesItAndAFailureKeepsTheLastOne() async {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("penz-weekly-\(UUID().uuidString)")
        let clock = TestClock(Date(timeIntervalSince1970: 1_795_168_800))   // 2026-11-20
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let stub = StubTransport()
        scriptRest(stub)
        stub.on("getPenzWeeklyReview", .json(200, PenzWeeklyFixtures.readyJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: cache, clock: { clock.now })
        await store.load()
        #expect(store.weekly?.value.status == "ready" && store.weeklyProblem == nil && !store.weeklyOffline)

        // a server fault keeps what is on screen, and Pénzem stands
        stub.on("getPenzWeeklyReview", .status(500))
        await store.reloadWeekly()
        #expect(store.weekly?.value.sections.count == 3 && store.weeklyProblem == .server && store.portfolio != nil)

        // offline, a fresh store shows the cached one
        let off = StubTransport()
        for op in ["getPenzAllowance", "listPenzTransactions", "listPenzCategories", "listPenzAccounts", "listOpenPenzMonths",
                   "listPenzSavingsGoals", "getPenzSettings", "getPenzPortfolio", "getPenzDigest", "getPenzWeeklyReview"] {
            off.on(op, .fail(URLError(.notConnectedToInternet)))
        }
        let later = PenzStore(client: PenzClient(raw: Self.raw(off)), cache: cache, clock: { clock.now })
        await later.load()
        #expect(later.weeklyOffline && later.weekly?.value.status == "ready")
    }

    @Test func aFailingWeeklyReadNeverBreaksPenzemAndIsHidden() async {
        let stub = StubTransport()
        scriptRest(stub)
        stub.on("getPenzWeeklyReview", .status(500))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        await store.load()
        #expect(store.allowance != nil && store.portfolio != nil && store.digest != nil)
        #expect(store.weekly == nil && store.weeklyProblem == .server)
        #expect(penzWeeklyView(store.weekly?.value) == .hidden)
    }
}
