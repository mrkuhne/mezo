import SwiftUI

// MARK: - Inner page frame (Lágy `ihead sm`): photo head with back + crumb, paper body rising over it

struct LagyFlowFrame<Content: View>: View {
    var photoName: String
    var crumb: (String, String)          // ("Nap › Mai › ", "Check-in")
    var eyebrow: String
    var title: String
    var sub: String? = nil
    @ViewBuilder var content: Content
    @Environment(\.dismiss) private var dismiss
    @State private var scrolled = false

    var body: some View {
        ZStack(alignment: .top) {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.frame(height: 290)
                        .overlay { photo(photoName).resizable().scaledToFill().saturation(0.94).brightness(-0.03) }
                        .clipped()
                    LinearGradient(stops: [
                        .init(color: Color(hex: 0x141A16).opacity(0.55), location: 0), .init(color: .clear, location: 0.35),
                        .init(color: Color(hex: 0x141A16).opacity(0.45), location: 0.6), .init(color: Color(hex: 0x141A16).opacity(0.85), location: 1),
                    ], startPoint: .top, endPoint: .bottom)
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 10) {
                            Button { dismiss() } label: {
                                Image(systemName: "chevron.left").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                                    .frame(width: 40, height: 40)
                                    .background(Circle().fill(.white.opacity(0.2)).overlay(Circle().stroke(.white.opacity(0.28), lineWidth: 1)))
                                    .background(.ultraThinMaterial.opacity(0.4), in: Circle())
                            }
                            .buttonStyle(PressStyle())
                            .accessibilityLabel("Vissza")
                            (Text(crumb.0).foregroundColor(.white.opacity(0.8)) + Text(crumb.1).foregroundColor(.white).bold())
                                .font(.manrope(13, .semibold)).lineLimit(1)
                        }
                        .padding(.top, 60)
                        Spacer()
                        VStack(alignment: .leading, spacing: 6) {
                            Text(eyebrow.uppercased()).font(.manrope(12, .bold)).tracking(0.7).opacity(0.88)
                            Text(title).font(.outfit(29)).tracking(-0.7).shadow(color: .black.opacity(0.45), radius: 8, y: 2)
                                .contentTransition(.opacity)
                            if let sub { Text(sub).font(.manrope(13.5)).opacity(0.92) }
                        }
                        .foregroundStyle(.white)
                        .padding(.bottom, 48)
                    }
                    .padding(.horizontal, 20)
                }
                .frame(height: 290)
                .background(Lagy.photoGround)

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
            HStack(spacing: 10) {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left").font(.system(size: 15, weight: .bold)).foregroundStyle(Lagy.ink)
                        .frame(width: 40, height: 40).background(Circle().fill(Lagy.ink.opacity(0.06)))
                }
                .buttonStyle(PressStyle())
                Text(crumb.1).font(.outfit(17)).foregroundStyle(Lagy.ink)
                Spacer()
            }
            .padding(.horizontal, 16).padding(.top, 54).padding(.bottom, 8)
            .background(.ultraThinMaterial)
            .overlay(alignment: .bottom) { Rectangle().fill(Lagy.ink.opacity(0.08)).frame(height: 0.5) }
            .ignoresSafeArea(edges: .top)
            .opacity(scrolled ? 1 : 0)
            .allowsHitTesting(scrolled)
        }
        .background(Lagy.paper.ignoresSafeArea())
        .environment(\.colorScheme, .light)
        .preferredColorScheme(scrolled ? .light : .dark)
    }
}

/// Section inside an inner page: head + content, Lágy spacing.
struct LagySection<C: View>: View {
    var title: String
    var top: CGFloat = 24
    @ViewBuilder var c: C
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title)
            c
        }
        .padding(.top, top)
    }
}

/// Boop's card at the end of a page: label, the spoken + typed text, the orb as Boop's small figure.
struct BoopNote: View {
    var segs: [Seg]
    var mood: Mood
    var label = "BOOP"
    @State private var motion = OrbMotion()
    @State private var typer = Typer()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) { Glyph("spark", "sage", size: 16); Text(label) }
                    .font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(Lagy.deep)
                LagyVoiceText(segs: segs, shown: typer.shown, size: 15)
            }
            .padding(.leading, 18).padding(.vertical, 18)
            LivingOrb(mood: mood, size: 64, motion: motion, palette: Lagy.orbColors, glow: false, level: 0.92)
                .padding(.trailing, 12).padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [.white, Lagy.sage3], startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: Lagy.ink.opacity(0.10), radius: 18, y: 12)
        )
        .onAppear { typer.run(segs, motion: motion, instant: reduceMotion) }
        .onDisappear { motion.stop() }
    }
}

/// Full-width primary pill (ink), or soft.
struct WidePill: View {
    var title: String
    var glyph: (String, String)? = nil
    var soft = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let g = glyph { Glyph(g.0, g.1, size: 18) }
                Text(title).font(.manrope(15, .bold))
            }
            .frame(maxWidth: .infinity).frame(height: 54)
            .foregroundStyle(soft ? Lagy.deep : .white)
            .background(Capsule().fill(soft ? Lagy.sage3 : Lagy.ink))
            .shadow(color: soft ? .clear : .black.opacity(0.3), radius: 12, y: 10)
        }
        .buttonStyle(PressStyle())
    }
}

/// Ring + value in the middle (Lágy `ring`).
struct LagyRing: View {
    var d: CGFloat = 104
    var sw: CGFloat = 10
    var p: Double
    var color: Color = Lagy.sage2
    var track: Color = .white.opacity(0.14)
    var val: String
    var unit: String
    var onDeep = true
    @State private var shown = false
    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: sw)
            Circle().trim(from: 0, to: shown ? min(1, p) : 0)
                .stroke(color, style: StrokeStyle(lineWidth: sw, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text(val).font(.outfit(24)).monospacedDigit()
                Text(unit).font(.manrope(12, .bold)).opacity(0.7)
            }
            .foregroundStyle(onDeep ? .white : Lagy.ink)
        }
        .frame(width: d, height: d)
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 1.1).delay(0.3)) { shown = true } }
    }
}

/// Small level tube (Lágy `.jar .tb`), draggable when a binding is given.
struct JarTube: View {
    var frac: Double
    var w: CGFloat = 46
    var h: CGFloat = 120
    var warm = false
    var body: some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Lagy.paper)
            Rectangle()
                .fill(LinearGradient(colors: warm ? [Lagy.peach2, Lagy.peach] : [Lagy.sage2, Lagy.sage], startPoint: .top, endPoint: .bottom))
                .frame(height: h * min(1, max(0, frac)))
                .animation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.35), value: frac)
        }
        .frame(width: w, height: h)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
