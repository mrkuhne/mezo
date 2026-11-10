import Testing
import BoopCore
@testable import Boop

struct NapCopyTests {
    @Test func learningCountsTheNights() {
        let c = napCopy(.learning(nights: 9))
        #expect(c.orb == "9 / 14")
        #expect(c.title == "Még tanulom a ritmusod")
        #expect(c.action == nil)
    }
    @Test func onlyNotConnectedAndOfflineHaveAnAction() {
        #expect(napCopy(.notConnected).action == "Összekötöm")
        #expect(napCopy(.offline).action == "Újra próbálom")
        #expect(napCopy(.ready).action == nil)
    }
    @Test func copyIsBoopNeverMezo() {
        for s in [NapEmptyState.notConnected, .syncing(progress: 0.5), .learning(nights: 3), .noCalendar, .offline, .ready] {
            let c = napCopy(s)
            #expect(!(c.title + c.sentence + c.caps).contains("Mezo"))
        }
    }
    @Test func failedSyncOffersARetry() {
        let c = napCopy(.syncFailed)
        #expect(c.title == "Nem sikerült frissíteni")
        #expect(c.action == "Újra próbálom")
    }
}
