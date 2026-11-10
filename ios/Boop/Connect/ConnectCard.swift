import SwiftUI
import BoopCore
import BoopDesign

/// Nap's row for Health + calendar: "Kössük össze…" until connected, then the last arrivals.
/// The flow itself is presented by the page (`connectCover`): presentations attached inside the
/// tab page's scroll content do not present.
struct ConnectCard: View {
    let link: HealthLink
    let onConnect: () -> Void

    var body: some View {
        Group {
            if link.connected {
                Button { Task { await link.syncNow() } } label: {
                    PhotoRow(img: nil, glyph: ("heart", "berry"), title: "Beérkezett adatok", chips: chips, chevron: false)
                }
                .buttonStyle(PressStyle())
            } else {
                Button(action: onConnect) {
                    PhotoRow(img: nil, glyph: ("heart", "berry"), title: "Kössük össze az Egészséget és a naptárat",
                             chips: [Chip(text: "alvás, mozgás, naptár", small: true)])
                }
                .buttonStyle(PressStyle())
            }
        }
    }

    /// Two chips at most: the counts, then one status (refreshing › failed › calendar refused › last refresh).
    private var chips: [Chip] {
        var out: [Chip] = []
        if let last = link.sync.totals ?? link.sync.lastSummary {    // everything synced so far (mezo-r36n9.5)
            out.append(Chip(text: countsChip(last), style: last.nights + last.days + last.workouts == 0 ? .warm : .plain, small: true))
        }
        switch link.sync.phase {
        case .running: out.append(Chip(text: "frissítem…", style: .soft, small: true))
        case .failed: out.append(Chip(text: "nem sikerült frissíteni", style: .warm, small: true))
        default:
            if link.calendarAccess == .denied { out.append(Chip(text: "naptár: nincs engedély", style: .warm, small: true)) }
            else if link.sync.calendarFailed { out.append(Chip(text: "naptár: nem ment át", style: .warm, small: true)) }
            else if let at = link.sync.lastSyncedAt {
                out.append(Chip(text: "frissítve \(at.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits)))", style: .soft, small: true))
            }
        }
        return out
    }
}

extension View {
    /// Presents the connect flow full screen; attach at page level.
    func connectCover(_ link: HealthLink?, isPresented: Binding<Bool>) -> some View {
        fullScreenCover(isPresented: isPresented) {
            if let link { ConnectFlow(link: link, showsBack: true) { isPresented.wrappedValue = false } }
        }
    }
}
