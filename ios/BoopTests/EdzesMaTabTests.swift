import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Ma tab after the Edzés redesign (mezo-r36n9.197.3, spec 2026-11-27 §5.3): the hero decides which day it is
/// talking about in the same order the old card did, rest and „no plan" have no second page, and a done day offers
/// the result instead of a new start.
struct EdzesMaTabTests {
    private func kind(another: Bool = false, briefSession: Bool = false, briefDone: Bool = false,
                      planWorkout: Bool = false, rest: Bool = false, doneToday: Bool = false) -> MaHeroKind {
        MaHeroKind.resolve(anotherDay: another, briefSession: briefSession, briefDone: briefDone,
                           planWorkout: planWorkout, restDay: rest, doneToday: doneToday)
    }

    @Test func anotherDayWinsOverTodaysSession() {
        #expect(kind(another: true, briefSession: true, planWorkout: true) == .potlas)
        // Once today is done the picked day is history: the hero says what was done.
        #expect(kind(another: true, briefSession: true, doneToday: true) == .done)
        #expect(kind(briefSession: true) == .today)
        #expect(kind(briefSession: true, briefDone: true) == .done)
        // No brief session, but the training plan has one (a brief that has not caught up).
        #expect(kind(planWorkout: true) == .today)
        #expect(kind(planWorkout: true, doneToday: true) == .done)
        #expect(kind(rest: true) == .rest)
        #expect(kind() == .none)
    }

    @Test func restDayHasOnePage() {
        #expect(MaHeroKind.rest.pages(hasLoad: true) == 1)
        #expect(MaHeroKind.none.pages(hasLoad: true) == 1)
        #expect(MaHeroKind.today.pages(hasLoad: true) == 2)
        #expect(MaHeroKind.potlas.pages(hasLoad: true) == 2)
        #expect(MaHeroKind.done.pages(hasLoad: true) == 2)
        // A day whose muscles have not arrived has nothing to show on page 2.
        #expect(MaHeroKind.today.pages(hasLoad: false) == 1)
    }

    @Test func doneDayOffersResultNotStart() {
        #expect(MaHeroPrimary.resolve(.done, running: false, hasResult: true) == .result)
        #expect(MaHeroPrimary.resolve(.done, running: false, hasResult: false) == .none)
        #expect(MaHeroPrimary.resolve(.today, running: false, hasResult: false) == .start)
        #expect(MaHeroPrimary.resolve(.today, running: true, hasResult: false) == .resume)
        #expect(MaHeroPrimary.resolve(.potlas, running: false, hasResult: false) == .start)
        #expect(MaHeroPrimary.resolve(.rest, running: false, hasResult: false) == .none)
        #expect(MaHeroPrimary.resolve(.none, running: false, hasResult: false) == .none)
    }

    @Test func restDayNamesTheNextSession() {
        func day(_ d: String, _ t: String, _ n: Int = 5) -> BlockDay {
            BlockDay(id: UUID(), day: d, type: t, muscle: "", exerciseCount: n, note: nil, isCurrent: false)
        }
        let days = [day("Hétfő", "Felső A"), day("Kedd", "Pihenő", 0), day("Szerda", "Alsó A"), day("Péntek", "Felső B")]
        #expect(maNextSession(days: days, todayIndex: 0)?.type == "Alsó A", "a rest day is skipped")
        #expect(maNextSession(days: days, todayIndex: 1)?.type == "Alsó A")
        #expect(maNextSession(days: days, todayIndex: 5)?.type == "Felső A", "after the week's last day: next Monday")
        #expect(maNextSession(days: [], todayIndex: 1) == nil)
        #expect(maNextSessionLine(days: days, todayIndex: 1) == "Következő: Alsó A · szerda")
    }
}
