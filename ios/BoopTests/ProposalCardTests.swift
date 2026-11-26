import Foundation
import Testing
import BoopCore
@testable import Boop

/// B7 K3 Task 19 (`mezo-r36n9.17`): the Átrendezés card's words. A calendar to-do is written down, never written into
/// his calendar; once accepted it waits for him to move the event.
@MainActor
struct ProposalCardTests {
    static func proposal(_ kind: String, status: String = "open", id: String = "p1") -> KapacitasProposal {
        KapacitasProposal(id: id, kind: kind, day: "2026-11-27", status: status, title: "A pénteki review-t tedd át 15:00-ra",
                          move: "péntek 16:00 → 15:00", effectLines: ["A naptáradhoz nem nyúlok"], why: [], effects: [])
    }

    static func week(_ p: KapacitasProposal, adjustment state: String?) -> KapacitasWeek {
        KapacitasWeek(monday: "2026-11-23", days: [], proposals: [p],
                      adjustments: state.map { [KapacitasAdjustment(id: "a1", date: "2026-11-27", kind: p.kind, bundleId: "b1",
                                                                    proposalId: p.id, state: $0)] } ?? [])
    }

    @Test func calendarTodoButtonAndSettledLine() {
        let todo = Self.proposal("CALENDAR_TODO")
        #expect(ProposalCard.primaryTitle(todo) == "Felírom teendőnek")
        #expect(ProposalCard.primaryTitle(Self.proposal("MOVE_SESSION_DAY")) == "Jóváhagyom")

        let accepted = Self.proposal("CALENDAR_TODO", status: "accepted")
        let waiting = KapCardState.of(accepted, in: Self.week(accepted, adjustment: "waiting"), queued: [])
        #expect(waiting == .accepted(todoDone: false, undoable: true))
        #expect(ProposalCard.settledSub(accepted, waiting) == "Várom, hogy átkerüljön a naptáradban")
        #expect(ProposalCard.canUndo(waiting))

        let done = KapCardState.of(accepted, in: Self.week(accepted, adjustment: "done"), queued: [])
        #expect(ProposalCard.settledSub(accepted, done) == "Átkerült a naptáradban")
        #expect(!ProposalCard.canUndo(done))
    }

    @Test func settledStatesAndVissza() {
        let move = Self.proposal("MOVE_SESSION_DAY", status: "accepted")
        let active = KapCardState.of(move, in: Self.week(move, adjustment: "active"), queued: [])
        #expect(ProposalCard.settledSub(move, active) == "Átírtam mindenhol erre a hétre")
        #expect(ProposalCard.canUndo(active))

        let declined = Self.proposal("MOVE_SESSION_DAY", status: "declined")
        let d = KapCardState.of(declined, in: Self.week(declined, adjustment: nil), queued: [])
        #expect(ProposalCard.settledSub(declined, d) == "Nem teszem át. Ezt is feljegyzem.")
        #expect(!ProposalCard.canUndo(d))   // a decline is final on the server

        let open = Self.proposal("MOVE_SESSION_DAY")
        let queued = KapCardState.of(open, in: Self.week(open, adjustment: nil), queued: ["p1"])
        #expect(queued == .queued)
        #expect(ProposalCard.settledSub(open, queued) == "Elküldöm, amint lesz net.")
        #expect(ProposalCard.canUndo(queued))
    }

    @Test func pageHeadAndHistoryWords() {
        let days = [KapacitasWeekDay(date: "2026-11-23", verdict: "rendben", label: "rendben", ratio: 0.7, calendarKnown: true),
                    KapacitasWeekDay(date: "2026-11-26", verdict: "tulSok", label: "túl sok", ratio: 1.2, calendarKnown: true)]
        let w = KapacitasWeek(monday: "2026-11-23", days: days, proposals: [])
        #expect(kapacitasHead(w, open: 4) == ("A csütörtök túl sok lenne",
            "Négy dolgot tennék át ezen a héten. Amíg jóvá nem hagyod, semmi sem mozdul, és az *Évad terve* sem változik."))
        #expect(kapacitasHead(w, open: 0).sentence == "Ezen a héten nincs mit átrendezni.")
        #expect(kapacitasKind(Self.proposal("CALENDAR_TODO")).label == "NAPTÁR · TEENDŐ")

        let undone = Self.proposal("MOVE_SESSION_DAY", status: "undone")
        let rows = kapacitasHistory(Self.week(undone, adjustment: "undone"), shown: [])
        #expect(rows.map(\.value) == ["visszavontad"] && rows.first?.sub == "nov. 27.")
        #expect(kapacitasHistory(Self.week(undone, adjustment: "undone"), shown: ["p1"]).isEmpty)
    }
}
