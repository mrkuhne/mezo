import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// The Évad room's pure pieces (`mezo-r36n9.196`): tabs, old-link subs, the head per tab, the Hét review card,
/// where Terv rows open, and the countdowns.
struct EvadRoomTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone.current
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()

    func overview() throws -> EvadOverview {
        let data = try JSONSerialization.data(withJSONObject: EvadPreviewModel(state: "full").overview())
        return try JSONDecoder().decode(EvadOverview.self, from: data)
    }

    @Test func fourTabsInOrderWithOwnGlyphs() {
        #expect(EvadRoomTab.allCases.map(\.rawValue) == ["Most", "Hét", "Terv", "Kísérlet"])
        #expect(Set(EvadRoomTab.allCases.map(\.glyph)).count == 4)
    }

    @Test func oldLinkSubsMapToPages() {
        #expect(evadRoomSub("modositas") == .whatIf)
        #expect(evadRoomSub("szabalyok") == .rules)
        #expect(evadRoomSub("uj") == .newSeason)
        #expect(evadRoomSub("atrendezes") == .atrendezes)
        #expect(evadRoomSub("kiserlet:x2") == .experiment("x2"))
        #expect(evadRoomSub("kiserlet:") == .experiment(nil))
        #expect(evadRoomSub("menu") == nil && evadRoomSub(nil) == nil)
    }

    @Test func headHasAFixedSentencePerTab() throws {
        let o = try overview()
        let heads = EvadRoomTab.allCases.map { evadRoomHead(o, tab: $0, week: nil) }
        #expect(Set(heads.map(\.sentence)).count == 4, "each tab says what you see on it")
        #expect(heads.allSatisfy { $0.eyebrow.hasPrefix(o.head.title) })
        #expect(heads[2].headline == "Mi a nagy terv?")
    }

    @Test func reviewCardStates() {
        let w = EvadReviewWindow(weekMonday: "2026-11-23", nextMonday: "2026-11-30")
        #expect(evadReviewCardState(window: w, log: nil, doneThisWindow: false) == .available)
        #expect(evadReviewCardState(window: w, log: ("2026-11-23", "Erre figyelj: X."), doneThisWindow: true) == .done("Erre figyelj: X."))
        #expect(evadReviewCardState(window: w, log: ("2026-11-16", "Régi."), doneThisWindow: true) == .available,
                "last week's log does not count as done this window")
        #expect(evadReviewCardState(window: nil, log: ("2026-11-16", "Régi."), doneThisWindow: false) == .lastWeek("Régi."))
        #expect(evadReviewCardState(window: nil, log: nil, doneThisWindow: false) == .none)
    }

    @Test func planRowsOpenTheirRooms() {
        #expect(evadPlanRowTarget("block") == .room(RoomEntry(.mozgas)))
        #expect(evadPlanRowTarget("food") == .room(RoomEntry(.fuel)))
        #expect(evadPlanRowTarget("sleep") == .room(RoomEntry(.alvas)))
        #expect(evadPlanRowTarget("weight") == .room(RoomEntry(.suly)))
    }

    @Test func countdownToSundayEvening() throws {
        let wed = try #require(cal.date(from: DateComponents(year: 2026, month: 11, day: 25, hour: 10)))
        let sat = try #require(cal.date(from: DateComponents(year: 2026, month: 11, day: 28, hour: 10)))
        let sun = try #require(cal.date(from: DateComponents(year: 2026, month: 11, day: 29, hour: 10)))
        #expect(evadReviewCountdown(now: wed, calendar: cal) == "4 nap múlva · kb. 3 perc")
        #expect(evadReviewCountdown(now: sat, calendar: cal) == "holnap · kb. 3 perc")
        #expect(evadReviewCountdown(now: sun, calendar: cal) == "ma este · kb. 3 perc")
    }

    @Test func yearStripSpeaksInWords() {
        #expect(evadYearStripSpoken(total: 52, bracket: 31...42, now: 37) == "Az év 52 hete, az évad a 31–42. hét, most a 37.")
        #expect(evadYearStripSpoken(total: 52, bracket: nil, now: nil) == "Az év 52 hete")
    }
}
