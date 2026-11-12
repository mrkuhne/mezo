import Foundation
import Testing
@testable import BoopCore

/// B3 Task 9: Boop's goal-of-the-day chips (spec §5.1) — deterministic, built on the phone, no model.
struct GoalSuggestionsTests {
    private let today = "2026-11-10"

    private func brief(session: String = "null") throws -> Brief {
        var f = BriefFixture()
        f.session = session
        return try f.brief()
    }

    private func event(_ title: String, _ h: Int, _ m: Int = 0, minutes: Int, attendees: Int = 0, allDay: Bool = false,
                       day: Int = 10) -> CalendarEventLite {
        let start = budapest.date(from: DateComponents(year: 2026, month: 11, day: day, hour: h, minute: m))!
        return CalendarEventLite(title: title, start: start, end: start.addingTimeInterval(Double(minutes) * 60),
                                 allDay: allDay, attendees: attendees)
    }

    @Test func calendarEventSuggestedWithWhy() throws {
        let events = [
            event("Standup", 9, minutes: 15, attendees: 6),
            event("Ügyfélprezentáció", 14, minutes: 90, attendees: 6),
            event("Szabadság", 0, minutes: 1440, allDay: true),
            event("Holnapi workshop", 9, minutes: 240, attendees: 12, day: 11),
        ]
        let s = GoalSuggestions.suggest(brief: try brief(), calendar: events, pastGoals: [], today: today, in: budapest)
        #expect(s == [GoalSuggestion(text: "Ügyfélprezentáció 14:00", why: "a naptárból")])
    }

    @Test func moreAttendeesWinOverLength() throws {
        let events = [event("Egyedül fókusz", 9, minutes: 180), event("Csapatnap", 13, minutes: 60, attendees: 8)]
        let s = GoalSuggestions.suggest(brief: try brief(), calendar: events, pastGoals: [], today: today, in: budapest)
        #expect(s.first?.text == "Csapatnap 13:00")
    }

    @Test func sessionSuggested() throws {
        let b = try brief(session: #"{"title":"Felsőtest edzés","time":"18:00","plannedTime":"17:30","minutes":75,"exercises":[]}"#)
        let s = GoalSuggestions.suggest(brief: b, calendar: [], pastGoals: [], today: today, in: budapest)
        #expect(s == [GoalSuggestion(text: "Felsőtest edzés 18:00", why: "a heti terv")])

        let done = try brief(session: #"{"title":"Felsőtest edzés","time":"18:00","plannedTime":"17:30","minutes":75,"exercises":[],"done":true}"#)
        #expect(GoalSuggestions.suggest(brief: done, calendar: [], pastGoals: [], today: today, in: budapest).isEmpty)
    }

    @Test func sessionOfAnotherDayIsNotSuggested() throws {
        let b = try brief(session: #"{"title":"Felsőtest edzés","time":"18:00","plannedTime":"17:30","minutes":75,"exercises":[]}"#)
        #expect(GoalSuggestions.suggest(brief: b, calendar: [], pastGoals: [], today: "2026-11-11", in: budapest).isEmpty)
    }

    @Test func overdueRepeatedGoalSuggested() throws {
        let past: [(date: String, text: String)] = [
            ("2026-10-26", "meal prep a hétre"),
            ("2026-11-02", "Meal prep a hétre"),        // last seen 8 days ago, twice in all
            ("2026-10-20", "Anyának telefonálni"),      // seen once only
            ("2026-10-25", "Futás a szigeten"),
            ("2026-11-07", "Futás a szigeten"),         // seen within the last 7 days
            ("2026-11-02", "Meal prep a hétre"),        // the same day twice counts once
        ]
        let s = GoalSuggestions.suggest(brief: try brief(), calendar: [], pastGoals: past, today: today, in: budapest)
        #expect(s == [GoalSuggestion(text: "Meal prep a hétre", why: "8 napja nem volt")])
    }

    @Test func atMostThree() throws {
        let b = try brief(session: #"{"title":"Röpi","time":"19:00","plannedTime":"19:00","minutes":90,"exercises":[]}"#)
        let past: [(date: String, text: String)] = [
            ("2026-10-01", "Meal prep a hétre"), ("2026-10-08", "Meal prep a hétre"),
            ("2026-10-02", "Számlák rendezése"), ("2026-10-09", "Számlák rendezése"),
        ]
        let s = GoalSuggestions.suggest(brief: b, calendar: [event("Ügyfélprezentáció", 14, minutes: 90)], pastGoals: past,
                                        today: today, in: budapest)
        #expect(s.count == 3)
        #expect(s.map(\.why) == ["a naptárból", "a heti terv", "32 napja nem volt"])
    }

    @Test func sameTextIsSuggestedOnce() throws {
        let b = try brief(session: #"{"title":"Röpi","time":null,"plannedTime":null,"minutes":90,"exercises":[]}"#)
        let past: [(date: String, text: String)] = [("2026-10-01", "Röpi"), ("2026-10-08", "röpi")]
        let s = GoalSuggestions.suggest(brief: b, calendar: [], pastGoals: past, today: today, in: budapest)
        #expect(s == [GoalSuggestion(text: "Röpi", why: "a heti terv")])
    }

    @Test func noSuggestionsWhenNothingKnown() throws {
        #expect(GoalSuggestions.suggest(brief: try brief(), calendar: [], pastGoals: [], today: today, in: budapest).isEmpty)
    }
}
