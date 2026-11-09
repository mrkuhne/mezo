import Foundation
import Testing
@testable import BoopCore

@MainActor
struct APIErrorTextTests {
    let stub = StubTransport()
    let store = MemoryTokenStore()

    func register(_ reply: StubTransport.Reply) async -> AuthError? {
        stub.on("register", reply)
        do { try await Session(tokens: store, transport: stub).register(invite: "ABC", email: "a@b.hu", password: "titkos123", name: "Teszt"); return nil }
        catch { return error }
    }

    @Test func mapsRegisterConflicts() async {
        #expect(await register(.json(409, #"[{"code":"AUTH_INVITE_INVALID","type":"REQUEST"}]"#)) == .inviteInvalid)
        #expect(await register(.json(409, #"[{"code":"AUTH_EMAIL_TAKEN","type":"REQUEST"}]"#)) == .emailTaken)
        #expect(await register(.json(400, #"[{"code":"VALIDATION","type":"FIELD","fieldName":"password","message":"Legalább 8 karakter."}]"#))
                == .field(name: "password", text: "Legalább 8 karakter."))
        #expect(await register(.fail(URLError(.timedOut))) == .offline)
        #expect(await register(.status(500)) == .server)
    }

    @Test func hungarianCopy() {
        #expect(hungarianText(.badCredentials) == "Hibás e-mail cím vagy jelszó.")
        #expect(hungarianText(.inviteInvalid) == "Ez a meghívókód nem érvényes, vagy már felhasználták.")
        #expect(hungarianText(.emailTaken) == "Ezzel az e-mail címmel már van fiók. Lépj be inkább.")
        #expect(hungarianText(.offline) == "Nem érem el a szervert. Nézd meg a netet, és próbáld újra.")
        #expect(hungarianText(.server) == "Valami félrement a szerveren. Próbáld újra pár perc múlva.")
        #expect(hungarianText(.field(name: "x", text: "Szöveg.")) == "Szöveg.")
    }

    @Test func localDayUsesTheCalendarsZone() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        let late = cal.date(from: DateComponents(year: 2026, month: 11, day: 9, hour: 23, minute: 30))!
        #expect(localDay(late, calendar: cal) == "2026-11-09")
    }
}
