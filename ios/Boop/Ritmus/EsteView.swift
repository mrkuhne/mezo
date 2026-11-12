import SwiftUI
import BoopCore
import BoopDesign

/// The evening close, full screen (spec §5.4, approved spike `RitmusEste.swift`): the dusk sky, "ESTI ZÁRÁS · EGY PERC /
/// Zárjuk le a napot", four numbered steps that tick when answered — energy on ten living orbs, the goal of the day with
/// *Sikerült · Részben · Nem* and Boop's own goals, the day on five living orbs, *Mesélj* (voice or typed) — and
/// *Lezárom a napot*, enabled by the rating. Closed: "LEZÁRVA · 21:33 / Jó éjszakát", Boop's sentence, "A MAI NAPOD",
/// the bedtime line, *Kész* and *Módosítom*. Offline: saved on the phone, Boop's sentence later.
struct EsteView: View {
    let env: RitmusEnvironment
    let brief: Brief?
    let onClose: () -> Void
    @State private var flow: EsteFlow
    @State private var motion = OrbMotion()
    @State private var voice: VoiceRowPhase = .idle
    @State private var micProblem: String?

    private static let hue = Hue.pulzus

    init(env: RitmusEnvironment, brief: Brief?, onClose: @escaping () -> Void) {
        self.env = env; self.brief = brief; self.onClose = onClose
        _flow = State(initialValue: EsteFlow(env: env, brief: brief))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                head
                VStack(spacing: 12) {
                    if flow.showsSummary { summary.transition(.opacity) } else { steps.transition(.opacity) }
                }
                .padding(.horizontal, 16).padding(.top, -40).padding(.bottom, 50)
            }
            .animation(.spring(response: 0.5, dampingFraction: 0.85), value: flow.showsSummary)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(edges: .top)
        .background(NKGround(hue: Self.hue))
        .preferredColorScheme(.dark)
        .onDisappear {
            motion.stop()
            if case .recording = voice, let recorder = env.recorder { Task { if let c = await recorder.stop() { recorder.discard(c) } } }
            // closed without closing the day: a kept recording goes
            flow.abandon()
        }
        .task { await flow.refresh() }
        .onChange(of: brief?.generatedAt) { flow.use(brief) }
        // the close reached the server (now, or later when the net came back): Boop's sentence can be asked for
        .task(id: flow.closed?.pending) {
            if flow.closed?.pending == false { await env.refreshCloseLine(flow.date) }
        }
    }

    // MARK: - The sky

    private var head: some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: 300)
                .overlay { PaintedLandscape(hue: Self.hue) }
                .clipped()
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.55), .init(color: .clear, location: 1)],
                                     startPoint: .top, endPoint: .bottom))
            VStack(spacing: 0) {
                HStack {
                    Button(action: onClose) {
                        Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Bezárom")
                    Spacer()
                    TimelineView(.everyMinute) { _ in
                        Text(CheckinFlow.clock(env.clock(), env.calendar)).nkFont(13, .semibold, design: .monospaced)
                            .foregroundStyle(.white.opacity(0.8))
                    }
                }
                .padding(.horizontal, 16).padding(.top, 58)
                VStack(spacing: 8) {
                    Text(flow.showsSummary ? (flow.closedLabel ?? "LEZÁRVA") : "ESTI ZÁRÁS · EGY PERC")
                        .nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.8))
                    Text(flow.showsSummary ? "Jó éjszakát" : "Zárjuk le a napot").nkFont(38, design: .serif).foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    if flow.showsSummary && flow.offline { OfflineChip().padding(.top, 6) }
                }
                .padding(.top, 40).padding(.horizontal, 20)
            }
        }
    }

    // MARK: - The four steps

    private var steps: some View {
        VStack(spacing: 12) {
            step(1, "HOGY VAGY MOST?", done: flow.stepsDone[0]) {
                LevelRow(palette: Hue.mozgas.orb, value: flow.energy, size: 26, motion: motion) { k in
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) { flow.pickEnergy(k) }
                }
            }
            step(2, "A NAP CÉLJA", done: flow.stepsDone[1]) { goalStep }
            step(3, "MILYEN VOLT A NAP?", done: flow.stepsDone[2]) { ratingRow }
            step(4, "MESÉLJ", done: flow.stepsDone[3], optional: true) {
                VStack(alignment: .leading, spacing: 10) {
                    VoiceRecorderRow(phase: voice, prompt: "Mesélj a napodról", micEnabled: env.recorder != nil,
                                     onMic: mic, onTyped: typed)
                    if let micProblem {
                        Text(micProblem).nkFont(13).foregroundStyle(Color(hex: 0xF7A8C4)).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            VStack(spacing: 8) {
                NKPill("Lezárom a napot", glyph: "spark-cream", wide: false) { Task { await flow.closeDay() } }
                    .opacity(flow.canClose ? 1 : 0.45)
                    .disabled(!flow.canClose)
                Text("A napot az értékelés zárja le, a többi elhagyható.").nkFont(12).foregroundStyle(.white.opacity(0.5))
                    .multilineTextAlignment(.center)
                if let problem = flow.saveProblem {
                    Text(problem).nkFont(13).foregroundStyle(Color(hex: 0xF7A8C4)).multilineTextAlignment(.center)
                }
            }
            .padding(.top, 6)
        }
    }

    @ViewBuilder private var goalStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let goal = flow.goalText {
                Text(goal).nkFont(21, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    ForEach(EsteFlow.outcomes, id: \.id) { o in
                        let on = flow.outcome == o.id
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) { flow.pickOutcome(o.id) }
                        } label: {
                            Text(o.label).nkFont(15, .semibold).foregroundStyle(on ? NK.ground : .white)
                                .frame(maxWidth: .infinity).frame(height: 42)
                                .background(Capsule().fill(on ? .white : .white.opacity(0.08)))
                                .overlay(Capsule().stroke(.white.opacity(on ? 0 : 0.14)))
                                .contentShape(Capsule())
                        }
                        .buttonStyle(PressStyle())
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .sensoryFeedback(.selection, trigger: flow.outcome)
            } else {
                Text("Ma nem tűztél ki célt.").nkFont(15).foregroundStyle(.white.opacity(0.6))
            }
            if !flow.planGoals.isEmpty {
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                NKMono("BOOP CÉLJAI · MAGUKTÓL")
                ForEach(flow.planGoals, id: \.id) { g in boopGoal(g) }
            }
        }
    }

    private func boopGoal(_ g: PlanGoalPayload) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(g.met == true ? .white : .clear)
                Circle().stroke(.white.opacity(g.met == true ? 0 : 0.35), lineWidth: 1.2)
                if g.met == true { NKGlyph("check-ink", NK.ground, size: 13) }
            }
            .frame(width: 22, height: 22)
            Text(g.title).nkFont(15).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Text(g.result.isEmpty ? (g.met == nil ? "még előtted" : "") : g.result).nkFont(13).foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }

    private var ratingRow: some View {
        HStack(spacing: 0) {
            ForEach(1...5, id: \.self) { k in
                let on = k <= (flow.rating ?? 0)
                VStack(spacing: 6) {
                    LivingOrb(palette: Self.hue.orb, size: 38, level: Double(k) / 5, glow: false, motion: motion)
                        .allowsHitTesting(false)
                        .saturation(on ? 1 : 0.15).opacity(on ? 1 : 0.55)
                        .scaleEffect(k == flow.rating ? 1.14 : 1)
                    Text(["Nehéz", "", "Rendben", "", "Remek"][k - 1]).nkFont(11).foregroundStyle(.white.opacity(0.55)).frame(height: 12)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture { withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { flow.pickRating(k) } }
                .accessibilityElement()
                .accessibilityLabel(EsteFlow.ratingWords[k - 1])
                .accessibilityAddTraits(k == flow.rating ? [.isButton, .isSelected] : .isButton)
            }
        }
        .sensoryFeedback(.selection, trigger: flow.rating)
    }

    private func step<C: View>(_ n: Int, _ label: String, done: Bool, optional: Bool = false, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(done ? .white : .clear)
                    Circle().stroke(.white.opacity(done ? 0 : 0.35), lineWidth: 1.2)
                    if done { NKGlyph("check-ink", NK.ground, size: 13) }
                    else { Text("\(n)").font(.custom(Lagy.outfitFamily, size: 13).weight(.medium)).foregroundStyle(.white.opacity(0.8)) }
                }
                .frame(width: 24, height: 24)
                .accessibilityHidden(true)
                NKMono(label)
                Spacer()
                if optional { Text("ha van kedved").nkFont(12).foregroundStyle(.white.opacity(0.45)) }
            }
            content()
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(24)
    }

    // MARK: - Closed

    private var summary: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    LivingOrb(palette: Hue.forma.orb, size: 22, level: 0.85, glow: false, motion: motion).allowsHitTesting(false)
                    NKMono("BOOP")
                }
                Text(flow.boopText).nkFont(19, design: .serif).lineSpacing(4).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            .accessibilityElement(children: .combine)

            ClosedDayCard(rows: flow.summaryRows, quote: flow.journalQuote,
                          onRetry: { Task { await flow.retryVoice() } },
                          onRetrySend: flow.sendFailed ? { Task { await flow.retrySend() } } : nil)

            if let bedtime = flow.bedtimeLine {
                HStack(spacing: 12) {
                    NKGlyph("bell-cream", .white, size: 18)
                    Text(bedtime).nkFont(15, .medium).foregroundStyle(.white)
                    Spacer()
                }
                .padding(16).nkGlass(20)
                .accessibilityElement(children: .combine)
            }

            HStack(spacing: 10) {
                NKPill("Kész", wide: false, action: onClose)
                NKPill("Módosítom", primary: false, wide: false) {
                    voice = .idle
                    micProblem = nil
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { flow.reopen() }
                }
            }
            .padding(.top, 6)
        }
    }

    // MARK: - Mesélj

    private func typed(_ text: String) {
        guard flow.typed(text) else { return }
        voice = .saved(text: text.trimmingCharacters(in: .whitespacesAndNewlines), typed: true)
    }

    /// One tap to talk, one to stop: the phone's transcript, or the recording kept for the upload.
    private func mic() {
        guard let recorder = env.recorder else { return }
        switch voice {
        case .idle:
            micProblem = nil
            Task {
                do { try await recorder.start(); voice = .recording(seconds: 0); tick() }
                catch { voice = .idle; micProblem = MicCopy.line(for: error) }
            }
        case .recording:
            voice = .transcribing
            Task {
                switch await recorder.stop() {
                case .transcript(let text)?:
                    flow.recorded(.transcript(text))
                    voice = .saved(text: text, typed: false)
                case .recording(let name)?:
                    flow.recorded(.recording(fileName: name))
                    voice = .saved(text: nil, typed: false)
                case nil:
                    voice = .idle
                }
            }
        default: break
        }
    }

    private func tick() {
        Task {
            while case .recording(let s) = voice {
                try? await Task.sleep(for: .seconds(1))
                if case .recording = voice { voice = .recording(seconds: s + 1) }
            }
        }
    }

}
