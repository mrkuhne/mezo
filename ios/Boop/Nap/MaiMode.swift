import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Evening and kímélő mód (spec §10)

/// From 18:00 the Mai turns to the evening: the pills, the paths and the sky (dusk).
func isEvening(_ date: Date, calendar: Calendar = .current) -> Bool {
    calendar.component(.hour, from: date) >= 18
}

/// When the mode next flips: 18:00 today while it is day, midnight while it is evening (after midnight it is day
/// again until 18:00). The page sleeps until then so it turns to the evening, and back, while it stays open.
func nextModeBoundary(after date: Date, calendar: Calendar = .current) -> Date {
    let start = calendar.startOfDay(for: date)
    if !isEvening(date, calendar: calendar), let six = calendar.date(bySettingHour: 18, minute: 0, second: 0, of: start) {
        return six
    }
    return calendar.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(3600)
}

/// Re-reads the clock at each mode boundary and on every return to the foreground (`onTick`). Its own invisible view:
/// reading the scene phase on the page itself can stop presentations.
struct ModeClock: View {
    let onTick: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var wake = 0

    var body: some View {
        Color.clear
            .task(id: wake) {
                let now = BoopClock.now()
                let wait = nextModeBoundary(after: now).timeIntervalSince(now) + 1
                try? await Task.sleep(for: .seconds(max(1, wait)))
                guard !Task.isCancelled else { return }
                onTick()
                wake += 1
            }
            .onChange(of: scenePhase) { _, phase in
                // a suspended app misses its wake-up: look again on return (and sleep afresh from now)
                if phase == .active { onTick(); wake += 1 }
            }
    }
}

/// "Kímélő mód · 2. nap · megfázás" (the reason is left out when the server sends none).
func kimeloBanner(reason: String, day: Int) -> String {
    let r = reason.trimmingCharacters(in: .whitespacesAndNewlines)
    return r.isEmpty ? "Kímélő mód · \(day). nap" : "Kímélő mód · \(day). nap · \(r)"
}

/// The Nap sky for the mood: kímélő's calm outranks the evening's dusk (the Pulzus sky); nil = the selected orb's own.
func maiSky(evening: Bool, recovery: Bool) -> NKSky? {
    if recovery { return .calm }
    if evening { return .hue(.pulzus) }
    return nil
}

/// The bedtime the reminder counts back from: the brief's target; in kímélő mód without one, the early 22:00 the path shows.
func reminderTarget(_ brief: Brief) -> String? {
    brief.day.bedtimeTarget ?? (brief.day.recovery != nil ? "22:00" : nil)
}

/// The bedtime station says when the reminder rings while it is on (spike: "emlékeztető 22:15-kor").
func withReminder(_ steps: [PathStep], time: String?) -> [PathStep] {
    guard let time else { return steps }
    return steps.map { s in
        guard s.id == "bedtime" else { return s }
        let note = "emlékeztető \(time)-kor"
        return PathStep(id: s.id, time: s.time, glyph: s.glyph, title: s.title, sub: s.sub.isEmpty ? note : "\(s.sub) · \(note)",
                        done: s.done, isNow: s.isNow, opens: s.opens)
    }
}

/// The device clock, which simulator review can move: `-previewEvening YES` reads 21:10 today;
/// `-previewPhase reggel|napkozben|este` reads 08:10 / 13:40 / 21:10 today.
enum BoopClock {
    static func now() -> Date {
        #if DEBUG
        let phaseTimes = ["reggel": (8, 10), "napkozben": (13, 40), "este": (21, 10)]
        let hm = UserDefaults.standard.bool(forKey: "previewEvening")
            ? (21, 10) : UserDefaults.standard.string(forKey: "previewPhase").flatMap { phaseTimes[$0] }
        if let hm {
            return Calendar.current.date(bySettingHour: hm.0, minute: hm.1, second: 0, of: Date()) ?? Date()
        }
        #endif
        return Date()
    }
}

/// The kímélő banner under the tabs: heart glyph, "Kímélő mód · N. nap · ok", and *Kilépek* (spike `FrameMaiMode`).
struct KimeloBanner: View {
    let recovery: Brief.Recovery
    let onLeave: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            NKGlyph("heart-cream", .white, size: 14)
            Text(kimeloBanner(reason: recovery.reason, day: recovery.day))
                .nkFont(13.5, .semibold).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.75)
            Button(action: onLeave) {
                Text("Kilépek").nkFont(13, .semibold).foregroundStyle(.white.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).frame(minHeight: 36)
        .glassEffect(.clear, in: .capsule)
    }
}
