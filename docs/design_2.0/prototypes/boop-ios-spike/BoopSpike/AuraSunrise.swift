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
    @State private var sel = min(4, max(0, UserDefaults.standard.integer(forKey: "auraMetric")))
    @State private var motion = OrbMotion()
    @State private var orbKey = 0
    private let base = Color(hex: 0x0D1218)
    private var m: SunMetric { SunMetric.all[sel] }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    hero(height: geo.size.height + geo.safeAreaInsets.top - 30)
                    VStack(spacing: 12) {
                        voiceCard
                        detailCard
                        nextCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 170)
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
                .overlay {
                    photo("aura-hegy.jpg").resizable().scaledToFill()
                        .overlay(Rectangle().fill(m.glow).opacity(0.16).blendMode(.color))    // a whisper of the metric's hue
                        .overlay(LinearGradient(colors: [.black.opacity(0.3), .clear], startPoint: .top, endPoint: .init(x: 0.5, y: 0.3)))
                }
                .clipped()
                .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.6),
                                                .init(color: base.opacity(0.45), location: 0.84),
                                                .init(color: base, location: 1)],
                                        startPoint: .top, endPoint: .bottom))

            VStack(spacing: 0) {
                HStack {
                    AuraGlyph("bell-cream", .white, size: 21).frame(width: 44, height: 44)
                    Spacer()
                    Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
                    Spacer()
                    AuraGlyph("person-sage", .white, size: 20).frame(width: 44, height: 44)
                        .glassEffect(.clear, in: .circle)
                }
                .padding(.horizontal, 16)
                .padding(.top, 58)

                metricRow.padding(.top, 14)

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

    /// Mini orbs instead of outlined rings: each metric is a small liquid sphere, filled to its level.
    private var metricRow: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 12) {
                ForEach(SunMetric.all.indices, id: \.self) { i in
                    let x = SunMetric.all[i]
                    let on = i == sel
                    VStack(spacing: 7) {
                        ZStack {
                            if on {
                                LivingOrb(mood: .good, size: 58, motion: motion, palette: x.orb, glow: false,
                                          level: Double(x.value) / 100)
                                    .id(orbKey)
                            } else {
                                StillOrb(colors: x.orb, size: 58, level: Double(x.value) / 100)
                                    .saturation(0.25)
                                    .opacity(0.75)
                            }
                            Text("\(x.value)").font(.custom("Outfit", size: 21).weight(.medium)).foregroundStyle(.white)
                                .shadow(color: .black.opacity(0.45), radius: 4)
                        }
                        .allowsHitTesting(false)                    // the orb's own gestures swallowed the tap
                        .padding(5)
                        .overlay(Circle().stroke(.white.opacity(on ? 0.85 : 0.18), lineWidth: on ? 1.5 : 1))
                        Text(x.name).font(.system(size: 13, weight: on ? .semibold : .regular))
                            .foregroundStyle(.white.opacity(on ? 1 : 0.6))
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { pick(i) }
                    .accessibilityAddTraits(.isButton)
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 8)
        }
        .scrollIndicators(.hidden)
    }

    /// The orb as a rising sun: the better the value, the higher it stands; a weak value sinks it
    /// behind the horizon.
    private var sun: some View {
        GeometryReader { g in
            let H = g.size.height
            let size: CGFloat = 190
            let t = min(1, max(0, (CGFloat(m.value) - 40) / 60))
            let cy = H - 8 - t * (H - 8 - size / 2 - 6)          // t = 0: centre on the horizon
            ZStack(alignment: .topLeading) {
                ZStack {
                    Circle().fill(m.glow.opacity(0.18)).frame(width: size * 1.7).blur(radius: 60)
                    LivingOrb(mood: .good, size: size, motion: motion, palette: m.orb, glow: true,
                              level: Double(m.value) / 100)
                        .id(orbKey)
                    Text("\(m.value)").font(.custom("Outfit", size: 70).weight(.light)).foregroundStyle(.white)
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

                Rectangle().fill(LinearGradient(colors: [.clear, .white.opacity(0.45), .clear], startPoint: .leading, endPoint: .trailing))
                    .frame(width: g.size.width, height: 1).offset(y: H - 8)
                HStack { Text("0"); Spacer(); Text("100") }
                    .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.5))
                    .padding(.horizontal, 28).frame(width: g.size.width).offset(y: H + 0)
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
