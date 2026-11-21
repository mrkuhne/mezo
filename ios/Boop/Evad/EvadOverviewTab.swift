import SwiftUI
import BoopCore
import BoopDesign

/// The Évad tab (screens 01–04): the system, the course, the plan, how it is going, what Boop noticed, what comes next.
/// Every block is drawn from the server's overview; a block whose data is null is left out, never filled in.
struct EvadOverviewTab: View {
    let o: EvadOverview
    /// "5 órás adat" while a cached overview is on screen.
    let ageText: String?
    let offline: Bool
    let open: @MainActor @Sendable (EvadSub) -> Void

    private var trajectory: String { o.head.trajectory }

    var body: some View {
        NKBare("Mi mire hat", hue: evadHue, glyph: "link-deep", trailing: "koppints rá") {
            EvadSystemMap(o: o)
        }
        .nkStale(ageText.map { NKStale(age: $0, loud: true) })
        weightBlock
        NKBare("Az évad terve", hue: evadHue, glyph: "star-ink") {
            NKRowList(planRows, hue: evadHue)
        }
        if let a = o.adherence, !evadAdherenceFacts(a).isEmpty || a.excusedDays > 0 {
            NKBare("Hogy megy", hue: evadHue, glyph: "check-ink", trailing: "az elmúlt héten") {
                let facts = evadAdherenceFacts(a)
                if !facts.isEmpty {
                    NKStatRow(facts.map { NKStat(value: $0.value, target: $0.target, label: $0.label) }, hue: evadHue)
                }
                Text(evadExcusedLine(a.excusedDays))
                    .nkFont(13).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            }
        }
        EvadTeher()
        if !o.insights.isEmpty {
            NKBare("Amit Boop észrevett", hue: evadHue, glyph: "spark-cream") {
                NKList(o.insights.prefix(3).map { (title: $0.title, body: $0.body) }, hue: evadHue)
            }
        }
        if !o.upcoming.isEmpty {
            NKBare("Következik", hue: evadHue, glyph: "clock-ink") {
                NKRowList(o.upcoming.map { u in
                    NKAreaRow(id: "\(u.kind)-\(u.week)", glyph: u.kind == "deload" ? "repeat-deep" : "star-ink",
                              title: "\(u.week). hét · \(u.kind == "deload" ? "könnyebb edzéshét" : "az évad vége")",
                              sub: u.text, state: .future, chips: u.kind == "deload" ? ["Boop javaslata"] : [])
                }, hue: evadHue)
            }
        }
        NKActions([offline
                   ? NKAction(glyph: "pen-sun", title: "Ehhez internet kell.", primary: true, action: {})
                   : NKAction(glyph: "pen-sun", title: "Módosítás", primary: true, action: { open(.modositas) }),
                   NKAction(glyph: "plus-ink", title: "Új évad", action: { open(.uj) })], hue: evadHue)
    }

    // MARK: Súly

    @ViewBuilder private var weightBlock: some View {
        let w = o.weight
        let values = (w.series + w.projection).map(\.kg)
        let band = w.band ?? o.pillars.weight.band
        let stats = weightStats
        if values.count > 1 || !stats.isEmpty {
            NKBare("Súly", hue: evadHue, glyph: "scale-ink", trailing: "\(o.head.weeks) hét") {
                if values.count > 1 {
                    // a maintain season has no target: its band's upper edge rides the curve's dashed line, so the
                    // curve scales to the whole band, and the overlay fills down to the lower edge
                    let target = trajectory == "maintain" ? band?.highKg : w.targetKg
                    let floor = (values + [target, band?.lowKg].compactMap { $0 }).min()! - 1
                    // the curve's own scale (NKCurve: the peak of the values and the target)
                    let peak = (values + [target].compactMap { $0 }).max()! - floor
                    let now = max(0, w.series.count - 1)
                    NKCurve(values: values.map { $0 - floor },
                            labels: curveLabels(count: values.count, now: now),
                            hue: evadHue, target: target.map { $0 - floor }, nowIndex: now, height: 140, planAfterNow: true)
                        .overlay(alignment: .top) {
                            if trajectory == "maintain", let band { bandOverlay(band, floor: floor, peak: peak) }
                        }
                }
                if !stats.isEmpty { NKStatRow(stats, hue: evadHue) }
            }
        }
    }

    /// The maintain season's band (±1 kg around the start), drawn on the curve's own scale instead of a target line.
    private func bandOverlay(_ band: EvadBand, floor: Double, peak: Double) -> some View {
        Canvas { ctx, s in
            let k = 0.94 / max(0.0001, peak)
            func y(_ v: Double) -> CGFloat { s.height - 6 - (s.height - 14) * CGFloat(min(1, (v - floor) * k)) }
            let top = y(band.highKg), bottom = y(band.lowKg)
            ctx.fill(Path(CGRect(x: 0, y: top, width: s.width, height: max(1, bottom - top))), with: .color(.white.opacity(0.06)))
            for edge in [top, bottom] {
                var d = Path(); d.move(to: CGPoint(x: 0, y: edge)); d.addLine(to: CGPoint(x: s.width, y: edge))
                ctx.stroke(d, with: .color(.white.opacity(0.4)), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
            }
        }
        .frame(height: 140)
        .allowsHitTesting(false)
    }

    /// "1." under the first point, the current week under "now", the last week under the end.
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

    private var planRows: [NKAreaRow] {
        let p = o.pillars
        var rows: [NKAreaRow] = []
        let sport = evadSportSummary(p.block.sport)
        let training = ["heti \(p.block.gymDays.count) edzés", sport.isEmpty ? nil : sport].compactMap { $0 }.joined(separator: " · ")
        // The Edzés row counts the gym (and block-run) sessions; sport has its own fact in Hogy megy. An older server
        // sends only the total.
        let done = o.adherence.map { a in
            a.trainingPlanned.map { "\(a.trainingDone ?? 0)/\($0)" } ?? "\(a.sessionsDone)/\(a.sessionsPlanned)"
        } ?? ""
        rows.append(NKAreaRow(id: "edzes", glyph: "dumbbell-ink", title: p.block.title.map { "Edzés · \($0)" } ?? "Edzés",
                              sub: training, value: done, valueSub: done.isEmpty ? "" : "az elmúlt héten"))
        if let food = evadFoodRow(p.food) {
            let n = p.food.allowedCount ?? 0
            rows.append(NKAreaRow(id: "etel", glyph: "bowl-sage", title: food.title, sub: food.sub,
                                  value: n > 0 ? "\(n)" : "", valueSub: n > 0 ? "recept" : ""))
        }
        if let need = p.sleep.needMin {
            rows.append(NKAreaRow(id: "alvas", glyph: "moon-ink", title: "Alvás · \(evadHM(need))", sub: evadSleepSub(p.sleep) ?? "",
                                  value: p.sleep.avgMin.map(evadHM) ?? "", valueSub: p.sleep.avgMin == nil ? "" : "átlagod"))
        }
        rows.append(weightRow)
        return rows
    }

    private var weightRow: NKAreaRow {
        let w = o.pillars.weight
        let delta = w.deltaKg.map(evadSignedKg) ?? ""
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
        return NKAreaRow(id: "suly", glyph: "scale-ink", title: title, sub: sub, value: delta, valueSub: delta.isEmpty ? "" : "kg eddig")
    }
}
