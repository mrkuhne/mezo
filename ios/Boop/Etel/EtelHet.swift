import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// B4 Étel — the `Hét` tab: seven days against the target waterline, the protein, the day scores, the skipped meals and the
// kímélő days, and the week's totals. Everything the views say is computed here, as plain values.

// MARK: - The week as plain values

/// One day of the week as the tab says it.
struct HetDay: Equatable, Identifiable {
    let date: String
    /// The chart's short label (H K Sze Cs P Szo V).
    let label: String
    /// "Ma" for today, else the weekday's name.
    let name: String
    /// Nil = nothing logged that day (a missing bar, never a zero).
    let kcal: Int?
    let target: Int
    let proteinG: Int?
    let isToday: Bool
    /// A recovery day: the day stops being judged (its numbers are guidance only).
    let kimelo: Bool
    /// Counts in the week's averages: a finished, logged day that is not kímélő.
    let judged: Bool
    let skippedKcal: Int
    let scorePoints: Int?
    let note: String
    var id: String { date }
}

struct HetWeek: Equatable {
    let days: [HetDay]
    /// The target the days are read against: the mean of the seven day-targets (they differ on training days).
    let waterline: Int?
    let proteinTarget: Int?
    let averageKcal: Int?
    let averageProtein: Int?
    let averageScore: Int?
    let judgedDays: Int
    let kimeloDays: Int
    let skippedDays: Int
    let skippedKcal: Int
    let targetsVary: Bool
    /// Days whose meals could not be read for their score: said, never mistaken for a day without one.
    let scoreGaps: Int

    var isEmpty: Bool { days.isEmpty }
    var kcalValues: [Double?] { days.map { $0.kcal.map(Double.init) } }
    var proteinValues: [Double?] { days.map { $0.proteinG.map(Double.init) } }
    /// The bars drawn hollow: a kímélő day is never read as a miss.
    var markedIndices: [Int] { days.indices.filter { days[$0].kimelo } }
    var labels: [String] { days.map(\.label) }

    /// The totals' line about days whose score read failed; nil when none did.
    var scoreGapLine: String? {
        scoreGaps == 0 ? nil : "\(scoreGaps) nap pontszáma most nem jött meg — az átlag csak a többiből van"
    }

    /// What the line under the chart says it is.
    var waterlineLine: String {
        guard let waterline else { return "Ehhez a héthez nincs cél-adat." }
        return "A vonal \(targetsVary ? "az átlagos" : "a") napi célod: \(huInt(waterline)) kcal."
    }
}

private let hetGreg: Calendar = {
    var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; return c
}()

private func hetWeekday(_ ymd: String) -> Int? {
    let p = ymd.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, let d = hetGreg.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return nil }
    return hetGreg.component(.weekday, from: d)   // 1 = Sunday
}

private let hetShort = [1: "V", 2: "H", 3: "K", 4: "Sze", 5: "Cs", 6: "P", 7: "Szo"]
private let hetLong = [1: "Vasárnap", 2: "Hétfő", 3: "Kedd", 4: "Szerda", 5: "Csütörtök", 6: "Péntek", 7: "Szombat"]

private func recoveryWord(_ category: String?) -> String? {
    switch category {
    case "ILLNESS": "betegség"
    case "STOMACH": "gyomorrontás"
    case "INJURY": "sérülés"
    case "TRAVEL": "utazás"
    default: nil
    }
}

private func mean(_ values: [Int]) -> Int? {
    values.isEmpty ? nil : Int((Double(values.reduce(0, +)) / Double(values.count)).rounded())
}

/// The week as the tab reads it. `scores` are the days' own mean meal scores in points (0…100) by date; `today` is
/// the server's `yyyy-MM-dd`. Today is still going, so it never joins the averages; a kímélő day (any recovery mode) is
/// marked and not judged — no verdict words, no score, left out of the averages; a day with nothing logged is a
/// missing day, never a zero.
///
/// `adherence` is the server's judgement of the same days (`GET /api/seasons/adherence`, B6 S2 — the single source):
/// a day it answered takes its judged flag and its kímélő excuse from there; a day it did not answer (the call failed,
/// offline, an older server) keeps the rule above, so the tab never goes blank.
func hetWeek(_ week: FuelWeek, scores: [String: Int], today: String, scoreFailures: Set<String> = [],
             adherence: [EvadAdherenceDay] = []) -> HetWeek {
    let served = Dictionary(adherence.map { ($0.date, $0) }, uniquingKeysWith: { a, _ in a })
    let days: [HetDay] = week.days.map { r in
        let weekday = hetWeekday(r.date)
        let isToday = r.date == today
        let server = served[r.date]
        let kimelo = server.map { $0.excused && $0.excuse == "kimelo" } ?? (r.fuelMode != nil)
        let logged = r.consumed.kcal > 0
        let kcal = logged ? Int(r.consumed.kcal.rounded()) : nil
        let judged = server?.judged ?? (!isToday && !kimelo && logged)
        var parts: [String] = []
        if isToday { parts.append("még tart") }
        if kimelo {
            parts.append("kímélő nap")
            if let why = recoveryWord(r.recoveryCategory) { parts.append(why) }
            parts.append("nem értékelem")
        } else {
            if !logged && !isToday { parts.append("nincs rögzítés") }
            if let planned = r.plannedMovementKcal, planned > 0 { parts.append("edzésnap · +\(huInt(planned)) kcal keret") }
        }
        if r.skippedKcal > 0 { parts.append("étkezés kihagyva · −\(huInt(r.skippedKcal)) kcal a keretből") }
        if !kimelo, scoreFailures.contains(r.date) { parts.append("a pontszám most nem jött meg") }
        return HetDay(date: r.date, label: weekday.flatMap { hetShort[$0] } ?? "", name: isToday ? "Ma" : (weekday.flatMap { hetLong[$0] } ?? r.date),
                      kcal: kcal, target: Int(r.targets.kcal.rounded()), proteinG: logged ? Int(r.consumed.p.rounded()) : nil, isToday: isToday,
                      kimelo: kimelo, judged: judged, skippedKcal: r.skippedKcal, scorePoints: kimelo ? nil : scores[r.date],
                      note: parts.joined(separator: " · "))
    }
    let targets = week.days.map { Int($0.targets.kcal.rounded()) }
    let proteinTargets = week.days.map { Int($0.targets.p.rounded()) }
    let judged = days.filter(\.judged)
    let skipped = week.days.filter { $0.skippedKcal > 0 }
    return HetWeek(
        days: days, waterline: mean(targets), proteinTarget: mean(proteinTargets),
        averageKcal: mean(judged.compactMap(\.kcal)), averageProtein: mean(judged.compactMap(\.proteinG)),
        averageScore: mean(days.compactMap(\.scorePoints)),
        judgedDays: judged.count, kimeloDays: days.filter(\.kimelo).count,
        skippedDays: skipped.count, skippedKcal: skipped.reduce(0) { $0 + $1.skippedKcal },
        targetsVary: Set(targets).count > 1,
        scoreGaps: days.filter { !$0.kimelo && scoreFailures.contains($0.date) }.count)
}

// MARK: - What the week says, in words and numbers

/// The one thing worth reading about the week: the protein gap when there is one, else the energy, else the skipped
/// meals. Only judged days count (today and kímélő days never do). nil when there is too little to say anything.
func hetObservation(_ w: HetWeek) -> (title: String, sub: String)? {
    let judged = w.days.filter(\.judged)
    guard judged.count >= 2 else { return nil }
    if let target = w.proteinTarget, target > 0 {
        let short = judged.compactMap { d in d.proteinG.flatMap { $0 < Int(Double(target) * 0.9) ? target - $0 : nil } }
        if short.count * 2 >= judged.count {
            let gap = Int((Double(short.reduce(0, +)) / Double(short.count)).rounded())
            return (short.count == judged.count ? "A fehérje mind a \(judged.count) értékelt napon elmaradt" : "A fehérje \(judged.count) napból \(short.count) alkalommal elmaradt",
                    "Átlagosan \(gap) g hiányzott a napi \(target) grammból. Egy fehérjedúsabb vacsora a legegyszerűbb pótlás.")
        }
    }
    let over = judged.filter { ($0.kcal ?? 0) > Int(Double($0.target) * 1.1) }.count
    if over * 2 >= judged.count {
        return ("\(judged.count) napból \(over) alkalommal a keret fölött jártál", "Nem baj egy-egy ilyen nap; ha a cél a fogyás, a hét átlaga számít.")
    }
    if w.skippedDays >= 2 {
        return ("A héten \(w.skippedDays) napon maradt ki étkezés", "A kihagyott étkezés kerete nem kerül át máshova, ezért aznap kevesebb fér bele.")
    }
    return ("A hét rendben van", "\(judged.count) értékelt napból a legtöbb a cél közelében zárult.")
}

/// The three numbers over the week: energy against the target, protein against the target (the lit one), the score.
func hetStats(_ w: HetWeek) -> [NKStat] {
    [NKStat(value: w.averageKcal.map(huInt), unit: "kcal", label: w.waterline.map { "átlag · cél \(huInt($0))" } ?? "napi átlag"),
     NKStat(value: w.averageProtein.map { "\($0)" }, target: w.proteinTarget.map { "\($0)" }, unit: "g", label: "fehérje átlag", hot: true),
     NKStat(value: w.averageScore.map { "\($0)" }, unit: "pont", label: "étkezések átlaga")]
}

/// The head of the Hét tab: the week in one sentence.
func hetVerdict(_ w: HetWeek?, level: Double?) -> EtelVerdict {
    guard let w, !w.isEmpty else { return EtelVerdict(headline: "Betöltöm a hetedet", sentence: "Egy pillanat.", level: level) }
    guard let avg = w.averageKcal else {
        return EtelVerdict(headline: "Még kevés a rögzítés a héten", sentence: "Egy-két rögzített nap után itt látod, hogyan áll a heted.", level: level)
    }
    let sentence = w.waterline.map { avg <= $0 ? "Átlagosan a kereted alatt zártál, \(w.judgedDays) értékelt nap alapján." : "Átlagosan a kereted fölött zártál, \(w.judgedDays) értékelt nap alapján." }
        ?? "\(w.judgedDays) értékelt nap alapján."
    return EtelVerdict(headline: "Napi átlag \(huInt(avg)) kalória", sentence: sentence, level: level)
}

/// "november 18." from "2026-11-18" (the opened day's eyebrow).
func hetDateLabel(_ ymd: String) -> String {
    let months = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"]
    let p = ymd.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, (1...12).contains(p[1]) else { return ymd }
    return "\(months[p[1] - 1]) \(p[2])."
}

// MARK: - The tab

/// `Hét` on the warm blocks: the week's one observation, its three numbers, the energy and protein bars against the
/// targets, the days behind them as rows (pills, a score ring), and the week's details as pills.
struct EtelHet: View {
    let store: EtelStore
    let onOpen: (HetDay) -> Void
    let onRetry: () -> Void
    private let hue = Hue.fuel

    private var state: NKBlockState {
        if !store.weekLoaded { return .loading }
        if let problem = store.weekProblem, store.week == nil {
            return .failed("Most nem érem el a heted adatait. \(etelProblemLine(problem))", { onRetry() })
        }
        return .ready
    }

    private var week: HetWeek? {
        store.week.map { hetWeek($0, scores: store.weekScores, today: store.ymd, scoreFailures: store.weekScoreFailures,
                                 adherence: store.weekAdherence) }
    }

    var body: some View {
        if let w = week, !w.isEmpty {
            if let o = hetObservation(w) { NKHighlight(hue: hue, label: "A HÉT EGY MONDATBAN", text: o.title, sub: o.sub) }
            NKBare("A HÉT SZÁMOKBAN", hue: hue, trailing: "\(w.judgedDays) értékelt nap") { NKStatRow(hetStats(w), hue: hue) }
            NKBare("KALÓRIA · 7 NAP", hue: hue) { bars(w.kcalValues, w.waterline, w, height: 150, unit: "kcal") }
            NKBare("FEHÉRJE · 7 NAP", hue: hue) { bars(w.proteinValues, w.proteinTarget, w, height: 130, unit: "g") }
            NKBare("A NAPOK", hue: hue) { days(w) }
            NKBare("A HÉT RÉSZLETEI", hue: hue) { details(w) }
        } else {
            NKBare("A HETED", hue: hue, state: state) {
                Text("Erre a hétre még nincs adat. Egy-két rögzített nap után itt látod, hogyan áll a heted.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: bars

    private func bars(_ values: [Double?], _ target: Int?, _ w: HetWeek, height: CGFloat, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            WeekBars(values: values, average: target.map(Double.init), unit: "", labels: w.labels, lineLabel: "cél", marked: Set(w.markedIndices))
                .frame(height: height)
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                if let target { EtelPill(text: "a vonal: \(w.targetsVary && unit == "kcal" ? "átlagos " : "")cél \(huInt(target)) \(unit)", glyph: "chart-deep") }
                if w.kimeloDays > 0 { EtelPill(text: "körvonalas: kímélő nap", tone: .muted) }
                EtelPill(text: "a mai nap még tart", tone: .muted)
            }
        }
    }

    // MARK: days

    private func days(_ w: HetWeek) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(w.days.reversed().enumerated()), id: \.element.id) { k, d in
                if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 56) }
                dayRow(d, proteinTarget: w.proteinTarget)
            }
        }
    }

    /// One day = one row: its weekday mark, the name, its facts as pills, and the day's own score as a ring.
    private func dayRow(_ d: HetDay, proteinTarget: Int?) -> some View {
        Button { onOpen(d) } label: {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle().fill(d.isToday ? hue.glow.opacity(0.2) : .white.opacity(0.08))
                    Text(d.label).nkFont(12.5, .semibold).foregroundStyle(d.isToday ? hue.glow : .white.opacity(0.9))
                }
                .frame(width: 44, height: 44).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 7) {
                    Text(d.name).nkFont(15.5, d.isToday ? .semibold : .medium).foregroundStyle(.white)
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        if let kcal = d.kcal {
                            EtelPill(text: "\(huInt(kcal)) / \(huInt(d.target)) kcal", tone: d.judged && kcal > Int(Double(d.target) * 1.1) ? .warn : .plain)
                        } else {
                            EtelPill(text: d.isToday ? "még nincs rögzítés" : "nincs rögzítés", tone: .muted)
                        }
                        if let g = d.proteinG {
                            EtelPill(text: "\(g) g fehérje", tone: proteinTarget.map { g >= Int(Double($0) * 0.9) ? .hue : .plain } ?? .plain)
                        }
                        if d.isToday { EtelPill(text: "még tart", tone: .muted) }
                        if d.kimelo { EtelPill(text: "kímélő nap", glyph: "heart-cream", tone: .muted) }
                        if d.skippedKcal > 0 { EtelPill(text: "kihagyva −\(huInt(d.skippedKcal)) kcal", tone: .outline) }
                    }
                }
                Spacer(minLength: 4)
                EtelScoreRing(points: d.scorePoints, size: 38).padding(.top, 2)
            }
            .padding(.vertical, 12).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja a napot")
    }

    // MARK: details

    private func details(_ w: HetWeek) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                EtelPill(text: w.skippedDays == 0 ? "kihagyott étkezés: nincs" : "kihagyott étkezés: \(w.skippedDays) nap · −\(huInt(w.skippedKcal)) kcal",
                         tone: w.skippedDays == 0 ? .plain : .outline)
                EtelPill(text: w.kimeloDays == 0 ? "kímélő nap: nincs" : "kímélő nap: \(w.kimeloDays)", tone: .plain)
                if w.targetsVary { EtelPill(text: "edzésnapokon nagyobb a keret", glyph: "dumbbell-ink") }
                if let gap = w.scoreGapLine { EtelPill(text: gap, tone: .warn) }
            }
            Text("A mai nap és a kímélő napok nem számítanak bele az átlagokba.").nkFont(12).foregroundStyle(.white.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - A day, opened

/// What a tapped day shows: its numbers against its targets, a kímélő or skipped note, and its meals with their scores.
struct HetDaySheet: View {
    let day: HetDay
    let store: EtelStore
    @State private var loaded: FoodDay?
    @State private var problem: FoodFetchError?
    @State private var done = false

    private var title: String { day.isToday ? "Ma" : day.name }

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: hetDateLabel(day.date), title: title) {
            if let d = loaded { content(d) }
            else if let problem {
                EtelSheetCard(label: "A NAP") {
                    Text(etelProblemLine(problem)).nkFont(14).foregroundStyle(.white.opacity(0.7))
                }
            } else {
                EtelSheetCard(label: "A NAP") {
                    HStack(spacing: 10) {
                        ProgressView().tint(.white.opacity(0.6)).controlSize(.small)
                        Text("Betöltöm a napot…").nkFont(13).foregroundStyle(.white.opacity(0.55))
                    }
                }
            }
        }
        .task(id: day.date) { await load() }
    }

    private func load() async {
        guard let food = store.currentFood else { problem = .unauthorized; return }
        do { loaded = try await food.day(dateOf(day.date)); problem = nil }
        catch let e as FoodFetchError { problem = e }
        catch { problem = .server }
    }

    private func dateOf(_ ymd: String) -> Date {
        let p = ymd.split(separator: "-").compactMap { Int($0) }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
        return cal.date(from: DateComponents(year: p.first, month: p.count > 1 ? p[1] : 1, day: p.count > 2 ? p[2] : 1, hour: 12)) ?? Date()
    }

    private func content(_ d: FoodDay) -> some View {
        VStack(spacing: 12) {
            EtelSheetCard(label: "A NAP A CÉLHOZ KÉPEST", trailing: day.kimelo ? "csak tájékoztató" : nil) {
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    if day.isToday { EtelPill(text: "még tart", tone: .muted) }
                    if day.kimelo { EtelPill(text: "kímélő nap · nem értékelem", glyph: "heart-cream", tone: .muted) }
                    if day.skippedKcal > 0 { EtelPill(text: "kihagyva −\(huInt(day.skippedKcal)) kcal", tone: .outline) }
                    if let p = day.scorePoints { EtelPill(text: "\(p) pont az étkezések átlaga", tone: .hue) }
                }
                VStack(spacing: 14) {
                    bar("Kalória", d.consumed.kcal, d.targets.kcal, "kcal", lit: true)
                    bar("Fehérje", d.consumed.p, d.targets.p, "g")
                    bar("Szénhidrát", d.consumed.c, d.targets.c, "g")
                    bar("Zsír", d.consumed.f, d.targets.f, "g")
                }
            }
            EtelSheetCard(label: "ÉTKEZÉSEK", trailing: "\(d.meals.count) db") {
                if d.meals.isEmpty { Text("Erre a napra nincs rögzített étkezés.").nkFont(14).foregroundStyle(.white.opacity(0.6)) }
                VStack(spacing: 0) {
                    ForEach(Array(d.meals.enumerated()), id: \.element.id) { k, m in
                        if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 56) }
                        HStack(alignment: .top, spacing: 12) {
                            EtelMedallion(glyph: "bowl-cream", size: 44)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(draftMealTitle(m)).nkFont(15, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                                NKFlowRow(spacing: 6, rowSpacing: 6) {
                                    EtelPill(text: etelSlotLabel(m.slot), tone: .hue)
                                    EtelPill(text: "\(huInt(Int(m.macros.kcal.rounded()))) kcal")
                                    EtelPill(text: "\(Int(m.macros.p.rounded())) g fehérje")
                                }
                            }
                            Spacer(minLength: 4)
                            if !day.kimelo && m.slot != "drink" { EtelScoreRing(points: mealPoints(m), size: 36).padding(.top, 2) }
                        }
                        .padding(.vertical, 11)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }

    /// One macro of the day: the name, eaten / target, and a bar (never red — over is just a full bar).
    private func bar(_ name: String, _ eaten: Double, _ target: Double, _ unit: String, lit: Bool = false) -> some View {
        VStack(spacing: 7) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(name).nkFont(14.5, .medium).foregroundStyle(.white)
                Spacer(minLength: 8)
                Text(huInt(Int(eaten.rounded()))).font(.custom(Lagy.outfitFamily, size: 17).weight(.medium))
                    .foregroundStyle(lit ? Hue.fuel.glow : .white).monospacedDigit()
                Text("/ \(huInt(Int(target.rounded()))) \(unit)").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
            }
            NKLevelBar(level: target > 0 ? eaten / target : 0, hue: .fuel)
        }
        .accessibilityElement(children: .combine)
    }

    private func draftMealTitle(_ m: BoopCore.Meal) -> String {
        if let t = m.title, !t.isEmpty { return t }
        let names = m.items.map(\.name)
        return names.isEmpty ? etelSlotLabel(m.slot) : names.prefix(3).joined(separator: ", ")
    }
}
