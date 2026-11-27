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
    var carbsG: Int? = nil
    var fatG: Int? = nil
    let isToday: Bool
    /// A day after today (the calendar week runs on to Sunday): nothing to say yet, never "nincs rögzítés".
    var future: Bool = false
    /// The target made room for planned training that day.
    var trainingDay: Bool = false
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
    /// The macro means over the judged days, against the week's mean targets (the details card).
    var averageCarbs: Int? = nil
    var averageFat: Int? = nil
    var carbsTarget: Int? = nil
    var fatTarget: Int? = nil

    var isEmpty: Bool { days.isEmpty }
    var kcalValues: [Double?] { days.map { $0.kcal.map(Double.init) } }
    var proteinValues: [Double?] { days.map { $0.proteinG.map(Double.init) } }
    /// The bars drawn hollow: a kímélő day is never read as a miss.
    var markedIndices: [Int] { days.indices.filter { days[$0].kimelo } }
    var labels: [String] { days.map(\.label) }
    /// Today falls in this week (the current week; a past week has no "még tart").
    var containsToday: Bool { days.contains(where: \.isToday) }
    /// The days already lived (today included) — what "N / 7 rögzítve" counts against.
    var elapsedDays: Int { days.filter { !$0.future }.count }
    var loggedDays: Int { days.filter { $0.kcal != nil }.count }
    var trainingDays: Int { days.filter { $0.trainingDay && !$0.future }.count }
    /// The judged day that closed nearest its own target; nil before two judged days (one day is no "closest").
    var closestDay: HetDay? {
        let judged = days.filter { $0.judged && $0.kcal != nil }
        guard judged.count >= 2 else { return nil }
        return judged.min { abs($0.kcal! - $0.target) < abs($1.kcal! - $1.target) }
    }
    /// "november 23–29." / "november 30. – december 6." — the week the tab shows.
    var rangeLabel: String {
        guard let first = days.first?.date, let last = days.last?.date else { return "" }
        return hetRangeLabel(first, last)
    }

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
        let future = r.date > today
        let server = served[r.date]
        let kimelo = server.map { $0.excused && $0.excuse == "kimelo" } ?? (r.fuelMode != nil)
        let logged = r.consumed.kcal > 0 && !future
        let kcal = logged ? Int(r.consumed.kcal.rounded()) : nil
        let judged = !future && (server?.judged ?? (!isToday && !kimelo && logged))
        let training = (r.plannedMovementKcal ?? 0) > 0
        var parts: [String] = []
        if isToday { parts.append("még tart") }
        if future {
            parts.append("még előtted")
            if training { parts.append("edzésnap") }
        } else if kimelo {
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
                      kcal: kcal, target: Int(r.targets.kcal.rounded()), proteinG: logged ? Int(r.consumed.p.rounded()) : nil,
                      carbsG: logged ? Int(r.consumed.c.rounded()) : nil, fatG: logged ? Int(r.consumed.f.rounded()) : nil,
                      isToday: isToday, future: future, trainingDay: training,
                      kimelo: kimelo, judged: judged, skippedKcal: r.skippedKcal, scorePoints: kimelo ? nil : scores[r.date],
                      note: parts.joined(separator: " · "))
    }
    let targets = week.days.map { Int($0.targets.kcal.rounded()) }
    let proteinTargets = week.days.map { Int($0.targets.p.rounded()) }
    let judged = days.filter(\.judged)
    let skipped = week.days.filter { $0.skippedKcal > 0 }
    var out = HetWeek(
        days: days, waterline: mean(targets), proteinTarget: mean(proteinTargets),
        averageKcal: mean(judged.compactMap(\.kcal)), averageProtein: mean(judged.compactMap(\.proteinG)),
        averageScore: mean(days.compactMap(\.scorePoints)),
        judgedDays: judged.count, kimeloDays: days.filter(\.kimelo).count,
        skippedDays: skipped.count, skippedKcal: skipped.reduce(0) { $0 + $1.skippedKcal },
        targetsVary: Set(targets).count > 1,
        scoreGaps: days.filter { !$0.kimelo && scoreFailures.contains($0.date) }.count)
    out.averageCarbs = mean(judged.compactMap(\.carbsG))
    out.averageFat = mean(judged.compactMap(\.fatG))
    out.carbsTarget = mean(week.days.map { Int($0.targets.c.rounded()) })
    out.fatTarget = mean(week.days.map { Int($0.targets.f.rounded()) })
    return out
}

private let hetMonths = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember",
                         "október", "november", "december"]

/// "november 23–29." within a month, "november 30. – december 6." across two.
func hetRangeLabel(_ first: String, _ last: String) -> String {
    let a = first.split(separator: "-").compactMap { Int($0) }, b = last.split(separator: "-").compactMap { Int($0) }
    guard a.count == 3, b.count == 3, (1...12).contains(a[1]), (1...12).contains(b[1]) else { return "\(first) – \(last)" }
    return a[1] == b[1] ? "\(hetMonths[a[1] - 1]) \(a[2])–\(b[2])."
                        : "\(hetMonths[a[1] - 1]) \(a[2]). – \(hetMonths[b[1] - 1]) \(b[2])."
}

/// What the week stepper says under the range: "ez a hét", "múlt hét", "3 hete".
func hetWeekAgo(_ offset: Int) -> String {
    switch offset {
    case 0: "ez a hét"
    case -1: "múlt hét"
    default: "\(-offset) hete"
    }
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
     NKStat(value: w.averageProtein.map { "\($0)" }, unit: "g", label: w.proteinTarget.map { "fehérje · cél \($0)" } ?? "fehérje átlag", hot: true),
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
    let months = hetMonths
    let p = ymd.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, (1...12).contains(p[1]) else { return ymd }
    return "\(months[p[1] - 1]) \(p[2])."
}

// MARK: - The tab

/// `Hét` in tiers (mezo-r36n9.200, decisions #119/#120): the week stepper (a calendar week, Monday → Sunday), a hero card
/// with the three numbers over the kcal / protein bars (swipe between them), the week's one observation, the days as a
/// free-standing carousel (owner: a carousel is not boxed into a card), and the week's details card.
struct EtelHet: View {
    let store: EtelStore
    let onOpen: (HetDay) -> Void
    let onRetry: () -> Void
    /// The week stepper: −1 one week back, +1 one week forward.
    var onStep: (Int) -> Void = { _ in }
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    @State private var heroPage = 0
    @ScaledMetric(relativeTo: .body) private var dayCardHeight: CGFloat = 196
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
            stepper(w)
            hero(w)
            if let o = hetObservation(w) { NKHighlight(hue: hue, label: "A HÉT EGY MONDATBAN", text: o.title, sub: o.sub) }
            NKBare("A NAPOK", hue: hue, trailing: "\(w.loggedDays) / \(w.elapsedDays) rögzítve") {
                NKCarousel(w.days, hue: hue, height: min(dayCardHeight, 440), widthFraction: typeSize.isAccessibilitySize ? 0.86 : 0.6,
                           initial: w.days.first(where: \.isToday)?.id) { d in dayCard(d, proteinTarget: w.proteinTarget) }
            }
            card("A HÉT RÉSZLETEI") { details(w) }
        } else {
            if store.week != nil { stepper(nil) }
            card("A HETED", state: state) {
                Text("Erre a hétre még nincs adat. Egy-két rögzített nap után itt látod, hogyan áll a heted.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// A glass card: the small-caps head on the card, the block's own loading and failed states inside (as on Ma).
    private func card<C: View>(_ label: String, trailing: String? = nil, state: NKBlockState = .ready,
                               @ViewBuilder _ content: () -> C) -> some View {
        NKBare(label, hue: hue, trailing: trailing, state: state, content: content)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .nkGlass(24)
    }

    // MARK: the week stepper

    private func stepper(_ w: HetWeek?) -> some View {
        let offset = store.weekOffset
        return HStack(spacing: 8) {
            stepButton("chevron.left", label: "Előző hét", enabled: offset > -52) { onStep(-1) }
            VStack(spacing: 2) {
                Text(w?.rangeLabel ?? "").nkFont(16, .semibold).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                Text(hetWeekAgo(offset)).nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.55))
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .combine)
            stepButton("chevron.right", label: "Következő hét", enabled: offset < 0) { onStep(1) }
        }
    }

    private func stepButton(_ symbol: String, label: String, enabled: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(enabled ? 0.9 : 0.25))
                .frame(width: 44, height: 44)
                .background(Circle().fill(.white.opacity(enabled ? 0.10 : 0.04)))
        }
        .buttonStyle(.plain).disabled(!enabled)
        .accessibilityLabel(label)
    }

    // MARK: the hero: the three numbers over the kcal bars; page 2 the protein bars

    private func hero(_ w: HetWeek) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            NKStatRow(hetStats(w), hue: hue)
            if typeSize.isAccessibilitySize || voiceOver {
                VStack(alignment: .leading, spacing: 20) { kcalPage(w); proteinPage(w) }
            } else {
                VStack(spacing: 10) {
                    TabView(selection: $heroPage) {
                        kcalPage(w).tag(0)
                        proteinPage(w).tag(1)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .frame(height: 196)
                    HStack(spacing: 6) {
                        ForEach(0..<2) { i in
                            Capsule().fill(.white.opacity(heroPage == i ? 0.85 : 0.25)).frame(width: heroPage == i ? 16 : 6, height: 6)
                        }
                    }
                    .accessibilityHidden(true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(28)
    }

    private func kcalPage(_ w: HetWeek) -> some View {
        chartPage("KALÓRIA", w.kcalValues, w.waterline, w, unit: "kcal")
    }

    private func proteinPage(_ w: HetWeek) -> some View {
        chartPage("FEHÉRJE", w.proteinValues, w.proteinTarget, w, unit: "g")
    }

    private func chartPage(_ title: String, _ values: [Double?], _ target: Int?, _ w: HetWeek, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).nkFont(11.5, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.6)).tracking(1.2)
                Spacer(minLength: 8)
                if let target {
                    Text("a vonal: \(w.targetsVary && unit == "kcal" ? "átlagos " : "")cél \(huInt(target)) \(unit)")
                        .nkFont(11.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            WeekBars(values: values, average: target.map(Double.init), unit: "", labels: w.labels, lineLabel: "cél", marked: Set(w.markedIndices),
                     lit: .some(w.days.firstIndex(where: \.isToday)))
                .frame(height: 140)
            if w.kimeloDays > 0 || w.containsToday {
                Text([w.kimeloDays > 0 ? "körvonalas: kímélő nap" : nil, w.containsToday ? "a mai nap még tart" : nil]
                        .compactMap { $0 }.joined(separator: " · "))
                    .nkFont(11.5).foregroundStyle(.white.opacity(0.5))
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: the days: one free-standing card per day

    private func dayCard(_ d: HetDay, proteinTarget: Int?) -> some View {
        Button { onOpen(d) } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(d.name).nkFont(16, .semibold).foregroundStyle(d.isToday ? hue.glow : .white).lineLimit(1)
                        Text(hetDateLabel(d.date)).nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                    Spacer(minLength: 4)
                    if !d.future && !d.kimelo { EtelScoreRing(points: d.scorePoints, size: 34) }
                }
                Spacer(minLength: 0)
                if let kcal = d.kcal {
                    // the target drops under the number when they do not fit side by side (largest text sizes)
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .firstTextBaseline, spacing: 4) { dayKcal(kcal); dayTarget(d) }
                        VStack(alignment: .leading, spacing: 2) { dayKcal(kcal); dayTarget(d) }
                    }
                    NKLevelBar(level: d.target > 0 ? Double(kcal) / Double(d.target) : 0, hue: hue)
                    if let g = d.proteinG {
                        let hit = proteinTarget.map { g >= Int(Double($0) * 0.9) } ?? false
                        Text("\(g) g fehérje").nkFont(12.5, hit ? .semibold : .regular).foregroundStyle(hit ? hue.glow : .white.opacity(0.75))
                    }
                } else {
                    Text(d.future ? "még előtted" : (d.isToday ? "még nincs rögzítés" : "nincs rögzítés"))
                        .nkFont(14).foregroundStyle(.white.opacity(0.5))
                    Text("cél \(huInt(d.target)) kcal").nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                }
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    if d.isToday { EtelPill(text: "még tart", tone: .muted) }
                    if d.kimelo { EtelPill(text: "kímélő nap", glyph: "heart-cream", tone: .muted) }
                    if d.trainingDay { EtelPill(text: "edzésnap", glyph: "dumbbell-ink", tone: .plain) }
                    if d.skippedKcal > 0 { EtelPill(text: "kihagyva −\(huInt(d.skippedKcal))", tone: .outline) }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .opacity(d.future ? 0.6 : 1)
            .nkGlass(22)
            .overlay { if d.isToday { RoundedRectangle(cornerRadius: 22).stroke(hue.glow.opacity(0.55), lineWidth: 1) } }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(d.future)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(d.name), \(hetDateLabel(d.date)). \(d.note.isEmpty ? (d.kcal.map { "\(huInt($0)) a \(huInt(d.target)) kilokalóriából" } ?? "") : d.note)")
        .accessibilityHint(d.future ? "" : "Megnyitja a napot")
    }

    private func dayKcal(_ kcal: Int) -> some View {
        Text(huInt(kcal)).font(.nkNumber(26)).foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
    }

    private func dayTarget(_ d: HetDay) -> some View {
        Text("/ \(huInt(d.target)) kcal").nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
    }

    // MARK: the details card

    private func details(_ w: HetWeek) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // the week's days as dots: logged, kímélő (hollow), not logged, still ahead (faint)
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Rögzített napok").nkFont(14.5, .medium).foregroundStyle(.white)
                    Spacer(minLength: 8)
                    Text("\(w.loggedDays) / \(w.elapsedDays)").font(.nkNumber(17)).foregroundStyle(.white).monospacedDigit()
                }
                HStack(spacing: 0) {
                    ForEach(w.days) { d in
                        VStack(spacing: 5) {
                            ZStack {
                                if d.kimelo { Circle().stroke(.white.opacity(0.6), lineWidth: 1.5) }
                                else if d.kcal != nil { Circle().fill(d.isToday ? hue.glow.opacity(0.6) : hue.glow) }
                                else { Circle().fill(.white.opacity(d.future ? 0.05 : 0.14)) }
                            }
                            .frame(width: 16, height: 16)
                            Text(d.label).nkFont(10.5, design: .monospaced).foregroundStyle(.white.opacity(d.future ? 0.35 : 0.6))
                                .lineLimit(1).minimumScaleFactor(0.5)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .accessibilityHidden(true)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Rögzített napok: \(w.loggedDays) a \(w.elapsedDays)-ból")

            divider
            VStack(spacing: 14) {
                macro("Fehérje", w.averageProtein, w.proteinTarget, lit: true)
                macro("Szénhidrát", w.averageCarbs, w.carbsTarget)
                macro("Zsír", w.averageFat, w.fatTarget)
            }
            divider
            VStack(spacing: 10) {
                fact("Edzésnap", w.trainingDays == 0 ? "nincs" : "\(w.trainingDays) · nagyobb kerettel")
                fact("Kihagyott étkezés", w.skippedDays == 0 ? "nincs" : "\(w.skippedDays) nap · −\(huInt(w.skippedKcal)) kcal",
                     warn: w.skippedDays > 0)
                fact("Kímélő nap", w.kimeloDays == 0 ? "nincs" : "\(w.kimeloDays)")
                if let c = w.closestDay, let kcal = c.kcal {
                    fact("Legközelebb a célhoz", "\(c.name.lowercased()) · \(huInt(kcal)) / \(huInt(c.target))")
                }
            }
            if let gap = w.scoreGapLine { EtelPill(text: gap, tone: .warn) }
            Text("A mai nap és a kímélő napok nem számítanak bele az átlagokba.").nkFont(12).foregroundStyle(.white.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var divider: some View { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }

    /// One macro's weekly mean against its mean target (never red — over is just a full bar).
    private func macro(_ name: String, _ avg: Int?, _ target: Int?, lit: Bool = false) -> some View {
        let value = HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(avg.map { "\($0)" } ?? "–").font(.nkNumber(17)).foregroundStyle(lit ? hue.glow : .white).monospacedDigit()
            if let target { Text("/ \(target) g").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5)) }
        }
        return VStack(spacing: 7) {
            // name and value side by side; stacked at the largest text sizes
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(name).nkFont(14.5, .medium).foregroundStyle(.white)
                    Text("napi átlag").nkFont(11.5).foregroundStyle(.white.opacity(0.45))
                    Spacer(minLength: 8)
                    value
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(name).nkFont(14.5, .medium).foregroundStyle(.white)
                    value
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            NKLevelBar(level: (avg != nil && (target ?? 0) > 0) ? Double(avg!) / Double(target!) : 0, hue: hue)
        }
        .accessibilityElement(children: .combine)
    }

    private func fact(_ label: String, _ value: String, warn: Bool = false) -> some View {
        let tone = warn ? Color(red: 0.96, green: 0.78, blue: 0.38) : Color.white
        return ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(label).nkFont(14).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
                Spacer(minLength: 8)
                Text(value).nkFont(14, .medium).foregroundStyle(tone).lineLimit(1)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(label).nkFont(14).foregroundStyle(.white.opacity(0.7))
                Text(value).nkFont(14, .medium).foregroundStyle(tone).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
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
