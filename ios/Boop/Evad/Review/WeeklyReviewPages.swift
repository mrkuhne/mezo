import SwiftUI
import BoopCore
import BoopDesign

// The Sunday review's five page bodies (`mezo-r36n9.196`, plan Task 15). Each reads what already exists — the season's
// adherence judgement, Boop's insights, the capacity weeks — and invents no number: nothing judged → a sentence.

/// Page 1 · Hogy ment a hét? — the reviewed week's three bars and its seven day dots.
struct WeeklyReviewWeekPage: View {
    let window: EvadReviewWindow
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var week: EvadAdherenceResponse?
    @State private var failed = false

    var body: some View {
        Group {
            if let week {
                if evadWeekScore(week.summary) != nil {
                    EvadCard("A hét · hétfő–vasárnap", glyph: "most-ink") {
                        VStack(spacing: 16) {
                            ForEach(evadMostBars(week.summary), id: \.key) { EvadBarRow(bar: $0) }
                        }
                    }
                } else {
                    EvadText("Ezen a héten még nem volt mit mérni — a jövő héten már látod, hogy ment.")
                }
                EvadCard("A hét napjai", glyph: "het-ink") {
                    VStack(alignment: .leading, spacing: 12) {
                        EvadDayDotsView(dots: evadDayDots(monday: window.weekMonday, days: week.days,
                                                          today: evadYMD(BoopClock.now())))
                        if week.summary.excusedDays > 0 {
                            EvadText(evadExcusedLine(week.summary.excusedDays), size: 13, opacity: 0.6)
                        }
                    }
                }
            } else if failed {
                EvadText("Most nem érem el a heted adatait. Lapozz tovább, vagy nézd meg később.")
            } else {
                ProgressView().tint(.white).frame(maxWidth: .infinity, minHeight: 120)
                    .accessibilityLabel("Töltöm a hetedet")
            }
        }
        .task(id: window.weekMonday) {
            guard week == nil, let client = store?.client else { failed = store?.client == nil; return }
            do throws(PlanFetchError) {
                week = try await client.adherence(from: window.weekMonday, to: evadAddDays(window.weekMonday, 6))
            } catch {
                failed = true
            }
        }
    }
}

/// Page 2 · Mit tanult Boop? — at most three insights, the patterns of his moves, and what became of this week's moves.
struct WeeklyReviewLearnedPage: View {
    let window: EvadReviewWindow
    @Environment(EvadStore.self) private var store: EvadStore?
    @Environment(KapacitasStore.self) private var kapacitas: KapacitasStore?

    var body: some View {
        let insights = Array((store?.overview?.insights ?? []).prefix(3))
        let week = kapacitas?.weeks[window.weekMonday]
        let patterns = week.map { kapacitasPatternRows($0.patterns) } ?? []
        let history = week.map { kapacitasHistory($0, shown: []) } ?? []
        Group {
            if !insights.isEmpty {
                EvadCard("Amit észrevettem", glyph: "spark-cream", trailing: "\(insights.count)") {
                    NKList(insights.map { (title: $0.title, body: $0.body) }, hue: evadHue)
                }
            }
            if !patterns.isEmpty {
                EvadCard("Amit a mozgatásokból tanultam", glyph: "repeat-deep", trailing: "\(patterns.count) minta") {
                    NKList(patterns, hue: evadHue)
                }
            }
            if !history.isEmpty {
                EvadCard("Korábban áttettük", glyph: "repeat-deep") {
                    VStack(spacing: 14) {
                        ForEach(history, id: \.id) { r in
                            EvadRow(glyph: r.glyph, title: r.title, sub: [r.sub, r.valueSub].compactMap { $0 }.joined(separator: " · "),
                                    value: r.value)
                        }
                    }
                }
            }
            if insights.isEmpty && patterns.isEmpty && history.isEmpty {
                EvadText(week == nil && kapacitas?.weekLoading.contains(window.weekMonday) == true
                         ? "Töltöm, mit tanultam…"
                         : "Ezen a héten még nem tanultam újat rólad. Pár hét adat kell, hogy mintákat lássak.")
            }
        }
        .task(id: window.weekMonday) { await kapacitas?.loadWeek(monday: window.weekMonday) }
    }
}

/// Page 3 · Milyen lesz a jövő hét? — next week's load strip and Boop's proposals; each changes only on his tap.
struct WeeklyReviewNextWeekPage: View {
    let window: EvadReviewWindow
    let more: @MainActor (String) -> Void
    @Environment(KapacitasStore.self) private var kapacitas: KapacitasStore?

    var body: some View {
        Group {
            if let kapacitas, let week = kapacitas.weeks[window.nextMonday] {
                EvadCard("Terhelés és bírás", glyph: "het-ink", trailing: evadWeekRange(window.nextMonday)) {
                    KapWeekStrip(week: week, hue: evadHue)
                }
                if kapProposalCards(week, store: kapacitas).isEmpty {
                    EvadCard("Jól néz ki a jövő hét", glyph: "check-ink") {
                        EvadText("Nincs mit átrakni: a napjaid beleférnek abba, amit bírsz.")
                    }
                } else {
                    KapProposalList(week: week, monday: window.nextMonday, store: kapacitas, more: more)
                }
            } else if kapacitas?.weekProblem[window.nextMonday] != nil {
                EvadText("Most nem érem el a jövő hetedet. A javaslatokat később az Évad › Hét lapon is megtalálod.")
            } else {
                ProgressView().tint(.white).frame(maxWidth: .infinity, minHeight: 120)
                    .accessibilityLabel("Töltöm a jövő hetedet")
            }
        }
        .task(id: window.nextMonday) { await kapacitas?.loadWeek(monday: window.nextMonday) }
    }
}

/// Page 4 · Mit eszel jövő héten? — one line about the menu and the way into it (Étel's menu page over the flow).
struct WeeklyReviewMenuPage: View {
    let status: EvadMenuStatus?
    let open: @MainActor () -> Void

    var body: some View {
        EvadCard("Jövő heti menü", glyph: "bowl-cream") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Circle().fill(Hue.fuel.glow).frame(width: 10, height: 10).accessibilityHidden(true)
                    Text(weeklyReviewMenuLine(status)).nkFont(16, .medium).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if status != nil {
                    EvadText("A menüt az Étel szobában nézed meg; utána itt folytatjuk.", size: 13.5)
                    NKActions([NKAction(glyph: "bowl-cream", title: "Megnézem a menüt") { open() }], hue: .fuel)
                }
            }
        }
    }
}

/// Page 5 · Kész — the one thing to watch this week, and what he decided.
struct WeeklyReviewDonePage: View {
    let takeaway: String
    let counts: (accepted: Int, declined: Int)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NKMono("ERRE FIGYELJ A HÉTEN")
            Text(takeaway).nkFont(22, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            if counts.accepted + counts.declined > 0 {
                EvadText("Boop javaslatai: \(counts.accepted) elfogadva, \(counts.declined) kihagyva.", size: 13.5)
            }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        .accessibilityElement(children: .combine)
    }
}
