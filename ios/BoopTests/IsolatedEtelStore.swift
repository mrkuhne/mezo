import Foundation
@testable import Boop
import BoopCore

/// A store off the process-global `SupplementTickHub`. A bare `EtelStore()` falls through to the hub, which the host
/// app binds when the suites run together: its ticks then go through the app's queue (never the scripted transport)
/// and its taken file is the app's own — tests that pass alone fail in the full run. This one writes directly through
/// the store's own client and keeps its taken state in a temporary file.
@MainActor
extension EtelStore {
    static func isolated(reminders: (@MainActor () -> ReminderStore?)? = nil) -> EtelStore {
        let taken = SupplementTakenStore(fileURL: FileManager.default.temporaryDirectory
            .appendingPathComponent("etel-isolated-\(UUID().uuidString)/supplements-taken.json"))
        let ref = IsolatedStoreRef()
        let store = EtelStore(taken: taken, tick: { daypart, _ in
            guard let store = ref.store, let food = store.currentFood else { throw FoodFetchError.server }
            let ids = try await food.tickGroupIntakes(daypart: daypart)
            taken.markTaken(day: store.ymd, daypart: daypart, ids: ids)
        }, reminders: reminders)
        ref.store = store
        return store
    }
}

@MainActor private final class IsolatedStoreRef { weak var store: EtelStore? }
