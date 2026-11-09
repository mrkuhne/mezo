import SwiftUI
import BoopCore
import BoopDesign

struct BackfillStep: View {
    let link: HealthLink
    let onDone: () -> Void
    @Environment(Session.self) private var session

    var body: some View {
        LagyFlowFrame(photoName: "reggelfeny.jpg", crumb: ("Első lépések › ", "Behúzás"), eyebrow: "Egészség és naptár",
                      title: "Behúzom az elmúlt 60 napot", showsBack: false) {
            VStack(alignment: .leading, spacing: 18) {
                switch link.sync.phase {
                case .idle, .running:
                    running
                case .done(let summary):
                    if let line = summaryLine(summary) {
                        BoopCard(pre: line.0, em: line.1, post: line.2)
                    } else {
                        ErrorCard(title: "Nem látok adatot az Egészségből.",
                                  text: "Nézd meg: Egészség app › Megosztás › Appok › Boop, és kapcsold be.") {
                            Task { await link.syncNow() }
                        }
                    }
                    if link.sync.calendarFailed {
                        Text("A naptáradat most nem tudtam elküldeni — a következő megnyitáskor újra próbálom.")
                            .font(.manrope(13.5, .bold)).foregroundStyle(Lagy.peachInk).fixedSize(horizontal: false, vertical: true)
                    }
                    if link.calendarAccess == .denied {
                        Text("A naptárhoz nincs engedélyem — itt kapcsolhatod be: Beállítások › Boop › Naptárak.")
                            .font(.manrope(13.5, .bold)).foregroundStyle(Lagy.peachInk).fixedSize(horizontal: false, vertical: true)
                    }
                    WidePill(title: "Tovább", glyph: ("check", "sage"), action: onDone)
                case .failed(let error):
                    ErrorCard(title: "Megakadtam.", text: syncErrorText(error)) { Task { await link.syncNow() } }
                    Button("Most kihagyom", action: onDone)
                        .font(.manrope(15, .bold)).foregroundStyle(Lagy.ink2).frame(maxWidth: .infinity).frame(height: 44)
                }
            }
        }
        .onChange(of: link.sync.phase) { _, p in if p == .failed(.unauthorized) { session.signOut() } }
    }

    private var progress: Double {
        if case .running(let p) = link.sync.phase { return p }
        return 0
    }

    private var running: some View {
        VStack(spacing: 16) {
            BoopFigure(size: 160, level: max(0.08, progress))
            Text(countsLine).font(.manrope(15, .bold)).foregroundStyle(Lagy.ink2).monospacedDigit()
                .contentTransition(.numericText())
            Text("\(Int((progress * 100).rounded())) %").font(.outfit(28)).foregroundStyle(Lagy.deep).monospacedDigit()
                .contentTransition(.numericText(value: progress))
        }
        .frame(maxWidth: .infinity).padding(.vertical, 20).lagyCard()
        .animation(.easeInOut(duration: 0.4), value: progress)
    }

    private var countsLine: String {
        guard let p = link.sync.pending else { return "Éjszakák · napok · edzések" }
        return "\(p.nights) éjszaka · \(p.days) nap · \(p.workouts) edzés"
    }
}
