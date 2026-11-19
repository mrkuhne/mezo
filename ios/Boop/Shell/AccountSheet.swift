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

/// Who is signed in, sign-out (with its confirmation).
struct AccountSheet: View {
    let me: Me
    @Environment(Session.self) private var session
    @State private var askingSignOut = false

    var body: some View {
        NKSheetFrame(hue: .forma, eyebrow: "Fiók", title: "A fiókod") {
            EnAccountSection(me: me, asking: $askingSignOut)
        }
        .confirmationDialog("Kijelentkezel?", isPresented: $askingSignOut, titleVisibility: .visible) {
            Button("Kijelentkezem", role: .destructive) { session.signOut() }
            Button("Mégse", role: .cancel) {}
        }
    }
}
