import SwiftUI
import BoopCore
import BoopDesign

/// Boop's proposals of the day, shared by Ma (at MOST / in the morning plan) and the domain rooms (section 4), and
/// the "miért?" page the page level presents. Nothing changes without a tap: *Elfogadom* applies, *Most nem* hides
/// the proposal for today only (the dismissed keys carry the date and persist).
@MainActor @Observable
final class ProposalDesk {
    static let dismissedKey = "dismissedProposals"

    /// Proposals settled this session: they stay on screen as a quiet row after the brief stops sending them.
    var settled: [(proposal: Proposal, state: NKProposalState)] = []
    /// An accept in flight (the cards dim and wait).
    var busy = false
    /// The proposal whose "miért?" page is open.
    var why: Proposal?
    private let defaults: UserDefaults
    private(set) var dismissedRaw: String {
        didSet { defaults.set(dismissedRaw, forKey: Self.dismissedKey) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        dismissedRaw = defaults.string(forKey: Self.dismissedKey) ?? ""
    }

    func pending(_ brief: Brief, now: Date) -> [Proposal] {
        Proposals.from(brief, now: now, dismissed: dismissedSet(from: dismissedRaw))
    }

    /// Pending first, then the settled ones the brief no longer sends (an undone move comes back as pending).
    func shown(_ brief: Brief, now: Date) -> [(proposal: Proposal, state: NKProposalState)] {
        let p = pending(brief, now: now)
        let ids = Set(p.map(\.id))
        return p.map { ($0, NKProposalState.pending) } + settled.filter { !ids.contains($0.proposal.id) }
    }

    func state(of p: Proposal, _ brief: Brief, now: Date) -> NKProposalState {
        if pending(brief, now: now).contains(where: { $0.id == p.id }) { return .pending }
        return settled.first { $0.proposal.id == p.id }?.state ?? .pending
    }

    private func settle(_ p: Proposal, _ s: NKProposalState) {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
            settled.removeAll { $0.proposal.id == p.id }
            settled.append((p, s))
        }
    }

    /// *Elfogadom*: the same move as the session card (toast with undo); on failure the card stays pending.
    func accept(_ p: Proposal, brief: Brief, store: MorningStore, ctx: MaiContext) {
        guard !busy, !store.moving else { return }
        switch p.kind {
        case .moveSession(let time):
            busy = true
            Task { @MainActor in
                await moveSession(store, to: time, planned: brief.day.session?.plannedTime, toast: ctx.toast, undoToast: ctx.undoToast)
                busy = false
                if moveProblemToast(store.problem) == nil { settle(p, .accepted(p.acceptedLine)) }
            }
        }
    }

    /// *Most nem*: hidden for today only (the key carries the date).
    func dismiss(_ p: Proposal, brief: Brief, toast: (String) -> Void) {
        var keys = dismissedSet(from: dismissedRaw)
        keys.insert(Proposals.dismissKey(date: brief.date, id: p.id))
        dismissedRaw = dismissedString(keys)
        settle(p, .dismissed(p.text))
        toast(MaText.dismissed)
    }
}

/// Which room a proposal belongs to (its section 4): a session move is Mozgás's.
func proposalHue(_ kind: Proposal.Kind) -> Hue {
    switch kind {
    case .moveSession: .mozgas
    }
}

/// The proposal cards of one place (Ma's MOST, the morning plan, a room's section 4).
struct ProposalCards: View {
    let items: [(proposal: Proposal, state: NKProposalState)]
    let compact: Bool
    let desk: ProposalDesk
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext

    var body: some View {
        VStack(spacing: 10) {
            ForEach(items, id: \.proposal.id) { item in
                NKProposalCard(text: item.proposal.text, sub: item.proposal.sub, state: item.state, compact: compact,
                               onAccept: { desk.accept(item.proposal, brief: brief, store: store, ctx: ctx) },
                               onDismiss: { desk.dismiss(item.proposal, brief: brief, toast: ctx.toast) },
                               onWhy: { desk.why = item.proposal })
                    .opacity(desk.busy ? 0.6 : 1)
                    .disabled(desk.busy)
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: items.map(\.proposal.id))
    }
}

/// The "miért?" page of a proposal: the facts, the experts' voices, Boop's closing line, and the decision.
struct ProposalWhySheet: View {
    let proposal: Proposal
    let desk: ProposalDesk
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext

    var body: some View {
        let p = proposal
        let s = desk.state(of: p, brief, now: ctx.now)
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                NKWhyBody(title: p.text, sub: p.sub,
                          facts: p.facts.map { (value: $0.value, unit: $0.unit, label: $0.label) },
                          experts: p.experts.map { (label: $0.field.label, palette: expertPalette($0.field), text: $0.text,
                                                    doubt: $0.field == .szkeptikus) },
                          closing: MaText.whyClosing)
                Group {
                    if s == .pending {
                        HStack(spacing: 10) {
                            NKPill("Elfogadom", wide: false) { desk.why = nil; desk.accept(p, brief: brief, store: store, ctx: ctx) }
                            NKPill("Most nem", primary: false, wide: false) { desk.why = nil; desk.dismiss(p, brief: brief, toast: ctx.toast) }
                        }
                    } else {
                        Text(s == .accepted(p.acceptedLine) ? "Ezt már elfogadtad." : "Ezt most félretetted.")
                            .nkFont(14).foregroundStyle(.white.opacity(0.55))
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 40)
            }
        }
        .scrollIndicators(.hidden)
        .presentationDetents([.large])
        .presentationBackground(NK.ground)
        .presentationCornerRadius(34)
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }
}
