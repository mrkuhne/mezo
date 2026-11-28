import SwiftUI
import BoopCore
import BoopDesign

// The recipe's evaluation in the recipe sheet (mezo-r36n9.199, spec §5.4 — the approved spike): hero rosette with the
// verdict → „Ha ma megennéd" → „Miből áll össze" (2 × 4 tiles; a tile opens the detail page) → „A receptjeid között" →
// „Így lenne jobb" → „Hasznos volt?". Étel colours (decision #140). The day and rank blocks are local math.

/// The short tile name and glyph of each template dimension.
enum RecipeDimensionLook {
    static func short(_ d: ScoreDimension) -> String {
        ["macro": "Makró", "micro": "Rost", "who": "Só, cukor", "fat_quality": "Zsír", "nova": "Feldolgozás",
         "plant_diversity": "Növények", "energy_density": "Sűrűség", "portion": "Adag"][d.id] ?? d.label
    }
    static func glyph(_ id: String) -> String {
        ["macro": "bowl-cream", "micro": "leaf-sage", "who": "drop-sky", "fat_quality": "honey-sun", "nova": "spark-sage",
         "plant_diversity": "leaf-sage", "energy_density": "bolt-sun", "portion": "plate-deep"][id] ?? "spark-sage"
    }
}

struct RecipeScoreCard: View {
    let recipe: Recipe
    let breakdown: RecipeBreakdown
    let day: FoodDay?
    let todayYmd: String
    let recipes: [Recipe]
    let logs: [RecipeLog]?
    let vote: Bool?
    let onVote: (Bool?) -> Void
    let onOpen: (ScoreDimension) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if let b = breakdown.breakdown {
            let ex = dimensionExtremes(b.dimensions)
            VStack(spacing: 12) {
                hero(b, weakest: ex.weakest)
                if let impact = recipeDayImpact(day: day, todayYmd: todayYmd, serving: recipe.perServing) { dayCard(impact) }
                tiles(b, weakest: ex.weakest, strongest: ex.strongest)
                if let rank = recipeRank(id: recipe.id, recipes: recipes) { rankCard(rank) }
                if !b.improve.isEmpty { tipsCard(b) }
                if let summary = b.summary, !summary.isEmpty { feedback }
            }
        } else {
            EtelSheetCard(label: "BOOP ÉRTÉKELÉSE", trailing: "egy adagra") {
                Text("Ehhez a recepthez még nincs pontszám — nincs benne kalória, amiből számolni lehetne.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: hero

    private func hero(_ b: MealBreakdown, weakest: String?) -> some View {
        let points = Int((b.value * 100).rounded())
        let live = b.dimensions.filter { $0.weight > 0 }.count
        let verdict = VStack(alignment: .leading, spacing: 10) {
            Text(recipeVerdict(b)).nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 4) {
                ScoreBar(fraction: b.confidence, color: .white.opacity(0.55), height: 5)
                Text("Megbízhatóság \(Int((b.confidence * 100).rounded()))% · \(live) / \(b.dimensions.count) szempont")
                    .nkFont(11.5).foregroundStyle(.white.opacity(0.5))
            }
        }
        return EtelSheetCard(label: "BOOP ÉRTÉKELÉSE", trailing: "egy adagra") {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 14) {
                    Rosette(dims: b.dimensions, score: points).frame(width: 128, height: 128)
                    verdict
                }
            } else {
                HStack(alignment: .center, spacing: 16) {
                    Rosette(dims: b.dimensions, score: points).frame(width: 128, height: 128)
                    verdict
                }
            }
            if !breakdown.fitsFor.isEmpty {
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    ForEach(breakdown.fitsFor, id: \.self) { EtelPill(text: recipeFitLabel($0), tone: .hue) }
                }
            }
            if let summary = b.summary, !summary.isEmpty {
                Text(summary).nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: day

    private func dayCard(_ impact: DayImpact) -> some View {
        EtelSheetCard(label: "HA MA MEGENNÉD", trailing: "1 adaggal") {
            VStack(spacing: 13) { ForEach(impact.rows, id: \.key) { dayBar($0) } }
            HStack(spacing: 14) {
                legend(EtelPalette.eatenGrey, "eddig ma")
                legend(EtelPalette.main, "ez a recept (színes)")
                Spacer()
            }
            .accessibilityHidden(true)
            Text(impact.sentence).nkFont(14).lineSpacing(2).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
    }

    private static func label(_ key: DayMacro) -> (name: String, unit: String) {
        switch key {
        case .kcal: ("kcal", "")
        case .protein: ("fehérje", "g")
        case .carbs: ("szénhidrát", "g")
        case .fat: ("zsír", "g")
        }
    }

    private func dayBar(_ row: DayImpactRow) -> some View {
        let (name, unit) = Self.label(row.key)
        let after = Int(row.after.rounded()), eaten = Int(row.eaten.rounded())
        let over = row.target.map { row.after > $0 } ?? false
        // without a target (kímélő day) the bar is scaled to the serving's end point, so it still shows the share
        let scale = row.target ?? max(row.after, 1)
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2)) : AnyLayout(HStackLayout(alignment: .firstTextBaseline))
        return VStack(alignment: .leading, spacing: 5) {
            layout {
                Text(name).nkFont(13, .medium).foregroundStyle(.white.opacity(0.8))
                if !typeSize.isAccessibilitySize { Spacer() }
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(huInt(eaten)) →").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                    Text(huInt(after)).font(.custom(Lagy.outfitFamily, size: 15).weight(.medium)).foregroundStyle(.white)
                    if let t = row.target {
                        Text(over ? "· \(huInt(after - Int(t.rounded()))) \(unit.isEmpty ? name : unit) felett"
                                  : "/ \(huInt(Int(t.rounded())))\(unit.isEmpty ? "" : " \(unit)")")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                    } else if !unit.isEmpty {
                        Text(unit).nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                    }
                }
            }
            GeometryReader { g in
                let w = g.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(EtelPalette.dayMacro(row.key)).frame(width: w * min(1, row.after / scale))
                    Capsule().fill(EtelPalette.eatenGrey).frame(width: w * min(1, row.eaten / scale))
                }
            }
            .frame(height: 9)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.target.map { t in
            over ? "\(name): eddig \(eaten), ezzel \(after), \(after - Int(t.rounded())) \(unit.isEmpty ? "kcal" : unit) a cél felett"
                 : "\(name): eddig \(eaten), ezzel \(after), a cél \(Int(t.rounded()))"
        } ?? "\(name): eddig \(eaten), ezzel \(after)")
    }

    private func legend(_ c: Color, _ t: String) -> some View {
        HStack(spacing: 5) { Capsule().fill(c).frame(width: 12, height: 5); Text(t).nkFont(11).foregroundStyle(.white.opacity(0.5)) }
    }

    // MARK: tiles

    private func tiles(_ b: MealBreakdown, weakest: String?, strongest: String?) -> some View {
        let perRow = typeSize.isAccessibilitySize ? 2 : 4
        let rows = stride(from: 0, to: b.dimensions.count, by: perRow).map { Array(b.dimensions[$0..<min($0 + perRow, b.dimensions.count)]) }
        return EtelSheetCard(label: "MIBŐL ÁLL ÖSSZE") {
            VStack(spacing: 10) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(alignment: .top, spacing: 8) {
                        ForEach(row, id: \.id) { tile($0, isWeak: $0.id == weakest, isStrong: $0.id == strongest) }
                        ForEach(0..<(perRow - row.count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity) }
                    }
                }
            }
            Text("Koppints egy szempontra, és részletesen elmondom, miért annyi.").nkFont(12).foregroundStyle(.white.opacity(0.45))
        }
    }

    private func tile(_ d: ScoreDimension, isWeak: Bool, isStrong: Bool) -> some View {
        let c = EtelPalette.dimension(d.id)
        return Button { onOpen(d) } label: {
            VStack(spacing: 6) {
                ZStack {
                    Circle().fill(c.opacity(0.18)).frame(width: 34, height: 34)
                    NKGlyph(RecipeDimensionLook.glyph(d.id), c, size: 17)
                }
                Text(d.points.map(String.init) ?? "—").font(.custom(Lagy.outfitFamily, size: 19).weight(.medium)).foregroundStyle(.white)
                ScoreBar(fraction: Double(d.points ?? 0) / 100, color: c, height: 4).padding(.horizontal, 6)
                Text(RecipeDimensionLook.short(d)).nkFont(10).foregroundStyle(.white.opacity(0.6)).lineLimit(2)
                    .multilineTextAlignment(.center).minimumScaleFactor(0.8).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 10).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.04)))
            .overlay(alignment: .topTrailing) {
                if isWeak { Circle().fill(EtelPalette.amber).frame(width: 8, height: 8).padding(7) }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(d.label), \(d.points.map(String.init) ?? "nincs adat")\(isWeak ? ", leggyengébb" : isStrong ? ", legerősebb" : "")")
        .accessibilityHint("Megnyitja a részleteket")
    }

    // MARK: rank

    private func rankCard(_ rank: RecipeRank) -> some View {
        EtelSheetCard(label: "A RECEPTJEID KÖZÖTT") {
            RankStrip(count: rank.of, mine: rank.stripIndex, label: "A \(rank.of) recepted közül a \(rank.position). legjobb")
            HStack(alignment: .top, spacing: 10) {
                fact("\(rank.position).", "legjobb pontszám\na \(rank.of) receptedből")
                if let s = rank.standout {
                    fact("\(s.position).", "\(["fehérjében", "szénhidrátban", "zsírban"][[DayMacro.protein, .carbs, .fat].firstIndex(of: s.macro) ?? 0])\negy adagra")
                }
            }
            if let logs, let line = recipeEatenLine(logs: logs) {
                Text(line.prefix(1).uppercased() + line.dropFirst()).nkFont(13).foregroundStyle(.white.opacity(0.65))
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

    private func tipsCard(_ b: MealBreakdown) -> some View {
        EtelSheetCard(label: "ÍGY LENNE JOBB") {
            ForEach(Array(b.improve.enumerated()), id: \.offset) { _, tip in
                RecipeTipRow(tip: tip, liftsLabel: tip.dimension.flatMap { id in b.dimensions.first { $0.id == id }?.label })
            }
        }
    }

    private var feedback: some View {
        HStack(spacing: 10) {
            Text("Hasznos volt ez az értékelés?").nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 4)
            voteButton("Igen", value: true)
            voteButton("Nem", value: false)
        }
        .padding(16).nkGlass()
    }

    private func voteButton(_ title: String, value: Bool) -> some View {
        let on = vote == value
        return Button { onVote(on ? nil : value) } label: {
            Text(title).nkFont(13, .semibold).foregroundStyle(on ? NK.ground : .white).padding(.horizontal, 16).frame(minHeight: 36)
                .background(Capsule().fill(on ? Color.white.opacity(0.92) : .clear))
                .overlay(Capsule().stroke(.white.opacity(on ? 0 : 0.35)))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// One tip: the honey spark, the text, the dimension it lifts and its impact tag.
struct RecipeTipRow: View {
    let tip: MealImprove
    let liftsLabel: String?
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack { Circle().fill(EtelPalette.honey.opacity(0.16)).frame(width: 30, height: 30); NKGlyph("spark-cream", EtelPalette.honey, size: 15) }
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text(tip.text).nkFont(14.5).lineSpacing(2).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                if liftsLabel != nil || !tip.impact.isEmpty {
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        if let liftsLabel { EtelPill(text: liftsLabel, tone: .hue) }
                        if !tip.impact.isEmpty { EtelPill(text: tip.impact) }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// A thin rounded bar filled to `fraction`.
struct ScoreBar: View {
    let fraction: Double
    let color: Color
    var height: CGFloat = 6
    var body: some View {
        Capsule().fill(.white.opacity(0.1)).frame(height: height)
            .overlay(alignment: .leading) {
                GeometryReader { g in Capsule().fill(color).frame(width: g.size.width * min(1, max(0, fraction))) }
            }
    }
}

/// One petal per dimension: length = its points, each in its dimension's colour, a degraded one a faint stub; the score
/// in the centre.
struct Rosette: View {
    let dims: [ScoreDimension]
    let score: Int
    var body: some View {
        GeometryReader { g in
            let c = CGPoint(x: g.size.width / 2, y: g.size.height / 2)
            let r = min(g.size.width, g.size.height) / 2
            ZStack {
                Circle().stroke(.white.opacity(0.08), lineWidth: 1).frame(width: r * 2, height: r * 2)
                ForEach(Array(dims.enumerated()), id: \.offset) { i, d in
                    let angle = Angle.degrees(Double(i) / Double(max(dims.count, 1)) * 360 - 90)
                    let len = r * (0.3 + 0.7 * Double(d.points ?? 0) / 100)
                    let col = EtelPalette.dimension(d.id)
                    Petal()
                        .fill(d.points == nil ? AnyShapeStyle(Color.white.opacity(0.08))
                              : AnyShapeStyle(LinearGradient(colors: [col.opacity(0.35), col], startPoint: .bottom, endPoint: .top)))
                        .frame(width: r * 0.42, height: len)
                        .offset(y: -len / 2)
                        .rotationEffect(angle + .degrees(90))
                        .position(c)
                }
                Circle().fill(NK.ground).frame(width: r * 0.7, height: r * 0.7)
                // the disc is a fixed 128 pt drawing: the number stays inside it (VoiceOver reads it from the label)
                Text("\(score)").font(.custom(Lagy.outfitFamily, size: 30, relativeTo: .title).weight(.light)).foregroundStyle(.white)
                    .dynamicTypeSize(...DynamicTypeSize.xxLarge)
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

/// Every scored recipe as a dot on one line, best on the right; this one lit and labelled.
private struct RankStrip: View {
    let count: Int
    let mine: Int
    let label: String
    @ScaledMetric(relativeTo: .caption2) private var wordRow: CGFloat = 14
    var body: some View {
        // stacked (word row · dots · word row) so the words grow with the text size, never over the facts below
        VStack(spacing: 4) {
            GeometryReader { g in
                Text("ez").nkFont(10.5, .semibold).foregroundStyle(EtelPalette.main).fixedSize()
                    .position(x: x(mine, g.size.width), y: g.size.height / 2)
            }
            .frame(height: wordRow)
            GeometryReader { g in
                ZStack(alignment: .topLeading) {
                    Capsule().fill(.white.opacity(0.08)).frame(height: 2).offset(y: 7)
                    ForEach(0..<count, id: \.self) { i in
                        Circle().fill(i == mine ? EtelPalette.main : Color.white.opacity(0.28))
                            .frame(width: i == mine ? 16 : 6, height: i == mine ? 16 : 6)
                            .position(x: x(i, g.size.width), y: 8)
                    }
                }
            }
            .frame(height: 16)
            HStack {
                Text("gyengébb")
                Spacer()
                Text("jobb")
            }
            .nkFont(10).foregroundStyle(.white.opacity(0.35))
        }
        .accessibilityElement().accessibilityLabel(label)
    }

    private func x(_ i: Int, _ w: CGFloat) -> CGFloat { min(max(w * Double(i) / Double(max(count - 1, 1)), 8), w - 8) }
}
