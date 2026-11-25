import Foundation
import Testing
@testable import BoopCore

/// „Másik napot csinálok ma" (mezo-r36n9.163): which of the week's training days he can do today instead.
struct OtherDayTests {
    let mon = UUID(), tue = UUID(), thu = UUID(), sat = UUID()

    var days: [BlockDay] {
        [BlockDay(id: mon, day: "Hét", type: "Push", muscle: "mell", exerciseCount: 5),
         BlockDay(id: tue, day: "Kedd", type: "Pull", muscle: "hát", exerciseCount: 5),
         BlockDay(id: UUID(), day: "Sze", type: "Láb", muscle: "comb", exerciseCount: 6),
         BlockDay(id: thu, day: "Csü", type: "Felsőtest", muscle: "váll", exerciseCount: 5),
         BlockDay(id: sat, day: "Szo", type: "Alsótest", muscle: "comb", exerciseCount: 5)]
    }

    @Test func theMissedDaysComeFirstNewestFirstThenTheLaterOnes() {
        let choices = otherDayChoices(days: days, todayIndex: 2, done: [])
        #expect(choices.map(\.id) == [tue, mon, thu, sat])
        #expect(choices.map(\.when) == [.missed, .missed, .later, .later])
        #expect(choices.first?.weekday == "Kedd")
        #expect(choices.first?.title == "Pull")
    }

    @Test func aDoneDayAndTodaysOwnDayAreNotOffered() {
        let choices = otherDayChoices(days: days, todayIndex: 2, done: [mon, thu])
        #expect(choices.map(\.id) == [tue, sat])
    }

    @Test func aDayWithoutAnIdCannotBeStartedSoItIsNotOffered() {
        let noId = [BlockDay(id: nil, day: "Kedd", type: "Pull", muscle: "hát", exerciseCount: 5)]
        #expect(otherDayChoices(days: noId, todayIndex: 2, done: []).isEmpty)
    }

    @Test func aDayWithNoExercisesIsARestDaySoItIsNotOffered() {
        let rest = [BlockDay(id: UUID(), day: "Kedd", type: "Pihenő", muscle: "regeneráció", exerciseCount: 0)]
        #expect(otherDayChoices(days: rest, todayIndex: 2, done: []).isEmpty)
    }

    @Test func theServersShortAndLongLabelsBothCount() {
        #expect(TrainWeekdays.index(of: "Ke") == 1)
        #expect(TrainWeekdays.index(of: "Kedd") == 1)
        #expect(TrainWeekdays.index(of: "Pén") == 4)
        #expect(TrainWeekdays.index(of: "Vas") == 6)
        #expect(TrainWeekdays.index(of: "") == nil)
    }

    @Test func aDateIsReadAsItsWeekdayMondayFirst() {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        #expect(TrainWeekdays.index(ofDate: "2026-11-25", calendar: cal) == 2) // a Wednesday
        #expect(TrainWeekdays.index(ofDate: "2026-11-29", calendar: cal) == 6) // a Sunday
        #expect(TrainWeekdays.index(ofDate: "nope", calendar: cal) == nil)
    }

    @Test func theWeeksDoneDaysAreTheTemplateDaysNotTheDates() {
        let week = (from: "2026-11-23", to: "2026-11-29")
        let history = [
            WorkoutHistoryDay(id: UUID(), templateSessionId: tue, date: "2026-11-25", status: .completed, origin: .meso, title: "Pull"),
            WorkoutHistoryDay(id: UUID(), templateSessionId: mon, date: "2026-11-23", status: .active, origin: .meso, title: "Push"),
            WorkoutHistoryDay(id: UUID(), templateSessionId: thu, date: "2026-11-19", status: .completed, origin: .meso, title: "Felsőtest"),
        ]
        let queued = [WorkoutAsPlannedPayload(templateSessionId: sat, date: "2026-11-28", startedAt: Date(), overrides: [])]
        #expect(weekDoneTemplates(history: history, week: week, queued: queued) == [tue, sat])
    }

    @Test func aWorkoutOfAnotherWeekdayIsAnotherDay() {
        let tuesday = TodayWorkout(templateSessionId: tue, dayLabel: "Kedd", title: "Pull")
        #expect(isAnotherDay(tuesday, todayIndex: 2))
        #expect(!isAnotherDay(tuesday, todayIndex: 1))
        #expect(!isAnotherDay(TodayWorkout(dayLabel: "Kedd"), todayIndex: 2))  // a rest day, nothing to start
        #expect(!isAnotherDay(TodayWorkout(templateSessionId: tue, title: "Pull"), todayIndex: 2))
    }

    @Test func theWeekdayIsSaidInFull() {
        #expect(TrainWeekdays.name(1) == "Kedd")
        #expect(TrainWeekdays.adjective(1) == "keddi")
        #expect(TrainWeekdays.adjective(0) == "hétfői")
    }
}
