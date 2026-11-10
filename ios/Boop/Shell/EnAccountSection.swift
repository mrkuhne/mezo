import SwiftUI
import BoopCore
import BoopDesign

/// Én: who is signed in; the sign-out confirmation lives on the page (WebOnlyTabView).
struct EnAccountSection: View {
    let me: Me
    @Binding var asking: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NKMono("A FIÓKOD")
            HStack(spacing: 12) {
                Text(String(me.name.prefix(1))).font(.nkNumber(22)).foregroundStyle(.white).frame(width: 52, height: 52)
                    .background(Circle().fill(.white.opacity(0.12)))
                VStack(alignment: .leading, spacing: 3) {
                    Text(me.name).nkFont(17, .medium).foregroundStyle(.white)
                    Text(me.email).nkFont(13.5).foregroundStyle(.white.opacity(0.6))
                }
                Spacer(minLength: 0)
            }
            NKPill("Kijelentkezés", primary: false) { asking = true }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}
