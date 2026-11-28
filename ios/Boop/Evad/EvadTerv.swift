import SwiftUI
import BoopCore
import BoopDesign

/// Where a row of *Az évad terve* opens: training → Edzés, food → Étel, sleep → Alvás, weight → Súly.
func evadPlanRowTarget(_ key: String) -> BoopDestination {
    switch key {
    case "block": .room(RoomEntry(.mozgas))
    case "food": .room(RoomEntry(.fuel))
    case "sleep": .room(RoomEntry(.alvas))
    default: .room(RoomEntry(.suly))
    }
}

/// The system in one sentence (Terv › Mi mire hat).
let evadOneSentenceModel = "Az Évad mondja meg, mennyit és miért; az Étel, az Edzés és az Alvás szoba azt, mit csinálsz ma; a Súly szoba mutatja, mi lett belőle."

/// Évad › **Terv**: the year strip (tap → Edzés › Éves terv), the season's weeks, the goal, what drives what, the
/// season's plan per room, the rules, and Módosítás · Új évad.
struct EvadTerv: View {
    let o: EvadOverview
    let store: EvadStore
    let year: YearPlanModel?
    let open: @MainActor (EvadRoomSub) -> Void
    @Environment(\.openDestination) private var openDestination

    private var trajectory: String { o.head.trajectory }
    private var plan: WireYearPlan? {
        if case .ready(let p, _) = year?.phase { return p }
        return nil
    }

    var body: some View {
        yearCard
        let cells = evadSeasonWeeks(o)
        if !cells.isEmpty {
            EvadCard("Az évad hetei", glyph: "evad-ink", trailing: "\(o.head.week) / \(o.head.weeks)") {
                EvadSeasonWeeksView(cells: cells, endDate: o.season.endDate)
            }
        }
        goalCard
        EvadCard("Mi mire hat", glyph: "cycle-ink", action: { open(.map) }) {
            HStack(spacing: 14) {
                EvadMapMark().frame(width: 96, height: 96)
                Text("Az Évad mondja meg, mennyit és miért; a szobák azt, mit csinálsz ma; a Súly, mi lett belőle.")
                    .nkFont(14.5, design: .serif).foregroundStyle(.white.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        EvadCard("Az évad terve", glyph: "terv-ink") {
            VStack(spacing: 14) {
                ForEach(planRows, id: \.key) { r in
                    EvadRow(glyph: r.glyph, title: r.title, sub: r.sub, value: r.value,
                            action: { openDestination(evadPlanRowTarget(r.key)) })
                }
            }
        }
        NKInfoRow("Szabályok — menünap, feldolgozott étel, könnyítő hetek", hue: evadHue) { open(.rules) }
        NKActions([store.offline
                   ? NKAction(glyph: "repeat-deep", title: "Ehhez internet kell.", primary: true, action: {})
                   : NKAction(glyph: "repeat-deep", title: "Módosítás", primary: true, action: { open(.whatIf) }),
                   NKAction(glyph: "plus-ink", title: "Új évad", action: { open(.newSeason) })], hue: evadHue)
    }

    // MARK: Az éved

    private var yearCard: some View {
        Button { openDestination(.room(RoomEntry(.mozgas, sub: "evesterv"))) } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    NKMono(plan == nil ? "AZ ÉVAD" : "AZ ÉVED")
                    Spacer()
                    Text("Edzés › Éves terv").nkFont(12).foregroundStyle(.white.opacity(0.55))
                    Image(systemName: "chevron.right").nkFont(11, .semibold).foregroundStyle(.white.opacity(0.4))
                }
                EvadYearStrip(o: o, plan: plan, today: evadYMD(BoopClock.now()))
                EvadText(yearSentence, size: 13.5)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .nkGlass()
            .contentShape(RoundedRectangle(cornerRadius: 26))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Megnyitja az éves tervet az Edzés szobában")
    }

    private var yearSentence: String {
        if let plan, let b = evadSeasonBracket(plan: plan, seasonStart: o.season.startDate, seasonEnd: o.season.endDate) {
            let now = evesWeek(of: evadYMD(BoopClock.now()), start: plan.startDate).map { "; most a \($0). hétnél jársz" } ?? ""
            return "Az évad az éved \(b.lowerBound). hetétől a \(b.upperBound).-ig tart\(now)."
        }
        return "Még nincs éves terved — az évad \(o.head.weeks) hetét látod. Éves tervet az Edzés szobában készíthetsz."
    }

    // MARK: A cél

    @ViewBuilder private var goalCard: some View {
        let w = o.weight
        let values = (w.series + w.projection).map(\.kg)
        let band = w.band ?? o.pillars.weight.band
        let stats = weightStats
        if values.count > 1 || !stats.isEmpty {
            EvadCard("A cél", glyph: "scale-ink", trailing: "Súly szoba", action: { openDestination(.room(RoomEntry(.suly))) }) {
                VStack(alignment: .leading, spacing: 12) {
                    if values.count > 1 {
                        // a maintain season has no target: its band's upper edge rides the curve's dashed line
                        let target = trajectory == "maintain" ? band?.highKg : w.targetKg
                        let floor = (values + [target, band?.lowKg].compactMap { $0 }).min()! - 1
                        let now = max(0, w.series.count - 1)
                        NKCurve(values: values.map { $0 - floor }, labels: curveLabels(count: values.count, now: now),
                                hue: evadHue, target: target.map { $0 - floor }, nowIndex: now, height: 120, planAfterNow: true)
                    }
                    if !stats.isEmpty { NKStatRow(stats, hue: evadHue) }
                }
            }
        }
    }

    private func curveLabels(count: Int, now: Int) -> [String] {
        (0..<count).map { i in
            if i == 0 { return "1." }
            if i == count - 1 { return "\(o.head.weeks)." }
            if i == now { return "\(o.head.week)." }
            return ""
        }
    }

    private var weightStats: [NKStat] {
        let w = o.weight
        var out: [NKStat] = []
        if let trend = w.trendKg {
            let delta = o.pillars.weight.deltaKg ?? 0
            out.append(NKStat(value: evadKg(trend), unit: "kg", label: "most (trend)",
                              trend: delta < -0.05 ? -1 : (delta > 0.05 ? 1 : 0), hot: true))
        }
        if trajectory == "maintain" {
            if let band = w.band ?? o.pillars.weight.band {
                out.append(NKStat(value: "\(evadKg(band.lowKg))–\(evadKg(band.highKg))", unit: "kg", label: "a sáv"))
            }
        } else {
            if let target = w.targetKg { out.append(NKStat(value: evadKg(target), unit: "kg", label: "cél")) }
            if let pace = w.kgPerWeek, (abs(pace) * 100).rounded() > 0 {
                let what = trajectory == "bulk" ? "heti hízás" : "heti fogyás"
                out.append(NKStat(value: evadKg(abs(pace)), unit: "kg",
                                  label: [what, evadPaceWord(w.paceVerdict)].compactMap { $0 }.joined(separator: " · ")))
            }
        }
        return out
    }

    // MARK: Az évad terve

    private struct PlanRow { let key, glyph, title, sub, value: String }

    private var planRows: [PlanRow] {
        let p = o.pillars
        var rows: [PlanRow] = []
        let sport = evadSportSummary(p.block.sport)
        let training = ["heti \(p.block.gymDays.count) edzés", sport.isEmpty ? nil : sport].compactMap { $0 }.joined(separator: " · ")
        rows.append(PlanRow(key: "block", glyph: "dumbbell-ink", title: p.block.title.map { "Edzés · \($0)" } ?? "Edzés",
                            sub: training, value: "Edzés"))
        if let food = evadFoodRow(p.food) {
            rows.append(PlanRow(key: "food", glyph: "bowl-cream", title: food.title, sub: food.sub, value: "Étel"))
        }
        if let need = p.sleep.needMin {
            rows.append(PlanRow(key: "sleep", glyph: "moon-cream", title: "Alvás · \(evadHM(need))", sub: evadSleepSub(p.sleep) ?? "",
                                value: "Alvás"))
        }
        rows.append(weightRow)
        return rows
    }

    private var weightRow: PlanRow {
        let w = o.pillars.weight
        let title: String
        let sub: String
        switch trajectory {
        case "maintain":
            title = (w.band ?? o.weight.band).map { "Súly · \(evadBandText($0)) között" } ?? "Súly"
            sub = "a súlyod tartása, miközben erősödsz"
        default:
            let target = w.targetKg.map { "\(evadKg($0)) kg" }
            let date = w.targetDate.map(evadShortDate)
            let parts = [target, date].compactMap { $0 }.joined(separator: ", ")
            title = parts.isEmpty ? "Súly" : "Súly · \(parts)"
            sub = trajectory == "bulk" ? "izomépítés úgy, hogy közben ne hízz túl" : "fogyás úgy, hogy az erőd megmaradjon"
        }
        return PlanRow(key: "weight", glyph: "scale-ink", title: title, sub: sub, value: "Súly")
    }
}

/// The season's weeks 1…N: done, this one, a lighter week with its reason, the end.
struct EvadSeasonWeeksView: View {
    let cells: [EvadWeekCell]
    let endDate: String
    private let light = Color(hex: 0x9FC7D6)

    var body: some View {
        let current = cells.first(where: \.current)?.week ?? 0
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: cells.count > 14 ? 2 : 4) {
                ForEach(cells, id: \.week) { c in
                    VStack(spacing: 6) {
                        cell(c, current: current)
                        Text("\(c.week)").nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(c.current ? 1 : 0.5))
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            ForEach(cells.filter(\.lighter), id: \.week) { c in
                HStack(spacing: 8) {
                    Circle().fill(light).frame(width: 8, height: 8)
                    Text("\(c.week). hét könnyebb\(c.reason.map { " — \($0)" } ?? "")").nkFont(12.5).foregroundStyle(.white.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: 8) {
                NKGlyph("terv-ink", .white.opacity(0.7), size: 12)
                Text("Az évad vége: \(evadShortDate(endDate))").nkFont(12.5).foregroundStyle(.white.opacity(0.7))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken(current))
    }

    private func spoken(_ current: Int) -> String {
        var s = "Az évad \(cells.count) hete: \(max(0, current - 1)) kész, most a \(current). hét"
        for c in cells where c.lighter { s += ", a \(c.week). hét könnyebb" }
        return s + ", vége \(evadShortDate(endDate))"
    }

    @ViewBuilder private func cell(_ c: EvadWeekCell, current: Int) -> some View {
        let shape = RoundedRectangle(cornerRadius: 6, style: .continuous)
        if c.week < current {
            shape.fill(LinearGradient(colors: [evadHue.orb[2], evadHue.orb[1]], startPoint: .top, endPoint: .bottom)).frame(height: 34)
        } else if c.current {
            shape.stroke(.white, lineWidth: 2).frame(height: 34).overlay(shape.fill(evadHue.glow.opacity(0.35)).padding(3))
        } else if c.lighter {
            shape.fill(light.opacity(0.35)).frame(height: 22).overlay(shape.stroke(light, lineWidth: 1)).frame(height: 34, alignment: .bottom)
        } else if c.last {
            shape.stroke(.white.opacity(0.35), style: StrokeStyle(lineWidth: 1.2, dash: [3, 3])).frame(height: 34)
                .overlay(NKGlyph("terv-ink", .white.opacity(0.75), size: 13))
        } else {
            shape.stroke(.white.opacity(0.25), style: StrokeStyle(lineWidth: 1.2, dash: [3, 3])).frame(height: 34)
        }
    }
}

/// Évad › Terv › **Mi mire hat**: the live system map and the one-sentence model.
struct EvadMapPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad › Terv", eyebrow: "Mi mire hat", title: "Hogyan függ össze minden",
                      sentence: "Egy kép arról, hogy az évad hogyan jut el a tányérodig, az edzésedig és az ágyadig.", onBack: close) {
            if let o = store?.overview {
                NKBare("A rendszer", hue: evadHue, glyph: "cycle-ink", trailing: "koppints rá") { EvadSystemMap(o: o) }
            }
            VStack(alignment: .leading, spacing: 10) {
                NKMono("EGY MONDATBAN")
                Text(evadOneSentenceModel).nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            EvadCard("A rétegek", glyph: "terv-ink") {
                VStack(spacing: 14) {
                    EvadRow(glyph: "terv-ink", title: "Év", sub: "52 hét blokkokban — az Edzés › Éves tervben szerkeszted")
                    EvadRow(glyph: "evad-ink", title: "Évad", sub: "néhány hét: a cél, a futó blokk, étel, alvás")
                    EvadRow(glyph: "het-ink", title: "Hét", sub: "vasárnap este a heti átnézés")
                    EvadRow(glyph: "sun-ink", title: "Nap", sub: "a szobák: mit csinálsz ma")
                }
            }
        }
    }
}
