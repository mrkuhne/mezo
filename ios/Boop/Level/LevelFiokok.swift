import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Fiókok (Google sign-in, spec §12.1: not connected / revoked / connected)
//
// Nothing from Google is ever held here: the browser step returns a one-time code, it goes to the store at once and the
// view keeps only a "signing in" flag and a fixed sentence.

struct LevelFiokok: View {
    let store: LevelStore
    let now: Date
    var toast: (String) -> Void
    /// Asks the room (page level) to confirm and then detach: a presentation inside the scroll content would not sit.
    var onDetach: () -> Void
    @State private var signingIn = false
    @State private var signInError: String?
    @State private var running = false
    @State private var runLine: String?
    @State private var google = GoogleSignIn()
    private let hue = levelHue

    var body: some View {
        Group {
            switch store.mailboxState {
            case .failed(let e) where store.mailbox == nil:
                NKBare("Postafiók", hue: hue, glyph: "e-level",
                       state: .failed(levelErrorText(e), { Task { await store.refresh() } })) { EmptyView() }
            case .idle where store.mailbox == nil, .loading where store.mailbox == nil:
                NKBare("Postafiók", hue: hue, glyph: "e-level", state: .loading) { EmptyView() }
            default:
                switch levelFiokokView(store.mailbox) {
                case .signIn(let can): signInCard(canSignIn: can, revoked: false)
                case .revoked(let can): signInCard(canSignIn: can, revoked: true)
                case .connected(let silent): connected(silent: silent)
                case .unknown:
                    NKBare("Postafiók", hue: hue, glyph: "e-level",
                           state: .failed("A postafiók állapotát most nem tudtam megnézni.", { Task { await store.refresh() } })) { EmptyView() }
                }
            }
        }
    }

    // MARK: Sign in

    private func signInCard(canSignIn: Bool, revoked: Bool) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 14) {
                if revoked {
                    HStack(alignment: .top, spacing: 10) {
                        Circle().fill(levelAmber).frame(width: 9, height: 9).padding(.top, 5)
                        Text(levelGoogleRevokedLine).nkFont(14.5, .semibold).foregroundStyle(levelAmber)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    Text("Belépés a Gmailedbe").nkFont(20, design: .serif).foregroundStyle(.white)
                }
                Text(levelReadOnlyLine).nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true)
                Text(levelNeverLine).nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true)
                if !canSignIn {
                    Text(levelGoogleUnconfiguredLine).nkFont(13.5).lineSpacing(3).foregroundStyle(levelAmber)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let signInError {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.circle").nkFont(14, .semibold).foregroundStyle(levelAmber)
                        Text(signInError).nkFont(13.5).lineSpacing(3).foregroundStyle(levelAmber).fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
                Button { Task { await signIn() } } label: {
                    HStack(spacing: 8) {
                        if signingIn { ProgressView().tint(NK.ground).controlSize(.small) }
                        Text(signingIn ? "Belépek…" : "Belépés Google-lel").nkFont(16, .semibold)
                    }
                    .foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity).frame(height: 50).background(Capsule().fill(.white))
                    .opacity(canSignIn && !signingIn ? 1 : 0.5).contentShape(Capsule())
                }
                .buttonStyle(.plain).disabled(!canSignIn || signingIn)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
            Text(levelICloudLine).nkFont(12.5).lineSpacing(3).foregroundStyle(.white.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func signIn() async {
        guard let clientId = store.mailbox?.googleClientId, !clientId.isEmpty else {
            signInError = levelGoogleUnconfiguredLine
            return
        }
        signingIn = true
        signInError = nil
        defer { signingIn = false }
        switch await google.signIn(clientId: clientId) {
        case .cancelled:
            break
        case .failed:
            signInError = levelGoogleRefusedLine
        case .code(let code, let verifier, let redirectUri):
            let outcome = await store.connectGoogle(code: code, codeVerifier: verifier, redirectUri: redirectUri)
            if outcome == .connected {
                toast("Összekötöttem a Gmailedet")
                await store.refresh()
            } else {
                signInError = levelGoogleOutcomeLine(outcome)
            }
        }
    }

    // MARK: Connected

    private func connected(silent: Bool) -> some View {
        let green = Color(hex: 0x5FD08A)
        return Group {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    ZStack { Circle().fill(hue.glow.opacity(0.22)); LevelGlyph(color: hue.glow, size: 20) }.frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(store.mailbox?.address ?? "").nkFont(16, .semibold).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                        Text(levelLastRunLine(store.mailbox, now: now)).nkFont(13).foregroundStyle(.white.opacity(0.6))
                    }
                }
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                HStack(alignment: .top, spacing: 10) {
                    Circle().fill(silent ? levelAmber : green).frame(width: 9, height: 9).padding(.top, 5)
                    Text(silent ? "Két futás óta nem jött új levél." : "Rendben")
                        .nkFont(14.5, .semibold).lineSpacing(3).foregroundStyle(silent ? levelAmber : green)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
            .nkStale(store.mailboxIsStale ? NKStale(age: "Nincs net — az utolsó ismert állapot") : nil)
            HStack(spacing: 10) {
                Button { Task { await runNow() } } label: {
                    HStack(spacing: 8) {
                        if running { ProgressView().tint(NK.ground).controlSize(.small) }
                        Text("Átnézés most").nkFont(15, .semibold)
                    }
                    .foregroundStyle(NK.ground).frame(maxWidth: .infinity).frame(height: 48).background(Capsule().fill(.white))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain).disabled(running)
                Button { onDetach() } label: {
                    Text("Lecsatolás").nkFont(15, .semibold).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 48).background(Capsule().fill(.white.opacity(0.1)))
                        .overlay(Capsule().stroke(.white.opacity(0.2))).contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            if let runLine {
                Text(runLine).nkFont(13.5).foregroundStyle(levelAmber).transition(.opacity)
            }
            Text(levelDetachMessage)
                .nkFont(12.5).lineSpacing(3).foregroundStyle(.white.opacity(0.5))
        }
    }

    private func runNow() async {
        running = true
        runLine = nil
        defer { running = false }
        switch await store.runNow() {
        case .done:
            toast("Elindítottam az átnézést")
            await store.refresh()
        case .cooldown:
            runLine = levelCooldownLine
        case .failed(let e):
            runLine = levelErrorText(e)
        case .ignored:
            break
        }
    }
}
