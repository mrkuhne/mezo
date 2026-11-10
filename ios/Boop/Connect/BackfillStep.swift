import SwiftUI
import BoopCore
import BoopDesign

struct BackfillStep: View {
    let link: HealthLink
    let onDone: () -> Void
    @Environment(Session.self) private var session

    var body: some View {
        NKFlowFrame(hue: .alvas, crumb: "Első lépések · Behúzás", eyebrow: "Egészség és naptár", title: "Behúzom az elmúlt 60 napot",
                    sub: "Pár perc, közben használhatod a telefont.", onBack: nil) {
            switch link.sync.phase {
            case .idle, .running:
                running
            case .done(let summary):
                if let line = summaryLine(summary) {
                    NKBoopCard(pre: line.0, em: line.1, post: line.2)
                } else {
                    failure("Nem látok adatot az Egészségből.", "Nézd meg: Egészség app › Megosztás › Appok › Boop, és kapcsold be.")
                }
                if link.sync.calendarFailed { note("A naptáradat most nem tudtam elküldeni — a következő megnyitáskor újra próbálom.") }
                if link.calendarAccess == .denied { note("A naptárhoz nincs engedélyem — itt kapcsolhatod be: Beállítások › Boop › Naptárak.") }
                NKPill("Tovább", glyph: "check-ink", action: onDone).padding(.top, 6)
            case .failed(let error):
                failure("Megakadtam.", syncErrorText(error))
                Button("Most kihagyom", action: onDone)
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white.opacity(0.75)).frame(maxWidth: .infinity).frame(height: 44)
            }
        }
        .onChange(of: link.sync.phase) { _, p in if p == .failed(.unauthorized) { session.signOut() } }
    }

    private func note(_ t: String) -> some View {
        Text(t).font(.system(size: 13.5, weight: .medium)).foregroundStyle(Color(hex: 0xF7A8C4))
            .fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
    }

    private func failure(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.nkSerif(24)).foregroundStyle(.white)
            Text(text).font(.system(size: 14.5)).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            NKPill("Újra próbálom", primary: false, wide: false) { Task { await link.syncNow() } }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private var progress: Double {
        if case .running(let p) = link.sync.phase { return p }
        return 0
    }

    private var running: some View {
        VStack(spacing: 16) {
            ZStack {
                StillOrb(palette: Hue.alvas.orb, size: 150, level: max(0.08, progress))
                Text("\(Int((progress * 100).rounded())) %").font(.nkNumber(40)).foregroundStyle(.white).monospacedDigit()
                    .contentTransition(.numericText(value: progress)).shadow(color: .black.opacity(0.3), radius: 6)
            }
            Text(countsLine).font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.8)).monospacedDigit()
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity).padding(.vertical, 24).nkGlass()
        .animation(.easeInOut(duration: 0.4), value: progress)
    }

    private var countsLine: String {
        guard let p = link.sync.pending else { return "Éjszakák · napok · edzések" }
        return "\(p.nights) éjszaka · \(p.days) nap · \(p.workouts) edzés"
    }
}
