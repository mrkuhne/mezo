import BoopDesign
import SwiftUI
import WidgetKit

/// Boop's widget extension (`mezo-r36n9.172`, step 2): the running workout on the Lock Screen and in the Dynamic
/// Island, and the Következő, Mai nap and Lock Screen widgets.
@main
struct BoopWidgetsBundle: WidgetBundle {
    init() { Lagy.registerFonts() }

    var body: some Widget {
        WorkoutLiveActivity()
        NextWidget()
        DayWidget()
        LockWidget()
    }
}
