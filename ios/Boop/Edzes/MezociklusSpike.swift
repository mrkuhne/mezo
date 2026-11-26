import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY SPIKE (mezo-r36n9.177) — the Mezociklus tab's card, the „Összes mezociklusom" page, the confirmations and
// the zárójelentés on invented data. Not wired to the server. Branch `spike/boop-mezociklus`.

/// The running mezociklus at the top of the tab: where he is, and what he can do with it.
struct MezoCurrentCardSpike: View {
    let block: BlockPlan
    let hue: Hue
    let onEdit: () -> Void
    let onRestart: () -> Void
    let onClose: () -> Void
    let onSaveTemplate: () -> Void

    var body: some View {
        NKBare("A MEZOCIKLUSOD", hue: hue, glyph: "cycle-ink") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(block.title).nkFont(22, .semibold).foregroundStyle(.white)
                        Text("\(block.currentWeek). hét a \(block.weeks)-ból · \(block.split)")
                            .nkFont(13).foregroundStyle(.white.opacity(0.65))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Menu {
                        Button { onSaveTemplate() } label: { Label("Mentés a sablonba", systemImage: "square.and.arrow.down") }
                    } label: {
                        Image(systemName: "ellipsis").nkFont(16, .semibold).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(.white.opacity(0.10)).overlay(Circle().stroke(.white.opacity(0.18))))
                    }
                    .accessibilityLabel("Továbbiak")
                }
                NKLevelBar(level: Double(block.currentWeek) / Double(max(block.weeks, 1)), hue: hue)
                HStack(spacing: 8) {
                    pill("Szerkesztés", primary: true, action: onEdit)
                    pill("Újraindítás", action: onRestart)
                    pill("Lezárás", action: onClose)
                }
            }
        }
    }

    private func pill(_ title: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(14.5, .semibold).lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(primary ? NK.ground : .white)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background {
                    if primary { Capsule().fill(.white) }
                    else { Capsule().fill(.white.opacity(0.10)).overlay(Capsule().stroke(.white.opacity(0.18))) }
                }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Újraindítás

struct MezoRestartSheetSpike: View {
    let block: BlockPlan
    let hue: Hue
    let onDone: () -> Void
    @State private var updateTemplate = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("MEZOCIKLUS · ÚJRAINDÍTÁS").nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
            Text("Újrakezded ma az 1. héttől?").nkFont(24, .semibold).foregroundStyle(.white)
            Text("A „\(block.title)\" a mostani állapotával, minden módosításoddal együtt indul újra. A mostani futam lezárul, és zárójelentéssel megmarad a lezártak között.")
                .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            NKStatRow([NKStat(value: "\(block.currentWeek)", target: "\(block.weeks)", label: "hétnél tartasz"),
                       NKStat(value: "5", label: "edzés kész"),
                       NKStat(value: "3", label: "maradt ki", hot: true)], hue: hue)
            Toggle(isOn: $updateTemplate) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("A sablont is frissítem").nkFont(15, .semibold).foregroundStyle(.white)
                    Text("A későbbi indítások is a módosításaiddal jönnek").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
            }
            .tint(hue.glow)
            Spacer(minLength: 0)
            Button(role: .destructive) { onDone() } label: {
                Text("Újraindítás ma").nkFont(16, .semibold).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().fill(Color(hex: 0xC2414B)))
            }
            .buttonStyle(.plain)
            Button { onDone() } label: {
                Text("Mégse").nkFont(15, .semibold).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(24)
    }
}

// MARK: - Lezárás

struct MezoCloseSheetSpike: View {
    let block: BlockPlan
    let hue: Hue
    let onClosed: () -> Void
    let onCancel: () -> Void
    @State private var note = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("MEZOCIKLUS · LEZÁRÁS").nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
            Text("Lezárod a „\(block.title)\"-t?").nkFont(24, .semibold).foregroundStyle(.white)
            Text("Most a \(block.currentWeek). hétnél tartasz a \(block.weeks)-ból. A zárójelentés a mostani állapotot rögzíti, Boop pár perc múlva hozzáírja az értékelését.")
                .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                Text("SAJÁT ÉRTÉKELÉS · NEM KÖTELEZŐ").nkFont(11, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                TextField("Hogy sikerült?", text: $note, axis: .vertical)
                    .lineLimit(3...6).nkFont(15).foregroundStyle(.white)
                    .padding(14).background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.08)))
            }
            Spacer(minLength: 0)
            Button(role: .destructive) { onClosed() } label: {
                Text("Lezárás").nkFont(16, .semibold).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().fill(Color(hex: 0xC2414B)))
            }
            .buttonStyle(.plain)
            Button { onCancel() } label: {
                Text("Mégse").nkFont(15, .semibold).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(24)
    }
}

