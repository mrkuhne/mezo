import SwiftUI

// MARK: - Domain tab page (Lágy `phead`): photo head with tabs, verdict, sections, compact bar

public struct TabHead {
    public var photo: String, tabs: [String], on: String, dot: String?
    public var eyebrow: String, title: String, sub: String
    public var pill: String?, pillGlyph: (String, String)?, pillEnabled: Bool
    public var compactTrailing: String
    public init(photo: String, tabs: [String], on: String, dot: String? = nil, eyebrow: String, title: String, sub: String,
                pill: String? = nil, pillGlyph: (String, String)? = nil, pillEnabled: Bool = true, compactTrailing: String = "") {
        self.photo = photo; self.tabs = tabs; self.on = on; self.dot = dot; self.eyebrow = eyebrow; self.title = title; self.sub = sub
        self.pill = pill; self.pillGlyph = pillGlyph; self.pillEnabled = pillEnabled; self.compactTrailing = compactTrailing
    }
}

public struct LagyTabPage<Content: View>: View {
    let head: TabHead
    let verdict: (String, String, String)
    let lead: String?
    let pillAction: () -> Void
    let content: Content
    @State private var scrolled = false

    public init(head: TabHead, verdict: (String, String, String), lead: String? = nil, pillAction: @escaping () -> Void = {}, @ViewBuilder content: () -> Content) {
        self.head = head; self.verdict = verdict; self.lead = lead; self.pillAction = pillAction; self.content = content()
    }

    public var body: some View {
        ZStack(alignment: .top) {
            ScrollView {
                VStack(spacing: 0) {
                    photoHead
                    VStack(alignment: .leading, spacing: 0) {
                        (Text(verdict.0) + Text(verdict.1).foregroundColor(Lagy.deep) + Text(verdict.2))
                            .font(.outfit(28)).tracking(-0.7).foregroundStyle(Lagy.ink)
                            .frame(maxWidth: 360, alignment: .leading)
                            .padding(.horizontal, 20).padding(.top, 16).entrance(0.1)
                        if let lead {
                            Text(lead).font(.manrope(14.5)).foregroundStyle(Lagy.ink2)
                                .padding(.horizontal, 20).padding(.top, 8).entrance(0.15)
                        }
                        content
                    }
                    .padding(.bottom, 120)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(UnevenRoundedRectangle(topLeadingRadius: 34, topTrailingRadius: 34, style: .continuous).fill(Lagy.paper))
                    .offset(y: -32).padding(.bottom, -32)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > 380 } action: { _, v in
                withAnimation(.easeInOut(duration: 0.2)) { scrolled = v }
            }
            CompactBar(title: head.on, trailing: head.compactTrailing).opacity(scrolled ? 1 : 0).allowsHitTesting(false)
        }
        .background(Lagy.paper.ignoresSafeArea())
        .environment(\.colorScheme, .light)
        .preferredColorScheme(scrolled ? .light : .dark)
    }

    private var photoHead: some View {
        ZStack(alignment: .bottomLeading) {
            PhotoBackdrop(name: head.photo, height: 440)
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    LagyMark(size: 32)
                    Text("boop").font(.outfit(21, .bold)).foregroundStyle(.white)
                    Spacer()
                }
                .padding(.top, 62)
                HStack(spacing: 4) {
                    ForEach(head.tabs, id: \.self) { t in
                        Text(t).font(.manrope(head.tabs.count > 4 ? 12 : 12.5, .bold)).lineLimit(1).minimumScaleFactor(0.85)
                            .frame(maxWidth: .infinity).frame(height: 40)
                            .foregroundStyle(t == head.on ? Lagy.ink : .white.opacity(0.86))
                            .background(Capsule().fill(t == head.on ? .white : .clear))
                            .overlay(alignment: .topTrailing) {
                                if t == head.dot { Circle().fill(Lagy.peach).frame(width: 7, height: 7).offset(x: -4, y: 8) }
                            }
                    }
                }
                .padding(4)
                .background(Capsule().fill(.white.opacity(0.14)).overlay(Capsule().stroke(.white.opacity(0.14), lineWidth: 1)))
                .background(.ultraThinMaterial.opacity(0.35), in: Capsule())
                .padding(.top, 14)
                Spacer()
                VStack(alignment: .leading, spacing: 7) {
                    Text(head.eyebrow.uppercased()).font(.manrope(12, .bold)).tracking(0.7).opacity(0.88)
                    Text(head.title).font(.outfit(31)).tracking(-0.8).shadow(color: .black.opacity(0.45), radius: 8, y: 2)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(head.sub).font(.manrope(13.5)).opacity(0.92)
                    if let pill = head.pill {
                        Pill(title: pill, glyph: head.pillGlyph, onPhoto: true, action: pillAction)
                            .disabled(!head.pillEnabled).opacity(head.pillEnabled ? 1 : 0.7)
                            .padding(.top, 6)
                    }
                }
                .foregroundStyle(.white)
                .padding(.bottom, 50)
                .entrance(0.05)
            }
            .padding(.horizontal, 20)
        }
        .frame(height: 440)
    }
}

/// Photo with the Lágy grade and scrims (bottom + left).
public struct PhotoBackdrop: View {
    let name: String, height: CGFloat
    public init(name: String, height: CGFloat) { self.name = name; self.height = height }
    public var body: some View {
        ZStack {
            Lagy.photoGround
            Color.clear.overlay { photo(name).resizable().scaledToFill().saturation(0.94).brightness(-0.03) }.clipped()
            LinearGradient(stops: [
                .init(color: Lagy.scrim.opacity(0.5), location: 0), .init(color: Lagy.scrim.opacity(0.22), location: 0.18),
                .init(color: .clear, location: 0.34), .init(color: .clear, location: 0.46),
                .init(color: Lagy.scrim.opacity(0.5), location: 0.66), .init(color: Lagy.scrim.opacity(0.85), location: 1),
            ], startPoint: .top, endPoint: .bottom)
            LinearGradient(colors: [Lagy.scrim.opacity(0.35), .clear], startPoint: .leading, endPoint: .init(x: 0.6, y: 0.5))
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
    }
}

struct CompactBar<Leading: View>: View {
    let title: String, trailing: String
    let leading: Leading
    init(title: String, trailing: String = "", @ViewBuilder leading: () -> Leading = { EmptyView() }) {
        self.title = title; self.trailing = trailing; self.leading = leading()
    }
    var body: some View {
        HStack(spacing: 10) {
            leading
            Text(title).font(.outfit(17)).foregroundStyle(Lagy.ink)
            Spacer()
            Text(trailing).font(.manrope(13, .bold)).foregroundStyle(Lagy.ink2)
        }
        .padding(.horizontal, 20).padding(.top, 58).padding(.bottom, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) { Rectangle().fill(Lagy.ink.opacity(0.08)).frame(height: 0.5) }
        .ignoresSafeArea(edges: .top)
    }
}

/// Section on a tab page.
public struct TabSection<C: View>: View {
    let title: String, link: String?, delay: Double, linkAction: () -> Void
    let c: C
    public init(title: String, link: String? = nil, delay: Double = 0.3, linkAction: @escaping () -> Void = {}, @ViewBuilder _ c: () -> C) {
        self.title = title; self.link = link; self.delay = delay; self.linkAction = linkAction; self.c = c()
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title, link: link, action: linkAction)
            c
        }
        .padding(.horizontal, 16).padding(.top, 26)
        .entrance(delay)
    }
}

// MARK: - Inner page (Lágy `ihead sm`): photo head with back + crumb, paper body

public struct LagyFlowFrame<Content: View>: View {
    let photoName: String, crumb: (String, String), eyebrow: String, title: String, sub: String?
    let showsBack: Bool
    let onBack: (() -> Void)?
    let content: Content
    @Environment(\.dismiss) private var dismiss
    @State private var scrolled = false

    public init(photoName: String, crumb: (String, String), eyebrow: String, title: String, sub: String? = nil,
                showsBack: Bool = true, onBack: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.photoName = photoName; self.crumb = crumb; self.eyebrow = eyebrow; self.title = title; self.sub = sub
        self.showsBack = showsBack; self.onBack = onBack; self.content = content()
    }

    private func back() { if let onBack { onBack() } else { dismiss() } }

    public var body: some View {
        ZStack(alignment: .top) {
            ScrollView {
                VStack(spacing: 0) {
                    ZStack(alignment: .bottomLeading) {
                        PhotoBackdrop(name: photoName, height: 290)
                        VStack(alignment: .leading, spacing: 0) {
                            HStack(spacing: 10) {
                                if showsBack {
                                    Button(action: back) {
                                        Image(systemName: "chevron.left").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                                            .frame(width: 40, height: 40)
                                            .background(Circle().fill(.white.opacity(0.2)).overlay(Circle().stroke(.white.opacity(0.28), lineWidth: 1)))
                                    }
                                    .buttonStyle(PressStyle())
                                    .accessibilityLabel("Vissza")
                                }
                                (Text(crumb.0).foregroundColor(.white.opacity(0.8)) + Text(crumb.1).foregroundColor(.white).bold())
                                    .font(.manrope(13, .semibold)).lineLimit(1)
                            }
                            .frame(minHeight: 40)
                            .padding(.top, 60)
                            Spacer()
                            VStack(alignment: .leading, spacing: 6) {
                                Text(eyebrow.uppercased()).font(.manrope(12, .bold)).tracking(0.7).opacity(0.88)
                                Text(title).font(.outfit(29)).tracking(-0.7).shadow(color: .black.opacity(0.45), radius: 8, y: 2)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let sub { Text(sub).font(.manrope(13.5)).opacity(0.92) }
                            }
                            .foregroundStyle(.white)
                            .padding(.bottom, 48)
                        }
                        .padding(.horizontal, 20)
                    }
                    .frame(minHeight: 290)

                    VStack(alignment: .leading, spacing: 0) { content }
                        .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 50)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(UnevenRoundedRectangle(topLeadingRadius: 34, topTrailingRadius: 34, style: .continuous).fill(Lagy.paper))
                        .offset(y: -32).padding(.bottom, -32)
                }
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .ignoresSafeArea(edges: .top)
            .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > 230 } action: { _, v in
                withAnimation(.easeInOut(duration: 0.2)) { scrolled = v }
            }
            CompactBar(title: crumb.1) {
                if showsBack {
                    Button(action: back) {
                        Image(systemName: "chevron.left").font(.system(size: 15, weight: .bold)).foregroundStyle(Lagy.ink)
                            .frame(width: 40, height: 40).background(Circle().fill(Lagy.ink.opacity(0.06)))
                    }
                    .buttonStyle(PressStyle())
                }
            }
            .opacity(scrolled ? 1 : 0)
            .allowsHitTesting(scrolled)
        }
        .background(Lagy.paper.ignoresSafeArea())
        .environment(\.colorScheme, .light)
        .preferredColorScheme(scrolled ? .light : .dark)
    }
}

/// Section inside an inner page.
public struct LagySection<C: View>: View {
    let title: String, top: CGFloat
    let c: C
    public init(title: String, top: CGFloat = 24, @ViewBuilder _ c: () -> C) { self.title = title; self.top = top; self.c = c() }
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) { SectionHeader(title: title); c }.padding(.top, top)
    }
}

/// Boop's card at the end of a page: label, one sentence with a deep-green phrase, an optional soft action, the orb as Boop's figure.
public struct BoopCard: View {
    let pre: String, em: String, post: String, action: String?, onAction: () -> Void
    public init(pre: String, em: String, post: String, action: String? = nil, onAction: @escaping () -> Void = {}) {
        self.pre = pre; self.em = em; self.post = post; self.action = action; self.onAction = onAction
    }
    public var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) { Glyph("spark", "sage", size: 16); Text("BOOP") }
                    .font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(Lagy.deep)
                (Text(pre) + Text(em).foregroundColor(Lagy.deep) + Text(post))
                    .font(.outfit(15.5)).foregroundStyle(Lagy.ink).lineSpacing(2).fixedSize(horizontal: false, vertical: true)
                if let action { Pill(title: action, soft: true, action: onAction).padding(.top, 4) }
            }
            .padding(.leading, 18).padding(.vertical, 18)
            BoopFigure(size: 84).padding(.trailing, 10).padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [.white, Lagy.sage3], startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: Lagy.ink.opacity(0.10), radius: 18, y: 12)
        )
    }
}

/// A Lágy error card with one retry action.
public struct ErrorCard: View {
    let title: String, text: String, action: String, onAction: () -> Void
    public init(title: String, text: String, action: String = "Újra", onAction: @escaping () -> Void) {
        self.title = title; self.text = text; self.action = action; self.onAction = onAction
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Glyph("repeat", "peach", size: 30)
            Text(title).font(.outfit(18)).foregroundStyle(Lagy.ink)
            Text(text).font(.manrope(14, .medium)).foregroundStyle(Lagy.ink2).fixedSize(horizontal: false, vertical: true)
            Pill(title: action, soft: true, action: onAction).padding(.top, 4)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .lagyCard(fill: Lagy.peach2)
    }
}
