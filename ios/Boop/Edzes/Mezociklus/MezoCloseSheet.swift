import SwiftUI
import BoopCore
import BoopDesign

/// Lezárás: an optional own evaluation, then the red button; the zárójelentés opens after it
/// (mezo-r36n9.177, spike `MezoCloseSheetSpike`).
struct MezoCloseSheet: View {
    let card: MezoCard
    let model: MezociklusokModel
    let hue: Hue
    let onClosed: (WireBlock) -> Void
    let onCancel: () -> Void
    @State private var note = ""
    @FocusState private var noteFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("MEZOCIKLUS · LEZÁRÁS").nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
                    .accessibilityHidden(true)
                Text("Lezárod a „\(card.title)” mezociklust?").nkFont(24, .semibold).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text("Most a \(card.currentWeek). hétnél tartasz a \(card.weeks)-ból. A zárójelentés a mostani állapotot rögzíti, Boop pár perc múlva hozzáírja az értékelését.")
                    .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                VStack(alignment: .leading, spacing: 8) {
                    Text("SAJÁT ÉRTÉKELÉS · NEM KÖTELEZŐ").nkFont(11, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                        .accessibilityHidden(true)
                    TextField("Hogy sikerült? (nem kötelező)", text: $note, axis: .vertical)
                        .lineLimit(3...6).nkFont(15).foregroundStyle(.white)
                        .focused($noteFocused)
                        .padding(14).background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.08)))
                        .accessibilityLabel("Saját értékelés, nem kötelező")
                }
                if let error = model.lastError {
                    Text(error).nkFont(13.5).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                }
                MezoButton(title: "Lezárás", style: .destructive, busy: model.busy) {
                    noteFocused = false
                    Task { if let closed = await model.close(running: card, selfEval: note) { onClosed(closed) } }
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
        .scrollDismissesKeyboard(.interactively)
        .interactiveDismissDisabled(model.busy)
    }
}
