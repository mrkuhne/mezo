import AlarmKit
import AppIntents
import Foundation
import SwiftUI

/// Throwaway on-device probe (mezo-r36n9.172): does AlarmKit's locked full-screen alert and a custom secondary
/// button intent work on the free team without an extension? Inert unless launched with `-probeAlarm YES`.
nonisolated struct ProbeMetadata: AlarmMetadata {}

struct ProbeDoneIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Kész"
    static let openAppWhenRun = false
    /// Only the alarm runs it: not offered in Shortcuts or Spotlight.
    static let isDiscoverable = false
    func perform() async throws -> some IntentResult {
        UserDefaults.standard.set(Date(), forKey: "probe.doneAt")
        return .result()
    }
}

enum AlarmProbe {
    static func run() async {
        let d = UserDefaults.standard
        guard d.bool(forKey: "probeAlarm") else { return }
        print("PROBE stored doneAt=\(String(describing: d.object(forKey: "probe.doneAt"))) scheduledAt=\(String(describing: d.object(forKey: "probe.scheduledAt")))")
        do {
            let state = try await AlarmManager.shared.requestAuthorization()
            print("PROBE auth=\(state)")
            guard state == .authorized else { return }
            let when = Date().addingTimeInterval(120)
            let alert = AlarmPresentation.Alert(
                title: "Próba-ébresztő",
                stopButton: AlarmButton(text: "Leállítom", textColor: .white, systemImageName: "stop.fill"),
                secondaryButton: AlarmButton(text: "Kész", textColor: .white, systemImageName: "checkmark"),
                secondaryButtonBehavior: .custom)
            let attrs = AlarmAttributes<ProbeMetadata>(presentation: AlarmPresentation(alert: alert), metadata: nil, tintColor: .orange)
            let config = AlarmManager.AlarmConfiguration<ProbeMetadata>.alarm(
                schedule: .fixed(when), attributes: attrs, stopIntent: nil, secondaryIntent: ProbeDoneIntent())
            _ = try await AlarmManager.shared.schedule(id: UUID(), configuration: config)
            d.set(when, forKey: "probe.scheduledAt")
            print("PROBE scheduled for \(when)")
        } catch {
            print("PROBE error=\(error)")
        }
    }
}
