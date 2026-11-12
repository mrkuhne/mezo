#if DEBUG
import Foundation
import BoopAPI
import BoopCore

/// Simulator review only (`-preview shell`): the daily loop on a throwaway ledger and outbox, sent through
/// `PreviewTransport` (`-previewOffline YES`: no net, everything stays on the phone). With `-previewOpen checkin…` the
/// clock reads 16:02 today, with `-previewOpen este|esteDone` 21:32 and the day has its goal (esteDone: already closed,
/// with a journal line); then, and with `-previewPhase napkozben|este`, the day already has a morning and a noon
/// check-in, as in the approved spike. Invented calendar events and past goals feed the goal chips.
extension RitmusEnvironment {
    static func preview(client: Client) -> RitmusEnvironment {
        let root = URL.cachesDirectory.appendingPathComponent("boop-preview-ritmus", isDirectory: true)
        try? FileManager.default.removeItem(at: root)
        let open = UserDefaults.standard.string(forKey: "previewOpen") ?? ""
        let opening = open.hasPrefix("checkin")
        let closing = open.hasPrefix("este")
        let laterInTheDay = ["napkozben", "este"].contains(UserDefaults.standard.string(forKey: "previewPhase") ?? "")
        let launched = Date()
        let start = opening ? Calendar.current.date(bySettingHour: 16, minute: 2, second: 0, of: launched) ?? launched
            : closing ? Calendar.current.date(bySettingHour: 21, minute: 32, second: 0, of: launched) ?? launched : launched
        let ritmus = RitmusClient(client: client, audioDirectory: root.appendingPathComponent("outbox"))
        let env = RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: ritmus,
            line: { date, slot in try await ritmus.checkInLine(date, slot: slot) },
            snapshot: { _ in
                CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50, steps: 7_420, sleepMinutes: 432, source: "com.apple.health")
            },
            plans: nil,
            goals: { dates in
                // "Meal prep a hétre" typed 8 and 15 days ago → "8 napja nem volt"
                Dictionary(uniqueKeysWithValues: dates.enumerated().map { k, d in (d, k == 7 || k == 14 ? ["Meal prep a hétre"] : []) })
            },
            events: { day in
                let at = { (h: Int, m: Int) in Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: day) ?? day }
                return [CalendarEventLite(title: "Heti egyeztetés", start: at(10, 0), end: at(10, 30), attendees: 3),
                        CalendarEventLite(title: "Ügyfélprezentáció", start: at(14, 0), end: at(15, 30), attendees: 5)]
            },
            closeLine: { date in try await ritmus.line(date) },
            transcribe: { file in try await ritmus.transcribe(file) },
            clock: { start.addingTimeInterval(Date().timeIntervalSince(launched)) })
        env.recorder = PreviewNoteRecorder(directory: root.appendingPathComponent("outbox"))
        // The Boop tab: `-previewOpen chatAnswer` has one answered question, `chatQueued` (with `-previewOffline YES`)
        // one question waiting for the net.
        env.attachChat(client: client, sender: ritmus)
        env.online = !UserDefaults.standard.bool(forKey: "previewOffline")
        if open == "chatQueued", let chat = env.chat {
            Task { await chat.ask("Mennyit egyek a röpi előtt?", online: env.online) }
        }
        guard opening || closing || laterInTheDay else { return env }
        let today = env.today
        let at = { (h: Int, m: Int) in Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: launched) ?? launched }
        try? env.ledger.saveCheckIn(LedgerCheckIn(
            id: UUID(), slot: "06:30", capturedAt: at(7, 20),
            values: ["energy": 7, "mood": 8, "stress": 3, "body": 7, "mental": 8, "rested": 7],
            askedItems: ["energy", "mood", "stress", "body", "mental", "rested"],
            snapshot: CheckInSnapshotValue(hrBpm: 61, hrvMs: 52, hrvUsualMs: 50, steps: 320, sleepMinutes: 432)), date: today)
        try? env.ledger.saveCheckIn(LedgerCheckIn(
            id: UUID(), slot: "10:00", capturedAt: at(12, 40),
            values: ["energy": 6, "mood": 7, "stress": 5, "body": 6, "mental": 6, "hunger": 7],
            askedItems: ["energy", "mood", "stress", "body", "mental", "hunger"],
            note: "Hosszú volt a workshop, kicsit leeresztettem.",
            snapshot: CheckInSnapshotValue(hrBpm: 74, hrvMs: 41, hrvUsualMs: 50, steps: 4_860, sleepMinutes: 432)), date: today)
        env.ledger.cachePlans([CheckInPlanLite(
            slot: "14:00", adaptiveItem: "motivation",
            adaptiveWhy: "Edzésnap van — azt figyelem, a délutáni kedved megjósolja-e, milyen lesz az edzés.")], date: today)
        if closing {
            try? env.ledger.setGoal(LedgerGoal(id: UUID(), text: "Ügyfélprezentáció 14:00", setAt: at(7, 40)), date: today)
        }
        if open == "esteDone" {
            let journalId = UUID()
            try? env.ledger.addJournal(LedgerJournal(
                id: journalId, capturedAt: at(21, 33),
                text: "Jól ment a prezentáció, a röpi után kellemesen elfáradtam. A vacsora kicsit késő lett."), date: today)
            try? env.ledger.setClose(LedgerClose(
                id: UUID(), capturedAt: at(21, 33), eveningEnergy: 4, dayRating: 4, goalText: "Ügyfélprezentáció 14:00",
                goalOutcome: "done", journalId: journalId,
                pending: UserDefaults.standard.bool(forKey: "previewOffline"),
                planGoals: [PlanGoalPayload(id: "protein", title: "150 g fehérje", result: "152 g", met: true),
                            PlanGoalPayload(id: "session", title: "Vállak és hát · 18:30", result: "62 perc · pulzus átl. 128", met: true),
                            PlanGoalPayload(id: "bedtime", title: "Lefekvés 22:30", result: "", met: nil)]), date: today)
        }
        return env
    }
}

/// Pretends to listen for a moment, then "hears" one invented sentence; with `-previewOffline YES` it keeps a (fake)
/// recording instead, as a phone without on-device Hungarian would.
@MainActor
final class PreviewNoteRecorder: VoiceNoteRecorder {
    let directory: URL
    init(directory: URL) { self.directory = directory }
    var transcribesOnDevice: Bool { !UserDefaults.standard.bool(forKey: "previewOffline") }
    let speechDenied = false
    func start() async throws {}
    func stop() async -> VoiceCapture? {
        try? await Task.sleep(for: .milliseconds(700))
        guard transcribesOnDevice else {
            let name = "voice-preview-\(UUID().uuidString).m4a"
            try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try? Data("preview".utf8).write(to: directory.appendingPathComponent(name))
            return .recording(fileName: name)
        }
        return .transcript("A második megbeszélés után teljesen leeresztettem.")
    }
    func discard(_ capture: VoiceCapture) {
        if case .recording(let name) = capture { try? FileManager.default.removeItem(at: directory.appendingPathComponent(name)) }
    }
}
#endif
