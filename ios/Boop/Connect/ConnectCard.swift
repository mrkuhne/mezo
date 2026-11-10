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
                    NKRow(glyph: "heart-cream", title: "Beérkezett adatok", tags: tags)
                }
                .buttonStyle(PressStyle())
            } else {
                Button(action: onConnect) {
                    NKRow(glyph: "heart-cream", title: "Kössük össze az Egészséget és a naptárat", tags: [NKTag("alvás, mozgás, naptár")], chevron: true)
                }
                .buttonStyle(PressStyle())
            }
        }
    }

    /// Two chips at most: the counts, then one status (refreshing › failed › calendar refused › last refresh).
    private var tags: [NKTag] {
        var out: [NKTag] = []
        if let last = link.sync.totals ?? link.sync.lastSummary {    // everything synced so far (mezo-r36n9.5)
            out.append(NKTag(countsChip(last), warn: last.nights + last.days + last.workouts == 0))
        }
        switch link.sync.phase {
        case .running: out.append(NKTag("frissítem…"))
        case .failed: out.append(NKTag("nem sikerült frissíteni", warn: true))
        default:
            if link.calendarAccess == .denied { out.append(NKTag("naptár: nincs engedély", warn: true)) }
            else if link.sync.calendarFailed { out.append(NKTag("naptár: nem ment át", warn: true)) }
            else if let at = link.sync.lastSyncedAt {
                out.append(NKTag("frissítve \(at.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits)))"))
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
