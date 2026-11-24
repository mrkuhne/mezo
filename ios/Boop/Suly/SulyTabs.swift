import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Ma

/// Ma: what today says (the weigh-in and the trend), the three numbers, the curve against the plan, this week's
/// weigh-ins, the goal's row, and the rule in words.
struct SulyMa: View {
    let store: SulyStore?
    let openInfo: (SulyInfo) -> Void
    let openEvad: () -> Void
    let capture: () -> Void
    let ask: () -> Void
    private let hue = sulyHue
    private let calendar = sulyCalendar()

    var body: some View {
        if let store, let s = store.snapshot {
            let today = sulyTodayString(calendar)
            let week = sulyThisWeek(s.logs, today: today, calendar: calendar)
            highlight(s, week: week, store: store)
            NKStatRow(stats(s), hue: hue)
            curveBlock(s)
            NKBare("A hét mérései", hue: hue, glyph: "clock-ink", trailing: week.isEmpty ? nil : "\(week.count) mérés") {
                if week.isEmpty {
                    sulyQuietLine("Ezen a héten még nincs mérés. A trend a múlt hét méréseiből él tovább.")
                } else {
                    NKRowList(week.map { sulyLogRow($0, calendar: calendar) }, hue: hue)
                }
            }
            goalBlock(s)
            NKInfoRow(sulyRuleInfo.title, hue: hue) { openInfo(sulyRuleInfo) }
        } else if let store, let problem = store.problem {
            NKBare("MA", hue: hue, state: .failed(problem == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.",
                                                 { Task { await store.load(force: true) } })) { EmptyView() }
        } else {
            NKBare("MA", hue: hue, state: .loading) { EmptyView() }
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a súlyodról") { ask() }
    }

    private func highlight(_ s: SulySnapshot, week: [SulyLog], store: SulyStore) -> some View {
        let today = sulyTodayString(calendar)
        let trend = s.trend?.latestTrendKg ?? s.season?.weight.trendKg
        let rate = s.trend?.last4wRateKgPerWeek
        let direction = rate.map { $0 < -0.05 ? "a trend tovább csúszik lefelé" : ($0 > 0.05 ? "a trend felfelé megy" : "a trend áll") } ?? "a trendhez még kevés a mérés"
        let text: String
        let sub: String
        if let todays = sulyToday(s.logs, today: today) {
            text = trend.map { "Ma \(sulyKg(todays.kg)) kg — a trend \(sulyKg($0))." } ?? "Ma \(sulyKg(todays.kg)) kg."
            sub = "\(week.count) mérés a héten; \(direction)."
        } else if week.isEmpty {
            text = "A héten még nem mértél"
            sub = trend.map { "A trended \(sulyKg($0)) kg; \(direction)." } ?? "Lépj a mérlegre: a trend a mérésekből él."
        } else {
            text = "Ma még nem mértél"
            sub = "\(week.count) mérés a héten; \(direction)."
        }
        return NKHighlight(hue: hue, label: "Ami ma számít", text: text, sub: sub,
                           actions: [NKHighlightAction("Súly rögzítése") { capture() }])
            .nkStale(store.ageText.map { NKStale(age: $0, loud: store.offline) })
    }

    private func stats(_ s: SulySnapshot) -> [NKStat] {
        let trend = s.trend?.latestTrendKg ?? s.season?.weight.trendKg
        let rate = s.trend?.last4wRateKgPerWeek
        let course = SulyCourse(trajectory: s.season?.head.trajectory)
        var out = [NKStat(value: trend.map(sulyKg), unit: "kg", label: "most (trend)",
                          trend: rate.map { $0 < -0.05 ? -1 : ($0 > 0.05 ? 1 : 0) } ?? 0, hot: true)]
        if let season = s.season {
            if course == .maintain, let band = season.weight.band ?? season.pillars.weight.band {
                out.append(NKStat(value: "\(sulyKg(band.lowKg))–\(sulyKg(band.highKg))", unit: "kg", label: "a sáv"))
            } else if let target = season.weight.targetKg {
                out.append(NKStat(value: sulyKg(target), unit: "kg",
                                  label: sulyDateText(season.pillars.weight.targetDate).map { "a cél · \($0)" } ?? "a cél"))
            }
            let what = course == .bulk ? "heti hízás" : "heti fogyás"
            let planned = season.weight.kgPerWeek.map { "terv \(sulyKg(abs($0)))" }
            out.append(NKStat(value: rate.map { sulyKg(abs($0)) }, unit: "kg",
                              label: [what, planned].compactMap { $0 }.joined(separator: " · ")))
        } else {
            out.append(NKStat(value: rate.map { sulyKg(abs($0)) }, unit: "kg",
                              label: rate.map { $0 < 0 ? "heti fogyás" : "heti hízás" } ?? "heti változás"))
            out.append(NKStat(value: s.logs.isEmpty ? nil : "\(s.logs.count)", unit: "", label: "mérés eddig"))
        }
        return out
    }

    @ViewBuilder private func curveBlock(_ s: SulySnapshot) -> some View {
        if let c = sulyCurve(s.season, trend: s.trend) {
            NKBare("A súlyod", hue: hue, glyph: "scale-ink", trailing: sulyCurveTrailing(s.season)) {
                let floor = (c.values + [c.target].compactMap { $0 }).min()! - 1
                NKCurve(values: c.values.map { $0 - floor }, labels: c.labels, hue: hue,
                        target: c.target.map { $0 - floor }, nowIndex: c.now, height: 140, planAfterNow: s.season != nil)
                if let season = s.season, let target = season.weight.targetKg,
                   let trend = s.trend?.latestTrendKg ?? season.weight.trendKg, let start = season.weight.series.first?.kg {
                    let done = start - trend, left = trend - target
                    let rate = s.trend?.last4wRateKgPerWeek ?? 0
                    let weeks = abs(rate) > 0.01 && (left * rate) < 0 ? Int((abs(left) / abs(rate)).rounded(.up)) : nil
                    NKStatRow([
                        NKStat(value: sulyKg(abs(done)), unit: "kg", label: done < 0 ? "eddig feljött" : "eddig lement", hot: true),
                        NKStat(value: sulyKg(abs(left)), unit: "kg", label: "van még hátra"),
                        NKStat(value: weeks.map { "\($0)" }, unit: "hét", label: "ennyi kell még ezen az ütemen"),
                    ], hue: hue)
                }
            }
        } else {
            NKBare("A súlyod", hue: hue, glyph: "scale-ink") {
                sulyQuietLine("Két mérés után megjelenik a trended vonala.")
            }
        }
    }

    private func goalBlock(_ s: SulySnapshot) -> some View {
        NKBare("A cél", hue: hue, glyph: "star-sun") {
            NKRowList([goalRow(s.season)], hue: hue)
        }
    }

    /// The goal as one row: the target and its date (or the band), the planned pace, and where it is changed.
    private func goalRow(_ season: EvadOverview?) -> NKAreaRow {
        guard let season else {
            return NKAreaRow(id: "goal", glyph: "star-sun", title: "Nincs évad", sub: "a súlycélt az Évadban állítod") { openEvad() }
        }
        let course = SulyCourse(trajectory: season.head.trajectory)
        if course == .maintain, let band = season.weight.band ?? season.pillars.weight.band {
            return NKAreaRow(id: "goal", glyph: "star-sun", title: "Tartás · \(sulyKg(band.lowKg))–\(sulyKg(band.highKg)) kg",
                             sub: "az évad súlyának tartása · az évadban módosítod") { openEvad() }
        }
        let title = [season.weight.targetKg.map { "\(sulyKg($0)) kg" }, sulyDateText(season.pillars.weight.targetDate)]
            .compactMap { $0 }.joined(separator: " · ")
        let sub = [season.weight.kgPerWeek.map { "heti \(sulyKg(abs($0))) kg" }, "az évadban módosítod"].compactMap { $0 }.joined(separator: " · ")
        return NKAreaRow(id: "goal", glyph: "star-sun", title: title.isEmpty ? season.head.title : title, sub: sub) { openEvad() }
    }
}

// MARK: - Test

/// Test: the body as the Feelfit scale sees it — fat %, lean mass, the BMI — and the 90-day lines behind them.
struct SulyTest: View {
    let store: SulyStore?
    let openInfo: (SulyInfo) -> Void
    let ask: () -> Void
    private let hue = sulyHue

    var body: some View {
        if let store, let s = store.snapshot {
            let now = Date()
            let fat = sulyLatest(s.fatPct, now: now), lean = sulyLatest(s.leanKg, now: now)
            NKStatRow([
                NKStat(value: fat.map { sulyKg($0) }, unit: "%", label: "testzsír", trend: trendOf(s.fatPct), hot: true),
                NKStat(value: lean.map { sulyKg($0) }, unit: "kg", label: "izomtömeg", trend: trendOf(s.leanKg)),
                NKStat(value: store.bmi.map { sulyKg($0) }, unit: "", label: s.heightCm == nil ? "BMI · nincs magasság" : "BMI"),
            ], hue: hue)
            .nkStale(store.ageText.map { NKStale(age: $0, loud: store.offline) })
            line("Testzsír", glyph: "body-cream", samples: s.fatPct, unit: "%")
            line("Izomtömeg", glyph: "dumbbell-ink", samples: s.leanKg, unit: "kg")
            if s.fatPct.isEmpty && s.leanKg.isEmpty {
                NKBare("A Feelfit mérleg", hue: hue, glyph: "scale-ink") {
                    sulyQuietLine("A testzsír és az izomtömeg a Feelfit mérlegről, az Apple Egészségen át jön ide. Még nincs mérés az elmúlt 90 napból.")
                }
            }
            NKInfoRow(sulyBodyInfo.title, hue: hue) { openInfo(sulyBodyInfo) }
        } else if let store, let problem = store.problem {
            NKBare("TEST", hue: hue, state: .failed(problem == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.",
                                                   { Task { await store.load(force: true) } })) { EmptyView() }
        } else {
            NKBare("TEST", hue: hue, state: .loading) { EmptyView() }
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a testedről") { ask() }
    }

    private func trendOf(_ samples: [SulyBodySample]) -> Int {
        guard samples.count >= 2, let first = samples.first?.value, let last = samples.last?.value else { return 0 }
        return last < first - 0.05 ? -1 : (last > first + 0.05 ? 1 : 0)
    }

    @ViewBuilder private func line(_ label: String, glyph: String, samples: [SulyBodySample], unit: String) -> some View {
        if samples.count >= 2 {
            NKBare(label, hue: hue, glyph: glyph, trailing: "90 nap") {
                let values = samples.map(\.value)
                let floor = values.min()! - (unit == "%" ? 2 : 1)
                NKCurve(values: values.map { $0 - floor }, labels: lineLabels(samples), hue: hue, nowIndex: values.count - 1, height: 120)
                sulyQuietLine("\(samples.count) mérés · a Feelfit mérlegről, az Apple Egészségen át.")
            }
        }
    }

    /// The first sample's date under the line's start, „ma" under its end.
    private func lineLabels(_ samples: [SulyBodySample]) -> [String] {
        var labels = Array(repeating: "", count: samples.count)
        labels[0] = shortDate(samples[0].date)
        labels[samples.count - 1] = "ma"
        return labels
    }

    private func shortDate(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = Calendar.current.timeZone
        return sulyShortDate(f.string(from: d))
    }
}

// MARK: - Napló

/// Napló: every weigh-in, by week, this week first, with the week's average.
struct SulyNaplo: View {
    let store: SulyStore?
    let capture: () -> Void
    private let hue = sulyHue
    private let calendar = sulyCalendar()

    var body: some View {
        if let store, let s = store.snapshot {
            let weeks = sulyWeeks(s.logs, today: sulyTodayString(calendar), calendar: calendar)
            if weeks.isEmpty {
                NKBare("Mérések", hue: hue, glyph: "scale-ink") {
                    sulyQuietLine("Még nincs mérés az elmúlt tizenkét hétből. Lépj a mérlegre, vagy rögzíts egyet kézzel.")
                }
            }
            ForEach(weeks, id: \.label) { w in
                NKBare(w.label, hue: hue, glyph: "scale-ink", trailing: w.averageKg.map { "átlag \(sulyKg($0)) kg" }) {
                    NKRowList(w.logs.map { sulyLogRow($0, calendar: calendar) }, hue: hue)
                }
            }
            if !weeks.isEmpty, s.logs.count > weeks.reduce(0) { $0 + $1.logs.count } {
                sulyQuietLine("A régebbi méréseid a trendben élnek tovább.")
            }
        } else if let store, let problem = store.problem {
            NKBare("NAPLÓ", hue: hue, state: .failed(problem == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.",
                                                    { Task { await store.load(force: true) } })) { EmptyView() }
        } else {
            NKBare("NAPLÓ", hue: hue, state: .loading) { EmptyView() }
        }
    }
}
