import SwiftUI
import BoopCore
import BoopDesign

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
        LagyFlowFrame(photoName: "reggelfeny.jpg", crumb: ("", "Belépés"), eyebrow: "Boop", title: "Jó újra látni",
                      sub: "Lépj be a Boop-fiókoddal.", showsBack: false) {
            VStack(alignment: .leading, spacing: 16) {
                if let serverError { ServerErrorCard(error: serverError) }
                LagyField("E-mail cím", text: $form.email, keyboard: .emailAddress, content: .username, problem: shown[.email])
                LagyField("Jelszó", text: $form.password, secure: true, content: .password, problem: shown[.password])
                WidePill(title: "Belépek", busy: busy) { submit() }.padding(.top, 6)
                Button(action: onRegister) {
                    Text("Van meghívókódom").font(.manrope(14, .bold)).foregroundStyle(Lagy.deep)
                        .frame(maxWidth: .infinity).frame(height: 44)
                }
                .buttonStyle(.plain)
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
        LagyFlowFrame(photoName: "kave.jpg", crumb: ("Belépés › ", "Regisztráció"), eyebrow: "Új fiók", title: "Kezdjük el",
                      sub: "A meghívókóddal regisztrálsz.", onBack: onBack) {
            VStack(alignment: .leading, spacing: 16) {
                if let serverError, !isFieldError(serverError) { ServerErrorCard(error: serverError) }
                LagyField("Meghívókód", text: $form.invite, problem: problem(.invite, "inviteCode"))
                LagyField("A neved", text: $form.name, content: .name, problem: problem(.name, "name"))
                LagyField("E-mail cím", text: $form.email, keyboard: .emailAddress, content: .username, problem: problem(.email, "email"))
                LagyField("Jelszó · legalább 8 karakter", text: $form.password, secure: true, content: .newPassword, problem: problem(.password, "password"))
                WidePill(title: "Regisztrálok", busy: busy) { submit() }.padding(.top, 6)
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
            Glyph("repeat", "peach", size: 22)
            Text(hungarianText(error)).font(.manrope(14, .semibold)).foregroundStyle(Lagy.peachInk)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .lagyCard(18, fill: Lagy.peach2)
    }
}
