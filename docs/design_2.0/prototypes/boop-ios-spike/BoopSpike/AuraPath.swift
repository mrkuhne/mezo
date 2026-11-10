import SwiftUI

// Throwaway spike (mezo-r36n9.3): "a nap ösvénye" — below the hero, the day is one glowing line with stations
// instead of a pile of cards (after Gentler Streak's Activity Path and Flighty's timeline). The selected orb (lens)
// decides which stations open up into cards. Above it: three tiles with their own little drawings (Apple Weather's
// modules), and the water tile is "juicy" (a drop falls in, the level rises, a haptic) after (Not Boring) Habits.

private let pathBase = Color(hex: 0x0D1218)

// MARK: - Tiles

struct AuraTileRow: View {
    var accent: Color
    @State private var water = 0.5
    @State private var drop = false
    @State private var drops = 0

    var body: some View {
        HStack(spacing: 10) {
            tile("VÍZ", "\(String(format: "%.2f", water * 2.5).replacingOccurrences(of: ".", with: ",")) l", "koppints: +250 ml") {
                WaterGlass(level: water, drop: drop)
            }
            .onTapGesture { pour() }
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: drops)
            tile("LÉPÉSEK", "5 580", "/ 9 000") { StepTrail(progress: 0.62) }
            tile("FEHÉRJE", "38 g", "/ 165 g") {
                StillOrb(colors: SunMetric.all[4].orb, size: 46, level: 0.23)
            }
        }
    }

    private func pour() {
        guard water < 1 else { return }
        drop = false
        withAnimation(.easeIn(duration: 0.45)) { drop = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            drops += 1
            withAnimation(.spring(response: 0.6, dampingFraction: 0.55)) { water = min(1, water + 0.1) }
            drop = false
        }
    }

    private func tile<G: View>(_ l: String, _ v: String, _ sub: String, @ViewBuilder g: () -> G) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(l).font(AuraFont.mono(10.5)).tracking(1.2).foregroundStyle(.white.opacity(0.6))
            g().frame(height: 56).frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 1) {
                Text(v).font(.custom("Outfit", size: 19).weight(.light)).foregroundStyle(.white).contentTransition(.numericText())
                Text(sub).font(.system(size: 11)).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .auraGlass(22)
        .contentShape(Rectangle())
    }
}

/// A glass that fills; a drop falls in when you pour.
struct WaterGlass: View {
    var level: Double
    var drop: Bool
    var body: some View {
        ZStack(alignment: .bottom) {
            GlassShape().fill(.white.opacity(0.06))
            TimelineView(.animation) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate
                Canvas { ctx, s in
                    let y = s.height * (1 - level)
                    var p = Path(); p.move(to: CGPoint(x: 0, y: s.height))
                    for x in stride(from: 0.0, through: s.width, by: 2) {
                        p.addLine(to: CGPoint(x: x, y: y + 2 * sin(x / 6 + t * 3)))
                    }
                    p.addLine(to: CGPoint(x: s.width, y: s.height)); p.closeSubpath()
                    ctx.fill(p, with: .linearGradient(Gradient(colors: [Color(hex: 0x9ED4F5), Color(hex: 0x2A78C8)]),
                                                       startPoint: CGPoint(x: 0, y: y), endPoint: CGPoint(x: 0, y: s.height)))
                }
            }
            .clipShape(GlassShape())
            GlassShape().stroke(.white.opacity(0.55), lineWidth: 1.4)
            Circle().fill(Color(hex: 0x9ED4F5)).frame(width: 7, height: 7)
                .offset(y: drop ? -10 : -64).opacity(drop ? 1 : 0)
        }
        .frame(width: 36, height: 52)
    }
}

struct GlassShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX - r.width * 0.14, y: r.maxY - 4))
        p.addQuadCurve(to: CGPoint(x: r.minX + r.width * 0.14, y: r.maxY - 4), control: CGPoint(x: r.midX, y: r.maxY + 2))
        p.closeSubpath()
        return p
    }
}

/// A little winding trail with the walked part lit and a dot where you are.
struct StepTrail: View {
    var progress: Double
    var body: some View {
        Canvas { ctx, s in
            var p = Path()
            p.move(to: CGPoint(x: 4, y: s.height - 6))
            p.addCurve(to: CGPoint(x: s.width * 0.5, y: s.height * 0.45), control1: CGPoint(x: s.width * 0.35, y: s.height), control2: CGPoint(x: s.width * 0.1, y: s.height * 0.4))
            p.addCurve(to: CGPoint(x: s.width - 4, y: 6), control1: CGPoint(x: s.width * 0.9, y: s.height * 0.5), control2: CGPoint(x: s.width * 0.6, y: 0))
            ctx.stroke(p, with: .color(.white.opacity(0.18)), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [1, 5]))
            let lit = p.trimmedPath(from: 0, to: progress)
            var g = ctx; g.addFilter(.blur(radius: 4))
            g.stroke(lit, with: .color(Color(hex: 0xF29A4A)), lineWidth: 4)
            ctx.stroke(lit, with: .color(.white), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            if let end = lit.currentPoint {
                ctx.fill(Path(ellipseIn: CGRect(x: end.x - 4.5, y: end.y - 4.5, width: 9, height: 9)), with: .color(.white))
            }
            ctx.fill(Path(ellipseIn: CGRect(x: s.width - 8, y: 2, width: 8, height: 8)), with: .color(.white.opacity(0.35)))
        }
    }
}

// MARK: - The day path

struct DayPath: View {
    var lens: Int
    var hue: Color
    var motion: OrbMotion
    var orb: [Color]
    var onOpen: (String) -> Void

    enum Kind { case sleep, weight, checkin, meal, now, observe, meetings, dip, breath, workout, bed }
    struct Station: Identifiable { let id = UUID(); let time: String; let glyph: String; let title: String; let sub: String; let kind: Kind; let past: Bool }

    private var stations: [Station] {
        var s: [Station] = [
            .init(time: "06:53", glyph: "sun-ink", title: "Ébredés", sub: "7ó 12p alvás · mély 1ó 36p", kind: .sleep, past: true),
            .init(time: "06:55", glyph: "scale-ink", title: "Mérlegelés", sub: "82,4 kg · trend 82,2", kind: .weight, past: true),
            .init(time: "07:35", glyph: "bowl-cream", title: "Reggeli", sub: "zabkása bogyókkal · 523 kcal", kind: .meal, past: true),
            .init(time: "08:40", glyph: "", title: "Most", sub: "", kind: .now, past: true),
            .init(time: "", glyph: "pen-sun", title: "Reggeli check-in", sub: "6 kérdés · fél perc", kind: .checkin, past: false),
        ]
        if lens == 0 { s.append(.init(time: "", glyph: "spark-cream", title: "Boop észrevette", sub: "3 új megfigyelés", kind: .observe, past: false)) }
        s.append(.init(time: "09:00", glyph: "clock-ink", title: "Megbeszélések", sub: "6 esemény · 17:30-ig", kind: .meetings, past: false))
        s.append(.init(time: "12:30", glyph: "bowl-cream", title: "Ebéd", sub: "Boop javaslata: lazac rizzsel", kind: .meal, past: false))
        if lens == 4 { s.append(.init(time: "13:55", glyph: "heart-cream", title: "Egy perc légzés", sub: "a 14:00-s hívás előtt", kind: .breath, past: false)) }
        s += [
            .init(time: "15:00", glyph: "shoe-cream", title: "Mélypont", sub: "10 perc séta segít", kind: .dip, past: false),
            .init(time: "18:30", glyph: "dumbbell-ink", title: "Felsőtest edzés", sub: "60 perc · Boop: 18:30 jobb", kind: .workout, past: false),
            .init(time: "20:00", glyph: "bowl-cream", title: "Vacsora", sub: "könnyű, 20:00-ig", kind: .meal, past: false),
            .init(time: "22:45", glyph: "moon-cream", title: "Lefekvés", sub: "emlékeztető 22:15-kor", kind: .bed, past: false),
        ]
        return s
    }

    private func emphasized(_ k: Kind) -> Bool {
        switch lens {
        case 1: return k == .sleep || k == .bed
        case 2: return k == .workout || k == .dip
        case 3: return k == .meal
        case 4: return k == .meetings || k == .breath
        default: return k == .checkin || k == .observe || k == .dip
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                AuraMono("A NAPOD")
                Spacer()
                Text("6 esemény · Google Naptár").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.horizontal, 4).padding(.bottom, 14)
            let list = stations
            ForEach(list.indices, id: \.self) { i in
                let st = list[i]
                row(st, first: i == 0, last: i == list.count - 1, nextPast: i + 1 < list.count && list[i + 1].past)
                    .scrollTransition(.animated(.spring(response: 0.5, dampingFraction: 0.85))) { c, phase in
                        c.opacity(phase.isIdentity ? 1 : 0.35)
                            .scaleEffect(phase.isIdentity ? 1 : 0.94, anchor: .leading)
                            .rotation3DEffect(.degrees(phase.value * -10), axis: (x: 1, y: 0, z: 0), anchor: .center, perspective: 0.6)
                    }
            }
        }
    }

    // MARK: rows

    private func row(_ st: Station, first: Bool, last: Bool, nextPast: Bool) -> some View {
        let emph = emphasized(st.kind)
        return HStack(alignment: .top, spacing: 12) {
            Text(st.time).font(AuraFont.mono(11.5)).foregroundStyle(.white.opacity(st.kind == .now ? 1 : (st.past ? 0.45 : 0.7)))
                .frame(width: 42, alignment: .trailing).padding(.top, st.kind == .now ? 4 : 12)
            // the line + node
            ZStack(alignment: .top) {
                VStack(spacing: 0) {
                    segment(lit: st.past).frame(height: st.kind == .now ? 8 : 14).opacity(first ? 0 : 1)
                    Spacer(minLength: 0)
                }
                VStack(spacing: 0) {
                    Color.clear.frame(height: st.kind == .now ? 8 : 14)
                    node(st, emph: emph)
                    segment(lit: st.past && nextPast).frame(maxHeight: .infinity).opacity(last ? 0 : 1)
                }
            }
            .frame(width: 24)
            // the content
            VStack(alignment: .leading, spacing: 10) {
                if st.kind == .now {
                    Text("MOST").font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(.white).padding(.top, 4)
                    Color.clear.frame(height: 6)
                } else {
                    HStack(alignment: .firstTextBaseline) {
                        Text(st.title).font(.system(size: emph ? 17 : 15.5, weight: emph ? .semibold : .regular))
                            .foregroundStyle(.white.opacity(st.past ? 0.55 : (emph ? 1 : 0.8)))
                        Spacer()
                    }
                    .padding(.top, 10)
                    Text(st.sub).font(.system(size: 13)).foregroundStyle(.white.opacity(st.past ? 0.4 : 0.6)).padding(.top, -6)
                    if emph { card(for: st).padding(.top, 2).transition(.opacity.combined(with: .scale(scale: 0.97, anchor: .top))) }
                }
            }
            .padding(.bottom, emph ? 18 : 10)
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.85), value: lens)
    }

    private func segment(lit: Bool) -> some View {
        ZStack {
            if lit {
                Rectangle().fill(hue).frame(width: 6).blur(radius: 5).opacity(0.8)
                Rectangle().fill(.white).frame(width: 2)
            } else {
                Rectangle().fill(.white.opacity(0.16)).frame(width: 2)
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder private func node(_ st: Station, emph: Bool) -> some View {
        if st.kind == .now {
            NowPulse(hue: hue)
        } else {
            ZStack {
                Circle().fill(st.past ? Color.white : (emph ? Color.white.opacity(0.14) : pathBase))
                Circle().stroke(.white.opacity(st.past ? 0 : (emph ? 0.9 : 0.35)), lineWidth: 1.2)
                if !st.glyph.isEmpty {
                    AuraGlyph(st.past ? "check-ink" : st.glyph, st.past ? pathBase : .white.opacity(emph ? 1 : 0.7), size: 11)
                }
            }
            .frame(width: 22, height: 22)
            .shadow(color: emph ? hue.opacity(0.8) : .clear, radius: 8)
        }
    }

    // MARK: the cards that hang off emphasized stations

    @ViewBuilder private func card(for st: Station) -> some View {
        switch st.kind {
        case .checkin:
            HStack(spacing: 12) {
                StillOrb(colors: SunMetric.all[2].orb, size: 40, level: 0.5)
                Text("Hogy vagy ma reggel? Öt alap és a nap kérdése.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                Spacer(minLength: 0)
                Button { onOpen("checkin") } label: {
                    Text("Kitöltöm").font(.system(size: 14, weight: .semibold)).foregroundStyle(pathBase)
                        .padding(.horizontal, 14).padding(.vertical, 9).background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
            }
            .padding(14).auraGlass(20)
        case .observe:
            ObservationStack(orb: orb, motion: motion, showHeader: false)
        case .sleep:
            VStack(alignment: .leading, spacing: 6) {
                Hypnogram().frame(height: 64)
                HStack { Text("22:48"); Spacer(); Text("6:53") }.font(AuraFont.mono(10)).foregroundStyle(.white.opacity(0.45))
            }
            .padding(14).auraGlass(20)
        case .bed:
            HStack(spacing: 12) {
                AuraGlyph("moon-cream", .white, size: 18).frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.1)))
                VStack(alignment: .leading, spacing: 2) {
                    Text("21:30 után képernyő nélkül").font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
                    Text("Így holnap is ilyen mélyalvásod lesz.").font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading).auraGlass(20)
        case .workout:
            VStack(alignment: .leading, spacing: 10) {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(["gyak-barbell-bench-press.jpg", "gyak-incline-db-press.jpg", "gyak-overhead-press.jpg", "gyak-lateral-raise.jpg", "gyak-tricep-pushdown.jpg"], id: \.self) { n in
                            photo(n).resizable().scaledToFill().frame(width: 76, height: 60).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                }
                .scrollIndicators(.hidden)
                HStack {
                    Text("5 gyakorlat · 3. hét, 2. nap").font(.system(size: 13)).foregroundStyle(.white.opacity(0.7))
                    Spacer()
                    Text("Áttolom 18:30-ra").font(.system(size: 13, weight: .semibold)).foregroundStyle(pathBase)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(Capsule().fill(.white))
                }
            }
            .padding(14).auraGlass(20)
        case .dip:
            HStack(spacing: 12) {
                GlowLine(points: [0.7, 0.55, 0.3, 0.42, 0.6], color: .white, nowAt: nil).frame(width: 90, height: 40)
                Text(lens == 2 ? "Egy 10 perces séta a mélypontban 1 200 lépés és frissebb délután." : "Ide tegyél sétát, ne újabb kávét.")
                    .font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.8))
            }
            .padding(14).auraGlass(20)
        case .meal:
            HStack(spacing: 12) {
                photo(st.past ? "zab-sq.jpg" : (st.time == "12:30" ? "lazac-sq.jpg" : "salata-sq.jpg")).resizable().scaledToFill()
                    .frame(width: 52, height: 52).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .opacity(st.past ? 1 : 0.85)
                VStack(alignment: .leading, spacing: 6) {
                    Text(st.past ? "25 g fehérje · 67 g szénhidrát" : (st.time == "12:30" ? "kb. 42 g fehérje · 610 kcal" : "kb. 30 g fehérje · 450 kcal"))
                        .font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.85))
                    GeometryReader { g in
                        HStack(spacing: 2) {
                            Capsule().fill(.white).frame(width: g.size.width * 0.3)
                            Capsule().fill(.white.opacity(0.55)).frame(width: g.size.width * 0.45)
                            Capsule().fill(.white.opacity(0.25))
                        }
                    }
                    .frame(height: 5)
                }
                if !st.past {
                    Button { onOpen("meal") } label: {
                        AuraGlyph("camera-ink", pathBase, size: 15).frame(width: 34, height: 34).background(Circle().fill(.white))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14).auraGlass(20)
        case .meetings:
            VStack(alignment: .leading, spacing: 8) {
                AuraBusyRibbon().frame(height: 12)
                Text("A 14:00 és 16:00 közötti sáv a legsűrűbb. Előtte egy perc légzés.").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.8))
            }
            .padding(14).auraGlass(20)
        case .breath:
            HStack(spacing: 12) {
                StillOrb(colors: SunMetric.all[4].orb, size: 40, level: 0.6)
                Text("Emlékeztetlek 13:55-kor. A gömb vezeti a ritmust.").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.8))
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading).auraGlass(20)
        default:
            EmptyView()
        }
    }
}

/// The "now" node: a white dot with a breathing halo in the page's hue.
struct NowPulse: View {
    var hue: Color
    @State private var on = false
    var body: some View {
        ZStack {
            Circle().fill(hue.opacity(0.5)).frame(width: on ? 30 : 14).blur(radius: 4).opacity(on ? 0.2 : 0.9)
            Circle().fill(.white).frame(width: 12, height: 12)
        }
        .frame(width: 24, height: 16)
        .onAppear { withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { on = true } }
    }
}
