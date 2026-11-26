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
    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String, tint: Color) async throws
    /// Cancels one alarm by its id (`UUID` string). Which ids are Boop's is remembered by `AlarmIdBook` (AlarmKit ids
    /// carry no prefix).
    func cancel(id: String) async
    /// Ends a ringing alarm (its full-screen alert goes away). The alarm's own „Kész” / „Bevettem” button runs in the
    /// background and does not dismiss the alert by itself: its intent calls this.
    func stop(id: String) async
    /// The ids (`UUID` strings of `ReminderOccurrence.alarmId`) of the alarms the system currently holds.
    /// nil when the system's list could not be read (an error is not an empty list).
    func scheduledIds() async -> Set<String>?
    /// The ids of the alarms ringing right now: a refresh never cancels one of these (only the owner silences it).
    func alertingIds() async -> Set<String>
    /// The workout's rest end as a one-off alarm at `at` (one at a time: a second call replaces the first). Not part of
    /// the reminder family: the reminder scheduler never touches it.
    func scheduleRest(at: Date, title: String, tint: Color) async throws
    func cancelRest() async
}

extension AlarmScheduling {
    func stop(id: String) async {}
    func scheduleRest(at: Date, title: String, tint: Color) async throws {}
    func cancelRest() async {}
}

extension ReminderOccurrence {
    /// A stable AlarmKit id for this dated ring (same derivation style as `supplementRef`).
    var alarmId: UUID { Self.alarmId(forKey: key) }

    /// The AlarmKit id of the ring with this occurrence key (what the alarm's button carries).
    static func alarmId(forKey key: String) -> UUID {
        let d = Array(SHA256.hash(data: Data("boop.rem|\(key)".utf8)))
        return UUID(uuid: (d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11], d[12], d[13], d[14], d[15]))
    }
}

nonisolated struct ReminderAlarmMetadata: AlarmMetadata {}

/// The real thing, over `AlarmManager.shared`. Stateless: which ids are ours is kept by `AlarmIdBook`.
struct SystemAlarmScheduler: AlarmScheduling {
    init() {}

    func authorization() async -> AlarmAuth { Self.map(AlarmManager.shared.authorizationState) }

    func requestAuthorization() async -> AlarmAuth {
        guard let state = try? await AlarmManager.shared.requestAuthorization() else { return .denied }
        return Self.map(state)
    }

    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String, tint: Color) async throws {
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: AlarmButton(text: "Leállítom", textColor: .white, systemImageName: "stop.fill"),
            secondaryButton: AlarmButton(text: LocalizedStringResource(stringLiteral: secondaryTitle), textColor: .white, systemImageName: "checkmark"),
            secondaryButtonBehavior: .custom)
        let attrs = AlarmAttributes<ReminderAlarmMetadata>(presentation: AlarmPresentation(alert: alert), metadata: nil, tintColor: tint)
        let config = AlarmManager.AlarmConfiguration<ReminderAlarmMetadata>.alarm(
            schedule: .fixed(o.fireAt), attributes: attrs, stopIntent: ReminderSilenceIntent(), secondaryIntent: ReminderDoneIntent(key: o.key))
        let id = o.alarmId
        do {
            _ = try await AlarmManager.shared.schedule(id: id, configuration: config)
        } catch let e as AlarmManager.AlarmError {
            if case .maximumLimitReached = e { throw AlarmArmError.limit }
            throw AlarmArmError.other(e.localizedDescription)
        } catch {
            throw AlarmArmError.other(error.localizedDescription)
        }
    }

    /// One fixed id: the rest alarm is replaced, never stacked.
    static let restAlarmId = UUID(uuidString: "B00B0000-0000-4000-8000-0000000000E5")!

    func scheduleRest(at: Date, title: String, tint: Color) async throws {
        try? AlarmManager.shared.cancel(id: Self.restAlarmId)
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: AlarmButton(text: "Leállítom", textColor: .white, systemImageName: "stop.fill"))
        let attrs = AlarmAttributes<ReminderAlarmMetadata>(presentation: AlarmPresentation(alert: alert), metadata: nil, tintColor: tint)
        let config = AlarmManager.AlarmConfiguration<ReminderAlarmMetadata>.alarm(
            schedule: .fixed(at), attributes: attrs, stopIntent: ReminderSilenceIntent())
        do {
            _ = try await AlarmManager.shared.schedule(id: Self.restAlarmId, configuration: config)
        } catch {
            throw AlarmArmError.other(error.localizedDescription)
        }
    }

    func cancelRest() async { try? AlarmManager.shared.cancel(id: Self.restAlarmId) }

    func cancel(id: String) async {
        if let id = UUID(uuidString: id) { try? AlarmManager.shared.cancel(id: id) }
    }

    func stop(id: String) async {
        guard let id = UUID(uuidString: id) else { return }
        do { try AlarmManager.shared.stop(id: id) } catch { try? AlarmManager.shared.cancel(id: id) }
    }

    func scheduledIds() async -> Set<String>? {
        guard let alarms = try? AlarmManager.shared.alarms else { return nil }
        return Set(alarms.map { $0.id.uuidString })
    }

    func alertingIds() async -> Set<String> {
        guard let alarms = try? AlarmManager.shared.alarms else { return [] }
        return Set(alarms.filter { if case .alerting = $0.state { true } else { false } }.map { $0.id.uuidString })
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
    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String, tint: Color) async throws {}
    func cancel(id: String) async {}
    func scheduledIds() async -> Set<String>? { [] }
    func alertingIds() async -> Set<String> { [] }
}

/// The alarms Boop armed for one user and what each was armed as (a fingerprint of its moment and words): AlarmKit ids
/// carry no prefix, so ours are remembered here, per user (`boop.rem.alarms.<userKey>`). MainActor-isolated: every change
/// is one synchronous read-modify-write, so two schedulers of the same user (the UI's and a headless one) never lose each
/// other's ids — a forgotten id would be an alarm nobody can cancel.
@MainActor
final class AlarmIdBook {
    private let defaults: UserDefaults?
    private let key: String
    private var memory: [String: String] = [:]

    init(userKey: String, defaults: UserDefaults = .standard) {
        self.defaults = defaults
        key = "boop.rem.alarms.\(userKey)"
        // the first version kept a bare list of ids: they are still ours (no fingerprint, so they are re-armed once)
        let legacy = "boop.rem.alarmIds.\(userKey)"
        if let old = defaults.stringArray(forKey: legacy) {
            var e = entries
            for id in old where e[id] == nil { e[id] = "" }
            defaults.set(e, forKey: key)
            defaults.removeObject(forKey: legacy)
        }
    }

    private init() { defaults = nil; key = "" }

    /// A book that lives only as long as this object (tests, previews).
    static func inMemory() -> AlarmIdBook { AlarmIdBook() }

    /// id → fingerprint of what it was armed as.
    var entries: [String: String] {
        guard let defaults else { return memory }
        return defaults.dictionary(forKey: key) as? [String: String] ?? [:]
    }

    func remember(_ id: String, fingerprint: String) {
        var e = entries
        e[id] = fingerprint
        store(e)
    }

    func forget(_ id: String) {
        var e = entries
        guard e.removeValue(forKey: id) != nil else { return }
        store(e)
    }

    private func store(_ e: [String: String]) {
        if let defaults { defaults.set(e, forKey: key) } else { memory = e }
    }
}
