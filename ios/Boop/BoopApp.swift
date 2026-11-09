import SwiftUI
import BoopCore
import BoopDesign

@main
struct BoopApp: App {
    @State private var session = Session()
    init() { Lagy.registerFonts() }
    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .task { await session.bootstrap() }
        }
    }
}
