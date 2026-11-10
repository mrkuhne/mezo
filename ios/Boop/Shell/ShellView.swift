import SwiftUI
import BoopCore
import BoopDesign

/// The five domains in the floating bottom bar. In v1 only Nap is Boop's own; the rest point to the web app.
/// Switching pans the page toward the side the tapped domain sits on while the two skies cross-fade.
struct ShellView: View {
    let me: Me
    @SceneStorage("tab") private var tab = "Nap"
    /// +1 when the new domain sits to the right of the old one, −1 to the left.
    @State private var direction: CGFloat = 1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottom) {
            NK.ground.ignoresSafeArea()
            ZStack {
                page(tab)
                    .id(tab)
                    .transition(reduceMotion ? .opacity : .domainPan(direction))
            }
            NKNav(selected: Binding(get: { tab }, set: select))
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder private func page(_ tab: String) -> some View {
        switch tab {
        case "Edzés": WebOnlyTabView(domain: .edzes)
        case "Fuel": WebOnlyTabView(domain: .fuel)
        case "Boop": WebOnlyTabView(domain: .boop)
        case "Én": WebOnlyTabView(domain: .en(me))
        default: NapView()
        }
    }

    /// Direction is set first and the switch animates on the next turn, so the leaving page already
    /// knows which way to go when it is removed.
    private func select(_ new: String) {
        guard new != tab else { return }
        direction = domainDirection(from: tab, to: new)
        DispatchQueue.main.async {
            withAnimation(.smooth(duration: 0.5)) { tab = new }
        }
    }
}

/// +1 when `to` sits right of `from` in the bottom bar, −1 when left (unknown names count as Nap).
func domainDirection(from: String, to: String) -> CGFloat {
    let order = NKNav.items.map(\.label)
    let a = order.firstIndex(of: from) ?? 0, b = order.firstIndex(of: to) ?? 0
    return b >= a ? 1 : -1
}

private struct DomainPan: ViewModifier {
    /// −1…1: where the page sits relative to the screen (0 = in place).
    let shift: CGFloat
    let fade: Double
    func body(content: Content) -> some View {
        content
            .visualEffect { effect, proxy in effect.offset(x: shift * proxy.size.width * 0.45) }
            .opacity(fade)
    }
}

extension AnyTransition {
    /// The new page comes in from the side of the tapped domain and the old one leaves the other way,
    /// a little under half a screen each, while both fade — the two skies blend in the middle.
    static func domainPan(_ direction: CGFloat) -> AnyTransition {
        .asymmetric(
            insertion: .modifier(active: DomainPan(shift: direction, fade: 0), identity: DomainPan(shift: 0, fade: 1)),
            removal: .modifier(active: DomainPan(shift: -direction, fade: 0), identity: DomainPan(shift: 0, fade: 1))
        )
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
