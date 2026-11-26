import SwiftUI
import BoopCore
import BoopDesign

/// Where a proposal stands on the page.
enum KapCardState: Equatable {
    case pending
    /// Accepted without the net: waiting in the outbox.
    case queued
    /// Accepted; `todoDone` = the calendar to-do was seen moved; `undoable` = a step can still be taken back.
    case accepted(todoDone: Bool, undoable: Bool)
    case declined

    /// The card's state from the week, the outbox and the proposal itself.
    static func of(_ p: KapacitasProposal, in week: KapacitasWeek, queued: Set<String>) -> KapCardState {
        if queued.contains(p.id) { return .queued }
        switch p.status {
        case "accepted":
            let rows = week.adjustments.filter { $0.proposalId == p.id }
            return .accepted(todoDone: p.isCalendarTodo && !rows.isEmpty && rows.allSatisfy { $0.state == "done" },
                             undoable: rows.contains { ["active", "waiting"].contains($0.state) })
        case "declined": return .declined
        default: return .pending
        }
    }
}

/// One proposal (spike `KapProposalCard`, screens 02–03): what moves, every cross-effect in short, his decision. A
/// settled card folds into one row with „vissza" while the change can still be taken back.
struct ProposalCard: View {
    let p: KapacitasProposal
    let state: KapCardState
    let busy: Bool
    let accept: () -> Void
    let decline: () -> Void
    let undo: () -> Void
    let more: () -> Void

    /// „Felírom teendőnek" for a calendar to-do (the phone never writes his calendar), else „Jóváhagyom".
    static func primaryTitle(_ p: KapacitasProposal) -> String { p.isCalendarTodo ? "Felírom teendőnek" : "Jóváhagyom" }

    /// The settled row's second line.
    static func settledSub(_ p: KapacitasProposal, _ state: KapCardState) -> String {
        switch state {
        case .pending: ""
        case .queued: "Elküldöm, amint lesz net."
        case .accepted(let done, _):
            p.isCalendarTodo ? (done ? "Átkerült a naptáradban" : "Várom, hogy átkerüljön a naptáradban")
                : "Átírtam mindenhol erre a hétre"
        case .declined: "Nem teszem át. Ezt is feljegyzem."
        }
    }

    /// „vissza" only where it does something: a queued accept leaves the outbox, an accepted change is undone until
    /// its day starts. A decline is final on the server.
    static func canUndo(_ state: KapCardState) -> Bool {
        switch state {
        case .queued: true
        case .accepted(_, let undoable): undoable
        default: false
        }
    }

    var body: some View {
        if state == .pending { pending } else { settled }
    }

    private var pending: some View {
        let kind = kapacitasKind(p)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                NKGlyph(kind.glyph, .white.opacity(0.85), size: 16)
                NKMono(kind.label)
                Spacer()
                Button(action: more) {
                    Text("minden hatása").nkFont(13.5, .semibold).foregroundStyle(.white).underline(pattern: .dot)
                }.buttonStyle(.plain)
            }
            Text(p.title).nkFont(20, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            if !p.move.isEmpty {
                Text(p.move).font(.nkNumber(13.5)).foregroundStyle(kapacitasHue.glow).fixedSize(horizontal: false, vertical: true)
            }
            if !p.effectLines.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(p.effectLines.indices, id: \.self) { i in
                        HStack(alignment: .top, spacing: 10) {
                            NKGlyph(kapacitasLineTopic(p.effectLines[i]).glyph, .white.opacity(0.6), size: 14).padding(.top, 2)
                            Text(p.effectLines[i]).nkFont(13.5).foregroundStyle(.white.opacity(0.75))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(.top, 2)
            }
            HStack(spacing: 10) {
                pill(Self.primaryTitle(p), primary: true, accept)
                pill("Most nem", primary: false, decline)
            }
            .disabled(busy).opacity(busy ? 0.6 : 1)
            .padding(.top, 2)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(24)
    }

    private var settled: some View {
        let ok = state != .declined
        // a to-do still waiting for him to move the event reads warm (spike: NK.under)
        var warm = false
        if case .accepted(let done, _) = state { warm = p.isCalendarTodo && !done }
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(ok ? .white : .white.opacity(0.1))
                NKGlyph(ok ? "check-ink" : "clock-ink", ok ? NK.ground : .white.opacity(0.7), size: 15)
            }.frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.title).nkFont(14.5, .medium).foregroundStyle(.white.opacity(ok ? 1 : 0.6)).lineLimit(2)
                Text(Self.settledSub(p, state)).nkFont(12.5)
                    .foregroundStyle(warm ? NK.under.opacity(0.9) : .white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            if Self.canUndo(state) {
                Button(action: undo) {
                    Text("vissza").nkFont(13, .medium).foregroundStyle(.white.opacity(0.6))
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain).disabled(busy)
            }
        }
        .padding(14)
        .nkGlass(20)
    }

    private func pill(_ t: String, primary: Bool, _ a: @escaping () -> Void) -> some View {
        Button(action: a) {
            Text(t).nkFont(15, .semibold).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(primary ? NK.ground : .white)
                .padding(.horizontal, 18).frame(minHeight: 44)
                .background(Capsule().fill(primary ? .white : .white.opacity(0.1)))
        }.buttonStyle(.plain)
    }
}
