import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The words of a session move

/// "-ra" or "-re" after a clock time, by how it is said aloud: "18:00" = "tizennyolc óra" (-ra), "18:30" = "harminc"
/// (-ra), "18:45" = "negyvenöt" (-re). The minutes' last spoken word decides; whole hours end on "óra".
func timeSuffix(_ hhmm: String) -> String {
    let parts = hhmm.split(separator: ":")
    guard parts.count == 2, let m = Int(parts[1]) else { return "ra" }
    if m == 0 { return "ra" }
    let unit = m % 10
    if unit != 0 {
        // egy, kettő, négy, öt, hét, kilenc → -re; három, hat, nyolc → -ra
        return [3, 6, 8].contains(unit) ? "ra" : "re"
    }
    // tíz, negyven, ötven → -re; húsz, harminc → -ra
    return [20, 30].contains(m) ? "ra" : "re"
}

func moveButtonTitle(_ time: String) -> String { "Áttolom \(time)-\(timeSuffix(time))" }
func movedToast(_ time: String) -> String { "Áttettem \(time)-\(timeSuffix(time))" }
func undoneToast(_ time: String) -> String { "Visszatettem \(time)-\(timeSuffix(time))" }
func undoTitle(_ time: String) -> String { "Vissza \(time)-\(timeSuffix(time))" }

/// After a move: nil = it worked; otherwise what to tell.
func moveProblemToast(_ p: MorningProblem?) -> String? {
    switch p {
    case nil: nil
    case .noSession?: "Ma nincs edzés, amit áttehetnék"
    case .offline?: "Most nem érem el a szervert, próbáld újra"
    default: "Most nem sikerült áttenni"
    }
}

/// A session whose time differs from the planned one has been moved (its conflict is settled).
func sessionMoved(planned: String?, time: String?) -> Bool { planned != nil && time != nil && time != planned }

// MARK: - Moving the session (shared by the Mozgás path card and the A napod sheet)

/// Moves today's session, then tells: the problem, or "Áttettem HH:mm-ra" with an undo that puts it back.
@MainActor
func moveSession(_ store: MorningStore, to time: String, planned: String?,
                 toast: @escaping (String) -> Void, undoToast: @escaping (String, @escaping () -> Void) -> Void) async {
    guard !store.moving else { return }      // one move or undo at a time, whichever path asked
    await store.moveSession(to: time)
    if let problem = moveProblemToast(store.problem) { toast(problem); return }
    undoToast(movedToast(time)) { Task { @MainActor in await undoSessionMove(store, planned: planned, toast: toast) } }
}

/// Puts the session back to its planned time and says so (or that it did not work).
@MainActor
func undoSessionMove(_ store: MorningStore, planned: String?, toast: (String) -> Void) async {
    guard !store.moving else { return }
    await store.undoMove()
    if store.problem != nil { toast(SessionText.undoFailed) } else if let planned { toast(undoneToast(planned)) }
}

enum SessionText {
    static let undo = "Visszavonom"
    static let undoFailed = "Most nem sikerült visszatenni"
    static let start = "Indítom"
}

// MARK: - The session card on the Mozgás path

/// Today's session hanging off the path (spec §5.1a, Mozgás): the exercises as a sideways strip, the conflict in
/// Boop's words and "Áttolom HH:mm-ra" → move, toast with undo, the brief reloads. Without a conflict: start (S4).
struct SessionCard: View {
    let session: Brief.Session
    let conflict: Brief.Conflict?
    let store: MorningStore
    let toast: (String) -> Void
    let undoToast: (String, @escaping () -> Void) -> Void
    @State private var busy = false

    private var moved: Bool { sessionMoved(planned: session.plannedTime, time: session.time) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !session.exercises.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(Array(session.exercises.enumerated()), id: \.offset) { _, e in
                            VStack(alignment: .leading, spacing: 4) {
                                NKGlyph("dumbbell-ink", .white.opacity(0.8), size: 16)
                                Text(e.name).nkFont(14, .medium).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.7)
                                Text("\(e.sets) sorozat").nkFont(11, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                            }
                            .padding(12)
                            .frame(width: 128, height: 96, alignment: .topLeading)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .padding(.horizontal, -14).contentMargins(.horizontal, 14)
            }
            if let conflict, !moved, !store.conflictKept {
                Text(conflict.text).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 10) {
                // the station line above already says how long and how many exercises
                Spacer(minLength: 0)
                if moved, let planned = session.plannedTime {
                    smallPill(undoTitle(planned), primary: false) { undo(to: planned) }
                } else if let conflict, !store.conflictKept {
                    smallPill(moveButtonTitle(conflict.suggestedTime), primary: true) { move(to: conflict.suggestedTime) }
                } else {
                    smallPill(SessionText.start, primary: true) { toast(soonToast("Edzés")) }
                }
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
    }

    private func move(to time: String) {
        guard !busy else { return }
        busy = true
        Task { @MainActor in
            await moveSession(store, to: time, planned: session.plannedTime, toast: toast, undoToast: undoToast)
            busy = false
        }
    }

    private func undo(to planned: String?) {
        guard !busy else { return }
        busy = true
        Task { @MainActor in
            await undoSessionMove(store, planned: planned, toast: toast)
            busy = false
        }
    }

    private func smallPill(_ title: String, primary: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(13.5, .semibold).foregroundStyle(primary ? NK.ground : .white).lineLimit(1).fixedSize()
                .padding(.horizontal, 13).padding(.vertical, 8)
                .background(Capsule().fill(primary ? .white : .white.opacity(0.14)))
                .opacity(busy || store.moving ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(busy || store.moving)
    }
}
