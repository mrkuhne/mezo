import SwiftUI
import BoopCore
import BoopDesign

struct PermissionsStep: View {
    let link: HealthLink
    let showsBack: Bool
    let onSkip: () -> Void
    let onAllowed: () -> Void
    @State private var busy = false

    var body: some View {
        LagyFlowFrame(photoName: "reggelfeny.jpg", crumb: ("Első lépések › ", "Összekötés"), eyebrow: "Egészség és naptár",
                      title: "Kössük össze", sub: "Ebből tudom, milyen napod lesz.", showsBack: showsBack) {
            VStack(alignment: .leading, spacing: 10) {
                PhotoRow(img: nil, glyph: ("heart", "berry"), title: "Apple Egészség",
                         chips: [Chip(text: "alvás, mozgás, pulzus", small: true)], chevron: false)
                PhotoRow(img: nil, glyph: ("clock", "sky"), title: "Naptár",
                         chips: calendarChips(link.calendarAccess), chevron: false)
                if link.calendarAccess == .denied {
                    Text("A naptárat itt kapcsolhatod be: Beállítások › Boop › Naptárak.")
                        .font(.manrope(13.5, .bold)).foregroundStyle(Lagy.peachInk).fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 4).padding(.top, 6)
                }
                Text("Amikor az iPhone megkérdezi, mennyi adatot adjon, a teljeset válaszd — így látom mind a 60 napot.")
                    .font(.manrope(13.5, .medium)).foregroundStyle(Lagy.ink2).fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 4).padding(.top, 6)
                WidePill(title: "Engedélyezem", glyph: ("check", "sage"), busy: busy) { allow() }
                    .padding(.top, 10)
                Button("Most kihagyom", action: onSkip)
                    .font(.manrope(15, .bold)).foregroundStyle(Lagy.ink2)
                    .frame(maxWidth: .infinity).frame(height: 44)
            }
        }
        .task { await link.refreshCalendarAccess() }
    }

    private func allow() {
        busy = true
        Task {
            await link.requestPermissions()
            busy = false
            onAllowed()
        }
    }
}

/// "ma és holnap", plus "nincs engedély" when the calendar was refused (where to fix it is a line below the rows).
func calendarChips(_ access: CalendarAccess) -> [Chip] {
    var chips = [Chip(text: "ma és holnap", small: true)]
    if access == .denied { chips.append(Chip(text: "nincs engedély", style: .warm, small: true)) }
    return chips
}
