import SwiftUI
import BoopCore
import BoopDesign

@main
struct BoopApp: App {
    @State private var session = Session()
    @UIApplicationDelegateAdaptor(BoopAppDelegate.self) private var appDelegate
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
                    await Self.debugNotify()
                    if let p = UserDefaults.standard.string(forKey: "preview") { session.debugPreview(p); return }
                    #endif
                    await session.bootstrap()
                }
        }
    }

    #if DEBUG
    /// Simulator review: `-previewNotify checkin|este` rings the real daily-loop reminder (through the real centre, with its
    /// route) at the next whole minute, so a tap on it can be checked, also from a cold launch.
    @MainActor private static func debugNotify() async {
        guard let route = UserDefaults.standard.string(forKey: "previewNotify") else { return }
        let center = SystemReminderCenter()
        var allowed = await center.status() == .allowed
        if !allowed { allowed = await center.request() }
        guard allowed else { return }
        let soon = Date().addingTimeInterval(65)
        let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: soon)
        let moment = CheckInMoment.moment(at: soon)
        try? await center.scheduleOnce(
            id: "boop.ritmus.debug", on: DateComponents(year: c.year, month: c.month, day: c.day), hour: c.hour ?? 0, minute: c.minute ?? 0,
            title: route == "este" ? RitmusReminders.closeTitle : RitmusReminders.checkInTitle(moment),
            body: route == "este" ? RitmusReminders.closeBody : RitmusReminders.checkInBody, route: "boop://\(route)")
    }
    #endif
}
