import Foundation
import Testing
@testable import BoopCore

/// The training area's voice on the living wall (B5, Task 6b). The engine and the wall's views know nothing about
/// Edzés: it joins by registering one source, and these tests are what proves that stayed true.
struct EdzesWallSourceTests {
    let now = budapest.date(from: DateComponents(year: 2026, month: 11, day: 16, hour: 16))!

    /// The brief through the generated type, the way the app builds it — `session` is its own JSON so nothing here
    /// bypasses the mapping under test.
    func brief(_ sessionJSON: String) -> Brief {
        var f = BriefFixture()
        f.session = sessionJSON
        return try! f.brief()
    }

    func session(_ time: String?, done: Bool = false, doneMinutes: Int? = nil) -> String {
        let t = time.map { "\"\($0)\"" } ?? "null"
        let dm = doneMinutes.map { "\($0)" } ?? "null"
        let hr = done ? "118" : "null"
        return #"{"title":"Pull Day","time":\#(t),"plannedTime":\#(t),"minutes":62,"exercises":[],"done":\#(done),"doneMinutes":\#(dm),"avgHr":\#(hr)}"#
    }

    @Test func plannedSessionImprovesTheDay() {
        let out = edzesWallCandidates(brief(session("18:00")), now: now, calendar: budapest)
        let c = try! #require(out.first)
        #expect(out.count == 1)
        #expect(c.role == .improves)
        #expect(c.area == WallSources.edzes)
        // Within two hours it outranks the food tip (0.7); the number is a choice, not an inheritance.
        #expect(c.rank == 0.9)
        #expect(c.text.contains("120 perc múlva"))
        #expect(c.why.isEmpty == false)
        #expect(c.expiresAt == nil)         // nothing about a planned session is lost yet
    }

    @Test func aDistantSessionRanksBelowTheFoodTip() {
        let out = edzesWallCandidates(brief(session("21:30")), now: now, calendar: budapest)
        #expect(out.first?.rank == 0.5)
        #expect(out.first?.text.contains("21:30") == true)
    }

    @Test func aSessionAboutToBeMissedExpires() {
        // Planned for 15:00, it is 16:00: inside the grace window and still not started.
        let out = edzesWallCandidates(brief(session("15:00")), now: now, calendar: budapest)
        let c = try! #require(out.first)
        #expect(c.role == .expires)
        #expect(c.kind == .teendo)
        // The wall drops it by itself once the window has gone — nothing has to clear it.
        #expect(c.expiresAt == budapest.date(from: DateComponents(year: 2026, month: 11, day: 16, hour: 16, minute: 30)))
        // It is the one role that may ring the phone, and a session about to be lost is what that is for.
        #expect(c.notifiable)
        #expect(c.secondary == "Ma kihagyom")
    }

    @Test func aMissedSessionStopsBeingNews() {
        // 12:00 planned, 16:00 now: past the grace window. The day has moved on; the wall says nothing.
        #expect(edzesWallCandidates(brief(session("12:00")), now: now, calendar: budapest).isEmpty)
    }

    @Test func aDoneSessionIsSomethingThatHappened() {
        let out = edzesWallCandidates(brief(session("15:00", done: true, doneMinutes: 58)),
                                      now: now, calendar: budapest)
        let c = try! #require(out.first)
        #expect(c.role == .happened)
        #expect(c.kind == .tortent)
        #expect(c.primary == "Megnézem")    // the one thing left to do about it: look at the result (mezo-r36n9.147)
        #expect(c.sub.contains("58 perc"))
        #expect(c.expiresAt == nil)
    }

    @Test func noSessionSaysNothing() {
        #expect(edzesWallCandidates(brief("null"), now: now, calendar: budapest).isEmpty)
    }

    @Test func theBriefNoLongerOffersASessionCard() {
        // Two sources must not both offer a session card: `acted` is keyed by candidate id, so a duplicate would
        // come back the render after he dismissed it.
        let out = briefWallCandidates(brief(session("18:00")), now: now, calendar: budapest)
        #expect(out.contains { $0.area == WallSources.edzes } == false)
        #expect(out.contains { $0.id == "edzes-keszulj" } == false)
    }

    @Test func registeringTheAreaNeedsNoChangeToTheEngine() {
        // What the whole design is for: a registered area reaches the wall through `buildWall` untouched.
        var registry = WallRegistry()
        let b = brief(session("18:00"))
        registry.register(WallSource(id: WallSources.edzes) { input in
            edzesWallCandidates(b, now: input.now, calendar: budapest)
        })
        let wall = buildWall(registry.candidates(WallInput(now: now, day: now)), now: now)
        #expect(wall.hero?.area == WallSources.edzes)
    }
}
