import SwiftUI
import BoopCore
import BoopDesign

/// Opens the account sheet from inside a page (Ma's title-row avatar); the sheet itself hangs on the shell.
private struct OpenAccountKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable () -> Void = {} }
extension EnvironmentValues {
    var openAccount: @MainActor @Sendable () -> Void {
        get { self[OpenAccountKey.self] }
        set { self[OpenAccountKey.self] = newValue }
    }
}

/// Who is signed in, sign-out (with its confirmation), and the way to the web app.
struct AccountSheet: View {
    let me: Me
    @Environment(\.openURL) private var openURL
    @Environment(Session.self) private var session
    @State private var askingSignOut = false

    var body: some View {
        NKSheetFrame(hue: .forma, eyebrow: "Fiók", title: "A fiókod") {
            EnAccountSection(me: me, asking: $askingSignOut)
            Button { openURL(BoopConfig.webAppURL) } label: {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Webes app").nkFont(17, .medium).foregroundStyle(.white)
                        Text("Ami még csak ott van meg, onnan állítod be").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
                    }
                    Spacer(minLength: 8)
                    Text("Megnyitom").nkFont(15, .semibold).foregroundStyle(.white)
                    Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.8))
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
        }
        .confirmationDialog("Kijelentkezel?", isPresented: $askingSignOut, titleVisibility: .visible) {
            Button("Kijelentkezem", role: .destructive) { session.signOut() }
            Button("Mégse", role: .cancel) {}
        }
    }
}
