import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Which sheet a phrase opens (spec §5.4)

/// The detail sheets behind Boop mondja's tappable phrases.
enum DetailSheet: String, Identifiable {
    case sleep, pulse, day
    var id: String { rawValue }

    init(_ link: Brief.Link) {
        switch link {
        case .sleep: self = .sleep
        case .heart: self = .pulse
        case .day: self = .day
        }
    }
}

/// The sheet of a kind, at the medium and large detents on the dark ground (spec §5.4).
struct DetailSheetView: View {
    let kind: DetailSheet
    /// The live brief (after a session move the store's copy is the fresh one).
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext
    let close: () -> Void
    @State private var detent: PresentationDetent = .medium

    var body: some View {
        Group {
            switch kind {
            case .sleep: SleepSheet(brief: brief)
            case .pulse: PulseSheet(brief: brief)
            case .day: DaySheet(brief: brief, store: store, ctx: ctx, close: close)
            }
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationBackground(NK.ground)
        .presentationCornerRadius(34)
        .presentationDragIndicator(.visible)
        .onAppear {
            #if DEBUG
            if UserDefaults.standard.string(forKey: "previewDetent") == "large" { detent = .large }
            #endif
        }
    }
}

// MARK: - Weeks and days

/// A week of nullable values as bars: missing days stay nil (never 0); the average is of the days that have a value.
/// nil when no day has one.
func weekSeries(_ values: [Int?]) -> (values: [Double?], average: Double)? {
    let present = values.compactMap { $0 }
    guard !present.isEmpty else { return nil }
    return (values.map { $0.map(Double.init) }, Double(present.reduce(0, +)) / Double(present.count))
}

private let dayAbbrev = ["V", "H", "K", "Sze", "Cs", "P", "Szo"]          // by Gregorian weekday 1 = Sunday
private let dayNames = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"]
private let monthNames = ["január", "február", "március", "április", "május", "június", "július", "augusztus",
                          "szeptember", "október", "november", "december"]

private func dateOf(_ ymd: String) -> Date? {
    let p = ymd.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return nil }
    return gregorian.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
}

private var gregorian: Calendar {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
}

/// The short day names of the `count` days ending on `ymd` (oldest first, the last is that day). Unreadable date: blanks.
func weekLabels(endingOn ymd: String, count: Int = 7) -> [String] {
    guard let end = dateOf(ymd) else { return Array(repeating: "", count: count) }
    return (0..<count).map { k in
        let d = gregorian.date(byAdding: .day, value: k - (count - 1), to: end)!
        return dayAbbrev[gregorian.component(.weekday, from: d) - 1]
    }
}

/// "kedd" for "2026-11-10".
func weekdayName(_ ymd: String) -> String? {
    dateOf(ymd).map { dayNames[gregorian.component(.weekday, from: $0) - 1] }
}

/// "Kedd, november 10." for "2026-11-10".
func dayLine(_ ymd: String) -> String? {
    guard let d = dateOf(ymd), let name = weekdayName(ymd) else { return nil }
    let c = gregorian.dateComponents([.month, .day], from: d)
    return "\(name.prefix(1).uppercased())\(name.dropFirst()), \(monthNames[(c.month ?? 1) - 1]) \(c.day ?? 1)."
}

/// Today's deep sleep against the average of the days before today; nil without earlier days.
func deepDelta(deep: Int, week: [Int?]) -> Int? {
    let prior = week.dropLast().compactMap { $0 }
    guard !prior.isEmpty else { return nil }
    return Int((Double(deep) - Double(prior.reduce(0, +)) / Double(prior.count)).rounded())
}

/// "+16 p" / "−4 p".
func signed(_ n: Int, unit: String = "") -> String { "\(n > 0 ? "+" : n < 0 ? "−" : "±")\(abs(n))\(unit)" }

// MARK: - Shared pieces of the three sheets

/// A sheet tile (spike AuraSheets): mono label, a big Outfit number, a note with an optional trend triangle.
struct SheetTile: View {
    let label: String, value: String, note: String
    var up: Bool? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            NKMono(label)
            Text(value).font(.nkNumber(28)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
            HStack(spacing: 5) {
                if let up { Trend(up: up, size: 8) }
                Text(note).nkFont(12.5).foregroundStyle(.white.opacity(0.75)).lineLimit(2).minimumScaleFactor(0.8)
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
        .accessibilityElement(children: .combine)
    }
}

/// A glass card with a mono heading.
struct SheetCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            NKMono(title)
            content
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}

/// An honest line where data is missing.
struct SheetEmptyLine: View {
    let text: String
    var body: some View {
        Text(text).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true).padding(.top, 8)
    }
}

/// Boop speaks last: the metric's headline in bold, then its sentence. Nothing when the brief has neither.
@MainActor @ViewBuilder func boopVerdict(_ m: Brief.Metric) -> some View {
    if !m.sentence.isEmpty || !m.headline.isEmpty {
        NKBoopCard(pre: "", em: m.headline.isEmpty ? "" : m.headline + ". ", post: m.sentence)
    }
}
