import SwiftUI
import BoopCore
import BoopDesign

// The Sunday weekly review (`mezo-r36n9.196` step 2, spec §4, spike `SpikeReview`): five full-screen pages, a line of
// five dots on top, „Később" top-left (leaves, changes nothing), „Tovább"/„Kész" at the bottom. Only „Kész" on page 5
// marks the week done; proposals on page 3 change only on his own tap.

struct WeeklyReviewFlow: View {
    let window: EvadReviewWindow
    let close: @MainActor @Sendable () -> Void
    @State private var progress: EvadReviewProgress
    @State private var menuOpen = false
    @State private var detail: KapDetailPick?
    @Environment(EvadStore.self) private var store: EvadStore?
    @Environment(KapacitasStore.self) private var kapacitas: KapacitasStore?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(window: EvadReviewWindow, close: @escaping @MainActor @Sendable () -> Void) {
        self.window = window
        self.close = close
        var start = 1
        #if DEBUG
        let p = UserDefaults.standard.integer(forKey: "reviewPage")
        if p > 0 { start = p }
        #endif
        _progress = State(initialValue: EvadReviewProgress(page: start))
    }

    /// DEBUG `-previewOpen review` / `-reviewPage N`: the review opens outside the Sunday window too (this week looked
    /// back on, next week planned). Release: nil.
    static var previewWindow: EvadReviewWindow? {
        #if DEBUG
        let d = UserDefaults.standard
        guard d.integer(forKey: "reviewPage") > 0 || d.string(forKey: "previewOpen") == "review" else { return nil }
        let monday = kapacitasMonday(for: BoopClock.now())
        return EvadReviewWindow(weekMonday: monday, nextMonday: kapacitasNextMonday(after: monday))
        #else
        return nil
        #endif
    }

    private var page: Int { progress.page }

    var body: some View {
        ZStack {
            NKGround(sky: .room(evadHue)).ignoresSafeArea()
            VStack(spacing: 0) {
                NKPhotoSky(sky: .room(evadHue), photo: nil)
                    .frame(height: 520)
                    .clipped()
                    .mask(LinearGradient(stops: [.init(color: .black, location: 0.45), .init(color: .clear, location: 1)],
                                         startPoint: .top, endPoint: .bottom))
                Spacer(minLength: 0)
            }
            .ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        WeeklyReviewIllustration(page: page)
                            .frame(width: 190, height: 170)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 8)
                        VStack(alignment: .leading, spacing: 8) {
                            NKMono("HETI ÁTNÉZÉS · \(page) / 5")
                            Text(weeklyReviewTitles[page - 1]).nkFont(32, design: .serif).foregroundStyle(.white)
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityAddTraits(.isHeader)
                            NKHueText(weeklyReviewSentence(page: page, window: window), hue: evadHue, size: 15)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        pageContent
                    }
                    .padding(.horizontal, 18).padding(.bottom, 30)
                    .id(page)
                    .transition(.opacity)
                }
                .scrollIndicators(.hidden)
                bottom
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(isPresented: $menuOpen) {
            EtelMenuPage(crumb: "Heti átnézés", close: { menuOpen = false })
                .environment(store)
        }
        .fullScreenCover(item: $detail) { pick in
            MindenHatasaPage(proposalId: pick.id, monday: window.nextMonday, close: { detail = nil })
                .environment(kapacitas)
        }
    }

    @ViewBuilder private var pageContent: some View {
        switch page {
        case 1: WeeklyReviewWeekPage(window: window)
        case 2: WeeklyReviewLearnedPage(window: window)
        case 3: WeeklyReviewNextWeekPage(window: window, more: { detail = KapDetailPick(id: $0) })
        case 4: WeeklyReviewMenuPage(status: store?.overview?.menu, open: { menuOpen = true })
        default: WeeklyReviewDonePage(takeaway: takeaway, counts: decisionCounts)
        }
    }

    private var nextWeek: KapacitasWeek? { kapacitas?.weeks[window.nextMonday] }

    /// Proposals he accepted for next week (an accept still queued offline counts).
    private var accepted: [KapacitasProposal] {
        guard let w = nextWeek else { return [] }
        return w.proposals.filter { $0.status == "accepted" || kapacitas?.queuedAccepts.contains($0.id) == true }
    }

    private var decisionCounts: (accepted: Int, declined: Int) {
        (accepted.count, nextWeek?.proposals.filter { $0.status == "declined" }.count ?? 0)
    }

    private var takeaway: String { weeklyReviewTakeaway(accepted: accepted, o: store?.overview) }

    private var topBar: some View {
        HStack {
            Button("Később", action: close)
                .buttonStyle(.plain).nkFont(15, .medium).foregroundStyle(.white)
                .padding(.horizontal, 16).frame(minHeight: 40)
                .glassEffect(.clear.interactive(), in: .capsule)
                .accessibilityHint("Kilép, semmi nem változik")
            Spacer()
            HStack(spacing: 7) {
                ForEach(1...EvadReviewProgress.pageCount, id: \.self) { i in
                    Capsule().fill(i <= page ? Color.white : .white.opacity(0.25))
                        .frame(width: i == page ? 22 : 8, height: 8)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(page). lépés az 5-ből")
            Spacer()
            Color.clear.frame(width: 84, height: 40)
        }
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 6)
    }

    private var bottom: some View {
        HStack(spacing: 10) {
            if page > 1 {
                Button {
                    change { progress.back() }
                } label: {
                    Text("Vissza").nkFont(16, .medium).foregroundStyle(.white)
                        .padding(.horizontal, 20).frame(minHeight: 54)
                        .glassEffect(.clear.interactive(), in: .capsule)
                }
                .buttonStyle(.plain)
            }
            Button {
                if progress.canFinish() { finish() } else { change { progress.next() } }
            } label: {
                Text(progress.canFinish() ? "Kész" : "Tovább").nkFont(17, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(Capsule().fill(.white))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18).padding(.bottom, 10)
    }

    private func change(_ step: () -> Void) {
        if reduceMotion { step() } else { withAnimation(.easeInOut(duration: 0.3)) { step() } }
    }

    /// „Kész": the week is reviewed (on the phone only), next Sunday's notification is re-armed, the flow closes.
    private func finish() {
        let log = weeklyReviewLog()
        log.markDone(window.weekMonday, takeaway: takeaway)
        let hasSeason = store?.overview != nil
        Task { await WeeklyReviewReminder(center: SystemReminderCenter(), log: log).refresh(now: Date(), hasSeason: hasSeason) }
        close()
    }
}

/// Outside the Sunday window (an old notification tapped on Tuesday): when it opens next, and the way back.
struct WeeklyReviewClosed: View {
    let close: @MainActor @Sendable () -> Void
    var body: some View {
        ZStack {
            NKGround(sky: .room(evadHue)).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 18) {
                Spacer()
                WeeklyReviewIllustration(page: 0)
                    .frame(width: 170, height: 150)
                    .frame(maxWidth: .infinity)
                NKMono("HETI ÁTNÉZÉS")
                Text("A heti átnézés vasárnap 18:00-tól nyílik").nkFont(28, design: .serif).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                EvadText("Vasárnap estétől hétfő éjfélig nézheted át a hetedet: hogy ment, mit tanult Boop, és milyen lesz a jövő hét. "
                         + evadReviewCountdown(now: BoopClock.now()).capitalizedFirst + ".")
                Spacer()
                Button(action: close) {
                    Text("Rendben").nkFont(17, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18).padding(.bottom, 10)
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Copy (pure)

let weeklyReviewTitles = ["Hogy ment a hét?", "Mit tanult Boop?", "Milyen lesz a jövő hét?", "Mit eszel jövő héten?", "Kész"]

/// The sentence under each page's title.
func weeklyReviewSentence(page: Int, window: EvadReviewWindow) -> String {
    switch page {
    case 1: "\(evadWeekRange(window.weekMonday)), hétfőtől vasárnapig — a kímélő nap nem számít bele."
    case 2: "Amit ezen a héten megtanultam rólad, és hogy mi lett a korábbi áthelyezésekből."
    case 3: "A jövő heti terhelés a naptárad alapján, és amit Boop átrakna. Te döntesz, egyenként."
    case 4: "A jövő heti menü állapota egy sorban."
    default: "Egy dolog, amire a héten figyelj."
    }
}

/// Page 5's sentence: accepted proposals first, else the plan's sessions and bedtime, else a plain closing line.
func weeklyReviewTakeaway(accepted: [KapacitasProposal], o: EvadOverview?) -> String {
    if let first = accepted.first { return "Erre figyelj: \(first.title)." }
    let sessions = o.map { $0.pillars.block.gymDays.count + $0.pillars.block.sport.count } ?? 0
    let bed = o?.pillars.sleep.bedtime
    switch (sessions > 0, bed) {
    case (true, let b?): return "Tartsd a heti \(sessions) edzést és a \(b) lefekvést."
    case (true, nil): return "Tartsd a heti \(sessions) edzést."
    case (false, let b?): return "Tartsd a \(b) lefekvést."
    default: return "Menj a terv szerint — jövő vasárnap megnézzük, hogy ment."
    }
}

/// Page 4's one line about next week's menu. nil status = no weekly menu in this season.
func weeklyReviewMenuLine(_ m: EvadMenuStatus?) -> String {
    switch m?.status {
    case nil: "Ebben az évadban nincs heti menü."
    case "seeding": "Még nem választottad ki, melyik receptekből álljon a menü."
    case "none": "A jövő heti menü még nem készült el."
    case "proposed": "Kész a javaslat — még nem hagytad jóvá."
    default: "A jövő heti menü jóvá van hagyva."
    }
}
