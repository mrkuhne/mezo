import SwiftUI
import BoopCore
import BoopDesign

/// The Évad colour world: its own evening violet since it became the tenth orb (`mezo-r36n9.196`, decision #138) —
/// `.forma` must never identify the Évad room again. The system map paints its four pillars in their own worlds on top.
let evadHue: Hue = .evad

// MARK: - Small shared pieces

/// The steppers' round buttons: the kit's plus glyph and a drawn minus (no system symbols).
struct EvadStepButton: View {
    let plus: Bool
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Group {
                if plus { NKGlyph("plus-ink", .white, size: 18) } else { Capsule().fill(.white).frame(width: 15, height: 2.4) }
            }
            .frame(width: 38, height: 38)
            .background(Circle().fill(.white.opacity(0.1)))
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// A red guard line when the engine warns.
struct EvadWarningBox: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            NKGlyph("bolt-ink", NK.under, size: 16)
            Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(NK.under.opacity(0.12)))
    }
}

/// A plain line of state under a block (a refusal, the "újraszámoltam" note).
struct EvadLine: View {
    let text: String
    var body: some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension View {
    /// Simulator review: `-evadBottom YES` opens a sub-page scrolled to its end (its actions), so a screenshot shows them.
    func evadReviewAnchor() -> some View {
        #if DEBUG
        defaultScrollAnchor(UserDefaults.standard.bool(forKey: "evadBottom") ? .bottom : nil)
        #else
        self
        #endif
    }
}

/// The Lista tab's badge: lines still to buy (0 = no badge).
func evadListLeft(_ l: EvadShoppingList?) -> Int {
    l?.items.filter { !$0.checked && !$0.removed }.count ?? 0
}

/// "0,40 kg".
func evadPaceText(_ kg: Double) -> String { String(format: "%.2f kg", kg).replacingOccurrences(of: ".", with: ",") }
