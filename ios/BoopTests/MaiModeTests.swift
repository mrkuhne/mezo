import Foundation
import Testing
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
