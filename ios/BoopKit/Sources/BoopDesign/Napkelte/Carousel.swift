import SwiftUI

/// A row of cards you swipe through, with **dots under it** (owner, 2026-11-17: *"minden
/// carousel alatt mindig legyenek kis pöttyök, hogy lássuk lehet még görgetni"*).
///
/// The dots are the point, not decoration: a horizontally scrolling row with nothing under it
/// looks like a list that happens to be cut off. One dot per card, the current one lit, so the
/// page says how much more there is before he swipes.
///
/// The cards stop where they are swiped to (`.viewAligned`), each one a little narrower than
/// the page so the next one peeks — the second signal that the row continues.
public struct NKCarousel<Item: Identifiable, Card: View>: View {
    let items: [Item]
    let hue: Hue
    /// How much of the page one card takes. The default leaves the next card peeking.
    let widthFraction: CGFloat
    /// The row's height. It is given rather than measured: a card that sizes the row that
    /// contains it is a layout loop, and in a lazy row only the visible cards would be
    /// measured anyway — so the page that knows its cards says how tall they are.
    let height: CGFloat
    let card: (Item) -> Card
    /// The card the row opens on (e.g. today in a week); nil = the first.
    let initial: Item.ID?
    @State private var current: Item.ID?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(_ items: [Item], hue: Hue, height: CGFloat = 170, widthFraction: CGFloat = 0.86, initial: Item.ID? = nil,
                @ViewBuilder card: @escaping (Item) -> Card) {
        self.items = items; self.hue = hue; self.height = height
        self.widthFraction = widthFraction; self.card = card; self.initial = initial
    }

    public var body: some View {
        VStack(spacing: 12) {
            GeometryReader { geo in
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 12) {
                        ForEach(items) { item in
                            card(item)
                                .frame(width: max(120, geo.size.width * widthFraction))
                                .id(item.id)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollPosition(id: $current, anchor: .leading)
                .scrollIndicators(.hidden)
            }
            .frame(height: height)
            if items.count > 1 { dots }
        }
        .onAppear { if current == nil { current = initial ?? items.first?.id } }
    }

    private var dots: some View {
        HStack(spacing: 6) {
            ForEach(items) { item in
                Circle()
                    .fill(.white.opacity(item.id == current ? 0 : 0.22))
                    .overlay { if item.id == current { Circle().fill(hue.glow) } }
                    .frame(width: 6, height: 6)
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: current)
        .accessibilityHidden(true)
    }
}
