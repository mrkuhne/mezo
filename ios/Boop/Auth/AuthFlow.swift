import SwiftUI
import BoopCore
import BoopDesign

/// Every visible string of sign-in and register (Boop, never Mezo — a test checks).
enum AuthCopy {
    static let signInEyebrow = "Boop", signInTitle = "Jó újra látni", signInSub = "Lépj be a Boop-fiókoddal."
    static let registerEyebrow = "Új fiók", registerTitle = "Kezdjük el", registerSub = "A meghívókóddal regisztrálsz."
    static let signIn = "Belépek", register = "Regisztrálok", haveInvite = "Van meghívókódom", haveAccount = "Már van fiókom"
    static let all = [signInEyebrow, signInTitle, signInSub, registerEyebrow, registerTitle, registerSub, signIn, register, haveInvite, haveAccount]
}

/// The top of both auth screens: wordmark, a living orb, eyebrow, serif title, one line.
private struct AuthHead: View {
    let eyebrow: String, title: String, sub: String, orb: CGFloat
    @State private var motion = OrbMotion()
    var body: some View {
        VStack(spacing: 0) {
            Text("boop").font(.custom(Lagy.outfitFamily, size: 30).weight(.light)).tracking(4).foregroundStyle(.white).padding(.top, 70)
            LivingOrb(palette: Hue.forma.orb, size: orb, level: 0.8, glow: true, motion: motion).allowsHitTesting(false).padding(.top, 26)
            Text(eyebrow.uppercased()).font(.nkMono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75)).padding(.top, 26)
            Text(title).font(.nkSerif(40)).foregroundStyle(.white).padding(.top, 6)
            Text(sub).font(.system(size: 16)).foregroundStyle(.white.opacity(0.8)).padding(.top, 6)
        }
        .onDisappear { motion.stop() }
    }
}

/// Sign-in, with a way to register with an invite code.
struct AuthFlow: View {
    @State private var registering = UserDefaults.standard.bool(forKey: "register")
    var body: some View {
        if registering { RegisterView { registering = false } }
        else { SignInView { registering = true } }
    }
}

struct SignInView: View {
    var onRegister: () -> Void
    @Environment(Session.self) private var session
    @State private var form = AuthForm()
    @State private var shown: [AuthForm.Field: String] = [:]
    @State private var serverError: AuthError?
    @State private var busy = false

    var body: some View {
        NKSkyScreen(hue: .forma, onBack: nil) {
            VStack(spacing: 0) {
                AuthHead(eyebrow: AuthCopy.signInEyebrow, title: AuthCopy.signInTitle, sub: AuthCopy.signInSub, orb: 130)
                VStack(alignment: .leading, spacing: 14) {
                    if let serverError { ServerErrorCard(error: serverError) }
                    NKField("E-mail cím", text: $form.email, kind: .email, content: .username, problem: shown[.email])
                    NKField("Jelszó", text: $form.password, kind: .password, content: .password, problem: shown[.password])
                    NKPill(busy ? "Pillanat…" : AuthCopy.signIn) { if !busy { submit() } }.padding(.top, 10)
                    Button(action: onRegister) {
                        Text(AuthCopy.haveInvite).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                            .frame(maxWidth: .infinity).frame(height: 44)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 28)
            }
        }
        .onChange(of: form) { old, new in
            if old.email != new.email { shown[.email] = nil }
            if old.password != new.password { shown[.password] = nil }
            if old.invite != new.invite { shown[.invite] = nil }
            if old.name != new.name { shown[.name] = nil }
        }
        .sensoryFeedback(.error, trigger: serverError)
    }

    private func submit() {
        shown = form.problems(register: false)
        serverError = nil
        guard shown.isEmpty else { return }
        busy = true
        Task {
            defer { busy = false }
            do { try await session.signIn(email: form.trimmedEmail, password: form.password) }
            catch let e as AuthError { serverError = e } catch { serverError = .server }
        }
    }
}

struct RegisterView: View {
    var onBack: () -> Void
    @Environment(Session.self) private var session
    @State private var form = AuthForm()
    @State private var shown: [AuthForm.Field: String] = [:]
    @State private var serverError: AuthError?
    @State private var busy = false

    var body: some View {
        NKSkyScreen(hue: .forma, onBack: onBack) {
            VStack(spacing: 0) {
                AuthHead(eyebrow: AuthCopy.registerEyebrow, title: AuthCopy.registerTitle, sub: AuthCopy.registerSub, orb: 96)
                VStack(alignment: .leading, spacing: 14) {
                    if let serverError, !isFieldError(serverError) { ServerErrorCard(error: serverError) }
                    NKField("Meghívókód", text: $form.invite, kind: .code, problem: problem(.invite, "inviteCode"))
                    NKField("A neved", text: $form.name, kind: .name, content: .name, problem: problem(.name, "name"))
                    NKField("E-mail cím", text: $form.email, kind: .email, content: .username, problem: problem(.email, "email"))
                    NKField("Jelszó · legalább 8 karakter", text: $form.password, kind: .password, content: .newPassword, problem: problem(.password, "password"))
                    NKPill(busy ? "Pillanat…" : AuthCopy.register) { if !busy { submit() } }.padding(.top, 10)
                    Button(action: onBack) {
                        Text(AuthCopy.haveAccount).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                            .frame(maxWidth: .infinity).frame(height: 44)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 28)
            }
        }
        .onChange(of: form) { old, new in
            if old.email != new.email { shown[.email] = nil }
            if old.password != new.password { shown[.password] = nil }
            if old.invite != new.invite { shown[.invite] = nil }
            if old.name != new.name { shown[.name] = nil }
        }
        .sensoryFeedback(.error, trigger: serverError)
    }

    /// Local rule first, then a server answer for the same field (invite used, e-mail taken, field message).
    private func problem(_ f: AuthForm.Field, _ api: String) -> String? {
        if let p = shown[f] { return p }
        switch serverError {
        case .inviteInvalid? where f == .invite: return hungarianText(.inviteInvalid)
        case .emailTaken? where f == .email: return hungarianText(.emailTaken)
        case .field(let name, let text)? where name == api: return text
        default: return nil
        }
    }
    private func isFieldError(_ e: AuthError) -> Bool {
        switch e { case .inviteInvalid, .emailTaken, .field: true; default: false }
    }

    private func submit() {
        shown = form.problems(register: true)
        serverError = nil
        guard shown.isEmpty else { return }
        busy = true
        Task {
            defer { busy = false }
            do { try await session.register(invite: form.trimmedInvite, email: form.trimmedEmail, password: form.password, name: form.trimmedName) }
            catch let e as AuthError { serverError = e } catch { serverError = .server }
        }
    }
}

private struct ServerErrorCard: View {
    let error: AuthError
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            NKGlyph("repeat-peach", Color(hex: 0xF7A8C4), size: 20)
            Text(hungarianText(error)).font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(18)
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color(hex: 0xF06A9A).opacity(0.6), lineWidth: 1))
    }
}
