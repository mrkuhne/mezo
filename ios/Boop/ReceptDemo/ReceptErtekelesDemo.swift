#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (spike/boop-receptertekeles, mezo-r36n9.199): the recipe sheet's new evaluation card on invented
// fixtures. Launch with `-previewRecept YES` and `-previewReceptState full|loading|noprose|small`.

private struct DemoDim: Identifiable {
    let id: String, name: String, glyph: String, points: Int?, weight: Int, sentence: String
    var short: String { ["macro": "Makró", "micro": "Rost", "who": "Só, cukor", "fat_quality": "Zsír", "nova": "Feldolgozás", "plant_diversity": "Növények", "energy_density": "Sűrűség", "portion": "Adag"][id] ?? name }
}

private struct DemoTip: Identifiable { let id = UUID(); let text: String; let lifts: String; let impact: String }

private enum Fx {
    static let name = "Diós zabpalacsinta"
    static let score = 74
    static let confidence = 0.82
    static let verdict = "Fehérjében erős reggeli, a só húzza le."
    static let fits = ["Reggelire", "Edzés után"]
    static let summary = "A zabpehely és a túró együtt hosszan laktat, a dió adja a jó zsírokat. Egyetlen gyenge pontja a sajt: egy adagban több sót hoz, mint a palacsinta összes többi hozzávalója együtt."
    static let dims: [DemoDim] = [
        .init(id: "macro", name: "Makró arány", glyph: "bowl-cream", points: 84, weight: 25,
              sentence: "A 32 g fehérje főleg a túróból és a tojásból jön; a szénhidrát kicsit a reggeli arány alatt marad."),
        .init(id: "micro", name: "Rost", glyph: "leaf-sage", points: 78, weight: 15,
              sentence: "A zabpehely és a dió együtt 7 g rostot ad — ez egy étkezéshez jó szint."),
        .init(id: "who", name: "Só és cukor", glyph: "drop-sky", points: 41, weight: 15,
              sentence: "A sót főleg a feta viszi: 1,4 g egy adagban, a reggelire jutó keret kétszerese."),
        .init(id: "fat_quality", name: "Zsírminőség", glyph: "honey-sun", points: 80, weight: 10,
              sentence: "A zsír zöme a dióból jön, telítettből kevés — a feta az egyetlen nagyobb forrás."),
        .init(id: "nova", name: "Feldolgozottság", glyph: "spark-sage", points: 92, weight: 15,
              sentence: "A kalóriák 94%-a alig feldolgozott alapanyagból — csak a feta számít feldolgozottnak."),
        .init(id: "plant_diversity", name: "Növényi sokféleség", glyph: "leaf-sage", points: 60, weight: 8,
              sentence: "Két növényi csoport van benne (gabona, dióféle); egy maréknyi bogyós gyümölcs hármat adna."),
        .init(id: "energy_density", name: "Energia-sűrűség", glyph: "bolt-sun", points: 70, weight: 6,
              sentence: "100 grammja 210 kcal — közepesen laktató."),
        .init(id: "portion", name: "Adag", glyph: "plate-deep", points: nil, weight: 6,
              sentence: ""),
    ]
    static let tips: [DemoTip] = [
        .init(text: "Cseréld a feta felét túróra — a só 1,4 g-ról 0,8 g-ra esik, a fehérje marad.", lifts: "Só és cukor", impact: "−0,6 g só"),
        .init(text: "Szórj rá egy marék áfonyát (50 g): plusz egy növényi csoport és 1 g rost.", lifts: "Növényi sokféleség", impact: "+1 csoport"),
    ]
    // Day: eaten so far, this serving, target (invented — „például”).
    static let day: [(String, Double, Double, Double, String)] = [
        ("kcal", 1240, 410, 2400, ""), ("fehérje", 96, 32, 176, "g"), ("szénhidrát", 130, 38, 250, "g"), ("zsír", 41, 17, 75, "g"),
    ]
    static let recipeScores: [Int] = [88, 84, 81, 74, 72, 70, 69, 66, 65, 63, 61, 60, 58, 57, 55, 54, 52, 50, 49, 47, 45, 44, 42, 40, 38, 35, 33, 31, 28, 24]
}

private let amber = Color(red: 0.96, green: 0.78, blue: 0.38)

/// Étel: one main colour (green) and two sub colours (honey gold, coral) — every dimension its own shade of the three.
enum EtelColors {
    static let main = Color(hex: 0x3FBF8F)   // zöld
    static let gold = Color(hex: 0xF4C860)   // méz
    static let coral = Color(hex: 0xF28B6E)  // korall
}
private enum DimPalette {
    static func color(_ id: String) -> Color {
        switch id {
        case "macro": EtelColors.main
        case "micro": Color(hex: 0xA9D86B)          // lime
        case "who": EtelColors.coral
        case "fat_quality": EtelColors.gold
        case "nova": Color(hex: 0x7FDCC0)           // menta
        case "plant_diversity": Color(hex: 0x6CC46A) // levél
        case "energy_density": Color(hex: 0xF5A65B)  // barack
        default: Color(hex: 0xF2A3B3)                // rózsa
        }
    }
}
private let fuelGrad = LinearGradient(colors: [Color(hex: 0x2E9C74), Color(hex: 0xA6E8C8), Color(hex: 0xF4C860)],
                                      startPoint: .leading, endPoint: .trailing)

struct ReceptErtekelesDemoRoot: View {
    private let state = UserDefaults.standard.string(forKey: "previewReceptState") ?? "full"
    @State private var selectedDim: String = ""
    @State private var openDim: String?
    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "RECEPT", title: Fx.name) {
            if state == "loading" {
                loadingCard
            } else {
                hero
                dayCard
                contributors
                rankCard
                tipsCard
                if state != "noprose" { feedback }
            }
        }
        .blur(radius: openDim == nil ? 0 : 14)
        .overlay {
            if let d = Fx.dims.first(where: { $0.id == openDim }) {
                ZStack(alignment: .bottom) {
                    Color.black.opacity(0.45).ignoresSafeArea()
                        .onTapGesture { withAnimation(.snappy) { openDim = nil } }
                    DimDetail(d: d, isWeak: d.id == weakest, isStrong: d.id == strongest) { withAnimation(.snappy) { openDim = nil } }
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .transition(.opacity)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { if state == "detail" { openDim = "who" } }
    }

    private var weakest: String? { Fx.dims.filter { $0.points != nil }.min { $0.points! < $1.points! }?.id }
    private var strongest: String? { Fx.dims.filter { $0.points != nil }.max { $0.points! < $1.points! }?.id }

    // MARK: hero

    private var hero: some View {
        EtelSheetCard(label: "BOOP ÉRTÉKELÉSE", trailing: "egy adagra") {
            HStack(alignment: .center, spacing: 16) {
                Rosette(dims: Fx.dims, weakest: weakest, score: Fx.score).frame(width: 128, height: 128)
                VStack(alignment: .leading, spacing: 10) {
                    Text(state == "noprose" ? "Jó választás, a só és cukor a gyengéje." : Fx.verdict)
                        .nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    VStack(alignment: .leading, spacing: 4) {
                        Capsule().fill(.white.opacity(0.1)).frame(height: 5)
                            .overlay(alignment: .leading) { GeometryReader { g in Capsule().fill(.white.opacity(0.55)).frame(width: g.size.width * Fx.confidence) } }
                        Text("Megbízhatóság 82% · 7 / 8 szempont").nkFont(11.5).foregroundStyle(.white.opacity(0.5))
                    }
                }
            }
            NKFlowRow(spacing: 6, rowSpacing: 6) { ForEach(Fx.fits, id: \.self) { EtelPill(text: $0, tone: .hue) } }
            if state != "noprose" {
                Text(Fx.summary).nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var loadingCard: some View {
        EtelSheetCard(label: "BOOP ÉRTÉKELÉSE", trailing: "egy adagra") {
            HStack(spacing: 14) {
                EtelScoreRing(points: Fx.score, size: 64)
                Text("Átnézem a hozzávalókat…").nkFont(13.5).foregroundStyle(.white.opacity(0.55))
            }
        }
    }

    // MARK: contributors — 2 rows of 4 tiles; tap = the tile becomes the lens, its sentence opens in place

    private var contributors: some View {
        EtelSheetCard(label: "MIBŐL ÁLL ÖSSZE") {
            let rows = [Array(Fx.dims.prefix(4)), Array(Fx.dims.dropFirst(4))]
            VStack(spacing: 10) {
                ForEach(0..<2, id: \.self) { r in
                    HStack(spacing: 8) { ForEach(rows[r]) { d in tile(d) } }
                }
            }
            Text("Koppints egy szempontra, és részletesen elmondom, miért annyi.").nkFont(12).foregroundStyle(.white.opacity(0.45))
        }
    }

    private func tile(_ d: DemoDim) -> some View {
        let c = DimPalette.color(d.id), on = d.id == selectedDim, isWeak = d.id == weakest
        return Button { withAnimation(.snappy) { openDim = d.id } } label: {
            VStack(spacing: 6) {
                ZStack {
                    Circle().fill(c.opacity(0.18)).frame(width: 34, height: 34)
                    NKGlyph(d.glyph, c, size: 17)
                }
                Text(d.points.map(String.init) ?? "—").font(.custom(Lagy.outfitFamily, size: 19).weight(.medium))
                    .foregroundStyle(.white)
                Capsule().fill(.white.opacity(0.1)).frame(height: 4)
                    .overlay(alignment: .leading) {
                        GeometryReader { g in Capsule().fill(c).frame(width: g.size.width * Double(d.points ?? 0) / 100) }
                    }
                    .padding(.horizontal, 6)
                Text(d.short).nkFont(10).foregroundStyle(.white.opacity(0.6)).lineLimit(2).multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8).frame(height: 26, alignment: .top)
            }
            .padding(.vertical, 10).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(on ? 0.1 : 0.04)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(on ? c.opacity(0.8) : .clear, lineWidth: 1.5))
            .overlay(alignment: .topTrailing) {
                if isWeak { Circle().fill(amber).frame(width: 8, height: 8).padding(7) }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(d.name), \(d.points.map(String.init) ?? "nincs adat")\(isWeak ? ", leggyengébb" : "")")
    }

    private func lens(_ d: DemoDim) -> some View {
        let c = DimPalette.color(d.id), isWeak = d.id == weakest, isStrong = d.id == strongest
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(d.name).nkFont(15.5, .semibold).foregroundStyle(.white)
                if isWeak { EtelPill(text: "leggyengébb", tone: .warn) }
                if isStrong { EtelPill(text: "legerősebb", tone: .hue) }
                Spacer(minLength: 4)
                Text("súly \(d.weight)%").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
            }
            Text(d.points == nil ? "Még tanulom: ennél a receptnél nincs elég adat hozzá, a pontszám nélküle számol." : d.sentence)
                .nkFont(14).lineSpacing(2.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(c.opacity(0.1)))
        .overlay(alignment: .leading) { Capsule().fill(c).frame(width: 3).padding(.vertical, 12) }
        .id(d.id)
        .transition(.opacity)
    }

    // MARK: day

    private var dayCard: some View {
        EtelSheetCard(label: "HA MA MEGENNÉD", trailing: "1 adaggal") {
            VStack(spacing: 13) {
                ForEach(Fx.day, id: \.0) { m in dayBar(m.0, eaten: m.1, add: m.2, target: m.3, unit: m.4, color: macroColor(m.0)) }
            }
            HStack(spacing: 14) {
                legend(Color(white: 0.62), "eddig ma")
                legend(EtelColors.main, "ez a recept (színes)")
                Spacer()
            }
            Text("Ezzel a fehérjecélod 73%-án lennél, és még 750 kcal maradna a nap többi részére.")
                .nkFont(14).lineSpacing(2).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func legend(_ c: Color, _ t: String) -> some View {
        HStack(spacing: 5) { Capsule().fill(c).frame(width: 12, height: 5); Text(t).nkFont(11).foregroundStyle(.white.opacity(0.5)) }
    }

    private func macroColor(_ k: String) -> Color { ["kcal": EtelColors.main, "fehérje": EtelColors.coral, "szénhidrát": EtelColors.gold, "zsír": Color(hex: 0x7FDCC0)][k] ?? EtelColors.main }

    private func dayBar(_ label: String, eaten: Double, add: Double, target: Double, unit: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(label).nkFont(13, .medium).foregroundStyle(.white.opacity(0.8))
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(huInt(Int(eaten))) →").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                    Text(huInt(Int(eaten + add))).font(.custom(Lagy.outfitFamily, size: 15).weight(.medium)).foregroundStyle(.white)
                    Text("/ \(huInt(Int(target)))\(unit.isEmpty ? "" : " \(unit)")").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                }
            }
            GeometryReader { g in
                let w = g.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(color).frame(width: w * min(1, (eaten + add) / target))
                    Capsule().fill(Color(white: 0.62)).frame(width: w * min(1, eaten / target))
                }
            }
            .frame(height: 9)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: rank

    private var rankCard: some View {
        EtelSheetCard(label: "A RECEPTJEID KÖZÖTT") {
            RankStrip(scores: Fx.recipeScores, mine: 3).frame(height: 44)
            HStack(alignment: .top, spacing: 10) {
                fact("4.", "legjobb pontszám\na 30 receptedből")
                fact("2.", "fehérjében\negy adagra")
                fact("6×", "etted eddig\nutoljára nov. 22.")
            }
        }
    }

    private func fact(_ big: String, _ small: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(big).font(.custom(Lagy.outfitFamily, size: 26).weight(.light)).foregroundStyle(.white)
            Text(small).nkFont(11.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: tips + feedback

    private var tipsCard: some View {
        EtelSheetCard(label: "ÍGY LENNE JOBB") {
            ForEach(Fx.tips) { tip in
                HStack(alignment: .top, spacing: 12) {
                    ZStack { Circle().fill(EtelColors.gold.opacity(0.16)).frame(width: 30, height: 30); NKGlyph("spark-cream", EtelColors.gold, size: 15) }
                    VStack(alignment: .leading, spacing: 6) {
                        Text(tip.text).nkFont(14.5).lineSpacing(2).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                        NKFlowRow(spacing: 6, rowSpacing: 6) {
                            EtelPill(text: tip.lifts, tone: .hue)
                            EtelPill(text: tip.impact)
                        }
                    }
                }
            }
        }
    }

    private var feedback: some View {
        HStack(spacing: 10) {
            Text("Hasznos volt ez az értékelés?").nkFont(13.5).foregroundStyle(.white.opacity(0.7))
            Spacer()
            ForEach(["Igen", "Nem"], id: \.self) { t in
                Text(t).nkFont(13, .semibold).foregroundStyle(.white).padding(.horizontal, 16).frame(height: 36)
                    .background(Capsule().stroke(.white.opacity(0.35)))
            }
        }
        .padding(16).nkGlass()
    }
}

/// Eight petals, one per dimension: length = its points, the weakest amber, a degraded one a dashed stub.
private struct Rosette: View {
    let dims: [DemoDim]; let weakest: String?; let score: Int
    var body: some View {
        GeometryReader { g in
            let c = CGPoint(x: g.size.width / 2, y: g.size.height / 2)
            let r = min(g.size.width, g.size.height) / 2
            ZStack {
                Circle().stroke(.white.opacity(0.08), lineWidth: 1).frame(width: r * 2, height: r * 2)
                ForEach(Array(dims.enumerated()), id: \.offset) { i, d in
                    let angle = Angle.degrees(Double(i) / Double(dims.count) * 360 - 90)
                    let len = r * (0.3 + 0.7 * Double(d.points ?? 0) / 100)
                    Petal()
                        .fill(d.points == nil ? AnyShapeStyle(Color.white.opacity(0.08))
                              : AnyShapeStyle(LinearGradient(colors: [DimPalette.color(d.id).opacity(0.35), DimPalette.color(d.id)],
                                                             startPoint: .bottom, endPoint: .top)))
                        .frame(width: r * 0.42, height: len)
                        .offset(y: -len / 2)
                        .rotationEffect(angle + .degrees(90))
                        .position(c)
                }
                Circle().fill(NK.ground).frame(width: r * 0.7, height: r * 0.7)
                VStack(spacing: -2) {
                    Text("\(score)").font(.custom(Lagy.outfitFamily, size: 30).weight(.light)).foregroundStyle(.white)
                }
            }
        }
        .accessibilityElement().accessibilityLabel("A recept pontszáma \(score)")
    }
}

private struct Petal: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addQuadCurve(to: CGPoint(x: rect.midX, y: rect.minY), control: CGPoint(x: rect.minX - rect.width * 0.1, y: rect.minY + rect.height * 0.25))
        p.addQuadCurve(to: CGPoint(x: rect.midX, y: rect.maxY), control: CGPoint(x: rect.maxX + rect.width * 0.1, y: rect.minY + rect.height * 0.25))
        return p
    }
}

/// All scored recipes as dots on one line, best on the right; this one lit and labelled.
private struct RankStrip: View {
    let scores: [Int]; let mine: Int
    var body: some View {
        GeometryReader { g in
            let sorted = scores.sorted()
            let w = g.size.width
            ZStack(alignment: .topLeading) {
                Capsule().fill(.white.opacity(0.08)).frame(height: 2).offset(y: 27)
                ForEach(Array(sorted.enumerated()), id: \.offset) { i, s in
                    let x = w * Double(i) / Double(max(sorted.count - 1, 1))
                    let isMine = s == scores[mine]
                    Circle().fill(isMine ? AnyShapeStyle(fuelGrad) : AnyShapeStyle(Color.white.opacity(0.28)))
                        .frame(width: isMine ? 16 : 6, height: isMine ? 16 : 6)
                        .position(x: min(max(x, 8), w - 8), y: 28)
                    if isMine {
                        Text("ez").nkFont(10.5, .semibold).foregroundStyle(Hue.fuel.glow).position(x: min(max(x, 8), w - 8), y: 8)
                    }
                }
                Text("gyengébb").nkFont(10).foregroundStyle(.white.opacity(0.35)).offset(y: 34)
                Text("jobb").nkFont(10).foregroundStyle(.white.opacity(0.35)).frame(width: w, alignment: .trailing).offset(y: 34)
            }
        }
        .accessibilityElement().accessibilityLabel("A 30 recepted közül a 4. legjobb")
    }
}

// MARK: the detail page over a blurred sheet (web DimSheet parity, richer)

private struct DimDetail: View {
    let d: DemoDim; let isWeak: Bool; let isStrong: Bool; let close: () -> Void
    private var c: Color { DimPalette.color(d.id) }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule().fill(.white.opacity(0.3)).frame(width: 38, height: 5).frame(maxWidth: .infinity).padding(.top, 10)
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(alignment: .center, spacing: 14) {
                        ZStack { Circle().fill(c.opacity(0.2)).frame(width: 54, height: 54); NKGlyph(d.glyph, c, size: 26) }
                        VStack(alignment: .leading, spacing: 2) {
                            NKMono("EGY SZEMPONT")
                            Text(d.name).nkFont(24, design: .serif).foregroundStyle(.white)
                        }
                        Spacer()
                        Text(d.points.map(String.init) ?? "—").font(.custom(Lagy.outfitFamily, size: 40).weight(.light)).foregroundStyle(isWeak ? amber : .white)
                    }
                    Capsule().fill(.white.opacity(0.08)).frame(height: 10)
                        .overlay(alignment: .leading) { GeometryReader { g in Capsule().fill(c).frame(width: g.size.width * Double(d.points ?? 0) / 100) } }
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        if isWeak { EtelPill(text: "a recept leggyengébb pontja", tone: .warn) }
                        if isStrong { EtelPill(text: "a recept legerősebb pontja", tone: .hue) }
                        EtelPill(text: "súlya a pontszámban \(d.weight)%")
                        EtelPill(text: "az adag 97%-át láttam")
                    }
                    block("MIT MÉR", "Mennyire felel meg a recept a WHO ajánlásainak: a hozzáadott cukor legfeljebb az energia 10%-a, a só pedig férjen bele a napi keretbe.")
                    block("MIÉRT ENNYI", "A cukorral nincs gond: az energia 6%-a, főleg az áfonyából és a mézből, jóval a 10%-os határ alatt. A só húzza le a pontszámot: egy adagban 1,4 g, ami a reggelire jutó 0,7 g-os keret kétszerese. Ennek kétharmadát a feta hozza, a többit a sütőpor és a tojás — a zabpehely és a túró szinte sómentes.")
                    VStack(alignment: .leading, spacing: 12) {
                        NKMono("A SZÁMOK")
                        fact("Cukor", "6 E%", "limit 10 E%", 0.6, c)
                        fact("Só", "1,4 g", "keret 0,7 g", 1.0, amber, over: "200%")
                    }
                    .padding(16).background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.05)))
                    VStack(alignment: .leading, spacing: 10) {
                        NKMono("HONNAN JÖN")
                        source("Feta", "0,9 g só", 0.64)
                        source("Sütőpor", "0,4 g só", 0.29)
                        source("Tojás", "0,1 g só", 0.07)
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        NKMono("ÍGY JAVÍTHATÓ")
                        HStack(alignment: .top, spacing: 10) {
                            NKGlyph("spark-cream", EtelColors.gold, size: 15).padding(.top, 2)
                            Text("Cseréld a feta felét túróra — a só 1,4 g-ról 0,8 g-ra esik, a fehérje marad.").nkFont(14.5).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                        }
                        HStack(alignment: .top, spacing: 10) {
                            NKGlyph("spark-cream", EtelColors.gold, size: 15).padding(.top, 2)
                            Text("Sütőpor helyett fél teáskanál szódabikarbóna és pár csepp citrom: feleannyi nátrium.").nkFont(14.5).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Button(action: close) {
                        Text("Kész").nkFont(15, .semibold).foregroundStyle(NK.ground)
                            .frame(maxWidth: .infinity, minHeight: 48).background(Capsule().fill(.white.opacity(0.95)))
                    }.buttonStyle(.plain)
                }
                .padding(22).padding(.bottom, 20)
            }
            .scrollIndicators(.hidden)
        }
        .frame(maxHeight: 720)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32, style: .continuous)
                .fill(NK.ground.opacity(0.92))
                .overlay(alignment: .top) { LinearGradient(colors: [c.opacity(0.22), .clear], startPoint: .top, endPoint: .center).clipShape(UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32, style: .continuous)) }
        )
        .ignoresSafeArea(edges: .bottom)
    }
    private func block(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NKMono(label)
            Text(text).nkFont(15).lineSpacing(3.5).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
        }
    }
    private func fact(_ name: String, _ value: String, _ ref: String, _ pct: Double, _ col: Color, over: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(name).nkFont(14, .medium).foregroundStyle(.white)
                Spacer()
                Text(value).font(.custom(Lagy.outfitFamily, size: 17).weight(.medium)).foregroundStyle(.white)
                Text(ref).nkFont(12).foregroundStyle(.white.opacity(0.5))
                if let over { EtelPill(text: over, tone: .warn) }
            }
            Capsule().fill(.white.opacity(0.08)).frame(height: 7)
                .overlay(alignment: .leading) { GeometryReader { g in Capsule().fill(col).frame(width: g.size.width * min(1, pct)) } }
        }
    }
    private func source(_ name: String, _ value: String, _ share: Double) -> some View {
        HStack(spacing: 10) {
            Text(name).nkFont(14).foregroundStyle(.white.opacity(0.85)).frame(width: 80, alignment: .leading)
            Capsule().fill(.white.opacity(0.08)).frame(height: 7)
                .overlay(alignment: .leading) { GeometryReader { g in Capsule().fill(EtelColors.coral.opacity(0.85)).frame(width: g.size.width * share) } }
            Text(value).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).frame(width: 70, alignment: .trailing)
        }
    }
}
#endif
