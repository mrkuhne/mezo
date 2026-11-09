import Foundation
import Testing
@testable import BoopCore

@MainActor
struct SessionTests {
    let stub = StubTransport()
    let store = MemoryTokenStore()
    func session() -> Session { Session(tokens: store, transport: stub) }

    @Test func bootstrapWithoutTokenIsSignedOut() async {
        let s = session()
        await s.bootstrap()
        #expect(s.state == .signedOut)
        #expect(stub.ops.isEmpty)
    }

    @Test func bootstrapWithValidTokenNotOnboarded() async throws {
        try store.write("t0"); stub.on("me", .json(200, meJSON(false)))
        let s = session()
        await s.bootstrap()
        guard case .needsOnboarding(let me) = s.state else { Issue.record("state \(s.state)"); return }
        #expect(me.name == "Teszt")
        #expect(stub.sent.first?.auth == "Bearer t0")
    }

    @Test func bootstrapWithValidTokenOnboarded() async throws {
        try store.write("t0"); stub.on("me", .json(200, meJSON(true)))
        let s = session()
        await s.bootstrap()
        guard case .ready = s.state else { Issue.record("state \(s.state)"); return }
    }

    @Test func bootstrapWith401ClearsTokenAndSignsOut() async throws {
        try store.write("old"); stub.on("me", .json(401, #"[{"code":"AUTH_UNAUTHORIZED","type":"REQUEST"}]"#))
        let s = session()
        await s.bootstrap()
        #expect(s.state == .signedOut)
        #expect(store.read() == nil)
    }

    @Test func bootstrapOfflineKeepsToken() async throws {
        try store.write("t0"); stub.on("me", .fail(URLError(.notConnectedToInternet)))
        let s = session()
        await s.bootstrap()
        #expect(s.state == .offline)
        #expect(store.read() == "t0")
        stub.on("me", .json(200, meJSON(true)))
        await s.retry()
        guard case .ready = s.state else { Issue.record("state \(s.state)"); return }
    }

    @Test func signInStoresTokenThenLoadsMe() async throws {
        stub.on("login", .json(200, #"{"token":"t1"}"#)); stub.on("me", .json(200, meJSON(false)))
        let s = session()
        try await s.signIn(email: "teszt@pelda.hu", password: "titkos123")
        #expect(store.read() == "t1")
        #expect(stub.ops == ["login", "me"])
        #expect(stub.sent.last?.auth == "Bearer t1")
        guard case .needsOnboarding = s.state else { Issue.record("state \(s.state)"); return }
    }

    @Test func signIn401IsBadCredentials() async {
        stub.on("login", .json(401, #"[{"code":"AUTH_BAD_CREDENTIALS","type":"REQUEST"}]"#))
        let s = session()
        await #expect(throws: AuthError.badCredentials) { try await s.signIn(email: "a@b.hu", password: "rossz") }
        #expect(store.read() == nil)
    }

    @Test func signOutClearsTokenAndState() async throws {
        try store.write("t0"); stub.on("me", .json(200, meJSON(true)))
        let s = session()
        await s.bootstrap()
        s.signOut()
        #expect(store.read() == nil)
        #expect(s.state == .signedOut)
    }
}
