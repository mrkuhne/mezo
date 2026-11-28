import SwiftUI

// The one hero card on top of a page (Edzés redesign, decision #119, spec 2026-11-27 §5.1, mezo-r36n9.197.1): a glass
// card (radius 28) with one to three swipeable pages and the capsule dots under them. At the accessibility text sizes
// and under VoiceOver (which has no dots to find page 2) the pages stack, nothing clipped to the fixed height.
// Lifted from the Étel Ma hero.

public struct NKPagedHero: View {
    let pages: [AnyView]
    let height: CGFloat
    @State private var page = 0
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver

    /// - Parameter height: the paged area's fixed height (the caller scales it with its own `@ScaledMetric`).
    public init(pages: [AnyView], height: CGFloat) {
        self.pages = pages; self.height = height
    }

    /// One page has nothing to swipe to: no dots.
    public static func showsDots(pageCount: Int) -> Bool { pageCount > 1 }

    /// The pages stack one under the other instead of swiping.
    public static func stacks(accessibilitySize: Bool, voiceOver: Bool) -> Bool { accessibilitySize || voiceOver }

    public var body: some View {
        Group {
            if Self.stacks(accessibilitySize: typeSize.isAccessibilitySize, voiceOver: voiceOver) {
                VStack(spacing: 22) { ForEach(pages.indices, id: \.self) { pages[$0] } }
            } else if pages.count == 1 {
                pages[0].frame(height: height)
            } else {
                VStack(spacing: 10) {
                    TabView(selection: $page) {
                        ForEach(pages.indices, id: \.self) { pages[$0].tag($0) }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .frame(height: height)
                    if Self.showsDots(pageCount: pages.count) {
                        HStack(spacing: 6) {
                            ForEach(pages.indices, id: \.self) { i in
                                Capsule().fill(.white.opacity(page == i ? 0.85 : 0.25))
                                    .frame(width: page == i ? 16 : 6, height: 6)
                            }
                        }
                        .accessibilityHidden(true)
                    }
                }
            }
        }
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .nkGlass(28)
    }
}
