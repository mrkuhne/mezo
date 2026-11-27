import SwiftUI
import BoopCore
import BoopDesign

/// Évad › **Most**: the Sunday highlight while the review waits, the week's three bars (hidden while nothing is lived
/// yet), the seven day dots, and what comes next. Every number is the server's adherence judgement; nothing judged →
/// no bars, never a 0.
struct EvadMost: View {
    let o: EvadOverview
    let store: EvadStore
    let open: @MainActor (EvadRoomSub) -> Void
    let openReview: @MainActor () -> Void
    let openDay: @MainActor (String) -> Void
    /// Re-read when the room comes back from the review (the log is a plain file, not observed).
    @State private var reviewDone = false

    private var now: Date { BoopClock.now() }
    private var today: String { evadYMD(now) }
    private var monday: String { kapacitasMonday(for: now) }
    private var window: EvadReviewWindow? { evadReviewWindow(now: now) }

    var body: some View {
        let summary = store.week?.summary
        let early = summary.flatMap(evadWeekScore) == nil
        if let w = window, !reviewDone {
            NKHighlight(hue: evadHue, label: "Vasárnap", text: "Kész a heti átnézés",
                        sub: "Öt rövid lépés: hogy ment a hét, mit tanult Boop, és mi jön. Bármikor abbahagyhatod.",
                        actions: [NKHighlightAction("Átnézem", action: openReview)])
                .id(w.weekMonday)
        }
        if let a = summary, !early {
            EvadCard("A hét eddig · \(evadMostSpan(now: now))", glyph: "most-ink", action: { open(.days) }) {
                VStack(spacing: 16) {
                    ForEach(evadMostBars(a), id: \.key) { EvadBarRow(bar: $0) }
                    if a.excusedDays > 0 { EvadText(evadExcusedLine(a.excusedDays), size: 12.5, opacity: 0.55) }
                }
            }
            .nkStale(penzAgeText(store.weekAge).map { NKStale(age: $0) })
        }
        EvadCard("A hét napjai", glyph: "het-ink", trailing: evadDayNames[evadWeekdayIndex(today, monday: monday)]) {
            EvadDayDotsView(dots: evadDayDots(monday: monday, days: store.week?.days ?? [], today: today), onDay: openDay)
            if early { EvadText("A hét most kezdődött — holnap már látod, hogy indult.", size: 13, opacity: 0.6) }
        }
        let next = upcomingRows
        EvadCard("Ami jön", glyph: "clock-ink") {
            VStack(spacing: 14) {
                if next.isEmpty && window != nil {
                    EvadText("Most semmi különös — a terv szerint mész tovább.")
                }
                ForEach(next, id: \.title) { r in EvadRow(glyph: r.glyph, title: r.title, sub: r.sub) }
                if window == nil {
                    EvadRow(glyph: "atnezes-ink", title: "Heti átnézés vasárnap 18:00-tól", sub: evadReviewCountdown(now: now))
                }
            }
        }
        .onAppear { reviewDone = window.map { weeklyReviewLog().isDone($0.weekMonday) } ?? false }
    }

    private var upcomingRows: [(glyph: String, title: String, sub: String)] {
        o.upcoming.prefix(3).map { u in
            (u.kind == "deload" ? "evad-ink" : "terv-ink",
             u.kind == "deload" ? "A \(u.week). hét könnyebb lesz" : "A \(u.week). héten vége az évadnak",
             u.text)
        }
    }
}

/// "hétfő–csütörtök": Monday to yesterday (the judged span); on Tuesday just "hétfő".
func evadMostSpan(now: Date, calendar: Calendar = .current) -> String {
    let monday = kapacitasMonday(for: now)
    let i = evadWeekdayIndex(evadYMD(now, calendar: calendar), monday: monday)
    guard i >= 1 else { return evadDayNames[0] }
    return i == 1 ? evadDayNames[0] : "\(evadDayNames[0])–\(evadDayNames[i - 1])"
}

/// 0 = Monday … 6 = Sunday for a date inside the week of `monday` (clamped).
func evadWeekdayIndex(_ ymd: String, monday: String) -> Int {
    (0..<7).first { evadAddDays(monday, $0) == ymd } ?? 0
}

/// "3 nap múlva · kb. 3 perc" — how far the next Sunday evening is.
func evadReviewCountdown(now: Date, calendar: Calendar = .current) -> String {
    let i = evadWeekdayIndex(evadYMD(now, calendar: calendar), monday: kapacitasMonday(for: now))
    let days = 6 - i
    let when = days <= 0 ? "ma este" : (days == 1 ? "holnap" : "\(days) nap múlva")
    return "\(when) · kb. 3 perc"
}
