import Foundation
import Testing
@testable import BoopCore

@Suite("Levél — the client and the store")
@MainActor
struct LevelClientTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }
    static func client(_ stub: StubTransport) -> LevelClient { LevelClient(raw: raw(stub)) }
    static func tempDir() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("level-cache-\(UUID().uuidString)") }
    final class Clock: @unchecked Sendable { var now = LevelLogicTests.at(2026, 11, 21, 9) }

    static let mailboxJSON = #"{"address":"elek@pelda.hu","state":"connected","lastRunAt":"2026-11-21T06:00:00Z","lastFetched":34}"#

    // MARK: client

    @Test func readsAndWritesTheRightPathsWithTheToken() async throws {
        let stub = StubTransport()
        stub.on("getMailMailbox", .json(200, Self.mailboxJSON))
        stub.on("putMailMailbox", .json(200, Self.mailboxJSON))
        stub.on("deleteMailMailbox", .json(200, #"{"address":"elek@pelda.hu","state":"disconnected"}"#))
        stub.on("runMailMailbox", .status(202))
        stub.on("getMailDigest", .json(200, LevelLogicTests.sampleJSON))
        stub.on("postMailFeedback", .status(204))
        stub.on("getMailRules", .json(200, #"{"sensitive":[],"silent":[],"always":[],"proposals":[]}"#))
        stub.on("putMailRules", .json(200, #"{"sensitive":[],"silent":[{"pattern":"a@b.hu","origin":"owner"}],"always":[],"proposals":[]}"#))
        let c = Self.client(stub)
        #expect(try await c.mailbox().lastFetched == 34)
        _ = try await c.connect(address: "elek@pelda.hu", appPassword: "abcd efgh")
        #expect(try await c.disconnect().state == .disconnected)
        try await c.run()
        #expect(try await c.digest(day: "2026-11-21").arrived == 34)
        try await c.feedback(item: "p1", verdict: .nope)
        _ = try await c.rules()
        #expect(try await c.saveRules(LevelRulesRequest(silent: ["a@b.hu"])).silent.first?.pattern == "a@b.hu")
        #expect(stub.sent.map(\.path) == ["/api/mail/mailbox", "/api/mail/mailbox", "/api/mail/mailbox", "/api/mail/mailbox/run",
                                          "/api/mail/digest?date=2026-11-21", "/api/mail/items/p1/feedback", "/api/mail/rules", "/api/mail/rules"])
        #expect(stub.sent.allSatisfy { $0.auth == "Bearer tok" })
        #expect(stub.sent[1].body == #"{"address":"elek@pelda.hu","appPassword":"abcd efgh"}"#)
        #expect(stub.sent[5].body == #"{"verdict":"nope"}"#)
    }

    @Test func cooldownAndAuthFailureMapToTheirCodes() async {
        let stub = StubTransport()
        stub.on("runMailMailbox", .json(429, #"[{"code":"MAIL_RUN_COOLDOWN","message":"x"}]"#))
        stub.on("putMailMailbox", .json(422, #"[{"code":"MAIL_AUTH_FAILED","message":"x"}]"#))
        stub.on("runMailMailbox", .json(409, #"[{"code":"MAIL_NOT_CONNECTED","message":"x"}]"#))
        let c = Self.client(stub)
        do { try await c.run(); Issue.record("expected a throw") } catch { #expect(error == .conflict("MAIL_RUN_COOLDOWN")) }
        do { _ = try await c.connect(address: "a@b.hu", appPassword: "p"); Issue.record("expected a throw") } catch { #expect(error == .rejected("MAIL_AUTH_FAILED")) }
        do { try await c.run(); Issue.record("expected a throw") } catch { #expect(error == .conflict("MAIL_NOT_CONNECTED")) }
    }

    @Test func anUnknownEnumDoesNotFailTheDigestResponse() async throws {
        let stub = StubTransport()
        stub.on("getMailDigest", .json(200, #"{"arrived":3,"deals":[{"id":"x","group":"deal","title":"T","screen":"quantum"}]}"#))
        let d = try await Self.client(stub).digest()
        #expect(d.arrived == 3 && d.deals[0].screen == .unknown && stub.sent[0].path == "/api/mail/digest")
    }

    // MARK: store

    @Test func refreshLoadsAndCachesThenOfflineFallsBackStale() async throws {
        let dir = Self.tempDir(), clock = Clock()
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let online = StubTransport()
        online.on("getMailMailbox", .json(200, Self.mailboxJSON))
        online.on("getMailDigest", .json(200, LevelLogicTests.sampleJSON))
        let first = LevelStore(client: Self.client(online), cache: cache, clock: { clock.now })
        await first.refresh()
        #expect(first.digest?.worthAMinute == 2 && first.digestState == .loaded && !first.isStale && first.mailbox?.state == .connected)

        clock.now = clock.now.addingTimeInterval(4 * 3600)
        let offline = StubTransport()
        offline.on("getMailMailbox", .fail(URLError(.notConnectedToInternet)))
        offline.on("getMailDigest", .fail(URLError(.notConnectedToInternet)))
        let later = LevelStore(client: Self.client(offline), cache: cache, clock: { clock.now })
        await later.refresh()
        #expect(later.digest?.arrived == 34 && later.isStale && later.digestState == .loaded)
        #expect(later.digestAge.map { abs($0 - 4 * 3600) < 1 } == true && later.mailbox?.address == "elek@pelda.hu")
    }

    @Test func offlineWithoutCacheFails() async {
        let stub = StubTransport()
        stub.on("getMailMailbox", .fail(URLError(.notConnectedToInternet)))
        stub.on("getMailDigest", .fail(URLError(.notConnectedToInternet)))
        let s = LevelStore(client: Self.client(stub), cache: nil)
        await s.refresh()
        #expect(s.digest == nil && s.digestState == .failed(.offline) && !s.isStale)
    }

    @Test func aServerFaultIsNotDressedAsOldData() async {
        let dir = Self.tempDir()
        let cache = ServerCache(directory: dir)
        try? await cache.put(LevelDigest(arrived: 1), endpoint: "level/digest", date: levelDay(Date()))
        let stub = StubTransport()
        stub.on("getMailMailbox", .json(200, Self.mailboxJSON))
        stub.on("getMailDigest", .status(500))
        let s = LevelStore(client: Self.client(stub), cache: cache)
        await s.refresh()
        #expect(s.digestState == .failed(.server) && !s.isStale)
    }

    @Test func runNowMapsCooldown() async {
        let stub = StubTransport()
        stub.on("runMailMailbox", .json(429, #"[{"code":"MAIL_RUN_COOLDOWN"}]"#))
        stub.on("runMailMailbox", .status(202))
        stub.on("runMailMailbox", .json(409, #"[{"code":"MAIL_NOT_CONNECTED"}]"#))
        let s = LevelStore(client: Self.client(stub), cache: nil)
        #expect(await s.runNow() == .cooldown)
        #expect(await s.runNow() == .done)
        #expect(await s.runNow() == .failed(.conflict("MAIL_NOT_CONNECTED")))
    }

    @Test func feedbackIsOptimisticAndRevertsOnFailure() async {
        let stub = StubTransport()
        stub.on("postMailFeedback", .status(204))
        stub.on("postMailFeedback", .json(404, #"[{"code":"MAIL_ITEM_NOT_FOUND"}]"#))
        let s = LevelStore(client: Self.client(stub), cache: nil)
        #expect(await s.feedback(item: "a", verdict: .interest) == .done && s.verdicts["a"] == .interest)
        #expect(await s.feedback(item: "a", verdict: .nope) == .failed(.notFound))
        #expect(s.verdicts["a"] == .interest, "reverted to what it was")
    }

    @Test func connectNeverLeavesThePasswordAnywhere() async throws {
        let dir = Self.tempDir()
        let cache = ServerCache(directory: dir)
        let secret = "zq9x-very-secret-pw"
        let stub = StubTransport()
        stub.on("putMailMailbox", .json(200, Self.mailboxJSON))
        stub.on("getMailMailbox", .json(200, Self.mailboxJSON))
        stub.on("getMailDigest", .json(200, LevelLogicTests.sampleJSON))
        let s = LevelStore(client: Self.client(stub), cache: cache)
        #expect(await s.connect(address: "elek@pelda.hu", appPassword: secret) == .done)
        await s.refresh()
        let files = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        #expect(!files.isEmpty)
        for f in files { #expect(!String(decoding: try Data(contentsOf: f), as: UTF8.self).contains(secret)) }
        let mirror = String(describing: s.mailbox) + String(describing: s.digest)
        #expect(!mirror.contains(secret))
    }

    @Test func connectFailureSurfacesTheCodeAndStoresNothing() async {
        let stub = StubTransport()
        stub.on("putMailMailbox", .json(422, #"[{"code":"MAIL_AUTH_FAILED"}]"#))
        let s = LevelStore(client: Self.client(stub), cache: nil)
        #expect(await s.connect(address: "a@b.hu", appPassword: "p") == .failed(.rejected("MAIL_AUTH_FAILED")))
        #expect(s.mailbox == nil)
    }

    @Test func disconnectAndSaveRulesUpdateTheStore() async {
        let stub = StubTransport()
        stub.on("deleteMailMailbox", .json(200, #"{"address":"elek@pelda.hu","state":"disconnected"}"#))
        stub.on("putMailRules", .json(200, #"{"sensitive":[],"silent":[{"pattern":"a@b.hu","origin":"owner"}],"always":[],"proposals":[]}"#))
        let s = LevelStore(client: Self.client(stub), cache: nil)
        #expect(await s.disconnect() == .done && s.mailbox?.state == .disconnected)
        #expect(await s.saveRules(LevelRulesRequest(silent: ["a@b.hu"])) == .done && s.rules?.silent.count == 1)
    }

    @Test func offlineCachedMailboxIsMarkedStaleAndNewerMemoryIsKept() async throws {
        let dir = Self.tempDir(), clock = Clock()
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let online = StubTransport()
        online.on("getMailMailbox", .json(200, Self.mailboxJSON))
        online.on("getMailDigest", .json(200, LevelLogicTests.sampleJSON))
        await LevelStore(client: Self.client(online), cache: cache, clock: { clock.now }).refresh()

        let offline = StubTransport()
        offline.on("getMailMailbox", .fail(URLError(.notConnectedToInternet)))
        offline.on("getMailDigest", .fail(URLError(.notConnectedToInternet)))
        let s = LevelStore(client: Self.client(offline), cache: cache, clock: { clock.now })
        await s.refresh()
        #expect(s.mailbox?.address == "elek@pelda.hu" && s.mailboxIsStale)

        // a newer in-memory digest is never replaced by an older cached day
        let live = StubTransport()
        live.on("getMailMailbox", .json(200, Self.mailboxJSON))
        live.on("getMailDigest", .json(200, #"{"arrived":99}"#))
        let t = LevelStore(client: Self.client(live), cache: nil, clock: { clock.now })
        await t.refresh()
        #expect(t.digest?.arrived == 99 && !t.mailboxIsStale)
    }

    @Test func aSecondTapOnTheSameItemWhileInFlightIsIgnored() async {
        let stub = StubTransport()
        stub.on("postMailFeedback", .slowJson(204, "", ms: 150))
        let s = LevelStore(client: Self.client(stub), cache: nil)
        async let first = s.feedback(item: "a", verdict: .interest)
        try? await Task.sleep(for: .milliseconds(30))
        let second = await s.feedback(item: "a", verdict: .nope)
        #expect(second == .ignored)
        #expect(await first == .done && s.verdicts["a"] == .interest)
        #expect(stub.ops.filter { $0 == "postMailFeedback" }.count == 1)
    }
}
