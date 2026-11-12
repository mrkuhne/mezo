#if DEBUG
import Foundation
import BoopAPI
import BoopCore

/// Simulator review only (`-preview shell`): the daily loop on a throwaway ledger and outbox, sent through
/// `PreviewTransport` (`-previewOffline YES`: no net, everything stays on the phone). With `-previewOpen checkin…` the
/// clock reads 16:02 today and the day already has a morning and a noon check-in, as in the approved spike.
extension RitmusEnvironment {
    static func preview(client: Client) -> RitmusEnvironment {
        let root = URL.cachesDirectory.appendingPathComponent("boop-preview-ritmus", isDirectory: true)
        try? FileManager.default.removeItem(at: root)
        let opening = UserDefaults.standard.string(forKey: "previewOpen")?.hasPrefix("checkin") == true
        let launched = Date()
        let start = opening ? Calendar.current.date(bySettingHour: 16, minute: 2, second: 0, of: launched) ?? launched : launched
        let ritmus = RitmusClient(client: client, audioDirectory: root.appendingPathComponent("outbox"))
        let env = RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: ritmus,
            line: { date, slot in try await ritmus.checkInLine(date, slot: slot) },
            snapshot: { _ in
                CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50, steps: 7_420, sleepMinutes: 432, source: "com.apple.health")
            },
            plans: nil,
            clock: { start.addingTimeInterval(Date().timeIntervalSince(launched)) })
        env.recorder = PreviewNoteRecorder()
        guard opening else { return env }
        let today = env.today
        let at = { (h: Int, m: Int) in Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: launched) ?? launched }
        try? env.ledger.saveCheckIn(LedgerCheckIn(
            id: UUID(), slot: "06:30", capturedAt: at(7, 20),
            values: ["energy": 7, "mood": 8, "stress": 3, "body": 7, "mental": 8, "rested": 7],
            askedItems: ["energy", "mood", "stress", "body", "mental", "rested"]), date: today)
        try? env.ledger.saveCheckIn(LedgerCheckIn(
            id: UUID(), slot: "10:00", capturedAt: at(12, 40),
            values: ["energy": 6, "mood": 7, "stress": 5, "body": 6, "mental": 6, "hunger": 7],
            askedItems: ["energy", "mood", "stress", "body", "mental", "hunger"],
            note: "Hosszú volt a workshop, kicsit leeresztettem."), date: today)
        env.ledger.cachePlans([CheckInPlanLite(
            slot: "14:00", adaptiveItem: "motivation",
            adaptiveWhy: "Edzésnap van — azt figyelem, a délutáni kedved megjósolja-e, milyen lesz az edzés.")], date: today)
        return env
    }
}

/// Pretends to listen for a moment, then "hears" one invented sentence.
@MainActor
final class PreviewNoteRecorder: VoiceNoteRecorder {
    func start() throws {}
    func stop() async -> String? {
        try? await Task.sleep(for: .milliseconds(700))
        return "A második megbeszélés után teljesen leeresztettem."
    }
}
#endif
