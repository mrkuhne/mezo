import SwiftUI

// The in-card action row (Edzés redesign, decision #119, spec 2026-11-27 §5.1, mezo-r36n9.197.1): one primary
// capsule — white, or the hue for Indítás — and at most two quiet ones; anything rarer goes to the card's „…" menu
// (`NKMoreMenu`). A row while it fits, a column at large type. Replaces the free pill rows.

public struct NKCardAction: Identifiable {
    public let title: String
    public let glyph: String?
    public let enabled: Bool
    public let action: () -> Void
    public var id: String { title }
    /// - Parameter glyph: an SF Symbol name in front of the title.
    public init(_ title: String, glyph: String? = nil, enabled: Bool = true, action: @escaping () -> Void) {
        self.title = title; self.glyph = glyph; self.enabled = enabled; self.action = action
    }
}

public struct NKCardActions: View {
    public enum PrimaryStyle { case white, hue(Hue) }

    /// One primary and at most this many quiet actions in a card.
    public static let maxQuiet = 2

    let primary: NKCardAction
    let quiet: [NKCardAction]
    let primaryStyle: PrimaryStyle

    public init(primary: NKCardAction, quiet: [NKCardAction] = [], primaryStyle: PrimaryStyle = .white) {
        assert(quiet.count <= Self.maxQuiet, "NKCardActions: at most \(Self.maxQuiet) quiet actions; the rest go to the „…” menu")
        self.primary = primary; self.quiet = Array(quiet.prefix(Self.maxQuiet)); self.primaryStyle = primaryStyle
    }

    public var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { buttons }
            VStack(spacing: 8) { buttons }
        }
    }

    @ViewBuilder private var buttons: some View {
        capsule(primary, primary: true)
        ForEach(quiet) { capsule($0, primary: false) }
    }

    private func capsule(_ item: NKCardAction, primary: Bool) -> some View {
        Button(action: item.action) {
            HStack(spacing: 6) {
                if let g = item.glyph { Image(systemName: g).font(.system(size: 14, weight: .semibold)) }
                // A row only while every title fits on one line; ViewThatFits then falls back to the column.
                Text(item.title).nkFont(15, .semibold).lineLimit(1).fixedSize()
            }
            .foregroundStyle(primary ? NK.ground : .white)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background { background(primary: primary) }
            .contentShape(Capsule())
            .opacity(item.enabled ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(!item.enabled)
    }

    @ViewBuilder private func background(primary: Bool) -> some View {
        if primary {
            switch primaryStyle {
            case .white: Capsule().fill(.white)
            case .hue(let h): Capsule().fill(h.glow)
            }
        } else {
            Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.16)))
        }
    }
}
