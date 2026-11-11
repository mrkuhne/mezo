import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

struct MaiModeTests {
    private func at(_ hour: Int, _ minute: Int = 0) -> Date {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c.date(from: DateComponents(year: 2026, month: 11, day: 10, hour: hour, minute: minute))!
    }

    @Test func eveningStartsAtSix() {
        #expect(!isEvening(at(17, 59)))
        #expect(isEvening(at(18)))
        #expect(isEvening(at(23, 30)))
        #expect(!isEvening(at(6)))
        #expect(!isEvening(at(12)))
    }

    @Test func thePhaseClockWakesAtFourTenAndSix() {
        let c = Calendar.current
        let tomorrow = c.date(byAdding: .day, value: 1, to: at(4))!
        #expect(nextPhaseBoundary(after: at(3, 59)) == at(4))
        #expect(nextPhaseBoundary(after: at(9)) == at(10))
        #expect(nextPhaseBoundary(after: at(12)) == at(18))
        #expect(nextPhaseBoundary(after: at(23)) == tomorrow)
        // on a boundary: the next one, never the same instant
        #expect(nextPhaseBoundary(after: at(10)) == at(18))
        #expect(nextPhaseBoundary(after: at(18)) == tomorrow)
        // the phase really changes at each wake-up
        for d in [at(3, 59), at(9), at(12), at(17, 59)] {
            #expect(DayPhase.at(nextPhaseBoundary(after: d)) != DayPhase.at(d))
        }
        // the page sleeps until the nearer of the two
        #expect(nextClockWake(after: at(9)) == at(10))
        #expect(nextClockWake(after: at(23)) == c.date(byAdding: .day, value: 1, to: c.startOfDay(for: at(12))))
    }

    @Test func theModeClockWakesAtTheNextBoundary() {
        let c = Calendar.current
        // day → evening at 18:00 today
        #expect(nextModeBoundary(after: at(17, 59)) == at(18))
        #expect(nextModeBoundary(after: at(6)) == at(18))
        // evening → day at midnight
        #expect(nextModeBoundary(after: at(18, 30)) == c.date(byAdding: .day, value: 1, to: c.startOfDay(for: at(12))))
        #expect(nextModeBoundary(after: at(18)) == c.date(byAdding: .day, value: 1, to: c.startOfDay(for: at(12))))
        // just after midnight it is day again, so the next flip is this evening
        #expect(nextModeBoundary(after: c.startOfDay(for: at(12))) == at(18))
        // every boundary really flips the mode
        for d in [at(17, 59), at(18, 30), at(23, 59)] {
            #expect(isEvening(nextModeBoundary(after: d)) != isEvening(d))
        }
    }

    @Test func kimeloBannerSaysDayAndReason() {
        #expect(kimeloBanner(reason: "megfázás", day: 2) == "Kímélő mód · 2. nap · megfázás")
        #expect(kimeloBanner(reason: "  ", day: 1) == "Kímélő mód · 1. nap")
    }

    @Test func skyFollowsTheMode() {
        #expect(maiSky(evening: false, recovery: false) == nil)        // the selected orb's own sky
        #expect(maiSky(evening: true, recovery: false) == .hue(.pulzus)) // dusk = the Pulzus sky
        #expect(maiSky(evening: false, recovery: true) == .calm)
        #expect(maiSky(evening: true, recovery: true) == .calm)          // kímélő outranks the evening
    }

    @Test func eveningPillsReadTheEveningWords() {
        #expect(soonToast(soonName(.eveningCheckin)) == "Esti check-in · hamarosan")
        #expect(soonName(.windDown) == "Esti levezetés")
    }
}
