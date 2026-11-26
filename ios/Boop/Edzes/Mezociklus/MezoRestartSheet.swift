import SwiftUI
import BoopCore
import BoopDesign

/// „Újrakezded ma az 1. héttől?" — one server step: the running one closes with its report and starts again today,
/// week 1, with every phone edit (mezo-r36n9.177, spike `MezoRestartSheetSpike`). A failure changes nothing.
struct MezoRestartSheet: View {
    let card: MezoCard
    let model: MezociklusokModel
    let hue: Hue
    let onDone: () -> Void
    let onCancel: () -> Void
    @State private var updateTemplate = false

    var body: some View {
        let stats = MezociklusokModel.restartStats(running: card)
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("MEZOCIKLUS · ÚJRAINDÍTÁS").nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
                    .accessibilityHidden(true)
                Text("Újrakezded ma az 1. héttől?").nkFont(24, .semibold).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Text("A „\(card.title)” a mostani állapotával, minden módosításoddal együtt indul újra. A mostani futam (\(stats.week). hét a \(stats.of)-ból) lezárul, és zárójelentéssel megmarad a lezártak között.")
                    .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                NKStatRow(statsRow(stats), hue: hue)
                Toggle(isOn: $updateTemplate) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("A sablont is frissítem").nkFont(15, .semibold).foregroundStyle(.white)
                        Text("A későbbi indítások is a módosításaiddal jönnek").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                    }
                }
                .tint(hue.glow)
                .frame(minHeight: 44)
                if let error = model.lastError {
                    Text(error).nkFont(13.5).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                }
                MezoButton(title: "Újraindítás ma", style: .destructive, busy: model.busy) {
                    Task { if await model.restart(running: card, updateTemplate: updateTemplate) != nil { onDone() } }
                }
                .disabled(model.busy)
                Button(action: onCancel) {
                    Text("Mégse").nkFont(15, .semibold).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .disabled(model.busy)
            }
            .padding(24)
        }
        .scrollBounceBehavior(.basedOnSize)
        .interactiveDismissDisabled(model.busy)
    }

    /// Where he stands; the missed-workout count only when it was counted from logged data (it never is guessed).
    private func statsRow(_ s: (week: Int, of: Int, done: Int?)) -> [NKStat] {
        var out = [NKStat(value: "\(s.week)", target: "\(s.of)", label: "hétnél tartasz")]
        if let done = s.done { out.append(NKStat(value: "\(done)", label: "edzés kész")) }
        else { out.append(NKStat(value: "\(max(0, s.of - s.week))", label: "hét volt még hátra")) }
        return out
    }
}
