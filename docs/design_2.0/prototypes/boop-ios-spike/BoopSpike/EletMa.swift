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
        EArea(id: 7, verdict: "Két levél megér egy percet", big: "34", unit: "levél", cap: "31-et elintéztem helyetted",
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
                (7, "A márka leveleit eddig 11-szer dobtam ki — ez az első, amelyik tényleg olcsóbb."),
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

// MARK: - Home — the living wall

struct EletMa: View {
    @Binding var path: [String]
    var onToast: (String) -> Void

    @State private var motion = OrbMotion()
    @State private var acted: [String: String] = [:]          // card id → the line it left behind
    @State private var dismissed: Set<String> = []
    @State private var briefOpen = false
    @State private var dayOpen = false
    @State private var pastOpen = false
    @State private var compact = false
    private let day = EMetric.all[0]
    private let now = 13.67

    /// At most three, plus the check-in pinned while it is due.
    private var live: [EFeedCard] {
        let rest = EFeedCard.now.filter { $0.kind != .checkin && acted[$0.id] == nil && !dismissed.contains($0.id) }
        let head = EFeedCard.now.filter { $0.kind == .checkin && acted[$0.id] == nil }
        return head + Array(rest.prefix(3))
    }
    private var settled: [String] { EFeedCard.now.compactMap { acted[$0.id] } }

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
                ScrollView {
                    VStack(spacing: 0) {
                        hero(height: geo.size.height * 0.565 + geo.safeAreaInsets.top)
                        VStack(alignment: .leading, spacing: 22) {
                            feed
                            folds
                            notices
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 2)
                        .padding(.bottom, 40)
                        .background(FloatingLights(hue: day.glow).padding(.vertical, -120))
                        MirroredLand(sky: day.sky).padding(.top, -20).padding(.bottom, 60)
                    }
                }
                .scrollIndicators(.hidden)
                .ignoresSafeArea(edges: .top)
                .background(gPageBackground(day.top).ignoresSafeArea())
                .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > geo.size.height * 0.36 } action: { _, v in
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

    // MARK: Hero — the orb and a sentence. No score: a number you cannot act on is not a greeting.

    private func hero(height: CGFloat) -> some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: height)
                .overlay {
                    if EWarm.on, let name = EWarm.moodPhoto(0) {
                        photo(name).resizable().scaledToFill()
                            .saturation(0.8).brightness(-0.06)
                            .overlay(LinearGradient(stops: [
                                .init(color: day.top.opacity(0.52), location: 0),
                                .init(color: day.top.opacity(0.14), location: 0.26),
                                .init(color: .clear, location: 0.46),
                                .init(color: gBase.opacity(0.55), location: 0.84),
                                .init(color: gBase, location: 1),
                            ], startPoint: .top, endPoint: .bottom))
                            .overlay(Rectangle().fill(day.glow).opacity(0.07).blendMode(.color))
                    } else {
                        PaintedLandscape(sky: day.sky)
                    }
                }
                .clipped()
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.82), .init(color: .clear, location: 1)],
                                     startPoint: .top, endPoint: .bottom))

            VStack(spacing: 0) {
                HStack {
                    Text("Csütörtök · november 13.").font(AuraFont.mono(12))
                        .foregroundStyle(.white.opacity(0.75))
                    Spacer()
                    AuraGlyph("person-sage", .white, size: 20).frame(width: 42, height: 42)
                        .glassEffect(.clear, in: .circle)
                }
                .padding(.horizontal, 20).padding(.top, 56)

                VStack(spacing: 12) {
                    Text("boop").font(.custom("Outfit", size: 33).weight(.light)).tracking(4.5)
                        .foregroundStyle(.white)
                    Rectangle()
                        .fill(LinearGradient(colors: [.white.opacity(0), .white.opacity(0.22), .white.opacity(0)],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(height: 0.8)
                        .padding(.horizontal, 44)
                }
                .padding(.top, 16)

                orbRibbon.padding(.top, 22)

                Rectangle()
                    .fill(LinearGradient(colors: [.white.opacity(0), .white.opacity(0.16), .white.opacity(0)],
                                         startPoint: .leading, endPoint: .trailing))
                    .frame(height: 0.8)
                    .padding(.horizontal, 30)
                    .padding(.top, 16)

                HStack(spacing: 8) {
                    Capsule().fill(day.glow).frame(width: 3, height: 13)
                    Text("MAI NAP").font(AuraFont.mono(12)).tracking(1.6)
                        .foregroundStyle(.white.opacity(0.75))
                    Spacer()
                }
                .padding(.horizontal, 20).padding(.top, 16)

                EDayCurve(values: EDay.curve, labels: EDay.hours, events: EDay.events,
                          hue: day.glow, now: 0.47, height: 220)
                    .padding(.horizontal, 18).padding(.top, 6)


                Spacer(minLength: 0)
            }
            .frame(height: height)
        }
    }

    /// A thin ribbon of every area — a readout, not a menu: small, scrollable, and it does not
    /// compete with the bar below, because Terv stays the home of the areas.
    private var orbRibbon: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 15) {
                ForEach(EMetric.all.indices, id: \.self) { i in
                    let x = EMetric.all[i]
                    Button { path.append("m\(i)") } label: {
                        VStack(spacing: 5) {
                            ZStack {
                                LivingOrb(mood: .good, size: 36, motion: motion, palette: x.orb,
                                          glow: false, level: Double(x.value) / 100)
                                    .allowsHitTesting(false)
                                Text("\(x.value)").font(.custom("Outfit", size: 13).weight(.medium))
                                    .foregroundStyle(.white).shadow(color: .black.opacity(0.55), radius: 3)
                            }
                            Text(x.name).font(.system(size: 10.5)).foregroundStyle(.white.opacity(0.65))
                                .lineLimit(1)
                        }
                        .frame(minWidth: 46)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
    }

    private var compactHeader: some View {
        HStack(spacing: 10) {
            LivingOrb(mood: .good, size: 26, motion: motion, palette: day.orb, glow: false, level: 0.78)
                .allowsHitTesting(false)
            Text("Ma").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
            Text("13:40").font(.custom("Outfit", size: 17).weight(.light)).foregroundStyle(.white.opacity(0.8))
            if !live.isEmpty {
                Text("· \(live.count) új").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
            }
        }
        .padding(.leading, 8).padding(.trailing, 16).frame(height: 44)
        .glassEffect(.regular, in: .capsule)
        .padding(.top, 2)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: Most — at most three, and an honest empty state

    private var feed: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text("Most").font(AuraFont.serif(27)).foregroundStyle(.white)
                if !live.isEmpty {
                    Text("\(live.count)").font(.custom("Outfit", size: 13).weight(.semibold))
                        .foregroundStyle(gBase).frame(minWidth: 22, minHeight: 22)
                        .background(Capsule().fill(.white)).padding(.top, 4)
                }
                Spacer()
            }
            if live.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 9) {
                        StillOrb(colors: day.orb, size: 22, level: 0.85)
                        Text("MINDEN RENDBEN").font(AuraFont.mono(10.5, .bold)).tracking(1.5)
                            .foregroundStyle(.white.opacity(0.6))
                        Spacer()
                    }
                    Text("Most nincs teendőd.").font(AuraFont.serif(21)).foregroundStyle(.white).padding(.top, 2)
                    Text("Legközelebb 17:00-kor szólok, az edzés előtti falat miatt.")
                        .font(.system(size: 14)).foregroundStyle(.white.opacity(0.7))
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(24)
            } else {
                // the check-in is its own shape; then ONE hero with a photo band; then the quiet ones
                // in a single card — a wall, not five equal boxes
                if let q = live.first(where: { $0.kind == .checkin }) {
                    EFeedCardView(c: q) { act(q, $0) }
                }
                let rest = live.filter { $0.kind != .checkin }
                if let hero = rest.first {
                    EFeedCardView(c: hero) { act(hero, $0) }
                }
                if rest.count > 1 {
                    VStack(spacing: 0) {
                        ForEach(Array(rest.dropFirst().enumerated()), id: \.element.id) { i, c in
                            if i > 0 {
                                Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 65)
                            }
                            EFeedRowView(c: c) { act(c, $0) }
                        }
                    }
                    .padding(.horizontal, 16)
                    .gCard(24)
                }
            }
        }
    }

    private func act(_ c: EFeedCard, _ line: String) {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
            if line == "Rendben, most nem" { dismissed.insert(c.id) } else { acted[c.id] = line }
        }
        onToast(line)
    }

    // MARK: The day, folded away — reviewed in the morning, not stared at all day

    private var folds: some View {
        VStack(spacing: 10) {
            if !settled.isEmpty {
                EFoldRow(title: "Ma történt", sub: "\(settled.count) elintézve", glyph: "check-ink",
                         hue: day.glow, open: $pastOpen) {
                    VStack(alignment: .leading, spacing: 11) {
                        ForEach(Array(settled.enumerated()), id: \.offset) { _, s in
                            HStack(spacing: 10) {
                                AuraGlyph("check-ink", day.glow, size: 14)
                                Text(s).font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                                Spacer()
                            }
                        }
                    }
                }
            }
            EFoldRow(title: "A reggeli összefoglaló", sub: "08:10 · Boop mondta", glyph: "sun-ink",
                     hue: day.glow, open: $briefOpen) { briefing }
            Button { path.append("m6") } label: {
                HStack(spacing: 13) {
                    EGlyph("clock-ink", .white.opacity(0.9), size: 17).frame(width: 36, height: 36)
                        .background(Circle().fill(.white.opacity(0.08)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("A napod").font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                        Text("6 esemény · 72%-ban tele · edzés 18:30").font(.system(size: 12.5))
                            .foregroundStyle(.white.opacity(0.55))
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.45))
                }
                .padding(.horizontal, 16).padding(.vertical, 13)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .gCard(22)
        }
    }

    // MARK: What Boop noticed — the cross-area observations, as cards

    private var notices: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 10) {
                Text("Amit ma észrevettem").font(AuraFont.serif(26)).foregroundStyle(.white)
                Spacer()
                Text("\(EMaNotice.all.count)").font(.custom("Outfit", size: 13).weight(.semibold))
                    .foregroundStyle(.white.opacity(0.75))
                    .frame(minWidth: 22, minHeight: 22)
                    .background(Circle().fill(.white.opacity(0.12)))
            }
            ForEach(Array(EMaNotice.all.enumerated()), id: \.offset) { _, n in
                let hue = EMetric.all[n.areas[0]].glow
                HStack(alignment: .top, spacing: 0) {
                    Capsule().fill(hue).frame(width: 3)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 7) {
                            HStack(spacing: -7) {
                                ForEach(n.areas, id: \.self) { a in
                                    StillOrb(colors: EMetric.all[a].orb, size: 19, level: 0.8)
                                        .overlay(Circle().stroke(gBase, lineWidth: 1.5))
                                }
                            }
                            Text(n.areas.map { EMetric.all[$0].name }.joined(separator: " · "))
                                .font(AuraFont.mono(10)).tracking(1.1).foregroundStyle(.white.opacity(0.5))
                            Spacer(minLength: 0)
                        }
                        Text(n.title).font(AuraFont.serif(18)).lineSpacing(2).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                        EHueText(text: n.text, hue: hue, size: 13.5, opacity: 0.68)
                    }
                    .padding(.horizontal, 15).padding(.vertical, 14)
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .gCard(20)
            }
            EAskRow(text: "Kérdezd meg Boopot, mit vett még észre") { onToast("Új szál · a mai mintákkal") }
                .padding(.top, 2)
        }
    }

    private var briefing: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                LivingOrb(mood: .good, size: 24, motion: motion, palette: day.orb, glow: false, level: 0.78)
                    .allowsHitTesting(false)
                GLabel("BOOP MONDJA · 08:10")
                Spacer()
                Button { onToast("Boop felolvassa") } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "speaker.wave.2.fill").font(.system(size: 12, weight: .semibold))
                        Text("Hallgatom").font(.system(size: 12.5, weight: .semibold))
                    }
                    .foregroundStyle(.white.opacity(0.9))
                    .padding(.horizontal, 11).frame(height: 30)
                    .background(Capsule().fill(.white.opacity(0.12)))
                }
                .buttonStyle(.plain)
            }

            Text("Jó reggelt. Jól aludtál, és ez meg is látszik majd a napon.")
                .font(AuraFont.serif(23)).lineSpacing(4).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)

            EHueText(text: "Hét óra tizenkét perc, ebből *másfél óra mély* — tizennyolc perccel több, mint a heti átlagod. A *Formád 78*, ami négy ponttal jobb a tegnapinál.",
                     hue: day.glow, size: 15).padding(.top, 10)

            EHueText(text: "A naptárad sűrű: *hat megbeszélés*, a legnehezebb blokk fél tizenegykor. Ezért tettem az *edzést fél hétre* — így marad fél óra levegő a munka után, és tíz előtt kész a vacsora.",
                     hue: day.glow, size: 15).padding(.top, 10)

            EHueText(text: "A postádból harmincnégy levélből *kettőt* hagytam meg neked, és az egyik tényleg jó hír: a futócipő, amit hetek óta figyelsz, ma *a legolcsóbb, amit valaha láttam rá*. A pénzed rendben van, csak az *éttermek kerete fogyott el*.",
                     hue: day.glow, size: 15).padding(.top, 10)

            // a peek into every area, in one line each
            FlowRow(spacing: 8, rowSpacing: 8) {
                EChip(glyph: "moon-cream", text: "Alvás 7ó 12p", orb: EMetric.all[1].orb)
                EChip(glyph: "e-penz", text: "281 600 Ft", orb: EMetric.all[5].orb)
                EChip(glyph: "e-level", text: "2 érdekes levél", orb: EMetric.all[7].orb)
                EChip(glyph: "clock-ink", text: "6 esemény")
                EChip(glyph: "dumbbell-ink", text: "Edzés 18:30", orb: EMetric.all[2].orb)
                EChip(glyph: "bowl-cream", text: "165 g fehérje", orb: EMetric.all[3].orb)
            }
            .padding(.top, 16)

            Rectangle().fill(.white.opacity(0.09)).frame(height: 0.5).padding(.top, 18)

            Text("A NAP HÁROM DOLGA").font(AuraFont.mono(11, .bold)).tracking(1.5)
                .foregroundStyle(.white.opacity(0.6)).padding(.top, 16)
            VStack(alignment: .leading, spacing: 11) {
                briefRow(1, "Ebédnél legalább 45 g fehérje", "ez a leggyengébb pontod két hete")
                briefRow(2, "18:30-kor felsőtest, 75 perc", "a fekvenyomásnál 2,5 kg-mal több")
                briefRow(3, "22:45-kor ágyban", "szólok negyed órával korábban")
            }
            .padding(.top, 12)

            HStack(spacing: 8) {
                EPill(title: "Elfogadom a napot") { onToast("A nap terve elfogadva") }
                EPill(title: "Módosítom", primary: false) { onToast("Mit változtassunk? — Boop megkérdezi") }
                Spacer(minLength: 0)
            }
            .padding(.top, 18)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(LinearGradient(colors: [.white.opacity(0.11), .white.opacity(0.05)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .stroke(LinearGradient(colors: [.white.opacity(0.22), .white.opacity(0.04)],
                                           startPoint: .top, endPoint: .bottom), lineWidth: 1))
        )
    }

    private func briefRow(_ n: Int, _ t: String, _ s: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(n)").font(.custom("Outfit", size: 13).weight(.semibold))
                .foregroundStyle(gBase)
                .frame(width: 22, height: 22)
                .background(Circle().fill(.white.opacity(0.9)))
            VStack(alignment: .leading, spacing: 2) {
                Text(t).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Text(s).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
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
                        if b == 1, k == nowIdx { nowRow }
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
        case .mail: path.append("m7")
        case .meal: path.append("m3")
        case .train: path.append("m2")
        case .wake, .sleep: path.append("m1")
        case .checkin: path.append("m4")
        default: break
        }
    }

    // MARK: The areas — wide cards for what has something to say, thin rows for the rest

}

/// Cross-area observations on the home screen.
struct EMaNotice {
    let areas: [Int]; let title: String; let text: String
    static let all: [EMaNotice] = [
        EMaNotice(areas: [5, 3], title: "Az éttermek mindig csütörtökön ugranak meg",
                  text: "Ezen a héten már *24 000 Ft* — harmadik hete ugyanaz a nap. A heti keretből *9 500 Ft* maradt."),
        EMaNotice(areas: [1, 3], title: "A késői vacsora megrövidíti az éjszakádat",
                  text: "A 20:30 utáni vacsorák után átlagosan *24 perccel* kevesebbet alszol. Ma ezért tettem a vacsorát *19:45-re*."),
        EMaNotice(areas: [7], title: "A reklámok 94%-a nem érdekel",
                  text: "Három hét alatt 612 levélből *36-ot* nyitottál meg, és azok háromnegyede két márkától jött. A többit ezentúl csendben szűröm."),
    ]
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


/// The shape of today and its big moments — the hero of Ma and the head of the Nap area.
enum EDay {
    static let curve: [Double] = [0.45, 0.68, 0.82, 0.78, 0.6, 0.42, 0.5, 0.72, 0.64, 0.38]
    static let hours = ["6", "8", "10", "12", "14", "16", "18", "20", "22", ""]
    static let events: [EDayEvent] = [
        EDayEvent(at: 0.10, glyph: "sun-ink", label: "ébredés", detail: "7ó 12p alvás, ebből 1ó 36p mély"),
        EDayEvent(at: 0.21, glyph: "e-level", label: "posta", detail: "34 levél · 2 megér egy percet"),
        EDayEvent(at: 0.30, glyph: "clock-ink", label: "4 hívás", detail: "9:00–12:00 · a 10:30-as a legnehezebb"),
        EDayEvent(at: 0.44, glyph: "bowl-cream", label: "ebéd", detail: "Csirke rizzsel · 46 g fehérje"),
        EDayEvent(at: 0.63, glyph: "clock-ink", label: "3 hívás", detail: "14:00–17:30 · nincs köztük levegő"),
        EDayEvent(at: 0.78, glyph: "dumbbell-ink", label: "edzés", detail: "Felsőtest · 75 perc · 5 gyakorlat"),
        EDayEvent(at: 0.93, glyph: "moon-cream", label: "alvás", detail: "22:45 · emlékeztetlek 22:15-kor"),
    ]
}
