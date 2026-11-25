import Foundation
import Testing
@testable import BoopCore

/// A catch-up's own instants and words (`mezo-r36n9.159`, spec §3.5): the moment's slot time on that day, the close
/// at nine in the evening, the eyebrow „PÓTLÁS · TEGNAP · DÉL".
struct CheckInCatchUpTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    func at(_ s: String) -> Date {
        let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone; f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm"; return f.date(from: s)!
    }

    @Test func theMomentsOwnTime() {
        #expect(CheckInMoment.reggel.time(on: "2026-11-23", calendar: cal) == at("2026-11-23 06:30"))
        #expect(CheckInMoment.delben.time(on: "2026-11-23", calendar: cal) == at("2026-11-23 10:00"))
        #expect(CheckInMoment.delutan.time(on: "2026-11-23", calendar: cal) == at("2026-11-23 14:00"))
        #expect(CheckInMoment.delben.time(on: "nonsense", calendar: cal) == nil)
    }

    @Test func labels() {
        #expect(catchUpLabel(date: "2026-11-23", moment: .delben, today: "2026-11-24", calendar: cal) == "PÓTLÁS · TEGNAP · DÉL")
        #expect(catchUpLabel(date: "2026-11-24", moment: .reggel, today: "2026-11-24", calendar: cal) == "PÓTLÁS · MA · REGGEL")
        #expect(catchUpLabel(date: "2026-11-22", moment: .delutan, today: "2026-11-24", calendar: cal) == "PÓTLÁS · NOV. 22. · DÉLUTÁN")
    }

    @Test func theCloseCatchUpIsAtNine() {
        #expect(esteCatchUpInstant(on: "2026-11-23", calendar: cal) == at("2026-11-23 21:00"))
    }
}
