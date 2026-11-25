import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Napló day sheet's model (`mezo-r36n9.159`): the weekday label the block's template days are keyed by, and the
/// day's journal lines merged from the phone and the server.
@MainActor
struct NaploCatchUpModelTests {
    private let cal: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()

    @Test func theWeekdayLabelFollowsTheServersOrder() {
        #expect(NaploCatchUpModel.weekdayLabel(of: "2026-11-23", calendar: cal) == "Hét")   // Monday
        #expect(NaploCatchUpModel.weekdayLabel(of: "2026-11-24", calendar: cal) == "Kedd")
        #expect(NaploCatchUpModel.weekdayLabel(of: "2026-11-29", calendar: cal) == "Vas")   // Sunday
        #expect(NaploCatchUpModel.weekdayLabel(of: "nonsense", calendar: cal) == nil)
    }

    @Test func journalLinesMergeKeepsThePhonesPendingLineAndOrdersNewestFirst() {
        let id = UUID()
        let local = [JournalLineLite(id: id, text: "Még a telefonon", occurredOn: "2026-11-23", createdAt: Date(timeIntervalSince1970: 300))]
        let server = [JournalLineLite(id: id, text: "Még a telefonon", occurredOn: "2026-11-23", createdAt: Date(timeIntervalSince1970: 300)),
                      JournalLineLite(id: UUID(), text: "Régebbi", occurredOn: "2026-11-23", createdAt: Date(timeIntervalSince1970: 100)),
                      JournalLineLite(id: UUID(), text: "Legújabb", occurredOn: "2026-11-23", createdAt: Date(timeIntervalSince1970: 900))]
        let out = NaploCatchUpModel.mergedLines(local: local, server: server)
        #expect(out.map(\.text) == ["Legújabb", "Még a telefonon", "Régebbi"])
    }
}
