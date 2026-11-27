import Testing
import BoopDesign
@testable import Boop

/// The barless home's destinations (`mezo-r36n9.196`, decision #134): an old stored place lands in the right room, and
/// the router hands a destination over exactly once.
struct BoopDestinationTests {
    @Test func restoredOldPlacesMapToRooms() {
        #expect(homeDestination(restored: "ma") == .home)
        #expect(homeDestination(restored: "naplo") == .nap(.napok))
        #expect(homeDestination(restored: "boop") == .chat)
        #expect(homeDestination(restored: "terv") == .room(RoomEntry(.evad)))
        for old in ["Nap", "Edzés", "Fuel", "", "x"] { #expect(homeDestination(restored: old) == .home) }
    }

    @MainActor @Test func routerHandsTheDestinationOnce() {
        let r = RitmusRouter()
        r.go(.chat)
        #expect(r.takeDestination() == .chat)
        #expect(r.takeDestination() == nil)
    }

    @Test func homeAsksForNoRoute() {
        #expect(KezdolapRoute(.home) == nil)
        #expect(KezdolapRoute(.chat) == .chat)
        #expect(KezdolapRoute(.nap(.napok)) == .nap(.napok))
        #expect(KezdolapRoute(.room(RoomEntry(.evad))) == .room(RoomEntry(.evad)))
    }
}
