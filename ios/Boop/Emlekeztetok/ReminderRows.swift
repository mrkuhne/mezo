import BoopCore
import SwiftUI
import BoopDesign

// The pieces the Emlékeztetők page and Ma's fold share: the tick circle, the strength mark, a row of today, the
// line that says what is wrong with a reminder's arming.

/// The round tick of a row: an open ring, or the hue's filled disc with a bare check.
struct ReminderTick: View {
    let done: Bool
    let hue: Hue
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            ZStack {
                if done {
                    Circle().fill(hue.glow)
                    Path { p in
                        p.move(to: CGPoint(x: 11.5, y: 20.5))
                        p.addLine(to: CGPoint(x: 17.5, y: 26.5))
                        p.addLine(to: CGPoint(x: 28, y: 14))
                    }
                    .stroke(NK.ground, style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
                } else {
                    Circle().stroke(.white.opacity(0.5), lineWidth: 1.6)
                }
            }
            .frame(width: 40, height: 40)
            .frame(width: 44, height: 44)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(done ? "Kész, visszavonom" : "Kész")
    }
}

/// ÉBRESZTŐ (filled in the hue) / ÉRTESÍTÉS (outlined): how loud the reminder is.
struct StrengthMark: View {
    let strength: ReminderStrength
    let hue: Hue
    var body: some View {
        let alarm = strength == .alarm
        Text(alarm ? "ÉBRESZTŐ" : "ÉRTESÍTÉS")
            .nkFont(10.5, .medium, design: .monospaced).tracking(1.1)
            .foregroundStyle(.white.opacity(alarm ? 0.92 : 0.6))
            .lineLimit(1).fixedSize()
            .padding(.horizontal, 10).frame(height: 26)
            .background(Capsule().fill(alarm ? hue.glow.opacity(0.32) : .clear))
            .overlay(Capsule().stroke(.white.opacity(alarm ? 0 : 0.22), lineWidth: 1))
            .accessibilityLabel(alarm ? "ébresztő" : "értesítés")
    }
}

/// One occurrence of today: tick · time · title and its second line · strength mark. Done rows are struck through and dim.
struct ReminderTodayRow: View {
    let row: TodayRow
    let today: String
    var arm: ArmState?
    let onTick: () -> Void
    let onOpen: () -> Void

    var body: some View {
        let r = row.reminder
        let hue = ReminderLook.hue(r)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                ReminderTick(done: row.done, hue: hue, action: onTick)
                Button(action: onOpen) {
                    HStack(spacing: 12) {
                        Text(clockLabel(hour: r.hour, minute: r.minute))
                            .font(.nkNumber(27)).monospacedDigit()
                            .foregroundStyle(.white.opacity(row.done ? 0.4 : 0.92))
                            .frame(width: 74, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.title).nkFont(17, .medium).foregroundStyle(.white.opacity(row.done ? 0.45 : 1))
                                .strikethrough(row.done, color: .white.opacity(0.5))
                                .fixedSize(horizontal: false, vertical: true)
                            Text(reminderSubtitle(r, today: today, inToday: true)).nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 4)
                        StrengthMark(strength: r.strength, hue: hue).opacity(row.done ? 0.5 : 1)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            if !row.done { ReminderArmLine(state: arm, reminder: r).padding(.leading, 52) }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .contain)
    }
}

/// The line under a row when its arming is not what the owner asked for.
struct ReminderArmLine: View {
    let state: ArmState?
    let reminder: Reminder
    @Environment(\.openURL) private var openURL

    var body: some View {
        if let text, let state {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(text).nkFont(12.5).foregroundStyle(NK.gold.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                if opensSettings(state) {
                    Button { if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) } } label: {
                        Text("Beállítások").nkFont(12.5, .semibold).foregroundStyle(.white)
                            .padding(.horizontal, 12).frame(minHeight: 30)
                            .background(Capsule().stroke(.white.opacity(0.4)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var text: String? {
        switch state {
        case .fellBackToNotification: reminder.strength == .alarm ? "Ébresztő helyett értesítés — engedélyezd a Beállításokban" : nil
        case .notificationsDenied: "Az értesítések ki vannak kapcsolva — engedélyezd a Beállításokban"
        case .failed(let why): why
        default: nil
        }
    }

    private func opensSettings(_ s: ArmState) -> Bool {
        switch s {
        case .fellBackToNotification, .notificationsDenied: true
        default: false
        }
    }
}

extension ReminderDraft: Identifiable {}

/// The arming state a row shows. On the simulator review launches (`-reminders …`) the states are told, since no
/// real arming happens there.
@MainActor
func reminderArmState(_ r: Reminder) -> ArmState? {
    #if DEBUG
    if let flag = UserDefaults.standard.string(forKey: "reminders") ?? (UserDefaults.standard.bool(forKey: "previewMaReminders") ? "page" : nil) {
        if flag == "denied" {
            switch r.title {
            case "Vitamin": return .fellBackToNotification
            case "Esti magnézium": return .failed("Nem sikerült beállítani az ébresztőt.")
            case "Igyál egy pohár vizet": return .notificationsDenied
            default: return .armed(until: nil)
            }
        }
        return .armed(until: nil)
    }
    #endif
    return ReminderHub.scheduler?.state[r.id]
}
