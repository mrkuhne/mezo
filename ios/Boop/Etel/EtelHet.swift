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

    var isEmpty: Bool { days.isEmpty }
    var kcalValues: [Double?] { days.map { $0.kcal.map(Double.init) } }
    var proteinValues: [Double?] { days.map { $0.proteinG.map(Double.init) } }
    /// The bars drawn hollow: a kímélő day is never read as a miss.
    var markedIndices: [Int] { days.indices.filter { days[$0].kimelo } }
    var labels: [String] { days.map(\.label) }

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
func hetWeek(_ week: FuelWeek, scores: [String: Int], today: String) -> HetWeek {
    let days: [HetDay] = week.days.map { r in
        let weekday = hetWeekday(r.date)
        let isToday = r.date == today
        let kimelo = r.fuelMode != nil
        let logged = r.consumed.kcal > 0
        let kcal = logged ? Int(r.consumed.kcal.rounded()) : nil
        let judged = !isToday && !kimelo && logged
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
        targetsVary: Set(targets).count > 1)
}

// MARK: - The tab

/// `Hét`: the last seven days (the room reads them ending today), each against its target.
struct EtelHet: View {
    let store: EtelStore
    let onOpen: (HetDay) -> Void
    let onRetry: () -> Void

    var body: some View {
        if !store.weekLoaded {
            NKDrillSection(number: 1, label: "KALÓRIA · 7 NAP") {
                VStack(alignment: .leading, spacing: 10) {
                    RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.08)).frame(height: 140)
                    Text("Betöltöm a hetedet.").nkFont(13).foregroundStyle(.white.opacity(0.5))
                }
                .redacted(reason: .placeholder).accessibilityLabel("Betöltöm a hetedet")
            }
        } else if let problem = store.weekProblem, store.week == nil {
            NKDrillSection(number: 1, label: "KALÓRIA · 7 NAP") {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Most nem érem el a heted adatait.").nkFont(14).foregroundStyle(.white.opacity(0.7))
                    Text(etelProblemLine(problem)).nkFont(13).foregroundStyle(.white.opacity(0.5))
                    Button(action: onRetry) {
                        Text("Újra").nkFont(14, .semibold).foregroundStyle(NK.ground).padding(.horizontal, 18).frame(minHeight: 38)
                            .background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain)
                }
            }
        } else if let week = store.week {
            let w = hetWeek(week, scores: store.weekScores, today: store.ymd)
            if w.isEmpty {
                NKDrillSection(number: 1, label: "KALÓRIA · 7 NAP") {
                    Text("Erre a hétre még nincs adat.").nkFont(14).foregroundStyle(.white.opacity(0.7))
                }
            } else {
                kcal(w)
                protein(w)
                daysSection(w)
                totals(w)
            }
        }
    }

    // MARK: sections

    private func kcal(_ w: HetWeek) -> some View {
        NKDrillSection(number: 1, label: "KALÓRIA · 7 NAP") {
            VStack(alignment: .leading, spacing: 10) {
                WeekBars(values: w.kcalValues, average: w.waterline.map(Double.init), unit: "", labels: w.labels,
                         lineLabel: "cél", marked: Set(w.markedIndices))
                    .frame(height: 150)
                Text(w.waterlineLine).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                if w.kimeloDays > 0 {
                    Text("A körvonalas oszlop kímélő nap: azt nem mérem a célhoz.").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text("A mai nap még tart, ezért nem számít bele az átlagba.").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
            }
        }
    }

    private func protein(_ w: HetWeek) -> some View {
        NKDrillSection(number: 2, label: "FEHÉRJE · 7 NAP") {
            VStack(alignment: .leading, spacing: 10) {
                WeekBars(values: w.proteinValues, average: w.proteinTarget.map(Double.init), unit: "", labels: w.labels,
                         lineLabel: "cél", marked: Set(w.markedIndices))
                    .frame(height: 130)
                Text(w.proteinTarget.map { "A vonal a napi fehérjecélod: \($0) g." } ?? "Ehhez a héthez nincs fehérjecél-adat.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6))
            }
        }
    }

    private func daysSection(_ w: HetWeek) -> some View {
        NKDrillSection(number: 3, label: "A NAPOK MÖGÖTTE") {
            VStack(spacing: 0) {
                ForEach(Array(w.days.reversed().enumerated()), id: \.element.id) { k, d in
                    dayRow(d)
                    if k < w.days.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
        }
    }

    private func dayRow(_ d: HetDay) -> some View {
        Button { onOpen(d) } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(d.name).nkFont(15, d.isToday ? .semibold : .regular).foregroundStyle(.white)
                    if !d.note.isEmpty {
                        Text(d.note).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(d.kcal.map { "\(huInt($0)) kcal" } ?? "–").nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.85))
                    if let g = d.proteinG { Text("\(g) g fehérje").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5)) }
                    if let p = d.scorePoints { Text("\(p) pont").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5)) }
                }
                Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
            }
            .padding(.vertical, 11).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja a napot")
    }

    private func totals(_ w: HetWeek) -> some View {
        NKDrillSection(number: 4, label: "A HÉT ÖSSZESEN") {
            VStack(spacing: 12) {
                total("Átlagos kalória", w.averageKcal.map { "\(huInt($0)) kcal" } ?? "nincs adat",
                      w.waterline.map { "a cél \(huInt($0)) · \(w.judgedDays) nap alapján" } ?? "\(w.judgedDays) nap alapján")
                total("Átlagos fehérje", w.averageProtein.map { "\($0) g" } ?? "nincs adat", w.proteinTarget.map { "a cél \($0) g" } ?? "")
                total("Napi pontszám átlaga", w.averageScore.map { "\($0) / 100" } ?? "nincs adat",
                      w.averageScore == nil ? "nincs pontozott étkezés" : "a napok saját étkezéseiből")
                total("Kihagyott étkezés", w.skippedDays == 0 ? "nincs" : "\(w.skippedDays) nap",
                      w.skippedDays == 0 ? "" : "−\(huInt(w.skippedKcal)) kcal a keretből")
                total("Kímélő nap", w.kimeloDays == 0 ? "nincs" : "\(w.kimeloDays)",
                      w.kimeloDays == 0 ? "" : "nem értékeltem, és az átlagból kimaradt")
            }
        }
    }

    private func total(_ name: String, _ value: String, _ sub: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(name).nkFont(14.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                Text(value).nkFont(13.5, design: .monospaced).foregroundStyle(.white)
                if !sub.isEmpty { Text(sub).nkFont(11.5).foregroundStyle(.white.opacity(0.5)).multilineTextAlignment(.trailing) }
            }
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
        NKSheetFrame(hue: .fuel, eyebrow: day.date, title: title) {
            if !day.note.isEmpty {
                Text(day.note.prefix(1).uppercased() + day.note.dropFirst()).nkFont(14.5).foregroundStyle(.white.opacity(0.85))
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            }
            if let d = loaded { content(d) }
            else if let problem {
                Text(etelProblemLine(problem)).nkFont(14).foregroundStyle(.white.opacity(0.7))
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            } else {
                Text("Betöltöm a napot.").nkFont(14).foregroundStyle(.white.opacity(0.5)).redacted(reason: .placeholder)
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
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
            VStack(alignment: .leading, spacing: 10) {
                NKMono("A NAP A CÉLHOZ KÉPEST")
                ForEach(rows(d), id: \.0) { row in
                    HStack {
                        Text(row.0).nkFont(14).foregroundStyle(.white.opacity(0.85))
                        Spacer(minLength: 6)
                        Text(row.1).nkFont(13, design: .monospaced).foregroundStyle(.white)
                    }
                }
                if day.kimelo { Text("Kímélő nap: a számok csak tájékoztatók.").nkFont(12.5).foregroundStyle(.white.opacity(0.55)) }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            VStack(alignment: .leading, spacing: 12) {
                NKMono("ÉTKEZÉSEK · \(d.meals.count)")
                if d.meals.isEmpty { Text("Erre a napra nincs rögzített étkezés.").nkFont(14).foregroundStyle(.white.opacity(0.6)) }
                ForEach(d.meals) { m in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(draftMealTitle(m)).nkFont(15, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                            Text("\(etelSlotLabel(m.slot)) · \(huInt(Int(m.macros.kcal.rounded()))) kcal · F \(Int(m.macros.p.rounded())) g")
                                .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                        }
                        Spacer(minLength: 6)
                        if !day.kimelo, let p = mealPoints(m) { Text("\(p)").nkFont(15, design: .monospaced).foregroundStyle(.white.opacity(0.85)) }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        }
    }

    private func rows(_ d: FoodDay) -> [(String, String)] {
        func line(_ eaten: Double, _ target: Double, _ unit: String) -> String {
            "\(huInt(Int(eaten.rounded()))) / \(huInt(Int(target.rounded()))) \(unit)"
        }
        return [("Kalória", line(d.consumed.kcal, d.targets.kcal, "kcal")), ("Fehérje", line(d.consumed.p, d.targets.p, "g")),
                ("Szénhidrát", line(d.consumed.c, d.targets.c, "g")), ("Zsír", line(d.consumed.f, d.targets.f, "g"))]
    }

    private func draftMealTitle(_ m: BoopCore.Meal) -> String {
        if let t = m.title, !t.isEmpty { return t }
        let names = m.items.map(\.name)
        return names.isEmpty ? etelSlotLabel(m.slot) : names.prefix(3).joined(separator: ", ")
    }
}
