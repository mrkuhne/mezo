import SwiftUI
import BoopCore
import BoopDesign

/// The five domains in the floating bottom bar. In v1 only Nap is Boop's own; the rest point to the web app.
struct ShellView: View {
    let me: Me
    @SceneStorage("tab") private var tab = "Nap"

    var body: some View {
        ZStack(alignment: .bottom) {
            NK.ground.ignoresSafeArea()
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
            NKNav(selected: $tab)
        }
        .preferredColorScheme(.dark)
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
