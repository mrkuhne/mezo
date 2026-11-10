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
        NKFlowFrame(hue: .alvas, crumb: "Első lépések · Összekötés", eyebrow: "Egészség és naptár", title: "Kössük össze",
                    sub: "Ebből tudom, milyen napod lesz.", onBack: showsBack ? onSkip : nil) {
            NKRow(glyph: "heart-cream", title: "Apple Egészség", tags: [NKTag("alvás, mozgás, pulzus")])
            NKRow(glyph: "clock-ink", title: "Naptár", tags: calendarTags(link.calendarAccess))
            if link.calendarAccess == .denied {
                Text("A naptárat itt kapcsolhatod be: Beállítások › Boop › Naptárak.")
                    .nkFont(13.5, .medium).foregroundStyle(Color(hex: 0xF7A8C4)).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
            }
            HStack(alignment: .top, spacing: 10) {
                NKGlyph("spark-cream", .white.opacity(0.8), size: 16)
                Text("Amikor az iPhone megkérdezi, mennyi adatot adjon, a teljeset válaszd — így látom mind a 60 napot.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
            NKPill(busy ? "Pillanat…" : "Engedélyezem", glyph: "check-ink") { if !busy { allow() } }.padding(.top, 6)
            Button("Most kihagyom", action: onSkip)
                .nkFont(15, .semibold).foregroundStyle(.white.opacity(0.75))
                .frame(maxWidth: .infinity).frame(height: 44)
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
func calendarTags(_ access: CalendarAccess) -> [NKTag] {
    var tags = [NKTag("ma és holnap")]
    if access == .denied { tags.append(NKTag("nincs engedély", warn: true)) }
    return tags
}
