import SwiftUI

// Throwaway spike (mezo-r36n9.3): below the hero each orb shows only what belongs to it (owner, 2026-11-10):
// 2–3 tiles with their own drawings + a short path of its own stations. The whole day's path lives on the
// "A napom" tab (mode -1). Background: the page keeps a deep hue, floating lights, and a mirrored landscape at the end.

private let pathBase = Color(hex: 0x0D1218)

// MARK: - Tiles per orb

struct LensTile<G: View>: View {
    var label: String
    var value: String
    var sub: String
    @ViewBuilder var graphic: G
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(AuraFont.mono(10.5)).tracking(1.2).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.8)
            graphic.frame(height: 56).frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 1) {
                Text(value).font(.custom("Outfit", size: 19).weight(.light)).foregroundStyle(.white).contentTransition(.numericText()).lineLimit(1).minimumScaleFactor(0.7)
                Text(sub).font(.system(size: 11)).foregroundStyle(.white.opacity(0.5)).lineLimit(1).minimumScaleFactor(0.8)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .auraGlass(22)
        .contentShape(Rectangle())
    }
}

struct LensTiles: View {
    var lens: Int
    @State private var water = 0.5
    @State private var drop = false
    @State private var drops = 0

    var body: some View {
        switch lens {
        case 1:
            HStack(spacing: 10) {
                LensTile(label: "ALVÁSIDŐ", value: "7ó 12p", sub: "22:48 – 06:53") { NightArc() }
                LensTile(label: "MÉLYALVÁS", value: "1ó 36p", sub: "+18 p az átlaghoz") { StillOrb(colors: SunMetric.all[1].orb, size: 46, level: 0.62) }
                LensTile(label: "ELALVÁS", value: "12 perc", sub: "gyorsabb, mint szokott") { SleepLatency() }
            }
        case 2:
            HStack(spacing: 10) {
                LensTile(label: "LÉPÉSEK", value: "5 580", sub: "/ 9 000") { StepTrail(progress: 0.62) }
                LensTile(label: "AKTÍV KALÓRIA", value: "310 kcal", sub: "/ 620 cél") { LevelBars(values: [0.5], tints: [Color(hex: 0xF29A4A)], wide: true) }
            }
        case 3:
            HStack(spacing: 10) {
                LensTile(label: "VÍZ", value: String(format: "%.2f l", water * 2.5).replacingOccurrences(of: ".", with: ","), sub: "koppints: +250 ml") {
                    WaterGlass(level: water, drop: drop)
                }
                .onTapGesture { pour() }
                .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: drops)
                LensTile(label: "KALÓRIA", value: "820", sub: "/ 2 350 kcal") { StillOrb(colors: SunMetric.all[3].orb, size: 46, level: 0.35) }
                LensTile(label: "MAKRÓK", value: "38 · 120 · 30", sub: "fehérje · szénh. · zsír") {
                    LevelBars(values: [38.0 / 165, 120.0 / 260, 30.0 / 75], tints: [.white, .white.opacity(0.7), .white.opacity(0.45)], wide: false)
                }
            }
        case 4:
            HStack(spacing: 10) {
                LensTile(label: "NYUGALMI PULZUS", value: "57", sub: "heti átlag 59") {
                    GlowLine(points: [0.55, 0.5, 0.62, 0.42, 0.35, 0.42, 0.2], color: .white, nowAt: nil)
                }
                LensTile(label: "FESZÜLTSÉG", value: "4 / 10", sub: "reggeli check-in") {
                    StillOrb(colors: SunMetric.all[0].orb, size: 46, level: 0.4)
                }
            }
        default:
            EmptyView()
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

/// The night as an arc from falling asleep to waking, a small moon at its top.
struct NightArc: View {
    var body: some View {
        Canvas { ctx, s in
            let c = CGPoint(x: s.width / 2, y: s.height - 4)
            let r = min(s.width / 2 - 6, s.height - 8)
            var arc = Path(); arc.addArc(center: c, radius: r, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false)
            var g = ctx; g.addFilter(.blur(radius: 4))
            g.stroke(arc, with: .color(Color(hex: 0x4BA8E6)), lineWidth: 4)
            ctx.stroke(arc, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            for a in [180.0, 360.0] {
                let p = CGPoint(x: c.x + r * cos(a * .pi / 180), y: c.y + r * sin(a * .pi / 180))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3.5, y: p.y - 3.5, width: 7, height: 7)), with: .color(.white))
            }
            let top = CGPoint(x: c.x, y: c.y - r)
            ctx.fill(Path(ellipseIn: CGRect(x: top.x - 7, y: top.y - 7, width: 14, height: 14)), with: .color(Color(hex: 0xF4E9E2)))
            ctx.fill(Path(ellipseIn: CGRect(x: top.x - 3, y: top.y - 9, width: 13, height: 13)), with: .color(Color(hex: 0x1A2A3C)))
        }
    }
}

/// How fast you fell asleep: a short descent from "awake" down into sleep.
struct SleepLatency: View {
    var body: some View {
        Canvas { ctx, s in
            var p = Path()
            p.move(to: CGPoint(x: 4, y: 8))
            p.addLine(to: CGPoint(x: s.width * 0.3, y: 8))
            p.addCurve(to: CGPoint(x: s.width - 4, y: s.height - 6), control1: CGPoint(x: s.width * 0.5, y: 8), control2: CGPoint(x: s.width * 0.55, y: s.height - 6))
            ctx.stroke(p, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            ctx.fill(Path(ellipseIn: CGRect(x: 0, y: 4, width: 8, height: 8)), with: .color(Color(hex: 0xF4E9E2)))
            ctx.fill(Path(ellipseIn: CGRect(x: s.width - 8, y: s.height - 10, width: 8, height: 8)), with: .color(Color(hex: 0x4BA8E6)))
        }
    }
}

/// Upright level bars: each fills to its share; one wide bar or a small group.
struct LevelBars: View {
    var values: [Double]
    var tints: [Color]
    var wide: Bool
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ForEach(values.indices, id: \.self) { i in
                ZStack(alignment: .bottom) {
                    Capsule().fill(.white.opacity(0.1))
                    Capsule().fill(tints[i]).frame(height: 52 * min(1, values[i]))
                }
                .frame(width: wide ? 22 : 12, height: 52)
            }
        }
    }
}

// MARK: - The path (a short one per orb, or the whole day on "A napom")

struct DayPath: View {
    var mode: Int              // 0–4 = that orb's own stations, -1 = the whole day
    var hue: Color
    var motion: OrbMotion
    var orb: [Color]
    var onOpen: (String) -> Void

    enum Kind { case lastBed, night, sleep, weight, checkin, intention, meal, now, observe, meetings, dip, breath, workout, bed }
    struct Station { let time: String; let glyph: String; let title: String; let sub: String; let kind: Kind; let past: Bool; var card = true }

    private let now = Station(time: "08:40", glyph: "", title: "Most", sub: "", kind: .now, past: true, card: false)

    private var stations: [Station] {
        switch mode {
        case 0: return [
            now,
            .init(time: "", glyph: "pen-sun", title: "Reggeli check-in", sub: "6 kérdés · fél perc", kind: .checkin, past: false),
            .init(time: "", glyph: "spark-cream", title: "Mai szándék", sub: "egy mondat, legfeljebb három fókusz", kind: .intention, past: false),
            .init(time: "", glyph: "spark-cream", title: "Boop észrevette", sub: "3 új megfigyelés", kind: .observe, past: false)]
        case 1: return [
            .init(time: "22:48", glyph: "moon-cream", title: "Elalvás", sub: "12 perc alatt aludtál el", kind: .lastBed, past: true, card: false),
            .init(time: "", glyph: "moon-cream", title: "Az éjszaka", sub: "7ó 12p · mély 1ó 36p · REM 1ó 44p", kind: .night, past: true),
            .init(time: "06:53", glyph: "sun-ink", title: "Ébredés", sub: "kipihenten", kind: .sleep, past: true, card: false),
            now,
            .init(time: "22:45", glyph: "moon-cream", title: "Lefekvés", sub: "emlékeztető 22:15-kor", kind: .bed, past: false)]
        case 2: return [
            now,
            .init(time: "15:00", glyph: "shoe-cream", title: "Mélyponti séta", sub: "10 perc · kb. 1 200 lépés", kind: .dip, past: false),
            .init(time: "18:30", glyph: "dumbbell-ink", title: "Felsőtest edzés", sub: "60 perc · Boop: 18:30 jobb", kind: .workout, past: false)]
        case 3: return [
            .init(time: "07:35", glyph: "bowl-cream", title: "Reggeli", sub: "zabkása bogyókkal · 523 kcal", kind: .meal, past: true),
            now,
            .init(time: "12:30", glyph: "bowl-cream", title: "Ebéd", sub: "Boop javaslata: lazac rizzsel", kind: .meal, past: false),
            .init(time: "20:00", glyph: "bowl-cream", title: "Vacsora", sub: "könnyű, 20:00-ig", kind: .meal, past: false)]
        case 4: return [
            now,
            .init(time: "13:55", glyph: "heart-cream", title: "Egy perc légzés", sub: "a sűrű sáv előtt", kind: .breath, past: false),
            .init(time: "14:00", glyph: "clock-ink", title: "Sűrű megbeszélés-sáv", sub: "4 esemény · 16:00-ig", kind: .meetings, past: false)]
        default: return [
            .init(time: "06:53", glyph: "sun-ink", title: "Ébredés", sub: "7ó 12p alvás · mély 1ó 36p", kind: .sleep, past: true, card: false),
            .init(time: "06:55", glyph: "scale-ink", title: "Mérlegelés", sub: "82,4 kg · trend 82,2", kind: .weight, past: true, card: false),
            .init(time: "07:35", glyph: "bowl-cream", title: "Reggeli", sub: "zabkása bogyókkal · 523 kcal", kind: .meal, past: true, card: false),
            now,
            .init(time: "", glyph: "pen-sun", title: "Reggeli check-in", sub: "6 kérdés · fél perc", kind: .checkin, past: false, card: false),
            .init(time: "09:00", glyph: "clock-ink", title: "Megbeszélések", sub: "6 esemény · 17:30-ig", kind: .meetings, past: false, card: false),
            .init(time: "12:30", glyph: "bowl-cream", title: "Ebéd", sub: "Boop javaslata: lazac rizzsel", kind: .meal, past: false, card: false),
            .init(time: "15:00", glyph: "shoe-cream", title: "Mélypont", sub: "10 perc séta segít", kind: .dip, past: false, card: false),
            .init(time: "18:30", glyph: "dumbbell-ink", title: "Felsőtest edzés", sub: "60 perc", kind: .workout, past: false, card: false),
            .init(time: "20:00", glyph: "bowl-cream", title: "Vacsora", sub: "könnyű, 20:00-ig", kind: .meal, past: false, card: false),
            .init(time: "22:45", glyph: "moon-cream", title: "Lefekvés", sub: "emlékeztető 22:15-kor", kind: .bed, past: false, card: false)]
        }
    }

    var body: some View {
        let list = stations
        VStack(alignment: .leading, spacing: 0) {
            ForEach(list.indices, id: \.self) { i in
                row(list[i], first: i == 0, last: i == list.count - 1, nextPast: i + 1 < list.count && list[i + 1].past)
                    .scrollTransition(.animated(.spring(response: 0.5, dampingFraction: 0.85))) { c, phase in
                        c.opacity(phase.isIdentity ? 1 : 0.35)
                            .scaleEffect(phase.isIdentity ? 1 : 0.94, anchor: .leading)
                            .rotation3DEffect(.degrees(phase.value * -10), axis: (x: 1, y: 0, z: 0), anchor: .center, perspective: 0.6)
                    }
            }
        }
    }

    private func row(_ st: Station, first: Bool, last: Bool, nextPast: Bool) -> some View {
        let open = st.card && st.kind != .now
        return HStack(alignment: .top, spacing: 12) {
            Text(st.time).font(AuraFont.mono(11.5)).foregroundStyle(.white.opacity(st.kind == .now ? 1 : (st.past ? 0.45 : 0.7)))
                .frame(width: 42, alignment: .trailing).padding(.top, st.kind == .now ? 4 : 12)
            ZStack(alignment: .top) {
                VStack(spacing: 0) {
                    segment(lit: st.past).frame(height: st.kind == .now ? 8 : 14).opacity(first ? 0 : 1)
                    Spacer(minLength: 0)
                }
                VStack(spacing: 0) {
                    Color.clear.frame(height: st.kind == .now ? 8 : 14)
                    node(st, open: open)
                    segment(lit: st.past && nextPast).frame(maxHeight: .infinity).opacity(last ? 0 : 1)
                }
            }
            .frame(width: 24)
            VStack(alignment: .leading, spacing: 10) {
                if st.kind == .now {
                    Text("MOST").font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(.white).padding(.top, 4)
                    Color.clear.frame(height: 6)
                } else {
                    Text(st.title).font(.system(size: open ? 17 : 15.5, weight: open && !st.past ? .semibold : .regular))
                        .foregroundStyle(.white.opacity(st.past ? 0.6 : (open ? 1 : 0.8)))
                        .padding(.top, 10)
                    Text(st.sub).font(.system(size: 13)).foregroundStyle(.white.opacity(st.past ? 0.4 : 0.6)).padding(.top, -6)
                    if open { card(for: st).padding(.top, 2) }
                }
            }
            .padding(.bottom, open ? 18 : 10)
        }
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

    @ViewBuilder private func node(_ st: Station, open: Bool) -> some View {
        if st.kind == .now {
            NowPulse(hue: hue)
        } else {
            ZStack {
                Circle().fill(st.past ? Color.white : (open ? Color.white.opacity(0.14) : pathBase))
                Circle().stroke(.white.opacity(st.past ? 0 : (open ? 0.9 : 0.35)), lineWidth: 1.2)
                AuraGlyph(st.past ? "check-ink" : st.glyph, st.past ? pathBase : .white.opacity(open ? 1 : 0.7), size: 11)
            }
            .frame(width: 22, height: 22)
            .shadow(color: open && !st.past ? hue.opacity(0.8) : .clear, radius: 8)
        }
    }

    // MARK: cards that hang off the path

    @ViewBuilder private func card(for st: Station) -> some View {
        switch st.kind {
        case .checkin:
            HStack(spacing: 12) {
                StillOrb(colors: SunMetric.all[2].orb, size: 40, level: 0.5)
                Text("Hogy vagy ma reggel? Öt alap és a nap kérdése.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                Spacer(minLength: 0)
                pill("Kitöltöm") { onOpen("checkin") }
            }
            .padding(14).auraGlass(20)
        case .intention:
            VStack(alignment: .leading, spacing: 8) {
                Text("„Szándékkal élek, nem sodródom.”").font(AuraFont.serif(18)).foregroundStyle(.white)
                HStack {
                    Text("Még nincs mai fókuszod.").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.65))
                    Spacer()
                    pill("Megírom") { onOpen("intention") }
                }
            }
            .padding(14).auraGlass(20)
        case .observe:
            ObservationStack(orb: orb, motion: motion, showHeader: false)
        case .night:
            VStack(alignment: .leading, spacing: 6) {
                Hypnogram().frame(height: 64)
                HStack { Text("22:48"); Spacer(); Text("06:53") }.font(AuraFont.mono(10)).foregroundStyle(.white.opacity(0.45))
            }
            .padding(14).auraGlass(20)
        case .bed:
            HStack(spacing: 12) {
                AuraGlyph("moon-cream", .white, size: 18).frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.1)))
                VStack(alignment: .leading, spacing: 2) {
                    Text("21:30 után képernyő nélkül").font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
                    Text("Vacsora 20:00-ig, így holnap is ilyen mély lesz.").font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
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
                    pill("Áttolom 18:30-ra") {}
                }
            }
            .padding(14).auraGlass(20)
        case .dip:
            HStack(spacing: 12) {
                GlowLine(points: [0.7, 0.55, 0.3, 0.42, 0.6], color: .white, nowAt: nil).frame(width: 90, height: 40)
                Text("A délutáni mélypontban egy séta frissebb délutánt ad, mint egy újabb kávé.").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.8))
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
                Text("Négy hívás egymás után. Közöttük két perc nyújtás is sokat segít.").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.8))
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

    private func pill(_ t: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            Text(t).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(pathBase)
                .padding(.horizontal, 13).padding(.vertical, 8).background(Capsule().fill(.white))
        }
        .buttonStyle(.plain)
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

// MARK: - Background: deep hue, floating lights, mirrored landscape

/// Very soft lights in the page hue that drift slower than the scroll.
struct FloatingLights: View {
    var hue: Color
    var body: some View {
        GeometryReader { g in
            ZStack {
                light(size: 360, x: g.size.width * 0.15, y: 60, o: 0.30)
                light(size: 300, x: g.size.width * 0.85, y: g.size.height * 0.45, o: 0.24)
                light(size: 380, x: g.size.width * 0.3, y: g.size.height * 0.85, o: 0.20)
            }
            .frame(width: g.size.width, height: g.size.height)
            .visualEffect { c, proxy in c.offset(y: -proxy.frame(in: .scrollView).minY * 0.35) }
        }
        .allowsHitTesting(false)
    }
    private func light(size: CGFloat, x: CGFloat, y: CGFloat, o: Double) -> some View {
        Circle().fill(hue.opacity(o)).frame(width: size, height: size).blur(radius: size * 0.33)
            .position(x: x, y: y)
    }
}

/// The landscape again at the very bottom, mirrored and faint, like a lake closing the page.
struct MirroredLand: View {
    var sky: [Color]
    var body: some View {
        PaintedLandscape(sky: sky)
            .frame(height: 300)
            .scaleEffect(x: 1, y: -1)
            .opacity(0.28)
            .mask(LinearGradient(colors: [.clear, .black.opacity(0.9)], startPoint: .top, endPoint: .bottom))
            .allowsHitTesting(false)
    }
}
