import Foundation
import Testing
@testable import BoopCore

/// Boop Sport S6 (`mezo-r36n9.206`): the gym and the sport are two separate things outside the Sport room too — the
/// day page (rows, path, close-out goals), the Ma wall and the Edzés room. Logging one never ticks the other.
struct SportAppWideTests {
    let gym = #"{"title":"Pull Day","time":"07:00","plannedTime":"07:00","minutes":62,"exercises":[],"done":false}"#
    let gymDone = #"{"title":"Pull Day","time":"07:00","plannedTime":"07:00","minutes":62,"exercises":[],"done":true,"doneMinutes":60}"#
    let volley = #"[{"sport":"volleyball","time":"18:00","minutes":90,"done":false}]"#
    let volleyDone = #"[{"sport":"volleyball","time":"18:00","minutes":90,"done":true,"doneMinutes":95,"avgHr":131}]"#

    func brief(session: String, sport: String?) throws -> Brief {
        var f = BriefFixture(); f.session = session; f.sport = sport
        return try f.brief()
    }

    // MARK: the brief

    @Test func theBriefCarriesTheSportNextToTheGym() throws {
        let b = try brief(session: gym, sport: volleyDone)
        #expect(b.day.session?.done == false)
        #expect(b.day.sport == [Brief.Sport(sport: "volleyball", time: "18:00", minutes: 90, done: true, doneMinutes: 95, avgHr: 131)])
    }

    @Test func anOlderServerWithoutSportReadsAsNone() throws {
        #expect(try brief(session: gym, sport: nil).day.sport.isEmpty)
    }

    // MARK: the day page

    @Test func aGymAndVolleyballDayHasTwoRows() throws {
        let rows = DayPlan.rows(try brief(session: gym, sport: volley))
        #expect(rows.map(\.id) == ["session", "sport-0"])
        #expect(rows[1].title == "Röplabda")
        #expect(rows[1].sub == "90 perc")
    }

    @Test func aDoneVolleyballLeavesTheGymOpenOnThePath() throws {
        let steps = PathBuilder.steps(for: .mozgas, brief: try brief(session: gym, sport: volleyDone), now: at(12), evening: false,
                                      calendar: budapest)
        let gymStep = try #require(steps.first { $0.id == "session" })
        let sportStep = try #require(steps.first { $0.id == "sport-0" })
        #expect(!gymStep.done)
        #expect(sportStep.done)
        #expect(sportStep.time == "18:00")
        #expect(sportStep.sub == "95 perc · megvolt")
        #expect(sportStep.opens)
    }

    @Test func aDoneGymLeavesTheSportOpenOnTheFullDay() throws {
        let steps = PathBuilder.steps(for: nil, brief: try brief(session: gymDone, sport: volley), now: at(12), evening: false,
                                      calendar: budapest)
        #expect(steps.first { $0.id == "session" }?.done == true)
        #expect(steps.first { $0.id == "sport-0" }?.done == false)
    }

    @Test func theCloseOutHasOneGoalEach() throws {
        let goals = DayPlan.goals(try brief(session: gym, sport: volleyDone))
        let s = try #require(goals.first { $0.id == "session" })
        let v = try #require(goals.first { $0.id == "sport-0" })
        #expect(s.met == nil)
        #expect(v.met == true)
        #expect(v.title == "Röplabda · 18:00")
        #expect(v.result == "95 perc")
    }

    @Test func aSportOnlyDayHasNoGymRow() throws {
        let rows = DayPlan.rows(try brief(session: "null", sport: volley))
        #expect(rows.map(\.id) == ["sport-0"])
    }

    @Test func theCurveHasOnePinEach() throws {
        let m = dayMoments(try brief(session: gym, sport: volley))
        #expect(m.map(\.id) == ["session", "sport-0"])
        #expect(m[1].label == "röpi")
        #expect(m[1].detail == "18:00 · Röplabda · 90 perc")
    }

    // MARK: the Edzés room

    @Test func theEdzesRoomNamesTheSportInsteadOfARestDay() {
        #expect(edzesSportDayLine([]) == nil)
        #expect(edzesSportDayLine([Brief.Sport(sport: "volleyball", time: "18:00")]) == "Röpi 18:00")
        #expect(edzesSportDayLine([Brief.Sport(sport: "running", time: "07:00", done: true),
                                   Brief.Sport(sport: "volleyball", time: "18:00")]) == "Futás 07:00 · megvolt, röpi 18:00")
    }

    // MARK: the wall

    let now = budapest.date(from: DateComponents(year: 2026, month: 11, day: 25, hour: 16))!

    func overview(_ t: SportTonight?, today: String = "2026-11-25") -> SportOverview {
        SportOverview(weekStart: "2026-11-23", weekEnd: "2026-11-29", today: today, days: [], tonight: t)
    }

    @Test func tonightsGameImprovesTheDay() throws {
        let far = sportWallCandidates(overview(SportTonight(sport: "volleyball", time: "19:00", durationMin: 90, moment: "BEFORE")),
                                      now: now, calendar: budapest)
        let c = try #require(far.first)
        #expect(far.count == 1)
        #expect(c.role == .improves)
        #expect(c.area == WallSources.sport)
        #expect(c.rank == 0.5)
        #expect(c.text == "Ma *röpi* 19:00")
        #expect(c.sub == "90 perc")
        let near = sportWallCandidates(overview(SportTonight(sport: "volleyball", time: "17:30", moment: "BEFORE")),
                                       now: now, calendar: budapest)
        #expect(near.first?.rank == 0.9)
        #expect(near.first?.text == "*90 perc múlva* röpi")
    }

    @Test func aGamePastItsStartSaysNothingUntilTheWatchHasIt() {
        #expect(sportWallCandidates(overview(SportTonight(sport: "volleyball", time: "15:00", moment: "BEFORE")),
                                    now: now, calendar: budapest).isEmpty)
    }

    @Test func theWatchsWorkoutAsksToBeCompleted() throws {
        let h = SportHealthWorkout(activityType: "volleyball", start: "2026-11-25T17:00:00Z", minutes: 95, kcal: 640)
        let c = try #require(sportWallCandidates(overview(SportTonight(sport: "volleyball", time: "18:00", moment: "RECORDED", health: h)),
                                                 now: now, calendar: budapest).first)
        #expect(c.id == SportWallID.recorded)
        #expect(c.role == .improves)
        #expect(c.rank == 0.95)
        #expect(c.text == "Az órád felvette a *röpit* — egészítsd ki")
        #expect(c.sub == "95 perc · 640 kcal · mennyire volt nehéz?")
        #expect(c.primary == "Kiegészítem")
    }

    @Test func doneAndSkippedAreThingsThatHappened() throws {
        let s = SportLoggedSession(id: "1", sport: "volleyball", durationMin: 95, rpe: 7)
        let done = try #require(sportWallCandidates(overview(SportTonight(sport: "volleyball", moment: "DONE", session: s)),
                                                    now: now, calendar: budapest).first)
        #expect(done.role == .happened)
        #expect(done.text == "*Röplabda* megvolt")
        #expect(done.sub == "95 perc · nehézség 7")
        let skip = SportSkipInfo(id: "k", reason: "TIRED")
        let skipped = try #require(sportWallCandidates(overview(SportTonight(sport: "volleyball", moment: "SKIPPED", skip: skip)),
                                                       now: now, calendar: budapest).first)
        #expect(skipped.role == .happened)
        #expect(skipped.text == "*Röplabda* ma kimarad")
        #expect(skipped.sub == "Fáradt voltam")
    }

    @Test func aStaleOverviewOrNoSportSaysNothing() {
        #expect(sportWallCandidates(nil, now: now, calendar: budapest).isEmpty)
        #expect(sportWallCandidates(overview(nil), now: now, calendar: budapest).isEmpty)
        #expect(sportWallCandidates(overview(SportTonight(sport: "volleyball", moment: "DONE"), today: "2026-11-24"),
                                    now: now, calendar: budapest).isEmpty)
    }
}
