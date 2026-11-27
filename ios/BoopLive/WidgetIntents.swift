import AppIntents
import Foundation

// Compiled into BOTH the app and the widget extension, like the workout card's buttons: the widget names the intent by
// type, and as a `LiveActivityIntent` it runs in the app's process (woken in the background if needed), so a tick from
// the widget goes through the same path as the alarm's „Kész” / „Bevettem” — no queue, no App Group.

/// A reminder's tick circle on the „Mai nap” widget (`mezo-r36n9.172`): ticks an open occurrence (a supplement's
/// also logs the intake), opens a ticked one again.
struct WidgetReminderTickIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Kész"
    static let openAppWhenRun = false
    static let isDiscoverable = false

    @Parameter(title: "Alkalom") var key: String
    @Parameter(title: "Kész volt") var wasDone: Bool

    init() { key = ""; wasDone = false }
    init(key: String, wasDone: Bool) { self.key = key; self.wasDone = wasDone }

    func perform() async throws -> some IntentResult {
        #if !BOOP_WIDGETS
        await ReminderActions.widgetTick(key: key, wasDone: wasDone)
        #endif
        return .result()
    }
}
