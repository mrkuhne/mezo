import SwiftUI
import BoopCore
import BoopDesign

/// Én: who is signed in; the sign-out confirmation lives on the page (WebOnlyTabView).
struct EnAccountSection: View {
    let me: Me
    @Binding var asking: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "A fiókod")
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Text(String(me.name.prefix(1))).font(.outfit(20)).foregroundStyle(.white).frame(width: 52, height: 52)
                        .background(Circle().fill(LinearGradient(colors: [Lagy.sage, Lagy.deep], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    VStack(alignment: .leading, spacing: 6) {
                        Text(me.name).font(.outfit(16)).foregroundStyle(Lagy.ink)
                        Chip(text: me.email, small: true)
                    }
                    Spacer(minLength: 0)
                }
                Pill(title: "Kijelentkezés", soft: true) { asking = true }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).lagyCard(22)
        }
    }
}
