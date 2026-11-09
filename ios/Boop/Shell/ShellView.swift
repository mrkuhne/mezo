import SwiftUI
import BoopCore
import BoopDesign

/// The five domains in the floating bottom bar. In v1 only Nap is Boop's own; the rest point to the web app.
struct ShellView: View {
    let me: Me
    @SceneStorage("tab") private var tab = "Nap"

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case "Edzés": WebOnlyTabView(domain: .edzes)
                case "Fuel": WebOnlyTabView(domain: .fuel)
                case "Boop": WebOnlyTabView(domain: .boop)
                case "Én": WebOnlyTabView(domain: .en(me))
                default: NapEmptyView()
                }
            }
            .id(tab)
            LagyNav(selected: $tab)
        }
    }
}

struct LagyNav: View {
    @Binding var selected: String
    private let items: [(String, String, String)] = [("Nap", "sun", "sun"), ("Edzés", "dumbbell", "berry"), ("Fuel", "plate", "deep"), ("Boop", "spark", "deep"), ("Én", "person", "sage")]
    var body: some View {
        HStack(spacing: 0) {
            ForEach(items, id: \.0) { it in
                let on = it.0 == selected
                Button { selected = it.0 } label: {
                    VStack(spacing: 2) {
                        Glyph(it.1, it.2, size: 26).opacity(on ? 1 : 0.75)
                        Text(it.0).font(.manrope(12, .bold)).foregroundStyle(on ? Lagy.deep : Lagy.mute)
                    }
                    .frame(maxWidth: .infinity).frame(height: 56).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(.horizontal, 6)
        .frame(height: 68)
        .background(Capsule().fill(.white.opacity(0.86)))
        .background(.ultraThinMaterial, in: Capsule())
        .shadow(color: Lagy.ink.opacity(0.22), radius: 20, y: 14)
        .padding(.horizontal, 14)
        .padding(.bottom, 4)
        .sensoryFeedback(.selection, trigger: selected)
        .environment(\.colorScheme, .light)
    }
}

/// "hétfő, 06:50" from the device clock, Hungarian.
func hungarianNow(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "hu_HU")
    f.dateFormat = "EEEE, HH:mm"
    return f.string(from: date)
}

/// Time-of-day greeting: reggel 5–10, napközben 10–18, este 18–5.
func greeting(_ date: Date = Date(), calendar: Calendar = .current) -> String {
    switch calendar.component(.hour, from: date) {
    case 5..<10: "Jó reggelt"
    case 10..<18: "Szép napot"
    default: "Jó estét"
    }
}
