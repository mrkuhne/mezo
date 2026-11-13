import SwiftUI

// Round 2 (owner, 2026-11-13): the first take had TWO menus stacked — seven orbs on top, five buttons below —
// and the Reggel/Napközben/Este chips were a switch for something you scroll anyway. Rebuilt:
//   • ONE home screen = the whole day in a single scroll, no phase chips (they are headings now), one orb.
//   • The areas are not a cramped orb strip: they are WIDE CARDS further down the same scroll, each with its
//     own sentence, number and little picture. The ones with something to say come first; the quiet ones
//     collapse into thin rows.
//   • Tapping an area opens its OWN full dashboard with inner top tabs — as if that area were its own app.

struct EItem: Identifiable {
    enum Kind { case wake, checkin, meal, calendar, train, money, mail, close, sleep }
    let id = UUID()
    let t: Double, time: String, glyph: String, title: String, sub: String, kind: Kind
    var action: String? = nil

    static let day: [EItem] = [
        EItem(t: 6.88, time: "06:53", glyph: "sun-ink", title: "Ébredés", sub: "7ó 12p alvás · 1ó 36p mély", kind: .wake),
        EItem(t: 7.33, time: "07:20", glyph: "pen-sun", title: "Reggeli check-in", sub: "Energia 7 · hangulat 8 · feszültség 4", kind: .checkin),
        EItem(t: 8.0, time: "08:00", glyph: "e-level", title: "A reggeli posta", sub: "34 levél · 31 elintézve · 2 megér egy percet", kind: .mail, action: "Megnézem"),
        EItem(t: 8.33, time: "08:20", glyph: "bowl-cream", title: "Reggeli", sub: "Zabkása áfonyával · 32 g fehérje", kind: .meal),
        EItem(t: 9.0, time: "09:00", glyph: "clock-ink", title: "Megbeszélések · 4 esemény", sub: "9:00–12:00 · legsűrűbb 10:30-kor", kind: .calendar),
        EItem(t: 12.1, time: "12:06", glyph: "e-penz", title: "Spar · 8 240 Ft", sub: "Bevásárlás · a banki üzenetből, magától", kind: .money),
        EItem(t: 12.67, time: "12:40", glyph: "bowl-cream", title: "Ebéd", sub: "Csirke rizzsel, salátával · 46 g fehérje", kind: .meal),
        EItem(t: 14.0, time: "14:00", glyph: "clock-ink", title: "Megbeszélések · 3 esemény", sub: "14:00–17:30 · ügyfélhívás csúszhat", kind: .calendar),
        EItem(t: 15.0, time: "15:00", glyph: "e-level", title: "Délutáni posta", sub: "11 levél · 1 akció, amit figyeltél", kind: .mail, action: "Megnézem"),
        EItem(t: 16.0, time: "16:00", glyph: "pen-sun", title: "Délutáni check-in", sub: "3 kérdés · fél perc", kind: .checkin, action: "Kitöltöm"),
        EItem(t: 18.5, time: "18:30", glyph: "dumbbell-ink", title: "Felsőtest edzés", sub: "75 perc · 5 gyakorlat", kind: .train, action: "Indítás"),
        EItem(t: 19.75, time: "19:45", glyph: "bowl-cream", title: "Vacsora", sub: "Boop: legalább 50 g fehérje", kind: .meal, action: "Lefotózom"),
        EItem(t: 21.5, time: "21:30", glyph: "spark-cream", title: "Esti zárás", sub: "Kevesebb mint egy perc", kind: .close, action: "Lezárom"),
        EItem(t: 22.75, time: "22:45", glyph: "moon-cream", title: "Lefekvés", sub: "Emlékeztetlek 22:15-kor", kind: .sleep),
    ]

    /// Which heading a row sits under. The headings are text in the scroll, not a switch.
    static func band(_ t: Double) -> Int { t < 9 ? 0 : (t < 21.4 ? 1 : 2) }
    static let bandName = ["Reggel", "Napközben", "Este"]
    static let bandRange = ["06:53 – 09:00", "09:00 – 21:30", "21:30 – 22:45"]
}

/// What one area shows on the home screen.
struct EArea: Identifiable {
    let id: Int                 // index into EMetric.all
    let verdict: String         // the sentence
    let big: String, unit: String, cap: String
    let bars: [Double]          // the little picture: seven days
    let loud: Bool              // has something to say today → wide card; otherwise a thin row
    var m: EMetric { EMetric.all[id] }

    static let all: [EArea] = [
        EArea(id: 6, verdict: "Két levél megér egy percet", big: "34", unit: "levél", cap: "31-et elintéztem helyetted",
              bars: [0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8], loud: true),
        EArea(id: 5, verdict: "A kereten belül vagy, de az éttermek elfogytak", big: "281 600", unit: "Ft", cap: "a havi 610 000-ből, a 13. napon",
              bars: [0.32, 0.58, 0.21, 0.9, 0.44, 0.76, 0.18], loud: true),
        EArea(id: 2, verdict: "Van még benne több", big: "1 240", unit: "lépés", cap: "egy ebéd utáni séta a cél felét hozza",
              bars: [0.8, 0.9, 0.5, 0.85, 0.7, 0.4, 0.22], loud: true),
        EArea(id: 1, verdict: "Kipihented magad", big: "7ó 12p", unit: "", cap: "ebből 1 óra 36 perc mély",
              bars: [0.7, 0.75, 0.6, 0.8, 0.72, 0.9, 0.82], loud: false),
        EArea(id: 3, verdict: "Jó úton jársz", big: "38", unit: "g fehérje", cap: "a napi 165-ből, ebéd után",
              bars: [0.6, 0.72, 0.55, 0.8, 0.66, 0.5, 0.71], loud: false),
        EArea(id: 4, verdict: "Kicsit feszült vagy", big: "4", unit: "/10", cap: "feszültség a délelőtti check-inben",
              bars: [0.5, 0.45, 0.6, 0.3, 0.55, 0.62, 0.69], loud: false),
    ]
}

/// The proposal that only a life dashboard can make — it needs mail, price, budget, plan and calendar at once.
struct EProposal {
    let id: String, text: String, sub: String, accepted: String
    let facts: [(String, String, String)]
    let areas: [(Int, String)]

    static let shoe = EProposal(
        id: "shoe",
        text: "A futócipő, amit kinéztél, ma 32%-kal olcsóbb",
        sub: "44 990 Ft helyett 30 590 Ft. Ez az eddigi legolcsóbb ár, amit láttam rá.",
        accepted: "Felvettem a tervezett kiadások közé",
        facts: [("30 590", "Ft", "a mai ár a reggeli levélben"), ("38 400", "Ft", "a szokásos ára, 4 bolt alapján"), ("54 000", "Ft", "ami a hónapból még szabadon van")],
        areas: [(5, "A havi keretedbe belefér, és nincs mellette másik nagy tétel a héten."),
                (6, "A márka leveleit eddig 11-szer dobtam ki — ez az első, amelyik tényleg olcsóbb."),
                (2, "A mostani cipőd 780 kilométernél jár, a futóidőid három hete lassulnak."),
                (0, "A nyári célodhoz heti három futás kell. Ehhez a cipő nem luxus, hanem feltétel.")])

    static let dinner = EProposal(
        id: "dinner",
        text: "Ma inkább otthon vacsorázz",
        sub: "Az étteremre költés a héten már 24 000 Ft, és a fehérje is elmarad.",
        accepted: "Jó — a vacsora otthon lesz",
        facts: [("24 000", "Ft", "éttermekre ezen a héten"), ("9 500", "Ft", "a heti kereted maradéka"), ("38", "g", "fehérje, a 165-ből")],
        areas: [(5, "Ha ma is étterem lesz, 14 500 Ft-tal lépitek túl a heti keretet."),
                (3, "Otthon egy csirkés tál 52 g fehérjét hoz — pont annyit, amennyi hiányzik."),
                (1, "A késői, nehéz vacsorák után átlagosan 24 perccel kevesebbet alszol.")])
}

// MARK: - Home

struct EletMa: View {
    @Binding var path: [String]
    var onToast: (String) -> Void

    @State private var motion = OrbMotion()
    @State private var decided: [String: Bool] = [:]
    @State private var compact = false
    @State private var quietOpen = false
    private let day = EMetric.all[0]                 // the day's own orb
    private let now = 13.67

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
                ScrollView {
                    VStack(spacing: 0) {
                        hero(height: geo.size.height * 0.60 + geo.safeAreaInsets.top)
                        VStack(spacing: 30) {
                            dayScroll
                            areaStack
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 40)
                        .background(FloatingLights(hue: day.glow).padding(.vertical, -120))
                        MirroredLand(sky: day.sky).padding(.top, -20).padding(.bottom, 60)
                    }
                }
                .scrollIndicators(.hidden)
                .ignoresSafeArea(edges: .top)
                .background(gPageBackground(day.top).ignoresSafeArea())
                .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > geo.size.height * 0.5 } action: { _, v in
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { compact = v }
                }
                .overlay(alignment: .top) { if compact { compactHeader } }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { key in
                EletAreaPage(metric: Int(key.dropFirst()) ?? 0, onToast: onToast)
            }
        }
        .onDisappear { motion.stop() }
    }

    // MARK: Hero — one orb, one sentence. No metric strip, no phase chips.

    private func hero(height: CGFloat) -> some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: height)
                .overlay { PaintedLandscape(sky: day.sky) }
                .clipped()
                .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.68), .init(color: gBase.opacity(0.4), location: 0.88),
                                                .init(color: gBase.opacity(0), location: 1)], startPoint: .top, endPoint: .bottom))
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.82), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))

            VStack(spacing: 0) {
                HStack {
                    Text("Csütörtök · 13:40").font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.75))
                        .frame(width: 130, alignment: .leading)
                    Spacer()
                    Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
                    Spacer()
                    AuraGlyph("person-sage", .white, size: 20).frame(width: 44, height: 44)
                        .glassEffect(.clear, in: .circle)
                        .frame(width: 130, alignment: .trailing)
                }
                .padding(.horizontal, 16)
                .padding(.top, 58)

                sun.frame(height: 198).padding(.top, 6).padding(.bottom, 10)

                Text("A MAI NAPOD").font(.system(size: 13, weight: .semibold)).tracking(2.6)
                    .foregroundStyle(.white.opacity(0.8))
                Text("Jó napod lesz").font(AuraFont.serif(38)).foregroundStyle(.white).padding(.top, 8)
                Text("Kipihent vagy, a pénzed a kereten belül, és két levél jött, ami megér egy percet.")
                    .font(.system(size: 16.5)).lineSpacing(4).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 30).padding(.top, 10)
                Spacer(minLength: 0)
            }
            .frame(height: height)
        }
    }

    private var sun: some View {
        GeometryReader { g in
            let H = g.size.height, size: CGFloat = 126
            let cy = H - 8 - 0.63 * (H - 8 - size / 2 - 6)
            ZStack {
                Circle().fill(day.glow.opacity(0.18)).frame(width: size * 1.7).blur(radius: 60)
                LivingOrb(mood: .good, size: size, motion: motion, palette: day.orb, glow: true, level: 0.78)
                Text("78").font(.custom("Outfit", size: 46).weight(.light)).foregroundStyle(.white)
                    .monospacedDigit().shadow(color: .black.opacity(0.35), radius: 10).allowsHitTesting(false)
            }
            .frame(width: g.size.width, height: size * 2)
            .position(x: g.size.width / 2, y: cy)
            .mask(alignment: .top) {
                LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.93), .init(color: .clear, location: 1)],
                               startPoint: .top, endPoint: .bottom).frame(height: H - 8 + 14)
            }
        }
    }

    private var compactHeader: some View {
        HStack(spacing: 10) {
            LivingOrb(mood: .good, size: 26, motion: motion, palette: day.orb, glow: false, level: 0.78).allowsHitTesting(false)
            Text("Ma").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
            Text("13:40").font(.custom("Outfit", size: 17).weight(.light)).foregroundStyle(.white.opacity(0.8))
            Text("· 78").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
        }
        .padding(.leading, 8).padding(.trailing, 16).frame(height: 44)
        .glassEffect(.regular, in: .capsule)
        .padding(.top, 2)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: The day — one list, the three parts of the day are headings in it

    private var dayScroll: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(0..<3, id: \.self) { b in
                let items = EItem.day.filter { EItem.band($0.t) == b }
                bandHead(b).padding(.top, b == 0 ? 0 : 26).padding(.bottom, 6)
                VStack(spacing: 0) {
                    let nowIdx = items.firstIndex { $0.t > now }
                    ForEach(Array(items.enumerated()), id: \.element.id) { k, it in
                        if b == 1, k == nowIdx { nowRow; proposalBlock }
                        row(it, past: it.t <= now, first: k == 0, last: k == items.count - 1)
                    }
                }
                .padding(.horizontal, 6)
            }
        }
    }

    private func bandHead(_ b: Int) -> some View {
        HStack(spacing: 10) {
            Text(EItem.bandName[b]).font(AuraFont.serif(26)).foregroundStyle(.white)
            Text(EItem.bandRange[b]).font(AuraFont.mono(11.5)).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
            Spacer()
        }
    }

    private var nowRow: some View {
        HStack(spacing: 10) {
            Text("13:40").font(AuraFont.mono(13, .bold)).foregroundStyle(.white).frame(width: 48, alignment: .trailing)
            NowPulse(hue: day.glow).frame(width: 24)
            Text("MOST").font(AuraFont.mono(11, .bold)).tracking(1.2).foregroundStyle(.white)
            Spacer()
        }
        .padding(.vertical, 8)
        .background(alignment: .leading) { line(lit: true).padding(.leading, 58) }
    }

    private var proposalBlock: some View {
        VStack(spacing: 10) {
            ForEach([EProposal.shoe, EProposal.dinner], id: \.id) { p in
                HStack(alignment: .top, spacing: 8) {
                    Color.clear.frame(width: 14)
                    line(lit: false).frame(width: 24)
                    EProposalCard(p: p, decided: decided[p.id]) { ok in
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { decided[p.id] = ok }
                        onToast(ok ? p.accepted : "Rendben, most nem")
                    }
                    .padding(.vertical, 4)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func line(lit: Bool) -> some View {
        Rectangle().fill(lit ? .white : .white.opacity(0.16)).frame(width: lit ? 2 : 1.5)
            .shadow(color: lit ? day.glow.opacity(0.9) : .clear, radius: 5)
            .frame(width: 24)
    }

    private func row(_ it: EItem, past: Bool, first: Bool, last: Bool) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(it.time).font(AuraFont.mono(13)).foregroundStyle(.white.opacity(past ? 0.45 : 0.85)).frame(width: 48, alignment: .trailing)
            ZStack {
                VStack(spacing: 0) {
                    line(lit: past).opacity(first ? 0 : 1)
                    line(lit: past && !last).opacity(last ? 0 : 1)
                }
                ZStack {
                    Circle().fill(past ? .white : gBase)
                    if !past { Circle().stroke(.white.opacity(it.action != nil ? 0.8 : 0.3), lineWidth: 1.2) }
                    EGlyph(past ? "check-ink" : it.glyph, past ? gBase : .white, size: 13)
                }
                .frame(width: 26, height: 26)
                .shadow(color: !past && it.action != nil ? day.glow.opacity(0.7) : .clear, radius: 8)
            }
            .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(it.title).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white.opacity(past ? 0.55 : 1))
                Text(it.sub).font(.system(size: 13)).foregroundStyle(.white.opacity(past ? 0.4 : 0.6))
                if it.kind == .calendar {
                    GBusy(from: it.t).frame(height: 6).opacity(past ? 0.5 : 1).padding(.top, 4).padding(.trailing, 20)
                }
            }
            .padding(.vertical, 12)
            Spacer(minLength: 4)
            if let a = it.action, !past {
                Text(a).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(gBase)
                    .lineLimit(1).fixedSize()
                    .padding(.horizontal, 13).frame(height: 34)
                    .background(Capsule().fill(.white))
                    .onTapGesture { tap(it) }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { tap(it) }
    }

    private func tap(_ it: EItem) {
        switch it.kind {
        case .money: path.append("m5")
        case .mail: path.append("m6")
        case .meal: path.append("m3")
        case .train: path.append("m2")
        case .wake, .sleep: path.append("m1")
        case .checkin: path.append("m4")
        default: break
        }
    }

    // MARK: The areas — wide cards for what has something to say, thin rows for the rest

    private var areaStack: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text("A területeid").font(AuraFont.serif(26)).foregroundStyle(.white)
                Text("AMI MA SZÁMÍT ELÖL").font(AuraFont.mono(10.5)).tracking(1.2)
                    .foregroundStyle(.white.opacity(0.4)).padding(.top, 8)
                Spacer()
            }
            ForEach(EArea.all.filter(\.loud)) { a in
                Button { path.append("m\(a.id)") } label: { bigCard(a) }.buttonStyle(.plain)
            }
            VStack(spacing: 0) {
                Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { quietOpen.toggle() } } label: {
                    HStack(spacing: 10) {
                        ForEach(EArea.all.filter { !$0.loud }) { a in
                            StillOrb(colors: a.m.orb, size: 20, level: 0.8)
                        }
                        Text("Ezek ma rendben vannak").font(.system(size: 14.5)).foregroundStyle(.white.opacity(0.7))
                        Spacer()
                        Image(systemName: quietOpen ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
                    }
                    .padding(.horizontal, 16).frame(height: 54).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if quietOpen {
                    VStack(spacing: 0) {
                        ForEach(EArea.all.filter { !$0.loud }) { a in
                            Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 16)
                            Button { path.append("m\(a.id)") } label: { thinRow(a) }.buttonStyle(.plain)
                        }
                    }
                    .transition(.opacity.combined(with: .offset(y: -10)))
                }
            }
            .gCard(22)
        }
    }

    private func bigCard(_ a: EArea) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                StillOrb(colors: a.m.orb, size: 26, level: Double(a.m.value) / 100)
                Text(a.m.name.uppercased()).font(AuraFont.mono(11.5, .bold)).tracking(1.6).foregroundStyle(.white.opacity(0.7))
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
            Text(a.verdict).font(AuraFont.serif(21)).lineSpacing(3).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true).padding(.top, 10)
            HStack(alignment: .bottom, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(a.big).font(.custom("Outfit", size: 30).weight(.light)).foregroundStyle(.white)
                        Text(a.unit).font(.system(size: 13)).foregroundStyle(.white.opacity(0.65))
                    }
                    Text(a.cap).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                EMiniBars(values: a.bars, hue: a.m.glow).frame(width: 104, height: 42)
            }
            .padding(.top, 14)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .gCard(22)
    }

    private func thinRow(_ a: EArea) -> some View {
        HStack(spacing: 12) {
            StillOrb(colors: a.m.orb, size: 22, level: Double(a.m.value) / 100)
            VStack(alignment: .leading, spacing: 2) {
                Text(a.m.name).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                Text(a.verdict).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
            }
            Spacer(minLength: 6)
            Text(a.big).font(.custom("Outfit", size: 17).weight(.light)).foregroundStyle(.white.opacity(0.9))
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.35))
        }
        .padding(.horizontal, 16).frame(height: 58).contentShape(Rectangle())
    }
}

/// Seven days as soft bars — the little picture on an area card.
struct EMiniBars: View {
    var values: [Double]
    var hue: Color
    var body: some View {
        Canvas { ctx, s in
            let n = values.count, w = s.width / CGFloat(n)
            for (i, v) in values.enumerated() {
                let h = max(4, s.height * v)
                let r = CGRect(x: CGFloat(i) * w + 1.5, y: s.height - h, width: w - 3, height: h)
                ctx.fill(Path(roundedRect: r, cornerRadius: 3),
                         with: .color(hue.opacity(i == n - 1 ? 1 : 0.42)))
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Proposal card + "miért?" (unchanged in spirit: the areas speak as labelled lines)

struct EProposalCard: View {
    let p: EProposal
    var decided: Bool?
    var onDecide: (Bool) -> Void
    @State private var why = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                StillOrb(colors: EMetric.all[0].orb, size: 20, level: 0.85)
                GLabel("BOOP JAVASOLJA")
                Spacer()
                if let d = decided {
                    Text(d ? "Elfogadva" : "Most nem").font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.65))
                }
            }
            Text(p.text).font(AuraFont.serif(21)).lineSpacing(3).foregroundStyle(.white).padding(.top, 10)
            Text(p.sub).font(.system(size: 14)).lineSpacing(3).foregroundStyle(.white.opacity(0.68)).padding(.top, 6)
            HStack(spacing: 8) {
                ForEach(p.areas.prefix(4), id: \.0) { a in
                    StillOrb(colors: EMetric.all[a.0].orb, size: 18, level: 0.8)
                }
                Text("\(p.areas.count) terület szólt hozzá").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                Spacer()
            }
            .padding(.top, 12)
            HStack(spacing: 8) {
                if decided == nil {
                    EPill(title: "Elfogadom") { onDecide(true) }
                    EPill(title: "Most nem", primary: false) { onDecide(false) }
                }
                Spacer(minLength: 4)
                Button { why = true } label: {
                    Text("miért?").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.8)).underline()
                }
                .buttonStyle(.plain)
            }
            .padding(.top, decided == nil ? 14 : 12)
        }
        .padding(18)
        .gCard()
        .sheet(isPresented: $why) {
            EWhySheet(p: p)
                .presentationDetents([.large])
                .presentationBackground(gBase)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
    }
}

struct EWhySheet: View {
    let p: EProposal
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                GHead(sky: EMetric.all[0].sky, height: 220)
                    .overlay(alignment: .bottomLeading) {
                        VStack(alignment: .leading, spacing: 8) {
                            GLabel("MIÉRT")
                            Text(p.text).font(AuraFont.serif(26)).lineSpacing(3).foregroundStyle(.white)
                        }
                        .padding(.horizontal, 22).padding(.bottom, 10)
                    }
                VStack(alignment: .leading, spacing: 22) {
                    HStack(spacing: 10) {
                        ForEach(Array(p.facts.enumerated()), id: \.offset) { _, f in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .firstTextBaseline, spacing: 3) {
                                    Text(f.0).font(.custom("Outfit", size: 22).weight(.medium)).foregroundStyle(.white)
                                    Text(f.1).font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
                                }
                                Text(f.2).font(.system(size: 11.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.55))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .gCard(16)
                        }
                    }
                    VStack(alignment: .leading, spacing: 14) {
                        GLabel("AMIT A TERÜLETEK MONDTAK")
                        ForEach(Array(p.areas.enumerated()), id: \.offset) { _, a in
                            HStack(alignment: .top, spacing: 12) {
                                StillOrb(colors: EMetric.all[a.0].orb, size: 26, level: 0.8)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(EMetric.all[a.0].name).font(AuraFont.mono(11, .bold)).tracking(1.2)
                                        .foregroundStyle(.white.opacity(0.65))
                                    Text(a.1).font(.system(size: 14.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.9))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .gCard()
                }
                .padding(.horizontal, 16).padding(.top, 18).padding(.bottom, 50)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(EMetric.all[0].top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
    }
}
