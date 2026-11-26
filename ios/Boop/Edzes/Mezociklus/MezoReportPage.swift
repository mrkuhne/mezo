import SwiftUI
import BoopCore
import BoopDesign

/// The zárójelentés as graphics (mezo-r36n9.177, spike `MezoReportSpike`): the frozen report the server wrote at the
/// close — planned against done per week, the adherence ring, strength up and down, his own words and Boop's, which
/// it polls for while Boop is still writing (stopped when the page goes).
struct MezoReportPage: View {
    let blockId: String
    let hue: Hue
    let onBack: () -> Void
    @State private var model: MezoReportModel

    init(blockId: String, plan: PlanClient, hue: Hue, onBack: @escaping () -> Void) {
        self.blockId = blockId
        self.hue = hue
        self.onBack = onBack
        _model = State(initialValue: MezoReportModel(client: plan))
    }

    var body: some View {
        let r = model.report
        NKAreaSubPage(hue: hue, crumb: "Mezociklusaim", eyebrow: eyebrow(r), title: r?.title ?? "Zárójelentés",
                      sentence: r.map(mezoReportSentence) ?? "", onBack: onBack) {
            switch model.phase {
            case .loading:
                HStack(spacing: 10) {
                    ProgressView().tint(.white)
                    Text("Betöltöm a zárójelentést…").nkFont(14).foregroundStyle(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
            case .failed(let e):
                NKBare("ZÁRÓJELENTÉS", hue: hue) {
                    VStack(alignment: .leading, spacing: 12) {
                        NKNoFreshData(MezociklusokModel.message(e))
                        MezoButton(title: "Újra", style: .secondary) { Task { await model.load(blockId: blockId) } }
                    }
                }
            case .ready:
                if let r { content(r) }
            }
        }
        .task { await model.load(blockId: blockId) }
        .onDisappear { model.stop() }
    }

    private func eyebrow(_ r: WireReport?) -> String {
        let range = mezoRangeText(r?.startDate, r?.endDate)
        return range.isEmpty ? "Zárójelentés" : "Zárójelentés · \(range)"
    }

    @ViewBuilder private func content(_ r: WireReport) -> some View {
        HStack(spacing: 18) {
            MezoRing(value: r.adherence?.completionPct.map { Double($0) / 100 }, hue: hue, size: 104)
            VStack(alignment: .leading, spacing: 12) {
                if let a = r.adherence, let done = a.completedSessions, let planned = a.plannedSessions {
                    stat("\(done)/\(planned)", "edzés kész")
                }
                stat("\(r.records?.medalCount ?? 0)", "új rekord")
            }
            Spacer(minLength: 0)
        }
        .padding(18).nkGlass(26)
        .accessibilityElement(children: .combine)

        let weeks = mezoReportWeeks(r)
        if !weeks.isEmpty {
            NKBare("A HETEK: TERV ÉS VALÓSÁG", hue: hue, glyph: "chart-deep") {
                weekBars(weeks)
            }
        }
        let lifts = (r.strength ?? []).filter { $0.deltaKg != nil }
        if !lifts.isEmpty {
            NKBare("ERŐ", hue: hue, glyph: "dumbbell-ink") {
                let top = lifts.compactMap { $0.deltaKg.map(abs) }.max() ?? 1
                let medals = Set((r.records?.top ?? []).map(\.exerciseName))
                VStack(spacing: 12) {
                    ForEach(Array(lifts.prefix(6).enumerated()), id: \.offset) { _, s in
                        gain(s, top: top, record: medals.contains(s.exerciseName))
                    }
                }
            }
        }
        if let own = r.selfEval?.trimmingCharacters(in: .whitespacesAndNewlines), !own.isEmpty {
            NKBare("A TE ÉRTÉKELÉSED", hue: hue, glyph: "pen-sun") {
                Text(own).nkFont(15).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        NKBare("BOOP ÉRTÉKELÉSE", hue: hue, glyph: "chat-ink") {
            Group {
                switch model.aiState {
                case .pending:
                    HStack(spacing: 10) {
                        ProgressView().tint(.white)
                        Text("Boop még írja, pár perc…").nkFont(14).foregroundStyle(.white.opacity(0.7))
                    }
                case .ready(let text):
                    Text(text).nkFont(15).foregroundStyle(.white.opacity(0.88))
                case .off:
                    Text("Boop értékelése ki van kapcsolva, ezért ehhez nem írt.").nkFont(14).foregroundStyle(.white.opacity(0.6))
                case .failed:
                    Text("Boop most nem tudta megírni az értékelést.").nkFont(14).foregroundStyle(.white.opacity(0.6))
                }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
        }
        Color.clear.frame(height: 20)
    }

    private func weekBars(_ weeks: [MezoReportWeek]) -> some View {
        let top = Double(max(1, weeks.map { max($0.planned, $0.actual) }.max() ?? 1))
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(weeks) { w in
                    VStack(spacing: 6) {
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 6).fill(.white.opacity(0.1)).frame(height: CGFloat(Double(w.planned) / top) * 90)
                            RoundedRectangle(cornerRadius: 6).fill(hue.glow).frame(height: CGFloat(Double(w.actual) / top) * 90)
                        }
                        .frame(height: 90, alignment: .bottom)
                        Text("\(w.week)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(w.week). hét: \(w.actual) sorozat a tervezett \(w.planned)-ból")
                }
            }
            HStack(spacing: 14) {
                legend(hue.glow, "megcsinált sorozat")
                legend(.white.opacity(0.18), "terv")
            }
            .accessibilityHidden(true)
        }
    }

    private func legend(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 12, height: 12)
            Text(text).nkFont(12).foregroundStyle(.white.opacity(0.6))
        }
    }

    private func stat(_ v: String, _ l: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(v).nkFont(26, .semibold).foregroundStyle(.white)
            Text(l).nkFont(12).foregroundStyle(.white.opacity(0.6))
        }
    }

    private func gain(_ s: WireReport.Strength, top: Double, record: Bool) -> some View {
        let delta = s.deltaKg ?? 0
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(s.exerciseName).nkFont(15, .semibold).foregroundStyle(.white).lineLimit(2)
                if record { MezoTag(text: "rekord", lit: true, hue: hue) }
                Spacer(minLength: 4)
                Text((delta > 0 ? "+" : delta < 0 ? "−" : "") + nkKg(abs(delta)))
                    .nkFont(14, .semibold, design: .monospaced).foregroundStyle(delta < 0 ? planWarn : .white)
            }
            if let line = mezoLiftLine(s) {
                Text(line).nkFont(12).foregroundStyle(.white.opacity(0.55))
            }
            NKLevelBar(level: top > 0 ? abs(delta) / top : 0, hue: hue).opacity(delta < 0 ? 0.5 : 1)
        }
        .accessibilityElement(children: .combine)
    }
}

/// One week of the report: the working sets planned and done, summed over the muscles.
struct MezoReportWeek: Identifiable, Equatable {
    let week: Int, planned: Int, actual: Int
    var id: Int { week }
}

/// Σ planned vs Σ actual per week from the report's per-muscle arcs; empty when the report carries no volume.
func mezoReportWeeks(_ r: WireReport) -> [MezoReportWeek] {
    var planned: [Int: Int] = [:], actual: [Int: Int] = [:]
    for m in r.volume?.muscles ?? [] {
        for w in m.weeks ?? [] {
            planned[w.week, default: 0] += w.planned ?? 0
            actual[w.week, default: 0] += w.actual ?? 0
        }
    }
    return Set(planned.keys).union(actual.keys).sorted().map { MezoReportWeek(week: $0, planned: planned[$0] ?? 0, actual: actual[$0] ?? 0) }
}

/// „80 → 85 kg × 8" — the first and last top set, when both are known.
func mezoLiftLine(_ s: WireReport.Strength) -> String? {
    guard let a = s.firstTopKg, let b = s.lastTopKg else { return nil }
    let reps = s.lastTopReps.map { " × \($0)" } ?? ""
    return "\(nkKg(a).replacingOccurrences(of: " kg", with: "")) → \(nkKg(b))\(reps)"
}

/// The report's one sentence: „6 hétből 6, 17 edzésből 15 kész. 4 gyakorlatban erősebb lettél."
func mezoReportSentence(_ r: WireReport) -> String {
    var parts: [String] = []
    if let a = r.adherence {
        var line: [String] = []
        if let w = a.plannedWeeks, let d = a.completedWeeks { line.append("\(w) hétből \(d)") }
        if let s = a.plannedSessions, let d = a.completedSessions { line.append("\(s) edzésből \(d) kész") }
        if !line.isEmpty { parts.append(line.joined(separator: ", ") + ".") }
    }
    let up = (r.strength ?? []).filter { ($0.deltaKg ?? 0) > 0 }.count
    if up > 0 { parts.append("\(up) gyakorlatban erősebb lettél.") }
    return parts.joined(separator: " ")
}
