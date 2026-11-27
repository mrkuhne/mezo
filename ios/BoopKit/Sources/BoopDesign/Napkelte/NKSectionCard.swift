import SwiftUI

// One glass card per logical unit (Edzés redesign, decision #119, spec 2026-11-27 §5.1, mezo-r36n9.197.1): the
// `NKBare` head (hue tick, small-caps label, optional glyph, trailing slot) on a `nkGlass(24)` card, with the block's
// own loading and failed states inside. Lifted from the Étel Ma tab's private card.

/// What sits at the right end of a section card's head.
public enum NKCardTrailing {
    case none
    /// A quiet line: an age ("2 órája"), a total ("340 kcal").
    case text(String)
    /// A control — usually `NKMoreMenu`, the card's „…" menu for its rarer actions.
    case menu(AnyView)
    /// The card opens a sub-page (pair it with `onOpen`).
    case chevron
}

public struct NKSectionCard<Content: View>: View {
    let label: String, hue: Hue, glyph: String?
    let trailing: NKCardTrailing
    let state: NKBlockState
    let onOpen: (() -> Void)?
    let content: Content

    public init(_ label: String, hue: Hue, glyph: String? = nil, trailing: NKCardTrailing = .none,
                state: NKBlockState = .ready, onOpen: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.label = label; self.hue = hue; self.glyph = glyph; self.trailing = trailing; self.state = state
        self.onOpen = onOpen; self.content = content()
    }

    public var body: some View {
        if let onOpen {
            // The whole card is the tap target (a gesture, not a Button, so the card's own buttons keep their taps).
            card.contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .onTapGesture(perform: onOpen)
                .accessibilityAction(named: "Megnyitás", onOpen)
        } else {
            card
        }
    }

    private var card: some View {
        head
            .padding(.horizontal, 16).padding(.vertical, 12)
            .nkGlass(24)
    }

    @ViewBuilder private var head: some View {
        switch trailing {
        case .none:
            NKBare(label, hue: hue, glyph: glyph, state: state) { content }
        case .text(let t):
            NKBare(label, hue: hue, glyph: glyph, trailing: t, state: state) { content }
        case .menu(let v):
            NKBare(label, hue: hue, glyph: glyph, trailingView: v, state: state) { content }
        case .chevron:
            NKBare(label, hue: hue, glyph: glyph,
                   trailingView: AnyView(Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                                            .foregroundStyle(.white.opacity(0.5)).accessibilityHidden(true)),
                   state: state) { content }
        }
    }
}

/// The „…" button of a card or hero head: the rarer actions of that card in a system menu (#129 — Újraindítás,
/// Lezárás, Mentés a sablonba on a running block).
public struct NKMoreMenu<Items: View>: View {
    let items: Items
    public init(@ViewBuilder items: () -> Items) { self.items = items() }
    public var body: some View {
        Menu { items } label: {
            Image(systemName: "ellipsis").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(.white.opacity(0.10)).overlay(Circle().stroke(.white.opacity(0.18))))
                .contentShape(Circle())
        }
        .accessibilityLabel("Továbbiak")
    }
}

public extension View {
    /// The inner treatment: anything that sits inside a section card is a faint fill, never a second glass
    /// (no glass on glass).
    func nkInnerCard(radius: CGFloat = 20) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return background(shape.fill(.white.opacity(0.06)).overlay(shape.stroke(.white.opacity(0.08))))
            .clipShape(shape)
    }
}
