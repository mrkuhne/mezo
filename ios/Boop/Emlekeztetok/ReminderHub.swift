import BoopCore

/// Az bejelentkezett felhasználó emlékeztető-tárának app-szintű elérési pontja (a RootView állítja be és törli be-/kijelentkezéskor).
/// Amíg nincs tár, a beépített emlékeztetők az alapértékekkel dolgoznak.
@MainActor
enum ReminderHub {
    static var store: ReminderStore?
}
