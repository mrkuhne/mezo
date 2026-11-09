import SwiftUI

// MARK: - App shell: five domains in the floating bottom bar

struct LagyRoot: View {
    @State private var tab = UserDefaults.standard.string(forKey: "tab").flatMap { $0.isEmpty ? nil : $0 } ?? "Nap"
    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case "Edzés": LagyEdzesMai()
                case "Fuel": LagyFuelMai()
                case "Boop": LagyBoopWall()
                case "Én": LagyEnHub()
                default: LagyMai()
                }
            }
            .id(tab)
            LagyNav(selected: $tab)
        }
        .onAppear { Lagy.registerFonts() }
    }
}

struct LagyNav: View {
    @Binding var selected: String
    let items: [(String, String, String)] = [("Nap", "sun", "sun"), ("Edzés", "dumbbell", "berry"), ("Fuel", "plate", "deep"), ("Boop", "spark", "deep"), ("Én", "person", "sage")]
    var body: some View {
        HStack(spacing: 0) {
            ForEach(items, id: \.0) { it in
                let on = it.0 == selected
                Button { selected = it.0 } label: {
                    VStack(spacing: 2) {
                        Glyph(it.1, it.2, size: 26).opacity(on ? 1 : 0.75)
                        Text(it.0).font(.manrope(12, .bold)).foregroundStyle(on ? Lagy.deep : Lagy.mute)
                    }
                    .frame(maxWidth: .infinity).frame(height: 56).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(.horizontal, 6)
        .frame(height: 68)
        .background(Capsule().fill(.white.opacity(0.86)))
        .background(.ultraThinMaterial, in: Capsule())
        .shadow(color: Lagy.ink.opacity(0.22), radius: 20, y: 14)
        .padding(.horizontal, 14)
        .padding(.bottom, 4)
        .sensoryFeedback(.selection, trigger: selected)
    }
}

// MARK: - A domain tab page (Lágy `phead` skeleton) — photo head, verdict, sections, compact bar

struct TabHead {
    var photo: String
    var tabs: [String]
    var on: String
    var dot: String? = nil
    var eyebrow: String
    var title: String
    var sub: String
    var pill: String
    var pillGlyph: (String, String)
}

struct LagyTabPage<Content: View>: View {
    var head: TabHead
    var verdict: (String, String, String)
    var lead: String? = nil
    var pillAction: () -> Void = {}
    @ViewBuilder var content: Content
    @State private var scrolled = false

    var body: some View {
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
                    .background(UnevenRoundedRectangle(topLeadingRadius: 34, topTrailingRadius: 34, style: .continuous).fill(Lagy.paper))
                    .offset(y: -32).padding(.bottom, -32)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > 380 } action: { _, v in
                withAnimation(.easeInOut(duration: 0.2)) { scrolled = v }
            }
            HStack {
                Text(head.on).font(.outfit(17))
                Spacer()
                Text(head.tabs.first == head.on ? "Hétfő, 06:50" : "").font(.manrope(13, .bold)).foregroundStyle(Lagy.ink2)
            }
            .padding(.horizontal, 20).padding(.top, 58).padding(.bottom, 10)
            .background(.ultraThinMaterial)
            .overlay(alignment: .bottom) { Rectangle().fill(Lagy.ink.opacity(0.08)).frame(height: 0.5) }
            .ignoresSafeArea(edges: .top)
            .opacity(scrolled ? 1 : 0)
            .allowsHitTesting(false)
        }
        .background(Lagy.paper.ignoresSafeArea())
        .environment(\.colorScheme, .light)
        .preferredColorScheme(scrolled ? .light : .dark)
    }

    private var photoHead: some View {
        ZStack(alignment: .bottomLeading) {
            Color.clear.frame(height: 440)
                .overlay { photo(head.photo).resizable().scaledToFill().saturation(0.94).brightness(-0.03) }
                .clipped()
            LinearGradient(stops: [
                .init(color: Color(hex: 0x141A16).opacity(0.5), location: 0), .init(color: Color(hex: 0x141A16).opacity(0.22), location: 0.18),
                .init(color: .clear, location: 0.34), .init(color: .clear, location: 0.46),
                .init(color: Color(hex: 0x141A16).opacity(0.5), location: 0.66), .init(color: Color(hex: 0x141A16).opacity(0.85), location: 1),
            ], startPoint: .top, endPoint: .bottom)
            LinearGradient(colors: [Color(hex: 0x141A16).opacity(0.35), .clear], startPoint: .leading, endPoint: .init(x: 0.6, y: 0.5))
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    LagyMark(size: 32)
                    Text("boop").font(.outfit(21, .bold)).foregroundStyle(.white)
                    Spacer()
                    GlassCircle { Glyph("bell", "cream", size: 20) }
                    GlassCircle { Text("D").font(.outfit(15)) }
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
                    Text(head.sub).font(.manrope(13.5)).opacity(0.92)
                    Pill(title: head.pill, glyph: head.pillGlyph, onPhoto: true, action: pillAction).padding(.top, 6)
                }
                .foregroundStyle(.white)
                .padding(.bottom, 50)
                .entrance(0.05)
            }
            .padding(.horizontal, 20)
        }
        .frame(height: 440)
        .background(Lagy.photoGround)
    }
}

struct GlassCircle<C: View>: View {
    @ViewBuilder var c: C
    var body: some View {
        c.foregroundStyle(.white).frame(width: 40, height: 40)
            .background(Circle().fill(.white.opacity(0.18)).overlay(Circle().stroke(.white.opacity(0.28), lineWidth: 1)))
            .background(.ultraThinMaterial.opacity(0.4), in: Circle())
    }
}

/// Section on a tab page.
struct TabSection<C: View>: View {
    var title: String
    var link: String? = nil
    var delay: Double = 0.3
    @ViewBuilder var c: C
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title, link: link)
            c
        }
        .padding(.horizontal, 16).padding(.top, 26)
        .entrance(delay)
    }
}

/// Photo row (Lágy `.dlist.one .dl`).
struct PhotoRow: View {
    var img: String?
    var glyph: (String, String)? = nil
    var title: String
    var chips: [Chip]
    var chevron = true
    var body: some View {
        HStack(spacing: 12) {
            Group {
                if let img { photo(img).resizable().scaledToFill() }
                else if let g = glyph { Glyph(g.0, g.1, size: 24).frame(maxWidth: .infinity, maxHeight: .infinity).background(Lagy.sage3) }
            }
            .frame(width: 44, height: 44).clipShape(Circle())
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.outfit(15)).foregroundStyle(Lagy.ink).lineLimit(2)
                HStack(spacing: 6) { ForEach(Array(chips.enumerated()), id: \.offset) { $0.element } }
            }
            Spacer(minLength: 4)
            if chevron { Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Lagy.mute) }
        }
        .padding(.vertical, 12).padding(.leading, 12).padding(.trailing, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lagyCard(22)
    }
}

/// Segmented ring (macro / muscle split) for the deep card.
struct SegRing: View {
    var segs: [(Double, Color)]
    var val: String
    var unit: String
    var d: CGFloat = 104
    @State private var shown = false
    var body: some View {
        ZStack {
            Circle().stroke(.white.opacity(0.14), lineWidth: 10)
            ForEach(Array(segs.enumerated()), id: \.offset) { i, s in
                let start = segs.prefix(i).reduce(0) { $0 + $1.0 }
                Circle().trim(from: start + 0.006, to: shown ? max(start + 0.006, start + s.0 - 0.006) : start + 0.006)
                    .stroke(s.1, style: StrokeStyle(lineWidth: 10, lineCap: .butt))
                    .rotationEffect(.degrees(-90))
            }
            VStack(spacing: 0) {
                Text(val).font(.outfit(24)).monospacedDigit()
                Text(unit).font(.manrope(12, .bold)).opacity(0.7)
            }
            .foregroundStyle(.white)
        }
        .frame(width: d, height: d)
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 1.1).delay(0.3)) { shown = true } }
    }
}

/// Three-column card (Lágy `.trio`).
struct Trio: View {
    var items: [(String, String, String, String)]     // glyph, pal, value, label
    var tint: Color = Color(hex: 0xFDF3D8)
    var body: some View {
        HStack(spacing: 0) {
            ForEach(items, id: \.3) { it in
                VStack(spacing: 4) {
                    Glyph(it.0, it.1, size: 26)
                    Text(it.2).font(.outfit(17)).foregroundStyle(Lagy.ink)
                    Text(it.3).font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 16).lagyCard(fill: tint)
    }
}

/// Boop card for tab pages (static text, orb figure).
struct BoopCard: View {
    var pre: String, em: String, post: String
    var action: String
    @State private var motion = OrbMotion()
    @State private var done = false
    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) { Glyph("spark", "sage", size: 16); Text("BOOP") }
                    .font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(Lagy.deep)
                (Text(pre) + Text(em).foregroundColor(Lagy.deep) + Text(post))
                    .font(.outfit(15.5)).foregroundStyle(Lagy.ink).lineSpacing(2).fixedSize(horizontal: false, vertical: true)
                Pill(title: done ? "Rendben" : action, glyph: done ? ("check", "deep") : nil, soft: true) { withAnimation(.spring) { done = true } }
                    .padding(.top, 4).padding(.bottom, 18)
                    .sensoryFeedback(.success, trigger: done)
            }
            .padding(.leading, 18).padding(.top, 18)
            LivingOrb(mood: .good, size: 88, motion: motion, palette: Lagy.orbColors, glow: false, level: 0.92)
                .padding(.trailing, 10).padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [.white, Lagy.sage3], startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: Lagy.ink.opacity(0.10), radius: 18, y: 12)
        )
        .padding(.horizontal, 16).padding(.top, 26)
        .onDisappear { motion.stop() }
    }
}
