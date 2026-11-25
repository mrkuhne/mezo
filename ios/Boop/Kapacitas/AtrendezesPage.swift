import SwiftUI
import BoopCore
import BoopDesign

/// Which proposal *Minden hatása* shows.
struct KapDetailPick: Identifiable, Equatable { let id: String }

/// **Átrendezés** (B7 K3, `mezo-r36n9.17`; spike `KapAtrendezes`, screens 02–04): the week's load against what he
/// can carry, Boop's proposals with their cross-effects, and what was moved before. Every word and figure is the
/// server's (`GET /api/capacity/week`); nothing moves until he accepts, and the season plan never does.
///
/// Offline is an answer: the cached week shows with its age, an accept is queued (the same clientRef), and *Minden
/// hatása* opens from the cache. *Ha mindet jóváhagyod* is left out: the server has no all-at-once figures yet, and a
/// summed guess would be an invented number. *Ebből tanulok* appears once the patterns arrive (K4).
struct AtrendezesPage: View {
    let monday: String
    /// The page it came from („Ma", „Évad").
    var crumb = "Ma"
    let close: @MainActor @Sendable () -> Void

    @Environment(KapacitasStore.self) private var store: KapacitasStore?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Page-level presentation (boop-ios.md §9).
    @State private var detail: KapDetailPick?

    var body: some View {
        let week = store?.weeks[monday]
        let open = store?.openCount(monday: monday) ?? 0
        let head = week.map { kapacitasHead($0, open: open) } ?? (title: "Átrendezés", sentence: "")
        NKAreaSubPage(hue: kapacitasHue, crumb: crumb, eyebrow: "Átrendezés · \(kapacitasWeekLabel(monday: monday))",
                      title: head.title, sentence: head.sentence, onBack: close) {
            if let store, let week {
                content(week, store: store, open: open)
            } else if let problem = store?.weekProblem[monday] {
                NKBare("A heted", hue: kapacitasHue, glyph: "chart-deep",
                       state: .failed(problem == .offline ? "Most nincs net, és ezt a hetet még nem láttam."
                                      : "Most nem érem el a heted.", { Task { await store?.loadWeek(monday: monday) } })) {
                    EmptyView()
                }
            } else {
                NKBare("A heted", hue: kapacitasHue, glyph: "chart-deep", state: .loading) { EmptyView() }
            }
        }
        .task(id: monday) { await store?.loadWeek(monday: monday) }
        .onDisappear { store?.notice = nil }
        .fullScreenCover(item: $detail) { pick in
            MindenHatasaPage(proposalId: pick.id, monday: monday, close: { detail = nil })
                .environment(store)
        }
        .onAppear {
            #if DEBUG
            // Simulator review: `-kapOpen hatas` opens the first proposal's Minden hatása.
            if UserDefaults.standard.string(forKey: "kapOpen") == "hatas" {
                Task {
                    try? await Task.sleep(for: .seconds(1.2))
                    if let id = store?.weeks[monday]?.proposals.first(where: { $0.status == "open" })?.id { detail = KapDetailPick(id: id) }
                }
            }
            #endif
        }
    }

    @ViewBuilder
    private func content(_ week: KapacitasWeek, store: KapacitasStore, open: Int) -> some View {
        let cards = week.proposals.filter { ["open", "accepted", "declined"].contains($0.status) || store.queuedAccepts.contains($0.id) }
        NKBare("A heted", hue: kapacitasHue, glyph: "chart-deep", trailing: "teher és bírás") {
            KapWeekStrip(week: week)
            if let note = dayNote(week) {
                Text(note).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            if week.days.contains(where: { !$0.calendarKnown }) {
                Text("A naptáradat nem látom, ezért most csak a tested jelei számítanak.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .nkStale(store.weekAgeText(monday).map { NKStale(age: $0) })
        if let notice = store.notice {
            Text(notice).nkFont(13).foregroundStyle(.white.opacity(0.7))
                .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
        }
        if !cards.isEmpty {
            NKBare("Boop javaslatai", hue: kapacitasHue, glyph: "spark-cream", trailing: open > 0 ? "\(open) vár rád" : nil) {
                VStack(spacing: 12) {
                    ForEach(cards) { p in
                        ProposalCard(p: p, state: KapCardState.of(p, in: week, queued: store.queuedAccepts),
                                     busy: store.deciding.contains(p.id),
                                     accept: { Task { await store.accept(p, monday: monday) } },
                                     decline: { Task { await store.decline(p, monday: monday) } },
                                     undo: { Task { await store.undo(p, monday: monday) } },
                                     more: { detail = KapDetailPick(id: p.id) })
                    }
                }
                // a settled card folds into its row; reduced motion: it simply changes
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.25),
                           value: cards.map { "\($0.id)\($0.status)" } + store.queuedAccepts.sorted())
            }
        }
        let history = kapacitasHistory(week, shown: Set(cards.map(\.id)))
        if !history.isEmpty {
            NKBare("Korábban áttettük", hue: kapacitasHue, glyph: "repeat-deep") {
                NKRowList(history.map { h in
                    NKAreaRow(id: h.id, glyph: h.glyph, title: h.title, sub: h.sub, value: h.value,
                              state: h.state == "done" ? .done : h.state == "gone" ? .skipped : .normal)
                }, hue: kapacitasHue)
            }
        }
        if !week.patterns.isEmpty {
            NKBare("Ebből tanulok", hue: kapacitasHue, glyph: "spark-deep") {
                NKList(week.patterns.map { (title: $0.line, body: "") }, hue: kapacitasHue)
            }
        }
        NKActions([NKAction(glyph: "repeat-deep", title: "Kérek más javaslatot", primary: true,
                            action: { Task { await store.regenerate(monday: monday) } })], hue: kapacitasHue)
    }

    /// Under the strip: the hardest day's first „why" line, when one of its proposals carries it.
    private func dayNote(_ week: KapacitasWeek) -> String? {
        guard let i = kapacitasHardestDay(week), ["szoros", "tulSok"].contains(week.days[i].verdict) else { return nil }
        let day = week.days[i].date
        return week.proposals.first { $0.status == "open" && $0.day == day }?.why.first
    }
}
