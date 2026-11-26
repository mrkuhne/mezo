import AppIntents
import Foundation
import os

private let intentLog = Logger(subsystem: "hu.mezo.boop", category: "ReminderIntents")

/// The alarm's „Kész” / „Bevettem” button: ticks the occurrence without opening the app.
struct ReminderDoneIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Kész"
    static let openAppWhenRun = false
    /// Only the alarm runs it: not offered in Shortcuts or Spotlight.
    static let isDiscoverable = false

    @Parameter(title: "Alkalom") var key: String

    init() { key = "" }
    init(key: String) { self.key = key }

    func perform() async throws -> some IntentResult {
        await ReminderActions.done(key: key)
        return .result()
    }
}

/// The alarm's stop button: silences it and does nothing else — silencing is not "done" (spec D8).
struct ReminderSilenceIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Leállítom"
    static let openAppWhenRun = false
    /// Only the alarm runs it: not offered in Shortcuts or Spotlight.
    static let isDiscoverable = false

    init() {}

    func perform() async throws -> some IntentResult {
        intentLog.info("alarm silenced")
        return .result()
    }
}
