import SwiftUI

// Throwaway spike (mezo-r36n9.3, 2026-11-09): three takes on Boop's morning after the owner's
// Oura + Ultrahuman references. A = "Éj" (Oura: dark, full-screen photo, arc gauge, serif verdict),
// B = "Nappal" (Ultrahuman: light, marbled orb with one word, three scores + trend triangles),
// C = "Aura" (the mix: dark glass, photo melting into a page hue, orb hero, coloured auras).
// Launch: -aura YES -auraVariant 0|1|2 [-auraHue 0|1|2]

// MARK: - Shared bits

let auraBottom = UserDefaults.standard.bool(forKey: "auraBottom")   // verification: open scrolled to the end

enum AuraFont {
    static func serif(_ s: CGFloat, _ w: Font.Weight = .regular) -> Font { .system(size: s, weight: w, design: .serif) }
    static func mono(_ s: CGFloat, _ w: Font.Weight = .medium) -> Font { .system(size: s, weight: w, design: .monospaced) }
}

struct AuraGlyph: View {
    var name: String
    var color: Color
    var size: CGFloat = 18
    init(_ name: String, _ color: Color, size: CGFloat = 18) { self.name = name; self.color = color; self.size = size }
    /// Glyphs whose Lágy artwork relies on white inner detail flatten into a blob when tinted;
    /// on dark glass they are drawn as thin outlines instead (64-unit grid, like the sprite).
    private static let outlined: Set<String> = ["check-ink", "clock-ink", "camera-ink", "book-sage"]
    var body: some View {
        if Self.outlined.contains(name) {
            Canvas { ctx, s in
                let k = s.width / 64
                func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
                let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
                switch name {
                case "check-ink":
                    ctx.stroke(P { $0.addEllipse(in: CGRect(x: 9, y: 9, width: 46, height: 46)) }, with: .color(color), style: st)
                    ctx.stroke(P { $0.move(to: CGPoint(x: 21, y: 33)); $0.addLine(to: CGPoint(x: 28, y: 40)); $0.addLine(to: CGPoint(x: 43, y: 24)) }, with: .color(color), style: st)
                case "clock-ink":
                    ctx.stroke(P { $0.addEllipse(in: CGRect(x: 9, y: 9, width: 46, height: 46)) }, with: .color(color), style: st)
                    ctx.stroke(P { $0.move(to: CGPoint(x: 32, y: 20)); $0.addLine(to: CGPoint(x: 32, y: 32)); $0.addLine(to: CGPoint(x: 40, y: 37)) }, with: .color(color), style: st)
                case "camera-ink":
                    ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 8, y: 18, width: 48, height: 34), cornerSize: CGSize(width: 10, height: 10)) }, with: .color(color), style: st)
                    ctx.stroke(P { $0.addEllipse(in: CGRect(x: 23, y: 26, width: 18, height: 18)) }, with: .color(color), style: st)
                    ctx.fill(P { $0.addRoundedRect(in: CGRect(x: 23, y: 11, width: 18, height: 8), cornerSize: CGSize(width: 4, height: 4)) }, with: .color(color))
                default:
                    ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 14, y: 10, width: 36, height: 44), cornerSize: CGSize(width: 8, height: 8)) }, with: .color(color), style: st)
                    ctx.stroke(P { $0.move(to: CGPoint(x: 24, y: 24)); $0.addLine(to: CGPoint(x: 40, y: 24)); $0.move(to: CGPoint(x: 24, y: 32)); $0.addLine(to: CGPoint(x: 40, y: 32)); $0.move(to: CGPoint(x: 24, y: 40)); $0.addLine(to: CGPoint(x: 32, y: 40)) }, with: .color(color), style: st)
                }
            }
            .frame(width: size, height: size).accessibilityHidden(true)
        } else {
            Image("g-\(name)").renderingMode(.template).resizable().scaledToFit()
                .foregroundStyle(color).frame(width: size, height: size).accessibilityHidden(true)
        }
    }
}

/// Trend triangle like Ultrahuman's: up = better than yesterday.
struct Trend: View {
    var up: Bool
    var size: CGFloat = 9
    var body: some View {
        Path { p in
            if up { p.move(to: CGPoint(x: size / 2, y: 0)); p.addLine(to: CGPoint(x: size, y: size)); p.addLine(to: CGPoint(x: 0, y: size)) }
            else { p.move(to: .zero); p.addLine(to: CGPoint(x: size, y: 0)); p.addLine(to: CGPoint(x: size / 2, y: size)) }
            p.closeSubpath()
        }
        .fill(LinearGradient(colors: up ? [Color(hex: 0x43C59E), Color(hex: 0x167A5F)] : [Color(hex: 0xF0508C), Color(hex: 0xA8195A)],
                             startPoint: .top, endPoint: .bottom))
        .frame(width: size, height: size)
    }
}

/// Sleep stages, the Oura way: stepped bars, awake on top, deep at the bottom.
struct Hypnogram: View {
    var light = false
    static let segs: [(Int, Double)] = [(0, 8), (2, 22), (3, 38), (2, 30), (1, 14), (0, 4), (2, 26), (3, 30), (2, 34), (1, 22),
                                        (0, 5), (2, 40), (3, 18), (2, 30), (1, 28), (0, 4), (2, 34), (1, 30), (2, 20), (0, 10)]
    var body: some View {
        Canvas { ctx, s in
            let total = Self.segs.map(\.1).reduce(0, +)
            let row = s.height / 4
            let cols: [Color] = light
                ? [Color(hex: 0xE9C9A8), Color(hex: 0x9FC7F0), Color(hex: 0x4D8FD8), Color(hex: 0x24508F)]
                : [Color(hex: 0xF4E9E2), Color(hex: 0x9ED4F5), Color(hex: 0x4BA8E6), Color(hex: 0x2A6E96)]
            var x: CGFloat = 0
            var prevMid: CGFloat? = nil
            for (stage, m) in Self.segs {
                let w = s.width * m / total
                let r = CGRect(x: x, y: CGFloat(stage) * row + row * 0.18, width: w, height: row * 0.64)
                if let pm = prevMid {
                    var l = Path(); l.move(to: CGPoint(x: x, y: pm)); l.addLine(to: CGPoint(x: x, y: r.midY))
                    ctx.stroke(l, with: .color((light ? Color.black : .white).opacity(0.25)), lineWidth: 1)
                }
                ctx.fill(Path(roundedRect: r, cornerRadius: 2), with: .color(cols[stage]))
                prevMid = r.midY
                x += w
            }
        }
    }
}

/// Five domains in the bottom bar, glass.
struct AuraTabBar: View {
    var dark: Bool
    var accent: Color
    private let items: [(String, String)] = [("sun-ink", "Nap"), ("dumbbell-ink", "Edzés"), ("bowl-cream", "Fuel"), ("chat-ink", "Boop"), ("person-sage", "Én")]
    var body: some View {
        HStack(spacing: 0) {
            ForEach(items.indices, id: \.self) { i in
                let on = i == 0
                AuraGlyph(items[i].0, on ? (dark ? .white : Color(hex: 0x15171C)) : (dark ? .white.opacity(0.45) : Color(hex: 0x15171C).opacity(0.35)), size: 22)
                    .accessibilityLabel(items[i].1)          // icons only on screen; the name stays for VoiceOver
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                .background { if on { Capsule().fill(dark ? .white.opacity(0.12) : .black.opacity(0.05)).padding(.horizontal, 4) } }
            }
        }
        .padding(5)
        .glassEffect(.regular.tint(dark ? accent.opacity(0.12) : .white.opacity(0.3)), in: .capsule)
        .padding(.horizontal, 18)
    }
}

// MARK: - Root with the variant switch

struct AuraRoot: View {
    @State private var variant = UserDefaults.standard.integer(forKey: "auraVariant")
    @State private var photoMode = UserDefaults.standard.object(forKey: "auraPhoto") as? Int ?? 2
    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch variant {
                case 0: AuraNight()
                case 1: AuraDay()
                case 3: AuraSunrise(photoMode: photoMode).id(photoMode)
                default: AuraMix()
                }
            }
            .transition(.opacity)

            VStack(spacing: 10) {
                if variant != 3 {
                    Picker("Változat", selection: $variant.animation(.easeInOut(duration: 0.35))) {
                        Text("A · Éj").tag(0)
                        Text("A2 · Napkelte").tag(3)
                        Text("C · Aura").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 300)
                    .padding(4)
                    .glassEffect(.regular, in: .capsule)
                }
                AuraTabBar(dark: variant != 1, accent: variant == 0 ? Color(hex: 0x4BA8E6) : variant == 3 ? .white : Color(hex: 0x8B6CF0))
            }
            .padding(.bottom, 6)
        }
        .ignoresSafeArea(.keyboard)
    }
}

// MARK: - A · Éj (Oura): dark, full-screen photo, arc gauge, serif verdict

struct AuraNight: View {
    private let base = Color(hex: 0x0E1820)
    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    hero(height: geo.size.height + geo.safeAreaInsets.top - 40)
                    VStack(spacing: 12) {
                        stateRow
                        sleepCard
                        HStack(spacing: 12) {
                            tile("NYUGALMI PULZUS", "57", "bpm", "−2 a heti átlaghoz", Color(hex: 0x6FD3B0))
                            tile("HRV", "64", "ms", "Kiegyensúlyozott", Color(hex: 0x9ED4F5))
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 170)
                }
            }
            .scrollIndicators(.hidden)
        .defaultScrollAnchor(auraBottom ? .bottom : .top)
            .defaultScrollAnchor(auraBottom ? .bottom : .top)
            .ignoresSafeArea(edges: .top)
            .background(base.ignoresSafeArea())
        }
        .preferredColorScheme(.dark)
    }

    private func hero(height: CGFloat) -> some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: height)
                .overlay { photo("aura-hegy.jpg").resizable().scaledToFill().blur(radius: 1.5) }
                .clipped()
                .overlay(LinearGradient(stops: [.init(color: Color(hex: 0x123A58).opacity(0.55), location: 0),
                                                .init(color: .clear, location: 0.35),
                                                .init(color: base.opacity(0.55), location: 0.7),
                                                .init(color: base, location: 1)], startPoint: .top, endPoint: .bottom))
            VStack(spacing: 0) {
                HStack {
                    AuraGlyph("bell-cream", .white, size: 22).frame(width: 44, height: 44)
                    Spacer()
                    Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
                    Spacer()
                    LivingOrb(mood: .good, size: 30, motion: OrbMotion(), glow: false, level: 0.8).frame(width: 44, height: 44)
                }
                .padding(.horizontal, 16)
                .padding(.top, 58)

                ScrollView(.horizontal) {
                    HStack(spacing: 14) {
                        bubble("spark-cream", "78", "Készenlét")
                        bubble("moon-cream", "84", "Alvás")
                        bubble("shoe-cream", "62", "Mozgás")
                        bubble("bowl-cream", "71", "Fuel")
                        bubble("heart-cream", "57", "Pulzus")
                    }
                    .padding(.horizontal, 20)
                }
                .scrollIndicators(.hidden)
        .defaultScrollAnchor(auraBottom ? .bottom : .top)
            .defaultScrollAnchor(auraBottom ? .bottom : .top)
                .padding(.top, 18)

                Spacer(minLength: 20)
                gauge.frame(width: 330, height: 120)
                Text("78").font(.custom("Outfit", size: 84).weight(.light)).foregroundStyle(.white).monospacedDigit().padding(.top, -24)
                Text("KÉSZENLÉT").font(.system(size: 15, weight: .semibold)).tracking(2.4).foregroundStyle(.white.opacity(0.9))
                Text("Jó napod lesz").font(AuraFont.serif(44)).foregroundStyle(.white).padding(.top, 14)
                Text("A mélyalvásod 18 perccel a heti átlag felett volt. A 18:00-s edzés belefér, de told 18:30-ra, ha teheted.")
                    .font(.system(size: 17)).lineSpacing(4).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 30).padding(.top, 10)
                HStack(spacing: 8) {
                    Image(systemName: "play.fill").font(.system(size: 12))
                    Text("Boop elmondja").font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 26).padding(.vertical, 15)
                .background(Capsule().fill(.black.opacity(0.35)))
                .glassEffect(.clear, in: .capsule)
                .padding(.top, 22)
                .padding(.bottom, 150)
            }
            .frame(height: height)
        }
    }

    private func bubble(_ g: String, _ v: String, _ l: String) -> some View {
        VStack(spacing: 8) {
            VStack(spacing: 2) {
                AuraGlyph(g, .white, size: 16)
                Text(v).font(.custom("Outfit", size: 26).weight(.regular)).foregroundStyle(.white).monospacedDigit()
            }
            .frame(width: 76, height: 76)
            .background(Circle().fill(.white.opacity(0.08)))
            .overlay(Circle().stroke(.white.opacity(0.14), lineWidth: 1))
            Text(l).font(.system(size: 14)).foregroundStyle(.white.opacity(0.9))
        }
    }

    private var gauge: some View {
        Canvas { ctx, s in
            let c = CGPoint(x: s.width / 2, y: s.height * 1.45)
            let r = s.height * 1.25
            let a0 = Angle.degrees(212), a1 = Angle.degrees(328)
            var track = Path(); track.addArc(center: c, radius: r, startAngle: a0, endAngle: a1, clockwise: false)
            ctx.stroke(track, with: .color(.white.opacity(0.35)), style: StrokeStyle(lineWidth: 1.2, lineCap: .round))
            let av = Angle.degrees(212 + 116 * 0.78)
            var val = Path(); val.addArc(center: c, radius: r, startAngle: a0, endAngle: av, clockwise: false)
            ctx.stroke(val, with: .linearGradient(Gradient(colors: [.white.opacity(0.25), .white]), startPoint: CGPoint(x: 0, y: s.height), endPoint: CGPoint(x: s.width * 0.8, y: 0)),
                       style: StrokeStyle(lineWidth: 6, lineCap: .round))
            for k in 1..<5 {
                let a = (212 + 116 * Double(k) / 5) * .pi / 180
                let p = CGPoint(x: c.x + (r + 16) * cos(a), y: c.y + (r + 16) * sin(a))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 2.5, y: p.y - 2.5, width: 5, height: 5)), with: .color(.white.opacity(0.75)))
            }
        }
    }

    private var stateRow: some View {
        HStack(spacing: 14) {
            AuraGlyph("moon-cream", .white, size: 20).frame(width: 48, height: 48).background(Circle().fill(.white.opacity(0.1)))
            VStack(alignment: .leading, spacing: 2) {
                Text("Alvás").font(.system(size: 19)).foregroundStyle(.white)
                Text("JÓ").font(.system(size: 15, weight: .bold)).tracking(1.6).foregroundStyle(Color(hex: 0x6FD3B0))
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
        }
        .padding(16)
        .background(nightCard(glow: Color(hex: 0x2E7D6B)))
    }

    private var sleepCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ALVÁSIDŐ").font(.system(size: 13, weight: .semibold)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
            Text("7ó 12p").font(.custom("Outfit", size: 36).weight(.regular)).foregroundStyle(.white)
            Text("Ágyban töltött idő 8ó 05p").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
            Hypnogram().frame(height: 120).padding(.top, 18)
            HStack { Text("22:48"); Spacer(); Text("2:00"); Spacer(); Text("4:00"); Spacer(); Text("6:53") }
                .font(.system(size: 12)).foregroundStyle(.white.opacity(0.55)).padding(.top, 6)
            VStack(alignment: .leading, spacing: 8) {
                legend(Color(hex: 0xF4E9E2), "Ébren", "38p", 0.12)
                legend(Color(hex: 0x9ED4F5), "REM", "1ó 44p", 0.45)
                legend(Color(hex: 0x4BA8E6), "Könnyű", "3ó 52p", 0.9)
                legend(Color(hex: 0x2A6E96), "Mély", "1ó 36p", 0.4)
            }
            .padding(.top, 16)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(nightCard(glow: Color(hex: 0x2A6E96)))
    }

    private func legend(_ c: Color, _ l: String, _ v: String, _ f: CGFloat) -> some View {
        HStack(spacing: 10) {
            Capsule().fill(c).frame(width: 18 + 90 * f, height: 7)
            Text("\(l) \(v)").font(.system(size: 15)).foregroundStyle(.white.opacity(0.9))
        }
    }

    private func tile(_ l: String, _ v: String, _ u: String, _ note: String, _ c: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(l).font(.system(size: 12, weight: .semibold)).tracking(1.2).foregroundStyle(.white.opacity(0.6))
            (Text(v).font(.custom("Outfit", size: 32)) + Text(" \(u)").font(.system(size: 13)).foregroundColor(.white.opacity(0.6)))
                .foregroundStyle(.white)
            Text(note).font(.system(size: 13, weight: .semibold)).foregroundStyle(c)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(nightCard(glow: c.opacity(0.6)))
    }

    private func nightCard(glow: Color) -> some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(Color(hex: 0x1A2229))
            .overlay(alignment: .topTrailing) {
                Circle().fill(glow.opacity(0.35)).frame(width: 180).blur(radius: 60).offset(x: 40, y: -60)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.white.opacity(0.06), lineWidth: 1))
    }
}

// MARK: - B · Nappal (Ultrahuman): light, marbled orb with one word, three scores

struct AuraDay: View {
    @State private var motion = OrbMotion()
    private let ink = Color(hex: 0x15171C)
    private let grey = Color(hex: 0x8A8D94)
    private let bg = Color(hex: 0xF3F3F1)

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                HStack {
                    circleButton("person-sage")
                    Spacer()
                    Text("BOOP").font(.system(size: 22, weight: .black)).italic().tracking(1.5).foregroundStyle(ink)
                    Spacer()
                    circleButton("bell-cream")
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)

                live.padding(.horizontal, 16).padding(.top, 16)

                ZStack {
                    LivingOrb(mood: .good, size: 290, motion: motion,
                              palette: [Color(hex: 0x0A1E5C), Color(hex: 0x1D5FE0), Color(hex: 0x5AA8FF), Color(hex: 0xE2475A)],
                              glow: false, level: 1.0)
                        .shadow(color: Color(hex: 0x0A1E5C).opacity(0.35), radius: 30, y: 24)
                    Text("Lendület").font(AuraFont.serif(38).italic()).foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.3), radius: 8)
                        .allowsHitTesting(false)
                }
                .padding(.top, 36)

                Divider().padding(.horizontal, 28).padding(.top, 44)
                HStack(alignment: .top) {
                    score("ALVÁS", "84", true)
                    Spacer()
                    score("KÉSZENLÉT", "78", true)
                    Spacer()
                    score("MOZGÁS", "62", false)
                }
                .padding(.horizontal, 32).padding(.vertical, 22)
                Divider().padding(.horizontal, 28)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Told 18:30-ra az edzést").font(.system(size: 19, weight: .medium)).foregroundStyle(ink)
                    Text("A hívás után csak fél órád marad 18:00-ig. Fél óra csúszással nyugodtan bemelegíthetsz, és a vacsora is belefér.")
                        .font(.system(size: 16)).lineSpacing(3).foregroundStyle(grey)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 28).padding(.top, 20)

                nextActions.padding(.horizontal, 16).padding(.top, 26)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Mai teendők").font(.system(size: 20, weight: .medium)).foregroundStyle(ink).padding(.horizontal, 12)
                    todo("dumbbell-ink", Color(hex: 0xE9E4FB), Color(hex: 0x6A4FD8), "Felsőtest edzés", "60 PERC · 18:30")
                    todo("bowl-cream", Color(hex: 0xE3F4EC), Color(hex: 0x2E8C66), "Ebéd 45 g fehérjével", "12:30 · BOOP JAVASLAT")
                    todo("moon-cream", Color(hex: 0xE4EEFA), Color(hex: 0x3B6FB6), "Lefekvés", "22:45")
                }
                .padding(.horizontal, 16).padding(.top, 30)
            }
            .padding(.bottom, 170)
        }
        .scrollIndicators(.hidden)
        .defaultScrollAnchor(auraBottom ? .bottom : .top)
        .background(bg.ignoresSafeArea())
        .preferredColorScheme(.light)
        .onDisappear { motion.stop() }
    }

    private func circleButton(_ g: String) -> some View {
        AuraGlyph(g, ink, size: 20)
            .frame(width: 50, height: 50)
            .background(Circle().fill(.white).shadow(color: .black.opacity(0.08), radius: 8, y: 3))
    }

    private var live: some View {
        HStack(spacing: 14) {
            HStack(spacing: 6) { Circle().fill(Color(hex: 0x2DBE7E)).frame(width: 8, height: 8); Text("ÉLŐ") }
            Spacer()
            HStack(spacing: 4) { AuraGlyph("heart-cream", ink, size: 15); Text("57") }
            HStack(spacing: 4) { AuraGlyph("shoe-cream", ink, size: 15); Text("1 240") }
            Text("NYUGODT")
            Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
        }
        .font(AuraFont.mono(14, .semibold)).tracking(1).foregroundStyle(ink)
        .padding(.horizontal, 16).padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(colors: [Color(hex: 0xD9F5E4), Color(hex: 0xE9FAF0), Color(hex: 0xD3F1E0)], startPoint: .leading, endPoint: .trailing))
                .blur(radius: 1)
                .shadow(color: Color(hex: 0x6FDCA4).opacity(0.25), radius: 14, y: 6)
        )
    }

    private func score(_ l: String, _ v: String, _ up: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(l).font(AuraFont.mono(12.5)).tracking(1.2).foregroundStyle(grey)
            HStack(alignment: .center, spacing: 6) {
                Text(v).font(.custom("Outfit", size: 40).weight(.regular)).foregroundStyle(ink).monospacedDigit()
                Trend(up: up, size: 11)
            }
        }
    }

    private var nextActions: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Boop javasolja").font(.system(size: 18, weight: .medium)).foregroundStyle(ink)
                    HStack(spacing: 4) { Text("✳︎"); Text("REGGELI ÁTTEKINTÉS") }.font(AuraFont.mono(12)).tracking(1).foregroundStyle(grey)
                }
                Spacer()
                Text("+2").font(.system(size: 13, weight: .semibold)).padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Capsule().fill(Color(hex: 0xEDEDEB))).foregroundStyle(ink)
            }
            HStack(alignment: .top, spacing: 14) {
                AuraGlyph("bolt-ink", .white, size: 24)
                    .frame(width: 64, height: 64)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(LinearGradient(colors: [Color(hex: 0xF7B98A), Color(hex: 0xE8814E)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                VStack(alignment: .leading, spacing: 4) {
                    Text("Ma bírod a terhelést.").font(.system(size: 17, weight: .medium)).foregroundStyle(ink)
                    Text("Készenlét 78, a pulzusod 2-vel a heti átlag alatt. Jó nap egy keményebb edzéshez.")
                        .font(.system(size: 15)).foregroundStyle(grey)
                }
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(hex: 0xF5F5F3)))
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white).shadow(color: .black.opacity(0.05), radius: 14, y: 6))
    }

    private func todo(_ g: String, _ tile: Color, _ tint: Color, _ t: String, _ sub: String) -> some View {
        HStack(spacing: 14) {
            AuraGlyph(g, tint, size: 22).frame(width: 52, height: 52)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(tile))
            VStack(alignment: .leading, spacing: 3) {
                Text(t).font(.system(size: 16.5, weight: .medium)).foregroundStyle(ink)
                Text(sub).font(AuraFont.mono(12)).tracking(0.8).foregroundStyle(grey)
            }
            Spacer()
            Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(grey)
                .frame(width: 40, height: 40).overlay(Circle().stroke(Color(hex: 0xE2E2E0)))
            Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Color(hex: 0x2DBE7E))
                .frame(width: 40, height: 40).background(Circle().fill(Color(hex: 0xE6F7EE)))
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white))
    }
}

// MARK: - C · Aura (the mix): dark glass, photo melting into the page hue, orb hero, colour auras

struct AuraHue {
    let name: String, word: String
    let top: Color, glow: Color
    let orb: [Color]
    static let all: [AuraHue] = [
        AuraHue(name: "Készenlét", word: "Lendület", top: Color(hex: 0x3A2C7A), glow: Color(hex: 0x8B6CF0),
                orb: [Color(hex: 0x2A1E6E), Color(hex: 0x6A4FD8), Color(hex: 0x9FB8FF), Color(hex: 0xF08BB4)]),
        AuraHue(name: "Alvás", word: "Kipihent", top: Color(hex: 0x123E5C), glow: Color(hex: 0x4BA8E6),
                orb: [Color(hex: 0x0B2C4F), Color(hex: 0x2A78C8), Color(hex: 0x8ED0F7), Color(hex: 0x6FD3B0)]),
        AuraHue(name: "Mozgás", word: "Mozdulj", top: Color(hex: 0x5A3216), glow: Color(hex: 0xF29A4A),
                orb: [Color(hex: 0x6B2A0E), Color(hex: 0xE0702E), Color(hex: 0xF7C27A), Color(hex: 0xF0508C)]),
    ]
}

struct AuraMix: View {
    @State private var hueIdx = UserDefaults.standard.integer(forKey: "auraHue")
    @State private var motion = OrbMotion()
    private let base = Color(hex: 0x0B0D13)
    private var hue: AuraHue { AuraHue.all[min(2, max(0, hueIdx))] }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                VStack(spacing: 14) {
                    voice
                    energyCard
                    HStack(spacing: 12) {
                        mini("moon-cream", "ALVÁS", "7ó 12p", "Mély 1ó 36p", Color(hex: 0x4BA8E6))
                        mini("heart-cream", "PULZUS", "57", "−2 bpm", Color(hex: 0x6FD3B0))
                    }
                    nextCard
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 170)
            }
        }
        .scrollIndicators(.hidden)
        .defaultScrollAnchor(auraBottom ? .bottom : .top)
        .ignoresSafeArea(edges: .top)
        .background(background.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .onDisappear { motion.stop() }
    }

    private var background: some View {
        ZStack(alignment: .top) {
            base
            LinearGradient(colors: [hue.top, hue.top.opacity(0.35), base], startPoint: .top, endPoint: .init(x: 0.5, y: 0.75))
            Circle().fill(hue.glow.opacity(0.35)).frame(width: 520).blur(radius: 140).offset(x: 120, y: 260)
        }
        .animation(.easeInOut(duration: 0.6), value: hueIdx)
    }

    private var hero: some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: 520)
                .overlay { photo("aura-alkony.jpg").resizable().scaledToFill() }
                .clipped()
                .opacity(0.55)
                .mask(LinearGradient(colors: [.black, .black.opacity(0.6), .clear], startPoint: .top, endPoint: .bottom))
                .overlay(Rectangle().fill(hue.top).opacity(0.35).blendMode(.color))
                .animation(.easeInOut(duration: 0.6), value: hueIdx)
            VStack(spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("HÉTFŐ · NOV 9").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.65))
                        Text("Jó reggelt, Dani").font(AuraFont.serif(28)).foregroundStyle(.white)
                    }
                    Spacer()
                    AuraGlyph("bell-cream", .white, size: 20).frame(width: 44, height: 44)
                        .glassEffect(.clear, in: .circle)
                }
                .padding(.horizontal, 20).padding(.top, 62)

                ZStack {
                    LivingOrb(mood: .good, size: 250, motion: motion, palette: hue.orb, glow: true, level: 1.0)
                    Text(hue.word).font(AuraFont.serif(34).italic()).foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.35), radius: 8).allowsHitTesting(false)
                        .contentTransition(.opacity)
                }
                .padding(.top, 34)
                .animation(.easeInOut(duration: 0.5), value: hueIdx)

                HStack(alignment: .top, spacing: 10) {
                    ForEach(0..<3) { i in
                        Button { withAnimation(.easeInOut(duration: 0.5)) { hueIdx = i } } label: { scoreCell(i) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 34)
                Text("Koppints egy számra – az oldal átszíneződik").font(.system(size: 12)).foregroundStyle(.white.opacity(0.45)).padding(.top, 10)
            }
        }
    }

    private func scoreCell(_ i: Int) -> some View {
        let h = AuraHue.all[i]
        let v = ["78", "84", "62"][i]
        let on = i == hueIdx
        return VStack(alignment: .leading, spacing: 6) {
            Text(h.name.uppercased()).font(AuraFont.mono(11.5)).tracking(1.1).foregroundStyle(.white.opacity(on ? 0.85 : 0.55))
            HStack(spacing: 6) {
                Text(v).font(.custom("Outfit", size: 36).weight(.light)).foregroundStyle(.white).monospacedDigit()
                Trend(up: i != 2, size: 10)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(.white.opacity(on ? 0.10 : 0.04))
                .overlay(alignment: .bottomLeading) {
                    if on { Capsule().fill(h.glow).frame(height: 3).padding(.horizontal, 14).padding(.bottom, 6).shadow(color: h.glow, radius: 8) }
                }
        }
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.white.opacity(on ? 0.18 : 0.06), lineWidth: 1))
    }

    private var voice: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                LivingOrb(mood: .good, size: 22, motion: motion, palette: hue.orb, glow: false, level: 0.9)
                Text("BOOP MONDJA").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                Spacer()
                HStack(spacing: 6) { Image(systemName: "play.fill").font(.system(size: 10)); Text("Meghallgatom") }
                    .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .glassEffect(.regular.tint(hue.glow.opacity(0.25)), in: .capsule)
            }
            (Text("Jól aludtál: a mélyalvás ") + Text("18 perccel a heti átlagod felett").bold().foregroundColor(.white)
             + Text(" volt, a pulzusod ") + Text("két ütéssel lejjebb").bold().foregroundColor(.white)
             + Text(" ment. A 18:00-s edzés belefér, de ha teheted, ") + Text("told 18:30-ra").bold().foregroundColor(.white) + Text("."))
                .font(AuraFont.serif(19)).lineSpacing(5).foregroundStyle(.white.opacity(0.75))
        }
        .padding(20)
        .background(auraCard(hue.glow))
    }

    private var energyCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("A NAP ENERGIÁJA").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                Spacer()
                Text("Mélypont 15:00").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: 0xF7C27A))
            }
            Text("Délelőtt csúcs, délután hullámvölgy").font(.system(size: 17, weight: .medium)).foregroundStyle(.white).padding(.top, 4)
            EnergyLine(color: hue.glow).frame(height: 130).padding(.top, 14)
            HStack { Text("6"); Spacer(); Text("9"); Spacer(); Text("12"); Spacer(); Text("15"); Spacer(); Text("18"); Spacer(); Text("21"); Spacer(); Text("24") }
                .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
        }
        .padding(20)
        .background(auraCard(Color(hex: 0xF29A4A)))
    }

    private func mini(_ g: String, _ l: String, _ v: String, _ note: String, _ c: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) { AuraGlyph(g, c, size: 15); Text(l).font(AuraFont.mono(11.5)).tracking(1.2).foregroundStyle(.white.opacity(0.6)) }
            Text(v).font(.custom("Outfit", size: 30).weight(.light)).foregroundStyle(.white)
            Text(note).font(.system(size: 13, weight: .semibold)).foregroundStyle(c)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(auraCard(c))
    }

    private var nextCard: some View {
        HStack(spacing: 14) {
            AuraGlyph("dumbbell-ink", .white, size: 24).frame(width: 56, height: 56)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(LinearGradient(colors: [hue.glow, hue.top], startPoint: .topLeading, endPoint: .bottomTrailing)))
            VStack(alignment: .leading, spacing: 3) {
                Text("Felsőtest · 18:00").font(.system(size: 17, weight: .medium)).foregroundStyle(.white)
                Text("Boop szerint 18:30 jobb lenne").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
            }
            Spacer()
            Text("Áttolom").font(.system(size: 14, weight: .semibold)).foregroundStyle(base)
                .padding(.horizontal, 14).padding(.vertical, 10).background(Capsule().fill(.white))
        }
        .padding(16)
        .background(auraCard(hue.glow))
    }

    private func auraCard(_ glow: Color) -> some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(.white.opacity(0.05))
            .overlay(alignment: .topLeading) {
                Circle().fill(glow.opacity(0.45)).frame(width: 200).blur(radius: 70).offset(x: -70, y: -90)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(LinearGradient(colors: [.white.opacity(0.18), .white.opacity(0.03)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
    }
}

/// A smooth energy line with a soft glowing fill and a "most" marker.
struct EnergyLine: View {
    var color: Color
    private let pts: [Double] = [0.35, 0.62, 0.82, 0.78, 0.6, 0.38, 0.5, 0.66, 0.55, 0.36, 0.2]
    var body: some View {
        Canvas { ctx, s in
            func p(_ i: Int) -> CGPoint { CGPoint(x: s.width * Double(i) / Double(pts.count - 1), y: s.height * (1 - pts[i]) * 0.9 + 6) }
            var line = Path(); line.move(to: p(0))
            for i in 1..<pts.count {
                let a = p(i - 1), b = p(i)
                line.addCurve(to: b, control1: CGPoint(x: (a.x + b.x) / 2, y: a.y), control2: CGPoint(x: (a.x + b.x) / 2, y: b.y))
            }
            var fill = line; fill.addLine(to: CGPoint(x: s.width, y: s.height)); fill.addLine(to: CGPoint(x: 0, y: s.height)); fill.closeSubpath()
            ctx.fill(fill, with: .linearGradient(Gradient(colors: [color.opacity(0.35), color.opacity(0)]), startPoint: .zero, endPoint: CGPoint(x: 0, y: s.height)))
            var glowCtx = ctx
            glowCtx.addFilter(.blur(radius: 6))
            glowCtx.stroke(line, with: .color(color), lineWidth: 5)
            ctx.stroke(line, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            let nx = s.width * 0.18
            var now = Path(); now.move(to: CGPoint(x: nx, y: 0)); now.addLine(to: CGPoint(x: nx, y: s.height))
            ctx.stroke(now, with: .color(.white.opacity(0.5)), style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
            let ny = p(2).y * 0.3 + p(1).y * 0.7
            ctx.fill(Path(ellipseIn: CGRect(x: nx - 5, y: ny - 5, width: 10, height: 10)), with: .color(.white))
            ctx.draw(Text("MOST").font(AuraFont.mono(10, .bold)).foregroundColor(Color.white.opacity(0.8)), at: CGPoint(x: nx + 22, y: 8))
        }
    }
}
