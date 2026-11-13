import SwiftUI

// "Ma" with seven lens orbs. The day's timeline now also carries a money row and a mail row, in exactly the
// same shape as a meal or a workout — that sameness is the whole point of the spike.

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
        EItem(t: 12.1, time: "12:06", glyph: "e-penz", title: "Spar · 8 240 Ft", sub: "Bevásárlás · a banki SMS-ből, magától", kind: .money),
        EItem(t: 12.67, time: "12:40", glyph: "bowl-cream", title: "Ebéd", sub: "Csirke rizzsel, salátával · 46 g fehérje", kind: .meal),
        EItem(t: 14.0, time: "14:00", glyph: "clock-ink", title: "Megbeszélések · 3 esemény", sub: "14:00–17:30 · ügyfélhívás csúszhat", kind: .calendar),
        EItem(t: 15.0, time: "15:00", glyph: "e-level", title: "Délutáni posta", sub: "11 levél · 1 akció, amit figyeltél", kind: .mail, action: "Megnézem"),
        EItem(t: 16.0, time: "16:00", glyph: "pen-sun", title: "Délutáni check-in", sub: "3 kérdés · fél perc", kind: .checkin, action: "Kitöltöm"),
        EItem(t: 18.5, time: "18:30", glyph: "dumbbell-ink", title: "Felsőtest edzés", sub: "75 perc · 5 gyakorlat", kind: .train, action: "Indítás"),
        EItem(t: 19.75, time: "19:45", glyph: "bowl-cream", title: "Vacsora", sub: "Boop: legalább 50 g fehérje", kind: .meal, action: "Lefotózom"),
        EItem(t: 21.5, time: "21:30", glyph: "spark-cream", title: "Esti zárás", sub: "Kevesebb mint egy perc", kind: .close),
        EItem(t: 22.75, time: "22:45", glyph: "moon-cream", title: "Lefekvés", sub: "Emlékeztetlek 22:15-kor", kind: .sleep),
    ]
}

/// The proposal that only a life dashboard can make: it needs the mail, the price, the budget, the training
/// plan and the calendar at once.
struct EProposal {
    let id: String, text: String, sub: String, accepted: String
    let facts: [(String, String, String)]
    let areas: [(Int, String)]     // EMetric index, the line that area contributed

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

struct EletMa: View {
    @Binding var path: [String]
    var onToast: (String) -> Void

    @State private var sel = EArg.int("eletMetric", 0, 6)
    @State private var motion = OrbMotion()
    @State private var orbKey = 0
    @State private var decided: [String: Bool] = [:]
    @State private var compact = false
    private var m: EMetric { EMetric.all[sel] }

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
                ScrollView {
                    VStack(spacing: 0) {
                        hero(height: geo.size.height + geo.safeAreaInsets.top - 30)
                        VStack(spacing: 34) {
                            doorRow
                            napkozben
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 40)
                        .background(FloatingLights(hue: m.glow).padding(.vertical, -120))
                        MirroredLand(sky: m.sky).padding(.top, -20).padding(.bottom, 60)
                    }
                }
                .scrollIndicators(.hidden)
                .ignoresSafeArea(edges: .top)
                .background(gPageBackground(m.top).animation(.easeInOut(duration: 0.6), value: sel).ignoresSafeArea())
                .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > geo.size.height - 120 } action: { _, v in
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { compact = v }
                }
                .overlay(alignment: .top) { if compact { compactHeader } }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { key in
                switch key {
                case "m5": EletMoneyRoom(onToast: onToast)
                case "m6": EletMailRoom(onToast: onToast)
                default: EletPlainRoom(metric: Int(key.dropFirst()) ?? 0)
                }
            }
        }
        .onDisappear { motion.stop() }
    }

    // MARK: Hero

    private func hero(height: CGFloat) -> some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: height)
                .overlay { PaintedLandscape(sky: m.sky) }
                .clipped()
                .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.68), .init(color: gBase.opacity(0.4), location: 0.86),
                                                .init(color: gBase.opacity(0), location: 1)], startPoint: .top, endPoint: .bottom))
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.8), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))

            VStack(spacing: 0) {
                header
                metricRow.padding(.top, 8)
                sun.frame(height: 240).padding(.bottom, 10)
                Text(m.name.uppercased()).font(.system(size: 14, weight: .semibold)).tracking(2.6)
                    .foregroundStyle(.white.opacity(0.85)).contentTransition(.opacity)
                Text(m.headline).font(AuraFont.serif(40)).foregroundStyle(.white)
                    .multilineTextAlignment(.center).padding(.horizontal, 24).padding(.top, 8).contentTransition(.opacity)
                Text(m.sentence)
                    .font(.system(size: 16.5)).lineSpacing(4).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 30).padding(.top, 10)
                    .frame(height: 88, alignment: .top)
                    .contentTransition(.opacity)
                Spacer(minLength: 0)
            }
            .frame(height: height)
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            HStack {
                Text("13:40").font(AuraFont.mono(13, .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).frame(height: 34)
                    .glassEffect(.clear, in: .capsule)
                    .frame(width: 80, alignment: .leading)
                Spacer()
                Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
                Spacer()
                AuraGlyph("person-sage", .white, size: 20).frame(width: 44, height: 44)
                    .glassEffect(.clear, in: .circle)
                    .frame(width: 80, alignment: .trailing)
            }
            .padding(.horizontal, 16)
            HStack(spacing: 0) {
                ForEach(["Reggel", "Napközben", "Este"], id: \.self) { p in
                    let on = p == "Napközben"
                    VStack(spacing: 7) {
                        Text(p).font(.system(size: 15, weight: on ? .semibold : .regular))
                            .foregroundStyle(.white.opacity(on ? 1 : 0.62))
                        Capsule().fill(.white).frame(height: 1).opacity(on ? 1 : 0).padding(.horizontal, 6)
                    }
                    .fixedSize().frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 40)
        }
        .padding(.top, 58)
    }

    /// Seven orbs now. The two new ones sit after a hairline, so you can see the body and the life halves.
    private var metricRow: some View {
        HStack(spacing: 0) {
            ForEach(EMetric.all.indices, id: \.self) { i in
                let x = EMetric.all[i]
                let on = i == sel
                if i == 5 {
                    Rectangle().fill(.white.opacity(0.18)).frame(width: 1, height: 34).padding(.horizontal, 3)
                }
                VStack(spacing: 6) {
                    ZStack {
                        if on {
                            LivingOrb(mood: .good, size: 40, motion: motion, palette: x.orb, glow: false, level: Double(x.value) / 100).id(orbKey)
                        } else {
                            StillOrb(colors: x.orb, size: 40, level: Double(x.value) / 100).saturation(0.25).opacity(0.75)
                        }
                        Text("\(x.value)").font(.custom("Outfit", size: 15).weight(.medium)).foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.45), radius: 4)
                    }
                    .allowsHitTesting(false)
                    Text(x.name).font(.system(size: 11.5, weight: on ? .semibold : .regular))
                        .foregroundStyle(.white.opacity(on ? 1 : 0.6)).lineLimit(1).minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    guard i != sel else { return }
                    withAnimation(.spring(response: 0.7, dampingFraction: 0.82)) { sel = i }
                    orbKey += 1
                }
                .accessibilityAddTraits(.isButton)
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 8)
    }

    private var sun: some View {
        GeometryReader { g in
            let H = g.size.height, size: CGFloat = 140
            let t = min(1, max(0, (CGFloat(m.value) - 40) / 60))
            let cy = H - 8 - t * (H - 8 - size / 2 - 6)
            ZStack {
                Circle().fill(m.glow.opacity(0.18)).frame(width: size * 1.7).blur(radius: 60)
                LivingOrb(mood: .good, size: size, motion: motion, palette: m.orb, glow: true, level: Double(m.value) / 100).id(orbKey)
                Text("\(m.value)").font(.custom("Outfit", size: 52).weight(.light)).foregroundStyle(.white)
                    .monospacedDigit().contentTransition(.numericText(value: Double(m.value)))
                    .shadow(color: .black.opacity(0.35), radius: 10).allowsHitTesting(false)
            }
            .frame(width: g.size.width, height: size * 2)
            .position(x: g.size.width / 2, y: cy)
            .mask(alignment: .top) {
                LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.93), .init(color: .clear, location: 1)],
                               startPoint: .top, endPoint: .bottom).frame(height: H - 8 + 14)
            }
            .contentShape(Rectangle())
            .onTapGesture { path.append("m\(sel)") }
        }
    }

    private var compactHeader: some View {
        HStack(spacing: 10) {
            LivingOrb(mood: .good, size: 26, motion: motion, palette: m.orb, glow: false, level: Double(m.value) / 100).allowsHitTesting(false)
            Text("Napközben").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
            Text("13:40").font(.custom("Outfit", size: 17).weight(.light)).foregroundStyle(.white.opacity(0.8))
            Text("· \(m.name) \(m.value)").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
        }
        .padding(.leading, 8).padding(.trailing, 16).frame(height: 44)
        .glassEffect(.regular, in: .capsule)
        .padding(.top, 2)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    private var doorRow: some View {
        Button { path.append("m\(sel)") } label: {
            HStack {
                Text("\(m.name) részletesen").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                Spacer()
                Text("a napok mögötte").font(.system(size: 13)).foregroundStyle(.white.opacity(0.5))
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.horizontal, 18).frame(height: 50)
            .gCard(18)
        }
        .buttonStyle(.plain)
        .id(sel)
    }

    // MARK: The day

    private var napkozben: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Text("Napközben").font(AuraFont.serif(28)).foregroundStyle(.white)
                Text("09:00 – 21:30").font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.5)).padding(.top, 6)
                Spacer()
                HStack(spacing: 6) {
                    NowPulse(hue: m.glow).frame(width: 18)
                    Text("MOST").font(AuraFont.mono(11, .bold)).foregroundStyle(.white)
                }
            }
            VStack(spacing: 0) {
                let items = EItem.day.filter { $0.t >= 7.9 && $0.t < 21.4 }
                let nowIdx = items.firstIndex { $0.t > 13.67 } ?? items.count
                ForEach(Array(items.enumerated()), id: \.element.id) { k, it in
                    if k == nowIdx { nowRow; proposalBlock }
                    row(it, past: it.t <= 13.67, first: k == 0, last: k == items.count - 1)
                }
            }
            .padding(.vertical, 8).padding(.horizontal, 6)
        }
    }

    private var nowRow: some View {
        HStack(spacing: 10) {
            Text("13:40").font(AuraFont.mono(13, .bold)).foregroundStyle(.white).frame(width: 48, alignment: .trailing)
            NowPulse(hue: m.glow).frame(width: 24)
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
            .shadow(color: lit ? m.glow.opacity(0.9) : .clear, radius: 5)
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
                .shadow(color: !past && it.action != nil ? m.glow.opacity(0.7) : .clear, radius: 8)
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
}

/// A proposal card that names which areas spoke. The areas are labelled lines behind "miért?", never characters.
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
            Text(p.text).font(AuraFont.serif(21)).lineSpacing(3).foregroundStyle(.white)
                .padding(.top, 10)
            Text(p.sub).font(.system(size: 14)).lineSpacing(3).foregroundStyle(.white.opacity(0.68))
                .padding(.top, 6)
            HStack(spacing: 8) {
                ForEach(p.areas.prefix(4), id: \.0) { a in
                    StillOrb(colors: EMetric.all[a.0].orb, size: 18, level: 0.8)
                }
                Text("\(p.areas.count) terület szólt hozzá").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                Spacer()
            }
            .padding(.top, 12)
            if decided == nil {
                HStack(spacing: 8) {
                    EPill(title: "Elfogadom") { onDecide(true) }
                    EPill(title: "Most nem", primary: false) { onDecide(false) }
                    Spacer(minLength: 4)
                    Button { why = true } label: {
                        Text("miért?").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.8))
                            .underline()
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 14)
            } else {
                Button { why = true } label: {
                    Text("miért?").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.8)).underline()
                }
                .buttonStyle(.plain)
                .padding(.top, 12)
            }
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
