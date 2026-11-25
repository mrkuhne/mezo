import Foundation
import Testing
@testable import BoopCore

@Suite("Levél — Google PKCE and callback")
@MainActor
struct GooglePKCETests {
    static let clientId = "123456789012-abcdef.apps.googleusercontent.com"

    @Test func verifierIsUrlSafeAndInRange() {
        let allowed = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        let a = GooglePKCE.makeVerifier(), b = GooglePKCE.makeVerifier()
        for v in [a, b] {
            #expect((43...128).contains(v.count))
            #expect(v.allSatisfy { allowed.contains($0) })
        }
        #expect(a != b)
        #expect(GooglePKCE.makeState() != GooglePKCE.makeState())
    }

    @Test func challengeMatchesRFC7636AppendixB() {
        #expect(GooglePKCE.challenge(for: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
    }

    @Test func schemeIsTheReversedClientId() {
        #expect(GoogleAuth.redirectScheme(clientId: Self.clientId) == "com.googleusercontent.apps.123456789012-abcdef")
        #expect(GoogleAuth.redirectURI(clientId: Self.clientId) == "com.googleusercontent.apps.123456789012-abcdef:/oauth2redirect")
        #expect(GoogleAuth.redirectScheme(clientId: "nonsense") == nil)
        #expect(GoogleAuth.redirectScheme(clientId: ".apps.googleusercontent.com") == nil)
        #expect(GoogleAuth.authURL(clientId: "nonsense", challenge: "c", state: "s") == nil)
    }

    @Test func authURLCarriesEveryParameter() throws {
        let url = try #require(GoogleAuth.authURL(clientId: Self.clientId, challenge: "CHAL", state: "ST"))
        #expect(url.absoluteString.hasPrefix("https://accounts.google.com/o/oauth2/v2/auth?"))
        let items = Dictionary(uniqueKeysWithValues: (URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? [])
            .map { ($0.name, $0.value ?? "") })
        #expect(items["client_id"] == Self.clientId)
        #expect(items["redirect_uri"] == "com.googleusercontent.apps.123456789012-abcdef:/oauth2redirect")
        #expect(items["response_type"] == "code")
        #expect(items["scope"] == "openid email https://www.googleapis.com/auth/gmail.readonly")
        #expect(items["code_challenge"] == "CHAL" && items["code_challenge_method"] == "S256")
        #expect(items["state"] == "ST" && items["prompt"] == "consent" && items["access_type"] == "offline")
        #expect(items.count == 9)
    }

    @Test func callbackParsing() {
        let base = "com.googleusercontent.apps.1-a:/oauth2redirect"
        #expect(GoogleAuth.parseCallback(url: URL(string: "\(base)?code=4%2F0abc&state=ST")!, expectedState: "ST") == .success("4/0abc"))
        #expect(GoogleAuth.parseCallback(url: URL(string: "\(base)?code=x&state=OTHER")!, expectedState: "ST") == .failure(.stateMismatch))
        #expect(GoogleAuth.parseCallback(url: URL(string: "\(base)?code=x")!, expectedState: "ST") == .failure(.stateMismatch))
        #expect(GoogleAuth.parseCallback(url: URL(string: "\(base)?error=access_denied&state=ST")!, expectedState: "ST") == .failure(.denied))
        #expect(GoogleAuth.parseCallback(url: URL(string: "\(base)?error=server_error&state=ST")!, expectedState: "ST") == .failure(.other("server_error")))
        #expect(GoogleAuth.parseCallback(url: URL(string: "\(base)?state=ST")!, expectedState: "ST") == .failure(.missingCode))
    }

    // MARK: wire + store

    static let googleJSON = #"{"kind":"google","googleClientId":"123456789012-abcdef.apps.googleusercontent.com","address":"elek@gmail.example","state":"connected","lastRunAt":null,"lastFetched":null}"#

    @Test func wireDecodesKindAndClientIdLeniently() throws {
        let dec = PlanJSON.decoder
        let g = try dec.decode(LevelMailbox.self, from: Data(Self.googleJSON.utf8))
        #expect(g.kind == .google && g.googleClientId == Self.clientId && g.address == "elek@gmail.example")
        let none = try dec.decode(LevelMailbox.self, from: Data(#"{"kind":null,"googleClientId":null,"address":null,"state":"none"}"#.utf8))
        #expect(none.kind == nil && none.googleClientId == nil && none.state == .none)
        let unknown = try dec.decode(LevelMailbox.self, from: Data(#"{"kind":"carrier-pigeon","state":"connected"}"#.utf8))
        #expect(unknown.kind == .unknown && unknown.state == .connected)
        let old = try dec.decode(LevelMailbox.self, from: Data(#"{"address":"a@b.hu","state":"connected"}"#.utf8))
        #expect(old.kind == nil)
    }

    @Test func connectGoogleSendsTheContractBodyAndStoresNoCode() async throws {
        let stub = StubTransport()
        stub.on("postMailMailboxGoogle", .json(200, Self.googleJSON))
        let s = LevelStore(client: LevelClientTests.client(stub), cache: nil)
        #expect(await s.connectGoogle(code: "the-code", codeVerifier: "the-verifier", redirectUri: "r:/oauth2redirect") == .connected)
        #expect(stub.sent[0].path == "/api/mail/mailbox/google")
        #expect(stub.sent[0].body == #"{"code":"the-code","codeVerifier":"the-verifier","redirectUri":"r:\/oauth2redirect"}"#
                || stub.sent[0].body == #"{"code":"the-code","codeVerifier":"the-verifier","redirectUri":"r:/oauth2redirect"}"#)
        #expect(s.mailbox?.state == .connected && s.mailbox?.kind == .google)
        let mirror = String(describing: s.mailbox)
        #expect(!mirror.contains("the-code") && !mirror.contains("the-verifier"))
    }

    @Test func connectGoogleOutcomes() async {
        func run(_ reply: StubTransport.Reply) async -> LevelGoogleOutcome {
            let stub = StubTransport()
            stub.on("postMailMailboxGoogle", reply)
            let s = LevelStore(client: LevelClientTests.client(stub), cache: nil)
            let o = await s.connectGoogle(code: "c", codeVerifier: "v", redirectUri: "r")
            if o != .connected { #expect(s.mailbox == nil, "a failure stores nothing") }
            return o
        }
        #expect(await run(.json(422, #"[{"code":"MAIL_AUTH_FAILED"}]"#)) == .refused)
        #expect(await run(.json(409, #"[{"code":"MAIL_GOOGLE_NOT_CONFIGURED"}]"#)) == .notConfigured)
        #expect(await run(.json(400, #"[{"code":"MAIL_GOOGLE_REDIRECT_INVALID"}]"#)) == .failed(.rejected("MAIL_GOOGLE_REDIRECT_INVALID")))
        #expect(await run(.fail(URLError(.notConnectedToInternet))) == .offline)
        #expect(await LevelStore(client: nil, cache: nil).connectGoogle(code: "c", codeVerifier: "v", redirectUri: "r") == .failed(.unauthorized))
    }
}
