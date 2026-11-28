import SwiftUI
import BoopCore
import BoopDesign

/// The cards *Boop javaslatai* shows: the open, accepted and declined proposals, and any accept still queued offline.
@MainActor func kapProposalCards(_ week: KapacitasWeek, store: KapacitasStore) -> [KapacitasProposal] {
    week.proposals.filter { ["open", "accepted", "declined"].contains($0.status) || store.queuedAccepts.contains($0.id) }
}

/// *Boop javaslatai* for one week (`mezo-r36n9.196`, shared by Átrendezés and the Sunday review's page 3): each
/// proposal with Jóváhagyom / Most nem — nothing is accepted or declined without his explicit tap.
struct KapProposalList: View {
    let week: KapacitasWeek
    let monday: String
    let store: KapacitasStore
    let more: @MainActor (String) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let cards = kapProposalCards(week, store: store)
        let open = store.openCount(monday: monday) ?? 0
        if !cards.isEmpty {
            NKBare("Boop javaslatai", hue: kapacitasHue, glyph: "spark-cream", trailing: open > 0 ? "\(open) vár rád" : nil) {
                VStack(spacing: 12) {
                    ForEach(cards) { p in
                        ProposalCard(p: p, state: KapCardState.of(p, in: week, queued: store.queuedAccepts),
                                     busy: store.deciding.contains(p.id) || store.sendingQueued.contains(p.id),
                                     accept: { Task { await store.accept(p, monday: monday) } },
                                     decline: { Task { await store.decline(p, monday: monday) } },
                                     undo: { Task { await store.undo(p, monday: monday) } },
                                     more: { more(p.id) })
                    }
                }
                // a settled card folds into its row; reduced motion: it simply changes
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.25),
                           value: cards.map { "\($0.id)\($0.status)" } + store.queuedAccepts.sorted())
            }
        }
    }
}
