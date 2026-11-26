import AlarmKit
import BoopCore
import CryptoKit
import Foundation
import SwiftUI

/// What the system lets Boop do with alarms.
enum AlarmAuth: Equatable, Sendable { case allowed, denied, notDetermined }

enum AlarmArmError: Error, Equatable, Sendable {
    /// The system refused: too many alarms (`maximumLimitReached`).
    case limit
    case other(String)
}

/// The few things the reminder scheduler needs from AlarmKit, behind a seam (tests use a fake).
protocol AlarmScheduling: Sendable {
    func authorization() async -> AlarmAuth
    /// Shows the system prompt (once); the resulting state.
    func requestAuthorization() async -> AlarmAuth
    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String) async throws
    /// Cancels every alarm Boop scheduled for this user (AlarmKit ids carry no prefix, so we remember ours).
    func cancelAll(prefix: String) async
    /// The ids (`UUID` strings of `ReminderOccurrence.alarmId`) of the alarms the system currently holds.
    /// nil when the system's list could not be read (an error is not an empty list).
    func scheduledIds() async -> Set<String>?
}

extension ReminderOccurrence {
    /// A stable AlarmKit id for this dated ring (same derivation style as `supplementRef`).
    var alarmId: UUID {
        let d = Array(SHA256.hash(data: Data("boop.rem|\(key)".utf8)))
        return UUID(uuid: (d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11], d[12], d[13], d[14], d[15]))
    }
}

nonisolated struct ReminderAlarmMetadata: AlarmMetadata {}

/// The real thing, over `AlarmManager.shared`. `userKey` scopes the remembered set of our own alarm ids.
struct SystemAlarmScheduler: AlarmScheduling {
    let userKey: String
    private var defaultsKey: String { "boop.rem.alarmIds.\(userKey)" }

    init(userKey: String) { self.userKey = userKey }

    func authorization() async -> AlarmAuth { Self.map(AlarmManager.shared.authorizationState) }

    func requestAuthorization() async -> AlarmAuth {
        guard let state = try? await AlarmManager.shared.requestAuthorization() else { return .denied }
        return Self.map(state)
    }

    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String) async throws {
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: AlarmButton(text: "Leállítom", textColor: .white, systemImageName: "stop.fill"),
            secondaryButton: AlarmButton(text: LocalizedStringResource(stringLiteral: secondaryTitle), textColor: .white, systemImageName: "checkmark"),
            secondaryButtonBehavior: .custom)
        let attrs = AlarmAttributes<ReminderAlarmMetadata>(presentation: AlarmPresentation(alert: alert), metadata: nil, tintColor: .orange)
        // Task 7 wires the intents (stopIntent / secondaryIntent).
        let config = AlarmManager.AlarmConfiguration<ReminderAlarmMetadata>.alarm(
            schedule: .fixed(o.fireAt), attributes: attrs, stopIntent: nil, secondaryIntent: nil)
        let id = o.alarmId
        remember(id.uuidString)
        do {
            _ = try await AlarmManager.shared.schedule(id: id, configuration: config)
        } catch let e as AlarmManager.AlarmError {
            if case .maximumLimitReached = e { throw AlarmArmError.limit }
            throw AlarmArmError.other(e.localizedDescription)
        } catch {
            throw AlarmArmError.other(error.localizedDescription)
        }
    }

    func cancelAll(prefix: String) async {
        let ids = UserDefaults.standard.stringArray(forKey: defaultsKey) ?? []
        for s in ids {
            if let id = UUID(uuidString: s) { try? AlarmManager.shared.cancel(id: id) }
        }
        UserDefaults.standard.removeObject(forKey: defaultsKey)
    }

    func scheduledIds() async -> Set<String>? {
        guard let alarms = try? AlarmManager.shared.alarms else { return nil }
        return Set(alarms.map { $0.id.uuidString })
    }

    private func remember(_ id: String) {
        var ids = Set(UserDefaults.standard.stringArray(forKey: defaultsKey) ?? [])
        ids.insert(id)
        UserDefaults.standard.set(Array(ids).sorted(), forKey: defaultsKey)
    }

    private static func map(_ s: AlarmManager.AuthorizationState) -> AlarmAuth {
        switch s {
        case .authorized: .allowed
        case .denied: .denied
        default: .notDetermined
        }
    }
}

/// Simulator review launches never touch AlarmKit.
struct NoAlarmScheduler: AlarmScheduling {
    func authorization() async -> AlarmAuth { .denied }
    func requestAuthorization() async -> AlarmAuth { .denied }
    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String) async throws {}
    func cancelAll(prefix: String) async {}
    func scheduledIds() async -> Set<String>? { [] }
}
