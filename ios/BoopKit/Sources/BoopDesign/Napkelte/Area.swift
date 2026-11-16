import SwiftUI

// The shared frame every area page is built from (life-dashboard spec §3.3, slice L0). One area = one app:
// a photographed head with its verdict, its own top tabs with their own badges, then blocks from the kit in
// `AreaBlocks.swift`.
//
// It wears the WARM treatment the owner chose on 2026-11-13 (decision #12): a photo in the head where the world
// has a compliant mood photo and the painted landscape where it does not, the area's hue on key numbers and on
// marked spans inside the text, photo thumbnails on rows that are *things* — and NO card around the stats, the
// curve, the composition or the row lists. Only the highlight and the menu grid keep one.

// MARK: - Badge

/// How much there is to look at in a tab, a row or a menu item — a count when there is one to give, and a plain
/// **dot** when the mark means "needs your tap" rather than "there are three of something".
public struct NKBadge: View {
    let count: Int, dot: Bool, hue: Hue
    public init(_ count: Int, hue: Hue) { self.count = count; self.dot = false; self.hue = hue }
    /// A countless mark: something here wants him.
    public init(dot: Bool, hue: Hue) { self.count = 0; self.dot = dot; self.hue = hue }
    public var body: some View {
        if dot {
            Circle().fill(hue.glow).frame(width: 7, height: 7)
                .shadow(color: hue.glow.opacity(0.7), radius: 5)
                .accessibilityLabel("van néznivaló")
        } else if count > 0 {
            Text("\(count)")
                .font(.custom(Lagy.outfitFamily, size: 12).weight(.semibold))
                .foregroundStyle(NK.ground)
                .frame(minWidth: 20, minHeight: 20)
                .padding(.horizontal, 5)
                .background(Capsule().fill(hue.glow))
                .shadow(color: hue.glow.opacity(0.6), radius: 6)
                .accessibilityLabel("\(count) néznivaló")
        }
    }
}

// MARK: - Colour inside the text

/// The area's hue on the key numbers: `"A fehérje *38 g*-nál tart"` lights the marked span in the hue and leaves
/// everything else white. Asterisks come in pairs; an unpaired one simply ends the span at the end of the text.
public struct NKHueText: View {
    let text: String, hue: Hue, size: CGFloat, serif: Bool, opacity: Double
    public init(_ text: String, hue: Hue, size: CGFloat = 15, serif: Bool = false, opacity: Double = 0.85) {
        self.text = text; self.hue = hue; self.size = size; self.serif = serif; self.opacity = opacity
    }
    public var body: some View {
        Text(nkHueAttributed(text, hue: hue, size: size, serif: serif, opacity: opacity))
            .lineSpacing(serif ? 3 : 5)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The marked-span markup, apart from the view so it can be unit-tested.
public func nkHueAttributed(_ text: String, hue: Hue, size: CGFloat, serif: Bool,
                            opacity: Double = 0.85) -> AttributedString {
    var out = AttributedString()
    var lit = false
    for part in text.components(separatedBy: "*") {
        if part.isEmpty { lit.toggle(); continue }
        var a = AttributedString(part)
        a.foregroundColor = lit ? hue.glow : .white.opacity(opacity)
        a.font = serif ? .nkSerif(size, lit ? .semibold : .regular)
                       : .system(size: size, weight: lit ? .semibold : .regular)
        out.append(a)
        lit.toggle()
    }
    return out
}

// MARK: - A section with no card around it

/// What the warm treatment puts in place of a glass card: a hue tick, a mono label, and the content straight on
/// the page. Used for the stats, the curve, the composition and the row lists.
/// Where one block's own data is. Every section of a room loads and fails on its own (the Étel room is built that
/// way on purpose), so the state belongs to the block, never to the page: a page-level spinner would throw that
/// away.
public enum NKBlockState {
    case ready
    case loading
    /// Something went wrong, and the way to try again.
    case failed(String, @MainActor @Sendable () -> Void)
}

/// What the warm treatment puts in place of a glass card: a hue tick, a mono label, and the content straight on
/// the page — with that block's own loading and failed states.
public struct NKBare<Content: View>: View {
    let label: String, hue: Hue, trailing: String?
    let state: NKBlockState
    let content: Content
    public init(_ label: String, hue: Hue, trailing: String? = nil, state: NKBlockState = .ready,
                @ViewBuilder content: () -> Content) {
        self.label = label; self.hue = hue; self.trailing = trailing; self.state = state; self.content = content()
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Capsule().fill(hue.glow).frame(width: 3, height: 13)
                NKMono(label.uppercased())
                Spacer(minLength: 8)
                if let trailing { Text(trailing).nkFont(12).foregroundStyle(.white.opacity(0.5)) }
            }
            switch state {
            case .ready:
                content
            case .loading:
                HStack(spacing: 10) {
                    ProgressView().tint(.white.opacity(0.6)).controlSize(.small)
                    Text("Töltöm…").nkFont(13).foregroundStyle(.white.opacity(0.55))
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10)
            case .failed(let line, let retry):
                HStack(spacing: 12) {
                    Text(line).nkFont(13).foregroundStyle(.white.opacity(0.65))
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Button("Újra", action: retry)
                        .buttonStyle(.plain)
                        .nkFont(13, .semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).frame(height: 34)
                        .background(Capsule().stroke(.white.opacity(0.4)))
                }
                .padding(.vertical, 6)
            }
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - The head

/// One of the area head's inner tabs, with how much there is to look at behind it.
public struct NKAreaTab: Identifiable, Equatable, Sendable {
    public let name: String
    public let badge: Int
    /// A countless mark instead of a number: this tab wants his tap, and there is nothing to count.
    public let dot: Bool
    public var id: String { name }
    public init(_ name: String, badge: Int = 0, dot: Bool = false) {
        self.name = name; self.badge = badge; self.dot = dot
    }
}

/// The inner tabs of an area, each carrying its own badge. The selected one is a white capsule, as in the rooms
/// shipped before the kit; the badge rides on its trailing edge.
public struct NKAreaTabs: View {
    let tabs: [NKAreaTab], hue: Hue
    @Binding var selected: String
    public init(tabs: [NKAreaTab], hue: Hue, selected: Binding<String>) {
        self.tabs = tabs; self.hue = hue; self._selected = selected
    }
    public var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) {
                ForEach(tabs) { tab in
                    let on = tab.name == selected
                    Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { selected = tab.name } } label: {
                        HStack(spacing: 6) {
                            Text(tab.name).nkFont(14, on ? .semibold : .regular).lineLimit(1).minimumScaleFactor(0.7)
                                .foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                            if tab.dot { NKBadge(dot: true, hue: hue) } else { NKBadge(tab.badge, hue: hue) }
                        }
                        .padding(.horizontal, 15).padding(.vertical, 9)
                        .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.horizontal, 12)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize)
        .sensoryFeedback(.selection, trigger: selected)
    }
}

/// One corner control of an area head (search, settings, anything the area needs).
public struct NKAreaAction: Identifiable {
    public let id = UUID()
    let glyph: String, label: String
    let action: @MainActor @Sendable () -> Void
    public init(glyph: String, label: String, action: @escaping @MainActor @Sendable () -> Void) {
        self.glyph = glyph; self.label = label; self.action = action
    }
}

/// **An area page.** The head is the world's mood photo (or the painted landscape) under the hue's own gradient,
/// with the back button and the crumb on it, the corner actions opposite, then the orb with the area's score, the
/// verdict and one sentence; the inner tabs sit under it. The blocks follow on the page itself.
///
/// `score == nil` means there is nothing to score yet: the orb is still and half full, and no number is shown —
/// never a 0.
public struct NKAreaPage<Content: View>: View {
    let hue: Hue, name: String, eyebrow: String
    let score: Int?, display: String?
    let headline: String, sentence: String
    let photo: Image?
    let tabs: [NKAreaTab]
    let selectedTab: Binding<String>?
    let actions: [NKAreaAction]
    let onBack: (@MainActor @Sendable () -> Void)?
    let content: Content
    @State private var position = ScrollPosition()
    @State private var scrollY: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(hue: Hue, name: String, eyebrow: String, score: Int?, display: String? = nil,
                headline: String, sentence: String, photo: Image? = nil,
                tabs: [NKAreaTab] = [], selectedTab: Binding<String>? = nil, actions: [NKAreaAction] = [],
                onBack: (@MainActor @Sendable () -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.hue = hue; self.name = name; self.eyebrow = eyebrow; self.score = score; self.display = display
        self.headline = headline; self.sentence = sentence; self.photo = photo
        self.tabs = tabs; self.selectedTab = selectedTab; self.actions = actions; self.onBack = onBack
        self.content = content()
    }

    /// How far down the tab row sits: the head's height less the row and a little air.
    private var tabsOffset: CGFloat { (tabs.isEmpty ? 346 : 400) - 112 }

    public var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                head
                VStack(spacing: 22) { content }
                    .padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 40)
                    .background(FloatingLights(hue: hue).padding(.vertical, -100))
                MirroredLand(hue: hue).padding(.top, -20)
                Color.clear.frame(height: 100)
            }
        }
        .scrollIndicators(.hidden)
        .scrollPosition($position)
        .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { _, y in scrollY = y }
        // Switching tabs from deep inside a long list would leave the new tab scrolled into the middle of nothing.
        // The kit does it, so every room behaves the same: come back up to the tab row, but only when the page is
        // below it — a page already at the top does not jump.
        .onChange(of: selectedTab?.wrappedValue) { _, _ in
            guard scrollY > tabsOffset else { return }
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.3)) { position.scrollTo(y: tabsOffset) }
        }
        .ignoresSafeArea(edges: .top)
        .background(NKGround(hue: hue))
        .preferredColorScheme(.dark)
    }

    private var head: some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: tabs.isEmpty ? 346 : 400)
                .overlay { NKPhotoSky(hue: hue, photo: photo) }
                .clipped()
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.58), .init(color: .clear, location: 1)],
                                     startPoint: .top, endPoint: .bottom))
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    if let onBack {
                        Button(action: onBack) {
                            Image(systemName: "chevron.left").nkFont(17, .semibold).foregroundStyle(.white)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                        .accessibilityLabel("Vissza")
                    }
                    Text(name).nkFont(15, .medium).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
                    Spacer(minLength: 8)
                    ForEach(actions) { a in
                        Button(action: a.action) {
                            NKGlyph(a.glyph, .white, size: 17).frame(width: 40, height: 40)
                        }
                        .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                        .accessibilityLabel(a.label)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 58)
                VStack(spacing: 8) {
                    ZStack {
                        if photo != nil { NKOrbScrim(hue: hue) }
                        if let score {
                            StillOrb(palette: hue.orb, size: 70, level: min(1, max(0.06, Double(score) / 100)))
                                .shadow(color: hue.glow.opacity(0.6), radius: 20)
                            Text(display ?? "\(score)")
                                .font(.custom(Lagy.outfitFamily, size: 25).weight(.medium)).foregroundStyle(.white)
                                .monospacedDigit().shadow(color: .black.opacity(0.45), radius: 5)
                                .minimumScaleFactor(0.5).lineLimit(1).frame(width: 56)
                        } else {
                            StillOrb(palette: hue.orb, size: 70, level: 0.5).saturation(0.6)
                        }
                    }
                    .frame(height: 70)
                    NKMono(eyebrow.uppercased()).padding(.top, 8)
                    Text(headline).nkFont(36, design: .serif).foregroundStyle(.white)
                        .multilineTextAlignment(.center).minimumScaleFactor(0.6)
                    NKHueText(sentence, hue: hue, size: 15.5)
                        .multilineTextAlignment(.center).padding(.horizontal, 26)
                }
                .padding(.top, 26)
                if let selectedTab, !tabs.isEmpty {
                    NKAreaTabs(tabs: tabs, hue: hue, selected: selectedTab).padding(.top, 20)
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}

// MARK: - A sub-page of an area

/// **A page inside an area** — an exercise, a block report, a muscle map, a recipe, a merchant. It is not an area
/// of its own (no score orb, no inner tabs), but it must look like it belongs to the same world, or every room
/// invents its own inner page (B5's requirement 7).
///
/// The head is the same photographed sky as an area's, shorter: back, crumb, a mono eyebrow and a serif title,
/// with one optional line under it. The body is the same blocks.
///
/// What this is **not** for: a full-screen flow with its own chrome that must survive the phone locking — a
/// workout player, the check-in, the evening close. Those are page-level covers and stay outside the area-page
/// system.
public struct NKAreaSubPage<Content: View>: View {
    let hue: Hue, crumb: String, eyebrow: String, title: String, sentence: String
    let photo: Image?
    let actions: [NKAreaAction]
    let onBack: (@MainActor @Sendable () -> Void)?
    let content: Content

    public init(hue: Hue, crumb: String, eyebrow: String, title: String, sentence: String = "",
                photo: Image? = nil, actions: [NKAreaAction] = [],
                onBack: (@MainActor @Sendable () -> Void)?, @ViewBuilder content: () -> Content) {
        self.hue = hue; self.crumb = crumb; self.eyebrow = eyebrow; self.title = title; self.sentence = sentence
        self.photo = photo; self.actions = actions; self.onBack = onBack; self.content = content()
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    Color.clear.frame(height: 286)
                        .overlay { NKPhotoSky(hue: hue, photo: photo) }
                        .clipped()
                        .mask(LinearGradient(stops: [.init(color: .black, location: 0.55),
                                                     .init(color: .clear, location: 1)],
                                             startPoint: .top, endPoint: .bottom))
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 10) {
                            if let onBack {
                                Button(action: onBack) {
                                    Image(systemName: "chevron.left").nkFont(17, .semibold).foregroundStyle(.white)
                                        .frame(width: 44, height: 44)
                                }
                                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                                .accessibilityLabel("Vissza")
                            }
                            Text(crumb).nkFont(15, .medium).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
                            Spacer(minLength: 8)
                            ForEach(actions) { a in
                                Button(action: a.action) {
                                    NKGlyph(a.glyph, .white, size: 17).frame(width: 40, height: 40)
                                }
                                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                                .accessibilityLabel(a.label)
                            }
                        }
                        .padding(.top, 58)
                        VStack(alignment: .leading, spacing: 8) {
                            NKMono(eyebrow.uppercased())
                            Text(title).nkFont(34, design: .serif).foregroundStyle(.white)
                                .fixedSize(horizontal: false, vertical: true).minimumScaleFactor(0.7)
                            if !sentence.isEmpty { NKHueText(sentence, hue: hue, size: 15) }
                        }
                        .padding(.top, 40)
                    }
                    .padding(.horizontal, 18)
                }
                VStack(spacing: 22) { content }
                    .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 40)
                    .background(FloatingLights(hue: hue).padding(.vertical, -100))
                MirroredLand(hue: hue).padding(.top, -20)
                Color.clear.frame(height: 100)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(NKGround(hue: hue))
        .preferredColorScheme(.dark)
    }
}
