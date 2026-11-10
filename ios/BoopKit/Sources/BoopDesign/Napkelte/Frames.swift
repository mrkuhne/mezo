import SwiftUI

// MARK: - Title row and tabs

/// Bell (with unread count), the "boop" wordmark, "+" quick add and the avatar.
public struct NKTitleRow: View {
    let bellCount: Int
    let onBell: () -> Void, onPlus: () -> Void, onAvatar: () -> Void
    public init(bellCount: Int = 0, onBell: @escaping () -> Void, onPlus: @escaping () -> Void, onAvatar: @escaping () -> Void) {
        self.bellCount = bellCount; self.onBell = onBell; self.onPlus = onPlus; self.onAvatar = onAvatar
    }
    public var body: some View {
        HStack(spacing: 4) {
            Button(action: onBell) {
                NKGlyph("bell-cream", .white, size: 21).frame(width: 44, height: 44)
                    .overlay(alignment: .topTrailing) {
                        if bellCount > 0 {
                            Text("\(bellCount)").nkFont(10, .bold).foregroundStyle(NK.ground)
                                .frame(minWidth: 16, minHeight: 16).background(Circle().fill(.white)).offset(x: -4, y: 6)
                        }
                    }
            }
            .buttonStyle(.plain).accessibilityLabel("Értesítések")
            Color.clear.frame(width: 44, height: 44)
            Spacer()
            Text("boop").font(.custom(Lagy.outfitFamily, size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
            Spacer()
            Button(action: onPlus) { NKGlyph("plus-ink", .white, size: 18).frame(width: 44, height: 44) }
                .buttonStyle(.plain).accessibilityLabel("Gyors hozzáadás")
            Button(action: onAvatar) { NKGlyph("person-sage", .white, size: 20).frame(width: 44, height: 44).glassEffect(.clear, in: .circle) }
                .buttonStyle(.plain).accessibilityLabel("Beállítások")
        }
        .padding(.horizontal, 16)
    }
}

/// The domain's pages as thin text tabs: selected white semibold with a 1 pt underline, others 62 %, no hairline.
public struct NKTabStrip: View {
    let tabs: [String], dot: String?
    @Binding var selected: String
    public init(tabs: [String], selected: Binding<String>, dot: String? = nil) { self.tabs = tabs; self._selected = selected; self.dot = dot }
    public var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs, id: \.self) { t in
                let on = t == selected
                VStack(spacing: 7) {
                    HStack(spacing: 4) {
                        Text(t).nkFont(15, on ? .semibold : .regular).lineLimit(1).minimumScaleFactor(0.6)
                        if t == dot && !on { Circle().fill(.white).frame(width: 5, height: 5) }
                    }
                    .foregroundStyle(.white.opacity(on ? 1 : 0.62))
                    Capsule().fill(.white).frame(height: 1).opacity(on ? 1 : 0).padding(.horizontal, 6)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture { withAnimation(.easeInOut(duration: 0.3)) { selected = t } }
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.horizontal, 12)
    }
}

// MARK: - Ground

/// Very soft lights in the page hue that drift slower than the scroll (spec §5.1b).
public struct FloatingLights: View {
    let hue: Hue
    public init(hue: Hue) { self.hue = hue }
    public var body: some View {
        GeometryReader { g in
            ZStack {
                light(360, g.size.width * 0.15, 60, 0.30)
                light(300, g.size.width * 0.85, g.size.height * 0.45, 0.24)
                light(380, g.size.width * 0.3, g.size.height * 0.85, 0.20)
            }
            .frame(width: g.size.width, height: g.size.height)
            .visualEffect { c, proxy in c.offset(y: -proxy.frame(in: .scrollView).minY * 0.35) }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
    private func light(_ size: CGFloat, _ x: CGFloat, _ y: CGFloat, _ o: Double) -> some View {
        Circle().fill(hue.glow.opacity(o)).frame(width: size, height: size).blur(radius: size * 0.33).position(x: x, y: y)
    }
}

/// The deep-hue ground under every page (never black).
public struct NKGround: View {
    let hue: Hue
    public init(hue: Hue) { self.hue = hue }
    public var body: some View {
        LinearGradient(colors: NK.deepGround(hue), startPoint: .top, endPoint: .bottom).ignoresSafeArea()
    }
}

// MARK: - Pages

/// What the compact capsule shows once the hero scrolls away.
public struct NKCompact {
    public let palette: [Color], title: String, value: String, line: String
    public init(palette: [Color], title: String, value: String, line: String) { self.palette = palette; self.title = title; self.value = value; self.line = line }
}

/// A domain tab page: painted backdrop (full screen when `heroHeight` is nil) with the hero over it, glass content below,
/// a deep-hue ground with floating lights, the mirrored land at the end, and a compact capsule after the hero.
public struct NKTabPage<Hero: View, Content: View>: View {
    let hue: Hue, heroHeight: CGFloat?, compact: NKCompact?
    let hero: Hero, content: Content
    @State private var showCompact = false
    /// Where the hero really ends (content y of the view marked `nkHeroEnd()`); nil = not marked.
    @State private var heroEnd: CGFloat?

    public init(hue: Hue, heroHeight: CGFloat?, compact: NKCompact?, @ViewBuilder hero: () -> Hero, @ViewBuilder content: () -> Content) {
        self.hue = hue; self.heroHeight = heroHeight; self.compact = compact; self.hero = hero(); self.content = content()
    }

    @Environment(\.nkBackdropHosted) private var hosted
    @State private var scrollY: CGFloat = 0

    public var body: some View {
        GeometryReader { geo in
            let h = heroHeight ?? (geo.size.height + geo.safeAreaInsets.top - 30)
            ScrollView {
                VStack(spacing: 0) {
                    ZStack(alignment: .top) {
                        if hosted {
                            Color.clear.frame(height: h)
                        } else {
                            Color.clear.frame(height: h)
                                .overlay { PaintedLandscape(hue: hue) }
                                .clipped()
                                .mask(nkLandscapeMask)
                        }
                        hero.frame(minHeight: h, alignment: .top)
                    }
                    VStack(spacing: 16) { content }
                        .padding(.horizontal, 16)
                        .background(FloatingLights(hue: hue).padding(.horizontal, -16).padding(.vertical, -120))
                    MirroredLand(hue: hue).padding(.top, 20)
                }
                .coordinateSpace(name: NKHeroEndKey.space)
            }
            .onPreferenceChange(NKHeroEndKey.self) { heroEnd = $0 }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            .background { if !hosted { NKGround(hue: hue) } }
            // Hosted: the shell paints the sky, so tell it which sky, how tall, and how far it has scrolled.
            .preference(key: NKBackdropKey.self, value: hosted ? NKBackdrop(hue: hue, heroHeight: h, scrollY: scrollY) : nil)
            // The capsule arrives once the hero's marked end (its last control) slides under the top bar
            // (safe area + the capsule's row); unmarked heroes fall back to the frame height.
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { _, y in
                if hosted { scrollY = y }
                let threshold = heroEnd.map { $0 - geo.safeAreaInsets.top - 50 } ?? (h - 120)
                let v = y > threshold
                if v != showCompact { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { showCompact = v } }
            }
            .overlay(alignment: .top) {
                if showCompact, let c = compact {
                    HStack(spacing: 10) {
                        StillOrb(palette: c.palette, size: 26, level: 0.8)
                        Text(c.title).nkFont(15, .semibold).foregroundStyle(.white)
                        Text(c.value).font(.nkNumber(17)).foregroundStyle(.white.opacity(0.8))
                        Text("· \(c.line)").nkFont(14).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                    }
                    .padding(.leading, 8).padding(.trailing, 16).frame(height: 44)
                    .glassEffect(.regular, in: .capsule)
                    .padding(.top, 2)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

/// The content y where a tab page's hero ends, reported by the view marked with `nkHeroEnd()`.
public struct NKHeroEndKey: PreferenceKey {
    static let space = "nkTabPageContent"
    public static let defaultValue: CGFloat? = nil
    public static func reduce(value: inout CGFloat?, nextValue: () -> CGFloat?) {
        if let n = nextValue() { value = max(value ?? n, n) }
    }
}

public extension View {
    /// Marks the bottom of this view as the end of the `NKTabPage` hero: the compact capsule slides in as soon as it
    /// scrolls under the top bar (instead of at a fixed offset from the frame height).
    func nkHeroEnd() -> some View {
        background(GeometryReader { g in
            Color.clear.preference(key: NKHeroEndKey.self, value: g.frame(in: .named(NKHeroEndKey.space)).maxY)
        })
    }
}

// MARK: - Shared backdrop (one landscape across the five domains)

/// The tab page's sky fades into the ground over its lower part.
let nkLandscapeMask = LinearGradient(stops: [.init(color: .black, location: 0.62), .init(color: .clear, location: 1)],
                                     startPoint: .top, endPoint: .bottom)

private struct NKBackdropHostedKey: EnvironmentKey { static let defaultValue = false }
public extension EnvironmentValues {
    /// True under a shell that paints one shared sky behind every domain: tab pages then leave their sky out.
    var nkBackdropHosted: Bool {
        get { self[NKBackdropHostedKey.self] }
        set { self[NKBackdropHostedKey.self] = newValue }
    }
}

/// What a hosted tab page asks the shared sky to show.
public struct NKBackdrop: Equatable, Sendable {
    public var hue: Hue, heroHeight: CGFloat, scrollY: CGFloat
    public init(hue: Hue, heroHeight: CGFloat, scrollY: CGFloat) { self.hue = hue; self.heroHeight = heroHeight; self.scrollY = scrollY }
}

public struct NKBackdropKey: PreferenceKey {
    public static let defaultValue: NKBackdrop? = nil
    public static func reduce(value: inout NKBackdrop?, nextValue: () -> NKBackdrop?) { if let n = nextValue() { value = n } }
}

/// One painted landscape behind the domains of the bottom bar. A switch slides the old land out toward the side away
/// from the tapped domain while the new land slides in from the tapped side and the two skies blend straight into each
/// other — one continuous horizon, never a swapped screen. `progress` runs 0 → 1 over a switch (animatable).
public struct NKBackdropPanorama: View, @preconcurrency Animatable {
    public var progress: Double
    let from: NKBackdrop, to: NKBackdrop, direction: CGFloat, travel: CGFloat
    /// `direction` +1 when the new domain sits right of the old one; `travel` = how far each land moves, as a share of
    /// the width (0 = pure cross-fade, for reduced motion).
    public init(from: NKBackdrop, to: NKBackdrop, direction: CGFloat, progress: Double, travel: CGFloat = 0.5) {
        self.from = from; self.to = to; self.direction = direction; self.progress = progress; self.travel = travel
    }
    public var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    public var body: some View {
        GeometryReader { geo in
            let w = geo.size.width + geo.safeAreaInsets.leading + geo.safeAreaInsets.trailing
            let p = CGFloat(min(1, max(0, progress)))
            ZStack(alignment: .top) {
                if p < 0.999 { panel(from, shift: -direction * p * w * travel, geo: geo) }
                panel(to, shift: direction * (1 - p) * w * travel, geo: geo).opacity(p >= 0.999 ? 1 : smooth(Double(p)))
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    private func panel(_ p: NKBackdrop, shift: CGFloat, geo: GeometryProxy) -> some View {
        let w = geo.size.width + geo.safeAreaInsets.leading + geo.safeAreaInsets.trailing
        return ZStack(alignment: .top) {
            sky(p, w: w, shift: shift).id(p.hue).transition(.opacity)
        }
        // A page re-colouring itself (a Nap orb tapped) cross-fades its own sky.
        .animation(.easeInOut(duration: 0.6), value: p.hue)
        .frame(width: w, height: geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom, alignment: .top)
        .clipped()
    }

    private func sky(_ p: NKBackdrop, w: CGFloat, shift: CGFloat) -> some View {
        ZStack(alignment: .top) {
            LinearGradient(colors: NK.deepGround(p.hue), startPoint: .top, endPoint: .bottom)
            Color.clear.frame(width: w, height: p.heroHeight)
                .overlay { PaintedLandscape(hue: p.hue) }
                .clipped()
                .mask(nkLandscapeMask)
                // While it slides, the edge that comes into view melts into the ground instead of showing a cut.
                .mask(edgeFeather(shift: shift, width: w))
                .offset(x: shift, y: -max(0, p.scrollY))
        }
    }

    /// No feather at rest; while shifted right the left edge fades over a band as wide as the shift (and vice versa).
    private func edgeFeather(shift: CGFloat, width: CGFloat) -> LinearGradient {
        let f = min(0.45, abs(shift) / max(width, 1) * 1.4)
        let stops: [Gradient.Stop] = shift >= 0
            ? [.init(color: .clear, location: 0), .init(color: .black, location: f), .init(color: .black, location: 1)]
            : [.init(color: .black, location: 0), .init(color: .black, location: 1 - f), .init(color: .clear, location: 1)]
        return LinearGradient(stops: stops, startPoint: .leading, endPoint: .trailing)
    }

    /// Ease the blend so the middle of the trip is a real mix, not a quick swap.
    private func smooth(_ t: Double) -> Double { t * t * (3 - 2 * t) }
}

/// An inner page (a step, a list, settings): painted head with back button and crumb, mono eyebrow, serif title, glass body.
public struct NKFlowFrame<Content: View>: View {
    let hue: Hue, crumb: String, eyebrow: String, title: String, sub: String
    let onBack: (() -> Void)?
    let content: Content
    public init(hue: Hue, crumb: String, eyebrow: String, title: String, sub: String, onBack: (() -> Void)?, @ViewBuilder content: () -> Content) {
        self.hue = hue; self.crumb = crumb; self.eyebrow = eyebrow; self.title = title; self.sub = sub; self.onBack = onBack; self.content = content()
    }
    public var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    Color.clear.frame(height: 360)
                        .overlay { PaintedLandscape(hue: hue) }
                        .clipped()
                        .mask(LinearGradient(stops: [.init(color: .black, location: 0.45), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                    VStack(spacing: 0) {
                        HStack {
                            if let onBack {
                                Button(action: onBack) {
                                    Image(systemName: "chevron.left").nkFont(16, .semibold).foregroundStyle(.white)
                                        .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                                }
                                .buttonStyle(.plain).accessibilityLabel("Vissza")
                            } else { Color.clear.frame(width: 44, height: 44) }
                            Spacer()
                            Text(crumb).nkFont(14, .medium).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
                            Spacer()
                            Color.clear.frame(width: 44, height: 44)
                        }
                        .padding(.horizontal, 16).padding(.top, 58)
                        VStack(spacing: 8) {
                            Text(eyebrow.uppercased()).nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                            Text(title).nkFont(40, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center).minimumScaleFactor(0.6)
                            Text(sub).nkFont(16).foregroundStyle(.white.opacity(0.85)).multilineTextAlignment(.center)
                        }
                        .padding(.horizontal, 24).padding(.top, 62)
                    }
                }
                VStack(spacing: 12) { content }
                    .padding(.horizontal, 16).padding(.top, -14).padding(.bottom, 60)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(NKGround(hue: hue))
        .preferredColorScheme(.dark)
    }
}

/// A detail sheet: 170 pt painted band with eyebrow + title, glass cards below.
/// Present with `.presentationDetents([.medium, .large])`, `.presentationBackground(NK.ground)`, `.presentationCornerRadius(34)`.
public struct NKSheetFrame<Content: View>: View {
    let hue: Hue, eyebrow: String, title: String, content: Content
    public init(hue: Hue, eyebrow: String, title: String, @ViewBuilder content: () -> Content) {
        self.hue = hue; self.eyebrow = eyebrow; self.title = title; self.content = content()
    }
    public var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.frame(height: 170).overlay { PaintedLandscape(hue: hue) }.clipped()
                        .overlay(LinearGradient(colors: [.clear, NK.ground], startPoint: .center, endPoint: .bottom))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(eyebrow.uppercased()).nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                        Text(title).nkFont(34, design: .serif).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 22).padding(.bottom, 8)
                }
                VStack(spacing: 12) { content }.padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 40)
            }
        }
        .scrollIndicators(.hidden)
        .background(NK.ground)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Bottom bar

/// The five domains as icons only (names stay for VoiceOver), on a glass capsule.
public struct NKNav: View {
    public struct Item: Sendable { public let label: String, glyph: String }
    public static let items: [Item] = [
        .init(label: "Nap", glyph: "sun-ink"), .init(label: "Edzés", glyph: "dumbbell-ink"), .init(label: "Fuel", glyph: "bowl-cream"),
        .init(label: "Boop", glyph: "chat-ink"), .init(label: "Én", glyph: "person-sage"),
    ]
    @Binding var selected: String
    /// The selection capsule glides from icon to icon instead of jumping.
    @Namespace private var pill
    public init(selected: Binding<String>) { self._selected = selected }
    public var body: some View {
        HStack(spacing: 0) {
            ForEach(Self.items, id: \.label) { it in
                let on = it.label == selected
                Button { selected = it.label } label: {
                    NKGlyph(it.glyph, .white.opacity(on ? 1 : 0.45), size: 22)
                        .frame(maxWidth: .infinity).frame(height: 46)
                        .background {
                            if on {
                                Capsule().fill(.white.opacity(0.12)).padding(.horizontal, 4)
                                    .matchedGeometryEffect(id: "pill", in: pill)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(it.label)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(5)
        .glassEffect(.regular, in: .capsule)
        .padding(.horizontal, 18)
        .padding(.bottom, 4)
        .sensoryFeedback(.selection, trigger: selected)
    }
}
