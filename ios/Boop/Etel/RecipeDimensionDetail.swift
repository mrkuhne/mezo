import SwiftUI
import BoopCore
import BoopDesign

// One dimension of the recipe evaluation in full (mezo-r36n9.199, spec §5.4.4): rises from the bottom over the blurred
// recipe sheet. MIT MÉR (fixed copy) · MIÉRT ENNYI (the AI paragraph, else the engine's sentence) · A SZÁMOK (the
// envelope's own payload) · HONNAN JÖN (per-ingredient, computed on the server) · ÍGY JAVÍTHATÓ (tips for this one).

/// What each template dimension measures — fixed copy, the same for every recipe.
func recipeDimensionMeasures(_ id: String) -> String {
    switch id {
    case "macro": "Hogyan oszlik meg egy adag energiája fehérje, szénhidrát és zsír között a célarányaidhoz képest. A több fehérje nem jár levonással."
    case "micro": "Mennyi rost jut egy adagba az étkezésre eső keretből."
    case "who": "A WHO ajánlásai szerint: a cukor legfeljebb az energia 10%-a legyen, a só pedig férjen bele az étkezésre jutó keretbe."
    case "fat_quality": "Mennyi a telített zsír: legfeljebb az energia 10%-a legyen, és a zsírnak minél kisebb része legyen telített."
    case "nova": "A kalóriák mekkora része jön alig feldolgozott alapanyagból, és mennyi ultra-feldolgozott tételből."
    case "plant_diversity": "Hány különböző növényi csoport van a receptben — a cél legalább három."
    case "energy_density": "Hány kcal jut 100 grammra: a kisebb sűrűségű étel jobban laktat ugyanannyi kalóriából."
    case "portion": "Egy adag mekkora része az étkezésre jutó keretnek — túl nagy vagy túl kicsi-e."
    default: "Egy szempont a recept pontszámában."
    }
}

/// „0,9 g só" / „300 kcal".
func contributorAmount(_ c: Contributor) -> String {
    let noun = ["salt": " só", "sugar": " cukor", "saturated_fat": " telített zsír", "fiber": " rost"][c.nutrient] ?? ""
    return "\(huNumber((c.amount * 10).rounded() / 10)) \(c.unit)\(noun)"
}

struct RecipeDimensionDetail: View {
    let dimension: ScoreDimension
    let isWeak: Bool
    let isStrong: Bool
    let tips: [MealImprove]
    let close: () -> Void

    private var c: Color { EtelPalette.dimension(dimension.id) }
    private var d: ScoreDimension { dimension }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule().fill(.white.opacity(0.3)).frame(width: 38, height: 5).frame(maxWidth: .infinity).padding(.top, 10)
                .accessibilityHidden(true)
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    ScoreBar(fraction: Double(d.points ?? 0) / 100, color: c, height: 10)
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        if isWeak { EtelPill(text: "a recept leggyengébb pontja", tone: .warn) }
                        if isStrong { EtelPill(text: "a recept legerősebb pontja", tone: .hue) }
                        if d.weight > 0 { EtelPill(text: "súlya a pontszámban \(Int((d.weight * 100).rounded()))%") }
                        if let cov = d.coverage { EtelPill(text: "az adag \(Int((cov * 100).rounded()))%-át láttam") }
                    }
                    block("MIT MÉR", recipeDimensionMeasures(d.id))
                    block("MIÉRT ENNYI", d.points == nil
                          ? "Még tanulom: ennél a receptnél nincs elég adat hozzá, a pontszám nélküle számol."
                          : d.detail)
                    if d.points != nil, hasNumbers { numbers }
                    if d.points != nil, !d.contributors.isEmpty { sources }
                    if !tips.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            NKMono("ÍGY JAVÍTHATÓ")
                            ForEach(Array(tips.enumerated()), id: \.offset) { _, tip in
                                HStack(alignment: .top, spacing: 10) {
                                    NKGlyph("spark-cream", EtelPalette.honey, size: 15).padding(.top, 2).accessibilityHidden(true)
                                    Text(tip.text).nkFont(14.5).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                    if let note = d.note, !note.isEmpty {
                        block("BOOP MEGJEGYZÉSE", note)
                    }
                    Button(action: close) {
                        Text("Kész").nkFont(15, .semibold).foregroundStyle(NK.ground)
                            .frame(maxWidth: .infinity, minHeight: 48).background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain)
                }
                .padding(22).padding(.bottom, 20)
            }
            .scrollIndicators(.hidden)
        }
        .frame(maxHeight: 720)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32, style: .continuous)
                .fill(NK.ground.opacity(0.94))
                .overlay(alignment: .top) {
                    LinearGradient(colors: [c.opacity(0.22), .clear], startPoint: .top, endPoint: .center)
                        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32, style: .continuous))
                }
        )
        .ignoresSafeArea(edges: .bottom)
        .accessibilityAddTraits(.isModal)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            ZStack { Circle().fill(c.opacity(0.2)).frame(width: 54, height: 54); NKGlyph(RecipeDimensionLook.glyph(d.id), c, size: 26) }
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                NKMono("EGY SZEMPONT")
                Text(d.label).nkFont(24, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 4)
            Text(d.points.map(String.init) ?? "—").font(.custom(Lagy.outfitFamily, size: 40).weight(.light))
                .foregroundStyle(isWeak ? EtelPalette.amber : .white)
        }
        .accessibilityElement(children: .combine)
    }

    private func block(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NKMono(label)
            Text(text).nkFont(15).lineSpacing(3.5).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: A SZÁMOK

    private var hasNumbers: Bool { d.macro != nil || !d.micros.isEmpty || d.nova != nil || !d.context.isEmpty }

    private var numbers: some View {
        VStack(alignment: .leading, spacing: 12) {
            NKMono("A SZÁMOK")
            if let m = d.macro {
                fact("Fehérje", "\(Int((m.ratioP * 100).rounded()))%", "cél \(m.targetP)", m.ratioP)
                fact("Szénhidrát", "\(Int((m.ratioC * 100).rounded()))%", "cél \(m.targetC)", m.ratioC)
                fact("Zsír", "\(Int((m.ratioF * 100).rounded()))%", "cél \(m.targetF)", m.ratioF)
            }
            ForEach(Array(d.micros.enumerated()), id: \.offset) { _, row in
                // limit rows (sugar/salt/sat fat) report "low" when over the allotment
                fact(row.name, row.value, "a keret \(row.pct)%-a", Double(row.pct) / 100, over: row.status == "low" && row.pct > 100)
            }
            if let n = d.nova {
                ForEach(Array(n.stack.enumerated()), id: \.offset) { _, s in
                    fact("NOVA \(s.nova) · \(s.label)", "\(s.pct)%", "", Double(s.pct) / 100)
                }
            }
            ForEach(Array(d.context.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .firstTextBaseline) {
                    Text(row.label).nkFont(14, .medium).foregroundStyle(.white)
                    Spacer()
                    Text(row.value).nkFont(14).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.trailing)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.05)))
    }

    private func fact(_ name: String, _ value: String, _ ref: String, _ fraction: Double, over: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(name).nkFont(14, .medium).foregroundStyle(.white)
                Spacer()
                Text(value).font(.custom(Lagy.outfitFamily, size: 17).weight(.medium)).foregroundStyle(.white)
                if !ref.isEmpty { Text(ref).nkFont(12).foregroundStyle(.white.opacity(0.5)) }
                if over { EtelPill(text: "felett", tone: .warn) }
            }
            ScoreBar(fraction: fraction, color: over ? EtelPalette.amber : c, height: 7)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: HONNAN JÖN

    private var sources: some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("HONNAN JÖN")
            ForEach(Array(d.contributors.enumerated()), id: \.offset) { _, src in
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) {
                        Text(src.name).nkFont(14).foregroundStyle(.white.opacity(0.85)).frame(width: 96, alignment: .leading).lineLimit(2)
                        ScoreBar(fraction: src.share, color: c.opacity(0.85), height: 7)
                        Text(contributorAmount(src)).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize()
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(src.name).nkFont(14).foregroundStyle(.white.opacity(0.85))
                            Spacer()
                            Text(contributorAmount(src)).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                        }
                        ScoreBar(fraction: src.share, color: c.opacity(0.85), height: 7)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(src.name): \(contributorAmount(src)), az összes \(Int((src.share * 100).rounded())) százaléka")
            }
        }
    }
}
