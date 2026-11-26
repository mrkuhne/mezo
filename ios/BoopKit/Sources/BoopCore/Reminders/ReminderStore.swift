import Foundation
import Observation

/// Everything persisted for one user's reminders.
public struct ReminderFile: Codable, Equatable, Sendable {
    public var reminders: [Reminder]
    public var done: Set<String>
    public var builtIn: BoopReminderSettings

    public init(reminders: [Reminder] = [], done: Set<String> = [], builtIn: BoopReminderSettings = BoopReminderSettings()) {
        self.reminders = reminders
        self.done = done
        self.builtIn = builtIn
    }
}

/// Per-user reminder persistence (one JSON file). Synchronous I/O: the file is tiny.
@MainActor @Observable
public final class ReminderStore {
    public private(set) var file: ReminderFile
    /// Bumped on every write; the scheduler observes it.
    public private(set) var changes = 0

    @ObservationIgnored private let fileURL: URL
    @ObservationIgnored private let clock: @Sendable () -> Date

    public init(fileURL: URL, clock: @escaping @Sendable () -> Date = Date.init) {
        self.fileURL = fileURL
        self.clock = clock
        self.file = Self.read(fileURL) ?? ReminderFile()
    }

    public func upsert(_ r: Reminder) {
        if let i = file.reminders.firstIndex(where: { $0.id == r.id }) {
            file.reminders[i] = r
        } else {
            file.reminders.append(r)
        }
        write()
    }

    public func delete(_ id: UUID) {
        file.reminders.removeAll { $0.id == id }
        write()
    }

    public func tick(_ key: String) {
        file.done.insert(key)
        write()
    }

    public func untick(_ key: String) {
        file.done.remove(key)
        write()
    }

    public func setBuiltIn(_ s: BoopReminderSettings) {
        file.builtIn = s
        write()
    }

    public func reminder(linkedTo daypart: String) -> Reminder? {
        file.reminders.first { $0.link == .supplement(daypart: daypart) }
    }

    /// Re-read the file (another process may have written ticks). Keeps the current state if unreadable.
    public func reload() {
        if let f = Self.read(fileURL) {
            file = f
            changes += 1
        }
    }

    private static func read(_ url: URL) -> ReminderFile? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(ReminderFile.self, from: data)
    }

    private func write() {
        prune()
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let enc = JSONEncoder()
            enc.outputFormatting = [.sortedKeys]
            let data = try enc.encode(file)
            #if os(iOS)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            #else
            try data.write(to: fileURL, options: [.atomic])
            #endif
        } catch {
            // Best effort: in-memory state stays authoritative for this run.
        }
        changes += 1
    }

    /// Drops done keys whose day is older than 14 local days (and unparseable keys).
    private func prune() {
        let cal = Calendar.current
        let today = cal.startOfDay(for: clock())
        guard let cutoff = cal.date(byAdding: .day, value: -14, to: today) else { return }
        file.done = file.done.filter { key in
            guard let day = key.split(separator: "|").last else { return false }
            let p = day.split(separator: "-").compactMap { Int($0) }
            guard p.count == 3, let d = cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return false }
            return d >= cutoff
        }
    }
}
