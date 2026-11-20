#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (mezo-r36n9.113): screens 5–7 — creating the year plan, the year map with a block's detail sheet,
// and the „Következik" card in the Edzés room.

// MARK: - The 52-week strip

/// The year as 52 thin columns on one line: upper-body blocks rise above it, leg blocks hang below it — so the
/// alternation reads without a second colour. Each block climbs for five weeks; its sixth, light week is drawn hollow.
/// The two buffer weeks are dots on the line; the closing two weeks are short marks on both sides (every muscle
/// held, lightly).
struct ETYearStrip: View {
    let blocks: [ETYearBlock]
    /// nil = a preview: nothing is behind him yet.
    let current: Int?
    private let half: CGFloat = 34

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let current {
                GeometryReader { geo in
                    let x = geo.size.width * (CGFloat(current) - 0.5) / 52
                    Text("ITT TARTASZ · \(current). HÉT").nkFont(9, .semibold, design: .monospaced).tracking(1.1)
                        .foregroundStyle(planHue.glow).fixedSize()
                        .position(x: min(max(x, 60), geo.size.width - 60), y: 6)
                }
                .frame(height: 12)
            }
            HStack(spacing: 1.5) {
                ForEach(1...52, id: \.self) { w in column(w) }
            }
            .frame(height: half * 2)
            .overlay { Rectangle().fill(.white.opacity(0.18)).frame(height: 1) }
            .overlay {
                if let current {
                    GeometryReader { geo in
                        let x = geo.size.width * (CGFloat(current) - 0.5) / 52
                        Rectangle().fill(planHue.glow).frame(width: 1.5, height: half * 2 + 10).position(x: x, y: half)
                    }
                }
            }
            GeometryReader { geo in
                ForEach([1, 14, 27, 40], id: \.self) { w in
                    Text(String(etDate(week: w).split(separator: " ").first ?? ""))
                        .nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.45)).fixedSize()
                        .position(x: geo.size.width * (CGFloat(w) - 1) / 52 + 14, y: 6)
                }
                Text("52").nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.45)).fixedSize()
                    .position(x: geo.size.width - 7, y: 6)
            }
            .frame(height: 12)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(current.map { "Az év 52 hete, a \($0). héten tartasz" } ?? "Az év 52 hete")
    }

    @ViewBuilder private func column(_ w: Int) -> some View {
        let b = blocks.first { w >= $0.firstWeek && w <= $0.lastWeek }
        let i = b.map { w - $0.firstWeek + 1 } ?? 1
        let style = fill(w, b)
        VStack(spacing: 0) {
            switch b?.kind {
            case .felso?:
                Spacer(minLength: 0)
                bar(i == 6 ? 0.42 : [0.5, 0.6, 0.7, 0.82, 0.95][i - 1], light: i == 6, style)
                Color.clear.frame(height: half)
            case .lab?:
                Color.clear.frame(height: half)
                bar(i == 6 ? 0.42 : [0.5, 0.6, 0.7, 0.82, 0.95][i - 1], light: i == 6, style)
                Spacer(minLength: 0)
            case .lezaras?:
                Spacer(minLength: 0)
                bar(0.28, light: false, style)
                bar(0.28, light: false, style)
                Spacer(minLength: 0)
            default:
                Spacer(minLength: 0)
                Circle().fill(style).frame(width: 3.5, height: 3.5)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func bar(_ load: CGFloat, light: Bool, _ style: Color) -> some View {
        RoundedRectangle(cornerRadius: 1.5)
            .fill(light ? .clear : style)
            .overlay { if light { RoundedRectangle(cornerRadius: 1.5).strokeBorder(style, lineWidth: 1) } }
            .frame(height: half * load)
    }

    private func fill(_ w: Int, _ b: ETYearBlock?) -> Color {
        guard let current else { return .white.opacity(0.5) }
        if w == current { return planHue.glow }
        if w < current { return .white.opacity(0.32) }
        if let b, case .running = b.status { return planHue.glow.opacity(0.4) }
        return .white.opacity(0.16)
    }
}

// MARK: - 5 · Éves terv létrehozása

struct ETCreateYearPage: View {
    let flow: ETFlow
    @State private var emphasis: Set<String> = ["Váll", "Vádli"]
    @State private var length = 6
    @State private var position = ScrollPosition()
    private let groups = ["Hát", "Mell", "Váll", "Bicepsz", "Tricepsz", "Comb", "Combhajlító", "Farizom", "Vádli"]

    var body: some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    ETHead(eyebrow: "ÉVES TERV · ÚJ", title: "Egy év, előre",
                           sentence: "Megmondom, melyik blokk mikor jön és mire figyel. A gyakorlatokat mindig a blokk indulásakor rakom össze, a friss állapotodból.") { flow.go(nil) }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Kezdés", trailing: "mindig hétfő")
                        HStack(spacing: 0) {
                            stepButton("chevron.left", "Egy héttel korábban")
                            Spacer(minLength: 4)
                            VStack(spacing: 1) {
                                Text("szept. 21.").nkFont(20, .medium).foregroundStyle(.white)
                                Text("2026 · hétfő").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                            }
                            Spacer(minLength: 4)
                            stepButton("chevron.right", "Egy héttel később")
                        }
                        .padding(6)
                        .background(Capsule().fill(.white.opacity(0.07)))
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Mit szeretnél idén jobban fejleszteni?")
                        NKFlowRow(spacing: 8, rowSpacing: 8) {
                            ForEach(groups, id: \.self) { g in
                                ETChip(text: g, on: emphasis.contains(g)) {
                                    if emphasis.contains(g) { emphasis.remove(g) } else { emphasis.insert(g) }
                                }
                            }
                        }
                        Text("Amit kiválasztasz, azt kétszer teszem fókuszba; minden más izom legalább egyszer.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Blokkhossz", trailing: "\(length - 1) + 1 könnyítő hét")
                        HStack(spacing: 6) {
                            ForEach(4...8, id: \.self) { w in
                                ETChoice(text: "\(w)", on: length == w, sub: "hét") { length = w }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        ETLabel("Így nézne ki", trailing: "52 hét")
                        VStack(alignment: .leading, spacing: 16) {
                            ETYearStrip(blocks: etYear, current: nil)
                            Text("felül a felsőtest-blokkok, alul a láb-blokkok · üres: könnyítő hét")
                                .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45)).fixedSize(horizontal: false, vertical: true)
                            VStack(spacing: 0) {
                                ForEach(etYear) { b in
                                    HStack(spacing: 10) {
                                        Text(b.ordinal.map { "\($0)" } ?? "·").nkFont(11, .semibold, design: .monospaced)
                                            .foregroundStyle(planHue.glow).frame(width: 16, alignment: .leading)
                                        Text(b.focus).nkFont(14).foregroundStyle(.white.opacity(0.9)).lineLimit(1).minimumScaleFactor(0.85)
                                        Spacer(minLength: 6)
                                        Text(etDate(week: b.firstWeek)).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5)).fixedSize()
                                    }
                                    .padding(.vertical, 7)
                                }
                            }
                        }
                        .padding(16)
                        .nkGlass(24)

                        HStack(alignment: .top, spacing: 10) {
                            PlanMark(.keep, color: planWarn, size: 16).padding(.top, 2)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Amit nem tudtam teljesen").nkFont(14, .semibold).foregroundStyle(.white)
                                Text("A vádlit csak egyszer tudtam fókuszba tenni (6. blokk): a négy láb-blokkban a comb, a combhajlító és a farizom is kétszer sorra kerül.")
                                    .nkFont(13).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
                    }
                }
                .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 30)
            }
            .scrollPosition($position)
            .scrollIndicators(.hidden)
            .modifier(ETInitialScroll(position: $position))
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ETBottomBar(title: "Elfogadom") { flow.go(.terkep) }
        }
    }

    private func stepButton(_ symbol: String, _ label: String) -> some View {
        Button {} label: {
            Image(systemName: symbol).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - 6 · Éves térkép

struct ETYearMapPage: View {
    let flow: ETFlow
    @State private var position = ScrollPosition()

    private var running: ETYearBlock? { etYear.first { if case .running = $0.status { true } else { false } } }
    private var next: ETYearBlock? { etYear.first { $0.status == .next } }

    var body: some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    ETHead(eyebrow: "ÉVES TERV · 2026/27", title: "\(etCurrentWeek). hét az 52-ből",
                           sentence: "Most a \(running?.focus ?? "") blokk fut. Következik a \(next?.focus ?? ""), \(etDateBare(week: next?.firstWeek ?? 1))-től.") { flow.go(nil) }

                    ETYearStrip(blocks: etYear, current: etCurrentWeek)
                        .padding(16)
                        .nkGlass(24)

                    VStack(alignment: .leading, spacing: 8) {
                        ETWhyLine(line: ETWhy(tone: .good, text: "Idén minden izom legalább egyszer fókuszba kerül; a vádli és a tricepsz egyszer, a többi kétszer."))
                        ETWhyLine(line: ETWhy(tone: .good, text: "Egy izom sosem kerül fókuszba két egymást követő blokkban."))
                        ETWhyLine(line: ETWhy(tone: .neutral, text: "A végén 2 hét könnyű szinten tartás, előtte 2 tartalék hét betegségre, nyaralásra."))
                    }
                    .padding(.horizontal, 4)

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Blokkok", trailing: "koppints egyre")
                        VStack(spacing: 0) {
                            ForEach(Array(etYear.enumerated()), id: \.element.id) { i, b in
                                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                                Button { if b.ordinal != nil { flow.sheetBlock = b.id } } label: { row(b) }
                                    .buttonStyle(.plain)
                                    .disabled(b.ordinal == nil)
                            }
                        }
                        .padding(.horizontal, 14).padding(.vertical, 4)
                        .nkGlass(24)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 40)
            }
            .scrollPosition($position)
            .scrollIndicators(.hidden)
            .modifier(ETInitialScroll(position: $position))
        }
        .sheet(item: Binding(get: { flow.sheetBlock.flatMap { id in etYear.first { $0.id == id } } },
                             set: { flow.sheetBlock = $0?.id })) { b in
            ETBlockSheet(block: b)
                .presentationDetents([.large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
    }

    private func row(_ b: ETYearBlock) -> some View {
        let isRunning: Bool = { if case .running = b.status { true } else { false } }()
        let done = b.status == .done
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(isRunning ? planHue.glow : .white.opacity(done ? 0.14 : 0.07))
                if done {
                    PlanMark(.check, color: .white.opacity(0.8), size: 13)
                } else if let o = b.ordinal {
                    Text("\(o)").nkFont(13, .semibold, design: .monospaced).foregroundStyle(isRunning ? NK.ground : .white.opacity(0.8))
                } else {
                    PlanMark(b.kind == .lezaras ? .keep : .feather, color: .white.opacity(0.6), size: 13)
                }
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(b.focus).nkFont(16, design: .serif).foregroundStyle(.white.opacity(done ? 0.6 : 1))
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(etRange(b)) · \(b.kindText)").nkFont(10.5, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 6)
            if b.ordinal != nil {
                Text(b.status.text).nkFont(11, .medium)
                    .foregroundStyle(isRunning ? NK.ground : (b.status == .next ? planHue.glow : .white.opacity(done ? 0.5 : 0.6)))
                    .lineLimit(1).fixedSize()
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(Capsule().fill(isRunning ? planHue.glow : .white.opacity(b.status == .next ? 0.1 : 0.05)))
            } else {
                Text("\(b.weeks) hét").nkFont(11, .medium).foregroundStyle(.white.opacity(0.5)).fixedSize()
            }
        }
        .padding(.vertical, 11)
        .contentShape(Rectangle())
    }
}

/// One block of the year: change its focus, move it, skip it — with what that costs.
struct ETBlockSheet: View {
    let block: ETYearBlock
    @State private var focus: Set<String> = ["Comb", "Vádli"]
    @Environment(\.dismiss) private var dismiss
    private var options: [String] { block.kind == .lab ? ["Comb", "Combhajlító", "Farizom", "Vádli"] : ["Hát", "Mell", "Váll", "Bicepsz", "Tricepsz"] }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(block.ordinal ?? 0). BLOKK · \(block.kindText) · \(block.status.text.uppercased())")
                            .nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
                        Text(block.focus).nkFont(30, design: .serif).foregroundStyle(.white)
                        Text("\(etRange(block)) · \(block.weeks) hét (\(block.weeks - 1) + 1 könnyítő)")
                            .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Fókusz", trailing: "legfeljebb kettő")
                        NKFlowRow(spacing: 8, rowSpacing: 8) {
                            ForEach(options, id: \.self) { g in
                                ETChip(text: g, on: focus.contains(g)) {
                                    if focus.contains(g) { focus.remove(g) } else if focus.count < 2 { focus.insert(g) }
                                }
                            }
                        }
                        Text("A fókusz Hangsúlyt kap, minden más Tartást: nullára egyik izom sem megy.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Időpont")
                        HStack(spacing: 8) {
                            moveButton(left: true, "Egy héttel előbb")
                            moveButton(left: false, "Egy héttel később")
                        }
                        Text("Ami utána jön, vele együtt mozog. A csúszást először a 2 tartalék hét nyeli el, a lezárás marad az év végén.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Kihagyás")
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top, spacing: 10) {
                                PlanMark(.flame, color: planWarn, size: 18).padding(.top, 1)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("A vádli idén nem kap fókuszt").nkFont(15, .semibold).foregroundStyle(planWarn)
                                    Text("Ha kihagyod ezt a blokkot, a vádlinak nem marad fókusz. Áttehetem a 8. blokkba a bicepsz helyére, vagy egész évben Tartáson marad.")
                                        .nkFont(13).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            Button {} label: {
                                Text("Kihagyom").nkFont(15, .semibold).foregroundStyle(planWarn)
                                    .padding(.horizontal, 22).frame(minHeight: 44)
                                    .background(Capsule().stroke(planWarn.opacity(0.6), lineWidth: 1))
                                    .contentShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
                    }
                }
                .padding(.horizontal, 22).padding(.top, 28).padding(.bottom, 20)
            }
            .scrollIndicators(.hidden)
            ETBottomBar(title: "Kész") { dismiss() }
        }
        .preferredColorScheme(.dark)
    }

    private func moveButton(left: Bool, _ title: String) -> some View {
        Button {} label: {
            HStack(spacing: 6) {
                if left { Image(systemName: "chevron.left").font(.system(size: 12, weight: .semibold)) }
                Text(title).nkFont(14, .medium).lineLimit(1).minimumScaleFactor(0.8)
                if !left { Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)) }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Capsule().fill(.white.opacity(0.1)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 7 · Következik, in the Edzés room

struct ETKovetkezikRoom: View {
    let flow: ETFlow
    @State private var tab = EdzesTab.ma.rawValue
    private let hue = Hue.mozgas
    private var next: ETYearBlock { etYear[2] }

    var body: some View {
        NKAreaPage(hue: hue, name: areaName(hue), eyebrow: areaEyebrow(hue, tab: tab),
                   level: 0.72, display: "72",
                   headline: "Könnyítő hét, a blokk vége",
                   sentence: "Kevesebb sorozat, hogy frissen kezdd a következő blokkot.",
                   photo: areaPhoto(hue), glyph: areaGlyph(hue),
                   tabs: EdzesTab.allCases.map { NKAreaTab($0.rawValue, badge: $0 == .ma ? 1 : 0) }, selectedTab: $tab,
                   onBack: { flow.go(nil) }) {
            nextCard
            today
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var nextCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Text("KÖVETKEZIK").nkFont(10, .medium, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                Text("· AZ ÉVES TERVBŐL").nkFont(10, .medium, design: .monospaced).tracking(1.4).foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(next.focus).nkFont(27, design: .serif).foregroundStyle(.white)
            Text("\(next.weeks) hét · \(etDateBare(week: next.firstWeek))-től · 3. blokk a 8-ból")
                .nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            Text("A Comb + farizom blokkod vasárnap ér véget. Most a mell és a váll kerül fókuszba, minden más Tartáson marad.")
                .nkFont(14).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
            NKBlockTimeline((1...6).map { NKBlockWeek(week: $0, load: [0.5, 0.6, 0.72, 0.84, 0.95, 0.4][$0 - 1],
                                                       phase: "", state: .future, isDeload: $0 == 6) },
                            hue: hue, caption: "5 terhelő hét + 1 könnyítő")
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                HStack(spacing: 6) { PlanTierPill(tier: .emphasize); Text("Mellkas, Váll").nkFont(12).foregroundStyle(.white.opacity(0.8)) }
                HStack(spacing: 6) { PlanTierPill(tier: .maintain); Text("a többi").nkFont(12).foregroundStyle(.white.opacity(0.8)) }
            }
            Button { flow.startFromMap() } label: {
                HStack(spacing: 8) {
                    NKGlyph("bolt-ink", NK.ground, size: 16)
                    Text("Indítás").nkFont(16, .semibold).foregroundStyle(NK.ground)
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Capsule().fill(hue.glow))
            }
            .buttonStyle(PressStyle())
            Button { flow.go(.terkep) } label: {
                HStack(spacing: 6) {
                    Text("Éves terv").nkFont(14, .medium)
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(.white.opacity(0.75))
                .frame(maxWidth: .infinity, minHeight: 36)
            }
            .buttonStyle(.plain)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
    }

    private var today: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("MA").nkFont(10, .medium, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
            Text("Alsó B · könnyítő").nkFont(24, design: .serif).foregroundStyle(.white)
            Text("12. hét · kb. 44 perc · 5 gyakorlat").nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
    }
}
#endif
