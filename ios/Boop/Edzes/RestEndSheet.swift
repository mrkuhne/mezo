import BoopDesign
import SwiftUI

/// „Pihenő vége": what rings on a locked phone when the rest ends (spec D5, the approved shot 11).
struct RestEndSheet: View {
    let hue: Hue
    let userKey: String
    var onChanged: () -> Void = {}
    private let alarms: AlarmScheduling
    @State private var mode: RestEndMode
    @State private var denied = false

    init(hue: Hue, userKey: String, alarms: AlarmScheduling = SystemAlarmScheduler(), onChanged: @escaping () -> Void = {}) {
        self.hue = hue; self.userKey = userKey; self.alarms = alarms; self.onChanged = onChanged
        _mode = State(initialValue: RestEndMode.load(userKey: userKey))
    }

    var body: some View {
        NKSheetFrame(hue: hue, eyebrow: "Edzés · beállítások", title: "Pihenő vége") {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Mi szóljon, ha lezárt telefonnál lejár a pihenő?")
                        .nkFont(15).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                    card(.vibrate, "Rezgés és rövid hang", "Alapból ez. Némított telefonon csak rezeg.")
                    card(.alarm, "Ébresztő", "Mint egy időzítő: egész képernyő, némításon is szól. Zsebben is észreveszed.")
                }
                .workoutCard(h: 8, v: 6)
                if denied {
                    Text("Az ébresztő nincs engedélyezve — a Beállításokban kapcsolhatod be.")
                        .nkFont(13).foregroundStyle(hue.glow)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text("Ha nyitva van az edzés a képernyőn, nem szól semmi — ott látod a számlálót.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 4)
            }
        }
        .presentationDetents([.large])
    }

    private func card(_ m: RestEndMode, _ title: String, _ sub: String) -> some View {
        let on = mode == m
        return Button { choose(m) } label: {
            HStack(alignment: .top, spacing: 14) {
                ZStack {
                    Circle().strokeBorder(.white.opacity(0.7), lineWidth: 2).frame(width: 28, height: 28)
                    if on { Circle().fill(hue.glow).frame(width: 14, height: 14) }
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).nkFont(17, .semibold).foregroundStyle(.white)
                    Text(sub).nkFont(14).foregroundStyle(.white.opacity(0.65))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18).fill(.white.opacity(on ? 0.12 : 0.06)))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(on ? hue.glow.opacity(0.8) : .clear, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .frameProbe("restend.\(title)")
    }

    private func choose(_ m: RestEndMode) {
        guard m != mode else { return }
        guard m == .alarm else { denied = false; commit(.vibrate); return }
        Task {
            var auth = await alarms.authorization()
            if auth == .notDetermined { auth = await alarms.requestAuthorization() }
            if auth == .allowed { denied = false; commit(.alarm) } else { denied = true; commit(.vibrate) }
        }
    }

    private func commit(_ m: RestEndMode) {
        mode = m
        RestEndMode.save(m, userKey: userKey)
        onChanged()
    }
}
