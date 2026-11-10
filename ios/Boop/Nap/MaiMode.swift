import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Evening and kímélő mód (spec §10)

/// From 18:00 the Mai turns to the evening: the pills, the paths and the sky (dusk).
func isEvening(_ date: Date, calendar: Calendar = .current) -> Bool {
    calendar.component(.hour, from: date) >= 18
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

/// The device clock, which simulator review can move: `-previewEvening YES` reads 21:10 today.
enum BoopClock {
    static func now() -> Date {
        #if DEBUG
        if UserDefaults.standard.bool(forKey: "previewEvening") {
            return Calendar.current.date(bySettingHour: 21, minute: 10, second: 0, of: Date()) ?? Date()
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
