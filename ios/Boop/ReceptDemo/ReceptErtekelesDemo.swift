#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (spike/boop-receptertekeles, mezo-r36n9.199): the recipe sheet's new evaluation card on invented
// fixtures. Launch with `-previewRecept YES` and `-previewReceptState full|loading|noprose|small`.

private struct DemoDim: Identifiable {
    let id: String, name: String, glyph: String, points: Int?, weight: Int, sentence: String
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
              sentence: "A sót főleg a feta viszi: 1,4 g egy adagban, a napi keret közel harmada."),
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
private let fuelGrad = LinearGradient(colors: [Color(hex: 0x2E9C74), Color(hex: 0xA6E8C8), Color(hex: 0xF4C860)],
                                      startPoint: .leading, endPoint: .trailing)

struct ReceptErtekelesDemoRoot: View {
    private let state = UserDefaults.standard.string(forKey: "previewReceptState") ?? "full"
    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "RECEPT", title: Fx.name) {
            if state == "loading" {
                loadingCard
            } else {
                hero
                contributors
                if state != "small" || true { dayCard }
                rankCard
                tipsCard
                if state != "noprose" { feedback }
            }
        }
        .preferredColorScheme(.dark)
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

    // MARK: contributors

    private var contributors: some View {
        EtelSheetCard(label: "MIBŐL ÁLL ÖSSZE") {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(Fx.dims) { d in row(d) }
            }
            Text("Koppints egy szempontra a részletekért.").nkFont(12).foregroundStyle(.white.opacity(0.4))
        }
    }

    private func row(_ d: DemoDim) -> some View {
        let isWeak = d.id == weakest, isStrong = d.id == strongest
        return VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill((isWeak ? amber : Hue.fuel.glow).opacity(0.14)).frame(width: 30, height: 30)
                    NKGlyph(d.glyph, isWeak ? amber : Hue.fuel.glow, size: 15)
                }
                Text(d.name).nkFont(15, .medium).foregroundStyle(.white)
                if isWeak { EtelPill(text: "leggyengébb", tone: .warn) }
                if isStrong { EtelPill(text: "legerősebb", tone: .hue) }
                Spacer(minLength: 6)
                Text(d.points.map(String.init) ?? "—").font(.custom(Lagy.outfitFamily, size: 19).weight(.medium))
                    .foregroundStyle(isWeak ? amber : .white)
            }
            if let p = d.points {
                Capsule().fill(.white.opacity(0.08)).frame(height: 7)
                    .overlay(alignment: .leading) {
                        GeometryReader { g in
                            Capsule().fill(isWeak ? AnyShapeStyle(amber) : AnyShapeStyle(fuelGrad))
                                .frame(width: g.size.width * Double(p) / 100)
                        }
                    }
                HStack(alignment: .top) {
                    Text(d.sentence).nkFont(13).lineSpacing(2).foregroundStyle(.white.opacity(0.68)).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Text("súly \(d.weight)%").nkFont(10.5, design: .monospaced).foregroundStyle(.white.opacity(0.38))
                }
            } else {
                Text("Még tanulom — ennél a receptnél nincs elég adat hozzá, a pontszám nélküle számol.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.45)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: day

    private var dayCard: some View {
        EtelSheetCard(label: "HA MA MEGENNÉD", trailing: "1 adaggal") {
            VStack(spacing: 13) {
                ForEach(Fx.day, id: \.0) { m in dayBar(m.0, eaten: m.1, add: m.2, target: m.3, unit: m.4) }
            }
            HStack(spacing: 14) {
                legend(Color(white: 0.62), "eddig ma")
                legend(Color(hex: 0x4FB9A2), "ez a recept")
                Spacer()
            }
            Text("Ezzel a fehérjecélod 73%-án lennél, és még 750 kcal maradna a nap többi részére.")
                .nkFont(14).lineSpacing(2).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func legend(_ c: Color, _ t: String) -> some View {
        HStack(spacing: 5) { Capsule().fill(c).frame(width: 12, height: 5); Text(t).nkFont(11).foregroundStyle(.white.opacity(0.5)) }
    }

    private func dayBar(_ label: String, eaten: Double, add: Double, target: Double, unit: String) -> some View {
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
                    Capsule().fill(LinearGradient(colors: [Color(hex: 0x2E9C74), Color(hex: 0xA6E8C8)], startPoint: .leading, endPoint: .trailing)).frame(width: w * min(1, (eaten + add) / target))
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
                    ZStack { Circle().fill(Hue.fuel.glow.opacity(0.14)).frame(width: 30, height: 30); NKGlyph("spark-cream", Hue.fuel.glow, size: 15) }
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
                              : d.id == weakest ? AnyShapeStyle(amber.opacity(0.85))
                              : AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x2E9C74).opacity(0.55), Color(hex: 0x4FB9A2), Color(hex: 0xA6E8C8)],
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
#endif
