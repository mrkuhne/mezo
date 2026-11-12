import SwiftUI
import BoopCore
import BoopDesign

/// How one server chip reads in the "Boop látja · most" strip: a glyph, a headline and a quiet second line. Every word
/// of the server's chip shows — the label always leads; a short value joins it in the headline ("Alvás 6ó 10p"), a
/// phrase goes to the second line before the sub ("Naptár" / "még 2 esemény · következő 14:00").
struct ChipFace: Equatable {
    let glyph: String, title: String, sub: String

    init(glyph: String, title: String, sub: String) { self.glyph = glyph; self.title = title; self.sub = sub }

    init(_ chip: DayChip) {
        glyph = switch chip.key {
        case "sleep": "moon-cream"
        case "session": chip.label.hasPrefix("Röpi") ? "ball-sun" : "dumbbell-ink"
        case "checkins": "pen-sun"
        case "fuel": "bowl-cream"
        case "goal": "star-sun"
        case "calendar": "clock-ink"
        default: "spark-cream"
        }
        switch chip.key {
        case "checkins", "goal", "calendar":
            title = chip.label; sub = [chip.value, chip.sub].compactMap { $0 }.joined(separator: " · ")
        default:
            title = "\(chip.label) \(chip.value)"; sub = chip.sub ?? ""
        }
    }
}

/// Boop's tab (B3, spec §5.5): a chat that already knows today. The painted head with the orb, the strip of what Boop
/// sees right now (the server's chips), the ready questions for today, today's conversation (the owner's bubbles on the
/// right, Boop's serif answers with the orb), and the composer — text, or the mic that fills the field. Without the net
/// a question waits on the phone and goes when the net is back.
struct BoopTabView: View {
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(\.scenePhase) private var scenePhase
    @State private var input = ""
    @State private var recording = false
    @State private var transcribing = false
    @State private var toast: String?
    @FocusState private var typing: Bool

    static let offlineLine = "Nincs net · a kérdésed elküldöm, amint lesz"

    private var chat: ChatStore? { ritmus?.chat }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                NKTabPage(hue: .forma, heroHeight: 250, compact: nil) {
                    head
                } content: {
                    VStack(alignment: .leading, spacing: 16) {
                        if let chat {
                            if !chat.chips.isEmpty { sees(chat.chips) }
                            if chat.lines.isEmpty && !chat.questions.isEmpty { suggestions(chat.questions) }
                            ForEach(chat.lines) { line in bubble(line) }
                            if chat.answering { waiting }
                        }
                        Color.clear.frame(height: 150).id("end")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, -30)
                    .animation(.spring(response: 0.4, dampingFraction: 0.85), value: chat?.lines)
                    .animation(.easeOut(duration: 0.25), value: chat?.answering)
                }
                .onChange(of: chat?.lines.count) { withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
                .onChange(of: chat?.answering) { withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
            }
            composer.padding(.bottom, typing ? 10 : 92)
        }
        .nkToast($toast)
        .task { await chat?.refresh() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await chat?.refresh() } } }
    }

    private var head: some View {
        VStack(spacing: 8) {
            StillOrb(palette: Hue.forma.orb, size: 54, level: 0.8).padding(.top, 70)
            Text("Boop").nkFont(32, design: .serif).foregroundStyle(.white)
            Text("Kérdezz bármit a mai napodról — tudom, mi történt.")
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center).padding(.horizontal, 24)
        }
    }

    // MARK: - What Boop sees, what you can ask

    private func sees(_ chips: [DayChip]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("BOOP LÁTJA · MOST")
            ScrollView(.horizontal) {
                HStack(spacing: 8) { ForEach(chips) { chip(ChipFace($0)) } }
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled()
        }
    }

    private func chip(_ face: ChipFace) -> some View {
        HStack(spacing: 8) {
            NKGlyph(face.glyph, .white.opacity(0.85), size: 16)
            VStack(alignment: .leading, spacing: 1) {
                Text(face.title).nkFont(13.5, .semibold).foregroundStyle(.white).lineLimit(1)
                if !face.sub.isEmpty {
                    Text(face.sub).nkFont(11.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .nkGlass(16)
        .accessibilityElement(children: .combine)
    }

    private func suggestions(_ questions: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("MA KÉRDEZHETED")
            ForEach(questions, id: \.self) { q in
                Button { Task { await ask(q) } } label: {
                    HStack {
                        Text(q).nkFont(15.5, .medium).foregroundStyle(.white).multilineTextAlignment(.leading)
                        Spacer()
                        Image(systemName: "arrow.up").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(.horizontal, 16).frame(minHeight: 50)
                    .nkGlass(18)
                    .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(chat?.busy == true)
            }
        }
    }

    // MARK: - The conversation

    @ViewBuilder private func bubble(_ line: ChatLine) -> some View {
        if line.who == .boop {
            HStack(alignment: .top, spacing: 10) {
                StillOrb(palette: Hue.forma.orb, size: 26, level: 0.8).padding(.top, 4)
                Text(line.text).nkFont(17, design: .serif).lineSpacing(4).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 10)
            }
            .transition(.opacity.combined(with: .offset(y: 10)))
        } else {
            VStack(alignment: .trailing, spacing: 6) {
                HStack {
                    Spacer(minLength: 50)
                    Text(line.text).nkFont(15.5).lineSpacing(2).foregroundStyle(.white)
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.12)))
                }
                if line.state == .failed {
                    Button { retry(line) } label: {
                        Text("Nem sikerült elküldeni · Újra").nkFont(13, .medium).foregroundStyle(.white.opacity(0.75))
                    }
                    .buttonStyle(.plain)
                }
            }
            .transition(.opacity.combined(with: .offset(y: 10)))
        }
    }

    /// Boop is answering: a quiet ellipsis in his place.
    private var waiting: some View {
        HStack(alignment: .top, spacing: 10) {
            StillOrb(palette: Hue.forma.orb, size: 26, level: 0.8).padding(.top, 4)
            Text("…").nkFont(17, design: .serif).foregroundStyle(.white.opacity(0.7))
            Spacer()
        }
        .accessibilityLabel("Boop válaszol")
    }

    // MARK: - Composer

    private var micAvailable: Bool { ritmus.map { $0.voiceInputAvailable($0.recorder) } ?? false }

    private var composer: some View {
        VStack(spacing: 8) {
            if chat?.hasQueued == true { OfflineChip(Self.offlineLine) }
            HStack(spacing: 10) {
                TextField("", text: $input, prompt: Text(prompt).foregroundStyle(.white.opacity(0.45)))
                    .nkFont(16).foregroundStyle(.white)
                    .focused($typing)
                    .submitLabel(.send)
                    .onSubmit { send() }
                if input.trimmingCharacters(in: .whitespaces).isEmpty || recording {
                    Button(action: mic) {
                        NKGlyph("mic", recording ? NK.ground : .white.opacity(0.8), size: 22)
                            .frame(width: 36, height: 36)
                            .background { if recording { Circle().fill(.white) } }
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .opacity(micAvailable || recording ? 1 : 0.35)
                    .disabled(transcribing || ritmus?.recorder == nil)
                    .accessibilityLabel(recording ? "Felvétel leállítása" : "Mondd el")
                } else {
                    Button(action: send) {
                        Image(systemName: "arrow.up").font(.system(size: 15, weight: .bold)).foregroundStyle(NK.ground)
                            .frame(width: 34, height: 34).background(Circle().fill(.white))
                    }
                    .buttonStyle(.plain)
                    .disabled(chat?.busy == true)
                    .opacity(chat?.busy == true ? 0.4 : 1)
                    .accessibilityLabel("Küldés")
                }
            }
            .padding(.leading, 18).padding(.trailing, 8).frame(height: 52)
            .glassEffect(.regular, in: .capsule)
        }
        .padding(.horizontal, 16)
    }

    private var prompt: String {
        recording ? "Hallgatlak…" : transcribing ? "Leírom…" : "Kérdezd Boopot…"
    }

    /// While Boop answers the text stays in the field (send is dimmed); it is cleared only once the question is taken.
    private func send() {
        let text = input
        guard let chat, !chat.busy, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        input = ""
        Task {
            if !(await ask(text)), input.isEmpty { input = text }
        }
    }

    @discardableResult
    private func ask(_ text: String) async -> Bool {
        guard let chat, let ritmus else { return false }
        return await chat.ask(text, online: ritmus.online)
    }

    private func retry(_ line: ChatLine) {
        guard let chat, let ritmus else { return }
        Task { await chat.retry(line.id, online: ritmus.online) }
    }

    /// One tap to talk, one to stop; what was heard fills the field (the owner sends it) — the phone's transcript, or,
    /// online, the server's (nothing is queued). Offline without on-device recognition the mic is dimmed and says so.
    private func mic() {
        guard let ritmus, let recorder = ritmus.recorder else { return }
        if !recording {
            guard micAvailable else { toast = RitmusEnvironment.voiceOfflineHint; return }
            Task {
                do { try await recorder.start(); recording = true }
                catch { recording = false; toast = MicCopy.line(for: error) }
            }
            return
        }
        recording = false
        transcribing = true
        Task {
            defer { transcribing = false }
            guard let capture = await recorder.stop() else { return }
            switch await ritmus.heardSpeech(capture, speechDenied: recorder.speechDenied) {
            case .text(let text): input = text
            case .problem(let line): toast = line
            }
        }
    }
}
