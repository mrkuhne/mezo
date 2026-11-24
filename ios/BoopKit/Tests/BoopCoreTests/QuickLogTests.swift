import Foundation
import Testing
@testable import BoopCore

/// The quick log's own arithmetic (`mezo-r36n9.154`): a night's length from the two clock times, and the sports a
/// session can be logged as.
struct QuickLogTests {
    @Test func nightAcrossMidnight() {
        #expect(sleepDurationHours(bedtime: "23:10", wakeup: "06:45") == 7.58)
        #expect(sleepDurationHours(bedtime: "00:30", wakeup: "07:00") == 6.5)
    }

    @Test func napInsideOneDay() {
        #expect(sleepDurationHours(bedtime: "13:00", wakeup: "14:30") == 1.5)
    }

    @Test func sameTimeIsNoNight() {
        #expect(sleepDurationHours(bedtime: "07:00", wakeup: "07:00") == nil)
        #expect(sleepDurationHours(bedtime: "x", wakeup: "07:00") == nil)
    }

    @Test func sportsAreTheServersTenWithHungarianNames() {
        #expect(QuickSport.allCases.map(\.rawValue) == ["volleyball", "cross", "trx", "bike", "swim", "football",
                                                        "basketball", "tennis", "hike", "other"])
        #expect(QuickSport.bike.name == "Kerékpár" && QuickSport.other.name == "Egyéb")
    }
}
