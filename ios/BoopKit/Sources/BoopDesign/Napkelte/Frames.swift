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
                            Text("\(bellCount)").font(.system(size: 10, weight: .bold)).foregroundStyle(NK.ground)
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
                        Text(t).font(.system(size: 15, weight: on ? .semibold : .regular)).lineLimit(1).minimumScaleFactor(0.6)
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

    public init(hue: Hue, heroHeight: CGFloat?, compact: NKCompact?, @ViewBuilder hero: () -> Hero, @ViewBuilder content: () -> Content) {
        self.hue = hue; self.heroHeight = heroHeight; self.compact = compact; self.hero = hero(); self.content = content()
    }

    public var body: some View {
        GeometryReader { geo in
            let h = heroHeight ?? (geo.size.height + geo.safeAreaInsets.top - 30)
            ScrollView {
                VStack(spacing: 0) {
                    ZStack(alignment: .top) {
                        Color.clear.frame(height: h)
                            .overlay { PaintedLandscape(hue: hue) }
                            .clipped()
                            .mask(LinearGradient(stops: [.init(color: .black, location: 0.62), .init(color: .clear, location: 1)],
                                                 startPoint: .top, endPoint: .bottom))
                        hero.frame(height: h, alignment: .top)
                    }
                    VStack(spacing: 16) { content }
                        .padding(.horizontal, 16)
                        .background(FloatingLights(hue: hue).padding(.horizontal, -16).padding(.vertical, -120))
                    MirroredLand(hue: hue).padding(.top, 20)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            .background(NKGround(hue: hue))
            .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > h - 120 } action: { _, v in
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { showCompact = v }
            }
            .overlay(alignment: .top) {
                if showCompact, let c = compact {
                    HStack(spacing: 10) {
                        StillOrb(palette: c.palette, size: 26, level: 0.8)
                        Text(c.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        Text(c.value).font(.nkNumber(17)).foregroundStyle(.white.opacity(0.8))
                        Text("· \(c.line)").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
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
                                    Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                                        .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                                }
                                .buttonStyle(.plain).accessibilityLabel("Vissza")
                            } else { Color.clear.frame(width: 44, height: 44) }
                            Spacer()
                            Text(crumb).font(.system(size: 14, weight: .medium)).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
                            Spacer()
                            Color.clear.frame(width: 44, height: 44)
                        }
                        .padding(.horizontal, 16).padding(.top, 58)
                        VStack(spacing: 8) {
                            Text(eyebrow.uppercased()).font(.nkMono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                            Text(title).font(.nkSerif(40)).foregroundStyle(.white).multilineTextAlignment(.center).minimumScaleFactor(0.6)
                            Text(sub).font(.system(size: 16)).foregroundStyle(.white.opacity(0.85)).multilineTextAlignment(.center)
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
                        Text(eyebrow.uppercased()).font(.nkMono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                        Text(title).font(.nkSerif(34)).foregroundStyle(.white)
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
    public init(selected: Binding<String>) { self._selected = selected }
    public var body: some View {
        HStack(spacing: 0) {
            ForEach(Self.items, id: \.label) { it in
                let on = it.label == selected
                Button { selected = it.label } label: {
                    NKGlyph(it.glyph, .white.opacity(on ? 1 : 0.45), size: 22)
                        .frame(maxWidth: .infinity).frame(height: 46)
                        .background { if on { Capsule().fill(.white.opacity(0.12)).padding(.horizontal, 4) } }
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
