import Foundation
import Observation
import os

/// Everything persisted for one user's reminders.
public struct ReminderFile: Codable, Equatable, Sendable {
    public var reminders: [Reminder]
    public var done: Set<String>
    public var builtIn: BoopReminderSettings
    /// What the page says once (the titles of linked reminders removed with their supplement group); nil = nothing.
    public var notices: [String]?

    public init(reminders: [Reminder] = [], done: Set<String> = [], builtIn: BoopReminderSettings = BoopReminderSettings(),
                notices: [String]? = nil) {
        self.reminders = reminders
        self.done = done
        self.builtIn = builtIn
        self.notices = notices
    }
}

/// Per-user reminder persistence (one JSON file). Synchronous I/O: the file is tiny.
@MainActor @Observable
public final class ReminderStore {
    public private(set) var file: ReminderFile
    /// Bumped on every write; the scheduler observes it.
    public private(set) var changes = 0
    /// The file on disk could not be read at launch: it was copied to `reminders.json.corrupt` and the list starts empty.
    public private(set) var recoveredFromCorrupt = false

    @ObservationIgnored private let fileURL: URL
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private let calendar: Calendar
    /// False when an unreadable file could not be copied aside: then nothing is written over it.
    @ObservationIgnored private var writable = true
    private static let log = Logger(subsystem: "hu.mezo.boop", category: "ReminderStore")

    public init(fileURL: URL, clock: @escaping @Sendable () -> Date = Date.init, calendar: Calendar? = nil) {
        self.fileURL = fileURL
        self.clock = clock
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = TimeZone.current
        self.calendar = calendar ?? greg
        switch Self.load(fileURL) {
        case .missing: file = ReminderFile()
        case .file(let f): file = f
        case .unreadable(let data):
            file = ReminderFile()
            recoveredFromCorrupt = true
            writable = keepAside(data)
        }
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

    /// A supplement group is gone (a successfully loaded protocol without it): its linked reminder goes too, and the page
    /// says so once. An empty `dayparts` (nothing loaded, offline, an empty list) never deletes anything.
    public func removeLinked(keeping dayparts: Set<String>) {
        guard !dayparts.isEmpty else { return }
        let gone = file.reminders.filter { r in
            if case .supplement(let d) = r.link { !dayparts.contains(d) } else { false }
        }
        guard !gone.isEmpty else { return }
        let ids = Set(gone.map(\.id))
        file.reminders.removeAll { ids.contains($0.id) }
        file.notices = (file.notices ?? []) + gone.map(\.title)
        write()
    }

    /// The page has said it.
    public func clearNotices() {
        guard file.notices != nil else { return }
        file.notices = nil
        write()
    }

    public func reminder(linkedTo daypart: String) -> Reminder? {
        file.reminders.first { $0.link == .supplement(daypart: daypart) }
    }

    /// Re-read the file (another process may have written ticks). Keeps the current state if unreadable.
    public func reload() {
        switch Self.load(fileURL) {
        case .file(let f) where f != file:
            file = f
            changes += 1
        case .unreadable(let data):
            // the memory stays authoritative; the bytes on disk are kept before any write replaces them
            if keepAside(data) { writable = true }
        default: break
        }
    }

    private enum Loaded { case missing, file(ReminderFile), unreadable(Data) }

    private static func load(_ url: URL) -> Loaded {
        guard let data = try? Data(contentsOf: url) else { return .missing }
        guard let f = try? JSONDecoder().decode(ReminderFile.self, from: data) else { return .unreadable(data) }
        return .file(f)
    }

    /// Copies an unreadable file's bytes to `reminders.json.corrupt` (never silently lost). False when that failed.
    private func keepAside(_ data: Data) -> Bool {
        let copy = fileURL.appendingPathExtension("corrupt")
        do {
            try data.write(to: copy, options: [.atomic])
            Self.log.error("reminders file unreadable — kept aside as \(copy.lastPathComponent, privacy: .public), starting empty")
            return true
        } catch {
            Self.log.error("reminders file unreadable and could not be kept aside: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    private func write() {
        guard writable else {
            Self.log.error("not writing over an unreadable reminders file that could not be kept aside")
            return
        }
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
            // Best effort: in-memory state stays authoritative for this run; nothing new reached the disk, so no bump.
            Self.log.error("could not write reminders: \(error.localizedDescription, privacy: .public)")
            return
        }
        changes += 1
    }

    /// Drops done keys whose day is older than 14 local days (and unparseable keys).
    private func prune() {
        let cal = calendar
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
