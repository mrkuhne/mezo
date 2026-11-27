import SwiftUI

/// The one capture button of the barless home (`mezo-r36n9.196`, decision #134): a floating glass circle at the
/// bottom-right, on the ring and inside every room, opening the „Mit rögzítesz?" sheet. In a room it sits above the
/// room bar's right end (`raised`).
public struct NKFloatingPlus: View {
    let raised: Bool
    let action: @MainActor @Sendable () -> Void

    public init(raised: Bool, action: @escaping @MainActor @Sendable () -> Void) {
        self.raised = raised; self.action = action
    }

    public var body: some View {
        VStack {
            Spacer(minLength: 0)
            HStack {
                Spacer(minLength: 0)
                Button(action: action) {
                    NKGlyph("plus-ink", .white, size: 22).frame(width: 58, height: 58)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: .circle)
                .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
                .accessibilityLabel("Rögzítés")
            }
            .padding(.trailing, 20)
            .padding(.bottom, raised ? 78 : 18)
        }
    }
}

private struct NKFloatingPlusKey: EnvironmentKey { static let defaultValue = false }
public extension EnvironmentValues {
    /// True while the floating „+" hangs over a room page: `NKAreaPage` grows its end spacer so the last row's end
    /// can scroll clear of it.
    var nkFloatingPlus: Bool {
        get { self[NKFloatingPlusKey.self] }
        set { self[NKFloatingPlusKey.self] = newValue }
    }
}
