import SwiftUI

// Throwaway spike (mezo-r36n9.3): A2 "Napkelte" — the owner's pick (A) made our own.
// Boop's orb is the sun of the morning: it rises over a colour-graded full-screen photo, its liquid
// filled to the selected metric. The metric row is mini orbs; tapping one recolours the whole app
// (photo grade, orb, auras, headline, detail card) — the C idea, taken further.
// Launch: -aura YES -auraVariant 3 [-auraMetric 0...4]

struct SunMetric {
    let name: String, value: Int, unit: String, glyph: String
    let top: Color, glow: Color, orb: [Color]
    let headline: String, sentence: String
    let detail: Int        // 0 energy line, 1 hypnogram, 2 hourly bars, 3 fuel levels, 4 pulse line

    static let all: [SunMetric] = [
        SunMetric(name: "Készenlét", value: 78, unit: "", glyph: "spark-cream",
                  top: Color(hex: 0x2E2470), glow: Color(hex: 0x8B6CF0),
                  orb: [Color(hex: 0x2A1E6E), Color(hex: 0x6A4FD8), Color(hex: 0x9FB8FF), Color(hex: 0xF08BB4)],
                  headline: "Jó napod lesz",
                  sentence: "A mélyalvásod 18 perccel a heti átlag felett volt. A 18:00-s edzés belefér, de told 18:30-ra, ha teheted.",
                  detail: 0),
        SunMetric(name: "Alvás", value: 84, unit: "", glyph: "moon-cream",
                  top: Color(hex: 0x0F3552), glow: Color(hex: 0x4BA8E6),
                  orb: [Color(hex: 0x0B2C4F), Color(hex: 0x2A78C8), Color(hex: 0x8ED0F7), Color(hex: 0x6FD3B0)],
                  headline: "Kipihented magad",
                  sentence: "7 óra 12 perc, ebből 1 óra 36 perc mély. 22:48-kor aludtál el, 12 perccel korábban, mint szoktál.",
                  detail: 1),
        SunMetric(name: "Mozgás", value: 62, unit: "", glyph: "shoe-cream",
                  top: Color(hex: 0x4A2810), glow: Color(hex: 0xF29A4A),
                  orb: [Color(hex: 0x6B2A0E), Color(hex: 0xE0702E), Color(hex: 0xF7C27A), Color(hex: 0xF0508C)],
                  headline: "Van még benne több",
                  sentence: "1 240 lépésnél tartasz. Egy 20 perces séta ebéd után a napi cél felét hozza.",
                  detail: 2),
        SunMetric(name: "Fuel", value: 71, unit: "", glyph: "bowl-cream",
                  top: Color(hex: 0x123F33), glow: Color(hex: 0x4CC79A),
                  orb: [Color(hex: 0x0E3B2E), Color(hex: 0x2E9C74), Color(hex: 0xA6E8C8), Color(hex: 0xF4C860)],
                  headline: "Jó úton jársz",
                  sentence: "A fehérje 38 g-nál tart a 165-ből. Ebédnél egyél legalább 45 grammot, és a nap végére meglesz.",
                  detail: 3),
        SunMetric(name: "Pulzus", value: 57, unit: "", glyph: "heart-cream",
                  top: Color(hex: 0x4A1630), glow: Color(hex: 0xF06A9A),
                  orb: [Color(hex: 0x5A0F2E), Color(hex: 0xD8467A), Color(hex: 0xF7A8C4), Color(hex: 0xF7C27A)],
                  headline: "Nyugodt szív",
                  sentence: "A nyugalmi pulzusod 57, kettővel a heti átlagod alatt. A szombati edzést kiheverted.",
                  detail: 4),
    ]
}

struct AuraSunrise: View {
    var photoMode = 2          // 0 vivid mountain, 1 own photo per metric, 2 painted landscape
    @State private var sel = min(4, max(0, UserDefaults.standard.integer(forKey: "auraMetric")))
    @State private var motion = OrbMotion()
    @State private var orbKey = 0
    @State private var tab = min(3, max(0, UserDefaults.standard.integer(forKey: "auraTab")))
    private let base = Color(hex: 0x0D1218)
    private var m: SunMetric { SunMetric.all[sel] }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    if tab == 0 {
                        hero(height: geo.size.height + geo.safeAreaInsets.top - 30)
                        VStack(spacing: 12) {
                            voiceCard
                            detailCard
                            nextSteps
                            observation
                            nextCard
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 170)
                    } else {
                        AuraNapTab(tab: tab, header: AnyView(header))
                            .padding(.bottom, 170)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .defaultScrollAnchor(auraBottom ? .bottom : .top)
            .ignoresSafeArea(edges: .top)
            .background(pageBackground.ignoresSafeArea())
        }
        .preferredColorScheme(.dark)
        .onDisappear { motion.stop() }
    }

    private func pick(_ i: Int) {
        guard i != sel else { return }
        withAnimation(.spring(response: 0.7, dampingFraction: 0.82)) { sel = i }
        orbKey += 1
    }

    // MARK: Background: the page takes the selected metric's hue all the way down

    private var pageBackground: some View {
        ZStack {
            base
            LinearGradient(colors: [m.top.opacity(0.12), base], startPoint: .top, endPoint: .center)
        }
    }

    // MARK: Hero: colour-graded photo, the orb rising as the sun, the verdict

    private func hero(height: CGFloat) -> some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: height)
                .overlay { heroBackdrop }
                .clipped()
                .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.68),
                                                .init(color: base.opacity(0.4), location: 0.86),
                                                .init(color: base, location: 1)],
                                        startPoint: .top, endPoint: .bottom))

            VStack(spacing: 0) {
                header

                metricRow.padding(.top, 10)

                sun.frame(height: 290).padding(.top, 0).padding(.bottom, 18)

                Text(m.name.uppercased()).font(.system(size: 14, weight: .semibold)).tracking(2.6)
                    .foregroundStyle(.white.opacity(0.85)).padding(.top, 4)
                    .contentTransition(.opacity)
                Text(m.headline).font(AuraFont.serif(42)).foregroundStyle(.white).padding(.top, 10)
                    .contentTransition(.opacity)
                Text(m.sentence)
                    .font(.system(size: 17)).lineSpacing(4).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 30).padding(.top, 10)
                    .frame(height: 96, alignment: .top)
                    .contentTransition(.opacity)
                HStack(spacing: 10) {
                    LivingOrb(mood: .good, size: 20, motion: motion, palette: m.orb, glow: false, level: 0.85)
                    Text("Boop elmondja").font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.leading, 14).padding(.trailing, 24).padding(.vertical, 12)
                .background(Capsule().fill(.black.opacity(0.25)))
                .glassEffect(.clear, in: .capsule)
                .padding(.top, 8)
                Spacer(minLength: 0)
            }
            .frame(height: height)
        }
    }

    /// Title row + the Nap pages as thin text tabs with an underline (Oura's "Yesterday · Today" row, ours).
    private var header: some View {
        VStack(spacing: 10) {
            HStack {
                AuraGlyph("bell-cream", .white, size: 21).frame(width: 44, height: 44)
                Spacer()
                Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
                Spacer()
                AuraGlyph("person-sage", .white, size: 20).frame(width: 44, height: 44)
                    .glassEffect(.clear, in: .circle)
            }
            .padding(.horizontal, 16)
            HStack(spacing: 0) {
                ForEach(0..<4) { i in
                    let on = i == tab
                    VStack(spacing: 7) {
                        HStack(spacing: 4) {
                            Text(["Mai", "A napom", "Beszélgetés", "Rutin"][i])
                                .font(.system(size: 15, weight: on ? .semibold : .regular))
                            if i == 1 { Circle().fill(.white).frame(width: 5, height: 5).opacity(on ? 0 : 0.9) }
                        }
                        .foregroundStyle(.white.opacity(on ? 1 : 0.62))
                        Capsule().fill(.white).frame(height: 1).opacity(on ? 1 : 0)
                            .padding(.horizontal, 6)
                    }
                    .fixedSize()
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture { withAnimation(.easeInOut(duration: 0.3)) { tab = i } }
                }
            }
            .padding(.horizontal, 12)
        }
        .padding(.top, 58)
    }

    // MARK: Utána jön + Észrevétel

    private var nextSteps: some View {
        VStack(alignment: .leading, spacing: 0) {
            label("UTÁNA JÖN").padding(.bottom, 10)
            step("pen-sun", "Reggeli check-in", "4 kérdés · 1 perc", primary: true)
            divider
            step("moon-cream", "Alvás", "Beolvasva · 7ó 12p", done: true)
            divider
            step("spark-cream", "Mai szándék", "Mire figyelsz ma?")
            divider
            step("scale-ink", "Mérlegelés", "Utoljára: 82,4 kg")
            divider
            step("camera-ink", "Első étkezés", "Fotó vagy pár szó")
        }
        .padding(20)
        .background(card)
    }

    private var divider: some View { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.leading, 56) }

    private func step(_ g: String, _ t: String, _ sub: String, primary: Bool = false, done: Bool = false) -> some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(.white.opacity(done ? 0.18 : 0.08))
                AuraGlyph(done ? "check-ink" : g, .white, size: 18)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(t).font(.system(size: 16.5, weight: .medium)).foregroundStyle(.white.opacity(done ? 0.6 : 1))
                Text(sub).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.55))
            }
            Spacer()
            if primary {
                Text("Kitöltöm").font(.system(size: 14, weight: .semibold)).foregroundStyle(base)
                    .padding(.horizontal, 14).padding(.vertical, 9).background(Capsule().fill(.white))
            } else {
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(.vertical, 10)
    }

    private var observation: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                LivingOrb(mood: .good, size: 22, motion: motion, palette: m.orb, glow: false, level: 0.85)
                label("BOOP ÉSZREVETTE")
                Spacer()
                HStack(spacing: 4) { ForEach(0..<5) { k in Circle().fill(.white.opacity(k < 4 ? 0.85 : 0.2)).frame(width: 6, height: 6) } }
            }
            (Text("Amikor 23:00 előtt fekszel le, ") + Text("másnap 9 ponttal jobb a készenléted").bold().foregroundColor(.white) + Text(". Az elmúlt 3 hétben 4-ből 4 alkalommal így volt."))
                .font(AuraFont.serif(18)).lineSpacing(4).foregroundStyle(.white.opacity(0.75))
            HStack(spacing: 8) {
                chip("Igaz", filled: true); chip("Nem rólam szól"); chip("Majd meglátjuk")
            }
        }
        .padding(20)
        .background(card)
    }

    private func chip(_ t: String, filled: Bool = false) -> some View {
        Text(t).font(.system(size: 13.5, weight: .semibold))
            .foregroundStyle(filled ? base : .white)
            .padding(.horizontal, 13).padding(.vertical, 8)
            .background(Capsule().fill(filled ? .white : .white.opacity(0.1)))
    }

    /// Three ways to make the photo carry the page (owner: "vivid like Oura").
    @ViewBuilder private var heroBackdrop: some View {
        switch photoMode {
        case 1:
            let names = ["aura-hegy.jpg", "aura-alkony.jpg", "aura-futas.jpg", "aura-zold.jpg", "aura-erdo.jpg"]
            ZStack {
                ForEach(names.indices, id: \.self) { i in
                    photo(names[i]).resizable().scaledToFill()
                        .saturation(1.25).contrast(1.08)
                        .opacity(i == sel ? 1 : 0)
                }
            }
            .overlay(LinearGradient(colors: [.black.opacity(0.25), .clear], startPoint: .top, endPoint: .init(x: 0.5, y: 0.25)))
            .overlay(LinearGradient(colors: [.clear, .black.opacity(0.35)], startPoint: .init(x: 0.5, y: 0.35), endPoint: .bottom))
        case 2:
            PaintedLandscape(sky: PaintedLandscape.skies[sel])
        default:
            photo("aura-hegy.jpg").resizable().scaledToFill()
                .saturation(1.9).contrast(1.18).brightness(0.03)
                .overlay {
                    Rectangle()
                        .fill(LinearGradient(colors: [Color(hex: 0x1E5BD8).opacity(0.55), Color(hex: 0x3D8BFF).opacity(0.15), .clear],
                                             startPoint: .top, endPoint: .center))
                        .blendMode(.overlay)
                }
                .overlay(Rectangle().fill(m.glow).opacity(0.12).blendMode(.color))
        }
    }

    /// Mini orbs instead of outlined rings: each metric is a small liquid sphere, filled to its level.
    private var metricRow: some View {
        HStack(spacing: 0) {
                ForEach(SunMetric.all.indices, id: \.self) { i in
                    let x = SunMetric.all[i]
                    let on = i == sel
                    VStack(spacing: 7) {
                        ZStack {
                            if on {
                                LivingOrb(mood: .good, size: 46, motion: motion, palette: x.orb, glow: false,
                                          level: Double(x.value) / 100)
                                    .id(orbKey)
                            } else {
                                StillOrb(colors: x.orb, size: 46, level: Double(x.value) / 100)
                                    .saturation(0.25)
                                    .opacity(0.75)
                            }
                            Text("\(x.value)").font(.custom("Outfit", size: 17).weight(.medium)).foregroundStyle(.white)
                                .shadow(color: .black.opacity(0.45), radius: 4)
                        }
                        .allowsHitTesting(false)                    // the orb's own gestures swallowed the tap
                        Text(x.name).font(.system(size: 13, weight: on ? .semibold : .regular))
                            .foregroundStyle(.white.opacity(on ? 1 : 0.6))
                    }
                    .frame(maxWidth: .infinity)                     // five equal columns, edge to edge
                    .contentShape(Rectangle())
                    .onTapGesture { pick(i) }
                    .accessibilityAddTraits(.isButton)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
    }

    /// The orb as a rising sun: the better the value, the higher it stands; a weak value sinks it
    /// behind the horizon.
    private var sun: some View {
        GeometryReader { g in
            let H = g.size.height
            let size: CGFloat = 156
            let t = min(1, max(0, (CGFloat(m.value) - 40) / 60))
            let cy = H - 8 - t * (H - 8 - size / 2 - 6)          // t = 0: centre on the horizon
            ZStack(alignment: .topLeading) {
                ZStack {
                    Circle().fill(m.glow.opacity(0.18)).frame(width: size * 1.7).blur(radius: 60)
                    LivingOrb(mood: .good, size: size, motion: motion, palette: m.orb, glow: true,
                              level: Double(m.value) / 100)
                        .id(orbKey)
                    Text("\(m.value)").font(.custom("Outfit", size: 58).weight(.light)).foregroundStyle(.white)
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(m.value)))
                        .shadow(color: .black.opacity(0.35), radius: 10)
                        .allowsHitTesting(false)
                }
                .frame(width: g.size.width, height: size * 2)
                .position(x: g.size.width / 2, y: cy)
                .mask(alignment: .top) {
                    LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.93), .init(color: .clear, location: 1)],
                                   startPoint: .top, endPoint: .bottom)
                        .frame(height: H - 8 + 14)
                }

            }
        }
    }

    // MARK: Cards below — they follow the selected hue

    private var voiceCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                LivingOrb(mood: .good, size: 22, motion: motion, palette: m.orb, glow: false, level: 0.85)
                Text("BOOP MONDJA").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                Spacer()
            }
            (Text("Jól aludtál: a mélyalvás ") + Text("18 perccel a heti átlagod felett").bold().foregroundColor(.white)
             + Text(" volt, a pulzusod ") + Text("két ütéssel lejjebb").bold().foregroundColor(.white)
             + Text(" ment. A naptárad 9-től 17:30-ig tele, ezért ha teheted, ") + Text("told 18:30-ra").bold().foregroundColor(.white)
             + Text(" az edzést."))
                .font(AuraFont.serif(19)).lineSpacing(5).foregroundStyle(.white.opacity(0.75))
        }
        .padding(20)
        .background(card)
    }

    @ViewBuilder private var detailCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            switch m.detail {
            case 1:
                label("ALVÁSIDŐ")
                Text("7ó 12p").font(.custom("Outfit", size: 34).weight(.light)).foregroundStyle(.white)
                Hypnogram().frame(height: 110).padding(.top, 14)
                axis(["22:48", "2:00", "4:00", "6:53"])
            case 2:
                label("LÉPÉSEK ÓRÁNKÉNT")
                Text("1 240 / 9 000").font(.custom("Outfit", size: 34).weight(.light)).foregroundStyle(.white)
                HourBars(color: .white).frame(height: 110).padding(.top, 14)
                axis(["6", "9", "12", "15", "18", "21", "24"])
            case 3:
                label("MAI TÁPANYAGOK")
                Text("820 / 2 350 kcal").font(.custom("Outfit", size: 34).weight(.light)).foregroundStyle(.white)
                VStack(spacing: 14) {
                    level("Fehérje", 38, 165, "g")
                    level("Szénhidrát", 120, 260, "g")
                    level("Zsír", 30, 75, "g")
                }
                .padding(.top, 16)
            case 4:
                label("PULZUS ÉJSZAKA")
                Text("57 bpm").font(.custom("Outfit", size: 34).weight(.light)).foregroundStyle(.white)
                GlowLine(points: [0.7, 0.62, 0.5, 0.42, 0.36, 0.3, 0.28, 0.3, 0.27, 0.32, 0.4, 0.5], color: .white, nowAt: nil)
                    .frame(height: 110).padding(.top, 14)
                axis(["22:48", "2:00", "4:00", "6:53"])
            default:
                label("A NAP ENERGIÁJA")
                Text("Délelőtt csúcs, délután hullámvölgy").font(.system(size: 17, weight: .medium)).foregroundStyle(.white).padding(.top, 2)
                GlowLine(points: [0.35, 0.62, 0.82, 0.78, 0.6, 0.38, 0.5, 0.66, 0.55, 0.36, 0.2], color: .white, nowAt: 0.18)
                    .frame(height: 120).padding(.top, 14)
                axis(["6", "9", "12", "15", "18", "21", "24"])
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(card)
        .id(sel)
        .transition(.opacity)
    }

    private var nextCard: some View {
        HStack(spacing: 14) {
            AuraGlyph("dumbbell-ink", .white, size: 24).frame(width: 56, height: 56)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.12)))
            VStack(alignment: .leading, spacing: 3) {
                Text("Felsőtest · 18:00").font(.system(size: 17, weight: .medium)).foregroundStyle(.white)
                Text("Boop szerint 18:30 jobb lenne").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
            }
            Spacer()
            Text("Áttolom").font(.system(size: 14, weight: .semibold)).foregroundStyle(base)
                .padding(.horizontal, 14).padding(.vertical, 10).background(Capsule().fill(.white))
        }
        .padding(16)
        .background(card)
    }

    private func label(_ t: String) -> some View {
        Text(t).font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
    }

    private func axis(_ xs: [String]) -> some View {
        HStack { ForEach(xs.indices, id: \.self) { i in if i > 0 { Spacer() }; Text(xs[i]) } }
            .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
    }

    private func level(_ n: String, _ v: Double, _ goal: Double, _ u: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(n).font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                Spacer()
                Text("\(Int(v)) / \(Int(goal)) \(u)").font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.7))
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(.white.opacity(0.9))
                        .frame(width: g.size.width * v / goal)
                }
            }
            .frame(height: 8)
        }
    }

    private var card: some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(.white.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.03)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
    }
}

/// Smooth glowing line with a soft fill and an optional "most" marker (0...1 across).
struct GlowLine: View {
    var points: [Double]
    var color: Color
    var nowAt: Double?
    var body: some View {
        Canvas { ctx, s in
            func p(_ i: Int) -> CGPoint { CGPoint(x: s.width * Double(i) / Double(points.count - 1), y: s.height * (1 - points[i]) * 0.9 + 6) }
            var line = Path(); line.move(to: p(0))
            for i in 1..<points.count {
                let a = p(i - 1), b = p(i)
                line.addCurve(to: b, control1: CGPoint(x: (a.x + b.x) / 2, y: a.y), control2: CGPoint(x: (a.x + b.x) / 2, y: b.y))
            }
            var fill = line; fill.addLine(to: CGPoint(x: s.width, y: s.height)); fill.addLine(to: CGPoint(x: 0, y: s.height)); fill.closeSubpath()
            ctx.fill(fill, with: .linearGradient(Gradient(colors: [color.opacity(0.35), color.opacity(0)]), startPoint: .zero, endPoint: CGPoint(x: 0, y: s.height)))
            var glow = ctx
            glow.addFilter(.blur(radius: 6))
            glow.stroke(line, with: .color(color), lineWidth: 5)
            ctx.stroke(line, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            if let n = nowAt {
                let nx = s.width * n
                var now = Path(); now.move(to: CGPoint(x: nx, y: 0)); now.addLine(to: CGPoint(x: nx, y: s.height))
                ctx.stroke(now, with: .color(Color.white.opacity(0.5)), style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                ctx.draw(Text("MOST").font(AuraFont.mono(10, .bold)).foregroundColor(Color.white.opacity(0.8)), at: CGPoint(x: nx + 22, y: 8))
            }
        }
    }
}

/// Steps per hour: past hours lit, the rest a faint outline of the usual day.
struct HourBars: View {
    var color: Color
    private let v: [Double] = [0.1, 0.35, 0.55, 0.2, 0.15, 0.6, 0.3, 0.25, 0.4, 0.7, 0.8, 0.5, 0.3, 0.45, 0.6, 0.35, 0.2, 0.1]
    var body: some View {
        Canvas { ctx, s in
            let n = v.count
            let w = s.width / CGFloat(n)
            for i in 0..<n {
                let h = s.height * v[i]
                let r = CGRect(x: CGFloat(i) * w + w * 0.22, y: s.height - h, width: w * 0.56, height: h)
                let past = i < 4
                if past {
                    var g = ctx; g.addFilter(.blur(radius: 5))
                    g.fill(Path(roundedRect: r, cornerRadius: w * 0.28), with: .color(color.opacity(0.8)))
                    ctx.fill(Path(roundedRect: r, cornerRadius: w * 0.28), with: .color(.white))
                } else {
                    ctx.stroke(Path(roundedRect: r, cornerRadius: w * 0.28), with: .color(Color.white.opacity(0.18)), lineWidth: 1)
                }
            }
        }
    }
}

/// A still orb: the same shader frozen in one frame, for the inactive metrics.
struct StillOrb: View {
    var colors: [Color]
    var size: CGFloat
    var level: Double
    var body: some View {
        let c = colors + Array(repeating: colors.last ?? .white, count: max(0, 4 - colors.count))
        Rectangle()
            .frame(width: size, height: size)
            .colorEffect(ShaderLibrary.orb(
                .float2(size, size), .float(7.3),
                .color(c[0]), .color(c[1]), .color(c[2]), .color(c[3]),
                .float(Float(level)), .float(0), .float(0), .float(9), .float(0)))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// Our own painted landscape: a vivid sky in the metric's colours over layered, hazy ridges.
struct PaintedLandscape: View {
    var sky: [Color]
    static let skies: [[Color]] = [
        [Color(hex: 0x24308A), Color(hex: 0x6A6FE0), Color(hex: 0xF3B7CF)],
        [Color(hex: 0x0A2152), Color(hex: 0x2C6CC4), Color(hex: 0x9FD6F5)],
        [Color(hex: 0x2F57B0), Color(hex: 0xF09A55), Color(hex: 0xFFD98C)],
        [Color(hex: 0x15567A), Color(hex: 0x4FB9A2), Color(hex: 0xE9F3B4)],
        [Color(hex: 0x45277A), Color(hex: 0xD86E9C), Color(hex: 0xFFC6A6)],
    ]
    var body: some View {
        Canvas { ctx, s in
            let w = s.width, h = s.height
            ctx.fill(Path(CGRect(origin: .zero, size: s)),
                     with: .linearGradient(Gradient(stops: [.init(color: sky[0], location: 0), .init(color: sky[1], location: 0.45), .init(color: sky[2], location: 0.66)]),
                                           startPoint: .zero, endPoint: CGPoint(x: 0, y: h)))
            var glow = ctx
            glow.addFilter(.blur(radius: 60))
            glow.fill(Path(ellipseIn: CGRect(x: w * 0.1, y: h * 0.42, width: w * 0.8, height: h * 0.22)), with: .color(sky[2].opacity(0.9)))
            let layers: [(Double, Double, Double, Double, Double)] = [   // base y, amplitude, freq, phase, darkness
                (0.60, 0.05, 2.1, 0.4, 0.18), (0.66, 0.06, 3.3, 1.9, 0.34), (0.73, 0.05, 2.6, 3.1, 0.52), (0.82, 0.04, 4.2, 0.7, 0.72)]
            for (k, l) in layers.enumerated() {
                var p = Path()
                p.move(to: CGPoint(x: 0, y: h))
                for xi in stride(from: 0.0, through: w, by: 3) {
                    let t = xi / w * .pi * 2
                    let y = h * (l.0 - l.1 * (0.65 * sin(t * l.2 + l.3) + 0.3 * sin(t * l.2 * 2.1 + l.3 * 1.7) + 0.05 * sin(t * l.2 * 4.7)))
                    p.addLine(to: CGPoint(x: xi, y: y))
                }
                p.addLine(to: CGPoint(x: w, y: h)); p.closeSubpath()
                // far ridges melt into the sky, near ones are deep and dark (aerial perspective)
                var c = ctx
                c.addFilter(.blur(radius: CGFloat(3 - k) * 0.8))
                c.fill(p, with: .color(sky[1]))
                c.fill(p, with: .color(Color.black.opacity(l.4 * 0.95)))
                c.fill(p, with: .linearGradient(Gradient(colors: [sky[2].opacity(0.45 * (1 - l.4)), .clear]),
                                                startPoint: CGPoint(x: 0, y: h * (l.0 - l.1)), endPoint: CGPoint(x: 0, y: h * (l.0 + 0.08))))
                var hz = ctx; hz.addFilter(.blur(radius: 22))
                hz.fill(Path(CGRect(x: 0, y: h * (l.0 + 0.02), width: w, height: h * 0.03)), with: .color(sky[2].opacity(0.18)))
            }
        }
    }
}

// MARK: - The other Nap tabs, same language: a short painted head, glass cards below

struct AuraNapTab: View {
    var tab: Int
    var header: AnyView
    @State private var motion = OrbMotion()
    private let base = Color(hex: 0x0D1218)
    private var sky: [Color] { PaintedLandscape.skies[[0, 2, 0, 3][tab]] }

    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .top) {
                Color.clear.frame(height: 330)
                    .overlay { PaintedLandscape(sky: sky) }
                    .clipped()
                    .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.5), .init(color: base, location: 1)], startPoint: .top, endPoint: .bottom))
                VStack(spacing: 0) {
                    header
                    VStack(spacing: 6) {
                        Text(["", "A napom", "Beszélgetés", "Rutin"][tab]).font(AuraFont.serif(38)).foregroundStyle(.white)
                        Text(["", "Hétfő, november 9. · élő nézet", "Boop és a csapat", "Reggeli lánc · 3 / 5 kész"][tab])
                            .font(.system(size: 15)).foregroundStyle(.white.opacity(0.8))
                    }
                    .padding(.top, 70)
                }
            }
            VStack(spacing: 12) {
                switch tab {
                case 1: timeline
                case 2: chat
                default: routine
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, -10)
        }
        .onDisappear { motion.stop() }
    }

    private var timeline: some View {
        let rows: [(String, String, String, Bool)] = [
            ("06:53", "sun-ink", "Ébredés · 7ó 12p alvás", true), ("07:20", "check-ink", "Check-in · energia 7, hangulat 8", true),
            ("08:10", "bowl-cream", "Reggeli · zabkása, 32 g fehérje", true), ("09:00", "clock-ink", "Megbeszélések 17:30-ig · 6 esemény", false),
            ("12:30", "bowl-cream", "Ebéd · Boop: legalább 45 g fehérje", false), ("18:30", "dumbbell-ink", "Felsőtest edzés · 60 perc", false),
            ("22:45", "moon-cream", "Lefekvés", false)]
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(rows.indices, id: \.self) { i in
                let r = rows[i]
                HStack(alignment: .center, spacing: 14) {
                    Text(r.0).font(AuraFont.mono(13)).foregroundStyle(.white.opacity(r.3 ? 0.55 : 0.85)).frame(width: 48, alignment: .leading)
                    ZStack {
                        Circle().fill(.white.opacity(r.3 ? 0.16 : 0.07))
                        AuraGlyph(r.1, .white.opacity(r.3 ? 0.7 : 1), size: 16)
                    }
                    .frame(width: 36, height: 36)
                    Text(r.2).font(.system(size: 15.5)).foregroundStyle(.white.opacity(r.3 ? 0.55 : 1))
                    Spacer()
                }
                .padding(.vertical, 9)
                if i == 2 {
                    HStack(spacing: 8) {
                        Capsule().fill(.white).frame(width: 30, height: 2)
                        Text("MOST · 08:40").font(AuraFont.mono(11, .bold)).foregroundStyle(.white)
                        Capsule().fill(.white.opacity(0.3)).frame(height: 1)
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .padding(20)
        .background(glassCard)
    }

    private var chat: some View {
        VStack(alignment: .leading, spacing: 14) {
            bubble(boop: true, "Jó reggelt! Jól aludtál, a mélyalvásod a heti átlag felett volt. Átrakjam az edzést 18:30-ra?")
            bubble(boop: false, "Igen, és mit egyek ebédre, hogy meglegyen a fehérje?")
            bubble(boop: true, "Lazac rizzsel és salátával: kb. 42 g fehérje. Ha marad egy joghurt délutánra, pont kijön.")
            HStack {
                Text("Írj a Boopnak…").font(.system(size: 15)).foregroundStyle(.white.opacity(0.5))
                Spacer()
                AuraGlyph("chat-ink", .white, size: 18)
            }
            .padding(.horizontal, 18).padding(.vertical, 14)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
        }
        .padding(20)
        .background(glassCard)
    }

    private func bubble(boop: Bool, _ t: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            if boop { LivingOrb(mood: .good, size: 28, motion: motion, palette: SunMetric.all[0].orb, glow: false, level: 0.85) } else { Spacer(minLength: 40) }
            Text(t).font(.system(size: 15.5)).lineSpacing(3).foregroundStyle(.white.opacity(boop ? 0.9 : 1))
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(boop ? 0.07 : 0.16)))
            if boop { Spacer(minLength: 20) }
        }
    }

    private var routine: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 16) {
                Text("REGGELI LÁNC").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                HStack(spacing: 0) {
                    ForEach(0..<5) { k in
                        VStack(spacing: 8) {
                            ZStack {
                                Circle().fill(.white.opacity(k < 3 ? 0.9 : 0.08)).frame(width: 40, height: 40)
                                AuraGlyph(["drop-sky", "sun-ink", "person-sage", "pen-sun", "book-sage"][k], k < 3 ? base : .white, size: 17)
                            }
                            Text(["Víz", "Fény", "Nyújtás", "Szándék", "Olvasás"][k]).font(.system(size: 11.5)).fixedSize().foregroundStyle(.white.opacity(k < 3 ? 0.9 : 0.55))
                        }
                        if k < 4 { Rectangle().fill(.white.opacity(k < 2 ? 0.7 : 0.15)).frame(height: 1.5).padding(.bottom, 22).padding(.horizontal, -6) }
                    }
                }
            }
            .padding(20)
            .background(glassCard)
            VStack(alignment: .leading, spacing: 14) {
                Text("SZOKÁSOK EREJE · 28 NAP").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                strength("Reggeli víz", 0.86)
                strength("Lefekvés 23:00 előtt", 0.64)
                strength("Esti levezetés", 0.38)
            }
            .padding(20)
            .background(glassCard)
        }
    }

    private func strength(_ n: String, _ v: Double) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack { Text(n).font(.system(size: 15)).foregroundStyle(.white.opacity(0.9)); Spacer(); Text("\(Int(v * 100))%").font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.7)) }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(.white.opacity(0.9)).frame(width: g.size.width * v)
                }
            }
            .frame(height: 6)
        }
    }

    private var glassCard: some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(.white.opacity(0.07))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.03)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
    }
}
