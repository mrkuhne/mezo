import BoopDesign
import SwiftUI
import WidgetKit

/// Boop's widget extension (`mezo-r36n9.172`, step 2): for now the running workout on the Lock Screen and in the
/// Dynamic Island. The home-screen widgets join here.
@main
struct BoopWidgetsBundle: WidgetBundle {
    init() { Lagy.registerFonts() }

    var body: some Widget {
        WorkoutLiveActivity()
        ProbeWidget()
    }
}
