import SwiftUI

// Throwaway spike (mezo-r36n9.12): the new components — proposal card, "miért?", the domain drill-down
// template, the "+" quick-capture sheet, and light placeholders for Terv · Napló · Boop.

// MARK: - Proposal card

struct ProposalCard: View {
    var p: Proposal
    var decided: Bool?
    var compact = false
    var onWhy: (Proposal) -> Void
    @Environment(\.gDecide) private var decide

    var body: some View {
        Group {
            if let ok = decided {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(ok ? .white : .white.opacity(0.1))
                        AuraGlyph(ok ? "check-ink" : "clock-ink", ok ? gBase : .white.opacity(0.7), size: 15)
                    }
                    .frame(width: 30, height: 30)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(ok ? p.accepted : "Félretéve: \(p.text.lowercasedFirst)")
                            .font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white.opacity(ok ? 1 : 0.6))
                        Text(ok ? "Elfogadtad · visszavonhatod" : "Szólok, ha újra számít").font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.45))
                    }
                    Spacer()
                    Button("miért?") { onWhy(p) }.font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.6)).buttonStyle(.plain)
                }
                .padding(14)
                .gCard(20)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        StillOrb(colors: SunMetric.all[0].orb, size: 20, level: 0.8)
                        GLabel("BOOP JAVASOLJA")
                        Spacer()
                        Button { onWhy(p) } label: {
                            Text("miért?").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                                .underline(pattern: .dot)
                                .padding(.vertical, 4).padding(.leading, 8)
                        }
                        .buttonStyle(.plain)
                    }
                    Text(p.text).font(AuraFont.serif(compact ? 19 : 21)).foregroundStyle(.white)
                    Text(p.sub).font(.system(size: 14)).lineSpacing(2).foregroundStyle(.white.opacity(0.7))
                    HStack(spacing: 10) {
                        GPill(title: "Elfogadom") { decide(p, true) }
                        GPill(title: "Most nem", primary: false) { decide(p, false) }
                    }
                    .padding(.top, 4)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white.opacity(0.1))
                        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .stroke(LinearGradient(colors: [.white.opacity(0.32), .white.opacity(0.06)], startPoint: .top, endPoint: .bottom), lineWidth: 1)))
            }
        }
        .transition(.opacity.combined(with: .scale(scale: 0.97)))
    }
}

extension String {
    var lowercasedFirst: String { prefix(1).lowercased() + dropFirst() }
}

// MARK: - "miért?" — the data behind it + labelled expert lines, one voice

struct GerincWhySheet: View {
    var p: Proposal
    var decided: Bool?
    var onDecide: (Bool) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    GHead(sky: PaintedLandscape.skies[0], height: 200)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            StillOrb(colors: SunMetric.all[0].orb, size: 22, level: 0.8)
                            GLabel("MIÉRT JAVASLOM?")
                        }
                        Text(p.text).font(AuraFont.serif(32)).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 22).padding(.bottom, 4)
                }
                VStack(alignment: .leading, spacing: 26) {
                    Text(p.sub).font(.system(size: 16)).lineSpacing(3).foregroundStyle(.white.opacity(0.8))

                    VStack(alignment: .leading, spacing: 12) {
                        GLabel("AMIT LÁTOK")
                        HStack(alignment: .top, spacing: 10) {
                            ForEach(p.facts.indices, id: \.self) { i in
                                let f = p.facts[i]
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                                        Text(f.0).font(.custom("Outfit", size: 26).weight(.light)).foregroundStyle(.white)
                                        Text(f.1).font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
                                    }
                                    .lineLimit(1).minimumScaleFactor(0.7)
                                    Text(f.2).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(14).frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading).gCard(20)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        GLabel("KI MIT LÁT BENNE")
                        ForEach(Array(p.experts.enumerated()), id: \.offset) { k, e in
                            let x = GExpert.all[e.0]
                            HStack(alignment: .top, spacing: 12) {
                                StillOrb(colors: x.orb, size: 22, level: 0.7).padding(.top, 1)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(x.name.uppercased()).font(AuraFont.mono(11, .semibold)).tracking(1.2).foregroundStyle(.white.opacity(0.75))
                                    Text(e.1).font(.system(size: 15)).lineSpacing(2).foregroundStyle(.white.opacity(e.0 == 4 ? 0.7 : 0.92))
                                        .italic(e.0 == 4)
                                }
                            }
                            .padding(.vertical, 12)
                            if k < p.experts.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 34) }
                        }
                    }
                    .padding(.horizontal, 18).padding(.vertical, 14)
                    .gCard()

                    HStack(alignment: .top, spacing: 10) {
                        StillOrb(colors: SunMetric.all[0].orb, size: 26, level: 0.8)
                        VStack(alignment: .leading, spacing: 4) {
                            GLabel("BOOP")
                            Text("Mindent összevetve megéri. De te döntesz: semmi nem változik, amíg nem bólintasz rá.")
                                .font(AuraFont.serif(18)).lineSpacing(3).foregroundStyle(.white)
                        }
                    }

                    if decided == nil {
                        HStack(spacing: 10) {
                            GPill(title: "Elfogadom") { onDecide(true) }
                            GPill(title: "Most nem", primary: false) { onDecide(false) }
                        }
                    } else {
                        Text(decided == true ? "Ezt már elfogadtad." : "Ezt most félretetted.")
                            .font(.system(size: 14)).foregroundStyle(.white.opacity(0.55))
                    }
                }
                .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 50)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(SunMetric.all[0].top).ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

// MARK: - Domain drill-down template: verdict → level/graph → the days behind it → actions

struct DrillData {
    let eyebrow: String, big: String, bigLabel: String
    let week: [Double], avg: Double, unit: String, weekLabel: String, lowIsGood: Bool
    let days: [(String, String, Double, String)]     // day, value text, 0…1 bar, note
    let actions: [(String, String, String, Bool)]    // glyph, title, sub, primary
    let proposal: Proposal?

    static let all: [DrillData] = [
        DrillData(eyebrow: "FORMA · MA REGGEL", big: "78", bigLabel: "a heti átlagod 72",
                  week: [70, 74, 66, 71, 69, 76, 78], avg: 72, unit: "", weekLabel: "FORMA · 7 NAP", lowIsGood: false,
                  days: [("Hétfő", "78", 0.78, "jó alvás, nyugodt pulzus"), ("Vasárnap", "76", 0.76, "pihenőnap"), ("Szombat", "69", 0.69, "kemény lábedzés"),
                         ("Péntek", "71", 0.71, ""), ("Csütörtök", "66", 0.66, "késő vacsora, rövid éjszaka"), ("Szerda", "74", 0.74, ""), ("Kedd", "70", 0.70, "")],
                  actions: [("pen-sun", "Reggeli check-in", "fél perc · pontosítja a Formát", true), ("chat-ink", "Kérdezd Boopot a Formádról", "mi húzza fel, mi le", false)],
                  proposal: nil),
        DrillData(eyebrow: "ALVÁS · MA ÉJJEL", big: "7ó 12p", bigLabel: "ebből 1ó 36p mély · 22:48 → 06:53",
                  week: [72, 81, 64, 90, 77, 84, 96], avg: 78, unit: "p", weekLabel: "MÉLYALVÁS · 7 NAP", lowIsGood: false,
                  days: [("Hétfő", "7ó 12p", 0.90, "22:48-kor aludtál el, 12 perccel korábban"), ("Vasárnap", "7ó 24p", 0.93, "a hét legjobbja"),
                         ("Szombat", "6ó 36p", 0.82, "késői buli, de mély alvás"), ("Péntek", "6ó 48p", 0.85, ""),
                         ("Csütörtök", "5ó 54p", 0.74, "vacsora 21:40-kor · kevés mély"), ("Szerda", "7ó 06p", 0.89, ""), ("Kedd", "6ó 24p", 0.80, "képernyő 23:30-ig")],
                  actions: [("moon-cream", "Lefekvés 22:45 · Emlékeztess", "22:15-kor szólok", true),
                            ("spark-cream", "Esti levezetés 21:30-tól", "képernyő le, halk fény", false),
                            ("chat-ink", "Kérdezd Boopot az alvásodról", "pl. miért kevesebb a mély csütörtökön?", false)],
                  proposal: Proposal(id: "sleep", text: "Vacsorázz 20:00-ig ma", sub: "Ha 21 óra után eszel, a mélyalvásod átlag 22 perccel rövidebb.",
                                     accepted: "Emlékeztetlek 19:30-kor a vacsorára",
                                     facts: [("-22", "perc", "mélyalvás késő vacsora után"), ("4/5", "", "alkalommal így volt"), ("19:45", "", "a mai vacsora ideje")],
                                     experts: [(0, "A késő esti evés emeli az éjszakai pulzust, ezért rövidül a mély szakasz."),
                                               (2, "A vacsora 19:45-re van tervezve, ez belefér."),
                                               (4, "Öt eset kevés; lehet, hogy a késő vacsora csak a hosszú napok jele.")])),
        DrillData(eyebrow: "MOZGÁS · MA", big: "1 240", bigLabel: "lépés a 9 000-ből · 210 aktív kcal",
                  week: [8.2, 6.1, 10.4, 7.7, 12.3, 4.2, 1.2], avg: 7.1, unit: "e", weekLabel: "LÉPÉSEK · 7 NAP (EZER)", lowIsGood: false,
                  days: [("Hétfő", "1 240", 0.14, "még korán van"), ("Vasárnap", "4 200", 0.47, "pihenőnap"), ("Szombat", "12 300", 1, "lábedzés + túra"),
                         ("Péntek", "7 700", 0.86, ""), ("Csütörtök", "10 400", 1, "felsőtest edzés"), ("Szerda", "6 100", 0.68, ""), ("Kedd", "8 200", 0.91, "")],
                  actions: [("dumbbell-ink", "Felsőtest edzés indítása", "75 perc · 5 gyakorlat", true), ("shoe-cream", "Séta ebéd után", "20 perc · a napi cél fele", false)],
                  proposal: nil),
        DrillData(eyebrow: "ÉTKEZÉS · MA", big: "820", bigLabel: "kcal a 2 350-ből · fehérje 38 / 165 g",
                  week: [2280, 2410, 2150, 2390, 2620, 2200, 820], avg: 2340, unit: "", weekLabel: "KALÓRIA · 7 NAP", lowIsGood: false,
                  days: [("Hétfő", "820 kcal", 0.35, "reggeli + ebéd"), ("Vasárnap", "2 200 kcal", 0.94, ""), ("Szombat", "2 620 kcal", 1, "edzésnap +300"),
                         ("Péntek", "2 390 kcal", 1, ""), ("Csütörtök", "2 150 kcal", 0.91, "kevés fehérje"), ("Szerda", "2 410 kcal", 1, ""), ("Kedd", "2 280 kcal", 0.97, "")],
                  actions: [("camera-ink", "Lefotózom az ebédet", "fotó vagy pár szó", true), ("bowl-cream", "Mit egyek ebédre?", "Boop ajánl a kereted alapján", false)],
                  proposal: .moreFood),
        DrillData(eyebrow: "PULZUS · MA ÉJJEL", big: "57", bigLabel: "nyugalmi pulzus · a heti átlagod 59",
                  week: [61, 60, 62, 59, 58, 59, 57], avg: 59, unit: "", weekLabel: "NYUGALMI PULZUS · 7 NAP", lowIsGood: true,
                  days: [("Hétfő", "57", 0.57, "a hét legjobbja"), ("Vasárnap", "59", 0.59, ""), ("Szombat", "58", 0.58, ""),
                         ("Péntek", "59", 0.59, ""), ("Csütörtök", "62", 0.62, "késő vacsora"), ("Szerda", "60", 0.60, ""), ("Kedd", "61", 0.61, "")],
                  actions: [("heart-cream", "Egy perc légzés", "a délutáni megbeszélések előtt", true)],
                  proposal: nil),
    ]
}

struct GerincDrill: View {
    var metric: Int
    var onWhy: (Proposal) -> Void
    var onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var decided: Bool?
    private var m: SunMetric { SunMetric.all[metric] }
    private var d: DrillData { DrillData.all[metric] }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    GHead(sky: PaintedLandscape.skies[metric], height: 360)
                    VStack(spacing: 0) {
                        HStack(spacing: 10) {
                            Button { dismiss() } label: {
                                Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                                    .frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain)
                            .glassEffect(.clear.interactive(), in: .circle)
                            Text("Ma · \(m.name)").font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                            Spacer()
                        }
                        .padding(.horizontal, 16).padding(.top, 58)
                        VStack(spacing: 8) {
                            StillOrb(colors: m.orb, size: 64, level: Double(m.value) / 100)
                                .shadow(color: m.glow.opacity(0.6), radius: 20)
                            GLabel(d.eyebrow).padding(.top, 6)
                            Text(m.headline).font(AuraFont.serif(38)).foregroundStyle(.white)
                            Text(m.sentence).font(.system(size: 16)).lineSpacing(3).multilineTextAlignment(.center)
                                .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 28)
                        }
                        .padding(.top, 34)
                    }
                }
                VStack(spacing: 14) {
                    section(1, "A SZINT") {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(d.big).font(.custom("Outfit", size: 48).weight(.light)).foregroundStyle(.white)
                            Text(d.bigLabel).font(.system(size: 14)).foregroundStyle(.white.opacity(0.65))
                            if metric == 1 {
                                Hypnogram().frame(height: 100).padding(.top, 14)
                                HStack { Text("22:48"); Spacer(); Text("2:00"); Spacer(); Text("4:00"); Spacer(); Text("6:53") }
                                    .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
                            }
                        }
                    }
                    section(2, d.weekLabel) {
                        WeekBars(values: d.week, avg: d.avg, unit: d.unit, lowIsGood: d.lowIsGood).frame(height: 140)
                    }
                    section(3, "A NAPOK MÖGÖTTE") {
                        VStack(spacing: 0) {
                            ForEach(Array(d.days.enumerated()), id: \.offset) { k, r in
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(r.0).font(.system(size: 15, weight: k == 0 ? .semibold : .regular)).foregroundStyle(.white)
                                        if !r.3.isEmpty { Text(r.3).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.5)).lineLimit(1) }
                                    }
                                    Spacer()
                                    GeometryReader { g in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(.white.opacity(0.08))
                                            Capsule().fill(.white.opacity(k == 0 ? 0.95 : 0.5)).frame(width: g.size.width * min(1, r.2))
                                        }
                                    }
                                    .frame(width: 70, height: 6)
                                    Text(r.1).font(AuraFont.mono(12.5)).foregroundStyle(.white.opacity(0.8)).frame(width: 74, alignment: .trailing)
                                }
                                .padding(.vertical, 11)
                                if k < d.days.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                            }
                        }
                    }
                    section(4, "MIT TEHETSZ") {
                        VStack(alignment: .leading, spacing: 12) {
                            if let p = d.proposal {
                                ProposalCard(p: p, decided: decided, compact: true, onWhy: onWhy)
                                    .environment(\.gDecide, { _, ok in withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { decided = ok }; onToast(ok ? p.accepted : "Rendben, most nem") })
                            }
                            ForEach(Array(d.actions.enumerated()), id: \.offset) { k, a in
                                HStack(spacing: 14) {
                                    ZStack { Circle().fill(.white.opacity(a.3 ? 0.9 : 0.08)); AuraGlyph(a.0, a.3 ? gBase : .white, size: 17) }
                                        .frame(width: 40, height: 40)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(a.1).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                                        Text(a.2).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                                }
                                .contentShape(Rectangle())
                                .onTapGesture { onToast(a.1) }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 40)
                .background(FloatingLights(hue: m.glow).padding(.vertical, -100))
                MirroredLand(sky: PaintedLandscape.skies[metric]).padding(.top, -20)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(gPageBackground(m.top).ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .preferredColorScheme(.dark)
    }

    private func section<C: View>(_ n: Int, _ label: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Text("\(n)").font(.custom("Outfit", size: 15).weight(.medium)).foregroundStyle(.white.opacity(0.6))
                GLabel(label)
            }
            c()
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .gCard()
    }
}

// MARK: - "+" quick capture

struct GerincPlusSheet: View {
    var onPick: (String) -> Void
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                GLabel("RÖGZÍTÉS")
                Text("Mit rögzítesz?").font(AuraFont.serif(32)).foregroundStyle(.white)
            }
            .padding(.top, 30)

            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    AuraGlyph("bowl-cream", .white, size: 24)
                        .frame(width: 48, height: 48).background(Circle().fill(.white.opacity(0.1)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Étkezés").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                        Text("Boop kiszámolja, és megmondja, belefér-e").font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                    }
                }
                HStack(spacing: 8) {
                    chip("camera-ink", "Fotó"); chip("pen-sun", "Szöveg"); chip("search-ink", "Vonalkód"); chip("book-sage", "Recept")
                }
            }
            .padding(18).gCard()

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                tile("spark-cream", "Check-in", "fél perc")
                tile("book-sage", "Napló", "egy sor, szóval is")
                tile("scale-ink", "Súly", "utoljára 82,4 kg")
                tile("dumbbell-ink", "Edzés indítása", "Felsőtest · 75 perc")
            }

            HStack(spacing: 10) {
                TextField("", text: $text, prompt: Text("Mondd vagy írd: ebéd, csirke rizzsel…").foregroundStyle(.white.opacity(0.45)))
                    .font(.system(size: 15)).foregroundStyle(.white)
                StillOrb(colors: SunMetric.all[0].orb, size: 26, level: 0.8)
            }
            .padding(.horizontal, 18).frame(height: 54)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .background(alignment: .top) { GHead(sky: PaintedLandscape.skies[0], height: 170).opacity(0.75).ignoresSafeArea() }
        .preferredColorScheme(.dark)
    }

    private func chip(_ g: String, _ t: String) -> some View {
        Button { onPick("\(t) — hamarosan") } label: {
            VStack(spacing: 6) {
                AuraGlyph(g, .white, size: 18)
                Text(t).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity).frame(height: 62)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }

    private func tile(_ g: String, _ t: String, _ s: String) -> some View {
        Button { onPick("\(t) — hamarosan") } label: {
            VStack(alignment: .leading, spacing: 10) {
                AuraGlyph(g, .white, size: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t).font(.system(size: 15.5, weight: .semibold)).foregroundStyle(.white)
                    Text(s).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).gCard(20)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Terv · Napló · Boop — light placeholders

struct GerincPlaceholder: View {
    var kind: Int        // 1 Terv, 2 Napló, 3 Boop
    @State private var motion = OrbMotion()
    private var skyIdx: Int { [0, 3, 1, 0][kind] }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    GHead(sky: PaintedLandscape.skies[skyIdx])
                    VStack(spacing: 6) {
                        Text("boop").font(.custom("Outfit", size: 22).weight(.light)).tracking(3).foregroundStyle(.white.opacity(0.8))
                        Text(["", "Terv", "Napló", "Boop"][kind]).font(AuraFont.serif(40)).foregroundStyle(.white).padding(.top, 50)
                        Text(["", "Amihez Boop a napjaidat igazítja", "Amit a napjaidból tanulunk", "Kérdezz bármit — mindent lát, amit te"][kind])
                            .font(.system(size: 15)).foregroundStyle(.white.opacity(0.8))
                    }
                    .padding(.top, 62)
                }
                VStack(spacing: 12) {
                    switch kind {
                    case 1: terv
                    case 2: naplo
                    default: chat
                    }
                }
                .padding(.horizontal, 16).padding(.top, -20).padding(.bottom, 130)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(gPageBackground(SunMetric.all[skyIdx == 3 ? 3 : skyIdx].top).ignoresSafeArea())
        .onDisappear { motion.stop() }
    }

    private var terv: some View {
        Group {
            planCard("SÚLYCÉL", "82,4 → 78 kg", "−0,4 kg/hét · március közepére", level: 0.35)
            planCard("EDZÉSTERV", "Felsőtest–alsótest · 5 nap", "3. hét a 6-ból · ma: felsőtest", level: 0.5)
            planCard("ÉTREND", "Még nincs", "Hamarosan itt állítod össze, mit ehetsz", level: nil)
            soon("A tervek szerkesztése hamarosan ide költözik.")
        }
    }

    private var naplo: some View {
        Group {
            VStack(alignment: .leading, spacing: 0) {
                GLabel("A NAPOK").padding(.bottom, 8)
                ForEach(Array([("Vasárnap", 5, "Pihenőnap, hosszú séta"), ("Szombat", 4, "Kemény lábedzés, jó hangulat"), ("Péntek", 3, "Sok meeting, késő vacsora"), ("Csütörtök", 2, "Rövid éjszaka, fáradt nap")].enumerated()), id: \.offset) { k, r in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.0).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                            Text(r.2).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                        }
                        Spacer()
                        HStack(spacing: 4) { ForEach(1...5, id: \.self) { s in Circle().fill(.white.opacity(s <= r.1 ? 0.9 : 0.15)).frame(width: 7, height: 7) } }
                    }
                    .padding(.vertical, 11)
                    if k < 3 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
            .padding(20).gCard()
            VStack(alignment: .leading, spacing: 10) {
                GLabel("MINTÁK")
                Text("Amikor 23:00 előtt fekszel le, másnap 9 ponttal jobb a Formád.").font(AuraFont.serif(19)).lineSpacing(3).foregroundStyle(.white)
                Text("3 hét adatából · 4-ből 4 alkalommal").font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()
            soon("A teljes napló és a minták hamarosan.")
        }
    }

    private var chat: some View {
        VStack(alignment: .leading, spacing: 14) {
            bubble(true, "Szia! Itt bármit kérdezhetsz: az alvásodról, az edzésről, hogy mit egyél. Látom a napodat és a terveidet.")
            bubble(false, "Miért kevesebb a mélyalvásom csütörtökönként?")
            bubble(true, "Csütörtökön késő este vacsorázol, ilyenkor átlag 22 perccel rövidebb a mély szakasz.")
            HStack {
                Text("Írj a Boopnak…").font(.system(size: 15)).foregroundStyle(.white.opacity(0.5))
                Spacer()
                StillOrb(colors: SunMetric.all[0].orb, size: 24, level: 0.8)
            }
            .padding(.horizontal, 18).padding(.vertical, 14)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
            soon("A beszélgetés a következő lépésben kel életre.")
        }
    }

    private func bubble(_ boop: Bool, _ t: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            if boop { StillOrb(colors: SunMetric.all[0].orb, size: 28, level: 0.8) } else { Spacer(minLength: 40) }
            Text(t).font(.system(size: 15.5)).lineSpacing(3).foregroundStyle(.white.opacity(boop ? 0.9 : 1))
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(boop ? 0.07 : 0.16)))
            if boop { Spacer(minLength: 20) }
        }
    }

    private func planCard(_ label: String, _ title: String, _ sub: String, level: Double?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            GLabel(label)
            Text(title).font(.custom("Outfit", size: 26).weight(.light)).foregroundStyle(.white.opacity(level == nil ? 0.6 : 1))
            Text(sub).font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
            if let level {
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.08))
                        Capsule().fill(.white.opacity(0.9)).frame(width: g.size.width * level)
                    }
                }
                .frame(height: 6).padding(.top, 4)
            }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()
    }

    private func soon(_ t: String) -> some View {
        Text(t).font(.system(size: 13)).foregroundStyle(.white.opacity(0.45)).frame(maxWidth: .infinity).padding(.top, 8)
    }
}
