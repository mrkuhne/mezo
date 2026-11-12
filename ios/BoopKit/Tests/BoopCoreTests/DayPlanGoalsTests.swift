import Testing
@testable import BoopCore

/// B3 Task 5: the close-out's session goal is decided from the brief's done signal.
struct DayPlanGoalsTests {
    private func brief(sessionExtra: String) throws -> Brief {
        var f = BriefFixture()
        f.bedtimeTarget = #""22:45""#
        f.session = #"{"title":"Felsőtest edzés","time":"18:00","plannedTime":"18:00","minutes":75,"exercises":[]\#(sessionExtra)}"#
        return try f.brief()
    }

    @Test func sessionMetFromDone() throws {
        let done = DayPlan.goals(try brief(sessionExtra: #","done":true,"doneMinutes":90,"avgHr":128"#))
        let session = try #require(done.first { $0.id == "session" })
        #expect(session.met == true)
        #expect(session.result == "90 perc · pulzus átl. 128")
        #expect(done.first { $0.id == "bedtime" }?.met == nil)

        let pending = DayPlan.goals(try brief(sessionExtra: #","done":false"#))
        #expect(pending.first { $0.id == "session" }?.met == nil)
        #expect(pending.first { $0.id == "session" }?.result == "")
    }

    @Test func sessionResultWithoutHr() throws {
        let g = DayPlan.goals(try brief(sessionExtra: #","done":true,"doneMinutes":90"#))
        let session = try #require(g.first { $0.id == "session" })
        #expect(session.result == "90 perc")
        #expect(session.met == true)
    }

    @Test func oldBriefWithoutDoneFieldIsNotDone() throws {
        let g = DayPlan.goals(try brief(sessionExtra: ""))
        #expect(g.first { $0.id == "session" }?.met == nil)
    }
}
