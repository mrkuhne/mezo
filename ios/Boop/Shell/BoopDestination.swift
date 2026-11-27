import SwiftUI
import BoopDesign

/// A room the ring opens, with the tab (and sub-page) it should open on; nil = the room's own default.
struct RoomEntry: Equatable {
    let hue: Hue
    var tab: String? = nil
    var sub: String? = nil
    init(_ hue: Hue, tab: String? = nil, sub: String? = nil) { self.hue = hue; self.tab = tab; self.sub = sub }
}

/// Where the barless home can send him (`mezo-r36n9.196`, decision #134): the ring itself, the Nap room on one of its
/// tabs, any area room, or Boop's chat. There are no places any more — everything is a room opened from the ring.
enum BoopDestination: Equatable {
    case home
    case nap(NapTab)
    case room(RoomEntry)
    case chat
}

/// The pre-barless scene key (`@SceneStorage("tab")`) read once on launch: "ma"/unknown → the ring, "naplo" → the
/// Nap room's Napok tab, "boop" → the chat, "terv" (Évad's old key) → the Évad room.
func homeDestination(restored raw: String) -> BoopDestination {
    switch raw {
    case "naplo": .nap(.napok)
    case "boop": .chat
    case "terv": .room(RoomEntry(.evad))
    default: .home
    }
}

/// Lets any page send him somewhere else (a „Kérdezd meg Boopot" row → the chat, the Ma wall's Évad card → the Évad
/// room). The shell routes it through `RitmusRouter`, and the ring opens it.
private struct OpenDestinationKey: EnvironmentKey {
    static let defaultValue: @MainActor @Sendable (BoopDestination) -> Void = { _ in }
}
extension EnvironmentValues {
    var openDestination: @MainActor @Sendable (BoopDestination) -> Void {
        get { self[OpenDestinationKey.self] }
        set { self[OpenDestinationKey.self] = newValue }
    }
}
