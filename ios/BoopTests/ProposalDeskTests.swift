import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// Boop's proposals shared by Ma and the rooms (B2 Task 7): *Most nem* hides for today and persists.
@MainActor
struct ProposalDeskTests {
    /// A day whose 17:30 session clashes with a meeting: the brief proposes moving it to 18:30.
    private func conflictDay() throws -> Brief {
        let metrics = ["forma", "alvas", "mozgas", "fuel", "pulzus"].map {
            #"{"key":"\#($0)","score":70,"display":"70","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        let json = #"""
        {"date":"2026-11-10","generatedAt":"2026-11-10T05:30:00Z","state":"okay","nightsKnown":12,
         "metrics":[\#(metrics)],"brief":[],"energy":{"hourly":[],"dipHour":null},"tonightTip":"t","nextMealTip":null,
         "conflict":{"text":"Ütközik.","suggestedTime":"18:30"},
         "day":{"sleep":null,"bedtimeTarget":null,"deepSleepWeek":[],"restingHrWeek":[],
           "steps":null,"stepsGoal":10000,"activeKcal":null,
           "session":{"title":"Vállak és hát","time":"17:30","plannedTime":"17:30","minutes":60,"exercises":[]},
           "meals":[],"kcalSoFar":0,"kcalTarget":2400,"proteinG":0,"proteinTarget":150,"carbsG":0,"fatG":0,
           "checkins":[],"intention":{"creed":null,"foci":[]},"observations":[],
           "calendar":{"count":2,"busySlots":[]},"recovery":null}}
        """#
        return try Brief(json: Data(json.utf8))
    }

    private var morning: Date {
        Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: Date())!
    }

    @Test func dismissHidesTheProposalAndPersists() throws {
        let suite = "ProposalDeskTests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let brief = try conflictDay()
        let desk = ProposalDesk(defaults: defaults)
        let p = try #require(desk.pending(brief, now: morning).first)

        var toasts: [String] = []
        desk.dismiss(p, brief: brief) { toasts.append($0) }

        #expect(desk.pending(brief, now: morning).isEmpty)
        #expect(toasts == [MaText.dismissed])
        #expect(desk.state(of: p, brief, now: morning) == .dismissed(p.text))
        let key = Proposals.dismissKey(date: brief.date, id: p.id)
        #expect(defaults.string(forKey: ProposalDesk.dismissedKey) == key)
        // a fresh desk on the same defaults reads it back
        let again = ProposalDesk(defaults: defaults)
        #expect(again.dismissedRaw == key)
        #expect(again.pending(brief, now: morning).isEmpty)
    }
}
