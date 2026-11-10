import SwiftUI
import BoopCore
import BoopDesign

@main
struct BoopApp: App {
    @State private var session = Session()
    init() {
        Lagy.registerFonts()
        ReminderPresenter.install()     // the bedtime reminder also shows while Boop is open
    }
    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .task {
                    #if DEBUG
                    if let p = UserDefaults.standard.string(forKey: "preview") { session.debugPreview(p); return }
                    #endif
                    await session.bootstrap()
                }
        }
    }
}
