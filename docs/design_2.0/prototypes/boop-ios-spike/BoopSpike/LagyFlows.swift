import SwiftUI
import Charts

// MARK: - Check-in: one question at a time, level tube + five-step scale (Lágy check-in)

struct LagyCheckin: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    struct Q { let key, label, question, glyph, pal: String; var why: String? = nil }
    private let qs: [Q] = [
        .init(key: "energy", label: "Energia", question: "Mennyi energia van benned most?", glyph: "bolt", pal: "sun"),
        .init(key: "mood", label: "Hangulat", question: "Milyen a hangulatod?", glyph: "heart", pal: "berry"),
        .init(key: "stress", label: "Feszültség", question: "Mennyire vagy feszült?", glyph: "spark", pal: "deep"),
        .init(key: "body", label: "Test", question: "Hogy érzed a tested?", glyph: "person", pal: "peach"),
        .init(key: "mental", label: "Fejtisztaság", question: "Mennyire tiszta a fejed?", glyph: "star", pal: "sun"),
        .init(key: "hunger", label: "A nap kérdése", question: "Mennyire vagy éhes ébredés után?", glyph: "bowl", pal: "sage",
              why: "Azt figyelem, összefügg-e a reggeli éhséged a tegnapi késő vacsorával."),
    ]
    @State private var i = 0
    @State private var values: [String: Int] = [:]
    @State private var finished = UserDefaults.standard.bool(forKey: "checkinDone")
    @State private var note = ""

    var body: some View {
        LagyFlowFrame(photoName: "kave.jpg", crumb: ("Nap › Mai › ", "Check-in"), eyebrow: "Reggel · 06:42",
                      title: finished ? "Köszönöm" : "Hogy vagy?", sub: finished ? "Így indul a napod." : "Öt alap és a nap kérdése, fél perc.") {
            if finished { summary } else { question }
        }
        .onAppear {
            if finished && values.isEmpty { values = ["energy": 8, "mood": 8, "stress": 4, "body": 6, "mental": 8, "hunger": 4] }
        }
    }

    @ViewBuilder private var question: some View {
        let q = qs[i]
        let v = values[q.key]
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 4) {
                    ForEach(qs.indices, id: \.self) { k in Capsule().fill(k <= i ? Lagy.sage : Lagy.paper).frame(height: 5) }
                }
                HStack(spacing: 6) {
                    Chip(text: "\(i + 1). kérdés · \(qs.count)-ból", small: true)
                    Chip(text: q.label, style: .soft, glyph: (q.glyph, q.pal), small: true)
                }
                Text(q.question).font(.outfit(21)).tracking(-0.4).foregroundStyle(Lagy.ink)
                    .id(q.key).transition(.push(from: .trailing))
                if let why = q.why {
                    HStack(alignment: .top, spacing: 8) {
                        Glyph("spark", "sage", size: 16)
                        Text(why).font(.manrope(13.5, .semibold)).foregroundStyle(Lagy.peachInk)
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(hex: 0xFDF3D8)))
                }
                HStack(alignment: .bottom, spacing: 16) {
                    JarTube(frac: Double(v ?? 0) / 10, warm: q.key == "stress" && (v ?? 0) >= 7)
                        .contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 0).onChanged { g in
                            let lvl = 1 - g.location.y / 120
                            values[q.key] = max(1, min(10, Int((lvl * 10).rounded())))
                        })
                    VStack(alignment: .leading, spacing: 0) {
                        Text(v.map(String.init) ?? "–").font(.outfit(46, .heavy)).tracking(-1.2).foregroundStyle(Lagy.ink)
                            .contentTransition(.numericText(value: Double(v ?? 0)))
                        Text("a 10-ből").font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2)
                    }
                    Spacer()
                }
                .sensoryFeedback(.selection, trigger: v)
                HStack(spacing: 6) {
                    ForEach([2, 4, 6, 8, 10], id: \.self) { x in
                        Button { withAnimation(.snappy) { values[q.key] = x } } label: {
                            Text("\(x)").font(.outfit(15)).frame(maxWidth: .infinity).frame(height: 44)
                                .foregroundStyle(v == x ? .white : Lagy.ink)
                                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(v == x ? Lagy.ink : Lagy.paper))
                        }
                        .buttonStyle(PressStyle())
                    }
                }
            }
            .padding(18)
            .lagyCard()

            HStack(spacing: 8) {
                if i > 0 { Pill(title: "Vissza", soft: true) { step(-1) } }
                Pill(title: "Kihagyom", soft: true) { step(1) }
                Button { step(1) } label: {
                    Text(i == qs.count - 1 ? "Kész" : "Tovább").font(.manrope(14, .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 46).background(Capsule().fill(Lagy.ink))
                }
                .buttonStyle(PressStyle())
            }
            if i >= 3 { WidePill(title: "Most csak ennyi", soft: true) { withAnimation(.spring) { finished = true } } }
        }
    }

    private func step(_ d: Int) {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
            if d > 0 && i == qs.count - 1 { finished = true } else { i = max(0, i + d) }
        }
    }

    @ViewBuilder private var summary: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) { Chip(text: "Összegzés", style: .soft, small: true); Chip(text: "06:42 · reggel", small: true) }
            VStack(spacing: 0) {
                ForEach(qs, id: \.key) { q in
                    HStack(spacing: 12) {
                        Glyph(q.glyph, q.pal, size: 26)
                        Text(q.label).font(.manrope(14.5, .bold)).foregroundStyle(Lagy.ink)
                        Spacer()
                        Capsule().fill(Lagy.ink.opacity(0.08)).frame(width: 70, height: 6)
                            .overlay(alignment: .leading) {
                                Capsule().fill(q.key == "stress" ? Lagy.peach : Lagy.sage2).frame(width: 70 * Double(values[q.key] ?? 0) / 10)
                            }
                        Text(values[q.key].map { "\($0) / 10" } ?? "kihagyva").font(.outfit(14)).monospacedDigit()
                            .foregroundStyle(values[q.key] == nil ? Lagy.mute : Lagy.ink).frame(width: 64, alignment: .trailing)
                    }
                    .padding(.vertical, 10)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 6)
            .lagyCard()
            .padding(.top, 14)

            LagySection(title: "Gondolatok") {
                TextField("", text: $note, prompt: Text("ha valami még eszedbe jut").foregroundStyle(Lagy.mute), axis: .vertical)
                    .font(.manrope(15, .medium)).foregroundStyle(Lagy.ink)
                    .lineLimit(2...4).padding(16).lagyCard(18)
            }
            BoopNote(segs: [
                .init("Energiád \(values["energy"] ?? 0), feszültség csak \(values["stress"] ?? 0): ez illik a jó éjszakához. A tested \(values["body"] ?? 0)-os, "),
                .init("a vádlid még a szombati futástól lehet merev", "body"),
                .init(", ezért a mai Push napon a bemelegítésre szánj 10 percet."),
            ], mood: mood)
            .padding(.top, 24)
            WidePill(title: "Mentés · 06:42") {
                onDone("Energia \(values["energy"] ?? 0) · Feszültség \(values["stress"] ?? 0)")
                dismiss()
            }
            .padding(.top, 20)
        }
        .sensoryFeedback(.success, trigger: finished)
    }
}

// MARK: - Mai szándék: the creed as the one deep card, then the three

struct LagyIntention: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var foci = ["Lezárom a negyedéves prezentációt", "Az edzésen a formára figyelek, nem a súlyra", "22:45-kor lefekszem"]
    @State private var asked = UserDefaults.standard.bool(forKey: "intentionAsked")
    @FocusState private var focused: Int?
    private let fits: [(String, String, String)] = [("clock", "sky", "naptár: 10:30 előtt"), ("dumbbell", "berry", "edzés: Push nap"), ("moon", "sky", "alvás: 7 óra 30")]

    var body: some View {
        LagyFlowFrame(photoName: "nap-lista.jpg", crumb: ("Nap › Mai › ", "Mai szándék"), eyebrow: "Rutin · reggel",
                      title: "Mi ma a fókuszod?", sub: "A hitvallásod és a mai három.") {
            VStack(alignment: .leading, spacing: 8) {
                Text("A HITVALLÁSOD").font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(.white.opacity(0.7))
                Text("„Minden döntésem a célom felé visz: szándékkal élek, nem sodródom.”")
                    .font(.outfit(19)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .deepCard()

            LagySection(title: "A mai három") {
                ForEach(foci.indices, id: \.self) { k in
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(k + 1)").font(.outfit(16)).foregroundStyle(Lagy.deep)
                            .frame(width: 34, height: 34).background(Circle().fill(Lagy.sage3))
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("", text: $foci[k], prompt: Text("például: nyugodt tempó").foregroundStyle(Lagy.mute), axis: .vertical)
                                .font(.outfit(16)).foregroundStyle(Lagy.ink)
                                .focused($focused, equals: k)
                            if asked {
                                Chip(text: fits[k].2, style: .soft, glyph: (fits[k].0, fits[k].1), small: true)
                                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                            }
                        }
                        .padding(.top, 6)
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .lagyCard(22)
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(focused == k ? Lagy.sage : .clear, lineWidth: 1.5))
                }
            }
            if asked {
                BoopNote(segs: [
                    .init("Jó hármas, és mindegyik illik a napodhoz. A prezentációt "), .init("tedd 10:30 elé", "day"),
                    .init(", mert a workshop után a délutáni mélypontba csúszna. A formára figyelés "), .init("pont a mai Push naphoz való", "train"),
                    .init(". A korai lefekvés a kulcs: így a heti fél kilós tempó is tartható."),
                ], mood: mood, label: "BOOP VÉLEMÉNYE")
                .padding(.top, 24)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                WidePill(title: "Mentés") { onDone(foci[0]); dismiss() }.padding(.top, 20)
            } else {
                WidePill(title: "Mit szólsz hozzá, Boop?", glyph: ("spark", "sage")) {
                    focused = nil
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { asked = true }
                }
                .padding(.top, 22)
            }
        }
        .sensoryFeedback(.success, trigger: asked)
    }
}

// MARK: - Mérlegelés: a ruler dial, then the weight road with the goal

struct LagyWeight: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var kg = 82.4
    @State private var saved = UserDefaults.standard.bool(forKey: "weightSaved")
    @State private var base: Double?

    var body: some View {
        LagyFlowFrame(photoName: "en-merleg.jpg", crumb: ("Nap › Mai › ", "Mérlegelés"), eyebrow: "Mérlegelés · reggel",
                      title: saved ? "Napi ingadozás" : "Mennyi ma?", sub: saved ? "A trend számít, nem a mai szám." : "Ébredés után, mosdó után.") {
            if saved { result } else { dial }
        }
        .sensoryFeedback(.success, trigger: saved)
    }

    private var dial: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(spacing: 14) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(hu1(kg)).font(.outfit(64, .heavy)).tracking(-1.5).monospacedDigit()
                        .contentTransition(.numericText(value: kg))
                    Text("kiló").font(.manrope(16, .bold)).foregroundStyle(Lagy.ink2)
                }
                .foregroundStyle(Lagy.ink).frame(maxWidth: .infinity)
                Canvas { ctx, size in
                    let sp: CGFloat = 12, mid = size.width / 2
                    let ticks = Int(size.width / sp) / 2 + 2
                    let center = (kg * 10).rounded()
                    for k in -ticks...ticks {
                        let v = center + Double(k), x = mid + CGFloat(k) * sp
                        let major = Int(v) % 10 == 0, half = Int(v) % 5 == 0
                        let len: CGFloat = major ? 30 : (half ? 20 : 12)
                        let fade = max(0.12, 1 - abs(Double(k)) / Double(ticks))
                        var p = Path(); p.move(to: CGPoint(x: x, y: 6)); p.addLine(to: CGPoint(x: x, y: 6 + len))
                        ctx.stroke(p, with: .color(Lagy.ink.opacity(0.45 * fade)), lineWidth: major ? 2 : 1)
                        if major {
                            ctx.draw(Text("\(Int(v / 10))").font(.manrope(12, .bold)).foregroundColor(Lagy.ink2.opacity(fade)), at: CGPoint(x: x, y: 52))
                        }
                    }
                }
                .frame(height: 64)
                .overlay { Capsule().fill(Lagy.sage).frame(width: 4, height: 46).offset(y: -6) }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { g in
                        if base == nil { base = kg }
                        kg = (max(40, min(200, (base ?? kg) - Double(g.translation.width / 12) * 0.1)) * 10).rounded() / 10
                    }
                    .onEnded { _ in base = nil })
                .sensoryFeedback(.selection, trigger: kg)
                HStack(spacing: 6) { Chip(text: "tegnap 82,6 kg", small: true); Chip(text: "húzd oldalra", style: .soft, small: true) }
            }
            .padding(.vertical, 20).padding(.horizontal, 12)
            .lagyCard()
            WidePill(title: "Rögzítem", glyph: ("check", "sage")) { withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { saved = true } }
        }
    }

    private struct Pt: Identifiable { let id: Int; let raw: Double; let trend: Double }
    private var series: [Pt] {
        let noise: [Double] = [0.3, -0.2, 0.5, -0.4, 0.1, 0.6, -0.3, 0.2, -0.5, 0.4, 0.0, -0.2, 0.3, -0.4, 0.5, 0.1, -0.3, 0.2, -0.1, 0.4, 0.3]
        return (0..<21).map { d in let t = 83.6 - Double(d) * 0.072; return Pt(id: d, raw: d == 20 ? kg : t + noise[d], trend: t) }
    }

    @ViewBuilder private var result: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("MA REGGEL").font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(.white.opacity(0.7))
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(hu1(kg)).font(.outfit(44, .heavy)).tracking(-1)
                    Text("kiló").font(.manrope(14, .bold)).opacity(0.7)
                }
                .foregroundStyle(.white)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                Text("trend 82,2 kiló").font(.outfit(16)).foregroundStyle(Lagy.sage2)
                Text("heti −0,5 kiló").font(.manrope(13, .bold)).foregroundStyle(.white.opacity(0.75))
            }
        }
        .padding(18).deepCard()

        LagySection(title: "Az út a célig") {
            VStack(alignment: .leading, spacing: 10) {
                Chart {
                    ForEach(series) { p in
                        AreaMark(x: .value("Nap", p.id), yStart: .value("alap", 78), yEnd: .value("Trend", p.trend))
                            .foregroundStyle(LinearGradient(colors: [Lagy.sage2.opacity(0.6), Lagy.sage3.opacity(0.1)], startPoint: .top, endPoint: .bottom))
                            .interpolationMethod(.catmullRom)
                        LineMark(x: .value("Nap", p.id), y: .value("Trend", p.trend))
                            .foregroundStyle(Lagy.deep).lineStyle(.init(lineWidth: 3)).interpolationMethod(.catmullRom)
                        PointMark(x: .value("Nap", p.id), y: .value("Mérés", p.raw))
                            .foregroundStyle(p.id == 20 ? Lagy.deep : Lagy.sage2).symbolSize(p.id == 20 ? 70 : 22)
                    }
                    RuleMark(y: .value("Cél", 79)).foregroundStyle(Lagy.peach).lineStyle(.init(lineWidth: 1.5, dash: [5, 4]))
                        .annotation(position: .top, alignment: .leading) { Text("cél 79 kiló").font(.manrope(12, .bold)).foregroundStyle(Lagy.peachInk) }
                }
                .chartYScale(domain: 78...84.5).chartXAxis(.hidden)
                .chartYAxis { AxisMarks(position: .trailing, values: [79, 81, 83]) { _ in AxisValueLabel().foregroundStyle(Lagy.mute) } }
                .frame(height: 170)
                HStack(spacing: 6) { Chip(text: "3 hét", small: true); Chip(text: "jó úton", style: .soft, glyph: ("check", "sage"), small: true) }
            }
            .padding(18).lagyCard()
        }
        HStack(spacing: 0) {
            trio("scale", "sage", "3,2 kiló", "hátravan")
            trio("clock", "sky", "dec. 28.", "várható")
            trio("star", "sun", "52%", "haladás")
        }
        .padding(.vertical, 16).lagyCard(fill: Lagy.sage3).padding(.top, 14)
        BoopNote(segs: [
            .init("A mai 82,4 kiló "), .init("0,2-del több a tegnapinál", "raw"),
            .init(", de ez csak napi ingadozás: a tegnapi vacsora sósabb volt. Ami számít, a "),
            .init("trend: hetente fél kiló le", "trend"), .init(". Ezzel a tempóval december végére eléred a 79-et."),
        ], mood: mood)
        .padding(.top, 24)
        WidePill(title: "Kész") { onDone("\(hu1(kg)) kg · jó úton"); dismiss() }.padding(.top, 20)
    }

    private func trio(_ g: String, _ pal: String, _ v: String, _ l: String) -> some View {
        VStack(spacing: 4) {
            Glyph(g, pal, size: 26)
            Text(v).font(.outfit(17)).foregroundStyle(Lagy.ink)
            Text(l).font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Első étkezés: photo or words → photo analysis → ingredients → verdict in the day and week

struct LagyMeal: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    enum Stage: Int { case capture, looking, draft, verdict }
    @State private var stage = Stage(rawValue: UserDefaults.standard.integer(forKey: "mealStage")) ?? .capture
    @State private var text = ""
    @State private var scanLabel = "Felismerem…"
    @State private var scanY: CGFloat = 0

    struct Item: Identifiable {
        let id: String; let photo: String?; let glyph: (String, String); var grams: Double; let kcal100, p100, c100, f100: Double
        var kcal: Double { grams * kcal100 / 100 }; var p: Double { grams * p100 / 100 }
        var c: Double { grams * c100 / 100 }; var f: Double { grams * f100 / 100 }
    }
    @State private var items: [Item] = [
        .init(id: "Zabpehely", photo: "zab-sq.jpg", glyph: ("bowl", "sun"), grams: 60, kcal100: 375, p100: 13, c100: 60, f100: 7),
        .init(id: "Görög joghurt", photo: "joghurt-sq.jpg", glyph: ("bowl", "sage"), grams: 150, kcal100: 73, p100: 10, c100: 4, f100: 2),
        .init(id: "Áfonya", photo: "gyumolcs-sq.jpg", glyph: ("leaf", "sage"), grams: 80, kcal100: 57, p100: 0.7, c100: 14, f100: 0.3),
        .init(id: "Méz", photo: nil, glyph: ("honey", "sun"), grams: 15, kcal100: 304, p100: 0.3, c100: 82, f100: 0),
        .init(id: "Dió", photo: nil, glyph: ("leaf", "sage"), grams: 15, kcal100: 654, p100: 15, c100: 14, f100: 65),
    ]
    private var total: (k: Double, p: Double, c: Double, f: Double) {
        items.reduce((0, 0, 0, 0)) { ($0.0 + $1.kcal, $0.1 + $1.p, $0.2 + $1.c, $0.3 + $1.f) }
    }
    private let cP = Color(hex: 0xE09A6A), cC = Color(hex: 0xE2B24A), cF = Color(hex: 0x8FBF9F)

    var body: some View {
        LagyFlowFrame(photoName: stage == .capture || stage == .looking ? "konyha.jpg" : "zab.jpg", crumb: ("Nap › Mai › ", "Első étkezés"), eyebrow: "Reggeli · 07:35", title: title, sub: sub) {
            Group {
                switch stage {
                case .capture: capture
                case .looking: looking
                case .draft: draft
                case .verdict: verdict
                }
            }
            .animation(.spring(response: 0.5, dampingFraction: 0.86), value: stage)
        }
        .sensoryFeedback(.success, trigger: stage == .verdict)
    }

    private var title: String {
        switch stage { case .capture: "Mit eszel?"; case .looking: "Megnézem"; case .draft: "Zabkása bogyókkal"; case .verdict: "Jó edzés előtti reggeli" }
    }
    private var sub: String {
        switch stage { case .capture: "Fotó vagy pár szó elég."; case .looking: "Pár másodperc."; case .draft: "Állíts, ha nem stimmel."; case .verdict: "A napod és a heted fényében." }
    }

    private var capture: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button { go(.looking) } label: {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.frame(height: 200)
                        .overlay { photo("zab.jpg").resizable().scaledToFill() }
                        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom)
                        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    HStack(spacing: 10) {
                        Glyph("camera", "ink", size: 26).frame(width: 48, height: 48).background(Circle().fill(.white))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Lefotózom").font(.outfit(18)).foregroundStyle(.white)
                            Text("a tányérról megmondom, mi van rajta").font(.manrope(13)).foregroundStyle(.white.opacity(0.85))
                        }
                    }
                    .padding(16)
                }
                .shadow(color: Lagy.ink.opacity(0.15), radius: 16, y: 10)
            }
            .buttonStyle(PressStyle())
            HStack(spacing: 8) {
                TextField("", text: $text, prompt: Text("vagy írd le: zabkása joghurttal").foregroundStyle(Lagy.mute))
                    .font(.manrope(15, .medium)).foregroundStyle(Lagy.ink)
                    .padding(.leading, 18).frame(height: 52)
                    .background(Capsule().fill(.white).shadow(color: Lagy.ink.opacity(0.08), radius: 10, y: 6))
                Button { go(.looking) } label: {
                    Image(systemName: "arrow.up").font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 52, height: 52).background(Circle().fill(Lagy.ink))
                }
                .buttonStyle(PressStyle())
            }
            HStack(spacing: 6) {
                Chip(text: "Ugyanaz, mint tegnap", glyph: ("repeat", "peach"))
                Chip(text: "Kedvencek", glyph: ("star", "sun"))
            }
        }
    }

    /// Photo analysis (IRANY §10): scan line twice, label pill steps, corner marks, no circle.
    private var looking: some View {
        VStack(spacing: 16) {
            GeometryReader { g in
                ZStack(alignment: .top) {
                    photo("zab.jpg").resizable().scaledToFill().frame(width: g.size.width, height: 300).clipped()
                    LinearGradient(colors: [.clear, Lagy.sage2.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 70).offset(y: scanY * 300 - 35)
                    Capsule().fill(.white).frame(height: 2).shadow(color: Lagy.sage, radius: 8).offset(y: scanY * 300)
                    CornerMarks().stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round)).padding(18)
                    VStack {
                        Spacer()
                        Text(scanLabel).font(.manrope(13.5, .bold)).foregroundStyle(Lagy.ink)
                            .padding(.horizontal, 14).frame(height: 36).background(Capsule().fill(.white))
                            .contentTransition(.opacity).padding(.bottom, 18)
                    }
                }
                .frame(width: g.size.width, height: 300)
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            }
            .frame(height: 300)
            VStack(spacing: 10) {
                ForEach(0..<3, id: \.self) { _ in RoundedRectangle(cornerRadius: 16).fill(.white).frame(height: 52).opacity(0.7) }
            }
        }
        .task {
            withAnimation(.easeInOut(duration: 1.1).repeatCount(2, autoreverses: true)) { scanY = 1 }
            try? await Task.sleep(for: .seconds(1.1)); withAnimation { scanLabel = "Elemzem…" }
            try? await Task.sleep(for: .seconds(1.1)); withAnimation { scanLabel = "Kész · 86% biztos" }
            try? await Task.sleep(for: .seconds(0.7)); go(.draft)
        }
    }

    private var draft: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("\(Int(total.k))").font(.outfit(36, .heavy)).tracking(-1).contentTransition(.numericText(value: total.k))
                    Text("kalória").font(.manrope(14, .bold)).foregroundStyle(Lagy.ink2)
                    Spacer()
                    Chip(text: "86% biztos", style: .soft, glyph: ("check", "sage"), small: true)
                }
                .foregroundStyle(Lagy.ink)
                MacroBar(p: total.p, c: total.c, f: total.f, cP: cP, cC: cC, cF: cF)
            }
            .padding(18).lagyCard()

            LagySection(title: "Ezt látom a tányéron") {
                VStack(spacing: 10) {
                    ForEach($items) { $it in
                        HStack(spacing: 12) {
                            Group {
                                if let p = it.photo { photo(p).resizable().scaledToFill() }
                                else { Glyph(it.glyph.0, it.glyph.1, size: 24).frame(maxWidth: .infinity, maxHeight: .infinity).background(Lagy.sage3) }
                            }
                            .frame(width: 44, height: 44).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 5) {
                                Text(it.id).font(.outfit(15)).foregroundStyle(Lagy.ink)
                                Chip(text: "\(Int(it.kcal)) kalória", style: .soft, glyph: ("flame", "peach"), small: true)
                            }
                            Spacer(minLength: 4)
                            HStack(spacing: 6) {
                                stepBtn("minus") { it.grams = max(0, it.grams - 10) }
                                Text("\(Int(it.grams)) g").font(.outfit(14)).monospacedDigit().foregroundStyle(Lagy.ink).frame(width: 50)
                                stepBtn("plus") { it.grams = min(500, it.grams + 10) }
                            }
                        }
                        .padding(12).lagyCard(22)
                    }
                }
            }
            .sensoryFeedback(.selection, trigger: total.k)
            WidePill(title: "Rögzítem reggelinek", glyph: ("check", "sage")) { go(.verdict) }.padding(.top, 22)
        }
    }

    private func stepBtn(_ icon: String, _ a: @escaping () -> Void) -> some View {
        Button(action: { withAnimation(.snappy) { a() } }) {
            Image(systemName: icon).font(.system(size: 13, weight: .bold)).foregroundStyle(Lagy.ink)
                .frame(width: 40, height: 40).background(Circle().fill(Lagy.paper))
        }
        .buttonStyle(PressStyle())
    }

    @ViewBuilder private var verdict: some View {
        HStack(spacing: 8) {
            Chip(text: "7,8", style: .warm, glyph: ("star", "sun"))
            Chip(text: "\(Int(total.k)) kalória", style: .soft, glyph: ("flame", "peach"))
            Chip(text: "reggeli · 07:35")
        }
        LagySection(title: "A napod most", top: 18) {
            HStack(spacing: 16) {
                LagyRing(p: total.k / 2350, val: "\(Int(total.k))", unit: "a 2 350-ből")
                VStack(spacing: 11) {
                    LagyBar(label: "fehérje", glyph: ("fish", "peach"), value: "\(Int(total.p)) / 165", unit: "g", frac: total.p / 165, onDeep: true, warn: true)
                    LagyBar(label: "szénhidrát", glyph: ("bowl", "sun"), value: "\(Int(total.c)) / 260", unit: "g", frac: total.c / 260, onDeep: true)
                    LagyBar(label: "zsír", glyph: ("leaf", "sage"), value: "\(Int(total.f)) / 75", unit: "g", frac: total.f / 75, onDeep: true)
                }
            }
            .padding(16).deepCard()
        }
        LagySection(title: "Ha legközelebb javítanál") {
            HStack(spacing: 6) {
                Chip(text: "+20 g fehérje", style: .soft, glyph: ("fish", "peach"))
                Chip(text: "fele annyi méz", style: .warm, glyph: ("honey", "sun"))
            }
        }
        LagySection(title: "A heted") {
            let week: [(String, Double)] = [("K", 2280), ("Sze", 2510), ("Cs", 2190), ("P", 2400), ("Szo", 2780), ("V", 2300), ("H", total.k)]
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .bottom, spacing: 0) {
                    ForEach(week, id: \.0) { d in
                        VStack(spacing: 6) {
                            JarTube(frac: d.1 / 2800, w: 26, h: 84, warm: d.1 > 2600)
                                .overlay(alignment: .bottom) { Rectangle().fill(Lagy.ink.opacity(0.35)).frame(height: 1.5).offset(y: -84 * 2350 / 2800 + 0.75) }
                            Text(d.0).font(.manrope(12, .bold)).foregroundStyle(d.0 == "H" ? Lagy.deep : Lagy.ink2)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                HStack(spacing: 6) { Chip(text: "átlag 2 410 kalória", small: true); Chip(text: "cél 2 350", style: .soft, small: true) }
            }
            .padding(16).lagyCard()
        }
        BoopNote(segs: [
            .init("Lassan felszívódó szénhidrát és rost: ez kitart a délelőtti workshopon. A fehérje csak \(Int(total.p)) g, ez "),
            .init("kevés a 165 g-os napi célodhoz", "protein"),
            .init(". Este Push nap jön, ezért ebédnél legyen legalább 45 g. A mézből elég lett volna a fele."),
        ], mood: mood)
        .padding(.top, 24)
        WidePill(title: "Kész") { onDone("Zabkása · \(Int(total.k)) kalória"); dismiss() }.padding(.top, 20)
    }

    private func go(_ s: Stage) { withAnimation(.spring(response: 0.5, dampingFraction: 0.86)) { stage = s } }
}

struct MacroBar: View {
    var p: Double, c: Double, f: Double
    var cP: Color, cC: Color, cF: Color
    var body: some View {
        let kp = p * 4, kc = c * 4, kf = f * 9, tot = max(1, kp + kc + kf)
        VStack(alignment: .leading, spacing: 10) {
            GeometryReader { g in
                HStack(spacing: 3) {
                    Capsule().fill(cP).frame(width: (g.size.width - 6) * kp / tot)
                    Capsule().fill(cC).frame(width: (g.size.width - 6) * kc / tot)
                    Capsule().fill(cF).frame(width: (g.size.width - 6) * kf / tot)
                }
            }
            .frame(height: 10)
            HStack(spacing: 14) {
                legend(cP, "fehérje", p); legend(cC, "szénhidrát", c); legend(cF, "zsír", f)
            }
        }
    }
    private func legend(_ col: Color, _ l: String, _ g: Double) -> some View {
        HStack(spacing: 5) {
            Circle().fill(col).frame(width: 9, height: 9)
            Text("\(l) ").font(.manrope(12.5, .bold)).foregroundColor(Lagy.ink2) + Text("\(Int(g)) g").font(.outfit(13)).foregroundColor(Lagy.ink)
        }
    }
}

struct CornerMarks: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path(); let l: CGFloat = 26
        for (x, y, dx, dy) in [(r.minX, r.minY, 1.0, 1.0), (r.maxX, r.minY, -1.0, 1.0), (r.minX, r.maxY, 1.0, -1.0), (r.maxX, r.maxY, -1.0, -1.0)] {
            p.move(to: CGPoint(x: x, y: y + dy * l)); p.addLine(to: CGPoint(x: x, y: y)); p.addLine(to: CGPoint(x: x + dx * l, y: y))
        }
        return p
    }
}

// MARK: - Boop észrevette: observation cards (Lágy obsCard)

struct LagyPatterns: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    struct P: Identifiable {
        let id: Int; let status: String; let glyph: (String, String); let warm: Bool
        let pre: String; let em: String; let post: String
        let chips: [String]; let hits: Int; let of: Int; var ask = false
    }
    private let items: [P] = [
        .init(id: 0, status: "Új · tanulom", glyph: ("heart", "berry"), warm: true, pre: "A 6 óránál rövidebb éjszakák után ", em: "4 ütéssel magasabb", post: " a reggeli nyugalmi pulzusod.",
              chips: ["60 nap", "Huawei óra"], hits: 9, of: 11, ask: true),
        .init(id: 1, status: "Új · erősödik", glyph: ("moon", "sky"), warm: true, pre: "Ha 21 óra után vacsorázol, aznap éjjel ", em: "22 perccel kevesebb", post: " a mélyalvásod.",
              chips: ["Sleep Cycle", "14 késő vacsora"], hits: 10, of: 14),
        .init(id: 2, status: "Megerősítve", glyph: ("dumbbell", "berry"), warm: false, pre: "Nehéz edzésnap után ", em: "mélyebb az éjszakád", post: ", de csak ha 22:30 előtt lefekszel.",
              chips: ["12 terhelt nap", "9 éjszaka"], hits: 9, of: 12),
        .init(id: 3, status: "Tanulom", glyph: ("heart", "peach"), warm: true, pre: "Amikor Anna szerepel a hála-naplódban, másnap ", em: "40 perccel többet alszol", post: ".",
              chips: ["hála-napló", "alvás"], hits: 4, of: 8, ask: true),
    ]
    @State private var answered: [Int: Bool] = [:]

    var body: some View {
        LagyFlowFrame(photoName: "mezo-nagyito.jpg", crumb: ("Nap › Mai › ", "Észrevételek"), eyebrow: "Minták · összefüggések",
                      title: "Boop észrevette", sub: "Az órád és a Sleep Cycle is ide fut be.") {
            VStack(spacing: 12) { ForEach(items) { card($0) } }
            BoopNote(segs: [
                .init("Mostantól az órád és a Sleep Cycle adatai is ide futnak be, ezért "), .init("gyorsabban tanulok", "learn"),
                .init(". Két új mintát találtam a héten, a pulzusosat érdemes figyelni."),
            ], mood: mood)
            .padding(.top, 24)
            WidePill(title: "Rendben") { onDone("2 új minta átnézve"); dismiss() }.padding(.top, 20)
        }
    }

    private func card(_ p: P) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Chip(text: p.status, style: p.warm ? .warm : .soft, glyph: p.glyph, small: true)
            (Text(p.pre) + Text(p.em).foregroundColor(Lagy.deep) + Text(p.post))
                .font(.outfit(16.5)).foregroundStyle(Lagy.ink).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 5) {
                ForEach(0..<p.of, id: \.self) { k in Circle().fill(k < p.hits ? (p.warm ? Lagy.peach : Lagy.sage) : Lagy.ink.opacity(0.1)).frame(width: 11, height: 11) }
            }
            HStack(spacing: 6) {
                Chip(text: "\(p.hits) / \(p.of) igaz", style: .soft, small: true)
                ForEach(p.chips, id: \.self) { Chip(text: $0, small: true) }
            }
            if p.ask {
                if let a = answered[p.id] {
                    HStack(spacing: 8) { Glyph("check", "sage", size: 18); Text(a ? "Figyelem tovább" : "Elengedem") }
                        .font(.manrope(13.5, .bold)).foregroundStyle(Lagy.deep)
                } else {
                    HStack(spacing: 8) {
                        Text("Figyeljem tovább?").font(.manrope(14, .bold)).foregroundStyle(Lagy.ink)
                        Spacer()
                        ForEach([("Nem", false), ("Igen", true)], id: \.0) { t, v in
                            Button { withAnimation(.spring) { answered[p.id] = v } } label: {
                                Text(t).font(.manrope(13.5, .bold)).foregroundStyle(v ? .white : Lagy.ink)
                                    .padding(.horizontal, 18).frame(height: 40).background(Capsule().fill(v ? Lagy.ink : Lagy.paper))
                            }
                            .buttonStyle(PressStyle())
                        }
                    }
                }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .lagyCard()
        .sensoryFeedback(.selection, trigger: answered[p.id])
    }
}
