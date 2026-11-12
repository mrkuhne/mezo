import Foundation
import Testing
@testable import BoopCore

struct CheckInSlotTests {
    func moment(_ h: Int, _ m: Int) -> CheckInMoment { CheckInMoment.moment(at: at(h, m), calendar: budapest) }

    @Test func at0959IsReggel() {
        #expect(moment(9, 59) == .reggel)
        #expect(moment(9, 59).slotId == "06:30")
    }
    @Test func at1000IsDelben() {
        #expect(moment(10, 0) == .delben)
        #expect(moment(10, 0).slotId == "10:00")
    }
    @Test func at1430IsStillDelben() { #expect(moment(14, 30) == .delben) }
    @Test func at1431IsDelutan() {
        #expect(moment(14, 31) == .delutan)
        #expect(moment(14, 31).slotId == "14:00")
    }
    @Test func earlyMorningAndLateNightKeepTheirOwnSlots() {
        #expect(moment(0, 5) == .reggel)
        #expect(moment(23, 50) == .delutan)
    }
    /// Only the evening close writes 20:00; no capture moment of the day ever maps there.
    @Test func noInputYieldsTwentyHundred() {
        for minute in 0..<(24 * 60) {
            let slot = moment(minute / 60, minute % 60).slotId
            #expect(slot != "20:00", "minute \(minute)")
        }
        #expect(Set(CheckInMoment.allCases.map(\.slotId)) == ["06:30", "10:00", "14:00"])
    }
}
