import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Fiókok (level-4 guide + form, level-5 connected, level-5b stalled)
//
// The app password is typed into a `SecureField`, copied into one local constant the moment he taps Összekötés and
// cleared from the field before anything is sent. It is never logged, cached, stored in view state beyond the
// field, or put into an error line (`levelConnectError` is a fixed sentence).

struct LevelFiokok: View {
    let store: LevelStore
    let now: Date
    var toast: (String) -> Void
    /// Asks the room (page level) to confirm and then detach: a presentation inside the scroll content would not sit.
    var onDetach: () -> Void
    @State private var address = ""
    @State private var secret = ""
    @State private var connecting = false
    @State private var formError: String?
    @State private var running = false
    @State private var runLine: String?
    @FocusState private var focus: Field?
    private enum Field { case address, secret }
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
                switch levelMailboxMode(store.mailbox) {
                case .needsConnect: guide; form(revoked: false)
                case .authFailed: revokedCard; form(revoked: true)
                case .connected(let silent): connected(silent: silent)
                case .unknown:
                    NKBare("Postafiók", hue: hue, glyph: "e-level",
                           state: .failed("A postafiók állapotát most nem tudtam megnézni.", { Task { await store.refresh() } })) { EmptyView() }
                }
            }
        }
    }

    // MARK: Guide + form

    private var guide: some View {
        NKBare("Hat lépés", hue: hue, glyph: "check-ink") {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(levelGuideSteps.enumerated()), id: \.offset) { i, s in
                    HStack(alignment: .top, spacing: 14) {
                        Text("\(i + 1)").font(.custom(Lagy.outfitFamily, size: 18).weight(.medium)).foregroundStyle(hue.glow)
                            .frame(width: 34, height: 34).background(Circle().fill(hue.glow.opacity(0.16)))
                            .overlay(Circle().stroke(hue.glow.opacity(0.4)))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(s.title).nkFont(15, .semibold).foregroundStyle(.white)
                            Text(s.body).nkFont(13).lineSpacing(3).foregroundStyle(.white.opacity(0.62))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.vertical, 12).accessibilityElement(children: .combine)
                    if i < levelGuideSteps.count - 1 { LevelHairline(inset: 48) }
                }
            }
        }
    }

    private func form(revoked: Bool) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            NKMono("ÖSSZEKÖTÉS")
            field("Boop-fiók címe", text: $address, secure: false)
            field("Alkalmazásjelszó", text: $secret, secure: true)
            Text("A saját jelszavadat soha nem kérem. Az alkalmazásjelszót bármikor visszavonhatod, és akkor a Boop azonnal elveszti a hozzáférést.")
                .nkFont(12.5).lineSpacing(3).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            if let formError {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.circle").nkFont(14, .semibold).foregroundStyle(levelAmber)
                    Text(formError).nkFont(13.5).lineSpacing(3).foregroundStyle(levelAmber).fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }
            Button { Task { await connect() } } label: {
                HStack(spacing: 8) {
                    if connecting { ProgressView().tint(NK.ground).controlSize(.small) }
                    Text(connecting ? "Belépek…" : "Összekötés").nkFont(16, .semibold)
                }
                .foregroundStyle(NK.ground)
                .frame(maxWidth: .infinity).frame(height: 50).background(Capsule().fill(.white))
                .opacity(canConnect ? 1 : 0.5).contentShape(Capsule())
            }
            .buttonStyle(.plain).disabled(!canConnect)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
        .onAppear { if address.isEmpty, revoked, let a = store.mailbox?.address { address = a } }
    }

    private var canConnect: Bool {
        !connecting && !address.trimmingCharacters(in: .whitespaces).isEmpty && !secret.isEmpty
    }

    private func field(_ placeholder: String, text: Binding<String>, secure: Bool) -> some View {
        Group {
            if secure {
                SecureField("", text: text, prompt: Text(placeholder).foregroundStyle(.white.opacity(0.4)))
                    .focused($focus, equals: .secret)
            } else {
                TextField("", text: text, prompt: Text(placeholder).foregroundStyle(.white.opacity(0.4)))
                    .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.emailAddress)
                    .textContentType(.emailAddress).focused($focus, equals: .address)
            }
        }
        .nkFont(15.5).foregroundStyle(.white).padding(.horizontal, 16).frame(height: 48)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.07)))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(.white.opacity(0.14)))
    }

    private func connect() async {
        let addr = address.trimmingCharacters(in: .whitespaces)
        let sent = secret
        // Out of the field first: whatever happens next, the password is not on the screen or in view state.
        secret = ""
        focus = nil
        connecting = true
        formError = nil
        defer { connecting = false }
        switch await store.connect(address: addr, appPassword: sent) {
        case .done:
            address = ""
            toast("Összekötöttem a postafiókot")
            await store.refresh()
        case .failed(let e):
            formError = levelConnectError(e)
        default:
            break
        }
    }

    // MARK: Connected

    private var revokedCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Circle().fill(levelAmber).frame(width: 9, height: 9).padding(.top, 5)
                Text("A postafiók nem fogadja el az alkalmazásjelszót.")
                    .nkFont(14.5, .semibold).foregroundStyle(levelAmber).fixedSize(horizontal: false, vertical: true)
            }
            Text("Valószínűleg visszavontad, vagy lejárt. Kérj egy újat a Google-fiókban, és írd be alább.")
                .nkFont(13).lineSpacing(3).foregroundStyle(.white.opacity(0.6))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
    }

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
                    Text(silent ? "Két futás óta nem jött levél — lehet, hogy a továbbítás leállt." : "Rendben")
                        .nkFont(14.5, .semibold).lineSpacing(3).foregroundStyle(silent ? levelAmber : green)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if silent {
                    Text("Nézd meg a Gmailben, hogy a továbbítás még be van-e kapcsolva.")
                        .nkFont(13).lineSpacing(3).foregroundStyle(.white.opacity(0.6))
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
            Text("A lecsatolás törli a tárolt alkalmazásjelszót. A már átnézett levelek összefoglalói megmaradnak.")
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
