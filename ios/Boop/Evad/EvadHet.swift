import SwiftUI
import BoopCore
import BoopDesign

/// The Hét tab's hero card: the Sunday review waiting, done this window, last week's takeaway, or nothing yet.
enum EvadReviewCardState: Equatable { case available, done(String), lastWeek(String), none }

/// In the window and not done → .available; done in this window → .done(its takeaway); outside it with a logged week →
/// .lastWeek(that takeaway); nothing logged → .none.
func evadReviewCardState(window: EvadReviewWindow?, log: (week: String, takeaway: String)?, doneThisWindow: Bool) -> EvadReviewCardState {
    if let window {
        if doneThisWindow, let log, log.week == window.weekMonday { return .done(log.takeaway) }
        return .available
    }
    if let log { return .lastWeek(log.takeaway) }
    return .none
}

/// „Amit Boop tanult" count: the stats rows shown, the patterns, and at most three insights.
func evadLearnedCount(season: KapacitasSeasonLoad?, insights: [EvadInsight]) -> Int {
    let stats = season.map { kapacitasSeasonStats($0.stats).count } ?? 0
    return stats + (season?.patterns.count ?? 0) + min(3, insights.count)
}

/// Évad › **Hét**: the weekly review card, load and recovery over the season, next week with Boop's proposals, Boop's
/// lighter-week word (rule #121: it only tells), and what Boop has learned.
struct EvadHet: View {
    let o: EvadOverview
    let store: EvadStore
    let open: @MainActor (EvadRoomSub) -> Void
    let openReview: @MainActor () -> Void
    @Environment(KapacitasStore.self) private var kapacitas: KapacitasStore?
    @Environment(\.openDestination) private var openDestination
    @State private var log: (week: String, takeaway: String)?
    @State private var doneThisWindow = false

    private var window: EvadReviewWindow? { evadReviewWindow(now: BoopClock.now()) }
    private var nextMonday: String { kapacitasNextMonday(after: kapacitasMonday(for: BoopClock.now())) }

    var body: some View {
        reviewCard
        if let s = kapacitas?.season, !s.weeks.isEmpty {
            EvadCard("Teher és pihenés", glyph: "bolt-ink", trailing: "\(s.weeks.count) hét", action: { open(.load) }) {
                VStack(alignment: .leading, spacing: 12) {
                    if let h = s.headline {
                        Text(h).nkFont(16, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    }
                    NKSeasonLoadChart(weeks: evadLoadWeeks(s), nowIndex: s.weeks.firstIndex { $0.week == s.nowWeek }, hue: evadHue)
                }
            }
            .nkStale(kapacitas?.ageText.map { NKStale(age: $0) })
        }
        nextWeek
        if let hint = kapacitas?.season?.deloadForward {
            EvadCard("Boop javaslata", glyph: "chat-ink") {
                VStack(alignment: .leading, spacing: 12) {
                    Text(hint.title).nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    EvadText(hint.body)
                    NKActions([NKAction(glyph: "chat-ink", title: "Megbeszélem Boop-pal") { openDestination(.chat) }], hue: evadHue)
                }
            }
        }
        let learned = evadLearnedCount(season: kapacitas?.season, insights: o.insights)
        if learned > 0 {
            EvadCard("Amit Boop tanult", glyph: "spark-cream", trailing: "\(learned)", action: { open(.learned) }) {
                HStack(spacing: 10) {
                    let s = kapacitas?.season
                    chip(s.map { kapacitasSeasonStats($0.stats).count } ?? 0, "szám rólad")
                    chip(s?.patterns.count ?? 0, "minta")
                    chip(min(3, o.insights.count), "észrevétel")
                }
            }
        }
        Color.clear.frame(height: 0)
            .task {
                await kapacitas?.load()
                await kapacitas?.loadWeek(monday: nextMonday)
            }
            .onAppear(perform: readLog)
    }

    private func readLog() {
        let l = weeklyReviewLog()
        log = l.last
        doneThisWindow = window.map { l.isDone($0.weekMonday) } ?? false
    }

    @ViewBuilder private var reviewCard: some View {
        let state = evadReviewCardState(window: window, log: log, doneThisWindow: doneThisWindow)
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 16) {
                WeeklyReviewIllustration(page: 0).frame(width: 92, height: 92)
                VStack(alignment: .leading, spacing: 4) {
                    NKMono("HETI ÁTNÉZÉS")
                    Text(reviewTitle(state)).nkFont(20, design: .serif).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(state == .available ? "Öt rövid lépés, kb. három perc." : "A következő: vasárnap 18:00-tól")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
            }
            switch state {
            case .done(let t), .lastWeek(let t):
                HStack(alignment: .top, spacing: 10) {
                    Capsule().fill(evadHue.glow).frame(width: 3)
                    Text(t).nkFont(15, design: .serif).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                }
            default: EmptyView()
            }
            if state == .available {
                NKActions([NKAction(glyph: "atnezes-ink", title: "Kezdjük", primary: true, action: openReview)], hue: evadHue)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
        .accessibilityElement(children: .contain)
    }

    private func reviewTitle(_ s: EvadReviewCardState) -> String {
        switch s {
        case .available: "Kész a heti átnézés"
        case .done: "Kész · ezen a héten"
        case .lastWeek: "Amit múltkor elhatároztál"
        case .none: "Vasárnap este átnézheted a hetet"
        }
    }

    /// *A jövő heted*: the next week's strip and, while it has open proposals, the way into Átrendezés.
    @ViewBuilder private var nextWeek: some View {
        let m = nextMonday
        if let week = kapacitas?.weeks[m] {
            let n = kapacitas?.openCount(monday: m) ?? 0
            EvadCard("A jövő heted", glyph: "het-ink", trailing: n > 0 ? "\(n) javaslat" : kapacitasWeekLabel(monday: m),
                     action: n > 0 ? { open(.atrendezes) } : nil) {
                VStack(alignment: .leading, spacing: 12) {
                    KapWeekStrip(week: week, hue: evadHue)
                    EvadText(n > 0 ? "Boop \(n) dolgot tenne át, hogy kiférjen a heted." : "Jól néz ki a jövő hét — nincs mit áttenni.")
                }
            }
            .nkStale(kapacitas?.weekAgeText(m).map { NKStale(age: $0) })
        }
    }

    private func chip(_ n: Int, _ word: String) -> some View {
        VStack(spacing: 2) {
            Text("\(n)").font(.custom(Lagy.outfitFamily, size: 26).weight(.light)).foregroundStyle(.white)
            Text(word).nkFont(11.5).foregroundStyle(.white.opacity(0.6)).lineLimit(2).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
    }
}
